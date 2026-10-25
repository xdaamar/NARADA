import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import {
  AlertTriangle,
  Shield,
  ShieldAlert,
  Eye,
  TrendingUp,
  Activity,
  Zap,
  ArrowRight,
  Sparkles,
  Server,
  Layers,
  ChevronRight,
  Globe,
  PieChart as PieChartIcon,
  Radio,
  X
} from 'lucide-react'
import type { AnalysisResult, ContentCategory } from '../types'
import { getStoredAnalyses, seedDemoAnalyses } from '../utils/storage'
import { getCategoryBadge, getThreatBadge, formatMilitaryDate, truncateText } from '../utils/format'

// ─── Kategori & Konfigurasi Warna Taktis Plat Baja ───
const CATEGORY_COLORS: Record<ContentCategory, string> = {
  HOAKS: '#EF4444',
  PROPAGANDA: '#F97316',
  BUZZER: '#F59E0B',
  DISINFORMASI: '#A855F7',
  NETRAL: '#10B981',
}

// ─── Mini Bar Chart Indicator Komponen ───
function MiniBarIndicator({ color }: { color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '20px', flexShrink: 0 }}>
      <div style={{ width: '4px', height: '40%', background: color, borderRadius: '1px', opacity: 0.35 }} />
      <div style={{ width: '4px', height: '70%', background: color, borderRadius: '1px', opacity: 0.55 }} />
      <div style={{ width: '4px', height: '50%', background: color, borderRadius: '1px', opacity: 0.75 }} />
      <div style={{ width: '4px', height: '95%', background: color, borderRadius: '1px', opacity: 1 }} />
      <div style={{ width: '4px', height: '65%', background: color, borderRadius: '1px', opacity: 0.65 }} />
    </div>
  )
}

// ─── Stat Card Plat Baja Taktis dengan Corner Crosshairs (+) & Rivets ───
interface StatCardProps {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  accentColor: string
  iconBg: string
  milspecCode?: string
  pulse?: boolean
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  sub, 
  accentColor, 
  iconBg,
  milspecCode,
  pulse = false 
}: StatCardProps) {
  return (
    <div
      className="steel-chassis-card card-crosshairs"
      style={{
        padding: '18px 20px',
        position: 'relative',
        boxShadow: pulse ? '0 10px 25px rgba(0, 0, 0, 0.75), 0 0 14px rgba(239, 68, 68, 0.25)' : '0 10px 25px rgba(0, 0, 0, 0.75)',
      }}
    >
      <span className="bolt-tl" />
      <span className="bolt-tr" />
      <span className="bolt-bl" />
      <span className="bolt-br" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '6px',
            background: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            border: `1px solid ${accentColor}40`,
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)'
          }}>
            <Icon size={18} color={accentColor} />
          </div>
          <div className="stat-label" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
            {label}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {milspecCode && (
            <span className="milspec-stamp" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748B' }}>
              {pulse && (
                <span style={{ 
                  width: 6, 
                  height: 6, 
                  borderRadius: '50%', 
                  background: '#EF4444', 
                  display: 'inline-block', 
                  boxShadow: '0 0 6px #EF4444',
                  animation: 'pulse-critical 1.5s infinite' 
                }} />
              )}
              {milspecCode}
            </span>
          )}
          <MiniBarIndicator color={accentColor} />
        </div>
      </div>

      <div className="stat-number" style={{ color: 'var(--text-primary)', fontSize: '32px', lineHeight: '1', fontWeight: 800 }}>
        {value}
      </div>

      {sub && (
        <div style={{ marginTop: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [analyses, setAnalyses] = useState<AnalysisResult[]>(() => getStoredAnalyses())
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('')
  const [timelineFilter, setTimelineFilter] = useState<'24H' | '7D' | '30D'>('24H')

  // Filter Kategori dari Klik Donut / Legend
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<ContentCategory | null>(null)

  // Sinkronisasi data real-time & timer jam militer
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTimeStr(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }
    updateTime()

    const interval = setInterval(() => {
      updateTime()
      setAnalyses(getStoredAnalyses())
    }, 5000)

    const handleUpdateEvent = (e: Event) => {
      const custom = e as CustomEvent<AnalysisResult[]>
      if (custom.detail) {
        setAnalyses(custom.detail)
      } else {
        setAnalyses(getStoredAnalyses())
      }
    }

    window.addEventListener('narada:analyses-updated', handleUpdateEvent)

    return () => {
      clearInterval(interval)
      window.removeEventListener('narada:analyses-updated', handleUpdateEvent)
    }
  }, [])

  // Kalkulasi statistik
  const totalAnalyses = analyses.length
  const threatItems = useMemo(() => analyses.filter(a => a.category !== 'NETRAL'), [analyses])
  const criticalItems = useMemo(() => analyses.filter(a => a.threatLevel === 'critical'), [analyses])
  const highItems = useMemo(() => analyses.filter(a => a.threatLevel === 'high'), [analyses])

  // DEFCON Status Reaktif
  const defconStatus = useMemo(() => {
    if (criticalItems.length > 0) {
      return { 
        level: 1, 
        label: `DEFCON 1 [SIAGA KRITIS: ${criticalItems.length}]`, 
        color: '#EF4444', 
        bg: 'rgba(239, 68, 68, 0.20)', 
        border: 'rgba(239, 68, 68, 0.50)' 
      }
    }
    if (highItems.length > 0) {
      return { 
        level: 2, 
        label: `DEFCON 2 [SIAGA TINGGI: ${highItems.length}]`, 
        color: '#F97316', 
        bg: 'rgba(249, 115, 22, 0.20)', 
        border: 'rgba(249, 115, 22, 0.50)' 
      }
    }
    if (threatItems.length > 0) {
      return { 
        level: 3, 
        label: `DEFCON 3 [SIAGA WASPADA: ${threatItems.length}]`, 
        color: '#F59E0B', 
        bg: 'rgba(245, 158, 11, 0.20)', 
        border: 'rgba(245, 158, 11, 0.50)' 
      }
    }
    return { 
      level: 5, 
      label: 'DEFCON 5 [SIAGA NORMAL]', 
      color: '#10B981', 
      bg: 'rgba(16, 185, 129, 0.20)', 
      border: 'rgba(16, 185, 129, 0.50)' 
    }
  }, [criticalItems.length, highItems.length, threatItems.length])

  // Data Timeline Eskalasi Ancaman Dinamis
  const timelineData = useMemo(() => {
    if (analyses.length === 0) {
      return [
        { time: '00:00', critical: 0, high: 0, medium: 0, low: 0 },
        { time: '06:00', critical: 0, high: 0, medium: 0, low: 0 },
        { time: '12:00', critical: 0, high: 0, medium: 0, low: 0 },
        { time: '18:00', critical: 0, high: 0, medium: 0, low: 0 },
        { time: 'Now',   critical: 0, high: 0, medium: 0, low: 0 },
      ]
    }

    const sorted = [...analyses].sort((a, b) => a.timestamp - b.timestamp)
    let c = 0, h = 0, m = 0, l = 0

    return sorted.map((item, idx) => {
      if (item.threatLevel === 'critical') c++
      else if (item.threatLevel === 'high') h++
      else if (item.threatLevel === 'medium') m++
      else l++

      const dateObj = new Date(item.timestamp)
      const timeStr = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`

      return {
        time: `#${idx + 1} (${timeStr})`,
        critical: c,
        high: h,
        medium: m,
        low: l,
      }
    })
  }, [analyses])

  // Data Distribusi Kategori Dinamis
  const categoryChartData = useMemo(() => {
    const cats: ContentCategory[] = ['HOAKS', 'PROPAGANDA', 'BUZZER', 'DISINFORMASI', 'NETRAL']
    const counts = analyses.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + 1
      return acc
    }, {} as Record<ContentCategory, number>)

    if (totalAnalyses === 0) {
      return cats.map(c => ({
        name: c,
        value: 0,
        pct: 0,
        color: CATEGORY_COLORS[c],
      }))
    }

    return cats.map(c => {
      const val = counts[c] || 0
      const pct = Math.round((val / totalAnalyses) * 100)
      return {
        name: c,
        value: val,
        pct,
        color: CATEGORY_COLORS[c],
      }
    })
  }, [analyses, totalAnalyses])

  // Saring Riwayat Live Feed berdasarkan Filter Kategori
  const filteredThreatFeed = useMemo(() => {
    let items = threatItems
    if (selectedCategoryFilter) {
      items = items.filter(a => a.category === selectedCategoryFilter)
    }
    return items
  }, [threatItems, selectedCategoryFilter])

  // Saring baris untuk Incident & Cognitive Triage Ledger (Tabel Telemetri)
  const triageLedgerRows = useMemo(() => {
    const items = analyses.length > 0 ? analyses : []
    if (selectedCategoryFilter) {
      return items.filter(a => a.category === selectedCategoryFilter)
    }
    return items
  }, [analyses, selectedCategoryFilter])

  const handleSeedDemo = () => {
    seedDemoAnalyses()
  }

  return (
    <div style={{ paddingBottom: '32px' }}>
      {/* ─── 1. Header Situational Awareness Command (Tactical Armored Steel) ─── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 'var(--radius-pill)',
              background: 'rgba(239, 68, 68, 0.18)',
              color: '#F87171',
              border: '1px solid rgba(239, 68, 68, 0.45)',
              letterSpacing: '1px',
              textTransform: 'uppercase'
            }}>
              SITUATIONAL AWARENESS COMMAND
            </span>
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 'var(--radius-pill)',
              background: '#141B24',
              color: '#94A3B8',
              border: '1px solid #2D3848',
              letterSpacing: '0.8px'
            }}>
              PUSSIBERAD TNI AD
            </span>
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '28px',
            fontWeight: 800,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            color: '#F1F5F9',
            lineHeight: 1.15
          }}>
            Cognitive Threat Situational Awareness
          </h1>
          <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>
            Pusat komando pemantauan ancaman kognitif, disinformasi, dan kampanye manipulasi siber waktu nyata.
          </p>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'linear-gradient(160deg, #1C2430 0%, #121822 100%)',
          padding: '8px 14px',
          borderRadius: 'var(--radius-pill)',
          borderTop: '1px solid var(--border-steel-light)',
          borderLeft: '1px solid var(--border-steel-light)',
          borderRight: '1px solid var(--border-steel-dark)',
          borderBottom: '1px solid var(--border-steel-dark)',
          boxShadow: 'var(--shadow-steel-plate)'
        }}>
          <Globe size={14} color="#3B82F6" />
          <span style={{
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            color: '#F1F5F9',
            fontWeight: 600,
            letterSpacing: '0.5px'
          }}>
            {currentTimeStr ? `${currentTimeStr} WIB` : 'SIAGA OPERASIONAL'}
          </span>
        </div>
      </div>

      {/* ─── 2. DYNAMIC TELEMETRY RIBBON PLAT BAJA (36px High-Density Micro-Stream) ─── */}
      <div 
        className="steel-chassis-card"
        style={{
          padding: '8px 18px',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <span className="bolt-tl" />
        <span className="bolt-tr" />
        <span className="bolt-bl" />
        <span className="bolt-br" />
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {/* DEFCON Dynamic Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 8px',
            borderRadius: '4px',
            background: defconStatus.bg,
            border: `1px solid ${defconStatus.border}`,
            color: defconStatus.color,
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: defconStatus.color,
              boxShadow: `0 0 6px ${defconStatus.color}`,
              animation: defconStatus.level <= 2 ? 'pulse-critical 1.5s infinite' : undefined
            }} />
            {defconStatus.label}
          </div>

          {/* Node Sensor */}
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Radio size={12} color="#3B82F6" />
            <span>NODE: <strong style={{ color: '#F1F5F9' }}>42 TITIK AKTIF</strong></span>
            <span style={{ color: '#2D3848' }}>│</span>
            <span>INGESTION: <strong style={{ color: '#D4A017' }}>3.4/MENIT</strong></span>
          </div>

          {/* Latensi Pipeline */}
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#94A3B8' }}>
            LATENSI: <span style={{ color: '#10B981', fontWeight: 700 }}>18ms</span> (HYBRID ML 60% + RULES 40%)
          </div>

          {/* Integritas Data */}
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#94A3B8' }}>
            INTEGRITAS: <span style={{ color: '#3B82F6', fontWeight: 700 }}>94.2%</span> [STABIL]
          </div>
        </div>

        {/* Quick Triage CTA */}
        <button
          type="button"
          onClick={() => navigate('/analyzer')}
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            color: '#F87171',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '4px',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)'
            e.currentTarget.style.borderColor = '#EF4444'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)'
          }}
        >
          [ANALISIS CEPAT →]
        </button>
      </div>

      {/* ─── 3. DUAL SECTOR: ACTIVE INCIDENT TRIAGE LEDGER (65%) & CEW INDEX + DONUT (35%) ─── */}
      <div className="grid-2 mb-4" style={{ gridTemplateColumns: '1.72fr 1fr', gap: '16px', marginBottom: '20px' }}>
        
        {/* MODUL UTAMA 1: ACTIVE INCIDENT & COGNITIVE TRIAGE LEDGER (Peta Radar Dihapus Sesuai Instruksi Sprint 5C & 5D) */}
        <div className="steel-chassis-card" style={{ padding: '16px 20px' }}>
          <span className="bolt-tl" />
          <span className="bolt-tr" />
          <span className="bolt-bl" />
          <span className="bolt-br" />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={16} color="#EF4444" />
              <span style={{ fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: 800, color: '#F1F5F9', letterSpacing: '0.8px' }}>
                ACTIVE INCIDENT & COGNITIVE TRIAGE LEDGER
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {selectedCategoryFilter && (
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter(null)}
                  style={{
                    background: 'rgba(239, 68, 68, 0.20)',
                    border: '1px solid #EF4444',
                    color: '#FCA5A5',
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                  title="Batalkan saringan kategori"
                >
                  <X size={10} /> {selectedCategoryFilter} [×]
                </button>
              )}
              <span className="milspec-stamp" style={{ color: '#D4A017' }}>
                [STREAM // {triageLedgerRows.length} INSIDEN]
              </span>
            </div>
          </div>

          {/* Table Container dengan Efek Steel Sunken Tray */}
          <div className="steel-sunken-tray" style={{ padding: '4px', overflowX: 'auto', minHeight: '330px' }}>
            {triageLedgerRows.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                <Shield size={34} color="#10B981" style={{ margin: '0 auto 10px', display: 'block', opacity: 0.8 }} />
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#F1F5F9' }}>Belum Ada Insiden Terdaftar di Sesi Ini</div>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px', maxWidth: '440px', margin: '4px auto 14px' }}>
                  Seluruh telemetri insiden kognitif yang dianalisis akan tercatat otomatis di ledger ini.
                </div>
                <button
                  type="button"
                  onClick={handleSeedDemo}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '4px',
                    background: '#C8102E',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <Sparkles size={12} style={{ display: 'inline', marginRight: 4 }} /> Muat Sampel Skenario Taktis (5 Isu)
                </button>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1E2734', color: '#94A3B8', textAlign: 'left', fontFamily: 'var(--font-mono)' }}>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>WAKTU WIB</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>VEKTOR ASAL</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>ISU / KLAIM KOGNITIF</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>VONIS & SKOR AI</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>STATUS TRIAGE</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {triageLedgerRows.slice(0, 7).map((item, idx) => {
                    const dateObj = new Date(item.timestamp)
                    const timeStr = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}:${String(dateObj.getSeconds()).padStart(2, '0')} WIB`
                    
                    const vectorBadge = item.inputSource === 'ocr'
                      ? { label: 'OCR SCREENSHOT', bg: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA', border: 'rgba(59, 130, 246, 0.4)' }
                      : item.inputSource === 'url'
                      ? { label: 'BERITA DARING', bg: 'rgba(212, 160, 23, 0.15)', color: '#FBBF24', border: 'rgba(212, 160, 23, 0.4)' }
                      : idx % 2 === 0
                      ? { label: 'URL MEDSOS', bg: 'rgba(168, 85, 247, 0.15)', color: '#C084FC', border: 'rgba(168, 85, 247, 0.4)' }
                      : { label: 'TEKS TERBUKA', bg: 'rgba(148, 163, 184, 0.15)', color: '#CBD5E1', border: 'rgba(148, 163, 184, 0.4)' }

                    const catBadge = getCategoryBadge(item.category)
                    const scorePct = Math.round(item.confidence || 85)

                    const triageState = item.threatLevel === 'critical'
                      ? { label: 'ESKALASI DISPENAD', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.2)' }
                      : item.threatLevel === 'high'
                      ? { label: 'VALIDASI SATGAS', color: '#F97316', bg: 'rgba(249, 115, 22, 0.2)' }
                      : item.threatLevel === 'medium'
                      ? { label: 'PANTAUAN KHUSUS', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.2)' }
                      : { label: 'TERVERIFIKASI', color: '#10B981', bg: 'rgba(16, 185, 129, 0.2)' }

                    return (
                      <tr 
                        key={item.id}
                        style={{
                          borderBottom: '1px solid #141C26',
                          transition: 'background 0.15s ease',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#141C26')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', color: '#94A3B8', whiteSpace: 'nowrap' }}>
                          {timeStr}
                        </td>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                          <span style={{
                            fontSize: '9px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            padding: '2px 5px',
                            borderRadius: '3px',
                            background: vectorBadge.bg,
                            color: vectorBadge.color,
                            border: `1px solid ${vectorBadge.border}`
                          }}>
                            {vectorBadge.label}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', color: '#F1F5F9', fontWeight: 600, maxWidth: '220px' }}>
                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {truncateText(item.input || item.rawContent || '', 52)}
                          </div>
                        </td>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                          <span style={{
                            fontSize: '10px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            color: catBadge.color
                          }}>
                            {item.category} ({scorePct}%)
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                          <span style={{
                            fontSize: '9px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '3px',
                            background: triageState.bg,
                            color: triageState.color
                          }}>
                            {triageState.label}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate('/analyzer', { state: { prefill: item.input || item.rawContent || '' } })
                            }}
                            style={{
                              background: 'transparent',
                              border: '1px solid #2D3848',
                              color: '#F87171',
                              fontSize: '9px',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = '#EF4444'
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = '#2D3848'
                              e.currentTarget.style.background = 'transparent'
                            }}
                          >
                            [INSPEKSI →]
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* MODUL UTAMA 2: COGNITIVE WARFARE INDEX & MACHINED DIAL DONUT (35%) */}
        <div className="steel-chassis-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <span className="bolt-tl" />
          <span className="bolt-tr" />
          <span className="bolt-bl" />
          <span className="bolt-br" />
          
          {/* A. 3 Chunky Mechanical LED Indicators */}
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={14} color="#EF4444" />
                <span style={{ fontSize: '12px', fontFamily: 'var(--font-display)', fontWeight: 800, color: '#F1F5F9', letterSpacing: '0.8px' }}>
                  COGNITIVE WARFARE (CEW) INDEX
                </span>
              </div>
              <span className="milspec-stamp" style={{ color: '#D4A017' }}>[CEW-MATRIX]</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* LED Bar 1: Polarisasi Opini (HIGH - Crimson) */}
              <div className="chunky-led-tray">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#94A3B8' }}>
                    POLARIZATION PRESSURE
                  </span>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#EF4444' }}>
                    78% · HIGH (OPINI PUBLIK)
                  </span>
                </div>
                <div className="chunky-led-bar">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className={`chunky-led-cell ${i < 8 ? 'led-active-crimson' : ''}`}
                    />
                  ))}
                </div>
              </div>

              {/* LED Bar 2: Buzzer Swarm Coordination (MEDIUM - Amber) */}
              <div className="chunky-led-tray">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#94A3B8' }}>
                    BUZZER SWARM COORDINATION
                  </span>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F59E0B' }}>
                    64% · MEDIUM (BOTNET)
                  </span>
                </div>
                <div className="chunky-led-bar">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className={`chunky-led-cell ${i < 6 ? 'led-active-amber' : ''}`}
                    />
                  ))}
                </div>
              </div>

              {/* LED Bar 3: Narrative Mutation Velocity (LOW - Green) */}
              <div className="chunky-led-tray">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#94A3B8' }}>
                    NARRATIVE MUTATION VELOCITY
                  </span>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#10B981' }}>
                    4.2 KLAIM/JAM · LOW
                  </span>
                </div>
                <div className="chunky-led-bar">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className={`chunky-led-cell ${i < 4 ? 'led-active-green' : ''}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Divider Garis Baja */}
          <div style={{ height: '1px', background: '#2D3848', margin: '2px 0' }} />

          {/* B. Machined Dial Ring Donut Chart dengan Logo Resmi 46px Konsentris */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PieChartIcon size={14} color="#D4A017" />
                <span style={{ fontSize: '12px', fontFamily: 'var(--font-display)', fontWeight: 800, color: '#F1F5F9', letterSpacing: '0.8px' }}>
                  DISTRIBUSI 5 KATEGORI KOGNITIF
                </span>
              </div>
              <span className="milspec-stamp" style={{ color: '#94A3B8' }}>
                {totalAnalyses} KONTEN
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Machined Dial Bezel Ring Logam Lingkaran Konsentris V2 */}
              <div className="machined-dial-bezel-v2">
                {/* Layer 1: Outer Rotating Dashed Reticle (Pas Presisi di radius 72px) */}
                <svg
                  width="160"
                  height="160"
                  viewBox="0 0 160 160"
                  style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 }}
                  className="tactical-spin-slow"
                >
                  <circle cx="80" cy="80" r="72" fill="none" stroke="#D4A017" strokeWidth="1.2" strokeDasharray="5 6" opacity="0.75" />
                  <circle cx="80" cy="80" r="74" fill="none" stroke="#475569" strokeWidth="0.5" opacity="0.4" />
                </svg>

                {/* Layer 2: Inner Rotating Degree Reticle (Pas Presisi di radius 46px) */}
                <svg
                  width="160"
                  height="160"
                  viewBox="0 0 160 160"
                  style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 }}
                  className="tactical-spin-reverse"
                >
                  <circle cx="80" cy="80" r="46" fill="none" stroke="#94A3B8" strokeWidth="1" strokeDasharray="3 4" opacity="0.6" />
                  <line x1="80" y1="30" x2="80" y2="36" stroke="#D4A017" strokeWidth="1.5" />
                  <line x1="80" y1="124" x2="80" y2="130" stroke="#D4A017" strokeWidth="1.5" />
                  <line x1="30" y1="80" x2="36" y2="80" stroke="#D4A017" strokeWidth="1.5" />
                  <line x1="124" y1="80" x2="130" y2="80" stroke="#D4A017" strokeWidth="1.5" />
                </svg>

                {/* Layer 3: Flowing Light Sweep Beam */}
                <div style={{
                  position: 'absolute',
                  top: '4px',
                  left: '4px',
                  width: '152px',
                  height: '152px',
                  borderRadius: '50%',
                  background: 'conic-gradient(from 0deg, transparent 0deg, rgba(212, 160, 23, 0.18) 60deg, transparent 90deg)',
                  pointerEvents: 'none',
                  zIndex: 2,
                  animation: 'tactical-radar-sweep 8s linear infinite'
                }} />

                {/* Layer 4: Recharts Pie Chart (Pas di antara radius 50 dan 70) */}
                <div style={{ width: '160px', height: '160px', position: 'relative', zIndex: 3 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={totalAnalyses === 0 ? [{ name: 'KOSONG', value: 1, color: '#1B232E', pct: 0 }] : categoryChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                        style={{ cursor: 'pointer' }}
                        onClick={(data) => {
                          if (data && data.name && data.name !== 'KOSONG') {
                            setSelectedCategoryFilter(selectedCategoryFilter === data.name ? null : data.name as ContentCategory)
                          }
                        }}
                      >
                        {(totalAnalyses === 0 ? [{ color: '#1B232E', name: 'KOSONG' as any, value: 1, pct: 100 }] : categoryChartData).map((entry, i) => (
                          <Cell 
                            key={i} 
                            fill={entry.color} 
                            stroke={selectedCategoryFilter === entry.name ? '#F1F5F9' : '#090C10'}
                            strokeWidth={selectedCategoryFilter === entry.name ? 2 : 1}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: '#141B24',
                          border: '1px solid #2D3848',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontFamily: 'var(--font-mono)',
                          color: '#F1F5F9'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Layer 5: Logo Resmi Proyek (Pas di Pusat innerRadius 50) */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, #1A232E 50%, #0D1218 100%)',
                  boxShadow: '0 0 10px rgba(0,0,0,0.8), inset 0 0 6px rgba(212, 160, 23, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  zIndex: 4
                }}>
                  <img
                    src="/image/Electrified%20Golden%20Globe%20Crest.png"
                    alt="Official Project Crest"
                    style={{ width: '34px', height: '34px', objectFit: 'contain' }}
                  />
                </div>
              </div>

              {/* Legend List Sisi Kanan dengan Click-to-Filter */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {categoryChartData.map(d => {
                  const isSelected = selectedCategoryFilter === d.name
                  return (
                    <div
                      key={d.name}
                      onClick={() => setSelectedCategoryFilter(isSelected ? null : d.name as ContentCategory)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '3px 6px',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(239, 68, 68, 0.20)' : 'transparent',
                        border: isSelected ? '1px solid #EF4444' : '1px solid transparent',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = '#171F2A'
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent'
                      }}
                      title="Klik untuk menyaring riwayat berdasarkan kategori ini"
                    >
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: isSelected ? '#FCA5A5' : '#94A3B8', flex: 1, fontWeight: isSelected ? 700 : 500 }}>
                        {d.name}
                      </span>
                      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: d.color }}>
                        {d.value}
                      </span>
                      <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748B', width: '28px', textAlign: 'right' }}>
                        {d.pct}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 4. EMPAT KARTU STATISTIK PLAT BAJA DENGAN CORNER CROSSHAIRS (+) & BAUT RIVETS ─── */}
      <div className="grid-4 mb-4" style={{ marginBottom: '20px' }}>
        <StatCard
          icon={Eye}
          label="TOTAL KONTEN DIANALISIS"
          value={totalAnalyses}
          sub="SESI PEMANTAUAN AKTIF"
          accentColor="#3B82F6"
          iconBg="rgba(59, 130, 246, 0.15)"
          milspecCode="SESS // 0x4A1"
        />
        <StatCard
          icon={AlertTriangle}
          label="ANCAMAN TERDETEKSI"
          value={threatItems.length}
          sub={`${totalAnalyses > 0 ? Math.round((threatItems.length / totalAnalyses) * 100) : 0}% DARI TOTAL KONTEN`}
          accentColor="#F59E0B"
          iconBg="rgba(245, 158, 11, 0.15)"
          milspecCode="RISK // DET-RATE"
        />
        <StatCard
          icon={Zap}
          label="ANCAMAN KRITIS (CRITICAL)"
          value={criticalItems.length}
          sub="PERLU ESKALASI DISPENAD"
          accentColor="#EF4444"
          iconBg="rgba(239, 68, 68, 0.15)"
          milspecCode="DEFCON // ESC-1"
          pulse={criticalItems.length > 0}
        />
        <StatCard
          icon={TrendingUp}
          label="ANCAMAN TINGGI (HIGH)"
          value={highItems.length}
          sub="PRIORITAS PANTAUAN KHUSUS"
          accentColor="#F97316"
          iconBg="rgba(249, 115, 22, 0.15)"
          milspecCode="PRIO // LEVEL-2"
        />
      </div>

      {/* ─── 5. BARIS: TIMELINE ESKALASI ANCAMAN (DARK GUNMETAL) & TACTICAL QUICK LAUNCHPAD ─── */}
      <div className="grid-2 mb-4" style={{ gridTemplateColumns: '1.6fr 1.4fr', gap: '16px', marginBottom: '20px' }}>
        {/* Timeline Chart Gunmetal */}
        <div className="steel-chassis-card" style={{ padding: '16px 20px', position: 'relative' }}>
          <span className="bolt-tl" />
          <span className="bolt-tr" />
          <span className="bolt-bl" />
          <span className="bolt-br" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={15} color="#EF4444" />
              <div style={{ fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: 800, color: '#F1F5F9', letterSpacing: '0.8px' }}>
                TREN AKUMULASI ANCAMAN KOGNITIF (TIMELINE)
              </div>
            </div>

            {/* Filter Pill Buttons [24H] [7D] [30D] */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {(['24H', '7D', '30D'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setTimelineFilter(f)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    border: '1px solid',
                    borderColor: timelineFilter === f ? '#EF4444' : '#2D3848',
                    background: timelineFilter === f ? 'rgba(239, 68, 68, 0.25)' : '#141B24',
                    color: timelineFilter === f ? '#FCA5A5' : '#94A3B8',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Peak Anomaly Callout Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
            padding: '4px 10px',
            background: 'rgba(239, 68, 68, 0.12)',
            borderRadius: '4px',
            border: '1px solid rgba(239, 68, 68, 0.35)'
          }}>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#FCA5A5', fontWeight: 700 }}>
              PEAK ANOMALI: HOAKS ALUTSISTA (14:00 WIB)
            </span>
            <span className="milspec-stamp" style={{ color: '#EF4444' }}>
              DELTA +180%
            </span>
          </div>

          <div style={{ height: 190 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" />
                <XAxis
                  dataKey="time"
                  tick={{ fill: '#64748B', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  axisLine={{ stroke: '#2D3848' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#64748B', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  axisLine={{ stroke: '#2D3848' }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#141B24',
                    border: '1px solid #2D3848',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    boxShadow: 'var(--shadow-steel-plate)',
                    color: '#F1F5F9'
                  }}
                />
                <Line type="monotone" dataKey="critical" stroke="#EF4444" strokeWidth={2.5} dot={{ r: 3, fill: '#EF4444' }} name="Hoaks" />
                <Line type="monotone" dataKey="high" stroke="#F97316" strokeWidth={2} dot={{ r: 3, fill: '#F97316' }} name="Propaganda" />
                <Line type="monotone" dataKey="medium" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3, fill: '#F59E0B' }} name="Buzzer" />
                <Line type="monotone" dataKey="low" stroke="#10B981" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Netral" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Legend Taktis */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '16px',
            marginTop: '8px',
            paddingTop: '6px',
            borderTop: '1px solid #1E2734'
          }}>
            {[
              { label: 'Hoaks', color: '#EF4444' },
              { label: 'Propaganda', color: '#F97316' },
              { label: 'Buzzer', color: '#F59E0B' },
              { label: 'Disinfo', color: '#A855F7' },
              { label: 'Netral', color: '#10B981' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: item.color }} />
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#94A3B8', fontWeight: 500 }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Tactical Quick Launchpad (3 Kartu Aksi Ber-Baut Plat Baja) */}
        <div className="steel-chassis-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
          <span className="bolt-tl" />
          <span className="bolt-tr" />
          <span className="bolt-bl" />
          <span className="bolt-br" />
          <div style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            letterSpacing: '1.2px',
            color: '#94A3B8',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Zap size={14} color="#EF4444" /> TACTICAL QUICK LAUNCHPAD (AKSI CEPAT)
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Card 1 */}
            <div
              onClick={() => navigate('/analyzer')}
              style={{
                padding: '12px 14px',
                background: 'linear-gradient(160deg, #1A232E 0%, #111720 100%)',
                border: '1px solid #2D3848',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#EF4444'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#2D3848'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 34, height: 34, borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Zap size={16} color="#EF4444" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#F1F5F9' }}>1. Multi-Input Analyzer</span>
                    <span style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', background: 'rgba(16, 185, 129, 0.2)', color: '#10B981', padding: '1px 4px', borderRadius: '2px', fontWeight: 700 }}>
                      LSTM READY
                    </span>
                  </div>
                  <div style={{ fontSize: '9px', color: '#64748B', marginTop: '2px', display: 'flex', gap: '4px' }}>
                    <span style={{ background: '#0C1016', padding: '1px 4px', borderRadius: '2px', border: '1px solid #1E2734' }}>[TEKS]</span>
                    <span style={{ background: '#0C1016', padding: '1px 4px', borderRadius: '2px', border: '1px solid #1E2734' }}>[OCR]</span>
                    <span style={{ background: '#0C1016', padding: '1px 4px', borderRadius: '2px', border: '1px solid #1E2734' }}>[URL]</span>
                  </div>
                </div>
              </div>
              <ArrowRight size={14} color="#64748B" />
            </div>

            {/* Card 2 */}
            <div
              onClick={() => navigate('/radar')}
              style={{
                padding: '12px 14px',
                background: 'linear-gradient(160deg, #1A232E 0%, #111720 100%)',
                border: '1px solid #2D3848',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3B82F6'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#2D3848'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 34, height: 34, borderRadius: '6px', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Radio size={16} color="#3B82F6" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#F1F5F9' }}>2. Radar Berita Viral</span>
                    <span style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', background: 'rgba(59, 130, 246, 0.2)', color: '#3B82F6', padding: '1px 4px', borderRadius: '2px', fontWeight: 700 }}>
                      LIVE OSINT
                    </span>
                  </div>
                  <div style={{ fontSize: '9px', color: '#64748B', marginTop: '2px', display: 'flex', gap: '4px' }}>
                    <span style={{ background: '#0C1016', padding: '1px 4px', borderRadius: '2px', border: '1px solid #1E2734' }}>[AUTO SYNC]</span>
                    <span style={{ background: '#0C1016', padding: '1px 4px', borderRadius: '2px', border: '1px solid #1E2734' }}>[5 KLASTER NASIONAL]</span>
                  </div>
                </div>
              </div>
              <ArrowRight size={14} color="#64748B" />
            </div>

            {/* Card 3 */}
            <div
              onClick={() => navigate('/reports')}
              style={{
                padding: '12px 14px',
                background: 'linear-gradient(160deg, #1A232E 0%, #111720 100%)',
                border: '1px solid #2D3848',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#10B981'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#2D3848'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 34, height: 34, borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Layers size={16} color="#10B981" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#F1F5F9' }}>3. Produk Intelijen A4</span>
                    <span style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', background: 'rgba(16, 185, 129, 0.2)', color: '#10B981', padding: '1px 4px', borderRadius: '2px', fontWeight: 700 }}>
                      DISPENAD OPORD
                    </span>
                  </div>
                  <div style={{ fontSize: '9px', color: '#64748B', marginTop: '2px', display: 'flex', gap: '4px' }}>
                    <span style={{ background: '#0C1016', padding: '1px 4px', borderRadius: '2px', border: '1px solid #1E2734' }}>[PDF A4]</span>
                    <span style={{ background: '#0C1016', padding: '1px 4px', borderRadius: '2px', border: '1px solid #1E2734' }}>[SHA-256 STEMPEL]</span>
                  </div>
                </div>
              </div>
              <ArrowRight size={14} color="#64748B" />
            </div>
          </div>
        </div>
      </div>

      {/* ─── 6. BARIS BAWAH: LIVE COGNITIVE FEED & STATUS KESIAPAN SISTEM ─── */}
      <div className="grid-2" style={{ gridTemplateColumns: '1.4fr 1fr', gap: '16px' }}>
        {/* Live Feed Ancaman */}
        <div className="steel-chassis-card" style={{ padding: '16px 20px', position: 'relative' }}>
          <span className="bolt-tl" />
          <span className="bolt-tr" />
          <span className="bolt-bl" />
          <span className="bolt-br" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={14} color="#F97316" />
              <div style={{ fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: 800, color: '#F1F5F9', letterSpacing: '0.8px' }}>
                LIVE COGNITIVE THREAT FEED
              </div>
            </div>

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/analyzer')}
              style={{ fontSize: '10px', color: '#94A3B8', fontFamily: 'var(--font-mono)' }}
            >
              Semua Riwayat <ChevronRight size={12} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredThreatFeed.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: '#94A3B8' }}>
                Tidak ada ancaman terfilter saat ini.
              </div>
            ) : (
              filteredThreatFeed.slice(0, 4).map((a, idx) => {
                const catBadge = getCategoryBadge(a.category)
                const threatBadge = getThreatBadge(a.threatLevel)

                const originPlatform = a.inputSource === 'ocr' 
                  ? 'TIKTOK OCR' 
                  : a.inputSource === 'url' 
                  ? 'BERITA DARING' 
                  : idx % 2 === 0 
                  ? 'X/TWITTER' 
                  : 'WHATSAPP VIRAL'

                return (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '10px 12px',
                      background: '#121822',
                      borderRadius: '6px',
                      border: '1px solid #1E2734',
                      transition: 'border-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = threatBadge.color)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#1E2734')}
                  >
                    <AlertTriangle size={15} color={threatBadge.color} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '9px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '2px',
                            background: catBadge.bgColor,
                            color: catBadge.color,
                            border: `1px solid ${catBadge.color}35`
                          }}
                        >
                          {a.category}
                        </span>
                        <span
                          style={{
                            fontSize: '9px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '2px',
                            background: threatBadge.bgColor,
                            color: threatBadge.color,
                            border: `1px solid ${threatBadge.color}35`
                          }}
                        >
                          {threatBadge.label}
                        </span>
                        <span style={{
                          fontSize: '8px',
                          fontFamily: 'var(--font-mono)',
                          color: '#94A3B8',
                          background: '#0C1016',
                          border: '1px solid #1E2734',
                          padding: '1px 4px',
                          borderRadius: '2px'
                        }}>
                          [{originPlatform}]
                        </span>
                        <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748B', marginLeft: 'auto' }}>
                          {formatMilitaryDate(a.timestamp)}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#F1F5F9', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {truncateText(a.input || a.rawContent || '', 65)}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* System Readiness Status */}
        <div className="steel-chassis-card" style={{ padding: '16px 20px', position: 'relative' }}>
          <span className="bolt-tl" />
          <span className="bolt-tr" />
          <span className="bolt-bl" />
          <span className="bolt-br" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Server size={14} color="#3B82F6" />
              <div style={{ fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: 800, color: '#F1F5F9', letterSpacing: '0.8px' }}>
                STATUS KESIAPAN SISTEM INTELIJEN
              </div>
            </div>
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 'var(--radius-pill)',
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#10B981',
              border: '1px solid rgba(16, 185, 129, 0.4)'
            }}>
              NORMAL
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              { label: 'AI Hybrid Classifier (ML 60% + Rules 40%)', latency: '12ms', status: 'ONLINE', ok: true },
              { label: 'Neural OCR Engine (Tesseract.js LSTM)', latency: '180ms', status: 'READY', ok: true },
              { label: 'Google Fact Check & Mafindo Client', latency: '320ms', status: 'SYNCED', ok: true },
              { label: 'Mozilla Readability URL Extractor', latency: '45ms', status: 'READY', ok: true },
              { label: 'Social Buzzer Forensic & Sentiment Engine', latency: '16ms', status: 'AKTIF', ok: true },
              { label: 'Session Intelligence Cache', latency: '2ms', status: `${totalAnalyses} ITEMS`, ok: true },
            ].map(item => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '5px 0',
                  borderBottom: '1px solid #1E2734'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>{item.label}</span>
                  <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                    ({item.latency})
                  </span>
                </div>
                <span style={{
                  fontSize: '9px',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '1px',
                  fontWeight: 700,
                  color: item.ok ? '#10B981' : '#EF4444'
                }}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── 7. Footer Aksen Taktis ─── */}
      <div style={{ 
        textAlign: 'right', 
        marginTop: '24px', 
        fontSize: '11px', 
        fontFamily: 'var(--font-mono)', 
        color: '#D4A017', 
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '6px'
      }}>
        <span className="tactical-slashes">///</span>
        <span>INFORMASI BENAR, KEAMANAN NEGARA</span>
      </div>
    </div>
  )
}
