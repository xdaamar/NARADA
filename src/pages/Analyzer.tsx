import { useState, useEffect, useMemo } from 'react'
import {
  Link as LinkIcon,
  Scan,
  FileText,
  FileSpreadsheet,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  History,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Radar,
  Zap,
  Clock,
  Keyboard,
  Target
} from 'lucide-react'
import URLInput from '../components/URLInput'
import OCRUploader from '../components/OCRUploader'
import BatchUploader from '../components/BatchUploader'
import AnalysisResultCard from '../components/AnalysisResultCard'
import FactCheckPanel from '../components/FactCheckPanel'
import { analyzeHybrid } from '../engine/combiner'
import { verifyFactCheck } from '../engine/fact-checker'
import { saveAnalysis, getStoredAnalyses, clearStoredAnalyses } from '../utils/storage'
import { getCategoryBadge, getThreatBadge, formatMilitaryDate, truncateText } from '../utils/format'
import { generateSHA256 } from '../utils/crypto'
import type { AnalysisResult, InputSourceType } from '../types'

type ActiveTab = 'url' | 'ocr' | 'text' | 'file'

// ─── 4 Preset Simulasi Krisis Operasional TNI AD (1-Click Demo Injector) ───
const CRISIS_SIMULATION_PRESETS = [
  {
    id: 'crisis_alutsista',
    title: '🎯 Skenario 1: Alutsista Fiktif',
    targetCategory: 'HOAKS',
    targetThreat: 'CRITICAL',
    badgeColor: '#EF4444',
    text: 'Beredar selebaran dokumen rahasia pembelian 20 unit Tank Tempur dan alutsista fiktif anggaran 24 triliun Kemhan RI. Rezim berupaya keras menutup-nutupi korupsi anggaran pertahanan negara ini. Viralkan sebelum dihapus kominfo!',
  },
  {
    id: 'crisis_papua',
    title: '🎯 Skenario 2: Agitasi Separatisme',
    targetCategory: 'PROPAGANDA',
    targetThreat: 'CRITICAL',
    badgeColor: '#F97316',
    text: 'Seruan konsolidasi dan boikot pemilu untuk seluruh kawan di Papua Barat! Rezim militer NKRI adalah penjajah di tanah kami. Rebut kembali hak kedaulatan bangsa Papua dan tuntut referendum kemerdekaan sekarang juga!',
  },
  {
    id: 'crisis_buzzer',
    title: '🎯 Skenario 3: Buzzer Netralitas TNI',
    targetCategory: 'BUZZER',
    targetThreat: 'HIGH',
    badgeColor: '#F59E0B',
    text: 'Aparat dituding memihak salah satu paslon dalam pengamanan logistik TPS! Sebarkan serentak malam ini pukul 20.00 WIB kawan-kawan! Kita bikin trending topik nomor satu untuk membongkar kecurangan ini!',
  },
  {
    id: 'crisis_disinfo',
    title: '🎯 Skenario 4: Disinformasi Konflik',
    targetCategory: 'DISINFORMASI',
    targetThreat: 'MEDIUM',
    badgeColor: '#8B5CF6',
    text: 'DARURAT! Beredar video kontak tembak di pos pengamanan perbatasan yang sengaja ditutupi media nasional. Warga sekitar ketakutan dan bersiap mengungsi malam ini juga! Jangan percaya bantahan aparat sebelum terlambat!',
  },
]

// Kamus Frasa Sensitif untuk Live Pre-Flight Heuristics
const SENSITIVE_PREFLIGHT_TERMS = [
  'viralkan', 'darurat', 'rahasia', 'fiktif', 'boikot', 'separatis', 'penjajah',
  'trending', 'korupsi', 'serang', 'serbuan', 'adu domba', 'palsu', 'menutup-nutupi',
  'referendum', 'makar', 'habisi', 'bahaya', 'bocor', 'hancurkan'
]

// ─── Sampel Teks Demo Cepat untuk Tab Teks Langsung ───
const QUICK_TEXT_SAMPLES = [
  {
    label: 'Contoh: Hoaks TNI',
    category: 'HOAKS',
    color: '#EF4444',
    text: 'BAHAYA!! Beredar kabar bahwa TNI AD berencana memberlakukan operasi rahasia dan mengambil alih logistik sipil secara paksa. Segera SEBARKAN dan VIRALKAN ke semua grup WhatsApp! Jangan percaya bantahan pemerintah yang selama ini membohongi rakyat!'
  },
  {
    label: 'Contoh: Propaganda',
    category: 'PROPAGANDA',
    color: '#F97316',
    text: 'Rezim militer NKRI adalah penjajah di tanah kami! Bangkitlah kawan-kawan pejuang kemerdekaan Papua Barat, boikot seluruh pos komando Kodam dan rebut kembali hak kedaulatan adat kita! Merdeka atau mati melawan penindas!'
  },
  {
    label: 'Contoh: Buzzer Koordinasi',
    category: 'BUZZER',
    color: '#F59E0B',
    text: 'Ayo kawan-kawan relawan, retweet dan share postingan ini serentak malam ini pukul 20.00 WIB! Tag 10 akun teman kalian! Kita harus kompak dan solid viralkan narasi ini agar trending topik nomor satu di Indonesia!'
  },
  {
    label: 'Contoh: Berita Netral',
    category: 'NETRAL',
    color: '#22C55E',
    text: 'Prajurit TNI Angkatan Darat dari Kodim 0734 bersama warga masyarakat menggelar program bakti sosial gotong royong pembersihan aliran sungai dan perbaikan saluran drainase untuk mencegah risiko bencana hidrometeorologi di wilayah Yogyakarta.'
  }
]

export default function Analyzer() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('text')
  const [directText, setDirectText] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null)
  const [history, setHistory] = useState<AnalysisResult[]>(() => getStoredAnalyses())
  const [isHistoryExpanded, setIsHistoryExpanded] = useState<boolean>(true)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Dengarkan perubahan reaktif dari sessionStorage
  useEffect(() => {
    const handleStorageUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<AnalysisResult[]>
      if (customEvent.detail) {
        setHistory(customEvent.detail)
      } else {
        setHistory(getStoredAnalyses())
      }
    }

    window.addEventListener('narada:analyses-updated', handleStorageUpdate)
    return () => {
      window.removeEventListener('narada:analyses-updated', handleStorageUpdate)
    }
  }, [])

  /**
   * Menjalankan Analisis Hybrid & Fact-Checking Terpadu
   */
  const executeAnalysis = async (
    textToAnalyze: string,
    source: InputSourceType,
    title?: string,
    sourceMeta?: {
      author?: string | null
      siteName?: string
      url?: string
      imagePreview?: string
    }
  ) => {
    const trimmed = textToAnalyze.trim()
    if (trimmed.length < 10) {
      setValidationError('Teks terlalu pendek. Minimal 10 karakter untuk dianalisis oleh AI Engine.')
      return
    }

    setValidationError(null)
    setIsAnalyzing(true)

    // Simulasi delay mikro pemrosesan taktis militer
    await new Promise(resolve => setTimeout(resolve, 400))

    try {
      // 1. Eksekusi AI Hybrid Combiner (ML + Rules)
      const analysisResult = analyzeHybrid(trimmed, {
        inputSource: source,
        title,
        sourceMeta,
      })

      // 2. Jalankan Fact-Check verifier secara terintegrasi
      const factCheckResult = await verifyFactCheck(trimmed)
      analysisResult.factCheck = factCheckResult

      // 3. TASK H.3: Hitung SHA-256 Checksum Integritas Forensik
      analysisResult.forensicHash = await generateSHA256(trimmed)

      // 4. Simpan ke sessionStorage & state aktif
      saveAnalysis(analysisResult)
      setCurrentResult(analysisResult)
      setHistory(getStoredAnalyses())
    } catch (error) {
      console.error('[NARADA Analyzer] Eksekusi analisis gagal:', error)
      setValidationError('Terjadi kesalahan saat memproses analisis kognitif.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  /**
   * Handler untuk input teks manual
   */
  const handleDirectTextSubmit = () => {
    if (!directText.trim()) {
      setValidationError('Harap masukkan teks postingan atau komentar terlebih dahulu.')
      return
    }
    executeAnalysis(directText, 'text', 'Analisis Naskah Teks')
  }

  const handleSelectSample = (sampleText: string) => {
    setDirectText(sampleText)
    setValidationError(null)
  }

  const handleSelectCrisisScenario = (scenarioText: string) => {
    setActiveTab('text')
    setDirectText(scenarioText)
    setValidationError(null)
  }

  const handleClearDirectText = () => {
    setDirectText('')
    setValidationError(null)
  }

  const handleClearHistory = () => {
    if (window.confirm('Bersihkan seluruh riwayat analisis sesi ini?')) {
      clearStoredAnalyses()
      setHistory([])
      setCurrentResult(null)
    }
  }

  // ─── TASK H.4: Live Pre-Flight Heuristics ───
  const wordCount = directText.trim() === '' ? 0 : directText.trim().split(/\s+/).filter(Boolean).length
  const charCount = directText.length

  const estimatedReadTimeSec = useMemo(() => {
    if (wordCount === 0) return 0
    return Math.max(1, Math.ceil(wordCount / 3.5))
  }, [wordCount])

  const detectedRiskTerms = useMemo(() => {
    if (!directText || directText.length < 5) return []
    const norm = directText.toLowerCase()
    return SENSITIVE_PREFLIGHT_TERMS.filter(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'i')
      return regex.test(norm)
    })
  }, [directText])

  return (
    <div className="fade-in" style={{ paddingBottom: '32px' }}>
      {/* ─── Page Title Header ─── */}
      <div style={{ marginBottom: '22px' }}>
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
            FASE 2 · MULTI-INPUT SENSORY SUITE
          </span>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            PUSSIBERAD TNI AD
          </span>
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '24px',
          fontWeight: '800',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          marginBottom: '6px',
          color: 'var(--text-primary)'
        }}>
          Multi-Input Cognitive Threat Analyzer
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Penerimaan dan analisis ancaman kognitif melalui 4 modalitas: URL portal berita, Screenshot OCR neural, Naskah teks langsung, dan Berkas batch massal.
        </p>
      </div>

      {/* ─── TASK H.4: BAR 4 PRESET SIMULASI KRISIS OPERASIONAL TNI AD (1-CLICK INJECTOR) ─── */}
      <div style={{
        marginBottom: '18px',
        padding: '12px 16px',
        background: 'linear-gradient(90deg, rgba(200, 16, 46, 0.12), rgba(30, 41, 59, 0.4))',
        border: '1px solid rgba(200, 16, 46, 0.35)',
        borderRadius: 'var(--radius-md)',
      }}>
        <div style={{
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '1.5px',
          color: 'var(--narada-red)',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '6px'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}>
            <Target size={12} /> SKENARIO SIMULASI KRISIS OPERASIONAL TNI AD (1-CLICK DEMO INJECTOR)
          </span>
          <span style={{ color: 'var(--text-dim)', fontSize: '9px' }}>
            Siap Uji Langsung untuk Dewan Juri
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '8px' }}>
          {CRISIS_SIMULATION_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleSelectCrisisScenario(preset.text)}
              style={{
                justifyContent: 'flex-start',
                textAlign: 'left',
                padding: '8px 10px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--bg-border)',
                height: 'auto'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {preset.title}
                  </span>
                  <span style={{
                    fontSize: '8px',
                    fontFamily: 'var(--font-mono)',
                    padding: '1px 5px',
                    borderRadius: '2px',
                    background: `${preset.badgeColor}20`,
                    color: preset.badgeColor,
                    border: `1px solid ${preset.badgeColor}40`
                  }}>
                    {preset.targetCategory}
                  </span>
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {preset.text}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ─── 4 Modalitas Tab Navigation ─── */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '18px',
        borderBottom: '1px solid var(--bg-border)',
        paddingBottom: '12px',
        flexWrap: 'wrap'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('text')}
          className={`btn ${activeTab === 'text' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <FileText size={14} />
          📝 Teks Langsung
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('url')}
          className={`btn ${activeTab === 'url' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <LinkIcon size={14} />
          🔗 URL Berita & Medsos
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ocr')}
          className={`btn ${activeTab === 'ocr' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Scan size={14} />
          📸 Screenshot OCR (Tesseract)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('file')}
          className={`btn ${activeTab === 'file' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <FileSpreadsheet size={14} />
          📁 Batch File (.CSV / .TXT)
        </button>
      </div>

      {/* ─── 2 Kolom Layout: Input di Kiri, Result di Kanan ─── */}
      <div className="grid-2" style={{ gridTemplateColumns: '1.05fr 0.95fr', alignItems: 'start', gap: '20px' }}>
        {/* Kolom Kiri: Panel Input Sesuai Tab Aktif */}
        <div>
          {/* TAB 1: TEKS LANGSUNG */}
          {activeTab === 'text' && (
            <div className="card fade-in">
              <div className="card-header">
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={14} color="var(--narada-red)" />
                  INPUT TEKS KONTEN LANGSUNG
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {wordCount} kata · {directText.length} karakter
                  </span>
                  {directText && (
                    <button className="btn btn-ghost btn-sm" onClick={handleClearDirectText} title="Bersihkan Teks">
                      <RotateCcw size={12} />
                    </button>
                  )}
                </div>
              </div>

              <div className="card-body">
                {/* Tombol Sampel Cepat */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '1.5px',
                    color: 'var(--text-muted)',
                    marginBottom: '8px'
                  }}>
                    SAMPEL DEMO SKENARIO INTELIJEN
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {QUICK_TEXT_SAMPLES.map(sample => (
                      <button
                        key={sample.label}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleSelectSample(sample.text)}
                      >
                        <Sparkles size={11} color={sample.color} />
                        {sample.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Textarea dengan Hotkey Ctrl+Enter & Escape */}
                <textarea
                  className="form-control"
                  placeholder="Ketik atau tempel (paste) naskah postingan media sosial, pesan broadcast grup percakapan, atau cuplikan berita di sini...&#10;&#10;Contoh:&#10;• Postingan mencurigakan terkait pertahanan atau personel TNI&#10;• Narasi separatis atau propaganda kedaulatan wilayah&#10;• Pola pesan serentak ajakan aksi demonstrasi buzzer"
                  value={directText}
                  onChange={(e) => {
                    setDirectText(e.target.value)
                    if (validationError) setValidationError(null)
                  }}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault()
                      handleDirectTextSubmit()
                    }
                    if (e.key === 'Escape') {
                      setValidationError(null)
                    }
                  }}
                  rows={12}
                  style={{ minHeight: '260px' }}
                />

                {/* ─── TASK H.4: LIVE PRE-FLIGHT HEURISTICS BAR ─── */}
                <div style={{
                  marginTop: '8px',
                  padding: '8px 12px',
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--bg-border)',
                  fontSize: '11px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    <span>{wordCount} kata</span>
                    <span>·</span>
                    <span>{charCount} karakter</span>
                    <span>·</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={11} color="var(--text-dim)" />
                      ~{estimatedReadTimeSec} detik baca
                    </span>
                  </div>

                  {/* Deteksi Dini Frasa Berisiko */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {detectedRiskTerms.length > 0 ? (
                      <span style={{
                        color: '#F97316',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px'
                      }}>
                        <Zap size={11} color="#F97316" />
                        <strong>{detectedRiskTerms.length} Frasa Berisiko:</strong> {detectedRiskTerms.slice(0, 3).join(', ')}
                      </span>
                    ) : wordCount > 5 ? (
                      <span style={{
                        color: 'var(--threat-low)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px'
                      }}>
                        <CheckCircle2 size={11} />
                        Pra-skrining: Netral
                      </span>
                    ) : (
                      <span style={{
                        color: 'var(--text-dim)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)'
                      }}>
                        <Keyboard size={11} />
                        Ctrl + Enter untuk analisis
                      </span>
                    )}
                  </div>
                </div>

                {/* Validasi Error jika ada */}
                {validationError && (
                  <div style={{
                    marginTop: '10px',
                    padding: '10px 12px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    color: '#FCA5A5'
                  }}>
                    <AlertTriangle size={14} color="#EF4444" style={{ flexShrink: 0 }} />
                    {validationError}
                  </div>
                )}

                {/* Tombol Eksekusi Analisis */}
                <div style={{ marginTop: '14px', display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-lg"
                    onClick={handleDirectTextSubmit}
                    disabled={isAnalyzing || !directText.trim()}
                    style={{ flex: 1 }}
                  >
                    {isAnalyzing ? (
                      <>
                        <div className="loading-dots">
                          <span /><span /><span />
                        </div>
                        Menganalisis Kognitif...
                      </>
                    ) : (
                      <>
                        <Scan size={16} />
                        Jalankan Analisis Kognitif Instan
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: URL ANALYZER */}
          {activeTab === 'url' && (
            <URLInput
              isAnalyzing={isAnalyzing}
              onAnalyze={({ text, source, title, sourceMeta }) => {
                executeAnalysis(text, source, title, sourceMeta)
              }}
            />
          )}

          {/* TAB 3: OCR ANALYZER */}
          {activeTab === 'ocr' && (
            <OCRUploader
              isAnalyzing={isAnalyzing}
              onAnalyze={({ text, source, title, imagePreview }) => {
                executeAnalysis(text, source, title, { imagePreview })
              }}
            />
          )}

          {/* TAB 4: BATCH ANALYZER */}
          {activeTab === 'file' && (
            <BatchUploader
              isGlobalAnalyzing={isAnalyzing}
              onSelectResult={(selected) => {
                setCurrentResult(selected)
              }}
            />
          )}
        </div>

        {/* Kolom Kanan: Panel Hasil Analisis & Fact-Check */}
        <div>
          {/* Keadaan 1: Belum Ada Analisis & Sedang Tidak Memproses */}
          {!currentResult && !isAnalyzing && (
            <div className="card">
              <div className="empty-state" style={{ padding: '80px 24px' }}>
                <Radar size={48} className="empty-icon" color="var(--narada-red)" style={{ opacity: 0.35 }} />
                <div className="empty-title" style={{ color: 'var(--text-primary)' }}>
                  PANEL INTELIJEN SIAP MEMINDAI
                </div>
                <div className="empty-desc" style={{ maxWidth: '320px', color: 'var(--text-muted)' }}>
                  Pilih salah satu modalitas di panel kiri (Teks Langsung, Tautan URL Berita, Screenshot OCR, atau Berkas CSV) lalu jalankan analisis kognitif.
                </div>
              </div>
            </div>
          )}

          {/* Keadaan 2: Sedang Memproses Analisis */}
          {isAnalyzing && (
            <div className="card">
              <div className="empty-state" style={{ padding: '80px 24px' }}>
                <div className="loading-dots" style={{ marginBottom: '16px' }}>
                  <span /><span /><span />
                </div>
                <div className="empty-title" style={{ color: 'var(--narada-red)' }}>
                  AI ENGINE KOGNITIF AKTIF
                </div>
                <div className="empty-desc" style={{ color: 'var(--text-secondary)' }}>
                  Memproses klasifikasi hibrida (60% Machine Learning + 40% Military Rules) dan memvalidasi ke database Cek Fakta...
                </div>
              </div>
            </div>
          )}

          {/* Keadaan 3: Hasil Tersedia */}
          {currentResult && !isAnalyzing && (
            <div className="fade-in">
              {/* Kartu Hasil Analisis Kognitif */}
              <AnalysisResultCard result={currentResult} />

              {/* Panel Verifikasi Fakta Google & Mafindo */}
              <FactCheckPanel
                text={currentResult.input || currentResult.rawContent}
                initialFactCheck={currentResult.factCheck}
                onResultReceived={(fc) => {
                  const updated: AnalysisResult = { ...currentResult, factCheck: fc }
                  setCurrentResult(updated)
                  saveAnalysis(updated)
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ─── Drawer Collapsible: Riwayat Analisis Sesi ─── */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div
          className="card-header"
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
        >
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={14} color="var(--accent-blue)" />
            RIWAYAT ANALISIS SESI INI
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              padding: '2px 8px',
              borderRadius: '3px',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--bg-border)'
            }}>
              {history.length} ITEM TERSIMPAN
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {history.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClearHistory()
                }}
                title="Hapus Semua Riwayat Sesi"
                style={{ color: '#EF4444' }}
              >
                <Trash2 size={12} /> Bersihkan Sesi
              </button>
            )}

            <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '4px' }}>
              {isHistoryExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {isHistoryExpanded && (
          <div style={{ padding: '0' }}>
            {history.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                Belum ada analisis yang dijalankan dalam sesi ini.
              </div>
            ) : (
              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {history.map((item, idx) => {
                  const catBadge = getCategoryBadge(item.category)
                  const threatBadge = getThreatBadge(item.threatLevel)
                  const isCurrent = currentResult?.id === item.id

                  return (
                    <div
                      key={item.id}
                      onClick={() => setCurrentResult(item)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 18px',
                        borderBottom: idx < history.length - 1 ? '1px solid var(--bg-border)' : 'none',
                        cursor: 'pointer',
                        background: isCurrent ? 'var(--bg-elevated)' : 'transparent',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!isCurrent) e.currentTarget.style.background = 'var(--bg-surface)'
                      }}
                      onMouseLeave={(e) => {
                        if (!isCurrent) e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      {item.category === 'NETRAL' ? (
                        <CheckCircle2 size={14} color="#22C55E" style={{ flexShrink: 0 }} />
                      ) : (
                        <AlertTriangle size={14} color={catBadge.color} style={{ flexShrink: 0 }} />
                      )}

                      <span
                        className="category-badge"
                        style={{
                          background: catBadge.bgColor,
                          color: catBadge.color,
                          border: `1px solid ${catBadge.color}30`,
                          minWidth: '85px',
                          textAlign: 'center'
                        }}
                      >
                        {item.category}
                      </span>

                      <span
                        className="threat-badge"
                        style={{
                          background: threatBadge.bgColor,
                          color: threatBadge.color,
                          border: `1px solid ${threatBadge.borderColor}`,
                          padding: '2px 6px',
                          fontSize: '9px'
                        }}
                      >
                        {threatBadge.label}
                      </span>

                      <span style={{
                        fontSize: '9px',
                        fontFamily: 'var(--font-mono)',
                        padding: '2px 6px',
                        borderRadius: '2px',
                        background: 'var(--bg-card)',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase'
                      }}>
                        {item.inputSource}
                      </span>

                      <span style={{
                        flex: 1,
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {truncateText(item.input || item.rawContent, 90)}
                      </span>

                      <span style={{
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        color: threatBadge.color,
                        fontWeight: '700'
                      }}>
                        {item.confidence}%
                      </span>

                      <span style={{
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-dim)',
                        minWidth: '130px',
                        textAlign: 'right'
                      }}>
                        {formatMilitaryDate(item.timestamp)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
