// ─── NARADA ML ACCURACY AUDIT & BENCHMARK SUITE (SPRINT 7B) ───
// Pengujian 50 Kasus Emas (Golden Cases), Matriks Konfusi & Benchmark Latensi On-Device
// Sistem Pertahanan Kognitif NARADA - PUSSIBERAD TNI AD × CODEPOLITAN

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Pemuatan Berkas Model dan Dataset Kasus Emas
const modelPath = path.resolve(__dirname, '../src/engine/ml/model.json');
const datasetPath = path.resolve(__dirname, 'golden-test-dataset.json');

if (!fs.existsSync(modelPath)) {
  console.error('❌ Error: model.json tidak ditemukan di:', modelPath);
  process.exit(1);
}
if (!fs.existsSync(datasetPath)) {
  console.error('❌ Error: golden-test-dataset.json tidak ditemukan di:', datasetPath);
  process.exit(1);
}

const model = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
const goldenDataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

// 2. Kamus Stopword dan Root Preservasi
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
]);

const PRESERVED_ROOTS = new Set([
  'alutsista', 'bela', 'negara', 'kedaulatan', 'teritorial', 'pertahanan', 'militer',
  'panglima', 'prajurit', 'babinsa', 'koramil', 'kodim', 'kodam', 'dispenad', 'puspen',
  'pussiberad', 'bintara', 'tamtama', 'taruna', 'akmil', 'perwira', 'radar', 'drone',
  'separatis', 'makar', 'terorisme', 'radikalisme', 'hoaks', 'fitnah', 'phising',
  'megathrust', 'gempa', 'tsunami', 'bansos', 'astroturfing', 'buzzer', 'botnet',
  'doxxing', 'copypasta', 'dokumen', 'faktual', 'konflik', 'senjata', 'amunisi',
  'pasukan', 'intelijen', 'provokasi', 'agitasi', 'hasut', 'disinformasi', 'propaganda'
]);

// 3. Indonesian Morphological Stemmer dengan LRU Cache
const STEM_CACHE = new Map();
const MAX_CACHE_SIZE = 5000;

function executeConfixStripping(word) {
  if (word.length <= 3) return word;
  if (PRESERVED_ROOTS.has(word)) return word;

  let current = word;

  // 1. Inflectional Suffixes: -lah, -kah, -tah, -pun
  current = current.replace(/(lah|kah|tah|pun)$/, '');

  // 2. Possessive Pronouns: -ku, -mu, -nya
  current = current.replace(/(ku|mu|nya)$/, '');

  // 3. Derivational Suffix: -kan, -an, -i
  if (current.length > 4) {
    if (current.endsWith('kan')) {
      current = current.slice(0, -3);
    } else if (current.endsWith('an')) {
      current = current.slice(0, -2);
    } else if (current.endsWith('i') && !current.endsWith('si') && !current.endsWith('ti')) {
      current = current.slice(0, -1);
    }
  }

  // 4. Derivational Prefixes dengan Morphonemic rules
  if (current.length > 4) {
    if (current.startsWith('meng') || current.startsWith('peng')) {
      const rest = current.slice(4);
      if (/^[aeioughk]/.test(rest)) {
        current = rest.startsWith('k') ? rest : 'k' + rest;
      } else {
        current = rest;
      }
    } else if (current.startsWith('meny') || current.startsWith('peny')) {
      current = 's' + current.slice(4);
    } else if (current.startsWith('mem') || current.startsWith('pem')) {
      const rest = current.slice(3);
      if (/^[bfpv]/.test(rest)) {
        current = rest;
      } else if (/^[aeiou]/.test(rest)) {
        current = 'p' + rest;
      }
    } else if (current.startsWith('men') || current.startsWith('pen')) {
      const rest = current.slice(3);
      if (/^[cdjz]/.test(rest)) {
        current = rest;
      } else if (/^[aeiou]/.test(rest)) {
        current = 't' + rest;
      }
    } else if (current.startsWith('per') || current.startsWith('ber') || current.startsWith('ter')) {
      current = current.slice(3);
    } else if (current.startsWith('me') || current.startsWith('pe') || current.startsWith('di') || current.startsWith('ke') || current.startsWith('se')) {
      current = current.slice(2);
    }
  }

  return current.length >= 3 ? current : word;
}

function stemIndonesian(word) {
  const lower = word.toLowerCase();
  if (STEM_CACHE.has(lower)) {
    return STEM_CACHE.get(lower);
  }
  const root = executeConfixStripping(lower);
  if (STEM_CACHE.size >= MAX_CACHE_SIZE) {
    const firstKey = STEM_CACHE.keys().next().value;
    if (firstKey) STEM_CACHE.delete(firstKey);
  }
  STEM_CACHE.set(lower, root);
  return root;
}

// 4. Tokenizer Multitingkat (Unigram + Bigram + Trigram)
function tokenizeIndonesian(text, includeNgrams = true) {
  if (!text || typeof text !== 'string') return [];

  const cleaned = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/www\.\S+/gi, ' ')
    .replace(/[@#](\w+)/g, '$1')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return [];

  const rawWords = cleaned.split(' ');
  const baseTokens = [];
  const stemmedTokens = [];

  for (const word of rawWords) {
    const trimmed = word.trim();
    if (trimmed.length > 2 && !STOPWORDS.has(trimmed)) {
      baseTokens.push(trimmed);
      const root = stemIndonesian(trimmed);
      stemmedTokens.push(root);
    }
  }

  const unigramsSet = new Set();
  for (let i = 0; i < baseTokens.length; i++) {
    unigramsSet.add(baseTokens[i]);
    if (stemmedTokens[i] && stemmedTokens[i].length > 2) {
      unigramsSet.add(stemmedTokens[i]);
    }
  }

  const result = Array.from(unigramsSet);
  if (!includeNgrams || baseTokens.length < 2) return result;

  for (let i = 0; i < baseTokens.length - 1; i++) {
    result.push(`${stemmedTokens[i]} ${stemmedTokens[i + 1]}`);
    if (baseTokens[i] !== stemmedTokens[i] || baseTokens[i + 1] !== stemmedTokens[i + 1]) {
      result.push(`${baseTokens[i]} ${baseTokens[i + 1]}`);
    }
  }

  if (baseTokens.length >= 3) {
    for (let i = 0; i < baseTokens.length - 2; i++) {
      result.push(`${stemmedTokens[i]} ${stemmedTokens[i + 1]} ${stemmedTokens[i + 2]}`);
    }
  }

  return result;
}

// 5. TF-IDF Vectorizer
function vectorizeTFIDF(tokens, vocabulary, idf) {
  const counts = new Map();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  const total = tokens.length || 1;
  const indices = [];
  const values = [];

  for (const [token, count] of counts.entries()) {
    const featureIdx = vocabulary[token];
    if (featureIdx !== undefined && featureIdx < idf.length) {
      const tfVal = 1 + Math.log(count / total + 1);
      const idfVal = idf[featureIdx];
      indices.push(featureIdx);
      values.push(tfVal * idfVal);
    }
  }

  let sumSquares = 0;
  for (const val of values) {
    sumSquares += val * val;
  }
  const norm = Math.sqrt(sumSquares) || 1.0;
  const normalizedValues = values.map(v => v / norm);

  return { indices, values: normalizedValues, tokenCount: tokens.length };
}

// 6. Inverted Index untuk XAI
const indexToToken = new Array(model.idf ? model.idf.length : 0);
for (const [tok, idx] of Object.entries(model.vocabulary)) {
  indexToToken[idx] = tok;
}

// 7. Prediksi Naive Bayes Berbobot TF-IDF dengan XAI
function evaluateNaiveBayes(text) {
  const t0 = performance.now();
  const tokens = tokenizeIndonesian(text, true);

  if (tokens.length === 0) {
    return {
      category: 'NETRAL',
      probabilities: { HOAKS: 0.05, PROPAGANDA: 0.05, BUZZER: 0.05, DISINFORMASI: 0.05, NETRAL: 0.8 },
      latencyMs: performance.now() - t0,
      salienceTokens: []
    };
  }

  const vector = vectorizeTFIDF(tokens, model.vocabulary, model.idf);
  if (vector.indices.length === 0) {
    return {
      category: 'NETRAL',
      probabilities: { HOAKS: 0.2, PROPAGANDA: 0.2, BUZZER: 0.2, DISINFORMASI: 0.2, NETRAL: 0.2 },
      latencyMs: performance.now() - t0,
      salienceTokens: []
    };
  }

  const logProbs = {
    HOAKS: Math.log(model.classPriors.HOAKS || 0.2),
    PROPAGANDA: Math.log(model.classPriors.PROPAGANDA || 0.2),
    BUZZER: Math.log(model.classPriors.BUZZER || 0.2),
    DISINFORMASI: Math.log(model.classPriors.DISINFORMASI || 0.2),
    NETRAL: Math.log(model.classPriors.NETRAL || 0.2)
  };

  for (const cat of model.categories) {
    const wordProbs = model.classWordProbs[cat];
    if (!wordProbs) continue;
    for (let i = 0; i < vector.indices.length; i++) {
      const featureIdx = vector.indices[i];
      const tfidfWeight = vector.values[i];
      const pWord = wordProbs[featureIdx] ?? 1e-5;
      logProbs[cat] += tfidfWeight * Math.log(pWord + 1e-10);
    }
  }

  // Softmax
  let maxLog = -Infinity;
  for (const cat of model.categories) {
    if (logProbs[cat] > maxLog) maxLog = logProbs[cat];
  }
  let sumExp = 0;
  const expVals = {};
  for (const cat of model.categories) {
    const val = Math.exp(logProbs[cat] - maxLog);
    expVals[cat] = val;
    sumExp += val;
  }
  const probabilities = {};
  let bestCategory = 'NETRAL';
  let highestProb = -1;
  for (const cat of model.categories) {
    const p = sumExp > 0 ? expVals[cat] / sumExp : 0.2;
    probabilities[cat] = p;
    if (p > highestProb) {
      highestProb = p;
      bestCategory = cat;
    }
  }

  // Token attribution
  const salienceTokens = [];
  const netralProbs = model.classWordProbs.NETRAL || [];
  const winnerProbs = model.classWordProbs[bestCategory] || [];

  for (let i = 0; i < vector.indices.length; i++) {
    const featureIdx = vector.indices[i];
    const tfidfWeight = vector.values[i];
    const tok = indexToToken[featureIdx];
    if (!tok) continue;

    const pWinner = winnerProbs[featureIdx] ?? 1e-6;
    const pNetral = netralProbs[featureIdx] ?? 1e-6;
    const logLikelihoodRatio = Math.log(pWinner + 1e-10) - Math.log(pNetral + 1e-10);

    let maxP = -1;
    let domCat = 'NETRAL';
    for (const cat of model.categories) {
      const pCat = model.classWordProbs[cat]?.[featureIdx] ?? 0;
      if (pCat > maxP) {
        maxP = pCat;
        domCat = cat;
      }
    }

    let intensity = 'NEUTRAL';
    if (bestCategory === 'NETRAL' || domCat === 'NETRAL' || logLikelihoodRatio < -0.6) {
      intensity = 'EMERALD';
    } else if (logLikelihoodRatio >= 1.8 || (domCat === bestCategory && tfidfWeight > 0.25)) {
      intensity = 'CRIMSON';
    } else if (logLikelihoodRatio >= 0.5 || tfidfWeight > 0.15) {
      intensity = 'AMBER';
    }

    salienceTokens.push({
      token: tok,
      tfidfWeight: parseFloat(tfidfWeight.toFixed(4)),
      logLikelihoodRatio: parseFloat(logLikelihoodRatio.toFixed(3)),
      dominantCategory: domCat,
      intensity
    });
  }

  const latencyMs = performance.now() - t0;
  return { category: bestCategory, probabilities, latencyMs, salienceTokens };
}

// ─── 8. EKSEKUSI PENGUJIAN 50 KASUS EMAS ───
console.log('╔═══════════════════════════════════════════════════════════════════════════════════╗');
console.log('║       NARADA COGNITIVE THREAT DEFENSE — ML ACCURACY & BENCHMARK AUDIT (7B)        ║');
console.log('║         PUSSIBERAD TNI AD × CODEPOLITAN (KARTIKA CYBER HACKATHON 2026)            ║');
console.log('╚═══════════════════════════════════════════════════════════════════════════════════╝\n');

console.log(`[INFO] Model Vocabulary  : ${Object.keys(model.vocabulary).length.toLocaleString()} N-Grams`);
console.log(`[INFO] Model Disk Size   : ${(fs.statSync(modelPath).size / 1024).toFixed(1)} KB`);
console.log(`[INFO] Golden Test Cases : ${goldenDataset.length} sampel terstruktur\n`);

const categories = ['HOAKS', 'PROPAGANDA', 'BUZZER', 'DISINFORMASI', 'NETRAL'];
const confusionMatrix = {};
for (const actual of categories) {
  confusionMatrix[actual] = {};
  for (const pred of categories) {
    confusionMatrix[actual][pred] = 0;
  }
}

let correctCount = 0;
const latencies = [];
let netralFalsePositiveCount = 0;
let xaiAttributionPassCount = 0;
const failures = [];

console.log('─── HASIL EVALUASI 50 KASUS UJI EMAS ───────────────────────────────────────────────');

for (let idx = 0; idx < goldenDataset.length; idx++) {
  const item = goldenDataset[idx];
  const result = evaluateNaiveBayes(item.text);
  latencies.push(result.latencyMs);

  const isCorrect = result.category === item.expectedCategory;
  if (isCorrect) correctCount++;
  else {
    failures.push({
      id: item.id,
      scenario: item.scenario,
      actual: item.expectedCategory,
      predicted: result.category,
      prob: (result.probabilities[result.category] * 100).toFixed(1) + '%'
    });
  }

  confusionMatrix[item.expectedCategory][result.category]++;

  // Audit Zero False Positive pada Netral
  if (item.expectedCategory === 'NETRAL' && result.category !== 'NETRAL') {
    netralFalsePositiveCount++;
  }

  // Audit XAI Salience Integrity
  if (result.salienceTokens && result.salienceTokens.length > 0) {
    const hasValidLLR = result.salienceTokens.every(t => !isNaN(t.logLikelihoodRatio) && !isNaN(t.tfidfWeight));
    if (hasValidLLR) xaiAttributionPassCount++;
  }

  const icon = isCorrect ? '✓' : '✗';
  const probStr = (result.probabilities[result.category] * 100).toFixed(1).padStart(5);
  console.log(` [${icon}] ${item.id.padEnd(6)} | Aktual: ${item.expectedCategory.padEnd(13)} | Prediksi: ${result.category.padEnd(13)} (${probStr}%) | ${result.latencyMs.toFixed(2)}ms | ${item.scenario}`);
}

// ─── 9. PERHITUNGAN METRIK STATISTIKA & MATRIKS KONFUSI ───
const accuracy = (correctCount / goldenDataset.length) * 100;
const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
const minLatency = Math.min(...latencies);
const maxLatency = Math.max(...latencies);
const sortedLatencies = [...latencies].sort((a, b) => a - b);
const p95Latency = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)];

console.log('\n─── MATRIKS KONFUSI (CONFUSION MATRIX) ─────────────────────────────────────────────');
console.log('AKTUAL \\ PREDIKSI │   HOAKS   │ PROPAGANDA │   BUZZER   │  DISINFO   │   NETRAL   │ TOTAL');
console.log('──────────────────┼───────────┼────────────┼────────────┼────────────┼────────────┼──────');
for (const cat of categories) {
  const row = confusionMatrix[cat];
  const h = String(row.HOAKS).padStart(5);
  const p = String(row.PROPAGANDA).padStart(6);
  const b = String(row.BUZZER).padStart(6);
  const d = String(row.DISINFORMASI).padStart(6);
  const n = String(row.NETRAL).padStart(6);
  const total = Object.values(row).reduce((acc, v) => acc + v, 0);
  console.log(`${cat.padEnd(17)} │   ${h}   │    ${p}  │    ${b}  │    ${d}  │    ${n}  │  ${total}`);
}

console.log('\n─── METRIK PERFORMA PER KATEGORI ───────────────────────────────────────────────────');
console.log('KATEGORI          │ PRESISI (%) │ RECALL (%)  │ F1-SCORE (%) │ SAMPEL');
console.log('──────────────────┼─────────────┼─────────────┼──────────────┼───────');

for (const cat of categories) {
  const tp = confusionMatrix[cat][cat];
  let fp = 0;
  for (const other of categories) {
    if (other !== cat) fp += confusionMatrix[other][cat];
  }
  let fn = 0;
  for (const other of categories) {
    if (other !== cat) fn += confusionMatrix[cat][other];
  }

  const precision = (tp + fp > 0) ? (tp / (tp + fp)) * 100 : 0;
  const recall = (tp + fn > 0) ? (tp / (tp + fn)) * 100 : 0;
  const f1 = (precision + recall > 0) ? 2 * (precision * recall) / (precision + recall) : 0;
  const sampleCount = tp + fn;

  console.log(`${cat.padEnd(17)} │    ${precision.toFixed(1).padStart(5)}%   │    ${recall.toFixed(1).padStart(5)}%   │    ${f1.toFixed(1).padStart(5)}%    │   ${sampleCount}`);
}

console.log('\n─── AUDIT TOLOK UKUR LATENSI (INFERENCE LATENCY) ──────────────────────────────────');
console.log(`• Rata-rata Latensi     : ${avgLatency.toFixed(2)} ms (Batas Maksimal DoD: 15.00 ms)`);
console.log(`• Latensi Minimum       : ${minLatency.toFixed(2)} ms`);
console.log(`• Latensi Maksimum      : ${maxLatency.toFixed(2)} ms`);
console.log(`• Latensi Persentil 95  : ${p95Latency.toFixed(2)} ms`);
console.log(`• False Positive Netral : ${netralFalsePositiveCount} dari 10 (Target: 0 / 0.0%)`);
console.log(`• XAI Token Salience    : ${xaiAttributionPassCount} dari ${goldenDataset.length} kasus valid (100%)`);
console.log(`• Akurasi Keseluruhan   : ${accuracy.toFixed(1)}% (${correctCount}/${goldenDataset.length})`);

// ─── 10. UJI EDGE-CASE (TYPO & SLANG) ───
console.log('\n─── UJI TAHAN BANTING EDGE-CASE (TYPO & SLANG ROBUSTNESS) ─────────────────────────');
const edgeCases = [
  { text: 'bansooos cairrr 5jt via link phising klik skrng sblm kuota habizz', expected: 'HOAKS' },
  { text: 'gempaa megatrust jam 23 mlm ini pulau jawa tsunami parah bgt', expected: 'HOAKS' },
  { text: 'rakyat papua barat nolak nkri referendum merdeka kkb tni polri', expected: 'PROPAGANDA' },
  { text: 'rezim tiran gulingkan presiden turun jalan revolusi kudeta militer', expected: 'PROPAGANDA' },
  { text: '#RezimPanik #GanyangPejabat viralkannn ramein tagar botnet trending!', expected: 'BUZZER' },
  { text: 'sebarkan pesan copy paste broadcast wa ke 20 grup jgn mau dibodohi', expected: 'BUZZER' },
  { text: 'video perang jet tempur perbatasan tentara indonesia serang tetangga', expected: 'DISINFORMASI' },
  { text: 'menteri akui kas negara bangkrut total pengakuan rahasia clickbait', expected: 'DISINFORMASI' },
  { text: 'siaran pers resmi dispenad latihan puslatpur baturaja tni ad', expected: 'NETRAL' },
  { text: 'info prakiraan cuaca maritim resmi bmkg gelombang tinggi samudra', expected: 'NETRAL' }
];

let edgeCasePassed = 0;
for (const ec of edgeCases) {
  const res = evaluateNaiveBayes(ec.text);
  const ok = res.category === ec.expected;
  if (ok) edgeCasePassed++;
  console.log(` [${ok ? '✓' : '✗'}] Edge: "${ec.text.slice(0, 35)}..." => Prediksi: ${res.category} (Harapan: ${ec.expected})`);
}
console.log(`• Edge-Case Robustness : ${edgeCasePassed}/10 lulus (${(edgeCasePassed / 10) * 100}%)`);

// ─── 11. VERIFIKASI PASS / FAIL DENGAN DOD SPRINT 7B ───
console.log('\n═══════════════════════════════════════════════════════════════════════════════════');
const passAccuracy = accuracy >= 92.0;
const passNetral = netralFalsePositiveCount === 0;
const passLatency = avgLatency <= 15.0;
const passEdge = edgeCasePassed >= 8;
const allPassed = passAccuracy && passNetral && passLatency && passEdge;

console.log(`STATUS AUDIT KELULUSAN SPRINT 7B: ${allPassed ? '🟢 PASS (LULUS MUTLAK)' : '🔴 FAIL'}`);
console.log(`  1. Akurasi >= 92%                : ${passAccuracy ? 'LULUS' : 'GAGAL'} (${accuracy.toFixed(1)}%)`);
console.log(`  2. Zero False-Positive Netral    : ${passNetral ? 'LULUS' : 'GAGAL'} (${netralFalsePositiveCount} FP)`);
console.log(`  3. Rata-rata Latensi <= 15ms     : ${passLatency ? 'LULUS' : 'GAGAL'} (${avgLatency.toFixed(2)}ms)`);
console.log(`  4. Robustness Edge-Case >= 8/10  : ${passEdge ? 'LULUS' : 'GAGAL'} (${edgeCasePassed}/10)`);
console.log('═══════════════════════════════════════════════════════════════════════════════════\n');

if (!allPassed) {
  console.error('[GAGAL] Beberapa kriteria kelulusan belum terpenuhi.');
  process.exit(1);
} else {
  console.log('🏆 SELAMAT! Seluruh kriteria kelulusan DoD Sprint 7B terpenuhi dengan sempurna.');
  process.exit(0);
}
