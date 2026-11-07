/**
 * ════════════════════════════════════════════════════════════════════════════════════
 * NARADA — CONSERVATIVE COORDINATION-PATTERN INDICATOR ENGINE
 * SPRINT 8: WORK PACKAGE 3 (MULTI-SIGNAL CONSERVATIVE COMBINATION)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ════════════════════════════════════════════════════════════════════════════════════
 */

import {
  extractCanonicalPublisherDomain,
  AGGREGATOR_INDEXER_DOMAINS
} from '../radar/clustering-engine.ts'
import { extractTextFeatures } from './text-normalizer.ts'
import type {
  CommentRecord,
  SimilarityGroup,
  BurstAnalysisSummary,
  CoordinationIndicator,
  SignalFamilyType,
  ConfidenceBand,
  CoordinationIndicatorTaxonomy
} from './comment-types.ts'

export const COORDINATION_ALGORITHM_VERSION = '1.0.0-conservative-indicator'

export const STANDARD_ALTERNATIVE_EXPLANATIONS = [
  'Peristiwa breaking news / peristiwa penting yang memicu respons spontan publik secara masif.',
  'Pernyataan pers resmi atau rilis humas yang disebarkan ulang oleh masyarakat atau media.',
  'Slogan kampanye publik terbuka atau kutipan tokoh yang ramai diperbincangkan wajar.',
  'Tagar viral yang digunakan secara organik oleh berbagai kelompok netizen.',
  'Sindikasi informasi atau kutipan rujukan dari satu sumber berita utama.'
]

export const SAFEGUARD_DISCLOSURES = [
  'Indikator pola observasi ini BUKAN bukti koordinasi terselubung, botnet, atau manipulasi terorganisir.',
  'Sistem NARADA tidak melakukan atribusi identitas aktor, pemilik akun, maupun penilaian ancaman tingkat individu.',
  'Kemiripan teks atau konsentrasi temporal adalah karakteristik data teramati, bukan penetapan niat jahat.',
  'Verifikasi manusia dan konteks lapangan wajib dilakukan sebelum mengambil kesimpulan operasional.'
]

/**
 * Evaluasi Pola Koordinasi Konservatif Lintas Sinyal
 */
export function evaluateCoordinationPattern(
  comments: CommentRecord[],
  similarityGroups: SimilarityGroup[],
  burstAnalysis: BurstAnalysisSummary
): CoordinationIndicator {
  // ─── 0. EVALUASI KEPATUHAN KEBIJAKAN YOUTUBE DATA AGGREGATION (SECTION III.E.2) ───
  const youtubeComments = comments.filter(c => {
    const isYtUrl = Boolean(c.sourceUrl && (c.sourceUrl.includes('youtube.com') || c.sourceUrl.includes('youtu.be')))
    const isYtPlatform = Boolean((c.metadata?.platform as string)?.toLowerCase() === 'youtube')
    const isYtSource = Boolean(c.sourceLabel?.toLowerCase().includes('youtube'))
    return isYtUrl || isYtPlatform || isYtSource
  })

  if (youtubeComments.length > 0) {
    const channelIds = new Set<string>()
    for (const c of youtubeComments) {
      const ch = (c.metadata?.channelId as string) || (c.metadata?.channelTitle as string) || c.authorHandle || ''
      if (ch) channelIds.add(ch)
    }

    const otherPlatformComments = comments.filter(c => !youtubeComments.includes(c))

    // Kasus 1: Cross-Channel Aggregation pada data YouTube
    if (channelIds.size > 1) {
      return {
        indicator: 'POLICY_BLOCKED',
        confidence: 'INSUFFICIENT',
        triggeredFamilies: [],
        involvedCommentIds: [],
        involvedSimilarityGroupIds: [],
        sourceDiversityScore: 0,
        uniquePublishersCount: 0,
        temporalConcentrationRatio: 0,
        alternativeExplanations: [
          'YouTube API Services Developer Policies Section III.E.2 melarang agregasi data antarpemilik konten/kanal yang tidak terkait.',
          'Operasi koordinasi lintas-kanal diblokir demi menjaga kepatuhan hukum kebijakan pengembang YouTube.'
        ],
        safeguardDisclosures: SAFEGUARD_DISCLOSURES,
        summaryRationale: `POLICY_BLOCKED: Terdeteksi ${channelIds.size} kanal YouTube berbeda dalam sampel. Agregasi lintas-kanal YouTube dilarang keras oleh Section III.E.2. Analisis koordinasi hanya diizinkan pada lingkup per-kanal/per-video tunggal.`,
        isPolicyBlocked: true,
        policyBlockReason: 'YOUTUBE_POLICY_III_E_2_CROSS_CHANNEL_AGGREGATION_RESTRICTED'
      }
    }

    // Kasus 2: Cross-Platform Metrics Combination dengan YouTube
    if (otherPlatformComments.length > 0) {
      return {
        indicator: 'POLICY_BLOCKED',
        confidence: 'INSUFFICIENT',
        triggeredFamilies: [],
        involvedCommentIds: [],
        involvedSimilarityGroupIds: [],
        sourceDiversityScore: 0,
        uniquePublishersCount: 0,
        temporalConcentrationRatio: 0,
        alternativeExplanations: [
          'YouTube API Services Developer Policies melarang penggabungan data turunan YouTube ke dalam metrik agregat gabungan lintas platform.',
          'Data YouTube harus dianalisis secara terisolasi tanpa mencampur metrik koordinasi platform lain.'
        ],
        safeguardDisclosures: SAFEGUARD_DISCLOSURES,
        summaryRationale: 'POLICY_BLOCKED: Terdeteksi pencampuran data YouTube dengan komentar platform lain. Penggabungan metrik koordinasi lintas platform dilarang oleh kebijakan YouTube.',
        isPolicyBlocked: true,
        policyBlockReason: 'YOUTUBE_POLICY_III_E_2_CROSS_PLATFORM_COMBINATION_RESTRICTED'
      }
    }
  }

  const sampleSize = comments.length

  // 1. Evaluasi Kecukupan Sampel (Section 11 / S8-COORD-04)
  if (sampleSize < 10) {
    return {
      indicator: 'INSUFFICIENT_DATA',
      confidence: 'INSUFFICIENT',
      triggeredFamilies: [],
      involvedCommentIds: [],
      involvedSimilarityGroupIds: [],
      sourceDiversityScore: 0,
      uniquePublishersCount: 0,
      temporalConcentrationRatio: 0,
      alternativeExplanations: STANDARD_ALTERNATIVE_EXPLANATIONS,
      safeguardDisclosures: SAFEGUARD_DISCLOSURES,
      summaryRationale: `Ukuran sampel (${sampleSize} komentar) tidak mencukupi batas minimum 10 komentar untuk estimasi pola.`
    }
  }

  const triggeredFamilies: SignalFamilyType[] = []
  const involvedCommentIdsSet = new Set<string>()
  const involvedGroupIds: string[] = []

  // Sinyal A: Teks Berulang / Kluster Kemiripan
  const substantiveGroups = similarityGroups.filter(g => !g.isShortGenericPhrase && g.memberCount >= 2)
  if (substantiveGroups.length > 0) {
    triggeredFamilies.push('REPEATED_TEXT')
    for (const g of substantiveGroups) {
      involvedGroupIds.push(g.groupId)
      g.memberCommentIds.forEach(id => involvedCommentIdsSet.add(id))
    }
  }

  // Sinyal B: Konsentrasi Temporal / Burst
  let maxBurstConcentration = 0
  const burstCommentIds = new Set<string>()
  if (burstAnalysis.status === 'ANALYZED' && burstAnalysis.detectedBursts.length > 0) {
    triggeredFamilies.push('TEMPORAL_CONCENTRATION')
    for (const b of burstAnalysis.detectedBursts) {
      if (b.concentrationRatio > maxBurstConcentration) {
        maxBurstConcentration = b.concentrationRatio
      }
      b.commentIdsInWindow.forEach(id => {
        burstCommentIds.add(id)
        involvedCommentIdsSet.add(id)
      })
    }
  }

  // Sinyal C & D: Ekstraksi URL & Hashtag Berulang
  const urlCounts = new Map<string, number>()
  const hashtagCounts = new Map<string, number>()
  const publisherDomains = new Set<string>()
  let authorHandleCount = 0

  for (const c of comments) {
    if (c.authorHandle) authorHandleCount++

    if (c.sourceUrl) {
      const pub = extractCanonicalPublisherDomain(c.sourceUrl)
      if (pub && !AGGREGATOR_INDEXER_DOMAINS.has(pub)) {
        publisherDomains.add(pub)
      }
    }

    const feats = extractTextFeatures(c.normalizedText || c.rawText)
    for (const u of feats.urls) {
      urlCounts.set(u, (urlCounts.get(u) || 0) + 1)
    }
    for (const h of feats.hashtags) {
      hashtagCounts.set(h, (hashtagCounts.get(h) || 0) + 1)
    }
  }

  // Cek apakah ada URL yang berulang >= 3 kali
  let repeatedUrlDetected = false
  for (const count of urlCounts.values()) {
    if (count >= 3) {
      repeatedUrlDetected = true
      break
    }
  }
  if (repeatedUrlDetected) {
    triggeredFamilies.push('REPEATED_URLS')
  }

  // Cek apakah ada Hashtag yang berulang >= 4 kali
  let repeatedHashtagDetected = false
  for (const count of hashtagCounts.values()) {
    if (count >= 4) {
      repeatedHashtagDetected = true
      break
    }
  }
  if (repeatedHashtagDetected) {
    triggeredFamilies.push('REPEATED_HASHTAGS')
  }

  // Sinyal E: Rekurensi Akun / Handle dalam Waktu Singkat
  const authorCoverage = authorHandleCount / sampleSize
  if (authorCoverage >= 0.5 && authorHandleCount > 5) {
    // Periksa apakah ada handle yang memposting > 3 komentar serupa
    // atau pola handle banyak dalam burst
    if (burstAnalysis.status === 'ANALYZED' && burstAnalysis.detectedBursts.length > 0) {
      triggeredFamilies.push('RAPID_AUTHOR_RECURRENCE')
    }
  }

  // Sinyal F: Rekurensi Lintas Sumber
  if (publisherDomains.size >= 3 && substantiveGroups.length > 0) {
    triggeredFamilies.push('CROSS_SOURCE_RECURRENCE')
  }

  // 2. Anti-Double-Counting Guard (Section 11.1 / S8-COORD-03)
  // Periksa korelasi antara Teks Berulang dan Konsentrasi Temporal
  let correlatedSignals = false
  if (triggeredFamilies.includes('REPEATED_TEXT') && triggeredFamilies.includes('TEMPORAL_CONCENTRATION')) {
    let overlapCount = 0
    for (const id of burstCommentIds) {
      for (const g of substantiveGroups) {
        if (g.memberCommentIds.includes(id)) {
          overlapCount++
          break
        }
      }
    }
    const overlapRatio = burstCommentIds.size > 0 ? overlapCount / burstCommentIds.size : 0
    if (overlapRatio > 0.8) {
      // Lebih dari 80% komentar dalam burst adalah komentar teks yang sama persis
      correlatedSignals = true
    }
  }

  // Hitung jumlah famili sinyal independen efektif
  let effectiveFamilyCount = triggeredFamilies.length
  if (correlatedSignals && effectiveFamilyCount > 1) {
    // Penalti anti-double counting: kurangi 1 famili karena merupakan turunan dari cluster teks yang sama
    effectiveFamilyCount -= 1
  }

  // 3. Klasifikasi Taksonomi Indikator Konservatif
  let indicator: CoordinationIndicatorTaxonomy = 'NO_CLEAR_PATTERN'
  let confidence: ConfidenceBand = 'LOW'

  if (effectiveFamilyCount === 0 || triggeredFamilies.length <= 1) {
    // S8-COORD-01: Satu famili sinyal TIDAK BOLEH memicu indikator kuat
    indicator = 'NO_CLEAR_PATTERN'
    confidence = 'MODERATE'
  } else if (effectiveFamilyCount === 2) {
    indicator = 'WEAK_PATTERN'
    confidence = 'MODERATE'
  } else if (effectiveFamilyCount >= 3) {
    indicator = 'PATTERN_WARRANTS_REVIEW'
    confidence = 'HIGH'
  }

  const sourceDiversityScore = Math.min(1.0, publisherDomains.size / 5)

  let summaryRationale = ''
  if (indicator === 'NO_CLEAR_PATTERN') {
    summaryRationale = triggeredFamilies.length === 1
      ? `Teramati satu famili sinyal (${triggeredFamilies[0]}), namun tidak mencukupi untuk mengindikasikan pola terkoordinasi.`
      : 'Tidak ditemukan anomali statistik kemiripan atau temporal yang mengindikasikan pola koordinasi.'
  } else if (indicator === 'WEAK_PATTERN') {
    summaryRationale = `Teramati 2 famili sinyal (${triggeredFamilies.join(', ')}). Pola lemah dan memerlukan peninjauan konteks rilis sumber.`
  } else {
    summaryRationale = `Teramati konvergensi multi-sinyal (${triggeredFamilies.join(', ')}). Disarankan peninjauan forensik lebih lanjut oleh analis.`
  }

  return {
    indicator,
    confidence,
    triggeredFamilies,
    involvedCommentIds: Array.from(involvedCommentIdsSet),
    involvedSimilarityGroupIds: involvedGroupIds,
    sourceDiversityScore: Number(sourceDiversityScore.toFixed(2)),
    uniquePublishersCount: publisherDomains.size,
    temporalConcentrationRatio: maxBurstConcentration,
    alternativeExplanations: STANDARD_ALTERNATIVE_EXPLANATIONS,
    safeguardDisclosures: SAFEGUARD_DISCLOSURES,
    summaryRationale
  }
}
