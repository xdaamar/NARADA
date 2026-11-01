import type { DebunkKnowledgeEntry } from '../../types.ts'
import { registerLiveDebunks, getCuratedArchiveDebunks } from './debunk-service.ts'
import { 
  cleanHtmlText, 
  parseTurnBackHoaxRss, 
  parseGoogleNewsRss, 
  parseAntaraRss,
  parseGoogleTrendsRssAsSignals
} from '../ingest/rss-parser.ts'
import { cacheRadarItems, getCachedRadarItems, saveTopicCandidates } from '../../utils/db-adapter.ts'
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
import { attachIssueActivityToClusters } from '../radar/issue-activity-engine.ts'
import { topicDiscoveryEngine } from '../radar/topic-discovery-engine.ts'
import { radarScheduler } from '../scheduler/radar-scheduler.ts'
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
  timeoutMs = 6000
): Promise<FetchXmlResult> {
  const fetchStart = Date.now()
  let lastHttpStatus: number | null = null
  let lastErrorCode: string | null = null
  let lastErrorMessage: string | null = null
  let lastRateLimit: { isRateLimited: boolean; retryAfterSeconds?: number; resetAt?: number } | null = null

  // Lapis 1: Coba Same-Origin Production Gateway Route (atau local loopback jika Electron file://)
  const isFileProto = typeof window !== 'undefined' && window.location.protocol === 'file:'
  const gatewayBase = isFileProto ? 'http://127.0.0.1:5174' : ''
  const gatewayUrl = `${gatewayBase}/api/radar/feed/${sourceId}`
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(gatewayUrl, {
      signal: controller.signal,
      headers: { 'Accept': 'application/rss+xml, application/xml, text/xml, */*' }
    })
    clearTimeout(timer)
    lastHttpStatus = res.status

    if (res.status === 429) {
      const retrySec = parseInt(res.headers.get('Retry-After') || '60', 10)
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
      if (text.includes('<item>') || text.includes('<entry>') || text.includes('<channel>')) {
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
      const res = await fetch(proxyUrl, {
        signal: controller.signal,
        headers: { 'Accept': 'application/rss+xml, application/xml, text/xml, */*' }
      })
      clearTimeout(timer)
      lastHttpStatus = res.status

      if (res.status === 429) {
        const retrySec = parseInt(res.headers.get('Retry-After') || '60', 10)
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
        if (text.includes('<item>') || text.includes('<entry>') || text.includes('<channel>')) {
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
      const res = await fetch(directUrl, {
        signal: controller.signal,
        headers: { 
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NARADA-Defense/1.0'
        }
      })
      clearTimeout(timer)
      lastHttpStatus = res.status

      if (res.status === 429) {
        const retrySec = parseInt(res.headers.get('Retry-After') || '60', 10)
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
        if (text.includes('<item>') || text.includes('<entry>') || text.includes('<channel>')) {
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
  const lead = cluster.leadItem
  const pubCount = cluster.sourceCoverage.publicationCount
  const pubList = cluster.sourceCoverage.publishers

  let viralityReason = lead.verdict === 'HOAKS'
    ? '🚨 LAPORAN MAFINDO: Isu Disinformasi Terverifikasi'
    : cluster.freshness.status === 'BREAKING'
    ? '🔥 BREAKING NEWS LAPANGAN (<3 JAM)'
    : cluster.contextRelevance.matchedTopics[0] || 'PEMBAHASAN PUBLIK HANGAT'

  if (pubCount > 1) {
    viralityReason += ` • Dilaporkan oleh ${pubList.slice(0, 2).join(', ')}${pubList.length > 2 ? ` +${pubList.length - 2}` : ''} (${cluster.sourceCoverage.distinctPublisherDomainCount} domain pers)`
  }

  // Jika terdapat sinyal tren penelusuran Google yang terhubung (Package 1 & 7)
  if (cluster.attachedTrendSignals && cluster.attachedTrendSignals.length > 0) {
    const topTrend = cluster.attachedTrendSignals[0]
    viralityReason += ` • 📊 Tren Google: "${topTrend.query}"${topTrend.searchVolumeBand ? ` (${topTrend.searchVolumeBand})` : ''}`
  }

  return {
    id: cluster.id,
    claim: cluster.title,
    normalizedQuery: cluster.title.toLowerCase(),
    cluster: cluster.category,
    verdict: lead.verdict,
    threatLevel: lead.category === 'KEDAULATAN_MILITER' || lead.verdict === 'HOAKS' ? 'critical' : 'medium',
    clarification: lead.excerpt,
    officialSource: cluster.sourceCoverage.publishers.join(', ') || lead.publisher,
    sourceUrl: lead.canonicalUrl,
    originalSourceUrl: lead.originalUrl,
    originalPlatform: lead.sourceName,
    interceptedAt: formatMilitaryDate(cluster.firstObservedAt),
    verifiedAt: cluster.leadItem.lastVerifiedAt ? formatMilitaryDate(cluster.leadItem.lastVerifiedAt) : undefined,
    publishedDate: cluster.leadItem.publishedAtFormatted,
    isBreakingRecent: cluster.freshness.status === 'BREAKING',
    keywords: lead.topicTags,
    tacticalResponseCivilian: `Informasi terkait "${cluster.title}". ${lead.excerpt}`,
    tacticalResponseMilitary: `Atensi Teritorial: Pantau isu "${cluster.title}". Cakupan: ${pubCount} publikasi terverifikasi.`,
    isLive: true,
    cognitiveScore: cluster.contextRelevance.score,
    viralityReason,
    issueActivity: cluster.issueActivity,
    clusterDomain: cluster.domain || cluster.leadItem?.domain || 'NATIONAL_POLICY',
    attachedTrendSignals: cluster.attachedTrendSignals,
    sourceCoverage: cluster.sourceCoverage
  }
}

/**
 * Multi-Channel Live Ingestion Engine:
 * 1. Feed TurnBackHoax (Klarifikasi Hoaks Terkini dengan Canonical URLs)
 * 2. Feed Google News Hankam (Berita Panas TNI, Papua, Alutsista Real-Time)
 * 3. Feed Google News Demo & Aksi Massa (Unjuk rasa hari ini)
 * 4. Feed Google News Politik & Kebijakan Negara
 * 5. Feed Google Trends ID (Lonjakan Isu Pencarian Publik)
 */
let lastRadarResult: LiveRadarFetchResult | null = null

export function getLastRadarResult(): LiveRadarFetchResult | null {
  return lastRadarResult
}

export async function fetchLiveRadarDebunks(): Promise<LiveRadarFetchResult> {
  const startTime = Date.now()

  try {
    const enabledSources = ACTIVE_RADAR_SOURCES.filter(s => s.enabled)

    // Inisialisasi status konektor ke CONNECTING sebelum fetch dimulai (Section 4.1 & 4.2)
    enabledSources.forEach(src => {
      updateConnectorHealth(src.id, {
        state: 'CONNECTING',
        isSuccess: true,
        userReadableMessage: 'Menghubungkan ke saluran feed...'
      })
    })

    // Eksekusi penarikan seluruh stream secara paralel dengan error isolation (Promise.allSettled)
    const fetchPromises = enabledSources.map(src => 
      fetchXmlWithFallback(src.id, src.feedUrl, src.directUrl, src.fetchTimeoutMs)
    )
    const settledResults = await Promise.allSettled(fetchPromises)

    const normalizedItems: NormalizedPublication[] = []
    const liveTbhEntries: DebunkKnowledgeEntry[] = []
    const trendSignals: SearchTrendSignal[] = []
    let detectedChannel: 'API_PROXY' | 'API_DIRECT' | 'API_CORS_PROXY' = 'API_PROXY'

    settledResults.forEach((settled, idx) => {
      const src = enabledSources[idx]
      if (settled.status === 'fulfilled' && settled.value.success && settled.value.xml) {
        const fetchRes = settled.value
        if (detectedChannel !== 'API_DIRECT' && fetchRes.channel) {
          detectedChannel = fetchRes.channel
        }

        radarScheduler.recordSourceAttempt(src.id, true, fetchRes.httpStatus)

        if (src.sourceType === 'search_trend') {
          // Google Trends SearchTrendSignal
          const signals = parseGoogleTrendsRssAsSignals(fetchRes.xml!, src.maxItems || 20)
          trendSignals.push(...signals)
          updateConnectorHealth(src.id, {
            state: fetchRes.channel === 'API_CORS_PROXY' ? 'DEGRADED' : 'HEALTHY',
            httpStatus: fetchRes.httpStatus,
            latencyMs: fetchRes.latencyMs,
            itemCount: signals.length,
            isSuccess: true,
            userReadableMessage: `Berhasil menarik ${signals.length} sinyal minat penelusuran Google`
          })
        } else {
          // Publikasi pers / Fact-check
          let parsedEntries: DebunkKnowledgeEntry[] = []
          if (src.parserAdapter === 'antara') {
            parsedEntries = parseAntaraRss(fetchRes.xml!, src.maxItems || 25)
          } else if (src.parserAdapter === 'turnbackhoax' || src.sourceType === 'fact_check') {
            parsedEntries = parseTurnBackHoaxRss(fetchRes.xml!, src.maxItems || 25)
            liveTbhEntries.push(...parsedEntries)
          } else {
            parsedEntries = parseGoogleNewsRss(fetchRes.xml!, src.maxItems || 25)
          }

          const norm = parsedEntries.map(item => 
            normalizeDebunkEntry(item, src.id, src.sourceType as any, src.displayName, src.domain)
          )
          normalizedItems.push(...norm)

          updateConnectorHealth(src.id, {
            state: fetchRes.channel === 'API_CORS_PROXY' ? 'DEGRADED' : 'HEALTHY',
            httpStatus: fetchRes.httpStatus,
            latencyMs: fetchRes.latencyMs,
            itemCount: norm.length,
            isSuccess: true,
            userReadableMessage: `Berhasil menarik ${norm.length} artikel publikasi`
          })
        }
      } else {
        const fail = settled.status === 'fulfilled' ? settled.value : null
        const statusSuffix = fail?.httpStatus ? ` (HTTP ${fail.httpStatus})` : ''
        const retrySec = fail?.rateLimitStatus?.retryAfterSeconds
        radarScheduler.recordSourceAttempt(src.id, false, fail?.httpStatus, retrySec)

        updateConnectorHealth(src.id, {
          state: fail?.rateLimitStatus?.isRateLimited ? 'RATE_LIMITED' : (fail?.errorCode === 'MALFORMED_FEED_NO_ITEMS' ? 'DEGRADED' : 'UNAVAILABLE'),
          httpStatus: fail?.httpStatus ?? null,
          latencyMs: fail?.latencyMs ?? null,
          rateLimitStatus: fail?.rateLimitStatus,
          errorCode: fail?.errorCode ?? 'FETCH_TIMEOUT_OR_NETWORK_ERROR',
          errorMessage: fail?.errorMessage ?? `Gagal terhubung ke feed ${src.displayName}`,
          userReadableMessage: `${fail?.errorMessage || `Gagal terhubung ke feed ${src.displayName}`}${statusSuffix}`,
          isSuccess: false
        })
      }
    })

    if (normalizedItems.length > 0) {
      // 1. Deduplikasi & Pengelompokan Peristiwa Konservatif (Hanya publikasi riil)
      const dedupedItems = deduplicatePublications(normalizedItems)
      const baseClusters = clusterEventPublications(dedupedItems)
      
      // 2. Hubungkan SearchTrendSignal sebagai sinyal kontekstual tanpa menaikkan publicationCount
      const clustersWithTrends = attachTrendSignalsToClusters(baseClusters, trendSignals)

      // 3. Evaluasi Momentum & Issue Activity (Sprint 6 WP6)
      const clusters = attachIssueActivityToClusters(clustersWithTrends)

      // 4. Ingest ke Dynamic Topic Discovery Engine (Sprint 6 WP5)
      topicDiscoveryEngine.ingestTrendSignals(trendSignals)
      topicDiscoveryEngine.ingestPublications(dedupedItems)
      topicDiscoveryEngine.pruneExpiredCandidates()
      try {
        await saveTopicCandidates(topicDiscoveryEngine.getAllCandidates())
      } catch (e) {
        console.warn('[LiveRadarService] Gagal menyimpan topic candidates:', e)
      }

      // 5. Konversi cluster ke DebunkKnowledgeEntry untuk UI backward-compatibility
      const mappedEntries = clusters.map(cl => clusterToDebunkEntry(cl))

      // 6. Jalankan Scorer & Triage (Evidence-Driven)
      // Gabungkan live TurnBackHoax references dari siklus saat ini dengan curated archive
      const curatedArchive = getCuratedArchiveDebunks()
      const allKnownDebunks = [...liveTbhEntries, ...curatedArchive]
      const triagedEntries = scoreAndTriageRadarEntries(mappedEntries, allKnownDebunks)

      // 7. Daftarkan ke in-memory cache dan simpan ke IndexedDB
      registerLiveDebunks(triagedEntries)

      try {
        await cacheRadarItems(triagedEntries)
      } catch (e) {
        console.warn('[LiveRadarService] Gagal menyimpan ke cache IndexedDB:', e)
      }

      const liveResult: LiveRadarFetchResult = {
        entries: triagedEntries,
        clusters,
        trendSignals,
        topicCandidates: topicDiscoveryEngine.getAllCandidates(),
        connectorHealth: getAllConnectorHealth(),
        isLive: true,
        isStale: false,
        cacheState: 'LIVE',
        sourceChannel: detectedChannel,
        latencyMs: Date.now() - startTime,
        fetchedAt: Date.now()
      }
      lastRadarResult = liveResult
      return liveResult
    }
  } catch (err) {
    console.error('[LiveRadarService] Kesalahan saat penarikan multi-feed live:', err)
  }

  // Jika gagal total / offline, baca dari IndexedDB cache lokal dan tandai STALE_CACHE secara jujur
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
