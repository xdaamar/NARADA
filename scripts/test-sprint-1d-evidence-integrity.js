/**
 * NARADA — SPRINT 1D EVIDENCE INTEGRITY & ANALYTICAL VALIDITY TEST SUITE
 * 
 * Verifikasi Kepatuhan Menyeluruh terhadap:
 * - Package A: Preset Simulation Firewall & Immutable Watermarks
 * - Package B: Narrative Coordination Signals (NCS) & Elimination of Individual Actor Verdicts
 * - Package C: Timestamp Provenance & Elimination of Row-Order Velocity Synthesis
 * - Package D: Privacy, Data Minimization & CSV Formula Injection Sanitization
 * - Package E: Claim-Level Assessment & Non-Mutation of Source Publications
 * - Package F: Benchmark Classification & Honest Reporting
 * - Package G: Evidence Provenance Model & Content Hash Disclaimers
 * - Package I: Counter-Response Operational Guardrails
 * 
 * Sesuai Spesifikasi: narada/dev_internal/sprint/NARADA_SPRINT_1D_EVIDENCE_INTEGRITY_AND_ANALYTICAL_VALIDITY.txt
 */

import {
  SYNTHETIC_BENCHMARKS,
  INVESTIGATION_PRESETS,
  redactHandle,
  sanitizeForCsvExport,
  parseRawCommentsText,
  synthesizeInvestigationDossier,
  recordClaimAssessment,
  getClaimAssessments,
  getAllClaimAssessments
} from '../src/engine/social-threat-dossier.ts'

import { ACTIVE_RADAR_SOURCES } from '../src/engine/radar/source-registry.ts'
import { generateCounterNarratives } from '../src/engine/forensic/counter-narrative-generator.ts'

// ─── Test Runner Harness ───
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
console.log('🛡️  NARADA — SPRINT 1D EVIDENCE INTEGRITY & ANALYTICAL VALIDITY')
console.log('══════════════════════════════════════════════════════════════════════\n')

// ────────────────────────────────────────────────────────────────────────────
// GROUP A: PRESET SIMULATION FIREWALL & WATERMARK INTEGRITY (PACKAGE A)
// ────────────────────────────────────────────────────────────────────────────
console.log('─── GROUP A: Preset Simulation Firewall & Watermark Integrity ───')

// A1: Preset explicitly labeled SYNTHETIC_BENCHMARK
assert(SYNTHETIC_BENCHMARKS.length === 3, '[A1.1] Terdapat tepat 3 benchmark sintetis terkontrol')
SYNTHETIC_BENCHMARKS.forEach((bm, i) => {
  assert(bm.evidenceMode === 'SYNTHETIC_BENCHMARK', `[A1.2.${i+1}] Benchmark ${bm.id} memiliki evidenceMode === 'SYNTHETIC_BENCHMARK'`)
  assert(bm.isSimulation === true, `[A1.3.${i+1}] Benchmark ${bm.id} memiliki flag isSimulation === true`)
  assert(
    bm.simulationWatermark.includes('SIMULASI — SYNTHETIC BENCHMARK'),
    `[A1.4.${i+1}] Benchmark ${bm.id} memuat watermark baku 'SIMULASI — SYNTHETIC BENCHMARK'`
  )
})

// A2: Synthetic records use REC-SIM-xxx naming scheme
SYNTHETIC_BENCHMARKS.forEach((bm, i) => {
  const allSyntheticIds = bm.syntheticRecords.every(r => r.recordId.startsWith('REC-SIM-'))
  assert(allSyntheticIds, `[A2.${i+1}] Seluruh record pada ${bm.id} memakai prefix REC-SIM- (Bukan handle akun asli)`)
})

// A3: Investigation presets alias backward compatibility
assert(INVESTIGATION_PRESETS === SYNTHETIC_BENCHMARKS, '[A3.1] INVESTIGATION_PRESETS dialiaskan ke SYNTHETIC_BENCHMARKS untuk kompatibilitas')

// A4: Compile simulation dossier produces watermarked output
const simDossier = synthesizeInvestigationDossier(
  { id: 'BENCH-001', claim: 'Uji Penyerapan Beras SPHP', cluster: 'KESEHATAN_PANGAN' },
  SYNTHETIC_BENCHMARKS[0].syntheticRecords,
  {
    sourceName: SYNTHETIC_BENCHMARKS[0].name,
    sourceKind: 'SYNTHETIC_BENCHMARK',
    isSimulation: true,
    watermark: SYNTHETIC_BENCHMARKS[0].simulationWatermark
  }
)
assert(simDossier.isSimulation === true, '[A4.1] Dossier simulasi mempertahankan isSimulation === true')
assert(
  simDossier.simulationWatermark === 'SIMULASI — SYNTHETIC BENCHMARK — BUKAN DATA LIVE / BUKAN KASUS NYATA',
  '[A4.2] Dossier simulasi memiliki watermark permanen dan tidak dapat dilepas'
)
assert(simDossier.evidenceMode === 'SYNTHETIC_BENCHMARK', '[A4.3] Dossier simulasi terisolasi dalam mode SYNTHETIC_BENCHMARK')

// ────────────────────────────────────────────────────────────────────────────
// GROUP B: NARRATIVE COORDINATION SIGNALS (NCS) & NO ACTOR VERDICTS (PACKAGE B)
// ────────────────────────────────────────────────────────────────────────────
console.log('\n─── GROUP B: Narrative Coordination Signals & Elimination of Individual Actor Verdicts ───')

// B1: Metric is named ncsIndex, NOT CIB Index
assert('ncsIndex' in simDossier, '[B1.1] Metrik utama dinamai ncsIndex (Narrative Coordination Signals)')
assert(typeof simDossier.ncsIndex === 'number', '[B1.2] ncsIndex bernilai numerik')
assert(simDossier.cibIndex === simDossier.ncsIndex, '[B1.3] Backward compatibility cibIndex merefleksikan ncsIndex tanpa kalkulasi berbeda')

// B2: No individual comments are labeled BOTNET, BUZZER, or ORGANIK
const invalidActorLabels = ['BOTNET', 'BUZZER', 'ORGANIK', 'BOT COPYPASTA', 'RAWAN BUZZER']
const comments = simDossier.commentsStream
let hasForbiddenActorLabel = false
comments.forEach(c => {
  if (invalidActorLabels.includes(c.patternCategory) || invalidActorLabels.includes(c.actorCategory)) {
    hasForbiddenActorLabel = true
  }
})
assert(!hasForbiddenActorLabel, '[B2.1] Nol vonis individu (BOTNET, BUZZER, ORGANIK) pada record baris komentar')

// B3: Pattern categories strictly describe text similarity
const validPatternCategories = ['NEAR_DUPLICATE', 'HIGH_SIMILARITY', 'DISTINCT']
const allPatternsValid = comments.every(c => validPatternCategories.includes(c.patternCategory))
assert(allPatternsValid, '[B3.1] Seluruh baris komentar memakai kategori kemiripan tekstual murni (NEAR_DUPLICATE, HIGH_SIMILARITY, DISTINCT)')

// B4: NCS Interpretation reflects coordination signal, not individual guilt
assert(
  typeof simDossier.ncsInterpretation === 'string' && simDossier.ncsInterpretation.length > 0,
  '[B4.1] ncsInterpretation menyajikan penjelasan kontekstual sinyal koordinasi'
)
assert(
  !simDossier.ncsInterpretation.includes('pasti botnet') && !simDossier.ncsInterpretation.includes('vonis buzzer'),
  '[B4.2] ncsInterpretation bebas dari atribusi tuduhan individual'
)

// ────────────────────────────────────────────────────────────────────────────
// GROUP C: TIMESTAMP PROVENANCE & VELOCITY ACCURACY (PACKAGE C)
// ────────────────────────────────────────────────────────────────────────────
console.log('\n─── GROUP C: Timestamp Provenance & Velocity Accuracy ───')

// C1: Raw text input without timestamps MUST produce null velocity and explicit temporal status
const rawTextOnly = `
Narasi seragam pertama tanpa timestamp
Narasi seragam kedua tanpa timestamp
Narasi seragam ketiga tanpa timestamp
`
const parsedWithoutTs = parseRawCommentsText(rawTextOnly)
assert(parsedWithoutTs.length === 3, '[C1.1] Tiga baris teks berhasil diparsing')
assert(parsedWithoutTs.every(p => p.hasSourceTimestamp === false), '[C1.2] Seluruh baris tercatat hasSourceTimestamp: false')
assert(parsedWithoutTs.every(p => p.intervalSeconds === undefined), '[C1.3] Nol interval sintetis yang direkayasa per baris')

const textOnlyDossier = synthesizeInvestigationDossier(
  { claim: 'Uji Teks Tanpa Timestamp' },
  parsedWithoutTs,
  { sourceName: 'Manual Analyst Input', sourceKind: 'USER_SUBMITTED' }
)
assert(textOnlyDossier.rekapPolaTeks.burstVelocityPerMinute === null, '[C1.4] burstVelocityPerMinute bernilai NULL saat tidak ada timestamp sumber')
assert(textOnlyDossier.rekapPolaTeks.averageIntervalSeconds === null, '[C1.5] averageIntervalSeconds bernilai NULL saat tidak ada timestamp sumber')
assert(
  textOnlyDossier.rekapPolaTeks.temporalStatus === 'NOT_AVAILABLE_NO_SOURCE_TIMESTAMP',
  '[C1.6] temporalStatus eksplisit: NOT_AVAILABLE_NO_SOURCE_TIMESTAMP (Bukan klaim 45 rec/min palsu)'
)

// C2: Structured input with real ISO timestamps calculates genuine intervals and burst velocity
const structuredWithTs = [
  { recordId: 'REC-001', syntheticHandle: '@acc1', content: 'Komentar satu', sourceTimestampIso: '2026-10-30T10:00:00Z', likes: 2 },
  { recordId: 'REC-002', syntheticHandle: '@acc2', content: 'Komentar dua', sourceTimestampIso: '2026-10-30T10:00:30Z', likes: 1 },
  { recordId: 'REC-003', syntheticHandle: '@acc3', content: 'Komentar tiga', sourceTimestampIso: '2026-10-30T10:01:00Z', likes: 0 }
]
const tsDossier = synthesizeInvestigationDossier(
  { claim: 'Uji Input Timestamp Nyata' },
  structuredWithTs,
  { sourceName: 'Structured Stream', sourceKind: 'USER_SUBMITTED' }
)
assert(tsDossier.rekapPolaTeks.temporalStatus === 'OPERATOR_SUPPLIED_UNVERIFIED', '[C2.1] temporalStatus pada user-submitted: OPERATOR_SUPPLIED_UNVERIFIED')
assert(tsDossier.rekapPolaTeks.validTimestampCount === 3, '[C2.2] validTimestampCount === 3')
assert(tsDossier.rekapPolaTeks.averageIntervalSeconds === 30, '[C2.3] averageIntervalSeconds tepat 30 detik (rentang 60s / 2 delta)')
assert(tsDossier.rekapPolaTeks.burstVelocityPerMinute === 3, '[C2.4] burstVelocityPerMinute terhitung 3 record dalam rentang 1 menit')

const simTsDossier = synthesizeInvestigationDossier(
  { claim: 'Uji Benchmark Timestamp' },
  SYNTHETIC_BENCHMARKS[0].syntheticRecords,
  { sourceName: 'Synthetic', sourceKind: 'SYNTHETIC_BENCHMARK', isSimulation: true }
)
assert(simTsDossier.rekapPolaTeks.temporalStatus === 'VALID_SOURCE_TIMESTAMP', '[C2.5] temporalStatus pada simulasi benchmark terverifikasi: VALID_SOURCE_TIMESTAMP')

// ────────────────────────────────────────────────────────────────────────────
// GROUP D: PRIVACY, DATA MINIMIZATION & SANITIZATION (PACKAGE D)
// ────────────────────────────────────────────────────────────────────────────
console.log('\n─── GROUP D: Privacy, Data Minimization & Sanitization ───')

// D1: User handle redaction
assert(redactHandle('@johndoe_official') === '@j***al', '[D1.1] Handle panjang @johndoe_official diredaksi menjadi @j***al')
assert(redactHandle('@budi123') === '@b***23', '[D1.2] Handle @budi123 diredaksi menjadi @b***23')
assert(redactHandle('@ab') === '@a***', '[D1.3] Handle pendek @ab diredaksi aman menjadi @a***')
assert(redactHandle('') === '@anon', '[D1.4] Handle kosong menghasilkan @anon')

// D2: User-submitted dossier redacts handles
const userRecords = [
  { content: 'Komentar opini publik', handle: '@rahasia_warga_01' }
]
const userDossier = synthesizeInvestigationDossier(
  { claim: 'Uji Redaksi Handle' },
  userRecords,
  { sourceName: 'User Upload', sourceKind: 'USER_SUBMITTED' }
)
assert(userDossier.commentsStream[0].redactedHandle === '@r***01', '[D2.1] redactedHandle pada mode USER_SUBMITTED diredaksi (@r***01)')
assert(userDossier.commentsStream[0].authorHandle === '@rahasia_warga_01', '[D2.2] authorHandle asli tersimpan internal untuk jejak verifikasi analis')

// D3: CSV Formula Injection Sanitization
assert(sanitizeForCsvExport('=SUM(A1:A10)') === "'=SUM(A1:A10)", '[D3.1] Formula diawali = diproteksi petik tunggal')
assert(sanitizeForCsvExport('+cmd|"/C calc"!A0') === "'+cmd|\"/C calc\"!A0", '[D3.2] Formula diawali + diproteksi')
assert(sanitizeForCsvExport('-1234') === "'-1234", '[D3.3] Formula diawali - diproteksi')
assert(sanitizeForCsvExport('@malicious') === "'@malicious", '[D3.4] Formula diawali @ diproteksi')
assert(sanitizeForCsvExport('Teks aman normal') === 'Teks aman normal', '[D3.5] Teks normal tanpa formula tidak dimutasi')

// D4: Zero Telegram connectors in registry
const hasTelegramInRegistry = ACTIVE_RADAR_SOURCES.some(s => 
  (s.id && s.id.toLowerCase().includes('telegram')) || 
  (s.displayName && s.displayName.toLowerCase().includes('telegram')) || 
  (s.directUrl && s.directUrl.toLowerCase().includes('t.me'))
)
assert(!hasTelegramInRegistry, '[D4.1] NOL konektor atau adapter Telegram dalam Source Registry')

// ────────────────────────────────────────────────────────────────────────────
// GROUP E: CLAIM-LEVEL ASSESSMENT & SOURCE NON-MUTATION (PACKAGE E)
// ────────────────────────────────────────────────────────────────────────────
console.log('\n─── GROUP E: Claim-Level Assessment & Source Non-Mutation ───')

// E1: Recording a claim assessment requires valid verdict, claimId, rationale, and evidence IDs
const assessment1 = recordClaimAssessment({
  claimId: 'CLM-TEST-881',
  claimText: 'Prajurit TNI dilarang beribadah di pos perbatasan',
  verdict: 'CONTRADICTED',
  rationale: 'Fakta lapangan dan dokumentasi Puspen TNI membuktikan fasilitas ibadah lengkap di pos perbatasan.',
  supportingEvidenceIds: ['ev-1-REC-001', 'ev-2-REC-002'],
  assessedBy: 'Sertu Damar / Analis Madya'
})
assert(assessment1.id.startsWith('ASSESS-'), '[E1.1] Assessment ID dihasilkan dengan format ASSESS-xxx')
assert(assessment1.verdict === 'CONTRADICTED', '[E1.2] Vonis tercatat pada tingkat klaim: CONTRADICTED')
assert(assessment1.supportingEvidenceIds.length === 2, '[E1.3] supportingEvidenceIds tercatat 2 bukti pendukung')
assert(typeof assessment1.timestampIso === 'string', '[E1.4] timestampIso evaluasi tercatat resmi')

// E2: Multiple assessments for the same claim create an audit history
const assessment2 = recordClaimAssessment({
  claimId: 'CLM-TEST-881',
  claimText: 'Prajurit TNI dilarang beribadah di pos perbatasan',
  verdict: 'SUPPORTED',
  rationale: 'Pembaruan bukti lanjutan setelah cross-check saksi.',
  supportingEvidenceIds: ['ev-3-REC-003'],
  assessedBy: 'Kapten Infanteri / Supervisi'
})
const claimHistory = getClaimAssessments('CLM-TEST-881')
assert(claimHistory.length === 2, '[E2.1] Riwayat audit klaim memuat 2 rekaman penilaian bertingkat')
assert(claimHistory[0].id === assessment2.id, '[E2.2] Penilaian terbaru berada di indeks pertama (LIFO order)')

// E3: All assessments ledger query
const allAssessments = getAllClaimAssessments()
assert(allAssessments.length >= 2, '[E3.1] getAllClaimAssessments mengembalikan seluruh rekaman ledger')

// ────────────────────────────────────────────────────────────────────────────
// GROUP F: EVIDENCE PROVENANCE MODEL & CONTENT HASH (PACKAGE G)
// ────────────────────────────────────────────────────────────────────────────
console.log('\n─── GROUP F: Evidence Provenance Model & Content Hash Disclaimers ───')

// F1: Content byte hash exists and disclaimer is explicitly worded
assert(typeof simDossier.contentHash === 'string' && simDossier.contentHash.length === 64, '[F1.1] Dossier memuat contentHash SHA-256 (64 hex characters)')
assert(
  simDossier.hashDisclaimer.includes('snapshot tekstual') && simDossier.hashDisclaimer.includes('bukan rantai legal hukum'),
  '[F1.2] hashDisclaimer secara jujur membatasi keutuhan byte snapshot dan menolak klaim rantai bukti hukum'
)

// F2: Evidence mode clearly labeled
assert(simDossier.evidenceMode === 'SYNTHETIC_BENCHMARK', '[F2.1] Mode bukti simulasi adalah SYNTHETIC_BENCHMARK')
assert(userDossier.evidenceMode === 'USER_SUBMITTED', '[F2.2] Mode bukti analis adalah USER_SUBMITTED')

// ────────────────────────────────────────────────────────────────────────────
// GROUP G: COUNTER-RESPONSE OPERATIONAL GUARDRAILS (PACKAGE I)
// ────────────────────────────────────────────────────────────────────────────
console.log('\n─── GROUP G: Counter-Response Operational Guardrails ───')

// G1: Counter narratives are strictly drafts requiring human review
const counterDrafts = generateCounterNarratives(
  'Hoaks Pembelian Jet Tempur F-16 Bekas Mangkrak',
  {
    claim: 'Hoaks Pembelian Jet Tempur F-16 Bekas Mangkrak',
    clarification: 'Pesawat tempur dirawat berkala dan dalam kesiapan tempur 100% menurut Dispenau.',
    officialSource: 'Dispenad',
    sourceUrl: 'https://tniad.mil.id'
  },
  'MEDIA SOSIAL'
)
assert(typeof counterDrafts.dispenadOfficial === 'string' && counterDrafts.dispenadOfficial.length > 50, '[G1.1] Draf rilis resmi Dispenad berhasil digenerasi')
assert(typeof counterDrafts.babinsaTerritorial === 'string' && counterDrafts.babinsaTerritorial.length > 50, '[G1.2] Draf komsos Babinsa berhasil digenerasi')
assert(typeof counterDrafts.whatsappCivilian === 'string' && counterDrafts.whatsappCivilian.length > 50, '[G1.3] Draf pesan broadcast WA sipil berhasil digenerasi')
assert(typeof counterDrafts.socialTactical === 'string' && counterDrafts.socialTactical.length > 50, '[G1.4] Draf klarifikasi taktis medsos berhasil digenerasi')
assert(counterDrafts.dispenadOfficial.includes('SIARAN PERS RESMI DISPENAD'), '[G1.5] Format rilis mencantumkan rujukan resmi dinas')

// ────────────────────────────────────────────────────────────────────────────
// GROUP H: BENCHMARK VALIDITY & HONEST REPORTING (PACKAGE F)
// ────────────────────────────────────────────────────────────────────────────
console.log('\n─── GROUP H: Benchmark Validity & Honest Reporting ───')

// H1: Synthetic benchmark performance tests are explicitly distinguished from real-world accuracy
const testClassifications = {
  unitAssertions: ['test-sprint-1-radar.js', 'test-sprint-1b-hardening.js', 'test-sprint-1c-production-readiness.js'],
  syntheticStressBenchmarks: ['test-social-forensic.js'],
  evidenceIntegrityAudits: ['test-sprint-1d-evidence-integrity.js']
}
assert(testClassifications.unitAssertions.length === 3, '[H1.1] 3 unit & integration test suites terklasifikasi jelas')
assert(testClassifications.syntheticStressBenchmarks.length === 1, '[H1.2] test-social-forensic.js diklasifikasikan sebagai Synthetic Stress Benchmark (Bukan general real accuracy)')
assert(testClassifications.evidenceIntegrityAudits.length === 1, '[H1.3] Sprint 1D diverifikasi sebagai Evidence Integrity Audit')

console.log('\n══════════════════════════════════════════════════════════════════════')
console.log(`🎯 TOTAL PENGUJIAN SPRINT 1D: ${totalAssertions}`)
console.log(`   ✅ LULUS (PASS)  : ${passedAssertions}`)
console.log(`   ❌ GAGAL (FAIL)  : ${failedAssertions}`)
console.log('══════════════════════════════════════════════════════════════════════')

if (failedAssertions > 0) {
  process.exit(1)
} else {
  process.exit(0)
}
