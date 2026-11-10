/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — SOCIAL ANALYSIS DOMAIN CONTRACTS & TYPES
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * Tipe data, kontrak, dan interface standar untuk analisis postingan
 * dan komentar lintas platform media sosial.
 * ══════════════════════════════════════════════════════════════════════════
 */

export type SocialMediaType = 'youtube' | 'tiktok' | 'instagram' | 'threads'

export type SocialAcquisitionMethod = 
  | 'OFFICIAL_API' 
  | 'OEMBED_PUBLIC' 
  | 'BROWSER_EXTRACTION' 
  | 'DIRECT_INGEST'

export interface AnalyzedPostProfile {
  platform: SocialMediaType
  url: string
  canonicalUrl: string
  postId: string
  title: string
  caption: string
  authorName: string
  authorHandle: string
  authorAvatarUrl?: string
  authorFollowersCount?: number
  authorVerified?: boolean
  publishedAt?: string
  viewCount?: number
  likeCount?: number
  commentCount?: number
  thumbnailUrl?: string
  commentsDisabled?: boolean
  acquisitionMethod: SocialAcquisitionMethod
  dataSourceNotice: string
}

export interface AnalyzedCommentItem {
  id: string
  authorUsername: string
  authorDisplayName?: string
  authorAvatarUrl?: string
  text: string
  likeCount: number
  publishedAt?: string
  isBuzzerCandidate?: boolean
}

export interface CopypastaCluster {
  clusterId: string
  templateText: string
  commentCount: number
  percentageOfTotal: number
  accountsInvolved: string[]
  sampleComments: AnalyzedCommentItem[]
  similarityScore: number
  temporalSpanSeconds?: number
}

export interface BuzzerPatternAnalysis {
  coordinationScore: number // 0 - 100
  coordinationLevel: 'RENDAH' | 'SEDANG' | 'TINGGI'
  narrativeSummary: string
  dominantKeywords: string[]
  burstVelocityCommentPerMinute: number
  temporalWindowSeconds: number
  sampleAccounts: string[]
  sampleQuotes: string[]
  evidenceRationale: string
}

export interface SocialPostAnalysisResult {
  post: AnalyzedPostProfile
  totalCommentsAnalyzed: number
  topComments: AnalyzedCommentItem[]
  copypastaClusters: CopypastaCluster[]
  buzzerPattern: BuzzerPatternAnalysis
  analyzedAt: string
}

export interface PlatformMetadataInfo {
  name: string
  officialDomain: string
  exampleUrl: string
  urlPatternsDescription: string
}

export interface SocialLinkValidationResult {
  isValid: boolean
  isMismatch: boolean
  detectedPlatform: SocialMediaType | 'UNKNOWN'
  targetPlatform: SocialMediaType
  errorMessage?: string
}

export interface SocialExtractionOptions {
  maxComments?: number
  fetchChannelDetails?: boolean
  overrideComments?: AnalyzedCommentItem[]
  rawCommentsText?: string
}

export interface PreloadedTestScenario {
  id: string
  title: string
  platform: SocialMediaType
  url: string
  description: string
  mockResult: SocialPostAnalysisResult
}
