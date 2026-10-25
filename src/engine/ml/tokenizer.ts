// ─── INDONESIAN TOKENIZER & PREPROCESSOR (UPGRADE SPRINT 7A) ───
// Berdasarkan PRD_02_ai_engine.md & SPRINT_7A_NLP_COMPILED_ML_ENGINE.md
// Dilengkapi Indonesian Morphological Stemmer, N-Gram Collocation (1-2-3 Grams), & LRU Caching

import { stemIndonesian } from './stemmer'

// Daftar stopword umum bahasa Indonesia (~150 kata hubung/tugas non-substansial)
export const INDONESIAN_STOPWORDS = new Set([
  'ada', 'adalah', 'adanya', 'adapun', 'agak', 'agar', 'akan', 'akankah', 'akhir', 'akhiri',
  'akhirnya', 'aku', 'akulah', 'amat', 'amatlah', 'anda', 'andalah', 'antar', 'antara', 'antaranya',
  'apa', 'apaan', 'apabila', 'apakah', 'apalagi', 'apatah', 'atau', 'ataukah', 'ataupun', 'awal',
  'awalnya', 'bagai', 'bagaikan', 'bagaimana', 'bagaimanakah', 'bagaimanapun', 'bagi', 'bagian',
  'bahkan', 'bahwa', 'bahwasanya', 'baik', 'bakal', 'bakalan', 'balik', 'banyak', 'bapak', 'barangkali',
  'baru', 'bawah', 'beberapa', 'begini', 'beginian', 'beginikah', 'beginilah', 'begitu', 'begitukah',
  'begitulah', 'begitupun', 'bekerja', 'belakang', 'belakangan', 'belum', 'belumlah', 'benar', 'benarkah',
  'benarlah', 'berada', 'berakhir', 'berakhirlah', 'berakhirnya', 'berapa', 'berapakah', 'berapalah',
  'berapapun', 'berarti', 'berawal', 'berbagai', 'berdatangan', 'beri', 'berikan', 'berikut', 'berikutnya',
  'berjumlah', 'berkala', 'berkali-kali', 'berkata', 'berkehendak', 'berkeinginan', 'berkenaan', 'berlainan',
  'berlalu', 'berlangsung', 'berlebihan', 'bermacam-macam', 'bermaksud', 'bermula', 'bersama', 'bersama-sama',
  'bersiap', 'bersiap-siap', 'bertanya', 'bertanya-tanya', 'berturut', 'berturut-turut', 'bertutur',
  'berujar', 'berupa', 'besar', 'betul', 'betulkah', 'biasa', 'biasanya', 'bila', 'bilakah', 'bisa',
  'bisakah', 'boleh', 'bolehkah', 'bolehlah', 'buat', 'bukan', 'bukankah', 'bukanlah', 'bukannya',
  'cuma', 'dan', 'dapat', 'dari', 'daripada', 'dekat', 'demi', 'demikian', 'demikianlah', 'dengan',
  'depan', 'di', 'dia', 'dialah', 'diantara', 'diantaranya', 'diberi', 'diberikan', 'diberikannya',
  'dibuat', 'dibuatnya', 'didapat', 'didatangkan', 'digunakan', 'diibaratkan', 'diibaratkannya',
  'diingat', 'diingatkan', 'diinginkan', 'dijawab', 'dijelaskan', 'dijelaskannya', 'dikarenakan',
  'dikatakan', 'dikatakannya', 'dikerjakan', 'diketahui', 'diketahuinya', 'dikira', 'dilakukan',
  'dilalui', 'dilihat', 'dimaksud', 'dimaksudkan', 'dimaksudkannya', 'dimaksudnya', 'diminta',
  'dimintai', 'dimisalkan', 'dimulai', 'dimulailah', 'dimulainya', 'dimungkinkan', 'dini', 'dipastikan',
  'diperbuat', 'diperbuatnya', 'dipergunakan', 'diperkirakan', 'diperlihatkan', 'diperlukan',
  'diperlukannya', 'dipersoalkan', 'dipertanyakan', 'dipunyai', 'diri', 'dirinya', 'disampaikan',
  'disebut', 'disebutkan', 'disebutkannya', 'disini', 'disinilah', 'disitulah', 'ditambahkan',
  'ditandaskan', 'ditanya', 'ditanyai', 'ditanyakan', 'ditegaskan', 'ditemukan', 'ditentukan',
  'ditentukannya', 'diterangkan', 'diterangkannya', 'diteruskan', 'ditiba', 'ditujukan', 'ditunjuk',
  'ditunjuki', 'ditunjukkan', 'ditunjukkannya', 'ditunjuknya', 'dituturkan', 'dituturkannya',
  'diucapkan', 'diucapkannya', 'diungkapkan', 'dong', 'dulu', 'empat', 'enggak', 'enggaknya',
  'entah', 'entahlah', 'hal', 'hampir', 'hanya', 'hanyalah', 'harus', 'haruslah', 'harusnya',
  'ia', 'ialah', 'ibarat', 'ibaratkan', 'ibaratnya', 'ibu', 'ikut', 'ingat', 'ingat-ingat', 'ingin',
  'inginkah', 'inginkan', 'ini', 'inikah', 'inilah', 'itu', 'itukah', 'itulah', 'jadi', 'jadilah',
  'jadinya', 'jangan', 'jangankan', 'janganlah', 'jauh', 'jelas', 'jelaskan', 'jelaslah', 'jelasnya',
  'jika', 'jikalau', 'juga', 'jumlah', 'jumlahnya', 'justru', 'kala', 'kalau', 'kalaulah', 'kalaupun',
  'kalian', 'kami', 'kamilah', 'kamu', 'kamulah', 'kan', 'kapan', 'kapankah', 'kapanpun', 'karena',
  'karenanya', 'kasus', 'kata', 'katakan', 'katakanlah', 'katanya', 'ke', 'keadaan', 'kebetulan',
  'keduanya', 'keempat', 'keinginan', 'kelamaan', 'kelihatan', 'kelihatannya', 'kelima', 'keluar',
  'kembali', 'kemudian', 'kemungkinan', 'kemungkinannya', 'kenapa', 'kepada', 'kepadanya', 'kesampaian',
  'keseluruhan', 'keseluruhannya', 'keterlaluan', 'ketika', 'khususnya', 'kini', 'kinilah', 'kira',
  'kira-kira', 'kiranya', 'kita', 'kitalah', 'kok', 'kurang', 'lagi', 'lagian', 'lah', 'lain',
  'lainnya', 'lalu', 'lama', 'lamanya', 'lanjut', 'lanjutnya', 'lebih', 'lewat', 'macam', 'maka',
  'makanya', 'makin', 'malah', 'malahan', 'mampu', 'mampukah', 'mana', 'manakala', 'manalagi',
  'masing', 'masing-masing', 'mau', 'maupun', 'melainkan', 'melakukan', 'melalui', 'melihat',
  'melihatnya', 'memang', 'memastikan', 'memberi', 'memberikan', 'membuat', 'memerlukan',
  'memihak', 'meminta', 'memintakan', 'memisalkan', 'memperbuat', 'mempergunakan', 'memperkirakan',
  'memperlihatkan', 'mempersiapkan', 'mempersoalkan', 'mempertanyakan', 'mempunyai', 'memulai',
  'memungkinkan', 'menaiki', 'menandaskan', 'menanti', 'menanti-nanti', 'menantikan', 'menanya',
  'menanyai', 'menanyakan', 'mendapat', 'mendapatkan', 'mendatang', 'mendatangi', 'mendatangkan',
  'menegaskan', 'mengakhiri', 'mengapa', 'mengatakan', 'mengatakannya', 'mengenai', 'mengerjakan',
  'mengetahui', 'menggunakan', 'menghendaki', 'mengibaratkan', 'mengibaratkannya', 'mengingat',
  'mengingatkan', 'menginginkan', 'mengira', 'mengucapkan', 'mengucapkannya', 'mengungkapkan',
  'menjadi', 'menjawab', 'menuju', 'menunjuk', 'menunjuki', 'menunjukkan', 'menunjuknya',
  'menurut', 'menurutnya', 'menuturkan', 'menuturkannya', 'menyampaikan', 'menyangkut',
  'menyatakan', 'menyebutkan', 'menyeluruh', 'menyiapkan', 'merasa', 'mereka', 'merekalah',
  'merupakan', 'meski', 'meskipun', 'meyakini', 'meyakinkan', 'minta', 'mirip', 'misal',
  'misalkan', 'misalnya', 'mula', 'mulai', 'mulailah', 'mulanya', 'mungkin', 'mungkinkah',
  'nah', 'naik', 'namun', 'nanti', 'nantinya', 'nyaris', 'nyatanya', 'oleh', 'olehnya', 'pada',
  'padahal', 'padanya', 'pak', 'paling', 'panjang', 'pantas', 'para', 'pasti', 'pastilah',
  'penting', 'pentingnya', 'per', 'pernah', 'pula', 'pun', 'punya', 'rasa',
  'saat', 'saatnya', 'saja', 'sajalah', 'saling', 'sama', 'sama-sama', 'sambil', 'sampai',
  'sampai-sampai', 'sana', 'sangat', 'sangatlah', 'satu', 'saya', 'sayalah', 'se', 'sebab',
  'sebabnya', 'sebagai', 'sebagaimana', 'sebagainya', 'sebagian', 'sebaik', 'sebaik-baiknya',
  'sebaiknya', 'sebaliknya', 'sebanyak', 'sebegini', 'sebegitu', 'sebelum', 'sebelumnya',
  'sebenarnya', 'seberapa', 'sebesar', 'sebetulnya', 'sebisanya', 'sebuah', 'sebut', 'sebutlah',
  'sebutnya', 'secara', 'secukupnya', 'sedang', 'sedangkan', 'sedemikian', 'sedikit', 'sedikitnya',
  'setelah', 'setiap', 'siapakah', 'siapapun', 'sudah', 'sudahkah', 'sudahlah', 'supaya',
  'tadi', 'tadinya', 'tahu', 'tahun', 'tak', 'tambah', 'tambahnya', 'tampak', 'tampaknya',
  'tentu', 'tentulah', 'tentunya', 'tepat', 'terhadap', 'terhadapnya', 'terjadi', 'terjadilah',
  'terjadinya', 'terkira', 'terlalu', 'terlebih', 'terlihat', 'termasuk', 'ternyata', 'tersampaikan',
  'tersebut', 'tersebutlah', 'tertentu', 'tertuju', 'terus', 'terutama', 'tetap', 'tetapi',
  'tiap', 'tiba', 'tiba-tiba', 'tidak', 'tidakkah', 'tidaklah', 'tiga', 'toh', 'waduh', 'wah',
  'wahai', 'walau', 'walaupun', 'wong', 'ya', 'yaitu', 'yakin', 'yakni', 'yang'
])

/**
 * Membersihkan dan memecah teks Indonesia menjadi array token n-gram substansial (Unigram + Bigram + Trigram)
 * Dilengkapi dengan Indonesian Morphological Stemmer untuk normalisasi akar kata.
 * @param text - Naskah masukan
 * @param includeNgrams - Apakah mengekstrak bigram dan trigram kontekstual (default: true)
 */
export function tokenizeIndonesian(text: string, includeNgrams = true): string[] {
  if (!text || typeof text !== 'string') return []

  // 1. Lowercase dan bersihkan URL, mention, dan karakter non-alfanumerik
  const cleaned = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/www\.\S+/gi, ' ')
    // Hilangkan mention akun (@user) dan hashtag (#tag) prefix tapi pertahankan katanya
    .replace(/[@#](\w+)/g, '$1')
    // Simpan hanya huruf, angka, tanda strip (untuk kata ulang), dan spasi
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return []

  // 2. Tokenisasi unigram awal
  const rawWords = cleaned.split(' ')
  const baseTokens: string[] = []
  const stemmedTokens: string[] = []

  for (const word of rawWords) {
    const trimmed = word.trim()
    // Abaikan kata jika terlalu pendek (<=2 karakter) atau stopword umum
    if (trimmed.length > 2 && !INDONESIAN_STOPWORDS.has(trimmed)) {
      baseTokens.push(trimmed)
      // Jalankan stemming berkecepatan tinggi dengan memoization cache
      const root = stemIndonesian(trimmed)
      stemmedTokens.push(root)
    }
  }

  // Gabungkan unigram asli dan unigram yang telah di-stem
  const unigramsSet = new Set<string>()
  for (let i = 0; i < baseTokens.length; i++) {
    unigramsSet.add(baseTokens[i])
    if (stemmedTokens[i] && stemmedTokens[i].length > 2) {
      unigramsSet.add(stemmedTokens[i])
    }
  }

  const result: string[] = Array.from(unigramsSet)

  if (!includeNgrams || baseTokens.length < 2) {
    return result
  }

  // 3. Ekstraksi Bigram (Konteks 2 kata berturutan)
  for (let i = 0; i < baseTokens.length - 1; i++) {
    // Bigram dari kata dasar terstemmed (lebih stabil untuk generalisasi)
    result.push(`${stemmedTokens[i]} ${stemmedTokens[i + 1]}`)
    // Bigram literal jika berbeda dari stemmed
    if (baseTokens[i] !== stemmedTokens[i] || baseTokens[i + 1] !== stemmedTokens[i + 1]) {
      result.push(`${baseTokens[i]} ${baseTokens[i + 1]}`)
    }
  }

  // 4. Ekstraksi Trigram (Konteks 3 kata berturutan untuk frasa ancaman spesifik)
  if (baseTokens.length >= 3) {
    for (let i = 0; i < baseTokens.length - 2; i++) {
      result.push(`${stemmedTokens[i]} ${stemmedTokens[i + 1]} ${stemmedTokens[i + 2]}`)
    }
  }

  return result
}
