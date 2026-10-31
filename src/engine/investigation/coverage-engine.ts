/**
 * ════════════════════════════════════════════════════════════════════════════════════
 * NARADA — INVESTIGATION COVERAGE & CASE READINESS ENGINE
 * SPRINT 3: PACKAGE 1 (DETERMINISTIC EVIDENCE COVERAGE & WORKFLOW READINESS)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ════════════════════════════════════════════════════════════════════════════════════
 * 
 * Prinsip:
 * - Deterministic evidence-coverage view, BUKAN skor ancaman baru atau konfidensi kebenaran palsu.
 * - Setiap metrik persentase wajib menyertakan numerator dan denominator transparan.
 * - Status kesiapan kasus berupa workflow states (INCOMPLETE_RECORD, EVIDENCE_REVIEW_REQUIRED,
 *   CONFLICTS_UNRESOLVED, READY_FOR_ANALYST_CONCLUSION, CONCLUDED_BY_ANALYST).
 * - Saran tindakan terarah berbasis aturan eksplisit (Deterministic Next Action).
 * ════════════════════════════════════════════════════════════════════════════════════
 */

import {
  getInvestigationCase,
  getEvidenceRecordsForCase,
  getClaimsForCase,
  getRelationsForCase,
  getAssessmentsForCase,
  reverifyAllEvidenceForCase
} from './case-store.ts'

import type {
  InvestigationCoverageSummary,
  CaseReadinessStatus,
  CoverageIndicator,
  SuggestedNextAction,
  EvidenceMode
} from './investigation-types.ts'

/**
 * Menghitung ringkasan cakupan bukti dan kesiapan kasus secara deterministik
 */
export function computeCaseCoverage(caseId: string): InvestigationCoverageSummary {
  const c = getInvestigationCase(caseId)
  const evidence = getEvidenceRecordsForCase(caseId)
  const claims = getClaimsForCase(caseId)
  const relations = getRelationsForCase(caseId)
  const assessments = getAssessmentsForCase(caseId)
  const verifySummary = reverifyAllEvidenceForCase(caseId)

  const claimsTotal = claims.length
  let claimsReviewed = 0
  let claimsWithSupporting = 0
  let claimsWithContradicting = 0
  let claimsWithMixed = 0
  let claimsUnverified = 0

  claims.forEach(cl => {
    const claimRelations = relations.filter(r => r.claimId === cl.id)
    const hasSupport = claimRelations.some(r => r.relationType === 'SUPPORTS')
    const hasContradict = claimRelations.some(r => r.relationType === 'CONTRADICTS')

    if (hasSupport) claimsWithSupporting++
    if (hasContradict) claimsWithContradicting++
    if (hasSupport && hasContradict) claimsWithMixed++

    const assess = assessments.find(a => a.claimId === cl.id)
    const isAssessed = assess && assess.verdict && assess.verdict !== 'UNVERIFIED'
    if (isAssessed) {
      claimsReviewed++
    } else {
      claimsUnverified++
    }
  })

  const evidenceTotal = evidence.length
  const evidenceByMode: Record<EvidenceMode, number> = {
    LIVE_REFERENCE: 0,
    USER_SUBMITTED: 0,
    SYNTHETIC_BENCHMARK: 0
  }

  let evidenceWithSourceUrl = 0
  let evidenceWithPublishedTime = 0
  let evidenceWithAcquisitionTime = 0

  evidence.forEach(ev => {
    evidenceByMode[ev.evidenceMode] = (evidenceByMode[ev.evidenceMode] || 0) + 1
    if (ev.sourceUrl && ev.sourceUrl.trim().length > 0) evidenceWithSourceUrl++
    if (ev.sourcePublishedAt && ev.sourceTimestampProvenance !== 'NO_SOURCE_TIMESTAMP') evidenceWithPublishedTime++
    if (ev.submittedAt || ev.observedAt) evidenceWithAcquisitionTime++
  })

  // Penentuan Status Kesiapan Kasus (Workflow States)
  let readinessStatus: CaseReadinessStatus = 'INCOMPLETE_RECORD'
  let readinessReason = ''

  if (claimsTotal === 0 || evidenceTotal === 0) {
    readinessStatus = 'INCOMPLETE_RECORD'
    readinessReason = 'Kasus belum memiliki klaim teridentifikasi atau berkas bukti minimal untuk diinvestigasi.'
  } else if (claimsWithMixed > 0) {
    readinessStatus = 'CONFLICTS_UNRESOLVED'
    readinessReason = `Terdapat ${claimsWithMixed} dari ${claimsTotal} klaim yang memiliki bukti bertentangan (dukungan vs sanggahan). Telaah kontradiksi diperlukan sebelum kesimpulan dibuat.`
  } else if (claimsReviewed < claimsTotal) {
    readinessStatus = 'EVIDENCE_REVIEW_REQUIRED'
    readinessReason = `Masih terdapat ${claimsTotal - claimsReviewed} dari ${claimsTotal} klaim yang belum memiliki vonis asesmen resmi dari analis.`
  } else if (c?.status === 'CONCLUDED') {
    readinessStatus = 'CONCLUDED_BY_ANALYST'
    readinessReason = 'Seluruh klaim telah selesai dinilai dan kasus telah disimpulkan secara resmi oleh analis.'
  } else {
    readinessStatus = 'READY_FOR_ANALYST_CONCLUSION'
    readinessReason = `Seluruh ${claimsTotal} klaim telah memiliki bukti pendukung dan asesmen analitis. Kasus siap untuk disimpulkan secara resmi.`
  }

  // Rekomendasi Tindakan Terarah (Deterministic Next Actions)
  const suggestedActions: SuggestedNextAction[] = []

  if (claimsTotal === 0) {
    suggestedActions.push({
      ruleId: 'ACT-NO-CLAIMS',
      description: 'Ekstraksi atau masukkan klaim faktual awal yang dipermasalahkan.',
      ruleExplanation: 'Investigasi memerlukan minimal satu klaim atomik spesifik agar penilaian bukti dapat difokuskan.',
      priority: 'HIGH',
      targetEntityType: 'CASE',
      targetEntityId: caseId
    })
  }

  if (evidenceTotal === 0) {
    suggestedActions.push({
      ruleId: 'ACT-NO-EVIDENCE',
      description: 'Masukkan berkas bukti digital melalui konsol Ingestion (Teks/Berkas/URL).',
      ruleExplanation: 'Klaim tidak dapat dievaluasi tanpa berkas bukti yang memiliki asal usul (provenance) jelas.',
      priority: 'HIGH',
      targetEntityType: 'CASE',
      targetEntityId: caseId
    })
  }

  claims.forEach(cl => {
    const clRels = relations.filter(r => r.claimId === cl.id)
    if (clRels.length === 0) {
      suggestedActions.push({
        ruleId: `ACT-LINK-CLAIM-${cl.id}`,
        description: `Tautkan berkas bukti ke klaim: "${cl.claimText.slice(0, 45)}..."`,
        ruleExplanation: 'Klaim ini belum memiliki relasi bukti pendukung atau bukti sanggahan yang tertaut.',
        priority: 'HIGH',
        targetEntityType: 'CLAIM',
        targetEntityId: cl.id
      })
    }
  })

  if (claimsWithMixed > 0) {
    suggestedActions.push({
      ruleId: 'ACT-RESOLVE-CONFLICT',
      description: 'Tinjau klaim dengan relasi bukti bercabang (SUPPORTS dan CONTRADICTS bersamaan).',
      ruleExplanation: 'Kontradiksi bukti harus diverifikasi silang dengan sumber otoritatif primer sebelum status klaim ditetapkan.',
      priority: 'HIGH',
      targetEntityType: 'CASE',
      targetEntityId: caseId
    })
  }

  if (verifySummary.warningCount > 0) {
    suggestedActions.push({
      ruleId: 'ACT-INTEGRITY-WARNING',
      description: `Inspeksi ${verifySummary.warningCount} berkas bukti yang mengalami anomali hash SHA-256.`,
      ruleExplanation: 'Teks atau byte tersimpan tidak cocok dengan digest asli pasca-akuisisi; kemungkinan telah terjadi manipulasi atau kerusakan data.',
      priority: 'HIGH',
      targetEntityType: 'CASE',
      targetEntityId: caseId
    })
  }

  if (evidenceByMode.SYNTHETIC_BENCHMARK > 0) {
    suggestedActions.push({
      ruleId: 'ACT-SIMULATION-ISOLATION',
      description: 'Pertahankan label simulasi; jangan menyimpulkan kasus benchmark sebagai insiden LIVE.',
      ruleExplanation: 'Kasus memuat berkas bukti ber-watermark benchmark sintetis untuk tujuan kalibrasi dan pengujian.',
      priority: 'MEDIUM',
      targetEntityType: 'CASE',
      targetEntityId: caseId
    })
  }

  if (readinessStatus === 'READY_FOR_ANALYST_CONCLUSION') {
    suggestedActions.push({
      ruleId: 'ACT-CONCLUDE-CASE',
      description: 'Tandai kasus sebagai CONCLUDED dan formulasikan draf rilis informasi publik atau ekspor laporan.',
      ruleExplanation: 'Semua klaim telah terverifikasi dan memenuhi standar kecukupan telaah analitis.',
      priority: 'LOW',
      targetEntityType: 'CASE',
      targetEntityId: caseId
    })
  }

  // Indikator Cakupan Terukur (Denominator Transparan)
  const claimReviewedPercent = claimsTotal > 0 ? Math.round((claimsReviewed / claimsTotal) * 100) : 0
  const evidenceTimePercent = evidenceTotal > 0 ? Math.round((evidenceWithPublishedTime / evidenceTotal) * 100) : 0
  const evidenceUrlPercent = evidenceTotal > 0 ? Math.round((evidenceWithSourceUrl / evidenceTotal) * 100) : 0
  const evidenceDigestPercent = evidenceTotal > 0 ? Math.round((verifySummary.verifiedCount / evidenceTotal) * 100) : 0

  const indicators: CoverageIndicator[] = [
    {
      label: 'Klaim Telah Dinilai',
      current: claimsReviewed,
      total: claimsTotal,
      percentage: claimReviewedPercent,
      status: claimsReviewed === claimsTotal && claimsTotal > 0 ? 'COMPLETE' : 'ATTENTION',
      details: `${claimsReviewed} dari ${claimsTotal} klaim selesai ditelaah`
    },
    {
      label: 'Cakupan Waktu Sumber Bukti',
      current: evidenceWithPublishedTime,
      total: evidenceTotal,
      percentage: evidenceTimePercent,
      status: evidenceTimePercent >= 80 ? 'COMPLETE' : (evidenceTimePercent > 0 ? 'ATTENTION' : 'PENDING'),
      details: `${evidenceWithPublishedTime} dari ${evidenceTotal} bukti memiliki stempel waktu terverifikasi`
    },
    {
      label: 'Rujukan URL Sumber',
      current: evidenceWithSourceUrl,
      total: evidenceTotal,
      percentage: evidenceUrlPercent,
      status: evidenceUrlPercent >= 80 ? 'COMPLETE' : 'ATTENTION',
      details: `${evidenceWithSourceUrl} dari ${evidenceTotal} bukti memuat URL referensi`
    },
    {
      label: 'Integritas Hash SHA-256',
      current: verifySummary.verifiedCount,
      total: evidenceTotal,
      percentage: evidenceDigestPercent,
      status: verifySummary.warningCount === 0 && evidenceTotal > 0 ? 'COMPLETE' : 'ATTENTION',
      details: verifySummary.warningCount > 0
        ? `PERINGATAN: ${verifySummary.warningCount} bukti gagal uji integritas hash`
        : `${verifySummary.verifiedCount} dari ${evidenceTotal} bukti lolos verifikasi hash`
    }
  ]

  return {
    caseId,
    readinessStatus,
    readinessReason,
    claimsTotal,
    claimsReviewed,
    claimsWithSupporting,
    claimsWithContradicting,
    claimsWithMixed,
    claimsUnverified,
    evidenceTotal,
    evidenceByMode,
    evidenceWithSourceUrl,
    evidenceWithPublishedTime,
    evidenceWithAcquisitionTime,
    evidenceVerifiedDigestCount: verifySummary.verifiedCount,
    evidenceTamperWarningCount: verifySummary.warningCount,
    suggestedActions,
    indicators,
    calculatedAt: new Date().toISOString()
  }
}

