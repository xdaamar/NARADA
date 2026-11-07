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
  ConfigurationStatus,
  CapabilityStatus,
  YouTubePolicySection
} from './source-contracts.ts'
import {
  evaluateYouTubeCapability
} from './source-contracts.ts'
import {
  youtubeRetentionManager,
  YOUTUBE_MAX_RETENTION_MS
} from './youtube-retention.ts'
import type { SocialContentStatus } from '../social/social-contracts.ts'

export interface YouTubeQuotaBuckets {
  searchRequests: {
    dailyLimit: number
    used: number
    remaining: number
  }
  generalUnits: {
    dailyLimit: number
    used: number
    remaining: number
  }
}

export interface YouTubeQuotaState {
  dailyLimitUnits: number
  usedUnits: number
  remainingUnits: number
  resetTimestamp: number
  isExhausted: boolean
  lastRequestAt: number | null
  buckets: YouTubeQuotaBuckets
  priorityHeadroomUnits: number
  nextResetPtIso: string
}

export interface QuotaReservation {
  reservationId: string
  endpoint: string
  units: number
  isSearchCall: boolean
  reservedAt: number
  committed: boolean
  dispatched?: boolean
}

export const YOUTUBE_ENDPOINT_COSTS: Record<string, { units: number; isSearchCall?: boolean }> = {
  'search.list': { units: 1, isSearchCall: true },
  'videos.list': { units: 1 },
  'commentThreads.list': { units: 1 },
  'comments.list': { units: 1 },
  'channels.list': { units: 1 }
}

/**
 * Menghitung waktu pergantian hari (midnight) berikutnya berdasarkan zona waktu Pacific Time (PT)
 * sesuai dokumentasi resmi Google Cloud Platform & YouTube Data API
 */
export function calculateNextPacificMidnight(nowMs = Date.now()): number {
  const d = new Date(nowMs)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  const parts = Object.fromEntries(formatter.formatToParts(d).map(p => [p.type, p.value]))
  const h = parseInt(parts.hour, 10) % 24
  const m = parseInt(parts.minute, 10)
  const s = parseInt(parts.second, 10)
  const msIntoDay = ((h * 60 + m) * 60 + s) * 1000 + (nowMs % 1000)
  const msRemaining = (24 * 60 * 60 * 1000) - msIntoDay
  return nowMs + msRemaining
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
 * Manajer Kuota YouTube API v3 Terkoreksi (Sprint 11 WP 2 & Gate D)
 * Menegakkan:
 * 1. Bucket terpisah untuk search.list (100 panggilan/hari)
 * 2. Bucket unit gabungan untuk endpoint lainnya (10.000 unit/hari)
 * 3. Pergantian harian pada midnight Pacific Time (PT)
 * 4. Reservasi atomik (reserve, commit, rollback) untuk mencegah overspend
 * 5. Headroom tersimpan untuk operasional prioritas analis
 */
export class YouTubeQuotaManager {
  private dailyLimitUnits: number
  private dailyLimitSearches: number
  private usedUnits = 0
  private usedSearches = 0
  private resetAt: number
  private lastRequestAt: number | null = null
  private priorityHeadroomUnits: number
  private priorityHeadroomSearches: number
  private reservations: Map<string, QuotaReservation> = new Map()

  constructor(options?: {
    dailyLimit?: number
    dailyLimitUnits?: number
    dailyLimitSearches?: number
    headroomUnits?: number
    headroomSearches?: number
    now?: number
  } | number) {
    const rawLimit = typeof options === 'number' ? options : options?.dailyLimitUnits || options?.dailyLimit || 10000
    const opts = typeof options === 'object' ? options : {}
    const now = opts.now || Date.now()

    this.dailyLimitUnits = rawLimit
    this.dailyLimitSearches = opts.dailyLimitSearches ?? 100
    this.priorityHeadroomUnits = opts.headroomUnits ?? 50
    this.priorityHeadroomSearches = opts.headroomSearches ?? 5
    this.resetAt = calculateNextPacificMidnight(now)
  }

  public checkRollover(now = Date.now()): void {
    if (now >= this.resetAt) {
      this.usedUnits = 0
      this.usedSearches = 0
      this.reservations.clear()
      this.resetAt = calculateNextPacificMidnight(now)
    }
  }

  public getQuotaState(now = Date.now()): YouTubeQuotaState {
    this.checkRollover(now)

    const remainingUnits = Math.max(0, this.dailyLimitUnits - this.usedUnits)
    const remainingSearches = Math.max(0, this.dailyLimitSearches - this.usedSearches)

    return {
      dailyLimitUnits: this.dailyLimitUnits,
      usedUnits: this.usedUnits,
      remainingUnits,
      resetTimestamp: this.resetAt,
      isExhausted: remainingUnits <= this.priorityHeadroomUnits,
      lastRequestAt: this.lastRequestAt,
      buckets: {
        searchRequests: {
          dailyLimit: this.dailyLimitSearches,
          used: this.usedSearches,
          remaining: remainingSearches
        },
        generalUnits: {
          dailyLimit: this.dailyLimitUnits,
          used: this.usedUnits,
          remaining: remainingUnits
        }
      },
      priorityHeadroomUnits: this.priorityHeadroomUnits,
      nextResetPtIso: new Date(this.resetAt).toISOString()
    }
  }

  public canConsume(units: number, isSearch = false, isPriority = false): boolean {
    const state = this.getQuotaState()
    const headroomU = isPriority ? 0 : this.priorityHeadroomUnits
    const headroomS = isPriority ? 0 : this.priorityHeadroomSearches

    if (isSearch) {
      if (state.buckets.searchRequests.remaining <= headroomS) return false
    }
    return state.remainingUnits >= (units + headroomU)
  }

  public reserveQuota(endpoint: string, options?: { costUnits?: number; isPriority?: boolean }): {
    reservationId: string
    allowed: boolean
    reason?: string
    costUnits: number
  } {
    const config = YOUTUBE_ENDPOINT_COSTS[endpoint] || { units: options?.costUnits || 1 }
    const cost = options?.costUnits ?? config.units
    const isSearch = Boolean(config.isSearchCall)
    const isPriority = Boolean(options?.isPriority)

    if (!this.canConsume(cost, isSearch, isPriority)) {
      const state = this.getQuotaState()
      const reason = isSearch && state.buckets.searchRequests.remaining <= (isPriority ? 0 : this.priorityHeadroomSearches)
        ? 'SEARCH_REQUESTS_EXHAUSTED'
        : 'GENERAL_UNITS_EXHAUSTED'
      return {
        reservationId: '',
        allowed: false,
        reason,
        costUnits: cost
      }
    }

    const reservationId = `yt-res-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    this.reservations.set(reservationId, {
      reservationId,
      endpoint,
      units: cost,
      isSearchCall: isSearch,
      reservedAt: Date.now(),
      committed: false,
      dispatched: false
    })

    if (isSearch) {
      this.usedSearches += 1
    } else {
      this.usedUnits += cost
    }
    this.lastRequestAt = Date.now()

    return {
      reservationId,
      allowed: true,
      costUnits: cost
    }
  }

  public markDispatched(reservationId: string): void {
    const res = this.reservations.get(reservationId)
    if (res) {
      res.dispatched = true
    }
  }

  public commitUsage(reservationId: string): void {
    const res = this.reservations.get(reservationId)
    if (res) {
      res.committed = true
      this.lastRequestAt = Date.now()
    }
  }

  public rollbackUsage(reservationId: string, force = false): void {
    const res = this.reservations.get(reservationId)
    if (res && !res.committed) {
      // Kebijakan Konservatif: Jika permintaan sudah dikirim ke jaringan Google,
      // jangan kembalikan kuota secara sepihak karena server Google kemungkinan besar telah memprosesnya.
      if (res.dispatched && !force) {
        res.committed = true
        return
      }

      if (res.isSearchCall) {
        this.usedSearches = Math.max(0, this.usedSearches - 1)
      } else {
        this.usedUnits = Math.max(0, this.usedUnits - res.units)
      }
      this.reservations.delete(reservationId)
    }
  }

  public recordUsage(units: number, isSearch = false): void {
    this.checkRollover()
    this.usedUnits += units
    if (isSearch) this.usedSearches += 1
    this.lastRequestAt = Date.now()
  }

  public resetQuota(now = Date.now()): void {
    this.usedUnits = 0
    this.usedSearches = 0
    this.reservations.clear()
    this.resetAt = calculateNextPacificMidnight(now)
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
      isPriority?: boolean
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

    // Reservasi atomik kuota untuk search.list (1 request pencarian dan 100 unit)
    const reservation = this.quotaManager.reserveQuota('search.list', { isPriority: options?.isPriority })
    if (!reservation.allowed) {
      this.healthStatus = 'RATE_LIMITED'
      return {
        success: false,
        results: [],
        errorCode: 'QUOTA_EXHAUSTED',
        errorMessage: reservation.reason === 'SEARCH_REQUESTS_EXHAUSTED'
          ? 'Batas harian kueri pencarian YouTube Data API (100 kueri/hari) telah habis.'
          : 'Batas kuota harian unit YouTube Data API telah habis.',
        quotaUsed: 0
      }
    }

    const fetchFn = options?.customFetch || (typeof fetch !== 'undefined' ? fetch : null)
    if (!fetchFn) {
      this.quotaManager.rollbackUsage(reservation.reservationId)
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

    this.quotaManager.markDispatched(reservation.reservationId)

    try {
      const res = await (fetchFn as any)(endpoint, {
        headers: { 'Accept': 'application/json' }
      })

      if (res.status === 403) {
        this.quotaManager.commitUsage(reservation.reservationId) // Upstream Google charges for 403 quota/forbidden
        const errJson = await res.json().catch(() => ({}))
        const reason = errJson?.error?.errors?.[0]?.reason || 'forbidden'
        if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
          this.healthStatus = 'RATE_LIMITED'
          return {
            success: false,
            results: [],
            errorCode: 'QUOTA_EXHAUSTED_UPSTREAM',
            errorMessage: 'Upstream Google Cloud melaporkan kuota YouTube Data API terlampaui.',
            quotaUsed: reservation.costUnits
          }
        }
        this.healthStatus = 'ACCESS_RESTRICTED'
        return {
          success: false,
          results: [],
          errorCode: 'API_KEY_INVALID_OR_RESTRICTED',
          errorMessage: 'API Key YouTube ditolak atau tidak memiliki izin akses YouTube Data API v3.',
          quotaUsed: reservation.costUnits
        }
      }

      if (!res.ok) {
        this.quotaManager.commitUsage(reservation.reservationId)
        this.healthStatus = 'DEGRADED'
        return {
          success: false,
          results: [],
          errorCode: `HTTP_${res.status}`,
          errorMessage: `YouTube API mengembalikan respons error HTTP ${res.status}`,
          quotaUsed: reservation.costUnits
        }
      }

      const data = await res.json()
      this.quotaManager.commitUsage(reservation.reservationId)
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
              'Data berasal dari ringkasan metadata API; teks transkrip lengkap memerlukan resolusi lanjutan',
              'YOUTUBE_POLICY_III_E_2: Agregasi data lintas-kanal dilarang keras tanpa persetujuan tertulis eksplisit',
              'YOUTUBE_POLICY_III_E_4: Data tunduk pada batas retensi maksimal 30 hari kalender'
            ],
            isProvisional: true,
            retentionExpiresAt: Date.now() + YOUTUBE_MAX_RETENTION_MS,
            isCrossChannelAggregationProhibited: true,
            attributionRequired: true
          }
        })

      if (results.length > 0) {
        this.lastItemReceivedAt = Date.now()
      }

      return {
        success: true,
        results,
        quotaUsed: reservation.costUnits
      }
    } catch (err: any) {
      this.quotaManager.rollbackUsage(reservation.reservationId)
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
    options?: { customFetch?: typeof fetch; isPriority?: boolean }
  ): Promise<{ success: boolean; metadata?: YouTubeVideoMetadata; errorCode?: string; errorMessage?: string }> {
    if (!this.apiKey) {
      return { success: false, errorCode: 'YOUTUBE_API_KEY_REQUIRED', errorMessage: 'API key belum disetel' }
    }

    const reservation = this.quotaManager.reserveQuota('videos.list', { isPriority: options?.isPriority })
    if (!reservation.allowed) {
      return { success: false, errorCode: 'QUOTA_EXHAUSTED', errorMessage: 'Batas kuota harian habis' }
    }

    const fetchFn = options?.customFetch || (typeof fetch !== 'undefined' ? fetch : null)
    if (!fetchFn) {
      this.quotaManager.rollbackUsage(reservation.reservationId)
      return { success: false, errorCode: 'NO_FETCH_AVAILABLE', errorMessage: 'Fetch API tidak tersedia' }
    }

    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${this.apiKey}`

    this.quotaManager.markDispatched(reservation.reservationId)

    try {
      const res = await (fetchFn as any)(url)
      this.quotaManager.commitUsage(reservation.reservationId)

      if (!res.ok) {
        return { success: false, errorCode: `HTTP_${res.status}`, errorMessage: 'Gagal mengambil rincian video' }
      }

      const data = await res.json()
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
      this.quotaManager.rollbackUsage(reservation.reservationId)
      return { success: false, errorCode: 'NETWORK_ERROR', errorMessage: err?.message || 'Gagal menghubungi YouTube API' }
    }
  }

  /**
   * Mengambil Komentar Video dengan Dukungan Paginasi Resmi (Mengonsumsi 1 unit kuota per halaman)
   * Menghormati video dengan komentar dinonaktifkan, kosong, atau dilarang
   */
  public async getVideoComments(
    videoId: string,
    options?: {
      maxResults?: number
      pageToken?: string
      maxPages?: number
      customFetch?: typeof fetch
      isPriority?: boolean
    }
  ): Promise<{
    success: boolean
    comments: YouTubeCommentItem[]
    nextPageToken?: string
    pagesFetched: number
    quotaUsed: number
    contentStatus: SocialContentStatus
    errorCode?: string
    errorMessage?: string
  }> {
    if (!this.apiKey) {
      return {
        success: false,
        comments: [],
        pagesFetched: 0,
        quotaUsed: 0,
        contentStatus: 'ACCESS_RESTRICTED',
        errorCode: 'YOUTUBE_API_KEY_REQUIRED',
        errorMessage: 'API key belum disetel'
      }
    }

    const fetchFn = options?.customFetch || (typeof fetch !== 'undefined' ? fetch : null)
    if (!fetchFn) {
      return {
        success: false,
        comments: [],
        pagesFetched: 0,
        quotaUsed: 0,
        contentStatus: 'CONTENT_UNAVAILABLE',
        errorCode: 'NO_FETCH_AVAILABLE',
        errorMessage: 'Fetch API tidak tersedia'
      }
    }

    const maxResultsPerPage = Math.min(options?.maxResults || 20, 50)
    const maxPages = Math.min(Math.max(1, options?.maxPages || 1), 5)
    let currentPageToken: string | undefined = options?.pageToken
    const allComments: YouTubeCommentItem[] = []
    let totalQuotaUsed = 0
    let pagesFetched = 0

    while (pagesFetched < maxPages) {
      const reservation = this.quotaManager.reserveQuota('commentThreads.list', { isPriority: options?.isPriority })
      if (!reservation.allowed) {
        if (pagesFetched > 0) {
          // Parsial sukses halaman sebelumnya
          return {
            success: true,
            comments: allComments,
            nextPageToken: currentPageToken,
            pagesFetched,
            quotaUsed: totalQuotaUsed,
            contentStatus: 'COMMENTS_ACQUIRED',
            errorCode: 'QUOTA_EXHAUSTED_PARTIAL',
            errorMessage: 'Pengambilan komentar terhenti karena kuota harian habis.'
          }
        }
        return {
          success: false,
          comments: [],
          pagesFetched: 0,
          quotaUsed: 0,
          contentStatus: 'ACCESS_RESTRICTED',
          errorCode: 'QUOTA_EXHAUSTED',
          errorMessage: 'Batas kuota harian habis'
        }
      }

      const params = new URLSearchParams({
        part: 'snippet',
        videoId,
        maxResults: maxResultsPerPage.toString(),
        key: this.apiKey
      })
      if (currentPageToken) {
        params.append('pageToken', currentPageToken)
      }

      const url = `https://www.googleapis.com/youtube/v3/commentThreads?${params.toString()}`

      this.quotaManager.markDispatched(reservation.reservationId)

      try {
        const res = await (fetchFn as any)(url)
        this.quotaManager.commitUsage(reservation.reservationId)
        totalQuotaUsed += reservation.costUnits
        pagesFetched++

        if (res.status === 403) {
          const errJson = await res.json().catch(() => ({}))
          const reason = errJson?.error?.errors?.[0]?.reason || ''
          if (reason === 'commentsDisabled') {
            return {
              success: false,
              comments: [],
              pagesFetched,
              quotaUsed: totalQuotaUsed,
              contentStatus: 'COMMENTS_DISABLED',
              errorCode: 'COMMENTS_DISABLED',
              errorMessage: 'Komentar pada video ini dinonaktifkan oleh pemilik kanal.'
            }
          }
          return {
            success: false,
            comments: [],
            pagesFetched,
            quotaUsed: totalQuotaUsed,
            contentStatus: 'ACCESS_RESTRICTED',
            errorCode: 'COMMENTS_FORBIDDEN',
            errorMessage: 'Akses komentar ditolak oleh YouTube API.'
          }
        }

        if (res.status === 404) {
          return {
            success: false,
            comments: [],
            pagesFetched,
            quotaUsed: totalQuotaUsed,
            contentStatus: 'CONTENT_UNAVAILABLE',
            errorCode: 'VIDEO_NOT_FOUND',
            errorMessage: 'Video tidak ditemukan atau telah dihapus.'
          }
        }

        if (!res.ok) {
          return {
            success: false,
            comments: [],
            pagesFetched,
            quotaUsed: totalQuotaUsed,
            contentStatus: 'CONTENT_UNAVAILABLE',
            errorCode: `HTTP_${res.status}`,
            errorMessage: 'Gagal mengambil komentar video'
          }
        }

        const data = await res.json()
        const rawItems: any[] = data.items || []
        const pageComments: YouTubeCommentItem[] = rawItems.map(item => {
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

        allComments.push(...pageComments)
        currentPageToken = data.nextPageToken

        // Jika tidak ada halaman berikutnya, berhenti
        if (!currentPageToken) {
          break
        }
      } catch (err: any) {
        this.quotaManager.rollbackUsage(reservation.reservationId)
        return {
          success: false,
          comments: allComments,
          pagesFetched,
          quotaUsed: totalQuotaUsed,
          contentStatus: allComments.length > 0 ? 'COMMENTS_ACQUIRED' : 'CONTENT_UNAVAILABLE',
          errorCode: 'NETWORK_ERROR',
          errorMessage: err?.message || 'Gagal menghubungi YouTube API'
        }
      }
    }

    const finalStatus: SocialContentStatus = allComments.length === 0 ? 'COMMENTS_EMPTY' : 'COMMENTS_ACQUIRED'

    return {
      success: true,
      comments: allComments,
      nextPageToken: currentPageToken,
      pagesFetched,
      quotaUsed: totalQuotaUsed,
      contentStatus: finalStatus
    }
  }

  /**
   * Evaluasi Kepatuhan Kebijakan Pengembang YouTube (Section III.E.2 & III.E.4)
   */
  public evaluateCapability(
    capabilityName: string,
    context?: { isCrossChannel?: boolean; isCrossPlatform?: boolean; channelIds?: string[] }
  ): { isPermitted: boolean; status: CapabilityStatus; policySection: YouTubePolicySection; rationale: string } {
    return evaluateYouTubeCapability(capabilityName, context)
  }

  /**
   * Memeriksa apakah suatu kapabilitas operasional diizinkan
   */
  public isCapabilityPermitted(
    capabilityName: string,
    context?: { isCrossChannel?: boolean; isCrossPlatform?: boolean; channelIds?: string[] }
  ): boolean {
    const res = evaluateYouTubeCapability(capabilityName, context)
    return res.isPermitted
  }

  /**
   * Memvalidasi apakah agregasi komentar memenuhi batas kebijakan III.E.2
   */
  public validateCommentAggregation(channelIds: string[]) {
    return youtubeRetentionManager.validateCommentAggregation(channelIds)
  }

  /**
   * Memvalidasi apakah kombinasi metrik lintas platform diizinkan
   */
  public validateCrossPlatformCombination(platforms: string[]) {
    return youtubeRetentionManager.validateCrossPlatformCombination(platforms)
  }

  /**
   * Mengambil dokumentasi kepatuhan hukum untuk UI/Audit
   */
  public getComplianceDocumentation() {
    return youtubeRetentionManager.getComplianceDocumentation()
  }

  /**
   * Mengaudit atau memfilter data kedaluwarsa (30 hari)
   */
  public filterActiveRecords<T extends { acquiredAt?: number; discoveredAt?: number }>(records: T[], now = Date.now()) {
    return youtubeRetentionManager.filterActiveRecords(records, now)
  }
}

export const youtubeConnector = new YouTubeConnector()
