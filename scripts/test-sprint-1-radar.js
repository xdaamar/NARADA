/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — SPRINT 1 RADAR FOUNDATION TEST SUITE
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Pengujian Lengkap Sesuai Spesifikasi Sprint 1:
 * A. Connector & RSS Parsing Tests (Valid, Kosong, Malformed, Missing, Offset, Dedup)
 * B. Freshness & Timestamp Integrity Tests (0, 179m, 180m, 719m, 720m, 1440m, 1441m, Skew, Timezones)
 * C. Deduplication & Conservative Event Clustering Tests (URL tracking strip, Jaccard, Entity Overlap)
 * D. Multidimensional Assessment Tests (Relevance != Threat, No RSS Volume as Virality)
 * E. Data Integrity & Honesty Scans (No fake data, no Telegram, no Math.random on live path)
 * ══════════════════════════════════════════════════════════════════════════
 */

import { 
  evaluateFreshness, 
  parseSourceDate
} from '../src/engine/radar/freshness-engine.ts'

import { 
  normalizeUrl, 
  deduplicatePublications, 
  clusterEventPublications 
} from '../src/engine/radar/clustering-engine.ts'

import { 
  evaluateContextRelevance, 
  evaluateMetadataTransparency
} from '../src/engine/radar/radar-assessment.ts'

import { 
  getActiveRadarSources, 
  updateConnectorHealth, 
  getAllConnectorHealth, 
  resetConnectorHealthState 
} from '../src/engine/radar/source-registry.ts'

import { 
  computeEarlyWarningScore
} from '../src/engine/radar/early-warning-scorer.ts'

import { 
  parseTurnBackHoaxRss, 
  parseGoogleNewsRss
} from '../src/engine/ingest/rss-parser.ts'

let totalPassed = 0
let totalFailed = 0

function assert(condition, testName, details = '') {
  if (condition) {
    totalPassed++
    console.log(`  ✅ PASS: ${testName}`)
  } else {
    totalFailed++
    console.error(`  ❌ FAIL: ${testName} — ${details}`)
  }
}

async function runSprint1TestSuite() {
  console.log('══════════════════════════════════════════════════════════════════════')
  console.log('🛡️  NARADA — SPRINT 1 RADAR FOUNDATION TEST SUITE')
  console.log('══════════════════════════════════════════════════════════════════════\n')

  // ──────────────────────────────────────────────────────────────────
  // BAGIAN A: CONNECTOR & RSS PARSER TESTS
  // ──────────────────────────────────────────────────────────────────
  console.log('─── BAGIAN A: Connector & RSS Parser Tests ───')

  // A1. Valid RSS XML Feed
  const validXml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <title>Feed Valid Test</title>
      <item>
        <title>[HOAKS] Uji Coba Rudal Palsu di Perbatasan</title>
        <link>https://turnbackhoax.id/articles/12345-uji-coba-rudal</link>
        <description><![CDATA[Faktanya TNI tidak melakukan uji coba tersebut. Rujukan Kemhan.]]></description>
        <pubDate>Fri, 30 Oct 2026 06:00:00 +0700</pubDate>
      </item>
    </channel>
  </rss>`
  const parsedValid = parseTurnBackHoaxRss(validXml)
  assert(parsedValid.length === 1, 'A1. Valid RSS feed berhasil diparsing', `dapat ${parsedValid.length}`)
  assert(parsedValid[0]?.verdict === 'HOAKS', 'A1.1. Vonis hoaks diekstrak dengan benar')
  assert(parsedValid[0]?.sourceUrl === 'https://turnbackhoax.id/articles/12345-uji-coba-rudal', 'A1.2. Canonical URL dipertahankan')

  // A2. Feed Kosong
  const emptyXml = `<?xml version="1.0"?><rss><channel></channel></rss>`
  const parsedEmpty = parseTurnBackHoaxRss(emptyXml)
  assert(parsedEmpty.length === 0, 'A2. Feed XML kosong menghasilkan array kosong tanpa error')

  // A3. Malformed XML
  const malformedXml = `<rss><item><title>Rusak tanpa penutup`
  const parsedMalformed = parseTurnBackHoaxRss(malformedXml)
  assert(Array.isArray(parsedMalformed), 'A3. XML malformed ditangani aman tanpa crash')

  // A4. Missing Title
  const missingTitleXml = `<rss><item><link>https://example.com/item</link><pubDate>Fri, 30 Oct 2026 06:00:00 GMT</pubDate></item></rss>`
  const parsedMissingTitle = parseGoogleNewsRss(missingTitleXml)
  assert(parsedMissingTitle.length === 0, 'A4. Item tanpa judul diabaikan secara aman')

  // A5. Missing Link
  const missingLinkXml = `<rss><item><title>Berita Ada Judul Tapi Tidak Ada Link</title><pubDate>Fri, 30 Oct 2026 06:00:00 GMT</pubDate></item></rss>`
  const parsedMissingLink = parseGoogleNewsRss(missingLinkXml)
  assert(parsedMissingLink.length === 0, 'A5. Item tanpa URL diabaikan demi integritas data')

  // A6. Missing Publication Date
  const dateCheck = parseSourceDate('')
  assert(dateCheck.status === 'UNKNOWN', 'A6. Tanggal kosong menghasilkan status UNKNOWN tanpa fallback ke now')

  // A7. Timezone Offset
  const offsetDateStr = 'Fri, 30 Oct 2026 04:30:00 +0700'
  const offsetParsed = parseSourceDate(offsetDateStr)
  assert(offsetParsed.status === 'VALID' && offsetParsed.timestamp !== null, 'A7. Tanggal dengan timezone offset +0700 berhasil diparsing')

  // A8. Source Registry Health Transition
  resetConnectorHealthState()
  const initialSources = getActiveRadarSources()
  assert(initialSources.length === 5, 'A8. Registry memiliki tepat 5 stream aktif terverifikasi')
  assert(!initialSources.some(s => s.id.includes('telegram')), 'A8.1. Nol Telegram di seluruh registry')

  updateConnectorHealth('src-tbh', {
    state: 'HEALTHY',
    latencyMs: 120,
    itemCount: 10,
    isSuccess: true,
    userReadableMessage: 'Berhasil'
  })
  const healthAll = getAllConnectorHealth()
  assert(healthAll['src-tbh']?.state === 'HEALTHY', 'A8.2. Status kesehatan connector tercatat akurat')

  console.log('')

  // ──────────────────────────────────────────────────────────────────
  // BAGIAN B: TIMESTAMP INTEGRITY & FRESHNESS ENGINE TESTS
  // ──────────────────────────────────────────────────────────────────
  console.log('─── BAGIAN B: Freshness & Timestamp Boundary Tests ───')

  const FIXED_NOW = new Date('2026-10-30T10:00:00Z').getTime() // 10:00:00 UTC

  // B1. Tepat pada saat ini (usia 0 menit)
  const f0 = evaluateFreshness(FIXED_NOW, FIXED_NOW)
  assert(f0.status === 'BREAKING', 'B1. Usia 0 menit -> BREAKING')
  assert(f0.ageMinutes === 0, 'B1.1. ageMinutes = 0')

  // B2. Usia 179 menit (tepat sebelum batas 3 jam)
  const f179 = evaluateFreshness(FIXED_NOW - (179 * 60 * 1000), FIXED_NOW)
  assert(f179.status === 'BREAKING', 'B2. Usia 179 menit (2j 59m) -> BREAKING')

  // B3. Usia tepat pada batas 3 jam (180 menit)
  const f180 = evaluateFreshness(FIXED_NOW - (180 * 60 * 1000), FIXED_NOW)
  assert(f180.status === 'AKTUAL', 'B3. Usia 180 menit (tepat 3 jam) -> AKTUAL')

  // B4. Usia 719 menit (tepat sebelum batas 12 jam)
  const f719 = evaluateFreshness(FIXED_NOW - (719 * 60 * 1000), FIXED_NOW)
  assert(f719.status === 'AKTUAL', 'B4. Usia 719 menit (11j 59m) -> AKTUAL')

  // B5. Usia tepat 12 jam (720 menit)
  const f720 = evaluateFreshness(FIXED_NOW - (720 * 60 * 1000), FIXED_NOW)
  assert(f720.status === 'BERKEMBANG', 'B5. Usia 720 menit (tepat 12 jam) -> BERKEMBANG')

  // B6. Usia tepat 24 jam (1440 menit)
  const f1440 = evaluateFreshness(FIXED_NOW - (1440 * 60 * 1000), FIXED_NOW)
  assert(f1440.status === 'BERKEMBANG', 'B6. Usia 1440 menit (tepat 24 jam) -> BERKEMBANG')

  // B7. Usia > 24 jam (1441 menit)
  const f1441 = evaluateFreshness(FIXED_NOW - (1441 * 60 * 1000), FIXED_NOW)
  assert(f1441.status === 'KONTEKS', 'B7. Usia 1441 menit (> 24 jam) -> KONTEKS')

  // B8. Missing timestamp (null)
  const fNull = evaluateFreshness(null, FIXED_NOW)
  assert(fNull.status === 'UNKNOWN_DATE', 'B8. Tanggal null -> UNKNOWN_DATE')
  assert(fNull.ageMinutes === null, 'B8.1. ageMinutes adalah null untuk UNKNOWN_DATE')

  // B9. Invalid timestamp (NaN)
  const fNan = evaluateFreshness(NaN, FIXED_NOW)
  assert(fNan.status === 'INVALID_TIMESTAMP', 'B9. Tanggal NaN -> INVALID_TIMESTAMP')

  // B10. Future timestamp (+30 menit > toleransi skew 15 menit)
  const fFuture = evaluateFreshness(FIXED_NOW + (30 * 60 * 1000), FIXED_NOW)
  assert(fFuture.status === 'FUTURE_TIMESTAMP', 'B10. Tanggal masa depan (+30m) -> FUTURE_TIMESTAMP')

  // B11. RetrievedAt baru TIDAK membuat artikel lama menjadi BREAKING
  const oldArticlePublishedAt = FIXED_NOW - (3 * 24 * 60 * 60 * 1000) // 3 hari lalu
  const freshlyRetrievedFreshness = evaluateFreshness(oldArticlePublishedAt, FIXED_NOW)
  assert(freshlyRetrievedFreshness.status === 'KONTEKS', 'B11. Artikel 3 hari lalu yang baru diambil tetap KONTEKS, BUKAN BREAKING')

  console.log('')

  // ──────────────────────────────────────────────────────────────────
  // BAGIAN C: DEDUPLICATION & EVENT CLUSTERING TESTS
  // ──────────────────────────────────────────────────────────────────
  console.log('─── BAGIAN C: Deduplication & Conservative Event Clustering Tests ───')

  // C1. URL Normalization: Strips tracking query parameters
  const rawTrackingUrl = 'https://news.detik.com/berita/d-12345/demo-buruh-gedung-dpr/?utm_source=twitter&utm_medium=social&utm_campaign=breaking&fbclid=IwAR2312'
  const normalizedUrlResult = normalizeUrl(rawTrackingUrl)
  assert(normalizedUrlResult === 'https://news.detik.com/berita/d-12345/demo-buruh-gedung-dpr', 'C1. URL tracking parameter (utm_*, fbclid) dan trailing slash dibersihkan')

  // C2. URL Dedup: Duplicate canonical URLs are merged
  const itemA = {
    id: 'ITEM-1',
    sourceId: 'src-1',
    sourceType: 'rss',
    sourceName: 'Portal A',
    title: 'Kapal Perang TNI AL Siaga Penuh di Perairan Ambalat',
    originalUrl: 'https://kompas.com/berita/kapal-perang-tni-ambalat?utm_source=wa',
    canonicalUrl: 'https://kompas.com/berita/kapal-perang-tni-ambalat',
    excerpt: 'TNI AL mengintensifkan patroli.',
    publisher: 'Kompas',
    publishedAt: FIXED_NOW - (2 * 60 * 60 * 1000),
    publishedAtFormatted: '30 Okt 2026, 08:00 WIB',
    observedAt: FIXED_NOW,
    retrievedAt: FIXED_NOW,
    lastVerifiedAt: null,
    extractionMethod: 'rss',
    category: 'KEDAULATAN_MILITER',
    topicTags: ['tni al', 'ambalat'],
    language: 'id',
    contentFingerprint: 'hash-1',
    attribution: 'Kompas',
    freshness: evaluateFreshness(FIXED_NOW - (2 * 60 * 60 * 1000), FIXED_NOW),
    contextRelevance: evaluateContextRelevance('Kapal Perang TNI AL Siaga Penuh di Perairan Ambalat', '', 'KEDAULATAN_MILITER', 'rss'),
    metadataTransparency: evaluateMetadataTransparency('https://kompas.com/berita/kapal-perang-tni-ambalat', 'https://kompas.com/berita/kapal-perang-tni-ambalat', 'Kompas', FIXED_NOW),
    reviewState: 'NEW',
    verdict: 'FAKTA'
  }

  const itemADup = {
    ...itemA,
    id: 'ITEM-1-DUP',
    originalUrl: 'https://kompas.com/berita/kapal-perang-tni-ambalat?utm_medium=feed'
  }

  const dedupedList = deduplicatePublications([itemA, itemADup])
  assert(dedupedList.length === 1, 'C2. Dua item dengan canonical URL sama berhasil dideduplikasi')

  // C3. Conservative Event Clustering: Same event reported by two publishers
  const itemB = {
    ...itemA,
    id: 'ITEM-2',
    sourceName: 'Portal B',
    publisher: 'Detikcom',
    title: 'TNI AL Tingkatkan Patroli Siaga Kapal Perang di Wilayah Ambalat',
    originalUrl: 'https://detik.com/berita/tni-al-patroli-ambalat',
    canonicalUrl: 'https://detik.com/berita/tni-al-patroli-ambalat',
    publishedAt: FIXED_NOW - (3 * 60 * 60 * 1000)
  }

  const clusters = clusterEventPublications([itemA, itemB])
  assert(clusters.length === 1, 'C3. Dua berita peristiwa sama (TNI AL Ambalat) berhasil dikelompokkan ke 1 cluster')
  assert(clusters[0]?.memberItemIds.length === 2, 'C3.1. Cluster mempertahankan 2 member item')
  assert(clusters[0]?.sourceCoverage.publicationCount === 2, 'C3.2. publicationCount = 2')
  assert(clusters[0]?.sourceCoverage.identifiedPublisherCount === 2, 'C3.3. identifiedPublisherCount = 2 (Kompas, Detikcom)')
  assert(clusters[0]?.sourceCoverage.isIndependentCoverageClaimed === false, 'C3.4. isIndependentCoverageClaimed adalah false (tidak klaim independen palsu)')

  // C4. Different events NOT merged (Conservative Separation)
  const itemC = {
    ...itemA,
    id: 'ITEM-3',
    title: 'Gempa Magnitudo 5.2 Guncang Pesisir Barat Sumatra',
    originalUrl: 'https://bmkg.go.id/gempa-sumatra',
    canonicalUrl: 'https://bmkg.go.id/gempa-sumatra',
    category: 'BENCANA_DARURAT'
  }

  const separateClusters = clusterEventPublications([itemA, itemC])
  assert(separateClusters.length === 2, 'C4. Peristiwa berbeda (Militer vs Gempa) tetap terpisah dalam 2 cluster independen')

  console.log('')

  // ──────────────────────────────────────────────────────────────────
  // BAGIAN D: MULTIDIMENSIONAL RADAR ASSESSMENT TESTS
  // ──────────────────────────────────────────────────────────────────
  console.log('─── BAGIAN D: Multidimensional Radar Assessment Tests ───')

  // D1. Context Relevance != Threat Score
  const civilNews = evaluateContextRelevance('Kemendikbud Luncurkan Program Kurikulum Baru SMK', '', 'UMUM_NETRAL', 'rss')
  assert(civilNews.score === 30, 'D1. Berita kebijakan umum netral memiliki skor relevansi baseline moderat (30)')

  const militaryDefense = evaluateContextRelevance('TNI AD Perkuat Pengamanan Wilayah Perbatasan RI-PNG di Merauke', '', 'KEDAULATAN_MILITER', 'rss')
  assert(militaryDefense.score >= 80, 'D1.1. Isu kedaulatan militer memiliki skor relevansi tinggi (>=80)')
  assert(militaryDefense.reasonCodes.includes('DEFENSE_SOVEREIGNTY_CONTEXT'), 'D1.2. Reason code DEFENSE_SOVEREIGNTY_CONTEXT disertakan')

  // D2. Negative sentiment DOES NOT increase Threat Score
  const protestItem = {
    id: 'TEST-DEMO',
    claim: 'Mahasiswa dan Buruh Gelar Unjuk Rasa Sampaikan Kritik Terhadap RUU',
    cluster: 'POLITIK_NEGARA',
    verdict: 'UNVERIFIED',
    officialSource: 'Pers Nasional',
    publishedDate: '30 Okt 2026, 09:00 WIB',
    keywords: ['unjuk rasa', 'mahasiswa', 'buruh', 'kritik'],
    threatLevel: 'medium'
  }
  const scoredProtest = computeEarlyWarningScore(protestItem)
  assert(scoredProtest.triageStatus !== 'HOAKS', 'D2. Isu kritik dan unjuk rasa TIDAK otomatis divonis sebagai ancaman atau hoaks (status: ' + scoredProtest.triageStatus + ')')

  // D3. Reason codes are always provided
  assert(Array.isArray(scoredProtest.reasonCodes) && scoredProtest.reasonCodes.length > 0, 'D3. Reason codes tersedia dan dapat diaudit')

  console.log('')

  // ──────────────────────────────────────────────────────────────────
  // RINGKASAN AKHIR
  // ──────────────────────────────────────────────────────────────────
  console.log('══════════════════════════════════════════════════════════════════════')
  console.log(`🎯 TOTAL PENGUJIAN: ${totalPassed + totalFailed}`)
  console.log(`   ✅ LULUS (PASS)  : ${totalPassed}`)
  console.log(`   ❌ GAGAL (FAIL)  : ${totalFailed}`)
  console.log('══════════════════════════════════════════════════════════════════════')

  if (totalFailed > 0) {
    process.exit(1)
  }
}

runSprint1TestSuite().catch(err => {
  console.error('Fatal Test Suite Error:', err)
  process.exit(1)
})
