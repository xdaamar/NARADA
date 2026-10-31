/**
 * ════════════════════════════════════════════════════════════════════════════════════
 * NARADA — MACHINE-READABLE EVIDENCE MANIFEST GENERATOR
 * SPRINT 3: PACKAGE 5 (TRACEABLE INTELLIGENCE & AUDIT EVIDENCE MANIFEST)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ════════════════════════════════════════════════════════════════════════════════════
 * 
 * Prinsip:
 * - Menghasilkan manifest bukti digital terstruktur (JSON) dengan skema ketat.
 * - LABEL JUJUR: 'DEMONSTRATION / UNCLASSIFIED — NARADA ANALYTICAL ASSESSMENT'.
 *   Tidak memalsukan klasifikasi rahasia, nomor surat militer, atau nama pejabat.
 * - Menjamin privasi & minimisasi data: Menghapus PII dan tidak menyertakan path lokal / rahasia.
 * - Integritas digest SHA-256 mandiri untuk verifikasi tamper-evidence dokumen manifest.
 * ════════════════════════════════════════════════════════════════════════════════════
 */

import { fallbackSHA256 } from '../../utils/crypto.ts'
import {
  getInvestigationCase,
  getEvidenceRecordsForCase,
  getClaimsForCase,
  getRelationsForCase,
  getAssessmentsForCase,
  getAuditEventsForCase
} from './case-store.ts'

import type {
  EvidenceManifest,
  EvidenceManifestClaimEntry,
  EvidenceManifestEvidenceEntry,
  EvidenceManifestRelationEntry
} from './investigation-types.ts'

/**
 * Menghasilkan Evidence Manifest JSON yang machine-readable, terverifikasi hash, dan patuh etika
 */
export function generateEvidenceManifest(caseId: string): EvidenceManifest {
  const invCase = getInvestigationCase(caseId)
  if (!invCase) {
    throw new Error(`Kasus investigasi dengan ID ${caseId} tidak ditemukan untuk penyusunan Evidence Manifest`)
  }

  const claims = getClaimsForCase(caseId)
  const evidenceList = getEvidenceRecordsForCase(caseId)
  const relations = getRelationsForCase(caseId)
  const assessments = getAssessmentsForCase(caseId)
  const auditEvents = getAuditEventsForCase(caseId)

  // 1. Pemetaan Klaim & Status Asesmen Individual
  const manifestClaims: EvidenceManifestClaimEntry[] = claims.map(c => {
    const assess = assessments.find(a => a.claimId === c.id)
    return {
      id: c.id,
      text: c.claimText,
      verdict: assess ? (assess.verdict || assess.status || 'UNVERIFIED') : 'UNVERIFIED',
      limitations: assess?.limitations && assess.limitations.length > 0
        ? assess.limitations
        : ['Asesmen berbasis bukti digital lokal yang terdaftar pada sistem meja investigasi']
    }
  })

  // 2. Pemetaan Bukti Digital (Tanpa path filesystem mentah, dengan verifikasi digest)
  const manifestEvidence: EvidenceManifestEvidenceEntry[] = evidenceList.map(e => {
    return {
      id: e.id,
      type: e.evidenceType,
      sourceLabel: e.sourceLabel,
      sourceTimestampProvenance: e.sourceTimestampProvenance,
      publishedAt: e.sourceTimestampProvenance !== 'NO_SOURCE_TIMESTAMP' ? e.sourcePublishedAt : undefined,
      contentHashOriginal: e.contentHashOriginal,
      contentHashNormalized: e.contentHashNormalized,
      hashAlgorithm: e.hashAlgorithm || 'SHA-256',
      digestScope: e.digestScope || 'NORMALIZED_TEXT_UTF8',
      limitations: e.limitations || []
    }
  })

  // 3. Pemetaan Relasi Klaim - Bukti
  const manifestRelations: EvidenceManifestRelationEntry[] = relations.map(r => ({
    id: r.id,
    claimId: r.claimId,
    evidenceId: r.evidenceId,
    relationType: r.relationType,
    rationale: r.rationale
  }))

  // 4. Ringkasan Jejak Audit
  const auditSummary = {
    eventCount: auditEvents.length,
    firstEventAt: auditEvents.length > 0 ? auditEvents[auditEvents.length - 1].timestamp : undefined,
    lastEventAt: auditEvents.length > 0 ? auditEvents[0].timestamp : undefined
  }

  // 5. Ringkasan Kesamaan Naratif (Denominator transparan jika bukti > 1)
  const validTextEvidenceCount = evidenceList.filter(e => (e.redactedText || e.extractedText || e.normalizedText || '').trim().length > 0).length
  const totalPairs = validTextEvidenceCount > 1 ? (validTextEvidenceCount * (validTextEvidenceCount - 1)) / 2 : 0

  const narrativeSummary = validTextEvidenceCount > 0 ? {
    analyzedRecords: validTextEvidenceCount,
    totalPairsCompared: totalPairs,
    method: 'Normalized Jaccard N-Gram Similarity & Token Overlap (Text Only)'
  } : undefined

  const limitations: string[] = [
    'Dokumen ini merupakan Evidence Manifest digital analitis untuk keperluan pembuktian teknis dan audit jejak penyelidikan.',
    'Label klasifikasi: DEMONSTRATION / UNCLASSIFIED — NARADA ANALYTICAL ASSESSMENT.',
    'Bukan sertifikat yudisial resmi atau keputusan doktrin militer TNI AD.',
    'Verifikasi integritas bukti diukur berdasarkan digest kriptografis SHA-256 pada saat bukti didaftarkan ke meja investigasi.'
  ]

  if (invCase.isSimulation) {
    limitations.push('PERINGATAN BENCHMARK: Kasus ini berstatus simulasi dengan data sintetis; tidak boleh digunakan untuk referensi operasional live.')
  }

  const baseManifest: Omit<EvidenceManifest, 'manifestDigestSha256'> = {
    manifestVersion: '1.0.0',
    exportCreatedAt: new Date().toISOString(),
    caseId: invCase.id,
    caseNumber: invCase.caseNumber,
    title: invCase.title,
    caseStatus: invCase.status,
    mode: invCase.mode,
    isSimulation: invCase.isSimulation || false,
    simulationWatermark: invCase.simulationWatermark,
    claims: manifestClaims,
    evidence: manifestEvidence,
    relations: manifestRelations,
    auditSummary,
    narrativeSummary,
    classificationLabel: 'DEMONSTRATION / UNCLASSIFIED — NARADA ANALYTICAL ASSESSMENT',
    limitations
  }

  // Hitung digest SHA-256 dokumen manifest (Machine-readable verifiable digest)
  const canonicalString = JSON.stringify(baseManifest, Object.keys(baseManifest).sort())
  const manifestDigestSha256 = fallbackSHA256(canonicalString)

  return {
    ...baseManifest,
    manifestDigestSha256
  }
}

/**
 * Memverifikasi keutuhan berkas Evidence Manifest JSON
 */
export function verifyEvidenceManifestIntegrity(manifest: EvidenceManifest): {
  isValid: boolean
  expectedDigest: string
  actualDigest: string
} {
  const { manifestDigestSha256, ...baseManifest } = manifest
  const canonicalString = JSON.stringify(baseManifest, Object.keys(baseManifest).sort())
  const calculatedDigest = fallbackSHA256(canonicalString)

  return {
    isValid: calculatedDigest === manifestDigestSha256,
    expectedDigest: manifestDigestSha256 || '',
    actualDigest: calculatedDigest
  }
}
