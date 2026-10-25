import { useState, useRef } from 'react'
import {
  UploadCloud,
  FileSpreadsheet,
  FileText,
  Play,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Eye,
  CheckCircle,
  BarChart3,
  Download
} from 'lucide-react'
import { analyzeHybrid } from '../engine/combiner'
import { saveAnalysis } from '../utils/storage'
import { getThreatBadge, getCategoryBadge, truncateText } from '../utils/format'
import type { AnalysisResult, ContentCategory, ThreatLevel } from '../types'

interface BatchUploaderProps {
  onSelectResult?: (result: AnalysisResult) => void
  isGlobalAnalyzing?: boolean
}

// ─── Sampel Data Batch untuk Demo Instan ───
const SAMPLE_CSV_CONTENT = `content
"DARURAT! Beredar info intelijen bahwa markas komando militer akan memberlakukan jam malam nasional mulai malam ini. Sebarkan ke seluruh grup WA!"
"Pemberontak OPM berhasil memukul mundur satuan TNI di Nduga dan menguasai bandara perintis setempat. Boikot NKRI!"
"Ayo retweet serentak! Tagar #DukungAksiRakyat trendingkan sekarang juga! Jangan sampai isu ini tenggelam kawan-kawan!"
"Kemenhan diam-diam tandatangani kesepakatan pangkalan militer asing di pulau terluar Indonesia. Rezim ini pengkhianat kedaulatan bangsa!"
"TNI Angkatan Darat menyalurkan bantuan logistik darurat kepada korban banjir bandang di wilayah Luwu Utara."
"VIRAL! Video ini sengaja dihapus media! Bukti oknum aparat melakukan penyiksaan warga sipil tak berdosa di desa terpencil!"
"Kopassus berhasil mengevakuasi 45 warga sipil yang terisolasi akibat tanah longsor di kawasan pegunungan terjal."
"Serukan pemogokan umum nasional! Rezim militeristik ini harus tumbang demi kemerdekaan sejati rakyat tertindas!"
"RT dan like postingan ini biar FYP! Semua relawan wajib ramaikan kolom komentar akun resmi pemerintah serempak pukul 19.00 WIB!"
"Panglima TNI memimpin upacara serah terima jabatan Danjen Kopassus di Markas Cijantung Jakarta Timur."
"Beredar selebaran gelap klaim vaksinasi personel TNI mengandung zat berbahaya pengendali pikiran buatan asing."
"Komando Teritorial Kodam Diponegoro menyelenggarakan program Manunggal Membangun Desa (TMMD) membuka jalan desa 12 KM."
`

// ─── TASK H.5: Uji Stres 25 Komentar Buzzer Ekstrem ───
const STRESS_TEST_CSV_CONTENT = `content
"DARURAT! Beredar info intelijen bahwa markas komando militer akan memberlakukan jam malam nasional mulai malam ini. Sebarkan ke seluruh grup WA!"
"Pemberontak OPM berhasil memukul mundur satuan TNI di Nduga dan menguasai bandara perintis setempat. Boikot NKRI!"
"Ayo retweet serentak! Tagar #DukungAksiRakyat trendingkan sekarang juga! Jangan sampai isu ini tenggelam kawan-kawan!"
"Kemenhan diam-diam tandatangani kesepakatan pangkalan militer asing di pulau terluar Indonesia. Rezim ini pengkhianat kedaulatan bangsa!"
"TNI Angkatan Darat menyalurkan bantuan logistik darurat kepada korban banjir bandang di wilayah Luwu Utara."
"VIRAL! Video ini sengaja dihapus media! Bukti oknum aparat melakukan penyiksaan warga sipil tak berdosa di desa terpencil!"
"Kopassus berhasil mengevakuasi 45 warga sipil yang terisolasi akibat tanah longsor di kawasan pegunungan terjal."
"Serukan pemogokan umum nasional! Rezim militeristik ini harus tumbang demi kemerdekaan sejati rakyat tertindas!"
"RT dan like postingan ini biar FYP! Semua relawan wajib ramaikan kolom komentar akun resmi pemerintah serempak pukul 19.00 WIB!"
"Panglima TNI memimpin upacara serah terima jabatan Danjen Kopassus di Markas Cijantung Jakarta Timur."
"Beredar selebaran gelap klaim vaksinasi personel TNI mengandung zat berbahaya pengendali pikiran buatan asing."
"Komando Teritorial Kodam Diponegoro menyelenggarakan program Manunggal Membangun Desa (TMMD) membuka jalan desa 12 KM."
"Aparat intelijen menyusup ke kampus-kampus dan memasang alat penyadap pada ponsel aktivis mahasiswa!"
"Jangan percaya media arus utama! Ribuan pasukan asing bersenjata lengkap sudah mendarat di pangkalan militer rahasia!"
"Tagar #TolakMiliterisasi trendingkan sekarang! Semua akun botnet aktifkan script auto-retweet serempak!"
"Prajurit Yonif Raider 514 berhasil membebaskan sandera warga sipil tanpa letusan senjata di pedalaman Papua."
"Bocoran dokumen rahasia menyebutkan anggaran panser Anoa dikorupsi hingga 80 persen oleh pejabat kementerian!"
"Seluruh rakyat wajib bersatu dan memboikot pemilu serta melawan intimidasi aparat di setiap TPS!"
"Penerangan Kodam Jaya merilis klarifikasi resmi membantah isu bentrok antar satuan di wilayah Jakarta Timur."
"Akun-akun bayaran rezim mulai menyerang kolom komentar kita! Balas dengan serbuan link petisi sekarang juga!"
"Satgas Pamtas RI-PNG Yonif 122 mengamankan 45 kg ganja kering di jalur tikus perbatasan Skouw Jayapura."
"Waspada! Beredar panggilan tugas palsu mencatut nama Kasad untuk meminta sejumlah uang kepada keluarga calon prajurit."
"Serukan referendum penentuan nasib sendiri! Kami menolak segala bentuk aneksasi militer di tanah leluhur kami!"
"Tim medis TNI AD menggelar operasi katarak gratis bagi 500 lansia di perbatasan Pulau Sebatik Kalimantan Utara."
"Kompak tweet serentak pukul 21.00 WIB: Bongkar manipulasi data pertahanan nasional! Viralkan tagar #RakyatMenggugat!"
`

/**
 * Parser CSV sederhana & tangguh yang mendukung multi-kolom dan tanda kutip
 */
function parseCsvLines(rawText: string): string[] {
  const lines = rawText.split(/\r?\n/)
  if (lines.length === 0) return []

  const result: string[] = []
  let textColumnIndex = 0

  // Periksa baris header
  const firstLine = lines[0].trim()
  const headerCols = firstLine.split(',').map(c => c.replace(/["']/g, '').trim().toLowerCase())
  const hasHeader = headerCols.some(h => ['content', 'text', 'post', 'komentar', 'narasi', 'pesan'].includes(h))

  let startIndex = 0
  if (hasHeader) {
    startIndex = 1
    const foundIdx = headerCols.findIndex(h => ['content', 'text', 'post', 'komentar', 'narasi', 'pesan'].includes(h))
    if (foundIdx !== -1) {
      textColumnIndex = foundIdx
    }
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Regex pembagi CSV yang menghormati tanda kutip ganda
    const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)
    if (matches && matches[textColumnIndex]) {
      const clean = matches[textColumnIndex].replace(/^["']|["']$/g, '').replace(/""/g, '"').trim()
      if (clean.length > 5) {
        result.push(clean)
      }
    } else {
      // Fallback jika pemisahan regex tidak cocok
      const clean = line.replace(/^["']|["']$/g, '').trim()
      if (clean.length > 5) {
        result.push(clean)
      }
    }
  }

  return result
}

export default function BatchUploader({ onSelectResult }: BatchUploaderProps) {
  const [fileName, setFileName] = useState<string>('')
  const [itemsToProcess, setItemsToProcess] = useState<string[]>([])
  const [processedResults, setProcessedResults] = useState<AnalysisResult[]>([])
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState<boolean>(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * Parse file berkas teks atau CSV
   */
  const handleFileProcess = (file: File) => {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      setErrorMessage('Format berkas tidak didukung. Harap gunakan berkas .csv atau .txt.')
      return
    }

    setFileName(file.name)
    setErrorMessage(null)
    setProcessedResults([])

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      let parsed: string[] = []

      if (file.name.endsWith('.csv')) {
        parsed = parseCsvLines(content)
      } else {
        // Berkas .txt (1 baris = 1 postingan)
        parsed = content
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(line => line.length > 5 && !line.startsWith('#'))
      }

      if (parsed.length === 0) {
        setErrorMessage('Berkas tidak memuat baris teks yang valid untuk dianalisis.')
        setItemsToProcess([])
        return
      }

      setItemsToProcess(parsed)
    }

    reader.onerror = () => {
      setErrorMessage('Gagal membaca berkas dari penyimpanan lokal.')
    }

    reader.readAsText(file)
  }

  /**
   * Muat data sampel instan (12 baris)
   */
  const handleLoadSample = () => {
    setFileName('sampel_patroli_siber_12_post.csv')
    setErrorMessage(null)
    setProcessedResults([])
    const parsed = parseCsvLines(SAMPLE_CSV_CONTENT)
    setItemsToProcess(parsed)
  }

  /**
   * TASK H.5: Muat Uji Stres Ekstrem (25 baris)
   */
  const handleLoadStressTest = () => {
    setFileName('uji_stres_25_komentar_buzzer_ekstrem.csv')
    setErrorMessage(null)
    setProcessedResults([])
    const parsed = parseCsvLines(STRESS_TEST_CSV_CONTENT)
    setItemsToProcess(parsed)
  }

  /**
   * TASK H.5: Eksekusi Batch Analysis Non-Blocking Chunking (5 baris per frame)
   */
  const handleStartBatchAnalysis = async () => {
    if (itemsToProcess.length === 0) return

    setIsProcessing(true)
    setProcessedResults([])
    setCurrentIndex(0)
    setErrorMessage(null)

    const results: AnalysisResult[] = []
    const CHUNK_SIZE = 5

    for (let i = 0; i < itemsToProcess.length; i += CHUNK_SIZE) {
      const chunk = itemsToProcess.slice(i, i + CHUNK_SIZE)

      for (let j = 0; j < chunk.length; j++) {
        const currentItemIdx = i + j
        setCurrentIndex(currentItemIdx + 1)
        const text = chunk[j]

        // Analisis hybrid ML + Rules
        const res = analyzeHybrid(text, {
          inputSource: 'file',
          title: `Batch #${currentItemIdx + 1} (${fileName})`,
        })

        // Simpan ke sessionStorage
        saveAnalysis(res)
        results.push(res)
      }

      setProcessedResults([...results])

      // Non-blocking yield to allow browser 60fps repainting
      await new Promise(resolve => setTimeout(resolve, 25))
    }

    setIsProcessing(false)
  }

  /**
   * TASK H.5: Export Rekap Analisis Batch (CSV)
   */
  const handleExportCsv = () => {
    if (processedResults.length === 0) return

    const headers = ['ID', 'Kategori', 'Tingkat Ancaman', 'Keyakinan AI (%)', 'Skor ML (%)', 'Skor Rules (%)', 'Indikator Keywords', 'Entitas Sasaran', 'Teks Konten']
    const rows = processedResults.map(r => [
      r.id,
      r.category,
      r.threatLevel,
      r.confidence,
      r.mlScore,
      r.ruleScore,
      `"${(r.keywords || []).join('; ')}"`,
      `"${(r.targetedEntities || []).join('; ')}"`,
      `"${(r.input || r.rawContent || '').replace(/"/g, '""')}"`
    ])

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `NARADA-BATCH-ANALYSIS-${Date.now()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleReset = () => {
    setFileName('')
    setItemsToProcess([])
    setProcessedResults([])
    setIsProcessing(false)
    setCurrentIndex(0)
    setErrorMessage(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Hitung ringkasan statistik
  const categoryCounts = processedResults.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + 1
    return acc
  }, {} as Record<ContentCategory, number>)

  const threatCounts = processedResults.reduce((acc, curr) => {
    acc[curr.threatLevel] = (acc[curr.threatLevel] || 0) + 1
    return acc
  }, {} as Record<ThreatLevel, number>)

  const progressPercent = itemsToProcess.length > 0
    ? Math.round((currentIndex / itemsToProcess.length) * 100)
    : 0

  return (
    <div className="card fade-in">
      <div className="card-header">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileSpreadsheet size={14} color="var(--narada-red)" />
          BATCH FILE ANALYZER (.CSV / .TXT)
        </div>
        {(itemsToProcess.length > 0 || processedResults.length > 0) && (
          <button className="btn btn-ghost btn-sm" onClick={handleReset} disabled={isProcessing}>
            <RotateCcw size={13} /> Reset Berkas
          </button>
        )}
      </div>

      <div className="card-body">
        {/* Tombol Demo Sampel */}
        {itemsToProcess.length === 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '1.5px',
              color: 'var(--text-muted)',
              marginBottom: '8px'
            }}>
              DATASET SAMPEL SIAP UJI
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleLoadSample}
              >
                <Sparkles size={12} color="#EF4444" />
                Muat Berkas Sampel CSV (12 Baris)
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleLoadStressTest}
              >
                <Sparkles size={12} color="#F97316" />
                Muat Uji Stres: 25 Komentar Buzzer Ekstrem
              </button>
            </div>
          </div>
        )}

        {/* Drag & Drop Upload Area */}
        {itemsToProcess.length === 0 && (
          <div
            onDrop={(e) => {
              e.preventDefault()
              setIsDragOver(false)
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileProcess(e.dataTransfer.files[0])
              }
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              setIsDragOver(false)
            }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragOver ? 'var(--narada-red)' : 'var(--bg-border-bright)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '40px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: isDragOver ? 'var(--narada-red-subtle)' : 'var(--bg-elevated)',
              transition: 'all 0.2s ease',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileProcess(e.target.files[0])
                }
              }}
              style={{ display: 'none' }}
            />
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              background: 'rgba(200, 16, 46, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              border: '1px solid rgba(200, 16, 46, 0.25)'
            }}>
              <UploadCloud size={24} color="var(--narada-red)" />
            </div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '15px',
              fontWeight: '600',
              letterSpacing: '1px',
              marginBottom: '6px',
              color: 'var(--text-primary)'
            }}>
              UNGGAH BERKAS CSV ATAU TXT UNTUK ANALISIS MASSAL
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Mendukung kolom <code>content</code> atau <code>text</code> pada file CSV, atau format per-baris pada file TXT
            </div>
          </div>
        )}

        {/* Error notification */}
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
            <div style={{ fontSize: '12px', color: '#FCA5A5' }}>{errorMessage}</div>
          </div>
        )}

        {/* File Terpilih & Siap Dieksekusi */}
        {itemsToProcess.length > 0 && processedResults.length === 0 && !isProcessing && (
          <div style={{
            marginTop: '16px',
            padding: '16px',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--bg-border)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="var(--narada-red)" />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {fileName}
                  </div>
                  <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    Terdeteksi {itemsToProcess.length} baris konten siap dianalisis
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleStartBatchAnalysis}
              >
                <Play size={14} /> Jalankan Batch ({itemsToProcess.length} Item)
              </button>
            </div>

            {/* Cuplikan 3 Baris Pertama */}
            <div style={{
              background: 'var(--bg-base)',
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--bg-border)'
            }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '6px' }}>
                PRATINJAU 3 BARIS PERTAMA:
              </div>
              {itemsToProcess.slice(0, 3).map((item, idx) => (
                <div key={idx} style={{
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  padding: '4px 0',
                  borderBottom: idx < 2 ? '1px dashed var(--bg-border)' : 'none',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  <span style={{ color: 'var(--narada-red)', marginRight: '6px' }}>#{idx + 1}</span> {item}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress Bar Eksekusi Batch */}
        {isProcessing && (
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
                Menganalisis baris {currentIndex} dari {itemsToProcess.length}...
              </div>
              <div style={{
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                fontWeight: '700',
                color: 'var(--narada-red)'
              }}>
                {progressPercent}%
              </div>
            </div>

            <div style={{
              width: '100%',
              height: '8px',
              background: 'var(--bg-base)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--narada-red), #F97316)',
                  transition: 'width 0.15s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Hasil Rangkuman & Tabel Batch */}
        {processedResults.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            {/* Header Rangkuman */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={16} color="#22C55E" />
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '15px',
                  fontWeight: '700',
                  letterSpacing: '1px'
                }}>
                  HASIL BATCH: {processedResults.length} / {itemsToProcess.length} KONTEN DIANALISIS
                </span>
              </div>

              {!isProcessing && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleExportCsv}
                    style={{ fontSize: '11px' }}
                  >
                    <Download size={12} color="var(--accent-blue)" />
                    Ekspor Rekap Batch (.CSV)
                  </button>
                  <span style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--threat-low)',
                    background: 'rgba(34, 197, 94, 0.12)',
                    padding: '3px 8px',
                    borderRadius: '3px'
                  }}>
                    Tersimpan di Session Storage
                  </span>
                </div>
              )}
            </div>

            {/* Stat Cards Breakdown Kategori & Ancaman */}
            <div className="grid-2" style={{ marginBottom: '14px' }}>
              {/* Kategori Breakdown */}
              <div style={{
                background: 'var(--bg-elevated)',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--bg-border)'
              }}>
                <div style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '1px',
                  color: 'var(--text-muted)',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <BarChart3 size={11} /> DISTRIBUSI KATEGORI
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(['HOAKS', 'PROPAGANDA', 'BUZZER', 'DISINFORMASI', 'NETRAL'] as ContentCategory[]).map(cat => {
                    const count = categoryCounts[cat] || 0
                    const badge = getCategoryBadge(cat)
                    return (
                      <span
                        key={cat}
                        style={{
                          fontSize: '10px',
                          fontFamily: 'var(--font-mono)',
                          padding: '3px 8px',
                          borderRadius: '3px',
                          background: badge.bgColor,
                          color: badge.color,
                          border: `1px solid ${badge.color}30`
                        }}
                      >
                        {cat}: <strong>{count}</strong>
                      </span>
                    )
                  })}
                </div>
              </div>

              {/* Threat Level Breakdown */}
              <div style={{
                background: 'var(--bg-elevated)',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--bg-border)'
              }}>
                <div style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '1px',
                  color: 'var(--text-muted)',
                  marginBottom: '8px'
                }}>
                  TINGKAT ANCAMAN (THREAT LEVEL)
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(['critical', 'high', 'medium', 'low'] as ThreatLevel[]).map(lvl => {
                    const count = threatCounts[lvl] || 0
                    const badge = getThreatBadge(lvl)
                    return (
                      <span
                        key={lvl}
                        style={{
                          fontSize: '10px',
                          fontFamily: 'var(--font-mono)',
                          padding: '3px 8px',
                          borderRadius: '3px',
                          background: badge.bgColor,
                          color: badge.color,
                          border: `1px solid ${badge.borderColor}`
                        }}
                      >
                        {badge.label}: <strong>{count}</strong>
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Tabel Baris Hasil Batch */}
            <div style={{
              maxHeight: '320px',
              overflowY: 'auto',
              background: 'var(--bg-base)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--bg-border)'
            }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>#</th>
                    <th style={{ width: '100px' }}>Kategori</th>
                    <th style={{ width: '90px' }}>Ancaman</th>
                    <th>Cuplikan Konten</th>
                    <th style={{ width: '70px', textAlign: 'right' }}>ML</th>
                    <th style={{ width: '70px', textAlign: 'right' }}>Rules</th>
                    <th style={{ width: '60px', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {processedResults.map((res, idx) => {
                    const catBadge = getCategoryBadge(res.category)
                    const threatBadge = getThreatBadge(res.threatLevel)

                    return (
                      <tr key={res.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-dim)' }}>
                          {idx + 1}
                        </td>
                        <td>
                          <span
                            className="category-badge"
                            style={{
                              background: catBadge.bgColor,
                              color: catBadge.color,
                              border: `1px solid ${catBadge.color}30`
                            }}
                          >
                            {res.category}
                          </span>
                        </td>
                        <td>
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
                        </td>
                        <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {truncateText(res.input, 75)}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', textAlign: 'right', color: 'var(--text-muted)' }}>
                          {res.mlScore}%
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', textAlign: 'right', color: 'var(--text-muted)' }}>
                          {res.ruleScore}%
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '3px 6px' }}
                            title="Tampilkan Detail Analisis Lengkap"
                            onClick={() => onSelectResult && onSelectResult(res)}
                          >
                            <Eye size={12} color="var(--text-primary)" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
