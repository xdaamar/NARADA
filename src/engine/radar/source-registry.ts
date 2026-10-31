/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — SOURCE REGISTRY & CONNECTOR HEALTH MONITOR
 * SPRINT 1: CENTRALIZED CONFIGURATION & PROVENANCE TRACKING
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Prinsip Desain:
 * - Seluruh URL, endpoint, atribusi, dan kategori sumber dikonfigurasi di satu tempat.
 * - Tidak ada connector rahasia atau scraper liar (Zero Telegram, Zero Scraper Medsos).
 * - Connector Health mencatat status aktual per sumber secara transparan.
 * ══════════════════════════════════════════════════════════════════════════
 */

import type { 
  SourceDefinition, 
  ConnectorHealth, 
  ConnectorHealthState,
  RateLimitMetadata 
} from './radar-types.ts'

/**
 * Registry 5 Stream Resmi NARADA Radar + Policy Guardrail Stubs
 */
export const ACTIVE_RADAR_SOURCES: SourceDefinition[] = [
  {
    id: 'src-tbh',
    displayName: 'TurnBackHoax (MAFINDO)',
    shortLabel: 'TurnBackHoax',
    sourceType: 'fact_check',
    outputType: 'PUBLICATION',
    feedUrl: '/api/rss/turnbackhoax',
    directUrl: 'https://turnbackhoax.id/feed',
    category: 'PENIPUAN_BANSOS', // Default category, override dinamis saat klasifikasi item
    enabled: true,
    attributionLabel: 'TurnBackHoax.ID / Masyarakat Anti Fitnah Indonesia (MAFINDO)',
    attributionUrl: 'https://turnbackhoax.id',
    fetchTimeoutMs: 5000
  },
  {
    id: 'src-gnews-hankam',
    displayName: 'Google News — Hankam & TNI',
    shortLabel: 'G-News · Hankam/TNI',
    sourceType: 'rss',
    outputType: 'PUBLICATION',
    feedUrl: '/api/rss/google-news/search?q=(TNI+OR+alutsista+OR+Papua+OR+KKB+OR+Ambalat+OR+kapal+perang)+AND+(viral+OR+heboh+OR+polemik+OR+kontroversi+OR+hoaks)+when:2d&hl=id&gl=ID&ceid=ID:id',
    directUrl: 'https://news.google.com/rss/search?q=(TNI+OR+alutsista+OR+Papua+OR+KKB+OR+Ambalat+OR+kapal+perang)+AND+(viral+OR+heboh+OR+polemik+OR+kontroversi+OR+hoaks)+when:2d&hl=id&gl=ID&ceid=ID:id',
    category: 'KEDAULATAN_MILITER',
    enabled: true,
    attributionLabel: 'Google News RSS Aggregator (Penerbit Pers Terakreditasi Dewan Pers)',
    attributionUrl: 'https://news.google.com',
    fetchTimeoutMs: 5000
  },
  {
    id: 'src-gnews-demo',
    displayName: 'Google News — Aksi Massa & Unjuk Rasa',
    shortLabel: 'G-News · Aksi Massa',
    sourceType: 'rss',
    outputType: 'PUBLICATION',
    feedUrl: '/api/rss/google-news/search?q=(demo+OR+unjuk+rasa+OR+bentrok+OR+ricuh+OR+mahasiswa+OR+pemakzulan)+when:1d&hl=id&gl=ID&ceid=ID:id',
    directUrl: 'https://news.google.com/rss/search?q=(demo+OR+unjuk+rasa+OR+bentrok+OR+ricuh+OR+mahasiswa+OR+pemakzulan)+when:1d&hl=id&gl=ID&ceid=ID:id',
    category: 'POLITIK_NEGARA',
    enabled: true,
    attributionLabel: 'Google News RSS Aggregator (Pelaporan Dinamika Unjuk Rasa Terkini)',
    attributionUrl: 'https://news.google.com',
    fetchTimeoutMs: 5000
  },
  {
    id: 'src-gnews-politik',
    displayName: 'Google News — Kebijakan & Dinamika Negara',
    shortLabel: 'G-News · Kebijakan',
    sourceType: 'rss',
    outputType: 'PUBLICATION',
    feedUrl: '/api/rss/google-news/search?q=(Prabowo+OR+Gibran+OR+bansos+OR+MBG+OR+ijazah+OR+KPK)+AND+(viral+OR+heboh+OR+polemik+OR+sidang)+when:1d&hl=id&gl=ID&ceid=ID:id',
    directUrl: 'https://news.google.com/rss/search?q=(Prabowo+OR+Gibran+OR+bansos+OR+MBG+OR+ijazah+OR+KPK)+AND+(viral+OR+heboh+OR+polemik+OR+sidang)+when:1d&hl=id&gl=ID&ceid=ID:id',
    category: 'POLITIK_NEGARA',
    enabled: true,
    attributionLabel: 'Google News RSS Aggregator (Liputan Media Nasional)',
    attributionUrl: 'https://news.google.com',
    fetchTimeoutMs: 5000
  },
  {
    id: 'src-gtrends-id',
    displayName: 'Google Trends Indonesia (Search Interest)',
    shortLabel: 'Google Trends ID',
    sourceType: 'search_trend',
    outputType: 'SEARCH_TREND_SIGNAL',
    feedUrl: '/api/rss/google-trends',
    directUrl: 'https://trends.google.com/trending/rss?geo=ID',
    category: 'UMUM_NETRAL',
    enabled: true,
    attributionLabel: 'Google Trends Search Interest Signals (Wilayah Indonesia)',
    attributionUrl: 'https://trends.google.com',
    fetchTimeoutMs: 4500
  },
  {
    // STUB KEBIJAKAN YOUTUBE (TIDAK DIAKTIFKAN PADA SPRINT 1B)
    // Guardrail: Data YouTube API tidak boleh dicampur ke cross-source generic pipeline
    // tanpa persetujuan eksplisit, tidak boleh memprofiling individu, max retensi 30 hari.
    id: 'src-youtube-policy-stub',
    displayName: 'YouTube Data API Guardrail Stub (Disabled)',
    sourceType: 'official',
    outputType: 'PUBLICATION',
    feedUrl: '',
    directUrl: 'https://developers.google.com/youtube/terms/developer-policies',
    category: 'UMUM_NETRAL',
    enabled: false,
    attributionLabel: 'YouTube Data API Services (Policy Guardrail Stub)',
    attributionUrl: 'https://developers.google.com/youtube',
    fetchTimeoutMs: 5000,
    policyGuardrail: {
      sourceId: 'src-youtube-policy-stub',
      prohibitedActions: [
        'CROSS_SOURCE_CLUSTERING',
        'DERIVED_THREAT_METRICS',
        'INDIVIDUAL_PROFILING',
        'UNRESTRICTED_STORAGE'
      ],
      isolationRequired: true,
      maxRetentionDays: 30,
      policyReference: 'YouTube API Services Developer Policies (Section III.E & III.F)'
    }
  }
]

/**
 * State in-memory untuk memantau kesehatan connector per sesi
 */
const connectorHealthMap = new Map<string, ConnectorHealth>()

/**
 * Inisialisasi status default connector
 */
export function ensureInitialHealth(sourceId: string): ConnectorHealth {
  const existing = connectorHealthMap.get(sourceId)
  if (existing) return existing

  const sourceDef = ACTIVE_RADAR_SOURCES.find(s => s.id === sourceId)
  const initial: ConnectorHealth = {
    sourceId,
    sourceName: sourceDef?.displayName || sourceId,
    shortLabel: sourceDef?.shortLabel || sourceDef?.displayName || sourceId,
    state: sourceDef?.enabled ? 'UNKNOWN' : 'DISABLED',
    status: sourceDef?.enabled ? 'UNKNOWN' : 'DISABLED',
    lastAttemptAt: null,
    lastSuccessAt: null,
    consecutiveFailures: 0,
    lastItemPublishedAt: null,
    latencyMs: null,
    httpStatus: null,
    rateLimitStatus: null,
    itemCountLastFetch: 0,
    itemCount: 0,
    errorCode: null,
    errorCategory: null,
    sanitizedErrorMessage: null,
    userReadableMessage: sourceDef?.enabled ? 'Menunggu siklus sinkronisasi awal' : 'Sumber dinonaktifkan',
    healthObservedAt: Date.now()
  }
  connectorHealthMap.set(sourceId, initial)
  return initial
}

/**
 * Mengambil status kesehatan connector tertentu
 */
export function getConnectorHealth(sourceId: string): ConnectorHealth {
  return ensureInitialHealth(sourceId)
}

/**
 * Sanitasi pesan error agar tidak membocorkan query token, API keys, atau path rahasia
 */
export function sanitizeErrorMessage(rawMsg?: string | null): string | null {
  if (!rawMsg) return null
  return rawMsg
    .replace(/(?:key|token|auth|password|secret|bearer)=[^& \s]+/gi, '$1=[REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9_\-.]+/gi, 'Bearer [REDACTED]')
    .replace(/https?:\/\/[^\s]+(?:\?[^\s]+)?/gi, (url) => {
      try {
        const u = new URL(url)
        return `${u.protocol}//${u.host}${u.pathname}`
      } catch {
        return '[URL]'
      }
    })
    .slice(0, 300)
}

/**
 * Mengambil seluruh source yang aktif
 */
export function getActiveRadarSources(): SourceDefinition[] {
  return ACTIVE_RADAR_SOURCES.filter(s => s.enabled)
}

/**
 * Mengambil metadata definisi source berdasarkan ID
 */
export function getRadarSourceById(sourceId: string): SourceDefinition | undefined {
  return ACTIVE_RADAR_SOURCES.find(s => s.id === sourceId)
}

/**
 * Memperbarui status kesehatan connector setelah percobaan fetch aktual
 */
export function updateConnectorHealth(
  sourceId: string,
  update: {
    state: ConnectorHealthState
    httpStatus?: number | null
    latencyMs?: number | null
    itemCount?: number
    lastItemPublishedAt?: number | null
    errorCode?: string | null
    errorCategory?: string | null
    errorMessage?: string | null
    rateLimitStatus?: RateLimitMetadata | null
    userReadableMessage?: string
    isSuccess?: boolean
  }
): ConnectorHealth {
  const current = ensureInitialHealth(sourceId)
  const now = Date.now()
  const sanitizedMsg = sanitizeErrorMessage(update.errorMessage || update.userReadableMessage)

  let newConsecutiveFailures = current.consecutiveFailures
  let preservedLastSuccess = current.lastSuccessAt
  const isSuccess = update.isSuccess ?? (update.state === 'HEALTHY' || update.state === 'DEGRADED')

  if (update.state === 'CONNECTING') {
    // Sedang dalam proses fetch, pertahankan counter kegagalan & waktu sukses terakhir
  } else {
    newConsecutiveFailures = isSuccess ? 0 : current.consecutiveFailures + 1
    preservedLastSuccess = isSuccess ? now : current.lastSuccessAt
  }

  const updated: ConnectorHealth = {
    ...current,
    state: update.state,
    status: update.state,
    lastAttemptAt: now,
    lastSuccessAt: preservedLastSuccess,
    consecutiveFailures: newConsecutiveFailures,
    latencyMs: update.latencyMs !== undefined ? update.latencyMs : current.latencyMs,
    httpStatus: update.httpStatus !== undefined ? update.httpStatus : current.httpStatus,
    rateLimitStatus: update.rateLimitStatus !== undefined ? update.rateLimitStatus : current.rateLimitStatus,
    itemCountLastFetch: update.itemCount !== undefined ? update.itemCount : current.itemCountLastFetch,
    itemCount: update.itemCount !== undefined ? update.itemCount : current.itemCount,
    lastItemPublishedAt: update.lastItemPublishedAt !== undefined ? update.lastItemPublishedAt : current.lastItemPublishedAt,
    errorCode: update.errorCode ?? (isSuccess ? null : current.errorCode),
    errorCategory: update.errorCategory ?? (isSuccess ? null : current.errorCategory),
    errorMessage: sanitizedMsg,
    sanitizedErrorMessage: sanitizedMsg,
    userReadableMessage: update.userReadableMessage ?? current.userReadableMessage,
    healthObservedAt: now
  }

  connectorHealthMap.set(sourceId, updated)
  return updated
}

/**
 * Mengambil ringkasan kesehatan seluruh connector
 */
export function getAllConnectorHealth(): Record<string, ConnectorHealth> {
  const result: Record<string, ConnectorHealth> = {}
  ACTIVE_RADAR_SOURCES.forEach(source => {
    result[source.id] = ensureInitialHealth(source.id)
  })
  return result
}

/**
 * Reset seluruh status kesehatan connector (untuk testing)
 */
export function resetConnectorHealthState(): void {
  connectorHealthMap.clear()
}
