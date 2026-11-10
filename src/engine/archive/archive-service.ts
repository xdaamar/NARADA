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
        // Tentukan vonis efektif terkini
        let effective: ArchiveVerdict = verdicts[id] || entry.archiveVerdict || 'DIPANTAU'
        
        // Jika data radar asal sudah terkonfirmasi resmi dan analis belum override manual:
        if (!verdicts[id]) {
          if (entry.verdict === 'FAKTA') {
            effective = 'FAKTA'
          } else if (entry.verdict === 'HOAKS' || entry.verdict === 'DISINFORMASI' || entry.verdict === 'PROPAGANDA') {
            effective = 'HOAKS'
          } else {
            effective = 'DIPANTAU'
          }
        }

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

    // Pastikan status vonis awal adalah SEDANG DIPANTAU
    const verdicts = getArchivedVerdicts()
    if (!verdicts[item.id]) {
      // Default: SEDANG DIPANTAU
      verdicts[item.id] = 'DIPANTAU'
      localStorage.setItem(STORAGE_KEY_VERDICTS, JSON.stringify(verdicts))
    }

    // Simpan objek lengkap entri arsip
    const rawData = localStorage.getItem(STORAGE_KEY_DATA)
    const dataMap: Record<string, ArchivedDebunkEntry> = rawData ? JSON.parse(rawData) : {}

    const archivedEntry: ArchivedDebunkEntry = {
      ...item,
      archivedAt: dataMap[item.id]?.archivedAt || getFormattedWib(),
      archivedTimestamp: dataMap[item.id]?.archivedTimestamp || Date.now(),
      archiveVerdict: verdicts[item.id] || 'DIPANTAU'
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
        existing.clarification = fresh.clarification || existing.clarification
        existing.officialSource = fresh.officialSource || existing.officialSource
        existing.sourceUrl = fresh.sourceUrl || existing.sourceUrl
        existing.tacticalResponseMilitary = fresh.tacticalResponseMilitary || existing.tacticalResponseMilitary
        existing.publishedDate = fresh.publishedDate || existing.publishedDate

        // Jika analis belum menetapkan vonis manual (masih DIPANTAU), ikuti pembaruan radar resmi
        if (!verdicts[fresh.id] || verdicts[fresh.id] === 'DIPANTAU') {
          if (isFreshFact && existing.archiveVerdict !== 'FAKTA') {
            existing.archiveVerdict = 'FAKTA'
            existing.verdict = 'FAKTA'
            hasChanges = true
          } else if (isFreshHoax && existing.archiveVerdict !== 'HOAKS') {
            existing.archiveVerdict = 'HOAKS'
            existing.verdict = fresh.verdict
            hasChanges = true
          }
        }
      }
    })

    if (hasChanges) {
      localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(dataMap))
      window.dispatchEvent(new CustomEvent('narada:archive-updated', { detail: { action: 'SYNC' } }))
    }
  } catch (err) {
    console.error('Gagal sinkronisasi arsip dengan radar:', err)
  }
}
