import { 
  computeEarlyWarningScore, 
  scoreAndTriageRadarEntries, 
  getTacticalBriefingSummary 
} from '../src/engine/radar/early-warning-scorer.ts'

import { 
  parseTurnBackHoaxRss, 
  parseGoogleNewsRss, 
  parseGoogleTrendsRss 
} from '../src/engine/ingest/rss-parser.ts'

async function runScorerTest() {
  console.log('🧪 Memulai Pengujian Engine Early-Warning Scorer & Triage (Tahap 2)...\n')

  // 1. Uji Kasus Khusus: Sensitivitas Entitas & Sentimen Agitasi
  console.log('1. Menguji Formula Indeks Ancaman Kognitif (R = 0.40E + 0.35S + 0.25T)...')

  const sampleHankam = {
    id: 'TEST-1',
    claim: 'Kopassus dan TNI AD gelar operasi siaga kedaulatan di perbatasan Papua hadapi provokasi',
    normalizedQuery: 'tni ad kopassus perbatasan papua',
    cluster: 'KEDAULATAN_MILITER',
    verdict: 'UNVERIFIED',
    threatLevel: 'high',
    clarification: 'Isu sedang dipantau di lapangan.',
    officialSource: 'Dispenad TNI AD',
    sourceUrl: 'https://tni-ad.mil.id',
    keywords: ['kopassus', 'tni', 'kedaulatan', 'papua'],
    tacticalResponseCivilian: '',
    tacticalResponseMilitary: '',
    trendTraffic: '+50K+',
    isLive: true
  }

  const score1 = computeEarlyWarningScore(sampleHankam)
  console.log('   Kasus 1: Isu Militer Sensitif (Kopassus + Papua + +50K+ Trend)')
  console.log(`   - Entity Score   (E): ${score1.entitySensitivity}/100`)
  console.log(`   - Agitation Score(S): ${score1.agitationScore}/100`)
  console.log(`   - Trend Score    (T): ${score1.trendVelocityScore}/100`)
  console.log(`   - Total Threat R    : ${score1.threatIndex}/100`)
  console.log(`   - Level Siaga       : ${score1.alertLevel}`)
  console.log(`   - Triage Status     : ${score1.triageStatus}`)

  if (score1.threatIndex < 70) {
    throw new Error(`Skor isu Hankam terlalu rendah: ${score1.threatIndex}`)
  }

  const sampleNeutral = {
    id: 'TEST-2',
    claim: 'Jadwal pertandingan liga sepakbola dan festival kuliner nusantara',
    normalizedQuery: 'sepakbola kuliner festival',
    cluster: 'POLITIK_NEGARA',
    verdict: 'UNVERIFIED',
    threatLevel: 'low',
    clarification: 'Informasi hiburan publik.',
    officialSource: 'Portal Berita',
    sourceUrl: 'https://kompas.com',
    keywords: ['pertandingan', 'kuliner', 'festival'],
    tacticalResponseCivilian: '',
    tacticalResponseMilitary: '',
    trendTraffic: '+200+',
    isLive: false
  }

  const score2 = computeEarlyWarningScore(sampleNeutral)
  console.log('\n   Kasus 2: Isu Hiburan Netral (Kuliner & Sepakbola)')
  console.log(`   - Entity Score   (E): ${score2.entitySensitivity}/100`)
  console.log(`   - Agitation Score(S): ${score2.agitationScore}/100`)
  console.log(`   - Trend Score    (T): ${score2.trendVelocityScore}/100`)
  console.log(`   - Total Threat R    : ${score2.threatIndex}/100`)
  console.log(`   - Level Siaga       : ${score2.alertLevel}`)
  console.log(`   - Triage Status     : ${score2.triageStatus}`)

  if (score2.triageStatus !== 'NETRAL') {
    throw new Error(`Kasus netral salah diklasifikasikan: ${score2.triageStatus}`)
  }

  // 2. Uji Integrasi pada Data Nyata Hasil Parsing RSS
  console.log('\n2. Menjalankan Scoring & Triage pada Feed Nyata Internet...')
  const resNews = await fetch('https://news.google.com/rss/search?q=TNI+OR+alutsista+OR+papua+OR+hoaks+when:2d&hl=id&gl=ID&ceid=ID:id', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  })
  const xmlNews = await resNews.text()
  const rawNews = parseGoogleNewsRss(xmlNews).slice(0, 10)

  const resTBH = await fetch('https://turnbackhoax.id/feed/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  })
  const xmlTBH = await resTBH.text()
  const rawTBH = parseTurnBackHoaxRss(xmlTBH).slice(0, 5)

  const resTrends = await fetch('https://trends.google.com/trending/rss?geo=ID', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  })
  const xmlTrends = await resTrends.text()
  const rawTrends = parseGoogleTrendsRss(xmlTrends).slice(0, 5)

  const combined = [...rawTBH, ...rawNews, ...rawTrends]
  const triaged = scoreAndTriageRadarEntries(combined, rawTBH)

  console.log(`   ✅ Berhasil memproses triage pada ${triaged.length} entri live gabungan.`)

  // 3. Uji Pembuat Ringkasan Pop-up Notifikasi Intelijen (Briefing Summary)
  console.log('\n3. Menguji Tactical Intel Briefing Generator (Pop-up Modal Feed)...')
  const summary = getTacticalBriefingSummary(triaged)

  console.log(`   - Total Isu Dipindai    : ${summary.totalScanned}`)
  console.log(`   - 🔴 Terindikasi Hoaks  : ${summary.hoaxCount}`)
  console.log(`   - 🟢 Terkonfirmasi Fakta: ${summary.factCount}`)
  console.log(`   - ⚪ Pembicaraan Netral  : ${summary.neutralCount}`)
  console.log(`   - 🟡 Masih Dipantau     : ${summary.unverifiedCount}`)
  console.log(`   - 🚨 Siaga Kritis       : ${summary.criticalCount}`)
  console.log(`   - Waktu Pindai Terkini  : ${summary.lastScannedTime}`)
  console.log(`   - Jumlah Headline Utama : ${summary.headlineItems.length}`)

  if (summary.headlineItems.length > 0) {
    console.log(`   - Contoh Headline #1    : [${summary.headlineItems[0].verdict}] ${summary.headlineItems[0].claim} (Skor: ${summary.headlineItems[0].cognitiveScore})`)
  }

  console.log('\n🎉 TAHAP 2 BERHASIL 100%: Engine Scoring & Triage Bekerja Sempurna!')
}

runScorerTest().catch(err => {
  console.error('❌ Gagal pengujian scorer:', err)
  process.exit(1)
})
