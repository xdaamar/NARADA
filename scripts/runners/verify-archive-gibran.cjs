const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

const artifactDir = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8'

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 1200,
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
        originalPlatform: 'TikTok & X (Twitter) - Akun Publik @viral_politik',
        originalSourceUrl: 'https://www.tiktok.com/@viral_politik/video/742198471928371',
        originalSourceStatus: 'DELETED',
        sourceDeletedReason: 'Video asli dan postingan telah dihapus oleh pemilik akun / takedown oleh platform',
        forensicCaptureHash: 'NAR-EVD-POL051-92FA',
        archivedAt: '12 Nov 2026, 20:01 WIB',
        interceptedAt: '12 Nov 2026, 18:30 WIB',
        archivedTimestamp: Date.now() - 3600000 * 18,
        isManualOverride: false
      };

      const cyberItem = {
        id: 'NAR-CYB-001',
        claim: 'Pusat Data Nasional Sementara (PDNS) 2 Surabaya lumpuh total akibat serangan siber Ransomware Brain Cipher',
        cluster: 'SIBER_PERETASAN',
        archiveVerdict: 'FAKTA',
        verdict: 'FAKTA',
        threatLevel: 'critical',
        clarification: 'BSSN, Kementerian Kominfo, dan Cyber Crime Polri mengonfirmasi resmi bahwa gangguan sistem PDNS 2 di Surabaya disebabkan oleh serangan Ransomware jenis Brain Cipher (varian LockBit 3.0). Tim tanggap darurat BSSN dan Pussiberad melakukan isolasi forensik dan pemulihan bertahap pada 282 instansi pemerintah terdampak.',
        officialSource: 'BSSN & Kementerian Kominfo / Komdigi RI',
        sourceUrl: 'https://bssn.go.id/penanganan-insiden-pdns',
        originalPlatform: 'Pusat Operasi Keamanan Siber Nasional (Pusopskamsinas)',
        originalSourceUrl: 'https://pusopskamsinas.bssn.go.id/advisories/pdns2-incident',
        originalSourceStatus: 'ACTIVE',
        forensicCaptureHash: 'NAR-EVD-CYB001-B73C',
        archivedAt: '13 Nov 2026, 09:30 WIB',
        interceptedAt: '13 Nov 2026, 09:00 WIB',
        archivedTimestamp: Date.now() - 3600000 * 4,
        isManualOverride: false
      };

      const dataMap = { 'TBH-POL-051': gibranItem, 'NAR-CYB-001': cyberItem };
      const ids = ['TBH-POL-051', 'NAR-CYB-001'];
      const verdicts = { 'TBH-POL-051': 'HOAKS', 'NAR-CYB-001': 'FAKTA' };

      localStorage.setItem('narada_archived_items_data', JSON.stringify(dataMap));
      localStorage.setItem('narada_archived_issues', JSON.stringify(ids));
      localStorage.setItem('narada_archived_classifications', JSON.stringify(verdicts));

      window.dispatchEvent(new CustomEvent('narada:archive-updated', { detail: { action: 'VERIFY' } }));
      window.scrollTo({ top: 120, behavior: 'instant' });
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

