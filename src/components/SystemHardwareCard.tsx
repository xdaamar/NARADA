import { memo } from 'react'
import { Cpu, Activity, Zap } from 'lucide-react'

export interface HardwareSpecs {
  cpuModel: string
  cpuCores: number
  gpuModel: string
  totalRamGB: number
}

export interface TelemetrySample {
  cpuPercent: number
  ramPercent: number
  usedRamGB: number
  freeRamGB: number
  totalRamGB: number
}

interface SparklineProps {
  data: number[]
  color: string
  id: string
  height?: number
}

function SparklineWaveform({ data, color, id, height = 28 }: SparklineProps) {
  const width = 200
  if (!data || data.length < 2) return null

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width
    const clamped = Math.max(0, Math.min(100, val))
    const y = (height - 3) - (clamped / 100) * (height - 6)
    return { x, y }
  })

  const lineD = points.reduce(
    (acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`,
    ''
  )
  const areaD = `${lineD} L ${width},${height} L 0,${height} Z`
  const latestPt = points[points.length - 1]

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: `${height}px`,
        background: '#04070B',
        borderRadius: '3px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <defs>
          <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Tactical Grid Lines (Task Manager ECG style) */}
        <line
          x1="0"
          y1={height * 0.33}
          x2={width}
          y2={height * 0.33}
          stroke="rgba(255, 255, 255, 0.07)"
          strokeDasharray="3 3"
        />
        <line
          x1="0"
          y1={height * 0.66}
          x2={width}
          y2={height * 0.66}
          stroke="rgba(255, 255, 255, 0.07)"
          strokeDasharray="3 3"
        />
        <line
          x1="50"
          y1="0"
          x2="50"
          y2={height}
          stroke="rgba(255, 255, 255, 0.04)"
          strokeDasharray="2 2"
        />
        <line
          x1="100"
          y1="0"
          x2="100"
          y2={height}
          stroke="rgba(255, 255, 255, 0.04)"
          strokeDasharray="2 2"
        />
        <line
          x1="150"
          y1="0"
          x2="150"
          y2={height}
          stroke="rgba(255, 255, 255, 0.04)"
          strokeDasharray="2 2"
        />

        {/* Translucent Area Fill */}
        <path d={areaD} fill={`url(#grad-${id})`} />

        {/* Oscilloscope Waveform Stroke */}
        <path
          d={lineD}
          fill="none"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Real-time leading pulse dot */}
        <circle
          cx={latestPt.x}
          cy={latestPt.y}
          r="2.5"
          fill={color}
          style={{ filter: `drop-shadow(0 0 3px ${color})` }}
        />
      </svg>
    </div>
  )
}

interface SystemHardwareCardProps {
  specs: HardwareSpecs
  telemetry: TelemetrySample
  ramHistory: number[]
  cpuHistory: number[]
  isSystemOnline: boolean
}

export const SystemHardwareCard = memo(function SystemHardwareCard({
  specs,
  telemetry,
  ramHistory,
  cpuHistory,
  isSystemOnline
}: SystemHardwareCardProps) {
  const statusColor = isSystemOnline ? '#10B981' : '#EF4444'
  const statusText = isSystemOnline ? 'ONLINE' : 'OFFLINE'

  // Clean CPU Model string for display
  const cleanedCpu = specs.cpuModel
    .replace(/with\s+Radeon\s+Graphics/i, '')
    .replace(/CPU\s*@.*$/i, '')
    .trim()

  return (
    <div
      className="steel-chassis-card"
      style={{
        padding: '10px 12px',
        position: 'relative',
        borderRadius: '7px',
        border: '1px solid #2A3649',
        boxShadow:
          'inset 0 1px 1px rgba(255, 255, 255, 0.15), 0 8px 24px rgba(0, 0, 0, 0.85)'
      }}
    >
      {/* 4 Baut Allen Hex Socket di 4 Sudut Plat Baja */}
      <div className="bolt-tl" />
      <div className="bolt-tr" />
      <div className="bolt-bl" />
      <div className="bolt-br" />

      {/* Header Plat Baja: Judul Telemetri + Status ONLINE/OFFLINE Terintegrasi */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '5px',
          marginBottom: '7px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Zap size={11} color="var(--accent-gold)" />
          <span
            style={{
              fontSize: '9px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              color: 'var(--accent-gold)',
              letterSpacing: '1px'
            }}
          >
            /// TELEMETRI MESIN
          </span>
        </div>

        {/* Status Online/Offline Terintegrasi di Dalam Card Besi */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: statusColor,
              boxShadow: `0 0 6px ${statusColor}`
            }}
          />
          <span
            style={{
              fontSize: '9px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              color: statusColor,
              letterSpacing: '0.8px'
            }}
          >
            {statusText}
          </span>
        </div>
      </div>

      {/* ─── RAM WAVEFORM SECTION (Cyan) ─── */}
      <div style={{ marginBottom: '6px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '3px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Activity size={10} color="#38BDF8" />
            <span
              style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                color: '#38BDF8',
                fontWeight: 800,
                letterSpacing: '0.5px'
              }}
            >
              RAM
            </span>
          </div>
          <span
            style={{
              fontSize: '8.5px',
              fontFamily: 'var(--font-mono)',
              color: '#F1F5F9',
              fontWeight: 700
            }}
          >
            {telemetry.usedRamGB} / {telemetry.totalRamGB} GB ({telemetry.ramPercent}%)
          </span>
        </div>
        <SparklineWaveform
          data={ramHistory}
          color="#38BDF8"
          id="sidebar-ram"
          height={26}
        />
      </div>

      {/* ─── CPU WAVEFORM SECTION (Emerald / Dynamic) ─── */}
      <div style={{ marginBottom: '7px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '3px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Cpu
              size={10}
              color={telemetry.cpuPercent > 80 ? '#EF4444' : '#10B981'}
            />
            <span
              style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                color: telemetry.cpuPercent > 80 ? '#EF4444' : '#10B981',
                fontWeight: 800,
                letterSpacing: '0.5px'
              }}
            >
              CPU
            </span>
          </div>
          <span
            style={{
              fontSize: '8.5px',
              fontFamily: 'var(--font-mono)',
              color: '#F1F5F9',
              fontWeight: 700
            }}
          >
            {telemetry.cpuPercent}% ({specs.cpuCores}T)
          </span>
        </div>
        <SparklineWaveform
          data={cpuHistory}
          color={
            telemetry.cpuPercent > 80
              ? '#EF4444'
              : telemetry.cpuPercent > 50
              ? '#F59E0B'
              : '#10B981'
          }
          id="sidebar-cpu"
          height={26}
        />
      </div>

      {/* ─── DETEKSI CHIPSET HARDWARE (Intel / AMD / NVIDIA / Radeon) ─── */}
      <div
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          paddingTop: '5px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '4px'
          }}
        >
          <span
            style={{
              fontSize: '8px',
              fontFamily: 'var(--font-mono)',
              color: '#94A3B8',
              fontWeight: 700
            }}
          >
            CHIP:
          </span>
          <span
            style={{
              fontSize: '8.5px',
              fontFamily: 'var(--font-mono)',
              color: '#CBD5E1',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '160px'
            }}
            title={specs.cpuModel}
          >
            {cleanedCpu}
          </span>
        </div>

        {specs.gpuModel && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '4px'
            }}
          >
            <span
              style={{
                fontSize: '8px',
                fontFamily: 'var(--font-mono)',
                color: '#94A3B8',
                fontWeight: 700
              }}
            >
              GPU:
            </span>
            <span
              style={{
                fontSize: '8.5px',
                fontFamily: 'var(--font-mono)',
                color: '#D4AF37',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '160px'
              }}
              title={specs.gpuModel}
            >
              {specs.gpuModel}
            </span>
          </div>
        )}
      </div>
    </div>
  )
})
