/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — GDELT DOC 2.0 API INGESTION ADAPTER & NORMALIZATION ENGINE
 * SPRINT 6.2: GDELT INTEGRATION & RADAR COVERAGE CLOSURE
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Prinsip Desain & Integritas Data:
 * 1. GDELT adalah Discovery Aggregator & Indexer, BUKAN primary publisher independen.
 * 2. Zero Verdict Mutation: Hasil GDELT tidak pernah menetapkan vonis FAKTA atau HOAKS.
 * 3. Strict Input Validation: Input bertipe unknown dan divalidasi defensif.
 * 4. Time Semantics Isolation: publishedAt diambil dari seendate valid; observedAt disimpan terpisah.
 * 5. Publisher Attribution: Publisher asli dipertahankan dari URL/domain berita asal.
 * 6. Malformed vs Empty Distinction: HTML error/plain text ditandai MALFORMED, bukan valid empty.
 * ══════════════════════════════════════════════════════════════════════════
 */

import type {
  NormalizedPublication,
  RadarTaxonomyDomain,
  GdeltDocApiResponseRaw
} from '../radar/radar-types.ts'
import { generateStablePublicationId } from './rss-parser.ts'
import { parseSourceDate, formatMilitaryDate, evaluateFreshness } from '../radar/freshness-engine.ts'
import {
  classifyTaxonomyDomain,
  evaluateContextRelevance,
  evaluateMetadataTransparency,
  determineReviewState
} from '../radar/radar-assessment.ts'
import { normalizeUrl, extractPublisherDomain } from '../radar/clustering-engine.ts'

export interface GdeltParseResult {
  success: boolean
  isMalformed: boolean
  errorCode?: string | null
  errorMessage?: string | null
  totalArticlesFound: number
  validArticlesCount: number
  skippedCount: number
  publications: NormalizedPublication[]
}

/**
 * Parsing seendate GDELT (format YYYYMMDDTHHMMSSZ atau YYYYMMDDHHMMSS) secara deterministik.
 * Jika tanggal tidak valid, mengembalikan timestamp null tanpa mengekstrapolasi ke Date.now().
 */
export function parseGdeltSeenDate(rawDate?: unknown): { timestamp: number | null; formatted: string } {
  if (!rawDate || typeof rawDate !== 'string') {
    return { timestamp: null, formatted: 'Waktu Publikasi Tidak Tersedia' }
  }
  const clean = rawDate.trim()
  if (!clean) {
    return { timestamp: null, formatted: 'Waktu Publikasi Tidak Tersedia' }
  }

  // Format 1: YYYYMMDDTHHMMSSZ (e.g. 20261101T040000Z)
  const m1 = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/i)
  if (m1) {
    const iso = `${m1[1]}-${m1[2]}-${m1[3]}T${m1[4]}:${m1[5]}:${m1[6]}Z`
    const ts = Date.parse(iso)
    if (!isNaN(ts)) {
      return { timestamp: ts, formatted: formatMilitaryDate(ts) }
    }
  }

  // Format 2: YYYYMMDDHHMMSS (14 digit)
  const m2 = clean.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/)
  if (m2) {
    const iso = `${m2[1]}-${m2[2]}-${m2[3]}T${m2[4]}:${m2[5]}:${m2[6]}Z`
    const ts = Date.parse(iso)
    if (!isNaN(ts)) {
      return { timestamp: ts, formatted: formatMilitaryDate(ts) }
    }
  }

  // Format 3: ISO 8601 atau RFC 2822 standar
  const parsed = parseSourceDate(clean)
  if (parsed.status === 'VALID' && parsed.timestamp !== null) {
    return { timestamp: parsed.timestamp, formatted: formatMilitaryDate(parsed.timestamp) }
  }

  return { timestamp: null, formatted: 'Waktu Publikasi Tidak Tersedia' }
}

/**
 * Validasi URL publisher artikel berita
 */
export function isValidArticleUrl(url: unknown): boolean {
  if (typeof url !== 'string' || !url.trim()) return false
  const clean = url.trim()
  if (!/^https?:\/\//i.test(clean)) return false
  try {
    const parsed = new URL(clean)
    const host = parsed.hostname.toLowerCase()
    if (!host || host === 'localhost' || host === '127.0.0.1' || host === '::1') return false
    return true
  } catch {
    return false
  }
}

/**
 * Format domain menjadi label publisher yang terbaca
 */
export function formatPublisherName(domain?: string, url?: string): string {
  if (domain && typeof domain === 'string' && domain.trim()) {
    const clean = domain.trim().toLowerCase().replace(/^www\./, '')
    // Kapitalisasi huruf pertama
    return clean.charAt(0).toUpperCase() + clean.slice(1)
  }
  if (url && typeof url === 'string') {
    const extracted = extractPublisherDomain(url)
    if (extracted) {
      return extracted.charAt(0).toUpperCase() + extracted.slice(1)
    }
  }
  return 'Pers Online'
}

/**
 * Adapter Parser Inti GDELT DOC 2.0 API Response (Sprint 6.2 WP1 / WP3)
 * Menerima payload mentah bertipe unknown, memvalidasi integritas JSON,
 * menyaring artikel cacat, dan menormalisasi ke NormalizedPublication[].
 */
export function parseGdeltDocResponse(
  rawInput: unknown,
  options?: {
    sourceId?: string
    sourceName?: string
    domainHint?: RadarTaxonomyDomain
    maxItems?: number
    dynamicSearchRunId?: string
    candidateId?: string
    observedAt?: number
  }
): GdeltParseResult {
  const sourceId = options?.sourceId || 'src-gdelt-doc-id'
  const sourceName = options?.sourceName || 'GDELT Project (DOC 2.0 API)'
  const maxItems = options?.maxItems || 50
  const observedNow = options?.observedAt || Date.now()

  // 1. Validasi Masukan Awal
  if (rawInput === null || rawInput === undefined) {
    return {
      success: false,
      isMalformed: true,
      errorCode: 'EMPTY_INPUT',
      errorMessage: 'Input GDELT kosong (null/undefined)',
      totalArticlesFound: 0,
      validArticlesCount: 0,
      skippedCount: 0,
      publications: []
    }
  }

  let parsedJson: any = null

  if (typeof rawInput === 'string') {
    const trimmed = rawInput.trim()
    if (!trimmed) {
      return {
        success: false,
        isMalformed: true,
        errorCode: 'EMPTY_RESPONSE',
        errorMessage: 'Respons GDELT berupa string kosong',
        totalArticlesFound: 0,
        validArticlesCount: 0,
        skippedCount: 0,
        publications: []
      }
    }

    // Deteksi bila upstream mengembalikan halaman HTML error atau pesan teks rate limit
    if (trimmed.startsWith('<') || trimmed.toLowerCase().includes('<html') || trimmed.toLowerCase().includes('<!doctype')) {
      return {
        success: false,
        isMalformed: true,
        errorCode: 'MALFORMED_CONTENT_NOT_JSON',
        errorMessage: 'Respons GDELT berupa dokumen HTML, bukan format JSON yang sah',
        totalArticlesFound: 0,
        validArticlesCount: 0,
        skippedCount: 0,
        publications: []
      }
    }

    if (trimmed.includes('Please limit requests') || trimmed.includes('rate limit')) {
      return {
        success: false,
        isMalformed: true,
        errorCode: 'HTTP_429_RATE_LIMITED_TEXT',
        errorMessage: 'GDELT mengembalikan pesan pembatasan laju kueri (Rate Limited)',
        totalArticlesFound: 0,
        validArticlesCount: 0,
        skippedCount: 0,
        publications: []
      }
    }

    try {
      parsedJson = JSON.parse(trimmed)
    } catch (err: any) {
      return {
        success: false,
        isMalformed: true,
        errorCode: 'INVALID_JSON_SYNTAX',
        errorMessage: `Gagal mem-parse JSON GDELT: ${err?.message || 'SyntaxError'}`,
        totalArticlesFound: 0,
        validArticlesCount: 0,
        skippedCount: 0,
        publications: []
      }
    }
  } else if (typeof rawInput === 'object') {
    parsedJson = rawInput
  } else {
    return {
      success: false,
      isMalformed: true,
      errorCode: 'UNSUPPORTED_INPUT_TYPE',
      errorMessage: `Tipe masukan tidak didukung: ${typeof rawInput}`,
      totalArticlesFound: 0,
      validArticlesCount: 0,
      skippedCount: 0,
      publications: []
    }
  }

  // 2. Evaluasi Kontrak JSON GDELT DOC API
  // Respons sah bisa berupa { articles: [...] } atau {} (hasil kosong sah)
  if (!parsedJson || typeof parsedJson !== 'object') {
    return {
      success: false,
      isMalformed: true,
      errorCode: 'MALFORMED_JSON_STRUCTURE',
      errorMessage: 'Struktur JSON GDELT bukan merupakan objek yang valid',
      totalArticlesFound: 0,
      validArticlesCount: 0,
      skippedCount: 0,
      publications: []
    }
  }

  // Kasus Valid Empty Feed: {} atau { articles: [] }
  const rawArticles = (parsedJson as GdeltDocApiResponseRaw).articles
  if (!rawArticles || !Array.isArray(rawArticles) || rawArticles.length === 0) {
    return {
      success: true,
      isMalformed: false,
      totalArticlesFound: 0,
      validArticlesCount: 0,
      skippedCount: 0,
      publications: []
    }
  }

  // 3. Normalisasi Setiap Artikel Secara Defensif
  const publications: NormalizedPublication[] = []
  const seenUrls = new Set<string>()
  let skippedCount = 0

  for (const rawArt of rawArticles) {
    if (publications.length >= maxItems) break

    // Abaikan record yang bukan objek
    if (!rawArt || typeof rawArt !== 'object') {
      skippedCount++
      continue
    }

    const title = typeof rawArt.title === 'string' ? rawArt.title.trim() : ''
    const url = typeof rawArt.url === 'string' ? rawArt.url.trim() : ''

    // Validasi field wajib: Judul minimal 3 karakter dan URL yang valid
    if (!title || title.length < 3) {
      skippedCount++
      continue
    }
    if (!isValidArticleUrl(url)) {
      skippedCount++
      continue
    }

    const canonicalUrl = normalizeUrl(url) || url
    if (seenUrls.has(canonicalUrl)) {
      skippedCount++
      continue
    }
    seenUrls.add(canonicalUrl)

    // Ekstraksi Waktu Penerbitan
    const dateParsed = parseGdeltSeenDate(rawArt.seendate)
    const pubTimestamp = dateParsed.timestamp
    const pubFormatted = dateParsed.formatted

    // Ekstraksi Publisher Asal (Bukan GDELT)
    const publisherDomain = rawArt.domain && typeof rawArt.domain === 'string'
      ? rawArt.domain.trim()
      : extractPublisherDomain(canonicalUrl)
    const publisher = formatPublisherName(publisherDomain, canonicalUrl)

    // Klasifikasi Taksonomi 7 Domain
    const domain = options?.domainHint || classifyTaxonomyDomain(title, '', 'NATIONAL_POLICY')

    // Evaluasi Penilaian Multidimensi
    const freshness = evaluateFreshness(pubTimestamp)
    const relevance = evaluateContextRelevance(title, '', 'POLITIK_NEGARA', 'aggregator')
    const transparency = evaluateMetadataTransparency(url, canonicalUrl, publisher, pubTimestamp)
    const reviewState = determineReviewState(freshness, relevance, transparency, 'aggregator')

    const id = generateStablePublicationId(canonicalUrl)

    const pub: NormalizedPublication = {
      id,
      sourceId,
      sourceType: 'aggregator',
      sourceName,
      title,
      originalUrl: url,
      canonicalUrl,
      excerpt: typeof rawArt.language === 'string' ? `[Bahasa: ${rawArt.language}] ${title}` : title,
      publisher,
      publishedAt: pubTimestamp,
      publishedAtFormatted: pubFormatted,
      firstObservedAt: observedNow,
      observedAt: observedNow,
      retrievedAt: observedNow,
      lastVerifiedAt: null,
      extractionMethod: 'gdelt_doc',
      category: 'POLITIK_NEGARA',
      domain,
      topicTags: [domain, rawArt.language ? String(rawArt.language) : 'id'].filter(Boolean),
      language: typeof rawArt.language === 'string' ? rawArt.language.toLowerCase() : 'id',
      contentFingerprint: id,
      attribution: `GDELT Project DOC 2.0 API • ${publisher}`,
      freshness,
      contextRelevance: relevance,
      metadataTransparency: transparency,
      reviewState,
      verdict: 'UNVERIFIED', // GDELT tidak pernah menetapkan kebenaran/hoaks
      queueState: 'MONITOR',
      isSocialViralityMeasured: false,
      dynamicSearchRunId: options?.dynamicSearchRunId,
      candidateId: options?.candidateId,
      provenanceSources: [sourceId],
      sourceObservations: [
        {
          sourceId,
          observedAt: observedNow,
          sourceKind: 'AGGREGATOR_DOC_API'
        }
      ]
    }

    publications.push(pub)
  }

  return {
    success: true,
    isMalformed: false,
    totalArticlesFound: rawArticles.length,
    validArticlesCount: publications.length,
    skippedCount,
    publications
  }
}
