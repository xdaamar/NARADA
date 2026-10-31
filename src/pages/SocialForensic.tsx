import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  Clock,
  FileText,
  Database,
  Sparkles,
  AlertTriangle,
  History,
  Upload,
  Copy,
  Share2,
  Layers,
  Sliders,
  HelpCircle,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Download,
  Trash2,
  RefreshCw,
  ShieldCheck,
  MessageSquare,
  WifiOff
} from 'lucide-react'
import type { DebunkKnowledgeEntry } from '../types'
import {
  getInvestigationCase,
  getOrCreateCaseForCluster,
  createInvestigationCase,
  updateCaseStatus,
  addEvidenceRecord,
  getEvidenceRecordsForCase,
  createEvidenceRecord,
  validateEvidenceFile,
  validateEvidenceUrl,
  addClaimRecord,
  getClaimsForCase,
  addEvidenceRelation,
  getRelationsForCase,
  addAssessmentRecord,
  getAssessmentsForCase,
  getAuditEventsForCase,
  computeNarrativeSimilarityProfile,
  computeTemporalAnalysis,
  buildNarrativeRelationshipGraph,
  generateWhyNaradaThinksSo,
  computeCaseCoverage,
  generateEvidenceGroundedDraft,
  getResponseDraftsForCase,
  updateResponseDraftStatus,
  buildScenarioReplaySession,
  stepForward,
  stepBackward,
  jumpToStep,
  setPlaybackState,
  setPlaybackSpeed,
  reverifyAllEvidenceForCase,
  exportCasePackageJson,
  importCasePackageJson,
  deleteEvidenceRecord,
  deleteInvestigationCase,
  reopenInvestigationCase,
  type InvestigationCase,
  type EvidenceRecord,
  type ClaimRecord,
  type EvidenceRelation,
  type AssessmentRecord,
  type AuditEvent,
  type CaseStatus,
  type ClaimAssessmentStatus,
  type EvidenceRelationType,
  type TimestampProvenance,
  type NarrativeRelationshipGraph,
  type ResponseChannelType,
  type PublicResponseDraft,
  type ScenarioReplaySession
} from '../engine/investigation'
import {
  SYNTHETIC_BENCHMARKS,
  type SyntheticBenchmarkPreset
} from '../engine/social-threat-dossier'

export default function SocialForensic() {
  const navigate = useNavigate()
  const location = useLocation()

  // ─── 1. Inisialisasi Entitas Target & Kasus Investigasi (Sprint 2 - D2) ───
  const navState = (location.state || {}) as {
    targetItem?: DebunkKnowledgeEntry
    item?: DebunkKnowledgeEntry
    caseId?: string
  }

  const [activeCase, setActiveCase] = useState<InvestigationCase>(() => {
    if (navState.caseId) {
      const existing = getInvestigationCase(navState.caseId)
      if (existing) return existing
    }

    const target = (navState.targetItem || navState.item) as (DebunkKnowledgeEntry & { title?: string; summary?: string; isSimulation?: boolean }) | null
    if (target) {
      return getOrCreateCaseForCluster({
        id: target.id,
        title: target.claim || target.title || 'Kasus Investigasi Radar Berita',
        summary: target.clarification || target.summary || target.claim,
        publicationIds: [target.id],
        isSimulation: Boolean(target.isSimulation)
      })
    }

    // Default: Muat kasus dari benchmark sintetis pertama
    const initialBenchmark = SYNTHETIC_BENCHMARKS[0]
    return createInvestigationCase({
      title: initialBenchmark.claimTitle,
      summary: initialBenchmark.description,
      mode: 'SYNTHETIC_BENCHMARK',
      isSimulation: true,
      simulationWatermark: initialBenchmark.simulationWatermark
    })
  })

  // Sinkronisasi data saat case berubah
  const [evidenceList, setEvidenceList] = useState<EvidenceRecord[]>([])
  const [claimsList, setClaimsList] = useState<ClaimRecord[]>([])
  const [relationsList, setRelationsList] = useState<EvidenceRelation[]>([])
  const [assessmentsList, setAssessmentsList] = useState<AssessmentRecord[]>([])
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])

  const refreshCaseData = useCallback((caseId: string) => {
    const c = getInvestigationCase(caseId)
    if (c) setActiveCase(c)
    setEvidenceList(getEvidenceRecordsForCase(caseId))
    setClaimsList(getClaimsForCase(caseId))
    setRelationsList(getRelationsForCase(caseId))
    setAssessmentsList(getAssessmentsForCase(caseId))
    setAuditEvents(getAuditEventsForCase(caseId))
  }, [])

  useEffect(() => {
    refreshCaseData(activeCase.id)
  }, [activeCase.id, refreshCaseData])

  // Inisialisasi awal benchmark jika kasus baru dibuat dari benchmark dan belum ada bukti
  useEffect(() => {
    if (activeCase.mode === 'SYNTHETIC_BENCHMARK' && evidenceList.length === 0) {
      const bm = SYNTHETIC_BENCHMARKS.find(b => b.claimTitle === activeCase.title) || SYNTHETIC_BENCHMARKS[0]
      
      // Tambahkan klaim awal
      const claimId = `CLM-INIT-${Date.now()}`
      addClaimRecord({
        id: claimId,
        caseId: activeCase.id,
        claimText: bm.claimTitle,
        normalizedClaimText: bm.claimTitle.toLowerCase().trim(),
        extractedFromEvidenceIds: [],
        extractionMethod: 'MANUAL',
        status: 'UNDER_REVIEW',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        limitations: ['Klaim diekstraksi dari dataset benchmark sintetis terkontrol.']
      })

      // Tambahkan bukti sintetis
      bm.syntheticRecords.forEach(rec => {
        addEvidenceRecord(createEvidenceRecord({
          caseId: activeCase.id,
          evidenceType: 'PUBLIC_COMMENT_DATASET',
          evidenceMode: 'SYNTHETIC_BENCHMARK',
          sourceLabel: `Record Simulasi ${rec.recordId}`,
          sourceTimestampProvenance: 'SYNTHETIC_BENCHMARK_TIMESTAMP',
          sourcePublishedAt: rec.sourceTimestampIso,
          extractionMethod: 'MANUAL_TEXT',
          extractedText: rec.content,
          metadata: { syntheticHandle: rec.syntheticHandle, likes: rec.likes }
        }))
      })

      refreshCaseData(activeCase.id)
    }
  }, [activeCase.id, activeCase.mode, activeCase.title, evidenceList.length, refreshCaseData])

  // ─── 2. State Ingestion Console (Sprint 2 - D3 & Gate 0.5) ───
  const [ingestTab, setIngestTab] = useState<'TEXT' | 'FILE' | 'URL' | 'PRESET'>('TEXT')
  const [textInput, setTextInput] = useState<string>('')
  const [textSourceLabel, setTextSourceLabel] = useState<string>('Masukan Teks Analis')
  const [textTimestamp, setTextTimestamp] = useState<string>('')
  const [urlInput, setUrlInput] = useState<string>('')
  const [urlSourceLabel, setUrlSourceLabel] = useState<string>('')
  const [fileValidation, setFileValidation] = useState<ReturnType<typeof validateEvidenceFile> | null>(null)
  const [stagedFile, setStagedFile] = useState<{ name: string; bytes: Uint8Array; textContent: string } | null>(null)
  const [ingestSuccessMsg, setIngestSuccessMsg] = useState<string | null>(null)
  const [ingestErrorMsg, setIngestErrorMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── 3. State Penelaahan Klaim & Drawer (Sprint 2 - D5) ───
  const [isClaimDrawerOpen, setIsClaimDrawerOpen] = useState<boolean>(false)
  const [activeClaimId, setActiveClaimId] = useState<string | null>(null)
  const [newClaimText, setNewClaimText] = useState<string>('')
  const [selectedVerdict, setSelectedVerdict] = useState<ClaimAssessmentStatus>('UNVERIFIED')
  const [assessmentRationale, setAssessmentRationale] = useState<string>('')
  const [selectedRelationType, setSelectedRelationType] = useState<EvidenceRelationType>('SUPPORTS')
  const [selectedRelationEvidenceId, setSelectedRelationEvidenceId] = useState<string>('')
  const [relationRationale, setRelationRationale] = useState<string>('')

  // ─── 4. State Analisis Naratif & Temporal (Sprint 2 - D6) ───
  const narrativeProfileResult = useMemo(() => {
    const textRecords = evidenceList.map(e => ({ id: e.id, content: e.extractedText }))
    return computeNarrativeSimilarityProfile(textRecords)
  }, [evidenceList])

  const temporalAnalysisResult = useMemo(() => {
    const timeRecords = evidenceList.map(e => ({
      id: e.id,
      timestampIso: e.sourcePublishedAt,
      provenance: e.sourceTimestampProvenance
    }))
    return computeTemporalAnalysis(timeRecords)
  }, [evidenceList])

  const relationshipGraph: NarrativeRelationshipGraph = useMemo(() => {
    return buildNarrativeRelationshipGraph({
      investigationCase: activeCase,
      evidenceRecords: evidenceList,
      claims: claimsList,
      relations: relationsList
    })
  }, [activeCase, evidenceList, claimsList, relationsList])

  // ─── 5. State Explainable Assessment: Why NARADA Thinks So (Sprint 2 - D7) ───
  const [isWhyDrawerOpen, setIsWhyDrawerOpen] = useState<boolean>(false)
  const [activeWhyClaim, setActiveWhyClaim] = useState<ClaimRecord | null>(null)

  const activeWhyExplanation = useMemo(() => {
    if (!activeWhyClaim) return null
    const assess = assessmentsList.find(a => a.claimId === activeWhyClaim.id)
    return generateWhyNaradaThinksSo({
      caseId: activeCase.id,
      claim: activeWhyClaim,
      assessment: assess,
      relations: relationsList,
      evidenceList
    })
  }, [activeWhyClaim, activeCase.id, assessmentsList, relationsList, evidenceList])

  // ─── 6. State Modal Audit Log & Salin Feedback ───
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

  const triggerCopyFeedback = (msg: string) => {
    setCopyFeedback(msg)
    setTimeout(() => setCopyFeedback(null), 2500)
  }

  // ─── 7. State Sprint 3: Coverage, Response, Replay & Offline Mission Room ───
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true)
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const [responseDrafts, setResponseDrafts] = useState<PublicResponseDraft[]>([])
  const [isResponseDrawerOpen, setIsResponseDrawerOpen] = useState<boolean>(false)
  const [selectedChannel, setSelectedChannel] = useState<ResponseChannelType>('INSTITUTIONAL_PRESS')
  const [activeDraft, setActiveDraft] = useState<PublicResponseDraft | null>(null)
  const [editedContent, setEditedContent] = useState<string>('')
  const [reviewerNote, setReviewerNote] = useState<string>('')

  const [isReplayModalOpen, setIsReplayModalOpen] = useState<boolean>(false)
  const [replaySession, setReplaySession] = useState<ScenarioReplaySession | null>(null)
  const [replayFilter, setReplayFilter] = useState<string>('ALL')

  const [isDeleteCaseModalOpen, setIsDeleteCaseModalOpen] = useState<boolean>(false)
  const [evidenceToDelete, setEvidenceToDelete] = useState<string | null>(null)
  const [isReopenModalOpen, setIsReopenModalOpen] = useState<boolean>(false)
  const [reopenRationale, setReopenRationale] = useState<string>('')
  const [reverifySummary, setReverifySummary] = useState<{ verifiedCount: number; warningCount: number } | null>(null)
  const casePackageInputRef = useRef<HTMLInputElement>(null)

  const coverageSummary = useMemo(() => {
    return computeCaseCoverage(activeCase.id)
  }, [activeCase.id, evidenceList, claimsList, relationsList, assessmentsList])

  // Sinkronisasi draf saat activeCase berubah
  useEffect(() => {
    const drafts = getResponseDraftsForCase(activeCase.id)
    setResponseDrafts(drafts)
    if (drafts.length > 0) {
      setActiveDraft(drafts[0])
      setEditedContent(drafts[0].content)
    } else {
      setActiveDraft(null)
      setEditedContent('')
    }
  }, [activeCase.id])

  // Replay playback timer loop
  useEffect(() => {
    if (!replaySession || replaySession.playbackState !== 'PLAYING') return

    const intervalMs = replaySession.playbackSpeed === 4 ? 375 : replaySession.playbackSpeed === 2 ? 750 : 1500
    const timer = setInterval(() => {
      setReplaySession(prev => {
        if (!prev) return null
        return stepForward(prev)
      })
    }, intervalMs)

    return () => clearInterval(timer)
  }, [replaySession?.playbackState, replaySession?.playbackSpeed, replaySession])

  // Handlers Sprint 3
  const handleGenerateDraft = (channel: ResponseChannelType) => {
    try {
      const draft = generateEvidenceGroundedDraft({
        caseId: activeCase.id,
        channel,
        reviewerActor: 'Operator Analis Lokal'
      })
      const updated = getResponseDraftsForCase(activeCase.id)
      setResponseDrafts(updated)
      setActiveDraft(draft)
      setEditedContent(draft.content)
      refreshCaseData(activeCase.id)
      triggerCopyFeedback(`Draf tanggapan ${draft.channelLabel} berhasil diformulasikan.`)
    } catch (err) {
      setIngestErrorMsg('Gagal memformulasikan draf: ' + String(err))
    }
  }

  const handleApproveDraft = (draftId: string) => {
    updateResponseDraftStatus(draftId, 'APPROVED_BY_REVIEWER', reviewerNote || 'Disetujui di tingkat meja kerja analis lokal.')
    const updated = getResponseDraftsForCase(activeCase.id)
    setResponseDrafts(updated)
    const match = updated.find(d => d.id === draftId)
    if (match) setActiveDraft(match)
    refreshCaseData(activeCase.id)
    triggerCopyFeedback('Draf tanggapan disetujui (APPROVED_BY_REVIEWER).')
  }

  const handleRejectDraft = (draftId: string) => {
    updateResponseDraftStatus(draftId, 'REJECTED_BY_REVIEWER', reviewerNote || 'Draf ditolak oleh analis.')
    const updated = getResponseDraftsForCase(activeCase.id)
    setResponseDrafts(updated)
    const match = updated.find(d => d.id === draftId)
    if (match) setActiveDraft(match)
    refreshCaseData(activeCase.id)
    triggerCopyFeedback('Draf tanggapan ditolak (REJECTED_BY_REVIEWER).')
  }

  const handleSaveEditedDraft = (draftId: string) => {
    updateResponseDraftStatus(draftId, 'EDITED_DRAFT', 'Penyuntingan manual oleh analis', editedContent)
    const updated = getResponseDraftsForCase(activeCase.id)
    setResponseDrafts(updated)
    const match = updated.find(d => d.id === draftId)
    if (match) setActiveDraft(match)
    refreshCaseData(activeCase.id)
    triggerCopyFeedback('Naskah draf editan tersimpan.')
  }

  const handleOpenReplay = () => {
    const session = buildScenarioReplaySession(activeCase.id, { eventFilter: replayFilter })
    setReplaySession(session)
    setIsReplayModalOpen(true)
  }

  const handleReverifyHashes = () => {
    const sum = reverifyAllEvidenceForCase(activeCase.id)
    setReverifySummary(sum)
    refreshCaseData(activeCase.id)
    triggerCopyFeedback(`Verifikasi selesai: ${sum.verifiedCount} lolos, ${sum.warningCount} anomali.`)
  }

  const handleExportCasePackage = () => {
    try {
      const json = exportCasePackageJson(activeCase.id)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `case-package-${activeCase.caseNumber}.json`
      a.click()
      URL.revokeObjectURL(url)
      triggerCopyFeedback('Paket kasus berhasil diekspor.')
    } catch (err) {
      setIngestErrorMsg('Gagal mengekspor paket kasus: ' + String(err))
    }
  }

  const handleImportCasePackage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const imported = importCasePackageJson(text)
      if (imported.success && imported.caseId) {
        const found = getInvestigationCase(imported.caseId)
        if (found) {
          setActiveCase(found)
          refreshCaseData(found.id)
          triggerCopyFeedback(`Paket kasus ${found.caseNumber} berhasil diimpor.`)
        }
      } else {
        setIngestErrorMsg('Gagal mengimpor paket kasus: ' + (imported.error || 'Format tidak valid'))
      }
    } catch (err) {
      setIngestErrorMsg('Gagal mengimpor paket kasus: ' + String(err))
    }
    if (casePackageInputRef.current) casePackageInputRef.current.value = ''
  }

  const handleDeleteEvidence = (id: string) => {
    deleteEvidenceRecord(id)
    setEvidenceToDelete(null)
    refreshCaseData(activeCase.id)
    triggerCopyFeedback('Berkas bukti berhasil dihapus secara kaskade.')
  }

  const handleDeleteCase = () => {
    deleteInvestigationCase(activeCase.id)
    setIsDeleteCaseModalOpen(false)
    navigate('/radar')
  }

  const handleReopenCase = () => {
    reopenInvestigationCase(activeCase.id, 'Operator Analis', reopenRationale || 'Pemeriksaan bukti baru')
    setIsReopenModalOpen(false)
    setReopenRationale('')
    refreshCaseData(activeCase.id)
    triggerCopyFeedback('Kasus berhasil dibuka kembali (UNDER_REVIEW).')
  }

  // ─── HANDLERS INGESTION ───

  const handleIngestText = () => {
    if (!textInput.trim()) {
      setIngestErrorMsg('Teks input tidak boleh kosong.')
      return
    }

    const provenance: TimestampProvenance = textTimestamp.trim()
      ? 'OPERATOR_SUPPLIED_UNVERIFIED'
      : 'NO_SOURCE_TIMESTAMP'

    const record = createEvidenceRecord({
      caseId: activeCase.id,
      evidenceType: 'PUBLIC_POST_TEXT',
      evidenceMode: activeCase.mode,
      sourceLabel: textSourceLabel.trim() || 'Masukan Analis',
      sourceTimestampProvenance: provenance,
      sourcePublishedAt: textTimestamp.trim() || undefined,
      extractionMethod: 'MANUAL_TEXT',
      extractedText: textInput.trim()
    })

    addEvidenceRecord(record)
    setTextInput('')
    setTextTimestamp('')
    setIngestSuccessMsg(`Bukti ${record.id} berhasil ditambahkan ke berkas kasus.`)
    setTimeout(() => setIngestSuccessMsg(null), 3000)
    refreshCaseData(activeCase.id)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIngestErrorMsg(null)
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    const validation = validateEvidenceFile(file.name, bytes)
    setFileValidation(validation)

    if (!validation.isValid) {
      setIngestErrorMsg(validation.errorMessage || 'Berkas ditolak.')
      return
    }

    // Ekstrak teks sederhana untuk TXT, CSV, JSON
    let textContent = ''
    if (validation.detectedType === 'TXT' || validation.detectedType === 'CSV' || validation.detectedType === 'JSON') {
      textContent = new TextDecoder('utf-8').decode(bytes)
    } else {
      textContent = `[Materi Ekstraksi Citra/Dokumen: ${file.name}] (Ukuran: ${(file.size / 1024).toFixed(1)} KB)`
    }

    setStagedFile({
      name: file.name,
      bytes,
      textContent
    })
  }

  const handleConfirmFileIngest = () => {
    if (!stagedFile || !fileValidation || !fileValidation.isValid) return

    const record = createEvidenceRecord({
      caseId: activeCase.id,
      evidenceType: fileValidation.detectedType === 'PDF' ? 'DOCUMENT' : fileValidation.detectedType === 'CSV' ? 'PUBLIC_COMMENT_DATASET' : fileValidation.detectedType?.startsWith('PNG') || fileValidation.detectedType?.startsWith('JPEG') ? 'SCREENSHOT' : 'DOCUMENT',
      evidenceMode: activeCase.mode,
      sourceLabel: `Berkas: ${stagedFile.name}`,
      sourceTimestampProvenance: 'NO_SOURCE_TIMESTAMP',
      extractionMethod: fileValidation.detectedType === 'CSV' ? 'CSV_IMPORT' : fileValidation.detectedType === 'JSON' ? 'JSON_IMPORT' : fileValidation.detectedType === 'PDF' ? 'PDF_TEXT' : 'MANUAL_TEXT',
      extractedText: stagedFile.textContent,
      originalByteSha256: fileValidation.originalByteSha256,
      originalRetained: false
    })

    addEvidenceRecord(record)
    setStagedFile(null)
    setFileValidation(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setIngestSuccessMsg(`Berkas ${record.id} berhasil diverifikasi dan disimpan.`)
    setTimeout(() => setIngestSuccessMsg(null), 3000)
    refreshCaseData(activeCase.id)
  }

  const handleIngestUrl = () => {
    if (!urlInput.trim()) {
      setIngestErrorMsg('URL tidak boleh kosong.')
      return
    }

    const check = validateEvidenceUrl(urlInput)
    if (!check.isValid) {
      setIngestErrorMsg(check.error || 'URL tidak aman.')
      return
    }

    const record = createEvidenceRecord({
      caseId: activeCase.id,
      evidenceType: 'NEWS_PUBLICATION_REFERENCE',
      evidenceMode: activeCase.mode,
      sourceLabel: urlSourceLabel.trim() || 'Tautan Referensi Publik',
      sourceUrl: check.normalizedUrl,
      sourceTimestampProvenance: 'SOURCE_REPORTED_TIMESTAMP',
      extractionMethod: 'URL_REFERENCE_ONLY',
      extractedText: `[Referensi URL Publik]: ${check.normalizedUrl}`,
      limitations: [
        'URL disimpan sebagai referensi verifikasi pihak luar; tidak dilakukan scraping otomatis.',
        'Konten belum diekstrak secara otomatis untuk menjaga integritas anti-SSRF.'
      ]
    })

    addEvidenceRecord(record)
    setUrlInput('')
    setUrlSourceLabel('')
    setIngestSuccessMsg(`Referensi ${record.id} tersimpan dalam katalog bukti.`)
    setTimeout(() => setIngestSuccessMsg(null), 3000)
    refreshCaseData(activeCase.id)
  }

  const handleSwitchToBenchmark = (preset: SyntheticBenchmarkPreset) => {
    const newCase = createInvestigationCase({
      title: preset.claimTitle,
      summary: preset.description,
      mode: 'SYNTHETIC_BENCHMARK',
      isSimulation: true,
      simulationWatermark: preset.simulationWatermark
    })

    // Tambah klaim awal
    addClaimRecord({
      id: `CLM-${Date.now()}`,
      caseId: newCase.id,
      claimText: preset.claimTitle,
      normalizedClaimText: preset.claimTitle.toLowerCase().trim(),
      extractedFromEvidenceIds: [],
      extractionMethod: 'MANUAL',
      status: 'UNDER_REVIEW',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      limitations: ['Klaim benchmark sintetis terkontrol.']
    })

    // Tambah bukti
    preset.syntheticRecords.forEach(r => {
      addEvidenceRecord(createEvidenceRecord({
        caseId: newCase.id,
        evidenceType: 'PUBLIC_COMMENT_DATASET',
        evidenceMode: 'SYNTHETIC_BENCHMARK',
        sourceLabel: `Benchmark: ${r.recordId}`,
        sourceTimestampProvenance: 'SYNTHETIC_BENCHMARK_TIMESTAMP',
        sourcePublishedAt: r.sourceTimestampIso,
        extractionMethod: 'MANUAL_TEXT',
        extractedText: r.content,
        metadata: { syntheticHandle: r.syntheticHandle, likes: r.likes }
      }))
    })

    setActiveCase(newCase)
    refreshCaseData(newCase.id)
  }

  // ─── HANDLERS CLAIM & ASSESSMENT ───

  const handleCreateNewClaim = () => {
    if (!newClaimText.trim()) return
    const claim = {
      id: `CLM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      caseId: activeCase.id,
      claimText: newClaimText.trim(),
      normalizedClaimText: newClaimText.trim().toLowerCase(),
      extractedFromEvidenceIds: [],
      extractionMethod: 'MANUAL' as const,
      status: 'UNDER_REVIEW' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      limitations: ['Klaim dirumuskan langsung oleh operator analis.']
    }
    addClaimRecord(claim)
    setNewClaimText('')
    refreshCaseData(activeCase.id)
  }

  const handleAddRelation = () => {
    if (!activeClaimId || !selectedRelationEvidenceId) return
    const rel: EvidenceRelation = {
      id: `REL-${Date.now()}`,
      caseId: activeCase.id,
      claimId: activeClaimId,
      evidenceId: selectedRelationEvidenceId,
      relationType: selectedRelationType,
      rationale: relationRationale.trim() || 'Tautan bukti berdasarkan penelaahan leksikal dan konteks naskah.',
      createdBy: 'Operator Analis',
      createdAt: new Date().toISOString(),
      reviewStatus: 'CONFIRMED'
    }
    addEvidenceRelation(rel)
    setRelationRationale('')
    refreshCaseData(activeCase.id)
  }

  const handleSaveAssessmentVerdict = () => {
    if (!activeClaimId) return
    const claim = claimsList.find(c => c.id === activeClaimId)
    if (!claim) return

    const related = relationsList.filter(r => r.claimId === activeClaimId)
    const supporting = related.filter(r => r.relationType === 'SUPPORTS').map(r => r.evidenceId)
    const contradicting = related.filter(r => r.relationType === 'CONTRADICTS').map(r => r.evidenceId)
    const contextual = related.filter(r => r.relationType !== 'SUPPORTS' && r.relationType !== 'CONTRADICTS').map(r => r.evidenceId)

    const prev = assessmentsList.find(a => a.claimId === activeClaimId)

    const assessment: AssessmentRecord = {
      id: `ASM-${Date.now()}`,
      caseId: activeCase.id,
      claimId: activeClaimId,
      verdict: selectedVerdict,
      rationale: assessmentRationale.trim() || 'Penilaian diputuskan berdasarkan penelaahan bukti dan alasan rasional.',
      supportingEvidenceIds: supporting,
      contradictingEvidenceIds: contradicting,
      contextualEvidenceIds: contextual,
      assessedBy: 'Operator Analis Lokal',
      assessedAt: new Date().toISOString(),
      previousVerdict: prev?.verdict,
      reviewState: 'ANALYST_DRAFT',
      limitations: [
        'Vonis berlaku terbatas pada klaim atomik ini.',
        'Tidak memvonis artikel media atau portal penerbit secara global.'
      ]
    }

    addAssessmentRecord(assessment)
    setAssessmentRationale('')
    refreshCaseData(activeCase.id)
    setIngestSuccessMsg(`Vonis klaim "${selectedVerdict}" berhasil dicatat dalam audit trail.`)
    setTimeout(() => setIngestSuccessMsg(null), 3000)
  }

  // Active claim helper
  const activeClaim = useMemo(() => {
    return claimsList.find(c => c.id === activeClaimId) || claimsList[0] || null
  }, [claimsList, activeClaimId])

  return (
    <div className="fade-in" style={{ paddingBottom: '48px' }}>
      {/* ─── BANNER OFFLINE MISSION ROOM (SPRINT 3 - P4) ─── */}
      {!isOnline && (
        <div style={{
          marginBottom: '16px',
          padding: '10px 16px',
          background: 'rgba(234, 179, 8, 0.12)',
          border: '1px solid #EAB308',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <WifiOff size={16} color="#EAB308" />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#FEF08A' }}>
              MODE MISI OFFLINE AKTIF: Sambungan internet terputus. Penyelidikan beroperasi penuh menggunakan arsip lokal dan verifikasi kriptografis mandiri.
            </span>
          </div>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', padding: '2px 6px', background: '#EAB308', color: '#0F172A', fontWeight: 800, borderRadius: '3px' }}>
            LOCAL-ONLY
          </span>
        </div>
      )}

      {/* ─── BANNER FIREWALL SIMULASI (IMMUTABLE WATERMARK SPRINT 1D/2) ─── */}
      {activeCase.isSimulation && (
        <div style={{
          marginBottom: '16px',
          padding: '12px 18px',
          background: 'rgba(245, 158, 11, 0.12)',
          border: '2px dashed #F59E0B',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={20} color="#F59E0B" />
            <div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '1px',
                color: '#F59E0B'
              }}>
                SIMULASI — SYNTHETIC BENCHMARK — BUKAN DATA LIVE / BUKAN KASUS NYATA
              </div>
              <div style={{ fontSize: '11px', color: '#CBD5E1', marginTop: '2px' }}>
                Kasus ini beroperasi dalam lingkungan uji terisolasi. Data dan stempel waktu sintetis tidak memutasi Radar Berita langsung.
              </div>
            </div>
          </div>
          <span style={{
            fontSize: '9px',
            fontFamily: 'var(--font-mono)',
            padding: '3px 8px',
            borderRadius: '4px',
            background: '#F59E0B',
            color: '#0F172A',
            fontWeight: 800
          }}>
            BENCHMARK FIREWALL AKTIF
          </span>
        </div>
      )}

      {/* ─── HEADER UTAMA: TACTICAL ARMORED STEEL CASE PLATE ─── */}
      <div className="steel-chassis-card" style={{ marginBottom: '20px', position: 'relative' }}>
        <span className="bolt-tl" />
        <span className="bolt-tr" />
        <span className="bolt-bl" />
        <span className="bolt-br" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <button
                type="button"
                onClick={() => navigate('/radar')}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#94A3B8',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px'
                }}
              >
                <ArrowLeft size={13} />
                <span>Radar Berita</span>
              </button>

              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 800,
                color: '#D4AF37',
                padding: '3px 8px',
                borderRadius: '4px',
                background: 'rgba(212, 175, 55, 0.1)',
                border: '1px solid rgba(212, 175, 55, 0.3)',
                letterSpacing: '1px'
              }}>
                {activeCase.caseNumber}
              </span>

              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '4px',
                background: activeCase.mode === 'SYNTHETIC_BENCHMARK' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                color: activeCase.mode === 'SYNTHETIC_BENCHMARK' ? '#FBBF24' : '#34D399',
                border: `1px solid ${activeCase.mode === 'SYNTHETIC_BENCHMARK' ? '#F59E0B' : '#10B981'}`
              }}>
                MODE: {activeCase.mode}
              </span>
            </div>

            <h1 style={{
              fontSize: '20px',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              color: '#F8FAFC',
              letterSpacing: '1px',
              margin: '0 0 6px 0'
            }}>
              {activeCase.title}
            </h1>
            <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0, maxWidth: '780px', lineHeight: 1.5 }}>
              {activeCase.summary}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Status Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#64748B', fontFamily: 'var(--font-mono)' }}>STATUS:</span>
              <select
                value={activeCase.status}
                onChange={(e) => {
                  updateCaseStatus(activeCase.id, e.target.value as CaseStatus, 'Operator Analis', 'Pembaruan status dari header workbench')
                  refreshCaseData(activeCase.id)
                }}
                style={{
                  background: '#0F172A',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#F1F5F9',
                  padding: '5px 10px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <option value="OPEN">OPEN (Baru)</option>
                <option value="UNDER_REVIEW">UNDER_REVIEW (Sedang Ditelusuri)</option>
                <option value="NEEDS_MORE_EVIDENCE">NEEDS_MORE_EVIDENCE (Butuh Bukti)</option>
                <option value="REVIEWED">REVIEWED (Selesai Ditelaah)</option>
                <option value="CONCLUDED">CONCLUDED (Kasus Disimpulkan)</option>
                <option value="ARCHIVED">ARCHIVED (Diarsipkan)</option>
              </select>
            </div>

            {/* Tombol Audit History */}
            <button
              type="button"
              onClick={() => setIsAuditModalOpen(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#CBD5E1',
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <History size={13} />
              <span>Log Audit ({auditEvents.length})</span>
            </button>

            {/* Tombol Kirim ke Laporan A4 */}
            <button
              type="button"
              onClick={() => navigate('/reports', {
                state: {
                  caseId: activeCase.id,
                  isSimulation: activeCase.isSimulation,
                  simulationWatermark: activeCase.simulationWatermark,
                  evidenceMode: activeCase.mode,
                  prefillClaim: activeCase.title
                }
              })}
              style={{
                background: 'linear-gradient(135deg, #1E293B, #0F172A)',
                border: '1px solid #D4AF37',
                color: '#D4AF37',
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <FileText size={13} />
              <span>Cetak Produk A4</span>
            </button>
          </div>
        </div>

        {/* Baris Metadata Kasus */}
        <div style={{
          marginTop: '14px',
          paddingTop: '10px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: '#64748B',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div>
            <span>Dikelola oleh: <strong>{activeCase.createdByLocalOperator}</strong></span>
            <span style={{ margin: '0 8px' }}>•</span>
            <span>Diperbarui: {new Date(activeCase.updatedAt).toLocaleTimeString('id-ID')} WIB</span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <span>Katalog Bukti: <strong style={{ color: '#F1F5F9' }}>{evidenceList.length}</strong> Berkas</span>
            <span>Klaim Terdaftar: <strong style={{ color: '#F1F5F9' }}>{claimsList.length}</strong> Klaim</span>
            <span>Relasi Aktif: <strong style={{ color: '#F1F5F9' }}>{relationsList.length}</strong> Tautan</span>
          </div>
        </div>
      </div>

      {copyFeedback && (
        <div style={{
          padding: '8px 14px',
          background: 'rgba(16, 185, 129, 0.2)',
          border: '1px solid #10B981',
          color: '#34D399',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 700,
          marginBottom: '16px'
        }}>
          {copyFeedback}
        </div>
      )}

      {/* ─── PANEL CAKUPAN BUKTI & KESIAPAN KASUS (SPRINT 3 - P1) ─── */}
      <div className="steel-chassis-card" style={{ marginBottom: '20px', position: 'relative' }}>
        <span className="bolt-tl" />
        <span className="bolt-tr" />
        <span className="bolt-bl" />
        <span className="bolt-br" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={16} color="#D4AF37" />
            <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '1px', color: '#F1F5F9', fontFamily: 'var(--font-mono)' }}>
              CAKUPAN BUKTI & KESIAPAN KASUS (INVESTIGATION COVERAGE & READINESS)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', color: '#64748B', fontFamily: 'var(--font-mono)' }}>STATUS KESIAPAN:</span>
            <span style={{
              fontSize: '10px',
              fontWeight: 800,
              padding: '3px 10px',
              borderRadius: '4px',
              letterSpacing: '0.8px',
              background: coverageSummary.readinessStatus === 'READY_FOR_ANALYST_CONCLUSION' ? 'rgba(16, 185, 129, 0.15)' :
                coverageSummary.readinessStatus === 'CONCLUDED_BY_ANALYST' ? 'rgba(56, 189, 248, 0.15)' :
                coverageSummary.readinessStatus === 'CONFLICTS_UNRESOLVED' ? 'rgba(239, 68, 68, 0.15)' :
                coverageSummary.readinessStatus === 'EVIDENCE_REVIEW_REQUIRED' ? 'rgba(212, 175, 55, 0.15)' :
                'rgba(148, 163, 184, 0.15)',
              color: coverageSummary.readinessStatus === 'READY_FOR_ANALYST_CONCLUSION' ? '#34D399' :
                coverageSummary.readinessStatus === 'CONCLUDED_BY_ANALYST' ? '#38BDF8' :
                coverageSummary.readinessStatus === 'CONFLICTS_UNRESOLVED' ? '#F87171' :
                coverageSummary.readinessStatus === 'EVIDENCE_REVIEW_REQUIRED' ? '#D4AF37' :
                '#94A3B8',
              border: `1px solid ${
                coverageSummary.readinessStatus === 'READY_FOR_ANALYST_CONCLUSION' ? '#10B981' :
                coverageSummary.readinessStatus === 'CONCLUDED_BY_ANALYST' ? '#38BDF8' :
                coverageSummary.readinessStatus === 'CONFLICTS_UNRESOLVED' ? '#EF4444' :
                coverageSummary.readinessStatus === 'EVIDENCE_REVIEW_REQUIRED' ? '#D4AF37' :
                '#64748B'
              }`
            }}>
              {coverageSummary.readinessStatus}
            </span>
          </div>
        </div>

        {/* Alasan Status */}
        <p style={{ fontSize: '11px', color: '#CBD5E1', margin: '0 0 14px 0', lineHeight: 1.5 }}>
          {coverageSummary.readinessReason}
        </p>

        {/* 4 Indikator Terukur (Numerator / Denominator Transparan) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          {coverageSummary.indicators.map((ind, idx) => (
            <div key={idx} style={{ background: '#0F172A', padding: '10px 12px', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600 }}>{ind.label}</span>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: ind.status === 'COMPLETE' ? '#34D399' : '#D4AF37' }}>
                  {ind.current}/{ind.total} ({ind.percentage}%)
                </span>
              </div>
              <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                  width: `${ind.percentage}%`,
                  height: '100%',
                  background: ind.status === 'COMPLETE' ? '#10B981' : ind.status === 'ATTENTION' ? '#D4AF37' : '#64748B',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <div style={{ fontSize: '9px', color: '#64748B', marginTop: '4px' }}>
                {ind.details}
              </div>
            </div>
          ))}
        </div>

        {/* Tindakan Terarah (Suggested Actions) */}
        {coverageSummary.suggestedActions.length > 0 && (
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '10px 14px', borderRadius: '4px', borderLeft: '3px solid #D4AF37', marginBottom: '14px' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: '#D4AF37', letterSpacing: '0.8px', marginBottom: '6px' }}>
              REKOMENDASI TINDAKAN TERARAH (DETERMINISTIC NEXT ACTIONS):
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {coverageSummary.suggestedActions.slice(0, 3).map((act, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '11px', color: '#CBD5E1' }}>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: '3px',
                    background: act.priority === 'HIGH' ? 'rgba(239, 68, 68, 0.2)' : act.priority === 'MEDIUM' ? 'rgba(212, 175, 55, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                    color: act.priority === 'HIGH' ? '#F87171' : act.priority === 'MEDIUM' ? '#D4AF37' : '#94A3B8',
                    flexShrink: 0
                  }}>
                    {act.priority}
                  </span>
                  <div>
                    <strong>{act.description}</strong>
                    <span style={{ fontSize: '10px', color: '#64748B', marginLeft: '6px' }}>({act.ruleExplanation})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Toolbar Operasional Terpadu (Sprint 3 Command Strip) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '12px' }}>
          <button
            type="button"
            onClick={() => {
              if (!activeDraft && responseDrafts.length === 0) {
                handleGenerateDraft('INSTITUTIONAL_PRESS')
              }
              setIsResponseDrawerOpen(true)
            }}
            style={{
              background: '#D4AF37',
              color: '#0F172A',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <MessageSquare size={13} />
            <span>Draf Tanggapan Berbasis Bukti ({responseDrafts.length})</span>
          </button>

          <button
            type="button"
            onClick={handleOpenReplay}
            style={{
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              color: '#38BDF8',
              padding: '6px 12px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Play size={13} />
            <span>Scenario Replay Kasus</span>
          </button>

          <button
            type="button"
            onClick={handleReverifyHashes}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#CBD5E1',
              padding: '6px 12px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Verifikasi ulang seluruh digest hash berkas bukti lokal"
          >
            <RefreshCw size={12} />
            <span>Verifikasi Ulang Hash</span>
          </button>

          <button
            type="button"
            onClick={handleExportCasePackage}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#CBD5E1',
              padding: '6px 12px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Ekspor seluruh paket kasus (bukti, klaim, relasi, asesmen, draf, audit) ke JSON lokal"
          >
            <Download size={12} />
            <span>Ekspor Paket Kasus</span>
          </button>

          <button
            type="button"
            onClick={() => casePackageInputRef.current?.click()}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#CBD5E1',
              padding: '6px 12px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Impor paket kasus JSON dari cadangan lokal"
          >
            <Upload size={12} />
            <span>Impor Paket Kasus</span>
          </button>
          <input
            ref={casePackageInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImportCasePackage}
          />

          {(activeCase.status === 'REVIEWED' || (activeCase.status as string) === 'CONCLUDED' || activeCase.status === 'ARCHIVED') && (
            <button
              type="button"
              onClick={() => setIsReopenModalOpen(true)}
              style={{
                background: 'rgba(212, 175, 55, 0.15)',
                border: '1px solid #D4AF37',
                color: '#D4AF37',
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RotateCcw size={12} />
              <span>Buka Kembali Kasus</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsDeleteCaseModalOpen(true)}
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#F87171',
              padding: '6px 12px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Trash2 size={12} />
            <span>Hapus Kasus</span>
          </button>
        </div>

        {reverifySummary && (
          <div style={{
            marginTop: '10px',
            padding: '8px 12px',
            borderRadius: '4px',
            background: reverifySummary.warningCount > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            border: `1px solid ${reverifySummary.warningCount > 0 ? '#EF4444' : '#10B981'}`,
            color: reverifySummary.warningCount > 0 ? '#F87171' : '#34D399',
            fontSize: '11px',
            fontWeight: 700
          }}>
            Hasil Uji Integritas Hash: {reverifySummary.verifiedCount} berkas bukti terverifikasi cocok, {reverifySummary.warningCount} berkas mengalami anomali hash.
          </div>
        )}
      </div>

      {/* ─── GRID UTAMA WORKBENCH: 2 KOLOM TAKTIS ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: '20px' }}>
        
        {/* ══════════ KOLOM KIRI: INGESTION, CLAIMS & PROVENANCE LEDGER ══════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* ── PANEL 1: SECURE EVIDENCE INGESTION CONSOLE (D3 & G0.5) ── */}
          <div className="steel-chassis-card" style={{ position: 'relative' }}>
            <span className="bolt-tl" />
            <span className="bolt-tr" />
            <span className="bolt-bl" />
            <span className="bolt-br" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={15} color="#D4AF37" />
                <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '1px', color: '#F1F5F9', fontFamily: 'var(--font-mono)' }}>
                  PORTAL PEMASUKAN BUKTI LOKAL (SECURE INGESTION)
                </span>
              </div>
              <span style={{ fontSize: '10px', color: '#64748B' }}>Local-First • Anti-SSRF • UU PDP</span>
            </div>

            {/* Tab Ingestion */}
            <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '8px', marginBottom: '14px' }}>
              {(['TEXT', 'FILE', 'URL', 'PRESET'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setIngestTab(tab)}
                  style={{
                    background: ingestTab === tab ? '#D4AF37' : 'rgba(255, 255, 255, 0.05)',
                    color: ingestTab === tab ? '#0F172A' : '#94A3B8',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '5px 12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {tab === 'TEXT' ? 'Teks Langsung' : tab === 'FILE' ? 'Unggah Berkas' : tab === 'URL' ? 'Referensi URL' : 'Benchmark Sintetis'}
                </button>
              ))}
            </div>

            {/* TAB CONTENT: TEKS */}
            {ingestTab === 'TEXT' && (
              <div>
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="Tempelkan naskah konten narasi, teks komentar publik, atau transkrip percakapan lapangan..."
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  style={{ width: '100%', fontSize: '12px', resize: 'vertical' }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Label Sumber (contoh: Tangkapan Layar WA Warga)"
                    value={textSourceLabel}
                    onChange={e => setTextSourceLabel(e.target.value)}
                    style={{ fontSize: '11px' }}
                  />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Stempel Waktu Sumber ISO 8601 (opsional)"
                    value={textTimestamp}
                    onChange={e => setTextTimestamp(e.target.value)}
                    style={{ fontSize: '11px' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                  <span style={{ fontSize: '10px', color: '#64748B' }}>
                    {textTimestamp ? 'Stempel waktu dimasukkan analis (OPERATOR_SUPPLIED_UNVERIFIED)' : 'Tanpa stempel waktu (NO_SOURCE_TIMESTAMP)'}
                  </span>
                  <button
                    type="button"
                    onClick={handleIngestText}
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
                    + Simpan Bukti Teks
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT: BERKAS */}
            {ingestTab === 'FILE' && (
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
                    Klik atau Tarik Berkas ke Sini untuk Memvalidasi Magic Bytes
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '4px' }}>
                    Format Sah: TXT, CSV, JSON, PNG, JPEG, WebP, PDF • Maks 10MB • Tolak Executable/Scripts
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.csv,.json,.png,.jpg,.jpeg,.webp,.pdf"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                </div>

                {/* Staged File Preview */}
                {stagedFile && fileValidation?.isValid && (
                  <div style={{ marginTop: '12px', background: '#0F172A', padding: '12px', borderRadius: '6px', border: '1px solid #10B981' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#34D399' }}>
                        ✓ Berkas Lolos Validasi Signature ({fileValidation.detectedType})
                      </span>
                      <span style={{ fontSize: '10px', color: '#94A3B8' }}>{(stagedFile.bytes.length / 1024).toFixed(1)} KB</span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#CBD5E1', fontFamily: 'monospace', marginBottom: '8px' }}>
                      SHA-256 Original: {fileValidation.originalByteSha256?.slice(0, 24)}...
                    </div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', maxHeight: '60px', overflowY: 'auto', background: '#1E293B', padding: '6px', borderRadius: '4px' }}>
                      {stagedFile.textContent.slice(0, 160)}...
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                      <button
                        type="button"
                        onClick={handleConfirmFileIngest}
                        style={{
                          background: '#10B981',
                          color: '#0F172A',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 14px',
                          fontSize: '11px',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        Konfirmasi & Simpan Berkas
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: URL */}
            {ingestTab === 'URL' && (
              <div>
                <input
                  type="text"
                  className="form-control"
                  placeholder="https://contoh-portal-berita.id/berita/isu-pertahanan..."
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  style={{ width: '100%', fontSize: '12px', marginBottom: '8px' }}
                />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Nama Portal / Label Sumber Referensi"
                  value={urlSourceLabel}
                  onChange={e => setUrlSourceLabel(e.target.value)}
                  style={{ width: '100%', fontSize: '11px', marginBottom: '10px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', color: '#64748B' }}>
                    Anti-SSRF Aktif: Hanya menyimpan tautan referensi publik (tanpa scraping browser).
                  </span>
                  <button
                    type="button"
                    onClick={handleIngestUrl}
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
                    + Simpan Referensi URL
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT: PRESETS */}
            {ingestTab === 'PRESET' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {SYNTHETIC_BENCHMARKS.map(bm => (
                  <div
                    key={bm.id}
                    onClick={() => handleSwitchToBenchmark(bm)}
                    style={{
                      background: activeCase.title === bm.claimTitle ? 'rgba(212, 175, 55, 0.15)' : '#0F172A',
                      border: `1px solid ${activeCase.title === bm.claimTitle ? '#D4AF37' : 'rgba(255, 255, 255, 0.1)'}`,
                      padding: '10px',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontSize: '10px', fontWeight: 800, color: '#D4AF37', marginBottom: '4px' }}>
                      {bm.shortLabel}
                    </div>
                    <div style={{ fontSize: '10px', color: '#94A3B8', lineHeight: 1.4 }}>
                      {bm.syntheticRecords.length} record sintetis terkontrol
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Notifikasi Ingest */}
            {ingestSuccessMsg && (
              <div style={{ marginTop: '10px', padding: '6px 10px', background: 'rgba(16, 185, 129, 0.15)', color: '#34D399', fontSize: '11px', borderRadius: '4px' }}>
                ✓ {ingestSuccessMsg}
              </div>
            )}
            {ingestErrorMsg && (
              <div style={{ marginTop: '10px', padding: '6px 10px', background: 'rgba(239, 68, 68, 0.15)', color: '#F87171', fontSize: '11px', borderRadius: '4px' }}>
                ⚠ {ingestErrorMsg}
              </div>
            )}
          </div>

          {/* ── PANEL 2: CLAIM MANAGEMENT & REVIEW LIST (D5) ── */}
          <div className="steel-chassis-card" style={{ position: 'relative' }}>
            <span className="bolt-tl" />
            <span className="bolt-tr" />
            <span className="bolt-bl" />
            <span className="bolt-br" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={15} color="#D4AF37" />
                <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '1px', color: '#F1F5F9', fontFamily: 'var(--font-mono)' }}>
                  DAFTAR KLAIM ATOMIK & PENELAAHAN STATUS (D5)
                </span>
              </div>
              <span style={{ fontSize: '10px', color: '#64748B' }}>Claim vs Publication Firewall</span>
            </div>

            {/* Form Tambah Klaim Baru */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Rumuskan klaim spesifik yang akan diuji (contoh: Alutsista TNI AL dinyatakan tidak beroperasi)..."
                value={newClaimText}
                onChange={e => setNewClaimText(e.target.value)}
                style={{ flex: 1, fontSize: '11px' }}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateNewClaim() }}
              />
              <button
                type="button"
                onClick={handleCreateNewClaim}
                style={{
                  background: 'linear-gradient(135deg, #1E293B, #0F172A)',
                  border: '1px solid #D4AF37',
                  color: '#D4AF37',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                + Klaim
              </button>
            </div>

            {/* Daftar Klaim yang Terdaftar */}
            {claimsList.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748B', fontSize: '12px' }}>
                Belum ada klaim atomik terdaftar dalam berkas kasus ini.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {claimsList.map(c => {
                  const assess = assessmentsList.find(a => a.claimId === c.id)
                  const verdict = assess?.verdict || 'UNVERIFIED'
                  const related = relationsList.filter(r => r.claimId === c.id)
                  const suppCount = related.filter(r => r.relationType === 'SUPPORTS').length
                  const contCount = related.filter(r => r.relationType === 'CONTRADICTS').length

                  return (
                    <div
                      key={c.id}
                      style={{
                        background: '#0F172A',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        padding: '12px 14px',
                        borderRadius: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: '240px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#F8FAFC', marginBottom: '4px' }}>
                          "{c.claimText}"
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', color: '#64748B' }}>
                          <span style={{ fontFamily: 'monospace' }}>{c.id}</span>
                          <span>•</span>
                          <span style={{ color: '#10B981' }}>{suppCount} Bukti Dukung</span>
                          <span>•</span>
                          <span style={{ color: '#EF4444' }}>{contCount} Bukti Bantah</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* Status Vonis Klaim */}
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: verdict === 'CONTRADICTED' ? 'rgba(239, 68, 68, 0.2)' : verdict === 'SUPPORTED' ? 'rgba(16, 185, 129, 0.2)' : verdict === 'MIXED' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                          color: verdict === 'CONTRADICTED' ? '#F87171' : verdict === 'SUPPORTED' ? '#34D399' : verdict === 'MIXED' ? '#FBBF24' : '#94A3B8',
                          border: '1px solid currentColor'
                        }}>
                          {verdict}
                        </span>

                        {/* Tombol Buka Telaah Klaim */}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveClaimId(c.id)
                            setSelectedVerdict(verdict)
                            setIsClaimDrawerOpen(true)
                          }}
                          style={{
                            background: '#1E293B',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            color: '#F1F5F9',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Sliders size={12} color="#D4AF37" />
                          <span>Telaah Bukti</span>
                        </button>

                        {/* Tombol Why Narada Thinks So */}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveWhyClaim(c)
                            setIsWhyDrawerOpen(true)
                          }}
                          style={{
                            background: 'rgba(212, 175, 55, 0.1)',
                            border: '1px solid rgba(212, 175, 55, 0.3)',
                            color: '#D4AF37',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Buka transparansi penjelasan Why NARADA Thinks So"
                        >
                          <HelpCircle size={12} />
                          <span>Why</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── PANEL 3: EVIDENCE PROVENANCE & INTEGRITY LEDGER (D4) ── */}
          <div className="steel-chassis-card" style={{ position: 'relative' }}>
            <span className="bolt-tl" />
            <span className="bolt-tr" />
            <span className="bolt-bl" />
            <span className="bolt-br" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={15} color="#D4AF37" />
                <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '1px', color: '#F1F5F9', fontFamily: 'var(--font-mono)' }}>
                  LEDGER BUKTI DIGITAL & INTEGRITAS HASH (D4)
                </span>
              </div>
              <span style={{ fontSize: '10px', color: '#64748B' }}>SHA-256 Byte Snapshot</span>
            </div>

            {evidenceList.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748B', fontSize: '12px' }}>
                Belum ada rekaman bukti digital tersimpan dalam kasus ini.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#0F172A', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94A3B8' }}>
                      <th style={{ padding: '8px' }}>ID BUKTI</th>
                      <th style={{ padding: '8px' }}>TIPE & SUMBER</th>
                      <th style={{ padding: '8px' }}>PROVENANCE WAKTU</th>
                      <th style={{ padding: '8px' }}>KONTEN (REDAKSI)</th>
                      <th style={{ padding: '8px' }}>HASH SHA-256</th>
                      <th style={{ padding: '8px', width: '40px' }}>AKSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evidenceList.map(ev => (
                      <tr key={ev.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '8px', fontFamily: 'monospace', color: '#D4AF37', verticalAlign: 'top' }}>
                          {ev.id}
                        </td>
                        <td style={{ padding: '8px', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 700, color: '#F1F5F9' }}>{ev.sourceLabel}</div>
                          <div style={{ fontSize: '9px', color: '#64748B' }}>{ev.evidenceType}</div>
                        </td>
                        <td style={{ padding: '8px', verticalAlign: 'top' }}>
                          <span style={{
                            fontSize: '9px',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            background: ev.sourceTimestampProvenance === 'SOURCE_REPORTED_TIMESTAMP' ? 'rgba(16, 185, 129, 0.15)' : ev.sourceTimestampProvenance === 'SYNTHETIC_BENCHMARK_TIMESTAMP' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                            color: ev.sourceTimestampProvenance === 'SOURCE_REPORTED_TIMESTAMP' ? '#34D399' : ev.sourceTimestampProvenance === 'SYNTHETIC_BENCHMARK_TIMESTAMP' ? '#FBBF24' : '#94A3B8'
                          }}>
                            {ev.sourceTimestampProvenance}
                          </span>
                        </td>
                        <td style={{ padding: '8px', verticalAlign: 'top', maxWidth: '240px', color: '#CBD5E1' }}>
                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ev.redactedText || ev.extractedText}
                          </div>
                        </td>
                        <td style={{ padding: '8px', verticalAlign: 'top', fontFamily: 'monospace', fontSize: '9px', color: '#64748B' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>{ev.contentHashNormalized.slice(0, 12)}...</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(ev.contentHashNormalized)
                                triggerCopyFeedback(`Hash ${ev.id} disalin ke clipboard!`)
                              }}
                              style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0 }}
                              title="Salin Hash Lengkap"
                            >
                              <Copy size={11} />
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '8px', verticalAlign: 'top' }}>
                          <button
                            type="button"
                            onClick={() => setEvidenceToDelete(ev.id)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#F87171',
                              cursor: 'pointer',
                              padding: '3px 6px',
                              borderRadius: '3px'
                            }}
                            title="Hapus berkas bukti ini"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ══════════ KOLOM KANAN: ANALISIS NARATIF, TEMPORAL & GRAF ══════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* ── PANEL 4: NARRATIVE SIMILARITY PROFILE (D6 - BER-DENOMINATOR JUJUR) ── */}
          <div className="steel-chassis-card" style={{ position: 'relative' }}>
            <span className="bolt-tl" />
            <span className="bolt-tr" />
            <span className="bolt-bl" />
            <span className="bolt-br" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={15} color="#D4AF37" />
                <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '1px', color: '#F1F5F9', fontFamily: 'var(--font-mono)' }}>
                  PROFIL KEMIRIPAN TEKS (NARRATIVE SIMILARITY)
                </span>
              </div>
              <span style={{ fontSize: '10px', color: '#64748B' }}>Jaccard N-Gram • Tanpa Vonis Aktor</span>
            </div>

            {/* 3 Metric Cards: Near Duplicate, High Similarity, Distinct */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
              <div style={{ background: '#0F172A', padding: '12px 10px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <div style={{ fontSize: '9px', fontWeight: 800, color: '#F87171', letterSpacing: '0.8px' }}>NEAR DUPLICATE</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#F1F5F9', margin: '4px 0' }}>
                  {narrativeProfileResult.profile.nearDuplicatePercent}%
                </div>
                <div style={{ fontSize: '10px', color: '#64748B' }}>
                  {narrativeProfileResult.profile.nearDuplicateCount} dari {narrativeProfileResult.profile.totalAnalyzedRecords} sampel
                </div>
              </div>

              <div style={{ background: '#0F172A', padding: '12px 10px', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <div style={{ fontSize: '9px', fontWeight: 800, color: '#FBBF24', letterSpacing: '0.8px' }}>HIGH SIMILARITY</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#F1F5F9', margin: '4px 0' }}>
                  {narrativeProfileResult.profile.highSimilarityPercent}%
                </div>
                <div style={{ fontSize: '10px', color: '#64748B' }}>
                  {narrativeProfileResult.profile.highSimilarityCount} dari {narrativeProfileResult.profile.totalAnalyzedRecords} sampel
                </div>
              </div>

              <div style={{ background: '#0F172A', padding: '12px 10px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <div style={{ fontSize: '9px', fontWeight: 800, color: '#34D399', letterSpacing: '0.8px' }}>DISTINCT</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#F1F5F9', margin: '4px 0' }}>
                  {narrativeProfileResult.profile.distinctPercent}%
                </div>
                <div style={{ fontSize: '10px', color: '#64748B' }}>
                  {narrativeProfileResult.profile.distinctCount} dari {narrativeProfileResult.profile.totalAnalyzedRecords} sampel
                </div>
              </div>
            </div>

            {/* Denominator & Transparansi Statistik */}
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '10px', borderRadius: '4px', fontSize: '10px', color: '#94A3B8', lineHeight: 1.5 }}>
              <div><strong>Denominator:</strong> {narrativeProfileResult.profile.totalAnalyzedRecords} record dianalisis ({narrativeProfileResult.profile.totalPairsCompared} pasangan uji dikomparasikan).</div>
              <div><strong>Status Sampel:</strong> {narrativeProfileResult.profile.sampleSufficiencyState}</div>
              <div style={{ color: '#64748B', marginTop: '4px' }}>
                *Catatan Ilmiah: Kemiripan teks merefleksikan leksikon sampel masukan, bukan bukti keterlibatan akun botnet atau sindikat bayaran.
              </div>
            </div>
          </div>

          {/* ── PANEL 5: TEMPORAL VELOCITY & CADENCE ANALYSIS (D6.C) ── */}
          <div className="steel-chassis-card" style={{ position: 'relative' }}>
            <span className="bolt-tl" />
            <span className="bolt-tr" />
            <span className="bolt-bl" />
            <span className="bolt-br" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={15} color="#D4AF37" />
                <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '1px', color: '#F1F5F9', fontFamily: 'var(--font-mono)' }}>
                  ANALISIS KADENSI TEMPORAL & LAJU SEMBURAN
                </span>
              </div>
              <span style={{
                fontSize: '9px',
                padding: '2px 6px',
                borderRadius: '3px',
                background: temporalAnalysisResult.availability === 'AVAILABLE' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                color: temporalAnalysisResult.availability === 'AVAILABLE' ? '#34D399' : '#FBBF24'
              }}>
                {temporalAnalysisResult.availability}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div style={{ background: '#0F172A', padding: '12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '10px', color: '#64748B', marginBottom: '4px' }}>LAJU SEMBURAN (BURST VELOCITY)</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: temporalAnalysisResult.burstVelocityPerMinute !== null ? '#F1F5F9' : '#64748B' }}>
                  {temporalAnalysisResult.burstVelocityPerMinute !== null ? `${temporalAnalysisResult.burstVelocityPerMinute} rec/menit` : 'TIDAK TERSEDIA'}
                </div>
              </div>

              <div style={{ background: '#0F172A', padding: '12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '10px', color: '#64748B', marginBottom: '4px' }}>INTERVAL RATA-RATA</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: temporalAnalysisResult.averageIntervalSeconds !== null ? '#F1F5F9' : '#64748B' }}>
                  {temporalAnalysisResult.averageIntervalSeconds !== null ? `${temporalAnalysisResult.averageIntervalSeconds} detik` : 'TIDAK TERSEDIA'}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '10px', color: '#94A3B8', lineHeight: 1.5 }}>
              <div>Cakupan Stempel Waktu: <strong>{temporalAnalysisResult.sourceTimestampCoveragePercent}%</strong> ({temporalAnalysisResult.validTimestampCount} dari {temporalAnalysisResult.totalSampleCount} berkas)</div>
              {temporalAnalysisResult.limitations.map((lim, idx) => (
                <div key={idx} style={{ color: '#F59E0B', marginTop: '2px' }}>• {lim}</div>
              ))}
            </div>
          </div>

          {/* ── PANEL 6: NARRATIVE RELATIONSHIP GRAPH (D6.E) ── */}
          <div className="steel-chassis-card" style={{ position: 'relative' }}>
            <span className="bolt-tl" />
            <span className="bolt-tr" />
            <span className="bolt-bl" />
            <span className="bolt-br" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Share2 size={15} color="#D4AF37" />
                <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '1px', color: '#F1F5F9', fontFamily: 'var(--font-mono)' }}>
                  GRAF TOPOLOGI HUBUNGAN NARATIF & KLAIM
                </span>
              </div>
              <span style={{ fontSize: '10px', color: '#64748B' }}>{relationshipGraph.nodes.length} Simpul • {relationshipGraph.edges.length} Tautan</span>
            </div>

            {/* Interactive SVG Graph Viewer */}
            <div style={{
              background: '#0B111A',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              height: '240px',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="100%" height="100%" viewBox="0 0 500 240" style={{ pointerEvents: 'none' }}>
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#D4AF37" />
                  </marker>
                </defs>

                {/* Render Edges */}
                {relationshipGraph.edges.map((e, idx) => {
                  const x1 = 250
                  const y1 = 40
                  const x2 = 80 + (idx * 90) % 360
                  const y2 = 180
                  const color = e.type === 'SUPPORTS' ? '#10B981' : e.type === 'CONTRADICTS' ? '#EF4444' : '#D4AF37'

                  return (
                    <g key={e.id}>
                      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1.5" strokeDasharray={e.type === 'REFERENCES' ? '4 2' : 'none'} opacity={0.6} />
                    </g>
                  )
                })}

                {/* Center Node: Event Case */}
                <circle cx="250" cy="40" r="16" fill="#1E293B" stroke="#D4AF37" strokeWidth="2" />
                <text x="250" y="44" fill="#D4AF37" fontSize="9" fontWeight="bold" textAnchor="middle">KASUS</text>

                {/* Satellite Nodes */}
                {relationshipGraph.nodes.filter(n => n.type !== 'EVENT').slice(0, 6).map((n, idx) => {
                  const cx = 80 + (idx * 80)
                  const cy = 180
                  const fill = n.type === 'CLAIM' ? '#0F172A' : '#1E293B'
                  const stroke = n.type === 'CLAIM' ? '#38BDF8' : '#A78BFA'

                  return (
                    <g key={n.id}>
                      <circle cx={cx} cy={cy} r="12" fill={fill} stroke={stroke} strokeWidth="1.5" />
                      <text x={cx} y={cy + 3} fill="#F1F5F9" fontSize="8" textAnchor="middle">
                        {n.type === 'CLAIM' ? 'CLM' : 'EV'}
                      </text>
                      <text x={cx} y={cy + 22} fill="#94A3B8" fontSize="7" textAnchor="middle">
                        {n.label.slice(0, 10)}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* ─── DRAWER 1: CLAIM REVIEW & RELATION MAPPING (D5) ─── */}
      {isClaimDrawerOpen && activeClaim && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '540px',
          maxWidth: '92vw',
          background: '#0F172A',
          borderLeft: '2px solid #D4AF37',
          boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.8)',
          zIndex: 1000,
          padding: '24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={18} color="#D4AF37" />
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#F1F5F9', fontFamily: 'var(--font-mono)' }}>
                DRAWER PENELAAHAN KLAIM & RELASI BUKTI
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsClaimDrawerOpen(false)}
              style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '16px', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          {/* Info Klaim */}
          <div style={{ background: '#1E293B', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ fontSize: '10px', color: '#94A3B8', marginBottom: '2px' }}>KLAIM SEDANG DITELAAH:</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#F8FAFC' }}>"{activeClaim.claimText}"</div>
            <div style={{ fontSize: '10px', color: '#64748B', marginTop: '4px', fontFamily: 'monospace' }}>ID: {activeClaim.id}</div>
          </div>

          {/* Form Tautkan Bukti Baru ke Klaim Ini */}
          <div style={{ background: '#161F2E', padding: '14px', borderRadius: '6px', border: '1px solid rgba(212, 175, 55, 0.3)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#D4AF37', marginBottom: '8px' }}>
              + TAUTKAN RELASI BUKTI DIGITAL (SUPPORTS / CONTRADICTS)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <select
                className="form-control"
                value={selectedRelationEvidenceId}
                onChange={e => setSelectedRelationEvidenceId(e.target.value)}
                style={{ fontSize: '11px' }}
              >
                <option value="">-- Pilih Berkas Bukti Digital --</option>
                {evidenceList.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    [{ev.id}] {ev.sourceLabel} ({ev.evidenceType})
                  </option>
                ))}
              </select>

              <select
                className="form-control"
                value={selectedRelationType}
                onChange={e => setSelectedRelationType(e.target.value as EvidenceRelationType)}
                style={{ fontSize: '11px' }}
              >
                <option value="SUPPORTS">SUPPORTS (Mendukung Kebenaran Klaim)</option>
                <option value="CONTRADICTS">CONTRADICTS (Membantah / Sanggahan Klaim)</option>
                <option value="CONTEXTUALIZES">CONTEXTUALIZES (Konteks Latar Belakang)</option>
                <option value="REFERENCES">REFERENCES (Merujuk Klaim Terkait)</option>
              </select>

              <input
                type="text"
                className="form-control"
                placeholder="Alasan / Rationale Mengaitkan Bukti Ini..."
                value={relationRationale}
                onChange={e => setRelationRationale(e.target.value)}
                style={{ fontSize: '11px' }}
              />

              <button
                type="button"
                onClick={handleAddRelation}
                disabled={!selectedRelationEvidenceId}
                style={{
                  background: selectedRelationEvidenceId ? '#D4AF37' : '#334155',
                  color: selectedRelationEvidenceId ? '#0F172A' : '#94A3B8',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '7px 12px',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: selectedRelationEvidenceId ? 'pointer' : 'not-allowed',
                  marginTop: '4px'
                }}
              >
                Tautkan Bukti ke Klaim
              </button>
            </div>
          </div>

          {/* Form Keputusan Vonis Asesmen Klaim */}
          <div style={{ background: '#1E293B', padding: '14px', borderRadius: '6px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#F1F5F9', marginBottom: '8px' }}>
              REKAM PUTUSAN ASESMEN KLAIM (AUDIT TRAIL RECORD)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '10px' }}>
              {(['SUPPORTED', 'CONTRADICTED', 'MIXED', 'UNVERIFIED', 'INCONCLUSIVE'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setSelectedVerdict(v)}
                  style={{
                    background: selectedVerdict === v ? (v === 'SUPPORTED' ? '#10B981' : v === 'CONTRADICTED' ? '#EF4444' : '#F59E0B') : '#0F172A',
                    color: selectedVerdict === v ? '#0F172A' : '#94A3B8',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    padding: '6px 4px',
                    borderRadius: '4px',
                    fontSize: '9px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {v}
                </button>
              ))}
            </div>

            <textarea
              className="form-control"
              rows={3}
              placeholder="Alasan rasional analisis komando untuk penetapan vonis klaim ini..."
              value={assessmentRationale}
              onChange={e => setAssessmentRationale(e.target.value)}
              style={{ width: '100%', fontSize: '11px', marginBottom: '10px' }}
            />

            <button
              type="button"
              onClick={handleSaveAssessmentVerdict}
              style={{
                width: '100%',
                background: '#10B981',
                color: '#0F172A',
                border: 'none',
                borderRadius: '4px',
                padding: '8px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Simpan Vonis Asesmen Klaim
            </button>
          </div>
        </div>
      )}

      {/* ─── DRAWER 2: WHY NARADA THINKS SO (EXPLAINABILITY D7) ─── */}
      {isWhyDrawerOpen && activeWhyExplanation && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '540px',
          maxWidth: '92vw',
          background: '#0F172A',
          borderLeft: '2px solid #38BDF8',
          boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.8)',
          zIndex: 1000,
          padding: '24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HelpCircle size={18} color="#38BDF8" />
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#F1F5F9', fontFamily: 'var(--font-mono)' }}>
                WHY NARADA THINKS SO — TRANSPARANSI ASESMEN
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsWhyDrawerOpen(false)}
              style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '16px', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          <div style={{ background: '#1E293B', padding: '12px', borderRadius: '6px' }}>
            <div style={{ fontSize: '10px', color: '#38BDF8', fontWeight: 700 }}>KLAIM:</div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#F1F5F9', marginTop: '2px' }}>
              "{activeWhyExplanation.claimText}"
            </div>
            <div style={{ fontSize: '11px', color: '#34D399', fontWeight: 700, marginTop: '4px' }}>
              Status Saat Ini: {activeWhyExplanation.currentStatus}
            </div>
          </div>

          <div style={{ background: '#161F2E', padding: '12px', borderRadius: '6px', borderLeft: '3px solid #38BDF8' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#38BDF8', marginBottom: '4px' }}>
              1. APA YANG DIAMATI NARADA?
            </div>
            <div style={{ fontSize: '11px', color: '#CBD5E1', lineHeight: 1.5 }}>
              {activeWhyExplanation.conclusionSummary}
            </div>
          </div>

          <div style={{ background: '#161F2E', padding: '12px', borderRadius: '6px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#10B981', marginBottom: '4px' }}>
              2. BUKTI PENDUKUNG ({activeWhyExplanation.supportingEvidenceIds.length})
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>
              {activeWhyExplanation.supportingEvidenceIds.length === 0 ? 'Nol bukti pendukung tercatat.' : activeWhyExplanation.supportingEvidenceIds.join(', ')}
            </div>
          </div>

          <div style={{ background: '#161F2E', padding: '12px', borderRadius: '6px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#EF4444', marginBottom: '4px' }}>
              3. BUKTI BANTAHAN ({activeWhyExplanation.contradictingEvidenceIds.length})
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>
              {activeWhyExplanation.contradictingEvidenceIds.length === 0 ? 'Nol bukti bantahan tercatat.' : activeWhyExplanation.contradictingEvidenceIds.join(', ')}
            </div>
          </div>

          <div style={{ background: '#161F2E', padding: '12px', borderRadius: '6px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#F59E0B', marginBottom: '4px' }}>
              4. METODE & ALASAN ANALITIS
            </div>
            <div style={{ fontSize: '11px', color: '#CBD5E1', lineHeight: 1.5 }}>
              <div><strong>Metode:</strong> {activeWhyExplanation.methodUsed}</div>
              <div style={{ marginTop: '4px' }}><strong>Alasan:</strong> {activeWhyExplanation.rationale}</div>
            </div>
          </div>

          <div style={{ background: '#161F2E', padding: '12px', borderRadius: '6px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', marginBottom: '4px' }}>
              5. INFORMASI YANG BELUM TERSEDIA & ASUMSI
            </div>
            <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '10px', color: '#64748B' }}>
              {activeWhyExplanation.missingInformation.map((info, i) => (
                <li key={i}>{info}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ─── MODAL AUDIT LOG (APPEND-ONLY EVENT VIEWER) ─── */}
      {isAuditModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '20px'
        }}>
          <div style={{
            background: '#0F172A',
            border: '1px solid rgba(212, 175, 55, 0.4)',
            borderRadius: '8px',
            width: '640px',
            maxWidth: '100%',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={16} color="#D4AF37" />
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#F1F5F9', fontFamily: 'var(--font-mono)' }}>
                  RIWAYAT AUDIT TRAIL LOKAL ({auditEvents.length} Peristiwa)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '14px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {auditEvents.map(evt => (
                <div key={evt.eventId} style={{ background: '#1E293B', padding: '10px 12px', borderRadius: '4px', borderLeft: '3px solid #D4AF37', fontSize: '11px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', fontSize: '10px', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 700, color: '#D4AF37' }}>{evt.eventType}</span>
                    <span>{new Date(evt.timestamp).toLocaleString('id-ID')}</span>
                  </div>
                  <div style={{ color: '#F8FAFC', fontWeight: 600 }}>{evt.newState || evt.rationale}</div>
                  <div style={{ color: '#94A3B8', fontSize: '10px', marginTop: '2px' }}>
                    Operator: {evt.operatorLabel} • Entitas: {evt.entityType} ({evt.entityId})
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── DRAWER SPRINT 3: FORMULASI DRAF TANGGAPAN PUBLIK (PACKAGE 2) ─── */}
      {isResponseDrawerOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '580px',
          maxWidth: '92vw',
          background: '#0F172A',
          borderLeft: '2px solid #D4AF37',
          boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.8)',
          zIndex: 1050,
          padding: '24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={18} color="#D4AF37" />
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#F1F5F9', fontFamily: 'var(--font-mono)' }}>
                DRAF TANGGAPAN BERBASIS BUKTI (PACKAGE 2)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsResponseDrawerOpen(false)}
              style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '16px', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          {/* Banner Peringatan DRAFT — REQUIRES HUMAN REVIEW */}
          <div style={{
            padding: '10px 14px',
            background: 'rgba(212, 175, 55, 0.12)',
            border: '1px solid #D4AF37',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#FDE68A',
            lineHeight: 1.5
          }}>
            <strong>DRAFT — REQUIRES HUMAN REVIEW:</strong> Naskah ini adalah bahan pelurusan informasi publik berbasis bukti tertelusuri. Narada tidak menyediakan fitur publikasi otomatis atau broadcasting ke platform media sosial mana pun.
          </div>

          {/* Kanal Selector */}
          <div>
            <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 700, marginBottom: '6px' }}>
              PILIH KANAL FORMAT TANGGAPAN:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {([
                { key: 'INSTITUTIONAL_PRESS', label: 'Siaran Pers Resmi' },
                { key: 'COMMUNITY_DIALOGUE', label: 'Panduan Komsos / FAQ' },
                { key: 'SOCIAL_MEDIA_TACTICAL', label: 'Medsos Singkat (<280)' },
                { key: 'WHATSAPP_CIVILIAN', label: 'Literasi WA Komunitas' }
              ] as const).map(c => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => {
                    setSelectedChannel(c.key)
                    const existing = responseDrafts.find(d => d.channel === c.key)
                    if (existing) {
                      setActiveDraft(existing)
                      setEditedContent(existing.content)
                    }
                  }}
                  style={{
                    background: selectedChannel === c.key ? '#D4AF37' : '#1E293B',
                    color: selectedChannel === c.key ? '#0F172A' : '#CBD5E1',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '4px',
                    padding: '8px 10px',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => handleGenerateDraft(selectedChannel)}
              style={{
                background: '#10B981',
                color: '#0F172A',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              + Formulasikan Draf Baru ({selectedChannel})
            </button>

            {activeDraft && (
              <span style={{
                fontSize: '10px',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: '4px',
                background: activeDraft.status === 'APPROVED_BY_REVIEWER' ? 'rgba(16, 185, 129, 0.2)' :
                  activeDraft.status === 'REJECTED_BY_REVIEWER' ? 'rgba(239, 68, 68, 0.2)' :
                  'rgba(212, 175, 55, 0.2)',
                color: activeDraft.status === 'APPROVED_BY_REVIEWER' ? '#34D399' :
                  activeDraft.status === 'REJECTED_BY_REVIEWER' ? '#F87171' :
                  '#D4AF37',
                border: '1px solid currentColor'
              }}>
                {activeDraft.status} (v{activeDraft.version})
              </span>
            )}
          </div>

          {activeDraft ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Grounded Sentences Preview */}
              {activeDraft.groundedSentences.length > 0 && (
                <div style={{ background: '#161F2E', padding: '10px 12px', borderRadius: '4px', borderLeft: '3px solid #38BDF8' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#38BDF8', marginBottom: '4px' }}>
                    PEMETAAN KALIMAT KE BUKTI DIGITAL (GROUNDED MAPPING):
                  </div>
                  {activeDraft.groundedSentences.map((s, i) => (
                    <div key={i} style={{ fontSize: '10px', color: '#CBD5E1', marginBottom: '4px' }}>
                      • "{s.text}"
                      <div style={{ color: '#94A3B8', fontSize: '9px', marginLeft: '10px' }}>
                        ID Bukti Pendukung: <span style={{ fontFamily: 'monospace', color: '#D4AF37' }}>{s.supportingEvidenceIds.join(', ')}</span> ({s.sourceLabel})
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Editor Teks Draf */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#F1F5F9' }}>
                    Naskah Draf ({activeDraft.channelLabel}):
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(editedContent)
                      triggerCopyFeedback('Naskah draf disalin ke clipboard.')
                    }}
                    style={{ background: 'none', border: 'none', color: '#D4AF37', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Copy size={11} /> Salin Naskah
                  </button>
                </div>
                <textarea
                  className="form-control"
                  rows={10}
                  value={editedContent}
                  onChange={e => setEditedContent(e.target.value)}
                  style={{ width: '100%', fontSize: '11px', fontFamily: 'monospace', lineHeight: 1.5 }}
                />
              </div>

              {/* Catatan Reviewer & Tombol Keputusan */}
              <div style={{ background: '#1E293B', padding: '12px', borderRadius: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '4px' }}>
                  CATATAN PENELAAH ANALIS:
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Tambahkan catatan evaluasi atau alasan persetujuan..."
                  value={reviewerNote}
                  onChange={e => setReviewerNote(e.target.value)}
                  style={{ width: '100%', fontSize: '11px', marginBottom: '10px' }}
                />

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleSaveEditedDraft(activeDraft.id)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#F1F5F9',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Simpan Perubahan
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApproveDraft(activeDraft.id)}
                    style={{
                      background: '#10B981',
                      color: '#0F172A',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Setujui (Approve)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRejectDraft(activeDraft.id)}
                    style={{
                      background: '#EF4444',
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Tolak (Reject)
                  </button>
                </div>
              </div>

              {/* Batasan dan Limitasi */}
              <div style={{ fontSize: '9px', color: '#64748B', lineHeight: 1.4 }}>
                <div style={{ fontWeight: 700, color: '#94A3B8', marginBottom: '2px' }}>LIMITASI & PERINGATAN:</div>
                {activeDraft.warningsAndLimitations.map((w, idx) => (
                  <div key={idx}>• {w}</div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748B', fontSize: '11px' }}>
              Belum ada draf tanggapan untuk kanal ini. Klik "+ Formulasikan Draf Baru" di atas.
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL SPRINT 3: SCENARIO REPLAY ENGINE (PACKAGE 3) ─── */}
      {isReplayModalOpen && replaySession && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.88)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1150,
          padding: '20px'
        }}>
          <div className="steel-chassis-card" style={{
            width: '840px',
            maxWidth: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <span className="bolt-tl" />
            <span className="bolt-tr" />
            <span className="bolt-bl" />
            <span className="bolt-br" />

            {/* Header Replay */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Play size={16} color="#38BDF8" />
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#F1F5F9', fontFamily: 'var(--font-mono)' }}>
                    SCENARIO REPLAY INVESTIGASI KASUS ({replaySession.mode})
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
                  Kronologi Deterministik Jejak Audit Lokal • Read-Only • Zero Network Fetch
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {replaySession.watermark && (
                  <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', padding: '2px 8px', background: 'rgba(245, 158, 11, 0.2)', color: '#FBBF24', border: '1px solid #F59E0B', borderRadius: '3px', fontWeight: 800 }}>
                    {replaySession.watermark}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setReplaySession(null)
                    setIsReplayModalOpen(false)
                  }}
                  style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '16px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Kontrol Player Replay */}
            <div style={{ padding: '16px 20px', background: '#0B111A', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setReplaySession(prev => prev ? jumpToStep(prev, 0) : null)}
                    style={{ background: '#1E293B', border: 'none', color: '#CBD5E1', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer' }}
                    title="Awal"
                  >
                    <SkipBack size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplaySession(prev => prev ? stepBackward(prev) : null)}
                    style={{ background: '#1E293B', border: 'none', color: '#CBD5E1', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer' }}
                    title="Mundur Satu Langkah"
                  >
                    &lt;
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplaySession(prev => prev ? setPlaybackState(prev, prev.playbackState === 'PLAYING' ? 'PAUSED' : 'PLAYING') : null)}
                    style={{ background: '#38BDF8', border: 'none', color: '#0F172A', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {replaySession.playbackState === 'PLAYING' ? <Pause size={13} /> : <Play size={13} />}
                    <span>{replaySession.playbackState === 'PLAYING' ? 'Jeda' : 'Putar'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplaySession(prev => prev ? stepForward(prev) : null)}
                    style={{ background: '#1E293B', border: 'none', color: '#CBD5E1', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer' }}
                    title="Maju Satu Langkah"
                  >
                    &gt;
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplaySession(prev => prev ? jumpToStep(prev, prev.totalEvents - 1) : null)}
                    style={{ background: '#1E293B', border: 'none', color: '#CBD5E1', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer' }}
                    title="Akhir"
                  >
                    <SkipForward size={13} />
                  </button>
                </div>

                {/* Scrubber slider */}
                <div style={{ flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, replaySession.totalEvents - 1)}
                    value={replaySession.currentStepIndex >= 0 ? replaySession.currentStepIndex : 0}
                    onChange={e => {
                      const idx = parseInt(e.target.value, 10)
                      setReplaySession(prev => prev ? jumpToStep(prev, idx) : null)
                    }}
                    style={{ flex: 1, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#94A3B8' }}>
                    {replaySession.currentStepIndex + 1}/{replaySession.totalEvents}
                  </span>
                </div>

                {/* Speed selector & filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {([1, 2, 4] as const).map(spd => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setReplaySession(prev => prev ? setPlaybackSpeed(prev, spd) : null)}
                      style={{
                        background: replaySession.playbackSpeed === spd ? '#38BDF8' : '#1E293B',
                        color: replaySession.playbackSpeed === spd ? '#0F172A' : '#94A3B8',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: '3px',
                        fontSize: '9px',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      {spd}x
                    </button>
                  ))}

                  <select
                    value={replayFilter}
                    onChange={e => {
                      const flt = e.target.value
                      setReplayFilter(flt)
                      const sess = buildScenarioReplaySession(activeCase.id, { eventFilter: flt, playbackSpeed: replaySession.playbackSpeed })
                      setReplaySession(sess)
                    }}
                    style={{
                      background: '#1E293B',
                      color: '#CBD5E1',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      fontSize: '10px',
                      padding: '3px 6px',
                      borderRadius: '3px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="ALL">Filter: Semua Event</option>
                    <option value="EVIDENCE">Hanya Bukti</option>
                    <option value="CLAIM">Hanya Klaim</option>
                    <option value="ASSESSMENT">Hanya Asesmen</option>
                    <option value="DRAFT">Hanya Draf</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Event Detail Box */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {replaySession.events.length > 0 && replaySession.currentStepIndex >= 0 ? (() => {
                const currentEvt = replaySession.events[replaySession.currentStepIndex]
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ background: '#1E293B', padding: '14px', borderRadius: '6px', borderLeft: '4px solid #38BDF8' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, color: '#38BDF8', letterSpacing: '0.8px' }}>
                          LANGKAH #{replaySession.currentStepIndex + 1}: {currentEvt.eventType}
                        </span>
                        <span style={{ fontSize: '10px', color: '#94A3B8' }}>
                          Aktor: <strong>{currentEvt.actorLabel}</strong>
                        </span>
                      </div>

                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#F1F5F9', marginBottom: '6px' }}>
                        {currentEvt.title}
                      </div>

                      <div style={{ fontSize: '12px', color: '#CBD5E1', lineHeight: 1.5, marginBottom: '10px' }}>
                        {currentEvt.summary}
                      </div>

                      {/* Dual-Timestamp Provenance (Sprint 3 Semantics) */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#0F172A', padding: '10px 12px', borderRadius: '4px', fontSize: '10px' }}>
                        <div>
                          <div style={{ color: '#64748B', fontWeight: 700 }}>WAKTU AKSI LOKAL (caseEventAt):</div>
                          <div style={{ color: '#38BDF8', fontFamily: 'monospace', fontWeight: 700, marginTop: '2px' }}>
                            {new Date(currentEvt.caseEventAt).toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#64748B', fontWeight: 700 }}>WAKTU PUBLIKASI SUMBER (sourcePublishedAt):</div>
                          <div style={{ color: currentEvt.sourcePublishedAt ? '#34D399' : '#94A3B8', fontFamily: 'monospace', fontWeight: 700, marginTop: '2px' }}>
                            {currentEvt.sourcePublishedAt ? new Date(currentEvt.sourcePublishedAt).toLocaleString('id-ID') : 'Tidak Tersedia (Undated)'}
                          </div>
                        </div>
                      </div>

                      {currentEvt.referencedEvidenceIds && currentEvt.referencedEvidenceIds.length > 0 && (
                        <div style={{ marginTop: '8px', fontSize: '10px', color: '#94A3B8' }}>
                          ID Bukti Terkait: <span style={{ color: '#D4AF37', fontFamily: 'monospace' }}>{currentEvt.referencedEvidenceIds.join(', ')}</span>
                        </div>
                      )}
                    </div>

                    {/* Timeline List Bar */}
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748B' }}>
                      RIWAYAT EVENT BERURUTAN ({replaySession.events.length} Event):
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {replaySession.events.map((ev, i) => (
                        <div
                          key={ev.id}
                          onClick={() => setReplaySession(prev => prev ? jumpToStep(prev, i) : null)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '4px',
                            background: i === replaySession.currentStepIndex ? '#1E293B' : 'rgba(255, 255, 255, 0.02)',
                            borderLeft: i === replaySession.currentStepIndex ? '3px solid #38BDF8' : '3px solid transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '10px'
                          }}
                        >
                          <span style={{ color: i === replaySession.currentStepIndex ? '#38BDF8' : '#94A3B8', fontWeight: i === replaySession.currentStepIndex ? 700 : 500 }}>
                            #{i + 1} {ev.title}
                          </span>
                          <span style={{ color: '#64748B', fontFamily: 'monospace' }}>
                            {new Date(ev.caseEventAt).toLocaleTimeString('id-ID')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })() : (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748B', fontSize: '12px' }}>
                  Tidak ada rekaman event pada filter ini.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL SPRINT 3: HAPUS BUKTI KASKADE (PACKAGE 4) ─── */}
      {evidenceToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          padding: '20px'
        }}>
          <div style={{ background: '#0F172A', border: '1px solid #EF4444', borderRadius: '6px', width: '420px', padding: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#F87171', marginBottom: '8px' }}>
              HAPUS BERKAS BUKTI DIGITAL?
            </div>
            <div style={{ fontSize: '11px', color: '#CBD5E1', lineHeight: 1.5, marginBottom: '16px' }}>
              Tindakan ini akan menghapus berkas bukti <strong>{evidenceToDelete}</strong> beserta seluruh relasi bukti-klaim dan digest hash terkait secara kaskade. Tindakan tidak dapat dibatalkan.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setEvidenceToDelete(null)}
                style={{ background: '#1E293B', border: 'none', color: '#CBD5E1', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDeleteEvidence(evidenceToDelete)}
                style={{ background: '#EF4444', border: 'none', color: '#FFFFFF', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
              >
                Ya, Hapus Bukti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL SPRINT 3: HAPUS KASUS (PACKAGE 4) ─── */}
      {isDeleteCaseModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          padding: '20px'
        }}>
          <div style={{ background: '#0F172A', border: '1px solid #EF4444', borderRadius: '6px', width: '450px', padding: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#F87171', marginBottom: '8px' }}>
              HAPUS SELURUH KASUS INVESTIGASI?
            </div>
            <div style={{ fontSize: '11px', color: '#CBD5E1', lineHeight: 1.5, marginBottom: '16px' }}>
              Apakah Anda yakin ingin menghapus kasus <strong>{activeCase.caseNumber}</strong> ("{activeCase.title}")? Seluruh berkas bukti, klaim, relasi, asesmen, draf tanggapan, dan jejak audit akan dihapus secara permanen.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setIsDeleteCaseModalOpen(false)}
                style={{ background: '#1E293B', border: 'none', color: '#CBD5E1', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteCase}
                style={{ background: '#EF4444', border: 'none', color: '#FFFFFF', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
              >
                Hapus Kasus Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL SPRINT 3: BUKA KEMBALI KASUS (PACKAGE 4) ─── */}
      {isReopenModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          padding: '20px'
        }}>
          <div style={{ background: '#0F172A', border: '1px solid #D4AF37', borderRadius: '6px', width: '450px', padding: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#D4AF37', marginBottom: '8px' }}>
              BUKA KEMBALI KASUS INVESTIGASI (REOPEN CASE)
            </div>
            <div style={{ fontSize: '11px', color: '#CBD5E1', lineHeight: 1.5, marginBottom: '12px' }}>
              Kasus <strong>{activeCase.caseNumber}</strong> akan dialihkan kembali ke status <strong>UNDER_REVIEW</strong> untuk memungkinkan penambahan bukti atau penelaahan ulang klaim.
            </div>
            <textarea
              className="form-control"
              rows={3}
              placeholder="Masukkan alasan rasional pembukaan kembali kasus (wajib untuk jejak audit)..."
              value={reopenRationale}
              onChange={e => setReopenRationale(e.target.value)}
              style={{ width: '100%', fontSize: '11px', marginBottom: '14px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setIsReopenModalOpen(false)}
                style={{ background: '#1E293B', border: 'none', color: '#CBD5E1', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleReopenCase}
                style={{ background: '#D4AF37', border: 'none', color: '#0F172A', padding: '6px 14px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
              >
                Buka Kembali Kasus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
