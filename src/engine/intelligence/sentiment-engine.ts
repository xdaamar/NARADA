/**
 * ════════════════════════════════════════════════════════════════════════════════════
 * NARADA — COGNITIVE SENTIMENT ANALYSIS ENGINE (INDONESIAN SOCIAL DISCOURSE)
 * SPRINT 8: WORK PACKAGE 3 (EXPLAINABLE OFFLINE SENTIMENT INTELLIGENCE)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ════════════════════════════════════════════════════════════════════════════════════
 */

import { extractTextFeatures, PRESERVED_NEGATIONS } from './text-normalizer.ts'
import type {
  CommentRecord,
  CommentSentimentResult,
  SentimentTaxonomy,
  ConfidenceBand
} from './comment-types.ts'

export const SENTIMENT_ALGORITHM_VERSION = '1.2.0-indonesia-lexicon'

/**
 * Leksikon Sentimen Positif Bahasa Indonesia (dengan bobot)
 */
export const POSITIVE_LEXICON: Record<string, number> = {
  'bagus': 1.0,
  'hebat': 1.2,
  'mantap': 1.1,
  'keren': 1.0,
  'luar biasa': 1.5,
  'terbaik': 1.3,
  'baik': 0.8,
  'setuju': 0.7,
  'dukung': 0.9,
  'mendukung': 1.0,
  'bangga': 1.2,
  'salut': 1.1,
  'apresiasi': 1.0,
  'terima kasih': 0.9,
  'terimakasih': 0.9,
  'makasih': 0.7,
  'sukses': 1.0,
  'berhasil': 1.0,
  'maju': 0.8,
  'aman': 0.8,
  'damai': 0.9,
  'kondusif': 0.9,
  'profesional': 1.0,
  'tegas': 0.8,
  'sigap': 0.9,
  'paten': 0.9,
  'juara': 1.0,
  'top': 0.8,
  'pujian': 0.9,
  'optimis': 0.9,
  'positif': 0.8,
  'kredibel': 1.1,
  'solid': 0.9,
  'mantul': 1.0,
  'jos': 0.8,
  'topbgt': 1.1,
  'bermanfaat': 1.0,
  'solutif': 1.0,
  'syukur': 0.8,
  'alhamdulillah': 0.9,
  'terpercaya': 1.2
}

/**
 * Leksikon Sentimen Negatif Bahasa Indonesia (dengan bobot)
 */
export const NEGATIVE_LEXICON: Record<string, number> = {
  'buruk': -1.0,
  'jelek': -1.0,
  'rusak': -1.0,
  'hancur': -1.3,
  'kecewa': -1.2,
  'parah': -1.1,
  'bobrok': -1.4,
  'gagal': -1.2,
  'kacau': -1.2,
  'bohong': -1.3,
  'hoaks': -1.4,
  'hoax': -1.4,
  'fitnah': -1.5,
  'benci': -1.4,
  'menipu': -1.4,
  'penipu': -1.5,
  'rugi': -0.9,
  'merugikan': -1.1,
  'korupsi': -1.5,
  'korup': -1.4,
  'bahaya': -1.0,
  'membahayakan': -1.2,
  'bodoh': -1.3,
  'lambat': -0.8,
  'lemah': -0.9,
  'payah': -1.0,
  'sesat': -1.3,
  'menyesatkan': -1.4,
  'ancaman': -1.1,
  'waspada': -0.7,
  'takut': -0.8,
  'resah': -1.0,
  'gelisah': -0.8,
  'curang': -1.3,
  'dzalim': -1.4,
  'zalim': -1.4,
  'ngawur': -1.2,
  'asal-asalan': -1.0,
  'sampah': -1.3,
  'jahat': -1.3,
  'batal': -0.7,
  'amburadul': -1.3,
  'provokasi': -1.3,
  'kriminal': -1.4,
  'rusuh': -1.3
}

/**
 * Penguat Sentimen (Intensifiers)
 */
export const INTENSIFIERS: Record<string, number> = {
  'sangat': 1.5,
  'amat': 1.5,
  'banget': 1.4,
  'sekali': 1.4,
  'luar biasa': 1.8,
  'sungguh': 1.4,
  'super': 1.5,
  'benar-benar': 1.6,
  'paling': 1.4,
  'terlalu': 1.3
}

/**
 * Pelemah Sentimen (Diminishers)
 */
export const DIMINISHERS: Record<string, number> = {
  'agak': 0.6,
  'sedikit': 0.6,
  'kurang': 0.5,
  'rada': 0.7,
  'lumayan': 0.8
}

/**
 * Konjungsi Kontras (Contrast Conjunctions)
 */
export const CONTRAST_WORDS = new Set<string>([
  'tetapi',
  'tapi',
  'namun',
  'melainkan',
  'padahal',
  'sedangkan',
  'meskipun',
  'walaupun'
])

/**
 * Penanda Indikasi Sarkasme / Ironi
 */
const SARCASM_PATTERNS = [
  /\.\.\.\s*katanya/i,
  /katanya\s+sih/i,
  /hebat\s+banget\s+ya\s*\?/i,
  /luar\s+biasa\s+sekali\s*\.\.\./i,
  /"(hebat|bagus|keren|mantap|juara)"/i,
  /[😏🤡]/u
]

/**
 * Estimasi Sentimen Satu Komentar
 */
export function estimateCommentSentiment(comment: CommentRecord): CommentSentimentResult {
  const features = extractTextFeatures(comment.normalizedText || comment.rawText)
  const tokens = features.tokens

  const matchedPositiveTerms: string[] = []
  const matchedNegativeTerms: string[] = []
  const intensifiersDetected: string[] = []
  const diminishersDetected: string[] = []
  const negationContext: string[] = []

  let positiveScore = 0
  let negativeScore = 0
  let negationActive = false
  let negationDistance = 0
  let currentMultiplier = 1.0

  // 1. Deteksi Sarkasme
  let sarcasmSuspected = false
  let sarcasmReason: string | undefined = undefined
  for (const pattern of SARCASM_PATTERNS) {
    if (pattern.test(comment.rawText) || pattern.test(comment.normalizedText)) {
      sarcasmSuspected = true
      sarcasmReason = `Terdeteksi pola retorika atau penanda ironi: ${pattern.toString()}`
      break
    }
  }

  // 2. Deteksi Klausa Kontras
  let contrastDetected = false
  let contrastContext: string | undefined = undefined
  for (const token of tokens) {
    if (CONTRAST_WORDS.has(token.normalized)) {
      contrastDetected = true
      contrastContext = token.normalized
      break
    }
  }

  // 3. Evaluasi Token Berurutan dengan Window Negasi & Modifier
  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i].normalized

    // Cek apakah kata adalah Negasi
    if (PRESERVED_NEGATIONS.has(word)) {
      negationActive = true
      negationDistance = 0
      negationContext.push(word)
      continue
    }

    if (negationActive) {
      negationDistance++
      // Batas jangkauan negasi: 3 kata
      if (negationDistance > 3) {
        negationActive = false
      }
    }

    // Cek apakah kata adalah Penguat (Intensifier)
    if (INTENSIFIERS[word]) {
      currentMultiplier = INTENSIFIERS[word]
      intensifiersDetected.push(word)
      continue
    }

    // Cek apakah kata adalah Pelemah (Diminisher)
    if (DIMINISHERS[word]) {
      currentMultiplier = DIMINISHERS[word]
      diminishersDetected.push(word)
      continue
    }

    // Cek Leksikon Positif
    if (POSITIVE_LEXICON[word]) {
      const baseWeight = POSITIVE_LEXICON[word] * currentMultiplier
      if (negationActive) {
        // Negasi dari positif bergeser menjadi sentimen negatif
        negativeScore += Math.abs(baseWeight) * 0.9
        matchedNegativeTerms.push(`${negationContext[negationContext.length - 1]} ${word}`)
      } else {
        positiveScore += baseWeight
        matchedPositiveTerms.push(word)
      }
      currentMultiplier = 1.0 // Reset modifier setelah mengenai kata sentimen
      continue
    }

    // Cek Leksikon Negatif
    if (NEGATIVE_LEXICON[word]) {
      const baseWeight = Math.abs(NEGATIVE_LEXICON[word]) * currentMultiplier
      if (negationActive) {
        // Negasi dari negatif bergeser menjadi sentimen positif/netral
        positiveScore += baseWeight * 0.7
        matchedPositiveTerms.push(`${negationContext[negationContext.length - 1]} ${word}`)
      } else {
        negativeScore += baseWeight
        matchedNegativeTerms.push(word)
      }
      currentMultiplier = 1.0
      continue
    }
  }

  // 4. Hitung Polarity Score Gabungan (-1.0 s/d +1.0)
  const totalScore = positiveScore - negativeScore
  let normalizedPolarity = 0
  const maxPossibleScore = Math.max(1, positiveScore + negativeScore)
  normalizedPolarity = Number((totalScore / maxPossibleScore).toFixed(3))

  // 5. Penentuan Kategori Sentimen & Ambang Batas
  let sentiment: SentimentTaxonomy = 'NEUTRAL'
  let confidence: ConfidenceBand = 'LOW'
  let confidenceScore = 0.5
  let uncertaintyReason: string | undefined = undefined

  // Kasus Teks Kosong atau Kurang Substantif
  if (features.substantiveWordCount < 2 && matchedPositiveTerms.length === 0 && matchedNegativeTerms.length === 0) {
    sentiment = 'NEUTRAL'
    confidence = 'LOW'
    confidenceScore = 0.3
    uncertaintyReason = 'Teks sangat pendek tanpa leksikon sentimen yang jelas.'
  } else if (contrastDetected && positiveScore > 0.8 && negativeScore > 0.8) {
    // Memiliki klausa positif dan negatif sekaligus yang dihubungkan kontras
    sentiment = 'MIXED'
    confidence = 'MODERATE'
    confidenceScore = 0.65
  } else if (sarcasmSuspected) {
    // Jika sarkasme terdeteksi, batasi kepercayaan dan geser dari positif lugu
    if (positiveScore > negativeScore) {
      sentiment = 'UNCERTAIN'
      confidence = 'LOW'
      confidenceScore = 0.4
      uncertaintyReason = 'Pujian verbal dicurigai memuat ironi/sarkasme konteks.'
    } else {
      sentiment = 'NEGATIVE'
      confidence = 'MODERATE'
      confidenceScore = 0.6
    }
  } else if (normalizedPolarity >= 0.25) {
    sentiment = 'POSITIVE'
    confidenceScore = Math.min(1.0, 0.5 + positiveScore * 0.25)
    confidence = confidenceScore >= 0.8 ? 'HIGH' : confidenceScore >= 0.6 ? 'MODERATE' : 'LOW'
  } else if (normalizedPolarity <= -0.25) {
    sentiment = 'NEGATIVE'
    confidenceScore = Math.min(1.0, 0.5 + negativeScore * 0.25)
    confidence = confidenceScore >= 0.8 ? 'HIGH' : confidenceScore >= 0.6 ? 'MODERATE' : 'LOW'
  } else if (matchedPositiveTerms.length === 0 && matchedNegativeTerms.length === 0) {
    sentiment = 'NEUTRAL'
    confidence = features.substantiveWordCount >= 4 ? 'MODERATE' : 'LOW'
    confidenceScore = features.substantiveWordCount >= 4 ? 0.6 : 0.4
  } else {
    // Skor di sekitar 0 dengan beberapa kata positif dan negatif seimbang
    sentiment = 'UNCERTAIN'
    confidence = 'LOW'
    confidenceScore = 0.45
    uncertaintyReason = 'Sinyal positif dan negatif seimbang tanpa polaritas dominan.'
  }

  // Jika tidak ada kata yang cocok sama sekali dan kalimat cukup panjang
  if (matchedPositiveTerms.length === 0 && matchedNegativeTerms.length === 0 && features.substantiveWordCount >= 8) {
    sentiment = 'NEUTRAL'
    confidence = 'MODERATE'
    confidenceScore = 0.6
    uncertaintyReason = 'Pernyataan deskriptif/informatif tanpa kata opini polar.'
  }

  return {
    commentId: comment.id,
    sentiment,
    polarityScore: normalizedPolarity,
    confidence,
    confidenceScore: Number(confidenceScore.toFixed(2)),
    explanation: {
      matchedPositiveTerms,
      matchedNegativeTerms,
      negationDetected: negationContext.length > 0,
      negationContext: negationContext.length > 0 ? negationContext : undefined,
      intensifiersDetected,
      diminishersDetected,
      contrastDetected,
      contrastContext,
      sarcasmSuspected,
      sarcasmReason,
      uncertaintyReason,
      algorithmVersion: SENTIMENT_ALGORITHM_VERSION
    }
  }
}

/**
 * Agregasi Distribusi Sentimen untuk Sekumpulan Komentar (Section 8.5)
 */
export function aggregateSentimentDistribution(results: CommentSentimentResult[]) {
  const eligibleCount = results.length
  let positiveCount = 0
  let negativeCount = 0
  let neutralCount = 0
  let uncertainCount = 0
  let mixedCount = 0

  const confidenceSummary: Record<ConfidenceBand, number> = {
    HIGH: 0,
    MODERATE: 0,
    LOW: 0,
    INSUFFICIENT: 0
  }

  for (const res of results) {
    if (res.sentiment === 'POSITIVE') positiveCount++
    else if (res.sentiment === 'NEGATIVE') negativeCount++
    else if (res.sentiment === 'NEUTRAL') neutralCount++
    else if (res.sentiment === 'UNCERTAIN') uncertainCount++
    else if (res.sentiment === 'MIXED') mixedCount++

    confidenceSummary[res.confidence]++
  }

  // Menangani penyebut 0 dengan aman tanpa NaN atau Infinity (S8-SENT-13)
  const denominator = eligibleCount > 0 ? eligibleCount : 1

  return {
    positiveCount,
    negativeCount,
    neutralCount,
    uncertainCount,
    mixedCount,
    positiveRatio: eligibleCount > 0 ? Number((positiveCount / denominator).toFixed(4)) : 0,
    negativeRatio: eligibleCount > 0 ? Number((negativeCount / denominator).toFixed(4)) : 0,
    neutralRatio: eligibleCount > 0 ? Number((neutralCount / denominator).toFixed(4)) : 0,
    uncertainRatio: eligibleCount > 0 ? Number((uncertainCount / denominator).toFixed(4)) : 0,
    mixedRatio: eligibleCount > 0 ? Number((mixedCount / denominator).toFixed(4)) : 0,
    confidenceSummary
  }
}
