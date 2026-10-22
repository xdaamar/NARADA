import type { ContentCategory, ThreatSpectrumCluster } from '../types'

export interface TaxonomyEntry {
  keyword: string
  weight: number // 1 - 10 (10 = highest risk)
  category: ContentCategory
  spectrumCluster: ThreatSpectrumCluster
  categoryDetail:
    | 'POLITIK_NEGARA'
    | 'BENCANA_DARURAT'
    | 'PENIPUAN_BANSOS'
    | 'KESEHATAN_PANGAN'
    | 'KEDAULATAN_MILITER'
    | 'SEPARATISME'
    | 'FITNAH_MILITER'
    | 'SARA_POLARISASI'
    | 'BUZZER_AGITASI'
    | 'HOAKS_FABRIKASI'
  explanationTemplate: string
}

export interface StrategicEntity {
  name: string
  aliases: string[]
  type: 'INSTITUSI' | 'PIMPINAN' | 'SATUAN' | 'WILAYAH_STRATEGIS' | 'LEMBAGA_PUBLIK'
}

// ─── Target Entitas Strategis Nasional & Lembaga Publik (Spektrum Ganda) ───
export const STRATEGIC_ENTITIES: StrategicEntity[] = [
  // Pertahanan & Keamanan
  { name: 'TNI AD', aliases: ['tni ad', 'angkatan darat', 'tni-ad', 'tentara nasional indonesia', 'kodim', 'koramil', 'babinsa', 'prajurit tni'], type: 'INSTITUSI' },
  { name: 'Mabes TNI', aliases: ['mabes tni', 'panglima tni', 'cilangkap'], type: 'INSTITUSI' },
  { name: 'KASAD', aliases: ['kasad', 'ksad', 'kepala staf angkatan darat', 'jenderal tni'], type: 'PIMPINAN' },
  { name: 'Kemhan RI', aliases: ['kemhan', 'kementerian pertahanan', 'menhan', 'alutsista'], type: 'INSTITUSI' },
  { name: 'PUSSIBERAD', aliases: ['pussiberad', 'pussiber tni', 'siber tni ad', 'satgas siber'], type: 'SATUAN' },
  { name: 'Kopassus', aliases: ['kopassus', 'baret merah', 'korps baret merah'], type: 'SATUAN' },
  { name: 'Kostrad', aliases: ['kostrad', 'cakra', 'pangkostrad'], type: 'SATUAN' },
  { name: 'Kodam XVII/Cenderawasih', aliases: ['kodam cenderawasih', 'kodam xvii', 'papua', 'intan jaya', 'nduga'], type: 'WILAYAH_STRATEGIS' },
  { name: 'BSSN', aliases: ['bssn', 'badan siber dan sandi negara'], type: 'INSTITUSI' },
  { name: 'Polri', aliases: ['polri', 'kepolisian', 'kapolri', 'bareskrim', 'etle'], type: 'INSTITUSI' },

  // Lembaga Publik & Kebencanaan (OMSP)
  { name: 'BMKG', aliases: ['bmkg', 'badan meteorologi', 'klimatologi dan geofisika', 'seismologi'], type: 'LEMBAGA_PUBLIK' },
  { name: 'BNPB / BPBD', aliases: ['bnpb', 'bpbd', 'satgas bendung', 'katulampa', 'bpptkg'], type: 'LEMBAGA_PUBLIK' },
  { name: 'Kemensos RI', aliases: ['kemensos', 'kementerian sosial', 'mensos'], type: 'LEMBAGA_PUBLIK' },
  { name: 'Kemenkes / BPOM', aliases: ['kemenkes', 'bpom', 'badan pengawas obat'], type: 'LEMBAGA_PUBLIK' },
  { name: 'Setpres / Setwapres', aliases: ['setpres', 'setwapres', 'presiden prabowo', 'wapres gibran', 'sekretariat presiden'], type: 'PIMPINAN' },
  { name: 'MPR / DPR RI', aliases: ['mpr ri', 'dpr ri', 'ketua mpr', 'sidang istimewa'], type: 'LEMBAGA_PUBLIK' },
  { name: 'KPU / Bawaslu', aliases: ['kpu', 'bawaslu', 'mahkamah konstitusi'], type: 'LEMBAGA_PUBLIK' }
]

// ─── Taksonomi Spektrum Ganda (Pertahanan Militer + Perlindungan Sosial/Bencana) ───
export const FULL_SPECTRUM_TAXONOMY: TaxonomyEntry[] = [
  // ─── 1. KLASTER POLITIK & SUKSESI NEGARA ───
  { keyword: 'gibran dicopot', weight: 10, category: 'HOAKS', spectrumCluster: 'POLITIK_NEGARA', categoryDetail: 'POLITIK_NEGARA', explanationTemplate: 'Klaim pemecatan Wakil Presiden bertentangan dengan mekanisme konstitusi Pasal 7A/7B UUD 1945.' },
  { keyword: 'wapres dicopot', weight: 10, category: 'HOAKS', spectrumCluster: 'POLITIK_NEGARA', categoryDetail: 'POLITIK_NEGARA', explanationTemplate: 'Disinformasi pemakzulan Wakil Presiden RI tanpa dasar hukum sah.' },
  { keyword: 'gantikan prabowo', weight: 10, category: 'HOAKS', spectrumCluster: 'POLITIK_NEGARA', categoryDetail: 'POLITIK_NEGARA', explanationTemplate: 'Narasi suksesi inkonstitusional menggantikan Presiden RI aktif.' },
  { keyword: 'jokowi diangkat kembali', weight: 10, category: 'HOAKS', spectrumCluster: 'POLITIK_NEGARA', categoryDetail: 'POLITIK_NEGARA', explanationTemplate: 'Klaim manipulatif pengangkatan kembali mantan presiden menggantikan presiden sah.' },
  { keyword: 'surat pemecatan wapres', weight: 10, category: 'HOAKS', spectrumCluster: 'POLITIK_NEGARA', categoryDetail: 'POLITIK_NEGARA', explanationTemplate: 'Fabrikasi dokumen palsu pencopotan jabatan kepala negara.' },
  { keyword: 'prabowo koma', weight: 9, category: 'HOAKS', spectrumCluster: 'POLITIK_NEGARA', categoryDetail: 'POLITIK_NEGARA', explanationTemplate: 'Disinformasi kesehatan kepala negara untuk memicu kepanikan politik.' },
  { keyword: 'dpr membubarkan diri', weight: 9, category: 'HOAKS', spectrumCluster: 'POLITIK_NEGARA', categoryDetail: 'POLITIK_NEGARA', explanationTemplate: 'Hoaks pembubaran lembaga legislatif negara kesatuan.' },

  // ─── 2. KLASTER BENCANA ALAM & KEGAWATDARURATAN PUBLIK ───
  { keyword: 'gempa megathrust', weight: 10, category: 'HOAKS', spectrumCluster: 'BENCANA_DARURAT', categoryDetail: 'BENCANA_DARURAT', explanationTemplate: 'Prediksi waktu gempa secara spesifik melanggar hukum sains geofisika BMKG.' },
  { keyword: 'bendungan jebol', weight: 10, category: 'HOAKS', spectrumCluster: 'BENCANA_DARURAT', categoryDetail: 'BENCANA_DARURAT', explanationTemplate: 'Disinformasi jebolnya pintu air/bendungan yang memicu eksodus dan kepanikan banjir warga.' },
  { keyword: 'katulampa jebol', weight: 10, category: 'HOAKS', spectrumCluster: 'BENCANA_DARURAT', categoryDetail: 'BENCANA_DARURAT', explanationTemplate: 'Hoaks jebolnya Bendung Katulampa Bogor yang membantah data debit air resmi BPBD.' },
  { keyword: 'tsunami pelabuhan ratu', weight: 10, category: 'HOAKS', spectrumCluster: 'BENCANA_DARURAT', categoryDetail: 'BENCANA_DARURAT', explanationTemplate: 'Kepanikan fiktif tsunami 20 meter pesisir selatan mengabaikan pemantauan seismik riil.' },
  { keyword: 'gunung merapi meletus dahsyat', weight: 9, category: 'HOAKS', spectrumCluster: 'BENCANA_DARURAT', categoryDetail: 'BENCANA_DARURAT', explanationTemplate: 'Klaim status Awas fiktif yang dibantah pengamatan visual BPPTKG.' },
  { keyword: 'tangki gas bocor beracun', weight: 10, category: 'HOAKS', spectrumCluster: 'BENCANA_DARURAT', categoryDetail: 'BENCANA_DARURAT', explanationTemplate: 'Rekayasa ancaman gas beracun yang memicu kepanikan pengungsian liar.' },
  { keyword: 'tanggul laut jebol', weight: 9, category: 'HOAKS', spectrumCluster: 'BENCANA_DARURAT', categoryDetail: 'BENCANA_DARURAT', explanationTemplate: 'Disinformasi tenggelamnya Jakarta Utara akibat tanggul rob jebol.' },
  { keyword: 'air meluap jakarta', weight: 8, category: 'HOAKS', spectrumCluster: 'BENCANA_DARURAT', categoryDetail: 'BENCANA_DARURAT', explanationTemplate: 'Penyebaran video arsip banjir lama yang dinarasikan seolah kejadian baru malam ini.' },

  // ─── 3. KLASTER PENIPUAN SOSIAL & BANSOS (PHISHING) ───
  { keyword: 'bansos 5 juta', weight: 10, category: 'HOAKS', spectrumCluster: 'PENIPUAN_BANSOS', categoryDetail: 'PENIPUAN_BANSOS', explanationTemplate: 'Modus kejahatan siber phishing pencuri identitas KTP dan tabungan berkedok BLT Kemensos.' },
  { keyword: 'pendaftaran bansos', weight: 9, category: 'HOAKS', spectrumCluster: 'PENIPUAN_BANSOS', categoryDetail: 'PENIPUAN_BANSOS', explanationTemplate: 'Penyaluran bansos Kemensos tidak pernah melalui tautan pendaftaran domain gratisan.' },
  { keyword: 'kuota gratis 50 gb', weight: 8, category: 'HOAKS', spectrumCluster: 'PENIPUAN_BANSOS', categoryDetail: 'PENIPUAN_BANSOS', explanationTemplate: 'Tautan pencuri nomor ponsel (credential harvesting) berkedok kuota Kemendikbud.' },
  { keyword: 'file apk surat tilang', weight: 10, category: 'HOAKS', spectrumCluster: 'PENIPUAN_BANSOS', categoryDetail: 'PENIPUAN_BANSOS', explanationTemplate: 'Malware APK sniffing pencuri SMS OTP perbankan mengatasnamakan tilang ETLE Polri.' },
  { keyword: 'surat tilang apk', weight: 10, category: 'HOAKS', spectrumCluster: 'PENIPUAN_BANSOS', categoryDetail: 'PENIPUAN_BANSOS', explanationTemplate: 'Modus rekayasa sosial APK berbahaya mencatut kepolisian.' },
  { keyword: 'undangan pernikahan apk', weight: 10, category: 'HOAKS', spectrumCluster: 'PENIPUAN_BANSOS', categoryDetail: 'PENIPUAN_BANSOS', explanationTemplate: 'Modus kejahatan malware perbankan melalui kiriman file APK di pesan WhatsApp.' },
  { keyword: 'loker pertamina gaji', weight: 8, category: 'HOAKS', spectrumCluster: 'PENIPUAN_BANSOS', categoryDetail: 'PENIPUAN_BANSOS', explanationTemplate: 'Sindikat penipuan rekrutmen kerja fiktif dengan pungutan biaya seragam/tiket.' },

  // ─── 4. KLASTER KESEHATAN & PANGAN SINTETIS ───
  { keyword: 'beras plastik', weight: 9, category: 'HOAKS', spectrumCluster: 'KESEHATAN_PANGAN', categoryDetail: 'KESEHATAN_PANGAN', explanationTemplate: 'Mitos beras sintetis yang dibantah hasil uji laboratorium pangan BPOM dan Kementan.' },
  { keyword: 'penculikan anak organ', weight: 10, category: 'HOAKS', spectrumCluster: 'KESEHATAN_PANGAN', categoryDetail: 'KESEHATAN_PANGAN', explanationTemplate: 'Hoaks teror berantai penculikan anak mobil putih pemicu keresahan sosial dan persekusi.' },
  { keyword: 'vaksin mikrocip', weight: 9, category: 'HOAKS', spectrumCluster: 'KESEHATAN_PANGAN', categoryDetail: 'KESEHATAN_PANGAN', explanationTemplate: 'Teori konspirasi medis global yang merusak program imunisasi kesehatan publik.' },
  { keyword: 'sirup maut anak', weight: 8, category: 'DISINFORMASI', spectrumCluster: 'KESEHATAN_PANGAN', categoryDetail: 'KESEHATAN_PANGAN', explanationTemplate: 'Penyebaran kembali daftar obat sirup cemaran tahun 2022 tanpa konteks regulasi terkini.' },
  { keyword: 'telur palsu buatan china', weight: 8, category: 'HOAKS', spectrumCluster: 'KESEHATAN_PANGAN', categoryDetail: 'KESEHATAN_PANGAN', explanationTemplate: 'Rumor telur lilin sintetis yang merugikan peternak ayam petelur lokal.' },
  { keyword: 'nyamuk wolbachia bahaya', weight: 8, category: 'HOAKS', spectrumCluster: 'KESEHATAN_PANGAN', categoryDetail: 'KESEHATAN_PANGAN', explanationTemplate: 'Disinformasi rekayasa genetik yang membantah riset resmi pencegahan DBD UGM & Kemenkes.' },

  // ─── 5. KLASTER KEDAULATAN & PERTAHANAN MILITER ───
  { keyword: 'alutsista 24 triliun', weight: 10, category: 'HOAKS', spectrumCluster: 'KEDAULATAN_MILITER', categoryDetail: 'FITNAH_MILITER', explanationTemplate: 'Fitnah pengadaan alutsista tank fiktif 24T Kemhan yang memanipulasi dokumen rahasia.' },
  { keyword: 'tank fiktif', weight: 10, category: 'HOAKS', spectrumCluster: 'KEDAULATAN_MILITER', categoryDetail: 'FITNAH_MILITER', explanationTemplate: 'Fabrikasi dokumen pengadaan senjata palsu untuk mendiskreditkan Kemhan RI.' },
  { keyword: 'tentara asing morowali', weight: 10, category: 'HOAKS', spectrumCluster: 'KEDAULATAN_MILITER', categoryDetail: 'FITNAH_MILITER', explanationTemplate: 'Video pekerja sipil berseragam proyek yang difitnah sebagai pasukan militer asing.' },
  { keyword: 'tni menembaki warga', weight: 10, category: 'PROPAGANDA', spectrumCluster: 'KEDAULATAN_MILITER', categoryDetail: 'SEPARATISME', explanationTemplate: 'Propaganda delegitimasi operasi pengamanan teritorial TNI oleh kelompok separatis bersenjata.' },
  { keyword: 'kedaulatan natuna diserahkan', weight: 10, category: 'HOAKS', spectrumCluster: 'KEDAULATAN_MILITER', categoryDetail: 'FITNAH_MILITER', explanationTemplate: 'Disinformasi penyerahan pulau kedaulatan NKRI kepada negara asing.' },
  { keyword: 'pangkalan militer asing riau', weight: 10, category: 'HOAKS', spectrumCluster: 'KEDAULATAN_MILITER', categoryDetail: 'FITNAH_MILITER', explanationTemplate: 'Isu berdirinya basis militer asing yang bertentangan dengan doktrin pertahanan bebas aktif.' },
  { keyword: 'opm', weight: 10, category: 'PROPAGANDA', spectrumCluster: 'KEDAULATAN_MILITER', categoryDetail: 'SEPARATISME', explanationTemplate: 'Propaganda separatisme bersenjata yang mengancam keutuhan NKRI.' },
  { keyword: 'kkb papua', weight: 10, category: 'PROPAGANDA', spectrumCluster: 'KEDAULATAN_MILITER', categoryDetail: 'SEPARATISME', explanationTemplate: 'Agitasi kelompok kriminal bersenjata di wilayah teritorial Papua.' },
  { keyword: 'papua merdeka', weight: 9, category: 'PROPAGANDA', spectrumCluster: 'KEDAULATAN_MILITER', categoryDetail: 'SEPARATISME', explanationTemplate: 'Narasi disintegrasi wilayah kedaulatan NKRI.' },
  { keyword: 'referendum papua', weight: 9, category: 'PROPAGANDA', spectrumCluster: 'KEDAULATAN_MILITER', categoryDetail: 'SEPARATISME', explanationTemplate: 'Ajakan referendum ilegal untuk memisahkan diri dari negara kesatuan.' },
  { keyword: 'boikot tni', weight: 8, category: 'BUZZER', spectrumCluster: 'KEDAULATAN_MILITER', categoryDetail: 'BUZZER_AGITASI', explanationTemplate: 'Kampanye terkoordinasi pelemahan legitimasi TNI di ruang publik.' },
  { keyword: 'perang saudara', weight: 10, category: 'PROPAGANDA', spectrumCluster: 'KEDAULATAN_MILITER', categoryDetail: 'SARA_POLARISASI', explanationTemplate: 'Ajakan destruktif benturan horizontal antar elemen anak bangsa.' },
  { keyword: 'viralkan sekarang', weight: 6, category: 'BUZZER', spectrumCluster: 'UMUM_NETRAL', categoryDetail: 'BUZZER_AGITASI', explanationTemplate: 'Pola amplifikasi terkoordinasi buzzer media sosial.' }
]

// Backward-compatible alias
export const MILITARY_TAXONOMY = FULL_SPECTRUM_TAXONOMY

/**
 * Mendeteksi entitas militer dan lembaga strategis yang disebut di dalam teks
 */
export function extractMilitaryEntities(text: string): string[] {
  if (!text) return []
  const normalized = text.toLowerCase()
  const detected: string[] = []

  for (const entity of STRATEGIC_ENTITIES) {
    if (entity.aliases.some(alias => normalized.includes(alias))) {
      detected.push(entity.name)
    }
  }

  return [...new Set(detected)]
}
