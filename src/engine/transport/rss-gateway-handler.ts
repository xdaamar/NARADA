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

declare const process: any

// Host upstream terakreditasi yang diizinkan (Strict Allowlist)
export const ALLOWED_UPSTREAM_HOSTS = new Set([
  'turnbackhoax.id',
  'news.google.com',
  'trends.google.com'
])

// Mapping upstream terpusat dan deterministik per source ID
export const GATEWAY_SOURCE_REGISTRY: Record<string, {
  sourceId: string
  displayName: string
  upstreamUrl: string
  allowedHost: string
  enabled: boolean
  ttlMs: number
  contentType: string
}> = {
  'src-tbh': {
    sourceId: 'src-tbh',
    displayName: 'TurnBackHoax (MAFINDO)',
    upstreamUrl: 'https://turnbackhoax.id/feed/',
    allowedHost: 'turnbackhoax.id',
    enabled: true,
    ttlMs: 300_000, // 5 menit
    contentType: 'application/rss+xml; charset=utf-8'
  },
  'src-gnews-hankam': {
    sourceId: 'src-gnews-hankam',
    displayName: 'Google News — Hankam & TNI',
    upstreamUrl: 'https://news.google.com/rss/search?q=(TNI+OR+alutsista+OR+Papua+OR+KKB+OR+Ambalat+OR+kapal+perang)+AND+(viral+OR+heboh+OR+polemik+OR+kontroversi+OR+hoaks)+when:2d&hl=id&gl=ID&ceid=ID:id',
    allowedHost: 'news.google.com',
    enabled: true,
    ttlMs: 120_000, // 2 menit
    contentType: 'application/rss+xml; charset=utf-8'
  },
  'src-gnews-demo': {
    sourceId: 'src-gnews-demo',
    displayName: 'Google News — Aksi Massa & Unjuk Rasa',
    upstreamUrl: 'https://news.google.com/rss/search?q=(demo+OR+unjuk+rasa+OR+bentrok+OR+ricuh+OR+mahasiswa+OR+pemakzulan)+when:1d&hl=id&gl=ID&ceid=ID:id',
    allowedHost: 'news.google.com',
    enabled: true,
    ttlMs: 120_000, // 2 menit
    contentType: 'application/rss+xml; charset=utf-8'
  },
  'src-gnews-politik': {
    sourceId: 'src-gnews-politik',
    displayName: 'Google News — Kebijakan & Dinamika Negara',
    upstreamUrl: 'https://news.google.com/rss/search?q=(Prabowo+OR+Gibran+OR+bansos+OR+MBG+OR+ijazah+OR+KPK)+AND+(viral+OR+heboh+OR+polemik+OR+sidang)+when:1d&hl=id&gl=ID&ceid=ID:id',
    allowedHost: 'news.google.com',
    enabled: true,
    ttlMs: 120_000, // 2 menit
    contentType: 'application/rss+xml; charset=utf-8'
  },
  'src-gtrends-id': {
    sourceId: 'src-gtrends-id',
    displayName: 'Google Trends Indonesia (Search Interest)',
    upstreamUrl: 'https://trends.google.com/trending/rss?geo=ID',
    allowedHost: 'trends.google.com',
    enabled: true,
    ttlMs: 180_000, // 3 menit
    contentType: 'application/rss+xml; charset=utf-8'
  },
  'src-youtube-policy-stub': {
    sourceId: 'src-youtube-policy-stub',
    displayName: 'YouTube Data API Guardrail Stub (Disabled)',
    upstreamUrl: '',
    allowedHost: 'developers.google.com',
    enabled: false,
    ttlMs: 0,
    contentType: 'application/json'
  }
}

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
const DEFAULT_TIMEOUT_MS = 8000 // 8 Detik

/**
 * Validasi apakah URL tujuan aman dan tidak melanggar batasan SSRF
 */
export function validateUpstreamUrl(urlStr: string): { valid: boolean; reason?: string; parsedHost?: string } {
  try {
    const parsed = new URL(urlStr)

    // 1. Validasi protokol (Hanya HTTPS yang diizinkan untuk keamanan transmisi)
    if (parsed.protocol !== 'https:') {
      return { valid: false, reason: `Protokol tidak diizinkan: ${parsed.protocol}. Hanya HTTPS yang diperbolehkan.` }
    }

    const host = parsed.hostname.toLowerCase()

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
      const timeoutMs = customTimeoutMs || DEFAULT_TIMEOUT_MS

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

      // Loop manual untuk redirect validation agar tidak terjadi redirect ke host terlarang
      while (redirectCount <= 3) {
        response = await (fetchFn as any)(currentUrl, {
          signal: controller.signal,
          redirect: 'manual',
          headers: {
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
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

      // Validasi XML: Cek apakah memuat struktur XML yang wajar
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

  const match = urlPath.match(/^\/api\/radar\/feed\/([^/?#]+)/)
  const sourceId = match ? match[1] : urlPath.replace('/api/radar/feed/', '').split('?')[0]
  return handleRadarFeedRequest(sourceId, searchParams || {}, options?.timeoutMs, options)
}
