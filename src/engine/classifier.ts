import type { ContentCategory, ThreatLevel, AnalysisResult } from '../types'

// ─── Keyword Dictionaries (Indonesia) ───
const HOAKS_KEYWORDS = [
  'hoaks', 'hoax', 'bohong', 'palsu', 'fitnah', 'tidak benar', 'sebarkan', 'viral',
  'benarkah', 'katanya', 'konon', 'beredar', 'tersebar luas', 'cek fakta',
  'diragukan', 'perlu diverifikasi', 'isu', 'kabar angin', 'rumor'
]

const PROPAGANDA_KEYWORDS = [
  'agenda', 'bangkitkan', 'perjuangan', 'musuh negara', 'pengkhianat', 'asing',
  'imperialis', 'kolonialis', 'jangan percaya', 'mereka menyembunyikan', 'fakta tersembunyi',
  'rezim', 'diktator', 'rakyat melawan', 'revolusi', 'bangkitlah', 'lawan', 'hancurkan',
  'sistem korup', 'elit busuk', 'rakyat dibohongi', 'bongkar', 'ungkap kebenaran'
]

const BUZZER_KEYWORDS = [
  'share', 'bagikan', 'retweet', 'rt', 'viralkan', 'sebarkan', 'tag teman',
  '#', 'trending', 'masif', 'serempak', 'bersama-sama',
  'kompak', 'solid', 'bersatu', 'gerakan', 'kampanye', 'dukung', 'lawan'
]

const DISINFORMASI_KEYWORDS = [
  'manipulasi', 'distorsi', 'diputarbalikkan', 'keluar konteks', 'salah kaprah',
  'misleading', 'menyesatkan', 'memutarbalik', 'dicabut konteks', 'data palsu',
  'statistik bohong', 'gambar lama', 'foto editan', 'video dipotong', 'deepfake',
  'dikutip salah', 'tidak lengkap', 'separuh kebenaran'
]

const HIGH_RISK_PATTERNS = [
  'tni', 'militer', 'polisi', 'presiden', 'pemerintah', 'bssn', 'jatuh', 'tumbang',
  'kudeta', 'makar', 'subversif', 'infiltrasi', 'mata-mata', 'agen asing', 'provokasi',
  'rusuh', 'kerusuhan', 'chaos', 'anarkis', 'demonstrasi', 'bentrok'
]

// ─── Threat Level Score Mapping ───
function scoreToThreatLevel(score: number): ThreatLevel {
  if (score >= 80) return 'critical'
  if (score >= 60) return 'high'
  if (score >= 35) return 'medium'
  return 'low'
}

// ─── Keyword Counter ───
function countKeywords(text: string, keywords: string[]): { count: number; found: string[] } {
  const lower = text.toLowerCase()
  const found = keywords.filter(kw => lower.includes(kw.toLowerCase()))
  return { count: found.length, found }
}

// ─── Explanation Generator ───
function generateExplanation(
  category: ContentCategory,
  foundKeywords: string[],
  confidence: number,
  _text: string
): string {

  const explanations: Record<ContentCategory, string> = {
    HOAKS: `Konten ini terdeteksi mengandung pola narasi hoaks dengan confidence ${confidence.toFixed(0)}%. ` +
      `Indikator yang terdeteksi: penggunaan kata-kata pemicu seperti "${foundKeywords.slice(0, 3).join('", "')}" ` +
      `yang umum ditemukan dalam konten yang menyebarkan informasi tidak terverifikasi. ` +
      `Konten cenderung menggunakan gaya bahasa yang mendorong penyebaran masif tanpa verifikasi sumber.`,

    PROPAGANDA: `Konten ini mengandung elemen propaganda dengan pola manipulasi opini publik. ` +
      `Terdeteksi penggunaan framing emosional tinggi dan kata kunci propagandistik: ` +
      `"${foundKeywords.slice(0, 3).join('", "')}". ` +
      `Konten dirancang untuk menciptakan persepsi "kita vs mereka" yang dapat memecah belah masyarakat.`,

    BUZZER: `Pola konten ini mengindikasikan aktivitas buzzer atau koordinasi artifisial. ` +
      `Terdeteksi seruan masif untuk viralkan/sebarkan dengan kata kunci: "${foundKeywords.slice(0, 3).join('", "')}". ` +
      `Konten tampaknya dirancang untuk meningkatkan jangkauan secara tidak organik melalui koordinasi akun.`,

    DISINFORMASI: `Konten ini mengandung indikasi disinformasi — informasi yang secara teknis mungkin parsial benar ` +
      `namun disajikan dengan cara menyesatkan. Kata kunci terdeteksi: "${foundKeywords.slice(0, 3).join('", "')}". ` +
      `Waspadai penggunaan data/konteks yang dimanipulasi atau dikutip secara tidak lengkap.`,

    NETRAL: `Konten ini tidak menunjukkan indikator ancaman kognitif yang signifikan. ` +
      `Skor ancaman rendah menunjukkan bahwa konten kemungkinan besar adalah informasi yang sah dan tidak memanipulasi. ` +
      `Namun tetap disarankan verifikasi lintas sumber untuk konten sensitif.`,
  }

  return explanations[category]
}

// ─── Recommendation Generator ───
function generateRecommendation(category: ContentCategory, threatLevel: ThreatLevel): string {
  const recs: Record<ContentCategory, Record<ThreatLevel, string>> = {
    HOAKS: {
      low: 'Monitor konten ini. Lakukan verifikasi sumber jika diperlukan.',
      medium: 'Verifikasi segera dengan sumber resmi. Tambahkan ke watchlist pemantauan.',
      high: 'Laporkan ke unit fact-checking. Blokir penyebaran lebih lanjut di kanal internal.',
      critical: 'TINDAKAN SEGERA: Eskalasi ke pimpinan siber. Counter-narrative diperlukan dalam 1 jam.'
    },
    PROPAGANDA: {
      low: 'Monitor dan dokumentasikan pola narasi.',
      medium: 'Analisis lebih lanjut terhadap sumber. Persiapkan counter-narrative.',
      high: 'Eskalasi ke unit intelijen. Siapkan respons komunikasi strategis.',
      critical: 'TINDAKAN SEGERA: Koordinasi dengan BSSN dan satuan terkait. Blokir narasi berbahaya.'
    },
    BUZZER: {
      low: 'Pantau koordinasi akun selama 24 jam ke depan.',
      medium: 'Identifikasi dan mapping jaringan buzzer. Dokumentasi untuk analisis lanjutan.',
      high: 'Laporkan ke platform terkait. Investigasi koordinator jaringan.',
      critical: 'TINDAKAN SEGERA: Koordinasi penanggulangan dengan unit cyber ops.'
    },
    DISINFORMASI: {
      low: 'Catat dan monitor. Verifikasi keaslian data yang dikutip.',
      medium: 'Keluarkan klarifikasi resmi jika menyangkut institusi TNI AD.',
      high: 'Siapkan tanggapan resmi. Eskalasi ke bagian Penerangan.',
      critical: 'TINDAKAN SEGERA: Rilis klarifikasi resmi dan lapor ke pimpinan.'
    },
    NETRAL: {
      low: 'Tidak ada tindakan khusus diperlukan. Konten aman.',
      medium: 'Tidak ada tindakan khusus diperlukan.',
      high: 'Tidak ada tindakan khusus diperlukan.',
      critical: 'Tidak ada tindakan khusus diperlukan.'
    }
  }
  return recs[category][threatLevel]
}

// ─── Main Classifier Function ───
export function classifyText(text: string): AnalysisResult {
  const trimmed = text.trim()
  
  // Count keyword matches
  const hoaksMatch = countKeywords(trimmed, HOAKS_KEYWORDS)
  const propagandaMatch = countKeywords(trimmed, PROPAGANDA_KEYWORDS)
  const buzzerMatch = countKeywords(trimmed, BUZZER_KEYWORDS)
  const disinfoMatch = countKeywords(trimmed, DISINFORMASI_KEYWORDS)
  const highRiskMatch = countKeywords(trimmed, HIGH_RISK_PATTERNS)
  
  const wordCount = trimmed.split(/\s+/).length

  // Raw scores (normalized)
  const rawScores = {
    HOAKS: Math.min(100, (hoaksMatch.count / Math.max(wordCount * 0.05, 1)) * 100 + hoaksMatch.count * 8),
    PROPAGANDA: Math.min(100, (propagandaMatch.count / Math.max(wordCount * 0.05, 1)) * 100 + propagandaMatch.count * 9),
    BUZZER: Math.min(100, (buzzerMatch.count / Math.max(wordCount * 0.05, 1)) * 100 + buzzerMatch.count * 7),
    DISINFORMASI: Math.min(100, (disinfoMatch.count / Math.max(wordCount * 0.05, 1)) * 100 + disinfoMatch.count * 8),
  }

  // High risk boost
  const riskBoost = highRiskMatch.count * 5

  // Find winning category
  const maxScore = Math.max(...Object.values(rawScores)) + riskBoost
  let category: ContentCategory = 'NETRAL'
  let dominantKeywords: string[] = []

  if (maxScore < 15) {
    category = 'NETRAL'
  } else if (rawScores.PROPAGANDA + riskBoost >= Math.max(rawScores.HOAKS, rawScores.BUZZER, rawScores.DISINFORMASI) + riskBoost) {
    category = 'PROPAGANDA'
    dominantKeywords = [...propagandaMatch.found, ...highRiskMatch.found]
  } else if (rawScores.HOAKS >= Math.max(rawScores.PROPAGANDA, rawScores.BUZZER, rawScores.DISINFORMASI)) {
    category = 'HOAKS'
    dominantKeywords = [...hoaksMatch.found, ...highRiskMatch.found]
  } else if (rawScores.BUZZER >= Math.max(rawScores.HOAKS, rawScores.PROPAGANDA, rawScores.DISINFORMASI)) {
    category = 'BUZZER'
    dominantKeywords = [...buzzerMatch.found, ...highRiskMatch.found]
  } else {
    category = 'DISINFORMASI'
    dominantKeywords = [...disinfoMatch.found, ...highRiskMatch.found]
  }

  // Confidence calculation
  const totalScore = rawScores.HOAKS + rawScores.PROPAGANDA + rawScores.BUZZER + rawScores.DISINFORMASI
  let confidence = totalScore === 0 ? 5 : Math.min(98, maxScore)
  if (category === 'NETRAL') confidence = Math.max(70, 100 - maxScore)

  // Normalize all scores for display
  const normalizedTotal = Math.max(totalScore, 1)
  const allScores: { label: ContentCategory; score: number }[] = [
    { label: 'HOAKS', score: totalScore === 0 ? 5 : Math.round((rawScores.HOAKS / normalizedTotal) * 100) },
    { label: 'PROPAGANDA', score: totalScore === 0 ? 5 : Math.round((rawScores.PROPAGANDA / normalizedTotal) * 100) },
    { label: 'BUZZER', score: totalScore === 0 ? 5 : Math.round((rawScores.BUZZER / normalizedTotal) * 100) },
    { label: 'DISINFORMASI', score: totalScore === 0 ? 5 : Math.round((rawScores.DISINFORMASI / normalizedTotal) * 100) },
    { label: 'NETRAL', score: category === 'NETRAL' ? Math.round(confidence) : Math.max(5, Math.round(100 - confidence)) },
  ]

  const threatLevel = category === 'NETRAL' ? 'low' : scoreToThreatLevel(confidence + riskBoost)
  const explanation = generateExplanation(category, dominantKeywords.slice(0, 5), confidence, trimmed)
  const recommendation = generateRecommendation(category, threatLevel)

  return {
    id: `NRD-${Date.now()}`,
    timestamp: Date.now(),
    input: trimmed,
    category,
    threatLevel,
    confidence: Math.round(confidence),
    scores: allScores,
    explanation,
    keywords: [...new Set(dominantKeywords)].slice(0, 8),
    recommendation,
  }
}

// ─── Batch Classification ───
export function classifyBatch(texts: string[]): AnalysisResult[] {
  return texts.map(t => classifyText(t))
}
