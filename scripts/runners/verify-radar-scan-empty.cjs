const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

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

  win.webContents.on('console-message', (event, level, message) => {
    console.log('[BrowserConsole]', message)
  })

  const indexPath = path.resolve(__dirname, '../../dist/index.html')
  const targetUrl = `file://${indexPath}#/radar`
  console.log('[Snapshot] Loading URL:', targetUrl)

  await win.loadURL(targetUrl)

  const startTime = Date.now()
  let isDone = false

  while (Date.now() - startTime < 35000 && !isDone) {
    await new Promise(r => setTimeout(r, 1000))
    const status = await win.webContents.executeJavaScript(`
      (() => {
        const isScanning = document.body.innerText.includes('SEDANG MEMINDAI ARUS INTELIJEN 14 KANAL');
        const cards = document.querySelectorAll('#tactical-radar-feed-deck .steel-chassis-card').length;
        return { isScanning, cards, bodySnippet: document.body.innerText.slice(0, 150) };
      })()
    `)
    const elapsed = Math.round((Date.now() - startTime) / 1000)
    console.log(`[Timer ${elapsed}s]`, status.isScanning ? 'Still scanning...' : `Completed! Cards: ${status.cards}`)
    if (!status.isScanning) {
      isDone = true
      const img = await win.webContents.capturePage()
      const artifactCompleted = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8/radar_scan_completed_verified.png'
      fs.writeFileSync(artifactCompleted, img.toPNG())
      console.log('[Snapshot] Saved completed snapshot to:', artifactCompleted)
    }
  }

  win.close()
  app.quit()
})
