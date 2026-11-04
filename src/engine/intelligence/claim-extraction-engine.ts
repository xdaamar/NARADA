/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — CLAIM UNDERSTANDING & EXTRACTION ENGINE (WP-03)
 * SPRINT 09: CONSERVATIVE PROPOSITIONAL EXTRACTION & ATTRIBUTION
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Prinsip Desain:
 * 1. Title is NOT Claim: Judul berita tidak identik dengan proposisi klaim.
 * 2. Editorial Tag Stripping: Tag [HOAKS], [FAKTA], [KLARIFIKASI] dipisahkan
 *    dari proposisi inti dan TIDAK langsung menentukan vonis benar/salah!
 * 3. Attribution & Stance Preservation: Pernyataan bantahan ("Kemhan Bantah...")
 *    disimpan dengan modalitas DENIED dan speaker terkait, bukan vonis palsu otomatis.
 * 4. Modality Classification: Memisahkan Faktual, Opini, Prediksi, Pertanyaan,
 *    Kutipan, Satir, dan Ambiguitas.
 * 5. Conservative Extraction: Teks samar ditandai AMBIGUOUS/UNKNOWN tanpa fabrikasi aktor.
 * ══════════════════════════════════════════════════════════════════════════
 */

import {
  type ClaimRecord,
  type ClaimType,
  type ClaimModality,
  CLAIM_EXTRACTION_ENGINE_VERSION
} from './claim-types.ts'
import { extractEntitiesFromText } from '../radar/clustering-engine.ts'

// Tag Editorial Awalan Berita Cek Fakta yang harus dibersihkan dari proposisi inti
const EDITORIAL_LEAD_REGEX = /^\[?(?:hoaks|hoax|fakta|disinformasi|misinformasi|klarifikasi|cek fakta|turnbackhoax|viral|waspada|isu)\]?[\s:—–-]+/i

// Pola Pertanyaan
const QUESTION_PATTERNS = [
  /\?$/,
  /^(?:apakah|benarkah|adakah|benarkah kabar|mungkinkah|mengapa|bagaimana jika)/i
]

// Pola Prediksi
const PREDICTION_PATTERNS = [
  /\b(?:diprediksi|diperkirakan|berpotensi terjadi|kemungkinan besar akan|diramalkan|bakal terjadi|akan segera)\b/i
]

// Pola Opini
const OPINION_PATTERNS = [
  /\b(?:menurut saya|menurut kami|menurut kita|pandangan saya|sebaiknya|seharusnya|sangat disayangkan|dinilai wajar|pendapat saya|patut disyukuri|menilai bahwa|kami berharap|mengecewakan|kurang tepat|tidak pantas)\b/i
]

// Pola Satir / Hipotesis
const SATIRE_PATTERNS = [
  /\b(?:satir|lelucon|parodi|fiktif|cerita rekaan|bercanda|humor)\b/i
]

// Pola Bantahan / Penolakan (Denial)
const DENIAL_PATTERNS = [
  /\b(?:membantah|menampik|membantah keras|tepis|menepis|bantah|bantahan|menolak klaim|tegaskan tidak ada|tidak benar adanya|klarifikasi)\b/i
]

// Pola Kutipan / Atribusi Pihak (Attributed Speech)
const ATTRIBUTION_PATTERNS = [
  /\b(?:kata|ujar|tutur|sebut|pungkas|tegas|jelas|ungkap|beberkan|menurut|papar)\s+([A-Z][a-zA-Z\s]+?)(?:,|\.|$|\s+bahwa)/i,
  /^([A-Z][a-zA-Z\s]+?)\s+(?:sebut|tegaskan|nyatakan|ungkapkan|klaim)\s+bahwa/i
]

/**
 * Membersihkan awalan editorial dari kalimat klaim
 */
export function stripEditorialPrefix(text: string): { cleanText: string; strippedTag: string | null } {
  const match = text.match(EDITORIAL_LEAD_REGEX)
  if (match) {
    const strippedTag = match[0].replace(/^[\[\s]+|[\]:\s—–-]+$/g, '').trim().toUpperCase()
    const cleanText = text.slice(match[0].length).trim()
    return { cleanText, strippedTag }
  }
  return { cleanText: text.trim(), strippedTag: null }
}

/**
 * Klasifikasi Tipe Proposisi Klaim Secara Konservatif
 */
export function classifyPropositionType(text: string): ClaimType {
  const trimmed = text.trim()
  if (!trimmed || trimmed.length < 10) {
    return 'AMBIGUOUS'
  }

  // 1. Uji Satir
  if (SATIRE_PATTERNS.some(p => p.test(trimmed))) {
    return 'SATIRE_OR_HYPOTHETICAL'
  }

  // 2. Uji Pertanyaan
  if (QUESTION_PATTERNS.some(p => p.test(trimmed))) {
    return 'QUESTION'
  }

  // 3. Uji Prediksi
  if (PREDICTION_PATTERNS.some(p => p.test(trimmed))) {
    return 'PREDICTION'
  }

  // 4. Uji Opini
  if (OPINION_PATTERNS.some(p => p.test(trimmed))) {
    return 'OPINION'
  }

  // 5. Uji Pernyataan Berita Faktual
  // Jika memuat subjek substantif dan kata kerja / predikat
  const words = trimmed.split(/\s+/)
  if (words.length >= 4) {
    return 'FACTUAL_ASSERTION'
  }

  return 'AMBIGUOUS'
}

/**
 * Deteksi Pembicara dan Modalitas Pernyataan (Asserted vs Reported vs Denied)
 */
export function detectModalityAndSpeaker(text: string): {
  modality: ClaimModality
  attributedSpeaker?: string
  coreAssertionText: string
} {
  const trimmed = text.trim()

  // Cek apakah merupakan bantahan (Denial)
  const isDenial = DENIAL_PATTERNS.some(p => p.test(trimmed))
  if (isDenial) {
    // Cari pihak yang membantah di awal kalimat (misal: "Kemhan Bantah...")
    const speakerMatch = trimmed.match(/^([A-Za-z0-9\s]+?)\s+(?:membantah|menampik|menepis|tepis|bantah|tegaskan tidak ada)\s+(.+)$/i)
    if (speakerMatch) {
      return {
        modality: 'DENIED',
        attributedSpeaker: speakerMatch[1].trim(),
        coreAssertionText: speakerMatch[2].replace(/^(?:isu|kabar|klaim|adanya)\s+/i, '').trim()
      }
    }
    return {
      modality: 'DENIED',
      coreAssertionText: trimmed
    }
  }

  // Cek apakah merupakan kutipan attributed statement
  for (const pattern of ATTRIBUTION_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match && match[1]) {
      return {
        modality: 'REPORTED',
        attributedSpeaker: match[1].trim(),
        coreAssertionText: trimmed
      }
    }
  }

  return {
    modality: 'ASSERTED',
    coreAssertionText: trimmed
  }
}

/**
 * Ekstraksi Klaim Atomik dari Teks Artikel (WP-03)
 */
export function extractClaimsFromArticle(params: {
  articleId: string
  title: string
  description?: string
  content?: string
  publishedAt?: number | null
}): ClaimRecord[] {
  const claims: ClaimRecord[] = []
  const title = (params.title || '').trim()
  const description = (params.description || '').trim()
  const nowIso = new Date().toISOString()

  if (!title) return []

  // ─── 1. EKSTRAKSI KLAIM UTAMA DARI JUDUL (Headline Proposition) ───
  const { cleanText: titleCleanText, strippedTag } = stripEditorialPrefix(title)
  const modalityInfo = detectModalityAndSpeaker(titleCleanText)
  const claimType = classifyPropositionType(modalityInfo.coreAssertionText)

  const entities = extractEntitiesFromText(modalityInfo.coreAssertionText)
  const isLimited = !params.content && (!params.description || params.description.length < 50)

  const limitations: string[] = [
    `ENGINE_VERSION: ${CLAIM_EXTRACTION_ENGINE_VERSION}`
  ]
  if (isLimited) {
    limitations.push('LIMITED_CONTEXT: Klaim diekstraksi dari judul berita atau cuplikan singkat.')
  }
  if (strippedTag) {
    limitations.push(`EDITORIAL_TAG_DETECTED: Tag [${strippedTag}] disisihkan dari proposisi inti klaim.`)
  }
  if (modalityInfo.attributedSpeaker) {
    limitations.push(`ATTRIBUTED_SPEECH: Pernyataan diatribusikan kepada '${modalityInfo.attributedSpeaker}', bukan verifikasi langsung.`)
  }

  // Tentukan polaritas klaim (apakah klaim menyatakan sesuatu ADA/BENAR atau TIDAK ADA/SALAH)
  const isNegative = /\b(?:tidak|bukan|belum|jangan|tiada|nihil|hoaks|palsu)\b/i.test(modalityInfo.coreAssertionText)
  const polarity = isNegative ? 'NEGATIVE' : 'AFFIRMATIVE'

  const primaryClaim: ClaimRecord = {
    id: `CLM-${params.articleId}-01`,
    sourceArticleId: params.articleId,
    originalText: title,
    normalizedText: modalityInfo.coreAssertionText,
    language: 'id',
    claimType,
    modality: modalityInfo.modality,
    polarity,
    attributedSpeaker: modalityInfo.attributedSpeaker,
    entities,
    extractionMethod: 'RULE_BASED',
    extractionConfidence: isLimited ? 'MEDIUM' : 'HIGH',
    sourceTextSpan: title,
    isLimitedContext: isLimited,
    reviewStatus: 'DRAFT',
    limitations,
    createdAt: nowIso,
    updatedAt: nowIso
  }

  claims.push(primaryClaim)

  // ─── 2. EKSTRAKSI KLAIM SEKUNDER JIKA ADA DESKRIPSI SUBSTANTIF ───
  if (description && description.length > 40 && description !== title) {
    // Pecah kalimat deskripsi menjadi proposisi
    const sentences = description
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 25 && s !== titleCleanText)

    let subIndex = 2
    for (const sent of sentences) {
      if (subIndex > 3) break // Batasi maksimum 3 klaim teratas per artikel untuk konservatifitas
      const subModality = detectModalityAndSpeaker(sent)
      const subType = classifyPropositionType(subModality.coreAssertionText)

      // Hanya simpan kalimat yang memang merupakan pernyataan faktual atau kutipan
      if (subType === 'FACTUAL_ASSERTION' || subType === 'OPINION' || subType === 'PREDICTION') {
        const subNegative = /\b(?:tidak|bukan|belum|tiada)\b/i.test(subModality.coreAssertionText)
        claims.push({
          id: `CLM-${params.articleId}-0${subIndex}`,
          sourceArticleId: params.articleId,
          originalText: sent,
          normalizedText: subModality.coreAssertionText,
          language: 'id',
          claimType: subType,
          modality: subModality.modality,
          polarity: subNegative ? 'NEGATIVE' : 'AFFIRMATIVE',
          attributedSpeaker: subModality.attributedSpeaker,
          entities: extractEntitiesFromText(sent),
          extractionMethod: 'RULE_BASED',
          extractionConfidence: 'MEDIUM',
          sourceTextSpan: sent,
          isLimitedContext: isLimited,
          reviewStatus: 'DRAFT',
          limitations: ['SECONDARY_SNIPPET: Diekstraksi dari kalimat pengantar/deskripsi.'],
          createdAt: nowIso,
          updatedAt: nowIso
        })
        subIndex++
      }
    }
  }

  return claims
}
