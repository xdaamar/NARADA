/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — RADAR CLUSTERING, STRATEGIC FILTER & VERDICT TEST SUITE
 * Pusat Pertahanan Siber TNI AD (PUSSIBERAD) × CODEPOLITAN
 * Kartika Cyber Hackathon 2026
 * ══════════════════════════════════════════════════════════════════════════
 */

import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

console.log('══════════════════════════════════════════════════════════════════════')
console.log('🛰️  NARADA — RADAR CLUSTER, FILTER & VERDICT VALIDATION SUITE')
console.log('    Verifikasi Rekonstruksi Klaster, Anti-Junk & Pemisahan Fakta/Pantau')
console.log('══════════════════════════════════════════════════════════════════════\n')

let passCount = 0
let totalCount = 0

function runTest(id, description, fn) {
  totalCount++
  try {
    fn()
    console.log(`  ✅ PASS: [${id}] ${description}`)
    passCount++
  } catch (err) {
    console.error(`  ❌ FAIL: [${id}] ${description}`)
    console.error(`     Error: ${err.message}`)
  }
}

// ─── Transpile and Load Modular Engines ───
function loadTsModule(relativePath) {
  const code = fs.readFileSync(path.join(rootDir, relativePath), 'utf-8')
  const transpiled = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(transpiled).toString('base64'))
}

const clusterModule = await loadTsModule('src/engine/radar/cluster-classifier.ts')
const filterModule = await loadTsModule('src/engine/radar/strategic-intelligence-filter.ts')
const verdictModule = await loadTsModule('src/engine/radar/verdict-evaluator.ts')

const { classifyCluster, evaluateClusterScoring } = clusterModule
const { isStrategicIntelligenceEligible } = filterModule
const { evaluateRadarVerdict } = verdictModule

// ─── GATE 1: AUDIT KLASTER STUNTING CIAMIS (ANTI-MISMATCH POLITIK) ───
console.log('─── Gate 1: Penolakan Keras Mismatch Stunting Kabupaten Ciamis -> Politik ───')

runTest('RAD-01.1', 'classifyCluster MENOLAK berita santunan stunting balita Ciamis diklasifikasikan ke POLITIK_NEGARA', () => {
  const title = 'Cegah Stunting, Pemerintah Kabupaten Ciamis Kolaborasi Salurkan Santunan untuk Balita'
  const cluster = classifyCluster(title, 'Dinas Kesehatan dan Pemkab Ciamis serahkan santunan')
  assert.notEqual(cluster, 'POLITIK_NEGARA', 'Berita santunan stunting kabupaten DILARANG KERAS masuk klaster POLITIK_NEGARA!')
  assert.equal(cluster, 'UMUM_NETRAL', 'Harus dialihkan ke UMUM_NETRAL (bukan Politik)')
})

runTest('RAD-01.2', 'isStrategicIntelligenceEligible MENOLAK berita seremonial santunan balita kabupaten dari radar taktis', () => {
  const title = 'Cegah Stunting, Pemerintah Kabupaten Ciamis Kolaborasi Salurkan Santunan untuk Balita'
  const result = isStrategicIntelligenceEligible(title, '', 'Portal Daerah')
  assert.equal(result.isEligible, false, 'Seremonial santunan rutin kabupaten harus ditolak dari radar')
  assert.equal(result.exclusionReason, 'MUNICIPAL_CEREMONIAL')
})

runTest('RAD-01.3', 'classifyCluster mengklasifikasikan isu siber dan peretasan dengan akurat', () => {
  const cluster = classifyCluster('Pusat Data Nasional PDNS Diserang Ransomware Brain Cipher', 'BSSN lakukan penanganan')
  assert.equal(cluster, 'SIBER_PERETASAN')
})

runTest('RAD-01.4', 'classifyCluster mengklasifikasikan isu kedaulatan militer dengan akurat', () => {
  const cluster = classifyCluster('TNI AD dan Alutsista Perbatasan Perkuat Pertahanan Wilayah Natuna', 'Patroli laut dan kedaulatan')
  assert.equal(cluster, 'KEDAULATAN_MILITER')
})

runTest('RAD-01.5', 'classifyCluster HANYA memberikan klaster POLITIK_NEGARA untuk ketatanegaraan tingkat tinggi nasional', () => {
  const cluster = classifyCluster('Presiden Prabowo Pimpin Sidang Kabinet Paripurna Bersama Para Menteri Koordinator', 'Agenda kebijakan pemerintah pusat')
  assert.equal(cluster, 'POLITIK_NEGARA')
})

// ─── GATE 2: EVALUASI CERDAS VONIS (FAKTA PASTI VS SEDANG DIPANTAU) ───
console.log('\n─── Gate 2: Evaluasi Cerdas Vonis (Fakta Pasti Terjadi vs Sedang Dipantau) ───')

runTest('RAD-02.1', 'evaluateRadarVerdict menetapkan peristiwa resmi terkonfirmasi sebagai FAKTA', () => {
  const res = evaluateRadarVerdict('Presiden Prabowo Lantik Kepala Badan Intelijen Negara Baru di Istana', '', 'LKBN ANTARA')
  assert.equal(res.verdict, 'FAKTA')
  assert.equal(res.isPastiTerjadi, true)
})

runTest('RAD-02.2', 'evaluateRadarVerdict menetapkan rilis peringatan cuaca BMKG sebagai FAKTA', () => {
  const res = evaluateRadarVerdict('BMKG Rilis Peringatan Dini Potensi Gelombang Tinggi di Samudra Hindia', '', 'BMKG')
  assert.equal(res.verdict, 'FAKTA')
  assert.equal(res.isPastiTerjadi, true)
})

runTest('RAD-02.3', 'evaluateRadarVerdict memasukkan klaim spekulatif/viral ke status UNVERIFIED (SEDANG DIPANTAU)', () => {
  const res = evaluateRadarVerdict('Viral Narasi Beredar Video Diduga Bocoran Dokumen Rahasia Pengadaan Alutsista', '', 'Media Sosial Radar')
  assert.equal(res.verdict, 'UNVERIFIED', 'Klaim viral belum terkonfirmasi WAJIB masuk SEDANG DIPANTAU!')
  assert.equal(res.isSpekulatif, true)
})

runTest('RAD-02.4', 'evaluateRadarVerdict memasukkan klaim hacker/dugaan peretasan ke SEDANG DIPANTAU jika belum dibantah/dikonfirmasi', () => {
  const res = evaluateRadarVerdict('Diduga Terjadi Kebocoran Data Nasabah Bank Nasional di Forum Dark Web', '', 'Sensor Anomali Siber')
  assert.equal(res.verdict, 'UNVERIFIED')
  assert.equal(res.isSpekulatif, true)
})

runTest('RAD-02.5', 'evaluateRadarVerdict menetapkan rujukan TurnBackHoax sebagai HOAKS', () => {
  const res = evaluateRadarVerdict('[SALAH] Beredar Narasi Pemerintah Bagikan Uang 5 Juta Lewat Tautan Ini', '', 'TurnBackHoax.ID')
  assert.equal(res.verdict, 'HOAKS')
})

// ─── GATE 3: INTEGRITAS KONSOL LIVE RADAR (PENGGABUNGAN TAB & HAPUS SEMUA ISU) ───
console.log('\n─── Gate 3: Integritas Konsol LiveRadar (Penggabungan Tab & Penghapusan Semua Isu) ───')

runTest('RAD-03.1', 'LiveRadar.tsx telah menggabungkan ISU BARU & MENINGKAT ke dalam SEDANG DIPANTAU', () => {
  const radarSrc = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'LiveRadar.tsx'), 'utf-8')
  assert.ok(radarSrc.includes("label: 'SEDANG DIPANTAU'"), 'Harus memuat tab SEDANG DIPANTAU')
  assert.ok(radarSrc.includes('ISU BARU & MENINGKAT'), 'Harus menyatukan sub-lencana ISU BARU & MENINGKAT')
})

runTest('RAD-03.2', 'LiveRadar.tsx telah MENGHAPUS tombol tab SEMUA ISU AKTIF dari bilah filter', () => {
  const radarSrc = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'LiveRadar.tsx'), 'utf-8')
  // Pastikan tidak ada tombol tab { key: 'ALL', label: 'SEMUA ISU AKTIF' } di filter status baris 1
  assert.ok(!radarSrc.includes("{ key: 'ALL', label: 'SEMUA ISU AKTIF'"), 'Tab SEMUA ISU AKTIF harus terhapus total dari tombol filter')
})

runTest('RAD-03.3', 'LiveRadar.tsx mengatur default activeViewMode ke SEDANG DIPANTAU (UNVERIFIED)', () => {
  const radarSrc = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'LiveRadar.tsx'), 'utf-8')
  assert.ok(radarSrc.includes("useState<RadarTriageStatus | 'ALL' | 'RESOLVED'>('UNVERIFIED')"), 'Default selectedTriage harus UNVERIFIED')
})

console.log('\n══════════════════════════════════════════════════════════════════════')
console.log(`📊 RADAR VALIDATION SUMMARY: ${passCount} / ${totalCount} ASSERTIONS PASSED`)
if (passCount === totalCount) {
  console.log('🏆 SELURUH ENGINE RADAR, KLASTER, FILTER, & VONIS 100% LULUS SEMPURNA!')
} else {
  console.log('⚠️ TERDAPAT KEGAGALAN TEST!')
  process.exit(1)
}
console.log('══════════════════════════════════════════════════════════════════════\n')

