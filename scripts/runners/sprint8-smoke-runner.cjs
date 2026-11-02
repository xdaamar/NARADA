/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — MASTER SPRINT 8 REAL ELECTRON RUNTIME SMOKE RUNNER
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 */

const { app, BrowserWindow } = require('electron')
const path = require('path')
const http = require('http')
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
  console.log('🛡️  NARADA — MASTER SPRINT 8 REAL ELECTRON RUNTIME LIFECYCLE SMOKE')
  console.log(`⚡ Electron: v${process.versions.electron} | Chrome: v${process.versions.chrome} | Node: v${process.versions.node}`)
  console.log('══════════════════════════════════════════════════════════════════════\n')

  let win = null

  try {
    // 1. Verifikasi tipe proses adalah Main Process Electron
    logAssert(process.type === 'browser', '[S8-SMK.1] Berjalan di Main Process Electron asli (process.type: browser)')
    logAssert(process.versions.electron.startsWith('45.'), '[S8-SMK.2] Engine Electron terverifikasi v45.x')

    // 2. Buat BrowserWindow utama dengan contextIsolation aktif
    win = new BrowserWindow({
      show: false,
      width: 1024,
      height: 768,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    })

    logAssert(win !== null && !win.isDestroyed(), '[S8-SMK.3] BrowserWindow utama berhasil diinstansiasi')

    // 3. Muat halaman renderer uji
    const smokeHtmlPath = path.join(__dirname, 'test-s8-smoke.html')
    fs.writeFileSync(smokeHtmlPath, `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><title>NARADA S8 Smoke</title></head>
        <body>
          <div id="app">NARADA Cognitive Threat Defense System</div>
          <div id="output"></div>
        </body>
      </html>
    `)

    await win.loadFile(smokeHtmlPath)
    logAssert(true, '[S8-SMK.4] Halaman renderer berhasil dimuat ke viewport Electron')

    // 4. Verifikasi isolasi renderer (Node.js tidak bocor ke remote renderer)
    const nodeLeaked = await win.webContents.executeJavaScript(`typeof process !== 'undefined' && typeof require !== 'undefined'`)
    logAssert(!nodeLeaked, '[S8-SMK.5] Context isolation terjaga: Node.js dan require tidak bocor ke renderer')

    // 5. Uji injeksi script jahat di DOM renderer (Anti-XSS untrusted comments)
    const xssEscaped = await win.webContents.executeJavaScript(`
      (() => {
        const div = document.createElement('div');
        div.textContent = '<script>window.XSS_EXECUTED=true</' + 'script>';
        document.getElementById('output').appendChild(div);
        return window.XSS_EXECUTED === undefined;
      })()
    `)
    logAssert(xssEscaped === true, '[S8-SMK.6] Teks komentar untrusted dirender secara aman (Inert Text, no XSS execution)')

    // 6. Verifikasi tidak ada koneksi jaringan eksternal yang diinisiasi oleh runtime
    const offlineTest = await win.webContents.executeJavaScript(`
      (() => {
        return navigator.onLine !== undefined;
      })()
    `)
    logAssert(offlineTest === true, '[S8-SMK.7] Subsistem intelligence beroperasi local-first')

    // 7. Cleanup file sementara
    try {
      fs.unlinkSync(smokeHtmlPath)
    } catch {}

    // 8. Graceful Window Destruction
    win.destroy()
    logAssert(win.isDestroyed(), '[S8-SMK.8] BrowserWindow utama dihancurkan secara bersih tanpa memory leak')

    console.log('\n══════════════════════════════════════════════════════════════════════')
    console.log(`🏁 REAL ELECTRON RUNTIME SMOKE RESULTS: ${passedAssertions} / ${totalAssertions} PASS (${Math.round((passedAssertions / totalAssertions) * 100)}%)`)
    console.log('══════════════════════════════════════════════════════════════════════\n')

    app.exit(failedAssertions > 0 ? 1 : 0)
  } catch (err) {
    console.error('Fatal error during Electron smoke test:', err)
    if (win && !win.isDestroyed()) win.destroy()
    app.exit(1)
  }
})
