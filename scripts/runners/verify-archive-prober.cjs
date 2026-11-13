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

  console.log('[Archive Prober] Loading Archive page...')
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
        evidenceSufficiency: 100,
        lastProbedAt: '13 Nov 2026, 12:00 WIB',
        evidenceSummary: 'Bukti Terverifikasi 100%: Ditemukan rujukan cek fakta resmi dari TurnBackHoax.ID & Setwapres',
        isManualOverride: false
      };

      const monitoredItem = {
        id: 'PIN-MONITOR-002',
        claim: 'Indikasi Peretasan Basis Data Infrastruktur Kritis Energi Nasional Menjelang Akhir Tahun',
        cluster: 'SERANGAN_SIBER',
        archiveVerdict: 'DIPANTAU',
        verdict: 'UNVERIFIED',
        threatLevel: 'high',
        clarification: 'Arus intelijen awal sedang diverifikasi oleh Tim Tanggap Insiden Siber (CSIRT) BSSN dan Dispenad.',
        officialSource: 'Sensor Deteksi Anomali Siber Narada & Babinsa',
        sourceUrl: 'https://bssn.go.id/notifikasi-keamanan-2026',
        archivedAt: '13 Nov 2026, 10:15 WIB',
        archivedTimestamp: Date.now() - 3600000 * 2,
        evidenceSufficiency: 45,
        lastProbedAt: '13 Nov 2026, 11:30 WIB',
        evidenceSummary: 'Ditemukan 3 artikel warta pers terkait topik ini. Belum ada rilis sanggahan/konfirmasi otoritas resmi BSSN. Pemantauan berlanjut.',
        isManualOverride: false
      };

      const dataMap = {
        'TBH-POL-051': gibranItem,
        'PIN-MONITOR-002': monitoredItem
      };
      const ids = ['TBH-POL-051', 'PIN-MONITOR-002'];
      const verdicts = {
        'TBH-POL-051': 'HOAKS',
        'PIN-MONITOR-002': 'DIPANTAU'
      };

      localStorage.setItem('narada_archived_items_data', JSON.stringify(dataMap));
      localStorage.setItem('narada_archived_issues', JSON.stringify(ids));
      localStorage.setItem('narada_archived_classifications', JSON.stringify(verdicts));

      window.dispatchEvent(new CustomEvent('narada:archive-updated', { detail: { action: 'INJECT_VERIFIED' } }));
    })()
  `)

  await new Promise(r => setTimeout(r, 2000))

  const archiveImg = await win.webContents.capturePage()
  const archivePath = path.join(artifactDir, 'archive_evidence_prober_verified.png')
  fs.writeFileSync(archivePath, archiveImg.toPNG())
  console.log('[Archive Prober] Saved screenshot to:', archivePath)

  win.close()
  app.quit()
})
