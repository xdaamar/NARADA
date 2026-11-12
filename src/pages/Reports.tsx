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
  Layers
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

  // ─── 1. INTEGRASI DATA BERITA TERSEMAT (LIVE ARSIP) ───
  const [archivedEntries, setArchivedEntries] = useState<ArchivedDebunkEntry[]>(() => {
    let existing = getArchivedEntries()
    if (existing.length === 0) {
      const cur = getCuratedArchiveDebunks()
      if (cur.length > 0) {
        const samples = [
          cur.find(c => c.cluster === 'KEDAULATAN_MILITER') || cur[0],
          cur.find(c => c.cluster === 'SIBER_PERETASAN') || cur[1],
          cur.find(c => c.cluster === 'POLITIK_NEGARA') || cur[2]
        ].filter(Boolean) as typeof cur
        samples.forEach(item => archiveIssue(item))
        existing = getArchivedEntries()
      }
    }
    return existing
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

  // ─── 2. INTEGRASI DATA ANALISIS MEDSOS TERKINI ───
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState<number>(0)
  const [socialAnalysis, setSocialAnalysis] = useState<SocialPostAnalysisResult | null>(() => {
    try {
      const raw = sessionStorage.getItem('narada_latest_social_analysis')
      if (raw) return JSON.parse(raw)
    } catch {}
    return PRELOADED_TEST_SCENARIOS[0]?.mockResult || null
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
  const userSettings = useMemo(() => getUserSettings(), [])

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
    analystName: userSettings.analystName || 'Sertu Damar / Analis Madya',
    analystNrp: userSettings.analystNrp || '21260408',
    reportNumber: generatedReportNumber,
    classification: 'RAHASIA',
    date: todayMilitary,
    includeFindingsDetail: true,
    includeFactCheck: true,
    includeRecommendations: true,
  })

  // Mode cakupan sumber data pada dokumen:
  // 'ALL' = Gabungan Berita Tersemat + Analisis Medsos
  // 'ARCHIVE_ONLY' = Berita Tersemat Saja
  // 'SOCIAL_ONLY' = Analisis Medsos Saja
  const [dataSourceMode, setDataSourceMode] = useState<'ALL' | 'ARCHIVE_ONLY' | 'SOCIAL_ONLY'>('ALL')
  const [includeSocialForensics, setIncludeSocialForensics] = useState<boolean>(true)
  const [includeCounterNarrative, setIncludeCounterNarrative] = useState<boolean>(true)

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
      analystName: 'Sertu Damar / Analis Madya',
      analystNrp: '21260408',
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

  return (
    <div className="fade-in" style={{ paddingBottom: '32px' }}>
      {/* ─── Header Operasional ─── */}
      <div className="no-print" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            padding: '2px 8px',
            borderRadius: '3px',
            background: 'var(--narada-red-subtle)',
            color: 'var(--narada-red)',
            border: '1px solid rgba(200, 16, 46, 0.3)',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            fontWeight: 700
          }}>
            INTELLIGENCE REPORT GENERATOR
          </span>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            /// FORMAT DOKUMEN DINAS MILITER TNI AD (A4 RESMI)
          </span>
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '24px',
          fontWeight: '800',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          color: 'var(--text-primary)'
        }}>
          Laporan Intelijen Ancaman Kognitif & Siber
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Penyusunan produk telaahan intelijen komando militer yang terhubung langsung dengan <strong>Berita Tersemat</strong> dan <strong>Analisis Medsos</strong> terkini, siap cetak standar A4 resmi dengan stempel SHA-256.
        </p>
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
                IDENTITAS & KOP DOKUMEN MILITER
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleResetConfig}
                title="Atur Ulang Pengaturan Default"
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
                  placeholder="PUSSIBERAD TNI AD"
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
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">TANGGAL DINAS</label>
                  <input
                    type="text"
                    className="form-control"
                    value={config.date}
                    onChange={e => handleUpdateConfigField('date', e.target.value)}
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
                    const activeColor = cls === 'RAHASIA' ? '#C8102E' : cls === 'TERBATAS' ? '#D97706' : '#2563EB'
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
                          transition: 'all 0.2s ease',
                          background: isSelected ? activeColor : 'var(--bg-elevated)',
                          color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                          border: isSelected ? `1px solid ${activeColor}` : '1px solid var(--border-subtle)',
                          boxShadow: isSelected ? `0 0 10px ${activeColor}55` : 'none',
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
              {/* Pilihan Cakupan Sumber Data */}
              <div className="form-group">
                <label className="form-label">CAKUPAN SUMBER INTELIJEN</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginTop: '4px' }}>
                  {[
                    { key: 'ALL', label: 'Gabungan' },
                    { key: 'ARCHIVE_ONLY', label: 'Tersemat' },
                    { key: 'SOCIAL_ONLY', label: 'Medsos' }
                  ].map(m => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setDataSourceMode(m.key as any)}
                      style={{
                        padding: '6px 4px',
                        fontSize: '10px',
                        fontWeight: '700',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        background: dataSourceMode === m.key ? 'var(--steel-plate-active)' : 'var(--bg-elevated)',
                        color: dataSourceMode === m.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                        border: dataSourceMode === m.key ? '1px solid var(--border-focus)' : '1px solid var(--border-subtle)'
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Checklist Isu Berita Tersemat */}
              {dataSourceMode !== 'SOCIAL_ONLY' && (
                <div style={{
                  padding: '10px',
                  background: 'var(--bg-elevated)',
                  borderRadius: '4px',
                  border: '1px solid var(--border-subtle)'
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
                  background: 'var(--bg-elevated)',
                  borderRadius: '4px',
                  border: '1px solid var(--border-subtle)'
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
                            padding: '4px 2px',
                            fontSize: '9px',
                            fontWeight: 800,
                            borderRadius: '3px',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            background: isSel ? 'var(--narada-red)' : 'var(--bg-tertiary)',
                            color: isSel ? '#FFFFFF' : 'var(--text-secondary)',
                            border: isSel ? '1px solid var(--narada-red)' : '1px solid var(--border-subtle)'
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
                background: 'var(--bg-elevated)',
                borderRadius: '4px',
                border: '1px solid var(--border-subtle)',
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
            </div>
          </div>
        </div>

        {/* ─── KOLOM KANAN: LIVE DOCUMENT PREVIEW (Kertas Putih Standar Militer) ─── */}
        <div style={{ flex: 1, minWidth: 0, overflowX: 'auto' }}>
          <div
            id="military-report-document"
            style={{
              background: '#FFFFFF',
              color: '#111827',
              padding: '48px 56px',
              fontFamily: '"Inter", sans-serif',
              fontSize: '12px',
              lineHeight: '1.6',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
              minHeight: '840px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
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
                Berdasarkan operasi pemantauan dan analisis kognitif siber pada sesi ini, satuan telah mengevaluasi sebanyak{' '}
                <strong>{activeArchiveItems.length} isu berita tersemat</strong> dan{' '}
                <strong>{socialAnalysis ? '1 investigasi mendalam postingan media sosial' : '0 postingan medsos'}</strong>. 
                Dari penelaahan data silang (*cross-corroboration*), teridentifikasi{' '}
                <strong style={{ color: '#DC2626' }}>{archiveStats.hoaksCount} materi HOAKS/DISINFORMASI terkonfirmasi</strong>,{' '}
                <strong style={{ color: '#16A34A' }}>{archiveStats.faktaCount} materi FAKTA/KLARIFIKASI resmi</strong>, dan{' '}
                <strong style={{ color: '#D97706' }}>{archiveStats.dipantauCount} materi SEDANG DIPANTAU</strong> secara berkala.
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
            {includeSocialForensics && dataSourceMode !== 'ARCHIVE_ONLY' && socialAnalysis && (
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
                  {config.analystName.toUpperCase()}
                </div>
                <div style={{ color: '#4B5563', fontSize: '10px' }}>NRP. {config.analystNrp || '21260408'}</div>
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
          </div>
        </div>
      </div>
    </div>
  )
}
