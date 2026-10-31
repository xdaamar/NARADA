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

const ALLOWED_UPSTREAM_HOSTS = new Set([
  'turnbackhoax.id',
  'news.google.com',
  'trends.google.com'
])

const GATEWAY_SOURCE_REGISTRY = {
  'src-tbh': {
    sourceId: 'src-tbh',
    displayName: 'TurnBackHoax (MAFINDO)',
    upstreamUrl: 'https://turnbackhoax.id/feed',
    allowedHost: 'turnbackhoax.id',
    enabled: true,
    ttlMs: 300_000,
    contentType: 'application/rss+xml; charset=utf-8'
  },
  'src-gnews-hankam': {
    sourceId: 'src-gnews-hankam',
    displayName: 'Google News — Hankam & TNI',
    upstreamUrl: 'https://news.google.com/rss/search?q=(TNI+OR+alutsista+OR+Papua+OR+KKB+OR+Ambalat+OR+kapal+perang)+AND+(viral+OR+heboh+OR+polemik+OR+kontroversi+OR+hoaks)+when:2d&hl=id&gl=ID&ceid=ID:id',
    allowedHost: 'news.google.com',
    enabled: true,
    ttlMs: 120_000,
    contentType: 'application/rss+xml; charset=utf-8'
  },
  'src-gnews-demo': {
    sourceId: 'src-gnews-demo',
    displayName: 'Google News — Aksi Massa & Unjuk Rasa',
    upstreamUrl: 'https://news.google.com/rss/search?q=(demo+OR+unjuk+rasa+OR+bentrok+OR+ricuh+OR+mahasiswa+OR+pemakzulan)+when:1d&hl=id&gl=ID&ceid=ID:id',
    allowedHost: 'news.google.com',
    enabled: true,
    ttlMs: 120_000,
    contentType: 'application/rss+xml; charset=utf-8'
  },
  'src-gnews-politik': {
    sourceId: 'src-gnews-politik',
    displayName: 'Google News — Kebijakan & Dinamika Negara',
    upstreamUrl: 'https://news.google.com/rss/search?q=(Prabowo+OR+Gibran+OR+bansos+OR+MBG+OR+ijazah+OR+KPK)+AND+(viral+OR+heboh+OR+polemik+OR+sidang)+when:1d&hl=id&gl=ID&ceid=ID:id',
    allowedHost: 'news.google.com',
    enabled: true,
    ttlMs: 120_000,
    contentType: 'application/rss+xml; charset=utf-8'
  },
  'src-gtrends-id': {
    sourceId: 'src-gtrends-id',
    displayName: 'Google Trends Indonesia (Search Interest)',
    upstreamUrl: 'https://trends.google.com/trending/rss?geo=ID',
    allowedHost: 'trends.google.com',
    enabled: true,
    ttlMs: 180_000,
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

        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 8000)

        let resp
        try {
          resp = await fetch(targetUrl, {
            method: 'GET',
            headers: {
              'User-Agent': 'NARADA-Tactical-Radar/2.0 (PUSSIBERAD TNI AD Defense Gateway)',
              'Accept': 'application/rss+xml, application/xml, text/xml, */*'
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
  handleRadarFeedRequest,
  GATEWAY_SOURCE_REGISTRY,
  ALLOWED_UPSTREAM_HOSTS
}
