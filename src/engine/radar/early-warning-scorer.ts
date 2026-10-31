/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — RADAR ASSESSMENT & TRIAGE ADAPTER
 * SPRINT 1: EVIDENCE-DRIVEN TRIAGE WITHOUT ARBITRARY THREAT SCORING
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Mengintegrasikan:
 * 1. FreshnessEngine (penilaian waktu deterministik)
 * 2. RadarAssessment (relevansi konteks & transparansi metadata)
 * 3. Cross-Matching Cek Fakta dengan pangkalan data arsip MAFINDO
 * 
 * Kompatibilitas:
 * Mempertahankan interface publik untuk consumer existing (LiveRadar.tsx)
 * dengan meniadakan formula ancaman spekulatif dan virality fiktif.
 * ══════════════════════════════════════════════════════════════════════════
 */

import type { DebunkKnowledgeEntry, ThreatLevel } from '../../types.ts'
import { analyzeSentiment } from '../forensic/sentiment-engine.ts'
import { evaluateContextRelevance, evaluateMetadataTransparency } from './radar-assessment.ts'
import { parseSourceDate, evaluateFreshness } from './freshness-engine.ts'
import { evaluateClaimFirewall } from './claim-firewall.ts'
import type { ClaimMatchCandidate } from './radar-types.ts'

export type EarlyWarningAlertLevel = 'SIAGA_KRITIS' | 'ATENSI_INTELIJEN' | 'MONITORING_RUTIN'
export type RadarTriageStatus = 'UNVERIFIED' | 'HOAKS' | 'FAKTA' | 'NETRAL'

export interface EarlyWarningScoreResult {
  threatIndex: number            // 0 - 100: Relevansi Konteks Strategis & Prioritas Telaah
  entitySensitivity: number      // 0 - 100: Kesesuaian Entitas Strategis Pertahanan
  agitationScore: number         // 0 - 100: Skor Sentimen Agitasi Bahasa (Informasional)
  trendVelocityScore: number     // 0 - 100: Sinyal Tren Terverifikasi dari Sumber
  alertLevel: EarlyWarningAlertLevel
  triageStatus: RadarTriageStatus
  matchedDebunkId?: string
  strategicAdvice: string
  reasonCodes?: string[]
  claimMatchCandidate?: ClaimMatchCandidate
  requiresAnalystReview?: boolean
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
 * Mengukur keterkaitan topik dengan kedaulatan, lembaga pertahanan, dan institusi negara.
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

  // Prioritas Sangat Tinggi (85): Lembaga Hankam/TNI yang Menjadi Sasaran Tudingan / Hoaks / Polemik
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

  // Prioritas Menengah (50): Kementerian Strategis, Bansos, Pangan, & Kebijakan Sensitif
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

  if (hasMilitaryEntity) {
    return 30
  }

  return 20
}

/**
 * 2. Evaluasi Sentimen Agitasi & Bahasa Provokatif (S)
 * Sentimen dianalisis sebagai indikator gaya bahasa, BUKAN bukti langsung ancaman.
 */
export function calculateAgitationSentiment(text: string): number {
  const norm = text.toLowerCase()
  const sentiment = analyzeSentiment(text)

  let baseAgitation = 25

  if (sentiment.label === 'PROVOKATIF') {
    baseAgitation = Math.min(100, Math.round(55 + Math.abs(sentiment.score) * 8))
  } else if (sentiment.label === 'POSITIF') {
    baseAgitation = Math.max(5, Math.round(25 - sentiment.score * 4))
  }

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
 * 3. Evaluasi Sinyal Tren Publik Terverifikasi (T)
 * Menggunakan angka volume nyata dari Google Trends (jika ada), bukan perkiraan RSS.
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
    return 50
  }

  return 35
}

/**
 * 4. Komputasi Skor Prioritas Penelaahan Radar (Multidimensional Assessor)
 * Menghitung tingkat urgensi telaah berdasarkan kombinasi Relevansi Konteks,
 * Kebaruan Waktu (Freshness), dan Keberadaan Klarifikasi Resmi.
 */
export function computeEarlyWarningScore(
  item: DebunkKnowledgeEntry, 
  knownDebunks: DebunkKnowledgeEntry[] = []
): EarlyWarningScoreResult {
  const fullText = `${item.claim} ${item.clarification || ''} ${item.officialSource || ''}`
  
  // 1. Evaluasi Komponen Atomik
  const E = calculateEntitySensitivity(fullText)
  const S = calculateAgitationSentiment(fullText)
  const T = calculateTrendVelocity(item.trendTraffic, item.isLive)

  // 2. Evaluasi Multidimensi Resmi
  const contextRelevance = evaluateContextRelevance(
    item.claim,
    item.clarification || '',
    item.cluster || 'UMUM_NETRAL',
    item.sourceUrl?.includes('turnbackhoax') ? 'fact_check' : 'rss'
  )

  const { timestamp: pubTimestamp } = parseSourceDate(item.publishedDate)
  const freshness = evaluateFreshness(pubTimestamp)
  const transparency = evaluateMetadataTransparency(
    item.originalSourceUrl || '',
    item.sourceUrl || '',
    item.officialSource || '',
    pubTimestamp
  )

  // Skor Prioritas Telaah (0 - 100): Menggabungkan Relevansi Konteks & Kebaruan
  let effectiveRelevance = Math.max(contextRelevance.score, E)
  let freshnessWeight = 30
  if (freshness.status === 'BREAKING') freshnessWeight = 50
  else if (freshness.status === 'AKTUAL') freshnessWeight = 40
  else if (freshness.status === 'BERKEMBANG') freshnessWeight = 30
  else if (item.isLive && freshness.status === 'UNKNOWN_DATE') freshnessWeight = 45 // Fresh live observation
  else freshnessWeight = 15

  if (T >= 75) {
    freshnessWeight = Math.min(55, freshnessWeight + 10)
  }

  // Skala deterministik yang transparan (tanpa membuat klaim ancaman sepihak)
  const threatIndex = Math.min(100, Math.round(0.60 * effectiveRelevance + 0.40 * freshnessWeight))

  // 3. Menentukan Level Siaga berdasarkan urgensi telaah
  let alertLevel: EarlyWarningAlertLevel = 'MONITORING_RUTIN'
  if (threatIndex >= 70 && (E >= 80 || freshness.status === 'BREAKING' || item.verdict === 'HOAKS')) {
    alertLevel = 'SIAGA_KRITIS'
  } else if (threatIndex >= 50) {
    alertLevel = 'ATENSI_INTELIJEN'
  }

  // 4. Cross-Matching Cek Fakta dengan Pangkalan Data Resmi (MAFINDO)
  // Penerapan Claim vs Publication Semantic Firewall (Sprint 5 WP1 & WP2)
  let matchedDebunkId: string | undefined = undefined
  let triageStatus: RadarTriageStatus = item.verdict as RadarTriageStatus
  const extraReasonCodes: string[] = []

  const claimEvaluation = evaluateClaimFirewall(
    item.claim,
    (item as any).summary || item.clarification || '',
    knownDebunks
  )

  if (claimEvaluation.matchedReference) {
    matchedDebunkId = claimEvaluation.matchedReference.referenceId
  }

  // Kasus A: Publikasi adalah artikel cek fakta resmi (TurnBackHoax)
  if (item.verdict === 'HOAKS' || item.verdict === 'DISINFORMASI' || item.verdict === 'PROPAGANDA') {
    triageStatus = 'HOAKS'
    extraReasonCodes.push('VERIFIED_FACT_CHECK_SOURCE')
  } else if (item.verdict === 'FAKTA') {
    triageStatus = 'FAKTA'
    extraReasonCodes.push('OFFICIAL_FACT_VERIFIED')
  } else if (claimEvaluation.stance === 'DEBUNKING_HOAX') {
    // FIREWALL: Artikel pers yang meluruskan / mengklarifikasi hoaks TIDAK BOLEH divonis sebagai HOAKS!
    triageStatus = 'NETRAL'
    extraReasonCodes.push('PUBLICATION_DEBUNKS_CLAIM', 'FIREWALL_PROTECTED_NOT_HOAX')
  } else if (claimEvaluation.matchStatus === 'FACT_CHECK_REFERENCE_FOUND' && claimEvaluation.matchedReference) {
    // Jika ada referensi cek fakta yang cocok kuat dengan klaim publikasi
    if (claimEvaluation.matchedReference.verdict === 'HOAKS' || claimEvaluation.matchedReference.verdict === 'DISINFORMASI') {
      if (claimEvaluation.stance === 'REPORTING_CIVIL') {
        // FIREWALL: Berita jurnalistik yang melaporkan kasus/penyelidikan hoaks BUKAN hoaks!
        triageStatus = 'NETRAL'
        extraReasonCodes.push('CIVIL_REPORTING_PRESERVED', 'MATCHED_KNOWN_HOAX_CONTEXT')
      } else {
        triageStatus = 'HOAKS'
        extraReasonCodes.push('MATCHED_KNOWN_HOAX')
      }
    } else if (claimEvaluation.matchedReference.verdict === 'FAKTA') {
      triageStatus = 'FAKTA'
      extraReasonCodes.push('MATCHED_KNOWN_FACT')
    } else {
      triageStatus = 'UNVERIFIED'
      extraReasonCodes.push('CLAIM_MATCH_REVIEW_REQUIRED')
    }
  } else if (claimEvaluation.matchStatus === 'CLAIM_MATCH_REVIEW_REQUIRED') {
    triageStatus = 'UNVERIFIED'
    extraReasonCodes.push('CLAIM_MATCH_REVIEW_REQUIRED')
  } else if (claimEvaluation.matchStatus === 'INSUFFICIENT_CONTEXT') {
    // Teks tidak memuat proposisi yang cukup untuk ditelaah
    triageStatus = 'NETRAL'
    extraReasonCodes.push('INSUFFICIENT_CONTEXT', 'NO_CHECKABLE_CLAIM')
  } else if (contextRelevance.reasonCodes.includes('PUBLIC_DEMONSTRATION_MONITORING') || extraReasonCodes.includes('PUBLIC_DEMONSTRATION_MONITORING')) {
    // Unjuk rasa dan penyampaian aspirasi publik adalah hak sipil demokratis, bukan ancaman ataupun klaim hoaks
    triageStatus = 'NETRAL'
    extraReasonCodes.push('CIVIL_DEMOCRACY_NON_THREAT')
  } else if (
    fullText.toLowerCase().includes('kritik') ||
    fullText.toLowerCase().includes('mengkritisi') ||
    fullText.toLowerCase().includes('mengeluh') ||
    fullText.toLowerCase().includes('keluhan') ||
    fullText.toLowerCase().includes('keluh') ||
    fullText.toLowerCase().includes('pengamat') ||
    fullText.toLowerCase().includes('opini')
  ) {
    // Aspirasi, keluhan ekonomi warga, atau kritik opini pengamat bukan merupakan ancaman disinformasi/hoaks
    triageStatus = 'NETRAL'
    extraReasonCodes.push('CIVIL_OPINION_OR_CRITICISM_NON_THREAT')
  } else {
    // SPRINT 5 (WP1): Klaim faktual yang belum memiliki bukti pembanding yang cukup TETAP UNVERIFIED!
    // Tidak boleh ditimpa ke NETRAL secara default (Zero False Certainty).
    triageStatus = 'UNVERIFIED'
    extraReasonCodes.push('UNVERIFIED_CLAIM_MONITORING')
  }

  // Rekomendasi Alur Tindakan
  let strategicAdvice = 'Pantauan rutin: Narasi umum terkendali dalam batas wajar.'
  if (triageStatus === 'HOAKS') {
    strategicAdvice = 'ATENSI DISPENAD: Disinformasi terverifikasi. Siapkan materi klarifikasi resmi agar persepsi publik tidak terdistorsi.'
  } else if (triageStatus === 'UNVERIFIED') {
    strategicAdvice = 'SEDANG DIPANTAU: Klaim faktual belum terverifikasi rujukan resmi. Lakukan verifikasi silang dan pantau dinamika opini.'
  } else if (alertLevel === 'SIAGA_KRITIS') {
    strategicAdvice = 'PRIORITAS TELAAH TINGGI: Isu breaking terkini dengan relevansi konteks tinggi. Lakukan pemantauan perkembangan narasi.'
  } else if (alertLevel === 'ATENSI_INTELIJEN') {
    strategicAdvice = 'ATENSI INFORMASI: Lakukan verifikasi silang terhadap otoritas terkait dan pantau konvergensi media.'
  }

  return {
    threatIndex,
    entitySensitivity: E,
    agitationScore: S,
    trendVelocityScore: T,
    alertLevel,
    triageStatus,
    matchedDebunkId,
    strategicAdvice,
    claimMatchCandidate: claimEvaluation,
    requiresAnalystReview: claimEvaluation.requiresAnalystReview,
    reasonCodes: [
      ...contextRelevance.reasonCodes,
      freshness.reasonCode,
      ...transparency.reasonCodes,
      ...extraReasonCodes
    ]
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

    const queueState: 'MONITOR' | 'RESOLVED' | 'EXCLUDED' = 
      scoreResult.triageStatus === 'UNVERIFIED' 
        ? 'MONITOR' 
        : scoreResult.reasonCodes?.includes('INSUFFICIENT_CONTEXT')
        ? 'EXCLUDED'
        : 'RESOLVED'

    return {
      ...item,
      verdict: scoreResult.triageStatus,
      triageStatus: scoreResult.triageStatus,
      threatLevel,
      queueState,
      cognitiveScore: scoreResult.threatIndex,
      tacticalResponseMilitary: scoreResult.strategicAdvice,
      claimAssessment: scoreResult.claimMatchCandidate,
      requiresAnalystReview: scoreResult.requiresAnalystReview,
      factCheckReference: scoreResult.claimMatchCandidate?.matchedReference ? {
        referenceId: scoreResult.claimMatchCandidate.matchedReference.referenceId,
        referenceTitle: scoreResult.claimMatchCandidate.matchedReference.claimReviewed || scoreResult.claimMatchCandidate.matchedReference.referenceId,
        referenceUrl: scoreResult.claimMatchCandidate.matchedReference.referenceUrl,
        verdict: scoreResult.claimMatchCandidate.matchedReference.verdict,
        explanation: scoreResult.claimMatchCandidate.matchExplanation
      } : undefined
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

  // Urutkan headline berdasarkan urgensi telaah
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
