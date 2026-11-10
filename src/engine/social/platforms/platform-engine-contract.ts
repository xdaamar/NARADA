/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — SOCIAL PLATFORM ENGINE CONTRACT
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * Standar antarmuka (interface) terpadu untuk engine ekstraksi tiap platform.
 * Setiap platform (YouTube, TikTok, Instagram, Threads) mengemas implementasi
 * terisolasi untuk memudahkan audit, hardening, dan upgrade berkala.
 * ══════════════════════════════════════════════════════════════════════════
 */

import type {
  SocialMediaType,
  AnalyzedPostProfile,
  AnalyzedCommentItem,
  SocialExtractionOptions
} from '../types/social-analysis-types.ts'

export interface PlatformExtractionResult {
  post: Partial<AnalyzedPostProfile>
  comments: AnalyzedCommentItem[]
  notice: string
}

export interface PlatformEngine {
  readonly platform: SocialMediaType
  readonly name: string
  readonly officialDomain: string

  /**
   * Mengecek apakah URL dapat ditangani oleh engine platform ini
   */
  canHandle(url: string): boolean

  /**
   * Ekstraksi metadata postingan dan komentar dari URL target
   */
  extract(url: string, options?: SocialExtractionOptions): Promise<PlatformExtractionResult>
}
