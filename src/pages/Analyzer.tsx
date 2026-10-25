import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  History,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react'
import OmniInputConsole from '../components/OmniInputConsole'
import AnalysisResultCard from '../components/AnalysisResultCard'
import FactCheckPanel from '../components/FactCheckPanel'
import { analyzeHybrid } from '../engine/combiner'
import { verifyFactCheck } from '../engine/fact-checker'
import { saveAnalysis, getStoredAnalyses, clearStoredAnalyses } from '../utils/storage'
import { getCategoryBadge, getThreatBadge, formatMilitaryDate, truncateText } from '../utils/format'
import { generateSHA256 } from '../utils/crypto'
import type { AnalysisResult, InputSourceType } from '../types'

export default function Analyzer() {
  const location = useLocation()
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null)
  const [history, setHistory] = useState<AnalysisResult[]>(() => getStoredAnalyses())
  const [isHistoryExpanded, setIsHistoryExpanded] = useState<boolean>(false)
  const [injectedText, setInjectedText] = useState<string>('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const resultContainerRef = useRef<HTMLDivElement>(null)

  // Tangkap prefill dari navigasi eksternal (Dashboard atau LiveRadar)
  useEffect(() => {
    const state = location.state as { prefill?: string } | null
    if (state?.prefill) {
      setInjectedText(state.prefill)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [location.state])

  // Sinkronisasi riwayat analisis sessionStorage
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
   * Menjalankan Analisis Kognitif Terpadu (Truth Priority Architecture)
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
      setValidationError('Teks terlalu pendek. Minimal 10 karakter untuk dianalisis oleh Reasoning Engine.')
      return
    }

    setValidationError(null)
    setIsAnalyzing(true)

    // Simulasi delay mikro pemrosesan taktis militer (350ms)
    await new Promise(resolve => setTimeout(resolve, 350))

    try {
      // 1. Eksekusi Hybrid Combiner (Truth Priority: Cek Fakta Live/Lokal -> Knowledge Graph -> Hybrid ML)
      const analysisResult = analyzeHybrid(trimmed, {
        inputSource: source,
        title,
        sourceMeta,
      })

      // 2. Cross-reference ke TurnBackHoax.ID REST API / Fallback Offline
      const factCheckResult = await verifyFactCheck(trimmed)
      analysisResult.factCheck = factCheckResult

      // 3. Hitung SHA-256 Checksum Integritas Forensik
      analysisResult.forensicHash = await generateSHA256(trimmed)

      // 4. Simpan ke sessionStorage & update state
      saveAnalysis(analysisResult)
      setCurrentResult(analysisResult)
      setHistory(getStoredAnalyses())

      // Auto scroll ke hasil analisis
      setTimeout(() => {
        resultContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch (error) {
      console.error('[NARADA Analyzer] Eksekusi analisis gagal:', error)
      setValidationError('Terjadi kesalahan saat memproses analisis kognitif.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleClearHistory = () => {
    if (window.confirm('Bersihkan seluruh riwayat analisis sesi ini?')) {
      clearStoredAnalyses()
      setHistory([])
      setCurrentResult(null)
    }
  }

  return (
    <div className="fade-in" style={{ paddingBottom: '36px' }}>
      {/* ─── Page Title Header (Filosofi "Bersepeda": Bersih & Proporsional) ─── */}
      <div style={{
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
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
              fontWeight: '700'
            }}>
              DUAL-SPECTRUM COGNITIVE REASONING ENGINE
            </span>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              PUSSIBERAD TNI AD × KARTIKA CYBER
            </span>
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '24px',
            fontWeight: '800',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            marginBottom: '4px',
            color: 'var(--text-primary)'
          }}>
            Cognitive Threat & Viral Hoax Analyzer
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '780px' }}>
            Konsol intelijen kognitif cerdas untuk memverifikasi hoaks militer/politik serta disinformasi publik (bencana alam BMKG, penipuan bansos, dan kesehatan) tanpa friksi modalitas.
          </p>
        </div>

        {/* Status Live Engine Badge */}
        <div style={{
          background: 'var(--bg-elevated)',
          padding: '8px 14px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--bg-border)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#22C55E',
            boxShadow: '0 0 10px #22C55E'
          }} />
          <div>
            <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', lineHeight: '1' }}>
              REASONING STATUS
            </div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#22C55E', marginTop: '2px' }}>
              TRUTH PRIORITY ACTIVE
            </div>
          </div>
        </div>
      </div>

      {/* Validation Error Alert jika ada */}
      {validationError && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: 'var(--radius-sm)',
          color: '#EF4444',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px'
        }}>
          <AlertTriangle size={15} />
          <span>{validationError}</span>
        </div>
      )}

      {/* ─── 1. SMART OMNI-INPUT CONSOLE (ZERO-FRICTION INGESTION) ─── */}
      <OmniInputConsole
        isAnalyzing={isAnalyzing}
        initialText={injectedText}
        onAnalyze={(payload) => {
          executeAnalysis(payload.text, payload.source, payload.title, payload.sourceMeta)
        }}
      />

      {/* ─── 2. HASIL ANALISIS KOGNITIF (JIKA TERSEDIA) ─── */}
      <div ref={resultContainerRef} style={{ marginTop: '20px' }}>
        {/* Loading Spinner State */}
        {isAnalyzing && (
          <div className="card fade-in" style={{ padding: '60px 24px', textAlign: 'center' }}>
            <div className="loading-dots" style={{ marginBottom: '16px' }}>
              <span /><span /><span />
            </div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '16px',
              fontWeight: '700',
              letterSpacing: '1px',
              color: 'var(--narada-red)',
              marginBottom: '6px'
            }}>
              MENGEVALUASI HIERARKI KEBENARAN & ANOMALI LOGIKA
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '460px', margin: '0 auto' }}>
              Mencocokkan terhadap basis data aktif Mafindo, menguji hukum konstitusi UUD 1945, sains geofisika BMKG, dan mengklasifikasikan klaster spektrum ancaman...
            </div>
          </div>
        )}

        {/* Hasil Analisis Kartu Komparasi Fakta & Draf Taktis */}
        {currentResult && !isAnalyzing && (
          <div className="fade-in">
            <AnalysisResultCard result={currentResult} />

            {/* Fact Check Panel Verifikasi Terintegrasi */}
            <div style={{ marginTop: '16px' }}>
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
          </div>
        )}
      </div>

      {/* ─── 3. DRAWER RIWAYAT ANALISIS SESI INI ─── */}
      <div className="steel-chassis-card" style={{ marginTop: '24px', position: 'relative' }}>
        <span className="bolt-tl" />
        <span className="bolt-tr" />
        <span className="bolt-bl" />
        <span className="bolt-br" />
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
                style={{ color: '#EF4444', fontSize: '11px' }}
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
          <div style={{ padding: '12px 16px' }}>
            {history.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                Belum ada analisis yang dijalankan dalam sesi ini.
              </div>
            ) : (
              <div className="steel-sunken-tray" style={{ maxHeight: '280px', overflowY: 'auto', padding: '0' }}>
                {history.map((item, idx) => {
                  const catBadge = getCategoryBadge(item.category)
                  const threatBadge = getThreatBadge(item.threatLevel)
                  const isCurrent = currentResult?.id === item.id

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setCurrentResult(item)
                        setTimeout(() => {
                          resultContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        }, 100)
                      }}
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
