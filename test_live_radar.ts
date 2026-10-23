import { parseTurnBackHoaxPost, type TurnBackHoaxPost } from './src/engine/data/live-radar-service'
import { registerLiveDebunks, getActiveDebunks, searchLocalDebunk } from './src/engine/data/debunk-service'
import { analyzeHybrid } from './src/engine/combiner'

console.log('=================================================================')
console.log('  TESTING LIVE RADAR SERVICE & DYNAMIC KNOWLEDGE INJECTION')
console.log('=================================================================\n')

// 1. Mock Live Post from TurnBackHoax.ID
const mockPost: TurnBackHoaxPost = {
  id: 99901,
  date: '2026-10-23T10:00:00',
  title: {
    rendered: '[SALAH] Bantuan Subsidi BBM 15 Juta Rupiah Dibagikan Melalui Tautan Pertamina'
  },
  excerpt: {
    rendered: '<p>Beredar narasi bahwa Pertamina membagikan subsidi BBM 15 juta rupiah melalui tautan bit.ly/subsidi-bbm.</p>'
  },
  content: {
    rendered: '<p>Berdasarkan penelusuran, klaim tersebut tidak benar. FAKTANYA: PT Pertamina (Persero) tidak pernah menyelenggarakan program pembagian subsidi BBM 15 juta rupiah melalui tautan tidak resmi. Seluruh informasi resmi hanya dipublikasikan di situs mypertamina.id. RUJUKAN: PT Pertamina (Persero).</p>'
  },
  link: 'https://turnbackhoax.id/2026/10/23/salah-subsidi-bbm-15-juta-pertamina/'
}

console.log('1. Testing IFCN Semantic Pattern Parser...')
const parsed = parseTurnBackHoaxPost(mockPost)
console.log('  Claim Parsed       :', parsed.claim)
console.log('  Verdict            :', parsed.verdict)
console.log('  Cluster Auto-Mapped:', parsed.cluster)
console.log('  Official Source    :', parsed.officialSource)
console.log('  Clarification Fact :', parsed.clarification)
console.log('  Is Live            :', parsed.isLive)

if (parsed.claim.includes('[SALAH]')) {
  console.error('FAIL: Tag prefix [SALAH] was not cleaned from claim!')
  process.exit(1)
}
if (parsed.cluster !== 'PENIPUAN_BANSOS') {
  console.error(`FAIL: Expected cluster PENIPUAN_BANSOS but got ${parsed.cluster}`)
  process.exit(1)
}
console.log('  -> IFCN Parser test PASSED!\n')

// 2. Testing Dynamic Knowledge Injection
console.log('2. Testing Dynamic Knowledge Injection into Active Pool...')
const poolBefore = getActiveDebunks().length
console.log(`  Active pool size before: ${poolBefore}`)

registerLiveDebunks([parsed])

const poolAfter = getActiveDebunks().length
console.log(`  Active pool size after: ${poolAfter}`)
if (poolAfter !== poolBefore + 1) {
  console.error('FAIL: Dynamic knowledge injection failed to increase pool size!')
  process.exit(1)
}

// 3. Testing Tier 1 Truth Priority Recognition on newly injected live claim
console.log('3. Testing Tier 1 Truth Priority on Injected Live Claim...')
const testInput = 'Bantuan Subsidi BBM 15 Juta Rupiah Dibagikan Melalui Tautan Pertamina buka sekarang'
const result = analyzeHybrid(testInput)

console.log('  Input       :', testInput)
console.log('  Verdict     :', result.category)
console.log('  Confidence  :', result.confidence + '%')
console.log('  Cluster     :', result.spectrumCluster)
console.log('  Debunk ID   :', result.debunkMatch?.id)
console.log('  Is Live Tag :', result.debunkMatch?.isLive)

if (result.category !== 'HOAKS') {
  console.error(`FAIL: Expected HOAKS but got ${result.category}`)
  process.exit(1)
}
if (result.confidence < 90 || result.confidence > 98) {
  console.error(`FAIL: Expected confidence between 90-98% but got ${result.confidence}%`)
  process.exit(1)
}
if (result.debunkMatch?.id !== 'TBH-LIVE-99901') {
  console.error(`FAIL: Expected match with TBH-LIVE-99901 but got ${result.debunkMatch?.id}`)
  process.exit(1)
}
if (result.debunkMatch?.isLive !== true) {
  console.error('FAIL: Expected isLive flag to be true!')
  process.exit(1)
}

console.log('\n>>> DYNAMIC KNOWLEDGE INJECTION & LIVE REASONING PASSED 100% <<<')
