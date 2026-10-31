/**
 * ════════════════════════════════════════════════════════════════════════════════════
 * NARADA — CONTROLLED INVESTIGATION WORKBENCH & EVIDENCE INTELLIGENCE ENGINE
 * SPRINT 2: DATA CONTRACTS, ENTITY SCHEMAS & TYPE DEFINITIONS
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ════════════════════════════════════════════════════════════════════════════════════
 * 
 * Prinsip Desain:
 * - Data Integrity > Functionality > Readability > Decoration.
 * - Local-First & Privacy-Preserving (Minimisasi data, zero cloud upload).
 * - Honest Scientific Reporting: Menghilangkan skor komposit tidak tervalidasi,
 *   menggunakan profil kemiripan deskriptif (NEAR_DUPLICATE, HIGH_SIMILARITY, DISTINCT).
 * - Strict Timestamp Provenance: Memisahkan waktu sumber, waktu masukan analis, dan benchmark.
 * - Claim vs Publication Firewall: Penilaian diarahkan pada klaim atomik spesifik.
 * ════════════════════════════════════════════════════════════════════════════════════
 */

import type { ThreatSpectrumCluster } from '../../types'

// ─── Gate 0.1: Mode Bukti & Stempel Waktu ───
export type EvidenceMode = 'LIVE_REFERENCE' | 'USER_SUBMITTED' | 'SYNTHETIC_BENCHMARK'

export type TimestampProvenance =
  | 'SOURCE_REPORTED_TIMESTAMP'       // Waktu publikasi asli dari sumber terverifikasi
  | 'OPERATOR_SUPPLIED_UNVERIFIED'    // Waktu yang diinput analis (belum terverifikasi independen)
  | 'SYNTHETIC_BENCHMARK_TIMESTAMP'   // Waktu sintetis dalam dataset simulasi benchmark
  | 'NO_SOURCE_TIMESTAMP'             // Tidak ada timestamp sumber yang tersedia

export type TemporalAvailability =
  | 'AVAILABLE'
  | 'NOT_AVAILABLE_NO_SOURCE_TIMESTAMP'
  | 'NOT_AVAILABLE_INSUFFICIENT_SAMPLE'
  | 'MIXED_PROVENANCE_REVIEW_REQUIRED'
  | 'SYNTHETIC_BENCHMARK_ONLY'

// ─── Status Bukti & Verifikasi ───
export type EvidenceVerificationStatus = 'UNVERIFIED' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED'

export type EvidenceType =
  | 'NEWS_PUBLICATION_REFERENCE'
  | 'FACT_CHECK_REFERENCE'
  | 'PUBLIC_POST_TEXT'
  | 'PUBLIC_COMMENT_DATASET'
  | 'SCREENSHOT'
  | 'DOCUMENT'
  | 'OPERATOR_NOTE'
  | 'OTHER_SUPPORTED_INPUT'

export type ExtractionMethod =
  | 'MANUAL_TEXT'
  | 'OCR'
  | 'PDF_TEXT'
  | 'CSV_IMPORT'
  | 'JSON_IMPORT'
  | 'ALLOWED_SOURCE_FETCH'
  | 'URL_REFERENCE_ONLY'

export type DigestScope =
  | 'ORIGINAL_FILE_BYTES'
  | 'NORMALIZED_TEXT_UTF8'
  | 'INPUT_TEXT_UTF8'

// ─── Gate 0.2: Profil Kemiripan Naratif (Descriptive, Non-Attributive) ───
export type NarrativeSimilarityClass = 'NEAR_DUPLICATE' | 'HIGH_SIMILARITY' | 'DISTINCT'

export interface NarrativeSimilarityProfile {
  totalAnalyzedRecords: number
  totalPairsCompared: number
  nearDuplicateCount: number
  nearDuplicatePercent: number // (nearDuplicateCount / totalAnalyzedRecords) * 100
  highSimilarityCount: number
  highSimilarityPercent: number
  distinctCount: number
  distinctPercent: number
  excludedRecordsCount: number
  exclusionReason?: string
  method: string // e.g. 'Jaccard N-Gram Heuristic (thresholds: 0.65, 0.45)'
  isSampleSufficient: boolean
  sampleSufficiencyState: 'SUFFICIENT' | 'INSUFFICIENT_SAMPLE' | 'NOT_EVALUATED'
  limitations: string[]
}

// ─── Gate 0.5: Format Berkas & Validasi Ingestion ───
export type SupportedFileType = 'TXT' | 'CSV' | 'JSON' | 'PNG' | 'JPEG' | 'WEBP' | 'PDF'

export interface FileIngestValidationResult {
  isValid: boolean
  detectedType?: SupportedFileType
  fileSizeBytes: number
  mimeType: string
  originalByteSha256?: string
  errorMessage?: string
  errorCode?:
    | 'FILE_TOO_LARGE'
    | 'UNSUPPORTED_TYPE'
    | 'CORRUPTED_FILE'
    | 'MAGIC_BYTE_MISMATCH'
    | 'EMPTY_FILE'
    | 'EXECUTABLE_REJECTED'
}

// ─── D5: Status & Relasi Klaim ───
export type ClaimAssessmentStatus =
  | 'SUPPORTED'
  | 'CONTRADICTED'
  | 'MIXED'
  | 'UNVERIFIED'
  | 'INCONCLUSIVE'

export type EvidenceRelationType =
  | 'SUPPORTS'
  | 'CONTRADICTS'
  | 'CONTEXTUALIZES'
  | 'REFERENCES'
  | 'DUPLICATES_OR_NEAR_DUPLICATES'
  | 'MENTIONS'

// ─── D2: Status Kasus Investigasi ───
export type CaseStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'IN_REVIEW'
  | 'CONCLUDED'
  | 'NEEDS_MORE_EVIDENCE'
  | 'REVIEWED'
  | 'ARCHIVED'

// ─── Model Entitas Utama (Sprint 2 Core Entities) ───

/**
 * 1. InvestigationCase: Konteks utama yang mengikat klaster peristiwa, publikasi, dan analisis.
 */
export interface InvestigationCase {
  id: string
  caseNumber: string // e.g. 'NAR-2026-0001'
  title: string
  summary: string
  status: CaseStatus
  mode: EvidenceMode
  cluster?: ThreatSpectrumCluster
  linkedEventClusterIds: string[]
  linkedPublicationIds: string[]
  linkedSearchTrendSignalIds: string[] // Tren hanya konteks atensi pencarian, bukan bukti
  createdAt: string // ISO-8601
  updatedAt: string // ISO-8601
  firstObservedAt?: string
  createdByLocalOperator: string
  tags: string[]
  limitations: string[]
  isSimulation?: boolean
  simulationWatermark?: string
}

/**
 * 2. EvidenceRecord: Rekaman bukti digital lokal dengan provenance lengkap dan hash digest.
 */
export interface EvidenceRecord {
  id: string
  caseId: string
  evidenceType: EvidenceType
  evidenceMode: EvidenceMode
  sourceLabel: string
  sourceUrl?: string
  sourcePublishedAt?: string
  sourceTimestampProvenance: TimestampProvenance
  observedAt?: string
  retrievedAt?: string
  submittedAt: string
  extractionMethod: ExtractionMethod
  extractedText: string
  normalizedText?: string
  redactedText: string
  contentHashOriginal?: string
  contentHashNormalized: string
  hashes?: { digestScope: DigestScope; digest: string }[]
  hashDisclaimer?: string
  hashAlgorithm: 'SHA-256'
  digestScope: DigestScope
  originalRetained: boolean
  privacyRedactionStatus: 'AUTOMATIC_REDACTED' | 'MANUAL_REVIEWED' | 'NOT_APPLICABLE'
  verificationStatus: EvidenceVerificationStatus
  metadata?: Record<string, unknown>
  limitations: string[]
  createdAt: string
  updatedAt: string
}

/**
 * 3. ClaimRecord: Klaim atomik yang diekstraksi dari bahan bukti atau dimasukkan analis.
 */
export interface ClaimRecord {
  id: string
  caseId: string
  claimText: string
  normalizedClaimText: string
  extractedFromEvidenceIds: string[]
  extractionMethod: 'MANUAL' | 'RULE_BASED' | 'EXISTING_LOCAL_MODEL'
  extractionConfidence?: number // Hanya jika diproduksi dan terkalibrasi
  status: 'DRAFT' | 'UNDER_REVIEW' | 'REVIEWED'
  createdAt: string
  updatedAt: string
  limitations: string[]
}

/**
 * 4. EvidenceRelation: Tautan relasi terarah antara Evidence dan Claim.
 */
export interface EvidenceRelation {
  id: string
  caseId: string
  claimId: string
  evidenceId: string
  relationType: EvidenceRelationType
  rationale: string
  createdBy: string
  createdAt: string
  reviewStatus: 'PROPOSED' | 'CONFIRMED' | 'REJECTED'
}

/**
 * 5. AssessmentRecord: Keputusan penelaahan pada tingkat klaim ber-ID bukti & jejak audit.
 */
export interface AssessmentRecord {
  id: string
  caseId: string
  claimId: string
  verdict: ClaimAssessmentStatus
  status?: ClaimAssessmentStatus // Alias
  confidence?: 'HIGH' | 'MODERATE' | 'LOW'
  rationale: string
  supportingEvidenceIds: string[]
  contradictingEvidenceIds: string[]
  contextualEvidenceIds: string[]
  assessedBy: string
  evaluatedBy?: string // Alias
  assessedAt: string
  evaluatedAt?: string // Alias
  previousVerdict?: ClaimAssessmentStatus
  reviewState: 'ANALYST_DRAFT' | 'SUPERVISOR_VERIFIED' | 'ARCHIVED_ASSESSMENT'
  limitations: string[]
}

/**
 * 6. AuditEvent: Rekaman kronologis append-only dari semua aksi operator dan sistem.
 */
export type AuditEventType =
  | 'CASE_CREATED'
  | 'CASE_UPDATED'
  | 'CASE_DELETED'
  | 'CASE_REOPENED'
  | 'CASE_ARCHIVED'
  | 'EVIDENCE_SUBMITTED'
  | 'EVIDENCE_REDACTED'
  | 'EVIDENCE_VERIFICATION_CHANGED'
  | 'EVIDENCE_DELETED'
  | 'CLAIM_CREATED'
  | 'CLAIM_UPDATED'
  | 'RELATION_CREATED'
  | 'RELATION_UPDATED'
  | 'ASSESSMENT_REVIEWED'
  | 'DRAFT_CREATED'
  | 'DRAFT_STATUS_UPDATED'

export interface AuditEvent {
  eventId: string
  caseId: string
  entityType: 'CASE' | 'EVIDENCE' | 'CLAIM' | 'RELATION' | 'ASSESSMENT' | 'DRAFT'
  entityId: string
  eventType: AuditEventType
  action?: AuditEventType
  timestamp: string // ISO-8601
  operatorLabel: string
  actor?: string // Alias kompatibilitas
  previousState?: string // Safe summary
  newState?: string      // Safe summary
  rationale?: string
  relatedEvidenceIds?: string[]
  schemaVersion?: string // Schema version, e.g. '1.0.0'
}

/**
 * 7. TemporalAnalysisResult: Hasil analisis temporal yang mematuhi provenance stempel waktu.
 */
export interface TemporalAnalysisResult {
  availability: TemporalAvailability
  status?: string // Alias kompatibilitas pengujian ('VALID_INTERVALS', 'NOT_AVAILABLE_NO_TIMESTAMPS')
  validTimestampCount: number
  recordCountWithTimestamp?: number // Alias
  totalSampleCount: number
  sourceTimestampCoveragePercent: number
  earliestTimestampIso: string | null
  latestTimestampIso: string | null
  averageIntervalSeconds: number | null
  burstVelocityPerMinute: number | null
  provenanceBreakdown: Record<TimestampProvenance, number> & {
    sourceReported?: number
    operatorSupplied?: number
    syntheticBenchmark?: number
    noSource?: number
  }
  limitations: string[]
}

/**
 * 8. WhyNaradaThinksSoExplanation: Kontrak penjelasan transparan hasil asesmen intelijen.
 */
export interface WhyNaradaThinksSoExplanation {
  assessmentId: string
  caseId: string
  claimText: string
  currentStatus: ClaimAssessmentStatus
  conclusionSummary: string
  summary: string // Alias kompatibilitas
  supportingEvidenceIds: string[]
  contradictingEvidenceIds: string[]
  contextualEvidenceIds: string[]
  groundedEvidence: Array<{ evidenceId: string; role: string; source: string; textSnippet: string }>
  methodologicalCaveats: string[]
  alternativeInterpretations: string[]
  methodUsed: string
  rationale: string
  assumptions: string[]
  missingInformation: string[]
  dataQualityLimitations: string[]
  timestampCoverage: string
  sampleSizeDenominator: string
  analystReviewStatus: string
  generatedAt: string
  reviewedAt?: string
}

/**
 * Graph Relationship Node & Edge Types (Sprint 2 - Package D6.E)
 */
export type GraphNodeType =
  | 'EVENT'
  | 'CLAIM'
  | 'EVIDENCE'
  | 'PUBLICATION'
  | 'FACT_CHECK_REFERENCE'
  | 'SEARCH_TREND_SIGNAL'

export interface GraphNode {
  id: string
  label: string
  type: GraphNodeType
  subLabel?: string
  status?: string
}

export type GraphEdgeType =
  | 'SUPPORTS'
  | 'CONTRADICTS'
  | 'CONTEXTUALIZES'
  | 'REFERENCES'
  | 'DUPLICATES_OR_NEAR_DUPLICATES'
  | 'MENTIONS'
  | 'SIMILAR_TO'
  | 'PUBLISHED_AFTER'
  | 'ATTACHED_TREND_CONTEXT'

export interface GraphEdge {
  id: string
  source: string
  target: string
  type: GraphEdgeType
  label?: string
}

export interface NarrativeRelationshipGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// ════════════════════════════════════════════════════════════════════════════
// SPRINT 3: OPERATIONAL INTELLIGENCE, SCENARIO REPLAY & MISSION ROOM
// ════════════════════════════════════════════════════════════════════════════

// ─── P1: Case Readiness & Coverage Contracts ───

export type CaseReadinessStatus =
  | 'INCOMPLETE_RECORD'
  | 'EVIDENCE_REVIEW_REQUIRED'
  | 'CONFLICTS_UNRESOLVED'
  | 'READY_FOR_ANALYST_CONCLUSION'
  | 'CONCLUDED_BY_ANALYST'

export interface CoverageIndicator {
  label: string
  current: number
  total: number
  percentage: number
  status: 'COMPLETE' | 'ATTENTION' | 'PENDING'
  details?: string
}

export interface SuggestedNextAction {
  ruleId: string
  description: string
  ruleExplanation: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  targetEntityType?: 'CLAIM' | 'EVIDENCE' | 'CASE'
  targetEntityId?: string
}

export interface InvestigationCoverageSummary {
  caseId: string
  readinessStatus: CaseReadinessStatus
  readinessReason: string
  claimsTotal: number
  claimsReviewed: number
  claimsWithSupporting: number
  claimsWithContradicting: number
  claimsWithMixed: number
  claimsUnverified: number
  evidenceTotal: number
  evidenceByMode: Record<EvidenceMode, number>
  evidenceWithSourceUrl: number
  evidenceWithPublishedTime: number
  evidenceWithAcquisitionTime: number
  evidenceVerifiedDigestCount: number
  evidenceTamperWarningCount: number
  suggestedActions: SuggestedNextAction[]
  indicators: CoverageIndicator[]
  calculatedAt: string
}

// ─── P2: Public Response Generator & Human Review Lifecycle ───

export type ResponseChannelType =
  | 'INSTITUTIONAL_PRESS'
  | 'COMMUNITY_DIALOGUE'
  | 'SOCIAL_MEDIA_TACTICAL'
  | 'WHATSAPP_CIVILIAN'

export type ResponseDraftStatus =
  | 'GENERATED_DRAFT'
  | 'EDITED_DRAFT'
  | 'SUBMITTED_FOR_REVIEW'
  | 'APPROVED_BY_REVIEWER'
  | 'REJECTED_BY_REVIEWER'
  | 'SUPERSEDED'

export interface SentenceEvidenceMapping {
  sentenceIndex: number
  text: string
  supportingEvidenceIds: string[]
  sourceLabel?: string
}

export interface PublicResponseDraft {
  id: string
  caseId: string
  version: number
  channel: ResponseChannelType
  channelLabel: string
  title: string
  headerNotice: string // 'DRAFT — REQUIRES HUMAN REVIEW'
  content: string
  knownFactsSection: string
  unverifiedSection: string
  groundedSentences: SentenceEvidenceMapping[]
  referencedEvidenceIds: string[]
  referencedClaimIds: string[]
  status: ResponseDraftStatus
  generatedAt: string
  editedAt?: string
  reviewedAt?: string
  reviewerNote?: string
  reviewerActor?: string
  warningsAndLimitations: string[]
  isSimulation: boolean
  simulationWatermark?: string
}

// ─── P3: Scenario Replay Engine Contracts ───

export type ReplayMode = 'CASE_HISTORY_REPLAY' | 'SYNTHETIC_BENCHMARK_REPLAY'

export interface ReplayTimelineEvent {
  id: string
  eventId: string
  caseId: string
  eventType: string
  caseEventAt: string // Waktu aksi operasional lokal
  sourcePublishedAt?: string // Stempel waktu publikasi asli
  sourceObservedAt?: string // Waktu pertama kali ditangkap
  actorLabel: string
  entityType: 'CASE' | 'EVIDENCE' | 'CLAIM' | 'RELATION' | 'ASSESSMENT' | 'DRAFT' | 'REPORT'
  entityId: string
  title: string
  summary: string
  previousState?: string
  newState?: string
  referencedEvidenceIds?: string[]
  isSynthetic: boolean
}

export interface ScenarioReplaySession {
  sessionId: string
  caseId: string
  caseNumber: string
  mode: ReplayMode
  watermark?: string
  events: ReplayTimelineEvent[]
  totalEvents: number
  currentStepIndex: number
  playbackState: 'PAUSED' | 'PLAYING' | 'ENDED'
  playbackSpeed: 1 | 2 | 4
  eventFilter?: string
  builtAt: string
}

// ─── P5: Machine-Readable Evidence Manifest Contracts ───

export interface EvidenceManifestClaimEntry {
  id: string
  text: string
  verdict: ClaimAssessmentStatus
  limitations: string[]
}

export interface EvidenceManifestEvidenceEntry {
  id: string
  type: EvidenceType
  sourceLabel: string
  sourceTimestampProvenance: TimestampProvenance
  publishedAt?: string
  contentHashOriginal?: string
  contentHashNormalized: string
  hashAlgorithm: string
  digestScope: DigestScope
  limitations: string[]
}

export interface EvidenceManifestRelationEntry {
  id: string
  claimId: string
  evidenceId: string
  relationType: EvidenceRelationType
  rationale: string
}

export interface EvidenceManifest {
  manifestVersion: '1.0.0'
  exportCreatedAt: string
  caseId: string
  caseNumber: string
  title: string
  caseStatus: CaseStatus
  mode: EvidenceMode
  isSimulation: boolean
  simulationWatermark?: string
  claims: EvidenceManifestClaimEntry[]
  evidence: EvidenceManifestEvidenceEntry[]
  relations: EvidenceManifestRelationEntry[]
  auditSummary: {
    eventCount: number
    firstEventAt?: string
    lastEventAt?: string
  }
  narrativeSummary?: {
    analyzedRecords: number
    totalPairsCompared: number
    method: string
  }
  classificationLabel: string // 'DEMONSTRATION / UNCLASSIFIED — NARADA ANALYTICAL ASSESSMENT'
  limitations: string[]
  manifestDigestSha256?: string
}
