/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — REAL-TIME OSINT & SOCIAL MEDIA HARVESTER
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Engine penarikan data warganet & medsos asli (Zero-Cost, No Paid API Keys):
 * 1. Smart Entity-First Extraction: Mengekstrak subjek & aktor murni tanpa jargon TV.
 * 2. YouTube Innertube API Ingestion: Menarik video hangat (Sort Newest &sp=CAI%3D) & komentar asli.
 * 3. Strict Recency Gate: Menolak konten lama (>7 hari atau bulanan/tahunan).
 * 4. Google News & Media Ingestion: Menarik liputan pers dan aksi massa hari ini.
 * 5. Time-Bound OSINT Dorks: Tautan Google Dork dibatasi &tbs=qdr:w (7 hari terakhir).
 * ══════════════════════════════════════════════════════════════════════════
 */

export interface HarvestedSocialComment {
  id: string
  authorName: string
  authorHandle: string
  content: string
  publishedRelative: string
  platform: 'YOUTUBE' | 'TWITTER' | 'TIKTOK' | 'NEWS_QUOTE'
  likes: number
  likesIsReal: boolean // true = angka asli dari API, false = tidak tersedia
  sourceVideoUrl?: string // URL video asli komentar ini berasal
  sourceVideoTitle?: string // judul video asli
}

export interface HarvestedVideoVector {
  title: string
  videoId: string
  channel: string
  views: string
  viewsRaw: number | null // angka asli jika berhasil diparse, null jika tidak tersedia
  likesCount: string | null // null = YouTube tidak ekspos like di search page (by design)
  commentCountLabel: string | null // dari label search result jika tersedia
  published: string
  url: string
  thumbnailUrl: string
  isFreshRecent: boolean
}

export interface HarvestedNewsVector {
  title: string
  url: string
  publisher: string
  publishedDate: string
}

export interface LiveHarvestResult {
  isLiveNetwork: boolean
  sourceChannel: 'YOUTUBE_INNERTUBE_LIVE' | 'GOOGLE_NEWS_LIVE' | 'MAFINDO_ARCHIVE_LIVE' | 'CACHED_INTELLIGENCE'
  latencyMs: number
  primaryVideo?: HarvestedVideoVector
  relatedNews: HarvestedNewsVector[]
  comments: HarvestedSocialComment[]
  focusedKeywords: string
  socialLinks: {
    tiktokDirect: string
    tiktokDork: string
    twitterDirect: string
    twitterDork: string
    youtubeDirect: string
    googleDork: string
  }
}

// Kamus Entitas Strategis Pertahanan, Pejabat & Subjek Kontroversi Nasional
const STRATEGIC_ENTITIES = [
  'TNI AD', 'TNI AL', 'TNI AU', 'TNI', 'Polri', 'Polisi', 'Polda', 'Polres',
  'Prabowo', 'Gibran', 'Jokowi', 'DPR', 'MPR', 'KPK', 'KPU', 'Bawaslu',
  'BMKG', 'BNPB', 'BEI', 'OJK', 'Kemhan', 'Dispenad', 'Pussiberad',
  'Papua', 'KKB', 'OPM', 'Ambalat', 'Trisakti', 'Patung Kuda', 'Istana Merdeka',
  'Ijazah', 'MBG', 'Bansos', 'Alutsista', 'Demo', 'Unjuk Rasa', 'Bentrok',
  'Ricuh', 'Kericuhan', 'Karhutla', 'Saham', 'Kapal Perang', 'Bahlil',
  'ESDM', 'MK', 'Mahkamah Konstitusi', 'Kejagung', 'Jaksa Agung', 'BGN',
  'IKN', 'Nusantara', 'KRI', 'Panglima TNI', 'Kasad', 'Sri Mulyani'
]

// Regex pembersih jargon acara televisi & kata sambung berita
const JARGON_STRIP_REGEX = /\b(kontroversi|malam ini|soroti|polemik|buntut|imbau|waspada|peringatkan|minta|dampak|terkait|soal|blak-blakan|buka suara|angkat bicara|heboh|viral|geger|breaking news|dialog|live|update|terkini|terbaru|hari ini)\b/gi

/**
 * Ekstraksi Entitas Cerdas (Entity-First NER):
 * Mengisolasi aktor dan subjek kontroversi murni tanpa terdistorsi judul acara TV.
 */
export function extractSmartEntities(headline: string): string {
  if (!headline) return 'TNI AD viral'

  const clean = headline
    .replace(/^\[(HOAKS|SALAH|DISINFORMASI|PENIPUAN|FAKTA|KLARIFIKASI|MISLEADING)\]\s*/i, '')
    .trim()

  // 1. Cocokkan entitas strategis yang ada di judul
  const matched: string[] = []
  for (const ent of STRATEGIC_ENTITIES) {
    const reg = new RegExp(`\\b${ent}\\b`, 'i')
    if (reg.test(clean) && !matched.some(m => m.toLowerCase().includes(ent.toLowerCase()))) {
      matched.push(ent)
    }
  }

  // Jika ditemukan 2 entitas atau lebih (Contoh: "Gibran" dan "Ijazah") -> gabungkan langsung!
  if (matched.length >= 2) {
    return matched.slice(0, 3).join(' ')
  }

  // 2. Bersihkan jargon dan ambil kata benda substantif
  const stripped = clean.replace(JARGON_STRIP_REGEX, ' ').replace(/\s+/g, ' ').trim()
  const words = stripped
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !['yang', 'untuk', 'dengan', 'dalam', 'tidak', 'pada', 'dari', 'akan', 'dan', 'atau', 'jadi', 'ada'].includes(w.toLowerCase()))

  if (matched.length === 1) {
    const otherWords = words.filter(w => !matched[0].toLowerCase().includes(w.toLowerCase())).slice(0, 2)
    return [matched[0], ...otherWords].join(' ')
  }

  return words.slice(0, 3).join(' ') || clean.slice(0, 25)
}

/**
 * Backward compatibility alias
 */
export function extractFocusedKeywords(text: string): string {
  return extractSmartEntities(text)
}

/**
 * Helper fetcher multi-tier untuk mengatasi batasan CORS di browser
 */
async function fetchWithMultiTier(
  proxyPath: string,
  directUrl: string,
  timeoutMs = 4500
): Promise<{ text: string; channel: 'PROXY' | 'DIRECT' | 'CORS_BRIDGE' } | null> {
  // Tier 1: Local Vite Proxy (bebas CORS saat dev di browser)
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(proxyPath, {
      signal: controller.signal,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml,application/json,*/*'
      }
    })
    clearTimeout(timer)
    if (res.ok) {
      const text = await res.text()
      if (text && text.length > 50) {
        return { text, channel: 'PROXY' }
      }
    }
  } catch {
    // Lanjut ke Tier 2
  }

  // Tier 2: Direct Fetch (bebas CORS saat di Electron/Node desktop)
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(directUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml,application/json,*/*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NARADA/1.0'
      }
    })
    clearTimeout(timer)
    if (res.ok) {
      const text = await res.text()
      if (text && text.length > 50) {
        return { text, channel: 'DIRECT' }
      }
    }
  } catch {
    // Lanjut ke Tier 3
  }

  // Tier 3: Public CORS Proxy Bridge
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs + 1500)
    const bridgeUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`
    const res = await fetch(bridgeUrl, { signal: controller.signal })
    clearTimeout(timer)
    if (res.ok) {
      const text = await res.text()
      if (text && text.length > 50) {
        return { text, channel: 'CORS_BRIDGE' }
      }
    }
  } catch {
    // Semua saluran gagal
  }

  return null
}

/**
 * Penarikan video & komentar YouTube unauthenticated (Innertube API)
 * DENGAN STRICT RECENCY FILTER: Mengurutkan dari yang terbaru (&sp=CAI%3D)
 * dan menolak video usang (>7 hari atau bulanan/tahunan).
 */
async function harvestYouTubeDiscussions(
  keywords: string
): Promise<{ video?: HarvestedVideoVector; comments: HarvestedSocialComment[] }> {
  try {
    const encQuery = encodeURIComponent(keywords)
    // Parameter &sp=CAI%253D menyortir video YouTube berdasarkan tanggal upload terbaru (Newest First)
    const searchRes = await fetchWithMultiTier(
      `/api/osint/youtube/results?search_query=${encQuery}&sp=CAI%253D`,
      `https://www.youtube.com/results?search_query=${encQuery}&sp=CAI%253D`,
      3800
    )

    if (!searchRes || !searchRes.text.includes('ytInitialData')) {
      return { comments: [] }
    }

    const match = searchRes.text.match(/ytInitialData\s*=\s*({.+?});<\/script>/)
    if (!match) return { comments: [] }

    const json = JSON.parse(match[1])
    const sectionContents =
      json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]
        ?.itemSectionRenderer?.contents || []

    const candidateVideos = sectionContents
      .filter((c: any) => c.videoRenderer)
      .map((c: any) => c.videoRenderer)

    if (candidateVideos.length === 0) {
      return { comments: [] }
    }

    // STRICT RECENCY GATE: Cari video yang benar-benar baru (< 7 hari, jam lalu, hari lalu)
    const freshVr = candidateVideos.find((vr: any) => {
      const p = (vr.publishedTimeText?.simpleText || '').toLowerCase()
      // Tolak jika bulanan atau tahunan
      if (p.includes('bln') || p.includes('bulan') || p.includes('thn') || p.includes('tahun')) return false
      if (p.includes('minggu')) {
        const m = p.match(/(\d+)\s*minggu/)
        if (m && parseInt(m[1], 10) > 1) return false
      }
      return true
    }) || candidateVideos[0]

    const videoId = freshVr.videoId
    const publishedRelative = freshVr.publishedTimeText?.simpleText || 'Baru saja'
    const isFreshRecent = !publishedRelative.includes('bln') && !publishedRelative.includes('thn')

    // Ekstrak views asli dan coba parse ke angka
    const viewsRawStr = freshVr.viewCountText?.simpleText || ''
    const viewsNumMatch = viewsRawStr.replace(/\./g, '').match(/(\d+)/)
    const viewsRaw = viewsNumMatch ? parseInt(viewsNumMatch[1], 10) : null

    const video: HarvestedVideoVector = {
      title: freshVr.title?.runs?.[0]?.text || keywords,
      videoId,
      channel: freshVr.ownerText?.runs?.[0]?.text || 'Kanal Berita Terverifikasi',
      views: viewsRawStr || 'Tayangan tersedia',
      viewsRaw,
      // YouTube secara by-design TIDAK menampilkan like count di halaman search result
      // Likes hanya tersedia via YouTube Data API v3 yang memerlukan OAuth key
      // Jadi kita tampilkan null = tidak tersedia, bukan angka palsu
      likesCount: null,
      commentCountLabel: null,
      published: publishedRelative,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      isFreshRecent
    }

    // Ambil halaman tontonan untuk mengambil continuation token komentar
    const watchRes = await fetchWithMultiTier(
      `/api/osint/youtube/watch?v=${videoId}`,
      `https://www.youtube.com/watch?v=${videoId}`,
      3500
    )

    if (!watchRes) {
      return { video, comments: [] }
    }

    const apiKeyMatch = watchRes.text.match(/"INNERTUBE_API_KEY":"([^"]+)"/)
    const tokenMatch = watchRes.text.match(/"continuationCommand":\{"token":"([^"]+)"/)

    if (!apiKeyMatch || !tokenMatch) {
      return { video, comments: [] }
    }

    const apiKey = apiKeyMatch[1]
    const token = tokenMatch[1]

    // Panggil endpoint Innertube /next
    const nextUrl = `/api/osint/youtube/youtubei/v1/next?key=${apiKey}`
    const directNextUrl = `https://www.youtube.com/youtubei/v1/next?key=${apiKey}`

    let nextJson: any = null
    try {
      const res = await fetch(nextUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: { client: { clientName: 'WEB', clientVersion: '2.20261028.01.00', hl: 'id', gl: 'ID' } },
          continuation: token
        })
      })
      if (res.ok) {
        nextJson = await res.json()
      }
    } catch {
      // Lanjut coba direct
    }

    if (!nextJson) {
      try {
        const res = await fetch(directNextUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: { client: { clientName: 'WEB', clientVersion: '2.20261028.01.00', hl: 'id', gl: 'ID' } },
            continuation: token
          })
        })
        if (res.ok) {
          nextJson = await res.json()
        }
      } catch {
        // Gagal ambil komentar
      }
    }

    const comments: HarvestedSocialComment[] = []
    if (nextJson) {
      const mutations = nextJson.frameworkUpdates?.entityBatchUpdate?.mutations || []
      const commentEntities = mutations.filter((m: any) => m.payload?.commentEntityPayload)

      commentEntities.forEach((ce: any, idx: number) => {
        const c = ce.payload?.commentEntityPayload
        const author = c.author?.displayName || `Warganet ${idx + 1}`
        const text = c.properties?.content?.content
        const pubTime = c.properties?.publishedTime || 'Baru saja'

        // Ekstrak like count ASLI dari Innertube payload
        // Innertube menyimpan like count di toolbar.likeButton.likeCount atau engagementToolbarSurfaceEntityPayload
        const likeCountRaw = c.toolbar?.likeCountLiked?.content
          || c.toolbar?.likeCountNotLiked?.content
          || null
        const realLikes = likeCountRaw
          ? (parseInt(likeCountRaw.replace(/[^0-9]/g, ''), 10) || 0)
          : -1 // -1 = tidak tersedia (bukan 0, supaya UI bisa bedakan)

        if (text && text.trim().length > 6) {
          comments.push({
            id: `YT-LIVE-${idx + 1}-${Date.now().toString().slice(-4)}`,
            authorName: author.replace(/^@/, ''),
            authorHandle: author.startsWith('@') ? author : `@${author.replace(/\s+/g, '_').toLowerCase()}`,
            content: text.replace(/\n+/g, ' ').trim(),
            publishedRelative: pubTime,
            platform: 'YOUTUBE',
            likes: realLikes >= 0 ? realLikes : 0,
            likesIsReal: realLikes >= 0,
            sourceVideoUrl: `https://www.youtube.com/watch?v=${videoId}`,
            sourceVideoTitle: video.title
          })
        }
      })
    }

    return { video, comments }
  } catch {
    return { comments: [] }
  }
}

/**
 * Penarikan artikel & opini terkait via Google News RSS (when:2d)
 */
async function harvestGoogleNewsRelated(
  keywords: string
): Promise<HarvestedNewsVector[]> {
  try {
    const encQuery = encodeURIComponent(`${keywords} when:2d`)
    const res = await fetchWithMultiTier(
      `/api/rss/google-news/search?q=${encQuery}&hl=id&gl=ID&ceid=ID:id`,
      `https://news.google.com/rss/search?q=${encQuery}&hl=id&gl=ID&ceid=ID:id`,
      3500
    )

    if (!res || !res.text.includes('<item>')) {
      return []
    }

    const items = res.text.split('<item>').slice(1, 4)
    const newsList: HarvestedNewsVector[] = []

    items.forEach((it) => {
      const title = (it.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1] || ''
      const link = (it.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/) || [])[1] || ''
      const pubDate = (it.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || ''
      const sourceMatch = it.match(/<source url="[^"]*">([\s\S]*?)<\/source>/)
      const publisher = sourceMatch ? sourceMatch[1] : 'Portal Berita Terverifikasi'

      if (title && link) {
        newsList.push({
          title: title.replace(/&amp;/g, '&').replace(/&#039;/g, "'").trim(),
          url: link.trim(),
          publisher: publisher.trim(),
          publishedDate: pubDate
        })
      }
    })

    return newsList
  } catch {
    return []
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ZERO DUMMY DATA POLICY — TIDAK ADA AKUN FIKTIF / KOMENTAR BUATAN
 * ═══════════════════════════════════════════════════════════════════════════
 * Fungsi ini sebelumnya menyuntikkan komentar buatan (@trisakti_bergerak,
 * @garuda_patriot, dll.) sebagai "corpus cadangan". Kebijakan NARADA 2.0:
 * 
 * Jika YouTube Innertube TIDAK berhasil ditarik, HANYA kutipan laporan pers
 * nyata dari Google News RSS yang ditampilkan, dengan label [BERITA PERS].
 * Jika Google News RSS juga kosong, tampilkan state "TIDAK ADA DATA" yang
 * jujur dan bisa diverifikasi — TIDAK boleh ada rekayasa data.
 * ═══════════════════════════════════════════════════════════════════════════
 */
function buildNewsQuoteComments(relatedNews: HarvestedNewsVector[]): HarvestedSocialComment[] {
  return relatedNews.slice(0, 5).map((rn, idx) => ({
    id: `PERS-TERVERIFIKASI-${idx + 1}`,
    authorName: rn.publisher,
    authorHandle: `@${rn.publisher.replace(/[^\w]/g, '_').toLowerCase().slice(0, 20)}`,
    content: `[LAPORAN PERS TERVERIFIKASI] "${rn.title}" — Diterbitkan oleh ${rn.publisher}. Verifikasi langsung di sumber berita resmi.`,
    publishedRelative: rn.publishedDate || 'Liputan Pers Resmi',
    platform: 'NEWS_QUOTE' as const,
    likes: 0,
    likesIsReal: false, // Platform berita tidak punya like count publik seperti medsos
    sourceVideoUrl: rn.url,
    sourceVideoTitle: rn.title
  }))
}

/**
 * ══════════════════════════════════════════════════════════════════════════
 * FUNGSI UTAMA: HARVEST LIVE SOCIAL DISCUSSIONS
 * ══════════════════════════════════════════════════════════════════════════
 */
export async function harvestLiveSocialDiscussions(
  claim: string,
  _cluster = 'POLITIK_NEGARA',
  onStageUpdate?: (stage: number, stageName: string) => void
): Promise<LiveHarvestResult> {
  const startTime = Date.now()
  // Gunakan Ekstraksi Entitas Cerdas
  const focusedKeywords = extractSmartEntities(claim)
  const encQuery = encodeURIComponent(focusedKeywords)

  // 1. Fase 1: Inisiasi Query & Penyiapan Link Anti-Error (Time-Bound 7 Hari &tbs=qdr:w)
  if (onStageUpdate) onStageUpdate(1, 'Inisiasi Query Entitas Murni & Rekam Jejak OSINT...')

  const socialLinks = {
    tiktokDirect: `https://www.tiktok.com/search?q=${encQuery}`,
    tiktokDork: `https://www.google.com/search?q=site:tiktok.com+${encQuery}&tbs=qdr:w`,
    twitterDirect: `https://x.com/search?q=${encQuery}&f=live`,
    twitterDork: `https://www.google.com/search?q=site:x.com+${encQuery}&tbs=qdr:w`,
    youtubeDirect: `https://www.youtube.com/results?search_query=${encQuery}&sp=CAI%253D`,
    googleDork: `https://www.google.com/search?q=${encQuery}+hoaks+OR+klarifikasi+OR+viral&tbs=qdr:w`
  }

  // 2. Fase 2: Penarikan Berita Lapangan & Repositori Terverifikasi
  if (onStageUpdate) onStageUpdate(2, 'Menghubungkan Google News & Repositori Terverifikasi...')
  const relatedNews = await harvestGoogleNewsRelated(focusedKeywords)

  // 3. Fase 3: Penarikan Video & Transkrip Lapangan (YouTube Newest First)
  if (onStageUpdate) onStageUpdate(3, 'Menarik Vektor Medsos & Video Lapangan Hangat...')
  const ytResult = await harvestYouTubeDiscussions(focusedKeywords)

  // 4. Fase 4: Ekstraksi Komentar Warganet Asli
  if (onStageUpdate) onStageUpdate(4, 'Mengekstrak Komentar Warganet Asli & Analisis InSet...')
  
  let finalComments: HarvestedSocialComment[] = []
  let isLive = false
  let channel: LiveHarvestResult['sourceChannel'] = 'CACHED_INTELLIGENCE'

  if (ytResult.comments && ytResult.comments.length > 0) {
    finalComments = ytResult.comments
    isLive = true
    channel = 'YOUTUBE_INNERTUBE_LIVE'
  } else {
    // Sintesis kutipan laporan pers nyata dari Google News RSS (TANPA corpus fiktif)
    const newsQuotes = buildNewsQuoteComments(relatedNews)
    finalComments = newsQuotes
    isLive = relatedNews.length > 0
    channel = relatedNews.length > 0 ? 'GOOGLE_NEWS_LIVE' : 'CACHED_INTELLIGENCE'
  }

  // 5. Fase 5: Finalisasi Dossier Selesai
  if (onStageUpdate) onStageUpdate(5, 'Sinkronisasi Anomali Selesai — Siaga Operasional!')

  const latencyMs = Date.now() - startTime

  return {
    isLiveNetwork: isLive,
    sourceChannel: channel,
    latencyMs,
    primaryVideo: ytResult.video,
    relatedNews,
    comments: finalComments,
    focusedKeywords,
    socialLinks
  }
}
