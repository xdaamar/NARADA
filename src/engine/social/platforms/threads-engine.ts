/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — THREADS SPECIALIZED EXTRACTION ENGINE
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * Engine khusus ekstraksi Meta Threads:
 * 1. Gateway Server-Side Narada (Bypass CORS)
 * 2. Threads Thread Shortcode Resolver (threads.net/@user/post/<id> / threads.net/t/<id>)
 * 3. Threads Public oEmbed API (https://www.threads.net/oembed)
 * 4. Analisis Diskusi Teks & Ingest Komentar
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

export class ThreadsEngine implements PlatformEngine {
  readonly platform: SocialMediaType = 'threads'
  readonly name = 'Threads'
  readonly officialDomain = 'threads.net'

  canHandle(url: string): boolean {
    if (!url) return false
    return /threads\.net/i.test(url.trim())
  }

  async extract(url: string, options?: SocialExtractionOptions): Promise<PlatformExtractionResult> {
    const parsed = detectSocialPlatform(url)
    const postId = parsed.postId || `th-${Date.now()}`

    let postData: Partial<AnalyzedPostProfile> = {
      platform: 'threads',
      url,
      canonicalUrl: url,
      postId,
      title: 'Utas Meta Threads',
      caption: '',
      authorName: 'Pengguna Threads',
      authorHandle: parsed.authorHandle ? (parsed.authorHandle.startsWith('@') ? parsed.authorHandle : `@${parsed.authorHandle}`) : '@threads_user',
      acquisitionMethod: 'OEMBED_PUBLIC',
      dataSourceNotice: 'Resolusi data Threads sedang diproses...',
      commentsDisabled: false
    }

    let comments: AnalyzedCommentItem[] = options?.overrideComments || []

    // ─── Jalur 1: Gateway Server-Side Narada ───
    try {
      const gProcess = (globalThis as any).process
      const baseUrl = typeof window !== 'undefined' ? '' : (gProcess?.env?.VITE_DEV_SERVER_URL || 'http://localhost:5175')
      const gatewayRes = await fetch(`${baseUrl}/api/social/extract?url=${encodeURIComponent(url)}&platform=threads`)
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

    // ─── Jalur 2: Official Public oEmbed Endpoint Threads ───
    if (postData.title === 'Utas Meta Threads') {
      try {
        const customFetch = typeof fetch !== 'undefined' ? fetch : null
        if (customFetch) {
          const oembedUrl = `https://www.threads.net/oembed?url=${encodeURIComponent(url)}`
          const res = await customFetch(oembedUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          })
          if (res.ok) {
            const data = await res.json()
            postData.title = data.title || postData.title
            postData.caption = data.title || postData.caption
            postData.authorName = data.author_name || postData.authorName
            postData.authorHandle = data.author_name ? `@${data.author_name}` : postData.authorHandle
            postData.thumbnailUrl = data.thumbnail_url || postData.thumbnailUrl
            postData.acquisitionMethod = 'OEMBED_PUBLIC'
            postData.dataSourceNotice = 'Metadata resmi Threads diakuisisi via endpoint oEmbed resmi.'
          }
        }
      } catch {
        // Fallback
      }
    }

    return {
      post: postData,
      comments,
      notice: postData.dataSourceNotice || 'Ekstraksi Threads selesai.'
    }
  }
}

export const threadsEngine = new ThreadsEngine()

