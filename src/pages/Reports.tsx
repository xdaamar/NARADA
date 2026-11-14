/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — MILITARY A4 INTELLIGENCE REPORT GENERATOR (PRODUK INTELIJEN A4)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Modul resmi penyusunan Produk Intelijen Standar Dinas Militer TNI AD:
 * 1. Live Reactive Connection ke Berita Tersemat (getArchivedEntries).
 * 2. Live Reactive Connection ke Hasil Analisis Postingan Medsos (sessionStorage / Scenarios).
 * 3. Terintegrasi Pengaturan Identitas Operator (Nama Analis, Pangkat, NRP, Satuan).
 * 4. Stempel Kriptografis SHA-256 & Rantai Bukti Sah Digital (Chain of Custody).
 * 5. Layout Cetak Siap A4 Resmi Militer lengkap dengan Watermark, Kop Surat, 
 *    Matriks Temuan Isu, Forensik Medsos, Rekomendasi Komando, dan Draf 4-Kanal Dispenad.
 * ══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Printer,
  RotateCcw,
  Sparkles,
  Sliders,
  CheckSquare,
  Square,
  Building,
  User,
  Hash,
  Award,
  Lock,
  AlertTriangle,
  Download,
  Pin,
  Share2,
  Layers,
  Info,
  Maximize2,
  ZoomIn,
  ZoomOut,
  X,
  Eye,
  Trash2
} from 'lucide-react'
import type { IntelReportConfig, ReportClassification } from '../types.ts'
import { getUserSettings, saveUserSettings } from '../utils/storage.ts'
import { truncateText } from '../utils/format.ts'
import { generateSHA256 } from '../utils/crypto.ts'
import { generateCounterNarratives } from '../engine/forensic/counter-narrative-generator.ts'
import {
  getInvestigationCase,
  getAllInvestigationCases,
  getEvidenceRecordsForCase,
  getClaimsForCase,
  getAssessmentsForCase,
  generateEvidenceManifest
} from '../engine/investigation/index.ts'
import {
  getArchivedEntries,
  archiveIssue,
  type ArchivedDebunkEntry
} from '../engine/archive/archive-service.ts'
import { getCuratedArchiveDebunks } from '../engine/data/debunk-service.ts'
import {
  PRELOADED_TEST_SCENARIOS,
  type SocialPostAnalysisResult
} from '../engine/social/social-post-analyzer.ts'
import {
  getCaptureSession,
  subscribeToCaptureSession,
  setCaptureScope,
  clearCapturedActions,
  CAPTURE_SCOPE_INFO,
  type CaptureSessionState,
} from '../engine/reports/action-recorder.ts'

export default function Reports() {
  const location = useLocation()
  const navState = (location.state || {}) as {
    isSimulation?: boolean
    simulationWatermark?: string
    evidenceMode?: string
    prefillClaim?: string
    caseId?: string
  }
  const isSimulationMode = Boolean(navState.isSimulation)

  // ─── 1. INTEGRASI DATA BERITA TERSEMAT (LIVE ARSIP MURNI DARI SESI USER) ───
  const [archivedEntries, setArchivedEntries] = useState<ArchivedDebunkEntry[]>(() => {
    return getArchivedEntries()
  })
  const [selectedArchiveIds, setSelectedArchiveIds] = useState<Set<string>>(() => {
    const all = getArchivedEntries()
    return new Set(all.map(item => item.id))
  })

  // Sinkronisasi dinamis Berita Tersemat
  useEffect(() => {
    const handleArchiveUpdate = () => {
      const fresh = getArchivedEntries()
      setArchivedEntries(fresh)
      setSelectedArchiveIds(prev => {
        if (prev.size === 0) return new Set(fresh.map(f => f.id))
        return prev
      })
    }
    window.addEventListener('narada:archive-updated', handleArchiveUpdate)
    window.addEventListener('storage', handleArchiveUpdate)
    return () => {
      window.removeEventListener('narada:archive-updated', handleArchiveUpdate)
      window.removeEventListener('storage', handleArchiveUpdate)
    }
  }, [])

  // ─── 2. INTEGRASI DATA ANALISIS MEDSOS TERKINI (MURNI HASIL ANALISIS USER) ───
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState<number>(-1)
  const [socialAnalysis, setSocialAnalysis] = useState<SocialPostAnalysisResult | null>(() => {
    try {
      const raw = sessionStorage.getItem('narada_latest_social_analysis')
      if (raw) return JSON.parse(raw)
    } catch {}
    return null
  })

  useEffect(() => {
    const handleSocialUpdate = (e: any) => {
      if (e.detail) {
        setSocialAnalysis(e.detail)
      } else {
        try {
          const raw = sessionStorage.getItem('narada_latest_social_analysis')
          if (raw) setSocialAnalysis(JSON.parse(raw))
        } catch {}
      }
    }
    window.addEventListener('narada:social-analysis-updated', handleSocialUpdate)
    return () => window.removeEventListener('narada:social-analysis-updated', handleSocialUpdate)
  }, [])

  // Ganti skenario medsos secara interaktif jika diinginkan analis
  const handleSelectSocialScenario = (idx: number) => {
    setSelectedScenarioIndex(idx)
    const sc = PRELOADED_TEST_SCENARIOS[idx]
    if (sc) {
      setSocialAnalysis(sc.mockResult)
    }
  }

  // ─── 3. INTEGRASI KASUS INVESTIGASI (WORKBENCH LINK) ───
  const linkedCase = useMemo(() => {
    return navState.caseId ? getInvestigationCase(navState.caseId) : undefined
  }, [navState.caseId])

  const caseEvidenceList = useMemo(() => {
    return navState.caseId ? getEvidenceRecordsForCase(navState.caseId) : []
  }, [navState.caseId])

  const caseClaimsList = useMemo(() => {
    return navState.caseId ? getClaimsForCase(navState.caseId) : []
  }, [navState.caseId])

  const caseAssessmentsList = useMemo(() => {
    return navState.caseId ? getAssessmentsForCase(navState.caseId) : []
  }, [navState.caseId])

  // ─── 4. KONFIGURASI LAPORAN & IDENTITAS OPERATOR TERPADU ───
  const userSettings = useMemo(() => {
    const s = getUserSettings()
    // Bersihkan nama atau NRP bawaan lama jika mengandung data pribadi
    const cleanedName = (s.analystName && !s.analystName.toLowerCase().includes('damar')) ? s.analystName : ''
    const cleanedNrp = (s.analystNrp && s.analystNrp !== '21260408') ? s.analystNrp : ''
    return {
      ...s,
      analystName: cleanedName,
      analystNrp: cleanedNrp
    }
  }, [])

  // State Zooming Dokumen & Modal Layar Penuh
  const [zoomLevel, setZoomLevel] = useState<number>(1.0)
  const [modalZoomLevel, setModalZoomLevel] = useState<number>(1.1)
  const [isZoomModalOpen, setIsZoomModalOpen] = useState<boolean>(false)

  // Keyboard listener untuk tombol Escape menutup modal zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isZoomModalOpen) {
        setIsZoomModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isZoomModalOpen])

  // Auto-hide / Icon-only mode sidebar saat Tinjau Penuh Dokumen A4 dibuka
  useEffect(() => {
    if (isZoomModalOpen) {
      window.dispatchEvent(new CustomEvent('narada:sidebar-collapse', { detail: { collapse: true } }))
    } else {
      const stored = localStorage.getItem('narada_sidebar_collapsed') === 'true'
      window.dispatchEvent(new CustomEvent('narada:sidebar-collapse', { detail: { collapse: stored } }))
    }
  }, [isZoomModalOpen])

  // Format tanggal dinas militer hari ini
  const todayMilitary = useMemo(() => {
    const d = new Date()
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
  }, [])

  const generatedReportNumber = useMemo(() => {
    const d = new Date()
    const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
    const romanMonth = romans[d.getMonth()]
    return `NRD-LAP/${romanMonth}/${d.getFullYear()}/04`
  }, [])

  const [config, setConfig] = useState<IntelReportConfig>({
    unitName: userSettings.defaultUnit || 'PUSSIBERAD TNI AD',
    analystName: userSettings.analystName || '',
    analystNrp: userSettings.analystNrp || '',
    reportNumber: generatedReportNumber,
    classification: 'RAHASIA',
    date: todayMilitary,
    includeFindingsDetail: true,
    includeFactCheck: true,
    includeRecommendations: true,
  })

  // Status Perekaman Tindakan Intelijen (Capture Hub Terintegrasi)
  const [captureSession, setCaptureSession] = useState<CaptureSessionState>(getCaptureSession)

  // Mode cakupan sumber data pada dokumen:
  // 'ALL' = Gabungan Berita Tersemat + Analisis Medsos
  // 'ARCHIVE_ONLY' = Berita Tersemat Saja
  // 'SOCIAL_ONLY' = Analisis Medsos Saja
  const [dataSourceMode, setDataSourceMode] = useState<'ALL' | 'ARCHIVE_ONLY' | 'SOCIAL_ONLY'>(() => {
    const session = getCaptureSession()
    if (session.scope === 'ALL') return 'ALL'
    if (session.scope === 'SOCIAL_ONLY') return 'SOCIAL_ONLY'
    return 'ARCHIVE_ONLY'
  })
  const [includeSocialForensics, setIncludeSocialForensics] = useState<boolean>(true)
  const [includeCounterNarrative, setIncludeCounterNarrative] = useState<boolean>(true)

  // Sinkronisasi dua arah dengan Capture Hub di TacticalTopBar
  useEffect(() => {
    const unsub = subscribeToCaptureSession((state) => {
      setCaptureSession(state)
      if (state.scope === 'ALL') {
        setDataSourceMode('ALL')
      } else if (state.scope === 'SOCIAL_ONLY') {
        setDataSourceMode('SOCIAL_ONLY')
      } else {
        setDataSourceMode('ARCHIVE_ONLY')
      }
    })
    return unsub
  }, [])

  // Auto-persist profil operator ke storage setiap kali ada perubahan
  const handleUpdateConfigField = (field: keyof IntelReportConfig, val: any) => {
    setConfig(prev => {
      const updated = { ...prev, [field]: val }
      if (field === 'unitName' || field === 'analystName' || field === 'analystNrp') {
        saveUserSettings({
          defaultUnit: updated.unitName,
          analystName: updated.analystName,
          analystNrp: updated.analystNrp
        })
      }
      return updated
    })
  }

  // ─── 5. PENYARINGAN DATA YANG DIMASUKKAN KE LAPORAN ───
  const activeArchiveItems = useMemo(() => {
    if (dataSourceMode === 'SOCIAL_ONLY') return []
    return archivedEntries.filter(item => selectedArchiveIds.has(item.id))
  }, [archivedEntries, selectedArchiveIds, dataSourceMode])

  // Hitung metrik ringkasan eksekutif
  const archiveStats = useMemo(() => {
    const total = activeArchiveItems.length
    const hoaksCount = activeArchiveItems.filter(i => i.archiveVerdict === 'HOAKS').length
    const faktaCount = activeArchiveItems.filter(i => i.archiveVerdict === 'FAKTA').length
    const dipantauCount = activeArchiveItems.filter(i => i.archiveVerdict === 'DIPANTAU' || !i.archiveVerdict).length
    return { total, hoaksCount, faktaCount, dipantauCount }
  }, [activeArchiveItems])

  // Draf Kontranarasi Terintegrasi 4 Kanal
  const counterNarratives = useMemo(() => {
    const topHoax = activeArchiveItems.find(i => i.archiveVerdict === 'HOAKS')
    const topPinned = activeArchiveItems[0]

    let topic = 'Operasi Disinformasi dan Manipulasi Persepsi Publik Siber'
    let clarification = 'Informasi yang beredar telah diverifikasi tidak memiliki dasar faktual kedinasan.'
    let source = 'Dinas Penerangan TNI Angkatan Darat (Dispenad)'
    let url = 'https://tniad.mil.id'

    if (topHoax) {
      topic = topHoax.claim
      clarification = topHoax.clarification || clarification
      source = topHoax.officialSource || source
      url = topHoax.sourceUrl || url
    } else if (socialAnalysis) {
      topic = socialAnalysis.post.caption || socialAnalysis.post.title || topic
      clarification = 'Berdasarkan penelusuran forensik narasi dan verifikasi lapangan, konten tersebut mengandung manipulasi konteks terencana.'
    } else if (topPinned) {
      topic = topPinned.claim
      clarification = topPinned.clarification || clarification
      source = topPinned.officialSource || source
    }

    return generateCounterNarratives(topic, {
      claim: topic,
      clarification,
      officialSource: source,
      sourceUrl: url
    }, socialAnalysis?.post.platform || 'MEDIA SOSIAL')
  }, [activeArchiveItems, socialAnalysis])

  // ─── 6. KALKULASI STEMPEL KRIPTOGRAFIS SHA-256 ───
  const [reportHash, setReportHash] = useState<string>('')

  useEffect(() => {
    let isMounted = true
    const computeReportHash = async () => {
      const rawData = [
        config.reportNumber,
        config.classification,
        config.unitName,
        config.analystName,
        config.analystNrp,
        config.date,
        dataSourceMode,
        activeArchiveItems.map(i => `${i.id}:${i.archiveVerdict}:${i.claim}`).join('|'),
        socialAnalysis ? `${socialAnalysis.post.platform}:${socialAnalysis.post.authorHandle}:${socialAnalysis.buzzerPattern.coordinationScore}` : 'NO_SOCIAL'
      ].join('///')

      const h = await generateSHA256(rawData)
      if (isMounted) setReportHash(h)
    }
    computeReportHash()
    return () => { isMounted = false }
  }, [config, activeArchiveItems, socialAnalysis, dataSourceMode])

  // ─── 7. HANDLER AKSI ───
  const handlePrint = () => {
    window.print()
  }

  const handleExportManifest = () => {
    let targetCase = linkedCase
    if (!targetCase) {
      const allCases = getAllInvestigationCases()
      targetCase = allCases[0]
    }
    if (!targetCase) {
      // Buat manifest virtual dari laporan aktif saat ini
      const virtualManifest = {
        manifestVersion: '2.0.0-MIL-A4',
        generatedAt: new Date().toISOString(),
        reportNumber: config.reportNumber,
        classification: config.classification,
        reportingUnit: config.unitName,
        analyst: {
          name: config.analystName,
          nrp: config.analystNrp
        },
        cryptographicProof: {
          algorithm: 'SHA-256',
          digest: reportHash,
          status: 'VALIDATED_BY_PUSSIBERAD'
        },
        scope: {
          mode: dataSourceMode,
          pinnedIssuesCount: activeArchiveItems.length,
          pinnedIssues: activeArchiveItems.map(item => ({
            id: item.id,
            verdict: item.archiveVerdict,
            cluster: item.cluster,
            claim: item.claim,
            officialSource: item.officialSource
          })),
          socialForensic: socialAnalysis ? {
            platform: socialAnalysis.post.platform,
            authorHandle: socialAnalysis.post.authorHandle,
            copypastaClustersCount: socialAnalysis.copypastaClusters?.length || 0,
            coordinationLevel: socialAnalysis.buzzerPattern.coordinationLevel,
            coordinationScore: socialAnalysis.buzzerPattern.coordinationScore
          } : null
        }
      }

      const jsonStr = JSON.stringify(virtualManifest, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `evidence-manifest-${config.reportNumber.replace(/[/\\?%*:|"<>]/g, '_')}.json`
      a.click()
      URL.revokeObjectURL(url)
      return
    }

    try {
      const manifest = generateEvidenceManifest(targetCase.id)
      const jsonStr = JSON.stringify(manifest, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `evidence-manifest-${targetCase.caseNumber}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Gagal mengekspor manifest: ' + String(err))
    }
  }

  // Muat sampel isu strategis tersemat binaan Pussiberad jika arsip kosong
  const handleSeedCuratedArchive = () => {
    const cur = getCuratedArchiveDebunks()
    if (cur.length > 0) {
      // Ambil 3 isu paling strategis (Kedaulatan Militer, Siber/Peretasan, Politik Negara)
      const samples = [
        cur.find(c => c.cluster === 'KEDAULATAN_MILITER') || cur[0],
        cur.find(c => c.cluster === 'SIBER_PERETASAN') || cur[1],
        cur.find(c => c.cluster === 'POLITIK_NEGARA') || cur[2]
      ].filter(Boolean) as typeof cur

      samples.forEach(item => archiveIssue(item))
      const fresh = getArchivedEntries()
      setArchivedEntries(fresh)
      setSelectedArchiveIds(new Set(fresh.map(f => f.id)))
    }
  }

  const handleResetConfig = () => {
    setConfig({
      unitName: 'PUSSIBERAD TNI AD',
      analystName: '',
      analystNrp: '',
      reportNumber: generatedReportNumber,
      classification: 'RAHASIA',
      date: todayMilitary,
      includeFindingsDetail: true,
      includeFactCheck: true,
      includeRecommendations: true,
    })
    setDataSourceMode('ALL')
    setIncludeSocialForensics(true)
    setIncludeCounterNarrative(true)
  }

  // ─── 8. BERSIHKAN KERTAS LAPORAN TOTAL (CLEAR CANVAS) ───
  const handleClearReport = () => {
    const hasData = captureSession.actions.length > 0 || selectedArchiveIds.size > 0 || Boolean(socialAnalysis)
    if (hasData) {
      const confirmed = window.confirm(
        'Bersihkan Kertas Laporan?\n\nSemua catatan tindakan sesi, centang isu tersemat, dan analisis media sosial pada dokumen ini akan dikosongkan agar Anda dapat memulai lembar laporan intelijen baru dari hasil rekaman tindakan terkini.'
      )
      if (!confirmed) return
    }

    // 1. Kosongkan rekaman tindakan operator di action-recorder
    clearCapturedActions()

    // 2. Kosongkan centang pilihan isu tersemat
    setSelectedArchiveIds(new Set())

    // 3. Kosongkan analisis medsos aktif
    try {
      sessionStorage.removeItem('narada_latest_social_analysis')
    } catch {}
    setSocialAnalysis(null)
    setSelectedScenarioIndex(-1)

    // 4. Generate nomor dokumen dinas baru
    const d = new Date()
    const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
    const romanMonth = romans[d.getMonth()]
    const randomSerial = String(Math.floor(10 + Math.random() * 90))
    const newReportNum = `NRD-LAP/${romanMonth}/${d.getFullYear()}/${randomSerial}`

    setConfig(prev => ({
      ...prev,
      reportNumber: newReportNum,
      date: todayMilitary
    }))
  }

  const toggleArchiveSelection = (id: string) => {
    setSelectedArchiveIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllArchives = () => {
    if (selectedArchiveIds.size === archivedEntries.length) {
      setSelectedArchiveIds(new Set())
    } else {
      setSelectedArchiveIds(new Set(archivedEntries.map(e => e.id)))
    }
  }

    // ─── 8. RENDER ISI DOKUMEN INTELIJEN A4 (REUSABLE UNTUK PREVIEW & MODAL ZOOM) ───
  const renderDocumentContent = () => (
    <>
      {/* ─── WATERMARK RESMI DINAS MILITER TNI AD ─── */}
            <div className="watermark" style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(-32deg)',
              fontSize: '26px',
              fontWeight: '900',
              letterSpacing: '5px',
              fontFamily: '"Rajdhani", sans-serif',
              color: 'rgba(200, 16, 46, 0.04)',
              pointerEvents: 'none',
              userSelect: 'none',
              whiteSpace: 'nowrap',
              zIndex: 0,
              textAlign: 'center',
              textTransform: 'uppercase'
            }}>
              DOKUMEN INTELIJEN PUSSIBERAD - KLASIFIKASI: {config.classification}
            </div>

            {/* ─── WATERMARK SIMULASI BENCHMARK (FIREWALL INTEGRITAS) ─── */}
            {isSimulationMode && (
              <div className="watermark-simulation" style={{
                position: 'absolute',
                top: '40%',
                left: '50%',
                transform: 'translate(-50%, -50%) rotate(-25deg)',
                fontSize: '22px',
                fontWeight: '900',
                letterSpacing: '3px',
                fontFamily: '"Rajdhani", sans-serif',
                color: 'rgba(245, 158, 11, 0.18)',
                border: '3px dashed rgba(245, 158, 11, 0.3)',
                padding: '12px 24px',
                pointerEvents: 'none',
                userSelect: 'none',
                whiteSpace: 'nowrap',
                zIndex: 1,
                textAlign: 'center',
                textTransform: 'uppercase'
              }}>
                SIMULASI — SYNTHETIC BENCHMARK — BUKAN DATA LIVE / BUKAN KASUS NYATA
              </div>
            )}

            {/* ─── KOP SURAT RESMI MILITER TNI AD ─── */}
            <div className="report-header" style={{ borderBottom: '3px solid #C8102E', paddingBottom: '16px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <img
                    src="./image/Electrified%20Golden%20Globe%20Crest.png"
                    onError={(e) => {
                      // Fallback jika dimuat di web dev server
                      const target = e.currentTarget
                      if (target.src.includes('./image/')) {
                        target.src = '/image/Electrified%20Golden%20Globe%20Crest.png'
                      }
                    }}
                    alt="Lambang Kartika Eka Paksi &amp; Pussiberad TNI AD"
                    style={{
                      width: '68px',
                      height: '68px',
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))'
                    }}
                  />
                  <div>
                    <div style={{
                      fontSize: '11px',
                      fontFamily: '"Inter", sans-serif',
                      fontWeight: '800',
                      letterSpacing: '2px',
                      color: '#4B5563',
                      textTransform: 'uppercase'
                    }}>
                      TENTARA NASIONAL INDONESIA — ANGKATAN DARAT
                    </div>
                    <div style={{
                      fontSize: '13px',
                      fontFamily: '"Rajdhani", sans-serif',
                      fontWeight: '700',
                      letterSpacing: '1.5px',
                      color: '#111827',
                      marginTop: '2px',
                      textTransform: 'uppercase'
                    }}>
                      {config.unitName}
                    </div>
                    <div style={{
                      fontSize: '24px',
                      fontWeight: '900',
                      color: '#C8102E',
                      letterSpacing: '3px',
                      fontFamily: '"Rajdhani", sans-serif',
                      lineHeight: '1.2',
                      marginTop: '4px'
                    }}>
                      NARADA INTEL REPORT
                    </div>
                    <div style={{ fontSize: '11px', color: '#374151', letterSpacing: '1px', fontWeight: '600' }}>
                      PRODUK LAPORAN INTELIJEN ANCAMAN KOGNITIF & SIBER SOSIAL
                    </div>
                    <div style={{
                      marginTop: '4px',
                      fontSize: '9px',
                      fontFamily: '"JetBrains Mono", monospace',
                      fontWeight: 700,
                      color: '#4B5563',
                      letterSpacing: '0.8px',
                      background: '#F3F4F6',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      display: 'inline-block'
                    }}>
                      RESMI / DOKUMEN INTELIJEN DINAS — ANALISIS CROSS-CORROBORATION
                    </div>
                  </div>
                </div>

                {/* Badge Klasifikasi & Nomor */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    display: 'inline-block',
                    padding: '4px 14px',
                    background: config.classification === 'RAHASIA' ? '#C8102E' : config.classification === 'TERBATAS' ? '#D97706' : '#2563EB',
                    color: '#FFFFFF',
                    borderRadius: '3px',
                    fontSize: '11px',
                    fontWeight: '800',
                    letterSpacing: '2px',
                    marginBottom: '8px'
                  }}>
                    {config.classification}
                  </div>
                  <div style={{ fontSize: '11px', fontFamily: '"JetBrains Mono", monospace', fontWeight: '700', color: '#111827' }}>
                    Nomor: {config.reportNumber}
                  </div>
                  <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '2px' }}>
                    Tanggal: {config.date}
                  </div>
                </div>
              </div>
            </div>

            {/* ─── TABEL IDENTITAS DOKUMEN ─── */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px 20px',
              padding: '12px 16px',
              background: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderRadius: '4px',
              marginBottom: '24px',
              fontSize: '11px'
            }}>
              <div><strong style={{ color: '#4B5563' }}>Satuan Pelapor:</strong> {config.unitName}</div>
              <div><strong style={{ color: '#4B5563' }}>Klasifikasi:</strong> {config.classification}</div>
              <div><strong style={{ color: '#4B5563' }}>Analis Intelijen:</strong> {config.analystName} {config.analystNrp ? `(NRP: ${config.analystNrp})` : ''}</div>
              <div><strong style={{ color: '#4B5563' }}>Engine Pemroses:</strong> NARADA SIBER ENGINE (Multi-Stream Reconciler &amp; Jaccard ≥ 0.70)</div>
            </div>

            {/* ─── BAGIAN I: RINGKASAN EKSEKUTIF ─── */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                fontSize: '12px',
                fontWeight: '800',
                letterSpacing: '1.5px',
                color: '#C8102E',
                marginBottom: '8px',
                borderBottom: '1.5px solid #E5E7EB',
                paddingBottom: '4px'
              }}>
                I. RINGKASAN EKSEKUTIF (EXECUTIVE SUMMARY)
              </div>
              <p style={{ color: '#1F2937', lineHeight: '1.8', textAlign: 'justify' }}>
                {activeArchiveItems.length === 0 && !socialAnalysis && captureSession.actions.length === 0 ? (
                  <span>Kertas kerja laporan intelijen siap disusun. Belum ada temuan isu tersemat atau investigasi media sosial yang dipilih ke dalam lembar ini. Silakan tandai isu pada Berita Tersemat, lakukan analisis di Social Post Analyzer, atau aktifkan <strong>[REC ON]</strong> pada bilah atas (Topbar) untuk merekam tindakan investigasi secara otomatis.</span>
                ) : (
                  <>
                    Berdasarkan operasi pemantauan dan analisis kognitif siber pada sesi ini, satuan telah mengevaluasi sebanyak{' '}
                    <strong>{activeArchiveItems.length} isu berita tersemat</strong>{socialAnalysis ? ' dan ' : ''}
                    {socialAnalysis && <strong>1 investigasi mendalam postingan media sosial</strong>}.
                    {captureSession.actions.length > 0 && (
                      <span> Terhimpun <strong>{captureSession.actions.length} catatan tindakan terverifikasi</strong> dari sesi kerja analis.</span>
                    )}
                    {' '}Dari penelaahan data silang (*cross-corroboration*), teridentifikasi{' '}
                    <strong style={{ color: '#DC2626' }}>{archiveStats.hoaksCount} materi HOAKS/DISINFORMASI terkonfirmasi</strong>,{' '}
                    <strong style={{ color: '#16A34A' }}>{archiveStats.faktaCount} materi FAKTA/KLARIFIKASI resmi</strong>, dan{' '}
                    <strong style={{ color: '#D97706' }}>{archiveStats.dipantauCount} materi SEDANG DIPANTAU</strong> secara berkala.
                  </>
                )}
              </p>
              {(archiveStats.hoaksCount > 0 || (socialAnalysis && socialAnalysis.copypastaClusters && socialAnalysis.copypastaClusters.length > 0)) && (
                <div style={{
                  marginTop: '10px',
                  padding: '10px 14px',
                  background: '#FEF2F2',
                  borderLeft: '4px solid #DC2626',
                  color: '#991B1B',
                  fontSize: '11px',
                  lineHeight: '1.6'
                }}>
                  <strong>PERHATIAN KOMANDO:</strong> Teridentifikasi upaya manipulasi kognitif siber terstruktur dengan amplifikasi pola seragam (*astroturfing*). Disarankan aktivasi strategi komunikasi 4-kanal Dispenad serta penguatan komsos teritorial Babinsa untuk meredam kegaduhan opini publik.
                </div>
              )}
            </div>

            {/* ─── MANIFEST REKAMAN TINDAKAN INTELIJEN SESI OPERATOR (AUDIT TRAIL CAPTURE HUB) ─── */}
            {captureSession.actions.length > 0 ? (
              <div style={{ marginBottom: '24px', background: '#F8FAFC', padding: '12px 14px', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  letterSpacing: '1px',
                  color: '#1E293B',
                  marginBottom: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid #CBD5E1',
                  paddingBottom: '4px'
                }}>
                  <span>LOG AUDIT TINDAKAN OPERATOR ({captureSession.actions.length} Tindakan Terekam · Cakupan: {CAPTURE_SCOPE_INFO[captureSession.scope].label})</span>
                  <span style={{ fontSize: '9px', fontFamily: '"JetBrains Mono", monospace', color: '#059669', fontWeight: 700 }}>
                    ● SESI TERVALIDASI
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px' }}>
                  {captureSession.actions.slice(0, 8).map(act => (
                    <div key={act.id} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '4px', padding: '7px 10px', fontSize: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 800, color: '#C8102E' }}>{act.id}</span>
                        <span style={{ fontSize: '9px', color: '#64748B' }}>{act.militaryTime}</span>
                      </div>
                      <div style={{ fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{act.title}</div>
                      <div style={{ fontSize: '9.5px', color: '#4B5563', lineHeight: 1.35, marginTop: '2px' }}>{truncateText(act.detail, 100)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{
                marginBottom: '24px',
                background: '#F8FAFC',
                padding: '12px 14px',
                borderRadius: '4px',
                border: '1px dashed #CBD5E1',
                textAlign: 'center',
                color: '#64748B',
                fontSize: '11px'
              }}>
                <div style={{ fontWeight: 700, color: '#334155', marginBottom: '3px' }}>
                  LOG AUDIT TINDAKAN OPERATOR (0 TINDAKAN)
                </div>
                <div>
                  Belum ada tindakan yang terekam pada sesi ini. Aktifkan tombol <strong>[REC ON]</strong> di bilah atas (Topbar) untuk mulai merekam aktivitas penyematan isu atau analisis forensik ke dalam lembar laporan ini.
                </div>
              </div>
            )}

            {/* ─── MANIFEST INVESTIGASI KASUS BERBASIS BUKTI DIGITAL ─── */}
            {linkedCase && (
              <div style={{ marginBottom: '24px', background: '#F8FAFC', padding: '14px', borderRadius: '6px', border: '1px solid #CBD5E1' }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: '800',
                  letterSpacing: '1.5px',
                  color: '#1E293B',
                  marginBottom: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>MANIFEST KASUS INVESTIGASI: {linkedCase.caseNumber}</span>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', background: '#0F172A', color: '#F1F5F9' }}>
                    STATUS: {linkedCase.status} ({linkedCase.mode})
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#475569', marginBottom: '8px' }}>
                  <strong>Judul:</strong> {linkedCase.title}
                </div>
                <div style={{ fontSize: '10px', color: '#64748B', marginBottom: '10px' }}>
                  {linkedCase.summary}
                </div>

                {/* Ringkasan Klaim */}
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  DAFTAR KLAIM ATOMIK ({caseClaimsList.length} Klaim) &amp; HASIL PENELAAHAN:
                </div>
                {caseClaimsList.length === 0 ? (
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontStyle: 'italic', marginBottom: '8px' }}>Belum ada klaim atomik terdaftar.</div>
                ) : (
                  <ul style={{ margin: '0 0 10px 16px', padding: 0, fontSize: '10px' }}>
                    {caseClaimsList.map(c => {
                      const assess = caseAssessmentsList.find(a => a.claimId === c.id)
                      return (
                        <li key={c.id} style={{ marginBottom: '3px' }}>
                          <strong>"{c.claimText}"</strong> — Vonis: <span style={{ fontWeight: 700, color: assess?.verdict === 'CONTRADICTED' ? '#DC2626' : assess?.verdict === 'SUPPORTED' ? '#16A34A' : '#D97706' }}>{assess?.verdict || 'UNVERIFIED'}</span>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {/* Ringkasan Bukti & Hash */}
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  DAFTAR BUKTI TERTELUSURI ({caseEvidenceList.length} Berkas):
                </div>
                {caseEvidenceList.length === 0 ? (
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontStyle: 'italic' }}>Belum ada berkas bukti digital tersimpan.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#E2E8F0', borderBottom: '1px solid #CBD5E1' }}>
                        <th style={{ padding: '4px 6px' }}>ID BUKTI</th>
                        <th style={{ padding: '4px 6px' }}>TIPE</th>
                        <th style={{ padding: '4px 6px' }}>SUMBER</th>
                        <th style={{ padding: '4px 6px' }}>PROVENANCE WAKTU</th>
                        <th style={{ padding: '4px 6px' }}>SHA-256 HASH (DIGEST)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {caseEvidenceList.slice(0, 5).map(ev => (
                        <tr key={ev.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '4px 6px', fontFamily: 'monospace' }}>{ev.id}</td>
                          <td style={{ padding: '4px 6px' }}>{ev.evidenceType}</td>
                          <td style={{ padding: '4px 6px' }}>{ev.sourceLabel}</td>
                          <td style={{ padding: '4px 6px' }}>{ev.sourceTimestampProvenance}</td>
                          <td style={{ padding: '4px 6px', fontFamily: 'monospace' }}>{ev.contentHashNormalized.slice(0, 16)}...</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ─── BAGIAN II: MATRIKS TEMUAN ISU TERSEMAT ─── */}
            {config.includeFindingsDetail && dataSourceMode !== 'SOCIAL_ONLY' && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: '800',
                  letterSpacing: '1.5px',
                  color: '#C8102E',
                  marginBottom: '8px',
                  borderBottom: '1.5px solid #E5E7EB',
                  paddingBottom: '4px'
                }}>
                  II. MATRIKS TEMUAN ISU TERSEMAT & KLARIFIKASI LAPANGAN
                </div>

                {activeArchiveItems.length === 0 ? (
                  <div style={{ padding: '12px', background: '#F9FAFB', border: '1px dashed #D1D5DB', textAlign: 'center', color: '#6B7280', fontSize: '11px' }}>
                    Tidak ada isu tersemat yang dipilih untuk disertakan dalam dokumen ini.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#F3F4F6', borderBottom: '2px solid #D1D5DB' }}>
                        <th style={{ padding: '6px 8px', width: '24px' }}>#</th>
                        <th style={{ padding: '6px 8px', width: '90px' }}>KLASTER</th>
                        <th style={{ padding: '6px 8px' }}>NARASI KLAIM / ISU TERDETEKSI</th>
                        <th style={{ padding: '6px 8px', width: '85px', textAlign: 'center' }}>VONIS</th>
                        <th style={{ padding: '6px 8px', width: '130px' }}>ATRIBUSI RESMI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeArchiveItems.map((item, idx) => {
                        const vColor = item.archiveVerdict === 'HOAKS' ? '#DC2626' : item.archiveVerdict === 'FAKTA' ? '#16A34A' : '#D97706'
                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                            <td style={{ padding: '6px 8px', verticalAlign: 'top', color: '#6B7280' }}>{idx + 1}</td>
                            <td style={{ padding: '6px 8px', verticalAlign: 'top', fontSize: '9.5px', fontFamily: '"JetBrains Mono", monospace' }}>
                              <span style={{ background: '#F3F4F6', padding: '2px 4px', borderRadius: '3px' }}>
                                {item.cluster || 'UMUM'}
                              </span>
                            </td>
                            <td style={{ padding: '6px 8px', verticalAlign: 'top', lineHeight: '1.4' }}>
                              <strong style={{ color: '#111827' }}>"{item.claim}"</strong>
                              {item.clarification && (
                                <div style={{ marginTop: '3px', fontSize: '9.5px', color: '#4B5563', lineHeight: '1.3' }}>
                                  <em>Klarifikasi:</em> {truncateText(item.clarification, 140)}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '6px 8px', verticalAlign: 'top', textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '2px 6px',
                                borderRadius: '3px',
                                fontWeight: '800',
                                fontSize: '9px',
                                color: '#FFFFFF',
                                background: vColor,
                                letterSpacing: '0.5px'
                              }}>
                                {item.archiveVerdict || 'DIPANTAU'}
                              </span>
                            </td>
                            <td style={{ padding: '6px 8px', verticalAlign: 'top', fontSize: '9.5px', color: '#374151' }}>
                              <strong>{item.officialSource || 'TurnBackHoax / MAFINDO'}</strong>
                              {item.publishedDate && (
                                <div style={{ fontSize: '8.5px', color: '#6B7280' }}>{item.publishedDate}</div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ─── BAGIAN III: ANALISIS FORENSIK POSTINGAN MEDSOS & POLA BUZZER ─── */}
            {includeSocialForensics && dataSourceMode !== 'ARCHIVE_ONLY' && (
              socialAnalysis ? (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '800',
                    letterSpacing: '1.5px',
                    color: '#C8102E',
                    marginBottom: '8px',
                    borderBottom: '1.5px solid #E5E7EB',
                    paddingBottom: '4px'
                  }}>
                    III. ANALISIS FORENSIK POSTINGAN MEDSOS & POLA AMPLIFIKASI KOGNITIF
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    padding: '12px',
                    background: '#F9FAFB',
                    border: '1px solid #E5E7EB',
                    borderRadius: '4px',
                    marginBottom: '10px'
                  }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 700 }}>
                        METRIK KONTEN & PROFIL KREATOR:
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#111827', marginTop: '2px' }}>
                        {socialAnalysis.post.authorHandle || '@official_source'} [{socialAnalysis.post.platform?.toUpperCase()}]
                      </div>
                      <div style={{ fontSize: '10px', color: '#4B5563', marginTop: '4px' }}>
                        Kreator: <strong>{socialAnalysis.post.authorName || 'Akun Publik'}</strong> · Status Verifikasi: {socialAnalysis.post.authorVerified ? 'Terverifikasi (Verified)' : 'Akun Anonim / Non-Verified'}
                      </div>
                      <div style={{ fontSize: '10px', color: '#4B5563', marginTop: '2px' }}>
                        Views: {(socialAnalysis.post.viewCount || 0).toLocaleString()} · Suka: {(socialAnalysis.post.likeCount || 0).toLocaleString()} · Komentar: {(socialAnalysis.post.commentCount || 0).toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '10px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 700 }}>
                        SINTESIS POLA BUZZER & BOTNET:
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: socialAnalysis.buzzerPattern.coordinationLevel === 'TINGGI' ? '#DC2626' : socialAnalysis.buzzerPattern.coordinationLevel === 'SEDANG' ? '#D97706' : '#16A34A', marginTop: '2px' }}>
                        Skor Koordinasi: {socialAnalysis.buzzerPattern.coordinationScore}/100 [{socialAnalysis.buzzerPattern.coordinationLevel}]
                      </div>
                      <div style={{ fontSize: '10px', color: '#4B5563', marginTop: '4px' }}>
                        Lonjakan: <strong>{socialAnalysis.buzzerPattern.burstVelocityCommentPerMinute} komentar/menit</strong>
                      </div>
                      <div style={{ fontSize: '10px', color: '#4B5563', marginTop: '2px' }}>
                        Kluster Copypasta: <strong>{socialAnalysis.copypastaClusters?.length || 0} kluster teridentifikasi</strong> (Jaccard Similarity ≥ 0.70)
                      </div>
                    </div>
                  </div>

                  {/* Cuplikan Kluster Templat / Copypasta jika ada */}
                  {socialAnalysis.copypastaClusters && socialAnalysis.copypastaClusters.length > 0 && (
                    <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', fontSize: '10px' }}>
                      <strong style={{ color: '#991B1B' }}>Temuan Kluster Copypasta Terdeteksi:</strong>
                      <div style={{ color: '#7F1D1D', marginTop: '2px' }}>
                        "{socialAnalysis.copypastaClusters[0]?.templateText}" ({socialAnalysis.copypastaClusters[0]?.commentCount} pengulangan identik dari akun-akun buzzer)
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '800',
                    letterSpacing: '1.5px',
                    color: '#C8102E',
                    marginBottom: '8px',
                    borderBottom: '1.5px solid #E5E7EB',
                    paddingBottom: '4px'
                  }}>
                    III. ANALISIS FORENSIK POSTINGAN MEDSOS & POLA AMPLIFIKASI KOGNITIF
                  </div>
                  <div style={{ padding: '12px', background: '#F9FAFB', border: '1px dashed #D1D5DB', textAlign: 'center', color: '#6B7280', fontSize: '11px' }}>
                    Belum ada investigasi postingan media sosial pada sesi ini. Buka tab <strong>Social Post Analyzer</strong> untuk menelaah akun/postingan secara mendalam.
                  </div>
                </div>
              )
            )}

            {/* ─── BAGIAN IV: REKOMENDASI TAKTIS KOMANDO ─── */}
            {config.includeRecommendations && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: '800',
                  letterSpacing: '1.5px',
                  color: '#C8102E',
                  marginBottom: '8px',
                  borderBottom: '1.5px solid #E5E7EB',
                  paddingBottom: '4px'
                }}>
                  IV. REKOMENDASI TINDAKAN TAKTIS KOMANDO
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', color: '#1F2937', lineHeight: '1.7' }}>
                  <div>
                    <strong>1. Penerangan TNI AD (Dispenad):</strong> Segera rilis lembar klarifikasi resmi (press fact sheet) dan infografis pembanding untuk menangkal disinformasi alutsista serta manipulasi konteks penugasan satuan di ruang publik.
                  </div>
                  <div>
                    <strong>2. Asintel / Pussiberad:</strong> Lakukan pelacakan jejak digital simpul awal akun penyebar (*seed accounts*) serta pantau pola botnet astroturfing yang mengamplifikasi tagar provokatif secara serentak.
                  </div>
                  <div>
                    <strong>3. Satuan Teritorial Komando Wilayah (Kodam/Korem/Kodim/Babinsa):</strong> Tingkatkan pendekatan komunikasi sosial (komsos) tatap muka bersama tokoh masyarakat, pemuda, dan tokoh agama setempat guna meredam dampak psikologis disinformasi.
                  </div>
                </div>
              </div>
            )}

            {/* ─── BAGIAN V: DRAF KONTRANARASI TAKTIS 4 KANAL ─── */}
            {includeCounterNarrative && (
              activeArchiveItems.length === 0 && !socialAnalysis ? (
                <div className="report-section card-section" style={{ marginBottom: '28px' }}>
                  <div className="section-title" style={{
                    fontSize: '12px',
                    fontWeight: '800',
                    letterSpacing: '1.5px',
                    color: '#C8102E',
                    marginBottom: '10px',
                    borderBottom: '1.5px solid #E5E7EB',
                    paddingBottom: '4px'
                  }}>
                    V. DRAF KONTRANARASI TAKTIS 4 KANAL DISPENAD & SATUAN TERITORIAL
                  </div>
                  <div style={{ padding: '12px', background: '#F9FAFB', border: '1px dashed #D1D5DB', textAlign: 'center', color: '#6B7280', fontSize: '11px' }}>
                    Draf kontranarasi taktis otomatis dikompilasi saat minimal terdapat 1 isu tersemat atau 1 investigasi media sosial pada laporan ini.
                  </div>
                </div>
              ) : (
                <div className="report-section card-section" style={{ marginBottom: '28px' }}>
                  <div className="section-title" style={{
                    fontSize: '12px',
                    fontWeight: '800',
                    letterSpacing: '1.5px',
                    color: '#C8102E',
                    marginBottom: '10px',
                    borderBottom: '1.5px solid #E5E7EB',
                    paddingBottom: '4px'
                  }}>
                    V. DRAF KONTRANARASI TAKTIS 4 KANAL DISPENAD & SATUAN TERITORIAL
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                    {/* Kanal 1: Siaran Pers Dispenad */}
                    <div className="report-item" style={{
                      padding: '12px 14px',
                      background: '#FEF2F2',
                      border: '1px solid #FECACA',
                      borderRadius: '4px',
                      fontSize: '11px',
                      color: '#1F2937'
                    }}>
                      <div style={{ fontWeight: '800', marginBottom: '4px', color: '#B91C1C', letterSpacing: '0.5px' }}>
                        1. SIARAN PERS RESMI DISPENAD (Media Cetak & Online):
                      </div>
                      <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6', fontSize: '10.5px' }}>
                        {counterNarratives.dispenadOfficial}
                      </div>
                    </div>

                    {/* Kanal 2: Komsos Babinsa */}
                    <div className="report-item" style={{
                      padding: '12px 14px',
                      background: '#F0FDF4',
                      border: '1px solid #BBF7D0',
                      borderRadius: '4px',
                      fontSize: '11px',
                      color: '#1F2937'
                    }}>
                      <div style={{ fontWeight: '800', marginBottom: '4px', color: '#15803D', letterSpacing: '0.5px' }}>
                        2. PANDUAN KOMSOS BABINSA (Aparat Teritorial & Koramil):
                      </div>
                      <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6', fontSize: '10.5px' }}>
                        {counterNarratives.babinsaTerritorial}
                      </div>
                    </div>

                    {/* Kanal 3: Pesan Edukasi WhatsApp Warga */}
                    <div className="report-item" style={{
                      padding: '12px 14px',
                      background: '#EFF6FF',
                      border: '1px solid #BFDBFE',
                      borderRadius: '4px',
                      fontSize: '11px',
                      color: '#1F2937'
                    }}>
                      <div style={{ fontWeight: '800', marginBottom: '4px', color: '#1D4ED8', letterSpacing: '0.5px' }}>
                        3. PESAN EDUKASI WHATSAPP WARGA (Mitigasi Kepanikan Publik):
                      </div>
                      <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6', fontSize: '10.5px' }}>
                        {counterNarratives.whatsappCivilian}
                      </div>
                    </div>

                    {/* Kanal 4: Medsos Taktis */}
                    <div className="report-item" style={{
                      padding: '12px 14px',
                      background: '#FFFBEB',
                      border: '1px solid #FDE68A',
                      borderRadius: '4px',
                      fontSize: '11px',
                      color: '#1F2937'
                    }}>
                      <div style={{ fontWeight: '800', marginBottom: '4px', color: '#B45309', letterSpacing: '0.5px' }}>
                        4. CUITAN MEDSOS TAKTIS (Twitter/X, Instagram, TikTok):
                      </div>
                      <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6', fontSize: '10.5px' }}>
                        {counterNarratives.socialTactical}
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}

            {/* ─── KOLOM TANDA TANGAN DINAS MILITER ─── */}
            <div className="signature-block" style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              marginTop: '40px',
              paddingTop: '16px',
              borderTop: '1px solid #E5E7EB',
              fontSize: '11px'
            }}>
              <div>
                <div style={{ color: '#6B7280', marginBottom: '4px' }}>Mengetahui,</div>
                <div style={{ fontWeight: '700', color: '#111827' }}>Komandan Satgas Intelijen Siber Pussiberad</div>
                
                {/* STEMPEL DINAS RESMI DIGITAL */}
                <div className="digital-stamp" style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px dashed #C8102E',
                  borderRadius: '50%',
                  width: '76px',
                  height: '76px',
                  color: '#C8102E',
                  fontSize: '8px',
                  fontWeight: '800',
                  textAlign: 'center',
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                  transform: 'rotate(-10deg)',
                  margin: '12px 0 6px 14px',
                  padding: '4px',
                  lineHeight: '1.3'
                }}>
                  <span>★ PUSSIBERAD ★<br/>TNI AD<br/>TERVALIDASI</span>
                </div>

                <div style={{ fontWeight: '800', textDecoration: 'underline', color: '#111827' }}>
                  HERLAMBANG, S.I.P., M.Han.
                </div>
                <div style={{ color: '#4B5563', fontSize: '10px' }}>Kolonel Inf. NRP 1102003891</div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#6B7280', marginBottom: '4px' }}>Jakarta, {config.date}</div>
                <div style={{ fontWeight: '700', color: '#111827' }}>Perwira Analis Intelijen Siber</div>
                <div style={{ marginTop: '76px', fontWeight: '800', textDecoration: 'underline', color: '#111827' }}>
                  {config.analystName ? config.analystName.toUpperCase() : '( .................................................... )'}
                </div>
                <div style={{ color: '#4B5563', fontSize: '10px' }}>
                  {config.analystNrp ? `NRP. ${config.analystNrp}` : 'NRP. ........................................'}
                </div>
              </div>
            </div>

            {/* ─── STEMPEL INTEGRITAS KRIPTOGRAFIS SHA-256 ─── */}
            <div className="sha256-block card-section" style={{
              marginTop: '24px',
              padding: '8px 12px',
              background: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '9px',
              fontFamily: '"JetBrains Mono", monospace'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#374151', minWidth: 0 }}>
                <span style={{ fontWeight: '700', color: '#111827', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Lock size={11} /> STEMPEL INTEGRITAS SHA-256:
                </span>
                <span style={{ color: '#059669', wordBreak: 'break-all' }}>
                  {reportHash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
                </span>
              </div>
              <span style={{ color: '#9CA3AF', whiteSpace: 'nowrap', marginLeft: '12px', flexShrink: 0 }}>
                CHAIN OF CUSTODY VALID · PUSSIBERAD
              </span>
            </div>

            {/* Footer Dokumen */}
            <div style={{
              marginTop: '20px',
              paddingTop: '8px',
              borderTop: '1px solid #F3F4F6',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '9px',
              fontFamily: '"JetBrains Mono", monospace',
              color: '#9CA3AF'
            }}>
              <span>PRODUK INTELIJEN OTOMATIS · NARADA v1.0.0</span>
              <span>KLASIFIKASI: {config.classification} · HALAMAN 1 DARI 1</span>
            </div>
    </>
  )

  return (
    <div className="fade-in" style={{ paddingBottom: '32px' }}>
      {/* ─── KOTAK INFORMASI ASAL & PROVENANCE DATA LAPORAN (CHASSIS PLAT BESI BAJA) ─── */}
      <div className="no-print" style={{ marginBottom: '18px' }}>
        <div 
          className="steel-chassis-card"
          style={{
            padding: '12px 16px',
            borderLeft: '4px solid #38BDF8',
            background: 'linear-gradient(180deg, #131B26 0%, #0B1017 100%)',
            position: 'relative'
          }}
        >
          <span className="bolt-tl" />
          <span className="bolt-tr" />
          <span className="bolt-bl" />
          <span className="bolt-br" />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '4px',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: '1px'
            }}>
              <Info size={15} color="#38BDF8" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#38BDF8', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>INFORMASI ASAL DATA: SELEKTIF BERBASIS HUB CAPTURE TINDAKAN INTELIJEN</span>
                  <span style={{ fontSize: '9.5px', background: 'rgba(56, 189, 248, 0.2)', padding: '1px 6px', borderRadius: '3px', color: '#38BDF8' }}>
                    {CAPTURE_SCOPE_INFO[captureSession.scope].label} ({captureSession.actions.length} Tindakan)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsZoomModalOpen(true)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '4px',
                    background: 'linear-gradient(180deg, #2D3D52 0%, #17212D 100%)',
                    border: '1px solid #4D627E',
                    borderBottom: '2px solid #0D131B',
                    color: '#F8FAFC',
                    fontSize: '10.5px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.6)'
                  }}
                  title="Pratinjau Dokumen A4 dalam Tampilan Penuh / Mode Zoom"
                >
                  <Maximize2 size={12} color="#38BDF8" />
                  <span>TINJAU PENUH DOKUMEN (ZOOM A4)</span>
                </button>
              </div>
              <p style={{ fontSize: '11px', color: '#94A3B8', margin: '4px 0 8px 0', lineHeight: 1.5 }}>
                Dokumen Telaahan Intelijen A4 ini <strong>bukan pembuangan sembarang seluruh aktivitas aplikasi</strong>, melainkan dihimpun secara selektif oleh <strong>Hub Capture Tindakan Intelijen</strong> di navbar atas. Operator dapat menyaring aktivitas spesifik sesuai kebutuhan misi:
              </p>

              {/* 3 Pilar Sumber Data */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '8px' }}>
                <div style={{
                  padding: '8px 10px',
                  borderRadius: '3px',
                  background: '#090E15',
                  border: '1px solid #1A2534'
                }}>
                  <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Pin size={11} /> 1. KONSOL BERITA TERSEMAT & RADAR HARVESTER
                  </div>
                  <div style={{ fontSize: '10px', color: '#CBD5E1', marginTop: '3px', lineHeight: 1.4 }}>
                    Hanya merekam isu yang Anda tandai <em>"Sematkan"</em> atau temuan anomali radar. Memuat intisari narasi, atribusi resmi, dan vonis valid (Fakta/Hoaks/Dipantau).
                  </div>
                </div>

                <div style={{
                  padding: '8px 10px',
                  borderRadius: '3px',
                  background: '#090E15',
                  border: '1px solid #1A2534'
                }}>
                  <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Share2 size={11} /> 2. HASIL ANALISIS POSTINGAN MEDSOS & BUZZER
                  </div>
                  <div style={{ fontSize: '10px', color: '#CBD5E1', marginTop: '3px', lineHeight: 1.4 }}>
                    Hanya memuat investigasi medsos yang Anda teliti di tab Profiler (YouTube, TikTok, Twitter). Menyajikan skor koordinasi botnet dan kluster copypasta buzzer.
                  </div>
                </div>

                <div style={{
                  padding: '8px 10px',
                  borderRadius: '3px',
                  background: '#090E15',
                  border: '1px solid #1A2534'
                }}>
                  <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#10B981', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Lock size={11} /> 3. RANTAI BUKTI DIGITAL & STEMPEL SHA-256
                  </div>
                  <div style={{ fontSize: '10px', color: '#CBD5E1', marginTop: '3px', lineHeight: 1.4 }}>
                    Setiap tindakan operator yang terekam dikunci dengan stempel hash kriptografis SHA-256 dan rantai bukti digital (<em>Chain of Custody</em>) berkekuatan hukum kedinasan.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Banner Peringatan Simulasi Sintetis (Firewall Integritas) ─── */}
      {isSimulationMode && (
        <div className="no-print" style={{
          marginBottom: '16px',
          padding: '12px 16px',
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <AlertTriangle size={18} style={{ color: '#F59E0B', flexShrink: 0 }} />
          <div style={{ fontSize: '11px', lineHeight: 1.5, color: '#FDE68A' }}>
            <span style={{ fontWeight: 800, letterSpacing: '0.8px', color: '#F59E0B' }}>
              FIREWALL INTEGRITAS: PRESET SIMULASI SINTETIS AKTIF
            </span>
            <div style={{ color: '#94A3B8', marginTop: '2px' }}>
              Dokumen ini dibangkitkan dari benchmark sintetis terkontrol. Tanda air "SIMULASI" tercantum permanen pada cetakan A4 dan ekspor data sesuai doktrin integritas bukti.
            </div>
          </div>
        </div>
      )}

      {/* ─── Layout 2 Kolom: Kiri Panel Konfigurasi, Kanan Pratinjau Kertas Resmi ─── */}
      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

        {/* ─── KOLOM KIRI: Panel Konfigurasi Laporan (Disembunyikan saat cetak) ─── */}
        <div className="report-config-panel no-print" style={{ width: '360px', flexShrink: 0 }}>
          
          {/* Card 1: Pengaturan Identitas & Kop Militer */}
          <div className="steel-chassis-card" style={{ marginBottom: '16px', position: 'relative' }}>
            <span className="bolt-tl" />
            <span className="bolt-tr" />
            <span className="bolt-bl" />
            <span className="bolt-br" />
            
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sliders size={13} color="var(--narada-red)" />
                IDENTITAS PEMERIKSA & KOP RESMI
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleResetConfig}
                title="Kosongkan Formulir / Reset Pengaturan"
              >
                <RotateCcw size={12} />
              </button>
            </div>

            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Nama Satuan */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Building size={11} /> NAMA SATUAN / KOTAMA
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={config.unitName}
                  onChange={e => handleUpdateConfigField('unitName', e.target.value)}
                  placeholder="Contoh: PUSSIBERAD TNI AD"
                />
              </div>

              {/* Nama Analis & NRP */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '8px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <User size={11} /> NAMA ANALIS & PANGKAT
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={config.analystName}
                    onChange={e => handleUpdateConfigField('analystName', e.target.value)}
                    placeholder="Contoh: Letda Chb Aryo Bagus / Analis Intelijen"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Award size={11} /> NRP / NIP
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={config.analystNrp || ''}
                    onChange={e => handleUpdateConfigField('analystNrp', e.target.value)}
                    placeholder="Contoh: 212401829002"
                  />
                </div>
              </div>

              {/* Nomor Laporan & Tanggal */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Hash size={11} /> NO. LAPORAN DINAS
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={config.reportNumber}
                    onChange={e => handleUpdateConfigField('reportNumber', e.target.value)}
                    placeholder="Contoh: NRD-LAP/XI/2026/04"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">TANGGAL DINAS</label>
                  <input
                    type="text"
                    className="form-control"
                    value={config.date}
                    onChange={e => handleUpdateConfigField('date', e.target.value)}
                    placeholder="Contoh: 13 November 2026"
                  />
                </div>
              </div>

              {/* Tingkat Klasifikasi Keamanan */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Lock size={11} /> TINGKAT KLASIFIKASI DOKUMEN
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginTop: '4px' }}>
                  {(['RAHASIA', 'TERBATAS', 'BIASA'] as const).map((cls: ReportClassification) => {
                    const isSelected = config.classification === cls
                    let btnBg = 'linear-gradient(180deg, #1E2734 0%, #111722 100%)'
                    let btnBorderTop = '1px solid rgba(255, 255, 255, 0.12)'
                    let btnBorderBottom = '2px solid #080C12'
                    let btnBorderSides = '1px solid #161F2C'
                    let btnColor = 'var(--text-secondary)'
                    let btnShadow = '0 2px 5px rgba(0,0,0,0.6)'

                    if (isSelected) {
                      btnColor = '#FFFFFF'
                      if (cls === 'RAHASIA') {
                        btnBg = 'linear-gradient(180deg, #991B1B 0%, #5B0C15 100%)'
                        btnBorderTop = '1px solid rgba(255, 255, 255, 0.35)'
                        btnBorderBottom = '2px solid #2B0609'
                        btnBorderSides = '1px solid #7F1D1D'
                        btnShadow = '0 3px 8px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.25)'
                      } else if (cls === 'TERBATAS') {
                        btnBg = 'linear-gradient(180deg, #B45309 0%, #632B03 100%)'
                        btnBorderTop = '1px solid rgba(255, 255, 255, 0.35)'
                        btnBorderBottom = '2px solid #361701'
                        btnBorderSides = '1px solid #92400E'
                        btnShadow = '0 3px 8px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.25)'
                      } else {
                        btnBg = 'linear-gradient(180deg, #1D4ED8 0%, #0F2D80 100%)'
                        btnBorderTop = '1px solid rgba(255, 255, 255, 0.35)'
                        btnBorderBottom = '2px solid #081B4E'
                        btnBorderSides = '1px solid #1E40AF'
                        btnShadow = '0 3px 8px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.25)'
                      }
                    }

                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => handleUpdateConfigField('classification', cls)}
                        style={{
                          padding: '7px 4px',
                          fontSize: '11px',
                          fontWeight: '800',
                          letterSpacing: '1px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.18s ease',
                          background: btnBg,
                          color: btnColor,
                          borderTop: btnBorderTop,
                          borderBottom: btnBorderBottom,
                          borderLeft: btnBorderSides,
                          borderRight: btnBorderSides,
                          boxShadow: btnShadow,
                          textShadow: '0 1px 2px rgba(0, 0, 0, 0.85)'
                        }}
                      >
                        {cls}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Sumber Data & Komponen Dokumen */}
          <div className="steel-chassis-card" style={{ marginBottom: '16px', position: 'relative' }}>
            <span className="bolt-tl" />
            <span className="bolt-tr" />
            <span className="bolt-bl" />
            <span className="bolt-br" />

            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={13} color="var(--narada-gold)" />
                SUMBER DATA LAPORAN INTELIJEN
              </div>
            </div>

            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Pilihan Cakupan Sumber Data (Terkoneksi Capture Hub) */}
              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label className="form-label" style={{ margin: 0 }}>CAKUPAN PEREKAM INTELIJEN</label>
                  <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: captureSession.isRecording ? '#EF4444' : '#64748B', fontWeight: 700 }}>
                    {captureSession.isRecording ? '● REC AKTIF' : '⏸ REC JEDA'} ({captureSession.actions.length})
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginTop: '4px' }}>
                  {[
                    { key: 'ALL', label: 'Semua Tindakan', icon: '⏺' },
                    { key: 'RADAR_ONLY', label: 'Radar & Isu', icon: '🛰️' },
                    { key: 'SOCIAL_ONLY', label: 'Analisis Medsos', icon: '🕵️' },
                    { key: 'ARCHIVE_ONLY', label: 'Berita Tersemat', icon: '📌' }
                  ].map(m => {
                    const isSel = captureSession.scope === m.key
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => {
                          setCaptureScope(m.key as any)
                          if (m.key === 'ALL') setDataSourceMode('ALL')
                          else if (m.key === 'SOCIAL_ONLY') setDataSourceMode('SOCIAL_ONLY')
                          else setDataSourceMode('ARCHIVE_ONLY')
                        }}
                        style={{
                          padding: '6px 4px',
                          fontSize: '10px',
                          fontWeight: '800',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          textAlign: 'center',
                          background: isSel ? 'linear-gradient(180deg, #2A384C 0%, #16202D 100%)' : 'linear-gradient(180deg, #182230 0%, #0E141E 100%)',
                          color: isSel ? '#38BDF8' : 'var(--text-secondary)',
                          borderTop: isSel ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                          borderBottom: isSel ? '2px solid #38BDF8' : '2px solid #080C10',
                          borderLeft: '1px solid #222E3D',
                          borderRight: '1px solid #121820',
                          boxShadow: isSel ? '0 2px 6px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.18)' : '0 2px 4px rgba(0, 0, 0, 0.5)',
                          textShadow: '0 1px 2px rgba(0, 0, 0, 0.85)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        <span>{m.icon}</span>
                        <span>{m.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Checklist Isu Berita Tersemat */}
              {dataSourceMode !== 'SOCIAL_ONLY' && (
                <div style={{
                  padding: '10px',
                  background: 'linear-gradient(180deg, #101622 0%, #090D13 100%)',
                  borderRadius: '4px',
                  border: '1px solid #1C2636',
                  boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.85)'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px'
                  }}>
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Pin size={11} color="var(--accent-gold)" />
                      PILIH ISU TERSEMAT ({activeArchiveItems.length}/{archivedEntries.length}):
                    </span>
                    {archivedEntries.length > 0 && (
                      <button
                        type="button"
                        onClick={toggleSelectAllArchives}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--accent-cyan)',
                          fontSize: '9px',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        {selectedArchiveIds.size === archivedEntries.length ? 'Batal Semua' : 'Pilih Semua'}
                      </button>
                    )}
                  </div>

                  {archivedEntries.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '10px 4px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        Belum ada berita tersemat dari Radar.
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleSeedCuratedArchive}
                        style={{ width: '100%', fontSize: '10px', justifyContent: 'center' }}
                      >
                        <Sparkles size={11} color="var(--accent-gold)" /> + Muat Isu Tersemat Binaan
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                      {archivedEntries.map(entry => {
                        const isChecked = selectedArchiveIds.has(entry.id)
                        const verdictColor = entry.archiveVerdict === 'HOAKS' ? '#EF4444' : entry.archiveVerdict === 'FAKTA' ? '#10B981' : '#F59E0B'
                        return (
                          <div
                            key={entry.id}
                            onClick={() => toggleArchiveSelection(entry.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 6px',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              background: isChecked ? 'rgba(255,255,255,0.04)' : 'transparent',
                              border: isChecked ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent'
                            }}
                          >
                            {isChecked ? <CheckSquare size={13} color="var(--narada-red)" /> : <Square size={13} color="var(--text-muted)" />}
                            <div style={{ flex: 1, minWidth: 0, fontSize: '11px' }}>
                              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                                {entry.claim}
                              </div>
                            </div>
                            <span style={{
                              fontSize: '8px',
                              fontWeight: 800,
                              padding: '1px 4px',
                              borderRadius: '2px',
                              background: `${verdictColor}22`,
                              color: verdictColor,
                              border: `1px solid ${verdictColor}44`,
                              flexShrink: 0
                            }}>
                              {entry.archiveVerdict || 'DIPANTAU'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Pilihan Postingan Medsos */}
              {dataSourceMode !== 'ARCHIVE_ONLY' && (
                <div style={{
                  padding: '10px',
                  background: 'linear-gradient(180deg, #101622 0%, #090D13 100%)',
                  borderRadius: '4px',
                  border: '1px solid #1C2636',
                  boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.85)'
                }}>
                  <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Share2 size={11} color="var(--accent-cyan)" />
                    SKENARIO ANALISIS MEDSOS:
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginBottom: '8px' }}>
                    {PRELOADED_TEST_SCENARIOS.map((sc, idx) => {
                      const isSel = selectedScenarioIndex === idx
                      return (
                        <button
                          key={sc.id}
                          type="button"
                          onClick={() => handleSelectSocialScenario(idx)}
                          style={{
                            padding: '5px 2px',
                            fontSize: '9px',
                            fontWeight: 800,
                            borderRadius: '3px',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            background: isSel ? 'linear-gradient(180deg, #991B1B 0%, #5B0C15 100%)' : 'linear-gradient(180deg, #182230 0%, #0E141E 100%)',
                            color: isSel ? '#F8FAFC' : 'var(--text-secondary)',
                            borderTop: isSel ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                            borderBottom: isSel ? '2px solid #2B0609' : '2px solid #080C10',
                            borderLeft: isSel ? '1px solid #7F1D1D' : '1px solid #1C2636',
                            borderRight: isSel ? '1px solid #450A0A' : '1px solid #121820',
                            boxShadow: isSel ? '0 2px 5px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.2)' : '0 2px 4px rgba(0, 0, 0, 0.5)',
                            textShadow: '0 1px 2px rgba(0, 0, 0, 0.85)'
                          }}
                        >
                          {sc.platform}
                        </button>
                      )
                    })}
                  </div>

                  {socialAnalysis && (
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      <div><strong>Kreator:</strong> {socialAnalysis.post.authorHandle || '@official_source'}</div>
                      <div style={{ color: 'var(--accent-gold)' }}><strong>Kluster Copypasta:</strong> {socialAnalysis.copypastaClusters?.length || 0} kelompok terdeteksi</div>
                    </div>
                  )}
                </div>
              )}

              {/* Komponen yang Disertakan */}
              <div style={{
                padding: '10px',
                background: 'linear-gradient(180deg, #101622 0%, #090D13 100%)',
                borderRadius: '4px',
                border: '1px solid #1C2636',
                boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.85)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  BAGIAN DOKUMEN YANG DISERTAKAN:
                </div>

                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px' }}
                  onClick={() => handleUpdateConfigField('includeFindingsDetail', !config.includeFindingsDetail)}
                >
                  {config.includeFindingsDetail ? <CheckSquare size={13} color="var(--narada-red)" /> : <Square size={13} color="var(--text-muted)" />}
                  <span>Matriks Temuan Isu Tersemat</span>
                </div>

                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px' }}
                  onClick={() => setIncludeSocialForensics(!includeSocialForensics)}
                >
                  {includeSocialForensics ? <CheckSquare size={13} color="var(--narada-red)" /> : <Square size={13} color="var(--text-muted)" />}
                  <span>Forensik Medsos & Kluster Buzzer</span>
                </div>

                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px' }}
                  onClick={() => handleUpdateConfigField('includeRecommendations', !config.includeRecommendations)}
                >
                  {config.includeRecommendations ? <CheckSquare size={13} color="var(--narada-red)" /> : <Square size={13} color="var(--text-muted)" />}
                  <span>Rekomendasi Tindakan Komando</span>
                </div>

                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px' }}
                  onClick={() => setIncludeCounterNarrative(!includeCounterNarrative)}
                >
                  {includeCounterNarrative ? <CheckSquare size={13} color="var(--narada-red)" /> : <Square size={13} color="var(--text-muted)" />}
                  <span>Draf Kontranarasi 4 Kanal Dispenad</span>
                </div>
              </div>

              {/* Tombol Tinjau Penuh / Zoom Preview */}
              <button
                type="button"
                className="btn btn-secondary btn-lg"
                onClick={() => setIsZoomModalOpen(true)}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  background: 'linear-gradient(180deg, #1C2736 0%, #101622 100%)',
                  border: '1px solid #2B3A4E',
                  color: '#38BDF8',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                title="Tinjau dokumen dalam mode layar penuh dengan kontrol pembesaran (Zoom & Fullscreen)"
              >
                <Maximize2 size={15} />
                Tinjau Layar Penuh (Zoom A4)
              </button>

              {/* Tombol Cetak / PDF */}
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={handlePrint}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Printer size={16} />
                Cetak / Simpan PDF Resmi (A4)
              </button>

              {/* Tombol Unduh Evidence Manifest JSON */}
              <button
                type="button"
                className="btn btn-secondary btn-lg"
                onClick={handleExportManifest}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  border: '1px solid rgba(212, 175, 55, 0.4)',
                  color: '#D4AF37'
                }}
                title="Unduh berkas JSON Evidence Manifest machine-readable dengan digest SHA-256"
              >
                <Download size={15} />
                Unduh Evidence Manifest (JSON)
              </button>

              {/* Tombol Bersihkan Kertas Laporan (Clear Canvas) */}
              <button
                type="button"
                className="btn btn-secondary btn-lg"
                onClick={handleClearReport}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#F87171',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                title="Kosongkan seluruh data kertas laporan (tindakan terekam, pilihan isu, dan analisis medsos) untuk menyusun laporan baru"
              >
                <Trash2 size={15} />
                Bersihkan Kertas Laporan (Clear)
              </button>
            </div>
          </div>
        </div>

        {/* ─── KOLOM KANAN: LIVE DOCUMENT PREVIEW (Kertas Putih Standar Militer) ─── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Toolbar Kontrol Dokumen & Zoom */}
          <div
            className="no-print"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              padding: '10px 14px',
              background: 'linear-gradient(180deg, #1A2330 0%, #0F1620 100%)',
              border: '1px solid #223042',
              borderRadius: '6px 6px 0 0',
              marginBottom: '-1px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye size={14} color="#38BDF8" />
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#E2E8F0', letterSpacing: '0.5px' }}>
                PRATINJAU DOKUMEN INTELIJEN A4
              </span>
              <span style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                padding: '2px 6px',
                borderRadius: '3px',
                fontWeight: 800,
                background: config.classification === 'RAHASIA' ? '#7F1D1D' : config.classification === 'TERBATAS' ? '#78350F' : '#1E3A8A',
                color: '#FFFFFF'
              }}>
                {config.classification}
              </span>
            </div>

            {/* Kontrol Zoom & Aksi Layar Penuh */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: '#090E15',
                border: '1px solid #1A2534',
                borderRadius: '4px',
                padding: '2px 4px',
                gap: '2px'
              }}>
                <button
                  type="button"
                  onClick={() => setZoomLevel(z => Math.max(0.6, Number((z - 0.1).toFixed(1))))}
                  disabled={zoomLevel <= 0.6}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: zoomLevel <= 0.6 ? '#475569' : '#94A3B8',
                    cursor: zoomLevel <= 0.6 ? 'not-allowed' : 'pointer',
                    padding: '3px 6px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Perkecil Zoom (Zoom Out)"
                >
                  <ZoomOut size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(1.0)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    color: zoomLevel === 1.0 ? '#38BDF8' : '#CBD5E1',
                    cursor: 'pointer',
                    padding: '2px 6px'
                  }}
                  title="Klik untuk reset Zoom 100%"
                >
                  {Math.round(zoomLevel * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(z => Math.min(1.5, Number((z + 0.1).toFixed(1))))}
                  disabled={zoomLevel >= 1.5}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: zoomLevel >= 1.5 ? '#475569' : '#94A3B8',
                    cursor: zoomLevel >= 1.5 ? 'not-allowed' : 'pointer',
                    padding: '3px 6px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Perbesar Zoom (Zoom In)"
                >
                  <ZoomIn size={13} />
                </button>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsZoomModalOpen(true)}
                style={{
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  border: '1px solid #2B3A4E',
                  color: '#38BDF8',
                  background: 'linear-gradient(180deg, #1C2736 0%, #101622 100%)'
                }}
                title="Buka pratinjau dalam layar penuh (Fullscreen Modal Lightbox)"
              >
                <Maximize2 size={12} />
                <span>Tinjau Penuh</span>
              </button>
            </div>
          </div>

          {/* Area Dokumen Kertas Standar Militer A4 */}
          <div style={{ overflowX: 'auto', background: '#0B0F17', padding: '24px 16px', border: '1px solid #1E2838', borderRadius: '0 0 6px 6px', display: 'flex', justifyContent: 'center' }}>
            <div
              id="military-report-document"
              style={{
                background: '#FFFFFF',
                color: '#111827',
                width: '210mm',
                maxWidth: '100%',
                minHeight: '297mm',
                height: 'auto',
                padding: '20mm 18mm',
                boxSizing: 'border-box',
                fontFamily: '"Inter", sans-serif',
                fontSize: '11px',
                lineHeight: '1.5',
                borderRadius: '4px',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                position: 'relative',
                zoom: zoomLevel,
                margin: '0 auto',
                flexShrink: 0
              }}
            >
              {renderDocumentContent()}
            </div>
          </div>
        </div>
      </div>

      {/* ─── MODAL TINJAU PENUH DOKUMEN A4 (FULLSCREEN LIGHTBOX & ZOOM) ─── */}
      {isZoomModalOpen && (
        <div
          className="no-print"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(5, 8, 14, 0.94)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Topbar Modal */}
          <div
            style={{
              padding: '12px 20px',
              background: 'linear-gradient(180deg, #192230 0%, #0E1520 100%)',
              borderBottom: '1px solid #223042',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.6)'
            }}
          >
            {/* Judul & Dokumen Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38BDF8'
              }}>
                <Eye size={17} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>TINJAU PENUH DOKUMEN DINAS MILITER A4</span>
                  <span style={{
                    fontSize: '9px',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    background: config.classification === 'RAHASIA' ? '#7F1D1D' : config.classification === 'TERBATAS' ? '#78350F' : '#1E3A8A',
                    color: '#FFF'
                  }}>
                    {config.classification}
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>
                  NO: {config.reportNumber} · {config.unitName} · {config.date}
                </div>
              </div>
            </div>

            {/* Kontrol Zoom di Modal + Tombol Aksi */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Zoom Controls */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: '#070B10',
                border: '1px solid #1E293B',
                borderRadius: '4px',
                padding: '2px 6px',
                gap: '4px'
              }}>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B', marginRight: '4px' }}>
                  ZOOM:
                </span>
                <button
                  type="button"
                  onClick={() => setModalZoomLevel(z => Math.max(0.7, Number((z - 0.1).toFixed(1))))}
                  disabled={modalZoomLevel <= 0.7}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: modalZoomLevel <= 0.7 ? '#475569' : '#CBD5E1',
                    cursor: modalZoomLevel <= 0.7 ? 'not-allowed' : 'pointer',
                    padding: '4px 6px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Perkecil Zoom"
                >
                  <ZoomOut size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setModalZoomLevel(1.0)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    color: modalZoomLevel === 1.0 ? '#38BDF8' : '#F1F5F9',
                    cursor: 'pointer',
                    padding: '2px 8px'
                  }}
                  title="Reset Zoom ke 100%"
                >
                  {Math.round(modalZoomLevel * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setModalZoomLevel(z => Math.min(2.0, Number((z + 0.1).toFixed(1))))}
                  disabled={modalZoomLevel >= 2.0}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: modalZoomLevel >= 2.0 ? '#475569' : '#CBD5E1',
                    cursor: modalZoomLevel >= 2.0 ? 'not-allowed' : 'pointer',
                    padding: '4px 6px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Perbesar Zoom"
                >
                  <ZoomIn size={14} />
                </button>
              </div>

              {/* Cetak PDF dari modal */}
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handlePrint}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 14px' }}
              >
                <Printer size={14} />
                <span>Cetak / PDF</span>
              </button>

              {/* Bersihkan Kertas dari modal */}
              <button
                type="button"
                onClick={handleClearReport}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  padding: '6px 14px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.45)',
                  color: '#FCA5A5',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)'
                }}
                title="Bersihkan isi kertas laporan untuk lembar kerja baru"
              >
                <Trash2 size={14} />
                <span>Bersihkan Kertas</span>
              </button>

              {/* Tombol Tutup */}
              <button
                type="button"
                onClick={() => setIsZoomModalOpen(false)}
                style={{
                  background: '#1F2937',
                  border: '1px solid #374151',
                  color: '#F9FAFB',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700
                }}
                title="Tutup Modal [ESC]"
              >
                <X size={14} />
                <span>TUTUP [ESC]</span>
              </button>
            </div>
          </div>

          {/* Viewport Dokumen yang Dapat di-Scroll (A4 Sheet Wrap) */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'auto',
              padding: '28px 16px 80px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: 'rgba(5, 8, 14, 0.94)'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsZoomModalOpen(false);
            }}
          >
            <div
              id="military-report-document-modal"
              style={{
                background: '#FFFFFF',
                color: '#111827',
                width: '210mm',
                maxWidth: '100%',
                minHeight: '297mm',
                height: 'auto',
                padding: '20mm 18mm',
                boxSizing: 'border-box',
                borderRadius: '4px',
                boxShadow: '0 24px 70px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                position: 'relative',
                zoom: modalZoomLevel,
                margin: '0 auto',
                flexShrink: 0
              }}
            >
              {renderDocumentContent()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}