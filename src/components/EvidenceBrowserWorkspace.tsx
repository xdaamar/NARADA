/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — INTEGRATED EVIDENCE BROWSER WORKSPACE (Sprint 7)
 * PUSSIBERAD TNI AD × CODEPOLITAN — KARTIKA CYBER HACKATHON 2026
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Komponen Antarmuka Browser Bukti Digital Terisolasi untuk Investigasi Kasus.
 * ══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  X,
  Camera,
  Shield,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Hash,
  Globe
} from 'lucide-react'
import type { InvestigationCase, EvidenceRecord } from '../engine/investigation/investigation-types.ts'
import {
  createBrowserEvidenceRecord,
  addEvidenceRecord
} from '../engine/investigation'

interface EvidenceBrowserWorkspaceProps {
  activeCase: InvestigationCase
  onClose: () => void
  onEvidenceSaved: (record: EvidenceRecord) => void
}

interface CapturePreviewPayload {
  caseId: string
  finalUrl: string
  canonicalUrl?: string
  pageTitle: string
  siteName?: string
  author?: string
  publishedAtRaw?: string
  description?: string
  selectedText: string
  selectedTextStatus: 'present' | 'empty' | 'truncated'
  selectedTextLength: number
  isTruncated: boolean
  screenshotDataUrl?: string
  screenshotByteSha256?: string
  selectedTextByteSha256?: string
  manifestSha256?: string
  capturedAt: string
}

export default function EvidenceBrowserWorkspace({
  activeCase,
  onClose,
  onEvidenceSaved
}: EvidenceBrowserWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isElectron = typeof window !== 'undefined' && Boolean(window.naradaEvidenceBrowser?.isElectron)

  const [urlInput, setUrlInput] = useState<string>('https://antaranews.com')
  const [currentUrl, setCurrentUrl] = useState<string>('')
  const [currentTitle, setCurrentTitle] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [canGoBack, setCanGoBack] = useState<boolean>(false)
  const [canGoForward, setCanGoForward] = useState<boolean>(false)
  const [blockedNotice, setBlockedNotice] = useState<string | null>(null)
  const [reviewPayload, setReviewPayload] = useState<CapturePreviewPayload | null>(null)
  const [isSaving, setIsSaving] = useState<boolean>(false)

  // State untuk Fallback Mode di Browser Web Standar
  const [webSimulatedText, setWebSimulatedText] = useState<string>('')
  const [webSimulatedTitle, setWebSimulatedTitle] = useState<string>('')

  // ─── 1. Sinkronisasi Ukuran Bounds ke Electron WebContentsView ───
  const updateBounds = useCallback(() => {
    if (!isElectron || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    // Pastikan ukuran valid
    if (rect.width > 50 && rect.height > 50) {
      window.naradaEvidenceBrowser?.setBounds({
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      })
    }
  }, [isElectron])

  // ─── 2. Lifecycle Browser View ───
  useEffect(() => {
    if (!isElectron) return

    // Inisialisasi Browser View di Electron
    const initBrowser = async () => {
      try {
        const rect = containerRef.current?.getBoundingClientRect()
        const bounds = rect && rect.width > 50 && rect.height > 50
          ? {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            }
          : { x: 280, y: 120, width: 900, height: 600 }

        await window.naradaEvidenceBrowser?.open({
          caseId: activeCase.id,
          bounds
        })

        // Navigasi awal ke URL default
        if (urlInput) {
          await window.naradaEvidenceBrowser?.navigate(urlInput)
        }
      } catch (err: any) {
        console.warn('[EvidenceBrowserWorkspace] Inisialisasi gagal:', err.message)
      }
    }

    initBrowser()

    // Listener State Change dari Electron Main Process
    const cleanupListener = window.naradaEvidenceBrowser?.onStateChange((data: any) => {
      if (data.state === 'loading') {
        setIsLoading(Boolean(data.isLoading))
      } else if (data.state === 'navigated' || data.state === 'navigated-in-page') {
        setCurrentUrl(data.currentUrl || '')
        setUrlInput(data.currentUrl || '')
        setCurrentTitle(data.currentTitle || '')
        setCanGoBack(Boolean(data.canGoBack))
        setCanGoForward(Boolean(data.canGoForward))
        setBlockedNotice(null)
      } else if (data.state === 'title-updated') {
        setCurrentTitle(data.currentTitle || '')
      } else if (data.state === 'navigation-blocked') {
        setBlockedNotice(data.reason || 'Navigasi ke tujuan diblokir oleh kebijakan keamanan.')
      } else if (data.state === 'popup-blocked') {
        setBlockedNotice('Pembuatan jendela/popup baru diblokir demi keamanan.')
      }
    })

    window.addEventListener('resize', updateBounds)
    window.addEventListener('scroll', updateBounds)

    return () => {
      window.removeEventListener('resize', updateBounds)
      window.removeEventListener('scroll', updateBounds)
      if (cleanupListener) cleanupListener()
      window.naradaEvidenceBrowser?.close().catch(() => {})
    }
  }, [activeCase.id, isElectron, updateBounds])

  // Perbarui bounds saat container siap
  useEffect(() => {
    const timer = setTimeout(updateBounds, 100)
    return () => clearTimeout(timer)
  }, [updateBounds])

  // Sembunyikan WebContentsView saat modal review terbuka agar tidak menutupi modal
  useEffect(() => {
    if (isElectron) {
      window.naradaEvidenceBrowser?.setVisible(!reviewPayload)
    }
  }, [isElectron, reviewPayload])

  // ─── 3. Aksi Kontrol Navigasi ───
  const handleNavigate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setBlockedNotice(null)
    if (!urlInput.trim()) return

    if (isElectron) {
      const res = await window.naradaEvidenceBrowser?.navigate(urlInput.trim())
      if (res && !res.success) {
        setBlockedNotice(res.reason || 'Navigasi gagal')
      }
    } else {
      // Fallback web: catat URL
      setCurrentUrl(urlInput.trim())
      setCurrentTitle(`Simulasi: ${urlInput.trim()}`)
    }
  }

  const handleGoBack = () => {
    if (isElectron) window.naradaEvidenceBrowser?.goBack()
  }

  const handleGoForward = () => {
    if (isElectron) window.naradaEvidenceBrowser?.goForward()
  }

  const handleReload = () => {
    if (isElectron) window.naradaEvidenceBrowser?.reload()
  }

  const handleStop = () => {
    if (isElectron) window.naradaEvidenceBrowser?.stop()
  }

  // ─── 4. Aksi Pengambilan Bukti (Capture) ───
  const handleTriggerCapture = async () => {
    if (isElectron) {
      try {
        setIsLoading(true)
        const payload = await window.naradaEvidenceBrowser?.prepareCapture()
        setIsLoading(false)
        if (payload && payload.success) {
          setReviewPayload({
            caseId: activeCase.id,
            finalUrl: payload.finalUrl || currentUrl,
            canonicalUrl: payload.canonicalUrl,
            pageTitle: payload.pageTitle || currentTitle || 'Halaman Web',
            siteName: payload.siteName,
            author: payload.author,
            publishedAtRaw: payload.publishedAtRaw,
            description: payload.description,
            selectedText: payload.selectedText || '',
            selectedTextStatus: payload.selectedTextStatus,
            selectedTextLength: payload.selectedTextLength || 0,
            isTruncated: payload.isTruncated || false,
            screenshotDataUrl: payload.screenshotDataUrl,
            screenshotByteSha256: payload.screenshotByteSha256,
            selectedTextByteSha256: payload.selectedTextByteSha256,
            manifestSha256: payload.manifestSha256,
            capturedAt: payload.capturedAt || new Date().toISOString()
          })
        }
      } catch (err: any) {
        setIsLoading(false)
        setBlockedNotice('Gagal mengekstraksi bukti: ' + err.message)
      }
    } else {
      // Fallback web simulation mode
      const now = new Date().toISOString()
      setReviewPayload({
        caseId: activeCase.id,
        finalUrl: urlInput || 'https://antaranews.com',
        pageTitle: webSimulatedTitle || 'LKBN ANTARA — Berita Nasional',
        siteName: 'Antaranews.com',
        author: 'Redaksi Pers',
        publishedAtRaw: '01 Nov 2026 15:30 WIB',
        description: 'Simulasi kutipan berita investigasi untuk pengujian web.',
        selectedText: webSimulatedText || 'Kutipan teks yang dipilih secara manual oleh analis.',
        selectedTextStatus: 'present',
        selectedTextLength: (webSimulatedText || '').length,
        isTruncated: false,
        capturedAt: now
      })
    }
  }

  // ─── 5. Simpan Bukti Terverifikasi ke Kasus ───
  const handleCommitEvidence = async () => {
    if (!reviewPayload || isSaving) return
    setIsSaving(true)

    try {
      const record = createBrowserEvidenceRecord({
        caseId: activeCase.id,
        finalUrl: reviewPayload.finalUrl,
        canonicalUrl: reviewPayload.canonicalUrl,
        pageTitle: reviewPayload.pageTitle,
        siteName: reviewPayload.siteName,
        author: reviewPayload.author,
        publishedAtRaw: reviewPayload.publishedAtRaw,
        description: reviewPayload.description,
        selectedText: reviewPayload.selectedText,
        selectedTextStatus: reviewPayload.selectedTextStatus,
        selectedTextByteSha256: reviewPayload.selectedTextByteSha256,
        screenshotDataUrl: reviewPayload.screenshotDataUrl,
        screenshotByteSha256: reviewPayload.screenshotByteSha256,
        manifestSha256: reviewPayload.manifestSha256,
        capturedBy: 'OPERATOR_ANALIS_PUSSIBERAD'
      })

      addEvidenceRecord(record, 'Operator Analis NARADA')
      onEvidenceSaved(record)
      setReviewPayload(null)
      setIsSaving(false)
      onClose()
    } catch (err: any) {
      setIsSaving(false)
      alert('Gagal menyimpan bukti ke kasus: ' + err.message)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0B0F17',
        border: '1px solid rgba(212, 175, 55, 0.3)',
        borderRadius: '8px',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* ─── Top Control Bar ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: 'linear-gradient(180deg, #131B26 0%, #0F1722 100%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 10
        }}
      >
        {/* Tombol Back / Forward */}
        <button
          type="button"
          onClick={handleGoBack}
          disabled={!canGoBack}
          title="Kembali (Back)"
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '4px',
            color: canGoBack ? '#F1F5F9' : '#475569',
            padding: '6px',
            cursor: canGoBack ? 'pointer' : 'default',
            display: 'flex'
          }}
        >
          <ArrowLeft size={16} />
        </button>

        <button
          type="button"
          onClick={handleGoForward}
          disabled={!canGoForward}
          title="Maju (Forward)"
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '4px',
            color: canGoForward ? '#F1F5F9' : '#475569',
            padding: '6px',
            cursor: canGoForward ? 'pointer' : 'default',
            display: 'flex'
          }}
        >
          <ArrowRight size={16} />
        </button>

        <button
          type="button"
          onClick={isLoading ? handleStop : handleReload}
          title={isLoading ? 'Hentikan Pemuatan' : 'Muat Ulang Halaman'}
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '4px',
            color: '#F1F5F9',
            padding: '6px',
            cursor: 'pointer',
            display: 'flex'
          }}
        >
          {isLoading ? <X size={16} color="#EF4444" /> : <RotateCw size={16} />}
        </button>

        {/* Address Bar */}
        <form
          onSubmit={handleNavigate}
          style={{ display: 'flex', flex: 1, alignItems: 'center', position: 'relative' }}
        >
          <Globe
            size={14}
            color="#64748B"
            style={{ position: 'absolute', left: '10px' }}
          />
          <input
            type="text"
            className="form-control"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Masukkan URL publik (https://...)"
            style={{
              width: '100%',
              paddingLeft: '32px',
              paddingRight: '64px',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              background: '#090D14',
              color: '#F1F5F9',
              border: blockedNotice ? '1px solid #EF4444' : '1px solid rgba(212, 175, 55, 0.25)',
              borderRadius: '4px',
              height: '32px'
            }}
          />
          <button
            type="submit"
            style={{
              position: 'absolute',
              right: '4px',
              background: '#D4AF37',
              color: '#0F172A',
              border: 'none',
              borderRadius: '3px',
              fontSize: '10px',
              fontWeight: 700,
              padding: '3px 8px',
              cursor: 'pointer'
            }}
          >
            BUKA
          </button>
        </form>

        {/* Badge Kasus & Sesi */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#10B981',
            fontWeight: 600,
            whiteSpace: 'nowrap'
          }}
        >
          <Shield size={13} />
          <span>{activeCase.caseNumber || 'KASUS'}</span>
        </div>

        {/* Tombol Ambil Bukti */}
        <button
          type="button"
          onClick={handleTriggerCapture}
          disabled={isLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'linear-gradient(135deg, #D4AF37 0%, #AA820A 100%)',
            color: '#0B0F17',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 14px',
            fontSize: '11px',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(212, 175, 55, 0.25)',
            whiteSpace: 'nowrap'
          }}
        >
          <Camera size={15} />
          <span>AMBIL BUKTI</span>
        </button>

        {/* Tombol Tutup */}
        <button
          type="button"
          onClick={onClose}
          title="Tutup Browser Bukti"
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#EF4444',
            borderRadius: '4px',
            padding: '6px',
            cursor: 'pointer',
            display: 'flex'
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* ─── Banner Peringatan Keamanan / Navigasi Terblokir ─── */}
      {blockedNotice && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            borderBottom: '1px solid rgba(239, 68, 68, 0.4)',
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#FCA5A5',
            zIndex: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={14} color="#EF4444" />
            <span>{blockedNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setBlockedNotice(null)}
            style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer' }}
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* ─── Browser Viewport Container ─── */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          background: '#090D14',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Konten untuk Fallback Mode di Browser Non-Desktop */}
        {!isElectron && (
          <div style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
            <div
              style={{
                background: 'rgba(212, 175, 55, 0.08)',
                border: '1px solid rgba(212, 175, 55, 0.25)',
                borderRadius: '6px',
                padding: '16px',
                marginBottom: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <ShieldCheck size={18} color="#D4AF37" />
                <span style={{ fontWeight: 700, color: '#F1F5F9', fontSize: '13px' }}>
                  SIMULATOR EVIDENCE BROWSER (LINGKUNGAN WEB)
                </span>
              </div>
              <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                Tampilan Chromium <code>WebContentsView</code> terisolasi aktif penuh saat aplikasi dijalankan dalam mode Desktop Electron (<code>npm run electron:dev</code>).
                Di browser standar, Anda dapat menguji alur peninjauan bukti, kalkulasi SHA-256 byte-level, dan penyimpanan ke kasus menggunakan input simulasi di bawah:
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>Judul Halaman Publik</label>
                <input
                  type="text"
                  className="form-control"
                  value={webSimulatedTitle}
                  onChange={e => setWebSimulatedTitle(e.target.value)}
                  placeholder="e.g. Hashim Tegaskan Pajak Digital Tidak Menyasar UMKM"
                  style={{ width: '100%', fontSize: '12px', marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>Kutipan Teks Pilihan Analis (Selection)</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={webSimulatedText}
                  onChange={e => setWebSimulatedText(e.target.value)}
                  placeholder="Sorot atau tempelkan teks kutipan penting yang akan disimpan sebagai bukti..."
                  style={{ width: '100%', fontSize: '12px', marginTop: '4px' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Modal Review-Before-Save (Peninjauan Bukti Sebelum Disimpan) ─── */}
      {reviewPayload && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(8, 12, 19, 0.92)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 100
          }}
        >
          <div
            style={{
              background: '#0F1722',
              border: '1px solid rgba(212, 175, 55, 0.4)',
              borderRadius: '8px',
              width: '100%',
              maxWidth: '750px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Header Modal Review */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                background: '#131B26'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} color="#D4AF37" />
                <span style={{ fontWeight: 800, color: '#F1F5F9', fontSize: '13px', letterSpacing: '0.5px' }}>
                  PENINJAUAN BUKTI DIGITAL SEBELUM DISIMPAN (REVIEW CAPTURE)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setReviewPayload(null)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Isi Detail Bukti */}
            <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Info Kasus Target */}
              <div
                style={{
                  background: 'rgba(212, 175, 55, 0.08)',
                  border: '1px solid rgba(212, 175, 55, 0.2)',
                  borderRadius: '4px',
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: '10px', color: '#D4AF37', fontWeight: 700 }}>KASUS TARGET INVESTIGASI</div>
                  <div style={{ fontSize: '12px', color: '#F1F5F9', fontWeight: 700 }}>
                    {activeCase.caseNumber} — {activeCase.title}
                  </div>
                </div>
                <div style={{ fontSize: '10px', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                  ID: {activeCase.id}
                </div>
              </div>

              {/* URL & Judul Halaman */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>URL HALAMAN RESMI TERAMBIL</div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#38BDF8',
                      fontFamily: 'var(--font-mono)',
                      wordBreak: 'break-all'
                    }}
                  >
                    {reviewPayload.finalUrl}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>JUDUL HALAMAN (PAGE TITLE)</div>
                  <div style={{ fontSize: '12px', color: '#F1F5F9', fontWeight: 600 }}>
                    {reviewPayload.pageTitle}
                  </div>
                </div>
              </div>

              {/* Cuplikan Screenshot Jika Ada */}
              {reviewPayload.screenshotDataUrl && (
                <div>
                  <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600, marginBottom: '4px' }}>
                    TANGKAPAN LAYAR VIEWPORT (SCREENSHOT PNG)
                  </div>
                  <div
                    style={{
                      maxHeight: '180px',
                      overflow: 'hidden',
                      borderRadius: '4px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      background: '#090D14',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <img
                      src={reviewPayload.screenshotDataUrl}
                      alt="Viewport Screenshot Preview"
                      style={{ width: '100%', height: 'auto', objectFit: 'contain' }}
                    />
                  </div>
                </div>
              )}

              {/* Teks Seleksi */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>
                    TEKS TERPILIH (MANUAL SELECTION)
                  </div>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>
                    {reviewPayload.selectedTextLength} Karakter {reviewPayload.isTruncated && '(Dibatasi 50.000)'}
                  </div>
                </div>
                <div
                  style={{
                    background: '#090D14',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '4px',
                    padding: '8px 12px',
                    fontSize: '11px',
                    color: reviewPayload.selectedText ? '#E2E8F0' : '#64748B',
                    maxHeight: '100px',
                    overflowY: 'auto',
                    lineHeight: 1.5,
                    fontStyle: reviewPayload.selectedText ? 'normal' : 'italic'
                  }}
                >
                  {reviewPayload.selectedText || 'Tidak ada teks yang disorot saat pengambilan bukti.'}
                </div>
              </div>

              {/* Checksum SHA-256 Integritas */}
              <div
                style={{
                  background: '#090D14',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '4px',
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#D4AF37', fontWeight: 700 }}>
                  <Hash size={12} />
                  <span>CHECKSUM FORENSIK SHA-256 (DETERMINISTIK)</span>
                </div>
                {reviewPayload.screenshotByteSha256 && (
                  <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#94A3B8' }}>
                    <span style={{ color: '#64748B' }}>Screenshot SHA-256: </span>
                    {reviewPayload.screenshotByteSha256}
                  </div>
                )}
                {reviewPayload.selectedTextByteSha256 && (
                  <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#94A3B8' }}>
                    <span style={{ color: '#64748B' }}>Teks UTF-8 SHA-256: </span>
                    {reviewPayload.selectedTextByteSha256}
                  </div>
                )}
                {reviewPayload.manifestSha256 && (
                  <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#94A3B8' }}>
                    <span style={{ color: '#64748B' }}>Manifest SHA-256: </span>
                    {reviewPayload.manifestSha256}
                  </div>
                )}
              </div>

              {/* Pernyataan Batasan OSINT */}
              <div
                style={{
                  fontSize: '10px',
                  color: '#64748B',
                  lineHeight: 1.4,
                  borderLeft: '2px solid #D4AF37',
                  paddingLeft: '8px'
                }}
              >
                Pemberitahuan Forensik: Stempel waktu, penulis, dan metadata bersumber langsung dari halaman web publik (source-reported), bukan hasil verifikasi independen NARADA. Checksum SHA-256 membuktikan integritas biner pasca-akuisisi.
              </div>
            </div>

            {/* Footer Aksi */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
                padding: '12px 18px',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                background: '#131B26'
              }}
            >
              <button
                type="button"
                onClick={() => setReviewPayload(null)}
                disabled={isSaving}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '4px',
                  color: '#94A3B8',
                  padding: '6px 14px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                BATALKAN
              </button>

              <button
                type="button"
                onClick={handleCommitEvidence}
                disabled={isSaving}
                style={{
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#FFFFFF',
                  padding: '6px 18px',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: isSaving ? 'default' : 'pointer',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <CheckCircle2 size={14} />
                <span>{isSaving ? 'MENYIMPAN...' : 'SIMPAN KE KASUS'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
