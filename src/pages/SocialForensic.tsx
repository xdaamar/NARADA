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
  MessageSquare,
  Lock,
  AlertTriangle,
  History
} from 'lucide-react'
import type { DebunkKnowledgeEntry } from '../types'
import {
  synthesizeInvestigationDossier,
  parseRawCommentsText,
  SYNTHETIC_BENCHMARKS,
  recordClaimAssessment,
  getClaimAssessments,
  type SocialThreatDossier,
  type PatternCategory,
  type SyntheticBenchmarkPreset,
  type ClaimAssessmentStatus,
  type ClaimAssessmentRecord
} from '../engine/social-threat-dossier'
import {
  generateCounterNarratives,
  type CounterNarrativeChannels
} from '../engine/forensic/counter-narrative-generator'
import { getCuratedArchiveDebunks } from '../engine/data/debunk-service'
import { getCachedRadarItems } from '../utils/db-adapter'

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

  // ─── 2. State Evidence Ingestion Console (Sprint 1D - Package A, C, D) ───
  const [activeIngestionTab, setActiveIngestionTab] = useState<'PRESET' | 'CUSTOM' | 'RADAR'>('PRESET')
  const [selectedPresetId, setSelectedPresetId] = useState<string>(SYNTHETIC_BENCHMARKS[0].id)
  const [rawPastedText, setRawPastedText] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState<boolean>(false)

  // ─── 3. State Dossier Forensik Utama ───
  const [dossier, setDossier] = useState<SocialThreatDossier>(() => {
    const initialPreset = SYNTHETIC_BENCHMARKS[0]
    return synthesizeInvestigationDossier(
      targetItem || { claim: initialPreset.claimTitle, cluster: initialPreset.category },
      initialPreset.syntheticRecords,
      {
        sourceName: initialPreset.name,
        sourceKind: 'SYNTHETIC_BENCHMARK',
        isSimulation: true,
        watermark: initialPreset.simulationWatermark
      }
    )
  })

  // ─── 4. State Claim Assessment Panel (Package E - Semantic Separation) ───
  const [isClaimReviewOpen, setIsClaimReviewOpen] = useState<boolean>(false)
  const [selectedVerdict, setSelectedVerdict] = useState<ClaimAssessmentStatus>('UNVERIFIED')
  const [assessmentRationale, setAssessmentRationale] = useState<string>('')
  const [assessmentSuccessMsg, setAssessmentSuccessMsg] = useState<string | null>(null)
  const [claimHistory, setClaimHistory] = useState<ClaimAssessmentRecord[]>([])

  // Refresh riwayat assessment klaim saat dossier berubah
  useEffect(() => {
    if (dossier.claimId) {
      setClaimHistory(getClaimAssessments(dossier.claimId))
    }
  }, [dossier.claimId])

  // Handler: Muat Preset Benchmark Sintetis (Package A - Simulation Firewall)
  const handleLoadPreset = useCallback((preset: SyntheticBenchmarkPreset) => {
    setIsProcessing(true)
    setSelectedPresetId(preset.id)

    const newTarget = {
      ...(targetItem || {}),
      claim: preset.claimTitle,
      cluster: preset.category
    }
    setTargetItem(newTarget as DebunkKnowledgeEntry)

    setTimeout(() => {
      const res = synthesizeInvestigationDossier(
        newTarget,
        preset.syntheticRecords,
        {
          sourceName: preset.name,
          sourceKind: 'SYNTHETIC_BENCHMARK',
          isSimulation: true,
          watermark: preset.simulationWatermark
        }
      )
      setDossier(res)
      setIsProcessing(false)
    }, 100)
  }, [targetItem])

  // Handler: Jalankan Analisis Masukan Teks Operator (Package C & D)
  const handleRunCustomAnalysis = useCallback(() => {
    if (!rawPastedText.trim()) return
    setIsProcessing(true)

    const parsedRecords = parseRawCommentsText(rawPastedText)

    setTimeout(() => {
      const res = synthesizeInvestigationDossier(
        targetItem || { claim: 'Bukti Masukan Operator Lapangan', cluster: 'POLITIK_NEGARA' },
        parsedRecords,
        {
          sourceName: `Masukan Operator (${parsedRecords.length} record)`,
          sourceKind: 'USER_SUBMITTED',
          isSimulation: false
        }
      )
      setDossier(res)
      setIsProcessing(false)
    }, 120)
  }, [rawPastedText, targetItem])

  // Handler: Bersihkan Teks Masukan
  const handleClearPastedText = () => {
    setRawPastedText('')
  }

  // Handler: Simpan Penilaian Klaim Spesifik (Package E)
  const handleSaveClaimAssessment = () => {
    if (!dossier.claimId) return

    const record: ClaimAssessmentRecord = {
      assessmentId: `ASM-${Date.now()}`,
      claimId: dossier.claimId,
      claimText: dossier.targetClaim,
      verdict: selectedVerdict,
      rationale: assessmentRationale.trim() || 'Penilaian berdasarkan analisis pola kemiripan leksikal dan bukti rujukan.',
      supportingEvidenceIds: dossier.commentsStream.slice(0, 3).map(c => c.pseudonymId),
      assessedBy: 'Operator Analis Lokal',
      assessedAt: new Date().toISOString()
    }

    recordClaimAssessment(record)
    setClaimHistory(getClaimAssessments(dossier.claimId))
    setAssessmentSuccessMsg(`Penilaian klaim "${selectedVerdict}" berhasil dicatat dalam audit trail.`)
    setTimeout(() => setAssessmentSuccessMsg(null), 3500)
    setAssessmentRationale('')
  }

  // ─── 5. State Filter & Interaktivitas UI ───
  const [activePatternFilter, setActivePatternFilter] = useState<'ALL' | PatternCategory>('ALL')
  const [selectedClusterPattern, setSelectedClusterPattern] = useState<string | null>(null)

  // ─── 6. State Modal Kontranarasi Dispenad (Package I) ───
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
        } else if (isClaimReviewOpen) {
          setIsClaimReviewOpen(false)
        } else {
          navigate('/radar')
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isCounterModalOpen, isClaimReviewOpen, navigate])

  // Handler Buka Modal Kontranarasi
  const handleOpenCounterModal = () => {
    const drafts = generateCounterNarratives(
      dossier.targetClaim,
      {
        claim: dossier.targetClaim,
        clarification: targetItem?.clarification || 'Klarifikasi faktual dalam peninjauan resmi satuan penerangan pertahanan.',
        officialSource: targetItem?.officialSource || 'Pusat Siber & Dinas Penerangan TNI AD',
        sourceUrl: targetItem?.sourceUrl,
        cluster: dossier.cluster
      },
      targetItem?.originalPlatform || 'MEDIA SOSIAL'
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
        prefillConfidence: dossier.ncsIndex,
        isSimulation: dossier.isSimulation,
        simulationWatermark: dossier.simulationWatermark,
        evidenceMode: dossier.evidenceMode
      }
    })
  }

  // Filter Aliran Komentar
  const filteredComments = useMemo(() => {
    let list = dossier.commentsStream

    if (activePatternFilter !== 'ALL') {
      list = list.filter(c => c.patternCategory === activePatternFilter)
    }

    if (selectedClusterPattern) {
      list = list.filter(c => c.matchedClusterPattern === selectedClusterPattern)
    }

    return list
  }, [dossier.commentsStream, activePatternFilter, selectedClusterPattern])

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

      {/* ─── PACKAGE A: SIMULATION FIREWALL WATERMARK BANNER ─── */}
      {dossier.isSimulation && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid #DC2626',
          borderRadius: '4px',
          padding: '8px 14px',
          marginBottom: '14px',
          color: '#FCA5A5',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={15} color="#EF4444" />
            <span>{dossier.simulationWatermark}</span>
          </div>
          <span style={{
            fontSize: '9.5px',
            background: 'rgba(220, 38, 38, 0.25)',
            border: '1px solid rgba(220, 38, 38, 0.5)',
            padding: '2px 8px',
            borderRadius: '2px',
            letterSpacing: '0.5px'
          }}>
            TERISOLASI DARI RADAR LIVE & PERSISTENSI
          </span>
        </div>
      )}

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

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
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
              MEJA BEDAH BUKTI SIBER SOSIAL (INVESTIGATION WORKBENCH)
            </span>

            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '3px',
              background: dossier.evidenceMode === 'SYNTHETIC_BENCHMARK'
                ? 'rgba(239, 68, 68, 0.2)'
                : dossier.evidenceMode === 'USER_SUBMITTED'
                ? 'rgba(245, 158, 11, 0.2)'
                : 'rgba(16, 185, 129, 0.2)',
              color: dossier.evidenceMode === 'SYNTHETIC_BENCHMARK'
                ? '#F87171'
                : dossier.evidenceMode === 'USER_SUBMITTED'
                ? '#FBBF24'
                : '#34D399',
              border: `1px solid ${
                dossier.evidenceMode === 'SYNTHETIC_BENCHMARK'
                  ? 'rgba(239, 68, 68, 0.4)'
                  : dossier.evidenceMode === 'USER_SUBMITTED'
                  ? 'rgba(245, 158, 11, 0.4)'
                  : 'rgba(16, 185, 129, 0.4)'
              }`
            }}>
              MODE: {dossier.evidenceMode}
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
            <strong style={{ color: dossier.isSimulation ? '#F87171' : '#D4AF37' }}>
              {dossier.evidenceSourceName}
            </strong>
            <span style={{ color: '#2B3846' }}>│</span>
            <span style={{ color: '#64748B' }}>SAMPEL RECORD:</span>
            <strong style={{ color: '#38BDF8' }}>{dossier.rekapPolaTeks.totalScanned}</strong>
          </div>
        </div>
      </div>

      {/* ─── 2. EVIDENCE INGESTION CONSOLE (PACKAGE A, C, D) ─── */}
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
              PANEL INGESTI BUKTI DIGITAL & BENCHMARK SINTETIS
            </span>
          </div>

          {/* Mode Selector Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {[
              { id: 'PRESET', label: '🧪 Benchmark Sintetis (Simulasi)', desc: 'Fixture sintetis terisolasi' },
              { id: 'CUSTOM', label: '📋 Masukan Bukti Operator', desc: 'Input teks dengan provenance jujur' },
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

        {/* Tab 1: 3 Benchmark Sintetis */}
        {activeIngestionTab === 'PRESET' && (
          <div>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '10px' }}>
              Pilih salah satu dataset sintetis di bawah ini untuk menguji algoritma Jaccard dan indikator pola koordinasi tanpa mencemari data lapangan:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '10px' }}>
              {SYNTHETIC_BENCHMARKS.map((preset) => {
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
                        fontSize: '9.5px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 800,
                        color: '#EF4444'
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
                        {preset.syntheticRecords.length} Record Sintetis
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
                        {isSelected ? '✓ BENCHMARK AKTIF DI MEJA BEDAH' : 'MUAT BENCHMARK INI'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Custom Text Ingestion (Package D - Privacy Notice) */}
        {activeIngestionTab === 'CUSTOM' && (
          <div>
            {/* Pre-ingestion Privacy & Authorization Notice */}
            <div style={{
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '4px',
              padding: '8px 12px',
              marginBottom: '10px',
              fontSize: '10.5px',
              color: '#93C5FD',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              lineHeight: 1.45
            }}>
              <Lock size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <strong>PEMBERITAHUAN PRIVASI & LEGALITAS OPERATOR:</strong> Pastikan bukti yang dimasukkan diperoleh secara sah dan memiliki izin/dasar kewenangan pemrosesan. Dilarang mengunggah rekaman percakapan privat tanpa otorisasi. Data identitas pengguna (handle/nama) akan diminimalisasi dan diproses secara lokal.
              </div>
            </div>

            <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '8px' }}>
              Format masukan teks bebas: <code style={{ color: '#38BDF8' }}>@handle: komentar</code> atau satu komentar per baris. Jika tersedia timestamp, awali dengan format ISO: <code style={{ color: '#34D399' }}>[2026-10-30T10:15:00Z] komentar</code>.
            </div>

            <textarea
              value={rawPastedText}
              onChange={(e) => setRawPastedText(e.target.value)}
              placeholder={`Contoh:\n[2026-10-30T10:00:00Z] @user_01: Info pendaftaran bintara tni ad jalur khusus chat wa kuota terbatas!\n[2026-10-30T10:00:03Z] @user_02: Info pendaftaran bintara tni ad jalur khusus chat wa kuota terbatas!\n@user_03: Hati-hati penipuan pendaftaran resmi hanya lewat ad.rekrutmen-tni.mil.id`}
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
                STATUS: <strong style={{ color: detectedLineCount > 0 ? '#10B981' : '#64748B' }}>{detectedLineCount} Baris Record Terdeteksi</strong>
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
                  <span>{isProcessing ? 'MEMPROSES...' : 'JALANKAN ANALISIS POLA TEKS'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Konteks Isu Radar */}
        {activeIngestionTab === 'RADAR' && (
          <div style={{ background: '#070B11', padding: '12px', borderRadius: '4px', border: '1px solid #1A2330' }}>
            <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: '#38BDF8', fontWeight: 700, marginBottom: '4px' }}>
              ISU DARI RADAR BERITA:
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF', marginBottom: '6px' }}>
              "{targetItem?.claim || dossier.targetClaim}"
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8', lineHeight: 1.5 }}>
              Kategori: <strong style={{ color: dossier.clusterColor }}>{dossier.clusterLabel}</strong> •
              Rujukan Cek Fakta: <strong style={{ color: '#10B981' }}>{targetItem?.officialSource || 'TurnBackHoax & Portal Pers'}</strong> •
              Status Radar: <strong style={{ color: '#FBBF24' }}>{targetItem?.triageStatus || 'SEDANG DIPANTAU'}</strong>
            </div>
          </div>
        )}
      </div>

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
              BERKAS ANALISIS POLA SIBER SOSIAL (INVESTIGATION DOSSIER)
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
              <span>Sumber Bukti: <strong style={{ color: '#CBD5E1' }}>{dossier.evidenceSourceName}</strong></span>
              <span>•</span>
              <span>Rujukan Verifikasi: <strong style={{ color: '#10B981' }}>{targetItem?.officialSource || 'TurnBackHoax & Arsip Resmi'}</strong></span>
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
              title="Bawa teks klaim ini ke Multi-Input Analyzer untuk pengujian NLP & leksikon hoaks"
            >
              <Zap size={13} />
              <span>Uji di Analyzer</span>
            </button>

            <button
              type="button"
              onClick={() => setIsClaimReviewOpen(prev => !prev)}
              style={{
                background: isClaimReviewOpen ? 'rgba(56, 189, 248, 0.25)' : 'rgba(56, 189, 248, 0.15)',
                border: '1px solid #38BDF8',
                color: '#38BDF8',
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
              title="Buka panel penilaian status klaim spesifik berbasis bukti"
            >
              <CheckCircle2 size={13} />
              <span>Penilaian Klaim Spesifik</span>
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
          </div>
        </div>

        {/* ─── PACKAGE E: CLAIM ASSESSMENT PANEL (EXPANDABLE) ─── */}
        {isClaimReviewOpen && (
          <div style={{
            background: '#070B11',
            border: '1px solid #1E2734',
            borderRadius: '6px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#38BDF8' }}>
                FORMULIR PENILAIAN KLAIM SPESIFIK (CLAIM-LEVEL REVIEW)
              </div>
              <span style={{ fontSize: '10px', color: '#64748B' }}>
                Penilaian melekat pada KLAIM, bukan pada publikasi atau event global
              </span>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '10.5px', color: '#94A3B8', marginBottom: '4px' }}>Klaim yang Dievaluasi:</div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#FFFFFF', padding: '6px 10px', background: '#0F1622', borderRadius: '4px' }}>
                "{dossier.targetClaim}"
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              {(['CONTRADICTED', 'SUPPORTED', 'MIXED', 'UNVERIFIED', 'INCONCLUSIVE'] as ClaimAssessmentStatus[]).map(verdict => {
                const isSel = selectedVerdict === verdict
                const color = verdict === 'CONTRADICTED' ? '#EF4444' : verdict === 'SUPPORTED' ? '#10B981' : verdict === 'MIXED' ? '#F59E0B' : '#94A3B8'
                return (
                  <button
                    key={verdict}
                    type="button"
                    onClick={() => setSelectedVerdict(verdict)}
                    style={{
                      background: isSel ? `${color}25` : '#0B1017',
                      border: `1px solid ${isSel ? color : '#1E2734'}`,
                      color: isSel ? color : '#64748B',
                      fontSize: '10.5px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 800,
                      padding: '5px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    {verdict}
                  </button>
                )
              })}
            </div>

            <textarea
              value={assessmentRationale}
              onChange={(e) => setAssessmentRationale(e.target.value)}
              placeholder="Tuliskan alasan pertimbangan penilaian dan rujukan bukti pendukung..."
              rows={2}
              style={{
                width: '100%',
                background: '#0B1017',
                border: '1px solid #28374D',
                borderRadius: '4px',
                padding: '8px 10px',
                color: '#E2E8F0',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                marginBottom: '10px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '10px', color: '#64748B' }}>
                Bukti pendukung otomatis ditautkan dari record yang diekstrak
              </span>
              <button
                type="button"
                onClick={handleSaveClaimAssessment}
                style={{
                  background: '#10B981',
                  color: '#000000',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Simpan Penilaian Klaim
              </button>
            </div>

            {/* Riwayat Penilaian Klaim */}
            {claimHistory.length > 0 && (
              <div style={{ marginTop: '14px', borderTop: '1px solid #1E2734', paddingTop: '10px' }}>
                <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: '#D4AF37', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <History size={12} />
                  <span>RIWAYAT AUDIT PENILAIAN KLAIM INI:</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {claimHistory.map(item => (
                    <div key={item.assessmentId} style={{ background: '#0B1017', padding: '6px 10px', borderRadius: '4px', border: '1px solid #16202C', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                      <span style={{ color: item.verdict === 'CONTRADICTED' ? '#EF4444' : item.verdict === 'SUPPORTED' ? '#10B981' : '#F59E0B', fontWeight: 800 }}>
                        [{item.verdict}]
                      </span>{' '}
                      <span style={{ color: '#CBD5E1' }}>{item.rationale}</span>{' '}
                      <span style={{ color: '#475569' }}>— {new Date(item.assessedAt).toLocaleTimeString('id-ID')} ({item.assessedBy})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notifikasi Sukses Penilaian */}
        {assessmentSuccessMsg && (
          <div style={{
            marginBottom: '10px',
            padding: '6px 12px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid #10B981',
            borderRadius: '4px',
            color: '#34D399',
            fontSize: '10.5px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700
          }}>
            ✓ {assessmentSuccessMsg}
          </div>
        )}

        {/* Alarm Banner & Indikator Koordinasi Narasi (NCS) */}
        <div style={{
          background: dossier.isPatternAnomalyFlagged ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
          border: `1px solid ${dossier.isPatternAnomalyFlagged ? 'rgba(239, 68, 68, 0.45)' : 'rgba(16, 185, 129, 0.45)'}`,
          borderRadius: '4px',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={16} color={dossier.isPatternAnomalyFlagged ? '#EF4444' : '#10B981'} />
            <span style={{ fontSize: '11px', color: '#F1F5F9', fontWeight: 600 }}>
              {dossier.patternSummary}
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
              SINYAL KOORDINASI NARASI (NCS): <strong style={{ color: dossier.isPatternAnomalyFlagged ? '#EF4444' : '#10B981' }}>{dossier.ncsIndex}/100</strong>
            </span>
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '3px',
              background: dossier.isPatternAnomalyFlagged ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)',
              color: dossier.isPatternAnomalyFlagged ? '#FCA5A5' : '#6EE7B7'
            }}>
              {dossier.escalationLevel}
            </span>
          </div>
        </div>
      </div>

      {/* ─── 4. BARIS UTAMA: DECK 1 (PROFIL BUKTI & OSINT DORKS) & DECK 2 (REKAP STATUS POLA TEKS) ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
        gap: '20px',
        marginBottom: '20px'
      }}>
        
        {/* ─── DECK 1: PROFIL BUKTI & VERIFIKASI OSINT RESMI ─── */}
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
                Integritas Byte & Batas Pembuktian
              </span>
            </div>

            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              padding: '2px 6px',
              borderRadius: '2px',
              background: dossier.isSimulation ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              color: dossier.isSimulation ? '#F87171' : '#34D399',
              border: `1px solid ${dossier.isSimulation ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
              fontWeight: 700
            }}>
              {dossier.isSimulation ? 'BENCHMARK SIMULASI' : 'BUKTI OPERATOR LAPANGAN'}
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
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>INTEGRITAS BYTES HASH:</span>
              <code style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: '#D4AF37' }}>
                {dossier.contentHash}
              </code>
            </div>

            <div style={{ fontSize: '9px', color: '#64748B', lineHeight: 1.4, borderTop: '1px dashed #1E2734', paddingTop: '6px' }}>
              ℹ️ {dossier.hashDisclaimer}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>CAKUPAN TIMESTAMP:</span>
              <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: dossier.rekapPolaTeks.timestampCoveragePercent > 0 ? '#34D399' : '#F59E0B', fontWeight: 700 }}>
                {dossier.rekapPolaTeks.validTimestampCount} / {dossier.rekapPolaTeks.totalScanned} record ({dossier.rekapPolaTeks.timestampCoveragePercent}%)
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
                  justifyContent: 'space-between'
                }}
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
                  justifyContent: 'space-between'
                }}
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
                  justifyContent: 'space-between'
                }}
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
                  justifyContent: 'space-between'
                }}
              >
                <span>Rilis Resmi TNI AD (tniad.mil.id) 🇮🇩</span>
                <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>

        {/* ─── DECK 2: REKAPITULASI POLA TEKS & NCS SCORECARD ─── */}
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
                REKAPITULASI POLA TEKS
              </span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#F1F5F9' }}>
                Distribusi Kesamaan Leksikal Agregat
              </span>
            </div>

            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
              SAMPEL: <strong>{dossier.rekapPolaTeks.totalScanned} RECORD</strong>
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
                style={{ width: `${dossier.rekapPolaTeks.distinctPercent}%`, background: '#10B981', transition: 'width 0.3s' }} 
                title={`Pola Teks Beragam: ${dossier.rekapPolaTeks.distinctPercent}%`}
              />
              <div 
                style={{ width: `${dossier.rekapPolaTeks.highSimilarityPercent}%`, background: '#F59E0B', transition: 'width 0.3s' }} 
                title={`Kemiripan Tinggi: ${dossier.rekapPolaTeks.highSimilarityPercent}%`}
              />
              <div 
                style={{ width: `${dossier.rekapPolaTeks.nearDuplicatePercent}%`, background: '#EF4444', transition: 'width 0.3s' }} 
                title={`Near-Duplicate Pattern: ${dossier.rekapPolaTeks.nearDuplicatePercent}%`}
              />
            </div>

            {/* 3 Status Filter Box */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setActivePatternFilter(activePatternFilter === 'DISTINCT' ? 'ALL' : 'DISTINCT')
                  setSelectedClusterPattern(null)
                }}
                style={{
                  background: activePatternFilter === 'DISTINCT' ? 'rgba(16, 185, 129, 0.2)' : '#0B111A',
                  border: `1px solid ${activePatternFilter === 'DISTINCT' ? '#10B981' : '#1E2734'}`,
                  borderRadius: '4px',
                  padding: '8px 10px',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#10B981', fontWeight: 800 }}>
                  🟢 TEKS BERAGAM
                </div>
                <div style={{ fontSize: '16px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#FFFFFF', marginTop: '2px' }}>
                  {dossier.rekapPolaTeks.distinctPercent}%
                </div>
                <div style={{ fontSize: '9px', color: '#64748B', marginTop: '2px' }}>
                  {dossier.rekapPolaTeks.distinctCount} record variatif
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActivePatternFilter(activePatternFilter === 'HIGH_SIMILARITY' ? 'ALL' : 'HIGH_SIMILARITY')
                  setSelectedClusterPattern(null)
                }}
                style={{
                  background: activePatternFilter === 'HIGH_SIMILARITY' ? 'rgba(245, 158, 11, 0.2)' : '#0B111A',
                  border: `1px solid ${activePatternFilter === 'HIGH_SIMILARITY' ? '#F59E0B' : '#1E2734'}`,
                  borderRadius: '4px',
                  padding: '8px 10px',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#F59E0B', fontWeight: 800 }}>
                  🟡 KEMIRIPAN TINGGI
                </div>
                <div style={{ fontSize: '16px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#FFFFFF', marginTop: '2px' }}>
                  {dossier.rekapPolaTeks.highSimilarityPercent}%
                </div>
                <div style={{ fontSize: '9px', color: '#64748B', marginTop: '2px' }}>
                  {dossier.rekapPolaTeks.highSimilarityCount} record serupa
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActivePatternFilter(activePatternFilter === 'NEAR_DUPLICATE' ? 'ALL' : 'NEAR_DUPLICATE')
                  setSelectedClusterPattern(null)
                }}
                style={{
                  background: activePatternFilter === 'NEAR_DUPLICATE' ? 'rgba(239, 68, 68, 0.2)' : '#0B111A',
                  border: `1px solid ${activePatternFilter === 'NEAR_DUPLICATE' ? '#EF4444' : '#1E2734'}`,
                  borderRadius: '4px',
                  padding: '8px 10px',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#EF4444', fontWeight: 800 }}>
                  🔴 NEAR-DUPLICATE
                </div>
                <div style={{ fontSize: '16px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#FFFFFF', marginTop: '2px' }}>
                  {dossier.rekapPolaTeks.nearDuplicatePercent}%
                </div>
                <div style={{ fontSize: '9px', color: '#64748B', marginTop: '2px' }}>
                  {dossier.rekapPolaTeks.nearDuplicateCount} template terduplikasi
                </div>
              </button>
            </div>
          </div>

          {/* Temporal Metrics / Honest Not Available (Package C) */}
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
                RATA-RATA INTERVAL WAKTU:
              </div>
              <div style={{
                fontSize: '13px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                color: dossier.rekapPolaTeks.averageIntervalSeconds !== null ? '#38BDF8' : '#64748B',
                marginTop: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Clock size={14} />
                <span>
                  {dossier.rekapPolaTeks.averageIntervalSeconds !== null
                    ? `${dossier.rekapPolaTeks.averageIntervalSeconds}s / record`
                    : 'TIDAK TERSEDIA'}
                </span>
              </div>
              <div style={{ fontSize: '9.5px', color: '#64748B', marginTop: '2px' }}>
                {dossier.rekapPolaTeks.temporalStatus === 'NOT_AVAILABLE_NO_SOURCE_TIMESTAMP'
                  ? 'Tanpa timestamp sumber platform'
                  : dossier.rekapPolaTeks.temporalStatus === 'VALID_SOURCE_TIMESTAMP'
                  ? 'Dihitung dari timestamp benchmark'
                  : 'Operator-supplied unverified'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                BURST VELOCITY:
              </div>
              <div style={{
                fontSize: '13px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                color: dossier.rekapPolaTeks.burstVelocityPerMinute !== null ? '#F59E0B' : '#64748B',
                marginTop: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Flame size={14} />
                <span>
                  {dossier.rekapPolaTeks.burstVelocityPerMinute !== null
                    ? `${dossier.rekapPolaTeks.burstVelocityPerMinute} rec/menit`
                    : 'TIDAK TERSEDIA'}
                </span>
              </div>
              <div style={{ fontSize: '9.5px', color: '#64748B', marginTop: '2px' }}>
                {dossier.rekapPolaTeks.burstVelocityPerMinute !== null
                  ? 'Laju konsentrasi waktu terhitung'
                  : 'Data waktu tidak memadai'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 5. BARIS KEDUA: DECK 3 (KLASTER TEMPLATE) & DECK 4 (FEED RECORD BUKTI) ─── */}
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
                Klaster Template Teks Near-Duplicate
              </span>
            </div>
            <span style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
              AMBANG JACCARD ≥ 65%
            </span>
          </div>

          <div style={{ fontSize: '11px', color: '#94A3B8' }}>
            {dossier.copypastaClusters.length > 0 
              ? 'Klik pada klaster template di bawah untuk menyorot seluruh record yang memuat teks serupa:'
              : 'Tidak terdeteksi klaster template berulang signifikan. Variasi leksikal teks dominan beragam.'}
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
                🟢 POLA BERAGAM: Variasi leksikal alami (Jaccard &lt; 40%).
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
                        setActivePatternFilter('ALL')
                      }
                    }}
                    style={{
                      background: isSelected ? 'rgba(239, 68, 68, 0.2)' : '#070B11',
                      border: `1px solid ${isSelected ? '#EF4444' : '#1E2734'}`,
                      borderRadius: '4px',
                      padding: '10px 12px',
                      textAlign: 'left',
                      cursor: 'pointer'
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
                        {cluster.occurrences} Record ({cluster.percentageOfTotal}%)
                      </span>
                    </div>

                    <div style={{ fontSize: '11.5px', color: '#F1F5F9', fontStyle: 'italic', marginBottom: '6px', lineHeight: 1.4 }}>
                      "{cluster.templateText}"
                    </div>

                    <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                      ID Record: {cluster.memberIds.slice(0, 5).join(', ')}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ─── DECK 4: FEED RECORD BUKTI DIGITAL (DATA MINIMIZATION) ─── */}
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
                Feed Record Bukti Terekstraksi ({filteredComments.length})
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

          {/* List Komentar dengan Pseudonym ID & Redacted Handle */}
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
                  background: c.isNearDuplicate ? 'rgba(239, 68, 68, 0.08)' : '#070B11',
                  border: `1px solid ${c.isNearDuplicate ? 'rgba(239, 68, 68, 0.4)' : '#1E2734'}`,
                  borderRadius: '4px',
                  padding: '10px 12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      fontSize: '9.5px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 800,
                      color: '#38BDF8',
                      background: '#162232',
                      padding: '1px 5px',
                      borderRadius: '2px'
                    }}>
                      {c.pseudonymId}
                    </span>
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                      {c.redactedHandle}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{
                      fontSize: '8.5px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 800,
                      padding: '1px 5px',
                      borderRadius: '2px',
                      background: c.patternCategory === 'NEAR_DUPLICATE' ? '#EF444425' : c.patternCategory === 'HIGH_SIMILARITY' ? '#F59E0B25' : '#10B98125',
                      color: c.patternCategory === 'NEAR_DUPLICATE' ? '#F87171' : c.patternCategory === 'HIGH_SIMILARITY' ? '#FBBF24' : '#34D399',
                      border: `1px solid ${c.patternCategory === 'NEAR_DUPLICATE' ? '#EF444450' : c.patternCategory === 'HIGH_SIMILARITY' ? '#F59E0B50' : '#10B98150'}`
                    }}>
                      {c.patternCategory === 'NEAR_DUPLICATE' ? 'NEAR-DUPLICATE' : c.patternCategory === 'HIGH_SIMILARITY' ? 'HIGH SIMILARITY' : 'DISTINCT'}
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

      {/* ─── 6. MODAL DRAF KONTRANARASI DISPENAD (PACKAGE I - GUARDRAILS) ─── */}
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
                  GENERATOR DRAF RESPON KONTRA (DRAFT — WAJIB REVIEW MANUSIA)
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

            {/* Disclaimer Guardrail */}
            <div style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '4px',
              padding: '6px 12px',
              marginBottom: '12px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: '#FBBF24'
            }}>
              ⚠️ Draf hanya bersifat saran klarifikasi faktual. Tidak ada auto-posting atau pengiriman massal. Seluruh naskah wajib diverifikasi oleh perwira penerangan sebelum disebarkan.
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
                      gap: '6px'
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
                  FORMAT PROTOKOL: {activeCounterTab.toUpperCase()} (DRAFT ONLY)
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
                    gap: '5px'
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
