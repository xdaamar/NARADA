const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

const artifactDir = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8'

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  const indexPath = path.resolve(__dirname, '../../dist/index.html')

  console.log('[Radar Unverified Verification] Loading Radar Situasional...')
  await win.loadURL(`file://${indexPath}#/radar`)

  // Tunggu hingga pemindaian radar selesai (bolt-tl kartu ada dan teks pemindaian hilang)
  console.log('[Radar Unverified Verification] Waiting for scan completion and cards rendering (up to 35s)...')
  await win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const interval = setInterval(() => {
        const text = document.body.textContent || '';
        const cards = document.querySelectorAll('.bolt-tl');
        const isScanning = text.includes('SEDANG MEMINDAI ARUS INTELIJEN');
        if (cards.length > 0 && !isScanning) {
          clearInterval(interval);
          resolve(true);
        }
      }, 500);
      setTimeout(() => {
        clearInterval(interval);
        resolve(true);
      }, 35000);
    })
  `)

  // Klik tab SEDANG DIPANTAU
  console.log('[Radar Unverified Verification] Selecting SEDANG DIPANTAU tab...')
  await win.webContents.executeJavaScript(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const unverifiedBtn = buttons.find(b => b.textContent && b.textContent.includes('SEDANG DIPANTAU'));
      if (unverifiedBtn) {
        unverifiedBtn.click();
        return true;
      }
      return false;
    })()
  `)

  await new Promise(r => setTimeout(r, 2000))

  // Capture screenshot
  const image = await win.webContents.capturePage()
  const outPath = path.join(artifactDir, 'radar_unverified_high_weight_verified.png')
  fs.writeFileSync(outPath, image.toPNG())
  console.log('[Radar Unverified Verification] Screenshot saved to:', outPath)

  win.close()
  app.quit()
})
