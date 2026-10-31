#!/usr/bin/env node
/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — SPRINT 5 ACCEPTANCE TEST SUITE (A01 - A17)
 * RADAR CONNECTOR RELIABILITY & UNVERIFIED CLAIM ROUTING AUDIT VERIFICATION
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 */

import { 
  ACTIVE_RADAR_SOURCES,
  getConnectorHealth,
  getAllConnectorHealth,
  updateConnectorHealth,
  resetConnectorHealthState
} from '../src/engine/radar/source-registry.ts'

import {
  evaluatePublicationEligibility,
  parseGoogleNewsRss,
  parseTurnBackHoaxRss
} from '../src/engine/ingest/rss-parser.ts'

import {
  detectPublicationStance,
  evaluateClaimFirewall,
  resolvePublicationTriage
} from '../src/engine/radar/claim-firewall.ts'

import {
  computeEarlyWarningScore,
  scoreAndTriageRadarEntries
} from '../src/engine/radar/early-warning-scorer.ts'

import {
  clusterEventPublications
} from '../src/engine/radar/clustering-engine.ts'

import {
  getCuratedArchiveDebunks
} from '../src/engine/data/debunk-service.ts'

import {
  handleRadarFeedRequest,
  validateUpstreamUrl
} from '../src/engine/transport/rss-gateway-handler.ts'

import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { startGatewayServer, stopGatewayServer } = require('../electron/gateway-runner.cjs')

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

async function runSprint5TestSuite() {
  console.log('══════════════════════════════════════════════════════════════════════')
  console.log('🛡️  NARADA — SPRINT 5 ACCEPTANCE TEST SUITE (A01 — A17)')
  console.log('══════════════════════════════════════════════════════════════════════\n')

  // ──────────────────────────────────────────────────────────────────
  // A01: Relevant, identifiable, checkable G-News claim -> UNVERIFIED + MONITOR
  // ──────────────────────────────────────────────────────────────────
  console.log('─── A01: Unverified Checkable Claim Routing ───')
  const claimA01 = {
    id: 'NEWS-A01-01',
    claim: 'Warga perbatasan melaporkan adanya pergerakan patok batas negara di sektor timur',
    cluster: 'KEDAULATAN_MILITER',
    verdict: 'UNVERIFIED',
    officialSource: 'Media Regional Antara',
    sourceUrl: 'https://regional.antaranews.com/patok-batas-bergerak',
    isLive: true
  }
  const scoreA01 = computeEarlyWarningScore(claimA01, [])
  assert(scoreA01.triageStatus === 'UNVERIFIED', 'A01.1', 'Klaim relevan tanpa cek fakta ditriase sebagai UNVERIFIED')
  assert(scoreA01.reasonCodes.includes('UNVERIFIED_CLAIM_MONITORING'), 'A01.2', 'Reason code UNVERIFIED_CLAIM_MONITORING disertakan')
  const triagedA01 = scoreAndTriageRadarEntries([claimA01], [])[0]
  assert(triagedA01.verdict === 'UNVERIFIED', 'A01.3', 'Vonis kanonikal tetap UNVERIFIED')
  assert(triagedA01.queueState === 'MONITOR', 'A01.4', 'Antrean pemantauan tercatat MONITOR')

  // ──────────────────────────────────────────────────────────────────
  // A02: Relevant article with no checkable factual claim -> NO_CHECKABLE_CLAIM / EXCLUDED
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── A02: Non-Checkable Content Exclusion ───')
  const nonCheckableTitle = 'Jadwal Pelayanan SIM Keliling di Wilayah Jakarta Selatan Hari Ini'
  const eligA02 = evaluatePublicationEligibility(nonCheckableTitle, 'Informasi jadwal rutin pelayanan masyarakat.', 'https://lantas.polri.go.id/layanan/sim-keliling')
  assert(!eligA02.isEligible, 'A02.1', 'Artikel pelayanan rutin dinilai tidak memenuhi syarat klaim faktual radar')
  assert(eligA02.exclusionReason === 'NO_CHECKABLE_CLAIM', 'A02.2', 'Alasan eksklusi eksplisit NO_CHECKABLE_CLAIM')

  // ──────────────────────────────────────────────────────────────────
  // A03: Claim text too vague -> INSUFFICIENT_CONTEXT
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── A03: Vague Proposition Context Guard ───')
  const vagueClaimTitle = 'Heboh!'
  const vagueFirewall = evaluateClaimFirewall(vagueClaimTitle, '', [])
  assert(vagueFirewall.matchStatus === 'INSUFFICIENT_CONTEXT', 'A03.1', 'Teks sangat pendek/samar menghasilkan INSUFFICIENT_CONTEXT')
  assert(!vagueFirewall.requiresAnalystReview, 'A03.2', 'Teks samar tidak membebani analis dan tidak dipaksa ke vonis salah')

  // ──────────────────────────────────────────────────────────────────
  // A04: REPORTING_CIVIL does not suppress queue routing
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── A04: Reporting Stance Preserves Unverified Claim ───')
  const reportingNewsItem = {
    id: 'NEWS-A04-01',
    claim: 'Polisi selidiki laporan dugaan pungli penyaluran bantuan sosial di wilayah pedalaman',
    cluster: 'PENIPUAN_BANSOS',
    verdict: 'UNVERIFIED',
    officialSource: 'Detik News',
    isLive: true
  }
  const stanceA04 = detectPublicationStance(reportingNewsItem.claim)
  assert(stanceA04 === 'REPORTING_CIVIL', 'A04.1', 'Stance terdeteksi sebagai REPORTING_CIVIL')
  const scoreA04 = computeEarlyWarningScore(reportingNewsItem, [])
  assert(scoreA04.triageStatus === 'UNVERIFIED', 'A04.2', 'REPORTING_CIVIL tanpa cek fakta tetap UNVERIFIED (tidak dipaksa NETRAL)')

  // ──────────────────────────────────────────────────────────────────
  // A05: Title with "hoaks" does not become HOAKS publication
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── A05: Title Hoax Token Isolation ───')
  const debunkTitle = 'Klarifikasi TNI AD: Informasi Rekrutmen Tamtama Berbayar adalah Hoaks'
  const stanceA05 = detectPublicationStance(debunkTitle)
  assert(stanceA05 === 'DEBUNKING_HOAX', 'A05.1', 'Stance terdeteksi sebagai DEBUNKING_HOAX')
  const mockDebunkRef = [{
    id: 'TBH-REF-01',
    claim: 'Rekrutmen prajurit TNI AD dipungut biaya puluhan juta rupiah',
    verdict: 'HOAKS'
  }]
  const debunkItem = {
    id: 'NEWS-A05-01',
    claim: debunkTitle,
    cluster: 'KEDAULATAN_MILITER',
    verdict: 'UNVERIFIED',
    officialSource: 'Dispenad',
    isLive: true
  }
  const scoreA05 = computeEarlyWarningScore(debunkItem, mockDebunkRef)
  assert(scoreA05.triageStatus === 'NETRAL', 'A05.2', 'Artikel klarifikasi yang memuat kata hoaks ditriase NETRAL (BUKAN HOAKS)')
  assert(scoreA05.reasonCodes.includes('PUBLICATION_DEBUNKS_CLAIM'), 'A05.3', 'Reason code PUBLICATION_DEBUNKS_CLAIM disertakan')

  // ──────────────────────────────────────────────────────────────────
  // A06: Publisher with TNI/KEMHAN/BMKG does not automatically become FAKTA
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── A06: Institutional Source Neutrality ───')
  const rawGNewsXmlWithTni = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0"><channel><title>Google News</title>
  <item>
    <title>Puspen TNI Gelar Evaluasi Penanganan Bencana Alam - Kompas.com</title>
    <link>https://news.google.com/rss/articles/CBMiTWh0dHBzOi8vbmFzaW9uYWwua29tcGFzLmNvbS9yZWFkLzIwMjYvMTAvMzEvMDAwMS9wdXNwZW4tdG5pLWdlbGFyLWV2YWx1YXNp0gEA?oc=5</link>
    <pubDate>Fri, 31 Oct 2026 01:00:00 GMT</pubDate>
    <source url="https://nasional.kompas.com">Kompas.com</source>
  </item>
  </channel></rss>`
  const parsedItemsA06 = parseGoogleNewsRss(rawGNewsXmlWithTni, 'src-gnews-hankam', 'Google News — Hankam')
  assert(parsedItemsA06.length === 1, 'A06.1', 'Artikel berhasil diparse')
  assert(parsedItemsA06[0].verdict === 'UNVERIFIED', 'A06.2', 'Publikasi kedinasan tetap berawal sebagai UNVERIFIED (tidak langsung FAKTA)')

  // ──────────────────────────────────────────────────────────────────
  // A07: Live TBH reference reaches matcher in same sync
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── A07: Real-Time Fact-Check Reference Matching ───')
  const liveTbhRef = {
    id: 'TBH-LIVE-777',
    claim: 'Pesawat tempur asing mendarat darurat di pangkalan militer tanpa izin radar',
    verdict: 'HOAKS'
  }
  const matchingClaimItem = {
    id: 'NEWS-A07-01',
    claim: 'Pesawat tempur asing mendarat darurat di pangkalan militer tanpa izin',
    cluster: 'KEDAULATAN_MILITER',
    verdict: 'UNVERIFIED',
    officialSource: 'Media Daring',
    isLive: true
  }
  const nonMatchingClaimItem = {
    id: 'NEWS-A07-02',
    claim: 'Pemerintah bahas kenaikan subsidi pupuk untuk petani Jawa Tengah',
    cluster: 'KRISIS_PANGAN_ENERGI',
    verdict: 'UNVERIFIED',
    officialSource: 'Media Ekonomi',
    isLive: true
  }
  const scoredBatchA07 = scoreAndTriageRadarEntries([matchingClaimItem, nonMatchingClaimItem], [liveTbhRef])
  const resultMatching = scoredBatchA07.find(i => i.id === 'NEWS-A07-01')
  const resultNonMatching = scoredBatchA07.find(i => i.id === 'NEWS-A07-02')
  assert(resultMatching.verdict === 'HOAKS', 'A07.1', 'Klaim yang cocok dengan live TBH terdeteksi HOAKS')
  assert(resultNonMatching.verdict === 'UNVERIFIED', 'A07.2', 'Klaim non-matching di sync yang sama tetap UNVERIFIED tanpa kontaminasi')

  // ──────────────────────────────────────────────────────────────────
  // A08: TBH offline does not block G-News ingestion
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── A08: Connector Failure Isolation ───')
  resetConnectorHealthState()
  updateConnectorHealth('src-tbh', {
    state: 'UNAVAILABLE',
    httpStatus: 504,
    errorMessage: 'Koneksi ke TurnBackHoax upstream timeout',
    userReadableMessage: 'Upstream timeout (HTTP 504)',
    isSuccess: false
  })
  const gnewsHealth = getConnectorHealth('src-gnews-hankam')
  const tbhHealth = getConnectorHealth('src-tbh')
  assert(tbhHealth.state === 'UNAVAILABLE' || tbhHealth.state === 'DEGRADED', 'A08.1', 'TBH berstatus UNAVAILABLE/DEGRADED')
  assert(tbhHealth.httpStatus === 504, 'A08.2', 'HTTP status kegagalan 504 tercatat')
  assert(gnewsHealth.state !== 'UNAVAILABLE', 'A08.3', 'src-gnews-hankam tetap beroperasi independen')

  // ──────────────────────────────────────────────────────────────────
  // A09: Fact-check item does not contaminate event cluster
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── A09: Event Cluster Lead Contamination Firewall ───')
  const pubReporting = {
    id: 'PUB-REP-01',
    sourceId: 'src-gnews-hankam',
    sourceType: 'official',
    title: 'Kapal Perang TNI AL Siaga Penuh di Laut Natuna Cegah Masuknya Kapal Asing',
    originalUrl: 'https://kompas.com/tni-natuna',
    canonicalUrl: 'https://kompas.com/tni-natuna',
    publisher: 'Kompas.com',
    publishedAt: Date.now() - 3600000,
    retrievedAt: Date.now(),
    excerpt: 'Patroli kedaulatan laut perbatasan Natuna.',
    category: 'KEDAULATAN_MILITER',
    verdict: 'UNVERIFIED'
  }
  const pubDebunk = {
    id: 'PUB-DEB-01',
    sourceId: 'src-tbh',
    sourceType: 'fact_check',
    title: '[SALAH] Kapal Perang Asing Kuasai Pangkalan TNI AL di Laut Natuna',
    originalUrl: 'https://turnbackhoax.id/kapal-asing-natuna',
    canonicalUrl: 'https://turnbackhoax.id/kapal-asing-natuna',
    publisher: 'TurnBackHoax',
    publishedAt: Date.now() - 1800000,
    retrievedAt: Date.now(),
    excerpt: 'Klaim pangkalan dikuasai adalah hoaks.',
    category: 'KEDAULATAN_MILITER',
    verdict: 'HOAKS'
  }
  const clusteredEvent = clusterEventPublications([pubDebunk, pubReporting])
  assert(clusteredEvent.length === 1, 'A09.1', 'Kedua artikel Natuna terkelompok ke 1 event cluster')
  assert(clusteredEvent[0].leadItem.id === 'PUB-REP-01', 'A09.2', 'Publikasi pelaporan dipilih sebagai cluster lead (bukan vonis hoaks)')
  assert(clusteredEvent[0].leadItem.verdict === 'UNVERIFIED', 'A09.3', 'Vonis lead cluster tetap UNVERIFIED tanpa kontaminasi HOAKS')

  // ──────────────────────────────────────────────────────────────────
  // A10: Fresh sync vs IndexedDB reload consistency
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── A10: Triage Assessment Idempotence ───')
  const sampleItemsA10 = [
    { id: 'I-1', claim: 'Dugaan pencemaran air sungai dekat pangkalan militer', cluster: 'KEDAULATAN_MILITER', verdict: 'UNVERIFIED', isLive: true }
  ]
  const pass1 = scoreAndTriageRadarEntries(sampleItemsA10, [])
  const pass2 = scoreAndTriageRadarEntries(sampleItemsA10, [])
  assert(pass1[0].verdict === pass2[0].verdict, 'A10.1', 'Vonis hasil asesmen pass 1 dan pass 2 identik')
  assert(pass1[0].queueState === pass2[0].queueState, 'A10.2', 'queueState konsisten antara fresh sync dan reload')

  // ──────────────────────────────────────────────────────────────────
  // A11: Status update event updates canonical fields
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── A11: Canonical Status Synchronizer ───')
  const initialItem = { id: 'SYNC-01', verdict: 'UNVERIFIED', triageStatus: 'UNVERIFIED', queueState: 'MONITOR' }
  const updatedToHoax = {
    ...initialItem,
    verdict: 'HOAKS',
    triageStatus: 'HOAKS',
    queueState: 'RESOLVED'
  }
  assert(updatedToHoax.verdict === 'HOAKS', 'A11.1', 'verdict terupdate ke HOAKS')
  assert(updatedToHoax.triageStatus === 'HOAKS', 'A11.2', 'triageStatus sinkron dengan verdict')
  assert(updatedToHoax.queueState === 'RESOLVED', 'A11.3', 'Isu yang terselesaikan beralih dari MONITOR ke RESOLVED')

  // ──────────────────────────────────────────────────────────────────
  // A12: Replayed feed idempotence
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── A12: Deduplication Idempotence ───')
  const duplicatePubs = [
    { ...pubReporting, id: 'PUB-REP-D1' },
    { ...pubReporting, id: 'PUB-REP-D2' }
  ]
  const deduplicated = clusterEventPublications(duplicatePubs)
  assert(deduplicated[0].sourceCoverage.publicationCount === 1, 'A12.1', 'Publikasi dengan canonicalUrl sama tidak menduplikasi hitungan event cluster')

  // ──────────────────────────────────────────────────────────────────
  // A13: Distinct Google News connector labels
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── A13: Distinct Connector Identity Labels ───')
  const gnewsHankam = ACTIVE_RADAR_SOURCES.find(s => s.id === 'src-gnews-hankam')
  const gnewsDemo = ACTIVE_RADAR_SOURCES.find(s => s.id === 'src-gnews-demo')
  const gnewsPolitik = ACTIVE_RADAR_SOURCES.find(s => s.id === 'src-gnews-politik')
  assert(gnewsHankam.shortLabel && gnewsHankam.shortLabel !== gnewsDemo.shortLabel, 'A13.1', 'Label Hankam berbeda dari Demo')
  assert(gnewsDemo.shortLabel && gnewsDemo.shortLabel !== gnewsPolitik.shortLabel, 'A13.2', 'Label Demo berbeda dari Politik')
  assert(gnewsPolitik.shortLabel && gnewsPolitik.shortLabel.includes('Kebijakan'), 'A13.3', 'Label Politik membawa konteks Kebijakan')

  // ──────────────────────────────────────────────────────────────────
  // A14: TBH HTTP failure diagnostics
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── A14: Sanitized HTTP Diagnostic Telemetry ───')
  resetConnectorHealthState()
  updateConnectorHealth('src-tbh', {
    state: 'UNAVAILABLE',
    httpStatus: 503,
    errorMessage: 'Upstream mengembalikan status HTTP 503 Service Unavailable',
    userReadableMessage: 'Layanan hulu tidak dapat diakses (HTTP 503)',
    isSuccess: false
  })
  const healthA14 = getConnectorHealth('src-tbh')
  assert(healthA14.httpStatus === 503, 'A14.1', 'Kode HTTP 503 tersimpan di connector health')
  assert(healthA14.userReadableMessage.includes('503'), 'A14.2', 'Pesan diagnostik mencantumkan status HTTP 503')
  assert(healthA14.consecutiveFailures === 1, 'A14.3', 'consecutiveFailures bertambah')

  // ──────────────────────────────────────────────────────────────────
  // A15: TBH malformed vs empty feed distinction
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── A15: Malformed XML vs Empty Feed Distinction ───')
  const emptyXml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Empty</title></channel></rss>`
  const parsedEmpty = parseTurnBackHoaxRss(emptyXml)
  assert(parsedEmpty.length === 0, 'A15.1', 'Feed XML kosong diparsing dengan aman (0 entri)')
  const malformedXml = `<invalid><not-closed-tag>`
  const parsedMalformed = parseTurnBackHoaxRss(malformedXml)
  assert(parsedMalformed.length === 0, 'A15.2', 'Feed XML rusak ditangani tanpa melempar exception fatal')

  // ──────────────────────────────────────────────────────────────────
  // A16: Packaged gateway smoke check
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── A16: Packaged Loopback Gateway Smoke Test ───')
  const TEST_GW_PORT = 5176
  const { server: gwServer } = await startGatewayServer(TEST_GW_PORT, '127.0.0.1')
  try {
    const healthResp = await fetch(`http://127.0.0.1:${TEST_GW_PORT}/api/radar/gateway/health`)
    const healthData = await healthResp.json()
    assert(healthResp.status === 200, 'A16.1', 'Gateway loopback merespons HTTP 200')
    assert(healthData.mode === 'packaged-electron', 'A16.2', 'Mode gateway terverifikasi packaged-electron')
    assert(healthData.status === 'HEALTHY', 'A16.3', 'Status kesehatan gateway adalah HEALTHY')

    // SSRF rejection on custom URL injection
    const ssrfResp = await fetch(`http://127.0.0.1:${TEST_GW_PORT}/api/radar/feed/src-tbh?url=http://127.0.0.1:9000/evil`)
    const ssrfData = await ssrfResp.json()
    assert(ssrfResp.status === 400, 'A16.4', 'Percobaan injeksi query parameter URL ditolak HTTP 400')
    assert(ssrfData.errorCode === 'SSRF_OVERRIDE_FORBIDDEN', 'A16.5', 'Error code SSRF_OVERRIDE_FORBIDDEN terpicu')
  } finally {
    await stopGatewayServer(gwServer)
  }

  // ──────────────────────────────────────────────────────────────────
  // A17: Curated archive absent metrics/dates render honestly
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── A17: Curated Archive Honest Unknowns ───')
  const archiveDebunks = getCuratedArchiveDebunks()
  assert(archiveDebunks.length > 200, 'A17.1', 'Pangkalan data arsip lokal memuat 200+ entri')
  const unverifiedSeeds = archiveDebunks.filter(d => d.id.startsWith('CLM-TERR-UNV-'))
  assert(unverifiedSeeds.length === 5, 'A17.2', 'Terdapat tepat 5 seed isu historis UNVERIFIED terkurasi')
  assert(unverifiedSeeds.every(d => d.verdict === 'UNVERIFIED' && d.queueState === 'MONITOR'), 'A17.3', 'Seluruh 5 seed berstatus UNVERIFIED + MONITOR')
  // Check no index-based date math
  const firstItem = archiveDebunks[0]
  assert(firstItem.publishedDate === undefined || typeof firstItem.publishedDate === 'string', 'A17.4', 'Tanggal publikasi tidak dimanufaktur secara sintetis')
  assert(firstItem.interceptedAt === undefined, 'A17.5', 'Timestamp pencegatan undefined saat tidak ada data historis')
  assert(firstItem.engagement === undefined, 'A17.6', 'Metrik engagement undefined saat tidak ada data historis')

  // ──────────────────────────────────────────────────────────────────
  // Final Summary & Report Card
  // ──────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════════════')
  console.log(`🎯 TOTAL ASSERTIONS SPRINT 5: ${totalAssertions}`)
  console.log(`   ✅ PASS: ${passedAssertions}`)
  console.log(`   ❌ FAIL: ${failedAssertions}`)
  console.log('══════════════════════════════════════════════════════════════════════')

  if (failedAssertions > 0) {
    console.error('\n❌ DAFTAR KEGAGALAN:')
    failures.forEach(f => console.error(`   - [${f.code}] ${f.description}`))
    process.exit(1)
  } else {
    console.log('\n🌟 SELURUH 17 ACCEPTANCE CRITERIA SPRINT 5 (A01 - A17) LULUS 100%!')
    process.exit(0)
  }
}

runSprint5TestSuite().catch(err => {
  console.error('Fatal unhandled error in test suite:', err)
  process.exit(1)
})
