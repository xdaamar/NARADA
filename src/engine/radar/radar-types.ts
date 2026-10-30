/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — COGNITIVE THREAT DEFENSE SYSTEM
 * SPRINT 1: RADAR DATA CONTRACTS & NORMALIZATION SCHEMA
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Prinsip Desain:
 * 1. Single Source of Truth: Menghubungkan semua connector ke satu kontrak normalisasi.
 * 2. Pemisahan Semantik Waktu: publishedAt != observedAt != retrievedAt != lastVerifiedAt.
 * 3. Assessment Multidimensi: Freshness, Context Relevance, Metadata Transparency, Review State.
 * 4. Zero Assumption: Jika data tidak tersedia, gunakan null / UNKNOWN_DATE secara jujur.
 * ══════════════════════════════════════════════════════════════════════════
 */

import type { ThreatSpectrumCluster } from '../../types.ts'

// ─── 1. Source Definition & Registry Types ───

export type SourceType = 'rss' | 'official' | 'fact_check' | 'search_trend'
export type SourceOutputType = 'PUBLICATION' | 'SEARCH_TREND_SIGNAL'

export interface SourceDefinition {
  id: string
  displayName: string
  sourceType: SourceType
  outputType?: SourceOutputType
  feedUrl: string
  directUrl: string
  category: ThreatSpectrumCluster | 'UMUM_NETRAL'
  enabled: boolean
  attributionLabel: string
  attributionUrl: string
  fetchTimeoutMs: number
  policyGuardrail?: SourcePolicyGuardrail
}

/**
 * YouTube Data API & Third-Party Policy Guardrail Contract
 */
export interface SourcePolicyGuardrail {
  sourceId: string
  prohibitedActions: string[]
  isolationRequired: boolean
  maxRetentionDays: number
  policyReference: string
}

export type ConnectorHealthState = 
  | 'HEALTHY'       // Berhasil diambil dan diparsing dalam percobaan terakhir
  | 'DEGRADED'      // Berhasil sebagian atau menggunakan proxy fallback
  | 'RATE_LIMITED'   // Menerima HTTP 429 dari sumber
  | 'STALE'         // Gagal fetch terbaru, menyajikan data cache lokal
  | 'UNAVAILABLE'   // Gagal fetch dan tidak ada cache yang valid
  | 'DISABLED'      // Dinonaktifkan secara administratif
  | 'UNKNOWN'       // Belum ada percobaan jaringan aktual
  | 'CONNECTING'    // Sedang dalam proses pengambilan data jaringan aktual

export interface RateLimitMetadata {
  isRateLimited: boolean
  retryAfterSeconds?: number
  resetAt?: number
}

export interface ConnectorHealth {
  sourceId: string
  sourceName: string
  state: ConnectorHealthState
  status?: ConnectorHealthState         // Interoperable alias
  lastAttemptAt: number | null
  lastSuccessAt: number | null
  consecutiveFailures: number
  lastItemPublishedAt: number | null
  latencyMs: number | null
  httpStatus: number | null
  rateLimitStatus?: RateLimitMetadata | null
  itemCountLastFetch: number
  itemCount: number                    // Normalized counter
  errorCode: string | null
  errorCategory: string | null
  errorMessage?: string | null
  sanitizedErrorMessage?: string | null
  userReadableMessage: string
  healthObservedAt: number
}

// ─── 1B. Search Trend Signal Model (Auxiliary Signal, BUKAN Publikasi) ───

export interface SearchTrendSignal {
  id: string
  sourceId: 'src-gtrends-id' | string
  query: string
  relatedQueries?: string[]
  startedAt?: string
  observedAt: number
  retrievedAt: number
  trendStatus?: 'ACTIVE' | 'ENDED' | 'UNKNOWN'
  searchVolumeBand?: string
  sourceUrl: string
  sourceLabel: string
  timestampStatus: 'VALID' | 'UNKNOWN_DATE' | 'INVALID_TIMESTAMP'
  limitations: string[]
}

// ─── 2. Timestamp Integrity & Freshness Types ───

export type FreshnessStatus = 
  | 'BREAKING'            // 0 s/d < 3 jam (< 180 menit)
  | 'AKTUAL'              // 3 s/d < 12 jam (180 - 719 menit)
  | 'BERKEMBANG'          // 12 s/d 24 jam (720 - 1440 menit)
  | 'KONTEKS'             // > 24 jam (> 1440 menit)
  | 'UNKNOWN_DATE'        // Waktu publikasi tidak disediakan oleh sumber
  | 'INVALID_TIMESTAMP'   // Tanggal tidak dapat diparse
  | 'FUTURE_TIMESTAMP'    // Tanggal melebihi waktu sekarang + toleransi clock skew

export interface FreshnessAssessment {
  status: FreshnessStatus
  ageMinutes: number | null
  referenceTimestamp: number | null
  evaluatedAt: number
  reasonCode: string
  humanLabel: string
}

// ─── 3. Context Relevance & Metadata Transparency Types ───

export interface ContextRelevanceAssessment {
  score: number                 // 0 - 100: Relevansi dengan topik pantauan (BUKAN tingkat ancaman)
  matchedTopics: string[]
  reasonCodes: string[]
  primaryCategory: ThreatSpectrumCluster
}

export interface MetadataTransparencyAssessment {
  completenessScore: number     // 0 - 100: Persentase kelengkapan data sumber
  hasPublishedDate: boolean
  hasOriginalUrl: boolean
  hasPublisher: boolean
  hasValidLink: boolean
  reasonCodes: string[]
}

export type RadarReviewState = 
  | 'NEW'             // Baru diobservasi (< 3 jam), belum diaudit manual
  | 'NEEDS_REVIEW'    // Memiliki relevansi konteks tinggi / sinyal kontradiktif
  | 'CONTEXT_ONLY'    // Berita faktual / informasi umum tanpa klaim kontroversial
  | 'UPDATED'         // Memperoleh informasi atau publikasi baru
  | 'SOURCE_LIMITED'  // Metadata tidak lengkap (misal: tanggal tidak ada)

// ─── 4. Normalized Publication Model (Atomik) ───

export interface NormalizedPublication {
  id: string                     // Stable unique identifier (hash atau derived ID)
  sourceId: string               // Rujukan ke SourceDefinition.id
  sourceType: SourceType
  sourceName: string
  title: string
  originalUrl: string
  canonicalUrl: string
  excerpt: string
  publisher: string
  publishedAt: number | null     // Epoch ms waktu penerbitan sumber (NULL jika tidak ada)
  publishedAtFormatted: string   // Format militer atau "Waktu Publikasi Tidak Tersedia"
  observedAt: number            // Epoch ms saat pertama kali dilihat oleh sistem NARADA
  retrievedAt: number           // Epoch ms pengambilan terbaru
  lastVerifiedAt: number | null  // Epoch ms pemeriksaan fakta resmi (jika ada)
  extractionMethod: 'rss' | 'official_feed'
  category: ThreatSpectrumCluster
  topicTags: string[]
  language: string
  contentFingerprint: string
  attribution: string
  freshness: FreshnessAssessment
  contextRelevance: ContextRelevanceAssessment
  metadataTransparency: MetadataTransparencyAssessment
  reviewState: RadarReviewState
  verdict: 'HOAKS' | 'DISINFORMASI' | 'PROPAGANDA' | 'FAKTA' | 'NETRAL' | 'UNVERIFIED'
  clarification?: string
  officialSource?: string
  claimAssessment?: ClaimMatchCandidate
  cacheSavedAt?: number
}

// ─── 5. Event Cluster Model (Agregasi Konservatif) ───

export interface EventClusterSourceCoverage {
  publicationCount: number
  identifiedPublisherCount: number               // Backward-compatible alias
  distinctPublisherDomainCount: number           // Nama semantik eksplisit (domain unik, BUKAN klaim independen)
  publishers: string[]
  isIndependentCoverageClaimed: boolean          // Selalu false (butuh verifikasi sindikasi independen)
}

export interface CandidateClusterMember {
  itemId: string
  title: string
  candidateReason: string
  ambiguityNotes: string
}

export interface EventCluster {
  id: string                     // Stable cluster identifier
  title: string                  // Judul representatif dari publikasi utama
  memberItemIds: string[]
  memberItems: NormalizedPublication[]
  attachedTrendSignals?: SearchTrendSignal[]     // Sinyal penelusuran Google terkait (TIDAK dihitung sbg publikasi)
  firstPublishedAt: number | null
  latestPublishedAt: number | null
  firstObservedAt: number
  latestObservedAt: number
  category: ThreatSpectrumCluster
  clusterConfidence: number      // 0 - 100: Keyakinan pengelompokan (BUKAN tingkat ancaman)
  clusterReviewStatus?: 'CONFIRMED' | 'AMBIGUOUS' | 'REVIEW_REQUIRED'
  candidateMembers?: CandidateClusterMember[]
  matchReasons: string[]
  sourceCoverage: EventClusterSourceCoverage
  leadItem: NormalizedPublication
  reviewState: RadarReviewState
  freshness: FreshnessAssessment
  contextRelevance: ContextRelevanceAssessment
}

// ─── 6. Pipeline Execution Result ───

export interface RadarPipelineResult {
  clusters: EventCluster[]
  rawItems: NormalizedPublication[]
  connectorHealth: Record<string, ConnectorHealth>
  isLive: boolean
  isStale: boolean
  fetchedAt: number
  latencyMs: number
  errorMessage?: string
}

// ─── 7. Claim vs Publication Semantic Firewall Types (Sprint 1C) ───

export type ClaimMatchStatus =
  | 'FACT_CHECK_REFERENCE_FOUND'
  | 'CLAIM_MATCH_REVIEW_REQUIRED'
  | 'CLAIM_VERDICT_SUPPORTED_BY_FACT_CHECK'
  | 'CLAIM_NOT_MATCHED'
  | 'INSUFFICIENT_CONTEXT'

export type PublicationReportingStance =
  | 'DEBUNKING_HOAX'      // Artikel secara eksplisit membantah / meluruskan hoaks
  | 'REPORTING_CIVIL'     // Artikel berita umum yang melaporkan peristiwa / isu
  | 'QUOTING_CLAIM'       // Artikel mengutip klaim kontroversial tanpa mendukungnya
  | 'ALLEGED_ASSERTION'   // Artikel tampak menegaskan klaim (perlu telaah analis)
  | 'UNASSESSED'

export interface FactCheckReference {
  referenceId: string
  referenceSource: string
  referenceUrl: string
  claimReviewed: string
  verdict: 'HOAKS' | 'DISINFORMASI' | 'PROPAGANDA' | 'FAKTA' | 'UNVERIFIED'
  reviewedAt: number | null
  reviewedDateFormatted?: string
}

export interface ClaimMatchCandidate {
  claimText: string
  matchStatus: ClaimMatchStatus
  stance: PublicationReportingStance
  matchedReference?: FactCheckReference
  similarityScore: number
  matchExplanation: string
  requiresAnalystReview: boolean
}


