/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — INTELLIGENCE CORE & CLAIM ASSESSMENT DOMAIN CONTRACTS
 * SPRINT 09: WP-01 (INTELLIGENCE DOMAIN MODEL AND DATA CONTRACTS)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Prinsip Desain:
 * 1. Single Responsibility: Memisahkan Artikel, Penerbit, Klaim, Bukti, dan Asesmen.
 * 2. Evidence Before Verdict: Kebenaran dinilai berdasarkan bukti independen,
 *    bukan dari sentimen, kata kunci sensasional, atau jumlah artikel semata.
 * 3. Traceable Provenance: Setiap klaim dan bukti dapat dilacak ke sumber asalnya.
 * 4. Honest Unknowns: Ketidakcukupan data dinyatakan secara eksplisit.
 * ══════════════════════════════════════════════════════════════════════════
 */

// ─── 1. VERSI MESIN INTELIJEN ───
export const RELEVANCE_ENGINE_VERSION = '1.0.0'
export const CLAIM_EXTRACTION_ENGINE_VERSION = '1.0.0'
export const EVIDENCE_CORRELATION_ENGINE_VERSION = '1.0.0'
export const CLAIM_ASSESSMENT_ENGINE_VERSION = '1.0.0'

// ─── 2. RELEVANSI DOMAIN KONTEN (WP-02) ───
export type RelevanceCategory = 'RELEVANT' | 'IRRELEVANT' | 'UNCERTAIN'

export interface RelevanceEvaluationResult {
  category: RelevanceCategory
  score: number // 0-100 Heuristik Relevansi Pantauan (BUKAN probabilitas kebenaran / ancaman)
  matchedDomain?: string
  matchedEntities: string[]
  matchedContextTerms: string[]
  rejectionReasons: string[]
  acceptanceReasons: string[]
  contentCoverage: 'FULL_TEXT' | 'TITLE_AND_SNIPPET' | 'TITLE_ONLY' | 'METADATA_ONLY'
  isAmbiguous: boolean
  engineVersion: string
}

// ─── 3. MODEL PENERBIT & IDENTITAS DOMAIN (WP-04) ───
export type PublisherType =
  | 'NEWS_AGENCY'            // Kantor Berita Resmi (e.g. ANTARA, Reuters)
  | 'MAINSTREAM_PRESS'       // Media Pers Nasional Terverifikasi (Dewan Pers)
  | 'COMMUNITY_MEDIA'        // Media Komunitas / Alternatif
  | 'OFFICIAL_GOVERNMENT'    // Lembaga Pemerintah / Kedinasan (e.g. Dispenad, BMKG, BSSN)
  | 'FACT_CHECKER'           // Lembaga Verifikasi Fakta Terakreditasi (MAFINDO, dsb.)
  | 'AGGREGATOR'             // Mesin Agregator Indeks (Google News, GDELT)
  | 'UNKNOWN'

export type IdentityVerificationStatus = 'VERIFIED' | 'PROVISIONAL' | 'UNVERIFIED'

export interface PublisherProfile {
  id: string                   // e.g. 'PUB-antaranews-com'
  displayName: string          // e.g. 'LKBN ANTARA'
  primaryDomain: string        // e.g. 'antaranews.com'
  registrableDomain: string    // Canonical root domain via PSL (e.g. 'antaranews.com')
  verifiedAliases: string[]
  organizationId?: string      // ID organisasi induk jika terverifikasi (e.g. 'ORG-MNC', 'ORG-KOMPAS-GRAMEDIA')
  ownership?: string
  publisherType: PublisherType
  identityVerificationStatus: IdentityVerificationStatus
  sourceProvenance: string     // URL atau rujukan pertama
  isAggregator: boolean        // True jika Google News, GDELT, dsb.
  createdAt: string
  updatedAt: string
}

// ─── 4. MODEL ARTIKEL KANONIKAL (WP-01) ───
export interface ArticleRecord {
  id: string                   // PUB-xxxx kanonikal
  canonicalUrl: string
  originalUrl: string
  title: string
  description: string
  content?: string             // Teks lengkap jika tersedia secara legal & teknis
  publisherId: string          // Mengacu ke PublisherProfile.id
  publisherName: string
  registrableDomain: string
  sourceConnectorId: string    // e.g. 'src-antara-latest', 'src-gnews-hankam'
  publishedAt: number | null   // Waktu rilis resmi sumber (null jika tidak valid)
  firstObservedAt: number      // Waktu pertama kali diobservasi NARADA
  lastObservedAt: number
  acquiredAt: number
  contentHash: string          // SHA-256 konten normal
  language: string             // e.g. 'id'
  location?: string
  acquisitionMethod: 'RSS_POLL' | 'DYNAMIC_SEARCH' | 'MANUAL_IMPORT' | 'ARCHIVE_SEED'
  provenanceReferences: string[]
  metadataCompleteness: number // 0-100
  contentAvailabilityState: 'FULL_TEXT' | 'TITLE_AND_SNIPPET' | 'TITLE_ONLY' | 'METADATA_ONLY'
  relevance?: RelevanceEvaluationResult
  isDuplicateOf?: string       // ID artikel sumber asli jika tersindikasi
  syndicationGroupId?: string
}

// ─── 5. MODEL KLAIM FAKTUAL (WP-03) ───
export type ClaimType =
  | 'FACTUAL_ASSERTION'        // Klaim kejadian/fakta yang dapat diverifikasi secara objektif
  | 'OPINION'                  // Opini/penafsiran subjektif
  | 'PREDICTION'               // Prediksi kejadian masa depan
  | 'QUESTION'                 // Pertanyaan atau spekulasi retoris
  | 'QUOTATION'                // Kutipan pernyataan pihak tertentu (speech report)
  | 'SATIRE_OR_HYPOTHETICAL'   // Konten satir, fiksi, atau hipotesis
  | 'AMBIGUOUS'                // Pernyataan tidak jelas / konteks terputus
  | 'UNKNOWN'

export type ClaimModality =
  | 'ASSERTED'                 // Dinyatakan sebagai fakta langsung
  | 'REPORTED'                 // Dilaporkan sebagai pernyataan orang lain
  | 'DENIED'                   // Dilaporkan sebagai bantahan / sanggahan resmi
  | 'HYPOTHETICAL'             // Bersifat kemungkinan atau syarat

export type ClaimExtractionMethod =
  | 'RULE_BASED'
  | 'PATTERN_MATCH'
  | 'LINGUISTIC_HEURISTIC'
  | 'MANUAL'
  | 'SYNTHETIC_BENCHMARK'

export interface ClaimRecord {
  id: string                   // e.g. 'CLM-1730000000-xxxx'
  sourceArticleId: string      // Mengacu ke ArticleRecord.id
  originalText: string         // Teks klaim mentah yang ditemukan
  normalizedText: string       // Teks klaim dinormalisasi
  language: string
  claimType: ClaimType
  modality: ClaimModality
  polarity: 'AFFIRMATIVE' | 'NEGATIVE'
  attributedSpeaker?: string   // Pihak yang dikutip jika modalitasnya REPORTED/DENIED
  subject?: string
  predicate?: string
  object?: string
  entities: string[]
  eventLocation?: string
  eventTime?: string           // Rentang waktu spesifik peristiwa
  extractionMethod: ClaimExtractionMethod
  extractionConfidence: 'HIGH' | 'MEDIUM' | 'LOW'
  sourceTextSpan?: string      // Potongan kalimat asli dalam artikel
  isLimitedContext: boolean    // True jika diekstrak dari judul saja
  reviewStatus: 'DRAFT' | 'UNDER_REVIEW' | 'CONFIRMED' | 'REJECTED'
  limitations: string[]
  createdAt: string
  updatedAt: string
}

// ─── 6. MODEL RELASI BUKTI TERHADAP KLAIM (WP-04) ───
export type EvidenceRelationType =
  | 'SUPPORTS'                 // Bukti secara langsung mendukung klaim
  | 'CONTRADICTS'              // Bukti secara langsung membantah klaim
  | 'CONTEXTUALIZES'           // Bukti memberi latar belakang tanpa mengonfirmasi/membantah
  | 'MENTIONS'                 // Bukti sekadar menyebutkan topik yang sama
  | 'UNKNOWN'

export type EvidenceDirectness =
  | 'PRIMARY_SOURCE'           // Rilis resmi lembaga terkait, dokumen primer, foto berstempel
  | 'DIRECT_STATEMENT'         // Pernyataan langsung juru bicara / otoritas berwenang
  | 'INDEPENDENT_REPORT'       // Liputan investigasi independen dari media kredibel
  | 'SECONDARY_REPORT'         // Laporan sekunder mengutip sumber lain
  | 'DERIVED_OR_SYNDICATED'    // Duplikasi rilis pers / berita kawat
  | 'USER_SUPPLIED'            // Unggahan komunitas pengguna yang belum diaudit
  | 'UNKNOWN'

export interface ClaimEvidenceItem {
  id: string                   // e.g. 'EVD-CLM-xxxx'
  claimId: string              // Mengacu ke ClaimRecord.id
  articleId?: string           // Mengacu ke ArticleRecord.id jika berasal dari artikel
  externalSourceReference?: string
  sourcePublisherId: string    // Mengacu ke PublisherProfile.id
  sourcePublisherName: string
  registrableDomain: string
  evidenceRelation: EvidenceRelationType
  directness: EvidenceDirectness
  quotedText: string           // Kutipan bukti spesifik
  sourceLocationOrSpan?: string
  independenceGroupId: string  // Grup sindikasi (media yang menduplikasi rilis pers berada di grup sama)
  acquisitionTimestamp: number
  sourcePublishedAt: number | null
  relationDetectionMethod: string
  reviewState: 'PROVISIONAL' | 'ANALYST_VERIFIED' | 'DISPUTED'
  rationale: string
  limitations: string[]
  createdAt: string
}

// ─── 7. MODEL ASESMEN KLAIM BERBASIS BUKTI (WP-05) ───
export type ClaimAssessmentVerdict =
  | 'SUPPORTED_BY_EVIDENCE'    // DIDUKUNG BUKTI
  | 'CONTRADICTED_BY_EVIDENCE' // BERTENTANGAN DENGAN BUKTI
  | 'UNVERIFIED'               // BELUM TERVERIFIKASI
  | 'INSUFFICIENT_EVIDENCE'    // BUKTI TIDAK CUKUP
  | 'CONFLICTING_EVIDENCE'     // BUKTI SALING BERTENTANGAN
  | 'NOT_ASSESSABLE'           // TIDAK DAPAT DINILAI (Opini, pertanyaan, satir)

export const VERDICT_INDONESIAN_LABELS: Record<ClaimAssessmentVerdict, string> = {
  SUPPORTED_BY_EVIDENCE: 'DIDUKUNG BUKTI',
  CONTRADICTED_BY_EVIDENCE: 'BERTENTANGAN DENGAN BUKTI',
  UNVERIFIED: 'BELUM TERVERIFIKASI',
  INSUFFICIENT_EVIDENCE: 'BUKTI TIDAK CUKUP',
  CONFLICTING_EVIDENCE: 'BUKTI SALING BERTENTANGAN',
  NOT_ASSESSABLE: 'TIDAK DAPAT DINILAI'
}

export interface EvidenceCoverageMetrics {
  totalEvidence: number
  supportingCount: number
  contradictingCount: number
  contextualCount: number
  independentPublisherCount: number
  independentEvidenceCount: number
  hasPrimarySource: boolean
  temporalConsistency: boolean
  geographicalConsistency: boolean
  isSufficient: boolean
}

export interface ClaimAssessmentReason {
  code: string
  message: string
}

export interface ClaimAssessmentRecord {
  id: string                   // e.g. 'ASM-xxxx'
  claimId: string
  verdict: ClaimAssessmentVerdict
  verdictLabelId: string       // Indonesian string dari VERDICT_INDONESIAN_LABELS
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' // Keandalan PROSES asesmen (BUKAN probabilitas kebenaran klaim)
  evidenceCoverage: EvidenceCoverageMetrics
  supportingEvidenceIds: string[]
  contradictingEvidenceIds: string[]
  contextualEvidenceIds: string[]
  summary: string              // Ringkasan transparansi "Why NARADA Thinks So"
  reasons: ClaimAssessmentReason[]
  limitations: string[]
  requiresHumanReview: boolean
  humanReviewReason?: string
  assessmentMethod: string
  engineVersion: string
  assessedAt: string           // ISO-8601
  updatedAt: string
}

// ─── 8. KONTRAK EXPLAINABILITY OUTPUT ───
export interface ClaimExplanation {
  claimId: string
  verdict: ClaimAssessmentVerdict
  verdictLabel: string
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW'
  summary: string
  reasons: ClaimAssessmentReason[]
  evidenceSummary: {
    totalEvidence: number
    independentPublishers: number
    supportingItems: { source: string; snippet: string; directness: EvidenceDirectness }[]
    contradictingItems: { source: string; snippet: string; directness: EvidenceDirectness }[]
    contextualItems: { source: string; snippet: string }[]
  }
  limitations: string[]
  reviewRecommendation: 'AUTOMATED_DECISION_SUFFICIENT' | 'HUMAN_SUPERVISION_RECOMMENDED' | 'MANDATORY_HUMAN_REVIEW'
  engineVersion: string
}
