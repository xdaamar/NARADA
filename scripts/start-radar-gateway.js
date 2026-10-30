#!/usr/bin/env node
/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — SECURE PRODUCTION RSS GATEWAY SERVER (NODE.JS RUNNER)
 * SPRINT 1C: STANDALONE GATEWAY FOR DESKTOP / PRODUCTION PACKAGED APP
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 */

import http from 'http'
import { parse } from 'url'
import { handleRadarFeedRequest, getGatewayHealthStatus } from '../src/engine/transport/rss-gateway-handler.ts'

const PORT = parseInt(process.env.PORT || '5174', 10)
const HOST = process.env.HOST || '127.0.0.1'

const server = http.createServer(async (req, res) => {
  // CORS Headers untuk integrasi aplikasi client lokal
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Radar-Client')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: false, message: 'Metode tidak diizinkan. Hanya GET yang didukung.' }))
    return
  }

  const parsedUrl = parse(req.url || '', true)
  const pathname = parsedUrl.pathname || ''
  const query = parsedUrl.query || {}

  // 1. Health Endpoint: /api/radar/gateway/health
  if (pathname === '/api/radar/gateway/health' || pathname === '/api/health') {
    const health = getGatewayHealthStatus()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(health, null, 2))
    return
  }

  // 2. Feed Endpoint: /api/radar/feed/:sourceId
  const feedMatch = pathname.match(/^\/api\/radar\/feed\/([a-zA-Z0-9_-]+)$/)
  if (feedMatch) {
    const sourceId = feedMatch[1]
    const result = await handleRadarFeedRequest(sourceId, query)

    // Tulis headers dari gateway
    for (const [key, value] of Object.entries(result.headers)) {
      res.setHeader(key, value)
    }

    res.writeHead(result.statusCode)
    res.end(result.body)
    return
  }

  // Route tidak dikenal
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({
    success: false,
    message: 'Endpoint tidak ditemukan pada NARADA RSS Gateway.',
    availableEndpoints: [
      'GET /api/radar/feed/:sourceId',
      'GET /api/radar/gateway/health'
    ]
  }))
})

server.listen(PORT, HOST, () => {
  console.log(`[NARADA RSS GATEWAY] Berjalan pada http://${HOST}:${PORT}`)
  console.log(`[NARADA RSS GATEWAY] Endpoint feed: http://${HOST}:${PORT}/api/radar/feed/:sourceId`)
  console.log(`[NARADA RSS GATEWAY] Health check : http://${HOST}:${PORT}/api/radar/gateway/health`)
})
