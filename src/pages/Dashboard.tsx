import { useState, useEffect } from 'react'
import { 
  ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell
} from 'recharts'
import { AlertTriangle, Shield, Eye, TrendingUp, Activity, Zap, Clock } from 'lucide-react'
import type { AnalysisResult } from '../types'

// ─── Mock recent analyses from sessionStorage ───
function getRecentAnalyses(): AnalysisResult[] {
  try {
    const stored = sessionStorage.getItem('narada_analyses')
    return stored ? JSON.parse(stored) : []
  } catch { return [] }
}

const THREAT_TIMELINE = [
  { time: '00:00', low: 2, medium: 0, high: 0, critical: 0 },
  { time: '04:00', low: 1, medium: 1, high: 0, critical: 0 },
  { time: '08:00', low: 4, medium: 2, high: 1, critical: 0 },
  { time: '12:00', low: 5, medium: 3, high: 2, critical: 1 },
  { time: '16:00', low: 6, medium: 4, high: 2, critical: 0 },
  { time: '20:00', low: 3, medium: 2, high: 1, critical: 0 },
  { time: 'Now',   low: 2, medium: 1, high: 0, critical: 0 },
]

const CATEGORY_DATA = [
  { name: 'HOAKS', value: 38, color: '#EF4444' },
  { name: 'PROPAGANDA', value: 25, color: '#F97316' },
  { name: 'BUZZER', value: 20, color: '#F59E0B' },
  { name: 'DISINFORMASI', value: 12, color: '#8B5CF6' },
  { name: 'NETRAL', value: 5, color: '#22C55E' },
]



// ─── Stat Card ───
function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  sub, 
  color = 'var(--text-primary)' 
}: { 
  icon: React.ElementType, label: string, value: string | number, sub?: string, color?: string 
}) {
  return (
    <div className="card" style={{ padding: '20px' }}>
      <div className="flex items-center gap-3 mb-4">
        <div style={{ 
          width: 36, height: 36, borderRadius: '8px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--bg-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Icon size={16} color="var(--text-secondary)" />
        </div>
        <div className="stat-label">{label}</div>
      </div>
      <div className="stat-number" style={{ color }}>{value}</div>
      {sub && <div className="stat-label" style={{ marginTop: '6px' }}>{sub}</div>}
    </div>
  )
}

// ─── Mini Alert Feed ───
function AlertFeed({ analyses }: { analyses: AnalysisResult[] }) {
  const threats = analyses.filter(a => a.category !== 'NETRAL')

  if (threats.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '30px 20px' }}>
        <Shield size={32} className="empty-icon" />
        <div className="empty-title">Tidak Ada Ancaman Aktif</div>
        <div className="empty-desc">Jalankan analisis di modul Classifier untuk memulai pemantauan</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {threats.slice(0, 5).map(a => (
        <div key={a.id} style={{
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          padding: '10px 12px', 
          background: 'var(--bg-elevated)',
          borderRadius: '8px',
          border: '1px solid var(--bg-border)',
        }}>
          <AlertTriangle size={14} color={
            a.threatLevel === 'critical' ? '#EF4444' :
            a.threatLevel === 'high' ? '#F97316' :
            a.threatLevel === 'medium' ? '#F59E0B' : '#22C55E'
          } style={{ flexShrink: 0, marginTop: '1px' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <span className={`category-badge cat-${a.category.toLowerCase()}`}>{a.category}</span>
              <span className={`threat-badge ${a.threatLevel}`}>{a.threatLevel.toUpperCase()}</span>
            </div>
            <div style={{ 
              fontSize: '11px', color: 'var(--text-secondary)', 
              fontFamily: 'var(--font-mono)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
              {a.input.substring(0, 60)}{a.input.length > 60 ? '...' : ''}
            </div>
          </div>
          <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', flexShrink: 0 }}>
            {new Date(a.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Dashboard Page ───
export default function Dashboard() {
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([])
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    setAnalyses(getRecentAnalyses())
    const interval = setInterval(() => {
      setNow(new Date())
      setAnalyses(getRecentAnalyses())
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const totalAnalyses = analyses.length
  const threats = analyses.filter(a => a.category !== 'NETRAL')
  const criticalCount = analyses.filter(a => a.threatLevel === 'critical').length
  const highCount = analyses.filter(a => a.threatLevel === 'high').length

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ 
          fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '700',
          letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px'
        }}>
          Situational Awareness
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Pemantauan ancaman kognitif — {now.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Alert Banner */}
      {criticalCount > 0 && (
        <div className="alert-banner alert-critical mb-6">
          <Zap size={16} />
          <span><strong>PERINGATAN KRITIS:</strong> {criticalCount} konten dengan tingkat ancaman CRITICAL terdeteksi. Segera eskalasi ke pimpinan.</span>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid-4 mb-4">
        <StatCard icon={Eye} label="Total Analisis" value={totalAnalyses || 0} sub="Sesi ini" />
        <StatCard icon={AlertTriangle} label="Ancaman Terdeteksi" value={threats.length || 0} sub="Dari total analisis" color={threats.length > 0 ? 'var(--threat-high)' : 'var(--text-primary)'} />
        <StatCard icon={Zap} label="Ancaman Kritis" value={criticalCount || 0} sub="Level CRITICAL" color={criticalCount > 0 ? 'var(--threat-critical)' : 'var(--text-primary)'} />
        <StatCard icon={TrendingUp} label="Ancaman Tinggi" value={highCount || 0} sub="Level HIGH" color={highCount > 0 ? 'var(--threat-high)' : 'var(--text-primary)'} />
      </div>

      {/* Charts Row */}
      <div className="grid-2 mb-4" style={{ gridTemplateColumns: '2fr 1fr' }}>
        {/* Timeline Chart */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Activity size={12} style={{ display: 'inline', marginRight: '6px' }} />
              Timeline Aktivitas Ancaman (24 Jam)
            </div>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={THREAT_TIMELINE}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ 
                    background: 'var(--bg-card)', border: '1px solid var(--bg-border)',
                    borderRadius: '8px', fontSize: '12px'
                  }}
                />
                <Line type="monotone" dataKey="critical" stroke="#EF4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="high" stroke="#F97316" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="medium" stroke="#F59E0B" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="low" stroke="#22C55E" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Pie */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Distribusi Kategori</div>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={CATEGORY_DATA}
                  cx="50%" cy="50%"
                  innerRadius={45} outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {CATEGORY_DATA.map((entry, i) => (
                    <Cell key={i} fill={entry.color} opacity={0.85} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ 
                    background: 'var(--bg-card)', border: '1px solid var(--bg-border)',
                    borderRadius: '8px', fontSize: '11px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {CATEGORY_DATA.map(d => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', flex: 1 }}>{d.name}</span>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Alert Feed */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Clock size={12} style={{ display: 'inline', marginRight: '6px' }} />
              Feed Ancaman Terbaru
            </div>
          </div>
          <div className="card-body" style={{ padding: '12px' }}>
            <AlertFeed analyses={analyses} />
          </div>
        </div>

        {/* System Info */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Shield size={12} style={{ display: 'inline', marginRight: '6px' }} />
              Status Sistem NARADA
            </div>
          </div>
          <div className="card-body">
            {[
              { label: 'AI Classifier Engine', status: 'AKTIF', ok: true },
              { label: 'Bot Profiler Module', status: 'AKTIF', ok: true },
              { label: 'Nexus Graph Engine', status: 'AKTIF', ok: true },
              { label: 'Intel Report Generator', status: 'AKTIF', ok: true },
              { label: 'Koneksi Internet', status: 'OFFLINE (AMAN)', ok: true },
              { label: 'Database Lokal', status: 'SESSION STORAGE', ok: true },
            ].map(item => (
              <div key={item.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0', borderBottom: '1px solid var(--bg-border)'
              }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.label}</span>
                <span style={{ 
                  fontSize: '9px', fontFamily: 'var(--font-mono)', letterSpacing: '1px',
                  color: item.ok ? 'var(--threat-low)' : 'var(--threat-critical)'
                }}>{item.status}</span>
              </div>
            ))}

            <div style={{ marginTop: '16px', padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--bg-border)' }}>
              <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '4px' }}>
                INFORMASI SISTEM
              </div>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                NARADA v1.0.0<br />
                Engine: NARADA-NLP-ID<br />
                Model: Rule-Based + Heuristic<br />
                <span style={{ color: 'var(--narada-red)' }}>KLASIFIKASI: INTERNAL</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
