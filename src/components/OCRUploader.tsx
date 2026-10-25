import { useState, useRef, useEffect } from 'react'
import {
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Scan,
  Sparkles,
  Eye,
  Edit3,
  Contrast,
  Sliders
} from 'lucide-react'
import { createWorker } from 'tesseract.js'
import type { OCRAnalysisInput } from '../types'
import { preprocessImageWithOtsu, type OtsuBinarizerResult } from '../engine/vision/otsu-binarizer'
import { saveImageToDB } from '../utils/db-adapter'

interface OCRUploaderProps {
  onAnalyze: (payload: {
    text: string
    source: 'ocr'
    title?: string
    imagePreview?: string
    ocrConfidence?: number
    imageName?: string
  }) => void
  isAnalyzing?: boolean
}

interface OCRProgressState {
  statusText: string
  progress: number // 0 - 100
  stage: 'idle' | 'loading_model' | 'recognizing' | 'completed' | 'error'
}

const SUPPORTED_FORMATS = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

export default function OCRUploader({ onAnalyze, isAnalyzing = false }: OCRUploaderProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [binarizedPreview, setBinarizedPreview] = useState<string | null>(null)
  const [activePreviewMode, setActivePreviewMode] = useState<'original' | 'otsu'>('otsu')
  const [otsuResult, setOtsuResult] = useState<OtsuBinarizerResult | null>(null)
  const [useOtsuForOCR, setUseOtsuForOCR] = useState<boolean>(true)
  const [imageName, setImageName] = useState<string>('')
  const [extractedData, setExtractedData] = useState<OCRAnalysisInput | null>(null)
  const [editedText, setEditedText] = useState<string>('')
  const [isOcrProcessing, setIsOcrProcessing] = useState<boolean>(false)
  const [progressState, setProgressState] = useState<OCRProgressState>({
    statusText: '',
    progress: 0,
    stage: 'idle',
  })
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState<boolean>(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Bersihkan data URL jika unmount
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview)
      }
      if (binarizedPreview && binarizedPreview.startsWith('blob:')) {
        URL.revokeObjectURL(binarizedPreview)
      }
    }
  }, [imagePreview, binarizedPreview])

  /**
   * Menjalankan Tesseract OCR worker dengan bahasa Indonesia + Inggris didahului Pra-pemrosesan Otsu
   */
  const processImageWithOCR = async (imageSrc: string, name: string) => {
    setIsOcrProcessing(true)
    setErrorMessage(null)

    // ─── TAHAP 1: PRA-PEMROSESAN CITRA OTSU ADAPTIVE BINARIZER ───
    let targetOcrSource = imageSrc
    try {
      setProgressState({
        statusText: 'Menerapkan Filter Binarisasi Adaptif Otsu & Inversi Latar...',
        progress: 15,
        stage: 'loading_model',
      })

      const binarized = await preprocessImageWithOtsu(imageSrc)
      setOtsuResult(binarized)
      setBinarizedPreview(binarized.binarizedDataUrl)

      if (useOtsuForOCR) {
        targetOcrSource = binarized.binarizedDataUrl
      }

      // Persistensi ke IndexedDB tanpa membebani thread
      saveImageToDB(`OCR-${Date.now()}`, imageSrc, binarized.binarizedDataUrl).catch((err) => {
        console.warn('[OCRUploader] Gagal menyimpan citra ke IndexedDB:', err)
      })
    } catch (otsuErr) {
      console.warn('[OCRUploader] Pra-pemrosesan Otsu dilewati (menggunakan citra asli):', otsuErr)
    }

    setProgressState({
      statusText: 'Inisialisasi Neural OCR Worker (ind + eng)...',
      progress: 30,
      stage: 'loading_model',
    })

    try {
      const worker = await createWorker('ind+eng', 1, {
        logger: (m: { status?: string; progress?: number }) => {
          if (m.status) {
            let statusLabel = m.status
            let pct = Math.round((m.progress || 0) * 100)

            if (m.status.includes('loading') || m.status.includes('load')) {
              statusLabel = 'Mengunduh/Memuat Bobot Bahasa (ind+eng)...'
            } else if (m.status.includes('init')) {
              statusLabel = 'Inisialisasi Engine Pengenalan...'
            } else if (m.status.includes('recogniz')) {
              statusLabel = `Mengenali Teks Citra (${pct}%)...`
            }

            setProgressState({
              statusText: statusLabel,
              progress: Math.min(95, Math.max(35, pct)),
              stage: 'recognizing',
            })
          }
        },
      })

      setProgressState({
        statusText: 'Menganalisis Karakter & Layout Citra Binarisasi...',
        progress: 75,
        stage: 'recognizing',
      })

      const result = await worker.recognize(targetOcrSource)
      const rawText = result.data.text ? result.data.text.trim() : ''
      const confidence = Math.round(result.data.confidence || 0)

      await worker.terminate()

      if (!rawText) {
        setErrorMessage('Citra tidak memuat teks yang dapat dibaca atau kualitas terlalu rendah. Anda dapat mengetik teks secara manual di area koreksi teks.')
      }

      const ocrInput: OCRAnalysisInput = {
        imageName: name,
        imagePreview: imageSrc,
        extractedText: rawText,
        confidence,
        editedText: rawText,
        language: 'ind+eng',
      }

      setExtractedData(ocrInput)
      setEditedText(rawText)
      setProgressState({
        statusText: 'Ekstraksi Teks Berhasil!',
        progress: 100,
        stage: 'completed',
      })
    } catch (err: unknown) {
      console.error('[NARADA OCR Error]', err)
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMessage(`Proses OCR gagal: ${msg}. Anda dapat mengoreksi atau memasukkan teks secara manual.`)
      setProgressState({
        statusText: 'Gagal memproses OCR',
        progress: 0,
        stage: 'error',
      })
      // Tetap sediakan form edit teks jika OCR gagal
      if (!extractedData) {
        setExtractedData({
          imageName: name,
          imagePreview: imageSrc,
          extractedText: '',
          confidence: 0,
          editedText: '',
          language: 'ind+eng',
        })
      }
    } finally {
      setIsOcrProcessing(false)
    }
  }

  /**
   * Handle file yang dipilih analis
   */
  const handleFileSelect = (file: File) => {
    if (!SUPPORTED_FORMATS.includes(file.type)) {
      setErrorMessage('Format berkas tidak valid. Harap gunakan format PNG, JPG, JPEG, atau WEBP.')
      return
    }

    // Maksimal 15MB
    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('Ukuran berkas melebihi batas 15MB.')
      return
    }

    setImageName(file.name)
    setErrorMessage(null)
    setExtractedData(null)
    setEditedText('')

    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setImagePreview(dataUrl)
      processImageWithOCR(dataUrl, file.name)
    }
    reader.onerror = () => {
      setErrorMessage('Gagal membaca berkas citra dari penyimpanan lokal.')
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleReset = () => {
    setImagePreview(null)
    setImageName('')
    setExtractedData(null)
    setEditedText('')
    setErrorMessage(null)
    setProgressState({
      statusText: '',
      progress: 0,
      stage: 'idle',
    })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  /**
   * Menghasilkan screenshot medsos buatan beresolusi tinggi pada canvas
   * untuk keperluan demo cepat jika analis tidak memiliki gambar lokal
   */
  const handleLoadDemoScreenshot = (type: 'hoax' | 'propaganda') => {
    const canvas = document.createElement('canvas')
    canvas.width = 720
    canvas.height = 420
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Background kartu medsos gelap
    ctx.fillStyle = '#0F1117'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Border
    ctx.strokeStyle = '#2A2F45'
    ctx.lineWidth = 4
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20)

    // Header medsos
    ctx.fillStyle = '#C8102E'
    ctx.fillRect(24, 24, 48, 48)
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 22px Arial'
    ctx.fillText('N', 38, 56)

    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 18px Arial'
    ctx.fillText(type === 'hoax' ? 'Waspada_Intel_Rakyat' : 'Front_Pembebasan_Bebas', 86, 44)
    ctx.fillStyle = '#8B93B0'
    ctx.font = '14px Arial'
    ctx.fillText('@radar_oposisi · 2 jam lalu', 86, 64)

    // Divider
    ctx.strokeStyle = '#1E2230'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(24, 90)
    ctx.lineTo(696, 90)
    ctx.stroke()

    // Content Text
    ctx.fillStyle = '#F0F2FF'
    ctx.font = '18px Arial'

    const lines = type === 'hoax'
      ? [
          'BAHAYA!! Beredar bocoran dokumen rahasia!',
          'TNI AD disebut berencana mengambil alih logistik sipil',
          'di wilayah Jawa dan Sumatera menjelang pemilu.',
          'Pemerintah pusat menutup-nutupi fakta ini dari publik.',
          'SEBARKAN ke seluruh grup WhatsApp dan keluarga sekarang juga!!',
          'Viralkan tagar #SelamatkanDemokrasi #RakyatBangkit'
        ]
      : [
          'Panggilan perjuangan untuk seluruh kawan di Papua Barat!',
          'Rezim militer NKRI terus menindas dan merampas kekayaan adat.',
          'Saatnya kita boikot seluruh komando militer Kodam XVII',
          'dan menuntut hak penentuan nasib sendiri secara internasional!',
          'Hancurkan dominasi penjajah di tanah kita tercinta!',
          'Merdeka atau mati!'
        ]

    let yOffset = 130
    for (const line of lines) {
      ctx.fillText(line, 30, yOffset)
      yOffset += 32
    }

    // Footer stats
    ctx.fillStyle = '#8B93B0'
    ctx.font = '13px Arial'
    ctx.fillText('12.4K Retweets · 38.2K Likes · 4.1K Balasan', 30, 380)

    const dataUrl = canvas.toDataURL('image/png')
    const fileName = type === 'hoax' ? 'demo_hoax_tni_screenshot.png' : 'demo_propaganda_papua.png'

    setImagePreview(dataUrl)
    setImageName(fileName)
    setErrorMessage(null)
    setExtractedData(null)
    setEditedText('')

    processImageWithOCR(dataUrl, fileName)
  }

  const handleSubmitAnalysis = () => {
    const finalContent = (editedText || extractedData?.extractedText || '').trim()
    if (!finalContent) {
      setErrorMessage('Teks hasil ekstraksi masih kosong. Harap ketik atau koreksi teks sebelum menganalisis.')
      return
    }

    onAnalyze({
      text: finalContent,
      source: 'ocr',
      title: `OCR: ${imageName || 'Screenshot Medsos'}`,
      imagePreview: imagePreview || undefined,
      ocrConfidence: extractedData?.confidence,
      imageName: imageName || undefined,
    })
  }

  return (
    <div className="card fade-in">
      <div className="card-header">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Scan size={14} color="var(--narada-red)" />
          NEURAL OCR SCREENSHOT ANALYZER
        </div>
        {imagePreview && (
          <button className="btn btn-ghost btn-sm" onClick={handleReset} title="Ganti Berkas">
            <RotateCcw size={13} /> Ganti Gambar
          </button>
        )}
      </div>

      <div className="card-body">
        {/* Tombol Demo Cepat */}
        {!imagePreview && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '1.5px',
              color: 'var(--text-muted)',
              marginBottom: '8px'
            }}>
              SAMPEL DEMO SCREENSHOT (TANPA PERLU UPLOAD)
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleLoadDemoScreenshot('hoax')}
                disabled={isOcrProcessing}
              >
                <Sparkles size={12} color="#EF4444" />
                Sampel 1: Hoaks Dispenad (Flyer Medsos)
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleLoadDemoScreenshot('propaganda')}
                disabled={isOcrProcessing}
              >
                <Sparkles size={12} color="#F97316" />
                Sampel 2: Propaganda Separatis (Post Medsos)
              </button>
            </div>
          </div>
        )}

        {/* Area Drag & Drop jika belum ada gambar */}
        {!imagePreview && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragOver ? 'var(--narada-red)' : 'var(--bg-border-bright)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '48px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: isDragOver ? 'var(--narada-red-subtle)' : 'var(--bg-elevated)',
              transition: 'all 0.2s ease',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelect(e.target.files[0])
                }
              }}
              style={{ display: 'none' }}
            />
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'rgba(200, 16, 46, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              border: '1px solid rgba(200, 16, 46, 0.25)'
            }}>
              <Upload size={24} color="var(--narada-red)" />
            </div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '16px',
              fontWeight: '600',
              letterSpacing: '1px',
              marginBottom: '6px',
              color: 'var(--text-primary)'
            }}>
              TARIK & LEPASKAN SCREENSHOT MEDSOS KE SINI
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Atau klik untuk memilih berkas dari perangkat Anda (PNG, JPG, JPEG, WEBP · Maks. 15MB)
            </div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
              background: 'var(--bg-card)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)'
            }}>
              <ImageIcon size={12} /> Model OCR: Tesseract v7 LSTM Dual-Mode (Bahasa Indonesia & English)
            </div>
          </div>
        )}

        {/* Progress Bar selama OCR */}
        {isOcrProcessing && (
          <div style={{
            marginTop: '16px',
            padding: '16px',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--bg-border)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div className="loading-dots">
                  <span /><span /><span />
                </div>
                {progressState.statusText}
              </div>
              <div style={{
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                fontWeight: '700',
                color: 'var(--narada-red)'
              }}>
                {progressState.progress}%
              </div>
            </div>
            <div style={{
              width: '100%',
              height: '6px',
              background: 'var(--bg-base)',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div
                style={{
                  width: `${progressState.progress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--narada-red), #F97316)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Pesan Kesalahan jika ada */}
        {errorMessage && (
          <div style={{
            marginTop: '14px',
            padding: '12px 14px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>
            <AlertTriangle size={16} color="#EF4444" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '12px', color: '#FCA5A5', lineHeight: '1.5' }}>
              {errorMessage}
            </div>
          </div>
        )}

        {/* Tampilan Side-by-Side: Pratinjau Citra & Editor Teks Ter-ekstrak */}
        {imagePreview && (
          <div style={{ marginTop: '16px' }}>
            <div className="grid-2" style={{ alignItems: 'stretch' }}>
              {/* Kolom Kiri: Pratinjau Citra & Filter Binarisasi Otsu */}
              <div style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--bg-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Eye size={12} color="var(--text-muted)" />
                    {/* Toggle Selector Citra Asli vs Binarisasi Otsu */}
                    {binarizedPreview ? (
                      <div style={{
                        display: 'inline-flex',
                        background: 'var(--bg-base)',
                        padding: '2px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--bg-border)'
                      }}>
                        <button
                          type="button"
                          onClick={() => setActivePreviewMode('original')}
                          style={{
                            padding: '3px 8px',
                            fontSize: '10px',
                            fontFamily: 'var(--font-mono)',
                            borderRadius: '2px',
                            border: 'none',
                            cursor: 'pointer',
                            background: activePreviewMode === 'original' ? 'var(--bg-border-bright)' : 'transparent',
                            color: activePreviewMode === 'original' ? '#FFFFFF' : 'var(--text-muted)',
                            fontWeight: activePreviewMode === 'original' ? '700' : '400',
                          }}
                        >
                          ASLI
                        </button>
                        <button
                          type="button"
                          onClick={() => setActivePreviewMode('otsu')}
                          style={{
                            padding: '3px 8px',
                            fontSize: '10px',
                            fontFamily: 'var(--font-mono)',
                            borderRadius: '2px',
                            border: 'none',
                            cursor: 'pointer',
                            background: activePreviewMode === 'otsu' ? '#D97706' : 'transparent',
                            color: activePreviewMode === 'otsu' ? '#000000' : '#D97706',
                            fontWeight: activePreviewMode === 'otsu' ? '700' : '400',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Contrast size={10} /> OTSU B/W
                        </button>
                      </div>
                    ) : (
                      <span style={{
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-muted)'
                      }}>
                        PRATINJAU CITRA
                      </span>
                    )}
                  </div>

                  <span style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-dim)',
                    maxWidth: '140px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {imageName}
                  </span>
                </div>

                {/* Display Frame Citra */}
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#070A0E',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                  minHeight: '260px',
                  maxHeight: '340px',
                  position: 'relative',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}>
                  <img
                    src={activePreviewMode === 'otsu' && binarizedPreview ? binarizedPreview : imagePreview}
                    alt="Preview Screenshot"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '340px',
                      objectFit: 'contain',
                      display: 'block'
                    }}
                  />

                  {/* Badge Mode Aktif di Sudut Gambar */}
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    padding: '2px 6px',
                    borderRadius: '2px',
                    background: 'rgba(12, 16, 22, 0.85)',
                    border: '1px solid rgba(217, 119, 6, 0.4)',
                    color: activePreviewMode === 'otsu' ? '#D97706' : '#94A3B8',
                    letterSpacing: '0.5px'
                  }}>
                    {activePreviewMode === 'otsu' ? 'FILTER: OTSU ADAPTIVE BINARIZED' : 'FILTER: CITRA RAW ORIGINAL'}
                  </div>
                </div>

                {/* HUD Telemetri Vision Otsu */}
                {otsuResult && (
                  <div style={{
                    marginTop: '8px',
                    padding: '6px 10px',
                    background: 'rgba(12, 16, 22, 0.95)',
                    border: '1px solid rgba(217, 119, 6, 0.25)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    gap: '6px'
                  }}>
                    <span style={{ color: '#D97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Sliders size={11} /> Ambang T*: <strong>{otsuResult.threshold}</strong>
                    </span>
                    <span style={{ color: otsuResult.isDarkMode ? '#38BDF8' : '#FBBF24' }}>
                      {otsuResult.isDarkMode ? '🌙 Dark Mode (Inverted)' : '☀️ Light Mode'}
                    </span>
                    <span style={{ color: 'var(--text-dim)' }}>
                      Tepi: {otsuResult.metrics.borderAverageLuminance} | σ_B²: {otsuResult.metrics.betweenClassVariance}
                    </span>
                    <span style={{ color: 'var(--threat-low)' }}>
                      ⚡ {otsuResult.processingLatencyMs}ms
                    </span>
                    <button
                      type="button"
                      onClick={() => setUseOtsuForOCR(!useOtsuForOCR)}
                      style={{
                        padding: '2px 6px',
                        fontSize: '9px',
                        fontFamily: 'var(--font-mono)',
                        borderRadius: '2px',
                        border: '1px solid rgba(217, 119, 6, 0.4)',
                        background: useOtsuForOCR ? 'rgba(217, 119, 6, 0.2)' : 'transparent',
                        color: useOtsuForOCR ? '#FBBF24' : 'var(--text-dim)',
                        cursor: 'pointer'
                      }}
                    >
                      Mode Input OCR: {useOtsuForOCR ? 'Binarized (Optimal)' : 'Citra Raw'}
                    </button>
                  </div>
                )}
              </div>

              {/* Kolom Kanan: Area Teks Ter-ekstrak (Bisa Dikoreksi Analis) */}
              <div style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--bg-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px'
                }}>
                  <span style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}>
                    <Edit3 size={12} /> HASIL EKSTRAKSI OCR (DAPAT DIEDIT)
                  </span>

                  {extractedData && (
                    <span style={{
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      padding: '2px 8px',
                      borderRadius: '3px',
                      background: extractedData.confidence >= 70 ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                      color: extractedData.confidence >= 70 ? 'var(--threat-low)' : 'var(--threat-medium)',
                      border: `1px solid ${extractedData.confidence >= 70 ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`
                    }}>
                      Keyakinan OCR: {extractedData.confidence}%
                    </span>
                  )}
                </div>

                {/* TASK H.5: OCR Edge Case Guard (Kualitas Citra Rendah / Teks Terlalu Pendek) */}
                {extractedData && (editedText.trim().length < 20 || extractedData.confidence < 45) && (
                  <div style={{
                    marginBottom: '8px',
                    padding: '8px 12px',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '11px',
                    color: '#FCD34D'
                  }}>
                    <AlertTriangle size={14} color="#F59E0B" style={{ flexShrink: 0 }} />
                    <span>
                      <strong>Peringatan Kualitas Citra Rendah:</strong> Teks hasil ekstraksi terindikasi buram atau terlalu singkat (&lt;20 karakter / keyakinan &lt;45%). Pastikan Anda memeriksa dan mengoreksi teks pada editor sebelum eksekusi analisis.
                    </span>
                  </div>
                )}

                <textarea
                  className="form-control"
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  placeholder={isOcrProcessing ? 'Tesseract sedang mengekstraksi teks...' : 'Teks hasil OCR akan muncul di sini dan dapat Anda edit/koreksi bila terdapat saltik (typo)...'}
                  rows={10}
                  disabled={isOcrProcessing}
                  style={{
                    flex: 1,
                    minHeight: '260px',
                    fontSize: '12px',
                    lineHeight: '1.6'
                  }}
                />

                <div style={{
                  marginTop: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-dim)'
                  }}>
                    {editedText.trim().split(/\s+/).filter(Boolean).length} kata · {editedText.length} karakter
                  </span>
                  {editedText !== (extractedData?.extractedText || '') && (
                    <span style={{
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--threat-medium)'
                    }}>
                      [Telah dikoreksi analis]
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Tombol Aksi Bawah */}
            <div style={{
              display: 'flex',
              gap: '10px',
              marginTop: '16px',
              alignItems: 'center'
            }}>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={handleSubmitAnalysis}
                disabled={isOcrProcessing || isAnalyzing || !editedText.trim()}
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
                    <CheckCircle2 size={16} />
                    Jalankan Analisis Kognitif
                  </>
                )}
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-lg"
                onClick={handleReset}
                disabled={isOcrProcessing || isAnalyzing}
              >
                <RotateCcw size={14} /> Ganti Gambar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
