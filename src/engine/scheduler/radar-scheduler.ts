/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA OSINT RADAR SCHEDULER: BACKGROUND LIVE SYNC ENGINE
 * PUSSIBERAD TNI AD × CODEPOLITAN — KARTIKA CYBER HACKATHON 2026
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Scheduler Mandiri Per-Sumber & Concurrency Manager (Sprint 6.1 WP1 & WP2):
 * 1. Menjalankan penarikan per-sumber berdasarkan kadensi independen masing-masing (bukan 1 jam global).
 * 2. Menegakkan konkurensi global maksimal (3 parallel requests).
 * 3. Menjalankan Circuit Breaker per-sumber (CLOSED -> OPEN -> HALF_OPEN probe).
 * 4. Menjalankan eksekusi Dynamic Topic Discovery secara otomatis.
 * 5. Mengirimkan hasil ke saluran ingesti kanonikal dan menyiarkan via BroadcastChannel.
 * ══════════════════════════════════════════════════════════════════════════
 */

import type { DebunkKnowledgeEntry } from '../../types.ts'
import { 
  fetchSingleRadarSource, 
  executeDynamicSearchQuery, 
  processRadarIngestion,
  type SingleSourceFetchResult 
} from '../data/live-radar-service.ts'
import { getCachedRadarItems, saveScanRunLogToDB } from '../../utils/db-adapter.ts'
import { topicDiscoveryEngine } from '../radar/topic-discovery-engine.ts'
import type { NormalizedPublication, SearchTrendSignal } from '../radar/radar-types.ts'
import type { ScanRunLog } from '../acquisition/source-contracts.ts'
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
  tickIntervalMs: number
  intervalHours?: number
  intervalMinutes?: number
  lastSyncTimestamp: number | null
  nextSyncTimestamp: number | null
  totalEntries: number
  lastSyncSource: string
  isSyncing: boolean
  sourceStates?: Record<string, SourceScheduleState>
  lastScanStartedAt?: number | null
  lastScanCompletedAt?: number | null
  lastSuccessfulScanAt?: number | null
  lastSourceResponseAt?: number | null
  lastNewItemReceivedAt?: number | null
  nextScheduledAt?: number | null
  scanDurationMs?: number
}

type RadarUpdateListener = (entries: DebunkKnowledgeEntry[]) => void

// Concurrency queue manager (Enforces Global Concurrency across feeds + dynamic searches)
export class ConcurrencyLimiter {
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

  public getQueueLength(): number {
    return this.queue.length
  }

  public getMaxConcurrent(): number {
    return this.maxConcurrent
  }
}

export const radarConcurrencyLimiter = new ConcurrencyLimiter()

export class RadarSchedulerEngine {
  private timerId: ReturnType<typeof setInterval> | null = null
  private tickIntervalMs: number = 10000
  private intervalMinutes: number = 30 // SPRINT 10: Default interval 30 menit
  private intervalHours: number = 0.5 // Backward-compatibility display
  private lastSyncTimestamp: number | null = null
  private nextSyncTimestamp: number | null = null
  private isSyncing: boolean = false
  private lastSyncSource: string = 'INITIAL'
  private broadcastChannel: BroadcastChannel | null = null
  private listeners: Set<RadarUpdateListener> = new Set()
  private sourceStates: Map<string, SourceScheduleState> = new Map()

  // SPRINT 10: Metrik waktu eksekusi presisi & riwayat scan
  private lastScanStartedAt: number | null = null
  private lastScanCompletedAt: number | null = null
  private lastSuccessfulScanAt: number | null = null
  private lastSourceResponseAt: number | null = null
  private lastNewItemReceivedAt: number | null = null
  private nextScheduledAt: number | null = null
  private scanDurationMs: number = 0
  private catchupExecuted: boolean = false
  private scanHistory: ScanRunLog[] = []
  private activeScanPromise: Promise<DebunkKnowledgeEntry[]> | null = null

  constructor() {
    this.initSourceStates()

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

  private initSourceStates(): void {
    const now = Date.now()
    sourceCatalog.sources.forEach(src => {
      const pollMs = src.pollIntervalMs || 900000
      this.sourceStates.set(src.id, {
        sourceId: src.id,
        pollIntervalMs: pollMs,
        lastAttemptAt: null,
        lastSuccessAt: null,
        nextDueAt: now,
        consecutiveFailures: 0,
        circuitBreakerStatus: 'CLOSED',
        circuitBreakerOpenUntil: null,
        rateLimitResetAt: null
      })
    })
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
   * Memeriksa apakah sumber telah tiba saatnya untuk diambil (Due) (WP1 / S61-01 s.d. S61-04)
   */
  public isSourceDue(sourceId: string, now = Date.now()): boolean {
    const state = this.sourceStates.get(sourceId)
    if (!state) return false

    // 1. Rate Limit HTTP 429
    if (state.rateLimitResetAt && now < state.rateLimitResetAt) {
      return false
    }

    // 2. Circuit Breaker OPEN / HALF_OPEN
    if (state.circuitBreakerStatus === 'OPEN') {
      if (state.circuitBreakerOpenUntil && now >= state.circuitBreakerOpenUntil) {
        // Cooldown berakhir -> Transisi ke HALF_OPEN untuk mencoba 1 probe
        state.circuitBreakerStatus = 'HALF_OPEN'
        state.nextDueAt = now + 60000 // Beri jeda agar tidak ada probe kedua sebelum selesai
        return true
      }
      return false
    }

    if (state.circuitBreakerStatus === 'HALF_OPEN') {
      // Sedang dalam probe satu-satunya
      return true
    }

    return now >= state.nextDueAt
  }

  /**
   * Mencatat hasil percobaan fetch per-sumber dan memperbarui Circuit Breaker (WP1 / S61-04, S61-05)
   */
  public recordSourceAttempt(
    sourceId: string,
    success: boolean,
    httpStatus?: number | null,
    retryAfterSec?: number | null,
    now = Date.now()
  ): void {
    const state = this.sourceStates.get(sourceId)
    if (!state) return

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
      this.lastSourceResponseAt = now
    } else {
      state.consecutiveFailures++
      this.lastSourceResponseAt = now

      // HTTP 429 Rate Limited
      if (httpStatus === 429) {
        const sec = retryAfterSec || 60
        state.rateLimitResetAt = now + sec * 1000
        state.nextDueAt = state.rateLimitResetAt + jitter
      }

      // Circuit Breaker: jika gagal pada status HALF_OPEN atau consecutiveFailures >= threshold
      const threshold = sourceCatalog.concurrencyPolicy?.circuitBreakerThreshold || 3
      if (state.circuitBreakerStatus === 'HALF_OPEN' || state.consecutiveFailures >= threshold) {
        const cooldownMs = sourceCatalog.concurrencyPolicy?.circuitBreakerCooldownMs || 1800000
        state.circuitBreakerStatus = 'OPEN'
        state.circuitBreakerOpenUntil = now + cooldownMs
        state.nextDueAt = state.circuitBreakerOpenUntil + jitter
      } else {
        // Eksponensial backoff dengan batas maksimal 5 menit
        const backoffMs = Math.min(30000 * Math.pow(2, state.consecutiveFailures - 1), 300000)
        state.nextDueAt = now + backoffMs + jitter
      }
    }
  }

  /**
   * Scheduler Tick internal yang memeriksa dan mengeksekusi sumber yang sedang Due (WP1 / S61-01 s.d. S61-06)
   */
  public async schedulerTick(now = Date.now(), customFetch?: typeof fetch): Promise<DebunkKnowledgeEntry[]> {
    if (this.isSyncing) {
      if (this.activeScanPromise) {
        try {
          return await this.activeScanPromise
        } catch {
          return getCachedRadarItems()
        }
      }
      return getCachedRadarItems()
    }

    const tickTask = (async () => {
      this.isSyncing = true
      this.lastScanStartedAt = now
      const runStart = Date.now()

      let connectorsAttempted = 0
      let connectorsSucceeded = 0
      let connectorsFailed = 0
      let rateLimitHits = 0
      const errors: Array<{ connectorId: string; code: string; message: string }> = []

      try {
        const enabledSources = sourceCatalog.sources.filter(s => s.enabled)
        const dueSources = enabledSources.filter(s => this.isSourceDue(s.id, now))

        const incomingPubs: NormalizedPublication[] = []
        const incomingTrends: SearchTrendSignal[] = []

        // 1. Eksekusi Feed Sumber yang sedang Due melalui Concurrency Limiter
        const fetchTasks = dueSources.map(src => {
          connectorsAttempted++
          return radarConcurrencyLimiter.run(async () => {
            const res: SingleSourceFetchResult = await fetchSingleRadarSource(src.id, customFetch)
            this.recordSourceAttempt(src.id, res.success, res.httpStatus, res.retryAfterSec, Date.now())
            if (res.success) {
              connectorsSucceeded++
              if (res.publications) incomingPubs.push(...res.publications)
              if (res.trendSignals) incomingTrends.push(...res.trendSignals)
            } else {
              connectorsFailed++
              if (res.httpStatus === 429) rateLimitHits++
              errors.push({
                connectorId: src.id,
                code: res.errorCode || 'FETCH_FAILED',
                message: res.errorMessage || 'Gagal mengambil data'
              })
            }
            return res
          })
        })

        // 2. Eksekusi Pencarian Topik Dinamis melalui Concurrency Limiter yang SAMA (WP2 / S61-09 s.d. S61-14)
        const maxDynamicPerCycle = sourceCatalog.dynamicSearchPolicy?.maxDynamicQueriesPerCycle || 2
        const candidateList = topicDiscoveryEngine.selectCandidatesForSearch(maxDynamicPerCycle)

        const searchTasks = candidateList.map(cand => {
          return radarConcurrencyLimiter.run(async () => {
            const res: SingleSourceFetchResult = await executeDynamicSearchQuery(cand, customFetch)
            if (res.success && res.publications) {
              incomingPubs.push(...res.publications)
            }
            return res
          })
        })

        await Promise.allSettled([...fetchTasks, ...searchTasks])

        const completionTime = Date.now()
        this.lastScanCompletedAt = completionTime
        this.scanDurationMs = completionTime - runStart
        this.nextScheduledAt = completionTime + (this.intervalMinutes * 60 * 1000)

        // Catat log hasil pemindaian
        const scanLog: ScanRunLog = {
          runId: `scan-${now}-${Math.random().toString(36).slice(2, 7)}`,
          triggerType: 'AUTO',
          startedAt: runStart,
          completedAt: completionTime,
          durationMs: this.scanDurationMs,
          connectorsAttempted,
          connectorsSucceeded,
          connectorsFailed,
          itemsDiscovered: incomingPubs.length + incomingTrends.length,
          itemsAccepted: incomingPubs.length + incomingTrends.length,
          itemsRejected: 0,
          duplicatesCount: 0,
          rateLimitHits,
          errors
        }
        this.scanHistory.unshift(scanLog)
        if (this.scanHistory.length > 50) this.scanHistory.pop()
        saveScanRunLogToDB(scanLog).catch(() => {})

        // 3. Masukkan hasil ke Ingesti Kanonikal jika ada data baru
        if (incomingPubs.length > 0 || incomingTrends.length > 0) {
          const liveResult = await processRadarIngestion(incomingPubs, incomingTrends, now)
          this.lastSyncTimestamp = now
          this.lastSuccessfulScanAt = completionTime
          this.lastNewItemReceivedAt = completionTime
          this.lastSyncSource = 'SCHEDULER_TICK'
          this.notifyListeners(liveResult.entries, true)
          return liveResult.entries
        }

        return getCachedRadarItems()
      } finally {
        this.isSyncing = false
      }
    })()

    this.activeScanPromise = tickTask
    try {
      return await tickTask
    } finally {
      this.activeScanPromise = null
    }
  }

  /**
   * Menjalankan scheduler background dengan interval tick pendek (misal 10 detik) (WP1)
   */
  public start(tickIntervalMs: number = 10000): void {
    this.tickIntervalMs = tickIntervalMs

    if (this.timerId) {
      clearInterval(this.timerId)
      this.timerId = null
    }

    if (tickIntervalMs > 0) {
      this.nextSyncTimestamp = Date.now() + tickIntervalMs
      this.nextScheduledAt = Date.now() + (this.intervalMinutes * 60 * 1000)

      this.timerId = setInterval(() => {
        this.schedulerTick().catch((err) => {
          console.error('[RadarScheduler] Auto-sync tick error:', err)
        })
      }, tickIntervalMs)
    } else {
      this.nextSyncTimestamp = null
      this.nextScheduledAt = null
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
    this.nextScheduledAt = null
  }

  /**
   * Mengubah interval sinkronisasi dalam menit (Standar Sprint 10: 30 menit default)
   */
  public setIntervalMinutes(mins: number): void {
    this.intervalMinutes = mins
    this.intervalHours = mins / 60
    if (mins > 0) {
      this.nextScheduledAt = Date.now() + (mins * 60 * 1000)
      if (!this.timerId) {
        this.start(this.tickIntervalMs)
      }
    } else {
      this.nextScheduledAt = null
    }
  }

  /**
   * Mengubah interval sinkronisasi (kompatibilitas backward)
   */
  public setIntervalHours(hours: number): void {
    this.intervalHours = hours
    this.intervalMinutes = Math.round(hours * 60)
    if (hours > 0) {
      this.nextScheduledAt = Date.now() + (this.intervalMinutes * 60 * 1000)
      if (!this.timerId) {
        this.start(this.tickIntervalMs)
      }
    } else {
      this.nextScheduledAt = null
    }
  }

  /**
   * Memeriksa apakah startup catch-up scan diperlukan setelah restart aplikasi
   */
  public isCatchupNeeded(now = Date.now()): boolean {
    if (this.catchupExecuted) return false
    if (!this.lastScanCompletedAt) return true
    const elapsed = now - this.lastScanCompletedAt
    return elapsed >= (this.intervalMinutes * 60 * 1000)
  }

  /**
   * Menjalankan pemindaian catch-up saat startup (dibatasi 1x per startup)
   */
  public async performStartupCatchup(_now = Date.now(), customFetch?: typeof fetch): Promise<DebunkKnowledgeEntry[] | null> {
    if (this.catchupExecuted || this.isSyncing) return null
    this.catchupExecuted = true
    return this.triggerNow(customFetch, 'STARTUP_CATCHUP')
  }

  /**
   * Mengambil riwayat pemindaian terkini
   */
  public getScanHistory(): ScanRunLog[] {
    return [...this.scanHistory]
  }

  /**
   * Memicu sinkronisasi instan secara on-demand (Manual Refresh)
   * Menghormati Circuit Breaker OPEN & HTTP 429 Retry-After, dan melalui Global Concurrency Limiter
   */
  public async triggerNow(
    customFetch?: typeof fetch,
    triggerType: 'MANUAL' | 'STARTUP_CATCHUP' = 'MANUAL'
  ): Promise<DebunkKnowledgeEntry[]> {
    if (this.isSyncing) {
      if (this.activeScanPromise) {
        try {
          const inFlightRes = await this.activeScanPromise
          if (inFlightRes && inFlightRes.length > 0) {
            return inFlightRes
          }
        } catch {
          // Abaikan kegagalan in-flight dan lanjutkan eksekusi manual segar
        }
      } else {
        const elapsed = Date.now() - (this.lastScanStartedAt || 0)
        if (elapsed < 25000) {
          return getCachedRadarItems()
        }
      }
      this.isSyncing = false
    }

    const manualTask = (async () => {
      this.isSyncing = true
      const runStart = Date.now()
      this.lastScanStartedAt = runStart

      let connectorsAttempted = 0
      let connectorsSucceeded = 0
      let connectorsFailed = 0
      let rateLimitHits = 0
      const errors: Array<{ connectorId: string; code: string; message: string }> = []

      try {
        const now = Date.now()
        const enabledSources = sourceCatalog.sources.filter(s => s.enabled)
        
        // Pilih sumber yang diizinkan (tidak sedang OPEN dan tidak sedang 429)
        const eligibleSources = enabledSources.filter(src => {
          const state = this.sourceStates.get(src.id)
          if (!state) return true
          if (state.rateLimitResetAt && now < state.rateLimitResetAt) return false
          if (state.circuitBreakerStatus === 'OPEN' && state.circuitBreakerOpenUntil && now < state.circuitBreakerOpenUntil) return false
          return true
        })

        const incomingPubs: NormalizedPublication[] = []
        const incomingTrends: SearchTrendSignal[] = []

        const fetchTasks = eligibleSources.map(src => {
          connectorsAttempted++
          return radarConcurrencyLimiter.run(async () => {
            const res = await fetchSingleRadarSource(src.id, customFetch)
            this.recordSourceAttempt(src.id, res.success, res.httpStatus, res.retryAfterSec, Date.now())
            if (res.success) {
              connectorsSucceeded++
              if (res.publications) incomingPubs.push(...res.publications)
              if (res.trendSignals) incomingTrends.push(...res.trendSignals)
            } else {
              connectorsFailed++
              if (res.httpStatus === 429) rateLimitHits++
              errors.push({
                connectorId: src.id,
                code: res.errorCode || 'FETCH_FAILED',
                message: res.errorMessage || 'Gagal mengambil data'
              })
            }
            return res
          })
        })

        // Eksekusi juga pencarian dinamis yang eligible
        const maxDynamicPerCycle = sourceCatalog.dynamicSearchPolicy?.maxDynamicQueriesPerCycle || 2
        const candidateList = topicDiscoveryEngine.selectCandidatesForSearch(maxDynamicPerCycle)

        const searchTasks = candidateList.map(cand => {
          return radarConcurrencyLimiter.run(async () => {
            const res = await executeDynamicSearchQuery(cand, customFetch)
            if (res.success && res.publications) {
              incomingPubs.push(...res.publications)
            }
            return res
          })
        })

        await Promise.allSettled([...fetchTasks, ...searchTasks])

        const completionTime = Date.now()
        this.lastScanCompletedAt = completionTime
        this.scanDurationMs = completionTime - runStart

        // Catat log hasil pemindaian
        const scanLog: ScanRunLog = {
          runId: `scan-${now}-${Math.random().toString(36).slice(2, 7)}`,
          triggerType,
          startedAt: runStart,
          completedAt: completionTime,
          durationMs: this.scanDurationMs,
          connectorsAttempted,
          connectorsSucceeded,
          connectorsFailed,
          itemsDiscovered: incomingPubs.length + incomingTrends.length,
          itemsAccepted: incomingPubs.length + incomingTrends.length,
          itemsRejected: 0,
          duplicatesCount: 0,
          rateLimitHits,
          errors
        }
        this.scanHistory.unshift(scanLog)
        if (this.scanHistory.length > 50) this.scanHistory.pop()
        saveScanRunLogToDB(scanLog).catch(() => {})

        if (incomingPubs.length > 0 || incomingTrends.length > 0) {
          const liveResult = await processRadarIngestion(incomingPubs, incomingTrends, now)
          this.lastSyncTimestamp = now
          this.lastSuccessfulScanAt = completionTime
          this.lastNewItemReceivedAt = completionTime
          this.lastSyncSource = triggerType === 'STARTUP_CATCHUP' ? 'STARTUP_CATCHUP' : 'MANUAL_TRIGGER'
          this.notifyListeners(liveResult.entries, true)
          return liveResult.entries
        }

        return getCachedRadarItems()
      } finally {
        this.isSyncing = false
      }
    })()

    this.activeScanPromise = manualTask
    try {
      return await manualTask
    } finally {
      this.activeScanPromise = null
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
      tickIntervalMs: this.tickIntervalMs,
      intervalHours: this.intervalHours,
      intervalMinutes: this.intervalMinutes,
      lastSyncTimestamp: this.lastSyncTimestamp,
      nextSyncTimestamp: this.nextSyncTimestamp,
      totalEntries: this.listeners.size,
      lastSyncSource: this.lastSyncSource,
      isSyncing: this.isSyncing,
      sourceStates: this.getAllSourceScheduleStates(),
      lastScanStartedAt: this.lastScanStartedAt,
      lastScanCompletedAt: this.lastScanCompletedAt,
      lastSuccessfulScanAt: this.lastSuccessfulScanAt,
      lastSourceResponseAt: this.lastSourceResponseAt,
      lastNewItemReceivedAt: this.lastNewItemReceivedAt,
      nextScheduledAt: this.nextScheduledAt,
      scanDurationMs: this.scanDurationMs
    }
  }
}

// Export singleton scheduler
export const radarScheduler = new RadarSchedulerEngine()
