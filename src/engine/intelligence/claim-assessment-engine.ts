/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — CLAIM ASSESSMENT & EXPLAINABILITY ENGINE (WP-05)
 * SPRINT 09: EVIDENCE-GROUNDED VERDICT & "WHY NARADA THINKS SO"
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Prinsip Desain:
 * 1. Evidence Before Verdict: Kebenaran dinilai dari rantai bukti independen,
 *    bukan dari sentimen teks atau kata kunci [HOAKS] di judul.
 * 2. Honest Incompleteness: Jika bukti tidak cukup, vonis adalah INSUFFICIENT_EVIDENCE
 *    atau UNVERIFIED, bukan disimpulkan sembarangan.
 * 3. Conflicting Evidence Guard: Jika dua bukti independen bertentangan,
 *    sistem menolak memilih pemenang semu -> vonis CONFLICTING_EVIDENCE + Human Review!
 * 4. Not Assessable Filter: Opini, prediksi, pertanyaan retoris, dan satir
 *    secara eksplisit ditandai NOT_ASSESSABLE.
 * 5. Full Explainability: Setiap vonis memuat alasan terstruktur, keterbatasan,
 *    dan rujukan ID bukti nyata.
 * ══════════════════════════════════════════════════════════════════════════
 */

import {
  type ClaimRecord,
  type ClaimEvidenceItem,
  type ClaimAssessmentRecord,
  type ClaimAssessmentVerdict,
  type ClaimExplanation,
  type EvidenceCoverageMetrics,
  type ClaimAssessmentReason,
  VERDICT_INDONESIAN_LABELS,
  CLAIM_ASSESSMENT_ENGINE_VERSION
} from './claim-types.ts'

/**
 * Menghitung cakupan bukti terhadap satu klaim
 */
export function computeEvidenceCoverage(
  claim: ClaimRecord,
  evidenceItems: ClaimEvidenceItem[],
  independentPublisherCount: number,
  independentEvidenceCount: number
): EvidenceCoverageMetrics {
  const supporting = evidenceItems.filter(e => e.evidenceRelation === 'SUPPORTS')
  const contradicting = evidenceItems.filter(e => e.evidenceRelation === 'CONTRADICTS')
  const contextual = evidenceItems.filter(e => e.evidenceRelation === 'CONTEXTUALIZES')

  const hasPrimarySource = evidenceItems.some(
    e => e.directness === 'PRIMARY_SOURCE' || e.directness === 'DIRECT_STATEMENT'
  )

  const isSufficient = !claim.isLimitedContext && (supporting.length > 0 || contradicting.length > 0) && independentEvidenceCount > 0

  return {
    totalEvidence: evidenceItems.length,
    supportingCount: supporting.length,
    contradictingCount: contradicting.length,
    contextualCount: contextual.length,
    independentPublisherCount,
    independentEvidenceCount,
    hasPrimarySource,
    temporalConsistency: true,
    geographicalConsistency: true,
    isSufficient
  }
}

/**
 * Eksekusi Asesmen Klaim Berbasis Bukti (WP-05)
 */
export function assessClaimWithEvidence(params: {
  claim: ClaimRecord
  evidenceItems: ClaimEvidenceItem[]
  independentPublisherCount: number
  independentEvidenceCount: number
}): { assessment: ClaimAssessmentRecord; explanation: ClaimExplanation } {
  const { claim, evidenceItems, independentPublisherCount, independentEvidenceCount } = params
  const nowIso = new Date().toISOString()
  const coverage = computeEvidenceCoverage(claim, evidenceItems, independentPublisherCount, independentEvidenceCount)

  const supportingIds: string[] = []
  const contradictingIds: string[] = []
  const contextualIds: string[] = []
  const reasons: ClaimAssessmentReason[] = []
  const limitations: string[] = [...claim.limitations]

  evidenceItems.forEach(e => {
    if (e.evidenceRelation === 'SUPPORTS') supportingIds.push(e.id)
    else if (e.evidenceRelation === 'CONTRADICTS') contradictingIds.push(e.id)
    else if (e.evidenceRelation === 'CONTEXTUALIZES') contextualIds.push(e.id)
  })

  let verdict: ClaimAssessmentVerdict
  let confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW'
  let requiresHumanReview = false
  let humanReviewReason: string | undefined
  let summary = ''

  // ─── TAHAP 1: FILTER KELAYAKAN ASESMEN (Assessability Gate) ───
  if (
    claim.claimType === 'OPINION' ||
    claim.claimType === 'PREDICTION' ||
    claim.claimType === 'QUESTION' ||
    claim.claimType === 'SATIRE_OR_HYPOTHETICAL'
  ) {
    verdict = 'NOT_ASSESSABLE'
    confidenceLevel = 'HIGH' // Proses pengenalan jenis klaim berkategori non-faktual berhasil tinggi
    reasons.push({
      code: `NON_FACTUAL_${claim.claimType}`,
      message: `Pernyataan teridentifikasi sebagai ${claim.claimType} yang tidak mengandung proposisi faktual objektif yang dapat dinilai.`
    })
    summary = `Pernyataan ini merupakan ${claim.claimType.toLowerCase()} dan bukan klaim faktual, sehingga tidak dapat dinilai kebenarannya.`
    requiresHumanReview = false
  }
  // ─── TAHAP 2: UJI KELENGKAPAN KONTEKS MINIMAL ───
  else if (claim.isLimitedContext && evidenceItems.length === 0) {
    verdict = 'INSUFFICIENT_EVIDENCE'
    confidenceLevel = 'LOW'
    reasons.push({
      code: 'LIMITED_SOURCE_CONTEXT',
      message: 'Klaim hanya diekstraksi dari judul berita singkat tanpa bahan bukti konfirmasi atau sanggahan.'
    })
    summary = 'Konteks informasi yang tersedia sangat terbatas (hanya judul singkat) dan belum ditemukan bukti pembanding.'
    requiresHumanReview = true
    humanReviewReason = 'Konteks klaim sangat terbatas; analis perlu memverifikasi dokumen lengkap sumber.'
  }
  // ─── TAHAP 3: BUKTI SALING BERTENTANGAN (Conflicting Evidence) ───
  else if (supportingIds.length > 0 && contradictingIds.length > 0) {
    verdict = 'CONFLICTING_EVIDENCE'
    confidenceLevel = 'MEDIUM'
    reasons.push({
      code: 'CONFLICTING_INDEPENDENT_EVIDENCE',
      message: `Ditemukan ${supportingIds.length} bukti pendukung dan ${contradictingIds.length} bukti sanggahan dari sumber berbeda yang saling bertolak belakang.`
    })
    summary = `Terdapat pertentangan data antar sumber berita; sebagian mengonfirmasi (${supportingIds.length} bukti) namun sebagian lain membantah (${contradictingIds.length} bukti).`
    requiresHumanReview = true
    humanReviewReason = 'Bukti saling bertentangan; memerlukan audit analis intelijen untuk menimbang kredibilitas primer masing-masing pihak.'
  }
  // ─── TAHAP 4: DIDUKUNG BUKTI TERVERIFIKASI ───
  else if (supportingIds.length > 0 && contradictingIds.length === 0) {
    // Syarat HIGH: Minimal ada rujukan primer resmi ATAU >= 2 penerbit independen
    if (coverage.hasPrimarySource || independentEvidenceCount >= 2) {
      verdict = 'SUPPORTED_BY_EVIDENCE'
      confidenceLevel = 'HIGH'
      reasons.push({
        code: 'STRONG_INDEPENDENT_CORROBORATION',
        message: `Klaim didukung oleh ${supportingIds.length} bukti dari ${independentPublisherCount} entitas penerbit independen.`
      })
      summary = `Klaim ini DIDUKUNG OLEH BUKTI lapangan/resmi berdasarkan konfirmasi dari ${independentPublisherCount} sumber independen.`
    } else {
      // Hanya didukung oleh 1 laporan tunggal
      verdict = 'SUPPORTED_BY_EVIDENCE'
      confidenceLevel = 'MEDIUM'
      reasons.push({
        code: 'SINGLE_SOURCE_SUPPORT',
        message: 'Klaim didukung oleh 1 laporan sumber, namun belum memiliki penguatan dari penerbit independen kedua.'
      })
      limitations.push('SINGLE_SOURCE_CORROBORATION: Konfirmasi berasal dari satu saluran tunggal.')
      summary = `Klaim didukung oleh laporan sumber, namun direkomendasikan verifikasi silang tambahan.`
      requiresHumanReview = true
      humanReviewReason = 'Konfirmasi baru bersumber dari satu penerbit tunggal.'
    }
  }
  // ─── TAHAP 5: DIBANTAH / BERTENTANGAN DENGAN BUKTI ───
  else if (contradictingIds.length > 0 && supportingIds.length === 0) {
    verdict = 'CONTRADICTED_BY_EVIDENCE'
    confidenceLevel = coverage.hasPrimarySource || independentEvidenceCount >= 2 ? 'HIGH' : 'MEDIUM'
    reasons.push({
      code: 'DIRECT_EVIDENCE_REFUTATION',
      message: `Klaim dibantah oleh ${contradictingIds.length} bukti sanggahan resmi atau rujukan periksa fakta.`
    })
    summary = `Klaim ini BERTENTANGAN DENGAN BUKTI resmi/fakta lapangan terverifikasi.`
  }
  // ─── TAHAP 6: BELUM TERVERIFIKASI (Default Safe Stance) ───
  else {
    verdict = 'UNVERIFIED'
    confidenceLevel = 'LOW'
    reasons.push({
      code: 'NO_CORROBORATING_EVIDENCE',
      message: 'Belum ditemukan bukti pendukung maupun sanggahan yang memadai di pangkalan data intelijen saat ini.'
    })
    summary = 'Klaim berstatus BELUM TERVERIFIKASI. Belum ada bukti independen yang cukup untuk menyimpulkan status kebenarannya.'
    requiresHumanReview = true
    humanReviewReason = 'Klaim memerlukan pengumpulan bahan bukti lapangan pembanding.'
  }

  const assessmentRecord: ClaimAssessmentRecord = {
    id: `ASM-${claim.id}`,
    claimId: claim.id,
    verdict,
    verdictLabelId: VERDICT_INDONESIAN_LABELS[verdict],
    confidenceLevel,
    evidenceCoverage: coverage,
    supportingEvidenceIds: supportingIds,
    contradictingEvidenceIds: contradictingIds,
    contextualEvidenceIds: contextualIds,
    summary,
    reasons,
    limitations,
    requiresHumanReview,
    humanReviewReason,
    assessmentMethod: 'INDEPENDENT_EVIDENCE_CHAIN_RESOLUTION',
    engineVersion: CLAIM_ASSESSMENT_ENGINE_VERSION,
    assessedAt: nowIso,
    updatedAt: nowIso
  }

  const explanation: ClaimExplanation = {
    claimId: claim.id,
    verdict,
    verdictLabel: VERDICT_INDONESIAN_LABELS[verdict],
    confidenceLevel,
    summary,
    reasons,
    evidenceSummary: {
      totalEvidence: evidenceItems.length,
      independentPublishers: independentPublisherCount,
      supportingItems: evidenceItems
        .filter(e => e.evidenceRelation === 'SUPPORTS')
        .map(e => ({ source: e.sourcePublisherName, snippet: e.quotedText, directness: e.directness })),
      contradictingItems: evidenceItems
        .filter(e => e.evidenceRelation === 'CONTRADICTS')
        .map(e => ({ source: e.sourcePublisherName, snippet: e.quotedText, directness: e.directness })),
      contextualItems: evidenceItems
        .filter(e => e.evidenceRelation === 'CONTEXTUALIZES')
        .map(e => ({ source: e.sourcePublisherName, snippet: e.quotedText }))
    },
    limitations,
    reviewRecommendation: requiresHumanReview 
      ? (verdict === 'CONFLICTING_EVIDENCE' ? 'MANDATORY_HUMAN_REVIEW' : 'HUMAN_SUPERVISION_RECOMMENDED')
      : 'AUTOMATED_DECISION_SUFFICIENT',
    engineVersion: CLAIM_ASSESSMENT_ENGINE_VERSION
  }

  return { assessment: assessmentRecord, explanation }
}
