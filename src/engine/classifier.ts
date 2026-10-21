// ─── EXPLAINABLE RULE-BASED ENGINE ───
// Berdasarkan PRD_02_ai_engine.md & taksonomi militer

import type { ContentCategory, RuleMatchDetail, ThreatLevel } from '../types'
import { MILITARY_TAXONOMY, extractMilitaryEntities } from './taxonomy'

/**
 * Menganalisis teks menggunakan pencocokan pola taksonomi ancaman militer
 * Menghasilkan skor berbasis aturan dan penjelasan transparan (XAI)
 */
export function analyzeWithRules(text: string): RuleMatchDetail {
  if (!text || typeof text !== 'string') {
    return {
      matchedKeywords: [],
      categoryScores: { HOAKS: 0, PROPAGANDA: 0, BUZZER: 0, DISINFORMASI: 0, NETRAL: 100 },
      riskLevel: 'low',
      explanation: 'Tidak ada teks yang dapat dianalisis.',
      targetedEntities: [],
    }
  }

  const normalized = text.toLowerCase()
  const matchedKeywords: string[] = []
  const categoryRawScores: Record<ContentCategory, number> = {
    HOAKS: 0,
    PROPAGANDA: 0,
    BUZZER: 0,
    DISINFORMASI: 0,
    NETRAL: 10,
  }

  let totalRiskWeight = 0
  const explanationPoints: string[] = []

  // Pencocokan dengan kamus taksonomi ancaman
  for (const item of MILITARY_TAXONOMY) {
    // Regex boundary matching untuk menghindari substring false positives
    const escaped = item.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escaped}\\b`, 'i')

    if (regex.test(normalized)) {
      matchedKeywords.push(item.keyword)
      const scoreAdd = item.weight * 12
      categoryRawScores[item.category] += scoreAdd
      totalRiskWeight += item.weight

      if (!explanationPoints.includes(item.explanationTemplate)) {
        explanationPoints.push(item.explanationTemplate)
      }
    }
  }

  // Ekstraksi entitas strategis/militer yang disebut dalam teks
  const targetedEntities = extractMilitaryEntities(text)

  // Jika ada entitas militer yang ditargetkan bersamaan dengan narasi provokatif, naikkan multiplier risiko
  const hasMilitaryEntity = targetedEntities.length > 0
  if (hasMilitaryEntity && matchedKeywords.length > 0) {
    totalRiskWeight = Math.round(totalRiskWeight * 1.35)
  }

  // Tentukan Risk Level
  let riskLevel: ThreatLevel = 'low'
  if (totalRiskWeight >= 24) {
    riskLevel = 'critical'
  } else if (totalRiskWeight >= 14) {
    riskLevel = 'high'
  } else if (totalRiskWeight >= 6) {
    riskLevel = 'medium'
  }

  // Normalisasi categoryScores ke skala 0 - 100
  const maxScore = Math.max(
    categoryRawScores.HOAKS,
    categoryRawScores.PROPAGANDA,
    categoryRawScores.BUZZER,
    categoryRawScores.DISINFORMASI,
    categoryRawScores.NETRAL,
    1
  )

  const normalizedScores: Record<ContentCategory, number> = {
    HOAKS: Math.min(100, Math.round((categoryRawScores.HOAKS / maxScore) * 100)),
    PROPAGANDA: Math.min(100, Math.round((categoryRawScores.PROPAGANDA / maxScore) * 100)),
    BUZZER: Math.min(100, Math.round((categoryRawScores.BUZZER / maxScore) * 100)),
    DISINFORMASI: Math.min(100, Math.round((categoryRawScores.DISINFORMASI / maxScore) * 100)),
    NETRAL: matchedKeywords.length === 0 ? 100 : Math.max(5, 100 - Math.min(95, totalRiskWeight * 4)),
  }

  // Penyusunan narasi penjelasan (Explainability - XAI)
  let explanation = ''
  if (matchedKeywords.length === 0) {
    explanation = 'Konten tidak memuat indikator leksikal ancaman siber sosial maupun pola agitasi yang mencurigakan. Informasi cenderung berkarakter faktual atau netral.'
  } else {
    const entityNotice = hasMilitaryEntity
      ? ` Terdeteksi penyebutan entitas pertahanan: [${targetedEntities.join(', ')}].`
      : ''
    const pointsText = explanationPoints.slice(0, 3).join(' ')
    explanation = `Ditemukan ${matchedKeywords.length} indikator ancaman (${matchedKeywords.slice(0, 5).join(', ')}). ${pointsText}${entityNotice}`
  }

  return {
    matchedKeywords: [...new Set(matchedKeywords)],
    categoryScores: normalizedScores,
    riskLevel,
    explanation,
    targetedEntities,
  }
}

// Re-export untuk backward compatibility dengan modul yang memanggil classifier lama
import { classifyText } from './combiner'
export { classifyText }
export function classifyBatch(texts: string[]) {
  return texts.map(t => classifyText(t))
}
