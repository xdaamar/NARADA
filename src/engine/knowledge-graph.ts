import type { InstitutionalLogicAnomaly } from '../types'
import { normalizeText } from './data/debunk-service'

/**
 * Knowledge Graph & Semantic Inconsistency Reasoning Engine
 * Mendeteksi anomali logika ketatanegaraan, sains kebencanaan, dan prosedur pemerintahan (Zero-Day Hoax Detection)
 */
export function evaluateInstitutionalLogic(text: string): InstitutionalLogicAnomaly {
  if (!text || text.trim().length < 5) {
    return { detected: false, confidenceImpact: 0 }
  }

  const norm = normalizeText(text)

  // ─── 1. ANOMALI HUKUM TATA NEGARA & SUKSESI KEPEMIMPINAN RI ───
  // Fakta Konstitusi:
  // - Presiden Sah 2024-2029: Prabowo Subianto
  // - Wakil Presiden Sah 2024-2029: Gibran Rakabuming Raka
  // - Pasal 7A & 7B UUD 1945: Pemberhentian Presiden/Wapres hanya via Sidang Istimewa MPR

  const mentionsLeader =
    norm.includes('gibran') ||
    norm.includes('rakabuming') ||
    norm.includes('wapres') ||
    norm.includes('wakil presiden') ||
    norm.includes('presiden') ||
    norm.includes('prabowo')

  const mentionsDicopot =
    norm.includes('dicopot') ||
    norm.includes('dipecat') ||
    norm.includes('diberhentikan') ||
    norm.includes('pemakzulan') ||
    norm.includes('turun tahta') ||
    norm.includes('mencopot') ||
    norm.includes('memecat') ||
    norm.includes('makzulkan')

  if (mentionsLeader && mentionsDicopot) {
    return {
      detected: true,
      anomalyType: 'CONSTITUTIONAL_VIOLATION',
      explanation: 'Anomali Konstitusi Serius Terdeteksi: Berdasarkan Pasal 7A & 7B UUD 1945, Presiden dan Wakil Presiden RI HANYA dapat diberhentikan melalui Sidang Istimewa MPR atas putusan Mahkamah Konstitusi. Tidak ada surat/prosedur pencopotan sepihak; klaim ini merupakan pelanggaran fakta struktur ketatanegaraan.',
      confidenceImpact: 96
    }
  }

  const mentionsJokowi = norm.includes('jokowi') || norm.includes('jokowidodo')
  const mentionsPrabowo = norm.includes('prabowo') || norm.includes('subianto')
  const mentionsGantikan = norm.includes('gantikan') || norm.includes('menggantikan') || norm.includes('diangkat kembali') || norm.includes('jadi presiden lagi')

  if (mentionsJokowi && mentionsGantikan && (mentionsPrabowo || norm.includes('presiden'))) {
    return {
      detected: true,
      anomalyType: 'CONSTITUTIONAL_VIOLATION',
      explanation: 'Anomali Suksesi Kepemimpinan Nasional: Joko Widodo telah purnatugas dan Presiden Prabowo Subianto adalah Kepala Negara sah 2024–2029 hasil Pemilu yang dilantik MPR. Konstitusi melarang pengangkatan kembali mantan presiden menggantikan presiden aktif tanpa pemilihan.',
      confidenceImpact: 96
    }
  }

  // ─── 2. ANOMALI HUKUM SAINS KEBENCANAAN (BMKG / BNPB) ───
  // Fakta Sains Geofisika:
  // - Belum ada teknologi sains di bumi yang mampu memprediksi waktu kejadian gempa secara spesifik (jam/menit)
  // - Klaim jam spesifik + gempa/megathrust/tsunami + ajakan lari keluar = 100% Hoaks Teror Psikologis

  const mentionsGempa = norm.includes('gempa') || norm.includes('megathrust') || norm.includes('tsunami')
  const mentionsSpesificTime =
    norm.includes('malam ini') ||
    norm.includes('besok pagi') ||
    norm.includes('jam 23') ||
    norm.includes('jam 24') ||
    norm.includes('jam 01') ||
    norm.includes('jam 02') ||
    norm.includes('pukul') ||
    /\bjam\s+\d{1,2}/.test(norm)

  const mentionsPanicUrgency =
    norm.includes('keluar rumah') ||
    norm.includes('segera lari') ||
    norm.includes('evakuasi malam ini') ||
    norm.includes('peringatan bmkg') ||
    norm.includes('sebarkan cepat') ||
    norm.includes('waspada')

  if (mentionsGempa && mentionsSpesificTime && mentionsPanicUrgency) {
    return {
      detected: true,
      anomalyType: 'DISASTER_PREDICTION_FRAUD',
      explanation: 'Anomali Hukum Sains Kebencanaan: Sains geofisika global (BMKG & USGS) menegaskan bahwa waktu gempa bumi TIDAK DAPAT diprediksi secara jam atau menit. Klaim waktu spesifik disertai perintah panik keluar rumah merupakan fabrikasi psikologis teror kepanikan massal.',
      confidenceImpact: 96
    }
  }

  // Anomali Bendungan Jebol (Katulampa / Gintung) disertai 'malam ini' / 'sebarkan cepat'
  const mentionsBendungan = norm.includes('bendungan') || norm.includes('bendung') || norm.includes('katulampa')
  const mentionsJebol = norm.includes('jebol') || norm.includes('runtuh') || norm.includes('pecah')
  if (mentionsBendungan && mentionsJebol && (norm.includes('jakarta') || norm.includes('malam ini') || norm.includes('sebarkan'))) {
    return {
      detected: true,
      anomalyType: 'DISASTER_PREDICTION_FRAUD',
      explanation: 'Anomali Peringatan Dini Banjir: Status pintu air Katulampa dimonitor 24 jam real-time oleh BPBD Bogor dan Dinas SDA. Isu bendungan jebol meluap ke Jakarta malam ini tanpa rilis sirene resmi Pemprov adalah disinformasi kepanikan banjir.',
      confidenceImpact: 94
    }
  }

  // ─── 3. ANOMALI PROSEDUR BANTUAN SOSIAL & PHISHING KEMENSOS ───
  // Fakta Prosedur Kemensos:
  // - Pemerintah tidak pernah menyalurkan bansos tunai via link bit.ly, s.id, atau APK WhatsApp

  const mentionsBansos = norm.includes('bansos') || norm.includes('blt') || norm.includes('bantuan tunai') || norm.includes('bantuan sosial') || norm.includes('kemensos')
  const mentionsPhishingLink =
    norm.includes('bit ly') ||
    norm.includes('bit.ly') ||
    norm.includes('s id') ||
    norm.includes('s.id') ||
    norm.includes('tautan') ||
    norm.includes('link') ||
    norm.includes('daftar online') ||
    norm.includes('form') ||
    norm.includes('per kk')

  if (mentionsBansos && mentionsPhishingLink) {
    return {
      detected: true,
      anomalyType: 'FINANCIAL_SCAM_PHISHING',
      explanation: 'Anomali Prosedur Penyaluran Bansos: Kementerian Sosial HANYA menyalurkan bantuan melalui Himbara/PT Pos dan verifikasi situs resmi cekbansos.kemensos.go.id. Penawaran bansos tunai jutaan rupiah via link bit.ly/s.id adalah 100% modus penipuan phishing data pribadi/KTP.',
      confidenceImpact: 95
    }
  }

  // Anomali File APK Tilang / Kurir
  const mentionsTilangOrKurir = norm.includes('tilang') || norm.includes('etle') || norm.includes('kurir') || norm.includes('paket j&t') || norm.includes('undangan pernikahan')
  const mentionsApk = norm.includes('apk') || norm.includes('file apk') || norm.includes('aplikasi')
  if (mentionsTilangOrKurir && mentionsApk) {
    return {
      detected: true,
      anomalyType: 'FINANCIAL_SCAM_PHISHING',
      explanation: 'Anomali Pengiriman Dokumen Dinas: Kepolisian dan ekspedisi resmi tidak pernah mengirim surat dinas atau resi dalam bentuk file APK aplikasi WhatsApp. Ini adalah modus malware sniffing pencuri SMS OTP perbankan.',
      confidenceImpact: 96
    }
  }

  // ─── 4. ANOMALI KESEHATAN & PANGAN SINTETIS ───
  const mentionsBeras = norm.includes('beras') || norm.includes('telur')
  const mentionsPlastik = norm.includes('plastik') || norm.includes('sintetis') || norm.includes('lilin') || norm.includes('dibakar meleleh')

  if (mentionsBeras && mentionsPlastik) {
    return {
      detected: true,
      anomalyType: 'HEALTH_HOAX',
      explanation: 'Anomali Sains Biologi Pangan: Beras adalah pati karbohidrat organik yang secara alami menghitam dan berkerak saat dibakar. Biaya produksi plastik sintetis jauh lebih mahal daripada beras asli; uji laboratorium BPOM dan Kementan membuktikan klaim beras plastik adalah mitos tidak berdasar.',
      confidenceImpact: 92
    }
  }

  return { detected: false, confidenceImpact: 0 }
}
