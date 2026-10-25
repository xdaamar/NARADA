import { RotateCcw, Zap, AlertTriangle, Wifi, WifiOff } from 'lucide-react'
import type { NetworkTelemetryInfo } from '../utils/network'

export interface NetworkTelemetryBannerProps {
  telemetry: NetworkTelemetryInfo
  itemCount: number
  isSyncing: boolean
  onSync: () => void
}

export default function NetworkTelemetryBanner({
  telemetry,
  itemCount,
  isSyncing,
  onSync,
}: NetworkTelemetryBannerProps) {
  const isOnline = telemetry.status === 'ONLINE'
  const isDegraded = telemetry.status === 'DEGRADED'

  const formattedTime = new Date(telemetry.lastChecked).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: 'var(--radius-md)',
        marginBottom: '12px',
        border: isOnline
          ? '1px solid #A7F3D0'
          : isDegraded
          ? '1px solid #FCD34D'
          : '1px solid #FCA5A5',
        background: isOnline
          ? '#FFFFFF'
          : isDegraded
          ? '#FFFBEB'
          : '#FEF2F2',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        transition: 'all 0.3s ease',
      }}
    >
      {/* ─── Baris 1: Status Chip & Tombol Sinkronisasi ─── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Chip Status Telemetri */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: '700',
              background: isOnline
                ? 'rgba(34, 197, 94, 0.2)'
                : isDegraded
                ? 'rgba(245, 158, 11, 0.2)'
                : 'rgba(239, 68, 68, 0.2)',
              color: isOnline ? '#22C55E' : isDegraded ? '#F59E0B' : '#EF4444',
              border: `1px solid ${isOnline ? '#22C55E40' : isDegraded ? '#F59E0B40' : '#EF444450'}`,
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: isOnline ? '#22C55E' : isDegraded ? '#F59E0B' : '#EF4444',
                boxShadow: `0 0 8px ${isOnline ? '#22C55E' : isDegraded ? '#F59E0B' : '#EF4444'}`,
                display: 'inline-block',
              }}
            />
            {isOnline ? (
              <>
                <Wifi size={12} />
                <span>RADAR LIVE STREAMING · TERHUBUNG KE MAFINDO API</span>
              </>
            ) : isDegraded ? (
              <>
                <AlertTriangle size={12} />
                <span>RADAR TERDEGRADASI · KONEKSI LAMBAT / FALLBACK AKTIF</span>
              </>
            ) : (
              <>
                <WifiOff size={12} />
                <span>RADAR MODE OFFLINE · KONEKSI TERPUTUS</span>
              </>
            )}
          </div>

          {/* Subtext info */}
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {isOnline ? (
              <>
                Sinkronisasi Isu Harian Aktif · Diperbarui: <strong>{formattedTime} WIB</strong> (Latensi:{' '}
                <span style={{ color: '#22C55E', fontFamily: 'var(--font-mono)' }}>{telemetry.latencyMs} ms</span> ·{' '}
                <span style={{ fontFamily: 'var(--font-mono)' }}>{itemCount} Isu Terdata</span>)
              </>
            ) : isDegraded ? (
              <>
                Respons server API lambat ({telemetry.latencyMs} ms). Menampilkan{' '}
                <strong>Arsip Basis Pengetahuan Lokal PUSSIBERAD ({itemCount} Kasus)</strong>.
              </>
            ) : (
              <>
                Jaringan offline. Menampilkan <strong>Arsip Basis Pengetahuan Lokal PUSSIBERAD ({itemCount} Kasus)</strong>.
              </>
            )}
          </span>
        </div>

        {/* Tombol Aksi Sinkronisasi / Coba Hubungkan Ulang */}
        <button
          type="button"
          className={isOnline ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'}
          onClick={onSync}
          disabled={isSyncing}
          style={{
            fontSize: '11px',
            padding: '5px 12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: '600',
          }}
        >
          {isOnline ? (
            <>
              <RotateCcw size={12} className={isSyncing ? 'spin-animation' : ''} />
              <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Isu Hari Ini'}</span>
            </>
          ) : (
            <>
              <Zap size={12} className={isSyncing ? 'spin-animation' : ''} />
              <span>{isSyncing ? 'Menghubungkan...' : 'Coba Hubungkan Ulang'}</span>
            </>
          )}
        </button>
      </div>

      {/* ─── Baris 2: Kotak Kejujuran Taktis Terbuka (Khusus Offline / Degraded) ─── */}
      {!isOnline && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            fontSize: '11px',
            color: '#991B1B',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={14} color="#DC2626" style={{ flexShrink: 0 }} />
          <span>
            <strong>Kejujuran Data Intelijen:</strong> Sistem beroperasi dalam mode taktis lokal terisolasi (<em>air-gapped</em>).
            Data di bawah ini adalah <strong>arsip lokal tersimpan</strong>, bukan stream terkini hari ini.
          </span>
        </div>
      )}
    </div>
  )
}
