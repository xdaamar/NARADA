import { useState, useEffect, useMemo, memo } from 'react'
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
  Megaphone,
  Copy,
  Check,
  Users,
  Share2,
  MessageSquare,
  TrendingUp,
  Activity,
  ChevronDown,
  ChevronUp,
  Newspaper,
  Pin
} from 'lucide-react'
import {
  getArchivedIssueIds,
  getArchivedVerdicts,
  toggleArchive,
  setArchivedVerdict,
  syncArchivedItemsWithRadar,
  reconcileArchivedItems
} from '../engine/archive/archive-service.ts'
import { getCuratedArchiveDebunks } from '../engine/data/debunk-service.ts'
import { checkNetworkStatus, type NetworkTelemetryInfo } from '../utils/network.ts'
import type { DebunkKnowledgeEntry, ThreatSpectrumCluster } from '../types.ts'
import { radarScheduler, type SourceScheduleState } from '../engine/scheduler/radar-scheduler.ts'
import { getCachedRadarItems, deleteRadarItemFromDB, clearRadarCacheDB } from '../utils/db-adapter.ts'
import { 
  type RadarTriageStatus 
} from '../engine/radar/early-warning-scorer.ts'
import { type CounterNarrativeChannels, generateCounterNarratives } from '../engine/forensic/counter-narrative-generator.ts'
import { getAllConnectorHealth } from '../engine/radar/source-registry.ts'
import { parseSourceDate, evaluateFreshness, sortRadarEntries } from '../engine/radar/freshness-engine.ts'
import type { ConnectorHealth, SearchTrendSignal } from '../engine/radar/radar-types.ts'
import { getLastRadarResult, clearKnownPublications } from '../engine/data/live-radar-service.ts'
import { isPureInstitutionOrPublisherName } from '../engine/ingest/rss-parser.ts'
import { playTacticalPinChime } from '../utils/tactical-audio.ts'
import { autoClassifyRadarItems } from '../engine/radar/radar-auto-classifier.ts'

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
      let clarification = item.clarification || ''
      if (item.factCheckReference?.explanation && (!clarification || clarification.startsWith('Isu sedang dipantau') || clarification.startsWith('Warta pers dipublikasikan'))) {
        clarification = item.factCheckReference.explanation
      } else if (clarification.startsWith('Isu sedang dipantau di ranah publik via') || clarification.startsWith('Pernyataan dan rilis dari')) {
        const pub = item.originalPlatform || item.officialSource || 'Portal Berita'
        clarification = `Warta pers dipublikasikan oleh ${pub} mengenai isu: "${item.claim}". Terdaftar dalam pemantauan arus pers nasional.`
      }
      result.push({
        ...item,
        clarification
      })
    }
  }
  const sorted = sortRadarEntries(result)
  const autoClassified = autoClassifyRadarItems(sorted)
  return autoClassified.updatedItems
}

// ─── Definisi Klaster Spektrum Kognitif ───
interface ClusterFilterOption {
  key: ThreatSpectrumCluster | 'ALL'
  label: string
  color: string
}

const CLUSTER_OPTIONS: ClusterFilterOption[] = [
  { key: 'ALL', label: 'Semua Isu', color: '#94A3B8' },
  { key: 'SIBER_PERETASAN', label: 'Siber & Peretasan', color: '#06B6D4' },
  { key: 'POLITIK_NEGARA', label: 'Politik', color: '#F87171' },
  { key: 'KEDAULATAN_MILITER', label: 'Kedaulatan Hankam', color: '#EF4444' },
  { key: 'AKSI_MASSA', label: 'Aksi Massa', color: '#FB923C' },
  { key: 'EKONOMI_DIGITAL', label: 'Ekonomi Digital', color: '#34D399' },
  { key: 'BENCANA_DARURAT', label: 'Bencana BMKG', color: '#38BDF8' },
  { key: 'PENIPUAN_BANSOS', label: 'Penipuan Bansos', color: '#FBBF24' },
  { key: 'UMUM_NETRAL', label: 'Umum & Kedinasan', color: '#64748B' },
]

// ─── Bilah Telemetri Status Konektor Mandiri (Isolated Reactive Component) ───
// Menghilangkan re-render liar komponen utama LiveRadar selama interval detak sinkronisasi
interface ConnectorTelemetryStripProps {
  isSyncing: boolean
  lastSyncTime: string
  telemetryStatus: string
}

const ConnectorTelemetryStrip = memo(function ConnectorTelemetryStrip({
  isSyncing,
  lastSyncTime,
  telemetryStatus
}: ConnectorTelemetryStripProps) {
  const [connectorHealth, setConnectorHealth] = useState<Record<string, ConnectorHealth>>(() => getAllConnectorHealth())
  const [sourceScheduleStates, setSourceScheduleStates] = useState<Record<string, SourceScheduleState>>({})
  const [isConnectorDetailsOpen, setIsConnectorDetailsOpen] = useState<boolean>(false)

  useEffect(() => {
    setConnectorHealth(getAllConnectorHealth())
    const status = radarScheduler.getStatus()
    if (status.sourceStates) {
      setSourceScheduleStates(status.sourceStates)
    }
  }, [])

  useEffect(() => {
    if (!isSyncing) {
      setConnectorHealth(getAllConnectorHealth())
      const status = radarScheduler.getStatus()
      if (status.sourceStates) {
        setSourceScheduleStates(status.sourceStates)
      }
      return
    }
    const interval = setInterval(() => {
      setConnectorHealth(getAllConnectorHealth())
      const status = radarScheduler.getStatus()
      if (status.sourceStates) {
        setSourceScheduleStates(status.sourceStates)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [isSyncing])

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

  return (
    <div style={{
      paddingTop: '4px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }}>
      {/* Header Bar Ringkas (Always Visible 1-Line - Plat Besi Beveled) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        background: 'linear-gradient(180deg, #182230 0%, #0E141E 100%)',
        borderTop: '1px solid #334155',
        borderLeft: '1px solid #273444',
        borderRight: '1px solid #141B26',
        borderBottom: '2px solid #080C10',
        borderRadius: '6px',
        padding: '7px 12px',
        boxShadow: '0 3px 8px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
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
            <Radio size={12} color="#60A5FA" />
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
              background: 'linear-gradient(180deg, #131A24 0%, #0A0E15 100%)',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              borderBottom: '1px solid #06090D',
              borderLeft: '1px solid #1C2636',
              borderRight: '1px solid #141B26',
              boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.8)',
              color: '#10B981',
              fontSize: '9.5px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)'
            }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10B981', boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.45), 0 1px 2px rgba(0, 0, 0, 0.85)' }} />
              {connectorSummary.online} Online
            </span>

            {connectorSummary.degraded > 0 && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 7px',
                borderRadius: '3px',
                background: 'linear-gradient(180deg, #131A24 0%, #0A0E15 100%)',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                borderBottom: '1px solid #06090D',
                borderLeft: '1px solid #1C2636',
                borderRight: '1px solid #141B26',
                boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.8)',
                color: '#F59E0B',
                fontSize: '9.5px',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)'
              }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#F59E0B', boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.45), 0 1px 2px rgba(0, 0, 0, 0.85)' }} />
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
                background: 'linear-gradient(180deg, #131A24 0%, #0A0E15 100%)',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                borderBottom: '1px solid #06090D',
                borderLeft: '1px solid #1C2636',
                borderRight: '1px solid #141B26',
                boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.8)',
                color: '#EF4444',
                fontSize: '9.5px',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)'
              }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#EF4444', boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.45), 0 1px 2px rgba(0, 0, 0, 0.85)' }} />
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
                background: 'linear-gradient(180deg, #131A24 0%, #0A0E15 100%)',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                borderBottom: '1px solid #06090D',
                borderLeft: '1px solid #1C2636',
                borderRight: '1px solid #141B26',
                boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.8)',
                color: '#64748B',
                fontSize: '9.5px',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)'
              }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#64748B' }} />
                {connectorSummary.disabled} Nonaktif
              </span>
            )}

            <span style={{ color: '#2D3848', margin: '0 2px' }}>│</span>
            <span style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
              SYNC: {lastSyncTime} ({telemetryStatus})
            </span>
          </div>
        </div>

        {/* Toggle Button (Plat Baja Beveled Taktis) */}
        <button
          type="button"
          onClick={() => setIsConnectorDetailsOpen(!isConnectorDetailsOpen)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            background: isConnectorDetailsOpen ? 'linear-gradient(180deg, #243244 0%, #131B26 100%)' : 'linear-gradient(180deg, #1A222E 0%, #0E131C 100%)',
            borderTop: isConnectorDetailsOpen ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.1)',
            borderBottom: isConnectorDetailsOpen ? '2px solid #0B0E14' : '2px solid #080C10',
            borderLeft: isConnectorDetailsOpen ? '1px solid #334358' : '1px solid #202A38',
            borderRight: isConnectorDetailsOpen ? '1px solid #1A2330' : '1px solid #10151E',
            boxShadow: isConnectorDetailsOpen ? '0 2px 6px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.18)' : '0 2px 4px rgba(0, 0, 0, 0.5)',
            borderRadius: '4px',
            color: isConnectorDetailsOpen ? '#F1F5F9' : '#94A3B8',
            fontSize: '10px',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            padding: '4px 10px',
            cursor: 'pointer',
            transition: 'all 0.18s ease',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.85)'
          }}
          title={isConnectorDetailsOpen ? 'Tutup rincian kanal' : 'Buka rincian 14 kanal radar'}
        >
          <span>{isConnectorDetailsOpen ? 'Sembunyikan Kanal' : `Lihat Detail (${connectorSummary.total} Kanal)`}</span>
          {isConnectorDetailsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Tray Dropdown Detail Kanal (Kompartemen Sasis Baja Cekung) */}
      {isConnectorDetailsOpen && (
        <div style={{
          background: 'linear-gradient(180deg, #0E141D 0%, #070A0F 100%)',
          borderTop: '1px solid #263345',
          borderBottom: '2px solid #05070A',
          borderLeft: '1px solid #1B2432',
          borderRight: '1px solid #121822',
          boxShadow: 'inset 0 3px 10px rgba(0, 0, 0, 0.9), 0 4px 12px rgba(0, 0, 0, 0.7)',
          borderRadius: '6px',
          padding: '12px 14px',
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
                    padding: '5px 8px',
                    borderRadius: '4px',
                    background: 'linear-gradient(180deg, #161F2C 0%, #0C1118 100%)',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    borderBottom: '2px solid #06090D',
                    borderLeft: '1px solid #202C3E',
                    borderRight: '1px solid #0F151F',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                    color: isDisabled ? '#64748B' : '#CBD5E1',
                    opacity: isDisabled ? 0.65 : 1,
                    cursor: 'help'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: dotColor,
                      boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.4), 0 1px 2px rgba(0, 0, 0, 0.85)',
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
  )
})

export default function LiveRadar() {
  const navigate = useNavigate()
  // State data dan filter (kosong secara default saat pemindaian awal aktif)
  const [debunkItems, setDebunkItems] = useState<DebunkKnowledgeEntry[]>([])
  const [selectedCluster, setSelectedCluster] = useState<ThreatSpectrumCluster | 'ALL'>('ALL')
  const [selectedTriage, setSelectedTriage] = useState<RadarTriageStatus | 'ALL' | 'RESOLVED'>('UNVERIFIED')
  const [activeViewMode, setActiveViewMode] = useState<'ALL' | 'MOMENTUM' | 'SUSTAINED' | 'COOLING' | 'INSUFFICIENT_DATA' | 'UNVERIFIED' | 'HOAKS' | 'RESOLVED' | 'TRENDS'>('UNVERIFIED')
  const [trendSignals, setTrendSignals] = useState<SearchTrendSignal[]>([])

  // State Paginasi Taktis Viewport Segmented (60 FPS DOM Optimization)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(15)

  // State Toast Notifikasi Pojok Kanan Bawah saat Berita Disematkan
  const [pinToast, setPinToast] = useState<{ id: string; claim: string; cluster?: string; clusterColor?: string } | null>(null)
  const [isToastExiting, setIsToastExiting] = useState<boolean>(false)
  const [animatingPinIds, setAnimatingPinIds] = useState<Set<string>>(new Set())

  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isSyncing, setIsSyncing] = useState<boolean>(true)
  const [lastSyncTime, setLastSyncTime] = useState<string>('Memuat')
  const [syncIntervalHours, setSyncIntervalHours] = useState<number>(1) // Default 1 jam (lebih efisien)
  const [telemetry, setTelemetry] = useState<NetworkTelemetryInfo>({
    status: 'ONLINE',
    latencyMs: 14,
    lastChecked: Date.now(),
    isUsingProxy: false,
  })
  const [sourceChannel, setSourceChannel] = useState<'API_PROXY' | 'API_DIRECT' | 'API_CORS_PROXY' | 'LOCAL_ARCHIVE'>('LOCAL_ARCHIVE')

  // State ekspansi cuplikan panjang kartu berita (Sprint 13 UX Polish)
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set())
  const [isAllExpanded, setIsAllExpanded] = useState<boolean>(false)

  const toggleCardExpand = (id: string) => {
    setExpandedCardIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleExpandAllCards = () => {
    if (isAllExpanded) {
      setExpandedCardIds(new Set())
      setIsAllExpanded(false)
    } else {
      setExpandedCardIds(new Set(filteredItems.map(i => i.id)))
      setIsAllExpanded(true)
    }
  }

  // State Pop-up Draf Kontranarasi Dispenad (untuk Isu TERINDIKASI HOAKS)
  const [selectedCounterItem, setSelectedCounterItem] = useState<DebunkKnowledgeEntry | null>(null)
  const [isCounterModalOpen, setIsCounterModalOpen] = useState<boolean>(false)
  const [counterChannels, setCounterChannels] = useState<CounterNarrativeChannels | null>(null)
  const [activeCounterTab, setActiveCounterTab] = useState<'dispenad' | 'babinsa' | 'whatsapp' | 'social'>('dispenad')
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false)

  // State Isu Terarsip (Repositori Pemantauan Narada)
  const [archivedIssueIds, setArchivedIssueIds] = useState<Set<string>>(() => getArchivedIssueIds())
  const [archivedVerdicts, setArchivedVerdicts] = useState<Record<string, 'HOAKS' | 'FAKTA' | 'DIPANTAU'>>(() => getArchivedVerdicts())
  const [hideArchivedInRadar, setHideArchivedInRadar] = useState<boolean>(true)

  // Sinkronisasi data arsip secara reaktif 0-ms antar halaman (LiveRadar & Analyzer)
  useEffect(() => {
    const handleArchiveUpdate = () => {
      setArchivedIssueIds(getArchivedIssueIds())
      setArchivedVerdicts(getArchivedVerdicts())
    }
    window.addEventListener('narada:archive-updated', handleArchiveUpdate)
    window.addEventListener('storage', handleArchiveUpdate)
    return () => {
      window.removeEventListener('narada:archive-updated', handleArchiveUpdate)
      window.removeEventListener('storage', handleArchiveUpdate)
    }
  }, [])

  // State Tooltip Status Cyber Bubble Chat C2 (Respons instan 0-ms tanpa jeda sistem browser)
  const [hoveredStatusId, setHoveredStatusId] = useState<string | null>(null)

  // Auto-dismiss pin toast notifikasi setelah 5.2 detik dengan transisi keluar yang halus
  useEffect(() => {
    if (pinToast && !isToastExiting) {
      const timer = setTimeout(() => {
        setIsToastExiting(true)
        setTimeout(() => {
          setPinToast(null)
          setIsToastExiting(false)
        }, 280)
      }, 5200)
      return () => clearTimeout(timer)
    }
  }, [pinToast, isToastExiting])

  const handleDismissToast = () => {
    setIsToastExiting(true)
    setTimeout(() => {
      setPinToast(null)
      setIsToastExiting(false)
    }, 280)
  }

  // Handler Toggle Arsip / Batal Arsip dengan Animasi Teleport Blur & Audio Taktis
  const handleToggleArchive = (item: DebunkKnowledgeEntry) => {
    const isCurrentlyArchived = archivedIssueIds.has(item.id)

    if (!isCurrentlyArchived) {
      // 1. Mainkan efek suara notifikasi taktis HUD (Web Audio API)
      playTacticalPinChime()

      // 2. Aktifkan animasi keluar smooth blur teleport pada kartu
      setAnimatingPinIds(prev => new Set(prev).add(item.id))

      // 3. Tampilkan popup notifikasi taktis informatif
      const clusterMeta = CLUSTER_OPTIONS.find(c => c.key === item.cluster)
      setIsToastExiting(false)
      setPinToast({
        id: item.id,
        claim: item.claim,
        cluster: clusterMeta?.label || item.cluster,
        clusterColor: clusterMeta?.color || '#38BDF8'
      })

      // 4. Setelah animasi selesai (380ms), pindahkan data ke arsip
      setTimeout(() => {
        toggleArchive(item)
        setArchivedIssueIds(getArchivedIssueIds())
        setArchivedVerdicts(getArchivedVerdicts())
        setAnimatingPinIds(prev => {
          const next = new Set(prev)
          next.delete(item.id)
          return next
        })
      }, 380)
    } else {
      // Pelepasan sematan
      toggleArchive(item)
      setArchivedIssueIds(getArchivedIssueIds())
      setArchivedVerdicts(getArchivedVerdicts())
    }
  }

  // Handler Set Klasifikasi untuk Isu Terarsip (disimpan untuk kompatibilitas pipeline)
  const handleSetArchivedVerdict = (id: string, verdict: 'HOAKS' | 'FAKTA' | 'DIPANTAU') => {
    setArchivedVerdict(id, verdict)
    setArchivedVerdicts(getArchivedVerdicts())
  }
  void handleSetArchivedVerdict

  // Fungsi sinkronisasi radar via RadarScheduler (dipakai saat tombol "Pindai Isu Terkini" ditekan)
  const triggerSync = async (forceClear = false) => {
    setIsSyncing(true)
    // KOSONGKAN LIST DATA SAAT FORCE CLEAR saja (Bersihkan Tuntas)
    // Saat scan biasa (tombol Pindai), data lama tetap tampil sampai data baru tiba
    if (forceClear) {
      setDebunkItems([])
      setTrendSignals([])
    }

    const net = await checkNetworkStatus()
    setTelemetry(net)

    try {
      if (forceClear) {
        await clearRadarCacheDB()
        clearKnownPublications()
      }
      radarScheduler.resetCircuitBreakers()
      const entries = await radarScheduler.triggerNow()
      let finalEntries = entries
      if (!finalEntries || finalEntries.length === 0) {
        // Fallback jika mode offline / air-gapped
        const cached = await getCachedRadarItems()
        if (cached && cached.length > 0) {
          finalEntries = cached
        } else {
          finalEntries = getCuratedArchiveDebunks()
        }
      }

      if (finalEntries && finalEntries.length > 0) {
        // SPRINT 5 (WP6) & SPRINT 13: Konsumsi hasil kanonikal tersortir dan tervalidasi
        const sorted = sanitizeRadarItems(finalEntries)
        setDebunkItems(sorted)
        syncArchivedItemsWithRadar(sorted)
        reconcileArchivedItems(sorted).catch(() => {})
      }
      const status = radarScheduler.getStatus()
      setSourceChannel(status.lastSyncSource as typeof sourceChannel || 'LOCAL_ARCHIVE')
      const lastRes = getLastRadarResult()
      if (lastRes?.trendSignals) {
        setTrendSignals(lastRes.trendSignals)
      }
      const now = new Date(status.lastSyncTimestamp || Date.now())
      setLastSyncTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} WIB`
      )
    } catch (err: any) {
      console.error('[LiveRadar] Gagal sinkronisasi feed radar:', err)
      // Pemulihan fallback jika terjadi interupsi jaringan agar tidak blank
      const cached = await getCachedRadarItems().catch(() => [])
      const fallback = (cached && cached.length > 0) ? cached : getCuratedArchiveDebunks()
      const sorted = sanitizeRadarItems(fallback)
      setDebunkItems(sorted)
      syncArchivedItemsWithRadar(sorted)
    } finally {
      // DATA BARU MUNCUL SEMUA SAAT PROSES MEMINDAI SUDAH SELESAI
      setIsSyncing(false)
    }
  }

  // Muat data radar saat awal buka halaman (menjalankan pemindaian bersih)
  useEffect(() => {
    // ─── SESSION-AWARE SMART LOADING ───────────────────────────────────────────
    // Strategi: Load dari cache IndexedDB DULU (instan, 0 delay).
    // Lakukan scan baru hanya jika:
    // 1. Session baru (pertama kali buka aplikasi / tidak ada cache)
    // 2. Sudah lebih dari 1 jam sejak scan terakhir
    // Ini mencegah loading lambat saat user pindah tab dan kembali ke Radar.
    const SCAN_INTERVAL_MS = 60 * 60 * 1000 // 1 jam

    const loadSmartSession = async () => {
      setIsSyncing(true)

      try {
        // 1. Load dari cache IndexedDB terlebih dahulu (instan!)
        const cached = await getCachedRadarItems()
        if (cached && cached.length > 0) {
          const sanitized = sanitizeRadarItems(cached)
          setDebunkItems(sanitized)
          syncArchivedItemsWithRadar(sanitized)
          setIsSyncing(false) // Tampilkan data cache dulu

          // Cek apakah scan baru diperlukan
          const schedulerStatus = radarScheduler.getStatus()
          const lastScanAt = schedulerStatus.lastScanCompletedAt || schedulerStatus.lastSyncTimestamp || 0
          const elapsedSinceLastScan = Date.now() - lastScanAt
          const needsFreshScan = lastScanAt === 0 || elapsedSinceLastScan > SCAN_INTERVAL_MS

          if (needsFreshScan) {
            // Background scan tanpa mengosongkan tampilan (user tidak terganggu)
            setIsSyncing(true)
            const net = await checkNetworkStatus()
            setTelemetry(net)
            radarScheduler.resetCircuitBreakers()
            const freshEntries = await radarScheduler.triggerNow()
            if (freshEntries && freshEntries.length > 0) {
              const sorted = sanitizeRadarItems(freshEntries)
              setDebunkItems(sorted)
              syncArchivedItemsWithRadar(sorted)
              reconcileArchivedItems(sorted).catch(() => {})
            } else {
              // Tetap pakai cache yang sudah tampil
              reconcileArchivedItems(sanitized).catch(() => {})
            }
            const status = radarScheduler.getStatus()
            const now = new Date(status.lastSyncTimestamp || Date.now())
            setLastSyncTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} WIB`)
            const lastRes = getLastRadarResult()
            if (lastRes?.trendSignals) setTrendSignals(lastRes.trendSignals)
          } else {
            // Cache masih fresh, tidak perlu scan
            const now = new Date(lastScanAt)
            setLastSyncTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} WIB`)
          }
        } else {
          // Tidak ada cache → lakukan scan penuh seperti biasa
          setDebunkItems([])
          setTrendSignals([])
          const net = await checkNetworkStatus()
          setTelemetry(net)
          radarScheduler.resetCircuitBreakers()
          const entries = await radarScheduler.triggerNow()
          let finalEntries = entries
          if (!finalEntries || finalEntries.length === 0) {
            finalEntries = getCuratedArchiveDebunks()
          }
          if (finalEntries && finalEntries.length > 0) {
            const sorted = sanitizeRadarItems(finalEntries)
            setDebunkItems(sorted)
            syncArchivedItemsWithRadar(sorted)
            reconcileArchivedItems(sorted).catch(() => {})
          }
          const status = radarScheduler.getStatus()
          const now = new Date(status.lastSyncTimestamp || Date.now())
          setLastSyncTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} WIB`)
          const lastRes = getLastRadarResult()
          if (lastRes?.trendSignals) setTrendSignals(lastRes.trendSignals)
        }
      } catch (err: any) {
        console.error('[LiveRadar] Smart session load error:', err)
        const cached = await getCachedRadarItems().catch(() => [])
        const fallback = (cached && cached.length > 0) ? cached : getCuratedArchiveDebunks()
        const sorted = sanitizeRadarItems(fallback)
        setDebunkItems(sorted)
        syncArchivedItemsWithRadar(sorted)
      } finally {
        setIsSyncing(false)
      }
    }

    loadSmartSession()
  }, [])

  // Hubungkan RadarScheduler interval dan subscribe ke event siaran
  useEffect(() => {
    radarScheduler.setIntervalHours(syncIntervalHours)

    const unsubscribe = radarScheduler.addListener((newEntries) => {
      // SPRINT 5 (WP6) & SPRINT 13: Sinkronkan data terasemen tersortir dan tervalidasi
      const sorted = sanitizeRadarItems(newEntries)
      setDebunkItems(sorted)
      syncArchivedItemsWithRadar(sorted)
      reconcileArchivedItems(sorted).catch(() => {})
      const now = new Date()
      setLastSyncTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} WIB`
      )
    })

    return () => {
      unsubscribe()
    }
  }, [syncIntervalHours])

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
  }

  // Bersihkan seluruh antrean buffer radar secara total
  const handleClearAllBuffer = async () => {
    if (window.confirm('Bersihkan seluruh buffer isu radar saat ini?')) {
      await clearRadarCacheDB()
      clearKnownPublications()
      setDebunkItems([])
    }
  }

  // Filter isu berdasarkan status triage, klaster, view mode, dan query pencarian
  const filteredItems = useMemo(() => {
    // KOSONGKAN LIST DATA SAAT SEDANG MEMINDAI DAN TIDAK ADA DATA TERSIMPAN
    // Jika ada data di debunkItems (dari cache/retensi), tampilkan meski sedang syncing background
    if (isSyncing && debunkItems.length === 0) return []

    const seenClaims = new Set<string>()
    const list = debunkItems.filter(item => {
      if (!item || !item.claim || isPureInstitutionOrPublisherName(item.claim, item.officialSource || item.originalPlatform)) {
        return false
      }

      // Sembunyikan isu yang diarsipkan jika filter aktif agar radar tetap bersih dan selalu terupdate
      if (hideArchivedInRadar && archivedIssueIds.has(item.id)) {
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

      const matchView = activeViewMode === 'HOAKS' || selectedTriage === 'HOAKS'
        ? isHoaks
        : activeViewMode === 'RESOLVED' || selectedTriage === 'RESOLVED'
        ? isResolved
        : isUnverified

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
  }, [debunkItems, selectedCluster, selectedTriage, activeViewMode, searchQuery, hideArchivedInRadar, archivedIssueIds, isSyncing])

  // ─── Paginasi Taktis Viewport Segmented (60 FPS DOM Optimization) ───
  // Reset ke halaman 1 saat filter atau mode pencarian berganti
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCluster, selectedTriage, activeViewMode, searchQuery, hideArchivedInRadar])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginatedItems = useMemo(() => {
    if (pageSize >= 999) return filteredItems
    const start = (safeCurrentPage - 1) * pageSize
    return filteredItems.slice(start, start + pageSize)
  }, [filteredItems, safeCurrentPage, pageSize])

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    const deckElement = document.getElementById('tactical-radar-feed-deck')
    if (deckElement) {
      deckElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      window.scrollTo({ top: 180, behavior: 'smooth' })
    }
  }

  // Hitung jumlah item per klaster untuk pill count
  const clusterCounts = useMemo(() => {
    if (isSyncing) return { ALL: 0 }
    const counts: Record<string, number> = { ALL: debunkItems.length }
    CLUSTER_OPTIONS.forEach(opt => {
      if (opt.key !== 'ALL') {
        counts[opt.key] = debunkItems.filter(i => i.cluster === opt.key).length
      }
    })
    return counts
  }, [debunkItems, isSyncing])

  // Hitung jumlah item per status triage
  const triageCounts = useMemo(() => {
    if (isSyncing) {
      return { 
        ALL: 0, 
        MOMENTUM: 0, 
        SUSTAINED: 0, 
        COOLING: 0, 
        INSUFFICIENT_DATA: 0, 
        HOAKS: 0, 
        FAKTA: 0, 
        UNVERIFIED: 0, 
        NETRAL: 0 
      }
    }
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
      
      const act = i.issueActivity?.state || ((i.threatLevel === 'critical' || i.threatLevel === 'high' || i.id.startsWith('NAR-CYB-') || i.verdict === 'UNVERIFIED') ? 'NEW' : 'SUSTAINED')
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
  }, [debunkItems, isSyncing])

  // Label & Warna status filter aktif untuk indikator visual
  const activeFilterInfo = useMemo(() => {
    if (activeViewMode === 'HOAKS' || selectedTriage === 'HOAKS') {
      return { label: 'TERINDIKASI HOAKS', color: '#EF4444' }
    }
    if (activeViewMode === 'RESOLVED' || selectedTriage === 'RESOLVED') {
      return { label: 'FAKTA & AMAN', color: '#10B981' }
    }
    return { label: 'SEDANG DIPANTAU', color: '#F59E0B' }
  }, [activeViewMode, selectedTriage])

  return (
    <div className="fade-in" style={{ paddingBottom: '36px' }}>
      {/* ─── DESKTOP MISSION CONTROL CONSOLE: RADAR BERITA VIRAL & EARLY-WARNING INTELIJEN ─── */}
      {/* Sprint 12 & Sprint 6 Contracts Preservation:
          Radar Berita Viral & Early-Warning Intelijen | LAPORAN INTELIJEN TERKINI | 14 KANAL RADAR | TOPIC WATCHLIST | Buka Investigasi Kasus
      */}

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
                borderColor: activeViewMode !== 'TRENDS' ? '#475569' : '#222C3A',
                background: activeViewMode !== 'TRENDS' ? 'linear-gradient(180deg, #222C3A 0%, #131A24 100%)' : '#0F1622',
                boxShadow: activeViewMode !== 'TRENDS' ? 'inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 2px 4px rgba(0, 0, 0, 0.4)' : 'none',
                color: activeViewMode !== 'TRENDS' ? '#38BDF8' : '#94A3B8',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <Radio size={13} color={activeViewMode !== 'TRENDS' ? '#38BDF8' : '#64748B'} />
              <span>ARUS RADAR (FEED)</span>
              <span style={{
                fontSize: '9.5px',
                padding: '1px 6px',
                borderRadius: '2px',
                background: '#0B0F17',
                border: '1px solid #253245',
                color: activeViewMode !== 'TRENDS' ? '#38BDF8' : '#64748B',
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
                borderColor: activeViewMode === 'TRENDS' ? '#475569' : '#222C3A',
                background: activeViewMode === 'TRENDS' ? 'linear-gradient(180deg, #222C3A 0%, #131A24 100%)' : '#0F1622',
                boxShadow: activeViewMode === 'TRENDS' ? 'inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 2px 4px rgba(0, 0, 0, 0.4)' : 'none',
                color: activeViewMode === 'TRENDS' ? '#C084FC' : '#94A3B8',
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
                padding: '1px 6px',
                borderRadius: '2px',
                background: '#0B0F17',
                border: '1px solid #253245',
                color: activeViewMode === 'TRENDS' ? '#C084FC' : '#64748B',
                fontWeight: 900
              }}>
                {trendSignals.length}
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
                background: 'linear-gradient(180deg, #1C2330 0%, #101622 100%)',
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

            {/* Tombol Kontrol Visibilitas Berita Tersemat */}
            {archivedIssueIds.size > 0 && (
              <button
                type="button"
                onClick={() => setHideArchivedInRadar(prev => !prev)}
                title={hideArchivedInRadar ? "Tampilkan berita tersemat pada radar" : "Sembunyikan berita tersemat agar radar tetap bersih dan selalu fokus pada isu baru"}
                style={{
                  fontSize: '10.5px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  padding: '5px 10px',
                  background: hideArchivedInRadar ? 'linear-gradient(180deg, #1E293B 0%, #0F172A 100%)' : 'linear-gradient(180deg, #243042 0%, #151D28 100%)',
                  border: hideArchivedInRadar ? '1px solid #38BDF8' : '1px solid #3E4E68',
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 2px 4px rgba(0, 0, 0, 0.4)',
                  color: hideArchivedInRadar ? '#38BDF8' : '#94A3B8',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <Pin size={11} color={hideArchivedInRadar ? '#38BDF8' : '#94A3B8'} style={{ transform: 'rotate(45deg)' }} />
                <span>{hideArchivedInRadar ? `BERITA TERSEMAT DISEMBUNYIKAN (${archivedIssueIds.size})` : `TAMPILKAN SEMUA (${archivedIssueIds.size} TERSEMAT)`}</span>
              </button>
            )}

            {/* Tombol Pindai Isu Terkini (Sinkronisasi Seluruh Kanal Radar) */}
            <button
              type="button"
              onClick={() => triggerSync(true)}
              disabled={isSyncing}
              title="Pindai Isu Terkini: Segarkan dan sinkronkan seluruh 14 KANAL RADAR"
              style={{
                fontSize: '10.5px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                padding: '5px 12px',
                background: 'linear-gradient(180deg, #243042 0%, #151D28 100%)',
                border: '1px solid #3E4E68',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 2px 4px rgba(0, 0, 0, 0.4)',
                color: '#EF4444',
                borderRadius: '4px',
                cursor: isSyncing ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <RefreshCw size={11} color="#EF4444" className={isSyncing ? 'spin-animation' : ''} />
              <span>{isSyncing ? 'Memindai' : 'Pindai Isu Terkini'}</span>
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
                <option value={1} selected>Auto-Sync: 1 Jam</option>
                <option value={2}>Auto-Sync: 2 Jam</option>
                <option value={6}>Auto-Sync: 6 Jam</option>
                <option value={0}>Auto-Sync: Manual</option>
              </select>
            </div>
          </div>
        </div>

        {/* ─── KESEHATAN KONEKTOR SUMBER (ISOLATED REACTIVE COMPONENT) ─── */}
        <ConnectorTelemetryStrip 
          isSyncing={isSyncing} 
          lastSyncTime={lastSyncTime} 
          telemetryStatus={telemetry.status} 
        />
      </div>

      {/* ─── 2B. Sasis Plat Baja: Deck Filter Spektrum & Konsol Pencarian ─── */}
      {activeViewMode !== 'TRENDS' && (
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
              background: '#0B1017',
              border: '1px solid #263345',
              padding: '1px 6px',
              borderRadius: '3px',
              fontWeight: 700
            }}>
              {isSyncing ? 'MEMINDAI' : `${filteredItems.length} ISU TERFILTER`}
            </span>

            {/* Indikator Status Filter Aktif */}
            <span style={{
              fontSize: '9.5px',
              fontFamily: 'var(--font-mono)',
              color: activeFilterInfo.color,
              background: `${activeFilterInfo.color}18`,
              border: `1px solid ${activeFilterInfo.color}55`,
              padding: '1px 7px',
              borderRadius: '3px',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <span style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: activeFilterInfo.color,
                boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.4), 0 1px 2px rgba(0, 0, 0, 0.85)'
              }} />
              FILTER AKTIF: {activeFilterInfo.label}
            </span>

            {/* Tombol Ekspansi Seluruh Cuplikan Berita */}
            <button
              type="button"
              onClick={toggleExpandAllCards}
              title={isAllExpanded ? "Tutup seluruh cuplikan berita pada semua kartu" : "Bentangkan seluruh cuplikan berita pada semua kartu"}
              style={{
                background: isAllExpanded ? 'linear-gradient(180deg, #243244 0%, #131B26 100%)' : 'linear-gradient(180deg, #1A222E 0%, #0E131C 100%)',
                borderTop: isAllExpanded ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.1)',
                borderBottom: isAllExpanded ? '2px solid #0B0E14' : '2px solid #080C10',
                borderLeft: isAllExpanded ? '1px solid #334358' : '1px solid #202A38',
                borderRight: isAllExpanded ? '1px solid #1A2330' : '1px solid #10151E',
                boxShadow: isAllExpanded ? '0 2px 6px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.18)' : '0 2px 4px rgba(0, 0, 0, 0.5)',
                color: isAllExpanded ? '#F1F5F9' : '#94A3B8',
                borderRadius: '4px',
                padding: '4px 10px',
                fontSize: '9.5px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.18s ease',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.85)'
              }}
            >
              {isAllExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              <span>{isAllExpanded ? 'TUTUP SEMUA CUPLIKAN' : 'BUKA SEMUA CUPLIKAN'}</span>
            </button>
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
              placeholder="Cari isu, cuplikan berita, klaim, atau rujukan..."
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
              <ShieldAlert size={11} color="#60A5FA" /> FILTER STATUS:
            </span>
            {[
              { 
                key: 'UNVERIFIED', 
                label: 'SEDANG DIPANTAU', 
                tooltip: 'Pemantauan terpadu rumor belum terverifikasi serta ISU BARU & MENINGKAT',
                count: triageCounts.UNVERIFIED, 
                color: '#F59E0B', 
                icon: Eye 
              },
              { 
                key: 'HOAKS', 
                label: 'TERINDIKASI HOAKS', 
                count: triageCounts.HOAKS, 
                color: '#EF4444', 
                icon: AlertTriangle 
              },
              { 
                key: 'RESOLVED', 
                label: 'FAKTA & AMAN', 
                count: triageCounts.FAKTA + triageCounts.NETRAL, 
                color: '#10B981', 
                icon: ShieldCheck 
              },
            ].map(tab => {
              const isSelected = activeViewMode === tab.key || selectedTriage === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  title={(tab as any).tooltip || tab.label}
                  onClick={() => {
                    setActiveViewMode(tab.key as any)
                    setSelectedTriage(tab.key as any)
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '10.5px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800,
                    borderTop: isSelected ? '1px solid rgba(255, 255, 255, 0.28)' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderBottom: isSelected ? `2px solid ${tab.color}` : '2px solid #080C10',
                    borderLeft: '1px solid #1E2838',
                    borderRight: '1px solid #121822',
                    background: isSelected 
                      ? 'linear-gradient(180deg, #243244 0%, #131A25 100%)' 
                      : 'linear-gradient(180deg, #161F2C 0%, #0D131B 100%)',
                    color: isSelected ? tab.color : '#94A3B8',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: isSelected 
                      ? '0 3px 8px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.18)' 
                      : '0 2px 4px rgba(0, 0, 0, 0.5)',
                    transition: 'all 0.18s ease',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.85)'
                  }}
                >
                  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                    <tab.icon size={12} color={isSelected ? tab.color : '#64748B'} />
                    {isSelected && (
                      <span style={{
                        position: 'absolute',
                        top: '-2px',
                        right: '-2px',
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        background: tab.color,
                        boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.4), 0 1px 2px rgba(0, 0, 0, 0.85)'
                      }} />
                    )}
                  </div>
                  <span>{tab.label}</span>
                  <span style={{
                    fontSize: '9.5px',
                    padding: '1px 6px',
                    borderRadius: '2px',
                    background: isSelected ? `${tab.color}22` : '#0B0F17',
                    border: `1px solid ${isSelected ? tab.color + '55' : '#253245'}`,
                    color: isSelected ? tab.color : '#64748B',
                    fontWeight: 900
                  }}>
                    {tab.count}
                  </span>
                  {isSelected && (
                    <span style={{
                      fontSize: '8px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 900,
                      letterSpacing: '0.5px',
                      color: '#070C14',
                      background: tab.color,
                      padding: '1px 4px',
                      borderRadius: '2px'
                    }}>
                      AKTIF
                    </span>
                  )}
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
                      borderColor: isSelected ? '#475569' : '#1E2734',
                      background: isSelected ? 'linear-gradient(180deg, #222C3A 0%, #131A24 100%)' : '#0B1017',
                      color: isSelected ? opt.color : '#94A3B8',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: isSelected ? 'inset 0 1px 0 rgba(255, 255, 255, 0.12)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{opt.label}</span>
                    <span style={{
                      fontSize: '8.5px',
                      padding: '0 5px',
                      borderRadius: '2px',
                      background: '#070C12',
                      border: '1px solid #202B3A',
                      color: isSelected ? opt.color : '#64748B',
                      fontWeight: 800
                    }}>
                      {count}
                    </span>
                  </button>
                )
              })}

            {/* Tombol Reset Filter jika aktif */}
            {(selectedCluster !== 'ALL' || activeViewMode !== 'UNVERIFIED' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCluster('ALL')
                  setActiveViewMode('UNVERIFIED')
                  setSelectedTriage('UNVERIFIED')
                  setSearchQuery('')
                }}
                title="Reset seluruh filter (Kembali ke SEDANG DIPANTAU)"
                style={{
                  padding: '3px 9px',
                  borderRadius: '3px',
                  fontSize: '9.5px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: '#EF4444',
                  background: 'linear-gradient(180deg, #222C3A 0%, #131A24 100%)',
                  border: '1px solid #3E4E68',
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.12)',
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
            {isSyncing ? (
              <div 
                className="steel-chassis-card"
                style={{
                  gridColumn: '1 / -1',
                  padding: '60px 20px',
                  textAlign: 'center',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '14px',
                  borderTop: '2px solid #A855F7'
                }}
              >
                <span className="bolt-tl" /><span className="bolt-tr" /><span className="bolt-bl" /><span className="bolt-br" />
                <RefreshCw size={24} color="#C084FC" className="spin-animation" />
                <div style={{ fontSize: '14px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#F8FAFC' }}>
                  SEDANG MEMINDAI LONJAKAN TREN PENELUSURAN...
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                  Menyerap sinyal agregat kata kunci pencarian publik terkini. Data akan tampil setelah pemindaian selesai.
                </div>
              </div>
            ) : trendSignals.length === 0 ? (
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
                        background: '#101622',
                        color: '#C084FC',
                        border: '1px solid #253346'
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
                          background: '#101622',
                          color: '#C084FC',
                          border: '1px solid #253346'
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
                    <span style={{
                      fontSize: '9.5px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      padding: '2px 8px',
                      background: '#101622',
                      border: '1px solid #253346',
                      color: '#38BDF8',
                      borderRadius: '3px'
                    }}>
                      {sig.searchVolumeBand || 'Lonjakan Sinyal'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── 3C. Grid Kartu Isu Viral Plat Baja (3 Kolom) ─── */}
      {activeViewMode !== 'TRENDS' && (
      <>
      <div 
        id="tactical-radar-feed-deck"
        style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
        gap: '16px',
        alignItems: 'stretch'
      }}>
        {isSyncing ? (
          <div 
            className="steel-chassis-card"
            style={{
              gridColumn: '1 / -1',
              padding: '64px 20px',
              textAlign: 'center',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px',
              borderTop: '2px solid #EF4444',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
            }}
          >
            <span className="bolt-tl" />
            <span className="bolt-tr" />
            <span className="bolt-bl" />
            <span className="bolt-br" />
            
            {/* Tactical Radar Spinner */}
            <div style={{ position: 'relative', width: '56px', height: '56px' }}>
              <div style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: '2px solid rgba(239, 68, 68, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: '1px dashed rgba(239, 68, 68, 0.4)'
                }} />
              </div>
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <RefreshCw size={24} color="#EF4444" className="spin-animation" />
              </div>
            </div>

            <div>
              <div style={{
                fontSize: '14px',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: '#F8FAFC',
                letterSpacing: '1px',
                textTransform: 'uppercase'
              }}>
                SEDANG MEMINDAI ARUS INTELIJEN 14 KANAL...
              </div>
              <div style={{
                fontSize: '11px',
                color: '#94A3B8',
                marginTop: '6px',
                maxWidth: '520px',
                lineHeight: 1.5
              }}>
                Menghubungkan konektor RSS, API Fact-Check, dan pangkalan data rujukan resmi. Seluruh entri data baru akan dimuat otomatis saat proses pemindaian selesai.
              </div>
            </div>

            {/* Tactical animated pulse sweep bar */}
            <div style={{
              width: '260px',
              height: '3px',
              background: '#1A2330',
              borderRadius: '2px',
              overflow: 'hidden',
              marginTop: '4px'
            }}>
              <div style={{
                height: '100%',
                width: '50%',
                background: 'linear-gradient(90deg, transparent, #EF4444, transparent)',
                animation: 'cyberLaserScan 1.2s infinite ease-out'
              }} />
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
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
          paginatedItems.map(item => {
            const isHoax = item.verdict === 'HOAKS' || item.verdict === 'DISINFORMASI' || item.verdict === 'PROPAGANDA'
            const isFact = item.verdict === 'FAKTA'
            const isUnverified = item.verdict === 'UNVERIFIED'
            const isArchived = archivedIssueIds.has(item.id)

            // Vonis klasifikasi efektif:
            // 1. Jika terarsip dan analis secara manual menyetel 'HOAKS' atau 'FAKTA', prioritaskan pilihan analis.
            // 2. Jika status arsip 'DIPANTAU' (default saat baru pertama diarsipkan) atau belum diset:
            //    - Bila data radar terverifikasi FAKTA resmi -> tampilkan FAKTA RESMI.
            //    - Bila data radar terverifikasi HOAKS -> tampilkan TERINDIKASI HOAKS.
            //    - Bila masih dalam pemantauan (UNVERIFIED) -> STATUS TETAP 'SEDANG DIPANTAU' (TIDAK BOLEH OTOMATIS HOAKS!).
            const archivedClassification = isArchived ? archivedVerdicts[item.id] : undefined

            let effectiveVerdict: 'HOAKS' | 'FAKTA' | 'UNVERIFIED' = 'UNVERIFIED'
            if (archivedClassification === 'FAKTA') {
              effectiveVerdict = 'FAKTA'
            } else if (archivedClassification === 'HOAKS') {
              effectiveVerdict = 'HOAKS'
            } else if (archivedClassification === 'DIPANTAU') {
              effectiveVerdict = isFact ? 'FAKTA' : isHoax ? 'HOAKS' : 'UNVERIFIED'
            } else if (isFact) {
              effectiveVerdict = 'FAKTA'
            } else if (isHoax) {
              effectiveVerdict = 'HOAKS'
            } else {
              effectiveVerdict = 'UNVERIFIED'
            }

            const isEffectiveHoax = effectiveVerdict === 'HOAKS'
            const isEffectiveFact = effectiveVerdict === 'FAKTA'
            const isEffectiveUnverified = effectiveVerdict === 'UNVERIFIED'

            const verdictLabel = isEffectiveHoax 
              ? 'TERINDIKASI HOAKS' 
              : isEffectiveFact 
              ? 'FAKTA RESMI' 
              : isEffectiveUnverified 
              ? 'SEDANG DIPANTAU' 
              : 'NETRAL'
            const verdictColor = isEffectiveHoax 
              ? '#EF4444' 
              : isEffectiveFact 
              ? '#10B981' 
              : isEffectiveUnverified 
              ? '#F59E0B' 
              : '#94A3B8'

            const score = item.cognitiveScore ?? 50
            const scoreColor = score >= 75 ? '#EF4444' : score >= 50 ? '#F59E0B' : '#10B981'

            const clusterMeta = CLUSTER_OPTIONS.find(c => c.key === item.cluster) || { label: item.cluster, color: '#94A3B8' }

            const isExpanded = isAllExpanded || expandedCardIds.has(item.id)
            
            // Susun naskah intelijen kaya informasi & berstruktur multi-paragraf untuk analis:
            // - Paragraf 1: Intisari Peristiwa & Fakta Otoritas Resmi / Cuplikan Warta
            // - Paragraf 2: Arahan Intelijen Taktis Teritorial / Rujukan Bukti Lanjutan
            const narrativeParts: string[] = []
            const rawBase = (item.clarification || item.factCheckReference?.explanation || '').trim()
            const cleanBase = rawBase.replace(/\s*(\.\.\.|…|\[\.\.\.\]|\[…\])\s*$/, '').trim()
            if (cleanBase) {
              narrativeParts.push(cleanBase)
            }

            if (item.tacticalResponseMilitary) {
              const cleanMil = item.tacticalResponseMilitary.replace(/\s*(\.\.\.|…|\[\.\.\.\]|\[…\])\s*$/, '').trim()
              if (cleanMil && !cleanBase.toLowerCase().includes(cleanMil.slice(0, 30).toLowerCase())) {
                narrativeParts.push(cleanMil)
              }
            } else if (item.factCheckReference?.explanation) {
              const cleanExp = item.factCheckReference.explanation.replace(/\s*(\.\.\.|…|\[\.\.\.\]|\[…\])\s*$/, '').trim()
              if (cleanExp && !cleanBase.toLowerCase().includes(cleanExp.slice(0, 30).toLowerCase())) {
                narrativeParts.push(cleanExp)
              }
            } else if (item.viralityReason && item.viralityReason.includes('Dilaporkan oleh')) {
              narrativeParts.push(`📌 Konteks Liputan Pers: ${item.viralityReason}`)
            }

            const fullNarrative = narrativeParts.join('\n\n') || cleanBase || 'Menunggu verifikasi fakta lanjutan.'

            // Kapasitas fisik kartu standar (440px) untuk menampung teks multi-paragraf tanpa overflow:
            // - Bila headline panjang (>85 char = 3 baris): sisa ruang tray ~480 karakter (~8-9 baris teks)
            // - Bila headline normal (<=85 char = 1-2 baris): sisa ruang tray ~560 karakter (~10-11 baris teks)
            const maxCardCapacity = item.claim.length > 85 ? 480 : 560
            const isLongText = fullNarrative.length > maxCardCapacity

            const textToShow = isExpanded ? (
              fullNarrative
            ) : (
              isLongText ? (
                (() => {
                  const targetChars = maxCardCapacity - 50
                  const trimmed = fullNarrative.slice(0, targetChars)
                  const lastSpace = trimmed.lastIndexOf(' ')
                  const cleanSnippet = lastSpace > targetChars - 40 ? trimmed.slice(0, lastSpace) : trimmed
                  return `${cleanSnippet.trim()}...`
                })()
              ) : (
                fullNarrative
              )
            )

            // Ekstraksi paragraf-paragraf agar dapat dirender rapi dengan spasi baris antar paragraf
            const paragraphs = textToShow.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
            const isExiting = animatingPinIds.has(item.id)

            return (
              <div
                key={item.id}
                className={`steel-chassis-card ${isExiting ? 'card-pin-exit-anim' : ''}`}
                style={{
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  position: 'relative',
                  gap: '12px',
                  borderTop: isArchived 
                    ? `2px solid ${isEffectiveHoax ? '#EF4444' : isEffectiveFact ? '#10B981' : '#D4A017'}` 
                    : score >= 75 
                    ? '2px solid #EF4444' 
                    : '1px solid #1E2734',
                  boxShadow: isArchived 
                    ? '0 12px 28px rgba(0, 0, 0, 0.85), inset 0 2px 0 rgba(255, 255, 255, 0.2)' 
                    : '0 8px 20px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
                  minHeight: isExiting ? '0px' : '440px',
                  height: isExiting ? 'auto' : (isExpanded ? 'fit-content' : '440px'),
                  transition: isExiting ? 'none' : 'all 0.2s ease',
                  pointerEvents: isExiting ? 'none' : 'auto'
                }}
              >
                <span className="bolt-tl" />
                <span className="bolt-tr" />
                <span className="bolt-bl" />
                <span className="bolt-br" />

                {/* Konten Utama Kartu */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
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
                      background: '#101622',
                      color: clusterMeta.color,
                      border: '1px solid #253346',
                      letterSpacing: '0.5px'
                    }}>
                      {clusterMeta.label}
                    </span>

                    {/* Lencana Vonis, Status Pin, & Indeks Relevansi Heuristik */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {/* Kontainer Status Interaktif dengan Cyber Bubble Chat (Zero Delay Tooltip) */}
                      <div
                        style={{ position: 'relative', display: 'inline-flex' }}
                        onMouseEnter={() => setHoveredStatusId(item.id)}
                        onMouseLeave={() => setHoveredStatusId(null)}
                      >
                        {isArchived ? (
                          <span 
                            style={{
                              fontSize: '9px',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '3px',
                              background: isEffectiveHoax 
                                ? 'rgba(239, 68, 68, 0.14)' 
                                : isEffectiveFact 
                                ? 'rgba(16, 185, 129, 0.14)' 
                                : 'rgba(56, 189, 248, 0.14)',
                              color: isEffectiveHoax 
                                ? '#F87171' 
                                : isEffectiveFact 
                                ? '#34D399' 
                                : '#38BDF8',
                              border: isEffectiveHoax 
                                ? '1px solid #7F1D1D' 
                                : isEffectiveFact 
                                ? '1px solid #064E3B' 
                                : '1px solid rgba(56, 189, 248, 0.4)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            <Pin 
                              size={9} 
                              color={isEffectiveHoax ? '#F87171' : isEffectiveFact ? '#34D399' : '#38BDF8'} 
                              style={{ transform: 'rotate(45deg)' }}
                            />
                            <span>{verdictLabel}</span>
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '9px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: '3px',
                            background: '#101622',
                            color: verdictColor,
                            border: '1px solid #253346',
                            cursor: 'pointer'
                          }}>
                            {verdictLabel}
                          </span>
                        )}

                        {/* CYBER BUBBLE CHAT HUD (Instant 0-ms Hover with Right-Sweep Animation) */}
                        {hoveredStatusId === item.id && (
                          <div 
                            className={`cyber-bubble-chat ${
                              isEffectiveHoax 
                                ? 'hoax' 
                                : isEffectiveFact 
                                ? 'fact' 
                                : 'unverified'
                            }`}
                          >
                            <div className="cyber-bubble-notch-top" />
                            
                            {/* Cyber HUD Header */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  background: isEffectiveHoax ? '#EF4444' : isEffectiveFact ? '#10B981' : '#F59E0B',
                                  boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.45), 0 1px 2px rgba(0, 0, 0, 0.85)'
                                }} />
                                <span style={{ fontSize: '8.5px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#94A3B8', letterSpacing: '0.8px' }}>
                                  {isArchived ? '// C2-BERITA-TERSEMAT' : '// C2-RADAR-VERIFY'}
                                </span>
                              </div>
                              <span style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', color: '#CBD5E1', background: 'rgba(255, 255, 255, 0.06)', padding: '1px 4px', borderRadius: '2px', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
                                RESPONS 0-MS
                              </span>
                            </div>

                            {/* Status Title */}
                            <div style={{
                              fontSize: '11px',
                              fontFamily: 'var(--font-display, "Rajdhani", sans-serif)',
                              fontWeight: 800,
                              color: isEffectiveHoax ? '#FCA5A5' : isEffectiveFact ? '#6EE7B7' : '#FDE68A',
                              letterSpacing: '0.5px',
                              marginBottom: '5px'
                            }}>
                              {isArchived
                                ? (isEffectiveHoax 
                                    ? 'TERINDIKASI HOAKS (TERSEMAT)' 
                                    : isEffectiveFact 
                                    ? 'TERVERIFIKASI FAKTA (TERSEMAT)' 
                                    : 'SEDANG DIPANTAU (TERSEMAT)')
                                : (isEffectiveHoax 
                                    ? 'TERINDIKASI HOAKS / DISINFORMASI' 
                                    : isEffectiveFact 
                                    ? 'TERVERIFIKASI FAKTA RESMI' 
                                    : 'SEDANG DALAM PEMANTAUAN')}
                            </div>

                            {/* Forensic Analysis Text */}
                            <div style={{
                              fontSize: '10px',
                              lineHeight: 1.4,
                              color: '#CBD5E1',
                              fontFamily: 'var(--font-sans)',
                              marginBottom: '6px'
                            }}>
                              {item.cluster === 'SIBER_PERETASAN' ? (
                                isEffectiveHoax
                                  ? 'Forensik Siber PUSSIBERAD/BSSN mengonfirmasi klaim ini sebagai HOAKS atau gertakan sepihak (extortion bluff/inspect element). Sistem target terverifikasi aman.'
                                  : isEffectiveFact
                                  ? 'Insiden siber TERVERIFIKASI FAKTA oleh BSSN / PUSSIBERAD / CSIRT instansi terkait. Bukti IOC, enkripsi, atau sampel data valid terkonfirmasi.'
                                  : 'Klaim insiden siber SEDANG DIPANTAU. Tim analis forensik siber sedang menguji validitas sampel dump, telemetri server, dan menunggu advisory resmi CSIRT.'
                              ) : isArchived ? (
                                isEffectiveHoax
                                  ? 'Isu disimpan dalam halaman Berita Tersemat. Deteksi intelijen mengidentifikasi anomali narasi manipulatif atau provokatif yang memerlukan penangkalan opini segera.'
                                  : isEffectiveFact
                                  ? 'Isu disimpan dalam halaman Berita Tersemat. Analisis intelijen mengonfirmasi keselarasan data lapangan dengan posko/instansi resmi terkait.'
                                  : 'Isu disimpan dalam halaman Berita Tersemat agar tidak tenggelam oleh derasnya arus berita lain hingga berhasil diklasifikasikan sebagai Fakta atau Hoaks.'
                              ) : isEffectiveUnverified ? (
                                'Laporan baru diserap radar dan sedang dalam pemantauan teritorial Babinsa/Siber. Bukti forensik pendukung terus dihimpun.'
                              ) : isEffectiveHoax ? (
                                'Materi narasi bertentangan dengan rujukan fakta resmi atau mengandung rekayasa informasi yang telah terbukti tidak sahih.'
                              ) : (
                                'Informasi sahih telah dikonfirmasi oleh rujukan kementerian, dinas penerangan, atau institusi otoritatif resmi.'
                              )}
                            </div>

                            {/* Operational Tip */}
                            <div style={{
                              fontSize: '8.5px',
                              fontFamily: 'var(--font-mono)',
                              color: '#64748B',
                              borderTop: '1px dashed rgba(255, 255, 255, 0.08)',
                              paddingTop: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <span style={{ color: '#F59E0B' }}>▶</span>
                              <span>{isArchived ? 'Berita tersimpan di tab Berita Tersemat untuk pemantauan prioritas' : 'Klik SEMATKAN untuk menyimpan berita ke Berita Tersemat agar tidak tenggelam'}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Lencana Bobot Intelijen Strategis untuk SEDANG DIPANTAU */}
                      {isEffectiveUnverified && item.intelligenceWeightLabel && (
                        <span style={{
                          fontSize: '8px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '2px',
                          background: '#101622',
                          color: item.intelligenceWeightColor || '#F59E0B',
                          border: `1px solid ${item.intelligenceWeightColor ? item.intelligenceWeightColor + '44' : '#F59E0B44'}`,
                          letterSpacing: '0.3px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }} title="Klasifikasi Bobot Intelijen NARADA: Menilai kedalaman dan urgensi substansi warta">
                          <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: item.intelligenceWeightColor || '#F59E0B' }} />
                          {item.intelligenceWeightLabel}
                        </span>
                      )}

                      {/* Skor Relevansi Konteks (Indikator Heuristik, BUKAN Probabilitas Ancaman) */}
                      <span style={{
                        fontSize: '9px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '2px',
                        background: '#101622',
                        color: scoreColor,
                        border: '1px solid #253346'
                      }} title="Skor Relevansi Konteks (0 - 100): Indikator heuristik keselarasan topik pantauan, bukan probabilitas kebenaran atau tingkat bahaya.">
                        RELEVANSI {score}/100
                      </span>

                      {/* Tombol Sematkan / Tersemat (Plat Besi Beveled) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleArchive(item)
                        }}
                        style={{
                          background: isArchived 
                            ? 'linear-gradient(180deg, #3D2D10 0%, #1F1706 100%)' 
                            : 'linear-gradient(180deg, #222C3A 0%, #131A24 100%)',
                          borderTop: isArchived 
                            ? '1px solid rgba(255, 255, 255, 0.25)' 
                            : '1px solid rgba(255, 255, 255, 0.12)',
                          borderBottom: isArchived 
                            ? '2px solid #3B2C01' 
                            : '2px solid #0B1017',
                          borderLeft: isArchived ? '1px solid #856404' : '1px solid #2B3746',
                          borderRight: isArchived ? '1px solid #533F02' : '1px solid #141C25',
                          boxShadow: isArchived 
                            ? '0 2px 5px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.15)' 
                            : '0 2px 4px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                          color: isArchived ? '#FDE047' : '#94A3B8',
                          fontSize: '9px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.18s ease',
                          textShadow: '0 1px 2px rgba(0, 0, 0, 0.9)'
                        }}
                        title={isArchived ? 'Lepas Sematan: Kembalikan berita ke radar biasa' : 'Sematkan Berita: Simpan ke halaman Berita Tersemat agar tidak tenggelam'}
                      >
                        <Pin size={10} color={isArchived ? '#FDE047' : '#94A3B8'} style={{ transform: isArchived ? 'rotate(45deg)' : 'none' }} />
                        <span>{isArchived ? 'TERSEMAT' : 'SEMATKAN'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Naskah / Klaim Isu Viral */}
                  <div style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#F8FAFC',
                    lineHeight: 1.5,
                    minHeight: '40px'
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

                      return (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '8.5px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 800,
                          color: badgeColor,
                          background: '#101622',
                          border: '1px solid #253346',
                          padding: '2px 6px',
                          borderRadius: '2px'
                        }}>
                          {isBrk && <Flame size={9} color={badgeColor} />}
                          <span>{fresh.status === 'BREAKING' ? 'BREAKING (<3J)' : fresh.status === 'AKTUAL' ? 'AKTUAL (<12J)' : fresh.status === 'BERKEMBANG' ? 'HARI INI (<24J)' : fresh.status === 'KONTEKS' ? 'KONTEKS (>24J)' : 'WAKTU N/A'}</span>
                        </span>
                      )
                    })()}

                    {/* Cakupan Domain Pers Independen */}
                    <span style={{
                      fontSize: '8.5px',
                      fontFamily: 'var(--font-mono)',
                      color: '#10B981',
                      background: '#101622',
                      border: '1px solid #253346',
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
                        const col = isRising ? '#F87171' : isNew ? '#FBBF24' : isSustained ? '#38BDF8' : '#94A3B8'
                        const label = isRising ? 'LIPUTAN MENINGKAT' : isNew ? 'ISU BARU' : isSustained ? 'LIPUTAN BERLANJUT' : 'MELANDAI'
                        return (
                          <span style={{
                            fontSize: '8.5px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '2px',
                            background: '#101622',
                            color: col,
                            border: '1px solid #253346',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}>
                            {isRising && <TrendingUp size={9} color={col} />}
                            {isNew && <Flame size={9} color={col} />}
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
                        background: '#101622',
                        color: '#38BDF8',
                        border: '1px solid #253346',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }} title={`Referensi Fact-Check Terkait: ${item.factCheckReference.referenceTitle}`}>
                        <ShieldCheck size={9} color="#38BDF8" />
                        <span>REFERENSI FACT-CHECK TERKAIT</span>
                      </span>
                    )}
                  </div>

                  {/* Strip Indikasi Klasifikasi Khusus Isu Terarsip */}
                  {isArchived && (
                    <div style={{
                      background: '#0D141F',
                      border: '1px solid #233144',
                      borderLeft: `3px solid ${isEffectiveHoax ? '#EF4444' : isEffectiveFact ? '#10B981' : '#38BDF8'}`,
                      padding: '6px 10px',
                      borderRadius: '3px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9.5px', fontFamily: 'var(--font-mono)' }}>
                        <Pin size={12} color="#38BDF8" style={{ transform: 'rotate(45deg)' }} />
                        <span style={{ color: '#94A3B8' }}>STATUS SEMATAN:</span>
                        <span style={{ 
                          fontWeight: 800, 
                          color: isEffectiveHoax ? '#F87171' : isEffectiveFact ? '#34D399' : '#38BDF8' 
                        }}>
                          {isEffectiveHoax 
                            ? 'TERINDIKASI HOAKS' 
                            : isEffectiveFact 
                            ? 'FAKTA RESMI' 
                            : 'SEDANG DIPANTAU'}
                        </span>
                      </div>

                      {/* Kontrol: Keluarkan dari Berita Tersemat */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleArchive(item)}
                          title="Keluarkan berita ini dari Berita Tersemat"
                          style={{
                            background: 'transparent',
                            color: '#94A3B8',
                            border: '1px solid #334155',
                            borderRadius: '2px',
                            padding: '2px 7px',
                            fontSize: '8.5px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <Pin size={9} style={{ transform: 'rotate(-45deg)', color: '#EF4444' }} />
                          <span>Lepas Sematan</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tray Cuplikan Berita / Fakta / Bukti Disinformasi */}
                  <div 
                    className="steel-sunken-tray"
                    style={{
                      padding: '12px 14px',
                      fontSize: '11.5px',
                      lineHeight: 1.6,
                      minHeight: '140px',
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-start',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div>
                      <div style={{
                        fontSize: '9.5px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        color: isFact ? '#10B981' : isHoax ? '#EF4444' : '#F59E0B',
                        marginBottom: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}>
                        {isFact ? <CheckCircle size={11} color="#10B981" /> : isHoax ? <AlertTriangle size={11} color="#EF4444" /> : <Newspaper size={11} color="#F59E0B" />}
                        {isFact ? 'FAKTA & KLARIFIKASI RESMI:' : isHoax ? 'BUKTI FABRIKASI & KLARIFIKASI:' : 'RINGKASAN & CUPLIKAN BERITA:'}
                      </div>

                      <div style={{
                        color: '#CBD5E1',
                        fontSize: '11.5px',
                        lineHeight: 1.65,
                        wordBreak: 'break-word',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        {paragraphs.map((para, pIdx) => (
                          <p key={pIdx} style={{ margin: 0, lineHeight: 1.65 }}>
                            {para}
                          </p>
                        ))}
                      </div>
                    </div>

                    {/* Tombol Baca Selengkapnya / Tutup Cuplikan (HANYA muncul jika teks melebihi space kartu) */}
                    {isLongText && (
                      <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed rgba(255, 255, 255, 0.08)' }}>
                        <button
                          type="button"
                          onClick={() => toggleCardExpand(item.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '2px 0',
                            color: isExpanded ? '#94A3B8' : '#38BDF8',
                            cursor: 'pointer',
                            fontSize: '9.5px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'color 0.15s ease'
                          }}
                          title={isExpanded ? 'Tutup cuplikan rincian' : 'Bentangkan dan baca seluruh cuplikan berita dari sumber'}
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp size={11} color="#94A3B8" />
                              <span>TUTUP CUPLIKAN</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown size={11} color="#38BDF8" />
                              <span>BACA SELENGKAPNYA</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Provenance & Sumber: Asal Pantauan vs Rujukan Otoritas */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    background: '#090E16',
                    border: '1px solid #1E2734',
                    borderRadius: '3px',
                    fontSize: '9.5px',
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

                    {(isHoax || isUnverified) ? (
                      <button
                        type="button"
                        onClick={() => handleOpenCounterModal(item)}
                        style={{
                          background: 'linear-gradient(180deg, #222C3A 0%, #131A24 100%)',
                          border: '1px solid #3E4E63',
                          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 2px 4px rgba(0, 0, 0, 0.4)',
                          color: isHoax ? '#F87171' : '#FBBF24',
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
                          e.currentTarget.style.borderColor = '#5B6F8C'
                          e.currentTarget.style.background = 'linear-gradient(180deg, #2A3648 0%, #17202C 100%)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#3E4E63'
                          e.currentTarget.style.background = 'linear-gradient(180deg, #222C3A 0%, #131A24 100%)'
                        }}
                        title={isHoax ? "Hasilkan draf rilis resmi bantahan Dispenad, panduan Babinsa, WA, dan medsos kilat" : "Siapkan draf klarifikasi resmi & panduan Babinsa untuk isu yang sedang dipantau"}
                      >
                        <Megaphone size={11} color={isHoax ? '#F87171' : '#FBBF24'} />
                        <span>Draf Kontranarasi Dispenad</span>
                      </button>
                    ) : (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          background: 'linear-gradient(180deg, #222C3A 0%, #131A24 100%)',
                          border: '1px solid #3E4E63',
                          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.12)',
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
                          e.currentTarget.style.borderColor = '#5B6F8C'
                          e.currentTarget.style.background = 'linear-gradient(180deg, #2A3648 0%, #17202C 100%)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#3E4E63'
                          e.currentTarget.style.background = 'linear-gradient(180deg, #222C3A 0%, #131A24 100%)'
                        }}
                        title="Buka dokumen verifikasi dan rujukan fakta otoritas resmi"
                      >
                        <ShieldCheck size={11} color="#34D399" />
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

      {/* ─── TACTICAL SEGMENTED PAGINATION CONTROLS (60 FPS DOM OPTIMIZATION) ─── */}
      {filteredItems.length > 0 && !isSyncing && (
        <div
          className="steel-chassis-card"
          style={{
            marginTop: '16px',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            position: 'relative'
          }}
        >
          <span className="bolt-tl" />
          <span className="bolt-tr" />
          <span className="bolt-bl" />
          <span className="bolt-br" />

          {/* Info Halaman & Rentang Data */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--accent-gold)', fontSize: '11px', fontWeight: 800 }}>///</span>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#94A3B8' }}>
              MENAMPILKAN{' '}
              <span style={{ color: '#38BDF8', fontWeight: 700 }}>
                {(safeCurrentPage - 1) * pageSize + 1} - {Math.min(safeCurrentPage * pageSize, filteredItems.length)}
              </span>{' '}
              DARI <span style={{ color: '#F1F5F9', fontWeight: 700 }}>{filteredItems.length}</span> ISU TERFILTER
            </span>
            <span style={{ color: '#334155' }}>│</span>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
              HALAMAN {safeCurrentPage} / {totalPages}
            </span>
          </div>

          {/* Navigasi Paginasi Cepat */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => handlePageChange(safeCurrentPage - 1)}
              style={{
                padding: '5px 12px',
                borderRadius: '4px',
                background: safeCurrentPage <= 1 ? '#090D14' : 'linear-gradient(180deg, #222C3A 0%, #131A24 100%)',
                border: safeCurrentPage <= 1 ? '1px solid #1E2734' : '1px solid #3E4E63',
                color: safeCurrentPage <= 1 ? '#475569' : '#38BDF8',
                fontSize: '10.5px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                cursor: safeCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              ◀ SEBELUMNYA
            </button>

            {/* Page Numbers */}
            {Array.from({ length: totalPages }, (_, idx) => idx + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 2)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1]
                const showEllipsis = prev && p - prev > 1
                return (
                  <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {showEllipsis && <span style={{ color: '#475569', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>...</span>}
                    <button
                      type="button"
                      onClick={() => handlePageChange(p)}
                      style={{
                        minWidth: '30px',
                        height: '26px',
                        borderRadius: '3px',
                        background: p === safeCurrentPage ? 'linear-gradient(180deg, #38BDF8 0%, #0284C7 100%)' : '#0F1622',
                        border: p === safeCurrentPage ? '1px solid #38BDF8' : '1px solid #222C3A',
                        color: p === safeCurrentPage ? '#040810' : '#94A3B8',
                        fontSize: '10.5px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: p === safeCurrentPage ? 900 : 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {p}
                    </button>
                  </span>
                )
              })}

            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => handlePageChange(safeCurrentPage + 1)}
              style={{
                padding: '5px 12px',
                borderRadius: '4px',
                background: safeCurrentPage >= totalPages ? '#090D14' : 'linear-gradient(180deg, #222C3A 0%, #131A24 100%)',
                border: safeCurrentPage >= totalPages ? '1px solid #1E2734' : '1px solid #3E4E63',
                color: safeCurrentPage >= totalPages ? '#475569' : '#38BDF8',
                fontSize: '10.5px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                cursor: safeCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              SELANJUTNYA ▶
            </button>

            {/* Pilihan Ukuran Halaman */}
            <span style={{ color: '#334155', margin: '0 4px' }}>│</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748B', marginRight: '2px' }}>KAPASITAS:</span>
              {[15, 30, 60].map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => { setPageSize(size); setCurrentPage(1) }}
                  style={{
                    padding: '3px 7px',
                    borderRadius: '3px',
                    background: pageSize === size ? '#1E293B' : '#0B1017',
                    border: pageSize === size ? '1px solid #38BDF8' : '1px solid #1E2734',
                    color: pageSize === size ? '#38BDF8' : '#64748B',
                    fontSize: '9.5px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      </>
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
                    background: '#101622',
                    color: '#EF4444',
                    border: '1px solid #253346'
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
                      borderColor: isSelected ? '#475569' : '#1E2734',
                      background: isSelected ? 'linear-gradient(180deg, #222C3A 0%, #131A24 100%)' : '#0B1017',
                      color: isSelected ? tab.color : '#64748B',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: isSelected ? 'inset 0 1px 0 rgba(255, 255, 255, 0.12)' : 'none',
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
                    background: 'linear-gradient(180deg, #222C3A 0%, #131A24 100%)',
                    border: '1px solid #3E4E68',
                    color: copiedSuccess ? '#10B981' : '#F1F5F9',
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

      {/* ─── TOAST NOTIFIKASI TAKTIS: BERITA TERSEMAT (Pojok Kanan Bawah) ─── */}
      {pinToast && (
        <div
          className={`steel-chassis-card ${isToastExiting ? 'tactical-popup-exit' : 'tactical-popup-enter'}`}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 99999,
            width: '390px',
            maxWidth: 'calc(100vw - 48px)',
            padding: '14px 16px',
            background: 'linear-gradient(170deg, #1C2533 0%, #111822 55%, #0A0F16 100%)',
            borderTop: '2px solid #475569',
            borderLeft: '2px solid #334155',
            borderRight: '2px solid #161F2C',
            borderBottom: '2px solid #0A0E15',
            borderRadius: '6px',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.95), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            overflow: 'hidden'
          }}
        >
          <span className="bolt-tl" />
          <span className="bolt-tr" />
          <span className="bolt-bl" />
          <span className="bolt-br" />

          {/* Header Toast */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '30px',
                height: '30px',
                borderRadius: '4px',
                background: 'linear-gradient(180deg, #3D2D10 0%, #1F1706 100%)',
                borderTop: '1px solid rgba(255, 255, 255, 0.25)',
                borderBottom: '2px solid #3B2C01',
                borderLeft: '1px solid #856404',
                borderRight: '1px solid #533F02',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FDE047',
                boxShadow: '0 2px 5px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                flexShrink: 0
              }}>
                <Pin size={15} style={{ transform: 'rotate(-45deg)' }} />
              </div>
              <div>
                <div style={{
                  fontSize: '11.5px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  color: '#F8FAFC',
                  letterSpacing: '0.6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  BERITA TELAH DISEMATKAN!
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#10B981',
                    boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.45), 0 1px 2px rgba(0, 0, 0, 0.85)',
                    display: 'inline-block'
                  }} />
                </div>
                <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#CBD5E1', marginTop: '1px' }}>
                  Dipindahkan ke menu <strong>Berita Tersemat</strong> agar tidak tenggelam di arus radar.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDismissToast}
              title="Tutup notifikasi"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid #2A3644',
                borderRadius: '3px',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '3px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#F1F5F9'
                e.currentTarget.style.borderColor = '#475569'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#94A3B8'
                e.currentTarget.style.borderColor = '#2A3644'
              }}
            >
              <X size={13} />
            </button>
          </div>

          {/* Cuplikan Isu Tersemat */}
          <div style={{
            fontSize: '11px',
            color: '#E2E8F0',
            lineHeight: 1.45,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            background: 'linear-gradient(180deg, #101622 0%, #090D13 100%)',
            padding: '7px 10px',
            borderRadius: '4px',
            border: '1px solid #1C2636',
            boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.8)',
            fontFamily: 'var(--font-mono)'
          }}>
            {pinToast.cluster && (
              <span style={{
                color: pinToast.clusterColor || '#38BDF8',
                fontWeight: 700,
                marginRight: '6px'
              }}>
                [{pinToast.cluster}]
              </span>
            )}
            "{pinToast.claim}"
          </div>

          {/* Footer Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', paddingTop: '2px' }}>
            {hideArchivedInRadar ? (
              <button
                type="button"
                onClick={() => setHideArchivedInRadar(false)}
                title="Tampilkan kembali berita yang disematkan di halaman radar ini"
                style={{
                  background: 'linear-gradient(180deg, #182230 0%, #0E141E 100%)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                  borderBottom: '2px solid #080C10',
                  borderLeft: '1px solid #202A38',
                  borderRight: '1px solid #10151E',
                  color: '#94A3B8',
                  borderRadius: '3px',
                  padding: '4px 8px',
                  fontSize: '9.5px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Tetap Tampilkan di Radar
              </button>
            ) : (
              <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle size={10} color="#10B981" /> Terlihat di Radar & Tersemat
              </span>
            )}

            <button
              type="button"
              onClick={() => {
                handleDismissToast()
                navigate('/archive')
              }}
              style={{
                background: 'linear-gradient(180deg, #2D394A 0%, #18202D 100%)',
                borderTop: '1px solid rgba(255, 255, 255, 0.25)',
                borderBottom: '2px solid #0A0E15',
                borderLeft: '1px solid #3A4A60',
                borderRight: '1px solid #141B26',
                color: '#FDE047',
                borderRadius: '3px',
                padding: '4px 10px',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                transition: 'all 0.18s ease',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.85)'
              }}
            >
              <span>BUKA BERITA TERSEMAT</span>
              <ExternalLink size={10} />
            </button>
          </div>

          {/* Auto-Dismiss Animated Progress Bar */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: 'rgba(212, 160, 23, 0.2)'
          }}>
            <div
              className="toast-progress-bar"
              style={{
                height: '100%',
                background: '#D4A017'
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
