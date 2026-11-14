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

  const indexPath = path.resolve(__dirname, '../../dist/index.html')

  // 1. Periksa Sidebar dan Halaman Reports
  const reportsUrl = `file://${indexPath}#/reports`
  console.log('[Snapshot] Loading Reports URL:', reportsUrl)
  await win.loadURL(reportsUrl)
  await new Promise(r => setTimeout(r, 2000))

  const navLabels = await win.webContents.executeJavaScript(`
    (() => {
      const items = Array.from(document.querySelectorAll('.sidebar .nav-item span:first-of-type')).map(s => s.innerText);
      const reportsH1 = Array.from(document.querySelectorAll('h1')).map(h => h.innerText);
      return { items, reportsH1 };
    })()
  `)
  console.log('[Nav Items & Reports Inspection]', navLabels)

  const reportsImage = await win.webContents.capturePage()
  const artifactReports = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8/reports_clean_armored_header_verified.png'
  fs.writeFileSync(artifactReports, reportsImage.toPNG())
  console.log('[Snapshot] Saved reports_clean_armored_header_verified.png')

  // 2. Periksa Halaman About
  const aboutUrl = `file://${indexPath}#/about`
  console.log('[Snapshot] Loading About URL:', aboutUrl)
  await win.loadURL(aboutUrl)
  await new Promise(r => setTimeout(r, 2000))

  const aboutInspection = await win.webContents.executeJavaScript(`
    (() => {
      const aboutH1 = Array.from(document.querySelectorAll('h1')).map(h => h.innerText);
      const textUnderPhoto = document.body.innerText.includes('Arahkan kursor (hover)') || document.body.innerText.includes('Ga Pake Foto Asli');
      return { aboutH1, textUnderPhoto };
    })()
  `)
  console.log('[About Inspection]', aboutInspection)

  const aboutImage = await win.webContents.capturePage()
  const artifactAbout = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8/about_clean_armored_header_verified.png'
  fs.writeFileSync(artifactAbout, aboutImage.toPNG())
  console.log('[Snapshot] Saved about_clean_armored_header_verified.png')

  win.close()
  app.quit()
})
