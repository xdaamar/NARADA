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

import type { DebunkKnowledgeEntry } from '../../types.ts'
import { fetchLiveRadarDebunks, type LiveRadarFetchResult } from '../data/live-radar-service.ts'
import { registerLiveDebunks } from '../data/debunk-service.ts'
import { cacheRadarItems, getCachedRadarItems } from '../../utils/db-adapter.ts'
import sourceCatalog from '../../../shared/radar-source-catalog.json' with { type: 'json' }

export type CircuitBreakerStatus = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface SourceScheduleState {
  sourceId: string
  pollIntervalMs: number
  lastAttemptAt: number | null
  lastSuccessAt: number | null
  nextDueAt: number
  consecutiveFailures: number
  circuitBreakerStatus: CircuitBreakerStatus
  circuitBreakerOpenUntil: number | null
  rateLimitResetAt: number | null
}

export interface RadarSchedulerStatus {
  isRunning: boolean
  intervalHours: number
  lastSyncTimestamp: number | null
  nextSyncTimestamp: number | null
  totalEntries: number
  lastSyncSource: string
  isSyncing: boolean
  sourceStates?: Record<string, SourceScheduleState>
}

type RadarUpdateListener = (entries: DebunkKnowledgeEntry[]) => void

// Concurrency queue manager
class ConcurrencyLimiter {
  private activeCount = 0
  private maxConcurrent = sourceCatalog.concurrencyPolicy?.maxGlobalConcurrent || 3
  private queue: Array<() => void> = []

  public async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeCount >= this.maxConcurrent) {
      await new Promise<void>(resolve => this.queue.push(resolve))
    }
    this.activeCount++
    try {
      return await fn()
    } finally {
      this.activeCount--
      if (this.queue.length > 0) {
        const next = this.queue.shift()
        if (next) next()
      }
    }
  }

  public getActiveCount(): number {
    return this.activeCount
  }
}

export const radarConcurrencyLimiter = new ConcurrencyLimiter()

export class RadarSchedulerEngine {
  private timerId: ReturnType<typeof setInterval> | null = null
  private intervalHours: number = 1
  private lastSyncTimestamp: number | null = null
  private nextSyncTimestamp: number | null = null
  private isSyncing: boolean = false
  private lastSyncSource: string = 'INITIAL'
  private broadcastChannel: BroadcastChannel | null = null
  private listeners: Set<RadarUpdateListener> = new Set()
  private sourceStates: Map<string, SourceScheduleState> = new Map()

  constructor() {
    // Inisialisasi status per sumber dari katalog
    const now = Date.now()
    sourceCatalog.sources.forEach(src => {
      const pollMs = src.pollIntervalMs || 900000
      this.sourceStates.set(src.id, {
        sourceId: src.id,
        pollIntervalMs: pollMs,
        lastAttemptAt: null,
        lastSuccessAt: null,
        nextDueAt: now, // Langsung siap untuk percobaan awal
        consecutiveFailures: 0,
        circuitBreakerStatus: 'CLOSED',
        circuitBreakerOpenUntil: null,
        rateLimitResetAt: null
      })
    })

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
   * Mengambil status penjadwalan sumber tertentu
   */
  public getSourceScheduleState(sourceId: string): SourceScheduleState | undefined {
    return this.sourceStates.get(sourceId)
  }

  /**
   * Mengambil seluruh status jadwal sumber
   */
  public getAllSourceScheduleStates(): Record<string, SourceScheduleState> {
    const res: Record<string, SourceScheduleState> = {}
    this.sourceStates.forEach((v, k) => { res[k] = { ...v } })
    return res
  }

  /**
   * Memeriksa apakah sumber telah tiba saatnya untuk diambil (Due)
   */
  public isSourceDue(sourceId: string, now = Date.now()): boolean {
    const state = this.sourceStates.get(sourceId)
    if (!state) return false

    // Periksa apakah sedang terkena Rate Limit HTTP 429
    if (state.rateLimitResetAt && now < state.rateLimitResetAt) {
      return false
    }

    // Periksa status Circuit Breaker
    if (state.circuitBreakerStatus === 'OPEN') {
      if (state.circuitBreakerOpenUntil && now >= state.circuitBreakerOpenUntil) {
        // Transisi ke HALF_OPEN untuk mencoba 1 probe
        state.circuitBreakerStatus = 'HALF_OPEN'
        return true
      }
      return false
    }

    return now >= state.nextDueAt
  }

  /**
   * Mencatat hasil percobaan fetch per-sumber dan memperbarui Circuit Breaker
   */
  public recordSourceAttempt(
    sourceId: string,
    success: boolean,
    httpStatus?: number | null,
    retryAfterSec?: number | null
  ): void {
    const state = this.sourceStates.get(sourceId)
    if (!state) return

    const now = Date.now()
    state.lastAttemptAt = now

    const jitterMax = sourceCatalog.concurrencyPolicy?.requestJitterMaxMs || 3000
    const jitter = Math.floor(Math.random() * jitterMax)

    if (success) {
      state.lastSuccessAt = now
      state.consecutiveFailures = 0
      state.circuitBreakerStatus = 'CLOSED'
      state.circuitBreakerOpenUntil = null
      state.rateLimitResetAt = null
      state.nextDueAt = now + state.pollIntervalMs + jitter
    } else {
      state.consecutiveFailures++

      // Penanganan HTTP 429 Rate Limited
      if (httpStatus === 429) {
        const sec = retryAfterSec || 60
        state.rateLimitResetAt = now + sec * 1000
        state.nextDueAt = state.rateLimitResetAt + jitter
      }

      // Circuit Breaker: Buka jika gagal >= 3 kali berturut-turut
      const threshold = sourceCatalog.concurrencyPolicy?.circuitBreakerThreshold || 3
      if (state.consecutiveFailures >= threshold) {
        const cooldownMs = sourceCatalog.concurrencyPolicy?.circuitBreakerCooldownMs || 1800000
        state.circuitBreakerStatus = 'OPEN'
        state.circuitBreakerOpenUntil = now + cooldownMs
        state.nextDueAt = state.circuitBreakerOpenUntil + jitter
      } else {
        // Eksponensial backoff sederhana
        const backoffMs = Math.min(30000 * Math.pow(2, state.consecutiveFailures - 1), 300000)
        state.nextDueAt = now + backoffMs + jitter
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
    this.listeners.forEach((callback) => {
      try {
        callback(entries)
      } catch (err) {
        console.error('[RadarScheduler] Listener callback error:', err)
      }
    })

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
      sourceStates: this.getAllSourceScheduleStates()
    }
  }
}

// Export singleton scheduler
export const radarScheduler = new RadarSchedulerEngine()
