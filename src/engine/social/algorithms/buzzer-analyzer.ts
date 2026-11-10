/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — BUZZER SWARM & BOT COORDINATION ANALYZER
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * Analisis perilaku bot terkoordinasi (Coordinated Inauthentic Behavior / CIB),
 * kalkulasi burst velocity, rasio copypasta, dan sintesis ringkasan ancaman.
 * ══════════════════════════════════════════════════════════════════════════
 */

import type {
  AnalyzedCommentItem,
  CopypastaCluster,
  BuzzerPatternAnalysis
} from '../types/social-analysis-types.ts'

const STOP_WORDS_ID_EN = new Set([
  'dan', 'yang', 'di', 'dari', 'ini', 'itu', 'ke', 'untuk', 'dengan', 'pada',
  'adalah', 'saya', 'kami', 'kita', 'kamu', 'anda', 'mereka', 'akan', 'bisa',
  'ada', 'tidak', 'juga', 'sudah', 'lebih', 'karena', 'oleh', 'saat', 'para',
  'the', 'and', 'to', 'of', 'in', 'is', 'for', 'that', 'this', 'on', 'with'
])

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

  comments.forEach(c => {
    const words = c.text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !STOP_WORDS_ID_EN.has(w))

    words.forEach(w => {
      wordFreq[w] = (wordFreq[w] || 0) + 1
    })
  })

  const dominantKeywords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([w]) => w)

  // 3. Skor Koordinasi (0 - 100)
  // Bobot: Copypasta Ratio (60%) + Burst Spike (25%) + Cluster Dominance (15%)
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

