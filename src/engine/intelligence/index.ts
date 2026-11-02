/**
 * ════════════════════════════════════════════════════════════════════════════════════
 * NARADA — COMMENT INTELLIGENCE & COGNITIVE SENTIMENT SUBSYSTEM (INDEX)
 * SPRINT 8: WORK PACKAGE 3 (UNIFIED COORDINATOR & CONTRACTS EXPORT)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ════════════════════════════════════════════════════════════════════════════════════
 */

import {
  NORMALIZATION_VERSION
} from './text-normalizer.ts'
import {
  SENTIMENT_ALGORITHM_VERSION,
  estimateCommentSentiment,
  aggregateSentimentDistribution
} from './sentiment-engine.ts'
import {
  SIMILARITY_ALGORITHM_VERSION,
  detectCommentSimilarityClusters
} from './similarity-engine.ts'
import {
  BURST_ALGORITHM_VERSION,
  detectCommentBursts
} from './burst-engine.ts'
import {
  COORDINATION_ALGORITHM_VERSION,
  evaluateCoordinationPattern
} from './coordination-engine.ts'
import type {
  CommentBatch,
  CommentRecord,
  CommentAnalysisRun,
  CommentAnalysisConfig,
  AnalysisCoverage
} from './comment-types.ts'

export const SYSTEM_INTELLIGENCE_VERSION = '1.0.0'

export * from './comment-types.ts'
export * from './text-normalizer.ts'
export * from './intake-parser.ts'
export * from './sentiment-engine.ts'
export * from './similarity-engine.ts'
export * from './burst-engine.ts'
export * from './coordination-engine.ts'

/**
 * Konfigurasi Default Analisis Komentar
 */
export const DEFAULT_ANALYSIS_CONFIG: CommentAnalysisConfig = {
  similarityThreshold: 0.75,
  minClusterSize: 2,
  minSubstantiveTokens: 4,
  burstWindows: ['5m', '15m', '1h', '6h'],
  burstThresholdRatio: 2.5,
  algorithmVersion: `${SYSTEM_INTELLIGENCE_VERSION} (Norm:${NORMALIZATION_VERSION}|Sent:${SENTIMENT_ALGORITHM_VERSION}|Sim:${SIMILARITY_ALGORITHM_VERSION}|Burst:${BURST_ALGORITHM_VERSION}|Coord:${COORDINATION_ALGORITHM_VERSION})`
}

/**
 * Menjalankan Analisis Komprehensif Terhadap Batch Rekaman Komentar
 * Menghasilkan snapshot immutable CommentAnalysisRun (Section 6.3 & 13.2)
 */
export function executeCommentAnalysis(
  batch: CommentBatch,
  records: CommentRecord[],
  partialConfig: Partial<CommentAnalysisConfig> = {}
): CommentAnalysisRun {
  const config: CommentAnalysisConfig = {
    ...DEFAULT_ANALYSIS_CONFIG,
    ...partialConfig
  }

  const runId = `RUN-${batch.id.replace('BAT-', '')}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
  const createdAt = new Date().toISOString()
  const warnings: string[] = []

  const totalInput = records.length
  // Filter hanya komentar yang berstatus VALID atau TRUNCATED
  const eligibleRecords = records.filter(r => r.validationState === 'VALID' || r.validationState === 'TRUNCATED')
  const excludedRecords = records.filter(r => r.validationState !== 'VALID' && r.validationState !== 'TRUNCATED')

  // 1. Eksekusi Analisis Sentimen Per-Komentar
  const sentimentResults = eligibleRecords.map(r => estimateCommentSentiment(r))
  const sentimentSummary = aggregateSentimentDistribution(sentimentResults)

  // 2. Eksekusi Analisis Kemiripan (Copypasta & Near-Duplicates)
  const similarityGroups = detectCommentSimilarityClusters(eligibleRecords, {
    similarityThreshold: config.similarityThreshold,
    minClusterSize: config.minClusterSize,
    minSubstantiveTokens: config.minSubstantiveTokens
  })

  // 3. Eksekusi Analisis Konsentrasi Temporal (Burst Detection)
  const burstAnalysis = detectCommentBursts(eligibleRecords, {
    windows: config.burstWindows,
    concentrationThresholdRatio: config.burstThresholdRatio
  })
  if (burstAnalysis.status === 'INSUFFICIENT_DATA') {
    warnings.push(`Burst Analysis: ${burstAnalysis.explanation}`)
  }

  // 4. Eksekusi Analisis Pola Koordinasi Konservatif
  const coordinationIndicator = evaluateCoordinationPattern(
    eligibleRecords,
    similarityGroups,
    burstAnalysis
  )

  // 5. Perhitungan Cakupan Multi-Dimensi (Section 12)
  let authorCount = 0
  for (const r of eligibleRecords) {
    if (r.authorHandle) authorCount++
  }

  const coverage: AnalysisCoverage = {
    sentiment: {
      eligibleCount: eligibleRecords.length,
      analyzedCount: sentimentResults.length,
      uncertainCount: sentimentSummary.uncertainCount,
      excludedCount: excludedRecords.length,
      coverageRatio: totalInput > 0 ? Number((sentimentResults.length / totalInput).toFixed(4)) : 0
    },
    similarity: {
      eligibleCount: eligibleRecords.length,
      excludedShortPhrasesCount: eligibleRecords.filter(r => r.tokenCount < config.minSubstantiveTokens).length,
      exactDuplicateGroupsCount: similarityGroups.filter(g => g.groupType === 'EXACT_DUPLICATE').length,
      nearDuplicateGroupsCount: similarityGroups.filter(g => g.groupType === 'NEAR_DUPLICATE').length,
      coverageRatio: totalInput > 0 ? Number((eligibleRecords.length / totalInput).toFixed(4)) : 0
    },
    burst: {
      eligibleCount: eligibleRecords.length,
      timestampedCount: burstAnalysis.timestampedRecordsCount,
      ambiguousCount: burstAnalysis.ambiguousTimestampsCount,
      invalidCount: burstAnalysis.invalidTimestampsCount,
      timestampCoverageRatio: burstAnalysis.timestampCoverageRatio
    },
    coordination: {
      availableSignalsCount: 6,
      observedSignalsCount: coordinationIndicator.triggeredFamilies.length,
      sourceDiversityRatio: coordinationIndicator.sourceDiversityScore,
      authorCoverageRatio: eligibleRecords.length > 0 ? Number((authorCount / eligibleRecords.length).toFixed(4)) : 0,
      sampleSize: eligibleRecords.length
    }
  }

  return {
    id: runId,
    caseId: batch.caseId,
    batchId: batch.id,
    createdAt,
    algorithmVersion: config.algorithmVersion,
    config,
    inputCount: totalInput,
    analyzedCount: eligibleRecords.length,
    excludedCount: excludedRecords.length,
    duplicateCount: batch.exactDuplicatesCount,
    coverage,
    sentimentSummary,
    sentimentResults,
    similarityGroups,
    burstAnalysis,
    coordinationIndicator,
    warnings,
    status: 'COMPLETED'
  }
}
