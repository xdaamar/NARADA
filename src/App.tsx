import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Radio,
  ScanText, 
  MessageSquareQuote, 
  FileText, 
  Settings,
  Activity,
  ShieldAlert
} from 'lucide-react'
import Dashboard from './pages/Dashboard'
import LiveRadar from './pages/LiveRadar'
import Analyzer from './pages/Analyzer'
import SocialForensic from './pages/SocialForensic'
import Reports from './pages/Reports'
import SettingsPage from './pages/SettingsPage'
import { getUserSettings, getStoredAnalyses } from './utils/storage'

// ─── Nav Items Config dengan Keyboard Hotkeys ───
const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true, hotkey: 'Alt+1' },
  { to: '/radar', icon: Radio, label: 'Radar Berita Viral', exact: true, hotkey: 'Alt+2' },
  { to: '/analyzer', icon: ScanText, label: 'Multi-Input Analyzer', hotkey: 'Alt+3' },
  { to: '/social-forensic', icon: MessageSquareQuote, label: 'Forensik Medsos & Buzzer', hotkey: 'Alt+4' },
  { to: '/reports', icon: FileText, label: 'Produk Intelijen A4', hotkey: 'Alt+5' },
]

// ─── Sidebar Component ───
function Sidebar() {
  return (
    <aside className="sidebar">
      {/* Header: Crest Garuda Kognitif (40x40px), NARADA, KOGNITIF AI - V1.0 */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon" style={{ background: 'transparent', padding: 0 }}>
          <img 
            src="/image/Electrified%20Golden%20Globe%20Crest.png" 
            alt="NARADA Crest" 
            className="crest-glow"
            style={{ width: '40px', height: '40px', objectFit: 'contain' }} 
          />
        </div>
        <div>
          <div className="sidebar-logo-text">NARADA</div>
          <div className="sidebar-logo-sub">KOGNITIF AI - V1.0</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">
          <span>MODUL UTAMA</span>
          <span style={{ color: 'var(--accent-gold)', fontSize: '10px', letterSpacing: '1px' }}>///</span>
        </div>
        {NAV_ITEMS.map(({ to, icon: Icon, label, exact, hotkey }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon size={16} className="nav-item-icon" />
            <span style={{ flex: 1 }}>{label}</span>
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
          </NavLink>
        ))}

        <div className="nav-section-label" style={{ marginTop: '12px' }}>
          <span>SISTEM</span>
          <span style={{ color: 'var(--accent-gold)', fontSize: '10px', letterSpacing: '1px' }}>///</span>
        </div>
        <NavLink
          to="/settings"
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          <Settings size={16} className="nav-item-icon" />
          Pengaturan
        </NavLink>
      </nav>

      {/* Footer Sidebar */}
      <div className="sidebar-footer">
        <div className="system-status" style={{ background: '#090C10', border: '1px solid #1C2430' }}>
          <div className="status-dot" />
          <div>
            <div className="status-text" style={{ fontWeight: 700, color: '#F1F5F9' }}>SISTEM AKTIF</div>
            <div className="status-text" style={{ color: '#64748B', marginTop: '1px', fontSize: '10px' }}>
              AI ENGINE ONLINE
            </div>
          </div>
          <Activity size={15} style={{ marginLeft: 'auto', color: '#10B981', opacity: 0.85 }} />
        </div>
      </div>
    </aside>
  )
}

// ─── Page Title Map ───
const PAGE_TITLES: Record<string, string> = {
  '/': 'Situational Awareness',
  '/radar': 'Live OSINT Debunk Radar',
  '/analyzer': 'Multi-Input Threat Analyzer',
  '/classifier': 'Multi-Input Threat Analyzer',
  '/social-forensic': 'Forensik Postingan Medsos & Buzzer',
  '/profiler': 'Forensik Postingan Medsos & Buzzer',
  '/nexus': 'Live OSINT Debunk Radar',
  '/reports': 'Produk Intelijen A4',
  '/settings': 'Pengaturan Sistem',
}

// ─── TopBar Component ───
function TopBar() {
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] ?? 'Situational Awareness'
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
    <header className="topbar no-print">
      <div className="topbar-title-wrap">
        <span className="tactical-slashes">///</span>
        <div>
          <div className="topbar-title">{title}</div>
          <div style={{ 
            fontSize: '10px', 
            fontFamily: 'var(--font-mono)', 
            color: '#64748B', 
            letterSpacing: '0.8px',
            lineHeight: 1
          }}>
            ANALISIS | DETEKSI | VERIFIKASI | LINDUNGI INFORMASI
          </div>
        </div>
      </div>

      <div className="topbar-actions">
        {hasCritical && (
          <span
            className="topbar-badge"
            style={{
              background: 'rgba(239, 68, 68, 0.20)',
              color: '#F87171',
              border: '1px solid rgba(239, 68, 68, 0.45)',
              animation: 'pulse-critical 1.5s ease-in-out infinite'
            }}
          >
            <ShieldAlert size={12} />
            DEFCON 1 ACTIVE
          </span>
        )}

        <span className={`topbar-badge ${isOffline ? 'badge-offline' : 'badge-online'}`}>
          <span style={{ 
            width: '6px', 
            height: '6px', 
            borderRadius: '50%', 
            background: isOffline ? '#EF4444' : '#10B981', 
            boxShadow: isOffline ? '0 0 6px #EF4444' : '0 0 6px #10B981',
            display: 'inline-block' 
          }} />
          {isOffline ? 'OFFLINE AIR-GAPPED' : 'SYSTEM ONLINE'}
        </span>

        <span style={{ 
          fontSize: '11px', 
          fontFamily: 'var(--font-mono)', 
          color: '#94A3B8',
          letterSpacing: '0.5px',
          fontWeight: 600
        }}>
          {dateStr ? `${dateStr} — ${timeStr} WIB` : 'SIAGA OPERASIONAL'}
        </span>
      </div>
    </header>
  )
}

// ─── App Shell dengan Hotkey Alt+1 s/d Alt+5 ───
function AppShell() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
          navigate('/analyzer')
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
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <TopBar />
        <main className="page-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/radar" element={<LiveRadar />} />
            <Route path="/analyzer" element={<Analyzer />} />
            <Route path="/classifier" element={<Analyzer />} />
            <Route path="/social-forensic" element={<SocialForensic />} />
            <Route path="/profiler" element={<SocialForensic />} />
            <Route path="/nexus" element={<LiveRadar />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
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
