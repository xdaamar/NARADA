// ─── INSET INDONESIAN SENTIMENT ENGINE & REAL-TIME LEXICON SCORER ───
// SPRINT 7C: Pembobotan Sentimen Bahasa Indonesia untuk Bar Mekanikal Taktis
// Sistem Pertahanan Kognitif NARADA - PUSSIBERAD TNI AD × CODEPOLITAN

export type SentimentLabel = 'POSITIF' | 'NETRAL' | 'PROVOKATIF'

export interface SentimentAnalysisResult {
  score: number // Nilai numerik polaritas
  label: SentimentLabel
  matchedTokens: Array<{ token: string; weight: number }>
}

export interface SentimentMatrixAggregate {
  positivePercent: number
  neutralPercent: number
  provocativePercent: number
  dominantSentiment: SentimentLabel
  positiveCount: number
  neutralCount: number
  provocativeCount: number
  totalCount: number
}

// ─── LEKSIKON SENTIMEN BAHASA INDONESIA BERBOBOT (InSet Lexicon) ───
const POSITIVE_LEXICON: Record<string, number> = {
  // Dukungan & Apresiasi Pertahanan
  dukung: 2.5, mendukung: 2.5, dukungan: 2.0, mantap: 3.0, hebat: 3.0, bagus: 2.5,
  patriotik: 3.5, bangga: 3.0, bersatu: 2.5, profesional: 3.0, berintegritas: 3.5,
  jaya: 3.0, perkasa: 3.0, tangguh: 3.0, setia: 2.5, prajurit: 1.0, prestasi: 2.5,
  terpercaya: 3.0, aman: 2.0, damai: 2.5, tentram: 2.0, kondusif: 2.0, stabilitas: 2.0,
  kedaulatan: 2.0, nkri: 2.0, pahlawan: 2.5, patriot: 3.0, teladan: 2.5, bakti: 2.5,
  swasembada: 2.0, gotong: 2.0, royong: 2.0, kemanunggalan: 3.0, jujur: 3.0, benar: 2.0,
  faktual: 2.5, valid: 2.5, transparan: 2.5, akuntabel: 2.5, resmi: 1.5, apresiasi: 3.0,
  salut: 3.0, hormat: 2.5, keren: 2.0, sukses: 2.5, berhasil: 2.5, maju: 2.0, solid: 2.5,
  terlindungi: 2.5, sigap: 2.5, tanggap: 2.5, juara: 3.0, optimis: 2.5, cerdas: 2.0,
  berkualitas: 2.5, canggih: 2.5, modern: 2.0, prima: 3.0, selamat: 2.0, berkah: 2.0
}

const PROVOCATIVE_LEXICON: Record<string, number> = {
  // Agitasi, Hujatan, Pembangkangan & Buzzer Swarm
  ganyang: -4.5, gulingkan: -4.5, makar: -5.0, kudeta: -4.5, tiran: -4.0, rezim: -3.0,
  bajingan: -5.0, biadab: -4.5, bangsat: -5.0, keparat: -5.0, anjing: -4.5, babi: -4.5,
  tolol: -4.0, bodoh: -3.5, bego: -3.5, sesat: -3.5, perusak: -3.5, biang: -2.5,
  kerok: -2.5, serbu: -3.5, bakar: -4.0, hancurkan: -4.0, bunuh: -5.0, bantai: -5.0,
  genosida: -4.5, zalim: -3.5, dzalim: -3.5, penindas: -4.0, licik: -3.5, munafik: -4.0,
  curang: -3.5, korup: -4.0, korupsi: -3.5, maling: -4.0, rampok: -4.5, suap: -3.5,
  gratifikasi: -3.0, rongsokan: -3.5, besi: -1.0, tua: -1.0, karatan: -3.0, fiktif: -3.5,
  hoaks: -3.0, palsu: -3.0, fitnah: -4.0, adu: -2.0, domba: -2.0, pecah: -3.0,
  belah: -3.0, provokasi: -3.5, provokator: -4.0, separatis: -4.0, teroris: -4.5,
  boikot: -3.0, panik: -2.5, bubarkan: -3.5, mogok: -2.5, bangkrut: -3.0, kolaps: -3.0,
  antek: -3.5, asing: -1.5, antek-antek: -4.0, penjilat: -4.0, buzzer: -3.0, buzzerrp: -3.5,
  botnet: -3.0, boneka: -3.0, pembual: -3.5, penipu: -4.0, manipulasi: -3.0, kebohongan: -3.5,
  bobrok: -3.5, busuk: -3.5, hancur: -3.0, musnahkan: -4.0, laknat: -4.5, mampus: -4.5
}

// Partikel Negasi Pembalik Polaritas
const NEGATIONS = new Set([
  'tidak', 'bukan', 'jangan', 'tak', 'belum', 'tiada', 'gak', 'tdk', 'kaga', 'nggak', 'tanpa'
])

// Kata Penguat (Intensifiers)
const INTENSIFIERS = new Set([
  'sangat', 'amat', 'banget', 'sekali', 'sungguh', 'benar-benar', 'parah', 'terlalu', 'luar biasa'
])

/**
 * Menganalisis sentimen sebuah teks komentar secara real-time
 */
export function analyzeSentiment(text: string): SentimentAnalysisResult {
  if (!text || typeof text !== 'string') {
    return { score: 0, label: 'NETRAL', matchedTokens: [] }
  }

  const words = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1)

  let totalScore = 0
  const matchedTokens: Array<{ token: string; weight: number }> = []

  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    let weight = 0

    if (POSITIVE_LEXICON[word]) {
      weight = POSITIVE_LEXICON[word]
    } else if (PROVOCATIVE_LEXICON[word]) {
      weight = PROVOCATIVE_LEXICON[word]
    }

    if (weight !== 0) {
      // Periksa apakah ada kata negasi di 1 atau 2 kata sebelumnya
      const prev1 = i > 0 ? words[i - 1] : ''
      const prev2 = i > 1 ? words[i - 2] : ''
      const isNegated = NEGATIONS.has(prev1) || NEGATIONS.has(prev2)

      // Periksa apakah ada kata penguat
      const isIntensified = INTENSIFIERS.has(prev1) || INTENSIFIERS.has(prev2)

      let finalWeight = isNegated ? -weight * 0.8 : weight
      if (isIntensified) {
        finalWeight *= 1.4
      }

      totalScore += finalWeight
      matchedTokens.push({ token: word, weight: parseFloat(finalWeight.toFixed(2)) })
    }
  }

  // Tentukan label sentimen berdasarkan batas ambang 0.8
  let label: SentimentLabel = 'NETRAL'
  if (totalScore > 0.8) {
    label = 'POSITIF'
  } else if (totalScore < -0.8) {
    label = 'PROVOKATIF'
  }

  return {
    score: parseFloat(totalScore.toFixed(2)),
    label,
    matchedTokens
  }
}

/**
 * Mengagregasi matriks sentimen dari kumpulan komentar untuk menggerakkan bar mekanikal chunky
 */
export function aggregateSentimentMatrix(comments: Array<{ content?: string; text?: string }>): SentimentMatrixAggregate {
  if (!comments || comments.length === 0) {
    return {
      positivePercent: 33,
      neutralPercent: 34,
      provocativePercent: 33,
      dominantSentiment: 'NETRAL',
      positiveCount: 0,
      neutralCount: 0,
      provocativeCount: 0,
      totalCount: 0
    }
  }

  let posCount = 0
  let netCount = 0
  let provCount = 0

  for (const c of comments) {
    const txt = c.content || c.text || ''
    const res = analyzeSentiment(txt)
    if (res.label === 'POSITIF') posCount++
    else if (res.label === 'PROVOKATIF') provCount++
    else netCount++
  }

  const total = comments.length
  let posPct = Math.round((posCount / total) * 100)
  let netPct = Math.round((netCount / total) * 100)
  let provPct = 100 - posPct - netPct

  // Jaga batasan non-negatif
  if (provPct < 0) {
    provPct = 0
    netPct = 100 - posPct
  }

  let dominantSentiment: SentimentLabel = 'NETRAL'
  if (provCount >= posCount && provCount >= netCount) {
    dominantSentiment = 'PROVOKATIF'
  } else if (posCount >= netCount && posCount > provCount) {
    dominantSentiment = 'POSITIF'
  }

  return {
    positivePercent: posPct,
    neutralPercent: netPct,
    provocativePercent: provPct,
    dominantSentiment,
    positiveCount: posCount,
    neutralCount: netCount,
    provocativeCount: provCount,
    totalCount: total
  }
}
