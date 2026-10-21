import type { ContentCategory } from '../types'

export interface TaxonomyEntry {
  keyword: string
  weight: number // 1 - 10 (10 = highest risk)
  category: ContentCategory
  categoryDetail: 'SEPARATISME' | 'FITNAH_MILITER' | 'SARA_POLARISASI' | 'BUZZER_AGITASI' | 'HOAKS_FABRIKASI'
  explanationTemplate: string
}

export interface MilitaryEntity {
  name: string
  aliases: string[]
  type: 'INSTITUSI' | 'PIMPINAN' | 'SATUAN' | 'WILAYAH_STRATEGIS'
}

// ─── Target Entitas Militer & Strategis Nasional ───
export const STRATEGIC_ENTITIES: MilitaryEntity[] = [
  { name: 'TNI AD', aliases: ['tni ad', 'angkatan darat', 'tni-ad', 'tentara nasional indonesia'], type: 'INSTITUSI' },
  { name: 'Mabes TNI', aliases: ['mabes tni', 'panglima tni', 'cilangkap'], type: 'INSTITUSI' },
  { name: 'KASAD', aliases: ['kasad', 'ksad', 'kepala staf angkatan darat', 'jenderal tni'], type: 'PIMPINAN' },
  { name: 'PUSSIBERAD', aliases: ['pussiberad', 'pussiber tni', 'siber tni ad', 'satgas siber'], type: 'SATUAN' },
  { name: 'Kopassus', aliases: ['kopassus', 'baret merah', 'korps baret merah'], type: 'SATUAN' },
  { name: 'Kostrad', aliases: ['kostrad', 'cakra', 'pangkostrad'], type: 'SATUAN' },
  { name: 'Kodam XVII/Cenderawasih', aliases: ['kodam cenderawasih', 'kodam xvii', 'papua', 'intan jaya', 'nduga'], type: 'WILAYAH_STRATEGIS' },
  { name: 'Kemhan RI', aliases: ['kemhan', 'kementerian pertahanan', 'menhan', 'alutsista'], type: 'INSTITUSI' },
  { name: 'BSSN', aliases: ['bssn', 'badan siber dan sandi negara'], type: 'INSTITUSI' },
]

// ─── Taksonomi Ancaman Kognitif Khusus Matra Darat & Siber Sosial ───
export const MILITARY_TAXONOMY: TaxonomyEntry[] = [
  // 1. Kedaulatan & Separatisme Teritorial (High-Impact Threat)
  { keyword: 'opm', weight: 10, category: 'PROPAGANDA', categoryDetail: 'SEPARATISME', explanationTemplate: 'Propaganda separatisme bersenjata yang mengancam keutuhan NKRI.' },
  { keyword: 'kkb papua', weight: 10, category: 'PROPAGANDA', categoryDetail: 'SEPARATISME', explanationTemplate: 'Agitasi kelompok kriminal bersenjata di wilayah teritorial Papua.' },
  { keyword: 'papua merdeka', weight: 9, category: 'PROPAGANDA', categoryDetail: 'SEPARATISME', explanationTemplate: 'Narasi disintegrasi wilayah kedaulatan NKRI.' },
  { keyword: 'referendum', weight: 8, category: 'PROPAGANDA', categoryDetail: 'SEPARATISME', explanationTemplate: 'Ajakan referendum ilegal untuk memisahkan diri dari negara kesatuan.' },
  { keyword: 'tentara kolonial', weight: 9, category: 'PROPAGANDA', categoryDetail: 'SEPARATISME', explanationTemplate: 'Stigmatisasi TNI sebagai pasukan penindas untuk mencari simpati internasional.' },
  { keyword: 'genocida papua', weight: 10, category: 'HOAKS', categoryDetail: 'SEPARATISME', explanationTemplate: 'Fitnah pelanggaran HAM berat yang direkayasa mendiskreditkan operasi pengamanan TNI.' },
  { keyword: 'bakar pos militer', weight: 8, category: 'PROPAGANDA', categoryDetail: 'SEPARATISME', explanationTemplate: 'Provokasi penyerangan pos komando militer di daerah rawan.' },

  // 2. Delegitimasi & Fitnah Institusi TNI (Information Warfare)
  { keyword: 'alutsista rongsokan', weight: 8, category: 'DISINFORMASI', categoryDetail: 'FITNAH_MILITER', explanationTemplate: 'Upaya mendiskreditkan kesiapan alutsista dan modernisasi pertahanan darat.' },
  { keyword: 'korupsi alutsista', weight: 8, category: 'HOAKS', categoryDetail: 'FITNAH_MILITER', explanationTemplate: 'Disinformasi pengadaan senjata untuk merusak kepercayaan publik pada Kemhan & TNI.' },
  { keyword: 'tni serang warga', weight: 9, category: 'HOAKS', categoryDetail: 'FITNAH_MILITER', explanationTemplate: 'Narasi adu domba antara prajurit TNI dan masyarakat sipil.' },
  { keyword: 'pembangkangan prajurit', weight: 9, category: 'PROPAGANDA', categoryDetail: 'FITNAH_MILITER', explanationTemplate: 'Isu perpecahan internal di tubuh komando militer untuk melemahkan moril.' },
  { keyword: 'kudeta militer', weight: 10, category: 'HOAKS', categoryDetail: 'FITNAH_MILITER', explanationTemplate: 'Hoaks makar dan perebutan kekuasaan yang berpotensi memicu instabilitas nasional.' },
  { keyword: 'jenderal khianat', weight: 9, category: 'HOAKS', categoryDetail: 'FITNAH_MILITER', explanationTemplate: 'Pembunuhan karakter pimpinan satuan TNI untuk memecah soliditas komando.' },

  // 3. Polarisasi SARA & Pembelahan Sosial (Social Cleavage)
  { keyword: 'perang saudara', weight: 10, category: 'PROPAGANDA', categoryDetail: 'SARA_POLARISASI', explanationTemplate: 'Ajakan destruktif benturan horizontal antar elemen anak bangsa.' },
  { keyword: 'pribumi vs non pribumi', weight: 8, category: 'PROPAGANDA', categoryDetail: 'SARA_POLARISASI', explanationTemplate: 'Agitasi rasial yang mengancam persatuan dan Bhinneka Tunggal Ika.' },
  { keyword: 'bakar tempat ibadah', weight: 9, category: 'HOAKS', categoryDetail: 'SARA_POLARISASI', explanationTemplate: 'Pemicu konflik horizontal berbasis provokasi tempat suci agama.' },
  { keyword: 'pembantaian ulama', weight: 9, category: 'HOAKS', categoryDetail: 'SARA_POLARISASI', explanationTemplate: 'Narasi hoaks berulang untuk memicu kemarahan kelompok agama tertentu.' },
  { keyword: 'rezim komunis', weight: 8, category: 'PROPAGANDA', categoryDetail: 'SARA_POLARISASI', explanationTemplate: 'Stigma politik ideologis masa lalu yang dihidupkan untuk polarisasi.' },

  // 4. Pola Buzzer & Agitasi Digital (Astroturfing & Mobilization)
  { keyword: 'viralkan', weight: 6, category: 'BUZZER', categoryDetail: 'BUZZER_AGITASI', explanationTemplate: 'Pola amplifikasi terkoordinasi untuk memaksakan isu menjadi trending.' },
  { keyword: 'serbu akun', weight: 7, category: 'BUZZER', categoryDetail: 'BUZZER_AGITASI', explanationTemplate: 'Instruksi pengerahan massa siber (cyber mobbing) ke akun institusi.' },
  { keyword: 'kepung markas', weight: 10, category: 'PROPAGANDA', categoryDetail: 'BUZZER_AGITASI', explanationTemplate: 'Provokasi fisik pengerahan massa menuju instalasi militer.' },
  { keyword: 'boikot tni', weight: 8, category: 'BUZZER', categoryDetail: 'BUZZER_AGITASI', explanationTemplate: 'Kampanye terkoordinasi pelemahan legitimasi TNI di ruang publik.' },
  { keyword: 'jangan takut aparat', weight: 8, category: 'PROPAGANDA', categoryDetail: 'BUZZER_AGITASI', explanationTemplate: 'Ajakan pembangkangan hukum dan konfrontasi fisik terhadap aparat keamanan.' },

  // 5. Hoaks & Fabrikasi Berita (Information Fabrications)
  { keyword: 'info a1 orang dalam', weight: 7, category: 'HOAKS', categoryDetail: 'HOAKS_FABRIKASI', explanationTemplate: 'Klaim sumber internal palsu untuk memberi kesan kredibel pada disinformasi.' },
  { keyword: 'sebelum dihapus aparat', weight: 7, category: 'HOAKS', categoryDetail: 'HOAKS_FABRIKASI', explanationTemplate: 'Psikologi urgensi palsu agar pembaca segera menyebarkan tanpa verifikasi.' },
  { keyword: 'video bocor', weight: 6, category: 'DISINFORMASI', categoryDetail: 'HOAKS_FABRIKASI', explanationTemplate: 'Manipulasi visual lama yang dinarasikan seolah kejadian baru di wilayah operasi.' },
  { keyword: 'rahasia terbongkar', weight: 6, category: 'HOAKS', categoryDetail: 'HOAKS_FABRIKASI', explanationTemplate: 'Teknik clickbait konspiratif untuk menarik rasa penasaran publik.' },
]

/**
 * Mendeteksi entitas militer yang disebut di dalam teks
 */
export function extractMilitaryEntities(text: string): string[] {
  const normalized = text.toLowerCase()
  const detected: string[] = []

  for (const entity of STRATEGIC_ENTITIES) {
    if (entity.aliases.some(alias => normalized.includes(alias))) {
      detected.push(entity.name)
    }
  }

  return [...new Set(detected)]
}
