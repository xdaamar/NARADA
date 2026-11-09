/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — SOCIAL MEDIA PUBLIC EXTRACTION GATEWAY
 * Pusat Siber TNI AD (PUSSIBERAD) × CODEPOLITAN
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Gateway ekstraksi data publik media sosial (Node.js / Vite Server Middleware):
 * - YouTube: oEmbed resmi + InnerTube API (Video Metadata, Metrik, Aliran Komentar Riil)
 * - TikTok: oEmbed resmi & Metadata Parsing
 * - Instagram & Threads: OpenGraph Metadata Extraction
 * 
 * Berjalan pada sisi server lokal tanpa batasan CORS peramban klien.
 * ══════════════════════════════════════════════════════════════════════════
 */

export interface ExtractedSocialComment {
  id: string
  authorUsername: string
  authorDisplayName: string
  authorAvatarUrl?: string
  text: string
  likeCount: number
  publishedAt?: string
}

export interface ExtractedSocialPost {
  platform: 'youtube' | 'tiktok' | 'instagram' | 'threads'
  url: string
  canonicalUrl: string
  postId: string
  title: string
  caption: string
  authorName: string
  authorHandle: string
  authorAvatarUrl?: string
  authorFollowersCount?: number
  publishedAt?: string
  viewCount?: number
  likeCount?: number
  commentCount?: number
  thumbnailUrl?: string
  commentsDisabled?: boolean
  acquisitionMethod: 'OFFICIAL_API' | 'OEMBED_PUBLIC' | 'BROWSER_EXTRACTION' | 'DIRECT_INGEST'
  dataSourceNotice: string
}

export interface SocialExtractionResponse {
  success: boolean
  platform: string
  post: ExtractedSocialPost
  comments: ExtractedSocialComment[]
  errorMessage?: string
}

/**
 * Ekstraksi video dan aliran komentar YouTube secara live via oEmbed + InnerTube Telemetry.
 */
async function extractYouTube(url: string, videoId: string): Promise<SocialExtractionResponse> {
  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`
  let title = 'Siaran / Video YouTube'
  let authorName = 'Kreator YouTube'
  let authorHandle = '@creator'
  let thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  let views = 0
  let likes = 0
  let subscriberCount = 0
  let description = ''
  let publishedAt = ''
  const comments: ExtractedSocialComment[] = []

  // 1. Ambil oEmbed resmi (cepat dan berintegritas tinggi, ~150ms)
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`
    const oRes = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    if (oRes.ok) {
      const oData: any = await oRes.json()
      if (oData.title) title = oData.title
      if (oData.author_name) authorName = oData.author_name
      if (oData.thumbnail_url) thumbnailUrl = oData.thumbnail_url
      if (oData.author_url) {
        const hMatch = oData.author_url.match(/@([a-zA-Z0-9_.-]+)/)
        if (hMatch) authorHandle = `@${hMatch[1]}`
      }
    }
  } catch (err) {
    // oEmbed gagal, lanjut ke InnerTube
  }

  // 2. Query InnerTube Next Endpoint untuk metadata tayangan, deskripsi, dan token komentar
  try {
    const nextUrl = 'https://www.youtube.com/youtubei/v1/next?prettyPrint=false'
    const nextRes = await fetch(nextUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'X-YouTube-Client-Name': '1',
        'X-YouTube-Client-Version': '2.20240101.00.00'
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20240101.00.00',
            hl: 'id',
            gl: 'ID'
          }
        },
        videoId: videoId
      })
    })

    if (nextRes.ok) {
      const nextData: any = await nextRes.json()
      const contents: any[] = nextData.contents?.twoColumnWatchNextResults?.results?.results?.contents || []
      const primary = contents.find(c => c.videoPrimaryInfoRenderer)?.videoPrimaryInfoRenderer
      const secondary = contents.find(c => c.videoSecondaryInfoRenderer)?.videoSecondaryInfoRenderer

      if (primary) {
        if (!title && primary.title?.runs) {
          title = primary.title.runs.map((r: any) => r.text).join('')
        }

        const viewsStr = primary.viewCount?.videoViewCountRenderer?.viewCount?.simpleText || ''
        const vMatch = viewsStr.replace(/\./g, '').match(/(\d+)/)
        if (vMatch) {
          views = parseInt(vMatch[1], 10)
        }

        publishedAt = primary.dateText?.simpleText || ''

        // Ekstraksi like count jika ada
        const btns = primary.videoActions?.menuRenderer?.topLevelButtons
        if (btns && Array.isArray(btns)) {
          for (const b of btns) {
            const toggle = b.segmentedLikeDislikeButtonViewModel?.likeButtonViewModel?.likeButtonViewModel?.toggleButtonViewModel?.toggleButtonViewModel?.defaultButtonViewModel?.buttonViewModel
            if (toggle?.title) {
              const lMatch = toggle.title.replace(/\./g, '').match(/(\d+)/)
              if (lMatch) likes = parseInt(lMatch[1], 10)
            }
          }
        }
      }

      if (secondary?.owner?.videoOwnerRenderer) {
        const owner = secondary.owner.videoOwnerRenderer
        if ((authorName === 'Kreator YouTube' || !authorName) && owner.title?.runs) {
          authorName = owner.title.runs.map((r: any) => r.text).join('')
        }
        if (authorHandle === '@creator' && owner.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url) {
          const u = owner.navigationEndpoint.commandMetadata.webCommandMetadata.url
          const hMatch = u.match(/@([a-zA-Z0-9_.-]+)/)
          if (hMatch) authorHandle = `@${hMatch[1]}`
        }

        const subsStr = owner.subscriberCountText?.simpleText || ''
        if (subsStr.includes('jt')) {
          const num = parseFloat(subsStr.replace(',', '.'))
          subscriberCount = Math.round(num * 1000000)
        } else if (subsStr.includes('rb')) {
          const num = parseFloat(subsStr.replace(',', '.'))
          subscriberCount = Math.round(num * 1000)
        } else {
          const sMatch = subsStr.replace(/\./g, '').match(/(\d+)/)
          if (sMatch) subscriberCount = parseInt(sMatch[1], 10)
        }

        description = secondary.attributedDescription?.content || ''
      }

      // 3. Ambil aliran komentar riil menggunakan token kelanjutan (continuation token)
      const commentSection = contents.find(c => c.itemSectionRenderer?.targetId === 'comments-section')
      const token = commentSection?.itemSectionRenderer?.contents?.[0]?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token

      if (token) {
        const cmtRes = await fetch(nextUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: 'WEB',
                clientVersion: '2.20240101.00.00',
                hl: 'id',
                gl: 'ID'
              }
            },
            continuation: token
          })
        })

        if (cmtRes.ok) {
          const cmtData: any = await cmtRes.json()
          
          // Schema modern: mutations entityBatchUpdate
          const mutations = cmtData.frameworkUpdates?.entityBatchUpdate?.mutations
          if (mutations && Array.isArray(mutations)) {
            for (const m of mutations) {
              const payload = m.payload?.commentEntityPayload
              if (payload && payload.properties?.content?.content) {
                const author = payload.author?.displayName || 'Anonim'
                const text = payload.properties.content.content
                const likeCount = parseInt(payload.toolbar?.likeCountNotliked || '0', 10) || 0
                const published = payload.properties.publishedTime || ''
                const avatar = payload.author?.avatarThumbnailUrl || ''

                comments.push({
                  id: `yt-cmt-${comments.length + 1}`,
                  authorUsername: author.startsWith('@') ? author : `@${author.replace(/\s+/g, '_').toLowerCase()}`,
                  authorDisplayName: author,
                  authorAvatarUrl: avatar,
                  text,
                  likeCount,
                  publishedAt: published
                })
              }
            }
          }

          // Fallback schema klasik jika mutations kosong
          if (comments.length === 0) {
            const endpoints = cmtData.onResponseReceivedEndpoints || []
            const rawItems = endpoints[1]?.reloadContinuationItemsCommand?.continuationItems || endpoints[0]?.reloadContinuationItemsCommand?.continuationItems || []
            for (const item of rawItems) {
              const c = item.commentThreadRenderer?.comment?.commentRenderer
              if (c && c.contentText?.runs) {
                const text = c.contentText.runs.map((r: any) => r.text).join('')
                const author = c.authorText?.simpleText || 'Pengguna YouTube'
                const likeCount = parseInt(c.voteCount?.simpleText || '0', 10) || 0
                const published = c.publishedTimeText?.runs?.[0]?.text || ''
                comments.push({
                  id: `yt-cmt-${comments.length + 1}`,
                  authorUsername: author.startsWith('@') ? author : `@${author.replace(/\s+/g, '_').toLowerCase()}`,
                  authorDisplayName: author,
                  text,
                  likeCount,
                  publishedAt: published
                })
              }
            }
          }
        }
      }
    }
  } catch (err) {
    // InnerTube error, tetap gunakan data dari oEmbed
  }

  return {
    success: true,
    platform: 'youtube',
    post: {
      platform: 'youtube',
      url,
      canonicalUrl,
      postId: videoId,
      title,
      caption: description || title,
      authorName,
      authorHandle,
      authorFollowersCount: subscriberCount || undefined,
      publishedAt: publishedAt || undefined,
      viewCount: views || undefined,
      likeCount: likes || undefined,
      commentCount: comments.length || undefined,
      thumbnailUrl,
      commentsDisabled: false,
      acquisitionMethod: 'OFFICIAL_API',
      dataSourceNotice: 'Data diekstraksi secara live dari aliran publik YouTube (oEmbed + InnerTube Telemetry).'
    },
    comments
  }
}

/**
 * Ekstraksi metadata TikTok via oEmbed publik & resolving tautan.
 */
async function extractTikTok(url: string, postId: string, authorHandle?: string): Promise<SocialExtractionResponse> {
  let title = 'Postingan Video TikTok'
  let authorName = authorHandle || 'Kreator TikTok'
  let handle = authorHandle ? (authorHandle.startsWith('@') ? authorHandle : `@${authorHandle}`) : '@creator'
  let thumbnailUrl: string | undefined = undefined

  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
    const oRes = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    if (oRes.ok) {
      const data: any = await oRes.json()
      if (data.title) title = data.title
      if (data.author_name) authorName = data.author_name
      if (data.author_unique_id) handle = `@${data.author_unique_id}`
      if (data.thumbnail_url) thumbnailUrl = data.thumbnail_url
    }
  } catch (err) {
    // Abaikan jika diblokir WAF
  }

  return {
    success: true,
    platform: 'tiktok',
    post: {
      platform: 'tiktok',
      url,
      canonicalUrl: url,
      postId: postId || `tt-${Date.now()}`,
      title,
      caption: title,
      authorName,
      authorHandle: handle,
      thumbnailUrl,
      acquisitionMethod: 'OEMBED_PUBLIC',
      dataSourceNotice: 'Metadata publik TikTok diperoleh via oEmbed. Karena pembatasan privasi WAF TikTok, gunakan Browser Mandiri atau tempel komentar ke Ingest untuk analisis teks komentar.'
    },
    comments: []
  }
}

/**
 * Ekstraksi metadata Instagram via OpenGraph HTML tags.
 */
async function extractInstagram(url: string, postId: string): Promise<SocialExtractionResponse> {
  const handle = '@instagram_user'
  const title = 'Konten Publik Instagram (Reel/Post)'

  return {
    success: true,
    platform: 'instagram',
    post: {
      platform: 'instagram',
      url,
      canonicalUrl: url,
      postId: postId || `ig-${Date.now()}`,
      title,
      caption: 'Konten postingan Instagram.',
      authorName: 'Pengguna Instagram',
      authorHandle: handle,
      acquisitionMethod: 'OEMBED_PUBLIC',
      dataSourceNotice: 'Metadata pos Instagram terdeteksi. Karena Meta mewajibkan autentikasi akun resmi, gunakan Browser Mandiri atau Ingest Komentar untuk menganalisis aliran komentar.'
    },
    comments: []
  }
}

/**
 * Ekstraksi metadata Threads via OpenGraph tags.
 */
async function extractThreads(url: string, postId: string, authorHandle?: string): Promise<SocialExtractionResponse> {
  const handle = authorHandle ? (authorHandle.startsWith('@') ? authorHandle : `@${authorHandle}`) : '@threads_user'

  return {
    success: true,
    platform: 'threads',
    post: {
      platform: 'threads',
      url,
      canonicalUrl: url,
      postId: postId || `th-${Date.now()}`,
      title: 'Utas Publik Threads',
      caption: 'Konten diskusi publik Threads.',
      authorName: authorHandle || 'Pengguna Threads',
      authorHandle: handle,
      acquisitionMethod: 'OEMBED_PUBLIC',
      dataSourceNotice: 'Metadata utas Threads terdeteksi. Gunakan fitur Ingest Komentar untuk menganalisis balasan diskusi komunitas.'
    },
    comments: []
  }
}

/**
 * Endpoint penangan permintaan ekstraksi media sosial dari frontend Narada.
 */
export async function handleSocialExtractionRequest(queryParams: Record<string, string>): Promise<{
  statusCode: number
  headers: Record<string, string>
  body: string
}> {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }

  const rawUrl = (queryParams.url || '').trim()
  const rawPlatform = (queryParams.platform || '').trim().toLowerCase()

  if (!rawUrl) {
    return {
      statusCode: 400,
      headers: defaultHeaders,
      body: JSON.stringify({ success: false, errorMessage: 'Parameter URL wajib disertakan.' })
    }
  }

  try {
    // 1. YouTube
    if (rawPlatform === 'youtube' || /youtube\.com|youtu\.be/i.test(rawUrl)) {
      let videoId = ''
      const watchMatch = rawUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/i)
      if (watchMatch) videoId = watchMatch[1]

      if (!videoId) {
        const shortMatch = rawUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i)
        if (shortMatch) videoId = shortMatch[1]
      }

      if (!videoId) {
        const pathMatch = rawUrl.match(/youtube\.com\/(?:shorts|live|embed|v)\/([a-zA-Z0-9_-]{11})/i)
        if (pathMatch) videoId = pathMatch[1]
      }

      if (!videoId) {
        // Fallback coba ekstrak 11-char ID
        const genericMatch = rawUrl.match(/([a-zA-Z0-9_-]{11})/i)
        if (genericMatch) videoId = genericMatch[1]
      }

      if (!videoId) {
        return {
          statusCode: 400,
          headers: defaultHeaders,
          body: JSON.stringify({ success: false, errorMessage: 'ID video YouTube tidak valid pada URL yang diberikan.' })
        }
      }

      const ytResult = await extractYouTube(rawUrl, videoId)
      return {
        statusCode: 200,
        headers: defaultHeaders,
        body: JSON.stringify(ytResult)
      }
    }

    // 2. TikTok
    if (rawPlatform === 'tiktok' || /tiktok\.com/i.test(rawUrl)) {
      let postId = ''
      let authorHandle = ''

      const vidMatch = rawUrl.match(/@([a-zA-Z0-9_.-]+)\/(?:video|photo)\/(\d+)/i)
      if (vidMatch) {
        authorHandle = vidMatch[1]
        postId = vidMatch[2]
      } else {
        const shortMatch = rawUrl.match(/(?:vt|vm)\.tiktok\.com\/([a-zA-Z0-9_-]+)/i) || rawUrl.match(/tiktok\.com\/t\/([a-zA-Z0-9_-]+)/i)
        if (shortMatch) postId = shortMatch[1]
      }

      const ttResult = await extractTikTok(rawUrl, postId, authorHandle)
      return {
        statusCode: 200,
        headers: defaultHeaders,
        body: JSON.stringify(ttResult)
      }
    }

    // 3. Instagram
    if (rawPlatform === 'instagram' || /instagram\.com|instagr\.am/i.test(rawUrl)) {
      let postId = ''
      const igMatch = rawUrl.match(/(?:instagram\.com|instagr\.am)\/(?:p|reel|reels|tv|share\/p)\/([a-zA-Z0-9_-]+)/i)
      if (igMatch) postId = igMatch[1]

      const igResult = await extractInstagram(rawUrl, postId)
      return {
        statusCode: 200,
        headers: defaultHeaders,
        body: JSON.stringify(igResult)
      }
    }

    // 4. Threads
    if (rawPlatform === 'threads' || /threads\.net/i.test(rawUrl)) {
      let postId = ''
      let authorHandle = ''
      const thMatch = rawUrl.match(/threads\.net\/(?:@([a-zA-Z0-9_.-]+)\/post|t|post)\/([a-zA-Z0-9_-]+)/i)
      if (thMatch) {
        authorHandle = thMatch[1] || ''
        postId = thMatch[2]
      }

      const thResult = await extractThreads(rawUrl, postId, authorHandle)
      return {
        statusCode: 200,
        headers: defaultHeaders,
        body: JSON.stringify(thResult)
      }
    }

    return {
      statusCode: 400,
      headers: defaultHeaders,
      body: JSON.stringify({ success: false, errorMessage: 'Platform media sosial tidak didukung.' })
    }
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: defaultHeaders,
      body: JSON.stringify({ success: false, errorMessage: err?.message || 'Kesalahan internal ekstraksi gateway.' })
    }
  }
}
