// ─── MULTINOMIAL NAIVE BAYES CLASSIFIER WITH XAI SALIENCE ENGINE ───
// SPRINT 7A: Peningkatan Otak AI dengan Explainable AI (XAI) Attribution
// Sistem Pertahanan Kognitif NARADA - PUSSIBERAD TNI AD

import type { ContentCategory, MLPrediction, TokenAttribution } from '../../types'
import { tokenizeIndonesian } from './tokenizer'
import { vectorizeTFIDF } from './tfidf'
import modelData from './model.json'

export interface ModelDataStructure {
  version: string
  generatedAt?: number
  vocabularySize?: number
  categories: ContentCategory[]
  classPriors: Record<ContentCategory, number>
  vocabulary: Record<string, number>
  idf: number[]
  classWordProbs: Record<ContentCategory, number[]>
}

export interface EnhancedMLPrediction extends MLPrediction {
  salienceTokens: TokenAttribution[]
  inferenceLatencyMs: number
}

const model = modelData as unknown as ModelDataStructure

// Inverted index untuk pemetaan O(1) dari feature index ke string token
const indexToToken: string[] = new Array(model.idf ? model.idf.length : 0)
if (model.vocabulary) {
  for (const [token, idx] of Object.entries(model.vocabulary)) {
    indexToToken[idx] = token
  }
}

/**
 * Normalisasi Log-Probabilities menggunakan Softmax Numerically Stable
 */
function softmaxLogProbs(logProbs: Record<ContentCategory, number>): Record<ContentCategory, number> {
  const cats = model.categories
  let maxLog = -Infinity
  for (const cat of cats) {
    if (logProbs[cat] > maxLog) {
      maxLog = logProbs[cat]
    }
  }

  // Pengurangan maxLog mencegah overflow eksponensial (numerical stability)
  let sumExp = 0
  const expVals: Record<string, number> = {}
  for (const cat of cats) {
    const val = Math.exp(logProbs[cat] - maxLog)
    expVals[cat] = val
    sumExp += val
  }

  const result: Partial<Record<ContentCategory, number>> = {}
  for (const cat of cats) {
    result[cat] = sumExp > 0 ? expVals[cat] / sumExp : 1 / cats.length
  }

  return result as Record<ContentCategory, number>
}

/**
 * Prediksi Probabilistik Machine Learning (TF-IDF + Multinomial Naive Bayes)
 * Dilengkapi dengan Token Attribution Salience (Explainable AI / XAI)
 * @param text - Teks mentah masukan pengguna/analis
 * @returns Prediksi probabilitas per kategori, pemenang, salience tokens, dan latensi inferensi
 */
export function predictNaiveBayes(text: string): EnhancedMLPrediction {
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const tokens = tokenizeIndonesian(text, true)

  // Kasus teks kosong / tidak ada token valid
  if (tokens.length === 0) {
    const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime
    return {
      category: 'NETRAL',
      probabilities: {
        HOAKS: 0.05,
        PROPAGANDA: 0.05,
        BUZZER: 0.05,
        DISINFORMASI: 0.05,
        NETRAL: 0.80,
      },
      tokens: [],
      salienceTokens: [],
      inferenceLatencyMs: parseFloat(elapsed.toFixed(2)),
    }
  }

  // Vektorisasi TF-IDF
  const vector = vectorizeTFIDF(tokens, model.vocabulary, model.idf)

  // Jika tidak ada kata yang cocok dengan vocabulary model
  if (vector.indices.length === 0) {
    const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime
    return {
      category: 'NETRAL',
      probabilities: {
        HOAKS: 0.20,
        PROPAGANDA: 0.20,
        BUZZER: 0.20,
        DISINFORMASI: 0.20,
        NETRAL: 0.20,
      },
      tokens,
      salienceTokens: [],
      inferenceLatencyMs: parseFloat(elapsed.toFixed(2)),
    }
  }

  // Perhitungan Log-Likelihood Naive Bayes
  const logProbs: Record<ContentCategory, number> = {
    HOAKS: Math.log(model.classPriors.HOAKS || 0.2),
    PROPAGANDA: Math.log(model.classPriors.PROPAGANDA || 0.2),
    BUZZER: Math.log(model.classPriors.BUZZER || 0.2),
    DISINFORMASI: Math.log(model.classPriors.DISINFORMASI || 0.2),
    NETRAL: Math.log(model.classPriors.NETRAL || 0.2),
  }

  for (const cat of model.categories) {
    const wordProbs = model.classWordProbs[cat]
    if (!wordProbs) continue

    for (let i = 0; i < vector.indices.length; i++) {
      const featureIdx = vector.indices[i]
      const tfidfWeight = vector.values[i]
      const pWord = wordProbs[featureIdx] ?? 1e-5 // Laplace smoothing minimum

      // Log-space calculation: log(P(w|c)) * tfidf
      logProbs[cat] += tfidfWeight * Math.log(pWord + 1e-10)
    }
  }

  // Normalisasi probabilitas ke range 0.00 - 1.00 via Softmax
  const probabilities = softmaxLogProbs(logProbs)

  // Tentukan kategori dengan probabilitas tertinggi (Argmax)
  let bestCategory: ContentCategory = 'NETRAL'
  let highestProb = -1

  for (const cat of model.categories) {
    if (probabilities[cat] > highestProb) {
      highestProb = probabilities[cat]
      bestCategory = cat
    }
  }

  // ─── PERHITUNGAN TOKEN ATTRIBUTION SALIENCE UNTUK EXPLAINABLE AI (XAI) ───
  // Menghitung Log-Likelihood Ratio: LLR(w_i) = log P(w_i | C_winner) - log P(w_i | C_netral)
  const salienceTokens: TokenAttribution[] = []
  const netralProbs = model.classWordProbs.NETRAL || []
  const winnerProbs = model.classWordProbs[bestCategory] || []

  for (let i = 0; i < vector.indices.length; i++) {
    const featureIdx = vector.indices[i]
    const tfidfWeight = vector.values[i]
    const tokenStr = indexToToken[featureIdx]
    if (!tokenStr) continue

    const pWinner = winnerProbs[featureIdx] ?? 1e-6
    const pNetral = netralProbs[featureIdx] ?? 1e-6

    // LLR mengukur seberapa kuat kata ini mengarah ke ancaman vs rujukan netral
    const logLikelihoodRatio = Math.log(pWinner + 1e-10) - Math.log(pNetral + 1e-10)

    // Cari kategori dominan spesifik untuk token ini
    let maxP = -1
    let domCat: ContentCategory = 'NETRAL'
    for (const cat of model.categories) {
      const pCat = model.classWordProbs[cat]?.[featureIdx] ?? 0
      if (pCat > maxP) {
        maxP = pCat
        domCat = cat
      }
    }

    // Tentukan derajat intensitas salience
    let intensity: 'CRIMSON' | 'AMBER' | 'EMERALD' | 'NEUTRAL' = 'NEUTRAL'
    if (bestCategory === 'NETRAL' || domCat === 'NETRAL' || logLikelihoodRatio < -0.6) {
      intensity = 'EMERALD' // Bukti faktual resmi / verifikasi netral
    } else if (logLikelihoodRatio >= 1.8 || (domCat === bestCategory && tfidfWeight > 0.25)) {
      intensity = 'CRIMSON' // Indikator ancaman kuat (High Threat Attributor)
    } else if (logLikelihoodRatio >= 0.5 || tfidfWeight > 0.15) {
      intensity = 'AMBER' // Indikator kecurigaan sedang / agitasi
    }

    salienceTokens.push({
      token: tokenStr,
      tfidfWeight: parseFloat(tfidfWeight.toFixed(4)),
      logLikelihoodRatio: parseFloat(logLikelihoodRatio.toFixed(3)),
      dominantCategory: domCat,
      intensity,
    })
  }

  // Urutkan token berdasarkan pengaruh terkuat (|LLR| * tfidfWeight)
  salienceTokens.sort((a, b) => {
    const scoreA = Math.abs(a.logLikelihoodRatio) * a.tfidfWeight
    const scoreB = Math.abs(b.logLikelihoodRatio) * b.tfidfWeight
    return scoreB - scoreA
  })

  const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime

  return {
    category: bestCategory,
    probabilities,
    tokens,
    salienceTokens,
    inferenceLatencyMs: parseFloat(elapsed.toFixed(2)),
  }
}
