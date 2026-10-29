import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  Radio,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  Flame,
  Zap,
  Copy,
  Check,
  Share2,
  Users,
  Bot,
  Clock,
  Building,
  MessageSquare,
  Eye,
  Heart,
  FileText,
  X,
  RefreshCw,
  Play
} from 'lucide-react'
import type { DebunkKnowledgeEntry } from '../types'
import {
  generateSocialThreatDossier,
  harvestAndSynthesizeDossier,
  type SocialThreatDossier,
  type CommentTriageCategory
} from '../engine/social-threat-dossier'
import {
  generateCounterNarratives,
  type CounterNarrativeChannels
} from '../engine/forensic/counter-narrative-generator'
import { getCuratedArchiveDebunks } from '../engine/data/debunk-service'
import { getCachedRadarItems, updateRadarItemStatus } from '../utils/db-adapter'

export default function SocialForensic() {
  const navigate = useNavigate()
  const location = useLocation()

  // ─── 1. Penentuan Entitas Target ───
  const [targetItem, setTargetItem] = useState<DebunkKnowledgeEntry | null>(() => {
    const state = location.state as { targetItem?: DebunkKnowledgeEntry; item?: DebunkKnowledgeEntry } | undefined
    if (state?.targetItem) return state.targetItem
    if (state?.item) return state.item

    const archives = getCuratedArchiveDebunks()
    const unverified = archives.find(a => a.verdict === 'UNVERIFIED')
    return unverified || archives[0] || null
  })

  // Sinkronisasi dengan IndexedDB jika diperlukan
  useEffect(() => {
    if (!targetItem) {
      getCachedRadarItems().then(items => {
        if (items && items.length > 0) {
          const unverified = items.find(a => a.verdict === 'UNVERIFIED')
          setTargetItem(unverified || items[0])
        }
      })
    }
  }, [targetItem])

  // ─── 2. State Progressive Streaming OSINT Harvester ───
  const [isHarvesting, setIsHarvesting] = useState<boolean>(true)
  const [harvestStage, setHarvestStage] = useState<number>(1)
  const [harvestStageText, setHarvestStageText] = useState<string>('Inisiasi Query Entitas & Rekam Jejak OSINT...')
  const [dossier, setDossier] = useState<SocialThreatDossier>(() => generateSocialThreatDossier(targetItem || {}))

  const executeHarvest = useCallback(async (itemToHarvest: Partial<DebunkKnowledgeEntry>) => {
    setIsHarvesting(true)
    setHarvestStage(1)
    setHarvestStageText('Inisiasi Query Entitas & Rekam Jejak OSINT...')

    try {
      const res = await harvestAndSynthesizeDossier(itemToHarvest, (stage, stageName) => {
        setHarvestStage(stage)
        setHarvestStageText(stageName)
      })
      setDossier(res)
    } catch {
      // Fallback gracefully ke mode lokal aman
      setDossier(generateSocialThreatDossier(itemToHarvest))
    } finally {
      setIsHarvesting(false)
    }
  }, [])

  useEffect(() => {
    if (targetItem) {
      executeHarvest(targetItem)
    }
  }, [targetItem, executeHarvest])

  // ─── 3. State Filter & Interaktivitas UI ───
  const [activePlatformTab, setActivePlatformTab] = useState<'YOUTUBE' | 'TWITTER' | 'TIKTOK' | 'NEWS'>('YOUTUBE')
  const [activeCommentFilter, setActiveCommentFilter] = useState<'ALL' | CommentTriageCategory>('ALL')
  const [selectedClusterPattern, setSelectedClusterPattern] = useState<string | null>(null)
  const [statusUpdateMessage, setStatusUpdateMessage] = useState<string | null>(null)

  // ─── 4. State Modal Kontranarasi Dispenad ───
  const [isCounterModalOpen, setIsCounterModalOpen] = useState<boolean>(false)
  const [counterChannels, setCounterChannels] = useState<CounterNarrativeChannels | null>(null)
  const [activeCounterTab, setActiveCounterTab] = useState<'dispenad' | 'babinsa' | 'whatsapp' | 'social'>('dispenad')
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false)

  // Keyboard shortcut: tombol Escape untuk kembali ke radar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCounterModalOpen) {
          setIsCounterModalOpen(false)
        } else {
          navigate('/radar')
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isCounterModalOpen, navigate])

  // Handler Buka Modal Kontranarasi
  const handleOpenCounterModal = () => {
    if (!targetItem) return
    const drafts = generateCounterNarratives(
      targetItem.claim,
      {
        claim: targetItem.claim,
        clarification: targetItem.clarification,
        officialSource: targetItem.officialSource,
        sourceUrl: targetItem.sourceUrl,
        cluster: targetItem.cluster
      },
      targetItem.originalPlatform || 'MEDIA SOSIAL'
    )
    setCounterChannels(drafts)
    setActiveCounterTab('dispenad')
    setIsCounterModalOpen(true)
  }

  // Handler Salin Teks Draf
  const handleCopyDraft = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSuccess(true)
    setTimeout(() => setCopiedSuccess(false), 2200)
  }

  // Handler Kirim ke Multi-Input Analyzer
  const handleSendToAnalyzer = () => {
    if (!targetItem) return
    navigate('/analyzer', {
      state: {
        prefill: targetItem.claim,
        sourceUrl: targetItem.originalSourceUrl || targetItem.sourceUrl
      }
    })
  }

  // Handler Kirim ke Laporan Intelijen A4
  const handleSendToReports = () => {
    if (!targetItem) return
    navigate('/reports', {
      state: {
        prefillClaim: targetItem.claim,
        prefillCluster: targetItem.cluster,
        prefillConfidence: dossier.cibCoordinationIndex
      }
    })
  }

  // Handler Update Status Isu Langsung (Triage Taktis)
  const handleUpdateTriage = async (newStatus: 'HOAKS' | 'FAKTA') => {
    if (!targetItem) return
    await updateRadarItemStatus(targetItem.id, newStatus)
    setStatusUpdateMessage(`Status isu berhasil diubah menjadi: ${newStatus}`)
    setTimeout(() => setStatusUpdateMessage(null), 3000)
  }

  // Filter Aliran Komentar
  const filteredComments = useMemo(() => {
    let list = dossier.commentsStream

    if (activeCommentFilter !== 'ALL') {
      list = list.filter(c => c.triageCategory === activeCommentFilter)
    }

    if (selectedClusterPattern) {
      list = list.filter(c => c.matchedClusterPattern === selectedClusterPattern)
    }

    return list
  }, [dossier.commentsStream, activeCommentFilter, selectedClusterPattern])

  // Dapatkan Preview Postingan yang Sedang Dipilih
  const currentPreview = useMemo(() => {
    const found = dossier.platformPreviews.find(p => p.platform === activePlatformTab)
    return found || dossier.platformPreviews[0]
  }, [dossier.platformPreviews, activePlatformTab])

  return (
    <div style={{
      maxWidth: '1540px',
      margin: '0 auto',
      padding: '24px 20px 60px',
      color: '#E2E8F0',
      minHeight: '100vh',
      fontFamily: 'var(--font-sans)'
    }}>

      {/* ─── 1. TOP COMMAND BREADCRUMB BAR ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        paddingBottom: '14px',
        borderBottom: '1px solid #1E2734',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => navigate('/radar')}
            title="Kembali ke Radar Berita Viral [Esc]"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: '#121822',
              border: '1px solid #2B384E',
              color: '#94A3B8',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#F1F5F9'
              e.currentTarget.style.borderColor = '#38BDF8'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#94A3B8'
              e.currentTarget.style.borderColor = '#2B384E'
            }}
          >
            <ArrowLeft size={13} />
            <span>KEMBALI KE RADAR</span>
            <span style={{ fontSize: '9px', opacity: 0.6, border: '1px solid #334155', padding: '0 4px', borderRadius: '2px' }}>ESC</span>
          </button>

          <span style={{ color: '#2B384E' }}>│</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '3px',
              background: 'rgba(245, 158, 11, 0.18)',
              color: '#FBBF24',
              border: '1px solid rgba(245, 158, 11, 0.45)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Radio size={11} className="spin-animation" />
              STATUS: SEDANG DIPANTAU (UNVERIFIED)
            </span>

            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '3px',
              background: `${dossier.clusterColor}20`,
              color: dossier.clusterColor,
              border: `1px solid ${dossier.clusterColor}40`
            }}>
              {dossier.clusterLabel}
            </span>
          </div>
        </div>

        {/* Telemetri Live & Sumber Data Asli */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            background: '#0D141F',
            border: '1px solid #1E2734',
            borderRadius: 'var(--radius-pill)',
            fontSize: '10.5px',
            fontFamily: 'var(--font-mono)'
          }}>
            <span style={{ color: '#64748B' }}>SUMBER:</span>
            <strong style={{ color: dossier.isLiveHarvested ? '#10B981' : '#F59E0B' }}>
              {dossier.isLiveHarvested ? 'LIVE OSINT WEB INGESTION' : 'ARSIP INTELIJEN TERVERIFIKASI'}
            </strong>
            <span style={{ color: '#2B3846' }}>│</span>
            <span style={{ color: '#64748B' }}>LATENSI:</span>
            <strong style={{ color: '#38BDF8' }}>{dossier.harvestLatencyMs}ms</strong>
          </div>

          <button
            type="button"
            onClick={() => targetItem && executeHarvest(targetItem)}
            disabled={isHarvesting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              background: '#121822',
              border: '1px solid #2B384E',
              color: isHarvesting ? '#64748B' : '#38BDF8',
              borderRadius: '4px',
              fontSize: '10.5px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              cursor: isHarvesting ? 'wait' : 'pointer'
            }}
            title="Panen ulang data media sosial & komentar warganet terbaru secara real-time"
          >
            <RefreshCw size={12} className={isHarvesting ? 'spin-animation' : ''} />
            <span>{isHarvesting ? 'MEMINDAI...' : 'PANEN ULANG'}</span>
          </button>
        </div>
      </div>

      {/* ─── PROGRESSIVE STREAMING OSINT HUD STRIP ─── */}
      <div style={{
        background: '#0B111A',
        border: '1px solid #1E2734',
        borderRadius: '6px',
        padding: '10px 14px',
        marginBottom: '16px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isHarvesting ? '#F59E0B' : '#10B981',
              boxShadow: isHarvesting ? '0 0 8px #F59E0B' : '0 0 8px #10B981',
              display: 'inline-block'
            }} />
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#F1F5F9' }}>
              PIPELINE EKSTRAKSI SIBER LAPANGAN (FASE {harvestStage}/5):
            </span>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: isHarvesting ? '#FBBF24' : '#34D399' }}>
              {harvestStageText}
            </span>
          </div>

          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
            KATA KUNCI FOKUS: <strong style={{ color: '#38BDF8' }}>"{dossier.focusedKeywords}"</strong>
          </span>
        </div>

        {/* Progress Bar 5 Tahap */}
        <div style={{
          height: '4px',
          background: '#16202C',
          borderRadius: '2px',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: `${isHarvesting ? harvestStage * 20 : 100}%`,
            background: isHarvesting ? 'linear-gradient(90deg, #38BDF8, #F59E0B)' : '#10B981',
            transition: 'width 0.4s ease'
          }} />
        </div>
      </div>

      {/* Pesan Notifikasi Perubahan Status (Flash Bar) */}
      {statusUpdateMessage && (
        <div style={{
          marginBottom: '14px',
          padding: '8px 14px',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid #10B981',
          borderRadius: '4px',
          color: '#34D399',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={14} />
          <span>{statusUpdateMessage}</span>
        </div>
      )}

      {/* ─── 2. DOSSIER HERO BANNER & COMMAND CONTROLS ─── */}
      <div 
        className="steel-chassis-card"
        style={{
          padding: '20px 24px',
          marginBottom: '20px',
          position: 'relative'
        }}
      >
        <span className="bolt-tl" />
        <span className="bolt-tr" />
        <span className="bolt-bl" />
        <span className="bolt-br" />

        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '16px'
        }}>
          <div style={{ flex: 1, minWidth: '320px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              color: '#38BDF8',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: '6px'
            }}>
              <Flame size={12} />
              BERKAS INTELIJEN SIBER SOSIAL (LEFT-OF-BANG CHAMBER)
            </div>
            <h1 style={{
              fontSize: '20px',
              fontWeight: 800,
              color: '#F8FAFC',
              margin: '0 0 6px 0',
              lineHeight: 1.35,
              letterSpacing: '-0.3px'
            }}>
              "{dossier.targetClaim}"
            </h1>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginTop: '8px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: '#64748B',
              flexWrap: 'wrap'
            }}>
              <span>Sumber Rujukan Awal: <strong style={{ color: '#CBD5E1' }}>{targetItem?.originalPlatform || 'Portal Berita / Google Trends'}</strong></span>
              <span>•</span>
              <span>Rujukan Verifikasi: <strong style={{ color: '#10B981' }}>{targetItem?.officialSource || 'TurnBackHoax & Otoritas'}</strong></span>
            </div>
          </div>

          {/* Action Command Hub Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleSendToAnalyzer}
              style={{
                background: 'rgba(200, 16, 46, 0.16)',
                border: '1px solid #DC2626',
                color: '#F87171',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                padding: '8px 14px',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#C8102E'
                e.currentTarget.style.color = '#FFFFFF'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(200, 16, 46, 0.16)'
                e.currentTarget.style.color = '#F87171'
              }}
              title="Bawa teks klaim dan narasi ini ke Multi-Input Analyzer untuk pembuktian mendalam"
            >
              <Zap size={13} />
              <span>Uji di Analyzer</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCounterModal}
              style={{
                background: 'rgba(239, 68, 68, 0.16)',
                border: '1px solid rgba(239, 68, 68, 0.45)',
                color: '#FCA5A5',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                padding: '8px 14px',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#DC2626'
                e.currentTarget.style.color = '#FFFFFF'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.16)'
                e.currentTarget.style.color = '#FCA5A5'
              }}
              title="Formulasikan draf rilis resmi bantahan Dispenad dan panduan Babinsa"
            >
              <ShieldAlert size={13} />
              <span>Draf Kontranarasi Dispenad</span>
            </button>

            <button
              type="button"
              onClick={handleSendToReports}
              style={{
                background: '#121822',
                border: '1px solid #2B384E',
                color: '#94A3B8',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                padding: '8px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Buat berkas intelijen format A4 standar Mabesad"
            >
              <FileText size={13} />
              <span>Ekspor Berkas A4</span>
            </button>
          </div>
        </div>

        {/* Alarm Banner & Anomali Jeda Waktu Dinamis */}
        <div style={{
          background: dossier.isBuzzerAlarmActive ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
          border: `1px solid ${dossier.isBuzzerAlarmActive ? 'rgba(239, 68, 68, 0.45)' : 'rgba(16, 185, 129, 0.45)'}`,
          borderRadius: '4px',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={16} color={dossier.isBuzzerAlarmActive ? '#EF4444' : '#10B981'} />
            <span style={{ fontSize: '11px', color: '#F1F5F9', fontWeight: 600 }}>
              {dossier.anomalyAlert}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '3px',
              background: '#0D141F',
              color: '#CBD5E1',
              border: '1px solid #1E2734'
            }}>
              INDEKS KOORDINASI CIB: <strong style={{ color: dossier.isBuzzerAlarmActive ? '#EF4444' : '#10B981' }}>{dossier.cibCoordinationIndex}/100</strong>
            </span>
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '3px',
              background: dossier.isBuzzerAlarmActive ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)',
              color: dossier.isBuzzerAlarmActive ? '#FCA5A5' : '#6EE7B7'
            }}>
              {dossier.escalationLevel}
            </span>
          </div>
        </div>
      </div>

      {/* ─── 3. BARIS UTAMA: DECK 1 (MULTI-PLATFORM PREVIEWS) & DECK 2 (REKAP STATUS KOMENTAR) ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
        gap: '20px',
        marginBottom: '20px'
      }}>
        
        {/* ─── DECK 1: 4 MULTI-PLATFORM SOCIAL THREAT PREVIEWS ─── */}
        <div 
          className="steel-chassis-card"
          style={{
            padding: '18px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}
        >
          <span className="bolt-tl" />
          <span className="bolt-tr" />
          <span className="bolt-bl" />
          <span className="bolt-br" />

          {/* Header Deck 1 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #1E2734',
            paddingBottom: '10px',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                color: '#38BDF8',
                background: 'rgba(56, 189, 248, 0.15)',
                padding: '2px 7px',
                borderRadius: '3px'
              }}>
                VEKTOR MEDSOS
              </span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#F1F5F9' }}>
                Preview Postingan Terkait di Lapangan
              </span>
            </div>

            {/* Platform Selector Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
              {[
                { key: 'YOUTUBE', label: 'YouTube (Liputan)', color: '#FF0000' },
                { key: 'TWITTER', label: 'X (Twitter)', color: '#1DA1F2' },
                { key: 'TIKTOK', label: 'TikTok', color: '#00F2FE' },
                { key: 'NEWS', label: 'Portal / Arsip', color: '#10B981' }
              ].map(tab => {
                const isSelected = activePlatformTab === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActivePlatformTab(tab.key as any)}
                    style={{
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      padding: '4px 8px',
                      borderRadius: '3px',
                      border: '1px solid',
                      borderColor: isSelected ? tab.color : '#1E2734',
                      background: isSelected ? `${tab.color}20` : '#0B1017',
                      color: isSelected ? '#FFFFFF' : '#64748B',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Visual Mockup Card Postingan Aktif */}
          <div style={{
            background: '#0B1017',
            border: `1px solid ${currentPreview.accentColor}40`,
            borderRadius: '6px',
            padding: '16px',
            position: 'relative'
          }}>
            {/* Top Post Meta */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: currentPreview.platform === 'TIKTOK' || currentPreview.platform === 'TWITTER' || currentPreview.platform === 'YOUTUBE' ? '50%' : '6px',
                  background: currentPreview.avatarColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '14px'
                }}>
                  {currentPreview.authorDisplayName.charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#F8FAFC' }}>
                    {currentPreview.authorDisplayName}
                  </div>
                  <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                    {currentPreview.authorHandle} • {currentPreview.accountMeta}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {currentPreview.mediaBadge && (
                  <span style={{
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '2px',
                    background: '#16202C',
                    color: '#94A3B8',
                    border: '1px solid #28374D'
                  }}>
                    {currentPreview.mediaBadge}
                  </span>
                )}
                {currentPreview.specialTag && (
                  <span style={{
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '2px',
                    background: 'rgba(245, 158, 11, 0.2)',
                    color: '#FBBF24',
                    border: '1px solid rgba(245, 158, 11, 0.4)'
                  }}>
                    {currentPreview.specialTag}
                  </span>
                )}
              </div>
            </div>

            {/* Thumbnail Preview jika tersedia (YouTube Video Liputan) */}
            {currentPreview.thumbnailUrl && (
              <div style={{
                position: 'relative',
                borderRadius: '6px',
                overflow: 'hidden',
                marginBottom: '12px',
                maxHeight: '180px',
                background: '#05080E'
              }}>
                <img
                  src={currentPreview.thumbnailUrl}
                  alt={currentPreview.authorDisplayName}
                  style={{ width: '100%', height: '180px', objectFit: 'cover', opacity: 0.85 }}
                />
                <a
                  href={currentPreview.directSearchUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'rgba(239, 68, 68, 0.85)',
                    color: '#FFFFFF',
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                    cursor: 'pointer'
                  }}
                  title="Putar Video Asli di YouTube"
                >
                  <Play size={20} fill="#FFFFFF" />
                </a>
              </div>
            )}

            {/* Post Caption Body */}
            <div style={{
              fontSize: '12.5px',
              color: '#E2E8F0',
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
              marginBottom: '14px'
            }}>
              {currentPreview.captionText}
            </div>

            {/* Hashtag List */}
            {currentPreview.hashtags.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                {currentPreview.hashtags.map((h, i) => (
                  <span key={i} style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: currentPreview.accentColor }}>
                    {h}
                  </span>
                ))}
              </div>
            )}

            {/* Engagement Strip & Dual-Gateway Action Buttons (Anti-Error) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid #1C2532',
              paddingTop: '10px',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: '#94A3B8' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Eye size={12} color="#64748B" /> {currentPreview.metrics.viewsOrPlays}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Heart size={12} color="#EC4899" /> {currentPreview.metrics.likesOrFavs}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Share2 size={12} color="#38BDF8" /> {currentPreview.metrics.sharesOrForwards}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MessageSquare size={12} color="#F59E0B" /> {currentPreview.metrics.commentsCount}
                </span>
              </div>

              {/* Dual-Gateway Buttons: Tautan Langsung & Google OSINT Dork */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <a
                  href={currentPreview.directSearchUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: currentPreview.accentColor,
                    background: `${currentPreview.accentColor}18`,
                    border: `1px solid ${currentPreview.accentColor}40`,
                    padding: '4px 10px',
                    borderRadius: '3px',
                    textDecoration: 'none',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease'
                  }}
                  title="Buka langsung pencarian platform terkait"
                >
                  <span>Buka di {currentPreview.platformLabel}</span>
                  <ExternalLink size={10} />
                </a>

                {currentPreview.backupDorkUrl && (
                  <a
                    href={currentPreview.backupDorkUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: '#34D399',
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      padding: '4px 8px',
                      borderRadius: '3px',
                      textDecoration: 'none',
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Buka via Google OSINT Dork (100% Kebal Server Error & WAF)"
                  >
                    <span>Google OSINT Dork 🛡️</span>
                    <ExternalLink size={9} />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─── DECK 2: REKAPITULASI STATUS KOMENTAR & CIB ANOMALY SCORECARD ─── */}
        <div 
          className="steel-chassis-card"
          style={{
            padding: '18px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}
        >
          <span className="bolt-tl" />
          <span className="bolt-tr" />
          <span className="bolt-bl" />
          <span className="bolt-br" />

          {/* Header Deck 2 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #1E2734',
            paddingBottom: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                color: '#F59E0B',
                background: 'rgba(245, 158, 11, 0.15)',
                padding: '2px 7px',
                borderRadius: '3px'
              }}>
                REKAPITULASI STATUS
              </span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#F1F5F9' }}>
                Komposisi Opini: Organik vs Buzzer
              </span>
            </div>

            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
              TOTAL SAMPEL: <strong>{dossier.rekapKomentar.totalScanned} KOMENTAR</strong>
            </span>
          </div>

          {/* Interactive 3-Segment Distribution Bar */}
          <div>
            <div style={{
              height: '14px',
              borderRadius: '4px',
              overflow: 'hidden',
              display: 'flex',
              background: '#090D14',
              border: '1px solid #1E2734',
              marginBottom: '10px'
            }}>
              <div 
                style={{ width: `${dossier.rekapKomentar.organikPercent}%`, background: '#10B981', transition: 'width 0.3s' }} 
                title={`Warganet Organik: ${dossier.rekapKomentar.organikPercent}%`}
              />
              <div 
                style={{ width: `${dossier.rekapKomentar.rawanPercent}%`, background: '#F59E0B', transition: 'width 0.3s' }} 
                title={`Rawan Buzzer: ${dossier.rekapKomentar.rawanPercent}%`}
              />
              <div 
                style={{ width: `${dossier.rekapKomentar.botPercent}%`, background: '#EF4444', transition: 'width 0.3s' }} 
                title={`Sindikat Bot Copypasta: ${dossier.rekapKomentar.botPercent}%`}
              />
            </div>

            {/* Rekapitulasi 3 Status Box (Bisa Diklik untuk Filter Komentar) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setActiveCommentFilter(activeCommentFilter === 'ORGANIK' ? 'ALL' : 'ORGANIK')
                  setSelectedClusterPattern(null)
                }}
                style={{
                  background: activeCommentFilter === 'ORGANIK' ? 'rgba(16, 185, 129, 0.2)' : '#0B111A',
                  border: `1px solid ${activeCommentFilter === 'ORGANIK' ? '#10B981' : '#1E2734'}`,
                  borderRadius: '4px',
                  padding: '8px 10px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#10B981', fontWeight: 800 }}>
                  🟢 WARGANET ORGANIK
                </div>
                <div style={{ fontSize: '16px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#FFFFFF', marginTop: '2px' }}>
                  {dossier.rekapKomentar.organikPercent}%
                </div>
                <div style={{ fontSize: '9px', color: '#64748B', marginTop: '2px' }}>
                  {dossier.rekapKomentar.organikCount} akun wajar
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveCommentFilter(activeCommentFilter === 'RAWAN_BUZZER' ? 'ALL' : 'RAWAN_BUZZER')
                  setSelectedClusterPattern(null)
                }}
                style={{
                  background: activeCommentFilter === 'RAWAN_BUZZER' ? 'rgba(245, 158, 11, 0.2)' : '#0B111A',
                  border: `1px solid ${activeCommentFilter === 'RAWAN_BUZZER' ? '#F59E0B' : '#1E2734'}`,
                  borderRadius: '4px',
                  padding: '8px 10px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#F59E0B', fontWeight: 800 }}>
                  🟡 RAWAN BUZZER
                </div>
                <div style={{ fontSize: '16px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#FFFFFF', marginTop: '2px' }}>
                  {dossier.rekapKomentar.rawanPercent}%
                </div>
                <div style={{ fontSize: '9px', color: '#64748B', marginTop: '2px' }}>
                  {dossier.rekapKomentar.rawanCount} akun provokatif
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveCommentFilter(activeCommentFilter === 'BOT_COPYPASTA' ? 'ALL' : 'BOT_COPYPASTA')
                  setSelectedClusterPattern(null)
                }}
                style={{
                  background: activeCommentFilter === 'BOT_COPYPASTA' ? 'rgba(239, 68, 68, 0.2)' : '#0B111A',
                  border: `1px solid ${activeCommentFilter === 'BOT_COPYPASTA' ? '#EF4444' : '#1E2734'}`,
                  borderRadius: '4px',
                  padding: '8px 10px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#EF4444', fontWeight: 800 }}>
                  🔴 SINDIKAT BOT
                </div>
                <div style={{ fontSize: '16px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#FFFFFF', marginTop: '2px' }}>
                  {dossier.rekapKomentar.botPercent}%
                </div>
                <div style={{ fontSize: '9px', color: '#64748B', marginTop: '2px' }}>
                  {dossier.rekapKomentar.botCount} template copypasta
                </div>
              </button>
            </div>
          </div>

          {/* Temporal Anomaly & Jeda Waktu Detik */}
          <div style={{
            background: '#0B111A',
            border: '1px solid #1E2734',
            borderRadius: '4px',
            padding: '10px 12px',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px'
          }}>
            <div>
              <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                RATA-RATA JEDA WAKTU ANTAR-AKUN:
              </div>
              <div style={{
                fontSize: '15px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                color: dossier.rekapKomentar.averageIntervalSeconds <= 4.0 ? '#EF4444' : '#10B981',
                marginTop: '2px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Clock size={14} />
                <span>{dossier.rekapKomentar.averageIntervalSeconds} Detik / Komentar</span>
              </div>
              <div style={{ fontSize: '9.5px', color: '#94A3B8', marginTop: '2px' }}>
                {dossier.rekapKomentar.averageIntervalSeconds <= 4.0 ? '🚨 Anomali: Terlalu cepat untuk manusia' : 'Normal: Waktu ketik organik'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                BURST VELOCITY (INJEKSI MASIF):
              </div>
              <div style={{
                fontSize: '15px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                color: '#F59E0B',
                marginTop: '2px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Flame size={14} />
                <span>{dossier.rekapKomentar.burstVelocityPerMinute} Komentar / Menit</span>
              </div>
              <div style={{ fontSize: '9.5px', color: '#94A3B8', marginTop: '2px' }}>
                Laju lonjakan arus pembicaraan medsos
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 4. BARIS KEDUA: DECK 3 (KLASTER TEMPLATE COPYPASTA) & DECK 4 (FEED INSPEKSI KOMENTAR) ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
        gap: '20px'
      }}>
        
        {/* ─── DECK 3: KLASTER TEMPLATE COPYPASTA (JACCARD >= 65%) ─── */}
        <div 
          className="steel-chassis-card"
          style={{
            padding: '18px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
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
            borderBottom: '1px solid #1E2734',
            paddingBottom: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bot size={15} color="#EF4444" />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#F1F5F9' }}>
                Klaster Kalimat Template Copypasta Terdeteksi
              </span>
            </div>
            <span style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
              AMBANG JACCARD ≥ 65%
            </span>
          </div>

          <div style={{ fontSize: '11px', color: '#94A3B8' }}>
            {dossier.copypastaClusters.length > 0 
              ? 'Klik pada klaster template di bawah untuk menyorot seluruh komentar akun bot yang menyuarakan kalimat tersebut:'
              : 'Tidak terdeteksi klaster template copypasta masif. Dinamika opini didominasi oleh variasi kalimat organik.'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {dossier.copypastaClusters.length === 0 ? (
              <div style={{
                padding: '16px',
                background: '#0B111A',
                border: '1px solid #1E2734',
                borderRadius: '4px',
                textAlign: 'center',
                color: '#64748B',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)'
              }}>
                🟢 AMAN: Pola percakapan memiliki variasi leksikal alami (Jaccard &lt; 40%).
              </div>
            ) : (
              dossier.copypastaClusters.map((cluster, idx) => {
                const isSelected = selectedClusterPattern === cluster.templateText
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedClusterPattern(null)
                      } else {
                        setSelectedClusterPattern(cluster.templateText)
                        setActiveCommentFilter('ALL')
                      }
                    }}
                    style={{
                      background: isSelected ? 'rgba(239, 68, 68, 0.15)' : '#0B111A',
                      border: `1px solid ${isSelected ? '#EF4444' : '#1E2734'}`,
                      borderRadius: '4px',
                      padding: '10px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '10px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11.5px', color: isSelected ? '#FCA5A5' : '#E2E8F0', fontStyle: 'italic', lineHeight: 1.4 }}>
                        "{cluster.templateText}"
                      </div>
                      <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#64748B', marginTop: '4px' }}>
                        Akun teridentifikasi: {cluster.sampleHandles.slice(0, 3).join(', ')}...
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 800,
                        padding: '2px 7px',
                        borderRadius: '2px',
                        background: 'rgba(239, 68, 68, 0.25)',
                        color: '#EF4444'
                      }}>
                        {cluster.occurrences}x Terulang
                      </span>
                      <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748B', marginTop: '2px' }}>
                        ({cluster.percentageOfTotal}% Total)
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Quick Action Triage Button (Pussiberad Intervention) */}
          <div style={{
            marginTop: 'auto',
            paddingTop: '12px',
            borderTop: '1px solid #1E2734',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
              VONIS OPERATOR LANGSUNG:
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => handleUpdateTriage('HOAKS')}
                style={{
                  background: 'rgba(239, 68, 68, 0.18)',
                  border: '1px solid #DC2626',
                  color: '#F87171',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  padding: '5px 10px',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                Tandai Terbukti Hoaks
              </button>

              <button
                type="button"
                onClick={() => handleUpdateTriage('FAKTA')}
                style={{
                  background: 'rgba(16, 185, 129, 0.18)',
                  border: '1px solid #10B981',
                  color: '#34D399',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  padding: '5px 10px',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                Tandai Fakta Aman
              </button>
            </div>
          </div>
        </div>

        {/* ─── DECK 4: FEED INSPEKSI KOMENTAR INTERAKTIF DENGAN FILTER ─── */}
        <div 
          className="steel-chassis-card"
          style={{
            padding: '18px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <span className="bolt-tl" />
          <span className="bolt-tr" />
          <span className="bolt-bl" />
          <span className="bolt-br" />

          {/* Header Deck 4 & Filter Selector */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #1E2734',
            paddingBottom: '10px',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageSquare size={14} color="#38BDF8" />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#F1F5F9' }}>
                Feed Komentar Lapangan ({filteredComments.length})
              </span>
            </div>

            {/* Tombol Filter Kategori */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={() => {
                  setActiveCommentFilter('ALL')
                  setSelectedClusterPattern(null)
                }}
                style={{
                  fontSize: '9.5px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  padding: '3px 7px',
                  borderRadius: '3px',
                  background: activeCommentFilter === 'ALL' && !selectedClusterPattern ? '#38BDF8' : '#0B1017',
                  color: activeCommentFilter === 'ALL' && !selectedClusterPattern ? '#000000' : '#64748B',
                  border: '1px solid #1E2734',
                  cursor: 'pointer'
                }}
              >
                Semua
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveCommentFilter('BOT_COPYPASTA')
                  setSelectedClusterPattern(null)
                }}
                style={{
                  fontSize: '9.5px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  padding: '3px 7px',
                  borderRadius: '3px',
                  background: activeCommentFilter === 'BOT_COPYPASTA' ? '#EF4444' : '#0B1017',
                  color: activeCommentFilter === 'BOT_COPYPASTA' ? '#FFFFFF' : '#EF4444',
                  border: '1px solid #1E2734',
                  cursor: 'pointer'
                }}
              >
                🔴 Bot ({dossier.rekapKomentar.botCount})
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveCommentFilter('RAWAN_BUZZER')
                  setSelectedClusterPattern(null)
                }}
                style={{
                  fontSize: '9.5px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  padding: '3px 7px',
                  borderRadius: '3px',
                  background: activeCommentFilter === 'RAWAN_BUZZER' ? '#F59E0B' : '#0B1017',
                  color: activeCommentFilter === 'RAWAN_BUZZER' ? '#000000' : '#F59E0B',
                  border: '1px solid #1E2734',
                  cursor: 'pointer'
                }}
              >
                🟡 Rawan ({dossier.rekapKomentar.rawanCount})
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveCommentFilter('ORGANIK')
                  setSelectedClusterPattern(null)
                }}
                style={{
                  fontSize: '9.5px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  padding: '3px 7px',
                  borderRadius: '3px',
                  background: activeCommentFilter === 'ORGANIK' ? '#10B981' : '#0B1017',
                  color: activeCommentFilter === 'ORGANIK' ? '#000000' : '#10B981',
                  border: '1px solid #1E2734',
                  cursor: 'pointer'
                }}
              >
                🟢 Organik ({dossier.rekapKomentar.organikCount})
              </button>
            </div>
          </div>

          {/* List Item Komentar */}
          <div style={{
            maxHeight: '440px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            paddingRight: '4px'
          }}>
            {isHarvesting && filteredComments.length === 0 ? (
              <div style={{
                padding: '30px',
                textAlign: 'center',
                color: '#64748B',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}>
                <RefreshCw size={18} className="spin-animation" color="#38BDF8" />
                <span>SEDANG MEMINDAI DISKUSI DAN KOMENTAR LAPANGAN...</span>
              </div>
            ) : filteredComments.map((c) => {
              const isHighlighted = selectedClusterPattern && c.matchedClusterPattern === selectedClusterPattern
              return (
                <div
                  key={c.id}
                  style={{
                    background: isHighlighted ? 'rgba(239, 68, 68, 0.15)' : c.isCopypasta ? 'rgba(239, 68, 68, 0.06)' : '#0B111A',
                    border: `1px solid ${isHighlighted ? '#EF4444' : c.isCopypasta ? 'rgba(239, 68, 68, 0.3)' : '#1E2734'}`,
                    borderRadius: '4px',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1 }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: c.avatarColor,
                      color: '#FFFFFF',
                      fontSize: '10px',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px'
                    }}>
                      {c.avatarLetter}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F1F5F9' }}>
                          {c.authorHandle}
                        </span>
                        {c.platformOrigin && (
                          <span style={{
                            fontSize: '8.5px',
                            fontFamily: 'var(--font-mono)',
                            color: '#38BDF8',
                            background: 'rgba(56, 189, 248, 0.15)',
                            padding: '1px 4px',
                            borderRadius: '2px'
                          }}>
                            [{c.platformOrigin}]
                          </span>
                        )}
                        <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                          • {c.timestampFormatted}
                        </span>
                      </div>

                      <div style={{ fontSize: '11.5px', color: '#CBD5E1', lineHeight: 1.45, marginTop: '3px' }}>
                        {c.content}
                      </div>
                    </div>
                  </div>

                  {/* Lencana Status Komentar */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                    <span style={{
                      fontSize: '8.5px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 800,
                      padding: '2px 5px',
                      borderRadius: '2px',
                      background: c.triageCategory === 'BOT_COPYPASTA' ? 'rgba(239, 68, 68, 0.25)' : c.triageCategory === 'RAWAN_BUZZER' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(16, 185, 129, 0.25)',
                      color: c.triageCategory === 'BOT_COPYPASTA' ? '#EF4444' : c.triageCategory === 'RAWAN_BUZZER' ? '#F59E0B' : '#10B981'
                    }}>
                      {c.triageCategory === 'BOT_COPYPASTA' ? '🔴 BOT/BUZZER' : c.triageCategory === 'RAWAN_BUZZER' ? '🟡 RAWAN' : '🟢 ORGANIK'}
                    </span>

                    <span style={{
                      fontSize: '8px',
                      fontFamily: 'var(--font-mono)',
                      color: '#64748B'
                    }}>
                      {c.sentiment}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ─── 5. MODAL INTEGRASI DRAF KONTRANARASI DISPENAD & BABINSA ─── */}
      {isCounterModalOpen && counterChannels && (
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <ShieldAlert size={18} color="#EF4444" />
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
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                  Respon cepat menangkal disinformasi: <strong style={{ color: '#E2E8F0' }}>"{dossier.targetClaim}"</strong>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCounterModalOpen(false)}
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
                    handleCopyDraft(textToCopy)
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
              {targetItem?.sourceUrl ? (
                <a
                  href={targetItem.sourceUrl}
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
                onClick={() => setIsCounterModalOpen(false)}
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
    </div>
  )
}
