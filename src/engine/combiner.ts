// ─── HYBRID COGNITIVE AI COMBINER (TRUTH PRIORITY ARCHITECTURE) ───
// Berdasarkan Master Sprint 4A: Dual-Spectrum Cognitive Reasoning Engine

import type {
  AnalysisResult,
  ContentCategory,
  InputSourceType,
  ThreatLevel,
  ThreatSpectrumCluster,
  DebunkKnowledgeEntry,
  InstitutionalLogicAnomaly,
} from '../types'
import { predictNaiveBayes } from './ml/naive-bayes'
import { analyzeWithRules } from './classifier'
import { getUserSettings } from '../utils/storage'
import { calculatePsychologyVectors } from './psychology'
import { searchLocalDebunk } from './data/debunk-service'
import { evaluateInstitutionalLogic } from './knowledge-graph'

const CATEGORIES: ContentCategory[] = ['HOAKS', 'PROPAGANDA', 'BUZZER', 'DISINFORMASI', 'NETRAL']

/**
 * Menghasilkan rekomendasi tindakan taktis adaptif berdasarkan kategori dan klaster spektrum
 */
function generateTacticalRecommendation(
  category: ContentCategory,
  threatLevel: ThreatLevel,
  cluster: ThreatSpectrumCluster
): string {
  if (category === 'NETRAL' || threatLevel === 'low') {
    return 'Status Aman: Informasi berkarakter faktual atau kegiatan kemasyarakatan positif. Tidak diperlukan tindakan kontranarasi atau eskalasi komando.'
  }

  // Rekomendasi spesifik klaster spektrum
  switch (cluster) {
    case 'BENCANA_DARURAT':
      return 'Mitigasi Kepanikan Warga (OMSP): Segera rilis pengumuman klarifikasi data riil bersama BPBD/BMKG. Kerahkan Babinsa ke pos kamling/titik kumpul warga untuk mencegah kepanikan dan eksodus liar.'

    case 'PENIPUAN_BANSOS':
      return 'Pencegahan Kejahatan Siber Finansial: Laporkan tautan phishing/file APK ke BSSN & Kominfo untuk pemblokiran segera. Edukasi warga bahwa bansos resmi hanya melalui cekbansos.kemensos.go.id.'

    case 'POLITIK_NEGARA':
      return 'Pengamanan Stabilitas Ketatanegaraan: Sosialisasikan fakta konstitusi Pasal 7A/7B UUD 1945 kepada masyarakat binaan. Waspadai narasi suksesi fiktif yang sengaja dihembuskan untuk memecah belah bangsa.'

    case 'KESEHATAN_PANGAN':
      return 'Perlindungan Konsumen & Pangan Rakyat: Publikasikan klarifikasi uji laboratorium resmi BPOM/Kemenkes untuk menepis rumor bahan sintetis dan melindungi ketahanan pangan lokal.'

    case 'KEDAULATAN_MILITER':
    default:
      if (category === 'HOAKS') {
        return 'Tindakan Mendesak Dispenad: Segera siarkan rilis pers resmi klarifikasi alutsista/satuan. Kirimkan permintaan takedown ke Kominfo dan pantau aktor penyebar di Nexus Graph.'
      }
      if (category === 'PROPAGANDA') {
        return 'Eskalasi Komando Intelter: Terdeteksi propaganda separatis/makar. Teruskan laporan kilat ke Asintel/Pussiberad dan siapkan narasi penyeimbang wawasan kebangsaan di wilayah teritorial terdampak.'
      }
      if (category === 'BUZZER') {
        return 'Pengawasan Jaringan Siber: Terdeteksi amplifikasi buzzer terkoordinasi. Lakukan pemetaan jejaring akun pada Nexus Graph untuk mengidentifikasi botnet dan aktor pengendali.'
      }
      return 'Verifikasi Konteks: Konten memuat pemotongan fakta yang menyesatkan. Publikasikan dokumentasi utuh/video pembanding untuk meluruskan persepsi publik.'
  }
}

/**
 * Menghitung tingkat ancaman (Threat Level) akhir
 */
function calculateFinalThreatLevel(
  winnerCategory: ContentCategory,
  confidence: number,
  ruleRiskLevel: ThreatLevel
): ThreatLevel {
  if (winnerCategory === 'NETRAL') {
    return ruleRiskLevel === 'critical' ? 'medium' : 'low'
  }

  if (ruleRiskLevel === 'critical' || confidence >= 85) {
    return 'critical'
  }
  if (ruleRiskLevel === 'high' || confidence >= 65) {
    return 'high'
  }
  if (ruleRiskLevel === 'medium' || confidence >= 40) {
    return 'medium'
  }
  return 'low'
}

export interface HybridOptions {
  inputSource?: InputSourceType
  title?: string
  sourceMeta?: {
    author?: string | null
    siteName?: string
    url?: string
    imagePreview?: string
  }
}

/**
 * Tri-Hybrid Cognitive Reasoning Architecture (T-CRA)
 * Hierarki Kebenaran:
 * TIER 1: Basis Data Cek Fakta Nyata (Local Debunk / Mafindo) -> Mem-bypass probabilitas kata
 * TIER 2: Anomali Logika Ketatanegaraan & Sains (Knowledge Graph)
 * TIER 3: Fusi Hybrid ML 60% + Aturan 40% (untuk teks umum)
 */
export function analyzeHybrid(text: string, options: HybridOptions = {}): AnalysisResult {
  const trimmed = (text || '').trim()
  const settings = getUserSettings()

  const mlWeight = typeof settings.mlWeight === 'number' ? settings.mlWeight : 0.6
  const ruleWeight = typeof settings.ruleWeight === 'number' ? settings.ruleWeight : 0.4

  // 1. Eksekusi Layer 1 & Layer 2 Dasar
  const mlResult = predictNaiveBayes(trimmed)
  const ruleResult = analyzeWithRules(trimmed)
  const psychology = calculatePsychologyVectors(trimmed)

  // 2. Evaluasi Mesin Penalar Cek Fakta & Anomali Logika
  const localDebunk = searchLocalDebunk(trimmed)
  const logicAnomaly = evaluateInstitutionalLogic(trimmed)

  let winnerCategory: ContentCategory = 'NETRAL'
  let confidence = 0
  let threatLevel: ThreatLevel = 'low'
  let explanation = ''
  let mlScore = 0
  let ruleScore = 0
  let spectrumCluster: ThreatSpectrumCluster = 'UMUM_NETRAL'
  let matchedDebunkEntry: DebunkKnowledgeEntry | undefined = undefined
  let detectedLogicAnomaly: InstitutionalLogicAnomaly | undefined = undefined

  const fusedScores: Record<ContentCategory, number> = {
    HOAKS: 0,
    PROPAGANDA: 0,
    BUZZER: 0,
    DISINFORMASI: 0,
    NETRAL: 0,
  }

  // ─── TIER 1: TRUTH PRIORITY HIERARCHY (CEK FAKTA NYATA TERVERIFIKASI) ───
  if (localDebunk.matched && localDebunk.entry) {
    const entry = localDebunk.entry
    winnerCategory = entry.verdict
    confidence = Math.max(92, localDebunk.confidence)
    threatLevel = entry.threatLevel
    explanation = `[TERVERIFIKASI MAFINDO/CEK FAKTA] ${entry.clarification} (Rujukan: ${entry.officialSource})`
    spectrumCluster = entry.cluster
    matchedDebunkEntry = entry
    mlScore = Math.max(90, Math.round((mlResult.probabilities[winnerCategory] || 0) * 100))
    ruleScore = 95

    // Set skor terdistribusi dengan pemenang mutlak
    for (const cat of CATEGORIES) {
      if (cat === winnerCategory) fusedScores[cat] = confidence
      else if (cat === 'NETRAL') fusedScores[cat] = 2
      else fusedScores[cat] = 8
    }
  }
  // ─── TIER 2: ANOMALI LOGIKA KETATANEGARAAN & SAINS (ZERO-DAY HOAX) ───
  else if (logicAnomaly.detected) {
    winnerCategory = 'HOAKS'
    confidence = Math.max(92, logicAnomaly.confidenceImpact)
    threatLevel = 'critical'
    explanation = `[ANOMALI LOGIKA STRUKTURAL] ${logicAnomaly.explanation}`
    detectedLogicAnomaly = logicAnomaly
    mlScore = 90
    ruleScore = 95

    if (logicAnomaly.anomalyType === 'CONSTITUTIONAL_VIOLATION') spectrumCluster = 'POLITIK_NEGARA'
    else if (logicAnomaly.anomalyType === 'DISASTER_PREDICTION_FRAUD') spectrumCluster = 'BENCANA_DARURAT'
    else if (logicAnomaly.anomalyType === 'FINANCIAL_SCAM_PHISHING') spectrumCluster = 'PENIPUAN_BANSOS'
    else if (logicAnomaly.anomalyType === 'HEALTH_HOAX') spectrumCluster = 'KESEHATAN_PANGAN'
    else spectrumCluster = 'UMUM_NETRAL'

    for (const cat of CATEGORIES) {
      if (cat === 'HOAKS') fusedScores[cat] = confidence
      else if (cat === 'NETRAL') fusedScores[cat] = 4
      else fusedScores[cat] = 10
    }
  }
  // ─── TIER 3: FUSI HYBRID TERBOBOT (TEKS UMUM & BERITA FAKTUAL) ───
  else {
    for (const cat of CATEGORIES) {
      const mlProb = (mlResult.probabilities[cat] || 0) * 100
      const rScore = ruleResult.categoryScores[cat] || 0
      fusedScores[cat] = Math.round(mlProb * mlWeight + rScore * ruleWeight)
    }

    let highestScore = -1
    for (const cat of CATEGORIES) {
      if (fusedScores[cat] > highestScore) {
        highestScore = fusedScores[cat]
        winnerCategory = cat
      }
    }

    // Jika rule mendeteksi risiko kritis terhadap pertahanan tetapi ML ragu
    if (ruleResult.riskLevel === 'critical' && winnerCategory === 'NETRAL') {
      winnerCategory = ruleResult.categoryScores.PROPAGANDA > ruleResult.categoryScores.HOAKS
        ? 'PROPAGANDA'
        : 'HOAKS'
      fusedScores[winnerCategory] = Math.max(88, ruleResult.categoryScores[winnerCategory])
    }

    // Tentukan klaster spektrum untuk Tier 3
    if (ruleResult.targetedEntities.length > 0 || ruleResult.categoryScores.PROPAGANDA > 40) {
      spectrumCluster = 'KEDAULATAN_MILITER'
    } else {
      spectrumCluster = 'UMUM_NETRAL'
    }

    // Jika tidak ada ancaman leksikal yang terdeteksi, nyatakan Netral Faktual dengan keyakinan tinggi
    if (ruleResult.matchedKeywords.length === 0 && !logicAnomaly.detected) {
      winnerCategory = 'NETRAL'
      confidence = Math.max(85, Math.min(95, fusedScores.NETRAL || 90))
      threatLevel = 'low'
      fusedScores.NETRAL = confidence
    } else {
      confidence = Math.min(100, Math.max(25, fusedScores[winnerCategory]))
      threatLevel = calculateFinalThreatLevel(winnerCategory, confidence, ruleResult.riskLevel)
    }

    mlScore = Math.round((mlResult.probabilities[winnerCategory] || 0) * 100)
    ruleScore = ruleResult.categoryScores[winnerCategory] || 0
    explanation = ruleResult.explanation
  }

  const recommendation = generateTacticalRecommendation(winnerCategory, threatLevel, spectrumCluster)

  const scores = CATEGORIES.map(cat => ({
    label: cat,
    score: fusedScores[cat],
  }))

  return {
    id: `NRD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: Date.now(),
    inputSource: options.inputSource || 'text',
    rawContent: trimmed,
    input: trimmed,
    title: options.title,
    sourceMeta: options.sourceMeta,
    category: winnerCategory,
    threatLevel,
    confidence,
    mlScore,
    ruleScore,
    scores,
    explanation,
    keywords: ruleResult.matchedKeywords,
    targetedEntities: ruleResult.targetedEntities,
    recommendation,
    psychology,
    spectrumCluster,
    debunkMatch: matchedDebunkEntry,
    logicAnomaly: detectedLogicAnomaly,
  }
}

/**
 * Alias compatibility untuk modul-modul lama
 */
export function classifyText(text: string): AnalysisResult {
  return analyzeHybrid(text, { inputSource: 'text' })
}
