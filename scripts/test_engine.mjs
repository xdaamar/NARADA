// Verification script for NARADA Hybrid Cognitive Engine
import { analyzeHybrid } from '../src/engine/combiner.ts'
import { tokenizeIndonesian } from '../src/engine/ml/tokenizer.ts'
import { extractClaimQuery } from '../src/engine/fact-checker.ts'

console.log('========================================================')
console.log('🔍 NARADA PHASE 1 COGNITIVE ENGINE BENCHMARK & DEBUG AUDIT')
console.log('========================================================\n')

const testCases = [
  {
    name: 'Kasus 1: Propaganda Separatis & Ancaman Teritorial',
    text: 'OPM dan KKB Papua membakar pos militer aparat TNI di Intan Jaya dan menuntut referendum kemerdekaan Papua merdeka sekarang!',
    expectedCategory: 'PROPAGANDA',
    expectedThreat: ['critical', 'high'],
  },
  {
    name: 'Kasus 2: Hoaks Fabrikasi Delegitimasi Alutsista',
    text: 'Info A1 orang dalam: Rahasia korupsi alutsista rongsokan di tubuh TNI AD akhirnya terbongkar, viralkan sebelum dihapus aparat!',
    expectedCategory: ['HOAKS', 'DISINFORMASI'],
    expectedThreat: ['critical', 'high'],
  },
  {
    name: 'Kasus 3: Agitasi Buzzer & Pengerahan Massa Siber',
    text: 'Viralkan tagar serbu akun pimpinan dan boikot sekarang juga, jangan biarkan rezim tenang, trendingkan bersama!',
    expectedCategory: 'BUZZER',
    expectedThreat: ['medium', 'high', 'critical'],
  },
  {
    name: 'Kasus 4: Siaran Berita Resmi / Kegiatan Teritorial Netral',
    text: 'Prajurit TNI AD bersama BSSN dan Kemhan menyelenggarakan kegiatan bakti sosial dan latihan bersama pengamanan teritorial untuk memperkuat kedaulatan NKRI.',
    expectedCategory: 'NETRAL',
    expectedThreat: ['low'],
  },
]

let passedCount = 0
let totalExecutionTime = 0

for (let i = 0; i < testCases.length; i++) {
  const tc = testCases[i]
  const start = performance.now()
  const result = analyzeHybrid(tc.text)
  const duration = performance.now() - start
  totalExecutionTime += duration

  const catMatch = Array.isArray(tc.expectedCategory)
    ? tc.expectedCategory.includes(result.category)
    : result.category === tc.expectedCategory

  const threatMatch = tc.expectedThreat.includes(result.threatLevel)
  const isPassed = catMatch && threatMatch

  if (isPassed) passedCount++

  console.log(`[${isPassed ? '✅ PASS' : '❌ FAIL'}] ${tc.name}`)
  console.log(`   ⏱️ Waktu Eksekusi   : ${duration.toFixed(2)} ms`)
  console.log(`   🏷️ Kategori Hasil   : ${result.category} (Harapan: ${JSON.stringify(tc.expectedCategory)})`)
  console.log(`   🚨 Tingkat Ancaman  : ${result.threatLevel.toUpperCase()} (Confidence: ${result.confidence}%)`)
  console.log(`   📊 Skor Fusi        : ML ${result.mlScore}% | Rule ${result.ruleScore}%`)
  console.log(`   🎯 Entitas Sasaran  : ${result.targetedEntities.length ? result.targetedEntities.join(', ') : 'Tidak ada'}`)
  console.log(`   🔑 Kata Kunci       : ${result.keywords.slice(0, 4).join(', ') || 'N/A'}`)
  console.log(`   💬 Explainability   : ${result.explanation.substring(0, 95)}...`)
  console.log(`   🔎 Claim Query      : "${extractClaimQuery(tc.text)}"`)
  console.log('--------------------------------------------------------')
}

console.log(`\n📋 RINGKASAN AUDIT KINERJA:`)
console.log(`- Total Kasus Uji  : ${testCases.length}`)
console.log(`- Berhasil         : ${passedCount}/${testCases.length}`)
console.log(`- Rata-rata Latensi: ${(totalExecutionTime / testCases.length).toFixed(2)} ms per analisis (Target: < 50ms)`)

if (passedCount === testCases.length && (totalExecutionTime / testCases.length) < 50) {
  console.log('\n🎉 SEMUA PENGUJIAN COGNITIVE ENGINE LOLOS DENGAN OPTIMAL!\n')
  process.exit(0)
} else {
  console.error('\n⚠️ TERDAPAT KETIDAKSESUAIAN YANG MEMERLUKAN PENYESUAIAN!\n')
  process.exit(1)
}
