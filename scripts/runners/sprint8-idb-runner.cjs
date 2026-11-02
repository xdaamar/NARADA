/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — MASTER SPRINT 8 REAL CHROMIUM INDEXEDDB RUNNER
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 */

const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

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

app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-gpu')

app.whenReady().then(async () => {
  console.log('══════════════════════════════════════════════════════════════════════')
  console.log('🛡️  NARADA — REAL CHROMIUM INDEXEDDB SUITE (Sprint 8 LevelDB Backend)')
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

  const testScript = `
    (async () => {
      const results = []
      function record(passed, msg) {
        results.push({ passed, msg })
      }

      try {
        const DB_NAME = 'narada_tactical_db'
        const DB_VERSION = 4

        // 1. Verifikasi ketersediaan IndexedDB asli Chromium
        record(typeof window.indexedDB !== 'undefined', '[S8-IDB.1] window.indexedDB terpasang di engine Chromium')
        record(window.indexedDB.constructor.name === 'IDBFactory', '[S8-IDB.2] IDBFactory asli terkonfirmasi (Blink LevelDB backend)')

        // 2. Pembukaan database dan migrasi ke Versi 4
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
              'evidence_artifacts',
              'comment_batches',
              'comment_records',
              'comment_analysis_runs',
              'comment_review_annotations'
            ]

            for (const storeName of requiredStores) {
              if (!existingStores.has(storeName)) {
                if (storeName === 'comment_batches') {
                  const st = upgradedDb.createObjectStore(storeName, { keyPath: 'id' })
                  st.createIndex('caseId', 'caseId', { unique: false })
                  st.createIndex('createdAt', 'createdAt', { unique: false })
                } else if (storeName === 'comment_records') {
                  const st = upgradedDb.createObjectStore(storeName, { keyPath: 'id' })
                  st.createIndex('batchId', 'batchId', { unique: false })
                  st.createIndex('caseId', 'caseId', { unique: false })
                } else if (storeName === 'comment_analysis_runs') {
                  const st = upgradedDb.createObjectStore(storeName, { keyPath: 'id' })
                  st.createIndex('batchId', 'batchId', { unique: false })
                  st.createIndex('caseId', 'caseId', { unique: false })
                } else if (storeName === 'comment_review_annotations') {
                  const st = upgradedDb.createObjectStore(storeName, { keyPath: 'id' })
                  st.createIndex('runId', 'runId', { unique: false })
                  st.createIndex('caseId', 'caseId', { unique: false })
                } else {
                  upgradedDb.createObjectStore(storeName, { keyPath: 'id' })
                }
              }
            }
          }
          openReq.onsuccess = () => resolve(openReq.result)
          openReq.onerror = () => reject(openReq.error)
        })

        record(db.version === DB_VERSION, '[S8-IDB.3] Versi database tepat v' + DB_VERSION)
        const storeNames = Array.from(db.objectStoreNames)
        record(storeNames.includes('comment_batches'), '[S8-IDB.4] Object store comment_batches terbentuk')
        record(storeNames.includes('comment_records'), '[S8-IDB.5] Object store comment_records terbentuk')
        record(storeNames.includes('comment_analysis_runs'), '[S8-IDB.6] Object store comment_analysis_runs terbentuk')
        record(storeNames.includes('comment_review_annotations'), '[S8-IDB.7] Object store comment_review_annotations terbentuk')

        // 3. Uji Simpan Comment Batch
        const mockBatch = {
          id: 'BAT-REAL-IDB-001',
          caseId: 'CASE-CHROMIUM-TEST',
          batchLabel: 'Batch Uji Real Chromium LevelDB',
          intakeMethod: 'MANUAL_ENTRY',
          createdAt: new Date().toISOString(),
          totalRecordsCount: 2,
          acceptedRecordsCount: 2,
          rejectedRecordsCount: 0,
          exactDuplicatesCount: 0,
          schemaVersion: 1,
          status: 'ACTIVE'
        }
        const batchTx = db.transaction(['comment_batches'], 'readwrite')
        batchTx.objectStore('comment_batches').put(mockBatch)
        await new Promise((res, rej) => {
          batchTx.oncomplete = res
          batchTx.onerror = rej
        })
        record(true, '[S8-IDB.8] Transaksi penulisan comment_batches berhasil')

        // 4. Uji Simpan Comment Record
        const mockRecord = {
          id: 'CR-REAL-IDB-001',
          batchId: 'BAT-REAL-IDB-001',
          caseId: 'CASE-CHROMIUM-TEST',
          rawText: 'Komentar pengujian real Chromium IndexedDB',
          normalizedText: 'komentar pengujian real chromium indexeddb',
          validationState: 'VALID',
          isTimestampAmbiguous: false,
          contentDigest: 'deadbeef12345678',
          characterCount: 42,
          tokenCount: 5
        }
        const recTx = db.transaction(['comment_records'], 'readwrite')
        recTx.objectStore('comment_records').put(mockRecord)
        await new Promise((res, rej) => {
          recTx.oncomplete = res
          recTx.onerror = rej
        })
        record(true, '[S8-IDB.9] Transaksi penulisan comment_records berhasil')

        // 5. Uji Simpan Analysis Run
        const mockRun = {
          id: 'RUN-REAL-IDB-001',
          batchId: 'BAT-REAL-IDB-001',
          caseId: 'CASE-CHROMIUM-TEST',
          createdAt: new Date().toISOString(),
          algorithmVersion: '1.0.0',
          status: 'COMPLETED'
        }
        const runTx = db.transaction(['comment_analysis_runs'], 'readwrite')
        runTx.objectStore('comment_analysis_runs').put(mockRun)
        await new Promise((res, rej) => {
          runTx.oncomplete = res
          runTx.onerror = rej
        })
        record(true, '[S8-IDB.10] Transaksi penulisan comment_analysis_runs berhasil')

        // 6. Uji Simpan Review Annotation
        const mockAnnotation = {
          id: 'REV-REAL-IDB-001',
          caseId: 'CASE-CHROMIUM-TEST',
          runId: 'RUN-REAL-IDB-001',
          targetType: 'COMMENT',
          targetId: 'CR-REAL-IDB-001',
          reviewStatus: 'CONFIRMED_SIGNAL',
          reviewerNote: 'Catatan analis real IndexedDB',
          reviewedAt: new Date().toISOString()
        }
        const revTx = db.transaction(['comment_review_annotations'], 'readwrite')
        revTx.objectStore('comment_review_annotations').put(mockAnnotation)
        await new Promise((res, rej) => {
          revTx.oncomplete = res
          revTx.onerror = rej
        })
        record(true, '[S8-IDB.11] Transaksi penulisan comment_review_annotations berhasil')

        // 7. Tutup dan buka kembali untuk membuktikan durabilitas
        db.close()

        const reopenReq = window.indexedDB.open(DB_NAME, DB_VERSION)
        const reopenedDb = await new Promise((resolve, reject) => {
          reopenReq.onsuccess = () => resolve(reopenReq.result)
          reopenReq.onerror = () => reject(reopenReq.error)
        })

        const readTx = reopenedDb.transaction(['comment_batches', 'comment_records'], 'readonly')
        const getBatchReq = readTx.objectStore('comment_batches').get('BAT-REAL-IDB-001')
        const getRecReq = readTx.objectStore('comment_records').get('CR-REAL-IDB-001')

        const [readBatch, readRec] = await Promise.all([
          new Promise((res) => { getBatchReq.onsuccess = () => res(getBatchReq.result) }),
          new Promise((res) => { getRecReq.onsuccess = () => res(getRecReq.result) })
        ])

        record(readBatch && readBatch.id === 'BAT-REAL-IDB-001', '[S8-IDB.12] Batch komentar bertahan setelah reopen (Durable LevelDB)')
        record(readRec && readRec.id === 'CR-REAL-IDB-001', '[S8-IDB.13] Record komentar bertahan setelah reopen (Durable LevelDB)')

        reopenedDb.close()

        return { success: true, results }
      } catch (err) {
        return { success: false, error: err.message, results }
      }
    })()
  `

  const testHtmlPath = path.join(__dirname, 'test-s8-idb-runner.html')
  fs.writeFileSync(testHtmlPath, '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><h1>NARADA S8 IDB Test</h1></body></html>')

  await win.loadFile(testHtmlPath)
  const execution = await win.webContents.executeJavaScript(testScript)

  try {
    fs.unlinkSync(testHtmlPath)
  } catch {}

  for (const r of execution.results) {
    logAssert(r.passed, r.msg)
  }

  if (!execution.success) {
    console.error('Fatal execution error inside Chromium:', execution.error)
    failedAssertions++
  }

  console.log('\n══════════════════════════════════════════════════════════════════════')
  console.log(`🏁 REAL CHROMIUM INDEXEDDB RESULTS: ${passedAssertions} / ${totalAssertions} PASS (${Math.round((passedAssertions / totalAssertions) * 100)}%)`)
  console.log('══════════════════════════════════════════════════════════════════════\n')

  app.exit(failedAssertions > 0 ? 1 : 0)
})
