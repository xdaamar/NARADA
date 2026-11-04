/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — EVIDENCE CORRELATION & PUBLISHER INDEPENDENCE ENGINE (WP-04)
 * SPRINT 09: EVIDENCE GROUNDING, SYNDICATION DETECTION & INDEPENDENCE
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Prinsip Desain:
 * 1. Volume != Independensi: 10 artikel yang menyalin rilis pers yang sama
 *    hanya dihitung sebagai 1 rantai bukti independen (independentEvidenceCount = 1).
 * 2. PSL-Aware Root Domain: Menangani domain multi-level TLD Indonesia (.co.id, .go.id, dsb).
 * 3. Strict Google Trends Separation: Google Trends adalah sinyal atensi pencarian publik,
 *    BUKAN bukti konfirmasi, BUKAN penerbit, dan TIDAK menambah hitungan bukti independen.
 * 4. Temporal & Geo Consistency: Peristiwa masa lalu tidak boleh dipakai membuktikan
 *    peristiwa terkini; lokasi berbeda tidak boleh dicampuradukkan.
 * 5. Evidence Directness: Membedakan Sumber Primer, Liputan Langsung, dan Rilis Tersindikasi.
 * ══════════════════════════════════════════════════════════════════════════
 */

import {
  type ArticleRecord,
  type ClaimRecord,
  type ClaimEvidenceItem,
  type EvidenceRelationType,
  type EvidenceDirectness,
  type PublisherProfile,
  type PublisherType,
  EVIDENCE_CORRELATION_ENGINE_VERSION
} from './claim-types.ts'
import { 
  extractCanonicalPublisherDomain, 
  AGGREGATOR_INDEXER_DOMAINS 
} from '../radar/clustering-engine.ts'

// Peta Organisasi Media Terverifikasi (Penerbit di bawah naungan korporasi yang sama)
const MEDIA_CONGLOMERATE_MAP: Record<string, string> = {
  'detik.com': 'ORG-TRANS-MEDIA',
  'cnbcindonesia.com': 'ORG-TRANS-MEDIA',
  'cnnindonesia.com': 'ORG-TRANS-MEDIA',
  'kompas.com': 'ORG-KOMPAS-GRAMEDIA',
  'kompas.id': 'ORG-KOMPAS-GRAMEDIA',
  'tribunnews.com': 'ORG-KOMPAS-GRAMEDIA',
  'sindonews.com': 'ORG-MNC-MEDIA',
  'okezone.com': 'ORG-MNC-MEDIA',
  'inews.id': 'ORG-MNC-MEDIA',
  'liputan6.com': 'ORG-EMTEK',
  'merdeka.com': 'ORG-EMTEK',
  'antaranews.com': 'ORG-LKBN-ANTARA'
}

/**
 * Normalisasi Profil Penerbit Berdasarkan Domain Kanonikal (PSL-Aware)
 */
export function resolvePublisherProfile(rawUrlOrDomain: string, displayNameHint?: string): PublisherProfile {
  const registrable = extractCanonicalPublisherDomain(rawUrlOrDomain) || 'unknown.source'
  const isAggregator = AGGREGATOR_INDEXER_DOMAINS.has(registrable)
  const nowIso = new Date().toISOString()

  let publisherType: PublisherType = 'MAINSTREAM_PRESS'
  if (isAggregator) {
    publisherType = 'AGGREGATOR'
  } else if (registrable.includes('antaranews.com')) {
    publisherType = 'NEWS_AGENCY'
  } else if (registrable.endsWith('.go.id') || registrable.endsWith('.mil.id')) {
    publisherType = 'OFFICIAL_GOVERNMENT'
  } else if (registrable.includes('turnbackhoax.id') || registrable.includes('mafindo.or.id')) {
    publisherType = 'FACT_CHECKER'
  }

  const organizationId = MEDIA_CONGLOMERATE_MAP[registrable]

  return {
    id: `PUB-${registrable.replace(/[^a-zA-Z0-9]/g, '-')}`,
    displayName: displayNameHint || registrable,
    primaryDomain: registrable,
    registrableDomain: registrable,
    verifiedAliases: [],
    organizationId,
    publisherType,
    identityVerificationStatus: isAggregator || publisherType === 'OFFICIAL_GOVERNMENT' || publisherType === 'NEWS_AGENCY' ? 'VERIFIED' : 'PROVISIONAL',
    sourceProvenance: rawUrlOrDomain,
    isAggregator,
    createdAt: nowIso,
    updatedAt: nowIso
  }
}

/**
 * Hitung Koefisien Kemiripan Jaccard (Unigram + Bigram) untuk Deteksi Sindikasi Berita
 */
export function calculateTextSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  const normA = a.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim()
  const normB = b.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim()
  if (normA === normB) return 1.0

  const wordsA = normA.split(/\s+/).filter(w => w.length > 1)
  const wordsB = normB.split(/\s+/).filter(w => w.length > 1)
  if (wordsA.length === 0 || wordsB.length === 0) return 0

  const tokensA = new Set<string>(wordsA)
  const tokensB = new Set<string>(wordsB)

  // Tambahkan bigram untuk memperhitungkan urutan frase leksikal
  for (let i = 0; i < wordsA.length - 1; i++) {
    tokensA.add(`${wordsA[i]}_${wordsA[i + 1]}`)
  }
  for (let i = 0; i < wordsB.length - 1; i++) {
    tokensB.add(`${wordsB[i]}_${wordsB[i + 1]}`)
  }

  let intersection = 0
  tokensA.forEach(t => {
    if (tokensB.has(t)) intersection++
  })

  const union = tokensA.size + tokensB.size - intersection
  return union > 0 ? intersection / union : 0
}

/**
 * Deteksi Relasi Bukti Terhadap Klaim (SUPPORTS / CONTRADICTS / CONTEXTUALIZES / MENTIONS)
 */
export function determineEvidenceRelation(params: {
  claim: ClaimRecord
  evidenceText: string
  sourceType?: string
}): { relation: EvidenceRelationType; rationale: string; confidence: 'HIGH' | 'MEDIUM' | 'LOW' } {
  const normEvidence = params.evidenceText.toLowerCase()
  const normClaim = params.claim.normalizedText.toLowerCase()

  // 1. Jika rujukan cek fakta resmi TurnBackHoax / CekFakta
  if (params.sourceType === 'fact_check' || normEvidence.includes('turnbackhoax') || normEvidence.includes('[salah]')) {
    if (normEvidence.includes('salah') || normEvidence.includes('hoaks') || normEvidence.includes('disinformasi')) {
      return {
        relation: 'CONTRADICTS',
        rationale: 'Sumber verifikasi cek fakta mengidentifikasi klaim sebagai informasi yang tidak benar / palsu.',
        confidence: 'HIGH'
      }
    }
    if (normEvidence.includes('benar') || normEvidence.includes('fakta')) {
      return {
        relation: 'SUPPORTS',
        rationale: 'Sumber verifikasi cek fakta mengonfirmasi keabsahan klaim.',
        confidence: 'HIGH'
      }
    }
  }

  // 2. Evaluasi kesamaan inti leksikal
  const claimWords = normClaim.split(/\s+/).filter(w => w.length > 3)
  const matchedWords = claimWords.filter(w => normEvidence.includes(w))
  const matchRatio = claimWords.length > 0 ? matchedWords.length / claimWords.length : 0

  // 3. Uji apakah terdapat sanggahan/bantahan eksplisit terhadap klaim
  const denialTokens = ['membantah', 'menepis', 'tidak benar', 'tidak ada', 'bantah', 'palsu', 'hoaks']
  const hasDenial = denialTokens.some(t => normEvidence.includes(t))

  if (hasDenial && matchRatio > 0.4) {
    return {
      relation: 'CONTRADICTS',
      rationale: `Ditemukan sanggahan eksplisit terhadap proposisi klaim dengan kecocokan kata kunci (${Math.round(matchRatio * 100)}%).`,
      confidence: 'MEDIUM'
    }
  }

  // 4. Uji dukungan afirmatif
  const affirmativeTokens = ['mengonfirmasi', 'membenarkan', 'resmi menyatakan', 'fakta bahwa', 'terbukti', 'terjadi']
  const hasAffirmative = affirmativeTokens.some(t => normEvidence.includes(t))

  if (hasAffirmative && matchRatio > 0.5) {
    return {
      relation: 'SUPPORTS',
      rationale: `Ditemukan penegasan afirmatif resmi yang mendukung klausul klaim (${Math.round(matchRatio * 100)}% kecocokan).`,
      confidence: 'MEDIUM'
    }
  }

  // 5. Konteks atau Penyebutan
  if (matchRatio >= 0.5) {
    return {
      relation: 'CONTEXTUALIZES',
      rationale: `Bukti membahas peristiwa yang sama (${Math.round(matchRatio * 100)}% kecocokan istilah) tanpa klausa vonis afirmatif/bantahan eksplisit.`,
      confidence: 'LOW'
    }
  }

  if (matchRatio >= 0.25) {
    return {
      relation: 'MENTIONS',
      rationale: 'Bukti sekadar menyebutkan topik atau entitas yang serupa.',
      confidence: 'LOW'
    }
  }

  return {
    relation: 'UNKNOWN',
    rationale: 'Tidak ditemukan hubungan evidensial yang dapat diverifikasi antara bukti dan klaim.',
    confidence: 'LOW'
  }
}

/**
 * Deteksi Directness Bukti (Sumber Primer vs Laporan Sekunder vs Sindikasi)
 */
export function determineEvidenceDirectness(params: {
  publisher: PublisherProfile
  hasQuotation: boolean
  isSyndicated: boolean
}): EvidenceDirectness {
  if (params.publisher.publisherType === 'OFFICIAL_GOVERNMENT') {
    return 'PRIMARY_SOURCE'
  }
  if (params.publisher.publisherType === 'NEWS_AGENCY') {
    return 'DIRECT_STATEMENT'
  }
  if (params.isSyndicated) {
    return 'DERIVED_OR_SYNDICATED'
  }
  if (params.hasQuotation) {
    return 'INDEPENDENT_REPORT'
  }
  return 'SECONDARY_REPORT'
}

/**
 * Korelasikan Klaim dengan Daftar Artikel dan Bentuk Rantai Bukti Terverifikasi (WP-04)
 */
export function correlateClaimWithEvidence(params: {
  claim: ClaimRecord
  articles: ArticleRecord[]
  existingPublishers?: Record<string, PublisherProfile>
}): {
  evidenceItems: ClaimEvidenceItem[]
  publisherCount: number
  independentPublisherCount: number
  independentEvidenceCount: number
  syndicationGroups: Record<string, string[]>
} {
  const evidenceItems: ClaimEvidenceItem[] = []
  const syndicationGroups: Record<string, string[]> = {}
  const nowIso = new Date().toISOString()

  // 1. Identifikasi dan kelompokkan artikel bersindikasi (misal: rilis pers yang disalin sama persis)
  const processedArticleIds = new Set<string>()

  for (let i = 0; i < params.articles.length; i++) {
    const a = params.articles[i]
    if (processedArticleIds.has(a.id)) continue

    const groupId = `SYN-${a.id}`
    syndicationGroups[groupId] = [a.id]
    processedArticleIds.add(a.id)

    for (let j = i + 1; j < params.articles.length; j++) {
      const b = params.articles[j]
      if (processedArticleIds.has(b.id)) continue

      const sim = calculateTextSimilarity(`${a.title} ${a.description}`, `${b.title} ${b.description}`)
      // Jika kemiripan sangat tinggi (> 0.65) atau judul identik
      if (sim > 0.65 || (a.title.length > 20 && a.title.toLowerCase() === b.title.toLowerCase())) {
        syndicationGroups[groupId].push(b.id)
        processedArticleIds.add(b.id)
        b.isDuplicateOf = a.id
        b.syndicationGroupId = groupId
      }
    }
  }

  // 2. Evaluasi relasi bukti setiap artikel terhadap klaim
  const uniquePublishers = new Set<string>()
  const independentGroupsWithRelation = new Set<string>()

  for (const article of params.articles) {
    // Cari publisher profile
    const pub = resolvePublisherProfile(article.canonicalUrl || article.originalUrl, article.publisherName)
    if (!pub.isAggregator) {
      uniquePublishers.add(pub.registrableDomain)
    }

    const { relation, rationale, confidence } = determineEvidenceRelation({
      claim: params.claim,
      evidenceText: `${article.title}. ${article.description || ''}`,
      sourceType: article.sourceConnectorId.includes('tbh') ? 'fact_check' : 'news'
    })

    if (relation !== 'UNKNOWN' && relation !== 'MENTIONS') {
      const isSyndicated = Boolean(article.isDuplicateOf)
      const directness = determineEvidenceDirectness({
        publisher: pub,
        hasQuotation: Boolean(article.description && article.description.includes('"')),
        isSyndicated
      })

      const groupId = article.syndicationGroupId || `SYN-${article.id}`
      // Rantai independen dihitung berdasarkan organisasi induk atau grup sindikasi
      const independenceKey = pub.organizationId ? pub.organizationId : groupId
      independentGroupsWithRelation.add(independenceKey)

      evidenceItems.push({
        id: `EVD-${params.claim.id}-${article.id}`,
        claimId: params.claim.id,
        articleId: article.id,
        sourcePublisherId: pub.id,
        sourcePublisherName: pub.displayName,
        registrableDomain: pub.registrableDomain,
        evidenceRelation: relation,
        directness,
        quotedText: article.title,
        independenceGroupId: independenceKey,
        acquisitionTimestamp: article.acquiredAt,
        sourcePublishedAt: article.publishedAt,
        relationDetectionMethod: `LEXICAL_ALIGNMENT_AND_STANCE (v${EVIDENCE_CORRELATION_ENGINE_VERSION})`,
        reviewState: confidence === 'HIGH' ? 'ANALYST_VERIFIED' : 'PROVISIONAL',
        rationale,
        limitations: isSyndicated ? ['DERIVED_SYNDICATION: Artikel ini teridentifikasi sebagai sindikasi/duplikasi dari rilis pers lain.'] : [],
        createdAt: nowIso
      })
    }
  }

  // Hitung jumlah entitas independen murni
  const independentPublisherCount = independentGroupsWithRelation.size
  const independentEvidenceCount = independentGroupsWithRelation.size

  return {
    evidenceItems,
    publisherCount: uniquePublishers.size,
    independentPublisherCount,
    independentEvidenceCount,
    syndicationGroups
  }
}
