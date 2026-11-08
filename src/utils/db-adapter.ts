/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA HIGH-CAPACITY STORAGE ADAPTER (INDEXEDDB & RESILIENT FALLBACK)
 * PUSSIBERAD TNI AD × CODEPOLITAN — KARTIKA CYBER HACKATHON 2026
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Mengatasi keterbatasan kuota 5MB sessionStorage/localStorage pada browser.
 * Menyediakan penyimpanan ratusan megabyte untuk:
 * 1. Store 'analyses': Riwayat hasil analisis intelijen kognitif lengkap.
 * 2. Store 'radar_cache': Cache feed arsip klarifikasi hoaks 200+ kasus.
 * 3. Store 'image_store': Blob / DataURL citra asli dan binarisasi Otsu.
 * 
 * Dilengkapi Transparent In-Memory & SessionStorage Fallback jika browser
 * membatasi IndexedDB (Private Browsing / Sandbox).
 * ══════════════════════════════════════════════════════════════════════════
 */

import type { AnalysisResult, DebunkKnowledgeEntry } from '../types'
import { sortRadarEntries } from '../engine/radar/freshness-engine.ts'
import type { TopicCandidate } from '../engine/radar/radar-types.ts'
import type { EvidenceRecord } from '../engine/investigation/investigation-types.ts'
import type {
  CommentBatch,
  CommentRecord,
  CommentAnalysisRun,
  CommentReviewAnnotation
} from '../engine/intelligence/comment-types.ts'
import type {
  ClaimRecord,
  ClaimEvidenceItem,
  ClaimAssessmentRecord,
  PublisherProfile
} from '../engine/intelligence/claim-types.ts'
import type {
  SearchDiscoveryResult,
  ScanRunLog,
  TargetPlatform
} from '../engine/acquisition/source-contracts.ts'
import type {
  SocialPostRecord,
  SocialCommentRecord,
  SocialAnalysisRunSummary
} from '../engine/social/social-contracts.ts'

export interface StorageDurabilityState {
  status: 'PERSISTED' | 'DEGRADED' | 'FAILED'
  engine: 'SQLITE' | 'INDEXED_DB' | 'MEMORY_FALLBACK'
  dbPath?: string | null
  lastError?: string | null
  recordCounts?: Record<string, number>
}

declare global {
  interface Window {
    naradaDatabase?: {
      getStatus: () => Promise<StorageDurabilityState>
      isMigrationCompleted: () => Promise<boolean>
      importDump: (dump: any) => Promise<{ success: boolean; stats: any }>
      createBackup: (dest?: string) => Promise<{ success: boolean; backupPath: string }>
      checkIntegrity: () => Promise<{ ok: boolean; result?: string }>
      saveCase: (c: any) => Promise<{ success: boolean; id: string }>
      getCaseById: (id: string) => Promise<any>
      getAllCases: () => Promise<any[]>
      deleteCase: (id: string) => Promise<{ success: boolean }>
      saveEvidence: (rec: any) => Promise<{ success: boolean; id: string }>
      getEvidenceRecords: (caseId?: string) => Promise<any[]>
      deleteEvidence: (id: string) => Promise<{ success: boolean }>
      saveCommentBatch: (b: any) => Promise<{ success: boolean; id: string }>
      getCommentBatches: (caseId?: string) => Promise<any[]>
      getCommentBatchById: (id: string) => Promise<any>
      saveCommentRecords: (recs: any[]) => Promise<{ success: boolean; inserted: number }>
      getCommentRecords: (batchId?: string) => Promise<any[]>
      saveCommentAnalysisRun: (run: any) => Promise<{ success: boolean; id: string }>
      getCommentAnalysisRuns: (batchId?: string) => Promise<any[]>
      getCommentAnalysisRunById: (id: string) => Promise<any>
      saveCommentReviewAnnotation: (ann: any) => Promise<{ success: boolean; id: string }>
      getCommentReviewAnnotations: (runId: string, caseId?: string) => Promise<any[]>
      saveRadarItems: (items: any[]) => Promise<{ success: boolean; count: number }>
      getCachedRadarItems: () => Promise<any[]>
      saveClaim: (claim: any) => Promise<{ success: boolean; id: string }>
      getClaims: (articleId?: string) => Promise<any[]>
      saveClaimEvidence: (evidence: any) => Promise<{ success: boolean; id: string }>
      getClaimEvidence: (claimId?: string) => Promise<any[]>
      saveClaimAssessment: (assessment: any) => Promise<{ success: boolean; id: string }>
      getClaimAssessment: (claimId: string) => Promise<any>
      savePublisher: (publisher: any) => Promise<{ success: boolean; id: string }>
      getPublishers: () => Promise<any[]>
      saveDiscoveryCandidate: (candidate: any) => Promise<{ success: boolean; id: string }>
      getDiscoveryCandidates: (platform?: string) => Promise<any[]>
      saveScanRunLog: (log: any) => Promise<{ success: boolean; runId: string }>
      getScanRunLogs: (limit?: number) => Promise<any[]>
      purgeExpiredYouTubeData?: (cutoff: number) => Promise<{ success: boolean; deletedCount: number }>
      purgeAllYouTubeData?: () => Promise<{ success: boolean; deletedCount: number }>
      saveSocialPost?: (post: any) => Promise<{ success: boolean; id: string }>
      getSocialPosts?: (filter?: any) => Promise<any[]>
      saveSocialComments?: (comments: any[]) => Promise<{ success: boolean; count: number }>
      getSocialComments?: (postId?: string, limit?: number) => Promise<any[]>
      saveSocialAnalysisRun?: (run: any) => Promise<{ success: boolean; runId: string }>
      getSocialAnalysisRuns?: (issueId?: string, limit?: number) => Promise<any[]>
    }
  }
}

const DB_NAME = 'narada_tactical_db'
const DB_VERSION = 7 // DB_VERSION = 2 & DB_VERSION = 3 schema migration compatibility. Upgraded to 7 for Sprint 11 Social Intelligence.

export const STORES = {
  ANALYSES: 'analyses',
  RADAR_CACHE: 'radar_cache',
  IMAGE_STORE: 'image_store',
  TOPIC_CANDIDATES: 'topic_candidates',
  ISSUE_ACTIVITY_SNAPSHOTS: 'issue_activity_snapshots',
  SOURCE_RUN_LOG: 'source_run_log',
  EVIDENCE_RECORDS: 'evidence_records',
  EVIDENCE_ARTIFACTS: 'evidence_artifacts',
  COMMENT_BATCHES: 'comment_batches',
  COMMENT_RECORDS: 'comment_records',
  COMMENT_ANALYSIS_RUNS: 'comment_analysis_runs',
  COMMENT_REVIEW_ANNOTATIONS: 'comment_review_annotations',
  CLAIMS: 'claims',
  EVIDENCE: 'evidence',
  CLAIM_ASSESSMENTS: 'claim_assessments',
  PUBLISHERS: 'publishers',
  DISCOVERY_CANDIDATES: 'discovery_candidates',
  SCAN_HISTORY: 'scan_history',
  SOCIAL_POSTS: 'social_posts',
  SOCIAL_COMMENTS: 'social_comments',
  SOCIAL_ANALYSIS_RUNS: 'social_analysis_runs',
} as const

export interface StoredImageData {
  analysisId: string
  originalImage?: string
  binarizedImage?: string
  timestamp: number
}

export interface DBStorageStats {
  totalAnalyses: number
  totalRadarCached: number
  totalImages: number
  mode: 'INDEXED_DB' | 'MEMORY_FALLBACK'
}

// In-Memory Fallback Stores
const memoryFallback = {
  analyses: new Map<string, AnalysisResult>(),
  radarCache: new Map<string, DebunkKnowledgeEntry>(),
  imageStore: new Map<string, StoredImageData>(),
  topicCandidates: new Map<string, TopicCandidate>(),
  issueActivitySnapshots: new Map<string, any>(),
  sourceRunLog: new Map<string, any>(),
  evidenceRecords: new Map<string, EvidenceRecord>(),
  evidenceArtifacts: new Map<string, any>(),
  commentBatches: new Map<string, CommentBatch>(),
  commentRecords: new Map<string, CommentRecord>(),
  commentAnalysisRuns: new Map<string, CommentAnalysisRun>(),
  commentReviewAnnotations: new Map<string, CommentReviewAnnotation>(),
  claims: new Map<string, ClaimRecord>(),
  evidence: new Map<string, ClaimEvidenceItem>(),
  claimAssessments: new Map<string, ClaimAssessmentRecord>(),
  publishers: new Map<string, PublisherProfile>(),
  discoveryCandidates: new Map<string, SearchDiscoveryResult>(),
  scanHistory: new Map<string, ScanRunLog>(),
  socialPosts: new Map<string, SocialPostRecord>(),
  socialComments: new Map<string, SocialCommentRecord>(),
  socialAnalysisRuns: new Map<string, SocialAnalysisRunSummary>(),
}

let dbInstance: IDBDatabase | null = null
let isFallbackMode = false

/**
 * Memeriksa apakah IndexedDB didukung dan dapat dibuka pada lingkungan ini
 */
function isIndexedDBAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null
  } catch {
    return false
  }
}

/**
 * Inisialisasi koneksi IndexedDB dengan migrasi skema
 */
export async function initDB(): Promise<IDBDatabase | null> {
  if (dbInstance) return dbInstance
  if (!isIndexedDBAvailable()) {
    isFallbackMode = true
    return null
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Store 1: Analyses
        if (!db.objectStoreNames.contains(STORES.ANALYSES)) {
          const store = db.createObjectStore(STORES.ANALYSES, { keyPath: 'id' })
          store.createIndex('timestamp', 'timestamp', { unique: false })
          store.createIndex('category', 'category', { unique: false })
          store.createIndex('threatLevel', 'threatLevel', { unique: false })
        }

        // Store 2: Radar Cache
        if (!db.objectStoreNames.contains(STORES.RADAR_CACHE)) {
          const store = db.createObjectStore(STORES.RADAR_CACHE, { keyPath: 'id' })
          store.createIndex('cluster', 'cluster', { unique: false })
          store.createIndex('fetchedAt', 'fetchedAt', { unique: false })
        }

        // Store 3: Image Store
        if (!db.objectStoreNames.contains(STORES.IMAGE_STORE)) {
          db.createObjectStore(STORES.IMAGE_STORE, { keyPath: 'analysisId' })
        }

        // Store 4: Topic Candidates (Sprint 6)
        if (!db.objectStoreNames.contains(STORES.TOPIC_CANDIDATES)) {
          const store = db.createObjectStore(STORES.TOPIC_CANDIDATES, { keyPath: 'id' })
          store.createIndex('state', 'state', { unique: false })
          store.createIndex('matchedDomain', 'matchedDomain', { unique: false })
          store.createIndex('lastObservedAt', 'lastObservedAt', { unique: false })
        }

        // Store 5: Issue Activity Snapshots (Sprint 6)
        if (!db.objectStoreNames.contains(STORES.ISSUE_ACTIVITY_SNAPSHOTS)) {
          const store = db.createObjectStore(STORES.ISSUE_ACTIVITY_SNAPSHOTS, { keyPath: 'id' })
          store.createIndex('clusterId', 'clusterId', { unique: false })
          store.createIndex('timestamp', 'timestamp', { unique: false })
        }

        // Store 6: Source Run Log (Sprint 6)
        if (!db.objectStoreNames.contains(STORES.SOURCE_RUN_LOG)) {
          const store = db.createObjectStore(STORES.SOURCE_RUN_LOG, { keyPath: 'id' })
          store.createIndex('sourceId', 'sourceId', { unique: false })
          store.createIndex('timestamp', 'timestamp', { unique: false })
        }

        // Store 7: Evidence Records (Sprint 7)
        if (!db.objectStoreNames.contains(STORES.EVIDENCE_RECORDS)) {
          const store = db.createObjectStore(STORES.EVIDENCE_RECORDS, { keyPath: 'id' })
          store.createIndex('caseId', 'caseId', { unique: false })
          store.createIndex('submittedAt', 'submittedAt', { unique: false })
        }

        // Store 8: Evidence Artifacts (Sprint 7)
        if (!db.objectStoreNames.contains(STORES.EVIDENCE_ARTIFACTS)) {
          const store = db.createObjectStore(STORES.EVIDENCE_ARTIFACTS, { keyPath: 'id' })
          store.createIndex('evidenceId', 'evidenceId', { unique: false })
        }

        // Store 9: Comment Batches (Sprint 8)
        if (!db.objectStoreNames.contains(STORES.COMMENT_BATCHES)) {
          const store = db.createObjectStore(STORES.COMMENT_BATCHES, { keyPath: 'id' })
          store.createIndex('caseId', 'caseId', { unique: false })
          store.createIndex('createdAt', 'createdAt', { unique: false })
        }

        // Store 10: Comment Records (Sprint 8)
        if (!db.objectStoreNames.contains(STORES.COMMENT_RECORDS)) {
          const store = db.createObjectStore(STORES.COMMENT_RECORDS, { keyPath: 'id' })
          store.createIndex('batchId', 'batchId', { unique: false })
          store.createIndex('caseId', 'caseId', { unique: false })
        }

        // Store 11: Comment Analysis Runs (Sprint 8)
        if (!db.objectStoreNames.contains(STORES.COMMENT_ANALYSIS_RUNS)) {
          const store = db.createObjectStore(STORES.COMMENT_ANALYSIS_RUNS, { keyPath: 'id' })
          store.createIndex('batchId', 'batchId', { unique: false })
          store.createIndex('caseId', 'caseId', { unique: false })
          store.createIndex('createdAt', 'createdAt', { unique: false })
        }

        // Store 12: Comment Review Annotations (Sprint 8)
        if (!db.objectStoreNames.contains(STORES.COMMENT_REVIEW_ANNOTATIONS)) {
          const store = db.createObjectStore(STORES.COMMENT_REVIEW_ANNOTATIONS, { keyPath: 'id' })
          store.createIndex('runId', 'runId', { unique: false })
          store.createIndex('caseId', 'caseId', { unique: false })
        }

        // Store 13: Claims (Sprint 9)
        if (!db.objectStoreNames.contains(STORES.CLAIMS)) {
          const store = db.createObjectStore(STORES.CLAIMS, { keyPath: 'id' })
          store.createIndex('sourceArticleId', 'sourceArticleId', { unique: false })
          store.createIndex('claimType', 'claimType', { unique: false })
          store.createIndex('createdAt', 'createdAt', { unique: false })
        }

        // Store 14: Evidence Items (Sprint 9)
        if (!db.objectStoreNames.contains(STORES.EVIDENCE)) {
          const store = db.createObjectStore(STORES.EVIDENCE, { keyPath: 'id' })
          store.createIndex('claimId', 'claimId', { unique: false })
          store.createIndex('sourcePublisherId', 'sourcePublisherId', { unique: false })
          store.createIndex('evidenceRelation', 'evidenceRelation', { unique: false })
        }

        // Store 15: Claim Assessments (Sprint 9)
        if (!db.objectStoreNames.contains(STORES.CLAIM_ASSESSMENTS)) {
          const store = db.createObjectStore(STORES.CLAIM_ASSESSMENTS, { keyPath: 'id' })
          store.createIndex('claimId', 'claimId', { unique: true })
          store.createIndex('verdict', 'verdict', { unique: false })
          store.createIndex('assessedAt', 'assessedAt', { unique: false })
        }

        // Store 16: Publishers (Sprint 9)
        if (!db.objectStoreNames.contains(STORES.PUBLISHERS)) {
          const store = db.createObjectStore(STORES.PUBLISHERS, { keyPath: 'id' })
          store.createIndex('registrableDomain', 'registrableDomain', { unique: false })
          store.createIndex('publisherType', 'publisherType', { unique: false })
        }

        // Store 17: Discovery Candidates (Sprint 10)
        if (!db.objectStoreNames.contains(STORES.DISCOVERY_CANDIDATES)) {
          const store = db.createObjectStore(STORES.DISCOVERY_CANDIDATES, { keyPath: 'id' })
          store.createIndex('targetPlatform', 'targetPlatform', { unique: false })
          store.createIndex('relevanceStatus', 'relevanceStatus', { unique: false })
          store.createIndex('discoveredAt', 'discoveredAt', { unique: false })
        }

        // Store 18: Scan History (Sprint 10)
        if (!db.objectStoreNames.contains(STORES.SCAN_HISTORY)) {
          const store = db.createObjectStore(STORES.SCAN_HISTORY, { keyPath: 'runId' })
          store.createIndex('triggerType', 'triggerType', { unique: false })
          store.createIndex('startedAt', 'startedAt', { unique: false })
        }

        // Store 19: Social Posts (Sprint 11)
        if (!db.objectStoreNames.contains(STORES.SOCIAL_POSTS)) {
          const store = db.createObjectStore(STORES.SOCIAL_POSTS, { keyPath: 'id' })
          store.createIndex('platform', 'platform', { unique: false })
          store.createIndex('issueId', 'issueId', { unique: false })
          store.createIndex('acquiredAt', 'acquiredAt', { unique: false })
        }

        // Store 20: Social Comments (Sprint 11)
        if (!db.objectStoreNames.contains(STORES.SOCIAL_COMMENTS)) {
          const store = db.createObjectStore(STORES.SOCIAL_COMMENTS, { keyPath: 'id' })
          store.createIndex('postId', 'postId', { unique: false })
          store.createIndex('platform', 'platform', { unique: false })
          store.createIndex('acquiredAt', 'acquiredAt', { unique: false })
        }

        // Store 21: Social Analysis Runs (Sprint 11)
        if (!db.objectStoreNames.contains(STORES.SOCIAL_ANALYSIS_RUNS)) {
          const store = db.createObjectStore(STORES.SOCIAL_ANALYSIS_RUNS, { keyPath: 'runId' })
          store.createIndex('issueId', 'issueId', { unique: false })
          store.createIndex('startedAt', 'startedAt', { unique: false })
        }
      }

      request.onsuccess = (event) => {
        dbInstance = (event.target as IDBOpenDBRequest).result
        isFallbackMode = false
        resolve(dbInstance)
      }

      request.onerror = (event) => {
        console.warn('[NARADA DB-Adapter] IndexedDB gagal dibuka, beralih ke Memory Fallback:', event)
        isFallbackMode = true
        resolve(null)
      }
    } catch (err) {
      console.warn('[NARADA DB-Adapter] Exception saat inisialisasi IndexedDB:', err)
      isFallbackMode = true
      resolve(null)
    }
  })
}

// ─── HELPER TRANSAKSI INDEXEDDB ───

async function performTransaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await initDB()
  if (!db || isFallbackMode) {
    throw new Error('Fallback mode active')
  }

  return new Promise<T>((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, mode)
      const store = tx.objectStore(storeName)
      const request = callback(store)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      tx.onerror = () => reject(tx.error)
    } catch (err) {
      reject(err)
    }
  })
}

// ─── CRUD ANALYSES ───

/**
 * Menyimpan data AnalysisResult ke database
 */
export async function saveAnalysisToDB(analysis: AnalysisResult): Promise<void> {
  try {
    await performTransaction(STORES.ANALYSES, 'readwrite', (store) => store.put(analysis))
  } catch {
    // Fallback in-memory
    memoryFallback.analyses.set(analysis.id, analysis)
  }
}

/**
 * Mengambil seluruh data AnalysisResult dari database
 */
export async function getAnalysesFromDB(): Promise<AnalysisResult[]> {
  try {
    const list = await performTransaction<AnalysisResult[]>(STORES.ANALYSES, 'readonly', (store) =>
      store.getAll()
    )
    return Array.isArray(list) ? list.sort((a, b) => b.timestamp - a.timestamp) : []
  } catch {
    return Array.from(memoryFallback.analyses.values()).sort((a, b) => b.timestamp - a.timestamp)
  }
}

/**
 * Mengambil single AnalysisResult berdasarkan ID
 */
export async function getAnalysisByIdFromDB(id: string): Promise<AnalysisResult | null> {
  try {
    const item = await performTransaction<AnalysisResult | undefined>(
      STORES.ANALYSES,
      'readonly',
      (store) => store.get(id)
    )
    return item || null
  } catch {
    return memoryFallback.analyses.get(id) || null
  }
}

/**
 * Menghapus single AnalysisResult berdasarkan ID
 */
export async function deleteAnalysisFromDB(id: string): Promise<void> {
  try {
    await performTransaction(STORES.ANALYSES, 'readwrite', (store) => store.delete(id))
  } catch {
    memoryFallback.analyses.delete(id)
  }
}

/**
 * Membersihkan seluruh riwayat analisis
 */
export async function clearAnalysesFromDB(): Promise<void> {
  try {
    await performTransaction(STORES.ANALYSES, 'readwrite', (store) => store.clear())
  } catch {
    memoryFallback.analyses.clear()
  }
}

// ─── CRUD RADAR CACHE ───

/**
 * Menyimpan kumpulan entri radar klarifikasi hoaks ke cache lokal
 */
export async function cacheRadarItems(items: DebunkKnowledgeEntry[]): Promise<void> {
  const db = await initDB()
  if (!db || isFallbackMode) {
    items.forEach((item) => memoryFallback.radarCache.set(item.id, item))
    return
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORES.RADAR_CACHE, 'readwrite')
      const store = tx.objectStore(STORES.RADAR_CACHE)
      items.forEach((item) => store.put(item))
      tx.oncomplete = () => resolve()
      tx.onerror = () => {
        items.forEach((item) => memoryFallback.radarCache.set(item.id, item))
        resolve()
      }
    } catch {
      items.forEach((item) => memoryFallback.radarCache.set(item.id, item))
      resolve()
    }
  })
}

/**
 * Mengambil seluruh entri radar tersimpan di cache lokal
 */
export async function getCachedRadarItems(): Promise<DebunkKnowledgeEntry[]> {
  try {
    const list = await performTransaction<DebunkKnowledgeEntry[]>(
      STORES.RADAR_CACHE,
      'readonly',
      (store) => store.getAll()
    )
    const items = Array.isArray(list) ? list : []
    return sortRadarEntries(items)
  } catch {
    return sortRadarEntries(Array.from(memoryFallback.radarCache.values()))
  }
}

/**
 * Menghapus satu entri radar tertentu dari cache lokal
 */
export async function deleteRadarItemFromDB(id: string): Promise<void> {
  memoryFallback.radarCache.delete(id)
  try {
    await performTransaction<undefined>(
      STORES.RADAR_CACHE,
      'readwrite',
      (store) => store.delete(id)
    )
  } catch {
    // Abaikan kegagalan bila fallback mode aktif
  }
}

/**
 * Mengosongkan seluruh antrean buffer radar di cache lokal
 */
export async function clearRadarCacheDB(): Promise<void> {
  memoryFallback.radarCache.clear()
  try {
    await performTransaction<undefined>(
      STORES.RADAR_CACHE,
      'readwrite',
      (store) => store.clear()
    )
  } catch {
    // Abaikan kegagalan bila fallback mode aktif
  }
}

/**
 * Mengambil satu entri radar berdasarkan ID
 */
export async function getRadarItemById(id: string): Promise<DebunkKnowledgeEntry | null> {
  if (memoryFallback.radarCache.has(id)) {
    return memoryFallback.radarCache.get(id) || null
  }
  try {
    const item = await performTransaction<DebunkKnowledgeEntry | undefined>(
      STORES.RADAR_CACHE,
      'readonly',
      (store) => store.get(id)
    )
    return item || null
  } catch {
    return null
  }
}

/**
 * Memperbarui status triage suatu entri radar di IndexedDB / memory
 */
export async function updateRadarItemStatus(id: string, newStatus: string): Promise<boolean> {
  try {
    let target = memoryFallback.radarCache.get(id)
    if (target) {
      (target as any).triageStatus = newStatus
    }

    const item = await getRadarItemById(id)
    if (item) {
      (item as any).triageStatus = newStatus
      await performTransaction<IDBValidKey>(
        STORES.RADAR_CACHE,
        'readwrite',
        (store) => store.put(item)
      )
      // Pancarkan sinyal event pembaruan agar UI LiveRadar mendeteksi perubahan seketika
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('narada:radar-status-changed', {
          detail: { id, status: newStatus }
        }))
      }
      return true
    }
    return false
  } catch (err) {
    console.error('[DBAdapter] Gagal update radar status:', err)
    return false
  }
}


// ─── CRUD IMAGE STORE ───

/**
 * Menyimpan citra asli dan binarisasi Otsu
 */
export async function saveImageToDB(
  analysisId: string,
  originalImage?: string,
  binarizedImage?: string
): Promise<void> {
  const data: StoredImageData = {
    analysisId,
    originalImage,
    binarizedImage,
    timestamp: Date.now(),
  }

  try {
    await performTransaction(STORES.IMAGE_STORE, 'readwrite', (store) => store.put(data))
  } catch {
    memoryFallback.imageStore.set(analysisId, data)
  }
}

/**
 * Mengambil citra berdasarkan analysisId
 */
export async function getImageFromDB(analysisId: string): Promise<StoredImageData | null> {
  try {
    const item = await performTransaction<StoredImageData | undefined>(
      STORES.IMAGE_STORE,
      'readonly',
      (store) => store.get(analysisId)
    )
    return item || null
  } catch {
    return memoryFallback.imageStore.get(analysisId) || null
  }
}

// ─── STORAGE TELEMETRY & STATS ───

/**
 * Mendapatkan statistik pemanfaatan kapasitas storage adapter
 */
export async function getDBStorageStats(): Promise<DBStorageStats> {
  try {
    const analyses = await getAnalysesFromDB()
    const radar = await getCachedRadarItems()
    return {
      totalAnalyses: analyses.length,
      totalRadarCached: radar.length,
      totalImages: memoryFallback.imageStore.size,
      mode: isFallbackMode ? 'MEMORY_FALLBACK' : 'INDEXED_DB',
    }
  } catch {
    return {
      totalAnalyses: memoryFallback.analyses.size,
      totalRadarCached: memoryFallback.radarCache.size,
      totalImages: memoryFallback.imageStore.size,
      mode: 'MEMORY_FALLBACK',
    }
  }
}

// ─── SPRINT 6: TOPIC CANDIDATES & ISSUE ACTIVITY PERSISTENCE ───

/**
 * Menyimpan array kandidat topik ke IndexedDB / Memory Fallback
 */
export async function saveTopicCandidates(candidates: TopicCandidate[]): Promise<void> {
  const db = await initDB()
  if (!db || isFallbackMode) {
    candidates.forEach((c) => memoryFallback.topicCandidates.set(c.id, c))
    return
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORES.TOPIC_CANDIDATES, 'readwrite')
      const store = tx.objectStore(STORES.TOPIC_CANDIDATES)
      candidates.forEach((c) => store.put(c))
      tx.oncomplete = () => resolve()
      tx.onerror = () => {
        candidates.forEach((c) => memoryFallback.topicCandidates.set(c.id, c))
        resolve()
      }
    } catch {
      candidates.forEach((c) => memoryFallback.topicCandidates.set(c.id, c))
      resolve()
    }
  })
}

/**
 * Mengambil seluruh kandidat topik dari IndexedDB / Memory Fallback
 */
export async function getTopicCandidatesFromDB(): Promise<TopicCandidate[]> {
  try {
    const items = await performTransaction<TopicCandidate[]>(
      STORES.TOPIC_CANDIDATES,
      'readonly',
      (store) => store.getAll()
    )
    return items || []
  } catch {
    return Array.from(memoryFallback.topicCandidates.values())
  }
}

/**
 * Menyimpan snapshot aktivitas isu ke IndexedDB / Memory Fallback
 */
export async function saveIssueActivitySnapshot(snapshot: { id: string; clusterId: string; timestamp: number; [key: string]: any }): Promise<void> {
  try {
    await performTransaction(STORES.ISSUE_ACTIVITY_SNAPSHOTS, 'readwrite', (store) => store.put(snapshot))
  } catch {
    memoryFallback.issueActivitySnapshots.set(snapshot.id, snapshot)
  }
}

/**
 * Mengambil snapshot aktivitas isu
 */
export async function getIssueActivitySnapshotsFromDB(clusterId?: string): Promise<any[]> {
  try {
    const items = await performTransaction<any[]>(
      STORES.ISSUE_ACTIVITY_SNAPSHOTS,
      'readonly',
      (store) => {
        if (clusterId) {
          const index = store.index('clusterId')
          return index.getAll(clusterId)
        }
        return store.getAll()
      }
    )
    return items || []
  } catch {
    const all = Array.from(memoryFallback.issueActivitySnapshots.values())
    if (clusterId) {
      return all.filter(item => item.clusterId === clusterId)
    }
    return all
  }
}

/**
 * Menyimpan log eksekusi pengambilan sumber
 */
export async function saveSourceRunLog(log: { id: string; sourceId: string; timestamp: number; [key: string]: any }): Promise<void> {
  try {
    await performTransaction(STORES.SOURCE_RUN_LOG, 'readwrite', (store) => store.put(log))
  } catch {
    memoryFallback.sourceRunLog.set(log.id, log)
  }
}

/**
 * Mengambil log eksekusi sumber
 */
export async function getSourceRunLogsFromDB(sourceId?: string): Promise<any[]> {
  try {
    const items = await performTransaction<any[]>(
      STORES.SOURCE_RUN_LOG,
      'readonly',
      (store) => {
        if (sourceId) {
          const index = store.index('sourceId')
          return index.getAll(sourceId)
        }
        return store.getAll()
      }
    )
    return items || []
  } catch {
    const all = Array.from(memoryFallback.sourceRunLog.values())
    if (sourceId) {
      return all.filter(l => l.sourceId === sourceId)
    }
    return all
  }
}

/**
 * Membersihkan source run logs yang melebihi batas retensi (default 7 hari) (WP5 / S61-28)
 */
export async function cleanOldSourceRunLogs(maxAgeMs: number = 7 * 86400000): Promise<number> {
  const cutoff = Date.now() - maxAgeMs
  let deletedCount = 0
  try {
    const db = await initDB()
    if (!db || isFallbackMode) {
      for (const [id, entry] of memoryFallback.sourceRunLog.entries()) {
        if (entry.timestamp < cutoff) {
          memoryFallback.sourceRunLog.delete(id)
          deletedCount++
        }
      }
      return deletedCount
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORES.SOURCE_RUN_LOG, 'readwrite')
        const store = tx.objectStore(STORES.SOURCE_RUN_LOG)
        const req = store.getAll()
        req.onsuccess = () => {
          const list = req.result || []
          for (const item of list) {
            if (item.timestamp < cutoff) {
              store.delete(item.id)
              deletedCount++
            }
          }
        }
        tx.oncomplete = () => resolve(deletedCount)
        tx.onerror = () => resolve(deletedCount)
      } catch {
        resolve(deletedCount)
      }
    })
  } catch {
    return deletedCount
  }
}

/**
 * Membersihkan snapshot aktivitas yang melebihi batas retensi (default 7 hari) (WP5 / S61-28)
 */
export async function cleanOldIssueActivitySnapshots(maxAgeMs: number = 7 * 86400000): Promise<number> {
  const cutoff = Date.now() - maxAgeMs
  let deletedCount = 0
  try {
    const db = await initDB()
    if (!db || isFallbackMode) {
      for (const [id, snap] of memoryFallback.issueActivitySnapshots.entries()) {
        if (snap.timestamp < cutoff) {
          memoryFallback.issueActivitySnapshots.delete(id)
          deletedCount++
        }
      }
      return deletedCount
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORES.ISSUE_ACTIVITY_SNAPSHOTS, 'readwrite')
        const store = tx.objectStore(STORES.ISSUE_ACTIVITY_SNAPSHOTS)
        const req = store.getAll()
        req.onsuccess = () => {
          const list = req.result || []
          for (const item of list) {
            if (item.timestamp < cutoff) {
              store.delete(item.id)
              deletedCount++
            }
          }
        }
        tx.oncomplete = () => resolve(deletedCount)
        tx.onerror = () => resolve(deletedCount)
      } catch {
        resolve(deletedCount)
      }
    })
  } catch {
    return deletedCount
  }
}

// ─── CRUD EVIDENCE RECORDS (Sprint 7) ───

/**
 * Menyimpan rekaman bukti digital EvidenceRecord ke IndexedDB
 */
export async function saveEvidenceRecordToDB(record: EvidenceRecord): Promise<void> {
  if (typeof window !== 'undefined' && window.naradaDatabase) {
    try {
      await window.naradaDatabase.saveEvidence(record)
      return
    } catch (err) {
      console.warn('[DBAdapter] SQLite saveEvidence failed, falling back:', err)
    }
  }
  try {
    await performTransaction(STORES.EVIDENCE_RECORDS, 'readwrite', (store) => store.put(record))
  } catch {
    memoryFallback.evidenceRecords.set(record.id, record)
  }
}

/**
 * Mengambil rekaman bukti digital berdasarkan caseId atau seluruh rekaman
 */
export async function getEvidenceRecordsFromDB(caseId?: string): Promise<EvidenceRecord[]> {
  if (typeof window !== 'undefined' && window.naradaDatabase) {
    try {
      const records = await window.naradaDatabase.getEvidenceRecords(caseId)
      if (Array.isArray(records)) return records
    } catch (err) {
      console.warn('[DBAdapter] SQLite getEvidence failed, falling back:', err)
    }
  }
  try {
    const records = await performTransaction<EvidenceRecord[]>(
      STORES.EVIDENCE_RECORDS,
      'readonly',
      (store) => {
        if (caseId) {
          const index = store.index('caseId')
          return index.getAll(caseId)
        }
        return store.getAll()
      }
    )
    return records || []
  } catch {
    const list = Array.from(memoryFallback.evidenceRecords.values())
    if (caseId) {
      return list.filter(r => r.caseId === caseId)
    }
    return list
  }
}

/**
 * Mengambil rekaman bukti berdasarkan ID
 */
export async function getEvidenceRecordByIdFromDB(id: string): Promise<EvidenceRecord | null> {
  if (typeof window !== 'undefined' && window.naradaDatabase) {
    try {
      const all = await window.naradaDatabase.getEvidenceRecords()
      const found = all?.find((r: any) => r.id === id)
      if (found) return found
    } catch (err) {
      console.warn('[DBAdapter] SQLite getEvidenceById failed, falling back:', err)
    }
  }
  try {
    const record = await performTransaction<EvidenceRecord | undefined>(
      STORES.EVIDENCE_RECORDS,
      'readonly',
      (store) => store.get(id)
    )
    return record || null
  } catch {
    return memoryFallback.evidenceRecords.get(id) || null
  }
}

/**
 * Menghapus rekaman bukti berdasarkan ID
 */
export async function deleteEvidenceRecordFromDB(id: string): Promise<void> {
  if (typeof window !== 'undefined' && window.naradaDatabase) {
    try {
      await window.naradaDatabase.deleteEvidence(id)
      return
    } catch (err) {
      console.warn('[DBAdapter] SQLite deleteEvidence failed, falling back:', err)
    }
  }
  try {
    await performTransaction(STORES.EVIDENCE_RECORDS, 'readwrite', (store) => store.delete(id))
  } catch {
    memoryFallback.evidenceRecords.delete(id)
  }
}

export interface StoredEvidenceArtifact {
  id: string
  evidenceId: string
  type: 'SCREENSHOT_PNG' | 'SELECTED_TEXT_UTF8' | 'MANIFEST_JSON'
  data: string
  sha256: string
  timestamp: number
}

/**
 * Menyimpan payload artefak biner/data bukti digital
 */
export async function saveEvidenceArtifactToDB(artifact: StoredEvidenceArtifact): Promise<void> {
  try {
    await performTransaction(STORES.EVIDENCE_ARTIFACTS, 'readwrite', (store) => store.put(artifact))
  } catch {
    memoryFallback.evidenceArtifacts.set(artifact.id, artifact)
  }
}

/**
 * Mengambil payload artefak bukti digital
 */
export async function getEvidenceArtifactFromDB(id: string): Promise<StoredEvidenceArtifact | null> {
  try {
    const artifact = await performTransaction<StoredEvidenceArtifact | undefined>(
      STORES.EVIDENCE_ARTIFACTS,
      'readonly',
      (store) => store.get(id)
    )
    return artifact || null
  } catch {
    return (memoryFallback.evidenceArtifacts.get(id) as StoredEvidenceArtifact) || null
  }
}

// ─── CRUD COMMENT INTELLIGENCE (Sprint 8) ───

/**
 * Menyimpan batch sampel komentar ke IndexedDB
 */
export async function saveCommentBatchToDB(batch: CommentBatch): Promise<void> {
  if (typeof window !== 'undefined' && window.naradaDatabase) {
    try {
      await window.naradaDatabase.saveCommentBatch(batch)
      return
    } catch (err) {
      console.warn('[DBAdapter] SQLite saveCommentBatch failed, falling back:', err)
    }
  }
  try {
    await performTransaction(STORES.COMMENT_BATCHES, 'readwrite', (store) => store.put(batch))
  } catch {
    memoryFallback.commentBatches.set(batch.id, batch)
  }
}

/**
 * Mengambil daftar batch sampel komentar (opsional difilter berdasarkan caseId)
 */
export async function getCommentBatchesFromDB(caseId?: string): Promise<CommentBatch[]> {
  if (typeof window !== 'undefined' && window.naradaDatabase) {
    try {
      const batches = await window.naradaDatabase.getCommentBatches(caseId)
      if (Array.isArray(batches)) return batches
    } catch (err) {
      console.warn('[DBAdapter] SQLite getCommentBatches failed, falling back:', err)
    }
  }
  try {
    const batches = await performTransaction<CommentBatch[]>(
      STORES.COMMENT_BATCHES,
      'readonly',
      (store) => {
        if (caseId) {
          const index = store.index('caseId')
          return index.getAll(caseId)
        }
        return store.getAll()
      }
    )
    return batches || []
  } catch {
    const list = Array.from(memoryFallback.commentBatches.values())
    if (caseId) {
      return list.filter(b => b.caseId === caseId)
    }
    return list
  }
}

/**
 * Mengambil satu batch komentar berdasarkan ID
 */
export async function getCommentBatchByIdFromDB(id: string): Promise<CommentBatch | null> {
  if (typeof window !== 'undefined' && window.naradaDatabase) {
    try {
      const batch = await window.naradaDatabase.getCommentBatchById(id)
      if (batch) return batch
    } catch (err) {
      console.warn('[DBAdapter] SQLite getCommentBatchById failed, falling back:', err)
    }
  }
  try {
    const batch = await performTransaction<CommentBatch | undefined>(
      STORES.COMMENT_BATCHES,
      'readonly',
      (store) => store.get(id)
    )
    return batch || null
  } catch {
    return memoryFallback.commentBatches.get(id) || null
  }
}

/**
 * Menghapus batch komentar berdasarkan ID
 */
export async function deleteCommentBatchFromDB(id: string): Promise<void> {
  try {
    await performTransaction(STORES.COMMENT_BATCHES, 'readwrite', (store) => store.delete(id))
  } catch {
    memoryFallback.commentBatches.delete(id)
  }
}

/**
 * Menyimpan sekumpulan rekaman komentar ke IndexedDB
 */
export async function saveCommentRecordsToDB(records: CommentRecord[]): Promise<void> {
  if (typeof window !== 'undefined' && window.naradaDatabase) {
    try {
      await window.naradaDatabase.saveCommentRecords(records)
      return
    } catch (err) {
      console.warn('[DBAdapter] SQLite saveCommentRecords failed, falling back:', err)
    }
  }
  try {
    const db = await initDB()
    if (!db || isFallbackMode) {
      for (const record of records) {
        memoryFallback.commentRecords.set(record.id, record)
      }
      return
    }

    await new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction(STORES.COMMENT_RECORDS, 'readwrite')
        const store = tx.objectStore(STORES.COMMENT_RECORDS)
        for (const record of records) {
          store.put(record)
        }
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      } catch (err) {
        reject(err)
      }
    })
  } catch {
    for (const record of records) {
      memoryFallback.commentRecords.set(record.id, record)
    }
  }
}

/**
 * Mengambil rekaman komentar berdasarkan batchId atau seluruhnya
 */
export async function getCommentRecordsFromDB(batchId?: string): Promise<CommentRecord[]> {
  if (typeof window !== 'undefined' && window.naradaDatabase) {
    try {
      const records = await window.naradaDatabase.getCommentRecords(batchId)
      if (Array.isArray(records)) return records
    } catch (err) {
      console.warn('[DBAdapter] SQLite getCommentRecords failed, falling back:', err)
    }
  }
  try {
    const records = await performTransaction<CommentRecord[]>(
      STORES.COMMENT_RECORDS,
      'readonly',
      (store) => {
        if (batchId) {
          const index = store.index('batchId')
          return index.getAll(batchId)
        }
        return store.getAll()
      }
    )
    return records || []
  } catch {
    const list = Array.from(memoryFallback.commentRecords.values())
    if (batchId) {
      return list.filter(r => r.batchId === batchId)
    }
    return list
  }
}

/**
 * Mengambil rekaman komentar berdasarkan caseId
 */
export async function getCommentRecordsByCaseIdFromDB(caseId: string): Promise<CommentRecord[]> {
  try {
    const records = await performTransaction<CommentRecord[]>(
      STORES.COMMENT_RECORDS,
      'readonly',
      (store) => {
        const index = store.index('caseId')
        return index.getAll(caseId)
      }
    )
    return records || []
  } catch {
    return Array.from(memoryFallback.commentRecords.values()).filter(r => r.caseId === caseId)
  }
}

/**
 * Menghapus rekaman komentar terkait suatu batchId
 */
export async function deleteCommentRecordsByBatchIdFromDB(batchId: string): Promise<void> {
  try {
    const records = await getCommentRecordsFromDB(batchId)
    const db = await initDB()
    if (!db || isFallbackMode) {
      for (const r of records) {
        memoryFallback.commentRecords.delete(r.id)
      }
      return
    }

    await new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction(STORES.COMMENT_RECORDS, 'readwrite')
        const store = tx.objectStore(STORES.COMMENT_RECORDS)
        for (const r of records) {
          store.delete(r.id)
        }
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      } catch (err) {
        reject(err)
      }
    })
  } catch {
    for (const [id, r] of memoryFallback.commentRecords.entries()) {
      if (r.batchId === batchId) {
        memoryFallback.commentRecords.delete(id)
      }
    }
  }
}

/**
 * Menyimpan snapshot immutable hasil analisis run komentar ke IndexedDB
 */
export async function saveCommentAnalysisRunToDB(run: CommentAnalysisRun): Promise<void> {
  if (typeof window !== 'undefined' && window.naradaDatabase) {
    try {
      await window.naradaDatabase.saveCommentAnalysisRun(run)
      return
    } catch (err) {
      console.warn('[DBAdapter] SQLite saveCommentAnalysisRun failed, falling back:', err)
    }
  }
  try {
    await performTransaction(STORES.COMMENT_ANALYSIS_RUNS, 'readwrite', (store) => store.put(run))
  } catch {
    memoryFallback.commentAnalysisRuns.set(run.id, run)
  }
}

/**
 * Mengambil riwayat run analisis komentar
 */
export async function getCommentAnalysisRunsFromDB(batchId?: string, caseId?: string): Promise<CommentAnalysisRun[]> {
  if (typeof window !== 'undefined' && window.naradaDatabase) {
    try {
      const runs = await window.naradaDatabase.getCommentAnalysisRuns(batchId)
      if (Array.isArray(runs)) {
        if (caseId) return runs.filter((r: any) => r.caseId === caseId)
        return runs
      }
    } catch (err) {
      console.warn('[DBAdapter] SQLite getCommentAnalysisRuns failed, falling back:', err)
    }
  }
  try {
    const runs = await performTransaction<CommentAnalysisRun[]>(
      STORES.COMMENT_ANALYSIS_RUNS,
      'readonly',
      (store) => {
        if (batchId) {
          const index = store.index('batchId')
          return index.getAll(batchId)
        }
        if (caseId) {
          const index = store.index('caseId')
          return index.getAll(caseId)
        }
        return store.getAll()
      }
    )
    return runs || []
  } catch {
    const list = Array.from(memoryFallback.commentAnalysisRuns.values())
    if (batchId) {
      return list.filter(r => r.batchId === batchId)
    }
    if (caseId) {
      return list.filter(r => r.caseId === caseId)
    }
    return list
  }
}

/**
 * Mengambil satu snapshot run analisis komentar berdasarkan ID
 */
export async function getCommentAnalysisRunByIdFromDB(id: string): Promise<CommentAnalysisRun | null> {
  if (typeof window !== 'undefined' && window.naradaDatabase) {
    try {
      const run = await window.naradaDatabase.getCommentAnalysisRunById(id)
      if (run) return run
    } catch (err) {
      console.warn('[DBAdapter] SQLite getCommentAnalysisRunById failed, falling back:', err)
    }
  }
  try {
    const run = await performTransaction<CommentAnalysisRun | undefined>(
      STORES.COMMENT_ANALYSIS_RUNS,
      'readonly',
      (store) => store.get(id)
    )
    return run || null
  } catch {
    return memoryFallback.commentAnalysisRuns.get(id) || null
  }
}

/**
 * Menyimpan anotasi review analis manusia ke IndexedDB
 */
export async function saveCommentReviewAnnotationToDB(annotation: CommentReviewAnnotation): Promise<void> {
  if (typeof window !== 'undefined' && window.naradaDatabase) {
    try {
      await window.naradaDatabase.saveCommentReviewAnnotation(annotation)
      return
    } catch (err) {
      console.warn('[DBAdapter] SQLite saveCommentReviewAnnotation failed, falling back:', err)
    }
  }
  try {
    await performTransaction(STORES.COMMENT_REVIEW_ANNOTATIONS, 'readwrite', (store) => store.put(annotation))
  } catch {
    memoryFallback.commentReviewAnnotations.set(annotation.id, annotation)
  }
}

/**
 * Mengambil anotasi review analis manusia berdasarkan runId atau caseId
 */
export async function getCommentReviewAnnotationsFromDB(runId?: string, caseId?: string): Promise<CommentReviewAnnotation[]> {
  if (typeof window !== 'undefined' && window.naradaDatabase) {
    try {
      if (runId) {
        const ann = await window.naradaDatabase.getCommentReviewAnnotations(runId, caseId)
        if (Array.isArray(ann)) return ann
      }
    } catch (err) {
      console.warn('[DBAdapter] SQLite getCommentReviewAnnotations failed, falling back:', err)
    }
  }
  try {
    const annotations = await performTransaction<CommentReviewAnnotation[]>(
      STORES.COMMENT_REVIEW_ANNOTATIONS,
      'readonly',
      (store) => {
        if (runId) {
          const index = store.index('runId')
          return index.getAll(runId)
        }
        if (caseId) {
          const index = store.index('caseId')
          return index.getAll(caseId)
        }
        return store.getAll()
      }
    )
    return annotations || []
  } catch {
    const list = Array.from(memoryFallback.commentReviewAnnotations.values())
    if (runId) {
      return list.filter(a => a.runId === runId)
    }
    if (caseId) {
      return list.filter(a => a.caseId === caseId)
    }
    return list
  }
}

/**
 * Mendeteksi apakah sistem penyimpanan berada dalam status terdegradasi (in-memory fallback)
 */
export function isStorageDegraded(): boolean {
  return isFallbackMode || dbInstance === null
}

/**
 * Status mode penyimpanan aktif
 */
export function getStorageMode(): 'PERSISTED' | 'MEMORY_FALLBACK' {
  return isStorageDegraded() ? 'MEMORY_FALLBACK' : 'PERSISTED'
}

/**
 * Mendapatkan Status Lengkap Daya Tahan Penyimpanan (Sprint 9 S9-DB & S9-S8-08/09)
 */
export async function getStorageDurabilityStatus(): Promise<StorageDurabilityState> {
  if (typeof window !== 'undefined' && window.naradaDatabase) {
    try {
      return await window.naradaDatabase.getStatus()
    } catch (err: any) {
      return {
        status: 'FAILED',
        engine: 'SQLITE',
        lastError: err?.message || 'IPC error',
        recordCounts: {}
      }
    }
  }

  if (isFallbackMode) {
    return {
      status: 'DEGRADED',
      engine: 'MEMORY_FALLBACK',
      lastError: 'IndexedDB unavailable, running in memory-only fallback',
      recordCounts: {
        commentBatches: memoryFallback.commentBatches.size,
        commentRecords: memoryFallback.commentRecords.size,
        evidence: memoryFallback.evidenceRecords.size
      }
    }
  }

  return {
    status: 'PERSISTED',
    engine: 'INDEXED_DB',
    lastError: null,
    recordCounts: {}
  }
}

/**
 * Menjalankan Migrasi Otomatis dari IndexedDB v4 ke SQLite Main Process (Sprint 9 S9-MIG)
 */
export async function runIndexedDbToSqliteMigration(): Promise<{ success: boolean; stats?: any; error?: string }> {
  if (typeof window === 'undefined' || !window.naradaDatabase) {
    return { success: false, error: 'Lingkungan Electron SQLite tidak terdeteksi' }
  }

  try {
    const isCompleted = await window.naradaDatabase.isMigrationCompleted()
    if (isCompleted) {
      return { success: true, stats: { alreadyCompleted: true } }
    }

    const db = await initDB()
    const dump: Record<string, any[]> = {
      investigation_cases: [],
      evidence_records: [],
      evidence_artifacts: [],
      comment_batches: [],
      comment_records: [],
      comment_analysis_runs: [],
      comment_review_annotations: [],
      radar_cache: []
    }

    // Ambil riwayat kasus dari localStorage jika ada
    try {
      const rawCases = localStorage.getItem('narada_inv_cases_v2')
      if (rawCases) {
        dump.investigation_cases = JSON.parse(rawCases)
      }
    } catch (e) {
      console.warn('[Migration] Gagal mengekstrak kasus dari localStorage:', e)
    }

    // Jika IndexedDB ada dan dapat diakses, ekstrak seluruh tabel
    if (db) {
      const storeMappings: Array<{ store: string; target: string }> = [
        { store: STORES.EVIDENCE_RECORDS, target: 'evidence_records' },
        { store: STORES.EVIDENCE_ARTIFACTS, target: 'evidence_artifacts' },
        { store: STORES.COMMENT_BATCHES, target: 'comment_batches' },
        { store: STORES.COMMENT_RECORDS, target: 'comment_records' },
        { store: STORES.COMMENT_ANALYSIS_RUNS, target: 'comment_analysis_runs' },
        { store: STORES.COMMENT_REVIEW_ANNOTATIONS, target: 'comment_review_annotations' },
        { store: STORES.RADAR_CACHE, target: 'radar_cache' }
      ]

      for (const map of storeMappings) {
        if (db.objectStoreNames.contains(map.store)) {
          try {
            const records = await performTransaction<any[]>(map.store, 'readonly', (store) => store.getAll())
            dump[map.target] = records || []
          } catch (err) {
            console.warn(`[Migration] Peringatan pembacaan store ${map.store}:`, err)
          }
        }
      }
    }

    // Eksekusi impor transaksi ACID di Electron Main Process
    const importRes = await window.naradaDatabase.importDump(dump)
    return { success: true, stats: importRes.stats }
  } catch (err: any) {
    console.error('[Migration] Terjadi kegagalan saat migrasi IndexedDB ke SQLite:', err)
    return { success: false, error: err?.message || 'Migration failure' }
  }
}

// ─── SPRINT 09: HELPER PENYIMPANAN KLAIM & ASESMEN (WP-06) ───

/**
 * Menyimpan rekaman klaim ke IndexedDB / fallback memory
 */
export async function saveClaimToDB(claim: ClaimRecord): Promise<void> {
  if (isFallbackMode) {
    memoryFallback.claims.set(claim.id, claim)
    return
  }
  try {
    await performTransaction(STORES.CLAIMS, 'readwrite', (store) => store.put(claim))
  } catch {
    memoryFallback.claims.set(claim.id, claim)
  }
}

/**
 * Membaca rekaman klaim (opsional difilter berdasarkan articleId)
 */
export async function getClaimsFromDB(articleId?: string): Promise<ClaimRecord[]> {
  if (isFallbackMode) {
    const all = Array.from(memoryFallback.claims.values())
    return articleId ? all.filter(c => c.sourceArticleId === articleId) : all
  }
  try {
    const all = await performTransaction<ClaimRecord[]>(STORES.CLAIMS, 'readonly', (store) => store.getAll())
    return articleId ? (all || []).filter(c => c.sourceArticleId === articleId) : (all || [])
  } catch {
    const all = Array.from(memoryFallback.claims.values())
    return articleId ? all.filter(c => c.sourceArticleId === articleId) : all
  }
}

/**
 * Membaca klaim berdasarkan ID
 */
export async function getClaimByIdFromDB(claimId: string): Promise<ClaimRecord | null> {
  if (isFallbackMode) {
    return memoryFallback.claims.get(claimId) || null
  }
  try {
    const res = await performTransaction<ClaimRecord>(STORES.CLAIMS, 'readonly', (store) => store.get(claimId))
    return res || memoryFallback.claims.get(claimId) || null
  } catch {
    return memoryFallback.claims.get(claimId) || null
  }
}

/**
 * Menyimpan item bukti ke IndexedDB / fallback
 */
export async function saveEvidenceItemToDB(evidence: ClaimEvidenceItem): Promise<void> {
  if (isFallbackMode) {
    memoryFallback.evidence.set(evidence.id, evidence)
    return
  }
  try {
    await performTransaction(STORES.EVIDENCE, 'readwrite', (store) => store.put(evidence))
  } catch {
    memoryFallback.evidence.set(evidence.id, evidence)
  }
}

/**
 * Membaca seluruh item bukti (opsional berdasarkan claimId)
 */
export async function getEvidenceItemsFromDB(claimId?: string): Promise<ClaimEvidenceItem[]> {
  if (isFallbackMode) {
    const all = Array.from(memoryFallback.evidence.values())
    return claimId ? all.filter(e => e.claimId === claimId) : all
  }
  try {
    const all = await performTransaction<ClaimEvidenceItem[]>(STORES.EVIDENCE, 'readonly', (store) => store.getAll())
    return claimId ? (all || []).filter(e => e.claimId === claimId) : (all || [])
  } catch {
    const all = Array.from(memoryFallback.evidence.values())
    return claimId ? all.filter(e => e.claimId === claimId) : all
  }
}

/**
 * Menyimpan asesmen klaim ke IndexedDB / fallback
 */
export async function saveClaimAssessmentToDB(assessment: ClaimAssessmentRecord): Promise<void> {
  if (isFallbackMode) {
    memoryFallback.claimAssessments.set(assessment.claimId, assessment)
    return
  }
  try {
    await performTransaction(STORES.CLAIM_ASSESSMENTS, 'readwrite', (store) => store.put(assessment))
  } catch {
    memoryFallback.claimAssessments.set(assessment.claimId, assessment)
  }
}

/**
 * Membaca asesmen untuk satu klaim tertentu
 */
export async function getClaimAssessmentFromDB(claimId: string): Promise<ClaimAssessmentRecord | null> {
  if (isFallbackMode) {
    return memoryFallback.claimAssessments.get(claimId) || null
  }
  try {
    const res = await performTransaction<ClaimAssessmentRecord>(STORES.CLAIM_ASSESSMENTS, 'readonly', (store) => store.get(claimId))
    return res || memoryFallback.claimAssessments.get(claimId) || null
  } catch {
    return memoryFallback.claimAssessments.get(claimId) || null
  }
}

/**
 * Membaca seluruh asesmen klaim
 */
export async function getAllClaimAssessmentsFromDB(): Promise<ClaimAssessmentRecord[]> {
  if (isFallbackMode) {
    return Array.from(memoryFallback.claimAssessments.values())
  }
  try {
    const all = await performTransaction<ClaimAssessmentRecord[]>(STORES.CLAIM_ASSESSMENTS, 'readonly', (store) => store.getAll())
    return all || []
  } catch {
    return Array.from(memoryFallback.claimAssessments.values())
  }
}

/**
 * Menyimpan profil penerbit
 */
export async function savePublisherProfileToDB(publisher: PublisherProfile): Promise<void> {
  if (isFallbackMode) {
    memoryFallback.publishers.set(publisher.id, publisher)
    return
  }
  try {
    await performTransaction(STORES.PUBLISHERS, 'readwrite', (store) => store.put(publisher))
  } catch {
    memoryFallback.publishers.set(publisher.id, publisher)
  }
}

/**
 * Membaca profil penerbit berdasarkan ID atau nama domain
 */
export async function getPublisherProfileFromDB(idOrDomain: string): Promise<PublisherProfile | null> {
  if (isFallbackMode) {
    for (const p of memoryFallback.publishers.values()) {
      if (p.id === idOrDomain || p.registrableDomain === idOrDomain) return p
    }
    return null
  }
  try {
    const all = await performTransaction<PublisherProfile[]>(STORES.PUBLISHERS, 'readonly', (store) => store.getAll())
    return (all || []).find(p => p.id === idOrDomain || p.registrableDomain === idOrDomain) || null
  } catch {
    for (const p of memoryFallback.publishers.values()) {
      if (p.id === idOrDomain || p.registrableDomain === idOrDomain) return p
    }
    return null
  }
}

/**
 * Membaca seluruh penerbit terdaftar
 */
export async function getAllPublishersFromDB(): Promise<PublisherProfile[]> {
  if (isFallbackMode) {
    return Array.from(memoryFallback.publishers.values())
  }
  try {
    const all = await performTransaction<PublisherProfile[]>(STORES.PUBLISHERS, 'readonly', (store) => store.getAll())
    return all || []
  } catch {
    return Array.from(memoryFallback.publishers.values())
  }
}

/**
 * Menyimpan kandidat hasil pencarian / Dorking ke Database (Sprint 10)
 */
export async function saveDiscoveryCandidateToDB(candidate: SearchDiscoveryResult): Promise<void> {
  // 1. Sinkronisasi ke SQLite jika berjalan di lingkungan Electron
  if (typeof window !== 'undefined' && window.naradaDatabase?.saveDiscoveryCandidate) {
    try {
      await window.naradaDatabase.saveDiscoveryCandidate(candidate)
    } catch (err) {
      console.warn('[NARADA DB-Adapter] Sinkronisasi kandidat discovery ke SQLite gagal:', err)
    }
  }

  // 2. Simpan ke IndexedDB
  if (isFallbackMode) {
    memoryFallback.discoveryCandidates.set(candidate.id, candidate)
    return
  }

  try {
    await performTransaction(STORES.DISCOVERY_CANDIDATES, 'readwrite', (store) => store.put(candidate))
  } catch {
    memoryFallback.discoveryCandidates.set(candidate.id, candidate)
  }
}

/**
 * Mengambil kandidat discovery yang tersimpan
 */
export async function getDiscoveryCandidatesFromDB(platform?: TargetPlatform): Promise<SearchDiscoveryResult[]> {
  if (typeof window !== 'undefined' && window.naradaDatabase?.getDiscoveryCandidates) {
    try {
      const fromSqlite = await window.naradaDatabase.getDiscoveryCandidates(platform)
      if (Array.isArray(fromSqlite) && fromSqlite.length > 0) return fromSqlite
    } catch {
      // Fallback ke IndexedDB
    }
  }

  if (isFallbackMode) {
    const all = Array.from(memoryFallback.discoveryCandidates.values())
    return platform ? all.filter(c => c.targetPlatform === platform) : all
  }

  try {
    const all = await performTransaction<SearchDiscoveryResult[]>(STORES.DISCOVERY_CANDIDATES, 'readonly', (store) => store.getAll())
    const list = all || []
    return platform ? list.filter(c => c.targetPlatform === platform) : list
  } catch {
    const all = Array.from(memoryFallback.discoveryCandidates.values())
    return platform ? all.filter(c => c.targetPlatform === platform) : all
  }
}

/**
 * Menyimpan rekaman riwayat pemindaian radar (ScanRunLog)
 */
export async function saveScanRunLogToDB(log: ScanRunLog): Promise<void> {
  if (typeof window !== 'undefined' && window.naradaDatabase?.saveScanRunLog) {
    try {
      await window.naradaDatabase.saveScanRunLog(log)
    } catch (err) {
      console.warn('[NARADA DB-Adapter] Sinkronisasi riwayat scan ke SQLite gagal:', err)
    }
  }

  if (isFallbackMode) {
    memoryFallback.scanHistory.set(log.runId, log)
    return
  }

  try {
    await performTransaction(STORES.SCAN_HISTORY, 'readwrite', (store) => store.put(log))
  } catch {
    memoryFallback.scanHistory.set(log.runId, log)
  }
}

/**
 * Membaca riwayat pemindaian radar
 */
export async function getScanRunLogsFromDB(limit = 50): Promise<ScanRunLog[]> {
  if (typeof window !== 'undefined' && window.naradaDatabase?.getScanRunLogs) {
    try {
      const fromSqlite = await window.naradaDatabase.getScanRunLogs(limit)
      if (Array.isArray(fromSqlite) && fromSqlite.length > 0) return fromSqlite
    } catch {
      // Fallback
    }
  }

  if (isFallbackMode) {
    const all = Array.from(memoryFallback.scanHistory.values())
    return all.sort((a, b) => b.startedAt - a.startedAt).slice(0, limit)
  }

  try {
    const all = await performTransaction<ScanRunLog[]>(STORES.SCAN_HISTORY, 'readonly', (store) => store.getAll())
    return (all || []).sort((a, b) => b.startedAt - a.startedAt).slice(0, limit)
  } catch {
    const all = Array.from(memoryFallback.scanHistory.values())
    return all.sort((a, b) => b.startedAt - a.startedAt).slice(0, limit)
  }
}

/**
 * Menghapus data YouTube yang telah melampaui retensi 30 hari kalender (Section III.E.4)
 */
export async function purgeExpiredYouTubeDataFromDB(cutoffOrNow?: number): Promise<{ purgedCount: number }> {
  const RETENTION_MS = 30 * 24 * 60 * 60 * 1000
  let cutoff: number
  let now: number
  if (!cutoffOrNow) {
    now = Date.now()
    cutoff = now - RETENTION_MS
  } else if (cutoffOrNow < Date.now() - (15 * 86400000)) {
    // Caller already passed an absolute cutoff timestamp
    cutoff = cutoffOrNow
    now = cutoff + RETENTION_MS
  } else {
    now = cutoffOrNow
    cutoff = now - RETENTION_MS
  }
  let purgedCount = 0

  // 1. Bersihkan di SQLite jika tersedia
  if (typeof window !== 'undefined' && (window as any).naradaDatabase?.purgeExpiredYouTubeData) {
    try {
      const res = await (window as any).naradaDatabase.purgeExpiredYouTubeData(cutoff)
      if (res?.deletedCount) purgedCount += res.deletedCount
    } catch {
      // Fallback
    }
  }

  // 2. Bersihkan di Memory Fallback
  for (const [id, item] of memoryFallback.discoveryCandidates.entries()) {
    if (item.targetPlatform === 'youtube' && item.discoveredAt < cutoff) {
      memoryFallback.discoveryCandidates.delete(id)
      purgedCount++
    }
  }

  for (const [id, item] of memoryFallback.socialPosts.entries()) {
    if (item.platform === 'youtube' && (item.acquiredAt < cutoff || (item.retentionExpiresAt && item.retentionExpiresAt <= now))) {
      memoryFallback.socialPosts.delete(id)
      purgedCount++
    }
  }

  for (const [id, item] of memoryFallback.socialComments.entries()) {
    if (item.platform === 'youtube' && (item.acquiredAt < cutoff || (item.retentionExpiresAt && item.retentionExpiresAt <= now))) {
      memoryFallback.socialComments.delete(id)
      purgedCount++
    }
  }

  // 3. Bersihkan di IndexedDB
  if (!isFallbackMode) {
    try {
      const all = await performTransaction<SearchDiscoveryResult[]>(STORES.DISCOVERY_CANDIDATES, 'readonly', (store) => store.getAll())
      if (all) {
        for (const item of all) {
          if (item.targetPlatform === 'youtube' && item.discoveredAt < cutoff) {
            await performTransaction(STORES.DISCOVERY_CANDIDATES, 'readwrite', (store) => store.delete(item.id))
            purgedCount++
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return { purgedCount }
}

/**
 * Menghapus seluruh data YouTube API atas permintaan pengguna (User Data Deletion Request)
 */
export async function purgeAllYouTubeDataFromDB(): Promise<{ deletedCount: number }> {
  let deletedCount = 0

  if (typeof window !== 'undefined' && (window as any).naradaDatabase?.purgeAllYouTubeData) {
    try {
      const res = await (window as any).naradaDatabase.purgeAllYouTubeData()
      if (res?.deletedCount) deletedCount += res.deletedCount
    } catch {
      // Fallback
    }
  }

  for (const [id, item] of memoryFallback.discoveryCandidates.entries()) {
    if (item.targetPlatform === 'youtube') {
      memoryFallback.discoveryCandidates.delete(id)
      deletedCount++
    }
  }

  for (const [id, item] of memoryFallback.socialPosts.entries()) {
    if (item.platform === 'youtube') {
      memoryFallback.socialPosts.delete(id)
      deletedCount++
    }
  }

  for (const [id, item] of memoryFallback.socialComments.entries()) {
    if (item.platform === 'youtube') {
      memoryFallback.socialComments.delete(id)
      deletedCount++
    }
  }

  if (!isFallbackMode) {
    try {
      const all = await performTransaction<SearchDiscoveryResult[]>(STORES.DISCOVERY_CANDIDATES, 'readonly', (store) => store.getAll())
      if (all) {
        for (const item of all) {
          if (item.targetPlatform === 'youtube') {
            await performTransaction(STORES.DISCOVERY_CANDIDATES, 'readwrite', (store) => store.delete(item.id))
            deletedCount++
          }
        }
      }
      const allPosts = await performTransaction<SocialPostRecord[]>(STORES.SOCIAL_POSTS, 'readonly', (store) => store.getAll())
      if (allPosts) {
        for (const item of allPosts) {
          if (item.platform === 'youtube') {
            await performTransaction(STORES.SOCIAL_POSTS, 'readwrite', (store) => store.delete(item.id))
            deletedCount++
          }
        }
      }
      const allComments = await performTransaction<SocialCommentRecord[]>(STORES.SOCIAL_COMMENTS, 'readonly', (store) => store.getAll())
      if (allComments) {
        for (const item of allComments) {
          if (item.platform === 'youtube') {
            await performTransaction(STORES.SOCIAL_COMMENTS, 'readwrite', (store) => store.delete(item.id))
            deletedCount++
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return { deletedCount }
}

// ─── SPRINT 11: SOCIAL INTELLIGENCE PERSISTENCE ADAPTER ───

/**
 * Menyimpan rekaman konten sosial terakuisisi kanonikal ke SQLite / IndexedDB
 */
export async function saveSocialPostToDB(post: SocialPostRecord): Promise<{ success: boolean; id: string }> {
  if (typeof window !== 'undefined' && (window as any).naradaDatabase?.saveSocialPost) {
    try {
      const res = await (window as any).naradaDatabase.saveSocialPost(post)
      if (res?.success) return res
    } catch {
      // Fallback
    }
  }

  memoryFallback.socialPosts.set(post.id, post)
  if (!isFallbackMode) {
    try {
      await performTransaction(STORES.SOCIAL_POSTS, 'readwrite', (store) => store.put(post))
    } catch {
      // Memory fallback aktif
    }
  }

  return { success: true, id: post.id }
}

/**
 * Mengambil daftar konten sosial terakuisisi dengan filter opsional
 */
export async function getSocialPostsFromDB(filter?: {
  platform?: TargetPlatform
  issueId?: string
  limit?: number
}): Promise<SocialPostRecord[]> {
  if (typeof window !== 'undefined' && (window as any).naradaDatabase?.getSocialPosts) {
    try {
      const res = await (window as any).naradaDatabase.getSocialPosts(filter)
      if (Array.isArray(res)) return res
    } catch {
      // Fallback
    }
  }

  let posts = Array.from(memoryFallback.socialPosts.values())
  if (filter?.platform) {
    posts = posts.filter(p => p.platform === filter.platform)
  }
  if (filter?.issueId) {
    posts = posts.filter(p => p.issueId === filter.issueId)
  }

  posts.sort((a, b) => b.acquiredAt - a.acquiredAt)
  if (filter?.limit) {
    posts = posts.slice(0, filter.limit)
  }
  return posts
}

/**
 * Menyimpan batch komentar sosial terakuisisi
 */
export async function saveSocialCommentsToDB(comments: SocialCommentRecord[]): Promise<{ success: boolean; count: number }> {
  if (typeof window !== 'undefined' && (window as any).naradaDatabase?.saveSocialComments) {
    try {
      const res = await (window as any).naradaDatabase.saveSocialComments(comments)
      if (res?.success) return res
    } catch {
      // Fallback
    }
  }

  for (const c of comments) {
    memoryFallback.socialComments.set(c.id, c)
  }

  if (!isFallbackMode) {
    try {
      await Promise.all(
        comments.map(c => performTransaction(STORES.SOCIAL_COMMENTS, 'readwrite', (store) => store.put(c)))
      )
    } catch {
      // Memory fallback aktif
    }
  }

  return { success: true, count: comments.length }
}

/**
 * Mengambil komentar sosial terakuisisi berdasarkan postId
 */
export async function getSocialCommentsFromDB(postId?: string, limit = 200): Promise<SocialCommentRecord[]> {
  if (typeof window !== 'undefined' && (window as any).naradaDatabase?.getSocialComments) {
    try {
      const res = await (window as any).naradaDatabase.getSocialComments(postId, limit)
      if (Array.isArray(res)) return res
    } catch {
      // Fallback
    }
  }

  let comments = Array.from(memoryFallback.socialComments.values())
  if (postId) {
    comments = comments.filter(c => c.postId === postId)
  }
  comments.sort((a, b) => b.acquiredAt - a.acquiredAt)
  return comments.slice(0, limit)
}

/**
 * Menyimpan snapshot eksekusi automated social intelligence run
 */
export async function saveSocialAnalysisRunToDB(run: SocialAnalysisRunSummary): Promise<{ success: boolean; runId: string }> {
  if (typeof window !== 'undefined' && (window as any).naradaDatabase?.saveSocialAnalysisRun) {
    try {
      const res = await (window as any).naradaDatabase.saveSocialAnalysisRun(run)
      if (res?.success) return res
    } catch {
      // Fallback
    }
  }

  memoryFallback.socialAnalysisRuns.set(run.runId, run)
  if (!isFallbackMode) {
    try {
      await performTransaction(STORES.SOCIAL_ANALYSIS_RUNS, 'readwrite', (store) => store.put(run))
    } catch {
      // Memory fallback aktif
    }
  }

  return { success: true, runId: run.runId }
}

/**
 * Mengambil riwayat run automated social intelligence
 */
export async function getSocialAnalysisRunsFromDB(issueId?: string, limit = 50): Promise<SocialAnalysisRunSummary[]> {
  if (typeof window !== 'undefined' && (window as any).naradaDatabase?.getSocialAnalysisRuns) {
    try {
      const res = await (window as any).naradaDatabase.getSocialAnalysisRuns(issueId, limit)
      if (Array.isArray(res)) return res
    } catch {
      // Fallback
    }
  }

  let runs = Array.from(memoryFallback.socialAnalysisRuns.values())
  if (issueId) {
    runs = runs.filter(r => r.issueId === issueId)
  }
  runs.sort((a, b) => b.startedAt - a.startedAt)
  return runs.slice(0, limit)
}




