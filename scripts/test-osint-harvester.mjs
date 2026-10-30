import fetch from 'node-fetch'

const STRATEGIC_ENTITIES = [
  'TNI AD', 'TNI AL', 'TNI AU', 'TNI', 'Polri', 'Polisi', 'Polda', 'Polres',
  'Prabowo', 'Gibran', 'Jokowi', 'DPR', 'MPR', 'KPK', 'KPU', 'Bawaslu',
  'BMKG', 'BNPB', 'BEI', 'OJK', 'Kemhan', 'Dispenad', 'Pussiberad',
  'Papua', 'KKB', 'OPM', 'Ambalat', 'Trisakti', 'Patung Kuda', 'Istana Merdeka',
  'Ijazah', 'MBG', 'Bansos', 'Alutsista', 'Demo', 'Unjuk Rasa', 'Bentrok',
  'Ricuh', 'Kericuhan', 'Karhutla', 'Saham', 'Kapal Perang'
]

const JARGON_STRIP_REGEX = /\b(kontroversi|malam ini|soroti|polemik|buntut|imbau|waspada|peringatkan|minta|dampak|terkait|soal|blak-blakan|buka suara|angkat bicara|heboh|viral|geger|breaking news|dialog|live|update|terkini|terbaru|hari ini)\b/gi

function extractSmartEntities(headline) {
  if (!headline) return 'TNI AD viral'

  const clean = headline
    .replace(/^\[(HOAKS|SALAH|DISINFORMASI|PENIPUAN|FAKTA|KLARIFIKASI|MISLEADING)\]\s*/i, '')
    .trim()

  const matched = []
  for (const ent of STRATEGIC_ENTITIES) {
    const reg = new RegExp(`\\b${ent}\\b`, 'i')
    if (reg.test(clean) && !matched.some(m => m.toLowerCase().includes(ent.toLowerCase()))) {
      matched.push(ent)
    }
  }

  if (matched.length >= 2) {
    return matched.slice(0, 3).join(' ')
  }

  const stripped = clean.replace(JARGON_STRIP_REGEX, ' ').replace(/\s+/g, ' ').trim()
  const words = stripped
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !['yang', 'untuk', 'dengan', 'dalam', 'tidak', 'pada', 'dari', 'akan', 'dan', 'atau', 'jadi', 'ada'].includes(w.toLowerCase()))

  if (matched.length === 1) {
    const otherWords = words.filter(w => !matched[0].toLowerCase().includes(w.toLowerCase())).slice(0, 2)
    return [matched[0], ...otherWords].join(' ')
  }

  return words.slice(0, 3).join(' ') || clean.slice(0, 25)
}

async function testHarvester() {
  console.log('--- 1. Testing Entity-First NER Extraction ---')
  const testTitles = [
    'BEI minta investor Papua waspada indikasi manipulasi saham',
    'Kontroversi Malam Ini Soroti Polemik Ijazah Gibran dan Dampak Politik',
    '[HOAKS] Video Bentrokan Kapal Perang Malaysia dan TNI AL di Ambalat',
    'Demo Mahasiswa Trisakti di Patung Kuda Ricuh'
  ]

  for (const t of testTitles) {
    const entities = extractSmartEntities(t)
    console.log(`Headline: "${t}"`)
    console.log(`-> Extracted Entities: "${entities}"\n`)
  }

  console.log('--- 2. Testing YouTube Innertube with Sort Newest (&sp=CAI%3D) ---')
  const kw = 'Gibran Ijazah'
  const encQuery = encodeURIComponent(kw)
  const ytUrl = `https://www.youtube.com/results?search_query=${encQuery}&sp=CAI%253D`
  console.log(`Fetching: ${ytUrl}`)

  try {
    const res = await fetch(ytUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    const html = await res.text()
    const match = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/)
    if (match) {
      const json = JSON.parse(match[1])
      const contents = json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || []
      const videos = contents.filter(c => c.videoRenderer).map(c => c.videoRenderer)
      console.log(`Found ${videos.length} videos from YouTube!`)
      for (let i = 0; i < Math.min(3, videos.length); i++) {
        const v = videos[i]
        const title = v.title?.runs?.[0]?.text
        const channel = v.ownerText?.runs?.[0]?.text
        const views = v.viewCountText?.simpleText
        const published = v.publishedTimeText?.simpleText
        const videoId = v.videoId
        console.log(`  [${i+1}] "${title}"`)
        console.log(`      Channel: ${channel} | Views: ${views} | Uploaded: ${published}`)
        console.log(`      Direct Link: https://www.youtube.com/watch?v=${videoId}`)
      }
    } else {
      console.log('No ytInitialData found')
    }
  } catch (err) {
    console.error('YouTube fetch error:', err.message)
  }

  console.log('\n--- 3. Testing Real YouTube Comment Extraction ---')
  const testVid = 'DL_uVdliNw0'
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${testVid}`
    const wRes = await fetch(watchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    })
    const wHtml = await wRes.text()
    const apiKeyMatch = wHtml.match(/"INNERTUBE_API_KEY":"([^"]+)"/)
    const tokenMatch = wHtml.match(/"continuationCommand":\{"token":"([^"]+)"/)
    console.log('API Key matched:', !!apiKeyMatch, '| Continuation token matched:', !!tokenMatch)
    if (apiKeyMatch && tokenMatch) {
      const apiKey = apiKeyMatch[1]
      const token = tokenMatch[1]
      const nextRes = await fetch(`https://www.youtube.com/youtubei/v1/next?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: { client: { clientName: 'WEB', clientVersion: '2.20261028.01.00', hl: 'id', gl: 'ID' } },
          continuation: token
        })
      })
      const nextJson = await nextRes.json()
      const mutations = nextJson.frameworkUpdates?.entityBatchUpdate?.mutations || []
      const commentEntities = mutations.filter(m => m.payload?.commentEntityPayload)
      console.log(`Successfully extracted ${commentEntities.length} real comments!`)
      for (let i = 0; i < Math.min(5, commentEntities.length); i++) {
        const c = commentEntities[i].payload.commentEntityPayload
        console.log(`  [${i+1}] ${c.author?.displayName} (${c.properties?.publishedTime}): "${c.properties?.content?.content?.slice(0, 70)}..."`)
      }
    }
  } catch (err) {
    console.error('Comment error:', err.message)
  }

  console.log('\n--- 4. Testing Google News RSS for Demo / Civil Unrest ---')
  const newsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent('(demo OR unjuk rasa OR bentrok) when:2d')}&hl=id&gl=ID&ceid=ID:id`
  try {
    const res = await fetch(newsUrl)
    const xml = await res.text()
    const items = xml.split('<item>').slice(1, 4)
    console.log(`Found ${items.length} breaking news items!`)
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      const title = (it.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1]
      const link = (it.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/) || [])[1]
      const pubDate = (it.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1]
      console.log(`  [${i+1}] "${title}" (${pubDate})`)
    }
  } catch (err) {
    console.error('Google News fetch error:', err.message)
  }
}

testHarvester()
