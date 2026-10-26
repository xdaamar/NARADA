import { parseTurnBackHoaxRss, parseGoogleNewsRss, parseGoogleTrendsRss } from '../src/engine/ingest/rss-parser.ts'

async function runTest() {
  console.log('🧪 Memulai Pengujian Engine RSS Parser Mandiri (Tahap 1)...\n')

  // 1. Uji TurnBackHoax Feed
  console.log('1. Mengambil Feed TurnBackHoax Live...')
  const resTBH = await fetch('https://turnbackhoax.id/feed/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  })
  const xmlTBH = await resTBH.text()
  const tbhEntries = parseTurnBackHoaxRss(xmlTBH)
  console.log(`   ✅ Berhasil mem-parse ${tbhEntries.length} entri TurnBackHoax.`)
  if (tbhEntries.length > 0) {
    const first = tbhEntries[0]
    console.log(`   - Sample Judul  : ${first.claim}`)
    console.log(`   - Vonis Taktis  : ${first.verdict}`)
    console.log(`   - Canonical URL : ${first.sourceUrl}`)
    console.log(`   - Sumber Resmi  : ${first.officialSource}`)
    console.log(`   - Klaster       : ${first.cluster}`)
    if (!first.sourceUrl.includes('/articles/')) {
      throw new Error(`Canonical URL TurnBackHoax tidak valid: ${first.sourceUrl}`)
    }
  }

  // 2. Uji Google News Hankam Feed
  console.log('\n2. Mengambil Feed Google News Hankam & TNI Live...')
  const resNews = await fetch('https://news.google.com/rss/search?q=TNI+OR+alutsista+OR+papua+OR+hoaks+when:2d&hl=id&gl=ID&ceid=ID:id', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  })
  const xmlNews = await resNews.text()
  const newsEntries = parseGoogleNewsRss(xmlNews)
  console.log(`   ✅ Berhasil mem-parse ${newsEntries.length} entri Google News.`)
  if (newsEntries.length > 0) {
    const first = newsEntries[0]
    console.log(`   - Sample Judul  : ${first.claim}`)
    console.log(`   - Status Taktis : ${first.verdict}`)
    console.log(`   - Canonical URL : ${first.sourceUrl}`)
    console.log(`   - Sumber Portal : ${first.officialSource}`)
    console.log(`   - Klaster       : ${first.cluster}`)
  }

  // 3. Uji Google Trends Indonesia Feed
  console.log('\n3. Mengambil Feed Google Trends Indonesia Live...')
  const resTrends = await fetch('https://trends.google.com/trending/rss?geo=ID', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  })
  const xmlTrends = await resTrends.text()
  const trendEntries = parseGoogleTrendsRss(xmlTrends)
  console.log(`   ✅ Berhasil mem-parse ${trendEntries.length} entri Google Trends.`)
  if (trendEntries.length > 0) {
    const first = trendEntries[0]
    console.log(`   - Sample Topik  : ${first.claim}`)
    console.log(`   - Status Taktis : ${first.verdict}`)
    console.log(`   - Lonjakan Tren : ${first.trendTraffic}`)
    console.log(`   - Canonical URL : ${first.sourceUrl}`)
    console.log(`   - Klaster       : ${first.cluster}`)
  }

  console.log('\n🎉 SEMUA FEED PARSER BERHASIL DIUJI TANPA DUMMY!')
}

runTest().catch(err => {
  console.error('❌ Gagal pengujian parser:', err)
  process.exit(1)
})
