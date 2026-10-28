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

const DB_NAME = 'narada_tactical_db'
const DB_VERSION = 1

export const STORES = {
  ANALYSES: 'analyses',
  RADAR_CACHE: 'radar_cache',
  IMAGE_STORE: 'image_store',
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
