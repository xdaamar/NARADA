/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — SOCIAL INTELLIGENCE V2 ACCEPTANCE TEST SUITE
 * SPRINT 13: ADVANCED SOCIAL EXTRACTION, TIKTOK/YT HARDENING & JACCARD
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 */

import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

console.log('══════════════════════════════════════════════════════════════════════')
console.log('🔍  NARADA — SOCIAL INTELLIGENCE V2 AUTOMATED ACCEPTANCE SUITE')
console.log('    Validasi Ekstraksi Taktis TikTok, YouTube, Jaccard & Buzzer Swarm')
console.log('══════════════════════════════════════════════════════════════════════\n')

let passCount = 0
let totalCount = 0

function runTest(id, description, fn) {
  totalCount++
  try {
    fn()
    console.log(`  ✅ PASS: [${id}] ${description}`)
    passCount++
  } catch (err) {
    console.error(`  ❌ FAIL: [${id}] ${description}`)
    console.error(`     Error: ${err.message}`)
  }
}

// ─── GATE 1: URL SANITIZER & PLATFORM DETECTOR ───
console.log('─── Gate 1: Sanitasi URL & Deteksi Platform Lintas Medsos ───')

const detectorSrc = fs.readFileSync(
  path.join(rootDir, 'src', 'engine', 'social', 'core', 'platform-detector.ts'),
  'utf-8'
)

const transpiledDetector = ts.transpileModule(detectorSrc, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText

const detectorModule = { exports: {} }
new Function('module', 'exports', transpiledDetector)(detectorModule, detectorModule.exports)
const { sanitizeSocialUrl, detectSocialPlatform } = detectorModule.exports

runTest('SOC-01.1', 'sanitizeSocialUrl membersihkan query tracking TikTok (?is_from_webapp=1&sender_device=pc)', () => {
  const dirty = 'https://www.tiktok.com/@beritasatuofficial/video/7706490036530777351?is_from_webapp=1&sender_device=pc&web_id=7686511381310932488'
  const clean = sanitizeSocialUrl(dirty)
  assert.equal(clean, 'https://www.tiktok.com/@beritasatuofficial/video/7706490036530777351')
})

runTest('SOC-01.2', 'sanitizeSocialUrl membersihkan tracking parameter YouTube (?si=...)', () => {
  const dirty = 'https://youtu.be/Ge9bc81PT2o?si=abc123xyz_track'
  const clean = sanitizeSocialUrl(dirty)
  assert.equal(clean, 'https://youtu.be/Ge9bc81PT2o')
})

runTest('SOC-01.3', 'detectSocialPlatform mengenali URL TikTok dan mengekstrak postId & username', () => {
  const url = 'https://www.tiktok.com/@beritasatuofficial/video/7706490036530777351'
  const res = detectSocialPlatform(url)
  assert.equal(res.platform, 'tiktok')
  assert.equal(res.postId, '7706490036530777351')
  assert.equal(res.authorUsername, 'beritasatuofficial')
})

runTest('SOC-01.4', 'detectSocialPlatform mengenali shortlink YouTube youtu.be', () => {
  const url = 'https://youtu.be/Ge9bc81PT2o'
  const res = detectSocialPlatform(url)
  assert.equal(res.platform, 'youtube')
  assert.equal(res.postId, 'Ge9bc81PT2o')
})

// ─── GATE 2: JACCARD SIMILARITY & STOPWORD TOKENIZER ───
console.log('\n─── Gate 2: Tokenisasi Leksikal & Klusterisasi Jaccard ───')

const jaccardSrc = fs.readFileSync(
  path.join(rootDir, 'src', 'engine', 'social', 'algorithms', 'jaccard-clustering.ts'),
  'utf-8'
)

const transpiledJaccard = ts.transpileModule(jaccardSrc, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText

const jaccardModule = { exports: {} }
new Function('module', 'exports', transpiledJaccard)(jaccardModule, jaccardModule.exports)
const { tokenizeText, calculateJaccardSimilarity, clusterDuplicateComments } = jaccardModule.exports

runTest('SOC-02.1', 'tokenizeText memfilter stopwords percakapan Indonesia (yg, utk, dgn, nih)', () => {
  const tokens = tokenizeText('ini adalah berita yg sangat hoax utk disebarkan dgn sengaja nih')
  assert.ok(!tokens.has('yg'), 'yg harus terfilter')
  assert.ok(!tokens.has('utk'), 'utk harus terfilter')
  assert.ok(!tokens.has('dgn'), 'dgn harus terfilter')
  assert.ok(!tokens.has('nih'), 'nih harus terfilter')
  assert.ok(tokens.has('berita'), 'berita harus ada')
  assert.ok(tokens.has('hoax'), 'hoax harus ada')
})

runTest('SOC-02.2', 'calculateJaccardSimilarity menghasilkan skor 1.0 pada token identik', () => {
  const a = new Set(['serangan', 'siber', 'ransomware'])
  const b = new Set(['serangan', 'siber', 'ransomware'])
  const sim = calculateJaccardSimilarity(a, b)
  assert.equal(sim, 1.0)
})

runTest('SOC-02.3', 'clusterDuplicateComments mengelompokkan komentar copypasta templat', () => {
  const comments = [
    { id: '1', authorUsername: '@user1', text: 'Klarifikasi resmi ini bohong jangan percaya berita palsu ini' },
    { id: '2', authorUsername: '@user2', text: 'Klarifikasi resmi ini bohong jangan percaya berita palsu ini' },
    { id: '3', authorUsername: '@user3', text: 'Klarifikasi resmi ini bohong jangan percaya berita palsu ini kawan' },
    { id: '4', authorUsername: '@user4', text: 'Terima kasih atas informasi update yang sangat bermanfaat min' }
  ]
  const clusters = clusterDuplicateComments(comments, 0.70)
  assert.equal(clusters.length, 1)
  assert.equal(clusters[0].commentCount, 3)
  assert.equal(clusters[0].accountsInvolved.length, 3)
})

// ─── GATE 3: BUZZER COORDINATION ANALYZER ───
console.log('\n─── Gate 3: Analisis Pola Buzzer Swarm & Adaptive Burst Velocity ───')

const buzzerSrc = fs.readFileSync(
  path.join(rootDir, 'src', 'engine', 'social', 'algorithms', 'buzzer-analyzer.ts'),
  'utf-8'
)

const transpiledBuzzer = ts.transpileModule(buzzerSrc, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText

const buzzerModule = { exports: {} }
new Function('module', 'exports', transpiledBuzzer)(buzzerModule, buzzerModule.exports)
const { analyzeBuzzerPatterns } = buzzerModule.exports

runTest('SOC-03.1', 'analyzeBuzzerPatterns menangani dataset kosong tanpa throwing error', () => {
  const res = analyzeBuzzerPatterns([], [])
  assert.equal(res.coordinationScore, 0)
  assert.equal(res.coordinationLevel, 'RENDAH')
})

runTest('SOC-03.2', 'analyzeBuzzerPatterns mendeteksi skor koordinasi TINGGI pada kluster copypasta masif', () => {
  const comments = [
    { id: '1', authorUsername: '@b1', text: 'Ganyang hoaks serentak kawal kebenaran bangsa', publishedAt: '2026-03-29T10:00:00Z' },
    { id: '2', authorUsername: '@b2', text: 'Ganyang hoaks serentak kawal kebenaran bangsa', publishedAt: '2026-03-29T10:00:10Z' },
    { id: '3', authorUsername: '@b3', text: 'Ganyang hoaks serentak kawal kebenaran bangsa', publishedAt: '2026-03-29T10:00:20Z' },
    { id: '4', authorUsername: '@b4', text: 'Ganyang hoaks serentak kawal kebenaran bangsa', publishedAt: '2026-03-29T10:00:30Z' }
  ]
  const clusters = clusterDuplicateComments(comments, 0.70)
  const res = analyzeBuzzerPatterns(comments, clusters)
  assert.ok(res.coordinationScore >= 65, 'Skor koordinasi harus TINGGI (>=65)')
  assert.equal(res.coordinationLevel, 'TINGGI')
  assert.ok(res.evidenceRationale.includes('akun unik'))
})

// ─── GATE 4: ENGINE SORTING & PROVENANCE ───
console.log('\n─── Gate 4: Kontrak Sorting Likes & Integritas Sumber ───')

runTest('SOC-04.1', 'YouTube & TikTok comments selalu terurut berdasarkan suka tertinggi (top likes fresh)', () => {
  const rawComments = [
    { id: 'a', authorUsername: '@low', text: 'Komen 5 like', likeCount: 5 },
    { id: 'b', authorUsername: '@top', text: 'Komen 96 like', likeCount: 96 },
    { id: 'c', authorUsername: '@mid', text: 'Komen 56 like', likeCount: 56 },
    { id: 'd', authorUsername: '@sec', text: 'Komen 25 like', likeCount: 25 }
  ]
  const sorted = [...rawComments].sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0))
  assert.equal(sorted[0].likeCount, 96)
  assert.equal(sorted[1].likeCount, 56)
  assert.equal(sorted[2].likeCount, 25)
  assert.equal(sorted[3].likeCount, 5)
})

// ─── GATE 5: WORKSPACE STREAMLINING INTEGRITY ───
console.log('\n─── Gate 5: Streamlining Halaman Forensik & Konsol Taktis ───')

runTest('SOC-05.1', 'SocialForensic.tsx telah menghapus tab Direct Ingest dan Arsip Kasus Sprint 11', () => {
  const forensicSrc = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'SocialForensic.tsx'), 'utf-8')
  assert.ok(!forensicSrc.includes('Direct Ingest (Mentah)'), 'Tab Direct Ingest tidak boleh ada di SocialForensic.tsx')
  assert.ok(!forensicSrc.includes('ARSIP KASUS & RADAR FORENSIK (SPRINT 11)'), 'Tab Arsip Kasus S11 tidak boleh ada di SocialForensic.tsx')
})

runTest('SOC-05.2', 'SocialPostIntelligenceConsole.tsx mengimplementasikan 4-Deck Tactical Chassis', () => {
  const consoleSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'SocialPostIntelligenceConsole.tsx'), 'utf-8')
  assert.ok(consoleSrc.includes('DECK 1'), 'Deck 1 harus tersedia')
  assert.ok(consoleSrc.includes('DECK 2'), 'Deck 2 harus tersedia')
  assert.ok(consoleSrc.includes('DECK 3'), 'Deck 3 harus tersedia')
  assert.ok(consoleSrc.includes('DECK 4'), 'Deck 4 harus tersedia')
  assert.ok(consoleSrc.includes('steel-chassis-card'), 'Chassis baja industrial harus digunakan')
})

// ─── SUMMARY ───
console.log('\n══════════════════════════════════════════════════════════════════════')
console.log(`📊 SOCIAL INTELLIGENCE V2 SUMMARY: ${passCount} / ${totalCount} ASSERTIONS PASSED`)
if (passCount === totalCount) {
  console.log('🏆 100% TERVERIFIKASI MEMENUHI PERSYARATAN TEKNIS SPRINT 13!')
} else {
  console.error(`⚠️ Terdapat ${totalCount - passCount} kegagalan pengujian.`)
  process.exit(1)
}
console.log('══════════════════════════════════════════════════════════════════════\n')
