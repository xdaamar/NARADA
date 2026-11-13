/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — RADAR VERDICT EVALUATOR & FACTUALITY CLASSIFIER
 * Pusat Pertahanan Siber TNI AD (PUSSIBERAD) × CODEPOLITAN
 * Kartika Cyber Hackathon 2026
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Memisahkan secara cerdas antara:
 * 1. FAKTA RESMI / PERISTIWA PASTI (Factual Events):
 *    Berita yang sudah pasti terjadi (pelantikan, rilis BMKG, latihan TNI, MoU resmi).
 *    Otomatis masuk ke filter [ FAKTA & AMAN ], bukan ditumpuk di Sedang Dipantau!
 *
 * 2. SEDANG DIPANTAU (Unverified Claims / Emerging Rumors):
 *    Berita atau rumor viral yang MEMANG LAYAK DITUNGGU kebenarannya (dugaan peretasan,
 *    bocoran data, narasi viral tak terverifikasi, spekulasi publik).
 *
 * 3. TERINDIKASI HOAKS:
 *    Hasil sanggahan cek fakta resmi (TurnBackHoax, Mafindo, Dispenad).
 */

export interface RadarVerdictEvaluation {
  verdict: 'FAKTA' | 'HOAKS' | 'UNVERIFIED'
  isPastiTerjadi: boolean
  isSpekulatif: boolean
  confidenceScore: number
  reasoning: string
}

/**
 * Mengevaluasi vonis awal dan kelayakan pemantauan suatu artikel radar
 */
export function evaluateRadarVerdict(
  title: string,
  body = '',
  sourceName = '',
  cluster = ''
): RadarVerdictEvaluation {
  const normTitle = (title || '').toLowerCase()
  const text = `${normTitle} ${body} ${sourceName}`.toLowerCase()

  // ─── 1. DETEKSI MUTLAK HOAKS / DISINFORMASI ───
  if (
    normTitle.startsWith('[salah]') ||
    normTitle.startsWith('[hoaks]') ||
    normTitle.startsWith('[hoax]') ||
    normTitle.startsWith('[disinformasi]') ||
    normTitle.startsWith('[manipulasi]') ||
    normTitle.includes('hoaks:') ||
    normTitle.includes('cek fakta:') ||
    sourceName.toLowerCase().includes('turnbackhoax') ||
    sourceName.toLowerCase().includes('mafindo')
  ) {
    return {
      verdict: 'HOAKS',
      isPastiTerjadi: false,
      isSpekulatif: false,
      confidenceScore: 95,
      reasoning: 'Teridentifikasi sebagai artikel klarifikasi/sanggahan hoaks resmi'
    }
  }

  // ─── 2. DETEKSI SINYAL SPEKULATIF, RUMOR & KLAIM VIRAL (LAYAK DIPANTAU) ───
  // Berita-berita ini memuat klaim yang belum tervalidasi dan memang layak ditunggu kebenarannya!
  const SPECULATIVE_INDICATORS = [
    'diduga', 'viral narasi', 'isu beredar', 'rumor', 'bocoran data', 'klaim peretasan',
    'spekulasi', 'benarkah', 'tanda tanya', 'investigasi mandiri', 'disorot publik',
    'belum terkonfirmasi', 'disebut-sebut', 'dituding', 'misterius', 'beredar video',
    'viral video', 'mengaku diretas', 'diduga palsu', 'benarkah kabar', 'terindikasi',
    'potensi serangan', 'dikabarkan', 'isu pemakzulan', 'dokumen bocor', 'klaim hacker',
    'sampel data dijual', 'terancam sanksi', 'kontroversial',
    // Indikator kontroversial politik & kebijakan nasional yang layak dipantau:
    'tolak', 'ditolak', 'kecam', 'mengecam', 'protes', 'polemik', 'kritik',
    'dikritik', 'desak', 'tuntut', 'menuntut', 'unjuk rasa', 'demo', 'mogok',
    'somasi', 'gugatan', 'penolakan', 'kontroversi', 'heboh', 'gaduh', 'ramai',
    'viral', 'trending', 'dipertanyakan', 'diragukan', 'mencurigakan',
    'pengakuan', 'mengaku', 'dugaan korupsi', 'dugaan suap', 'dugaan pungli',
    'wacana', 'rencana kontroversial', 'rencana yang menuai', 'menuai kritik',
    'menuai protes', 'reshuffle', 'pencopotan', 'pemecatan', 'mundur', 'mengundurkan diri',
    'penangkapan', 'ditangkap kpk', 'operasi tangkap tangan', 'ott kpk',
    'bocor', 'rekaman', 'skandal', 'dugaan', 'kasus', 'tersangka',
    'terseret', 'diperiksa', 'dipanggil', 'dipecat', 'dicopot', 'dilengser',
    'minta mundur', 'desakan mundur', 'petisi', 'sanksi', 'pembekuan',
    'konflik', 'ketegangan', 'pelanggaran', 'manuver', 'intrik', 'perpecahan'
  ]

  const matchedSpeculative = SPECULATIVE_INDICATORS.filter(ind => text.includes(ind))

  // Jika memuat indikator spekulasi / klaim rumor:
  // INILAH YANG WAJIB MASUK STATUS "SEDANG DIPANTAU"!
  if (matchedSpeculative.length > 0) {
    return {
      verdict: 'UNVERIFIED',
      isPastiTerjadi: false,
      isSpekulatif: true,
      confidenceScore: 70 + Math.min(20, matchedSpeculative.length * 5),
      reasoning: `Isu memuat indikasi klaim spekulatif/viral (${matchedSpeculative.slice(0, 2).join(', ')}). Layak dipantau menunggu konfirmasi/sanggahan.`
    }
  }

  // ─── 3. DETEKSI PERISTIWA RESMI PASTI TERJADI (FAKTUAL KEDINASAN / TRENDING PASTI) ───
  // Berita tentang kegiatan nyata, regulasi sah, atau rilis otoritas resmi
  const DEFINITIVE_ACTION_PATTERNS = [
    'resmikan', 'meresmikan', 'lantik', 'melantik', 'teken mou', 'tandatangani kesepakatan',
    'umumkan hasil', 'sahkan regulasi', 'terbitkan perpres', 'tetapkan hari libur',
    'gelar latihan bersama', 'distribusikan bantuan bencana', 'rilis peringatan cuaca',
    'kunjungan kenegaraan', 'sidang kabinet paripurna', 'buka pameran alutsista',
    'tangkap tersangka', 'sita barang bukti', 'gelar upacara', 'pimpin rapat koordinasi',
    'terbitkan panduan bssn', 'raih penghargaan', 'tingkatkan kesiapsiagaan'
  ]

  const matchedDefinitive = DEFINITIVE_ACTION_PATTERNS.filter(act => text.includes(act))

  const isOfficialSource = sourceName.toUpperCase().includes('ANTARA') ||
                           sourceName.toUpperCase().includes('TNI') ||
                           sourceName.toUpperCase().includes('KEMHAN') ||
                           sourceName.toUpperCase().includes('BMKG') ||
                           sourceName.toUpperCase().includes('BNPB') ||
                           sourceName.toUpperCase().includes('BSSN') ||
                           sourceName.toUpperCase().includes('SETNEG') ||
                           sourceName.toUpperCase().includes('KEMENKEU')

  // ─── GUARD: Jika konten memuat sinyal KONTROVERSIAL/SPEKULASI meski dari sumber resmi, ───
  // berita tersebut tetap LAYAK DIPANTAU karena masih ada ketidakpastian publik!
  const CONTROVERSY_OVERRIDE_INDICATORS = [
    'tolak', 'ditolak', 'kecam', 'mengecam', 'protes', 'polemik', 'kontroversi',
    'dikritik', 'desak', 'tuntut', 'gaduh', 'ramai', 'viral', 'trending',
    'dipertanyakan', 'diragukan', 'heboh', 'unjuk rasa', 'demo', 'mogok',
    'wacana', 'rencana kontroversial', 'menuai kritik', 'menuai protes',
    'reshuffle', 'pencopotan', 'pemecatan', 'mundur', 'mengundurkan diri',
    'penangkapan', 'ditangkap kpk', 'operasi tangkap tangan', 'ott kpk',
    'bocor', 'rekaman', 'skandal', 'dugaan korupsi', 'dugaan suap',
    'terseret', 'diperiksa', 'dipanggil', 'dipecat', 'dicopot', 'dilengser',
    'minta mundur', 'desakan mundur', 'petisi', 'sanksi', 'konflik',
    'pelanggaran', 'manuver', 'intrik', 'perpecahan', 'ketegangan',
    'somasi', 'gugatan', 'pengakuan', 'mengaku', 'tersangka'
  ]
  const hasControversySignal = CONTROVERSY_OVERRIDE_INDICATORS.some(ind => text.includes(ind))

  // Jika peristiwa bersifat definitif atau bersumber dari kawat berita resmi
  // DAN tidak mengandung sinyal kontroversi/spekulasi publik:
  // OTOMATIS JADIKAN FAKTA (PERISTIWA PASTI TERJADI)!
  if ((matchedDefinitive.length > 0 || isOfficialSource) && !hasControversySignal) {
    return {
      verdict: 'FAKTA',
      isPastiTerjadi: true,
      isSpekulatif: false,
      confidenceScore: 85,
      reasoning: `Peristiwa faktual resmi terkonfirmasi (${matchedDefinitive[0] || sourceName}). Otomatis masuk status FAKTA.`
    }
  }

  // Jika bersumber resmi TAPI ada sinyal kontroversi/polemik → tetap DIPANTAU!
  if ((matchedDefinitive.length > 0 || isOfficialSource) && hasControversySignal) {
    return {
      verdict: 'UNVERIFIED',
      isPastiTerjadi: false,
      isSpekulatif: true,
      confidenceScore: 72,
      reasoning: `Berita dari sumber resmi namun mengandung sinyal kontroversi/polemik publik. Layak dipantau untuk melihat perkembangan opini dan reaksi.`
    }
  }

  // ─── 4. DEFAULT: JIKA TIDAK ADA SINYAL KUAT, MASUKKAN KE PANTAU JIKA KLASTER SENSITIF ───
  const isHighThreatCluster = cluster === 'SIBER_PERETASAN' || cluster === 'KEDAULATAN_MILITER' || cluster === 'AKSI_MASSA' || cluster === 'POLITIK_NEGARA'
  if (isHighThreatCluster) {
    return {
      verdict: 'UNVERIFIED',
      isPastiTerjadi: false,
      isSpekulatif: true,
      confidenceScore: 65,
      reasoning: `Isu berada pada klaster ancaman tinggi (${cluster}). Dimasukkan ke SEDANG DIPANTAU untuk verifikasi lanjutan.`
    }
  }

  // Berita umum yang stabil dan tidak memuat klaim kontroversial dianggap peristiwa faktual
  return {
    verdict: 'FAKTA',
    isPastiTerjadi: true,
    isSpekulatif: false,
    confidenceScore: 75,
    reasoning: 'Publikasi warta pers faktual standar tanpa klaim kontroversi'
  }
}

