/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — SOURCE REGISTRY & CONNECTOR HEALTH MONITOR
 * SPRINT 1: CENTRALIZED CONFIGURATION & PROVENANCE TRACKING
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Prinsip Desain:
 * - Seluruh URL, endpoint, atribusi, dan kategori sumber dikonfigurasi di satu tempat.
 * - Tidak ada connector rahasia atau scraper liar (Zero Telegram, Zero Scraper Medsos).
 * - Connector Health mencatat status aktual per sumber secara transparan.
 * ══════════════════════════════════════════════════════════════════════════
 */

import type { 
  SourceDefinition, 
  ConnectorHealth, 
  ConnectorHealthState,
  RateLimitMetadata 
} from './radar-types.ts'
import sourceCatalog from '../../../shared/radar-source-catalog.json' with { type: 'json' }

export const RADAR_SOURCE_CATALOG = sourceCatalog

/**
 * Registry Sumber Resmi NARADA Radar dibangun dari Canonical Shared Catalog
 * (shared/radar-source-catalog.json — Single Source of Truth)
 */
export const ACTIVE_RADAR_SOURCES: SourceDefinition[] = sourceCatalog.sources.map((s: any) => ({
  id: s.id,
  displayName: s.displayName,
  shortLabel: s.shortLabel || s.displayName,
  sourceType: s.sourceType,
  outputType: s.outputType,
  feedUrl: `/api/radar/feed/${s.id}`,
  directUrl: s.upstreamUrl,
  category: s.category,
  domain: s.domain,
  profileId: s.profileId,
  pollIntervalMs: s.pollIntervalMs,
  ttlMs: s.ttlMs,
  maxItems: s.maxItems,
  parserAdapter: s.parserAdapter,
  enabled: s.enabled,
  attributionLabel: s.attributionLabel,
  attributionUrl: s.attributionUrl,
  fetchTimeoutMs: s.timeoutMs || 6000,
  policyGuardrail: s.id === 'src-youtube-policy-stub' ? {
    sourceId: 'src-youtube-policy-stub',
    prohibitedActions: [
      'CROSS_SOURCE_CLUSTERING',
      'DERIVED_THREAT_METRICS',
      'INDIVIDUAL_PROFILING',
      'UNRESTRICTED_STORAGE'
    ],
    isolationRequired: true,
    maxRetentionDays: 30,
    policyReference: 'YouTube API Services Developer Policies (Section III.E & III.F)'
  } : undefined
}))

/**
 * State in-memory untuk memantau kesehatan connector per sesi
 */
const connectorHealthMap = new Map<string, ConnectorHealth>()

/**
 * Inisialisasi status default connector
 */
export function ensureInitialHealth(sourceId: string): ConnectorHealth {
  const existing = connectorHealthMap.get(sourceId)
  if (existing) return existing

  const sourceDef = ACTIVE_RADAR_SOURCES.find(s => s.id === sourceId)
  const initial: ConnectorHealth = {
    sourceId,
    sourceName: sourceDef?.displayName || sourceId,
    shortLabel: sourceDef?.shortLabel || sourceDef?.displayName || sourceId,
    state: sourceDef?.enabled ? 'UNKNOWN' : 'DISABLED',
    status: sourceDef?.enabled ? 'UNKNOWN' : 'DISABLED',
    lastAttemptAt: null,
    lastSuccessAt: null,
    consecutiveFailures: 0,
    lastItemPublishedAt: null,
    latencyMs: null,
    httpStatus: null,
    rateLimitStatus: null,
    itemCountLastFetch: 0,
    itemCount: 0,
    errorCode: null,
    errorCategory: null,
    sanitizedErrorMessage: null,
    userReadableMessage: sourceDef?.enabled ? 'Menunggu siklus sinkronisasi awal' : 'Sumber dinonaktifkan',
    healthObservedAt: Date.now()
  }
  connectorHealthMap.set(sourceId, initial)
  return initial
}

/**
 * Mengambil status kesehatan connector tertentu
 */
export function getConnectorHealth(sourceId: string): ConnectorHealth {
  return ensureInitialHealth(sourceId)
}

/**
 * Sanitasi pesan error agar tidak membocorkan query token, API keys, atau path rahasia
 */
export function sanitizeErrorMessage(rawMsg?: string | null): string | null {
  if (!rawMsg) return null
  return rawMsg
    .replace(/(?:key|token|auth|password|secret|bearer)=[^& \s]+/gi, '$1=[REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9_\-.]+/gi, 'Bearer [REDACTED]')
    .replace(/https?:\/\/[^\s]+(?:\?[^\s]+)?/gi, (url) => {
      try {
        const u = new URL(url)
        return `${u.protocol}//${u.host}${u.pathname}`
      } catch {
        return '[URL]'
      }
    })
    .slice(0, 300)
}

/**
 * Mengambil seluruh source yang aktif
 */
export function getActiveRadarSources(): SourceDefinition[] {
  return ACTIVE_RADAR_SOURCES.filter(s => s.enabled)
}

/**
 * Mengambil metadata definisi source berdasarkan ID
 */
export function getRadarSourceById(sourceId: string): SourceDefinition | undefined {
  return ACTIVE_RADAR_SOURCES.find(s => s.id === sourceId)
}

/**
 * Memperbarui status kesehatan connector setelah percobaan fetch aktual
 */
export function updateConnectorHealth(
  sourceId: string,
  update: {
    state: ConnectorHealthState
    httpStatus?: number | null
    latencyMs?: number | null
    itemCount?: number
    lastItemPublishedAt?: number | null
    errorCode?: string | null
    errorCategory?: string | null
    errorMessage?: string | null
    rateLimitStatus?: RateLimitMetadata | null
    userReadableMessage?: string
    isSuccess?: boolean
  }
): ConnectorHealth {
  const current = ensureInitialHealth(sourceId)
  const now = Date.now()
  const sanitizedMsg = sanitizeErrorMessage(update.errorMessage || update.userReadableMessage)

  let newConsecutiveFailures = current.consecutiveFailures
  let preservedLastSuccess = current.lastSuccessAt
  const isSuccess = update.isSuccess ?? (update.state === 'HEALTHY' || update.state === 'DEGRADED')

  if (update.state === 'CONNECTING') {
    // Sedang dalam proses fetch, pertahankan counter kegagalan & waktu sukses terakhir
  } else {
    newConsecutiveFailures = isSuccess ? 0 : current.consecutiveFailures + 1
    preservedLastSuccess = isSuccess ? now : current.lastSuccessAt
  }

  const updated: ConnectorHealth = {
    ...current,
    state: update.state,
    status: update.state,
    lastAttemptAt: now,
    lastSuccessAt: preservedLastSuccess,
    consecutiveFailures: newConsecutiveFailures,
    latencyMs: update.latencyMs !== undefined ? update.latencyMs : current.latencyMs,
    httpStatus: update.httpStatus !== undefined ? update.httpStatus : current.httpStatus,
    rateLimitStatus: update.rateLimitStatus !== undefined ? update.rateLimitStatus : current.rateLimitStatus,
    itemCountLastFetch: update.itemCount !== undefined ? update.itemCount : current.itemCountLastFetch,
    itemCount: update.itemCount !== undefined ? update.itemCount : current.itemCount,
    lastItemPublishedAt: update.lastItemPublishedAt !== undefined ? update.lastItemPublishedAt : current.lastItemPublishedAt,
    errorCode: update.errorCode ?? (isSuccess ? null : current.errorCode),
    errorCategory: update.errorCategory ?? (isSuccess ? null : current.errorCategory),
    errorMessage: sanitizedMsg,
    sanitizedErrorMessage: sanitizedMsg,
    userReadableMessage: update.userReadableMessage ?? current.userReadableMessage,
    healthObservedAt: now
  }

  connectorHealthMap.set(sourceId, updated)
  return updated
}

/**
 * Mengambil ringkasan kesehatan seluruh connector
 */
export function getAllConnectorHealth(): Record<string, ConnectorHealth> {
  const result: Record<string, ConnectorHealth> = {}
  ACTIVE_RADAR_SOURCES.forEach(source => {
    result[source.id] = ensureInitialHealth(source.id)
  })
  return result
}

/**
 * Reset seluruh status kesehatan connector (untuk testing)
 */
export function resetConnectorHealthState(): void {
  connectorHealthMap.clear()
}
