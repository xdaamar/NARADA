/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — SPRINT 1B FOUNDATION HARDENING & ACCEPTANCE TEST SUITE
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Menguji seluruh Acceptance Gates Sprint 1B:
 * 1. Data Semantics: SearchTrendSignal terpisah dari NormalizedPublication
 * 2. Connector Health: Failure isolation, HTTP 429, timeouts, recovery, cache
 * 3. Event Clustering: Labelled corpus (20 positive + 20 hard-negative pairs),
 *    URL canonicalization, content parameter preservation, acronym boundary
 * 4. Freshness & Assessment: Strict boundaries, Mafindo contextual match,
 *    peaceful protest is not threat, heuristic score semantics
 * 5. Policy Guardrails: YouTube policy boundary, Zero Telegram, Zero scraper
 * ══════════════════════════════════════════════════════════════════════════
 */

import { 
  evaluateFreshness, 
  parseSourceDate, 
  FRESHNESS_THRESHOLDS 
} from '../src/engine/radar/freshness-engine.ts'

import { 
  normalizeUrl, 
  extractPublisherDomain,
  extractSubstantiveTokens,
  extractEntitiesFromText,
  extractLocationsFromText,
  calculateJaccardSimilarity, 
  deduplicatePublications, 
  clusterEventPublications,
  attachTrendSignalsToClusters
} from '../src/engine/radar/clustering-engine.ts'

import { 
  evaluateContextRelevance, 
  evaluateMetadataTransparency, 
  determineReviewState 
} from '../src/engine/radar/radar-assessment.ts'

import { 
  getActiveRadarSources, 
  getRadarSourceById,
  updateConnectorHealth, 
  getAllConnectorHealth, 
  resetConnectorHealthState,
  sanitizeErrorMessage,
  ACTIVE_RADAR_SOURCES
} from '../src/engine/radar/source-registry.ts'

import { 
  computeEarlyWarningScore, 
  scoreAndTriageRadarEntries 
} from '../src/engine/radar/early-warning-scorer.ts'

import { 
  parseTurnBackHoaxRss, 
  parseGoogleNewsRss,
  parseGoogleTrendsRssAsSignals,
  parseGoogleTrendsRss
} from '../src/engine/ingest/rss-parser.ts'

// ─── Test Harness Runner ───
let totalTests = 0
let passedTests = 0
let failedTests = 0
const categoryCounts = {
  A: { name: 'Source Taxonomy & Data Semantics', total: 0, passed: 0, failed: 0 },
  B: { name: 'Connector Health & Failure Isolation', total: 0, passed: 0, failed: 0 },
  C: { name: 'Event Clustering & URL Canonicalization', total: 0, passed: 0, failed: 0 },
  D: { name: 'Freshness Engine & Transparent Assessment', total: 0, passed: 0, failed: 0 },
  E: { name: 'Policy Guardrails & Security Integrity', total: 0, passed: 0, failed: 0 },
  CORPUS: { name: 'Labelled Clustering Corpus (40 Pairs)', total: 0, passed: 0, failed: 0 }
}

function assert(condition, testId, description, categoryKey = 'A') {
  totalTests++
  categoryCounts[categoryKey].total++

  if (condition) {
    passedTests++
    categoryCounts[categoryKey].passed++
    console.log(`  ✅ PASS: [${testId}] ${description}`)
  } else {
    failedTests++
    categoryCounts[categoryKey].failed++
    console.error(`  ❌ FAIL: [${testId}] ${description}`)
  }
}

console.log('══════════════════════════════════════════════════════════════════════')
console.log('🛡️  NARADA — SPRINT 1B FOUNDATION HARDENING TEST SUITE')
console.log('══════════════════════════════════════════════════════════════════════\n')

// ──────────────────────────────────────────────────────────────────────
// BAGIAN A: SOURCE TAXONOMY & DATA SEMANTICS (Item 1 - 6)
// ──────────────────────────────────────────────────────────────────────
console.log('─── BAGIAN A: Source Taxonomy & Data Semantics ───')

const sampleTrendsXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:ht="https://trends.google.com/trending/rss">
  <channel>
    <title>Daily Search Trends</title>
    <item>
      <title>Gempa Hari Ini</title>
      <ht:approx_traffic>100,000+</ht:approx_traffic>
      <pubDate>Fri, 30 Oct 2026 06:00:00 +0000</pubDate>
      <ht:news_item>
        <ht:news_item_title>BMKG Laporkan Gempa Magnitudo 5.2 Guncang Pesisir</ht:news_item_title>
        <ht:news_item_url>https://news.detik.com/berita/d-12345?utm_source=gtrends</ht:news_item_url>
        <ht:news_item_source>Detikcom</ht:news_item_source>
      </ht:news_item>
    </item>
  </channel>
</rss>`

const parsedSignals = parseGoogleTrendsRssAsSignals(sampleTrendsXml)
const firstSignal = parsedSignals[0]

assert(parsedSignals.length === 1, 'A1', 'Google Trends RSS diparse menghasilkan SearchTrendSignal[]', 'A')
assert(firstSignal.query === 'Gempa Hari Ini', 'A1.1', 'Query penelusuran terekstrak akurat', 'A')
assert(firstSignal.searchVolumeBand === '100,000+', 'A1.2', 'Volume band penelusuran terekstrak tanpa diubah jadi angka acak', 'A')
assert(firstSignal.timestampStatus === 'VALID', 'A1.3', 'Tanggal pubDate valid diparsing dengan status VALID', 'A')
assert(Array.isArray(firstSignal.limitations) && firstSignal.limitations.length >= 3, 'A1.4', 'SearchTrendSignal memuat limitasi eksplisit (Bukan percakapan medsos)', 'A')

// Missing date in trends
const noDateTrendsXml = sampleTrendsXml.replace(/<pubDate>[\s\S]*?<\/pubDate>/, '')
const noDateSignals = parseGoogleTrendsRssAsSignals(noDateTrendsXml)
assert(noDateSignals[0].timestampStatus === 'UNKNOWN_DATE' && noDateSignals[0].startedAt === undefined, 'A1.5', 'Trends tanpa tanggal tetap UNKNOWN_DATE (tidak fallback ke Date.now())', 'A')

// Mock publications for clustering test with trends
const mockPubA = {
  id: 'PUB-1',
  sourceId: 'src-gnews-hankam',
  sourceType: 'rss',
  sourceName: 'Google News Hankam',
  title: 'TNI AL Intensifkan Patroli Kedaulatan di Perairan Ambalat',
  originalUrl: 'https://kompas.com/read/2026/10/30/tni-ambalat?utm_source=news',
  canonicalUrl: 'https://kompas.com/read/2026/10/30/tni-ambalat',
  excerpt: 'Kapal perang TNI AL KRI Frans Kaisiepo berpatroli di Blok Ambalat.',
  publisher: 'Kompas',
  publishedAt: Date.now() - 3600000,
  publishedAtFormatted: '30 Okt 2026, 12:00 WIB',
  observedAt: Date.now(),
  retrievedAt: Date.now(),
  lastVerifiedAt: null,
  extractionMethod: 'rss',
  category: 'KEDAULATAN_MILITER',
  topicTags: ['tni', 'ambalat'],
  language: 'id',
  contentFingerprint: 'fp1',
  attribution: 'Kompas',
  freshness: evaluateFreshness(Date.now() - 3600000),
  contextRelevance: evaluateContextRelevance('TNI AL Intensifkan Patroli Kedaulatan', '', 'KEDAULATAN_MILITER', 'rss'),
  metadataTransparency: evaluateMetadataTransparency('https://kompas.com', 'https://kompas.com', 'Kompas', Date.now() - 3600000),
  reviewState: 'CONTEXT_ONLY',
  verdict: 'NETRAL'
}

const mockPubB = {
  ...mockPubA,
  id: 'PUB-2',
  title: 'KRI TNI AL Siaga Penuh Amankan Blok Ambalat dari Pelanggaran',
  canonicalUrl: 'https://detik.com/berita/kri-ambalat-siaga',
  publisher: 'Detikcom',
  topicTags: ['tni', 'ambalat']
}

const clusters = clusterEventPublications([mockPubA, mockPubB])
assert(clusters[0].sourceCoverage.publicationCount === 2, 'A2', 'Event cluster menghitung publicationCount murni publikasi artikel (2)', 'A')
assert(clusters[0].sourceCoverage.distinctPublisherDomainCount === 2, 'A3', 'distinctPublisherDomainCount menghitung domain unik penerbit (Kompas, Detikcom)', 'A')

// Attach Trend Signal
const trendAmbalat = {
  id: 'SIG-1',
  sourceId: 'src-gtrends-id',
  query: 'Patroli TNI Ambalat',
  searchVolumeBand: '50,000+',
  observedAt: Date.now(),
  retrievedAt: Date.now(),
  sourceUrl: 'https://trends.google.com',
  sourceLabel: 'Google Trends',
  timestampStatus: 'VALID',
  limitations: ['Search interest only']
}

const clustersWithTrend = attachTrendSignalsToClusters(clusters, [trendAmbalat])
assert(clustersWithTrend[0].attachedTrendSignals?.length === 1, 'A4', 'SearchTrendSignal berhasil dilampirkan sebagai sinyal kontekstual', 'A')
assert(clustersWithTrend[0].sourceCoverage.publicationCount === 2, 'A4.1', 'Pelampiran tren TIDAK menambah publicationCount (tetap 2)', 'A')
assert(clustersWithTrend[0].sourceCoverage.distinctPublisherDomainCount === 2, 'A4.2', 'Pelampiran tren TIDAK menambah distinctPublisherDomainCount (tetap 2)', 'A')
assert(clustersWithTrend[0].sourceCoverage.isIndependentCoverageClaimed === false, 'A4.3', 'isIndependentCoverageClaimed tetap false secara jujur', 'A')

// ──────────────────────────────────────────────────────────────────────
// BAGIAN B: CONNECTOR HEALTH & FAILURE ISOLATION (Item 7 - 18)
// ──────────────────────────────────────────────────────────────────────
console.log('\n─── BAGIAN B: Connector Health & Failure Isolation ───')
resetConnectorHealthState()

// 1. Initial State
const initialTBH = updateConnectorHealth('src-tbh', {
  state: 'HEALTHY',
  httpStatus: 200,
  latencyMs: 140,
  itemCount: 15,
  isSuccess: true,
  userReadableMessage: 'Berhasil menarik 15 entri'
})
assert(initialTBH.state === 'HEALTHY' && initialTBH.consecutiveFailures === 0, 'B1', 'Fetch berhasil mengatur state HEALTHY dan consecutiveFailures = 0', 'B')
assert(initialTBH.lastSuccessAt !== null, 'B1.1', 'lastSuccessAt tercatat saat fetch berhasil', 'B')

// 2. HTTP 429 Rate Limit
const rateLimitedTBH = updateConnectorHealth('src-tbh', {
  state: 'RATE_LIMITED',
  httpStatus: 429,
  rateLimitStatus: { isRateLimited: true, retryAfterSeconds: 60, resetAt: Date.now() + 60000 },
  errorCode: 'HTTP_429_RATE_LIMITED',
  errorMessage: 'HTTP 429: Batasan laju permintaan terlampaui',
  isSuccess: false
})
assert(rateLimitedTBH.state === 'RATE_LIMITED', 'B2', 'HTTP 429 dipetakan ke state RATE_LIMITED', 'B')
assert(rateLimitedTBH.consecutiveFailures === 1, 'B2.1', 'Kegagalan menaikkan consecutiveFailures menjadi 1', 'B')
assert(rateLimitedTBH.lastSuccessAt === initialTBH.lastSuccessAt, 'B2.2', 'lastSuccessAt lama dipertahankan saat terjadi kegagalan', 'B')

// 3. HTTP 5xx Server Error
const serverErrorHankam = updateConnectorHealth('src-gnews-hankam', {
  state: 'UNAVAILABLE',
  httpStatus: 503,
  errorCode: 'HTTP_SERVER_ERROR',
  errorMessage: 'HTTP 503: Service Unavailable',
  isSuccess: false
})
assert(serverErrorHankam.state === 'UNAVAILABLE' && serverErrorHankam.httpStatus === 503, 'B3', 'HTTP 503 dipetakan ke UNAVAILABLE dengan kode status tercatat', 'B')

// 4. Fetch Timeout
const timeoutDemo = updateConnectorHealth('src-gnews-demo', {
  state: 'UNAVAILABLE',
  httpStatus: null,
  errorCode: 'FETCH_TIMEOUT',
  errorMessage: 'Batas waktu penarikan (4500ms) terlampaui',
  isSuccess: false
})
assert(timeoutDemo.errorCode === 'FETCH_TIMEOUT' && timeoutDemo.httpStatus === null, 'B4', 'Timeout dipetakan ke UNAVAILABLE dengan httpStatus null', 'B')

// 5. Malformed XML Feed
const malformedPolitik = updateConnectorHealth('src-gnews-politik', {
  state: 'DEGRADED',
  httpStatus: 200,
  errorCode: 'MALFORMED_FEED_NO_ITEMS',
  errorMessage: 'Respon 200 OK tetapi XML tidak memuat elemen <item>',
  isSuccess: false
})
assert(malformedPolitik.state === 'DEGRADED' && malformedPolitik.errorCode === 'MALFORMED_FEED_NO_ITEMS', 'B5', 'XML feed rusak dipetakan ke DEGRADED', 'B')

// 6. Recovery Test
const recoveredTBH = updateConnectorHealth('src-tbh', {
  state: 'HEALTHY',
  httpStatus: 200,
  latencyMs: 180,
  itemCount: 12,
  isSuccess: true,
  userReadableMessage: 'Koneksi pulih, 12 entri ditarik'
})
assert(recoveredTBH.state === 'HEALTHY' && recoveredTBH.consecutiveFailures === 0, 'B6', 'Pemulihan (recovery) mereset consecutiveFailures ke 0', 'B')
assert(recoveredTBH.lastSuccessAt >= initialTBH.lastSuccessAt, 'B6.1', 'lastSuccessAt diperbarui saat recovery berhasil', 'B')

// 7. Sanitized Error Message Test
const sanitized = sanitizeErrorMessage('Error connecting to https://api.secret.gov/feed?token=SUPER_SECRET_TOKEN_12345&user=admin')
assert(!sanitized.includes('SUPER_SECRET_TOKEN_12345'), 'B7', 'Pesan error berhasil disanitasi dari token/kredensial', 'B')

// ──────────────────────────────────────────────────────────────────────
// BAGIAN C: EVENT CLUSTERING & URL CANONICALIZATION (Item 19 - 30)
// ──────────────────────────────────────────────────────────────────────
console.log('\n─── BAGIAN C: Event Clustering & URL Canonicalization ───')

// 1. Tracking Parameters Stripping
const trackedUrl = 'https://news.detik.com/berita/d-1234567/tni-patroli-ambalat?utm_source=whatsapp&utm_medium=share&fbclid=IwAR123&ref=home/'
const cleanCanonical = normalizeUrl(trackedUrl)
assert(cleanCanonical === 'https://news.detik.com/berita/d-1234567/tni-patroli-ambalat', 'C1', 'Tracking parameters (utm_*, fbclid, ref) dibersihkan dengan aman', 'C')

// 2. Meaningful Query Parameter Preservation (PENTING: ID artikel tidak boleh hilang!)
const articleUrlA = 'https://portalberita.id/baca.php?id=987123&utm_source=twitter'
const articleUrlB = 'https://portalberita.id/baca.php?id=987999&utm_source=telegram'
const normA = normalizeUrl(articleUrlA)
const normB = normalizeUrl(articleUrlB)
assert(normA === 'https://portalberita.id/baca.php?id=987123', 'C2', 'Parameter ID artikel (?id=987123) dipertahankan', 'C')
assert(normB === 'https://portalberita.id/baca.php?id=987999', 'C2.1', 'Parameter ID artikel (?id=987999) dipertahankan', 'C')
assert(normA !== normB, 'C2.2', 'Dua URL artikel berbeda dengan query id tidak kolaps menjadi satu URL', 'C')

// 3. Publisher Domain Extraction
const domainDetik = extractPublisherDomain('https://news.detik.com/berita/d-123')
const domainKompas = extractPublisherDomain('http://www.kompas.com/read/456')
assert(domainDetik === 'news.detik.com', 'C3', 'Domain hostname detik terekstrak', 'C')
assert(domainKompas === 'kompas.com', 'C3.1', 'Domain hostname kompas terekstrak tanpa prefix www', 'C')

// 4. Acronym Boundary (MK vs SMK, TNI vs Petani)
const entMk = extractEntitiesFromText('Sidang Pembacaan Putusan Sengketa Pilkada di Gedung MK')
const entSmk = extractEntitiesFromText('Kemendikbud Luncurkan Kurikulum Vokasi SMK Pusat Keunggulan')
assert(entMk.includes('mk'), 'C4', 'Akronim MK terekstrak saat berdiri sendiri', 'C')
assert(!entSmk.includes('mk'), 'C4.1', 'Kata SMK TIDAK memicu false match untuk MK', 'C')

// 5. Geographic Location Extraction & Conflict Prevention
const locPapua = extractLocationsFromText('Pangdam Cenderawasih Tinjau Pos Pengamanan di Jayapura Papua')
const locAmbalat = extractLocationsFromText('TNI AL Gelar Latihan Tempur Bersama di Laut Natuna dan Ambalat')
assert(locPapua.includes('papua') && locPapua.includes('jayapura'), 'C5', 'Lokasi Papua dan Jayapura terekstrak', 'C')
assert(locAmbalat.includes('ambalat') && locAmbalat.includes('natuna'), 'C5.1', 'Lokasi Ambalat dan Natuna terekstrak', 'C')

// Geographic Conflict Test: Same entity (TNI AL), different explicit locations (Papua vs Ambalat)
const pubPapua = {
  ...mockPubA,
  id: 'PUB-LOC-1',
  title: 'TNI AL Siagakan Kapal Patroli di Pesisir Jayapura Papua',
  excerpt: 'Pengamanan maritim di pesisir utara Jayapura.',
  canonicalUrl: 'https://news.antaranews.com/tni-jayapura'
}
const pubAmbalat = {
  ...mockPubA,
  id: 'PUB-LOC-2',
  title: 'TNI AL Siagakan Kapal Patroli di Perairan Ambalat Kaltara',
  excerpt: 'Pengawasan blok perbatasan laut terluar Ambalat.',
  canonicalUrl: 'https://news.antaranews.com/tni-ambalat'
}
const locClusters = clusterEventPublications([pubPapua, pubAmbalat])
assert(locClusters.length === 2, 'C6', 'Dua berita dengan entitas sama tetapi lokasi bertentangan (Papua vs Ambalat) TIDAK digabung', 'C')

// Temporal Conflict Test: Same entity (Sidang MK), different explicit event dates
const pubMkDate1 = {
  ...mockPubA,
  id: 'PUB-MK-1',
  title: 'Sidang MK 15 Oktober Putuskan Perselisihan Hasil Pemilu',
  excerpt: '',
  canonicalUrl: 'https://hukumonline.com/mk-15-okt'
}
const pubMkDate2 = {
  ...mockPubA,
  id: 'PUB-MK-2',
  title: 'Sidang MK 22 Oktober Kembali Digelar dengan Agenda Saksi Ahli',
  excerpt: '',
  canonicalUrl: 'https://hukumonline.com/mk-22-okt'
}
const dateClusters = clusterEventPublications([pubMkDate1, pubMkDate2])
assert(dateClusters.length === 2, 'C7', 'Dua sidang dengan entitas sama tetapi tanggal peristiwa bertentangan TIDAK digabung', 'C')

// ──────────────────────────────────────────────────────────────────────
// BAGIAN D: FRESHNESS ENGINE & TRANSPARENT ASSESSMENT (Item 31 - 40)
// ──────────────────────────────────────────────────────────────────────
console.log('\n─── BAGIAN D: Freshness Engine & Transparent Assessment ───')

// 1. Strict Freshness Boundaries
const nowEpoch = 1793280000000 // Fixed reference time
const f0 = evaluateFreshness(nowEpoch, nowEpoch)
const f179 = evaluateFreshness(nowEpoch - (179 * 60 * 1000), nowEpoch)
const f180 = evaluateFreshness(nowEpoch - (180 * 60 * 1000), nowEpoch)
const f719 = evaluateFreshness(nowEpoch - (719 * 60 * 1000), nowEpoch)
const f720 = evaluateFreshness(nowEpoch - (720 * 60 * 1000), nowEpoch)
const f1440 = evaluateFreshness(nowEpoch - (1440 * 60 * 1000), nowEpoch)
const f1441 = evaluateFreshness(nowEpoch - (1441 * 60 * 1000), nowEpoch)

assert(f0.status === 'BREAKING', 'D1', '0m = BREAKING', 'D')
assert(f179.status === 'BREAKING', 'D1.1', '179m = BREAKING', 'D')
assert(f180.status === 'AKTUAL', 'D1.2', '180m = tepat batas AKTUAL', 'D')
assert(f719.status === 'AKTUAL', 'D1.3', '719m = batas atas AKTUAL', 'D')
assert(f720.status === 'BERKEMBANG', 'D1.4', '720m = tepat batas BERKEMBANG', 'D')
assert(f1440.status === 'BERKEMBANG', 'D1.5', '1440m = batas atas BERKEMBANG', 'D')
assert(f1441.status === 'KONTEKS', 'D1.6', '1441m = KONTEKS', 'D')

// 2. Anomaly Timestamps
assert(evaluateFreshness(null, nowEpoch).status === 'UNKNOWN_DATE', 'D2', 'null timestamp = UNKNOWN_DATE', 'D')
assert(evaluateFreshness(NaN, nowEpoch).status === 'INVALID_TIMESTAMP', 'D2.1', 'NaN timestamp = INVALID_TIMESTAMP', 'D')
assert(evaluateFreshness(nowEpoch + 3600000, nowEpoch).status === 'FUTURE_TIMESTAMP', 'D2.2', 'Waktu masa depan (+1j) = FUTURE_TIMESTAMP', 'D')

// 3. Peaceful Protest is Not a Threat
const demoItem = {
  claim: 'Ribuan Mahasiswa dan Aliansi Buruh Gelar Aksi Damai Sampaikan Aspirasi di Depan Gedung DPR',
  cluster: 'POLITIK_NEGARA',
  verdict: 'UNVERIFIED',
  officialSource: 'Media Nasional',
  isLive: true
}
const demoAssessment = computeEarlyWarningScore(demoItem)
assert(demoAssessment.triageStatus === 'NETRAL', 'D3', 'Aksi damai mahasiswa / unjuk rasa dievaluasi NETRAL (Bukan hoaks / ancaman)', 'D')
assert(demoAssessment.reasonCodes.includes('PUBLIC_DEMONSTRATION_MONITORING'), 'D3.1', 'Reason code pemantauan aspirasi lapangan disertakan', 'D')

// 4. Fact-check Contextual Matching Test (Mafindo)
const knownDebunk = {
  id: 'MAFINDO-101',
  claim: 'Beredar Surat Rekrutmen Pegawai Kemenkes Palsu Menjanjikan Gaji Belasan Juta',
  verdict: 'HOAKS',
  keywords: ['rekrutmen', 'kemenkes', 'palsu', 'surat']
}

// Unrelated news mentioning Kemenkes
const legitKemenkesNews = {
  id: 'NEWS-1',
  claim: 'Kemenkes Distribusikan Vaksin Tambahan untuk Puskesmas di Daerah 3T',
  cluster: 'KESEHATAN_PANGAN',
  verdict: 'UNVERIFIED',
  keywords: ['kemenkes', 'vaksin', 'puskesmas']
}
const legitScore = computeEarlyWarningScore(legitKemenkesNews, [knownDebunk])
assert(legitScore.triageStatus !== 'HOAKS', 'D4', 'Berita Kemenkes normal yang mirip entitas TIDAK ikut dicap HOAKS', 'D')

// Matching hoax claim
const matchingHoaxNews = {
  id: 'NEWS-2',
  claim: 'Surat Rekrutmen Pegawai Kemenkes Palsu Beredar di Grup WhatsApp',
  cluster: 'PENIPUAN_BANSOS',
  verdict: 'UNVERIFIED',
  keywords: ['surat', 'rekrutmen', 'pegawai', 'kemenkes', 'palsu']
}
const hoaxScore = computeEarlyWarningScore(matchingHoaxNews, [knownDebunk])
assert(hoaxScore.triageStatus === 'HOAKS', 'D4.1', 'Klaim yang cocok substantif dengan Mafindo berhasil ditriase sebagai HOAKS', 'D')

// ──────────────────────────────────────────────────────────────────────
// BAGIAN E: POLICY GUARDRAILS & SECURITY INTEGRITY (Item 41 - 48)
// ──────────────────────────────────────────────────────────────────────
console.log('\n─── BAGIAN E: Policy Guardrails & Security Integrity ───')

// 1. YouTube Stub Guardrail
const ytSource = ACTIVE_RADAR_SOURCES.find(s => s.id === 'src-youtube-policy-stub')
assert(ytSource !== undefined, 'E1', 'YouTube Policy Guardrail Stub terdaftar di source registry', 'E')
assert(ytSource.enabled === false, 'E1.1', 'YouTube Stub dinonaktifkan secara default (enabled: false)', 'E')
assert(ytSource.policyGuardrail?.prohibitedActions.includes('CROSS_SOURCE_CLUSTERING'), 'E1.2', 'YouTube Stub membatasi pelarangan pencampuran data ke cross-source generic pipeline', 'E')

// 2. Active Sources Contain Zero Telegram
const hasTelegram = ACTIVE_RADAR_SOURCES.some(s => 
  s.id.toLowerCase().includes('telegram') || 
  s.displayName.toLowerCase().includes('telegram') ||
  s.feedUrl.toLowerCase().includes('telegram')
)
assert(!hasTelegram, 'E2', 'NOL integrasi/adapter/referensi Telegram pada seluruh registry', 'E')

// 3. Exactly 5 Active Streams
const activeStreams = getActiveRadarSources()
assert(activeStreams.length === 5, 'E3', 'Tepat 5 stream aktif terverifikasi (TurnBackHoax, 3x GNews, 1x GTrends)', 'E')

// ──────────────────────────────────────────────────────────────────────
// BAGIAN CORPUS: LABELLED CLUSTERING CORPUS (20 POSITIVE + 20 HARD-NEGATIVE)
// ──────────────────────────────────────────────────────────────────────
console.log('\n─── BAGIAN CORPUS: Labelled Clustering Corpus (40 Pasang Uji) ───')

const CORPUS_PAIRS = [
  // ── 20 Positive Pairs (Harus Menggabung dalam 1 Klaster) ──
  { id: 'POS-01', a: 'TNI AL Gagalkan Penyelundupan 50 Kg Sabu di Perairan Selat Malaka', b: 'Aparat TNI AL Sita 50 Kg Sabu Asal Malaysia di Selat Malaka', expectedMerge: true },
  { id: 'POS-02', a: 'KRI Frans Kaisiepo Patroli Kedaulatan di Perbatasan Ambalat Kaltara', b: 'TNI AL Siagakan KRI Frans Kaisiepo Amankan Wilayah Blok Ambalat', expectedMerge: true },
  { id: 'POS-03', a: 'KPK OTT Bupati Pekalongan Terkait Pengadaan Proyek Infrastruktur', b: 'Bupati Pekalongan Ditangkap KPK dalam Operasi Tangkap Tangan Proyek Jalan', expectedMerge: true },
  { id: 'POS-04', a: 'BMKG Imbau Waspada Potensi Cuaca Ekstrem dan Gelombang Tinggi di Selat Sunda', b: 'Peringatan BMKG: Cuaca Buruk dan Gelombang Pasang Berpotensi Terjadi di Selat Sunda', expectedMerge: true },
  { id: 'POS-05', a: 'Presiden Prabowo Pimpin Upacara Hari Sumpah Pemuda di Istana Merdeka', b: 'Peringatan Sumpah Pemuda di Istana Negara Dipimpin Langsung Presiden Prabowo', expectedMerge: true },
  { id: 'POS-06', a: 'Bareskrim Polri Bongkar Sindikat Judi Online Jaringan Kamboja di Cengkareng', b: 'Polisi Gerebek Markas Judi Online Jaringan Kamboja di Wilayah Cengkareng', expectedMerge: true },
  { id: 'POS-07', a: 'Pemerintah Salurkan Bantuan Beras Cadangan Pangan Nasional untuk Warga Kurang Mampu', b: 'Bapanas Mulai Salurkan Bantuan Pangan Beras CBP ke Seluruh Wilayah Indonesia', expectedMerge: true },
  { id: 'POS-08', a: 'Satgas Damai Cartenz Amankan Senjata Api dan Amunisi Milik KKB di Puncak Jaya', b: 'Aparat Satgas Gabungan Sita Senjata dan Peluru dari Markas KKB Puncak Jaya', expectedMerge: true },
  { id: 'POS-09', a: 'Kejagung Periksa Tiga Hakim PN Surabaya Terkait Vonis Bebas Ronald Tannur', b: 'Tiga Hakim Pemberi Vonis Bebas Ronald Tannur Diperiksa Intensif oleh Kejagung', expectedMerge: true },
  { id: 'POS-10', a: 'Kemenkes Luncurkan Program Cek Kesehatan Gratis untuk Seluruh Warga yang Ulang Tahun', b: 'Warga yang Berulang Tahun Dapat Hadiah Skrining Kesehatan Gratis dari Kemenkes', expectedMerge: true },
  { id: 'POS-11', a: 'Menteri ESDM Bahlil Lahadalia Tinjau Proyek Pipa Gas Cisem Tahap Dua di Batang', b: 'Bahlil Pastikan Pembangunan Pipa Gas Cirebon Semarang Tahap Dua Berjalan Lancar', expectedMerge: true },
  { id: 'POS-12', a: 'KPU Gelar Debat Perdana Pasangan Calon Gubernur Jakarta di JIExpo Kemayoran', b: 'Debat Perdana Pilkada Jakarta 2024 Berlangsung Panas di Kemayoran', expectedMerge: true },
  { id: 'POS-13', a: 'Kemensos Perketat Data Terpadu Kesejahteraan Sosial Guna Cegah Bansos Salah Sasaran', b: 'Gus Ipul Perintahkan Validasi DTKS Kemensos Agar Penyaluran Bansos Tepat Sasaran', expectedMerge: true },
  { id: 'POS-14', a: 'BPOM Tarik Peredaran Produk Latiao Asal Tiongkok Akibat Kasus Keracunan Bakteri', b: 'Cegah Korban Meluas, BPOM Resmi Larang dan Tarik Jajanan Latiao dari Pasar', expectedMerge: true },
  { id: 'POS-15', a: 'Wapres Gibran Tinjau Uji Coba Makan Bergizi Gratis di SMP Negeri 270 Jakarta', b: 'Gibran Pantau Pelaksanaan Simulasi Program Makan Bergizi Gratis Pelajar di Jakarta', expectedMerge: true },
  { id: 'POS-16', a: 'Panglima TNI Jenderal Agus Subiyanto Resmikan Batalyon Penyangga Teritorial di Merauke', b: 'TNI Bentuk Batalyon Penyangga Baru di Merauke untuk Perkuat Ketahanan Wilayah', expectedMerge: true },
  { id: 'POS-17', a: 'Bawaslu Telusuri Dugaan Pelanggaran Netralitas ASN dalam Kampanye Pilkada Serentak', b: 'Laporan Netralitas ASN Pilkada Diproses Pengawas Bawaslu di Berbagai Daerah', expectedMerge: true },
  { id: 'POS-18', a: 'DPR Sahkan RUU Perlindungan Pekerja Rumah Tangga Menjadi RUU Inisiatif', b: 'Rapat Paripurna DPR Resmi Setujui RUU PPRT Dibahas Menjadi Inisiatif Parlemen', expectedMerge: true },
  { id: 'POS-19', a: 'Gempa Bumi Magnitudo 5.8 Guncang Wilayah Maluku Barat Daya BMKG Pastikan Tak Tsunami', b: 'BMKG Laporkan Gempa M 5.8 di Maluku Barat Daya Tidak Berpotensi Tsunami', expectedMerge: true },
  { id: 'POS-20', a: 'TNI Bersama Warga Perbaiki Jembatan Gantung yang Rusak Diterjang Banjir di Garut', b: 'Prajurit Kodim Garut Gotong Royong Rehab Jembatan Putus Akibat Bencana Luapan Sungai', expectedMerge: true },

  // ── 20 Hard-Negative Pairs (Harus Terpisah / Tidak Boleh False-Merge) ──
  { id: 'NEG-01', a: 'TNI AL Gelar Patroli Rutin di Wilayah Perairan Laut Natuna Utara', b: 'TNI AL Evakuasi ABK Kapal Tenggelam di Selat Makassar', expectedMerge: false }, // Beda lokasi & peristiwa
  { id: 'NEG-02', a: 'Sidang MK 15 Oktober Putuskan Perselisihan Ambang Batas Parlemen', b: 'Sidang MK 22 Oktober Bacakan Putusan Uji Materi Syarat Usia Calon Kepala Daerah', expectedMerge: false }, // Beda tanggal & materi
  { id: 'NEG-03', a: 'Ribuan Buruh Gelar Demo Tuntut Kenaikan UMK 2025 di Depan Gedung Sate Bandung', b: 'Aliansi Mahasiswa Unjuk Rasa Tolak Kenaikan UKT di Kampus Yogyakarta', expectedMerge: false }, // Beda kota & isu
  { id: 'NEG-04', a: 'Aparat Satgas Gagalkan Aksi Penyerangan KKB Terhadap Pos TNI di Intan Jaya Papua', b: 'KKB Bakar Bangunan Puskesmas dan Gedung Sekolah di Yahukimo Papua', expectedMerge: false }, // Beda distrik & insiden
  { id: 'NEG-05', a: 'Kemenkes Laporkan Temuan Kasus Mpox Cacar Monyet Pertama di Jakarta', b: 'Kemenkes Distribusikan Vaksin Polio Serentak di Provinsi Aceh', expectedMerge: false }, // Beda penyakit & tempat
  { id: 'NEG-06', a: 'Gempa Bumi Tektonik M 4.9 Guncang Wilayah Sukabumi Jawa Barat', b: 'Gempa M 6.1 Guncang Kepulauan Mentawai Sumatera Barat Terasa Hingga Padang', expectedMerge: false }, // Beda gempa bumi
  { id: 'NEG-07', a: 'KPK Tetapkan Tersangka Dugaan Suap Pengadaan Truk Angkut Personel di Basarnas', b: 'KPK Tahan Mantan Direktur BUMN Terkait Korupsi Pengadaan Gas Alam Cair', expectedMerge: false }, // Beda kasus korupsi
  { id: 'NEG-08', a: 'Sidang Pembacaan Vonis Perkara Korupsi BTS Kominfo di Pengadilan Tipikor', b: 'Sidang Perdana Kasus Korupsi Impor Gula Mendag Tom Lembong Digelar Hari Ini', expectedMerge: false }, // Beda persidangan
  { id: 'NEG-09', a: 'Presiden Prabowo Resmikan Jembatan Baru Penghubung Dua Desa di Kendal', b: 'Presiden Prabowo Lantik Kepala Badan Pengelola Investasi Danantara di Istana', expectedMerge: false }, // Beda agenda kenegaraan
  { id: 'NEG-10', a: 'Gibran Kunjungi Pengungsi Korban Letusan Gunung Lewotobi di Flores Timur', b: 'Gibran Buka Rapat Koordinasi Evaluasi Kebijakan Pendidikan Bersama Kadis se-Indonesia', expectedMerge: false }, // Beda aktivitas
  { id: 'NEG-11', a: 'Polresta Bandara Soekarno Hatta Gagalkan Penyelundupan Sabu Jaringan Internasional', b: 'Polda Metro Jaya Ringkus Kawanan Begal Bersenjata Tajam di Duren Sawit', expectedMerge: false }, // Beda kejahatan
  { id: 'NEG-12', a: 'Polda Metro Gelar Operasi Zebra Jaya 2024 Sasar Pelanggaran Lawan Arah', b: 'Korlantas Polri Luncurkan SIM C1 untuk Pengendara Motor Kapasitas Mesin 250cc', expectedMerge: false }, // Beda program lalu lintas
  { id: 'NEG-13', a: 'Kemendikbud Luncurkan Program Revitalisasi SMK Vokasi Unggulan', b: 'Sidang Perkara Perselisihan Hasil Pemilihan Legislatif di Gedung MK Berlanjut', expectedMerge: false }, // Uji Batas SMK vs MK
  { id: 'NEG-14', a: 'Kemensos Salurkan Bansos PKH Tahap Empat Bagi Keluarga Miskin Ekstrem', b: 'Kemenkes Terbitkan Sertifikat Vaksinasi Haji dan Umrah Terintegrasi SatuSehat', expectedMerge: false }, // Beda kementerian & program
  { id: 'NEG-15', a: 'Bareskrim Polri Periksa Saksi Terkait Kasus Pemalsuan Ijazah Sarjana', b: 'Polri Ungkap Kasus Peredaran Obat Keras Ilegal Tanpa Resep Dokter di Apotek', expectedMerge: false }, // Beda jenis pidana
  { id: 'NEG-16', a: 'Bawaslu Putuskan Pelanggaran Administrasi Pemilu di Kabupaten Jayapura', b: 'KPU Tetapkan Jadwal Kampanye Rapat Umum Pilkada Kabupaten Merauke', expectedMerge: false }, // Beda lembaga & daerah
  { id: 'NEG-17', a: 'Petani Cabai di Garut Keluhkan Serangan Hama Ulat Akibat Cuaca Basah', b: 'Prajurit TNI Bantu Warga Panen Jagung Serentak di Lahan Ketahanan Pangan', expectedMerge: false }, // Uji Batas Petani vs TNI
  { id: 'NEG-18', a: 'BPOM Sita Ratusan Kosmetik Ilegal Tanpa Izin Edar di Pusat Grosir Pasar Asemka', b: 'Kemenperin Fasilitasi Sertifikasi Halal Gratis untuk Ribuan Industri Kecil Menengah', expectedMerge: false }, // Beda sektor
  { id: 'NEG-19', a: 'Pangdam Iskandar Muda Pimpin Apel Kesiapsiagaan Prajurit Pengamanan Pilkada Aceh', b: 'Pangdam Hasanuddin Tinjau Proyek Pompanisasi Sawah Tadah Hujan di Bone', expectedMerge: false }, // Beda kodam & wilayah
  { id: 'NEG-20', a: 'Banjir Rendam Ribuan Rumah di Dayeuhkolot Bandung Akibat Sungai Citarum Meluap', b: 'Bencana Tanah Longsor Terjang Jalur Utama Trenggalek Ponorogo Arus Lalu Lintas Lumpuh', expectedMerge: false } // Beda bencana & lokasi
]

let truePositives = 0
let falseNegatives = 0
let trueNegatives = 0
let falsePositives = 0

CORPUS_PAIRS.forEach((pair, idx) => {
  const itemA = {
    ...mockPubA,
    id: `CORP-${idx}-A`,
    title: pair.a,
    excerpt: '',
    canonicalUrl: `https://media1.com/berita/${idx}-a`,
    publishedAt: Date.now() - 3600000
  }
  const itemB = {
    ...mockPubA,
    id: `CORP-${idx}-B`,
    title: pair.b,
    excerpt: '',
    canonicalUrl: `https://media2.com/berita/${idx}-b`,
    publishedAt: Date.now() - 3600000
  }

  const resultClusters = clusterEventPublications([itemA, itemB])
  const actualMerged = resultClusters.length === 1

  if (pair.expectedMerge) {
    if (actualMerged) {
      truePositives++
      assert(true, pair.id, `[POSITIVE MERGE] "${pair.a.slice(0, 35)}..." + "${pair.b.slice(0, 35)}..."`, 'CORPUS')
    } else {
      falseNegatives++
      assert(false, pair.id, `[FALSE SPLIT] Gagal menggabung berita peristiwa sama`, 'CORPUS')
    }
  } else {
    if (!actualMerged) {
      trueNegatives++
      assert(true, pair.id, `[NEGATIVE SEPARATION] "${pair.a.slice(0, 35)}..." != "${pair.b.slice(0, 35)}..."`, 'CORPUS')
    } else {
      falsePositives++
      assert(false, pair.id, `[FALSE MERGE] Dua peristiwa berbeda keliru digabung!`, 'CORPUS')
    }
  }
})

const precision = truePositives / (truePositives + falsePositives)
const recall = truePositives / (truePositives + falseNegatives)

console.log('\n══════════════════════════════════════════════════════════════════════')
console.log('📊 REKAPITULASI METRIK CLUSTERING CORPUS (SPRINT 1B):')
console.log(`   - Total Pasang Diuji       : ${CORPUS_PAIRS.length}`)
console.log(`   - True Positives (TP)      : ${truePositives} / 20`)
console.log(`   - True Negatives (TN)      : ${trueNegatives} / 20`)
console.log(`   - False Positives (FP)     : ${falsePositives} (Target: 0)`)
console.log(`   - False Negatives (FN)     : ${falseNegatives}`)
console.log(`   - Precision (Presisi)      : ${(precision * 100).toFixed(1)}%`)
console.log(`   - Recall (Sensitivitas)    : ${(recall * 100).toFixed(1)}%`)
console.log('══════════════════════════════════════════════════════════════════════\n')

console.log('══════════════════════════════════════════════════════════════════════')
console.log(`🎯 TOTAL PENGUJIAN KESELURUHAN: ${totalTests}`)
console.log(`   ✅ LULUS (PASS)  : ${passedTests}`)
console.log(`   ❌ GAGAL (FAIL)  : ${failedTests}`)
console.log('══════════════════════════════════════════════════════════════════════')

if (failedTests > 0) {
  process.exit(1)
} else {
  process.exit(0)
}
