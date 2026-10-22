// ─── EXPLAINABLE RULE-BASED ENGINE (SPEKTRUM GANDA) ───
// Berdasarkan Master Sprint 4A: Dual-Spectrum Cognitive Reasoning Engine

import type { ContentCategory, RuleMatchDetail, ThreatLevel } from '../types'
import { FULL_SPECTRUM_TAXONOMY, extractMilitaryEntities } from './taxonomy'
import { evaluateInstitutionalLogic } from './knowledge-graph'

/**
 * Menganalisis teks menggunakan pencocokan pola taksonomi 5 klaster & anomali logika
 * Menghasilkan skor berbasis aturan dan penjelasan transparan (XAI)
 */
export function analyzeWithRules(text: string): RuleMatchDetail {
  if (!text || typeof text !== 'string') {
    return {
      matchedKeywords: [],
      categoryScores: { HOAKS: 0, PROPAGANDA: 0, BUZZER: 0, DISINFORMASI: 0, NETRAL: 80 },
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
    NETRAL: 0,
  }

  let totalRiskWeight = 0
  const explanationPoints: string[] = []

  // 1. Pencocokan dengan Kamus Taksonomi Spektrum Ganda (5 Klaster)
  for (const item of FULL_SPECTRUM_TAXONOMY) {
    const escaped = item.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Gunakan boundary regex atau substring match untuk frasa multi-kata
    const isMultiWord = item.keyword.includes(' ')
    const matched = isMultiWord ? normalized.includes(item.keyword.toLowerCase()) : new RegExp(`\\b${escaped}\\b`, 'i').test(normalized)

    if (matched) {
      matchedKeywords.push(item.keyword)
      const scoreAdd = item.weight * 14
      categoryRawScores[item.category] += scoreAdd
      totalRiskWeight += item.weight

      if (!explanationPoints.includes(item.explanationTemplate)) {
        explanationPoints.push(item.explanationTemplate)
      }
    }
  }

  // 2. Evaluasi Anomali Logika Ketatanegaraan & Sains (Knowledge Graph)
  const logicAnomaly = evaluateInstitutionalLogic(text)
  if (logicAnomaly.detected) {
    categoryRawScores.HOAKS += 120
    totalRiskWeight += 25
    if (logicAnomaly.explanation) {
      explanationPoints.unshift(logicAnomaly.explanation)
    }
  }

  // 3. Ekstraksi Entitas Strategis Nasional / Militer yang Disebut
  const targetedEntities = extractMilitaryEntities(text)
  const hasStrategicEntity = targetedEntities.length > 0

  if (hasStrategicEntity && (matchedKeywords.length > 0 || logicAnomaly.detected)) {
    totalRiskWeight = Math.round(totalRiskWeight * 1.35)
  }

  // 4. Penentuan Risk Level
  let riskLevel: ThreatLevel = 'low'
  if (totalRiskWeight >= 24 || logicAnomaly.detected) {
    riskLevel = 'critical'
  } else if (totalRiskWeight >= 14) {
    riskLevel = 'high'
  } else if (totalRiskWeight >= 6) {
    riskLevel = 'medium'
  }

  // 5. Normalisasi categoryScores
  const hasThreat = matchedKeywords.length > 0 || logicAnomaly.detected

  const maxThreatScore = Math.max(
    categoryRawScores.HOAKS,
    categoryRawScores.PROPAGANDA,
    categoryRawScores.BUZZER,
    categoryRawScores.DISINFORMASI,
    1
  )

  const normalizedScores: Record<ContentCategory, number> = {
    HOAKS: hasThreat ? Math.min(100, Math.round((categoryRawScores.HOAKS / maxThreatScore) * 100)) : 5,
    PROPAGANDA: hasThreat ? Math.min(100, Math.round((categoryRawScores.PROPAGANDA / maxThreatScore) * 100)) : 5,
    BUZZER: hasThreat ? Math.min(100, Math.round((categoryRawScores.BUZZER / maxThreatScore) * 100)) : 5,
    DISINFORMASI: hasThreat ? Math.min(100, Math.round((categoryRawScores.DISINFORMASI / maxThreatScore) * 100)) : 5,
    NETRAL: hasThreat ? Math.max(0, 100 - Math.min(100, totalRiskWeight * 4)) : 85,
  }

  // 6. Penyusunan Narasi Penjelasan (Explainability - XAI)
  let explanation = ''
  if (!hasThreat) {
    explanation = 'Konten tidak memuat indikator leksikal ancaman siber sosial, hoaks bencana, penipuan bansos, maupun pola agitasi yang mencurigakan. Informasi cenderung berkarakter faktual atau netral.'
  } else {
    const entityNotice = hasStrategicEntity
      ? ` Terdeteksi penyebutan entitas strategis: [${targetedEntities.join(', ')}].`
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
