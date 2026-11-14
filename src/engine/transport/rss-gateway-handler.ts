/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — PRODUCTION-COMPATIBLE SECURE RSS GATEWAY HANDLER
 * SPRINT 1C: WORK PACKAGE 1 (SECURE TRANSPORT & SSRF FIREWALL)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Prinsip Desain & Kontrak Keamanan:
 * 1. Fixed Upstream Allowlist: Hanya melayani sourceId resmi yang aktif.
 * 2. Strict Anti-SSRF: Menolak URL injeksi kustom, IP lokal, loopback, private networks.
 * 3. Bounded Redirect & Timeout: Maksimal 3 redirect ke domain terakreditasi; timeout 8 detik.
 * 4. Max Response Size Guard: Membatasi respons maksimal 2 MB untuk mencegah memory exhaustion.
 * 5. Single-Flight Concurrency: Mencegah thundering herd pada upstream yang sama.
 * 6. In-Memory TTL Cache: Mengurangi beban upstream dan meningkatkan ketahanan offline.
 * 7. Sanitized Error Messaging: Mensterilkan pesan error dari token/kredensial upstream.
 * ══════════════════════════════════════════════════════════════════════════
 */

import sourceCatalog from '../../../shared/radar-source-catalog.json' with { type: 'json' }
import debunkDatabase from '../data/debunk-database.json' with { type: 'json' }

function generateTurnBackHoaxFallbackRssXml(maxItems = 35): string {
  const items = Array.isArray(debunkDatabase) ? debunkDatabase.slice(0, maxItems) : []
  let itemsXml = ''
  for (const item of items) {
    const isHoaks = item.verdict === 'HOAKS' || item.verdict === 'DISINFORMASI'
    const tag = isHoaks ? '[SALAH] ' : '[FAKTA] '
    const cleanClaim = (item.claim || 'Informasi terverifikasi').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const title = tag + cleanClaim
    const link = (item.sourceUrl || `https://turnbackhoax.id/?s=${encodeURIComponent(item.id || 'debunk')}`).replace(/&/g, '&amp;')
    const clarification = (item.clarification || (item as any).explanation || 'Klarifikasi fakta resmi oleh PUSSIBERAD dan MAFINDO.').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const pubDate = 'Fri, 13 Nov 2026 12:00:00 +0000'
    itemsXml += `    <item>
      <title>${title}</title>
      <link>${link}</link>
      <pubDate>${pubDate}</pubDate>
      <dc:creator><![CDATA[Pemeriksa Fakta MAFINDO & Pussiberad TNI AD (Cadangan Terlindungi)]]></dc:creator>
      <description><![CDATA[Klarifikasi: ${clarification}]]></description>
      <content:encoded><![CDATA[<p>Hasil Periksa Fakta: ${clarification}</p>]]></content:encoded>
    </item>\n`
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>TurnBackHoax - MAFINDO (Cadangan Resilient Air-Gap)</title>
    <link>https://turnbackhoax.id</link>
    <description>Kanal Periksa Fakta Mafindo (Masyarakat Anti Fitnah Indonesia) - Cadangan Offline Terlindungi</description>
    <language>id-ID</language>
${itemsXml}  </channel>
</rss>`
}

declare const process: any

// Host upstream terakreditasi yang diizinkan (Strict Allowlist diambil dari Canonical Catalog)
export const ALLOWED_UPSTREAM_HOSTS = new Set(sourceCatalog.allowedUpstreamHosts)

// Mapping upstream terpusat dan deterministik per source ID dari Canonical Catalog
export const GATEWAY_SOURCE_REGISTRY: Record<string, {
  sourceId: string
  displayName: string
  upstreamUrl: string
  allowedHost: string
  enabled: boolean
  ttlMs: number
  contentType: string
  maxItems?: number
  domain?: string
}> = Object.fromEntries(
  sourceCatalog.sources.map((s: any) => [
    s.id,
    {
      sourceId: s.id,
      displayName: s.displayName,
      upstreamUrl: s.upstreamUrl,
      allowedHost: s.allowedHost,
      enabled: s.enabled,
      ttlMs: s.ttlMs,
      contentType: (s.sourceType === 'official' || s.sourceType === 'aggregator' || s.parserAdapter === 'gdelt_doc') ? 'application/json; charset=utf-8' : 'application/rss+xml; charset=utf-8',
      maxItems: s.maxItems,
      domain: s.domain
    }
  ])
)

// In-Memory Cache Store
interface CacheEntry {
  xml: string
  httpStatus: number
  fetchedAt: number
  expiresAt: number
  sourceId: string
  contentLength: number
}

const gatewayCache = new Map<string, CacheEntry>()
const inFlightRequests = new Map<string, Promise<GatewayResponse>>()
let lastGdeltCallTime = 0 // SPRINT 10: Pacing limiter untuk GDELT DOC API (maksimal 1 per 5 detik)

export interface GatewayResponse {
  statusCode: number
  headers: Record<string, string>
  body: string
  isCacheHit: boolean
  sourceId: string
  latencyMs: number
  errorCode?: string
  errorMessage?: string
}

const MAX_RESPONSE_SIZE = 2 * 1024 * 1024 // 2 MB
const DEFAULT_TIMEOUT_MS = 14000 // 14 Detik (toleran terhadap beban multi-stream concurrent di Indonesia)

/**
 * Validasi apakah URL tujuan aman dan tidak melanggar batasan SSRF
 */
export function validateUpstreamUrl(urlStr: string): { valid: boolean; reason?: string; parsedHost?: string } {
  try {
    const parsed = new URL(urlStr)

    const host = parsed.hostname.toLowerCase()

    // 1. Validasi protokol (Hanya HTTPS yang diizinkan untuk keamanan transmisi)
    if (parsed.protocol !== 'https:') {
      return { valid: false, reason: `Protokol tidak diizinkan: ${parsed.protocol}. Hanya HTTPS yang diperbolehkan.`, parsedHost: host }
    }

    // 2. Blokir localhost, loopback, private networks, dan link-local
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      return { valid: false, reason: 'Akses ke jaringan lokal/privat diblokir oleh SSRF firewall.' }
    }

    // 3. Validasi host terhadap allowlist resmi
    const isAllowedHost = Array.from(ALLOWED_UPSTREAM_HOSTS).some(allowed => host === allowed || host.endsWith('.' + allowed))
    if (!isAllowedHost) {
      return { valid: false, reason: `Host tidak terakreditasi: ${host}. Permintaan ditolak.`, parsedHost: host }
    }

    return { valid: true, parsedHost: host }
  } catch (err: any) {
    return { valid: false, reason: `URL upstream tidak valid: ${err?.message || 'Parse error'}` }
  }
}

/**
 * Sanitasi pesan error agar tidak membocorkan kredensial atau path rahasia
 */
function sanitizeGatewayError(msg: string): string {
  if (!msg) return 'Kesalahan tidak diketahui pada gateway'
  return msg
    .replace(/(?:key|token|auth|password|secret|bearer)=[^& \s]+/gi, '$1=[REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9_\-.]+/gi, 'Bearer [REDACTED]')
}

/**
 * Handler Inti Pemrosesan Permintaan Feed Radar
 * Kontrak: GET /api/radar/feed/:sourceId
 */
export async function handleRadarFeedRequest(
  sourceId: string, 
  queryParams: Record<string, string> = {},
  customTimeoutMs?: number,
  options?: { customFetch?: typeof fetch }
): Promise<GatewayResponse> {
  const startTime = Date.now()

  // 1. Sanitasi Parameter Masukan & Perlindungan SSRF Injeksi
  // Tolak tegas jika pemanggil mencoba menyisipkan override URL/host/port
  if (queryParams.url || queryParams.target || queryParams.host || queryParams.redirect || queryParams.dest) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        errorCode: 'SSRF_OVERRIDE_FORBIDDEN',
        message: 'Parameter URL/host kustom dilarang. Gateway hanya melayani source ID resmi terdaftar.'
      }),
      isCacheHit: false,
      sourceId,
      latencyMs: Date.now() - startTime,
      errorCode: 'SSRF_OVERRIDE_FORBIDDEN',
      errorMessage: 'Injeksi target URL ditolak oleh firewall gateway.'
    }
  }

  // 2. Validasi Keberadaan Sumber di Registry
  const sourceConfig = GATEWAY_SOURCE_REGISTRY[sourceId]
  if (!sourceConfig) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        errorCode: 'UNKNOWN_SOURCE_ID',
        message: `Source ID '${sourceId}' tidak terdaftar pada registry gateway NARADA.`
      }),
      isCacheHit: false,
      sourceId,
      latencyMs: Date.now() - startTime,
      errorCode: 'UNKNOWN_SOURCE_ID',
      errorMessage: `Source ID '${sourceId}' tidak ditemukan.`
    }
  }

  // 3. Validasi Status Sumber (Apakah Dinonaktifkan oleh Kebijakan?)
  if (!sourceConfig.enabled) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        errorCode: 'SOURCE_DISABLED_BY_POLICY',
        message: `Sumber '${sourceConfig.displayName}' (${sourceId}) dinonaktifkan oleh kebijakan kepatuhan NARADA.`
      }),
      isCacheHit: false,
      sourceId,
      latencyMs: Date.now() - startTime,
      errorCode: 'SOURCE_DISABLED_BY_POLICY',
      errorMessage: 'Sumber dinonaktifkan oleh kebijakan resmi.'
    }
  }

  // 4. Periksa In-Memory TTL Cache
  const cached = gatewayCache.get(sourceId)
  if (cached && Date.now() < cached.expiresAt) {
    return {
      statusCode: cached.httpStatus,
      headers: {
        'Content-Type': sourceConfig.contentType,
        'X-Radar-Cache': 'HIT',
        'X-Radar-Source': sourceId,
        'X-Radar-Fetched-At': new Date(cached.fetchedAt).toISOString(),
        'X-Radar-Expires-At': new Date(cached.expiresAt).toISOString(),
        'Content-Length': cached.contentLength.toString()
      },
      body: cached.xml,
      isCacheHit: true,
      sourceId,
      latencyMs: Date.now() - startTime
    }
  }

  // 5. Single-Flight Concurrency: Jika ada request yang sama sedang berjalan, gunakan promise bersama
  const existingFlight = inFlightRequests.get(sourceId)
  if (existingFlight) {
    return existingFlight
  }

  // 6. Jalankan Fetch Nyata ke Upstream dengan Pengamanan Ketat
  const fetchPromise = (async (): Promise<GatewayResponse> => {
    try {
      // SPRINT 10 & 14: Batas waktu adaptif dari katalog sumber (10-15s) dan jeda 5s khusus GDELT API
      const isGdeltHost = sourceConfig.allowedHost === 'api.gdeltproject.org' || sourceConfig.upstreamUrl.includes('gdeltproject.org')
      const timeoutMs = customTimeoutMs || (sourceConfig as any).timeoutMs || (isGdeltHost ? 15000 : DEFAULT_TIMEOUT_MS)

      if (isGdeltHost) {
        const elapsed = Date.now() - lastGdeltCallTime
        if (elapsed < 5000) {
          await new Promise(r => setTimeout(r, 5000 - elapsed))
        }
        lastGdeltCallTime = Date.now()
      }

      // Validasi URL upstream sebelum memanggil
      const validation = validateUpstreamUrl(sourceConfig.upstreamUrl)
      if (!validation.valid) {
        return {
          statusCode: 502,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            errorCode: 'UPSTREAM_URL_VALIDATION_FAILED',
            message: validation.reason
          }),
          isCacheHit: false,
          sourceId,
          latencyMs: Date.now() - startTime,
          errorCode: 'UPSTREAM_URL_VALIDATION_FAILED'
        }
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      let currentUrl = sourceConfig.upstreamUrl
      let redirectCount = 0
      let response: Response | null = null

      const fetchFn = options?.customFetch || fetch

      const isJsonSource = sourceConfig.contentType.includes('json')
      const acceptHeader = isJsonSource 
        ? 'application/json, text/plain, */*' 
        : 'application/rss+xml, application/xml, text/xml, */*'

      // Loop manual untuk redirect validation agar tidak terjadi redirect ke host terlarang
      while (redirectCount <= 3) {
        response = await (fetchFn as any)(currentUrl, {
          signal: controller.signal,
          redirect: 'manual',
          headers: {
            'Accept': acceptHeader,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NARADA-Cognitive-Defense/1.0'
          }
        })

        // Tangani HTTP Redirect (301, 302, 307, 308)
        if (response && [301, 302, 303, 307, 308].includes(response.status)) {
          redirectCount++
          if (redirectCount > 3) {
            clearTimeout(timer)
            return {
              statusCode: 502,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                success: false,
                errorCode: 'EXCESSIVE_REDIRECTS',
                message: 'Batas pengalihan (maks 3 redirect) terlampaui.'
              }),
              isCacheHit: false,
              sourceId,
              latencyMs: Date.now() - startTime,
              errorCode: 'EXCESSIVE_REDIRECTS'
            }
          }

          const location = response.headers?.get ? response.headers.get('Location') : null
          if (!location) break

          const resolvedRedirect = new URL(location, currentUrl).toString()
          const redirectValidation = validateUpstreamUrl(resolvedRedirect)
          if (!redirectValidation.valid) {
            clearTimeout(timer)
            return {
              statusCode: 502,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                success: false,
                errorCode: 'DISALLOWED_REDIRECT_HOST',
                message: `Pengalihan ke host '${redirectValidation.parsedHost}' ditolak oleh firewall gateway.`
              }),
              isCacheHit: false,
              sourceId,
              latencyMs: Date.now() - startTime,
              errorCode: 'DISALLOWED_REDIRECT_HOST'
            }
          }

          currentUrl = resolvedRedirect
          continue
        }

        break
      }

      clearTimeout(timer)

      if (!response) {
        throw new Error('Tidak ada respon yang diterima dari upstream')
      }

      // Pemetaan Kode Status HTTP Spesifik
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '60'
        return {
          statusCode: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': retryAfter
          },
          body: JSON.stringify({
            success: false,
            errorCode: 'RATE_LIMITED',
            retryAfterSeconds: parseInt(retryAfter, 10),
            message: 'Upstream rate limit terlampaui (HTTP 429).'
          }),
          isCacheHit: false,
          sourceId,
          latencyMs: Date.now() - startTime,
          errorCode: 'RATE_LIMITED'
        }
      }

      if (response.status >= 500) {
        if (sourceId === 'src-tbh' || sourceId.includes('tbh')) {
          console.log(`[NARADA Gateway] Upstream ${sourceId} gagal (status ${response.status}), mengaktifkan cadangan resilient offline XML.`)
          const fallbackXml = generateTurnBackHoaxFallbackRssXml(35)
          const fallbackBytes = new TextEncoder().encode(fallbackXml).length
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/rss+xml; charset=utf-8',
              'X-Radar-Fallback': 'RESILIENT_AIRGAP_SNAPSHOT',
              'X-Radar-Source': sourceId,
              'Content-Length': fallbackBytes.toString()
            },
            body: fallbackXml,
            isCacheHit: false,
            sourceId,
            latencyMs: Date.now() - startTime
          }
        }
        return {
          statusCode: 502,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            errorCode: 'UPSTREAM_SERVER_ERROR',
            upstreamStatus: response.status,
            message: `Server sumber mengembalikan error status ${response.status}.`
          }),
          isCacheHit: false,
          sourceId,
          latencyMs: Date.now() - startTime,
          errorCode: 'UPSTREAM_SERVER_ERROR'
        }
      }

      const isResponseOk = response.ok ?? (response.status >= 200 && response.status < 300)
      if (!isResponseOk) {
        return {
          statusCode: response.status,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            errorCode: 'UPSTREAM_HTTP_ERROR',
            upstreamStatus: response.status,
            message: `Upstream error HTTP ${response.status}.`
          }),
          isCacheHit: false,
          sourceId,
          latencyMs: Date.now() - startTime,
          errorCode: 'UPSTREAM_HTTP_ERROR'
        }
      }

      // Validasi Ukuran Konten (Max 2 MB)
      const contentLengthHeader = response.headers.get('Content-Length')
      if (contentLengthHeader && parseInt(contentLengthHeader, 10) > MAX_RESPONSE_SIZE) {
        return {
          statusCode: 413,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            errorCode: 'RESPONSE_OVERSIZED',
            message: `Ukuran respons upstream melebihi batas 2 MB (${contentLengthHeader} bytes).`
          }),
          isCacheHit: false,
          sourceId,
          latencyMs: Date.now() - startTime,
          errorCode: 'RESPONSE_OVERSIZED'
        }
      }

      const text = await response.text()
      const byteLength = new TextEncoder().encode(text).length
      if (byteLength > MAX_RESPONSE_SIZE) {
        return {
          statusCode: 413,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            errorCode: 'RESPONSE_OVERSIZED',
            message: 'Isi respons upstream setelah dibaca melebihi batas 2 MB.'
          }),
          isCacheHit: false,
          sourceId,
          latencyMs: Date.now() - startTime,
          errorCode: 'RESPONSE_OVERSIZED'
        }
      }

      // Validasi Konten Sesuai Tipe Sumber (JSON vs XML)
      if (isJsonSource) {
        const trimmed = text.trim()
        const isHtml = trimmed.startsWith('<') || trimmed.toLowerCase().includes('<html') || trimmed.toLowerCase().includes('<!doctype')
        if (isHtml) {
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'X-Radar-State': 'DEGRADED',
              'X-Radar-Source': sourceId
            },
            body: text,
            isCacheHit: false,
            sourceId,
            latencyMs: Date.now() - startTime,
            errorCode: 'MALFORMED_CONTENT_NOT_JSON',
            errorMessage: 'Respons diterima namun bukan format JSON valid (terdeteksi respons HTML)'
          }
        }

        try {
          JSON.parse(text)
        } catch {
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'X-Radar-State': 'DEGRADED',
              'X-Radar-Source': sourceId
            },
            body: text,
            isCacheHit: false,
            sourceId,
            latencyMs: Date.now() - startTime,
            errorCode: 'MALFORMED_CONTENT_NOT_JSON',
            errorMessage: 'Respons diterima namun gagal diparse sebagai struktur JSON'
          }
        }
      } else {
        const isXmlFormat = text.includes('<rss') || text.includes('<feed') || text.includes('<?xml') || text.includes('<item')
        if (!isXmlFormat) {
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'X-Radar-State': 'DEGRADED',
              'X-Radar-Source': sourceId
            },
            body: text,
            isCacheHit: false,
            sourceId,
            latencyMs: Date.now() - startTime,
            errorCode: 'MALFORMED_CONTENT_NOT_XML',
            errorMessage: 'Respons diterima namun bukan format XML feed standar'
          }
        }
      }

      // Simpan ke Gateway Cache
      const fetchedAt = Date.now()
      const expiresAt = fetchedAt + sourceConfig.ttlMs
      gatewayCache.set(sourceId, {
        xml: text,
        httpStatus: 200,
        fetchedAt,
        expiresAt,
        sourceId,
        contentLength: byteLength
      })

      return {
        statusCode: 200,
        headers: {
          'Content-Type': sourceConfig.contentType,
          'X-Radar-Cache': 'MISS',
          'X-Radar-Source': sourceId,
          'X-Radar-Fetched-At': new Date(fetchedAt).toISOString(),
          'X-Radar-Expires-At': new Date(expiresAt).toISOString(),
          'Content-Length': byteLength.toString()
        },
        body: text,
        isCacheHit: false,
        sourceId,
        latencyMs: Date.now() - startTime
      }

    } catch (err: any) {
      if (sourceId === 'src-tbh' || sourceId.includes('tbh')) {
        console.log(`[NARADA Gateway] Upstream ${sourceId} network error, mengaktifkan cadangan resilient offline XML.`)
        const fallbackXml = generateTurnBackHoaxFallbackRssXml(35)
        const fallbackBytes = new TextEncoder().encode(fallbackXml).length
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/rss+xml; charset=utf-8',
            'X-Radar-Fallback': 'RESILIENT_AIRGAP_SNAPSHOT',
            'X-Radar-Source': sourceId,
            'Content-Length': fallbackBytes.toString()
          },
          body: fallbackXml,
          isCacheHit: false,
          sourceId,
          latencyMs: Date.now() - startTime
        }
      }

      if (err?.name === 'AbortError') {
        return {
          statusCode: 504,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            errorCode: 'GATEWAY_TIMEOUT',
            message: `Batas waktu permintaan (${customTimeoutMs || DEFAULT_TIMEOUT_MS}ms) terlampaui.`
          }),
          isCacheHit: false,
          sourceId,
          latencyMs: Date.now() - startTime,
          errorCode: 'GATEWAY_TIMEOUT',
          errorMessage: 'Gateway timeout saat menghubungkan ke upstream.'
        }
      }

      const sanitized = sanitizeGatewayError(err?.message || 'Network exception')
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          errorCode: 'UPSTREAM_NETWORK_FAILURE',
          message: sanitized
        }),
        isCacheHit: false,
        sourceId,
        latencyMs: Date.now() - startTime,
        errorCode: 'UPSTREAM_NETWORK_FAILURE',
        errorMessage: sanitized
      }
    } finally {
      inFlightRequests.delete(sourceId)
    }
  })()

  inFlightRequests.set(sourceId, fetchPromise)
  return fetchPromise
}

// ─── Dynamic Topic Discovery Search Handler (Sprint 6) ───

interface DynamicSearchRecord {
  timestamp: number
  profileId: string
  topic: string
}
const dynamicSearchHistory: DynamicSearchRecord[] = []
const phraseLastSearchedAt = new Map<string, number>()

/**
 * Semaphore pembatas konkurensi pencarian dinamis (Sprint 7 WP6 - Carry-over 8.6)
 */
export class DynamicSearchSemaphore {
  private active = 0
  private max: number
  private queue: Array<{ resolve: () => void; reject: (err: Error) => void }> = []
  private maxQueue: number

  constructor(max = 2, maxQueue = 10) {
    this.max = max
    this.maxQueue = maxQueue
  }

  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++
      return
    }
    if (this.queue.length >= this.maxQueue) {
      throw new Error('CONCURRENT_SEARCH_QUEUE_FULL')
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject })
    })
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()
      if (next) next.resolve()
    } else {
      this.active = Math.max(0, this.active - 1)
    }
  }

  getActiveCount(): number {
    return this.active
  }

  getQueueLength(): number {
    return this.queue.length
  }

  reset(): void {
    this.active = 0
    this.queue.length = 0
  }
}

export const dynamicSearchSemaphore = new DynamicSearchSemaphore(
  sourceCatalog.dynamicSearchPolicy?.maxConcurrentDynamicSearches || 2,
  10
)

/**
 * Reset Dynamic Search History (Untuk testing)
 */
export function clearDynamicSearchHistory(): void {
  dynamicSearchHistory.length = 0
  phraseLastSearchedAt.clear()
  dynamicSearchSemaphore.reset()
}

/**
 * Validasi dan sanitasi parameter pencarian dinamis (Sprint 6 WP5 / S6-15)
 */
export function validateDynamicSearchQuery(profileId: string, topic: string): {
  isValid: boolean
  sanitizedTopic?: string
  rejectionReason?: string
  profile?: any
  isGdelt?: boolean
} {
  const gnewsProfiles = (sourceCatalog.googleNewsProfiles || {}) as Record<string, any>
  const gdeltProfiles = ((sourceCatalog as any).gdeltProfiles || {}) as Record<string, any>
  const profile = gnewsProfiles[profileId] || gdeltProfiles[profileId]
  if (!profile) {
    return { isValid: false, rejectionReason: `Profile ID '${profileId}' tidak terdaftar pada profil Google News atau GDELT NARADA` }
  }

  const isGdelt = Boolean(gdeltProfiles[profileId] || profileId.startsWith('gdelt-'))

  if (!topic || typeof topic !== 'string' || !topic.trim()) {
    return { isValid: false, rejectionReason: "Parameter 'topic' wajib diisi untuk pencarian dinamis" }
  }

  // Tolak karakter kontrol dan CRLF
  if (/[\r\n\x00-\x1f\x7f]/.test(topic)) {
    return { isValid: false, rejectionReason: 'Karakter kontrol dan CRLF dilarang dalam parameter topik' }
  }

  const maxLen = sourceCatalog.dynamicSearchPolicy?.maxPhraseLength || 80
  const maxTokens = sourceCatalog.dynamicSearchPolicy?.maxPhraseTokens || 5

  const cleaned = topic.trim().replace(/[<>"'`;\\|/()[\]{}*+?^$]/g, ' ').replace(/\s+/g, ' ')
  if (cleaned.length < 3) {
    return { isValid: false, rejectionReason: 'Frasa pencarian terlalu pendek (minimal 3 karakter)' }
  }
  if (cleaned.length > maxLen) {
    return { isValid: false, rejectionReason: `Panjang frasa (${cleaned.length}) melebihi batas maksimal ${maxLen} karakter` }
  }
  if (cleaned.split(' ').filter(Boolean).length > maxTokens) {
    return { isValid: false, rejectionReason: `Jumlah kata (${cleaned.split(' ').filter(Boolean).length}) melebihi batas maksimal ${maxTokens} token` }
  }

  if (/(https?:\/\/|ftp:\/\/|file:\/\/|\/\/|www\.|\.com|\.id|\.net|site:|inurl:|intitle:|localhost|127\.0\.0\.1)/i.test(topic)) {
    return { isValid: false, rejectionReason: 'Injeksi protokol, host override, atau operator site: ditolak oleh kebijakan keamanan' }
  }

  return { isValid: true, sanitizedTopic: cleaned, profile, isGdelt }
}

/**
 * Handler Inti Pencarian Dinamis Google News Tertarget
 * Kontrak: GET /api/radar/search/:profileId?topic=<phrase>
 */
export async function handleRadarSearchRequest(
  profileId: string,
  queryParams: Record<string, string> = {},
  customTimeoutMs?: number,
  options?: { customFetch?: typeof fetch }
): Promise<GatewayResponse> {
  const startTime = Date.now()
  const rawTopic = queryParams.topic || ''

  // 1. Validasi Profil & Parameter Terpusat
  const validation = validateDynamicSearchQuery(profileId, rawTopic)
  if (!validation.isValid) {
    const isUnknownProfile = validation.rejectionReason?.includes('tidak terdaftar')
    const statusCode = isUnknownProfile ? 404 : 400
    const errorCode = isUnknownProfile
      ? 'UNKNOWN_PROFILE_ID'
      : (!rawTopic || !rawTopic.trim() ? 'MISSING_TOPIC_PARAM' : 'INVALID_SEARCH_QUERY')
    return {
      statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        errorCode,
        message: validation.rejectionReason
      }),
      isCacheHit: false,
      sourceId: profileId,
      latencyMs: Date.now() - startTime,
      errorCode,
      errorMessage: validation.rejectionReason
    }
  }

  const sanitizedTopic = validation.sanitizedTopic!
  const profile = validation.profile!
  const isGdelt = Boolean(validation.isGdelt || profileId.startsWith('gdelt-'))
  const contentType = isGdelt ? 'application/json; charset=utf-8' : 'application/rss+xml; charset=utf-8'

  // 2. Batas Cooldown per Frasa (30 menit)
  const normPhrase = sanitizedTopic.toLowerCase()
  const cooldownMs = sourceCatalog.dynamicSearchPolicy?.phraseCooldownMs || 1800000
  const lastSearch = phraseLastSearchedAt.get(normPhrase)
  const cacheKey = `search:${profileId}:${normPhrase}`

  if (lastSearch && (Date.now() - lastSearch < cooldownMs)) {
    const cached = gatewayCache.get(cacheKey)
    if (cached) {
      return {
        statusCode: cached.httpStatus,
        headers: {
          'Content-Type': contentType,
          'X-Radar-Cache': 'HIT',
          'X-Radar-Source': profileId,
          'X-Radar-Search-Topic': sanitizedTopic,
          'X-Radar-Fetched-At': new Date(cached.fetchedAt).toISOString(),
          'X-Radar-Expires-At': new Date(cached.expiresAt).toISOString(),
          'Content-Length': cached.contentLength.toString()
        },
        body: cached.xml,
        isCacheHit: true,
        sourceId: profileId,
        latencyMs: Date.now() - startTime
      }
    }
  }

  // 4. Kuota Harian (Maksimal 8 kueri per rolling 24 jam)
  const now = Date.now()
  const oneDayAgo = now - 24 * 3600 * 1000
  const recentSearches = dynamicSearchHistory.filter(r => r.timestamp > oneDayAgo)
  const max24h = sourceCatalog.dynamicSearchPolicy?.maxDynamicQueriesPer24h || 8
  if (recentSearches.length >= max24h) {
    return {
      statusCode: 429,
      headers: { 
        'Content-Type': 'application/json',
        'Retry-After': '3600'
      },
      body: JSON.stringify({
        success: false,
        errorCode: 'DYNAMIC_SEARCH_QUOTA_EXCEEDED',
        message: `Batas pencarian dinamis (${max24h} kueri per 24 jam) terlampaui.`
      }),
      isCacheHit: false,
      sourceId: profileId,
      latencyMs: Date.now() - startTime,
      errorCode: 'DYNAMIC_SEARCH_QUOTA_EXCEEDED',
      errorMessage: `Batas pencarian dinamis (${max24h}/24 jam) terlampaui.`
    }
  }

  // 5. Periksa Cache TTL yang Masih Berlaku
  const cached = gatewayCache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) {
    return {
      statusCode: cached.httpStatus,
      headers: {
        'Content-Type': contentType,
        'X-Radar-Cache': 'HIT',
        'X-Radar-Source': profileId,
        'X-Radar-Search-Topic': sanitizedTopic,
        'X-Radar-Fetched-At': new Date(cached.fetchedAt).toISOString(),
        'X-Radar-Expires-At': new Date(cached.expiresAt).toISOString(),
        'Content-Length': cached.contentLength.toString()
      },
      body: cached.xml,
      isCacheHit: true,
      sourceId: profileId,
      latencyMs: Date.now() - startTime
    }
  }

  // 6. Single-Flight Concurrency
  const existingFlight = inFlightRequests.get(cacheKey)
  if (existingFlight) {
    return existingFlight
  }

  // 6B. Pembatasan Konkurensi Global (Semaphore)
  try {
    await dynamicSearchSemaphore.acquire()
  } catch (err: any) {
    return {
      statusCode: 429,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        errorCode: 'CONCURRENT_SEARCH_LIMIT_EXCEEDED',
        message: 'Batas konkurensi pencarian dinamis terlampaui. Silakan coba kembali sesaat lagi.'
      }),
      isCacheHit: false,
      sourceId: profileId,
      latencyMs: Date.now() - startTime,
      errorCode: 'CONCURRENT_SEARCH_LIMIT_EXCEEDED',
      errorMessage: 'Batas konkurensi pencarian dinamis terlampaui'
    }
  }

  // 7. Konstruksi URL Upstream Pencarian (Google News RSS vs GDELT DOC API)
  let upstreamSearchUrl = ''
  if (isGdelt) {
    const gdeltBaseUrl = (sourceCatalog as any).dynamicSearchPolicy?.gdeltBaseUrl || 'https://api.gdeltproject.org/api/v2/doc/doc'
    const queryParam = `("${sanitizedTopic}") ${profile.query}`
    upstreamSearchUrl = `${gdeltBaseUrl}?query=${encodeURIComponent(queryParam)}&mode=artlist&format=json&sort=datedesc&maxrecords=50&timespan=7d`
  } else {
    const queryStr = `(${profile.query}) AND ("${sanitizedTopic}")`
    const searchBaseUrl = sourceCatalog.dynamicSearchPolicy?.searchBaseUrl || 'https://news.google.com/rss/search'
    upstreamSearchUrl = `${searchBaseUrl}?q=${encodeURIComponent(queryStr)}&hl=${profile.locale || 'id'}&gl=${profile.gl || 'ID'}&ceid=${profile.ceid || 'ID:id'}`
  }

  const fetchPromise = (async (): Promise<GatewayResponse> => {
    try {
      const validation = validateUpstreamUrl(upstreamSearchUrl)
      if (!validation.valid) {
        return {
          statusCode: 502,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            errorCode: 'UPSTREAM_URL_VALIDATION_FAILED',
            message: validation.reason
          }),
          isCacheHit: false,
          sourceId: profileId,
          latencyMs: Date.now() - startTime,
          errorCode: 'UPSTREAM_URL_VALIDATION_FAILED'
        }
      }

      if (isGdelt) {
        const elapsed = Date.now() - lastGdeltCallTime
        if (elapsed < 5000) {
          await new Promise(r => setTimeout(r, 5000 - elapsed))
        }
        lastGdeltCallTime = Date.now()
      }

      const timeoutMs = customTimeoutMs || (isGdelt ? 15000 : DEFAULT_TIMEOUT_MS)
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      const fetchFn = options?.customFetch || fetch

      let currentUrl = upstreamSearchUrl
      let redirectCount = 0
      let response: Response | null = null

      while (redirectCount <= 3) {
        response = await (fetchFn as any)(currentUrl, {
          signal: controller.signal,
          redirect: 'manual',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NARADA-Defense/1.0',
            'Accept': isGdelt ? 'application/json, text/plain, */*' : 'application/rss+xml, application/xml, text/xml, */*'
          }
        })

        if (response && [301, 302, 303, 307, 308].includes(response.status)) {
          redirectCount++
          if (redirectCount > 3) {
            clearTimeout(timer)
            return {
              statusCode: 502,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                success: false,
                errorCode: 'EXCESSIVE_REDIRECTS',
                message: 'Batas pengalihan (maks 3 redirect) terlampaui.'
              }),
              isCacheHit: false,
              sourceId: profileId,
              latencyMs: Date.now() - startTime,
              errorCode: 'EXCESSIVE_REDIRECTS'
            }
          }

          const location = response.headers?.get ? response.headers.get('Location') : null
          if (!location) break

          const resolvedRedirect = new URL(location, currentUrl).toString()
          const redirectValidation = validateUpstreamUrl(resolvedRedirect)
          if (!redirectValidation.valid) {
            clearTimeout(timer)
            return {
              statusCode: 502,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                success: false,
                errorCode: 'DISALLOWED_REDIRECT_HOST',
                message: `Pengalihan ke host '${redirectValidation.parsedHost}' ditolak oleh firewall gateway.`
              }),
              isCacheHit: false,
              sourceId: profileId,
              latencyMs: Date.now() - startTime,
              errorCode: 'DISALLOWED_REDIRECT_HOST'
            }
          }

          currentUrl = resolvedRedirect
          continue
        }

        break
      }

      clearTimeout(timer)

      if (!response) {
        throw new Error('Tidak ada respon yang diterima dari upstream Google News')
      }

      if (response.status === 429) {
        return {
          statusCode: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
          body: JSON.stringify({
            success: false,
            errorCode: 'UPSTREAM_RATE_LIMITED',
            message: 'Google News membatasi laju permintaan (Rate Limited).'
          }),
          isCacheHit: false,
          sourceId: profileId,
          latencyMs: Date.now() - startTime,
          errorCode: 'UPSTREAM_RATE_LIMITED'
        }
      }

      if (!response.ok) {
        return {
          statusCode: response.status,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            errorCode: `UPSTREAM_HTTP_${response.status}`,
            message: `Google News mengembalikan status HTTP ${response.status}.`
          }),
          isCacheHit: false,
          sourceId: profileId,
          latencyMs: Date.now() - startTime,
          errorCode: `UPSTREAM_HTTP_${response.status}`
        }
      }

      const bodyText = await response.text()
      if (bodyText.length > MAX_RESPONSE_SIZE) {
        return {
          statusCode: 502,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            errorCode: 'RESPONSE_TOO_LARGE',
            message: 'Ukuran respon feed melebihi batas 2 MB.'
          }),
          isCacheHit: false,
          sourceId: profileId,
          latencyMs: Date.now() - startTime,
          errorCode: 'RESPONSE_TOO_LARGE'
        }
      }

      // Validasi format konten sebelum dicache (JSON vs XML)
      if (isGdelt) {
        const trimmed = bodyText.trim()
        const isHtml = trimmed.startsWith('<') || trimmed.toLowerCase().includes('<html') || trimmed.toLowerCase().includes('<!doctype')
        if (isHtml) {
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'X-Radar-State': 'DEGRADED',
              'X-Radar-Source': profileId
            },
            body: bodyText,
            isCacheHit: false,
            sourceId: profileId,
            latencyMs: Date.now() - startTime,
            errorCode: 'MALFORMED_CONTENT_NOT_JSON',
            errorMessage: 'Respons pencarian GDELT bukan format JSON yang valid (terdeteksi respons HTML)'
          }
        }

        try {
          JSON.parse(bodyText)
        } catch {
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'X-Radar-State': 'DEGRADED',
              'X-Radar-Source': profileId
            },
            body: bodyText,
            isCacheHit: false,
            sourceId: profileId,
            latencyMs: Date.now() - startTime,
            errorCode: 'MALFORMED_CONTENT_NOT_JSON',
            errorMessage: 'Respons pencarian GDELT gagal diparse sebagai struktur JSON'
          }
        }
      } else {
        const isXmlFormat = bodyText.includes('<rss') || bodyText.includes('<feed') || bodyText.includes('<?xml') || bodyText.includes('<item')
        if (!isXmlFormat) {
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'X-Radar-State': 'DEGRADED',
              'X-Radar-Source': profileId
            },
            body: bodyText,
            isCacheHit: false,
            sourceId: profileId,
            latencyMs: Date.now() - startTime,
            errorCode: 'MALFORMED_CONTENT_NOT_XML',
            errorMessage: 'Respons diterima namun bukan format XML feed standar'
          }
        }
      }

      // Catat riwayat pencarian sukses
      dynamicSearchHistory.push({ timestamp: Date.now(), profileId, topic: sanitizedTopic })
      phraseLastSearchedAt.set(normPhrase, Date.now())

      // Simpan di cache (TTL 5 menit)
      gatewayCache.set(cacheKey, {
        xml: bodyText,
        httpStatus: response.status,
        fetchedAt: Date.now(),
        expiresAt: Date.now() + 300_000,
        sourceId: profileId,
        contentLength: bodyText.length
      })

      return {
        statusCode: response.status,
        headers: {
          'Content-Type': contentType,
          'X-Radar-Cache': 'MISS',
          'X-Radar-Source': profileId,
          'X-Radar-Search-Topic': sanitizedTopic,
          'Content-Length': bodyText.length.toString()
        },
        body: bodyText,
        isCacheHit: false,
        sourceId: profileId,
        latencyMs: Date.now() - startTime
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return {
          statusCode: 504,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            errorCode: 'GATEWAY_TIMEOUT',
            message: `Batas waktu permintaan pencarian (${customTimeoutMs || DEFAULT_TIMEOUT_MS}ms) terlampaui.`
          }),
          isCacheHit: false,
          sourceId: profileId,
          latencyMs: Date.now() - startTime,
          errorCode: 'GATEWAY_TIMEOUT'
        }
      }

      const sanitized = sanitizeGatewayError(err?.message || 'Network exception')
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          errorCode: 'UPSTREAM_NETWORK_FAILURE',
          message: sanitized
        }),
        isCacheHit: false,
        sourceId: profileId,
        latencyMs: Date.now() - startTime,
        errorCode: 'UPSTREAM_NETWORK_FAILURE',
        errorMessage: sanitized
      }
    } finally {
      inFlightRequests.delete(cacheKey)
      dynamicSearchSemaphore.release()
    }
  })()

  inFlightRequests.set(cacheKey, fetchPromise)
  return fetchPromise
}

/**
 * Health Check Endpoint Gateway
 * Kontrak: GET /api/radar/gateway/health
 */
export function getGatewayHealthStatus(): {
  status: 'HEALTHY' | 'DEGRADED'
  version: string
  activeSourceCount: number
  cachedSourceCount: number
  supportedSources: string[]
  uptimeSeconds: number
  timestamp: string
} {
  const activeSources = Object.values(GATEWAY_SOURCE_REGISTRY).filter(s => s.enabled).map(s => s.sourceId)
  return {
    status: 'HEALTHY',
    version: '1.0.0-sprint1c',
    activeSourceCount: activeSources.length,
    cachedSourceCount: gatewayCache.size,
    supportedSources: activeSources,
    uptimeSeconds: typeof process !== 'undefined' && process.uptime ? Math.round(process.uptime()) : 0,
    timestamp: new Date().toISOString()
  }
}

/**
 * Reset Cache Gateway (Untuk keperluan testing)
 */
export function clearGatewayCache(): void {
  gatewayCache.clear()
  inFlightRequests.clear()
}

/**
 * Universal Gateway Request Router
 * Memproses permintaan path seperti /api/radar/feed/:sourceId atau /api/radar/gateway/health
 */
export async function handleRadarGatewayRequest(
  urlPath: string,
  searchParams?: Record<string, string>,
  options?: { customFetch?: typeof fetch; timeoutMs?: number }
): Promise<GatewayResponse> {
  if (urlPath === '/api/radar/gateway/health') {
    const health = getGatewayHealthStatus()
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(health),
      isCacheHit: false,
      sourceId: 'gateway-health',
      latencyMs: 0
    }
  }

  const searchMatch = urlPath.match(/^\/api\/radar\/search\/([^/?#]+)/)
  if (searchMatch) {
    const profileId = searchMatch[1]
    return handleRadarSearchRequest(profileId, searchParams || {}, options?.timeoutMs, options)
  }

  const match = urlPath.match(/^\/api\/radar\/feed\/([^/?#]+)/)
  const sourceId = match ? match[1] : urlPath.replace('/api/radar/feed/', '').split('?')[0]
  return handleRadarFeedRequest(sourceId, searchParams || {}, options?.timeoutMs, options)
}
