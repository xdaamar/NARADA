/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — SPRINT 11: AUTOMATED SOCIAL INTELLIGENCE CONTRACTS & DOMAIN MODEL
 * PUSSIBERAD TNI AD × CODEPOLITAN — KARTIKA CYBER HACKATHON 2026
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Prinsip Desain & Integritas Doktriner:
 * 1. Separation of Discovery vs Acquisition:
 *    - Search results (DiscoveryCandidate) are NOT validated SocialPost objects.
 *    - Search snippets NEVER inflate post, comment, creator, or truth metrics.
 * 2. Honest Platform Capability Model:
 *    - YouTube, Facebook, Instagram, TikTok, and X have independent capability matrices.
 *    - Blocked or restricted endpoints report POLICY_BLOCKED or ACCESS_RESTRICTED.
 * 3. Evidence & Truth Boundaries:
 *    - Social volume, engagement, or sentiment NEVER directly escalate claim verdicts
 *      to SUPPORTED_BY_EVIDENCE or CONTRADICTED_BY_EVIDENCE.
 * 4. Conservative Attribution:
 *    - Patterns are described strictly as observed statistics (SIMILARITY_PATTERN,
 *      BURST_ACTIVITY) with event-driven caveats, NEVER as bot/buzzer/actor attribution.
 * 5. Gate L Policy Compliance:
 *    - YouTube 30-day retention and prohibition of cross-channel or cross-platform
 *      data aggregation are enforced by design.
 * ══════════════════════════════════════════════════════════════════════════
 */

import type { TargetPlatform, ContentCompleteness, TimestampPrecision } from '../acquisition/source-contracts.ts'

export const SOCIAL_INTELLIGENCE_VERSION = '1.1.0'

export type SocialPlatform = TargetPlatform

export type SocialCapabilityType =
  | 'DISCOVERY'
  | 'METADATA'
  | 'CONTENT'
  | 'COMMENTS'
  | 'ENGAGEMENT'
  | 'DERIVED_ANALYSIS'
  | 'PERSISTENT_STORAGE'

export type SocialCapabilityStatus =
  | 'AVAILABLE'
  | 'VERIFIED_LIVE'
  | 'DOCUMENTED_BUT_NOT_CONFIGURED'
  | 'CONFIGURATION_REQUIRED'
  | 'ACCESS_RESTRICTED'
  | 'APPROVAL_REQUIRED'
  | 'POLICY_BLOCKED'
  | 'UNSUPPORTED'
  | 'TEMPORARILY_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'QUOTA_EXHAUSTED'
  | 'NOT_TESTED'

export type SocialContentStatus =
  | 'DISCOVERY_ONLY'
  | 'METADATA_ACQUIRED'
  | 'FULL_CONTENT_ACQUIRED'
  | 'COMMENTS_ACQUIRED'
  | 'COMMENTS_DISABLED'
  | 'COMMENTS_EMPTY'
  | 'ACCESS_RESTRICTED'
  | 'POLICY_BLOCKED'
  | 'CONTENT_UNAVAILABLE'
  | 'DELETED_OR_PRIVATE'

export type SocialAcquisitionMethod =
  | 'OFFICIAL_API'
  | 'APPROVED_RESEARCH_API'
  | 'DISCOVERY_INDEX'
  | 'MANUAL_OPERATOR'
  | 'FIXTURE_TEST'

export type SocialRelevanceStatus =
  | 'PENDING'
  | 'RELEVANT'
  | 'IRRELEVANT'
  | 'UNCERTAIN'

export type SocialRejectionReason =
  | 'UNRELATED_TOPIC'
  | 'ENTITY_MISMATCH'
  | 'AMBIGUOUS_ENTITY'
  | 'TIME_WINDOW_MISMATCH'
  | 'LANGUAGE_NOT_SUPPORTED'
  | 'INSUFFICIENT_CONTEXT'
  | 'DUPLICATE_OR_SYNDICATED'
  | 'DISCOVERY_ONLY'
  | 'POLICY_NOT_ELIGIBLE'
  | 'ANALYSIS_NOT_APPLICABLE'

export type SocialObservationCaveat =
  | 'OBSERVED_SAMPLE_ONLY'
  | 'NATURAL_EVENT_SPIKE_POSSIBLE'
  | 'NON_INDEPENDENT_THREAD_COMMENTS'
  | 'INDEX_LATENCY_DELAY'
  | 'CROSS_POST_REFERENCE_ONLY'
  | 'NO_ACTOR_ATTRIBUTION'

/**
 * Platform Capability Entry
 */
export interface PlatformCapabilityDefinition {
  platform: SocialPlatform
  capability: SocialCapabilityType
  status: SocialCapabilityStatus
  description: string
  legalBasisOrPolicyRef: string
  isPermitted: boolean
  requiresCredentials: boolean
  limitations: string[]
}

/**
 * Canonical Acquired Social Content (SocialPostRecord)
 * Validated platform resource — distinctly separated from provisional DiscoveryCandidate
 */
export interface SocialPostRecord {
  id: string // e.g. 'soc-post-yt-dQw4w9WgXcQ'
  platform: SocialPlatform
  platformPostId: string
  canonicalUrl: string
  originalUrl: string
  author: {
    handle?: string
    displayName?: string
    channelId?: string
    channelTitle?: string
    profileUrl?: string
    verifiedStatus?: 'VERIFIED' | 'UNVERIFIED' | 'OFFICIAL'
  }
  title: string
  contentText: string
  contentCompleteness: ContentCompleteness
  publishedAt: number | null // Source platform reported timestamp
  publishedAtPrecision: TimestampPrecision
  firstObservedAt: number // NARADA first seen instant
  acquiredAt: number // NARADA validation & acquisition instant
  retentionExpiresAt: number | null // Deterministic 30-day deadline for YouTube
  contentStatus: SocialContentStatus
  relevanceStatus: SocialRelevanceStatus
  relevanceScore?: number
  rejectionReason?: SocialRejectionReason
  acquisitionMethod: SocialAcquisitionMethod
  providerApiName: string
  providerApiVersion?: string
  acquisitionRunId: string
  queryFingerprint: string
  isProvisional: boolean
  limitations: string[]
  issueId?: string
  claimId?: string
  associatedClaimIds?: string[]
  associationConfidence?: number
  associationRationale?: string
  metrics?: {
    viewCount?: number
    likeCount?: number
    commentCount?: number
    shareCount?: number
    isEngagementAvailable: boolean
  }
  provenance: Record<string, unknown>
}

/**
 * Canonical Acquired Comment Record
 */
export interface SocialCommentRecord {
  id: string // e.g. 'soc-cmt-yt-Ugx...'
  postId: string
  platform: SocialPlatform
  platformCommentId: string
  authorHandle: string
  authorChannelUrl?: string
  textOriginal: string
  normalizedText: string
  likeCount: number
  replyCount: number
  publishedAt: number | null
  acquiredAt: number
  retentionExpiresAt: number | null
  sentimentVerdict?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED' | 'UNCERTAIN'
  sentimentScore?: number
  threadId?: string
  isReply?: boolean
  validationState: 'VALID' | 'TRUNCATED' | 'EMPTY' | 'EXCLUDED'
}

/**
 * Social Spread & Temporal Observation Snapshot
 */
export interface SocialSpreadObservation {
  id: string
  issueId?: string
  observedAt: number
  sampleSizePosts: number
  sampleSizeComments: number
  discoveryCandidatesCount: number
  platformBreakdown: Record<SocialPlatform, {
    postsCount: number
    commentsCount: number
    discoveryOnlyCount: number
    status: SocialCapabilityStatus
  }>
  temporalBuckets: Array<{
    bucketLabel: string
    startTime: number
    endTime: number
    postCount: number
    commentCount: number
  }>
  burstObservations: Array<{
    window: '5m' | '15m' | '1h' | '6h'
    ratio: number
    isBurstDetected: boolean
    caveat: string
  }>
  similarityClustersCount: number
  copypastaInstancesCount: number
  coordinationIndicators: {
    label:
      | 'NO_CLEAR_PATTERN'
      | 'SIMILARITY_PATTERN'
      | 'REPEATED_CONTENT_PATTERN'
      | 'BURST_ACTIVITY'
      | 'POSSIBLE_COORDINATED_AMPLIFICATION_INDICATOR'
      | 'INSUFFICIENT_EVIDENCE_FOR_ATTRIBUTION'
      | 'POLICY_BLOCKED'
    evidenceStrength: 'NONE' | 'WEAK' | 'MODERATE' | 'STRONG' | 'INSUFFICIENT'
    rationale: string
    alternativeExplanations: string[]
  }
  caveats: SocialObservationCaveat[]
}

/**
 * Automated Social Intelligence Run Summary
 */
export interface SocialAnalysisRunSummary {
  runId: string
  issueId?: string
  triggerType: 'MANUAL' | 'SCHEDULED' | 'EVENT_TRIGGERED'
  startedAt: number
  completedAt: number
  durationMs: number
  providersQueried: string[]
  platformsEvaluated: SocialPlatform[]
  discoveryCandidatesDiscovered: number
  discoveryCandidatesAccepted: number
  socialPostsAcquired: number
  socialCommentsAcquired: number
  relevantPostsCount: number
  claimsAssociatedCount: number
  policyBlockedOperationsCount: number
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED'
  errorSummary?: string[]
}

/**
 * Master Platform Capability Matrix Registry (Sprint 11 WP 3 & WP 2)
 */
export const PLATFORM_CAPABILITY_MATRIX: Record<SocialPlatform, PlatformCapabilityDefinition[]> = {
  youtube: [
    {
      platform: 'youtube',
      capability: 'DISCOVERY',
      status: 'AVAILABLE',
      description: 'Pencarian video publik berbasis kata kunci dan filter tanggal resmi.',
      legalBasisOrPolicyRef: 'YouTube Data API v3 search.list endpoint reference',
      isPermitted: true,
      requiresCredentials: true,
      limitations: ['search.list dibatasi kuota 100 panggilan/hari pada alokasi default.']
    },
    {
      platform: 'youtube',
      capability: 'METADATA',
      status: 'AVAILABLE',
      description: 'Pengambilan metadata rincian video tunggal publik (judul, kanal, statistik publik).',
      legalBasisOrPolicyRef: 'YouTube Data API v3 videos.list endpoint reference',
      isPermitted: true,
      requiresCredentials: true,
      limitations: ['Hanya untuk video publik berstatus aktif; video privat/unlisted tidak dapat diakses.']
    },
    {
      platform: 'youtube',
      capability: 'CONTENT',
      status: 'AVAILABLE',
      description: 'Metadata deskripsi video dan snippet resmi; streaming/downloading video audio dilarang.',
      legalBasisOrPolicyRef: 'YouTube Developer Policies Section II.D (Prohibition of Audio/Video Scraping)',
      isPermitted: true,
      requiresCredentials: true,
      limitations: ['Zero scraping audio/video; konten berupa teks deskripsi & metadata saja.']
    },
    {
      platform: 'youtube',
      capability: 'COMMENTS',
      status: 'AVAILABLE',
      description: 'Pengambilan komentar publik video tunggal via commentThreads.list resmi.',
      legalBasisOrPolicyRef: 'YouTube Data API v3 commentThreads.list & Section III.E.2',
      isPermitted: true,
      requiresCredentials: true,
      limitations: [
        'Komentar dinonaktifkan oleh kreator ditangani jujur (COMMENTS_DISABLED).',
        'Gate L: Agregasi komentar lintas-kanal dilarang keras tanpa persetujuan tertulis.'
      ]
    },
    {
      platform: 'youtube',
      capability: 'ENGAGEMENT',
      status: 'AVAILABLE',
      description: 'Pengamatan viewCount, likeCount, dan commentCount resmi dari statistics.',
      legalBasisOrPolicyRef: 'YouTube Data API v3 videos.list?part=statistics',
      isPermitted: true,
      requiresCredentials: true,
      limitations: ['Nilai engagement bersifat observasional, bukan bukti kebenaran suatu klaim.']
    },
    {
      platform: 'youtube',
      capability: 'DERIVED_ANALYSIS',
      status: 'AVAILABLE',
      description: 'Analisis sentimen kognitif terisolasi pada satu video atau satu kanal mandiri.',
      legalBasisOrPolicyRef: 'Gate L Addendum & YouTube Developer Policies Section III.E.2',
      isPermitted: true,
      requiresCredentials: false,
      limitations: [
        'Sentimen lintas-kanal atau lintas-platform dengan YouTube DIBLOKIR (POLICY_BLOCKED).',
        'Pola koordinasi penonton/buzzer attribution dilarang.'
      ]
    },
    {
      platform: 'youtube',
      capability: 'PERSISTENT_STORAGE',
      status: 'AVAILABLE',
      description: 'Penyimpanan lokal maksimum 30 hari kalender dengan auto-purge otomatis.',
      legalBasisOrPolicyRef: 'YouTube Developer Policies Section III.E.4 (30-day Retention Limit)',
      isPermitted: true,
      requiresCredentials: false,
      limitations: ['Seluruh data YouTube otomatis dibersihkan setelah 30 hari kalender.']
    }
  ],

  facebook: [
    {
      platform: 'facebook',
      capability: 'DISCOVERY',
      status: 'AVAILABLE',
      description: 'Penemuan URL postingan publik melalui operator site: search engine resmi.',
      legalBasisOrPolicyRef: 'Public Web Search Indexing (Brave/Google CSE)',
      isPermitted: true,
      requiresCredentials: true,
      limitations: ['Hanya mencakup halaman/postingan publik yang terindeks crawler mesin pencari.']
    },
    {
      platform: 'facebook',
      capability: 'METADATA',
      status: 'CONFIGURATION_REQUIRED',
      description: 'Metadata rincian halaman Facebook via Meta Graph API resmi.',
      legalBasisOrPolicyRef: 'Meta Graph API / Page Public Content Access (PPCA)',
      isPermitted: false,
      requiresCredentials: true,
      limitations: ['Memerlukan Meta App Review terverifikasi & Business Verification.']
    },
    {
      platform: 'facebook',
      capability: 'CONTENT',
      status: 'ACCESS_RESTRICTED',
      description: 'Pengambilan teks lengkap postingan Facebook publik.',
      legalBasisOrPolicyRef: 'Meta Content Library & Research API Terms',
      isPermitted: false,
      requiresCredentials: true,
      limitations: [
        'Meta Content Library mensyaratkan status institusi akademik/peneliti terakreditasi.',
        'Zero web scraping / zero login session bypass ditegakkan.'
      ]
    },
    {
      platform: 'facebook',
      capability: 'COMMENTS',
      status: 'ACCESS_RESTRICTED',
      description: 'Pengambilan komentar postingan Facebook.',
      legalBasisOrPolicyRef: 'Meta Platform Terms Section 3 (Automated Data Collection)',
      isPermitted: false,
      requiresCredentials: true,
      limitations: ['Tidak tersedia tanpa token akses halaman terverifikasi. Scraper dilarang keras.']
    },
    {
      platform: 'facebook',
      capability: 'ENGAGEMENT',
      status: 'ACCESS_RESTRICTED',
      description: 'Penghitungan reaksi/share publik.',
      legalBasisOrPolicyRef: 'Meta Graph API',
      isPermitted: false,
      requiresCredentials: true,
      limitations: ['Hanya estimasi parsial jika disediakan oleh cuplikan mesin pencari.']
    },
    {
      platform: 'facebook',
      capability: 'DERIVED_ANALYSIS',
      status: 'APPROVAL_REQUIRED',
      description: 'Analisis sentimen postingan publik.',
      legalBasisOrPolicyRef: 'Meta Commercial Terms',
      isPermitted: false,
      requiresCredentials: false,
      limitations: ['Hanya berlaku pada data yang telah berhasil diperoleh secara legal.']
    },
    {
      platform: 'facebook',
      capability: 'PERSISTENT_STORAGE',
      status: 'AVAILABLE',
      description: 'Penyimpanan bukti digital kandidat penemuan pencarian di pangkalan data lokal.',
      legalBasisOrPolicyRef: 'Local First Forensic Storage Standard',
      isPermitted: true,
      requiresCredentials: false,
      limitations: ['Hanya menyimpan kandidat discovery dan URL rujukan.']
    }
  ],

  instagram: [
    {
      platform: 'instagram',
      capability: 'DISCOVERY',
      status: 'AVAILABLE',
      description: 'Penemuan tautan Reels & Postingan publik via Dorking mesin pencari.',
      legalBasisOrPolicyRef: 'Public Search Indexing (instagram.com/p/, instagram.com/reel/)',
      isPermitted: true,
      requiresCredentials: true,
      limitations: ['Story dan postingan privat tidak terindeks.']
    },
    {
      platform: 'instagram',
      capability: 'METADATA',
      status: 'CONFIGURATION_REQUIRED',
      description: 'Instagram Basic Display / Graph API metadata.',
      legalBasisOrPolicyRef: 'Meta Instagram Graph API',
      isPermitted: false,
      requiresCredentials: true,
      limitations: ['Memerlukan akun profesional terhubung dan App Review resmi.']
    },
    {
      platform: 'instagram',
      capability: 'CONTENT',
      status: 'ACCESS_RESTRICTED',
      description: 'Konten media dan takarir lengkap Instagram.',
      legalBasisOrPolicyRef: 'Instagram Terms of Use Section 3',
      isPermitted: false,
      requiresCredentials: true,
      limitations: ['Zero scraping web session.']
    },
    {
      platform: 'instagram',
      capability: 'COMMENTS',
      status: 'ACCESS_RESTRICTED',
      description: 'Pengambilan komentar Reels/Post.',
      legalBasisOrPolicyRef: 'Meta Instagram Graph API Comments Endpoint',
      isPermitted: false,
      requiresCredentials: true,
      limitations: ['Hanya diizinkan untuk akun milik sendiri via Graph API.']
    },
    {
      platform: 'instagram',
      capability: 'ENGAGEMENT',
      status: 'ACCESS_RESTRICTED',
      description: 'Jumlah like dan view Reels.',
      legalBasisOrPolicyRef: 'Instagram Graph API Insights',
      isPermitted: false,
      requiresCredentials: true,
      limitations: ['Hanya ringkasan metadata mesin pencari jika tersedia.']
    },
    {
      platform: 'instagram',
      capability: 'DERIVED_ANALYSIS',
      status: 'APPROVAL_REQUIRED',
      description: 'Analisis tren narasi visual.',
      legalBasisOrPolicyRef: 'Local Forensic Policy',
      isPermitted: false,
      requiresCredentials: false,
      limitations: ['Tergantung data yang diakuisisi secara sah.']
    },
    {
      platform: 'instagram',
      capability: 'PERSISTENT_STORAGE',
      status: 'AVAILABLE',
      description: 'Penyimpanan URL kanonikal dan cuplikan penemuan publik.',
      legalBasisOrPolicyRef: 'NARADA Local Database',
      isPermitted: true,
      requiresCredentials: false,
      limitations: ['Data cuplikan ditandai SNIPPET_ONLY.']
    }
  ],

  tiktok: [
    {
      platform: 'tiktok',
      capability: 'DISCOVERY',
      status: 'AVAILABLE',
      description: 'Penemuan tautan video publik TikTok via Dorking mesin pencari.',
      legalBasisOrPolicyRef: 'Public Search Indexing (tiktok.com/@user/video/)',
      isPermitted: true,
      requiresCredentials: true,
      limitations: ['Hanya video publik yang telah dirayapi mesin pencari.']
    },
    {
      platform: 'tiktok',
      capability: 'METADATA',
      status: 'APPROVAL_REQUIRED',
      description: 'Pengambilan metadata video terstruktur melalui TikTok Research API.',
      legalBasisOrPolicyRef: 'TikTok Research API Documentation & Eligibility',
      isPermitted: false,
      requiresCredentials: true,
      limitations: [
        'TikTok Research API mewajibkan persetujuan institusi nirlaba/penelitian formal.',
        'Akun pengembang individu biasa tidak memiliki hak akses endpoint ini.'
      ]
    },
    {
      platform: 'tiktok',
      capability: 'CONTENT',
      status: 'ACCESS_RESTRICTED',
      description: 'Pengambilan transkrip atau takarir video TikTok.',
      legalBasisOrPolicyRef: 'TikTok Terms of Service (Prohibition of Automated Extraction)',
      isPermitted: false,
      requiresCredentials: true,
      limitations: ['Zero headless browser automation & zero anti-bot bypass.']
    },
    {
      platform: 'tiktok',
      capability: 'COMMENTS',
      status: 'APPROVAL_REQUIRED',
      description: 'Pengambilan komentar publik TikTok melalui Research API.',
      legalBasisOrPolicyRef: 'TikTok Research API Comments Endpoint',
      isPermitted: false,
      requiresCredentials: true,
      limitations: ['Memerlukan persetujuan aplikasi riset tertulis dari TikTok.']
    },
    {
      platform: 'tiktok',
      capability: 'ENGAGEMENT',
      status: 'APPROVAL_REQUIRED',
      description: 'Statistik interaksi video (view, like, share).',
      legalBasisOrPolicyRef: 'TikTok Research API Video Query',
      isPermitted: false,
      requiresCredentials: true,
      limitations: ['Hanya data observasi penemuan pencarian yang ditampilkan jika ada.']
    },
    {
      platform: 'tiktok',
      capability: 'DERIVED_ANALYSIS',
      status: 'APPROVAL_REQUIRED',
      description: 'Analisis resonansi narasi video pendek.',
      legalBasisOrPolicyRef: 'Local Forensic Policy',
      isPermitted: false,
      requiresCredentials: false,
      limitations: ['Hanya jika data diperoleh secara legal.']
    },
    {
      platform: 'tiktok',
      capability: 'PERSISTENT_STORAGE',
      status: 'AVAILABLE',
      description: 'Penyimpanan bukti tautan penemuan.',
      legalBasisOrPolicyRef: 'NARADA Forensic Storage',
      isPermitted: true,
      requiresCredentials: false,
      limitations: ['Tersimpan sebagai kandidat discovery, bukan artikel utuh.']
    }
  ],

  x: [
    {
      platform: 'x',
      capability: 'DISCOVERY',
      status: 'AVAILABLE',
      description: 'Penemuan tautan postingan publik via Dorking x.com & twitter.com.',
      legalBasisOrPolicyRef: 'Public Search Indexing (x.com/status/)',
      isPermitted: true,
      requiresCredentials: true,
      limitations: ['Cuitan terlindungi dan akun terbatas tidak dapat diindeks.']
    },
    {
      platform: 'x',
      capability: 'METADATA',
      status: 'CONFIGURATION_REQUIRED',
      description: 'Rincian postingan dan profil via X API v2 (Basic/Pro/Enterprise tier).',
      legalBasisOrPolicyRef: 'X Developer Platform v2 API Reference',
      isPermitted: false,
      requiresCredentials: true,
      limitations: [
        'Tier gratis X API v2 hanya mengizinkan write-only (Posting).',
        'Endpoint pembacaan (Tweets Lookup) mewajibkan tier Basic (USD 100/bulan) atau lebih tinggi.'
      ]
    },
    {
      platform: 'x',
      capability: 'CONTENT',
      status: 'CONFIGURATION_REQUIRED',
      description: 'Teks lengkap cuitan via X API v2 Tweets Lookup.',
      legalBasisOrPolicyRef: 'X API v2 Tweets Lookup Endpoint',
      isPermitted: false,
      requiresCredentials: true,
      limitations: ['Memerlukan langganan berbayar X Developer Tier. Zero scraping login session.']
    },
    {
      platform: 'x',
      capability: 'COMMENTS',
      status: 'CONFIGURATION_REQUIRED',
      description: 'Pengambilan balasan cuitan (conversation_id search).',
      legalBasisOrPolicyRef: 'X API v2 Recent Search / Tweet Lookup',
      isPermitted: false,
      requiresCredentials: true,
      limitations: ['Mewajibkan tier berbayar dengan batas pembacaan bulanan ketat.']
    },
    {
      platform: 'x',
      capability: 'ENGAGEMENT',
      status: 'CONFIGURATION_REQUIRED',
      description: 'Metrik impresi, retweet, dan suka publik.',
      legalBasisOrPolicyRef: 'X API v2 Public Metrics',
      isPermitted: false,
      requiresCredentials: true,
      limitations: ['Mewajibkan kredensial tier berbayar aktif.']
    },
    {
      platform: 'x',
      capability: 'DERIVED_ANALYSIS',
      status: 'APPROVAL_REQUIRED',
      description: 'Analisis polaritas sentimen cuitan.',
      legalBasisOrPolicyRef: 'X Developer Agreement Section 4',
      isPermitted: false,
      requiresCredentials: false,
      limitations: ['Menghormati hak privasi dan larangan profiling individu sensitif.']
    },
    {
      platform: 'x',
      capability: 'PERSISTENT_STORAGE',
      status: 'AVAILABLE',
      description: 'Penyimpanan bukti tautan penemuan pencarian.',
      legalBasisOrPolicyRef: 'NARADA Local Database',
      isPermitted: true,
      requiresCredentials: false,
      limitations: ['Data cuplikan ditandai DISCOVERY_ONLY.']
    }
  ],

  web: [
    {
      platform: 'web',
      capability: 'DISCOVERY',
      status: 'AVAILABLE',
      description: 'Penemuan artikel berita web publik via mesin pencari.',
      legalBasisOrPolicyRef: 'Web Indexing',
      isPermitted: true,
      requiresCredentials: false,
      limitations: []
    },
    {
      platform: 'web',
      capability: 'METADATA',
      status: 'AVAILABLE',
      description: 'Metadata rilis berita dari RSS / HTML publik.',
      legalBasisOrPolicyRef: 'Open Web Protocols',
      isPermitted: true,
      requiresCredentials: false,
      limitations: []
    },
    {
      platform: 'web',
      capability: 'CONTENT',
      status: 'AVAILABLE',
      description: 'Teks artikel publik.',
      legalBasisOrPolicyRef: 'Open Web Protocols',
      isPermitted: true,
      requiresCredentials: false,
      limitations: []
    },
    {
      platform: 'web',
      capability: 'COMMENTS',
      status: 'UNSUPPORTED',
      description: 'Komentar web berita umum.',
      legalBasisOrPolicyRef: 'N/A',
      isPermitted: false,
      requiresCredentials: false,
      limitations: ['Komentar portal web berita tidak diindeks secara umum.']
    },
    {
      platform: 'web',
      capability: 'ENGAGEMENT',
      status: 'UNSUPPORTED',
      description: 'Engagement web umum.',
      legalBasisOrPolicyRef: 'N/A',
      isPermitted: false,
      requiresCredentials: false,
      limitations: []
    },
    {
      platform: 'web',
      capability: 'DERIVED_ANALYSIS',
      status: 'AVAILABLE',
      description: 'Analisis klaim dan fakta via Sprint 09 Intelligence Core.',
      legalBasisOrPolicyRef: 'NARADA Intelligence Core',
      isPermitted: true,
      requiresCredentials: false,
      limitations: []
    },
    {
      platform: 'web',
      capability: 'PERSISTENT_STORAGE',
      status: 'AVAILABLE',
      description: 'Penyimpanan artikel kanonikal pada pangkalan data lokal.',
      legalBasisOrPolicyRef: 'NARADA Local DB',
      isPermitted: true,
      requiresCredentials: false,
      limitations: []
    }
  ]
}

/**
 * Mengambil ringkasan kapabilitas platform tertentu
 */
export function getPlatformCapabilities(platform: SocialPlatform): PlatformCapabilityDefinition[] {
  return PLATFORM_CAPABILITY_MATRIX[platform] || []
}

/**
 * Memeriksa status kapabilitas spesifik platform
 */
export function evaluatePlatformCapability(
  platform: SocialPlatform,
  capability: SocialCapabilityType
): PlatformCapabilityDefinition {
  const list = getPlatformCapabilities(platform)
  const found = list.find(c => c.capability === capability)
  if (found) return found

  return {
    platform,
    capability,
    status: 'UNSUPPORTED',
    description: `Kapabilitas ${capability} tidak didukung pada platform ${platform}`,
    legalBasisOrPolicyRef: 'N/A',
    isPermitted: false,
    requiresCredentials: false,
    limitations: ['Tidak ada dasar implementasi resmi.']
  }
}

