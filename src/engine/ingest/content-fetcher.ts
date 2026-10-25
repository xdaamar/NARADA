/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA RESILIENT CONTENT FETCHER: MULTI-TIER OSINT INGESTION PIPELINE
 * PUSSIBERAD TNI AD × CODEPOLITAN — KARTIKA CYBER HACKATHON 2026
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Pipeline Ekstraksi 5-Tier:
 * Tier 1: Electron Native IPC (Bebas Batasan CORS)
 * Tier 2: Direct Browser Fetch (Timeout 3.500 ms)
 * Tier 3: High-Resilience Public CORS Proxies (allorigins.win / corsproxy.io)
 * Tier 4: Mozilla Readability DOM Extraction
 * Tier 5: Air-Gap Fallback & Demo Sample Injection
 * ══════════════════════════════════════════════════════════════════════════
 */

import { Readability } from '@mozilla/readability'
import type { URLAnalysisInput } from '../../types'

export type IngestionTier =
  | 'ELECTRON_IPC'
  | 'DIRECT_FETCH'
  | 'CORS_PROXY_ALLORIGINS'
  | 'CORS_PROXY_CORSIO'
  | 'AIRGAP_DEMO_FALLBACK'

export interface ArticleFetchResult {
  data: URLAnalysisInput
  tierUsed: IngestionTier
  latencyMs: number
  htmlLength: number
  isAirGapFallback: boolean
  warning?: string
}

// Demo samples jika sistem dalam mode air-gap terisolasi
const AIRGAP_SAMPLE_ARTICLES: Record<string, Partial<URLAnalysisInput>> = {
  detik: {
    title: 'Kemhan Buka Suara Terkait Beredarnya Dokumen Pembelian Alutsista Fiktif Senilai Rp 24 Triliun',
    siteName: 'Detik News',
    author: 'Tim Investigasi Cyber',
    content: `Kementerian Pertahanan (Kemhan) RI menegaskan bahwa selebaran dan berkas digital mengenai dugaan pengadaan sistem radar dan alutsista fiktif senilai Rp 24 triliun yang beredar di media sosial adalah dokumen palsu hasil rekayasa.
Kepala Biro Humas Setjen Kemhan menyatakan pihak intelijen siber telah mendeteksi penyebaran narasi ini bersumber dari jaringan akun anonim luar negeri yang berupaya merusak citra modernisasi pertahanan nasional.
"Kami pastikan tidak ada tender pengadaan seperti yang tertera pada lembaran viral tersebut. Format dokumen dan nomor registrasi satuan fiktif dan tidak sesuai tata naskah dinas militer," ujarnya dalam keterangan pers di Jakarta.
Masyarakat diimbau tidak terprovokasi dan menyebarkan konten disinformasi yang berpotensi memecah belah stabilitas keamanan nasional. Kemhan bersama Pussiberad TNI AD terus mengusut aktor intelektual di balik peredaran dokumen tersebut.`,
  },
  tempo: {
    title: 'TNI AD Bantah Klaim KKB Soal Penguasaan Pos Teritorial di Puncak Jaya',
    siteName: 'Tempo Nasional',
    author: 'Arya Wardhana',
    content: `Komando Daerah Militer XVII/Cenderawasih membantah keras klaim yang dipublikasikan oleh juru bicara kelompok separatis bersenjata melalui video dan pamflet digital mengenai perebutan pos keamanan teritorial di Kabupaten Puncak Jaya.
Pangdam menegaskan kondisi seluruh pos TNI AD di wilayah perbatasan dan pedalaman tetap dalam kendali penuh prajurit dan situasi masyarakat berlangsung aman terkendali.
"Klaim mereka hanyalah propaganda murahan di media sosial untuk mencari perhatian internasional dan donasi gelap. Seluruh personel kami tetap bersiaga mengamankan warga dari intimidasi teror," tegas Kapendam dalam siaran resminya.
Pussiberad TNI AD mencatat lonjakan aktivitas bot yang mengamplifikasi cuplikan video editan lawas dari tahun 2019 seolah-olah terjadi kontak senjata baru kemarin.`,
  },
}

/**
 * Ekstraksi konten bersih dari HTML mentah menggunakan Mozilla Readability
 */
export function extractContentWithReadability(
  htmlText: string,
  targetUrl: string
): URLAnalysisInput {
  const parser = new DOMParser()
  const doc = parser.parseFromString(htmlText, 'text/html')

  let hostName = 'Portal Berita'
  try {
    hostName = new URL(targetUrl).hostname.replace(/^www\./, '')
  } catch {
    // Abaikan error format URL
  }

  const reader = new Readability(doc)
  const article = reader.parse()

  const rawTitle = article?.title || doc.querySelector('title')?.textContent || 'Artikel Berita'
  const cleanContent = article?.textContent
    ? article.textContent.trim()
    : (doc.body?.textContent || '').trim()

  const excerpt = article?.excerpt || cleanContent.substring(0, 200) + '...'
  const author = article?.byline || null
  const siteName = article?.siteName || hostName

  return {
    url: targetUrl,
    title: rawTitle.trim(),
    content: cleanContent,
    author: author ? author.trim() : null,
    siteName: siteName.trim(),
    excerpt: excerpt.trim(),
    fetchedAt: Date.now(),
  }
}

/**
 * Fetcher multi-tier tangguh: Mencoba berurutan dari IPC Desktop, Direct HTTP, hingga Proxy CORS
 */
export async function fetchArticleContent(
  targetUrl: string,
  timeoutMs: number = 4000
): Promise<ArticleFetchResult> {
  const startTime = performance.now()

  // ─── TIER 1: ELECTRON NATIVE IPC ───
  try {
    const electronAPI = (window as unknown as { electronAPI?: { netRequest?: (url: string) => Promise<string> } })
      ?.electronAPI
    if (electronAPI && typeof electronAPI.netRequest === 'function') {
      const html = await electronAPI.netRequest(targetUrl)
      if (html && html.length > 200) {
        const article = extractContentWithReadability(html, targetUrl)
        return {
          data: article,
          tierUsed: 'ELECTRON_IPC',
          latencyMs: Math.round(performance.now() - startTime),
          htmlLength: html.length,
          isAirGapFallback: false,
        }
      }
    }
  } catch (err) {
    console.warn('[ContentFetcher] Tier 1 Electron IPC dilewati:', err)
  }

  // ─── TIER 2: DIRECT BROWSER FETCH ───
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(targetUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
    clearTimeout(timer)

    if (response.ok) {
      const html = await response.text()
      if (html && html.length > 200) {
        const article = extractContentWithReadability(html, targetUrl)
        return {
          data: article,
          tierUsed: 'DIRECT_FETCH',
          latencyMs: Math.round(performance.now() - startTime),
          htmlLength: html.length,
          isAirGapFallback: false,
        }
      }
    }
  } catch (err) {
    console.warn('[ContentFetcher] Tier 2 Direct Fetch diblokir CORS/Timeout:', err)
  }

  // ─── TIER 3A: CORS PROXY ALLORIGINS ───
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs + 2000)

    const response = await fetch(proxyUrl, {
      method: 'GET',
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (response.ok) {
      const html = await response.text()
      if (html && html.length > 200) {
        const article = extractContentWithReadability(html, targetUrl)
        return {
          data: article,
          tierUsed: 'CORS_PROXY_ALLORIGINS',
          latencyMs: Math.round(performance.now() - startTime),
          htmlLength: html.length,
          isAirGapFallback: false,
        }
      }
    }
  } catch (err) {
    console.warn('[ContentFetcher] Tier 3A AllOrigins proxy gagal:', err)
  }

  // ─── TIER 3B: CORS PROXY CORSPROXY.IO ───
  try {
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs + 2000)

    const response = await fetch(proxyUrl, {
      method: 'GET',
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (response.ok) {
      const html = await response.text()
      if (html && html.length > 200) {
        const article = extractContentWithReadability(html, targetUrl)
        return {
          data: article,
          tierUsed: 'CORS_PROXY_CORSIO',
          latencyMs: Math.round(performance.now() - startTime),
          htmlLength: html.length,
          isAirGapFallback: false,
        }
      }
    }
  } catch (err) {
    console.warn('[ContentFetcher] Tier 3B CorsProxy.io gagal:', err)
  }

  // ─── TIER 5: AIR-GAP FALLBACK ───
  // Jika seluruh koneksi luar terputus, cari apakah url cocok dengan sampel lokal
  const lowerUrl = targetUrl.toLowerCase()
  let matchedSample: Partial<URLAnalysisInput> | null = null

  if (lowerUrl.includes('detik')) {
    matchedSample = AIRGAP_SAMPLE_ARTICLES.detik
  } else if (lowerUrl.includes('tempo')) {
    matchedSample = AIRGAP_SAMPLE_ARTICLES.tempo
  }

  const hostName = (() => {
    try {
      return new URL(targetUrl).hostname.replace(/^www\./, '')
    } catch {
      return 'Portal Berita'
    }
  })()

  const fallbackData: URLAnalysisInput = {
    url: targetUrl,
    title: matchedSample?.title || `Laporan Terisolasi (${hostName})`,
    content:
      matchedSample?.content ||
      `Perhatian: Koneksi jaringan terisolasi (Air-Gap) atau URL dilindungi keamanan tinggi (CORS Strict). Silakan gunakan tombol salin teks atau masukkan teks berita secara langsung pada kolom koreksi taktis.`,
    author: matchedSample?.author || 'Analis PUSSIBERAD',
    siteName: matchedSample?.siteName || hostName,
    excerpt: matchedSample?.title || 'Konten berita mode isolasi taktis.',
    fetchedAt: Date.now(),
  }

  return {
    data: fallbackData,
    tierUsed: 'AIRGAP_DEMO_FALLBACK',
    latencyMs: Math.round(performance.now() - startTime),
    htmlLength: 0,
    isAirGapFallback: true,
    warning: 'Koneksi eksternal terhalang batasan CORS browser. Mengaktifkan mode isolasi taktis.',
  }
}
