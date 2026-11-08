import type { DebunkKnowledgeEntry } from '../../types.ts'
import { registerLiveDebunks, getCuratedArchiveDebunks } from './debunk-service.ts'
import { 
  cleanHtmlText, 
  parseTurnBackHoaxRss, 
  parseGoogleNewsRss, 
  parseAntaraRss,
  parseGoogleTrendsRssAsSignals
} from '../ingest/rss-parser.ts'
import { 
  cacheRadarItems, 
  getCachedRadarItems, 
  saveTopicCandidates,
  saveSourceRunLog,
  saveIssueActivitySnapshot,
  getIssueActivitySnapshotsFromDB
} from '../../utils/db-adapter.ts'
import { scoreAndTriageRadarEntries } from '../radar/early-warning-scorer.ts'
import { 
  updateConnectorHealth, 
  getAllConnectorHealth, 
  ACTIVE_RADAR_SOURCES 
} from '../radar/source-registry.ts'
import { 
  deduplicatePublications, 
  clusterEventPublications,
  attachTrendSignalsToClusters
} from '../radar/clustering-engine.ts'
import { parseSourceDate, evaluateFreshness, formatMilitaryDate } from '../radar/freshness-engine.ts'
import { 
  evaluateContextRelevance, 
  evaluateMetadataTransparency, 
  determineReviewState,
  classifyTaxonomyDomain 
} from '../radar/radar-assessment.ts'
import { 
  attachIssueActivityToClusters,
  createIssueActivitySnapshot 
} from '../radar/issue-activity-engine.ts'
import { 
  topicDiscoveryEngine,
  mapDomainToGoogleNewsProfile,
  mapDomainToGdeltProfile
} from '../radar/topic-discovery-engine.ts'
import { parseGdeltDocResponse } from '../ingest/gdelt-adapter.ts'
import type { 
  NormalizedPublication, 
  EventCluster, 
  ConnectorHealth,
  SearchTrendSignal,
  TopicCandidate,
  RadarTaxonomyDomain
} from '../radar/radar-types.ts'

export interface TurnBackHoaxPost {
  id: number
  date: string
  title: { rendered: string }
  excerpt: { rendered: string }
  content?: { rendered: string }
  link: string
}

export interface LiveRadarFetchResult {
  entries: DebunkKnowledgeEntry[]
  clusters?: EventCluster[]
  trendSignals?: SearchTrendSignal[]
  topicCandidates?: TopicCandidate[]
  connectorHealth?: Record<string, ConnectorHealth>
  isLive: boolean
  isStale?: boolean
  cacheState?: 'LIVE' | 'CACHED' | 'STALE_CACHE'
  sourceChannel: 'API_PROXY' | 'API_DIRECT' | 'API_CORS_PROXY' | 'LOCAL_ARCHIVE'
  latencyMs: number
  fetchedAt: number
  lastSuccessAt?: number
  errorMessage?: string
}

export interface FetchXmlResult {
  success: boolean
  xml?: string
  channel?: 'API_PROXY' | 'API_DIRECT' | 'API_CORS_PROXY'
  latencyMs: number
  httpStatus?: number | null
  rateLimitStatus?: { isRateLimited: boolean; retryAfterSeconds?: number; resetAt?: number } | null
  errorCode?: string | null
  errorMessage?: string | null
}

export interface SingleSourceFetchResult {
  sourceId: string
  success: boolean
  httpStatus: number | null
  latencyMs: number
  transportChannel: string
  responseBytes?: number
  parsedCount: number
  acceptedCount: number
  cacheState?: string
  errorCode?: string | null
  errorMessage?: string | null
  retryAfterSec?: number | null
  publications: NormalizedPublication[]
  trendSignals: SearchTrendSignal[]
  isDynamicSearch?: boolean
  candidateId?: string
  dynamicTopic?: string
  dynamicProfileId?: string
}

// In-memory publication registry to preserve stable firstObservedAt (WP4)
const knownPublicationsMap = new Map<string, NormalizedPublication>()
const knownFirstObservedTimes = new Map<string, number>()

/**
 * Mengosongkan memori publikasi radar (misal saat operator memilih pembersihan tuntas)
 */
export function clearKnownPublications(): void {
  knownPublicationsMap.clear()
  knownFirstObservedTimes.clear()
}

/**
 * Mengekstrak epoch timestamp valid dari DebunkKnowledgeEntry untuk penentuan urutan kronologis.
 */
export function getDebunkEntryTimestamp(item: DebunkKnowledgeEntry): number {
  if (item.publishedDate && item.publishedDate !== 'Waktu Publikasi Tidak Tersedia' && item.publishedDate !== 'Tanggal tidak tersedia') {
    const { timestamp, status } = parseSourceDate(item.publishedDate)
    if (status === 'VALID' && timestamp !== null && timestamp > 0) {
      return timestamp
    }
  }
  if (item.interceptedAt && item.interceptedAt !== 'Waktu Publikasi Tidak Tersedia') {
    const { timestamp, status } = parseSourceDate(item.interceptedAt)
    if (status === 'VALID' && timestamp !== null && timestamp > 0) {
      return timestamp
    }
  }
  if (item.issueActivity?.latestObservedAt) {
    return item.issueActivity.latestObservedAt
  }
  if (item.issueActivity?.firstObservedAt) {
    return item.issueActivity.firstObservedAt
  }
  return 0
}

/**
 * Mengurutkan array entri radar secara deterministik dari waktu publikasi termutakhir (descending).
 * Menjamin isu breaking dan baru terbit selalu berada di puncak feed pemantauan radar.
 */
export function sortRadarEntries(entries: DebunkKnowledgeEntry[]): DebunkKnowledgeEntry[] {
  return [...entries].sort((a, b) => {
    const tsA = getDebunkEntryTimestamp(a)
    const tsB = getDebunkEntryTimestamp(b)
    if (tsB !== tsA) {
      return tsB - tsA
    }
    return (b.cognitiveScore || 0) - (a.cognitiveScore || 0)
  })
}

/**
 * Memulihkan riwayat firstObservedAt dari database IndexedDB agar stabil melintasi restart (Sprint 7 WP6 - Carry-over 8.1)
 */
export async function hydrateKnownPublicationsFromDB(): Promise<number> {
  try {
    const snapshots = await getIssueActivitySnapshotsFromDB()
    let restored = 0
    for (const snap of snapshots) {
      if (snap.id && snap.id.startsWith('pub-') && snap.firstObservedAt) {
        const pubId = snap.id.replace(/^pub-/, '')
        knownFirstObservedTimes.set(pubId, snap.firstObservedAt)
        restored++
      }
    }
    return restored
  } catch {
    return 0
  }
}

// Inisialisasi hidrasi awal
hydrateKnownPublicationsFromDB().catch(() => {})

/**
 * Backward compatibility cleanHtml helper
 */
export function cleanHtml(html: string): string {
  return cleanHtmlText(html)
}

/**
 * Helper terstandarisasi untuk menarik XML feed dengan 3 lapis transmisi aman:
 * Lapis 1: Same-Origin Secure Radar Gateway (/api/radar/feed/:sourceId)
 * Lapis 2: Local Dev Server Proxy (/api/rss/...)
 * Lapis 3: Direct Fetch (bebas CORS saat di Electron desktop / Node runtime)
 */
async function fetchXmlWithFallback(
  sourceId: string,
  proxyUrl: string, 
  directUrl: string, 
  timeoutMs = 6000,
  customFetch?: typeof fetch
): Promise<FetchXmlResult> {
  const fetchStart = Date.now()
  let lastHttpStatus: number | null = null
  let lastErrorCode: string | null = null
  let lastErrorMessage: string | null = null
  let lastRateLimit: { isRateLimited: boolean; retryAfterSeconds?: number; resetAt?: number } | null = null

  const fetchFn = customFetch || (typeof fetch !== 'undefined' ? fetch : null)
  if (!fetchFn) {
    return {
      success: false,
      latencyMs: 0,
      errorCode: 'NO_FETCH_AVAILABLE',
      errorMessage: 'Runtime fetch API tidak tersedia'
    }
  }

  // Lapis 1: Coba Same-Origin Production Gateway Route (atau local loopback jika Electron file://)
  const isFileProto = typeof window !== 'undefined' && window.location.protocol === 'file:'
  const gatewayBase = isFileProto ? 'http://127.0.0.1:5174' : ''
  const gatewayUrl = `${gatewayBase}/api/radar/feed/${sourceId}`
  const isJsonExpected = sourceId === 'src-gdelt-doc-id' || sourceId.startsWith('gdelt-')
  const defaultAccept = isJsonExpected ? 'application/json, text/plain, */*' : 'application/rss+xml, application/xml, text/xml, */*'

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await (fetchFn as any)(gatewayUrl, {
      signal: controller.signal,
      headers: { 'Accept': defaultAccept }
    })
    clearTimeout(timer)
    lastHttpStatus = res.status

    if (res.status === 429) {
      const retrySec = parseInt(res.headers?.get ? (res.headers.get('Retry-After') || '60') : '60', 10)
      lastRateLimit = { isRateLimited: true, retryAfterSeconds: retrySec, resetAt: Date.now() + retrySec * 1000 }
      return {
        success: false,
        latencyMs: Date.now() - fetchStart,
        httpStatus: 429,
        rateLimitStatus: lastRateLimit,
        errorCode: 'HTTP_429_RATE_LIMITED',
        errorMessage: 'HTTP 429: Batasan laju permintaan terlampaui (Rate Limited)'
      }
    }

    if (res.ok) {
      const text = await res.text()
      if (isJsonExpected) {
        const trimmed = text.trim()
        const isHtml = trimmed.startsWith('<') || trimmed.toLowerCase().includes('<html') || trimmed.toLowerCase().includes('<!doctype')
        if (!isHtml && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
          return { success: true, xml: text, channel: 'API_PROXY', latencyMs: Date.now() - fetchStart, httpStatus: res.status }
        } else {
          lastErrorCode = 'MALFORMED_JSON_RESPONSE'
          lastErrorMessage = 'Respon diterima tetapi bukan format JSON yang valid'
        }
      } else if (text.includes('<item>') || text.includes('<entry>') || text.includes('<channel>')) {
        return { success: true, xml: text, channel: 'API_PROXY', latencyMs: Date.now() - fetchStart, httpStatus: res.status }
      } else {
        lastErrorCode = 'MALFORMED_FEED_NO_ITEMS'
        lastErrorMessage = 'Respon diterima tetapi tidak memuat elemen XML feed yang valid'
      }
    } else if (res.status >= 500) {
      lastErrorCode = 'HTTP_SERVER_ERROR'
      lastErrorMessage = `Server gateway mengembalikan kode status ${res.status}`
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      lastErrorCode = 'FETCH_TIMEOUT'
      lastErrorMessage = `Batas waktu penarikan gateway (${timeoutMs}ms) terlampaui`
    } else {
      lastErrorCode = 'NETWORK_ERROR'
      lastErrorMessage = err?.message || 'Gagal menghubungi gateway feed'
    }
  }

  // Lapis 2: Coba Local Vite Proxy (Fallback Dev)
  if (proxyUrl) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      const res = await (fetchFn as any)(proxyUrl, {
        signal: controller.signal,
        headers: { 'Accept': defaultAccept }
      })
      clearTimeout(timer)
      lastHttpStatus = res.status

      if (res.status === 429) {
        const retrySec = parseInt(res.headers?.get ? (res.headers.get('Retry-After') || '60') : '60', 10)
        lastRateLimit = { isRateLimited: true, retryAfterSeconds: retrySec, resetAt: Date.now() + retrySec * 1000 }
        return {
          success: false,
          latencyMs: Date.now() - fetchStart,
          httpStatus: 429,
          rateLimitStatus: lastRateLimit,
          errorCode: 'HTTP_429_RATE_LIMITED',
          errorMessage: 'HTTP 429: Batasan laju permintaan terlampaui (Rate Limited)'
        }
      }

      if (res.ok) {
        const text = await res.text()
        if (isJsonExpected) {
          const trimmed = text.trim()
          const isHtml = trimmed.startsWith('<') || trimmed.toLowerCase().includes('<html') || trimmed.toLowerCase().includes('<!doctype')
          if (!isHtml && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
            return { success: true, xml: text, channel: 'API_PROXY', latencyMs: Date.now() - fetchStart, httpStatus: res.status }
          }
        } else if (text.includes('<item>') || text.includes('<entry>') || text.includes('<channel>')) {
          return { success: true, xml: text, channel: 'API_PROXY', latencyMs: Date.now() - fetchStart, httpStatus: res.status }
        }
      }
    } catch {
      // Lanjut ke Lapis 3
    }
  }

  // Lapis 3: Coba Direct Fetch (Electron Desktop / Node standalone tanpa CORS)
  if (directUrl) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      const res = await (fetchFn as any)(directUrl, {
        signal: controller.signal,
        headers: { 
          'Accept': defaultAccept,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NARADA-Defense/1.0'
        }
      })
      clearTimeout(timer)
      lastHttpStatus = res.status

      if (res.status === 429) {
        const retrySec = parseInt(res.headers?.get ? (res.headers.get('Retry-After') || '60') : '60', 10)
        lastRateLimit = { isRateLimited: true, retryAfterSeconds: retrySec, resetAt: Date.now() + retrySec * 1000 }
        return {
          success: false,
          latencyMs: Date.now() - fetchStart,
          httpStatus: 429,
          rateLimitStatus: lastRateLimit,
          errorCode: 'HTTP_429_RATE_LIMITED',
          errorMessage: 'HTTP 429: Batasan laju permintaan terlampaui (Rate Limited)'
        }
      }

      if (res.ok) {
        const text = await res.text()
        if (isJsonExpected) {
          const trimmed = text.trim()
          const isHtml = trimmed.startsWith('<') || trimmed.toLowerCase().includes('<html') || trimmed.toLowerCase().includes('<!doctype')
          if (!isHtml && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
            return { success: true, xml: text, channel: 'API_DIRECT', latencyMs: Date.now() - fetchStart, httpStatus: res.status }
          } else {
            lastErrorCode = 'MALFORMED_JSON_RESPONSE'
            lastErrorMessage = 'Respon langsung tidak memuat format JSON yang valid'
          }
        } else if (text.includes('<item>') || text.includes('<entry>') || text.includes('<channel>')) {
          return { success: true, xml: text, channel: 'API_DIRECT', latencyMs: Date.now() - fetchStart, httpStatus: res.status }
        } else {
          lastErrorCode = 'MALFORMED_FEED_NO_ITEMS'
          lastErrorMessage = 'Respon langsung tidak memuat elemen <item> XML'
        }
      } else if (res.status >= 500) {
        lastErrorCode = 'HTTP_SERVER_ERROR'
        lastErrorMessage = `Server sumber mengembalikan kode status ${res.status}`
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        lastErrorCode = 'FETCH_TIMEOUT'
        lastErrorMessage = `Batas waktu penarikan langsung (${timeoutMs}ms) terlampaui`
      } else {
        lastErrorCode = 'NETWORK_ERROR'
        lastErrorMessage = err?.message || 'Gagal koneksi langsung'
      }
    }
  }

  return {
    success: false,
    latencyMs: Date.now() - fetchStart,
    httpStatus: lastHttpStatus,
    rateLimitStatus: lastRateLimit,
    errorCode: lastErrorCode || 'CONNECTION_FAILED',
    errorMessage: lastErrorMessage || 'Seluruh saluran transmisi gateway dan direct feed gagal dijangkau'
  }
}

/**
 * Mengonversi DebunkKnowledgeEntry menjadi NormalizedPublication
 */
export function normalizeDebunkEntry(
  entry: DebunkKnowledgeEntry, 
  sourceId: string, 
  sourceType: 'rss' | 'official' | 'fact_check',
  sourceName: string,
  domainHint?: RadarTaxonomyDomain
): NormalizedPublication {
  const { timestamp: pubTimestamp } = parseSourceDate(entry.publishedDate)
  const freshness = evaluateFreshness(pubTimestamp)
  const relevance = evaluateContextRelevance(entry.claim, entry.clarification || '', entry.cluster, sourceType)
  const transparency = evaluateMetadataTransparency(
    entry.originalSourceUrl || entry.sourceUrl || '',
    entry.sourceUrl || '',
    entry.officialSource || sourceName,
    pubTimestamp
  )
  const reviewState = determineReviewState(freshness, relevance, transparency, sourceType)
  const domain = domainHint || classifyTaxonomyDomain(entry.claim, entry.clarification || '', 'NATIONAL_POLICY')

  return {
    id: entry.id,
    sourceId,
    sourceType,
    sourceName,
    title: entry.claim,
    originalUrl: entry.originalSourceUrl || entry.sourceUrl || '',
    canonicalUrl: entry.sourceUrl || '',
    excerpt: entry.clarification || '',
    publisher: entry.officialSource || sourceName,
    publishedAt: pubTimestamp,
    publishedAtFormatted: formatMilitaryDate(pubTimestamp),
    firstObservedAt: Date.now(),
    observedAt: Date.now(),
    retrievedAt: Date.now(),
    lastVerifiedAt: entry.verifiedAt ? (parseSourceDate(entry.verifiedAt).timestamp) : null,
    extractionMethod: 'rss',
    category: entry.cluster,
    domain,
    topicTags: entry.keywords || [],
    language: 'id',
    contentFingerprint: entry.id,
    attribution: `${sourceName} • ${entry.officialSource || 'Pers Nasional'}`,
    freshness,
    contextRelevance: relevance,
    metadataTransparency: transparency,
    reviewState,
    verdict: entry.verdict || 'UNVERIFIED',
    clarification: entry.clarification,
    officialSource: entry.officialSource
  }
}

/**
 * Mengonversi EventCluster kembali ke DebunkKnowledgeEntry (kompatibilitas backward ke UI)
 */
export function clusterToDebunkEntry(cluster: EventCluster): DebunkKnowledgeEntry {
  const lead = cluster.leadItem || ({} as any)
  const pubCount = cluster.sourceCoverage?.publicationCount ?? cluster.memberItems?.length ?? 1
  const pubList = cluster.sourceCoverage?.publishers ?? []

  let viralityReason = lead.verdict === 'HOAKS'
    ? '🚨 LAPORAN MAFINDO: Isu Disinformasi Terverifikasi'
    : cluster.freshness?.status === 'BREAKING'
    ? '🔥 BREAKING NEWS LAPANGAN (<3 JAM)'
    : cluster.contextRelevance?.matchedTopics?.[0] || 'PEMBAHASAN PUBLIK HANGAT'

  if (pubCount > 1) {
    viralityReason += ` • Dilaporkan oleh ${pubList.slice(0, 2).join(', ')}${pubList.length > 2 ? ` +${pubList.length - 2}` : ''} (${cluster.sourceCoverage?.distinctPublisherDomainCount ?? 1} domain pers)`
  }

  if (cluster.attachedTrendSignals && cluster.attachedTrendSignals.length > 0) {
    const topTrend = cluster.attachedTrendSignals[0]
    viralityReason += ` • 📊 Tren Google: "${topTrend.query}"${topTrend.searchVolumeBand ? ` (${topTrend.searchVolumeBand})` : ''}`
  }

  return {
    id: cluster.id,
    claim: cluster.title,
    normalizedQuery: (cluster.title || '').toLowerCase(),
    cluster: cluster.category || 'UMUM_NETRAL',
    verdict: lead.verdict || 'UNVERIFIED',
    threatLevel: lead.category === 'KEDAULATAN_MILITER' || lead.verdict === 'HOAKS' ? 'critical' : 'medium',
    clarification: lead.excerpt || '',
    officialSource: cluster.sourceCoverage?.publishers?.join(', ') || lead.publisher || 'Pers Nasional',
    sourceUrl: lead.canonicalUrl || '',
    originalSourceUrl: lead.originalUrl || '',
    originalPlatform: lead.sourceName || 'Pers Nasional',
    interceptedAt: formatMilitaryDate(cluster.firstObservedAt || Date.now()),
    verifiedAt: cluster.leadItem?.lastVerifiedAt ? formatMilitaryDate(cluster.leadItem.lastVerifiedAt) : undefined,
    publishedDate: cluster.leadItem?.publishedAtFormatted || formatMilitaryDate(cluster.firstPublishedAt || Date.now()),
    isBreakingRecent: cluster.freshness?.status === 'BREAKING',
    keywords: lead?.topicTags || [],
    tacticalResponseCivilian: `Informasi terkait "${cluster.title}". ${lead?.excerpt || ''}`,
    tacticalResponseMilitary: `Atensi Teritorial: Pantau isu "${cluster.title}". Cakupan: ${pubCount} publikasi terverifikasi.`,
    isLive: true,
    cognitiveScore: cluster.contextRelevance?.score ?? 50,
    viralityReason,
    issueActivity: cluster.issueActivity,
    clusterDomain: cluster.domain || cluster.leadItem?.domain || 'NATIONAL_POLICY',
    attachedTrendSignals: cluster.attachedTrendSignals,
    sourceCoverage: cluster.sourceCoverage
  }
}

/**
 * Menarik satu sumber radar independen (Sprint 6.1 WP1 / S61-01 s.d. S61-08)
 */
export async function fetchSingleRadarSource(
  sourceId: string,
  customFetch?: typeof fetch
): Promise<SingleSourceFetchResult> {
  const src = ACTIVE_RADAR_SOURCES.find(s => s.id === sourceId)
  if (!src || !src.enabled) {
    return {
      sourceId,
      success: false,
      httpStatus: null,
      latencyMs: 0,
      transportChannel: 'NONE',
      parsedCount: 0,
      acceptedCount: 0,
      errorCode: 'SOURCE_DISABLED_OR_NOT_FOUND',
      errorMessage: `Sumber ${sourceId} tidak ditemukan atau dinonaktifkan`,
      publications: [],
      trendSignals: []
    }
  }

  updateConnectorHealth(src.id, {
    state: 'CONNECTING',
    isSuccess: true,
    userReadableMessage: 'Menghubungkan ke saluran feed...'
  })

  const attemptStart = Date.now()
  const fetchRes = await fetchXmlWithFallback(src.id, src.feedUrl, src.directUrl, src.fetchTimeoutMs, customFetch)
  const latencyMs = fetchRes.latencyMs

  if (fetchRes.success && fetchRes.xml) {
    const channel = fetchRes.channel || 'API_PROXY'
    const responseBytes = fetchRes.xml.length

    if (src.sourceType === 'search_trend') {
      const signals = parseGoogleTrendsRssAsSignals(fetchRes.xml, src.maxItems || 20)
      updateConnectorHealth(src.id, {
        state: channel === 'API_CORS_PROXY' ? 'DEGRADED' : 'HEALTHY',
        httpStatus: fetchRes.httpStatus,
        latencyMs,
        itemCount: signals.length,
        isSuccess: true,
        userReadableMessage: `Berhasil menarik ${signals.length} sinyal minat penelusuran Google`
      })

      await saveSourceRunLog({
        id: `run-${src.id}-${Date.now()}`,
        sourceId: src.id,
        runType: 'FIXED_FEED',
        attemptAt: attemptStart,
        completedAt: Date.now(),
        status: 'SUCCESS',
        httpStatus: fetchRes.httpStatus ?? 200,
        latencyMs,
        transportChannel: channel,
        responseBytes,
        parsedCount: signals.length,
        acceptedCount: signals.length,
        cacheState: 'LIVE',
        nextDueAt: Date.now() + (src.pollIntervalMs || 600000),
        timestamp: Date.now()
      })

      return {
        sourceId: src.id,
        success: true,
        httpStatus: fetchRes.httpStatus ?? 200,
        latencyMs,
        transportChannel: channel,
        responseBytes,
        parsedCount: signals.length,
        acceptedCount: signals.length,
        cacheState: 'LIVE',
        publications: [],
        trendSignals: signals
      }
    } else {
      let norm: NormalizedPublication[] = []
      let parsedCount = 0

      if (src.parserAdapter === 'gdelt_doc' || src.sourceType === 'aggregator') {
        const gdeltRes = parseGdeltDocResponse(fetchRes.xml, {
          sourceId: src.id,
          sourceName: src.displayName,
          domainHint: src.domain,
          maxItems: src.maxItems || 50
        })

        if (gdeltRes.isMalformed) {
          updateConnectorHealth(src.id, {
            state: 'DEGRADED',
            httpStatus: fetchRes.httpStatus,
            latencyMs,
            isSuccess: false,
            errorCode: gdeltRes.errorCode || 'MALFORMED_GDELT_PAYLOAD',
            userReadableMessage: gdeltRes.errorMessage || 'Format respons GDELT tidak valid'
          })

          await saveSourceRunLog({
            id: `run-${src.id}-${Date.now()}`,
            sourceId: src.id,
            runType: 'FIXED_FEED',
            attemptAt: attemptStart,
            completedAt: Date.now(),
            status: 'FAILED',
            httpStatus: fetchRes.httpStatus ?? 200,
            latencyMs,
            transportChannel: channel,
            parsedCount: 0,
            acceptedCount: 0,
            errorCode: gdeltRes.errorCode || 'MALFORMED_GDELT_PAYLOAD',
            errorMessage: gdeltRes.errorMessage || 'Format respons GDELT tidak valid',
            timestamp: Date.now()
          })

          return {
            sourceId: src.id,
            success: false,
            httpStatus: fetchRes.httpStatus ?? 200,
            latencyMs,
            transportChannel: channel,
            parsedCount: 0,
            acceptedCount: 0,
            errorCode: gdeltRes.errorCode || 'MALFORMED_GDELT_PAYLOAD',
            errorMessage: gdeltRes.errorMessage || 'Format respons GDELT tidak valid',
            publications: [],
            trendSignals: []
          }
        }

        norm = gdeltRes.publications
        parsedCount = gdeltRes.totalArticlesFound
      } else {
        let parsedEntries: DebunkKnowledgeEntry[] = []
        if (src.parserAdapter === 'antara') {
          parsedEntries = parseAntaraRss(fetchRes.xml, src.maxItems || 25)
        } else if (src.parserAdapter === 'turnbackhoax' || src.sourceType === 'fact_check') {
          parsedEntries = parseTurnBackHoaxRss(fetchRes.xml, src.maxItems || 25)
        } else {
          parsedEntries = parseGoogleNewsRss(fetchRes.xml, src.maxItems || 25)
        }

        norm = parsedEntries.map(item =>
          normalizeDebunkEntry(item, src.id, src.sourceType as any, src.displayName, src.domain)
        )
        parsedCount = parsedEntries.length
      }

      updateConnectorHealth(src.id, {
        state: channel === 'API_CORS_PROXY' ? 'DEGRADED' : 'HEALTHY',
        httpStatus: fetchRes.httpStatus,
        latencyMs,
        itemCount: norm.length,
        isSuccess: true,
        userReadableMessage: norm.length > 0
          ? `Berhasil menarik ${norm.length} artikel publikasi`
          : 'Koneksi aktif (0 artikel baru pada jendela pencarian)'
      })

      await saveSourceRunLog({
        id: `run-${src.id}-${Date.now()}`,
        sourceId: src.id,
        runType: 'FIXED_FEED',
        attemptAt: attemptStart,
        completedAt: Date.now(),
        status: 'SUCCESS',
        httpStatus: fetchRes.httpStatus ?? 200,
        latencyMs,
        transportChannel: channel,
        responseBytes,
        parsedCount,
        acceptedCount: norm.length,
        cacheState: 'LIVE',
        nextDueAt: Date.now() + (src.pollIntervalMs || 900000),
        timestamp: Date.now()
      })

      return {
        sourceId: src.id,
        success: true,
        httpStatus: fetchRes.httpStatus ?? 200,
        latencyMs,
        transportChannel: channel,
        responseBytes,
        parsedCount,
        acceptedCount: norm.length,
        cacheState: 'LIVE',
        publications: norm,
        trendSignals: []
      }
    }
  } else {
    // Failure
    const statusSuffix = fetchRes.httpStatus ? ` (HTTP ${fetchRes.httpStatus})` : ''
    const isRateLimited = fetchRes.rateLimitStatus?.isRateLimited || fetchRes.httpStatus === 429
    const isDegraded = fetchRes.errorCode === 'MALFORMED_FEED_NO_ITEMS'

    updateConnectorHealth(src.id, {
      state: isRateLimited ? 'RATE_LIMITED' : (isDegraded ? 'DEGRADED' : 'UNAVAILABLE'),
      httpStatus: fetchRes.httpStatus ?? null,
      latencyMs: fetchRes.latencyMs ?? null,
      rateLimitStatus: fetchRes.rateLimitStatus,
      errorCode: fetchRes.errorCode ?? 'FETCH_TIMEOUT_OR_NETWORK_ERROR',
      errorMessage: fetchRes.errorMessage ?? `Gagal terhubung ke feed ${src.displayName}`,
      userReadableMessage: isRateLimited
        ? 'Laju permintaan terlampaui (HTTP 429). Menunggu jeda reset.'
        : `${fetchRes.errorMessage || `Gagal terhubung ke feed ${src.displayName}`}${statusSuffix}`,
      isSuccess: false
    })

    await saveSourceRunLog({
      id: `run-${src.id}-${Date.now()}`,
      sourceId: src.id,
      runType: 'FIXED_FEED',
      attemptAt: attemptStart,
      completedAt: Date.now(),
      status: isRateLimited ? 'RATE_LIMITED' : 'FAILED',
      httpStatus: fetchRes.httpStatus ?? null,
      latencyMs,
      transportChannel: 'NONE',
      parsedCount: 0,
      acceptedCount: 0,
      errorCode: fetchRes.errorCode ?? null,
      errorMessage: fetchRes.errorMessage ?? null,
      retryAfterSec: fetchRes.rateLimitStatus?.retryAfterSeconds ?? null,
      nextDueAt: Date.now() + 60000,
      timestamp: Date.now()
    })

    return {
      sourceId: src.id,
      success: false,
      httpStatus: fetchRes.httpStatus ?? null,
      latencyMs,
      transportChannel: 'NONE',
      parsedCount: 0,
      acceptedCount: 0,
      errorCode: fetchRes.errorCode ?? 'FETCH_TIMEOUT_OR_NETWORK_ERROR',
      errorMessage: fetchRes.errorMessage ?? 'Gagal fetch feed',
      retryAfterSec: fetchRes.rateLimitStatus?.retryAfterSeconds,
      publications: [],
      trendSignals: []
    }
  }
}

/**
 * Eksekusi Pencarian Dinamis Google News / GDELT (Sprint 6.1 WP2 & Sprint 6.2 WP4)
 */
export async function executeDynamicSearchQuery(
  candidate: TopicCandidate,
  customFetch?: typeof fetch,
  targetEngine: 'gnews' | 'gdelt' = 'gnews'
): Promise<SingleSourceFetchResult> {
  const fetchStart = Date.now()
  const fetchFn = customFetch || (typeof fetch !== 'undefined' ? fetch : null)
  const isGdelt = targetEngine === 'gdelt'
  const profileId = isGdelt
    ? mapDomainToGdeltProfile(candidate.matchedDomain)
    : mapDomainToGoogleNewsProfile(candidate.matchedDomain)

  if (!profileId) {
    topicDiscoveryEngine.recordSearchExecution(candidate.id, 'CANCELLED')
    return {
      sourceId: 'dynamic-search',
      success: false,
      httpStatus: 400,
      latencyMs: 0,
      transportChannel: 'NONE',
      parsedCount: 0,
      acceptedCount: 0,
      errorCode: 'NO_PROFILE_MAPPED',
      errorMessage: `Tidak ada profil ${isGdelt ? 'GDELT' : 'Google News'} yang dipetakan untuk domain ${candidate.matchedDomain}`,
      publications: [],
      trendSignals: [],
      isDynamicSearch: true,
      candidateId: candidate.id,
      dynamicTopic: candidate.phrase
    }
  }

  const isFileProto = typeof window !== 'undefined' && window.location.protocol === 'file:'
  const gatewayBase = isFileProto ? 'http://127.0.0.1:5174' : ''
  const searchUrl = `${gatewayBase}/api/radar/search/${profileId}?topic=${encodeURIComponent(candidate.phrase)}`
  const acceptHdr = isGdelt ? 'application/json, text/plain, */*' : 'application/rss+xml, application/xml, text/xml, */*'

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)

    const res = await (fetchFn as any)(searchUrl, {
      signal: controller.signal,
      headers: { 'Accept': acceptHdr }
    })
    clearTimeout(timer)

    const latencyMs = Date.now() - fetchStart

    if (res.status === 429) {
      const retrySec = parseInt(res.headers?.get ? (res.headers.get('Retry-After') || '3600') : '3600', 10)
      topicDiscoveryEngine.recordSearchExecution(candidate.id, 'RATE_LIMITED')
      await saveSourceRunLog({
        id: `run-search-${candidate.id}-${Date.now()}`,
        sourceId: profileId,
        runType: 'DYNAMIC_SEARCH',
        attemptAt: fetchStart,
        completedAt: Date.now(),
        status: 'RATE_LIMITED',
        httpStatus: 429,
        latencyMs,
        transportChannel: 'API_PROXY',
        parsedCount: 0,
        acceptedCount: 0,
        retryAfterSec: retrySec,
        nextDueAt: Date.now() + retrySec * 1000,
        timestamp: Date.now(),
        dynamicCandidateId: candidate.id,
        dynamicTopic: candidate.phrase,
        dynamicProfileId: profileId
      })
      return {
        sourceId: profileId,
        success: false,
        httpStatus: 429,
        latencyMs,
        transportChannel: 'API_PROXY',
        parsedCount: 0,
        acceptedCount: 0,
        retryAfterSec: retrySec,
        errorCode: 'RATE_LIMITED',
        errorMessage: 'Dynamic search rate limited',
        publications: [],
        trendSignals: [],
        isDynamicSearch: true,
        candidateId: candidate.id,
        dynamicTopic: candidate.phrase,
        dynamicProfileId: profileId
      }
    }

    if (!res.ok) {
      topicDiscoveryEngine.recordSearchExecution(candidate.id, 'TRANSPORT_FAILED')
      await saveSourceRunLog({
        id: `run-search-${candidate.id}-${Date.now()}`,
        sourceId: profileId,
        runType: 'DYNAMIC_SEARCH',
        attemptAt: fetchStart,
        completedAt: Date.now(),
        status: 'FAILED',
        httpStatus: res.status,
        latencyMs,
        transportChannel: 'API_PROXY',
        parsedCount: 0,
        acceptedCount: 0,
        nextDueAt: Date.now() + 900000,
        timestamp: Date.now(),
        dynamicCandidateId: candidate.id,
        dynamicTopic: candidate.phrase,
        dynamicProfileId: profileId
      })
      return {
        sourceId: profileId,
        success: false,
        httpStatus: res.status,
        latencyMs,
        transportChannel: 'API_PROXY',
        parsedCount: 0,
        acceptedCount: 0,
        errorCode: `HTTP_${res.status}`,
        errorMessage: `Dynamic search HTTP status ${res.status}`,
        publications: [],
        trendSignals: [],
        isDynamicSearch: true,
        candidateId: candidate.id,
        dynamicTopic: candidate.phrase,
        dynamicProfileId: profileId
      }
    }

    const text = await res.text()

    if (isGdelt) {
      const gdeltRes = parseGdeltDocResponse(text, {
        sourceId: profileId,
        sourceName: `GDELT Project · Dynamic (${profileId})`,
        domainHint: candidate.matchedDomain,
        candidateId: candidate.id
      })

      if (gdeltRes.isMalformed) {
        topicDiscoveryEngine.recordSearchExecution(candidate.id, 'INVALID_RESPONSE')
        return {
          sourceId: profileId,
          success: false,
          httpStatus: 200,
          latencyMs,
          transportChannel: 'API_PROXY',
          parsedCount: 0,
          acceptedCount: 0,
          errorCode: gdeltRes.errorCode || 'MALFORMED_GDELT_RESPONSE',
          errorMessage: gdeltRes.errorMessage || 'Format respons GDELT tidak valid',
          publications: [],
          trendSignals: [],
          isDynamicSearch: true,
          candidateId: candidate.id,
          dynamicTopic: candidate.phrase,
          dynamicProfileId: profileId
        }
      }

      if (gdeltRes.validArticlesCount === 0) {
        topicDiscoveryEngine.recordSearchExecution(candidate.id, 'VALID_EMPTY')
        await saveSourceRunLog({
          id: `run-search-${candidate.id}-${Date.now()}`,
          sourceId: profileId,
          runType: 'DYNAMIC_SEARCH',
          attemptAt: fetchStart,
          completedAt: Date.now(),
          status: 'SUCCESS',
          httpStatus: 200,
          latencyMs,
          transportChannel: 'API_PROXY',
          parsedCount: 0,
          acceptedCount: 0,
          nextDueAt: Date.now() + 1800000,
          timestamp: Date.now(),
          dynamicCandidateId: candidate.id,
          dynamicTopic: candidate.phrase,
          dynamicProfileId: profileId
        })
        return {
          sourceId: profileId,
          success: true,
          httpStatus: 200,
          latencyMs,
          transportChannel: 'API_PROXY',
          parsedCount: 0,
          acceptedCount: 0,
          publications: [],
          trendSignals: [],
          isDynamicSearch: true,
          candidateId: candidate.id,
          dynamicTopic: candidate.phrase,
          dynamicProfileId: profileId
        }
      }

      const runId = `ds-run-gdelt-${Date.now()}`
      const norm = gdeltRes.publications.map(pub => {
        pub.dynamicSearchRunId = runId
        pub.candidateId = candidate.id
        pub.normalizedTopic = candidate.normalizedPhrase
        pub.profileId = profileId
        return pub
      })

      topicDiscoveryEngine.recordSearchExecution(candidate.id, 'SUCCESS')
      await saveSourceRunLog({
        id: `run-search-${candidate.id}-${Date.now()}`,
        sourceId: profileId,
        runType: 'DYNAMIC_SEARCH',
        attemptAt: fetchStart,
        completedAt: Date.now(),
        status: 'SUCCESS',
        httpStatus: 200,
        latencyMs,
        transportChannel: 'API_PROXY',
        parsedCount: gdeltRes.totalArticlesFound,
        acceptedCount: norm.length,
        nextDueAt: Date.now() + 1800000,
        timestamp: Date.now(),
        dynamicCandidateId: candidate.id,
        dynamicTopic: candidate.phrase,
        dynamicProfileId: profileId
      })

      return {
        sourceId: profileId,
        success: true,
        httpStatus: 200,
        latencyMs,
        transportChannel: 'API_PROXY',
        parsedCount: gdeltRes.totalArticlesFound,
        acceptedCount: norm.length,
        publications: norm,
        trendSignals: [],
        isDynamicSearch: true,
        candidateId: candidate.id,
        dynamicTopic: candidate.phrase,
        dynamicProfileId: profileId
      }
    }

    if (!text.includes('<item>')) {
      // Valid empty feed
      topicDiscoveryEngine.recordSearchExecution(candidate.id, 'VALID_EMPTY')
      await saveSourceRunLog({
        id: `run-search-${candidate.id}-${Date.now()}`,
        sourceId: profileId,
        runType: 'DYNAMIC_SEARCH',
        attemptAt: fetchStart,
        completedAt: Date.now(),
        status: 'SUCCESS',
        httpStatus: 200,
        latencyMs,
        transportChannel: 'API_PROXY',
        parsedCount: 0,
        acceptedCount: 0,
        nextDueAt: Date.now() + 1800000,
        timestamp: Date.now(),
        dynamicCandidateId: candidate.id,
        dynamicTopic: candidate.phrase,
        dynamicProfileId: profileId
      })
      return {
        sourceId: profileId,
        success: true,
        httpStatus: 200,
        latencyMs,
        transportChannel: 'API_PROXY',
        parsedCount: 0,
        acceptedCount: 0,
        publications: [],
        trendSignals: [],
        isDynamicSearch: true,
        candidateId: candidate.id,
        dynamicTopic: candidate.phrase,
        dynamicProfileId: profileId
      }
    }

    const parsedEntries = parseGoogleNewsRss(text, 25)
    const runId = `ds-run-${Date.now()}`
    const norm = parsedEntries.map(entry => {
      const pub = normalizeDebunkEntry(entry, profileId, 'rss', 'Google News RSS (Dynamic Search)', candidate.matchedDomain)
      pub.dynamicSearchRunId = runId
      pub.candidateId = candidate.id
      pub.normalizedTopic = candidate.normalizedPhrase
      pub.profileId = profileId
      return pub
    })

    topicDiscoveryEngine.recordSearchExecution(candidate.id, 'SUCCESS')

    await saveSourceRunLog({
      id: `run-search-${candidate.id}-${Date.now()}`,
      sourceId: profileId,
      runType: 'DYNAMIC_SEARCH',
      attemptAt: fetchStart,
      completedAt: Date.now(),
      status: 'SUCCESS',
      httpStatus: 200,
      latencyMs,
      transportChannel: 'API_PROXY',
      parsedCount: parsedEntries.length,
      acceptedCount: norm.length,
      nextDueAt: Date.now() + 1800000,
      timestamp: Date.now(),
      dynamicCandidateId: candidate.id,
      dynamicTopic: candidate.phrase,
      dynamicProfileId: profileId
    })

    return {
      sourceId: profileId,
      success: true,
      httpStatus: 200,
      latencyMs,
      transportChannel: 'API_PROXY',
      parsedCount: parsedEntries.length,
      acceptedCount: norm.length,
      publications: norm,
      trendSignals: [],
      isDynamicSearch: true,
      candidateId: candidate.id,
      dynamicTopic: candidate.phrase,
      dynamicProfileId: profileId
    }
  } catch (err: any) {
    const latencyMs = Date.now() - fetchStart
    topicDiscoveryEngine.recordSearchExecution(candidate.id, 'TRANSPORT_FAILED')
    await saveSourceRunLog({
      id: `run-search-${candidate.id}-${Date.now()}`,
      sourceId: profileId,
      runType: 'DYNAMIC_SEARCH',
      attemptAt: fetchStart,
      completedAt: Date.now(),
      status: 'FAILED',
      httpStatus: null,
      latencyMs,
      transportChannel: 'API_PROXY',
      parsedCount: 0,
      acceptedCount: 0,
      errorCode: err?.name === 'AbortError' ? 'FETCH_TIMEOUT' : 'NETWORK_ERROR',
      errorMessage: err?.message || 'Dynamic search transport failure',
      nextDueAt: Date.now() + 900000,
      timestamp: Date.now(),
      dynamicCandidateId: candidate.id,
      dynamicTopic: candidate.phrase,
      dynamicProfileId: profileId
    })
    return {
      sourceId: profileId,
      success: false,
      httpStatus: null,
      latencyMs,
      transportChannel: 'API_PROXY',
      parsedCount: 0,
      acceptedCount: 0,
      errorCode: err?.name === 'AbortError' ? 'FETCH_TIMEOUT' : 'NETWORK_ERROR',
      errorMessage: err?.message || 'Dynamic search transport failure',
      publications: [],
      trendSignals: [],
      isDynamicSearch: true,
      candidateId: candidate.id,
      dynamicTopic: candidate.phrase,
      dynamicProfileId: profileId
    }
  }
}

/**
 * Eksekusi Pencarian Dinamis GDELT DOC API (Sprint 6.2 WP4 / S62-04)
 */
export async function executeGdeltDynamicSearchQuery(
  candidate: TopicCandidate,
  customFetch?: typeof fetch
): Promise<SingleSourceFetchResult> {
  return executeDynamicSearchQuery(candidate, customFetch, 'gdelt')
}

/**
 * Pemrosesan Ingesti Kanonikal Terpadu (WP1, WP2, WP4, WP7)
 */
export async function processRadarIngestion(
  incomingPubs: NormalizedPublication[],
  incomingTrends: SearchTrendSignal[],
  now = Date.now()
): Promise<LiveRadarFetchResult> {
  const startTime = Date.now()

  // 1. Pertahankan firstObservedAt yang stabil (WP4 / S61-20)
  for (const pub of incomingPubs) {
    if (!pub || !pub.title || typeof pub.title !== 'string' || !pub.title.trim()) continue
    const persistedFirstObserved = knownFirstObservedTimes.get(pub.id)
    const existing = knownPublicationsMap.get(pub.id)
    if (persistedFirstObserved) {
      pub.firstObservedAt = persistedFirstObserved
      pub.observedAt = now
    } else if (existing) {
      pub.firstObservedAt = existing.firstObservedAt || existing.observedAt
      pub.observedAt = now
    } else {
      pub.firstObservedAt = pub.firstObservedAt || now
      pub.observedAt = now
      saveIssueActivitySnapshot({
        id: `pub-${pub.id}`,
        clusterId: pub.id,
        firstObservedAt: pub.firstObservedAt,
        timestamp: pub.firstObservedAt
      }).catch(() => {})
    }
    // Pastikan registry memuat objek publikasi terbaru lengkap dengan judul dan tanggal
    knownPublicationsMap.set(pub.id, pub)
  }

  const allPubs = Array.from(knownPublicationsMap.values())

  // 2. Deduplikasi publikasi
  const dedupedItems = deduplicatePublications(allPubs)

  // 3. Pengelompokan peristiwa (Event Clustering)
  const baseClusters = clusterEventPublications(dedupedItems)

  // 4. Hubungkan sinyal tren pencarian Google
  const clustersWithTrends = attachTrendSignalsToClusters(baseClusters, incomingTrends)

  // 5. Evaluasi Momentum & Issue Activity (WP4)
  const clusters = attachIssueActivityToClusters(clustersWithTrends, now)

  // 6. Simpan Issue Activity Snapshot secara persisten ke IndexedDB (WP4 / S61-24)
  for (const cl of clusters) {
    if (cl.activityAssessment) {
      try {
        const snap = createIssueActivitySnapshot(cl, cl.activityAssessment, now)
        await saveIssueActivitySnapshot(snap)
      } catch (e) {
        console.warn('[LiveRadarService] Gagal menyimpan activity snapshot:', e)
      }
    }
  }

  // 7. Ingest ke Topic Discovery Engine (WP3)
  topicDiscoveryEngine.ingestTrendSignals(incomingTrends)
  topicDiscoveryEngine.ingestPublications(incomingPubs)
  topicDiscoveryEngine.pruneExpiredCandidates()
  try {
    await saveTopicCandidates(topicDiscoveryEngine.getAllCandidates())
  } catch (e) {
    console.warn('[LiveRadarService] Gagal menyimpan topic candidates:', e)
  }

  // 8. Konversi clusters ke DebunkKnowledgeEntry untuk kompatibilitas UI
  const mappedEntries = clusters.map(cl => clusterToDebunkEntry(cl))

  // 9. Jalankan Scorer & Triage (Evidence-Driven)
  const curatedArchive = getCuratedArchiveDebunks()
  const liveTbh = allPubs.filter(p => p.sourceId === 'src-tbh')
  const allKnownDebunks = [...liveTbh.map(p => ({
    id: p.id,
    claim: p.title,
    verdict: p.verdict,
    clarification: p.excerpt,
    officialSource: p.publisher,
    sourceUrl: p.canonicalUrl,
    publishedDate: p.publishedAtFormatted,
    cluster: p.category
  } as DebunkKnowledgeEntry)), ...curatedArchive]

  const triagedEntries = scoreAndTriageRadarEntries(mappedEntries, allKnownDebunks)

  // SPRINT 13: Urutkan secara deterministik berdasarkan tanggal publikasi terbaru (descending)
  // Menjamin isu teraktual dan breaking hari ini (08 Nov 2026) selalu berada di urutan teratas
  const sortedEntries = sortRadarEntries(triagedEntries)

  // 10. Daftarkan ke in-memory cache dan simpan ke IndexedDB
  registerLiveDebunks(sortedEntries)
  try {
    await cacheRadarItems(sortedEntries)
  } catch (e) {
    console.warn('[LiveRadarService] Gagal menyimpan ke cache IndexedDB:', e)
  }

  const result: LiveRadarFetchResult = {
    entries: sortedEntries,
    clusters,
    trendSignals: incomingTrends,
    topicCandidates: topicDiscoveryEngine.getAllCandidates(),
    connectorHealth: getAllConnectorHealth(),
    isLive: true,
    isStale: false,
    cacheState: 'LIVE',
    sourceChannel: 'API_PROXY',
    latencyMs: Date.now() - startTime,
    fetchedAt: now
  }

  lastRadarResult = result
  return result
}

let lastRadarResult: LiveRadarFetchResult | null = null

export function getLastRadarResult(): LiveRadarFetchResult | null {
  return lastRadarResult
}

/**
 * Multi-Channel Live Ingestion Engine (Kompatibilitas Backward)
 */
export async function fetchLiveRadarDebunks(options?: { customFetch?: typeof fetch }): Promise<LiveRadarFetchResult> {
  const startTime = Date.now()
  const enabledSources = ACTIVE_RADAR_SOURCES.filter(s => s.enabled)

  const fetchPromises = enabledSources.map(src =>
    fetchSingleRadarSource(src.id, options?.customFetch)
  )
  const settled = await Promise.allSettled(fetchPromises)

  const incomingPubs: NormalizedPublication[] = []
  const incomingTrends: SearchTrendSignal[] = []

  settled.forEach(item => {
    if (item.status === 'fulfilled' && item.value.success) {
      if (item.value.publications) incomingPubs.push(...item.value.publications)
      if (item.value.trendSignals) incomingTrends.push(...item.value.trendSignals)
    }
  })

  if (incomingPubs.length > 0 || incomingTrends.length > 0) {
    return processRadarIngestion(incomingPubs, incomingTrends)
  }

  // Jika gagal total / offline, baca dari IndexedDB cache lokal
  try {
    const cached = await getCachedRadarItems()
    if (cached && cached.length > 0) {
      const cachedResult: LiveRadarFetchResult = {
        entries: cached,
        connectorHealth: getAllConnectorHealth(),
        isLive: false,
        isStale: true,
        cacheState: 'STALE_CACHE',
        sourceChannel: 'LOCAL_ARCHIVE',
        latencyMs: Date.now() - startTime,
        fetchedAt: Date.now(),
        topicCandidates: topicDiscoveryEngine.getAllCandidates(),
        errorMessage: 'Koneksi jaringan terputus. Menampilkan data cache lokal tersimpan (STALE_CACHE).'
      }
      lastRadarResult = cachedResult
      return cachedResult
    }
  } catch {
    // Lewati jika indexedDB gagal
  }

  // Fallback Terakhir: Basis Pengetahuan Kurasi Lokal
  const localArchive = getCuratedArchiveDebunks()
  const fallbackResult: LiveRadarFetchResult = {
    entries: localArchive,
    connectorHealth: getAllConnectorHealth(),
    isLive: false,
    isStale: true,
    cacheState: 'STALE_CACHE',
    sourceChannel: 'LOCAL_ARCHIVE',
    latencyMs: Date.now() - startTime,
    fetchedAt: Date.now(),
    errorMessage: 'Koneksi live feed tidak dapat dijangkau. Beralih ke pangkalan data taktis offline (STALE_CACHE).'
  }
  lastRadarResult = fallbackResult
  return fallbackResult
}
