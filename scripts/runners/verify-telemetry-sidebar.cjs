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
  const targetUrl = `file://${indexPath}#/`
  console.log('[Snapshot Telemetry] Loading URL:', targetUrl)

  await win.loadURL(targetUrl)
  await new Promise(r => setTimeout(r, 2000))

  // 1. Capture sidebar normal telemetry bars and ONLINE status
  const imageNormal = await win.webContents.capturePage()
  const artifactNormal = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8/sidebar_telemetry_monitoring_verified.png'
  fs.writeFileSync(artifactNormal, imageNormal.toPNG())
  console.log('[Snapshot Telemetry] Saved normal view to:', artifactNormal)

  // 2. Trigger hover on telemetry container
  await win.webContents.executeJavaScript(`
    (() => {
      const el = document.querySelector('.telemetry-bar-container');
      if (el) {
        el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      }
    })()
  `)
  await new Promise(r => setTimeout(r, 800))

  const imageHover = await win.webContents.capturePage()
  const artifactHover = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8/sidebar_telemetry_hover_verified.png'
  fs.writeFileSync(artifactHover, imageHover.toPNG())
  console.log('[Snapshot Telemetry] Saved hover popover view to:', artifactHover)

  win.close()
  app.quit()
})
