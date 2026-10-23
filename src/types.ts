// ─── NARADA UNIFIED TYPES DEFINITIONS ───
// Berdasarkan PRD_00 hingga PRD_06 & BLUEPRINT.md

export type ThreatLevel = 'low' | 'medium' | 'high' | 'critical'
export type ContentCategory = 'HOAKS' | 'PROPAGANDA' | 'BUZZER' | 'DISINFORMASI' | 'NETRAL'
export type InputSourceType = 'url' | 'ocr' | 'text' | 'file'

// ─── Input Types ───
export interface URLAnalysisInput {
  url: string
  title: string
  content: string
  author?: string | null
  siteName?: string
  excerpt?: string
  fetchedAt: number
}

export interface OCRAnalysisInput {
  imageName?: string
  imagePreview?: string
  extractedText: string
  confidence: number // 0-100
  editedText?: string
  language: string
}

export interface TextAnalysisInput {
  text: string
  wordCount: number
  source: 'manual'
}

export interface BatchAnalysisInput {
  filename: string
  totalItems: number
  items: string[]
}

// ─── Fact-Checking Types ───
export interface FactCheckClaim {
  claimText: string
  claimant: string
  publisherName: string
  publisherSite: string
  articleUrl: string
  articleTitle: string
  rating: string // e.g. "Salah", "Misleading", "Benar"
  ratingColor: string // hex code or css var
  reviewDate?: string
}

export interface FactCheckResult {
  available: boolean
  query: string
  claims: FactCheckClaim[]
  manualSearchUrl: string
  explorerUrl: string
  checkedAt: number
}

// ─── Dual-Spectrum & Fact-Checking Knowledge Types ───
export type ThreatSpectrumCluster =
  | 'POLITIK_NEGARA'       // Suksesi presiden, kudeta, pilpres, suap pejabat
  | 'BENCANA_DARURAT'      // Gempa megathrust, bendungan jebol, tsunami, letusan
  | 'PENIPUAN_BANSOS'      // Bansos kemensos 5jt, link kuota, apk tilang
  | 'KESEHATAN_PANGAN'     // Beras plastik, vaksin racun, penculikan organ
  | 'KEDAULATAN_MILITER'   // Separatis OPM, alutsista rongsokan, sabotase
  | 'UMUM_NETRAL'          // Berita faktual kedinasan/sosial

export interface DebunkKnowledgeEntry {
  id: string
  claim: string
  normalizedQuery: string
  cluster: ThreatSpectrumCluster
  verdict: 'HOAKS' | 'DISINFORMASI' | 'PROPAGANDA'
  threatLevel: ThreatLevel
  clarification: string
  officialSource: string
  sourceUrl: string
  keywords: string[]
  tacticalResponseCivilian: string
  tacticalResponseMilitary: string
  isLive?: boolean
  publishedDate?: string
}

export interface InstitutionalLogicAnomaly {
  detected: boolean
  anomalyType?: 'CONSTITUTIONAL_VIOLATION' | 'DISASTER_PREDICTION_FRAUD' | 'FINANCIAL_SCAM_PHISHING' | 'HEALTH_HOAX'
  explanation?: string
  confidenceImpact: number
}

// ─── AI & ML Engine Types ───
export interface CognitivePsychologyVectors {
  rageBaitIndex: number       // 0 - 100: Tingkat agitasi emosi & provokasi kemarahan massa
  artificialUrgency: number   // 0 - 100: Manipulasi kepanikan ("sebar cepat", "darurat", "sebelum dihapus")
  socialCleavage: number      // 0 - 100: Polarisasi horizontal/vertikal (SARA, rakyat vs aparat, separatisme)
  primaryEmotion: 'ANGER' | 'FEAR' | 'CONFUSION' | 'URGENCY' | 'NEUTRAL'
}

export interface MLPrediction {
  category: ContentCategory
  probabilities: Record<ContentCategory, number>
  tokens: string[]
}

export interface RuleMatchDetail {
  matchedKeywords: string[]
  categoryScores: Record<ContentCategory, number>
  riskLevel: ThreatLevel
  explanation: string
  targetedEntities: string[]
}

export interface AnalysisResult {
  id: string
  timestamp: number
  inputSource: InputSourceType
  rawContent: string
  input: string // Alias for rawContent
  title?: string
  sourceMeta?: {
    author?: string | null
    siteName?: string
    url?: string
    imagePreview?: string
  }
  category: ContentCategory
  threatLevel: ThreatLevel
  confidence: number // 0-100 overall confidence
  mlScore: number // 0-100 ML probability
  ruleScore: number // 0-100 Rule severity
  scores: { label: ContentCategory; score: number }[]
  explanation: string
  keywords: string[]
  targetedEntities: string[]
  recommendation: string
  factCheck?: FactCheckResult
  psychology?: CognitivePsychologyVectors
  forensicHash?: string
  spectrumCluster?: ThreatSpectrumCluster
  debunkMatch?: DebunkKnowledgeEntry
  logicAnomaly?: InstitutionalLogicAnomaly
}

// ─── Legacy / Backward-Compatible Aliases ───
export interface AccountProfile {
  id: string
  username: string
  botScore: number
  authenticityScore: number
  suspiciousIndicators: string[]
  postingPattern: 'normal' | 'burst' | 'scheduled' | 'coordinated'
  activityHours: number[]
  contentSimilarity: number
  flags: string[]
}

// ─── Nexus Network Graph Types ───
export type NexusNodeType = 'content' | 'narrative' | 'source' | 'account' | 'cluster'
export type NexusLinkType = 'similarity' | 'same_source' | 'coordinated' | 'amplified' | 'created'

export interface NexusNode {
  id: string
  label: string
  type: NexusNodeType
  threatLevel: ThreatLevel
  confidence?: number
  size?: number
  category?: ContentCategory
  details?: string
  x?: number
  y?: number
  vx?: number
  vy?: number
}

export interface NexusLink {
  source: string | NexusNode
  target: string | NexusNode
  strength: number
  type: NexusLinkType
}

export type NetworkNode = NexusNode
export type NetworkLink = NexusLink

// ─── Intelligence Report Types ───
export type ReportClassification = 'RAHASIA' | 'TERBATAS' | 'BIASA'

export interface IntelReportConfig {
  unitName: string
  analystName: string
  analystNrp?: string
  reportNumber: string
  classification: ReportClassification
  date: string
  includeFindingsDetail: boolean
  includeFactCheck: boolean
  includeRecommendations: boolean
}

// ─── User Settings ───
export interface UserSettings {
  googleFactCheckApiKey: string
  defaultUnit: string
  analystName: string
  analystNrp: string
  mlWeight: number // default 0.6
  ruleWeight: number // default 0.4
  offlineMode: boolean
}
