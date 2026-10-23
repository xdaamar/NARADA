import type { DebunkKnowledgeEntry, ThreatSpectrumCluster } from '../../types'
import { registerLiveDebunks, getCuratedArchiveDebunks } from './debunk-service'

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
 * Membersihkan kode HTML dan HTML entities dari string
 */
export function cleanHtml(html: string): string {
  if (!html) return ''
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8230;/g, '...')
    .replace(/&#038;/g, '&')
    .replace(/&#8211;/g, '-')
    .replace(/&#8212;/g, '—')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Ekstraksi intisari penjelasan/fakta sebenarnya dari artikel TurnBackHoax
 */
function extractClarificationFact(rawContent: string, rawExcerpt: string): string {
  const text = cleanHtml(rawContent || rawExcerpt)
  if (!text) return 'Klarifikasi resmi belum tersedia; konten telah ditandai hoaks oleh Mafindo.'

  // Cari batas penjelasan fakta
  const match = text.match(/(?:FAKTANYA|PENJELASAN|HASIL CEK FAKTA|KLARIFIKASI)[:\s]+([^]+?)(?:RUJUKAN|SUMBER|REFERENSI|$)/i)
  let factSnippet = ''

  if (match && match[1]) {
    factSnippet = match[1].trim()
  } else {
    factSnippet = text
  }

  // Bersihkan dan batasi maksimal 280 karakter
  if (factSnippet.length > 280) {
    const cut = factSnippet.substring(0, 280)
    const lastPeriod = cut.lastIndexOf('.')
    if (lastPeriod > 100) {
      factSnippet = cut.substring(0, lastPeriod + 1)
    } else {
      factSnippet = cut + '...'
    }
  }

  return factSnippet
}

/**
 * Ekstraksi lembaga atau institusi resmi yang menjadi rujukan verifikasi
 */
function extractOfficialSource(text: string): string {
  const norm = text.toUpperCase()
  if (norm.includes('BMKG')) return 'BMKG (Badan Meteorologi Klimatologi Geofisika)'
  if (norm.includes('BNPB')) return 'BNPB (Badan Nasional Penanggulangan Bencana)'
  if (norm.includes('SETWAPRES') || norm.includes('WAKIL PRESIDEN')) return 'Setwapres RI'
  if (norm.includes('KEMENSOS') || norm.includes('KEMENTERIAN SOSIAL')) return 'Kementerian Sosial RI'
  if (norm.includes('BPOM')) return 'Badan Pengawas Obat dan Makanan (BPOM)'
  if (norm.includes('KEMENKES')) return 'Kementerian Kesehatan RI'
  if (norm.includes('KEMHAN') || norm.includes('KEMENTERIAN PERTAHANAN')) return 'Kementerian Pertahanan RI'
  if (norm.includes('TNI AD') || norm.includes('DISPENAD') || norm.includes('PUSSIBERAD')) return 'Dispenad / Pussiberad TNI AD'
  if (norm.includes('POLRI') || norm.includes('DIVHUMAS')) return 'Divhumas Polri'
  if (norm.includes('KOMINFO') || norm.includes('BSSN')) return 'Kementerian Kominfo / BSSN'
  if (norm.includes('PERTAMINA')) return 'PT Pertamina (Persero)'
  if (norm.includes('KPU')) return 'Komisi Pemilihan Umum (KPU)'

  return 'TurnBackHoax.ID (Mafindo)'
}

/**
 * Mengelompokkan isu ke dalam salah satu dari 5 Klaster Spektrum Nasional
 */
function classifyClusterFromText(title: string, content: string): ThreatSpectrumCluster {
  const norm = (title + ' ' + content).toLowerCase()

  // 1. Klaster Bencana
  if (
    norm.includes('gempa') ||
    norm.includes('tsunami') ||
    norm.includes('megathrust') ||
    norm.includes('katulampa') ||
    norm.includes('bendung') ||
    norm.includes('merapi') ||
    norm.includes('erupsi') ||
    norm.includes('banjir') ||
    norm.includes('bmkg') ||
    norm.includes('bnpb')
  ) {
    return 'BENCANA_DARURAT'
  }

  // 2. Klaster Penipuan & Phishing
  if (
    norm.includes('bansos') ||
    norm.includes('blt') ||
    norm.includes('kemensos') ||
    norm.includes('bit.ly') ||
    norm.includes('s.id') ||
    norm.includes('kuota') ||
    norm.includes('apk') ||
    norm.includes('tilang') ||
    norm.includes('loker') ||
    norm.includes('pertamina') ||
    norm.includes('penipuan') ||
    norm.includes('undian')
  ) {
    return 'PENIPUAN_BANSOS'
  }

  // 3. Klaster Kesehatan & Pangan
  if (
    norm.includes('beras plastik') ||
    norm.includes('vaksin') ||
    norm.includes('penculikan anak') ||
    norm.includes('obat sirup') ||
    norm.includes('racun') ||
    norm.includes('telur palsu') ||
    norm.includes('bpom') ||
    norm.includes('kemenkes')
  ) {
    return 'KESEHATAN_PANGAN'
  }

  // 4. Klaster Kedaulatan & Alutsista Militer
  if (
    norm.includes('tni') ||
    norm.includes('alutsista') ||
    norm.includes('kemhan') ||
    norm.includes('kopassus') ||
    norm.includes('kodim') ||
    norm.includes('papua') ||
    norm.includes('opm') ||
    norm.includes('kkb') ||
    norm.includes('natuna') ||
    norm.includes('pangkalan militer') ||
    norm.includes('senjata')
  ) {
    return 'KEDAULATAN_MILITER'
  }

  // 5. Default: Politik Negara
  return 'POLITIK_NEGARA'
}

/**
 * Parser semantik IFCN TurnBackHoax ke format internal DebunkKnowledgeEntry
 */
export function parseTurnBackHoaxPost(post: TurnBackHoaxPost): DebunkKnowledgeEntry {
  const rawTitle = cleanHtml(post.title?.rendered || '')
  const rawExcerpt = cleanHtml(post.excerpt?.rendered || '')
  const rawContent = cleanHtml(post.content?.rendered || '')

  // 1. Tentukan vonis
  let verdict: 'HOAKS' | 'DISINFORMASI' | 'PROPAGANDA' = 'HOAKS'
  if (rawTitle.includes('[DISINFORMASI]') || rawTitle.includes('[MANIPULASI]') || rawTitle.includes('[MISLEADING]')) {
    verdict = 'DISINFORMASI'
  } else if (rawTitle.includes('[PROPAGANDA]')) {
    verdict = 'PROPAGANDA'
  }

  // 2. Bersihkan judul dari tag prefix
  const cleanClaim = rawTitle
    .replace(/^\[(SALAH|HOAKS|DISINFORMASI|PENIPUAN|KLARIFIKASI|MANIPULASI|MISLEADING)\]\s*/i, '')
    .replace(/^["'“]/, '')
    .replace(/["'”]$/, '')
    .trim()

  // 3. Ekstraksi fakta sebenarnya & rujukan
  const clarification = extractClarificationFact(rawContent, rawExcerpt)
  const officialSource = extractOfficialSource(rawTitle + ' ' + rawContent)
  const cluster = classifyClusterFromText(rawTitle, rawContent)

  // 4. Ekstraksi kata kunci
  const keywords = cleanClaim
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 3)
    .slice(0, 8)

  return {
    id: `TBH-LIVE-${post.id}`,
    claim: cleanClaim,
    normalizedQuery: cleanClaim.toLowerCase(),
    cluster,
    verdict,
    threatLevel: 'critical',
    clarification,
    officialSource,
    sourceUrl: post.link || 'https://turnbackhoax.id',
    keywords,
    tacticalResponseCivilian: `Informasi mengenai "${cleanClaim}" adalah ${verdict}. Rujukan resmi dari ${officialSource} menegaskan: ${clarification}`,
    tacticalResponseMilitary: `Atensi Personel Jajaran: Isu terkonfirmasi ${verdict} oleh Mafindo dan ${officialSource}. Segera sebar narasi penyeimbang teritorial.`,
    isLive: true,
    publishedDate: post.date,
  }
}

/**
 * Multi-Channel Live Ingestion Pipeline
 * Kanal 1 (Vite Proxy) -> Kanal 2 (Direct API) -> Kanal 3 (CORS Public Proxy) -> Kanal 4 (Local Archive Fallback)
 */
export async function fetchLiveRadarDebunks(): Promise<LiveRadarFetchResult> {
  const startTime = Date.now()

  // Kanal 1: Vite Proxy lokal (/api/turnbackhoax)
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3500)

    const res = await fetch('/api/turnbackhoax/posts?per_page=12&_fields=id,date,title,excerpt,content,link', {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    })
    clearTimeout(timeoutId)

    if (res.ok) {
      const posts: TurnBackHoaxPost[] = await res.json()
      if (Array.isArray(posts) && posts.length > 0) {
        const parsed = posts.map(parseTurnBackHoaxPost)
        // INJEKSI KE KNOWLEDGE POOL AKTIF SEKETIKA!
        registerLiveDebunks(parsed)
        return {
          entries: parsed,
          isLive: true,
          sourceChannel: 'API_PROXY',
          latencyMs: Date.now() - startTime,
          fetchedAt: Date.now()
        }
      }
    }
  } catch {
    // Lanjut ke Kanal 2
  }

  // Kanal 2: Direct Fetch
  try {
    const directController = new AbortController()
    const directTimeout = setTimeout(() => directController.abort(), 3000)

    const resDirect = await fetch('https://turnbackhoax.id/wp-json/wp/v2/posts?per_page=12&_fields=id,date,title,excerpt,content,link', {
      signal: directController.signal,
      headers: { 'Accept': 'application/json' }
    })
    clearTimeout(directTimeout)

    if (resDirect.ok) {
      const posts: TurnBackHoaxPost[] = await resDirect.json()
      if (Array.isArray(posts) && posts.length > 0) {
        const parsed = posts.map(parseTurnBackHoaxPost)
        registerLiveDebunks(parsed)
        return {
          entries: parsed,
          isLive: true,
          sourceChannel: 'API_DIRECT',
          latencyMs: Date.now() - startTime,
          fetchedAt: Date.now()
        }
      }
    }
  } catch {
    // Lanjut ke Kanal 3
  }

  // Kanal 3: Public CORS Bridge Fallback (AllOrigins)
  try {
    const proxyController = new AbortController()
    const proxyTimeout = setTimeout(() => proxyController.abort(), 3500)

    const targetUrl = 'https://turnbackhoax.id/wp-json/wp/v2/posts?per_page=12&_fields=id,date,title,excerpt,content,link'
    const resProxy = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`, {
      signal: proxyController.signal
    })
    clearTimeout(proxyTimeout)

    if (resProxy.ok) {
      const posts: TurnBackHoaxPost[] = await resProxy.json()
      if (Array.isArray(posts) && posts.length > 0) {
        const parsed = posts.map(parseTurnBackHoaxPost)
        registerLiveDebunks(parsed)
        return {
          entries: parsed,
          isLive: true,
          sourceChannel: 'API_CORS_PROXY',
          latencyMs: Date.now() - startTime,
          fetchedAt: Date.now()
        }
      }
    }
  } catch {
    // Seluruh kanal online gagal
  }

  // Kanal 4: Fallback Jujur ke Basis Pengetahuan Lokal PUSSIBERAD
  const localArchive = getCuratedArchiveDebunks()
  return {
    entries: localArchive,
    isLive: false,
    sourceChannel: 'LOCAL_ARCHIVE',
    latencyMs: Date.now() - startTime,
    fetchedAt: Date.now(),
    errorMessage: 'Koneksi API publik tidak dapat dijangkau. Beralih ke arsip terkurasi lokal.'
  }
}
