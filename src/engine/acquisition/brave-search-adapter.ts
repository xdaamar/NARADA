/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — BRAVE SEARCH API ADAPTER & SEARCH PROVIDER CONTINUITY
 * SPRINT 11: WORK PACKAGE 1 (SEARCH PROVIDER CONTINUITY AND DISCOVERY)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Dasar Keputusan Arsitektural:
 * 1. Google Custom Search JSON API Deprecation:
 *    - Google secara resmi menutup pendaftaran CSE JSON API untuk pelanggan baru,
 *      dan menetapkan batas waktu transisi migrasi penuh paling lambat 2027-01-01.
 * 2. Brave Search API sebagai Kandidat Utama Migrasi:
 *    - Menawarkan endpoint Web Search independen dengan indeks web berdaulat.
 *    - Mendukung operator 'site:' untuk penargetan domain platform sosial.
 *    - Mendukung filter bahasa Indonesia ('search_lang=id') dan wilayah ('country=ID').
 *    - Struktur biaya resmi: USD 5,00 per 1.000 kueri (estimasi USD 0,005 per permintaan)
 *      dengan alokasi kredit gratis bulanan USD 5,00.
 * 3. Budget & Headroom Governance:
 *    - Mengelola anggaran biaya harian dan batas kuota kueri sebelum eksekusi.
 *    - Menangani HTTP 429 (Rate Limit) dan memproteksi kredensial dari log.
 * ══════════════════════════════════════════════════════════════════════════
 */

import type { SearchProviderAdapter } from './dorking-discovery-engine.ts'
import type { TargetPlatform } from './source-contracts.ts'

export const BRAVE_SEARCH_API_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search'
export const BRAVE_COST_PER_REQUEST_USD = 0.005 // $5.00 / 1000 requests

export interface BraveBudgetState {
  dailyRequestLimit: number
  requestsToday: number
  remainingRequests: number
  estimatedCostTodayUsd: number
  isBudgetExhausted: boolean
  lastResetAt: number
}

export class BraveSearchAdapter implements SearchProviderAdapter {
  public readonly providerId = 'brave-search-api'
  public readonly displayName = 'Brave Search API (Web Search Endpoint)'

  private apiKey: string | null = null
  private dailyRequestLimit: number
  private requestsToday = 0
  private lastResetAt: number
  private headroomRequests: number

  constructor(options?: {
    apiKey?: string
    dailyRequestLimit?: number
    headroomRequests?: number
  }) {
    this.dailyRequestLimit = options?.dailyRequestLimit !== undefined ? options.dailyRequestLimit : 200 // Default 200 requests/day ($1.00/day)
    this.headroomRequests = options?.headroomRequests || 10
    this.lastResetAt = this.calculateMidnightUtc()

    if (options?.apiKey) {
      this.apiKey = options.apiKey.trim()
    } else {
      const env = typeof (globalThis as any).process !== 'undefined' ? (globalThis as any).process?.env : undefined
      if (env?.BRAVE_SEARCH_API_KEY) {
        this.apiKey = env.BRAVE_SEARCH_API_KEY.trim()
      }
    }
  }

  private calculateMidnightUtc(): number {
    const d = new Date()
    d.setUTCHours(24, 0, 0, 0)
    return d.getTime()
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 5)
  }

  public setApiKey(key: string): void {
    const trimmed = key ? key.trim() : ''
    this.apiKey = trimmed.length > 5 ? trimmed : null
  }

  public getBudgetState(): BraveBudgetState {
    const now = Date.now()
    if (now >= this.lastResetAt) {
      this.requestsToday = 0
      this.lastResetAt = this.calculateMidnightUtc()
    }

    const remaining = Math.max(0, this.dailyRequestLimit - this.requestsToday)
    return {
      dailyRequestLimit: this.dailyRequestLimit,
      requestsToday: this.requestsToday,
      remainingRequests: remaining,
      estimatedCostTodayUsd: Number((this.requestsToday * BRAVE_COST_PER_REQUEST_USD).toFixed(4)),
      isBudgetExhausted: remaining <= this.headroomRequests,
      lastResetAt: this.lastResetAt
    }
  }

  public canSearch(requestedCount = 1): boolean {
    const budget = this.getBudgetState()
    return budget.remainingRequests >= (requestedCount + this.headroomRequests)
  }

  public async search(
    dorkQuery: string,
    options?: {
      targetPlatform?: TargetPlatform
      maxResults?: number
      customFetch?: typeof fetch
      freshness?: string
    }
  ): Promise<{
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
    costEstimatedUsd?: number
    operatorApplied?: boolean
    queryCleaned?: string
  }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        items: [],
        errorCode: 'SEARCH_CREDENTIALS_REQUIRED',
        errorMessage: 'Kredensial Brave Search API (X-Subscription-Token) belum dikonfigurasi pada pengaturan NARADA.'
      }
    }

    if (this.dailyRequestLimit <= 0) {
      return {
        success: false,
        items: [],
        errorCode: 'BUDGET_NOT_CONFIGURED',
        errorMessage: 'Batas anggaran (request ceiling) harian Brave Search belum dikonfigurasi.'
      }
    }

    if (!this.canSearch(1)) {
      return {
        success: false,
        items: [],
        errorCode: 'SEARCH_BUDGET_EXHAUSTED',
        errorMessage: `Batas anggaran harian Brave Search (${this.dailyRequestLimit} permintaan/hari) telah tercapai.`
      }
    }

    const fetchFn = options?.customFetch || (typeof fetch !== 'undefined' ? fetch : null)
    if (!fetchFn) {
      return {
        success: false,
        items: [],
        errorCode: 'NO_FETCH_AVAILABLE',
        errorMessage: 'Runtime fetch API tidak tersedia di environment ini'
      }
    }

    const count = Math.min(options?.maxResults || 10, 20)
    const params = new URLSearchParams({
      q: dorkQuery,
      count: count.toString(),
      country: 'ID',
      search_lang: 'id',
      text_decorations: 'false',
      spellcheck: 'true'
    })

    if (options?.freshness) {
      params.append('freshness', options.freshness)
    }

    const endpoint = `${BRAVE_SEARCH_API_ENDPOINT}?${params.toString()}`

    try {
      const res = await (fetchFn as any)(endpoint, {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': this.apiKey!
        }
      })

      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          items: [],
          errorCode: 'INVALID_CREDENTIALS',
          errorMessage: 'Token langganan Brave Search API tidak valid atau masa berlaku telah habis.'
        }
      }

      if (res.status === 429) {
        return {
          success: false,
          items: [],
          errorCode: 'SEARCH_RATE_LIMITED',
          errorMessage: 'Brave Search API melaporkan rate limit terlampaui (HTTP 429).'
        }
      }

      if (!res.ok) {
        return {
          success: false,
          items: [],
          errorCode: `HTTP_${res.status}`,
          errorMessage: `Brave Search API mengembalikan respons HTTP ${res.status}`
        }
      }

      const data = await res.json()
      this.requestsToday++

      const rawResults: any[] = data.web?.results || []
      const items = rawResults.map((item, idx) => ({
        url: item.url || '',
        title: item.title || '',
        snippet: item.description || item.snippet || '',
        searchRank: idx + 1,
        publishedAt: item.page_age || item.age || null
      }))

      // Validasi metadata operator penelusuran dari respons Brave API
      const searchOperators = data.query?.search_operators || data.query?.operators
      const operatorApplied = Boolean(
        data.query?.is_navigational !== true &&
        (searchOperators?.applied === true || searchOperators?.site !== undefined || dorkQuery.includes('site:'))
      )

      return {
        success: true,
        items,
        costEstimatedUsd: BRAVE_COST_PER_REQUEST_USD,
        operatorApplied,
        queryCleaned: data.query?.cleaned || dorkQuery
      }
    } catch (err: any) {
      const sanitizedMsg = (err?.message || 'Gagal menghubungi server Brave Search API')
        .replace(/([a-zA-Z0-9_-]{20,})/g, '[REDACTED_TOKEN]')
      return {
        success: false,
        items: [],
        errorCode: 'NETWORK_ERROR',
        errorMessage: sanitizedMsg
      }
    }
  }
}

export const braveSearchAdapter = new BraveSearchAdapter()

