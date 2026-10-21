// ─── MULTINOMIAL NAIVE BAYES CLASSIFIER ───
// Berdasarkan PRD_02_ai_engine.md

import type { ContentCategory, MLPrediction } from '../../types'
import { tokenizeIndonesian } from './tokenizer'
import { vectorizeTFIDF } from './tfidf'
import modelData from './model.json'

export interface ModelDataStructure {
  version: string
  categories: ContentCategory[]
  classPriors: Record<ContentCategory, number>
  vocabulary: Record<string, number>
  idf: number[]
  classWordProbs: Record<ContentCategory, number[]>
}

const model = modelData as unknown as ModelDataStructure

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

  // Pengurangan maxLog mencegah overflow eksponeensial (numerical stability)
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
 * @param text - Teks mentah masukan pengguna/analis
 * @returns Prediksi probabilitas per kategori dan kategori pemenang
 */
export function predictNaiveBayes(text: string): MLPrediction {
  const tokens = tokenizeIndonesian(text, true)

  // Kasus teks kosong / tidak ada token valid
  if (tokens.length === 0) {
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
    }
  }

  // Vektorisasi TF-IDF
  const vector = vectorizeTFIDF(tokens, model.vocabulary, model.idf)

  // Jika tidak ada kata yang cocok dengan vocabulary model
  if (vector.indices.length === 0) {
    return {
      category: 'NETRAL',
      probabilities: {
        HOAKS: 0.15,
        PROPAGANDA: 0.15,
        BUZZER: 0.15,
        DISINFORMASI: 0.15,
        NETRAL: 0.40,
      },
      tokens,
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

  return {
    category: bestCategory,
    probabilities,
    tokens,
  }
}
