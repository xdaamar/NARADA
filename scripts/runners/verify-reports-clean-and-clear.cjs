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
  console.log('[Snapshot] Loading Reports URL:', targetUrl)

  await win.loadURL(targetUrl)

  // Wait 2.5 seconds for reports page to load
  await new Promise(r => setTimeout(r, 2500))

  // 1. Capture clean report canvas (no dummy data)
  const image1 = await win.webContents.capturePage()
  const artifactPath1 = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8/reports_clean_no_dummy_verified.png'
  fs.writeFileSync(artifactPath1, image1.toPNG())
  console.log('[Snapshot 1] Saved clean reports screenshot to:', artifactPath1)

  // 2. Open Fullscreen Zoom Modal
  await win.webContents.executeJavaScript(`
    (() => {
      const zoomBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Tinjau Layar Penuh'));
      if (zoomBtn) zoomBtn.click();
    })()
  `)
  await new Promise(r => setTimeout(r, 1200))

  // Capture modal with "Bersihkan Kertas" button
  const image2 = await win.webContents.capturePage()
  const artifactPath2 = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8/reports_modal_clear_button_verified.png'
  fs.writeFileSync(artifactPath2, image2.toPNG())
  console.log('[Snapshot 2] Saved modal with clear button screenshot to:', artifactPath2)

  // Close modal via ESC key
  await win.webContents.executeJavaScript(`
    (() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    })()
  `)
  await new Promise(r => setTimeout(r, 800))

  // 3. Test recording a real action and see it appear in the report
  await win.webContents.executeJavaScript(`
    (() => {
      // Simulate real action record event
      window.dispatchEvent(new CustomEvent('narada:archive-updated', {
        detail: {
          id: 'TEST-INTEL-01',
          action: 'ARCHIVE',
          item: {
            claim: 'Deteksi Kampanye Disinformasi Siber Serangan Ransomware Terorganisir',
            clarification: 'BSSN & CSIRT mengonfirmasi serangan telah diisolasi',
            cluster: 'SIBER_PERETASAN',
            officialSource: 'BSSN RI'
          }
        }
      }));
    })()
  `)
  await new Promise(r => setTimeout(r, 1000))

  const image3 = await win.webContents.capturePage()
  const artifactPath3 = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8/reports_real_action_captured_verified.png'
  fs.writeFileSync(artifactPath3, image3.toPNG())
  console.log('[Snapshot 3] Saved real action captured screenshot to:', artifactPath3)

  win.close()
  app.quit()
})
