// ─── NAIVE BAYES ENGINE TRAINER & COMPILER ───
// SPRINT 7A: Mengompilasi 2.500+ Korpus Menjadi Model Tervektorisasi (~350KB)
// Sistem Pertahanan Kognitif NARADA - PUSSIBERAD TNI AD

import { tokenizeIndonesian } from './tokenizer'
import type { ContentCategory } from '../../types'
import type { ModelDataStructure } from './naive-bayes'

const CATEGORIES: ContentCategory[] = ['HOAKS', 'PROPAGANDA', 'BUZZER', 'DISINFORMASI', 'NETRAL']

export interface CorpusSample {
  text: string
  category: ContentCategory
}

export interface CompilerOptions {
  alpha?: number // Laplace smoothing parameter (default: 1.0)
  maxVocabSize?: number // Target vocabulary size (default: 14250)
  minDocFreq?: number // Minimum document frequency (default: 1)
}

/**
 * Melatih model Multinomial Naive Bayes terbobot TF-IDF dari korpus leksikal
 */
export function compileModel(
  corpus: CorpusSample[],
  options: CompilerOptions = {}
): ModelDataStructure {
  const alpha = options.alpha ?? 1.0
  const maxVocabSize = options.maxVocabSize ?? 14250
  const minDocFreq = options.minDocFreq ?? 1

  // 1. Ekstraksi token & hitung frekuensi dokumen
  const docTokens: string[][] = []
  const docCategories: ContentCategory[] = []
  const docFreq = new Map<string, number>()
  const classDocsCount: Record<ContentCategory, number> = {
    HOAKS: 0,
    PROPAGANDA: 0,
    BUZZER: 0,
    DISINFORMASI: 0,
    NETRAL: 0,
  }

  for (const sample of corpus) {
    if (!sample.text || !CATEGORIES.includes(sample.category)) continue

    const tokens = tokenizeIndonesian(sample.text, true)
    docTokens.push(tokens)
    docCategories.push(sample.category)
    classDocsCount[sample.category]++

    // Catat DF (muncul di berapa dokumen)
    const seen = new Set(tokens)
    for (const token of seen) {
      docFreq.set(token, (docFreq.get(token) || 0) + 1)
    }
  }

  const N = docTokens.length

  // 2. Hitung Class Priors P(C_k)
  const classPriors: Record<ContentCategory, number> = {
    HOAKS: classDocsCount.HOAKS / N,
    PROPAGANDA: classDocsCount.PROPAGANDA / N,
    BUZZER: classDocsCount.BUZZER / N,
    DISINFORMASI: classDocsCount.DISINFORMASI / N,
    NETRAL: classDocsCount.NETRAL / N,
  }

  // 3. Saring & Peringkat Kosakata berdasarkan relevansi dan frekuensi
  const vocabEntries = Array.from(docFreq.entries())
    .filter(([_, df]) => df >= minDocFreq)
    // Urutkan berdasarkan DF menurun
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxVocabSize)

  const vocabulary: Record<string, number> = {}
  const idf: number[] = []

  for (let idx = 0; idx < vocabEntries.length; idx++) {
    const [token, df] = vocabEntries[idx]
    vocabulary[token] = idx
    // Smooth IDF Formula: log(N / (1 + df)) + 1
    const idfVal = parseFloat((Math.log(N / (1 + df)) + 1.0).toFixed(3))
    idf.push(idfVal)
  }

  const V = vocabEntries.length

  // 4. Hitung Term Frequency per Kelas N_{C_k, w_i}
  const classWordCounts: Record<ContentCategory, Float64Array> = {
    HOAKS: new Float64Array(V),
    PROPAGANDA: new Float64Array(V),
    BUZZER: new Float64Array(V),
    DISINFORMASI: new Float64Array(V),
    NETRAL: new Float64Array(V),
  }

  const classTotalTokens: Record<ContentCategory, number> = {
    HOAKS: 0,
    PROPAGANDA: 0,
    BUZZER: 0,
    DISINFORMASI: 0,
    NETRAL: 0,
  }

  for (let d = 0; d < N; d++) {
    const cat = docCategories[d]
    const tokens = docTokens[d]

    for (const token of tokens) {
      const idx = vocabulary[token]
      if (idx !== undefined) {
        classWordCounts[cat][idx] += 1
        classTotalTokens[cat] += 1
      }
    }
  }

  // 5. Hitung Conditional Probabilities P(w_i | C_k) dengan Laplace Smoothing
  const classWordProbs: Record<ContentCategory, number[]> = {
    HOAKS: new Array(V),
    PROPAGANDA: new Array(V),
    BUZZER: new Array(V),
    DISINFORMASI: new Array(V),
    NETRAL: new Array(V),
  }

  for (const cat of CATEGORIES) {
    const denominator = classTotalTokens[cat] + alpha * V
    const counts = classWordCounts[cat]
    const probs = classWordProbs[cat]

    for (let i = 0; i < V; i++) {
      const p = (counts[i] + alpha) / denominator
      // Simpan dengan presisi optimal untuk menghemat ukuran JSON (~350KB - 425KB)
      probs[i] = parseFloat(p.toPrecision(3))
    }
  }

  return {
    version: '2.0.0-SPRINT-7A',
    categories: CATEGORIES,
    classPriors,
    vocabulary,
    idf,
    classWordProbs,
  }
}
