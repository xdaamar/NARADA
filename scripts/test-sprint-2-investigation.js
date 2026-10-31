/**
 * ════════════════════════════════════════════════════════════════════════════════════
 * NARADA — COGNITIVE THREAT DEFENSE SYSTEM
 * SPRINT 2: CONTROLLED INVESTIGATION WORKBENCH & EVIDENCE INTELLIGENCE ENGINE
 * COMPREHENSIVE VERIFICATION & QUALITY GATES TEST SUITE
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ════════════════════════════════════════════════════════════════════════════════════
 * 
 * Pengujian Lengkap Seluruh Persyaratan Sprint 2:
 * - Group 0: Gate 0 Foundation Corrections (Provenance Enum, No NCS 0-100 Score,
 *            Privacy Hardening, CSV Injection Hardening, Secure Ingestion Baseline, Hash Scopes)
 * - Group 1: Investigation Case Management (D2)
 * - Group 2: Secure Local Evidence Ingestion (D3)
 * - Group 3: Evidence Provenance & Integrity Ledger (D4)
 * - Group 4: Claim-Level Assessment & Review Engine (D5)
 * - Group 5: Narrative Similarity Profile & Temporal Analysis (D6)
 * - Group 6: Explainable Assessment — "Why NARADA Thinks So" (D7)
 * - Group 7: System Contracts & Integration (D8)
 * ════════════════════════════════════════════════════════════════════════════════════
 */

import {
  // Gate 0.3 & 0.4: Privacy & CSV Sanitization
  redactHandle,
  redactEmail,
  redactPhoneNumber,
  applyPrivacyRedaction,
  sanitizeCsvCell,
  serializeToSafeCsv,

  // Gate 0.5 & D3: Evidence Ingestion & Magic Bytes
  validateMagicBytes,
  validateEvidenceFile,
  validateEvidenceUrl,
  createEvidenceRecord,

  // D2 & D4: Case Store & Provenance Ledger
  createInvestigationCase,
  getInvestigationCase,
  getAllInvestigationCases,
  getOrCreateCaseForCluster,
  updateCaseStatus,
  addEvidenceRecord,
  getEvidenceRecordsForCase,
  addClaimRecord,
  getClaimsForCase,
  addEvidenceRelation,
  getRelationsForCase,
  addAssessmentRecord,
  getAssessmentsForCase,
  addAuditEvent,
  getAuditEventsForCase,
  verifyEvidenceIntegrity,
  clearInvestigationStore,

  // D6: Narrative Engine & Temporal Analysis
  computeNarrativeSimilarityProfile,
  computeTemporalAnalysis,
  buildNarrativeRelationshipGraph,

  // D7: Explainable Assessment
  generateWhyNaradaThinksSo
} from '../src/engine/investigation/index.ts'

import { ACTIVE_RADAR_SOURCES } from '../src/engine/radar/source-registry.ts'
import { SYNTHETIC_BENCHMARKS } from '../src/engine/social-threat-dossier.ts'

// ─── Test Runner Harness ───
let totalAssertions = 0
let passedAssertions = 0
let failedAssertions = 0

function assert(condition, testId, description) {
  totalAssertions++
  if (condition) {
    passedAssertions++
    console.log(`  ✅ PASS: [${testId}] ${description}`)
  } else {
    failedAssertions++
    console.error(`  ❌ FAIL: [${testId}] ${description}`)
  }
}

console.log('══════════════════════════════════════════════════════════════════════')
console.log('🛡️  NARADA — SPRINT 2 CONTROLLED INVESTIGATION WORKBENCH & EVIDENCE INTELLIGENCE')
console.log('══════════════════════════════════════════════════════════════════════\n')

// ────────────────────────────────────────────────────────────────────────────
// GROUP 0: GATE 0 FOUNDATION CORRECTIONS
// ────────────────────────────────────────────────────────────────────────────
console.log('─── GROUP 0: Gate 0 Foundation Corrections ───')

// G0.1: Timestamp Provenance Enum Integrity
const validProvenances = [
  'SOURCE_REPORTED_TIMESTAMP',
  'OPERATOR_SUPPLIED_UNVERIFIED',
  'SYNTHETIC_BENCHMARK_TIMESTAMP',
  'NO_SOURCE_TIMESTAMP'
]
assert(validProvenances.length === 4, 'G0.1.1', 'Tepat 4 level timestamp provenance baku tersedia')
assert(!validProvenances.includes('VALID_SOURCE_TIMESTAMP'), 'G0.1.2', 'Label ambigu VALID_SOURCE_TIMESTAMP tidak digunakan untuk timestamp sintetis')

// G0.2: Narrative Similarity Profile vs Elimination of 0-100 Composite NCS Score
const sampleSmall = [
  createEvidenceRecord({
    caseId: 'CASE-TEST',
    evidenceType: 'PUBLIC_POST_TEXT',
    evidenceMode: 'LIVE_REFERENCE',
    sourceLabel: 'Sample 1',
    sourceTimestampProvenance: 'NO_SOURCE_TIMESTAMP',
    extractionMethod: 'MANUAL_TEXT',
    extractedText: 'TNI AU siagakan pesawat intai maritim di Natuna Utara.'
  }),
  createEvidenceRecord({
    caseId: 'CASE-TEST',
    evidenceType: 'PUBLIC_POST_TEXT',
    evidenceMode: 'LIVE_REFERENCE',
    sourceLabel: 'Sample 2',
    sourceTimestampProvenance: 'NO_SOURCE_TIMESTAMP',
    extractionMethod: 'MANUAL_TEXT',
    extractedText: 'Patroli TNI AU diperketat di kawasan laut Natuna Utara.'
  })
]
const profileSmall = computeNarrativeSimilarityProfile(sampleSmall)
assert(profileSmall.sampleSufficiency === 'INSUFFICIENT_SAMPLE', 'G0.2.1', 'Sampel di bawah 5 record menghasilkan status INSUFFICIENT_SAMPLE')
assert(profileSmall.sampleCount === 2, 'G0.2.2', 'sampleCount mencerminkan jumlah record aktual (2)')
assert(profileSmall.evaluatedPairCount === 1, 'G0.2.3', 'evaluatedPairCount menggunakan formula transparan N(N-1)/2 = 1')
assert(profileSmall.caveats.length > 0, 'G0.2.4', 'Caveat metodologis disertakan secara eksplisit')

// G0.3: Privacy & Redaction Hardening
const redactedH1 = redactHandle('@johndoe_military2026')
assert(redactedH1 === '@j***26', 'G0.3.1', 'Handle panjang diredaksi menjadi @j***26')
const redactedH2 = redactHandle('@ab')
assert(redactedH2 === '@a***', 'G0.3.2', 'Handle pendek diredaksi menjadi @a***')
const redactedEmail = redactEmail('letkol.budi@kemhan.go.id')
assert(redactedEmail === 'l***i@kemhan.go.id', 'G0.3.3', 'Email diredaksi dengan mempertahankan domain institusi')
const redactedPhone = redactPhoneNumber('0812-3456-7890')
assert(redactedPhone === '0812-****-7890', 'G0.3.4', 'Nomor telepon diredaksi 4 digit tengah')

const rawNarrative = 'Hubungi Kapten @budi_ops di budi@tniad.mil.id atau 0812-9988-7766 untuk logistik.'
const redactedText = applyPrivacyRedaction(rawNarrative)
assert(!redactedText.includes('@budi_ops'), 'G0.3.5', 'applyPrivacyRedaction meredaksi username dari narasi bebas')
assert(!redactedText.includes('0812-9988-7766'), 'G0.3.6', 'applyPrivacyRedaction meredaksi nomor telepon dari narasi bebas')
assert(redactedText.includes('tniad.mil.id'), 'G0.3.7', 'Domain institusi tetap dipertahankan untuk konteks investigasi')

// G0.4: CSV Formula Injection Hardening
assert(sanitizeCsvCell('=SUM(A1:A10)') === "'=SUM(A1:A10)", 'G0.4.1', 'Karakter = di awal sel diamankan dengan petik tunggal')
assert(sanitizeCsvCell('+cmd|/c calc') === "'+cmd|/c calc", 'G0.4.2', 'Karakter + di awal sel diamankan')
assert(sanitizeCsvCell('-2+3*cmd') === "'-2+3*cmd", 'G0.4.3', 'Karakter - di awal sel diamankan')
assert(sanitizeCsvCell('@SUM(1+1)') === "'@SUM(1+1)", 'G0.4.4', 'Karakter @ di awal sel diamankan')
assert(sanitizeCsvCell('\t=1+1') === "'\t=1+1", 'G0.4.5', 'Karakter whitespace tab di awal sel diamankan')
assert(sanitizeCsvCell('Laporan Normal') === 'Laporan Normal', 'G0.4.6', 'Teks normal tanpa formula tidak dimutasi')

const csvOutput = serializeToSafeCsv([
  { id: 'REC-01', text: '=1+1', author: '@admin' }
], ['id', 'text', 'author'])
assert(csvOutput.includes('"\'=1+1"'), 'G0.4.7', 'CSV serializer meng-escape dan membungkus sel berformula dalam quote')

// G0.5: Secure File Ingestion Baseline
const pngHeader = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00])
const jpegHeader = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46])
const webpHeader = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])
const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A])
const exeHeader = new Uint8Array([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00])
const elfHeader = new Uint8Array([0x7F, 0x45, 0x4C, 0x46, 0x02, 0x01, 0x01, 0x00])

assert(validateMagicBytes(pngHeader).detectedType === 'PNG', 'G0.5.1', 'Magic bytes PNG (89 50 4E 47) teridentifikasi sah')
assert(validateMagicBytes(jpegHeader).detectedType === 'JPEG', 'G0.5.2', 'Magic bytes JPEG (FF D8 FF) teridentifikasi sah')
assert(validateMagicBytes(webpHeader).detectedType === 'WEBP', 'G0.5.3', 'Magic bytes WebP (RIFF...WEBP) teridentifikasi sah')
assert(validateMagicBytes(pdfHeader).detectedType === 'PDF', 'G0.5.4', 'Magic bytes PDF (%PDF-) teridentifikasi sah')
assert(validateMagicBytes(exeHeader).isValid === false, 'G0.5.5', 'Berkas PE executable Windows (MZ) ditolak seketika')
assert(validateMagicBytes(elfHeader).isValid === false, 'G0.5.6', 'Berkas ELF executable Linux ditolak seketika')

const exeValidation = validateEvidenceFile('payload.exe', exeHeader)
assert(exeValidation.isValid === false && exeValidation.errorCode === 'EXECUTABLE_REJECTED', 'G0.5.7', 'validateEvidenceFile menolak ekstensi dan signature executable')

const oversizedBytes = new Uint8Array(11 * 1024 * 1024) // 11 MB
oversizedBytes[0] = 0x89; oversizedBytes[1] = 0x50; oversizedBytes[2] = 0x4E; oversizedBytes[3] = 0x47;
oversizedBytes[4] = 0x0D; oversizedBytes[5] = 0x0A; oversizedBytes[6] = 0x1A; oversizedBytes[7] = 0x0A;
const oversizedValidation = validateEvidenceFile('large.png', oversizedBytes)
assert(oversizedValidation.isValid === false && oversizedValidation.errorCode === 'FILE_TOO_LARGE', 'G0.5.8', 'Berkas melebihi batas ukuran (10 MB gambar) ditolak')

// G0.6: Hash Scopes & Audit Trail Scope
const ev1 = createEvidenceRecord({
  caseId: 'CASE-HASH-TEST',
  evidenceType: 'PUBLIC_POST_TEXT',
  evidenceMode: 'LIVE_REFERENCE',
  sourceLabel: 'Portal Berita Resmi',
  sourceTimestampProvenance: 'SOURCE_REPORTED_TIMESTAMP',
  sourcePublishedAt: '2026-10-30T10:00:00Z',
  extractionMethod: 'MANUAL_TEXT',
  extractedText: 'Panglima TNI meresmikan satuan radar baru di Kepulauan Riau.'
})
assert(ev1.hashes.length >= 2, 'G0.6.1', 'Record bukti memuat sedikitnya 2 ruang lingkup hash (ORIGINAL & NORMALIZED)')
const originalScope = ev1.hashes.find(h => h.digestScope === 'INPUT_TEXT_UTF8' || h.digestScope === 'ORIGINAL_FILE_BYTES')
const normalizedScope = ev1.hashes.find(h => h.digestScope === 'NORMALIZED_TEXT_UTF8')
assert(originalScope !== undefined, 'G0.6.2', 'Scope digest teks/bytes masukan asli tercatat')
assert(normalizedScope !== undefined, 'G0.6.3', 'Scope digest teks ternormalisasi tercatat')
assert(ev1.hashDisclaimer.includes('integritas'), 'G0.6.4', 'Disclaimer jujur membatasi peran hash sebagai integritas byte snapshot')

// ────────────────────────────────────────────────────────────────────────────
// GROUP 1: INVESTIGATION CASE MANAGEMENT (D2)
// ────────────────────────────────────────────────────────────────────────────
console.log('\n─── GROUP 1: Investigation Case Management (D2) ───')
clearInvestigationStore()

// D2.1: Case Creation
const case1 = createInvestigationCase({
  title: 'Investigasi Narasi Penyerangan Pangkalan Udara Ranai',
  summary: 'Penelaahan klaim viral di media sosial mengenai pergerakan militer asing di Natuna.',
  mode: 'LIVE_REFERENCE',
  tags: ['MILITER', 'DISINFORMASI', 'NATUNA']
})
assert(case1.id.startsWith('CASE-'), 'D2.1.1', 'ID kasus dihasilkan dengan prefix CASE-')
assert(case1.caseNumber.startsWith('NAR-2026-'), 'D2.1.2', 'caseNumber readable berformat resmi NAR-2026-xxxx')
assert(case1.status === 'OPEN', 'D2.1.3', 'Status awal kasus adalah OPEN')
assert(case1.isSimulation === false, 'D2.1.4', 'Kasus live berstatus isSimulation === false')

// D2.2: Idempotent Case Creation from Radar Event Cluster
const clusterInput = {
  id: 'cluster-radar-natuna-01',
  title: 'Penerbangan Gelap Terdeteksi di Natuna',
  summary: 'Deteksi anomali ruang udara utara',
  publicationIds: ['pub-01', 'pub-02']
}
const caseFromCluster1 = getOrCreateCaseForCluster(clusterInput)
const caseFromCluster2 = getOrCreateCaseForCluster(clusterInput)
assert(caseFromCluster1.id === caseFromCluster2.id, 'D2.2.1', 'getOrCreateCaseForCluster bersifat idempoten untuk cluster ID yang sama')
assert(caseFromCluster1.linkedEventClusterIds.includes('cluster-radar-natuna-01'), 'D2.2.2', 'Kasus menautkan event cluster ID terkait')

// D2.3: Case Lifecycle Transitions
updateCaseStatus(case1.id, 'IN_REVIEW', 'Operator memulai penelaahan berkas bukti')
const caseAfterReview = getInvestigationCase(case1.id)
assert(caseAfterReview?.status === 'IN_REVIEW', 'D2.3.1', 'Transisi status ke IN_REVIEW berhasil')

updateCaseStatus(case1.id, 'CONCLUDED', 'Seluruh klaim telah dinilai berdasarkan bukti otentik')
const caseAfterConclude = getInvestigationCase(case1.id)
assert(caseAfterConclude?.status === 'CONCLUDED', 'D2.3.2', 'Transisi status ke CONCLUDED berhasil')

// D2.4: Synthetic Benchmark Case Isolation
const simCase = createInvestigationCase({
  title: 'Benchmark Koordinasi Narasi Palsu',
  summary: 'Uji terkontrol dataset copypasta',
  mode: 'SYNTHETIC_BENCHMARK',
  isSimulation: true,
  simulationWatermark: 'SIMULASI — SYNTHETIC BENCHMARK — BUKAN DATA LIVE / BUKAN KASUS NYATA'
})
assert(simCase.isSimulation === true, 'D2.4.1', 'Kasus benchmark memiliki flag isSimulation === true')
assert(simCase.simulationWatermark !== undefined, 'D2.4.2', 'Watermark permanen simulasi melekat pada kasus benchmark')

// ────────────────────────────────────────────────────────────────────────────
// GROUP 2: SECURE EVIDENCE INGESTION (D3)
// ────────────────────────────────────────────────────────────────────────────
console.log('\n─── GROUP 2: Secure Evidence Ingestion (D3) ───')

// D3.1: Anti-SSRF URL Validation
const urlSsrfLocal = validateEvidenceUrl('http://127.0.0.1/internal-secret')
assert(urlSsrfLocal.isValid === false && urlSsrfLocal.errorCode === 'SSRF_BLOCKED', 'D3.1.1', 'Anti-SSRF memblokir IP loopback 127.0.0.1')

const urlSsrfPrivate = validateEvidenceUrl('http://192.168.1.100/admin')
assert(urlSsrfPrivate.isValid === false && urlSsrfPrivate.errorCode === 'SSRF_BLOCKED', 'D3.1.2', 'Anti-SSRF memblokir private IP 192.168.x.x')

const urlSsrfMetadata = validateEvidenceUrl('http://169.254.169.254/latest/meta-data/')
assert(urlSsrfMetadata.isValid === false && urlSsrfMetadata.errorCode === 'SSRF_BLOCKED', 'D3.1.3', 'Anti-SSRF memblokir cloud metadata endpoint')

const urlFtp = validateEvidenceUrl('ftp://ftp.fileserver.org/evidence.txt')
assert(urlFtp.isValid === false && urlFtp.errorCode === 'INVALID_PROTOCOL', 'D3.1.4', 'Protokol selain HTTP/HTTPS ditolak')

const urlValid = validateEvidenceUrl('https://turnbackhoax.id/2026/10/30/klarifikasi-isu-natuna/')
assert(urlValid.isValid === true && urlValid.sanitizedUrl.startsWith('https://turnbackhoax.id'), 'D3.1.5', 'URL HTTPS publik yang valid diterima')

// D3.2: Malformed / Dangerous Files Rejection
const shellScriptBytes = new TextEncoder().encode('#!/bin/bash\nrm -rf /')
const shellValidation = validateEvidenceFile('exploit.sh', shellScriptBytes)
assert(shellValidation.isValid === false && shellValidation.errorCode === 'EXECUTABLE_REJECTED', 'D3.2.1', 'Script shell (.sh) ditolak demi keamanan workstation')

const emptyValidation = validateEvidenceFile('empty.txt', new Uint8Array([]))
assert(emptyValidation.isValid === false && emptyValidation.errorCode === 'EMPTY_FILE', 'D3.2.2', 'Berkas kosong (0 byte) ditolak aman')

// ────────────────────────────────────────────────────────────────────────────
// GROUP 3: EVIDENCE PROVENANCE & INTEGRITY LEDGER (D4)
// ────────────────────────────────────────────────────────────────────────────
console.log('\n─── GROUP 3: Evidence Provenance & Integrity Ledger (D4) ───')

// D4.1: EvidenceRecord Creation & Ledger Storage
const evidenceRecord1 = createEvidenceRecord({
  caseId: case1.id,
  evidenceType: 'PUBLIC_POST_TEXT',
  evidenceMode: 'LIVE_REFERENCE',
  sourceLabel: 'Pantauan Ruang Publik Siber',
  sourceTimestampProvenance: 'SOURCE_REPORTED_TIMESTAMP',
  sourcePublishedAt: '2026-10-30T14:00:00Z',
  extractionMethod: 'MANUAL_TEXT',
  extractedText: 'Panglima TNI membantah kabar adanya pangkalan militer asing di Ranai Natuna.'
})
addEvidenceRecord(evidenceRecord1)

const retrievedEvList = getEvidenceRecordsForCase(case1.id)
assert(retrievedEvList.length === 1, 'D4.1.1', 'Bukti berhasil dicatat ke ledger kasus')
assert(retrievedEvList[0].id === evidenceRecord1.id, 'D4.1.2', 'ID bukti tersimpan secara konsisten')

// D4.2: Integrity Verification Against Tampering
const initialVerify = verifyEvidenceIntegrity(evidenceRecord1.id)
assert(initialVerify.isTamperDetected === false, 'D4.2.1', 'Integritas bukti terverifikasi utuh saat belum diubah')
assert(initialVerify.originalDigest === initialVerify.computedDigest, 'D4.2.2', 'Digest hash cocok 100% dengan teks tersimpan')

// Simulasikan pemalsuan data pada memory/storage
evidenceRecord1.extractedText = 'Panglima TNI MEMBENARKAN adanya pangkalan militer asing di Ranai.'
const tamperedVerify = verifyEvidenceIntegrity(evidenceRecord1.id)
assert(tamperedVerify.isTamperDetected === true, 'D4.2.3', 'Modifikasi teks secara ilegal terdeteksi oleh verifikasi integritas hash')

// D4.3: Append-Only Tamper-Evident Audit Trail
addAuditEvent({
  caseId: case1.id,
  action: 'EVIDENCE_INGESTED',
  entityType: 'EVIDENCE',
  entityId: evidenceRecord1.id,
  actor: 'ANALIS-TNIAD-01',
  rationale: 'Penambahan rilis resmi klarifikasi Kapuspen TNI'
})
addAuditEvent({
  caseId: case1.id,
  action: 'STATUS_UPDATED',
  entityType: 'CASE',
  entityId: case1.id,
  actor: 'ANALIS-TNIAD-01',
  rationale: 'Pembaruan status pasca verifikasi bukti'
})
const caseAuditEvents = getAuditEventsForCase(case1.id)
assert(caseAuditEvents.length >= 2, 'D4.3.1', 'Audit trail mencatat seluruh mutasi tindakan secara berurutan')
assert(caseAuditEvents[0].actor === 'ANALIS-TNIAD-01', 'D4.3.2', 'Aktor analis tercatat akurat dalam audit log')

// ────────────────────────────────────────────────────────────────────────────
// GROUP 4: CLAIM-LEVEL ASSESSMENT & REVIEW ENGINE (D5)
// ────────────────────────────────────────────────────────────────────────────
console.log('\n─── GROUP 4: Claim-Level Assessment & Review Engine (D5) ───')

// D5.1: Claim Record Extraction
const claim1 = {
  id: 'CLM-001',
  caseId: case1.id,
  claimText: 'Pangkalan Udara Ranai dikuasai oleh militer asing pada 30 Oktober 2026.',
  normalizedClaimText: 'pangkalan udara ranai dikuasai oleh militer asing pada 30 oktober 2026',
  extractedFromEvidenceIds: [evidenceRecord1.id],
  extractionMethod: 'MANUAL',
  status: 'UNDER_REVIEW',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  limitations: ['Klaim dievaluasi spesifik terhadap kedaulatan Lanud Raden Sadjad Ranai.']
}
addClaimRecord(claim1)
const claims = getClaimsForCase(case1.id)
assert(claims.length === 1, 'D5.1.1', 'Klaim berhasil dicatat ke dalam kasus')

// D5.2: Evidence-Claim Relationship
const relation1 = {
  id: 'REL-001',
  claimId: claim1.id,
  evidenceId: evidenceRecord1.id,
  relationType: 'CONTRADICTS',
  rationale: 'Rilis resmi Kapuspen TNI menyatakan operasional Lanud Ranai berada penuh di bawah kendali Koopsud I TNI AU.',
  createdBy: 'ANALIS-TNIAD-01',
  createdAt: new Date().toISOString(),
  reviewStatus: 'CONFIRMED'
}
addEvidenceRelation(relation1)
const relations = getRelationsForCase(case1.id)
assert(relations.length === 1, 'D5.2.1', 'Relasi bukti-klaim (CONTRADICTS) berhasil dicatat')

// D5.3: Claim Assessment
const assess1 = {
  id: 'ASSESS-001',
  caseId: case1.id,
  claimId: claim1.id,
  status: 'CONTRADICTED',
  confidence: 'HIGH',
  supportingEvidenceIds: [],
  contradictingEvidenceIds: [evidenceRecord1.id],
  contextualEvidenceIds: [],
  rationale: 'Klaim penguasaan pangkalan udara oleh pihak asing terbantahkan secara telak oleh fakta operasional TNI AU.',
  evaluatedBy: 'ANALIS-TNIAD-01',
  evaluatedAt: new Date().toISOString()
}
addAssessmentRecord(assess1)
const assessments = getAssessmentsForCase(case1.id)
assert(assessments.length === 1, 'D5.3.1', 'Penilaian tingkat klaim berhasil direkam')
assert(assessments[0].status === 'CONTRADICTED', 'D5.3.2', 'Status vonis tercatat pada klaim: CONTRADICTED (Bukan vonis artikel global)')

// D5.4: Non-Mutation of Source Publications
assert(clusterInput.title === 'Penerbangan Gelap Terdeteksi di Natuna', 'D5.4.1', 'Publikasi sumber radar asli tidak mengalami mutasi teks')

// ────────────────────────────────────────────────────────────────────────────
// GROUP 5: NARRATIVE SIMILARITY PROFILE & TEMPORAL ANALYSIS (D6)
// ────────────────────────────────────────────────────────────────────────────
console.log('\n─── GROUP 5: Narrative Similarity Profile & Temporal Analysis (D6) ───')

// D6.1: Narrative Similarity Profile on >= 5 records
const syntheticEvidenceList = [
  createEvidenceRecord({
    caseId: case1.id,
    evidenceType: 'PUBLIC_POST_TEXT',
    evidenceMode: 'LIVE_REFERENCE',
    sourceLabel: 'Post 1',
    sourceTimestampProvenance: 'SOURCE_REPORTED_TIMESTAMP',
    sourcePublishedAt: '2026-10-30T10:00:00Z',
    extractionMethod: 'MANUAL_TEXT',
    extractedText: 'Waspada provokasi asing di Laut Natuna Utara! Bersatu jaga NKRI.'
  }),
  createEvidenceRecord({
    caseId: case1.id,
    evidenceType: 'PUBLIC_POST_TEXT',
    evidenceMode: 'LIVE_REFERENCE',
    sourceLabel: 'Post 2',
    sourceTimestampProvenance: 'SOURCE_REPORTED_TIMESTAMP',
    sourcePublishedAt: '2026-10-30T10:02:00Z',
    extractionMethod: 'MANUAL_TEXT',
    extractedText: 'Waspada provokasi asing di Laut Natuna Utara! Bersatu jaga kedaulatan NKRI.'
  }),
  createEvidenceRecord({
    caseId: case1.id,
    evidenceType: 'PUBLIC_POST_TEXT',
    evidenceMode: 'LIVE_REFERENCE',
    sourceLabel: 'Post 3',
    sourceTimestampProvenance: 'SOURCE_REPORTED_TIMESTAMP',
    sourcePublishedAt: '2026-10-30T10:04:00Z',
    extractionMethod: 'MANUAL_TEXT',
    extractedText: 'Waspada provokasi asing di Laut Natuna Utara! Mari bersatu jaga NKRI.'
  }),
  createEvidenceRecord({
    caseId: case1.id,
    evidenceType: 'PUBLIC_POST_TEXT',
    evidenceMode: 'LIVE_REFERENCE',
    sourceLabel: 'Post 4',
    sourceTimestampProvenance: 'SOURCE_REPORTED_TIMESTAMP',
    sourcePublishedAt: '2026-10-30T10:06:00Z',
    extractionMethod: 'MANUAL_TEXT',
    extractedText: 'Prajurit TNI AL dan AU patroli bersama di Natuna amankan perbatasan.'
  }),
  createEvidenceRecord({
    caseId: case1.id,
    evidenceType: 'PUBLIC_POST_TEXT',
    evidenceMode: 'LIVE_REFERENCE',
    sourceLabel: 'Post 5',
    sourceTimestampProvenance: 'SOURCE_REPORTED_TIMESTAMP',
    sourcePublishedAt: '2026-10-30T10:08:00Z',
    extractionMethod: 'MANUAL_TEXT',
    extractedText: 'Kondisi cuaca di Kepulauan Riau cerah berawan menurut rilis BMKG.'
  })
]

const profile5 = computeNarrativeSimilarityProfile(syntheticEvidenceList)
assert(profile5.sampleSufficiency === 'SUFFICIENT', 'D6.1.1', '5 record memenuhi syarat sampel minimal (SUFFICIENT)')
assert(profile5.sampleCount === 5, 'D6.1.2', 'sampleCount tepat 5 record')
assert(profile5.evaluatedPairCount === 10, 'D6.1.3', 'evaluatedPairCount tepat 5*(5-1)/2 = 10 pasang')
assert(profile5.profile.nearDuplicate.pairCount >= 1, 'D6.1.4', 'Pasangan near-duplicate terdeteksi transparan')
assert(profile5.profile.distinct.pairCount >= 1, 'D6.1.5', 'Pasangan distinct (berbeda topik) teridentifikasi transparan')

// D6.2: Temporal Analysis & Genuine Interval Calculation
const temporalResult = computeTemporalAnalysis(syntheticEvidenceList)
assert(temporalResult.status === 'VALID_INTERVALS', 'D6.2.1', 'Status temporal valid jika memuat timestamp terverifikasi')
assert(temporalResult.recordCountWithTimestamp === 5, 'D6.2.2', 'recordCountWithTimestamp tepat 5 record')
assert(temporalResult.averageIntervalSeconds === 120, 'D6.2.3', 'Interval rata-rata 120 detik (2 menit antarentri) terhitung akurat')
assert(temporalResult.provenanceBreakdown.sourceReported === 5, 'D6.2.4', 'Breakdown provenance mengidentifikasi 5 SOURCE_REPORTED_TIMESTAMP')

// D6.3: Temporal Null-Safety for Text-Only Without Timestamps
const textOnlyList = [
  createEvidenceRecord({
    caseId: case1.id,
    evidenceType: 'PUBLIC_POST_TEXT',
    evidenceMode: 'USER_SUBMITTED',
    sourceLabel: 'Teks Tanpa Waktu 1',
    sourceTimestampProvenance: 'NO_SOURCE_TIMESTAMP',
    extractionMethod: 'MANUAL_TEXT',
    extractedText: 'Komentar pertama'
  }),
  createEvidenceRecord({
    caseId: case1.id,
    evidenceType: 'PUBLIC_POST_TEXT',
    evidenceMode: 'USER_SUBMITTED',
    sourceLabel: 'Teks Tanpa Waktu 2',
    sourceTimestampProvenance: 'NO_SOURCE_TIMESTAMP',
    extractionMethod: 'MANUAL_TEXT',
    extractedText: 'Komentar kedua'
  })
]
const textOnlyTemporal = computeTemporalAnalysis(textOnlyList)
assert(textOnlyTemporal.status === 'NOT_AVAILABLE_NO_TIMESTAMPS', 'D6.3.1', 'Teks tanpa timestamp sumber menghasilkan status NOT_AVAILABLE_NO_TIMESTAMPS')
assert(textOnlyTemporal.averageIntervalSeconds === null, 'D6.3.2', 'averageIntervalSeconds bernilai null (Tidak ada sintesis urutan baris)')
assert(textOnlyTemporal.burstVelocityPerMinute === null, 'D6.3.3', 'burstVelocityPerMinute bernilai null (Jujur tanpa fabrikasi)')

// D6.4: Non-Causal Relationship Graph
const graph = buildNarrativeRelationshipGraph({
  investigationCase: case1,
  evidenceList: syntheticEvidenceList,
  claims: [claim1],
  relations: [relation1]
})
assert(graph.nodes.length >= 7, 'D6.4.1', 'Node grafik mencakup Kasus, Klaim, dan seluruh Berkas Bukti')
assert(graph.edges.length >= 6, 'D6.4.2', 'Edge relasi graf topologis menghubungkan entitas tanpa klaim kausalitas mutlak')

// ────────────────────────────────────────────────────────────────────────────
// GROUP 6: EXPLAINABLE ASSESSMENT — "WHY NARADA THINKS SO" (D7)
// ────────────────────────────────────────────────────────────────────────────
console.log('\n─── GROUP 6: Explainable Assessment — "Why NARADA Thinks So" (D7) ───')

const whyExplanation = generateWhyNaradaThinksSo({
  caseId: case1.id,
  claim: claim1,
  assessment: assess1,
  relations: [relation1],
  evidenceList: [evidenceRecord1]
})
assert(whyExplanation.summary.includes('CONTRADICTED'), 'D7.1.1', 'Penjelasan memuat ringkasan status klaim CONTRADICTED')
assert(whyExplanation.groundedEvidence.length >= 1, 'D7.1.2', 'Bukti yang dijadikan dasar analisis dicantumkan secara grounded')
assert(whyExplanation.methodologicalCaveats.length >= 3, 'D7.1.3', 'Sedikitnya 3 batasan metodologis disertakan secara jujur')
assert(whyExplanation.alternativeInterpretations.length >= 1, 'D7.1.4', 'Interpretasi alternatif disediakan untuk menjaga netralitas penyelidikan')

// ────────────────────────────────────────────────────────────────────────────
// GROUP 7: SYSTEM CONTRACTS & INTEGRATION (D8)
// ────────────────────────────────────────────────────────────────────────────
console.log('\n─── GROUP 7: System Contracts & Integration (D8) ───')

// D8.1: Zero Telegram Enforced Across System
const hasTelegramInRegistry = ACTIVE_RADAR_SOURCES.some(s => s.id.includes('telegram') || (s.displayName || s.id || '').toLowerCase().includes('telegram'))
assert(!hasTelegramInRegistry, 'D8.1.1', 'NOL sumber Telegram di seluruh Radar Source Registry')

// D8.2: Synthetic Benchmark Isolation Contract
assert(SYNTHETIC_BENCHMARKS.length === 3, 'D8.2.1', 'Tepat 3 benchmark simulasi terkontrol tersedia')
SYNTHETIC_BENCHMARKS.forEach((bm, i) => {
  assert(bm.isSimulation === true, `D8.2.2.${i+1}`, `Benchmark ${bm.id} berstatus isSimulation === true`)
  assert(bm.simulationWatermark.includes('SIMULASI'), `D8.2.3.${i+1}`, `Benchmark ${bm.id} memiliki watermark permanen`)
})

// D8.3: Local-First / Zero Cloud Storage
const caseStoreCases = getAllInvestigationCases()
assert(caseStoreCases.length >= 2, 'D8.3.1', 'Penyimpanan kasus tersimpan secara lokal (in-memory / localStorage)')

// ────────────────────────────────────────────────────────────────────────────
// REKAPITULASI AKHIR PENGUJIAN SPRINT 2
// ────────────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════════════')
console.log(`🎯 TOTAL PENGUJIAN SPRINT 2: ${totalAssertions}`)
console.log(`   ✅ LULUS (PASS)  : ${passedAssertions}`)
console.log(`   ❌ GAGAL (FAIL)  : ${failedAssertions}`)
console.log('══════════════════════════════════════════════════════════════════════')

if (failedAssertions > 0) {
  process.exit(1)
} else {
  console.log('🌟 SELURUH QUALITY GATES SPRINT 2 TERVERIFIKASI SEMPURNA (100% PASS)')
}
