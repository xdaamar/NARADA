const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  const indexPath = path.resolve(__dirname, '../../dist/index.html')
  const targetUrl = `file://${indexPath}#/reports`

  await win.loadURL(targetUrl)
  await new Promise(r => setTimeout(r, 2000))

  // Scroll document down
  await win.webContents.executeJavaScript(`
    (() => {
      const scrollable = document.querySelector('div[style*="overflow-y: auto"]') || document.querySelector('.page-content') || window;
      if (scrollable.scrollTo) scrollable.scrollTo(0, 800);
      else scrollable.scrollTop = 800;
    })()
  `)
  await new Promise(r => setTimeout(r, 600))

  const image = await win.webContents.capturePage()
  const artifactPath = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8/reports_cleared_scrolled_verified.png'
  fs.writeFileSync(artifactPath, image.toPNG())
  console.log('[Snapshot Scrolled] Saved to:', artifactPath)

  win.close()
  app.quit()
})
