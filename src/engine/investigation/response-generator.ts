/**
 * ════════════════════════════════════════════════════════════════════════════════════
 * NARADA — EVIDENCE-BASED PUBLIC RESPONSE GENERATOR
 * SPRINT 3: PACKAGE 2 (EVIDENCE-GROUNDED CLARIFICATION & HUMAN-REVIEW DRAFTER)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ════════════════════════════════════════════════════════════════════════════════════
 * 
 * Prinsip:
 * - DRAFT — REQUIRES HUMAN REVIEW: Tidak ada publikasi otomatis atau broadcasting.
 * - Setiap kalimat faktual harus berdasar pada ID bukti digital terverifikasi.
 * - Tidak memalsukan nomor surat kedinasan, pasal, atau nama pejabat militer.
 * - Mengecualikan secara ketat bukti sintetis benchmark dari draf kasus LIVE.
 * - Format rujukan resmi:
 *   1. Institutional Press Release Draft (Format Siaran Pers Dinas Penerangan)
 *   2. Community Dialogue & FAQ Draft (Format Komsos Warga / Babinsa)
 *   3. Social Media Clarification Draft (Format Taktis Singkat <280 karakter)
 *   4. WhatsApp Civilian Information Draft (Format Literasi Komunitas)
 * ════════════════════════════════════════════════════════════════════════════════════
 */

import {
  getInvestigationCase,
  getEvidenceRecordsForCase,
  getClaimsForCase,
  getRelationsForCase,
  getAssessmentsForCase,
  getResponseDraftsForCase,
  addResponseDraft,
  verifyEvidenceIntegrity
} from './case-store.ts'

import type {
  PublicResponseDraft,
  ResponseChannelType,
  SentenceEvidenceMapping,
  EvidenceRecord
} from './investigation-types.ts'

export interface GenerateDraftParams {
  caseId: string
  channel: ResponseChannelType
  selectedClaimIds?: string[]
  selectedEvidenceIds?: string[]
  reviewerActor?: string
}

/**
 * Menghasilkan Draf Tanggapan Berbasis Bukti Nyata dengan Pemetaan Grounded
 */
export function generateEvidenceGroundedDraft(params: GenerateDraftParams): PublicResponseDraft {
  const invCase = getInvestigationCase(params.caseId)
  if (!invCase) {
    throw new Error(`Kasus dengan ID ${params.caseId} tidak ditemukan`)
  }

  const allClaims = getClaimsForCase(params.caseId)
  const allEvidence = getEvidenceRecordsForCase(params.caseId)
  const allRelations = getRelationsForCase(params.caseId)
  const allAssessments = getAssessmentsForCase(params.caseId)
  const existingDrafts = getResponseDraftsForCase(params.caseId)

  // Filter klaim yang dipilih atau default ke seluruh klaim kasus
  const targetClaims = params.selectedClaimIds && params.selectedClaimIds.length > 0
    ? allClaims.filter(c => params.selectedClaimIds!.includes(c.id))
    : allClaims

  // Filter bukti yang dipilih atau default ke seluruh bukti yang relevan
  let eligibleEvidence = params.selectedEvidenceIds && params.selectedEvidenceIds.length > 0
    ? allEvidence.filter(e => params.selectedEvidenceIds!.includes(e.id))
    : allEvidence

  const warningsAndLimitations: string[] = [
    'DRAFT — REQUIRES HUMAN REVIEW: Naskah ini adalah rancangan bahan informasi publik, bukan persetujuan rilis resmi instansi.',
    'Penerbitan resmi hanya dapat dilakukan oleh pejabat yang berwenang (Pejabat Penerangan / Komandan Satuan) sesuai peraturan perundang-undangan.',
    'Nol posting otomatis: Sistem Narada tidak memiliki akses eksekusi API siaran ke platform media sosial mana pun.'
  ]

  // Aturan Eligibilitas Bukti (Package 2.3)
  // 1. Tolak bukti sintetis jika kasus berstatus LIVE
  if (!invCase.isSimulation) {
    const hasSynthetic = eligibleEvidence.some(e => e.evidenceMode === 'SYNTHETIC_BENCHMARK')
    if (hasSynthetic) {
      eligibleEvidence = eligibleEvidence.filter(e => e.evidenceMode !== 'SYNTHETIC_BENCHMARK')
      warningsAndLimitations.push('Bukti berstatus SYNTHETIC_BENCHMARK telah dikecualikan secara otomatis dari perumusan naskah tanggapan LIVE.')
    }
  }

  // 2. Tolak bukti yang terdeteksi mengalami anomali hash
  eligibleEvidence = eligibleEvidence.filter(e => {
    const verify = verifyEvidenceIntegrity(e.id)
    if (verify.isTamperDetected) {
      warningsAndLimitations.push(`Bukti ${e.id} dikecualikan karena terdeteksi anomali pada digest SHA-256.`)
      return false
    }
    return true
  })

  // 3. Identifikasi bukti pendukung dan bukti sanggahan
  const supportingEvidence: EvidenceRecord[] = []
  const contradictingEvidence: EvidenceRecord[] = []
  const contextualEvidence: EvidenceRecord[] = []

  eligibleEvidence.forEach(ev => {
    const rels = allRelations.filter(r => r.evidenceId === ev.id)
    const isSupport = rels.some(r => r.relationType === 'SUPPORTS')
    const isContradict = rels.some(r => r.relationType === 'CONTRADICTS')

    if (isContradict) {
      contradictingEvidence.push(ev)
    } else if (isSupport) {
      supportingEvidence.push(ev)
    } else {
      contextualEvidence.push(ev)
    }
  })

  // Rumuskan ringkasan fakta dan hal yang belum diverifikasi
  const primaryClaimText = targetClaims.length > 0
    ? targetClaims.map(c => c.claimText).join('; ')
    : invCase.title

  let knownFactsSection = ''
  let unverifiedSection = ''
  const groundedSentences: SentenceEvidenceMapping[] = []

  if (contradictingEvidence.length > 0) {
    const refIds = contradictingEvidence.map(e => e.id)
    const sources = Array.from(new Set(contradictingEvidence.map(e => e.sourceLabel))).join(', ')
    knownFactsSection = `Berdasarkan verifikasi terhadap bukti resmi (${sources}), klaim bahwa "${primaryClaimText}" tidak sesuai dengan fakta operasional yang terverifikasi.`
    groundedSentences.push({
      sentenceIndex: 0,
      text: knownFactsSection,
      supportingEvidenceIds: refIds,
      sourceLabel: sources
    })
  } else if (supportingEvidence.length > 0) {
    const refIds = supportingEvidence.map(e => e.id)
    const sources = Array.from(new Set(supportingEvidence.map(e => e.sourceLabel))).join(', ')
    knownFactsSection = `Informasi terkait "${primaryClaimText}" bersesuaian dengan konfirmasi data dari ${sources}.`
    groundedSentences.push({
      sentenceIndex: 0,
      text: knownFactsSection,
      supportingEvidenceIds: refIds,
      sourceLabel: sources
    })
  } else {
    knownFactsSection = `Narasi mengenai "${primaryClaimText}" sedang dalam pemantauan meja investigasi.`
    groundedSentences.push({
      sentenceIndex: 0,
      text: knownFactsSection,
      supportingEvidenceIds: eligibleEvidence.map(e => e.id),
      sourceLabel: 'Pantauan Ruang Publik'
    })
  }

  // Bagian informasi yang belum lengkap atau masih dalam verifikasi
  const unverifiedClaims = targetClaims.filter(c => {
    const a = allAssessments.find(as => as.claimId === c.id)
    return !a || a.verdict === 'UNVERIFIED' || a.verdict === 'INCONCLUSIVE'
  })

  if (unverifiedClaims.length > 0) {
    unverifiedSection = `Aspek yang masih memerlukan verifikasi independen lanjutan meliputi: ${unverifiedClaims.map(c => c.claimText).join(', ')}.`
  } else {
    unverifiedSection = 'Seluruh klaim pokok telah diperiksa silang terhadap berkas bukti yang tersedia.'
  }

  // Format kanal spesifik
  let title = ''
  let content = ''
  let channelLabel = ''

  const primarySourceUrl = eligibleEvidence.find(e => e.sourceUrl)?.sourceUrl || 'https://tniad.mil.id'
  const primarySourceLabel = eligibleEvidence.find(e => e.sourceLabel)?.sourceLabel || 'Pusat Penerangan / Sumber Terakreditasi'

  switch (params.channel) {
    case 'INSTITUTIONAL_PRESS':
      channelLabel = 'Siaran Pers Resmi Dinas Penerangan'
      title = `DRAF SIARAN INFORMASI PUBLIK: PENJELASAN MENGENAI NARASI "${primaryClaimText.toUpperCase()}"`
      content = `DRAF — REQUIRES HUMAN REVIEW
KLASIFIKASI: DOKUMEN PENJELASAN PUBLIK (TERBUKA)

PERNYATAAN RESMI PENJELASAN FAKTA:
Terkait peredaran narasi di ruang digital mengenai:
"${primaryClaimText}"

1. PENJELASAN FAKTA LAPANGAN:
${knownFactsSection}
Seluruh tindakan operasional dan pembinaan satuan dilaksanakan berpedoman pada ketentuan hukum yang berlaku secara profesional dan akuntabel.

2. STATUS VERIFIKASI & ASPEK TERBUKA:
${unverifiedSection}

3. RUJUKAN RESMI & HIMBAUAN:
Masyarakat diimbau untuk selalu menyaring informasi dari sumber-sumber resmi terakreditasi sebelum menyebarluaskan kabar di ruang digital. Rujukan resmi verifikasi: ${primarySourceUrl} (${primarySourceLabel}).

[ID Bukti Terkait: ${eligibleEvidence.map(e => e.id).join(', ')}]`
      break

    case 'COMMUNITY_DIALOGUE':
      channelLabel = 'Panduan Komunikasi Sosial & FAQ Teritorial'
      title = `PANDUAN KOMUNIKASI SOSIAL (KOMSOS) & TANYA JAWAB WARGA`
      content = `DRAF — REQUIRES HUMAN REVIEW
PANDUAN INTERAKSI DIALOG WARGA BINAAN TERITORIAL

TOPIK BAHASAN:
Klarifikasi atas isu: "${primaryClaimText}"

POIN TANYA JAWAB (FAQ):
• Pertanyaan: "Bapak Babinsa, apakah benar kabar di WhatsApp/Facebook yang menyebutkan '${primaryClaimText.slice(0, 80)}'?"
• Jawaban Resmi: "Bapak, Ibu, dan warga sekalian, kabar tersebut telah diperiksa melalui data resmi. Faktanya: ${knownFactsSection}"
• Status Pengecekan: "${unverifiedSection}"
• Pesan Kerukunan: "Mari kita bersama-sama menjaga ketenangan lingkungan dan tidak mudah meneruskan pesan berantai yang belum jelas sumbernya. Apabila ada keraguan, silakan tanyakan ke Koramil atau Babinsa setempat."

Rujukan Informasi Resmi: ${primarySourceUrl}`
      break

    case 'SOCIAL_MEDIA_TACTICAL':
      channelLabel = 'Klarifikasi Media Sosial Taktis (<280 Karakter)'
      title = `KLARIFIKASI SINGKAT MEDIA SOSIAL`
      const shortSnippet = knownFactsSection.length > 180 ? knownFactsSection.slice(0, 177) + '...' : knownFactsSection
      content = `[KLARIFIKASI RESMI] Mengenai isu "${primaryClaimText.slice(0, 50)}...":

Fakta: ${shortSnippet}

Rujukan verifikasi: ${primarySourceUrl}
#SaringSebelumSharing #TangkalDisinformasi #InformasiPublik`
      break

    case 'WHATSAPP_CIVILIAN':
    default:
      channelLabel = 'Pesan Penerangan WhatsApp Komunitas'
      title = `PESAN PENERANGAN LITERASI SIBER KOMUNITAS`
      content = `*KLARIFIKASI INFORMASI & HIMBAUAN SIBER RESMI* 🇮🇩

Bapak, Ibu, dan Rekan-rekan sekalian, mohon izin menyampaikan pelurusan informasi terkait kabar:
👉 _"${primaryClaimText}"_

*FAKTA YANG TERVERIFIKASI:*
✅ ${knownFactsSection}

*CATATAN PEMERIKSAAN:*
ℹ️ ${unverifiedSection}

🔗 Tautan rujukan resmi verifikasi:
${primarySourceUrl} (${primarySourceLabel})

Yuk budayakan *Saring Sebelum Sharing* demi kenyamanan dan kerukunan keluarga kita. Terima kasih! 🙏🇮🇩`
      break
  }

  // Hitung nomor versi berdasarkan draf yang sudah ada pada kanal yang sama
  const channelDrafts = existingDrafts.filter(d => d.channel === params.channel)
  const version = channelDrafts.length + 1

  const draft: PublicResponseDraft = {
    id: `DRAFT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    caseId: params.caseId,
    version,
    channel: params.channel,
    channelLabel,
    title,
    headerNotice: 'DRAFT — REQUIRES HUMAN REVIEW',
    content,
    knownFactsSection,
    unverifiedSection,
    groundedSentences,
    referencedEvidenceIds: eligibleEvidence.map(e => e.id),
    referencedClaimIds: targetClaims.map(c => c.id),
    status: 'GENERATED_DRAFT',
    generatedAt: new Date().toISOString(),
    reviewerActor: params.reviewerActor || 'Local Operator',
    warningsAndLimitations,
    isSimulation: Boolean(invCase.isSimulation),
    simulationWatermark: invCase.simulationWatermark
  }

  addResponseDraft(draft)
  return draft
}

/**
 * Backward compatibility wrapper untuk modul legacy yang memanggil generateCounterNarratives
 */
export function generateCounterNarratives(
  caption: string,
  matchedDebunk?: { claim?: string; clarification?: string; officialSource?: string; sourceUrl?: string },
  platform = 'MEDIA SOSIAL'
): {
  dispenadOfficial: string
  babinsaTerritorial: string
  whatsappCivilian: string
  socialTactical: string
} {
  const claimText = matchedDebunk?.claim || caption.slice(0, 120).trim()
  const clarification = matchedDebunk?.clarification || 'Informasi tersebut telah diteliti dan tidak berdasar pada data fakta lapangan yang terakreditasi.'
  const sourceUrl = matchedDebunk?.sourceUrl || 'https://tniad.mil.id'
  const sourceLabel = matchedDebunk?.officialSource || 'Dinas Penerangan TNI AD'

  const dispenadOfficial = `DRAFT — REQUIRES HUMAN REVIEW
DOKUMEN INFORMASI PUBLIK
TENTANG: PENJELASAN MENGENAI NARASI "${claimText.toUpperCase()}"

1. Menanggapi peredaran narasi di ruang digital (${platform}):
"${claimText}"

2. Penjelasan Faktual:
${clarification}

3. Himbauan:
Masyarakat diimbau mengonfirmasi kebenaran informasi melalui kanal resmi kedinasan: ${sourceUrl} (${sourceLabel}).

Jakarta, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`

  const babinsaTerritorial = `DRAFT — REQUIRES HUMAN REVIEW
PANDUAN KOMUNIKASI SOSIAL TERITORIAL

Topik Bahasan: Isu "${claimText}"
Poin Bicara Kepada Warga:
- "Bapak/Ibu sekalian, terkait informasi yang beredar tentang '${claimText.slice(0, 70)}...', kami sampaikan bahwa kabar tersebut telah diverifikasi."
- Fakta: ${clarification}
- "Mari kita bijak dan tenang dalam menyikapi kabar di grup media sosial."
Rujukan Resmi: ${sourceUrl}`

  const whatsappCivilian = `*DRAFT — REQUIRES HUMAN REVIEW*
*KLARIFIKASI FAKTA & LITERASI SIBER* 🇮🇩

Bapak, Ibu, dan Kerabat sekalian, berikut klarifikasi mengenai kabar:
👉 _"${claimText}"_

*FAKTA LAPANGAN:*
✅ ${clarification}

🔗 Rujukan resmi: ${sourceUrl} (${sourceLabel})
Budayakan saring sebelum sharing demi kerukunan kita bersama. Terima kasih! 🙏`

  const shortClarification = clarification.length > 160 ? clarification.slice(0, 157) + '...' : clarification
  const socialTactical = `[KLARIFIKASI RESMI - DRAFT] Mengenai isu "${claimText.slice(0, 45)}...":

Fakta: ${shortClarification}

Rujukan resmi: ${sourceUrl}
#SaringSebelumSharing #TangkalHoaks`

  return {
    dispenadOfficial,
    babinsaTerritorial,
    whatsappCivilian,
    socialTactical
  }
}

