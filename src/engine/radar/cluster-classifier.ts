/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — CONTEXT-AWARE SEMANTIC CLUSTER CLASSIFIER
 * Pusat Pertahanan Siber TNI AD (PUSSIBERAD) × CODEPOLITAN
 * Kartika Cyber Hackathon 2026
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Mengklasifikasikan isu dan publikasi radar ke dalam klaster spektrum ancaman kognitif
 * dengan scoring semantik berbasis konteks, bobot entitas, dan guard penalty anti-mismatch.
 * Mencegah kesalahan fatal seperti berita stunting balita daerah dimasukkan ke Politik Negara!
 */

import type { ThreatSpectrumCluster } from '../../types.ts'

export interface ClusterScoringResult {
  cluster: ThreatSpectrumCluster
  scores: Record<ThreatSpectrumCluster, number>
  matchedKeywords: string[]
  reasoning: string
}

/**
 * Pemetaan Klaster Spektrum Ancaman Kognitif Berbasis Penilaian Konteks Mendalam
 */
export function classifyCluster(
  title: string,
  body = '',
  fallbackCluster?: ThreatSpectrumCluster
): ThreatSpectrumCluster {
  const result = evaluateClusterScoring(title, body, fallbackCluster)
  return result.cluster
}

/**
 * Evaluasi skor terperinci untuk tiap klaster
 */
export function evaluateClusterScoring(
  title: string,
  body = '',
  fallbackCluster?: ThreatSpectrumCluster
): ClusterScoringResult {
  const text = `${title} ${body}`.toLowerCase()

  const scores: Record<ThreatSpectrumCluster, number> = {
    SIBER_PERETASAN: 0,
    KEDAULATAN_MILITER: 0,
    POLITIK_NEGARA: 0,
    AKSI_MASSA: 0,
    EKONOMI_DIGITAL: 0,
    BENCANA_DARURAT: 0,
    PENIPUAN_BANSOS: 0,
    KESEHATAN_PANGAN: 0,
    UMUM_NETRAL: 0
  }

  const matchedKeywords: string[] = []

  // ─── 1. SIBER & PERETASAN (Prioritas Tertinggi Pertahanan Siber) ───
  const CYBER_KEYWORDS = [
    'siber', 'cyber', 'peretasan', 'diretas', 'meretas', 'hacker', 'kebocoran data',
    'data breach', 'ransomware', 'brain cipher', 'lockbit', 'defacement', 'slot judol',
    'judi online di web', 'malware', 'dark web', 'breachforums', 'bjorka', 'phishing perbankan',
    'sniffing', 'pdns', 'pusat data nasional', 'csirt', 'bssn', 'pussiberad', 'ddos',
    'trojan', 'apk pencuri', 'surat tilang apk', 'keamanan siber', 'credential leak',
    'server down diretas', 'insiden siber', 'forensik siber'
  ]
  for (const kw of CYBER_KEYWORDS) {
    if (text.includes(kw)) {
      scores.SIBER_PERETASAN += kw.length > 8 ? 6 : 4
      matchedKeywords.push(kw)
    }
  }

  // ─── 2. KEDAULATAN & PERTAHANAN MILITER ───
  const MILITARY_KEYWORDS = [
    'tni', 'tni ad', 'tni al', 'tni au', 'militer', 'alutsista', 'kemhan', 'kemenhan',
    'kopassus', 'kostrad', 'marinir', 'kodam', 'korem', 'kodim', 'koramil', 'babinsa',
    'papua', 'opm', 'kkb', 'natuna', 'ambalat', 'pangkalan militer', 'pesawat tempur',
    'kapal perang', 'kri ', 'sukhoi', 'f-16', 'rafale', 'patroli perbatasan', 'pos pamtas',
    'bakamla', 'radar hanud', 'intelijen militer', 'dispenad', 'panglima tni', 'kasad'
  ]
  for (const kw of MILITARY_KEYWORDS) {
    if (text.includes(kw)) {
      scores.KEDAULATAN_MILITER += kw.length > 6 ? 5 : 3
      matchedKeywords.push(kw)
    }
  }

  // ─── 3. AKSI MASSA & DINAMIKA SIPIL LAPANGAN ───
  const CIVIC_KEYWORDS = [
    'unjuk rasa', 'demonstrasi', 'demonstran', 'aksi massa', 'demo buruh', 'buruh mogok',
    'mogok kerja', 'mahasiswa turun ke jalan', 'protes rakyat', 'penolakan rUU', 'bentrok massa',
    'kericuhan massa', 'pemakzulan', 'petisi rakyat', 'serikat buruh', 'aliansi mahasiswa',
    'blokade jalan massa', 'demo tolak', 'massa geruduk'
  ]
  for (const kw of CIVIC_KEYWORDS) {
    if (text.includes(kw)) {
      scores.AKSI_MASSA += 5
      matchedKeywords.push(kw)
    }
  }

  // ─── 4. EKONOMI & TRANSAKSI DIGITAL ───
  const DIGITAL_ECON_KEYWORDS = [
    'pajak digital', 'transaksi digital', 'ekonomi digital', 'fintech', 'marketplace',
    'pph 22', 'pph digital', 'ppn digital', 'bank digital', 'qris', 'kripto', 'crypto',
    'e-commerce', 'ojk', 'bank indonesia', 'bi rate', 'tarif impor', 'finansial sistemik',
    'rupiah digital', 'devisa ekspor'
  ]
  for (const kw of DIGITAL_ECON_KEYWORDS) {
    if (text.includes(kw)) {
      scores.EKONOMI_DIGITAL += 4
      matchedKeywords.push(kw)
    }
  }

  // ─── 5. BENCANA DARURAT & KRISIS PUBLIK ───
  const DISASTER_KEYWORDS = [
    'gempa', 'tsunami', 'megathrust', 'katulampa', 'bendung', 'merapi', 'erupsi',
    'banjir bandang', 'tanah longsor', 'bmkg', 'bnpb', 'kekeringan parah', 'darurat bencana',
    'status tanggap darurat', 'siklon tropis', 'cuaca ekstrem darurat', 'gempa bumi'
  ]
  for (const kw of DISASTER_KEYWORDS) {
    if (text.includes(kw)) {
      scores.BENCANA_DARURAT += 5
      matchedKeywords.push(kw)
    }
  }

  // ─── 6. PENIPUAN BANSOS & LINK FIKTIF ───
  const SCAM_BANSOS_KEYWORDS = [
    'bansos kemensos', 'penipuan bansos', 'link bantuan', 'daftar blt', 'pendaftaran bansos',
    'bantuan modal gratis', 'bantuan presiden cair', 'link kuota kemendikbud', 'link subsidi bbm',
    'pendaftaran kartu prakerja fiktif', 'link fiktif', 's.id/bansos', 'bit.ly/bantuan',
    'undian berhadiah resmi', 'klaim santunan fiktif'
  ]
  for (const kw of SCAM_BANSOS_KEYWORDS) {
    if (text.includes(kw)) {
      scores.PENIPUAN_BANSOS += 6
      matchedKeywords.push(kw)
    }
  }

  // ─── 7. KESEHATAN, GIZI & PANGAN NASIONAL ───
  const HEALTH_NUTRITION_KEYWORDS = [
    'stunting', 'gizi balita', 'cegah stunting', 'santunan balita', 'posyandu', 'vaksin',
    'obat sirup', 'beras plastik', 'racun', 'telur palsu', 'bpom', 'kemenkes', 'wabah penyakit',
    'flu burung', 'antraks', 'keracunan makanan', 'gizi buruk', 'ketahanan pangan', 'stok beras',
    'harga beras', 'kelangkaan beras'
  ]
  for (const kw of HEALTH_NUTRITION_KEYWORDS) {
    if (text.includes(kw)) {
      scores.KESEHATAN_PANGAN += 6
      matchedKeywords.push(kw)
    }
  }

  // ─── 8. POLITIK NEGARA (KEBIJAKAN STRATEGIS & KETATANEGARAAN NASIONAL) ───
  const STATE_POLITICS_KEYWORDS = [
    'presiden prabowo', 'wapres gibran', 'jokowi', 'sidang kabinet', 'kabinet merah putih',
    'kebijakan pemerintah pusat', 'kementerian koordinator', 'menko', 'menteri sekretaris negara',
    'dpr ri', 'mpr ri', 'mahkamah konstitusi', 'putusan mk', 'kpu ri', 'bawaslu ri', 'pilpres',
    'pemilihan presiden', 'suksesi kekuasaan', 'pemakzulan presiden', 'kudeta militer',
    'kpk ri', 'kejaksaan agung tangkap', 'suap menteri', 'ikn nusantara'
  ]
  for (const kw of STATE_POLITICS_KEYWORDS) {
    if (text.includes(kw)) {
      scores.POLITIK_NEGARA += 5
      matchedKeywords.push(kw)
    }
  }

  // Deteksi umum politik tingkat tinggi
  if (text.includes('presiden') || text.includes('wapres') || text.includes('menteri') || text.includes('kabinet')) {
    scores.POLITIK_NEGARA += 2
  }

  // ─── GUARD PENALTY KHUSUS ANTI-MISMATCH KABUPATEN / RUTINITAS DAERAH ───
  // Jika berita memuat rutinitas daerah tingkat kabupaten/kota (misal Ciamis, Pemkab, santunan lokal, stunting):
  // HAPUS SKOR POLITIK_NEGARA KARENA BUKAN POLITIK STRATEGIS KENEGARAAN!
  const MUNICIPAL_LOCAL_INDICATORS = [
    'pemerintah kabupaten', 'pemkab', 'pemkot', 'pemerintah kota', 'kabupaten ciamis',
    'ciamis', 'bupati', 'walikota', 'kecamatan', 'kelurahan', 'desa', 'stunting',
    'santunan balita', 'balita', 'posyandu', 'pkk', 'dinas kesehatan daerah',
    'dinas sosial daerah'
  ]
  const hasLocalMunicipalIndicator = MUNICIPAL_LOCAL_INDICATORS.some(ind => text.includes(ind))
  if (hasLocalMunicipalIndicator) {
    // Penalti keras untuk Politik Negara: berita santunan stunting kabupaten BUKAN Politik Negara!
    scores.POLITIK_NEGARA = Math.max(0, scores.POLITIK_NEGARA - 8)
  }

  // ─── PENENTUAN KLASTER TERTINGGI SECARA DETERMINISTIK ───
  let highestScore = 0
  let bestCluster: ThreatSpectrumCluster = 'UMUM_NETRAL'

  // Periksa urutan prioritas jika skor sama
  const clusterPriority: ThreatSpectrumCluster[] = [
    'SIBER_PERETASAN',
    'KEDAULATAN_MILITER',
    'BENCANA_DARURAT',
    'PENIPUAN_BANSOS',
    'AKSI_MASSA',
    'KESEHATAN_PANGAN',
    'EKONOMI_DIGITAL',
    'POLITIK_NEGARA',
    'UMUM_NETRAL'
  ]

  for (const c of clusterPriority) {
    if (scores[c] > highestScore) {
      highestScore = scores[c]
      bestCluster = c
    }
  }

  // Jika skor tertinggi tetap 0 atau hanya match lemah:
  // JANGAN langsung lempar ke POLITIK_NEGARA!
  // Gunakan fallbackCluster jika sah, atau UMUM_NETRAL
  if (highestScore === 0) {
    if (fallbackCluster && fallbackCluster !== 'POLITIK_NEGARA') {
      bestCluster = fallbackCluster
    } else {
      bestCluster = 'UMUM_NETRAL'
    }
  }

  // Jika hasil bestCluster adalah KESEHATAN_PANGAN:
  // Selaras dengan spesifikasi konsol UI PUSSIBERAD, dipetakan ke UMUM_NETRAL (Umum & Kedinasan)
  if (bestCluster === 'KESEHATAN_PANGAN') {
    bestCluster = 'UMUM_NETRAL'
  }

  return {
    cluster: bestCluster,
    scores,
    matchedKeywords,
    reasoning: `Klaster terpilih: ${bestCluster} (Skor: ${highestScore})`
  }
}
