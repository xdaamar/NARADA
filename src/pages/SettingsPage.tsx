import { useState } from 'react'
import { Shield, Info, Save } from 'lucide-react'

export default function SettingsPage() {
  const [unit, setUnit] = useState('PUSSIBERAD TNI AD')
  const [analyst, setAnalyst] = useState('')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>
          Pengaturan Sistem
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Konfigurasi NARADA untuk satuan Anda
        </p>
      </div>

      <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Unit Config */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Shield size={12} style={{ display: 'inline', marginRight: '6px' }} />
              Identitas Satuan
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Nama Satuan</label>
              <input className="form-control" value={unit} onChange={e => setUnit(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Nama Analis Default</label>
              <input className="form-control" placeholder="Nama dan pangkat" value={analyst} onChange={e => setAnalyst(e.target.value)} />
            </div>
          </div>
        </div>

        {/* System Info */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Info size={12} style={{ display: 'inline', marginRight: '6px' }} />
              Informasi Sistem
            </div>
          </div>
          <div className="card-body">
            {[
              { label: 'Versi', value: 'NARADA v1.0.0' },
              { label: 'AI Engine', value: 'NARADA-NLP-ID (Rule-Based + Heuristic)' },
              { label: 'Mode Operasi', value: '100% Offline — Tanpa koneksi server' },
              { label: 'Database', value: 'Session Storage (Lokal)' },
              { label: 'Dikembangkan untuk', value: 'Kartika Cyber Hackathon 2026' },
              { label: 'Penyelenggara', value: 'PUSSIBERAD TNI AD × CODEPOLITAN' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', gap: '16px', padding: '8px 0', borderBottom: '1px solid var(--bg-border)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '160px', flexShrink: 0 }}>{item.label}</span>
                <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <button className="btn btn-primary" onClick={handleSave} style={{ alignSelf: 'flex-start' }}>
          <Save size={14} />
          {saved ? '✓ Tersimpan!' : 'Simpan Pengaturan'}
        </button>
      </div>
    </div>
  )
}
