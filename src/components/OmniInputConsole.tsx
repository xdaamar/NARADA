import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Sparkles,
  RotateCcw,
  Image as ImageIcon,
  Globe,
  Zap,
  ChevronDown,
  X,
  Scan,
  FileText,
  AlertTriangle
} from 'lucide-react'
import { createWorker } from 'tesseract.js'
import { Readability } from '@mozilla/readability'
import type { InputSourceType } from '../types'

export interface OmniInputConsoleProps {
  isAnalyzing: boolean
  onAnalyze: (payload: {
    text: string
    source: InputSourceType
    title?: string
    sourceMeta?: {
      author?: string | null
      siteName?: string
      url?: string
      imagePreview?: string
    }
  }) => void
  initialText?: string
}

// Kamus Frasa Sensitif untuk Live Pre-Flight Heuristics
const SENSITIVE_PREFLIGHT_TERMS = [
  'viralkan', 'darurat', 'rahasia', 'fiktif', 'boikot', 'separatis', 'penjajah',
  'trending', 'korupsi', 'serang', 'serbuan', 'adu domba', 'palsu', 'menutup-nutupi',
  'referendum', 'makar', 'habisi', 'bahaya', 'bocor', 'hancurkan', 'jebol', 'megathrust',
  'bansos tunai', 'bit.ly', 's.id', 'dicopot', 'dipecat sepihak'
]

// ─── 5 Preset Contoh Cepat Spektrum Ganda (1-Click Sample) ───
const SAMPLE_PRESETS = [
  {
    label: 'Politik: Wapres Gibran Dicopot',
    text: '[SALAH] WAPRES GIBRAN RESMI DICOPOT oleh keputusan sepihak Istana. Viralkan sebelum dihapus kominfo!',
  },
  {
    label: 'Bencana: Gempa Megathrust BMKG',
    text: 'Peringatan BMKG gempa megathrust susulan malam ini jam 23.00 magnitudo 8.9 keluar rumah sebarkan cepat!',
  },
  {
    label: 'Penipuan: Bansos 5 Juta Kemensos',
    text: 'Pendaftaran bansos tunai 5 juta kemensos per KK buka tautan bit.ly/bansos-kemensos kuota terbatas hari ini!',
  },
  {
    label: 'Militer: Alutsista Fiktif Kemhan',
    text: 'Beredar selebaran dokumen rahasia pembelian 20 unit Tank Tempur dan alutsista fiktif anggaran 24 triliun Kemhan RI!',
  },
  {
    label: 'Faktual: Prajurit Kodim & Warga',
    text: 'Prajurit Kodim bersama warga kerja bakti bersihkan sungai cegah banjir musim hujan di wilayah teritorial.',
  },
]

export default function OmniInputConsole({
  isAnalyzing,
  onAnalyze,
  initialText = ''
}: OmniInputConsoleProps) {
  const [inputText, setInputText] = useState<string>(initialText)
  const [sourceType, setSourceType] = useState<InputSourceType>('text')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageName, setImageName] = useState<string>('')
  const [extractedUrlMeta, setExtractedUrlMeta] = useState<{
    author?: string | null
    siteName?: string
    url?: string
    title?: string
  } | null>(null)

  // OCR state
  const [isOcrProcessing, setIsOcrProcessing] = useState<boolean>(false)
  const [ocrProgress, setOcrProgress] = useState<number>(0)
  const [ocrStatusText, setOcrStatusText] = useState<string>('')

  // URL state
  const [isUrlExtracting, setIsUrlExtracting] = useState<boolean>(false)

  // Drag & Drop state
  const [isDragOver, setIsDragOver] = useState<boolean>(false)

  // Sample Popover Toggle
  const [showSampleDropdown, setShowSampleDropdown] = useState<boolean>(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sinkronisasi jika initialText berubah dari luar
  useEffect(() => {
    if (initialText && initialText !== inputText) {
      setInputText(initialText)
      setSourceType('text')
    }
  }, [initialText])

  // Deteksi Otomatis URL
  const isUrlMode = useMemo(() => {
    const trimmed = inputText.trim()
    if (!trimmed) return false
    return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(trimmed) || (trimmed.startsWith('http://') || trimmed.startsWith('https://'))
  }, [inputText])

  // Update source type saat deteksi URL
  useEffect(() => {
    if (isUrlMode && sourceType !== 'url') {
      setSourceType('url')
    } else if (!isUrlMode && sourceType === 'url' && !imagePreview) {
      setSourceType('text')
    }
  }, [isUrlMode, sourceType, imagePreview])

  // Pre-flight Heuristics
  const heuristics = useMemo(() => {
    const text = inputText.trim()
    const charCount = text.length
    const words = text ? text.split(/\s+/).filter(Boolean) : []
    const wordCount = words.length
    const readingTimeSec = wordCount > 0 ? Math.ceil(wordCount / 3.5) : 0

    // Deteksi frasa sensitif
    const lower = text.toLowerCase()
    const detectedRiskyTerms = SENSITIVE_PREFLIGHT_TERMS.filter(term => lower.includes(term))

    return {
      charCount,
      wordCount,
      readingTimeSec,
      riskyTermsCount: detectedRiskyTerms.length,
      detectedRiskyTerms
    }
  }, [inputText])

  /**
   * Ekstraksi URL menggunakan Readability
   */
  const extractUrlContent = async (targetUrl: string): Promise<{ text: string; meta: any } | null> => {
    setIsUrlExtracting(true)
    try {
      let htmlText = ''
      // Coba direct fetch dengan timeout
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 4000)
        const res = await fetch(targetUrl, { signal: controller.signal })
        clearTimeout(timeoutId)
        if (res.ok) {
          htmlText = await res.text()
        }
      } catch {
        // Fallback ke CORS proxy publik
        try {
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`
          const resProxy = await fetch(proxyUrl)
          if (resProxy.ok) {
            htmlText = await resProxy.text()
          }
        } catch (e) {
          console.warn('[OmniInput] CORS proxy gagal:', e)
        }
      }

      if (htmlText) {
        const parser = new DOMParser()
        const doc = parser.parseFromString(htmlText, 'text/html')
        const hostName = new URL(targetUrl).hostname.replace(/^www\./, '')
        const reader = new Readability(doc)
        const article = reader.parse()

        // Ekstrak OpenGraph metadata untuk platform media sosial (Instagram, TikTok, X/Twitter)
        const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
                        doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content') || ''
        const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
                       doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
                       doc.querySelector('meta[name="twitter:description"]')?.getAttribute('content') || ''

        const title = (article?.title || ogTitle || doc.querySelector('title')?.textContent || 'Artikel Media Sosial / Berita').trim()
        const content = (article?.textContent && article.textContent.trim().length > 50)
          ? article.textContent.trim()
          : (ogDesc || doc.body?.textContent || '').trim()

        const meta = {
          title,
          siteName: article?.siteName || hostName,
          author: article?.byline || null,
          url: targetUrl
        }
        return { text: content || title, meta }
      }
    } catch (err) {
      console.error('[OmniInput] Ekstraksi URL gagal:', err)
    } finally {
      setIsUrlExtracting(false)
    }
    return null
  }

  /**
   * Pemrosesan File Gambar dengan Tesseract OCR
   */
  const handleImageProcess = async (file: File) => {
    const previewUrl = URL.createObjectURL(file)
    setImagePreview(previewUrl)
    setImageName(file.name)
    setSourceType('ocr')
    setIsOcrProcessing(true)
    setOcrProgress(15)
    setOcrStatusText('Inisialisasi Neural OCR (ind + eng)...')

    try {
      const worker = await createWorker('ind+eng', 1, {
        logger: (m: { status?: string; progress?: number }) => {
          if (m.status && m.progress) {
            const pct = Math.round(m.progress * 100)
            setOcrProgress(Math.min(95, Math.max(15, pct)))
            setOcrStatusText(`Mengenali teks citra (${pct}%)...`)
          }
        }
      })

      setOcrStatusText('Menganalisis karakter dokumen...')
      const ret = await worker.recognize(file)
      await worker.terminate()

      const recognizedText = (ret.data.text || '').trim()
      if (recognizedText) {
        setInputText(recognizedText)
      }
      setOcrProgress(100)
      setOcrStatusText('Selesai diekstrak!')
    } catch (err) {
      console.error('[OmniInput] OCR Error:', err)
      setOcrStatusText('Gagal mengenali citra.')
    } finally {
      setIsOcrProcessing(false)
    }
  }

  // Trigger file dialog
  const handleAttachImage = () => {
    fileInputRef.current?.click()
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files[0]) {
      handleImageProcess(files[0])
    }
  }

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = e.dataTransfer.files
    if (files && files[0] && files[0].type.startsWith('image/')) {
      handleImageProcess(files[0])
    }
  }

  // Reset console
  const handleReset = () => {
    setInputText('')
    setSourceType('text')
    setImagePreview(null)
    setImageName('')
    setExtractedUrlMeta(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    textareaRef.current?.focus()
  }

  // Eksekusi Analisis
  const handleTriggerAnalyze = async () => {
    const trimmed = inputText.trim()
    if (!trimmed || isAnalyzing || isOcrProcessing) return

    // Jika mode URL dan belum diekstrak artikelnya
    if (isUrlMode) {
      const extracted = await extractUrlContent(trimmed)
      if (extracted && extracted.text.length >= 10) {
        setExtractedUrlMeta(extracted.meta)
        onAnalyze({
          text: extracted.text,
          source: 'url',
          title: extracted.meta.title,
          sourceMeta: extracted.meta
        })
        return
      }
    }

    onAnalyze({
      text: trimmed,
      source: sourceType,
      title: extractedUrlMeta?.title || (sourceType === 'ocr' ? `Tangkapan Layar: ${imageName}` : undefined),
      sourceMeta: {
        author: extractedUrlMeta?.author || null,
        siteName: extractedUrlMeta?.siteName || (sourceType === 'ocr' ? 'Dokumen Tangkapan Layar' : undefined),
        url: extractedUrlMeta?.url || (isUrlMode ? trimmed : undefined),
        imagePreview: imagePreview || undefined
      }
    })
  }

  // Shortcut Ctrl + Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleTriggerAnalyze()
    }
  }

  return (
    <div 
      className="omni-input-card steel-chassis-card" 
      style={{ position: 'relative', overflow: 'hidden' }}
      onDragOver={handleDragOver} 
      onDragLeave={handleDragLeave} 
      onDrop={handleDrop}
    >
      {/* 4 Baut Hex Socket (Allen Bolts) Sudut */}
      <span className="bolt-tl" />
      <span className="bolt-tr" />
      <span className="bolt-bl" />
      <span className="bolt-br" />

      {/* ─── Mode Indicator Banner ─── */}
      <div style={{
        padding: '10px 22px',
        background: isDragOver ? 'rgba(239, 68, 68, 0.2)' : 'linear-gradient(180deg, #171F2B 0%, #111721 100%)',
        borderBottom: '1px solid #1E2734',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {isUrlMode ? (
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: '700',
              padding: '2px 8px',
              borderRadius: '4px',
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#60A5FA',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Globe size={11} /> MODE URL EKSTRAKTOR
            </span>
          ) : imagePreview ? (
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: '700',
              padding: '2px 8px',
              borderRadius: '4px',
              background: 'rgba(249, 115, 22, 0.15)',
              color: '#FB923C',
              border: '1px solid rgba(249, 115, 22, 0.4)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Scan size={11} /> MODE OCR CITRA ({imageName})
            </span>
          ) : (
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: '700',
              padding: '2px 8px',
              borderRadius: '4px',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#34D399',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <FileText size={11} /> SMART OMNI-INPUT CONSOLE
            </span>
          )}

          {isDragOver && (
            <span style={{ fontSize: '11px', color: 'var(--narada-red)', fontWeight: '700' }}>
              Lepaskan file gambar untuk mengekstrak OCR seketika!
            </span>
          )}
        </div>

        {/* Aksesori Kontrol Atas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Preset Samples Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowSampleDropdown(!showSampleDropdown)}
              style={{ fontSize: '11px', padding: '4px 8px' }}
            >
              <Sparkles size={12} color="#D97706" />
              <span>Contoh Isu</span>
              <ChevronDown size={11} />
            </button>

            {showSampleDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '4px',
                background: '#141B24',
                border: '1px solid #2D3848',
                borderRadius: '6px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.85)',
                padding: '6px',
                zIndex: 50,
                minWidth: '280px'
              }}>
                <div style={{
                  fontSize: '9px',
                  fontFamily: 'var(--font-mono)',
                  color: '#94A3B8',
                  padding: '4px 8px',
                  borderBottom: '1px solid #1E2734',
                  marginBottom: '4px',
                  fontWeight: 700
                }}>
                  PILIH PRESET SKENARIO:
                </div>
                {SAMPLE_PRESETS.map((sample, i) => (
                  <button
                    key={i}
                    type="button"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '7px 10px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '11px',
                      color: '#F1F5F9',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'block'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#1E2734'
                      e.currentTarget.style.color = '#FCA5A5'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = '#F1F5F9'
                    }}
                    onClick={() => {
                      setInputText(sample.text)
                      setSourceType('text')
                      setShowSampleDropdown(false)
                    }}
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tombol Bersihkan */}
          {inputText && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleReset}
              style={{ fontSize: '11px', padding: '4px 8px', color: 'var(--text-muted)' }}
              title="Bersihkan input"
            >
              <RotateCcw size={12} />
              <span>Bersihkan</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── OCR Progress Bar (Jika Sedang Memproses OCR) ─── */}
      {isOcrProcessing && (
        <div style={{
          padding: '8px 22px',
          background: 'rgba(249, 115, 22, 0.1)',
          borderBottom: '1px solid rgba(249, 115, 22, 0.2)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: '#FB923C',
            marginBottom: '4px'
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <Scan size={12} className="spin-animation" />
              {ocrStatusText}
            </span>
            <span>{ocrProgress}%</span>
          </div>
          <div style={{ height: '4px', background: 'var(--bg-elevated)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${ocrProgress}%`, height: '100%', background: '#FB923C', transition: 'width 0.3s ease' }} />
          </div>
        </div>
      )}

      {/* ─── Area Input Textarea Terpadu (Sunken Clean Well) ─── */}
      <div style={{ padding: '12px 18px', position: 'relative' }}>
        <div className="omni-input-well">
          <textarea
            ref={textareaRef}
            className="omni-textarea"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tempelkan apa saja: naskah berita, narasi viral WhatsApp, tautan URL berita (http/https), atau seret tangkapan layar screenshot ke sini..."
            disabled={isAnalyzing || isOcrProcessing}
          />

          {/* Thumbnail Preview jika ada citra OCR */}
          {imagePreview && (
            <div style={{
              padding: '8px 16px',
              background: '#0D1219',
              borderTop: '1px solid #1E2736',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <img
                src={imagePreview}
                alt="Preview"
                style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #2D3848' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {imageName || 'Screenshot Dokumen'}
                </div>
                <div style={{ fontSize: '10px', color: '#94A3B8' }}>
                  Teks telah diekstrak otomatis oleh Tesseract OCR Neural Network
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setImagePreview(null)
                  setImageName('')
                  if (sourceType === 'ocr') setSourceType('text')
                }}
                style={{ padding: '4px', color: '#94A3B8' }}
                title="Hapus gambar"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Bar Indikator Heuristik & Tombol Aksi Bawah ─── */}
      <div style={{
        padding: '10px 22px',
        background: 'linear-gradient(180deg, #131A24 0%, #0E131C 100%)',
        borderTop: '1px solid #1E2734',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Indikator Heuristik Live Text */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
          flexWrap: 'wrap'
        }}>
          <span>{heuristics.charCount} karakter</span>
          <span>·</span>
          <span>{heuristics.wordCount} kata</span>
          <span>·</span>
          <span>±{heuristics.readingTimeSec}s baca</span>

          {heuristics.riskyTermsCount > 0 && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 6px',
              borderRadius: '3px',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#EF4444',
              fontWeight: '700'
            }}>
              <AlertTriangle size={11} /> {heuristics.riskyTermsCount} Frasa Berisiko Terdeteksi
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            style={{ display: 'none' }}
            onChange={handleFileInputChange}
          />

          {/* Tombol Lampirkan Screenshot / OCR */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleAttachImage}
            disabled={isAnalyzing || isOcrProcessing}
            style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <ImageIcon size={13} />
            <span>Unggah Screenshot (OCR)</span>
          </button>

          {/* Tombol Utama Analisis Kognitif */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleTriggerAnalyze}
            disabled={!inputText.trim() || isAnalyzing || isOcrProcessing}
            style={{
              padding: '8px 18px',
              fontSize: '12px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {isAnalyzing || isUrlExtracting ? (
              <>
                <span className="spinner" style={{ width: '13px', height: '13px', borderWidth: '2px' }} />
                <span>Menganalisis Kognitif...</span>
              </>
            ) : (
              <>
                <Zap size={14} />
                <span>Analisis Kognitif</span>
                <span style={{
                  fontSize: '9px',
                  fontFamily: 'var(--font-mono)',
                  opacity: 0.7,
                  marginLeft: '2px',
                  padding: '1px 4px',
                  borderRadius: '2px',
                  background: 'rgba(255, 255, 255, 0.15)'
                }}>
                  Ctrl+Enter
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
