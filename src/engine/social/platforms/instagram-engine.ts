/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — INSTAGRAM SPECIALIZED EXTRACTION ENGINE
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * Engine khusus ekstraksi Instagram:
 * 1. Gateway Server-Side Narada (Bypass CORS, Bot-Header Telemetry, & GraphQL XIGComment extraction)
 * 2. Instagram Reels & Post Shortcode Resolver (/p/, /reel/, /tv/)
 * 3. Instagram Public OpenGraph & Profile Ingestion
 * 4. Paginasi & Urutan Komentar Terpopuler (Top Likes)
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

    const initialHandle = parsed.authorHandle ? `@${parsed.authorHandle.replace(/^@/, '')}` : '@instagram_user'
    const initialName = parsed.authorHandle ? parsed.authorHandle.replace(/^@/, '') : 'Akun Instagram'

    let postData: Partial<AnalyzedPostProfile> = {
      platform: 'instagram',
      url,
      canonicalUrl: parsed.postId ? `https://www.instagram.com/p/${parsed.postId}/` : url,
      postId,
      title: 'Postingan Instagram',
      caption: '',
      authorName: initialName,
      authorHandle: initialHandle,
      acquisitionMethod: 'OEMBED_PUBLIC',
      dataSourceNotice: 'Resolusi data Instagram sedang diproses...',
      commentsDisabled: false
    }

    let comments: AnalyzedCommentItem[] = options?.overrideComments || []

    // ─── Jalur 1: Gateway Server-Side Narada OSINT ───
    try {
      const gProcess = (globalThis as any).process
      const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:'
      const baseUrl = isFileProtocol ? 'http://127.0.0.1:5173' : (typeof window !== 'undefined' ? '' : (gProcess?.env?.VITE_DEV_SERVER_URL || 'http://localhost:5175'))
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
            // Urutkan komentar berdasarkan suka tertinggi
            comments.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0))
          }
        }
      }
    } catch {
      // Gateway offline atau berjalan di client-only environment
    }

    // ─── Jalur 2: Fallback Client-Side Langsung jika Data Belum Lengkap ───
    if (postData.authorHandle === '@instagram_user' && parsed.postId) {
      try {
        const customFetch = typeof fetch !== 'undefined' ? fetch : null
        if (customFetch) {
          const res = await customFetch(url, {
            headers: {
              'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
          })
          if (res.ok) {
            const html = await res.text()
            const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1]
            const ogDesc = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)?.[1]
            const ogImg = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1]

            if (ogTitle) {
              const split = ogTitle.split(/\s+(?:di|on)\s+Instagram:/i)
              if (split.length > 1) {
                postData.authorName = split[0].trim()
                postData.caption = split[1].replace(/&quot;|"/g, '').trim()
                postData.title = postData.caption.split('\n')[0].substring(0, 100)
              }
            }
            if (ogDesc) {
              const userM = ogDesc.match(/-\s*([a-zA-Z0-9_.-]+)\s*(?:pada|on)\s*/i)
              if (userM) {
                postData.authorHandle = `@${userM[1]}`
                if (postData.authorName === 'Akun Instagram') postData.authorName = userM[1]
              }
            }
            if (ogImg) postData.thumbnailUrl = ogImg
          }
        }
      } catch {
        // Fallback
      }
    }

    // Pastikan seluruh komentar selalu terurut berdasarkan likes tertinggi (real fresh top comments)
    if (comments.length > 1) {
      comments.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0))
    }

    return {
      post: postData,
      comments,
      notice: postData.dataSourceNotice || 'Ekstraksi Instagram selesai.'
    }
  }
}

export const instagramEngine = new InstagramEngine()

