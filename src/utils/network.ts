// ─── NETWORK TELEMETRY & MULTI-CHANNEL PROXY UTILITIES ───
// Berdasarkan Master Sprint 4C: Radical Network Transparency & Multi-Channel Pipeline

export type NetworkStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED'

export interface NetworkTelemetryInfo {
  status: NetworkStatus
  latencyMs: number
  lastChecked: number
  isUsingProxy: boolean
  errorMessage?: string
}

let cachedStatus: NetworkTelemetryInfo = {
  status: typeof navigator !== 'undefined' && !navigator.onLine ? 'OFFLINE' : 'ONLINE',
  latencyMs: 0,
  lastChecked: Date.now(),
  isUsingProxy: false,
}

/**
 * Menguji keterjangkauan peladen API TurnBackHoax dan mengukur latensi nyata (ms)
 */
export async function checkNetworkStatus(): Promise<NetworkTelemetryInfo> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    cachedStatus = {
      status: 'OFFLINE',
      latencyMs: 0,
      lastChecked: Date.now(),
      isUsingProxy: false,
      errorMessage: 'Jaringan lokal terputus (Offline mode).'
    }
    return cachedStatus
  }

  const startTime = Date.now()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 3500)

  // 1. Coba Kanal 1: Vite Proxy lokal (/api/turnbackhoax)
  try {
    const res = await fetch('/api/turnbackhoax/posts?per_page=1&_fields=id', {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    })
    clearTimeout(timeoutId)
    const latency = Date.now() - startTime

    if (res.ok) {
      cachedStatus = {
        status: 'ONLINE',
        latencyMs: latency,
        lastChecked: Date.now(),
        isUsingProxy: true,
      }
      return cachedStatus
    }
  } catch {
    // Abaikan kegagalan kanal 1, coba kanal direct/fallback
  }

  // 2. Coba Kanal 2: Direct public fetch dengan timeout
  try {
    const directController = new AbortController()
    const directTimeout = setTimeout(() => directController.abort(), 3000)
    const directStart = Date.now()
    const resDirect = await fetch('https://turnbackhoax.id/wp-json/wp/v2/posts?per_page=1&_fields=id', {
      signal: directController.signal,
      headers: { 'Accept': 'application/json' }
    })
    clearTimeout(directTimeout)
    const latencyDirect = Date.now() - directStart

    if (resDirect.ok) {
      cachedStatus = {
        status: 'ONLINE',
        latencyMs: latencyDirect,
        lastChecked: Date.now(),
        isUsingProxy: false,
      }
      return cachedStatus
    }
  } catch {
    // Gagal direct fetch (misal CORS atau timeout)
  }

  // Jika jaringan online tapi server API tidak merespons dalam 3.5 detik
  const totalElapsed = Date.now() - startTime
  cachedStatus = {
    status: typeof navigator !== 'undefined' && !navigator.onLine ? 'OFFLINE' : 'DEGRADED',
    latencyMs: totalElapsed,
    lastChecked: Date.now(),
    isUsingProxy: false,
    errorMessage: 'Peladen API publik tidak merespons atau diblokir CORS peramban.'
  }

  return cachedStatus
}

/**
 * Mendengarkan perubahan konektivitas browser (event online / offline)
 */
export function subscribeNetworkChanges(
  callback: (info: NetworkTelemetryInfo) => void
): () => void {
  if (typeof window === 'undefined') return () => {}

  const handleOnline = async () => {
    const info = await checkNetworkStatus()
    callback(info)
  }

  const handleOffline = () => {
    cachedStatus = {
      status: 'OFFLINE',
      latencyMs: 0,
      lastChecked: Date.now(),
      isUsingProxy: false,
      errorMessage: 'Koneksi internet terputus.'
    }
    callback(cachedStatus)
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}
