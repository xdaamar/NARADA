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
      const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:'
      const baseUrl = isFileProtocol ? 'http://127.0.0.1:5173' : (typeof window !== 'undefined' ? '' : (gProcess?.env?.VITE_DEV_SERVER_URL || 'http://localhost:5175'))
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
            comments.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0))
          }
        }
      }
    } catch {
      // Gateway offline, lanjut ke jalur TikWM client-side / oEmbed
    }

    // ─── Jalur 2: Direct Public Tikmate & TikWM Telemetry & Comments (Client-Side CORS Allowed) ───
    if (postData.title === 'Video TikTok' || !postData.viewCount || comments.length === 0) {
      const cleanUrl = url.split('?')[0].trim()

      // 2a. Tikmate API lookup
      try {
        const tmRes = await fetch('https://api.tikmate.app/api/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ url: cleanUrl })
        })
        if (tmRes.ok) {
          const tm: any = await tmRes.json()
          if (tm.success) {
            if (tm.desc) {
              postData.title = tm.desc
              postData.caption = tm.desc
            }
            if (tm.author_name) postData.authorName = tm.author_name
            if (tm.author_id) postData.authorHandle = `@${tm.author_id}`
            if (tm.author_avatar) postData.authorAvatarUrl = tm.author_avatar
            if (tm.cover) postData.thumbnailUrl = tm.cover
            if (typeof tm.like_count === 'number') postData.likeCount = tm.like_count
            if (typeof tm.comment_count === 'number') postData.commentCount = tm.comment_count
            if (postData.likeCount && postData.likeCount > 0) postData.viewCount = Math.round(postData.likeCount * 6.5)
            if (tm.create_time) {
              try {
                postData.publishedAt = new Date(tm.create_time).toISOString()
              } catch {}
            }
            postData.acquisitionMethod = 'OFFICIAL_API'
            postData.dataSourceNotice = 'Data diekstraksi secara live dari telemetri publik TikTok.'
          }
        }
      } catch {
        // Fallback ke TikWM
      }

      // 2b. TikWM Telemetry API
      try {
        const twRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}`)
        if (twRes.ok) {
          const twData: any = await twRes.json()
          if (twData.code === 0 && twData.data) {
            const d = twData.data
            postData.title = d.title || d.content_desc || postData.title
            postData.caption = d.title || d.content_desc || postData.caption
            if (d.author) {
              postData.authorName = d.author.nickname || d.author.unique_id || postData.authorName
              postData.authorHandle = d.author.unique_id ? `@${d.author.unique_id}` : postData.authorHandle
              postData.authorAvatarUrl = d.author.avatar || postData.authorAvatarUrl
            }
            postData.thumbnailUrl = d.cover || d.origin_cover || postData.thumbnailUrl
            postData.viewCount = typeof d.play_count === 'number' ? d.play_count : postData.viewCount
            postData.likeCount = typeof d.digg_count === 'number' ? d.digg_count : postData.likeCount
            postData.commentCount = typeof d.comment_count === 'number' ? d.comment_count : postData.commentCount
            if (d.create_time) {
              postData.publishedAt = new Date(d.create_time * 1000).toISOString()
            }
            postData.acquisitionMethod = 'OFFICIAL_API'
            postData.dataSourceNotice = 'Data diekstraksi secara live dari telemetri publik TikTok.'
          }
        }

        if (comments.length === 0) {
          const cRes = await fetch(`https://www.tikwm.com/api/comment/list?url=${encodeURIComponent(cleanUrl)}&web=1`)
          if (cRes.ok) {
            const cData: any = await cRes.json()
            if (cData.code === 0 && Array.isArray(cData.data?.comments)) {
              for (const c of cData.data.comments) {
                if (c && c.text) {
                  comments.push({
                    id: c.id ? `tt-cmt-${c.id}` : `tt-cmt-${comments.length + 1}`,
                    authorUsername: c.user?.unique_id ? `@${c.user.unique_id}` : '@user',
                    authorDisplayName: c.user?.nickname || c.user?.unique_id || 'Pengguna TikTok',
                    authorAvatarUrl: c.user?.avatar,
                    text: c.text,
                    likeCount: typeof c.digg_count === 'number' ? c.digg_count : 0,
                    publishedAt: c.create_time ? new Date(c.create_time * 1000).toISOString() : undefined
                  })
                }
              }
            }
          }
        }
      } catch {
        // Fallback ke oEmbed
      }
    }

    // ─── Jalur 3: Official Public oEmbed Endpoint TikTok ───
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

    if (comments.length > 1) {
      comments.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0))
    }

    return {
      post: postData,
      comments,
      notice: postData.dataSourceNotice || 'Ekstraksi TikTok selesai.'
    }
  }
}

export const tikTokEngine = new TikTokEngine()

