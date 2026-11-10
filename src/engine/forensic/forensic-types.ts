/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — FORENSIC ANALYSIS TYPES & CONTRACTS
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 */

import type { CopypastaCluster } from './jaccard-matrix.ts'
import type { SentimentLabel } from './sentiment-engine.ts'
import type { CounterNarrativeChannels } from './counter-narrative-generator.ts'

export type SocialPlatform = 'INSTAGRAM' | 'TIKTOK' | 'TWITTER' | 'FACEBOOK' | 'THREADS' | 'GENERIC_WEB'

export interface SocialCommentItem {
  id: string
  authorHandle: string
  authorName: string
  avatarLetter: string
  avatarColor: string
  timestamp: string
  content: string
  likes: number
  sentiment: SentimentLabel
  isSuspiciousBot: boolean
  isCopypastaTemplate: boolean
  matchedTemplatePattern?: string
}

export interface SocialPostForensicResult {
  id: string
  url: string
  platform: SocialPlatform
  analyzedAt: string
  author: {
    handle: string
    displayName: string
    isVerified: boolean
    followersCount: number
    accountAgeDays: number
    avatarLetter: string
    avatarColor: string
  }
  post: {
    publishedAt: string
    caption: string
    likesCount: number
    commentsCount: number
    sharesCount: number
    viewsCount?: number
    mediaType: 'VIDEO' | 'IMAGE' | 'THREAD' | 'TEXT'
  }
  cognitiveVerdict: {
    status: 'HOAKS_BERBAHAYA' | 'DISINFORMASI_TERKOORDINASI' | 'KAMPANYE_BUZZER' | 'FAKTA_TERVERIFIKASI' | 'AMBIGU'
    confidenceScore: number // 0 - 100
    classificationBadge: string
    summaryReason: string
    threatLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  }
  sentimentMatrix: {
    positivePercent: number
    neutralPercent: number
    provocativePercent: number
    dominantSentiment: SentimentLabel
  }
  buzzerForensic: {
    isBuzzerAlarmActive: boolean // true jika copypastaPercent >= 15% atau botRatio >= 30%
    copypastaPercent: number
    burstVelocityPerMinute: number // komentar / menit
    botAccountRatioPercent: number // %
    detectedClusters: CopypastaCluster[]
    coordinationIndex: number // 0 - 100
    swarmAnomalyDescription: string
  }
  tacticalRecommendation: {
    posture: 'NETRALISIR_SEGERA' | 'MONITOR_INTENSIF' | 'COUNTER_NARRATIVE_RESMI' | 'TAKEDOWN_REQUEST'
    officialClarificationDraft: string
    recommendedDispenadProtocol: string
    targetChannels: string[]
    counterNarratives?: CounterNarrativeChannels
  }
  commentsSample: SocialCommentItem[]
}
