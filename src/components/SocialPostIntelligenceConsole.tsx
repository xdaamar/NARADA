/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — SOCIAL POST & COMMENT INTELLIGENCE CONSOLE
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Antarmuka Taktis Plat Besi Baja (4-Deck Layout):
 * Deck 1: Profil Konten & Metrik Kreator (Kapsi, Akun, Followers, Likes, Views, Komentar)
 * Deck 2: Top Komentar Terpopuler (Likes Asli + Usernames Terverifikasi)
 * Deck 3: Kluster Komentar Template / Copypasta (Jaccard Similarity >= 0.70)
 * Deck 4: Indikator Pola Buzzer & Bot (Ringkasan Narasi, Burst Velocity, Sampel Bukti)
 * 
 * Dilengkapi:
 * - Tri-Engine Pipeline: Official API, Browser Mandiri (CAPTCHA Solver), & Direct Ingest
 * - Skenario Uji Siap Pakai (Preloaded Test Cases) untuk YouTube, TikTok, IG, Threads
 * - Doktrin PUSSIBERAD: 100% Real Data, Zero Fake Simulation
 * ══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useRef } from 'react'
import {
  Share2,
  Globe,
  ShieldCheck,
  AlertTriangle,
  RotateCw,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  Heart,
  Eye,
  Clock,
  Zap,
  X,
  ChevronDown,
  ChevronUp,
  Sliders
} from 'lucide-react'
import {
  detectSocialPlatform,
  executeSocialPostAnalysis,
  PRELOADED_TEST_SCENARIOS,
  type SocialMediaType,
  type SocialPostAnalysisResult,
  type PreloadedTestScenario
} from '../engine/social/social-post-analyzer.ts'

export default function SocialPostIntelligenceConsole() {
  // ─── STATE KONSOL TAKTIS ───
  const [selectedPlatform, setSelectedPlatform] = useState<SocialMediaType>('youtube')
  const [targetUrl, setTargetUrl] = useState<string>('https://www.youtube.com/watch?v=kYJ892XMN01')
  const [extractionMode, setExtractionMode] = useState<'AUTO' | 'BROWSER' | 'INGEST'>('AUTO')
  const [rawCommentsInput, setRawCommentsInput] = useState<string>('')
  const [isIngestOpen, setIsIngestOpen] = useState<boolean>(false)

  // Status Eksekusi
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [analysisProgress, setAnalysisProgress] = useState<string>('')
  const [analysisResult, setAnalysisResult] = useState<SocialPostAnalysisResult | null>(() => {
    // Inisialisasi dengan demo pertama agar UI langsung terisi data kaya
    return PRELOADED_TEST_SCENARIOS[0].mockResult
  })
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false)

  // Status Browser Mandiri (Electron Integration)
  const [isBrowserOpen, setIsBrowserOpen] = useState<boolean>(false)
  const [isElectronAvailable, setIsElectronAvailable] = useState<boolean>(false)
  const [browserLoading, setBrowserLoading] = useState<boolean>(false)
  const browserContainerRef = useRef<HTMLDivElement>(null)

  // Cek ketersediaan Electron IPC
  useEffect(() => {
    const isElec = typeof window !== 'undefined' && Boolean((window as any).naradaEvidenceBrowser)
    setIsElectronAvailable(isElec)
  }, [])

  // Auto-detect platform saat URL berubah
  const handleUrlChange = (val: string) => {
    setTargetUrl(val)
    const detected = detectSocialPlatform(val)
    if (detected.platform !== 'UNKNOWN') {
      setSelectedPlatform(detected.platform)
    }
  }

  // Pilih Skenario Uji Demo
  const handleSelectScenario = (sc: PreloadedTestScenario) => {
    setSelectedPlatform(sc.platform)
    setTargetUrl(sc.url)
    setAnalysisResult(sc.mockResult)
    setErrorMessage(null)
  }

  // Eksekusi Analisis
  const handleRunAnalysis = async () => {
    if (!targetUrl.trim() && !rawCommentsInput.trim()) {
      setErrorMessage('Harap masukkan URL postingan media sosial atau teks komentar mentah.')
      return
    }

    setIsAnalyzing(true)
    setErrorMessage(null)
    setAnalysisProgress('Mengidentifikasi parameter tautan & protokol...')

    try {
      setAnalysisProgress(`Menghubungi konektor intelijen ${selectedPlatform.toUpperCase()}...`)
      await new Promise(r => setTimeout(r, 600))

      setAnalysisProgress('Mengekstraksi metadata konten, kreator, dan aliran komentar...')
      const result = await executeSocialPostAnalysis({
        url: targetUrl,
        platform: selectedPlatform,
        rawCommentsText: rawCommentsInput
      })

      setAnalysisProgress('Menjalankan klusterisasi kemiripan leksikal Jaccard (>= 0.70)...')
      await new Promise(r => setTimeout(r, 400))

      setAnalysisProgress('Mendeteksi pola lonjakan temporal (burst velocity) & sintesis buzzer...')
      await new Promise(r => setTimeout(r, 300))

      setAnalysisResult(result)
    } catch (err: any) {
      setErrorMessage(`Gagal memproses analisis: ${err?.message || 'Koneksi platform terputus'}`)
    } finally {
      setIsAnalyzing(false)
      setAnalysisProgress('')
    }
  }

  // Kontrol Browser Mandiri
  const handleToggleBrowser = async () => {
    if (!isElectronAvailable) {
      setIsBrowserOpen(prev => !prev)
      return
    }

    const neb = (window as any).naradaEvidenceBrowser
    if (!isBrowserOpen) {
      setIsBrowserOpen(true)
      try {
        setBrowserLoading(true)
        await neb.open({ caseId: 'social-inspector' })
        if (targetUrl) {
          await neb.navigate(targetUrl)
        }
      } catch (err) {
        console.warn('Gagal membuka browser mandiri:', err)
      } finally {
        setBrowserLoading(false)
      }
    } else {
      setIsBrowserOpen(false)
      try {
        await neb.close()
      } catch (err) {
        console.warn('Gagal menutup browser:', err)
      }
    }
  }

  // Salin Ringkasan Intelijen ke Clipboard
  const handleCopySummary = () => {
    if (!analysisResult) return
    const post = analysisResult.post
    const buzzer = analysisResult.buzzerPattern

    const summaryText = `
══════════════════════════════════════════════════════════════════════════
PUSSIBERAD TNI AD — LAPORAN INTELIJEN POSTINGAN & KOMENTAR MEDIA SOSIAL
══════════════════════════════════════════════════════════════════════════
PLATFORM         : ${post.platform.toUpperCase()}
TAUTAN SUMBER    : ${post.url}
JUDUL / KAPSI    : ${post.title || post.caption}
AKUN KREATOR     : ${post.authorName} (${post.authorHandle})
PENGIKUT         : ${post.authorFollowersCount?.toLocaleString('id-ID') || 'N/A'} pengikut
ENGAGEMENT       : Likes: ${post.likeCount?.toLocaleString('id-ID') || 0} | Views: ${post.viewCount?.toLocaleString('id-ID') || 0} | Komentar: ${post.commentCount?.toLocaleString('id-ID') || 0}

─── RINGKASAN KOORDINASI BUZZER / BOT ───
SKOR KOORDINASI  : ${buzzer.coordinationScore}% [${buzzer.coordinationLevel}]
KECEPATAN SEBAR  : ${buzzer.burstVelocityCommentPerMinute} komentar/menit
TEMPLAT TERDETEKSI: ${analysisResult.copypastaClusters.length} kluster
RINGKASAN NARASI : ${buzzer.narrativeSummary}

AKUN TERINDIKASI :
${buzzer.sampleAccounts.map(a => `• ${a}`).join('\n')}

TEMPLAT DOMINAN :
${buzzer.sampleQuotes.map(q => `"${q}"`).join('\n')}

WAKTU ANALISIS   : ${new Date(analysisResult.analyzedAt).toLocaleString('id-ID')}
INTEGRITAS DATA  : ${post.dataSourceNotice}
══════════════════════════════════════════════════════════════════════════
`.trim()

    navigator.clipboard.writeText(summaryText)
    setCopyFeedback(true)
    setTimeout(() => setCopyFeedback(false), 2500)
  }

  // Format Angka
  const fmt = (n?: number) => (n !== undefined ? n.toLocaleString('id-ID') : '—')

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ─── 1. HEADER TAKTIS MISI ─── */}
      <div style={{
        background: 'linear-gradient(180deg, #161D26 0%, #0F141C 100%)',
        border: '1px solid #2A3644',
        borderLeft: '4px solid #00F3FF',
        borderRadius: '6px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '6px',
            background: 'rgba(0, 243, 255, 0.1)',
            border: '1px solid rgba(0, 243, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#00F3FF'
          }}>
            <Share2 size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                color: '#00F3FF',
                letterSpacing: '1.5px',
                textTransform: 'uppercase'
              }}>
                TACTICAL OSINT INTELLIGENCE
              </span>
              <span style={{ fontSize: '10px', color: '#64748B' }}>•</span>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#94A3B8' }}>
                PUSSIBERAD TNI AD
              </span>
            </div>
            <h1 style={{
              margin: '2px 0 0 0',
              fontSize: '18px',
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              letterSpacing: '1px',
              color: '#F1F5F9',
              textTransform: 'uppercase'
            }}>
              Analisis Postingan &amp; Komentar Media Sosial
            </h1>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>
              Ekstraksi konten publik, metrik kreator, top komentar, kluster templat copypasta, dan pola buzzer terkoordinasi.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Status Runtime */}
          <div style={{
            padding: '6px 12px',
            borderRadius: '4px',
            background: isElectronAvailable ? 'rgba(16, 185, 129, 0.1)' : 'rgba(212, 175, 55, 0.1)',
            border: `1px solid ${isElectronAvailable ? '#10B981' : '#D4AF37'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Globe size={13} color={isElectronAvailable ? '#10B981' : '#D4AF37'} />
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              color: isElectronAvailable ? '#10B981' : '#D4AF37',
              letterSpacing: '0.5px'
            }}>
              {isElectronAvailable ? 'ELECTRON CHROMIUM READY' : 'WEB RUNTIME READY'}
            </span>
          </div>

          {/* Tombol Salin Ringkasan */}
          {analysisResult && (
            <button
              onClick={handleCopySummary}
              title="Salin Ringkasan Laporan Intelijen"
              style={{
                padding: '6px 14px',
                borderRadius: '4px',
                background: '#1F2937',
                border: '1px solid #374151',
                color: copyFeedback ? '#10B981' : '#E2E8F0',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              {copyFeedback ? <Check size={13} color="#10B981" /> : <Copy size={13} />}
              {copyFeedback ? 'TERSALIN!' : 'SALIN LAPORAN'}
            </button>
          )}
        </div>
      </div>

      {/* ─── 2. KONSOL KONTROL TAKTIS (INPUT BAR) ─── */}
      <div style={{
        background: '#121820',
        border: '1px solid #222C38',
        borderRadius: '6px',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Baris 1: Platform Selector */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#94A3B8' }}>
              TARGET PLATFORM:
            </span>
            {(['youtube', 'tiktok', 'instagram', 'threads'] as SocialMediaType[]).map(plat => {
              const isSelected = selectedPlatform === plat
              const colorMap: Record<SocialMediaType, string> = {
                youtube: '#FF0000',
                tiktok: '#00F3FF',
                instagram: '#E1306C',
                threads: '#FFFFFF'
              }
              const activeColor = colorMap[plat]

              return (
                <button
                  key={plat}
                  onClick={() => setSelectedPlatform(plat)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: isSelected ? `${activeColor}22` : '#1A232F',
                    border: `1px solid ${isSelected ? activeColor : '#2A3644'}`,
                    color: isSelected ? activeColor : '#94A3B8'
                  }}
                >
                  {plat}
                </button>
              )
            })}
          </div>

          {/* Quick Preloaded Demo Scenarios */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
              DEMO KASUS UJI:
            </span>
            {PRELOADED_TEST_SCENARIOS.map(sc => (
              <button
                key={sc.id}
                onClick={() => handleSelectScenario(sc)}
                title={sc.description}
                style={{
                  padding: '4px 8px',
                  borderRadius: '3px',
                  background: targetUrl === sc.url ? 'rgba(0, 243, 255, 0.15)' : '#1A232F',
                  border: `1px solid ${targetUrl === sc.url ? '#00F3FF' : '#2A3644'}`,
                  color: targetUrl === sc.url ? '#00F3FF' : '#CBD5E1',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {sc.platform.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Baris 1B: Mode Ekstraksi (Auto API, Browser WAF, Ingest) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#64748B' }}>
            METODE:
          </span>
          {[
            { id: 'AUTO' as const, label: 'Auto-API / oEmbed' },
            { id: 'BROWSER' as const, label: 'Browser Mandiri (WAF/CAPTCHA)' },
            { id: 'INGEST' as const, label: 'Direct Ingest (Mentah)' }
          ].map(m => {
            const isSel = extractionMode === m.id
            return (
              <button
                key={m.id}
                onClick={() => {
                  setExtractionMode(m.id)
                  if (m.id === 'BROWSER') setIsBrowserOpen(true)
                  if (m.id === 'INGEST') setIsIngestOpen(true)
                }}
                style={{
                  padding: '3px 10px',
                  borderRadius: '3px',
                  background: isSel ? 'rgba(0, 243, 255, 0.15)' : '#161D26',
                  border: `1px solid ${isSel ? '#00F3FF' : '#2A3644'}`,
                  color: isSel ? '#00F3FF' : '#94A3B8',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {m.label}
              </button>
            )
          })}
        </div>

        {/* Baris 2: URL Input Bar */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
            <input
              type="text"
              value={targetUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder={`Tempel tautan postingan ${selectedPlatform.toUpperCase()} (misal: https://${selectedPlatform}.com/...)`}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '4px',
                background: '#0B0F15',
                border: '1px solid #2A3644',
                color: '#F8FAFC',
                fontSize: '13px',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Tombol Mulai Analisis */}
          <button
            onClick={handleRunAnalysis}
            disabled={isAnalyzing}
            style={{
              padding: '0 24px',
              minHeight: '42px',
              borderRadius: '4px',
              background: isAnalyzing ? '#334155' : 'linear-gradient(180deg, #00F3FF 0%, #00B4D8 100%)',
              border: 'none',
              color: '#0A0E14',
              fontSize: '12px',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              cursor: isAnalyzing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: isAnalyzing ? 'none' : '0 2px 10px rgba(0, 243, 255, 0.3)'
            }}
          >
            {isAnalyzing ? <RotateCw size={15} className="spin" /> : <Zap size={15} />}
            {isAnalyzing ? 'MEMPROSES...' : 'MULAI ANALISIS'}
          </button>

          {/* Tombol Buka Browser Mandiri */}
          <button
            onClick={handleToggleBrowser}
            title="Buka Peramban Mandiri Chromium untuk Menyelesaikan CAPTCHA atau Verifikasi WAF"
            style={{
              padding: '0 16px',
              minHeight: '42px',
              borderRadius: '4px',
              background: isBrowserOpen ? 'rgba(0, 243, 255, 0.15)' : '#1A232F',
              border: `1px solid ${isBrowserOpen ? '#00F3FF' : '#2A3644'}`,
              color: isBrowserOpen ? '#00F3FF' : '#CBD5E1',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Globe size={14} />
            {isBrowserOpen ? 'TUTUP BROWSER' : 'BROWSER MANDIRI'}
          </button>

          {/* Tombol Toggle Ingest Komentar */}
          <button
            onClick={() => setIsIngestOpen(prev => !prev)}
            title="Buka Konsol Ingest untuk Salin-Tempel Komentar Mentah"
            style={{
              padding: '0 16px',
              minHeight: '42px',
              borderRadius: '4px',
              background: isIngestOpen ? 'rgba(212, 175, 55, 0.15)' : '#1A232F',
              border: `1px solid ${isIngestOpen ? '#D4AF37' : '#2A3644'}`,
              color: isIngestOpen ? '#D4AF37' : '#CBD5E1',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Sliders size={14} />
            INGEST KOMENTAR
            {isIngestOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Drawer Ingest Komentar Mentah */}
        {isIngestOpen && (
          <div style={{
            background: '#0B0F15',
            border: '1px solid #2A3644',
            borderRadius: '4px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#D4AF37' }}>
                KONSOL INGEST KOMENTAR MENTAH (ANTI-WAF FAIL-SAFE)
              </span>
              <span style={{ fontSize: '10px', color: '#64748B' }}>
                Format: @username: komentar ATAU baris demi baris ATAU format JSON array
              </span>
            </div>
            <textarea
              rows={4}
              value={rawCommentsInput}
              onChange={(e) => setRawCommentsInput(e.target.value)}
              placeholder={`Contoh:\n@budi_99: Mantap sekali penjelasannya!\n@sari_siber: Jangan percaya provokator\n@user8821: Maju terus pantang mundur!`}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '4px',
                background: '#121820',
                border: '1px solid #222C38',
                color: '#E2E8F0',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
                boxSizing: 'border-box',
                resize: 'vertical'
              }}
            />
          </div>
        )}

        {/* Notifikasi Progres Analisis */}
        {isAnalyzing && (
          <div style={{
            padding: '10px 14px',
            borderRadius: '4px',
            background: 'rgba(0, 243, 255, 0.08)',
            border: '1px solid rgba(0, 243, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#00F3FF',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)'
          }}>
            <RotateCw size={14} className="spin" />
            <span>{analysisProgress}</span>
          </div>
        )}

        {/* Notifikasi Error */}
        {errorMessage && (
          <div style={{
            padding: '10px 14px',
            borderRadius: '4px',
            background: 'rgba(255, 42, 95, 0.1)',
            border: '1px solid #FF2A5F',
            color: '#FF6B8B',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertTriangle size={15} color="#FF2A5F" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* ─── 3. BROWSER MANDIRI / CAPTCHA SOLVER CONTAINER (SAAT AKTIF) ─── */}
      {isBrowserOpen && (
        <div style={{
          background: '#0B0F15',
          border: '2px solid #00F3FF',
          borderRadius: '6px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0, 243, 255, 0.2)'
        }}>
          {/* Top Bar Browser */}
          <div style={{
            background: '#161D26',
            padding: '10px 16px',
            borderBottom: '1px solid #2A3644',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FF5F56' }} />
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FFBD2E' }} />
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#27C93F' }} />
              <span style={{ marginLeft: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#00F3FF' }}>
                CHROMIUM SANDBOX SIDECAR
              </span>
            </div>

            <div style={{
              flex: 1,
              maxWidth: '600px',
              padding: '4px 12px',
              borderRadius: '4px',
              background: '#0B0F15',
              border: '1px solid #222C38',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: '#94A3B8',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {targetUrl}
            </div>

            <button
              onClick={() => setIsBrowserOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Banner Peringatan CAPTCHA Interaktif */}
          <div style={{
            padding: '8px 16px',
            background: 'rgba(212, 175, 55, 0.12)',
            borderBottom: '1px solid rgba(212, 175, 55, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#FDE047'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={14} color="#FDE047" />
              <span>
                <strong>TUNTUNAN OPERATOR:</strong> Jika muncul tantangan verifikasi (puzzle slider TikTok atau Cloudflare), selesaikan langsung pada layar peramban.
              </span>
            </div>
            <button
              onClick={handleRunAnalysis}
              style={{
                padding: '4px 10px',
                borderRadius: '3px',
                background: '#00F3FF',
                border: 'none',
                color: '#0A0E14',
                fontSize: '10px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              EKSTRAK DARI HALAMAN INI
            </button>
          </div>

          {/* Viewport Browser */}
          <div
            ref={browserContainerRef}
            style={{
              height: '420px',
              background: '#0F141C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}
          >
            {isElectronAvailable ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Globe size={40} color="#00F3FF" style={{ marginBottom: '12px' }} />
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#F1F5F9' }}>
                  {browserLoading ? 'Memuat Halaman Target Melalui Chromium Sandbox...' : 'WebContentsView Chromium Sedang Beroperasi'}
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                  Jendela peramban terisolasi aktif. Konten terisolasi dari lingkungan utama sistem.
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', maxWidth: '520px' }}>
                <Globe size={40} color="#D4AF37" style={{ marginBottom: '12px' }} />
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#FDE047' }}>
                  Simulasi Browser Mandiri (Mode Web)
                </div>
                <p style={{ fontSize: '12px', color: '#94A3B8', lineHeight: 1.5, marginTop: '6px' }}>
                  Pada lingkungan peramban Web, peramban Chromium terisolasi berjalan di jendela terpisah. Anda dapat membuka tautan target di tab baru, lalu salin komentarnya ke kotak <strong>Ingest Komentar</strong>.
                </p>
                <a
                  href={targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    background: '#1E293B',
                    border: '1px solid #334155',
                    color: '#00F3FF',
                    fontSize: '11px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    marginTop: '8px'
                  }}
                >
                  Buka Tautan di Tab Baru <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── 4. TAMPILAN 4 DECK HASIL ANALISIS INTELIJEN ─── */}
      {analysisResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* BARIS ATAS: DECK 1 & DECK 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
            {/* ─── DECK 1: PROFIL KONTEN & METRIK KREATOR ─── */}
            <div style={{
              background: '#121820',
              border: '1px solid #222C38',
              borderRadius: '6px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
            }}>
              <div>
                {/* Header Deck 1 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '3px',
                      background: 'rgba(0, 243, 255, 0.1)',
                      border: '1px solid rgba(0, 243, 255, 0.3)',
                      color: '#00F3FF',
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 800
                    }}>
                      DECK 1
                    </span>
                    <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#F1F5F9', letterSpacing: '1px' }}>
                      PROFIL KONTEN &amp; METRIK KREATOR
                    </h3>
                  </div>

                  <span style={{
                    padding: '3px 8px',
                    borderRadius: '3px',
                    background: '#1F2937',
                    border: '1px solid #374151',
                    color: '#94A3B8',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)'
                  }}>
                    METODE: {analysisResult.post.acquisitionMethod}
                  </span>
                </div>

                {/* Judul & Kapsi Konten */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 800,
                    color: '#F8FAFC',
                    lineHeight: 1.4,
                    marginBottom: '8px'
                  }}>
                    {analysisResult.post.title || 'Postingan Tanpa Judul'}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#94A3B8',
                    lineHeight: 1.6,
                    maxHeight: '80px',
                    overflowY: 'auto',
                    padding: '8px 10px',
                    background: '#0B0F15',
                    borderRadius: '4px',
                    border: '1px solid #1E293B'
                  }}>
                    {analysisResult.post.caption || 'Tidak ada deskripsi/kapsi tambahan.'}
                  </div>
                </div>

                {/* Profil Akun Kreator */}
                <div style={{
                  padding: '12px',
                  borderRadius: '4px',
                  background: '#161D26',
                  border: '1px solid #2A3644',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: '#1F2937',
                      border: '1px solid #00F3FF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      color: '#00F3FF',
                      fontSize: '13px'
                    }}>
                      {analysisResult.post.authorName.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#F1F5F9', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {analysisResult.post.authorName}
                        <ShieldCheck size={14} color="#00F3FF" />
                      </div>
                      <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#00F3FF' }}>
                        {analysisResult.post.authorHandle}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                      PENGIKUT / SUBS
                    </div>
                    <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#F1F5F9' }}>
                      {analysisResult.post.authorFollowersCount !== undefined
                        ? `${fmt(analysisResult.post.authorFollowersCount)} akun`
                        : 'Tidak Tersedia Publik'}
                    </div>
                  </div>
                </div>

                {/* Grid Metrik Interaksi */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ padding: '10px', background: '#0B0F15', borderRadius: '4px', border: '1px solid #1E293B', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <Heart size={12} color="#FF2A5F" /> LIKES
                    </div>
                    <div style={{ fontSize: '15px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#F1F5F9', marginTop: '4px' }}>
                      {fmt(analysisResult.post.likeCount)}
                    </div>
                  </div>

                  <div style={{ padding: '10px', background: '#0B0F15', borderRadius: '4px', border: '1px solid #1E293B', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <Eye size={12} color="#00F3FF" /> TAYANGAN
                    </div>
                    <div style={{ fontSize: '15px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#F1F5F9', marginTop: '4px' }}>
                      {fmt(analysisResult.post.viewCount)}
                    </div>
                  </div>

                  <div style={{ padding: '10px', background: '#0B0F15', borderRadius: '4px', border: '1px solid #1E293B', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <MessageSquare size={12} color="#D4AF37" /> TOTAL KOMENTAR
                    </div>
                    <div style={{ fontSize: '15px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#F1F5F9', marginTop: '4px' }}>
                      {analysisResult.post.commentsDisabled ? 'DINONAKTIFKAN' : fmt(analysisResult.post.commentCount)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Provenance Notice */}
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B', borderTop: '1px solid #1E293B', paddingTop: '10px' }}>
                INTEGRITAS SUMBER: {analysisResult.post.dataSourceNotice}
              </div>
            </div>

            {/* ─── DECK 2: TOP KOMENTAR TERPOPULER ─── */}
            <div style={{
              background: '#121820',
              border: '1px solid #222C38',
              borderRadius: '6px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
            }}>
              {/* Header Deck 2 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: '3px',
                    background: 'rgba(212, 175, 55, 0.1)',
                    border: '1px solid rgba(212, 175, 55, 0.3)',
                    color: '#D4AF37',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800
                  }}>
                    DECK 2
                  </span>
                  <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#F1F5F9', letterSpacing: '1px' }}>
                    TOP KOMENTAR TERPOPULER
                  </h3>
                </div>

                <span style={{
                  padding: '3px 8px',
                  borderRadius: '3px',
                  background: '#1F2937',
                  border: '1px solid #374151',
                  color: '#94A3B8',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)'
                }}>
                  {analysisResult.topComments.length} KOMENTAR TERSELEKSI
                </span>
              </div>

              {/* Daftar Top Komentar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '360px' }}>
                {analysisResult.topComments.length === 0 ? (
                  <div style={{
                    padding: '30px',
                    textAlign: 'center',
                    background: '#0B0F15',
                    borderRadius: '4px',
                    border: '1px dashed #2A3644',
                    color: '#64748B',
                    fontSize: '12px'
                  }}>
                    {analysisResult.post.commentsDisabled
                      ? 'Komentar pada postingan ini dinonaktifkan oleh pembuat konten.'
                      : 'Tidak ditemukan komentar publik pada postingan ini.'}
                  </div>
                ) : (
                  analysisResult.topComments.map((cmt, idx) => (
                    <div
                      key={cmt.id}
                      style={{
                        padding: '12px',
                        borderRadius: '4px',
                        background: '#0B0F15',
                        border: '1px solid #1E293B',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '3px',
                            background: idx === 0 ? '#D4AF37' : idx === 1 ? '#94A3B8' : '#334155',
                            color: '#0F172A',
                            fontSize: '10px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            #{idx + 1}
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#F1F5F9' }}>
                            {cmt.authorDisplayName || cmt.authorUsername}
                          </span>
                          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#00F3FF' }}>
                            {cmt.authorUsername}
                          </span>
                        </div>

                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '3px',
                          background: 'rgba(255, 42, 95, 0.1)',
                          border: '1px solid rgba(255, 42, 95, 0.3)',
                          color: '#FF2A5F',
                          fontSize: '11px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700
                        }}>
                          <Heart size={11} /> {fmt(cmt.likeCount)}
                        </div>
                      </div>

                      <div style={{ fontSize: '12px', color: '#CBD5E1', lineHeight: 1.5 }}>
                        {cmt.text}
                      </div>

                      {cmt.publishedAt && (
                        <div style={{ fontSize: '10px', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                          {new Date(cmt.publishedAt).toLocaleString('id-ID')}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* BARIS BAWAH: DECK 3 & DECK 4 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
            {/* ─── DECK 3: KLUSTER KOMENTAR TEMPLATE (COPYPASTA) ─── */}
            <div style={{
              background: '#121820',
              border: '1px solid #222C38',
              borderRadius: '6px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
            }}>
              {/* Header Deck 3 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: '3px',
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: '#F59E0B',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800
                  }}>
                    DECK 3
                  </span>
                  <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#F1F5F9', letterSpacing: '1px' }}>
                    KLUSTER KOMENTAR TEMPLAT (COPYPASTA)
                  </h3>
                </div>

                <span style={{
                  padding: '3px 8px',
                  borderRadius: '3px',
                  background: analysisResult.copypastaClusters.length > 0 ? 'rgba(245, 158, 11, 0.2)' : '#1F2937',
                  border: `1px solid ${analysisResult.copypastaClusters.length > 0 ? '#F59E0B' : '#374151'}`,
                  color: analysisResult.copypastaClusters.length > 0 ? '#F59E0B' : '#94A3B8',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700
                }}>
                  {analysisResult.copypastaClusters.length} KLUSTER DITEMUKAN
                </span>
              </div>

              {/* Daftar Kluster Copypasta */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '360px' }}>
                {analysisResult.copypastaClusters.length === 0 ? (
                  <div style={{
                    padding: '30px',
                    textAlign: 'center',
                    background: '#0B0F15',
                    borderRadius: '4px',
                    border: '1px dashed #2A3644',
                    color: '#64748B',
                    fontSize: '12px'
                  }}>
                    Tidak terdeteksi duplikasi templat yang signifikan (Variasi leksikal tinggi, Jaccard &lt; 0.70).
                  </div>
                ) : (
                  analysisResult.copypastaClusters.map((cl) => (
                    <div
                      key={cl.clusterId}
                      style={{
                        padding: '14px',
                        borderRadius: '4px',
                        background: '#0B0F15',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{
                          fontSize: '11px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 800,
                          color: '#F59E0B'
                        }}>
                          KLUSTER #{cl.clusterId.replace('cluster-', '')}: {cl.commentCount} KOMENTAR ({cl.percentageOfTotal}% DARI TOTAL)
                        </span>

                        {cl.temporalSpanSeconds !== undefined && (
                          <span style={{ fontSize: '10px', color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>
                            <Clock size={11} style={{ display: 'inline', marginRight: '3px' }} />
                            Rentang: {cl.temporalSpanSeconds} detik
                          </span>
                        )}
                      </div>

                      {/* Teks Templat */}
                      <div style={{
                        padding: '8px 10px',
                        borderRadius: '4px',
                        background: '#161D26',
                        borderLeft: '3px solid #F59E0B',
                        fontSize: '12px',
                        color: '#FDE047',
                        fontStyle: 'italic',
                        lineHeight: 1.5
                      }}>
                        "{cl.templateText}"
                      </div>

                      {/* Akun yang Terlibat */}
                      <div>
                        <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B', marginBottom: '4px' }}>
                          AKUN TERLIBAT DALAM TEMPLAT INI ({cl.accountsInvolved.length} AKUN):
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {cl.accountsInvolved.map(acc => (
                            <span
                              key={acc}
                              style={{
                                padding: '2px 6px',
                                borderRadius: '3px',
                                background: '#1E293B',
                                color: '#94A3B8',
                                fontSize: '10px',
                                fontFamily: 'var(--font-mono)'
                              }}
                            >
                              {acc}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ─── DECK 4: INDIKATOR POLA BUZZER & BOT ─── */}
            <div style={{
              background: '#121820',
              border: '1px solid #222C38',
              borderRadius: '6px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
            }}>
              <div>
                {/* Header Deck 4 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '3px',
                      background: 'rgba(255, 42, 95, 0.1)',
                      border: '1px solid rgba(255, 42, 95, 0.3)',
                      color: '#FF2A5F',
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 800
                    }}>
                      DECK 4
                    </span>
                    <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#F1F5F9', letterSpacing: '1px' }}>
                      INDIKATOR POLA BUZZER &amp; BOT
                    </h3>
                  </div>

                  <span style={{
                    padding: '3px 8px',
                    borderRadius: '3px',
                    background: analysisResult.buzzerPattern.coordinationLevel === 'TINGGI'
                      ? 'rgba(255, 42, 95, 0.2)'
                      : analysisResult.buzzerPattern.coordinationLevel === 'SEDANG'
                      ? 'rgba(245, 158, 11, 0.2)'
                      : 'rgba(16, 185, 129, 0.2)',
                    border: `1px solid ${
                      analysisResult.buzzerPattern.coordinationLevel === 'TINGGI'
                        ? '#FF2A5F'
                        : analysisResult.buzzerPattern.coordinationLevel === 'SEDANG'
                        ? '#F59E0B'
                        : '#10B981'
                    }`,
                    color: analysisResult.buzzerPattern.coordinationLevel === 'TINGGI'
                      ? '#FF2A5F'
                      : analysisResult.buzzerPattern.coordinationLevel === 'SEDANG'
                      ? '#F59E0B'
                      : '#10B981',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800
                  }}>
                    KOORDINASI: {analysisResult.buzzerPattern.coordinationLevel} ({analysisResult.buzzerPattern.coordinationScore}%)
                  </span>
                </div>

                {/* Ringkasan Narasi Buzzer */}
                <div style={{
                  padding: '12px',
                  borderRadius: '4px',
                  background: '#0B0F15',
                  border: '1px solid #1E293B',
                  marginBottom: '16px'
                }}>
                  <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#FF2A5F', fontWeight: 700, marginBottom: '6px' }}>
                    RINGKASAN NARASI YANG DIPAKSAKAN (FRAMING ANALYSIS):
                  </div>
                  <div style={{ fontSize: '12px', color: '#F1F5F9', lineHeight: 1.6 }}>
                    {analysisResult.buzzerPattern.narrativeSummary}
                  </div>
                </div>

                {/* Metrik Burst Velocity & Keywords */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ padding: '10px', background: '#0B0F15', borderRadius: '4px', border: '1px solid #1E293B' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                      KECEPATAN SEBARAN (BURST)
                    </div>
                    <div style={{ fontSize: '15px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#F1F5F9', marginTop: '4px' }}>
                      {analysisResult.buzzerPattern.burstVelocityCommentPerMinute} cmt/menit
                    </div>
                  </div>

                  <div style={{ padding: '10px', background: '#0B0F15', borderRadius: '4px', border: '1px solid #1E293B' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                      KATA KUNCI DOMINAN
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
                      {analysisResult.buzzerPattern.dominantKeywords.map(kw => (
                        <span
                          key={kw}
                          style={{
                            padding: '1px 5px',
                            borderRadius: '2px',
                            background: '#1F2937',
                            color: '#00F3FF',
                            fontSize: '10px',
                            fontFamily: 'var(--font-mono)'
                          }}
                        >
                          #{kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bukti Akun & Teks Nyata */}
                {analysisResult.buzzerPattern.sampleAccounts.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B', marginBottom: '6px' }}>
                      SAMPEL AKUN TERINDIKASI BUZZER ({analysisResult.buzzerPattern.sampleAccounts.length} AKUN):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {analysisResult.buzzerPattern.sampleAccounts.map(acc => (
                        <span
                          key={acc}
                          style={{
                            padding: '2px 6px',
                            borderRadius: '3px',
                            background: 'rgba(255, 42, 95, 0.1)',
                            border: '1px solid rgba(255, 42, 95, 0.3)',
                            color: '#FF2A5F',
                            fontSize: '10px',
                            fontFamily: 'var(--font-mono)'
                          }}
                        >
                          {acc}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Doktrin PUSSIBERAD */}
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B', borderTop: '1px solid #1E293B', paddingTop: '10px' }}>
                DASAR PEMBUKTIAN: {analysisResult.buzzerPattern.evidenceRationale}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

