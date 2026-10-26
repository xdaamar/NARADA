import { fetchLiveRadarDebunks } from '../src/engine/data/live-radar-service.ts'

async function runServiceTest() {
  console.log('🧪 Menguji fetchLiveRadarDebunks() Multi-Channel Pipeline...\n')
  const start = Date.now()
  const result = await fetchLiveRadarDebunks()
  const duration = Date.now() - start

  console.log(`Status Live     : ${result.isLive}`)
  console.log(`Source Channel  : ${result.sourceChannel}`)
  console.log(`Latency         : ${result.latencyMs}ms (Total: ${duration}ms)`)
  console.log(`Total Entries   : ${result.entries.length}`)

  if (result.entries.length === 0) {
    throw new Error('Tidak ada entri yang berhasil ditarik!')
  }

  // Periksa beberapa sample entri
  console.log('\n--- SAMPLE 3 ENTRI TERATAS ---')
  result.entries.slice(0, 3).forEach((item, idx) => {
    console.log(`\nEntri #${idx + 1}:`)
    console.log(`- ID           : ${item.id}`)
    console.log(`- Klaim        : ${item.claim}`)
    console.log(`- Vonis/Status : ${item.verdict}`)
    console.log(`- Klaster      : ${item.cluster}`)
    console.log(`- Sumber Resmi : ${item.officialSource}`)
    console.log(`- Canonical URL: ${item.sourceUrl}`)
    if (!item.sourceUrl.startsWith('http')) {
      throw new Error(`URL tidak valid pada entri: ${item.id}`)
    }
  })

  // Hitung distribusi status triage
  const statusCounts = {}
  result.entries.forEach(e => {
    statusCounts[e.verdict] = (statusCounts[e.verdict] || 0) + 1
  })
  console.log('\n--- DISTRIBUSI STATUS TRIAGE ---', statusCounts)

  console.log('\n✅ TAHAP 1 BERHASIL 100%: Pipeline Live RSS Multi-Channel Berfungsi!')
}

runServiceTest().catch(err => {
  console.error('❌ Gagal pengujian live-radar-service:', err)
  process.exit(1)
})
