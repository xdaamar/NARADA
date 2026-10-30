/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — CLAIM VS PUBLICATION SEMANTIC FIREWALL
 * SPRINT 1C: WORK PACKAGE 3 (PREVENT HOAX INFLATION ON REPORTING ARTICLES)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Prinsip Desain & Integritas Semantik:
 * 1. Entitas Terpisah: Publication (objek berita) != Claim (pernyataan fakta)
 *    != FactCheckReference (rujukan Mafindo).
 * 2. Stance-Aware Evaluation: Artikel yang melaporkan, mengutip, atau membantah
 *    klaim palsu TIDAK BOLEH dicap sebagai HOAKS.
 * 3. Review Required: Kemiripan teks semata adalah candidate retrieval,
 *    bukan vonis otomatis bersalah pada seluruh publikasi.
 * ══════════════════════════════════════════════════════════════════════════
 */

import { extractSubstantiveTokens, calculateJaccardSimilarity } from './clustering-engine.ts'
import type { 
  ClaimMatchCandidate, 
  PublicationReportingStance, 
  FactCheckReference 
} from './radar-types.ts'

// Kata kunci penanda bahwa publikasi secara aktif membantah / memeriksa fakta (bukan isi klaim itu sendiri)
const DEBUNK_STANCE_MARKERS = [
  'klarifikasi', 'cek fakta', 'bantah', 'bantahan', 'tidak benar', 'luruskan', 'tangkal',
  'kabar bohong', 'tepis', 'menepis', 'pastikan kabar', 'faktanya', 'bukan karena',
  'menyesatkan', 'menepis isu', 'hoaks belaka', 'disinformasi belaka', 'tegaskan',
  'tegaskan bahwa', 'pastikan'
]

// Kata kunci penanda pelaporan berita jurnalistik biasa
const REPORTING_MARKERS = [
  'selidiki', 'penyelidikan', 'telusuri', 'usut', 'periksa', 'tangkap', 'amankan',
  'bongkar', 'ungkap', 'proses', 'tindak', 'sidik',
  'laporkan', 'laporkan temuan', 'umumkan', 'sampaikan', 'jelaskan', 'imbau',
  'imbauan', 'rilis', 'gelar', 'tinjau', 'resmikan', 'pantau', 'hadiri',
  'pimpin', 'distribusikan', 'salurkan', 'sahkan', 'adakan'
]

// Kata kunci penanda kutipan atau pernyataan pihak ketiga
const QUOTATION_MARKERS = [
  'beredar narasi', 'beredar kabar', 'beredar isu', 'beredar', 'disebutkan', 'menyebutkan',
  'kata', 'ujar', 'sebut', 'klaim', 'menurut', 'dugaan', 'diduga',
  'soroti', 'tuding', 'bocorkan', 'katanya'
]

/**
 * 1. Deteksi Sikap Pelaporan (Stance Detection) dari Teks Publikasi
 */
export function detectPublicationStance(title: string, excerpt: string = ''): PublicationReportingStance {
  const norm = (title + ' ' + excerpt).toLowerCase()

  // Cek apakah memuat indikator bantahan/klarifikasi aktif
  const hasDebunkMarker = DEBUNK_STANCE_MARKERS.some(marker => norm.includes(marker))
  if (hasDebunkMarker) {
    return 'DEBUNKING_HOAX'
  }

  // Cek apakah memuat indikator pelaporan netral
  const hasReportingMarker = REPORTING_MARKERS.some(marker => norm.includes(marker))
  if (hasReportingMarker) {
    return 'REPORTING_CIVIL'
  }

  // Cek apakah memuat indikator kutipan
  const hasQuotationMarker = QUOTATION_MARKERS.some(marker => norm.includes(marker))
  if (hasQuotationMarker) {
    return 'QUOTING_CLAIM'
  }

  return 'UNASSESSED'
}

/**
 * 2. Evaluasi Kecocokan Klaim dengan Basis Referensi Cek Fakta (MAFINDO)
 * Menegakkan Firewall Semantik: Kemiripan teks tidak otomatis membuat publikasi bersalah.
 */
export function evaluateClaimFirewall(
  publicationTitle: string,
  publicationExcerpt: string = '',
  knownDebunks: Array<{
    id: string
    claim: string
    verdict?: string
    referenceUrl?: string
    reviewedAt?: number | null
    reviewedDateFormatted?: string
  }> = []
): ClaimMatchCandidate {
  const fullText = publicationTitle + ' ' + publicationExcerpt
  const pubTokens = extractSubstantiveTokens(fullText)
  const stance = detectPublicationStance(publicationTitle, publicationExcerpt)

  if (knownDebunks.length === 0 || pubTokens.length === 0) {
    return {
      claimText: publicationTitle,
      matchStatus: 'INSUFFICIENT_CONTEXT',
      stance,
      similarityScore: 0,
      matchExplanation: 'Tidak ada data pembanding periksa fakta yang tersedia.',
      requiresAnalystReview: false
    }
  }

  let bestMatch: {
    debunk: (typeof knownDebunks)[0]
    similarity: number
    sharedCount: number
    overlapRatio: number
  } | null = null

  // Cari kandidat cek fakta paling relevan
  for (const debunk of knownDebunks) {
    const debunkTokens = extractSubstantiveTokens(debunk.claim)
    const similarity = calculateJaccardSimilarity(pubTokens, debunkTokens)

    const setPub = new Set(pubTokens)
    const setDebunk = new Set(debunkTokens)
    let sharedCount = 0
    setPub.forEach(t => { if (setDebunk.has(t)) sharedCount++ })
    const minTokens = Math.min(setPub.size, setDebunk.size)
    const overlapRatio = minTokens > 0 ? sharedCount / minTokens : 0

    if (
      similarity >= 0.40 || 
      (sharedCount >= 4 && overlapRatio >= 0.50) ||
      (sharedCount >= 3 && similarity >= 0.30)
    ) {
      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { debunk, similarity, sharedCount, overlapRatio }
      }
    }
  }

  // Jika tidak ada kemiripan yang cukup
  if (!bestMatch) {
    return {
      claimText: publicationTitle,
      matchStatus: 'CLAIM_NOT_MATCHED',
      stance,
      similarityScore: 0,
      matchExplanation: 'Tidak ditemukan rujukan klaim periksa fakta yang sesuai.',
      requiresAnalystReview: false
    }
  }

  const factCheckRef: FactCheckReference = {
    referenceId: bestMatch.debunk.id,
    referenceSource: 'TurnBackHoax (MAFINDO)',
    referenceUrl: bestMatch.debunk.referenceUrl || 'https://turnbackhoax.id',
    claimReviewed: bestMatch.debunk.claim,
    verdict: (bestMatch.debunk.verdict as any) || 'HOAKS',
    reviewedAt: bestMatch.debunk.reviewedAt || null,
    reviewedDateFormatted: bestMatch.debunk.reviewedDateFormatted
  }

  // Penerapan Firewall Semantik Berdasarkan Sikap Publikasi (Stance)
  if (stance === 'DEBUNKING_HOAX') {
    return {
      claimText: publicationTitle,
      matchStatus: 'FACT_CHECK_REFERENCE_FOUND',
      stance,
      matchedReference: factCheckRef,
      similarityScore: bestMatch.similarity,
      matchExplanation: 'Publikasi menyajikan klarifikasi/pembantahan resmi terhadap isu hoaks terkait; BUKAN penyebar hoaks.',
      requiresAnalystReview: false
    }
  }

  if (stance === 'REPORTING_CIVIL') {
    return {
      claimText: publicationTitle,
      matchStatus: 'FACT_CHECK_REFERENCE_FOUND',
      stance,
      matchedReference: factCheckRef,
      similarityScore: bestMatch.similarity,
      matchExplanation: 'Publikasi memberitakan peristiwa/klarifikasi secara faktual; terhubung ke referensi cek fakta sebagai konteks.',
      requiresAnalystReview: false
    }
  }

  if (stance === 'QUOTING_CLAIM') {
    return {
      claimText: publicationTitle,
      matchStatus: 'CLAIM_MATCH_REVIEW_REQUIRED',
      stance,
      matchedReference: factCheckRef,
      similarityScore: bestMatch.similarity,
      matchExplanation: 'Publikasi mengutip klaim yang telah diperiksa fakta; diperlukan telaah konteks kutipan oleh analis.',
      requiresAnalystReview: true
    }
  }

  // Jika kemiripan sangat tinggi namun tanpa penanda bantahan eksplisit
  return {
    claimText: publicationTitle,
    matchStatus: 'CLAIM_MATCH_REVIEW_REQUIRED',
    stance: 'ALLEGED_ASSERTION',
    matchedReference: factCheckRef,
    similarityScore: bestMatch.similarity,
    matchExplanation: 'Kemiripan substantif ditemukan dengan klaim hoaks; ditandai untuk telaah analis (tidak dicap bersalah otomatis).',
    requiresAnalystReview: true
  }
}

/**
 * 3. Resolusi Triase Semantik Publikasi: Memastikan Berita Klarifikasi Tidak Divonis Hoaks
 */
export function resolvePublicationTriage(
  publicationTitle: string,
  publicationExcerpt: string = '',
  currentVerdict: string = 'UNVERIFIED',
  knownDebunks: any[] = []
): {
  resolvedVerdict: 'HOAKS' | 'DISINFORMASI' | 'PROPAGANDA' | 'FAKTA' | 'NETRAL' | 'UNVERIFIED'
  claimMatch: ClaimMatchCandidate
  reasonCodes: string[]
} {
  const claimMatch = evaluateClaimFirewall(publicationTitle, publicationExcerpt, knownDebunks)
  const reasonCodes: string[] = []

  // Kasus 1: Artikel berasal langsung dari feed Fact-Check (misal TurnBackHoax)
  if (currentVerdict === 'HOAKS' || currentVerdict === 'DISINFORMASI' || currentVerdict === 'PROPAGANDA') {
    reasonCodes.push('VERIFIED_FACT_CHECK_SOURCE')
    return {
      resolvedVerdict: currentVerdict as any,
      claimMatch,
      reasonCodes
    }
  }

  // Kasus 2: Artikel berita umum yang membantah atau meluruskan hoaks
  if (claimMatch.stance === 'DEBUNKING_HOAX') {
    reasonCodes.push('PUBLICATION_DEBUNKS_CLAIM', 'FIREWALL_PROTECTED_NOT_HOAX')
    return {
      resolvedVerdict: 'NETRAL', // Melindungi publikasi dari cap hoaks palsu
      claimMatch,
      reasonCodes
    }
  }

  // Kasus 3: Artikel berita jurnalistik yang melaporkan
  if (claimMatch.stance === 'REPORTING_CIVIL') {
    reasonCodes.push('CIVIL_REPORTING_PRESERVED')
    return {
      resolvedVerdict: 'NETRAL',
      claimMatch,
      reasonCodes
    }
  }

  // Kasus 4: Ditemukan kecocokan klaim tapi belum diverifikasi konteks penegasannya
  if (claimMatch.matchStatus === 'CLAIM_MATCH_REVIEW_REQUIRED') {
    reasonCodes.push('CLAIM_MATCH_REVIEW_REQUIRED')
    return {
      resolvedVerdict: 'UNVERIFIED', // Perlu telaah, bukan vonis bersalah otomatis
      claimMatch,
      reasonCodes
    }
  }

  return {
    resolvedVerdict: (currentVerdict as any) || 'NETRAL',
    claimMatch,
    reasonCodes
  }
}
