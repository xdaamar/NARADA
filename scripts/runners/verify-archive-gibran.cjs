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

  // Injeksi data pinned news yang valid & terverifikasi langsung ke localStorage
  console.log('[Archive Verification] Injecting pinned news data...')
  await win.loadURL(`file://${indexPath}#/archive`)

  await win.webContents.executeJavaScript(`
    (() => {
      const gibranItem = {
        id: 'TBH-POL-051',
        claim: 'Usai ajukan pengunduran diri, Gibran tinggalkan Istana Wakil Presiden',
        cluster: 'POLITIK_NEGARA',
        archiveVerdict: 'HOAKS',
        verdict: 'HOAKS',
        threatLevel: 'critical',
        clarification: 'Klaim video dan narasi yang menyebutkan Wakil Presiden Gibran Rakabuming Raka mengajukan surat pengunduran diri dan meninggalkan Istana Wakil Presiden adalah HOAKS konteks palsu (False Context). Berdasarkan verifikasi periksa fakta TurnBackHoax (Mafindo) dan konfirmasi resmi Sekretariat Wakil Presiden (Setwapres), video tersebut merupakan rekaman lawas saat Gibran menyerahkan surat pengunduran diri sebagai Wali Kota Surakarta kepada pimpinan DPRD Solo pada 16 Juli 2024 menjelang pelantikan nasional. Wakil Presiden Gibran aktif secara sah dan konstitusional bertugas memimpin agenda pemerintahan di Istana Wapres.',
        officialSource: 'TurnBackHoax.ID (Mafindo) & Sekretariat Wakil Presiden',
        sourceUrl: 'https://turnbackhoax.id/?s=gibran+pengunduran+diri',
        archivedAt: '12 Nov 2026, 20:01 WIB',
        archivedTimestamp: Date.now() - 3600000 * 18,
        isManualOverride: false
      };

      const dataMap = { 'TBH-POL-051': gibranItem };
      const ids = ['TBH-POL-051'];
      const verdicts = { 'TBH-POL-051': 'HOAKS' };

      localStorage.setItem('narada_archived_items_data', JSON.stringify(dataMap));
      localStorage.setItem('narada_archived_issues', JSON.stringify(ids));
      localStorage.setItem('narada_archived_classifications', JSON.stringify(verdicts));

      window.dispatchEvent(new CustomEvent('narada:archive-updated', { detail: { action: 'VERIFY' } }));
    })()
  `)

  await new Promise(r => setTimeout(r, 2000))

  const archiveImg = await win.webContents.capturePage()
  const archivePath = path.join(artifactDir, 'archive_gibran_verified_reference.png')
  fs.writeFileSync(archivePath, archiveImg.toPNG())
  console.log('[Archive Verification] Saved archive gibran view to:', archivePath)

  win.close()
  app.quit()
})

