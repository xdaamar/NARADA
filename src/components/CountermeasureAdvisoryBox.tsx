import { useState } from 'react'
import {
  ShieldAlert,
  Users,
  Megaphone,
  Radio,
  Copy,
  Check
} from 'lucide-react'

interface CountermeasureAdvisoryBoxProps {
  threatLevel?: string
  cluster?: string
  claim?: string
  customAdvice?: string
}

export default function CountermeasureAdvisoryBox({
  threatLevel = 'critical',
  cluster = 'KEDAULATAN_MILITER',
  claim = '',
  customAdvice
}: CountermeasureAdvisoryBoxProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  // Penyesuaian rekomendasi taktis berdasarkan klaster spektrum
  const getBabinsaAction = () => {
    if (cluster === 'BENCANA_DARURAT') {
      return 'Laksanakan patroli dialogis teritorial darurat ke posko warga dan balai desa. Berikan edukasi lisan bahwa BMKG tidak pernah merilis prediksi jam gempa, serta tenangkan warga agar tidak panik mengungsi tanpa arahan BPBD.'
    }
    if (cluster === 'PENIPUAN_BANSOS') {
      return 'Kumpulkan ketua RT/RW dan perangkat desa binaan. Sosialisasikan bahwa pendaftaran bantuan tunai Kemensos hanya sah melalui dinas sosial dan cekbansos.kemensos.go.id, cegah warga menyerahkan data NIK atau OTP.'
    }
    if (cluster === 'POLITIK_NEGARA' || cluster === 'KEDAULATAN_MILITER') {
      return 'Gelar komunikasi sosial (Komsos) persuasif bersama para tokoh agama, tokoh adat, dan pemuda. Pastikan soliditas warga dan redam bibit polarisasi atau provokasi yang menyerang kewibawaan pimpinan negara dan TNI AD.'
    }
    return 'Laksanakan sambang warga binaan teritorial dan laporkan eskalasi sentimen ketertiban umum ke komando Danramil secara berkala.'
  }

  const getDispenadAction = () => {
    if (customAdvice) {
      return customAdvice
    }
    if (cluster === 'KEDAULATAN_MILITER') {
      return 'Terbitkan siaran pers resmi centang biru (@tni_angkatan_darat & @puspentni) dalam kurun waktu <2 jam dengan materi "FAKTA ALUTSISTA". Amplifikasikan dokumentasi autentik ke jejaring media mitra nasional.'
    }
    if (cluster === 'BENCANA_DARURAT') {
      return 'Koordinasikan penayangan running-text klarifikasi bersama BMKG di videotron perkotaan dan media penyiaran publik (TVRI/RRI) guna meredam histeria isu gempa malam hari.'
    }
    if (cluster === 'PENIPUAN_BANSOS') {
      return 'Rilis infografis peringatan kejahatan siber (Cyber Crime Alert) bersama Kemensos RI untuk disebarkan secara masif di feed media sosial dan portal berita online.'
    }
    return 'Siapkan naskah klarifikasi tanggap darurat narasi hoaks dan distribusikan kepada para penanggung jawab penerangan kotama jajaran.'
  }

  const getPussiberadAction = () => {
    if (cluster === 'PENIPUAN_BANSOS') {
      return 'Lakukan tracing DNS/WHOIS situs penipuan, ajukan permohonan pemblokiran darurat (DNS Poisoning/Takedown) ke TrustPositif Ditjen Aptika Kominfo, dan teruskan data rekening penampung ke Subdit Siber Polri.'
    }
    if (cluster === 'KEDAULATAN_MILITER' || cluster === 'POLITIK_NEGARA') {
      return 'Petakan simpul jaringan akun buzzer (seed accounts & amplifier botnet), ekspor paket bukti digital ke BSSN, dan ajukan laporan CIB (Coordinated Inauthentic Behavior) ke Meta & X Trust Team.'
    }
    return 'Laksanakan pemantauan spektrum telemetri lalu lintas tagar provokatif dan update basis data leksikon ancaman siber secara berkala.'
  }

  const actions = [
    {
      title: '1. Satuan Teritorial (Babinsa & Koramil)',
      level: 'LEVEL TAKTIS LAPANGAN',
      color: '#34D399',
      borderColor: '#059669',
      bg: 'rgba(16, 185, 129, 0.1)',
      icon: Users,
      desc: getBabinsaAction(),
    },
    {
      title: '2. Satuan Penerangan (Dispenad & Pendam)',
      level: 'LEVEL STRATEGIS KONTRA-NARASI',
      color: '#38BDF8',
      borderColor: '#0284C7',
      bg: 'rgba(56, 189, 248, 0.1)',
      icon: Megaphone,
      desc: getDispenadAction(),
    },
    {
      title: '3. Satuan Siber (Pussiberad & Insan Siber)',
      level: 'LEVEL TEKNIS PENINDAKAN SIBER',
      color: '#EF4444',
      borderColor: '#DC2626',
      bg: 'rgba(239, 68, 68, 0.1)',
      icon: Radio,
      desc: getPussiberadAction(),
    }
  ]

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  return (
    <div
      className="steel-chassis-card"
      style={{
        marginTop: '16px',
        marginBottom: '16px',
        padding: '18px 20px',
        position: 'relative'
      }}
    >
      <span className="bolt-tl" />
      <span className="bolt-tr" />
      <span className="bolt-bl" />
      <span className="bolt-br" />

      {/* Header Kotak Rekomendasi Militer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldAlert size={18} color="#D4AF37" />
          <span style={{ fontSize: '12px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#F1F5F9', letterSpacing: '0.8px' }}>
            COUNTERMEASURE ADVISORY: REKOMENDASI TINDAKAN OPERASIONAL BERJENJANG TNI AD
          </span>
        </div>

        <span
          title={claim ? `Klaim Terdeteksi: ${claim}` : undefined}
          style={{
            fontSize: '9px',
            fontFamily: 'var(--font-mono)',
            padding: '2px 8px',
            borderRadius: '3px',
            background: 'rgba(212, 175, 55, 0.15)',
            border: '1px solid rgba(212, 175, 55, 0.4)',
            color: '#FDE047',
            fontWeight: 700
          }}
        >
          {threatLevel.toUpperCase()} // DOKTRIN PUSSIBERAD × DISPENAD
        </span>
      </div>

      {/* 3 Kartu Berjenjang */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
        {actions.map((act, idx) => {
          const Icon = act.icon
          const isCopied = copiedIndex === idx
          return (
            <div
              key={idx}
              className="steel-sunken-tray"
              style={{
                padding: '14px',
                borderLeft: `4px solid ${act.borderColor}`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '10px'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: act.color, fontWeight: 700 }}>
                    {act.level}
                  </span>
                  <Icon size={14} color={act.color} />
                </div>

                <div style={{ fontSize: '12px', fontWeight: 800, color: '#F8FAFC', marginBottom: '6px' }}>
                  {act.title}
                </div>

                <p style={{ fontSize: '11px', color: '#CBD5E1', lineHeight: 1.45, margin: 0 }}>
                  {act.desc}
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <button
                  type="button"
                  onClick={() => handleCopy(act.desc, idx)}
                  style={{
                    padding: '3px 8px',
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    background: isCopied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: isCopied ? '1px solid #10B981' : '1px solid #28374A',
                    color: isCopied ? '#6EE7B7' : '#94A3B8',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {isCopied ? <Check size={10} color="#10B981" /> : <Copy size={10} />}
                  {isCopied ? 'Tersalin' : 'Salin Instruksi'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
