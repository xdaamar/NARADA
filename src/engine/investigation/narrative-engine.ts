/**
 * ════════════════════════════════════════════════════════════════════════════════════
 * NARADA — NARRATIVE SIMILARITY & TEMPORAL ANALYSIS ENGINE
 * SPRINT 2: D6 (NARRATIVE SIMILARITY PROFILE, TEMPORAL & RELATIONSHIP GRAPH)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ════════════════════════════════════════════════════════════════════════════════════
 * 
 * Prinsip:
 * - Menghapus skor komposit 0-100 (CIB/NCS tunggal) yang belum tervalidasi ilmiah.
 * - Mengganti dengan Narrative Similarity Profile deskriptif ber-denominator jujur.
 * - Temporal velocity murni berbasis stempel waktu aktual (NOL sintesis urutan baris).
 * - Graph relasi non-kausal tanpa inferensi botnet atau atribusi individu.
 * ════════════════════════════════════════════════════════════════════════════════════
 */

import { calculateJaccardSimilarity } from '../forensic/jaccard-matrix.ts'
import type {
  EvidenceRecord,
  ClaimRecord,
  EvidenceRelation,
  InvestigationCase,
  NarrativeSimilarityProfile,
  NarrativeSimilarityClass,
  TemporalAnalysisResult,
  TemporalAvailability,
  TimestampProvenance,
  NarrativeRelationshipGraph,
  GraphNode,
  GraphEdge
} from './investigation-types.ts'

// Ambang batas heuristik kemiripan leksikal teks
export const SIMILARITY_THRESHOLDS = {
  NEAR_DUPLICATE: 0.65,
  HIGH_SIMILARITY: 0.45
} as const

export interface RecordSimilarityEvaluation {
  recordId: string
  content: string
  similarityClass: NarrativeSimilarityClass
  highestSimilarityScore: number
  matchedRecordId?: string
}

/**
 * Menghitung Profil Kemiripan Naratif (Descriptive, Non-Attributive)
 * dengan pelaporan numerator, denominator, dan batasan eksplisit
 */
export function computeNarrativeSimilarityProfile(
  records: Array<{ id: string; content?: string; extractedText?: string }>
): {
  profile: NarrativeSimilarityProfile & {
    nearDuplicate: { pairCount: number; percentage: number }
    highSimilarity: { pairCount: number; percentage: number }
    distinct: { pairCount: number; percentage: number }
  }
  evaluations: RecordSimilarityEvaluation[]
  sampleSufficiency: 'SUFFICIENT' | 'INSUFFICIENT_SAMPLE' | 'NOT_EVALUATED'
  sampleCount: number
  evaluatedPairCount: number
  caveats: string[]
} {
  const totalRaw = records.length

  // Filter teks substantif (minimal 10 karakter setelah dibersihkan)
  const normalizedRecords = records.map(r => ({
    id: r.id,
    content: (r.extractedText || r.content || '').trim()
  }))

  const eligibleRecords = normalizedRecords.filter(r => r.content.length >= 10)
  const excludedRecordsCount = totalRaw - eligibleRecords.length

  const n = eligibleRecords.length
  const totalPairsCompared = (n * (n - 1)) / 2

  const limitations = [
    'Jumlah sampel minimal 5 record untuk menghasilkan kesimpulan agregat yang dapat diandalkan.',
    'Kemiripan teks hanya merefleksikan leksikon sampel, bukan bukti koordinasi akun atau botnet.',
    'Ambang batas kemiripan menggunakan metode heuristik eksperimental (Jaccard N-Gram).'
  ]

  if (n < 5) {
    const prof = {
      totalAnalyzedRecords: n,
      totalPairsCompared,
      nearDuplicateCount: 0,
      nearDuplicatePercent: 0,
      highSimilarityCount: 0,
      highSimilarityPercent: 0,
      distinctCount: n,
      distinctPercent: n > 0 ? 100 : 0,
      excludedRecordsCount,
      exclusionReason: excludedRecordsCount > 0 ? 'Teks terlalu pendek (< 10 karakter) atau kosong' : undefined,
      method: 'Jaccard N-Gram Heuristic (Ambang: >=0.65 near-duplicate, >=0.45 high-similarity)',
      isSampleSufficient: false,
      sampleSufficiencyState: 'INSUFFICIENT_SAMPLE' as const,
      limitations,
      nearDuplicate: { pairCount: 0, percentage: 0 },
      highSimilarity: { pairCount: 0, percentage: 0 },
      distinct: { pairCount: n, percentage: n > 0 ? 100 : 0 }
    }
    return {
      profile: prof,
      evaluations: eligibleRecords.map(r => ({
        recordId: r.id,
        content: r.content,
        similarityClass: 'DISTINCT' as NarrativeSimilarityClass,
        highestSimilarityScore: 0
      })),
      sampleSufficiency: 'INSUFFICIENT_SAMPLE',
      sampleCount: n,
      evaluatedPairCount: totalPairsCompared,
      caveats: limitations
    }
  }

  // Bandingkan setiap record dengan pasangan tertingginya
  const maxScores = new Array<number>(n).fill(0)
  const bestMatchId = new Array<string | undefined>(n).fill(undefined)

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const score = calculateJaccardSimilarity(eligibleRecords[i].content, eligibleRecords[j].content)
      if (score > maxScores[i]) {
        maxScores[i] = score
        bestMatchId[i] = eligibleRecords[j].id
      }
      if (score > maxScores[j]) {
        maxScores[j] = score
        bestMatchId[j] = eligibleRecords[i].id
      }
    }
  }

  let nearDuplicateCount = 0
  let highSimilarityCount = 0
  let distinctCount = 0

  const evaluations: RecordSimilarityEvaluation[] = eligibleRecords.map((r, i) => {
    const score = maxScores[i]
    let similarityClass: NarrativeSimilarityClass = 'DISTINCT'

    if (score >= SIMILARITY_THRESHOLDS.NEAR_DUPLICATE) {
      similarityClass = 'NEAR_DUPLICATE'
      nearDuplicateCount++
    } else if (score >= SIMILARITY_THRESHOLDS.HIGH_SIMILARITY) {
      similarityClass = 'HIGH_SIMILARITY'
      highSimilarityCount++
    } else {
      distinctCount++
    }

    return {
      recordId: r.id,
      content: r.content,
      similarityClass,
      highestSimilarityScore: parseFloat(score.toFixed(3)),
      matchedRecordId: bestMatchId[i]
    }
  })

  const nearDuplicatePercent = Math.round((nearDuplicateCount / n) * 100)
  const highSimilarityPercent = Math.round((highSimilarityCount / n) * 100)
  const distinctPercent = Math.round((distinctCount / n) * 100)

  const prof = {
    totalAnalyzedRecords: n,
    totalPairsCompared,
    nearDuplicateCount,
    nearDuplicatePercent,
    highSimilarityCount,
    highSimilarityPercent,
    distinctCount,
    distinctPercent,
    excludedRecordsCount,
    exclusionReason: excludedRecordsCount > 0 ? 'Teks sampel terlalu pendek (< 10 karakter) atau kosong' : undefined,
    method: 'Jaccard N-Gram Heuristic (Ambang: >=0.65 near-duplicate, >=0.45 high-similarity)',
    isSampleSufficient: true,
    sampleSufficiencyState: 'SUFFICIENT' as const,
    limitations: [
      'Kemiripan leksikal teks (Jaccard similarity) mendeteksi repetisi frasa, bukan bukti koordinasi terpusat atau keberadaan botnet.',
      'Analisis hanya merefleksikan kumpulan data sampel yang dimasukkan operator dan tidak dapat digeneralisasi ke seluruh populasi media sosial.',
      'Template resmi dari institusi sah (siaran pers, pengumuman BMKG) dapat terdeteksi sebagai near-duplicate secara wajar.'
    ],
    nearDuplicate: { pairCount: nearDuplicateCount, percentage: nearDuplicatePercent },
    highSimilarity: { pairCount: highSimilarityCount, percentage: highSimilarityPercent },
    distinct: { pairCount: distinctCount, percentage: distinctPercent }
  }

  return {
    profile: prof,
    evaluations,
    sampleSufficiency: 'SUFFICIENT',
    sampleCount: n,
    evaluatedPairCount: totalPairsCompared,
    caveats: prof.limitations
  }
}

/**
 * Menghitung Analisis Temporal Berbasis Provenance Stempel Waktu yang Sah
 * Menghilangkan total row-order modulo synthesis
 */
export function computeTemporalAnalysis(
  records: Array<{
    id: string
    timestampIso?: string
    sourcePublishedAt?: string
    provenance?: TimestampProvenance
    sourceTimestampProvenance?: TimestampProvenance
  }>
): TemporalAnalysisResult {
  const total = records.length
  const provenanceBreakdown: Record<TimestampProvenance, number> = {
    SOURCE_REPORTED_TIMESTAMP: 0,
    OPERATOR_SUPPLIED_UNVERIFIED: 0,
    SYNTHETIC_BENCHMARK_TIMESTAMP: 0,
    NO_SOURCE_TIMESTAMP: 0
  }

  records.forEach(r => {
    const prov = r.provenance || r.sourceTimestampProvenance || 'NO_SOURCE_TIMESTAMP'
    provenanceBreakdown[prov] = (provenanceBreakdown[prov] || 0) + 1
  })

  // Pisahkan rekaman dengan stempel waktu valid
  const validTimestampRecords: Array<{ id: string; epoch: number; provenance: TimestampProvenance }> = []

  records.forEach(r => {
    const timeIso = r.timestampIso || r.sourcePublishedAt
    const prov = r.provenance || r.sourceTimestampProvenance || 'NO_SOURCE_TIMESTAMP'
    if (timeIso && prov !== 'NO_SOURCE_TIMESTAMP') {
      const parsed = Date.parse(timeIso)
      if (!isNaN(parsed)) {
        validTimestampRecords.push({ id: r.id, epoch: parsed, provenance: prov })
      }
    }
  })

  const validCount = validTimestampRecords.length
  const coveragePercent = total > 0 ? Math.round((validCount / total) * 100) : 0

  const enrichedBreakdown = {
    ...provenanceBreakdown,
    sourceReported: provenanceBreakdown.SOURCE_REPORTED_TIMESTAMP,
    operatorSupplied: provenanceBreakdown.OPERATOR_SUPPLIED_UNVERIFIED,
    syntheticBenchmark: provenanceBreakdown.SYNTHETIC_BENCHMARK_TIMESTAMP,
    noSource: provenanceBreakdown.NO_SOURCE_TIMESTAMP
  }

  if (validCount === 0) {
    return {
      availability: 'NOT_AVAILABLE_NO_SOURCE_TIMESTAMP',
      status: 'NOT_AVAILABLE_NO_TIMESTAMPS',
      validTimestampCount: 0,
      recordCountWithTimestamp: 0,
      totalSampleCount: total,
      sourceTimestampCoveragePercent: 0,
      earliestTimestampIso: null,
      latestTimestampIso: null,
      averageIntervalSeconds: null,
      burstVelocityPerMinute: null,
      provenanceBreakdown: enrichedBreakdown,
      limitations: ['Tidak ada stempel waktu sumber yang tersedia pada sampel; laju semburan dan interval tidak dihitung.']
    }
  }

  if (validCount < 2) {
    return {
      availability: 'NOT_AVAILABLE_INSUFFICIENT_SAMPLE',
      status: 'NOT_AVAILABLE_INSUFFICIENT_SAMPLE',
      validTimestampCount: validCount,
      recordCountWithTimestamp: validCount,
      totalSampleCount: total,
      sourceTimestampCoveragePercent: coveragePercent,
      earliestTimestampIso: new Date(validTimestampRecords[0].epoch).toISOString(),
      latestTimestampIso: new Date(validTimestampRecords[0].epoch).toISOString(),
      averageIntervalSeconds: null,
      burstVelocityPerMinute: null,
      provenanceBreakdown: enrichedBreakdown,
      limitations: ['Jumlah rekaman ber-stempel waktu tidak mencukupi untuk menghitung interval waktu (minimal 2 titik waktu).']
    }
  }

  // Cek apakah ada percampuran mode waktu (misal: simulasi dicampur data nyata)
  const isSynthetic = provenanceBreakdown.SYNTHETIC_BENCHMARK_TIMESTAMP > 0
  const isReal = provenanceBreakdown.SOURCE_REPORTED_TIMESTAMP > 0 || provenanceBreakdown.OPERATOR_SUPPLIED_UNVERIFIED > 0
  let availability: TemporalAvailability = 'AVAILABLE'
  const limitations: string[] = []

  if (isSynthetic && isReal) {
    availability = 'MIXED_PROVENANCE_REVIEW_REQUIRED'
    limitations.push('PERINGATAN INTEGRITAS: Stempel waktu sintetis benchmark terdeteksi bercampur dengan data lapangan; pisahkan analisis.')
  } else if (isSynthetic) {
    availability = 'SYNTHETIC_BENCHMARK_ONLY'
    limitations.push('SIMULASI: Analisis temporal dihitung dari dataset uji sintetis terkontrol, bukan data operasional nyata.')
  } else if (provenanceBreakdown.OPERATOR_SUPPLIED_UNVERIFIED > 0) {
    limitations.push('Stempel waktu sebagian atau seluruhnya dimasukkan oleh operator dan belum diverifikasi secara independen.')
  }

  validTimestampRecords.sort((a, b) => a.epoch - b.epoch)

  const intervals: number[] = []
  for (let i = 1; i < validTimestampRecords.length; i++) {
    const diffSec = Math.max(0.1, (validTimestampRecords[i].epoch - validTimestampRecords[i - 1].epoch) / 1000)
    intervals.push(diffSec)
  }

  const sumIntervals = intervals.reduce((acc, curr) => acc + curr, 0)
  const averageIntervalSeconds = parseFloat((sumIntervals / intervals.length).toFixed(1))

  const earliestEpoch = validTimestampRecords[0].epoch
  const latestEpoch = validTimestampRecords[validTimestampRecords.length - 1].epoch
  const spanMinutes = Math.max(0.1, (latestEpoch - earliestEpoch) / 60000)
  const burstVelocityPerMinute = Math.round(validTimestampRecords.length / spanMinutes)

  return {
    availability,
    status: 'VALID_INTERVALS',
    validTimestampCount: validCount,
    recordCountWithTimestamp: validCount,
    totalSampleCount: total,
    sourceTimestampCoveragePercent: coveragePercent,
    earliestTimestampIso: new Date(earliestEpoch).toISOString(),
    latestTimestampIso: new Date(latestEpoch).toISOString(),
    averageIntervalSeconds,
    burstVelocityPerMinute,
    provenanceBreakdown: enrichedBreakdown,
    limitations
  }
}

/**
 * Membangun Model Graf Hubungan Naratif (Non-Causal, Grounded in Evidence)
 */
export function buildNarrativeRelationshipGraph(params: {
  investigationCase: InvestigationCase
  evidenceRecords?: EvidenceRecord[]
  evidenceList?: EvidenceRecord[]
  claims: ClaimRecord[]
  relations: EvidenceRelation[]
}): NarrativeRelationshipGraph {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const evidenceList = params.evidenceRecords || params.evidenceList || []

  // Node 1: Event Case Node
  nodes.push({
    id: params.investigationCase.id,
    label: params.investigationCase.title.slice(0, 36) + (params.investigationCase.title.length > 36 ? '...' : ''),
    type: 'EVENT',
    subLabel: params.investigationCase.caseNumber,
    status: params.investigationCase.status
  })

  // Nodes for Claims
  params.claims.forEach(cl => {
    nodes.push({
      id: cl.id,
      label: cl.claimText.slice(0, 32) + (cl.claimText.length > 32 ? '...' : ''),
      type: 'CLAIM',
      subLabel: `Klaim [${cl.status}]`,
      status: cl.status
    })

    // Edge dari Event ke Claim
    edges.push({
      id: `edge-${params.investigationCase.id}-${cl.id}`,
      source: params.investigationCase.id,
      target: cl.id,
      type: 'REFERENCES',
      label: 'MEMERIKSA KLAIM'
    })
  })

  // Nodes for Evidence
  evidenceList.forEach(ev => {
    nodes.push({
      id: ev.id,
      label: ev.sourceLabel.slice(0, 24),
      type: 'EVIDENCE',
      subLabel: `${ev.evidenceType} (${ev.verificationStatus})`,
      status: ev.verificationStatus
    })

    // Edge dari Event ke Evidence
    edges.push({
      id: `edge-${params.investigationCase.id}-${ev.id}`,
      source: params.investigationCase.id,
      target: ev.id,
      type: 'CONTEXTUALIZES',
      label: 'BERKAS BUKTI'
    })
  })

  // Edges dari Relasi Explicit Evidence-Claim
  params.relations.forEach(rel => {
    edges.push({
      id: rel.id,
      source: rel.evidenceId,
      target: rel.claimId,
      type: rel.relationType,
      label: rel.relationType
    })
  })

  return { nodes, edges }
}
