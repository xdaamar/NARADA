import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Radio,
  Pin, 
  FileText, 
  Settings,
  Activity,
  ChevronLeft,
  ChevronRight,
  Search
} from 'lucide-react'
import Dashboard from './pages/Dashboard'
import LiveRadar from './pages/LiveRadar'
import ArchivePage from './pages/Archive'
import SocialForensic from './pages/SocialForensic'
import Reports from './pages/Reports'
import SettingsPage from './pages/SettingsPage'
import TacticalTopBar from './components/TacticalTopBar'
import InteractiveDoctrineModal from './components/InteractiveDoctrineModal'

import { 
  getStorageDurabilityStatus,
  runIndexedDbToSqliteMigration,
  type StorageDurabilityState
} from './utils/db-adapter.ts'

// ─── Nav Items Config dengan Keyboard Hotkeys (Sprint 9 Information Architecture) ───
// Contract Preservation: Investigasi Kasus | Radar Situasional | Alt+3 assigned to investigative workspace
const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true, hotkey: 'Alt+1' },
  { to: '/radar', icon: Radio, label: 'Radar Situasional', exact: true, hotkey: 'Alt+2' },
  { to: '/archive', icon: Pin, label: 'Berita Tersemat', hotkey: 'Alt+3' },
  { to: '/social-forensic', icon: Search, label: 'Analisa Postingan Medsos', hotkey: 'Alt+4' },
  { to: '/reports', icon: FileText, label: 'Produk Intelijen A4', hotkey: 'Alt+5' },
]

// ─── Sidebar Component (Tactical Armored Steel Plate) ───
interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
  storageState: StorageDurabilityState
}

function Sidebar({ isCollapsed, onToggle, storageState }: SidebarProps) {
  const isPersisted = storageState.status === 'PERSISTED'
  const isDegraded = storageState.status === 'DEGRADED'
  const statusColor = isPersisted ? '#10B981' : isDegraded ? '#F59E0B' : '#EF4444'
  const statusLabel = isPersisted ? (storageState.engine === 'SQLITE' ? 'SQLITE DURABLE' : 'INDEXED_DB READY') : isDegraded ? 'STORAGE DEGRADED' : 'STORAGE ERROR'

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Header: Logo Crest & Tombol Toggle Show/Hide Sejajar Rapi dengan TopBar */}
      <div className="sidebar-logo">
        {!isCollapsed ? (
          <>
            <div className="sidebar-logo-brand">
              <div className="sidebar-logo-icon" style={{ background: 'transparent', padding: 0 }}>
                <img 
                  src="/image/Electrified%20Golden%20Globe%20Crest.png" 
                  alt="NARADA Crest" 
                  className="crest-glow"
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

        {!isCollapsed ? (
          <div className="nav-section-label" style={{ marginTop: '12px' }}>
            <span>SISTEM</span>
            <span style={{ color: 'var(--accent-gold)', fontSize: '10px', letterSpacing: '1px' }}>///</span>
          </div>
        ) : (
          <div className="sidebar-collapsed-divider" style={{ marginTop: '10px' }} />
        )}

        <NavLink
          to="/settings"
          data-tooltip="Pengaturan Sistem"
          title={isCollapsed ? "Pengaturan Sistem" : undefined}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          <Settings size={isCollapsed ? 22 : 18} className="nav-item-icon" />
          {!isCollapsed && <span>Pengaturan</span>}
        </NavLink>
      </nav>

      {/* Footer Sidebar: Status Penyimpanan Jujur */}
      {!isCollapsed && (
        <div className="sidebar-footer">
          <div className="system-status">
            <div className="status-dot" style={{ background: statusColor, boxShadow: `0 0 8px ${statusColor}` }} />
            <div className="system-status-detail">
              <div className="status-text" style={{ fontWeight: 700, color: '#F1F5F9' }}>
                {isPersisted ? 'SISTEM AKTIF' : 'PERINGATAN'}
              </div>
              <div className="status-text" style={{ color: statusColor, marginTop: '1px', fontSize: '9px', fontWeight: 600 }}>
                {statusLabel}
              </div>
            </div>
            <Activity size={14} style={{ marginLeft: 'auto', color: statusColor, opacity: 0.85 }} />
          </div>
        </div>
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

  // Keyboard Hotkeys Alt+1..5, Ctrl+B (Toggle Sidebar) & Global Clipboard Paste (Ctrl+V)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [navigate])

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
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
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
