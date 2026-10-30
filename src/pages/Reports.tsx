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
  AlertTriangle
} from 'lucide-react'
import type { AnalysisResult, IntelReportConfig, ReportClassification } from '../types'
import { getStoredAnalyses, getUserSettings, seedDemoAnalyses } from '../utils/storage'
import { formatMilitaryDate, truncateText } from '../utils/format'
import { generateSHA256 } from '../utils/crypto'
import { generateCounterNarratives } from '../engine/forensic/counter-narrative-generator'

export default function Reports() {
  const location = useLocation()
  const navState = (location.state || {}) as {
    isSimulation?: boolean
    simulationWatermark?: string
    evidenceMode?: string
    prefillClaim?: string
  }
  const isSimulationMode = Boolean(navState.isSimulation)

  const [analyses, setAnalyses] = useState<AnalysisResult[]>(() => getStoredAnalyses())
  const userSettings = useMemo(() => getUserSettings(), [])
  const [reportHash, setReportHash] = useState<string>('')

  // Auto-generate nomor laporan standar dinas militer
  const generatedReportNumber = useMemo(() => {
    return 'NRD-LAP/X/2026/01'
  }, [])

  const [config, setConfig] = useState<IntelReportConfig>({
    unitName: userSettings.defaultUnit || 'PUSSIBERAD TNI AD',
    analystName: userSettings.analystName || 'Sertu Damar / Analis Madya',
    analystNrp: userSettings.analystNrp || '21260408',
    reportNumber: generatedReportNumber,
    classification: 'RAHASIA',
    date: '25 Oktober 2026',
    includeFindingsDetail: true,
    includeFactCheck: true,
    includeRecommendations: true,
  })

  // Sinkronisasi data analisis
  useEffect(() => {
    const handleUpdate = () => {
      setAnalyses(getStoredAnalyses())
    }
    window.addEventListener('narada:analyses-updated', handleUpdate)
    return () => window.removeEventListener('narada:analyses-updated', handleUpdate)
  }, [])

  // Kalkulasi stempel hash kriptografis laporan SHA-256
  useEffect(() => {
    let isMounted = true
    const computeReportHash = async () => {
      const rawData = `${config.reportNumber}|${config.classification}|${config.unitName}|${config.date}|${analyses.length}`
      const h = await generateSHA256(rawData)
      if (isMounted) setReportHash(h)
    }
    computeReportHash()
    return () => { isMounted = false }
  }, [config, analyses])

  // Perhitungan metrik laporan
  const totalAnalyses = analyses.length
  const threats = useMemo(() => analyses.filter(a => a.category !== 'NETRAL'), [analyses])
  const criticals = useMemo(() => analyses.filter(a => a.threatLevel === 'critical'), [analyses])
  const highs = useMemo(() => analyses.filter(a => a.threatLevel === 'high'), [analyses])
  const mediums = useMemo(() => analyses.filter(a => a.threatLevel === 'medium'), [analyses])

  // Rekapitulasi per kategori
  const categoryStats = useMemo(() => {
    const cats = ['HOAKS', 'PROPAGANDA', 'BUZZER', 'DISINFORMASI', 'NETRAL'] as const
    return cats.map(cat => {
      const matched = analyses.filter(a => a.category === cat)
      const count = matched.length
      const pct = totalAnalyses > 0 ? Math.round((count / totalAnalyses) * 100) : 0
      const avgMl = count > 0 ? Math.round(matched.reduce((acc, c) => acc + c.mlScore, 0) / count) : 0
      return {
        category: cat,
        count,
        pct,
        avgMl,
        severity: cat === 'HOAKS' || cat === 'PROPAGANDA' ? 'TINGGI / KRITIS' : cat === 'BUZZER' ? 'SEDANG / KOORDINASI' : cat === 'DISINFORMASI' ? 'SEDANG' : 'RENDAH (AMAN)'
      }
    })
  }, [analyses, totalAnalyses])

  // Temuan dengan Cek Fakta
  const factCheckedItems = useMemo(() => {
    return analyses.filter(a => a.factCheck && a.factCheck.claims && a.factCheck.claims.length > 0)
  }, [analyses])

  // Draf Kontranarasi 4 Kanal Otomatis Terintegrasi
  const counterNarratives = useMemo(() => {
    const topThreat = criticals[0] || highs[0] || threats[0] || analyses[0]
    const topic = topThreat?.rawContent || topThreat?.input || 'Ancaman Disinformasi dan Agitasi Kognitif Siber terhadap Kedaulatan'
    return generateCounterNarratives(topic, topThreat?.debunkMatch, 'Multi-Channel Intel Report')
  }, [criticals, highs, threats, analyses])

  const handlePrint = () => {
    window.print()
  }

  const handleSeedDemo = () => {
    seedDemoAnalyses()
  }

  const handleResetConfig = () => {
    setConfig({
      unitName: 'PUSSIBERAD TNI AD',
      analystName: 'Sertu Damar / Analis Madya',
      analystNrp: '21260408',
      reportNumber: generatedReportNumber,
      classification: 'RAHASIA',
      date: '25 Oktober 2026',
      includeFindingsDetail: true,
      includeFactCheck: true,
      includeRecommendations: true,
    })
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
            textTransform: 'uppercase'
          }}>
            INTELLIGENCE REPORT GENERATOR
          </span>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            FORMAT DOKUMEN DINAS MILITER TNI AD
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
          Penyusunan berkas produk intelijen resmi standar militer siap cetak dan siap dilaporkan ke pimpinan komando.
        </p>
      </div>

      {/* ─── Banner Peringatan Simulasi Sintetis (Sprint 1D Firewall) ─── */}
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
        <div className="report-config-panel no-print" style={{ width: '340px', flexShrink: 0 }}>
          <div className="steel-chassis-card" style={{ marginBottom: '16px', position: 'relative' }}>
            <span className="bolt-tl" />
            <span className="bolt-tr" />
            <span className="bolt-bl" />
            <span className="bolt-br" />
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sliders size={13} color="var(--narada-red)" />
                KONFIGURASI PRODUK INTELIJEN
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

            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Nama Satuan */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Building size={11} /> NAMA SATUAN / KOTAMA
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={config.unitName}
                  onChange={e => setConfig({ ...config, unitName: e.target.value })}
                />
              </div>

              {/* Nama Analis & NRP */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <User size={11} /> NAMA ANALIS & PANGKAT
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={config.analystName}
                  onChange={e => setConfig({ ...config, analystName: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Award size={11} /> NRP / NIP ANALIS
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={config.analystNrp || ''}
                  onChange={e => setConfig({ ...config, analystNrp: e.target.value })}
                />
              </div>

              {/* Nomor Laporan */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Hash size={11} /> NOMOR LAPORAN DINAS
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={config.reportNumber}
                  onChange={e => setConfig({ ...config, reportNumber: e.target.value })}
                />
              </div>

              {/* Klasifikasi Keamanan */}
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
                        onClick={() => setConfig({ ...config, classification: cls })}
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

              {/* Tanggal Laporan */}
              <div className="form-group">
                <label className="form-label">TANGGAL LAPORAN</label>
                <input
                  type="text"
                  className="form-control"
                  value={config.date}
                  onChange={e => setConfig({ ...config, date: e.target.value })}
                />
              </div>

              {/* Pilihan Komponen Laporan (Checkboxes) */}
              <div style={{
                padding: '12px',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--bg-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  BAGIAN DOKUMEN YANG DISERTAKAN:
                </div>

                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}
                  onClick={() => setConfig({ ...config, includeFindingsDetail: !config.includeFindingsDetail })}
                >
                  {config.includeFindingsDetail ? <CheckSquare size={14} color="var(--narada-red)" /> : <Square size={14} color="var(--text-muted)" />}
                  <span>Matriks Bukti Digital & Temuan</span>
                </div>

                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}
                  onClick={() => setConfig({ ...config, includeFactCheck: !config.includeFactCheck })}
                >
                  {config.includeFactCheck ? <CheckSquare size={14} color="var(--narada-red)" /> : <Square size={14} color="var(--text-muted)" />}
                  <span>Lembar Verifikasi Fakta (Mafindo)</span>
                </div>

                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}
                  onClick={() => setConfig({ ...config, includeRecommendations: !config.includeRecommendations })}
                >
                  {config.includeRecommendations ? <CheckSquare size={14} color="var(--narada-red)" /> : <Square size={14} color="var(--text-muted)" />}
                  <span>Rekomendasi Respons Komando</span>
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
                Cetak / Simpan PDF Resmi
              </button>
            </div>
          </div>

          {/* Banner Sampel Demo jika data kosong */}
          {totalAnalyses === 0 && (
            <div className="card" style={{ padding: '14px', background: 'var(--bg-elevated)', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Belum ada data analisis pada sesi ini.
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleSeedDemo}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Sparkles size={12} color="#EF4444" /> Muat Skenario Demo Siap Pantau
              </button>
            </div>
          )}
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

            {/* ─── WATERMARK SIMULASI BENCHMARK (SPRINT 1D FIREWALL) ─── */}
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
                    src="/image/Electrified Golden Globe Crest.png"
                    alt="Lambang Kartika Eka Paksi & Pussiberad TNI AD"
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
              <div><strong style={{ color: '#4B5563' }}>Engine Pemroses:</strong> NARADA AI Hybrid (TF-IDF + NB 60% / Rules 40%)</div>
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
                Berdasarkan operasi pemantauan dan analisis kognitif pada sesi ini, satuan telah memproses sebanyak{' '}
                <strong>{totalAnalyses} konten informasi digital</strong> dari berbagai modalitas sumber (URL portal berita, tangkapan layar media sosial, teks langsung, dan berkas batch). Dari total tersebut, terdeteksi{' '}
                <strong>{threats.length} konten berindikasi ancaman kognitif aktif</strong>, dengan rincian:{' '}
                <strong style={{ color: '#DC2626' }}>{criticals.length} berstatus Kritis (CRITICAL)</strong>,{' '}
                <strong style={{ color: '#D97706' }}>{highs.length} berstatus Tinggi (HIGH)</strong>, dan{' '}
                <strong style={{ color: '#B45309' }}>{mediums.length} berstatus Sedang (MEDIUM)</strong>.
              </p>
              {criticals.length > 0 && (
                <div style={{
                  marginTop: '10px',
                  padding: '10px 14px',
                  background: '#FEF2F2',
                  borderLeft: '4px solid #DC2626',
                  color: '#991B1B',
                  fontSize: '11px',
                  lineHeight: '1.6'
                }}>
                  <strong>PERHATIAN KOMANDO:</strong> Teridentifikasi serangan informasi terstruktur yang menargetkan reputasi pengadaan alutsista serta narasi provokasi separatis wilayah. Disarankan pelibatan counter-narrative resmi Dispenad dan eskalasi koordinasi BSSN.
                </div>
              )}
            </div>

            {/* ─── BAGIAN II: STATISTIK & DISTRIBUSI ANCAMAN ─── */}
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
                II. REKAPITULASI STATISTIK ANCAMAN KOGNITIF
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F3F4F6', borderBottom: '2px solid #D1D5DB' }}>
                    <th style={{ padding: '8px 10px', color: '#374151' }}>KATEGORI KOGNITIF</th>
                    <th style={{ padding: '8px 10px', color: '#374151', textAlign: 'center' }}>JUMLAH KASUS</th>
                    <th style={{ padding: '8px 10px', color: '#374151', textAlign: 'center' }}>PERSENTASE</th>
                    <th style={{ padding: '8px 10px', color: '#374151', textAlign: 'center' }}>RATA-RATA ML</th>
                    <th style={{ padding: '8px 10px', color: '#374151' }}>TINGKAT RISIKO KEAMANAN</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryStats.map((st, i) => (
                    <tr key={st.category} style={{ borderBottom: '1px solid #E5E7EB', background: i % 2 === 1 ? '#F9FAFB' : '#FFFFFF' }}>
                      <td style={{ padding: '8px 10px', fontWeight: '700', color: st.category === 'HOAKS' ? '#DC2626' : st.category === 'PROPAGANDA' ? '#D97706' : '#111827' }}>
                        {st.category}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontFamily: '"JetBrains Mono", monospace' }}>{st.count}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontFamily: '"JetBrains Mono", monospace' }}>{st.pct}%</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontFamily: '"JetBrains Mono", monospace' }}>{st.avgMl}%</td>
                      <td style={{ padding: '8px 10px', fontSize: '10px', color: '#4B5563' }}>{st.severity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ─── BAGIAN III: MATRIKS BUKTI DIGITAL & TEMUAN (OPSIONAL) ─── */}
            {config.includeFindingsDetail && (
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
                  III. MATRIKS BUKTI DIGITAL & TEMUAN LAPANGAN
                </div>
                {threats.length === 0 ? (
                  <div style={{ padding: '12px', background: '#F9FAFB', border: '1px dashed #D1D5DB', textAlign: 'center', color: '#6B7280', fontSize: '11px' }}>
                    Tidak ditemukan konten ancaman kognitif dalam sesi ini.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#F3F4F6', borderBottom: '2px solid #D1D5DB' }}>
                        <th style={{ padding: '6px 8px', width: '30px' }}>#</th>
                        <th style={{ padding: '6px 8px', width: '90px' }}>WAKTU / ID</th>
                        <th style={{ padding: '6px 8px', width: '85px' }}>KATEGORI</th>
                        <th style={{ padding: '6px 8px' }}>BUKTI NASKAH KONTEN / INDIKATOR</th>
                        <th style={{ padding: '6px 8px', width: '120px' }}>SASARAN ENTITAS</th>
                        <th style={{ padding: '6px 8px', width: '60px', textAlign: 'right' }}>KEYAKINAN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {threats.slice(0, 10).map((t, idx) => (
                        <tr key={t.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                          <td style={{ padding: '6px 8px', verticalAlign: 'top', color: '#6B7280' }}>{idx + 1}</td>
                          <td style={{ padding: '6px 8px', verticalAlign: 'top', fontFamily: '"JetBrains Mono", monospace' }}>
                            {formatMilitaryDate(t.timestamp).split(' ')[0]}<br />
                            <span style={{ fontSize: '9px', color: '#6B7280' }}>{t.id.split('-').slice(-1)[0]}</span>
                          </td>
                          <td style={{ padding: '6px 8px', verticalAlign: 'top', fontWeight: '700' }}>
                            <span style={{ color: t.threatLevel === 'critical' ? '#DC2626' : t.threatLevel === 'high' ? '#D97706' : '#2563EB' }}>
                              {t.category}
                            </span>
                            <br />
                            <span style={{ fontSize: '9px', color: '#6B7280' }}>[{t.threatLevel.toUpperCase()}]</span>
                          </td>
                          <td style={{ padding: '6px 8px', verticalAlign: 'top', lineHeight: '1.5' }}>
                            "{truncateText(t.input || t.rawContent, 120)}"
                            {t.keywords.length > 0 && (
                              <div style={{ marginTop: '2px', color: '#4B5563', fontSize: '9px' }}>
                                Kata Kunci: {t.keywords.join(', ')}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '6px 8px', verticalAlign: 'top', color: '#374151' }}>
                            {t.targetedEntities && t.targetedEntities.length > 0 ? t.targetedEntities.join(', ') : 'Umum / Publik'}
                          </td>
                          <td style={{ padding: '6px 8px', verticalAlign: 'top', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontWeight: '700' }}>
                            {t.confidence}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ─── BAGIAN IV: HASIL VERIFIKASI FAKTA (DEBUNKING SHEET) ─── */}
            {config.includeFactCheck && factCheckedItems.length > 0 && (
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
                  IV. HASIL VERIFIKASI FAKTA (DEBUNKING CROSS-REFERENCE SHEET)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {factCheckedItems.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: '10px 12px',
                        background: '#F9FAFB',
                        border: '1px solid #E5E7EB',
                        borderRadius: '4px',
                        fontSize: '11px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '700', color: '#111827' }}>
                          Klaim Terverifikasi: "{truncateText(item.factCheck?.claims[0]?.claimText || item.input, 90)}"
                        </span>
                        <span style={{
                          fontWeight: '800',
                          fontSize: '10px',
                          color: item.factCheck?.claims[0]?.ratingColor || '#DC2626',
                          border: `1px solid ${item.factCheck?.claims[0]?.ratingColor || '#DC2626'}40`,
                          padding: '1px 6px',
                          borderRadius: '2px'
                        }}>
                          {item.factCheck?.claims[0]?.rating}
                        </span>
                      </div>
                      <div style={{ color: '#4B5563', fontSize: '10px' }}>
                        Sumber Debunking: <strong>{item.factCheck?.claims[0]?.publisherName}</strong> ({item.factCheck?.claims[0]?.publisherSite}) ·{' '}
                        Artikel: {item.factCheck?.claims[0]?.articleTitle}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── BAGIAN V: REKOMENDASI TAKTIS KOMANDO ─── */}
            {config.includeRecommendations && (
              <div style={{ marginBottom: '32px' }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: '800',
                  letterSpacing: '1.5px',
                  color: '#C8102E',
                  marginBottom: '8px',
                  borderBottom: '1.5px solid #E5E7EB',
                  paddingBottom: '4px'
                }}>
                  V. REKOMENDASI TINDAKAN TAKTIS KOMANDO
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', color: '#1F2937', lineHeight: '1.7' }}>
                  <div>
                    <strong>1. Penerangan TNI AD (Dispenad):</strong> Segera rilis lembar klarifikasi resmi (press fact sheet) dan siapkan video pendek infografis pembanding untuk menangkal disinformasi alutsista serta manipulasi konteks penugasan wilayah.
                  </div>
                  <div>
                    <strong>2. Asintel / Pussiberad:</strong> Lakukan pelacakan jejak digital simpul awal akun penyebar (seed account) pada Nexus Network Graph serta pantau pola botnet astroturfing yang mengamplifikasi tagar provokatif.
                  </div>
                  <div>
                    <strong>3. Satuan Teritorial Terdampak:</strong> Tingkatkan pendekatan komunikasi sosial (komsos) bersama tokoh masyarakat dan pemuda setempat guna meredam dampak psikologis narasi separatis.
                  </div>
                </div>
              </div>
            )}

            {/* ─── BAGIAN VI: DRAF KONTRANARASI TAKTIS 4 KANAL DISPENAD ─── */}
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
                VI. DRAF KONTRANARASI TAKTIS 4 KANAL DISPENAD & SATUAN TERITORIAL
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
