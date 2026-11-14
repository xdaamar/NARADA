/**
 * NARADA ENGINE: Action Recorder (Capture Tindakan Intelijen)
 * 
 * Bertanggung jawab merekam dan mengelompokkan tindakan investigasi operator
 * secara selektif (bukan sekadar merekam seluruh event session tanpa filter).
 * Rekaman tindakan ini digunakan sebagai data acuan pembuatan Laporan Intelijen A4.
 */

export type CaptureScope = 'ALL' | 'RADAR_ONLY' | 'SOCIAL_ONLY' | 'ARCHIVE_ONLY'

export interface CapturedAction {
  id: string
  timestamp: string
  militaryTime: string
  type: 'PIN_ISSUE' | 'RADAR_SCAN' | 'SOCIAL_INVESTIGATE' | 'COUNTER_NARRATIVE_DRAFT' | 'CLASSIFY_VERDICT'
  title: string
  detail: string
  cluster?: string
  verdict?: 'HOAKS' | 'FAKTA' | 'DIPANTAU'
  author?: string
  platform?: string
  metadata?: Record<string, any>
}

export interface CaptureSessionState {
  isRecording: boolean
  scope: CaptureScope
  actions: CapturedAction[]
  sessionStartedAt: string
}

const STORAGE_KEY = 'narada_intel_action_capture'
const EVENT_NAME = 'narada:action-capture-update'

export const CAPTURE_SCOPE_INFO: Record<CaptureScope, { label: string; desc: string; icon: string }> = {
  ALL: {
    label: 'SEMUA TINDAKAN',
    desc: 'Rekam seluruh temuan: Radar, Watchlist Tersemat, Forensik Medsos, & Draf Kontranarasi',
    icon: '⏺',
  },
  RADAR_ONLY: {
    label: 'HANYA TEMUAN RADAR & ISU',
    desc: 'Fokus pada pemindaian anomali, klaster siber, militer, politik, dan lonjakan narasi',
    icon: '🛰️',
  },
  SOCIAL_ONLY: {
    label: 'HANYA ANALISIS MEDSOS & BUZZER',
    desc: 'Fokus pada profil kreator, skor koordinasi botnet, dan kluster copypasta buzzer',
    icon: '🕵️',
  },
  ARCHIVE_ONLY: {
    label: 'HANYA BERITA TERSEMAT (WATCHLIST)',
    desc: 'Fokus pada isu tersemat yang telah divalidasi silang hoaks/fakta beserta atribusi resmi',
    icon: '📌',
  },
}

/**
 * Data awal simulasi taktis untuk demonstrasi instan saat session baru dibuka
 */
function getInitialCuratedActions(): CapturedAction[] {
  const now = new Date()
  const fmt = (minusMinutes: number) => {
    const d = new Date(now.getTime() - minusMinutes * 60000)
    return {
      iso: d.toISOString(),
      mil: d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB'
    }
  }

  const t1 = fmt(28)
  const t2 = fmt(19)
  const t3 = fmt(12)
  const t4 = fmt(4)

  return [
    {
      id: 'ACT-001',
      timestamp: t1.iso,
      militaryTime: t1.mil,
      type: 'PIN_ISSUE',
      title: 'Penyematan Isu Kedaulatan Militer',
      detail: 'Penyematan klaim disinformasi: "Pembelian alutsista sistem radar dan jet tempur fiktif Rp 24T".',
      cluster: 'KEDAULATAN_MILITER',
      verdict: 'HOAKS',
      metadata: { source: 'TurnBackHoax / MAFINDO', idRef: 'RADAR-DEF-001' }
    },
    {
      id: 'ACT-002',
      timestamp: t2.iso,
      militaryTime: t2.mil,
      type: 'SOCIAL_INVESTIGATE',
      title: 'Investigasi Medsos Akun YouTube @puspen_pertahanan',
      detail: 'Pendeteksian skor koordinasi buzzer 88/100 (TINGGI) dengan 2 kluster copypasta astroturfing.',
      platform: 'YOUTUBE',
      author: '@puspen_pertahanan',
      metadata: { coordinationScore: 88, velocity: 17.5 }
    },
    {
      id: 'ACT-003',
      timestamp: t3.iso,
      militaryTime: t3.mil,
      type: 'CLASSIFY_VERDICT',
      title: 'Klarifikasi Cross-Corroboration Resmi Kemhan',
      detail: 'Verifikasi pernyataan resmi Kepala Biro Humas Kemhan membantah selebaran pengadaan fiktif.',
      cluster: 'KEDAULATAN_MILITER',
      verdict: 'FAKTA',
      metadata: { officialRef: 'Biro Humas Setjen Kemhan RI' }
    },
    {
      id: 'ACT-004',
      timestamp: t4.iso,
      militaryTime: t4.mil,
      type: 'COUNTER_NARRATIVE_DRAFT',
      title: 'Formulasi Draf Kontranarasi Taktis 4-Kanal',
      detail: 'Penyusunan lembar fakta Dispenad, panduan dialog Babinsa, pesan edukasi WA warga, dan cuitan taktis.',
      cluster: 'HANKAM',
      metadata: { channels: 4 }
    }
  ]
}

/**
 * Membaca status session perekaman saat ini
 */
export function getCaptureSession(): CaptureSessionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const sessionInitialized = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('narada_capture_initialized') : null

    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && Array.isArray(parsed.actions)) {
        // Bersihkan data dummy kurasi lama (ACT-001..ACT-004) agar data murni hasil capture user
        parsed.actions = (parsed.actions as CapturedAction[]).filter(a => !['ACT-001', 'ACT-002', 'ACT-003', 'ACT-004'].includes(a.id))
        if (!sessionInitialized) {
          parsed.isRecording = false
          if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('narada_capture_initialized', 'true')
          saveCaptureSession(parsed)
        }
        return parsed
      }
    }
  } catch (err) {
    console.warn('[ActionRecorder] Gagal membaca session capture:', err)
  }

  // Default state awal: REC OFF dan actions murni kosong tanpa dummy
  const defaultState: CaptureSessionState = {
    isRecording: false,
    scope: 'ALL',
    actions: [],
    sessionStartedAt: new Date().toISOString()
  }
  if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('narada_capture_initialized', 'true')
  saveCaptureSession(defaultState)
  return defaultState
}

/**
 * Menyimpan status session perekaman ke localStorage & menyiarkan event
 */
function saveCaptureSession(state: CaptureSessionState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: state }))
  } catch (err) {
    console.warn('[ActionRecorder] Gagal menyimpan session capture:', err)
  }
}

/**
 * Menghidupkan atau menjeda perekaman tindakan intelijen
 */
export function toggleRecordingState(): boolean {
  const current = getCaptureSession()
  const next = !current.isRecording
  saveCaptureSession({ ...current, isRecording: next })
  return next
}

/**
 * Mengubah cakupan perekaman tindakan (ALL | RADAR_ONLY | SOCIAL_ONLY | ARCHIVE_ONLY)
 */
export function setCaptureScope(scope: CaptureScope): void {
  const current = getCaptureSession()
  saveCaptureSession({ ...current, scope })
}

/**
 * Merekam satu tindakan intelijen baru jika perekaman aktif dan sesuai cakupan
 */
export function recordIntelAction(action: Omit<CapturedAction, 'id' | 'timestamp' | 'militaryTime'>): CapturedAction | null {
  const current = getCaptureSession()
  if (!current.isRecording) {
    return null
  }

  // Filter berdasarkan cakupan (scope)
  if (current.scope === 'RADAR_ONLY' && action.type !== 'RADAR_SCAN' && action.type !== 'PIN_ISSUE') {
    return null
  }
  if (current.scope === 'SOCIAL_ONLY' && action.type !== 'SOCIAL_INVESTIGATE') {
    return null
  }
  if (current.scope === 'ARCHIVE_ONLY' && action.type !== 'PIN_ISSUE' && action.type !== 'CLASSIFY_VERDICT') {
    return null
  }

  const now = new Date()
  const newAction: CapturedAction = {
    ...action,
    id: `ACT-${String(current.actions.length + 1).padStart(3, '0')}-${Date.now().toString().slice(-4)}`,
    timestamp: now.toISOString(),
    militaryTime: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB'
  }

  // Simpan di posisi depan (urutan terbaru)
  const updatedActions = [newAction, ...current.actions.slice(0, 49)]
  saveCaptureSession({ ...current, actions: updatedActions })
  return newAction
}

/**
 * Mengosongkan rekaman tindakan saat memulai investigasi baru
 */
export function clearCapturedActions(): void {
  const current = getCaptureSession()
  saveCaptureSession({
    ...current,
    actions: [],
    sessionStartedAt: new Date().toISOString()
  })
}

/**
 * Mengembalikan rekaman ke simulasi terkurasi Pussiberad
 */
export function resetToCuratedActions(): void {
  const current = getCaptureSession()
  saveCaptureSession({
    ...current,
    actions: getInitialCuratedActions(),
    sessionStartedAt: new Date().toISOString()
  })
}

/**
 * Hook/Listener berlangganan pembaruan perekam tindakan
 */
export function subscribeToCaptureSession(callback: (state: CaptureSessionState) => void): () => void {
  const handler = (e: Event) => {
    const custom = e as CustomEvent<CaptureSessionState>
    if (custom.detail) {
      callback(custom.detail)
    } else {
      callback(getCaptureSession())
    }
  }
  window.addEventListener(EVENT_NAME, handler)
  return () => window.removeEventListener(EVENT_NAME, handler)
}

// Inisialisasi pendengar event arsip otomatis jika berjalan di browser environment
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('narada:archive-updated', (e: Event) => {
    try {
      const custom = e as CustomEvent<{ id: string; action: string; item?: any; verdict?: string }>
      if (!custom.detail) return
      const { id, action, item, verdict } = custom.detail

      if (action === 'ARCHIVE' && item) {
        recordIntelAction({
          type: 'PIN_ISSUE',
          title: `Penyematan Isu: ${(item.claim || item.title || id).slice(0, 50)}...`,
          detail: item.clarification || item.summary || 'Isu ditandai untuk pemantauan persisten di Berita Tersemat',
          cluster: item.cluster,
          verdict: 'DIPANTAU',
          metadata: { id, source: item.officialSource }
        })
      } else if (action === 'SET_VERDICT' && verdict) {
        recordIntelAction({
          type: 'CLASSIFY_VERDICT',
          title: `Klasifikasi Isu: Vonis ${verdict}`,
          detail: `Isu ID ${id} diverifikasi dan ditetapkan berstatus ${verdict}`,
          verdict: verdict as any
        })
      }
    } catch {
      // safe fallback
    }
  })
}
