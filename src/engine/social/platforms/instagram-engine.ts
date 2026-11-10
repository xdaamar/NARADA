/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — INSTAGRAM SPECIALIZED EXTRACTION ENGINE
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * Engine khusus ekstraksi Instagram:
 * 1. Gateway Server-Side Narada (Bypass CORS & Rate Limiting)
 * 2. Instagram Reels & Post Shortcode Resolver (/p/, /reel/, /tv/)
 * 3. Instagram Public oEmbed / Meta Graph Integration
 * 4. Ingest Komentar Terstruktur
 * ══════════════════════════════════════════════════════════════════════════
 */

import type { PlatformEngine, PlatformExtractionResult } from './platform-engine-contract.ts'
import type {
  SocialMediaType,
  AnalyzedPostProfile,
  AnalyzedCommentItem,
  SocialExtractionOptions
} from '../types/social-analysis-types.ts'
import { detectSocialPlatform } from '../core/platform-detector.ts'

export class InstagramEngine implements PlatformEngine {
  readonly platform: SocialMediaType = 'instagram'
  readonly name = 'Instagram'
  readonly officialDomain = 'instagram.com'

  canHandle(url: string): boolean {
    if (!url) return false
    return /instagram\.com|instagr\.am/i.test(url.trim())
  }

  async extract(url: string, options?: SocialExtractionOptions): Promise<PlatformExtractionResult> {
    const parsed = detectSocialPlatform(url)
    const postId = parsed.postId || `ig-${Date.now()}`

    let postData: Partial<AnalyzedPostProfile> = {
      platform: 'instagram',
      url,
      canonicalUrl: parsed.postId ? `https://www.instagram.com/p/${parsed.postId}/` : url,
      postId,
      title: 'Postingan Instagram',
      caption: '',
      authorName: 'Akun Instagram',
      authorHandle: '@instagram_user',
      acquisitionMethod: 'OEMBED_PUBLIC',
      dataSourceNotice: 'Resolusi data Instagram sedang diproses...',
      commentsDisabled: false
    }

    let comments: AnalyzedCommentItem[] = options?.overrideComments || []

    // ─── Jalur 1: Gateway Server-Side Narada ───
    try {
      const gProcess = (globalThis as any).process
      const baseUrl = typeof window !== 'undefined' ? '' : (gProcess?.env?.VITE_DEV_SERVER_URL || 'http://localhost:5175')
      const gatewayRes = await fetch(`${baseUrl}/api/social/extract?url=${encodeURIComponent(url)}&platform=instagram`)
      if (gatewayRes.ok) {
        const ext = await gatewayRes.json()
        if (ext.success && ext.post) {
          postData = {
            ...postData,
            ...ext.post
          }
          if (comments.length === 0 && ext.comments && Array.isArray(ext.comments) && ext.comments.length > 0) {
            comments = ext.comments.map((c: any) => ({
              id: c.id,
              authorUsername: c.authorUsername,
              authorDisplayName: c.authorDisplayName || c.authorUsername,
              authorAvatarUrl: c.authorAvatarUrl,
              text: c.text,
              likeCount: c.likeCount || 0,
              publishedAt: c.publishedAt
            }))
          }
        }
      }
    } catch {
      // Gateway offline
    }

    // ─── Jalur 2: Public oEmbed Instagram / Graph Endpoint ───
    if (postData.title === 'Postingan Instagram') {
      try {
        const customFetch = typeof fetch !== 'undefined' ? fetch : null
        if (customFetch) {
          // Instagram Graph oEmbed endpoint
          const oembedUrl = `https://graph.facebook.com/v12.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=none`
          const res = await customFetch(oembedUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          })
          if (res.ok) {
            const data = await res.json()
            postData.title = data.title || postData.title
            postData.authorName = data.author_name || postData.authorName
            postData.authorHandle = data.author_name ? `@${data.author_name}` : postData.authorHandle
            postData.thumbnailUrl = data.thumbnail_url || postData.thumbnailUrl
            postData.acquisitionMethod = 'OEMBED_PUBLIC'
            postData.dataSourceNotice = 'Metadata resmi Instagram diakuisisi via protokol Meta oEmbed.'
          }
        }
      } catch {
        // Fallback
      }
    }

    return {
      post: postData,
      comments,
      notice: postData.dataSourceNotice || 'Ekstraksi Instagram selesai.'
    }
  }
}

export const instagramEngine = new InstagramEngine()

