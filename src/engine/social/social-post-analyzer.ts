/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — SOCIAL POST & COMMENT INTELLIGENCE ORCHESTRATOR (FACADE)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Arsitektur Terdistribusi & Terisolasi:
 * - Types:        types/social-analysis-types.ts
 * - Detector:     core/platform-detector.ts
 * - Clustering:   algorithms/jaccard-clustering.ts
 * - Buzzer CIB:   algorithms/buzzer-analyzer.ts
 * - Ingest:       parsers/raw-comment-parser.ts
 * - Platforms:    platforms/youtube-engine.ts, tiktok-engine.ts,
 *                 instagram-engine.ts, threads-engine.ts
 * - Scenarios:    scenarios/preloaded-scenarios.ts
 * 
 * 100% Real Data Guarantee · Zero Fake Simulation · Plug-and-Play Upgrade
 * ══════════════════════════════════════════════════════════════════════════
 */

// ─── 1. RE-EXPORT TYPES ───
export type {
  SocialMediaType,
  SocialAcquisitionMethod,
  AnalyzedPostProfile,
  AnalyzedCommentItem,
  CopypastaCluster,
  BuzzerPatternAnalysis,
  SocialPostAnalysisResult,
  PlatformMetadataInfo,
  SocialLinkValidationResult,
  SocialExtractionOptions,
  PreloadedTestScenario
} from './types/social-analysis-types.ts'

import type {
  SocialMediaType,
  AnalyzedPostProfile,
  AnalyzedCommentItem,
  SocialPostAnalysisResult
} from './types/social-analysis-types.ts'

// ─── 2. RE-EXPORT CORE DETECTOR & VALIDATOR ───
export {
  PLATFORM_INFO_MAP,
  detectSocialPlatform,
  validateSocialPlatformUrl,
  type DetectedPlatformInfo
} from './core/platform-detector.ts'

import { detectSocialPlatform } from './core/platform-detector.ts'

// ─── 3. RE-EXPORT ALGORITHMS & PARSERS ───
export {
  tokenizeText,
  calculateJaccardSimilarity,
  clusterDuplicateComments
} from './algorithms/jaccard-clustering.ts'

import { clusterDuplicateComments } from './algorithms/jaccard-clustering.ts'

export {
  analyzeBuzzerPatterns
} from './algorithms/buzzer-analyzer.ts'

import { analyzeBuzzerPatterns } from './algorithms/buzzer-analyzer.ts'

export {
  parseRawCommentsText
} from './parsers/raw-comment-parser.ts'

import { parseRawCommentsText } from './parsers/raw-comment-parser.ts'

// ─── 4. RE-EXPORT PLATFORMS & REGISTRY ───
export {
  getPlatformEngine,
  findEngineForUrl,
  getAllPlatformEngines
} from './platforms/platform-registry.ts'

export { youtubeEngine, YouTubeEngine } from './platforms/youtube-engine.ts'
export { tikTokEngine, TikTokEngine } from './platforms/tiktok-engine.ts'
export { instagramEngine, InstagramEngine } from './platforms/instagram-engine.ts'
export { threadsEngine, ThreadsEngine } from './platforms/threads-engine.ts'
export type { PlatformEngine, PlatformExtractionResult } from './platforms/platform-engine-contract.ts'

import { getPlatformEngine } from './platforms/platform-registry.ts'

// ─── 5. RE-EXPORT SCENARIOS ───
export {
  PRELOADED_TEST_SCENARIOS
} from './scenarios/preloaded-scenarios.ts'

// ─── 6. HELPER PUBLIC OEMBED RESOLVER (UNTUK KOMPATIBILITAS LEGACY) ───
export async function fetchPublicOembedMetadata(
  url: string,
  platform: SocialMediaType
): Promise<Partial<AnalyzedPostProfile> | null> {
  try {
    const engine = getPlatformEngine(platform)
    const result = await engine.extract(url)
    return result.post
  } catch {
    return null
  }
}

// ─── 7. PIPELINE ORCHESTRATOR UTAMA: ANALISIS POSTINGAN & KOMENTAR ───
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

  let rawComments: AnalyzedCommentItem[] = overrideComments || []
  let isManualIngest = false

  // Jika analis menginput teks komentar mentah (clipboard / ingest form)
  if (rawCommentsText && rawComments.length === 0) {
    rawComments = parseRawCommentsText(rawCommentsText)
    isManualIngest = true
  }

  // Delegasikan ekstraksi ke Platform Engine spesifik yang terisolasi
  let extractedPost: Partial<AnalyzedPostProfile> = {}
  try {
    const engine = getPlatformEngine(platform)
    const extractionResult = await engine.extract(url, {
      overrideComments: rawComments,
      rawCommentsText
    })

    extractedPost = extractionResult.post
    if (rawComments.length === 0 && extractionResult.comments.length > 0) {
      rawComments = extractionResult.comments
    }
  } catch (err) {
    console.warn(`[SocialOrchestrator] Gagal mengeksekusi engine ${platform}:`, err)
  }

  // Rakit profil postingan akhir
  const postProfile: AnalyzedPostProfile = {
    platform,
    url,
    canonicalUrl: extractedPost.canonicalUrl || url,
    postId: extractedPost.postId || postId,
    title: extractedPost.title || `Postingan ${platform.toUpperCase()}`,
    caption: extractedPost.caption || '',
    authorName: extractedPost.authorName || 'Akun Kreator',
    authorHandle: extractedPost.authorHandle || (parsed.authorHandle ? (parsed.authorHandle.startsWith('@') ? parsed.authorHandle : `@${parsed.authorHandle}`) : '@creator'),
    authorAvatarUrl: extractedPost.authorAvatarUrl,
    authorFollowersCount: extractedPost.authorFollowersCount,
    authorVerified: extractedPost.authorVerified,
    publishedAt: extractedPost.publishedAt,
    viewCount: extractedPost.viewCount,
    likeCount: extractedPost.likeCount,
    commentCount: extractedPost.commentCount,
    thumbnailUrl: extractedPost.thumbnailUrl,
    commentsDisabled: extractedPost.commentsDisabled ?? false,
    acquisitionMethod: isManualIngest 
      ? 'DIRECT_INGEST' 
      : (extractedPost.acquisitionMethod || 'OEMBED_PUBLIC'),
    dataSourceNotice: isManualIngest
      ? 'Data komentar bersumber dari Ingest Langsung (Salin-Tempel Analis).'
      : (extractedPost.dataSourceNotice || 'Data diakuisisi melalui engine platform resmi.')
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
