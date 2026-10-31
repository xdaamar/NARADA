import type { DebunkKnowledgeEntry } from '../../types.ts'
import { registerLiveDebunks, getCuratedArchiveDebunks } from './debunk-service.ts'
import { 
  cleanHtmlText, 
  parseTurnBackHoaxRss, 
  parseGoogleNewsRss, 
  parseGoogleTrendsRssAsSignals
} from '../ingest/rss-parser.ts'
import { cacheRadarItems, getCachedRadarItems } from '../../utils/db-adapter.ts'
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
import { evaluateContextRelevance, evaluateMetadataTransparency, determineReviewState } from '../radar/radar-assessment.ts'
import type { 
  NormalizedPublication, 
  EventCluster, 
  ConnectorHealth,
  SearchTrendSignal
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
  sourceName: string
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
    viralityReason
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
export async function fetchLiveRadarDebunks(): Promise<LiveRadarFetchResult> {
  const startTime = Date.now()

  try {
    const [tbhDef, hankamDef, demoDef, politikDef, trendsDef] = ACTIVE_RADAR_SOURCES

    // Inisialisasi status konektor ke CONNECTING sebelum fetch dimulai (Section 4.1 & 4.2)
    ACTIVE_RADAR_SOURCES.filter(s => s.enabled).forEach(src => {
      updateConnectorHealth(src.id, {
        state: 'CONNECTING',
        isSuccess: true,
        userReadableMessage: 'Menghubungkan ke saluran feed...'
      })
    })

    // Eksekusi penarikan 5 stream secara paralel dengan error isolation (Promise.allSettled)
    const [tbhResult, newsHankamResult, newsDemoResult, newsPolitikResult, trendsResult] = await Promise.allSettled([
      fetchXmlWithFallback(tbhDef.id, tbhDef.feedUrl, tbhDef.directUrl, tbhDef.fetchTimeoutMs),
      fetchXmlWithFallback(hankamDef.id, hankamDef.feedUrl, hankamDef.directUrl, hankamDef.fetchTimeoutMs),
      fetchXmlWithFallback(demoDef.id, demoDef.feedUrl, demoDef.directUrl, demoDef.fetchTimeoutMs),
      fetchXmlWithFallback(politikDef.id, politikDef.feedUrl, politikDef.directUrl, politikDef.fetchTimeoutMs),
      fetchXmlWithFallback(trendsDef.id, trendsDef.feedUrl, trendsDef.directUrl, trendsDef.fetchTimeoutMs)
    ])

    const normalizedItems: NormalizedPublication[] = []
    const liveTbhEntries: DebunkKnowledgeEntry[] = []
    const trendSignals: SearchTrendSignal[] = []
    let detectedChannel: 'API_PROXY' | 'API_DIRECT' | 'API_CORS_PROXY' = 'API_PROXY'

    // 1. Ingest TurnBackHoax (Fact-Check)
    if (tbhResult.status === 'fulfilled' && tbhResult.value.success && tbhResult.value.xml) {
      const parsed = parseTurnBackHoaxRss(tbhResult.value.xml)
      liveTbhEntries.push(...parsed)
      const norm = parsed.map(item => normalizeDebunkEntry(item, tbhDef.id, 'fact_check', tbhDef.displayName))
      normalizedItems.push(...norm)
      detectedChannel = tbhResult.value.channel || 'API_PROXY'
      updateConnectorHealth(tbhDef.id, {
        state: tbhResult.value.channel === 'API_CORS_PROXY' ? 'DEGRADED' : 'HEALTHY',
        httpStatus: tbhResult.value.httpStatus,
        latencyMs: tbhResult.value.latencyMs,
        itemCount: norm.length,
        isSuccess: true,
        userReadableMessage: `Berhasil menarik ${norm.length} entri klarifikasi fakta`
      })
    } else {
      const fail = tbhResult.status === 'fulfilled' ? tbhResult.value : null
      const statusSuffix = fail?.httpStatus ? ` (HTTP ${fail.httpStatus})` : ''
      updateConnectorHealth(tbhDef.id, {
        state: fail?.rateLimitStatus?.isRateLimited ? 'RATE_LIMITED' : (fail?.errorCode === 'MALFORMED_FEED_NO_ITEMS' ? 'DEGRADED' : 'UNAVAILABLE'),
        httpStatus: fail?.httpStatus ?? null,
        latencyMs: fail?.latencyMs ?? null,
        rateLimitStatus: fail?.rateLimitStatus,
        errorCode: fail?.errorCode ?? 'FETCH_TIMEOUT_OR_NETWORK_ERROR',
        errorMessage: fail?.errorMessage ?? 'Gagal terhubung ke feed TurnBackHoax',
        userReadableMessage: `${fail?.errorMessage || 'Gagal terhubung ke feed TurnBackHoax'}${statusSuffix}`,
        isSuccess: false
      })
    }

    // 2. Ingest Google News Hankam
    if (newsHankamResult.status === 'fulfilled' && newsHankamResult.value.success && newsHankamResult.value.xml) {
      const parsed = parseGoogleNewsRss(newsHankamResult.value.xml).slice(0, 10)
      const norm = parsed.map(item => normalizeDebunkEntry(item, hankamDef.id, 'rss', hankamDef.displayName))
      normalizedItems.push(...norm)
      if (detectedChannel !== 'API_DIRECT' && newsHankamResult.value.channel) detectedChannel = newsHankamResult.value.channel
      updateConnectorHealth(hankamDef.id, {
        state: newsHankamResult.value.channel === 'API_CORS_PROXY' ? 'DEGRADED' : 'HEALTHY',
        httpStatus: newsHankamResult.value.httpStatus,
        latencyMs: newsHankamResult.value.latencyMs,
        itemCount: norm.length,
        isSuccess: true,
        userReadableMessage: `Berhasil menarik ${norm.length} berita hankam & kedaulatan`
      })
    } else {
      const fail = newsHankamResult.status === 'fulfilled' ? newsHankamResult.value : null
      updateConnectorHealth(hankamDef.id, {
        state: fail?.rateLimitStatus?.isRateLimited ? 'RATE_LIMITED' : (fail?.errorCode === 'MALFORMED_FEED_NO_ITEMS' ? 'DEGRADED' : 'UNAVAILABLE'),
        httpStatus: fail?.httpStatus ?? null,
        latencyMs: fail?.latencyMs ?? null,
        rateLimitStatus: fail?.rateLimitStatus,
        errorCode: fail?.errorCode ?? 'FETCH_TIMEOUT_OR_NETWORK_ERROR',
        errorMessage: fail?.errorMessage ?? 'Gagal terhubung ke feed Google News Hankam',
        userReadableMessage: fail?.errorMessage ?? 'Gagal terhubung ke feed Google News Hankam',
        isSuccess: false
      })
    }

    // 3. Ingest Google News Aksi Massa & Demo
    if (newsDemoResult.status === 'fulfilled' && newsDemoResult.value.success && newsDemoResult.value.xml) {
      const parsed = parseGoogleNewsRss(newsDemoResult.value.xml).slice(0, 8)
      const norm = parsed.map(item => normalizeDebunkEntry(item, demoDef.id, 'rss', demoDef.displayName))
      normalizedItems.push(...norm)
      if (detectedChannel !== 'API_DIRECT' && newsDemoResult.value.channel) detectedChannel = newsDemoResult.value.channel
      updateConnectorHealth(demoDef.id, {
        state: newsDemoResult.value.channel === 'API_CORS_PROXY' ? 'DEGRADED' : 'HEALTHY',
        httpStatus: newsDemoResult.value.httpStatus,
        latencyMs: newsDemoResult.value.latencyMs,
        itemCount: norm.length,
        isSuccess: true,
        userReadableMessage: `Berhasil menarik ${norm.length} pantauan aksi massa/demo`
      })
    } else {
      const fail = newsDemoResult.status === 'fulfilled' ? newsDemoResult.value : null
      updateConnectorHealth(demoDef.id, {
        state: fail?.rateLimitStatus?.isRateLimited ? 'RATE_LIMITED' : (fail?.errorCode === 'MALFORMED_FEED_NO_ITEMS' ? 'DEGRADED' : 'UNAVAILABLE'),
        httpStatus: fail?.httpStatus ?? null,
        latencyMs: fail?.latencyMs ?? null,
        rateLimitStatus: fail?.rateLimitStatus,
        errorCode: fail?.errorCode ?? 'FETCH_TIMEOUT_OR_NETWORK_ERROR',
        errorMessage: fail?.errorMessage ?? 'Gagal terhubung ke feed Google News Demo',
        userReadableMessage: fail?.errorMessage ?? 'Gagal terhubung ke feed Google News Demo',
        isSuccess: false
      })
    }

    // 4. Ingest Google News Dinamika Politik
    if (newsPolitikResult.status === 'fulfilled' && newsPolitikResult.value.success && newsPolitikResult.value.xml) {
      const parsed = parseGoogleNewsRss(newsPolitikResult.value.xml).slice(0, 8)
      const norm = parsed.map(item => normalizeDebunkEntry(item, politikDef.id, 'rss', politikDef.displayName))
      normalizedItems.push(...norm)
      if (detectedChannel !== 'API_DIRECT' && newsPolitikResult.value.channel) detectedChannel = newsPolitikResult.value.channel
      updateConnectorHealth(politikDef.id, {
        state: newsPolitikResult.value.channel === 'API_CORS_PROXY' ? 'DEGRADED' : 'HEALTHY',
        httpStatus: newsPolitikResult.value.httpStatus,
        latencyMs: newsPolitikResult.value.latencyMs,
        itemCount: norm.length,
        isSuccess: true,
        userReadableMessage: `Berhasil menarik ${norm.length} berita kebijakan negara`
      })
    } else {
      const fail = newsPolitikResult.status === 'fulfilled' ? newsPolitikResult.value : null
      updateConnectorHealth(politikDef.id, {
        state: fail?.rateLimitStatus?.isRateLimited ? 'RATE_LIMITED' : (fail?.errorCode === 'MALFORMED_FEED_NO_ITEMS' ? 'DEGRADED' : 'UNAVAILABLE'),
        httpStatus: fail?.httpStatus ?? null,
        latencyMs: fail?.latencyMs ?? null,
        rateLimitStatus: fail?.rateLimitStatus,
        errorCode: fail?.errorCode ?? 'FETCH_TIMEOUT_OR_NETWORK_ERROR',
        errorMessage: fail?.errorMessage ?? 'Gagal terhubung ke feed Google News Politik',
        userReadableMessage: fail?.errorMessage ?? 'Gagal terhubung ke feed Google News Politik',
        isSuccess: false
      })
    }

    // 5. Ingest Google Trends ID (SearchTrendSignal — TIDAK dicampur ke NormalizedPublication!)
    if (trendsResult.status === 'fulfilled' && trendsResult.value.success && trendsResult.value.xml) {
      const signals = parseGoogleTrendsRssAsSignals(trendsResult.value.xml).slice(0, 10)
      trendSignals.push(...signals)
      updateConnectorHealth(trendsDef.id, {
        state: trendsResult.value.channel === 'API_CORS_PROXY' ? 'DEGRADED' : 'HEALTHY',
        httpStatus: trendsResult.value.httpStatus,
        latencyMs: trendsResult.value.latencyMs,
        itemCount: signals.length,
        isSuccess: true,
        userReadableMessage: `Berhasil menarik ${signals.length} sinyal minat penelusuran Google`
      })
    } else {
      const fail = trendsResult.status === 'fulfilled' ? trendsResult.value : null
      updateConnectorHealth(trendsDef.id, {
        state: fail?.rateLimitStatus?.isRateLimited ? 'RATE_LIMITED' : (fail?.errorCode === 'MALFORMED_FEED_NO_ITEMS' ? 'DEGRADED' : 'UNAVAILABLE'),
        httpStatus: fail?.httpStatus ?? null,
        latencyMs: fail?.latencyMs ?? null,
        rateLimitStatus: fail?.rateLimitStatus,
        errorCode: fail?.errorCode ?? 'FETCH_TIMEOUT_OR_NETWORK_ERROR',
        errorMessage: fail?.errorMessage ?? 'Gagal terhubung ke feed Google Trends Indonesia',
        userReadableMessage: fail?.errorMessage ?? 'Gagal terhubung ke feed Google Trends Indonesia',
        isSuccess: false
      })
    }

    if (normalizedItems.length > 0) {
      // 1. Deduplikasi & Pengelompokan Peristiwa Konservatif (Hanya publikasi riil)
      const dedupedItems = deduplicatePublications(normalizedItems)
      const baseClusters = clusterEventPublications(dedupedItems)
      
      // 2. Hubungkan SearchTrendSignal sebagai sinyal kontekstual tanpa menaikkan publicationCount
      const clusters = attachTrendSignalsToClusters(baseClusters, trendSignals)

      // 3. Konversi cluster ke DebunkKnowledgeEntry untuk UI backward-compatibility
      const mappedEntries = clusters.map(cl => clusterToDebunkEntry(cl))

      // 4. Jalankan Scorer & Triage (Evidence-Driven)
      // SPRINT 5 (WP4): Gabungkan live TurnBackHoax references dari siklus saat ini dengan curated archive
      const curatedArchive = getCuratedArchiveDebunks()
      const allKnownDebunks = [...liveTbhEntries, ...curatedArchive]
      const triagedEntries = scoreAndTriageRadarEntries(mappedEntries, allKnownDebunks)

      // 5. Daftarkan ke in-memory cache dan simpan ke IndexedDB
      registerLiveDebunks(triagedEntries)

      try {
        await cacheRadarItems(triagedEntries)
      } catch (e) {
        console.warn('[LiveRadarService] Gagal menyimpan ke cache IndexedDB:', e)
      }

      return {
        entries: triagedEntries,
        clusters,
        trendSignals,
        connectorHealth: getAllConnectorHealth(),
        isLive: true,
        isStale: false,
        cacheState: 'LIVE',
        sourceChannel: detectedChannel,
        latencyMs: Date.now() - startTime,
        fetchedAt: Date.now()
      }
    }
  } catch (err) {
    console.error('[LiveRadarService] Kesalahan saat penarikan multi-feed live:', err)
  }

  // Jika gagal total / offline, baca dari IndexedDB cache lokal dan tandai STALE_CACHE secara jujur
  try {
    const cached = await getCachedRadarItems()
    if (cached && cached.length > 0) {
      return {
        entries: cached,
        connectorHealth: getAllConnectorHealth(),
        isLive: false,
        isStale: true,
        cacheState: 'STALE_CACHE',
        sourceChannel: 'LOCAL_ARCHIVE',
        latencyMs: Date.now() - startTime,
        fetchedAt: Date.now(),
        errorMessage: 'Koneksi jaringan terputus. Menampilkan data cache lokal tersimpan (STALE_CACHE).'
      }
    }
  } catch {
    // Lewati jika indexedDB gagal
  }

  // Fallback Terakhir: Basis Pengetahuan Kurasi Lokal
  const localArchive = getCuratedArchiveDebunks()
  return {
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
}
