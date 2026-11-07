/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — SPRINT 10: SOURCE ACQUISITION & SEARCH DISCOVERY CONTRACTS
 * PUSSIBERAD TNI AD × CODEPOLITAN — KARTIKA CYBER HACKATHON 2026
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Prinsip Desain & Integritas:
 * 1. Unified Connector Abstraction: Standarisasi kontrak seluruh konektor (RSS, API, Dorking, Fact-Check).
 * 2. Strict Provenance Retention: Memisahkan secara tegas antara discovery candidate dan validated article.
 * 3. Search Snippet != Article: Snippet pencarian TIDAK BOLEH dianggap artikel penuh atau bukti independen.
 * 4. Honest Capability & Health: Tidak menyatakan koneksi aktif jika kredensial tidak dikonfigurasi.
 * ══════════════════════════════════════════════════════════════════════════
 */

export const SOURCE_ACQUISITION_CONTRACT_VERSION = '1.0.0'

export type CanonicalConnectorHealth =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'ACCESS_RESTRICTED'
  | 'CONFIGURATION_REQUIRED'
  | 'DISABLED'

export type SourceType =
  | 'rss_feed'
  | 'aggregator'
  | 'official_api'
  | 'search_dorking'
  | 'fact_check'
  | 'search_trend'

export type ConfigurationStatus =
  | 'CONFIGURED'
  | 'CONFIGURATION_REQUIRED'
  | 'INVALID_CREDENTIALS'
  | 'NOT_APPLICABLE'

export type CapabilityStatus =
  | 'PERMITTED'
  | 'POLICY_BLOCKED'
  | 'APPROVAL_REQUIRED'
  | 'DEPRECATED'

export type YouTubePolicySection =
  | 'SECTION_III_E_2_DATA_AGGREGATION'
  | 'SECTION_III_E_4_RETENTION_DELETION'
  | 'SECTION_III_A_CLIENT_TERMS'
  | 'SECTION_II_ATTRIBUTION'

export interface YouTubeCapabilityGate {
  capabilityName: string
  status: CapabilityStatus
  policySection: YouTubePolicySection
  rationale: string
  allowIndividualResource: boolean
  allowCrossChannel: boolean
  allowCrossPlatform: boolean
}

export type ConnectorCapability =
  | 'URL_DISCOVERY'
  | 'VIDEO_METADATA'
  | 'ARTICLE_METADATA'
  | 'FULL_ARTICLE_TEXT'
  | 'COMMENT_RETRIEVAL'
  | 'KEYWORD_SEARCH'
  | 'DATE_FILTERING'
  | 'PLATFORM_FILTERING'
  | 'PAGINATION'

export type TargetPlatform =
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'x'
  | 'youtube'
  | 'web'

export type TimestampPrecision = 'EXACT' | 'ESTIMATED' | 'UNKNOWN'

export type ContentCompleteness =
  | 'FULL_TEXT'
  | 'TITLE_AND_SNIPPET'
  | 'METADATA_ONLY'
  | 'SNIPPET_ONLY'

export type SourceAccessState = 'PUBLIC' | 'ACCESS_RESTRICTED' | 'LOGIN_REQUIRED'

export type ValidationState = 'VALIDATED' | 'PENDING' | 'REJECTED'

export type DeduplicationState = 'UNIQUE' | 'DUPLICATE' | 'PRIMARY_CLUSTER_LEAD'

export type DiscoveryCandidateStatus =
  | 'DISCOVERED'
  | 'NORMALIZED'
  | 'PENDING_VALIDATION'
  | 'CONTENT_AVAILABLE'
  | 'CONTENT_PARTIAL'
  | 'RELEVANT'
  | 'IRRELEVANT'
  | 'UNCERTAIN'
  | 'ACCESS_RESTRICTED'
  | 'UNAVAILABLE'
  | 'DUPLICATE'
  | 'PROMOTED_TO_ARTICLE'
  | 'REJECTED'

/**
 * Kontrak Provenance Akuisisi Sumber
 */
export interface AcquisitionProvenance {
  recordId: string
  connectorId: string
  providerId: string
  platform?: TargetPlatform
  originalUrl: string
  canonicalUrl: string
  queryMethod: string
  acquiredAt: number
  publishedAt: number | null
  publishedAtPrecision: TimestampPrecision
  indexedAt: number | null
  firstDiscoveredAt: number
  lastObservedAt: number
  lastContentValidatedAt: number | null
  contentCompleteness: ContentCompleteness
  sourceAccessState: SourceAccessState
  validationState: ValidationState
  deduplicationState: DeduplicationState
  promotedArticleId?: string
}

/**
 * Kontrak Kandidat Hasil Pencarian / Dorking Discovery (Terpisah dari ArticleRecord!)
 */
export interface SearchDiscoveryResult {
  id: string
  providerId: string
  queryId: string
  targetPlatform: TargetPlatform
  originalUrl: string
  canonicalUrl: string
  title: string
  snippet: string
  publishedAt: number | null
  publishedAtPrecision: TimestampPrecision
  indexedAt: number | null
  discoveredAt: number
  searchRank: number
  platformIdentity?: {
    accountHandle?: string
    channelId?: string
    channelTitle?: string
    videoId?: string
    postId?: string
  }
  sourceMetadata: Record<string, unknown>
  contentStatus:
    | 'SNIPPET_ONLY'
    | 'METADATA_AVAILABLE'
    | 'FULL_CONTENT_RESOLVED'
    | 'ACCESS_RESTRICTED'
    | 'UNAVAILABLE'
  relevanceStatus: 'PENDING' | 'RELEVANT' | 'IRRELEVANT' | 'UNCERTAIN'
  relevanceScore?: number
  ingestionStatus: DiscoveryCandidateStatus
  provenance: AcquisitionProvenance
  limitations: string[]
  isProvisional: boolean
  retentionExpiresAt?: number
  isCrossChannelAggregationProhibited?: boolean
  attributionRequired?: boolean
}

/**
 * Registry Kebijakan & Gerbang Kapabilitas YouTube API Services (Section III.E.2 & III.E.4)
 */
export const YOUTUBE_CAPABILITY_GATES: Record<string, YouTubeCapabilityGate> = {
  YOUTUBE_SINGLE_VIDEO_METADATA: {
    capabilityName: 'YOUTUBE_SINGLE_VIDEO_METADATA',
    status: 'PERMITTED',
    policySection: 'SECTION_III_E_2_DATA_AGGREGATION',
    rationale: 'Pengambilan metadata video tunggal publik diizinkan melalui endpoint resmi videos.list.',
    allowIndividualResource: true,
    allowCrossChannel: false,
    allowCrossPlatform: false
  },
  YOUTUBE_SINGLE_VIDEO_COMMENTS: {
    capabilityName: 'YOUTUBE_SINGLE_VIDEO_COMMENTS',
    status: 'PERMITTED',
    policySection: 'SECTION_III_E_2_DATA_AGGREGATION',
    rationale: 'Pengambilan komentar untuk video tunggal diizinkan dengan menghormati status privasi video.',
    allowIndividualResource: true,
    allowCrossChannel: false,
    allowCrossPlatform: false
  },
  YOUTUBE_SINGLE_VIDEO_SENTIMENT: {
    capabilityName: 'YOUTUBE_SINGLE_VIDEO_SENTIMENT',
    status: 'PERMITTED',
    policySection: 'SECTION_III_E_2_DATA_AGGREGATION',
    rationale: 'Estimasi sentimen terisolasi pada lingkup satu video tunggal diizinkan.',
    allowIndividualResource: true,
    allowCrossChannel: false,
    allowCrossPlatform: false
  },
  YOUTUBE_SINGLE_CHANNEL_ANALYSIS: {
    capabilityName: 'YOUTUBE_SINGLE_CHANNEL_ANALYSIS',
    status: 'PERMITTED',
    policySection: 'SECTION_III_E_2_DATA_AGGREGATION',
    rationale: 'Analisis video dan komentar dalam satu kanal milik pemilik konten yang sama diizinkan.',
    allowIndividualResource: true,
    allowCrossChannel: false,
    allowCrossPlatform: false
  },
  YOUTUBE_CROSS_CHANNEL_COMMENT_AGGREGATION: {
    capabilityName: 'YOUTUBE_CROSS_CHANNEL_COMMENT_AGGREGATION',
    status: 'POLICY_BLOCKED',
    policySection: 'SECTION_III_E_2_DATA_AGGREGATION',
    rationale: 'Kebijakan Pengembang YouTube Bagian III.E.2 melarang agregasi data antarpemilik konten/kanal yang tidak terkait tanpa izin tertulis eksplisit.',
    allowIndividualResource: false,
    allowCrossChannel: false,
    allowCrossPlatform: false
  },
  YOUTUBE_CROSS_CHANNEL_SENTIMENT_COMBINATION: {
    capabilityName: 'YOUTUBE_CROSS_CHANNEL_SENTIMENT_COMBINATION',
    status: 'POLICY_BLOCKED',
    policySection: 'SECTION_III_E_2_DATA_AGGREGATION',
    rationale: 'Kombinasi sentimen komentar melintasi berbagai pemilik kanal dilarang oleh Bagian III.E.2.',
    allowIndividualResource: false,
    allowCrossChannel: false,
    allowCrossPlatform: false
  },
  YOUTUBE_CROSS_CHANNEL_ISSUE_STATISTICS: {
    capabilityName: 'YOUTUBE_CROSS_CHANNEL_ISSUE_STATISTICS',
    status: 'POLICY_BLOCKED',
    policySection: 'SECTION_III_E_2_DATA_AGGREGATION',
    rationale: 'Statistik agregat tingkat isu dari beberapa pemilik kanal YouTube yang tidak terkait dilarang tanpa izin resmi.',
    allowIndividualResource: false,
    allowCrossChannel: false,
    allowCrossPlatform: false
  },
  YOUTUBE_CROSS_PLATFORM_METRICS_COMBINATION: {
    capabilityName: 'YOUTUBE_CROSS_PLATFORM_METRICS_COMBINATION',
    status: 'POLICY_BLOCKED',
    policySection: 'SECTION_III_E_2_DATA_AGGREGATION',
    rationale: 'Penggabungan metrik turunan YouTube ke dalam metrik agregat gabungan lintas platform dilarang.',
    allowIndividualResource: false,
    allowCrossChannel: false,
    allowCrossPlatform: false
  },
  YOUTUBE_CROSS_PLATFORM_COORDINATION_INDICATORS: {
    capabilityName: 'YOUTUBE_CROSS_PLATFORM_COORDINATION_INDICATORS',
    status: 'POLICY_BLOCKED',
    policySection: 'SECTION_III_E_2_DATA_AGGREGATION',
    rationale: 'Indikator pola koordinasi lintas kanal atau lintas platform yang mengikutsertakan data YouTube dilarang secara kebijakan.',
    allowIndividualResource: false,
    allowCrossChannel: false,
    allowCrossPlatform: false
  }
}

/**
 * Evaluasi izin kapabilitas operasional data YouTube berdasarkan kebijakan resmi
 */
export function evaluateYouTubeCapability(
  capabilityName: string,
  context?: {
    isCrossChannel?: boolean
    isCrossPlatform?: boolean
    channelIds?: string[]
  }
): {
  isPermitted: boolean
  status: CapabilityStatus
  policySection: YouTubePolicySection
  rationale: string
} {
  const gate = YOUTUBE_CAPABILITY_GATES[capabilityName]
  if (!gate) {
    return {
      isPermitted: false,
      status: 'APPROVAL_REQUIRED',
      policySection: 'SECTION_III_E_2_DATA_AGGREGATION',
      rationale: `Kapabilitas '${capabilityName}' belum terverifikasi memiliki dasar izin eksplisit.`
    }
  }

  // Jika konteks menyatakan cross-channel dan terdapat lebih dari 1 channel
  if (context?.isCrossChannel || (context?.channelIds && new Set(context.channelIds.filter(Boolean)).size > 1)) {
    if (!gate.allowCrossChannel) {
      return {
        isPermitted: false,
        status: 'POLICY_BLOCKED',
        policySection: 'SECTION_III_E_2_DATA_AGGREGATION',
        rationale: 'Kebijakan Pengembang YouTube Bagian III.E.2 melarang agregasi data antarpemilik kanal yang berbeda.'
      }
    }
  }

  // Jika konteks menyatakan cross-platform
  if (context?.isCrossPlatform && !gate.allowCrossPlatform) {
    return {
      isPermitted: false,
      status: 'POLICY_BLOCKED',
      policySection: 'SECTION_III_E_2_DATA_AGGREGATION',
      rationale: 'Kebijakan Pengembang YouTube melarang pencampuran metrik turunan YouTube ke dalam agregasi lintas platform.'
    }
  }

  return {
    isPermitted: gate.status === 'PERMITTED',
    status: gate.status,
    policySection: gate.policySection,
    rationale: gate.rationale
  }
}

/**
 * Kontrak Konektor Sumber Terstandarisasi
 */
export interface SourceConnector {
  connectorId: string
  displayName: string
  sourceType: SourceType
  providerName: string
  platform?: TargetPlatform
  enabled: boolean
  configurationStatus: ConfigurationStatus
  healthStatus: CanonicalConnectorHealth
  lastCheckedAt: number | null
  lastSuccessfulAt: number | null
  lastItemReceivedAt: number | null
  supportedCapabilities: readonly ConnectorCapability[]
  limitations: string[]
  version: string
}

/**
 * Riwayat Eksekusi Pemindaian / Sinkronisasi
 */
export interface ScanRunLog {
  runId: string
  triggerType: 'AUTO' | 'MANUAL' | 'STARTUP_CATCHUP' | 'RETRY'
  startedAt: number
  completedAt: number
  durationMs: number
  connectorsAttempted: number
  connectorsSucceeded: number
  connectorsFailed: number
  itemsDiscovered: number
  itemsAccepted: number
  itemsRejected: number
  duplicatesCount: number
  rateLimitHits: number
  errors: Array<{
    connectorId: string
    code: string
    message: string
  }>
}
