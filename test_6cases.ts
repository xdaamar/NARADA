import { analyzeHybrid } from './src/engine/combiner'

const testCases = [
  {
    id: 1,
    title: 'Case 1: Gibran Dicopot',
    text: '[SALAH] WAPRES GIBRAN RESMI DICOPOT',
    expectedCategory: 'HOAKS',
    minConfidence: 90,
    maxConfidence: 98,
  },
  {
    id: 2,
    title: 'Case 2: Jokowi Gantikan Prabowo',
    text: 'Jokowidodo di angkat kembali menjadi presiden untuk menggantikan presiden prabowo',
    expectedCategory: 'HOAKS',
    minConfidence: 90,
    maxConfidence: 98,
  },
  {
    id: 3,
    title: 'Case 3: Katulampa Jebol',
    text: 'Waspada Bendungan Katulampa jebol air meluap ke Jakarta malam ini sebarkan cepat!',
    expectedCategory: 'HOAKS',
    minConfidence: 90,
    maxConfidence: 98,
  },
  {
    id: 4,
    title: 'Case 4: Gempa Megathrust Jam 23.00 BMKG',
    text: 'Peringatan BMKG gempa megathrust susulan malam ini jam 23.00 magnitudo 8.9 keluar rumah',
    expectedCategory: 'HOAKS',
    minConfidence: 90,
    maxConfidence: 98,
  },
  {
    id: 5,
    title: 'Case 5: Bansos 5 Juta Bitly',
    text: 'Pendaftaran bansos tunai 5 juta kemensos per KK buka tautan bit.ly/bansos-kemensos',
    expectedCategory: 'HOAKS',
    minConfidence: 90,
    maxConfidence: 98,
  },
  {
    id: 6,
    title: 'Case 6: Kerja Bakti Kodim Bersihkan Sungai',
    text: 'Prajurit Kodim bersama warga kerja bakti bersihkan sungai cegah banjir musim hujan',
    expectedCategory: 'NETRAL',
    minConfidence: 50,
    maxConfidence: 100,
  },
  {
    id: 7,
    title: 'Case 7: General BMKG Time Specific Earthquake Prediction (Knowledge Graph Anomaly Tier)',
    text: 'Pemberitahuan darurat BMKG gempa susulan terjadi tepat pukul 16.30 wib berkekuatan 9 SR jauhi pantai',
    expectedCategory: 'HOAKS',
    minConfidence: 90,
    maxConfidence: 98,
  },
  {
    id: 8,
    title: 'Case 8: Constitutional Logic Violation (Presiden copot Wapres)',
    text: 'Presiden secara sepihak telah mencopot dan memecat wakil presiden hari ini tanpa persidangan',
    expectedCategory: 'HOAKS',
    minConfidence: 90,
    maxConfidence: 98,
  },
]

console.log('=================================================================')
console.log('  UJI 6 SKENARIO MANDATORI - MASTER SPRINT 4A ACCURACY REVOLUTION')
console.log('=================================================================\n')

let allPassed = true

for (const tc of testCases) {
  const result = analyzeHybrid(tc.text)
  const categoryPass = result.category === tc.expectedCategory
  const confidencePass = result.confidence >= tc.minConfidence && result.confidence <= tc.maxConfidence
  const pass = categoryPass && confidencePass

  if (!pass) allPassed = false

  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${tc.title}`)
  console.log(`  Input: "${tc.text}"`)
  console.log(`  Kategori   : ${result.category} (Expected: ${tc.expectedCategory}) -> ${categoryPass ? 'OK' : 'MISMATCH'}`)
  console.log(`  Confidence : ${result.confidence}% (Range: ${tc.minConfidence}-${tc.maxConfidence}%) -> ${confidencePass ? 'OK' : 'MISMATCH'}`)
  console.log(`  Cluster    : ${result.spectrumCluster}`)
  console.log(`  Debunk     : ${result.debunkMatch ? `MATCH: ${result.debunkMatch.id}` : 'None'}`)
  console.log(`  Anomaly    : ${result.logicAnomaly ? `ANOMALY: ${result.logicAnomaly.anomalyType}` : 'None'}`)
  console.log(`  Scores     : ${JSON.stringify(result.scores)}`)
  console.log('-----------------------------------------------------------------')
}

console.log(`\nHASIL AKHIR UJI: ${allPassed ? '>>> SEMUA 6 KASUS LULUS 100% <<<' : '>>> ADA KASUS GAGAL <<<'}`)

if (!allPassed) {
  process.exit(1)
}
