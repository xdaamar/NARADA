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
import type { TopicCandidate } from '../engine/radar/radar-types.ts'
import type { EvidenceRecord } from '../engine/investigation/investigation-types.ts'
import type {
  CommentBatch,
  CommentRecord,
  CommentAnalysisRun,
  CommentReviewAnnotation
} from '../engine/intelligence/comment-types.ts'

const DB_NAME = 'narada_tactical_db'
const DB_VERSION = 4 // Upgraded from DB_VERSION = 3 (Sprint 7) and DB_VERSION = 2 (Sprint 6)

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
    return Array.isArray(list) ? list : []
  } catch {
    return Array.from(memoryFallback.radarCache.values())
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

