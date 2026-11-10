/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — TIKTOK SPECIALIZED EXTRACTION ENGINE
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * Engine khusus ekstraksi TikTok:
 * 1. Gateway Server-Side Narada (Bypass CORS & Anti-Scraping)
 * 2. TikTok Official Public oEmbed API (https://www.tiktok.com/oembed)
 * 3. Resolusi Shortlinks (vt.tiktok.com / vm.tiktok.com / tiktok.com/t/)
 * 4. Ekstraksi Profil Author & Video ID
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

export class TikTokEngine implements PlatformEngine {
  readonly platform: SocialMediaType = 'tiktok'
  readonly name = 'TikTok'
  readonly officialDomain = 'tiktok.com / vt.tiktok.com'

  canHandle(url: string): boolean {
    if (!url) return false
    return /tiktok\.com/i.test(url.trim())
  }

  async extract(url: string, options?: SocialExtractionOptions): Promise<PlatformExtractionResult> {
    const parsed = detectSocialPlatform(url)
    const postId = parsed.postId || `tt-${Date.now()}`

    let postData: Partial<AnalyzedPostProfile> = {
      platform: 'tiktok',
      url,
      canonicalUrl: url,
      postId,
      title: 'Video TikTok',
      caption: '',
      authorName: 'Kreator TikTok',
      authorHandle: parsed.authorHandle ? (parsed.authorHandle.startsWith('@') ? parsed.authorHandle : `@${parsed.authorHandle}`) : '@tiktok_creator',
      acquisitionMethod: 'OEMBED_PUBLIC',
      dataSourceNotice: 'Resolusi data TikTok sedang diproses...',
      commentsDisabled: false
    }

    let comments: AnalyzedCommentItem[] = options?.overrideComments || []

    // ─── Jalur 1: Gateway Server-Side Narada ───
    try {
      const gProcess = (globalThis as any).process
      const baseUrl = typeof window !== 'undefined' ? '' : (gProcess?.env?.VITE_DEV_SERVER_URL || 'http://localhost:5175')
      const gatewayRes = await fetch(`${baseUrl}/api/social/extract?url=${encodeURIComponent(url)}&platform=tiktok`)
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
      // Gateway offline, lanjut ke jalur oEmbed
    }

    // ─── Jalur 2: Official Public oEmbed Endpoint TikTok ───
    if (postData.title === 'Video TikTok' || !postData.authorName || postData.authorName === 'Kreator TikTok') {
      try {
        const customFetch = typeof fetch !== 'undefined' ? fetch : null
        if (customFetch) {
          const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
          const res = await customFetch(oembedUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          })
          if (res.ok) {
            const data = await res.json()
            postData.title = data.title || postData.title
            postData.caption = data.title || postData.caption
            postData.authorName = data.author_name || postData.authorName
            postData.authorHandle = data.author_unique_id ? `@${data.author_unique_id}` : (data.author_name ? `@${data.author_name.replace(/\s+/g, '_').toLowerCase()}` : postData.authorHandle)
            postData.thumbnailUrl = data.thumbnail_url || postData.thumbnailUrl
            postData.acquisitionMethod = 'OEMBED_PUBLIC'
            postData.dataSourceNotice = 'Metadata publik TikTok diambil secara sah melalui protokol resmi oEmbed TikTok.'
          }
        }
      } catch {
        // Fallback
      }
    }

    return {
      post: postData,
      comments,
      notice: postData.dataSourceNotice || 'Ekstraksi TikTok selesai.'
    }
  }
}

export const tikTokEngine = new TikTokEngine()

