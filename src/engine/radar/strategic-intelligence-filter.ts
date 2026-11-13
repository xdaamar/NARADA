/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — STRATEGIC INTELLIGENCE GATEKEEPER & RELEVANCY FILTER
 * Pusat Pertahanan Siber TNI AD (PUSSIBERAD) × CODEPOLITAN
 * Kartika Cyber Hackathon 2026
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Menyaring arus informasi radar secara ketat agar hanya berita yang benar-benar
 * memiliki bobot ancaman kognitif, pertahanan negara, siber, krisis publik,
 * atau disinformasi viral yang masuk ke dalam radar.
 *
 * Mencegah berita sampah, infotainment, olahraga komersial, serta seremonial
 * rutin kabupaten/kota (santunan balita, senam, gowes) mencemari radar taktis militer!
 */

export interface IntelligenceFilterResult {
  isEligible: boolean
  exclusionReason?: 'JUNK_POP_CULTURE' | 'SPORTS_COMMERCIAL' | 'MUNICIPAL_CEREMONIAL' | 'FINANCIAL_CLICKBAIT' | 'TOO_SHORT' | 'PURE_PUBLISHER_NAME'
  reasonExplanation?: string
}

/**
 * Memeriksa apakah suatu klaim / artikel pers layak masuk Radar Intelijen Situasional
 */
export function isStrategicIntelligenceEligible(
  title: string,
  body = '',
  sourceName = ''
): IntelligenceFilterResult {
  const cleanTitle = (title || '').trim()
  if (cleanTitle.length < 15) {
    return {
      isEligible: false,
      exclusionReason: 'TOO_SHORT',
      reasonExplanation: 'Judul berita terlalu pendek untuk memuat peristiwa intelijen yang dapat dianalisis'
    }
  }

  const text = `${cleanTitle} ${body} ${sourceName}`.toLowerCase()

  // ─── 1. SEREMONIAL RUTIN KABUPATEN/KOTA & KEGIATAN NON-STRATEGIS ───
  // Berita santunan seremonial, pembagian bantuan lokal, senam pagi, gowes, sosialisasi PKK
  const MUNICIPAL_CEREMONIAL_PATTERNS = [
    'salurkan santunan', 'santunan balita', 'santunan untuk balita', 'cegah stunting, pemerintah kabupaten',
    'pemkab ciamis kolaborasi salurkan santunan', 'bupati serahkan bantuan', 'walikota serahkan bantuan',
    'buka acara senam', 'senam sehat bersama', 'gowes bersama pemda', 'jalan sehat santai',
    'lomba agustusan pemda', 'peringatan hari ibu dprd', 'sosialisasi pkk', 'pelantikan pejabat eselon iv pemkab',
    'ziarah makam bupati', 'buka pelatihan menjahit', 'buka pelatihan umkm dinas', 'penyerahan bibit cabai pemda',
    'sidak pasar dinas perdagangan', 'apel gabungan asn kabupaten', 'peresmian gedung puskesmas pembantu'
  ]

  for (const pattern of MUNICIPAL_CEREMONIAL_PATTERNS) {
    if (text.includes(pattern)) {
      return {
        isEligible: false,
        exclusionReason: 'MUNICIPAL_CEREMONIAL',
        reasonExplanation: `Ditolak filter seremonial lokal kabupaten/rutinitas non-strategis: (${pattern})`
      }
    }
  }

  // ─── 2. INFOTAINMENT, SELEBRITI, DRAMA & GAYA HIDUP POP ───
  const JUNK_POP_PATTERNS = [
    'infotainment', 'gossip', 'gosip artis', 'selebritis', 'pacar baru artis', 'perceraian artis',
    'sinetron', 'drakor', 'drama korea', 'k-pop', 'boyband', 'girlband', 'konser musik pop',
    'outfit artis', 'skincare glowing', 'tips kecantikan', 'ramalan zodiak', 'horoskop',
    'ramalan tarot', 'chord gitar', 'lirik lagu', 'warganet salfok', 'bikin baper netizen'
  ]

  for (const junk of JUNK_POP_PATTERNS) {
    if (text.includes(junk)) {
      return {
        isEligible: false,
        exclusionReason: 'JUNK_POP_CULTURE',
        reasonExplanation: `Ditolak filter hiburan/infotainment pop: (${junk})`
      }
    }
  }

  // ─── 3. OLAHRAGA KOMERSIAL, HASIL PERTANDINGAN & PREDIKSI LINEUP ───
  const SPORTS_PATTERNS = [
    'prediksi skor', 'skor akhir', 'hasil pertandingan', 'lineup pemain', 'susunan pemain',
    'klasemen liga', 'premier league', 'liga champions', 'liga inggris', 'la liga', 'serie a',
    'bursa transfer pemain', 'motogp gp', 'formula 1 gp', 'all england badminton'
  ]

  for (const sp of SPORTS_PATTERNS) {
    if (text.includes(sp)) {
      return {
        isEligible: false,
        exclusionReason: 'SPORTS_COMMERCIAL',
        reasonExplanation: `Ditolak filter olahraga komersial: (${sp})`
      }
    }
  }

  // ─── 4. CLICKBAIT FINANSIAL CUAN & GAME ───
  const CLICKBAIT_PATTERNS = [
    'saldo dana kaget', 'klaim saldo dana', 'link dana kaget', 'kode redeem free fire',
    'slot gacor', 'slot judol', 'pinjaman online cair cepat tanpa ktp', 'diskon promo shopee haul'
  ]

  for (const cb of CLICKBAIT_PATTERNS) {
    if (text.includes(cb)) {
      return {
        isEligible: false,
        exclusionReason: 'FINANCIAL_CLICKBAIT',
        reasonExplanation: `Ditolak filter clickbait finansial/game: (${cb})`
      }
    }
  }

  return { isEligible: true }
}

