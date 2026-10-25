import { ShieldAlert, Camera, Zap, FileText, Keyboard } from 'lucide-react'

interface ResilientIngestionBannerProps {
  platformName?: string
  url?: string
  onBypassWithOCR?: () => void
  onLoadLocalSnapshot?: () => void
  onPasteManualText?: () => void
}

export default function ResilientIngestionBanner({
  platformName = 'MEDIA SOSIAL',
  url,
  onBypassWithOCR,
  onLoadLocalSnapshot,
  onPasteManualText
}: ResilientIngestionBannerProps) {
  return (
    <div
      className="steel-chassis-card"
      style={{
        marginTop: '12px',
        marginBottom: '14px',
        padding: '16px 20px',
        position: 'relative',
        background: 'linear-gradient(175deg, rgba(30, 39, 51, 0.95) 0%, rgba(18, 24, 33, 0.98) 100%)',
        border: '1px solid #3B4D63',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
      }}
    >
      <span className="bolt-tl" />
      <span className="bolt-tr" />
      <span className="bolt-bl" />
      <span className="bolt-br" />

      {/* Header Banner */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '6px',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <ShieldAlert size={20} color="#F59E0B" />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                color: '#FEF08A',
                letterSpacing: '0.8px',
                textTransform: 'uppercase'
              }}
            >
              PROTOKOL PROTEKSI PLATFORM TERDETEKSI (AUTHENTICATION WALL / BOT GATE)
            </span>
            <span
              style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                color: '#38BDF8',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                padding: '1px 5px',
                borderRadius: '3px'
              }}
            >
              PALANTIR PATTERN
            </span>
          </div>

          <p style={{ fontSize: '11px', color: '#CBD5E1', margin: '4px 0 0 0', lineHeight: 1.45 }}>
            Tautan target {url ? <code style={{ color: '#FCD34D', fontSize: '10px' }}>({url.length > 45 ? url.substring(0, 45) + '...' : url})</code> : ''} pada platform <strong style={{ color: '#FFF' }}>{platformName}</strong> dipagari oleh login-wall komersial atau pembatasan cross-origin browser. Sistem NARADA mengaktifkan jalur ketahanan ingesti multi-tier untuk menjamin analisis tetap berjalan tanpa kegagalan koneksi.
          </p>
        </div>
      </div>

      {/* 2 Tombol Aksi Bypass Taktis */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {onBypassWithOCR && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onBypassWithOCR}
            style={{
              padding: '7px 14px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#C8102E',
              borderColor: '#DC2626'
            }}
          >
            <Camera size={13} />
            BYPASS DENGAN SCREENSHOT (OCR NEURAL)
          </button>
        )}

        {onLoadLocalSnapshot && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onLoadLocalSnapshot}
            style={{
              padding: '7px 14px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#141D29',
              borderColor: '#29394D',
              color: '#38BDF8'
            }}
          >
            <Zap size={13} color="#38BDF8" />
            MUAT TACTICAL SNAPSHOT LOKAL
          </button>
        )}

        {onPasteManualText && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onPasteManualText}
            style={{
              padding: '7px 14px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FileText size={13} />
            Tempel Naskah Manual
          </button>
        )}
      </div>

      {/* Smart Tip Box */}
      <div
        className="steel-sunken-tray"
        style={{
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
          color: '#94A3B8'
        }}
      >
        <Keyboard size={14} color="#D4AF37" style={{ flexShrink: 0 }} />
        <div>
          <strong style={{ color: '#F1F5F9' }}>💡 Tip Pintar Analis:</strong> Tekan{' '}
          <code style={{ background: '#1E293B', color: '#FDE047', padding: '1px 4px', borderRadius: '3px' }}>
            Win + Shift + S
          </code>{' '}
          pada Windows untuk cuplik screenshot postingan medsos, lalu tekan{' '}
          <code style={{ background: '#1E293B', color: '#FDE047', padding: '1px 4px', borderRadius: '3px' }}>
            Ctrl + V
          </code>{' '}
          di jendela mana saja pada NARADA untuk ekstraksi teks seketika secara offline!
        </div>
      </div>
    </div>
  )
}
