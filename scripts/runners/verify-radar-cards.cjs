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

  console.log('[Radar Cards Verification] Loading Radar Situasional...')
  await win.loadURL(`file://${indexPath}#/radar`)

  // Injeksi item unverified berbobot tinggi langsung ke radar feed
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

  // Tunggu hingga pemindaian radar selesai sepenuhnya
  console.log('[Radar Cards Verification] Waiting for scan completion (up to 35s)...')
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

  // Klik tab FAKTA & AMAN untuk melihat berita resmi dan terkonfirmasi
  console.log('[Radar Cards Verification] Selecting FAKTA & AMAN tab...')
  await win.webContents.executeJavaScript(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const factBtn = buttons.find(b => b.textContent && b.textContent.includes('FAKTA & AMAN'));
      if (factBtn) factBtn.click();
    })()
  `)

  await new Promise(r => setTimeout(r, 2000))

  const image = await win.webContents.capturePage()
  const imagePath = path.join(artifactDir, 'radar_fakta_aman_verified.png')
  fs.writeFileSync(imagePath, image.toPNG())
  console.log('[Radar Cards Verification] Screenshot saved to:', imagePath)

  win.close()
  app.quit()
})

