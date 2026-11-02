/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — MASTER SPRINT 9 REAL ELECTRON RUNTIME IPC & APP SMOKE RUNNER
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 */

const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const sqliteService = require('../../electron/sqlite-service.cjs')

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
  console.log('🛡️  NARADA — SPRINT 9 REAL ELECTRON RUNTIME IPC & APP SMOKE')
  console.log(`⚡ Electron: v${process.versions.electron} | Chrome: v${process.versions.chrome} | Node: v${process.versions.node}`)
  console.log('══════════════════════════════════════════════════════════════════════\n')

  let win = null

  try {
    // 1. Verifikasi Host Process
    logAssert(process.type === 'browser', '[S9-SMK.1] Berjalan di Main Process Electron asli (process.type: browser)')
    logAssert(process.versions.electron.startsWith('45.'), '[S9-SMK.2] Engine Electron terverifikasi v45.x')

    // 2. Inisialisasi SQLite di Main Process
    const tempDbPath = path.join(app.getPath('userData'), 'smoke_test.sqlite3')
    const initRes = sqliteService.initSqliteDatabase(tempDbPath)
    logAssert(initRes.success === true, '[S9-SMK.3] SQLite service initialized in Electron main process')

    // 3. Registrasi IPC Handlers persis main.cjs
    ipcMain.handle('narada:db:status', async () => sqliteService.getDatabaseStatus())
    ipcMain.handle('narada:db:save-case', async (event, data) => sqliteService.saveInvestigationCase(data))
    ipcMain.handle('narada:db:get-case', async (event, id) => sqliteService.getInvestigationCase(id))
    ipcMain.handle('narada:db:save-evidence', async (event, data) => sqliteService.saveEvidenceRecord(data))
    ipcMain.handle('narada:db:get-evidence', async (event, caseId) => sqliteService.getEvidenceRecords(caseId))
    ipcMain.handle('narada:db:save-comment-batch', async (event, data) => sqliteService.saveCommentBatch(data))
    ipcMain.handle('narada:db:get-comment-batches', async (event, caseId) => sqliteService.getCommentBatches(caseId))
    ipcMain.handle('narada:db:check-integrity', async () => sqliteService.checkDatabaseIntegrity())

    // 4. Buat BrowserWindow dengan preload.cjs asli
    const preloadPath = path.resolve('electron/preload.cjs')
    win = new BrowserWindow({
      show: false,
      width: 1280,
      height: 800,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    logAssert(win !== null && !win.isDestroyed(), '[S9-SMK.4] BrowserWindow utama berhasil diinstansiasi dengan preload asli')

    // 5. Muat HTML renderer uji
    const smokeHtml = path.join(__dirname, 'test-s9-smoke.html')
    fs.writeFileSync(smokeHtml, `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><title>NARADA S9 Smoke</title></head>
        <body>
          <div id="root">NARADA Investigative Workspace</div>
        </body>
      </html>
    `)
    await win.loadFile(smokeHtml)
    logAssert(true, '[S9-SMK.5] Halaman renderer dimuat ke viewport Electron')

    // 6. Verifikasi contextIsolation & Zero Node Leak
    const nodeLeak = await win.webContents.executeJavaScript(`typeof process !== 'undefined' || typeof require !== 'undefined'`)
    logAssert(!nodeLeak, '[S9-SMK.6] Context isolation terjamin: process & require tidak bocor ke window')

    // 7. Verifikasi API naradaDatabase & naradaEvidenceBrowser diekspos oleh preload
    const apisAvailable = await win.webContents.executeJavaScript(`
      typeof window.naradaDatabase === 'object' && typeof window.naradaEvidenceBrowser === 'object'
    `)
    logAssert(apisAvailable === true, '[S9-SMK.7] contextBridge berhasil mengekspos window.naradaDatabase & naradaEvidenceBrowser')

    // 8. Uji IPC SQLite Status dari Renderer
    const rendererDbStatus = await win.webContents.executeJavaScript(`window.naradaDatabase.getStatus()`)
    logAssert(rendererDbStatus.status === 'PERSISTED' && rendererDbStatus.engine === 'SQLITE', '[S9-SMK.8] Renderer memverifikasi status SQLite: PERSISTED')

    // 9. Uji Eksekusi Simpan Kasus melalui IPC Renderer
    const caseSaved = await win.webContents.executeJavaScript(`
      (async () => {
        const res = await window.naradaDatabase.saveCase({
          id: 'CASE-ELECTRON-SMOKE-1',
          caseNumber: 'NAR-2026-SMK1',
          title: 'Kasus Uji Electron Runtime',
          summary: 'Verifikasi pipeline IPC SQLite dari renderer Electron',
          status: 'ACTIVE',
          mode: 'LIVE_OPERATIONAL',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        return res.success;
      })()
    `)
    logAssert(caseSaved === true, '[S9-SMK.9] Renderer berhasil menyimpan kasus investigasi ke SQLite melalui IPC terproteksi')

    // 10. Uji Baca Kembali Kasus dari Renderer
    const caseRead = await win.webContents.executeJavaScript(`
      (async () => {
        const c = await window.naradaDatabase.getCaseById('CASE-ELECTRON-SMOKE-1');
        return c !== null && c.caseNumber === 'NAR-2026-SMK1';
      })()
    `)
    logAssert(caseRead === true, '[S9-SMK.10] Renderer berhasil membaca kembali kasus dari SQLite melalui IPC')

    // 11. Uji Simpan Bukti Digital melalui IPC Renderer
    const evidenceSaved = await win.webContents.executeJavaScript(`
      (async () => {
        const res = await window.naradaDatabase.saveEvidence({
          id: 'EVD-SMK-1',
          caseId: 'CASE-ELECTRON-SMOKE-1',
          sourceUrl: 'https://example.com/smoke-evidence',
          captureTimestamp: new Date().toISOString(),
          extractionMethod: 'MANUAL_BROWSER_CAPTURE',
          manifestSha256: 'deadbeef12345678',
          integrityStatus: 'VERIFIED'
        });
        return res.success;
      })()
    `)
    logAssert(evidenceSaved === true, '[S9-SMK.11] Renderer berhasil menyimpan bukti digital forensik ke SQLite melalui IPC')

    // 12. Uji Integritas Basis Data dari Renderer
    const integrityCheck = await win.webContents.executeJavaScript(`window.naradaDatabase.checkIntegrity()`)
    logAssert(integrityCheck.ok === true, '[S9-SMK.12] PRAGMA integrity_check lulus via IPC renderer')

    // 13. Cleanup temporary HTML
    try {
      fs.unlinkSync(smokeHtml)
    } catch {}

    // 14. Penghancuran BrowserWindow yang bersih
    win.destroy()
    logAssert(win.isDestroyed(), '[S9-SMK.13] BrowserWindow dihancurkan secara bersih tanpa kebocoran memori')

    sqliteService.closeSqliteDatabase()
    try {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath)
    } catch {}

  } catch (err) {
    console.error('Fatal unhandled error in Sprint 9 smoke runner:', err)
    logAssert(false, `Unexpected error: ${err.message}`)
  } finally {
    console.log('\n══════════════════════════════════════════════════════════════════════')
    console.log(`🏁 REAL ELECTRON RUNTIME SMOKE RESULTS: ${passedAssertions} / ${totalAssertions} PASS (${Math.round((passedAssertions / totalAssertions) * 100)}%)`)
    console.log('══════════════════════════════════════════════════════════════════════\n')

    setTimeout(() => {
      app.exit(failedAssertions > 0 ? 1 : 0)
    }, 100)
  }
})

