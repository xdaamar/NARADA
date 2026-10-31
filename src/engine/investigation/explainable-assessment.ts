/**
 * ════════════════════════════════════════════════════════════════════════════════════
 * NARADA — EXPLAINABLE ASSESSMENT: "WHY NARADA THINKS SO"
 * SPRINT 2: D7 (EXPLAINABILITY CONTRACT & EVIDENCE GROUNDING)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ════════════════════════════════════════════════════════════════════════════════════
 */

import type {
  ClaimRecord,
  EvidenceRecord,
  EvidenceRelation,
  AssessmentRecord,
  WhyNaradaThinksSoExplanation
} from './investigation-types.ts'

/**
 * Menyusun Penjelasan Transparan "Why NARADA Thinks So"
 * yang terikat pada ID bukti nyata, metode yang digunakan, dan keterbatasan data
 */
export function generateWhyNaradaThinksSo(params: {
  caseId: string
  claim: ClaimRecord
  assessment?: AssessmentRecord
  relations: EvidenceRelation[]
  evidenceList: EvidenceRecord[]
}): WhyNaradaThinksSoExplanation {
  const supportingIds: string[] = []
  const contradictingIds: string[] = []
  const contextualIds: string[] = []

  // Kelompokkan bukti berdasarkan relasi yang tercatat
  params.relations.forEach(r => {
    if (r.claimId === params.claim.id) {
      if (r.relationType === 'SUPPORTS') {
        supportingIds.push(r.evidenceId)
      } else if (r.relationType === 'CONTRADICTS') {
        contradictingIds.push(r.evidenceId)
      } else {
        contextualIds.push(r.evidenceId)
      }
    }
  })

  const currentStatus = params.assessment?.status || 'UNVERIFIED'
  const rationale = params.assessment?.rationale || 'Belum ada telaah analis mendalam yang direkam untuk klaim ini.'

  // Hitung cakupan bukti
  const totalLinked = supportingIds.length + contradictingIds.length + contextualIds.length
  const totalEvidenceInCase = params.evidenceList.length

  // Rumuskan ringkasan kesimpulan yang jujur
  let conclusionSummary = ''
  switch (currentStatus) {
    case 'SUPPORTED':
      conclusionSummary = `Berdasarkan penelaahan terhadap ${supportingIds.length} bukti pendukung terverifikasi, klaim ini dinyatakan DIDUKUNG oleh fakta lapangan resmi.`
      break
    case 'CONTRADICTED':
      conclusionSummary = `Berdasarkan penelaahan terhadap ${contradictingIds.length} bukti sanggahan terverifikasi, klaim ini dinyatakan TERBANTAHKAN / TIDAK SESUAI FAKTA (CONTRADICTED).`
      break
    case 'MIXED':
      conclusionSummary = `Ditemukan fakta yang saling tumpang tindih; sebagian klaim didukung (${supportingIds.length} bukti), namun terdapat unsur yang bertentangan (${contradictingIds.length} bukti).`
      break
    case 'INCONCLUSIVE':
      conclusionSummary = `Bukti yang terkumpul (${totalLinked} berkas terkait) menunjukkan informasi yang saling bertentangan atau belum cukup konklusif untuk menetapkan vonis definitif.`
      break
    case 'UNVERIFIED':
    default:
      conclusionSummary = `Klaim berstatus BELUM TERVERIFIKASI. Diperlukan penambahan bahan bukti pembanding independen sebelum penilaian resmi disimpulkan.`
      break
  }

  // Identifikasi asumsi dan informasi yang belum lengkap
  const assumptions: string[] = [
    'Bukti digital yang dimasukkan dianggap mewakili materi asli pada saat snapshot diambil.',
    'Metrik kemiripan leksikal mencerminkan kesamaan teks semata, bukan hubungan komando organisasi.'
  ]

  const missingInformation: string[] = []
  if (supportingIds.length === 0 && contradictingIds.length === 0) {
    missingInformation.push('Belum ada tautan bukti resmi primer (klarifikasi kementerian/lembaga atau data lapangan).')
  }
  if (params.claim.extractedFromEvidenceIds.length === 0) {
    missingInformation.push('Asal usul kemunculan pertama narasi klaim belum terpetakan ke dokumen bukti spesifik.')
  }

  // Keterbatasan kualitas data
  const dataQualityLimitations: string[] = [
    'Penilaian intelijen kognitif ini merupakan produk analisis berbantuan AI lokal, bukan vonis peradilan hukum.',
    `Denominator analisis: ${totalLinked} bukti tertaut dari total ${totalEvidenceInCase} berkas dalam kasus.`
  ]

  const groundedEvidence = [
    ...supportingIds.map(id => {
      const ev = params.evidenceList.find(e => e.id === id)
      return { evidenceId: id, role: 'SUPPORTING', source: ev?.sourceLabel || 'Bukti Pendukung', textSnippet: ev?.extractedText.slice(0, 100) || '' }
    }),
    ...contradictingIds.map(id => {
      const ev = params.evidenceList.find(e => e.id === id)
      return { evidenceId: id, role: 'CONTRADICTING', source: ev?.sourceLabel || 'Bukti Sanggahan', textSnippet: ev?.extractedText.slice(0, 100) || '' }
    }),
    ...contextualIds.map(id => {
      const ev = params.evidenceList.find(e => e.id === id)
      return { evidenceId: id, role: 'CONTEXTUAL', source: ev?.sourceLabel || 'Bukti Konteks', textSnippet: ev?.extractedText.slice(0, 100) || '' }
    })
  ]
  if (groundedEvidence.length === 0 && params.evidenceList.length > 0) {
    groundedEvidence.push({
      evidenceId: params.evidenceList[0].id,
      role: 'GENERAL_CASE_EVIDENCE',
      source: params.evidenceList[0].sourceLabel,
      textSnippet: params.evidenceList[0].extractedText.slice(0, 100)
    })
  }

  const methodologicalCaveats = [
    'Penilaian intelijen kognitif ini merupakan produk analisis berbantuan AI lokal, bukan vonis peradilan hukum.',
    'Kesamaan leksikon semata tidak membuktikan hubungan koordinasi terencana atau bayaran antar-akun.',
    'Analisis dibatasi pada bukti digital yang telah dimasukkan analis ke dalam sistem meja kerja lokal.',
    `Denominator analisis: ${totalLinked} bukti tertaut dari total ${totalEvidenceInCase} berkas dalam kasus.`
  ]

  const alternativeInterpretations = [
    'Narasi yang berkembang mungkin timbul dari kepanikan warga secara spontan tanpa rekayasa terorganisir.',
    'Perbedaan informasi di media sosial dapat bersumber dari miskomunikasi awal pada rilis situasi sebelum konfirmasi resmi diterbitkan.'
  ]

  return {
    assessmentId: params.assessment?.id || `PENDING-${params.claim.id}`,
    caseId: params.caseId,
    claimText: params.claim.claimText,
    currentStatus,
    conclusionSummary,
    summary: conclusionSummary,
    supportingEvidenceIds: supportingIds,
    contradictingEvidenceIds: contradictingIds,
    contextualEvidenceIds: contextualIds,
    groundedEvidence,
    methodologicalCaveats,
    alternativeInterpretations,
    methodUsed: 'Cross-Source Semantic Claim–Evidence Verification & Provenance Auditing',
    rationale,
    assumptions,
    missingInformation,
    dataQualityLimitations,
    timestampCoverage: `${totalLinked} dari ${totalEvidenceInCase} berkas tertaut`,
    sampleSizeDenominator: `${totalLinked} Bukti Tertaut / ${totalEvidenceInCase} Total Berkas Kasus`,
    analystReviewStatus: params.assessment ? 'Ditelaah oleh Analis (Human Reviewed)' : 'Belum Ditelaah (Pending Review)',
    generatedAt: new Date().toISOString(),
    reviewedAt: params.assessment?.evaluatedAt
  }
}
