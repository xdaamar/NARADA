import type { DebunkKnowledgeEntry, ThreatLevel } from '../../types.ts'
import { analyzeSentiment } from '../forensic/sentiment-engine.ts'

export type EarlyWarningAlertLevel = 'SIAGA_KRITIS' | 'ATENSI_INTELIJEN' | 'MONITORING_RUTIN'
export type RadarTriageStatus = 'UNVERIFIED' | 'HOAKS' | 'FAKTA' | 'NETRAL'

export interface EarlyWarningScoreResult {
  threatIndex: number            // 0 - 100: Total Indeks Ancaman Kognitif
  entitySensitivity: number      // 0 - 100: Skor Sensitivitas Entitas (TNI, Negara, Bencana)
  agitationScore: number         // 0 - 100: Skor Sentimen Agitasi & Provokasi Bahasa
  trendVelocityScore: number     // 0 - 100: Skor Kecepatan & Volume Viralitas
  alertLevel: EarlyWarningAlertLevel
  triageStatus: RadarTriageStatus
  matchedDebunkId?: string
  strategicAdvice: string
}

export interface TacticalBriefingSummary {
  totalScanned: number
  unverifiedCount: number
  hoaxCount: number
  factCount: number
  neutralCount: number
  criticalCount: number
  headlineItems: DebunkKnowledgeEntry[]
  lastScannedTime: string
}

/**
 * 1. Evaluasi Sensitivitas Entitas Sasaran (E)
 * Menilai tingkat sensitivitas entitas yang menjadi sasaran narasi.
 * Kedaulatan Militer dan Lembaga Negara hanya mendapat bobot kritis (80-100) jika berkorelasi
 * dengan ancaman, konflik, separatisme, hoaks, atau polemik.
 */
export function calculateEntitySensitivity(text: string): number {
  const norm = text.toLowerCase()

  // Prioritas Kritis (100): Separatisme Bersenjata, Ancaman Perbatasan, & Serangan Alutsista/Militer
  if (
    norm.includes('opm') ||
    norm.includes('kkb') ||
    norm.includes('separatis') ||
    norm.includes('pemberontak') ||
    norm.includes('baku tembak') ||
    norm.includes('penyanderaan') ||
    norm.includes('sabotase') ||
    norm.includes('rahasia intelijen') ||
    norm.includes('dokumen rahasia') ||
    norm.includes('pangkalan militer diserang') ||
    norm.includes('perbatasan natuna') ||
    (norm.includes('alutsista') && (norm.includes('rongsokan') || norm.includes('fiktif') || norm.includes('korupsi') || norm.includes('jatuh')))
  ) {
    return 100
  }

  // Prioritas Sangat Tinggi (85): Lembaga Hankam/TNI yang Menjadi Sasaran Tudingan / Hoaks / Polemik / Operasi Kedaulatan
  const hasMilitaryEntity = norm.includes('tni') || norm.includes('panglima tni') || norm.includes('kasad') || norm.includes('kopassus') || norm.includes('kemhan')
  const hasConflictTrigger = norm.includes('hoaks') || norm.includes('hoax') || norm.includes('viral') || norm.includes('polemik') || 
                             norm.includes('kontroversi') || norm.includes('bentrok') || norm.includes('tuding') || norm.includes('dicopot') || 
                             norm.includes('korupsi') || norm.includes('desak') || norm.includes('skandal') || norm.includes('provokasi') ||
                             norm.includes('kedaulatan') || norm.includes('perbatasan') || norm.includes('ancaman')

  if (hasMilitaryEntity && hasConflictTrigger) {
    return 85
  }

  // Prioritas Tinggi (75): Lembaga Kepresidenan, Intelijen, & Bencana Kritis
  if (
    norm.includes('presiden') ||
    norm.includes('wapres') ||
    norm.includes('gibran') ||
    norm.includes('prabowo') ||
    norm.includes('jokowi') ||
    norm.includes('bin') ||
    norm.includes('bssn') ||
    norm.includes('megathrust') ||
    norm.includes('tsunami') ||
    norm.includes('erupsi merapi')
  ) {
    return 75
  }

  // Prioritas Menengah-Tinggi (50): Kementerian Strategis, Bansos, Pangan, & Kebijakan Sensitif
  if (
    norm.includes('kemensos') ||
    norm.includes('bansos') ||
    norm.includes('kemenkes') ||
    norm.includes('bpom') ||
    norm.includes('pertamina') ||
    norm.includes('kpu') ||
    norm.includes('bawaslu') ||
    norm.includes('vaksin') ||
    norm.includes('beras') ||
    norm.includes('papua')
  ) {
    return 50
  }

  // Sebutan militer/instansi dalam kegiatan biasa/kedinasan tanpa konflik (30)
  if (hasMilitaryEntity) {
    return 30
  }

  // Prioritas Standar (20): Isu Publik Umum
  return 20
}

/**
 * 2. Evaluasi Sentimen Agitasi & Provokasi Bahasa (S)
 * Menggunakan InSet Lexicon dari sentiment-engine.ts
 */
export function calculateAgitationSentiment(text: string): number {
  const norm = text.toLowerCase()
  const sentiment = analyzeSentiment(text)

  let baseAgitation = 25

  if (sentiment.label === 'PROVOKATIF') {
    // Semakin negatif skor sentimen, semakin tinggi skor agitasi
    baseAgitation = Math.min(100, Math.round(55 + Math.abs(sentiment.score) * 8))
  } else if (sentiment.label === 'POSITIF') {
    baseAgitation = Math.max(5, Math.round(25 - sentiment.score * 4))
  }

  // Kata pemicu kepanikan sosial tambahan
  const panicWords = [
    'panik', 'darurat', 'bahaya', 'dicopot', 'teror', 'pecat', 'serbu', 
    'bakar', 'bohong', 'palsu', 'penipuan', 'gulingkan', 'kudeta', 'racun',
    'bocorbocor', 'waspada', 'darurat sipil'
  ]

  let panicBonus = 0
  for (const word of panicWords) {
    if (norm.includes(word)) {
      panicBonus += 12
    }
  }

  return Math.min(100, baseAgitation + panicBonus)
}

/**
 * 3. Evaluasi Kecepatan & Volume Tren Viralitas (T)
 */
export function calculateTrendVelocity(trafficStr?: string, isLiveNews?: boolean): number {
  if (!trafficStr && !isLiveNews) return 30

  if (trafficStr) {
    const cleanTraffic = trafficStr.replace(/[^0-9K+]/g, '')
    if (cleanTraffic.includes('100K+') || cleanTraffic.includes('200K+')) return 95
    if (cleanTraffic.includes('50K+')) return 85
    if (cleanTraffic.includes('20K+') || cleanTraffic.includes('10K+')) return 75
    if (cleanTraffic.includes('5K+') || cleanTraffic.includes('2K+')) return 65
    return 55
  }

  if (isLiveNews) {
    return 60
  }

  return 35
}

/**
 * 4. Komputasi Skor Peringatan Dini Kognitif (Left-of-Bang Scorer)
 * Formula: R = 0.40 * E + 0.35 * S + 0.25 * T
 */
export function computeEarlyWarningScore(
  item: DebunkKnowledgeEntry, 
  knownDebunks: DebunkKnowledgeEntry[] = []
): EarlyWarningScoreResult {
  const fullText = `${item.claim} ${item.clarification} ${item.officialSource}`
  
  const E = calculateEntitySensitivity(fullText)
  const S = calculateAgitationSentiment(fullText)
  const T = calculateTrendVelocity(item.trendTraffic, item.isLive)

  // Indeks Ancaman Kognitif Gabungan (0 - 100)
  const threatIndex = Math.min(100, Math.round(0.40 * E + 0.35 * S + 0.25 * T))

  // Tentukan Level Siaga
  let alertLevel: EarlyWarningAlertLevel = 'MONITORING_RUTIN'
  if (threatIndex >= 75) {
    alertLevel = 'SIAGA_KRITIS'
  } else if (threatIndex >= 50) {
    alertLevel = 'ATENSI_INTELIJEN'
  }

  // Cross-Matching Cerdas dengan Pangkalan Data Cek Fakta Resmi
  let matchedDebunkId: string | undefined = undefined
  let triageStatus: RadarTriageStatus = item.verdict as RadarTriageStatus

  // Jika item masih bertatus UNVERIFIED, lakukan pencocokan silang dengan arsip fakta
  if (item.verdict === 'UNVERIFIED' && knownDebunks.length > 0) {
    const claimKeywords = item.keywords.filter(k => k.length >= 4)
    
    for (const known of knownDebunks) {
      if (known.id === item.id) continue
      
      const common = known.keywords.filter(k => claimKeywords.includes(k))
      const matchRatio = common.length / Math.max(1, Math.min(claimKeywords.length, known.keywords.length))

      // Jika ada kecocokan kata kunci >= 60% dengan kasus hoaks yang sudah terbukti
      if (matchRatio >= 0.60 && (known.verdict === 'HOAKS' || known.verdict === 'DISINFORMASI')) {
        triageStatus = 'HOAKS'
        matchedDebunkId = known.id
        break
      }
    }
  }

  // Jika tetap UNVERIFIED, klasifikasikan berdasarkan entitas dan sentimen
  if (!triageStatus || triageStatus === 'UNVERIFIED') {
    if (item.verdict === 'HOAKS' || item.verdict === 'DISINFORMASI' || item.verdict === 'PROPAGANDA') {
      triageStatus = 'HOAKS'
    } else if (item.verdict === 'FAKTA') {
      triageStatus = 'FAKTA'
    } else if (S <= 30 && E <= 35) {
      triageStatus = 'NETRAL'
    } else {
      triageStatus = 'UNVERIFIED'
    }
  }

  // Rekomendasi Tindakan Taktis Militer
  let strategicAdvice = 'Situasi terkendali. Lakukan pemantauan rutin pada sentimen publik.'
  if (alertLevel === 'SIAGA_KRITIS') {
    strategicAdvice = 'ATENSI DISPENAD: Narasi memiliki potensi eskalasi krisis kognitif tinggi. Siapkan draf rilis klarifikasi teritorial sebelum opini publik terbelah.'
  } else if (alertLevel === 'ATENSI_INTELIJEN') {
    strategicAdvice = 'ATENSI INTELIJEN TERITORIAL: Pantau penyebaran akun pendengung (buzzer) dan awasi narasi di media sosial binaan.'
  }

  return {
    threatIndex,
    entitySensitivity: E,
    agitationScore: S,
    trendVelocityScore: T,
    alertLevel,
    triageStatus,
    matchedDebunkId,
    strategicAdvice
  }
}

/**
 * 5. Enricher Seluruh Entri Radar dengan Skor Early Warning & Triage Dinamis
 */
export function scoreAndTriageRadarEntries(
  entries: DebunkKnowledgeEntry[],
  knownDebunks: DebunkKnowledgeEntry[] = []
): DebunkKnowledgeEntry[] {
  return entries.map(item => {
    const scoreResult = computeEarlyWarningScore(item, knownDebunks)

    let threatLevel: ThreatLevel = 'low'
    if (scoreResult.alertLevel === 'SIAGA_KRITIS') threatLevel = 'critical'
    else if (scoreResult.alertLevel === 'ATENSI_INTELIJEN') threatLevel = 'high'
    else threatLevel = 'medium'

    return {
      ...item,
      verdict: scoreResult.triageStatus,
      threatLevel,
      cognitiveScore: scoreResult.threatIndex,
      tacticalResponseMilitary: scoreResult.strategicAdvice
    }
  })
}

/**
 * 6. Pembuat Ringkasan Eksekutif untuk Pop-up Notifikasi Intelijen (Saat Halaman Dibuka)
 */
export function getTacticalBriefingSummary(entries: DebunkKnowledgeEntry[]): TacticalBriefingSummary {
  const totalScanned = entries.length
  let unverifiedCount = 0
  let hoaxCount = 0
  let factCount = 0
  let neutralCount = 0
  let criticalCount = 0

  entries.forEach(e => {
    if (e.verdict === 'HOAKS' || e.verdict === 'DISINFORMASI' || e.verdict === 'PROPAGANDA') hoaxCount++
    else if (e.verdict === 'FAKTA') factCount++
    else if (e.verdict === 'NETRAL') neutralCount++
    else unverifiedCount++

    if (e.threatLevel === 'critical' || (e.cognitiveScore && e.cognitiveScore >= 75)) {
      criticalCount++
    }
  })

  // Urutkan headline: ambil 3 isu paling kritis
  const sorted = [...entries].sort((a, b) => (b.cognitiveScore || 0) - (a.cognitiveScore || 0))
  const headlineItems = sorted.slice(0, 3)

  const now = new Date()
  const lastScannedTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} WIB`

  return {
    totalScanned,
    unverifiedCount,
    hoaxCount,
    factCount,
    neutralCount,
    criticalCount,
    headlineItems,
    lastScannedTime
  }
}
