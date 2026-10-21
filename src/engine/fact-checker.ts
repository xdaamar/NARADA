// ─── FACT-CHECK CLIENT (GOOGLE FACT CHECK API + MAFINDO) ───
// Berdasarkan PRD_03_fact_checker.md

import type { FactCheckClaim, FactCheckResult } from '../types'
import { getUserSettings } from '../utils/storage'
import { tokenizeIndonesian } from './ml/tokenizer'

interface GoogleClaimReview {
  publisher?: {
    name?: string
    site?: string
  }
  url?: string
  title?: string
  textualRating?: string
  reviewDate?: string
}

interface GoogleClaimItem {
  text?: string
  claimant?: string
  claimDate?: string
  claimReview?: GoogleClaimReview[]
}

interface GoogleFactCheckApiResponse {
  claims?: GoogleClaimItem[]
}

/**
 * Menentukan warna badge status kebenaran berdasarkan teks rating
 */
function resolveRatingColor(ratingText: string): string {
  const normalized = (ratingText || '').toLowerCase()

  if (
    normalized.includes('salah') ||
    normalized.includes('hoaks') ||
    normalized.includes('hoax') ||
    normalized.includes('palsu') ||
    normalized.includes('keliru') ||
    normalized.includes('false')
  ) {
    return '#EF4444' // Merah
  }

  if (
    normalized.includes('menyesatkan') ||
    normalized.includes('misleading') ||
    normalized.includes('disinformasi') ||
    normalized.includes('sebagian') ||
    normalized.includes('konteks') ||
    normalized.includes('manipulasi')
  ) {
    return '#F59E0B' // Kuning / Oranye
  }

  if (
    normalized.includes('benar') ||
    normalized.includes('fakta') ||
    normalized.includes('true')
  ) {
    return '#22C55E' // Hijau
  }

  return '#94A3B8' // Abu-abu default
}

/**
 * Mengekstrak query pencarian klaim dari teks input (mengambil 3-6 kata kunci utama)
 */
export function extractClaimQuery(text: string): string {
  if (!text) return ''

  // Ambil kalimat pertama atau 100 karakter pertama
  const firstSentence = text.split(/[.\n!?]/)[0] || text
  const tokens = tokenizeIndonesian(firstSentence, false)

  if (tokens.length === 0) {
    return text.substring(0, 50).trim()
  }

  // Batasi query hingga 5 kata kunci terpenting agar pencarian API presisi
  return tokens.slice(0, 5).join(' ')
}

/**
 * Menjalankan cross-reference ke Google Fact Check Tools API (Mafindo, Tempo CekFakta, dll.)
 * @param text - Teks konten yang dianalisis
 * @param overrideApiKey - Opsional API key untuk testing/override
 */
export async function verifyFactCheck(text: string, overrideApiKey?: string): Promise<FactCheckResult> {
  const query = extractClaimQuery(text)
  const settings = getUserSettings()
  const apiKey = overrideApiKey || settings.googleFactCheckApiKey

  const manualSearchUrl = `https://search.turnbackhoax.id/?q=${encodeURIComponent(query)}`
  const explorerUrl = `https://toolbox.google.com/factcheck/explorer/search/${encodeURIComponent(query)};hl=id`

  // Jika aplikasi dalam mode offline paksa atau tidak ada query
  if (settings.offlineMode || !query) {
    return {
      available: false,
      query,
      claims: [],
      manualSearchUrl,
      explorerUrl,
      checkedAt: Date.now(),
    }
  }

  // Jika tanpa API key, arahkan user ke link manual TurnBackHoax & Google Explorer
  if (!apiKey) {
    return {
      available: true,
      query,
      claims: [],
      manualSearchUrl,
      explorerUrl,
      checkedAt: Date.now(),
    }
  }

  try {
    const endpoint = `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(query)}&languageCode=id&pageSize=4&key=${apiKey}`
    const response = await fetch(endpoint)

    if (!response.ok) {
      console.warn(`[NARADA FactCheck] API responded with status ${response.status}`)
      return {
        available: true,
        query,
        claims: [],
        manualSearchUrl,
        explorerUrl,
        checkedAt: Date.now(),
      }
    }

    const data = (await response.json()) as GoogleFactCheckApiResponse
    const rawClaims = data.claims || []
    const mappedClaims: FactCheckClaim[] = []

    for (const item of rawClaims) {
      const claimText = item.text || 'Klaim tidak spesifik'
      const claimant = item.claimant || 'Media Sosial'

      if (item.claimReview && item.claimReview.length > 0) {
        for (const review of item.claimReview) {
          mappedClaims.push({
            claimText,
            claimant,
            publisherName: review.publisher?.name || 'Cek Fakta Independen',
            publisherSite: review.publisher?.site || 'turnbackhoax.id',
            articleUrl: review.url || manualSearchUrl,
            articleTitle: review.title || claimText,
            rating: review.textualRating || 'Diperiksa',
            ratingColor: resolveRatingColor(review.textualRating || ''),
            reviewDate: review.reviewDate,
          })
        }
      }
    }

    return {
      available: true,
      query,
      claims: mappedClaims,
      manualSearchUrl,
      explorerUrl,
      checkedAt: Date.now(),
    }
  } catch (error) {
    console.error('[NARADA FactCheck] Request gagal (kemungkinan offline atau CORS):', error)
    return {
      available: false,
      query,
      claims: [],
      manualSearchUrl,
      explorerUrl,
      checkedAt: Date.now(),
    }
  }
}
