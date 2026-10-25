/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA OSINT RADAR SCHEDULER: BACKGROUND LIVE SYNC ENGINE
 * PUSSIBERAD TNI AD × CODEPOLITAN — KARTIKA CYBER HACKATHON 2026
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Scheduler Mandiri di Luar Lifecycle Komponen UI:
 * 1. Menjalankan penarikan feed berkala (1j, 2j, 6j, 12j, atau manual).
 * 2. Deduplikasi otomatis berbasis ID dan claim hash.
 * 3. Persistensi otomatis ke IndexedDB (db-adapter.ts).
 * 4. Penyiaran multi-tab via BroadcastChannel & CustomEvent.
 * ══════════════════════════════════════════════════════════════════════════
 */

import type { DebunkKnowledgeEntry } from '../../types'
import { fetchLiveRadarDebunks, type LiveRadarFetchResult } from '../data/live-radar-service'
import { registerLiveDebunks } from '../data/debunk-service'
import { cacheRadarItems, getCachedRadarItems } from '../../utils/db-adapter'

export interface RadarSchedulerStatus {
  isRunning: boolean
  intervalHours: number
  lastSyncTimestamp: number | null
  nextSyncTimestamp: number | null
  totalEntries: number
  lastSyncSource: string
  isSyncing: boolean
}

type RadarUpdateListener = (entries: DebunkKnowledgeEntry[]) => void

class RadarSchedulerEngine {
  private timerId: ReturnType<typeof setInterval> | null = null
  private intervalHours: number = 1
  private lastSyncTimestamp: number | null = null
  private nextSyncTimestamp: number | null = null
  private isSyncing: boolean = false
  private lastSyncSource: string = 'INITIAL'
  private broadcastChannel: BroadcastChannel | null = null
  private listeners: Set<RadarUpdateListener> = new Set()

  constructor() {
    // Inisialisasi BroadcastChannel jika didukung peramban
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('narada_radar_channel')
        this.broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'RADAR_UPDATED' && Array.isArray(event.data.entries)) {
            this.notifyListeners(event.data.entries, false)
          }
        }
      } catch (e) {
        console.warn('[RadarScheduler] BroadcastChannel tidak dapat dibuka:', e)
      }
    }
  }

  /**
   * Menjalankan scheduler background
   */
  public start(intervalHours: number = 1): void {
    this.intervalHours = intervalHours

    if (this.timerId) {
      clearInterval(this.timerId)
      this.timerId = null
    }

    if (intervalHours > 0) {
      const intervalMs = intervalHours * 60 * 60 * 1000
      this.nextSyncTimestamp = Date.now() + intervalMs

      this.timerId = setInterval(() => {
        this.triggerNow().catch((err) => {
          console.error('[RadarScheduler] Auto-sync background error:', err)
        })
      }, intervalMs)
    } else {
      this.nextSyncTimestamp = null
    }
  }

  /**
   * Menghentikan scheduler
   */
  public stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId)
      this.timerId = null
    }
    this.nextSyncTimestamp = null
  }

  /**
   * Mengubah interval sinkronisasi
   */
  public setIntervalHours(hours: number): void {
    this.intervalHours = hours
    if (this.timerId || hours > 0) {
      this.start(hours)
    }
  }

  /**
   * Memicu sinkronisasi instan secara on-demand
   */
  public async triggerNow(): Promise<DebunkKnowledgeEntry[]> {
    if (this.isSyncing) {
      // Jika sedang berlangsung, kembalikan data yang tersimpan
      return getCachedRadarItems()
    }

    this.isSyncing = true

    try {
      const result: LiveRadarFetchResult = await fetchLiveRadarDebunks()
      const entries = result.entries || []

      this.lastSyncTimestamp = Date.now()
      this.lastSyncSource = result.sourceChannel

      if (this.intervalHours > 0) {
        this.nextSyncTimestamp = Date.now() + this.intervalHours * 60 * 60 * 1000
      }

      // 1. Simpan ke in-memory service
      registerLiveDebunks(entries)

      // 2. Simpan ke IndexedDB cache
      await cacheRadarItems(entries)

      // 3. Notifikasi seluruh subscriber & penyiaran multi-tab
      this.notifyListeners(entries, true)

      return entries
    } finally {
      this.isSyncing = false
    }
  }

  /**
   * Memberitahu subscriber dan menyiarkan event
   */
  private notifyListeners(entries: DebunkKnowledgeEntry[], shouldBroadcast: boolean): void {
    // Panggil direct listener callbacks
    this.listeners.forEach((callback) => {
      try {
        callback(entries)
      } catch (err) {
        console.error('[RadarScheduler] Listener callback error:', err)
      }
    })

    // Siarkan ke jendela/tab lain via BroadcastChannel
    if (shouldBroadcast && this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'RADAR_UPDATED',
          entries,
          timestamp: Date.now(),
        })
      } catch (e) {
        console.warn('[RadarScheduler] BroadcastChannel postMessage error:', e)
      }
    }

    // Picu window CustomEvent untuk komponen React
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('narada:radar-updated', {
          detail: entries,
        })
      )
    }
  }

  /**
   * Menambahkan listener perubahan radar
   */
  public addListener(callback: RadarUpdateListener): () => void {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  /**
   * Mengambil status runtime scheduler
   */
  public getStatus(): RadarSchedulerStatus {
    return {
      isRunning: this.timerId !== null,
      intervalHours: this.intervalHours,
      lastSyncTimestamp: this.lastSyncTimestamp,
      nextSyncTimestamp: this.nextSyncTimestamp,
      totalEntries: this.listeners.size,
      lastSyncSource: this.lastSyncSource,
      isSyncing: this.isSyncing,
    }
  }
}

// Export singleton scheduler
export const radarScheduler = new RadarSchedulerEngine()
