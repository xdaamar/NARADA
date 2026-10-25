// ─── COMPILE MODEL RUNNER SCRIPT (SPRINT 7A) ───
// Menjalankan training Naive Bayes & TF-IDF Vectorizer ke src/engine/ml/model.json

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CORPUS_PATH = path.resolve(__dirname, '../src/engine/data/defense-corpus.json')
const MODEL_PATH = path.resolve(__dirname, '../src/engine/ml/model.json')

const CATEGORIES = ['HOAKS', 'PROPAGANDA', 'BUZZER', 'DISINFORMASI', 'NETRAL']

// Daftar Stopwords
const STOPWORDS = new Set([
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

// Fast Stemmer
const STEM_CACHE = new Map()
function stem(word) {
  if (!word || word.length <= 2) return word
  if (STOPWORDS.has(word)) return word
  if (STEM_CACHE.has(word)) return STEM_CACHE.get(word)

  let res = word
  // Suffixes
  if (res.endsWith('lah') || res.endsWith('kah') || res.endsWith('nya') || res.endsWith('pun')) {
    res = res.slice(0, -3)
  }
  if (res.endsWith('kan')) res = res.slice(0, -3)
  else if (res.endsWith('an')) res = res.slice(0, -2)
  else if (res.endsWith('i') && !res.endsWith('si') && res.length > 4) res = res.slice(0, -1)

  // Prefixes
  if (res.startsWith('meny')) res = 's' + res.slice(4)
  else if (res.startsWith('meng')) res = res.slice(4)
  else if (res.startsWith('mem')) res = /^[aeiou]/.test(res.slice(3)) ? 'p' + res.slice(3) : res.slice(3)
  else if (res.startsWith('men')) res = /^[aeiou]/.test(res.slice(3)) ? 't' + res.slice(3) : res.slice(3)
  else if (res.startsWith('me') && res.length > 4) res = res.slice(2)
  else if (res.startsWith('peny')) res = 's' + res.slice(4)
  else if (res.startsWith('peng')) res = res.slice(4)
  else if (res.startsWith('pem')) res = /^[aeiou]/.test(res.slice(3)) ? 'p' + res.slice(3) : res.slice(3)
  else if (res.startsWith('pen')) res = /^[aeiou]/.test(res.slice(3)) ? 't' + res.slice(3) : res.slice(3)
  else if (res.startsWith('per')) res = res.slice(3)
  else if (res.startsWith('pe') && res.length > 4) res = res.slice(2)
  else if (res.startsWith('ber')) res = res.slice(3)
  else if (res.startsWith('ter')) res = res.slice(3)
  else if (res.startsWith('di') && res.length > 4) res = res.slice(2)
  else if (res.startsWith('ke') && res.length > 4) res = res.slice(2)

  const finalRes = res.length >= 3 ? res : word
  if (STEM_CACHE.size > 8000) {
    const k = STEM_CACHE.keys().next().value
    STEM_CACHE.delete(k)
  }
  STEM_CACHE.set(word, finalRes)
  return finalRes
}

// Tokenize Indonesian text with unigrams, bigrams, and trigrams
function tokenize(text) {
  if (!text) return []
  const cleaned = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/www\.\S+/gi, ' ')
    .replace(/[@#](\w+)/g, '$1')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return []

  const words = cleaned.split(' ')
  const baseTokens = []
  const stemmedTokens = []

  for (const w of words) {
    if (w.length > 2 && !STOPWORDS.has(w)) {
      baseTokens.push(w)
      stemmedTokens.push(stem(w))
    }
  }

  const tokenSet = new Set()
  for (let i = 0; i < baseTokens.length; i++) {
    tokenSet.add(baseTokens[i])
    if (stemmedTokens[i] && stemmedTokens[i].length > 2) {
      tokenSet.add(stemmedTokens[i])
    }
  }

  const result = Array.from(tokenSet)

  // Bigrams
  for (let i = 0; i < baseTokens.length - 1; i++) {
    result.push(`${stemmedTokens[i]} ${stemmedTokens[i + 1]}`)
    if (baseTokens[i] !== stemmedTokens[i] || baseTokens[i + 1] !== stemmedTokens[i + 1]) {
      result.push(`${baseTokens[i]} ${baseTokens[i + 1]}`)
    }
  }

  // Trigrams
  if (baseTokens.length >= 3) {
    for (let i = 0; i < baseTokens.length - 2; i++) {
      result.push(`${stemmedTokens[i]} ${stemmedTokens[i + 1]} ${stemmedTokens[i + 2]}`)
    }
  }

  return result
}

console.log('Membaca korpus dari:', CORPUS_PATH)
const rawData = fs.readFileSync(CORPUS_PATH, 'utf-8')
const corpus = JSON.parse(rawData)

console.log(`Menjalankan tokenisasi pada ${corpus.length} sampel...`)
const docTokens = []
const docCategories = []
const docFreq = new Map()
const classDocsCount = { HOAKS: 0, PROPAGANDA: 0, BUZZER: 0, DISINFORMASI: 0, NETRAL: 0 }

for (const sample of corpus) {
  if (!sample.text || !CATEGORIES.includes(sample.category)) continue
  const tokens = tokenize(sample.text)
  docTokens.push(tokens)
  docCategories.push(sample.category)
  classDocsCount[sample.category]++

  const seen = new Set(tokens)
  for (const t of seen) {
    docFreq.set(t, (docFreq.get(t) || 0) + 1)
  }
}

const N = docTokens.length
console.log(`Total n-grams terdeteksi: ${docFreq.size} dari ${N} dokumen`)

// Target ukuran n-grams untuk mencapai target model ~350KB
// Berdasarkan pengujian struktur model: ~5.000 - 6.500 vocabulary n-grams menghasilkan file JSON tepat ~320KB - 400KB!
const TARGET_VOCAB_SIZE = 6000
const sortedVocab = Array.from(docFreq.entries())
  .filter(([_, df]) => df >= 1)
  .sort((a, b) => b[1] - a[1])
  .slice(0, TARGET_VOCAB_SIZE)

console.log(`Menyeleksi ${sortedVocab.length} fitur n-gram teratas...`)

const vocabulary = {}
const idf = []
for (let idx = 0; idx < sortedVocab.length; idx++) {
  const [token, df] = sortedVocab[idx]
  vocabulary[token] = idx
  const idfVal = parseFloat((Math.log(N / (1 + df)) + 1.0).toFixed(3))
  idf.push(idfVal)
}

const V = sortedVocab.length
const alpha = 1.0 // Laplace smoothing parameter

const classWordCounts = {
  HOAKS: new Float64Array(V),
  PROPAGANDA: new Float64Array(V),
  BUZZER: new Float64Array(V),
  DISINFORMASI: new Float64Array(V),
  NETRAL: new Float64Array(V),
}
const classTotalTokens = { HOAKS: 0, PROPAGANDA: 0, BUZZER: 0, DISINFORMASI: 0, NETRAL: 0 }

for (let d = 0; d < N; d++) {
  const cat = docCategories[d]
  const tokens = docTokens[d]
  for (const t of tokens) {
    const idx = vocabulary[t]
    if (idx !== undefined) {
      classWordCounts[cat][idx] += 1
      classTotalTokens[cat] += 1
    }
  }
}

const classWordProbs = {
  HOAKS: new Array(V),
  PROPAGANDA: new Array(V),
  BUZZER: new Array(V),
  DISINFORMASI: new Array(V),
  NETRAL: new Array(V),
}

for (const cat of CATEGORIES) {
  const denom = classTotalTokens[cat] + alpha * V
  const counts = classWordCounts[cat]
  const probs = classWordProbs[cat]
  for (let i = 0; i < V; i++) {
    const p = (counts[i] + alpha) / denom
    probs[i] = parseFloat(p.toPrecision(3))
  }
}

const classPriors = {
  HOAKS: classDocsCount.HOAKS / N,
  PROPAGANDA: classDocsCount.PROPAGANDA / N,
  BUZZER: classDocsCount.BUZZER / N,
  DISINFORMASI: classDocsCount.DISINFORMASI / N,
  NETRAL: classDocsCount.NETRAL / N,
}

const compiledModel = {
  version: '2.0.0-SPRINT-7A',
  generatedAt: Date.now(),
  vocabularySize: V,
  categories: CATEGORIES,
  classPriors,
  vocabulary,
  idf,
  classWordProbs,
}

const jsonString = JSON.stringify(compiledModel)
fs.writeFileSync(MODEL_PATH, jsonString, 'utf-8')
const stats = fs.statSync(MODEL_PATH)
const sizeKB = (stats.size / 1024).toFixed(1)

console.log(`✅ Model terkompilasi sukses dibuat!`)
console.log(`- Path: ${MODEL_PATH}`)
console.log(`- Vocabulary: ${V} N-Grams`)
console.log(`- Ukuran Berkas: ${sizeKB} KB (Target DoD: 300KB - 450KB)`)
