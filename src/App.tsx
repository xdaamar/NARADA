import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  ScanText, 
  UserSearch, 
  Network, 
  FileText, 
  Settings,
  Shield,
  Activity
} from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Analyzer from './pages/Analyzer'
import Profiler from './pages/Profiler'
import Nexus from './pages/Nexus'
import Reports from './pages/Reports'
import SettingsPage from './pages/SettingsPage'
import { getUserSettings, getStoredAnalyses } from './utils/storage'

// ─── Nav Items Config ───
const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/analyzer', icon: ScanText, label: 'Multi-Input Analyzer' },
  { to: '/profiler', icon: UserSearch, label: 'Profiler' },
  { to: '/nexus', icon: Network, label: 'Nexus Graph' },
  { to: '/reports', icon: FileText, label: 'Intel Report' },
]

// ─── Sidebar Component ───
function Sidebar() {
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Shield size={18} color="white" />
        </div>
        <div>
          <div className="sidebar-logo-text">NARADA</div>
          <div className="sidebar-logo-sub">KOGNITIF AI · v1.0</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">MODUL UTAMA</div>
        {NAV_ITEMS.map(({ to, icon: Icon, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon size={16} className="nav-item-icon" />
            {label}
          </NavLink>
        ))}

        <div className="nav-section-label" style={{ marginTop: '8px' }}>SISTEM</div>
        <NavLink
          to="/settings"
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          <Settings size={16} className="nav-item-icon" />
          Pengaturan
        </NavLink>
      </nav>

      {/* Footer Status */}
      <div className="sidebar-footer">
        <div className="system-status">
          <div className="status-dot" />
          <div>
            <div className="status-text">SISTEM AKTIF</div>
            <div className="status-text" style={{ color: 'var(--text-dim)', marginTop: '1px' }}>
              AI ENGINE ONLINE
            </div>
          </div>
          <Activity size={14} style={{ marginLeft: 'auto', color: 'var(--text-muted)', opacity: 0.6 }} />
        </div>

        <div style={{ marginTop: '8px', padding: '0 2px' }}>
          <div style={{ 
            fontSize: '9px', 
            fontFamily: 'var(--font-mono)', 
            color: 'var(--text-dim)',
            letterSpacing: '0.5px',
            lineHeight: '1.5'
          }}>
            PUSSIBERAD TNI AD<br/>
            <span style={{ color: 'var(--narada-red)', opacity: 0.7 }}>CLASSIFICATION: INTERNAL</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ─── Page Title Map ───
const PAGE_TITLES: Record<string, string> = {
  '/': 'Situational Awareness',
  '/analyzer': 'NARADA Multi-Input Analyzer — Sensory Suite',
  '/classifier': 'NARADA Multi-Input Analyzer — Sensory Suite',
  '/profiler': 'NARADA Profiler — Deteksi Bot & Buzzer',
  '/nexus': 'NARADA Nexus — Peta Jaringan Narasi',
  '/reports': 'NARADA Intel Report — Laporan Intelijen',
  '/settings': 'Pengaturan Sistem',
}

// ─── TopBar Component ───
function TopBar() {
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] ?? 'NARADA'
  const [timeStr, setTimeStr] = useState<string>('')
  const [dateStr, setDateStr] = useState<string>('')
  const [isOffline, setIsOffline] = useState<boolean>(() => getUserSettings().offlineMode)
  const [hasCritical, setHasCritical] = useState<boolean>(() => getStoredAnalyses().some(a => a.threatLevel === 'critical'))

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTimeStr(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      setDateStr(now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }))
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)

    const handleSettingsUpdate = () => {
      setIsOffline(getUserSettings().offlineMode)
    }
    const handleAnalysesUpdate = () => {
      setHasCritical(getStoredAnalyses().some(a => a.threatLevel === 'critical'))
    }

    window.addEventListener('narada:settings-updated', handleSettingsUpdate)
    window.addEventListener('narada:analyses-updated', handleAnalysesUpdate)

    return () => {
      clearInterval(timer)
      window.removeEventListener('narada:settings-updated', handleSettingsUpdate)
      window.removeEventListener('narada:analyses-updated', handleAnalysesUpdate)
    }
  }, [])

  return (
    <div className="topbar no-print">
      <div className="topbar-title">{title}</div>
      <div className="topbar-actions">
        {hasCritical && (
          <span
            className="topbar-badge"
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              color: '#EF4444',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              animation: 'pulse-critical 1.5s ease-in-out infinite'
            }}
          >
            ▲ DEFCON 1 ACTIVE
          </span>
        )}

        <span className={`topbar-badge ${isOffline ? 'badge-offline' : 'badge-online'}`}>
          {isOffline ? '◉ OFFLINE AIR-GAPPED' : '● SYSTEM ONLINE'}
        </span>

        <span style={{ 
          fontSize: '11px', 
          fontFamily: 'var(--font-mono)', 
          color: 'var(--text-muted)',
          letterSpacing: '0.5px'
        }}>
          {dateStr ? `${dateStr} — ${timeStr} WIB` : 'SIAGA OPERASIONAL'}
        </span>
      </div>
    </div>
  )
}

// ─── App Shell ───
function AppShell() {
  return (
    <div className="app-layout">
      <div className="hex-bg" />
      <Sidebar />
      <div className="main-content">
        <TopBar />
        <div className="page-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/analyzer" element={<Analyzer />} />
            <Route path="/classifier" element={<Analyzer />} />
            <Route path="/profiler" element={<Profiler />} />
            <Route path="/nexus" element={<Nexus />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </div>
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
