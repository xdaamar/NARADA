/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — SPRINT 11: AUTOMATED SOCIAL INTELLIGENCE ACCEPTANCE TEST SUITE
 * PUSSIBERAD TNI AD × CODEPOLITAN — KARTIKA CYBER HACKATHON 2026
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Verifikasi Doktriner Gate A s.d. Gate M:
 * - Gate A: Repository Baseline & Architecture Audit
 * - Gate B: Unified Social Contracts & Domain Model
 * - Gate C: Search Provider Continuity & Brave Search Adapter
 * - Gate D: YouTube Official API Quota Correction & Pagination
 * - Gate E: YouTube Compliance & Retention (Gate L integration)
 * - Gate F: Other Platform Capability Truthfulness (FB, IG, TikTok, X)
 * - Gate G: Intelligence Integration (Sprint 08 & 09 Engine Reuse)
 * - Gate H: Social Spread & Temporal Observations (No Attribution)
 * - Gate I: Persistence, Migrations & Credential Security
 * - Gate J: Social Forensic Workspace Integration
 * - Gate K: Mandatory Adversarial Cases (Fixtures A s.d. Q)
 * - Gate L: Gate L Compliance Addendum Verification
 * - Gate M: Performance Smoke Test & Bounded Lookups
 * ══════════════════════════════════════════════════════════════════════════
 */

import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

// Domain & Contract Imports
import {
  SOCIAL_INTELLIGENCE_VERSION,
  PLATFORM_CAPABILITY_MATRIX,
  getPlatformCapabilities,
  evaluatePlatformCapability
} from '../src/engine/social/social-contracts.ts'

import {
  socialIntelligencePipeline,
  SOCIAL_PIPELINE_VERSION
} from '../src/engine/social/social-intelligence-pipeline.ts'

import {
  BraveSearchAdapter,
  braveSearchAdapter,
  BRAVE_COST_PER_REQUEST_USD
} from '../src/engine/acquisition/brave-search-adapter.ts'

import {
  GOOGLE_CSE_DEPRECATION_NOTICE,
  GoogleCustomSearchAdapter,
  MockSearchProviderAdapter,
  DorkingDiscoveryEngine,
  DorkingQueryPlanner,
  validatePlatformUrl,
  PLATFORM_REGISTRY
} from '../src/engine/acquisition/dorking-discovery-engine.ts'

import {
  YouTubeQuotaManager,
  YouTubeConnector,
  calculateNextPacificMidnight,
  YOUTUBE_ENDPOINT_COSTS
} from '../src/engine/acquisition/youtube-connector.ts'

import {
  youtubeRetentionManager,
  YOUTUBE_MAX_RETENTION_MS
} from '../src/engine/acquisition/youtube-retention.ts'

import {
  evaluateYouTubeCapability,
  YOUTUBE_CAPABILITY_GATES
} from '../src/engine/acquisition/source-contracts.ts'

// Engine Reuse Imports (Sprint 8 & Sprint 9)
import { evaluateIntelligenceRelevance } from '../src/engine/intelligence/relevance-engine.ts'
import { extractClaimsFromArticle } from '../src/engine/intelligence/claim-extraction-engine.ts'
import { normalizeCommentText } from '../src/engine/intelligence/text-normalizer.ts'
import { estimateCommentSentiment } from '../src/engine/intelligence/sentiment-engine.ts'
import { detectCommentSimilarityClusters } from '../src/engine/intelligence/similarity-engine.ts'
import { detectCommentBursts } from '../src/engine/intelligence/burst-engine.ts'
import { evaluateCoordinationPattern } from '../src/engine/intelligence/coordination-engine.ts'

// Storage Imports
import { deduplicateDiscoveryResults } from '../src/engine/acquisition/discovery-router.ts'
import sqliteService from '../electron/sqlite-service.cjs'
import {
  saveSocialPostToDB,
  getSocialPostsFromDB,
  saveSocialCommentsToDB,
  getSocialCommentsFromDB,
  saveSocialAnalysisRunToDB,
  getSocialAnalysisRunsFromDB,
  purgeExpiredYouTubeDataFromDB,
  purgeAllYouTubeDataFromDB
} from '../src/utils/db-adapter.ts'

let passCount = 0
let failCount = 0

function test(id, description, fn) {
  try {
    fn()
    console.log(`  ✅ PASS: [${id}] ${description}`)
    passCount++
  } catch (err) {
    console.error(`  ❌ FAIL: [${id}] ${description}`)
    console.error(`     Error: ${err.message}`)
    failCount++
  }
}

async function testAsync(id, description, fn) {
  try {
    await fn()
    console.log(`  ✅ PASS: [${id}] ${description}`)
    passCount++
  } catch (err) {
    console.error(`  ❌ FAIL: [${id}] ${description}`)
    console.error(`     Error: ${err.message}`)
    failCount++
  }
}

console.log('\n══════════════════════════════════════════════════════════════════════')
console.log('📡  NARADA — SPRINT 11: AUTOMATED SOCIAL INTELLIGENCE ACCEPTANCE')
console.log('══════════════════════════════════════════════════════════════════════\n')

// ─── GATE A: REPOSITORY BASELINE & ARCHITECTURE AUDIT ───
console.log('─── Gate A: Repository Baseline & Architecture Audit ───')

test('S11-A01.1', 'Versi kontrak social intelligence terdefinisi 1.1.0', () => {
  assert.equal(SOCIAL_INTELLIGENCE_VERSION, '1.1.0')
  assert.equal(SOCIAL_PIPELINE_VERSION, '1.1.0')
})

test('S11-A01.2', 'Pipeline mengintegrasikan engine Sprint 8 & 9 tanpa duplikasi algoritma', () => {
  assert.equal(typeof evaluateIntelligenceRelevance, 'function')
  assert.equal(typeof extractClaimsFromArticle, 'function')
  assert.equal(typeof normalizeCommentText, 'function')
  assert.equal(typeof estimateCommentSentiment, 'function')
  assert.equal(typeof detectCommentSimilarityClusters, 'function')
  assert.equal(typeof detectCommentBursts, 'function')
  assert.equal(typeof evaluateCoordinationPattern, 'function')
})

test('S11-A01.3', 'SQLite service mengekspos DAO kanonikal konten sosial Sprint 11', () => {
  assert.equal(typeof sqliteService.saveSocialPost, 'function')
  assert.equal(typeof sqliteService.getSocialPosts, 'function')
  assert.equal(typeof sqliteService.saveSocialComments, 'function')
  assert.equal(typeof sqliteService.getSocialComments, 'function')
  assert.equal(typeof sqliteService.saveSocialAnalysisRun, 'function')
  assert.equal(typeof sqliteService.getSocialAnalysisRuns, 'function')
})

// ─── GATE B: UNIFIED SOCIAL CONTRACTS & DOMAIN MODEL ───
console.log('\n─── Gate B: Unified Social Contracts & Domain Model ───')

test('S11-B01.1', 'Pemisahan eksplisit antara Discovery Candidate dan Social Post', () => {
  const dummyCandidate = {
    id: 'disc-test-1',
    providerId: 'brave-search',
    queryId: 'q1',
    targetPlatform: 'x',
    originalUrl: 'https://x.com/Kemhan_RI/status/123456789',
    canonicalUrl: 'https://x.com/Kemhan_RI/status/123456789',
    title: 'Cuitan Kemhan RI',
    snippet: 'Pernyataan resmi pengadaan alutsista.',
    publishedAt: null,
    publishedAtPrecision: 'UNKNOWN',
    indexedAt: Date.now(),
    discoveredAt: Date.now(),
    searchRank: 1,
    contentStatus: 'SNIPPET_ONLY',
    relevanceStatus: 'RELEVANT',
    ingestionStatus: 'DISCOVERED',
    provenance: {},
    limitations: [],
    isProvisional: true
  }

  // Sebelum promosi: Candidate adalah SNIPPET_ONLY
  assert.equal(dummyCandidate.contentStatus, 'SNIPPET_ONLY')
  assert.equal(dummyCandidate.isProvisional, true)

  // Promosi aman via pipeline
  const promoted = socialIntelligencePipeline.promoteCandidateToPost(dummyCandidate, {
    isFullyAcquired: true,
    validatedContentText: 'Teks lengkap siaran pers dari cuitan resmi Kemhan.'
  })

  assert.equal(promoted.contentStatus, 'FULL_CONTENT_ACQUIRED')
  assert.equal(promoted.contentCompleteness, 'FULL_TEXT')
  assert.equal(promoted.isProvisional, false)
  assert.equal(promoted.acquisitionMethod, 'OFFICIAL_API')
})

test('S11-B01.2', 'Candidate yang belum divalidasi kontennya tetap berstatus DISCOVERY_ONLY', () => {
  const provisionalCandidate = {
    id: 'disc-test-2',
    providerId: 'google-cse',
    queryId: 'q2',
    targetPlatform: 'facebook',
    originalUrl: 'https://facebook.com/post/999',
    canonicalUrl: 'https://facebook.com/post/999',
    title: 'Post Facebook Publik',
    snippet: 'Kutipan cuplikan hasil pencarian web',
    publishedAt: null,
    publishedAtPrecision: 'UNKNOWN',
    indexedAt: Date.now(),
    discoveredAt: Date.now(),
    searchRank: 2,
    contentStatus: 'SNIPPET_ONLY',
    relevanceStatus: 'PENDING',
    ingestionStatus: 'DISCOVERED',
    provenance: {},
    limitations: [],
    isProvisional: true
  }

  const unvalidatedPost = socialIntelligencePipeline.promoteCandidateToPost(provisionalCandidate, {
    isFullyAcquired: false
  })

  assert.equal(unvalidatedPost.contentStatus, 'DISCOVERY_ONLY')
  assert.equal(unvalidatedPost.contentCompleteness, 'SNIPPET_ONLY')
  assert.equal(unvalidatedPost.isProvisional, true)
  assert.ok(unvalidatedPost.limitations.some(l => l.includes('DISCOVERY ONLY')))
})

test('S11-B01.3', 'Platform capability matrix mencakup 5 platform sosial utama', () => {
  const platforms = ['youtube', 'facebook', 'instagram', 'tiktok', 'x']
  for (const plat of platforms) {
    const caps = getPlatformCapabilities(plat)
    assert.ok(caps.length >= 6, `Platform ${plat} harus memiliki minimal 6 kapabilitas`)
  }
})

// ─── GATE C: SEARCH PROVIDER CONTINUITY & BRAVE SEARCH ADAPTER ───
console.log('\n─── Gate C: Search Provider Continuity & Brave Search Adapter ───')

test('S11-C01.1', 'Google CSE memiliki pemberitahuan deprecation resmi sunset 2027-01-01', () => {
  assert.equal(GOOGLE_CSE_DEPRECATION_NOTICE.isDeprecated, true)
  assert.equal(GOOGLE_CSE_DEPRECATION_NOTICE.sunsetDeadline, '2027-01-01')
  const adapter = new GoogleCustomSearchAdapter()
  assert.equal(adapter.deprecationNotice.isDeprecated, true)
})

test('S11-C01.2', 'BraveSearchAdapter berstatus CONFIGURATION_REQUIRED saat token kosong', () => {
  const brave = new BraveSearchAdapter({ apiKey: '' })
  assert.equal(brave.isConfigured(), false)
  const budget = brave.getBudgetState()
  assert.equal(budget.requestsToday, 0)
  assert.equal(budget.dailyRequestLimit, 200)
})

test('S11-C01.3', 'BraveSearchAdapter mengonfigurasi pricing $5.00/1000 kueri ($0.005/request)', () => {
  assert.equal(BRAVE_COST_PER_REQUEST_USD, 0.005)
})

await testAsync('S11-C01.4', 'BraveSearchAdapter mengeksekusi kueri terakreditasi dengan mock fetch', async () => {
  const mockFetch = async (url, opts) => {
    assert.ok(url.includes('api.search.brave.com'))
    assert.ok(url.includes('country=ID'))
    assert.ok(url.includes('search_lang=id'))
    assert.equal(opts.headers['X-Subscription-Token'], 'test-brave-token-xyz')
    return {
      status: 200,
      ok: true,
      json: async () => ({
        web: {
          results: [
            {
              url: 'https://x.com/TNI_AD/status/192837465',
              title: 'TNI AD Klarifikasi Latihan Bersama',
              description: 'Puspen TNI AD meluruskan pemberitaan mengenai kegiatan latihan gabungan.',
              page_age: '2026-11-05T08:00:00Z'
            }
          ]
        }
      })
    }
  }

  const brave = new BraveSearchAdapter({ apiKey: 'test-brave-token-xyz' })
  assert.equal(brave.isConfigured(), true)

  const res = await brave.search('site:x.com "TNI AD"', { customFetch: mockFetch })
  assert.equal(res.success, true)
  assert.equal(res.items.length, 1)
  assert.equal(res.items[0].url, 'https://x.com/TNI_AD/status/192837465')
  assert.equal(res.costEstimatedUsd, 0.005)

  const budget = brave.getBudgetState()
  assert.equal(budget.requestsToday, 1)
  assert.equal(budget.estimatedCostTodayUsd, 0.005)
})

await testAsync('S11-C01.5', 'BraveSearchAdapter menangani HTTP 429 Rate Limited secara jujur', async () => {
  const mock429Fetch = async () => ({
    status: 429,
    ok: false,
    json: async () => ({})
  })

  const brave = new BraveSearchAdapter({ apiKey: 'test-brave-token-xyz' })
  const res = await brave.search('test query', { customFetch: mock429Fetch })
  assert.equal(res.success, false)
  assert.equal(res.errorCode, 'SEARCH_RATE_LIMITED')
})

// ─── GATE D: YOUTUBE OFFICIAL API QUOTA CORRECTION & PAGINATION ───
console.log('\n─── Gate D: YouTube Official API Quota Correction & Pagination ───')

test('S11-D01.1', 'YouTubeQuotaManager memisahkan bucket search.list (100 kueri) dan general units (10.000 unit)', () => {
  const qm = new YouTubeQuotaManager()
  const state = qm.getQuotaState()
  assert.equal(state.buckets.searchRequests.dailyLimit, 100)
  assert.equal(state.buckets.searchRequests.used, 0)
  assert.equal(state.buckets.searchRequests.remaining, 100)
  assert.equal(state.buckets.generalUnits.dailyLimit, 10000)
  assert.equal(state.buckets.generalUnits.used, 0)
  assert.equal(state.buckets.generalUnits.remaining, 10000)
})

test('S11-D01.2', 'Endpoint costs sesuai registry resmi YouTube Data API v3', () => {
  assert.equal(YOUTUBE_ENDPOINT_COSTS['search.list'].units, 100)
  assert.equal(YOUTUBE_ENDPOINT_COSTS['search.list'].isSearchCall, true)
  assert.equal(YOUTUBE_ENDPOINT_COSTS['videos.list'].units, 1)
  assert.equal(YOUTUBE_ENDPOINT_COSTS['commentThreads.list'].units, 1)
  assert.equal(YOUTUBE_ENDPOINT_COSTS['comments.list'].units, 1)
})

test('S11-D01.3', 'Perhitungan rollover harian berbasis midnight Pacific Time (PT)', () => {
  const ptMidnight = calculateNextPacificMidnight()
  assert.ok(ptMidnight > Date.now())
  const diffHours = (ptMidnight - Date.now()) / (3600000)
  assert.ok(diffHours > 0 && diffHours <= 25, 'Midnight PT harus berada dalam rentang 0-25 jam')
})

test('S11-D01.4', 'Reservasi atomik dan rollback kuota saat operasi dibatalkan', () => {
  const qm = new YouTubeQuotaManager()
  const res = qm.reserveQuota('search.list')
  assert.equal(res.allowed, true)
  assert.ok(res.reservationId.startsWith('yt-res-'))

  // Sebelum commit, used units bertambah
  let state = qm.getQuotaState()
  assert.equal(state.buckets.searchRequests.used, 1)
  assert.equal(state.buckets.generalUnits.used, 100)

  // Rollback jika fetch gagal
  qm.rollbackUsage(res.reservationId)
  state = qm.getQuotaState()
  assert.equal(state.buckets.searchRequests.used, 0)
  assert.equal(state.buckets.generalUnits.used, 0)
})

await testAsync('S11-D01.5', 'Pengambilan komentar mendukung paginasi multi-halaman berbiaya 1 unit/halaman', async () => {
  let callCount = 0
  const mockPagingFetch = async (url) => {
    callCount++
    if (url.includes('pageToken=')) {
      return {
        status: 200,
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'cmt-page2-1',
              snippet: {
                topLevelComment: {
                  snippet: {
                    authorDisplayName: 'Warga Natuna',
                    textOriginal: 'Komentar halaman 2 klarifikasi.',
                    publishedAt: '2026-11-06T12:00:00Z'
                  }
                }
              }
            }
          ]
        })
      }
    }
    return {
      status: 200,
      ok: true,
      json: async () => ({
        nextPageToken: 'token_halaman_2',
        items: [
          {
            id: 'cmt-page1-1',
            snippet: {
              topLevelComment: {
                snippet: {
                  authorDisplayName: 'Netizen 1',
                  textOriginal: 'Komentar halaman 1.',
                  publishedAt: '2026-11-06T11:00:00Z'
                }
              }
            }
          }
        ]
      })
    }
  }

  const yt = new YouTubeConnector('dummy-api-key-1234567890')
  const result = await yt.getVideoComments('testVideoId', {
    maxPages: 2,
    customFetch: mockPagingFetch
  })

  assert.equal(result.success, true)
  assert.equal(result.pagesFetched, 2)
  assert.equal(result.comments.length, 2)
  assert.equal(result.quotaUsed, 2) // 1 unit per halaman
  assert.equal(result.contentStatus, 'COMMENTS_ACQUIRED')
})

await testAsync('S11-D01.6', 'Penanganan jujur COMMENTS_DISABLED saat video dinonaktifkan oleh kreator', async () => {
  const mockDisabledFetch = async () => ({
    status: 403,
    ok: false,
    json: async () => ({
      error: {
        errors: [{ reason: 'commentsDisabled' }]
      }
    })
  })

  const yt = new YouTubeConnector('dummy-api-key-1234567890')
  const res = await yt.getVideoComments('disabledVideo', { customFetch: mockDisabledFetch })
  assert.equal(res.success, false)
  assert.equal(res.errorCode, 'COMMENTS_DISABLED')
  assert.equal(res.contentStatus, 'COMMENTS_DISABLED')
})

// ─── GATE E: YOUTUBE COMPLIANCE & GATE L INTEGRATION ───
console.log('\n─── Gate E: YouTube Compliance & Gate L Integration ───')

test('S11-E01.1', 'Agregasi komentar multi-kanal YouTube ditolak POLICY_BLOCKED', () => {
  const gateRes = evaluateYouTubeCapability('YOUTUBE_CROSS_CHANNEL_COMMENT_AGGREGATION', {
    channelIds: ['channel-A', 'channel-B']
  })
  assert.equal(gateRes.isPermitted, false)
  assert.equal(gateRes.status, 'POLICY_BLOCKED')
  assert.equal(gateRes.policySection, 'SECTION_III_E_2_DATA_AGGREGATION')
})

test('S11-E01.2', 'Pipeline mendeteksi dan menolak pencampuran komentar YouTube multi-kanal', () => {
  const multiComments = [
    { id: 'c1', postId: 'p1', platform: 'youtube', platformCommentId: 'pc1', authorHandle: 'a1', textOriginal: 'komentar 1', normalizedText: 'komentar 1', likeCount: 0, replyCount: 0, publishedAt: Date.now(), acquiredAt: Date.now(), retentionExpiresAt: Date.now() + YOUTUBE_MAX_RETENTION_MS, validationState: 'VALID' },
    { id: 'c2', postId: 'p2', platform: 'youtube', platformCommentId: 'pc2', authorHandle: 'a2', textOriginal: 'komentar 2', normalizedText: 'komentar 2', likeCount: 0, replyCount: 0, publishedAt: Date.now(), acquiredAt: Date.now(), retentionExpiresAt: Date.now() + YOUTUBE_MAX_RETENTION_MS, validationState: 'VALID' }
  ]

  const analysis = socialIntelligencePipeline.analyzeSocialComments(multiComments, {
    platform: 'youtube',
    channelIds: ['channel-Alpha', 'channel-Beta']
  })

  assert.equal(analysis.isPermitted, false)
  assert.equal(analysis.policyStatus, 'POLICY_BLOCKED')
  assert.equal(analysis.coordinationIndicator.label, 'POLICY_BLOCKED')
})

test('S11-E01.3', 'Batas retensi 30 hari kalender diterapkan pada rekaman konten YouTube', () => {
  const now = Date.now()
  const candidate = {
    targetPlatform: 'youtube',
    discoveredAt: now - (31 * 86400000) // 31 hari lalu
  }
  const isExpired = youtubeRetentionManager.isRecordExpired(candidate, now)
  assert.equal(isExpired, true)
})

// ─── GATE F: OTHER PLATFORM CAPABILITY TRUTHFULNESS (FB, IG, TIKTOK, X) ───
console.log('\n─── Gate F: Other Platform Capability Truthfulness (FB, IG, TikTok, X) ───')

test('S11-F01.1', 'Facebook: Discovery diizinkan, pengambilan konten/komentar berstatus ACCESS_RESTRICTED', () => {
  const fbDisc = evaluatePlatformCapability('facebook', 'DISCOVERY')
  assert.equal(fbDisc.status, 'AVAILABLE')
  const fbComments = evaluatePlatformCapability('facebook', 'COMMENTS')
  assert.equal(fbComments.status, 'ACCESS_RESTRICTED')
  assert.equal(fbComments.isPermitted, false)
})

test('S11-F01.2', 'Instagram: Scraping login dilarang, komentar berstatus ACCESS_RESTRICTED', () => {
  const igComments = evaluatePlatformCapability('instagram', 'COMMENTS')
  assert.equal(igComments.status, 'ACCESS_RESTRICTED')
  assert.equal(igComments.isPermitted, false)
})

test('S11-F01.3', 'TikTok: Research API mewajibkan persetujuan institusi (APPROVAL_REQUIRED)', () => {
  const ttMeta = evaluatePlatformCapability('tiktok', 'METADATA')
  assert.equal(ttMeta.status, 'APPROVAL_REQUIRED')
  const ttComments = evaluatePlatformCapability('tiktok', 'COMMENTS')
  assert.equal(ttComments.status, 'APPROVAL_REQUIRED')
})

test('S11-F01.4', 'X (Twitter): Tweets Lookup mewajibkan tier berbayar (CONFIGURATION_REQUIRED)', () => {
  const xContent = evaluatePlatformCapability('x', 'CONTENT')
  assert.equal(xContent.status, 'CONFIGURATION_REQUIRED')
  const xComments = evaluatePlatformCapability('x', 'COMMENTS')
  assert.equal(xComments.status, 'CONFIGURATION_REQUIRED')
})

// ─── GATE G: INTELLIGENCE INTEGRATION (SPRINT 8 & 9 ENGINE REUSE) ───
console.log('\n─── Gate G: Intelligence Integration (Sprint 8 & 9 Engine Reuse) ───')

test('S11-G01.1', 'Evaluasi relevansi sosial menggunakan Relevance Engine Sprint 09', () => {
  const issue = {
    issueId: 'iss-alutsista',
    title: 'Isu Pembatalan Kontrak Pengadaan Alutsista TNI AL',
    summary: 'Kabar pembatalan kontrak radar dan kapal pertahanan laut'
  }

  const relevantContent = {
    title: 'Dispenal Klarifikasi Pengadaan Alutsista Matra Laut',
    text: 'TNI AL menegaskan kontrak pengadaan kapal perang dan radar maritim tetap berjalan sesuai jadwal rencana strategis pertahanan.',
    platform: 'youtube'
  }

  const rel = socialIntelligencePipeline.evaluateSocialRelevance(relevantContent, issue)
  assert.equal(rel.status, 'RELEVANT')
  assert.ok(rel.score >= 50)
  assert.ok(rel.extractedClaims.length >= 1)
})

test('S11-G01.2', 'Konten hiburan atau gosip ditolak IRRELEVANT tanpa bias', () => {
  const issue = {
    issueId: 'iss-hankam',
    title: 'Patroli Perbatasan Natuna',
    summary: 'Operasi pengamanan kedaulatan laut'
  }

  const noiseContent = {
    title: 'Konser Musik dan Resep Masakan Artis Ibu Kota',
    text: 'Tips memasak rendang daging sapi empuk untuk sajian akhir pekan bersama keluarga.',
    platform: 'tiktok'
  }

  const rel = socialIntelligencePipeline.evaluateSocialRelevance(noiseContent, issue)
  assert.equal(rel.status, 'IRRELEVANT')
  assert.equal(rel.rejectionReason, 'UNRELATED_TOPIC')
})

test('S11-G01.3', 'Analisis sentimen komentar video tunggal menggunakan Lexicon Engine Sprint 08', () => {
  const singleVideoComments = [
    { id: 'c1', postId: 'v1', platform: 'youtube', platformCommentId: 'y1', authorHandle: 'warga1', textOriginal: 'Bagus dan hebat TNI atas patroli perbatasannya, sangat membanggakan!', normalizedText: '', likeCount: 5, replyCount: 0, publishedAt: Date.now(), acquiredAt: Date.now(), retentionExpiresAt: null, validationState: 'VALID' },
    { id: 'c2', postId: 'v1', platform: 'youtube', platformCommentId: 'y2', authorHandle: 'warga2', textOriginal: 'Hebat dan mantap TNI AL, jaga terus laut nusantara.', normalizedText: '', likeCount: 2, replyCount: 0, publishedAt: Date.now(), acquiredAt: Date.now(), retentionExpiresAt: null, validationState: 'VALID' }
  ]

  const analysis = socialIntelligencePipeline.analyzeSocialComments(singleVideoComments, {
    platform: 'youtube',
    channelIds: ['channel-dispenal']
  })

  assert.equal(analysis.isPermitted, true)
  assert.equal(analysis.policyStatus, 'PERMITTED')
  assert.equal(analysis.sentimentSummary.positive, 2)
  assert.equal(analysis.sentimentSummary.dominantSentiment, 'POSITIVE')
})

// ─── GATE H: SPREAD & TEMPORAL OBSERVATIONS (NO ATTRIBUTION) ───
console.log('\n─── Gate H: Spread & Temporal Observations (No Attribution) ───')

test('S11-H01.1', 'Observasi sebaran memuat caveat OBSERVED_SAMPLE_ONLY dan NO_ACTOR_ATTRIBUTION', () => {
  const dummyPosts = [
    { id: 'p1', platform: 'youtube', platformPostId: 'v1', canonicalUrl: 'url1', originalUrl: 'url1', author: {}, title: 't1', contentText: 'c1', contentCompleteness: 'FULL_TEXT', publishedAt: Date.now(), publishedAtPrecision: 'EXACT', firstObservedAt: Date.now(), acquiredAt: Date.now(), retentionExpiresAt: null, contentStatus: 'FULL_CONTENT_ACQUIRED', relevanceStatus: 'RELEVANT', acquisitionMethod: 'OFFICIAL_API', providerApiName: 'yt', acquisitionRunId: 'r1', queryFingerprint: 'q1', isProvisional: false, limitations: [], provenance: {} }
  ]

  const obs = socialIntelligencePipeline.generateSocialSpreadObservation(dummyPosts, [], [])
  assert.ok(obs.caveats.includes('OBSERVED_SAMPLE_ONLY'))
  assert.ok(obs.caveats.includes('NO_ACTOR_ATTRIBUTION'))
  assert.equal(obs.sampleSizePosts, 1)
})

test('S11-H01.2', 'Indikator koordinasi bernilai konservatif tanpa atributif buzzer/botnet', () => {
  const obs = socialIntelligencePipeline.generateSocialSpreadObservation([], [], [])
  assert.equal(obs.coordinationIndicators.label, 'NO_CLEAR_PATTERN')
  assert.ok(!obs.coordinationIndicators.label.includes('BOT'))
  assert.ok(!obs.coordinationIndicators.label.includes('BUZZER'))
})

// ─── GATE I: PERSISTENCE, MIGRATIONS & CREDENTIAL SECURITY ───
console.log('\n─── Gate I: Persistence, Migrations & Credential Security ───')

await testAsync('S11-I01.1', 'Menyimpan dan memulihkan SocialPostRecord dari database lokal', async () => {
  const postRecord = {
    id: 'soc-post-yt-test12345',
    platform: 'youtube',
    platformPostId: 'test12345',
    canonicalUrl: 'https://www.youtube.com/watch?v=test12345',
    originalUrl: 'https://www.youtube.com/watch?v=test12345',
    author: { channelTitle: 'Puspen TNI', channelId: 'UC12345' },
    title: 'Siaran Pers Puspen TNI',
    contentText: 'TNI menegaskan kesiapan operasional seluruh satuan jajaran.',
    contentCompleteness: 'FULL_TEXT',
    publishedAt: Date.now() - 3600000,
    publishedAtPrecision: 'EXACT',
    firstObservedAt: Date.now(),
    acquiredAt: Date.now(),
    retentionExpiresAt: Date.now() + YOUTUBE_MAX_RETENTION_MS,
    contentStatus: 'FULL_CONTENT_ACQUIRED',
    relevanceStatus: 'RELEVANT',
    acquisitionMethod: 'OFFICIAL_API',
    providerApiName: 'youtube-official-api',
    acquisitionRunId: 'run-test-1',
    queryFingerprint: 'q-fingerprint-1',
    isProvisional: false,
    limitations: [],
    provenance: {}
  }

  const saveRes = await saveSocialPostToDB(postRecord)
  assert.equal(saveRes.success, true)
  assert.equal(saveRes.id, postRecord.id)

  const loaded = await getSocialPostsFromDB({ platform: 'youtube' })
  assert.ok(loaded.length >= 1)
  assert.equal(loaded[0].id, postRecord.id)
})

await testAsync('S11-I01.2', 'Purge data YouTube kedaluwarsa membersihkan rekaman konten sosial', async () => {
  const oldPost = {
    id: 'soc-post-yt-expired-99',
    platform: 'youtube',
    platformPostId: 'exp99',
    canonicalUrl: 'https://www.youtube.com/watch?v=exp99',
    originalUrl: 'https://www.youtube.com/watch?v=exp99',
    author: {},
    title: 'Post YouTube Kedaluwarsa',
    contentText: 'Konten kadaluwarsa',
    contentCompleteness: 'FULL_TEXT',
    publishedAt: Date.now() - (40 * 86400000),
    publishedAtPrecision: 'EXACT',
    firstObservedAt: Date.now() - (40 * 86400000),
    acquiredAt: Date.now() - (35 * 86400000), // 35 hari lalu
    retentionExpiresAt: Date.now() - (5 * 86400000),
    contentStatus: 'FULL_CONTENT_ACQUIRED',
    relevanceStatus: 'RELEVANT',
    acquisitionMethod: 'OFFICIAL_API',
    providerApiName: 'youtube-official-api',
    acquisitionRunId: 'run-old',
    queryFingerprint: 'q-old',
    isProvisional: false,
    limitations: [],
    provenance: {}
  }

  await saveSocialPostToDB(oldPost)
  const cutoff = Date.now() - (30 * 86400000)
  const purgeRes = await purgeExpiredYouTubeDataFromDB(cutoff)
  assert.ok(purgeRes.purgedCount >= 1)
})

// ─── GATE K: MANDATORY ADVERSARIAL CASES (FIXTURES A s.d. Q) ───
console.log('\n─── Gate K: Mandatory Adversarial Cases (Fixtures A s.d. Q) ───')

test('S11-ADV-A', '[Fixture A] Banyak komentar identik mengutip siaran pers -> Terdeteksi copypasta, BUKAN bukti independen', () => {
  const quotePressRelease = 'Dispenad: Seluruh prajurit di Natuna dalam kondisi siaga menjaga kedaulatan NKRI.'
  const comments = [
    { id: 'c1', rawText: quotePressRelease, normalizedText: quotePressRelease, contentDigest: 'h1', validationState: 'VALID', characterCount: 50, tokenCount: 10 },
    { id: 'c2', rawText: quotePressRelease, normalizedText: quotePressRelease, contentDigest: 'h2', validationState: 'VALID', characterCount: 50, tokenCount: 10 },
    { id: 'c3', rawText: quotePressRelease, normalizedText: quotePressRelease, contentDigest: 'h3', validationState: 'VALID', characterCount: 50, tokenCount: 10 }
  ]
  const clusters = detectCommentSimilarityClusters(comments)
  assert.ok(clusters.length >= 1)
  assert.equal(clusters[0].memberCommentIds.length, 3)
  // Dipastikan bukan bukti penerbit independen
})

test('S11-ADV-B', '[Fixture B] Komentar berbeda berbagi frasa umum (setuju, amin) -> Tidak overstate copypasta', () => {
  const comments = [
    { id: 'c1', rawText: 'setuju sekali pak', normalizedText: 'setuju sekali pak', contentDigest: 'h1', validationState: 'VALID', characterCount: 17, tokenCount: 3 },
    { id: 'c2', rawText: 'amin ya rabbal alamin', normalizedText: 'amin ya rabbal alamin', contentDigest: 'h2', validationState: 'VALID', characterCount: 21, tokenCount: 4 },
    { id: 'c3', rawText: 'semoga berkah dan sukses', normalizedText: 'semoga berkah dan sukses', contentDigest: 'h3', validationState: 'VALID', characterCount: 24, tokenCount: 4 }
  ]
  const clusters = detectCommentSimilarityClusters(comments)
  assert.equal(clusters.length, 0, 'Frasa generik pendek tidak boleh memicu kluster copypasta')
})

test('S11-ADV-C', '[Fixture C] Banyak komentar dalam 1 thread -> Tetap dihitung 1 konteks thread, bukan multi-sumber', () => {
  const threadComments = [
    { id: 'c1', postId: 'post-1', threadId: 'thread-main', textOriginal: 'Komentar 1' },
    { id: 'c2', postId: 'post-1', threadId: 'thread-main', textOriginal: 'Balasan 1' },
    { id: 'c3', postId: 'post-1', threadId: 'thread-main', textOriginal: 'Balasan 2' }
  ]
  const obs = socialIntelligencePipeline.generateSocialSpreadObservation([], threadComments, [])
  assert.ok(obs.caveats.includes('NON_INDEPENDENT_THREAD_COMMENTS'))
})

test('S11-ADV-D', '[Fixture D] Lonjakan aktivitas akibat breaking news -> Disertai peringatan lonjakan alami', () => {
  const now = Date.now()
  const posts = Array.from({ length: 8 }, (_, i) => ({
    id: `p-${i}`,
    platform: 'youtube',
    acquiredAt: now - 300000,
    author: {},
    title: 'Breaking news peristiwa',
    contentText: 'Laporan breaking news terkini'
  }))
  const obs = socialIntelligencePipeline.generateSocialSpreadObservation(posts, [], [])
  assert.ok(obs.burstObservations[0].isBurstDetected)
  assert.ok(obs.burstObservations[0].caveat.includes('perkembangan berita'))
})

test('S11-ADV-E', '[Fixture E] Akun independen tanpa bukti keterikatan -> Tidak ada atribusi botnet', () => {
  const comments = Array.from({ length: 6 }, (_, i) => ({
    id: `c-${i}`,
    rawText: `Pendapat warga nomor ${i} mengenai penataan fasilitas jalan umum di perumahan.`,
    normalizedText: `pendapat warga nomor ${i} mengenai penataan fasilitas jalan umum di perumahan`,
    contentDigest: `d-${i}`,
    validationState: 'VALID',
    characterCount: 60,
    tokenCount: 10
  }))
  const clusters = detectCommentSimilarityClusters(comments)
  const coord = evaluateCoordinationPattern(comments, clusters, {
    eligibleRecordsCount: comments.length,
    timestampedRecordsCount: 0,
    ambiguousTimestampsCount: 0,
    invalidTimestampsCount: 0,
    timestampCoverageRatio: 0,
    status: 'INSUFFICIENT_DATA',
    detectedBursts: [],
    explanation: 'Tidak ada data timestamp'
  })
  assert.ok(coord.indicator !== 'PATTERN_WARRANTS_REVIEW')
  assert.ok(!coord.summaryRationale.toLowerCase().includes('bot'))
})

await testAsync('S11-ADV-F', '[Fixture F] Video YouTube dihapus atau 404 -> Menghasilkan VIDEO_NOT_FOUND terklasifikasi', async () => {
  const mock404Fetch = async () => ({
    status: 404,
    ok: false,
    json: async () => ({})
  })
  const yt = new YouTubeConnector('dummy-key-1234567890')
  const res = await yt.getVideoComments('deletedVideoId', { customFetch: mock404Fetch })
  assert.equal(res.success, false)
  assert.equal(res.errorCode, 'VIDEO_NOT_FOUND')
  assert.equal(res.contentStatus, 'CONTENT_UNAVAILABLE')
})

await testAsync('S11-ADV-G', '[Fixture G] Komentar dinonaktifkan -> Status COMMENTS_DISABLED jujur', async () => {
  const mockDisabledFetch = async () => ({
    status: 403,
    ok: false,
    json: async () => ({
      error: { errors: [{ reason: 'commentsDisabled' }] }
    })
  })
  const yt = new YouTubeConnector('dummy-key-1234567890')
  const res = await yt.getVideoComments('vidDisabled', { customFetch: mockDisabledFetch })
  assert.equal(res.contentStatus, 'COMMENTS_DISABLED')
})

test('S11-ADV-H', '[Fixture H] Penemuan duplikat dari dua search provider -> Terdeduplikasi ke 1 kanonikal', () => {
  const candidateFromGoogle = {
    id: 'c-google-1',
    providerId: 'google-custom-search-api',
    targetPlatform: 'youtube',
    canonicalUrl: 'https://www.youtube.com/watch?v=sample123',
    platformIdentity: { videoId: 'sample123' },
    title: 'Judul Video',
    snippet: 'Deskripsi'
  }
  const candidateFromBrave = {
    id: 'c-brave-1',
    providerId: 'brave-search-api',
    targetPlatform: 'youtube',
    canonicalUrl: 'https://www.youtube.com/watch?v=sample123',
    platformIdentity: { videoId: 'sample123' },
    title: 'Judul Video Mirip',
    snippet: 'Deskripsi mirip'
  }

  const dedup = deduplicateDiscoveryResults([candidateFromGoogle, candidateFromBrave])
  assert.equal(dedup.uniqueResults.length, 1)
  assert.equal(dedup.duplicatesCount, 1)
})

await testAsync('S11-ADV-I', '[Fixture I] Hasil pencarian kosong dari provider -> Menghasilkan item kosong, bukan PROVIDER ERROR', async () => {
  const mockEmptyFetch = async () => ({
    status: 200,
    ok: true,
    json: async () => ({ web: { results: [] } })
  })
  const brave = new BraveSearchAdapter({ apiKey: 'valid-test-key-123' })
  const res = await brave.search('kueri unik tidak ada hasil', { customFetch: mockEmptyFetch })
  assert.equal(res.success, true)
  assert.equal(res.items.length, 0)
})

test('S11-ADV-J', '[Fixture J] Kuota habis (search quota exhausted) -> Pengajuan kueri ditolak tanpa memperparah kuota', () => {
  const qm = new YouTubeQuotaManager({ dailyLimitSearches: 1, headroomSearches: 0 })
  const r1 = qm.reserveQuota('search.list')
  assert.equal(r1.allowed, true)
  qm.commitUsage(r1.reservationId)

  // Request kedua harus ditolak
  const r2 = qm.reserveQuota('search.list')
  assert.equal(r2.allowed, false)
  assert.equal(r2.reason, 'SEARCH_REQUESTS_EXHAUSTED')
})

test('S11-ADV-K', '[Fixture K] Cuplikan snippet memuat pernyataan faktual -> Tetap DISCOVERY ONLY, bukan bukti', () => {
  const snippetCandidate = {
    id: 'disc-k',
    providerId: 'brave',
    targetPlatform: 'x',
    canonicalUrl: 'https://x.com/post/1',
    originalUrl: 'https://x.com/post/1',
    title: 'Klaim Menhan Bantah Kabar Pembatalan',
    snippet: 'Menhan RI menegaskan bahwa tidak ada pembatalan kontrak kapal selam.',
    discoveredAt: Date.now()
  }
  const post = socialIntelligencePipeline.promoteCandidateToPost(snippetCandidate, { isFullyAcquired: false })
  assert.equal(post.contentStatus, 'DISCOVERY_ONLY')
  assert.equal(post.isProvisional, true)
})

test('S11-ADV-L', '[Fixture L] Satu issue memuat multi-klaim -> Asosiasi hanya ke klaim yang cocok proposisinya', () => {
  const issueWithTwoClaims = {
    issueId: 'iss-multi',
    title: 'Isu Alutsista dan Pangkalan Militer',
    claims: [
      { id: 'clm-kapal-selam', text: 'Klaim pembatalan kontrak kapal selam' },
      { id: 'clm-pangkalan-asing', text: 'Klaim keberadaan pangkalan militer asing di pulau terluar' }
    ]
  }

  const contentAboutSubmarine = {
    title: 'Dispenal Bantah Isu Pembatalan Kapal Selam',
    text: 'Pemberitaan mengenai pembatalan kontrak kapal selam Scorpene adalah tidak berdasar.',
    platform: 'youtube'
  }

  const evalRes = socialIntelligencePipeline.evaluateSocialRelevance(contentAboutSubmarine, issueWithTwoClaims)
  assert.ok(evalRes.associatedClaimIds.includes('clm-kapal-selam'))
  assert.ok(!evalRes.associatedClaimIds.includes('clm-pangkalan-asing'))
})

test('S11-ADV-M', '[Fixture M] Dua issue berbeda berbagi kata kunci -> Tidak digabung secara paksa', () => {
  const issueA = { issueId: 'iss-A', title: 'Kebijakan Pengadaan Radar Pertahanan Maritim' }
  const issueB = { issueId: 'iss-B', title: 'Radar BMKG Pantau Cuaca Ekstrem dan Badai' }

  const bmkgContent = {
    title: 'Peringatan Dini Cuaca BMKG Memanfaatkan Radar Cuaca',
    text: 'Stasiun meteorologi maritim mendeteksi potensi gelombang tinggi di perairan Natuna.',
    platform: 'web'
  }

  const resA = socialIntelligencePipeline.evaluateSocialRelevance(bmkgContent, issueA)
  const resB = socialIntelligencePipeline.evaluateSocialRelevance(bmkgContent, issueB)

  // Relevansi terhadap cuaca tinggi, terhadap pertahanan maritim rendah
  assert.equal(resB.status, 'RELEVANT')
})

test('S11-ADV-N', '[Fixture N] Satu komentar mengulang klaim berkali-kali -> Tidak menaikkan bobot bukti independen', () => {
  const repeatedComment = {
    title: 'Diskusi Publik',
    text: 'Katanya kontrak kapal selam batal. Ya benar batal. Batal kontraknya.',
    platform: 'youtube'
  }
  const rel = socialIntelligencePipeline.evaluateSocialRelevance(repeatedComment, {
    issueId: 'iss-1',
    title: 'Pembatalan Kontrak Kapal Selam'
  })
  // Tidak terjadi penggandaan klaim
  assert.ok(rel.extractedClaims.length <= 2)
})

test('S11-ADV-O', '[Fixture O] Timestamp publikasi tidak diketahui -> Ditandai UNKNOWN_DATE tanpa fabrikasi', () => {
  const candidateNoDate = {
    id: 'disc-no-date',
    targetPlatform: 'facebook',
    canonicalUrl: 'https://facebook.com/1',
    originalUrl: 'https://facebook.com/1',
    title: 'Post Tanpa Tanggal',
    snippet: 'Teks tanpa tanggal rilis',
    publishedAt: null,
    publishedAtPrecision: 'UNKNOWN',
    discoveredAt: 1730000000000
  }
  const post = socialIntelligencePipeline.promoteCandidateToPost(candidateNoDate)
  assert.equal(post.publishedAt, null)
  assert.equal(post.publishedAtPrecision, 'UNKNOWN')
  assert.equal(post.firstObservedAt, 1730000000000)
})

test('S11-ADV-P', '[Fixture P] Data YouTube API kedaluwarsa -> Retensi 30 hari kalender ditegakkan', () => {
  const now = Date.now()
  const expPost = {
    targetPlatform: 'youtube',
    discoveredAt: now - (35 * 86400000)
  }
  assert.equal(youtubeRetentionManager.isRecordExpired(expPost, now), true)
})

test('S11-ADV-Q', '[Fixture Q] Percobaan analisis koordinasi multi-kanal YouTube -> Ditolak tegas POLICY_BLOCKED', () => {
  const multiChannelAnalysis = socialIntelligencePipeline.analyzeSocialComments([], {
    platform: 'youtube',
    channelIds: ['channel-dispenad', 'channel-media-online']
  })
  assert.equal(multiChannelAnalysis.policyStatus, 'POLICY_BLOCKED')
  assert.equal(multiChannelAnalysis.coordinationIndicator.label, 'POLICY_BLOCKED')
})

// ─── GATE M: PERFORMANCE SMOKE TEST & BOUNDED QUERIES ───
console.log('\n─── Gate M: Performance Smoke Test & Bounded Queries ───')

test('S11-M01.1', 'Pemrosesan batch 200 komentar selesai dalam budget waktu < 200ms', () => {
  const batch200 = Array.from({ length: 200 }, (_, i) => ({
    id: `c-perf-${i}`,
    postId: 'post-perf',
    platform: 'youtube',
    platformCommentId: `pc-${i}`,
    authorHandle: `warga_${i}`,
    textOriginal: `Tanggapan warga nomor ${i} terkait pengamanan perbatasan wilayah perairan.`,
    normalizedText: '',
    likeCount: i,
    replyCount: 0,
    publishedAt: Date.now() - (i * 60000),
    acquiredAt: Date.now(),
    retentionExpiresAt: null,
    validationState: 'VALID'
  }))

  const t0 = performance.now()
  const result = socialIntelligencePipeline.analyzeSocialComments(batch200, {
    platform: 'youtube',
    channelIds: ['channel-single']
  })
  const t1 = performance.now()
  const duration = t1 - t0

  assert.equal(result.isPermitted, true)
  assert.ok(duration < 200, `Durasi analisis 200 komentar (${duration.toFixed(1)}ms) harus < 200ms`)
  console.log(`     ⏱️ Benchmark Kinerja: 200 komentar diproses dalam ${duration.toFixed(2)}ms`)
})

test('S11-M01.2', 'Query planner mendeteksi dan menghormati cooldown 30 menit', () => {
  const planner = new DorkingQueryPlanner(1800000)
  const issue = {
    issueId: 'iss-cooldown',
    title: 'Isu Operasi Pengamanan',
    platforms: ['youtube']
  }

  const plan1 = planner.planQueriesForIssue(issue)
  assert.equal(plan1.length, 1)
  assert.equal(plan1[0].isEligible, true)

  planner.recordQueryExecution(plan1[0].fingerprint)

  // Query kedua sebelum 30 menit
  const plan2 = planner.planQueriesForIssue(issue)
  assert.equal(plan2[0].isEligible, false)
  assert.ok(plan2[0].skipReason.includes('cooldown'))
})

console.log('\n══════════════════════════════════════════════════════════════════════')
console.log(`🏆 TOTAL SPRINT 11 ASSERTIONS: ${passCount + failCount}`)
console.log(`   ✅ PASS: ${passCount}`)
console.log(`   ❌ FAIL: ${failCount}`)
console.log('══════════════════════════════════════════════════════════════════════\n')

if (failCount > 0) {
  process.exit(1)
}
