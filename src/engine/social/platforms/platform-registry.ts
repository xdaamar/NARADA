/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — SOCIAL PLATFORM ENGINE REGISTRY
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * Registry terpusat yang menghubungkan dan mendistribusikan permintaan
 * analisis ke masing-masing engine platform spesifik secara modular.
 * ══════════════════════════════════════════════════════════════════════════
 */

import type { PlatformEngine } from './platform-engine-contract.ts'
import type { SocialMediaType } from '../types/social-analysis-types.ts'
import { youtubeEngine } from './youtube-engine.ts'
import { tikTokEngine } from './tiktok-engine.ts'
import { instagramEngine } from './instagram-engine.ts'
import { threadsEngine } from './threads-engine.ts'

const ENGINES_MAP: Record<SocialMediaType, PlatformEngine> = {
  youtube: youtubeEngine,
  tiktok: tikTokEngine,
  instagram: instagramEngine,
  threads: threadsEngine
}

/**
 * Mendapatkan engine platform terisolasi berdasarkan tipe media sosial
 */
export function getPlatformEngine(platform: SocialMediaType): PlatformEngine {
  const engine = ENGINES_MAP[platform]
  if (!engine) {
    throw new Error(`[PlatformRegistry] Engine untuk platform "${platform}" tidak terdaftar.`)
  }
  return engine
}

/**
 * Mendeteksi dan memilih engine yang cocok untuk URL yang diberikan
 */
export function findEngineForUrl(url: string): PlatformEngine | null {
  for (const engine of Object.values(ENGINES_MAP)) {
    if (engine.canHandle(url)) {
      return engine
    }
  }
  return null
}

/**
 * Mengambil daftar seluruh engine platform yang aktif
 */
export function getAllPlatformEngines(): PlatformEngine[] {
  return Object.values(ENGINES_MAP)
}

