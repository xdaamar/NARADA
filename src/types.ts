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

// ─── AI & ML Engine Types ───
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
