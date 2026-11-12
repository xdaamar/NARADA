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
  Search,
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
  X
} from 'lucide-react'
import {
  executeSocialPostAnalysis,
  validateSocialPlatformUrl,
  detectSocialPlatform,
  sanitizeSocialUrl,
  PLATFORM_INFO_MAP,
  PRELOADED_TEST_SCENARIOS,
  type SocialMediaType,
  type SocialPostAnalysisResult,
  type PreloadedTestScenario
} from '../engine/social/social-post-analyzer.ts'

/**
 * Resolves an embeddable in-app player URL for the given social URL & platform.
 * Supports YouTube (watch, shorts, live, embed, youtu.be), TikTok, Instagram, Threads.
 */
function resolveInAppEmbedTarget(url: string, defaultPlatform: SocialMediaType) {
  if (!url || !url.trim()) {
    return { embedUrl: null, platform: defaultPlatform, postId: null }
  }

  const cleanUrl = sanitizeSocialUrl(url.trim())
  const detected = detectSocialPlatform(cleanUrl)
  const effectivePlatform = detected.platform !== 'UNKNOWN' ? detected.platform : defaultPlatform
  const postId = detected.postId

  if (effectivePlatform === 'youtube' && postId) {
    return {
      embedUrl: `https://www.youtube.com/embed/${postId}?autoplay=1&enablejsapi=1&rel=0`,
      platform: 'youtube',
      postId
    }
  }

  if (effectivePlatform === 'tiktok' && postId) {
    return {
      embedUrl: `https://www.tiktok.com/embed/v2/${postId}`,
      platform: 'tiktok',
      postId
    }
  }

  if (effectivePlatform === 'instagram' && postId) {
    return {
      embedUrl: `https://www.instagram.com/p/${postId}/embed/captioned/`,
      platform: 'instagram',
      postId
    }
  }

  if (effectivePlatform === 'threads' && postId) {
    return {
      embedUrl: `https://www.threads.net/embed/post/${postId}`,
      platform: 'threads',
      postId
    }
  }

  // Fallback jika URL valid tapi tidak ada skema embed spesifik
  if (/^https?:\/\//i.test(cleanUrl)) {
    return {
      embedUrl: cleanUrl,
      platform: effectivePlatform,
      postId: null
    }
  }

  return { embedUrl: null, platform: effectivePlatform, postId: null }
}

export default function SocialPostIntelligenceConsole() {
  // ─── STATE KONSOL TAKTIS ───
  const [selectedPlatform, setSelectedPlatform] = useState<SocialMediaType>('youtube')
  const [targetUrl, setTargetUrl] = useState<string>('')
  const [extractionMode, setExtractionMode] = useState<'AUTO' | 'BROWSER'>('AUTO')

  // Status Eksekusi (Halaman Bersih & Kosong saat Pertama Dibuka)
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [analysisProgress, setAnalysisProgress] = useState<string>('')
  const [analysisResult, setAnalysisResult] = useState<SocialPostAnalysisResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Status Filter Platform & Popup Notifikasi Penolakan Tautan Mismatch
  const [mismatchNotice, setMismatchNotice] = useState<{
    isOpen: boolean
    targetPlatform: SocialMediaType
    detectedPlatform: SocialMediaType | 'UNKNOWN'
    enteredUrl: string
    reason: 'MISMATCH' | 'UNSUPPORTED'
  } | null>(null)

  // Status Browser Mandiri (Electron Integration)
  const [isBrowserOpen, setIsBrowserOpen] = useState<boolean>(false)
  const [isElectronAvailable, setIsElectronAvailable] = useState<boolean>(false)
  const [browserLoading, setBrowserLoading] = useState<boolean>(false)
  const browserContainerRef = useRef<HTMLDivElement>(null)

  // Target Embed In-App Player Terkini
  const inAppEmbed = resolveInAppEmbedTarget(targetUrl, selectedPlatform)

  // Cek ketersediaan Electron IPC
  useEffect(() => {
    const isElec = typeof window !== 'undefined' && Boolean((window as any).naradaEvidenceBrowser)
    setIsElectronAvailable(isElec)
  }, [])

  // Handler pergantian teks URL
  const handleUrlChange = (val: string) => {
    setTargetUrl(val)
    setErrorMessage(null)
  }

  // Filter & Penolakan Tautan saat Pengguna Menempel Tautan (Paste)
  const handleUrlPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').trim()
    if (!pasted) return
    const validation = validateSocialPlatformUrl(pasted, selectedPlatform)
    if (validation.isMismatch) {
      e.preventDefault()
      setTargetUrl(pasted)
      setMismatchNotice({
        isOpen: true,
        targetPlatform: selectedPlatform,
        detectedPlatform: validation.detectedPlatform,
        enteredUrl: pasted,
        reason: 'MISMATCH'
      })
    } else if (!validation.isValid && validation.detectedPlatform === 'UNKNOWN' && (pasted.includes('http') || pasted.includes('.com') || pasted.includes('.'))) {
      e.preventDefault()
      setTargetUrl(pasted)
      setMismatchNotice({
        isOpen: true,
        targetPlatform: selectedPlatform,
        detectedPlatform: 'UNKNOWN',
        enteredUrl: pasted,
        reason: 'UNSUPPORTED'
      })
    }
  }

  // Validasi saat fokus input ditinggalkan (Blur)
  const handleUrlBlur = () => {
    if (!targetUrl.trim()) return
    const validation = validateSocialPlatformUrl(targetUrl, selectedPlatform)
    if (validation.isMismatch) {
      setMismatchNotice({
        isOpen: true,
        targetPlatform: selectedPlatform,
        detectedPlatform: validation.detectedPlatform,
        enteredUrl: targetUrl.trim(),
        reason: 'MISMATCH'
      })
    } else if (!validation.isValid && validation.detectedPlatform === 'UNKNOWN' && (targetUrl.includes('http') || targetUrl.includes('.com') || targetUrl.includes('.'))) {
      setMismatchNotice({
        isOpen: true,
        targetPlatform: selectedPlatform,
        detectedPlatform: 'UNKNOWN',
        enteredUrl: targetUrl.trim(),
        reason: 'UNSUPPORTED'
      })
    }
  }

  // Handler pemilihan tab Target Platform: Reset total semua input dan hasil analisa saat berpindah platform
  const handleSelectPlatformTab = (plat: SocialMediaType) => {
    if (plat === selectedPlatform) return
    setSelectedPlatform(plat)
    setTargetUrl('')
    setAnalysisResult(null)
    setErrorMessage(null)
    setMismatchNotice(null)
    setIsAnalyzing(false)
    setAnalysisProgress('')
  }

  // Pilih Skenario Uji Demo
  const handleSelectScenario = (sc: PreloadedTestScenario) => {
    setSelectedPlatform(sc.platform)
    setTargetUrl(sc.url)
    setAnalysisResult(sc.mockResult)
    setErrorMessage(null)
    setMismatchNotice(null)
  }

  // Eksekusi Analisis dengan Filter Link Ketat Antar Platform
  const handleRunAnalysis = async () => {
    if (!targetUrl.trim()) {
      setErrorMessage('Harap masukkan URL postingan media sosial yang valid.')
      return
    }

    // STRICT GATEKEEPER: Cek filter kesesuaian target platform & link
    if (targetUrl.trim()) {
      const validation = validateSocialPlatformUrl(targetUrl, selectedPlatform)
      if (!validation.isValid) {
        setMismatchNotice({
          isOpen: true,
          targetPlatform: selectedPlatform,
          detectedPlatform: validation.detectedPlatform,
          enteredUrl: targetUrl.trim(),
          reason: validation.isMismatch ? 'MISMATCH' : 'UNSUPPORTED'
        })
        return
      }
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
        platform: selectedPlatform
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
            <Search size={20} />
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
                  onClick={() => handleSelectPlatformTab(plat)}
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
            { id: 'BROWSER' as const, label: 'Browser Mandiri (WAF/CAPTCHA)' }
          ].map(m => {
            const isSel = extractionMode === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setExtractionMode(m.id)
                  if (m.id === 'BROWSER') setIsBrowserOpen(true)
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
              onPaste={handleUrlPaste}
              onBlur={handleUrlBlur}
              placeholder={`Tempel tautan postingan ${PLATFORM_INFO_MAP[selectedPlatform]?.name.toUpperCase()} (misal: ${PLATFORM_INFO_MAP[selectedPlatform]?.exampleUrl})`}
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
        </div>

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

          {/* Top Bar Browser Mandiri */}
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
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }} />
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }} />
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
              <span style={{ marginLeft: '6px', fontSize: '10.5px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#94A3B8' }}>
                IN-APP BROWSER MANDIRI [LIVE SANDBOX VIEWPORT]
              </span>
              {browserLoading && <RotateCw size={11} className="spin" color="#38BDF8" />}
            </div>

            <div style={{
              flex: 1,
              maxWidth: '540px',
              padding: '4px 10px',
              borderRadius: '3px',
              background: '#0B1017',
              border: '1px solid #1F2B3B',
              fontSize: '10.5px',
              fontFamily: 'var(--font-mono)',
              color: '#38BDF8',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Globe size={11} color="#64748B" />
              <span>{targetUrl || 'about:blank (Standby)'}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {targetUrl && (
                <a
                  href={targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Buka Tautan di Tab Baru Eksternal"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '2px',
                    background: '#162232',
                    border: '1px solid #24354A',
                    color: '#94A3B8',
                    fontSize: '9.5px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    textDecoration: 'none'
                  }}
                >
                  <ExternalLink size={10} /> TAB BARU
                </a>
              )}
              <button
                type="button"
                onClick={() => setIsBrowserOpen(false)}
                title="Tutup Browser Mandiri"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Banner Status & Panduan Operasional */}
          <div style={{
            padding: '7px 14px',
            background: '#0D141F',
            borderBottom: '1px solid #233144',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '10.5px',
            color: '#CBD5E1',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: inAppEmbed.embedUrl ? '#10B981' : '#F59E0B', boxShadow: inAppEmbed.embedUrl ? '0 0 6px #10B981' : 'none' }} />
              <span>
                <strong>LIVE IN-APP VIEWPORT:</strong> {inAppEmbed.embedUrl 
                  ? `Konten ${inAppEmbed.platform.toUpperCase()} aktif diputar langsung di konsol aplikasi Narada tanpa keluar sistem.` 
                  : 'Siap memuat tayangan media. Masukkan tautan target atau klik skenario uji.'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleRunAnalysis}
                disabled={isAnalyzing || !targetUrl.trim()}
                style={{
                  padding: '4px 12px',
                  borderRadius: '3px',
                  background: isAnalyzing ? '#1C2430' : 'linear-gradient(180deg, #3B1A1E 0%, #220F12 100%)',
                  border: isAnalyzing ? '1px solid #2B384A' : '1px solid #7F1D1D',
                  color: isAnalyzing ? '#64748B' : '#FCA5A5',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 800,
                  cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                {isAnalyzing ? <RotateCw size={11} className="spin" /> : <Zap size={11} />}
                {isAnalyzing ? 'MENGANALISIS...' : '⚡ JALANKAN ANALISIS 4-DECK'}
              </button>
            </div>
          </div>

          {/* Viewport Browser Mandiri */}
          <div
            ref={browserContainerRef}
            style={{
              minHeight: '440px',
              background: '#090D13',
              position: 'relative'
            }}
          >
            {inAppEmbed.embedUrl ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.6fr) minmax(320px, 1fr)',
                gap: '12px',
                padding: '12px'
              }}>
                {/* Kolom Kiri: Live Media Player (Iframe Nyata) */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  minHeight: '440px',
                  background: '#000000',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  border: '1px solid #1F2B3B',
                  boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8)',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <iframe
                    src={inAppEmbed.embedUrl}
                    title="In-App Browser Mandiri Viewport"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    style={{
                      width: '100%',
                      height: '100%',
                      minHeight: '440px',
                      border: 'none',
                      background: '#000000',
                      display: 'block',
                      flex: 1
                    }}
                  />
                </div>

                {/* Kolom Kanan: Baki Telemetri Intelijen & Panel Aksi */}
                <div style={{
                  background: '#0D141F',
                  border: '1px solid #1F2B3B',
                  borderRadius: '4px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  {/* Status Target Telemetri */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #1E2B3C',
                    paddingBottom: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10B981' }} />
                      <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#E2E8F0' }}>
                        TAKTIKAL TELEMETRI KONTEN
                      </span>
                    </div>
                    <span style={{
                      fontSize: '9.5px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '2px',
                      background: '#1A2433',
                      border: '1px solid #2B3D54',
                      color: '#38BDF8'
                    }}>
                      ID: {inAppEmbed.postId || 'LIVE-STREAM'}
                    </span>
                  </div>

                  {/* Profil Kreator & Metrik atau Prompt Eksekusi */}
                  {analysisResult ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{
                        background: '#080C12',
                        border: '1px solid #1E293B',
                        borderRadius: '3px',
                        padding: '10px'
                      }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#F8FAFC', marginBottom: '4px', lineHeight: 1.3 }}>
                          {analysisResult.post.title}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', color: '#94A3B8' }}>
                          <span style={{ color: '#F87171', fontWeight: 700 }}>{analysisResult.post.authorName}</span>
                          <span>•</span>
                          <span>{analysisResult.post.authorFollowersCount ? `${analysisResult.post.authorFollowersCount.toLocaleString('id-ID')} Pengikut` : 'Publik'}</span>
                        </div>
                      </div>

                      {/* Stat Metrik Mini */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                        <div style={{ background: '#090E16', border: '1px solid #1A2534', padding: '6px 8px', borderRadius: '3px', textAlign: 'center' }}>
                          <div style={{ fontSize: '9px', color: '#64748B', fontFamily: 'var(--font-mono)' }}>TAYANGAN</div>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#F8FAFC', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                            {analysisResult.post.viewCount !== undefined ? analysisResult.post.viewCount.toLocaleString('id-ID') : '—'}
                          </div>
                        </div>
                        <div style={{ background: '#090E16', border: '1px solid #1A2534', padding: '6px 8px', borderRadius: '3px', textAlign: 'center' }}>
                          <div style={{ fontSize: '9px', color: '#64748B', fontFamily: 'var(--font-mono)' }}>SUKA</div>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#F8FAFC', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                            {analysisResult.post.likeCount !== undefined ? analysisResult.post.likeCount.toLocaleString('id-ID') : '—'}
                          </div>
                        </div>
                        <div style={{ background: '#090E16', border: '1px solid #1A2534', padding: '6px 8px', borderRadius: '3px', textAlign: 'center' }}>
                          <div style={{ fontSize: '9px', color: '#64748B', fontFamily: 'var(--font-mono)' }}>KOMENTAR</div>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#F8FAFC', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                            {analysisResult.topComments.length.toLocaleString('id-ID')}
                          </div>
                        </div>
                      </div>

                      {/* Cuplikan Komentar Live Teratas */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#64748B', fontWeight: 700 }}>
                          CUPLIKAN KOMENTAR AUDIENS ({analysisResult.topComments.length} TERDETEKSI):
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '150px', overflowY: 'auto' }}>
                          {analysisResult.topComments.slice(0, 3).map((c, idx) => (
                            <div key={idx} style={{
                              background: '#080C12',
                              border: '1px solid #17212F',
                              borderRadius: '3px',
                              padding: '6px 8px',
                              fontSize: '10px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#38BDF8', fontWeight: 700, marginBottom: '2px' }}>
                                <span>{c.authorDisplayName || c.authorUsername}</span>
                                <span style={{ color: '#64748B', fontFamily: 'var(--font-mono)' }}>♥ {c.likeCount}</span>
                              </div>
                              <div style={{ color: '#CBD5E1', lineHeight: 1.3 }}>
                                {c.text}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flex: 1,
                      textAlign: 'center',
                      padding: '16px',
                      background: '#090E16',
                      border: '1px dashed #24354A',
                      borderRadius: '4px',
                      gap: '10px'
                    }}>
                      <Globe size={28} color="#64748B" />
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#F1F5F9' }}>
                        Konten Siap Dianalisis
                      </div>
                      <p style={{ fontSize: '10.5px', color: '#94A3B8', lineHeight: 1.4, margin: 0 }}>
                        Tayangan video sedang berputar langsung di viewport kiri. Jalankan ekstraksi untuk mengisi 4-Deck intelijen (metrik kreator, komentar, copypasta, dan buzzer).
                      </p>
                      <button
                        type="button"
                        onClick={handleRunAnalysis}
                        disabled={isAnalyzing}
                        style={{
                          marginTop: '4px',
                          padding: '6px 14px',
                          borderRadius: '3px',
                          background: 'linear-gradient(180deg, #3B1A1E 0%, #220F12 100%)',
                          border: '1px solid #7F1D1D',
                          color: '#FCA5A5',
                          fontSize: '10.5px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 800,
                          cursor: isAnalyzing ? 'not-allowed' : 'pointer'
                        }}
                      >
                        ⚡ JALANKAN EKSTRAKSI 4-DECK
                      </button>
                    </div>
                  )}

                  {/* Catatan Sandboxing PUSSIBERAD */}
                  <div style={{
                    marginTop: 'auto',
                    padding: '6px 8px',
                    borderRadius: '2px',
                    background: '#070A0F',
                    border: '1px solid #141D29',
                    fontSize: '9px',
                    color: '#64748B',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}>
                    <ShieldCheck size={11} color="#10B981" />
                    <span>Peramban mandiri terisolasi via Sandboxed Iframe Policy.</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Tampilan Standby saat targetUrl belum terisi */
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                maxWidth: '520px',
                margin: '0 auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}>
                <Globe size={40} color="#64748B" />
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#F1F5F9' }}>
                  PERAMBAN MANDIRI STANDBY: MENUNGGU TARGET TAUTAN
                </div>
                <p style={{ fontSize: '11px', color: '#94A3B8', lineHeight: 1.5, margin: 0 }}>
                  Bilah target belum terisi URL. Masukkan tautan postingan (YouTube, TikTok, Instagram, Threads) pada input di atas, atau klik salah satu skenario demo di bawah untuk memuat konten langsung di konsol Narada:
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '6px' }}>
                  {PRELOADED_TEST_SCENARIOS.map(sc => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => handleSelectScenario(sc)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '3px',
                        background: '#162232',
                        border: '1px solid #283C54',
                        color: '#38BDF8',
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      UJI {sc.platform.toUpperCase()}
                    </button>
                  ))}
                </div>
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
          {/* BARIS ATAS: DECK 1 & DECK 2 (Tinggi Identik 540px dengan Scroll Internal di Card Komentar) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '18px' }}>
            {/* ─── DECK 1: PROFIL KONTEN & METRIK KREATOR ─── */}
            <div 
              className="steel-chassis-card"
              data-deck="DECK 1"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '18px 20px',
                position: 'relative',
                height: '540px',
                maxHeight: '540px'
              }}
            >
              <span className="bolt-tl" />
              <span className="bolt-tr" />
              <span className="bolt-bl" />
              <span className="bolt-br" />

              <div>
                {/* Header Card Profil Konten */}
                <div style={{ marginBottom: '14px' }}>
                  <h3 style={{ margin: 0, fontSize: '12.5px', fontWeight: 800, color: '#F1F5F9', letterSpacing: '0.8px' }}>
                    PROFIL KONTEN &amp; METRIK KREATOR
                  </h3>
                </div>

                {/* Thumbnail Preview Konten Asli */}
                {analysisResult.post.thumbnailUrl && (
                  <div style={{
                    marginBottom: '12px',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    border: '1px solid #1E2837',
                    maxHeight: '140px',
                    background: '#090D13',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <img
                      src={analysisResult.post.thumbnailUrl}
                      alt={analysisResult.post.title}
                      style={{ width: '100%', height: '140px', objectFit: 'cover' }}
                      onError={(e) => {
                        const p = (e.currentTarget as HTMLElement).parentElement
                        if (p) p.style.display = 'none'
                      }}
                    />
                  </div>
                )}

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
                      fontSize: '12px',
                      overflow: 'hidden'
                    }}>
                      {analysisResult.post.authorAvatarUrl ? (
                        <img 
                          src={analysisResult.post.authorAvatarUrl} 
                          alt={analysisResult.post.authorName} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                      ) : (
                        analysisResult.post.authorName.charAt(0)
                      )}
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
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: analysisResult.post.shareCount !== undefined ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)', 
                  gap: '8px', 
                  marginBottom: '14px' 
                }}>
                  <div style={{ padding: '8px', background: '#0B1017', borderRadius: '3px', border: '1px solid #1E2837', textAlign: 'center', boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.4)' }}>
                    <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <Heart size={11} color="#F87171" /> LIKES
                    </div>
                    <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#F1F5F9', marginTop: '3px' }}>
                      {fmt(analysisResult.post.likeCount)}
                    </div>
                  </div>

                  <div style={{ padding: '8px', background: '#0B1017', borderRadius: '3px', border: '1px solid #1E2837', textAlign: 'center', boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.4)' }}>
                    <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <Eye size={11} color="#EF4444" /> TAYANGAN
                    </div>
                    <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#F1F5F9', marginTop: '3px' }}>
                      {fmt(analysisResult.post.viewCount)}
                    </div>
                  </div>

                  <div style={{ padding: '8px', background: '#0B1017', borderRadius: '3px', border: '1px solid #1E2837', textAlign: 'center', boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.4)' }}>
                    <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <MessageSquare size={11} color="#FBBF24" /> KOMENTAR
                    </div>
                    <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#F1F5F9', marginTop: '3px' }}>
                      {analysisResult.post.commentsDisabled ? 'NONAKTIF' : fmt(analysisResult.post.commentCount)}
                    </div>
                  </div>

                  {analysisResult.post.shareCount !== undefined && (
                    <div style={{ padding: '8px', background: '#0B1017', borderRadius: '3px', border: '1px solid #1E2837', textAlign: 'center', boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.4)' }}>
                      <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <Share2 size={11} color="#38BDF8" /> BAGIKAN
                      </div>
                      <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#F1F5F9', marginTop: '3px' }}>
                        {fmt(analysisResult.post.shareCount)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Provenance Notice */}
              <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#475569', borderTop: '1px solid #1E2837', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                <div>INTEGRITAS SUMBER: {analysisResult.post.dataSourceNotice}</div>
                {analysisResult.post.durationSeconds ? (
                  <div style={{ color: '#94A3B8' }}>
                    DURASI: {Math.floor(analysisResult.post.durationSeconds / 60)}m {analysisResult.post.durationSeconds % 60}s
                  </div>
                ) : null}
              </div>
            </div>

            {/* ─── DECK 2: TOP KOMENTAR TERPOPULER ─── */}
            <div 
              className="steel-chassis-card"
              data-deck="DECK 2"
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '18px 20px',
                position: 'relative',
                height: '540px',
                maxHeight: '540px'
              }}
            >
              <span className="bolt-tl" />
              <span className="bolt-tr" />
              <span className="bolt-bl" />
              <span className="bolt-br" />

              {/* Header Card Top Komentar */}
              <div style={{ marginBottom: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '12.5px', fontWeight: 800, color: '#F1F5F9', letterSpacing: '0.8px' }}>
                  TOP KOMENTAR TERPOPULER
                </h3>
              </div>

              {/* Daftar Top Komentar: Memenuhi seluruh tinggi vertikal card (identik Card 1), scroll internal otomatis jika memuat 10 komentar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '4px' }}>
                {analysisResult.topComments.length === 0 ? (
                  <div style={{
                    padding: '24px',
                    textAlign: 'center',
                    background: '#0B1017',
                    borderRadius: '3px',
                    border: '1px dashed #233144',
                    color: '#64748B',
                    fontSize: '11.5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 1
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
                          {cmt.authorAvatarUrl && (
                            <img 
                              src={cmt.authorAvatarUrl} 
                              alt={cmt.authorDisplayName || cmt.authorUsername}
                              style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }}
                              onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none' }}
                            />
                          )}
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

          {/* BARIS BAWAH: DECK 3 & DECK 4 (Tinggi Identik 460px dengan Scroll Internal di Kluster Templat) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '18px' }}>
            {/* ─── DECK 3: KLUSTER KOMENTAR TEMPLATE (COPYPASTA) ─── */}
            <div 
              className="steel-chassis-card"
              data-deck="DECK 3"
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '18px 20px',
                position: 'relative',
                height: '460px',
                maxHeight: '460px'
              }}
            >
              <span className="bolt-tl" />
              <span className="bolt-tr" />
              <span className="bolt-bl" />
              <span className="bolt-br" />

              {/* Header Card Kluster Templat */}
              <div style={{ marginBottom: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '12.5px', fontWeight: 800, color: '#F1F5F9', letterSpacing: '0.8px' }}>
                  KLUSTER KOMENTAR TEMPLAT (COPYPASTA)
                </h3>
              </div>

              {/* Daftar Kluster Copypasta: Scroll internal saat daftar kluster panjang */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '4px' }}>
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
              data-deck="DECK 4"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '18px 20px',
                position: 'relative',
                height: '460px',
                maxHeight: '460px'
              }}
            >
              <span className="bolt-tl" />
              <span className="bolt-tr" />
              <span className="bolt-bl" />
              <span className="bolt-br" />

              <div>
                {/* Header Card Pola Buzzer & Bot */}
                <div style={{ marginBottom: '14px' }}>
                  <h3 style={{ margin: 0, fontSize: '12.5px', fontWeight: 800, color: '#F1F5F9', letterSpacing: '0.8px' }}>
                    INDIKATOR POLA BUZZER &amp; BOT
                  </h3>
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

                {/* Metrik Koordinasi, Burst Velocity & Keywords */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '14px' }}>
                  <div style={{ padding: '8px', background: '#0B1017', borderRadius: '3px', border: '1px solid #1E2837' }}>
                    <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                      TINGKAT KOORDINASI
                    </div>
                    <div style={{
                      fontSize: '13px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 800,
                      color: analysisResult.buzzerPattern.coordinationLevel === 'TINGGI'
                        ? '#F87171'
                        : analysisResult.buzzerPattern.coordinationLevel === 'SEDANG'
                        ? '#FBBF24'
                        : '#34D399',
                      marginTop: '3px'
                    }}>
                      {analysisResult.buzzerPattern.coordinationLevel} ({analysisResult.buzzerPattern.coordinationScore}%)
                    </div>
                  </div>

                  <div style={{ padding: '8px', background: '#0B1017', borderRadius: '3px', border: '1px solid #1E2837' }}>
                    <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                      KECEPATAN SEBARAN (BURST)
                    </div>
                    <div style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#F1F5F9', marginTop: '3px' }}>
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

      {/* ─── MODAL POPUP PENOLAKAN TAUTAN MISMATCH (STEEL CHASSIS) ─── */}
      {mismatchNotice && mismatchNotice.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(4, 6, 9, 0.88)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setMismatchNotice(null)}
        >
          <div
            className="steel-chassis-card"
            style={{
              width: '100%',
              maxWidth: '560px',
              padding: '24px',
              position: 'relative',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 25px rgba(239, 68, 68, 0.25)',
              border: '1px solid #7F1D1D',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 4 Baut Hex Taktis Sudut */}
            <span className="bolt-tl" />
            <span className="bolt-tr" />
            <span className="bolt-bl" />
            <span className="bolt-br" />

            {/* Header Modal */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '4px',
                  background: 'linear-gradient(180deg, #451515 0%, #260A0A 100%)',
                  border: '1px solid #991B1B',
                  borderBottom: '2px solid #000000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 2px 4px rgba(0, 0, 0, 0.6)'
                }}>
                  <AlertTriangle size={22} color="#EF4444" />
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
                      FILTER TAUTAN TARGET MISI
                    </span>
                    <span style={{ fontSize: '10px', color: '#475569' }}>•</span>
                    <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: '#94A3B8' }}>
                      PUSSIBERAD AD
                    </span>
                  </div>
                  <h3 style={{
                    margin: '3px 0 0 0',
                    fontSize: '16px',
                    fontWeight: 800,
                    fontFamily: 'var(--font-display)',
                    color: '#F8FAFC',
                    letterSpacing: '0.8px',
                    textTransform: 'uppercase'
                  }}>
                    {mismatchNotice.reason === 'UNSUPPORTED' 
                      ? 'Format Tautan Tidak Dikenali' 
                      : 'Target Platform Tidak Sesuai'}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMismatchNotice(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Kotak Perbandingan Platform Taktis */}
            <div style={{
              background: '#0D131B',
              borderRadius: '4px',
              border: '1px solid #1E293B',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                    MENU AKTIF:
                  </span>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '3px',
                    background: '#1E293B',
                    border: '1px solid #334155',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800,
                    color: '#F8FAFC'
                  }}>
                    {PLATFORM_INFO_MAP[mismatchNotice.targetPlatform]?.name.toUpperCase() || mismatchNotice.targetPlatform.toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                    PLATFORM TAUTAN:
                  </span>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '3px',
                    background: mismatchNotice.detectedPlatform !== 'UNKNOWN' ? '#451515' : '#2A1F0D',
                    border: mismatchNotice.detectedPlatform !== 'UNKNOWN' ? '1px solid #991B1B' : '1px solid #854D0E',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800,
                    color: mismatchNotice.detectedPlatform !== 'UNKNOWN' ? '#EF4444' : '#FBBF24'
                  }}>
                    {mismatchNotice.detectedPlatform !== 'UNKNOWN' 
                      ? (PLATFORM_INFO_MAP[mismatchNotice.detectedPlatform as SocialMediaType]?.name.toUpperCase() || mismatchNotice.detectedPlatform.toUpperCase()) 
                      : 'TIDAK DIKENAL / LAINNYA'}
                  </span>
                </div>
              </div>

              {/* URL Snippet */}
              <div style={{
                background: '#070A0F',
                padding: '8px 10px',
                borderRadius: '3px',
                border: '1px solid #192330',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: '#EF4444',
                wordBreak: 'break-all'
              }}>
                {mismatchNotice.enteredUrl}
              </div>
            </div>

            {/* Narasi Peringatan Resmi Profesional */}
            <div style={{ fontSize: '12.5px', lineHeight: '1.6', color: '#CBD5E1' }}>
              {mismatchNotice.detectedPlatform !== 'UNKNOWN' ? (
                <>
                  Menu <strong style={{ color: '#F8FAFC' }}>{PLATFORM_INFO_MAP[mismatchNotice.targetPlatform]?.name}</strong> hanya menerima dan memproses tautan dari <strong style={{ color: '#F8FAFC' }}>{PLATFORM_INFO_MAP[mismatchNotice.targetPlatform]?.name}</strong> ({PLATFORM_INFO_MAP[mismatchNotice.targetPlatform]?.officialDomain}).
                  <br /><br />
                  Tautan yang Anda masukkan terdeteksi berasal dari platform <strong style={{ color: '#EF4444' }}>{PLATFORM_INFO_MAP[mismatchNotice.detectedPlatform as SocialMediaType]?.name}</strong>. Demi akurasi protokol intelijen dan pencegahan kesalahan ekstraksi data, silakan sesuaikan menu platform atau bersihkan tautan.
                </>
              ) : (
                <>
                  Format tautan yang dimasukkan tidak cocok dengan protokol resmi <strong style={{ color: '#F8FAFC' }}>{PLATFORM_INFO_MAP[mismatchNotice.targetPlatform]?.name}</strong>.
                  <br /><br />
                  Harap masukkan tautan yang valid seperti: <code style={{ color: '#EF4444', background: '#111827', padding: '2px 6px', borderRadius: '3px', fontSize: '11px' }}>{PLATFORM_INFO_MAP[mismatchNotice.targetPlatform]?.exampleUrl}</code>.
                </>
              )}
            </div>

            {/* Action Buttons Plat Besi Baja */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: '6px' }}>
              {mismatchNotice.detectedPlatform !== 'UNKNOWN' && (
                <button
                  type="button"
                  onClick={() => {
                    const newPlat = mismatchNotice.detectedPlatform as SocialMediaType
                    setSelectedPlatform(newPlat)
                    setMismatchNotice(null)
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '4px',
                    background: 'linear-gradient(180deg, #32435A 0%, #1A2534 100%)',
                    border: '1px solid #546C8C',
                    borderBottom: '2px solid #0B1017',
                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 2px 4px rgba(0, 0, 0, 0.6)',
                    color: '#F8FAFC',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Share2 size={13} color="#EF4444" />
                  PINDAH KE MENU {PLATFORM_INFO_MAP[mismatchNotice.detectedPlatform as SocialMediaType]?.name.toUpperCase()}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setTargetUrl('')
                  setMismatchNotice(null)
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '4px',
                  background: 'linear-gradient(180deg, #243242 0%, #131B24 100%)',
                  border: '1px solid #384A61',
                  borderBottom: '2px solid #0A0F15',
                  color: '#CBD5E1',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                BERSIHKAN URL
              </button>

              <button
                type="button"
                onClick={() => setMismatchNotice(null)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '4px',
                  background: '#101622',
                  border: '1px solid #1E293B',
                  color: '#94A3B8',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                PERBAIKI INPUT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
