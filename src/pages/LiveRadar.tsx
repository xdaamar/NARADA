import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Radio,
  RefreshCw,
  Search,
  ExternalLink,
  Zap,
  ShieldCheck,
  Building,
  Clock,
  Filter,
  CheckCircle2,
  Calendar,
  Database
} from 'lucide-react'
import { getCuratedArchiveDebunks } from '../engine/data/debunk-service'
import { checkNetworkStatus, type NetworkTelemetryInfo } from '../utils/network'
import type { DebunkKnowledgeEntry, ThreatSpectrumCluster } from '../types'
import { radarScheduler } from '../engine/scheduler/radar-scheduler'
import { getCachedRadarItems } from '../utils/db-adapter'

// ─── Definisi Klaster Spektrum Kognitif ───
interface ClusterFilterOption {
  key: ThreatSpectrumCluster | 'ALL'
  label: string
  color: string
}

const CLUSTER_OPTIONS: ClusterFilterOption[] = [
  { key: 'ALL', label: 'Semua Isu', color: '#94A3B8' },
  { key: 'POLITIK_NEGARA', label: 'Politik Negara', color: '#F87171' },
  { key: 'BENCANA_DARURAT', label: 'Bencana BMKG', color: '#38BDF8' },
  { key: 'PENIPUAN_BANSOS', label: 'Penipuan Bansos', color: '#FBBF24' },
  { key: 'KESEHATAN_PANGAN', label: 'Kesehatan & Pangan', color: '#A78BFA' },
  { key: 'KEDAULATAN_MILITER', label: 'Kedaulatan Militer', color: '#EF4444' },
]

export default function LiveRadar() {
  const navigate = useNavigate()

  // State data dan filter
  const [debunkItems, setDebunkItems] = useState<DebunkKnowledgeEntry[]>(() => getCuratedArchiveDebunks())
  const [selectedCluster, setSelectedCluster] = useState<ThreatSpectrumCluster | 'ALL'>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [lastSyncTime, setLastSyncTime] = useState<string>('Memuat...')
  const [syncIntervalHours, setSyncIntervalHours] = useState<number>(1) // Default: 1 Jam
  const [telemetry, setTelemetry] = useState<NetworkTelemetryInfo>({
    status: 'ONLINE',
    latencyMs: 14,
    lastChecked: Date.now(),
    isUsingProxy: false,
  })
  const [sourceChannel, setSourceChannel] = useState<'API_PROXY' | 'API_DIRECT' | 'API_CORS_PROXY' | 'LOCAL_ARCHIVE'>('LOCAL_ARCHIVE')

  // Fungsi sinkronisasi radar via RadarScheduler
  const triggerSync = async () => {
    setIsSyncing(true)
    const net = await checkNetworkStatus()
    setTelemetry(net)

    try {
      const entries = await radarScheduler.triggerNow()
      if (entries && entries.length > 0) {
        setDebunkItems(entries)
      }
      const status = radarScheduler.getStatus()
      setSourceChannel(status.lastSyncSource as typeof sourceChannel || 'LOCAL_ARCHIVE')
      const now = new Date(status.lastSyncTimestamp || Date.now())
      setLastSyncTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} WIB`
      )
    } catch (err) {
      console.error('[LiveRadar] Gagal sinkronisasi feed radar:', err)
    } finally {
      setIsSyncing(false)
    }
  }

  // Muat cache lokal IndexedDB saat awal buka
  useEffect(() => {
    getCachedRadarItems()
      .then((cached) => {
        if (cached && cached.length > 0) {
          setDebunkItems(cached)
        }
      })
      .catch((e) => {
        console.warn('[LiveRadar] Gagal membaca IndexedDB cache:', e)
      })

    triggerSync()
  }, [])

  // Hubungkan RadarScheduler interval dan subscribe ke event siaran
  useEffect(() => {
    radarScheduler.setIntervalHours(syncIntervalHours)

    const unsubscribe = radarScheduler.addListener((newEntries) => {
      setDebunkItems(newEntries)
      const now = new Date()
      setLastSyncTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} WIB`
      )
    })

    return () => {
      unsubscribe()
    }
  }, [syncIntervalHours])

  // Navigasikan klaim terpilih ke Multi-Input Analyzer
  const handleLaunchToAnalyzer = (claimText: string) => {
    navigate('/analyzer', { state: { prefill: claimText } })
  }

  // Filter isu berdasarkan klaster dan query pencarian
  const filteredItems = useMemo(() => {
    return debunkItems.filter(item => {
      const matchCluster = selectedCluster === 'ALL' || item.cluster === selectedCluster
      const query = searchQuery.trim().toLowerCase()
      const matchQuery = !query || 
        item.claim.toLowerCase().includes(query) ||
        item.clarification.toLowerCase().includes(query) ||
        item.officialSource.toLowerCase().includes(query) ||
        item.keywords.some(k => k.toLowerCase().includes(query))

      return matchCluster && matchQuery
    })
  }, [debunkItems, selectedCluster, searchQuery])

  // Hitung jumlah item per klaster untuk pill count
  const clusterCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: debunkItems.length }
    CLUSTER_OPTIONS.forEach(opt => {
      if (opt.key !== 'ALL') {
        counts[opt.key] = debunkItems.filter(i => i.cluster === opt.key).length
      }
    })
    return counts
  }, [debunkItems])

  return (
    <div className="fade-in" style={{ paddingBottom: '36px' }}>
      {/* ─── 1. Header Doktrin Live Radar ─── */}
      <div style={{
        marginBottom: '18px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
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
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#60A5FA',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              fontWeight: 700
            }}>
              MODUL 2: LIVE OSINT FEED
            </span>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              PUSSIBERAD TNI AD × MAFINDO × BMKG × BSSN
            </span>
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '24px',
            fontWeight: 800,
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <Radio size={24} color="#3B82F6" />
            Live OSINT Debunk Radar & Viral Threat Monitor
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '820px', marginTop: '2px' }}>
            Pusat pemantauan otomatis arus disinformasi, klarifikasi fakta nasional, dan isu viral lintas sektor secara real-time untuk mendeteksi narasi manipulatif sebelum mengeskalasi menjadi krisis kognitif.
          </p>
        </div>

        {/* Telemetri Live Status Strip & 200+ Counter Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            background: 'rgba(217, 119, 6, 0.12)',
            border: '1px solid rgba(217, 119, 6, 0.35)',
            borderRadius: 'var(--radius-pill)',
          }}>
            <Database size={13} color="#D97706" />
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#FBBF24' }}>
              {debunkItems.length >= 200 ? '200+ KASUS KLARIFIKASI AKTIF (OFFLINE AIR-GAP READY)' : `${debunkItems.length} KASUS KLARIFIKASI AKTIF (OFFLINE AIR-GAP READY)`}
            </span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            background: '#121822',
            border: '1px solid #1E2734',
            borderRadius: 'var(--radius-pill)',
            boxShadow: 'var(--shadow-steel-plate)'
          }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: telemetry.status === 'ONLINE' ? '#10B981' : '#F59E0B',
              boxShadow: `0 0 8px ${telemetry.status === 'ONLINE' ? '#10B981' : '#F59E0B'}`,
              display: 'inline-block'
            }} />
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F1F5F9' }}>
              {sourceChannel === 'API_PROXY' ? 'MAFINDO STREAM CONNECTED' : 'LOCAL THREAT KNOWLEDGE SYNCED'}
            </span>
            <span style={{ color: '#2D3848' }}>│</span>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#94A3B8' }}>
              SYNC: {lastSyncTime}
            </span>
          </div>
        </div>
      </div>

      {/* ─── 2. Control Bar Sasis Plat Baja (Sync, Auto-Update, Search) ─── */}
      <div 
        className="steel-chassis-card"
        style={{
          padding: '14px 18px',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          position: 'relative'
        }}
      >
        <span className="bolt-tl" />
        <span className="bolt-tr" />
        <span className="bolt-bl" />
        <span className="bolt-br" />

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Tombol Sinkronisasi Manual & Info Telemetri */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={triggerSync}
              disabled={isSyncing}
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                padding: '7px 14px',
                background: '#C8102E',
                borderColor: '#DC2626'
              }}
            >
              <RefreshCw size={13} className={isSyncing ? 'spin-animation' : ''} />
              <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Isu Terkini Sekarang'}</span>
            </button>

            {/* Selector Interval Pembaruan Otomatis (Minimal 1 Jam Sesuai Doktrin Sprint 6A) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={13} color="#94A3B8" />
              <select
                value={syncIntervalHours}
                onChange={(e) => setSyncIntervalHours(Number(e.target.value))}
                style={{
                  background: '#090D12',
                  border: '1px solid #2D3848',
                  borderRadius: '4px',
                  color: '#F1F5F9',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  padding: '6px 10px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value={1}>Update Otomatis: Setiap 1 Jam (Default Rekomendasi)</option>
                <option value={2}>Update Otomatis: Setiap 2 Jam</option>
                <option value={6}>Update Otomatis: Setiap 6 Jam</option>
                <option value={12}>Update Otomatis: Setiap 12 Jam</option>
                <option value={0}>Update Otomatis: Nonaktif (Hanya Manual)</option>
              </select>
            </div>
          </div>

          {/* Input Pencarian Klaim / Kata Kunci */}
          <div style={{
            position: 'relative',
            width: '280px',
            maxWidth: '100%'
          }}>
            <Search size={14} color="#64748B" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari isu, instansi, atau klaim..."
              style={{
                width: '100%',
                background: '#090D12',
                border: '1px solid #2D3848',
                borderRadius: '4px',
                color: '#F1F5F9',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                padding: '6px 10px 6px 30px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* Garis Pembatas Halus */}
        <div style={{ height: '1px', background: '#1E2734' }} />

        {/* Filter Klaster Kognitif (Pill Plat Baja) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Filter size={11} /> KLASTER SPEKTRUM:
          </span>
          {CLUSTER_OPTIONS.map(opt => {
            const isSelected = selectedCluster === opt.key
            const count = clusterCounts[opt.key] ?? 0
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSelectedCluster(opt.key)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  border: '1px solid',
                  borderColor: isSelected ? opt.color : '#232D3B',
                  background: isSelected ? `${opt.color}25` : '#101620',
                  color: isSelected ? '#FFFFFF' : '#94A3B8',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>{opt.label}</span>
                <span style={{
                  fontSize: '9px',
                  padding: '1px 4px',
                  borderRadius: '2px',
                  background: isSelected ? opt.color : '#1C2532',
                  color: isSelected ? '#000000' : '#64748B',
                  fontWeight: 800
                }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── 3. Grid Kartu Isu Viral Plat Baja (3 Kolom) ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
        gap: '16px'
      }}>
        {filteredItems.length === 0 ? (
          <div 
            className="steel-chassis-card"
            style={{
              gridColumn: '1 / -1',
              padding: '60px 20px',
              textAlign: 'center',
              position: 'relative'
            }}
          >
            <span className="bolt-tl" />
            <span className="bolt-tr" />
            <span className="bolt-bl" />
            <span className="bolt-br" />
            <ShieldCheck size={36} color="#10B981" style={{ margin: '0 auto 10px', opacity: 0.8 }} />
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#F1F5F9' }}>
              Tidak Ada Isu yang Cocok dengan Kriteria Filter
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
              Cobalah ubah kata kunci pencarian atau pilih klaster "Semua Isu".
            </div>
          </div>
        ) : (
          filteredItems.map(item => {
            const isHoax = item.verdict === 'HOAKS'
            const isDisinfo = item.verdict === 'DISINFORMASI'
            const verdictColor = isHoax ? '#EF4444' : isDisinfo ? '#A855F7' : '#F59E0B'
            const verdictBg = isHoax ? 'rgba(239, 68, 68, 0.15)' : isDisinfo ? 'rgba(168, 85, 247, 0.15)' : 'rgba(245, 158, 11, 0.15)'
            const verdictBorder = isHoax ? 'rgba(239, 68, 68, 0.4)' : isDisinfo ? 'rgba(168, 85, 247, 0.4)' : 'rgba(245, 158, 11, 0.4)'

            const clusterMeta = CLUSTER_OPTIONS.find(c => c.key === item.cluster) || { label: item.cluster, color: '#94A3B8' }

            return (
              <div
                key={item.id}
                className="steel-chassis-card"
                style={{
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  position: 'relative',
                  gap: '12px'
                }}
              >
                <span className="bolt-tl" />
                <span className="bolt-tr" />
                <span className="bolt-bl" />
                <span className="bolt-br" />

                {/* Top Metrik & Lencana */}
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px',
                    gap: '8px'
                  }}>
                    {/* Lencana Klaster */}
                    <span style={{
                      fontSize: '9px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '3px',
                      background: `${clusterMeta.color}18`,
                      color: clusterMeta.color,
                      border: `1px solid ${clusterMeta.color}35`,
                      letterSpacing: '0.5px'
                    }}>
                      {clusterMeta.label}
                    </span>

                    {/* Lencana Vonis */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        fontSize: '9px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 800,
                        padding: '2px 7px',
                        borderRadius: '3px',
                        background: verdictBg,
                        color: verdictColor,
                        border: `1px solid ${verdictBorder}`
                      }}>
                        {item.verdict}
                      </span>
                      {item.isLive && (
                        <span style={{
                          fontSize: '8px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          padding: '2px 5px',
                          borderRadius: '2px',
                          background: 'rgba(16, 185, 129, 0.2)',
                          color: '#10B981',
                          border: '1px solid rgba(16, 185, 129, 0.4)'
                        }}>
                          LIVE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Naskah / Klaim Hoaks */}
                  <div style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#F1F5F9',
                    lineHeight: 1.45,
                    marginBottom: '10px'
                  }}>
                    {item.claim}
                  </div>

                  {/* Sunken Box Penjelasan Fakta & Rujukan */}
                  <div 
                    className="steel-sunken-tray"
                    style={{
                      padding: '10px 12px',
                      marginBottom: '8px'
                    }}
                  >
                    <div style={{
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      color: '#10B981',
                      marginBottom: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      <CheckCircle2 size={12} color="#10B981" />
                      FAKTA / KLARIFIKASI RESMI:
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: '#94A3B8',
                      lineHeight: 1.5
                    }}>
                      {item.clarification}
                    </div>

                    {/* Sumber / Institusi Validasi */}
                    <div style={{
                      marginTop: '8px',
                      paddingTop: '6px',
                      borderTop: '1px solid #1A222E',
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      color: '#64748B',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      <Building size={11} color="#D4A017" />
                      <span>Rujukan: <strong style={{ color: '#E2E8F0' }}>{item.officialSource}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Footer Kartu & Tombol Aksi Taktis */}
                <div style={{
                  paddingTop: '8px',
                  borderTop: '1px solid #1E2734',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}>
                  {/* Tanggal / Link Sumber */}
                  <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={11} />
                    <span>{item.publishedDate ? item.publishedDate.substring(0, 10) : 'Terkini'}</span>
                    {item.sourceUrl && item.sourceUrl.startsWith('http') && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Buka rujukan TurnBackHoax asli"
                        style={{ color: '#3B82F6', marginLeft: '4px', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>

                  {/* Tombol Aksi: Bawa ke Multi-Input Analyzer */}
                  <button
                    type="button"
                    onClick={() => handleLaunchToAnalyzer(item.claim)}
                    style={{
                      background: 'rgba(200, 16, 46, 0.15)',
                      border: '1px solid rgba(200, 16, 46, 0.45)',
                      color: '#F87171',
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#C8102E'
                      e.currentTarget.style.color = '#FFFFFF'
                      e.currentTarget.style.borderColor = '#EF4444'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(200, 16, 46, 0.15)'
                      e.currentTarget.style.color = '#F87171'
                      e.currentTarget.style.borderColor = 'rgba(200, 16, 46, 0.45)'
                    }}
                    title="Bawa teks klaim ini ke Multi-Input Analyzer untuk pengujian mendalam"
                  >
                    <Zap size={11} />
                    <span>⚡ Bawa ke Multi-Input Analyzer</span>
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ─── 4. Footer Aksen Taktis ─── */}
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
        <span>PUSSIBERAD INTELLIGENCE RADAR FEED — INTEGRITAS TERJAGA</span>
      </div>
    </div>
  )
}
