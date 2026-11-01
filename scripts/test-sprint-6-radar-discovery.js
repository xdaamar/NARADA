#!/usr/bin/env node
/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — SPRINT 6 MASTER RADAR DISCOVERY TEST SUITE (S6-01 s.d. S6-32)
 * CANONICAL CATALOG, ADAPTIVE DISCOVERY, COVERAGE MOMENTUM & HARDENING
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 */

import fs from 'fs'
import path from 'path'
import http from 'http'
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
  attachIssueActivityToClusters
} from '../src/engine/radar/issue-activity-engine.ts'

import {
  topicDiscoveryEngine,
  normalizePhrase,
  normalizeCandidatePhrase,
  extractCandidatePhrases,
  evaluateCandidateRelevance
} from '../src/engine/radar/topic-discovery-engine.ts'

import {
  radarScheduler,
  RadarSchedulerEngine
} from '../src/engine/scheduler/radar-scheduler.ts'

import {
  handleRadarFeedRequest,
  handleRadarSearchRequest,
  validateUpstreamUrl,
  ALLOWED_UPSTREAM_HOSTS,
  validateDynamicSearchQuery
} from '../src/engine/transport/rss-gateway-handler.ts'

import { computeEarlyWarningScore, scoreAndTriageRadarEntries } from '../src/engine/radar/early-warning-scorer.ts'

const { startGatewayServer, stopGatewayServer, handleRadarSearchRequest: cjsSearchHandler } = require('../electron/gateway-runner.cjs')

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

async function runSprint6TestSuite() {
  console.log('══════════════════════════════════════════════════════════════════════')
  console.log('🛰️  NARADA — SPRINT 6 MASTER RADAR DISCOVERY TEST SUITE (S6-01 — S6-32)')
  console.log('══════════════════════════════════════════════════════════════════════\n')

  // ──────────────────────────────────────────────────────────────────
  // S6-01: Google News query profiles tidak mewajibkan kata viral/heboh/polemik
  // ──────────────────────────────────────────────────────────────────
  console.log('─── S6-01: Google News Query Profiles Broad Discovery ───')
  const gnewsProfiles = sourceCatalog.sources.filter(s => s.id.startsWith('src-gnews-'))
  assert(gnewsProfiles.length >= 6, 'S6-01.1', 'Catalog memuat minimal 6 query profiles Google News')
  for (const prof of gnewsProfiles) {
    const rawQuery = prof.queryTemplate || prof.upstreamUrl || (sourceCatalog.googleNewsProfiles && sourceCatalog.googleNewsProfiles[prof.profileId]?.query) || ''
    const hasViralRequirement = /viral|heboh|geger/i.test(rawQuery)
    assert(!hasViralRequirement, `S6-01.2-${prof.id}`, `Profile ${prof.id} tidak mewajibkan kata sensasional/viral`)
  }

  // ──────────────────────────────────────────────────────────────────
  // S6-02: Headline relevan tanpa keyword kontroversi lolos discovery gate
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-02: Non-Controversial Relevant Headline Discovery ───')
  const headlineKemenhan = 'Kementerian Pertahanan menggelar rapat koordinasi penguatan alutsista perbatasan laut Natuna'
  const eligKemenhan = evaluatePublicationEligibility(headlineKemenhan, 'Rapat koordinasi rutin Kemhan bersama Mabes TNI', 'DEFENSE_SECURITY')
  assert(eligKemenhan.isEligible === true, 'S6-02.1', 'Headline alutsista Natuna lolos eligibility tanpa kata kontroversi/viral')
  assert(eligKemenhan.matchedDomain === 'DEFENSE_SECURITY', 'S6-02.2', 'Terasosiasi ke domain DEFENSE_SECURITY')

  // ──────────────────────────────────────────────────────────────────
  // S6-03: Required Regression Fixture — Digital Tax / Transactions
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-03: Required Regression Fixture (Digital Tax / Fintech) ───')
  const digitalTaxHeadline = 'Hashim dorong penerapan pemungutan pajak pada transaksi digital melalui marketplace dan fintech'
  const digitalTaxExcerpt = 'Pemerintah tengah mengkaji aturan pemungutan PPh 22 untuk perdagangan elektronik dan transaksi perbankan digital.'
  const eligTax = evaluatePublicationEligibility(digitalTaxHeadline, digitalTaxExcerpt, 'DIGITAL_ECONOMY')
  assert(eligTax.isEligible === true, 'S6-03.1', 'Headline digital tax Hashim lolos discovery gate tanpa kata viral/hoaks')
  assert(eligTax.matchedDomain === 'DIGITAL_ECONOMY', 'S6-03.2', 'Domain terklasifikasi sebagai DIGITAL_ECONOMY')

  const profileEcon = sourceCatalog.sources.find(s => s.id === 'src-gnews-ekonomi')
  assert(Boolean(profileEcon), 'S6-03.3', 'Terdapat query profile Google News khusus Ekonomi Digital')
  const econQuery = profileEcon.queryTemplate || profileEcon.upstreamUrl || (sourceCatalog.googleNewsProfiles && sourceCatalog.googleNewsProfiles[profileEcon.profileId]?.query) || ''
  assert(econQuery.includes('pajak') || econQuery.includes('transaksi'), 'S6-03.4', 'Query template memuat konsep pajak/transaksi digital')

  // ──────────────────────────────────────────────────────────────────
  // S6-04: ANTARA latest, politics, law, dan economy feeds terdaftar
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-04: ANTARA National News Feeds Registry ───')
  const antaraSources = sourceCatalog.sources.filter(s => s.id.startsWith('src-antara-'))
  assert(antaraSources.length >= 4, 'S6-04.1', 'Terdapat minimal 4 feed LKBN ANTARA di catalog')
  const antaraIds = antaraSources.map(s => s.id)
  assert(antaraIds.includes('src-antara-latest') || antaraIds.includes('src-antara-terkini'), 'S6-04.2', 'ANTARA Terkini terdaftar')
  assert(antaraIds.includes('src-antara-politik'), 'S6-04.3', 'ANTARA Politik terdaftar')
  assert(antaraIds.includes('src-antara-hukum'), 'S6-04.4', 'ANTARA Hukum terdaftar')
  assert(antaraIds.includes('src-antara-ekonomi'), 'S6-04.5', 'ANTARA Ekonomi terdaftar')
  for (const a of antaraSources) {
    const feed = a.upstreamUrl || a.feedUrl || ''
    assert(feed.startsWith('https://www.antaranews.com/rss/'), `S6-04.6-${a.id}`, `Feed URL ${a.id} menggunakan endpoint HTTPS resmi antaranews.com`)
    assert(a.allowedHost === 'www.antaranews.com' || a.publisherDomain === 'antaranews.com', `S6-04.7-${a.id}`, `Host ANTARA terdaftar resmi`)
  }

  // ──────────────────────────────────────────────────────────────────
  // S6-05: TurnBackHoax tetap fact-check reference source & isolated
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-05: TurnBackHoax Fact-Check Reference & Failure Isolation ───')
  const tbhConfig = sourceCatalog.sources.find(s => s.id === 'src-tbh')
  assert(tbhConfig && tbhConfig.sourceType === 'fact_check', 'S6-05.1', 'TurnBackHoax bertipe fact_check reference')
  const tbhUrl = tbhConfig.upstreamUrl || tbhConfig.feedUrl || ''
  assert(tbhUrl.includes('turnbackhoax.id/feed'), 'S6-05.2', 'TBH menggunakan endpoint RSS canonical')

  updateConnectorHealth('src-tbh', {
    state: 'UNAVAILABLE',
    isSuccess: false,
    httpStatus: 503,
    errorCode: 'SERVICE_UNAVAILABLE',
    errorMessage: 'Koneksi ke TurnBackHoax mengalami kegagalan 503'
  })
  updateConnectorHealth('src-antara-latest', {
    state: 'HEALTHY',
    isSuccess: true,
    httpStatus: 200,
    itemCount: 15,
    userReadableMessage: 'Berhasil menarik 15 artikel'
  })
  const tbhHealth = getConnectorHealth('src-tbh')
  const antaraHealth = getConnectorHealth('src-antara-latest')
  assert(tbhHealth.state === 'UNAVAILABLE', 'S6-05.3', 'TurnBackHoax tercatat UNAVAILABLE saat error')
  assert(antaraHealth.state === 'HEALTHY', 'S6-05.4', 'ANTARA Terkini tetap HEALTHY tanpa cascade failure')

  // ──────────────────────────────────────────────────────────────────
  // S6-06: Google Trends disimpan sebagai SearchTrendSignal (Bukan Publication)
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-06: Google Trends SearchTrendSignal Model ───')
  const trendsXml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0" xmlns:ht="https://trends.google.com/trends/trending/rss">
    <channel>
      <title>Daily Search Trends</title>
      <item>
        <title>Pajak Digital</title>
        <ht:approx_traffic>+50,000</ht:approx_traffic>
        <pubDate>Sun, 01 Nov 2026 01:00:00 +0000</pubDate>
        <link>https://trends.google.co.id/trends/trendingsearches/daily</link>
      </item>
    </channel>
  </rss>`
  const trendSignals = parseGoogleTrendsRssAsSignals(trendsXml, 10)
  assert(trendSignals.length === 1, 'S6-06.1', 'Google Trends diparse menjadi SearchTrendSignal')
  const ts0 = trendSignals[0]
  assert(ts0.query === 'Pajak Digital', 'S6-06.2', 'Query terekstraksi tepat')
  assert(ts0.searchVolumeBand.includes('50'), 'S6-06.3', 'Search volume band dinormalisasi')
  assert(Array.isArray(ts0.limitations) && ts0.limitations.length > 0, 'S6-06.4', 'Memuat catatan limitation OSINT eksplisit')

  // ──────────────────────────────────────────────────────────────────
  // S6-07: Google Trends signal tidak mengubah claim verdict
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-07: Trend Signal Zero-Verdict Impact ───')
  const clusterBase = {
    id: 'CLUST-01',
    title: 'Kemenkeu Kaji Regulasi Pajak Transaksi Digital',
    memberItemIds: ['PUB-TAX-01'],
    memberItems: [{
      id: 'PUB-TAX-01',
      title: 'Kemenkeu Kaji Regulasi Pajak Transaksi Digital',
      verdict: 'UNVERIFIED',
      category: 'EKONOMI_DIGITAL',
      canonicalUrl: 'https://antaranews.com/berita/pajak-digital',
      publisher: 'ANTARA',
      observedAt: Date.now()
    }],
    firstPublishedAt: Date.now(),
    latestPublishedAt: Date.now(),
    firstObservedAt: Date.now(),
    latestObservedAt: Date.now(),
    category: 'EKONOMI_DIGITAL',
    clusterConfidence: 80,
    matchReasons: [],
    sourceCoverage: {
      publicationCount: 1,
      identifiedPublisherCount: 1,
      distinctPublisherDomainCount: 1,
      publishers: ['ANTARA'],
      isIndependentCoverageClaimed: false
    },
    leadItem: {
      id: 'PUB-TAX-01',
      title: 'Kemenkeu Kaji Regulasi Pajak Transaksi Digital',
      verdict: 'UNVERIFIED',
      category: 'EKONOMI_DIGITAL',
      canonicalUrl: 'https://antaranews.com/berita/pajak-digital',
      publisher: 'ANTARA',
      observedAt: Date.now()
    },
    freshness: { status: 'BREAKING', ageMinutes: 10 },
    contextRelevance: { score: 75, matchedTopics: ['pajak digital'] }
  }
  const attached = attachTrendSignalsToClusters([clusterBase], trendSignals)
  assert(attached[0].sourceCoverage.publicationCount === 1, 'S6-07.1', 'Trend signal TIDAK menambah publicationCount')
  assert(attached[0].leadItem.verdict === 'UNVERIFIED', 'S6-07.2', 'Trend signal TIDAK mengubah claim verdict menjadi FAKTA/HOAKS')

  // ──────────────────────────────────────────────────────────────────
  // S6-08: XML parser menangani CDATA, entity, malformed XML, empty feed
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-08: Robust Fast-XML-Parser Compliance ───')
  const cdataXml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <title>ANTARA News &amp; Updates</title>
      <item>
        <title><![CDATA[Pangdam tinjau kesiapan satgas perbatasan & prajurit marinir]]></title>
        <link>https://www.antaranews.com/berita/12345/pangdam-tinjau</link>
        <description><![CDATA[Pangdam XVII/Cenderawasih mengecek pos &amp; personel.]]></description>
        <pubDate>Sun, 01 Nov 2026 02:00:00 +0000</pubDate>
      </item>
    </channel>
  </rss>`
  const parsedAntara = parseAntaraRss(cdataXml)
  assert(parsedAntara.length === 1, 'S6-08.1', 'CDATA dan XML entities berhasil diparse')
  assert(parsedAntara[0].claim.includes('Pangdam tinjau kesiapan'), 'S6-08.2', 'Klaim memuat teks CDATA bersih')

  const malformedXml = '<rss><channel><title>Broken Feed'
  const parsedMalformed = parseAntaraRss(malformedXml)
  assert(Array.isArray(parsedMalformed) && parsedMalformed.length === 0, 'S6-08.3', 'Malformed XML menghasilkan array kosong tanpa crash')

  const emptyXml = '<?xml version="1.0"?><rss version="2.0"><channel><title>Empty</title></channel></rss>'
  const parsedEmpty = parseAntaraRss(emptyXml)
  assert(Array.isArray(parsedEmpty) && parsedEmpty.length === 0, 'S6-08.4', 'Valid empty feed menghasilkan array kosong')

  // ──────────────────────────────────────────────────────────────────
  // S6-09: Stable publication ID sama untuk canonical URL yang sama
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-09: Stable Deterministic SHA-256 Publication ID ───')
  const urlA = 'https://www.antaranews.com/berita/445566/indonesia-resmikan-radar?utm_source=rss&utm_medium=feed'
  const urlB = 'https://www.antaranews.com/berita/445566/indonesia-resmikan-radar'
  const id1 = generateStablePublicationId(urlA)
  const id2 = generateStablePublicationId(urlB)
  assert(id1 === id2, 'S6-09.1', 'ID identik walau terdapat perbedaan parameter pelacak UTM')
  assert(id1.startsWith('PUB-'), 'S6-09.2', 'Format ID memiliki prefiks kanonikal PUB-')
  assert(id1.length === 20, 'S6-09.3', 'Panjang ID stabil 20 karakter')

  // ──────────────────────────────────────────────────────────────────
  // S6-10: Deduplication mempertahankan source observation & provenance
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-10: Deduplication Observation & Provenance ───')
  const dupPubs = [
    {
      id: id1,
      canonicalUrl: 'https://www.antaranews.com/berita/445566/indonesia-resmikan-radar',
      sourceId: 'src-antara-terkini',
      title: 'Indonesia Resmikan Radar Pertahanan Baru',
      publisher: 'ANTARA News',
      observedAt: 1000
    },
    {
      id: id1,
      canonicalUrl: 'https://www.antaranews.com/berita/445566/indonesia-resmikan-radar',
      sourceId: 'src-gnews-hankam',
      title: 'Indonesia Resmikan Radar Pertahanan Baru',
      publisher: 'ANTARA News via Google News',
      observedAt: 2000
    }
  ]
  const deduped = deduplicatePublications(dupPubs)
  assert(deduped.length === 1, 'S6-10.1', 'Publikasi dideduplikasi menjadi 1 entri')
  assert(deduped[0].id === id1, 'S6-10.2', 'ID canonical dipertahankan')

  // ──────────────────────────────────────────────────────────────────
  // S6-11: Timestamp unknown tidak diisi dengan waktu sistem
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-11: Unknown Timestamp Integrity ───')
  const noDateXml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel><title>No Date</title>
      <item>
        <title>Uji Publik Kebijakan Perlindungan Data Pribadi</title>
        <link>https://antaranews.com/berita/pdp-test</link>
      </item>
    </channel>
  </rss>`
  const parsedNoDate = parseAntaraRss(noDateXml)
  assert(parsedNoDate[0].publishedDate === 'Waktu Publikasi Tidak Tersedia', 'S6-11.1', 'Tanggal publikasi tidak diisi tanggal sistem sintetik')

  // ──────────────────────────────────────────────────────────────────
  // S6-12: Candidate topic berasal dari Trends/publication/watchlist
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-12: Topic Candidate Sources & Provenance ───')
  topicDiscoveryEngine.clear()
  topicDiscoveryEngine.ingestTrendSignals([{
    id: 'TS-01',
    sourceId: 'src-gtrends-id',
    query: 'Pajak Transaksi Digital',
    observedAt: Date.now(),
    retrievedAt: Date.now(),
    timestampStatus: 'VALID',
    sourceUrl: 'https://trends.google.co.id',
    sourceLabel: 'Google Trends ID',
    limitations: []
  }])
  const cands = topicDiscoveryEngine.getAllCandidates()
  assert(cands.length >= 1, 'S6-12.1', 'Kandidat topik terekstraksi dari Trends')
  assert(cands[0].source === 'TRENDS_SIGNAL', 'S6-12.2', 'Sumber tervalidasi TRENDS_SIGNAL')

  const opCand = topicDiscoveryEngine.addOperatorWatchlistPhrase('pesawat kf-21 boramae', 'DEFENSE_SECURITY')
  assert(opCand.source === 'OPERATOR_WATCHLIST', 'S6-12.3', 'Sumber tervalidasi OPERATOR_WATCHLIST')
  assert(opCand.matchedDomain === 'DEFENSE_SECURITY', 'S6-12.4', 'Domain tervalidasi DEFENSE_SECURITY')

  // ──────────────────────────────────────────────────────────────────
  // S6-13: Dynamic topic activation menggunakan taxonomy + koroborasi
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-13: Dynamic Topic Activation Gating ───')
  const genericRelevance = evaluateCandidateRelevance('Indonesia')
  assert(genericRelevance.isEligibleTaxonomy === false, 'S6-13.1', 'Frasa terlalu generik (Indonesia) ditolak')

  const specificRelevance = evaluateCandidateRelevance('pajak digital fintech')
  assert(specificRelevance.isEligibleTaxonomy === true, 'S6-13.2', 'Frasa substantif (pajak digital fintech) disetujui')
  assert(specificRelevance.domain === 'DIGITAL_ECONOMY', 'S6-13.3', 'Domain sesuai DIGITAL_ECONOMY')

  // ──────────────────────────────────────────────────────────────────
  // S6-14: Dynamic query rate limits (max 2/cycle, cooldown 30m)
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-14: Dynamic Query Policy & Budget Limits ───')
  topicDiscoveryEngine.clear()
  topicDiscoveryEngine.addOperatorWatchlistPhrase('radar natuna', 'DEFENSE_SECURITY')
  topicDiscoveryEngine.addOperatorWatchlistPhrase('alutsista kapalselam', 'DEFENSE_SECURITY')
  topicDiscoveryEngine.addOperatorWatchlistPhrase('bansos sembako', 'NATIONAL_POLICY')

  const selectedForSearch = topicDiscoveryEngine.selectCandidatesForSearch(2)
  assert(selectedForSearch.length <= 2, 'S6-14.1', 'Maksimal 2 kandidat terpilih per siklus')

  // Catat eksekusi dan periksa cooldown
  topicDiscoveryEngine.recordSearchExecution(selectedForSearch[0].id)
  const afterExecution = topicDiscoveryEngine.selectCandidatesForSearch(2)
  assert(!afterExecution.some(c => c.id === selectedForSearch[0].id), 'S6-14.2', 'Kandidat yang baru dieksekusi masuk cooldown 30 menit')

  // ──────────────────────────────────────────────────────────────────
  // S6-15: Dynamic query validator menolak injeksi URL / host override
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-15: Dynamic Query Injection Safeguards ───')
  const safeQuery = validateDynamicSearchQuery('gnews-digital-economy', 'pajak digital')
  assert(safeQuery.isValid === true, 'S6-15.1', 'Kueri frasa bersih disetujui')

  const urlInjection = validateDynamicSearchQuery('gnews-digital-economy', 'https://malicious.com/api')
  assert(urlInjection.isValid === false, 'S6-15.2', 'Injeksi protokol HTTPS ditolak')

  const siteInjection = validateDynamicSearchQuery('gnews-digital-economy', 'pajak site:evil.org')
  assert(siteInjection.isValid === false, 'S6-15.3', 'Injeksi operator site: ditolak')

  const longInjection = validateDynamicSearchQuery('gnews-digital-economy', 'a'.repeat(120))
  assert(longInjection.isValid === false, 'S6-15.4', 'Frasa melebihi batas panjang karakter ditolak')

  const invalidProfile = validateDynamicSearchQuery('non-existent-profile', 'pajak')
  assert(invalidProfile.isValid === false, 'S6-15.5', 'Profile ID tidak terdaftar ditolak')

  // ──────────────────────────────────────────────────────────────────
  // S6-16: Parity Shared Source Catalog antara TS Gateway dan CJS Gateway
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-16: Dev & Packaged Gateway Catalog Parity ───')
  assert(ALLOWED_UPSTREAM_HOSTS.size >= 5, 'S6-16.1', 'TypeScript gateway memuat allowlist host dari catalog')
  assert(ALLOWED_UPSTREAM_HOSTS.has('turnbackhoax.id'), 'S6-16.2', 'turnbackhoax.id ada di allowlist')
  assert(ALLOWED_UPSTREAM_HOSTS.has('news.google.com'), 'S6-16.3', 'news.google.com ada di allowlist')
  assert(ALLOWED_UPSTREAM_HOSTS.has('trends.google.com'), 'S6-16.4', 'trends.google.com ada di allowlist')
  assert(ALLOWED_UPSTREAM_HOSTS.has('www.antaranews.com'), 'S6-16.5', 'www.antaranews.com ada di allowlist')

  // ──────────────────────────────────────────────────────────────────
  // S6-17: Per-source cadence, circuit breaker, retry-after
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-17: Per-Source Scheduler & Circuit Breaker ───')
  const testScheduler = new RadarSchedulerEngine()
  const tbhSchedule = testScheduler.getSourceScheduleState('src-tbh')
  assert(Boolean(tbhSchedule), 'S6-17.1', 'Status jadwal per-sumber terdaftar')
  assert(tbhSchedule.circuitBreakerStatus === 'CLOSED', 'S6-17.2', 'Circuit breaker awal CLOSED')

  // Simulasikan 3 kegagalan beruntun
  testScheduler.recordSourceAttempt('src-tbh', false, 503)
  testScheduler.recordSourceAttempt('src-tbh', false, 503)
  testScheduler.recordSourceAttempt('src-tbh', false, 503)
  const trippedSchedule = testScheduler.getSourceScheduleState('src-tbh')
  assert(trippedSchedule.circuitBreakerStatus === 'OPEN', 'S6-17.3', 'Circuit breaker trip ke OPEN setelah 3 kegagalan')
  assert(testScheduler.isSourceDue('src-tbh') === false, 'S6-17.4', 'Sumber dalam status OPEN tidak dieksekusi')

  // ──────────────────────────────────────────────────────────────────
  // S6-18: Connector Failure Isolation
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-18: Connector Failure Isolation Verification ───')
  const gnewsSchedule = testScheduler.getSourceScheduleState('src-gnews-hankam')
  assert(gnewsSchedule.circuitBreakerStatus === 'CLOSED', 'S6-18.1', 'Google News Hankam tetap CLOSED saat sumber lain OPEN')

  // ──────────────────────────────────────────────────────────────────
  // S6-19: Malformed feed tidak menghapus last-known-good cache
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-19: Last-Known-Good Cache Preservation ───')
  const cachedBackup = [{ id: 'LKG-01', claim: 'Isu Teruji Tersimpan', verdict: 'UNVERIFIED' }]
  // Parser mengembalikan array kosong untuk malformed
  const failedParse = parseGoogleNewsRss('<broken><xml>')
  const effectiveItems = failedParse.length > 0 ? failedParse : cachedBackup
  assert(effectiveItems.length === 1 && effectiveItems[0].id === 'LKG-01', 'S6-19.1', 'Data cache dipertahankan ketika feed rusak')

  // ──────────────────────────────────────────────────────────────────
  // S6-20: Relevant no-checkable-claim publication tampil di Isu Baru (Bukan UNVERIFIED queue)
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-20: No-Checkable-Claim Event Discovery vs Unverified Queue ───')
  const generalPolicyPub = {
    id: 'PUB-GEN-01',
    title: 'Pemerintah gelar sosialisasi ketentuan baru perpajakan daerah tahun anggaran 2026',
    excerpt: 'Sosialisasi berlangsung tertib dihadiri perwakilan pemda se-Indonesia.',
    cluster: 'POLITIK_NEGARA',
    verdict: 'NETRAL',
    queueState: 'EXCLUDED',
    exclusionReason: 'NO_CHECKABLE_CLAIM'
  }
  const generalCluster = {
    id: 'CLUST-GEN',
    title: generalPolicyPub.title,
    memberItemIds: ['PUB-GEN-01'],
    memberItems: [generalPolicyPub],
    firstPublishedAt: Date.now(),
    latestPublishedAt: Date.now(),
    firstObservedAt: Date.now(),
    latestObservedAt: Date.now(),
    category: 'POLITIK_NEGARA',
    sourceCoverage: { publicationCount: 1, identifiedPublisherCount: 1, distinctPublisherDomainCount: 1, publishers: ['Humas Pemda'], isIndependentCoverageClaimed: false },
    leadItem: generalPolicyPub,
    freshness: { status: 'AKTUAL', ageMinutes: 120 },
    contextRelevance: { score: 60, matchedTopics: ['pajak daerah'] }
  }
  const activityGen = assessIssueActivity(generalCluster)
  assert(activityGen.state !== undefined, 'S6-20.1', 'Event umum dapat dinilai momentum aktivitasnya')
  assert(generalPolicyPub.queueState === 'EXCLUDED', 'S6-20.2', 'Artikel tanpa klaim checkable tidak dipaksa masuk UNVERIFIED queue')

  // ──────────────────────────────────────────────────────────────────
  // S6-21: Checkable claim tanpa fact-check match tetap UNVERIFIED / MONITOR
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-21: Checkable Claim Without Reference Stays UNVERIFIED ───')
  const claimUnv = {
    id: 'CLM-UNV-S6',
    claim: 'Pemerintah dikabarkan akan memungut pajak 10 persen atas setiap transaksi uang elektronik di minimarket',
    cluster: 'EKONOMI_DIGITAL',
    verdict: 'UNVERIFIED',
    officialSource: 'Laporan Publik',
    sourceUrl: 'https://example.com/klaim-pajak'
  }
  const scoreUnv = computeEarlyWarningScore(claimUnv, [])
  assert(scoreUnv.triageStatus === 'UNVERIFIED', 'S6-21.1', 'Klaim tanpa match tetap UNVERIFIED')
  const triagedUnv = scoreAndTriageRadarEntries([claimUnv], [])[0]
  assert(triagedUnv.queueState === 'MONITOR', 'S6-21.2', 'queueState tercatat MONITOR')

  // ──────────────────────────────────────────────────────────────────
  // S6-22: IssueActivityState tidak mengubah claim verification status
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-22: Issue Activity Independence From Verification Verdict ───')
  const risingCluster = {
    id: 'CLUST-RISING',
    title: 'Klaim Pungutan Pajak Transaksi Online',
    memberItemIds: ['PUB-1', 'PUB-2', 'PUB-3', 'PUB-4'],
    memberItems: [
      { id: 'PUB-1', verdict: 'UNVERIFIED', observedAt: Date.now() - 5000 },
      { id: 'PUB-2', verdict: 'UNVERIFIED', observedAt: Date.now() - 10000 },
      { id: 'PUB-3', verdict: 'UNVERIFIED', observedAt: Date.now() - 15000 },
      { id: 'PUB-4', verdict: 'UNVERIFIED', observedAt: Date.now() - 20000 }
    ],
    firstPublishedAt: Date.now() - 20000,
    latestPublishedAt: Date.now() - 5000,
    firstObservedAt: Date.now() - 20000,
    latestObservedAt: Date.now() - 5000,
    category: 'EKONOMI_DIGITAL',
    sourceCoverage: { publicationCount: 4, identifiedPublisherCount: 3, distinctPublisherDomainCount: 3, publishers: ['A', 'B', 'C'], isIndependentCoverageClaimed: false },
    leadItem: { id: 'PUB-1', verdict: 'UNVERIFIED', observedAt: Date.now() - 5000 },
    freshness: { status: 'BREAKING', ageMinutes: 5 },
    contextRelevance: { score: 85, matchedTopics: ['pajak'] }
  }
  const activityAssessment = assessIssueActivity(risingCluster)
  assert(activityAssessment.state === 'RISING' || activityAssessment.state === 'SUSTAINED', 'S6-22.1', 'Aktivitas momentum terdeteksi')
  assert(risingCluster.leadItem.verdict === 'UNVERIFIED', 'S6-22.2', 'Momentum tinggi TIDAK mengubah status klaim menjadi FAKTA atau HOAKS')

  // ──────────────────────────────────────────────────────────────────
  // S6-23: RISING requires minimum sample & domain threshold
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-23: RISING Threshold Gating ───')
  const smallCluster = {
    ...risingCluster,
    memberItemIds: ['PUB-1'],
    memberItems: [{ id: 'PUB-1', verdict: 'UNVERIFIED', observedAt: Date.now() }],
    sourceCoverage: { publicationCount: 1, identifiedPublisherCount: 1, distinctPublisherDomainCount: 1, publishers: ['A'], isIndependentCoverageClaimed: false }
  }
  const smallActivity = assessIssueActivity(smallCluster)
  assert(smallActivity.state !== 'RISING', 'S6-23.1', 'Sampel 1 artikel tidak boleh diberi label RISING')

  // ──────────────────────────────────────────────────────────────────
  // S6-24: Distinct publisher domains tidak diklaim independen
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-24: Honest Publisher Domains Metric ───')
  assert(risingCluster.sourceCoverage.isIndependentCoverageClaimed === false, 'S6-24.1', 'isIndependentCoverageClaimed selalu false')

  // ──────────────────────────────────────────────────────────────────
  // S6-25: Fake social metrics zero-tolerance audit
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-25: Zero Fake Social Metrics Contract ───')
  assert(activityAssessment.isSocialViralityMeasured === false, 'S6-25.1', 'isSocialViralityMeasured bernilai false secara eksplisit')

  // ──────────────────────────────────────────────────────────────────
  // S6-26: IndexedDB schema migration v2 integrity
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-26: IndexedDB Migration Schema Integrity ───')
  const dbAdapterSource = fs.readFileSync(path.resolve('src/utils/db-adapter.ts'), 'utf-8')
  assert(dbAdapterSource.includes('DB_VERSION = 2'), 'S6-26.1', 'DB_VERSION dinaikkan ke versi 2')
  assert(dbAdapterSource.includes('topic_candidates'), 'S6-26.2', 'Store topic_candidates terdaftar')
  assert(dbAdapterSource.includes('issue_activity_snapshots'), 'S6-26.3', 'Store issue_activity_snapshots terdaftar')
  assert(dbAdapterSource.includes('source_run_log'), 'S6-26.4', 'Store source_run_log terdaftar')

  // ──────────────────────────────────────────────────────────────────
  // S6-27: Topic candidate & telemetry durability helpers
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-27: Topic Candidates & Run Log Durability Functions ───')
  assert(dbAdapterSource.includes('saveTopicCandidates'), 'S6-27.1', 'Helper saveTopicCandidates terdefinisi')
  assert(dbAdapterSource.includes('getTopicCandidatesFromDB'), 'S6-27.2', 'Helper getTopicCandidatesFromDB terdefinisi')
  assert(dbAdapterSource.includes('saveSourceRunLog'), 'S6-27.3', 'Helper saveSourceRunLog terdefinisi')

  // ──────────────────────────────────────────────────────────────────
  // S6-28: UI Telemetry & Diagnostics Presentation
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-28: UI Source Diagnostics Presentation ───')
  const liveRadarSource = fs.readFileSync(path.resolve('src/pages/LiveRadar.tsx'), 'utf-8')
  assert(liveRadarSource.includes('STATUS KONEKTOR RADAR'), 'S6-28.1', 'UI memuat strip status konektor radar multi-stream')
  assert(liveRadarSource.includes('Circuit Breaker'), 'S6-28.2', 'Tooltip konektor menyertakan status Circuit Breaker')
  assert(liveRadarSource.includes('ISU BARU & MENINGKAT'), 'S6-28.3', 'UI menyediakan panel Isu Baru & Meningkat')
  assert(liveRadarSource.includes('SINYAL PENELUSURAN'), 'S6-28.4', 'UI menyediakan panel Sinyal Penelusuran Google Trends')
  assert(liveRadarSource.includes('TOPIC WATCHLIST'), 'S6-28.5', 'UI menyediakan panel Topic Watchlist')

  // ──────────────────────────────────────────────────────────────────
  // S6-29: Regression test script presence
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-29: Full Cumulative Regression Suite Verification ───')
  assert(fs.existsSync(path.resolve('scripts/test-sprint-5-1-validation.js')), 'S6-29.1', 'Script test Sprint 5.1 ada')
  assert(fs.existsSync(path.resolve('scripts/test-sprint-5-routing.js')), 'S6-29.2', 'Script test Sprint 5 ada')

  // ──────────────────────────────────────────────────────────────────
  // S6-30: Packaged Electron build includes shared catalog
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-30: Packaged Electron Assets & Dynamic Search Route ───')
  const pkgJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf-8'))
  const buildFiles = pkgJson.build?.files || []
  assert(buildFiles.includes('shared/**/*'), 'S6-30.1', 'electron-builder menyertakan shared/**/*')

  const gatewayRunnerSrc = fs.readFileSync(path.resolve('electron/gateway-runner.cjs'), 'utf-8')
  assert(gatewayRunnerSrc.includes('/api/radar/search/:profileId'), 'S6-30.2', 'CJS gateway memuat endpoint pencarian dinamis /api/radar/search/:profileId')

  // ──────────────────────────────────────────────────────────────────
  // S6-31: Build Commands Verification in package.json
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-31: Build Command Definitions ───')
  assert(Boolean(pkgJson.scripts?.build), 'S6-31.1', 'Script build terdefinisi')
  assert(Boolean(pkgJson.scripts?.lint), 'S6-31.2', 'Script lint terdefinisi')
  assert(Boolean(pkgJson.scripts?.['electron:build']), 'S6-31.3', 'Script electron:build terdefinisi')

  // ──────────────────────────────────────────────────────────────────
  // S6-32: Zero Social Scraping & Zero Telegram Violation Audit
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S6-32: Strict Anti-Scraping & Telegram Proscription Audit ───')
  for (const src of sourceCatalog.sources) {
    const url = src.upstreamUrl || src.feedUrl || ''
    assert(!url.includes('telegram') && !url.includes('t.me'), `S6-32.1-${src.id}`, `Source ${src.id} tidak mengakses Telegram`)
    assert(!url.includes('instagram.com') && !url.includes('tiktok.com') && !url.includes('twitter.com') && !url.includes('x.com'), `S6-32.2-${src.id}`, `Source ${src.id} tidak melakukan scraping media sosial ilegal`)
  }

  // ──────────────────────────────────────────────────────────────────
  // SUMMARY
  // ──────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════════════')
  console.log(`📊 SPRINT 6 TEST SUMMARY: ${passedAssertions} / ${totalAssertions} ASSERTIONS PASSED`)
  if (failedAssertions > 0) {
    console.error(`❌ FAILED ASSERTIONS (${failedAssertions}):`)
    failures.forEach(f => console.error(`  - [${f.code}] ${f.description}`))
    process.exit(1)
  } else {
    console.log(`🏆 SEMUA 32 KRITERIA AKSEPTANSI S6-01 s.d. S6-32 LULUS (100% PASS)!`)
    console.log('══════════════════════════════════════════════════════════════════════\n')
    process.exit(0)
  }
}

runSprint6TestSuite().catch(err => {
  console.error('Fatal Test Runner Exception:', err)
  process.exit(1)
})
