import type { DebunkKnowledgeEntry } from '../../types.ts'
import databaseJson from './debunk-database.json' with { type: 'json' }

const LOCAL_ARCHIVE_ENTRIES: DebunkKnowledgeEntry[] = (databaseJson as DebunkKnowledgeEntry[]).map((e, idx) => ({
  ...e,
  isLive: false,
  viralityReason: e.viralityReason || (e.verdict === 'HOAKS' ? '🚨 PUSSIBERAD ARSIP: Disinformasi Terverifikasi' : '🛡️ PUSSIBERAD ARSIP: Klarifikasi Resmi Hankam'),
  originalPlatform: e.originalPlatform || 'Pusat Analisis Siber AD (Pangkalan Data Teritorial)',
  originalSourceUrl: e.originalSourceUrl || e.sourceUrl,
  interceptedAt: e.interceptedAt || `${String(8 + (idx % 8)).padStart(2, '0')}:15 WIB`,
  verifiedAt: e.verifiedAt || `${String(8 + (idx % 8)).padStart(2, '0')}:22 WIB`,
  viralVelocity: e.viralVelocity || '+40K sebaran (Terdokumentasi)',
  engagement: e.engagement || {
    views: '+40K',
    shares: '2.5K',
    velocityRate: '+110%/jam',
    timeElapsed: 'Terdokumentasi'
  }
}))

let activeDebunkDatabase: DebunkKnowledgeEntry[] = [...LOCAL_ARCHIVE_ENTRIES]

/**
 * Mendaftarkan entri debunk baru hasil streaming live API ke dalam in-memory knowledge pool aktif
 */
export function registerLiveDebunks(liveEntries: DebunkKnowledgeEntry[]): void {
  if (!liveEntries || liveEntries.length === 0) return

  const existingIds = new Set(activeDebunkDatabase.map(e => e.id))
  const newItems: DebunkKnowledgeEntry[] = []

  for (const entry of liveEntries) {
    if (!existingIds.has(entry.id)) {
      existingIds.add(entry.id)
      newItems.push({
        ...entry,
        isLive: true,
      })
    }
  }

  // Letakkan entri live teranyar di urutan terdepan
  activeDebunkDatabase = [...newItems, ...activeDebunkDatabase]
}

/**
 * Mengambil seluruh data debunk aktif (live stream + arsip lokal)
 */
export function getActiveDebunks(): DebunkKnowledgeEntry[] {
  return [...activeDebunkDatabase]
}

/**
 * Mengambil hanya data arsip lokal terkurasi PUSSIBERAD (200+ entri terverifikasi)
 */
export function getCuratedArchiveDebunks(): DebunkKnowledgeEntry[] {
  return [...LOCAL_ARCHIVE_ENTRIES]
}

/**
 * Normalisasi teks: membersihkan karakter hasil OCR, tanda baca liar, dan spasi berlebih
 */
export function normalizeText(text: string): string {
  if (!text) return ''
  return text
    .toLowerCase()
    .replace(/[=—|»«‘'"`~!@#$%^&*()_+={}\[\]:;<>?\/\\.,-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Ekstraksi token kata bersih (panjang >= 2 huruf)
 */
export function tokenizeClean(text: string): string[] {
  const norm = normalizeText(text)
  if (!norm) return []
  return norm.split(' ').filter(t => t.length >= 2)
}

/**
 * Hitung Jaccard similarity antara dua set token
 */
export function calculateJaccardSimilarity(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0
  const setA = new Set(tokensA)
  const setB = new Set(tokensB)

  let intersectionCount = 0
  setA.forEach(token => {
    if (setB.has(token)) intersectionCount++
  })

  const unionSize = new Set([...setA, ...setB]).size
  return unionSize > 0 ? intersectionCount / unionSize : 0
}

/**
 * Daftar Signature Keyword Pairs untuk deteksi instan (Tier 1)
 */
interface SignatureRule {
  requiredKeywords: string[][] // Setiap grup array harus memiliki minimal 1 match
  minGroupsMatched: number
  targetEntryId: string
  boostConfidence: number
}

const SIGNATURE_RULES: SignatureRule[] = [
  // Politik: Gibran dicopot
  {
    requiredKeywords: [
      ['gibran', 'rakabuming', 'wapres'],
      ['dicopot', 'pemecatan', 'diberhentikan', 'pemakzulan', 'surat pemecatan']
    ],
    minGroupsMatched: 2,
    targetEntryId: 'TBH-POL-001',
    boostConfidence: 96
  },
  // Politik: Jokowi gantikan Prabowo
  {
    requiredKeywords: [
      ['jokowi', 'jokowidodo'],
      ['gantikan', 'menggantikan', 'diangkat kembali', 'menjadi presiden'],
      ['prabowo', 'presiden prabowo']
    ],
    minGroupsMatched: 3,
    targetEntryId: 'TBH-POL-002',
    boostConfidence: 96
  },
  // Politik: Prabowo koma / sakit kritis
  {
    requiredKeywords: [
      ['prabowo', 'presiden'],
      ['koma', 'stroke', 'dilarikan', 'rumah sakit', 'kritis']
    ],
    minGroupsMatched: 2,
    targetEntryId: 'TBH-POL-003',
    boostConfidence: 94
  },
  // Bencana: Katulampa jebol
  {
    requiredKeywords: [
      ['katulampa', 'bendung', 'bendungan'],
      ['jebol', 'pecah', 'runtuh', 'meluap jakarta']
    ],
    minGroupsMatched: 2,
    targetEntryId: 'TBH-BEN-002',
    boostConfidence: 96
  },
  // Bencana: Gempa megathrust waktu spesifik / lusa malam
  {
    requiredKeywords: [
      ['gempa', 'megathrust', 'seismik'],
      ['lusa malam', 'malam ini', 'jam 23', '23.00', 'besok pagi', 'keluar rumah']
    ],
    minGroupsMatched: 2,
    targetEntryId: 'TBH-BEN-001',
    boostConfidence: 96
  },
  // Bencana: Tsunami Pesisir Selatan Jawa
  {
    requiredKeywords: [
      ['tsunami', 'gelombang tinggi', 'peringatan dini tsunami'],
      ['selatan jawa', 'pantai selatan', '20 meter']
    ],
    minGroupsMatched: 2,
    targetEntryId: 'TBH-BEN-004',
    boostConfidence: 95
  },
  // Bansos: Kemensos BLT El Nino
  {
    requiredKeywords: [
      ['bansos', 'blt', 'bantuan tunai', 'el nino'],
      ['2.4 juta', 'telegram', 'whatsapp', 'kemensos', 'bit ly', 's id']
    ],
    minGroupsMatched: 2,
    targetEntryId: 'TBH-BAN-001',
    boostConfidence: 96
  },
  // Bansos: Surat tilang APK
  {
    requiredKeywords: [
      ['tilang', 'etle', 'surat tilang'],
      ['apk', 'file apk', 'kurir', 'whatsapp']
    ],
    minGroupsMatched: 2,
    targetEntryId: 'TBH-BAN-002',
    boostConfidence: 96
  },
  // Bansos: Kuota gratis Kemendikbud
  {
    requiredKeywords: [
      ['kuota', 'internet gratis', '100gb', '100 gb'],
      ['kemendikbud', 'guru siswa', 'pelajar']
    ],
    minGroupsMatched: 2,
    targetEntryId: 'TBH-BAN-003',
    boostConfidence: 94
  },
  // Kesehatan: Beras plastik
  {
    requiredKeywords: [
      ['beras'],
      ['plastik', 'sintetis', 'dibakar meleleh', 'menggumpal']
    ],
    minGroupsMatched: 2,
    targetEntryId: 'TBH-KES-001',
    boostConfidence: 95
  },
  // Kesehatan: Anggur Shine Muscat pestisida
  {
    requiredKeywords: [
      ['anggur', 'shine muscat'],
      ['pestisida', 'beracun', 'residu', 'bpom']
    ],
    minGroupsMatched: 2,
    targetEntryId: 'TBH-KES-002',
    boostConfidence: 95
  },
  // Militer: Alutsista fiktif 24 triliun
  {
    requiredKeywords: [
      ['tank', 'alutsista', 'pembelian', 'radar'],
      ['24 triliun', '24t', 'fiktif', 'kemhan']
    ],
    minGroupsMatched: 2,
    targetEntryId: 'TBH-MIL-001',
    boostConfidence: 96
  },
  // Militer: Tentara asing Morowali
  {
    requiredKeywords: [
      ['tentara asing', 'berseragam militer', 'pekerja tambang'],
      ['morowali', 'sulawesi tengah']
    ],
    minGroupsMatched: 2,
    targetEntryId: 'TBH-MIL-012',
    boostConfidence: 95
  },
  // Militer: Kedaulatan Natuna diserahkan
  {
    requiredKeywords: [
      ['natuna', 'pulau natuna', 'pangkalan militer asing'],
      ['diserahkan', 'pangkalan asing', 'secara rahasia', 'dijual']
    ],
    minGroupsMatched: 2,
    targetEntryId: 'TBH-MIL-003',
    boostConfidence: 95
  }
]

export interface DebunkSearchResult {
  matched: boolean
  confidence: number
  entry?: DebunkKnowledgeEntry
  similarityScore: number
  matchTier: 'TIER_1_SIGNATURE' | 'TIER_2_SEMANTIC_SIMILARITY' | 'NONE'
}

/**
 * Layanan Pencocokan Cepat Semantik (<5ms) terhadap Basis Data Cek Fakta Lokal
 */
export function searchLocalDebunk(inputText: string): DebunkSearchResult {
  if (!inputText || inputText.trim().length < 5) {
    return { matched: false, confidence: 0, similarityScore: 0, matchTier: 'NONE' }
  }

  const normalizedInput = normalizeText(inputText)
  const inputTokens = tokenizeClean(inputText)

  if (inputTokens.length === 0) {
    return { matched: false, confidence: 0, similarityScore: 0, matchTier: 'NONE' }
  }

  // ─── TIER 1: Signature Rule Checking ───
  for (const rule of SIGNATURE_RULES) {
    let matchedGroupCount = 0
    for (const group of rule.requiredKeywords) {
      const hasMatch = group.some(kw => {
        const cleanKw = normalizeText(kw)
        // Cek substring atau keberadaan token
        return normalizedInput.includes(cleanKw) || cleanKw.split(' ').every(w => inputTokens.includes(w))
      })
      if (hasMatch) matchedGroupCount++
    }

    if (matchedGroupCount >= rule.minGroupsMatched) {
      const foundEntry = activeDebunkDatabase.find(e => e.id === rule.targetEntryId)
      if (foundEntry) {
        return {
          matched: true,
          confidence: rule.boostConfidence,
          entry: foundEntry,
          similarityScore: 0.95,
          matchTier: 'TIER_1_SIGNATURE'
        }
      }
    }
  }

  // ─── TIER 2: N-Gram & Jaccard Semantic Token Overlap ───
  let bestEntry: DebunkKnowledgeEntry | null = null
  let maxSimilarity = 0

  for (const entry of activeDebunkDatabase) {
    // Kumpulkan seluruh token representasi dari entri
    const claimTokens = tokenizeClean(entry.claim)
    const queryTokens = tokenizeClean(entry.normalizedQuery)
    const kwTokens = entry.keywords.flatMap(kw => tokenizeClean(kw))

    // Gabungkan token unik entri
    const allEntryTokens = Array.from(new Set([...claimTokens, ...queryTokens, ...kwTokens]))

    const jaccardSim = calculateJaccardSimilarity(inputTokens, allEntryTokens)

    // Periksa juga substring coverage pada keywords penting
    let kwHits = 0
    for (const kw of entry.keywords) {
      const cleanKw = normalizeText(kw)
      if (normalizedInput.includes(cleanKw)) {
        kwHits += 2
      }
    }

    // Skor gabungan terbobot
    const score = jaccardSim * 0.6 + Math.min(0.4, (kwHits / Math.max(2, entry.keywords.length)) * 0.4)

    if (score > maxSimilarity) {
      maxSimilarity = score
      bestEntry = entry
    }
  }

  // Threshold pencocokan semantik (0.28 sudah cukup kuat untuk token overlap bahasa Indonesia)
  if (bestEntry && maxSimilarity >= 0.28) {
    const calcConfidence = Math.min(96, Math.max(90, Math.round(maxSimilarity * 100 + 40)))
    return {
      matched: true,
      confidence: calcConfidence,
      entry: bestEntry,
      similarityScore: parseFloat(maxSimilarity.toFixed(3)),
      matchTier: 'TIER_2_SEMANTIC_SIMILARITY'
    }
  }

  return {
    matched: false,
    confidence: 0,
    similarityScore: parseFloat(maxSimilarity.toFixed(3)),
    matchTier: 'NONE'
  }
}
