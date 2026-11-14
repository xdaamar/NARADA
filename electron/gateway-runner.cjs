/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — PACKAGED ELECTRON LOCAL LOOPBACK RSS GATEWAY RUNNER
 * SPRINT 5: WORK PACKAGE 9 (PACKAGED RUNTIME GATEWAY SERVICE)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * CommonJS loopback HTTP service running on 127.0.0.1:5174 for packaged
 * Electron builds (file:// protocol) where no Vite dev server is available.
 * 
 * Enforces identical SSRF and Anti-Tampering rules as rss-gateway-handler:
 * 1. Strict Allowlist (turnbackhoax.id, news.google.com, trends.google.com)
 * 2. HTTPS-only upstream with manual redirect validation
 * 3. In-memory TTL caching and single-flight concurrency
 * 4. Bound to 127.0.0.1 only (never external interfaces)
 * ══════════════════════════════════════════════════════════════════════════
 */

const http = require('http')
const path = require('path')

// Load canonical catalog
const catalog = require(path.join(__dirname, '../shared/radar-source-catalog.json'))

let localDebunkDatabase = []
try {
  localDebunkDatabase = require(path.join(__dirname, '../shared/debunk-database.json'))
} catch (e) {
  try {
    localDebunkDatabase = require(path.join(__dirname, '../src/engine/data/debunk-database.json'))
  } catch (err) {
    localDebunkDatabase = []
  }
}

function generateTurnBackHoaxFallbackRssXml(maxItems = 35) {
  const items = Array.isArray(localDebunkDatabase) ? localDebunkDatabase.slice(0, maxItems) : []
  let itemsXml = ''
  for (const item of items) {
    const isHoaks = item.verdict === 'HOAKS' || item.verdict === 'DISINFORMASI'
    const tag = isHoaks ? '[SALAH] ' : '[FAKTA] '
    const cleanClaim = (item.claim || 'Informasi terverifikasi').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const title = tag + cleanClaim
    const link = (item.sourceUrl || `https://turnbackhoax.id/?s=${encodeURIComponent(item.id || 'debunk')}`).replace(/&/g, '&amp;')
    const clarification = (item.clarification || item.explanation || 'Klarifikasi fakta resmi oleh PUSSIBERAD dan MAFINDO.').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
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

let handleSocialExtractionRequest = null
try {
  const socialMod = require('./social-gateway-handler.cjs')
  handleSocialExtractionRequest = socialMod.handleSocialExtractionRequest
} catch (e) {
  console.warn('[NARADA Gateway] Social extraction handler not loaded:', e.message)
}

const ALLOWED_UPSTREAM_HOSTS = new Set(catalog.allowedUpstreamHosts)

const GATEWAY_SOURCE_REGISTRY = Object.fromEntries(
  catalog.sources.map(s => [
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

const gatewayCache = new Map()
const inFlightRequests = new Map()

function validateUpstreamUrl(urlStr) {
  try {
    const parsed = new URL(urlStr)
    const host = parsed.hostname.toLowerCase()

    if (parsed.protocol !== 'https:') {
      return { valid: false, reason: `Protokol tidak diizinkan: ${parsed.protocol}. Hanya HTTPS yang diperbolehkan.`, parsedHost: host }
    }

    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      return { valid: false, reason: 'Akses ke jaringan lokal/privat diblokir oleh SSRF firewall.', parsedHost: host }
    }

    const isAllowed = Array.from(ALLOWED_UPSTREAM_HOSTS).some(allowed => host === allowed || host.endsWith('.' + allowed))
    if (!isAllowed) {
      return { valid: false, reason: `Host tidak terakreditasi: ${host}. Permintaan ditolak.`, parsedHost: host }
    }

    return { valid: true, parsedHost: host }
  } catch (err) {
    return { valid: false, reason: `URL upstream tidak valid: ${err.message || 'Parse error'}` }
  }
}

function sanitizeGatewayError(msg) {
  if (!msg) return 'Kesalahan tidak diketahui pada gateway'
  return msg
    .replace(/(?:key|token|auth|password|secret|bearer)=[^& \s]+/gi, '$1=[REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9_\-.]+/gi, 'Bearer [REDACTED]')
}

async function handleRadarFeedRequest(sourceId, queryParams = {}) {
  const startTime = Date.now()

  if (queryParams.url || queryParams.target || queryParams.host || queryParams.redirect || queryParams.dest) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        errorCode: 'SSRF_OVERRIDE_FORBIDDEN',
        message: 'Parameter URL/host kustom dilarang. Gateway hanya melayani source ID resmi terdaftar.'
      }),
      latencyMs: Date.now() - startTime
    }
  }

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
      latencyMs: Date.now() - startTime
    }
  }

  if (!sourceConfig.enabled) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        errorCode: 'SOURCE_DISABLED_BY_POLICY',
        message: `Sumber '${sourceConfig.displayName}' (${sourceId}) dinonaktifkan oleh kebijakan kepatuhan NARADA.`
      }),
      latencyMs: Date.now() - startTime
    }
  }

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
      latencyMs: Date.now() - startTime
    }
  }

  const existingFlight = inFlightRequests.get(sourceId)
  if (existingFlight) {
    return existingFlight
  }

  const fetchPromise = (async () => {
    try {
      let targetUrl = sourceConfig.upstreamUrl
      let redirectCount = 0
      const MAX_REDIRECTS = 3
      let finalResponse = null
      let responseBody = ''

      const isJsonSource = sourceConfig.contentType.includes('json')
      const acceptHeader = isJsonSource
        ? 'application/json, text/plain, */*'
        : 'application/rss+xml, application/xml, text/xml, */*'

      while (redirectCount <= MAX_REDIRECTS) {
        const val = validateUpstreamUrl(targetUrl)
        if (!val.valid) {
          return {
            statusCode: 502,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              success: false,
              errorCode: 'UPSTREAM_URL_VALIDATION_FAILED',
              message: val.reason
            }),
            latencyMs: Date.now() - startTime
          }
        }

        const isGdelt = targetUrl.includes('gdeltproject.org')
        const timeoutMs = (sourceConfig && sourceConfig.timeoutMs) || (isGdelt ? 15000 : 14000)
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)

        let resp
        try {
          resp = await fetch(targetUrl, {
            method: 'GET',
            headers: {
              'User-Agent': 'NARADA-Tactical-Radar/2.0 (PUSSIBERAD TNI AD Defense Gateway)',
              'Accept': acceptHeader
            },
            redirect: 'manual',
            signal: controller.signal
          })
        } finally {
          clearTimeout(timer)
        }

        // Cek status redirect (301, 302, 307, 308)
        if (resp.status === 301 || resp.status === 302 || resp.status === 307 || resp.status === 308) {
          const loc = resp.headers.get('location')
          if (!loc) break
          targetUrl = new URL(loc, targetUrl).toString()
          redirectCount++
          continue
        }

        finalResponse = resp
        responseBody = await resp.text()
        break
      }

      if (!finalResponse) {
        return {
          statusCode: 504,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, errorCode: 'TOO_MANY_REDIRECTS', message: 'Maksimum pengalihan redirect tercapai.' }),
          latencyMs: Date.now() - startTime
        }
      }

      const resLatency = Date.now() - startTime

      if (finalResponse.ok) {
        if (isJsonSource) {
          const trimmed = responseBody.trim()
          const isHtml = trimmed.startsWith('<') || trimmed.toLowerCase().includes('<html') || trimmed.toLowerCase().includes('<!doctype')
          if (isHtml) {
            return {
              statusCode: 200,
              headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'X-Radar-State': 'DEGRADED',
                'X-Radar-Source': sourceId
              },
              body: responseBody,
              latencyMs: resLatency,
              errorCode: 'MALFORMED_CONTENT_NOT_JSON',
              errorMessage: 'Respons diterima namun bukan format JSON valid (terdeteksi respons HTML)'
            }
          }
          try {
            JSON.parse(responseBody)
          } catch {
            return {
              statusCode: 200,
              headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'X-Radar-State': 'DEGRADED',
                'X-Radar-Source': sourceId
              },
              body: responseBody,
              latencyMs: resLatency,
              errorCode: 'MALFORMED_CONTENT_NOT_JSON',
              errorMessage: 'Respons diterima namun gagal diparse sebagai struktur JSON'
            }
          }
        } else {
          const isXmlFormat = responseBody.includes('<rss') || responseBody.includes('<feed') || responseBody.includes('<?xml') || responseBody.includes('<item')
          if (!isXmlFormat) {
            return {
              statusCode: 200,
              headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'X-Radar-State': 'DEGRADED',
                'X-Radar-Source': sourceId
              },
              body: responseBody,
              latencyMs: resLatency,
              errorCode: 'MALFORMED_CONTENT_NOT_XML',
              errorMessage: 'Respons diterima namun bukan format XML feed standar'
            }
          }
        }

        gatewayCache.set(sourceId, {
          xml: responseBody,
          httpStatus: finalResponse.status,
          fetchedAt: Date.now(),
          expiresAt: Date.now() + sourceConfig.ttlMs,
          sourceId,
          contentLength: Buffer.byteLength(responseBody, 'utf8')
        })

        return {
          statusCode: finalResponse.status,
          headers: {
            'Content-Type': sourceConfig.contentType,
            'X-Radar-Cache': 'MISS',
            'X-Radar-Source': sourceId,
            'Content-Length': Buffer.byteLength(responseBody, 'utf8').toString()
          },
          body: responseBody,
          latencyMs: resLatency
        }
      } else {
        if (sourceId === 'src-tbh' || sourceId.includes('tbh')) {
          console.log(`[NARADA Gateway] Upstream ${sourceId} gagal (status ${finalResponse.status}), mengaktifkan cadangan resilient offline XML.`);
          const fallbackXml = generateTurnBackHoaxFallbackRssXml(35);
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/rss+xml; charset=utf-8',
              'X-Radar-Fallback': 'RESILIENT_AIRGAP_SNAPSHOT',
              'X-Radar-Source': sourceId,
              'Content-Length': Buffer.byteLength(fallbackXml, 'utf8').toString()
            },
            body: fallbackXml,
            latencyMs: resLatency
          };
        }
        return {
          statusCode: finalResponse.status,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            errorCode: `UPSTREAM_HTTP_${finalResponse.status}`,
            message: `Upstream mengembalikan status HTTP ${finalResponse.status}.`
          }),
          latencyMs: resLatency
        }
      }
    } catch (err) {
      if (sourceId === 'src-tbh' || sourceId.includes('tbh')) {
        console.log(`[NARADA Gateway] Upstream ${sourceId} timeout/error, mengaktifkan cadangan resilient offline XML.`);
        const fallbackXml = generateTurnBackHoaxFallbackRssXml(35);
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/rss+xml; charset=utf-8',
            'X-Radar-Fallback': 'RESILIENT_AIRGAP_SNAPSHOT',
            'X-Radar-Source': sourceId,
            'Content-Length': Buffer.byteLength(fallbackXml, 'utf8').toString()
          },
          body: fallbackXml,
          latencyMs: Date.now() - startTime
        };
      }
      return {
        statusCode: 504,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          errorCode: 'UPSTREAM_GATEWAY_TIMEOUT',
          message: sanitizeGatewayError(err.message || 'Fetch gagal.')
        }),
        latencyMs: Date.now() - startTime
      }
    } finally {
      inFlightRequests.delete(sourceId)
    }
  })()

  inFlightRequests.set(sourceId, fetchPromise)
  return fetchPromise
}

const dynamicSearchHistory = []
const phraseLastSearchedAt = new Map()

/**
 * Semaphore pembatas konkurensi pencarian dinamis CJS (Sprint 7 WP6 - Carry-over 8.6)
 */
class DynamicSearchSemaphore {
  constructor(max = 2, maxQueue = 10) {
    this.active = 0
    this.max = max
    this.queue = []
    this.maxQueue = maxQueue
  }

  async acquire() {
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

  release() {
    if (this.queue.length > 0) {
      const next = this.queue.shift()
      if (next) next.resolve()
    } else {
      this.active = Math.max(0, this.active - 1)
    }
  }

  getActiveCount() {
    return this.active
  }

  getQueueLength() {
    return this.queue.length
  }

  reset() {
    this.active = 0
    this.queue = []
  }
}

const dynamicSearchSemaphore = new DynamicSearchSemaphore(
  catalog.dynamicSearchPolicy?.maxConcurrentDynamicSearches || 2,
  10
)

function validateDynamicSearchQuery(profileId, topic) {
  const gnewsProfiles = catalog.googleNewsProfiles || {}
  const gdeltProfiles = catalog.gdeltProfiles || {}
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

  const maxLen = catalog.dynamicSearchPolicy?.maxPhraseLength || 80
  const maxTokens = catalog.dynamicSearchPolicy?.maxPhraseTokens || 5

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

async function handleRadarSearchRequest(profileId, queryParams = {}) {
  const startTime = Date.now()
  const rawTopic = queryParams.topic || ''

  // 1. Validasi Terpusat Paritas TS/CJS (WP6 / S61-29)
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
      latencyMs: Date.now() - startTime
    }
  }

  const sanitizedTopic = validation.sanitizedTopic
  const profile = validation.profile
  const isGdelt = Boolean(validation.isGdelt || profileId.startsWith('gdelt-'))
  const contentType = isGdelt ? 'application/json; charset=utf-8' : 'application/rss+xml; charset=utf-8'

  const normPhrase = sanitizedTopic.toLowerCase()
  const cooldownMs = catalog.dynamicSearchPolicy?.phraseCooldownMs || 1800000
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
          'Content-Length': cached.contentLength.toString()
        },
        body: cached.xml,
        latencyMs: Date.now() - startTime
      }
    }
  }

  const now = Date.now()
  const oneDayAgo = now - 24 * 3600 * 1000
  const recentSearches = dynamicSearchHistory.filter(r => r.timestamp > oneDayAgo)
  const max24h = catalog.dynamicSearchPolicy?.maxDynamicQueriesPer24h || 8
  if (recentSearches.length >= max24h) {
    return {
      statusCode: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' },
      body: JSON.stringify({
        success: false,
        errorCode: 'DYNAMIC_SEARCH_QUOTA_EXCEEDED',
        message: 'Batas pencarian dinamis 24 jam terlampaui.'
      }),
      latencyMs: Date.now() - startTime
    }
  }

  const cached = gatewayCache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) {
    return {
      statusCode: cached.httpStatus,
      headers: {
        'Content-Type': contentType,
        'X-Radar-Cache': 'HIT',
        'X-Radar-Source': profileId,
        'X-Radar-Search-Topic': sanitizedTopic,
        'Content-Length': cached.contentLength.toString()
      },
      body: cached.xml,
      latencyMs: Date.now() - startTime
    }
  }

  const existingFlight = inFlightRequests.get(cacheKey)
  if (existingFlight) return existingFlight

  // Pembatasan Konkurensi Global (Semaphore)
  try {
    await dynamicSearchSemaphore.acquire()
  } catch (err) {
    return {
      statusCode: 429,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        errorCode: 'CONCURRENT_SEARCH_LIMIT_EXCEEDED',
        message: 'Batas konkurensi pencarian dinamis terlampaui. Silakan coba kembali sesaat lagi.'
      }),
      latencyMs: Date.now() - startTime
    }
  }

  let upstreamSearchUrl = ''
  if (isGdelt) {
    const gdeltBaseUrl = catalog.dynamicSearchPolicy?.gdeltBaseUrl || 'https://api.gdeltproject.org/api/v2/doc/doc'
    const queryParam = `("${sanitizedTopic}") ${profile.query}`
    upstreamSearchUrl = `${gdeltBaseUrl}?query=${encodeURIComponent(queryParam)}&mode=artlist&format=json&sort=datedesc&maxrecords=50&timespan=7d`
  } else {
    const queryStr = `(${profile.query}) AND ("${sanitizedTopic}")`
    const searchBaseUrl = catalog.dynamicSearchPolicy?.searchBaseUrl || 'https://news.google.com/rss/search'
    upstreamSearchUrl = `${searchBaseUrl}?q=${encodeURIComponent(queryStr)}&hl=${profile.locale || 'id'}&gl=${profile.gl || 'ID'}&ceid=${profile.ceid || 'ID:id'}`
  }

  const fetchPromise = (async () => {
    try {
      let currentUrl = upstreamSearchUrl
      let redirectCount = 0
      let response = null
      let bodyText = ''

      while (redirectCount <= 3) {
        const validation = validateUpstreamUrl(currentUrl)
        if (!validation.valid) {
          return {
            statusCode: 502,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, errorCode: 'UPSTREAM_URL_VALIDATION_FAILED', message: validation.reason }),
            latencyMs: Date.now() - startTime
          }
        }

        const isGdelt = targetUrl.includes('gdeltproject.org')
        const timeoutMs = (sourceConfig && sourceConfig.timeoutMs) || (isGdelt ? 15000 : 14000)
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)

        let resp
        try {
          resp = await fetch(currentUrl, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NARADA-Defense/1.0',
              'Accept': isGdelt ? 'application/json, text/plain, */*' : 'application/rss+xml, application/xml, text/xml, */*'
            },
            redirect: 'manual',
            signal: controller.signal
          })
        } finally {
          clearTimeout(timer)
        }

        if (resp.status === 301 || resp.status === 302 || resp.status === 307 || resp.status === 308) {
          redirectCount++
          if (redirectCount > 3) {
            return {
              statusCode: 504,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ success: false, errorCode: 'TOO_MANY_REDIRECTS', message: 'Maksimum redirect terlampaui.' }),
              latencyMs: Date.now() - startTime
            }
          }
          const loc = resp.headers.get('location')
          if (!loc) break
          currentUrl = new URL(loc, currentUrl).toString()
          continue
        }

        response = resp
        bodyText = await resp.text()
        break
      }

      if (!response) {
        return {
          statusCode: 504,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, errorCode: 'UPSTREAM_NO_RESPONSE', message: 'Tidak ada respon dari upstream Google News.' }),
          latencyMs: Date.now() - startTime
        }
      }

      if (response.status === 429) {
        return {
          statusCode: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
          body: JSON.stringify({ success: false, errorCode: 'UPSTREAM_RATE_LIMITED' }),
          latencyMs: Date.now() - startTime
        }
      }

      if (!response.ok) {
        return {
          statusCode: response.status,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, errorCode: `UPSTREAM_HTTP_${response.status}` }),
          latencyMs: Date.now() - startTime
        }
      }

      const MAX_RESPONSE_SIZE = 2 * 1024 * 1024
      if (Buffer.byteLength(bodyText, 'utf8') > MAX_RESPONSE_SIZE) {
        return {
          statusCode: 502,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, errorCode: 'RESPONSE_TOO_LARGE' }),
          latencyMs: Date.now() - startTime
        }
      }

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
            latencyMs: Date.now() - startTime,
            errorCode: 'MALFORMED_CONTENT_NOT_XML',
            errorMessage: 'Respons diterima namun bukan format XML feed standar'
          }
        }
      }

      dynamicSearchHistory.push({ timestamp: Date.now(), profileId, topic: sanitizedTopic })
      phraseLastSearchedAt.set(normPhrase, Date.now())

      gatewayCache.set(cacheKey, {
        xml: bodyText,
        httpStatus: response.status,
        fetchedAt: Date.now(),
        expiresAt: Date.now() + 300_000,
        sourceId: profileId,
        contentLength: Buffer.byteLength(bodyText, 'utf8')
      })

      return {
        statusCode: response.status,
        headers: {
          'Content-Type': contentType,
          'X-Radar-Cache': 'MISS',
          'X-Radar-Source': profileId,
          'X-Radar-Search-Topic': sanitizedTopic,
          'Content-Length': Buffer.byteLength(bodyText, 'utf8').toString()
        },
        body: bodyText,
        latencyMs: Date.now() - startTime
      }
    } catch (err) {
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, errorCode: 'UPSTREAM_NETWORK_FAILURE', message: sanitizeGatewayError(err.message) }),
        latencyMs: Date.now() - startTime
      }
    } finally {
      inFlightRequests.delete(cacheKey)
      dynamicSearchSemaphore.release()
    }
  })()

  inFlightRequests.set(cacheKey, fetchPromise)
  return fetchPromise
}

function createGatewayServer() {
  const server = http.createServer(async (req, res) => {
    // 1. Validasi Host header (Perlindungan DNS rebinding attack)
    const hostHeader = (req.headers['host'] || '').split(':')[0].toLowerCase()
    if (hostHeader && hostHeader !== '127.0.0.1' && hostHeader !== 'localhost') {
      res.writeHead(403, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: false, message: 'Akses ditolak: Host tidak valid untuk local loopback gateway.' }))
      return
    }

    // 2. Pembatasan Origin (Restricted CORS Policy)
    const origin = req.headers['origin']
    const allowedOrigins = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5174',
      'null'
    ]
    if (origin && !allowedOrigins.includes(origin) && !origin.startsWith('file://')) {
      res.writeHead(403, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: false, message: 'Akses ditolak: Origin eksternal tidak diizinkan.' }))
      return
    }

    const allowOriginHeader = origin || '*'
    res.setHeader('Access-Control-Allow-Origin', allowOriginHeader)
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Radar-Client')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: false, message: 'Metode tidak didukung. Hanya GET yang diizinkan.' }))
      return
    }

    const reqUrl = new URL(req.url || '/', 'http://127.0.0.1')
    const pathname = reqUrl.pathname
    const query = Object.fromEntries(reqUrl.searchParams.entries())

    // Health check
    if (pathname === '/api/radar/gateway/health' || pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        status: 'HEALTHY',
        mode: 'packaged-electron',
        version: '2026.10-sprint5',
        timestamp: new Date().toISOString(),
        sources: Object.keys(GATEWAY_SOURCE_REGISTRY).map(k => ({
          sourceId: k,
          name: GATEWAY_SOURCE_REGISTRY[k].displayName,
          enabled: GATEWAY_SOURCE_REGISTRY[k].enabled
        }))
      }, null, 2))
      return
    }

    // Feed endpoint: /api/radar/feed/:sourceId
    const feedMatch = pathname.match(/^\/api\/radar\/feed\/([a-zA-Z0-9_-]+)$/)
    if (feedMatch) {
      const sourceId = feedMatch[1]
      try {
        const result = await handleRadarFeedRequest(sourceId, query)
        res.writeHead(result.statusCode, {
          ...result.headers,
          'Access-Control-Allow-Origin': '*'
        })
        res.end(result.body)
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, message: sanitizeGatewayError(err.message) }))
      }
      return
    }

    // Dynamic Search endpoint: /api/radar/search/:profileId
    const searchMatch = pathname.match(/^\/api\/radar\/search\/([a-zA-Z0-9_-]+)$/)
    if (searchMatch) {
      const profileId = searchMatch[1]
      try {
        const result = await handleRadarSearchRequest(profileId, query)
        res.writeHead(result.statusCode, {
          ...result.headers,
          'Access-Control-Allow-Origin': '*'
        })
        res.end(result.body)
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, message: sanitizeGatewayError(err.message) }))
      }
      return
    }

    // Social Media Extraction endpoint: /api/social/extract
    if (pathname === '/api/social/extract') {
      if (typeof handleSocialExtractionRequest === 'function') {
        try {
          const result = await handleSocialExtractionRequest(query)
          res.writeHead(result.statusCode, {
            ...result.headers,
            'Access-Control-Allow-Origin': '*'
          })
          res.end(result.body)
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, errorMessage: err?.message || 'Social extraction gateway error' }))
        }
      } else {
        res.writeHead(503, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, errorMessage: 'Social gateway handler tidak tersedia di lingkungan runtime ini.' }))
      }
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: false, message: `Rute '${pathname}' tidak ditemukan pada gateway.` }))
  })

  return server
}

function startGatewayServer(port = 5174, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const server = createGatewayServer()
    server.on('error', (err) => {
      reject(err)
    })
    server.listen(port, host, () => {
      console.log(`[NARADA Loopback Gateway] Berjalan di http://${host}:${port}`)
      resolve({ server, port, host })
    })
  })
}

function stopGatewayServer(server) {
  return new Promise((resolve) => {
    if (!server) return resolve()
    server.close(() => {
      console.log('[NARADA Loopback Gateway] Berhenti.')
      resolve()
    })
  })
}

if (require.main === module) {
  const port = parseInt(process.env.PORT || '5174', 10)
  startGatewayServer(port).catch(err => {
    console.error('Gagal menjalankan standalone gateway:', err)
    process.exit(1)
  })
}

module.exports = {
  createGatewayServer,
  startGatewayServer,
  stopGatewayServer,
  validateUpstreamUrl,
  validateDynamicSearchQuery,
  handleRadarFeedRequest,
  handleRadarSearchRequest,
  DynamicSearchSemaphore,
  GATEWAY_SOURCE_REGISTRY,
  ALLOWED_UPSTREAM_HOSTS
}
