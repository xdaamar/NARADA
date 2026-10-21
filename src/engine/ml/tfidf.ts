// ─── TF-IDF VECTORIZER ───
// Berdasarkan PRD_02_ai_engine.md

export interface TFIDFVector {
  // Sparse representation: mapping dari feature index (number) ke bobot TF-IDF (number)
  indices: number[]
  values: number[]
  tokenCount: number
}

/**
 * Menghitung Term Frequency (TF) untuk setiap token unik dalam dokumen
 */
export function computeTermFrequency(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  if (!tokens || tokens.length === 0) return counts

  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1)
  }

  // Normalisasi frekuensi terhadap total token
  const total = tokens.length
  const tf = new Map<string, number>()
  for (const [token, count] of counts.entries()) {
    // Menggunakan log-scaled TF: 1 + log(count) untuk mencegah dominasi kata yang diulang terlalu banyak
    tf.set(token, 1 + Math.log(count / total + 1))
  }

  return tf
}

/**
 * Mengubah array token menjadi sparse TF-IDF vector berdasarkan vocabulary dan nilai IDF model
 * @param tokens - Daftar token hasil tokenizer
 * @param vocabulary - Kamus token -> index fitur
 * @param idf - Array bobot Inverse Document Frequency per index fitur
 */
export function vectorizeTFIDF(
  tokens: string[],
  vocabulary: Record<string, number>,
  idf: number[]
): TFIDFVector {
  const tf = computeTermFrequency(tokens)
  const indices: number[] = []
  const values: number[] = []

  for (const [token, tfVal] of tf.entries()) {
    const featureIdx = vocabulary[token]
    if (featureIdx !== undefined && featureIdx < idf.length) {
      const idfVal = idf[featureIdx]
      const tfidf = tfVal * idfVal
      indices.push(featureIdx)
      values.push(tfidf)
    }
  }

  // L2 Normalization pada vector agar panjang dokumen tidak membiaskan probabilitas
  let sumSquares = 0
  for (const val of values) {
    sumSquares += val * val
  }
  const norm = Math.sqrt(sumSquares) || 1.0

  const normalizedValues = values.map(v => v / norm)

  return {
    indices,
    values: normalizedValues,
    tokenCount: tokens.length,
  }
}

/**
 * Menghitung cosine similarity antara dua dokumen untuk clustering Nexus Network Graph
 */
export function computeCosineSimilarity(vecA: TFIDFVector, vecB: TFIDFVector): number {
  if (vecA.indices.length === 0 || vecB.indices.length === 0) return 0

  const mapB = new Map<number, number>()
  for (let i = 0; i < vecB.indices.length; i++) {
    mapB.set(vecB.indices[i], vecB.values[i])
  }

  let dotProduct = 0
  for (let i = 0; i < vecA.indices.length; i++) {
    const idx = vecA.indices[i]
    const valB = mapB.get(idx)
    if (valB !== undefined) {
      dotProduct += vecA.values[i] * valB
    }
  }

  return Math.max(0, Math.min(1, dotProduct))
}
