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
  ExternalLink
} from 'lucide-react'
import type { AnalysisResult } from '../types'
import { getThreatBadge, getCategoryBadge, formatMilitaryDate } from '../utils/format'

interface AnalysisResultCardProps {
  result: AnalysisResult
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

export default function AnalysisResultCard({ result }: AnalysisResultCardProps) {
  const threatBadge = getThreatBadge(result.threatLevel)
  const catBadge = getCategoryBadge(result.category)

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
          border: `1px solid ${threatBadge.borderColor}`
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
