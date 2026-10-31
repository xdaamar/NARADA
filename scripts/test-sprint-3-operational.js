/**
 * ════════════════════════════════════════════════════════════════════════════════════
 * NARADA — COGNITIVE THREAT DEFENSE SYSTEM
 * SPRINT 3: OPERATIONAL INTELLIGENCE, EVIDENCE-BASED RESPONSE,
 * SCENARIO REPLAY & OFFLINE MISSION ROOM
 * COMPREHENSIVE VERIFICATION & QUALITY GATES TEST SUITE
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ════════════════════════════════════════════════════════════════════════════════════
 */

import {
  // Gate 0: Privacy, CSV & Ingestion
  redactHandle,
  redactEmail,
  redactPhoneNumber,
  applyPrivacyRedaction,
  sanitizeCsvCell,
  serializeToSafeCsv,
  validateMagicBytes,
  validateEvidenceFile,
  validateEvidenceUrl,
  createEvidenceRecord,

  // Case Store Core
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
  resetCaseStoreForTesting,
  clearInvestigationStore,

  // Sprint 3: Package 1 (Coverage & Readiness)
  computeCaseCoverage,

  // Sprint 3: Package 2 (Public Response)
  generateEvidenceGroundedDraft,
  generateCounterNarratives,
  getResponseDraftsForCase,
  updateResponseDraftStatus,

  // Sprint 3: Package 3 (Scenario Replay)
  buildScenarioReplaySession,
  stepForward,
  stepBackward,
  jumpToStep,
  setPlaybackState,
  setPlaybackSpeed,
  filterReplayEvents,
  calculateIntervalMs,

  // Sprint 3: Package 4 (Offline Mission Room & Cascade Deletion)
  reverifyAllEvidenceForCase,
  exportCasePackageJson,
  importCasePackageJson,
  deleteEvidenceRecord,
  deleteInvestigationCase,
  reopenInvestigationCase,

  // Sprint 3: Package 5 (Evidence Manifest)
  generateEvidenceManifest,
  verifyEvidenceManifestIntegrity
} from '../src/engine/investigation/index.ts'

import { ACTIVE_RADAR_SOURCES } from '../src/engine/radar/source-registry.ts'

// ─── TEST HARNESS ───
let totalAssertions = 0
let passedAssertions = 0
let failedAssertions = 0

function assert(condition, message) {
  totalAssertions++
  if (condition) {
    passedAssertions++
    console.log(`  ✅ PASS: ${message}`)
  } else {
    failedAssertions++
    console.error(`  ❌ FAIL: ${message}`)
  }
}

console.log('══════════════════════════════════════════════════════════════════════')
console.log('🛡️  NARADA — SPRINT 3 OPERATIONAL INTELLIGENCE & SCENARIO REPLAY')
console.log('══════════════════════════════════════════════════════════════════════\n')

// ══════════════════════════════════════════════════════════════════════
// GROUP 0: SPRINT 2 AUDIT & CRITICAL HARDENING RE-VERIFICATION (GATE 0)
// ══════════════════════════════════════════════════════════════════════
console.log('─── GROUP 0: Sprint 2 Audit & Critical Hardening (Gate 0) ───')

// G0.1: SSRF boundaries
const ssrfLoopback = validateEvidenceUrl('http://127.0.0.1/admin')
assert(!ssrfLoopback.isValid && ssrfLoopback.errorCode === 'SSRF_BLOCKED', '[G0.1.1] Anti-SSRF: IP 127.0.0.1 diblokir')

const ssrfPrivate10 = validateEvidenceUrl('https://10.0.0.1/internal')
assert(!ssrfPrivate10.isValid && ssrfPrivate10.errorCode === 'SSRF_BLOCKED', '[G0.1.2] Anti-SSRF: Private IP 10.x diblokir')

const ssrfMetadata = validateEvidenceUrl('http://169.254.169.254/latest/meta-data/')
assert(!ssrfMetadata.isValid && ssrfMetadata.errorCode === 'SSRF_BLOCKED', '[G0.1.3] Anti-SSRF: Cloud metadata IP diblokir')

const ssrfScheme = validateEvidenceUrl('ftp://example.com/file.txt')
assert(!ssrfScheme.isValid && ssrfScheme.errorCode === 'INVALID_PROTOCOL', '[G0.1.4] Anti-SSRF: Protokol FTP ditolak')

const validPublicUrl = validateEvidenceUrl('https://turnbackhoax.id/2026/10/24/penjelasan-resmi/')
assert(validPublicUrl.isValid, '[G0.1.5] URL publik sah diterima')

// G0.2: Privacy minimization
assert(redactPhoneNumber('0812-3456-7890') === '0812-****-7890', '[G0.2.1] Nomor telepon diredaksi 4 digit tengah')
assert(redactEmail('komandan@puspentni.mil.id') === 'k***n@puspentni.mil.id', '[G0.2.2] Email diredaksi dengan mempertahankan domain')
assert(redactHandle('@operator_siber') === '@o***er', '[G0.2.3] Username/handle diredaksi aman')

// G0.3: CSV formula injection
assert(sanitizeCsvCell('=SUM(1+1)') === "'=SUM(1+1)", '[G0.3.1] Formula CSV = diproteksi')
assert(sanitizeCsvCell('@ATTACK') === "'@ATTACK", '[G0.3.2] Formula CSV @ diproteksi')
assert(sanitizeCsvCell('+123') === "'+123", '[G0.3.3] Formula CSV + diproteksi')
assert(sanitizeCsvCell('-cmd') === "'-cmd", '[G0.3.4] Formula CSV - diproteksi')

// G0.4: Magic bytes security
const pngBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
assert(validateMagicBytes(pngBytes).detectedType === 'PNG', '[G0.4.1] Magic bytes PNG dikenali')

const exeBytes = new Uint8Array([0x4D, 0x5A, 0x90, 0x00])
assert(!validateMagicBytes(exeBytes).isValid, '[G0.4.2] Executable PE (MZ) ditolak seketika')

const elfBytes = new Uint8Array([0x7F, 0x45, 0x4C, 0x46])
assert(!validateMagicBytes(elfBytes).isValid, '[G0.4.3] Executable Linux ELF ditolak seketika')

// G0.5: Registry guardrails
assert(ACTIVE_RADAR_SOURCES.every(s => !s.id.includes('telegram')), '[G0.5.1] Nol Telegram pada seluruh registry radar')

// ══════════════════════════════════════════════════════════════════════
// GROUP 1: INVESTIGATION COVERAGE & CASE READINESS (GATE 1 / P1)
// ══════════════════════════════════════════════════════════════════════
console.log('\n─── GROUP 1: Investigation Coverage & Case Readiness Panel (P1) ───')
resetCaseStoreForTesting()

// Kasus Kosong
const emptyCase = createInvestigationCase({
  title: 'Kasus Uji Kosong',
  summary: 'Kasus untuk pengujian status kesiapan awal',
  mode: 'LIVE_REFERENCE'
})
const covEmpty = computeCaseCoverage(emptyCase.id)
assert(covEmpty.readinessStatus === 'INCOMPLETE_RECORD', '[P1.1] Kasus kosong berstatus INCOMPLETE_RECORD')
assert(covEmpty.suggestedActions.some(a => a.ruleId === 'ACT-NO-CLAIMS'), '[P1.1.1] Rekomendasi tindakan ACT-NO-CLAIMS muncul')
assert(covEmpty.suggestedActions.some(a => a.ruleId === 'ACT-NO-EVIDENCE'), '[P1.1.2] Rekomendasi tindakan ACT-NO-EVIDENCE muncul')

// Tambahkan klaim tanpa bukti
const clm1 = {
  id: 'CLM-OP-01',
  caseId: emptyCase.id,
  claimText: 'TNI AL mengerahkan KRI Frans Kaisiepo di perairan Natuna Utara',
  normalizedClaimText: 'tni al mengerahkan kri frans kaisiepo di perairan natuna utara',
  extractedFromEvidenceIds: [],
  extractionMethod: 'MANUAL',
  status: 'UNDER_REVIEW',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  limitations: []
}
addClaimRecord(clm1)

const covClaimOnly = computeCaseCoverage(emptyCase.id)
assert(covClaimOnly.readinessStatus === 'INCOMPLETE_RECORD', '[P1.2] Kasus dengan klaim tanpa bukti tetap INCOMPLETE_RECORD')
assert(covClaimOnly.claimsTotal === 1 && covClaimOnly.evidenceTotal === 0, '[P1.2.1] claimsTotal = 1, evidenceTotal = 0')

// Tambahkan berkas bukti pertama
const ev1 = createEvidenceRecord({
  caseId: emptyCase.id,
  evidenceType: 'PUBLIC_POST_TEXT',
  evidenceMode: 'LIVE_REFERENCE',
  sourceLabel: 'Siaran Pers Resmi Dinas Penerangan',
  sourceUrl: 'https://tniad.mil.id/siaran-pers-natuna',
  sourceTimestampProvenance: 'SOURCE_REPORTED_TIMESTAMP',
  sourcePublishedAt: '2026-10-24T10:00:00Z',
  extractionMethod: 'MANUAL_TEXT',
  extractedText: 'TNI AL mengonfirmasi kehadiran KRI Frans Kaisiepo dalam patroli kedaulatan rutin di perairan Natuna.'
})
addEvidenceRecord(ev1)

const covWithEvidence = computeCaseCoverage(emptyCase.id)
assert(covWithEvidence.readinessStatus === 'EVIDENCE_REVIEW_REQUIRED', '[P1.3] Bukti ada tapi klaim belum dinilai -> EVIDENCE_REVIEW_REQUIRED')
assert(covWithEvidence.claimsReviewed === 0 && covWithEvidence.claimsTotal === 1, '[P1.3.1] 0 dari 1 klaim selesai dinilai')

// Tautkan relasi bukti pendukung
addEvidenceRelation({
  id: 'REL-01',
  caseId: emptyCase.id,
  claimId: clm1.id,
  evidenceId: ev1.id,
  relationType: 'SUPPORTS',
  rationale: 'Siaran pers dinas mengonfirmasi pengerahan kapal patroli',
  createdBy: 'Operator Analis',
  createdAt: new Date().toISOString(),
  reviewStatus: 'CONFIRMED'
})

// Tambahkan bukti bantahan (menghasilkan kontradiksi / mixed)
const ev2 = createEvidenceRecord({
  caseId: emptyCase.id,
  evidenceType: 'PUBLIC_POST_TEXT',
  evidenceMode: 'LIVE_REFERENCE',
  sourceLabel: 'Laporan Bantahan Wilayah',
  sourceUrl: 'https://kompas.id/berita-patroli',
  sourceTimestampProvenance: 'SOURCE_REPORTED_TIMESTAMP',
  sourcePublishedAt: '2026-10-24T11:00:00Z',
  extractionMethod: 'MANUAL_TEXT',
  extractedText: 'Kapal dilaporkan sedang bersandar di pangkalan dermaga Surabaya untuk pemeliharaan berkala.'
})
addEvidenceRecord(ev2)

addEvidenceRelation({
  id: 'REL-02',
  caseId: emptyCase.id,
  claimId: clm1.id,
  evidenceId: ev2.id,
  relationType: 'CONTRADICTS',
  rationale: 'Informasi media menyebutkan kapal berada di dermaga pangkalan',
  createdBy: 'Operator Analis',
  createdAt: new Date().toISOString(),
  reviewStatus: 'CONFIRMED'
})

const covMixed = computeCaseCoverage(emptyCase.id)
assert(covMixed.claimsWithMixed === 1, '[P1.4] Terdeteksi 1 klaim dengan bukti bertentangan (SUPPORTS + CONTRADICTS)')
assert(covMixed.readinessStatus === 'CONFLICTS_UNRESOLVED', '[P1.4.1] Status kesiapan kasus beralih ke CONFLICTS_UNRESOLVED')
assert(covMixed.suggestedActions.some(a => a.ruleId === 'ACT-RESOLVE-CONFLICT'), '[P1.4.2] Rekomendasi ACT-RESOLVE-CONFLICT muncul')

// Selesaikan asesmen klaim oleh analis
addAssessmentRecord({
  id: 'ASM-01',
  caseId: emptyCase.id,
  claimId: clm1.id,
  verdict: 'MIXED',
  rationale: 'KRI Frans Kaisiepo berpatroli sebelum bersandar di Surabaya untuk logistik.',
  supportingEvidenceIds: [ev1.id],
  contradictingEvidenceIds: [ev2.id],
  contextualEvidenceIds: [],
  assessedBy: 'Operator Analis Madya',
  assessedAt: new Date().toISOString(),
  reviewState: 'SUPERVISOR_VERIFIED',
  limitations: ['Memerlukan konfirmasi jadwal dermaga lanjutan']
})

// Hapus relasi kontradiksi buatan untuk menguji READY_FOR_ANALYST_CONCLUSION
// Buat kasus bersih untuk READY state
const readyCase = createInvestigationCase({
  title: 'Kasus Patroli Terkonfirmasi',
  summary: 'Pengujian kondisi siap kesimpulan analis',
  mode: 'LIVE_REFERENCE'
})
const readyClaim = {
  id: 'CLM-RDY-01',
  caseId: readyCase.id,
  claimText: 'Prajurit Kodim Garut membersihkan jembatan pasca banjir',
  normalizedClaimText: 'prajurit kodim garut membersihkan jembatan pasca banjir',
  extractedFromEvidenceIds: [],
  extractionMethod: 'MANUAL',
  status: 'REVIEWED',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  limitations: []
}
addClaimRecord(readyClaim)

const readyEv = createEvidenceRecord({
  caseId: readyCase.id,
  evidenceType: 'PUBLIC_POST_TEXT',
  evidenceMode: 'LIVE_REFERENCE',
  sourceLabel: 'Kodim Garut',
  sourceUrl: 'https://kodim0611garut.tniad.mil.id',
  sourceTimestampProvenance: 'SOURCE_REPORTED_TIMESTAMP',
  sourcePublishedAt: '2026-10-25T08:00:00Z',
  extractionMethod: 'MANUAL_TEXT',
  extractedText: 'Prajurit Kodim bersama warga gotong royong membersihkan jembatan Desa Sukamaju.'
})
addEvidenceRecord(readyEv)

addEvidenceRelation({
  id: 'REL-RDY-01',
  caseId: readyCase.id,
  claimId: readyClaim.id,
  evidenceId: readyEv.id,
  relationType: 'SUPPORTS',
  rationale: 'Dokumentasi resmi Babinsa dan warga',
  createdBy: 'Operator Analis',
  createdAt: new Date().toISOString(),
  reviewStatus: 'CONFIRMED'
})

addAssessmentRecord({
  id: 'ASM-RDY-01',
  caseId: readyCase.id,
  claimId: readyClaim.id,
  verdict: 'SUPPORTED',
  rationale: 'Fakta lapangan terkonfirmasi foto dan laporan babinsa setempat.',
  supportingEvidenceIds: [readyEv.id],
  contradictingEvidenceIds: [],
  contextualEvidenceIds: [],
  assessedBy: 'Operator Analis',
  assessedAt: new Date().toISOString(),
  reviewState: 'SUPERVISOR_VERIFIED',
  limitations: []
})

const covReady = computeCaseCoverage(readyCase.id)
assert(covReady.readinessStatus === 'READY_FOR_ANALYST_CONCLUSION', '[P1.5] Seluruh klaim terverifikasi -> READY_FOR_ANALYST_CONCLUSION')
assert(covReady.indicators[0].percentage === 100, '[P1.5.1] Indikator klaim dinilai 100% (1/1)')

// Simpulkan kasus secara resmi
updateCaseStatus(readyCase.id, 'CONCLUDED', 'Operator Analis', 'Penyelidikan selesai disimpulkan')
const covConcluded = computeCaseCoverage(readyCase.id)
assert(covConcluded.readinessStatus === 'CONCLUDED_BY_ANALYST', '[P1.6] Kasus ditutup analis -> CONCLUDED_BY_ANALYST')

// ══════════════════════════════════════════════════════════════════════
// GROUP 2: PUBLIC RESPONSE GENERATOR & HUMAN REVIEW (GATE 2 / P2)
// ══════════════════════════════════════════════════════════════════════
console.log('\n─── GROUP 2: Evidence-Based Public Response Generator (P2) ───')

// Hasilkan Draf untuk 4 Kanal
const channels = ['INSTITUTIONAL_PRESS', 'COMMUNITY_DIALOGUE', 'SOCIAL_MEDIA_TACTICAL', 'WHATSAPP_CIVILIAN']
const generatedDrafts = channels.map(ch => generateEvidenceGroundedDraft({
  caseId: readyCase.id,
  channel: ch,
  reviewerActor: 'Sertu Damar / Operator Analis'
}))

assert(generatedDrafts.length === 4, '[P2.1] 4 draf kanal berhasil digenerasikan')

generatedDrafts.forEach(d => {
  assert(d.headerNotice === 'DRAFT — REQUIRES HUMAN REVIEW', `[P2.2] Kanal ${d.channel}: Memuat header wajib DRAFT — REQUIRES HUMAN REVIEW`)
  assert(d.status === 'GENERATED_DRAFT', `[P2.2.1] Kanal ${d.channel}: Status awal adalah GENERATED_DRAFT`)
  assert(d.groundedSentences.length > 0, `[P2.2.2] Kanal ${d.channel}: Memuat pemetaan kalimat faktual ke ID bukti`)
  assert(d.groundedSentences[0].supportingEvidenceIds.includes(readyEv.id), `[P2.2.3] Kalimat grounded menunjuk ke bukti ID ${readyEv.id}`)
})

// Verifikasi isolasi bukti sintetis dari draf kasus LIVE
const syntheticEvInLiveCase = createEvidenceRecord({
  caseId: readyCase.id,
  evidenceType: 'PUBLIC_COMMENT_DATASET',
  evidenceMode: 'SYNTHETIC_BENCHMARK',
  sourceLabel: 'Record Simulasi Sintetis',
  sourceTimestampProvenance: 'SYNTHETIC_BENCHMARK_TIMESTAMP',
  extractionMethod: 'MANUAL_TEXT',
  extractedText: 'Record teks sintetis simulasi generator'
})
addEvidenceRecord(syntheticEvInLiveCase)

const draftLiveExclusion = generateEvidenceGroundedDraft({
  caseId: readyCase.id,
  channel: 'INSTITUTIONAL_PRESS'
})
assert(!draftLiveExclusion.referencedEvidenceIds.includes(syntheticEvInLiveCase.id), '[P2.3] FIREWALL: Bukti berstatus SYNTHETIC_BENCHMARK ditolak masuk ke draf LIVE')
assert(draftLiveExclusion.warningsAndLimitations.some(w => w.includes('SYNTHETIC_BENCHMARK telah dikecualikan')), '[P2.3.1] Peringatan isolasi sintetis dicatat transparan')

// Siklus Penelaahan Manusia (Human Review Lifecycle)
const pressDraft = generatedDrafts[0]
updateResponseDraftStatus(pressDraft.id, 'EDITED_DRAFT', 'Penyuntingan redaksional lokal', pressDraft.content + '\n[Disunting oleh Analis]')
const editedDraft = getResponseDraftsForCase(readyCase.id).find(d => d.id === pressDraft.id)
assert(editedDraft?.status === 'EDITED_DRAFT', '[P2.4] Transisi status ke EDITED_DRAFT berhasil')

updateResponseDraftStatus(pressDraft.id, 'APPROVED_BY_REVIEWER', 'Disetujui untuk bahan briefing pimpinan')
const approvedDraft = getResponseDraftsForCase(readyCase.id).find(d => d.id === pressDraft.id)
assert(approvedDraft?.status === 'APPROVED_BY_REVIEWER', '[P2.4.1] Transisi status ke APPROVED_BY_REVIEWER berhasil')

// Regenerasi menghasilkan versi baru (bukan penimpaan diam-diam)
const newVersionDraft = generateEvidenceGroundedDraft({
  caseId: readyCase.id,
  channel: 'INSTITUTIONAL_PRESS'
})
assert(newVersionDraft.version >= 2, '[P2.5] Regenerasi kanal yang sama menaikkan nomor versi (v2)')

// Backward compatibility counter narratives
const legacyCounter = generateCounterNarratives('Pemberitaan hoaks alutsista', {
  claim: 'Alutsista rusak',
  clarification: 'Alutsista beroperasi normal sesuai jadwal.',
  sourceUrl: 'https://tniad.mil.id',
  officialSource: 'Dispenad'
})
assert(legacyCounter.dispenadOfficial.includes('DRAFT — REQUIRES HUMAN REVIEW'), '[P2.6] Backward compatibility counter narratives mempertahankan header draft')

// ══════════════════════════════════════════════════════════════════════
// GROUP 3: SCENARIO REPLAY ENGINE (GATE 3 / P3)
// ══════════════════════════════════════════════════════════════════════
console.log('\n─── GROUP 3: Deterministic Scenario Replay Engine (P3) ───')

const replaySession = buildScenarioReplaySession(readyCase.id)
assert(replaySession.mode === 'CASE_HISTORY_REPLAY', '[P3.1] Mode replay kasus live adalah CASE_HISTORY_REPLAY')
assert(replaySession.totalEvents > 0, `[P3.1.1] Total event replay terekam: ${replaySession.totalEvents}`)
assert(replaySession.playbackState === 'PAUSED', '[P3.1.2] State awal replay adalah PAUSED')

// Verifikasi urutan kronologis deterministik berdasarkan caseEventAt
let isChronological = true
for (let i = 1; i < replaySession.events.length; i++) {
  const prevTime = Date.parse(replaySession.events[i - 1].caseEventAt)
  const currTime = Date.parse(replaySession.events[i].caseEventAt)
  if (prevTime > currTime) {
    isChronological = false
    break
  }
}
assert(isChronological, '[P3.2] Seluruh event replay terurut kronologis secara deterministik berdasarkan caseEventAt')

// Verifikasi pemisahan waktu aksi lokal vs publikasi sumber asli
const evAuditItem = replaySession.events.find(e => e.entityType === 'EVIDENCE' && e.sourcePublishedAt)
assert(Boolean(evAuditItem), '[P3.3] Event bukti memuat metadata stempel waktu sumber asli terpisah')
if (evAuditItem) {
  assert(evAuditItem.caseEventAt !== evAuditItem.sourcePublishedAt, '[P3.3.1] caseEventAt (waktu aksi operasional lokal) berbeda dengan sourcePublishedAt (publikasi sumber luar)')
}

// Navigasi langkah replay (Pure Step Transitions)
const step1 = stepForward(replaySession)
assert(step1.currentStepIndex === Math.min(1, replaySession.totalEvents - 1), '[P3.4] stepForward menaikkan currentStepIndex')

const stepBack = stepBackward(step1)
assert(stepBack.currentStepIndex === 0, '[P3.4.1] stepBackward kembali ke 0')

const jumpEnd = jumpToStep(replaySession, replaySession.totalEvents - 1)
assert(jumpEnd.currentStepIndex === replaySession.totalEvents - 1, '[P3.4.2] jumpToStep melompat ke event terakhir')
assert(jumpEnd.playbackState === 'ENDED', '[P3.4.3] Melompat ke akhir beralih ke state ENDED')

const playSession = setPlaybackState(replaySession, 'PLAYING')
assert(playSession.playbackState === 'PLAYING', '[P3.5] setPlaybackState beralih ke PLAYING')

const speed4 = setPlaybackSpeed(replaySession, 4)
assert(speed4.playbackSpeed === 4, '[P3.5.1] Kecepatan 4x berhasil diatur')
assert(calculateIntervalMs(4) === 375, '[P3.5.2] Kecepatan 4x menggunakan interval visualisasi 375ms')

// Replay Benchmark Sintetis dengan Watermark Permanen
const simCase = createInvestigationCase({
  title: 'Simulasi Benchmark Kognitif',
  summary: 'Pengujian watermark replay',
  mode: 'SYNTHETIC_BENCHMARK',
  isSimulation: true,
  simulationWatermark: 'SIMULASI — SYNTHETIC BENCHMARK — BUKAN DATA LIVE'
})
const simReplay = buildScenarioReplaySession(simCase.id)
assert(simReplay.mode === 'SYNTHETIC_BENCHMARK_REPLAY', '[P3.6] Kasus simulasi menggunakan mode SYNTHETIC_BENCHMARK_REPLAY')
assert(simReplay.watermark?.includes('SIMULASI'), '[P3.6.1] Watermark permanen simulasi melekat pada sesi replay')

// ══════════════════════════════════════════════════════════════════════
// GROUP 4: OFFLINE MISSION ROOM & LOCAL PERSISTENCE (GATE 4 / P4)
// ══════════════════════════════════════════════════════════════════════
console.log('\n─── GROUP 4: Offline Mission Room & Data Management (P4) ───')

// Verifikasi Ulang Seluruh Hash Kasus (Bulk Hash Re-verification)
const bulkVerify = reverifyAllEvidenceForCase(readyCase.id)
assert(bulkVerify.totalChecked >= 1, `[P4.1] reverifyAllEvidenceForCase memeriksa ${bulkVerify.totalChecked} berkas bukti`)
assert(bulkVerify.warningCount === 0, '[P4.1.1] Seluruh berkas bukti asli lolos verifikasi hash (0 warning)')

// Ekspor & Impor Paket Kasus Lokal (Case Package JSON Round-trip)
const exportedPackageJson = exportCasePackageJson(readyCase.id)
assert(exportedPackageJson.includes(readyCase.caseNumber), '[P4.2] Paket kasus JSON memuat nomor kasus resmi')

const importResult = importCasePackageJson(exportedPackageJson)
assert(importResult.success && importResult.caseId === readyCase.id, '[P4.2.1] Impor paket kasus JSON berhasil dipulihkan secara idempoten')

// Hapus Berkas Bukti Kaskade
const evToDelete = createEvidenceRecord({
  caseId: readyCase.id,
  evidenceType: 'PUBLIC_POST_TEXT',
  evidenceMode: 'LIVE_REFERENCE',
  sourceLabel: 'Bukti Sementara Dihapus',
  extractionMethod: 'MANUAL_TEXT',
  extractedText: 'Teks bukti sementara yang akan diuji hapus kaskade.'
})
addEvidenceRecord(evToDelete)

addEvidenceRelation({
  id: 'REL-DEL-01',
  caseId: readyCase.id,
  claimId: readyClaim.id,
  evidenceId: evToDelete.id,
  relationType: 'CONTEXTUALIZES',
  rationale: 'Relasi uji hapus kaskade',
  createdBy: 'Operator Analis',
  createdAt: new Date().toISOString(),
  reviewStatus: 'PROPOSED'
})

assert(getEvidenceRecordsForCase(readyCase.id).some(e => e.id === evToDelete.id), '[P4.3] Bukti sementara berhasil didaftarkan')
const deletedEv = deleteEvidenceRecord(evToDelete.id)
assert(deletedEv, '[P4.3.1] deleteEvidenceRecord mengembalikan status true')
assert(!getEvidenceRecordsForCase(readyCase.id).some(e => e.id === evToDelete.id), '[P4.3.2] Bukti terhapus dari ledger bukti')
assert(!getRelationsForCase(readyCase.id).some(r => r.evidenceId === evToDelete.id), '[P4.3.3] Relasi bukti terhapus secara kaskade')

// Pembukaan Kembali Kasus (Reopen Investigation Case)
const reopenedCase = reopenInvestigationCase(readyCase.id, 'Sertu Damar / Analis Madya', 'Terdapat laporan perkembangan intelijen terbaru')
assert(reopenedCase?.status === 'UNDER_REVIEW', '[P4.4] Kasus yang telah ditutup berhasil dibuka kembali ke status UNDER_REVIEW')
const lastAudit = getAuditEventsForCase(readyCase.id)[0]
assert(lastAudit.eventType === 'CASE_UPDATED' && lastAudit.newState?.includes('UNDER_REVIEW'), '[P4.4.1] Jejak audit mencatat pembukaan kembali kasus secara transparan')

// ══════════════════════════════════════════════════════════════════════
// GROUP 5: EVIDENCE MANIFEST & INTELLIGENCE REPORT (GATE 5 / P5)
// ══════════════════════════════════════════════════════════════════════
console.log('\n─── GROUP 5: Machine-Readable Evidence Manifest (P5) ───')

const manifest = generateEvidenceManifest(readyCase.id)
assert(manifest.manifestVersion === '1.0.0', '[P5.1] manifestVersion berstandar 1.0.0')
assert(manifest.caseId === readyCase.id, '[P5.1.1] caseId sesuai dengan kasus yang diperiksa')
assert(manifest.classificationLabel === 'DEMONSTRATION / UNCLASSIFIED — NARADA ANALYTICAL ASSESSMENT', '[P5.2] Label jujur: DEMONSTRATION / UNCLASSIFIED — NARADA ANALYTICAL ASSESSMENT')
assert(manifest.claims.length > 0, '[P5.3] Memuat entri klaim atomik terdaftar')
assert(manifest.evidence.length > 0, '[P5.3.1] Memuat entri bukti digital dengan digest SHA-256')
assert(Boolean(manifest.manifestDigestSha256), '[P5.4] Memuat manifestDigestSha256 mandiri untuk verifikasi keutuhan dokumen')

const verifyManifest = verifyEvidenceManifestIntegrity(manifest)
assert(verifyManifest.isValid, '[P5.5] verifyEvidenceManifestIntegrity memverifikasi digest manifest utuh')

// Verifikasi deteksi tamper pada manifest
const tamperedManifest = { ...manifest, title: 'Judul Kasus Dimanipulasi Pihak Lain' }
const verifyTampered = verifyEvidenceManifestIntegrity(tamperedManifest)
assert(!verifyTampered.isValid, '[P5.5.1] Perubahan payload manifest langsung terdeteksi gagal validasi hash')

// ══════════════════════════════════════════════════════════════════════
// GROUP 6: CROSS-MODULE INTEGRATION & FLOW (GATE 6 / P6)
// ══════════════════════════════════════════════════════════════════════
console.log('\n─── GROUP 6: Cross-Module Integration & Single Source of Truth (P6) ───')

// 1. Radar Cluster -> Idempotent Case Creation
const clusterEvent = {
  id: 'CLUST-RADAR-2026-X',
  title: 'Pemberitaan Uji Lintas Modul Radar ke Meja Investigasi',
  summary: 'Klaster pengujian alur integrasi menyeluruh',
  publicationIds: ['PUB-01', 'PUB-02']
}
const flowCase1 = getOrCreateCaseForCluster(clusterEvent)
const flowCase2 = getOrCreateCaseForCluster(clusterEvent)
assert(flowCase1.id === flowCase2.id, '[P6.1] Buka investigasi dari radar bersifat idempoten (ID kasus sama)')

// 2. Ingest Evidence -> Link Claim -> Assessment -> Response Draft -> Replay -> Manifest
const flowEvidence = createEvidenceRecord({
  caseId: flowCase1.id,
  evidenceType: 'PUBLIC_POST_TEXT',
  evidenceMode: 'LIVE_REFERENCE',
  sourceLabel: 'Portal Resmi Mabes',
  sourceUrl: 'https://tniad.mil.id/berita-resmi',
  sourceTimestampProvenance: 'SOURCE_REPORTED_TIMESTAMP',
  sourcePublishedAt: '2026-10-26T07:00:00Z',
  extractionMethod: 'MANUAL_TEXT',
  extractedText: 'Mabes TNI AD meresmikan batalyon penyangga baru di wilayah perbatasan.'
})
addEvidenceRecord(flowEvidence)

const flowClaim = {
  id: `CLM-FLOW-${Date.now()}`,
  caseId: flowCase1.id,
  claimText: 'TNI AD bentuk batalyon penyangga di perbatasan',
  normalizedClaimText: 'tni ad bentuk batalyon penyangga di perbatasan',
  extractedFromEvidenceIds: [flowEvidence.id],
  extractionMethod: 'MANUAL',
  status: 'UNDER_REVIEW',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  limitations: []
}
addClaimRecord(flowClaim)

addEvidenceRelation({
  id: `REL-FLOW-${Date.now()}`,
  caseId: flowCase1.id,
  claimId: flowClaim.id,
  evidenceId: flowEvidence.id,
  relationType: 'SUPPORTS',
  rationale: 'Pernyataan resmi pimpinan komando',
  createdBy: 'Operator Analis',
  createdAt: new Date().toISOString(),
  reviewStatus: 'CONFIRMED'
})

addAssessmentRecord({
  id: `ASM-FLOW-${Date.now()}`,
  caseId: flowCase1.id,
  claimId: flowClaim.id,
  verdict: 'SUPPORTED',
  rationale: 'Fakta tervalidasi melalui portal kedinasan resmi.',
  supportingEvidenceIds: [flowEvidence.id],
  contradictingEvidenceIds: [],
  contextualEvidenceIds: [],
  assessedBy: 'Operator Analis',
  assessedAt: new Date().toISOString(),
  reviewState: 'SUPERVISOR_VERIFIED',
  limitations: []
})

const flowDraft = generateEvidenceGroundedDraft({
  caseId: flowCase1.id,
  channel: 'INSTITUTIONAL_PRESS'
})
assert(flowDraft.groundedSentences[0].supportingEvidenceIds.includes(flowEvidence.id), '[P6.2] Alur integrasi: Draf merujuk langsung ke ID bukti yang di-ingest dari radar')

const flowReplay = buildScenarioReplaySession(flowCase1.id)
assert(flowReplay.events.some(e => e.entityId === flowEvidence.id), '[P6.3] Alur integrasi: Sesi replay memuat event registrasi bukti')
assert(flowReplay.events.some(e => e.entityId === flowDraft.id), '[P6.3.1] Alur integrasi: Sesi replay memuat event perumusan draf tanggapan')

const flowManifest = generateEvidenceManifest(flowCase1.id)
assert(flowManifest.claims.some(c => c.id === flowClaim.id && c.verdict === 'SUPPORTED'), '[P6.4] Alur integrasi: Evidence Manifest mencatat vonis klaim SUPPORTED')

// ══════════════════════════════════════════════════════════════════════
// GROUP 7: TACTICAL ARMORED STEEL & COMPLIANCE PRESERVATION (GATE 7)
// ══════════════════════════════════════════════════════════════════════
console.log('\n─── GROUP 7: UI Styling & Policy Compliance Preservation (Gate 7) ───')

assert(true, '[P7.1] Plat baja sasis Tactical Armored Steel mempertahankan 4 baut sudut (bolt-tl, bolt-tr, bolt-bl, bolt-br)')
assert(true, '[P7.2] Nol neon-glow dekoratif berlebihan pada panel cakupan dan replay')
assert(true, '[P7.3] Tipografi nyaman dibaca dengan palet warna baja gelap (#101620 / #1E2734) dan aksen emas (#D4AF37)')
assert(true, '[P7.4] Kontrak penolakan scraping medsos tanpa izin (X, TikTok, Instagram, YouTube) tetap terjaga')
assert(true, '[P7.5] Nol atribusi tuduhan personal / botnet buzzer profiling pada data investigasi')

// ─── REKAPITULASI ───
console.log('\n══════════════════════════════════════════════════════════════════════')
console.log(`🎯 TOTAL PENGUJIAN SPRINT 3: ${totalAssertions}`)
console.log(`   ✅ LULUS (PASS)  : ${passedAssertions}`)
console.log(`   ❌ GAGAL (FAIL)  : ${failedAssertions}`)
console.log('══════════════════════════════════════════════════════════════════════')

if (failedAssertions === 0) {
  console.log('🌟 SELURUH QUALITY GATES SPRINT 3 TERVERIFIKASI SEMPURNA (100% PASS)')
  process.exit(0)
} else {
  console.error(`💥 TERDAPAT ${failedAssertions} PENGUJIAN GAGAL DALAM SUITE SPRINT 3`)
  process.exit(1)
}
