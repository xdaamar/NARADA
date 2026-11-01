/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — REAL CHROMIUM INDEXEDDB INTEGRATION RUNNER (Sprint 7 WP6 - Carry-over 8.2)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * Berjalan langsung di dalam proses Chromium Electron asli, BUKAN fake-indexeddb
 * atau memory fallback Node.js.
 * ══════════════════════════════════════════════════════════════════════════
 */

const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

let totalAssertions = 0
let passedAssertions = 0
let failedAssertions = 0

function logAssert(passed, message) {
  totalAssertions++
  if (passed) {
    passedAssertions++
    console.log(`  ✅ PASS: ${message}`)
  } else {
    failedAssertions++
    console.error(`  ❌ FAIL: ${message}`)
  }
}

app.whenReady().then(async () => {
  console.log('══════════════════════════════════════════════════════════════════════')
  console.log('🛡️  NARADA — REAL CHROMIUM INDEXEDDB INTEGRATION SUITE (Carry-Over 8.2)')
  console.log(`🌐 Chromium Engine: v${process.versions.chrome} | Electron: v${process.versions.electron}`)
  console.log('══════════════════════════════════════════════════════════════════════\n')

  const win = new BrowserWindow({
    show: false,
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  // Script pengujian IndexedDB nyata yang dieksekusi di konteks render browser Chromium
  const testScript = `
    (async () => {
      const results = []
      function record(passed, msg) {
        results.push({ passed, msg })
      }

      try {
        const DB_NAME = 'narada_tactical_db'
        const DB_VERSION = 3

        // 1. Verifikasi ketersediaan IndexedDB asli Chromium
        record(typeof window.indexedDB !== 'undefined', '[S7-IDB.1] window.indexedDB terpasang di engine Chromium')
        record(window.indexedDB.constructor.name === 'IDBFactory', '[S7-IDB.2] IDBFactory asli terkonfirmasi (Blink backend)')

        // 2. Pembukaan database dan migrasi ke Versi 3
        const openReq = window.indexedDB.open(DB_NAME, DB_VERSION)

        const db = await new Promise((resolve, reject) => {
          openReq.onupgradeneeded = (event) => {
            const upgradedDb = openReq.result
            const existingStores = new Set(Array.from(upgradedDb.objectStoreNames))

            const requiredStores = [
              'radar_sync_state',
              'radar_sources',
              'radar_issue_snapshots',
              'topic_candidate_history',
              'evidence_records',
              'evidence_artifacts'
            ]

            for (const storeName of requiredStores) {
              if (!existingStores.has(storeName)) {
                if (storeName === 'evidence_records') {
                  const evStore = upgradedDb.createObjectStore(storeName, { keyPath: 'id' })
                  evStore.createIndex('caseId', 'caseId', { unique: false })
                  evStore.createIndex('extractionMethod', 'extractionMethod', { unique: false })
                } else if (storeName === 'evidence_artifacts') {
                  const artStore = upgradedDb.createObjectStore(storeName, { keyPath: 'id' })
                  artStore.createIndex('evidenceId', 'evidenceId', { unique: false })
                } else {
                  upgradedDb.createObjectStore(storeName, { keyPath: 'id' })
                }
              }
            }
          }
          openReq.onsuccess = () => resolve(openReq.result)
          openReq.onerror = () => reject(openReq.error)
        })

        record(db.version === DB_VERSION, '[S7-IDB.3] Versi database tepat v' + DB_VERSION)
        const storeNames = Array.from(db.objectStoreNames)
        record(storeNames.includes('evidence_records'), '[S7-IDB.4] Object store evidence_records terbentuk')
        record(storeNames.includes('evidence_artifacts'), '[S7-IDB.5] Object store evidence_artifacts terbentuk')

        // 3. Uji Tulis Rekaman Bukti (evidence_records)
        const mockEvidence = {
          id: 'EVD-REAL-IDB-001',
          caseId: 'CAS-TACTICAL-ALPHA',
          title: 'Klaim Radar Natuna Uji Chromium IDB',
          url: 'https://news.detik.com/berita/uji-idb',
          extractionMethod: 'MANUAL_BROWSER_CAPTURE',
          capturedAt: new Date().toISOString(),
          screenshotSha256: 'a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890',
          integrityStatus: 'VERIFIED'
        }

        const writeTx = db.transaction(['evidence_records'], 'readwrite')
        const writeStore = writeTx.objectStore('evidence_records')
        writeStore.put(mockEvidence)
        await new Promise((res, rej) => {
          writeTx.oncomplete = res
          writeTx.onerror = rej
        })
        record(true, '[S7-IDB.6] Transaksi penulisan rekaman bukti selesai')

        // 4. Uji Tulis Artefak Biner (evidence_artifacts)
        const mockBinaryBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
        const mockArtifact = {
          id: 'ART-REAL-IDB-001',
          evidenceId: 'EVD-REAL-IDB-001',
          artifactType: 'VIEWPORT_SCREENSHOT_PNG',
          data: mockBinaryBytes.buffer,
          sha256: 'a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890',
          createdAt: new Date().toISOString()
        }

        const artTx = db.transaction(['evidence_artifacts'], 'readwrite')
        artTx.objectStore('evidence_artifacts').put(mockArtifact)
        await new Promise((res, rej) => {
          artTx.oncomplete = res
          artTx.onerror = rej
        })
        record(true, '[S7-IDB.7] Transaksi penulisan artefak biner selesai')

        // 5. Uji Baca Rekaman Bukti & Index caseId
        const readTx = db.transaction(['evidence_records'], 'readonly')
        const readStore = readTx.objectStore('evidence_records')
        const readRecord = await new Promise((res, rej) => {
          const req = readStore.get('EVD-REAL-IDB-001')
          req.onsuccess = () => res(req.result)
          req.onerror = rej
        })
        record(readRecord && readRecord.id === 'EVD-REAL-IDB-001', '[S7-IDB.8] Rekaman bukti terbaca kembali secara identik')

        const indexTx = db.transaction(['evidence_records'], 'readonly')
        const caseIndex = indexTx.objectStore('evidence_records').index('caseId')
        const indexedResults = await new Promise((res, rej) => {
          const req = caseIndex.getAll('CAS-TACTICAL-ALPHA')
          req.onsuccess = () => res(req.result)
          req.onerror = rej
        })
        record(indexedResults.length >= 1 && indexedResults[0].id === 'EVD-REAL-IDB-001', '[S7-IDB.9] Query indeks caseId menghasilkan rekaman yang tepat')

        // 6. Uji Baca Artefak Biner
        const readArtTx = db.transaction(['evidence_artifacts'], 'readonly')
        const readArt = await new Promise((res, rej) => {
          const req = readArtTx.objectStore('evidence_artifacts').get('ART-REAL-IDB-001')
          req.onsuccess = () => res(req.result)
          req.onerror = rej
        })
        const readBytes = new Uint8Array(readArt.data)
        const bytesMatch = readBytes.length === 8 && readBytes[0] === 0x89 && readBytes[1] === 0x50
        record(bytesMatch, '[S7-IDB.10] Byte biner screenshot PNG terbaca kembali tanpa korupsi')

        // 7. Tutup koneksi database
        db.close()
        record(true, '[S7-IDB.11] Koneksi database ditutup dengan sukses')

        // 8. Buka kembali (re-open) dan verifikasi data tetap bertahan di disk (LevelDB persistence)
        const reopenReq = window.indexedDB.open(DB_NAME, DB_VERSION)
        const reopenedDb = await new Promise((res, rej) => {
          reopenReq.onsuccess = () => res(reopenReq.result)
          reopenReq.onerror = rej
        })

        const verifyTx = reopenedDb.transaction(['evidence_records'], 'readonly')
        const verifiedRecord = await new Promise((res, rej) => {
          const req = verifyTx.objectStore('evidence_records').get('EVD-REAL-IDB-001')
          req.onsuccess = () => res(req.result)
          req.onerror = rej
        })
        record(verifiedRecord && verifiedRecord.title === 'Klaim Radar Natuna Uji Chromium IDB', '[S7-IDB.12] Data bertahan di disk pasca tutup dan buka kembali (LevelDB persistence)')
        reopenedDb.close()

        return { success: true, results }
      } catch (err) {
        return { success: false, error: err.message, results }
      }
    })()
  `

  const fs = require('fs')
  const testHtmlPath = path.join(__dirname, 'test-idb-runner.html')
  fs.writeFileSync(testHtmlPath, '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><h1>NARADA IDB Test</h1></body></html>')

  await win.loadFile(testHtmlPath)
  const execution = await win.webContents.executeJavaScript(testScript)

  try {
    fs.unlinkSync(testHtmlPath)
  } catch {}

  for (const r of execution.results) {
    logAssert(r.passed, r.msg)
  }

  if (!execution.success) {
    console.error('Fatal execution error:', execution.error)
    failedAssertions++
  }

  console.log('\n══════════════════════════════════════════════════════════════════════')
  console.log(`🏁 REAL CHROMIUM INDEXEDDB RESULTS: ${passedAssertions} / ${totalAssertions} PASS (${Math.round((passedAssertions / totalAssertions) * 100)}%)`)
  console.log('══════════════════════════════════════════════════════════════════════\n')

  app.exit(failedAssertions > 0 ? 1 : 0)
})
