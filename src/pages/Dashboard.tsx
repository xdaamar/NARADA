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
  Eye,
  TrendingUp,
  Activity,
  Zap,
  Clock,
  ArrowRight,
  Sparkles,
  Server,
  Layers,
  ChevronRight,
  ShieldAlert
} from 'lucide-react'
import type { AnalysisResult, ContentCategory } from '../types'
import { getStoredAnalyses, seedDemoAnalyses } from '../utils/storage'
import { getCategoryBadge, getThreatBadge, formatMilitaryDate, truncateText } from '../utils/format'

// ─── Kategori & Konfigurasi Visual Chart ───
const CATEGORY_COLORS: Record<ContentCategory, string> = {
  HOAKS: '#EF4444',
  PROPAGANDA: '#F97316',
  BUZZER: '#F59E0B',
  DISINFORMASI: '#8B5CF6',
  NETRAL: '#22C55E',
}

interface StatCardProps {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  color?: string
  pulse?: boolean
}

function StatCard({ icon: Icon, label, value, sub, color = 'var(--text-primary)', pulse = false }: StatCardProps) {
  return (
    <div
      className="card"
      style={{
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
        border: pulse ? '1px solid rgba(239, 68, 68, 0.4)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <div style={{
          width: 38,
          height: 38,
          borderRadius: '8px',
          background: pulse ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-elevated)',
          border: `1px solid ${pulse ? 'rgba(239, 68, 68, 0.3)' : 'var(--bg-border)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: pulse ? '0 0 15px rgba(239, 68, 68, 0.2)' : undefined,
        }}>
          <Icon size={18} color={pulse ? '#EF4444' : 'var(--text-secondary)'} />
        </div>
        <div className="stat-label" style={{ fontSize: '11px' }}>{label}</div>
      </div>
      <div className="stat-number" style={{ color, fontSize: '32px', lineHeight: '1' }}>{value}</div>
      {sub && (
        <div className="stat-label" style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-dim)' }}>
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

  // Data Timeline Eskalasi Ancaman Dinamis
  const timelineData = useMemo(() => {
    if (analyses.length === 0) {
      return [
        { time: '00:00', critical: 0, high: 0, medium: 0, low: 0 },
        { time: '04:00', critical: 0, high: 0, medium: 0, low: 0 },
        { time: '08:00', critical: 0, high: 0, medium: 0, low: 0 },
        { time: '12:00', critical: 0, high: 0, medium: 0, low: 0 },
        { time: '16:00', critical: 0, high: 0, medium: 0, low: 0 },
        { time: '20:00', critical: 0, high: 0, medium: 0, low: 0 },
        { time: 'Now',   critical: 0, high: 0, medium: 0, low: 0 },
      ]
    }

    // Urutkan berdasarkan waktu tertua ke terbaru
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

  const handleSeedDemo = () => {
    seedDemoAnalyses()
  }

  return (
    <div className="fade-in" style={{ paddingBottom: '32px' }}>
      {/* ─── Header Situational Awareness ─── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              padding: '2px 8px',
              borderRadius: '3px',
              background: 'var(--narada-red-subtle)',
              color: 'var(--narada-red)',
              border: '1px solid rgba(200, 16, 46, 0.3)',
              letterSpacing: '1.5px',
              textTransform: 'uppercase'
            }}>
              SITUATIONAL AWARENESS COMMAND
            </span>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              PUSSIBERAD TNI AD
            </span>
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '24px',
            fontWeight: '800',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: 'var(--text-primary)'
          }}>
            Cognitive Threat Situational Awareness
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Pusat komando pemantauan ancaman kognitif, disinformasi, dan kampanye manipulasi siber waktu nyata.
          </p>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'var(--bg-elevated)',
          padding: '8px 14px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--bg-border)'
        }}>
          <Clock size={14} color="var(--accent-blue)" />
          <span style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-primary)',
            letterSpacing: '1px'
          }}>
            {currentTimeStr ? `${currentTimeStr} WIB` : 'SIAGA OPERASIONAL'}
          </span>
        </div>
      </div>

      {/* ─── 1. SYNCHRONIZED DEFCON 1-5 ALERT BANNER (REAL-TIME STATUS) ─── */}
      {(() => {
        const defconConfig = (() => {
          if (criticalItems.length > 0) {
            return {
              level: 1,
              badge: `DEFCON 1 — SIAGA MERAH (DARURAT KOGNITIF: ${criticalItems.length} KRITIS)`,
              color: '#EF4444',
              bgGrad: 'linear-gradient(90deg, rgba(239, 68, 68, 0.22), rgba(200, 16, 46, 0.12))',
              borderColor: 'rgba(239, 68, 68, 0.5)',
              shadow: '0 0 30px rgba(239, 68, 68, 0.25)',
              icon: ShieldAlert,
              desc: `Terdeteksi ${criticalItems.length} konten ancaman kritis dengan indikasi hoaks alutsista / separatisme. Segera eskalasi tindakan taktis ke Komando Satgas/Dispenad.`,
              btnText: 'Tanggapi Krisis di Analyzer',
              btnPath: '/analyzer',
            }
          }
          if (highItems.length > 0) {
            return {
              level: 2,
              badge: `DEFCON 2 — SIAGA ORANYE (ANCAMAN TINGGI: ${highItems.length} ITEM)`,
              color: '#F97316',
              bgGrad: 'linear-gradient(90deg, rgba(249, 115, 22, 0.2), rgba(217, 119, 6, 0.1))',
              borderColor: 'rgba(249, 115, 22, 0.45)',
              shadow: '0 0 25px rgba(249, 115, 22, 0.2)',
              icon: AlertTriangle,
              desc: `Terdeteksi ${highItems.length} kampanye manipulasi dan propaganda terkoordinasi. Lakukan pelacakan klaster buzzer di Nexus.`,
              btnText: 'Buka Radar Nexus Graph',
              btnPath: '/nexus',
            }
          }
          if (analyses.some(a => a.threatLevel === 'medium')) {
            const medCount = analyses.filter(a => a.threatLevel === 'medium').length
            return {
              level: 3,
              badge: `DEFCON 3 — SIAGA KUNING (KEWASPADAAN SIBER: ${medCount} ITEM)`,
              color: '#F59E0B',
              bgGrad: 'linear-gradient(90deg, rgba(245, 158, 11, 0.18), rgba(180, 83, 9, 0.08))',
              borderColor: 'rgba(245, 158, 11, 0.4)',
              shadow: '0 0 20px rgba(245, 158, 11, 0.15)',
              icon: AlertTriangle,
              desc: `Terdeteksi ${medCount} konten disinformasi atau polarisasi sedang. Lakukan pemantauan tren sentimen secara berkala.`,
              btnText: 'Buka Profiler Akun',
              btnPath: '/profiler',
            }
          }
          if (analyses.some(a => a.threatLevel === 'low')) {
            return {
              level: 4,
              badge: 'DEFCON 4 — SIAGA BIRU (MONITORING RUTIN AKTIF)',
              color: '#3B82F6',
              bgGrad: 'linear-gradient(90deg, rgba(59, 130, 246, 0.16), rgba(37, 99, 235, 0.08))',
              borderColor: 'rgba(59, 130, 246, 0.35)',
              shadow: '0 0 20px rgba(59, 130, 246, 0.15)',
              icon: Shield,
              desc: 'Konten terdeteksi berada pada tingkat risiko rendah. Sistem menjalankan pengawasan pasif dan verifikasi berkala.',
              btnText: 'Periksa Riwayat Pantauan',
              btnPath: '/analyzer',
            }
          }
          return {
            level: 5,
            badge: 'DEFCON 5 — SIAGA HIJAU (KONDISI TERKENDALI & NORMAL)',
            color: '#22C55E',
            bgGrad: 'linear-gradient(90deg, rgba(34, 197, 94, 0.14), rgba(21, 128, 61, 0.06))',
            borderColor: 'rgba(34, 197, 94, 0.3)',
            shadow: '0 0 20px rgba(34, 197, 94, 0.1)',
            icon: Shield,
            desc: 'Seluruh sensor intelijen siber kognitif berada pada ambang batas normal. Sistem siaga penuh menerima input baru.',
            btnText: 'Mulai Analisis Konten',
            btnPath: '/analyzer',
          }
        })()

        const DefconIcon = defconConfig.icon

        return (
          <div
            className="fade-in"
            style={{
              background: defconConfig.bgGrad,
              border: `1px solid ${defconConfig.borderColor}`,
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '14px',
              boxShadow: defconConfig.shadow
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: `${defconConfig.color}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1px solid ${defconConfig.color}50`,
                flexShrink: 0
              }}>
                <DefconIcon size={22} color={defconConfig.color} />
              </div>
              <div>
                <div style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: '700',
                  letterSpacing: '2px',
                  color: defconConfig.color,
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Zap size={12} /> {defconConfig.badge}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '2px' }}>
                  {defconConfig.desc}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate(defconConfig.btnPath)}
              style={{
                boxShadow: `0 0 15px ${defconConfig.color}40`,
                borderColor: defconConfig.color
              }}
            >
              {defconConfig.btnText} <ArrowRight size={14} />
            </button>
          </div>
        )
      })()}

      {/* ─── TACTICAL QUICK LAUNCHPAD (AKSI CEPAT INTELIJEN) ─── */}
      <div className="card mb-4" style={{ padding: '16px 20px', background: 'var(--bg-card)' }}>
        <div style={{
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          fontWeight: '700',
          letterSpacing: '1.5px',
          color: 'var(--text-muted)',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <Zap size={13} color="var(--accent-blue)" /> TACTICAL QUICK LAUNCHPAD (AKSI CEPAT INTELIJEN)
        </div>
        <div className="grid-3" style={{ gap: '14px' }}>
          <div
            onClick={() => navigate('/analyzer')}
            style={{
              padding: '14px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--narada-red)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--bg-border)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'rgba(200, 16, 46, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={18} color="var(--narada-red)" />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>1. Multi-Input Analyzer</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Uji instan teks, OCR, URL & batch</div>
            </div>
          </div>

          <div
            onClick={() => navigate('/nexus')}
            style={{
              padding: '14px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-blue)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--bg-border)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={18} color="var(--accent-blue)" />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>2. Radar Topologi Nexus</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Klaster bot, buzzer & relasi narasi</div>
            </div>
          </div>

          <div
            onClick={() => navigate('/reports')}
            style={{
              padding: '14px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--threat-low)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--bg-border)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'rgba(34, 197, 94, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={18} color="var(--threat-low)" />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>3. Produk Intelijen A4</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Laporan resmi militer siap cetak</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. Empat Kartu Statistik Taktis ─── */}
      <div className="grid-4 mb-4">
        <StatCard
          icon={Eye}
          label="Total Konten Dianalisis"
          value={totalAnalyses}
          sub="Sesi pemantauan aktif"
          color="var(--text-primary)"
        />
        <StatCard
          icon={AlertTriangle}
          label="Ancaman Terdeteksi"
          value={threatItems.length}
          sub={`${totalAnalyses > 0 ? Math.round((threatItems.length / totalAnalyses) * 100) : 0}% dari total konten`}
          color={threatItems.length > 0 ? 'var(--threat-high)' : 'var(--text-primary)'}
        />
        <StatCard
          icon={Zap}
          label="Ancaman Kritis (Critical)"
          value={criticalItems.length}
          sub="Perlu eskalasi Dispenad"
          color={criticalItems.length > 0 ? 'var(--threat-critical)' : 'var(--text-primary)'}
          pulse={criticalItems.length > 0}
        />
        <StatCard
          icon={TrendingUp}
          label="Ancaman Tinggi (High)"
          value={highItems.length}
          sub="Prioritas pantauan khusus"
          color={highItems.length > 0 ? 'var(--threat-high)' : 'var(--text-primary)'}
        />
      </div>

      {/* ─── Empty State Banner jika belum ada data ─── */}
      {totalAnalyses === 0 && (
        <div className="card mb-4" style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-elevated)' }}>
          <div style={{ maxWidth: '540px', margin: '0 auto' }}>
            <Layers size={36} color="var(--narada-red)" style={{ opacity: 0.8, marginBottom: '10px' }} />
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', marginBottom: '6px' }}>
              SESI BARU AKTIF — BELUM ADA DATA ANALISIS
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.6' }}>
              Data pada Command Dashboard ditarik secara reaktif dari sesi pemantauan aktif. Anda dapat memuat kumpulan data skenario uji coba (demo) atau langsung menganalisis konten baru.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSeedDemo}
              >
                <Sparkles size={13} /> Muat Skenario Demo Siap Pantau (5 Sampel)
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => navigate('/analyzer')}
              >
                Buka Multi-Input Analyzer →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 3. Baris Grafik: Timeline Recharts & Distribusi Donut ─── */}
      <div className="grid-2 mb-4" style={{ gridTemplateColumns: '1.7fr 1.3fr', gap: '16px' }}>
        {/* Timeline Chart */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={13} color="var(--narada-red)" />
              TREN AKUMULASI ANCAMAN KOGNITIF (TIMELINE)
            </div>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              RECHARTS REAL-TIME
            </span>
          </div>
          <div className="card-body">
            <div style={{ height: 210 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--bg-border)',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)'
                    }}
                  />
                  <Line type="monotone" dataKey="critical" stroke="#EF4444" strokeWidth={2.5} dot={{ r: 3 }} name="Critical" />
                  <Line type="monotone" dataKey="high" stroke="#F97316" strokeWidth={2} dot={{ r: 3 }} name="High" />
                  <Line type="monotone" dataKey="medium" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} name="Medium" />
                  <Line type="monotone" dataKey="low" stroke="#22C55E" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Low" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* Legend Taktis */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '16px',
              marginTop: '10px',
              paddingTop: '8px',
              borderTop: '1px solid var(--bg-border)'
            }}>
              {[
                { label: 'Critical', color: '#EF4444' },
                { label: 'High', color: '#F97316' },
                { label: 'Medium', color: '#F59E0B' },
                { label: 'Low', color: '#22C55E' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Kategori Donut Chart */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">DISTRIBUSI 5 KATEGORI KOGNITIF</div>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              {totalAnalyses} KONTEN
            </span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: 140, height: 140, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={totalAnalyses === 0 ? [{ name: 'KOSONG', value: 1, color: '#2A2F45', pct: 0 }] : categoryChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {(totalAnalyses === 0 ? [{ color: '#2A2F45' }] : categoryChartData).map((entry, i) => (
                        <Cell key={i} fill={entry.color} opacity={0.9} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--bg-border)',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend List */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {categoryChartData.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', flex: 1 }}>
                      {d.name}
                    </span>
                    <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: '700', color: d.color }}>
                      {d.value}
                    </span>
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', width: '32px', textAlign: 'right' }}>
                      {d.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 4. Baris Bawah: Live Cognitive Threat Feed & System Status ─── */}
      <div className="grid-2" style={{ gridTemplateColumns: '1.4fr 1fr', gap: '16px' }}>
        {/* Live Feed Ancaman */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={13} color="var(--threat-high)" />
              LIVE COGNITIVE THREAT FEED (5 TERBARU)
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/analyzer')}
              style={{ fontSize: '11px' }}
            >
              Semua Riwayat <ChevronRight size={12} />
            </button>
          </div>
          <div className="card-body" style={{ padding: '12px' }}>
            {threatItems.length === 0 ? (
              <div className="empty-state" style={{ padding: '36px 20px' }}>
                <Shield size={32} className="empty-icon" color="var(--threat-low)" />
                <div className="empty-title">Status Aman — Tidak Ada Ancaman Terdeteksi</div>
                <div className="empty-desc">
                  Jalankan analisis konten di Multi-Input Analyzer untuk mendeteksi indikasi hoaks, buzzer, atau propaganda.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {threatItems.slice(0, 5).map(a => {
                  const catBadge = getCategoryBadge(a.category)
                  const threatBadge = getThreatBadge(a.threatLevel)

                  return (
                    <div
                      key={a.id}
                      onClick={() => navigate('/analyzer')}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '10px 14px',
                        background: 'var(--bg-elevated)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--bg-border)',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${threatBadge.color}60`)}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--bg-border)')}
                    >
                      <AlertTriangle size={15} color={threatBadge.color} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <span
                            className="category-badge"
                            style={{
                              background: catBadge.bgColor,
                              color: catBadge.color,
                              border: `1px solid ${catBadge.color}30`
                            }}
                          >
                            {a.category}
                          </span>
                          <span
                            className="threat-badge"
                            style={{
                              background: threatBadge.bgColor,
                              color: threatBadge.color,
                              border: `1px solid ${threatBadge.borderColor}`,
                              padding: '2px 6px',
                              fontSize: '9px'
                            }}
                          >
                            {threatBadge.label}
                          </span>
                          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginLeft: 'auto' }}>
                            {formatMilitaryDate(a.timestamp)}
                          </span>
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          lineHeight: '1.5'
                        }}>
                          {truncateText(a.input || a.rawContent, 90)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* System Status Panel */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Server size={13} color="var(--accent-blue)" />
              STATUS KESIAPAN SISTEM INTELIJEN
            </div>
            <span style={{
              fontSize: '9px',
              fontFamily: 'var(--font-mono)',
              padding: '2px 6px',
              borderRadius: '2px',
              background: 'rgba(34, 197, 94, 0.12)',
              color: 'var(--threat-low)'
            }}>
              NORMAL
            </span>
          </div>
          <div className="card-body">
            {[
              { label: 'AI Hybrid Classifier (ML 60% + Rules 40%)', status: 'AKTIF', ok: true },
              { label: 'Google Fact Check & Mafindo Client', status: 'ONLINE', ok: true },
              { label: 'Neural OCR Engine (Tesseract.js LSTM)', status: 'READY', ok: true },
              { label: 'Mozilla Readability URL Extractor', status: 'READY', ok: true },
              { label: 'Nexus Force Network Graph Engine', status: 'AKTIF', ok: true },
              { label: 'Session Intelligence Cache', status: `${totalAnalyses} ITEMS`, ok: true },
            ].map(item => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--bg-border)'
                }}
              >
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.label}</span>
                <span style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '1px',
                  fontWeight: '700',
                  color: item.ok ? 'var(--threat-low)' : 'var(--threat-critical)'
                }}>
                  {item.status}
                </span>
              </div>
            ))}

            <div style={{
              marginTop: '14px',
              padding: '12px',
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--bg-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  NARADA SENSORY & COMMAND SUITE
                </div>
                <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  PUSSIBERAD TNI AD · HACKATHON 2026
                </div>
              </div>
              <span style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--narada-red)',
                border: '1px solid rgba(200, 16, 46, 0.3)',
                padding: '2px 6px',
                borderRadius: '2px'
              }}>
                INTERNAL
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
