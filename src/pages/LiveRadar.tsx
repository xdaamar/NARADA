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
  Calendar,
  Database,
  Trash2,
  AlertTriangle,
  X,
  Flame,
  ShieldAlert,
  Eye,
  CheckCircle
} from 'lucide-react'
import { getCuratedArchiveDebunks } from '../engine/data/debunk-service.ts'
import { checkNetworkStatus, type NetworkTelemetryInfo } from '../utils/network.ts'
import type { DebunkKnowledgeEntry, ThreatSpectrumCluster } from '../types.ts'
import { radarScheduler } from '../engine/scheduler/radar-scheduler.ts'
import { getCachedRadarItems, deleteRadarItemFromDB, clearRadarCacheDB } from '../utils/db-adapter.ts'
import { 
  getTacticalBriefingSummary, 
  scoreAndTriageRadarEntries, 
  type TacticalBriefingSummary,
  type RadarTriageStatus 
} from '../engine/radar/early-warning-scorer.ts'

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
  const [selectedTriage, setSelectedTriage] = useState<RadarTriageStatus | 'ALL'>('ALL')
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

  // State Pop-up Notifikasi Intelijen Taktis
  const [isBriefingModalOpen, setIsBriefingModalOpen] = useState<boolean>(false)
  const [briefingSummary, setBriefingSummary] = useState<TacticalBriefingSummary | null>(null)

  // Fungsi sinkronisasi radar via RadarScheduler
  const triggerSync = async () => {
    setIsSyncing(true)
    const net = await checkNetworkStatus()
    setTelemetry(net)

    try {
      const entries = await radarScheduler.triggerNow()
      if (entries && entries.length > 0) {
        const triaged = scoreAndTriageRadarEntries(entries)
        setDebunkItems(triaged)
        const summary = getTacticalBriefingSummary(triaged)
        setBriefingSummary(summary)
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

  // Muat cache lokal IndexedDB saat awal buka & Buka Pop-up Notifikasi Briefing Otomatis
  useEffect(() => {
    getCachedRadarItems()
      .then((cached) => {
        if (cached && cached.length > 0) {
          const triaged = scoreAndTriageRadarEntries(cached)
          setDebunkItems(triaged)
          const summary = getTacticalBriefingSummary(triaged)
          setBriefingSummary(summary)

          // Cek apakah briefing sudah dilihat sesi ini
          const seen = sessionStorage.getItem('narada_briefing_seen_session')
          if (!seen && summary.totalScanned > 0) {
            setIsBriefingModalOpen(true)
            sessionStorage.setItem('narada_briefing_seen_session', 'true')
          }
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
      const triaged = scoreAndTriageRadarEntries(newEntries)
      setDebunkItems(triaged)
      const summary = getTacticalBriefingSummary(triaged)
      setBriefingSummary(summary)
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

  // Hapus satu entri radar tertentu (Operator Lifecycle)
  const handleDeleteItem = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    await deleteRadarItemFromDB(id)
    setDebunkItems(prev => prev.filter(item => item.id !== id))
  }

  // Bersihkan isu yang sudah tuntas (FAKTA & NETRAL) dari buffer
  const handleClearCompletedBuffer = async () => {
    const remaining = debunkItems.filter(item => item.verdict === 'UNVERIFIED' || item.verdict === 'HOAKS')
    const completed = debunkItems.filter(item => item.verdict === 'FAKTA' || item.verdict === 'NETRAL')
    
    for (const item of completed) {
      await deleteRadarItemFromDB(item.id)
    }
    
    setDebunkItems(remaining)
    const summary = getTacticalBriefingSummary(remaining)
    setBriefingSummary(summary)
  }

  // Bersihkan seluruh antrean buffer radar secara total
  const handleClearAllBuffer = async () => {
    if (window.confirm('Bersihkan seluruh buffer isu radar saat ini?')) {
      await clearRadarCacheDB()
      setDebunkItems([])
      setBriefingSummary(null)
    }
  }

  // Filter isu berdasarkan status triage, klaster, dan query pencarian
  const filteredItems = useMemo(() => {
    return debunkItems.filter(item => {
      const matchCluster = selectedCluster === 'ALL' || item.cluster === selectedCluster
      const matchTriage = selectedTriage === 'ALL' || item.verdict === selectedTriage
      const query = searchQuery.trim().toLowerCase()
      const matchQuery = !query || 
        item.claim.toLowerCase().includes(query) ||
        item.clarification.toLowerCase().includes(query) ||
        item.officialSource.toLowerCase().includes(query) ||
        item.keywords.some(k => k.toLowerCase().includes(query))

      return matchCluster && matchTriage && matchQuery
    })
  }, [debunkItems, selectedCluster, selectedTriage, searchQuery])

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

  // Hitung jumlah item per status triage
  const triageCounts = useMemo(() => {
    const counts = { ALL: debunkItems.length, HOAKS: 0, FAKTA: 0, UNVERIFIED: 0, NETRAL: 0 }
    debunkItems.forEach(i => {
      if (i.verdict === 'HOAKS' || i.verdict === 'DISINFORMASI' || i.verdict === 'PROPAGANDA') counts.HOAKS++
      else if (i.verdict === 'FAKTA') counts.FAKTA++
      else if (i.verdict === 'NETRAL') counts.NETRAL++
      else counts.UNVERIFIED++
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
              MODUL 2: EARLY-WARNING RADAR & VIRAL COGNITIVE THREAT
            </span>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              PUSSIBERAD TNI AD × GOOGLE TRENDS ID × GOOGLE NEWS HANKAM × MAFINDO
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
            Radar Berita Viral & Early-Warning Intelijen
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '820px', marginTop: '2px' }}>
            Pusat pemantauan otomatis arus informasi viral nasional, mendeteksi potensi penggiringan opini publik dan hoaks sebelum mengeskalasi menjadi krisis kognitif.
          </p>
        </div>

        {/* Telemetri Live Status Strip & Tombol Briefing Popup */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Tombol Buka Pop-up Notifikasi Intelijen */}
          <button
            type="button"
            onClick={() => setIsBriefingModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.45)',
              borderRadius: 'var(--radius-pill)',
              color: '#FCA5A5',
              cursor: 'pointer',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              transition: 'all 0.15s ease'
            }}
          >
            <ShieldAlert size={14} color="#EF4444" />
            <span>LAPORAN INTELIJEN TERKINI ({triageCounts.HOAKS + triageCounts.UNVERIFIED})</span>
          </button>

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
              {debunkItems.length} ISU AKTIF DALAM BUFFER
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
              {sourceChannel === 'API_DIRECT' ? 'LIVE RSS MULTI-STREAM' : sourceChannel === 'API_PROXY' ? 'VITE PROXY STREAM' : 'LOCAL OFFLINE CACHE'}
            </span>
            <span style={{ color: '#2D3848' }}>│</span>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#94A3B8' }}>
              SYNC: {lastSyncTime}
            </span>
          </div>
        </div>
      </div>

      {/* ─── 2. Control Bar Sasis Plat Baja (Sync, Auto-Update, Search, Buffer Purge) ─── */}
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
          {/* Tombol Sinkronisasi Manual, Selector Interval, & Bersihkan Buffer */}
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
              <span>{isSyncing ? 'Menyinkronkan...' : 'Pindai Isu Terkini'}</span>
            </button>

            {/* Tombol Bersihkan Buffer Isu Tuntas */}
            <button
              type="button"
              onClick={handleClearCompletedBuffer}
              title="Hapus isu yang sudah terverifikasi fakta atau netral agar buffer tetap fokus pada potensi ancaman"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                padding: '7px 12px',
                background: '#1A2332',
                border: '1px solid #2B384E',
                color: '#94A3B8',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              <Trash2 size={13} color="#94A3B8" />
              <span>Bersihkan Isu Tuntas ({triageCounts.FAKTA + triageCounts.NETRAL})</span>
            </button>

            {/* Tombol Reset Buffer Total */}
            {debunkItems.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllBuffer}
                title="Kosongkan seluruh buffer isu saat ini"
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  padding: '7px 10px',
                  background: 'transparent',
                  border: '1px solid #2B384E',
                  color: '#64748B',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Reset Buffer
              </button>
            )}

            {/* Selector Interval Pembaruan Otomatis */}
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
                <option value={1}>Auto-Sync: 1 Jam (Rekomendasi)</option>
                <option value={2}>Auto-Sync: 2 Jam</option>
                <option value={6}>Auto-Sync: 6 Jam</option>
                <option value={0}>Auto-Sync: Nonaktif (Manual Saja)</option>
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
              placeholder="Cari isu viral, klaim, atau rujukan..."
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

        {/* Garis Pembatas */}
        <div style={{ height: '1px', background: '#1E2734' }} />

        {/* ─── Filter Status Triage & Filter Klaster ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Baris 1: Filter Status Triage */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Eye size={11} /> STATUS TRIAGE:
            </span>
            {[
              { key: 'ALL', label: 'Semua Status', count: triageCounts.ALL, color: '#94A3B8' },
              { key: 'HOAKS', label: 'Terindikasi Hoaks', count: triageCounts.HOAKS, color: '#EF4444' },
              { key: 'UNVERIFIED', label: 'Sedang Dipantau', count: triageCounts.UNVERIFIED, color: '#F59E0B' },
              { key: 'FAKTA', label: 'Fakta Terkonfirmasi', count: triageCounts.FAKTA, color: '#10B981' },
              { key: 'NETRAL', label: 'Pembicaraan Netral', count: triageCounts.NETRAL, color: '#64748B' },
            ].map(tab => {
              const isSelected = selectedTriage === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSelectedTriage(tab.key as typeof selectedTriage)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    border: '1px solid',
                    borderColor: isSelected ? tab.color : '#232D3B',
                    background: isSelected ? `${tab.color}25` : '#101620',
                    color: isSelected ? '#FFFFFF' : '#94A3B8',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>{tab.label}</span>
                  <span style={{
                    fontSize: '9px',
                    padding: '1px 5px',
                    borderRadius: '2px',
                    background: isSelected ? tab.color : '#1C2532',
                    color: isSelected ? '#000000' : '#64748B',
                    fontWeight: 800
                  }}>
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Baris 2: Filter Klaster Spektrum Kognitif */}
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
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '9.5px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    border: '1px solid',
                    borderColor: isSelected ? opt.color : '#1E2734',
                    background: isSelected ? `${opt.color}20` : '#0D131C',
                    color: isSelected ? '#FFFFFF' : '#64748B',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <span>{opt.label}</span>
                  <span style={{
                    fontSize: '8.5px',
                    padding: '0 4px',
                    borderRadius: '2px',
                    background: isSelected ? opt.color : '#17202C',
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
              Buffer Bersih: Tidak Ada Isu pada Filter Ini
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
              Seluruh isu telah ditangani atau disaring. Klik "Pindai Isu Terkini" untuk menyerap arus baru.
            </div>
          </div>
        ) : (
          filteredItems.map(item => {
            const isHoax = item.verdict === 'HOAKS' || item.verdict === 'DISINFORMASI' || item.verdict === 'PROPAGANDA'
            const isFact = item.verdict === 'FAKTA'
            const isUnverified = item.verdict === 'UNVERIFIED'
            
            const verdictLabel = isHoax ? 'TERINDIKASI HOAKS' : isFact ? 'FAKTA RESMI' : isUnverified ? 'SEDANG DIPANTAU' : 'NETRAL'
            const verdictColor = isHoax ? '#EF4444' : isFact ? '#10B981' : isUnverified ? '#F59E0B' : '#94A3B8'
            const verdictBg = isHoax ? 'rgba(239, 68, 68, 0.15)' : isFact ? 'rgba(16, 185, 129, 0.15)' : isUnverified ? 'rgba(245, 158, 11, 0.15)' : 'rgba(148, 163, 184, 0.15)'
            const verdictBorder = isHoax ? 'rgba(239, 68, 68, 0.45)' : isFact ? 'rgba(16, 185, 129, 0.45)' : isUnverified ? 'rgba(245, 158, 11, 0.45)' : 'rgba(148, 163, 184, 0.45)'

            const score = item.cognitiveScore ?? 50
            const scoreColor = score >= 75 ? '#EF4444' : score >= 50 ? '#F59E0B' : '#10B981'

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
                  gap: '12px',
                  borderTop: score >= 75 ? '2px solid #EF4444' : '1px solid #1E2734'
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

                    {/* Lencana Vonis & Indeks Ancaman */}
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
                        {verdictLabel}
                      </span>

                      {/* Skor Ancaman Kognitif */}
                      <span style={{
                        fontSize: '9px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        padding: '2px 5px',
                        borderRadius: '2px',
                        background: `${scoreColor}18`,
                        color: scoreColor,
                        border: `1px solid ${scoreColor}40`
                      }} title="Indeks Ancaman Kognitif (0 - 100)">
                        R: {score}
                      </span>
                    </div>
                  </div>

                  {/* Dasar Kelayakan Masuk Radar Viral (Virality Reason) */}
                  {item.viralityReason && (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '9px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      color: item.viralityReason.includes('🚨') ? '#FCA5A5' : item.viralityReason.includes('🔥') ? '#FCD34D' : '#93C5FD',
                      background: item.viralityReason.includes('🚨') ? 'rgba(239, 68, 68, 0.14)' : item.viralityReason.includes('🔥') ? 'rgba(245, 158, 11, 0.14)' : 'rgba(59, 130, 246, 0.14)',
                      border: `1px solid ${item.viralityReason.includes('🚨') ? 'rgba(239, 68, 68, 0.35)' : item.viralityReason.includes('🔥') ? 'rgba(245, 158, 11, 0.35)' : 'rgba(59, 130, 246, 0.35)'}`,
                      padding: '2px 7px',
                      borderRadius: '3px',
                      marginBottom: '8px',
                      letterSpacing: '0.3px'
                    }}>
                      <span>{item.viralityReason}</span>
                    </div>
                  )}

                  {/* Naskah / Klaim Isu Viral */}
                  <div style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#F1F5F9',
                    lineHeight: 1.45,
                    marginBottom: '8px'
                  }}>
                    {item.claim}
                  </div>

                  {/* Indikator Lonjakan Tren jika ada */}
                  {item.trendTraffic && (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '9.5px',
                      fontFamily: 'var(--font-mono)',
                      color: '#F59E0B',
                      background: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      marginBottom: '8px'
                    }}>
                      <Flame size={11} color="#F59E0B" />
                      <span>Lonjakan Tren Pencarian: {item.trendTraffic}</span>
                    </div>
                  )}

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
                      color: isFact ? '#10B981' : isHoax ? '#EF4444' : '#F59E0B',
                      marginBottom: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      {isFact ? <CheckCircle size={12} color="#10B981" /> : isHoax ? <AlertTriangle size={12} color="#EF4444" /> : <Eye size={12} color="#F59E0B" />}
                      {isFact ? 'FAKTA / KLARIFIKASI RESMI:' : isHoax ? 'BUKTI FABRIKASI / DISINFORMASI:' : 'STATUS PEMANTAUAN INTELIJEN:'}
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

                  {/* Rekomendasi Taktis Militer */}
                  {item.tacticalResponseMilitary && (
                    <div style={{
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      color: '#CBD5E1',
                      background: 'rgba(15, 23, 42, 0.6)',
                      borderLeft: '2px solid #D97706',
                      padding: '5px 8px',
                      borderRadius: '2px',
                      lineHeight: 1.4
                    }}>
                      <span style={{ color: '#F59E0B', fontWeight: 700 }}>ATENSI: </span>
                      {item.tacticalResponseMilitary}
                    </div>
                  )}
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
                  {/* Tanggal / Link Sumber Asli (CANONICAL URL YANG VALID) */}
                  <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={11} />
                    <span>{item.publishedDate ? item.publishedDate.substring(0, 10) : 'Terkini'}</span>
                    {item.sourceUrl && item.sourceUrl.startsWith('http') && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Buka artikel sumber berita asli di tab baru"
                        style={{ 
                          color: '#3B82F6', 
                          marginLeft: '6px', 
                          display: 'inline-flex', 
                          alignItems: 'center',
                          gap: '3px',
                          textDecoration: 'none',
                          fontWeight: 700,
                          fontSize: '10px'
                        }}
                      >
                        <ExternalLink size={11} />
                        <span>Sumber Asli ↗</span>
                      </a>
                    )}
                  </div>

                  {/* Tombol Aksi Operator: Hapus Isu & Bawa ke Analyzer */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteItem(item.id, e)}
                      title="Hapus isu ini dari buffer pemantauan radar"
                      style={{
                        background: 'transparent',
                        border: '1px solid #283344',
                        color: '#64748B',
                        padding: '4px 6px',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#EF4444'
                        e.currentTarget.style.borderColor = '#EF4444'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#64748B'
                        e.currentTarget.style.borderColor = '#283344'
                      }}
                    >
                      <Trash2 size={12} />
                    </button>

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
                      <span>Uji di Analyzer</span>
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ─── 4. MODAL POP-UP NOTIFIKASI INTELIJEN TAKTIS (Saat Halaman Dibuka) ─── */}
      {isBriefingModalOpen && briefingSummary && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(4, 7, 11, 0.82)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div 
            className="steel-chassis-card"
            style={{
              width: '100%',
              maxWidth: '680px',
              padding: '24px',
              position: 'relative',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(239, 68, 68, 0.15)',
              border: '1px solid #334155'
            }}
          >
            <span className="bolt-tl" />
            <span className="bolt-tr" />
            <span className="bolt-bl" />
            <span className="bolt-br" />

            {/* Header Pop-up */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: '16px',
              borderBottom: '1px solid #1E2734',
              paddingBottom: '12px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '2px',
                    background: '#C8102E',
                    color: '#FFFFFF'
                  }}>
                    INTEL BRIEFING
                  </span>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#94A3B8' }}>
                    WAKTU PINDAI: {briefingSummary.lastScannedTime}
                  </span>
                </div>
                <h2 style={{
                  fontSize: '18px',
                  fontFamily: 'var(--font-display)',
                  color: '#F1F5F9',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  margin: 0
                }}>
                  <ShieldAlert size={20} color="#EF4444" />
                  Laporan Intelijen: Status Triage Isu Viral
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsBriefingModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Peringatan Siaga Kritis jika ada */}
            {briefingSummary.criticalCount > 0 && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.45)',
                borderRadius: '4px',
                padding: '10px 14px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <AlertTriangle size={18} color="#EF4444" />
                <span style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: '#FCA5A5', fontWeight: 700 }}>
                  PERHATIAN: Ditemukan {briefingSummary.criticalCount} isu dalam level SIAGA KRITIS kedaulatan/agitasi publik yang memerlukan tindakan penyeimbang Dispenad!
                </span>
              </div>
            )}

            {/* Ringkasan Matriks Status (4 Kotak Taktis) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '10px',
              marginBottom: '18px'
            }}>
              <div style={{ background: '#121924', border: '1px solid #1E293B', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#EF4444', fontFamily: 'var(--font-mono)' }}>
                  {briefingSummary.hoaxCount}
                </div>
                <div style={{ fontSize: '9.5px', color: '#94A3B8', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  TERINDIKASI HOAKS
                </div>
              </div>

              <div style={{ background: '#121924', border: '1px solid #1E293B', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#F59E0B', fontFamily: 'var(--font-mono)' }}>
                  {briefingSummary.unverifiedCount}
                </div>
                <div style={{ fontSize: '9.5px', color: '#94A3B8', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  SEDANG DIPANTAU
                </div>
              </div>

              <div style={{ background: '#121924', border: '1px solid #1E293B', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#10B981', fontFamily: 'var(--font-mono)' }}>
                  {briefingSummary.factCount}
                </div>
                <div style={{ fontSize: '9.5px', color: '#94A3B8', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  FAKTA RESMI
                </div>
              </div>

              <div style={{ background: '#121924', border: '1px solid #1E293B', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                  {briefingSummary.neutralCount}
                </div>
                <div style={{ fontSize: '9.5px', color: '#64748B', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  NETRAL / UMUM
                </div>
              </div>
            </div>

            {/* Protokol Penapisan Radar (Gatekeeper Criteria) */}
            <div style={{
              background: '#0B111A',
              border: '1px solid #1E293B',
              borderRadius: '4px',
              padding: '10px 14px',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: '#38BDF8', fontWeight: 800, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={14} color="#38BDF8" />
                KRITERIA KELAYAKAN RADAR VIRAL & ANCAMAN KOGNITIF (LEFT-OF-BANG):
              </div>
              <div style={{ fontSize: '10.5px', color: '#94A3B8', lineHeight: 1.5 }}>
                Radar ini tidak memuat rilis humas atau seremonial biasa. Isu yang masuk wajib memenuhi minimal 1 dari 3 gerbang: (1) <strong>Lonjakan Penelusuran Publik</strong> (+2K–+200K netizen via Google Trends ID), (2) <strong>Laporan Disinformasi Masif</strong> (TurnBackHoax/Mafindo), atau (3) <strong>Polemik Kebijakan/Hankam Berisiko Tinggi</strong> dengan skor ancaman kognitif R ≥ 50.
              </div>
            </div>

            {/* Cuplikan Isu Paling Kritis / Headline Utama */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: '#CBD5E1', fontWeight: 700, marginBottom: '8px' }}>
                3 ISU DENGAN INDEKS ANCAMAN KOGNITIF TERTINGGI:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {briefingSummary.headlineItems.map((item, idx) => (
                  <div 
                    key={item.id}
                    style={{
                      background: '#090D13',
                      border: '1px solid #1F2937',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#D97706', fontWeight: 800 }}>
                        #{idx + 1}
                      </span>
                      <span style={{ fontSize: '11.5px', color: '#F1F5F9', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.claim}
                      </span>
                    </div>
                    <span style={{
                      fontSize: '9px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '2px',
                      background: item.verdict === 'HOAKS' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: item.verdict === 'HOAKS' ? '#EF4444' : '#F59E0B',
                      flexShrink: 0
                    }}>
                      SKOR: {item.cognitiveScore || 70}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tombol Aksi Taktis Modal */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid #1E2734',
              paddingTop: '16px',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <button
                type="button"
                onClick={() => {
                  handleClearCompletedBuffer()
                  setIsBriefingModalOpen(false)
                }}
                style={{
                  background: '#1A2332',
                  border: '1px solid #28374D',
                  color: '#94A3B8',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  padding: '8px 14px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Bersihkan Isu Tuntas ({briefingSummary.factCount + briefingSummary.neutralCount})
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTriage('HOAKS')
                    setIsBriefingModalOpen(false)
                  }}
                  style={{
                    background: '#C8102E',
                    border: '1px solid #DC2626',
                    color: '#FFFFFF',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    padding: '8px 14px',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Tinjau Isu Kritis Saja
                </button>

                <button
                  type="button"
                  onClick={() => setIsBriefingModalOpen(false)}
                  style={{
                    background: '#0F172A',
                    border: '1px solid #334155',
                    color: '#E2E8F0',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    padding: '8px 14px',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Masuk ke Layar Radar Penuh
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 5. Footer Aksen Taktis ─── */}
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
