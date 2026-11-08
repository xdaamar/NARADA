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
  MessageSquare,
  TrendingUp,
  Activity,
  Plus,
  Compass,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { getCuratedArchiveDebunks } from '../engine/data/debunk-service.ts'
import { checkNetworkStatus, type NetworkTelemetryInfo } from '../utils/network.ts'
import type { DebunkKnowledgeEntry, ThreatSpectrumCluster } from '../types.ts'
import { radarScheduler, type SourceScheduleState } from '../engine/scheduler/radar-scheduler.ts'
import { getCachedRadarItems, deleteRadarItemFromDB, clearRadarCacheDB, saveTopicCandidates, getTopicCandidatesFromDB } from '../utils/db-adapter.ts'
import { 
  getTacticalBriefingSummary, 
  type TacticalBriefingSummary,
  type RadarTriageStatus 
} from '../engine/radar/early-warning-scorer.ts'
import { type CounterNarrativeChannels, generateCounterNarratives } from '../engine/forensic/counter-narrative-generator.ts'
import { getAllConnectorHealth } from '../engine/radar/source-registry.ts'
import { parseSourceDate, evaluateFreshness, sortRadarEntries } from '../engine/radar/freshness-engine.ts'
import type { ConnectorHealth, TopicCandidate, SearchTrendSignal, RadarTaxonomyDomain } from '../engine/radar/radar-types.ts'
import { getOrCreateCaseForCluster } from '../engine/investigation'
import { topicDiscoveryEngine, normalizeCandidatePhrase } from '../engine/radar/topic-discovery-engine.ts'
import { getLastRadarResult, clearKnownPublications } from '../engine/data/live-radar-service.ts'
import { isPureInstitutionOrPublisherName } from '../engine/ingest/rss-parser.ts'

/**
 * Filter penjamin integritas: membuang entri non-berita/nama instansi murni
 * dan mendeduplikasi klaim identik secara kanonikal.
 */
function sanitizeRadarItems(items: DebunkKnowledgeEntry[]): DebunkKnowledgeEntry[] {
  if (!items || !Array.isArray(items)) return []
  const seenClaims = new Set<string>()
  const result: DebunkKnowledgeEntry[] = []
  for (const item of items) {
    if (!item || !item.claim) continue
    if (isPureInstitutionOrPublisherName(item.claim, item.officialSource || item.originalPlatform)) continue
    const key = item.claim.trim().toLowerCase()
    if (!seenClaims.has(key)) {
      seenClaims.add(key)
      result.push(item)
    }
  }
  return sortRadarEntries(result)
}

// ─── Definisi Klaster Spektrum Kognitif ───
interface ClusterFilterOption {
  key: ThreatSpectrumCluster | 'ALL'
  label: string
  color: string
}

const CLUSTER_OPTIONS: ClusterFilterOption[] = [
  { key: 'ALL', label: 'Semua Isu', color: '#94A3B8' },
  { key: 'POLITIK_NEGARA', label: 'Politik & Kebijakan', color: '#F87171' },
  { key: 'KEDAULATAN_MILITER', label: 'Kedaulatan & Hankam', color: '#EF4444' },
  { key: 'AKSI_MASSA', label: 'Aksi Massa & Unjuk Rasa', color: '#FB923C' },
  { key: 'EKONOMI_DIGITAL', label: 'Ekonomi Digital & Pajak', color: '#34D399' },
  { key: 'BENCANA_DARURAT', label: 'Bencana BMKG', color: '#38BDF8' },
  { key: 'PENIPUAN_BANSOS', label: 'Penipuan Bansos', color: '#FBBF24' },
  { key: 'KESEHATAN_PANGAN', label: 'Kesehatan & Pangan', color: '#A78BFA' },
  { key: 'UMUM_NETRAL', label: 'Umum & Kedinasan', color: '#64748B' },
]

export default function LiveRadar() {
  const navigate = useNavigate()

  // State data dan filter (dibersihkan dari entri non-berita/nama instansi murni)
  const [debunkItems, setDebunkItems] = useState<DebunkKnowledgeEntry[]>(() => sanitizeRadarItems(getCuratedArchiveDebunks()))
  const [selectedCluster, setSelectedCluster] = useState<ThreatSpectrumCluster | 'ALL'>('ALL')
  const [selectedTriage, setSelectedTriage] = useState<RadarTriageStatus | 'ALL' | 'RESOLVED'>('ALL')
  const [activeViewMode, setActiveViewMode] = useState<'ALL' | 'MOMENTUM' | 'SUSTAINED' | 'COOLING' | 'INSUFFICIENT_DATA' | 'UNVERIFIED' | 'HOAKS' | 'RESOLVED' | 'TRENDS' | 'WATCHLIST'>('ALL')
  const [trendSignals, setTrendSignals] = useState<SearchTrendSignal[]>([])
  const [topicCandidates, setTopicCandidates] = useState<TopicCandidate[]>([])
  const [sourceScheduleStates, setSourceScheduleStates] = useState<Record<string, SourceScheduleState>>({})
  const [manualPhrase, setManualPhrase] = useState<string>('')
  const [manualDomain, setManualDomain] = useState<RadarTaxonomyDomain>('NATIONAL_POLICY')
  const [manualError, setManualError] = useState<string | null>(null)
  const [candidateFilterStatus, setCandidateFilterStatus] = useState<string>('ALL')

  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [lastSyncTime, setLastSyncTime] = useState<string>('Memuat...')
  const [syncIntervalHours, setSyncIntervalHours] = useState<number>(0.5) // SPRINT 10: Default 30 Menit
  const [telemetry, setTelemetry] = useState<NetworkTelemetryInfo>({
    status: 'ONLINE',
    latencyMs: 14,
    lastChecked: Date.now(),
    isUsingProxy: false,
  })
  const [sourceChannel, setSourceChannel] = useState<'API_PROXY' | 'API_DIRECT' | 'API_CORS_PROXY' | 'LOCAL_ARCHIVE'>('LOCAL_ARCHIVE')
  const [connectorHealth, setConnectorHealth] = useState<Record<string, ConnectorHealth>>(() => getAllConnectorHealth())
  const [isConnectorDetailsOpen, setIsConnectorDetailsOpen] = useState<boolean>(false)

  const connectorSummary = useMemo(() => {
    const list = Object.values(connectorHealth)
    const online = list.filter(c => c.state === 'HEALTHY').length
    const degraded = list.filter(c => c.state === 'DEGRADED' || c.state === 'RATE_LIMITED' || c.state === 'STALE' || c.state === 'CONNECTING').length
    const offline = list.filter(c => c.state === 'UNAVAILABLE').length
    const disabled = list.filter(c => c.state === 'DISABLED').length
    return {
      total: list.length,
      online,
      degraded,
      offline,
      disabled
    }
  }, [connectorHealth])

  // State Pop-up Notifikasi Intelijen Taktis
  const [isBriefingModalOpen, setIsBriefingModalOpen] = useState<boolean>(false)
  const [briefingSummary, setBriefingSummary] = useState<TacticalBriefingSummary | null>(null)

  // State Pop-up Draf Kontranarasi Dispenad (untuk Isu TERINDIKASI HOAKS)
  const [selectedCounterItem, setSelectedCounterItem] = useState<DebunkKnowledgeEntry | null>(null)
  const [isCounterModalOpen, setIsCounterModalOpen] = useState<boolean>(false)
  const [counterChannels, setCounterChannels] = useState<CounterNarrativeChannels | null>(null)
  const [activeCounterTab, setActiveCounterTab] = useState<'dispenad' | 'babinsa' | 'whatsapp' | 'social'>('dispenad')
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false)
  const [syncFeedback, setSyncFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Fungsi sinkronisasi radar via RadarScheduler
  const triggerSync = async (forceClear = false) => {
    setIsSyncing(true)
    setSyncFeedback(null)
    const net = await checkNetworkStatus()
    setTelemetry(net)

    try {
      if (forceClear) {
        await clearRadarCacheDB()
        clearKnownPublications()
      }
      const entries = await radarScheduler.triggerNow()
      if (entries && entries.length > 0) {
        // SPRINT 5 (WP6) & SPRINT 13: Konsumsi hasil kanonikal tersortir dan tervalidasi
        const sorted = sanitizeRadarItems(entries)
        setDebunkItems(sorted)
        const summary = getTacticalBriefingSummary(sorted)
        setBriefingSummary(summary)
        setSyncFeedback({
          message: `Sinkronisasi tuntas: ${sorted.length} isu taktis termutakhir aktif dalam radar.`,
          type: 'success'
        })
      } else {
        setSyncFeedback({
          message: 'Sinkronisasi selesai: Seluruh feed terverifikasi termutakhir.',
          type: 'success'
        })
      }
      const status = radarScheduler.getStatus()
      setSourceChannel(status.lastSyncSource as typeof sourceChannel || 'LOCAL_ARCHIVE')
      setConnectorHealth(getAllConnectorHealth())
      if (status.sourceStates) {
        setSourceScheduleStates(status.sourceStates)
      }
      const lastRes = getLastRadarResult()
      if (lastRes?.trendSignals) {
        setTrendSignals(lastRes.trendSignals)
      }
      setTopicCandidates(topicDiscoveryEngine.getAllCandidates())
      const now = new Date(status.lastSyncTimestamp || Date.now())
      setLastSyncTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} WIB`
      )
    } catch (err: any) {
      console.error('[LiveRadar] Gagal sinkronisasi feed radar:', err)
      setSyncFeedback({
        message: `Gangguan sinkronisasi feed: ${err?.message || 'Koneksi terputus'}`,
        type: 'error'
      })
    } finally {
      setIsSyncing(false)
    }
  }

  // Muat cache lokal IndexedDB saat awal buka & Buka Pop-up Notifikasi Briefing Otomatis
  useEffect(() => {
    getCachedRadarItems()
      .then((cached) => {
        if (cached && cached.length > 0) {
          // SPRINT 5 (WP6) & SPRINT 13: Gunakan entri cache kanonikal tersortir dan tervalidasi
          const sorted = sanitizeRadarItems(cached)
          setDebunkItems(sorted)
          const summary = getTacticalBriefingSummary(sorted)
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

    getTopicCandidatesFromDB()
      .then((stored) => {
        if (stored && stored.length > 0) {
          topicDiscoveryEngine.hydrateCandidates(stored)
          setTopicCandidates(topicDiscoveryEngine.getAllCandidates())
        }
      })
      .catch(() => {})

    triggerSync()
  }, [])

  // Handler Topic Watchlist (Sprint 6 WP5 / WP9)
  const handleAddManualPhrase = async () => {
    if (!manualPhrase.trim()) return
    const norm = normalizeCandidatePhrase(manualPhrase)
    if (!norm.isValid) {
      setManualError(norm.rejectionReason || 'Frasa tidak valid atau melanggar batasan sistem')
      return
    }
    setManualError(null)
    topicDiscoveryEngine.addWatchlistPhrase(norm.cleanedPhrase, manualDomain, 'Ditambahkan manual oleh operator')
    const updated = topicDiscoveryEngine.getAllCandidates()
    try {
      await saveTopicCandidates(updated)
    } catch (e) {
      console.warn('Gagal menyimpan topic candidates ke DB:', e)
    }
    setTopicCandidates([...updated])
    setManualPhrase('')
  }

  const handlePromoteCandidate = async (candidateId: string, status: 'WATCHLIST' | 'ACTIVE_SEARCH') => {
    topicDiscoveryEngine.promoteCandidate(candidateId, status)
    const updated = topicDiscoveryEngine.getAllCandidates()
    try {
      await saveTopicCandidates(updated)
    } catch (e) {
      console.warn('Gagal menyimpan topic candidates ke DB:', e)
    }
    setTopicCandidates([...updated])
  }

  const handleRejectCandidate = async (candidateId: string) => {
    topicDiscoveryEngine.rejectCandidate(candidateId, 'Ditolak oleh operator')
    const updated = topicDiscoveryEngine.getAllCandidates()
    try {
      await saveTopicCandidates(updated)
    } catch (e) {
      console.warn('Gagal menyimpan topic candidates ke DB:', e)
    }
    setTopicCandidates([...updated])
  }

  // Hubungkan RadarScheduler interval dan subscribe ke event siaran
  useEffect(() => {
    radarScheduler.setIntervalHours(syncIntervalHours)

    const unsubscribe = radarScheduler.addListener((newEntries) => {
      // SPRINT 5 (WP6) & SPRINT 13: Sinkronkan data terasemen tersortir dan tervalidasi
      const sorted = sanitizeRadarItems(newEntries)
      setDebunkItems(sorted)
      const summary = getTacticalBriefingSummary(sorted)
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

  // Handler Buka Berkas Investigasi Kasus (untuk Isu SEDANG DIPANTAU / Investigasi Mendalam)
  const handleOpenBuzzerModal = (item: DebunkKnowledgeEntry) => {
    const invCase = getOrCreateCaseForCluster({
      id: item.id,
      title: item.claim || 'Kasus Investigasi Radar',
      summary: item.clarification || item.claim,
      publicationIds: [item.id],
      isSimulation: false
    })
    navigate('/social-forensic', { state: { targetItem: item, item, caseId: invCase.id } })
  }

  // Sinkronisasi pembaruan status isu seketika dari Monitoring Chamber
  useEffect(() => {
    const handleStatusChange = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string; status: string }>).detail
      if (detail?.id && detail?.status) {
        setDebunkItems((prev) =>
          prev.map((it) => (it.id === detail.id ? {
            ...it,
            triageStatus: detail.status as any,
            verdict: detail.status as any,
            queueState: (detail.status === 'UNVERIFIED' ? 'MONITOR' : 'RESOLVED') as any
          } : it))
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
      clearKnownPublications()
      setDebunkItems([])
      setBriefingSummary(null)
    }
  }

  // Filter isu berdasarkan status triage, klaster, view mode, dan query pencarian
  const filteredItems = useMemo(() => {
    const seenClaims = new Set<string>()
    const list = debunkItems.filter(item => {
      if (!item || !item.claim || isPureInstitutionOrPublisherName(item.claim, item.officialSource || item.originalPlatform)) {
        return false
      }
      const normClaim = item.claim.trim().toLowerCase()
      if (seenClaims.has(normClaim)) {
        return false
      }
      seenClaims.add(normClaim)

      const matchCluster = selectedCluster === 'ALL' || item.cluster === selectedCluster
      const isHoaks = item.verdict === 'HOAKS' || item.verdict === 'DISINFORMASI' || item.verdict === 'PROPAGANDA'
      const isResolved = item.verdict === 'FAKTA' || item.verdict === 'NETRAL'
      const isExcluded = item.queueState === 'EXCLUDED'
      const isUnverified = !isExcluded && (item.verdict === 'UNVERIFIED' || item.triageStatus === 'UNVERIFIED' || item.queueState === 'MONITOR' || (!isHoaks && !isResolved))
      
      const activityState = item.issueActivity?.state
      const isMomentum = activityState === 'NEW' || activityState === 'RISING'
      const isSustained = activityState === 'SUSTAINED'
      const isCooling = activityState === 'COOLING'
      const isInsufficientData = activityState === 'INSUFFICIENT_DATA'

      const matchView = activeViewMode === 'ALL'
        ? (selectedTriage === 'ALL' 
            ? true 
            : selectedTriage === 'RESOLVED' 
            ? isResolved
            : selectedTriage === 'HOAKS'
            ? isHoaks
            : selectedTriage === 'UNVERIFIED'
            ? isUnverified
            : item.verdict === selectedTriage)
        : activeViewMode === 'MOMENTUM'
        ? isMomentum
        : activeViewMode === 'SUSTAINED'
        ? isSustained
        : activeViewMode === 'COOLING'
        ? isCooling
        : activeViewMode === 'INSUFFICIENT_DATA'
        ? isInsufficientData
        : activeViewMode === 'UNVERIFIED'
        ? isUnverified
        : activeViewMode === 'HOAKS'
        ? isHoaks
        : activeViewMode === 'RESOLVED'
        ? isResolved
        : true

      const query = searchQuery.trim().toLowerCase()
      const matchQuery = !query || 
        item.claim.toLowerCase().includes(query) ||
        item.clarification.toLowerCase().includes(query) ||
        item.officialSource.toLowerCase().includes(query) ||
        (item.originalPlatform && item.originalPlatform.toLowerCase().includes(query)) ||
        item.keywords.some(k => k.toLowerCase().includes(query))

      return matchCluster && matchView && matchQuery
    })
    return sortRadarEntries(list)
  }, [debunkItems, selectedCluster, selectedTriage, activeViewMode, searchQuery])

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
    const counts = { 
      ALL: debunkItems.length, 
      MOMENTUM: 0, 
      SUSTAINED: 0, 
      COOLING: 0, 
      INSUFFICIENT_DATA: 0, 
      HOAKS: 0, 
      FAKTA: 0, 
      UNVERIFIED: 0, 
      NETRAL: 0 
    }
    debunkItems.forEach(i => {
      const isHoaks = i.verdict === 'HOAKS' || i.verdict === 'DISINFORMASI' || i.verdict === 'PROPAGANDA'
      const isResolved = i.verdict === 'FAKTA' || i.verdict === 'NETRAL'
      const isExcluded = i.queueState === 'EXCLUDED'
      const isUnverified = !isExcluded && (i.verdict === 'UNVERIFIED' || i.triageStatus === 'UNVERIFIED' || i.queueState === 'MONITOR' || (!isHoaks && !isResolved))
      
      const act = i.issueActivity?.state
      if (act === 'NEW' || act === 'RISING') counts.MOMENTUM++
      else if (act === 'SUSTAINED') counts.SUSTAINED++
      else if (act === 'COOLING') counts.COOLING++
      else if (act === 'INSUFFICIENT_DATA') counts.INSUFFICIENT_DATA++

      if (isHoaks) counts.HOAKS++
      else if (i.verdict === 'FAKTA') counts.FAKTA++
      else if (i.verdict === 'NETRAL') counts.NETRAL++
      else if (isUnverified) counts.UNVERIFIED++
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
            <Radio size={20} color="#38BDF8" />
            Radar Berita Viral & Early-Warning Intelijen
          </h1>
        </div>

        {/* Telemetri Live Status Strip & Tombol Briefing Popup */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Tombol Pindai Isu Terkini (Aksi Primer Utama) */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => triggerSync(false)}
            disabled={isSyncing}
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              padding: '7px 14px',
              background: '#C8102E',
              borderColor: '#DC2626',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: isSyncing ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={13} className={isSyncing ? 'spin-animation' : ''} />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Pindai Isu Terkini'}</span>
          </button>

          {/* Banner Feedback Sinkronisasi Operasional */}
          {syncFeedback && (
            <div style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              padding: '6px 12px',
              borderRadius: '4px',
              background: syncFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${syncFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
              color: syncFeedback.type === 'success' ? '#34D399' : '#F87171',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>{syncFeedback.message}</span>
            </div>
          )}

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

          {/* Consolidated Telemetry Pill (Klik untuk Buka/Tutup Rincian Kanal) */}
          <div
            onClick={() => setIsConnectorDetailsOpen(!isConnectorDetailsOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 14px',
              background: '#121822',
              border: isConnectorDetailsOpen ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid #1E2734',
              borderRadius: 'var(--radius-pill)',
              boxShadow: 'var(--shadow-steel-plate)',
              cursor: 'pointer',
              userSelect: 'none'
            }}
            title="Klik untuk membuka / menutup rincian status konektor radar"
          >
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: telemetry.status === 'ONLINE' ? '#10B981' : '#F59E0B',
              boxShadow: `0 0 8px ${telemetry.status === 'ONLINE' ? '#10B981' : '#F59E0B'}`,
              display: 'inline-block'
            }} />
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F1F5F9' }}>
              14 KANAL RADAR ({connectorSummary.online} ONLINE)
            </span>
            <span style={{ color: '#2D3848' }}>│</span>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#94A3B8' }}>
              SYNC: {lastSyncTime}
            </span>
            {isConnectorDetailsOpen ? <ChevronUp size={12} color="#38BDF8" /> : <ChevronDown size={12} color="#94A3B8" />}
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

        {/* Header Label & Navigasi Workspace Mode */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #1E2734',
          paddingBottom: '8px',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          {/* Workspace Primary View Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--accent-gold)', fontSize: '11px', fontWeight: 800, letterSpacing: '1.5px', marginRight: '4px' }}>///</span>
            <button
              type="button"
              onClick={() => {
                setActiveViewMode('ALL')
                setSelectedTriage('ALL')
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                border: '1px solid',
                borderColor: activeViewMode !== 'TRENDS' && activeViewMode !== 'WATCHLIST' ? '#38BDF8' : '#253244',
                background: activeViewMode !== 'TRENDS' && activeViewMode !== 'WATCHLIST' ? 'rgba(56, 189, 248, 0.18)' : '#0F1622',
                color: activeViewMode !== 'TRENDS' && activeViewMode !== 'WATCHLIST' ? '#FFFFFF' : '#94A3B8',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <Radio size={13} color={activeViewMode !== 'TRENDS' && activeViewMode !== 'WATCHLIST' ? '#38BDF8' : '#64748B'} />
              <span>ARUS RADAR (FEED)</span>
              <span style={{
                fontSize: '9.5px',
                padding: '1px 5px',
                borderRadius: '2px',
                background: activeViewMode !== 'TRENDS' && activeViewMode !== 'WATCHLIST' ? '#38BDF8' : '#1A2330',
                color: activeViewMode !== 'TRENDS' && activeViewMode !== 'WATCHLIST' ? '#000000' : '#94A3B8',
                fontWeight: 900
              }}>
                {debunkItems.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveViewMode('TRENDS')}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                border: '1px solid',
                borderColor: activeViewMode === 'TRENDS' ? '#A855F7' : '#253244',
                background: activeViewMode === 'TRENDS' ? 'rgba(168, 85, 247, 0.2)' : '#0F1622',
                color: activeViewMode === 'TRENDS' ? '#FFFFFF' : '#94A3B8',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <Activity size={13} color={activeViewMode === 'TRENDS' ? '#C084FC' : '#64748B'} />
              <span>SINYAL PENELUSURAN</span>
              <span style={{
                fontSize: '9.5px',
                padding: '1px 5px',
                borderRadius: '2px',
                background: activeViewMode === 'TRENDS' ? '#A855F7' : '#1A2330',
                color: activeViewMode === 'TRENDS' ? '#000000' : '#94A3B8',
                fontWeight: 900
              }}>
                {trendSignals.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveViewMode('WATCHLIST')}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                border: '1px solid',
                borderColor: activeViewMode === 'WATCHLIST' ? '#EC4899' : '#253244',
                background: activeViewMode === 'WATCHLIST' ? 'rgba(236, 72, 153, 0.2)' : '#0F1622',
                color: activeViewMode === 'WATCHLIST' ? '#FFFFFF' : '#94A3B8',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <Compass size={13} color={activeViewMode === 'WATCHLIST' ? '#F472B6' : '#64748B'} />
              <span>TOPIC WATCHLIST</span>
              <span style={{
                fontSize: '9.5px',
                padding: '1px 5px',
                borderRadius: '2px',
                background: activeViewMode === 'WATCHLIST' ? '#EC4899' : '#1A2330',
                color: activeViewMode === 'WATCHLIST' ? '#000000' : '#94A3B8',
                fontWeight: 900
              }}>
                {topicCandidates.filter(c => c.status !== 'REJECTED' && c.status !== 'EXPIRED').length}
              </span>
            </button>
          </div>

          {/* Toolbar Pengelolaan Buffer & Auto-Sync */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Tombol Bersihkan Buffer Isu Tuntas */}
            <button
              type="button"
              onClick={handleClearCompletedBuffer}
              title="Hapus isu yang sudah terverifikasi fakta atau netral agar buffer tetap fokus pada potensi ancaman"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '10.5px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                padding: '5px 10px',
                background: '#141C28',
                border: '1px solid #2B384E',
                color: '#94A3B8',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              <Trash2 size={12} color="#94A3B8" />
              <span>Bersihkan Tuntas ({triageCounts.FAKTA + triageCounts.NETRAL})</span>
            </button>

            {/* Tombol Reset Buffer Total */}
            {debunkItems.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllBuffer}
                title="Kosongkan seluruh buffer isu saat ini"
                style={{
                  fontSize: '10.5px',
                  fontFamily: 'var(--font-mono)',
                  padding: '5px 8px',
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

            {/* Tombol Segarkan Penuh & Sinkronkan Ulang */}
            <button
              type="button"
              onClick={() => triggerSync(true)}
              disabled={isSyncing}
              title="Kosongkan cache lama dan lakukan pemindaian segar dari seluruh feed"
              style={{
                fontSize: '10.5px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                padding: '5px 8px',
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38BDF8',
                borderRadius: '4px',
                cursor: isSyncing ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <RefreshCw size={11} className={isSyncing ? 'spin-animation' : ''} />
              <span>Segarkan Penuh</span>
            </button>

            {/* Selector Interval Pembaruan Otomatis */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Clock size={12} color="#94A3B8" />
              <select
                value={syncIntervalHours}
                onChange={(e) => setSyncIntervalHours(Number(e.target.value))}
                style={{
                  background: '#090D12',
                  border: '1px solid #2D3848',
                  borderRadius: '4px',
                  color: '#F1F5F9',
                  fontSize: '10.5px',
                  fontFamily: 'var(--font-mono)',
                  padding: '5px 8px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value={0.5}>Auto-Sync: 30m</option>
                <option value={1}>Auto-Sync: 1 Jam</option>
                <option value={2}>Auto-Sync: 2 Jam</option>
                <option value={6}>Auto-Sync: 6 Jam</option>
                <option value={0}>Auto-Sync: Manual</option>
              </select>
            </div>
          </div>
        </div>

        {/* ─── KESEHATAN KONEKTOR SUMBER (SPRINT 6 MULTI-STREAM TELEMETRY STRIP - COLLAPSIBLE ACCORDION) ─── */}
        <div style={{
          paddingTop: '4px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {/* Header Bar Ringkas (Always Visible 1-Line) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div 
              onClick={() => setIsConnectorDetailsOpen(!isConnectorDetailsOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                userSelect: 'none'
              }}
              title="Klik untuk buka / tutup rincian 14 kanal radar"
            >
              <span style={{ color: '#94A3B8', fontWeight: 700, fontSize: '10.5px', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Radio size={12} color="#38BDF8" />
                <span>STATUS KONEKTOR RADAR (14 KANAL):</span>
              </span>

              {/* Status Counters */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 7px',
                  borderRadius: '3px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#10B981',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)'
                }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 4px #10B981' }} />
                  {connectorSummary.online} Online
                </span>

                {connectorSummary.degraded > 0 && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 7px',
                    borderRadius: '3px',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: '#F59E0B',
                    fontSize: '9.5px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)'
                  }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#F59E0B' }} />
                    {connectorSummary.degraded} Degraded
                  </span>
                )}

                {connectorSummary.offline > 0 && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 7px',
                    borderRadius: '3px',
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#EF4444',
                    fontSize: '9.5px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)'
                  }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#EF4444' }} />
                    {connectorSummary.offline} Offline
                  </span>
                )}

                {connectorSummary.disabled > 0 && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 7px',
                    borderRadius: '3px',
                    background: 'rgba(100, 116, 139, 0.12)',
                    border: '1px solid rgba(100, 116, 139, 0.3)',
                    color: '#64748B',
                    fontSize: '9.5px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)'
                  }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#64748B' }} />
                    {connectorSummary.disabled} Nonaktif
                  </span>
                )}
              </div>
            </div>

            {/* Toggle Button */}
            <button
              type="button"
              onClick={() => setIsConnectorDetailsOpen(!isConnectorDetailsOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: isConnectorDetailsOpen ? 'rgba(56, 189, 248, 0.12)' : '#090D14',
                border: isConnectorDetailsOpen ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid #1E2734',
                borderRadius: '4px',
                color: isConnectorDetailsOpen ? '#38BDF8' : '#94A3B8',
                fontSize: '10px',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                padding: '3px 8px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title={isConnectorDetailsOpen ? 'Tutup rincian kanal' : 'Buka rincian 14 kanal radar'}
            >
              <span>{isConnectorDetailsOpen ? 'Sembunyikan Kanal' : `Lihat Detail (${connectorSummary.total} Kanal)`}</span>
              {isConnectorDetailsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>

          {/* Tray Dropdown Detail Kanal (Hanya Tampil Saat Buka) */}
          {isConnectorDetailsOpen && (
            <div style={{
              background: '#070B11',
              border: '1px solid #1E2734',
              borderRadius: '6px',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              animation: 'fadeIn 200ms ease-out'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                <span>RINCIAN MULTI-STREAM TELEMETRY & CIRCUIT BREAKER (HOVER UNTUK METRIK LENGKAP)</span>
                <span>STATUS KONEKSI: {connectorSummary.online}/{connectorSummary.total} AKTIF</span>
              </div>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(215px, 1fr))',
                gap: '6px',
                fontSize: '9.5px',
                fontFamily: 'var(--font-mono)'
              }}>
                {Object.values(connectorHealth).map(ch => {
                  const isHealthy = ch.state === 'HEALTHY'
                  const isConnecting = ch.state === 'CONNECTING'
                  const isDegraded = ch.state === 'DEGRADED'
                  const isRateLimited = ch.state === 'RATE_LIMITED'
                  const isStale = ch.state === 'STALE'
                  const isUnknown = ch.state === 'UNKNOWN'
                  const isDisabled = ch.state === 'DISABLED'
                  const dotColor = isDisabled ? '#475569' : isHealthy ? '#10B981' : isConnecting ? '#38BDF8' : isDegraded ? '#F59E0B' : isRateLimited ? '#A855F7' : isStale ? '#38BDF8' : isUnknown ? '#94A3B8' : '#EF4444'
                  const statusLabel = isDisabled ? 'DISABLED' : isHealthy ? 'ONLINE' : isConnecting ? 'CONNECTING' : isDegraded ? 'PROXY' : isRateLimited ? 'RATE_LIMIT' : isStale ? 'CACHE' : isUnknown ? 'IDLE' : 'OFFLINE'
                  
                  const schedule = sourceScheduleStates[ch.sourceId]
                  const lastSuccessStr = ch.lastSuccessAt ? new Date(ch.lastSuccessAt).toLocaleTimeString('id-ID') : (schedule?.lastSuccessAt ? new Date(schedule.lastSuccessAt).toLocaleTimeString('id-ID') : 'Belum Ada')
                  const lastAttemptStr = schedule?.lastAttemptAt ? new Date(schedule.lastAttemptAt).toLocaleTimeString('id-ID') : 'Belum Ada'
                  const nextRefreshStr = schedule?.nextDueAt ? (schedule.nextDueAt <= Date.now() ? 'Saat ini (Due)' : new Date(schedule.nextDueAt).toLocaleTimeString('id-ID')) : 'Tergantung Jadwal'
                  const cbStatus = schedule?.circuitBreakerStatus || 'CLOSED'
                  const httpStatusStr = ch.httpStatus ? `HTTP Status: ${ch.httpStatus}\n` : ''
                  
                  const tooltipText = `${ch.sourceName} (${ch.sourceId})\nStatus: ${ch.state} [${statusLabel}]\n${httpStatusStr}Latensi: ${ch.latencyMs ? ch.latencyMs + 'ms' : 'N/A'}\nItem Diterima: ${ch.itemCount || ch.itemCountLastFetch || 0}\nTerakhir Sukses: ${lastSuccessStr}\nTerakhir Dicoba: ${lastAttemptStr}\nJadwal Berikutnya: ${nextRefreshStr}\nCircuit Breaker: ${cbStatus}\nKegagalan Beruntun: ${ch.consecutiveFailures || schedule?.consecutiveFailures || 0}\nKeterangan: ${ch.userReadableMessage}`

                  const displayName = ch.shortLabel || (
                    ch.sourceName.includes('—')
                      ? 'G-News · ' + ch.sourceName.split('—')[1].split('(')[0].trim()
                      : ch.sourceName.replace('Google Trends Indonesia (Search Interest)', 'Google Trends ID').split('(')[0].trim()
                  )

                  return (
                    <div
                      key={ch.sourceId}
                      title={tooltipText}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: '#0B111A',
                        border: `1px solid ${dotColor}35`,
                        color: isDisabled ? '#64748B' : '#CBD5E1',
                        opacity: isDisabled ? 0.7 : 1,
                        cursor: 'help'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: dotColor,
                          boxShadow: isHealthy ? `0 0 5px ${dotColor}` : 'none',
                          flexShrink: 0
                        }} />
                        <span style={{ fontWeight: 700, color: isDisabled ? '#94A3B8' : '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {displayName}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <span style={{ color: dotColor, fontWeight: 800 }}>[{statusLabel}]</span>
                        {(ch.itemCount > 0 || ch.itemCountLastFetch > 0) && (
                          <span style={{ color: '#64748B', fontSize: '9px' }}>({ch.itemCount || ch.itemCountLastFetch})</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── 2B. Sasis Plat Baja: Deck Filter Spektrum & Konsol Pencarian ─── */}
      {activeViewMode !== 'TRENDS' && activeViewMode !== 'WATCHLIST' && (
      <div 
        className="steel-chassis-card"
        style={{
          padding: '12px 18px',
          marginBottom: '16px',
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

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Label Filter Spektrum & Counter Ringkas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--accent-gold)', fontSize: '11px', fontWeight: 800, letterSpacing: '1.5px' }}>///</span>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F1F5F9', letterSpacing: '0.5px' }}>
              DECK FILTER SPEKTRUM & KONSOL PENCARIAN
            </span>
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: '#38BDF8',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              padding: '1px 6px',
              borderRadius: '3px',
              fontWeight: 700
            }}>
              {filteredItems.length} ISU TERFILTER
            </span>
          </div>

          {/* Input Pencarian Klaim / Kata Kunci dengan Tombol Clear */}
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
                padding: '6px 28px 6px 30px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: 0
                }}
                title="Hapus pencarian"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Garis Pembatas */}
        <div style={{ height: '1px', background: '#1E2734' }} />

        {/* ─── Filter Status Triage & View Mode (Command Center Tabs - Sprint 6 WP9) ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Baris 1: Filter Status Triage */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#64748B', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginRight: '2px' }}>
              <ShieldAlert size={11} color="#38BDF8" /> FILTER STATUS:
            </span>
            {[
              { key: 'MOMENTUM', label: 'ISU BARU & MENINGKAT', count: triageCounts.MOMENTUM, color: '#F43F5E', icon: TrendingUp },
              { key: 'UNVERIFIED', label: 'SEDANG DIPANTAU', count: triageCounts.UNVERIFIED, color: '#F59E0B', icon: Eye },
              { key: 'HOAKS', label: 'TERINDIKASI HOAKS', count: triageCounts.HOAKS, color: '#EF4444', icon: AlertTriangle },
              { key: 'RESOLVED', label: 'FAKTA & AMAN', count: triageCounts.FAKTA + triageCounts.NETRAL, color: '#10B981', icon: ShieldCheck },
            ].map(tab => {
              const isSelected = activeViewMode === tab.key || (activeViewMode === 'ALL' && selectedTriage === tab.key)
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setActiveViewMode('ALL')
                      setSelectedTriage('ALL')
                    } else {
                      setActiveViewMode(tab.key as any)
                      if (tab.key === 'UNVERIFIED' || tab.key === 'HOAKS' || tab.key === 'RESOLVED') {
                        setSelectedTriage(tab.key as any)
                      } else {
                        setSelectedTriage('ALL')
                      }
                    }
                  }}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '4px',
                    fontSize: '10.5px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800,
                    border: '1px solid',
                    borderColor: isSelected ? tab.color : '#253244',
                    background: isSelected ? `${tab.color}25` : '#101620',
                    color: isSelected ? '#FFFFFF' : '#94A3B8',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: isSelected ? `0 0 10px ${tab.color}30` : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <tab.icon size={12} color={isSelected ? tab.color : '#64748B'} />
                  <span>{tab.label}</span>
                  <span style={{
                    fontSize: '9.5px',
                    padding: '1px 5px',
                    borderRadius: '2px',
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

          {/* Garis Pembatas Sasis Antara Filter Status dan Klaster Spektrum */}
          <div style={{
            height: '1px',
            background: 'linear-gradient(90deg, rgba(30, 41, 59, 0.9) 0%, rgba(56, 189, 248, 0.25) 30%, rgba(30, 41, 59, 0.9) 100%)',
            margin: '3px 0'
          }} />

          {/* Baris 2: Klaster Spektrum Cerdas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#64748B', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginRight: '2px' }}>
              <Filter size={11} color="#A855F7" /> KLASTER:
            </span>
            {CLUSTER_OPTIONS
              .filter(opt => opt.key !== 'ALL' && (clusterCounts[opt.key] ?? 0) > 0)
              .map(opt => {
                const isSelected = selectedCluster === opt.key
                const count = clusterCounts[opt.key] ?? 0
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSelectedCluster(isSelected ? 'ALL' : opt.key)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '3px',
                      fontSize: '9.5px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      border: '1px solid',
                      borderColor: isSelected ? opt.color : '#1E2734',
                      background: isSelected ? `${opt.color}25` : '#0B1017',
                      color: isSelected ? '#FFFFFF' : '#64748B',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: isSelected ? `0 0 8px ${opt.color}30` : 'none',
                      transition: 'all 0.15s ease'
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

            {/* Tombol Reset Filter jika aktif (S12-06.3 / S12-06.4: SEMUA ISU AKTIF) */}
            {(selectedCluster !== 'ALL' || activeViewMode !== 'ALL' || selectedTriage !== 'ALL' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCluster('ALL')
                  setActiveViewMode('ALL')
                  setSelectedTriage('ALL')
                  setSearchQuery('')
                }}
                title="Reset seluruh filter (Tampilkan SEMUA ISU AKTIF)"
                style={{
                  padding: '3px 9px',
                  borderRadius: '3px',
                  fontSize: '9.5px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: '#EF4444',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  cursor: 'pointer',
                  marginLeft: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <X size={10} />
                <span>Reset Filter</span>
              </button>
            )}
          </div>
        </div>
      </div>
      )}

      {/* ─── 3A. Panel Khusus Sinyal Penelusuran Google Trends (Sprint 6 WP9 Section 13.3) ─── */}
      {activeViewMode === 'TRENDS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Banner OSINT & Limitations Disclaimer */}
          <div 
            className="steel-chassis-card"
            style={{
              padding: '16px',
              borderLeft: '4px solid #A855F7',
              background: '#0E131F',
              position: 'relative'
            }}
          >
            <span className="bolt-tl" /><span className="bolt-tr" /><span className="bolt-bl" /><span className="bolt-br" />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <Activity size={20} color="#C084FC" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#F1F5F9', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                  SINYAL MINAT PENELUSURAN PUBLIK (GOOGLE TRENDS INDONESIA)
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', lineHeight: 1.5 }}>
                  Sinyal penelusuran publik mencerminkan lonjakan kata kunci pencarian netizen di Google Trends ID secara agregat.
                  <strong style={{ color: '#FCD34D' }}> PENTING:</strong> Sinyal tren pencarian <strong style={{ color: '#FCA5A5' }}>BUKAN</strong> bukti kebenaran faktual, <strong style={{ color: '#FCA5A5' }}>BUKAN</strong> verifikasi berita, dan <strong style={{ color: '#FCA5A5' }}>TIDAK</strong> menambah kuantitas publikasi pers. NARADA tidak mengumpulkan profil pengguna atau data pribadi individu.
                </div>
              </div>
            </div>
          </div>

          {/* Grid Kartu Tren Google */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '14px'
          }}>
            {trendSignals.length === 0 ? (
              <div className="steel-chassis-card" style={{ gridColumn: '1 / -1', padding: '50px 20px', textAlign: 'center' }}>
                <Activity size={32} color="#64748B" style={{ margin: '0 auto 8px', opacity: 0.6 }} />
                <div style={{ fontSize: '13px', color: '#94A3B8', fontWeight: 700 }}>
                  Belum Ada Sinyal Penelusuran Aktif
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                  Klik tombol "Pindai Isu Terkini" untuk menarik lonjakan tren penelusuran publik terbaru dari Google Trends ID.
                </div>
              </div>
            ) : (
              trendSignals.map(sig => (
                <div
                  key={sig.id}
                  className="steel-chassis-card"
                  style={{
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '10px',
                    borderTop: '2px solid #A855F7'
                  }}
                >
                  <span className="bolt-tl" /><span className="bolt-tr" /><span className="bolt-bl" /><span className="bolt-br" />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{
                        fontSize: '9px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 800,
                        padding: '2px 7px',
                        borderRadius: '3px',
                        background: 'rgba(168, 85, 247, 0.15)',
                        color: '#C084FC',
                        border: '1px solid rgba(168, 85, 247, 0.4)'
                      }}>
                        SINYAL PENELUSURAN AKTIF
                      </span>
                      {sig.searchVolumeBand && (
                        <span style={{
                          fontSize: '10px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 900,
                          padding: '2px 8px',
                          borderRadius: '3px',
                          background: '#2E1065',
                          color: '#E9D5FF',
                          border: '1px solid #7E22CE'
                        }}>
                          {sig.searchVolumeBand} PENCARIAN
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#F1F5F9', marginBottom: '6px' }}>
                      "{sig.query}"
                    </div>

                    {sig.relatedQueries && sig.relatedQueries.length > 0 && (
                      <div style={{ fontSize: '10px', color: '#94A3B8', marginBottom: '8px' }}>
                        <span style={{ color: '#64748B' }}>Kueri Terkait: </span>
                        {sig.relatedQueries.join(', ')}
                      </div>
                    )}

                    <div style={{
                      fontSize: '9.5px',
                      fontFamily: 'var(--font-mono)',
                      color: '#64748B',
                      background: '#070C14',
                      padding: '6px 8px',
                      borderRadius: '3px',
                      border: '1px solid #1E2734',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}>
                      <span>SUMBER: {sig.sourceLabel}</span>
                      <span>TERTANGKAP: {new Date(sig.observedAt).toLocaleTimeString('id-ID')} WIB</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #1E2734' }}>
                    <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                      STATUS: {sig.trendStatus || 'ACTIVE'}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        topicDiscoveryEngine.addWatchlistPhrase(sig.query, 'NATIONAL_POLICY', 'Ditambahkan dari Google Trends')
                        const updated = topicDiscoveryEngine.getAllCandidates()
                        await saveTopicCandidates(updated)
                        setTopicCandidates([...updated])
                        setActiveViewMode('WATCHLIST')
                      }}
                      style={{
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        padding: '4px 10px',
                        background: 'rgba(236, 72, 153, 0.15)',
                        border: '1px solid rgba(236, 72, 153, 0.4)',
                        color: '#F472B6',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >
                      + Pantau di Watchlist
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── 3B. Panel Topic Watchlist & Dynamic Discovery (Sprint 6 WP9 Section 13.4) ─── */}
      {activeViewMode === 'WATCHLIST' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Card Input Frasa Baru Operator */}
          <div
            className="steel-chassis-card"
            style={{
              padding: '16px',
              position: 'relative'
            }}
          >
            <span className="bolt-tl" /><span className="bolt-tr" /><span className="bolt-bl" /><span className="bolt-br" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Compass size={16} color="#EC4899" />
              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#F1F5F9', letterSpacing: '0.5px' }}>
                TAMBAHKAN FRASA KUNCI PANTAUAN KE TOPIC WATCHLIST
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={manualPhrase}
                onChange={(e) => {
                  setManualPhrase(e.target.value)
                  setManualError(null)
                }}
                placeholder="Masukkan frasa pantauan (contoh: pajak digital, alutsista kf-21, bansos pangan)..."
                style={{
                  flex: '1 1 280px',
                  background: '#090D12',
                  border: `1px solid ${manualError ? '#EF4444' : '#2D3848'}`,
                  borderRadius: '4px',
                  color: '#F1F5F9',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  padding: '8px 12px',
                  outline: 'none'
                }}
              />

              <select
                value={manualDomain}
                onChange={(e) => setManualDomain(e.target.value as RadarTaxonomyDomain)}
                style={{
                  background: '#090D12',
                  border: '1px solid #2D3848',
                  borderRadius: '4px',
                  color: '#F1F5F9',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  padding: '8px 12px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="NATIONAL_POLICY">Kebijakan Nasional / Politik</option>
                <option value="MILITARY_DEFENSE">Kedaulatan & Hankam TNI</option>
                <option value="CIVIL_UNREST">Aksi Massa & Unjuk Rasa</option>
                <option value="DIGITAL_ECONOMY">Ekonomi Digital & Pajak</option>
                <option value="DISASTER_EMERGENCY">Bencana Darurat BMKG</option>
                <option value="SOCIAL_ASSISTANCE">Penipuan Bansos Kemensos</option>
                <option value="PUBLIC_HEALTH">Kesehatan & Pangan Publik</option>
              </select>

              <button
                type="button"
                onClick={handleAddManualPhrase}
                style={{
                  padding: '8px 16px',
                  background: '#DB2777',
                  border: '1px solid #F472B6',
                  borderRadius: '4px',
                  color: '#FFFFFF',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Plus size={13} />
                <span>Tambah ke Watchlist</span>
              </button>
            </div>

            {manualError && (
              <div style={{ color: '#F87171', fontSize: '10.5px', fontFamily: 'var(--font-mono)', marginTop: '6px' }}>
                ⚠ {manualError}
              </div>
            )}

            {/* Info Batasan Guardrail */}
            <div style={{
              marginTop: '12px',
              paddingTop: '8px',
              borderTop: '1px solid #1E2734',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              flexWrap: 'wrap',
              fontSize: '9.5px',
              fontFamily: 'var(--font-mono)',
              color: '#64748B'
            }}>
              <span>KEBIJAKAN GOVERNANCE:</span>
              <span style={{ color: '#10B981' }}>✓ Max 2 Kueri/Siklus</span>
              <span style={{ color: '#10B981' }}>✓ Max 8 Kueri/24 Jam</span>
              <span style={{ color: '#10B981' }}>✓ Cooldown 30 Menit</span>
              <span style={{ color: '#F59E0B' }}>⚠ Injeksi Host/URL Otomatis Ditolak</span>
              <span style={{ color: '#38BDF8' }}>🔒 Nol Scraping Medsos Privat</span>
            </div>
          </div>

          {/* Filter Tab Status Kandidat */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {['ALL', 'WATCHLIST', 'ACTIVE_SEARCH', 'PROPOSED', 'REJECTED'].map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setCandidateFilterStatus(st)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  border: '1px solid',
                  borderColor: candidateFilterStatus === st ? '#EC4899' : '#1E2734',
                  background: candidateFilterStatus === st ? 'rgba(236, 72, 153, 0.2)' : '#0B1017',
                  color: candidateFilterStatus === st ? '#FFFFFF' : '#94A3B8',
                  cursor: 'pointer'
                }}
              >
                {st === 'ALL' ? 'SEMUA KANDIDAT' : st} ({
                  st === 'ALL' 
                    ? topicCandidates.length 
                    : topicCandidates.filter(c => c.status === st).length
                })
              </button>
            ))}
          </div>

          {/* Grid Kartu Kandidat Topik */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '14px'
          }}>
            {topicCandidates.filter(c => candidateFilterStatus === 'ALL' || c.status === candidateFilterStatus).length === 0 ? (
              <div className="steel-chassis-card" style={{ gridColumn: '1 / -1', padding: '40px 20px', textAlign: 'center' }}>
                <Compass size={28} color="#64748B" style={{ margin: '0 auto 8px', opacity: 0.6 }} />
                <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 700 }}>
                  Tidak Ada Kandidat Topik pada Filter Ini
                </div>
              </div>
            ) : (
              topicCandidates
                .filter(c => candidateFilterStatus === 'ALL' || c.status === candidateFilterStatus)
                .map(cand => {
                  const isWatch = cand.status === 'WATCHLIST'
                  const isActive = cand.status === 'ACTIVE_SEARCH'
                  const isProposed = cand.status === 'PROPOSED'
                  const isRejected = cand.status === 'REJECTED'
                  const badgeColor = isActive ? '#10B981' : isWatch ? '#EC4899' : isProposed ? '#F59E0B' : '#64748B'

                  return (
                    <div
                      key={cand.id}
                      className="steel-chassis-card"
                      style={{
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '10px',
                        borderTop: `2px solid ${badgeColor}`
                      }}
                    >
                      <span className="bolt-tl" /><span className="bolt-tr" /><span className="bolt-bl" /><span className="bolt-br" />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{
                            fontSize: '9px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '2px',
                            background: `${badgeColor}20`,
                            color: badgeColor,
                            border: `1px solid ${badgeColor}40`
                          }}>
                            {cand.status}
                          </span>
                          <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                            SKOR: {cand.relevanceScore}/100
                          </span>
                        </div>

                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#F1F5F9', marginBottom: '4px' }}>
                          "{cand.phrase}"
                        </div>

                        <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#38BDF8', marginBottom: '6px' }}>
                          DOMAIN: {cand.domain}
                        </div>

                        <div style={{ fontSize: '9.5px', color: '#94A3B8', marginBottom: '8px' }}>
                          {cand.notes || `Terdeteksi dari ${cand.source}`}
                        </div>

                        <div style={{
                          fontSize: '9px',
                          fontFamily: 'var(--font-mono)',
                          color: '#64748B',
                          background: '#070C14',
                          padding: '4px 6px',
                          borderRadius: '2px',
                          border: '1px solid #1E2734'
                        }}>
                          Pencarian Dinamis: {cand.dynamicSearchCount || 0}x dijalankan
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '8px', borderTop: '1px solid #1E2734', flexWrap: 'wrap' }}>
                        {!isWatch && (
                          <button
                            type="button"
                            onClick={() => handlePromoteCandidate(cand.id, 'WATCHLIST')}
                            style={{
                              fontSize: '9.5px',
                              fontFamily: 'var(--font-mono)',
                              padding: '3px 8px',
                              background: '#1A2332',
                              border: '1px solid #EC4899',
                              color: '#F472B6',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                          >
                            Watchlist
                          </button>
                        )}
                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => handlePromoteCandidate(cand.id, 'ACTIVE_SEARCH')}
                            style={{
                              fontSize: '9.5px',
                              fontFamily: 'var(--font-mono)',
                              padding: '3px 8px',
                              background: '#064E3B',
                              border: '1px solid #10B981',
                              color: '#6EE7B7',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                          >
                            Aktifkan Pencarian
                          </button>
                        )}
                        {!isRejected && (
                          <button
                            type="button"
                            onClick={() => handleRejectCandidate(cand.id)}
                            style={{
                              fontSize: '9.5px',
                              fontFamily: 'var(--font-mono)',
                              padding: '3px 8px',
                              background: '#1F1315',
                              border: '1px solid #7F1D1D',
                              color: '#F87171',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                          >
                            Tolak
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
            )}
          </div>
        </div>
      )}

      {/* ─── 3C. Grid Kartu Isu Viral Plat Baja (3 Kolom) ─── */}
      {activeViewMode !== 'TRENDS' && activeViewMode !== 'WATCHLIST' && (
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
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  position: 'relative',
                  gap: '10px',
                  borderTop: score >= 75 ? '2px solid #EF4444' : '1px solid #1E2734'
                }}
              >
                <span className="bolt-tl" />
                <span className="bolt-tr" />
                <span className="bolt-bl" />
                <span className="bolt-br" />

                {/* Konten Utama Kartu */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Baris 1: Klaster & Status Triage */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    flexWrap: 'wrap'
                  }}>
                    {/* Lencana Klaster */}
                    <span style={{
                      fontSize: '9px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '3px',
                      background: `${clusterMeta.color}18`,
                      color: clusterMeta.color,
                      border: `1px solid ${clusterMeta.color}35`,
                      letterSpacing: '0.5px'
                    }}>
                      {clusterMeta.label}
                    </span>

                    {/* Lencana Vonis & Indeks Relevansi Heuristik */}
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

                      {/* Skor Relevansi Konteks (Indikator Heuristik, BUKAN Probabilitas Ancaman) */}
                      <span style={{
                        fontSize: '9px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '2px',
                        background: `${scoreColor}18`,
                        color: scoreColor,
                        border: `1px solid ${scoreColor}40`
                      }} title="Skor Relevansi Konteks (0 - 100): Indikator heuristik keselarasan topik pantauan, bukan probabilitas kebenaran atau tingkat bahaya.">
                        RELEVANSI {score}/100
                      </span>
                    </div>
                  </div>

                  {/* Naskah / Klaim Isu Viral */}
                  <div style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#F8FAFC',
                    lineHeight: 1.45
                  }}>
                    {item.claim}
                  </div>

                  {/* Baris Sinyal Kontekstual & Freshness */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                    {/* Freshness Badge dari FreshnessEngine */}
                    {(() => {
                      const { timestamp: pTs } = parseSourceDate(item.publishedDate)
                      const fresh = evaluateFreshness(pTs)
                      const isBrk = fresh.status === 'BREAKING'
                      const isAkt = fresh.status === 'AKTUAL'
                      const isBerk = fresh.status === 'BERKEMBANG'
                      const badgeColor = isBrk ? '#EF4444' : isAkt ? '#F59E0B' : isBerk ? '#38BDF8' : '#64748B'
                      const badgeBg = isBrk ? 'rgba(239, 68, 68, 0.2)' : isAkt ? 'rgba(245, 158, 11, 0.15)' : isBerk ? 'rgba(56, 189, 248, 0.15)' : 'rgba(100, 116, 139, 0.15)'

                      return (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '8.5px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 800,
                          color: badgeColor,
                          background: badgeBg,
                          border: `1px solid ${badgeColor}60`,
                          padding: '2px 5px',
                          borderRadius: '2px'
                        }}>
                          {isBrk && <Flame size={9} />}
                          <span>{fresh.status === 'BREAKING' ? 'BREAKING (<3J)' : fresh.status === 'AKTUAL' ? 'AKTUAL (<12J)' : fresh.status === 'BERKEMBANG' ? 'HARI INI (<24J)' : fresh.status === 'KONTEKS' ? 'KONTEKS (>24J)' : 'WAKTU N/A'}</span>
                        </span>
                      )
                    })()}

                    {/* Cakupan Domain Pers Independen */}
                    <span style={{
                      fontSize: '8.5px',
                      fontFamily: 'var(--font-mono)',
                      color: '#10B981',
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      padding: '2px 6px',
                      borderRadius: '2px',
                      fontWeight: 700
                    }} title="Jumlah domain media massa independen terverifikasi">
                      {item.sourceCoverage?.distinctPublisherDomainCount || 1} DOMAIN PERS
                    </span>

                    {/* Momentum Aktivitas Isu jika ada */}
                    {item.issueActivity && (
                      (() => {
                        const st = item.issueActivity.state
                        const isRising = st === 'RISING'
                        const isNew = st === 'NEW'
                        const isSustained = st === 'SUSTAINED'
                        const bg = isRising ? 'rgba(239, 68, 68, 0.15)' : isNew ? 'rgba(245, 158, 11, 0.15)' : isSustained ? 'rgba(56, 189, 248, 0.15)' : 'rgba(100, 116, 139, 0.15)'
                        const col = isRising ? '#F87171' : isNew ? '#FBBF24' : isSustained ? '#38BDF8' : '#94A3B8'
                        const label = isRising ? 'LIPUTAN MENINGKAT' : isNew ? 'ISU BARU' : isSustained ? 'LIPUTAN BERLANJUT' : 'MELANDAI'
                        return (
                          <span style={{
                            fontSize: '8.5px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '2px',
                            background: bg,
                            color: col,
                            border: `1px solid ${col}40`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}>
                            {isRising && <TrendingUp size={9} />}
                            {isNew && <Flame size={9} />}
                            {label}
                          </span>
                        )
                      })()
                    )}

                    {/* Lencana Referensi Fact-Check jika terhubung */}
                    {item.factCheckReference && (
                      <span style={{
                        fontSize: '8.5px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '2px',
                        background: 'rgba(56, 189, 248, 0.12)',
                        color: '#38BDF8',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }} title={`Referensi Fact-Check Terkait: ${item.factCheckReference.referenceTitle}`}>
                        <ShieldCheck size={9} />
                        <span>REFERENSI FACT-CHECK TERKAIT</span>
                      </span>
                    )}
                  </div>

                  {/* Tray Penjelasan Fakta / Status Intelijen */}
                  <div 
                    className="steel-sunken-tray"
                    style={{
                      padding: '8px 10px',
                      fontSize: '11px',
                      lineHeight: 1.45
                    }}
                  >
                    <div style={{
                      fontSize: '9.5px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      color: isFact ? '#10B981' : isHoax ? '#EF4444' : '#F59E0B',
                      marginBottom: '3px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {isFact ? <CheckCircle size={11} color="#10B981" /> : isHoax ? <AlertTriangle size={11} color="#EF4444" /> : <Eye size={11} color="#F59E0B" />}
                      {isFact ? 'FAKTA / KLARIFIKASI RESMI:' : isHoax ? 'BUKTI FABRIKASI / DISINFORMASI:' : 'STATUS PEMANTAUAN INTELIJEN:'}
                    </div>
                    <div style={{ color: '#94A3B8' }}>
                      {item.clarification}
                    </div>
                  </div>

                  {/* Provenance & Sumber: Asal Pantauan vs Rujukan Otoritas */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 8px',
                    background: '#090E16',
                    border: '1px solid #1E2734',
                    borderRadius: '3px',
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                      <Radio size={10} color="#38BDF8" style={{ flexShrink: 0 }} />
                      <span style={{ color: '#64748B' }}>Asal:</span>
                      <span style={{ color: '#E2E8F0', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.originalPlatform || 'Portal Berita'}
                      </span>
                      {(item.originalSourceUrl || item.sourceUrl) && (
                        <a
                          href={item.originalSourceUrl || item.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#38BDF8', textDecoration: 'none', marginLeft: '2px' }}
                          title="Buka publikasi asal"
                        >
                          <ExternalLink size={9} />
                        </a>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                      <Building size={10} color="#10B981" style={{ flexShrink: 0 }} />
                      <span style={{ color: '#64748B' }}>Otoritas:</span>
                      <span style={{ color: '#F1F5F9', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.officialSource}
                      </span>
                      {item.sourceUrl && (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#10B981', textDecoration: 'none', marginLeft: '2px' }}
                          title="Buka rujukan otoritas resmi"
                        >
                          <ExternalLink size={9} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Kartu: Tanggal Terbit & Aksi Taktis */}
                <div style={{
                  paddingTop: '6px',
                  borderTop: '1px solid #1E2734',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}>
                  {/* Tanggal Terbit */}
                  <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={10} color="#94A3B8" />
                    <span>{item.publishedDate || 'Tanggal tidak tersedia'}</span>
                  </div>

                  {/* Tombol Aksi Operator */}
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
                      <Trash2 size={11} />
                    </button>

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
                          borderRadius: '3px',
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
                        title="Buka Berkas Kasus Investigasi Bukti Digital & Penelaahan Klaim"
                      >
                        <Microscope size={11} />
                        <span>Buka Investigasi Kasus</span>
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
                          borderRadius: '3px',
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
                          borderRadius: '3px',
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
      )}

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
