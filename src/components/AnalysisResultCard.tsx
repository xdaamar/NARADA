import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldAlert,
  Brain,
  Scale,
  Target,
  ChevronRight,
  Info,
  Clock,
  Fingerprint,
  Globe,
  Scan,
  FileSpreadsheet,
  FileText,
  ExternalLink,
  Copy,
  Check,
  Flame,
  Zap,
  Users2,
  FileDown,
  UserSearch,
  Radio,
  CheckCircle2
} from 'lucide-react'
import type { AnalysisResult, ThreatSpectrumCluster } from '../types'
import { getThreatBadge, getCategoryBadge, formatMilitaryDate } from '../utils/format'
import { generateSHA256 } from '../utils/crypto'

interface AnalysisResultCardProps {
  result: AnalysisResult
}

// ─── Helper Badge Klaster Spektrum Ganda ───
function getClusterBadge(cluster?: ThreatSpectrumCluster) {
  switch (cluster) {
    case 'POLITIK_NEGARA':
      return { label: 'POLITIK & SUKSESI NEGARA', icon: '🏛️', color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.12)' }
    case 'BENCANA_DARURAT':
      return { label: 'KEBENCANAAN & DARURAT ALAM', icon: '🌊', color: '#06B6D4', bgColor: 'rgba(6, 182, 212, 0.12)' }
    case 'PENIPUAN_BANSOS':
      return { label: 'PENIPUAN SOSIAL & BANSOS', icon: '💸', color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.12)' }
    case 'KESEHATAN_PANGAN':
      return { label: 'KESEHATAN & PANGAN PUBLIK', icon: '💊', color: '#8B5CF6', bgColor: 'rgba(139, 92, 246, 0.12)' }
    case 'KEDAULATAN_MILITER':
      return { label: 'KEDAULATAN & PERTAHANAN', icon: '🛡️', color: '#DC2626', bgColor: 'rgba(220, 38, 38, 0.12)' }
    case 'UMUM_NETRAL':
    default:
      return { label: 'INFORMASI UMUM / FAKTUAL', icon: '📄', color: '#22C55E', bgColor: 'rgba(34, 197, 94, 0.12)' }
  }
}

// ─── Sub-Component: Highlight Keyword Pada Teks ───
function HighlightedContent({
  text,
  keywords,
  highlightColor,
}: {
  text: string
  keywords: string[]
  highlightColor: string
}) {
  if (!text) return null
  if (!keywords || keywords.length === 0) {
    return <span style={{ whiteSpace: 'pre-line' }}>{text}</span>
  }

  // Urutkan kata kunci dari terpanjang agar frasa majemuk terdeteksi dahulu
  const sortedKeywords = [...keywords].filter(Boolean).sort((a, b) => b.length - a.length)
  const escaped = sortedKeywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  if (!escaped) {
    return <span style={{ whiteSpace: 'pre-line' }}>{text}</span>
  }

  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)

  return (
    <span style={{ whiteSpace: 'pre-line' }}>
      {parts.map((part, i) => {
        const isMatch = sortedKeywords.some(k => k.toLowerCase() === part.toLowerCase())
        if (isMatch) {
          return (
            <mark
              key={i}
              style={{
                background: `${highlightColor}30`,
                color: '#FFFFFF',
                borderBottom: `2px solid ${highlightColor}`,
                padding: '1px 4px',
                borderRadius: '3px',
                fontWeight: '600',
              }}
            >
              {part}
            </mark>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}

// ─── Generator Draf Kontranarasi Spektrum Ganda (Warga, Babinsa, Kedinasan, Medsos) ───
interface CounterNarrativeVariants {
  civilianWa: string
  babinsaWa: string
  pressRelease: string
  socialMedia: string
}

function generateCounterNarrative(result: AnalysisResult): CounterNarrativeVariants {
  const rawText = result.input || result.rawContent || ''
  const contentSnippet = rawText.length > 90 ? rawText.slice(0, 90).trim() + '...' : rawText
  const entityStr = result.targetedEntities && result.targetedEntities.length > 0
    ? result.targetedEntities.join(', ')
    : 'Stabilitas & Ketenteraman Publik'

  // Varian 1: Pesan Klarifikasi Warga (Grup WhatsApp RT / RW / Keluarga)
  const civilianWa = result.debunkMatch?.tacticalResponseCivilian ||
    `Bapak/Ibu tetangga dan keluarga sekalian, mohon jangan ikut menyebarkan kabar tentang "${contentSnippet}". Setelah diverifikasi bersama otoritas resmi, informasi ini TIDAK BENAR / HOAKS. Faktanya: ${result.debunkMatch?.clarification || result.logicAnomaly?.explanation || result.explanation}. Mari kita tetap tenang dan saring informasi sebelum membagikan.`

  // Varian 2: Panduan Lapangan / WhatsApp Babinsa Koramil
  const babinsaWa = result.debunkMatch?.tacticalResponseMilitary ||
    `PANDUAN KOMUNIKASI LAPANGAN BABINSA KORAMIL
(Untuk disebarkan ke grup WhatsApp RT/RW, Tokoh Masyarakat, & Warga Binaan)

Bapak/Ibu warga binaan yang terhormat,
Menanggapi pesan berantai yang ramai mengenai "${contentSnippet}", kami dari Koramil/Babinsa mengimbau warga agar tetap tenang dan bijak.

Faktanya, kabar tersebut adalah HOAKS / KABAR BOHONG yang sengaja disebar oknum tidak bertanggung jawab.
Penjelasan Resmi:
${result.debunkMatch?.clarification || result.logicAnomaly?.explanation || result.explanation}

Langkah bijak dari Babinsa:
• Saring sebelum sharing — cek kebenarannya
• Jangan teruskan pesan yang bernada panik atau menjelekkan aparat/warga
• Bila ragu, hubungi Babinsa setempat atau posko kelurahan.

Salam hormat,
Babinsa Koramil Setempat`

  // Varian 3: Siaran Pers Resmi Kedinasan / Dispenad
  const pressRelease = `SIARAN PERS RESMI PENERANGAN DINAS MILITER / KEDINASAN
Nomor: SP-KOGNITIF/TNI-AD/2026/X/08

KLARIFIKASI RESMI TERKAIT BEREDARNYA NARASI MENYESATKAN MENGENAI ${entityStr.toUpperCase()}

Jakarta — Menanggapi informasi yang beredar di ruang digital terkait "${contentSnippet}", kami menegaskan bahwa narasi tersebut adalah ${result.category.toUpperCase()} / TIDAK BENAR dan memuat unsur manipulasi informasi.

Hasil investigasi intelijen siber kognitif NARADA PUSSIBERAD mengonfirmasi:
1. Tidak terdapat fakta legalitas maupun operasional terkait klaim tersebut.
2. Penelusuran otoritas resmi: ${result.debunkMatch?.clarification || result.logicAnomaly?.explanation || result.explanation}
3. Rujukan verifikasi: ${result.debunkMatch?.officialSource || 'Satgas Pussiberad & Cek Fakta Mafindo'}.

Masyarakat diimbau untuk tidak menyebarluaskan narasi spekulatif dan senantiasa merujuk pada saluran informasi resmi kementerian/lembaga terkait.

PENERANGAN SATUAN / DISPENAD
Mabesad, Jakarta Pusat`

  // Varian 4: Klarifikasi Kilat Media Sosial (X / IG / TikTok)
  const socialMedia = `[KLARIFIKASI RESMI] 📢

Waspada! Beredar narasi menyesatkan mengenai ${entityStr}: "${contentSnippet}".

Kami tegaskan narasi tersebut adalah ${result.category} / TIDAK BENAR!
Fakta: ${result.debunkMatch?.clarification ? result.debunkMatch.clarification.slice(0, 160) + '...' : 'Informasi tersebut telah dibantah resmi oleh instansi berwenang.'}

Saring sebelum sharing! Jaga ruang digital yang sehat dan damai. 🇮🇩
#TangkalDisinformasi #CekFakta #StopHoaks #KedaulatanInformasi #TNIAD #PUSSIBERAD`

  return { civilianWa, babinsaWa, pressRelease, socialMedia }
}

export default function AnalysisResultCard({ result }: AnalysisResultCardProps) {
  const navigate = useNavigate()
  const threatBadge = getThreatBadge(result.threatLevel)
  const catBadge = getCategoryBadge(result.category)
  const clusterBadge = getClusterBadge(result.spectrumCluster)

  // State untuk hash kriptografis SHA-256
  const [sha256Hash, setSha256Hash] = useState<string>(result.forensicHash || '')
  const [copiedHash, setCopiedHash] = useState<boolean>(false)

  // State untuk generator kontranarasi (4 varian)
  const [activeNarrativeTab, setActiveNarrativeTab] = useState<'civilian' | 'babinsa' | 'press' | 'social'>('civilian')
  const [copiedNarrative, setCopiedNarrative] = useState<boolean>(false)
  const [copiedType, setCopiedType] = useState<string | null>(null)

  // Hitung hash secara asynchronous jika belum tersedia
  useEffect(() => {
    let isMounted = true
    const computeHash = async () => {
      if (result.forensicHash) {
        setSha256Hash(result.forensicHash)
      } else {
        const text = result.input || result.rawContent || ''
        const h = await generateSHA256(text)
        if (isMounted) setSha256Hash(h)
      }
    }
    computeHash()
    return () => { isMounted = false }
  }, [result])

  const narratives = generateCounterNarrative(result)

  const handleCopyHash = () => {
    if (!sha256Hash) return
    navigator.clipboard.writeText(sha256Hash)
    setCopiedHash(true)
    setTimeout(() => setCopiedHash(false), 2000)
  }

  const handleCopyNarrative = () => {
    const textToCopy =
      activeNarrativeTab === 'civilian' ? narratives.civilianWa :
      activeNarrativeTab === 'babinsa' ? narratives.babinsaWa :
      activeNarrativeTab === 'press' ? narratives.pressRelease :
      narratives.socialMedia

    navigator.clipboard.writeText(textToCopy)
    setCopiedNarrative(true)
    setTimeout(() => setCopiedNarrative(false), 2000)
  }

  const handleCopyDirect = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
    setCopiedType(type)
    setTimeout(() => setCopiedType(null), 2000)
  }

  // Ekspor Berkas Bukti Forensik Resmi (JSON)
  const handleExportForensicJson = () => {
    const packageData = {
      forensicPackageId: `NARADA-EVID-${result.id}`,
      generatedAt: new Date(result.timestamp).toISOString(),
      verifiedBy: 'NARADA COGNITIVE THREAT DEFENSE SYSTEM - PUSSIBERAD TNI AD',
      analystClassification: 'RAHASIA / OPERASIONAL SIBER',
      rawEvidenceText: result.input || result.rawContent,
      sha256Checksum: sha256Hash || 'CALCULATING',
      threatAssessment: {
        winnerCategory: result.category,
        threatLevel: result.threatLevel,
        overallConfidencePercent: result.confidence,
        machineLearningScore: result.mlScore,
        ruleSeverityScore: result.ruleScore,
        categoryScoresDistribution: result.scores,
      },
      ruleEngineEvidence: {
        matchedKeywords: result.keywords,
        targetedDefenseEntities: result.targetedEntities,
        ruleExplanation: result.explanation,
      },
      cognitivePsychologyVectors: result.psychology || {
        rageBaitIndex: 0,
        artificialUrgency: 0,
        socialCleavage: 0,
        primaryEmotion: 'NEUTRAL',
      },
      factCheckingReport: result.factCheck ? {
        available: result.factCheck.available,
        query: result.factCheck.query,
        verifiedClaimsCount: result.factCheck.claims.length,
        claims: result.factCheck.claims,
      } : null,
      tacticalRecommendation: result.recommendation,
      counterNarrativeDrafts: narratives,
    }

    const blob = new Blob([JSON.stringify(packageData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `NARADA-EVIDENCE-${result.id}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Ekstraksi username untuk profiler jika ada
  const authorOrUsername = result.sourceMeta?.author ||
    (result.input.match(/@([a-zA-Z0-9_]{3,25})/)?.[1] ? `@${result.input.match(/@([a-zA-Z0-9_]{3,25})/)?.[1]}` : null)

  const handleInvestigateProfile = () => {
    if (authorOrUsername) {
      navigate(`/profiler?username=${encodeURIComponent(authorOrUsername)}`)
    } else {
      navigate('/profiler')
    }
  }

  const handleCreateReport = () => {
    navigate('/reports')
  }

  // Ikon sumber input
  const renderSourceIcon = () => {
    switch (result.inputSource) {
      case 'url':
        return <Globe size={12} color="var(--accent-blue)" />
      case 'ocr':
        return <Scan size={12} color="var(--threat-high)" />
      case 'file':
        return <FileSpreadsheet size={12} color="var(--threat-medium)" />
      case 'text':
      default:
        return <FileText size={12} color="var(--narada-red)" />
    }
  }

  return (
    <div
      className="card fade-in"
      style={{
        border: `1px solid ${catBadge.color}35`,
        background: 'var(--bg-card)',
        boxShadow: result.threatLevel === 'critical' ? '0 0 35px rgba(239, 68, 68, 0.15)' : 'var(--shadow-card)',
      }}
    >
      {/* ─── 1. Header Taktis Verdict & Threat ─── */}
      <div
        className="card-header"
        style={{
          borderBottom: '1px solid var(--bg-border)',
          padding: '18px 20px',
          background: 'var(--bg-surface)',
        }}
      >
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '6px'
          }}>
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '1.5px',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              textTransform: 'uppercase'
            }}>
              {renderSourceIcon()}
              SUMBER: {result.inputSource.toUpperCase()} {result.title ? `· ${result.title}` : ''}
            </span>
          </div>

          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '26px',
            fontWeight: '800',
            letterSpacing: '1.5px',
            color: catBadge.color,
            lineHeight: '1.1',
          }}>
            {result.category}
          </div>

          {/* Badge Klaster Spektrum Ganda & Validasi Cek Fakta */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              padding: '2px 8px',
              borderRadius: '4px',
              background: clusterBadge.bgColor,
              color: clusterBadge.color,
              border: `1px solid ${clusterBadge.color}40`,
              fontWeight: '700',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <span>{clusterBadge.icon}</span> KLASTER: {clusterBadge.label}
            </span>

            {result.debunkMatch && (
              <span style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#F87171',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                fontWeight: '700'
              }}>
                ✓ TERVERIFIKASI MAFINDO / CEK FAKTA
              </span>
            )}

            {result.logicAnomaly?.detected && (
              <span style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#FBBF24',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                fontWeight: '700'
              }}>
                ⚡ ANOMALI LOGIKA STRUKTURAL
              </span>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div
            className={`threat-badge ${result.threatLevel}`}
            style={{
              marginBottom: '6px',
              background: threatBadge.bgColor,
              color: threatBadge.color,
              border: `1px solid ${threatBadge.borderColor}`
            }}
          >
            <ShieldAlert size={12} />
            {threatBadge.label}
          </div>

          <div style={{
            fontSize: '28px',
            fontFamily: 'var(--font-display)',
            fontWeight: '800',
            color: threatBadge.color,
            lineHeight: '1'
          }}>
            {result.confidence}%
          </div>
          <div style={{
            fontSize: '9px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            letterSpacing: '1px'
          }}>
            CONFIDENCE
          </div>
        </div>
      </div>

      <div className="card-body">
        {/* ─── KOTAK PERBANDINGAN: KLAIM VS FAKTA SEBENARNYA (DEBUNK COMPARISON SHEET) ─── */}
        {(result.debunkMatch || result.logicAnomaly?.detected || result.category === 'HOAKS' || result.category === 'DISINFORMASI') && (
          <div style={{
            background: 'linear-gradient(180deg, rgba(239, 68, 68, 0.08), rgba(15, 23, 42, 0.4))',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            marginBottom: '18px',
          }}>
            <div style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: '700',
              letterSpacing: '1px',
              color: '#EF4444',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '12px',
              textTransform: 'uppercase'
            }}>
              <CheckCircle2 size={14} color="#EF4444" /> LEMBAR PENELUSURAN FAKTA (DEBUNK COMPARISON SHEET)
            </div>

            {/* Baris Klaim */}
            <div style={{ marginBottom: '12px', padding: '10px 12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#FCA5A5', fontWeight: '700', marginBottom: '4px' }}>
                📌 KLAIM YANG BEREDAR (VIRAL / OCR):
              </div>
              <div style={{ fontSize: '13px', color: '#FEE2E2', fontStyle: 'italic', lineHeight: '1.5' }}>
                "{result.debunkMatch?.claim || result.input}"
              </div>
            </div>

            {/* Baris Fakta Sebenarnya */}
            <div style={{ marginBottom: '12px', padding: '12px 14px', background: 'rgba(34, 197, 94, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(34, 197, 94, 0.25)' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#4ADE80', fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                ✅ FAKTA SEBENARNYA (PENELUSURAN RESMI):
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: '1.6' }}>
                {result.debunkMatch?.clarification || result.logicAnomaly?.explanation || result.explanation}
              </div>
            </div>

            {/* Baris Sumber Rujukan */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '11px', paddingTop: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>
                Rujukan Otoritas: <strong style={{ color: 'var(--text-primary)' }}>{result.debunkMatch?.officialSource || 'TurnBackHoax.ID / Satgas Pussiberad'}</strong>
              </span>
              {result.debunkMatch?.sourceUrl && (
                <a
                  href={result.debunkMatch.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#60A5FA',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    textDecoration: 'none'
                  }}
                >
                  <ExternalLink size={12} />
                  Buka Artikel Sumber Rujukan ↗
                </a>
              )}
            </div>
          </div>
        )}
        {/* Pratinjau Metadata URL / OCR jika tersedia */}
        {result.sourceMeta && (
          <div style={{
            background: 'var(--bg-elevated)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--bg-border)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {result.sourceMeta.siteName && (
                <span style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: 'var(--accent-blue)'
                }}>
                  {result.sourceMeta.siteName}
                </span>
              )}
              {result.sourceMeta.author && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  · Penulis: {result.sourceMeta.author}
                </span>
              )}
            </div>

            {result.sourceMeta.url && (
              <a
                href={result.sourceMeta.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--narada-red)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  textDecoration: 'none'
                }}
              >
                Tautan Asli <ExternalLink size={11} />
              </a>
            )}
          </div>
        )}

        {/* Thumbnail Pratinjau Gambar jika sumber OCR */}
        {result.sourceMeta?.imagePreview && (
          <div style={{
            marginBottom: '16px',
            padding: '8px',
            background: 'var(--bg-base)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--bg-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <img
              src={result.sourceMeta.imagePreview}
              alt="Screenshot Medsos"
              style={{
                width: '64px',
                height: '64px',
                objectFit: 'cover',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--bg-border-bright)'
              }}
            />
            <div>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                Tangkapan Layar Sumber OCR
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '500' }}>
                {result.title || 'Screenshot Media Sosial'}
              </div>
            </div>
          </div>
        )}

        {/* ─── 2. Meteran Visual Perbandingan Bobot: ML (60%) vs Rules (40%) ─── */}
        <div style={{
          background: 'var(--bg-elevated)',
          padding: '14px 16px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--bg-border)',
          marginBottom: '18px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px'
          }}>
            <div style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '1.5px',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Scale size={12} /> SKOR HYBRID COGNITIVE FUSION
            </div>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
              Bobot: ML 60% · Aturan 40%
            </span>
          </div>

          <div className="grid-2" style={{ gap: '14px' }}>
            {/* ML Probability Meter */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--accent-blue)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Brain size={12} /> ML Classifier (TF-IDF + NB)
                </span>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--accent-blue)' }}>
                  {result.mlScore}%
                </span>
              </div>
              <div style={{ height: '6px', background: 'var(--bg-base)', borderRadius: '3px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${result.mlScore}%`,
                    height: '100%',
                    background: 'var(--accent-blue)',
                    transition: 'width 0.4s ease'
                  }}
                />
              </div>
            </div>

            {/* Rule Engine Severity Meter */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--narada-red)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Target size={12} /> Rule Severity Militer
                </span>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--narada-red)' }}>
                  {result.ruleScore}%
                </span>
              </div>
              <div style={{ height: '6px', background: 'var(--bg-base)', borderRadius: '3px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${result.ruleScore}%`,
                    height: '100%',
                    background: 'var(--narada-red)',
                    transition: 'width 0.4s ease'
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ─── 3. Teks Konten dengan Keyword Highlighting ─── */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '1.5px',
            color: 'var(--text-muted)',
            marginBottom: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>TEKS KONTEN & PENYOROTAN KATA KUNCI (KEYWORD HIGHLIGHT)</span>
            <span style={{ color: 'var(--text-dim)' }}>
              {result.keywords.length} kata kunci cocok
            </span>
          </div>

          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--bg-border)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            fontSize: '12px',
            lineHeight: '1.8',
            color: 'var(--text-secondary)',
            maxHeight: '180px',
            overflowY: 'auto'
          }}>
            <HighlightedContent
              text={result.input || result.rawContent}
              keywords={result.keywords}
              highlightColor={catBadge.color}
            />
          </div>
        </div>

        {/* ─── 4. Tag Entitas Pertahanan yang Ditargetkan ─── */}
        {result.targetedEntities && result.targetedEntities.length > 0 && (
          <div style={{ marginBottom: '18px' }}>
            <div style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '1.5px',
              color: 'var(--text-muted)',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <Target size={11} color="var(--threat-high)" />
              ENTITAS PERTAHANAN & KEAMANAN YANG DITARGETKAN:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {result.targetedEntities.map((entity) => (
                <span
                  key={entity}
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    padding: '3px 10px',
                    borderRadius: '4px',
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: '#F87171',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#EF4444' }} />
                  {entity}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ─── 4B. TASK H.1: TIGA VEKTOR PSIKOLOGIS KOGNITIF ─── */}
        {result.psychology && (
          <div style={{
            marginBottom: '18px',
            padding: '14px 16px',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--bg-border)'
          }}>
            <div style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '1.5px',
              color: 'var(--text-muted)',
              marginBottom: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '6px'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Brain size={13} color="var(--accent-blue)" />
                3 VEKTOR MANIPULASI PSIKOLOGIS KOGNITIF
              </span>
              <span style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '3px',
                background: result.psychology.primaryEmotion === 'ANGER' ? 'rgba(239, 68, 68, 0.2)' :
                            result.psychology.primaryEmotion === 'URGENCY' ? 'rgba(245, 158, 11, 0.2)' :
                            result.psychology.primaryEmotion === 'FEAR' ? 'rgba(139, 92, 246, 0.2)' :
                            'rgba(34, 197, 94, 0.15)',
                color: result.psychology.primaryEmotion === 'ANGER' ? '#EF4444' :
                       result.psychology.primaryEmotion === 'URGENCY' ? '#F59E0B' :
                       result.psychology.primaryEmotion === 'FEAR' ? '#A78BFA' :
                       '#22C55E',
                fontWeight: '700',
                fontFamily: 'var(--font-mono)'
              }}>
                EMOSI TARGET: {result.psychology.primaryEmotion}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              {/* 1. Rage Bait Index */}
              <div style={{ background: 'var(--bg-card)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--bg-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Flame size={12} color="#EF4444" /> Rage-Bait Index
                  </span>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: '700', color: result.psychology.rageBaitIndex > 50 ? '#EF4444' : '#F59E0B' }}>
                    {result.psychology.rageBaitIndex}%
                  </span>
                </div>
                <div className="progress-bar" style={{ height: '5px' }}>
                  <div className="progress-fill" style={{ width: `${result.psychology.rageBaitIndex}%`, background: 'linear-gradient(90deg, #F59E0B, #EF4444)' }} />
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-dim)', marginTop: '4px' }}>
                  {result.psychology.rageBaitIndex > 60 ? 'Agitasi kemarahan ekstrem' : result.psychology.rageBaitIndex > 25 ? 'Indikasi provokasi emosi' : 'Agitasi minim'}
                </div>
              </div>

              {/* 2. Artificial Urgency */}
              <div style={{ background: 'var(--bg-card)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--bg-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Zap size={12} color="#F59E0B" /> Urgensi Palsu
                  </span>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: '700', color: result.psychology.artificialUrgency > 50 ? '#F59E0B' : '#EAB308' }}>
                    {result.psychology.artificialUrgency}%
                  </span>
                </div>
                <div className="progress-bar" style={{ height: '5px' }}>
                  <div className="progress-fill" style={{ width: `${result.psychology.artificialUrgency}%`, background: 'linear-gradient(90deg, #EAB308, #F97316)' }} />
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-dim)', marginTop: '4px' }}>
                  {result.psychology.artificialUrgency > 60 ? 'Manipulasi kepanikan/viralitas' : result.psychology.artificialUrgency > 25 ? 'Desakan sebar cepat' : 'Urgensi wajar'}
                </div>
              </div>

              {/* 3. Social Cleavage */}
              <div style={{ background: 'var(--bg-card)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--bg-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Users2 size={12} color="#A78BFA" /> Polarisasi Sosial
                  </span>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: '700', color: result.psychology.socialCleavage > 50 ? '#EF4444' : '#A78BFA' }}>
                    {result.psychology.socialCleavage}%
                  </span>
                </div>
                <div className="progress-bar" style={{ height: '5px' }}>
                  <div className="progress-fill" style={{ width: `${result.psychology.socialCleavage}%`, background: 'linear-gradient(90deg, #8B5CF6, #EF4444)' }} />
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-dim)', marginTop: '4px' }}>
                  {result.psychology.socialCleavage > 60 ? 'Pembelahan horizontal/vertikal' : result.psychology.socialCleavage > 25 ? 'Gesekan sentimen identitas' : 'Polarisasi rendah'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── 5. Distribusi Probabilitas 5 Kategori ─── */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '1.5px',
            color: 'var(--text-muted)',
            marginBottom: '10px'
          }}>
            DISTRIBUSI SKOR PROBABILITAS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {result.scores.map((s) => {
              const b = getCategoryBadge(s.label)
              const isWinner = s.label === result.category
              return (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '105px',
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '3px',
                      background: b.bgColor,
                      color: b.color,
                      border: `1px solid ${b.color}30`,
                      textAlign: 'center'
                    }}
                  >
                    {s.label}
                  </div>
                  <div style={{ flex: 1, height: '7px', background: 'var(--bg-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${s.score}%`,
                        height: '100%',
                        background: b.color,
                        opacity: isWinner ? 1 : 0.35,
                        transition: 'width 0.4s ease'
                      }}
                    />
                  </div>
                  <div style={{
                    width: '40px',
                    textAlign: 'right',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    color: isWinner ? b.color : 'var(--text-muted)',
                    fontWeight: isWinner ? '700' : '400'
                  }}>
                    {s.score}%
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ─── 6. Penjelasan Aturan AI ─── */}
        <div style={{
          padding: '12px 14px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--bg-border)',
          marginBottom: '14px'
        }}>
          <div style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '1px',
            color: 'var(--narada-red)',
            marginBottom: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <Info size={11} /> PENJELASAN ATURAN & INDIKATOR KOGNITIF
          </div>
          <div style={{ fontSize: '12px', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
            {result.explanation}
          </div>
        </div>

        {/* ─── 7. Rekomendasi Taktis Militer ─── */}
        <div style={{
          padding: '14px 16px',
          background: result.threatLevel === 'critical' ? 'rgba(239,68,68,0.1)' :
                      result.threatLevel === 'high' ? 'rgba(249,115,22,0.1)' :
                      'rgba(34,197,94,0.08)',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${threatBadge.borderColor}`,
          marginBottom: '18px'
        }}>
          <div style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '1px',
            color: threatBadge.color,
            marginBottom: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontWeight: '700'
          }}>
            <ChevronRight size={12} /> REKOMENDASI TINDAKAN TAKTIS MILITER (DISPENAD / ASINTEL)
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: '1.7' }}>
            {result.recommendation}
          </div>
        </div>

        {/* ─── 7B. TASK H.2: GENERATOR DRAF KONTRANARASI TAKTIS DISPENAD ─── */}
        {result.category !== 'NETRAL' && (
          <div style={{
            marginBottom: '18px',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(200, 16, 46, 0.3)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '12px 16px',
              background: 'linear-gradient(90deg, rgba(200, 16, 46, 0.15), rgba(200, 16, 46, 0.05))',
              borderBottom: '1px solid var(--bg-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{
                fontSize: '11px',
                fontFamily: 'var(--font-display)',
                fontWeight: '700',
                letterSpacing: '1.5px',
                color: 'var(--narada-red)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                textTransform: 'uppercase'
              }}>
                <Radio size={14} /> DRAF KONTRANARASI TAKTIS & KLARIFIKASI PUBLIK (4 VARIAN)
              </div>

              {/* Tab Selector Varian */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${activeNarrativeTab === 'civilian' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setActiveNarrativeTab('civilian')}
                  style={{ fontSize: '10px', padding: '3px 8px' }}
                >
                  💬 Klarifikasi Warga (WA RT)
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${activeNarrativeTab === 'babinsa' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setActiveNarrativeTab('babinsa')}
                  style={{ fontSize: '10px', padding: '3px 8px' }}
                >
                  🛡️ Jukrah Babinsa Lapangan
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${activeNarrativeTab === 'press' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setActiveNarrativeTab('press')}
                  style={{ fontSize: '10px', padding: '3px 8px' }}
                >
                  📢 Siaran Pers Kedinasan
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${activeNarrativeTab === 'social' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setActiveNarrativeTab('social')}
                  style={{ fontSize: '10px', padding: '3px 8px' }}
                >
                  📱 Kilat Medsos (X/IG)
                </button>
              </div>
            </div>

            <div style={{ padding: '14px 16px' }}>
              <pre style={{
                background: 'var(--bg-base)',
                padding: '14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--bg-border)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                lineHeight: '1.6',
                color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap',
                maxHeight: '220px',
                overflowY: 'auto',
                marginBottom: '14px'
              }}>
                {activeNarrativeTab === 'civilian' && narratives.civilianWa}
                {activeNarrativeTab === 'babinsa' && narratives.babinsaWa}
                {activeNarrativeTab === 'press' && narratives.pressRelease}
                {activeNarrativeTab === 'social' && narratives.socialMedia}
              </pre>

              {/* Tombol Aksi Taktis Cepat */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{
                      background: 'rgba(34, 197, 94, 0.15)',
                      color: '#22c55e',
                      border: '1px solid rgba(34, 197, 94, 0.35)',
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                    onClick={() => handleCopyDirect(narratives.civilianWa, 'civilian')}
                  >
                    {copiedType === 'civilian' ? (
                      <>
                        <Check size={12} color="#22c55e" />
                        ✓ Klarifikasi Warga Disalin!
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        💬 Salin Klarifikasi Warga (Grup WA RT)
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: '#60a5fa',
                      border: '1px solid rgba(59, 130, 246, 0.35)',
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                    onClick={() => handleCopyDirect(narratives.babinsaWa, 'babinsa')}
                  >
                    {copiedType === 'babinsa' ? (
                      <>
                        <Check size={12} color="#60a5fa" />
                        ✓ Jukrah Babinsa Disalin!
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        🛡️ Salin Jukrah Babinsa Lapangan
                      </>
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleCopyNarrative}
                >
                  {copiedNarrative ? (
                    <>
                      <Check size={13} color="#22C55E" />
                      ✓ Varian Aktif Disalin
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      Salin Teks Tab Aktif
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── 7C. TASK H.3: PAKET BUKTI FORENSIK KRIPTOGRAFIS SHA-256 ─── */}
        <div style={{
          marginBottom: '18px',
          padding: '12px 16px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--bg-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <div style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '1px',
              color: 'var(--text-muted)',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <Fingerprint size={12} color="var(--threat-low)" />
              RANTAI INTEGRITAS BUKTI (SHA-256 CHAIN OF CUSTODY):
            </div>
            <div style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)',
              wordBreak: 'break-all'
            }}>
              {sha256Hash || 'Menghitung checksum kriptografis...'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCopyHash}
              title="Salin Hash SHA-256"
            >
              {copiedHash ? <Check size={12} color="#22C55E" /> : <Copy size={12} />}
              {copiedHash ? 'Tersalin' : 'Salin Hash'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleExportForensicJson}
            >
              <FileDown size={12} color="var(--accent-blue)" />
              📦 Ekspor Berkas Forensik (.JSON)
            </button>
          </div>
        </div>

        {/* ─── 7D. TASK H.6: CROSS-TOOL QUICK ACTIONS ─── */}
        <div style={{
          padding: '10px 14px',
          background: 'var(--bg-base)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--bg-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '16px'
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            PIPELINE LINTAS-ALAT INTELIJEN:
          </span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleInvestigateProfile}
              style={{ fontSize: '11px' }}
            >
              <UserSearch size={12} />
              👤 Selidiki Akun di Profiler {authorOrUsername ? `(${authorOrUsername})` : ''}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleCreateReport}
              style={{ fontSize: '11px' }}
            >
              <FileText size={12} />
              📄 Buat Laporan Intelijen A4
            </button>
          </div>
        </div>

        {/* ─── 8. Metadata Footer (ID & Waktu Militer) ─── */}
        <div style={{
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid var(--bg-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <span style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-dim)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Fingerprint size={11} /> ID: {result.id}
          </span>
          <span style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-dim)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Clock size={11} /> {formatMilitaryDate(result.timestamp)}
          </span>
        </div>
      </div>
    </div>
  )
}
