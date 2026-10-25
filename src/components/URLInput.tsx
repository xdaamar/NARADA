import { useState } from 'react'
import {
  Link as LinkIcon,
  Globe,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ExternalLink,
  BookOpen,
  User,
  Clock,
  ClipboardPaste
} from 'lucide-react'
import { Readability } from '@mozilla/readability'
import ResilientIngestionBanner from './ResilientIngestionBanner'
import type { URLAnalysisInput } from '../types'

interface URLInputProps {
  onAnalyze: (payload: {
    text: string
    source: 'url'
    title?: string
    sourceMeta?: {
      author?: string | null
      siteName?: string
      url?: string
    }
  }) => void
  isAnalyzing?: boolean
}

// ─── Data Sampel Berita untuk Evaluasi/Demo Cepat ───
const DEMO_URL_SAMPLES: Array<{
  label: string
  categoryBadge: string
  badgeColor: string
  data: URLAnalysisInput
}> = [
  {
    label: 'Detik: Beredar Isu Alutsista Fiktif',
    categoryBadge: 'ISU HOAKS',
    badgeColor: '#EF4444',
    data: {
      url: 'https://news.detik.com/berita/d-8921102/viral-alutsista-fiktif-kemhan-angkat-bicara',
      title: 'Kemhan Buka Suara Terkait Beredarnya Dokumen Pembelian Alutsista Fiktif Senilai Rp 24 Triliun',
      siteName: 'Detik News',
      author: 'Tim Investigasi Cyber',
      excerpt: 'Kementerian Pertahanan menegaskan dokumen pembelian alutsista yang viral di grup percakapan adalah dokumen palsu hasil manipulasi kop surat resmi...',
      content: `Kementerian Pertahanan (Kemhan) RI menegaskan bahwa selebaran dan berkas digital mengenai dugaan pengadaan sistem radar dan alutsista fiktif senilai Rp 24 triliun yang beredar di media sosial adalah dokumen palsu hasil rekayasa.

Kepala Biro Humas Setjen Kemhan menyatakan pihak intelijen siber telah mendeteksi penyebaran narasi ini bersumber dari jaringan akun anonim luar negeri yang berupaya merusak citra modernisasi pertahanan nasional.

"Kami pastikan tidak ada tender pengadaan seperti yang tertera pada lembaran viral tersebut. Format dokumen dan nomor registrasi satuan fiktif dan tidak sesuai tata naskah dinas militer," ujarnya dalam keterangan pers di Jakarta.

Masyarakat diimbau tidak terprovokasi dan menyebarkan konten disinformasi yang berpotensi memecah belah stabilitas keamanan nasional. Kemhan bersama Pussiberad TNI AD terus mengusut aktor intelektual di balik peredaran dokumen tersebut.`,
      fetchedAt: Date.now(),
    },
  },
  {
    label: 'Tempo: Narasi Provokasi Wilayah Perbatasan',
    categoryBadge: 'PROPAGANDA',
    badgeColor: '#F97316',
    data: {
      url: 'https://nasional.tempo.co/read/192837/tni-ad-perketat-pengamanan-perbatasan-papua',
      title: 'TNI AD Bantah Klaim KKB Soal Penguasaan Pos Teritorial di Puncak Jaya',
      siteName: 'Tempo Nasional',
      author: 'Arya Wardhana',
      excerpt: 'Pangdam XVII Cenderawasih membantah klaim kelompok separatis bersenjata yang mengaku telah melumpuhkan pos pengamanan TNI AD...',
      content: `Komando Daerah Militer XVII/Cenderawasih membantah keras klaim yang dipublikasikan oleh juru bicara kelompok separatis bersenjata melalui video dan pamflet digital mengenai perebutan pos keamanan teritorial di Kabupaten Puncak Jaya.

Pangdam menegaskan kondisi seluruh pos TNI AD di wilayah perbatasan dan pedalaman tetap dalam kendali penuh prajurit dan situasi masyarakat berlangsung aman terkendali.

"Klaim mereka hanyalah propaganda murahan di media sosial untuk mencari perhatian internasional dan donasi gelap. Seluruh personel kami tetap bersiaga mengamankan warga dari intimidasi teror," tegas Kapendam dalam siaran resminya.

Pussiberad TNI AD mencatat lonjakan aktivitas bot yang mengamplifikasi cuplikan video editan lawas dari tahun 2019 seolah-olah terjadi kontak senjata baru kemarin.`,
      fetchedAt: Date.now(),
    },
  },
  {
    label: 'Kompas: Rilis Resmi Latihan Gabungan',
    categoryBadge: 'NETRAL / RESMI',
    badgeColor: '#22C55E',
    data: {
      url: 'https://nasional.kompas.com/read/2026/10/20/tni-ad-gelar-latihan-gabungan-antar-kecabangan',
      title: 'TNI AD Gelar Latihan Tempur Antar-Kecabangan Yancab 2026 di Baturaja',
      siteName: 'Kompas Media',
      author: 'Fajar Nugroho',
      excerpt: 'Sebanyak 3.500 prajurit TNI Angkatan Darat dari berbagai kecabangan menggelar latihan puncak kesiapan tempur terintegrasi...',
      content: `Sebanyak 3.500 prajurit TNI Angkatan Darat menggelar latihan tempur antar-kecabangan terpadu di Pusat Latihan Tempur (Puslatpur) Kodiklatad, Baturaja, Sumatera Selatan.

Latihan ini melibatkan alutsista modern termasuk tank Leopard 2RI, helikopter serbu Apache AH-64E, dan sistem artileri roket Astros II MK6. Komandan Kodiklatad menyatakan latihan ini bertujuan memvalidasi doktrin pertempuran modern dan interoperabilitas antar-satuan tempur.

"Kesiapan operasional prajurit harus selalu pada tingkat tertinggi untuk menjaga kedaulatan NKRI dari segala bentuk ancaman nyata di masa depan," kata Danlat dalam amanat penutupan latihan.

Kegiatan latihan berlangsung lancar dengan mematuhi protokol keselamatan amunisi dan prosedur pengamanan teritorial warga sekitar puslatpur.`,
      fetchedAt: Date.now(),
    },
  },
]

export default function URLInput({ onAnalyze, isAnalyzing = false }: URLInputProps) {
  const [urlInput, setUrlInput] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [extractedArticle, setExtractedArticle] = useState<URLAnalysisInput | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [corsFallbackActive, setCorsFallbackActive] = useState<boolean>(false)
  const [fallbackText, setFallbackText] = useState<string>('')
  const [fallbackTitle, setFallbackTitle] = useState<string>('')

  /**
   * Validasi format URL HTTP/HTTPS
   */
  const isValidUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  }

  /**
   * Ekstraksi DOM HTML menggunakan Mozilla Readability
   */
  const parseHtmlWithReadability = (htmlText: string, targetUrl: string): URLAnalysisInput => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(htmlText, 'text/html')

    const hostName = new URL(targetUrl).hostname.replace(/^www\./, '')
    const reader = new Readability(doc)
    const article = reader.parse()

    const rawTitle = article?.title || doc.querySelector('title')?.textContent || 'Artikel Berita'
    const cleanContent = article?.textContent
      ? article.textContent.trim()
      : (doc.body?.textContent || '').trim()

    const excerpt = article?.excerpt || cleanContent.substring(0, 180) + '...'
    const author = article?.byline || null
    const siteName = article?.siteName || hostName

    return {
      url: targetUrl,
      title: rawTitle.trim(),
      content: cleanContent,
      author,
      siteName,
      excerpt: excerpt.trim(),
      fetchedAt: Date.now(),
    }
  }

  /**
   * Fetch konten halaman URL dengan timeout & fallback CORS proxy
   */
  const handleFetchUrl = async () => {
    const trimmed = urlInput.trim()
    if (!trimmed) {
      setErrorMessage('Harap masukkan alamat URL artikel atau postingan berita.')
      return
    }

    if (!isValidUrl(trimmed)) {
      setErrorMessage('Format URL tidak valid. Harap gunakan awalan http:// atau https://')
      return
    }

    setIsLoading(true)
    setErrorMessage(null)
    setExtractedArticle(null)
    setCorsFallbackActive(false)

    // Coba Fetch Langsung (Direct Fetch)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 4000)

      const response = await fetch(trimmed, {
        signal: controller.signal,
        headers: { Accept: 'text/html,application/xhtml+xml' },
      })
      clearTimeout(timeoutId)

      if (response.ok) {
        const html = await response.text()
        const article = parseHtmlWithReadability(html, trimmed)
        if (article.content.length < 50) {
          throw new Error('Konten teks artikel terlalu pendek atau terproteksi paywall/login.')
        }
        setExtractedArticle(article)
        setIsLoading(false)
        return
      }
    } catch {
      // Direct fetch gagal (biasanya karena browser CORS protection pada news portal)
      console.warn('[NARADA URL Extractor] Direct fetch blocked by CORS or network, trying CORS proxy fallback...')
    }

    // Coba Jalur Cadangan (Public CORS Proxy)
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(trimmed)}`
      const proxyController = new AbortController()
      const proxyTimeout = setTimeout(() => proxyController.abort(), 6000)

      const proxyResp = await fetch(proxyUrl, { signal: proxyController.signal })
      clearTimeout(proxyTimeout)

      if (proxyResp.ok) {
        const html = await proxyResp.text()
        const article = parseHtmlWithReadability(html, trimmed)
        if (article.content.length > 50) {
          setExtractedArticle(article)
          setIsLoading(false)
          return
        }
      }
    } catch {
      console.warn('[NARADA URL Extractor] CORS proxy failed or timed out.')
    }

    // Jika direct fetch & proxy keduanya diblokir CORS browser
    setIsLoading(false)
    setCorsFallbackActive(true)
    setErrorMessage(
      'Koneksi browser langsung ke tautan ini dibatasi oleh kebijakan CORS portal berita tersebut. Anda dapat menggunakan tombol "Salin Cepat Konten Berita" di bawah, atau pilih contoh demo.'
    )
  }

  /**
   * Menjalankan artikel demo
   */
  const handleSelectDemoSample = (sample: typeof DEMO_URL_SAMPLES[number]) => {
    setUrlInput(sample.data.url)
    setExtractedArticle(sample.data)
    setErrorMessage(null)
    setCorsFallbackActive(false)
  }

  /**
   * Submit manual dari fallback CORS
   */
  const handleApplyFallbackText = () => {
    const text = fallbackText.trim()
    if (!text) {
      setErrorMessage('Harap isi teks berita pada area di bawah.')
      return
    }

    const title = fallbackTitle.trim() || 'Berita Terambil (Input Analis)'
    let siteName = 'Media Online'
    try {
      siteName = new URL(urlInput).hostname.replace(/^www\./, '')
    } catch {
      // keep default
    }

    const fallbackArticle: URLAnalysisInput = {
      url: urlInput || 'https://berita-online.id',
      title,
      content: text,
      siteName,
      author: 'Analis Intelejen',
      excerpt: text.substring(0, 180) + '...',
      fetchedAt: Date.now(),
    }

    setExtractedArticle(fallbackArticle)
    setCorsFallbackActive(false)
    setErrorMessage(null)
  }

  /**
   * Reset form
   */
  const handleReset = () => {
    setUrlInput('')
    setExtractedArticle(null)
    setErrorMessage(null)
    setCorsFallbackActive(false)
    setFallbackText('')
    setFallbackTitle('')
  }

  /**
   * Lanjut Analisis Kognitif
   */
  const handleProceedToAnalysis = () => {
    if (!extractedArticle || !extractedArticle.content.trim()) return

    onAnalyze({
      text: extractedArticle.content,
      source: 'url',
      title: extractedArticle.title,
      sourceMeta: {
        author: extractedArticle.author,
        siteName: extractedArticle.siteName,
        url: extractedArticle.url,
      },
    })
  }

  return (
    <div className="card fade-in">
      <div className="card-header">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Globe size={14} color="var(--narada-red)" />
          URL NEWS & SOCIAL ARTICLE EXTRACTOR
        </div>
        {extractedArticle && (
          <button className="btn btn-ghost btn-sm" onClick={handleReset} title="Ganti URL">
            <RotateCcw size={13} /> Ganti URL
          </button>
        )}
      </div>

      <div className="card-body">
        {/* Tombol Demo Cepat */}
        {!extractedArticle && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '1.5px',
              color: 'var(--text-muted)',
              marginBottom: '8px'
            }}>
              SAMPEL BERITA ONLINE SIAP UJI (DEMO CEPAT)
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {DEMO_URL_SAMPLES.map((sample) => (
                <button
                  key={sample.label}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleSelectDemoSample(sample)}
                  disabled={isLoading}
                >
                  <Sparkles size={12} color={sample.badgeColor} />
                  {sample.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Bar URL */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <div style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center'
            }}>
              <LinkIcon size={14} />
            </div>
            <input
              type="url"
              className="form-control"
              placeholder="https://news.detik.com/... atau https://kompas.com/... atau tautan artikel lainnya"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleFetchUrl()
                }
              }}
              disabled={isLoading || isAnalyzing}
              style={{ paddingLeft: '36px' }}
            />
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleFetchUrl}
            disabled={isLoading || isAnalyzing || !urlInput.trim()}
          >
            {isLoading ? (
              <>
                <div className="loading-dots">
                  <span /><span /><span />
                </div>
                Mengambil...
              </>
            ) : (
              <>
                <Globe size={14} />
                Ambil Konten Artikel
              </>
            )}
          </button>
        </div>

        {/* Banner Ketahanan Ingesti Multi-Tier (Palantir Pattern) */}
        {(corsFallbackActive || /(instagram\.com|tiktok\.com|twitter\.com|x\.com|facebook\.com|threads\.net)/i.test(urlInput)) && (
          <ResilientIngestionBanner
            platformName={
              /(instagram\.com|tiktok\.com|twitter\.com|x\.com|facebook\.com|threads\.net)/i.test(urlInput)
                ? 'MEDIA SOSIAL (PROTEKSI LOGIN WALL)'
                : 'PORTAL BERITA (CORS POLICY BROWSER)'
            }
            url={urlInput}
            onBypassWithOCR={() => {
              window.dispatchEvent(new CustomEvent('narada:switch-input-mode', { detail: { mode: 'image' } }))
            }}
            onLoadLocalSnapshot={() => {
              handleSelectDemoSample(DEMO_URL_SAMPLES[0])
            }}
            onPasteManualText={() => {
              setCorsFallbackActive(true)
            }}
          />
        )}

        {/* Notifikasi Pesan Kesalahan */}
        {errorMessage && !corsFallbackActive && (
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

        {/* Area Fallback CORS Browser */}
        {corsFallbackActive && (
          <div style={{
            marginTop: '14px',
            padding: '16px',
            background: 'var(--bg-elevated)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 'var(--radius-md)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--threat-medium)',
              marginBottom: '10px'
            }}>
              <ClipboardPaste size={14} /> INPUT MANUAL CEPAT (FALLBACK CORS BROWSER)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Judul Berita / Judul Halaman (Opsional)..."
                value={fallbackTitle}
                onChange={(e) => setFallbackTitle(e.target.value)}
              />
              <textarea
                className="form-control"
                placeholder="Salin dan tempel (paste) isi naskah berita dari tab browser Anda ke sini..."
                value={fallbackText}
                onChange={(e) => setFallbackText(e.target.value)}
                rows={6}
                style={{ minHeight: '120px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCorsFallbackActive(false)}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleApplyFallbackText}
                  disabled={!fallbackText.trim()}
                >
                  <CheckCircle2 size={13} />
                  Gunakan Naskah Berita Ini
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pratinjau Artikel yang Terambil */}
        {extractedArticle && (
          <div style={{
            marginTop: '16px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--bg-border)',
            borderRadius: 'var(--radius-md)',
            padding: '16px'
          }}>
            {/* Metadata Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  padding: '2px 8px',
                  borderRadius: '3px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: 'var(--accent-blue)',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}>
                  {extractedArticle.siteName || 'Portal Berita'}
                </span>
                {extractedArticle.author && (
                  <span style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <User size={11} /> {extractedArticle.author}
                  </span>
                )}
              </div>

              <span style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-dim)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Clock size={11} /> {new Date(extractedArticle.fetchedAt).toLocaleTimeString('id-ID')}
              </span>
            </div>

            {/* Title */}
            <h3 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '17px',
              fontWeight: '700',
              color: 'var(--text-primary)',
              lineHeight: '1.4',
              marginBottom: '10px'
            }}>
              {extractedArticle.title}
            </h3>

            {/* Link Asli */}
            <div style={{ marginBottom: '12px' }}>
              <a
                href={extractedArticle.url}
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
                {extractedArticle.url.substring(0, 60)}...
                <ExternalLink size={11} />
              </a>
            </div>

            {/* Cuplikan Konten */}
            <div style={{
              background: 'var(--bg-base)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--bg-border)',
              marginBottom: '16px',
              maxHeight: '160px',
              overflowY: 'auto'
            }}>
              <div style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <BookOpen size={11} /> TEKS BERITA TERKUTIP ({extractedArticle.content.split(/\s+/).filter(Boolean).length} kata):
              </div>
              <div style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: '1.7',
                whiteSpace: 'pre-line'
              }}>
                {extractedArticle.content}
              </div>
            </div>

            {/* Tombol Tindakan */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={handleProceedToAnalysis}
                disabled={isAnalyzing}
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
                    Lanjut Analisis Kognitif
                  </>
                )}
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-lg"
                onClick={handleReset}
                disabled={isAnalyzing}
              >
                <RotateCcw size={14} /> Ganti URL
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
