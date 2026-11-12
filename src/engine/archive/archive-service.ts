/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — ARCHIVE INTELLIGENCE SERVICE (KONSOL ARSIP PEMANTAUAN)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Modul terpadu untuk mengelola berita yang diarsipkan dari Radar Situasional.
 * Berita yang diarsipkan status utamanya adalah SEDANG DIPANTAU secara persisten,
 * dan dapat berubah secara otomatis saat data asli muncul (Fakta atau Hoaks)
 * maupun melalui penetapan verifikasi manual oleh analis intelijen.
 * 
 * SPRINT 14 ENGINE HARDENING:
 * 1. Semantic Claim Matching: Mendeteksi kecocokan klaim berita tersemat dengan
 *    artikel sanggahan (TurnBackHoax/MAFINDO/ANTARA) meskipun memiliki ID berbeda.
 * 2. Multi-Day Reconciler (reconcileArchivedItems): Menjamin berita tersemat lama
 *    (misal dari 10 Nov) yang kini telah terkonfirmasi faktual/hoaks (per 13 Nov)
 *    otomatis bertransisi statusnya menjadi FAKTA atau HOAKS.
 * ══════════════════════════════════════════════════════════════════════════
 */

import type { DebunkKnowledgeEntry } from '../../types.ts'

export type ArchiveVerdict = 'DIPANTAU' | 'FAKTA' | 'HOAKS'

export interface ArchivedDebunkEntry extends DebunkKnowledgeEntry {
  archivedAt: string            // Timestamp saat diarsipkan (format WIB/lokal)
  archivedTimestamp: number     // Unix timestamp epoch (ms)
  archiveVerdict: ArchiveVerdict // Status efektif pemantauan (default: DIPANTAU)
  isManualOverride?: boolean     // Apakah analis secara manual menetapkan vonis
  notes?: string
}

const STORAGE_KEY_IDS = 'narada_archived_issues'
const STORAGE_KEY_DATA = 'narada_archived_items_data'
const STORAGE_KEY_VERDICTS = 'narada_archived_classifications'

// Kunci migrasi mundur (backward compatibility dari pinned issues)
const LEGACY_PINNED_IDS = 'narada_pinned_issues'
const LEGACY_PINNED_VERDICTS = 'narada_pinned_classifications'

/**
 * Format waktu standar taktis Indonesia (WIB)
 */
function getFormattedWib(): string {
  const d = new Date()
  const dStr = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  const tStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} WIB`
  return `${dStr}, ${tStr}`
}

/**
 * Normalisasi teks klaim untuk pembandingan semantik:
 * Menghapus tag awalan verifikasi cek fakta [SALAH], [HOAKS], [DISINFORMASI], [KLARIFIKASI], tanda baca, dan spasi.
 */
export function normalizeClaimForMatching(text: string): string {
  if (!text) return ''
  return text
    .toLowerCase()
    .replace(/\[\s*(salah|hoaks|hoax|disinformasi|misinformasi|klarifikasi|fakta|bukan|palsu|manipulasi)\s*\]/gi, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Ekstraksi token substantif (kata bermakna panjang >= 3 karakter, non-stopword umum)
 */
export function extractSubstantiveTokens(text: string): string[] {
  const STOPWORDS = new Set([
    'dan', 'atau', 'yang', 'ini', 'itu', 'dari', 'pada', 'untuk', 'dengan', 'dalam', 'oleh',
    'ke', 'di', 'adalah', 'akan', 'telah', 'sudah', 'bisa', 'dapat', 'ada', 'karena', 'jika',
    'bahwa', 'saat', 'para', 'atas', 'tentang', 'terkait', 'sebagai', 'lebih', 'tidak', 'bukan'
  ])
  const normalized = normalizeClaimForMatching(text)
  return normalized
    .split(' ')
    .filter(w => w.length >= 3 && !STOPWORDS.has(w))
}

/**
 * Menguji apakah dua klaim secara semantik merujuk pada isu yang sama
 */
export function areClaimsSemanticallyMatching(claimA: string, claimB: string): boolean {
  const normA = normalizeClaimForMatching(claimA)
  const normB = normalizeClaimForMatching(claimB)
  if (!normA || !normB) return false
  if (normA === normB) return true
  if (normA.length >= 20 && normB.length >= 20 && (normA.includes(normB) || normB.includes(normA))) {
    return true
  }

  const tokensA = extractSubstantiveTokens(normA)
  const tokensB = extractSubstantiveTokens(normB)
  if (tokensA.length === 0 || tokensB.length === 0) return false

  const setB = new Set(tokensB)
  let common = 0
  for (const t of tokensA) {
    if (setB.has(t)) common++
  }

  const union = tokensA.length + tokensB.length - common
  const jaccard = union > 0 ? common / union : 0

  // 1. Jaccard similarity kuat (>= 0.35)
  if (jaccard >= 0.35) return true

  // 2. Berbagi minimal 3 kata kunci substantif penting (cakupan >= 45% dari klaim yang lebih pendek)
  const minLen = Math.min(tokensA.length, tokensB.length)
  if (common >= 3 && (common / minLen) >= 0.45) return true

  return false
}

/**
 * Mengevaluasi vonis definitif (HOAKS atau FAKTA) dari entri rujukan
 */
export function resolveReferenceVerdict(ref: DebunkKnowledgeEntry): 'HOAKS' | 'FAKTA' | null {
  const v = (ref.verdict || '').toUpperCase()
  const rawClaim = (ref.claim || '').trim().toUpperCase()

  if (v === 'HOAKS' || v === 'DISINFORMASI' || v === 'PROPAGANDA' || v === 'SALAH') {
    return 'HOAKS'
  }
  if (v === 'FAKTA' || v === 'BENAR' || v === 'KLARIFIKASI_RESMI') {
    return 'FAKTA'
  }

  // Deteksi berbasis tag standar cek fakta TurnBackHoax / Mafindo
  if (rawClaim.startsWith('[SALAH]') || rawClaim.startsWith('[DISINFORMASI]') || rawClaim.startsWith('[HOAKS]') || rawClaim.startsWith('[MANIPULASI]')) {
    return 'HOAKS'
  }
  if (rawClaim.startsWith('[KLARIFIKASI]') || rawClaim.startsWith('[FAKTA]')) {
    return 'FAKTA'
  }

  return null
}

/**
 * Mengambil daftar ID isu yang diarsipkan
 */
export function getArchivedIssueIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_IDS)
    if (raw) {
      return new Set(JSON.parse(raw))
    }
    // Migrasi mundur jika ada data legacy pinned
    const legacyRaw = localStorage.getItem(LEGACY_PINNED_IDS)
    if (legacyRaw) {
      const ids: string[] = JSON.parse(legacyRaw)
      localStorage.setItem(STORAGE_KEY_IDS, JSON.stringify(ids))
      return new Set(ids)
    }
    return new Set()
  } catch {
    return new Set()
  }
}

/**
 * Mengambil map vonis manual arsip
 */
export function getArchivedVerdicts(): Record<string, ArchiveVerdict> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VERDICTS)
    if (raw) {
      return JSON.parse(raw)
    }
    const legacyRaw = localStorage.getItem(LEGACY_PINNED_VERDICTS)
    if (legacyRaw) {
      const v = JSON.parse(legacyRaw)
      localStorage.setItem(STORAGE_KEY_VERDICTS, JSON.stringify(v))
      return v
    }
    return {}
  } catch {
    return {}
  }
}

/**
 * Mengambil seluruh data item yang diarsipkan
 */
export function getArchivedEntries(): ArchivedDebunkEntry[] {
  try {
    const ids = getArchivedIssueIds()
    if (ids.size === 0) return []

    const rawData = localStorage.getItem(STORAGE_KEY_DATA)
    const dataMap: Record<string, ArchivedDebunkEntry> = rawData ? JSON.parse(rawData) : {}
    const verdicts = getArchivedVerdicts()

    const entries: ArchivedDebunkEntry[] = []
    ids.forEach(id => {
      const entry = dataMap[id]
      if (entry) {
        // Tentukan vonis efektif terkini:
        // Prioritaskan manual override jika ada, jika tidak gunakan status arsip tersinkron (default: DIPANTAU)
        const effective: ArchiveVerdict = entry.isManualOverride 
          ? (verdicts[id] || entry.archiveVerdict || 'DIPANTAU')
          : (entry.archiveVerdict || verdicts[id] || 'DIPANTAU')

        entries.push({
          ...entry,
          archiveVerdict: effective
        })
      }
    })

    // Urutkan dari yang terbaru diarsipkan
    return entries.sort((a, b) => b.archivedTimestamp - a.archivedTimestamp)
  } catch {
    return []
  }
}

/**
 * Cek apakah suatu isu sedang diarsipkan
 */
export function isIssueArchived(id: string): boolean {
  return getArchivedIssueIds().has(id)
}

/**
 * Menyimpan / mengarsipkan isu ke repositori pemantauan
 */
export function archiveIssue(item: DebunkKnowledgeEntry): void {
  try {
    const ids = getArchivedIssueIds()
    ids.add(item.id)
    localStorage.setItem(STORAGE_KEY_IDS, JSON.stringify([...ids]))

    // Pastikan status vonis awal adalah SELALU SEDANG DIPANTAU (DIPANTAU)
    const verdicts = getArchivedVerdicts()
    verdicts[item.id] = 'DIPANTAU'
    localStorage.setItem(STORAGE_KEY_VERDICTS, JSON.stringify(verdicts))

    // Simpan objek lengkap entri arsip
    const rawData = localStorage.getItem(STORAGE_KEY_DATA)
    const dataMap: Record<string, ArchivedDebunkEntry> = rawData ? JSON.parse(rawData) : {}

    const archivedEntry: ArchivedDebunkEntry = {
      ...item,
      archivedAt: dataMap[item.id]?.archivedAt || getFormattedWib(),
      archivedTimestamp: dataMap[item.id]?.archivedTimestamp || Date.now(),
      archiveVerdict: 'DIPANTAU',
      isManualOverride: false
    }

    dataMap[item.id] = archivedEntry
    localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(dataMap))

    // Notifikasi reaktif ke seluruh komponen
    window.dispatchEvent(new CustomEvent('narada:archive-updated', { detail: { id: item.id, action: 'ARCHIVE' } }))
  } catch (err) {
    console.error('Gagal mengarsipkan isu:', err)
  }
}

/**
 * Membatalkan arsip (kembalikan ke radar biasa)
 */
export function unarchiveIssue(id: string): void {
  try {
    const ids = getArchivedIssueIds()
    ids.delete(id)
    localStorage.setItem(STORAGE_KEY_IDS, JSON.stringify([...ids]))

    const rawData = localStorage.getItem(STORAGE_KEY_DATA)
    if (rawData) {
      const dataMap: Record<string, ArchivedDebunkEntry> = JSON.parse(rawData)
      delete dataMap[id]
      localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(dataMap))
    }

    const verdicts = getArchivedVerdicts()
    delete verdicts[id]
    localStorage.setItem(STORAGE_KEY_VERDICTS, JSON.stringify(verdicts))

    window.dispatchEvent(new CustomEvent('narada:archive-updated', { detail: { id, action: 'UNARCHIVE' } }))
  } catch (err) {
    console.error('Gagal membatalkan arsip:', err)
  }
}

/**
 * Toggle arsip / batal arsip
 */
export function toggleArchive(item: DebunkKnowledgeEntry): boolean {
  if (isIssueArchived(item.id)) {
    unarchiveIssue(item.id)
    return false
  } else {
    archiveIssue(item)
    return true
  }
}

/**
 * Mengubah vonis klasifikasi arsip oleh analis ('DIPANTAU' | 'FAKTA' | 'HOAKS')
 */
export function setArchivedVerdict(id: string, verdict: ArchiveVerdict): void {
  try {
    const verdicts = getArchivedVerdicts()
    verdicts[id] = verdict
    localStorage.setItem(STORAGE_KEY_VERDICTS, JSON.stringify(verdicts))

    const rawData = localStorage.getItem(STORAGE_KEY_DATA)
    if (rawData) {
      const dataMap: Record<string, ArchivedDebunkEntry> = JSON.parse(rawData)
      if (dataMap[id]) {
        dataMap[id].archiveVerdict = verdict
        // Bila analis menetapkan FAKTA atau HOAKS -> tandai manual override
        // Bila analis mereset ke DIPANTAU -> lepas manual override agar auto-sync radar aktif kembali
        dataMap[id].isManualOverride = verdict !== 'DIPANTAU'
        if (verdict === 'FAKTA') {
          dataMap[id].verdict = 'FAKTA'
        } else if (verdict === 'HOAKS') {
          dataMap[id].verdict = 'HOAKS'
        }
        localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(dataMap))
      }
    }

    window.dispatchEvent(new CustomEvent('narada:archive-updated', { detail: { id, action: 'SET_VERDICT', verdict } }))
  } catch (err) {
    console.error('Gagal mengubah vonis arsip:', err)
  }
}

/**
 * Menyinkronkan item arsip dengan arus radar terbaru:
 * 1. Exact ID Matching (kompatibilitas pipeline historis)
 * 2. Semantic Claim Matching: Jika artikel berita disematkan, kemudian terbit artikel cek fakta
 *    (seperti TurnBackHoax/MAFINDO/ANTARA) dengan ID berbeda, vonis otomatis disinkronkan!
 */
export function syncArchivedItemsWithRadar(freshItems: DebunkKnowledgeEntry[]): void {
  try {
    const ids = getArchivedIssueIds()
    if (ids.size === 0 || !Array.isArray(freshItems) || freshItems.length === 0) return

    const rawData = localStorage.getItem(STORAGE_KEY_DATA)
    const dataMap: Record<string, ArchivedDebunkEntry> = rawData ? JSON.parse(rawData) : {}
    const verdicts = getArchivedVerdicts()
    let hasChanges = false

    // 1. Exact ID Matching
    freshItems.forEach(fresh => {
      if (ids.has(fresh.id) && dataMap[fresh.id]) {
        const existing = dataMap[fresh.id]
        const isFreshFact = fresh.verdict === 'FAKTA'
        const isFreshHoax = fresh.verdict === 'HOAKS' || fresh.verdict === 'DISINFORMASI' || fresh.verdict === 'PROPAGANDA'

        if (fresh.clarification && fresh.clarification !== existing.clarification) {
          existing.clarification = fresh.clarification
          hasChanges = true
        }
        if (fresh.officialSource && fresh.officialSource !== existing.officialSource) {
          existing.officialSource = fresh.officialSource
          hasChanges = true
        }
        if (fresh.sourceUrl && fresh.sourceUrl !== existing.sourceUrl) {
          existing.sourceUrl = fresh.sourceUrl
          hasChanges = true
        }
        if (fresh.tacticalResponseMilitary && fresh.tacticalResponseMilitary !== existing.tacticalResponseMilitary) {
          existing.tacticalResponseMilitary = fresh.tacticalResponseMilitary
          hasChanges = true
        }
        if (fresh.publishedDate && fresh.publishedDate !== existing.publishedDate) {
          existing.publishedDate = fresh.publishedDate
          hasChanges = true
        }

        if (!existing.isManualOverride) {
          if (isFreshFact && existing.archiveVerdict !== 'FAKTA') {
            existing.archiveVerdict = 'FAKTA'
            existing.verdict = 'FAKTA'
            verdicts[fresh.id] = 'FAKTA'
            hasChanges = true
          } else if (isFreshHoax && existing.archiveVerdict !== 'HOAKS') {
            existing.archiveVerdict = 'HOAKS'
            existing.verdict = fresh.verdict
            verdicts[fresh.id] = 'HOAKS'
            hasChanges = true
          }
        }
      }
    })

    // 2. Semantic Claim Matching bagi item yang belum terverifikasi
    Object.values(dataMap).forEach(existing => {
      if (!existing || existing.isManualOverride || existing.archiveVerdict !== 'DIPANTAU') return

      const matchedFresh = freshItems.find(fresh => 
        fresh.id !== existing.id && areClaimsSemanticallyMatching(existing.claim, fresh.claim)
      )

      if (matchedFresh) {
        const resolved = resolveReferenceVerdict(matchedFresh)
        if (resolved === 'HOAKS') {
          existing.archiveVerdict = 'HOAKS'
          existing.verdict = matchedFresh.verdict || 'HOAKS'
          verdicts[existing.id] = 'HOAKS'
          if (matchedFresh.clarification) existing.clarification = matchedFresh.clarification
          if (matchedFresh.officialSource) existing.officialSource = matchedFresh.officialSource
          if (matchedFresh.sourceUrl) existing.sourceUrl = matchedFresh.sourceUrl
          if (matchedFresh.tacticalResponseMilitary) existing.tacticalResponseMilitary = matchedFresh.tacticalResponseMilitary
          hasChanges = true
        } else if (resolved === 'FAKTA') {
          existing.archiveVerdict = 'FAKTA'
          existing.verdict = 'FAKTA'
          verdicts[existing.id] = 'FAKTA'
          if (matchedFresh.clarification) existing.clarification = matchedFresh.clarification
          if (matchedFresh.officialSource) existing.officialSource = matchedFresh.officialSource
          if (matchedFresh.sourceUrl) existing.sourceUrl = matchedFresh.sourceUrl
          hasChanges = true
        }
      }
    })

    if (hasChanges) {
      localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(dataMap))
      localStorage.setItem(STORAGE_KEY_VERDICTS, JSON.stringify(verdicts))
      window.dispatchEvent(new CustomEvent('narada:archive-updated', { detail: { action: 'SYNC' } }))
    }
  } catch (err) {
    console.error('Gagal sinkronisasi arsip dengan radar:', err)
  }
}

/**
 * Rekonsiliasi Otomatis Berita Tersemat Multi-Hari:
 * Menyelaraskan seluruh berita yang disematkan dengan basis data lengkap (arsip terkurasi,
 * TurnBackHoax, Antara, dan cache radar lokal).
 * Menjamin bahwa berita yang disematkan dari hari-hari sebelumnya (misal tanggal 10 Nov)
 * yang kini telah memiliki vonis resmi (per 13 Nov) otomatis bertransisi statusnya menjadi FAKTA atau HOAKS!
 */
export async function reconcileArchivedItems(
  referenceDebunks?: DebunkKnowledgeEntry[]
): Promise<{ updatedCount: number; items: ArchivedDebunkEntry[] }> {
  try {
    const ids = getArchivedIssueIds()
    if (ids.size === 0) {
      return { updatedCount: 0, items: [] }
    }

    const rawData = localStorage.getItem(STORAGE_KEY_DATA)
    const dataMap: Record<string, ArchivedDebunkEntry> = rawData ? JSON.parse(rawData) : {}
    const verdicts = getArchivedVerdicts()

    let references: DebunkKnowledgeEntry[] = Array.isArray(referenceDebunks) ? [...referenceDebunks] : []

    // 1. Muat korpus arsip kurasi lokal dari debunk-service (200+ entri Mafindo/TurnBackHoax) jika belum disediakan
    if (references.length === 0) {
      try {
        const debunkService = await import('../data/debunk-service.ts')
        if (debunkService?.getCuratedArchiveDebunks) {
          references = [...references, ...debunkService.getCuratedArchiveDebunks()]
        }
      } catch {
        // Fallback jika di lingkungan isolasi runner
      }
    }

    // 2. Muat cache radar dari IndexedDB untuk melengkapi data terkini
    try {
      const dbAdapter = await import('../../utils/db-adapter.ts')
      if (dbAdapter?.getCachedRadarItems) {
        const cached = await dbAdapter.getCachedRadarItems()
        if (Array.isArray(cached) && cached.length > 0) {
          references = [...references, ...cached]
        }
      }
    } catch {
      // Fallback
    }

    let updatedCount = 0
    let hasChanges = false

    Object.values(dataMap).forEach(existing => {
      if (!existing || existing.isManualOverride) return

      // Hanya proses item yang masih berstatus DIPANTAU
      if (existing.archiveVerdict === 'DIPANTAU') {
        // Cari referensi yang cocok baik dari ID maupun kesamaan semantik klaim
        const matchedRef = references.find(ref => 
          ref.id === existing.id || areClaimsSemanticallyMatching(existing.claim, ref.claim)
        )

        if (matchedRef) {
          const resolved = resolveReferenceVerdict(matchedRef)
          if (resolved === 'HOAKS') {
            existing.archiveVerdict = 'HOAKS'
            existing.verdict = 'HOAKS'
            verdicts[existing.id] = 'HOAKS'
            if (matchedRef.clarification && matchedRef.clarification.length > (existing.clarification?.length || 0)) {
              existing.clarification = matchedRef.clarification
            }
            if (matchedRef.officialSource) {
              existing.officialSource = matchedRef.officialSource
            }
            if (matchedRef.sourceUrl) {
              existing.sourceUrl = matchedRef.sourceUrl
            }
            if (matchedRef.tacticalResponseMilitary) {
              existing.tacticalResponseMilitary = matchedRef.tacticalResponseMilitary
            }
            if (matchedRef.threatLevel) {
              existing.threatLevel = matchedRef.threatLevel
            }
            hasChanges = true
            updatedCount++
          } else if (resolved === 'FAKTA') {
            existing.archiveVerdict = 'FAKTA'
            existing.verdict = 'FAKTA'
            verdicts[existing.id] = 'FAKTA'
            if (matchedRef.clarification && matchedRef.clarification.length > (existing.clarification?.length || 0)) {
              existing.clarification = matchedRef.clarification
            }
            if (matchedRef.officialSource) {
              existing.officialSource = matchedRef.officialSource
            }
            if (matchedRef.sourceUrl) {
              existing.sourceUrl = matchedRef.sourceUrl
            }
            hasChanges = true
            updatedCount++
          }
        } else {
          // Jika tidak ada di references eksternal, evaluasi indikator internal pada entri itu sendiri
          const selfResolved = resolveReferenceVerdict(existing)
          if (selfResolved === 'HOAKS') {
            existing.archiveVerdict = 'HOAKS'
            existing.verdict = 'HOAKS'
            verdicts[existing.id] = 'HOAKS'
            hasChanges = true
            updatedCount++
          } else if (selfResolved === 'FAKTA') {
            existing.archiveVerdict = 'FAKTA'
            existing.verdict = 'FAKTA'
            verdicts[existing.id] = 'FAKTA'
            hasChanges = true
            updatedCount++
          }
        }
      }
    })

    if (hasChanges) {
      localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(dataMap))
      localStorage.setItem(STORAGE_KEY_VERDICTS, JSON.stringify(verdicts))
      window.dispatchEvent(new CustomEvent('narada:archive-updated', { detail: { action: 'AUTO_RECONCILE', updatedCount } }))
    }

    return { updatedCount, items: getArchivedEntries() }
  } catch (err) {
    console.error('Gagal rekonsiliasi arsip:', err)
    return { updatedCount: 0, items: getArchivedEntries() }
  }
}

// ─── Alias Watchlist / Daftar Pantau Khusus ───
export const addToWatchlist = archiveIssue
export const removeFromWatchlist = unarchiveIssue
export const toggleWatchlist = toggleArchive
export const isIssueInWatchlist = isIssueArchived
export const getWatchlistEntries = getArchivedEntries
export const getWatchlistIssueIds = getArchivedIssueIds
export const setWatchlistVerdict = setArchivedVerdict
export const syncWatchlistWithRadar = syncArchivedItemsWithRadar
