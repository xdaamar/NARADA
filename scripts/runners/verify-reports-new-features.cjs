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

  // Wait 3s for rendering
  await new Promise(r => setTimeout(r, 3000))

  const inspection = await win.webContents.executeJavaScript(`
    (() => {
      const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
        placeholder: i.placeholder,
        value: i.value
      }));
      const provenanceBanner = document.body.innerText.includes('ASAL DATA & DOKTRIN GENERASI LAPORAN');
      const zoomToolbar = document.body.innerText.includes('PRATINJAU DOKUMEN INTELIJEN A4');
      const fullScreenBtn = Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Tinjau Layar Penuh') || b.innerText.includes('Tinjau Penuh'));
      const dottedSignature = document.querySelector('#military-report-document')?.innerText.includes('( .................................................... )');

      return {
        inputs,
        provenanceBanner,
        zoomToolbar,
        fullScreenBtn,
        dottedSignature
      };
    })()
  `)
  console.log('[Snapshot Inspection]', JSON.stringify(inspection, null, 2))

  // 1. Capture main reports page
  const mainImage = await win.webContents.capturePage()
  const artifactMain = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8/reports_empty_form_provenance_verified.png'
  fs.writeFileSync(artifactMain, mainImage.toPNG())
  console.log('[Snapshot] Saved reports_empty_form_provenance_verified.png')

  // 2. Click "Tinjau Penuh" button to open modal
  await win.webContents.executeJavaScript(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const zoomBtn = btns.find(b => b.innerText.includes('Tinjau Penuh'));
      if (zoomBtn) zoomBtn.click();
    })()
  `)

  await new Promise(r => setTimeout(r, 1200))

  // 3. Capture modal open
  const modalImage = await win.webContents.capturePage()
  const artifactModal = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8/reports_zoom_modal_verified.png'
  fs.writeFileSync(artifactModal, modalImage.toPNG())
  console.log('[Snapshot] Saved reports_zoom_modal_verified.png')

  win.close()
  app.quit()
})
