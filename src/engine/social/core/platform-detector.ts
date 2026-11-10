/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — SOCIAL PLATFORM DETECTOR & URL VALIDATOR
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * Modul deteksi platform cerdas, ekstraksi ID postingan, dan validasi URL
 * lintas platform: YouTube, TikTok, Instagram, dan Threads.
 * ══════════════════════════════════════════════════════════════════════════
 */

import type {
  SocialMediaType,
  PlatformMetadataInfo,
  SocialLinkValidationResult
} from '../types/social-analysis-types.ts'

export interface DetectedPlatformInfo {
  platform: SocialMediaType | 'UNKNOWN'
  postId: string | null
  authorHandle?: string
}

export const PLATFORM_INFO_MAP: Record<SocialMediaType, PlatformMetadataInfo> = {
  youtube: {
    name: 'YouTube',
    officialDomain: 'youtube.com / youtu.be',
    exampleUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    urlPatternsDescription: 'youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/...'
  },
  tiktok: {
    name: 'TikTok',
    officialDomain: 'tiktok.com / vt.tiktok.com',
    exampleUrl: 'https://www.tiktok.com/@puspen_tni/video/7345678901234567890',
    urlPatternsDescription: 'tiktok.com/@user/video/..., vt.tiktok.com/...'
  },
  instagram: {
    name: 'Instagram',
    officialDomain: 'instagram.com',
    exampleUrl: 'https://www.instagram.com/p/C4abc123DEF/',
    urlPatternsDescription: 'instagram.com/p/..., instagram.com/reel/..., instagram.com/tv/...'
  },
  threads: {
    name: 'Threads',
    officialDomain: 'threads.net',
    exampleUrl: 'https://www.threads.net/@puspentni/post/C4xyz789ABC',
    urlPatternsDescription: 'threads.net/@user/post/...'
  }
}

/**
 * Deteksi platform media sosial dari teks URL dengan pengenalan regex presisi tinggi.
 */
export function detectSocialPlatform(url: string): DetectedPlatformInfo {
  if (!url || typeof url !== 'string') return { platform: 'UNKNOWN', postId: null }
  const trimmed = url.trim()

  // 1. YouTube (Mendukung /watch?v=, youtu.be/, /shorts/, /live/, /embed/, dan parameter si/t)
  if (/youtube\.com|youtu\.be/i.test(trimmed)) {
    const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/i)
    if (watchMatch) return { platform: 'youtube', postId: watchMatch[1] }

    const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i)
    if (shortMatch) return { platform: 'youtube', postId: shortMatch[1] }

    const pathMatch = trimmed.match(/youtube\.com\/(?:shorts|live|embed|v)\/([a-zA-Z0-9_-]{11})/i)
    if (pathMatch) return { platform: 'youtube', postId: pathMatch[1] }

    const fallbackMatch = trimmed.match(/\/([a-zA-Z0-9_-]{11})(?:[?&#]|$)/i)
    if (fallbackMatch) return { platform: 'youtube', postId: fallbackMatch[1] }

    return { platform: 'youtube', postId: null }
  }

  // 2. TikTok (Mendukung /video/, /photo/, vt.tiktok.com, vm.tiktok.com, tiktok.com/t/)
  if (/tiktok\.com/i.test(trimmed)) {
    const videoMatch = trimmed.match(/@([a-zA-Z0-9_.-]+)\/(?:video|photo)\/(\d+)/i)
    if (videoMatch) {
      return { platform: 'tiktok', authorHandle: videoMatch[1], postId: videoMatch[2] }
    }
    const shortMatch = trimmed.match(/(?:vt|vm)\.tiktok\.com\/([a-zA-Z0-9_-]+)/i) || trimmed.match(/tiktok\.com\/t\/([a-zA-Z0-9_-]+)/i)
    if (shortMatch) {
      return { platform: 'tiktok', postId: shortMatch[1] }
    }
    const userMatch = trimmed.match(/@([a-zA-Z0-9_.-]+)/i)
    if (userMatch) {
      return { platform: 'tiktok', authorHandle: userMatch[1], postId: null }
    }
    return { platform: 'tiktok', postId: null }
  }

  // 3. Instagram (Mendukung /p/, /reel/, /reels/, /tv/, /share/p/)
  if (/instagram\.com|instagr\.am/i.test(trimmed)) {
    const postMatch = trimmed.match(/(?:instagram\.com|instagr\.am)\/(?:p|reel|reels|tv|share\/p)\/([a-zA-Z0-9_-]+)/i)
    if (postMatch) {
      return { platform: 'instagram', postId: postMatch[1] }
    }
    return { platform: 'instagram', postId: null }
  }

  // 4. Threads (Mendukung /@user/post/, /post/, /t/)
  if (/threads\.net/i.test(trimmed)) {
    const threadsMatch = trimmed.match(/threads\.net\/(?:@([a-zA-Z0-9_.-]+)\/post|t|post)\/([a-zA-Z0-9_-]+)/i)
    if (threadsMatch) {
      return { platform: 'threads', authorHandle: threadsMatch[1] || undefined, postId: threadsMatch[2] }
    }
    return { platform: 'threads', postId: null }
  }

  return { platform: 'UNKNOWN', postId: null }
}

/**
 * Validasi apakah URL yang dimasukkan cocok dengan platform target aktif di UI.
 */
export function validateSocialPlatformUrl(url: string, targetPlatform: SocialMediaType): SocialLinkValidationResult {
  if (!url || typeof url !== 'string') {
    return {
      isValid: false,
      isMismatch: false,
      detectedPlatform: 'UNKNOWN',
      targetPlatform,
      errorMessage: 'Tautan URL belum diisi.'
    }
  }

  const trimmed = url.trim()
  if (!trimmed) {
    return {
      isValid: false,
      isMismatch: false,
      detectedPlatform: 'UNKNOWN',
      targetPlatform,
      errorMessage: 'Tautan URL tidak boleh hanya berupa spasi kosong.'
    }
  }

  const detected = detectSocialPlatform(trimmed)

  if (detected.platform === targetPlatform) {
    return {
      isValid: true,
      isMismatch: false,
      detectedPlatform: targetPlatform,
      targetPlatform
    }
  }

  if (detected.platform !== 'UNKNOWN') {
    const targetName = PLATFORM_INFO_MAP[targetPlatform]?.name || targetPlatform.toUpperCase()
    const detectedName = PLATFORM_INFO_MAP[detected.platform]?.name || detected.platform.toUpperCase()
    return {
      isValid: false,
      isMismatch: true,
      detectedPlatform: detected.platform,
      targetPlatform,
      errorMessage: `Menu ${targetName.toUpperCase()} hanya menerima tautan resmi dari ${targetName}. Tautan yang Anda masukkan terdeteksi berasal dari platform ${detectedName.toUpperCase()}.`
    }
  }

  const targetName = PLATFORM_INFO_MAP[targetPlatform]?.name || targetPlatform.toUpperCase()
  return {
    isValid: false,
    isMismatch: false,
    detectedPlatform: 'UNKNOWN',
    targetPlatform,
    errorMessage: `Format tautan tidak dikenali. Menu ${targetName.toUpperCase()} hanya menerima tautan resmi dari ${targetName} (${PLATFORM_INFO_MAP[targetPlatform]?.urlPatternsDescription || ''}).`
  }
}

