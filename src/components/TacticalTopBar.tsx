import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { PanelLeft } from 'lucide-react'

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
  '/analyzer': {
    title: 'MULTI-INPUT THREAT ANALYZER',
    subtitle: 'ANALISIS KOGNITIF MULTI-MODALITAS: TEKS, CITRA & TAUTAN',
  },
  '/classifier': {
    title: 'MULTI-INPUT THREAT ANALYZER',
    subtitle: 'ANALISIS KOGNITIF MULTI-MODALITAS: TEKS, CITRA & TAUTAN',
  },
  '/social-forensic': {
    title: 'FORENSIK POSTINGAN MEDSOS & BUZZER',
    subtitle: 'DETEKSI ASTROTURFING, SWARM COPYPASTA & ANALISIS SENTIMEN',
  },
  '/profiler': {
    title: 'FORENSIK POSTINGAN MEDSOS & BUZZER',
    subtitle: 'DETEKSI ASTROTURFING, SWARM COPYPASTA & ANALISIS SENTIMEN',
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
}

export default function TacticalTopBar({
  onToggleSidebar,
  isSidebarCollapsed,
}: TacticalTopBarProps) {
  const location = useLocation()
  const pageMeta = PAGE_CONFIG[location.pathname] ?? {
    title: 'SITUATIONAL AWARENESS',
    subtitle: 'ANALISIS | DETEKSI | VERIFIKASI | LINDUNGI INFORMASI',
  }

  const [timeStr, setTimeStr] = useState<string>('')
  const [dateStr, setDateStr] = useState<string>('')

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTimeStr(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      setDateStr(now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }))
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

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

      {/* ─── Kanan: Hanya Waktu ─── */}
      <div className="topbar-time-wrap">
        <span className="topbar-time-text">
          {dateStr ? `${dateStr} — ${timeStr} WIB` : 'SIAGA OPERASIONAL'}
        </span>
      </div>
    </header>
  )
}
