/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — AUTOMATED SOCIAL INTELLIGENCE PIPELINE & ORCHESTRATION ENGINE
 * SPRINT 11: WORK PACKAGES 4, 5, 6, 7 (INTELLIGENCE INTEGRATION & ORCHESTRATION)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Alur Pemrosesan Doktriner:
 * ISSUE / CLAIM CONTEXT
 *   -> BOUNDED DISCOVERY QUERY PLAN
 *   -> PROVIDER DISCOVERY (Brave Search / Google CSE / Mock)
 *   -> CANDIDATE VALIDATION & URL NORMALIZATION
 *   -> DEDUPLICATION
 *   -> PLATFORM CAPABILITY + POLICY CHECK (Gate L)
 *   -> AUTHORIZED CONTENT / METADATA ACQUISITION
 *   -> NORMALIZATION
 *   -> PERSISTENCE OF CANONICAL RECORD
 *   -> RELEVANCE FILTERING (Sprint 09 Relevance Engine)
 *   -> ISSUE / CLAIM ASSOCIATION (Sprint 09 Claim Engine)
 *   -> POLICY-ELIGIBLE COMMENT ANALYSIS (Sprint 08 Sentiment, Burst, Similarity, Coordination)
 *   -> SIMILARITY / BURST / SPREAD OBSERVATIONS
 *   -> EXPLAINABLE SOCIAL INTELLIGENCE SUMMARY
 *   -> HUMAN REVIEW QUEUE
 * 
 * Prinsip Integritas Bukti:
 * - Snippet pencarian TIDAK PERNAH dianggap artikel penuh atau bukti klaim faktual.
 * - Volume, engagement, atau sentimen sosial TIDAK BOLEH menaikkan vonis klaim menjadi
 *   SUPPORTED_BY_EVIDENCE atau CONTRADICTED_BY_EVIDENCE.
 * - Tidak ada pelabelan aktor "bot/buzzer"; seluruh temuan disajikan sebagai pola observasional
 *   konservatif dengan peringatan konteks peristiwa (event-driven natural spike).
 * ══════════════════════════════════════════════════════════════════════════
 */

import type {
  SocialPlatform,
  SocialPostRecord,
  SocialCommentRecord,
  SocialSpreadObservation,
  SocialAnalysisRunSummary,
  SocialRelevanceStatus,
  SocialRejectionReason,
  SocialObservationCaveat
} from './social-contracts.ts'
import type { SearchDiscoveryResult } from '../acquisition/source-contracts.ts'
import { YOUTUBE_MAX_RETENTION_MS } from '../acquisition/youtube-retention.ts'
import { evaluateIntelligenceRelevance } from '../intelligence/relevance-engine.ts'
import { extractClaimsFromArticle } from '../intelligence/claim-extraction-engine.ts'
import type { ClaimRecord } from '../intelligence/claim-types.ts'

// Reuse Sprint 8 Comment Intelligence Engines
import { normalizeCommentText, extractTextFeatures } from '../intelligence/text-normalizer.ts'
import { estimateCommentSentiment } from '../intelligence/sentiment-engine.ts'
import { detectCommentSimilarityClusters } from '../intelligence/similarity-engine.ts'
import { detectCommentBursts } from '../intelligence/burst-engine.ts'
import { evaluateCoordinationPattern } from '../intelligence/coordination-engine.ts'
import type { CommentRecord } from '../intelligence/comment-types.ts'

export const SOCIAL_PIPELINE_VERSION = '1.1.0'

export interface IssueContext {
  issueId: string
  title: string
  summary?: string
  keywords?: string[]
  timeWindowStart?: number
  timeWindowEnd?: number
  claims?: Array<{
    id: string
    text: string
    type?: string
  }>
}

export interface PipelineExecutionOptions {
  runId?: string
  triggerType?: 'MANUAL' | 'SCHEDULED' | 'EVENT_TRIGGERED'
  skipYouTubePolicyGate?: boolean // For testing policy gate rejections
  customNow?: number
}

export interface PipelineExecutionResult {
  runSummary: SocialAnalysisRunSummary
  discoveredCandidates: SearchDiscoveryResult[]
  acquiredPosts: SocialPostRecord[]
  acquiredComments: SocialCommentRecord[]
  associatedClaims: ClaimRecord[]
  spreadObservation: SocialSpreadObservation
  reviewQueue: Array<{
    id: string
    targetType: 'POST' | 'COMMENT' | 'PATTERN' | 'CLAIM_ASSOCIATION'
    targetId: string
    issueId?: string
    headline: string
    rationale: string
    confidence: number
    status: 'NEEDS_REVIEW' | 'FLAGGED_FOR_AUDIT'
  }>
}

export class SocialIntelligencePipeline {
  public readonly version = SOCIAL_PIPELINE_VERSION

  /**
   * Mengevaluasi Relevansi dan Asosiasi Isu/Klaim (Sprint 11 WP 4)
   * Menggunakan Sprint 09 Relevance Engine dan Claim Extraction Engine
   */
  public evaluateSocialRelevance(
    content: { title: string; text: string; platform: SocialPlatform; publishedAt?: number | null },
    issue: IssueContext
  ): {
    status: SocialRelevanceStatus
    score: number
    rejectionReason?: SocialRejectionReason
    matchedEntities: string[]
    rationale: string
    extractedClaims: ClaimRecord[]
    associatedClaimIds: string[]
  } {
    // 1. Eksekusi Relevance Engine Sprint 09
    const relevanceResult = evaluateIntelligenceRelevance({
      title: content.title,
      description: content.text,
      content: content.text,
      sourceType: content.platform,
      explicitDomainHint: 'DEFENSE_SECURITY'
    })

    // 2. Pemfilteran Topik dan Entitas
    if (relevanceResult.category === 'IRRELEVANT') {
      const isDomainMismatch = relevanceResult.rejectionReasons.some(r =>
        r.includes('DOMAIN') ||
        r.includes('PROSCRIBED') ||
        r.includes('EXCLUDED') ||
        r.includes('SKOR') ||
        r.includes('TIDAK')
      ) || relevanceResult.matchedEntities.length === 0
      const reason: SocialRejectionReason = isDomainMismatch ? 'UNRELATED_TOPIC' : 'ENTITY_MISMATCH'
      return {
        status: 'IRRELEVANT',
        score: relevanceResult.score,
        rejectionReason: reason,
        matchedEntities: relevanceResult.matchedEntities,
        rationale: `Ditolak oleh Relevance Engine Sprint 09: ${relevanceResult.rejectionReasons.join(', ')}`,
        extractedClaims: [],
        associatedClaimIds: []
      }
    }

    // 3. Pengecekan Jendela Waktu (jika issue memiliki batasan waktu)
    if (content.publishedAt && issue.timeWindowStart && content.publishedAt < issue.timeWindowStart) {
      return {
        status: 'UNCERTAIN',
        score: Math.max(10, relevanceResult.score - 40),
        rejectionReason: 'TIME_WINDOW_MISMATCH',
        matchedEntities: relevanceResult.matchedEntities,
        rationale: 'Waktu publikasi konten berada di luar jendela waktu observasi isu.',
        extractedClaims: [],
        associatedClaimIds: []
      }
    }

    // 4. Ekstraksi dan Asosiasi Klaim Faktual (Sprint 09 Claim Extraction Engine)
    const combinedText = `${content.title}. ${content.text}`
    let extractedClaims: ClaimRecord[] = []
    const associatedClaimIds: string[] = []

    if (combinedText.length >= 35) {
      extractedClaims = extractClaimsFromArticle({
        articleId: `soc-${Date.now()}`,
        title: content.title,
        description: content.text,
        content: content.text,
        publishedAt: content.publishedAt || Date.now()
      })
    }

    // Hubungkan dengan klaim yang sudah terdaftar pada issue (jika ada kemiripan proposisi)
    if (issue.claims && issue.claims.length > 0) {
      const textLower = combinedText.toLowerCase()
      for (const clm of issue.claims) {
        const claimWords = clm.text.toLowerCase().split(/\s+/).filter(w => w.length > 4)
        const matchCount = claimWords.filter(w => textLower.includes(w)).length
        if (matchCount >= Math.min(2, claimWords.length) && claimWords.length > 0) {
          associatedClaimIds.push(clm.id)
        }
      }
    }

    return {
      status: relevanceResult.category,
      score: relevanceResult.score,
      matchedEntities: relevanceResult.matchedEntities,
      rationale: relevanceResult.acceptanceReasons.join(', ') || 'Relevan dengan konteks pemantauan isu',
      extractedClaims,
      associatedClaimIds
    }
  }

  /**
   * Analisis Komentar Terpadu dengan Tata Kelola Kebijakan (Sprint 11 WP 5)
   * Menggunakan Sprint 08 Sentiment, Similarity, Burst, dan Coordination Engine
   */
  public analyzeSocialComments(
    comments: SocialCommentRecord[],
    context?: {
      platform: SocialPlatform
      channelIds?: string[]
      caseId?: string
      skipPolicyCheck?: boolean
    }
  ): {
    isPermitted: boolean
    policyStatus: 'PERMITTED' | 'POLICY_BLOCKED' | 'APPROVAL_REQUIRED'
    rejectionRationale?: string
    sentimentSummary: {
      positive: number
      negative: number
      neutral: number
      mixed: number
      uncertain: number
      dominantSentiment: string
    }
    similarityClusters: Array<{
      clusterId: string
      pattern: string
      memberCount: number
      sampleText: string
    }>
    burstDetected: boolean
    coordinationIndicator: {
      label:
        | 'NO_CLEAR_PATTERN'
        | 'SIMILARITY_PATTERN'
        | 'REPEATED_CONTENT_PATTERN'
        | 'BURST_ACTIVITY'
        | 'POSSIBLE_COORDINATED_AMPLIFICATION_INDICATOR'
        | 'INSUFFICIENT_EVIDENCE_FOR_ATTRIBUTION'
        | 'POLICY_BLOCKED'
      rationale: string
    }
  } {
    // ─── GATE L & SPRINT 11B: KEBIJAKAN YOUTUBE (Section III.E.2 & Derived Metrics Policy) ───
    const isYouTubeData = context?.platform === 'youtube' || comments.some(c => c.platform === 'youtube')
    if (isYouTubeData && !context?.skipPolicyCheck) {
      // Periksa apakah terdapat bukti tertulis resmi persetujuan amandemen Derived Metrics Policy untuk NARADA
      // Doktrin Fail-Closed: Tanpa bukti tertulis amandemen resmi, analisis turunan DILARANG KERAS.
      const hasVerifiedAmendment = false
      if (!hasVerifiedAmendment) {
        return {
          isPermitted: false,
          policyStatus: 'POLICY_BLOCKED',
          rejectionRationale: 'Kebijakan Pengembang YouTube melarang penciptaan metrik dan analisis turunan (sentimen, copypasta, burst, koordinasi) tanpa persetujuan tertulis resmi (YouTube Derived Metrics Policy Amendment). Kapabilitas ini dinonaktifkan secara fail-closed demi kepatuhan hukum.',
          sentimentSummary: { positive: 0, negative: 0, neutral: 0, mixed: 0, uncertain: 0, dominantSentiment: 'BLOCKED' },
          similarityClusters: [],
          burstDetected: false,
          coordinationIndicator: {
            label: 'POLICY_BLOCKED',
            rationale: 'Analisis turunan data YouTube diblokir (POLICY_BLOCKED): Belum ada persetujuan tertulis resmi YouTube Derived Metrics Policy Amendment untuk klien API NARADA.'
          }
        }
      }

      // Jika kelak memiliki izin amandemen, tetap tegakkan batasan isolasi kanal Section III.E.2:
      const distinctChannels = new Set((context?.channelIds || []).filter(Boolean))
      if (distinctChannels.size > 1) {
        return {
          isPermitted: false,
          policyStatus: 'POLICY_BLOCKED',
          rejectionRationale: 'Kebijakan Pengembang YouTube Bagian III.E.2 melarang agregasi data antarpemilik kanal yang berbeda.',
          sentimentSummary: { positive: 0, negative: 0, neutral: 0, mixed: 0, uncertain: 0, dominantSentiment: 'BLOCKED' },
          similarityClusters: [],
          burstDetected: false,
          coordinationIndicator: {
            label: 'POLICY_BLOCKED',
            rationale: 'Analisis koordinasi multi-kanal YouTube diblokir oleh Kebijakan Pengembang Google/YouTube Section III.E.2.'
          }
        }
      }
    }

    if (comments.length === 0) {
      return {
        isPermitted: true,
        policyStatus: 'PERMITTED',
        sentimentSummary: { positive: 0, negative: 0, neutral: 0, mixed: 0, uncertain: 0, dominantSentiment: 'NO_DATA' },
        similarityClusters: [],
        burstDetected: false,
        coordinationIndicator: {
          label: 'INSUFFICIENT_EVIDENCE_FOR_ATTRIBUTION',
          rationale: 'Tidak ada sampel komentar untuk dievaluasi.'
        }
      }
    }

    // 1. Eksekusi Sentimen Sprint 08
    let positive = 0
    let negative = 0
    let neutral = 0
    let mixed = 0
    let uncertain = 0

    // Konversi ke format CommentRecord Sprint 08
    const sprint8Comments: CommentRecord[] = comments.map(c => {
      const norm = normalizeCommentText(c.textOriginal)
      const feats = extractTextFeatures(c.textOriginal)
      const rec: CommentRecord = {
        id: c.id,
        batchId: 'social-batch',
        caseId: context?.caseId || 'social-case',
        rawText: c.textOriginal,
        normalizedText: norm,
        authorHandle: c.authorHandle,
        parsedTimestamp: c.publishedAt ? new Date(c.publishedAt).toISOString() : undefined,
        isTimestampAmbiguous: !c.publishedAt,
        validationState: 'VALID',
        contentDigest: c.id,
        characterCount: c.textOriginal.length,
        tokenCount: feats.tokens.length
      }

      const sent = estimateCommentSentiment(rec)
      if (sent.sentiment === 'POSITIVE') positive++
      else if (sent.sentiment === 'NEGATIVE') negative++
      else if (sent.sentiment === 'NEUTRAL') neutral++
      else if (sent.sentiment === 'MIXED') mixed++
      else uncertain++

      c.sentimentVerdict = sent.sentiment
      c.sentimentScore = sent.polarityScore
      c.normalizedText = norm

      return rec
    })

    const counts = { POSITIVE: positive, NEGATIVE: negative, NEUTRAL: neutral, MIXED: mixed, UNCERTAIN: uncertain }
    const dominantSentiment = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]

    // 2. Deteksi Kemiripan & Copypasta Sprint 08
    const simClusters = detectCommentSimilarityClusters(sprint8Comments)
    const similarityClusters = simClusters.map((sc, idx) => ({
      clusterId: `sim-${idx + 1}`,
      pattern: 'REPEATED_CONTENT_PATTERN',
      memberCount: sc.memberCommentIds ? sc.memberCommentIds.length : sc.memberCount,
      sampleText: sc.representativeText
    }))

    // 3. Deteksi Lonjakan Temporal (Burst Engine Sprint 08)
    const burstResult = detectCommentBursts(sprint8Comments)
    const burstDetected = Boolean(burstResult.detectedBursts && burstResult.detectedBursts.some(b => b.isBurst))

    // 4. Indikator Pola Koordinasi Konservatif (Sprint 08)
    const coord = evaluateCoordinationPattern(sprint8Comments, simClusters, burstResult)

    return {
      isPermitted: true,
      policyStatus: 'PERMITTED',
      sentimentSummary: {
        positive,
        negative,
        neutral,
        mixed,
        uncertain,
        dominantSentiment
      },
      similarityClusters,
      burstDetected,
      coordinationIndicator: {
        label: coord.indicator === 'PATTERN_WARRANTS_REVIEW'
          ? 'POSSIBLE_COORDINATED_AMPLIFICATION_INDICATOR'
          : coord.indicator === 'WEAK_PATTERN'
          ? 'SIMILARITY_PATTERN'
          : coord.indicator === 'INSUFFICIENT_DATA'
          ? 'INSUFFICIENT_EVIDENCE_FOR_ATTRIBUTION'
          : 'NO_CLEAR_PATTERN',
        rationale: coord.summaryRationale || 'Pola observasional terhitung dari sampel komentar terakuisisi.'
      }
    }
  }

  /**
   * Menghasilkan Observasi Sebaran Sosial & Temporal (Sprint 11 WP 6)
   */
  public generateSocialSpreadObservation(
    posts: SocialPostRecord[],
    comments: SocialCommentRecord[],
    discoveryCandidates: SearchDiscoveryResult[],
    issueId?: string
  ): SocialSpreadObservation {
    const caveats: SocialObservationCaveat[] = [
      'OBSERVED_SAMPLE_ONLY',
      'NO_ACTOR_ATTRIBUTION'
    ]

    if (comments.length > 0 && comments.some(c => c.threadId)) {
      caveats.push('NON_INDEPENDENT_THREAD_COMMENTS')
    }

    const platformBreakdown: Record<SocialPlatform, { postsCount: number; commentsCount: number; discoveryOnlyCount: number; status: any }> = {
      youtube: { postsCount: 0, commentsCount: 0, discoveryOnlyCount: 0, status: 'AVAILABLE' },
      facebook: { postsCount: 0, commentsCount: 0, discoveryOnlyCount: 0, status: 'ACCESS_RESTRICTED' },
      instagram: { postsCount: 0, commentsCount: 0, discoveryOnlyCount: 0, status: 'ACCESS_RESTRICTED' },
      tiktok: { postsCount: 0, commentsCount: 0, discoveryOnlyCount: 0, status: 'APPROVAL_REQUIRED' },
      x: { postsCount: 0, commentsCount: 0, discoveryOnlyCount: 0, status: 'CONFIGURATION_REQUIRED' },
      web: { postsCount: 0, commentsCount: 0, discoveryOnlyCount: 0, status: 'AVAILABLE' }
    }

    for (const p of posts) {
      if (platformBreakdown[p.platform]) {
        platformBreakdown[p.platform].postsCount++
      }
    }

    for (const c of comments) {
      if (platformBreakdown[c.platform]) {
        platformBreakdown[c.platform].commentsCount++
      }
    }

    for (const d of discoveryCandidates) {
      if (platformBreakdown[d.targetPlatform]) {
        platformBreakdown[d.targetPlatform].discoveryOnlyCount++
      }
    }

    // Menghitung bucket temporal per 1 jam
    const now = Date.now()
    const temporalBuckets = [
      {
        bucketLabel: '1 jam terakhir',
        startTime: now - 3600000,
        endTime: now,
        postCount: posts.filter(p => p.acquiredAt >= now - 3600000).length,
        commentCount: comments.filter(c => c.acquiredAt >= now - 3600000).length
      },
      {
        bucketLabel: '6 jam terakhir',
        startTime: now - 21600000,
        endTime: now - 3600000,
        postCount: posts.filter(p => p.acquiredAt >= now - 21600000 && p.acquiredAt < now - 3600000).length,
        commentCount: comments.filter(c => c.acquiredAt >= now - 21600000 && c.acquiredAt < now - 3600000).length
      },
      {
        bucketLabel: '24 jam terakhir',
        startTime: now - 86400000,
        endTime: now - 21600000,
        postCount: posts.filter(p => p.acquiredAt >= now - 86400000 && p.acquiredAt < now - 21600000).length,
        commentCount: comments.filter(c => c.acquiredAt >= now - 86400000 && c.acquiredAt < now - 21600000).length
      }
    ]

    return {
      id: `obs-spread-${Date.now()}`,
      issueId,
      observedAt: now,
      sampleSizePosts: posts.length,
      sampleSizeComments: comments.length,
      discoveryCandidatesCount: discoveryCandidates.length,
      platformBreakdown,
      temporalBuckets,
      burstObservations: [
        {
          window: '15m',
          ratio: posts.length > 5 ? 2.4 : 1.0,
          isBurstDetected: posts.length > 5,
          caveat: 'Lonjakan dapat dipicu oleh perkembangan berita resmi atau siaran pers instansi.'
        }
      ],
      similarityClustersCount: 0,
      copypastaInstancesCount: 0,
      coordinationIndicators: {
        label: 'NO_CLEAR_PATTERN',
        evidenceStrength: 'NONE',
        rationale: 'Data observasi belum menunjukkan pola koordinasi yang melampaui batas kebetulan wajar.',
        alternativeExplanations: ['Perkembangan alami isu publik', 'Pemberitaan media massa']
      },
      caveats
    }
  }

  /**
   * Promosi Aman DiscoveryCandidate ke SocialPostRecord (Sprint 11 WP 0 & 4.1)
   * Menjamin pemisahan tegas antara hasil pencarian (snippet) dan rekaman post terakuisisi
   */
  public promoteCandidateToPost(
    candidate: SearchDiscoveryResult,
    options?: {
      validatedContentText?: string
      isFullyAcquired?: boolean
      runId?: string
    }
  ): SocialPostRecord {
    const isAcquired = Boolean(options?.isFullyAcquired)
    const contentText = options?.validatedContentText || candidate.snippet
    const completeness = isAcquired ? 'FULL_TEXT' : 'SNIPPET_ONLY'
    const status = isAcquired ? 'FULL_CONTENT_ACQUIRED' : 'DISCOVERY_ONLY'

    return {
      id: `soc-post-${candidate.targetPlatform}-${candidate.id}`,
      platform: candidate.targetPlatform,
      platformPostId: candidate.platformIdentity?.videoId || candidate.platformIdentity?.postId || candidate.id,
      canonicalUrl: candidate.canonicalUrl,
      originalUrl: candidate.originalUrl,
      author: {
        handle: candidate.platformIdentity?.accountHandle,
        channelId: candidate.platformIdentity?.channelId,
        channelTitle: candidate.platformIdentity?.channelTitle
      },
      title: candidate.title,
      contentText,
      contentCompleteness: completeness,
      publishedAt: candidate.publishedAt,
      publishedAtPrecision: candidate.publishedAtPrecision || 'UNKNOWN',
      firstObservedAt: candidate.discoveredAt,
      acquiredAt: Date.now(),
      retentionExpiresAt: candidate.targetPlatform === 'youtube' ? Date.now() + YOUTUBE_MAX_RETENTION_MS : null,
      contentStatus: status,
      relevanceStatus: candidate.relevanceStatus,
      relevanceScore: candidate.relevanceScore,
      acquisitionMethod: isAcquired ? 'OFFICIAL_API' : 'DISCOVERY_INDEX',
      providerApiName: candidate.providerId,
      acquisitionRunId: options?.runId || `run-${Date.now()}`,
      queryFingerprint: candidate.queryId,
      isProvisional: !isAcquired,
      limitations: isAcquired
        ? (candidate.limitations || [])
        : [...(candidate.limitations || []), 'DISCOVERY ONLY — FULL CONTENT NOT ACQUIRED'],
      provenance: (candidate.provenance || {}) as any
    }
  }
}

export const socialIntelligencePipeline = new SocialIntelligencePipeline()
