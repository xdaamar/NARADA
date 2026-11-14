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

  // Open Fullscreen Zoom Modal
  await win.webContents.executeJavaScript(`
    (() => {
      const zoomBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Tinjau Layar Penuh'));
      if (zoomBtn) zoomBtn.click();
    })()
  `)
  await new Promise(r => setTimeout(r, 1200))

  // Scroll modal container down
  await win.webContents.executeJavaScript(`
    (() => {
      // Find modal scrollable container
      const scrollables = Array.from(document.querySelectorAll('div')).filter(d => {
        const s = window.getComputedStyle(d);
        return s.overflowY === 'auto' || s.overflowY === 'scroll';
      });
      scrollables.forEach(s => { s.scrollTop = 1200; });
    })()
  `)
  await new Promise(r => setTimeout(r, 800))

  const image = await win.webContents.capturePage()
  const artifactPath = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8/reports_modal_scrolled_bottom_verified.png'
  fs.writeFileSync(artifactPath, image.toPNG())
  console.log('[Snapshot Modal Scrolled] Saved to:', artifactPath)

  win.close()
  app.quit()
})
