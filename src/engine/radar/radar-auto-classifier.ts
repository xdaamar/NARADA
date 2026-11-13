/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — RADAR AUTOMATIC SELF-CLASSIFIER ENGINE
 * Pusat Pertahanan Siber TNI AD (PUSSIBERAD) × CODEPOLITAN
 * Kartika Cyber Hackathon 2026
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Mengklasifikasikan secara otomatis item radar yang sedang berstatus "SEDANG DIPANTAU"
 * (UNVERIFIED) menjadi "FAKTA" atau "HOAKS" tanpa harus disematkan (di-pin).
 *
 * Memanfaatkan mesin pencocokan semantik klaim mendalam (Semantic Claim Matching)
 * dari engine Berita Tersemat dan pangkalan data rujukan otoritatif (Mafindo, TurnBackHoax,
 * Setneg, Dispenad, BSSN, BMKG, OJK, Bank Indonesia).
 *
 * Begitu bukti atau konfirmasi resmi ditemukan, status item otomatis berganti
 * dan otomatis berpindah dari tab filter "SEDANG DIPANTAU" ke "TERINDIKASI HOAKS"
 * atau "FAKTA & AMAN"!
 */

import type { DebunkKnowledgeEntry } from '../../types.ts'
import {
  areClaimsSemanticallyMatching,
  isAuthoritativeDebunkSource,
  resolveReferenceVerdict
} from '../archive/archive-service.ts'
import { getCuratedArchiveDebunks } from '../data/debunk-service.ts'

export interface RadarAutoClassifyResult {
  updatedItems: DebunkKnowledgeEntry[]
  reclassifiedCount: number
  reclassifications: Array<{
    id: string
    claim: string
    fromVerdict: string
    toVerdict: string
    evidenceSource: string
    reason: string
  }>
}

/**
 * Memeriksa dan merekonsiliasi seluruh entri radar unverified terhadap bukti rujukan otoritatif
 */
export function autoClassifyRadarItems(
  items: DebunkKnowledgeEntry[],
  authoritativeReferences?: DebunkKnowledgeEntry[]
): RadarAutoClassifyResult {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return { updatedItems: [], reclassifiedCount: 0, reclassifications: [] }
  }

  // 1. Kumpulkan seluruh korpus rujukan otoritatif
  let rawReferences: DebunkKnowledgeEntry[] = []
  if (Array.isArray(authoritativeReferences) && authoritativeReferences.length > 0) {
    rawReferences = authoritativeReferences
  } else {
    try {
      rawReferences = getCuratedArchiveDebunks()
    } catch {
      rawReferences = []
    }
  }

  // Tambahkan juga entri dalam items itu sendiri yang sudah berstatus HOAKS atau FAKTA dari sumber resmi
  const verifiedInFeed = items.filter(it => 
    (it.verdict === 'HOAKS' || it.verdict === 'FAKTA') && isAuthoritativeDebunkSource(it)
  )
  const allReferences = [...rawReferences, ...verifiedInFeed]

  // OPTIMISASI PERFORMA: Filter otoritatif HANYA SEKALI dan indeks berdasarkan klaster
  // Mencegah perulangan 160.000 komputasi semantik yang memicu UI freeze pada utas utama
  const authoritativeRefs = allReferences.filter(r => isAuthoritativeDebunkSource(r))
  const refsByCluster = new Map<string, DebunkKnowledgeEntry[]>()
  for (const ref of authoritativeRefs) {
    const c = ref.cluster || 'UMUM_NETRAL'
    if (!refsByCluster.has(c)) {
      refsByCluster.set(c, [])
    }
    refsByCluster.get(c)!.push(ref)
  }

  let reclassifiedCount = 0
  const reclassifications: RadarAutoClassifyResult['reclassifications'] = []

  const updatedItems = items.map(item => {
    // Hanya proses item yang saat ini masih SEDANG DIPANTAU (UNVERIFIED)
    if (item.verdict !== 'UNVERIFIED') {
      return item
    }

    // 1. Cari kandidat pada klaster yang sama terlebih dahulu (relevan & 12x lebih cepat)
    const clusterCandidates = refsByCluster.get(item.cluster) || []
    let matchedRef = clusterCandidates.find(ref => 
      ref.id !== item.id && areClaimsSemanticallyMatching(item.claim, ref.claim)
    )

    // 2. Jika belum ditemukan di klaster yang sama, evaluasi kandidat lintas klaster
    if (!matchedRef) {
      matchedRef = authoritativeRefs.find(ref => 
        ref.id !== item.id && areClaimsSemanticallyMatching(item.claim, ref.claim)
      )
    }

    if (matchedRef) {
      const resolved = resolveReferenceVerdict(matchedRef)
      if (resolved === 'HOAKS') {
        reclassifiedCount++
        reclassifications.push({
          id: item.id,
          claim: item.claim,
          fromVerdict: 'UNVERIFIED',
          toVerdict: 'HOAKS',
          evidenceSource: matchedRef.officialSource || 'TurnBackHoax (Mafindo)',
          reason: 'Ditemukan bukti sanggahan cek fakta resmi'
        })

        return {
          ...item,
          verdict: 'HOAKS' as const,
          triageStatus: 'HOAKS' as any,
          queueState: 'RESOLVED' as const,
          threatLevel: item.threatLevel === 'low' ? 'medium' : item.threatLevel,
          cognitiveScore: 90,
          officialSource: matchedRef.officialSource || item.officialSource || 'TurnBackHoax.ID (Mafindo)',
          sourceUrl: matchedRef.sourceUrl || item.sourceUrl,
          clarification: matchedRef.clarification || item.clarification,
          viralityReason: '⚡ TERVERIFIKASI OTOMATIS: Ditemukan rujukan hoaks resmi. Berpindah ke tab TERINDIKASI HOAKS.',
          tacticalResponseCivilian: matchedRef.tacticalResponseCivilian || item.tacticalResponseCivilian,
          tacticalResponseMilitary: matchedRef.tacticalResponseMilitary || item.tacticalResponseMilitary
        }
      } else if (resolved === 'FAKTA') {
        reclassifiedCount++
        reclassifications.push({
          id: item.id,
          claim: item.claim,
          fromVerdict: 'UNVERIFIED',
          toVerdict: 'FAKTA',
          evidenceSource: matchedRef.officialSource || 'Portal Resmi Kedinasan',
          reason: 'Ditemukan konfirmasi resmi peristiwa faktual'
        })

        return {
          ...item,
          verdict: 'FAKTA' as const,
          triageStatus: 'RESOLVED' as any,
          queueState: 'RESOLVED' as const,
          cognitiveScore: 25,
          officialSource: matchedRef.officialSource || item.officialSource,
          sourceUrl: matchedRef.sourceUrl || item.sourceUrl,
          clarification: matchedRef.clarification || item.clarification,
          viralityReason: '⚡ TERVERIFIKASI OTOMATIS: Ditemukan rilis resmi terkonfirmasi. Berpindah ke tab FAKTA & AMAN.',
          tacticalResponseCivilian: matchedRef.tacticalResponseCivilian || item.tacticalResponseCivilian,
          tacticalResponseMilitary: matchedRef.tacticalResponseMilitary || item.tacticalResponseMilitary
        }
      }
    }

    // Jika belum ada bukti konklusif, tetap berada di SEDANG DIPANTAU
    return item
  })

  return {
    updatedItems,
    reclassifiedCount,
    reclassifications
  }
}
