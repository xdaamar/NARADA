import { useState, useTransition } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MessageSquareQuote,
  Search,
  Zap,
  ShieldAlert,
  CheckCircle2,
  Copy,
  Check,
  TrendingUp,
  Share2,
  Heart,
  MessageCircle,
  Eye,
  Bot,
  Sparkles,
  ChevronRight,
  UserCheck,
  AlertOctagon,
  Flame
} from 'lucide-react'
import {
  detectSocialPlatform,
  analyzeSocialPost,
  SOCIAL_PRESET_SCENARIOS,
  type SocialPostForensicResult,
  type SocialPlatform
} from '../engine/social-forensic'

export default function SocialForensic() {
  const navigate = useNavigate()
  const [, startTransition] = useTransition()

  // State input
  const [urlInput, setUrlInput] = useState<string>(SOCIAL_PRESET_SCENARIOS[0].url)
  const [customCaption, setCustomCaption] = useState<string>('')
  const [customComments, setCustomComments] = useState<string>('')
  const [showCustomDrawer, setShowCustomDrawer] = useState<boolean>(false)

  // State hasil analisis (default ke preset 1 alutsista 24T agar langsung siap audit)
  const [result, setResult] = useState<SocialPostForensicResult>(SOCIAL_PRESET_SCENARIOS[0])
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [copiedDraft, setCopiedDraft] = useState<boolean>(false)

  // Deteksi platform aktif dari URL saat ini
  const detectedPlatform = detectSocialPlatform(urlInput)

  // Handler eksekusi analisis
  const handleExecuteForensic = async (targetUrl = urlInput) => {
    if (!targetUrl.trim() && !customCaption.trim()) return
    setIsAnalyzing(true)

    try {
      const data = await analyzeSocialPost(
        targetUrl,
        customCaption.trim() ? customCaption : undefined,
        customComments.trim() ? customComments : undefined
      )
      setResult(data)
    } catch (err) {
      console.error('[SocialForensic] Gagal menganalisis postingan:', err)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Handler memilih preset skenario
  const handleSelectPreset = (preset: SocialPostForensicResult) => {
    setUrlInput(preset.url)
    setCustomCaption('')
    setCustomComments('')
    setShowCustomDrawer(false)
    startTransition(() => {
      setResult(preset)
    })
  }

  // Handler salin draf klarifikasi
  const handleCopyDraft = () => {
    if (!result?.tacticalRecommendation?.officialClarificationDraft) return
    navigator.clipboard.writeText(result.tacticalRecommendation.officialClarificationDraft)
    setCopiedDraft(true)
    setTimeout(() => setCopiedDraft(false), 2200)
  }

  // Handler navigasi ke Analyzer
  const handleSendToAnalyzer = () => {
    if (!result) return
    navigate('/analyzer', {
      state: {
        prefill: result.post.caption,
        sourceUrl: result.url
      }
    })
  }

  // Platform styling badge
  const getPlatformBadge = (platform: SocialPlatform) => {
    switch (platform) {
      case 'INSTAGRAM':
        return { label: 'INSTAGRAM REELS', color: '#E1306C', bg: 'rgba(225, 48, 108, 0.15)' }
      case 'TIKTOK':
        return { label: 'TIKTOK VIDEO', color: '#00F2FE', bg: 'rgba(0, 242, 254, 0.15)' }
      case 'TWITTER':
        return { label: 'X (TWITTER)', color: '#1DA1F2', bg: 'rgba(29, 161, 242, 0.15)' }
      case 'FACEBOOK':
        return { label: 'FACEBOOK POST', color: '#1877F2', bg: 'rgba(24, 119, 242, 0.15)' }
      case 'THREADS':
        return { label: 'THREADS', color: '#FFFFFF', bg: 'rgba(255, 255, 255, 0.15)' }
      default:
        return { label: 'WEB SOCIAL LINK', color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.15)' }
    }
  }

  // Threat level badge
  const getThreatStyle = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return { color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)', border: '#DC2626' }
      case 'HIGH':
        return { color: '#F97316', bg: 'rgba(249, 115, 22, 0.15)', border: '#EA580C' }
      case 'MEDIUM':
        return { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', border: '#D97706' }
      default:
        return { color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', border: '#059669' }
    }
  }

  const platformBadge = getPlatformBadge(result.platform)
  const threatStyle = getThreatStyle(result.cognitiveVerdict.threatLevel)

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '60px' }}>
      
      {/* ─── 1. Header Komando Forensik Medsos ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              padding: '2px 8px',
              borderRadius: '3px',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#F87171',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              fontWeight: 700
            }}>
              MODUL 4: FORENSIK POSTINGAN MEDSOS & BUZZER
            </span>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              DISPENAD × PUSSIBERAD OSINT SUITE
            </span>
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '24px',
            fontWeight: 800,
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <MessageSquareQuote size={24} color="#EF4444" />
            Social Post Forensic & Buzzer Swarm Detector
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '820px', marginTop: '2px' }}>
            Kamar bedah forensik postingan media sosial spesifik. Mengidentifikasi keaslian konten, rasio polarisasi sentimen komentar, deteksi kampanye buzzer copypasta template (ambang batas &ge; 15%), dan perumusan draf netralisir taktis Dispenad.
          </p>
        </div>

        {/* Telemetri Live Engine */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 14px',
          background: '#121822',
          border: '1px solid #1E2734',
          borderRadius: 'var(--radius-pill)',
          boxShadow: 'var(--shadow-steel-plate)'
        }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#10B981',
            boxShadow: '0 0 8px #10B981',
            display: 'inline-block'
          }} />
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F1F5F9' }}>
            BUZZER SWARM DETECTOR READY
          </span>
          <span style={{ color: '#2D3848' }}>│</span>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#94A3B8' }}>
            JACCARD THRESHOLD: 65%
          </span>
        </div>
      </div>

      {/* ─── 2. Input Console Plat Baja (URL Postingan & Preset Kasus) ─── */}
      <div
        className="steel-chassis-card"
        style={{
          padding: '16px 20px',
          marginBottom: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          position: 'relative'
        }}
      >
        <span className="bolt-tl" />
        <span className="bolt-tr" />
        <span className="bolt-bl" />
        <span className="bolt-br" />

        {/* Baris Input URL Bersih */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{
            flex: 1,
            minWidth: '280px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center'
          }}>
            <div style={{
              position: 'absolute',
              left: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              paddingRight: '10px',
              borderRight: '1px solid #232D3B'
            }}>
              <span style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: getPlatformBadge(detectedPlatform).color,
                background: getPlatformBadge(detectedPlatform).bg,
                padding: '2px 6px',
                borderRadius: '3px'
              }}>
                {detectedPlatform}
              </span>
            </div>

            <input
              type="text"
              className="input-field"
              placeholder="Tempelkan URL postingan medsos (Instagram Reels, TikTok, X Thread, Facebook)..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleExecuteForensic()}
              style={{
                width: '100%',
                paddingLeft: '115px',
                paddingRight: '14px',
                paddingTop: '10px',
                paddingBottom: '10px',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                background: '#090C10',
                borderColor: '#263342',
                color: '#F8FAFC'
              }}
            />
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleExecuteForensic()}
            disabled={isAnalyzing}
            style={{
              padding: '10px 18px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#C8102E',
              borderColor: '#DC2626'
            }}
          >
            {isAnalyzing ? (
              <>
                <Sparkles size={14} className="animate-spin" />
                MEMBEDAH POSTINGAN...
              </>
            ) : (
              <>
                <Search size={14} />
                JALANKAN FORENSIK POSTINGAN
              </>
            )}
          </button>
        </div>

        {/* Preset Sampel Postingan Medsos Siap Uji */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          paddingTop: '6px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <span style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: '#64748B',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.8px'
          }}>
            PRESET SAMPEL SIAP AUDIT:
          </span>

          {SOCIAL_PRESET_SCENARIOS.map((preset) => {
            const isSelected = result?.id === preset.id
            const pBadge = getPlatformBadge(preset.platform)
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  background: isSelected ? 'rgba(239, 68, 68, 0.15)' : '#121822',
                  border: isSelected ? '1px solid #DC2626' : '1px solid #1C2532',
                  color: isSelected ? '#FCA5A5' : '#94A3B8'
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: pBadge.color }} />
                <span>{preset.platform === 'INSTAGRAM' ? 'IG Reels (Alutsista 24T)' : preset.platform === 'TIKTOK' ? 'TikTok (Megathrust 23.00)' : preset.platform === 'TWITTER' ? 'X (Pilkada Papua)' : 'Facebook (Bansos 5 Juta)'}</span>
              </button>
            )
          })}

          <button
            type="button"
            onClick={() => setShowCustomDrawer(!showCustomDrawer)}
            style={{
              marginLeft: 'auto',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: showCustomDrawer ? '#F59E0B' : '#64748B',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            {showCustomDrawer ? '[-] Tutup Opsi Lanjutan' : '[+] Tempel Takarir / Sampel Komentar Manual'}
          </button>
        </div>

        {/* Drawer Tambahan untuk Custom Caption / Komentar */}
        {showCustomDrawer && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '12px',
            padding: '12px',
            background: '#090C10',
            borderRadius: '6px',
            border: '1px solid #1C2430',
            marginTop: '4px'
          }}>
            <div>
              <label style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>
                KONTEN / TAKARIR POSTINGAN (OPSIONAL):
              </label>
              <textarea
                className="input-field"
                rows={3}
                placeholder="Tempelkan takarir lengkap jika URL tidak dapat diakses secara publik..."
                value={customCaption}
                onChange={(e) => setCustomCaption(e.target.value)}
                style={{ width: '100%', fontSize: '11px', fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>
                SAMPEL KOMENTAR UNTUK UJI JACCARD COPYPASTA (1 BARIS = 1 KOMENTAR):
              </label>
              <textarea
                className="input-field"
                rows={3}
                placeholder="Bongkar terus rezim panik!&#10;Bongkar terus rezim panik! Viralkan!&#10;Ini video lama tahun 2012 deh min..."
                value={customComments}
                onChange={(e) => setCustomComments(e.target.value)}
                style={{ width: '100%', fontSize: '11px', fontFamily: 'var(--font-mono)' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ─── 3. Grid 4 Deck Plat Baja Forensik ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* BARIS ATAS: DECK 1 (Ringkasan Postingan) & DECK 2 (Rasio Sentimen) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '20px'
        }}>
          
          {/* ─── DECK 1: RINGKASAN POSTINGAN & VONIS ISI ─── */}
          <div
            className="steel-chassis-card"
            style={{
              padding: '20px',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <span className="bolt-tl" />
            <span className="bolt-tr" />
            <span className="bolt-bl" />
            <span className="bolt-br" />

            {/* Header Deck 1 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1C2532', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: platformBadge.color,
                  background: platformBadge.bg,
                  padding: '2px 8px',
                  borderRadius: '3px'
                }}>
                  {platformBadge.label}
                </span>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                  DECK 1: RINGKASAN ARTIFAK
                </span>
              </div>

              <span style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: threatStyle.color,
                background: threatStyle.bg,
                border: `1px solid ${threatStyle.border}`,
                padding: '2px 8px',
                borderRadius: '3px',
                fontWeight: 700
              }}>
                DEFCON THREAT: {result.cognitiveVerdict.threatLevel}
              </span>
            </div>

            {/* Author Profile Card */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: result.author.avatarColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                fontWeight: 800,
                color: '#FFF',
                border: '2px solid rgba(255, 255, 255, 0.2)'
              }}>
                {result.author.avatarLetter}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#F1F5F9' }}>
                    {result.author.displayName}
                  </span>
                  {result.author.isVerified && <UserCheck size={14} color="#38BDF8" />}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#94A3B8' }}>
                    {result.author.handle}
                  </span>
                  <span style={{ color: '#2B3746' }}>•</span>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                    {result.author.followersCount.toLocaleString('id-ID')} Pengikut
                  </span>
                  <span style={{ color: '#2B3746' }}>•</span>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                    Akun: {result.author.accountAgeDays} hari
                  </span>
                </div>
              </div>
            </div>

            {/* Takarir Postingan (Caption Inset Tray) */}
            <div className="steel-sunken-tray" style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B', marginBottom: '4px' }}>
                TAKARIR / NARASI POSTINGAN:
              </div>
              <p style={{
                fontSize: '12px',
                color: '#E2E8F0',
                lineHeight: 1.5,
                fontFamily: 'var(--font-ui)',
                whiteSpace: 'pre-wrap'
              }}>
                {result.post.caption}
              </p>
            </div>

            {/* Metrik Engagement Counters */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px'
            }}>
              <div className="steel-sunken-tray" style={{ padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <Eye size={12} /> Dilihat
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#F8FAFC', marginTop: '2px' }}>
                  {result.post.viewsCount ? result.post.viewsCount.toLocaleString('id-ID') : 'N/A'}
                </div>
              </div>

              <div className="steel-sunken-tray" style={{ padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <Heart size={12} /> Disukai
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#F8FAFC', marginTop: '2px' }}>
                  {result.post.likesCount.toLocaleString('id-ID')}
                </div>
              </div>

              <div className="steel-sunken-tray" style={{ padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <MessageCircle size={12} /> Komentar
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#F8FAFC', marginTop: '2px' }}>
                  {result.post.commentsCount.toLocaleString('id-ID')}
                </div>
              </div>

              <div className="steel-sunken-tray" style={{ padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <Share2 size={12} /> Dibagikan
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#F8FAFC', marginTop: '2px' }}>
                  {result.post.sharesCount.toLocaleString('id-ID')}
                </div>
              </div>
            </div>

            {/* Box Vonis AI Cognitive */}
            <div style={{
              padding: '12px 14px',
              borderRadius: '6px',
              background: threatStyle.bg,
              border: `1px solid ${threatStyle.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldAlert size={16} color={threatStyle.color} />
                  <span style={{ fontSize: '12px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: threatStyle.color }}>
                    VONIS: {result.cognitiveVerdict.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: threatStyle.color }}>
                  KEYAKINAN {result.cognitiveVerdict.confidenceScore}%
                </span>
              </div>
              <p style={{ fontSize: '11px', color: '#E2E8F0', lineHeight: 1.4, margin: 0 }}>
                {result.cognitiveVerdict.summaryReason}
              </p>
            </div>
          </div>

          {/* ─── DECK 2: RASIO SENTIMEN KOMENTAR (Chunky Mechanical LED Meter) ─── */}
          <div
            className="steel-chassis-card"
            style={{
              padding: '20px',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <span className="bolt-tl" />
            <span className="bolt-tr" />
            <span className="bolt-bl" />
            <span className="bolt-br" />

            {/* Header Deck 2 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1C2532', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={16} color="#F59E0B" />
                <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#F1F5F9' }}>
                  DECK 2: RASIO SENTIMEN KOMENTAR
                </span>
              </div>

              <span style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: result.sentimentMatrix.dominantSentiment === 'PROVOKATIF' ? '#F87171' : '#34D399',
                background: result.sentimentMatrix.dominantSentiment === 'PROVOKATIF' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                padding: '2px 8px',
                borderRadius: '3px',
                fontWeight: 700
              }}>
                DOMINAN: {result.sentimentMatrix.dominantSentiment}
              </span>
            </div>

            {/* Chunky Mechanical Bar Visualization */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#94A3B8' }}>
                <span>POLARISASI OPINI PUBLIK</span>
                <span>TOTAL: 100% SPEKTRUM</span>
              </div>

              <div style={{
                height: '24px',
                display: 'flex',
                borderRadius: '4px',
                overflow: 'hidden',
                border: '1px solid #283548',
                boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.8)'
              }}>
                {/* Positif Bar */}
                <div
                  title={`Positif / Organik: ${result.sentimentMatrix.positivePercent}%`}
                  style={{
                    width: `${result.sentimentMatrix.positivePercent}%`,
                    background: 'linear-gradient(180deg, #10B981 0%, #059669 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFF',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    transition: 'width 0.4s ease'
                  }}
                >
                  {result.sentimentMatrix.positivePercent > 8 && `${result.sentimentMatrix.positivePercent}%`}
                </div>

                {/* Netral Bar */}
                <div
                  title={`Netral: ${result.sentimentMatrix.neutralPercent}%`}
                  style={{
                    width: `${result.sentimentMatrix.neutralPercent}%`,
                    background: 'linear-gradient(180deg, #64748B 0%, #475569 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFF',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    transition: 'width 0.4s ease'
                  }}
                >
                  {result.sentimentMatrix.neutralPercent > 8 && `${result.sentimentMatrix.neutralPercent}%`}
                </div>

                {/* Provokatif Bar */}
                <div
                  title={`Provokatif / Hujatan: ${result.sentimentMatrix.provocativePercent}%`}
                  style={{
                    width: `${result.sentimentMatrix.provocativePercent}%`,
                    background: 'linear-gradient(180deg, #EF4444 0%, #B91C1C 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFF',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    transition: 'width 0.4s ease'
                  }}
                >
                  {result.sentimentMatrix.provocativePercent > 8 && `${result.sentimentMatrix.provocativePercent}%`}
                </div>
              </div>
            </div>

            {/* 3 Detail Segment Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '4px' }}>
              
              {/* Positif */}
              <div className="steel-sunken-tray" style={{ padding: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#94A3B8' }}>POSITIF</span>
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#34D399' }}>
                  {result.sentimentMatrix.positivePercent}%
                </div>
                <div style={{ fontSize: '9px', color: '#64748B', marginTop: '2px' }}>
                  Dukungan organik / testimoni
                </div>
              </div>

              {/* Netral */}
              <div className="steel-sunken-tray" style={{ padding: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#64748B' }} />
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#94A3B8' }}>NETRAL</span>
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#CBD5E1' }}>
                  {result.sentimentMatrix.neutralPercent}%
                </div>
                <div style={{ fontSize: '9px', color: '#64748B', marginTop: '2px' }}>
                  Tanya jawab & klarifikasi
                </div>
              </div>

              {/* Provokatif */}
              <div className="steel-sunken-tray" style={{ padding: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444' }} />
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#94A3B8' }}>PROVOKATIF</span>
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#F87171' }}>
                  {result.sentimentMatrix.provocativePercent}%
                </div>
                <div style={{ fontSize: '9px', color: '#64748B', marginTop: '2px' }}>
                  Serangan & hasutan publik
                </div>
              </div>
            </div>

            {/* Catatan Analisis Sentimen */}
            <div style={{
              padding: '10px 12px',
              borderRadius: '4px',
              background: '#0B0F15',
              border: '1px solid #1C2430',
              fontSize: '11px',
              color: '#94A3B8',
              lineHeight: 1.4
            }}>
              <span style={{ color: '#F1F5F9', fontWeight: 600 }}>Diagnostik Polarisasi: </span>
              {result.sentimentMatrix.provocativePercent >= 50
                ? 'Terjadi dominasi narasi bermusuhan (hostile narrative) yang berpotensi mencederai kepercayaan publik terhadap institusi pertahanan dan pemerintah.'
                : 'Arus komentar masih didominasi diskusi rasional publik tanpa tanda pembelahan opini kritis.'}
            </div>
          </div>
        </div>

        {/* BARIS TENGAH: DECK 3 (Detektor Buzzer & Bukti Copypasta Template) */}
        <div
          className="steel-chassis-card"
          style={{
            padding: '22px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          <span className="bolt-tl" />
          <span className="bolt-tr" />
          <span className="bolt-bl" />
          <span className="bolt-br" />

          {/* Header Deck 3 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1C2532', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bot size={18} color="#EF4444" />
              <span style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#F1F5F9' }}>
                DECK 3: KARTU FORENSIK BUZZER & COPYPASTA TEMPLATE SWARM
              </span>
            </div>

            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: '#94A3B8'
            }}>
              AMBANG BATAS ALARM: &ge; 15% COPYPASTA
            </span>
          </div>

          {/* Alarm Banner Status Box */}
          <div style={{
            padding: '14px 18px',
            borderRadius: '6px',
            background: result.buzzerForensic.isBuzzerAlarmActive ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.10)',
            border: result.buzzerForensic.isBuzzerAlarmActive ? '2px solid #EF4444' : '1px solid #10B981',
            boxShadow: result.buzzerForensic.isBuzzerAlarmActive ? '0 0 16px rgba(239, 68, 68, 0.25)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {result.buzzerForensic.isBuzzerAlarmActive ? (
                <AlertOctagon size={28} color="#EF4444" style={{ animation: 'pulse-critical 1.5s infinite' }} />
              ) : (
                <CheckCircle2 size={28} color="#10B981" />
              )}
              <div>
                <div style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: result.buzzerForensic.isBuzzerAlarmActive ? '#FCA5A5' : '#6EE7B7'
                }}>
                  {result.buzzerForensic.isBuzzerAlarmActive
                    ? '🚨 ALARM BUZZER AKTIF: TERDETEKSI KAMPANYE KOMENTAR TEMPLATE (COORDINATED SWARM)'
                    : 'STATUS NORMAL: POLA INTERAKSI KONTEN TERPANTAU ORGANIK'}
                </div>
                <div style={{ fontSize: '11px', color: '#CBD5E1', marginTop: '2px' }}>
                  {result.buzzerForensic.swarmAnomalyDescription}
                </div>
              </div>
            </div>

            <div style={{
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              padding: '6px 12px',
              borderRadius: '4px',
              background: result.buzzerForensic.isBuzzerAlarmActive ? '#991B1B' : '#065F46',
              color: '#FFF'
            }}>
              KOORDINASI: {result.buzzerForensic.coordinationIndex} / 100
            </div>
          </div>

          {/* 4 Telemetri Cepat Forensik Buzzer */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px'
          }}>
            
            {/* Copypasta % */}
            <div className="steel-sunken-tray" style={{ padding: '12px' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#94A3B8' }}>
                PERSENTASE COPYPASTA
              </div>
              <div style={{
                fontSize: '22px',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: result.buzzerForensic.copypastaPercent >= 15 ? '#EF4444' : '#10B981',
                marginTop: '2px'
              }}>
                {result.buzzerForensic.copypastaPercent}%
              </div>
              <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
                {result.buzzerForensic.copypastaPercent >= 15 ? '⚠️ Melebihi batas aman 15%' : 'Dalam ambang normal'}
              </div>
            </div>

            {/* Burst Velocity */}
            <div className="steel-sunken-tray" style={{ padding: '12px' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#94A3B8' }}>
                BURST VELOCITY KOMENTAR
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#F59E0B', marginTop: '2px' }}>
                {result.buzzerForensic.burstVelocityPerMinute} <span style={{ fontSize: '12px' }}>komentar/menit</span>
              </div>
              <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
                Kecepatan semburan komentar
              </div>
            </div>

            {/* Rasio Akun Bot */}
            <div className="steel-sunken-tray" style={{ padding: '12px' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#94A3B8' }}>
                ESTIMASI RASIO AKUN BOT
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#EC4899', marginTop: '2px' }}>
                {result.buzzerForensic.botAccountRatioPercent}%
              </div>
              <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
                Profil anonim & tanpa avatar
              </div>
            </div>

            {/* Jumlah Klaster Template */}
            <div className="steel-sunken-tray" style={{ padding: '12px' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#94A3B8' }}>
                KLASTER TEMPLATE DITANGKAP
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#60A5FA', marginTop: '2px' }}>
                {result.buzzerForensic.detectedClusters.length} <span style={{ fontSize: '12px' }}>varian teks</span>
              </div>
              <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
                Kalimat seragam berulang
              </div>
            </div>
          </div>

          {/* Daftar Klaster Kalimat Template yang Ditangkap */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#E2E8F0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Flame size={14} color="#EF4444" />
              BUKTI KLASTER KALIMAT TEMPLATE BUZZER (JACCARD OVERLAP &ge; 65%):
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {result.buzzerForensic.detectedClusters.map((cluster, idx) => (
                <div
                  key={idx}
                  className="steel-sunken-tray"
                  style={{
                    padding: '12px 14px',
                    borderLeft: '3px solid #EF4444'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#F87171', fontWeight: 700 }}>
                      KLASTER TEMPLATE #{idx + 1}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      background: 'rgba(239, 68, 68, 0.2)',
                      color: '#FCA5A5',
                      padding: '1px 6px',
                      borderRadius: '3px'
                    }}>
                      {cluster.occurrences} KALI ({cluster.percentageOfTotal}% DARI TOTAL KOMENTAR)
                    </span>
                  </div>

                  <div style={{
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    color: '#FFF',
                    background: '#040608',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    border: '1px solid #1C2430',
                    lineHeight: 1.4
                  }}>
                    "{cluster.templateText}"
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                      CONTOH AKUN PENYEBAR:
                    </span>
                    {cluster.sampleHandles.map((handle, hIdx) => (
                      <span
                        key={hIdx}
                        style={{
                          fontSize: '9px',
                          fontFamily: 'var(--font-mono)',
                          color: '#94A3B8',
                          background: '#141B24',
                          padding: '1px 5px',
                          borderRadius: '2px'
                        }}
                      >
                        {handle}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sampel Komentar Terperiksa dengan Tag Suspect */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#94A3B8' }}>
              LOG SAMPEL KOMENTAR TERINSPEKSI SISTEM:
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
              {result.commentsSample.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '8px 10px',
                    background: '#090C10',
                    borderRadius: '4px',
                    border: '1px solid #161D26'
                  }}
                >
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: c.avatarColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#FFF',
                    flexShrink: 0
                  }}>
                    {c.avatarLetter}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#E2E8F0' }}>
                        {c.authorName}
                      </span>
                      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                        {c.authorHandle}
                      </span>
                      <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#475569' }}>
                        {c.timestamp}
                      </span>

                      {c.isSuspiciousBot && (
                        <span style={{
                          fontSize: '8px',
                          fontFamily: 'var(--font-mono)',
                          background: 'rgba(239, 68, 68, 0.25)',
                          color: '#F87171',
                          padding: '1px 4px',
                          borderRadius: '2px',
                          fontWeight: 700
                        }}>
                          🚨 SUSPECT BOT
                        </span>
                      )}

                      {c.isCopypastaTemplate && (
                        <span style={{
                          fontSize: '8px',
                          fontFamily: 'var(--font-mono)',
                          background: 'rgba(245, 158, 11, 0.25)',
                          color: '#FBBF24',
                          padding: '1px 4px',
                          borderRadius: '2px',
                          fontWeight: 700
                        }}>
                          📋 TEMPLATE
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: '11px', color: '#CBD5E1', margin: '3px 0 0 0', lineHeight: 1.35 }}>
                      {c.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* BARIS BAWAH: DECK 4 (Draf Rekomendasi Netralisir Taktis Dispenad) */}
        <div
          className="steel-chassis-card"
          style={{
            padding: '22px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          <span className="bolt-tl" />
          <span className="bolt-tr" />
          <span className="bolt-bl" />
          <span className="bolt-br" />

          {/* Header Deck 4 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1C2532', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} color="#10B981" />
              <span style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#F1F5F9' }}>
                DECK 4: REKOMENDASI PENANGGULANGAN TAKTIS (DISPENAD PROTOCOL)
              </span>
            </div>

            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: '#34D399',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              padding: '2px 8px',
              borderRadius: '3px',
              fontWeight: 700
            }}>
              POSTUR: {result.tacticalRecommendation.posture.replace(/_/g, ' ')}
            </span>
          </div>

          {/* Draf Naskah Kontra-Narasi Siap Salin */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#94A3B8', fontWeight: 600 }}>
                DRAF RESMI KLARIFIKASI / SANGGAHAN DISPENAD (SIAP DIPOSTING DI KOLOM KOMENTAR):
              </span>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCopyDraft}
                style={{
                  padding: '4px 10px',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: copiedDraft ? '#065F46' : '#141B24',
                  color: copiedDraft ? '#6EE7B7' : '#F1F5F9',
                  borderColor: copiedDraft ? '#10B981' : '#2D3949'
                }}
              >
                {copiedDraft ? (
                  <>
                    <Check size={12} color="#10B981" />
                    BERHASIL DISALIN!
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    SALIN NASKAH KLARIFIKASI
                  </>
                )}
              </button>
            </div>

            <div
              className="steel-sunken-tray"
              style={{
                padding: '14px',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: '#F1F5F9',
                lineHeight: 1.5,
                borderLeft: '4px solid #10B981'
              }}
            >
              {result.tacticalRecommendation.officialClarificationDraft}
            </div>
          </div>

          {/* Langkah Protokol Operasional & Kanal Target */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '14px'
          }}>
            <div className="steel-sunken-tray" style={{ padding: '12px' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#94A3B8', marginBottom: '4px' }}>
                LANGKAH PROTOKOL OPERASIONAL DISPENAD:
              </div>
              <p style={{ fontSize: '11px', color: '#CBD5E1', lineHeight: 1.45, margin: 0 }}>
                {result.tacticalRecommendation.recommendedDispenadProtocol}
              </p>
            </div>

            <div className="steel-sunken-tray" style={{ padding: '12px' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#94A3B8', marginBottom: '4px' }}>
                TARGET KANAL DISTRIBUSI NETRALISIR:
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                {result.tacticalRecommendation.targetChannels.map((channel, cIdx) => (
                  <span
                    key={cIdx}
                    style={{
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: '#60A5FA',
                      border: '1px solid rgba(59, 130, 246, 0.35)',
                      padding: '2px 8px',
                      borderRadius: '3px'
                    }}
                  >
                    {channel}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Tombol Aksi Taktis Menuju Analyzer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            paddingTop: '10px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              Butuh verifikasi naskah mendalam pada dokumen resmi atau tautan berita eksternal?
            </span>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSendToAnalyzer}
              style={{
                padding: '8px 16px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#C8102E',
                borderColor: '#DC2626'
              }}
            >
              <Zap size={14} />
              BAWA KE MULTI-INPUT ANALYZER
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
