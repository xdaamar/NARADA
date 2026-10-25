// ─── ALGORITMA JACCARD N-GRAM SIMILARITY & FUZZY LEVENSHTEIN CLUSTERER ───
// SPRINT 7C: Detektor Copypasta Swarm & Pola Koordinasi Buzzer
// Sistem Pertahanan Kognitif NARADA - PUSSIBERAD TNI AD × CODEPOLITAN

export interface CommentInput {
  id: string
  text: string
  author: string
  timestamp?: string
}

export interface CopypastaCluster {
  templateText: string
  occurrences: number
  percentageOfTotal: number
  sampleHandles: string[]
  memberIds: string[]
}

export interface CopypastaForensicResult {
  clusters: CopypastaCluster[]
  copypastaPercent: number
  isBuzzerAlarmActive: boolean
  classifiedComments: Array<{
    id: string
    isCopypastaTemplate: boolean
    matchedTemplatePattern?: string
  }>
}

/**
 * Ekstraksi token unigram dan bigram untuk menangkap konteks frasa
 */
export function extractNgrams(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)

  const ngrams = new Set<string>()
  for (let i = 0; i < words.length; i++) {
    ngrams.add(words[i])
    if (i < words.length - 1) {
      ngrams.add(`${words[i]} ${words[i + 1]}`)
    }
  }
  return ngrams
}

/**
 * Menghitung Jaccard Similarity antar-himpunan N-Gram dua teks
 * Range: 0.0 (berbeda total) hingga 1.0 (identik)
 */
export function calculateJaccardSimilarity(textA: string, textB: string): number {
  if (!textA || !textB) return 0
  const setA = extractNgrams(textA)
  const setB = extractNgrams(textB)
  if (setA.size === 0 || setB.size === 0) return 0

  let intersection = 0
  setA.forEach(item => {
    if (setB.has(item)) intersection++
  })

  const union = setA.size + setB.size - intersection
  return union > 0 ? intersection / union : 0
}

/**
 * Menghitung Levenshtein Distance (Edit Distance) dengan optimasi memori dua baris O(min(m, n))
 */
export function calculateLevenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const s1 = a.toLowerCase()
  const s2 = b.toLowerCase()

  let prevRow = new Array(s2.length + 1)
  let currRow = new Array(s2.length + 1)

  for (let j = 0; j <= s2.length; j++) {
    prevRow[j] = j
  }

  for (let i = 1; i <= s1.length; i++) {
    currRow[0] = i
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      currRow[j] = Math.min(
        currRow[j - 1] + 1,      // insertion
        prevRow[j] + 1,          // deletion
        prevRow[j - 1] + cost    // substitution
      )
    }
    const temp = prevRow
    prevRow = currRow
    currRow = temp
  }

  return prevRow[s2.length]
}

/**
 * Menghitung Levenshtein Fuzzy Similarity Ratio (0.0 - 1.0)
 * Tangguh terhadap variasi typo dan slang singkat
 */
export function calculateLevenshteinRatio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1.0
  const distance = calculateLevenshteinDistance(a, b)
  return Math.max(0, 1 - distance / maxLen)
}

/**
 * Menguji apakah dua komentar merupakan variasi dari satu template copypasta yang sama
 * Mengombinasikan Jaccard N-Gram Overlap dan Levenshtein Fuzzy Ratio
 */
export function isCopypastaMatch(textA: string, textB: string): boolean {
  if (textA === textB) return true
  const jaccard = calculateJaccardSimilarity(textA, textB)

  // Jika kemiripan leksikal N-Gram sangat tinggi
  if (jaccard >= 0.65) return true

  // Jika berada di batas abu-abu (0.50 - 0.65), lakukan verifikasi fuzzy Levenshtein
  if (jaccard >= 0.45) {
    const levRatio = calculateLevenshteinRatio(textA, textB)
    if (levRatio >= 0.70) return true
  }

  return false
}

/**
 * Klasterisasi Komentar Berdasarkan Kemiripan Template (Copypasta Swarm Clusterer)
 * @param comments - Kumpulan komentar yang dianalisis
 * @param alarmThresholdPercent - Ambang batas rasio copypasta untuk menyalakan alarm (default: 15%)
 */
export function clusterComments(
  comments: CommentInput[],
  alarmThresholdPercent = 15
): CopypastaForensicResult {
  if (!comments || comments.length === 0) {
    return {
      clusters: [],
      copypastaPercent: 0,
      isBuzzerAlarmActive: false,
      classifiedComments: []
    }
  }

  const rawClusters: Array<{
    representativeText: string
    handles: Set<string>
    memberIds: string[]
    count: number
  }> = []

  const commentClassificationMap = new Map<string, { isCopypasta: boolean; pattern?: string }>()

  for (const item of comments) {
    let matchedIndex = -1
    for (let i = 0; i < rawClusters.length; i++) {
      if (isCopypastaMatch(item.text, rawClusters[i].representativeText)) {
        matchedIndex = i
        break
      }
    }

    if (matchedIndex !== -1) {
      const cluster = rawClusters[matchedIndex]
      cluster.count++
      cluster.handles.add(item.author)
      cluster.memberIds.push(item.id)
    } else {
      rawClusters.push({
        representativeText: item.text,
        handles: new Set([item.author]),
        memberIds: [item.id],
        count: 1
      })
    }
  }

  // Filter klaster yang berulang minimal 2 kali (pola pengulangan)
  const significantClusters: CopypastaCluster[] = rawClusters
    .filter(c => c.count >= 2)
    .sort((a, b) => b.count - a.count)
    .map(c => {
      const pct = Math.round((c.count / comments.length) * 100)
      for (const id of c.memberIds) {
        commentClassificationMap.set(id, {
          isCopypasta: true,
          pattern: c.representativeText.slice(0, 30) + '...'
        })
      }
      return {
        templateText: c.representativeText,
        occurrences: c.count,
        percentageOfTotal: pct,
        sampleHandles: Array.from(c.handles).slice(0, 5),
        memberIds: c.memberIds
      }
    })

  // Hitung total komentar dalam klaster template
  let totalCopypastaCount = 0
  significantClusters.forEach(c => {
    totalCopypastaCount += c.occurrences
  })

  const copypastaPercent = Math.min(100, Math.round((totalCopypastaCount / comments.length) * 100))
  const isBuzzerAlarmActive = copypastaPercent >= alarmThresholdPercent

  const classifiedComments = comments.map(c => {
    const info = commentClassificationMap.get(c.id)
    return {
      id: c.id,
      isCopypastaTemplate: info?.isCopypasta ?? false,
      matchedTemplatePattern: info?.pattern
    }
  })

  return {
    clusters: significantClusters,
    copypastaPercent,
    isBuzzerAlarmActive,
    classifiedComments
  }
}
