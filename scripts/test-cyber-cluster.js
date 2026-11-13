/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — CYBER SECURITY & THREAT SPECTRUM ACCEPTANCE TEST SUITE
 * SPRINT 14: KLASTER SIBER & PERETASAN NASIONAL (PUSSIBERAD × BSSN)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
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
console.log('🛡️  NARADA — CYBER SECURITY & HACKING CLUSTER ACCEPTANCE TEST SUITE')
console.log('    Validasi Klaster Siber & Peretasan, Forensik Fakta vs Hoaks, & UI')
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

// ─── GATE 1: CONTRACT & TYPE DEFINITIONS ───
console.log('─── Gate 1: Definisi Kontrak Klaster SIBER_PERETASAN & Taksonomi ───')

runTest('CYB-01.1', 'src/types.ts mendefinisikan SIBER_PERETASAN pada ThreatSpectrumCluster', () => {
  const typesSrc = fs.readFileSync(path.join(rootDir, 'src', 'types.ts'), 'utf-8')
  assert.ok(typesSrc.includes("'SIBER_PERETASAN'"), 'ThreatSpectrumCluster harus memuat SIBER_PERETASAN')
})

runTest('CYB-01.2', 'src/engine/taxonomy.ts memuat taksonomi serangan siber, kebocoran data, dan ransomware', () => {
  const taxSrc = fs.readFileSync(path.join(rootDir, 'src', 'engine', 'taxonomy.ts'), 'utf-8')
  assert.ok(taxSrc.includes('SIBER_PERETASAN'), 'Taxonomy harus memetakan SIBER_PERETASAN')
  assert.ok(taxSrc.includes('SERANGAN_SIBER') || taxSrc.includes('RANSOMWARE'), 'Category detail siber harus terdaftar')
  assert.ok(taxSrc.includes('ransomware pdns'), 'Keyword ransomware pdns harus terdaftar')
})

// ─── GATE 2: CLUSTERING & INGESTION RECOGNITION ───
console.log('\n─── Gate 2: Klasifikasi Otomatis Ingesti Berita & Pengenalan Kata Kunci Siber ───')

// Ekstrak fungsi classifyCluster dari rss-parser.ts secara mandiri tanpa dependensi eksternal parser
const rssParserSrc = fs.readFileSync(path.join(rootDir, 'src', 'engine', 'ingest', 'rss-parser.ts'), 'utf-8')
const matchClassify = rssParserSrc.match(/export function classifyCluster\([\s\S]*?\n\}/)

let classifyCluster
if (matchClassify) {
  const code = ts.transpileModule(matchClassify[0].replace('export ', ''), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const fn = new Function(code + '; return classifyCluster;')()
  classifyCluster = fn
} else {
  throw new Error('classifyCluster tidak ditemukan di rss-parser.ts')
}

runTest('CYB-02.1', 'classifyCluster mengenali insiden ransomware sebagai SIBER_PERETASAN', () => {
  const cluster = classifyCluster('Server Layanan Publik Terinfeksi Serangan Ransomware Brain Cipher', 'BSSN lakukan isolasi')
  assert.equal(cluster, 'SIBER_PERETASAN')
})

runTest('CYB-02.2', 'classifyCluster mengenali kebocoran data breach BreachForums sebagai SIBER_PERETASAN', () => {
  const cluster = classifyCluster('10 Juta Data Nasabah Bocor Dijual Hacker Bjorka di BreachForums', 'Sampel diunggah di forum gelap')
  assert.equal(cluster, 'SIBER_PERETASAN')
})

runTest('CYB-02.3', 'classifyCluster mengenali defacement web judi online sebagai SIBER_PERETASAN', () => {
  const cluster = classifyCluster('Subdomain Resmi Lembaga Diretas Disusupi Halaman Slot Judol', 'SEO poisoning CMS terdeteksi')
  assert.equal(cluster, 'SIBER_PERETASAN')
})

runTest('CYB-02.4', 'classifyCluster mengenali penyebaran malware APK sebagai SIBER_PERETASAN', () => {
  const cluster = classifyCluster('Waspada Modus Surat Tilang APK Penguras Rekening', 'Malware trojan menyadap SMS verifikasi')
  assert.equal(cluster, 'SIBER_PERETASAN')
})

runTest('CYB-02.5', 'classifyCluster tetap mempertahankan klaster KEDAULATAN_MILITER untuk isu non-siber', () => {
  const cluster = classifyCluster('Latihan Tempur Pasukan TNI AD dan Kesiapan Alutsista di Perbatasan Natuna', 'Patroli kedaulatan laut')
  assert.equal(cluster, 'KEDAULATAN_MILITER')
})

// ─── GATE 3: FORENSIC VERIFICATION & PROOFING ENGINE (FAKTA VS HOAKS) ───
console.log('\n─── Gate 3: Mesin Pembuktian Forensik Fakta vs Hoaks Insiden Siber ───')

// Transpile dan load cyber-verification-engine.ts
const cyberEngineSrc = fs.readFileSync(path.join(rootDir, 'src', 'engine', 'cyber', 'cyber-verification-engine.ts'), 'utf-8')
const transpiledCyber = ts.transpileModule(cyberEngineSrc, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText

const cyberModule = await import('data:text/javascript;base64,' + Buffer.from(transpiledCyber).toString('base64'))
const { evaluateCyberIncident, CURATED_CYBER_INCIDENTS } = cyberModule

runTest('CYB-03.1', 'evaluateCyberIncident membuktikan Ransomware PDNS Surabaya sebagai FAKTA dengan bukti DLS & CSIRT', () => {
  const evalResult = evaluateCyberIncident('Pusat Data Nasional PDNS 2 Surabaya diserang Ransomware Brain Cipher', 'BSSN tangani pemulihan')
  assert.equal(evalResult.verdict, 'FAKTA')
  assert.equal(evalResult.incidentType, 'RANSOMWARE')
  assert.equal(evalResult.proofStatus, 'LEAK_SITE_CONFIRMED')
  assert.equal(evalResult.csirtStatus, 'CSIRT_ALERT_PUBLISHED')
  assert.ok(evalResult.technicalIndicators.length >= 2)
  assert.ok(evalResult.confidenceScore >= 90)
})

runTest('CYB-03.2', 'evaluateCyberIncident membuktikan klaim hacker meretas satelit komando TNI sebagai HOAKS', () => {
  const evalResult = evaluateCyberIncident('Hacker asing meretas satelit militer kendali rahasia Mabes TNI Kemhan', 'Dispenad bantah isu')
  assert.equal(evalResult.verdict, 'HOAKS')
  assert.equal(evalResult.incidentType, 'MILITARY_CYBER_CLAIM')
  assert.equal(evalResult.proofStatus, 'EXTORTION_BLUFF_NO_PROOF')
  assert.equal(evalResult.csirtStatus, 'CSIRT_DENIED_FALSE_ALARM')
  assert.ok(evalResult.forensicProofMethod.includes('Air-Gapped'))
})

runTest('CYB-03.3', 'evaluateCyberIncident membuktikan hoaks saldo bank lenyap Rp 0 sebagai HOAKS inspect element', () => {
  const evalResult = evaluateCyberIncident('Bank Mandiri BCA dibobol hacker saldo lenyap jadi nol rupiah', 'OJK pastikan dana aman')
  assert.equal(evalResult.verdict, 'HOAKS')
  assert.equal(evalResult.proofStatus, 'INSPECT_ELEMENT_FABRICATION')
  assert.equal(evalResult.csirtStatus, 'CSIRT_DENIED_FALSE_ALARM')
})

runTest('CYB-03.4', 'evaluateCyberIncident menetapkan status SEDANG DIPANTAU jika klaim belum terbukti oleh CSIRT', () => {
  const evalResult = evaluateCyberIncident('Klaim sepihak kebocoran database kredensial instansi baru', 'Sedang diteliti analis')
  assert.equal(evalResult.verdict, 'DIPANTAU')
  assert.equal(evalResult.proofStatus, 'UNDER_INVESTIGATION')
  assert.equal(evalResult.csirtStatus, 'PENDING_OFFICIAL_DISCLOSURE')
  assert.ok(evalResult.technicalIndicators.length > 0)
})

runTest('CYB-03.5', 'Pustaka CURATED_CYBER_INCIDENTS memuat minimal 8 kasus siber nyata Indonesia', () => {
  assert.ok(Array.isArray(CURATED_CYBER_INCIDENTS))
  assert.ok(CURATED_CYBER_INCIDENTS.length >= 8)
  const facts = CURATED_CYBER_INCIDENTS.filter(i => i.verdict === 'FAKTA')
  const hoaxes = CURATED_CYBER_INCIDENTS.filter(i => i.verdict === 'HOAKS')
  assert.ok(facts.length >= 4, 'Harus memuat kasus fakta terverifikasi (PDNS, NPWP, DPT, Malware APK, dll.)')
  assert.ok(hoaxes.length >= 2, 'Harus memuat kasus hoaks/gertakan (satelit militer, bank bobol saldo nol, dll.)')
})

// ─── GATE 4: SOURCE REGISTRY & CATALOG INTEGRATION ───
console.log('\n─── Gate 4: Integrasi Sumber Data Tercepat di shared/radar-source-catalog.json ───')

runTest('CYB-04.1', 'Catalog shared/radar-source-catalog.json memuat Google News profile & source siber', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(rootDir, 'shared', 'radar-source-catalog.json'), 'utf-8'))
  
  assert.ok(catalog.googleNewsProfiles['gnews-cyber-security'], 'Profile gnews-cyber-security harus terdaftar')
  assert.ok(catalog.googleNewsProfiles['gnews-cyber-security'].query.includes('serangan siber') || catalog.googleNewsProfiles['gnews-cyber-security'].query.includes('ransomware'))
  
  assert.ok(catalog.gdeltProfiles['gdelt-cyber-security'], 'Profile gdelt-cyber-security harus terdaftar')

  const cyberSource = catalog.sources.find(s => s.id === 'src-gnews-cyber')
  assert.ok(cyberSource, 'Source src-gnews-cyber harus terdaftar di array sources')
  assert.equal(cyberSource.category, 'SIBER_PERETASAN')
  assert.equal(cyberSource.domain, 'CYBER_PUBLIC_IMPACT')
  assert.equal(cyberSource.enabled, true)
})

runTest('CYB-04.2', 'debunk-database.json terintegrasi dengan entri NAR-CYB siber terverifikasi', () => {
  const db = JSON.parse(fs.readFileSync(path.join(rootDir, 'src', 'engine', 'data', 'debunk-database.json'), 'utf-8'))
  const cyberInDb = db.filter(e => e.cluster === 'SIBER_PERETASAN')
  assert.ok(cyberInDb.length >= 8, `debunk-database.json harus memuat entri siber (ditemukan: ${cyberInDb.length})`)
})

// ─── GATE 5: UI INTEGRATION IN RADAR & ARCHIVE ───
console.log('\n─── Gate 5: Integrasi UI di Radar Situasional & Berita Tersemat ───')

runTest('CYB-05.1', 'LiveRadar.tsx menyediakan filter klaster Siber & Peretasan (#06B6D4) dan klaster Kesehatan & Pangan telah dihapus', () => {
  const radarSrc = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'LiveRadar.tsx'), 'utf-8')
  assert.ok(radarSrc.includes("key: 'SIBER_PERETASAN'"), 'LiveRadar harus memuat key SIBER_PERETASAN')
  assert.ok(radarSrc.includes('Siber & Peretasan'), 'LiveRadar harus menampilkan label Siber & Peretasan')
  assert.ok(radarSrc.includes('#06B6D4'), 'Warna lencana harus konsisten #06B6D4')
  assert.ok(radarSrc.includes("item.cluster === 'SIBER_PERETASAN'"), 'LiveRadar harus memuat penanganan forensik siber')
  assert.ok(!radarSrc.includes("key: 'KESEHATAN_PANGAN'"), 'Klaster Kesehatan & Pangan harus sudah dihapus dari LiveRadar')
})

runTest('CYB-05.2', 'Archive.tsx menyediakan filter klaster Siber & Peretasan (#06B6D4) dan klaster Kesehatan & Pangan telah dihapus', () => {
  const archiveSrc = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'Archive.tsx'), 'utf-8')
  assert.ok(archiveSrc.includes("key: 'SIBER_PERETASAN'"), 'Archive.tsx harus memuat key SIBER_PERETASAN')
  assert.ok(archiveSrc.includes('Siber & Peretasan'), 'Archive.tsx harus menampilkan label Siber & Peretasan')
  assert.ok(archiveSrc.includes('#06B6D4'), 'Warna lencana harus konsisten #06B6D4')
  assert.ok(archiveSrc.includes("item.cluster === 'SIBER_PERETASAN'"), 'Archive.tsx harus memuat penanganan forensik siber')
  assert.ok(!archiveSrc.includes("key: 'KESEHATAN_PANGAN'"), 'Klaster Kesehatan & Pangan harus sudah dihapus dari Archive')
})

runTest('CYB-05.3', 'social-threat-dossier.ts memetakan konfigurasi klaster SIBER_PERETASAN', () => {
  const dossierSrc = fs.readFileSync(path.join(rootDir, 'src', 'engine', 'social-threat-dossier.ts'), 'utf-8')
  assert.ok(dossierSrc.includes('SIBER_PERETASAN: { label: \'Siber & Peretasan\', color: \'#06B6D4\' }'))
})

console.log('\n══════════════════════════════════════════════════════════════════════')
console.log(`📊 CYBER CLUSTER TEST SUMMARY: ${passCount} / ${totalCount} ASSERTIONS PASSED`)
if (passCount === totalCount) {
  console.log('🏆 KLASTER SIBER & PERETASAN 100% TERVERIFIKASI MEMENUHI STANDAR HACKATHON!')
} else {
  console.log('⚠️ TERDAPAT KEGAGALAN TEST PADA KLASTER SIBER!')
  process.exit(1)
}
console.log('══════════════════════════════════════════════════════════════════════\n')
