// ─── FACT-CHECK CLIENT (TURNBACKHOAX.ID REST API + LOCAL DEBUNK DATABASE FALLBACK) ───
// Berdasarkan Master Sprint 4A: Dual-Spectrum Cognitive Reasoning Engine

import type { FactCheckClaim, FactCheckResult } from '../types'
import { getUserSettings } from '../utils/storage'
import { searchLocalDebunk } from './data/debunk-service'

interface TurnBackHoaxPost {
  id: number
  date: string
  link: string
  title: {
    rendered: string
  }
  excerpt?: {
    rendered: string
  }
}

/**
 * Menentukan warna badge status kebenaran berdasarkan teks rating
 */
export function resolveRatingColor(ratingText: string): string {
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
    normalized.includes('manipulasi') ||
    normalized.includes('propaganda')
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
 * Pembersih HTML string sederhana dari respons WordPress
 */
function cleanHtml(html: string): string {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Mengekstrak kata kunci pencarian yang relevan untuk query Fact-Check
 */
export function extractClaimQuery(text: string): string {
  if (!text) return ''

  // Hapus karakter prefix seperti [SALAH], [HOAKS] jika ada pada teks OCR
  const cleanPrefix = text.replace(/^\[(salah|hoaks|disinformasi|klarifikasi)\]/i, '').trim()
  const firstSentence = cleanPrefix.split(/[.\n!?]/)[0] || cleanPrefix

  // Ambil kata-kata penting (panjang >= 3 huruf)
  const words = firstSentence
    .replace(/[=—|»«‘'"`~!@#$%^&*()_+={}\[\]:;<>?\/\\.,-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !['yang', 'untuk', 'dengan', 'dari', 'pada', 'atau', 'ini', 'itu', 'adalah'].includes(w.toLowerCase()))

  if (words.length === 0) {
    return cleanPrefix.substring(0, 40).trim()
  }

  return words.slice(0, 4).join(' ')
}

/**
 * Menjalankan cross-reference ke TurnBackHoax.ID WP-JSON REST API dengan fallback instan ke Local Debunk Database
 */
export async function verifyFactCheck(text: string, _overrideApiKey?: string): Promise<FactCheckResult> {
  const query = extractClaimQuery(text)
  const settings = getUserSettings()

  const manualSearchUrl = `https://turnbackhoax.id/?s=${encodeURIComponent(query)}`
  const explorerUrl = `https://toolbox.google.com/factcheck/explorer/search/${encodeURIComponent(query)};hl=id`

  // 1. Cek Basis Data Lokal Terlebih Dahulu (Offline-First / Zero Latency Guarantee)
  const localMatch = searchLocalDebunk(text)
  let localClaim: FactCheckClaim | null = null

  if (localMatch.matched && localMatch.entry) {
    const entry = localMatch.entry
    localClaim = {
      claimText: entry.claim,
      claimant: 'Media Sosial / Pesan Berantai Viral',
      publisherName: entry.officialSource,
      publisherSite: 'turnbackhoax.id',
      articleUrl: entry.sourceUrl,
      articleTitle: `[${entry.verdict}] ${entry.claim}`,
      rating: entry.verdict === 'HOAKS' ? 'Salah (Hoaks)' : entry.verdict,
      ratingColor: resolveRatingColor(entry.verdict),
      reviewDate: 'Terverifikasi Tim Narada & Mafindo',
    }
  }

  // Jika mode offline dipaksa oleh pengguna
  if (settings.offlineMode) {
    return {
      available: !!localClaim,
      query,
      claims: localClaim ? [localClaim] : [],
      manualSearchUrl,
      explorerUrl,
      checkedAt: Date.now(),
    }
  }

  // 2. Query Live REST API TurnBackHoax.ID (Bebas API Key)
  const abortController = new AbortController()
  const timeoutId = setTimeout(() => abortController.abort(), 3500) // 3.5 detik timeout

  try {
    const searchUrl = `https://turnbackhoax.id/wp-json/wp/v2/posts?search=${encodeURIComponent(query)}&per_page=4`
    const response = await fetch(searchUrl, {
      signal: abortController.signal,
      headers: {
        'Accept': 'application/json'
      }
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      const posts = (await response.json()) as TurnBackHoaxPost[]
      const liveClaims: FactCheckClaim[] = []

      if (Array.isArray(posts) && posts.length > 0) {
        for (const post of posts) {
          const rawTitle = cleanHtml(post.title?.rendered || '')
          const excerpt = cleanHtml(post.excerpt?.rendered || '')

          let rating = 'Diperiksa'
          if (rawTitle.includes('[SALAH]') || rawTitle.includes('[HOAKS]')) {
            rating = 'Salah (Hoaks)'
          } else if (rawTitle.includes('[DISINFORMASI]') || rawTitle.includes('[MANIPULASI]')) {
            rating = 'Disinformasi'
          } else if (rawTitle.includes('[KLARIFIKASI]')) {
            rating = 'Klarifikasi Fakta'
          }

          liveClaims.push({
            claimText: excerpt || rawTitle,
            claimant: 'Media Sosial / Platform Digital',
            publisherName: 'TurnBackHoax.ID (Mafindo)',
            publisherSite: 'turnbackhoax.id',
            articleUrl: post.link,
            articleTitle: rawTitle,
            rating,
            ratingColor: resolveRatingColor(rating),
            reviewDate: post.date ? new Date(post.date).toLocaleDateString('id-ID') : undefined,
          })
        }
      }

      // Gabungkan hasil live dengan hasil lokal (utamakan lokal jika kecocokan tinggi)
      const combinedClaims: FactCheckClaim[] = []
      if (localClaim) {
        combinedClaims.push(localClaim)
      }
      liveClaims.forEach(lc => {
        if (!combinedClaims.some(c => c.articleUrl === lc.articleUrl)) {
          combinedClaims.push(lc)
        }
      })

      return {
        available: combinedClaims.length > 0,
        query,
        claims: combinedClaims.slice(0, 4),
        manualSearchUrl,
        explorerUrl,
        checkedAt: Date.now(),
      }
    }
  } catch (error) {
    // Timeout atau CORS error / offline
    clearTimeout(timeoutId)
    // console.warn('[NARADA FactCheck] Live REST API fallback to local:', error)
  }

  // 3. Graceful Fallback ke Database Lokal jika Live Fetch Gagal / Timeout
  return {
    available: !!localClaim,
    query,
    claims: localClaim ? [localClaim] : [],
    manualSearchUrl,
    explorerUrl,
    checkedAt: Date.now(),
  }
}
