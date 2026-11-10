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
 * Jika data radar resmi mengonfirmasi fakta atau hoaks pada isu yang diarsipkan,
 * perbarui metadata dan vonis arsip secara otomatis!
 */
export function syncArchivedItemsWithRadar(freshItems: DebunkKnowledgeEntry[]): void {
  try {
    const ids = getArchivedIssueIds()
    if (ids.size === 0 || !Array.isArray(freshItems) || freshItems.length === 0) return

    const rawData = localStorage.getItem(STORAGE_KEY_DATA)
    const dataMap: Record<string, ArchivedDebunkEntry> = rawData ? JSON.parse(rawData) : {}
    const verdicts = getArchivedVerdicts()
    let hasChanges = false

    freshItems.forEach(fresh => {
      if (ids.has(fresh.id) && dataMap[fresh.id]) {
        const existing = dataMap[fresh.id]
        // Cek apakah data radar membawa pembaruan vonis resmi
        const isFreshFact = fresh.verdict === 'FAKTA'
        const isFreshHoax = fresh.verdict === 'HOAKS' || fresh.verdict === 'DISINFORMASI' || fresh.verdict === 'PROPAGANDA'

        // Perbarui naskah klarifikasi & referensi jika ada pembaruan
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

        // Jika analis belum menetapkan vonis manual (tidak dalam state manual override),
        // ikuti pembaruan radar resmi secara otomatis!
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

    if (hasChanges) {
      localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(dataMap))
      localStorage.setItem(STORAGE_KEY_VERDICTS, JSON.stringify(verdicts))
      window.dispatchEvent(new CustomEvent('narada:archive-updated', { detail: { action: 'SYNC' } }))
    }
  } catch (err) {
    console.error('Gagal sinkronisasi arsip dengan radar:', err)
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


