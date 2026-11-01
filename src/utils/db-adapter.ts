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

const DB_NAME = 'narada_tactical_db'
const DB_VERSION = 2

export const STORES = {
  ANALYSES: 'analyses',
  RADAR_CACHE: 'radar_cache',
  IMAGE_STORE: 'image_store',
  TOPIC_CANDIDATES: 'topic_candidates',
  ISSUE_ACTIVITY_SNAPSHOTS: 'issue_activity_snapshots',
  SOURCE_RUN_LOG: 'source_run_log',
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

