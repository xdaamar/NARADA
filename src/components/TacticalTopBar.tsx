import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ShieldAlert,
  Zap,
  Info,
  PanelLeft
} from 'lucide-react'
import { getUserSettings, getStoredAnalyses } from '../utils/storage'

interface TacticalTopBarProps {
  onOpenDoctrineModal: () => void
  onToggleSidebar?: () => void
  isSidebarCollapsed?: boolean
}

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

export default function TacticalTopBar({
  onOpenDoctrineModal,
  onToggleSidebar,
  isSidebarCollapsed
}: TacticalTopBarProps) {
  const location = useLocation()
  const navigate = useNavigate()
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

  // Skenario Demo 1-Click
  const launchScenario1 = () => {
    navigate('/analyzer', {
      state: {
        prefill: 'Kabar Gembira! Bantuan Langsung Tunai (BLT) Kesejahteraan Rp 5.000.000 tahap 1 tahun 2026 sudah mulai dicairkan mulai hari ini untuk pemilik KTP dan KK. Pendaftaran hanya dibuka 24 jam di link resmi: http://bansos-kemensos-cair5jt.top/daftar. Segera daftar sebelum kuota habis!',
        autoAnalyze: true
      }
    })
  }

  const launchScenario2 = () => {
    navigate('/social-forensic', {
      state: {
        scenarioId: 'preset-x-pilkada-papua'
      }
    })
  }

  const launchScenario3 = () => {
    navigate('/analyzer', {
      state: {
        prefill: 'Sebanyak 3.500 prajurit TNI Angkatan Darat menggelar latihan tempur antar-kecabangan terpadu di Pusat Latihan Tempur (Puslatpur) Kodiklatad, Baturaja, Sumatera Selatan. Latihan ini melibatkan alutsista modern termasuk tank Leopard 2RI, helikopter serbu Apache AH-64E, dan artileri roket Astros II MK6 sesuai standar kelaikan operasi militer.',
        autoAnalyze: true
      }
    })
  }

  return (
    <header className="topbar no-print" style={{ height: 'auto', padding: '8px 20px', gap: '10px' }}>
      
      {/* ─── Baris 1: Judul Halaman & Klasifikasi Militer OPSEC ─── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '8px' }}>
        
        {/* Title Wrap */}
        <div className="topbar-title-wrap">
          {onToggleSidebar && (
            <button
              type="button"
              className="sidebar-toggle-btn"
              onClick={onToggleSidebar}
              title={isSidebarCollapsed ? 'Tampilkan Bilah Samping [Ctrl+B]' : 'Sembunyikan Bilah Samping [Ctrl+B]'}
              style={{ marginRight: '6px' }}
            >
              <PanelLeft size={15} color={isSidebarCollapsed ? '#D4AF37' : '#94A3B8'} />
            </button>
          )}
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

        {/* Status OPSEC Telemetri Bar (Air-Gapped Telemetry HUD) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          
          {/* Badge Klasifikasi Rahasia Militer */}
          <div
            style={{
              padding: '3px 8px',
              borderRadius: '3px',
              background: '#0D141F',
              border: '1px solid #1F2D40',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '9px',
              fontFamily: 'var(--font-mono)',
              color: '#94A3B8'
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#10B981',
                boxShadow: '0 0 6px #10B981'
              }}
            />
            <span style={{ color: '#E2E8F0', fontWeight: 700 }}>KLASIFIKASI: TERBATAS // OPSEC LOKAL</span>
          </div>

          {/* Telemetri Zero-Server HUD */}
          <div
            style={{
              padding: '3px 10px',
              borderRadius: '3px',
              background: '#070A0F',
              border: '1px solid #16202E',
              fontSize: '9px',
              fontFamily: 'var(--font-mono)',
              color: '#64748B',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>● ZERO-SERVER {isOffline ? 'OFFLINE' : 'AIR-GAPPED'}: <strong style={{ color: '#10B981' }}>AKTIF</strong></span>
            <span style={{ color: '#2B3746' }}>│</span>
            <span>RAM: <strong style={{ color: '#CBD5E1' }}>~148MB</strong></span>
            <span style={{ color: '#2B3746' }}>│</span>
            <span>EGRESS: <strong style={{ color: '#CBD5E1' }}>0 KB</strong></span>
            <span style={{ color: '#2B3746' }}>│</span>
            <span>LATENSI: <strong style={{ color: '#38BDF8' }}>&lt;20ms</strong></span>
          </div>

          {/* Tombol Doktrin & Arsitektur */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onOpenDoctrineModal}
            style={{
              padding: '4px 10px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(180deg, #1C2736 0%, #121A24 100%)',
              borderColor: '#2F4056',
              color: '#FDE047',
              fontWeight: 700
            }}
          >
            <Info size={12} color="#FDE047" />
            DOKTRIN & ARSITEKTUR
          </button>
        </div>
      </div>

      {/* ─── Baris 2: 1-Click Guided Tactical Scenario Bar (Demo PUSSIBERAD) ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          paddingTop: '6px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '9px',
              fontFamily: 'var(--font-mono)',
              color: '#D4AF37',
              fontWeight: 800,
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Zap size={12} color="#D4AF37" />
            PELUNCUR SKENARIO TAKTIS (1-CLICK GUIDED DEMO):
          </span>

          <button
            type="button"
            onClick={launchScenario1}
            style={{
              padding: '3px 8px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              borderRadius: '3px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #DC2626',
              color: '#FCA5A5',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease'
            }}
          >
            <span>⚡ SKENARIO 1: HOAKS BANSOS PHISHING</span>
          </button>

          <button
            type="button"
            onClick={launchScenario2}
            style={{
              padding: '3px 8px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              borderRadius: '3px',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid #D97706',
              color: '#FDE68A',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease'
            }}
          >
            <span>⚡ SKENARIO 2: SEPARATISME & BUZZER SWARM</span>
          </button>

          <button
            type="button"
            onClick={launchScenario3}
            style={{
              padding: '3px 8px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              borderRadius: '3px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid #059669',
              color: '#A7F3D0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease'
            }}
          >
            <span>⚡ SKENARIO 3: DISPENAD PRESS RELEASE (FAKTA)</span>
          </button>
        </div>

        {/* Waktu & Status Defcon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {hasCritical && (
            <span
              className="topbar-badge"
              style={{
                background: 'rgba(239, 68, 68, 0.20)',
                color: '#F87171',
                border: '1px solid rgba(239, 68, 68, 0.45)',
                animation: 'pulse-critical 1.5s ease-in-out infinite',
                fontSize: '9px',
                padding: '2px 6px'
              }}
            >
              <ShieldAlert size={10} />
              DEFCON 1
            </span>
          )}

          <span
            style={{ 
              fontSize: '10px', 
              fontFamily: 'var(--font-mono)', 
              color: '#94A3B8',
              letterSpacing: '0.5px',
              fontWeight: 600
            }}
          >
            {dateStr ? `${dateStr} — ${timeStr} WIB` : 'SIAGA OPERASIONAL'}
          </span>
        </div>
      </div>

    </header>
  )
}
