import type { DebunkKnowledgeEntry } from '../../types.ts'
import { registerLiveDebunks, getCuratedArchiveDebunks } from './debunk-service.ts'
import { 
  cleanHtmlText, 
  parseTurnBackHoaxRss, 
  parseGoogleNewsRss, 
  parseGoogleTrendsRss
} from '../ingest/rss-parser.ts'
import { cacheRadarItems, getCachedRadarItems } from '../../utils/db-adapter.ts'
import { scoreAndTriageRadarEntries } from '../radar/early-warning-scorer.ts'

export interface TurnBackHoaxPost {
  id: number
  date: string
  title: { rendered: string }
  excerpt: { rendered: string }
  content?: { rendered: string }
  link: string
}

export interface LiveRadarFetchResult {
  entries: DebunkKnowledgeEntry[]
  isLive: boolean
  sourceChannel: 'API_PROXY' | 'API_DIRECT' | 'API_CORS_PROXY' | 'LOCAL_ARCHIVE'
  latencyMs: number
  fetchedAt: number
  errorMessage?: string
}

/**
 * Backward compatibility cleanHtml helper
 */
export function cleanHtml(html: string): string {
  return cleanHtmlText(html)
}

/**
 * Helper resilien untuk menarik XML feed dengan 3 lapis fallback:
 * Lapis 1: Local Vite Proxy (bebas CORS saat npm run dev di browser)
 * Lapis 2: Direct Fetch (bebas CORS saat di Electron desktop)
 * Lapis 3: Public CORS Bridge (api.allorigins.win)
 */
async function fetchXmlWithFallback(
  proxyUrl: string, 
  directUrl: string, 
  timeoutMs = 4500
): Promise<{ xml: string; channel: 'API_PROXY' | 'API_DIRECT' | 'API_CORS_PROXY' } | null> {
  // Lapis 1: Coba Local Vite Proxy
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(proxyUrl, {
      signal: controller.signal,
      headers: { 'Accept': 'application/rss+xml, application/xml, text/xml, */*' }
    })
    clearTimeout(timer)
    if (res.ok) {
      const text = await res.text()
      if (text.includes('<item>')) {
        return { xml: text, channel: 'API_PROXY' }
      }
    }
  } catch {
    // Lanjut ke Lapis 2
  }

  // Lapis 2: Coba Direct Fetch (Electron / Node)
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(directUrl, {
      signal: controller.signal,
      headers: { 
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NARADA/1.0'
      }
    })
    clearTimeout(timer)
    if (res.ok) {
      const text = await res.text()
      if (text.includes('<item>')) {
        return { xml: text, channel: 'API_DIRECT' }
      }
    }
  } catch {
    // Lanjut ke Lapis 3
  }

  // Lapis 3: Public CORS Proxy Bridge
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs + 1500)
    const bridgeUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`
    const res = await fetch(bridgeUrl, { signal: controller.signal })
    clearTimeout(timer)
    if (res.ok) {
      const text = await res.text()
      if (text.includes('<item>')) {
        return { xml: text, channel: 'API_CORS_PROXY' }
      }
    }
  } catch {
    // Semua saluran gagal
  }

  return null
}

/**
 * Multi-Channel Live Ingestion Engine:
 * 1. Feed TurnBackHoax (Klarifikasi Hoaks Terkini dengan Canonical URLs)
 * 2. Feed Google News Hankam (Berita Panas TNI, Papua, Alutsista Real-Time)
 * 3. Feed Google Trends ID (Lonjakan Isu Pencarian Publik / Early Warning)
 */
export async function fetchLiveRadarDebunks(): Promise<LiveRadarFetchResult> {
  const startTime = Date.now()

  try {
    // Eksekusi penarikan 5 stream secara paralel (Hankam, Aksi Massa/Demo, Kontroversi, TBH, Trends)
    const [tbhResult, newsHankamResult, newsDemoResult, newsPolitikResult, trendsResult] = await Promise.allSettled([
      fetchXmlWithFallback(
        '/api/rss/turnbackhoax',
        'https://turnbackhoax.id/feed/',
        4500
      ),
      fetchXmlWithFallback(
        '/api/rss/google-news/search?q=(TNI+OR+alutsista+OR+Papua+OR+KKB+OR+Ambalat+OR+kapal+perang)+AND+(viral+OR+heboh+OR+polemik+OR+kontroversi+OR+hoaks)+when:2d&hl=id&gl=ID&ceid=ID:id',
        'https://news.google.com/rss/search?q=(TNI+OR+alutsista+OR+Papua+OR+KKB+OR+Ambalat+OR+kapal+perang)+AND+(viral+OR+heboh+OR+polemik+OR+kontroversi+OR+hoaks)+when:2d&hl=id&gl=ID&ceid=ID:id',
        4500
      ),
      fetchXmlWithFallback(
        '/api/rss/google-news/search?q=(demo+OR+unjuk+rasa+OR+bentrok+OR+ricuh+OR+mahasiswa+OR+pemakzulan)+when:1d&hl=id&gl=ID&ceid=ID:id',
        'https://news.google.com/rss/search?q=(demo+OR+unjuk+rasa+OR+bentrok+OR+ricuh+OR+mahasiswa+OR+pemakzulan)+when:1d&hl=id&gl=ID&ceid=ID:id',
        4500
      ),
      fetchXmlWithFallback(
        '/api/rss/google-news/search?q=(Prabowo+OR+Gibran+OR+bansos+OR+MBG+OR+ijazah+OR+KPK)+AND+(viral+OR+heboh+OR+polemik+OR+sidang)+when:1d&hl=id&gl=ID&ceid=ID:id',
        'https://news.google.com/rss/search?q=(Prabowo+OR+Gibran+OR+bansos+OR+MBG+OR+ijazah+OR+KPK)+AND+(viral+OR+heboh+OR+polemik+OR+sidang)+when:1d&hl=id&gl=ID&ceid=ID:id',
        4500
      ),
      fetchXmlWithFallback(
        '/api/rss/google-trends',
        'https://trends.google.com/trending/rss?geo=ID',
        4000
      )
    ])

    const allEntries: DebunkKnowledgeEntry[] = []
    let detectedChannel: 'API_PROXY' | 'API_DIRECT' | 'API_CORS_PROXY' = 'API_PROXY'

    // 1. Ingest TurnBackHoax (Klarifikasi Terkini & Canonical URLs)
    if (tbhResult.status === 'fulfilled' && tbhResult.value) {
      const parsed = parseTurnBackHoaxRss(tbhResult.value.xml)
      allEntries.push(...parsed)
      detectedChannel = tbhResult.value.channel
    }

    // 2. Ingest Google News Hankam & Geopolitik
    if (newsHankamResult.status === 'fulfilled' && newsHankamResult.value) {
      const parsed = parseGoogleNewsRss(newsHankamResult.value.xml)
      allEntries.push(...parsed.slice(0, 8))
      if (detectedChannel !== 'API_DIRECT') detectedChannel = newsHankamResult.value.channel
    }

    // 3. Ingest Google News Aksi Massa & Demo Hari Ini (<24 Jam)
    if (newsDemoResult.status === 'fulfilled' && newsDemoResult.value) {
      const parsed = parseGoogleNewsRss(newsDemoResult.value.xml)
      allEntries.push(...parsed.slice(0, 8))
      if (detectedChannel !== 'API_DIRECT') detectedChannel = newsDemoResult.value.channel
    }

    // 4. Ingest Google News Kontroversi Nasional (<24 Jam)
    if (newsPolitikResult.status === 'fulfilled' && newsPolitikResult.value) {
      const parsed = parseGoogleNewsRss(newsPolitikResult.value.xml)
      allEntries.push(...parsed.slice(0, 8))
      if (detectedChannel !== 'API_DIRECT') detectedChannel = newsPolitikResult.value.channel
    }

    // 5. Ingest Google Trends ID (Tersaring dari Noise Sepakbola Asing)
    if (trendsResult.status === 'fulfilled' && trendsResult.value) {
      const parsed = parseGoogleTrendsRss(trendsResult.value.xml)
      allEntries.push(...parsed.slice(0, 6))
    }

    if (allEntries.length > 0) {
      // Jalankan Mesin Scoring & Triage Otomatis Early Warning
      const knownDebunks = getCuratedArchiveDebunks()
      const triagedEntries = scoreAndTriageRadarEntries(allEntries, knownDebunks)

      // Injeksi ke basis data in-memory aktif
      registerLiveDebunks(triagedEntries)

      // Simpan ke cache lokal IndexedDB secara asinkron
      try {
        await cacheRadarItems(triagedEntries)
      } catch (e) {
        console.warn('[LiveRadarService] Gagal menyimpan ke cache IndexedDB:', e)
      }

      return {
        entries: triagedEntries,
        isLive: true,
        sourceChannel: detectedChannel,
        latencyMs: Date.now() - startTime,
        fetchedAt: Date.now()
      }
    }
  } catch (err) {
    console.error('[LiveRadarService] Kesalahan saat penarikan multi-feed live:', err)
  }

  // Jika koneksi internet putus / gagal total, coba ambil dari cache lokal IndexedDB
  try {
    const cached = await getCachedRadarItems()
    if (cached && cached.length > 0) {
      return {
        entries: cached,
        isLive: false,
        sourceChannel: 'LOCAL_ARCHIVE',
        latencyMs: Date.now() - startTime,
        fetchedAt: Date.now(),
        errorMessage: 'Koneksi jaringan terputus. Menampilkan data cache lokal tersimpan.'
      }
    }
  } catch {
    // Lewati jika indexedDB gagal
  }

  // Fallback Terakhir: Basis Pengetahuan Kurasi Lokal
  const localArchive = getCuratedArchiveDebunks()
  return {
    entries: localArchive,
    isLive: false,
    sourceChannel: 'LOCAL_ARCHIVE',
    latencyMs: Date.now() - startTime,
    fetchedAt: Date.now(),
    errorMessage: 'Koneksi live feed tidak dapat dijangkau. Beralih ke pangkalan data taktis offline.'
  }
}
