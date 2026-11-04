/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — YOUTUBE OFFICIAL DATA API V3 CONNECTOR & QUOTA MANAGER
 * SPRINT 10: WORK PACKAGE 4 (OFFICIAL PLATFORM API & POLICY COMPLIANCE)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Prinsip Desain & Kepatuhan:
 * 1. Official API Only: Menggunakan YouTube Data API v3 resmi (bukan web scraping liar).
 * 2. Secure Credential Handling: API key diambil dari environment atau local secure storage, tanpa hardcode.
 * 3. Quota-Aware Management: Melacak penggunaan kuota harian (search = 100 unit, video = 1 unit).
 * 4. Separate Comment Capability: Komentar diakuisisi secara terpisah dan menghormati status privasi.
 * 5. Honest Status Reporting: Jika API key belum ada, berstatus CONFIGURATION_REQUIRED (bukan ACTIVE palsu).
 * ══════════════════════════════════════════════════════════════════════════
 */

import type {
  SourceConnector,
  SearchDiscoveryResult,
  CanonicalConnectorHealth,
  ConfigurationStatus
} from './source-contracts.ts'

export interface YouTubeQuotaState {
  dailyLimitUnits: number
  usedUnits: number
  remainingUnits: number
  resetTimestamp: number
  isExhausted: boolean
  lastRequestAt: number | null
}

export interface YouTubeVideoMetadata {
  videoId: string
  url: string
  title: string
  description: string
  channelId: string
  channelTitle: string
  publishedAt: string
  duration?: string
  viewCount?: number
  likeCount?: number
  commentCount?: number
  commentsDisabled?: boolean
  observationTimestamp: number
}

export interface YouTubeCommentItem {
  id: string
  videoId: string
  authorName: string
  authorChannelUrl?: string
  textOriginal: string
  likeCount: number
  publishedAt: string
  updatedAt: string
}

/**
 * Manajer Kuota YouTube API v3
 */
export class YouTubeQuotaManager {
  private dailyLimit: number
  private usedUnits: number = 0
  private resetAt: number
  private lastRequestAt: number | null = null

  constructor(dailyLimit = 10000) {
    this.dailyLimit = dailyLimit
    this.resetAt = this.calculateNextMidnightUtc()
  }

  private calculateNextMidnightUtc(): number {
    const d = new Date()
    d.setUTCHours(24, 0, 0, 0)
    return d.getTime()
  }

  public getQuotaState(): YouTubeQuotaState {
    const now = Date.now()
    if (now >= this.resetAt) {
      this.usedUnits = 0
      this.resetAt = this.calculateNextMidnightUtc()
    }

    const remaining = Math.max(0, this.dailyLimit - this.usedUnits)
    return {
      dailyLimitUnits: this.dailyLimit,
      usedUnits: this.usedUnits,
      remainingUnits: remaining,
      resetTimestamp: this.resetAt,
      isExhausted: remaining <= 0,
      lastRequestAt: this.lastRequestAt
    }
  }

  public canConsume(units: number): boolean {
    const state = this.getQuotaState()
    return state.remainingUnits >= units
  }

  public recordUsage(units: number): void {
    this.usedUnits += units
    this.lastRequestAt = Date.now()
  }

  public resetQuota(): void {
    this.usedUnits = 0
    this.resetAt = this.calculateNextMidnightUtc()
  }
}

/**
 * Konektor Resmi YouTube Data API v3
 */
export class YouTubeConnector implements SourceConnector {
  public readonly connectorId = 'src-youtube-api'
  public readonly displayName = 'YouTube Data API v3 (Official Endpoint)'
  public readonly sourceType = 'official_api' as const
  public readonly providerName = 'Google Cloud / YouTube API Services'
  public readonly platform = 'youtube' as const
  public readonly version = '1.0.0'
  public enabled = true
  public configurationStatus: ConfigurationStatus = 'CONFIGURATION_REQUIRED'
  public healthStatus: CanonicalConnectorHealth = 'CONFIGURATION_REQUIRED'
  public lastCheckedAt: number | null = null
  public lastSuccessfulAt: number | null = null
  public lastItemReceivedAt: number | null = null
  public readonly supportedCapabilities = [
    'URL_DISCOVERY',
    'VIDEO_METADATA',
    'COMMENT_RETRIEVAL',
    'KEYWORD_SEARCH',
    'DATE_FILTERING',
    'PAGINATION'
  ] as const
  public readonly limitations = [
    'Memerlukan kuota resmi Google Cloud Platform (10.000 unit/hari gratis)',
    'Pencarian search.list berbiaya tinggi (100 unit per request)',
    'Hanya mengakses video publik; video privat/unlisted tidak diindeks',
    'Komentar video yang dinonaktifkan oleh pembuat konten tidak dapat diakses'
  ]

  private apiKey: string | null = null
  private quotaManager: YouTubeQuotaManager

  constructor(apiKey?: string, quotaLimit = 10000) {
    this.quotaManager = new YouTubeQuotaManager(quotaLimit)
    const env = typeof (globalThis as any).process !== 'undefined' ? (globalThis as any).process?.env : undefined
    if (apiKey && apiKey.trim()) {
      this.setApiKey(apiKey)
    } else if (env?.YOUTUBE_API_KEY) {
      this.setApiKey(env.YOUTUBE_API_KEY)
    }
  }

  public setApiKey(key: string): void {
    const trimmed = key.trim()
    if (trimmed.length > 10) {
      this.apiKey = trimmed
      this.configurationStatus = 'CONFIGURED'
      this.healthStatus = 'HEALTHY'
    } else {
      this.apiKey = null
      this.configurationStatus = 'INVALID_CREDENTIALS'
      this.healthStatus = 'CONFIGURATION_REQUIRED'
    }
  }

  public getQuotaState(): YouTubeQuotaState {
    return this.quotaManager.getQuotaState()
  }

  /**
   * Pencarian Video Terkait Isu / Kata Kunci
   * Operasi ini mengonsumsi 100 unit kuota YouTube Data API
   */
  public async searchVideos(
    query: string,
    options?: {
      maxResults?: number
      publishedAfter?: string
      regionCode?: string
      customFetch?: typeof fetch
    }
  ): Promise<{
    success: boolean
    results: SearchDiscoveryResult[]
    errorCode?: string
    errorMessage?: string
    quotaUsed: number
  }> {
    this.lastCheckedAt = Date.now()

    if (!this.apiKey) {
      this.healthStatus = 'CONFIGURATION_REQUIRED'
      return {
        success: false,
        results: [],
        errorCode: 'YOUTUBE_API_KEY_REQUIRED',
        errorMessage: 'Kredensial YouTube Data API v3 belum dikonfigurasi. Masukkan API key pada pengaturan NARADA.',
        quotaUsed: 0
      }
    }

    // Periksa Kuota (100 unit untuk search.list)
    const SEARCH_COST = 100
    if (!this.quotaManager.canConsume(SEARCH_COST)) {
      this.healthStatus = 'RATE_LIMITED'
      return {
        success: false,
        results: [],
        errorCode: 'QUOTA_EXHAUSTED',
        errorMessage: 'Batas kuota harian YouTube Data API (10.000 unit) telah habis.',
        quotaUsed: 0
      }
    }

    const fetchFn = options?.customFetch || (typeof fetch !== 'undefined' ? fetch : null)
    if (!fetchFn) {
      return {
        success: false,
        results: [],
        errorCode: 'NO_FETCH_AVAILABLE',
        errorMessage: 'Runtime fetch API tidak tersedia',
        quotaUsed: 0
      }
    }

    const maxResults = Math.min(options?.maxResults || 10, 25)
    const params = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: maxResults.toString(),
      relevanceLanguage: 'id',
      key: this.apiKey
    })

    if (options?.publishedAfter) {
      params.append('publishedAfter', options.publishedAfter)
    }
    if (options?.regionCode) {
      params.append('regionCode', options.regionCode)
    }

    const endpoint = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`

    try {
      const res = await (fetchFn as any)(endpoint, {
        headers: { 'Accept': 'application/json' }
      })

      if (res.status === 403) {
        const errJson = await res.json().catch(() => ({}))
        const reason = errJson?.error?.errors?.[0]?.reason || 'forbidden'
        if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
          this.healthStatus = 'RATE_LIMITED'
          return {
            success: false,
            results: [],
            errorCode: 'QUOTA_EXHAUSTED_UPSTREAM',
            errorMessage: 'Upstream Google Cloud melaporkan kuota YouTube Data API terlampaui.',
            quotaUsed: 0
          }
        }
        this.healthStatus = 'ACCESS_RESTRICTED'
        return {
          success: false,
          results: [],
          errorCode: 'API_KEY_INVALID_OR_RESTRICTED',
          errorMessage: 'API Key YouTube ditolak atau tidak memiliki izin akses YouTube Data API v3.',
          quotaUsed: 0
        }
      }

      if (!res.ok) {
        this.healthStatus = 'DEGRADED'
        return {
          success: false,
          results: [],
          errorCode: `HTTP_${res.status}`,
          errorMessage: `YouTube API mengembalikan respons error HTTP ${res.status}`,
          quotaUsed: 0
        }
      }

      const data = await res.json()
      this.quotaManager.recordUsage(SEARCH_COST)
      this.lastSuccessfulAt = Date.now()
      this.healthStatus = 'HEALTHY'

      const items: any[] = data.items || []
      const results: SearchDiscoveryResult[] = items
        .filter((item: any) => item.id?.videoId)
        .map((item: any, idx: number) => {
          const videoId = item.id.videoId
          const snippet = item.snippet || {}
          const publishedAtTs = snippet.publishedAt ? Date.parse(snippet.publishedAt) : null

          return {
            id: `yt-video-${videoId}`,
            providerId: 'youtube-official-api',
            queryId: `q-${Date.now()}-${idx}`,
            targetPlatform: 'youtube',
            originalUrl: `https://www.youtube.com/watch?v=${videoId}`,
            canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
            title: snippet.title || 'Video YouTube',
            snippet: snippet.description || '',
            publishedAt: publishedAtTs && !isNaN(publishedAtTs) ? publishedAtTs : null,
            publishedAtPrecision: publishedAtTs ? 'EXACT' : 'UNKNOWN',
            indexedAt: Date.now(),
            discoveredAt: Date.now(),
            searchRank: idx + 1,
            platformIdentity: {
              videoId,
              channelId: snippet.channelId,
              channelTitle: snippet.channelTitle
            },
            sourceMetadata: {
              channelTitle: snippet.channelTitle,
              thumbnails: snippet.thumbnails,
              liveBroadcastContent: snippet.liveBroadcastContent
            },
            contentStatus: 'METADATA_AVAILABLE',
            relevanceStatus: 'PENDING',
            ingestionStatus: 'DISCOVERED',
            provenance: {
              recordId: `prov-yt-${videoId}`,
              connectorId: this.connectorId,
              providerId: 'youtube-official-api',
              platform: 'youtube',
              originalUrl: `https://www.youtube.com/watch?v=${videoId}`,
              canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
              queryMethod: `search.list?q=${query}`,
              acquiredAt: Date.now(),
              publishedAt: publishedAtTs,
              publishedAtPrecision: publishedAtTs ? 'EXACT' : 'UNKNOWN',
              indexedAt: Date.now(),
              firstDiscoveredAt: Date.now(),
              lastObservedAt: Date.now(),
              lastContentValidatedAt: null,
              contentCompleteness: 'TITLE_AND_SNIPPET',
              sourceAccessState: 'PUBLIC',
              validationState: 'PENDING',
              deduplicationState: 'UNIQUE'
            },
            limitations: [
              'Data berasal dari ringkasan metadata API; teks transkrip lengkap memerlukan resolusi lanjutan'
            ],
            isProvisional: true
          }
        })

      if (results.length > 0) {
        this.lastItemReceivedAt = Date.now()
      }

      return {
        success: true,
        results,
        quotaUsed: SEARCH_COST
      }
    } catch (err: any) {
      this.healthStatus = 'UNAVAILABLE'
      return {
        success: false,
        results: [],
        errorCode: 'FETCH_ERROR',
        errorMessage: err?.message || 'Gagal menghubungi server YouTube API',
        quotaUsed: 0
      }
    }
  }

  /**
   * Mengambil Detail Metadata Video (Mengonsumsi 1 unit kuota)
   */
  public async getVideoDetails(
    videoId: string,
    options?: { customFetch?: typeof fetch }
  ): Promise<{ success: boolean; metadata?: YouTubeVideoMetadata; errorCode?: string; errorMessage?: string }> {
    if (!this.apiKey) {
      return { success: false, errorCode: 'YOUTUBE_API_KEY_REQUIRED', errorMessage: 'API key belum disetel' }
    }

    if (!this.quotaManager.canConsume(1)) {
      return { success: false, errorCode: 'QUOTA_EXHAUSTED', errorMessage: 'Batas kuota harian habis' }
    }

    const fetchFn = options?.customFetch || (typeof fetch !== 'undefined' ? fetch : null)
    if (!fetchFn) return { success: false, errorCode: 'NO_FETCH_AVAILABLE', errorMessage: 'Fetch API tidak tersedia' }

    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${this.apiKey}`

    try {
      const res = await (fetchFn as any)(url)
      if (!res.ok) {
        return { success: false, errorCode: `HTTP_${res.status}`, errorMessage: 'Gagal mengambil rincian video' }
      }

      const data = await res.json()
      this.quotaManager.recordUsage(1)

      const item = data.items?.[0]
      if (!item) {
        return { success: false, errorCode: 'VIDEO_NOT_FOUND', errorMessage: 'Video tidak ditemukan di YouTube' }
      }

      const snippet = item.snippet || {}
      const stats = item.statistics || {}

      const meta: YouTubeVideoMetadata = {
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: snippet.title || '',
        description: snippet.description || '',
        channelId: snippet.channelId || '',
        channelTitle: snippet.channelTitle || '',
        publishedAt: snippet.publishedAt || '',
        duration: item.contentDetails?.duration,
        viewCount: stats.viewCount ? parseInt(stats.viewCount, 10) : undefined,
        likeCount: stats.likeCount ? parseInt(stats.likeCount, 10) : undefined,
        commentCount: stats.commentCount ? parseInt(stats.commentCount, 10) : undefined,
        commentsDisabled: stats.commentCount === undefined,
        observationTimestamp: Date.now()
      }

      return { success: true, metadata: meta }
    } catch (err: any) {
      return { success: false, errorCode: 'NETWORK_ERROR', errorMessage: err?.message || 'Gagal menghubungi YouTube API' }
    }
  }

  /**
   * Mengambil Komentar Teratas Video (Mengonsumsi 1 unit kuota)
   * Menghormati video dengan komentar dinonaktifkan
   */
  public async getVideoComments(
    videoId: string,
    options?: { maxResults?: number; customFetch?: typeof fetch }
  ): Promise<{ success: boolean; comments: YouTubeCommentItem[]; errorCode?: string; errorMessage?: string }> {
    if (!this.apiKey) {
      return { success: false, comments: [], errorCode: 'YOUTUBE_API_KEY_REQUIRED', errorMessage: 'API key belum disetel' }
    }

    if (!this.quotaManager.canConsume(1)) {
      return { success: false, comments: [], errorCode: 'QUOTA_EXHAUSTED', errorMessage: 'Batas kuota harian habis' }
    }

    const fetchFn = options?.customFetch || (typeof fetch !== 'undefined' ? fetch : null)
    if (!fetchFn) return { success: false, comments: [], errorCode: 'NO_FETCH_AVAILABLE', errorMessage: 'Fetch API tidak tersedia' }

    const maxResults = Math.min(options?.maxResults || 20, 50)
    const url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=${maxResults}&key=${this.apiKey}`

    try {
      const res = await (fetchFn as any)(url)
      if (res.status === 403) {
        const errJson = await res.json().catch(() => ({}))
        const reason = errJson?.error?.errors?.[0]?.reason || ''
        if (reason === 'commentsDisabled') {
          return {
            success: false,
            comments: [],
            errorCode: 'COMMENTS_DISABLED',
            errorMessage: 'Komentar pada video ini dinonaktifkan oleh pemilik kanal.'
          }
        }
      }

      if (!res.ok) {
        return { success: false, comments: [], errorCode: `HTTP_${res.status}`, errorMessage: 'Gagal mengambil komentar video' }
      }

      const data = await res.json()
      this.quotaManager.recordUsage(1)

      const rawItems: any[] = data.items || []
      const comments: YouTubeCommentItem[] = rawItems.map(item => {
        const top = item.snippet?.topLevelComment?.snippet || {}
        return {
          id: item.id || `cmt-${Date.now()}`,
          videoId,
          authorName: top.authorDisplayName || 'Anonim',
          authorChannelUrl: top.authorChannelUrl,
          textOriginal: top.textOriginal || top.textDisplay || '',
          likeCount: top.likeCount || 0,
          publishedAt: top.publishedAt || new Date().toISOString(),
          updatedAt: top.updatedAt || top.publishedAt || new Date().toISOString()
        }
      })

      return { success: true, comments }
    } catch (err: any) {
      return { success: false, comments: [], errorCode: 'NETWORK_ERROR', errorMessage: err?.message || 'Gagal menghubungi YouTube API' }
    }
  }
}

export const youtubeConnector = new YouTubeConnector()
