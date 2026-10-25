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
  jaya: 3.0, perkasa: 3.0, tangguh: 3.0, setia: 2.5, prestasi: 2.5,
  terpercaya: 3.0, aman: 2.0, damai: 2.5, tentram: 2.0, kondusif: 2.0, stabilitas: 2.0,
  kedaulatan: 2.0, nkri: 2.0, pahlawan: 2.5, patriot: 3.0, teladan: 2.5, bakti: 2.5,
  swasembada: 2.0, gotong: 2.0, royong: 2.0, kemanunggalan: 3.0, jujur: 3.0, benar: 2.0,
  faktual: 2.5, valid: 2.5, transparan: 2.5, akuntabel: 2.5, apresiasi: 3.0,
  salut: 3.0, hormat: 2.5, keren: 2.0, sukses: 2.5, berhasil: 2.5, maju: 2.0, solid: 2.5,
  terlindungi: 2.5, sigap: 2.5, tanggap: 2.5, juara: 3.0, optimis: 2.5, cerdas: 2.0,
  berkualitas: 2.5, canggih: 2.5, modern: 2.0, prima: 3.0, selamat: 2.0, berkah: 2.0,
  terima: 1.5, kasih: 1.5, terimakasih: 3.5, makasih: 2.5, bersyukur: 3.0, syukur: 2.5,
  alhamdulillah: 3.5, masyaallah: 3.5, doa: 2.5, mendoakan: 2.5, rahmat: 2.5, barokah: 2.5,
  semangat: 3.0, bersemangat: 2.5, kebanggaan: 3.5, membanggakan: 3.5, panutan: 3.0,
  ksatria: 3.0, mulia: 3.0, tulus: 3.0, ketulusan: 3.0, ikhlas: 3.0, keikhlasan: 3.0,
  pengorbanan: 2.5, perjuangan: 2.5, membantu: 2.5, bantuan: 2.0, tertolong: 2.5,
  menolong: 2.5, penyelamat: 3.0, sembuh: 2.5, pulih: 2.5, sehat: 2.5, sejuk: 2.5,
  rukun: 3.0, kerukunan: 3.0, harmonis: 3.0, persaudaraan: 3.0, kompak: 2.5,
  solidaritas: 3.0, persatuan: 3.0, kesatuan: 2.5, bersih: 2.0, melimpah: 2.5,
  panen: 2.0, sejahtera: 3.0, makmur: 3.0, bravo: 3.5, medali: 2.5, emas: 2.5,
  cinta: 2.5, mencintai: 2.5, dicintai: 2.5, kebersamaan: 2.5, keberhasilan: 2.5,
  penghormatan: 3.0, santun: 2.5, humanis: 2.5, peduli: 2.5, kepedulian: 2.5,
  sejati: 2.5, berkahnya: 2.5, lindungan: 2.5, terharu: 2.5, kesigapan: 2.5,
  keteladanan: 3.0, terinspirasi: 2.5, pembela: 2.5, kesejahteraan: 2.5,
  kesabaran: 2.5, dedikasi: 3.0, pengabdian: 3.0, tegak: 2.0, kokoh: 2.5, berkibar: 2.0
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
  antek: -3.5, asing: -1.5, 'antek-antek': -4.0, penjilat: -4.0, buzzer: -3.0, buzzerrp: -3.5,
  botnet: -3.0, boneka: -3.0, pembual: -3.5, penipu: -4.0, manipulasi: -3.0, kebohongan: -3.5,
  bobrok: -3.5, busuk: -3.5, hancur: -3.0, musnahkan: -4.0, laknat: -4.5, mampus: -4.5,
  mafia: -3.5, pungli: -3.5, liar: -2.0, mangkrak: -3.0, mahal: -2.0, langka: -2.5,
  kelangkaan: -2.5, rusak: -2.5, roboh: -2.5, ambruk: -2.5, anjlok: -2.5, rugi: -2.5,
  jebol: -2.5, becek: -2.0, kumuh: -2.0, limbah: -2.5, cemari: -3.0, pencemaran: -3.0,
  racun: -3.5, teror: -3.5, bocor: -2.5, kebocoran: -2.5, nepotisme: -3.5, kolusi: -3.5,
  tertindas: -3.0, terjerat: -2.5, peras: -3.5, pemerasan: -3.5, kecewa: -2.5, cemas: -2.0,
  muak: -3.5, keluhan: -2.0, mengeluh: -2.0, padam: -2.0, putus: -1.5, bodong: -3.5,
  calo: -3.0, preman: -3.5, premanisme: -3.5, begal: -4.0, klitih: -4.0, kriminal: -3.5,
  keterlaluan: -3.0, gila: -2.5, menjerit: -2.5, merana: -2.5, sengsara: -3.0,
  dipersulit: -2.5, sulit: -1.5, lambat: -2.0, lelet: -2.5, resah: -2.5, meresahkan: -3.0,
  ancam: -3.0, intimidasi: -3.5, perundungan: -3.5, bully: -3.5, asusila: -4.0, cabul: -4.5,
  oplosan: -3.5, selundup: -3.5, penyelundupan: -3.5, judi: -3.5, judol: -4.0, narkoba: -4.5,
  narkotika: -4.5, ugal: -2.5, 'ugal-ugalan': -3.0, berlubang: -2.0, penggusuran: -3.0,
  gusur: -3.0, kapok: -2.5, membebani: -2.5, gagal: -3.0, kegagalan: -3.0, pesing: -2.0,
  kotor: -2.0, bau: -2.0, nyengat: -2.0, pusing: -2.0, usut: -2.0,
  tuntas: -1.0, bongkar: -2.5, kebobrokan: -3.5, viralkan: -2.0, tolak: -2.5, menolak: -2.5,
  otsus: -2.5, militerisasi: -3.5, referendum: -3.5, bansos: -1.0, cair: -1.0, bio: -1.0,
  kuota: -1.0, habiss: -2.0, abiss: -2.0, habis: -1.0, abis: -1.0, link: -1.0, phising: -4.0,
  menguap: -2.5, penimbunan: -3.0, tertahan: -1.5, retak: -2.0, membusuk: -3.5,
  terorisme: -4.5, bentrokan: -3.5, bentrok: -3.5, menembak: -3.5, tembak: -3.5,
  phk: -3.5, kemiskinan: -3.0, krisis: -3.0, macet: -2.0, kemacetan: -2.0, parah: -2.5,
  polusi: -2.5, ispa: -2.5, pamer: -2.0, kritis: -2.5, pajak: -1.5, denda: -1.5,
  tilang: -1.5, mati: -1.5, menumpuk: -1.5, foya: -2.5, 'foya-foya': -3.0, aus: -1.5,
  hangus: -2.5, overload: -2.5, kekerasan: -3.5, kecurangan: -3.5,
  kebakaran: -2.5, ledakan: -2.5,
  terlambat: -2.0, mandek: -2.5, mencekik: -3.0, sepihak: -2.0,
  terpuruk: -3.0, kacau: -3.0, dibiarkan: -2.0, membiarkan: -2.5, menindas: -3.5,
  penindasan: -3.5, bohong: -3.5, tipu: -4.0, sengketa: -2.5, penembakan: -4.0,
  kemewahan: -1.5, gigit: -1.5, jari: -1.0, dibeli: -1.5, curi: -2.5, penjara: -2.0,
  introspeksi: -1.5, diam: -1.0, dipotong: -1.5, minim: -1.5, kosong: -1.5,
  honorer: -1.0, gambut: -1.5, zonasi: -1.5, timbang: -1.0, kronis: -2.0,
  pukat: -2.5, harimau: -1.5, karet: -1.5, kasur: -1.0, lapas: -1.0, paspor: -1.0,
  pipa: -1.0, trotoar: -1.0, satpol: -1.0, gendong: -1.0, terumbu: -1.0,
  kependudukan: -1.0, disabilitas: -1.0, pasir: -1.0, tebing: -1.0, kjpplus: -1.0,
  kimia: -1.5, lari: -1.0, metana: -1.5, retribusi: -1.0, solar: -1.0, mengular: -1.0,
  stunting: -2.0, kedaluwarsa: -2.5, akreditasi: -1.0, gengsi: -1.5, amplop: -2.0,
  monopoli: -2.5, jarum: -1.5, suntik: -1.5, bolong: -2.0, bunga: -1.0,
  gembong: -3.5, tanggul: -1.5, down: -2.0, pensiun: -0.5, bumn: -0.5,
  titipan: -2.0, bendungan: -0.5, mikroplastik: -2.5, merkuri: -2.5, sonokeling: -1.5,
  amdal: -1.5, b3: -2.5, blanko: -1.5, pertalite: -1.0, senjata: -2.0, api: -1.5,
  mencemari: -3.5, mengelupas: -2.5, 'asal-asalan': -3.0, membahayakan: -3.0, bahaya: -2.5,
  selangit: -2.5, dikorupsi: -3.5, nakal: -2.0, lupa: -1.5, pemadaman: -2.5,
  terganggu: -2.0, antrean: -1.5, antre: -1.5, salah: -2.0, 'bolong-bolong': -2.5
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

  // Tentukan label sentimen berdasarkan batas ambang 0.6
  let label: SentimentLabel = 'NETRAL'
  if (totalScore > 0.6) {
    label = 'POSITIF'
  } else if (totalScore < -0.6) {
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
