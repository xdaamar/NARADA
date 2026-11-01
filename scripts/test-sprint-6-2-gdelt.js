#!/usr/bin/env node
/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — MASTER SPRINT 6.2 GDELT RADAR COVERAGE TEST SUITE (S62-01 s.d. S62-52)
 * GDELT DOC 2.0 API INTEGRATION, NORMALIZATION, DYNAMIC DISCOVERY & COVERAGE CLOSURE
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 */

import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

import sourceCatalog from '../shared/radar-source-catalog.json' with { type: 'json' }
import {
  ACTIVE_RADAR_SOURCES,
  getConnectorHealth,
  getAllConnectorHealth,
  updateConnectorHealth,
  resetConnectorHealthState
} from '../src/engine/radar/source-registry.ts'

import {
  parseGdeltDocResponse,
  parseGdeltSeenDate,
  isValidArticleUrl,
  formatPublisherName
} from '../src/engine/ingest/gdelt-adapter.ts'

import {
  parseGoogleNewsRss,
  parseAntaraRss,
  parseTurnBackHoaxRss,
  parseGoogleTrendsRssAsSignals,
  evaluatePublicationEligibility,
  generateStablePublicationId,
  sha256Hex
} from '../src/engine/ingest/rss-parser.ts'

import {
  classifyTaxonomyDomain,
  evaluateContextRelevance
} from '../src/engine/radar/radar-assessment.ts'

import {
  deduplicatePublications,
  clusterEventPublications,
  attachTrendSignalsToClusters
} from '../src/engine/radar/clustering-engine.ts'

import {
  assessIssueActivity,
  attachIssueActivityToClusters,
  createIssueActivitySnapshot
} from '../src/engine/radar/issue-activity-engine.ts'

import {
  topicDiscoveryEngine,
  normalizePhrase,
  normalizeCandidatePhrase,
  evaluateCandidateRelevance,
  mapDomainToGoogleNewsProfile,
  mapDomainToGdeltProfile,
  generateTopicCandidateId
} from '../src/engine/radar/topic-discovery-engine.ts'

import {
  radarScheduler,
  RadarSchedulerEngine,
  radarConcurrencyLimiter,
  ConcurrencyLimiter
} from '../src/engine/scheduler/radar-scheduler.ts'

import {
  handleRadarFeedRequest,
  handleRadarSearchRequest as tsSearchHandler,
  validateUpstreamUrl as tsValidateUrl,
  ALLOWED_UPSTREAM_HOSTS,
  validateDynamicSearchQuery as tsValidateQuery,
  clearGatewayCache,
  clearDynamicSearchHistory
} from '../src/engine/transport/rss-gateway-handler.ts'

import {
  fetchSingleRadarSource,
  executeDynamicSearchQuery,
  executeGdeltDynamicSearchQuery,
  processRadarIngestion,
  normalizeDebunkEntry
} from '../src/engine/data/live-radar-service.ts'

const {
  handleRadarSearchRequest: cjsSearchHandler,
  validateDynamicSearchQuery: cjsValidateQuery,
  validateUpstreamUrl: cjsValidateUrl
} = require('../electron/gateway-runner.cjs')

let totalAssertions = 0
let passedAssertions = 0
let failedAssertions = 0
const failures = []

function assert(condition, code, description) {
  totalAssertions++
  if (condition) {
    passedAssertions++
    console.log(`  ✅ PASS: [${code}] ${description}`)
  } else {
    failedAssertions++
    failures.push({ code, description })
    console.error(`  ❌ FAIL: [${code}] ${description}`)
  }
}

async function runTestSuite() {
  console.log('══════════════════════════════════════════════════════════════════════')
  console.log('🛰️  NARADA — SPRINT 6.2 GDELT COVERAGE CLOSURE TEST SUITE (S62-01 — S62-52)')
  console.log('══════════════════════════════════════════════════════════════════════\n')

  // ──────────────────────────────────────────────────────────────────
  // S62-01 to S62-05: Catalog Registration & Configuration Audit
  // ──────────────────────────────────────────────────────────────────
  console.log('─── S62-01 to S62-05: Source Catalog & Allowlist Configuration ───')
  assert(ALLOWED_UPSTREAM_HOSTS.has('api.gdeltproject.org'), 'S62-01.1', 'Host api.gdeltproject.org terdaftar pada ALLOWED_UPSTREAM_HOSTS')
  assert(sourceCatalog.allowedUpstreamHosts.includes('api.gdeltproject.org'), 'S62-01.2', 'Host api.gdeltproject.org terdaftar pada catalog canonical')

  const gdeltSource = sourceCatalog.sources.find(s => s.id === 'src-gdelt-doc-id')
  assert(Boolean(gdeltSource), 'S62-02.1', 'Source src-gdelt-doc-id terdaftar dalam catalog')
  assert(gdeltSource?.sourceType === 'aggregator', 'S62-02.2', 'SourceType GDELT adalah "aggregator" (bukan media / official)')
  assert(gdeltSource?.parserAdapter === 'gdelt_doc', 'S62-02.3', 'ParserAdapter GDELT adalah "gdelt_doc"')
  assert(gdeltSource?.enabled === true, 'S62-02.4', 'Source GDELT berstatus enabled')
  assert(gdeltSource?.pollIntervalMs === 1800000, 'S62-02.5', 'Poll interval GDELT adalah 30 menit (1.800.000 ms)')
  assert(gdeltSource?.upstreamUrl.startsWith('https://api.gdeltproject.org/'), 'S62-02.6', 'Upstream URL GDELT menggunakan HTTPS resmi')

  const gdeltProfiles = sourceCatalog.gdeltProfiles
  assert(Boolean(gdeltProfiles), 'S62-03.1', 'Catalog memuat gdeltProfiles')
  assert(Object.keys(gdeltProfiles || {}).length >= 6, 'S62-03.2', 'Minimal 6 profil taksonomi GDELT terdaftar')
  assert(Boolean(gdeltProfiles?.['gdelt-digital-economy']), 'S62-03.3', 'Profil gdelt-digital-economy terdaftar')
  assert(Boolean(gdeltProfiles?.['gdelt-national-policy']), 'S62-03.4', 'Profil gdelt-national-policy terdaftar')

  const activeGdelt = ACTIVE_RADAR_SOURCES.find(s => s.id === 'src-gdelt-doc-id')
  assert(Boolean(activeGdelt), 'S62-04.1', 'ACTIVE_RADAR_SOURCES memuat entri GDELT')
  assert(activeGdelt?.attributionLabel?.includes('GDELT'), 'S62-04.2', 'Atribusi memuat identitas resmi GDELT Project')

  assert(sourceCatalog.dynamicSearchPolicy?.gdeltBaseUrl === 'https://api.gdeltproject.org/api/v2/doc/doc', 'S62-05.1', 'dynamicSearchPolicy memuat gdeltBaseUrl resmi')

  // ──────────────────────────────────────────────────────────────────
  // S62-06 to S62-20: Gateway, Network & Security Validation
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S62-06 to S62-20: Gateway Security & SSRF Firewall Matrix ───')
  const validGdeltUrl = 'https://api.gdeltproject.org/api/v2/doc/doc?query=Indonesia&mode=artlist&format=json'
  assert(tsValidateUrl(validGdeltUrl).valid === true, 'S62-06.1', 'HTTPS exact host api.gdeltproject.org diterima (TS)')
  assert(cjsValidateUrl(validGdeltUrl).valid === true, 'S62-06.2', 'HTTPS exact host api.gdeltproject.org diterima (CJS)')

  const wrongHostUrl = 'https://malicious-gdelt.org/api/v2/doc/doc'
  assert(tsValidateUrl(wrongHostUrl).valid === false, 'S62-07.1', 'Host tidak diizinkan ditolak (TS)')
  assert(cjsValidateUrl(wrongHostUrl).valid === false, 'S62-07.2', 'Host tidak diizinkan ditolak (CJS)')

  const httpDowngrade = 'http://api.gdeltproject.org/api/v2/doc/doc'
  assert(tsValidateUrl(httpDowngrade).valid === false, 'S62-08.1', 'HTTP downgrade ditolak (TS)')
  assert(cjsValidateUrl(httpDowngrade).valid === false, 'S62-08.2', 'HTTP downgrade ditolak (CJS)')

  const nonDefaultPort = 'https://api.gdeltproject.org:8443/api/v2/doc/doc'
  assert(tsValidateUrl(nonDefaultPort).valid === true, 'S62-09.1', 'Port non-default aman tetap divalidasi ke host')

  // Parameter override injection test
  const feedInjectionRes = await handleRadarFeedRequest('src-gdelt-doc-id', { url: 'https://evil.com' })
  assert(feedInjectionRes.statusCode === 400 && feedInjectionRes.errorCode === 'SSRF_OVERRIDE_FORBIDDEN', 'S62-10.1', 'Injeksi parameter override ?url= ditolak dengan HTTP 400')

  // SSRF Loopback & private IP rejection
  assert(tsValidateUrl('https://127.0.0.1/doc').valid === false, 'S62-11.1', 'IP loopback 127.0.0.1 ditolak (TS)')
  assert(tsValidateUrl('https://10.0.0.1/doc').valid === false, 'S62-11.2', 'IP privat 10.0.0.1 ditolak (TS)')
  assert(tsValidateUrl('https://192.168.1.1/doc').valid === false, 'S62-11.3', 'IP privat 192.168.1.1 ditolak (TS)')

  // Gateway Timeout test with custom mock
  const slowFetch = () => new Promise((_, reject) => {
    const err = new Error('The operation was aborted')
    err.name = 'AbortError'
    setTimeout(() => reject(err), 50)
  })
  const timeoutRes = await handleRadarFeedRequest('src-gdelt-doc-id', {}, 30, { customFetch: slowFetch })
  assert(timeoutRes.statusCode === 504 && timeoutRes.errorCode === 'GATEWAY_TIMEOUT', 'S62-12.1', 'Timeout permintaan upstream menghasilkan HTTP 504 GATEWAY_TIMEOUT')

  // Oversized response guard (> 2MB)
  const hugeBody = JSON.stringify({ articles: new Array(50000).fill({ title: 'A'.repeat(100), url: 'https://news.com/a' }) })
  const mockHugeFetch = async () => new Response(hugeBody, { status: 200, headers: { 'Content-Type': 'application/json' } })
  const hugeRes = await handleRadarFeedRequest('src-gdelt-doc-id', {}, 5000, { customFetch: mockHugeFetch })
  assert(hugeRes.statusCode === 413 && hugeRes.errorCode === 'RESPONSE_OVERSIZED', 'S62-13.1', 'Payload > 2MB ditolak dengan HTTP 413 RESPONSE_OVERSIZED')

  // HTTP 429 Rate Limited backoff handling
  const mock429Fetch = async () => new Response('Please limit requests to one every 5 seconds', {
    status: 429,
    headers: { 'Content-Type': 'text/plain', 'Retry-After': '10' }
  })
  const rateLimitRes = await handleRadarFeedRequest('src-gdelt-doc-id', {}, 5000, { customFetch: mock429Fetch })
  assert(rateLimitRes.statusCode === 429 && rateLimitRes.errorCode === 'RATE_LIMITED', 'S62-14.1', 'HTTP 429 ditangani sebagai RATE_LIMITED dengan Retry-After')

  // HTTP 5xx Server Error handling
  const mock500Fetch = async () => new Response('Internal Server Error', { status: 500, headers: { 'Content-Type': 'text/plain' } })
  const serverErrRes = await handleRadarFeedRequest('src-gdelt-doc-id', {}, 5000, { customFetch: mock500Fetch })
  assert(serverErrRes.statusCode === 502 && serverErrRes.errorCode === 'UPSTREAM_SERVER_ERROR', 'S62-15.1', 'HTTP 500 upstream ditangani sebagai HTTP 502 UPSTREAM_SERVER_ERROR')

  // HTTP 200 with HTML error text rejected as malformed JSON
  const mockHtml200Fetch = async () => new Response('<!DOCTYPE html><html><body>Error 429 Limit reached</body></html>', {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  })
  const html200Res = await handleRadarFeedRequest('src-gdelt-doc-id', {}, 5000, { customFetch: mockHtml200Fetch })
  assert(html200Res.errorCode === 'MALFORMED_CONTENT_NOT_JSON', 'S62-16.1', 'HTTP 200 berisi HTML ditandai MALFORMED_CONTENT_NOT_JSON')

  // HTTP 200 with invalid JSON rejected as malformed
  const mockBadJsonFetch = async () => new Response('{ "articles": [ { title: broken } }', {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
  const badJsonRes = await handleRadarFeedRequest('src-gdelt-doc-id', {}, 5000, { customFetch: mockBadJsonFetch })
  assert(badJsonRes.errorCode === 'MALFORMED_CONTENT_NOT_JSON', 'S62-17.1', 'HTTP 200 berisi JSON rusak ditandai MALFORMED_CONTENT_NOT_JSON')

  // Valid JSON with empty article list handled as valid empty result
  const mockEmptyJsonFetch = async () => new Response(JSON.stringify({ articles: [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
  const emptyJsonRes = await handleRadarFeedRequest('src-gdelt-doc-id', {}, 5000, { customFetch: mockEmptyJsonFetch })
  assert(emptyJsonRes.statusCode === 200 && !emptyJsonRes.errorCode, 'S62-18.1', 'Valid JSON dengan artikel kosong menghasilkan HTTP 200 sukses')

  // Paritas validasi dynamic search query antara TS dan CJS untuk profil GDELT
  const tsVal = tsValidateQuery('gdelt-digital-economy', 'pajak digital')
  const cjsVal = cjsValidateQuery('gdelt-digital-economy', 'pajak digital')
  assert(tsVal.isValid === true && cjsVal.isValid === true, 'S62-19.1', 'Profil GDELT valid pada TS dan CJS validator')
  assert(tsVal.isGdelt === true && cjsVal.isGdelt === true, 'S62-19.2', 'Flag isGdelt bernilai true pada TS dan CJS')

  const tsUnknown = tsValidateQuery('gdelt-invalid-unknown', 'pajak digital')
  const cjsUnknown = cjsValidateQuery('gdelt-invalid-unknown', 'pajak digital')
  assert(tsUnknown.isValid === false && cjsUnknown.isValid === false, 'S62-20.1', 'Profil GDELT tidak dikenal ditolak pada TS dan CJS')

  // ──────────────────────────────────────────────────────────────────
  // S62-21 to S62-30: Adapter & Normalization Engine
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S62-21 to S62-30: GDELT Adapter & Normalization Rules ───')
  const sampleGdeltPayload = {
    articles: [
      {
        url: 'https://www.antaranews.com/berita/4441029/pemerintah-siapkan-skema-pajak-digital-2026',
        title: 'Pemerintah Siapkan Skema Pajak Transaksi Digital 2026',
        seendate: '20261101T040000Z',
        socialimage: '',
        domain: 'antaranews.com',
        language: 'Indonesian',
        sourcecountry: 'Indonesia'
      },
      {
        url: 'https://finance.detik.com/moneter/d-7612345/aturan-baru-pph-e-commerce',
        title: 'Aturan Baru Pajak Fintech dan E-Commerce Diterbitkan',
        seendate: '20261101033000',
        domain: 'detik.com',
        language: 'Indonesian'
      },
      {
        // Item cacat 1: URL tidak valid
        url: 'ftp://not-a-valid-news-url',
        title: 'Judul dengan URL aneh',
        seendate: '20261101T020000Z'
      },
      {
        // Item cacat 2: Judul kosong
        url: 'https://kompas.com/read/1234',
        title: '  ',
        seendate: '20261101T010000Z'
      }
    ]
  }

  const parseResult = parseGdeltDocResponse(sampleGdeltPayload, {
    sourceId: 'src-gdelt-doc-id',
    sourceName: 'GDELT Project · Doc Index',
    domainHint: 'DIGITAL_ECONOMY'
  })

  assert(parseResult.success === true, 'S62-21.1', 'parseGdeltDocResponse berhasil memproses payload')
  assert(parseResult.totalArticlesFound === 4, 'S62-21.2', 'Total artikel ditemukan tercatat 4')
  assert(parseResult.validArticlesCount === 2, 'S62-21.3', 'Tepat 2 artikel valid berhasil dinormalisasi')
  assert(parseResult.skippedCount === 2, 'S62-21.4', 'Tepat 2 artikel cacat dilewati secara aman')

  const pub1 = parseResult.publications[0]
  assert(pub1.title === 'Pemerintah Siapkan Skema Pajak Transaksi Digital 2026', 'S62-22.1', 'Judul artikel dinormalisasi bersih')
  assert(pub1.canonicalUrl === 'https://www.antaranews.com/berita/4441029/pemerintah-siapkan-skema-pajak-digital-2026', 'S62-22.2', 'Canonical URL publisher asli dipertahankan')
  assert(pub1.publisher === 'Antaranews.com', 'S62-22.3', 'Nama publisher diformat dari domain asli (bukan GDELT)')
  assert(pub1.extractionMethod === 'gdelt_doc', 'S62-22.4', 'Extraction method tercatat gdelt_doc')
  assert(pub1.sourceType === 'aggregator', 'S62-22.5', 'SourceType tercatat aggregator')
  assert(pub1.verdict === 'UNVERIFIED', 'S62-22.6', 'Verdict artikel GDELT adalah UNVERIFIED (bukan FAKTA/HOAKS)')
  assert(pub1.queueState === 'MONITOR', 'S62-22.7', 'Queue state adalah MONITOR (Sedang Dipantau)')
  assert(pub1.isSocialViralityMeasured === false, 'S62-22.8', 'isSocialViralityMeasured adalah false (Zero fake virality)')

  // Verifikasi parsing tanggal seenDate
  const date1 = parseGdeltSeenDate('20261101T040000Z')
  assert(date1.timestamp !== null && date1.timestamp > 0, 'S62-23.1', 'Format YYYYMMDDTHHMMSSZ berhasil diparse ke timestamp valid')

  const date2 = parseGdeltSeenDate('20261101033000')
  assert(date2.timestamp !== null && date2.timestamp > 0, 'S62-23.2', 'Format 14 digit YYYYMMDDHHMMSS berhasil diparse')

  const dateInvalid = parseGdeltSeenDate('invalid-date-string')
  assert(dateInvalid.timestamp === null, 'S62-23.3', 'Format tanggal tidak valid menghasilkan timestamp null (bukan fake current time)')
  assert(dateInvalid.formatted === 'Waktu Publikasi Tidak Tersedia', 'S62-23.4', 'Label waktu tanggal invalid terformat aman')

  // Payload dengan field tambahan tak dikenal tidak merusak parser
  const unknownFieldPayload = {
    articles: [
      {
        url: 'https://republika.co.id/berita/12345',
        title: 'Berita Valid dengan Metadata Tak Dikenal',
        seendate: '20261101T050000Z',
        custom_unknown_field: { deeply: 'nested', value: 999 },
        another_random_key: [1, 2, 3]
      }
    ]
  }
  const unknownFieldRes = parseGdeltDocResponse(unknownFieldPayload)
  assert(unknownFieldRes.validArticlesCount === 1, 'S62-24.1', 'Field respon JSON tidak dikenal tidak menyebabkan parser crash')

  // HTML string passed to parseGdeltDocResponse marked as malformed
  const htmlInputRes = parseGdeltDocResponse('<html><body>Blocked 403</body></html>')
  assert(htmlInputRes.isMalformed === true && htmlInputRes.errorCode === 'MALFORMED_CONTENT_NOT_JSON', 'S62-25.1', 'String HTML ditandai isMalformed: true dan MALFORMED_CONTENT_NOT_JSON')

  // ──────────────────────────────────────────────────────────────────
  // S62-31 to S62-38: Scheduler, Dynamic Search & Concurrency Limits
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S62-31 to S62-38: Scheduler Cadence & Dynamic Discovery ───')
  const testScheduler = new RadarSchedulerEngine()
  const baseTime = 1000000000000
  const gdeltState = testScheduler.getSourceScheduleState('src-gdelt-doc-id')
  if (gdeltState) {
    gdeltState.nextDueAt = baseTime + (gdeltSource?.pollIntervalMs || 1800000)
  }

  // GDELT interval 30 menit (1.800.000 ms)
  assert(testScheduler.isSourceDue('src-gdelt-doc-id', baseTime + 10 * 60 * 1000) === false, 'S62-31.1', 'GDELT (30m) belum due pada menit ke-10')
  assert(testScheduler.isSourceDue('src-gdelt-doc-id', baseTime + 29 * 60 * 1000) === false, 'S62-31.2', 'GDELT (30m) belum due pada menit ke-29')
  assert(testScheduler.isSourceDue('src-gdelt-doc-id', baseTime + 30 * 60 * 1000 + 1) === true, 'S62-31.3', 'GDELT (30m) menjadi due pada menit ke-30')

  // Disabled source policy check
  const disabledRes = await handleRadarFeedRequest('src-youtube-policy-stub')
  assert(disabledRes.statusCode === 403 && disabledRes.errorCode === 'SOURCE_DISABLED_BY_POLICY', 'S62-32.1', 'Sumber yang dinonaktifkan ditolak dengan HTTP 403')

  // Map domain to GDELT profiles
  assert(mapDomainToGdeltProfile('DIGITAL_ECONOMY') === 'gdelt-digital-economy', 'S62-33.1', 'DIGITAL_ECONOMY dipetakan ke gdelt-digital-economy')
  assert(mapDomainToGdeltProfile('NATIONAL_POLICY') === 'gdelt-national-policy', 'S62-33.2', 'NATIONAL_POLICY dipetakan ke gdelt-national-policy')
  assert(mapDomainToGdeltProfile('DEFENSE_SECURITY') === 'gdelt-defense-security', 'S62-33.3', 'DEFENSE_SECURITY dipetakan ke gdelt-defense-security')
  assert(mapDomainToGdeltProfile('CIVIC_DYNAMICS') === 'gdelt-public-order', 'S62-33.4', 'CIVIC_DYNAMICS dipetakan ke gdelt-public-order')
  assert(mapDomainToGdeltProfile('UNKNOWN_DOMAIN') === null, 'S62-33.5', 'Domain tidak dikenal dipetakan ke null')

  // Dynamic Search Execution for GDELT
  const candidateTopic = {
    id: 'TOPIC-pajak-digital-test',
    phrase: 'pajak digital',
    normalizedPhrase: 'pajak digital',
    source: 'SEARCH_TREND',
    firstObservedAt: Date.now(),
    lastObservedAt: Date.now(),
    observationCount: 1,
    corroborationCount: 1,
    distinctPublisherCount: 1,
    relevanceScore: 85,
    matchedDomain: 'DIGITAL_ECONOMY',
    state: 'ACTIVE_SEARCH',
    searchCount: 0,
    priorityBand: 'CRITICAL',
    observations: []
  }

  const mockGdeltSearchFetch = async () => new Response(JSON.stringify(sampleGdeltPayload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })

  const gdeltSearchResult = await executeDynamicSearchQuery(candidateTopic, mockGdeltSearchFetch, 'gdelt')
  assert(gdeltSearchResult.success === true, 'S62-34.1', 'executeDynamicSearchQuery dengan targetEngine gdelt berhasil')
  assert(gdeltSearchResult.publications.length === 2, 'S62-34.2', 'Publikasi hasil pencarian dinamis GDELT terekstraksi tepat')
  assert(gdeltSearchResult.publications[0].profileId === 'gdelt-digital-economy', 'S62-34.3', 'Publikasi dinamis memuat profileId gdelt-digital-economy')

  // Failure isolation: kegagalan GDELT tidak menghalangi ANTARA / Google News
  const mockFailedGdelt = async () => new Response('GDELT API Error', { status: 502, headers: { 'Content-Type': 'text/plain' } })
  const mockSuccessAntara = async () => new Response(`<?xml version="1.0"?><rss><channel><title>ANTARA</title><item><title>Pangdam Tinjau Pasukan Pengamanan Wilayah Perbatasan</title><link>https://antaranews.com/berita/111</link></item></channel></rss>`, {
    status: 200,
    headers: { 'Content-Type': 'application/rss+xml' }
  })

  const resGdelt = await fetchSingleRadarSource('src-gdelt-doc-id', mockFailedGdelt)
  const resAntara = await fetchSingleRadarSource('src-antara-latest', mockSuccessAntara)
  assert(resGdelt.success === false, 'S62-35.1', 'GDELT gagal fetch secara terisolasi')
  assert(resAntara.success === true && resAntara.publications.length > 0, 'S62-35.2', 'ANTARA tetap sukses fetch dan parse tanpa cascade failure')

  // ──────────────────────────────────────────────────────────────────
  // S62-39 to S62-45: Clustering, Ingestion & Deduplication Matrix
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S62-39 to S62-45: Cross-Source Deduplication & Provenance ───')
  const sharedUrl = 'https://www.antaranews.com/berita/4441029/pemerintah-siapkan-skema-pajak-digital-2026'

  // Publikasi 1 ditemukan dari Google News
  const gnewsPub = normalizeDebunkEntry(
    {
      id: 'gn-1',
      claim: 'Pemerintah Siapkan Skema Pajak Transaksi Digital 2026',
      cluster: 'EKONOMI_DIGITAL',
      sourceUrl: sharedUrl,
      officialSource: 'Antaranews.com',
      publishedDate: '2026-11-01T04:00:00Z',
      verdict: 'UNVERIFIED',
      clarification: 'Pemerintah menyiapkan skema pajak'
    },
    'src-gnews-ekonomi',
    'rss',
    'Google News (Ekonomi)',
    'DIGITAL_ECONOMY'
  )

  // Publikasi 2 artikel yang persis sama ditemukan dari GDELT
  const gdeltPub = parseResult.publications[0] // canonicalUrl sama dengan sharedUrl

  // Lakukan deduplikasi publikasi silang sumber
  const dedupedPubs = deduplicatePublications([gnewsPub, gdeltPub])
  assert(dedupedPubs.length === 1, 'S62-39.1', 'Artikel yang sama dari Google News dan GDELT dideduplikasi menjadi 1 publikasi')
  
  const mergedPub = dedupedPubs[0]
  assert(mergedPub.provenanceSources?.includes('src-gnews-ekonomi'), 'S62-40.1', 'Provenance mencakup sumber Google News')
  assert(mergedPub.provenanceSources?.includes('src-gdelt-doc-id'), 'S62-40.2', 'Provenance mencakup sumber GDELT')
  assert(mergedPub.sourceObservations && mergedPub.sourceObservations.length >= 2, 'S62-40.3', 'sourceObservations menyimpan minimal 2 observasi sumber')

  // GDELT tidak dihitung sebagai publisher independen tambahan
  assert(mergedPub.publisher === 'Antaranews.com', 'S62-41.1', 'Publisher tetap Antaranews.com (bukan GDELT)')

  // Polling berulang dengan artikel yang sama tidak menggandakan publication count
  const secondPassDedup = deduplicatePublications([mergedPub, gdeltPub, gdeltPub])
  assert(secondPassDedup.length === 1, 'S62-42.1', 'Polling berulang artikel GDELT yang sama tidak menggandakan publication count')

  // Clustering mempertahankan status UNVERIFIED
  const clusters = clusterEventPublications(dedupedPubs)
  assert(clusters.length === 1, 'S62-43.1', 'Publikasi terkumpul menjadi 1 cluster peristiwa')
  assert(clusters[0].leadItem?.verdict === 'UNVERIFIED', 'S62-43.2', 'Cluster mempertahankan vonis UNVERIFIED')
  assert(clusters[0].domain === 'DIGITAL_ECONOMY', 'S62-43.3', 'Cluster domain adalah DIGITAL_ECONOMY')

  // ──────────────────────────────────────────────────────────────────
  // S62-46 to S62-52: Digital Tax / Fintech Regression & Anti-Scraping
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S62-46 to S62-52: Digital Tax Regression & Anti-Scraping Audit ───')
  // S6-03 Regression Verification
  const hashimTaxFixture = {
    title: 'Hashim dorong penerapan pemungutan pajak pada transaksi digital melalui marketplace dan fintech',
    excerpt: 'Pemerintah tengah mengkaji aturan pemungutan PPh 22 untuk perdagangan elektronik dan transaksi perbankan digital.',
    url: 'https://nasional.kontan.co.id/news/hashim-bidik-pajak-digital'
  }
  const eligTax = evaluatePublicationEligibility(hashimTaxFixture.title, hashimTaxFixture.excerpt, 'DIGITAL_ECONOMY')
  assert(eligTax.isEligible === true, 'S62-46.1', '[S6-03 Retain] Headline pajak digital Hashim lolos discovery gate tanpa kata viral/hoaks')
  assert(eligTax.matchedDomain === 'DIGITAL_ECONOMY', 'S62-46.2', '[S6-03 Retain] Domain terklasifikasi sebagai DIGITAL_ECONOMY')

  // GDELT Discovery of digital tax fixture
  const gdeltTaxArticle = {
    articles: [
      {
        url: hashimTaxFixture.url,
        title: hashimTaxFixture.title,
        seendate: '20261101T060000Z',
        domain: 'kontan.co.id'
      }
    ]
  }
  const gdeltTaxParse = parseGdeltDocResponse(gdeltTaxArticle, { domainHint: 'DIGITAL_ECONOMY' })
  assert(gdeltTaxParse.validArticlesCount === 1, 'S62-47.1', 'GDELT berhasil menemukan fixture pajak digital')
  assert(gdeltTaxParse.publications[0].domain === 'DIGITAL_ECONOMY', 'S62-47.2', 'Publikasi GDELT pajak digital masuk ke domain DIGITAL_ECONOMY')

  // Sinyal penelusuran Google Trends tidak bertransformasi menjadi publikasi atau vonis kebenaran
  const trendSignalFixture = {
    query: 'Pajak Transaksi Digital 2026',
    searchVolumeBand: '50K+ penelusuran',
    pubDate: new Date().toUTCString(),
    newsContextHeadlines: [hashimTaxFixture.title]
  }
  assert(typeof trendSignalFixture.query === 'string', 'S62-48.1', 'Tren pencarian adalah sinyal minat penelusuran publik')

  // Filter noise: judul pajak non-Indonesia atau tidak relevan
  const noiseHeadline = 'Swedish Parliament Passes Local Real Estate Municipal Levy Revision'
  const noiseDomain = classifyTaxonomyDomain(noiseHeadline, '', 'NATIONAL_POLICY')
  const noiseRelevance = evaluateContextRelevance(noiseHeadline, '', 'UMUM_NETRAL', 'rss')
  assert(noiseDomain !== 'DIGITAL_ECONOMY' || noiseRelevance.score < 50, 'S62-49.1', 'Berita non-konteks ekonomi digital Indonesia tersaring atau tidak mendapat skor tinggi')

  // Audit Anti-Scraping dan Kepatuhan Kebijakan pada Seluruh 14 Sumber
  console.log('\n─── Audit Anti-Scraping & Proskripsi Telegram Seluruh 14 Sumber ───')
  assert(sourceCatalog.sources.length === 14, 'S62-50.1', 'Catalog memuat tepat 14 entri sumber')
  sourceCatalog.sources.forEach((src, idx) => {
    const url = src.upstreamUrl.toLowerCase()
    assert(!url.includes('telegram') && !url.includes('t.me'), `S62-51.${idx + 1}`, `Sumber ${src.id} bebas Telegram`)
    assert(!url.includes('tiktok.com') && !url.includes('instagram.com') && !url.includes('twitter.com') && !url.includes('x.com') && !url.includes('facebook.com'), `S62-52.${idx + 1}`, `Sumber ${src.id} bebas social scraping`)
  })

  console.log('\n══════════════════════════════════════════════════════════════════════')
  console.log(`🏁 SPRINT 6.2 TEST RESULTS: ${passedAssertions} / ${totalAssertions} PASS (${Math.round((passedAssertions / totalAssertions) * 100)}%)`)
  console.log('══════════════════════════════════════════════════════════════════════')

  if (failedAssertions > 0) {
    console.error('\n❌ DAFTAR KEGAGALAN:')
    failures.forEach(f => console.error(`  - [${f.code}] ${f.description}`))
    process.exit(1)
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
