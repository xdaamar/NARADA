// ─── NARADA Shared Types ───
export type ThreatLevel = 'low' | 'medium' | 'high' | 'critical'
export type ContentCategory = 'HOAKS' | 'PROPAGANDA' | 'BUZZER' | 'DISINFORMASI' | 'NETRAL'

export interface AnalysisResult {
  id: string
  timestamp: number
  input: string
  category: ContentCategory
  threatLevel: ThreatLevel
  confidence: number
  scores: { label: ContentCategory; score: number }[]
  explanation: string
  keywords: string[]
  recommendation: string
}

export interface AccountProfile {
  id: string
  username: string
  botScore: number        // 0-100, higher = more bot-like
  authenticityScore: number // 0-100, higher = more authentic
  suspiciousIndicators: string[]
  postingPattern: 'normal' | 'burst' | 'scheduled' | 'coordinated'
  activityHours: number[]  // 0-23 
  contentSimilarity: number // 0-100%
  flags: string[]
}

export interface NetworkNode {
  id: string
  label: string
  type: 'account' | 'content' | 'cluster'
  threatLevel: ThreatLevel
  size?: number
  x?: number
  y?: number
}

export interface NetworkLink {
  source: string
  target: string
  strength: number
  type: 'amplified' | 'created' | 'coordinated'
}
