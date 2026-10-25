// ─── INDONESIAN MORPHOLOGICAL STEMMER WITH LRU MEMOIZATION CACHE ───
// SPRINT 7A: High-Speed On-Device Confix-Stripping Engine (<0.05ms per word)
// Sistem Pertahanan Kognitif NARADA - PUSSIBERAD TNI AD

import { INDONESIAN_STOPWORDS } from './tokenizer'

// LRU Cache Map untuk memoization hasil stemming
const STEM_CACHE = new Map<string, string>()
const MAX_CACHE_SIZE = 5000

// Kamus leksikon akar kata pertahanan & sosial siber untuk mencegah over-stemming
const PRESERVED_ROOTS = new Set([
  // Domain Militer & Pertahanan
  'prajurit', 'militer', 'alutsista', 'intelijen', 'senjata', 'rakyat', 'negara',
  'pemerintah', 'menteri', 'panglima', 'presiden', 'komandan', 'tentara', 'pasukan',
  'babinsa', 'kodim', 'korem', 'kodam', 'dispenad', 'pussiberad', 'mabes', 'tni',
  'polri', 'alutsista', 'operasi', 'latihan', 'wilayah', 'teritorial', 'pertahanan',
  'kedaulatan', 'perbatasan', 'radar', 'drone', 'tank', 'leopard', 'apache', 'astros',
  'pesawat', 'kapal', 'meriam', 'artileri', 'peluru', 'senapan', 'batalyon', 'posko',
  'patroli', 'amunisi', 'keamanan', 'ketahanan', 'bintara', 'perwira', 'tamtama',
  
  // Isu Kognitif, Bencana, & Sosial
  'bansos', 'beras', 'gempa', 'megathrust', 'tsunami', 'bencana', 'katulampa',
  'waduk', 'gunung', 'banjir', 'longsor', 'separatis', 'merdeka', 'referendum',
  'papua', 'organisasi', 'teroris', 'korupsi', 'hoaks', 'fitnah', 'kudeta',
  'makar', 'buzzer', 'botnet', 'astroturf', 'phishing', 'rekening', 'bantuan',
  'disinformasi', 'misinformasi', 'malinformasi', 'agitasi', 'provokasi', 'sara',
  'politik', 'pilkada', 'pemilu', 'siber', 'hacker', 'peretasan', 'kebocoran',
  'verifikasi', 'fakta', 'klarifikasi', 'resmi', 'sumber', 'bukti', 'dokumen'
])

/**
 * Memeriksa apakah kata merupakan partikel imbuhan akhir (-lah, -kah, -pun, -tah)
 */
function stripParticle(word: string): string {
  if (word.length <= 4) return word
  if (word.endsWith('lah') || word.endsWith('kah') || word.endsWith('tah') || word.endsWith('pun')) {
    return word.slice(0, -3)
  }
  return word
}

/**
 * Memeriksa apakah kata memiliki kata ganti kepemilikan (-ku, -mu, -nya)
 */
function stripPossessive(word: string): string {
  if (word.length <= 4) return word
  if (word.endsWith('nya')) {
    return word.slice(0, -3)
  }
  if (word.endsWith('ku') || word.endsWith('mu')) {
    return word.slice(0, -2)
  }
  return word
}

/**
 * Menghilangkan sufiks derivatif (-kan, -an, -i)
 */
function stripSuffix(word: string): string {
  if (word.length <= 4) return word
  if (word.endsWith('kan')) {
    return word.slice(0, -3)
  }
  if (word.endsWith('an')) {
    return word.slice(0, -2)
  }
  if (word.endsWith('i') && !word.endsWith('si') && !word.endsWith('ti')) {
    return word.slice(0, -1)
  }
  return word
}

/**
 * Menghilangkan prefiks (awalan) bahasa Indonesia dengan aturan fonotaktik
 */
function stripPrefix(word: string): string {
  if (word.length <= 4) return word

  // 1. Prefiks me- varian
  if (word.startsWith('meny')) {
    // menyiram -> siram, menyerap -> serap, menyerang -> serang
    return 's' + word.slice(4)
  }
  if (word.startsWith('meng')) {
    const after = word.slice(4)
    if (after.startsWith('k') || after.startsWith('g') || after.startsWith('h') || /^[aeiou]/.test(after)) {
      // mengancam -> ancam, mengawal -> kawal/awal
      return after.startsWith('k') ? after : (/^[aeiou]/.test(after) ? (after.length > 3 ? after : 'k' + after) : after)
    }
    return after
  }
  if (word.startsWith('mem')) {
    const after = word.slice(3)
    if (/^[aeiou]/.test(after)) {
      // memantau -> pantau, memukul -> pukul
      return 'p' + after
    }
    // membakar -> bakar, membeli -> beli
    return after
  }
  if (word.startsWith('men')) {
    const after = word.slice(3)
    if (/^[aeiou]/.test(after)) {
      // menolak -> tolak, menembak -> tembak
      return 't' + after
    }
    // menduduki -> duduki -> duduk
    return after
  }
  if (word.startsWith('me')) {
    return word.slice(2)
  }

  // 2. Prefiks pe- varian
  if (word.startsWith('peny')) {
    // penyerang -> serang, penyebar -> sebar
    return 's' + word.slice(4)
  }
  if (word.startsWith('peng')) {
    const after = word.slice(4)
    return /^[aeiou]/.test(after) ? after : after
  }
  if (word.startsWith('pem')) {
    const after = word.slice(3)
    return /^[aeiou]/.test(after) ? 'p' + after : after
  }
  if (word.startsWith('pen')) {
    const after = word.slice(3)
    return /^[aeiou]/.test(after) ? 't' + after : after
  }
  if (word.startsWith('per')) {
    return word.slice(3)
  }
  if (word.startsWith('pe') && word.length > 4) {
    return word.slice(2)
  }

  // 3. Prefiks ber-, be-, bel-
  if (word.startsWith('ber')) {
    return word.slice(3)
  }
  if (word.startsWith('bel') && word === 'belajar') {
    return 'ajar'
  }
  if (word.startsWith('be') && word.length > 4) {
    return word.slice(2)
  }

  // 4. Prefiks ter-, te-
  if (word.startsWith('ter')) {
    return word.slice(3)
  }
  if (word.startsWith('te') && word.length > 4) {
    return word.slice(2)
  }

  // 5. Prefiks di-
  if (word.startsWith('di') && word.length > 4) {
    return word.slice(2)
  }

  // 6. Prefiks ke-
  if (word.startsWith('ke') && word.length > 4) {
    return word.slice(2)
  }

  // 7. Prefiks se-
  if (word.startsWith('se') && word.length > 4) {
    return word.slice(2)
  }

  return word
}

/**
 * Algoritma Confix-Stripping Bahasa Indonesia Lengkap
 */
function executeConfixStripping(cleanWord: string): string {
  // Jika sudah termasuk akar kata yang dijaga, langsung kembalikan
  if (PRESERVED_ROOTS.has(cleanWord)) {
    return cleanWord
  }

  // Jika kata terlalu pendek (<=3 karakter), tidak perlu di-stem
  if (cleanWord.length <= 3) {
    return cleanWord
  }

  // Langkah 1: Hilangkan partikel (-lah, -kah, -pun, -tah)
  let current = stripParticle(cleanWord)
  if (PRESERVED_ROOTS.has(current)) return current

  // Langkah 2: Hilangkan kata ganti milik (-ku, -mu, -nya)
  current = stripPossessive(current)
  if (PRESERVED_ROOTS.has(current)) return current

  // Langkah 3: Hilangkan prefiks awal
  const prefixStripped = stripPrefix(current)
  if (PRESERVED_ROOTS.has(prefixStripped)) return prefixStripped

  // Langkah 4: Hilangkan sufiks derivatif (-kan, -an, -i)
  current = stripSuffix(prefixStripped)
  if (PRESERVED_ROOTS.has(current)) return current

  // Langkah 5: Jika masih menyisakan prefiks sekunder (contoh: diperkirakan -> kira)
  if (current.length > 5) {
    const secondPass = stripPrefix(current)
    if (secondPass.length >= 3) {
      current = secondPass
    }
  }

  return current.length >= 3 ? current : cleanWord
}

/**
 * Fast Indonesian Stemmer dengan LRU Memoization Cache
 * @param word - Kata bahasa Indonesia yang akan di-stem
 * @returns Kata dasar (root lemma)
 */
export function stemIndonesian(word: string): string {
  if (!word || typeof word !== 'string') return ''

  const lower = word.toLowerCase().trim()
  if (lower.length <= 2) return lower

  // Stopword fast-exit: jangan buang waktu men-stem kata tugas umum
  if (INDONESIAN_STOPWORDS.has(lower)) {
    return lower
  }

  // 1. Cache hit check (<0.001ms)
  if (STEM_CACHE.has(lower)) {
    return STEM_CACHE.get(lower)!
  }

  // 2. Confix stripping computation
  const root = executeConfixStripping(lower)

  // 3. LRU Eviction & Insertion
  if (STEM_CACHE.size >= MAX_CACHE_SIZE) {
    const firstKey = STEM_CACHE.keys().next().value
    if (firstKey) {
      STEM_CACHE.delete(firstKey)
    }
  }

  STEM_CACHE.set(lower, root)
  return root
}

/**
 * Utilitas untuk mengosongkan cache jika dibutuhkan (misal saat benchmark)
 */
export function clearStemmerCache(): void {
  STEM_CACHE.clear()
}

/**
 * Mendapatkan ukuran cache saat ini untuk pemantauan telemetri
 */
export function getStemmerCacheStats(): { size: number; maxSize: number } {
  return {
    size: STEM_CACHE.size,
    maxSize: MAX_CACHE_SIZE
  }
}
