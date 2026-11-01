/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — FORENSIC EVIDENCE INTEGRITY & CANONICAL MANIFEST ENGINE
 * PUSSIBERAD TNI AD × CODEPOLITAN — KARTIKA CYBER HACKATHON 2026
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Prinsip:
 * 1. Deterministic Canonical Manifest Serialization (alphabetical keys, no circularity).
 * 2. Strict SHA-256 byte-level verification for stored screenshot PNG & selected text UTF-8.
 * 3. Tri-state integrity verification: 'VERIFIED' | 'TAMPERED' | 'MISSING_ARTIFACT'.
 * 4. Immutable original capture records.
 * ══════════════════════════════════════════════════════════════════════════
 */

import { fallbackSHA256 } from '../../utils/crypto.ts'
import type { EvidenceRecord } from './investigation-types.ts'

export interface EvidenceIntegrityVerificationResult {
  isVerified: boolean
  status: 'VERIFIED' | 'TAMPERED' | 'MISSING_ARTIFACT' | 'UNVERIFIED'
  checkedAt: string // ISO-8601
  evidenceId: string
  details: {
    screenshotStatus: 'MATCH' | 'MISMATCH' | 'MISSING' | 'NOT_APPLICABLE'
    selectedTextStatus: 'MATCH' | 'MISMATCH' | 'MISSING' | 'NOT_APPLICABLE'
    manifestStatus: 'MATCH' | 'MISMATCH' | 'NOT_APPLICABLE'
  }
  expectedDigests: {
    screenshot?: string
    selectedText?: string
    manifest?: string
  }
  actualDigests: {
    screenshot?: string
    selectedText?: string
    manifest?: string
  }
  message: string
}

/**
 * Menghitung SHA-256 dari bytes (Uint8Array)
 */
export async function computeSha256FromBytes(bytes: Uint8Array): Promise<string> {
  const subtle = (globalThis as unknown as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle
  if (subtle) {
    try {
      const hashBuffer = await subtle.digest('SHA-256', bytes as unknown as BufferSource)
      return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    } catch {
      // Fallback
    }
  }

  // Fallback software
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return fallbackSHA256(binary)
}

/**
 * Menghitung SHA-256 dari string UTF-8
 */
export async function computeSha256FromText(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(text)
  return computeSha256FromBytes(bytes)
}

/**
 * Serialisasi kanonikal deterministik untuk manifest bukti (Kunci terurut alfabetis, tanpa field sirkuler)
 */
export function canonicalizeEvidenceManifest(record: Record<string, unknown>): string {
  // Field yang dikecualikan agar tidak sirkuler (digest manifest itu sendiri dan status live check)
  const excludedKeys = new Set([
    'manifestSha256',
    'integrityStatus',
    'lastVerifiedAt',
    'screenshotDataUrl', // Hindari payload biner besar di manifest JSON
    'hashes',
    'hashDisclaimer'
  ])

  function sortObject(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') {
      return obj
    }
    if (Array.isArray(obj)) {
      return obj.map(sortObject)
    }
    const sorted: Record<string, unknown> = {}
    const keys = Object.keys(obj as Record<string, unknown>)
      .filter(k => !excludedKeys.has(k))
      .sort()

    for (const key of keys) {
      const val = (obj as Record<string, unknown>)[key]
      if (val !== undefined) {
        sorted[key] = sortObject(val)
      }
    }
    return sorted
  }

  const sortedObj = sortObject(record)
  return JSON.stringify(sortedObj)
}

/**
 * Menghasilkan SHA-256 digest dari manifest bukti yang telah dikanonikalkan
 */
export async function computeManifestSha256(record: Record<string, unknown>): Promise<string> {
  const canonicalJson = canonicalizeEvidenceManifest(record)
  return computeSha256FromText(canonicalJson)
}

/**
 * Verifikasi forensik byte-level terhadap bukti digital
 */
export async function verifyEvidenceRecordIntegrity(
  record: EvidenceRecord,
  screenshotBytes?: Uint8Array | null,
  selectedTextBytes?: Uint8Array | null
): Promise<EvidenceIntegrityVerificationResult> {
  const now = new Date().toISOString()
  const meta = (record.metadata || {}) as Record<string, unknown>

  const expectedScreenshotHash = (meta.screenshotByteSha256 as string) || undefined
  const expectedTextHash = (meta.selectedTextByteSha256 as string) || (record.contentHashOriginal || undefined)
  const expectedManifestHash = (meta.manifestSha256 as string) || undefined

  let actualScreenshotHash: string | undefined
  let screenshotStatus: 'MATCH' | 'MISMATCH' | 'MISSING' | 'NOT_APPLICABLE' = 'NOT_APPLICABLE'

  if (expectedScreenshotHash) {
    if (!screenshotBytes || screenshotBytes.length === 0) {
      screenshotStatus = 'MISSING'
    } else {
      actualScreenshotHash = await computeSha256FromBytes(screenshotBytes)
      screenshotStatus = actualScreenshotHash.toLowerCase() === expectedScreenshotHash.toLowerCase()
        ? 'MATCH'
        : 'MISMATCH'
    }
  }

  let actualTextHash: string | undefined
  let textStatus: 'MATCH' | 'MISMATCH' | 'MISSING' | 'NOT_APPLICABLE' = 'NOT_APPLICABLE'

  if (expectedTextHash) {
    if (selectedTextBytes) {
      actualTextHash = await computeSha256FromBytes(selectedTextBytes)
    } else if (record.extractedText) {
      actualTextHash = await computeSha256FromText(record.extractedText)
    }

    if (!actualTextHash) {
      textStatus = 'MISSING'
    } else {
      textStatus = actualTextHash.toLowerCase() === expectedTextHash.toLowerCase()
        ? 'MATCH'
        : 'MISMATCH'
    }
  }

  let actualManifestHash: string | undefined
  let manifestStatus: 'MATCH' | 'MISMATCH' | 'NOT_APPLICABLE' = 'NOT_APPLICABLE'

  if (expectedManifestHash && typeof expectedManifestHash === 'string') {
    const metaHash = await computeManifestSha256(meta)
    if (metaHash.toLowerCase() === expectedManifestHash.toLowerCase()) {
      actualManifestHash = metaHash
      manifestStatus = 'MATCH'
    } else {
      const recHash = await computeManifestSha256(record as unknown as Record<string, unknown>)
      actualManifestHash = recHash
      manifestStatus = recHash.toLowerCase() === expectedManifestHash.toLowerCase()
        ? 'MATCH'
        : 'MISMATCH'
    }
  }

  // Tentukan status akhir
  let status: 'VERIFIED' | 'TAMPERED' | 'MISSING_ARTIFACT' | 'UNVERIFIED' = 'VERIFIED'
  let message = 'Integritas bukti digital terverifikasi valid (SHA-256 cocok)'

  if (screenshotStatus === 'MISSING' || textStatus === 'MISSING') {
    status = 'MISSING_ARTIFACT'
    message = 'Artefak bukti digital tidak ditemukan atau hilang dari penyimpanan'
  } else if (screenshotStatus === 'MISMATCH' || textStatus === 'MISMATCH' || manifestStatus === 'MISMATCH') {
    status = 'TAMPERED'
    message = 'Terdeteksi perubahan atau diskrepansi checksum SHA-256 pada bukti digital (TAMPERED)'
  } else if (screenshotStatus === 'NOT_APPLICABLE' && textStatus === 'NOT_APPLICABLE' && manifestStatus === 'NOT_APPLICABLE') {
    status = 'UNVERIFIED'
    message = 'Tidak ada checksum kriptografis yang tersimpan untuk bukti ini'
  }

  return {
    isVerified: status === 'VERIFIED',
    status,
    checkedAt: now,
    evidenceId: record.id,
    details: {
      screenshotStatus,
      selectedTextStatus: textStatus,
      manifestStatus
    },
    expectedDigests: {
      screenshot: expectedScreenshotHash,
      selectedText: expectedTextHash,
      manifest: expectedManifestHash
    },
    actualDigests: {
      screenshot: actualScreenshotHash,
      selectedText: actualTextHash,
      manifest: actualManifestHash
    },
    message
  }
}
