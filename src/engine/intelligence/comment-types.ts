/**
 * ════════════════════════════════════════════════════════════════════════════════════
 * NARADA — COMMENT INTELLIGENCE & COGNITIVE SENTIMENT ANALYSIS TYPES
 * SPRINT 8: WORK PACKAGE 1 (DATA CONTRACTS & INTERFACES)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ════════════════════════════════════════════════════════════════════════════════════
 */

export type CommentIntakeMethod = 
  | 'MANUAL_ENTRY'
  | 'LOCAL_FILE_IMPORT'
  | 'EXISTING_CASE_EVIDENCE'

export type CommentValidationState =
  | 'VALID'
  | 'TRUNCATED'
  | 'MALFORMED'
  | 'EMPTY'
  | 'EXCLUDED'

export type SentimentTaxonomy =
  | 'POSITIVE'
  | 'NEGATIVE'
  | 'NEUTRAL'
  | 'UNCERTAIN'
  | 'MIXED'

export type ConfidenceBand =
  | 'HIGH'
  | 'MODERATE'
  | 'LOW'
  | 'INSUFFICIENT'

export type CoordinationIndicatorTaxonomy =
  | 'NO_CLEAR_PATTERN'
  | 'WEAK_PATTERN'
  | 'PATTERN_WARRANTS_REVIEW'
  | 'INSUFFICIENT_DATA'

export type HumanReviewStatus =
  | 'UNREVIEWED'
  | 'CONFIRMED_SIGNAL'
  | 'DISMISSED'
  | 'NEEDS_CONTEXT'

export type SignalFamilyType =
  | 'REPEATED_TEXT'
  | 'TEMPORAL_CONCENTRATION'
  | 'REPEATED_URLS'
  | 'REPEATED_HASHTAGS'
  | 'RAPID_AUTHOR_RECURRENCE'
  | 'CROSS_SOURCE_RECURRENCE'

/**
 * Entitas 1: Comment Record
 * Mewakili satu komentar yang diimpor atau dimasukkan oleh analis
 */
export interface CommentRecord {
  id: string
  batchId: string
  caseId: string
  rawText: string
  normalizedText: string
  sourceUrl?: string
  sourceLabel?: string
  authorHandle?: string
  rawTimestamp?: string
  parsedTimestamp?: string // ISO 8601 dengan offset eksplisit
  timezoneOffset?: string
  isTimestampAmbiguous: boolean
  validationState: CommentValidationState
  exclusionReason?: string
  contentDigest: string // SHA-256 raw text
  characterCount: number
  tokenCount: number
  metadata?: Record<string, unknown>
}

/**
 * Entitas 2: Comment Sample Batch
 * Koleksi terikat kasus dari komentar yang diimpor
 */
export interface CommentBatch {
  id: string
  caseId: string
  batchLabel: string
  intakeMethod: CommentIntakeMethod
  originalFileName?: string
  sourceLabel?: string
  sourceDomain?: string
  sourceUrl?: string
  createdAt: string
  totalRecordsCount: number
  acceptedRecordsCount: number
  rejectedRecordsCount: number
  exactDuplicatesCount: number
  validationSummary: {
    missingTimestamps: number
    ambiguousTimestamps: number
    missingAuthors: number
    missingSources: number
    overlengthComments: number
    emptyComments: number
  }
  schemaVersion: number
  canonicalManifestSha256?: string
  status: 'ACTIVE' | 'ARCHIVED'
}

/**
 * Penjelasan Sinyal Sentimen Terinspeksi
 */
export interface SentimentExplanation {
  matchedPositiveTerms: string[]
  matchedNegativeTerms: string[]
  negationDetected: boolean
  negationContext?: string[]
  intensifiersDetected: string[]
  diminishersDetected: string[]
  contrastDetected: boolean
  contrastContext?: string
  sarcasmSuspected: boolean
  sarcasmReason?: string
  uncertaintyReason?: string
  algorithmVersion: string
}

/**
 * Hasil Estimasi Sentimen Per-Komentar
 */
export interface CommentSentimentResult {
  commentId: string
  sentiment: SentimentTaxonomy
  polarityScore: number // rentang -1.0 s/d +1.0
  confidence: ConfidenceBand
  confidenceScore: number // rentang 0.0 s/d 1.0
  explanation: SentimentExplanation
}

/**
 * Kelompok Kemiripan Teks (Copypasta / Near-Duplicate Cluster)
 */
export interface SimilarityGroup {
  groupId: string
  groupType: 'EXACT_DUPLICATE' | 'NEAR_DUPLICATE' | 'TEMPLATE_PATTERN'
  representativeText: string
  memberCount: number
  memberCommentIds: string[]
  averageSimilarityScore: number
  isShortGenericPhrase: boolean
  tokenLength: number
}

/**
 * Hasil Analisis Temporal Burst
 */
export interface BurstWindowResult {
  windowDuration: '5m' | '15m' | '1h' | '6h'
  windowStart: string
  windowEnd: string
  observedCount: number
  baselineRate: number
  concentrationRatio: number
  isBurst: boolean
  commentIdsInWindow: string[]
}

export interface BurstAnalysisSummary {
  eligibleRecordsCount: number
  timestampedRecordsCount: number
  ambiguousTimestampsCount: number
  invalidTimestampsCount: number
  timestampCoverageRatio: number
  status: 'ANALYZED' | 'INSUFFICIENT_DATA'
  detectedBursts: BurstWindowResult[]
  explanation: string
}

/**
 * Indikator Pola Koordinasi
 */
export interface CoordinationIndicator {
  indicator: CoordinationIndicatorTaxonomy
  confidence: ConfidenceBand
  triggeredFamilies: SignalFamilyType[]
  involvedCommentIds: string[]
  involvedSimilarityGroupIds: string[]
  sourceDiversityScore: number // rentang 0.0 - 1.0
  uniquePublishersCount: number
  temporalConcentrationRatio: number
  alternativeExplanations: string[]
  safeguardDisclosures: string[]
  summaryRationale: string
}

/**
 * Cakupan & Kepercayaan Multi-Dimensi (Section 12)
 */
export interface AnalysisCoverage {
  sentiment: {
    eligibleCount: number
    analyzedCount: number
    uncertainCount: number
    excludedCount: number
    coverageRatio: number
  }
  similarity: {
    eligibleCount: number
    excludedShortPhrasesCount: number
    exactDuplicateGroupsCount: number
    nearDuplicateGroupsCount: number
    coverageRatio: number
  }
  burst: {
    eligibleCount: number
    timestampedCount: number
    ambiguousCount: number
    invalidCount: number
    timestampCoverageRatio: number
  }
  coordination: {
    availableSignalsCount: number
    observedSignalsCount: number
    sourceDiversityRatio: number
    authorCoverageRatio: number
    sampleSize: number
  }
}

/**
 * Konfigurasi Analisis yang Tersimpan (Dapat Direproduksi)
 */
export interface CommentAnalysisConfig {
  similarityThreshold: number // default: 0.75
  minClusterSize: number // default: 2
  minSubstantiveTokens: number // default: 4 (mengecualikan 'setuju', 'amin')
  burstWindows: Array<'5m' | '15m' | '1h' | '6h'>
  burstThresholdRatio: number // default: 2.5
  algorithmVersion: string
}

/**
 * Entitas 3: Analysis Run (Immutable Snapshot)
 */
export interface CommentAnalysisRun {
  id: string
  caseId: string
  batchId: string
  createdAt: string
  algorithmVersion: string
  config: CommentAnalysisConfig
  inputCount: number
  analyzedCount: number
  excludedCount: number
  duplicateCount: number
  coverage: AnalysisCoverage
  sentimentSummary: {
    positiveCount: number
    negativeCount: number
    neutralCount: number
    uncertainCount: number
    mixedCount: number
    positiveRatio: number
    negativeRatio: number
    neutralRatio: number
    uncertainRatio: number
    mixedRatio: number
    confidenceSummary: Record<ConfidenceBand, number>
  }
  sentimentResults: CommentSentimentResult[]
  similarityGroups: SimilarityGroup[]
  burstAnalysis: BurstAnalysisSummary
  coordinationIndicator: CoordinationIndicator
  warnings: string[]
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED'
}

/**
 * Entitas 4: Review Annotation
 * Keputusan dan catatan review dari analis manusia
 */
export interface CommentReviewAnnotation {
  id: string
  caseId: string
  runId: string
  targetType: 'COMMENT' | 'SIMILARITY_GROUP' | 'BURST_WINDOW' | 'COORDINATION_SIGNAL'
  targetId: string
  reviewStatus: HumanReviewStatus
  reviewerNote: string
  reviewedAt: string
  reviewerId?: string
}

/**
 * Hasil Preview Intake Sebelum Dikonfirmasi
 */
export interface IntakePreviewResult {
  intakeMethod: CommentIntakeMethod
  totalRawRecords: number
  acceptedRecords: CommentRecord[]
  rejectedRecords: Array<{
    lineIndex: number
    rawText: string
    reason: string
  }>
  exactDuplicateCount: number
  missingTimestampsCount: number
  ambiguousTimestampsCount: number
  missingAuthorsCount: number
  missingSourcesCount: number
  totalBytes: number
  totalCharacters: number
  warnings: string[]
  canProceed: boolean
}
