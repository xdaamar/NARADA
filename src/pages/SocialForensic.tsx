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
  Users,
  Bot,
  Clock,
  FileText,
  Search,
  Database,
  Sparkles,
  Trash2,
  Building,
  MessageSquare
} from 'lucide-react'
import type { DebunkKnowledgeEntry } from '../types'
import {
  synthesizeInvestigationDossier,
  parseRawCommentsText,
  INVESTIGATION_PRESETS,
  type SocialThreatDossier,
  type CommentTriageCategory,
  type InvestigationPreset
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

  // ─── 1. Penentuan Entitas Target Awal dari Radar / Cache ───
  const [targetItem, setTargetItem] = useState<DebunkKnowledgeEntry | null>(() => {
    const state = location.state as { targetItem?: DebunkKnowledgeEntry; item?: DebunkKnowledgeEntry } | undefined
    if (state?.targetItem) return state.targetItem
    if (state?.item) return state.item

    const archives = getCuratedArchiveDebunks()
    const unverified = archives.find(a => a.verdict === 'UNVERIFIED')
    return unverified || archives[0] || null
  })

  // Sinkronisasi dengan IndexedDB jika targetItem belum ada
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

  // ─── 2. State Evidence Ingestion Console (Option B - Controlled Sandbox) ───
  const [activeIngestionTab, setActiveIngestionTab] = useState<'CUSTOM' | 'PRESET' | 'RADAR'>('PRESET')
  const [selectedPresetId, setSelectedPresetId] = useState<string>(INVESTIGATION_PRESETS[0].id)
  const [rawPastedText, setRawPastedText] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [, setEvidenceSourceMeta] = useState<{
    sourceName: string
    sourceKind: 'INPUT_ANALIS' | 'PRESET_TERUJI' | 'RADAR_EARLY_WARNING'
  }>({
    sourceName: INVESTIGATION_PRESETS[0].name,
    sourceKind: 'PRESET_TERUJI'
  })

  // ─── 3. State Dossier Forensik Utama ───
  const [dossier, setDossier] = useState<SocialThreatDossier>(() => {
    const initialPreset = INVESTIGATION_PRESETS[0]
    return synthesizeInvestigationDossier(
      targetItem || { claim: initialPreset.claimTitle, cluster: initialPreset.category },
      initialPreset.rawComments,
      { sourceName: initialPreset.name, sourceKind: 'PRESET_TERUJI' }
    )
  })

  // Handler: Muat Preset Investigasi
  const handleLoadPreset = useCallback((preset: InvestigationPreset) => {
    setIsProcessing(true)
    setSelectedPresetId(preset.id)
    setEvidenceSourceMeta({
      sourceName: preset.name,
      sourceKind: 'PRESET_TERUJI'
    })

    const newTarget = {
      ...(targetItem || {}),
      claim: preset.claimTitle,
      cluster: preset.category
    }
    setTargetItem(newTarget as DebunkKnowledgeEntry)

    setTimeout(() => {
      const res = synthesizeInvestigationDossier(
        newTarget,
        preset.rawComments,
        { sourceName: preset.name, sourceKind: 'PRESET_TERUJI' }
      )
      setDossier(res)
      setIsProcessing(false)
    }, 120)
  }, [targetItem])

  // Handler: Jalankan Analisis Masukan Teks Custom Analis
  const handleRunCustomAnalysis = useCallback(() => {
    if (!rawPastedText.trim()) return
    setIsProcessing(true)

    const parsedComments = parseRawCommentsText(rawPastedText)
    setEvidenceSourceMeta({
      sourceName: `Masukan Analis (${parsedComments.length} komentar)`,
      sourceKind: 'INPUT_ANALIS'
    })

    setTimeout(() => {
      const res = synthesizeInvestigationDossier(
        targetItem || { claim: 'Bukti Masukan Analis Lapangan', cluster: 'POLITIK_NEGARA' },
        parsedComments,
        { sourceName: `Masukan Analis (${parsedComments.length} komentar)`, sourceKind: 'INPUT_ANALIS' }
      )
      setDossier(res)
      setIsProcessing(false)
    }, 140)
  }, [rawPastedText, targetItem])

  // Handler: Bersihkan Teks Masukan
  const handleClearPastedText = () => {
    setRawPastedText('')
  }

  // ─── 4. State Filter & Interaktivitas UI ───
  const [activeCommentFilter, setActiveCommentFilter] = useState<'ALL' | CommentTriageCategory>('ALL')
  const [selectedClusterPattern, setSelectedClusterPattern] = useState<string | null>(null)
  const [statusUpdateMessage, setStatusUpdateMessage] = useState<string | null>(null)

  // ─── 5. State Modal Kontranarasi Dispenad ───
  const [isCounterModalOpen, setIsCounterModalOpen] = useState<boolean>(false)
  const [counterChannels, setCounterChannels] = useState<CounterNarrativeChannels | null>(null)
  const [activeCounterTab, setActiveCounterTab] = useState<'dispenad' | 'babinsa' | 'whatsapp' | 'social'>('dispenad')
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false)

  // Keyboard shortcut: Escape untuk kembali / tutup modal
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
      dossier.targetClaim,
      {
        claim: dossier.targetClaim,
        clarification: targetItem.clarification || 'Klarifikasi resmi sedang diproses oleh satuan intelijen pertahanan.',
        officialSource: targetItem.officialSource || 'Pusat Siber & Dinas Penerangan TNI AD',
        sourceUrl: targetItem.sourceUrl,
        cluster: dossier.cluster
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
    navigate('/analyzer', {
      state: {
        prefill: dossier.targetClaim,
        sourceUrl: targetItem?.originalSourceUrl || targetItem?.sourceUrl
      }
    })
  }

  // Handler Kirim ke Laporan Intelijen A4
  const handleSendToReports = () => {
    navigate('/reports', {
      state: {
        prefillClaim: dossier.targetClaim,
        prefillCluster: dossier.cluster,
        prefillConfidence: dossier.cibCoordinationIndex
      }
    })
  }

  // Handler Update Status Isu Langsung (Triage Taktis)
  const handleUpdateTriage = async (newStatus: 'HOAKS' | 'FAKTA') => {
    if (!targetItem?.id) return
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

  const detectedLineCount = useMemo(() => {
    if (!rawPastedText.trim()) return 0
    return rawPastedText.split(/\r?\n/).filter(l => l.trim().length >= 5).length
  }, [rawPastedText])

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
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38BDF8',
              border: '1px solid rgba(56, 189, 248, 0.45)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Radio size={11} />
              MEJA BEDAH BUKTI SIBER SOSIAL (INVESTIGATION SANDBOX)
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

        {/* Telemetri Sumber Bukti */}
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
            <span style={{ color: '#64748B' }}>SUMBER BUKTI:</span>
            <strong style={{ color: '#D4AF37' }}>{dossier.evidenceSourceName}</strong>
            <span style={{ color: '#2B3846' }}>│</span>
            <span style={{ color: '#64748B' }}>SAMPEL:</span>
            <strong style={{ color: '#38BDF8' }}>{dossier.rekapKomentar.totalScanned} AKUN</strong>
          </div>
        </div>
      </div>

      {/* ─── 2. EVIDENCE INGESTION CONSOLE (BILAH MASUKAN BUKTI TAKTIS) ─── */}
      <div 
        className="steel-chassis-card"
        style={{
          padding: '16px 20px',
          marginBottom: '18px',
          background: '#0B111A',
          border: '1px solid #1E2734',
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
          marginBottom: '12px',
          borderBottom: '1px solid #182230',
          paddingBottom: '10px',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={14} color="#D4AF37" />
            <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#F1F5F9', fontFamily: 'var(--font-mono)', letterSpacing: '0.5px' }}>
              PANEL INGESTI & MANAJEMEN BUKTI DIGITAL (ZERO-FAKE SCRAPING)
            </span>
          </div>

          {/* Mode Selector Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {[
              { id: 'PRESET', label: '🧪 3 Sampel Kasus Audit (Benchmark)', desc: 'Gunakan dataset verifikasi teruji' },
              { id: 'CUSTOM', label: '📋 Masukan Bukti Lapangan (Custom Paste)', desc: 'Tempel komentar dari WhatsApp/Medsos' },
              { id: 'RADAR', label: '📡 Konteks Isu Radar Aktif', desc: 'Analisis dari peringatan dini' }
            ].map(tab => {
              const isSelected = activeIngestionTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveIngestionTab(tab.id as any)}
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    padding: '5px 10px',
                    borderRadius: '3px',
                    border: '1px solid',
                    borderColor: isSelected ? '#D4AF37' : '#1E2734',
                    background: isSelected ? 'rgba(212, 175, 55, 0.15)' : '#070B11',
                    color: isSelected ? '#FDE047' : '#64748B',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title={tab.desc}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab 1: 3 Preset Kasus Teruji */}
        {activeIngestionTab === 'PRESET' && (
          <div>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '10px' }}>
              Pilih salah satu kasus nyata terverifikasi di bawah ini untuk menguji algoritma Jaccard Copypasta Matrix, Burst Velocity, dan Indeks CIB secara instan:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '10px' }}>
              {INVESTIGATION_PRESETS.map((preset) => {
                const isSelected = selectedPresetId === preset.id
                return (
                  <div
                    key={preset.id}
                    onClick={() => handleLoadPreset(preset)}
                    style={{
                      background: isSelected ? 'rgba(212, 175, 55, 0.08)' : '#070B11',
                      border: `1px solid ${isSelected ? '#D4AF37' : '#1E2734'}`,
                      borderRadius: '4px',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 800,
                        color: preset.expectedCib === 'TINGGI' ? '#EF4444' : preset.expectedCib === 'SEDANG' ? '#F59E0B' : '#10B981'
                      }}>
                        {preset.shortLabel}
                      </span>
                      <span style={{
                        fontSize: '9px',
                        fontFamily: 'var(--font-mono)',
                        padding: '1px 6px',
                        borderRadius: '2px',
                        background: '#121A24',
                        color: '#94A3B8',
                        border: '1px solid #1E2734'
                      }}>
                        {preset.rawComments.length} Akun Sampel
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#F8FAFC', marginBottom: '4px', lineHeight: 1.35 }}>
                      {preset.claimTitle}
                    </div>

                    <div style={{ fontSize: '10.5px', color: '#64748B', lineHeight: 1.4 }}>
                      {preset.description}
                    </div>

                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        style={{
                          background: isSelected ? '#D4AF37' : '#162232',
                          color: isSelected ? '#000000' : '#CBD5E1',
                          border: 'none',
                          padding: '3px 8px',
                          borderRadius: '3px',
                          fontSize: '9.5px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {isSelected ? '✓ KASUS AKTIF DI MEJA BEDAH' : 'MUAT KASUS INI'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Custom Text Ingestion */}
        {activeIngestionTab === 'CUSTOM' && (
          <div>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '8px' }}>
              Tempelkan rentetan teks komentar warganet dari tangkapan layar WhatsApp, TikTok, X, atau Facebook. Format: <code style={{ color: '#38BDF8' }}>@handle: komentar</code> atau satu komentar per baris.
            </div>

            <textarea
              value={rawPastedText}
              onChange={(e) => setRawPastedText(e.target.value)}
              placeholder={`Contoh:\n@user_01: Info pendaftaran bintara tni ad jalur khusus chat wa di bio kuota terbatas!\n@user_02: Info pendaftaran bintara tni ad jalur khusus chat wa di bio kuota terbatas!\n@user_03: Hati-hati penipuan pendaftaran resmi hanya lewat ad.rekrutmen-tni.mil.id`}
              rows={4}
              style={{
                width: '100%',
                background: '#070B11',
                border: '1px solid #28374D',
                borderRadius: '4px',
                padding: '10px 12px',
                color: '#E2E8F0',
                fontSize: '11.5px',
                fontFamily: 'var(--font-mono)',
                lineHeight: 1.5,
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                STATUS: <strong style={{ color: detectedLineCount > 0 ? '#10B981' : '#64748B' }}>{detectedLineCount} Baris Komentar Terdeteksi</strong>
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {rawPastedText && (
                  <button
                    type="button"
                    onClick={handleClearPastedText}
                    style={{
                      background: 'transparent',
                      border: '1px solid #334155',
                      color: '#94A3B8',
                      padding: '5px 10px',
                      borderRadius: '3px',
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Trash2 size={11} />
                    <span>Bersihkan</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleRunCustomAnalysis}
                  disabled={detectedLineCount === 0 || isProcessing}
                  style={{
                    background: detectedLineCount > 0 ? '#D4AF37' : '#1A2330',
                    color: detectedLineCount > 0 ? '#000000' : '#64748B',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800,
                    cursor: detectedLineCount > 0 ? 'pointer' : 'not-allowed',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Sparkles size={12} />
                  <span>{isProcessing ? 'MEMPROSES JACCARD...' : 'JALANKAN ANALISIS FORENSIK BUKTI'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Konteks Isu Radar */}
        {activeIngestionTab === 'RADAR' && (
          <div style={{ background: '#070B11', padding: '12px', borderRadius: '4px', border: '1px solid #1A2330' }}>
            <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: '#38BDF8', fontWeight: 700, marginBottom: '4px' }}>
              ISU DARI RADAR BERITA VIRAL:
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF', marginBottom: '6px' }}>
              "{targetItem?.claim || dossier.targetClaim}"
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8', lineHeight: 1.5 }}>
              Kategori: <strong style={{ color: dossier.clusterColor }}>{dossier.clusterLabel}</strong> •
              Rujukan Resmi: <strong style={{ color: '#10B981' }}>{targetItem?.officialSource || 'TurnBackHoax & Portal Pers Kredibel'}</strong> •
              Status Awal: <strong style={{ color: '#FBBF24' }}>{targetItem?.triageStatus || 'SEDANG DIPANTAU'}</strong>
            </div>
          </div>
        )}
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

      {/* ─── 3. DOSSIER HERO BANNER & COMMAND CONTROLS ─── */}
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
              BERKAS INTELIJEN SIBER SOSIAL (INVESTIGATION DOSSIER)
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
              <span>Konteks Bukti: <strong style={{ color: '#CBD5E1' }}>{dossier.evidenceSourceName}</strong></span>
              <span>•</span>
              <span>Rujukan Verifikasi: <strong style={{ color: '#10B981' }}>{targetItem?.officialSource || 'TurnBackHoax & Pangkalan Cek Fakta'}</strong></span>
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
              title="Bawa teks klaim ini ke Multi-Input Analyzer untuk pengujian NLP & leksikon hoaks"
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
              title="Kirim temuan forensik ini ke Laporan Intelijen A4"
            >
              <FileText size={13} />
              <span>Ekspor Berkas A4</span>
            </button>

            {targetItem?.id && (
              <div style={{ display: 'inline-flex', gap: '4px', borderLeft: '1px solid #2B384E', paddingLeft: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleUpdateTriage('HOAKS')}
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #EF4444',
                    color: '#F87171',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    padding: '8px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  title="Tetapkan vonis HOAKS untuk isu ini di Radar"
                >
                  VONIS HOAKS
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateTriage('FAKTA')}
                  style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid #10B981',
                    color: '#34D399',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    padding: '8px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  title="Tetapkan vonis FAKTA / NETRAL untuk isu ini di Radar"
                >
                  VONIS FAKTA
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Alarm Banner & Anomali Koordinasi CIB */}
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

      {/* ─── 4. BARIS UTAMA: DECK 1 (PROFIL BUKTI & OSINT DORKS) & DECK 2 (REKAP STATUS KOMENTAR) ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
        gap: '20px',
        marginBottom: '20px'
      }}>
        
        {/* ─── DECK 1: PROFIL BUKTI & VERIFIKASI OSINT RESMI (REPLACES BROKEN VIDEO PLAYER) ─── */}
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
                PROFIL BUKTI DIGITAL
              </span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#F1F5F9' }}>
                Validasi OSINT & Parameter Lapangan
              </span>
            </div>

            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              padding: '2px 6px',
              borderRadius: '2px',
              background: '#10B98115',
              color: '#10B981',
              border: '1px solid #10B98135',
              fontWeight: 700
            }}>
              ✓ 100% DATA TERVERIFIKASI
            </span>
          </div>

          {/* Evidence Meta Card */}
          <div style={{
            background: '#0B1017',
            border: '1px solid #1E2734',
            borderRadius: '6px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>SUMBER BUKTI:</span>
              <strong style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#F8FAFC' }}>
                {dossier.evidenceSourceName}
              </strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>ENTITAS KUNCI (NER):</span>
              <strong style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#38BDF8' }}>
                "{dossier.focusedKeywords}"
              </strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>JUMLAH AKUN DIUJI:</span>
              <strong style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#10B981' }}>
                {dossier.rekapKomentar.totalScanned} Akun Warganet
              </strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>STATUS INTEGRITAS DATA:</span>
              <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#34D399', fontWeight: 700 }}>
                Bebas Rekayasa & Scraper Rapuh
              </span>
            </div>
          </div>

          {/* Curated OSINT Verification Dorks Strip */}
          <div>
            <div style={{
              fontSize: '10.5px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              color: '#D4AF37',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Search size={12} />
              <span>TAUTAN VALIDASI OSINT BER-FILTER WAKTU KETAT:</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              <a
                href={dossier.osintLinks.googleNewsRecent}
                target="_blank"
                rel="noreferrer"
                style={{
                  background: '#070B11',
                  border: '1px solid #1E2734',
                  borderRadius: '4px',
                  padding: '8px 10px',
                  color: '#38BDF8',
                  textDecoration: 'none',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#38BDF8'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#1E2734'}
                title="Cek liputan pers Google News 2 hari terakhir"
              >
                <span>Google News (when:2d) 📰</span>
                <ExternalLink size={10} />
              </a>

              <a
                href={dossier.osintLinks.googleTimeboundDay}
                target="_blank"
                rel="noreferrer"
                style={{
                  background: '#070B11',
                  border: '1px solid #1E2734',
                  borderRadius: '4px',
                  padding: '8px 10px',
                  color: '#34D399',
                  textDecoration: 'none',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#34D399'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#1E2734'}
                title="Cek pencarian web 24 jam terakhir"
              >
                <span>Web Search 24 Jam (&tbs=qdr:d) 🔍</span>
                <ExternalLink size={10} />
              </a>

              <a
                href={dossier.osintLinks.turnbackhoaxSearch}
                target="_blank"
                rel="noreferrer"
                style={{
                  background: '#070B11',
                  border: '1px solid #1E2734',
                  borderRadius: '4px',
                  padding: '8px 10px',
                  color: '#FBBF24',
                  textDecoration: 'none',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#FBBF24'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#1E2734'}
                title="Cari klarifikasi di pangkalan data TurnBackHoax"
              >
                <span>Arsip TurnBackHoax.id 🛡️</span>
                <ExternalLink size={10} />
              </a>

              <a
                href={dossier.osintLinks.dispenadSearch}
                target="_blank"
                rel="noreferrer"
                style={{
                  background: '#070B11',
                  border: '1px solid #1E2734',
                  borderRadius: '4px',
                  padding: '8px 10px',
                  color: '#EF4444',
                  textDecoration: 'none',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#EF4444'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#1E2734'}
                title="Cari pernyataan resmi di situs TNI AD"
              >
                <span>Rilis Resmi TNI AD (tniad.mil.id) 🇮🇩</span>
                <ExternalLink size={10} />
              </a>
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
                {dossier.rekapKomentar.averageIntervalSeconds <= 4.0 ? '🚨 Anomali: Injeksi cepat non-manusia' : 'Normal: Waktu ketik organik wajar'}
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

      {/* ─── 5. BARIS KEDUA: DECK 3 (KLASTER TEMPLATE COPYPASTA) & DECK 4 (FEED INSPEKSI KOMENTAR) ─── */}
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
              ? 'Klik pada klaster template di bawah untuk menyorot seluruh akun bot yang menyuarakan kalimat tersebut:'
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
                      background: isSelected ? 'rgba(239, 68, 68, 0.2)' : '#070B11',
                      border: `1px solid ${isSelected ? '#EF4444' : '#1E2734'}`,
                      borderRadius: '4px',
                      padding: '10px 12px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{
                        fontSize: '9px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 800,
                        color: '#EF4444'
                      }}>
                        🔴 KLASTER TEMPLATE #{idx + 1}
                      </span>
                      <span style={{
                        fontSize: '9px',
                        fontFamily: 'var(--font-mono)',
                        color: '#F87171',
                        background: 'rgba(239, 68, 68, 0.15)',
                        padding: '1px 6px',
                        borderRadius: '2px'
                      }}>
                        {cluster.occurrences} Akun Menyuarakan ({cluster.percentageOfTotal}%)
                      </span>
                    </div>

                    <div style={{ fontSize: '11.5px', color: '#F1F5F9', fontStyle: 'italic', marginBottom: '6px', lineHeight: 1.4 }}>
                      "{cluster.templateText}"
                    </div>

                    <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                      Sampel Akun: {cluster.sampleHandles.slice(0, 4).join(', ')}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ─── DECK 4: FEED INSPEKSI BUKTI KOMENTAR ─── */}
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
            paddingBottom: '10px',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={15} color="#38BDF8" />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#F1F5F9' }}>
                Feed Bukti Komentar Terekstraksi ({filteredComments.length})
              </span>
            </div>

            {selectedClusterPattern && (
              <button
                type="button"
                onClick={() => setSelectedClusterPattern(null)}
                style={{
                  fontSize: '9px',
                  fontFamily: 'var(--font-mono)',
                  color: '#EF4444',
                  background: 'transparent',
                  border: '1px solid #EF4444',
                  padding: '2px 6px',
                  borderRadius: '2px',
                  cursor: 'pointer'
                }}
              >
                ✕ Hapus Filter Klaster
              </button>
            )}
          </div>

          {/* List Komentar */}
          <div style={{
            maxHeight: '480px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            paddingRight: '4px'
          }}>
            {filteredComments.map((c) => (
              <div
                key={c.id}
                style={{
                  background: c.isCopypasta ? 'rgba(239, 68, 68, 0.08)' : '#070B11',
                  border: `1px solid ${c.isCopypasta ? 'rgba(239, 68, 68, 0.4)' : '#1E2734'}`,
                  borderRadius: '4px',
                  padding: '10px 12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: c.avatarColor,
                      color: '#FFFFFF',
                      fontSize: '10px',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {c.avatarLetter}
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#F1F5F9' }}>
                      {c.authorName}
                    </span>
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                      {c.authorHandle}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{
                      fontSize: '8.5px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 800,
                      padding: '1px 5px',
                      borderRadius: '2px',
                      background: c.triageCategory === 'BOT_COPYPASTA' ? '#EF444425' : c.triageCategory === 'RAWAN_BUZZER' ? '#F59E0B25' : '#10B98125',
                      color: c.triageCategory === 'BOT_COPYPASTA' ? '#F87171' : c.triageCategory === 'RAWAN_BUZZER' ? '#FBBF24' : '#34D399',
                      border: `1px solid ${c.triageCategory === 'BOT_COPYPASTA' ? '#EF444450' : c.triageCategory === 'RAWAN_BUZZER' ? '#F59E0B50' : '#10B98150'}`
                    }}>
                      {c.triageCategory}
                    </span>
                    <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#475569' }}>
                      {c.timestampFormatted}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: '11.5px', color: '#E2E8F0', lineHeight: 1.45, marginTop: '4px' }}>
                  {c.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── 6. MODAL DRAF KONTRANARASI DISPENAD (4 SALURAN) ─── */}
      {isCounterModalOpen && counterChannels && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 8, 14, 0.85)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div 
            className="steel-chassis-card"
            style={{
              maxWidth: '860px',
              width: '100%',
              background: '#0B111A',
              border: '1px solid #DC2626',
              borderRadius: '8px',
              padding: '24px',
              position: 'relative',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
            }}
          >
            <span className="bolt-tl" />
            <span className="bolt-tr" />
            <span className="bolt-bl" />
            <span className="bolt-br" />

            {/* Header Modal */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #1E2734',
              paddingBottom: '12px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={18} color="#EF4444" />
                <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#F1F5F9' }}>
                  GENERATOR KONTRANARASI DISPENAD (4 PROTOKOL SALURAN)
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsCounterModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748B',
                  fontSize: '14px',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Tab Selector 4 Protokol */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
              {[
                { key: 'dispenad', label: '1. Siaran Pers Resmi', icon: Building, color: '#EF4444' },
                { key: 'babinsa', label: '2. Komsos Babinsa', icon: Users, color: '#10B981' },
                { key: 'whatsapp', label: '3. Edukasi Warga WA', icon: MessageSquare, color: '#22C55E' },
                { key: 'social', label: '4. Post Taktis Medsos', icon: Zap, color: '#38BDF8' }
              ].map(tab => {
                const isSelected = activeCounterTab === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveCounterTab(tab.key as any)}
                    style={{
                      fontSize: '10.5px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      padding: '6px 12px',
                      borderRadius: '4px',
                      border: '1px solid',
                      borderColor: isSelected ? tab.color : '#1E2734',
                      background: isSelected ? `${tab.color}20` : '#070B11',
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

            {/* Naskah Display */}
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
                  FORMAT PROTOKOL: {activeCounterTab.toUpperCase()}
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

            {/* Modal Footer */}
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
