/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — DETERMINISTIC FRESHNESS ENGINE & TIMESTAMP INTEGRITY
 * SPRINT 1: STRICT TEMPORAL BOUNDARY EVALUATOR
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Prinsip Desain:
 * 1. Deterministik & Pure Function: Mendukung clock injection (nowMs) untuk pengujian akurat.
 * 2. Integritas Semantik: Freshness dihitung dari publishedAt (sumber), bukan retrievedAt.
 * 3. Batas Eksplisit Tanpa Celah:
 *    - BREAKING: 0 s/d < 180 menit (< 3 jam)
 *    - AKTUAL: 180 s/d < 720 menit (3 s/d < 12 jam)
 *    - BERKEMBANG: 720 s/d 1440 menit (12 s/d 24 jam)
 *    - KONTEKS: > 1440 menit (> 24 jam)
 *    - UNKNOWN_DATE: Tanggal tidak ada
 *    - INVALID_TIMESTAMP: Format tanggal rusak
 *    - FUTURE_TIMESTAMP: Tanggal di masa depan melebihi toleransi clock skew (15 menit)
 * ══════════════════════════════════════════════════════════════════════════
 */

import type { FreshnessAssessment, FreshnessStatus } from './radar-types.ts'

export const FRESHNESS_THRESHOLDS = {
  BREAKING_MAX_MINUTES: 180,              // 3 Jam
  AKTUAL_MAX_MINUTES: 720,                // 12 Jam
  BERKEMBANG_MAX_MINUTES: 1440,           // 24 Jam
  CLOCK_SKEW_TOLERANCE_MINUTES: 15        // Toleransi selisih jam server/klien
} as const

const INDO_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/**
 * Parsing tanggal dari berbagai format feed (RFC 822, ISO 8601, format tanggal Indo).
 * Menjaga integritas waktu tanpa pernah fallback ke waktu saat ini (new Date()).
 */
export function parseSourceDate(rawDateStr?: string | null): {
  timestamp: number | null
  status: 'VALID' | 'UNKNOWN' | 'INVALID'
} {
  if (!rawDateStr || typeof rawDateStr !== 'string' || rawDateStr.trim() === '') {
    return { timestamp: null, status: 'UNKNOWN' }
  }

  const trimmed = rawDateStr.trim()

  // 1. Coba standar Date.parse (RFC 822 / ISO 8601)
  const parsedEpoch = Date.parse(trimmed)
  if (!isNaN(parsedEpoch) && parsedEpoch > 0) {
    return { timestamp: parsedEpoch, status: 'VALID' }
  }

  // 2. Coba deteksi pola regex YYYY-MM-DD atau YYYY/MM/DD
  const ymdMatch = trimmed.match(/\b(202\d)[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/)
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10)
    const month = parseInt(ymdMatch[2], 10) - 1
    const day = parseInt(ymdMatch[3], 10)
    const hours = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 12
    const mins = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0
    const secs = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0

    const constructed = new Date(Date.UTC(year, month, day, hours, mins, secs))
    if (!isNaN(constructed.getTime())) {
      return { timestamp: constructed.getTime(), status: 'VALID' }
    }
  }

  // 3. Coba deteksi pola tanggal format Indonesia: DD [NamaBulan] YYYY, HH:MM
  const idMatch = trimmed.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})(?:[,\s]+(\d{1,2}):(\d{1,2}))?/)
  if (idMatch) {
    const day = parseInt(idMatch[1], 10)
    const monthStr = idMatch[2].toLowerCase()
    const year = parseInt(idMatch[3], 10)
    const hours = idMatch[4] ? parseInt(idMatch[4], 10) : 12
    const mins = idMatch[5] ? parseInt(idMatch[5], 10) : 0

    let monthIdx = INDO_MONTHS.findIndex(m => monthStr.startsWith(m.toLowerCase()))
    if (monthIdx === -1) {
      const engMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
      monthIdx = engMonths.findIndex(m => monthStr.startsWith(m))
    }

    if (monthIdx !== -1) {
      // Asumsi zona waktu default Indonesia WIB (UTC+7) jika tidak dinyatakan
      const dateUtc = new Date(Date.UTC(year, monthIdx, day, hours - 7, mins, 0))
      if (!isNaN(dateUtc.getTime())) {
        return { timestamp: dateUtc.getTime(), status: 'VALID' }
      }
    }
  }

  return { timestamp: null, status: 'INVALID' }
}

/**
 * Menghitung penilaian freshness secara deterministik.
 * @param publishedAt Timestamp penerbitan artikel dalam epoch ms (null jika tidak ada).
 * @param nowMs Waktu evaluasi saat ini (default: Date.now(), dapat diinjeksi untuk test).
 */
export function evaluateFreshness(
  publishedAt: number | null,
  nowMs: number = Date.now()
): FreshnessAssessment {
  const evaluatedAt = nowMs

  // 1. Kasus: Tanggal publikasi tidak disediakan
  if (publishedAt === null || publishedAt === undefined) {
    return {
      status: 'UNKNOWN_DATE',
      ageMinutes: null,
      referenceTimestamp: null,
      evaluatedAt,
      reasonCode: 'MISSING_SOURCE_TIMESTAMP',
      humanLabel: 'Waktu Tidak Tersedia'
    }
  }

  // 2. Kasus: Timestamp tidak valid (NaN atau non-positif)
  if (isNaN(publishedAt) || publishedAt <= 0) {
    return {
      status: 'INVALID_TIMESTAMP',
      ageMinutes: null,
      referenceTimestamp: null,
      evaluatedAt,
      reasonCode: 'UNPARSEABLE_TIMESTAMP',
      humanLabel: 'Format Tanggal Rusak'
    }
  }

  // 3. Kasus: Tanggal masa depan (clock skew di luar 15 menit)
  const skewMinutes = (publishedAt - nowMs) / 60000
  if (skewMinutes > FRESHNESS_THRESHOLDS.CLOCK_SKEW_TOLERANCE_MINUTES) {
    return {
      status: 'FUTURE_TIMESTAMP',
      ageMinutes: Math.round(skewMinutes),
      referenceTimestamp: publishedAt,
      evaluatedAt,
      reasonCode: 'FUTURE_CLOCK_SKEW_DETECTED',
      humanLabel: 'Waktu Mendatang (+Skew)'
    }
  }

  // 4. Hitung usia publikasi dalam menit
  // Jika skew kecil (<15 menit), anggap usia 0 menit (baru saja)
  const diffMs = Math.max(0, nowMs - publishedAt)
  const ageMinutes = Math.floor(diffMs / 60000)

  // 5. Evaluasi rentang interval ketat
  let status: FreshnessStatus
  let reasonCode: string
  let humanLabel: string

  if (ageMinutes < FRESHNESS_THRESHOLDS.BREAKING_MAX_MINUTES) {
    // 0 s/d < 180 menit
    status = 'BREAKING'
    reasonCode = 'PUBLISHED_UNDER_3_HOURS'
    humanLabel = ageMinutes < 60 ? `${ageMinutes}m lalu (Breaking)` : `${Math.floor(ageMinutes / 60)}j ${ageMinutes % 60}m lalu (Breaking)`
  } else if (ageMinutes < FRESHNESS_THRESHOLDS.AKTUAL_MAX_MINUTES) {
    // 180 s/d < 720 menit
    status = 'AKTUAL'
    reasonCode = 'PUBLISHED_3_TO_12_HOURS'
    humanLabel = `${Math.floor(ageMinutes / 60)}j lalu (Aktual)`
  } else if (ageMinutes <= FRESHNESS_THRESHOLDS.BERKEMBANG_MAX_MINUTES) {
    // 720 s/d 1440 menit (12 - 24 jam)
    status = 'BERKEMBANG'
    reasonCode = 'PUBLISHED_12_TO_24_HOURS'
    humanLabel = `${Math.floor(ageMinutes / 60)}j lalu (Hari Ini)`
  } else {
    // > 1440 menit (> 24 jam)
    status = 'KONTEKS'
    reasonCode = 'PUBLISHED_OVER_24_HOURS'
    const daysAgo = Math.floor(ageMinutes / 1440)
    humanLabel = daysAgo === 1 ? '1 hari lalu (Arsip)' : `${daysAgo} hari lalu (Arsip)`
  }

  return {
    status,
    ageMinutes,
    referenceTimestamp: publishedAt,
    evaluatedAt,
    reasonCode,
    humanLabel
  }
}

/**
 * Format tanggal presisi militer standar TNI AD (e.g. "30 Okt 2026, 13:45 WIB")
 * Menampilkan label transparan jika timestamp tidak tersedia / invalid.
 */
export function formatMilitaryDate(timestamp: number | null): string {
  if (timestamp === null || timestamp === undefined || isNaN(timestamp) || timestamp <= 0) {
    return 'Waktu Publikasi Tidak Tersedia'
  }

  const d = new Date(timestamp)
  if (isNaN(d.getTime())) {
    return 'Format Waktu Rusak'
  }

  // Format dalam WIB (UTC+7)
  const day = String(d.getDate()).padStart(2, '0')
  const month = INDO_MONTHS[d.getMonth()] || 'Okt'
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, '0')
  const mins = String(d.getMinutes()).padStart(2, '0')

  return `${day} ${month} ${year}, ${hours}:${mins} WIB`
}
