/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — JACCARD SIMILARITY & COPYPASTA COMMENT CLUSTERING ENGINE
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * Algoritma klusterisasi teks komentar berbasis tokenisasi leksikal dan
 * koefisien kesamaan Jaccard (Jaccard Index >= 0.70).
 * ══════════════════════════════════════════════════════════════════════════
 */

import type { AnalyzedCommentItem, CopypastaCluster } from '../types/social-analysis-types.ts'

export function tokenizeText(text: string): Set<string> {
  const clean = text
    .toLowerCase()
    .replace(/[^\w\s\u00C0-\u1FFF\u2C00-\uD7FF]/g, ' ')
    .trim()
  const words = clean.split(/\s+/).filter(w => w.length > 2)
  return new Set(words)
}

export function calculateJaccardSimilarity(tokensA: Set<string>, tokensB: Set<string>): number {
  if (tokensA.size === 0 && tokensB.size === 0) return 1.0
  if (tokensA.size === 0 || tokensB.size === 0) return 0.0

  let intersection = 0
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++
  }
  const union = tokensA.size + tokensB.size - intersection
  return union > 0 ? intersection / union : 0
}

/**
 * Klusterisasi komentar duplikasi / template copypasta.
 * Menghindari false positive pada ujaran seru pendek (< 3 token kata).
 */
export function clusterDuplicateComments(
  comments: AnalyzedCommentItem[],
  similarityThreshold = 0.70
): CopypastaCluster[] {
  if (comments.length === 0) return []

  const tokenSets = comments.map(c => tokenizeText(c.text))
  const visited = new Set<number>()
  const rawClusters: number[][] = []

  for (let i = 0; i < comments.length; i++) {
    if (visited.has(i)) continue

    const clusterIndices = [i]
    visited.add(i)

    // Abaikan komentar yang sangat pendek (< 3 kata) dari pembentukan kluster copypasta
    // untuk mencegah false positive pada kata seru umum ("setuju", "amin", "mantap")
    if (tokenSets[i].size < 3) continue

    for (let j = i + 1; j < comments.length; j++) {
      if (visited.has(j)) continue
      if (tokenSets[j].size < 3) continue

      const sim = calculateJaccardSimilarity(tokenSets[i], tokenSets[j])
      if (sim >= similarityThreshold) {
        clusterIndices.push(j)
        visited.add(j)
      }
    }

    if (clusterIndices.length >= 2) {
      rawClusters.push(clusterIndices)
    }
  }

  // Ubah ke struktur CopypastaCluster
  const totalComments = comments.length
  return rawClusters
    .map((indices, idx) => {
      const clusterComments = indices.map(i => comments[i])
      const accounts = Array.from(new Set(clusterComments.map(c => c.authorUsername)))
      
      // Pilih teks template representatif (yang paling panjang atau pertama)
      const representative = clusterComments.reduce((longest, curr) =>
        curr.text.length > longest.text.length ? curr : longest
      , clusterComments[0])

      // Hitung rentang waktu jika ada timestamp
      let temporalSpanSeconds: number | undefined
      const timestamps = clusterComments
        .map(c => c.publishedAt ? Date.parse(c.publishedAt) : NaN)
        .filter(t => !isNaN(t))
      if (timestamps.length >= 2) {
        const minT = Math.min(...timestamps)
        const maxT = Math.max(...timestamps)
        temporalSpanSeconds = Math.max(0, Math.round((maxT - minT) / 1000))
      }

      return {
        clusterId: `cluster-${idx + 1}`,
        templateText: representative.text,
        commentCount: clusterComments.length,
        percentageOfTotal: totalComments > 0 ? Math.round((clusterComments.length / totalComments) * 100) : 0,
        accountsInvolved: accounts,
        sampleComments: clusterComments.slice(0, 5),
        similarityScore: similarityThreshold,
        temporalSpanSeconds
      }
    })
    .sort((a, b) => b.commentCount - a.commentCount)
}

