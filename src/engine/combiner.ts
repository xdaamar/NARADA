// ─── HYBRID COGNITIVE AI COMBINER ───
// Berdasarkan PRD_02_ai_engine.md

import type { AnalysisResult, ContentCategory, InputSourceType, ThreatLevel } from '../types'
import { predictNaiveBayes } from './ml/naive-bayes'
import { analyzeWithRules } from './classifier'
import { getUserSettings } from '../utils/storage'

const CATEGORIES: ContentCategory[] = ['HOAKS', 'PROPAGANDA', 'BUZZER', 'DISINFORMASI', 'NETRAL']

/**
 * Menghasilkan rekomendasi tindakan taktis militer berdasarkan kategori dan tingkat ancaman
 */
function generateTacticalRecommendation(category: ContentCategory, threatLevel: ThreatLevel): string {
  if (category === 'NETRAL' || threatLevel === 'low') {
    return 'Status Aman: Lanjutkan pemantauan rutin. Konten tidak memerlukan tindakan kontranarasi atau eskalasi komando.'
  }

  switch (category) {
    case 'HOAKS':
      if (threatLevel === 'critical') {
        return 'Tindakan Mendesak: Segera rilis klarifikasi resmi melalui Penerangan TNI (Dispenad). Kirimkan permintaan takedown ke BSSN/Kominfo dan lakukan pelacakan simpul awal penyebar.'
      }
      return 'Prioritas Tinggi: Siapkan lembar fakta (fact sheet) klarifikasi resmi. Pantau laju penyebaran narasi di platform media sosial.'

    case 'PROPAGANDA':
      if (threatLevel === 'critical') {
        return 'Eskalasi Komando: Terdeteksi propaganda separatis/makar berintensitas tinggi. Teruskan laporan segera ke Asintel/Pussiberad dan siapkan narasi penyeimbang wawasan kebangsaan di wilayah teritorial terdampak.'
      }
      return 'Prioritas Sedang: Lakukan amplifikasi narasi positif persatuan NKRI dan pantau akun-akun utama penyebar propaganda.'

    case 'BUZZER':
      return 'Pengawasan Jaringan: Terdeteksi pola koordinasi artifisial buzzer. Lakukan pemetaan jejaring akun pada Nexus Graph untuk mengidentifikasi botnet dan aktor pengendali.'

    case 'DISINFORMASI':
      return 'Verifikasi Konteks: Konten memuat pemotongan fakta yang menyesatkan. Dispenad disarankan mempublikasikan dokumentasi utuh/video pembanding untuk meluruskan persepsi publik.'

    default:
      return 'Lakukan observasi berkala pada akun penyebar.'
  }
}

/**
 * Menghitung tingkat ancaman (Threat Level) akhir dari kombinasi ML dan Aturan Militer
 */
function calculateFinalThreatLevel(
  winnerCategory: ContentCategory,
  confidence: number,
  ruleRiskLevel: ThreatLevel
): ThreatLevel {
  if (winnerCategory === 'NETRAL') {
    return ruleRiskLevel === 'critical' ? 'medium' : 'low'
  }

  if (ruleRiskLevel === 'critical' || confidence >= 80) {
    return 'critical'
  }
  if (ruleRiskLevel === 'high' || confidence >= 60) {
    return 'high'
  }
  if (ruleRiskLevel === 'medium' || confidence >= 35) {
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
 * Fungsi Inti Analisis Hybrid: 60% Machine Learning (TF-IDF + Naive Bayes) + 40% Explainable Rules
 * @param text - Teks yang akan dianalisis
 * @param options - Metadata sumber input (URL, OCR, Text, File)
 */
export function analyzeHybrid(text: string, options: HybridOptions = {}): AnalysisResult {
  const trimmed = (text || '').trim()
  const settings = getUserSettings()

  const mlWeight = typeof settings.mlWeight === 'number' ? settings.mlWeight : 0.6
  const ruleWeight = typeof settings.ruleWeight === 'number' ? settings.ruleWeight : 0.4

  // 1. Eksekusi Layer 1: Machine Learning Classifier
  const mlResult = predictNaiveBayes(trimmed)

  // 2. Eksekusi Layer 2: Explainable Military Rule Engine
  const ruleResult = analyzeWithRules(trimmed)

  // 3. Penggabungan Bobot (Weighted Fusion)
  const fusedScores: Record<ContentCategory, number> = {
    HOAKS: 0,
    PROPAGANDA: 0,
    BUZZER: 0,
    DISINFORMASI: 0,
    NETRAL: 0,
  }

  for (const cat of CATEGORIES) {
    const mlScore = (mlResult.probabilities[cat] || 0) * 100
    const ruleScore = ruleResult.categoryScores[cat] || 0
    fusedScores[cat] = Math.round(mlScore * mlWeight + ruleScore * ruleWeight)
  }

  // 4. Penentuan Kategori Pemenang (Argmax)
  let winnerCategory: ContentCategory = 'NETRAL'
  let highestScore = -1

  for (const cat of CATEGORIES) {
    if (fusedScores[cat] > highestScore) {
      highestScore = fusedScores[cat]
      winnerCategory = cat
    }
  }

  // Khusus jika rule mendeteksi risiko kritis terhadap kedaulatan/militer tapi ML ragu-ragu
  if (ruleResult.riskLevel === 'critical' && winnerCategory === 'NETRAL') {
    winnerCategory = ruleResult.categoryScores.PROPAGANDA > ruleResult.categoryScores.HOAKS
      ? 'PROPAGANDA'
      : 'HOAKS'
  }

  const confidence = Math.min(100, Math.max(15, fusedScores[winnerCategory]))
  const mlScore = Math.round((mlResult.probabilities[winnerCategory] || 0) * 100)
  const ruleScore = ruleResult.categoryScores[winnerCategory] || 0
  const threatLevel = calculateFinalThreatLevel(winnerCategory, confidence, ruleResult.riskLevel)
  const recommendation = generateTacticalRecommendation(winnerCategory, threatLevel)

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
    explanation: ruleResult.explanation,
    keywords: ruleResult.matchedKeywords,
    targetedEntities: ruleResult.targetedEntities,
    recommendation,
  }
}

/**
 * Alias compatibility untuk modul-modul lama
 */
export function classifyText(text: string): AnalysisResult {
  return analyzeHybrid(text, { inputSource: 'text' })
}
