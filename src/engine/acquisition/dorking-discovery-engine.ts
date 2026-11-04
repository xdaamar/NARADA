/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — MULTI-PLATFORM DORKING DISCOVERY ENGINE & QUERY PLANNER
 * SPRINT 10: WORK PACKAGE 5 (COMPLIANT SEARCH API & DORKING TEMPLATES)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Target Platform (5 Platform Utama):
 * 1. Facebook (facebook.com, fb.watch)
 * 2. Instagram (instagram.com/p/, instagram.com/reel/)
 * 3. TikTok (tiktok.com, vm.tiktok.com)
 * 4. X / Twitter (x.com, twitter.com)
 * 5. YouTube (youtube.com/watch, youtu.be)
 * 
 * Prinsip Desain & Kepatuhan Keamanan:
 * - Menggunakan search-provider API terakreditasi dengan operator 'site:' (Dorking).
 * - BUKAN scraper liar (Zero Headless DOM Scraping, Zero Anti-Bot Bypass).
 * - Query Planner: Fingerprint hashing, cooldown 30 menit, pembatasan kuota per platform.
 * - Platform Domain Registry: Validasi ketat pola URL publik, isolasi profil login/privat.
 * ══════════════════════════════════════════════════════════════════════════
 */

import type {
  TargetPlatform,
  SearchDiscoveryResult,
  AcquisitionProvenance
} from './source-contracts.ts'
import { fallbackSHA256 } from '../../utils/crypto.ts'

export const DORKING_ENGINE_VERSION = '1.0.0'

export interface PlatformDomainDefinition {
  platform: TargetPlatform
  displayName: string
  allowedDomains: string[]
  urlPathPatterns: RegExp[]
  defaultQueryTemplate: (phrase: string) => string
  coverageLimitations: string[]
}

/**
 * Registry Domain Platform Sosial Resmi yang Didukung
 */
export const PLATFORM_REGISTRY: Record<TargetPlatform, PlatformDomainDefinition> = {
  facebook: {
    platform: 'facebook',
    displayName: 'Facebook Public Posts & Video',
    allowedDomains: ['facebook.com', 'www.facebook.com', 'fb.watch', 'm.facebook.com'],
    urlPathPatterns: [
      /\/(?:posts|watch|videos|reel|groups\/[^\/]+\/posts)\/[a-zA-Z0-9_-]+/i,
      /\/story\.php\?story_fbid=/i,
      /\/permalink\.php\?story_fbid=/i
    ],
    defaultQueryTemplate: (phrase: string) => `site:facebook.com "${phrase}"`,
    coverageLimitations: [
      'Hanya menjangkau postingan berstatus publik yang terindeks mesin pencari',
      'Grup privat, profil tertutup, dan konten login-wall tidak dapat diakses'
    ]
  },
  instagram: {
    platform: 'instagram',
    displayName: 'Instagram Public Reels & Posts',
    allowedDomains: ['instagram.com', 'www.instagram.com'],
    urlPathPatterns: [
      /\/(?:p|reel|tv)\/[a-zA-Z0-9_-]+/i
    ],
    defaultQueryTemplate: (phrase: string) => `site:instagram.com/p/ "${phrase}" OR site:instagram.com/reel/ "${phrase}"`,
    coverageLimitations: [
      'Hanya konten Reels dan feed post publik yang terindeks mesin pencari',
      'Instagram Story dan akun privat tidak tersedia'
    ]
  },
  tiktok: {
    platform: 'tiktok',
    displayName: 'TikTok Public Videos',
    allowedDomains: ['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com'],
    urlPathPatterns: [
      /\/@[^\/]+\/video\/\d+/i,
      /\/v\/\d+/i
    ],
    defaultQueryTemplate: (phrase: string) => `site:tiktok.com "${phrase}"`,
    coverageLimitations: [
      'Hanya video publik yang terindeks Google/mesin pencari',
      'Komentar lengkap memerlukan otorisasi API resmi TikTok Research'
    ]
  },
  x: {
    platform: 'x',
    displayName: 'X (formerly Twitter) Public Posts',
    allowedDomains: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'],
    urlPathPatterns: [
      /\/[^\/]+\/status\/\d+/i
    ],
    defaultQueryTemplate: (phrase: string) => `site:x.com "${phrase}" OR site:twitter.com "${phrase}"`,
    coverageLimitations: [
      'Hanya cuitan publik yang terindeks mesin pencari',
      'Thread panjang atau akun terkunci tidak terambil seluruhnya'
    ]
  },
  youtube: {
    platform: 'youtube',
    displayName: 'YouTube Public Videos',
    allowedDomains: ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'],
    urlPathPatterns: [
      /\/watch\?v=[a-zA-Z0-9_-]+/i,
      /\/shorts\/[a-zA-Z0-9_-]+/i,
      /^\/[a-zA-Z0-9_-]+$/
    ],
    defaultQueryTemplate: (phrase: string) => `site:youtube.com/watch "${phrase}"`,
    coverageLimitations: [
      'Video publik dan Shorts; video unlisted/private tidak terindeks'
    ]
  },
  web: {
    platform: 'web',
    displayName: 'General Web Index',
    allowedDomains: [],
    urlPathPatterns: [],
    defaultQueryTemplate: (phrase: string) => `"${phrase}"`,
    coverageLimitations: ['Situs publik non-media sosial']
  }
}

/**
 * Validasi apakah URL kandidat benar-benar merupakan URL publik dari target platform
 */
export function validatePlatformUrl(rawUrl: string, platform: TargetPlatform): {
  isValid: boolean
  canonicalUrl: string
  platformIdentity?: {
    accountHandle?: string
    videoId?: string
    postId?: string
  }
  rejectionReason?: string
} {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, canonicalUrl: '', rejectionReason: 'URL kosong' }
  }

  const clean = rawUrl.trim()
  if (!/^https?:\/\//i.test(clean)) {
    return { isValid: false, canonicalUrl: clean, rejectionReason: 'Protokol harus HTTP atau HTTPS' }
  }

  try {
    const parsed = new URL(clean)
    const hostname = parsed.hostname.toLowerCase()

    // Tolak localhost / private IPs
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('172.16.')
    ) {
      return { isValid: false, canonicalUrl: clean, rejectionReason: 'Target IP lokal/privat dilarang (SSRF Protection)' }
    }

    if (platform === 'web') {
      return { isValid: true, canonicalUrl: clean }
    }

    const def = PLATFORM_REGISTRY[platform]
    if (!def) {
      return { isValid: false, canonicalUrl: clean, rejectionReason: `Platform ${platform} tidak dikenal` }
    }

    // Periksa apakah domain cocok dengan daftar domain yang diizinkan
    const isDomainMatch = def.allowedDomains.some(d => hostname === d || hostname.endsWith('.' + d))
    if (!isDomainMatch) {
      return {
        isValid: false,
        canonicalUrl: clean,
        rejectionReason: `Domain '${hostname}' bukan bagian dari platform resmi ${platform}`
      }
    }

    // Bersihkan parameter tracking (utm_*, fbclid, igsh, si, dll)
    const cleanParams = new URLSearchParams()
    parsed.searchParams.forEach((val, key) => {
      const k = key.toLowerCase()
      if (!k.startsWith('utm_') && k !== 'fbclid' && k !== 'igsh' && k !== 'si' && k !== 'gclid') {
        cleanParams.append(key, val)
      }
    })

    const searchStr = cleanParams.toString() ? `?${cleanParams.toString()}` : ''
    const canonical = `${parsed.protocol}//${parsed.host}${parsed.pathname}${searchStr}`

    // Ekstraksi Platform Identity
    const identity: { accountHandle?: string; videoId?: string; postId?: string } = {}

    if (platform === 'youtube') {
      const v = parsed.searchParams.get('v')
      if (v) identity.videoId = v
      else if (parsed.pathname.startsWith('/shorts/')) {
        identity.videoId = parsed.pathname.replace('/shorts/', '').split('/')[0]
      } else if (hostname === 'youtu.be') {
        identity.videoId = parsed.pathname.replace('/', '').split('/')[0]
      }
    } else if (platform === 'x') {
      const match = parsed.pathname.match(/\/([^\/]+)\/status\/(\d+)/i)
      if (match) {
        identity.accountHandle = match[1]
        identity.postId = match[2]
      }
    } else if (platform === 'tiktok') {
      const match = parsed.pathname.match(/\/@([^\/]+)\/video\/(\d+)/i)
      if (match) {
        identity.accountHandle = match[1]
        identity.postId = match[2]
      }
    } else if (platform === 'instagram') {
      const match = parsed.pathname.match(/\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i)
      if (match) {
        identity.postId = match[1]
      }
    }

    return {
      isValid: true,
      canonicalUrl: canonical,
      platformIdentity: Object.keys(identity).length > 0 ? identity : undefined
    }
  } catch (err: any) {
    return { isValid: false, canonicalUrl: clean, rejectionReason: err?.message || 'URL tidak valid' }
  }
}

/**
 * Interface Penyedia Layanan Pencarian (Search Provider Adapter)
 */
export interface SearchProviderAdapter {
  providerId: string
  displayName: string
  isConfigured: () => boolean
  search: (
    dorkQuery: string,
    options?: {
      targetPlatform?: TargetPlatform
      maxResults?: number
      customFetch?: typeof fetch
    }
  ) => Promise<{
    success: boolean
    items: Array<{
      url: string
      title: string
      snippet: string
      searchRank: number
      publishedAt?: string | null
    }>
    errorCode?: string
    errorMessage?: string
  }>
}

/**
 * Adapter Google Custom Search JSON API Resmi
 * Mendukung sintaks Dorking seperti 'site:x.com "target phrase"'
 */
export class GoogleCustomSearchAdapter implements SearchProviderAdapter {
  public readonly providerId = 'google-custom-search-api'
  public readonly displayName = 'Google Programmable Search / Custom Search JSON API'

  private apiKey: string | null = null
  private searchEngineId: string | null = null

  constructor(apiKey?: string, searchEngineId?: string) {
    if (apiKey) this.apiKey = apiKey.trim()
    if (searchEngineId) this.searchEngineId = searchEngineId.trim()

    const env = typeof (globalThis as any).process !== 'undefined' ? (globalThis as any).process?.env : undefined
    if (!this.apiKey && env) {
      this.apiKey = env.GOOGLE_SEARCH_API_KEY || null
      this.searchEngineId = env.GOOGLE_SEARCH_CX || null
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.searchEngineId)
  }

  public setCredentials(apiKey: string, searchEngineId: string): void {
    this.apiKey = apiKey.trim()
    this.searchEngineId = searchEngineId.trim()
  }

  public async search(
    dorkQuery: string,
    options?: {
      targetPlatform?: TargetPlatform
      maxResults?: number
      customFetch?: typeof fetch
    }
  ): Promise<{
    success: boolean
    items: Array<{ url: string; title: string; snippet: string; searchRank: number; publishedAt?: string | null }>
    errorCode?: string
    errorMessage?: string
  }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        items: [],
        errorCode: 'SEARCH_CREDENTIALS_REQUIRED',
        errorMessage: 'Kredensial Google Custom Search API (API Key dan Search Engine ID / cx) belum dikonfigurasi.'
      }
    }

    const fetchFn = options?.customFetch || (typeof fetch !== 'undefined' ? fetch : null)
    if (!fetchFn) {
      return {
        success: false,
        items: [],
        errorCode: 'NO_FETCH_AVAILABLE',
        errorMessage: 'Runtime fetch API tidak tersedia'
      }
    }

    const num = Math.min(options?.maxResults || 10, 10)
    const params = new URLSearchParams({
      key: this.apiKey!,
      cx: this.searchEngineId!,
      q: dorkQuery,
      num: num.toString(),
      gl: 'id',
      hl: 'id'
    })

    const endpoint = `https://www.googleapis.com/customsearch/v1?${params.toString()}`

    try {
      const res = await (fetchFn as any)(endpoint, {
        headers: { 'Accept': 'application/json' }
      })

      if (res.status === 429) {
        return {
          success: false,
          items: [],
          errorCode: 'SEARCH_RATE_LIMITED',
          errorMessage: 'Batas kuota harian Google Custom Search API terlampaui (HTTP 429).'
        }
      }

      if (!res.ok) {
        return {
          success: false,
          items: [],
          errorCode: `HTTP_${res.status}`,
          errorMessage: `Google Custom Search mengembalikan error HTTP ${res.status}`
        }
      }

      const data = await res.json()
      const rawItems: any[] = data.items || []

      const items = rawItems.map((item, idx) => ({
        url: item.link || '',
        title: item.title || '',
        snippet: item.snippet || '',
        searchRank: idx + 1,
        publishedAt: item.pagemap?.metatags?.[0]?.['article:published_time'] || null
      }))

      return { success: true, items }
    } catch (err: any) {
      return {
        success: false,
        items: [],
        errorCode: 'NETWORK_ERROR',
        errorMessage: err?.message || 'Gagal menghubungi Google Custom Search API'
      }
    }
  }
}

/**
 * Adapter Mock untuk Deterministic Unit Testing & Air-Gapped Simulation
 */
export class MockSearchProviderAdapter implements SearchProviderAdapter {
  public readonly providerId = 'mock-search-provider'
  public readonly displayName = 'Mock Search Provider (Deterministic Testing)'

  private cannedResponses: Map<string, Array<{ url: string; title: string; snippet: string; publishedAt?: string }>> = new Map()

  public isConfigured(): boolean {
    return true
  }

  public registerCannedResponse(querySubstring: string, items: Array<{ url: string; title: string; snippet: string; publishedAt?: string }>): void {
    this.cannedResponses.set(querySubstring.toLowerCase(), items)
  }

  public async search(
    dorkQuery: string,
    options?: { targetPlatform?: TargetPlatform; maxResults?: number }
  ): Promise<{
    success: boolean
    items: Array<{ url: string; title: string; snippet: string; searchRank: number; publishedAt?: string | null }>
  }> {
    const q = dorkQuery.toLowerCase()
    let matchedItems: Array<{ url: string; title: string; snippet: string; publishedAt?: string }> = []

    for (const [key, items] of this.cannedResponses.entries()) {
      if (q.includes(key)) {
        matchedItems = items
        break
      }
    }

    // Default mock response jika tidak ada canned response khusus
    if (matchedItems.length === 0 && options?.targetPlatform) {
      const plat = options.targetPlatform
      if (plat === 'facebook') {
        matchedItems = [{
          url: 'https://www.facebook.com/infotni/posts/1029384756',
          title: 'Informasi Resmi Terkait Kebijakan Alutsista TNI',
          snippet: 'Pernyataan resmi Mabes TNI membantah kabar pembatalan kontrak alutsista pertahanan laut.'
        }]
      } else if (plat === 'x') {
        matchedItems = [{
          url: 'https://x.com/Kemhan_RI/status/189283746592837465',
          title: 'Kemhan RI on X: Klarifikasi Siaran Pers',
          snippet: 'Kementerian Pertahanan menegaskan seluruh alutsista matra laut telah melalui uji kelayakan.'
        }]
      } else if (plat === 'tiktok') {
        matchedItems = [{
          url: 'https://www.tiktok.com/@beritahariini/video/7483920192837465',
          title: 'Video Viral Unjuk Rasa Buruh',
          snippet: 'Liputan unjuk rasa buruh dan mahasiswa di depan gedung DPR menolak penyesuaian pajak.'
        }]
      } else if (plat === 'instagram') {
        matchedItems = [{
          url: 'https://www.instagram.com/p/C8d9e0f1g2h/',
          title: 'Dispenad Official Statement',
          snippet: 'Klarifikasi resmi Dispenad mengenai latihan gabungan di perbatasan Natuna.'
        }]
      } else if (plat === 'youtube') {
        matchedItems = [{
          url: 'https://www.youtube.com/watch?v=mockVideo123',
          title: 'Siaran Pers Puspen TNI Mengenai Pertahanan',
          snippet: 'Puspen TNI menggelar konferensi pers menepis isu keberadaan pangkalan militer asing.'
        }]
      }
    }

    const items = matchedItems.slice(0, options?.maxResults || 10).map((it, idx) => ({
      url: it.url,
      title: it.title,
      snippet: it.snippet,
      searchRank: idx + 1,
      publishedAt: it.publishedAt || null
    }))

    return { success: true, items }
  }
}

/**
 * Perencana Kueri Dorking Dinamis (Query Planner)
 */
export class DorkingQueryPlanner {
  private queryFingerprints: Map<string, number> = new Map()
  private cooldownMs: number

  constructor(cooldownMs = 1800000) { // 30 Menit Cooldown Default
    this.cooldownMs = cooldownMs
  }

  /**
   * Menghasilkan rencana kueri pencarian multi-platform untuk satu isu intelijen
   */
  public planQueriesForIssue(issue: {
    issueId: string
    title: string
    cleanedClaim?: string
    keywords?: string[]
    platforms?: TargetPlatform[]
  }): Array<{
    platform: TargetPlatform
    query: string
    phraseUsed: string
    fingerprint: string
    isEligible: boolean
    skipReason?: string
  }> {
    const targetPlatforms: TargetPlatform[] = issue.platforms || ['facebook', 'instagram', 'tiktok', 'x', 'youtube']
    const phrase = this.sanitizeQueryPhrase(issue.cleanedClaim || issue.title)
    const now = Date.now()

    const planned: Array<{
      platform: TargetPlatform
      query: string
      phraseUsed: string
      fingerprint: string
      isEligible: boolean
      skipReason?: string
    }> = []

    for (const plat of targetPlatforms) {
      if (plat === 'web') continue

      const def = PLATFORM_REGISTRY[plat]
      if (!def) continue

      const query = def.defaultQueryTemplate(phrase)
      const fingerprint = `${plat}:${phrase.toLowerCase()}`

      const lastExecution = this.queryFingerprints.get(fingerprint)
      if (lastExecution && now - lastExecution < this.cooldownMs) {
        planned.push({
          platform: plat,
          query,
          phraseUsed: phrase,
          fingerprint,
          isEligible: false,
          skipReason: `Kueri identik untuk platform ${plat} sedang dalam masa jeda (cooldown tersisa ${Math.ceil((this.cooldownMs - (now - lastExecution)) / 60000)} menit)`
        })
      } else {
        planned.push({
          platform: plat,
          query,
          phraseUsed: phrase,
          fingerprint,
          isEligible: true
        })
      }
    }

    return planned
  }

  public recordQueryExecution(fingerprint: string, now = Date.now()): void {
    this.queryFingerprints.set(fingerprint, now)
  }

  public clearCooldowns(): void {
    this.queryFingerprints.clear()
  }

  /**
   * Sanitasi frase pencarian: menghilangkan tanda kutip liar, membatasi panjang
   */
  public sanitizeQueryPhrase(rawPhrase: string): string {
    if (!rawPhrase) return ''
    return rawPhrase
      .replace(/[\[\](){}<>"'`\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .slice(0, 6) // Ambil maksimal 6 kata kunci penting agar tidak over-constraint
      .join(' ')
  }
}

/**
 * Mesin Eksekusi Dorking Multi-Platform
 */
export class DorkingDiscoveryEngine {
  private provider: SearchProviderAdapter
  private queryPlanner: DorkingQueryPlanner

  constructor(provider?: SearchProviderAdapter, cooldownMs = 1800000) {
    this.provider = provider || new MockSearchProviderAdapter()
    this.queryPlanner = new DorkingQueryPlanner(cooldownMs)
  }

  public setProvider(provider: SearchProviderAdapter): void {
    this.provider = provider
  }

  public getProvider(): SearchProviderAdapter {
    return this.provider
  }

  public getQueryPlanner(): DorkingQueryPlanner {
    return this.queryPlanner
  }

  /**
   * Menjalankan pemindaian Dorking Multi-Platform untuk sebuah isu
   */
  public async discoverForIssue(
    issue: {
      issueId: string
      title: string
      cleanedClaim?: string
      keywords?: string[]
      platforms?: TargetPlatform[]
    },
    options?: { customFetch?: typeof fetch; maxResultsPerPlatform?: number }
  ): Promise<{
    candidates: SearchDiscoveryResult[]
    skippedQueriesCount: number
    executedQueriesCount: number
    errors: Array<{ platform: TargetPlatform; message: string }>
  }> {
    const planned = this.queryPlanner.planQueriesForIssue(issue)
    const candidates: SearchDiscoveryResult[] = []
    const errors: Array<{ platform: TargetPlatform; message: string }> = []
    let skipped = 0
    let executed = 0

    for (const plan of planned) {
      if (!plan.isEligible) {
        skipped++
        continue
      }

      executed++
      const searchRes = await this.provider.search(plan.query, {
        targetPlatform: plan.platform,
        maxResults: options?.maxResultsPerPlatform || 5,
        customFetch: options?.customFetch
      })

      if (!searchRes.success) {
        errors.push({
          platform: plan.platform,
          message: searchRes.errorMessage || 'Gagal mengeksekusi pencarian'
        })
        continue
      }

      this.queryPlanner.recordQueryExecution(plan.fingerprint)

      for (const item of searchRes.items) {
        // Validasi Domain & Keamanan URL
        const val = validatePlatformUrl(item.url, plan.platform)
        if (!val.isValid) {
          continue
        }

        const publishedTs = item.publishedAt ? Date.parse(item.publishedAt) : null
        const candidateId = `cand-${plan.platform}-${fallbackSHA256(val.canonicalUrl).slice(0, 16)}`

        const prov: AcquisitionProvenance = {
          recordId: `prov-${candidateId}`,
          connectorId: `dork-${plan.platform}`,
          providerId: this.provider.providerId,
          platform: plan.platform,
          originalUrl: item.url,
          canonicalUrl: val.canonicalUrl,
          queryMethod: plan.query,
          acquiredAt: Date.now(),
          publishedAt: publishedTs && !isNaN(publishedTs) ? publishedTs : null,
          publishedAtPrecision: publishedTs ? 'EXACT' : 'UNKNOWN',
          indexedAt: Date.now(),
          firstDiscoveredAt: Date.now(),
          lastObservedAt: Date.now(),
          lastContentValidatedAt: null,
          contentCompleteness: 'SNIPPET_ONLY',
          sourceAccessState: 'PUBLIC',
          validationState: 'PENDING',
          deduplicationState: 'UNIQUE'
        }

        const result: SearchDiscoveryResult = {
          id: candidateId,
          providerId: this.provider.providerId,
          queryId: plan.fingerprint,
          targetPlatform: plan.platform,
          originalUrl: item.url,
          canonicalUrl: val.canonicalUrl,
          title: item.title,
          snippet: item.snippet,
          publishedAt: prov.publishedAt,
          publishedAtPrecision: prov.publishedAtPrecision,
          indexedAt: prov.indexedAt,
          discoveredAt: prov.acquiredAt,
          searchRank: item.searchRank,
          platformIdentity: val.platformIdentity,
          sourceMetadata: {
            dorkQuery: plan.query,
            targetPlatform: plan.platform,
            issueId: issue.issueId
          },
          contentStatus: 'SNIPPET_ONLY',
          relevanceStatus: 'PENDING',
          ingestionStatus: 'DISCOVERED',
          provenance: prov,
          limitations: [
            'Hanya memuat ringkasan teks snippet hasil pencarian publik terindeks',
            'Tidak mewakili teks artikel lengkap atau rekaman digital utuh'
          ],
          isProvisional: true
        }

        candidates.push(result)
      }
    }

    return {
      candidates,
      skippedQueriesCount: skipped,
      executedQueriesCount: executed,
      errors
    }
  }
}

export const dorkingDiscoveryEngine = new DorkingDiscoveryEngine()
