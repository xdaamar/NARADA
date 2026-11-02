/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — COMMENT INTELLIGENCE & COGNITIVE SENTIMENT WORKSPACE
 * SPRINT 8: WORK PACKAGE 4 (TACTICAL ARMORED STEEL WORKSPACE UI)
 * PUSSIBERAD TNI AD × CODEPOLITAN — KARTIKA CYBER HACKATHON 2026
 * ══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  MessageSquare,
  Upload,
  Activity,
  AlertTriangle,
  CheckCircle,
  Shield,
  HelpCircle,
  Clock,
  Layers,
  TrendingUp,
  Trash2,
  Play,
  RotateCcw,
  Sparkles,
  X,
  FileCheck,
  Search
} from 'lucide-react'
import type { InvestigationCase } from '../engine/investigation/investigation-types.ts'
import {
  executeCommentAnalysis,
  createIntakePreview,
  parseManualInputText,
  parseCsvInput,
  parseJsonInput,
  INTAKE_LIMITS,
  STANDARD_ALTERNATIVE_EXPLANATIONS,
  SAFEGUARD_DISCLOSURES,
  type CommentBatch,
  type CommentRecord,
  type CommentAnalysisRun,
  type CommentReviewAnnotation,
  type IntakePreviewResult,
  type HumanReviewStatus,
  type SimilarityGroup
} from '../engine/intelligence'
import {
  saveCommentBatchToDB,
  getCommentBatchesFromDB,
  deleteCommentBatchFromDB,
  saveCommentRecordsToDB,
  getCommentRecordsFromDB,
  deleteCommentRecordsByBatchIdFromDB,
  saveCommentAnalysisRunToDB,
  getCommentAnalysisRunsFromDB,
  saveCommentReviewAnnotationToDB,
  getCommentReviewAnnotationsFromDB
} from '../utils/db-adapter.ts'
import { fallbackSHA256 } from '../utils/crypto.ts'

interface CommentIntelligenceWorkspaceProps {
  activeCase: InvestigationCase
  onClose?: () => void
  onBatchCreated?: (batch: CommentBatch) => void
}

type WorkspaceTab = 
  | 'INTAKE'
  | 'BATCHES'
  | 'OVERVIEW'
  | 'SENTIMENT'
  | 'SIMILARITY'
  | 'BURST'
  | 'COORDINATION'
  | 'REVIEW'
  | 'RUN_HISTORY'

export default function CommentIntelligenceWorkspace({
  activeCase,
  onClose,
  onBatchCreated
}: CommentIntelligenceWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('INTAKE')
  const [batches, setBatches] = useState<CommentBatch[]>([])
  const [selectedBatch, setSelectedBatch] = useState<CommentBatch | null>(null)
  const [activeRecords, setActiveRecords] = useState<CommentRecord[]>([])
  const [analysisRuns, setAnalysisRuns] = useState<CommentAnalysisRun[]>([])
  const [currentRun, setCurrentRun] = useState<CommentAnalysisRun | null>(null)
  const [reviewAnnotations, setReviewAnnotations] = useState<CommentReviewAnnotation[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showMethodologyModal, setShowMethodologyModal] = useState<boolean>(false)

  // ─── State Intake Form ───
  const [intakeMethodTab, setIntakeMethodTab] = useState<'MANUAL' | 'CSV' | 'JSON'>('MANUAL')
  const [manualText, setManualText] = useState<string>('')
  const [batchLabel, setBatchLabel] = useState<string>('')
  const [sourceLabel, setSourceLabel] = useState<string>('')
  const [sourceUrl, setSourceUrl] = useState<string>('')
  const [stagedFileName, setStagedFileName] = useState<string>('')
  const [previewResult, setPreviewResult] = useState<IntakePreviewResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Filter & Drilldown State ───
  const [sentimentFilter, setSentimentFilter] = useState<string>('ALL')
  const [selectedSimilarityGroup, setSelectedSimilarityGroup] = useState<SimilarityGroup | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')

  // ─── Memuat Batches Terkait Kasus dari IndexedDB ───
  const loadCaseBatches = useCallback(async () => {
    setIsLoading(true)
    try {
      const list = await getCommentBatchesFromDB(activeCase.id)
      setBatches(list)
      if (list.length > 0 && !selectedBatch) {
        setSelectedBatch(list[0])
      }
    } catch (err: any) {
      console.warn('[CommentIntelligence] Gagal memuat batch:', err)
    } finally {
      setIsLoading(false)
    }
  }, [activeCase.id, selectedBatch])

  useEffect(() => {
    loadCaseBatches()
  }, [loadCaseBatches])

  // ─── Memuat Records & Riwayat Analisis Saat Batch Terpilih Berubah ───
  useEffect(() => {
    if (!selectedBatch) {
      setActiveRecords([])
      setAnalysisRuns([])
      setCurrentRun(null)
      return
    }

    let isMounted = true
    async function loadBatchData() {
      setIsLoading(true)
      try {
        const records = await getCommentRecordsFromDB(selectedBatch!.id)
        const runs = await getCommentAnalysisRunsFromDB(selectedBatch!.id)
        const annotations = await getCommentReviewAnnotationsFromDB(undefined, activeCase.id)

        if (isMounted) {
          setActiveRecords(records)
          setAnalysisRuns(runs)
          setReviewAnnotations(annotations)
          if (runs.length > 0) {
            setCurrentRun(runs[runs.length - 1])
          } else {
            setCurrentRun(null)
          }
        }
      } catch (err: any) {
        console.warn('[CommentIntelligence] Gagal memuat data batch:', err)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }
    loadBatchData()
    return () => { isMounted = false }
  }, [selectedBatch, activeCase.id])

  // ─── Handler Generate Preview Intake ───
  const handleGeneratePreview = () => {
    setFeedbackMsg(null)
    const tempBatchId = `BAT-${Date.now().toString(36).toUpperCase()}`
    let rawItems: Array<{ text: string; timestamp?: string; sourceUrl?: string; sourceLabel?: string; authorHandle?: string }> = []
    let totalBytes = 0

    if (intakeMethodTab === 'MANUAL') {
      if (!manualText.trim()) {
        setFeedbackMsg({ type: 'error', text: 'Teks komentar belum dimasukkan.' })
        return
      }
      rawItems = parseManualInputText(manualText)
      totalBytes = new Blob([manualText]).size
    }

    if (rawItems.length === 0) {
      setFeedbackMsg({ type: 'error', text: 'Tidak ada baris komentar valid yang ditemukan.' })
      return
    }

    const preview = createIntakePreview(
      rawItems,
      intakeMethodTab === 'MANUAL' ? 'MANUAL_ENTRY' : 'LOCAL_FILE_IMPORT',
      tempBatchId,
      activeCase.id,
      totalBytes
    )
    setPreviewResult(preview)
  }

  // ─── Handler Unggah Berkas CSV / JSON ───
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setStagedFileName(file.name)
    setFeedbackMsg(null)

    if (file.size > INTAKE_LIMITS.MAX_FILE_SIZE_BYTES) {
      setFeedbackMsg({
        type: 'error',
        text: `Ukuran berkas (${(file.size / (1024 * 1024)).toFixed(2)} MB) melebihi batas aman 5 MB.`
      })
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      const tempBatchId = `BAT-${Date.now().toString(36).toUpperCase()}`
      let rawItems: Array<{ text: string; timestamp?: string; sourceUrl?: string; sourceLabel?: string; authorHandle?: string }> = []

      if (file.name.toLowerCase().endsWith('.csv')) {
        const { items, warnings } = parseCsvInput(content)
        rawItems = items
        if (warnings.length > 0) {
          setFeedbackMsg({ type: 'error', text: warnings.join(' | ') })
        }
      } else if (file.name.toLowerCase().endsWith('.json')) {
        const { items, warnings } = parseJsonInput(content)
        rawItems = items
        if (warnings.length > 0) {
          setFeedbackMsg({ type: 'error', text: warnings.join(' | ') })
        }
      } else {
        // Teks biasa baris demi baris
        rawItems = parseManualInputText(content)
      }

      const preview = createIntakePreview(
        rawItems,
        'LOCAL_FILE_IMPORT',
        tempBatchId,
        activeCase.id,
        file.size
      )
      setPreviewResult(preview)
    }
    reader.readAsText(file)
  }

  // ─── Handler Konfirmasi Pembuatan Batch & Simpan ke IndexedDB ───
  const handleConfirmBatchCreation = async () => {
    if (!previewResult || previewResult.acceptedRecords.length === 0) return

    setIsLoading(true)
    try {
      const batchId = `BAT-${Date.now().toString(36).toUpperCase()}`
      const label = batchLabel.trim() || `Sampel Komentar ${new Date().toLocaleDateString('id-ID')}`

      // Update ID record agar sinkron dengan batchId final
      const finalRecords: CommentRecord[] = previewResult.acceptedRecords.map((r, i) => ({
        ...r,
        batchId,
        id: `CR-${batchId.slice(0, 8)}-${String(i + 1).padStart(4, '0')}`,
        sourceLabel: sourceLabel.trim() || r.sourceLabel,
        sourceUrl: sourceUrl.trim() || r.sourceUrl
      }))

      const newBatch: CommentBatch = {
        id: batchId,
        caseId: activeCase.id,
        batchLabel: label,
        intakeMethod: previewResult.intakeMethod,
        originalFileName: stagedFileName || undefined,
        sourceLabel: sourceLabel.trim() || undefined,
        sourceUrl: sourceUrl.trim() || undefined,
        createdAt: new Date().toISOString(),
        totalRecordsCount: previewResult.totalRawRecords,
        acceptedRecordsCount: finalRecords.length,
        rejectedRecordsCount: previewResult.rejectedRecords.length,
        exactDuplicatesCount: previewResult.exactDuplicateCount,
        validationSummary: {
          missingTimestamps: previewResult.missingTimestampsCount,
          ambiguousTimestamps: previewResult.ambiguousTimestampsCount,
          missingAuthors: previewResult.missingAuthorsCount,
          missingSources: previewResult.missingSourcesCount,
          overlengthComments: finalRecords.filter(r => r.validationState === 'TRUNCATED').length,
          emptyComments: previewResult.rejectedRecords.length
        },
        schemaVersion: 1,
        canonicalManifestSha256: fallbackSHA256(JSON.stringify(finalRecords.map(r => r.contentDigest))),
        status: 'ACTIVE'
      }

      await saveCommentBatchToDB(newBatch)
      await saveCommentRecordsToDB(finalRecords)

      setBatches(prev => [newBatch, ...prev])
      setSelectedBatch(newBatch)
      setActiveRecords(finalRecords)
      setPreviewResult(null)
      setManualText('')
      setBatchLabel('')
      setStagedFileName('')

      setFeedbackMsg({
        type: 'success',
        text: `Batch [${newBatch.batchLabel}] dengan ${finalRecords.length} komentar berhasil dibuat dan disimpan.`
      })

      if (onBatchCreated) onBatchCreated(newBatch)
      setActiveTab('BATCHES')
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: `Gagal menyimpan batch: ${err.message}` })
    } finally {
      setIsLoading(false)
    }
  }

  // ─── Handler Eksekusi Analisis Komentar ───
  const handleRunAnalysis = async () => {
    if (!selectedBatch || activeRecords.length === 0) return

    setIsLoading(true)
    try {
      const runSnapshot = executeCommentAnalysis(selectedBatch, activeRecords)
      await saveCommentAnalysisRunToDB(runSnapshot)

      setAnalysisRuns(prev => [...prev, runSnapshot])
      setCurrentRun(runSnapshot)
      setActiveTab('OVERVIEW')

      setFeedbackMsg({
        type: 'success',
        text: `Analisis [${runSnapshot.id}] selesai! ${runSnapshot.analyzedCount} komentar berhasil diproses.`
      })
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: `Gagal menjalankan analisis: ${err.message}` })
    } finally {
      setIsLoading(false)
    }
  }

  // ─── Handler Hapus Batch ───
  const handleDeleteBatch = async (batchId: string) => {
    if (!confirm('Hapus batch komentar ini dan seluruh rekaman di dalamnya?')) return

    setIsLoading(true)
    try {
      await deleteCommentBatchFromDB(batchId)
      await deleteCommentRecordsByBatchIdFromDB(batchId)

      setBatches(prev => prev.filter(b => b.id !== batchId))
      if (selectedBatch?.id === batchId) {
        setSelectedBatch(null)
        setActiveRecords([])
        setCurrentRun(null)
      }
      setFeedbackMsg({ type: 'success', text: 'Batch komentar berhasil dihapus.' })
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: `Gagal menghapus batch: ${err.message}` })
    } finally {
      setIsLoading(false)
    }
  }

  // ─── Handler Human Review Status & Annotation ───
  const handleUpdateReviewStatus = async (
    targetType: CommentReviewAnnotation['targetType'],
    targetId: string,
    newStatus: HumanReviewStatus,
    note: string = ''
  ) => {
    if (!currentRun) return

    const annotationId = `REV-${targetId.slice(0, 10)}-${Date.now().toString(36)}`
    const annotation: CommentReviewAnnotation = {
      id: annotationId,
      caseId: activeCase.id,
      runId: currentRun.id,
      targetType,
      targetId,
      reviewStatus: newStatus,
      reviewerNote: note,
      reviewedAt: new Date().toISOString()
    }

    try {
      await saveCommentReviewAnnotationToDB(annotation)
      setReviewAnnotations(prev => [annotation, ...prev.filter(a => !(a.targetId === targetId && a.targetType === targetType))])
      setFeedbackMsg({ type: 'success', text: `Anotasi review [${newStatus}] berhasil disimpan.` })
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: `Gagal menyimpan review: ${err.message}` })
    }
  }

  // ─── Filtered Sentiment Records untuk Drilldown ───
  const filteredSentimentList = useMemo(() => {
    if (!currentRun) return []
    return currentRun.sentimentResults.filter(sr => {
      if (sentimentFilter !== 'ALL' && sr.sentiment !== sentimentFilter) return false
      if (searchQuery) {
        const rec = activeRecords.find(r => r.id === sr.commentId)
        if (!rec || !rec.rawText.toLowerCase().includes(searchQuery.toLowerCase())) return false
      }
      return true
    })
  }, [currentRun, sentimentFilter, searchQuery, activeRecords])

  return (
    <div style={{
      background: '#0B0F19',
      color: '#E2E8F0',
      border: '1px solid rgba(212, 175, 55, 0.4)',
      borderRadius: '8px',
      padding: '16px',
      position: 'relative',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)'
    }}>
      {/* ─── HEADER WORKSPACE ─── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        paddingBottom: '12px',
        marginBottom: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: 'rgba(212, 175, 55, 0.15)',
            border: '1px solid #D4AF37',
            padding: '6px',
            borderRadius: '6px'
          }}>
            <MessageSquare size={18} color="#D4AF37" />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#F1F5F9', letterSpacing: '0.8px', fontFamily: 'var(--font-mono)' }}>
              NARADA COMMENT INTELLIGENCE & SENTIMENT ANALYSIS
            </div>
            <div style={{ fontSize: '10px', color: '#94A3B8' }}>
              Kasus: <span style={{ color: '#D4AF37', fontWeight: 700 }}>[{activeCase.id}]</span> {activeCase.title.slice(0, 70)}...
              {isLoading && <span style={{ marginLeft: '10px', color: '#D4AF37', fontWeight: 700 }}>⚡ Memproses...</span>}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setShowMethodologyModal(true)}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#CBD5E1',
              padding: '5px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <HelpCircle size={13} color="#94A3B8" />
            Metodologi & Batasan
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#F87171',
                padding: '5px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <X size={13} />
              Tutup
            </button>
          )}
        </div>
      </div>

      {/* ─── NOTIFIKASI FEEDBACK ─── */}
      {feedbackMsg && (
        <div style={{
          marginBottom: '12px',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '11px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: feedbackMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          color: feedbackMsg.type === 'success' ? '#34D399' : '#F87171',
          border: `1px solid ${feedbackMsg.type === 'success' ? '#10B981' : '#EF4444'}`
        }}>
          {feedbackMsg.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* ─── TAB NAVIGATION WORKSPACE ─── */}
      <div style={{
        display: 'flex',
        gap: '4px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        paddingBottom: '8px',
        marginBottom: '14px',
        overflowX: 'auto'
      }}>
        {([
          { id: 'INTAKE', label: '1. Pemasukan Data (Intake)', icon: Upload },
          { id: 'BATCHES', label: `2. Daftar Batch (${batches.length})`, icon: Layers },
          { id: 'OVERVIEW', label: '3. Ikhtisar Analisis', icon: Activity },
          { id: 'SENTIMENT', label: '4. Sentimen Kognitif', icon: TrendingUp },
          { id: 'SIMILARITY', label: '5. Copypasta & Kemiripan', icon: Sparkles },
          { id: 'BURST', label: '6. Temporal Burst', icon: Clock },
          { id: 'COORDINATION', label: '7. Pola Koordinasi', icon: Shield },
          { id: 'REVIEW', label: '8. Antrean Review', icon: FileCheck },
          { id: 'RUN_HISTORY', label: `9. Riwayat Run (${analysisRuns.length})`, icon: RotateCcw }
        ] as const).map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as WorkspaceTab)}
              style={{
                background: isActive ? '#D4AF37' : 'rgba(255, 255, 255, 0.05)',
                color: isActive ? '#0F172A' : '#94A3B8',
                border: 'none',
                borderRadius: '4px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={12} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB 1: INTAKE & PREVIEW
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'INTAKE' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            {(['MANUAL', 'CSV', 'JSON'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => { setIntakeMethodTab(m); setPreviewResult(null) }}
                style={{
                  background: intakeMethodTab === m ? 'rgba(212, 175, 55, 0.2)' : '#1E293B',
                  border: `1px solid ${intakeMethodTab === m ? '#D4AF37' : 'rgba(255, 255, 255, 0.1)'}`,
                  color: intakeMethodTab === m ? '#D4AF37' : '#94A3B8',
                  padding: '6px 14px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {m === 'MANUAL' ? 'Input Teks Manual / Tempel' : m === 'CSV' ? 'Impor Berkas CSV' : 'Impor JSON'}
              </button>
            ))}
          </div>

          {/* Form Meta Batch */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Label Batch (contoh: Komentar X Isu Natuna)"
              value={batchLabel}
              onChange={e => setBatchLabel(e.target.value)}
              style={{ fontSize: '11px', background: '#0F172A', color: '#F1F5F9' }}
            />
            <input
              type="text"
              className="form-control"
              placeholder="Label Sumber Rujukan (opsional)"
              value={sourceLabel}
              onChange={e => setSourceLabel(e.target.value)}
              style={{ fontSize: '11px', background: '#0F172A', color: '#F1F5F9' }}
            />
            <input
              type="text"
              className="form-control"
              placeholder="URL Sumber Rujukan (opsional)"
              value={sourceUrl}
              onChange={e => setSourceUrl(e.target.value)}
              style={{ fontSize: '11px', background: '#0F172A', color: '#F1F5F9' }}
            />
          </div>

          {/* Mode Manual Paste */}
          {intakeMethodTab === 'MANUAL' && (
            <div>
              <textarea
                rows={6}
                className="form-control"
                placeholder="Tempelkan daftar komentar publik di sini (satu baris per komentar)..."
                value={manualText}
                onChange={e => setManualText(e.target.value)}
                style={{ width: '100%', fontSize: '12px', background: '#0F172A', color: '#F1F5F9', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <span style={{ fontSize: '10px', color: '#64748B' }}>
                  {manualText.length} karakter • Estimasi {manualText.split(/\r?\n/).filter(l => l.trim()).length} komentar • Batas per batch 2.000 records
                </span>
                <button
                  type="button"
                  onClick={handleGeneratePreview}
                  style={{
                    background: '#D4AF37',
                    color: '#0F172A',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '6px 14px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Pratinjau & Validasi Masukan
                </button>
              </div>
            </div>
          )}

          {/* Mode File Upload CSV / JSON */}
          {(intakeMethodTab === 'CSV' || intakeMethodTab === 'JSON') && (
            <div>
              <div
                style={{
                  border: '2px dashed rgba(212, 175, 55, 0.4)',
                  borderRadius: '6px',
                  padding: '24px 16px',
                  textAlign: 'center',
                  background: 'rgba(15, 23, 42, 0.4)',
                  cursor: 'pointer'
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={24} color="#D4AF37" style={{ margin: '0 auto 8px auto' }} />
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#F1F5F9' }}>
                  Pilih Berkas {intakeMethodTab} Komentar Lokal
                </div>
                <div style={{ fontSize: '10px', color: '#64748B', marginTop: '4px' }}>
                  Batas Maksimal 5 MB • Kolom: text, timestamp (opsional), authorHandle (opsional), sourceUrl (opsional)
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={intakeMethodTab === 'CSV' ? '.csv' : '.json'}
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
              </div>
            </div>
          )}

          {/* ─── Preview Modal / Card Sebelum Disimpan ─── */}
          {previewResult && (
            <div style={{
              marginTop: '16px',
              background: '#0F172A',
              border: '1px solid #10B981',
              borderRadius: '6px',
              padding: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileCheck size={16} color="#34D399" />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#34D399' }}>
                    Pratinjau Hasil Validasi Intake
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                  Ukuran: {(previewResult.totalBytes / 1024).toFixed(1)} KB • Total Karakter: {previewResult.totalCharacters}
                </span>
              </div>

              {/* Ringkasan Metrik Intake */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
                <div style={{ background: '#1E293B', padding: '8px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '9px', color: '#94A3B8' }}>DITERIMA</div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#34D399' }}>{previewResult.acceptedRecords.length}</div>
                </div>
                <div style={{ background: '#1E293B', padding: '8px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '9px', color: '#94A3B8' }}>DITOLAK (KOSONG)</div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#F87171' }}>{previewResult.rejectedRecords.length}</div>
                </div>
                <div style={{ background: '#1E293B', padding: '8px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '9px', color: '#94A3B8' }}>DUPLIKAT EKSAK</div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#F59E0B' }}>{previewResult.exactDuplicateCount}</div>
                </div>
                <div style={{ background: '#1E293B', padding: '8px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '9px', color: '#94A3B8' }}>TIMESTAMP AMBIGU</div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#CBD5E1' }}>{previewResult.ambiguousTimestampsCount}</div>
                </div>
              </div>

              {/* Cuplikan Sampel Komentar Teratas */}
              <div style={{ maxHeight: '160px', overflowY: 'auto', background: '#0B0F19', padding: '8px', borderRadius: '4px', marginBottom: '12px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#D4AF37', marginBottom: '6px' }}>
                  Contoh 5 Record Pertama yang Divalidasi:
                </div>
                {previewResult.acceptedRecords.slice(0, 5).map((r, i) => (
                  <div key={i} style={{ fontSize: '11px', color: '#CBD5E1', padding: '4px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <span style={{ color: '#D4AF37', marginRight: '6px' }}>[{r.id}]</span>
                    {r.rawText.slice(0, 100)}...
                  </div>
                ))}
              </div>

              {/* Tombol Aksi Konfirmasi / Batal */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setPreviewResult(null)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#94A3B8',
                    padding: '6px 14px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={!previewResult.canProceed}
                  onClick={handleConfirmBatchCreation}
                  style={{
                    background: previewResult.canProceed ? '#10B981' : '#475569',
                    color: '#0F172A',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '6px 16px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: previewResult.canProceed ? 'pointer' : 'not-allowed'
                  }}
                >
                  Konfirmasi & Simpan ke Kasus
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 2: DAFTAR BATCH TERSIMPAN
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'BATCHES' && (
        <div>
          {batches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
              <Layers size={32} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
              <div>Belum ada batch komentar untuk kasus ini.</div>
              <div style={{ fontSize: '11px', marginTop: '4px' }}>Buka tab Pemasukan Data (Intake) untuk membuat batch baru.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {batches.map(b => {
                const isSelected = selectedBatch?.id === b.id
                return (
                  <div
                    key={b.id}
                    style={{
                      background: isSelected ? 'rgba(212, 175, 55, 0.1)' : '#0F172A',
                      border: `1px solid ${isSelected ? '#D4AF37' : 'rgba(255, 255, 255, 0.1)'}`,
                      borderRadius: '6px',
                      padding: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#F1F5F9' }}>{b.batchLabel}</span>
                        <span style={{ fontSize: '9px', background: '#1E293B', color: '#D4AF37', padding: '2px 6px', borderRadius: '3px', fontFamily: 'monospace' }}>
                          {b.id}
                        </span>
                        <span style={{ fontSize: '9px', background: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA', padding: '2px 6px', borderRadius: '3px' }}>
                          {b.intakeMethod}
                        </span>
                      </div>
                      <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>
                        {b.acceptedRecordsCount} komentar • {b.exactDuplicatesCount} duplikat • Dibuat: {new Date(b.createdAt).toLocaleString('id-ID')}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => { setSelectedBatch(b); setActiveTab('OVERVIEW') }}
                        style={{
                          background: '#1E293B',
                          color: '#CBD5E1',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          padding: '5px 10px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        Pilih
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSelectedBatch(b); handleRunAnalysis() }}
                        style={{
                          background: '#D4AF37',
                          color: '#0F172A',
                          border: 'none',
                          padding: '5px 12px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Play size={11} fill="#0F172A" />
                        Jalankan Analisis
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBatch(b.id)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#F87171',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          padding: '5px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 3: IKHTISAR ANALISIS (OVERVIEW)
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'OVERVIEW' && (
        <div>
          {!currentRun ? (
            <div style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
              <Activity size={32} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
              <div>Belum ada hasil analisis untuk batch ini.</div>
              {selectedBatch && (
                <button
                  type="button"
                  onClick={handleRunAnalysis}
                  style={{
                    marginTop: '12px',
                    background: '#D4AF37',
                    color: '#0F172A',
                    border: 'none',
                    padding: '6px 16px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Eksekusi Analisis Sekarang
                </button>
              )}
            </div>
          ) : (
            <div>
              {/* Info Header Run */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0F172A', padding: '10px 14px', borderRadius: '6px', marginBottom: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>Run Snapshot: </span>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#D4AF37', fontFamily: 'monospace' }}>{currentRun.id}</span>
                  <span style={{ fontSize: '10px', color: '#64748B', marginLeft: '10px' }}>
                    {new Date(currentRun.createdAt).toLocaleString('id-ID')}
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: '#94A3B8' }}>
                  Versi Algoritma: <span style={{ color: '#CBD5E1', fontFamily: 'monospace' }}>v{currentRun.algorithmVersion.split(' ')[0]}</span>
                </div>
              </div>

              {/* 4 Kartu Metrik Utama */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '14px' }}>
                <div style={{ background: '#0F172A', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8' }}>TOTAL DIANALISIS</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#F1F5F9', marginTop: '4px' }}>{currentRun.analyzedCount}</div>
                  <div style={{ fontSize: '9px', color: '#64748B' }}>dari {currentRun.inputCount} masukan mentah</div>
                </div>

                <div style={{ background: '#0F172A', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8' }}>POLARITAS NEGATIF</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#F87171', marginTop: '4px' }}>
                    {(currentRun.sentimentSummary.negativeRatio * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '9px', color: '#64748B' }}>{currentRun.sentimentSummary.negativeCount} komentar</div>
                </div>

                <div style={{ background: '#0F172A', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8' }}>KLUSTER COPYPASTA</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#F59E0B', marginTop: '4px' }}>
                    {currentRun.similarityGroups.length}
                  </div>
                  <div style={{ fontSize: '9px', color: '#64748B' }}>ambang batas &ge; {(currentRun.config.similarityThreshold * 100)}%</div>
                </div>

                <div style={{ background: '#0F172A', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8' }}>INDIKATOR KOORDINASI</div>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    color: currentRun.coordinationIndicator.indicator === 'PATTERN_WARRANTS_REVIEW' ? '#F87171' : currentRun.coordinationIndicator.indicator === 'WEAK_PATTERN' ? '#F59E0B' : '#34D399',
                    marginTop: '8px'
                  }}>
                    {currentRun.coordinationIndicator.indicator}
                  </div>
                  <div style={{ fontSize: '9px', color: '#64748B' }}>
                    {currentRun.coordinationIndicator.triggeredFamilies.length} famili sinyal
                  </div>
                </div>
              </div>

              {/* Rationale Konservatif & Safeguard */}
              <div style={{ background: 'rgba(212, 175, 55, 0.08)', border: '1px solid rgba(212, 175, 55, 0.3)', padding: '12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#D4AF37', marginBottom: '4px' }}>
                  Penjelasan & Penilaian Pola (Forensic Rationale):
                </div>
                <div style={{ fontSize: '11px', color: '#E2E8F0', lineHeight: 1.5 }}>
                  {currentRun.coordinationIndicator.summaryRationale}
                </div>
                <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '8px', borderTop: '1px solid rgba(212, 175, 55, 0.2)', paddingTop: '6px' }}>
                  💡 {SAFEGUARD_DISCLOSURES[0]}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 4: SENTIMEN KOGNITIF (SENTIMENT INTELLIGENCE)
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'SENTIMENT' && currentRun && (
        <div>
          {/* Bar Distribusi Sentimen */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '14px' }}>
            {([
              { label: 'POSITIF', count: currentRun.sentimentSummary.positiveCount, ratio: currentRun.sentimentSummary.positiveRatio, color: '#10B981' },
              { label: 'NEGATIF', count: currentRun.sentimentSummary.negativeCount, ratio: currentRun.sentimentSummary.negativeRatio, color: '#EF4444' },
              { label: 'NETRAL', count: currentRun.sentimentSummary.neutralCount, ratio: currentRun.sentimentSummary.neutralRatio, color: '#94A3B8' },
              { label: 'UNCERTAIN', count: currentRun.sentimentSummary.uncertainCount, ratio: currentRun.sentimentSummary.uncertainRatio, color: '#F59E0B' },
              { label: 'MIXED', count: currentRun.sentimentSummary.mixedCount, ratio: currentRun.sentimentSummary.mixedRatio, color: '#8B5CF6' }
            ]).map(s => (
              <div
                key={s.label}
                onClick={() => setSentimentFilter(sentimentFilter === s.label ? 'ALL' : s.label)}
                style={{
                  background: sentimentFilter === s.label ? 'rgba(255, 255, 255, 0.1)' : '#0F172A',
                  border: `1px solid ${s.color}`,
                  borderRadius: '6px',
                  padding: '10px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontSize: '9px', fontWeight: 800, color: s.color }}>{s.label}</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#F1F5F9', marginTop: '2px' }}>{s.count}</div>
                <div style={{ fontSize: '10px', color: '#64748B' }}>{(s.ratio * 100).toFixed(1)}%</div>
              </div>
            ))}
          </div>

          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '9px', color: '#64748B' }} />
              <input
                type="text"
                placeholder="Cari teks komentar..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: '#0F172A',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  padding: '6px 10px 6px 30px',
                  fontSize: '11px',
                  color: '#F1F5F9'
                }}
              />
            </div>
            {sentimentFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSentimentFilter('ALL')}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#CBD5E1',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                Reset Filter ({sentimentFilter})
              </button>
            )}
          </div>

          {/* Daftar Komentar & Penjelasan Sentimen */}
          <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredSentimentList.map(sr => {
              const rec = activeRecords.find(r => r.id === sr.commentId)
              const existingReview = reviewAnnotations.find(a => a.targetId === sr.commentId)
              return (
                <div
                  key={sr.commentId}
                  style={{
                    background: '#0F172A',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                    padding: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10px', color: '#D4AF37', fontFamily: 'monospace' }}>[{sr.commentId}]</span>
                      <span style={{
                        fontSize: '9px',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: '3px',
                        background: sr.sentiment === 'POSITIVE' ? 'rgba(16, 185, 129, 0.2)' : sr.sentiment === 'NEGATIVE' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                        color: sr.sentiment === 'POSITIVE' ? '#34D399' : sr.sentiment === 'NEGATIVE' ? '#F87171' : '#94A3B8'
                      }}>
                        {sr.sentiment} ({sr.polarityScore > 0 ? `+${sr.polarityScore}` : sr.polarityScore})
                      </span>
                      <span style={{ fontSize: '9px', color: '#64748B' }}>Kepercayaan: {sr.confidence}</span>
                    </div>

                    {/* Quick Review Status */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {(['CONFIRMED_SIGNAL', 'DISMISSED'] as const).map(st => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleUpdateReviewStatus('COMMENT', sr.commentId, st)}
                          style={{
                            background: existingReview?.reviewStatus === st ? '#D4AF37' : '#1E293B',
                            color: existingReview?.reviewStatus === st ? '#0F172A' : '#94A3B8',
                            border: 'none',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontSize: '9px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {st === 'CONFIRMED_SIGNAL' ? '✓ Konfirmasi' : '✕ Abaikan'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ fontSize: '11px', color: '#F1F5F9', lineHeight: 1.4, marginBottom: '6px' }}>
                    {rec?.rawText}
                  </div>

                  {/* Sinyal Penjelasan Terinspeksi */}
                  <div style={{ fontSize: '10px', color: '#94A3B8', background: '#0B0F19', padding: '6px', borderRadius: '4px' }}>
                    {sr.explanation.matchedPositiveTerms.length > 0 && (
                      <span style={{ color: '#34D399', marginRight: '10px' }}>+ Kata Positif: {sr.explanation.matchedPositiveTerms.join(', ')}</span>
                    )}
                    {sr.explanation.matchedNegativeTerms.length > 0 && (
                      <span style={{ color: '#F87171', marginRight: '10px' }}>- Kata Negatif: {sr.explanation.matchedNegativeTerms.join(', ')}</span>
                    )}
                    {sr.explanation.negationDetected && (
                      <span style={{ color: '#F59E0B', marginRight: '10px' }}>⚡ Negasi: {sr.explanation.negationContext?.join(', ')}</span>
                    )}
                    {sr.explanation.sarcasmSuspected && (
                      <span style={{ color: '#F59E0B', marginRight: '10px' }}>🎭 Indikasi Sarkasme</span>
                    )}
                    {sr.explanation.uncertaintyReason && (
                      <span style={{ color: '#64748B' }}>ℹ {sr.explanation.uncertaintyReason}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 5: COPYPASTA & KEMIRIPAN (SIMILARITY)
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'SIMILARITY' && currentRun && (
        <div>
          {currentRun.similarityGroups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
              <Sparkles size={32} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
              <div>Tidak ditemukan kelompok copypasta atau duplikasi substansial (threshold &ge; {(currentRun.config.similarityThreshold * 100)}%).</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: selectedSimilarityGroup ? '1fr 1fr' : '1fr', gap: '12px' }}>
              {/* Kolom Daftar Kluster */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
                {currentRun.similarityGroups.map(sg => {
                  const isSelected = selectedSimilarityGroup?.groupId === sg.groupId
                  return (
                    <div
                      key={sg.groupId}
                      onClick={() => setSelectedSimilarityGroup(sg)}
                      style={{
                        background: isSelected ? 'rgba(212, 175, 55, 0.15)' : '#0F172A',
                        border: `1px solid ${isSelected ? '#D4AF37' : 'rgba(255, 255, 255, 0.1)'}`,
                        borderRadius: '6px',
                        padding: '10px',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#D4AF37' }}>
                          Kluster [{sg.groupId}] ({sg.memberCount} Komentar Serupa)
                        </span>
                        <span style={{ fontSize: '10px', background: '#1E293B', color: '#34D399', padding: '1px 6px', borderRadius: '3px' }}>
                          Skor Kemiripan: {(sg.averageSimilarityScore * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#CBD5E1', fontStyle: 'italic', lineHeight: 1.4 }}>
                        "{sg.representativeText.slice(0, 110)}..."
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Kolom Detail Anggota Kluster Terpilih */}
              {selectedSimilarityGroup && (
                <div style={{ background: '#0F172A', border: '1px solid #D4AF37', borderRadius: '6px', padding: '12px', maxHeight: '420px', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#D4AF37' }}>
                      Anggota Kluster {selectedSimilarityGroup.groupId}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedSimilarityGroup(null)}
                      style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {selectedSimilarityGroup.memberCommentIds.map(id => {
                      const rec = activeRecords.find(r => r.id === id)
                      return (
                        <div key={id} style={{ background: '#0B0F19', padding: '8px', borderRadius: '4px', fontSize: '11px' }}>
                          <div style={{ color: '#D4AF37', fontSize: '9px', marginBottom: '2px', fontFamily: 'monospace' }}>
                            [{id}] {rec?.authorHandle ? `@${rec.authorHandle}` : 'Tanpa Handle'} {rec?.rawTimestamp ? `• ${rec.rawTimestamp}` : ''}
                          </div>
                          <div style={{ color: '#F1F5F9' }}>{rec?.rawText}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 6: TEMPORAL BURST
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'BURST' && currentRun && (
        <div>
          {currentRun.burstAnalysis.status === 'INSUFFICIENT_DATA' ? (
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #F59E0B', padding: '16px', borderRadius: '6px', textAlign: 'center' }}>
              <AlertTriangle size={28} color="#F59E0B" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#F59E0B' }}>DATA TEMPORAL TIDAK MENCUKUPI (INSUFFICIENT DATA)</div>
              <div style={{ fontSize: '11px', color: '#CBD5E1', marginTop: '4px' }}>
                {currentRun.burstAnalysis.explanation}
              </div>
              <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '6px' }}>
                Cakupan timestamp: {(currentRun.burstAnalysis.timestampCoverageRatio * 100).toFixed(1)}% • Diperlukan minimal 30% timestamp valid untuk analisis burst.
              </div>
            </div>
          ) : currentRun.burstAnalysis.detectedBursts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
              <Clock size={32} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
              <div>Distribusi komentar merata dalam batas normal tanpa lonjakan temporal signifikan.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {currentRun.burstAnalysis.detectedBursts.map((b, i) => (
                <div key={i} style={{ background: '#0F172A', border: '1px solid #F59E0B', borderRadius: '6px', padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#F59E0B' }}>
                      Lonjakan Waktu (Jendela {b.windowDuration}): {b.observedCount} Komentar
                    </span>
                    <span style={{ fontSize: '10px', background: 'rgba(245, 158, 11, 0.2)', color: '#F59E0B', padding: '2px 8px', borderRadius: '4px' }}>
                      Rasio Konsentrasi: {b.concentrationRatio}x Baseline
                    </span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>
                    Rentang Waktu: {new Date(b.windowStart).toLocaleTimeString('id-ID')} s/d {new Date(b.windowEnd).toLocaleTimeString('id-ID')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 7: POLA KOORDINASI (COORDINATION INDICATORS)
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'COORDINATION' && currentRun && (
        <div>
          {/* Status Badge & Key Indicator */}
          <div style={{
            background: currentRun.coordinationIndicator.indicator === 'PATTERN_WARRANTS_REVIEW' ? 'rgba(239, 68, 68, 0.15)' : currentRun.coordinationIndicator.indicator === 'WEAK_PATTERN' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            border: `1px solid ${currentRun.coordinationIndicator.indicator === 'PATTERN_WARRANTS_REVIEW' ? '#EF4444' : currentRun.coordinationIndicator.indicator === 'WEAK_PATTERN' ? '#F59E0B' : '#10B981'}`,
            borderRadius: '6px',
            padding: '14px',
            marginBottom: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#94A3B8' }}>STATUS INDIKATOR KOORDINASI</div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  color: currentRun.coordinationIndicator.indicator === 'PATTERN_WARRANTS_REVIEW' ? '#F87171' : currentRun.coordinationIndicator.indicator === 'WEAK_PATTERN' ? '#F59E0B' : '#34D399',
                  marginTop: '2px'
                }}>
                  {currentRun.coordinationIndicator.indicator}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', color: '#94A3B8' }}>TINGKAT KEPERCAYAAN</div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#F1F5F9', marginTop: '2px' }}>
                  {currentRun.coordinationIndicator.confidence}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '11px', color: '#CBD5E1', marginTop: '10px', lineHeight: 1.5 }}>
              {currentRun.coordinationIndicator.summaryRationale}
            </div>
          </div>

          {/* Famili Sinyal yang Terpicu */}
          <div style={{ background: '#0F172A', padding: '12px', borderRadius: '6px', marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#D4AF37', marginBottom: '8px' }}>
              Famili Sinyal Observasi Terdeteksi:
            </div>
            {currentRun.coordinationIndicator.triggeredFamilies.length === 0 ? (
              <div style={{ fontSize: '11px', color: '#64748B' }}>Tidak ada famili sinyal yang melampaui ambang batas.</div>
            ) : (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {currentRun.coordinationIndicator.triggeredFamilies.map(fam => (
                  <span key={fam} style={{ background: '#1E293B', color: '#F1F5F9', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                    ⚡ {fam}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Alternatif Penjelasan Alami (Alternative Explanations) */}
          <div style={{ background: '#0F172A', padding: '12px', borderRadius: '6px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', marginBottom: '8px' }}>
              Kemungkinan Penjelasan Alami (False Positive Safeguards):
            </div>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '11px', color: '#CBD5E1', lineHeight: 1.6 }}>
              {STANDARD_ALTERNATIVE_EXPLANATIONS.map((alt, idx) => (
                <li key={idx}>{alt}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 8: ANTREAN REVIEW (HUMAN REVIEW QUEUE)
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'REVIEW' && (
        <div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '10px' }}>
            Anotasi hasil temuan oleh analis intelijen manusia. Keputusan analis tersimpan secara terpisah dari hasil algoritma.
          </div>

          {reviewAnnotations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
              <FileCheck size={32} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
              <div>Belum ada temuan yang dianotasi untuk kasus ini.</div>
              <div style={{ fontSize: '11px', marginTop: '4px' }}>Buka tab Sentimen atau Copypasta untuk meninjau record secara langsung.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
              {reviewAnnotations.map(a => (
                <div key={a.id} style={{ background: '#0F172A', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#D4AF37' }}>[{a.targetType}] {a.targetId}</span>
                      <span style={{
                        fontSize: '9px',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        background: a.reviewStatus === 'CONFIRMED_SIGNAL' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: a.reviewStatus === 'CONFIRMED_SIGNAL' ? '#34D399' : '#F87171'
                      }}>
                        {a.reviewStatus}
                      </span>
                    </div>
                    <span style={{ fontSize: '10px', color: '#64748B' }}>{new Date(a.reviewedAt).toLocaleString('id-ID')}</span>
                  </div>
                  {a.reviewerNote && (
                    <div style={{ fontSize: '11px', color: '#CBD5E1', marginTop: '4px' }}>
                      Catatan: {a.reviewerNote}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 9: RIWAYAT RUN (RUN HISTORY)
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'RUN_HISTORY' && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {analysisRuns.map(run => {
              const isSelected = currentRun?.id === run.id
              return (
                <div
                  key={run.id}
                  style={{
                    background: isSelected ? 'rgba(212, 175, 55, 0.1)' : '#0F172A',
                    border: `1px solid ${isSelected ? '#D4AF37' : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: '6px',
                    padding: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#F1F5F9', fontFamily: 'monospace' }}>{run.id}</span>
                      <span style={{ fontSize: '9px', background: '#1E293B', color: '#34D399', padding: '2px 6px', borderRadius: '3px' }}>
                        {run.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>
                      Waktu Run: {new Date(run.createdAt).toLocaleString('id-ID')} • {run.analyzedCount} Komentar Dianalisis
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setCurrentRun(run); setActiveTab('OVERVIEW') }}
                    style={{
                      background: isSelected ? '#D4AF37' : '#1E293B',
                      color: isSelected ? '#0F172A' : '#CBD5E1',
                      border: 'none',
                      padding: '5px 12px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {isSelected ? 'Aktif' : 'Buka Snapshot'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── MODAL METODOLOGI & BATASAN (Section 13.4) ─── */}
      {showMethodologyModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#0B0F19',
            border: '1px solid #D4AF37',
            borderRadius: '8px',
            maxWidth: '680px',
            width: '100%',
            maxHeight: '85vh',
            overflowY: 'auto',
            padding: '20px',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.8)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '10px', marginBottom: '14px' }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#D4AF37' }}>
                METODOLOGI & BATASAN SISTEM (COMMENT INTELLIGENCE)
              </div>
              <button
                type="button"
                onClick={() => setShowMethodologyModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ fontSize: '11px', color: '#CBD5E1', lineHeight: 1.6 }}>
              <h4 style={{ color: '#F1F5F9', margin: '8px 0 4px 0' }}>1. Estimasi Sentimen Kognitif</h4>
              <p>Menggunakan leksikon berbobot bahasa Indonesia kontekstual dengan perlakuan negasi (window 3-kata), penguat (intensifier), pelemah (diminisher), klausa kontras, dan pendeteksi indikasi sarkasme tanpa ketergantungan API pihak ketiga.</p>

              <h4 style={{ color: '#F1F5F9', margin: '8px 0 4px 0' }}>2. Deteksi Kemiripan Teks & Copypasta</h4>
              <p>Menerapkan token 2-shingle dan koefisien Jaccard dengan candidate bucketing (O(n) bounded) untuk mencegah beban komputasi kuadratik. Frasa generik sangat pendek (&lt; 4 token) seperti "setuju" atau "amin" secara eksplisit dikecualikan dari pembentukan kluster copypasta.</p>

              <h4 style={{ color: '#F1F5F9', margin: '8px 0 4px 0' }}>3. Deteksi Konsentrasi Temporal (Burst)</h4>
              <p>Menganalisis stempel waktu ber-offset eksplisit ISO-8601 melalui sliding window (5m, 15m, 1h, 6h). Data dengan cakupan timestamp &lt; 30% atau sampel &lt; 10 secara jujur menghasilkan status INSUFFICIENT_DATA.</p>

              <h4 style={{ color: '#F1F5F9', margin: '8px 0 4px 0' }}>4. Batasan & Integritas Forensik</h4>
              <p>Sistem ini BUKAN scraper medsos otomatis. Seluruh data berasal dari input manual atau berkas lokal analis. Pola statistik BUKAN bukti botnet, atribusi aktor, atau vonis propaganda.</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => setShowMethodologyModal(false)}
                style={{
                  background: '#D4AF37',
                  color: '#0F172A',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 14px',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Paham
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
