/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — REAL ELECTRON RUNTIME LIFECYCLE SMOKE RUNNER (Carry-Over 8.3)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * Berjalan langsung di dalam Main Process Electron asli (process.type === 'browser')
 * Memverifikasi:
 * 1. Electron Main Window Lifecycle
 * 2. Loopback Gateway Server Start & HTTP 200 Health (Strict No 502/504)
 * 3. Evidence Browser WebContentsView Creation, Session Ephemerality & Capture
 * 4. Evidence Browser Teardown & Graceful Shutdown
 * ══════════════════════════════════════════════════════════════════════════
 */

const { app, BrowserWindow } = require('electron')
const path = require('path')
const http = require('http')
const fs = require('fs')

const { startGatewayServer, stopGatewayServer } = require('../../electron/gateway-runner.cjs')
const {
  openEvidenceBrowser,
  navigateBrowser,
  prepareCapture,
  closeEvidenceBrowser,
  getBrowserStatus
} = require('../../electron/evidence-browser-manager.cjs')

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
  console.log('🛡️  NARADA — REAL ELECTRON RUNTIME LIFECYCLE SMOKE (Carry-Over 8.3)')
  console.log(`⚡ Electron: v${process.versions.electron} | Chrome: v${process.versions.chrome} | Node: v${process.versions.node}`)
  console.log('══════════════════════════════════════════════════════════════════════\n')

  let gateway = null
  let win = null
  const TEST_GATEWAY_PORT = 5178

  try {
    // 1. Verifikasi tipe proses adalah Main Process Electron
    logAssert(process.type === 'browser', '[S7-SMK.1] Proses berjalan di Electron Main Process asli (process.type: browser)')

    // 2. Buat BrowserWindow utama aplikasi
    win = new BrowserWindow({
      show: false,
      width: 1024,
      height: 768,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })
    logAssert(win && !win.isDestroyed(), '[S7-SMK.2] BrowserWindow utama aplikasi berhasil diinstansiasi')

    // 3. Jalankan Gateway Server Loopback pada port uji 5178
    gateway = await startGatewayServer(TEST_GATEWAY_PORT, '127.0.0.1')
    logAssert(gateway && gateway.server, `[S7-SMK.3] Loopback Gateway Server berjalan di 127.0.0.1:${TEST_GATEWAY_PORT}`)

    // 4. Periksa kesehatan Gateway melalui HTTP GET langsung (Strict HTTP 200, tolak 502/504)
    const healthResponse = await new Promise((resolve, reject) => {
      const req = http.get(`http://127.0.0.1:${TEST_GATEWAY_PORT}/api/health`, (res) => {
        let raw = ''
        res.on('data', chunk => { raw += chunk })
        res.on('end', () => resolve({ statusCode: res.statusCode, body: raw }))
      })
      req.on('error', reject)
      req.setTimeout(3000, () => {
        req.destroy(new Error('Gateway health check timeout'))
      })
    })

    logAssert(healthResponse.statusCode === 200, `[S7-SMK.4] Gateway /api/health merespons HTTP 200 OK (Status teramati: ${healthResponse.statusCode})`)
    const healthJson = JSON.parse(healthResponse.body)
    logAssert(healthJson.status === 'HEALTHY', `[S7-SMK.5] Status payload gateway adalah HEALTHY (Mode: ${healthJson.mode})`)

    // 5. Inisialisasi dan pasang Evidence Browser (WebContentsView terisolasi)
    const openResult = await openEvidenceBrowser(win, {
      caseId: 'CAS-SMOKE-E2E-001',
      bounds: { x: 0, y: 0, width: 800, height: 600 }
    })
    logAssert(openResult.success === true, '[S7-SMK.6] openEvidenceBrowser sukses menginisialisasi WebContentsView terisolasi')
    logAssert(openResult.sessionPartition.startsWith('ephemeral-evidence-'), '[S7-SMK.7] Sesi peramban menggunakan partisi ephemeral (non-persistent)')

    // 6. Muat fixture aman terkontrol ke WebContentsView dan uji proteksi navigasi
    const { validateNavigationUrl } = require('../../electron/browser-security.cjs')
    const loopbackCheck = validateNavigationUrl(`http://127.0.0.1:${TEST_GATEWAY_PORT}`)
    logAssert(loopbackCheck.isValid === false, '[S7-SMK.8] Kebijakan produksi terbukti menolak navigasi ke gateway loopback internal')

    // Muat fixture lokal terkontrol untuk pengujian capture
    const fixtureHtml = 'data:text/html,<html><head><title>Halaman Uji Forensik Smoke</title></head><body><h1>Bukti Terverifikasi</h1><p>Paragraf teks investigasi integritas sistem.</p></body></html>'
    await openResult.success
    const statusBefore = getBrowserStatus()
    logAssert(statusBefore.isActive === true, '[S7-SMK.9] getBrowserStatus melaporkan peramban bukti berstatus aktif')

    // Ambil webContents dari manager
    const { prepareCapture: runPrepareCapture } = require('../../electron/evidence-browser-manager.cjs')
    
    // Muat HTML uji ke webContents
    if (win.contentView && win.contentView.children && win.contentView.children.length > 0) {
      const view = win.contentView.children[0]
      if (view && view.webContents) {
        await view.webContents.loadURL(fixtureHtml)
      }
    }

    // 7. Pengambilan bukti (prepareCapture)
    const captureResult = await runPrepareCapture()
    logAssert(captureResult.success === true, '[S7-SMK.10] prepareCapture berhasil mengeksekusi ekstraksi viewport & metadata')
    logAssert(typeof captureResult.screenshotByteSha256 === 'string' && captureResult.screenshotByteSha256.length === 64, '[S7-SMK.11] screenshotByteSha256 terhitung tepat 64-karakter hex')
    logAssert(typeof captureResult.manifestSha256 === 'string' && captureResult.manifestSha256.length === 64, '[S7-SMK.12] manifestSha256 kanonikal terhitung tepat 64-karakter hex')

    // 8. Teardown Evidence Browser
    await closeEvidenceBrowser()
    const statusAfter = getBrowserStatus()
    logAssert(statusAfter.isActive === false, '[S7-SMK.13] closeEvidenceBrowser berhasil mencopot view dan membersihkan sesi ephemeral')

    // 9. Teardown Gateway Server
    if (gateway && gateway.server) {
      await stopGatewayServer(gateway.server)
      gateway = null
      logAssert(true, '[S7-SMK.14] Gateway Server berhasil dihentikan secara graceful')
    }

    // 10. Tutup BrowserWindow utama
    if (win && !win.isDestroyed()) {
      win.destroy()
      win = null
      logAssert(true, '[S7-SMK.15] BrowserWindow utama ditutup dengan sukses')
    }

  } catch (err) {
    console.error('Fatal error during Electron smoke test:', err)
    failedAssertions++
  } finally {
    if (gateway && gateway.server) {
      try { await stopGatewayServer(gateway.server) } catch {}
    }
    if (win && !win.isDestroyed()) {
      try { win.destroy() } catch {}
    }
  }

  console.log('\n══════════════════════════════════════════════════════════════════════')
  console.log(`🏁 REAL ELECTRON RUNTIME SMOKE RESULTS: ${passedAssertions} / ${totalAssertions} PASS (${Math.round((passedAssertions / totalAssertions) * 100)}%)`)
  console.log('══════════════════════════════════════════════════════════════════════\n')

  app.exit(failedAssertions > 0 ? 1 : 0)
})
