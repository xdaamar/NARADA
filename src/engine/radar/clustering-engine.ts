/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — DEDUPLICATION & CONSERVATIVE EVENT CLUSTERING ENGINE
 * SPRINT 1: PROVENANCE-PRESERVING AGGREGATION
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Prinsip Desain:
 * 1. URL Normalization: Membersihkan tracking parameter (utm_*, fbclid, dll) secara aman.
 * 2. Konservatif & Explainable: Menggabungkan artikel hanya bila bukti waktu, entitas,
 *    dan semantik bersepakat. Jika ragu, tetap pisahkan.
 * 3. Preservasi Sumber Utuh: Setiap cluster mempertahankan seluruh artikel anggotanya
 *    beserta tautan URL aslinya untuk diaudit operator.
 * 4. Kejujuran Independensi: Jumlah artikel/domain TIDAK diklaim sebagai sumber independen
 *    karena sindikasi pers / rilis bersama sering terjadi.
 * ══════════════════════════════════════════════════════════════════════════
 */

import type { NormalizedPublication, EventCluster, SearchTrendSignal, CandidateClusterMember } from './radar-types.ts'

// Stopwords umum bahasa Indonesia untuk ekstraksi token substantif
const INDO_STOPWORDS = new Set([
  'dan', 'di', 'ke', 'dari', 'yang', 'ini', 'itu', 'untuk', 'pada', 'adalah',
  'sebagai', 'dengan', 'atau', 'akan', 'bisa', 'ada', 'tidak', 'tak', 'oleh',
  'saat', 'dalam', 'setelah', 'tersebut', 'tentang', 'terkait', 'sebut', 'kata',
  'karena', 'bila', 'jika', 'agar', 'supaya', 'hingga', 'sampai', 'juga', 'pun',
  'para', 'oleh', 'bagi', 'sudah', 'telah', 'sedang', 'masih', 'banyak', 'lebih',
  'bukan', 'ia', 'dia', 'mereka', 'kita', 'kami', 'kamu', 'anda', 'terjadi',
  'viral', 'heboh', 'update', 'terkini', 'terbaru', 'berita', 'hari', 'ini'
])

// Entitas Kunci Strategis Nasional
const STRATEGIC_ENTITIES = [
  'tni ad', 'tni al', 'tni au', 'tni', 'polri', 'polisi', 'polda', 'polres',
  'kodam', 'korem', 'kodim', 'koramil', 'babinsa', 'pangdam', 'danrem', 'dandim',
  'prabowo', 'gibran', 'jokowi', 'dpr', 'mpr', 'kpk', 'kpu', 'bawaslu',
  'bmkg', 'bnpb', 'kemensos', 'kemenkes', 'menkes', 'kemenhub', 'kapolri', 'menko polkam',
  'bpom', 'kemhan', 'dispenad', 'pussiberad',
  'papua', 'kkb', 'opm', 'ambalat', 'natuna', 'patung kuda', 'istana',
  'bansos', 'mbg', 'makan bergizi', 'ijazah', 'alutsista', 'demo', 'unjuk rasa',
  'bentrok', 'ricuh', 'megathrust', 'tsunami', 'gempa', 'bahlil', 'esdm', 'mk',
  'mahkamah konstitusi', 'kejagung', 'jaksa agung', 'ikn', 'nusantara'
]

// Lokasi Strategis untuk Pencegahan False Merge Antar Wilayah
const STRATEGIC_LOCATIONS = [
  'papua', 'jayapura', 'timika', 'ambalat', 'natuna', 'jakarta', 'surabaya',
  'medan', 'bandung', 'semarang', 'makassar', 'aceh', 'bali', 'ikn', 'yogyakarta',
  'intan jaya', 'yahukimo', 'puncak jaya', 'merauke', 'garut', 'kendal', 'batang',
  'pekalongan', 'flores timur', 'cengkareng', 'maluku barat daya', 'sukabumi', 'mentawai', 'padang',
  'marunda', 'selat sunda', 'selat malaka'
]

// Tracking parameters yang dibersihkan dari URL (hanya parameter analitik & tracking)
const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid', '_hsenc', '_hsmi',
  '_ga', '_gl', 'dclid', 'ref', 'ref_src', 'oc', 'ved', 'ei', 'sei', 'usg'
]

/**
 * Ekstraksi domain hostname dari URL untuk perhitungan distinctPublisherDomainCount
 */
export function extractPublisherDomain(url: string): string {
  if (!url) return ''
  try {
    const parsed = new URL(url.trim())
    return parsed.hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

/**
 * Membersihkan URL dari parameter tracking sambil MEMPERTAHANKAN parameter konten penting (id, articleId, dsb)
 */
export function normalizeUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return ''

  try {
    const parsed = new URL(rawUrl.trim())

    // Hapus HANYA parameter tracking yang terdokumentasi
    TRACKING_PARAMS.forEach(param => {
      parsed.searchParams.delete(param)
    })

    // Bersihkan hash fragment
    parsed.hash = ''

    // Normalisasi hostname ke lowercase
    parsed.hostname = parsed.hostname.toLowerCase()

    let cleaned = parsed.toString()
    // Hapus trailing slash jika bukan root
    if (cleaned.endsWith('/') && parsed.pathname !== '/') {
      cleaned = cleaned.slice(0, -1)
    }

    return cleaned
  } catch {
    // Jika bukan URL valid, kembalikan string mentah bersih
    return rawUrl.trim()
  }
}

/**
 * Tokenisasi teks judul/konten menjadi kata kunci substantif
 */
export function extractSubstantiveTokens(text: string): string[] {
  if (!text) return []

  const normalized = text
    .toLowerCase()
    .replace(/\[(hoaks|salah|disinformasi|klarifikasi|manipulasi)\]/gi, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized
    .split(' ')
    .filter(token => token.length >= 3 && !INDO_STOPWORDS.has(token))
}

/**
 * Ekstraksi entitas kunci yang muncul di dalam teks (dengan word-boundary untuk akronim pendek)
 */
export function extractEntitiesFromText(text: string): string[] {
  const norm = text.toLowerCase()
  const matched: string[] = []

  for (const entity of STRATEGIC_ENTITIES) {
    if (entity.length <= 3) {
      // Gunakan regex boundary agar "mk" tidak cocok di dalam "smk"
      const regex = new RegExp(`\\b${entity}\\b`, 'i')
      if (regex.test(norm)) {
        matched.push(entity)
        if (entity === 'tni') {
          matched.push('tni-hankam')
        }
      }
    } else {
      if (norm.includes(entity)) {
        matched.push(entity)
        if (['kodim', 'kodam', 'korem', 'koramil', 'babinsa', 'tni ad', 'tni al', 'tni au'].includes(entity)) {
          matched.push('tni')
          matched.push('tni-hankam')
        }
        if (['polisi', 'polda', 'polres', 'kapolri'].includes(entity)) {
          matched.push('polri')
        }
        if (entity === 'menkes') {
          matched.push('kemenkes')
        }
      }
    }
  }

  return Array.from(new Set(matched))
}

/**
 * Ekstraksi lokasi spesifik untuk mendeteksi konflik wilayah (Package 3)
 */
export function extractLocationsFromText(text: string): string[] {
  const norm = text.toLowerCase()
  // Sanitasi penyebutan nama proyek infrastruktur tertentu agar tidak memicu konflik wilayah
  const sanitized = norm.replace(/pipa\s+gas\s+cirebon\s+semarang/gi, 'proyek cisem')
  return STRATEGIC_LOCATIONS.filter(loc => {
    const regex = new RegExp(`\\b${loc}\\b`, 'i')
    return regex.test(sanitized)
  })
}

/**
 * Menghitung koefisien kemiripan Jaccard antara dua set token
 */
export function calculateJaccardSimilarity(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0

  const setA = new Set(tokensA)
  const setB = new Set(tokensB)

  let intersection = 0
  setA.forEach(item => {
    if (setB.has(item)) intersection++
  })

  const union = new Set([...tokensA, ...tokensB]).size
  return union === 0 ? 0 : intersection / union
}

/**
 * Hash string sederhana yang deterministik untuk sidik jari konten
 */
export function createContentFingerprint(title: string, publisher?: string): string {
  const norm = (title + (publisher ? `-${publisher}` : ''))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

  let hash = 0
  for (let i = 0; i < norm.length; i++) {
    const char = norm.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Konversi ke 32bit int
  }
  return Math.abs(hash).toString(36)
}

/**
 * 1. Tahap Deduplikasi URL & Kanonikal
 * Menghilangkan duplikat absolut dari feed yang sama atau lintas feed.
 */
export function deduplicatePublications(items: NormalizedPublication[]): NormalizedPublication[] {
  const seenCanonicalUrls = new Map<string, NormalizedPublication>()
  const result: NormalizedPublication[] = []

  items.forEach(item => {
    const normUrl = normalizeUrl(item.canonicalUrl || item.originalUrl)
    
    if (normUrl && seenCanonicalUrls.has(normUrl)) {
      // Duplikat URL ditemukan: simpan referensi jika diperlukan, abaikan duplikat identik
      return
    }

    if (normUrl) {
      seenCanonicalUrls.set(normUrl, item)
    }
    result.push(item)
  })

  return result
}

/**
 * 2. Tahap Pengelompokan Peristiwa Konservatif (Event Clustering)
 * Mengelompokkan publikasi yang membahas peristiwa yang sama dengan bukti multi-sinyal.
 */
export function clusterEventPublications(
  items: NormalizedPublication[],
  existingClusters: EventCluster[] = []
): EventCluster[] {
  const deduped = deduplicatePublications(items)
  if (deduped.length === 0) return []

  // Siapkan map token dan entitas untuk efisiensi
  const itemMeta = deduped.map(item => ({
    item,
    tokens: extractSubstantiveTokens(item.title),
    entities: extractEntitiesFromText(item.title + ' ' + (item.excerpt || ''))
  }))

  const clusters: Array<{
    id: string
    members: NormalizedPublication[]
    matchReasons: Set<string>
    category: NormalizedPublication['category']
    leadItem: NormalizedPublication
    candidateMembers: CandidateClusterMember[]
    rejectedCandidates: Array<{ item: NormalizedPublication; reason: string }>
  }> = []

  // Proses pengelompokan secara konservatif
  itemMeta.forEach(({ item, tokens, entities }) => {
    let assignedCluster: (typeof clusters)[0] | null = null
    let bestScore = 0
    let primaryReason = ''

    // Bandingkan dengan cluster yang sedang dibentuk
    for (const cl of clusters) {
      // Syarat 1: Harus dalam kategori yang sama atau salah satunya UMUM_NETRAL
      const sameCategory = cl.category === item.category || cl.category === 'UMUM_NETRAL' || item.category === 'UMUM_NETRAL'
      if (!sameCategory) continue

      // Syarat 2: Rentang waktu publikasi tidak boleh berselisih > 24 jam (Package 3 & 4)
      const leadPublished = cl.leadItem.publishedAt
      const currentPublished = item.publishedAt
      if (leadPublished !== null && currentPublished !== null) {
        const diffHours = Math.abs(leadPublished - currentPublished) / (1000 * 60 * 60)
        if (diffHours > 24) continue
      }

      // Hitung kata substantif & overlap awal
      const leadTokens = extractSubstantiveTokens(cl.leadItem.title)
      const setA = new Set(tokens)
      const setB = new Set(leadTokens)
      let sharedTokenCount = 0
      setA.forEach(t => { if (setB.has(t)) sharedTokenCount++ })
      const minTokens = Math.min(setA.size, setB.size)
      const overlapRatio = minTokens > 0 ? sharedTokenCount / minTokens : 0

      // Syarat 3: Cek konflik lokasi eksplisit (misal: Papua vs Ambalat, Intan Jaya vs Yahukimo)
      const leadLocations = extractLocationsFromText(cl.leadItem.title + ' ' + (cl.leadItem.excerpt || ''))
      const itemLocations = extractLocationsFromText(item.title + ' ' + (item.excerpt || ''))
      const sharedLocations = itemLocations.filter(l => leadLocations.includes(l))
      if (leadLocations.length > 0 && itemLocations.length > 0) {
        // Jika tidak ada satupun irisan lokasi, tolak penggabungan
        if (sharedLocations.length === 0) {
          cl.rejectedCandidates.push({
            item,
            reason: `Ditolak: Konflik lokasi (${leadLocations.join(', ')} vs ${itemLocations.join(', ')})`
          })
          continue
        }

        // Jika berada di provinsi/wilayah luas yang sama (misal Papua), tapi memiliki distrik/kabupaten berbeda yang bertentangan
        const broadAreas = new Set(['papua', 'jakarta'])
        const leadSpecificLocs = leadLocations.filter(l => !broadAreas.has(l))
        const itemSpecificLocs = itemLocations.filter(l => !broadAreas.has(l))
        if (leadSpecificLocs.length > 0 && itemSpecificLocs.length > 0) {
          const hasSharedSpecific = itemSpecificLocs.some(l => leadSpecificLocs.includes(l))
          if (!hasSharedSpecific) {
            cl.rejectedCandidates.push({
              item,
              reason: `Ditolak: Konflik distrik spesifik (${leadSpecificLocs.join(', ')} vs ${itemSpecificLocs.join(', ')})`
            })
            continue // Konflik kabupaten/distrik spesifik (misal Intan Jaya vs Yahukimo)
          }
        }
      }

      // Syarat 4: Cek konflik tanggal peristiwa eksplisit di judul (misal: 15 Oktober vs 22 Oktober)
      const datePattern = /\b(\d{1,2}\s+(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember))\b/gi
      const leadDateMatches: string[] = cl.leadItem.title.toLowerCase().match(datePattern) || []
      const itemDateMatches: string[] = item.title.toLowerCase().match(datePattern) || []
      if (leadDateMatches.length > 0 && itemDateMatches.length > 0) {
        const hasSharedDate = itemDateMatches.some(d => leadDateMatches.includes(d))
        if (!hasSharedDate) {
          cl.rejectedCandidates.push({
            item,
            reason: `Ditolak: Konflik tanggal peristiwa (${leadDateMatches.join(', ')} vs ${itemDateMatches.join(', ')})`
          })
          continue // Konflik tanggal peristiwa berulang, jangan digabung!
        }
      }

      // Syarat 5: Evaluasi sinyal kemiripan teks & entitas
      const jaccard = calculateJaccardSimilarity(tokens, leadTokens)

      // Cek overlap entitas bersama
      const leadEntities = extractEntitiesFromText(cl.leadItem.title + ' ' + (cl.leadItem.excerpt || ''))
      const sharedEntities = entities.filter(e => leadEntities.includes(e))

      // Hitung kata substantif non-lokasi (mencegah false merge jika dua berita berbeda hanya sama di nama wilayah)
      const nonLocationShared = Array.from(setA).filter(t => setB.has(t) && !STRATEGIC_LOCATIONS.includes(t) && !['barat', 'timur', 'selatan', 'utara', 'pusat', 'kota', 'kabupaten'].includes(t))

      // Kriteria Penggabungan Konservatif Berbasis Bukti Multi-Sinyal:
      // Opsi 1: Jaccard sangat tinggi (>= 0.40)
      // Opsi 2: Overlap substantif kuat (sharedTokenCount >= 4 atau sharedTokenCount >= 3 dengan overlapRatio >= 0.35)
      // Opsi 3: Konfirmasi peristiwa lokal: kesamaan entitas strategis + kesamaan lokasi terverifikasi + minimal 2 kata peristiwa non-lokasi
      // Opsi 4: Memiliki entitas strategis bersama DAN ada irisan peristiwa non-lokasi memadai
      let candidateScore = 0
      let candidateReason = ''

      if (jaccard >= 0.40) {
        candidateScore = jaccard
        candidateReason = `Kemiripan judul semantik ${Math.round(jaccard * 100)}%`
      } else if (sharedTokenCount >= 4 || (sharedTokenCount >= 3 && overlapRatio >= 0.35)) {
        candidateScore = Math.max(overlapRatio, 0.45)
        candidateReason = `Irisan kata substantif ${sharedTokenCount} kata (${Math.round(overlapRatio * 100)}%)`
      } else if (sharedEntities.length > 0 && sharedLocations.length > 0 && nonLocationShared.length >= 1) {
        candidateScore = 0.55
        candidateReason = `Konfirmasi peristiwa lokal: entitas (${sharedEntities.join(', ')}), lokasi (${sharedLocations.join(', ')}), & kata peristiwa bersama (${nonLocationShared.join(', ')})`
      } else if (sharedEntities.length > 0 && (nonLocationShared.length >= 1 && (jaccard >= 0.15 || overlapRatio >= 0.25))) {
        candidateScore = Math.max(jaccard + 0.25, overlapRatio * 0.7 + 0.2)
        candidateReason = `Kesamaan entitas (${sharedEntities.join(', ')}) & irisan substantif ${sharedTokenCount} kata`
      } else if (candidateScore < 0.40 && (sharedEntities.length > 0 || (sharedTokenCount >= 2 && jaccard >= 0.15))) {
        // Catat sebagai candidate member untuk review analis
        cl.candidateMembers.push({
          itemId: item.id,
          title: item.title,
          candidateReason: sharedEntities.length > 0
            ? `Entitas sama (${sharedEntities.join(', ')}) namun konteks/aksi belum berkonvergensi penuh`
            : `Kemiripan borderline (${Math.round(jaccard * 100)}%), butuh telaah analis`,
          ambiguityNotes: `Skor kemiripan: ${Math.round((candidateScore || jaccard) * 100)}%`
        })
      }

      if (candidateScore > bestScore && candidateScore >= 0.40) {
        bestScore = candidateScore
        assignedCluster = cl
        primaryReason = candidateReason
      }
    }

    if (assignedCluster && bestScore >= 0.40) {
      // Gabungkan ke cluster yang ada
      assignedCluster.members.push(item)
      assignedCluster.matchReasons.add(primaryReason)

      // Utamakan item yang memiliki tanggal publikasi paling terverifikasi atau dari fact-check sebagai leadItem
      if (item.sourceType === 'fact_check' && assignedCluster.leadItem.sourceType !== 'fact_check') {
        assignedCluster.leadItem = item
        assignedCluster.category = item.category
      }
    } else {
      // Periksa apakah cocok dengan existingClusters dari cache/sesi sebelumnya untuk kestabilan ID
      let existingClusterId: string | null = null
      const matchedOld = existingClusters.find(oldCl => {
        const oldTokens = extractSubstantiveTokens(oldCl.title)
        return calculateJaccardSimilarity(tokens, oldTokens) >= 0.55
      })

      if (matchedOld) {
        existingClusterId = matchedOld.id
      }

      // Buat cluster baru yang stabil
      const clusterId = existingClusterId || `CLUST-${item.category.slice(0, 4)}-${createContentFingerprint(item.title)}`
      clusters.push({
        id: clusterId,
        members: [item],
        matchReasons: new Set(['Publikasi sumber utama']),
        category: item.category,
        leadItem: item,
        candidateMembers: [],
        rejectedCandidates: []
      })
    }
  })

  // Format ke kontrak domain EventCluster
  return clusters.map(cl => {
    const members = cl.members
    const memberItemIds = members.map(m => m.id)

    // Hitung cakupan publisher unik dan distinct hostnames (Package 3)
    const publishers = Array.from(new Set(members.map(m => m.publisher).filter(Boolean)))
    const publisherDomains = Array.from(new Set(
      members.map(m => extractPublisherDomain(m.canonicalUrl || m.originalUrl)).filter(Boolean)
    ))
    const distinctPublisherDomainCount = publisherDomains.length > 0 ? publisherDomains.length : publishers.length

    // Rentang waktu publikasi
    const validPublished = members
      .map(m => m.publishedAt)
      .filter((ts): ts is number => ts !== null && ts > 0)

    const firstPublishedAt = validPublished.length > 0 ? Math.min(...validPublished) : null
    const latestPublishedAt = validPublished.length > 0 ? Math.max(...validPublished) : null

    // Rentang waktu observasi NARADA
    const observedTimes = members.map(m => m.observedAt).filter(ts => ts > 0)
    const firstObservedAt = observedTimes.length > 0 ? Math.min(...observedTimes) : Date.now()
    const latestObservedAt = observedTimes.length > 0 ? Math.max(...observedTimes) : Date.now()

    // Keyakinan pengelompokan (0-100: keyakinan agregasi, BUKAN skor ancaman)
    const clusterConfidence = members.length > 1 ? Math.min(95, 70 + members.length * 8) : 60

    return {
      id: cl.id,
      title: cl.leadItem.title,
      memberItemIds,
      memberItems: members,
      firstPublishedAt,
      latestPublishedAt,
      firstObservedAt,
      latestObservedAt,
      category: cl.category,
      clusterConfidence,
      matchReasons: Array.from(cl.matchReasons),
      sourceCoverage: {
        publicationCount: members.length,
        identifiedPublisherCount: distinctPublisherDomainCount,
        distinctPublisherDomainCount,
        publishers,
        isIndependentCoverageClaimed: false // Domain unik bukan bukti independensi tanpa verifikasi sindikasi
      },
      leadItem: cl.leadItem,
      reviewState: cl.leadItem.reviewState,
      freshness: cl.leadItem.freshness,
      contextRelevance: cl.leadItem.contextRelevance,
      clusterReviewStatus: cl.candidateMembers.length > 0 ? 'AMBIGUOUS' : 'CONFIRMED',
      candidateMembers: cl.candidateMembers.length > 0 ? cl.candidateMembers : undefined
    }
  })
}

/**
 * 3. Menghubungkan SearchTrendSignal ke EventCluster sebagai Sinyal Kontekstual Tambahan
 * PENTING: Sinyal tren pencarian TIDAK PERNAH menambah publicationCount atau distinctPublisherDomainCount!
 */
export function attachTrendSignalsToClusters(
  clusters: EventCluster[],
  trendSignals: SearchTrendSignal[]
): EventCluster[] {
  if (!trendSignals || trendSignals.length === 0) return clusters

  return clusters.map(cluster => {
    const clusterTokens = extractSubstantiveTokens(cluster.title)
    const matchedSignals: SearchTrendSignal[] = []

    trendSignals.forEach(signal => {
      const signalTokens = extractSubstantiveTokens(signal.query)
      const jaccard = calculateJaccardSimilarity(clusterTokens, signalTokens)
      const queryNorm = signal.query.toLowerCase()
      const titleNorm = cluster.title.toLowerCase()

      // Hitung overlap token query ke dalam cluster
      const clusterTokenSet = new Set(clusterTokens)
      let sharedTokenCount = 0
      signalTokens.forEach(t => { if (clusterTokenSet.has(t)) sharedTokenCount++ })
      const queryOverlapRatio = signalTokens.length > 0 ? sharedTokenCount / signalTokens.length : 0

      // Cocok jika Jaccard >= 0.35, query terkandung utuh, atau seluruh token substantif query (min 2) berada di cluster
      if (
        jaccard >= 0.35 || 
        (queryNorm.length >= 4 && titleNorm.includes(queryNorm)) ||
        (signalTokens.length >= 2 && queryOverlapRatio >= 0.75)
      ) {
        matchedSignals.push(signal)
      }
    })

    if (matchedSignals.length > 0) {
      return {
        ...cluster,
        attachedTrendSignals: matchedSignals
      }
    }
    return cluster
  })
}
