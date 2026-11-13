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
  await new Promise(r => setTimeout(r, 2500))

  // 1. Periksa TopBar: Capture Hub menggantikan jam
  const topbarCheck = await win.webContents.executeJavaScript(`
    (() => {
      const topbarText = document.querySelector('.topbar')?.innerText || '';
      const hasClock = /\\d{2}:\\d{2}:\\d{2}\\s*WIB/.test(topbarText);
      const hasRec = topbarText.includes('REC AKTIF') || topbarText.includes('REC JEDA');
      const hasScope = topbarText.includes('SEMUA TINDAKAN') || topbarText.includes('HANYA TEMUAN RADAR');
      const sidebarCollapsedInitial = !!document.querySelector('.sidebar.collapsed');

      return {
        hasClock,
        hasRec,
        hasScope,
        sidebarCollapsedInitial
      };
    })()
  `)
  console.log('[TopBar Check]', topbarCheck)

  // Tangkap screenshot layar utama Reports
  const mainImage = await win.webContents.capturePage()
  const artifactMain = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8/reports_capture_hub_topbar_verified.png'
  fs.writeFileSync(artifactMain, mainImage.toPNG())
  console.log('[Snapshot] Saved reports_capture_hub_topbar_verified.png')

  // 2. Buka Modal Tinjau Penuh Dokumen A4
  await win.webContents.executeJavaScript(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const zoomBtn = btns.find(b => b.innerText.includes('Tinjau Penuh') || b.innerText.includes('Tinjau Layar Penuh'));
      if (zoomBtn) zoomBtn.click();
    })()
  `)
  await new Promise(r => setTimeout(r, 1500))

  // 3. Verifikasi Sidebar Auto-Hide / Icon-only mode saat modal terbuka
  const modalInspection = await win.webContents.executeJavaScript(`
    (() => {
      const sidebar = document.querySelector('.sidebar');
      const isSidebarCollapsed = sidebar ? sidebar.classList.contains('collapsed') : false;
      const modalDoc = document.querySelector('#military-report-document-modal');
      const docHeight = modalDoc ? modalDoc.offsetHeight : 0;
      const docBg = modalDoc ? window.getComputedStyle(modalDoc).backgroundColor : '';

      return {
        isSidebarCollapsed,
        docHeight,
        docBg
      };
    })()
  `)
  console.log('[Modal Inspection]', modalInspection)

  // Tangkap screenshot modal bagian atas
  const modalTopImage = await win.webContents.capturePage()
  const artifactModalTop = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8/reports_a4_modal_top_verified.png'
  fs.writeFileSync(artifactModalTop, modalTopImage.toPNG())
  console.log('[Snapshot] Saved reports_a4_modal_top_verified.png')

  // 4. Scroll ke bawah modal untuk membuktikan bagian III, IV, V tertutup kanvas putih
  await win.webContents.executeJavaScript(`
    (() => {
      const scrollViewport = document.querySelector('#military-report-document-modal')?.parentElement;
      if (scrollViewport) {
        scrollViewport.scrollTop = 900;
      }
    })()
  `)
  await new Promise(r => setTimeout(r, 800))

  // Tangkap screenshot modal bagian bawah (Section III, IV, V dalam kanvas putih rapi)
  const modalBottomImage = await win.webContents.capturePage()
  const artifactModalBottom = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8/reports_a4_modal_bottom_verified.png'
  fs.writeFileSync(artifactModalBottom, modalBottomImage.toPNG())
  console.log('[Snapshot] Saved reports_a4_modal_bottom_verified.png')

  win.close()
  app.quit()
})
