import type { 
  TopicCandidate, 
  TopicCandidateState, 
  RadarTaxonomyDomain,
  SearchTrendSignal,
  NormalizedPublication,
  TopicObservation
} from './radar-types.ts'
import { classifyTaxonomyDomain } from './radar-assessment.ts'
import { sha256Hex } from '../ingest/rss-parser.ts'
import sourceCatalog from '../../../shared/radar-source-catalog.json' with { type: 'json' }

// Stopwords umum bahasa Indonesia untuk memfilter frasa tidak substantif
const STOPWORDS = new Set([
  'dan', 'di', 'ke', 'dari', 'yang', 'ini', 'itu', 'untuk', 'pada', 'adalah',
  'sebagai', 'dengan', 'atau', 'akan', 'bisa', 'ada', 'tidak', 'tak', 'oleh',
  'saat', 'dalam', 'setelah', 'tersebut', 'tentang', 'terkait', 'sebut', 'kata',
  'karena', 'bila', 'jika', 'agar', 'supaya', 'hingga', 'sampai', 'juga', 'pun',
  'para', 'bagi', 'sudah', 'telah', 'sedang', 'masih', 'banyak', 'lebih',
  'bukan', 'ia', 'dia', 'mereka', 'kita', 'kami', 'kamu', 'anda', 'terjadi',
  'hari', 'ini', 'terkini', 'terbaru', 'update', 'berita', 'soal', 'atas', 'lalu'
])

/**
 * Normalisasi string frasa untuk perbandingan deterministik
 */
export function normalizePhrase(raw: string): string {
  if (!raw) return ''
  return raw
    .toLowerCase()
    .replace(/[<>"'`;\\|/()[\]{}*+?^$]/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Validasi dan normalisasi masukan frasa kandidat topik (Sprint 6 WP5 / WP9)
 */
export function normalizeCandidatePhrase(raw: string): {
  isValid: boolean
  cleanedPhrase: string
  rejectionReason?: string
} {
  if (!raw || typeof raw !== 'string') {
    return { isValid: false, cleanedPhrase: '', rejectionReason: 'Frasa tidak boleh kosong' }
  }

  const cleaned = normalizePhrase(raw)
  if (!cleaned || cleaned.length < 3) {
    return { isValid: false, cleanedPhrase: '', rejectionReason: 'Frasa terlalu pendek (minimal 3 karakter)' }
  }

  const maxLen = sourceCatalog.dynamicSearchPolicy?.maxPhraseLength || 80
  const maxTokens = sourceCatalog.dynamicSearchPolicy?.maxPhraseTokens || 5

  if (cleaned.length > maxLen) {
    return { isValid: false, cleanedPhrase: '', rejectionReason: `Frasa melebihi batas ${maxLen} karakter` }
  }

  const tokens = cleaned.split(' ')
  if (tokens.length > maxTokens) {
    return { isValid: false, cleanedPhrase: '', rejectionReason: `Frasa melebihi batas ${maxTokens} kata` }
  }

  // Tolak URL, protocol, dan injection characters
  if (/https?:\/\/|www\.|\.com|\.id|\.net|site:|file:|localhost/i.test(raw)) {
    return { isValid: false, cleanedPhrase: '', rejectionReason: 'Injeksi URL atau override host ditolak oleh kebijakan keamanan' }
  }

  return { isValid: true, cleanedPhrase: cleaned }
}

/**
 * Ekstraksi kandidat n-gram (bigram & trigram) dari teks
 */
export function extractCandidatePhrases(text: string): string[] {
  const norm = normalizePhrase(text)
  const tokens = norm.split(' ').filter(t => t.length >= 3 && !STOPWORDS.has(t))
  const phrases: string[] = []

  const maxLen = sourceCatalog.dynamicSearchPolicy?.maxPhraseLength || 80
  const maxTokens = sourceCatalog.dynamicSearchPolicy?.maxPhraseTokens || 5

  // 1. Ambil unigram yang memiliki panjang kuat (misal akronim/nama lembaga/istilah khusus)
  for (const t of tokens) {
    if (t.length >= 5 && !STOPWORDS.has(t)) {
      phrases.push(t)
    }
  }

  // 2. Ekstraksi bigram
  for (let i = 0; i < tokens.length - 1; i++) {
    const bi = `${tokens[i]} ${tokens[i + 1]}`
    if (bi.length <= maxLen) {
      phrases.push(bi)
    }
  }

  // 3. Ekstraksi trigram
  for (let i = 0; i < tokens.length - 2; i++) {
    const tri = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`
    if (tri.length <= maxLen && tri.split(' ').length <= maxTokens) {
      phrases.push(tri)
    }
  }

  return Array.from(new Set(phrases))
}

/**
 * Evaluasi relevansi topik terhadap taksonomi 7 domain NARADA
 */
export function evaluateCandidateRelevance(phrase: string): {
  domain: RadarTaxonomyDomain
  score: number
  isEligibleTaxonomy: boolean
} {
  const domain = classifyTaxonomyDomain(phrase, '', 'NATIONAL_POLICY')
  const norm = phrase.toLowerCase()

  let score = 40

  // Berikan skor lebih tinggi jika cocok dengan kata kunci domain spesifik
  if (domain === 'DIGITAL_ECONOMY' && (norm.includes('pajak') || norm.includes('transaksi') || norm.includes('fintech') || norm.includes('marketplace'))) {
    score = 85
  } else if (domain === 'DEFENSE_SECURITY' && (norm.includes('tni') || norm.includes('alutsista') || norm.includes('papua') || norm.includes('natuna') || norm.includes('perbatasan'))) {
    score = 90
  } else if (domain === 'CIVIC_DYNAMICS' && (norm.includes('unjuk rasa') || norm.includes('demo') || norm.includes('aksi') || norm.includes('protes'))) {
    score = 80
  } else if (domain === 'PUBLIC_CRISIS' && (norm.includes('gempa') || norm.includes('tsunami') || norm.includes('banjir') || norm.includes('bencana') || norm.includes('bbm'))) {
    score = 85
  } else if (domain === 'INFORMATION_INTEGRITY' && (norm.includes('hoaks') || norm.includes('disinformasi') || norm.includes('cek fakta'))) {
    score = 90
  } else if (domain === 'CYBER_PUBLIC_IMPACT' && (norm.includes('kebocoran') || norm.includes('siber') || norm.includes('ransomware') || norm.includes('hacker'))) {
    score = 90
  } else if (domain === 'NATIONAL_POLICY' && (norm.includes('kebijakan') || norm.includes('presiden') || norm.includes('menteri') || norm.includes('dpr') || norm.includes('anggaran'))) {
    score = 75
  }

  return {
    domain,
    score,
    isEligibleTaxonomy: score >= 60
  }
}

/**
 * Generator ID kandidat topik deterministik
 */
export function generateTopicCandidateId(phrase: string): string {
  const norm = normalizePhrase(phrase)
  return `TOPIC-${sha256Hex(norm).slice(0, 16)}`
}

/**
 * Pemetaan Kanonikal Domain Taksonomi ke Google News Profile ID (Sprint 6.1 WP2 / S61-10)
 */
export function mapDomainToGoogleNewsProfile(domain: string): string | null {
  switch (domain) {
    case 'NATIONAL_POLICY':
      return 'gnews-national-policy'
    case 'DIGITAL_ECONOMY':
      return 'gnews-digital-economy'
    case 'DEFENSE_SECURITY':
      return 'gnews-defense-security'
    case 'CIVIC_DYNAMICS':
      return 'gnews-civic-dynamics'
    case 'PUBLIC_CRISIS':
      return 'gnews-public-crisis'
    case 'INFORMATION_INTEGRITY':
      return 'gnews-information-integrity'
    case 'CYBER_PUBLIC_IMPACT':
      return 'gnews-defense-security'
    default:
      return null
  }
}

/**
 * Ekstraksi domain bersih dari string URL
 */
function extractDomainFromUrl(urlStr?: string): string | undefined {
  if (!urlStr) return undefined
  try {
    const u = new URL(urlStr)
    return u.hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return undefined
  }
}

/**
 * Helper internal untuk mencatat observasi kandidat secara deterministik (WP3)
 */
function addOrUpdateObservation(
  candidate: TopicCandidate,
  obs: Omit<TopicObservation, 'id' | 'candidateId' | 'firstObservedAt' | 'lastObservedAt'> & {
    firstObservedAt?: number
    lastObservedAt?: number
  },
  now = Date.now()
): void {
  if (!candidate.observations) {
    candidate.observations = []
  }

  const key = `${obs.sourceId}:${obs.publicationId || 'signal'}`
  const obsId = `obs-${sha256Hex(key).slice(0, 16)}`
  const existing = candidate.observations.find(o => o.id === obsId)

  if (existing) {
    existing.lastObservedAt = now
    if (obs.provenanceUrl) existing.provenanceUrl = obs.provenanceUrl
    if (obs.publisherDomain) existing.publisherDomain = obs.publisherDomain
  } else {
    candidate.observations.push({
      id: obsId,
      candidateId: candidate.id,
      sourceId: obs.sourceId,
      sourceKind: obs.sourceKind,
      publicationId: obs.publicationId,
      publisherDomain: obs.publisherDomain,
      firstObservedAt: obs.firstObservedAt || now,
      lastObservedAt: obs.lastObservedAt || now,
      provenanceUrl: obs.provenanceUrl
    })
  }

  // Hitung ulang metrik koroborasi & penerbit secara murni dari observasi (WP3)
  const uniqueSources = new Set(candidate.observations.map(o => o.sourceId))
  candidate.corroborationCount = Math.max(1, uniqueSources.size)

  const uniqueDomains = new Set(candidate.observations.map(o => o.publisherDomain).filter(Boolean))
  candidate.distinctPublisherCount = Math.max(1, uniqueDomains.size)
}

export class TopicDiscoveryEngine {
  private candidates: Map<string, TopicCandidate> = new Map()

  /**
   * Menambahkan atau memperbarui sinyal Google Trends ke dalam daftar kandidat (WP3)
   */
  public ingestTrendSignals(signals: SearchTrendSignal[]): TopicCandidate[] {
    const updated: TopicCandidate[] = []
    const now = Date.now()

    for (const sig of signals) {
      const phrase = sig.query.trim()
      const norm = normalizePhrase(phrase)
      if (!norm || norm.length < 4) continue

      const id = generateTopicCandidateId(norm)
      const existing = this.candidates.get(id)
      const relevance = evaluateCandidateRelevance(norm)

      if (existing) {
        existing.lastObservedAt = now
        addOrUpdateObservation(existing, {
          sourceId: 'src-google-trends',
          sourceKind: 'TRENDS_SIGNAL',
          firstObservedAt: now,
          lastObservedAt: now
        }, now)

        // Promosikan ke ACTIVE_SEARCH jika koroborasi >= 2 dan lolos taksonomi
        if (existing.state === 'PROPOSED' && relevance.isEligibleTaxonomy && existing.corroborationCount >= 2) {
          existing.state = 'ACTIVE_SEARCH'
        }
        updated.push(existing)
      } else {
        const candidate: TopicCandidate = {
          id,
          phrase,
          normalizedPhrase: norm,
          tokenCount: norm.split(' ').length,
          source: 'TRENDS_SIGNAL',
          firstObservedAt: now,
          lastObservedAt: now,
          matchedDomain: relevance.domain,
          relevanceScore: relevance.score,
          corroborationCount: 1,
          distinctPublisherCount: 1,
          state: relevance.isEligibleTaxonomy ? 'PROPOSED' : 'REJECTED',
          searchCount: 0,
          lastSearchedAt: null,
          nextSearchEligibleAt: now,
          decayScore: 100,
          observations: []
        }
        addOrUpdateObservation(candidate, {
          sourceId: 'src-google-trends',
          sourceKind: 'TRENDS_SIGNAL',
          firstObservedAt: now,
          lastObservedAt: now
        }, now)

        this.candidates.set(id, candidate)
        updated.push(candidate)
      }
    }

    return updated
  }

  /**
   * Ekstraksi kemunculan frasa baru dari publikasi pers aktif (WP3)
   */
  public ingestPublications(publications: NormalizedPublication[]): TopicCandidate[] {
    const updated: TopicCandidate[] = []
    const now = Date.now()

    for (const pub of publications) {
      const phrases = extractCandidatePhrases(pub.title)
      const pubDomain = extractDomainFromUrl(pub.canonicalUrl || pub.originalUrl) || pub.publisher

      for (const phrase of phrases) {
        const norm = normalizePhrase(phrase)
        if (!norm || norm.length < 5) continue

        const id = generateTopicCandidateId(norm)
        const existing = this.candidates.get(id)
        const relevance = evaluateCandidateRelevance(norm)

        if (existing) {
          existing.lastObservedAt = now
          addOrUpdateObservation(existing, {
            sourceId: pub.sourceId,
            sourceKind: 'PUBLICATION_EMERGENCE',
            publicationId: pub.id,
            publisherDomain: pubDomain,
            provenanceUrl: pub.canonicalUrl || pub.originalUrl,
            firstObservedAt: now,
            lastObservedAt: now
          }, now)

          if (existing.state === 'PROPOSED' && relevance.isEligibleTaxonomy && existing.corroborationCount >= 2) {
            existing.state = 'ACTIVE_SEARCH'
          }
          updated.push(existing)
        } else {
          // Hanya simpan jika memiliki relevansi taksonomi dasar
          if (!relevance.isEligibleTaxonomy) continue

          const candidate: TopicCandidate = {
            id,
            phrase,
            normalizedPhrase: norm,
            tokenCount: norm.split(' ').length,
            source: 'PUBLICATION_EMERGENCE',
            firstObservedAt: now,
            lastObservedAt: now,
            matchedDomain: relevance.domain,
            relevanceScore: relevance.score,
            corroborationCount: 1,
            distinctPublisherCount: 1,
            state: 'PROPOSED',
            searchCount: 0,
            lastSearchedAt: null,
            nextSearchEligibleAt: now,
            decayScore: 100,
            observations: []
          }
          addOrUpdateObservation(candidate, {
            sourceId: pub.sourceId,
            sourceKind: 'PUBLICATION_EMERGENCE',
            publicationId: pub.id,
            publisherDomain: pubDomain,
            provenanceUrl: pub.canonicalUrl || pub.originalUrl,
            firstObservedAt: now,
            lastObservedAt: now
          }, now)

          this.candidates.set(id, candidate)
          updated.push(candidate)
        }
      }
    }

    return updated
  }

  /**
   * Pemasukan manual frasa topik oleh operator analis (Operator Watchlist)
   */
  public addOperatorWatchlistPhrase(phrase: string, domain?: RadarTaxonomyDomain, notes?: string): TopicCandidate {
    const norm = normalizePhrase(phrase)
    const id = generateTopicCandidateId(norm)
    const now = Date.now()

    const assignedDomain = domain || classifyTaxonomyDomain(phrase, '', 'NATIONAL_POLICY')
    const existing = this.candidates.get(id)

    if (existing) {
      existing.source = 'OPERATOR_WATCHLIST'
      existing.state = 'ACTIVE_SEARCH' // Operator watchlist langsung diaktifkan
      existing.lastObservedAt = now
      existing.matchedDomain = assignedDomain
      existing.relevanceScore = Math.max(existing.relevanceScore, 90)
      if (notes) existing.notes = notes
      addOrUpdateObservation(existing, {
        sourceId: 'OPERATOR',
        sourceKind: 'OPERATOR_WATCHLIST',
        firstObservedAt: now,
        lastObservedAt: now
      }, now)
      existing.status = existing.state
      existing.domain = existing.matchedDomain
      existing.dynamicSearchCount = existing.searchCount
      return existing
    }

    const candidate: TopicCandidate = {
      id,
      phrase: phrase.trim(),
      normalizedPhrase: norm,
      tokenCount: norm.split(' ').length,
      source: 'OPERATOR_WATCHLIST',
      firstObservedAt: now,
      lastObservedAt: now,
      matchedDomain: assignedDomain,
      relevanceScore: 95,
      corroborationCount: 1,
      distinctPublisherCount: 1,
      state: 'ACTIVE_SEARCH',
      searchCount: 0,
      lastSearchedAt: null,
      nextSearchEligibleAt: now,
      decayScore: 100,
      notes: notes,
      observations: []
    }

    addOrUpdateObservation(candidate, {
      sourceId: 'OPERATOR',
      sourceKind: 'OPERATOR_WATCHLIST',
      firstObservedAt: now,
      lastObservedAt: now
    }, now)

    candidate.status = candidate.state
    candidate.domain = candidate.matchedDomain
    candidate.dynamicSearchCount = candidate.searchCount

    this.candidates.set(id, candidate)
    return candidate
  }

  /**
   * Pemasukan frasa watchlist oleh UI operator (Sprint 6 WP9)
   */
  public addWatchlistPhrase(phrase: string, domain?: RadarTaxonomyDomain, notes?: string): TopicCandidate {
    return this.addOperatorWatchlistPhrase(phrase, domain, notes)
  }

  /**
   * Mengembalikan kandidat dari penyimpanan lokal secara utuh tanpa mengubah provenance (WP5 / S61-19)
   */
  public hydrateCandidates(persistedList: TopicCandidate[]): void {
    if (!Array.isArray(persistedList)) return
    for (const item of persistedList) {
      if (!item || !item.id) continue
      const existing = this.candidates.get(item.id)
      if (existing) {
        if (item.observations && Array.isArray(item.observations)) {
          for (const obs of item.observations) {
            addOrUpdateObservation(existing, obs, obs.lastObservedAt)
          }
        }
        existing.firstObservedAt = Math.min(existing.firstObservedAt, item.firstObservedAt || existing.firstObservedAt)
        existing.lastObservedAt = Math.max(existing.lastObservedAt, item.lastObservedAt || existing.lastObservedAt)
        if (item.lastSearchResult) existing.lastSearchResult = item.lastSearchResult
      } else {
        const candidate: TopicCandidate = {
          ...item,
          status: item.status || item.state,
          domain: item.domain || item.matchedDomain,
          dynamicSearchCount: item.dynamicSearchCount ?? item.searchCount,
          observations: item.observations || []
        }
        this.candidates.set(item.id, candidate)
      }
    }
  }

  /**
   * Mempromosikan status kandidat topik (misal ke WATCHLIST atau ACTIVE_SEARCH)
   */
  public promoteCandidate(candidateId: string, newState: TopicCandidateState): void {
    const c = this.candidates.get(candidateId)
    if (c) {
      c.state = newState
      c.status = newState
    }
  }

  /**
   * Menolak kandidat topik
   */
  public rejectCandidate(candidateId: string, reason?: string): void {
    const c = this.candidates.get(candidateId)
    if (c) {
      c.state = 'REJECTED'
      c.status = 'REJECTED'
      if (reason) c.notes = reason
    }
  }

  /**
   * Memilih kandidat topik yang layak dieksekusi pencarian dinamis pada siklus saat ini
   * Menegakkan batasan kuota: maksimal 2 kueri per siklus, cooldown 30 menit per frasa
   */
  public selectCandidatesForSearch(limit = 2): TopicCandidate[] {
    const now = Date.now()
    const eligible: TopicCandidate[] = []

    const candidatesList = Array.from(this.candidates.values())

    for (const c of candidatesList) {
      if (c.state !== 'ACTIVE_SEARCH') continue
      if (c.nextSearchEligibleAt && now < c.nextSearchEligibleAt) continue
      eligible.push(c)
    }

    // Urutkan berdasarkan prioritas: OPERATOR_WATCHLIST duluan, lalu skor relevansi * koroborasi
    eligible.sort((a, b) => {
      if (a.source === 'OPERATOR_WATCHLIST' && b.source !== 'OPERATOR_WATCHLIST') return -1
      if (b.source === 'OPERATOR_WATCHLIST' && a.source !== 'OPERATOR_WATCHLIST') return 1
      return (b.relevanceScore * b.corroborationCount) - (a.relevanceScore * a.corroborationCount)
    })

    const maxCycle = sourceCatalog.dynamicSearchPolicy?.maxDynamicQueriesPerCycle || limit
    return eligible.slice(0, Math.min(limit, maxCycle))
  }

  /**
   * Mencatat penyelesaian eksekusi pencarian untuk kandidat topik setelah mencapai terminal outcome
   */
  public recordSearchExecution(
    candidateId: string,
    outcome: 'SUCCESS' | 'VALID_EMPTY' | 'RATE_LIMITED' | 'TRANSPORT_FAILED' | 'INVALID_RESPONSE' | 'CANCELLED' = 'SUCCESS'
  ): void {
    const c = this.candidates.get(candidateId)
    if (!c) return

    const now = Date.now()
    const phraseCooldownMs = sourceCatalog.dynamicSearchPolicy?.phraseCooldownMs || 1800000

    c.lastSearchedAt = now
    c.lastSearchResult = outcome

    if (outcome === 'SUCCESS' || outcome === 'VALID_EMPTY') {
      c.searchCount++
      c.dynamicSearchCount = c.searchCount
      c.nextSearchEligibleAt = now + phraseCooldownMs
    } else if (outcome === 'RATE_LIMITED') {
      c.nextSearchEligibleAt = now + 3600000 // 1 hour cooldown saat rate limit
    } else {
      // TRANSPORT_FAILED, INVALID_RESPONSE, CANCELLED
      c.nextSearchEligibleAt = now + 900000 // 15 menit cooldown percobaan ulang
    }
  }

  /**
   * Menjalankan pembersihan dan pembusukan kandidat usang (> 24 jam)
   */
  public pruneExpiredCandidates(): void {
    const now = Date.now()
    const expiryMs = sourceCatalog.dynamicSearchPolicy?.candidateExpiryMs || 86400000

    this.candidates.forEach((c) => {
      if (c.source === 'OPERATOR_WATCHLIST') {
        // Operator watchlist dipertahankan kecuali dihapus eksplisit
        return
      }

      if (now - c.lastObservedAt > expiryMs) {
        c.state = 'EXPIRED'
      }
    })
  }

  /**
   * Mengambil seluruh kandidat aktif
   */
  public getAllCandidates(): TopicCandidate[] {
    return Array.from(this.candidates.values()).map(c => ({
      ...c,
      status: c.status || c.state,
      domain: c.domain || c.matchedDomain,
      dynamicSearchCount: c.dynamicSearchCount ?? c.searchCount
    }))
  }

  /**
   * Mengambil kandidat dengan status tertentu
   */
  public getCandidatesByState(state: TopicCandidateState): TopicCandidate[] {
    return this.getAllCandidates().filter(c => c.state === state || c.status === state)
  }

  /**
   * Menghapus seluruh kandidat (untuk pengujian)
   */
  public clear(): void {
    this.candidates.clear()
  }
}

// Export singleton engine
export const topicDiscoveryEngine = new TopicDiscoveryEngine()
