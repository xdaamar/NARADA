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

  // Mock window.confirm so it automatically returns true
  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript(`
      window.confirm = () => true;
      window.alert = (msg) => console.log('[Alert]', msg);
    `)
  })

  const indexPath = path.resolve(__dirname, '../../dist/index.html')
  const targetUrl = `file://${indexPath}#/reports`
  console.log('[Runner] Loading Reports URL:', targetUrl)

  await win.loadURL(targetUrl)
  await new Promise(r => setTimeout(r, 2000))

  // 1. Activate REC ON and record an action
  await win.webContents.executeJavaScript(`
    (() => {
      // Find REC button in Topbar
      const recBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('REC'));
      if (recBtn) recBtn.click();
    })()
  `)
  await new Promise(r => setTimeout(r, 600))

  // Ingest an action with REC ON
  await win.webContents.executeJavaScript(`
    (() => {
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
  await new Promise(r => setTimeout(r, 800))

  // Capture screenshot with REC ON & action captured
  const image1 = await win.webContents.capturePage()
  const artifactPath1 = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8/reports_rec_on_action_captured_verified.png'
  fs.writeFileSync(artifactPath1, image1.toPNG())
  console.log('[Snapshot 1] Saved REC ON + action captured screenshot to:', artifactPath1)

  // 2. Click "Bersihkan Kertas Laporan (Clear)" button in left panel
  await win.webContents.executeJavaScript(`
    (() => {
      const clearBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Bersihkan Kertas Laporan'));
      if (clearBtn) clearBtn.click();
    })()
  `)
  await new Promise(r => setTimeout(r, 800))

  // Capture screenshot after clear
  const image2 = await win.webContents.capturePage()
  const artifactPath2 = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8/reports_after_clear_verified.png'
  fs.writeFileSync(artifactPath2, image2.toPNG())
  console.log('[Snapshot 2] Saved after clear screenshot to:', artifactPath2)

  win.close()
  app.quit()
})
