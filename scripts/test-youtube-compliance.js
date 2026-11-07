/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — GATE L: YOUTUBE DATA GOVERNANCE & COMPLIANCE ACCEPTANCE SUITE
 * SPRINT 11 MANDATORY AUDIT ADDENDUM (SECTIONS III.E.2, III.E.4, III.A & II)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 */

import assert from 'node:assert'
import {
  YOUTUBE_CAPABILITY_GATES,
  evaluateYouTubeCapability
} from '../src/engine/acquisition/source-contracts.ts'
import {
  youtubeRetentionManager,
  YOUTUBE_MAX_RETENTION_DAYS,
  YOUTUBE_MAX_RETENTION_MS,
  YOUTUBE_TERMS_OF_SERVICE_URL,
  GOOGLE_PRIVACY_POLICY_URL,
  GOOGLE_SECURITY_SETTINGS_REVOCATION_URL,
  YOUTUBE_API_SERVICES_DISCLOSURE,
  YOUTUBE_INDEPENDENT_ANALYSIS_DISCLAIMER,
  YOUTUBE_DATA_PROCESSING_PURPOSE,
  YOUTUBE_CREDENTIAL_STORAGE_SAFEGUARD
} from '../src/engine/acquisition/youtube-retention.ts'
import {
  youtubeConnector
} from '../src/engine/acquisition/youtube-connector.ts'
import {
  routeDiscoveryCandidate
} from '../src/engine/acquisition/discovery-router.ts'
import {
  evaluateCoordinationPattern
} from '../src/engine/intelligence/coordination-engine.ts'
import sqliteService from '../electron/sqlite-service.cjs'

let totalPassed = 0
let totalFailed = 0

function test(condition, code, description) {
  try {
    assert(condition, `${code}: ${description}`)
    console.log(`  ✅ PASS: [${code}] ${description}`)
    totalPassed++
  } catch (err) {
    console.error(`  ❌ FAIL: [${code}] ${description} -> ${err.message}`)
    totalFailed++
  }
}

async function runGateLSuite() {
  console.log('\n══════════════════════════════════════════════════════════════════════')
  console.log('⚖️  NARADA — GATE L: YOUTUBE DATA GOVERNANCE & COMPLIANCE SUITE')
  console.log('══════════════════════════════════════════════════════════════════════\n')

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-GATE L01: CROSS-CHANNEL DATA AGGREGATION GUARD (SECTION III.E.2)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('─── Sub-Gate L01: Cross-Channel Data Aggregation Guard (Section III.E.2) ───')

  const gateCrossComment = YOUTUBE_CAPABILITY_GATES.YOUTUBE_CROSS_CHANNEL_COMMENT_AGGREGATION
  test(gateCrossComment && gateCrossComment.status === 'POLICY_BLOCKED', 'S11-L01.1', 'Agregasi komentar lintas kanal berstatus POLICY_BLOCKED')
  test(gateCrossComment.policySection === 'SECTION_III_E_2_DATA_AGGREGATION', 'S11-L01.2', 'Dasar hukum merujuk Section III.E.2 Data Aggregation')

  const gateCrossSentiment = YOUTUBE_CAPABILITY_GATES.YOUTUBE_CROSS_CHANNEL_SENTIMENT_COMBINATION
  test(gateCrossSentiment && gateCrossSentiment.status === 'POLICY_BLOCKED', 'S11-L01.3', 'Kombinasi sentimen lintas kanal berstatus POLICY_BLOCKED')

  const gateCrossStats = YOUTUBE_CAPABILITY_GATES.YOUTUBE_CROSS_CHANNEL_ISSUE_STATISTICS
  test(gateCrossStats && gateCrossStats.status === 'POLICY_BLOCKED', 'S11-L01.4', 'Statistik agregat tingkat isu multi-kanal berstatus POLICY_BLOCKED')

  const valAgg2Channels = youtubeRetentionManager.validateCommentAggregation(['channel-A', 'channel-B'])
  test(valAgg2Channels.permitted === false, 'S11-L01.5', 'Validasi agregasi 2 kanal berbeda ditolak tegas')
  test(valAgg2Channels.status === 'POLICY_BLOCKED', 'S11-L01.6', 'Status penolakan 2 kanal adalah POLICY_BLOCKED')
  test(valAgg2Channels.distinctChannelCount === 2, 'S11-L01.7', 'Jumlah kanal berbeda terdeteksi tepat (2 kanal)')

  // Uji Mesin Pola Koordinasi dengan Komentar Multi-Kanal YouTube
  const mockCoordCommentsMultiYt = [
    { id: 'c1', batchId: 'b1', caseId: 'cs1', rawText: 'Pernyataan A', normalizedText: 'pernyataan a', sourceUrl: 'https://youtube.com/watch?v=1', metadata: { channelId: 'ch-alpha', platform: 'youtube' }, isTimestampAmbiguous: false, validationState: 'VALID', contentDigest: 'd1', characterCount: 12, tokenCount: 2 },
    { id: 'c2', batchId: 'b1', caseId: 'cs1', rawText: 'Pernyataan B', normalizedText: 'pernyataan b', sourceUrl: 'https://youtube.com/watch?v=2', metadata: { channelId: 'ch-beta', platform: 'youtube' }, isTimestampAmbiguous: false, validationState: 'VALID', contentDigest: 'd2', characterCount: 12, tokenCount: 2 }
  ]
  const coordResMulti = evaluateCoordinationPattern(mockCoordCommentsMultiYt, [], { status: 'INSUFFICIENT_DATA', detectedBursts: [], explanation: '' })
  test(coordResMulti.indicator === 'POLICY_BLOCKED', 'S11-L01.8', 'Evaluasi koordinasi komentar multi-kanal YouTube diblokir POLICY_BLOCKED')
  test(coordResMulti.isPolicyBlocked === true, 'S11-L01.9', 'Flag isPolicyBlocked bernilai true')
  test(coordResMulti.policyBlockReason === 'YOUTUBE_POLICY_III_E_2_CROSS_CHANNEL_AGGREGATION_RESTRICTED', 'S11-L01.10', 'Kode alasan penolakan cocok presisi')

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-GATE L02: CROSS-PLATFORM METRICS COMBINATION FIREWALL
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n─── Sub-Gate L02: Cross-Platform Metrics Combination Firewall ───')

  const gateCrossPlatMetrics = YOUTUBE_CAPABILITY_GATES.YOUTUBE_CROSS_PLATFORM_METRICS_COMBINATION
  test(gateCrossPlatMetrics && gateCrossPlatMetrics.status === 'POLICY_BLOCKED', 'S11-L02.1', 'Penggabungan metrik lintas platform berstatus POLICY_BLOCKED')

  const gateCrossPlatCoord = YOUTUBE_CAPABILITY_GATES.YOUTUBE_CROSS_PLATFORM_COORDINATION_INDICATORS
  test(gateCrossPlatCoord && gateCrossPlatCoord.status === 'POLICY_BLOCKED', 'S11-L02.2', 'Indikator koordinasi lintas platform dengan YouTube berstatus POLICY_BLOCKED')

  const valCrossPlat = youtubeRetentionManager.validateCrossPlatformCombination(['youtube', 'tiktok', 'x'])
  test(valCrossPlat.permitted === false, 'S11-L02.3', 'Pencampuran YouTube dengan platform lain ditolak')
  test(valCrossPlat.status === 'POLICY_BLOCKED', 'S11-L02.4', 'Status penolakan pencampuran adalah POLICY_BLOCKED')

  // Uji Mesin Pola Koordinasi dengan Komentar Campuran Lintas Platform
  const mockCoordMixedPlatform = [
    { id: 'c1', batchId: 'b1', caseId: 'cs1', rawText: 'Pernyataan YT', normalizedText: 'pernyataan yt', sourceUrl: 'https://youtube.com/watch?v=1', metadata: { channelId: 'ch-alpha', platform: 'youtube' }, isTimestampAmbiguous: false, validationState: 'VALID', contentDigest: 'd1', characterCount: 13, tokenCount: 2 },
    { id: 'c2', batchId: 'b1', caseId: 'cs1', rawText: 'Pernyataan TT', normalizedText: 'pernyataan tt', sourceUrl: 'https://tiktok.com/@user/1', metadata: { platform: 'tiktok' }, isTimestampAmbiguous: false, validationState: 'VALID', contentDigest: 'd2', characterCount: 13, tokenCount: 2 }
  ]
  const coordResMixed = evaluateCoordinationPattern(mockCoordMixedPlatform, [], { status: 'INSUFFICIENT_DATA', detectedBursts: [], explanation: '' })
  test(coordResMixed.indicator === 'POLICY_BLOCKED', 'S11-L02.5', 'Pencampuran data YouTube dengan komentar platform lain diblokir')
  test(coordResMixed.policyBlockReason === 'YOUTUBE_POLICY_III_E_2_CROSS_PLATFORM_COMBINATION_RESTRICTED', 'S11-L02.6', 'Alasan blokir lintas platform tercatat akurat')

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-GATE L03: PER-RESOURCE / PER-CHANNEL PERMITTED OPERATIONS
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n─── Sub-Gate L03: Per-Resource / Per-Channel Permitted Operations ───')

  const evalVideoMeta = evaluateYouTubeCapability('YOUTUBE_SINGLE_VIDEO_METADATA')
  test(evalVideoMeta.isPermitted === true, 'S11-L03.1', 'Pengambilan metadata video tunggal diizinkan (PERMITTED)')

  const evalVideoComments = evaluateYouTubeCapability('YOUTUBE_SINGLE_VIDEO_COMMENTS')
  test(evalVideoComments.isPermitted === true, 'S11-L03.2', 'Pengambilan komentar video tunggal diizinkan (PERMITTED)')

  const evalSingleChannel = evaluateYouTubeCapability('YOUTUBE_SINGLE_CHANNEL_ANALYSIS')
  test(evalSingleChannel.isPermitted === true, 'S11-L03.3', 'Analisis kanal tunggal diizinkan (PERMITTED)')

  const valSingleChannelAgg = youtubeRetentionManager.validateCommentAggregation(['channel-A', 'channel-A'])
  test(valSingleChannelAgg.permitted === true, 'S11-L03.4', 'Validasi komentar dalam 1 kanal yang sama diizinkan')
  test(valSingleChannelAgg.distinctChannelCount === 1, 'S11-L03.5', 'Jumlah kanal tunggal terhitung 1')

  const connectorPermitted = youtubeConnector.isCapabilityPermitted('YOUTUBE_SINGLE_VIDEO_METADATA')
  test(connectorPermitted === true, 'S11-L03.6', 'Metode isCapabilityPermitted pada YouTubeConnector merespons true')

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-GATE L04: API CLIENT TERMS, PRIVACY & USER RIGHTS (SECTION III.A)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n─── Sub-Gate L04: API Client Terms, Privacy & User Rights (Section III.A) ───')

  test(YOUTUBE_TERMS_OF_SERVICE_URL === 'https://www.youtube.com/t/terms', 'S11-L04.1', 'Tautan Ketentuan Layanan YouTube valid HTTPS resmi')
  test(GOOGLE_PRIVACY_POLICY_URL.includes('google.com/policies/privacy'), 'S11-L04.2', 'Tautan Kebijakan Privasi Google tersedia')
  test(GOOGLE_SECURITY_SETTINGS_REVOCATION_URL.includes('security.google.com/settings/security/permissions'), 'S11-L04.3', 'Tautan pencabutan izin otorisasi Google tersedia')
  test(YOUTUBE_API_SERVICES_DISCLOSURE.includes('YouTube API Services'), 'S11-L04.4', 'Pengungkapan penggunaan YouTube API Services termuat eksplisit')
  test(YOUTUBE_DATA_PROCESSING_PURPOSE.includes('disinformasi'), 'S11-L04.5', 'Tujuan pemrosesan data publik tercatat transparan')

  const docs = youtubeRetentionManager.getComplianceDocumentation()
  test(docs.termsOfServiceUrl && docs.googlePrivacyPolicyUrl, 'S11-L04.6', 'Objek dokumentasi kepatuhan mengembalikan seluruh tautan wajib')

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-GATE L05: CREDENTIAL SECURITY & SCOPE SAFEGUARD
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n─── Sub-Gate L05: Credential Security & Scope Safeguard ───')

  test(YOUTUBE_CREDENTIAL_STORAGE_SAFEGUARD.includes('TIDAK PERNAH mengumpulkan'), 'S11-L05.1', 'Prinsip zero login credential tertera dalam safeguard')
  test(youtubeConnector.supportedCapabilities.includes('VIDEO_METADATA'), 'S11-L05.2', 'Hanya kapabilitas read-only publik yang didukung')
  test(!youtubeConnector.supportedCapabilities.includes('WRITE_DATA'), 'S11-L05.3', 'Zero write scope: tidak meminta izin mutasi data pengguna')

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-GATE L06: YOUTUBE CONTENT ATTRIBUTION (SECTION II)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n─── Sub-Gate L06: YouTube Content Attribution (Section II) ───')

  test(YOUTUBE_INDEPENDENT_ANALYSIS_DISCLAIMER.includes('BUKAN merupakan pernyataan resmi'), 'S11-L06.1', 'Disclaimer analisis independen mencegah penyesatan atribusi resmi')

  // Uji kandidat discovery YouTube memuat bendera atribusi
  const mockYtCandidate = {
    id: 'yt-test-cand-001',
    providerId: 'youtube-official-api',
    queryId: 'q-yt-1',
    targetPlatform: 'youtube',
    originalUrl: 'https://www.youtube.com/watch?v=test001',
    canonicalUrl: 'https://www.youtube.com/watch?v=test001',
    title: 'Uji Penanganan Disinformasi Militer Terkini',
    snippet: 'Panglima TNI membantah kabar pembatalan latihan tempur gabungan di wilayah perbatasan laut.',
    publishedAt: Date.now() - 3600000,
    publishedAtPrecision: 'EXACT',
    indexedAt: Date.now(),
    discoveredAt: Date.now(),
    searchRank: 1,
    contentStatus: 'SNIPPET_ONLY',
    relevanceStatus: 'PENDING',
    ingestionStatus: 'DISCOVERED',
    provenance: {
      recordId: 'prov-yt-test001',
      connectorId: 'src-youtube-api',
      providerId: 'youtube-official-api',
      platform: 'youtube',
      originalUrl: 'https://www.youtube.com/watch?v=test001',
      canonicalUrl: 'https://www.youtube.com/watch?v=test001',
      queryMethod: 'search.list',
      acquiredAt: Date.now(),
      publishedAt: Date.now() - 3600000,
      publishedAtPrecision: 'EXACT',
      indexedAt: Date.now(),
      firstDiscoveredAt: Date.now(),
      lastObservedAt: Date.now(),
      lastContentValidatedAt: null,
      contentCompleteness: 'TITLE_AND_SNIPPET',
      sourceAccessState: 'PUBLIC',
      validationState: 'PENDING',
      deduplicationState: 'UNIQUE'
    },
    limitations: [],
    isProvisional: true
  }

  const routeRes = await routeDiscoveryCandidate(mockYtCandidate)
  test(routeRes.candidate.attributionRequired === true, 'S11-L06.2', 'Hasil routing kandidat YouTube mewajibkan atribusi merek (attributionRequired: true)')
  test(routeRes.candidate.isCrossChannelAggregationProhibited === true, 'S11-L06.3', 'Hasil routing kandidat YouTube mengunci larangan agregasi lintas kanal')

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-GATE L07: 30-DAY RETENTION LIMIT ENFORCEMENT (SECTION III.E.4)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n─── Sub-Gate L07: 30-Day Retention Limit Enforcement (Section III.E.4) ───')

  test(YOUTUBE_MAX_RETENTION_DAYS === 30, 'S11-L07.1', 'Batas retensi tepat 30 hari kalender')
  test(YOUTUBE_MAX_RETENTION_MS === 30 * 24 * 60 * 60 * 1000, 'S11-L07.2', 'Konstanta retensi tepat 2.592.000.000 ms')

  const T0 = 1700000000000 // Waktu acuan deterministik
  const deadLine = youtubeRetentionManager.calculateRetentionDeadline(T0)
  test(deadLine === T0 + YOUTUBE_MAX_RETENTION_MS, 'S11-L07.3', 'Kalkulasi deadline retensi tepat T0 + 30 hari')

  // Uji Clock-based Deterministic Expiration
  const freshRecord = { acquiredAt: T0, targetPlatform: 'youtube' }
  test(youtubeRetentionManager.isRecordExpired(freshRecord, T0) === false, 'S11-L07.4', 'Data pada T=0 berstatus aktif (tidak kedaluwarsa)')

  const day29 = T0 + (29 * 24 * 60 * 60 * 1000)
  test(youtubeRetentionManager.isRecordExpired(freshRecord, day29) === false, 'S11-L07.5', 'Data pada hari ke-29 masih aktif')

  const day30Exact = T0 + (30 * 24 * 60 * 60 * 1000)
  test(youtubeRetentionManager.isRecordExpired(freshRecord, day30Exact) === true, 'S11-L07.6', 'Data tepat pada hari ke-30 terdeteksi kedaluwarsa')

  const day35 = T0 + (35 * 24 * 60 * 60 * 1000)
  test(youtubeRetentionManager.isRecordExpired(freshRecord, day35) === true, 'S11-L07.7', 'Data pada hari ke-35 terdeteksi kedaluwarsa')

  // Uji Penolakan Routing pada Kandidat Kedaluwarsa
  const expiredCandidate = {
    ...mockYtCandidate,
    id: 'yt-expired-cand-002',
    discoveredAt: T0,
    acquiredAt: T0
  }
  const routeExpiredRes = await routeDiscoveryCandidate(expiredCandidate)
  test(routeExpiredRes.isAccepted === false, 'S11-L07.8', 'Routing menolak kandidat YouTube yang telah melampaui 30 hari')
  test(routeExpiredRes.candidate.ingestionStatus === 'REJECTED', 'S11-L07.9', 'Ingestion status kandidat kedaluwarsa adalah REJECTED')
  test(routeExpiredRes.rejectionReason?.includes('kedaluwarsa'), 'S11-L07.10', 'Alasan penolakan menyebutkan kedaluwarsa per Section III.E.4')

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-GATE L08: USER DELETION REQUEST & DATABASE PURGE ENFORCEMENT
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n─── Sub-Gate L08: User Deletion Request & Database Purge Enforcement ───')

  sqliteService.initSqliteDatabase(':memory:')

  // Simpan 2 kandidat: 1 aktif dan 1 kedaluwarsa (> 30 hari)
  const nowClock = Date.now()
  const candActive = {
    ...mockYtCandidate,
    id: 'yt-cand-live-active',
    discoveredAt: nowClock - 1000,
    targetPlatform: 'youtube'
  }
  const candStale = {
    ...mockYtCandidate,
    id: 'yt-cand-stale-expired',
    discoveredAt: nowClock - (31 * 24 * 60 * 60 * 1000), // 31 hari lalu
    targetPlatform: 'youtube'
  }

  sqliteService.saveDiscoveryCandidate(candActive)
  sqliteService.saveDiscoveryCandidate(candStale)

  const initialList = sqliteService.getDiscoveryCandidates('youtube')
  test(initialList.length === 2, 'S11-L08.1', 'Kedua kandidat YouTube awal berhasil tersimpan di SQLite')

  // Eksekusi pembersihan kedaluwarsa (> 30 hari)
  const cutoff30d = nowClock - YOUTUBE_MAX_RETENTION_MS
  const purgeRes = sqliteService.purgeExpiredYouTubeData(cutoff30d)
  test(purgeRes.success === true, 'S11-L08.2', 'Operasi purgeExpiredYouTubeData berhasil dieksekusi')
  test(purgeRes.deletedCount === 1, 'S11-L08.3', 'Tepat 1 rekaman kedaluwarsa dihapus')

  const postPurgeList = sqliteService.getDiscoveryCandidates('youtube')
  test(postPurgeList.length === 1, 'S11-L08.4', 'Tersisa tepat 1 kandidat aktif pasca pembersihan kedaluwarsa')
  test(postPurgeList[0].id === 'yt-cand-live-active', 'S11-L08.5', 'Kandidat aktif dipertahankan dengan aman')

  // Eksekusi User Deletion Request (Purge All)
  const purgeAllRes = sqliteService.purgeAllYouTubeData()
  test(purgeAllRes.success === true && purgeAllRes.deletedCount === 1, 'S11-L08.6', 'Penghapusan seluruh data YouTube (User Deletion) berhasil')

  const emptyList = sqliteService.getDiscoveryCandidates('youtube')
  test(emptyList.length === 0, 'S11-L08.7', 'Seluruh data YouTube bersih tanpa kebocoran residu cache')

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-GATE L09: CAPABILITY GATE BYPASS PREVENTION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n─── Sub-Gate L09: Capability Gate Bypass Prevention ───')

  // Uji kapabilitas tidak dikenal / belum disetujui
  const unapprovedCap = evaluateYouTubeCapability('UNAPPROVED_ARBITRARY_ACTION')
  test(unapprovedCap.isPermitted === false, 'S11-L09.1', 'Kapabilitas sembarang tidak dikenal ditolak')
  test(unapprovedCap.status === 'APPROVAL_REQUIRED', 'S11-L09.2', 'Kapabilitas tanpa dasar hukum berstatus APPROVAL_REQUIRED')

  // Uji manipulasi parameter: mencoba bypass cross-channel pada kapabilitas tunggal
  const bypassAttempt = evaluateYouTubeCapability('YOUTUBE_SINGLE_VIDEO_COMMENTS', {
    isCrossChannel: true,
    channelIds: ['ch-attacker-1', 'ch-attacker-2']
  })
  test(bypassAttempt.isPermitted === false, 'S11-L09.3', 'Percobaan bypass kapabilitas tunggal dengan multi-kanal ditolak keras')
  test(bypassAttempt.status === 'POLICY_BLOCKED', 'S11-L09.4', 'Status hasil upaya bypass adalah POLICY_BLOCKED')

  // ──────────────────────────────────────────────────────────────────────────
  // FINAL GATE VERIFICATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n─── Final Gate Verification: GATE L ───')
  test(totalFailed === 0, 'S11-L10.1', 'Seluruh pengujian tata kelola dan kepatuhan YouTube API Services lulus tanpa kegagalan')
  test(totalPassed >= 40, 'S11-L10.2', `Total asersi lulus memadai (${totalPassed} assertions)`)

  console.log('\n══════════════════════════════════════════════════════════════════════')
  console.log(`🏆 TOTAL GATE L ASSERTIONS: ${totalPassed + totalFailed}`)
  console.log(`   ✅ PASS: ${totalPassed}`)
  console.log(`   ❌ FAIL: ${totalFailed}`)
  console.log('══════════════════════════════════════════════════════════════════════\n')

  if (totalFailed > 0) {
    process.exit(1)
  }
  process.exit(0)
}

runGateLSuite().catch(err => {
  console.error('Fatal GATE L Test Suite Exception:', err)
  process.exit(1)
})
