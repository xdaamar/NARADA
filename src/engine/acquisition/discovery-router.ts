/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — DISCOVERY NORMALIZATION, RELEVANCE ROUTING & PERSISTENCE
 * SPRINT 10: WORK PACKAGE 6 (RELEVANCE ROUTING & PROVENANCE PRESERVATION)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Aturan Arsitektural Integritas Intelijen:
 * 1. Snippet != Article: Hasil pencarian tidak pernah diklaim sebagai FULL_CONTENT.
 * 2. Provisional Claim: Klaim dari snippet ditandai isProvisional: true & isLimitedContext: true.
 * 3. Evidence Firewall: Kandidat discovery TIDAK BOLEH menjadi bukti pendukung klaim independen.
 * 4. Deduplication Integrity: Menjaga canonical URL dan platform native identifier (videoId, postId).
 * ══════════════════════════════════════════════════════════════════════════
 */

import type { SearchDiscoveryResult } from './source-contracts.ts'
import type { ClaimRecord } from '../intelligence/claim-types.ts'
import { evaluateIntelligenceRelevance } from '../intelligence/relevance-engine.ts'
import { extractClaimsFromArticle } from '../intelligence/claim-extraction-engine.ts'
import { saveDiscoveryCandidateToDB, getDiscoveryCandidatesFromDB } from '../../utils/db-adapter.ts'

export interface RouteDiscoveryResult {
  candidate: SearchDiscoveryResult
  extractedClaims: ClaimRecord[]
  isAccepted: boolean
  rejectionReason?: string
}

/**
 * Memproses dan mengevaluasi kandidat hasil pencarian melalui mesin relevansi & ekstraksi klaim Sprint 09
 */
export async function routeDiscoveryCandidate(
  candidate: SearchDiscoveryResult,
  options?: { persist?: boolean }
): Promise<RouteDiscoveryResult> {
  const combinedText = `${candidate.title}. ${candidate.snippet}`

  // 1. Evaluasi Relevansi via Sprint 09 Relevance Engine
  const relevance = evaluateIntelligenceRelevance({
    title: candidate.title,
    description: candidate.snippet,
    content: candidate.snippet,
    sourceType: candidate.targetPlatform,
  })

  candidate.relevanceStatus = relevance.category
  candidate.relevanceScore = relevance.score

  // Jika relevansi di bawah ambang batas (noise proscribed / hiburan / tidak relevan)
  if (relevance.category === 'IRRELEVANT') {
    candidate.ingestionStatus = 'REJECTED'
    candidate.limitations.push(`RELEVANCE_FILTER: Ditolak oleh mesin relevansi intelijen (${relevance.rejectionReasons.join(', ')})`)

    if (options?.persist) {
      await saveDiscoveryCandidateToDB(candidate).catch(() => {})
    }

    return {
      candidate,
      extractedClaims: [],
      isAccepted: false,
      rejectionReason: `Relevansi rendah (${relevance.score}/100): ${relevance.rejectionReasons.join(', ')}`
    }
  }

  // 2. Ekstraksi Klaim Sementara (Provisional Claims)
  let extractedClaims: ClaimRecord[] = []
  if (combinedText.length >= 40) {
    const rawClaims = extractClaimsFromArticle({
      articleId: `disc-${candidate.id}`,
      title: candidate.title,
      description: candidate.snippet,
      content: candidate.snippet,
      publishedAt: candidate.publishedAt ? new Date(candidate.publishedAt).getTime() : Date.now(),
    })
    extractedClaims = rawClaims.map(c => ({
      ...c,
      isLimitedContext: true,
      limitations: [
        ...c.limitations,
        'DISCOVERY_SNIPPET_ORIGIN: Proposisi diekstraksi dari snippet pencarian publik; memerlukan dokumen asli untuk konfirmasi penuh'
      ]
    }))
  }

  candidate.ingestionStatus = 'PENDING_VALIDATION'

  // 4. Persistensi ke Database jika diminta
  if (options?.persist) {
    await saveDiscoveryCandidateToDB(candidate).catch(() => {})
  }

  return {
    candidate,
    extractedClaims,
    isAccepted: true
  }
}

/**
 * Filter Deduplikasi Lintas-Provider untuk Daftar Hasil Pencarian
 */
export function deduplicateDiscoveryResults(
  results: SearchDiscoveryResult[]
): {
  uniqueResults: SearchDiscoveryResult[]
  duplicatesCount: number
} {
  const seenUrls = new Set<string>()
  const seenIdentities = new Set<string>()
  const uniqueResults: SearchDiscoveryResult[] = []
  let duplicatesCount = 0

  for (const item of results) {
    const urlKey = item.canonicalUrl.toLowerCase()
    
    // Identity key khusus platform (misal videoId YouTube)
    let identityKey: string | null = null
    if (item.targetPlatform === 'youtube' && item.platformIdentity?.videoId) {
      identityKey = `yt:${item.platformIdentity.videoId}`
    } else if (item.platformIdentity?.postId) {
      identityKey = `${item.targetPlatform}:${item.platformIdentity.postId}`
    }

    if (seenUrls.has(urlKey) || (identityKey && seenIdentities.has(identityKey))) {
      duplicatesCount++
      continue
    }

    seenUrls.add(urlKey)
    if (identityKey) seenIdentities.add(identityKey)
    uniqueResults.push(item)
  }

  return {
    uniqueResults,
    duplicatesCount
  }
}

/**
 * Mengambil semua kandidat discovery yang tersimpan
 */
export async function getAllDiscoveryCandidates(): Promise<SearchDiscoveryResult[]> {
  return getDiscoveryCandidatesFromDB()
}
