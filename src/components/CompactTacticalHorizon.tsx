import { useState, useRef, useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Landmark,
  Building2,
  HeartPulse,
  ShieldAlert
} from 'lucide-react'
import type { ThreatSpectrumCluster, DebunkKnowledgeEntry } from '../types'

export interface CompactTacticalHorizonProps {
  entries: DebunkKnowledgeEntry[]
  isLiveStream: boolean
  onSelectDebunk: (debunkText: string, cluster: ThreatSpectrumCluster) => void
  disabled?: boolean
}

type FilterTab = 'ALL' | ThreatSpectrumCluster

interface FilterPillConfig {
  id: FilterTab
  label: string
  icon: typeof Flame
}

const FILTER_PILLS: FilterPillConfig[] = [
  { id: 'ALL', label: 'Semua Isu', icon: Flame },
  { id: 'POLITIK_NEGARA', label: 'Politik', icon: Landmark },
  { id: 'BENCANA_DARURAT', label: 'Bencana BMKG', icon: AlertTriangle },
  { id: 'PENIPUAN_BANSOS', label: 'Penipuan Bansos', icon: Building2 },
  { id: 'KESEHATAN_PANGAN', label: 'Kesehatan/Pangan', icon: HeartPulse },
  { id: 'KEDAULATAN_MILITER', label: 'Militer', icon: ShieldAlert },
]

function getClusterVisuals(cluster: ThreatSpectrumCluster) {
  switch (cluster) {
    case 'POLITIK_NEGARA':
      return { label: 'POLITIK', color: '#A855F7', bg: 'rgba(168, 85, 247, 0.15)' }
    case 'BENCANA_DARURAT':
      return { label: 'BENCANA', color: '#F97316', bg: 'rgba(249, 115, 22, 0.15)' }
    case 'PENIPUAN_BANSOS':
      return { label: 'PENIPUAN', color: '#EAB308', bg: 'rgba(234, 179, 8, 0.15)' }
    case 'KESEHATAN_PANGAN':
      return { label: 'KESEHATAN', color: '#22C55E', bg: 'rgba(34, 197, 94, 0.15)' }
    case 'KEDAULATAN_MILITER':
    default:
      return { label: 'MILITER', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' }
  }
}

export default function CompactTacticalHorizon({
  entries,
  isLiveStream,
  onSelectDebunk,
  disabled = false,
}: CompactTacticalHorizonProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL')
  const trackRef = useRef<HTMLDivElement>(null)

  // Hitung jumlah entri per klaster
  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: entries.length }
    for (const e of entries) {
      c[e.cluster] = (c[e.cluster] || 0) + 1
    }
    return c
  }, [entries])

  // Filter entri berdasarkan tab aktif
  const filteredEntries = useMemo(() => {
    if (activeTab === 'ALL') return entries
    return entries.filter(e => e.cluster === activeTab)
  }, [entries, activeTab])

  const handleScroll = (direction: 'left' | 'right') => {
    if (trackRef.current) {
      const scrollDistance = 320
      trackRef.current.scrollBy({
        left: direction === 'left' ? -scrollDistance : scrollDistance,
        behavior: 'smooth',
      })
    }
  }

  return (
    <div
      style={{
        marginTop: '16px',
        marginBottom: '16px',
        background: 'var(--bg-card)',
        border: '1px solid var(--bg-border)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        position: 'relative',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* ─── Header: Filter Pills & Navigasi Panah ─── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '10px',
        }}
      >
        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '2px' }}>
          {FILTER_PILLS.map(pill => {
            const Icon = pill.icon
            const isActive = activeTab === pill.id
            const count = counts[pill.id] || 0

            return (
              <button
                key={pill.id}
                type="button"
                className={`trending-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(pill.id)}
                style={{
                  fontSize: '10px',
                  padding: '4px 9px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Icon size={11} />
                <span>{pill.label}</span>
                <span
                  style={{
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    opacity: 0.8,
                    background: isActive ? 'rgba(255, 255, 255, 0.2)' : 'var(--bg-elevated)',
                    padding: '1px 5px',
                    borderRadius: '10px',
                  }}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Tombol Geser Horizontal (Panah) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => handleScroll('left')}
            style={{ padding: '4px 6px', height: '26px' }}
            title="Geser ke kiri"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => handleScroll('right')}
            style={{ padding: '4px 6px', height: '26px' }}
            title="Geser ke kanan"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* ─── Horizontal Streaming Track ─── */}
      <div
        ref={trackRef}
        style={{
          display: 'flex',
          gap: '12px',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          paddingBottom: '4px',
          scrollbarWidth: 'none',
        }}
      >
        {filteredEntries.length === 0 ? (
          <div
            style={{
              padding: '24px',
              textAlign: 'center',
              width: '100%',
              color: 'var(--text-muted)',
              fontSize: '11px',
            }}
          >
            Tidak ada isu pada klaster ini saat ini.
          </div>
        ) : (
          filteredEntries.map(entry => {
            const visual = getClusterVisuals(entry.cluster)
            const isLive = entry.isLive ?? isLiveStream

            return (
              <div
                key={entry.id}
                style={{
                  minWidth: '290px',
                  maxWidth: '310px',
                  height: '148px',
                  flexShrink: 0,
                  scrollSnapAlign: 'start',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--bg-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'border-color 0.2s ease, transform 0.2s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.45)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--bg-border)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
                onClick={() => onSelectDebunk(entry.claim, entry.cluster)}
              >
                {/* Baris 1: Klaster, Tag Sumber Data & Vonis */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span
                      style={{
                        fontSize: '9px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: '700',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        background: visual.bg,
                        color: visual.color,
                        border: `1px solid ${visual.color}35`,
                      }}
                    >
                      {visual.label}
                    </span>

                    {/* Tag Asal Data Jujur */}
                    <span
                      style={{
                        fontSize: '8px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: '700',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        background: isLive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(148, 163, 184, 0.12)',
                        color: isLive ? '#22C55E' : '#94A3B8',
                        border: `1px solid ${isLive ? '#22C55E40' : '#94A3B840'}`,
                      }}
                    >
                      {isLive ? '🔴 LIVE' : '📁 ARSIP'}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '9px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: '700',
                      color: '#EF4444',
                      background: 'rgba(239, 68, 68, 0.12)',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    {entry.verdict} 96%
                  </span>
                </div>

                {/* Baris 2: Judul Klaim (Maksimal 2 Baris) */}
                <div
                  title={entry.claim}
                  style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: 'var(--text-primary)',
                    lineHeight: '1.4',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    marginTop: '2px',
                    marginBottom: '2px',
                  }}
                >
                  "{entry.claim}"
                </div>

                {/* Baris 3: Instansi Rujukan Resmi */}
                <div
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <CheckCircle2 size={11} color="#22C55E" style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Rujukan: <strong style={{ color: 'var(--text-secondary)' }}>{entry.officialSource}</strong>
                  </span>
                </div>

                {/* Baris 4: Tombol Aksi Taktis Cepat */}
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={disabled}
                  onClick={e => {
                    e.stopPropagation()
                    onSelectDebunk(entry.claim, entry.cluster)
                  }}
                  style={{
                    width: '100%',
                    fontSize: '10px',
                    padding: '4px 8px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    fontWeight: '700',
                  }}
                >
                  <Zap size={11} />
                  ⚡ Uji Isu Ini
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
