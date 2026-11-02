/**
 * ════════════════════════════════════════════════════════════════════════════════════
 * NARADA — TEMPORAL CONCENTRATION & BURST DETECTION ENGINE
 * SPRINT 8: WORK PACKAGE 3 (TIMEZONE-AWARE SLIDING WINDOW BURST ANALYSIS)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ════════════════════════════════════════════════════════════════════════════════════
 */

import type {
  CommentRecord,
  BurstWindowResult,
  BurstAnalysisSummary
} from './comment-types.ts'

export const BURST_ALGORITHM_VERSION = '1.0.0-sliding-window'

export const BURST_WINDOW_MS = {
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000
} as const

export interface BurstEngineOptions {
  windows?: Array<'5m' | '15m' | '1h' | '6h'>
  concentrationThresholdRatio?: number  // default: 2.5
  minBurstCount?: number                // default: 5 komentar dalam jendela
  minTimestampCoverageRatio?: number    // default: 0.30 (30%)
  minSampleRecords?: number             // default: 10
}

/**
 * Menjalankan Analisis Temporal Concentration & Burst Detection
 */
export function detectCommentBursts(
  comments: CommentRecord[],
  options: BurstEngineOptions = {}
): BurstAnalysisSummary {
  const windows = options.windows ?? ['5m', '15m', '1h', '6h']
  const thresholdRatio = options.concentrationThresholdRatio ?? 2.5
  const minBurstCount = options.minBurstCount ?? 5
  const minCoverage = options.minTimestampCoverageRatio ?? 0.30
  const minSample = options.minSampleRecords ?? 10

  const eligibleCount = comments.length

  // Filter record yang memiliki timestamp valid tanpa ambiguitas
  const validRecords: Array<{ id: string; timeMs: number }> = []
  let ambiguousCount = 0
  let invalidCount = 0

  for (const c of comments) {
    if (!c.rawTimestamp) {
      continue
    }

    if (c.isTimestampAmbiguous) {
      ambiguousCount++
      continue
    }

    if (!c.parsedTimestamp) {
      invalidCount++
      continue
    }

    const t = new Date(c.parsedTimestamp).getTime()
    if (isNaN(t)) {
      invalidCount++
    } else {
      validRecords.push({ id: c.id, timeMs: t })
    }
  }

  const timestampedCount = validRecords.length
  const coverageRatio = eligibleCount > 0 ? Number((timestampedCount / eligibleCount).toFixed(4)) : 0

  // 1. Evaluasi Syarat Kecukupan Data (Section 10.3 / S8-BURST-04)
  if (eligibleCount < minSample || coverageRatio < minCoverage || timestampedCount < 5) {
    return {
      eligibleRecordsCount: eligibleCount,
      timestampedRecordsCount: timestampedCount,
      ambiguousTimestampsCount: ambiguousCount,
      invalidTimestampsCount: invalidCount,
      timestampCoverageRatio: coverageRatio,
      status: 'INSUFFICIENT_DATA',
      detectedBursts: [],
      explanation: `Data temporal tidak mencukupi untuk analisis burst yang dapat dipercaya (Cakupan timestamp: ${(coverageRatio * 100).toFixed(1)}%, Sampel valid: ${timestampedCount}/${eligibleCount}).`
    }
  }

  // Urutkan record berdasarkan waktu kronologis
  validRecords.sort((a, b) => a.timeMs - b.timeMs)

  const startTime = validRecords[0].timeMs
  const endTime = validRecords[validRecords.length - 1].timeMs
  const totalSpanMs = Math.max(endTime - startTime, 60 * 1000) // Minimal 1 menit span

  const detectedBursts: BurstWindowResult[] = []

  // 2. Evaluasi Sliding Window untuk setiap durasi
  for (const winKey of windows) {
    const winDurationMs = BURST_WINDOW_MS[winKey]
    if (totalSpanMs < winDurationMs * 0.5 && validRecords.length < 20) {
      // Span terlalu sempit dibanding jendela analisis, lewati jendela ini
      continue
    }

    // Baseline ekspektasi per jendela = (timestampedCount / totalSpanMs) * winDurationMs
    const baselineExpected = (timestampedCount / totalSpanMs) * winDurationMs

    // Sliding window dengan step 25% dari ukuran window
    const stepMs = Math.max(Math.floor(winDurationMs / 4), 60 * 1000)
    let maxObservedInWindow = 0
    let bestWindowStart = startTime
    let bestWindowEnd = startTime + winDurationMs
    let bestCommentIds: string[] = []

    for (let wStart = startTime; wStart <= endTime; wStart += stepMs) {
      const wEnd = wStart + winDurationMs
      const recordsInWin = validRecords.filter(r => r.timeMs >= wStart && r.timeMs < wEnd)

      if (recordsInWin.length > maxObservedInWindow) {
        maxObservedInWindow = recordsInWin.length
        bestWindowStart = wStart
        bestWindowEnd = wEnd
        bestCommentIds = recordsInWin.map(r => r.id)
      }
    }

    const concentrationRatio = baselineExpected > 0 ? Number((maxObservedInWindow / baselineExpected).toFixed(2)) : 0
    const isBurst = maxObservedInWindow >= minBurstCount && concentrationRatio >= thresholdRatio

    if (isBurst) {
      detectedBursts.push({
        windowDuration: winKey,
        windowStart: new Date(bestWindowStart).toISOString(),
        windowEnd: new Date(bestWindowEnd).toISOString(),
        observedCount: maxObservedInWindow,
        baselineRate: Number(baselineExpected.toFixed(2)),
        concentrationRatio,
        isBurst: true,
        commentIdsInWindow: bestCommentIds
      })
    }
  }

  return {
    eligibleRecordsCount: eligibleCount,
    timestampedRecordsCount: timestampedCount,
    ambiguousTimestampsCount: ambiguousCount,
    invalidTimestampsCount: invalidCount,
    timestampCoverageRatio: coverageRatio,
    status: 'ANALYZED',
    detectedBursts,
    explanation: detectedBursts.length > 0
      ? `Terdeteksi ${detectedBursts.length} anomali konsentrasi temporal melampaui baseline expected rate.`
      : 'Distribusi komentar merata dalam batas normal tanpa lonjakan temporal signifikan.'
  }
}
