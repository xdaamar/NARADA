/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — RELEVANCE INTELLIGENCE ENGINE (WP-02)
 * SPRINT 09: EVIDENCE-DRIVEN MONITORING SCOPE EVALUATION
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Prinsip Desain:
 * 1. Orthogonality: Relevansi terpisah mutlak dari Sentimen dan Vonis Kebenaran.
 * 2. Contextual Disambiguation: Kata "demo", "tni", "virus", atau akronim diuji
 *    konteks kalimatnya (misal: "demo aplikasi" BUKAN unjuk rasa sipil).
 * 3. Proscription Filter: Menyingkirkan gosip artis, olahraga, resep, dan zodiak.
 * 4. Transparent Heuristics: Skor 0-100 merepresentasikan kesesuaian topik pantauan,
 *    BUKAN probabilitas kebenaran klaim atau tingkat ancaman.
 * ══════════════════════════════════════════════════════════════════════════
 */

import { 
  type RelevanceCategory, 
  type RelevanceEvaluationResult,
  RELEVANCE_ENGINE_VERSION 
} from './claim-types.ts'
import { extractEntitiesFromText } from '../radar/clustering-engine.ts'

// Kata kunci eksklusi konten yang secara jelas berada di luar lingkup pertahanan kognitif
const NOISE_ENTERTAINMENT_TERMS = [
  'sinetron', 'artis', 'selebritis', 'gosip', 'pacar', 'pernikahan artis',
  'cerai artis', 'zodiak', 'ramalan bintang', 'horoskop', 'resep masakan',
  'kuliner', 'skincare', 'fashion show', 'busana muslim', 'ootd', 'makeup'
]

const NOISE_SPORTS_TERMS = [
  'skor akhir', 'liga inggris', 'liga champions', 'serie a', 'motogp',
  'formula 1', 'badminton indonesia open', 'babak pertama gol', 'klasemen liga',
  'sepak bola', 'bursa transfer pemain', 'head to head'
]

// Disambiguasi Kata Kunci Khusus
interface DisambiguationRule {
  keyword: string
  negatingContexts: string[]  // Jika konteks ini hadir -> tolak makna strategis
  affirmingContexts: string[] // Jika konteks ini hadir -> perkuat makna strategis
  falseCategory: string
  trueDomain: string
}

const DISAMBIGUATION_RULES: DisambiguationRule[] = [
  {
    keyword: 'demo',
    negatingContexts: ['aplikasi', 'software', 'game', 'perangkat', 'teknologi', 'fitur', 'video game', 'versi coba', 'uji coba sistem'],
    affirmingContexts: ['mahasiswa', 'buruh', 'jalan', 'dpr', 'gedung', 'massa', 'tuntutan', 'orasi', 'ricuh', 'polisi', 'unjuk rasa', 'spanduk', 'elemen'],
    falseCategory: 'TECHNOLOGY_OR_PRODUCT_DEMO',
    trueDomain: 'CIVIC_DYNAMICS'
  },
  {
    keyword: 'virus',
    negatingContexts: ['flu', 'batuk', 'medis', 'vaksin flu', 'demam', 'kucing', 'anjing', 'biologi', 'tanaman'],
    affirmingContexts: ['ransomware', 'malware', 'trojan', 'server', 'sistem', 'database', 'jaringan', 'pdns', 'peretasan', 'hacker', 'komputer'],
    falseCategory: 'BIOLOGICAL_MEDICAL_VIRUS',
    trueDomain: 'CYBER_PUBLIC_IMPACT'
  },
  {
    keyword: 'tni',
    negatingContexts: ['film', 'aktor', 'nobar', 'sejarah perang kuno', 'museum', 'nostalgia', 'sinema'],
    affirmingContexts: ['operasi', 'prajurit', 'alutsista', 'perbatasan', 'panglima', 'dispenad', 'kodam', 'korem', 'kodim', 'babinsa', 'patroli', 'latihan', 'natuna', 'papua', 'keamanan', 'kedaulatan'],
    falseCategory: 'ENTERTAINMENT_OR_HISTORICAL_REFERENCE',
    trueDomain: 'DEFENSE_SECURITY'
  }
]

// Domain Pantauan Strategis NARADA
const STRATEGIC_DOMAIN_PATTERNS: Record<string, { weight: number; patterns: string[] }> = {
  DEFENSE_SECURITY: {
    weight: 45,
    patterns: [
      'tni', 'tni ad', 'kemhan', 'alutsista', 'kedaulatan', 'perbatasan',
      'natuna', 'ambalat', 'papua', 'kkb', 'opm', 'marinir', 'kopassus',
      'kodam', 'patroli laut', 'pesawat tempur', 'kapal perang', 'kapal selam', 'dispenal', 'dispenau', 'hankam'
    ]
  },
  CYBER_PUBLIC_IMPACT: {
    weight: 45,
    patterns: [
      'kebocoran data', 'bocoran data', 'data bocor', 'dark web', 'serangan siber', 'ransomware', 'hacker', 'peretasan',
      'pdns', 'bssn', 'keamanan siber', 'malware', 'server down', 'gangguan server',
      'pencurian data', 'data breached'
    ]
  },
  INFORMATION_INTEGRITY: {
    weight: 40,
    patterns: [
      'cek fakta', 'hoaks', 'hoax', 'disinformasi', 'misinformasi',
      'klarifikasi', 'kabar bohong', 'manipulasi informasi', 'turnbackhoax',
      'kominfo tangkal', 'palsu'
    ]
  },
  NATIONAL_POLICY: {
    weight: 40,
    patterns: [
      'kebijakan presiden', 'prabowo', 'gibran', 'kabinet', 'kementerian',
      'dpr ri', 'mpr', 'kpk', 'kejagung', 'ikn', 'bansos', 'mbg',
      'makan bergizi gratis', 'anggaran negara', 'apbn'
    ]
  },
  DIGITAL_ECONOMY: {
    weight: 40,
    patterns: [
      'pajak digital', 'transaksi digital', 'fintech', 'marketplace',
      'qris', 'pph 22', 'kripto', 'bank digital', 'ojk', 'bank indonesia',
      'devisa', 'hashim', 'tarif digital', 'pajak transaksi digital'
    ]
  },
  CIVIC_DYNAMICS: {
    weight: 40,
    patterns: [
      'unjuk rasa', 'aksi massa', 'demonstrasi', 'pemakzulan', 'bentrok',
      'aksi demo', 'buruh', 'mahasiswa', 'aspirasi buruh', 'aliansi mahasiswa',
      'kericuhan', 'protes kebijakan'
    ]
  },
  PUBLIC_CRISIS: {
    weight: 40,
    patterns: [
      'bencana alam', 'gempa megathrust', 'tsunami', 'erupsi gunung',
      'banjir bandang', 'darurat pangan', 'kelangkaan bbm', 'bpom obat sirup',
      'bmkg peringatan', 'bnpb status darurat'
    ]
  }
}

/**
 * Menentukan tingkat kelengkapan konten artikel
 */
export function determineContentCoverage(
  title: string,
  description?: string,
  content?: string
): 'FULL_TEXT' | 'TITLE_AND_SNIPPET' | 'TITLE_ONLY' | 'METADATA_ONLY' {
  if (content && content.trim().length > 100) return 'FULL_TEXT'
  if (description && description.trim().length > 50) return 'TITLE_AND_SNIPPET'
  if (title && title.trim().length > 0) return 'TITLE_ONLY'
  return 'METADATA_ONLY'
}

/**
 * Evaluasi Relevansi Intelijen Konten Secara Multitahap (WP-02)
 */
export function evaluateIntelligenceRelevance(params: {
  title: string
  description?: string
  content?: string
  sourceType?: string
  explicitDomainHint?: string
}): RelevanceEvaluationResult {
  const title = (params.title || '').trim()
  const description = (params.description || '').trim()
  const content = (params.content || '').trim()
  const fullText = `${title} ${description} ${content}`.toLowerCase()
  const contentCoverage = determineContentCoverage(title, description, content)

  const acceptanceReasons: string[] = []
  const rejectionReasons: string[] = []
  const matchedEntities = extractEntitiesFromText(fullText)
  const matchedContextTerms: string[] = []

  // ─── TAHAP 1: FILTER PROSKRIPSI / NOISE EKSKLUSIF ───
  let isNoise = false
  for (const noiseTerm of NOISE_ENTERTAINMENT_TERMS) {
    if (fullText.includes(noiseTerm)) {
      rejectionReasons.push(`EXCLUDED_ENTERTAINMENT_CONTEXT: ${noiseTerm}`)
      isNoise = true
      break
    }
  }
  for (const noiseTerm of NOISE_SPORTS_TERMS) {
    if (fullText.includes(noiseTerm)) {
      rejectionReasons.push(`EXCLUDED_SPORTS_CONTEXT: ${noiseTerm}`)
      isNoise = true
      break
    }
  }

  // Jika terindikasi kuat sebagai konten noise tanpa rujukan pertahanan/siber, eliminasi cepat
  const hasStrongDefenseAnchor = fullText.includes('tni') || fullText.includes('kemhan') || fullText.includes('kedaulatan') || fullText.includes('serangan siber')
  if (isNoise && !hasStrongDefenseAnchor) {
    return {
      category: 'IRRELEVANT',
      score: 10,
      matchedEntities,
      matchedContextTerms: [],
      rejectionReasons,
      acceptanceReasons: [],
      contentCoverage,
      isAmbiguous: false,
      engineVersion: RELEVANCE_ENGINE_VERSION
    }
  }

  // ─── TAHAP 2: DISAMBIGUASI KATA KUNCI POLISEMIK ───
  let isAmbiguous = false
  let calculatedScore = 20 // Baseline untuk artikel pers publik
  let bestDomain: string | undefined = params.explicitDomainHint

  for (const rule of DISAMBIGUATION_RULES) {
    if (fullText.includes(rule.keyword)) {
      const hasNegating = rule.negatingContexts.some(ctx => fullText.includes(ctx))
      const hasAffirming = rule.affirmingContexts.some(ctx => fullText.includes(ctx))

      if (hasNegating && !hasAffirming) {
        rejectionReasons.push(`DISAMBIGUATION_REJECTED: '${rule.keyword}' teridentifikasi sebagai ${rule.falseCategory}`)
        calculatedScore = Math.min(calculatedScore, 20)
      } else if (hasAffirming) {
        acceptanceReasons.push(`DISAMBIGUATION_CONFIRMED: '${rule.keyword}' terkonfirmasi dalam domain ${rule.trueDomain}`)
        matchedContextTerms.push(`${rule.keyword}:${rule.trueDomain}`)
        calculatedScore = Math.max(calculatedScore, 65)
        bestDomain = rule.trueDomain
      } else {
        // Hanya muncul kata kunci tanpa konteks yang memperjelas
        rejectionReasons.push(`DISAMBIGUATION_UNCERTAIN: '${rule.keyword}' muncul tanpa konteks yang cukup`)
        isAmbiguous = true
      }
    }
  }

  // ─── TAHAP 3: PENCOCOKAN DOMAIN TAKSONOMI STRATEGIS ───
  if (params.sourceType === 'fact_check') {
    calculatedScore = Math.max(calculatedScore, 85)
    acceptanceReasons.push('OFFICIAL_FACTCHECK_SOURCE')
    bestDomain = 'INFORMATION_INTEGRITY'
  }

  for (const [domainName, def] of Object.entries(STRATEGIC_DOMAIN_PATTERNS)) {
    const hits: string[] = []
    for (const pat of def.patterns) {
      if (fullText.includes(pat)) {
        hits.push(pat)
      }
    }

    if (hits.length > 0) {
      const domainBonus = def.weight + Math.min(30, (hits.length - 1) * 10)
      if (domainBonus + 20 > calculatedScore) {
        calculatedScore = Math.min(95, 20 + domainBonus)
        bestDomain = domainName
      }
      hits.forEach(h => matchedContextTerms.push(h))
      acceptanceReasons.push(`DOMAIN_MATCH_${domainName}: (${hits.join(', ')})`)
    }
  }

  // ─── TAHAP 4: PENILAIAN CAKUPAN KONTEN & AMBIGUITAS ───
  // Jika hanya memiliki judul singkat (< 5 kata) tanpa kecocokan domain kuat
  const substantiveWordCount = title.split(/\s+/).filter(w => w.length > 2).length
  if (contentCoverage === 'TITLE_ONLY' && substantiveWordCount < 5 && calculatedScore < 60) {
    calculatedScore = Math.min(calculatedScore, 40)
    isAmbiguous = true
    rejectionReasons.push('LIMITED_CONTEXT_SHORT_TITLE')
  }

  // Kurangi skor jika terdapat ambiguitas terdeteksi tanpa klarifikasi
  if (isAmbiguous && calculatedScore > 45) {
    calculatedScore = Math.max(35, calculatedScore - 25)
  }

  // ─── TAHAP 5: KATEGORISASI KANONIKAL (RELEVANT / UNCERTAIN / IRRELEVANT) ───
  let category: RelevanceCategory
  if (calculatedScore >= 60) {
    category = 'RELEVANT'
  } else if (calculatedScore >= 35 || isAmbiguous) {
    category = 'UNCERTAIN'
  } else {
    category = 'IRRELEVANT'
  }

  return {
    category,
    score: Math.round(calculatedScore),
    matchedDomain: bestDomain,
    matchedEntities,
    matchedContextTerms: Array.from(new Set(matchedContextTerms)),
    rejectionReasons,
    acceptanceReasons,
    contentCoverage,
    isAmbiguous,
    engineVersion: RELEVANCE_ENGINE_VERSION
  }
}
