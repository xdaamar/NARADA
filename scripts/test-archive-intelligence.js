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

async function runTest(id, description, fn) {
  totalCount++
  try {
    await fn()
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
  syncArchivedItemsWithRadar,
  reconcileArchivedItems,
  areClaimsSemanticallyMatching,
  probeEvidenceForArchivedItem,
  probeAllUnverifiedArchivedItems,
  setOriginalSourceStatus,
  toggleOriginalSourceStatus,
  getDisplayOriginPlatform,
  isOriginalSourceDeleted
} = serviceModule

// ─── GATE 1: ARSIPKAN FUNCTIONALITY & INITIAL STATUS "SEDANG DIPANTAU" ───
console.log('─── Gate 1: Fungsi Arsip & Jaminan Status Awal "Sedang Dipantau" ───')

await runTest('ARC-01', 'Arsip awal dari berita unverified harus memiliki status archiveVerdict: DIPANTAU', () => {
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

await runTest('ARC-02', 'Berita yang diarsipkan tidak boleh langsung otomatis terindikasi Hoaks', () => {
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

await runTest('ARC-03', 'syncArchivedItemsWithRadar otomatis mengubah status menjadi FAKTA saat rujukan resmi terbit', () => {
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

await runTest('ARC-04', 'syncArchivedItemsWithRadar otomatis mengubah status menjadi HOAKS saat bukti manipulasi terdeteksi', () => {
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

await runTest('ARC-05', 'setArchivedVerdict menetapkan manual override yang kebal dari radar conflicting overwrite', () => {
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

await runTest('ARC-06', 'Reset Pantau mengembalikan status ke DIPANTAU dan mengaktifkan kembali auto-sync radar', () => {
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

await runTest('ARC-07', 'unarchiveIssue dan toggleArchive menghapus item dari repositori arsip secara bersih', () => {
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
console.log('\n─── Gate 5: Integritas Halaman Berita Tersemat, Radar & Navigasi Sematkan ───')

await runTest('ARC-08', 'File src/pages/Archive.tsx mengimplementasikan Konsol Berita Tersemat secara lengkap & Analyzer.tsx terhapus total', () => {
  const archiveSrc = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'Archive.tsx'), 'utf-8')

  assert.ok(archiveSrc.includes('KONSOL BERITA TERSEMAT'), 'Judul konsol berita tersemat harus ada')
  assert.ok(archiveSrc.includes('TOTAL BERITA TERSEMAT'), 'Kotak metrik total harus ada')
  assert.ok(archiveSrc.includes('MENUNGGU VERIFIKASI (DIPANTAU)'), 'Kotak metrik sedang dipantau harus ada')
  assert.ok(archiveSrc.includes('TERVERIFIKASI FAKTA RESMI'), 'Kotak metrik fakta harus ada')
  assert.ok(archiveSrc.includes('TERINDIKASI HOAKS'), 'Kotak metrik hoaks harus ada')
  assert.ok(archiveSrc.includes('steel-chassis-card'), 'Harus konsisten menggunakan tema steel-chassis-card')
  assert.ok(archiveSrc.includes('setArchivedVerdict'), 'Harus menyediakan tombol aksi penetapan status analis')
  assert.ok(archiveSrc.includes('unarchiveIssue'), 'Harus menyediakan tombol Lepas Sematan')
  assert.ok(!fs.existsSync(path.join(rootDir, 'src', 'pages', 'Analyzer.tsx')), 'Analyzer.tsx harus sudah dihapus total')
  assert.ok(!fs.existsSync(path.join(rootDir, 'src', 'components', 'OCRUploader.tsx')), 'OCRUploader.tsx harus sudah dihapus total')
})

await runTest('ARC-09', 'LiveRadar.tsx menyediakan tombol SEMATKAN / TERSEMAT dan kontrol penyembunyian berita tersemat agar radar clean', () => {
  const radarSrc = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'LiveRadar.tsx'), 'utf-8')

  assert.ok(radarSrc.includes('SEMATKAN'), 'Tombol SEMATKAN harus ada di kartu radar')
  assert.ok(radarSrc.includes('TERSEMAT'), 'Label status TERSEMAT harus ada')
  assert.ok(radarSrc.includes('hideArchivedInRadar'), 'Mekanisme penyaringan isu pantauan harus ada')
  assert.ok(radarSrc.includes('BERITA TERSEMAT DISEMBUNYIKAN'), 'Tombol toolbar kontrol visibilitas berita tersemat harus ada')
  assert.ok(radarSrc.includes('syncArchivedItemsWithRadar'), 'LiveRadar harus memanggil syncArchivedItemsWithRadar saat data masuk')
})

await runTest('ARC-10', 'App.tsx, TacticalTopBar.tsx, dan Dashboard.tsx telah mengadopsi Sematkan & Berita Tersemat dengan urutan menu yang tepat', () => {
  const appSrc = fs.readFileSync(path.join(rootDir, 'src', 'App.tsx'), 'utf-8')
  const topBarSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'TacticalTopBar.tsx'), 'utf-8')
  const dashSrc = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'Dashboard.tsx'), 'utf-8')

  assert.ok(appSrc.includes("label: 'Berita Tersemat'") || appSrc.includes("label: 'Sematkan'"), 'Menu di sidebar harus berlabel Berita Tersemat atau Sematkan')
  assert.ok(appSrc.includes("to: '/archive'"), 'Rute harus mengarah ke /archive')

  // Verifikasi urutan: Radar Situasional -> Berita Tersemat -> Analisa Postingan Medsos
  const radarIdx = appSrc.indexOf("to: '/radar'")
  const archiveIdx = appSrc.indexOf("to: '/archive'")
  const socialIdx = appSrc.indexOf("to: '/social-forensic'")
  assert.ok(radarIdx !== -1 && archiveIdx !== -1 && socialIdx !== -1, 'Semua rute modul utama harus terdaftar di NAV_ITEMS')
  assert.ok(radarIdx < archiveIdx, 'Menu Berita Tersemat harus diposisikan di bawah Radar Situasional')
  assert.ok(archiveIdx < socialIdx, 'Menu Analisa Postingan Medsos harus diposisikan di bawah Berita Tersemat')

  assert.ok(!appSrc.includes("Multi Input anlyzer"), 'Label lama Multi Input analyzer harus sudah dihapus')
  assert.ok(topBarSrc.includes('BERITA TERSEMAT'), 'TacticalTopBar harus menampilkan judul Berita Tersemat')
  assert.ok(dashSrc.includes('1. Berita Tersemat'), 'Dashboard Tactical Quick Launchpad harus berlabel 1. Berita Tersemat')
  assert.ok(!dashSrc.includes('Multi-Input Analyzer'), 'Multi-Input Analyzer harus bersih dari Dashboard')
})

// ─── GATE 6: SPRINT 14 ENGINE HARDENING — SEMANTIC MATCHING & MULTI-DAY RECONCILE ───
console.log('\n─── Gate 6: Sprint 14 Engine Hardening (Semantic Matching & Multi-Day Reconcile) ───')

await runTest('ARC-11', 'syncArchivedItemsWithRadar otomatis mengubah status menjadi HOAKS melalui Semantic Claim Matching meskipun ID berbeda', () => {
  // Simulasikan berita disematkan analis saat masih belum terverifikasi
  const pinnedNewsItem = {
    id: 'CLUST-POLI-99214a',
    claim: 'Megawati dan Prabowo deklarasi koalisi darurat nasional bubarkan kabinet',
    cluster: 'POLITIK_NEGARA',
    verdict: 'UNVERIFIED',
    clarification: 'Isu beredar di ruang publik digital tanpa konfirmasi.',
    officialSource: 'Medsos X',
    sourceUrl: 'https://twitter.com/anon/status/123456789'
  }

  archiveIssue(pinnedNewsItem)

  let entries = getArchivedEntries()
  let pinned = entries.find(e => e.id === 'CLUST-POLI-99214a')
  assert.ok(pinned)
  assert.equal(pinned.archiveVerdict, 'DIPANTAU', 'Status awal harus DIPANTAU')

  // Beberapa waktu kemudian, TurnBackHoax menerbitkan artikel sanggahan dengan ID berbeda total!
  const freshFactCheckFeed = [
    {
      id: 'src-tbh-88412b', // ID BEDA TOTAL DARI CLUST-POLI-99214a
      claim: '[SALAH] Megawati dan Prabowo deklarasi koalisi darurat nasional bubarkan kabinet',
      verdict: 'HOAKS',
      clarification: 'Pertemuan rahasia Megawati dan Prabowo adalah hoaks bermotif adu domba politik.',
      officialSource: 'DPP PDI Perjuangan & DPP Gerindra',
      sourceUrl: 'https://turnbackhoax.id/2026/11/13/salah-megawati-prabowo-koalisi-darurat/'
    }
  ]

  // Jalankan syncArchivedItemsWithRadar
  syncArchivedItemsWithRadar(freshFactCheckFeed)

  entries = getArchivedEntries()
  pinned = entries.find(e => e.id === 'CLUST-POLI-99214a')
  assert.ok(pinned)
  assert.equal(pinned.archiveVerdict, 'HOAKS', 'Status berita tersemat HARUS otomatis berubah menjadi HOAKS via Semantic Matching!')
  assert.ok(pinned.clarification.includes('adu domba politik'), 'Naskah klarifikasi harus dimutakhirkan dengan data cek fakta')
  assert.equal(pinned.officialSource, 'DPP PDI Perjuangan & DPP Gerindra')
})

await runTest('ARC-12', 'reconcileArchivedItems otomatis memperbarui berita tersemat dari hari lampau (10 Nov) ke HOAKS/FAKTA per 13 Nov', async () => {
  // Simulasikan berita disematkan pada 10 Nov (sudah tidak ada di feed radar hari ini)
  const oldPinnedItem = {
    id: 'CLUST-SIBE-10NOV-001',
    claim: 'KPU akui ada kecurangan algoritma pemilu dan membatalkan hasil pilpres',
    cluster: 'SIBER_PERETASAN',
    verdict: 'UNVERIFIED',
    clarification: 'Isu beredar di grup percakapan digital.',
    officialSource: 'Grup WhatsApp',
    sourceUrl: 'https://wa.me/xyz'
  }

  archiveIssue(oldPinnedItem)

  let entries = getArchivedEntries()
  let oldItem = entries.find(e => e.id === 'CLUST-SIBE-10NOV-001')
  assert.ok(oldItem)
  assert.equal(oldItem.archiveVerdict, 'DIPANTAU')

  // Korpus cek fakta lengkap yang baru saja berhasil dihimpun sistem per 13 Nov
  const completeCorpus = [
    {
      id: 'tbh-kpu-final-2026',
      claim: '[DISINFORMASI] KPU Membatalkan Hasil Pilpres Karena Kecurangan Algoritma',
      verdict: 'HOAKS',
      clarification: 'Klaim bahwa KPU membatalkan hasil Pilpres adalah disinformasi. Putusan MK telah final dan mengikat.',
      officialSource: 'Komisi Pemilihan Umum RI',
      sourceUrl: 'https://turnbackhoax.id/2026/11/12/kpu-algoritma-pilpres/'
    }
  ]

  // Jalankan reconcileArchivedItems
  const result = await reconcileArchivedItems(completeCorpus)
  assert.ok(result.updatedCount >= 1, 'Harus mencatat minimal 1 item yang berhasil direkonsiliasi')

  entries = getArchivedEntries()
  oldItem = entries.find(e => e.id === 'CLUST-SIBE-10NOV-001')
  assert.ok(oldItem)
  assert.equal(oldItem.archiveVerdict, 'HOAKS', 'Berita tersemat 10 Nov HARUS otomatis berubah statusnya menjadi HOAKS!')
  assert.ok(oldItem.clarification.includes('Putusan MK'), 'Klarifikasi resmi harus terpasang di berita tersemat')
})

// ─── GATE 7: INTEGRITAS SUMBER RUJUKAN & PERLINDUNGAN ANTI-KONTAMINASI DATA ───
console.log('\n─── Gate 7: Integritas Sumber Rujukan & Anti-Kontaminasi Link (Kasus Wapres Gibran) ───')

await runTest('ARC-13', 'areClaimsSemanticallyMatching menolak pencocokan antara klaim viral dengan artikel wacana hukum umum', () => {
  const viralClaim = 'Usai ajukan pengunduran diri, Gibran tinggalkan Istana Wakil Presiden'
  const ministryArticle = 'Menko Yusril: Pengunduran Diri Wakil Presiden Gibran Tidak Memerlukan Persetujuan MPR'

  const isMatched = areClaimsSemanticallyMatching(viralClaim, ministryArticle)
  assert.equal(isMatched, false, 'Klaim viral TIDAK BOLEH mencocokkan wacana ketatanegaraan umum Menko Yusril!')
})

await runTest('ARC-14', 'reconcileArchivedItems memulihkan entri terkontaminasi kumham-imipas ke rujukan resmi TurnBackHoax & Setwapres', async () => {
  global.localStorage.clear()

  // Simulasikan data tersimpan yang sebelumnya tercemar URL umum
  const contaminatedItem = {
    id: 'PIN-GIBRAN-001',
    claim: 'Usai ajukan pengunduran diri, Gibran tinggalkan Istana Wakil Presiden',
    cluster: 'POLITIK_NEGARA',
    archiveVerdict: 'HOAKS',
    verdict: 'HOAKS',
    officialSource: 'kumham-imipas.go.id',
    sourceUrl: 'https://kumham-imipas.go.id/ruang-berita/berita-list/menko-yusril-pengunduran-diri-wakil-presiden-gibran-tidak-memerlukan-persetujuan-mpr',
    clarification: '',
    archivedAt: '12 Nov 2026, 20:01 WIB',
    archivedTimestamp: 1794500000000,
    isManualOverride: false
  }

  const rawData = { 'PIN-GIBRAN-001': contaminatedItem }
  const rawIds = ['PIN-GIBRAN-001']
  const rawVerdicts = { 'PIN-GIBRAN-001': 'HOAKS' }

  global.localStorage.setItem('narada_archived_items_data', JSON.stringify(rawData))
  global.localStorage.setItem('narada_archived_issues', JSON.stringify(rawIds))
  global.localStorage.setItem('narada_archived_classifications', JSON.stringify(rawVerdicts))

  // Muat entri resmi dari database
  const debunkDb = JSON.parse(fs.readFileSync(path.join(rootDir, 'src', 'engine', 'data', 'debunk-database.json'), 'utf-8'))
  const result = await reconcileArchivedItems(debunkDb)
  assert.ok(result.updatedCount >= 1, 'Self-healing harus mendeteksi dan memperbarui entri terkontaminasi')

  const entries = getArchivedEntries()
  const healed = entries.find(e => e.id === 'PIN-GIBRAN-001')
  assert.ok(healed)
  assert.equal(healed.archiveVerdict, 'HOAKS')
  assert.ok(!healed.sourceUrl.includes('kumham-imipas.go.id'), 'URL kumham-imipas HARUS dibersihkan total!')
  assert.ok(healed.sourceUrl.includes('turnbackhoax.id'), 'URL rujukan HARUS mengarah ke TurnBackHoax / Cek Fakta resmi!')
  assert.ok(healed.officialSource.includes('Setwapres') || healed.officialSource.includes('TurnBackHoax'), 'Sumber resmi harus mencantumkan Setwapres / TurnBackHoax!')
  assert.ok(healed.clarification.includes('Wali Kota Surakarta') || healed.clarification.includes('16 Juli 2024'), 'Klarifikasi harus menjelaskan konteks rekaman video lama di Solo!')
})

// ─── GATE 8: ACTIVE EVIDENCE PROBER & EVIDENCE SUFFICIENCY ENGINE (ARC-15, ARC-16, ARC-17) ───
console.log('\n─── Gate 8: Active Intelligence Evidence Prober & Sufficiency Engine ───')

await runTest('ARC-15', 'probeEvidenceForArchivedItem otomatis menelusuri bukti dan mengklasifikasikan ke HOAKS dengan 100% sufficiency jika bukti cocok', async () => {
  global.localStorage.clear()

  // Simulasikan berita yang baru disematkan dengan status DIPANTAU
  const unverifiedClaim = {
    id: 'PIN-CLAIM-001',
    claim: 'Wapres Gibran Rakabuming Raka mengundurkan diri dan tinggalkan istana',
    cluster: 'POLITIK_NEGARA',
    archiveVerdict: 'DIPANTAU',
    verdict: 'UNVERIFIED',
    clarification: 'Menunggu konfirmasi Setwapres',
    officialSource: 'Pemantauan Arus Informasi',
    sourceUrl: 'https://example.com/viral-gibran',
    archivedAt: '13 Nov 2026, 10:00 WIB',
    archivedTimestamp: Date.now(),
    isManualOverride: false
  }

  const rawData = { 'PIN-CLAIM-001': unverifiedClaim }
  const rawIds = ['PIN-CLAIM-001']
  const rawVerdicts = { 'PIN-CLAIM-001': 'DIPANTAU' }

  global.localStorage.setItem('narada_archived_items_data', JSON.stringify(rawData))
  global.localStorage.setItem('narada_archived_issues', JSON.stringify(rawIds))
  global.localStorage.setItem('narada_archived_classifications', JSON.stringify(rawVerdicts))

  // Muat referensi basis pengetahuan kurasi
  const debunkDb = JSON.parse(fs.readFileSync(path.join(rootDir, 'src', 'engine', 'data', 'debunk-database.json'), 'utf-8'))

  // Jalankan investigasi aktif untuk entri ini
  const probeResult = await probeEvidenceForArchivedItem('PIN-CLAIM-001', undefined, debunkDb)

  assert.equal(probeResult.status, 'RESOLVED')
  assert.equal(probeResult.verdict, 'HOAKS')
  assert.equal(probeResult.evidenceSufficiency, 100, 'Kecukupan bukti harus mencapai 100% jika rujukan resmi ditemukan')
  assert.ok(probeResult.evidenceSummary.includes('Bukti Terverifikasi 100%'))
  assert.ok(probeResult.matchedSource.includes('TurnBackHoax') || probeResult.matchedSource.includes('Setwapres'))

  // Verifikasi penyimpanan lokal juga terupdate secara otomatis
  const entries = getArchivedEntries()
  const updatedItem = entries.find(e => e.id === 'PIN-CLAIM-001')
  assert.ok(updatedItem)
  assert.equal(updatedItem.archiveVerdict, 'HOAKS')
  assert.equal(updatedItem.evidenceSufficiency, 100)
  assert.ok(updatedItem.lastProbedAt)
})

await runTest('ARC-16', 'probeEvidenceForArchivedItem mempertahankan status DIPANTAU dan menghitung kecukupan data jika bukti belum konklusif', async () => {
  global.localStorage.clear()

  // Berita unverified yang belum ada bantahan resmi di database cek fakta
  const freshUnverifiedClaim = {
    id: 'PIN-UNKNOWN-999',
    claim: 'Klaim penampakan formasi helikopter tak dikenal terbang rendah di atas perairan terpencil',
    cluster: 'PERTAHANAN_MILITER',
    archiveVerdict: 'DIPANTAU',
    verdict: 'UNVERIFIED',
    clarification: 'Sedang dihimpun intelijen lokal',
    officialSource: 'Pemantauan Visual Babinsa',
    sourceUrl: 'https://example.com/penampakan-heli',
    archivedAt: '13 Nov 2026, 11:00 WIB',
    archivedTimestamp: Date.now(),
    isManualOverride: false
  }

  const rawData = { 'PIN-UNKNOWN-999': freshUnverifiedClaim }
  const rawIds = ['PIN-UNKNOWN-999']
  const rawVerdicts = { 'PIN-UNKNOWN-999': 'DIPANTAU' }

  global.localStorage.setItem('narada_archived_items_data', JSON.stringify(rawData))
  global.localStorage.setItem('narada_archived_issues', JSON.stringify(rawIds))
  global.localStorage.setItem('narada_archived_classifications', JSON.stringify(rawVerdicts))

  // Muat referensi basis pengetahuan kurasi
  const debunkDb = JSON.parse(fs.readFileSync(path.join(rootDir, 'src', 'engine', 'data', 'debunk-database.json'), 'utf-8'))

  // Jalankan investigasi aktif
  const probeResult = await probeEvidenceForArchivedItem('PIN-UNKNOWN-999', undefined, debunkDb)

  assert.equal(probeResult.status, 'STILL_MONITORING')
  assert.equal(probeResult.verdict, 'DIPANTAU', 'Status WAJIB tetap DIPANTAU bila bukti belum cukup, DILARANG klaim asal!')
  assert.ok(probeResult.evidenceSufficiency < 65, 'Kecukupan bukti belum mencapai ambang batas konfirmasi')
  assert.ok(probeResult.evidenceSummary.includes('belum menemukan rujukan') || probeResult.evidenceSummary.includes('DIPANTAU'))

  // Verifikasi di data store
  const entries = getArchivedEntries()
  const currentItem = entries.find(e => e.id === 'PIN-UNKNOWN-999')
  assert.ok(currentItem)
  assert.equal(currentItem.archiveVerdict, 'DIPANTAU')
  assert.ok(currentItem.evidenceSufficiency <= 55)
  assert.ok(currentItem.lastProbedAt)
})

await runTest('ARC-17', 'probeAllUnverifiedArchivedItems menjalankan investigasi massal seluruh berita tersemat yang masih unverified', async () => {
  global.localStorage.clear()

  const items = {
    'ITEM-A': {
      id: 'ITEM-A',
      claim: 'Wapres Gibran ajukan pengunduran diri dan tinggalkan istana',
      archiveVerdict: 'DIPANTAU',
      verdict: 'UNVERIFIED',
      archivedTimestamp: Date.now() - 5000,
      isManualOverride: false
    },
    'ITEM-B': {
      id: 'ITEM-B',
      claim: 'Klaim sebaran ranjau laut di selat sunda oleh kapal misterius',
      archiveVerdict: 'DIPANTAU',
      verdict: 'UNVERIFIED',
      archivedTimestamp: Date.now() - 3000,
      isManualOverride: false
    },
    'ITEM-C': {
      id: 'ITEM-C',
      claim: 'Isu kenaikan tunjangan prajurit TNI batal dilaksanakan',
      archiveVerdict: 'FAKTA', // Sudah ada vonis oleh analis
      verdict: 'FAKTA',
      archivedTimestamp: Date.now() - 1000,
      isManualOverride: true
    }
  }

  global.localStorage.setItem('narada_archived_items_data', JSON.stringify(items))
  global.localStorage.setItem('narada_archived_issues', JSON.stringify(['ITEM-A', 'ITEM-B', 'ITEM-C']))
  global.localStorage.setItem('narada_archived_classifications', JSON.stringify({
    'ITEM-A': 'DIPANTAU',
    'ITEM-B': 'DIPANTAU',
    'ITEM-C': 'FAKTA'
  }))

  const debunkDb = JSON.parse(fs.readFileSync(path.join(rootDir, 'src', 'engine', 'data', 'debunk-database.json'), 'utf-8'))
  const batchSummary = await probeAllUnverifiedArchivedItems(undefined, debunkDb)

  assert.equal(batchSummary.totalProbed, 2, 'Hanya memindai 2 item yang berstatus DIPANTAU (ITEM-C dilewati karena manual override/resolved)')
  assert.equal(batchSummary.updatedCount, 1, 'ITEM-A berhasil di-resolve ke HOAKS karena cocok dengan database debunk')
  assert.equal(batchSummary.stillMonitoringCount, 1, 'ITEM-B tetap dalam pantauan karena bukti belum konklusif')

  const entries = getArchivedEntries()
  const itemA = entries.find(e => e.id === 'ITEM-A')
  const itemB = entries.find(e => e.id === 'ITEM-B')
  const itemC = entries.find(e => e.id === 'ITEM-C')

  assert.equal(itemA.archiveVerdict, 'HOAKS')
  assert.equal(itemB.archiveVerdict, 'DIPANTAU')
  assert.equal(itemC.archiveVerdict, 'FAKTA')
})

// ─── GATE 9: PROVENANCE SUMBER BERITA DIAMBIL & INDIKATOR PENGHAPUSAN (BUKTI BUKAN FIKTIF) ───
console.log('\n─── Gate 9: Provenance Sumber Berita Diambil & Indikator Takedown / Dihapus ───')

await runTest('ARC-18', 'setOriginalSourceStatus dan toggleOriginalSourceStatus mengelola status keaktifan sumber asal', () => {
  global.localStorage.clear()
  const mockItem = {
    id: 'ITEM-SRC-01',
    claim: 'Klaim viral surat edaran penipuan bantuan',
    originalPlatform: 'X (Twitter) - Akun Publik @anon_leaks',
    originalSourceUrl: 'https://twitter.com/anon_leaks/status/18567291',
    officialSource: 'Dispenad',
    sourceUrl: 'https://tniad.mil.id/cek-fakta'
  }
  archiveIssue(mockItem)

  let entries = getArchivedEntries()
  const item = entries.find(e => e.id === 'ITEM-SRC-01')
  assert.ok(item, 'Item harus tersimpan di arsip')
  assert.equal(item.originalPlatform, 'X (Twitter) - Akun Publik @anon_leaks')
  assert.equal(isOriginalSourceDeleted(item), false, 'Status awal harus ACTIVE')

  // Operator menandai tautan dihapus oleh pemilik akun
  setOriginalSourceStatus('ITEM-SRC-01', 'DELETED', 'Postingan dihapus oleh pemilik akun')
  entries = getArchivedEntries()
  const updatedItem = entries.find(e => e.id === 'ITEM-SRC-01')
  assert.equal(updatedItem.originalSourceStatus, 'DELETED')
  assert.equal(isOriginalSourceDeleted(updatedItem), true)
  assert.equal(updatedItem.originalPlatform, 'X (Twitter) - Akun Publik @anon_leaks', 'Nama sumber asal HARUS TETAP ADA!')

  // Toggle kembali ke aktif
  toggleOriginalSourceStatus('ITEM-SRC-01')
  entries = getArchivedEntries()
  const toggledItem = entries.find(e => e.id === 'ITEM-SRC-01')
  assert.equal(toggledItem.originalSourceStatus, 'ACTIVE')
  assert.equal(isOriginalSourceDeleted(toggledItem), false)
})

await runTest('ARC-19', 'getDisplayOriginPlatform dan isOriginalSourceDeleted mengidentifikasi sumber asal dan URL takedown', () => {
  const itemWithExplicitPlatform = {
    originalPlatform: 'Pusat Operasi Keamanan Siber',
    originalSourceUrl: 'https://bssn.go.id/news/1'
  }
  assert.equal(getDisplayOriginPlatform(itemWithExplicitPlatform), 'Pusat Operasi Keamanan Siber')

  const itemFromXUrl = {
    originalSourceUrl: 'https://x.com/viral_post/status/999'
  }
  assert.equal(getDisplayOriginPlatform(itemFromXUrl), 'X (Twitter) - Akun Publik')

  const itemTakedownUrl = {
    originalSourceUrl: 'https://tiktok.com/@buzzer/video/123-takedown'
  }
  assert.equal(isOriginalSourceDeleted(itemTakedownUrl), true, 'URL bertanda takedown harus terdeteksi dihapus')
})

await runTest('ARC-20', 'Archive.tsx menyertakan nama sumber berita diambil, indikator takedown, dan penjelasan bukan fiktif', () => {
  const archivePageSrc = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'Archive.tsx'), 'utf-8')
  assert.ok(archivePageSrc.includes('SUMBER BERITA DIAMBIL:'), 'Archive.tsx harus memiliki header SUMBER BERITA DIAMBIL:')
  assert.ok(archivePageSrc.includes('SUMBER ASAL TELAH DIHAPUS / TAKEDOWN'), 'Archive.tsx harus memuat lencana takedown')
  assert.ok(archivePageSrc.includes('BUKTI FORENSIK AUTENTIK (BUKAN DATA FIKTIF):'), 'Archive.tsx harus memuat penjelasan bukti bukan fiktif')
  assert.ok(archivePageSrc.includes('toggleOriginalSourceStatus'), 'Archive.tsx harus memuat tombol toggle status sumber')
  assert.ok(archivePageSrc.includes('originPlatform'), 'Archive.tsx harus menampilkan nama platform sumber')
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
