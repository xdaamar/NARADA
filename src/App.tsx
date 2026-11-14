import { useState, useEffect, Suspense } from 'react'
import { HashRouter, Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Radio,
  Pin, 
  FileText, 
  ChevronLeft,
  ChevronRight,
  Search,
  UserCheck,
  Cpu
} from 'lucide-react'

// Halaman Aplikasi (Eager Loading untuk Responsivitas Desktop Instan 0-ms Tanpa UI Freeze)
import Dashboard from './pages/Dashboard'
import LiveRadar from './pages/LiveRadar'
import ArchivePage from './pages/Archive'
import SocialForensic from './pages/SocialForensic'
import Reports from './pages/Reports'
import AboutDeveloper from './pages/AboutDeveloper'

import TacticalTopBar from './components/TacticalTopBar'
import InteractiveDoctrineModal from './components/InteractiveDoctrineModal'
import { SystemHardwareCard } from './components/SystemHardwareCard'
import { useHardwareTelemetry } from './engine/telemetry/hardware-telemetry-service'
import crestLogo from './assets/crest-logo.png'

import { 
  getStorageDurabilityStatus,
  runIndexedDbToSqliteMigration,
  type StorageDurabilityState
} from './utils/db-adapter.ts'

// ─── Nav Items Config dengan Keyboard Hotkeys (Sprint 9 Information Architecture) ───
// Contract Preservation: Investigasi Kasus | Radar Situasional | Alt+3 assigned to investigative workspace
const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true, hotkey: 'Alt+1' },
  { to: '/radar', icon: Radio, label: 'Live Radar', exact: true, hotkey: 'Alt+2' },
  { to: '/archive', icon: Pin, label: 'Pinned News', hotkey: 'Alt+3' },
  { to: '/social-forensic', icon: Search, label: 'Social Forensic', hotkey: 'Alt+4' },
  { to: '/reports', icon: FileText, label: 'Intel Reports', hotkey: 'Alt+5' },
  { to: '/about', icon: UserCheck, label: 'About', hotkey: 'Alt+6' },
]

// ─── Sidebar Component (Tactical Armored Steel Plate) ───
interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
  storageState: StorageDurabilityState
}

function Sidebar({ isCollapsed, onToggle, storageState }: SidebarProps) {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [isCollapsedHovered, setIsCollapsedHovered] = useState<boolean>(false)
  const { specs, telemetry, ramHistory, cpuHistory } = useHardwareTelemetry()

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const isSystemOnline = isOnline && storageState.status !== 'FAILED'

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Header: Logo Crest & Tombol Toggle Show/Hide Sejajar Rapi dengan TopBar */}
      <div className="sidebar-logo">
        {!isCollapsed ? (
          <>
            <div className="sidebar-logo-brand">
              <div className="sidebar-logo-icon" style={{ background: 'transparent', padding: 0 }}>
                <img 
                  src={crestLogo} 
                  alt="NARADA Crest" 
                  className="crest-glow"
                  onError={(e) => {
                    const t = e.currentTarget
                    if (!t.dataset.retried) {
                      t.dataset.retried = '1'
                      t.src = './image/Electrified%20Golden%20Globe%20Crest.png'
                    }
                  }}
                  style={{ width: '36px', height: '36px', objectFit: 'contain' }} 
                />
              </div>
              <div className="sidebar-logo-text-wrap">
                <div className="sidebar-logo-text">NARADA</div>
                <div className="sidebar-logo-sub">KOGNITIF AI - V1.0</div>
              </div>
            </div>

            <button
              type="button"
              className="sidebar-toggle-btn"
              onClick={onToggle}
              title="Sembunyikan Bilah Samping [Ctrl+B]"
            >
              <ChevronLeft size={15} />
            </button>
          </>
        ) : (
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={onToggle}
            title="Tampilkan Bilah Samping [Ctrl+B]"
            style={{ width: '36px', height: '36px', borderRadius: '6px' }}
          >
            <ChevronRight size={17} color="#D4AF37" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {!isCollapsed ? (
          <div className="nav-section-label">
            <span>MODUL UTAMA</span>
            <span style={{ color: 'var(--accent-gold)', fontSize: '10px', letterSpacing: '1px' }}>///</span>
          </div>
        ) : (
          <div className="sidebar-collapsed-divider" />
        )}

        {NAV_ITEMS.map(({ to, icon: Icon, label, exact, hotkey }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            data-tooltip={`${label} [${hotkey}]`}
            title={isCollapsed ? `${label} (${hotkey})` : undefined}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon size={isCollapsed ? 22 : 18} className="nav-item-icon" />
            {!isCollapsed && <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
            {!isCollapsed && (
              <span style={{ 
                fontSize: '8px', 
                fontFamily: 'var(--font-mono)', 
                color: 'var(--text-tertiary)', 
                opacity: 0.8,
                border: '1px solid var(--border-subtle)',
                padding: '1px 4px',
                borderRadius: '3px',
                lineHeight: 1
              }}>
                {hotkey}
              </span>
            )}
          </NavLink>
        ))}

      </nav>

      {/* ─── TELEMETRI SISTEM (PLAT BAJA + GRAFIK TASK MANAGER ECG + CHIP DETECTION) ─── */}
      {isCollapsed ? (
        /* Saat mode hide: fungsikan Hover pada tombol compact icon di bagian bawah */
        <div 
          className="sidebar-collapsed-telemetry-trigger"
          onMouseEnter={() => setIsCollapsedHovered(true)}
          onMouseLeave={() => setIsCollapsedHovered(false)}
          style={{
            marginTop: 'auto',
            marginBottom: '12px',
            display: 'flex',
            justifyContent: 'center',
            position: 'relative'
          }}
        >
          <div 
            className="nav-item"
            style={{
              width: '58px',
              height: '52px',
              margin: '0 auto',
              justifyContent: 'center',
              alignItems: 'center',
              position: 'relative',
              cursor: 'pointer'
            }}
            title="Telemetri Sistem [Arahkan kursor untuk info lengkap]"
          >
            <Cpu size={22} className="nav-item-icon" color="#38BDF8" />
            {/* Status dot indikator online/offline */}
            <div 
              style={{
                position: 'absolute',
                top: '8px',
                right: '10px',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: isSystemOnline ? '#10B981' : '#EF4444',
                boxShadow: isSystemOnline ? '0 0 6px #10B981' : '0 0 6px #EF4444'
              }}
            />
          </div>

          {/* Floating Armored Steel Card Popover saat di-hover pada mode collapsed */}
          {isCollapsedHovered && (
            <div 
              style={{
                position: 'fixed',
                left: '78px',
                bottom: '12px',
                width: '240px',
                zIndex: 99999,
                pointerEvents: 'none',
                animation: 'fadeIn 0.15s ease'
              }}
            >
              <SystemHardwareCard 
                specs={specs} 
                telemetry={telemetry} 
                ramHistory={ramHistory} 
                cpuHistory={cpuHistory} 
                isSystemOnline={isSystemOnline} 
              />
            </div>
          )}
        </div>
      ) : (
        /* Saat mode show: Tampilkan langsung dibungkus plat baja dengan grafik naik turun Task Manager */
        <>
          {/* Pembatas berupa garis sederhana antara menu tab dan monitoring */}
          <div 
            style={{ 
              height: '1px', 
              background: 'rgba(255, 255, 255, 0.08)', 
              margin: 'auto 14px 10px 14px' 
            }} 
          />

          <div className="sidebar-footer" style={{ borderTop: 'none', paddingTop: 0, paddingBottom: '12px' }}>
            <SystemHardwareCard 
              specs={specs} 
              telemetry={telemetry} 
              ramHistory={ramHistory} 
              cpuHistory={cpuHistory} 
              isSystemOnline={isSystemOnline} 
            />
          </div>
        </>
      )}
    </aside>
  )
}

// ─── App Shell dengan Hotkey Alt+1 s/d Alt+5, Peluncur Skenario & Global Paste Listener ───
function AppShell() {
  const navigate = useNavigate()
  const [isDoctrineModalOpen, setIsDoctrineModalOpen] = useState<boolean>(false)
  const [storageState, setStorageState] = useState<StorageDurabilityState>({
    status: 'PERSISTED',
    engine: 'SQLITE'
  })
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('narada_sidebar_collapsed') === 'true'
    } catch {
      return false
    }
  })

  // Inisialisasi status penyimpanan & migrasi otomatis IndexedDB ke SQLite
  useEffect(() => {
    getStorageDurabilityStatus().then(status => {
      setStorageState(status)
    })

    runIndexedDbToSqliteMigration().then(res => {
      if (res.success && res.stats && !res.stats.alreadyCompleted) {
        console.log('[App] Migrasi IndexedDB ke SQLite selesai:', res.stats)
        getStorageDurabilityStatus().then(setStorageState)
      }
    }).catch(err => {
      console.warn('[App] Migrasi SQLite error:', err)
    })
  }, [])

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('narada_sidebar_collapsed', String(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  // Listener Auto-Hide / Icon-Only Sidebar saat Tinjau Penuh Dokumen A4 dibuka
  useEffect(() => {
    const handleSidebarEvent = (e: Event) => {
      const custom = e as CustomEvent<{ collapse: boolean }>
      if (custom.detail && typeof custom.detail.collapse === 'boolean') {
        setIsSidebarCollapsed(custom.detail.collapse)
      }
    }
    window.addEventListener('narada:sidebar-collapse', handleSidebarEvent)
    return () => window.removeEventListener('narada:sidebar-collapse', handleSidebarEvent)
  }, [])

  // Keyboard Hotkeys Alt+1..5, Ctrl+B (Toggle Sidebar) & Desktop Zoom (Ctrl+, Ctrl-, Ctrl 0)
  useEffect(() => {
    let zoomLevel = 1.0

    const handleKeyDown = (e: KeyboardEvent) => {
      // Fitur Zoom In / Zoom Out dengan Ctrl+, Ctrl-, Ctrl 0
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+' || e.code === 'NumpadAdd') {
          e.preventDefault()
          zoomLevel = Math.min(1.8, +(zoomLevel + 0.08).toFixed(2))
          document.documentElement.style.zoom = `${zoomLevel}`
          return
        } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
          e.preventDefault()
          zoomLevel = Math.max(0.65, +(zoomLevel - 0.08).toFixed(2))
          document.documentElement.style.zoom = `${zoomLevel}`
          return
        } else if (e.key === '0' || e.code === 'Numpad0') {
          e.preventDefault()
          zoomLevel = 1.0
          document.documentElement.style.zoom = '1.0'
          return
        }
      }

      // Toggle Sidebar via Ctrl+B / Cmd+B
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault()
        toggleSidebar()
        return
      }

      // Periksa apakah pengguna sedang mengetik di input / textarea
      const target = e.target as HTMLElement | null
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

      if (e.altKey && !isInput) {
        if (e.key === '1') {
          e.preventDefault()
          navigate('/')
        } else if (e.key === '2') {
          e.preventDefault()
          navigate('/radar')
        } else if (e.key === '3') {
          e.preventDefault()
          navigate('/archive')
        } else if (e.key === '4') {
          e.preventDefault()
          navigate('/social-forensic')
        } else if (e.key === '5') {
          e.preventDefault()
          navigate('/reports')
        } else if (e.key === '6') {
          e.preventDefault()
          navigate('/about')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [navigate])

// ─── Indikator Muat Halaman Taktis (Ultra-Lightweight Tactical Loader) ───
function TacticalPageLoader() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '55vh',
      gap: '14px',
      color: '#38BDF8',
      fontFamily: 'var(--font-mono)'
    }}>
      <div style={{
        width: '36px',
        height: '36px',
        border: '2px solid rgba(56, 189, 248, 0.2)',
        borderTop: '2px solid #38BDF8',
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite'
      }} />
      <div style={{
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '1px',
        color: '#94A3B8',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <span style={{ color: 'var(--accent-gold)' }}>///</span>
        <span>MEMUAT MODUL INTELIJEN...</span>
      </div>
    </div>
  )
}

  return (
    <div className="app-layout">
      <Sidebar isCollapsed={isSidebarCollapsed} onToggle={toggleSidebar} storageState={storageState} />
      <div className="main-content">
        <TacticalTopBar
          onOpenDoctrineModal={() => setIsDoctrineModalOpen(true)}
          onToggleSidebar={toggleSidebar}
          isSidebarCollapsed={isSidebarCollapsed}
        />
        <main className="page-content">
          <Suspense fallback={<TacticalPageLoader />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/radar" element={<LiveRadar />} />
              <Route path="/radar/monitor/:id" element={<SocialForensic />} />
              <Route path="/radar/monitor" element={<SocialForensic />} />
              <Route path="/archive" element={<ArchivePage />} />
              <Route path="/tersemat" element={<ArchivePage />} />
              <Route path="/pinned" element={<ArchivePage />} />
              <Route path="/watchlist" element={<ArchivePage />} />
              <Route path="/daftar-pantau" element={<ArchivePage />} />
              <Route path="/analyzer" element={<ArchivePage />} />
              <Route path="/classifier" element={<ArchivePage />} />
              <Route path="/social-forensic" element={<SocialForensic />} />
              <Route path="/profiler" element={<SocialForensic />} />
              <Route path="/nexus" element={<LiveRadar />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/about" element={<AboutDeveloper />} />
              <Route path="/developer" element={<AboutDeveloper />} />
              <Route path="/tentang-pengembang" element={<AboutDeveloper />} />
              <Route path="/settings" element={<Navigate to="/reports" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>

      {/* Modal Doktrin Interaktif In-App */}
      <InteractiveDoctrineModal
        isOpen={isDoctrineModalOpen}
        onClose={() => setIsDoctrineModalOpen(false)}
      />
    </div>
  )
}

// ─── Root App ───
export default function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  )
}
