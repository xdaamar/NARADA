/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — YOUTUBE SPECIALIZED EXTRACTION ENGINE
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * Engine khusus ekstraksi YouTube:
 * 1. Gateway Server-Side InnerTube
 * 2. Official Google Cloud YouTube Data API v3 (youtubeConnector)
 * 3. YouTube Public oEmbed Resolver
 * 4. Paginasi Komentar & Pengambilan Data Subscriber Channel
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
import { youtubeConnector, type YouTubeCommentItem } from '../../acquisition/youtube-connector.ts'

/**
 * Konversi durasi format ISO 8601 (e.g. PT4M13S, PT1H2M10S) menjadi durasi detik total
 */
function parseIso8601Duration(durationStr: string): number {
  if (!durationStr) return 0
  if (typeof durationStr === 'number') return durationStr
  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i)
  if (!match) {
    const numeric = parseInt(durationStr, 10)
    return isNaN(numeric) ? 0 : numeric
  }
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)
  return hours * 3600 + minutes * 60 + seconds
}

export class YouTubeEngine implements PlatformEngine {
  readonly platform: SocialMediaType = 'youtube'
  readonly name = 'YouTube'
  readonly officialDomain = 'youtube.com / youtu.be'

  canHandle(url: string): boolean {
    if (!url) return false
    return /youtube\.com|youtu\.be/i.test(url.trim())
  }

  async extract(url: string, options?: SocialExtractionOptions): Promise<PlatformExtractionResult> {
    const parsed = detectSocialPlatform(url)
    const postId = parsed.postId || `yt-${Date.now()}`

    let postData: Partial<AnalyzedPostProfile> = {
      platform: 'youtube',
      url,
      canonicalUrl: parsed.postId ? `https://www.youtube.com/watch?v=${parsed.postId}` : url,
      postId,
      title: 'Postingan YouTube',
      caption: '',
      authorName: 'Kreator YouTube',
      authorHandle: '@youtube_creator',
      acquisitionMethod: 'OEMBED_PUBLIC',
      dataSourceNotice: 'Resolusi data YouTube sedang diproses...',
      commentsDisabled: false
    }

    let comments: AnalyzedCommentItem[] = options?.overrideComments || []

    // ─── Jalur 1: Gateway Server-Side InnerTube Narada ───
    try {
      const gProcess = (globalThis as any).process
      const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:'
      const baseUrl = isFileProtocol ? 'http://127.0.0.1:5174' : (typeof window !== 'undefined' ? '' : (gProcess?.env?.VITE_DEV_SERVER_URL || 'http://localhost:5175'))
      const gatewayRes = await fetch(`${baseUrl}/api/social/extract?url=${encodeURIComponent(url)}&platform=youtube`)
      if (gatewayRes.ok) {
        const ext = await gatewayRes.json()
        if (ext.success && ext.post) {
          postData = {
            ...postData,
            ...ext.post
          }
          if (ext.post.durationSeconds) {
            postData.durationSeconds = Number(ext.post.durationSeconds)
          } else if (ext.post.duration) {
            postData.durationSeconds = parseIso8601Duration(String(ext.post.duration))
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
            // Urutkan komentar berdasarkan suka tertinggi secara mutlak
            comments.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0))
          }
        }
      }
    } catch {
      // Gateway offline atau dalam browser murni, lanjutkan ke jalur API/oEmbed
    }

    // ─── Jalur 2: Official Google Cloud YouTube Data API v3 ───
    if (parsed.postId && (postData.title === 'Postingan YouTube' || comments.length === 0)) {
      try {
        const ytVideoRes = await youtubeConnector.getVideoDetails(parsed.postId)
        if (ytVideoRes.success && ytVideoRes.metadata) {
          const meta = ytVideoRes.metadata
          postData.title = meta.title
          postData.caption = meta.description
          postData.authorName = meta.channelTitle
          postData.authorHandle = `@${meta.channelTitle.replace(/\s+/g, '').toLowerCase()}`
          postData.publishedAt = meta.publishedAt
          if ((meta as any).duration) {
            postData.durationSeconds = parseIso8601Duration(String((meta as any).duration))
          }
          postData.viewCount = meta.viewCount
          postData.likeCount = meta.likeCount
          postData.commentCount = meta.commentCount
          postData.commentsDisabled = meta.commentsDisabled
          postData.acquisitionMethod = 'OFFICIAL_API'
          postData.dataSourceNotice = 'Data diakuisisi resmi melalui Google Cloud YouTube Data API v3.'

          // Ambil rincian subscriber channel
          if (meta.channelId && options?.fetchChannelDetails !== false) {
            const chRes = await youtubeConnector.getChannelDetails(meta.channelId)
            if (chRes.success && chRes.metadata) {
              postData.authorFollowersCount = chRes.metadata.subscriberCount
              postData.authorAvatarUrl = chRes.metadata.thumbnailUrl
            }
          }

          // Ambil komentar resmi jika belum ada
          if (comments.length === 0 && !meta.commentsDisabled) {
            const maxC = options?.maxComments || 50
            const cmtRes = await youtubeConnector.getVideoComments(parsed.postId, { maxResults: maxC, maxPages: 2 })
            if (cmtRes.success && cmtRes.comments.length > 0) {
              comments = cmtRes.comments.map((c: YouTubeCommentItem) => ({
                id: c.id,
                authorUsername: `@${c.authorName.replace(/\s+/g, '').toLowerCase()}`,
                authorDisplayName: c.authorName,
                text: c.textOriginal,
                likeCount: c.likeCount,
                publishedAt: c.publishedAt
              }))
            }
          }
        }
      } catch {
        // Fallback
      }
    }

    // ─── Jalur 3: Fallback ke Public oEmbed YouTube jika data masih kosong ───
    if (postData.title === 'Postingan YouTube') {
      try {
        const customFetch = typeof fetch !== 'undefined' ? fetch : null
        if (customFetch) {
          const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
          const res = await customFetch(oembedUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          })
          if (res.ok) {
            const data = await res.json()
            postData.title = data.title || postData.title
            postData.caption = data.title || postData.caption
            postData.authorName = data.author_name || postData.authorName
            postData.authorHandle = data.author_name ? `@${data.author_name.replace(/\s+/g, '_').toLowerCase()}` : postData.authorHandle
            postData.thumbnailUrl = data.thumbnail_url || postData.thumbnailUrl
            postData.acquisitionMethod = 'OEMBED_PUBLIC'
            postData.dataSourceNotice = 'Metadata publik diambil secara sah melalui protokol resmi oEmbed YouTube.'
          }
        }
      } catch {
        // Abaikan
      }
    }

    // Pastikan seluruh komentar selalu terurut berdasarkan likes tertinggi (real fresh top comments)
    if (comments.length > 1) {
      comments.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0))
    }

    return {
      post: postData,
      comments,
      notice: postData.dataSourceNotice || 'Ekstraksi YouTube selesai.'
    }
  }
}

export const youtubeEngine = new YouTubeEngine()

