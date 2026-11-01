import type { 
  TopicCandidate, 
  TopicCandidateState, 
  RadarTaxonomyDomain,
  SearchTrendSignal,
  NormalizedPublication 
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

export class TopicDiscoveryEngine {
  private candidates: Map<string, TopicCandidate> = new Map()

  /**
   * Menambahkan atau memperbarui sinyal Google Trends ke dalam daftar kandidat
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
        existing.corroborationCount++
        existing.distinctPublisherCount = Math.max(existing.distinctPublisherCount, 1)

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
          decayScore: 100
        }
        this.candidates.set(id, candidate)
        updated.push(candidate)
      }
    }

    return updated
  }

  /**
   * Ekstraksi kemunculan frasa baru dari publikasi pers aktif
   */
  public ingestPublications(publications: NormalizedPublication[]): TopicCandidate[] {
    const updated: TopicCandidate[] = []
    const now = Date.now()

    for (const pub of publications) {
      const phrases = extractCandidatePhrases(pub.title)
      for (const phrase of phrases) {
        const norm = normalizePhrase(phrase)
        if (!norm || norm.length < 5) continue

        const id = generateTopicCandidateId(norm)
        const existing = this.candidates.get(id)
        const relevance = evaluateCandidateRelevance(norm)

        if (existing) {
          existing.lastObservedAt = now
          existing.corroborationCount++
          existing.distinctPublisherCount = Math.max(existing.distinctPublisherCount, 1)

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
            decayScore: 100
          }
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
  public addOperatorWatchlistPhrase(phrase: string, domain?: RadarTaxonomyDomain): TopicCandidate {
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
      corroborationCount: 2,
      distinctPublisherCount: 1,
      state: 'ACTIVE_SEARCH',
      searchCount: 0,
      lastSearchedAt: null,
      nextSearchEligibleAt: now,
      decayScore: 100
    }

    this.candidates.set(id, candidate)
    return candidate
  }

  /**
   * Pemasukan frasa watchlist oleh UI operator (Sprint 6 WP9)
   */
  public addWatchlistPhrase(phrase: string, domain?: RadarTaxonomyDomain, notes?: string): TopicCandidate {
    const candidate = this.addOperatorWatchlistPhrase(phrase, domain)
    if (notes) candidate.notes = notes
    candidate.status = candidate.state
    candidate.domain = candidate.matchedDomain
    candidate.dynamicSearchCount = candidate.searchCount
    return candidate
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
   * Mencatat penyelesaian eksekusi pencarian untuk kandidat topik
   */
  public recordSearchExecution(candidateId: string): void {
    const c = this.candidates.get(candidateId)
    if (!c) return

    const now = Date.now()
    const cooldownMs = sourceCatalog.dynamicSearchPolicy?.phraseCooldownMs || 1800000

    c.searchCount++
    c.lastSearchedAt = now
    c.nextSearchEligibleAt = now + cooldownMs
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
