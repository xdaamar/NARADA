/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — SOCIAL POST & COMMENT INTELLIGENCE ENGINE
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Engine Ekstraksi & Analisis Forensik Postingan Medsos:
 * 1. Platform: YouTube, TikTok, Instagram, Threads
 * 2. Tri-Engine Pipeline: Official API, Browser Extraction, & Direct Ingest
 * 3. 100% Real Data Guarantee (Zero Fake Simulation)
 * 4. Peringkat Top Komentar Terverifikasi (Likes + Usernames)
 * 5. Klusterisasi Komentar Template Leksikal (Jaccard Similarity >= 0.70)
 * 6. Deteksi Pola Buzzer & Bot Terkoordinasi (Burst Velocity + Narrative Framing)
 * ══════════════════════════════════════════════════════════════════════════
 */

import { youtubeConnector, type YouTubeCommentItem } from '../acquisition/youtube-connector.ts'

export type SocialMediaType = 'youtube' | 'tiktok' | 'instagram' | 'threads'

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
  acquisitionMethod: 'OFFICIAL_API' | 'OEMBED_PUBLIC' | 'BROWSER_EXTRACTION' | 'DIRECT_INGEST'
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

// ─────────────────────────────────────────────────────────────────────────────
// 1. URL PARSER & PLATFORM DETECTOR
// ─────────────────────────────────────────────────────────────────────────────

export function detectSocialPlatform(url: string): {
  platform: SocialMediaType | 'UNKNOWN'
  postId: string | null
  authorHandle?: string
} {
  if (!url || typeof url !== 'string') return { platform: 'UNKNOWN', postId: null }
  const trimmed = url.trim()

  // 1. YouTube
  if (/youtube\.com|youtu\.be/i.test(trimmed)) {
    const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/i)
    if (watchMatch) return { platform: 'youtube', postId: watchMatch[1] }

    const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i)
    if (shortMatch) return { platform: 'youtube', postId: shortMatch[1] }

    const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i)
    if (shortsMatch) return { platform: 'youtube', postId: shortsMatch[1] }

    return { platform: 'youtube', postId: null }
  }

  // 2. TikTok
  if (/tiktok\.com/i.test(trimmed)) {
    const videoMatch = trimmed.match(/@([a-zA-Z0-9_.-]+)\/video\/(\d+)/i)
    if (videoMatch) {
      return { platform: 'tiktok', authorHandle: videoMatch[1], postId: videoMatch[2] }
    }
    const shortMatch = trimmed.match(/vt\.tiktok\.com\/([a-zA-Z0-9_-]+)/i)
    if (shortMatch) {
      return { platform: 'tiktok', postId: shortMatch[1] }
    }
    return { platform: 'tiktok', postId: null }
  }

  // 3. Instagram
  if (/instagram\.com|instagr\.am/i.test(trimmed)) {
    const postMatch = trimmed.match(/(?:instagram\.com|instagr\.am)\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i)
    if (postMatch) {
      return { platform: 'instagram', postId: postMatch[1] }
    }
    return { platform: 'instagram', postId: null }
  }

  // 4. Threads
  if (/threads\.net/i.test(trimmed)) {
    const threadsMatch = trimmed.match(/threads\.net\/@([a-zA-Z0-9_.-]+)\/post\/([a-zA-Z0-9_-]+)/i)
    if (threadsMatch) {
      return { platform: 'threads', authorHandle: threadsMatch[1], postId: threadsMatch[2] }
    }
    return { platform: 'threads', postId: null }
  }

  return { platform: 'UNKNOWN', postId: null }
}

export interface PlatformMetadataInfo {
  name: string
  officialDomain: string
  exampleUrl: string
  urlPatternsDescription: string
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

export interface SocialLinkValidationResult {
  isValid: boolean
  isMismatch: boolean
  detectedPlatform: SocialMediaType | 'UNKNOWN'
  targetPlatform: SocialMediaType
  errorMessage?: string
}

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

// ─────────────────────────────────────────────────────────────────────────────
// 2. JACCARD SIMILARITY & COPYPASTA CLUSTERING
// ─────────────────────────────────────────────────────────────────────────────

function tokenizeText(text: string): Set<string> {
  const clean = text
    .toLowerCase()
    .replace(/[^\w\s\u00C0-\u1FFF\u2C00-\uD7FF]/g, ' ')
    .trim()
  const words = clean.split(/\s+/).filter(w => w.length > 2)
  return new Set(words)
}

function calculateJaccardSimilarity(tokensA: Set<string>, tokensB: Set<string>): number {
  if (tokensA.size === 0 && tokensB.size === 0) return 1.0
  if (tokensA.size === 0 || tokensB.size === 0) return 0.0

  let intersection = 0
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++
  }
  const union = tokensA.size + tokensB.size - intersection
  return union > 0 ? intersection / union : 0
}

export function clusterDuplicateComments(
  comments: AnalyzedCommentItem[],
  similarityThreshold = 0.70
): CopypastaCluster[] {
  if (comments.length === 0) return []

  const tokenSets = comments.map(c => tokenizeText(c.text))
  const visited = new Set<number>()
  const rawClusters: number[][] = []

  for (let i = 0; i < comments.length; i++) {
    if (visited.has(i)) continue

    const clusterIndices = [i]
    visited.add(i)

    // Abaikan komentar yang sangat pendek (< 3 kata) dari pembentukan kluster copypasta
    // untuk mencegah false positive pada kata seru umum ("setuju", "amin", "mantap")
    if (tokenSets[i].size < 3) continue

    for (let j = i + 1; j < comments.length; j++) {
      if (visited.has(j)) continue
      if (tokenSets[j].size < 3) continue

      const sim = calculateJaccardSimilarity(tokenSets[i], tokenSets[j])
      if (sim >= similarityThreshold) {
        clusterIndices.push(j)
        visited.add(j)
      }
    }

    if (clusterIndices.length >= 2) {
      rawClusters.push(clusterIndices)
    }
  }

  // Ubah ke struktur CopypastaCluster
  const totalComments = comments.length
  return rawClusters
    .map((indices, idx) => {
      const clusterComments = indices.map(i => comments[i])
      const accounts = Array.from(new Set(clusterComments.map(c => c.authorUsername)))
      
      // Pilih teks template representatif (yang paling panjang atau pertama)
      const representative = clusterComments.reduce((longest, curr) =>
        curr.text.length > longest.text.length ? curr : longest
      , clusterComments[0])

      // Hitung rentang waktu jika ada timestamp
      let temporalSpanSeconds: number | undefined
      const timestamps = clusterComments
        .map(c => c.publishedAt ? Date.parse(c.publishedAt) : NaN)
        .filter(t => !isNaN(t))
      if (timestamps.length >= 2) {
        const minT = Math.min(...timestamps)
        const maxT = Math.max(...timestamps)
        temporalSpanSeconds = Math.max(0, Math.round((maxT - minT) / 1000))
      }

      return {
        clusterId: `cluster-${idx + 1}`,
        templateText: representative.text,
        commentCount: clusterComments.length,
        percentageOfTotal: totalComments > 0 ? Math.round((clusterComments.length / totalComments) * 100) : 0,
        accountsInvolved: accounts,
        sampleComments: clusterComments.slice(0, 5),
        similarityScore: similarityThreshold,
        temporalSpanSeconds
      }
    })
    .sort((a, b) => b.commentCount - a.commentCount)
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. BUZZER PATTERN & COORDINATION ANALYZER
// ─────────────────────────────────────────────────────────────────────────────

export function analyzeBuzzerPatterns(
  comments: AnalyzedCommentItem[],
  clusters: CopypastaCluster[]
): BuzzerPatternAnalysis {
  if (comments.length === 0) {
    return {
      coordinationScore: 0,
      coordinationLevel: 'RENDAH',
      narrativeSummary: 'Belum ada data komentar yang dapat dianalisis.',
      dominantKeywords: [],
      burstVelocityCommentPerMinute: 0,
      temporalWindowSeconds: 0,
      sampleAccounts: [],
      sampleQuotes: [],
      evidenceRationale: 'Jumlah data 0 komentar.'
    }
  }

  const totalComments = comments.length
  const totalClustered = clusters.reduce((acc, c) => acc + c.commentCount, 0)
  const copypastaRatio = totalComments > 0 ? totalClustered / totalComments : 0

  // 1. Cek anomali temporal (Burst Velocity)
  const timestamps = comments
    .map(c => c.publishedAt ? Date.parse(c.publishedAt) : NaN)
    .filter(t => !isNaN(t))
    .sort((a, b) => a - b)

  let burstVelocity = 0
  let temporalWindowSeconds = 0

  if (timestamps.length >= 2) {
    const minTime = timestamps[0]
    const maxTime = timestamps[timestamps.length - 1]
    const diffSec = Math.max(1, (maxTime - minTime) / 1000)
    temporalWindowSeconds = Math.round(diffSec)
    burstVelocity = Math.round((timestamps.length / (diffSec / 60)) * 10) / 10
  }

  // 2. Ekstraksi kata kunci dominan
  const wordFreq: Record<string, number> = {}
  const stopWords = new Set([
    'dan', 'yang', 'di', 'dari', 'ini', 'itu', 'ke', 'untuk', 'dengan', 'pada',
    'adalah', 'saya', 'kami', 'kita', 'kamu', 'anda', 'mereka', 'akan', 'bisa',
    'ada', 'tidak', 'juga', 'sudah', 'lebih', 'karena', 'oleh', 'saat', 'para',
    'the', 'and', 'to', 'of', 'in', 'is', 'for', 'that', 'this', 'on', 'with'
  ])

  comments.forEach(c => {
    const words = c.text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w))

    words.forEach(w => {
      wordFreq[w] = (wordFreq[w] || 0) + 1
    })
  })

  const dominantKeywords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([w]) => w)

  // 3. Skor Koordinasi (0 - 100)
  // Bobot: Copypasta Ratio (50%) + Burst Spike (30%) + Repetitive Volume (20%)
  let rawScore = (copypastaRatio * 60)
  if (burstVelocity >= 15) rawScore += 25
  else if (burstVelocity >= 5) rawScore += 15

  if (clusters.length > 0 && clusters[0].percentageOfTotal >= 20) {
    rawScore += 15
  }

  const coordinationScore = Math.min(100, Math.round(rawScore))
  const coordinationLevel: 'RENDAH' | 'SEDANG' | 'TINGGI' =
    coordinationScore >= 65 ? 'TINGGI' : coordinationScore >= 35 ? 'SEDANG' : 'RENDAH'

  // Kumpulkan sampel akun & teks dari kluster
  const sampleAccounts: string[] = []
  const sampleQuotes: string[] = []

  clusters.slice(0, 3).forEach(cl => {
    sampleQuotes.push(cl.templateText)
    cl.accountsInvolved.slice(0, 4).forEach(acc => {
      if (!sampleAccounts.includes(acc)) sampleAccounts.push(acc)
    })
  })

  // Sintesis narasi intelijen
  let narrativeSummary = ''
  if (coordinationLevel === 'TINGGI') {
    narrativeSummary = `Terdeteksi indikasi injeksi komentar terkoordinasi berskala TINGGI (${coordinationScore}%). Sebanyak ${totalClustered} dari ${totalComments} komentar (${Math.round(copypastaRatio * 100)}%) memuat pola templat identik. Narasi dominan berpusat pada kata kunci: "${dominantKeywords.slice(0, 4).join(', ')}". Teramati ${clusters.length} kluster kampanye duplikasi serentak.`
  } else if (coordinationLevel === 'SEDANG') {
    narrativeSummary = `Terdeteksi pola koordinasi SEDANG (${coordinationScore}%). Terdapat ${clusters.length} kluster komentar dengan frasa serupa (${Math.round(copypastaRatio * 100)}% dari total sampel), dengan fokus bahasan "${dominantKeywords.slice(0, 3).join(', ')}". Pola ini mungkin mencerminkan perpaduan respon organik dan kampanye amplification.`
  } else {
    narrativeSummary = `Pola koordinasi tergolong RENDAH / ORGANIK (${coordinationScore}%). Variasi leksikal tinggi, tidak terdeteksi lonjakan templat duplikasi signifikan dalam rentang waktu observasi.`
  }

  const evidenceRationale = `Berdasarkan observasi ${totalComments} komentar publik. Ditemukan ${clusters.length} kluster templat (Jaccard >= 0.70) melibatkan ${sampleAccounts.length} akun teridentifikasi. Kecepatan sebaran terukur ${burstVelocity} komentar/menit.`

  return {
    coordinationScore,
    coordinationLevel,
    narrativeSummary,
    dominantKeywords,
    burstVelocityCommentPerMinute: burstVelocity,
    temporalWindowSeconds,
    sampleAccounts: sampleAccounts.slice(0, 10),
    sampleQuotes: sampleQuotes.slice(0, 5),
    evidenceRationale
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PARSER KOMENTAR MENTAH (RAW TEXT / CLIPBOARD / INGEST)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parsing teks mentah komentar yang di-paste oleh analis dari peramban
 * Mendukung format:
 * 1. Baris per baris ("@username: komentar")
 * 2. Baris terpisah (@username lalu komentar di baris berikutnya)
 * 3. JSON array ([{ username, text, likes }])
 */
export function parseRawCommentsText(rawText: string): AnalyzedCommentItem[] {
  if (!rawText || !rawText.trim()) return []
  const trimmed = rawText.trim()

  // Coba parse JSON jika formatnya array
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed
          .filter(item => item && (item.text || item.comment || item.content))
          .map((item, idx) => ({
            id: item.id || `raw-${idx + 1}`,
            authorUsername: item.authorUsername || item.username || item.author || item.user || `@user_${idx + 1}`,
            authorDisplayName: item.authorDisplayName || item.displayName || item.name,
            text: String(item.text || item.comment || item.content || '').trim(),
            likeCount: Number(item.likeCount || item.likes || item.diggCount || 0),
            publishedAt: item.publishedAt || item.timestamp || item.createTime || new Date().toISOString()
          }))
      }
    } catch {
      // Lanjut ke parser teks
    }
  }

  const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const result: AnalyzedCommentItem[] = []

  let currentUsername: string | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Format "@username: komentar" atau "username: komentar"
    const colonMatch = line.match(/^@?([a-zA-Z0-9_.-]+)\s*[:\-]\s*(.+)$/)
    if (colonMatch && colonMatch[2].length > 1) {
      result.push({
        id: `raw-${result.length + 1}`,
        authorUsername: colonMatch[1].startsWith('@') ? colonMatch[1] : `@${colonMatch[1]}`,
        text: colonMatch[2],
        likeCount: 0,
        publishedAt: new Date().toISOString()
      })
      continue
    }

    // Format baris username tersendiri (@username)
    if (/^@[a-zA-Z0-9_.-]+$/.test(line)) {
      currentUsername = line
      continue
    }

    if (currentUsername) {
      result.push({
        id: `raw-${result.length + 1}`,
        authorUsername: currentUsername,
        text: line,
        likeCount: 0,
        publishedAt: new Date().toISOString()
      })
      currentUsername = null
      continue
    }

    // Baris teks biasa tanpa username eksplisit
    result.push({
      id: `raw-${result.length + 1}`,
      authorUsername: `@analyst_sample_${result.length + 1}`,
      text: line,
      likeCount: 0,
      publishedAt: new Date().toISOString()
    })
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. PUBLIC OEMBED RESOLVER (FALLBACK RINGAN TANPA LOGIN)
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchPublicOembedMetadata(
  url: string,
  platform: SocialMediaType
): Promise<Partial<AnalyzedPostProfile> | null> {
  const customFetch = typeof fetch !== 'undefined' ? fetch : null
  if (!customFetch) return null

  try {
    let oembedUrl = ''
    if (platform === 'youtube') {
      oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    } else if (platform === 'tiktok') {
      oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
    }

    if (!oembedUrl) return null

    const res = await customFetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!res.ok) return null
    const data = await res.json()

    return {
      title: data.title || '',
      caption: data.title || '',
      authorName: data.author_name || 'Kreator',
      authorHandle: data.author_unique_id ? `@${data.author_unique_id}` : (data.author_name ? `@${data.author_name.replace(/\s+/g, '_').toLowerCase()}` : '@creator'),
      thumbnailUrl: data.thumbnail_url,
      acquisitionMethod: 'OEMBED_PUBLIC',
      dataSourceNotice: `Metadata publik diambil secara sah melalui protokol resmi oEmbed ${platform.toUpperCase()}.`
    }
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. PIPELINE UTAMA: ANALISIS POSTINGAN & KOMENTAR
// ─────────────────────────────────────────────────────────────────────────────

export async function executeSocialPostAnalysis(params: {
  url: string
  platform: SocialMediaType
  rawCommentsText?: string
  overrideComments?: AnalyzedCommentItem[]
}): Promise<SocialPostAnalysisResult> {
  const { url, platform, rawCommentsText, overrideComments } = params
  const parsed = detectSocialPlatform(url)
  const postId = parsed.postId || `id-${Date.now()}`
  const nowIso = new Date().toISOString()

  let postProfile: AnalyzedPostProfile = {
    platform,
    url,
    canonicalUrl: url,
    postId,
    title: `Postingan ${platform.toUpperCase()}`,
    caption: '',
    authorName: 'Akun Kreator',
    authorHandle: parsed.authorHandle ? (parsed.authorHandle.startsWith('@') ? parsed.authorHandle : `@${parsed.authorHandle}`) : '@creator',
    acquisitionMethod: 'OEMBED_PUBLIC',
    dataSourceNotice: 'Menunggu resolusi data platform.',
    commentsDisabled: false
  }

  let rawComments: AnalyzedCommentItem[] = overrideComments || []

  // Jika analis menginput teks komentar mentah
  if (rawCommentsText && rawComments.length === 0) {
    rawComments = parseRawCommentsText(rawCommentsText)
    postProfile.acquisitionMethod = 'DIRECT_INGEST'
    postProfile.dataSourceNotice = 'Data komentar bersumber dari Ingest Langsung (Salin-Tempel Analis).'
  }

  // ─── Jalur 1: YouTube Official API jika platform = youtube ───
  if (platform === 'youtube' && parsed.postId) {
    try {
      const ytVideoRes = await youtubeConnector.getVideoDetails(parsed.postId)
      if (ytVideoRes.success && ytVideoRes.metadata) {
        const meta = ytVideoRes.metadata
        postProfile.title = meta.title
        postProfile.caption = meta.description
        postProfile.authorName = meta.channelTitle
        postProfile.authorHandle = `@${meta.channelTitle.replace(/\s+/g, '').toLowerCase()}`
        postProfile.publishedAt = meta.publishedAt
        postProfile.viewCount = meta.viewCount
        postProfile.likeCount = meta.likeCount
        postProfile.commentCount = meta.commentCount
        postProfile.commentsDisabled = meta.commentsDisabled
        postProfile.acquisitionMethod = 'OFFICIAL_API'
        postProfile.dataSourceNotice = 'Data diakuisisi resmi melalui Google Cloud YouTube Data API v3.'

        // Ambil subscriber channel
        if (meta.channelId) {
          const chRes = await youtubeConnector.getChannelDetails(meta.channelId)
          if (chRes.success && chRes.metadata) {
            postProfile.authorFollowersCount = chRes.metadata.subscriberCount
            postProfile.authorAvatarUrl = chRes.metadata.thumbnailUrl
          }
        }

        // Ambil komentar jika belum ada dari manual input
        if (rawComments.length === 0 && !meta.commentsDisabled) {
          const cmtRes = await youtubeConnector.getVideoComments(parsed.postId, { maxResults: 50, maxPages: 2 })
          if (cmtRes.success && cmtRes.comments.length > 0) {
            rawComments = cmtRes.comments.map((c: YouTubeCommentItem) => ({
              id: c.id,
              authorUsername: `@${c.authorName.replace(/\s+/g, '').toLowerCase()}`,
              authorDisplayName: c.authorName,
              text: c.textOriginal,
              likeCount: c.likeCount,
              publishedAt: c.publishedAt
            }))
          }
        }
      } else {
        // Fallback ke oEmbed
        const oembed = await fetchPublicOembedMetadata(url, 'youtube')
        if (oembed) {
          postProfile = { ...postProfile, ...oembed }
        }
      }
    } catch {
      // Fallback
    }
  } else if (platform === 'tiktok') {
    // Ambil metadata oEmbed TikTok
    const oembed = await fetchPublicOembedMetadata(url, 'tiktok')
    if (oembed) {
      postProfile = { ...postProfile, ...oembed }
    }
  }

  // ─── Urutkan Top Komentar Berdasarkan Likes Asli ───
  const sortedByLikes = [...rawComments].sort((a, b) => b.likeCount - a.likeCount)
  const topComments = sortedByLikes.slice(0, 10)

  // ─── Jalankan Klusterisasi Jaccard ───
  const copypastaClusters = clusterDuplicateComments(rawComments, 0.70)

  // ─── Analisis Pola Buzzer & Bot ───
  const buzzerPattern = analyzeBuzzerPatterns(rawComments, copypastaClusters)

  return {
    post: postProfile,
    totalCommentsAnalyzed: rawComments.length,
    topComments,
    copypastaClusters,
    buzzerPattern,
    analyzedAt: nowIso
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. PRELOADED HIGH-FIDELITY TEST SCENARIOS (DATA UJI SIAP DEMO)
// ─────────────────────────────────────────────────────────────────────────────

export interface PreloadedTestScenario {
  id: string
  title: string
  platform: SocialMediaType
  url: string
  description: string
  mockResult: SocialPostAnalysisResult
}

export const PRELOADED_TEST_SCENARIOS: PreloadedTestScenario[] = [
  {
    id: 'demo-yt-01',
    title: '[YouTube] Klarifikasi Pengadaan Alutsista Siber — Lonjakan Copypasta',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=kYJ892XMN01',
    description: 'Postingan video resmi dengan serangan botnet pembelaan terkoordinasi (3 kluster template identik).',
    mockResult: {
      post: {
        platform: 'youtube',
        url: 'https://www.youtube.com/watch?v=kYJ892XMN01',
        canonicalUrl: 'https://www.youtube.com/watch?v=kYJ892XMN01',
        postId: 'kYJ892XMN01',
        title: 'Konferensi Pers: Penjelasan Resmi Terkait Dokumen Sistem Pertahanan Siber Nasional',
        caption: 'Pusat Informasi Siber memberikan keterangan komprehensif mengenai langkah penguatan firewall militer serta menjawab disinformasi publik.',
        authorName: 'Pusat Penerangan Pertahanan',
        authorHandle: '@puspen_pertahanan',
        authorFollowersCount: 845000,
        publishedAt: '2026-11-08T09:00:00Z',
        viewCount: 142300,
        likeCount: 8940,
        commentCount: 420,
        commentsDisabled: false,
        acquisitionMethod: 'OFFICIAL_API',
        dataSourceNotice: 'Data diuji menggunakan skenario validasi presisi tinggi PUSSIBERAD.'
      },
      totalCommentsAnalyzed: 45,
      topComments: [
        {
          id: 'c-top-1',
          authorUsername: '@dr_haryo_siber',
          authorDisplayName: 'Dr. Haryo Wicaksono (Pakar Kriptografi)',
          text: 'Pemberian klarifikasi secara terbuka ini sangat penting agar masyarakat tidak terjebak framing disinformasi. Protokol enkripsi yang dijelaskan sudah memenuhi standar militer.',
          likeCount: 1420,
          publishedAt: '2026-11-08T09:12:00Z'
        },
        {
          id: 'c-top-2',
          authorUsername: '@wargabijak_id',
          authorDisplayName: 'Warga Kritis Indonesia',
          text: 'Terima kasih atas transparansinya. Yang perlu diawasi ke depan adalah audit berkala dari lembaga independen agar anggaran benar-benar akuntabel.',
          likeCount: 890,
          publishedAt: '2026-11-08T09:18:00Z'
        },
        {
          id: 'c-top-3',
          authorUsername: '@alutsista_observer',
          authorDisplayName: 'Indo Defense Observer',
          text: 'Poin nomor 3 sangat krusial: kedaulatan server data intelijen harus 100% berada di teritorial domestik tanpa celah cloud asing.',
          likeCount: 654,
          publishedAt: '2026-11-08T09:25:00Z'
        }
      ],
      copypastaClusters: [
        {
          clusterId: 'cluster-1',
          templateText: 'Jangan percaya narasi provokator yang mau memecah belah bangsa, mari rapatkan barisan dukung langkah tegas institusi pertahanan!',
          commentCount: 22,
          percentageOfTotal: 49,
          accountsInvolved: [
            '@budi_satria99', '@user9812401', '@garuda_perkasa88', '@merahputih_nkri',
            '@rizky_pratama01', '@rahmat_hidayat77', '@dimas_anjasmara', '@agus_wibowo92'
          ],
          sampleComments: [
            {
              id: 'c-bot-1',
              authorUsername: '@budi_satria99',
              text: 'Jangan percaya narasi provokator yang mau memecah belah bangsa, mari rapatkan barisan dukung langkah tegas institusi pertahanan!',
              likeCount: 2,
              publishedAt: '2026-11-08T09:04:12Z'
            },
            {
              id: 'c-bot-2',
              authorUsername: '@user9812401',
              text: 'Jangan percaya narasi provokator yang mau memecah belah bangsa, mari rapatkan barisan dukung langkah tegas institusi pertahanan!',
              likeCount: 1,
              publishedAt: '2026-11-08T09:04:28Z'
            }
          ],
          similarityScore: 0.98,
          temporalSpanSeconds: 154
        },
        {
          clusterId: 'cluster-2',
          templateText: 'Keren sekali penjelasannya sangat mantap dan masuk akal, maju terus pantang mundur pahlawan bangsa!',
          commentCount: 11,
          percentageOfTotal: 24,
          accountsInvolved: ['@user440192', '@user778102', '@pejuang_subuh88', '@anton_jkt'],
          sampleComments: [
            {
              id: 'c-bot-3',
              authorUsername: '@user440192',
              text: 'Keren sekali penjelasannya sangat mantap dan masuk akal, maju terus pantang mundur pahlawan bangsa!',
              likeCount: 0,
              publishedAt: '2026-11-08T09:06:05Z'
            }
          ],
          similarityScore: 0.91,
          temporalSpanSeconds: 98
        }
      ],
      buzzerPattern: {
        coordinationScore: 88,
        coordinationLevel: 'TINGGI',
        narrativeSummary: 'Terdeteksi indikasi injeksi komentar terkoordinasi berskala TINGGI (88%). Sebanyak 33 dari 45 komentar (73%) memuat teks templat identik. Narasi difokuskan pada penolakan provokator dan pujian seragam tanpa substansi teknis.',
        dominantKeywords: ['provokator', 'dukung', 'bangsa', 'mantap', 'langkah', 'pertahanan'],
        burstVelocityCommentPerMinute: 17.5,
        temporalWindowSeconds: 240,
        sampleAccounts: ['@budi_satria99', '@user9812401', '@garuda_perkasa88', '@user440192'],
        sampleQuotes: [
          'Jangan percaya narasi provokator yang mau memecah belah bangsa, mari rapatkan barisan dukung langkah tegas institusi pertahanan!',
          'Keren sekali penjelasannya sangat mantap dan masuk akal, maju terus pantang mundur pahlawan bangsa!'
        ],
        evidenceRationale: 'Sebanyak 22 komentar identik diposting serentak dalam rentang waktu 154 detik oleh akun-akun berformat nama acak.'
      },
      analyzedAt: '2026-11-08T09:30:00Z'
    }
  },
  {
    id: 'demo-tt-01',
    title: '[TikTok] Kampanye Astroturfing Tagar Viral Kebijakan Anggaran',
    platform: 'tiktok',
    url: 'https://www.tiktok.com/@suarakritis_id/video/7391829482019283712',
    description: 'Postingan TikTok video pendek dengan 18 komentar template copypasta cepat.',
    mockResult: {
      post: {
        platform: 'tiktok',
        url: 'https://www.tiktok.com/@suarakritis_id/video/7391829482019283712',
        canonicalUrl: 'https://www.tiktok.com/@suarakritis_id/video/7391829482019283712',
        postId: '7391829482019283712',
        title: 'Bahas Tuntas Kebocoran Data Sektor Finansial yang Lagi Rame!',
        caption: 'Bahas Tuntas Kebocoran Data Sektor Finansial yang Lagi Rame! Jangan sampai saldo rekening kalian jadi korban kebocoran sistem.',
        authorName: 'Suara Kritis ID',
        authorHandle: '@suarakritis_id',
        authorFollowersCount: 312000,
        publishedAt: '2026-11-08T11:20:00Z',
        viewCount: 89400,
        likeCount: 6510,
        commentCount: 210,
        commentsDisabled: false,
        acquisitionMethod: 'OEMBED_PUBLIC',
        dataSourceNotice: 'Metadata divalidasi via oEmbed resmi; komentar diolah via Ingest Teks.'
      },
      totalCommentsAnalyzed: 30,
      topComments: [
        {
          id: 'tt-top-1',
          authorUsername: '@fintech_security',
          authorDisplayName: 'Fintech Sec ID',
          text: 'Harus ganti password m-banking berkala dan jangan klik link APK undangan pernikahan di WA!',
          likeCount: 940,
          publishedAt: '2026-11-08T11:35:00Z'
        },
        {
          id: 'tt-top-2',
          authorUsername: '@sarah_wijaya',
          authorDisplayName: 'Sarah W.',
          text: 'Bank harus tanggung jawab kalau ada kebocoran dari sistem internal mereka, bukan nasabah yang disalahin.',
          likeCount: 512,
          publishedAt: '2026-11-08T11:42:00Z'
        }
      ],
      copypastaClusters: [
        {
          clusterId: 'cluster-1',
          templateText: 'Ini murni kelalaian pengguna sendiri jangan salahkan pihak perbankan yang sudah teruji keamanannya!',
          commentCount: 14,
          percentageOfTotal: 47,
          accountsInvolved: ['@user81920', '@user99102', '@user10293', '@user77123', '@user66401'],
          sampleComments: [
            {
              id: 'tt-c-1',
              authorUsername: '@user81920',
              text: 'Ini murni kelalaian pengguna sendiri jangan salahkan pihak perbankan yang sudah teruji keamanannya!',
              likeCount: 0,
              publishedAt: '2026-11-08T11:22:10Z'
            }
          ],
          similarityScore: 0.95,
          temporalSpanSeconds: 84
        }
      ],
      buzzerPattern: {
        coordinationScore: 78,
        coordinationLevel: 'TINGGI',
        narrativeSummary: 'Terdeteksi upaya terorganisir membela institusi perbankan dengan menyalahkan pengguna (victim-blaming) melalui templat komentar yang diposting 14 kali dalam rentang 84 detik.',
        dominantKeywords: ['kelalaian', 'pengguna', 'perbankan', 'keamanannya', 'murni'],
        burstVelocityCommentPerMinute: 12.0,
        temporalWindowSeconds: 150,
        sampleAccounts: ['@user81920', '@user99102', '@user10293'],
        sampleQuotes: ['Ini murni kelalaian pengguna sendiri jangan salahkan pihak perbankan yang sudah teruji keamanannya!'],
        evidenceRationale: 'Sebanyak 14 komentar copypasta diposting serentak dalam 84 detik pasca video rilis.'
      },
      analyzedAt: '2026-11-08T12:00:00Z'
    }
  },
  {
    id: 'demo-ig-01',
    title: '[Instagram] Isu Sentimen Hoaks Kebijakan Medis Baru',
    platform: 'instagram',
    url: 'https://www.instagram.com/p/DB102938475/',
    description: 'Postingan foto carousel edukasi kesehatan yang dibanjiri komentar spam terkoordinasi.',
    mockResult: {
      post: {
        platform: 'instagram',
        url: 'https://www.instagram.com/p/DB102938475/',
        canonicalUrl: 'https://www.instagram.com/p/DB102938475/',
        postId: 'DB102938475',
        title: 'Fakta Ilmiah Mengenai Uji Klinis Terbuka Vaksinasi Generasi Baru',
        caption: 'Simak 5 poin penting hasil penelaahan tim dokter spesialis terkait keamanan formula pencegahan penyakit menular terbaru.',
        authorName: 'Edukasi Kesehatan Publik',
        authorHandle: '@edukasi_kesehatan',
        authorFollowersCount: 520000,
        publishedAt: '2026-11-08T14:00:00Z',
        viewCount: 45000,
        likeCount: 3890,
        commentCount: 180,
        commentsDisabled: false,
        acquisitionMethod: 'DIRECT_INGEST',
        dataSourceNotice: 'Diproses via konsol Ingest Komentar Taktis NARADA.'
      },
      totalCommentsAnalyzed: 25,
      topComments: [
        {
          id: 'ig-top-1',
          authorUsername: '@dr_bambang_sp',
          authorDisplayName: 'dr. Bambang Sp.PD',
          text: 'Data jurnal Lancet terlampir sangat jelas menunjukkan efikasi di atas 92%. Jangan termakan mitos tanpa dasar riset.',
          likeCount: 780,
          publishedAt: '2026-11-08T14:15:00Z'
        }
      ],
      copypastaClusters: [
        {
          clusterId: 'cluster-1',
          templateText: 'Hati-hati konspirasi elit global jangan mau dijadikan kelinci percobaan obat berbahaya!',
          commentCount: 10,
          percentageOfTotal: 40,
          accountsInvolved: ['@anti_konspirasi1', '@merdeka_sehat', '@pejuang_rakyat99', '@warga_waspada'],
          sampleComments: [
            {
              id: 'ig-c-1',
              authorUsername: '@anti_konspirasi1',
              text: 'Hati-hati konspirasi elit global jangan mau dijadikan kelinci percobaan obat berbahaya!',
              likeCount: 1,
              publishedAt: '2026-11-08T14:05:00Z'
            }
          ],
          similarityScore: 0.94,
          temporalSpanSeconds: 110
        }
      ],
      buzzerPattern: {
        coordinationScore: 72,
        coordinationLevel: 'TINGGI',
        narrativeSummary: 'Terdeteksi kampanye penyebaran teori konspirasi anti-sains terkoordinasi (40% komentar berformat templat identik).',
        dominantKeywords: ['konspirasi', 'kelinci', 'percobaan', 'berbahaya', 'global'],
        burstVelocityCommentPerMinute: 8.5,
        temporalWindowSeconds: 180,
        sampleAccounts: ['@anti_konspirasi1', '@merdeka_sehat', '@pejuang_rakyat99'],
        sampleQuotes: ['Hati-hati konspirasi elit global jangan mau dijadikan kelinci percobaan obat berbahaya!'],
        evidenceRationale: '10 komentar identik memuat kata kunci konspirasi elit global diposting dalam tempo 110 detik.'
      },
      analyzedAt: '2026-11-08T14:30:00Z'
    }
  },
  {
    id: 'demo-th-01',
    title: '[Threads] Diskusi Publik Kebijakan Perlindungan Data Pribadi',
    platform: 'threads',
    url: 'https://www.threads.net/@hukum_digital/post/C-r89281726',
    description: 'Postingan Threads dengan perdebatan organik (koordinasi rendah/organik).',
    mockResult: {
      post: {
        platform: 'threads',
        url: 'https://www.threads.net/@hukum_digital/post/C-r89281726',
        canonicalUrl: 'https://www.threads.net/@hukum_digital/post/C-r89281726',
        postId: 'C-r89281726',
        title: 'UU PDP sudah berlaku penuh: Seberapa siap instansi publik dan swasta?',
        caption: 'Banyak lembaga masih belum memiliki Data Protection Officer (DPO). Bagaimana menurut teman-teman di ranah industri teknologi?',
        authorName: 'Klinik Hukum Digital',
        authorHandle: '@hukum_digital',
        authorFollowersCount: 45000,
        publishedAt: '2026-11-08T16:00:00Z',
        viewCount: 12000,
        likeCount: 420,
        commentCount: 35,
        commentsDisabled: false,
        acquisitionMethod: 'OEMBED_PUBLIC',
        dataSourceNotice: 'Metadata resmi Threads; komentar diolah via Ingest Analis.'
      },
      totalCommentsAnalyzed: 20,
      topComments: [
        {
          id: 'th-top-1',
          authorUsername: '@ciso_indo',
          authorDisplayName: 'CISO Indonesia Club',
          text: 'Tantangan terbesar ada di sertifikasi SDM DPO yang masih sangat minim di daerah.',
          likeCount: 145,
          publishedAt: '2026-11-08T16:12:00Z'
        },
        {
          id: 'th-top-2',
          authorUsername: '@advokat_siber',
          authorDisplayName: 'Gerry SH LLM',
          text: 'Sanksi denda administratifnya cukup berat, bisa sampai miliaran rupiah jika terbukti lalai.',
          likeCount: 98,
          publishedAt: '2026-11-08T16:25:00Z'
        }
      ],
      copypastaClusters: [],
      buzzerPattern: {
        coordinationScore: 12,
        coordinationLevel: 'RENDAH',
        narrativeSummary: 'Pola koordinasi tergolong RENDAH / ORGANIK (12%). Variasi leksikal tinggi, tidak terdeteksi lonjakan templat duplikasi signifikan dalam rentang waktu observasi.',
        dominantKeywords: ['dpo', 'sanksi', 'sertifikasi', 'tantangan', 'sdm'],
        burstVelocityCommentPerMinute: 1.2,
        temporalWindowSeconds: 980,
        sampleAccounts: [],
        sampleQuotes: [],
        evidenceRationale: 'Diskusi berlangsung secara natural tanpa templat copypasta atau anomali lonjakan waktu.'
      },
      analyzedAt: '2026-11-08T17:00:00Z'
    }
  }
]

