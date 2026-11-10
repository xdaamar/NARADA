/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — ARCHIVE INTELLIGENCE & MONITORING CONSOLE TEST SUITE
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
console.log('📦  NARADA — ARCHIVE INTELLIGENCE & MONITORING CONSOLE TEST SUITE')
console.log('    Validasi Komprehensif Alur Arsip, Sinkronisasi Dinamis, & UI')
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

// ─── Setup Mock LocalStorage & Browser Events ───
class LocalStorageMock {
  constructor() { this.store = {} }
  getItem(key) { return this.store[key] || null }
  setItem(key, value) { this.store[key] = String(value) }
  removeItem(key) { delete this.store[key] }
  clear() { this.store = {} }
}

global.localStorage = new LocalStorageMock()
const dispatchedEvents = []
global.window = {
  dispatchEvent: (event) => { dispatchedEvents.push(event) }
}
global.CustomEvent = class CustomEvent {
  constructor(type, init) {
    this.type = type
    this.detail = init?.detail
  }
}

// ─── Compile & Load archive-service.ts Using Official TypeScript Compiler ───
const archiveServiceSource = fs.readFileSync(
  path.join(rootDir, 'src', 'engine', 'archive', 'archive-service.ts'),
  'utf-8'
)

const transpiled = ts.transpileModule(archiveServiceSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText

const serviceModule = await import('data:text/javascript;base64,' + Buffer.from(transpiled).toString('base64'))

const {
  getArchivedIssueIds,
  getArchivedVerdicts,
  getArchivedEntries,
  isIssueArchived,
  archiveIssue,
  unarchiveIssue,
  toggleArchive,
  setArchivedVerdict,
  syncArchivedItemsWithRadar
} = serviceModule

// ─── GATE 1: ARSIPKAN FUNCTIONALITY & INITIAL STATUS "SEDANG DIPANTAU" ───
console.log('─── Gate 1: Fungsi Arsip & Jaminan Status Awal "Sedang Dipantau" ───')

runTest('ARC-01', 'Arsip awal dari berita unverified harus memiliki status archiveVerdict: DIPANTAU', () => {
  global.localStorage.clear()
  dispatchedEvents.length = 0

  const mockItem = {
    id: 'radar-item-101',
    claim: 'Klaim viral unverified tentang distribusi bantuan logistik darurat',
    verdict: 'UNVERIFIED',
    cluster: 'BENCANA_DARURAT',
    clarification: 'Menunggu konfirmasi BPBD setempat',
    officialSource: 'Radar Babinsa',
    sourceUrl: 'https://example.com/bencana',
    tacticalResponseMilitary: 'Monitoring aktif',
    publishedDate: '10 Nov 2026',
    cognitiveScore: 65,
    keywords: ['bantuan', 'logistik']
  }

  archiveIssue(mockItem)

  assert.equal(isIssueArchived('radar-item-101'), true)
  assert.equal(getArchivedIssueIds().has('radar-item-101'), true)

  const entries = getArchivedEntries()
  assert.equal(entries.length, 1)
  assert.equal(entries[0].id, 'radar-item-101')
  // Jaminan Mutlak: Status awal SELALU DIPANTAU
  assert.equal(entries[0].archiveVerdict, 'DIPANTAU')
  assert.equal(entries[0].isManualOverride, false)
  assert.ok(entries[0].archivedAt)
  assert.ok(typeof entries[0].archivedTimestamp === 'number')
})

runTest('ARC-02', 'Berita yang diarsipkan tidak boleh langsung otomatis terindikasi Hoaks', () => {
  // Bahkan jika item radar aslinya membawa label hoaks/unverified, saat pertama kali masuk console arsip pemantauan, statusnya DIPANTAU
  const mockItem2 = {
    id: 'radar-item-102',
    claim: 'Isu sensitif pergerakan armada alutsista di perbatasan',
    verdict: 'HOAKS',
    cluster: 'KEDAULATAN_MILITER',
    clarification: '',
    officialSource: 'Medsos X',
    keywords: ['alutsista', 'perbatasan']
  }

  archiveIssue(mockItem2)
  const entries = getArchivedEntries()
  const item2 = entries.find(e => e.id === 'radar-item-102')

  assert.ok(item2)
  assert.equal(item2.archiveVerdict, 'DIPANTAU', 'Status awal harus DIPANTAU agar analis dapat memantau perkembangannya')
  assert.equal(item2.isManualOverride, false)
})

// ─── GATE 2: SINKRONISASI DINAMIS DENGAN ARUS RADAR TERBARU ───
console.log('\n─── Gate 2: Sinkronisasi Dinamis Otomatis dengan Arus Radar Baru ───')

runTest('ARC-03', 'syncArchivedItemsWithRadar otomatis mengubah status menjadi FAKTA saat rujukan resmi terbit', () => {
  // Simulasikan kedatangan feed radar baru beberapa jam kemudian di mana item-101 telah dikonfirmasi FAKTA
  const freshRadarFeed = [
    {
      id: 'radar-item-101',
      claim: 'Klaim viral unverified tentang distribusi bantuan logistik darurat',
      verdict: 'FAKTA',
      clarification: 'Telah terverifikasi resmi oleh Dinas Sosial dan Kodam setempat.',
      officialSource: 'Kemensos RI & Kodam Jaya',
      sourceUrl: 'https://kemensos.go.id/klarifikasi-101',
      publishedDate: '10 Nov 2026, 14:00 WIB'
    }
  ]

  syncArchivedItemsWithRadar(freshRadarFeed)

  const entries = getArchivedEntries()
  const item101 = entries.find(e => e.id === 'radar-item-101')

  assert.ok(item101)
  assert.equal(item101.archiveVerdict, 'FAKTA', 'Status arsip harus otomatis berubah menjadi FAKTA!')
  assert.equal(item101.clarification, 'Telah terverifikasi resmi oleh Dinas Sosial dan Kodam setempat.')
  assert.equal(item101.officialSource, 'Kemensos RI & Kodam Jaya')
  assert.equal(item101.sourceUrl, 'https://kemensos.go.id/klarifikasi-101')
})

runTest('ARC-04', 'syncArchivedItemsWithRadar otomatis mengubah status menjadi HOAKS saat bukti manipulasi terdeteksi', () => {
  // Simulasikan kedatangan feed radar baru di mana item-102 telah dibongkar hoaksnya oleh Mafindo/TurnBackHoax
  const freshRadarFeed = [
    {
      id: 'radar-item-102',
      claim: 'Isu sensitif pergerakan armada alutsista di perbatasan',
      verdict: 'HOAKS',
      clarification: 'Dispenad mengonfirmasi video tersebut adalah dokumentasi latihan gabungan tahun 2022 yang disunting ulang secara manipulatif.',
      officialSource: 'Dispenad TNI AD & Mafindo',
      sourceUrl: 'https://tniad.mil.id/klarifikasi-alutsista'
    }
  ]

  syncArchivedItemsWithRadar(freshRadarFeed)

  const entries = getArchivedEntries()
  const item102 = entries.find(e => e.id === 'radar-item-102')

  assert.ok(item102)
  assert.equal(item102.archiveVerdict, 'HOAKS', 'Status arsip harus otomatis berubah menjadi HOAKS!')
  assert.ok(item102.clarification.includes('Dispenad'))
})

// ─── GATE 3: MANUAL OVERRIDE OLEH ANALIS & RESET PANTAU ───
console.log('\n─── Gate 3: Penetapan Manual Analis (Set Fakta, Set Hoaks, Reset Pantau) ───')

runTest('ARC-05', 'setArchivedVerdict menetapkan manual override yang kebal dari radar conflicting overwrite', () => {
  // Analis secara sadar menetapkan item-101 sebagai HOAKS berdasarkan bukti forensik digital
  setArchivedVerdict('radar-item-101', 'HOAKS')

  let entries = getArchivedEntries()
  let item101 = entries.find(e => e.id === 'radar-item-101')
  assert.equal(item101.archiveVerdict, 'HOAKS')
  assert.equal(item101.isManualOverride, true)

  // Arus radar mengirim data FAKTA, tapi manual override analis harus dipertahankan!
  syncArchivedItemsWithRadar([
    {
      id: 'radar-item-101',
      verdict: 'FAKTA',
      clarification: 'Feed radar lama mengira fakta'
    }
  ])

  entries = getArchivedEntries()
  item101 = entries.find(e => e.id === 'radar-item-101')
  assert.equal(item101.archiveVerdict, 'HOAKS', 'Manual override analis harus melindungi vonis dari radar overwrite!')
})

runTest('ARC-06', 'Reset Pantau mengembalikan status ke DIPANTAU dan mengaktifkan kembali auto-sync radar', () => {
  // Analis mengklik Reset Pantau
  setArchivedVerdict('radar-item-101', 'DIPANTAU')

  let entries = getArchivedEntries()
  let item101 = entries.find(e => e.id === 'radar-item-101')
  assert.equal(item101.archiveVerdict, 'DIPANTAU')
  assert.equal(item101.isManualOverride, false)

  // Karena sudah direset ke DIPANTAU, kini auto-sync radar dapat kembali mengupdate status saat data asli muncul
  syncArchivedItemsWithRadar([
    {
      id: 'radar-item-101',
      verdict: 'FAKTA',
      clarification: 'Data valid final dikonfirmasi'
    }
  ])

  entries = getArchivedEntries()
  item101 = entries.find(e => e.id === 'radar-item-101')
  assert.equal(item101.archiveVerdict, 'FAKTA', 'Setelah Reset Pantau, status harus dapat terupdate otomatis kembali')
})

// ─── GATE 4: TOGGLE & UNARCHIVE (PEMBERSIHAN DATA) ───
console.log('\n─── Gate 4: Toggle & Batal Arsip (Pembersihan Data) ───')

runTest('ARC-07', 'unarchiveIssue dan toggleArchive menghapus item dari repositori arsip secara bersih', () => {
  assert.equal(isIssueArchived('radar-item-101'), true)

  // Batal arsip via toggleArchive
  const stillArchived = toggleArchive({ id: 'radar-item-101' })
  assert.equal(stillArchived, false)
  assert.equal(isIssueArchived('radar-item-101'), false)
  assert.equal(getArchivedIssueIds().has('radar-item-101'), false)

  const entriesAfter = getArchivedEntries()
  assert.equal(entriesAfter.some(e => e.id === 'radar-item-101'), false)
})

// ─── GATE 5: INTEGRITAS HALAMAN & KONTRAK UI ───
console.log('\n─── Gate 5: Integritas Halaman Daftar Pantau Khusus, Radar & Navigasi ───')

runTest('ARC-08', 'File src/pages/Archive.tsx mengimplementasikan Konsol Daftar Pantau secara lengkap & Analyzer.tsx terhapus total', () => {
  const archiveSrc = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'Archive.tsx'), 'utf-8')

  assert.ok(archiveSrc.includes('KONSOL DAFTAR PANTAU KHUSUS'), 'Judul konsol daftar pantau harus ada')
  assert.ok(archiveSrc.includes('TOTAL DALAM DAFTAR PANTAU'), 'Kotak metrik total harus ada')
  assert.ok(archiveSrc.includes('MENUNGGU VERIFIKASI (DIPANTAU)'), 'Kotak metrik sedang dipantau harus ada')
  assert.ok(archiveSrc.includes('TERVERIFIKASI FAKTA RESMI'), 'Kotak metrik fakta harus ada')
  assert.ok(archiveSrc.includes('TERINDIKASI HOAKS'), 'Kotak metrik hoaks harus ada')
  assert.ok(archiveSrc.includes('steel-chassis-card'), 'Harus konsisten menggunakan tema steel-chassis-card')
  assert.ok(archiveSrc.includes('setArchivedVerdict'), 'Harus menyediakan tombol aksi penetapan status analis')
  assert.ok(archiveSrc.includes('unarchiveIssue'), 'Harus menyediakan tombol Lepas Pantauan')
  assert.ok(!fs.existsSync(path.join(rootDir, 'src', 'pages', 'Analyzer.tsx')), 'Analyzer.tsx harus sudah dihapus total')
  assert.ok(!fs.existsSync(path.join(rootDir, 'src', 'components', 'OCRUploader.tsx')), 'OCRUploader.tsx harus sudah dihapus total')
})

runTest('ARC-09', 'LiveRadar.tsx menyediakan tombol DAFTAR PANTAU dan kontrol penyembunyian daftar pantau agar radar clean', () => {
  const radarSrc = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'LiveRadar.tsx'), 'utf-8')

  assert.ok(radarSrc.includes('+ DAFTAR PANTAU'), 'Tombol + DAFTAR PANTAU harus ada di kartu radar')
  assert.ok(radarSrc.includes('DALAM PANTAUAN'), 'Label status DALAM PANTAUAN harus ada')
  assert.ok(radarSrc.includes('hideArchivedInRadar'), 'Mekanisme penyaringan isu pantauan harus ada')
  assert.ok(radarSrc.includes('DAFTAR PANTAU DISEMBUNYIKAN'), 'Tombol toolbar kontrol visibilitas daftar pantau harus ada')
  assert.ok(radarSrc.includes('syncArchivedItemsWithRadar'), 'LiveRadar harus memanggil syncArchivedItemsWithRadar saat data masuk')
})

runTest('ARC-10', 'App.tsx, TacticalTopBar.tsx, dan Dashboard.tsx telah mengadopsi Daftar Pantau Khusus', () => {
  const appSrc = fs.readFileSync(path.join(rootDir, 'src', 'App.tsx'), 'utf-8')
  const topBarSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'TacticalTopBar.tsx'), 'utf-8')
  const dashSrc = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'Dashboard.tsx'), 'utf-8')

  assert.ok(appSrc.includes("label: 'Daftar Pantau'"), 'Menu ke-4 di sidebar harus berlabel Daftar Pantau')
  assert.ok(appSrc.includes("to: '/archive'"), 'Rute harus mengarah ke /archive')
  assert.ok(!appSrc.includes("Multi Input anlyzer"), 'Label lama Multi Input analyzer harus sudah dihapus')
  assert.ok(topBarSrc.includes('KONSOL DAFTAR PANTAU'), 'TacticalTopBar harus menampilkan judul Konsol Daftar Pantau')
  assert.ok(dashSrc.includes('1. Daftar Pantau'), 'Dashboard Tactical Quick Launchpad harus berlabel 1. Daftar Pantau')
  assert.ok(!dashSrc.includes('Multi-Input Analyzer'), 'Multi-Input Analyzer harus bersih dari Dashboard')
})

console.log('\n══════════════════════════════════════════════════════════════════════')
console.log(`📊 ARCHIVE INTELLIGENCE TEST SUMMARY: ${passCount} / ${totalCount} ASSERTIONS PASSED`)
if (passCount === totalCount) {
  console.log('🏆 SEMUA FUNGSI & KELUARAN DATA ARSIP 100% SESUAI PERMINTAAN USER!')
} else {
  console.log('⚠️ TERDAPAT KEGAGALAN TEST!')
  process.exit(1)
}
console.log('══════════════════════════════════════════════════════════════════════\n')
