/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — SOCIAL POST & COMMENT INTELLIGENCE CONSOLE
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * TEMA PLAT BESI BAJA INDUSTRIAL MILITER:
 * - Menggunakan chassis plat besi baja (.steel-chassis-card) dengan 4 baut hex sudut.
 * - Tanpa glow warna-warni yang mencolok. Warna hanya pada teks informasi data.
 * - Tombol kokoh bertekstur bevel metalik baja.
 * - 4-Deck Intelligence Layout:
 *   Deck 1: Profil Konten & Metrik Kreator
 *   Deck 2: Top Komentar Terpopuler (Likes Asli + Username)
 *   Deck 3: Kluster Komentar Templat / Copypasta (Jaccard >= 0.70)
 *   Deck 4: Indikator Pola Buzzer & Bot Terkoordinasi
 * ══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useRef } from 'react'
import {
  Share2,
  Globe,
  ShieldCheck,
  AlertTriangle,
  RotateCw,
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
  const [targetUrl, setTargetUrl] = useState<string>('')
  const [extractionMode, setExtractionMode] = useState<'AUTO' | 'BROWSER' | 'INGEST'>('AUTO')
  const [rawCommentsInput, setRawCommentsInput] = useState<string>('')
  const [isIngestOpen, setIsIngestOpen] = useState<boolean>(false)

  // Status Eksekusi (Halaman Bersih & Kosong saat Pertama Dibuka)
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [analysisProgress, setAnalysisProgress] = useState<string>('')
  const [analysisResult, setAnalysisResult] = useState<SocialPostAnalysisResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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

  // Format Angka
  const fmt = (n?: number) => (n !== undefined ? n.toLocaleString('id-ID') : '—')

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* ─── 1. HEADER TAKTIS MISI (CHASSIS PLAT BESI BAJA) ─── */}
      <div 
        className="steel-chassis-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '16px 20px',
          position: 'relative'
        }}
      >
        <span className="bolt-tl" />
        <span className="bolt-tr" />
        <span className="bolt-bl" />
        <span className="bolt-br" />

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '4px',
            background: 'linear-gradient(180deg, #253346 0%, #151F2C 100%)',
            border: '1px solid #3A4A5E',
            borderBottom: '2px solid #0D131B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94A3B8'
          }}>
            <Share2 size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                color: '#EF4444',
                letterSpacing: '1px',
                textTransform: 'uppercase'
              }}>
                INTELIJEN MEDIA SOSIAL
              </span>
              <span style={{ fontSize: '10px', color: '#475569' }}>•</span>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                PUSSIBERAD TNI AD
              </span>
            </div>
            <h1 style={{
              margin: '2px 0 0 0',
              fontSize: '17px',
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              letterSpacing: '1px',
              color: '#F1F5F9',
              textTransform: 'uppercase'
            }}>
              Analisis Postingan &amp; Komentar Media Sosial
            </h1>
            <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#94A3B8' }}>
              Ekstraksi konten publik, akun kreator, top komentar, templat copypasta, dan pola buzzer terkoordinasi.
            </p>
          </div>
        </div>
      </div>

      {/* ─── 2. KONSOL KONTROL TAKTIS (CHASSIS PLAT BESI BAJA) ─── */}
      <div 
        className="steel-chassis-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          padding: '16px 20px',
          position: 'relative'
        }}
      >
        <span className="bolt-tl" />
        <span className="bolt-tr" />
        <span className="bolt-bl" />
        <span className="bolt-br" />

        {/* Baris 1: Platform Selector */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#64748B' }}>
              TARGET PLATFORM:
            </span>
            {(['youtube', 'tiktok', 'instagram', 'threads'] as SocialMediaType[]).map(plat => {
              const isSelected = selectedPlatform === plat
              return (
                <button
                  key={plat}
                  type="button"
                  onClick={() => setSelectedPlatform(plat)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '3px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    background: isSelected ? 'linear-gradient(180deg, #2D3D52 0%, #17212D 100%)' : '#101622',
                    border: isSelected ? '1px solid #4D627E' : '1px solid #1F2B3B',
                    borderBottom: isSelected ? '2px solid #0D131B' : '1px solid #1F2B3B',
                    boxShadow: isSelected ? 'inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 2px 4px rgba(0, 0, 0, 0.6)' : 'none',
                    color: isSelected ? '#F8FAFC' : '#94A3B8'
                  }}
                >
                  {plat}
                </button>
              )
            })}
          </div>

          {/* Quick Preloaded Demo Scenarios */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#475569' }}>
              SKENARIO UJI:
            </span>
            {PRELOADED_TEST_SCENARIOS.map(sc => (
              <button
                key={sc.id}
                type="button"
                onClick={() => handleSelectScenario(sc)}
                title={sc.description}
                style={{
                  padding: '3px 8px',
                  borderRadius: '3px',
                  background: targetUrl === sc.url ? 'linear-gradient(180deg, #2D3D52 0%, #17212D 100%)' : '#101622',
                  border: targetUrl === sc.url ? '1px solid #4D627E' : '1px solid #1F2B3B',
                  borderBottom: targetUrl === sc.url ? '2px solid #0D131B' : '1px solid #1F2B3B',
                  color: targetUrl === sc.url ? '#F8FAFC' : '#64748B',
                  fontSize: '9.5px',
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

        {/* Baris 1B: Mode Ekstraksi (Pills Baja) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#64748B' }}>
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
                type="button"
                onClick={() => {
                  setExtractionMode(m.id)
                  if (m.id === 'BROWSER') setIsBrowserOpen(true)
                  if (m.id === 'INGEST') setIsIngestOpen(true)
                }}
                style={{
                  padding: '3px 10px',
                  borderRadius: '3px',
                  background: isSel ? 'linear-gradient(180deg, #2D3D52 0%, #17212D 100%)' : '#101622',
                  border: isSel ? '1px solid #4D627E' : '1px solid #1F2B3B',
                  borderBottom: isSel ? '2px solid #0D131B' : '1px solid #1F2B3B',
                  color: isSel ? '#F8FAFC' : '#64748B',
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
                padding: '10px 14px',
                borderRadius: '4px',
                background: '#0B1017',
                border: '1px solid #253346',
                color: '#F8FAFC',
                fontSize: '12.5px',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Tombol Mulai Analisis Plat Baja Solid */}
          <button
            type="button"
            onClick={handleRunAnalysis}
            disabled={isAnalyzing}
            style={{
              padding: '0 22px',
              minHeight: '38px',
              borderRadius: '4px',
              background: isAnalyzing 
                ? '#1A232F' 
                : 'linear-gradient(180deg, #32435A 0%, #1A2534 100%)',
              border: isAnalyzing ? '1px solid #233144' : '1px solid #546C8C',
              borderBottom: isAnalyzing ? '1px solid #233144' : '2px solid #0B1017',
              boxShadow: isAnalyzing 
                ? 'none' 
                : 'inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 3px 6px rgba(0, 0, 0, 0.7)',
              color: '#F8FAFC',
              fontSize: '11.5px',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              cursor: isAnalyzing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '7px'
            }}
          >
            {isAnalyzing ? <RotateCw size={14} className="spin" color="#EF4444" /> : <Zap size={14} color="#EF4444" />}
            {isAnalyzing ? 'MEMPROSES...' : 'MULAI ANALISIS'}
          </button>

          {/* Tombol Buka Browser Mandiri Plat Baja */}
          <button
            type="button"
            onClick={handleToggleBrowser}
            title="Buka Peramban Mandiri Chromium untuk Menyelesaikan CAPTCHA atau Verifikasi WAF"
            style={{
              padding: '0 14px',
              minHeight: '38px',
              borderRadius: '4px',
              background: isBrowserOpen 
                ? 'linear-gradient(180deg, #2D3D52 0%, #17212D 100%)' 
                : 'linear-gradient(180deg, #243242 0%, #131B24 100%)',
              border: isBrowserOpen ? '1px solid #4D627E' : '1px solid #384A61',
              borderBottom: '2px solid #0A0F15',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 2px 4px rgba(0, 0, 0, 0.5)',
              color: isBrowserOpen ? '#F8FAFC' : '#CBD5E1',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Globe size={13} color="#94A3B8" />
            {isBrowserOpen ? 'TUTUP BROWSER' : 'BROWSER MANDIRI'}
          </button>

          {/* Tombol Toggle Ingest Komentar Plat Baja */}
          <button
            type="button"
            onClick={() => setIsIngestOpen(prev => !prev)}
            title="Buka Konsol Ingest untuk Salin-Tempel Komentar Mentah"
            style={{
              padding: '0 14px',
              minHeight: '38px',
              borderRadius: '4px',
              background: isIngestOpen 
                ? 'linear-gradient(180deg, #2D3D52 0%, #17212D 100%)' 
                : 'linear-gradient(180deg, #243242 0%, #131B24 100%)',
              border: isIngestOpen ? '1px solid #4D627E' : '1px solid #384A61',
              borderBottom: '2px solid #0A0F15',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 2px 4px rgba(0, 0, 0, 0.5)',
              color: isIngestOpen ? '#F8FAFC' : '#CBD5E1',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <Sliders size={13} color="#94A3B8" />
            INGEST
            {isIngestOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {/* Drawer Ingest Komentar Mentah */}
        {isIngestOpen && (
          <div style={{
            background: '#0B1017',
            border: '1px solid #233144',
            borderRadius: '4px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#FBBF24' }}>
                KONSOL INGEST KOMENTAR MENTAH (FAIL-SAFE)
              </span>
              <span style={{ fontSize: '9.5px', color: '#64748B' }}>
                Format: @username: komentar ATAU baris demi baris ATAU JSON array
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
                borderRadius: '3px',
                background: '#0F151E',
                border: '1px solid #1E2B3B',
                color: '#E2E8F0',
                fontSize: '11.5px',
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
            padding: '8px 12px',
            borderRadius: '3px',
            background: '#0D141F',
            border: '1px solid #233144',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#F87171',
            fontSize: '11.5px',
            fontFamily: 'var(--font-mono)'
          }}>
            <RotateCw size={13} className="spin" />
            <span>{analysisProgress}</span>
          </div>
        )}

        {/* Notifikasi Error */}
        {errorMessage && (
          <div style={{
            padding: '8px 12px',
            borderRadius: '3px',
            background: '#1A1215',
            border: '1px solid #4C1D24',
            color: '#F87171',
            fontSize: '11.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertTriangle size={14} color="#F87171" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* ─── 3. BROWSER MANDIRI / CAPTCHA SOLVER CONTAINER (SAAT AKTIF) ─── */}
      {isBrowserOpen && (
        <div 
          className="steel-chassis-card"
          style={{
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            padding: '0',
            position: 'relative'
          }}
        >
          <span className="bolt-tl" />
          <span className="bolt-tr" />
          <span className="bolt-bl" />
          <span className="bolt-br" />

          {/* Top Bar Browser */}
          <div style={{
            background: '#141C26',
            padding: '8px 14px',
            borderBottom: '1px solid #233144',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#64748B' }} />
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#64748B' }} />
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#64748B' }} />
              <span style={{ marginLeft: '6px', fontSize: '10.5px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#94A3B8' }}>
                CHROMIUM SANDBOX SIDECAR
              </span>
            </div>

            <div style={{
              flex: 1,
              maxWidth: '600px',
              padding: '4px 10px',
              borderRadius: '3px',
              background: '#0B1017',
              border: '1px solid #1F2B3B',
              fontSize: '10.5px',
              fontFamily: 'var(--font-mono)',
              color: '#94A3B8',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {targetUrl}
            </div>

            <button
              type="button"
              onClick={() => setIsBrowserOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Banner Peringatan CAPTCHA Interaktif */}
          <div style={{
            padding: '7px 14px',
            background: '#0D141F',
            borderBottom: '1px solid #233144',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '10.5px',
            color: '#CBD5E1'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <AlertTriangle size={13} color="#FBBF24" />
              <span>
                <strong>TUNTUNAN OPERATOR:</strong> Jika muncul tantangan verifikasi (puzzle slider TikTok atau Cloudflare), selesaikan langsung pada layar peramban.
              </span>
            </div>
            <button
              type="button"
              onClick={handleRunAnalysis}
              style={{
                padding: '3px 8px',
                borderRadius: '2px',
                background: 'linear-gradient(180deg, #2D3D52 0%, #17212D 100%)',
                border: '1px solid #4D627E',
                color: '#F8FAFC',
                fontSize: '9.5px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              EKSTRAK DATA
            </button>
          </div>

          {/* Viewport Browser */}
          <div
            ref={browserContainerRef}
            style={{
              height: '400px',
              background: '#090D13',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}
          >
            {isElectronAvailable ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Globe size={36} color="#64748B" style={{ marginBottom: '10px' }} />
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#F1F5F9' }}>
                  {browserLoading ? 'Memuat Halaman Target Melalui Chromium Sandbox...' : 'WebContentsView Chromium Sedang Beroperasi'}
                </div>
                <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '3px' }}>
                  Jendela peramban terisolasi aktif. Konten terisolasi dari lingkungan utama sistem.
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px', maxWidth: '500px' }}>
                <Globe size={36} color="#FBBF24" style={{ marginBottom: '10px' }} />
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#F1F5F9' }}>
                  Simulasi Browser Mandiri (Mode Web)
                </div>
                <p style={{ fontSize: '11px', color: '#94A3B8', lineHeight: 1.5, marginTop: '5px' }}>
                  Pada peramban Web, peramban Chromium terisolasi berjalan di jendela terpisah. Anda dapat membuka tautan target di tab baru, lalu salin komentarnya ke kotak <strong>Ingest Komentar</strong>.
                </p>
                <a
                  href={targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                    borderRadius: '3px',
                    background: '#16202E',
                    border: '1px solid #2B384E',
                    color: '#F87171',
                    fontSize: '10.5px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    textDecoration: 'none',
                    marginTop: '8px'
                  }}
                >
                  Buka Tautan di Tab Baru <ExternalLink size={11} />
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── 4. TAMPILAN 4 DECK HASIL ANALISIS INTELIJEN (CHASSIS PLAT BAJA) ─── */}
      {!analysisResult ? (
        <div 
          className="steel-chassis-card"
          style={{
            padding: '50px 20px',
            textAlign: 'center',
            position: 'relative'
          }}
        >
          <span className="bolt-tl" />
          <span className="bolt-tr" />
          <span className="bolt-bl" />
          <span className="bolt-br" />

          <Share2 size={36} color="#475569" style={{ margin: '0 auto 10px', opacity: 0.8 }} />
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#F1F5F9', fontFamily: 'var(--font-mono)' }}>
            KONSOL INTELIJEN MEDIA SOSIAL SIAP BEROPERASI
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '5px', maxWidth: '500px', margin: '5px auto 0', lineHeight: 1.5 }}>
            Masukkan tautan postingan YouTube, TikTok, Instagram, atau Threads pada kolom di atas, lalu klik <strong>"MULAI ANALISIS"</strong> untuk mengekstraksi metrik, top komentar, dan pola buzzer.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* BARIS ATAS: DECK 1 & DECK 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '18px' }}>
            {/* ─── DECK 1: PROFIL KONTEN & METRIK KREATOR ─── */}
            <div 
              className="steel-chassis-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '18px 20px',
                position: 'relative'
              }}
            >
              <span className="bolt-tl" />
              <span className="bolt-tr" />
              <span className="bolt-bl" />
              <span className="bolt-br" />

              <div>
                {/* Header Deck 1 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      padding: '2px 7px',
                      borderRadius: '2px',
                      background: '#101622',
                      border: '1px solid #2B384E',
                      color: '#EF4444',
                      fontSize: '9.5px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 800
                    }}>
                      DECK 1
                    </span>
                    <h3 style={{ margin: 0, fontSize: '12.5px', fontWeight: 800, color: '#F1F5F9', letterSpacing: '0.8px' }}>
                      PROFIL KONTEN &amp; METRIK KREATOR
                    </h3>
                  </div>

                  <span style={{
                    padding: '2px 6px',
                    borderRadius: '2px',
                    background: '#0B1017',
                    border: '1px solid #1E2B3B',
                    color: '#64748B',
                    fontSize: '9.5px',
                    fontFamily: 'var(--font-mono)'
                  }}>
                    METODE: {analysisResult.post.acquisitionMethod}
                  </span>
                </div>

                {/* Judul & Kapsi Konten */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{
                    fontSize: '13.5px',
                    fontWeight: 800,
                    color: '#F8FAFC',
                    lineHeight: 1.4,
                    marginBottom: '6px'
                  }}>
                    {analysisResult.post.title || 'Postingan Tanpa Judul'}
                  </div>
                  <div style={{
                    fontSize: '11.5px',
                    color: '#94A3B8',
                    lineHeight: 1.6,
                    maxHeight: '75px',
                    overflowY: 'auto',
                    padding: '8px 10px',
                    background: '#0B1017',
                    borderRadius: '3px',
                    border: '1px solid #1E2837',
                    boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.6)'
                  }}>
                    {analysisResult.post.caption || 'Tidak ada deskripsi/kapsi tambahan.'}
                  </div>
                </div>

                {/* Profil Akun Kreator */}
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '3px',
                  background: '#0B1017',
                  border: '1px solid #1E2837',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '14px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#16202E',
                      border: '1px solid #2B384E',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      color: '#F1F5F9',
                      fontSize: '12px'
                    }}>
                      {analysisResult.post.authorName.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#F1F5F9', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {analysisResult.post.authorName}
                        <ShieldCheck size={13} color="#34D399" />
                      </div>
                      <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: '#EF4444' }}>
                        {analysisResult.post.authorHandle}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                      PENGIKUT / SUBS
                    </div>
                    <div style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#F1F5F9' }}>
                      {analysisResult.post.authorFollowersCount !== undefined
                        ? `${fmt(analysisResult.post.authorFollowersCount)} akun`
                        : 'Tidak Tersedia Publik'}
                    </div>
                  </div>
                </div>

                {/* Grid Metrik Interaksi */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
                  <div style={{ padding: '8px', background: '#0B1017', borderRadius: '3px', border: '1px solid #1E2837', textAlign: 'center' }}>
                    <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <Heart size={11} color="#F87171" /> LIKES
                    </div>
                    <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#F1F5F9', marginTop: '3px' }}>
                      {fmt(analysisResult.post.likeCount)}
                    </div>
                  </div>

                  <div style={{ padding: '8px', background: '#0B1017', borderRadius: '3px', border: '1px solid #1E2837', textAlign: 'center' }}>
                    <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <Eye size={11} color="#EF4444" /> TAYANGAN
                    </div>
                    <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#F1F5F9', marginTop: '3px' }}>
                      {fmt(analysisResult.post.viewCount)}
                    </div>
                  </div>

                  <div style={{ padding: '8px', background: '#0B1017', borderRadius: '3px', border: '1px solid #1E2837', textAlign: 'center' }}>
                    <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <MessageSquare size={11} color="#FBBF24" /> KOMENTAR
                    </div>
                    <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#F1F5F9', marginTop: '3px' }}>
                      {analysisResult.post.commentsDisabled ? 'DINONAKTIFKAN' : fmt(analysisResult.post.commentCount)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Provenance Notice */}
              <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#475569', borderTop: '1px solid #1E2837', paddingTop: '8px' }}>
                INTEGRITAS SUMBER: {analysisResult.post.dataSourceNotice}
              </div>
            </div>

            {/* ─── DECK 2: TOP KOMENTAR TERPOPULER ─── */}
            <div 
              className="steel-chassis-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '18px 20px',
                position: 'relative'
              }}
            >
              <span className="bolt-tl" />
              <span className="bolt-tr" />
              <span className="bolt-bl" />
              <span className="bolt-br" />

              {/* Header Deck 2 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    padding: '2px 7px',
                    borderRadius: '2px',
                    background: '#101622',
                    border: '1px solid #2B384E',
                    color: '#FBBF24',
                    fontSize: '9.5px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800
                  }}>
                    DECK 2
                  </span>
                  <h3 style={{ margin: 0, fontSize: '12.5px', fontWeight: 800, color: '#F1F5F9', letterSpacing: '0.8px' }}>
                    TOP KOMENTAR TERPOPULER
                  </h3>
                </div>

                <span style={{
                  padding: '2px 6px',
                  borderRadius: '2px',
                  background: '#0B1017',
                  border: '1px solid #1E2B3B',
                  color: '#64748B',
                  fontSize: '9.5px',
                  fontFamily: 'var(--font-mono)'
                }}>
                  {analysisResult.topComments.length} KOMENTAR TERSELEKSI
                </span>
              </div>

              {/* Daftar Top Komentar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', overflowY: 'auto', maxHeight: '340px' }}>
                {analysisResult.topComments.length === 0 ? (
                  <div style={{
                    padding: '24px',
                    textAlign: 'center',
                    background: '#0B1017',
                    borderRadius: '3px',
                    border: '1px dashed #233144',
                    color: '#64748B',
                    fontSize: '11.5px'
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
                        padding: '10px 12px',
                        borderRadius: '3px',
                        background: '#0B1017',
                        border: '1px solid #1E2837',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '5px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <span style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '2px',
                            background: idx === 0 ? '#334155' : '#1E293B',
                            color: '#F8FAFC',
                            fontSize: '9.5px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid #475569'
                          }}>
                            #{idx + 1}
                          </span>
                          <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#F1F5F9' }}>
                            {cmt.authorDisplayName || cmt.authorUsername}
                          </span>
                          <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: '#EF4444' }}>
                            {cmt.authorUsername}
                          </span>
                        </div>

                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '1px 6px',
                          borderRadius: '2px',
                          background: '#16202E',
                          border: '1px solid #2B384E',
                          color: '#F87171',
                          fontSize: '10px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700
                        }}>
                          <Heart size={10} /> {fmt(cmt.likeCount)}
                        </div>
                      </div>

                      <div style={{ fontSize: '11.5px', color: '#CBD5E1', lineHeight: 1.5 }}>
                        {cmt.text}
                      </div>

                      {cmt.publishedAt && (
                        <div style={{ fontSize: '9.5px', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '18px' }}>
            {/* ─── DECK 3: KLUSTER KOMENTAR TEMPLATE (COPYPASTA) ─── */}
            <div 
              className="steel-chassis-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '18px 20px',
                position: 'relative'
              }}
            >
              <span className="bolt-tl" />
              <span className="bolt-tr" />
              <span className="bolt-bl" />
              <span className="bolt-br" />

              {/* Header Deck 3 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    padding: '2px 7px',
                    borderRadius: '2px',
                    background: '#101622',
                    border: '1px solid #2B384E',
                    color: '#F59E0B',
                    fontSize: '9.5px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800
                  }}>
                    DECK 3
                  </span>
                  <h3 style={{ margin: 0, fontSize: '12.5px', fontWeight: 800, color: '#F1F5F9', letterSpacing: '0.8px' }}>
                    KLUSTER KOMENTAR TEMPLAT (COPYPASTA)
                  </h3>
                </div>

                <span style={{
                  padding: '2px 6px',
                  borderRadius: '2px',
                  background: '#0B1017',
                  border: '1px solid #1E2B3B',
                  color: analysisResult.copypastaClusters.length > 0 ? '#FBBF24' : '#64748B',
                  fontSize: '9.5px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700
                }}>
                  {analysisResult.copypastaClusters.length} KLUSTER DITEMUKAN
                </span>
              </div>

              {/* Daftar Kluster Copypasta */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '340px' }}>
                {analysisResult.copypastaClusters.length === 0 ? (
                  <div style={{
                    padding: '24px',
                    textAlign: 'center',
                    background: '#0B1017',
                    borderRadius: '3px',
                    border: '1px dashed #233144',
                    color: '#64748B',
                    fontSize: '11.5px'
                  }}>
                    Tidak terdeteksi duplikasi templat yang signifikan (Variasi leksikal tinggi, Jaccard &lt; 0.70).
                  </div>
                ) : (
                  analysisResult.copypastaClusters.map((cl) => (
                    <div
                      key={cl.clusterId}
                      style={{
                        padding: '12px',
                        borderRadius: '3px',
                        background: '#0B1017',
                        border: '1px solid #233144',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '7px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{
                          fontSize: '10.5px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 800,
                          color: '#FBBF24'
                        }}>
                          KLUSTER #{cl.clusterId.replace('cluster-', '')}: {cl.commentCount} KOMENTAR ({cl.percentageOfTotal}% DARI TOTAL)
                        </span>

                        {cl.temporalSpanSeconds !== undefined && (
                          <span style={{ fontSize: '9.5px', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                            <Clock size={10} style={{ display: 'inline', marginRight: '3px' }} />
                            Rentang: {cl.temporalSpanSeconds} detik
                          </span>
                        )}
                      </div>

                      {/* Teks Templat */}
                      <div style={{
                        padding: '7px 9px',
                        borderRadius: '3px',
                        background: '#121A24',
                        borderLeft: '3px solid #D4AF37',
                        fontSize: '11.5px',
                        color: '#F1F5F9',
                        fontStyle: 'italic',
                        lineHeight: 1.5
                      }}>
                        "{cl.templateText}"
                      </div>

                      {/* Akun yang Terlibat */}
                      <div>
                        <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#64748B', marginBottom: '3px' }}>
                          AKUN TERLIBAT DALAM TEMPLAT INI ({cl.accountsInvolved.length} AKUN):
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                          {cl.accountsInvolved.map(acc => (
                            <span
                              key={acc}
                              style={{
                                padding: '1px 5px',
                                borderRadius: '2px',
                                background: '#16202C',
                                border: '1px solid #233144',
                                color: '#94A3B8',
                                fontSize: '9.5px',
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
            <div 
              className="steel-chassis-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '18px 20px',
                position: 'relative'
              }}
            >
              <span className="bolt-tl" />
              <span className="bolt-tr" />
              <span className="bolt-bl" />
              <span className="bolt-br" />

              <div>
                {/* Header Deck 4 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      padding: '2px 7px',
                      borderRadius: '2px',
                      background: '#101622',
                      border: '1px solid #2B384E',
                      color: '#F87171',
                      fontSize: '9.5px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 800
                    }}>
                      DECK 4
                    </span>
                    <h3 style={{ margin: 0, fontSize: '12.5px', fontWeight: 800, color: '#F1F5F9', letterSpacing: '0.8px' }}>
                      INDIKATOR POLA BUZZER &amp; BOT
                    </h3>
                  </div>

                  <span style={{
                    padding: '2px 6px',
                    borderRadius: '2px',
                    background: '#0B1017',
                    border: '1px solid #1E2B3B',
                    color: analysisResult.buzzerPattern.coordinationLevel === 'TINGGI'
                      ? '#F87171'
                      : analysisResult.buzzerPattern.coordinationLevel === 'SEDANG'
                      ? '#FBBF24'
                      : '#34D399',
                    fontSize: '9.5px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800
                  }}>
                    KOORDINASI: {analysisResult.buzzerPattern.coordinationLevel} ({analysisResult.buzzerPattern.coordinationScore}%)
                  </span>
                </div>

                {/* Ringkasan Narasi Buzzer */}
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '3px',
                  background: '#0B1017',
                  border: '1px solid #1E2837',
                  marginBottom: '14px'
                }}>
                  <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#F87171', fontWeight: 700, marginBottom: '5px' }}>
                    RINGKASAN NARASI YANG DIPAKSAKAN:
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#F1F5F9', lineHeight: 1.6 }}>
                    {analysisResult.buzzerPattern.narrativeSummary}
                  </div>
                </div>

                {/* Metrik Burst Velocity & Keywords */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                  <div style={{ padding: '8px', background: '#0B1017', borderRadius: '3px', border: '1px solid #1E2837' }}>
                    <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                      KECEPATAN SEBARAN (BURST)
                    </div>
                    <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#F1F5F9', marginTop: '3px' }}>
                      {analysisResult.buzzerPattern.burstVelocityCommentPerMinute} cmt/menit
                    </div>
                  </div>

                  <div style={{ padding: '8px', background: '#0B1017', borderRadius: '3px', border: '1px solid #1E2837' }}>
                    <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                      KATA KUNCI DOMINAN
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '3px' }}>
                      {analysisResult.buzzerPattern.dominantKeywords.map(kw => (
                        <span
                          key={kw}
                          style={{
                            padding: '1px 5px',
                            borderRadius: '2px',
                            background: '#16202C',
                            border: '1px solid #233144',
                            color: '#94A3B8',
                            fontSize: '9.5px',
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
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#64748B', marginBottom: '4px' }}>
                      SAMPEL AKUN TERINDIKASI BUZZER ({analysisResult.buzzerPattern.sampleAccounts.length} AKUN):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                      {analysisResult.buzzerPattern.sampleAccounts.map(acc => (
                        <span
                          key={acc}
                          style={{
                            padding: '1px 6px',
                            borderRadius: '2px',
                            background: '#16202C',
                            border: '1px solid #233144',
                            color: '#F87171',
                            fontSize: '9.5px',
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
              <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#475569', borderTop: '1px solid #1E2837', paddingTop: '8px' }}>
                DASAR PEMBUKTIAN: {analysisResult.buzzerPattern.evidenceRationale}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
