/**
 * ════════════════════════════════════════════════════════════════════════════════════
 * NARADA — COMMENT DATA INTAKE & VALIDATION PARSER
 * SPRINT 8: WORK PACKAGE 2 (INTAKE ENGINE & RESOURCE LIMITS)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ════════════════════════════════════════════════════════════════════════════════════
 */

import { fallbackSHA256 } from '../../utils/crypto.ts'
import { normalizeCommentText } from './text-normalizer.ts'
import type {
  CommentRecord,
  CommentIntakeMethod,
  IntakePreviewResult
} from './comment-types.ts'

// ─── AMBANG BATAS & LIMITASI SUMBER DAYA (Section 5.5) ───
export const INTAKE_LIMITS = {
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024,      // 5 MB
  MAX_RECORDS_PER_BATCH: 2000,              // Maksimal 2.000 komentar per batch
  MAX_COMMENT_CHARS: 5000,                  // Maksimal 5.000 karakter per komentar
  MAX_TOTAL_CHARS_PER_BATCH: 2_000_000,     // 2 Juta karakter total per batch
  PREVIEW_PAGE_SIZE: 50                     // Ukuran preview per halaman
} as const

// Regex ISO-8601 dengan offset eksplisit (Z atau +/-HH:MM atau +/-HHMM)
const ISO_EXPLICIT_OFFSET_REGEX = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/i

// Regex ISO-8601 ambigu (tanpa timezone offset)
const ISO_AMBIGUOUS_REGEX = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?$/i

/**
 * Parsing dan klasifikasi stempel waktu
 */
export function parseAndValidateTimestamp(rawTimestamp?: string): {
  parsedTimestamp?: string
  timezoneOffset?: string
  isAmbiguous: boolean
  isValid: boolean
} {
  if (!rawTimestamp || !rawTimestamp.trim()) {
    return { isAmbiguous: false, isValid: false }
  }

  const trimmed = rawTimestamp.trim()

  // Cek apakah memiliki offset eksplisit
  if (ISO_EXPLICIT_OFFSET_REGEX.test(trimmed)) {
    const dateObj = new Date(trimmed)
    if (!isNaN(dateObj.getTime())) {
      // Ekstraksi offset string
      let offset = 'UTC'
      const match = trimmed.match(/(Z|[+-]\d{2}:?\d{2})$/i)
      if (match) {
        offset = match[1].toUpperCase()
        if (offset === 'Z') offset = '+00:00'
      }
      return {
        parsedTimestamp: dateObj.toISOString(),
        timezoneOffset: offset,
        isAmbiguous: false,
        isValid: true
      }
    }
  }

  // Cek jika timestamp valid namun tanpa timezone offset (Ambigu)
  if (ISO_AMBIGUOUS_REGEX.test(trimmed)) {
    const dateObj = new Date(trimmed)
    if (!isNaN(dateObj.getTime())) {
      return {
        parsedTimestamp: trimmed,
        isAmbiguous: true,
        isValid: true
      }
    }
  }

  // Cek format tanggal standar lain
  const fallbackDate = new Date(trimmed)
  if (!isNaN(fallbackDate.getTime())) {
    return {
      parsedTimestamp: trimmed,
      isAmbiguous: true,
      isValid: true
    }
  }

  return {
    isAmbiguous: true,
    isValid: false
  }
}

/**
 * Sanitasi string masukan untuk mencegah eksekusi formula CSV saat diekspor kembali
 */
export function neutralizeFormulaInjection(value: string): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (trimmed.startsWith('=') || trimmed.startsWith('+') || trimmed.startsWith('-') || trimmed.startsWith('@')) {
    // Sisipkan petik tunggal inert di representasi data agar tidak dieksekusi spreadsheet
    return `'${trimmed}`
  }
  return value
}

/**
 * Robust RFC 4180 State-Machine CSV Parser
 * Menangani: field berkutip, koma di dalam kutip, escaped quote (""), CRLF & LF, UTF-8 BOM, multiline field.
 */
export function parseRFC4180CSV(csvText: string): string[][] {
  if (!csvText) return []

  // Buang UTF-8 BOM jika ada
  let text = csvText
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1)
  }

  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false
  let i = 0
  const len = text.length

  while (i < len) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        // Cek apakah ini escaped quote ("")
        if (i + 1 < len && text[i + 1] === '"') {
          currentField += '"'
          i += 2
          continue
        } else {
          // Tutup kutip
          inQuotes = false
          i++
          continue
        }
      } else {
        currentField += char
        i++
        continue
      }
    } else {
      if (char === '"') {
        inQuotes = true
        i++
        continue
      } else if (char === ',') {
        currentRow.push(currentField)
        currentField = ''
        i++
        continue
      } else if (char === '\r') {
        // Cek jika CRLF
        if (i + 1 < len && text[i + 1] === '\n') {
          i++
        }
        currentRow.push(currentField)
        rows.push(currentRow)
        currentRow = []
        currentField = ''
        i++
        continue
      } else if (char === '\n') {
        currentRow.push(currentField)
        rows.push(currentRow)
        currentRow = []
        currentField = ''
        i++
        continue
      } else {
        currentField += char
        i++
        continue
      }
    }
  }

  // Masukkan sisa field / row terakhir jika ada
  if (currentField.length > 0 || inQuotes || currentRow.length > 0) {
    currentRow.push(currentField)
    rows.push(currentRow)
  }

  return rows
}

export interface IntakeRawItem {
  text: string
  timestamp?: string
  sourceUrl?: string
  sourceLabel?: string
  authorHandle?: string
}

/**
 * Parser Masukan Manual Teks (One comment per line)
 */
export function parseManualInputText(rawText: string): IntakeRawItem[] {
  if (!rawText) return []
  const lines = rawText.split(/\r?\n/)
  const items: IntakeRawItem[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed) {
      items.push({ text: trimmed })
    }
  }
  return items
}

/**
 * Parser Masukan CSV
 */
export function parseCsvInput(csvText: string): { items: IntakeRawItem[]; warnings: string[] } {
  const warnings: string[] = []
  const matrix = parseRFC4180CSV(csvText)
  if (matrix.length === 0) {
    return { items: [], warnings: ['File CSV kosong atau tidak memiliki baris data.'] }
  }

  // Header row detection
  const headerRow = matrix[0].map(h => h.trim().toLowerCase())
  const textColIdx = headerRow.findIndex(h => h === 'text' || h === 'komentar' || h === 'comment' || h === 'content')
  const timestampColIdx = headerRow.findIndex(h => h === 'timestamp' || h === 'date' || h === 'waktu' || h === 'created_at')
  const sourceUrlColIdx = headerRow.findIndex(h => h === 'sourceurl' || h === 'url' || h === 'link')
  const sourceLabelColIdx = headerRow.findIndex(h => h === 'sourcelabel' || h === 'source' || h === 'sumber')
  const authorHandleColIdx = headerRow.findIndex(h => h === 'authorhandle' || h === 'author' || h === 'username' || h === 'user' || h === 'handle')

  const startIndex = textColIdx >= 0 ? 1 : 0
  const finalColText = textColIdx >= 0 ? textColIdx : 0

  const items: IntakeRawItem[] = []

  for (let r = startIndex; r < matrix.length; r++) {
    const row = matrix[r]
    // Abaikan baris kosong
    if (row.length === 0 || (row.length === 1 && !row[0].trim())) {
      continue
    }

    const text = row[finalColText]?.trim() || ''
    if (!text) continue

    const timestamp = timestampColIdx >= 0 ? row[timestampColIdx]?.trim() : undefined
    const sourceUrl = sourceUrlColIdx >= 0 ? row[sourceUrlColIdx]?.trim() : undefined
    const sourceLabel = sourceLabelColIdx >= 0 ? row[sourceLabelColIdx]?.trim() : undefined
    const authorHandle = authorHandleColIdx >= 0 ? row[authorHandleColIdx]?.trim() : undefined

    items.push({
      text,
      timestamp,
      sourceUrl,
      sourceLabel,
      authorHandle
    })
  }

  return { items, warnings }
}

/**
 * Parser Masukan JSON
 */
export function parseJsonInput(jsonText: string): { items: IntakeRawItem[]; warnings: string[] } {
  const warnings: string[] = []
  if (!jsonText || !jsonText.trim()) {
    return { items: [], warnings: ['String JSON kosong.'] }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch (err: any) {
    return { items: [], warnings: [`Gagal mem-parse JSON: ${err.message}`] }
  }

  if (!Array.isArray(parsed)) {
    return { items: [], warnings: ['Struktur root JSON harus berupa Array komentar [ { "text": ... } ].'] }
  }

  const items: IntakeRawItem[] = []
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i]
    if (typeof item === 'string') {
      if (item.trim()) items.push({ text: item.trim() })
      continue
    }

    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>
      const text = typeof obj.text === 'string' ? obj.text.trim() : typeof obj.comment === 'string' ? obj.comment.trim() : ''
      if (!text) {
        warnings.push(`Elemen index ${i} dilewati: properti 'text' tidak ditemukan atau kosong.`)
        continue
      }

      items.push({
        text,
        timestamp: typeof obj.timestamp === 'string' ? obj.timestamp.trim() : undefined,
        sourceUrl: typeof obj.sourceUrl === 'string' ? obj.sourceUrl.trim() : undefined,
        sourceLabel: typeof obj.sourceLabel === 'string' ? obj.sourceLabel.trim() : undefined,
        authorHandle: typeof obj.authorHandle === 'string' ? obj.authorHandle.trim() : undefined
      })
    } else {
      warnings.push(`Elemen index ${i} bukan objek komentar yang sah.`)
    }
  }

  return { items, warnings }
}

/**
 * Validasi Komprehensif dan Pembuatan Intake Preview
 */
export function createIntakePreview(
  rawItems: IntakeRawItem[],
  intakeMethod: CommentIntakeMethod,
  batchId: string,
  caseId: string,
  byteSize: number = 0
): IntakePreviewResult {
  const warnings: string[] = []
  const acceptedRecords: CommentRecord[] = []
  const rejectedRecords: Array<{ lineIndex: number; rawText: string; reason: string }> = []

  let exactDuplicateCount = 0
  let missingTimestampsCount = 0
  let ambiguousTimestampsCount = 0
  let missingAuthorsCount = 0
  let missingSourcesCount = 0
  let totalCharacters = 0

  // Peta deduplikasi teks kanonikal untuk deteksi duplikat persis dalam batch
  const seenExactTextHashes = new Set<string>()

  // Validasi Limitasi Ukuran File (5 MB)
  if (byteSize > INTAKE_LIMITS.MAX_FILE_SIZE_BYTES) {
    warnings.push(`Ukuran berkas (${(byteSize / (1024 * 1024)).toFixed(2)} MB) melebihi batas aman 5 MB.`)
  }

  // Validasi Batas Record (2.000)
  const itemsToProcess = rawItems.slice(0, INTAKE_LIMITS.MAX_RECORDS_PER_BATCH)
  if (rawItems.length > INTAKE_LIMITS.MAX_RECORDS_PER_BATCH) {
    warnings.push(`Jumlah masukan (${rawItems.length}) melebihi batas 2.000 records. Memotong ke 2.000 records teratas.`)
  }

  for (let idx = 0; idx < itemsToProcess.length; idx++) {
    const item = itemsToProcess[idx]
    const rawText = item.text || ''

    if (!rawText.trim()) {
      rejectedRecords.push({
        lineIndex: idx + 1,
        rawText,
        reason: 'Teks komentar kosong.'
      })
      continue
    }

    totalCharacters += rawText.length
    if (totalCharacters > INTAKE_LIMITS.MAX_TOTAL_CHARS_PER_BATCH) {
      warnings.push(`Total muatan teks batch melebihi batas 2.000.000 karakter pada baris ke-${idx + 1}.`)
      break
    }

    // Deteksi duplikasi eksak berdasarkan hash teks yang dinormalisasi
    const normalized = normalizeCommentText(rawText)
    const textHash = fallbackSHA256(normalized)

    if (seenExactTextHashes.has(textHash)) {
      exactDuplicateCount++
    } else {
      seenExactTextHashes.add(textHash)
    }

    // Validasi panjang komentar per record
    let validationState: CommentRecord['validationState'] = 'VALID'
    let exclusionReason: string | undefined = undefined

    if (rawText.length > INTAKE_LIMITS.MAX_COMMENT_CHARS) {
      validationState = 'TRUNCATED'
      exclusionReason = `Teks melebihi batas ${INTAKE_LIMITS.MAX_COMMENT_CHARS} karakter.`
      warnings.push(`Komentar pada baris ${idx + 1} melebihi 5.000 karakter, teks ditandai terpotong untuk analisis.`)
    }

    // Parsing timestamp
    const tsResult = parseAndValidateTimestamp(item.timestamp)
    if (!item.timestamp) {
      missingTimestampsCount++
    } else if (tsResult.isAmbiguous) {
      ambiguousTimestampsCount++
    }

    if (!item.authorHandle) missingAuthorsCount++
    if (!item.sourceUrl && !item.sourceLabel) missingSourcesCount++

    const recordId = `CR-${batchId.slice(0, 8)}-${String(idx + 1).padStart(4, '0')}`

    const record: CommentRecord = {
      id: recordId,
      batchId,
      caseId,
      rawText,
      normalizedText: normalized,
      sourceUrl: item.sourceUrl,
      sourceLabel: item.sourceLabel,
      authorHandle: item.authorHandle,
      rawTimestamp: item.timestamp,
      parsedTimestamp: tsResult.parsedTimestamp,
      timezoneOffset: tsResult.timezoneOffset,
      isTimestampAmbiguous: tsResult.isAmbiguous,
      validationState,
      exclusionReason,
      contentDigest: fallbackSHA256(rawText),
      characterCount: rawText.length,
      tokenCount: normalized.split(/\s+/).filter(Boolean).length
    }

    acceptedRecords.push(record)
  }

  const canProceed = acceptedRecords.length > 0 && byteSize <= INTAKE_LIMITS.MAX_FILE_SIZE_BYTES

  return {
    intakeMethod,
    totalRawRecords: rawItems.length,
    acceptedRecords,
    rejectedRecords,
    exactDuplicateCount,
    missingTimestampsCount,
    ambiguousTimestampsCount,
    missingAuthorsCount,
    missingSourcesCount,
    totalBytes: byteSize,
    totalCharacters,
    warnings,
    canProceed
  }
}
