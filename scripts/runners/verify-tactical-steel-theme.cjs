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

  // 1. Capture LiveRadar (First click toggle to open connector details, as shown in user's image)
  console.log('[Theme Verification] 1. Loading LiveRadar...')
  await win.loadURL(`file://${indexPath}#/radar`)
  await new Promise(r => setTimeout(r, 2000))

  // Click the toggle button to open connector drawer so we see the exact panel from user screenshot
  await win.webContents.executeJavaScript(`
    (() => {
      const toggleBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Lihat Detail') || b.innerText.includes('Kanal'));
      if (toggleBtn) toggleBtn.click();
    })()
  `)
  await new Promise(r => setTimeout(r, 1200))

  const radarImg = await win.webContents.capturePage()
  const radarPath = path.join(artifactDir, 'radar_tactical_steel_theme_verified.png')
  fs.writeFileSync(radarPath, radarImg.toPNG())
  console.log('[Theme Verification] Saved LiveRadar snapshot to:', radarPath)

  // 2. Capture Dashboard
  console.log('[Theme Verification] 2. Loading Dashboard...')
  await win.loadURL(`file://${indexPath}#/`)
  await new Promise(r => setTimeout(r, 2000))

  const dashImg = await win.webContents.capturePage()
  const dashPath = path.join(artifactDir, 'dashboard_tactical_steel_theme_verified.png')
  fs.writeFileSync(dashPath, dashImg.toPNG())
  console.log('[Theme Verification] Saved Dashboard snapshot to:', dashPath)

  // 3. Capture Reports
  console.log('[Theme Verification] 3. Loading Reports...')
  await win.loadURL(`file://${indexPath}#/reports`)
  await new Promise(r => setTimeout(r, 2000))

  const reportsImg = await win.webContents.capturePage()
  const reportsPath = path.join(artifactDir, 'reports_tactical_steel_theme_verified.png')
  fs.writeFileSync(reportsPath, reportsImg.toPNG())
  console.log('[Theme Verification] Saved Reports snapshot to:', reportsPath)

  win.close()
  app.quit()
})
