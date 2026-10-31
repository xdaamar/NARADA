/**
 * ════════════════════════════════════════════════════════════════════════════════════
 * NARADA — SECURE LOCAL EVIDENCE INGESTOR
 * SPRINT 2: D3 & GATE 0.5 (SECURE FILE INGESTION BASELINE) & GATE 0.6 (HASH SCOPES)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ════════════════════════════════════════════════════════════════════════════════════
 */

import { fallbackSHA256 } from '../../utils/crypto.ts'
import { applyPrivacyRedaction } from './privacy-sanitizer.ts'
import type {
  SupportedFileType,
  FileIngestValidationResult,
  EvidenceRecord,
  EvidenceType,
  EvidenceMode,
  TimestampProvenance,
  ExtractionMethod,
  DigestScope
} from './investigation-types.ts'

// Batas ukuran berkas yang diizinkan (Sprint 2 - G0.5)
export const FILE_SIZE_LIMITS: Record<SupportedFileType, number> = {
  TXT: 5 * 1024 * 1024,      // 5 MB
  CSV: 5 * 1024 * 1024,      // 5 MB
  JSON: 5 * 1024 * 1024,     // 5 MB
  PNG: 10 * 1024 * 1024,     // 10 MB
  JPEG: 10 * 1024 * 1024,    // 10 MB
  WEBP: 10 * 1024 * 1024,    // 10 MB
  PDF: 10 * 1024 * 1024      // 10 MB
}

export const MAX_CSV_ROWS = 10000

/**
 * Validasi Magic Bytes / File Signatures untuk mencegah ekstensi palsu
 */
export function validateMagicBytes(bytes: Uint8Array): { isValid: boolean; detectedType?: SupportedFileType; error?: string } {
  if (bytes.length < 4) {
    return { isValid: false, error: 'Berkas terlalu kecil atau kosong' }
  }

  // Tolak Windows Executable (MZ / PE)
  if (bytes[0] === 0x4D && bytes[1] === 0x5A) {
    return { isValid: false, error: 'Berkas executable (DOS/PE) dilarang!' }
  }

  // Tolak Linux ELF Executable
  if (bytes[0] === 0x7F && bytes[1] === 0x45 && bytes[2] === 0x4C && bytes[3] === 0x46) {
    return { isValid: false, error: 'Berkas executable ELF dilarang!' }
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4E &&
    bytes[3] === 0x47
  ) {
    return { isValid: true, detectedType: 'PNG' }
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return { isValid: true, detectedType: 'JPEG' }
  }

  // WebP: RIFF .... WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { isValid: true, detectedType: 'WEBP' }
  }

  // PDF: %PDF- (25 50 44 46 2D)
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2D
  ) {
    return { isValid: true, detectedType: 'PDF' }
  }

  // Cek apakah berkas merupakan teks UTF-8 (TXT, CSV, JSON)
  const isAsciiOrUtf8 = checkIsText(bytes)
  if (isAsciiOrUtf8) {
    const textPreview = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 1000)).trim()
    
    // Deteksi HTML aktif / SVG skrip (tolak demi keamanan)
    if (/^\s*<(?:!DOCTYPE\s+html|html|svg|script)[\s>]/i.test(textPreview)) {
      return { isValid: false, error: 'Berkas HTML/SVG aktif ditolak demi keamanan' }
    }

    if (textPreview.startsWith('{') || textPreview.startsWith('[')) {
      return { isValid: true, detectedType: 'JSON' }
    }

    if (textPreview.includes(',') || textPreview.includes(';') || textPreview.includes('\t')) {
      return { isValid: true, detectedType: 'CSV' }
    }

    return { isValid: true, detectedType: 'TXT' }
  }

  return { isValid: false, error: 'Tipe signature berkas tidak dikenali atau format tidak didukung' }
}

function checkIsText(bytes: Uint8Array): boolean {
  let nullBytes = 0
  const sampleLength = Math.min(bytes.length, 512)
  for (let i = 0; i < sampleLength; i++) {
    if (bytes[i] === 0) nullBytes++
  }
  return nullBytes === 0
}

/**
 * Validasi komprehensif berkas bukti digital sebelum disimpan
 */
export function validateEvidenceFile(
  fileName: string,
  fileBytes: Uint8Array
): FileIngestValidationResult {
  const size = fileBytes.length

  if (size === 0) {
    return {
      isValid: false,
      fileSizeBytes: 0,
      mimeType: 'application/octet-stream',
      errorCode: 'EMPTY_FILE',
      errorMessage: 'Berkas kosong (0 bytes)'
    }
  }

  // Tolak langsung ekstensi executable berbahaya
  const ext = fileName.toLowerCase().split('.').pop() || ''
  const dangerousExts = ['exe', 'bat', 'cmd', 'ps1', 'sh', 'py', 'js', 'mjs', 'cjs', 'vbs', 'dll', 'bin']
  if (dangerousExts.includes(ext)) {
    return {
      isValid: false,
      fileSizeBytes: size,
      mimeType: 'application/octet-stream',
      errorCode: 'EXECUTABLE_REJECTED',
      errorMessage: `Ekstensi berkas berbahaya (.${ext}) ditolak oleh sistem pertahanan Narada`
    }
  }

  const magicCheck = validateMagicBytes(fileBytes)
  if (!magicCheck.isValid || !magicCheck.detectedType) {
    return {
      isValid: false,
      fileSizeBytes: size,
      mimeType: 'application/octet-stream',
      errorCode: magicCheck.error?.includes('executable') ? 'EXECUTABLE_REJECTED' : 'UNSUPPORTED_TYPE',
      errorMessage: magicCheck.error || 'Format berkas tidak diizinkan'
    }
  }

  const detectedType = magicCheck.detectedType
  const maxSize = FILE_SIZE_LIMITS[detectedType]

  if (size > maxSize) {
    return {
      isValid: false,
      detectedType,
      fileSizeBytes: size,
      mimeType: getMimeType(detectedType),
      errorCode: 'FILE_TOO_LARGE',
      errorMessage: `Ukuran berkas (${(size / 1024 / 1024).toFixed(1)} MB) melebihi batas maksimal ${(maxSize / 1024 / 1024)} MB`
    }
  }

  // Hitung digest SHA-256 byte asli sebelum transformasi (Gate 0.6)
  let byteStr = ''
  for (let i = 0; i < fileBytes.length; i++) {
    byteStr += String.fromCharCode(fileBytes[i])
  }
  const originalByteSha256 = fallbackSHA256(byteStr)

  return {
    isValid: true,
    detectedType,
    fileSizeBytes: size,
    mimeType: getMimeType(detectedType),
    originalByteSha256
  }
}

function getMimeType(type: SupportedFileType): string {
  switch (type) {
    case 'PNG': return 'image/png'
    case 'JPEG': return 'image/jpeg'
    case 'WEBP': return 'image/webp'
    case 'PDF': return 'application/pdf'
    case 'CSV': return 'text/csv'
    case 'JSON': return 'application/json'
    case 'TXT': return 'text/plain'
  }
}

/**
 * Validasi keamanan URL referensi (Anti-SSRF, Allowlist & Scheme Verification)
 */
export function validateEvidenceUrl(rawUrl: string): {
  isValid: boolean
  sanitizedUrl?: string
  normalizedUrl?: string
  errorCode?: string
  errorMessage?: string
  error?: string
} {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return {
      isValid: false,
      errorCode: 'EMPTY_URL',
      errorMessage: 'URL tidak boleh kosong',
      error: 'URL tidak boleh kosong'
    }
  }

  const trimmed = rawUrl.trim()

  // Hanya perbolehkan skema HTTP dan HTTPS
  if (!/^https?:\/\//i.test(trimmed)) {
    return {
      isValid: false,
      errorCode: 'INVALID_PROTOCOL',
      errorMessage: 'Skema URL tidak sah. Hanya http:// dan https:// yang diizinkan',
      error: 'Skema URL tidak sah. Hanya http:// dan https:// yang diizinkan'
    }
  }

  try {
    const parsed = new URL(trimmed)
    const hostname = parsed.hostname.toLowerCase()

    // Tolak URL yang menyematkan kredensial otentikasi (username / password)
    if (parsed.username || parsed.password) {
      return {
        isValid: false,
        errorCode: 'CREDENTIALS_DISALLOWED',
        errorMessage: 'Kredensial otentikasi (user:pass) dilarang dalam URL bukti',
        error: 'Kredensial otentikasi (user:pass) dilarang dalam URL bukti'
      }
    }

    // Batasi port ke standar HTTP/HTTPS saja (80 atau 443)
    if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
      return {
        isValid: false,
        errorCode: 'NON_STANDARD_PORT',
        errorMessage: `Port tidak standar (${parsed.port}) dilarang oleh kebijakan keamanan`,
        error: `Port tidak standar (${parsed.port}) dilarang oleh kebijakan keamanan`
      }
    }

    // Bersihkan kurung siku IPv6
    const cleanHost = hostname.replace(/^\[|\]$/g, '')

    // Deteksi integer / hex notation (e.g. 2130706433 atau 0x7f000001)
    if (/^\d+$/.test(cleanHost) || /^0x[0-9a-f]+$/i.test(cleanHost)) {
      return {
        isValid: false,
        errorCode: 'SSRF_BLOCKED',
        errorMessage: 'Hostname numerik/heksadesimal dilarang oleh filter anti-SSRF',
        error: 'Hostname numerik/heksadesimal dilarang oleh filter anti-SSRF'
      }
    }

    // Blokir localhost dan loopback IP (IPv4 & IPv6)
    if (
      cleanHost === 'localhost' ||
      cleanHost === '0.0.0.0' ||
      cleanHost === '127.0.0.1' ||
      cleanHost === '::1' ||
      cleanHost === '::' ||
      cleanHost.startsWith('127.') ||
      cleanHost.startsWith('::ffff:127.')
    ) {
      return {
        isValid: false,
        errorCode: 'SSRF_BLOCKED',
        errorMessage: 'Target localhost / loopback dilarang oleh filter anti-SSRF',
        error: 'Target localhost / loopback dilarang oleh filter anti-SSRF'
      }
    }

    // Blokir Private & Link-Local IP ranges (RFC 1918, RFC 3927, RFC 4193, RFC 4291)
    if (
      /^10\./.test(cleanHost) ||
      /^192\.168\./.test(cleanHost) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanHost) ||
      /^169\.254\./.test(cleanHost) || // AWS/Cloud metadata & IPv4 link-local
      cleanHost.startsWith('fe80:') ||  // IPv6 link-local
      cleanHost.startsWith('fc00:') ||  // IPv6 unique local
      cleanHost.startsWith('fd00:') ||  // IPv6 unique local
      cleanHost.startsWith('::ffff:10.') ||
      cleanHost.startsWith('::ffff:192.168.') ||
      cleanHost.startsWith('::ffff:172.') ||
      cleanHost.startsWith('::ffff:169.254.')
    ) {
      return {
        isValid: false,
        errorCode: 'SSRF_BLOCKED',
        errorMessage: 'Alamat IP jaringan internal / cloud metadata dilarang oleh filter anti-SSRF',
        error: 'Alamat IP jaringan internal / cloud metadata dilarang oleh filter anti-SSRF'
      }
    }

    const urlStr = parsed.toString()
    return {
      isValid: true,
      sanitizedUrl: urlStr,
      normalizedUrl: urlStr
    }
  } catch {
    return {
      isValid: false,
      errorCode: 'INVALID_URL_FORMAT',
      errorMessage: 'Format URL tidak valid',
      error: 'Format URL tidak valid'
    }
  }
}

/**
 * Pembuatan Record Bukti Digital Resmi (Factory Method)
 */
export function createEvidenceRecord(params: {
  caseId: string
  evidenceType: EvidenceType
  evidenceMode: EvidenceMode
  sourceLabel: string
  sourceUrl?: string
  sourcePublishedAt?: string
  sourceTimestampProvenance: TimestampProvenance
  extractionMethod: ExtractionMethod
  extractedText: string
  originalByteSha256?: string
  originalRetained?: boolean
  metadata?: Record<string, unknown>
  limitations?: string[]
}): EvidenceRecord {
  const nowIso = new Date().toISOString()
  const cleanExtracted = (params.extractedText || '').trim()
  const redacted = applyPrivacyRedaction(cleanExtracted)

  // Digest teks ternormalisasi UTF-8
  const normalizedHash = fallbackSHA256(cleanExtracted)

  const digestScope: DigestScope = params.originalByteSha256
    ? 'ORIGINAL_FILE_BYTES'
    : 'NORMALIZED_TEXT_UTF8'

  const limitations = params.limitations || [
    'Bukti digital diekstraksi secara lokal tanpa transmisi ke server cloud.',
    'Hash SHA-256 membuktikan integritas snapshot pasca-akuisisi, bukan legal chain-of-custody peradilan.'
  ]

  if (params.sourceTimestampProvenance === 'NO_SOURCE_TIMESTAMP') {
    limitations.push('Stempel waktu sumber tidak tersedia; data waktu tidak dapat digunakan untuk analisis laju waktu.')
  } else if (params.sourceTimestampProvenance === 'OPERATOR_SUPPLIED_UNVERIFIED') {
    limitations.push('Stempel waktu dimasukkan oleh operator dan belum diverifikasi secara independen.')
  }

  return {
    id: `EV-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    caseId: params.caseId,
    evidenceType: params.evidenceType,
    evidenceMode: params.evidenceMode,
    sourceLabel: params.sourceLabel,
    sourceUrl: params.sourceUrl,
    sourcePublishedAt: params.sourcePublishedAt,
    sourceTimestampProvenance: params.sourceTimestampProvenance,
    submittedAt: nowIso,
    extractionMethod: params.extractionMethod,
    extractedText: cleanExtracted,
    redactedText: redacted,
    contentHashOriginal: params.originalByteSha256,
    contentHashNormalized: normalizedHash,
    hashes: [
      { digestScope: 'NORMALIZED_TEXT_UTF8', digest: normalizedHash },
      ...(params.originalByteSha256
        ? [{ digestScope: 'ORIGINAL_FILE_BYTES' as DigestScope, digest: params.originalByteSha256 }]
        : [{ digestScope: 'INPUT_TEXT_UTF8' as DigestScope, digest: normalizedHash }])
    ],
    hashDisclaimer: 'Hash SHA-256 membuktikan integritas snapshot pasca-akuisisi, bukan legal chain-of-custody peradilan.',
    hashAlgorithm: 'SHA-256',
    digestScope,
    originalRetained: Boolean(params.originalRetained),
    privacyRedactionStatus: 'AUTOMATIC_REDACTED',
    verificationStatus: params.evidenceMode === 'SYNTHETIC_BENCHMARK' ? 'VERIFIED' : 'UNVERIFIED',
    metadata: params.metadata,
    limitations,
    createdAt: nowIso,
    updatedAt: nowIso
  }
}
