/**
 * NARADA — Cognitive Threat Defense System
 * Engine Forensik Postingan Medsos & Pola Buzzer Swarm (Sprint 7C)
 * 
 * Mengintegrasikan Algoritma Jaccard-Levenshtein Matrix, InSet Indonesian Sentiment Engine,
 * Burst Velocity Calculator, dan Generator Kontranarasi 4 Kanal Dispenad & Babinsa.
 */

import { searchLocalDebunk } from './data/debunk-service'
import {
  clusterComments,
  calculateJaccardSimilarity,
  calculateLevenshteinRatio,
  isCopypastaMatch,
  type CopypastaCluster,
  type CommentInput
} from './forensic/jaccard-matrix'
import {
  analyzeSentiment,
  aggregateSentimentMatrix,
  type SentimentLabel
} from './forensic/sentiment-engine'
import {
  calculateBurstVelocity,
  type BurstVelocityResult,
  type TimeCommentItem
} from './forensic/burst-velocity'
import {
  generateCounterNarratives,
  type CounterNarrativeChannels
} from './forensic/counter-narrative-generator'

// Re-export modul forensik agar dapat diakses komponen lain
export {
  calculateJaccardSimilarity,
  calculateLevenshteinRatio,
  isCopypastaMatch,
  clusterComments,
  analyzeSentiment,
  aggregateSentimentMatrix,
  calculateBurstVelocity,
  generateCounterNarratives
}
export type { CopypastaCluster, SentimentLabel, BurstVelocityResult, CounterNarrativeChannels }

// ─── Tipe Data Forensik Medsos (Re-export dari forensic-types.ts) ───
export type {
  SocialPlatform,
  SocialCommentItem,
  SocialPostForensicResult
} from './forensic/forensic-types.ts'

import type {
  SocialPlatform,
  SocialCommentItem,
  SocialPostForensicResult
} from './forensic/forensic-types.ts'

// ─── Basis Data Preset Kasus Nyata (Re-export dari forensic/presets.ts) ───
export { SOCIAL_PRESET_SCENARIOS } from './forensic/presets.ts'
import { SOCIAL_PRESET_SCENARIOS } from './forensic/presets.ts'

// ─── Deteksi Platform dari URL ───
export function detectSocialPlatform(url: string): SocialPlatform {
  if (!url) return 'GENERIC_WEB'
  const lower = url.toLowerCase()
  if (lower.includes('instagram.com') || lower.includes('instagr.am')) return 'INSTAGRAM'
  if (lower.includes('tiktok.com')) return 'TIKTOK'
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'TWITTER'
  if (lower.includes('facebook.com') || lower.includes('fb.watch') || lower.includes('fb.com')) return 'FACEBOOK'
  if (lower.includes('threads.net')) return 'THREADS'
  return 'GENERIC_WEB'
}

// ─── Ekstraksi & Forensik Postingan Fleksibel (URL Nyata / Custom Input) ───
export async function analyzeSocialPost(
  url: string,
  customPostText?: string,
  rawCommentsText?: string
): Promise<SocialPostForensicResult> {
  // 1. Cek apakah cocok dengan salah satu preset (berdasarkan kecocokan URL)
  const matchedPreset = SOCIAL_PRESET_SCENARIOS.find(p => 
    url && p.url.toLowerCase().trim() === url.toLowerCase().trim()
  )
  if (matchedPreset && !customPostText && !rawCommentsText) {
    return matchedPreset
  }

  // 2. Deteksi platform
  const platform = detectSocialPlatform(url)

  // 3. Evaluasi naskah klaim
  const textToAnalyze = (customPostText || url || '').trim()
  const matchResult = searchLocalDebunk(textToAnalyze)
  const topMatch = matchResult.matched && matchResult.entry ? matchResult.entry : null

  // 4. Proses komentar custom jika ada, atau buat data terstruktur
  let commentsSample: SocialCommentItem[] = []
  let detectedClusters: CopypastaCluster[] = []
  let copypastaPercent = 0
  let isBuzzerAlarmActive = false

  if (rawCommentsText && rawCommentsText.trim().length > 0) {
    const rawLines = rawCommentsText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)

    const commentInputs: CommentInput[] = rawLines.map((line, idx) => ({
      id: `custom-c-${idx}`,
      text: line,
      author: `@netizen_${100 + idx}`,
      timestamp: `${idx + 1} menit lalu`
    }))

    // Jalankan Jaccard-Levenshtein Clusterer
    const clusterResult = clusterComments(commentInputs, 15)
    detectedClusters = clusterResult.clusters
    copypastaPercent = clusterResult.copypastaPercent
    isBuzzerAlarmActive = clusterResult.isBuzzerAlarmActive

    // Analisis sentimen tiap baris menggunakan InSet Sentiment Engine
    commentsSample = rawLines.map((line, idx) => {
      const sent = analyzeSentiment(line)
      const isTemplate = detectedClusters.some(c => calculateJaccardSimilarity(line, c.templateText) >= 0.65)
      const matched = detectedClusters.find(c => calculateJaccardSimilarity(line, c.templateText) >= 0.65)

      return {
        id: `custom-c-${idx}`,
        authorHandle: `@netizen_${100 + idx}`,
        authorName: `Pengguna ${100 + idx}`,
        avatarLetter: 'U',
        avatarColor: isTemplate ? '#EF4444' : '#64748B',
        timestamp: `${idx + 1} menit lalu`,
        content: line,
        likes: Math.floor(Math.random() * 20),
        sentiment: sent.label,
        isSuspiciousBot: isTemplate,
        isCopypastaTemplate: isTemplate,
        matchedTemplatePattern: matched ? matched.templateText.slice(0, 25) + '...' : undefined
      }
    })
  } else {
    // Buat sampel terstandarisasi berdasarkan hasil pencarian semantik
    const keyword = topMatch ? topMatch.claim.slice(0, 30) : 'Isu Kontroversial'
    const template1 = `Viralkan fakta tentang ${keyword}! Jangan mau dibodohi narasi media penguasa!`
    const template2 = `Kawal terus kasus ini sampai tuntas! Usut aliran dananya!`

    const simulatedLines = [
      { text: template1, author: '@cyber_fighter1', isBot: true },
      { text: topMatch ? `Mohon cek sumber resminya ya kawan, ini sudah diklarifikasi oleh ${topMatch.officialSource}: ${topMatch.clarification}` : 'Tolong sertakan bukti autentik dari dokumen resmi.', author: '@warga_bijak', isBot: false },
      { text: template1, author: '@suara_rakyat_bebas', isBot: true },
      { text: template2, author: '@law_enforcer9', isBot: true },
      { text: template1, author: '@garuda_netizen', isBot: true },
      { text: 'Semoga ada pencerahan resmi dari komando agar warga tidak cemas.', author: '@bela_nkri', isBot: false },
      { text: template2, author: '@mata_kritis_ri', isBot: true }
    ]

    const commentInputs: CommentInput[] = simulatedLines.map((s, idx) => ({
      id: `gen-${idx}`,
      text: s.text,
      author: s.author,
      timestamp: `${idx + 1} menit lalu`
    }))

    const clusterResult = clusterComments(commentInputs, 15)
    detectedClusters = clusterResult.clusters
    copypastaPercent = clusterResult.copypastaPercent
    isBuzzerAlarmActive = clusterResult.isBuzzerAlarmActive

    commentsSample = simulatedLines.map((s, idx) => {
      const sent = analyzeSentiment(s.text)
      const isTemplate = detectedClusters.some(c => calculateJaccardSimilarity(s.text, c.templateText) >= 0.65)
      const matched = detectedClusters.find(c => calculateJaccardSimilarity(s.text, c.templateText) >= 0.65)

      return {
        id: `gen-${idx}`,
        authorHandle: s.author,
        authorName: s.author.replace('@', '').replace('_', ' ').toUpperCase(),
        avatarLetter: s.author.charAt(1).toUpperCase(),
        avatarColor: isTemplate ? '#EF4444' : '#3B82F6',
        timestamp: `${idx + 1} menit lalu`,
        content: s.text,
        likes: Math.floor(Math.random() * 40),
        sentiment: sent.label,
        isSuspiciousBot: s.isBot,
        isCopypastaTemplate: isTemplate,
        matchedTemplatePattern: matched ? matched.templateText.slice(0, 25) + '...' : undefined
      }
    })
  }

  // 5. Agregasi Matriks Sentimen Mekanikal (InSet Lexicon)
  const sentimentMatrix = aggregateSentimentMatrix(commentsSample)

  // 6. Hitung Burst Velocity & Indeks Koordinasi
  const timeItems: TimeCommentItem[] = commentsSample.map(c => ({
    id: c.id,
    timestamp: c.timestamp,
    authorHandle: c.authorHandle,
    isSuspiciousBot: c.isSuspiciousBot,
    isCopypastaTemplate: c.isCopypastaTemplate
  }))
  const burstResult = calculateBurstVelocity(timeItems, copypastaPercent)

  // Evaluasi kembali apakah alarm aktif berdasarkan copypasta ATAU burst velocity
  const finalBuzzerAlarmActive = isBuzzerAlarmActive || burstResult.isBurstAnomalyActive || burstResult.coordinationIndex >= 70

  // 7. Formulasi Generator Kontranarasi 4 Kanal
  const counterNarratives = generateCounterNarratives(textToAnalyze, topMatch || undefined, platform)

  // 8. Bentuk Objek Hasil Forensik Utuh
  const result: SocialPostForensicResult = {
    id: `forensic-${Date.now()}`,
    url: url || 'https://instagram.com/p/unknown',
    platform,
    analyzedAt: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) + ' WIB',
    author: {
      handle: `@akun_${platform.toLowerCase()}_analisis`,
      displayName: 'Entitas Terduga Kampanye',
      isVerified: false,
      followersCount: 3450,
      accountAgeDays: 24,
      avatarLetter: platform.charAt(0),
      avatarColor: '#6366F1'
    },
    post: {
      publishedAt: 'Beberapa jam lalu',
      caption: textToAnalyze || 'Postingan media sosial dengan potensi perang kognitif dan polarisasi opini publik.',
      likesCount: 3200,
      commentsCount: Math.max(450, commentsSample.length * 15),
      sharesCount: 1120,
      viewsCount: 28400,
      mediaType: platform === 'TIKTOK' || platform === 'INSTAGRAM' ? 'VIDEO' : 'TEXT'
    },
    cognitiveVerdict: {
      status: finalBuzzerAlarmActive ? 'KAMPANYE_BUZZER' : topMatch ? 'HOAKS_BERBAHAYA' : 'AMBIGU',
      confidenceScore: topMatch ? matchResult.confidence : finalBuzzerAlarmActive ? 91 : 65,
      classificationBadge: topMatch 
        ? `TERDETEKSI COCOK KASUS ${topMatch.cluster}` 
        : finalBuzzerAlarmActive 
        ? 'COORDINATED BUZZER SWARM' 
        : 'ANALISIS KONTEN UMUM',
      summaryReason: topMatch 
        ? `Naskah memiliki kemiripan semantik tinggi dengan data klarifikasi Mafindo/Dispenad: "${topMatch.clarification}"`
        : finalBuzzerAlarmActive 
        ? `Terdeteksi ${copypastaPercent}% komentar template identik yang memenuhi ambang batas alarm kampanye buzzer (>= 15%).`
        : 'Pola komentar masih dalam batas variasi wajar diskusi publik.',
      threatLevel: finalBuzzerAlarmActive || (topMatch && matchResult.confidence >= 90) ? 'CRITICAL' : 'MEDIUM'
    },
    sentimentMatrix: {
      positivePercent: sentimentMatrix.positivePercent,
      neutralPercent: sentimentMatrix.neutralPercent,
      provocativePercent: sentimentMatrix.provocativePercent,
      dominantSentiment: sentimentMatrix.dominantSentiment
    },
    buzzerForensic: {
      isBuzzerAlarmActive: finalBuzzerAlarmActive,
      copypastaPercent,
      burstVelocityPerMinute: burstResult.burstVelocityPerMinute,
      botAccountRatioPercent: burstResult.botAccountRatioPercent,
      detectedClusters,
      coordinationIndex: burstResult.coordinationIndex,
      swarmAnomalyDescription: burstResult.swarmAnomalyDescription
    },
    tacticalRecommendation: {
      posture: finalBuzzerAlarmActive ? 'NETRALISIR_SEGERA' : 'MONITOR_INTENSIF',
      officialClarificationDraft: counterNarratives.dispenadOfficial,
      recommendedDispenadProtocol: 'Pantau eskalasi sentimen selama 2 jam ke depan dan gunakan naskah 4 kanal Dispenad/Babinsa untuk netralisir serempak.',
      targetChannels: [platform, 'WhatsApp Babinsa', 'Portal Resmi Dispenad'],
      counterNarratives
    },
    commentsSample
  }

  return result
}

// ─── 9. FUNGSI SIMULASI INJEKSI BUZZER SWARM (+30 KOMENTAR IDENTIK) ───
export function injectBuzzerSwarm(
  baseResult: SocialPostForensicResult,
  customTemplate = 'Viralkan terus kawan-kawan! Jangan biarkan rezim panik tidur nyenyak! Usut tuntas kebobrokan ini!'
): SocialPostForensicResult {
  const injectedComments: SocialCommentItem[] = []
  
  // Suntik 25 komentar identik / variasi typo
  const botNames = [
    'Garuda Hitam', 'Satria Siber 01', 'Rakyat Bersatu 77', 'Pejuang Keadilan',
    'Anti Oligarki 88', 'Pemerhati Militer', 'Indo Merdeka 99', 'Suara Bawah',
    'Mata Elang RI', 'Prajurit Kecewa', 'Front Kebenaran', 'Pejuang Subuh RI',
    'Cyber Army ID', 'Satu Komando', 'Buzzer Pembela', 'Netizen Kritis'
  ]

  for (let i = 0; i < 25; i++) {
    const botHandle = `@bot_swarm_${100 + i}`
    const botName = botNames[i % botNames.length]
    // Variasi penulisan typo buzzer realistis
    let content = customTemplate
    if (i % 4 === 1) content = customTemplate.replace('Viralkan', 'Viralkannn')
    else if (i % 4 === 2) content = customTemplate.replace('panik', 'panikk bgt')
    else if (i % 4 === 3) content = customTemplate.replace('Usut tuntas', 'Usut tuntas aliran dana')

    injectedComments.push({
      id: `injected-${i}`,
      authorHandle: botHandle,
      authorName: `${botName} #${i + 1}`,
      avatarLetter: botName.charAt(0),
      avatarColor: '#EF4444',
      timestamp: `${Math.floor(i / 5) + 1} menit lalu`,
      content,
      likes: Math.floor(Math.random() * 15),
      sentiment: 'PROVOKATIF',
      isSuspiciousBot: true,
      isCopypastaTemplate: true,
      matchedTemplatePattern: customTemplate.slice(0, 30) + '...'
    })
  }

  // Gabungkan dengan sampel asli
  const combinedComments = [...injectedComments, ...baseResult.commentsSample]

  // Re-cluster dengan algoritma Jaccard-Levenshtein
  const commentInputs: CommentInput[] = combinedComments.map(c => ({
    id: c.id,
    text: c.content,
    author: c.authorHandle,
    timestamp: c.timestamp
  }))

  const clusterResult = clusterComments(commentInputs, 15)
  const sentimentMatrix = aggregateSentimentMatrix(combinedComments)
  
  const timeItems: TimeCommentItem[] = combinedComments.map(c => ({
    id: c.id,
    timestamp: c.timestamp,
    authorHandle: c.authorHandle,
    isSuspiciousBot: c.isSuspiciousBot,
    isCopypastaTemplate: c.isCopypastaTemplate
  }))
  const burstResult = calculateBurstVelocity(timeItems, clusterResult.copypastaPercent)

  return {
    ...baseResult,
    cognitiveVerdict: {
      ...baseResult.cognitiveVerdict,
      status: 'KAMPANYE_BUZZER',
      threatLevel: 'CRITICAL',
      classificationBadge: 'COORDINATED BUZZER SWARM DETECTED',
      summaryReason: `Terdeteksi suntikan massal ${clusterResult.copypastaPercent}% komentar template copypasta identik dalam tempo <5 menit (Indeks Koordinasi: ${burstResult.coordinationIndex}/100).`
    },
    sentimentMatrix: {
      positivePercent: sentimentMatrix.positivePercent,
      neutralPercent: sentimentMatrix.neutralPercent,
      provocativePercent: sentimentMatrix.provocativePercent,
      dominantSentiment: 'PROVOKATIF'
    },
    buzzerForensic: {
      isBuzzerAlarmActive: true,
      copypastaPercent: clusterResult.copypastaPercent,
      burstVelocityPerMinute: Math.max(75, burstResult.burstVelocityPerMinute),
      botAccountRatioPercent: Math.max(68, burstResult.botAccountRatioPercent),
      detectedClusters: clusterResult.clusters,
      coordinationIndex: Math.max(89, burstResult.coordinationIndex),
      swarmAnomalyDescription: `🚨 ANOMALI EKSTREM: Terdeteksi 25+ komentar template copypasta diinjeksi secara serempak oleh sindikat akun anonim baru (Velocity: ${Math.max(75, burstResult.burstVelocityPerMinute)} kom/mnt, Indeks Koordinasi: ${Math.max(89, burstResult.coordinationIndex)}/100).`
    },
    tacticalRecommendation: {
      ...baseResult.tacticalRecommendation,
      posture: 'NETRALISIR_SEGERA'
    },
    commentsSample: combinedComments
  }
}
