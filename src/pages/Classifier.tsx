import { useState, useRef } from 'react'
import { ScanText, Upload, RotateCcw, AlertTriangle, CheckCircle, Info, ChevronRight } from 'lucide-react'
import { classifyText } from '../engine/classifier'
import type { AnalysisResult, ContentCategory, ThreatLevel } from '../types'

// ─── Helper: Store analysis in session ───
function storeAnalysis(result: AnalysisResult) {
  try {
    const existing = JSON.parse(sessionStorage.getItem('narada_analyses') || '[]')
    const updated = [result, ...existing].slice(0, 50)
    sessionStorage.setItem('narada_analyses', JSON.stringify(updated))
  } catch {}
}

// ─── Category Color Map ───
const CAT_COLORS: Record<ContentCategory, string> = {
  HOAKS: '#EF4444',
  PROPAGANDA: '#F97316',
  BUZZER: '#F59E0B',
  DISINFORMASI: '#8B5CF6',
  NETRAL: '#22C55E',
}

const THREAT_COLORS: Record<ThreatLevel, string> = {
  low: '#22C55E',
  medium: '#F59E0B',
  high: '#F97316',
  critical: '#EF4444',
}

// ─── Sample Texts for Demo ───
const SAMPLE_TEXTS = [
  {
    label: 'Contoh: Hoaks',
    text: 'BAHAYA!! BEREDAR kabar bahwa TNI AD berencana melakukan tindakan terhadap warga sipil. Segera SEBARKAN dan VIRALKAN ke semua grup! Jangan percaya pemerintah yang selama ini membohongi rakyat! Ini fakta tersembunyi yang mereka sembunyikan dari kita!'
  },
  {
    label: 'Contoh: Propaganda',
    text: 'Rezim ini sudah terlalu lama berkuasa dan membodohi rakyat! Bangkitlah saudara-saudara, saatnya kita lawan sistem korup ini! Mereka adalah pengkhianat bangsa yang berpihak pada asing dan imperialis. Rakyat harus bersatu dan menghancurkan kelompok elit busuk ini!'
  },
  {
    label: 'Contoh: Buzzer',
    text: 'RT ini sebanyak mungkin! Share ke semua teman kalian! Tag 5 orang! Kita harus kompak dan solid untuk viralkan kebenaran ini! Gerakan kita harus masif dan serempak hari ini! Trending harus kita buat sekarang! Bersama-sama kita bisa!'
  },
  {
    label: 'Contoh: Netral',
    text: 'TNI Angkatan Darat menggelar latihan rutin bersama satuan gabungan di wilayah Jawa Tengah. Kegiatan ini merupakan bagian dari program peningkatan kesiapan operasional satuan yang dijadwalkan setiap tahun.'
  }
]

// ─── Result Box ───
function AnalysisResultBox({ result }: { result: AnalysisResult }) {
  const catColor = CAT_COLORS[result.category]
  const threatColor = THREAT_COLORS[result.threatLevel]

  return (
    <div className="result-box fade-in" style={{ borderColor: `${catColor}30` }}>
      {/* Header */}
      <div className="result-header">
        <div>
          <div style={{ 
            fontSize: '10px', fontFamily: 'var(--font-mono)', 
            color: 'var(--text-muted)', letterSpacing: '1.5px',
            marginBottom: '4px'
          }}>
            VERDICT ANALISIS
          </div>
          <div className="result-verdict" style={{ color: catColor }}>
            {result.category}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className={`threat-badge ${result.threatLevel}`} style={{ marginBottom: '6px', display: 'inline-flex' }}>
            ▲ {result.threatLevel.toUpperCase()}
          </div>
          <div style={{ 
            fontSize: '28px', fontFamily: 'var(--font-display)', fontWeight: '700',
            color: threatColor 
          }}>
            {result.confidence}%
          </div>
          <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '1px' }}>
            CONFIDENCE
          </div>
        </div>
      </div>

      {/* Score Bars */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: '10px' }}>
          DISTRIBUSI PROBABILITAS
        </div>
        {result.scores.map(s => (
          <div key={s.label} className="confidence-row">
            <div className={`confidence-label category-badge cat-${s.label.toLowerCase()}`} style={{ width: 'auto', minWidth: '90px' }}>
              {s.label}
            </div>
            <div className="confidence-bar-wrap">
              <div 
                className="confidence-bar-fill"
                style={{ 
                  width: `${s.score}%`,
                  background: CAT_COLORS[s.label],
                  opacity: result.category === s.label ? 1 : 0.35
                }}
              />
            </div>
            <div className="confidence-pct">{s.score}%</div>
          </div>
        ))}
      </div>

      {/* Detected Keywords */}
      {result.keywords.length > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            KATA KUNCI TERDETEKSI
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {result.keywords.map(kw => (
              <span key={kw} style={{
                padding: '2px 10px',
                background: `${catColor}15`,
                border: `1px solid ${catColor}30`,
                borderRadius: '3px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: catColor
              }}>
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Explanation */}
      <div className="result-explanation" style={{ marginBottom: '14px' }}>
        <div style={{ 
          fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '1px', 
          color: 'var(--narada-red)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px'
        }}>
          <Info size={11} /> PENJELASAN AI
        </div>
        <div style={{ fontSize: '12px', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
          {result.explanation}
        </div>
      </div>

      {/* Recommendation */}
      <div style={{ 
        padding: '12px 14px',
        background: result.threatLevel === 'critical' ? 'rgba(239,68,68,0.08)' :
                    result.threatLevel === 'high' ? 'rgba(249,115,22,0.08)' :
                    'rgba(34,197,94,0.06)',
        borderRadius: '8px',
        border: `1px solid ${threatColor}25`
      }}>
        <div style={{ 
          fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '1px',
          color: threatColor, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px'
        }}>
          <ChevronRight size={11} /> REKOMENDASI TINDAKAN
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          {result.recommendation}
        </div>
      </div>

      {/* Metadata */}
      <div style={{ 
        marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--bg-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
          ID: {result.id}
        </span>
        <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
          {new Date(result.timestamp).toLocaleString('id-ID')}
        </span>
      </div>
    </div>
  )
}

// ─── Classifier Page ───
export default function Classifier() {
  const [inputText, setInputText] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [history, setHistory] = useState<AnalysisResult[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const handleAnalyze = () => {
    if (!inputText.trim()) return
    setIsAnalyzing(true)
    setResult(null)

    // Simulate processing delay for UX
    setTimeout(() => {
      const r = classifyText(inputText)
      setResult(r)
      setIsAnalyzing(false)
      storeAnalysis(r)
      setHistory(prev => [r, ...prev].slice(0, 10))
    }, 800)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setInputText(ev.target?.result as string)
    }
    reader.readAsText(file)
  }

  const handleSample = (text: string) => {
    setInputText(text)
    setResult(null)
  }

  const handleClear = () => {
    setInputText('')
    setResult(null)
  }

  const wordCount = inputText.trim() === '' ? 0 : inputText.trim().split(/\s+/).length

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>
          NARADA Classifier
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Analisis konten teks Bahasa Indonesia — deteksi ancaman kognitif secara real-time
        </p>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
        {/* Input Panel */}
        <div>
          {/* Sample Buttons */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              DATA SAMPEL DEMO
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {SAMPLE_TEXTS.map(s => (
                <button 
                  key={s.label}
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleSample(s.text)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text Input */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <ScanText size={12} style={{ display: 'inline', marginRight: '6px' }} />
                Input Konten
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  {wordCount} kata
                </span>
                <button className="btn btn-ghost btn-sm" onClick={handleClear}>
                  <RotateCcw size={12} />
                </button>
              </div>
            </div>
            <div className="card-body">
              <textarea
                className="form-control"
                placeholder="Paste teks postingan, berita, atau komentar di sini untuk dianalisis...&#10;&#10;Contoh:&#10;- Posting media sosial mencurigakan&#10;- Artikel berita yang perlu diverifikasi&#10;- Komentar yang terindikasi propaganda"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                rows={12}
                style={{ minHeight: '280px' }}
              />

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleAnalyze}
                  disabled={!inputText.trim() || isAnalyzing}
                  style={{ flex: 1 }}
                >
                  {isAnalyzing ? (
                    <>
                      <div className="loading-dots">
                        <span /><span /><span />
                      </div>
                      Menganalisis...
                    </>
                  ) : (
                    <>
                      <ScanText size={14} />
                      Analisis Konten
                    </>
                  )}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload size={14} />
                  Upload File
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.csv"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </div>
            </div>
          </div>

          {/* Analysis History */}
          {history.length > 0 && (
            <div className="card" style={{ marginTop: '16px' }}>
              <div className="card-header">
                <div className="card-title">Riwayat Analisis</div>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  {history.length} item
                </span>
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {history.map((h, i) => (
                  <div
                    key={h.id}
                    onClick={() => { setResult(h); setInputText(h.input) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 16px',
                      borderBottom: i < history.length - 1 ? '1px solid var(--bg-border)' : 'none',
                      cursor: 'pointer',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {h.category === 'NETRAL' 
                      ? <CheckCircle size={13} color="#22C55E" />
                      : <AlertTriangle size={13} color={CAT_COLORS[h.category]} />
                    }
                    <span className={`category-badge cat-${h.category.toLowerCase()}`}>{h.category}</span>
                    <span style={{ flex: 1, fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.input.substring(0, 50)}...
                    </span>
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                      {h.confidence}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Result Panel */}
        <div>
          {!result && !isAnalyzing && (
            <div className="card">
              <div className="empty-state" style={{ padding: '80px 20px' }}>
                <ScanText size={40} className="empty-icon" />
                <div className="empty-title">Siap Menganalisis</div>
                <div className="empty-desc">
                  Masukkan teks di panel kiri dan klik "Analisis Konten" untuk memulai deteksi ancaman kognitif
                </div>
              </div>
            </div>
          )}
          
          {isAnalyzing && (
            <div className="card">
              <div className="empty-state" style={{ padding: '80px 20px' }}>
                <div className="loading-dots" style={{ marginBottom: '16px' }}>
                  <span /><span /><span />
                </div>
                <div className="empty-title">Memproses</div>
                <div className="empty-desc">
                  NARADA AI Engine sedang menganalisis konten...
                </div>
              </div>
            </div>
          )}

          {result && !isAnalyzing && (
            <AnalysisResultBox result={result} />
          )}
        </div>
      </div>
    </div>
  )
}
