import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Radio,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  Building,
  Clock,
  Filter,
  Database,
  Trash2,
  AlertTriangle,
  X,
  Flame,
  ShieldAlert,
  Eye,
  CheckCircle,
  Microscope,
  Megaphone,
  Copy,
  Check,
  Users,
  Share2,
  MessageSquare
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
import { type CounterNarrativeChannels, generateCounterNarratives } from '../engine/forensic/counter-narrative-generator.ts'

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
  const [selectedTriage, setSelectedTriage] = useState<RadarTriageStatus | 'ALL' | 'RESOLVED'>('ALL')
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

  // State Pop-up Draf Kontranarasi Dispenad (untuk Isu TERINDIKASI HOAKS)
  const [selectedCounterItem, setSelectedCounterItem] = useState<DebunkKnowledgeEntry | null>(null)
  const [isCounterModalOpen, setIsCounterModalOpen] = useState<boolean>(false)
  const [counterChannels, setCounterChannels] = useState<CounterNarrativeChannels | null>(null)
  const [activeCounterTab, setActiveCounterTab] = useState<'dispenad' | 'babinsa' | 'whatsapp' | 'social'>('dispenad')
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false)

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

  // Handler Buka Halaman Khusus Bedah Buzzer & Medsos (untuk Isu SEDANG DIPANTAU)
  const handleOpenBuzzerModal = (item: DebunkKnowledgeEntry) => {
    navigate('/social-forensic', { state: { targetItem: item, item } })
  }

  // Sinkronisasi pembaruan status isu seketika dari Monitoring Chamber
  useEffect(() => {
    const handleStatusChange = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string; status: string }>).detail
      if (detail?.id && detail?.status) {
        setDebunkItems((prev) =>
          prev.map((it) => (it.id === detail.id ? { ...it, triageStatus: detail.status as any } : it))
        )
      }
    }
    window.addEventListener('narada:radar-status-changed', handleStatusChange)
    return () => window.removeEventListener('narada:radar-status-changed', handleStatusChange)
  }, [])

  // Handler Buka Modal Draf Kontranarasi Dispenad (untuk Isu TERINDIKASI HOAKS)
  const handleOpenCounterModal = (item: DebunkKnowledgeEntry) => {
    setSelectedCounterItem(item)
    const drafts = generateCounterNarratives(
      item.claim,
      {
        claim: item.claim,
        clarification: item.clarification,
        officialSource: item.officialSource,
        sourceUrl: item.sourceUrl,
        cluster: item.cluster
      },
      item.originalPlatform || 'MEDIA SOSIAL'
    )
    setCounterChannels(drafts)
    setActiveCounterTab('dispenad')
    setIsCounterModalOpen(true)
  }

  // Handler Salin Draf Kontranarasi ke Clipboard
  const handleCopyCounterText = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSuccess(true)
    setTimeout(() => setCopiedSuccess(false), 2200)
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
      const matchTriage = selectedTriage === 'ALL' 
        ? true 
        : selectedTriage === 'RESOLVED' 
        ? (item.verdict === 'FAKTA' || item.verdict === 'NETRAL')
        : item.verdict === selectedTriage
      const query = searchQuery.trim().toLowerCase()
      const matchQuery = !query || 
        item.claim.toLowerCase().includes(query) ||
        item.clarification.toLowerCase().includes(query) ||
        item.officialSource.toLowerCase().includes(query) ||
        (item.originalPlatform && item.originalPlatform.toLowerCase().includes(query)) ||
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
      {/* ─── 1. Header Komando Radar (Desktop Mission Control UI) ─── */}
      <div style={{
        marginBottom: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '20px',
            fontWeight: 800,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            margin: 0
          }}>
            <Radio size={20} color="#3B82F6" />
            Radar Berita Viral & Early-Warning Intelijen
          </h1>
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

      {/* ─── 2A. Sasis Plat Baja: Deck Operasi Kontrol Buffer & Sinkronisasi ─── */}
      <div 
        className="steel-chassis-card"
        style={{
          padding: '12px 18px',
          marginBottom: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          position: 'relative'
        }}
      >
        <span className="bolt-tl" />
        <span className="bolt-tr" />
        <span className="bolt-bl" />
        <span className="bolt-br" />

        {/* Header Label Deck Operasi */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1E2734', paddingBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--accent-gold)', fontSize: '11px', fontWeight: 800, letterSpacing: '1.5px' }}>///</span>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F1F5F9', letterSpacing: '0.5px' }}>
              DECK OPERASI KONTROL BUFFER & SINKRONISASI
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
            <span>TELEMETRI KANAL:</span>
            <span style={{ color: telemetry.status === 'ONLINE' ? '#10B981' : '#F59E0B', fontWeight: 700 }}>
              {telemetry.status} ({telemetry.latencyMs}ms)
            </span>
          </div>
        </div>

        {/* Baris Tombol Aksi Siklus Hidup Buffer (Sesuai Permintaan Pengguna) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Tombol Pindai Isu Terkini */}
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

          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
            STATUS SINKRONISASI: <span style={{ color: '#94A3B8', fontWeight: 600 }}>{lastSyncTime}</span>
          </div>
        </div>
      </div>

      {/* ─── 2B. Sasis Plat Baja: Deck Filter Spektrum & Konsol Pencarian ─── */}
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
          {/* Label Filter Spektrum */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--accent-gold)', fontSize: '11px', fontWeight: 800, letterSpacing: '1.5px' }}>///</span>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F1F5F9', letterSpacing: '0.5px' }}>
              DECK FILTER SPEKTRUM & KONSOL PENCARIAN
            </span>
          </div>

          {/* Input Pencarian Klaim / Kata Kunci */}
          <div style={{
            position: 'relative',
            width: '320px',
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

        {/* ─── Filter Status Triage Sederhana, Besar, & Tegas (Command Center Tabs) ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Baris 1: 4 Status Utama Triage - Ukuran Besar & Jelas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { key: 'ALL', label: 'SEMUA ISU AKTIF', count: triageCounts.ALL, color: '#38BDF8', icon: Radio },
              { key: 'UNVERIFIED', label: 'SEDANG DIPANTAU', count: triageCounts.UNVERIFIED, color: '#F59E0B', icon: Eye },
              { key: 'HOAKS', label: 'TERINDIKASI HOAKS', count: triageCounts.HOAKS, color: '#EF4444', icon: AlertTriangle },
              { key: 'RESOLVED', label: 'FAKTA & AMAN', count: triageCounts.FAKTA + triageCounts.NETRAL, color: '#10B981', icon: ShieldCheck },
            ].map(tab => {
              const isSelected = selectedTriage === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSelectedTriage(tab.key as typeof selectedTriage)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800,
                    border: '1px solid',
                    borderColor: isSelected ? tab.color : '#253244',
                    background: isSelected ? `${tab.color}25` : '#101620',
                    color: isSelected ? '#FFFFFF' : '#94A3B8',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: isSelected ? `0 0 12px ${tab.color}35` : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <tab.icon size={13} color={isSelected ? tab.color : '#64748B'} />
                  <span>{tab.label}</span>
                  <span style={{
                    fontSize: '10px',
                    padding: '1px 6px',
                    borderRadius: '3px',
                    background: isSelected ? tab.color : '#1A2330',
                    color: isSelected ? '#000000' : '#CBD5E1',
                    fontWeight: 900
                  }}>
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Baris 2: Klaster Spektrum Cerdas (Hanya Menampilkan Klaster yang Ada Isunya / count > 0) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Filter size={11} /> KLASTER TERDETEKSI:
            </span>
            {CLUSTER_OPTIONS
              .filter(opt => opt.key === 'ALL' || (clusterCounts[opt.key] ?? 0) > 0)
              .map(opt => {
                const isSelected = selectedCluster === opt.key
                const count = clusterCounts[opt.key] ?? 0
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSelectedCluster(opt.key)}
                    style={{
                      padding: '3px 9px',
                      borderRadius: '3px',
                      fontSize: '9.5px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      border: '1px solid',
                      borderColor: isSelected ? opt.color : '#1E2734',
                      background: isSelected ? `${opt.color}20` : '#0B1017',
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
                      background: isSelected ? opt.color : '#16202C',
                      color: isSelected ? '#000000' : '#94A3B8',
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
                    marginBottom: '8px',
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

                  {/* Audit Trail Dual-Timestamp (Penangkapan vs Verifikasi) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 8px',
                    background: '#0B111A',
                    border: '1px solid #1E2734',
                    borderRadius: '3px',
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    marginBottom: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94A3B8' }}>
                      <Clock size={10} color="#38BDF8" />
                      <span>DITANGKAP: <strong style={{ color: '#E2E8F0' }}>{item.interceptedAt || '18:15 WIB'}</strong></span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94A3B8' }}>
                      <ShieldCheck size={10} color={verdictColor} />
                      <span>DIKLASIFIKASI: <strong style={{ color: verdictColor }}>{item.verifiedAt || '18:22 WIB'}</strong></span>
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

                  {/* Esensi Viralitas Nyata (Kotak Metrik Media Sosial / Engagement Velocity) */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '4px',
                    padding: '6px 8px',
                    background: '#0D141F',
                    border: '1px solid #1E293B',
                    borderRadius: '4px',
                    marginBottom: '8px',
                    textAlign: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>ESTIMASI VIEWS</div>
                      <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                        <Flame size={10} color="#F59E0B" />
                        {item.engagement?.views || item.trendTraffic || '+45K'}
                      </div>
                    </div>
                    <div style={{ borderLeft: '1px solid #1A2433', borderRight: '1px solid #1A2433' }}>
                      <div style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>SEBARAN / REPOST</div>
                      <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#38BDF8' }}>
                        {item.engagement?.shares || '2.8K'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>AKSELERASI TREN</div>
                      <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#10B981' }}>
                        {item.engagement?.velocityRate || '+160%/jam'}
                      </div>
                    </div>
                  </div>

                  {/* Sunken Box Penjelasan Fakta / Status Intelijen */}
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
                  </div>

                  {/* Dual-Source Cyber Audit Plate (Menggantikan Bagian ATENSI Sesuai Arahan Operator) */}
                  <div style={{
                    background: '#0B111A',
                    border: '1px solid #1E2734',
                    borderRadius: '4px',
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    fontSize: '9.5px',
                    fontFamily: 'var(--font-mono)'
                  }}>
                    {/* Baris 1: Asal Pantauan */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
                        <Radio size={11} color="#38BDF8" style={{ flexShrink: 0 }} />
                        <span style={{ color: '#64748B' }}>Asal Pantauan:</span>
                        <span style={{ color: '#E2E8F0', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.originalPlatform || 'Portal Berita / Media Sosial'}
                        </span>
                      </div>
                      {(item.originalSourceUrl || item.sourceUrl) && (
                        <a
                          href={item.originalSourceUrl || item.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Tinjau postingan/berita asal saat pertama kali tertangkap radar"
                          style={{
                            color: '#38BDF8',
                            background: 'rgba(56, 189, 248, 0.12)',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            padding: '2px 7px',
                            borderRadius: '3px',
                            textDecoration: 'none',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            flexShrink: 0,
                            fontSize: '9px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <ExternalLink size={9} />
                          <span>Buka Asal ↗</span>
                        </a>
                      )}
                    </div>

                    {/* Baris 2: Rujukan Validasi Otoritas */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', paddingTop: '5px', borderTop: '1px solid #141C26' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
                        <Building size={11} color="#10B981" style={{ flexShrink: 0 }} />
                        <span style={{ color: '#64748B' }}>Rujukan Validasi:</span>
                        <span style={{ color: '#F1F5F9', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.officialSource}
                        </span>
                      </div>
                      {item.sourceUrl && (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Buka bukti dokumen rujukan klarifikasi fakta resmi"
                          style={{
                            color: '#10B981',
                            background: 'rgba(16, 185, 129, 0.12)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            padding: '2px 7px',
                            borderRadius: '3px',
                            textDecoration: 'none',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            flexShrink: 0,
                            fontSize: '9px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <ExternalLink size={9} />
                          <span>Buka Fakta ↗</span>
                        </a>
                      )}
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
                  {/* Tanggal & Jam Terbit Presisi */}
                  <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={11} color="#94A3B8" />
                    <span style={{ color: '#94A3B8' }}>{item.publishedDate || '27 Okt 2026, 14:22 WIB'}</span>
                  </div>

                  {/* Tombol Aksi Operator: Hapus Isu & Tri-State Command Button */}
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

                    {/* Tri-State Action Buttons Sesuai Triage Status */}
                    {isUnverified ? (
                      <button
                        type="button"
                        onClick={() => handleOpenBuzzerModal(item)}
                        style={{
                          background: 'rgba(245, 158, 11, 0.15)',
                          border: '1px solid rgba(245, 158, 11, 0.45)',
                          color: '#FBBF24',
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
                          e.currentTarget.style.background = '#D97706'
                          e.currentTarget.style.color = '#FFFFFF'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)'
                          e.currentTarget.style.color = '#FBBF24'
                        }}
                        title="Buka investigasi medsos, periksa sebaran likes/komentar, dan deteksi buzzer/bot swarm"
                      >
                        <Microscope size={11} />
                        <span>Bedah Buzzer & Medsos</span>
                      </button>
                    ) : isHoax ? (
                      <button
                        type="button"
                        onClick={() => handleOpenCounterModal(item)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.16)',
                          border: '1px solid rgba(239, 68, 68, 0.5)',
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
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.16)'
                          e.currentTarget.style.color = '#F87171'
                        }}
                        title="Hasilkan draf rilis resmi bantahan Dispenad, panduan Babinsa, WA, dan medsos kilat"
                      >
                        <Megaphone size={11} />
                        <span>Draf Kontranarasi Dispenad</span>
                      </button>
                    ) : (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid rgba(16, 185, 129, 0.45)',
                          color: '#34D399',
                          fontSize: '10px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: '4px',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#059669'
                          e.currentTarget.style.color = '#FFFFFF'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)'
                          e.currentTarget.style.color = '#34D399'
                        }}
                        title="Buka dokumen verifikasi dan rujukan fakta otoritas resmi"
                      >
                        <ShieldCheck size={11} />
                        <span>Dokumen Fakta Resmi ↗</span>
                      </a>
                    )}
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

      {/* ─── 5. MODAL DRAF KONTRANARASI TAKTIS DISPENAD & BABINSA (Untuk Isu TERINDIKASI HOAKS) ─── */}
      {isCounterModalOpen && selectedCounterItem && counterChannels && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 8, 14, 0.85)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div
            className="steel-chassis-card"
            style={{
              maxWidth: '780px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              position: 'relative',
              background: '#0D131C',
              border: '1px solid #1E2734',
              borderRadius: '8px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)'
            }}
          >
            <span className="bolt-tl" />
            <span className="bolt-tr" />
            <span className="bolt-bl" />
            <span className="bolt-br" />

            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              borderBottom: '1px solid #1E2734',
              paddingBottom: '14px',
              marginBottom: '16px',
              gap: '12px'
            }}>
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px'
                }}>
                  <Megaphone size={18} color="#EF4444" />
                  <span style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '15px',
                    fontWeight: 800,
                    letterSpacing: '0.8px',
                    textTransform: 'uppercase',
                    color: '#F1F5F9'
                  }}>
                    DRAF KONTRANARASI TAKTIS DISPENAD & BABINSA
                  </span>
                  <span style={{
                    fontSize: '9.5px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '2px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#EF4444',
                    border: '1px solid rgba(239, 68, 68, 0.4)'
                  }}>
                    STATUS: TERINDIKASI HOAKS
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                  Formulasi naskah rilis bantahan resmi untuk menangkal hoaks: <strong style={{ color: '#E2E8F0' }}>"{selectedCounterItem.claim}"</strong>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsCounterModalOpen(false)
                  setSelectedCounterItem(null)
                  setCounterChannels(null)
                }}
                style={{
                  background: 'transparent',
                  border: '1px solid #334155',
                  color: '#94A3B8',
                  width: '28px',
                  height: '28px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Kanal Selector Tabs (4 Kanal Komando & Sipil) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
              marginBottom: '14px'
            }}>
              {[
                { key: 'dispenad', label: 'Siaran Pers Dispenad', icon: Building, color: '#EF4444' },
                { key: 'babinsa', label: 'Panduan Komsos Babinsa', icon: Users, color: '#38BDF8' },
                { key: 'whatsapp', label: 'Pesan Warga (WA Forward)', icon: MessageSquare, color: '#10B981' },
                { key: 'social', label: 'Medsos Kilat (<280 Karakter)', icon: Share2, color: '#F59E0B' }
              ].map(tab => {
                const isSelected = activeCounterTab === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveCounterTab(tab.key as any)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      border: '1px solid',
                      borderColor: isSelected ? tab.color : '#1E2734',
                      background: isSelected ? `${tab.color}20` : '#0B1017',
                      color: isSelected ? '#FFFFFF' : '#64748B',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <tab.icon size={12} color={isSelected ? tab.color : '#64748B'} />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Content Display Box (Naskah Terpilih) */}
            <div style={{
              background: '#070B11',
              border: '1px solid #1A2330',
              borderRadius: '6px',
              padding: '16px',
              marginBottom: '16px',
              position: 'relative'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px',
                paddingBottom: '8px',
                borderBottom: '1px solid #141C26'
              }}>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B', fontWeight: 700 }}>
                  FORMAT DOKUMEN: {activeCounterTab.toUpperCase()} PROTOCOL
                </span>

                <button
                  type="button"
                  onClick={() => {
                    const textToCopy = 
                      activeCounterTab === 'dispenad' ? counterChannels.dispenadOfficial :
                      activeCounterTab === 'babinsa' ? counterChannels.babinsaTerritorial :
                      activeCounterTab === 'whatsapp' ? counterChannels.whatsappCivilian :
                      counterChannels.socialTactical
                    handleCopyCounterText(textToCopy)
                  }}
                  style={{
                    background: copiedSuccess ? '#10B981' : '#1E293B',
                    border: `1px solid ${copiedSuccess ? '#10B981' : '#334155'}`,
                    color: copiedSuccess ? '#000000' : '#E2E8F0',
                    fontSize: '10.5px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {copiedSuccess ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedSuccess ? 'Tersalin ke Clipboard!' : 'Salin Teks Draf'}</span>
                </button>
              </div>

              <pre style={{
                margin: 0,
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                color: '#CBD5E1',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '340px',
                overflowY: 'auto'
              }}>
                {activeCounterTab === 'dispenad' && counterChannels.dispenadOfficial}
                {activeCounterTab === 'babinsa' && counterChannels.babinsaTerritorial}
                {activeCounterTab === 'whatsapp' && counterChannels.whatsappCivilian}
                {activeCounterTab === 'social' && counterChannels.socialTactical}
              </pre>
            </div>

            {/* Modal Action Footer */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid #1E2734',
              paddingTop: '14px',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              {selectedCounterItem.sourceUrl ? (
                <a
                  href={selectedCounterItem.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    color: '#10B981',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 700
                  }}
                >
                  <ExternalLink size={12} />
                  <span>Buka Dokumen Rujukan Validasi Resmi</span>
                </a>
              ) : <div />}

              <button
                type="button"
                onClick={() => {
                  setIsCounterModalOpen(false)
                  setSelectedCounterItem(null)
                  setCounterChannels(null)
                }}
                style={{
                  background: '#0F172A',
                  border: '1px solid #334155',
                  color: '#E2E8F0',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Tutup Jendela
              </button>
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
