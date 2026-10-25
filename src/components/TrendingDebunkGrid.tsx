import { useState, useMemo } from 'react'
import {
  TrendingUp,
  Zap,
  CheckCircle2,
  ShieldAlert,
  Flame,
  Building2,
  AlertTriangle,
  HeartPulse,
  Landmark
} from 'lucide-react'
import type { ThreatSpectrumCluster, DebunkKnowledgeEntry } from '../types'
import debunkData from '../engine/data/debunk-database.json'

export interface TrendingDebunkGridProps {
  onSelectDebunk: (debunkText: string, cluster: ThreatSpectrumCluster) => void
  disabled?: boolean
}

type FilterTab = 'ALL' | ThreatSpectrumCluster

interface TabConfig {
  id: FilterTab
  label: string
  icon: typeof Flame
}

const TABS: TabConfig[] = [
  { id: 'ALL', label: 'Semua Isu Terhangat', icon: Flame },
  { id: 'POLITIK_NEGARA', label: 'Politik Negara', icon: Landmark },
  { id: 'BENCANA_DARURAT', label: 'Bencana BMKG', icon: AlertTriangle },
  { id: 'PENIPUAN_BANSOS', label: 'Penipuan Bansos', icon: Building2 },
  { id: 'KESEHATAN_PANGAN', label: 'Kesehatan & Pangan', icon: HeartPulse },
  { id: 'KEDAULATAN_MILITER', label: 'Kedaulatan Militer', icon: ShieldAlert },
]

function getClusterVisuals(cluster: ThreatSpectrumCluster) {
  switch (cluster) {
    case 'POLITIK_NEGARA':
      return { label: 'POLITIK NEGARA', color: '#7C3AED', bg: '#F5F3FF' }
    case 'BENCANA_DARURAT':
      return { label: 'BENCANA BMKG', color: '#EA580C', bg: '#FFF7ED' }
    case 'PENIPUAN_BANSOS':
      return { label: 'PENIPUAN BANSOS', color: '#D97706', bg: '#FFFBEB' }
    case 'KESEHATAN_PANGAN':
      return { label: 'KESEHATAN & PANGAN', color: '#059669', bg: '#ECFDF5' }
    case 'KEDAULATAN_MILITER':
    default:
      return { label: 'KEDAULATAN MILITER', color: '#DC2626', bg: '#FEF2F2' }
  }
}

export default function TrendingDebunkGrid({ onSelectDebunk, disabled = false }: TrendingDebunkGridProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL')

  // Ambil data entri dan filter berdasarkan tab yang dipilih
  const filteredEntries = useMemo(() => {
    const all = debunkData as DebunkKnowledgeEntry[]
    if (activeTab === 'ALL') {
      // Ambil 8 entri representatif lintas klaster untuk tampilan utama yang padat
      return all.slice(0, 8)
    }
    return all.filter(e => e.cluster === activeTab).slice(0, 8)
  }, [activeTab])

  return (
    <div style={{ marginTop: '24px' }}>
      {/* ─── Header Bilah Trending ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: 'rgba(220, 38, 38, 0.15)',
            border: '1px solid rgba(220, 38, 38, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--narada-red)'
          }}>
            <TrendingUp size={16} />
          </div>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '15px',
              fontWeight: '700',
              letterSpacing: '1px',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              LIVE TRENDING COGNITIVE THREATS · RADAR ISU VIRAL NASIONAL
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Pemantauan real-time klarifikasi hoaks dan disinformasi terhangat dari Mafindo & otoritas resmi
            </div>
          </div>
        </div>

        {/* Live Indicator Pulse */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'var(--bg-elevated)',
          padding: '4px 10px',
          borderRadius: '20px',
          border: '1px solid var(--bg-border)',
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-secondary)'
        }}>
          <span style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: '#22C55E',
            boxShadow: '0 0 8px #22C55E',
            display: 'inline-block'
          }} />
          <span>RADAR AKTIF · {debunkData.length} KASUS TERDATA</span>
        </div>
      </div>

      {/* ─── Filter Tabs ─── */}
      <div style={{
        display: 'flex',
        gap: '6px',
        overflowX: 'auto',
        paddingBottom: '6px',
        marginBottom: '16px'
      }}>
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              className={`trending-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Icon size={12} />
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* ─── Grid Kartu Isu ─── */}
      <div className="trending-grid">
        {filteredEntries.map(entry => {
          const visual = getClusterVisuals(entry.cluster)
          return (
            <div key={entry.id} className="trending-card">
              <div>
                {/* Header Kartu: Klaster & Vonis */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '10px'
                }}>
                  <span style={{
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: '700',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: visual.bg,
                    color: visual.color,
                    border: `1px solid ${visual.color}35`,
                    letterSpacing: '0.5px'
                  }}>
                    {visual.label}
                  </span>

                  <span style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: '700',
                    color: '#991B1B',
                    background: '#FEF2F2',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid #FCA5A5'
                  }}>
                    {entry.verdict} 96%
                  </span>
                </div>

                {/* Klaim Hoaks */}
                <div className="trending-card-claim" title={entry.claim}>
                  "{entry.claim}"
                </div>

                {/* Rujukan Resmi Lembaga */}
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  marginBottom: '14px'
                }}>
                  <CheckCircle2 size={12} color="#22C55E" />
                  <span>Rujukan: <strong style={{ color: 'var(--text-secondary)' }}>{entry.officialSource}</strong></span>
                </div>
              </div>

              {/* Tombol Aksi 1-Click Test Demo */}
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={disabled}
                onClick={() => onSelectDebunk(entry.claim, entry.cluster)}
                style={{
                  width: '100%',
                  fontSize: '11px',
                  fontWeight: '700',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '7px 10px'
                }}
              >
                <Zap size={13} />
                Uji / Analisis Isu Ini
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
