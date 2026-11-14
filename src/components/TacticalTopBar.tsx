import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  PanelLeft,
  Pause,
  SlidersHorizontal,
  ChevronDown,
  Check,
  FileText,
  RotateCcw,
  Trash2
} from 'lucide-react'
import {
  getCaptureSession,
  setCaptureScope,
  toggleRecordingState,
  clearCapturedActions,
  resetToCuratedActions,
  subscribeToCaptureSession,
  CAPTURE_SCOPE_INFO,
  type CaptureScope,
  type CaptureSessionState,
} from '../engine/reports/action-recorder'

interface TacticalTopBarProps {
  onOpenDoctrineModal?: () => void
  onToggleSidebar?: () => void
  isSidebarCollapsed?: boolean
}

interface PageMeta {
  title: string
  subtitle: string
}

const PAGE_CONFIG: Record<string, PageMeta> = {
  '/': {
    title: 'SITUATIONAL AWARENESS',
    subtitle: 'ANALISIS | DETEKSI | VERIFIKASI | LINDUNGI INFORMASI',
  },
  '/radar': {
    title: 'LIVE OSINT DEBUNK RADAR',
    subtitle: 'PEMANTAUAN ANCAMAN DISINFORMASI NASIONAL REAL-TIME',
  },
  '/archive': {
    title: 'BERITA TERSEMAT',
    subtitle: 'REPOSITORI BERITA TERSEMAT • TIDAK TENGGELAM HINGGA TERKLASIFIKASI FINAL',
  },
  '/tersemat': {
    title: 'BERITA TERSEMAT',
    subtitle: 'REPOSITORI BERITA TERSEMAT • TIDAK TENGGELAM HINGGA TERKLASIFIKASI FINAL',
  },
  '/pinned': {
    title: 'BERITA TERSEMAT',
    subtitle: 'REPOSITORI BERITA TERSEMAT • TIDAK TENGGELAM HINGGA TERKLASIFIKASI FINAL',
  },
  '/watchlist': {
    title: 'BERITA TERSEMAT',
    subtitle: 'REPOSITORI BERITA TERSEMAT • TIDAK TENGGELAM HINGGA TERKLASIFIKASI FINAL',
  },
  '/daftar-pantau': {
    title: 'BERITA TERSEMAT',
    subtitle: 'REPOSITORI BERITA TERSEMAT • TIDAK TENGGELAM HINGGA TERKLASIFIKASI FINAL',
  },
  '/analyzer': {
    title: 'BERITA TERSEMAT',
    subtitle: 'REPOSITORI BERITA TERSEMAT • TIDAK TENGGELAM HINGGA TERKLASIFIKASI FINAL',
  },
  '/classifier': {
    title: 'BERITA TERSEMAT',
    subtitle: 'REPOSITORI BERITA TERSEMAT • TIDAK TENGGELAM HINGGA TERKLASIFIKASI FINAL',
  },
  '/social-forensic': {
    title: 'ANALISA POSTINGAN MEDSOS & KOMENTAR',
    subtitle: 'ANALISIS KONTEN, METRIK KREATOR, TOP KOMENTAR, COPYPASTA & BUZZER',
  },
  '/profiler': {
    title: 'ANALISA POSTINGAN MEDSOS & KOMENTAR',
    subtitle: 'ANALISIS KONTEN, METRIK KREATOR, TOP KOMENTAR, COPYPASTA & BUZZER',
  },
  '/nexus': {
    title: 'LIVE OSINT DEBUNK RADAR',
    subtitle: 'PEMANTAUAN ANCAMAN DISINFORMASI NASIONAL REAL-TIME',
  },
  '/reports': {
    title: 'PRODUK INTELIJEN A4',
    subtitle: 'FORMAT KEDINASAN RESMI MILITER DISPENAD TNI AD',
  },
  '/settings': {
    title: 'PENGATURAN SISTEM',
    subtitle: 'KONFIGURASI PARAMETER, BOBOT MODEL & TELEMETRI OPSEC',
  },
  '/about': {
    title: 'ABOUT DEVELOPER & DOSSIER',
    subtitle: 'PROFIL PENGEMBANG & SPESIFIKASI PROYEK NARADA',
  },
  '/developer': {
    title: 'ABOUT DEVELOPER & DOSSIER',
    subtitle: 'PROFIL PENGEMBANG & SPESIFIKASI PROYEK NARADA',
  },
  '/tentang-pengembang': {
    title: 'ABOUT DEVELOPER & DOSSIER',
    subtitle: 'PROFIL PENGEMBANG & SPESIFIKASI PROYEK NARADA',
  },
}

export default function TacticalTopBar({
  onToggleSidebar,
  isSidebarCollapsed,
}: TacticalTopBarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const pageMeta = PAGE_CONFIG[location.pathname] ?? {
    title: 'SITUATIONAL AWARENESS',
    subtitle: 'ANALISIS | DETEKSI | VERIFIKASI | LINDUNGI INFORMASI',
  }

  // ─── STATUS PEREKAM TINDAKAN INTELIJEN (PENGGANTI JAM NAVBAR) ───
  const [captureSession, setCaptureSession] = useState<CaptureSessionState>(getCaptureSession)
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsubscribe = subscribeToCaptureSession((state) => {
      setCaptureSession(state)
    })
    return unsubscribe
  }, [])

  // Listener tutup popover saat klik di luar
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isMenuOpen])

  const currentScopeInfo = CAPTURE_SCOPE_INFO[captureSession.scope]

  return (
    <header className="topbar no-print">
      {/* ─── Kiri: Judul dan Sub Judul ─── */}
      <div className="topbar-title-wrap">
        {onToggleSidebar && isSidebarCollapsed && (
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={onToggleSidebar}
            title="Tampilkan Bilah Samping [Ctrl+B]"
            style={{ marginRight: '6px' }}
          >
            <PanelLeft size={15} color="#D4AF37" />
          </button>
        )}
        <span className="tactical-slashes">///</span>
        <div>
          <div className="topbar-title">{pageMeta.title}</div>
          <div className="topbar-subtitle">
            {pageMeta.subtitle}
          </div>
        </div>
      </div>

      {/* ─── Kanan: Tombol & Menu CAPTURE TINDAKAN INTELIJEN (Menggantikan Jam) ─── */}
      <div className="topbar-actions" ref={menuRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Tombol Toggle Rekam (REC Active / Paused) */}
        <button
          type="button"
          onClick={() => toggleRecordingState()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 10px',
            borderRadius: '4px',
            border: captureSession.isRecording
              ? '1px solid rgba(220, 38, 38, 0.6)'
              : '1px solid rgba(148, 163, 184, 0.3)',
            background: captureSession.isRecording
              ? 'linear-gradient(180deg, rgba(220, 38, 38, 0.22) 0%, rgba(153, 27, 27, 0.15) 100%)'
              : 'rgba(15, 23, 42, 0.6)',
            color: captureSession.isRecording ? '#EF4444' : '#94A3B8',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          title={captureSession.isRecording ? 'Perekaman Tindakan Aktif (Klik untuk Jeda)' : 'Perekaman Dijeda (Klik untuk Lanjutkan)'}
        >
          {captureSession.isRecording ? (
            <>
              <span style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#EF4444',
                boxShadow: '0 0 8px #EF4444',
                animation: 'pulse 1.2s infinite'
              }} />
              <span>REC AKTIF</span>
            </>
          ) : (
            <>
              <Pause size={10} color="#94A3B8" />
              <span>REC JEDA</span>
            </>
          )}
        </button>

        {/* Tombol Pemilih Cakupan Capture (Dropdown Menu) */}
        <button
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            padding: '5px 10px',
            borderRadius: '4px',
            border: isMenuOpen ? '1px solid #38BDF8' : '1px solid #1E293B',
            background: 'linear-gradient(180deg, #131B26 0%, #0A0F15 100%)',
            color: '#E2E8F0',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08)'
          }}
          title="Konfigurasi cakupan perekaman tindakan intelijen untuk laporan A4"
        >
          <SlidersHorizontal size={12} color="#38BDF8" />
          <span style={{ color: '#F1F5F9' }}>{currentScopeInfo.label}</span>
          <span style={{
            fontSize: '9px',
            background: '#1E293B',
            color: '#38BDF8',
            padding: '1px 5px',
            borderRadius: '3px',
            fontWeight: 800
          }}>
            {captureSession.actions.length}
          </span>
          <ChevronDown size={12} color="#94A3B8" style={{ transform: isMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
        </button>

        {/* Popover Opsi Capture Tindakan Intelijen */}
        {isMenuOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: '340px',
              background: '#0B0F17',
              border: '1px solid #243042',
              borderRadius: '6px',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.05)',
              zIndex: 1000,
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            {/* Header Popover */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1E293B', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px' }}>⚙️</span>
                <span style={{ fontSize: '11px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#F8FAFC' }}>
                  CAPTURE TINDAKAN INTELIJEN
                </span>
              </div>
              <span style={{ fontSize: '9px', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                {captureSession.actions.length} TINDAKAN TERSIMPAN
              </span>
            </div>

            <div style={{ fontSize: '10px', color: '#94A3B8', lineHeight: 1.4 }}>
              Pilih cakupan aktivitas yang direkam untuk otomatis dikemas ke dalam <strong>Laporan Intelijen Dinas A4</strong>:
            </div>

            {/* List Pilihan Cakupan (Radio Scope) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(Object.keys(CAPTURE_SCOPE_INFO) as CaptureScope[]).map((scopeKey) => {
                const info = CAPTURE_SCOPE_INFO[scopeKey]
                const isSelected = captureSession.scope === scopeKey
                return (
                  <div
                    key={scopeKey}
                    onClick={() => {
                      setCaptureScope(scopeKey)
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                      border: isSelected ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      transition: 'all 0.12s ease'
                    }}
                  >
                    <div style={{ marginTop: '2px' }}>
                      {isSelected ? <Check size={13} color="#38BDF8" /> : <div style={{ width: '13px', height: '13px', borderRadius: '50%', border: '1px solid #475569' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: isSelected ? '#38BDF8' : '#F1F5F9', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>{info.icon}</span>
                        <span>{info.label}</span>
                      </div>
                      <div style={{ fontSize: '9.5px', color: '#94A3B8', marginTop: '2px', lineHeight: 1.3 }}>
                        {info.desc}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer Aksi Cepat */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #1E293B', paddingTop: '8px', marginTop: '2px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => resetToCuratedActions()}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(212, 175, 55, 0.3)',
                    color: 'var(--accent-gold)',
                    fontSize: '9.5px',
                    fontFamily: 'var(--font-mono)',
                    padding: '3px 8px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Kembalikan rekaman ke skenario tindakan binaan Pussiberad"
                >
                  <RotateCcw size={10} />
                  <span>Muat Binaan</span>
                </button>
                <button
                  type="button"
                  onClick={() => clearCapturedActions()}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#EF4444',
                    fontSize: '9.5px',
                    fontFamily: 'var(--font-mono)',
                    padding: '3px 8px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Kosongkan rekaman tindakan untuk sesi investigasi bersih"
                >
                  <Trash2 size={10} />
                  <span>Kosongkan</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false)
                  navigate('/reports')
                }}
                style={{
                  background: 'linear-gradient(180deg, #991B1B 0%, #7F1D1D 100%)',
                  border: '1px solid #DC2626',
                  color: '#FFFFFF',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <FileText size={11} />
                <span>Buka Laporan A4 ↗</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
