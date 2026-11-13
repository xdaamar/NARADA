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

export type OriginalSourceStatus = 'ACTIVE' | 'DELETED' | 'TAKEN_DOWN'

export interface ArchivedDebunkEntry extends DebunkKnowledgeEntry {
  archivedAt: string            // Timestamp saat diarsipkan (format WIB/lokal)
  archivedTimestamp: number     // Unix timestamp epoch (ms)
  archiveVerdict: ArchiveVerdict // Status efektif pemantauan (default: DIPANTAU)
  isManualOverride?: boolean     // Apakah analis secara manual menetapkan vonis
  notes?: string
  evidenceSufficiency?: number  // 0 - 100: Persentase kelengkapan bukti pendukung
  lastProbedAt?: string         // Waktu audit penelusuran bukti terakhir (WIB)
  evidenceSummary?: string      // Ringkasan status data pendukung pembuktian
  originalSourceStatus?: OriginalSourceStatus // Status keaktifan sumber asal berita (ACTIVE | DELETED | TAKEN_DOWN)
  sourceDeletedReason?: string  // Keterangan mengapa sumber asal dihapus / diturunkan oleh platform
  forensicCaptureHash?: string  // Hash identitas kriptografis penangkapan metadata forensik
}

export interface EvidenceProbeResult {
  id: string
  status: 'RESOLVED' | 'STILL_MONITORING' | 'MANUAL_OVERRIDE' | 'NOT_FOUND'
  verdict: ArchiveVerdict
  evidenceSufficiency: number // 0 - 100
  evidenceSummary: string
  matchedSource?: string
  matchedUrl?: string
  clarification?: string
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
    .replace(/\bwapres\b/g, 'wakil presiden')
    .replace(/\bmengundurkan\b/g, 'pengunduran')
    .replace(/\bdiberhentikan\b/g, 'dicopot')
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
 * Memastikan apakah suatu entri merupakan rujukan Cek Fakta / Verifikasi Resmi yang valid.
 * Mencegah artikel berita umum atau opini acak (seperti RSS Google News) disalahartikan sebagai vonis klarifikasi!
 */
export function isAuthoritativeDebunkSource(entry: DebunkKnowledgeEntry): boolean {
  if (!entry) return false
  const src = (entry.officialSource || '').toLowerCase()
  const url = (entry.sourceUrl || entry.originalSourceUrl || '').toLowerCase()
  const claim = (entry.claim || '').toLowerCase()
  const st = ((entry as any).sourceType || '').toLowerCase()

  // 1. Tipe sumber data eksplisit fact_check
  if (st === 'fact_check') return true

  // 2. ID standar basis pengetahuan terkurasi Cek Fakta resmi
  if (entry.id && (
    entry.id.startsWith('TBH-') || 
    entry.id.startsWith('HOAX-') || 
    entry.id.startsWith('FAKTA-') || 
    entry.id.startsWith('FACT-') ||
    entry.id.startsWith('NAR-CYB-')
  )) {
    return true
  }

  // 3. Domain rujukan otoritatif cek fakta nasional & verifikasi negara
  if (
    url.includes('turnbackhoax.id') ||
    url.includes('cekfakta.com') ||
    url.includes('kominfo.go.id') ||
    url.includes('antaranews.com/cek-fakta') ||
    url.includes('cekfakta.tempo.co') ||
    url.includes('setneg.go.id') ||
    url.includes('setwapres.go.id') ||
    url.includes('tniad.mil.id') ||
    url.includes('pussiberad.tni.mil.id')
  ) {
    return true
  }

  // 4. Lembaga verifikasi resmi yang tertera di officialSource
  if (
    src.includes('turnbackhoax') ||
    src.includes('mafindo') ||
    src.includes('cek fakta') ||
    src.includes('cekfakta') ||
    src.includes('kominfo') ||
    src.includes('setwapres') ||
    src.includes('sekretariat presiden') ||
    src.includes('setneg') ||
    src.includes('dispenad') ||
    src.includes('pussiberad') ||
    src.includes('antara cek fakta') ||
    src.includes('tempo cek fakta')
  ) {
    return true
  }

  // 5. Klaim memiliki penanda tag standar cek fakta profesional
  if (
    claim.startsWith('[salah]') ||
    claim.startsWith('[hoaks]') ||
    claim.startsWith('[disinformasi]') ||
    claim.startsWith('[manipulasi]') ||
    claim.startsWith('[klarifikasi]') ||
    claim.startsWith('[fakta]')
  ) {
    return true
  }

  return false
}

/**
 * Menguji apakah dua klaim secara semantik merujuk pada isu yang sama persis
 * Menggunakan pencocokan entitas kunci, pasangan predikat/aksi, dan batasan kemiripan ketat
 * untuk mencegah cross-matching yang keliru antara berita opini/pernyataan dengan rumor viral.
 */
export function areClaimsSemanticallyMatching(claimA: string, claimB: string): boolean {
  const normA = normalizeClaimForMatching(claimA)
  const normB = normalizeClaimForMatching(claimB)
  if (!normA || !normB) return false
  if (normA === normB) return true
  
  // Jika salah satu teks memuat teks lain secara utuh (panjang proposisi signifikan >= 25 char)
  if (normA.length >= 25 && normB.length >= 25) {
    if (normA.includes(normB) || normB.includes(normA)) return true
  }

  const tokensA = extractSubstantiveTokens(normA)
  const tokensB = extractSubstantiveTokens(normB)
  if (tokensA.length === 0 || tokensB.length === 0) return false

  const setA = new Set(tokensA)
  const setB = new Set(tokensB)
  let common = 0
  for (const t of tokensA) {
    if (setB.has(t)) common++
  }

  const union = tokensA.length + tokensB.length - common
  const jaccard = union > 0 ? common / union : 0

  // 1. Verifikasi Entitas Subjek Kunci:
  // Jika klaim A menyebutkan figur/entitas spesifik (misal Gibran, Prabowo, Jokowi, TNI),
  // klaim B HARUS memuat entitas yang sama persis!
  const CRITICAL_ENTITIES = ['gibran', 'prabowo', 'jokowi', 'tni', 'polri', 'kpk', 'bawaslu', 'bmkg', 'megathrust', 'bansos']
  for (const entity of CRITICAL_ENTITIES) {
    const hasInA = setA.has(entity) || normA.includes(entity)
    const hasInB = setB.has(entity) || normB.includes(entity)
    if (hasInA !== hasInB) {
      return false
    }
  }

  // 2. Verifikasi Aksi Predikat Kunci (Action Matching):
  // Menjamin topik pengunduran diri / mundur / dicopot tidak tertukar dengan isu lain
  const ACTION_GROUPS = [
    ['pengunduran', 'mundur', 'tinggalkan'],
    ['dicopot', 'dipecat', 'lengser', 'pemakzulan'],
    ['koma', 'meninggal', 'wafat', 'kritis'],
    ['bocor', 'kebocoran', 'peretasan', 'ransomware']
  ]
  for (const group of ACTION_GROUPS) {
    const hasInA = group.some(act => setA.has(act) || normA.includes(act))
    const hasInB = group.some(act => setB.has(act) || normB.includes(act))
    if (hasInA && !hasInB) return false
    if (!hasInA && hasInB) return false
  }

  // 3. Filter Komentator / Pernyataan Pejabat Ketatanegaraan:
  // Mencegah pernyataan teoritis hukum (misal Yusril, pakar hukum) mencaplok klaim video pengunduran diri
  const COMMENTARY_INDICATORS = ['yusril', 'pakar', 'pengamat', 'persetujuan mpr', 'tata negara', 'akademisi']
  const isACommentary = COMMENTARY_INDICATORS.some(ind => normA.includes(ind))
  const isBCommentary = COMMENTARY_INDICATORS.some(ind => normB.includes(ind))
  if (isACommentary !== isBCommentary) {
    return false
  }

  // 4. Jaccard similarity ketat (>= 0.45)
  if (jaccard >= 0.45) return true

  // 5. Berbagi minimal 4 kata kunci substantif penting (cakupan >= 60% dari klaim yang lebih pendek)
  const minLen = Math.min(tokensA.length, tokensB.length)
  if (common >= 4 && (common / minLen) >= 0.60) return true

  return false
}

/**
 * Mengevaluasi vonis definitif (HOAKS atau FAKTA) dari entri rujukan
 * Hanya berlaku jika entri merupakan rujukan Cek Fakta Otoritatif!
 */
export function resolveReferenceVerdict(ref: DebunkKnowledgeEntry): 'HOAKS' | 'FAKTA' | null {
  if (!ref || !isAuthoritativeDebunkSource(ref)) {
    return null
  }

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

    // Deteksi cerdas status keaktifan sumber asal
    let initialSourceStatus: OriginalSourceStatus = (item as any).originalSourceStatus || dataMap[item.id]?.originalSourceStatus || 'ACTIVE'
    const origUrl = ((item as any).originalSourceUrl || '').toLowerCase()
    if (origUrl.includes('deleted') || origUrl.includes('takedown') || origUrl.includes('404')) {
      initialSourceStatus = 'DELETED'
    }

    const archivedEntry: ArchivedDebunkEntry = {
      ...item,
      archivedAt: dataMap[item.id]?.archivedAt || getFormattedWib(),
      archivedTimestamp: dataMap[item.id]?.archivedTimestamp || Date.now(),
      archiveVerdict: 'DIPANTAU',
      isManualOverride: false,
      originalSourceStatus: initialSourceStatus,
      sourceDeletedReason: (item as any).sourceDeletedReason || dataMap[item.id]?.sourceDeletedReason,
      forensicCaptureHash: (item as any).forensicCaptureHash || dataMap[item.id]?.forensicCaptureHash || `NAR-EVD-${item.id.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}`
    }

    dataMap[item.id] = archivedEntry
    localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(dataMap))

    // Notifikasi reaktif ke seluruh komponen
    window.dispatchEvent(new CustomEvent('narada:archive-updated', { detail: { id: item.id, action: 'ARCHIVE', item } }))
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
 * Resolusi cerdas nama platform atau publisher asal berita diambil
 */
export function getDisplayOriginPlatform(item: Partial<DebunkKnowledgeEntry>): string {
  if (item.originalPlatform && item.originalPlatform.trim().length > 0) {
    return item.originalPlatform.trim()
  }
  if (item.originalSourceUrl) {
    try {
      const url = new URL(item.originalSourceUrl)
      const host = url.hostname.replace(/^www\./, '')
      if (host.includes('twitter.com') || host.includes('x.com')) return 'X (Twitter) - Akun Publik'
      if (host.includes('tiktok.com')) return 'TikTok - Unggahan Video Publik'
      if (host.includes('facebook.com')) return 'Facebook - Ruang Diskusi Publik'
      if (host.includes('instagram.com')) return 'Instagram - Postingan Netizen'
      if (host.includes('t.me') || host.includes('telegram')) return 'Telegram - Kanal Siaran'
      if (host.includes('antaranews.com')) return 'LKBN ANTARA News'
      if (host.includes('detik.com')) return 'Detikcom Warta Nasional'
      if (host.includes('kompas.com')) return 'Kompas.com Berita'
      if (host.includes('tempo.co')) return 'Tempo Media'
      if (host.includes('cnnindonesia.com')) return 'CNN Indonesia'
      return host
    } catch {
      // ignore
    }
  }
  if (item.cluster === 'SIBER_PERETASAN') {
    return 'Dark Web / Forum Siber / Ruang Intelijen Siber'
  }
  if (item.cluster === 'POLITIK_NEGARA' || item.cluster === 'AKSI_MASSA') {
    return 'Media Sosial & Arus Warta Netizen'
  }
  return 'Portal Media Siber / Kanal Informasi Publik'
}

/**
 * Mengevaluasi apakah tautan/sumber asal telah dihapus, di-takedown, atau tidak aktif
 */
export function isOriginalSourceDeleted(item: ArchivedDebunkEntry | DebunkKnowledgeEntry): boolean {
  const status = (item as any).originalSourceStatus
  if (status === 'DELETED' || status === 'TAKEN_DOWN') {
    return true
  }
  const url = ((item as any).originalSourceUrl || '').toLowerCase()
  if (url.includes('takedown') || url.includes('deleted') || url.includes('404')) {
    return true
  }
  return false
}

/**
 * Memperbarui status keaktifan sumber asal berita (ACTIVE | DELETED | TAKEN_DOWN)
 */
export function setOriginalSourceStatus(id: string, status: OriginalSourceStatus, reason?: string): void {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY_DATA)
    if (rawData) {
      const dataMap: Record<string, ArchivedDebunkEntry> = JSON.parse(rawData)
      if (dataMap[id]) {
        dataMap[id].originalSourceStatus = status
        if (reason !== undefined) {
          dataMap[id].sourceDeletedReason = reason
        }
        localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(dataMap))
        window.dispatchEvent(new CustomEvent('narada:archive-updated', { detail: { id, action: 'SOURCE_STATUS_UPDATED', status } }))
      }
    }
  } catch (err) {
    console.error('Gagal memperbarui status keaktifan sumber:', err)
  }
}

/**
 * Toggle status keaktifan sumber asal berita antara ACTIVE dan DELETED
 */
export function toggleOriginalSourceStatus(id: string): OriginalSourceStatus {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY_DATA)
    const dataMap: Record<string, ArchivedDebunkEntry> = rawData ? JSON.parse(rawData) : {}
    const current = dataMap[id]?.originalSourceStatus
    const nextStatus: OriginalSourceStatus = (current === 'DELETED' || current === 'TAKEN_DOWN') ? 'ACTIVE' : 'DELETED'
    setOriginalSourceStatus(
      id,
      nextStatus,
      nextStatus === 'DELETED' ? 'Tautan/unggahan asal telah dihapus atau di-takedown oleh platform/pemilik akun' : undefined
    )
    return nextStatus
  } catch {
    return 'ACTIVE'
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
        if ((fresh as any).originalPlatform && (fresh as any).originalPlatform !== existing.originalPlatform) {
          existing.originalPlatform = (fresh as any).originalPlatform
          hasChanges = true
        }
        if ((fresh as any).originalSourceUrl && (fresh as any).originalSourceUrl !== existing.originalSourceUrl) {
          existing.originalSourceUrl = (fresh as any).originalSourceUrl
          hasChanges = true
        }
        if ((fresh as any).originalSourceStatus && (fresh as any).originalSourceStatus !== existing.originalSourceStatus) {
          existing.originalSourceStatus = (fresh as any).originalSourceStatus
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
    // HANYA cocokkan dengan rujukan Cek Fakta Otoritatif resmi!
    Object.values(dataMap).forEach(existing => {
      if (!existing || existing.isManualOverride || existing.archiveVerdict !== 'DIPANTAU') return

      const matchedFresh = freshItems.find(fresh => 
        fresh.id !== existing.id && 
        isAuthoritativeDebunkSource(fresh) &&
        areClaimsSemanticallyMatching(existing.claim, fresh.claim)
      )

      if (matchedFresh) {
        const resolved = resolveReferenceVerdict(matchedFresh)
        if (resolved === 'HOAKS') {
          existing.archiveVerdict = 'HOAKS'
          existing.verdict = matchedFresh.verdict || 'HOAKS'
          verdicts[existing.id] = 'HOAKS'
          if (matchedFresh.clarification) existing.clarification = matchedFresh.clarification
          if (matchedFresh.officialSource) existing.officialSource = matchedFresh.officialSource
          if (matchedFresh.sourceUrl && isAuthoritativeDebunkSource(matchedFresh)) {
            existing.sourceUrl = matchedFresh.sourceUrl
          }
          if (matchedFresh.tacticalResponseMilitary) existing.tacticalResponseMilitary = matchedFresh.tacticalResponseMilitary
          hasChanges = true
        } else if (resolved === 'FAKTA') {
          existing.archiveVerdict = 'FAKTA'
          existing.verdict = 'FAKTA'
          verdicts[existing.id] = 'FAKTA'
          if (matchedFresh.clarification) existing.clarification = matchedFresh.clarification
          if (matchedFresh.officialSource) existing.officialSource = matchedFresh.officialSource
          if (matchedFresh.sourceUrl && isAuthoritativeDebunkSource(matchedFresh)) {
            existing.sourceUrl = matchedFresh.sourceUrl
          }
          if (matchedFresh.originalPlatform && !existing.originalPlatform) {
            existing.originalPlatform = matchedFresh.originalPlatform
          }
          if (matchedFresh.originalSourceUrl && !existing.originalSourceUrl) {
            existing.originalSourceUrl = matchedFresh.originalSourceUrl
          }
          if ((matchedFresh as any).originalSourceStatus && !existing.originalSourceStatus) {
            existing.originalSourceStatus = (matchedFresh as any).originalSourceStatus
          }
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
 * 
 * JAMINAN INTEGRITAS:
 * 1. Tidak mencaplok URL berita umum / rilis non-cekfakta sebagai rujukan vonis.
 * 2. Self-healing terhadap data terkontaminasi (misal link berita umum kumham-imipas).
 * 3. Jika belum ada rujukan cek fakta resmi, status WAJIB tetap SEDANG DIPANTAU.
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

    // 2. Muat cache radar dari IndexedDB HANYA untuk entri yang merupakan Cek Fakta Otoritatif
    try {
      const dbAdapter = await import('../../utils/db-adapter.ts')
      if (dbAdapter?.getCachedRadarItems) {
        const cached = await dbAdapter.getCachedRadarItems()
        if (Array.isArray(cached) && cached.length > 0) {
          // FILTER KETAT: Hanya entri cek fakta resmi yang boleh masuk daftar referensi rekonsiliasi
          const factCheckOnly = cached.filter(item => isAuthoritativeDebunkSource(item))
          references = [...references, ...factCheckOnly]
        }
      }
    } catch {
      // Fallback
    }

    let updatedCount = 0
    let hasChanges = false

    // 3. Self-healing Pass: Pulihkan data tersimpan yang terkontaminasi link umum / keliru
    Object.values(dataMap).forEach(existing => {
      if (!existing) return

      const isContaminatedUrl = existing.sourceUrl && (
        existing.sourceUrl.includes('kumham-imipas.go.id') ||
        (existing.archiveVerdict === 'HOAKS' && !isAuthoritativeDebunkSource(existing))
      )

      if (isContaminatedUrl || (existing.archiveVerdict === 'HOAKS' && (!existing.clarification || existing.clarification.length < 50))) {
        // Cari referensi otoritatif resmi yang cocok
        const trueDebunk = references.find(ref => 
          isAuthoritativeDebunkSource(ref) && areClaimsSemanticallyMatching(existing.claim, ref.claim)
        )
        if (trueDebunk) {
          existing.archiveVerdict = resolveReferenceVerdict(trueDebunk) || 'HOAKS'
          existing.verdict = existing.archiveVerdict
          existing.officialSource = trueDebunk.officialSource || 'TurnBackHoax.ID (Mafindo) & Sekretariat Wakil Presiden'
          existing.sourceUrl = trueDebunk.sourceUrl || 'https://turnbackhoax.id/?s=gibran+pengunduran+diri'
          existing.clarification = trueDebunk.clarification
          if (trueDebunk.tacticalResponseMilitary) {
            existing.tacticalResponseMilitary = trueDebunk.tacticalResponseMilitary
          }
          verdicts[existing.id] = existing.archiveVerdict
          hasChanges = true
          updatedCount++
        }
      }
    })

    // 4. Proses item yang masih berstatus DIPANTAU
    Object.values(dataMap).forEach(existing => {
      if (!existing || existing.isManualOverride) return

      // Hanya proses item yang masih berstatus DIPANTAU
      if (existing.archiveVerdict === 'DIPANTAU') {
        // Cari referensi yang cocok dari ID maupun kesamaan semantik klaim (HANYA sumber otoritatif)
        const matchedRef = references.find(ref => 
          isAuthoritativeDebunkSource(ref) && (
            ref.id === existing.id || areClaimsSemanticallyMatching(existing.claim, ref.claim)
          )
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
            if (matchedRef.sourceUrl && isAuthoritativeDebunkSource(matchedRef)) {
              existing.sourceUrl = matchedRef.sourceUrl
            }
            if (matchedRef.originalPlatform && !existing.originalPlatform) {
              existing.originalPlatform = matchedRef.originalPlatform
            }
            if (matchedRef.originalSourceUrl && !existing.originalSourceUrl) {
              existing.originalSourceUrl = matchedRef.originalSourceUrl
            }
            if ((matchedRef as any).originalSourceStatus && !existing.originalSourceStatus) {
              existing.originalSourceStatus = (matchedRef as any).originalSourceStatus
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
            if (matchedRef.sourceUrl && isAuthoritativeDebunkSource(matchedRef)) {
              existing.sourceUrl = matchedRef.sourceUrl
            }
            hasChanges = true
            updatedCount++
          }
        } else {
          // Jika tidak ada di references eksternal, evaluasi jika entri itu sendiri memiliki tag Cek Fakta resmi
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

/**
 * Investigasi & Penelusuran Bukti Aktif Berita Tersemat (Active Evidence Prober)
 * Secara otomatis menelusuri korpus cek fakta lokal dan upstream feed untuk mencari
 * bukti bantahan atau konfirmasi resmi terhadap berita yang sedang dipantau.
 * Mengklasifikasikan otomatis ke FAKTA atau HOAKS HANYA jika data pendukung sudah cukup (Evidence Sufficiency >= 65%).
 */
export async function probeEvidenceForArchivedItem(
  id: string,
  customFetch?: typeof fetch,
  customReferences?: DebunkKnowledgeEntry[]
): Promise<EvidenceProbeResult> {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY_DATA)
    const dataMap: Record<string, ArchivedDebunkEntry> = rawData ? JSON.parse(rawData) : {}
    const verdicts = getArchivedVerdicts()

    const item = dataMap[id]
    if (!item) {
      return {
        id,
        status: 'NOT_FOUND',
        verdict: 'DIPANTAU',
        evidenceSufficiency: 0,
        evidenceSummary: 'Berita tersemat tidak ditemukan di repositori'
      }
    }

    if (item.isManualOverride) {
      return {
        id,
        status: 'MANUAL_OVERRIDE',
        verdict: item.archiveVerdict,
        evidenceSufficiency: 100,
        evidenceSummary: `Status ditetapkan secara manual oleh analis (${item.archiveVerdict})`
      }
    }

    // Jika sudah FAKTA atau HOAKS dan memiliki rujukan resmi
    if ((item.archiveVerdict === 'FAKTA' || item.archiveVerdict === 'HOAKS') && isAuthoritativeDebunkSource(item)) {
      return {
        id,
        status: 'RESOLVED',
        verdict: item.archiveVerdict,
        evidenceSufficiency: 100,
        evidenceSummary: `Bukti Terverifikasi 100%: Dikonfirmasi resmi oleh ${item.officialSource || 'Otoritas Terkait'}`,
        matchedSource: item.officialSource,
        matchedUrl: item.sourceUrl,
        clarification: item.clarification
      }
    }

    // TAHAP 1: Audit Pencocokan Semantik dengan Basis Pengetahuan Kurasi Lokal (244+ entri)
    let references: DebunkKnowledgeEntry[] = Array.isArray(customReferences) ? [...customReferences] : []
    if (references.length === 0) {
      try {
        const debunkService = await import('../data/debunk-service.ts')
        if (debunkService?.getCuratedArchiveDebunks) {
          references = debunkService.getCuratedArchiveDebunks()
        }
      } catch {
        // Fallback
      }
    }

    // Muat juga entri IndexedDB terverifikasi
    try {
      const dbAdapter = await import('../../utils/db-adapter.ts')
      if (dbAdapter?.getCachedRadarItems) {
        const cached = await dbAdapter.getCachedRadarItems()
        if (Array.isArray(cached) && cached.length > 0) {
          const authCached = cached.filter(c => isAuthoritativeDebunkSource(c))
          references = [...references, ...authCached]
        }
      }
    } catch {
      // Fallback
    }

    const matchedLocal = references.find(ref => 
      isAuthoritativeDebunkSource(ref) && (
        ref.id === item.id || areClaimsSemanticallyMatching(item.claim, ref.claim)
      )
    )

    if (matchedLocal) {
      const resolved = resolveReferenceVerdict(matchedLocal)
      if (resolved === 'HOAKS' || resolved === 'FAKTA') {
        item.archiveVerdict = resolved
        item.verdict = resolved
        item.officialSource = matchedLocal.officialSource || item.officialSource
        item.sourceUrl = matchedLocal.sourceUrl || item.sourceUrl
        item.clarification = matchedLocal.clarification || item.clarification
        if (matchedLocal.tacticalResponseMilitary) {
          item.tacticalResponseMilitary = matchedLocal.tacticalResponseMilitary
        }
        if (matchedLocal.originalPlatform && !item.originalPlatform) {
          item.originalPlatform = matchedLocal.originalPlatform
        }
        if (matchedLocal.originalSourceUrl && !item.originalSourceUrl) {
          item.originalSourceUrl = matchedLocal.originalSourceUrl
        }
        if ((matchedLocal as any).originalSourceStatus && !item.originalSourceStatus) {
          item.originalSourceStatus = (matchedLocal as any).originalSourceStatus
        }
        item.evidenceSufficiency = 100
        item.lastProbedAt = getFormattedWib()
        item.evidenceSummary = `Bukti Terverifikasi 100%: Ditemukan rujukan cek fakta resmi dari ${matchedLocal.officialSource}`

        verdicts[item.id] = resolved
        localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(dataMap))
        localStorage.setItem(STORAGE_KEY_VERDICTS, JSON.stringify(verdicts))
        window.dispatchEvent(new CustomEvent('narada:archive-updated', { detail: { id, action: 'PROBE_RESOLVED', verdict: resolved } }))

        return {
          id,
          status: 'RESOLVED',
          verdict: resolved,
          evidenceSufficiency: 100,
          evidenceSummary: item.evidenceSummary,
          matchedSource: item.officialSource,
          matchedUrl: item.sourceUrl,
          clarification: item.clarification
        }
      }
    }

    // TAHAP 2: Live Online Investigation Probe (Penelusuran Terarah ke Portal Cek Fakta Upstream)
    const substantiveTokens = extractSubstantiveTokens(item.claim)
    const queryTokens = substantiveTokens.slice(0, 4).join(' ')

    if (queryTokens.length >= 3) {
      try {
        const fetchFn = customFetch || (typeof fetch !== 'undefined' ? fetch : null)
        if (fetchFn) {
          const isFileProto = typeof window !== 'undefined' && window.location.protocol === 'file:'
          const gatewayBase = isFileProto ? 'http://127.0.0.1:5174' : ''
          const searchUrl = `${gatewayBase}/api/radar/search/gnews-cyber-security?topic=${encodeURIComponent(queryTokens)}`

          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 6000)

          const res = await (fetchFn as any)(searchUrl, {
            signal: controller.signal,
            headers: { 'Accept': 'application/rss+xml, application/xml, text/xml, */*' }
          }).catch(() => null)
          clearTimeout(timer)

          if (res && res.ok) {
            const xmlText = await res.text()
            const { parseGoogleNewsRss } = await import('../ingest/rss-parser.ts')
            const parsed = parseGoogleNewsRss(xmlText, 10)

            const onlineMatch = parsed.find(p => 
              isAuthoritativeDebunkSource(p) && areClaimsSemanticallyMatching(item.claim, p.claim)
            )

            if (onlineMatch) {
              const resolved = resolveReferenceVerdict(onlineMatch) || (onlineMatch.verdict === 'FAKTA' ? 'FAKTA' : 'HOAKS')
              item.archiveVerdict = resolved
              item.verdict = resolved
              item.officialSource = onlineMatch.officialSource
              item.sourceUrl = onlineMatch.sourceUrl
              item.clarification = onlineMatch.clarification
              item.evidenceSufficiency = 100
              item.lastProbedAt = getFormattedWib()
              item.evidenceSummary = `Bukti Terverifikasi 100%: Ditemukan hasil penelusuran cek fakta dari ${onlineMatch.officialSource}`

              verdicts[item.id] = resolved
              localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(dataMap))
              localStorage.setItem(STORAGE_KEY_VERDICTS, JSON.stringify(verdicts))
              window.dispatchEvent(new CustomEvent('narada:archive-updated', { detail: { id, action: 'PROBE_RESOLVED', verdict: resolved } }))

              return {
                id,
                status: 'RESOLVED',
                verdict: resolved,
                evidenceSufficiency: 100,
                evidenceSummary: item.evidenceSummary,
                matchedSource: item.officialSource,
                matchedUrl: item.sourceUrl,
                clarification: item.clarification
              }
            } else if (parsed.length > 0) {
              // Ditemukan artikel warta terkait namun belum ada vonis resmi
              item.evidenceSufficiency = 55
              item.lastProbedAt = getFormattedWib()
              item.evidenceSummary = `Ditemukan ${parsed.length} artikel warta pers terkait topik ini. Belum ada rilis sanggahan/konfirmasi otoritas resmi. Pemantauan dilanjutkan.`
              localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(dataMap))
              return {
                id,
                status: 'STILL_MONITORING',
                verdict: 'DIPANTAU',
                evidenceSufficiency: 55,
                evidenceSummary: item.evidenceSummary
              }
            }
          }
        }
      } catch (e) {
        // Safe fallback jika offline/air-gap
      }
    }

    // TAHAP 3: Jika belum ada bukti yang cukup kuat, status WAJIB tetap SEDANG DIPANTAU
    item.evidenceSufficiency = Math.max(item.evidenceSufficiency || 0, 30)
    item.lastProbedAt = getFormattedWib()
    item.evidenceSummary = 'Hasil penelusuran cek fakta belum menemukan rujukan sanggahan atau konfirmasi resmi yang cukup. Status tetap SEDANG DIPANTAU.'
    localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(dataMap))

    return {
      id,
      status: 'STILL_MONITORING',
      verdict: 'DIPANTAU',
      evidenceSufficiency: item.evidenceSufficiency,
      evidenceSummary: item.evidenceSummary
    }
  } catch (err: any) {
    console.error('Gagal menjalankan probe bukti berita tersemat:', err)
    return {
      id,
      status: 'STILL_MONITORING',
      verdict: 'DIPANTAU',
      evidenceSufficiency: 20,
      evidenceSummary: 'Terjadi kendala saat memeriksa pangkalan data rujukan.'
    }
  }
}

/**
 * Menjalankan penelusuran bukti aktif untuk SELURUH berita tersemat yang masih berstatus DIPANTAU
 */
export async function probeAllUnverifiedArchivedItems(
  customFetch?: typeof fetch,
  customReferences?: DebunkKnowledgeEntry[]
): Promise<{
  totalProbed: number
  resolvedCount: number
  updatedCount: number
  stillMonitoringCount: number
  results: EvidenceProbeResult[]
}> {
  const entries = getArchivedEntries()
  const unverified = entries.filter(e => e.archiveVerdict === 'DIPANTAU' && !e.isManualOverride)

  let resolvedCount = 0
  let stillMonitoringCount = 0
  const results: EvidenceProbeResult[] = []

  for (const item of unverified) {
    const res = await probeEvidenceForArchivedItem(item.id, customFetch, customReferences)
    results.push(res)
    if (res.status === 'RESOLVED') {
      resolvedCount++
    } else {
      stillMonitoringCount++
    }
  }

  return {
    totalProbed: unverified.length,
    resolvedCount,
    updatedCount: resolvedCount,
    stillMonitoringCount,
    results
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
