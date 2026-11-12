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
  const targetUrl = `file://${indexPath}#/reports`
  console.log('[Snapshot] Loading URL:', targetUrl)

  await win.loadURL(targetUrl)

  // Tunggu 3 detik agar komponen dan preview A4 termuat sempurna
  await new Promise(r => setTimeout(r, 3000))

  const inspection = await win.webContents.executeJavaScript(`
    (() => {
      const sidebarLinks = Array.from(document.querySelectorAll('.sidebar .nav-item')).map(a => a.getAttribute('href') || a.innerText.trim());
      const hasSettings = sidebarLinks.some(s => s.includes('settings') || s.includes('Pengaturan'));
      const reportDoc = document.querySelector('#military-report-document');
      const shaBlock = document.querySelector('.sha256-block');
      const configPanel = document.querySelector('.report-config-panel');
      const tableRows = document.querySelectorAll('#military-report-document table tr');

      return {
        sidebarLinks,
        hasSettings,
        hasReportDoc: Boolean(reportDoc),
        hasShaBlock: Boolean(shaBlock),
        hasConfigPanel: Boolean(configPanel),
        totalTableRows: tableRows.length
      };
    })()
  `)
  console.log('[Snapshot Inspection]', JSON.stringify(inspection, null, 2))

  const image = await win.webContents.capturePage()
  const artifactPath = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8/reports_modernized_verified.png'
  fs.writeFileSync(artifactPath, image.toPNG())
  console.log('[Snapshot] Saved verified reports screenshot to:', artifactPath)

  win.close()
  app.quit()
})

