/**
 * ════════════════════════════════════════════════════════════════════════════════════
 * NARADA — BOUNDED COPYPASTA & NEAR-DUPLICATE SIMILARITY ENGINE
 * SPRINT 8: WORK PACKAGE 3 (DETERMINISTIC JACCARD SHINGLE SIMILARITY)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ════════════════════════════════════════════════════════════════════════════════════
 */

import { extractTextFeatures } from './text-normalizer.ts'
import type {
  CommentRecord,
  SimilarityGroup
} from './comment-types.ts'

export const SIMILARITY_ALGORITHM_VERSION = '1.1.0-shingle-jaccard'

/**
 * Frasa generik pendek yang dilarang membentuk kluster copypasta bermakna (Section 9)
 */
export const GENERIC_SHORT_PHRASES = new Set<string>([
  'setuju',
  'amin',
  'aamiin',
  'terima kasih',
  'terimakasih',
  'makasih',
  'mantap',
  'siap',
  'ok',
  'oke',
  'sip',
  'betul',
  'bener',
  'up',
  'hadir',
  'semoga',
  'keren'
])

/**
 * Membuat n-shingle token dari teks (default 3-gram karakter atau 2-gram kata)
 */
export function buildWordShingles(tokens: string[], shingleSize: number = 2): Set<string> {
  const shingles = new Set<string>()
  if (tokens.length < shingleSize) {
    if (tokens.length > 0) {
      shingles.add(tokens.join('_'))
    }
    return shingles
  }

  for (let i = 0; i <= tokens.length - shingleSize; i++) {
    const shingle = tokens.slice(i, i + shingleSize).join('_')
    shingles.add(shingle)
  }
  return shingles
}

/**
 * Menghitung Koefisien Jaccard antara dua set shingle
 */
export function computeJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1.0
  if (setA.size === 0 || setB.size === 0) return 0.0

  let intersectionCount = 0
  for (const item of setA) {
    if (setB.has(item)) {
      intersectionCount++
    }
  }

  const unionCount = setA.size + setB.size - intersectionCount
  return unionCount === 0 ? 0.0 : Number((intersectionCount / unionCount).toFixed(4))
}

export interface SimilarityEngineOptions {
  similarityThreshold?: number       // default: 0.75
  minSubstantiveTokens?: number      // default: 4
  minClusterSize?: number            // default: 2
  maxCandidatesPerItem?: number      // default: 50 (Bounded candidates per comment to prevent O(n^2))
  maxComparisonsBudget?: number      // default: 50000 (Global comparison budget cap)
}

/**
 * Menjalankan Analisis Deteksi Kemiripan Teks Terbatas (Bounded Candidate Bucketing)
 */
export function detectCommentSimilarityClusters(
  comments: CommentRecord[],
  options: SimilarityEngineOptions = {}
): SimilarityGroup[] {
  const threshold = options.similarityThreshold ?? 0.75
  const minSubstantive = options.minSubstantiveTokens ?? 4
  const minClusterSize = options.minClusterSize ?? 2
  const maxCandidatesPerItem = options.maxCandidatesPerItem ?? 50
  const maxComparisonsBudget = options.maxComparisonsBudget ?? 50000

  if (!comments || comments.length === 0) return []

  // 1. Ekstraksi fitur dan pre-kalkulasi shingle untuk seluruh komentar
  interface CommentProfile {
    record: CommentRecord
    tokens: string[]
    shingles: Set<string>
    isGeneric: boolean
    substantiveCount: number
    clustered: boolean
  }

  const profiles: CommentProfile[] = comments.map(c => {
    const feats = extractTextFeatures(c.normalizedText || c.rawText)
    const rawNormalized = c.normalizedText.trim().toLowerCase()
    const isGenericPhrase = GENERIC_SHORT_PHRASES.has(rawNormalized) || (feats.substantiveWordCount < minSubstantive)
    const tokens = feats.tokens.map(t => t.normalized)
    const shingles = buildWordShingles(tokens, 2)

    return {
      record: c,
      tokens,
      shingles,
      isGeneric: isGenericPhrase,
      substantiveCount: feats.substantiveWordCount,
      clustered: false
    }
  })

  // 2. Candidate Bucketing untuk mencegah bottleneck O(n^2)
  // Indeks kata kunci substansial ke daftar profil
  const wordIndex = new Map<string, number[]>()
  for (let idx = 0; idx < profiles.length; idx++) {
    const p = profiles[idx]
    if (p.isGeneric) continue // Kecualikan frasa generik dari pembentukan kluster
    for (const t of p.tokens) {
      if (t.length >= 3) {
        let bucket = wordIndex.get(t)
        if (!bucket) {
          bucket = []
          wordIndex.set(t, bucket)
        }
        bucket.push(idx)
      }
    }
  }

  // Threshold frekuensi tinggi: kata yang muncul di > 40% korpus (jika N > 20) dikecualikan dari indexing kandidat
  const highFrequencyCutoff = Math.max(15, Math.floor(profiles.length * 0.40))

  const clusters: SimilarityGroup[] = []
  let totalComparisons = 0

  // 3. Pengelompokan Berdasarkan Kandidat
  for (let i = 0; i < profiles.length; i++) {
    if (totalComparisons >= maxComparisonsBudget) break

    const pA = profiles[i]
    if (pA.clustered || pA.isGeneric) continue

    // Cari kandidat yang berbagi kata kunci dari indeks (urutkan dari kata kunci paling diskriminatif)
    const candidateIndices = new Set<number>()
    
    // Sortir token pA berdasarkan ukuran bucket terkecil (paling spesifik/diskriminatif)
    const sortedTokens = [...pA.tokens]
      .filter(t => t.length >= 3)
      .sort((a, b) => {
        const sizeA = wordIndex.get(a)?.length ?? 0
        const sizeB = wordIndex.get(b)?.length ?? 0
        return sizeA - sizeB
      })

    for (const t of sortedTokens) {
      if (candidateIndices.size >= maxCandidatesPerItem) break
      const bucket = wordIndex.get(t)
      if (bucket) {
        // Abaikan bucket yang terlalu padat jika ada alternatif
        if (bucket.length > highFrequencyCutoff && candidateIndices.size > 0) continue

        for (const bIdx of bucket) {
          if (bIdx > i && !profiles[bIdx].clustered) {
            candidateIndices.add(bIdx)
            if (candidateIndices.size >= maxCandidatesPerItem) break
          }
        }
      }
    }

    const matchedMembers: Array<{ index: number; score: number }> = [{ index: i, score: 1.0 }]

    for (const j of candidateIndices) {
      if (totalComparisons >= maxComparisonsBudget) break
      totalComparisons++

      const pB = profiles[j]
      // Periksa rasio panjang token (hanya bandingkan jika perbedaan panjang <= 50%)
      const lenRatio = Math.min(pA.tokens.length, pB.tokens.length) / Math.max(pA.tokens.length, pB.tokens.length)
      if (lenRatio < 0.5) continue

      const score = computeJaccardSimilarity(pA.shingles, pB.shingles)
      if (score >= threshold) {
        matchedMembers.push({ index: j, score })
      }
    }

    // Jika kluster memenuhi ukuran minimum (>= 2)
    if (matchedMembers.length >= minClusterSize) {
      let totalScore = 0
      let isExact = true

      for (const m of matchedMembers) {
        totalScore += m.score
        if (m.score < 0.99) isExact = false
        profiles[m.index].clustered = true
      }

      const avgScore = Number((totalScore / matchedMembers.length).toFixed(3))
      const groupType = isExact ? 'EXACT_DUPLICATE' : 'NEAR_DUPLICATE'

      clusters.push({
        groupId: `SG-${clusters.length + 1}-${groupType.slice(0, 3)}`,
        groupType,
        representativeText: pA.record.rawText,
        memberCount: matchedMembers.length,
        memberCommentIds: matchedMembers.map(m => profiles[m.index].record.id),
        averageSimilarityScore: avgScore,
        isShortGenericPhrase: false,
        tokenLength: pA.tokens.length
      })
    }
  }

  return clusters
}
