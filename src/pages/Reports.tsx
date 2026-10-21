import { useState } from 'react'
import { FileText, Download, AlertTriangle } from 'lucide-react'
import type { AnalysisResult } from '../types'

// ─── Get stored analyses ───
function getStoredAnalyses(): AnalysisResult[] {
  try { return JSON.parse(sessionStorage.getItem('narada_analyses') || '[]') } catch { return [] }
}

// ─── Report Config ───
interface ReportConfig {
  unit: string
  analyst: string
  classification: string
  includeHistory: boolean
  reportNumber: string
}

// ─── Report Preview Component ───
function ReportPreview({ config, analyses }: { config: ReportConfig; analyses: AnalysisResult[] }) {
  const now = new Date()
  const threats = analyses.filter(a => a.category !== 'NETRAL')
  const criticals = threats.filter(a => a.threatLevel === 'critical')
  const highs = threats.filter(a => a.threatLevel === 'high')

  const getRecommendedAction = () => {
    if (criticals.length > 0) return 'ESKALASI SEGERA — Koordinasi dengan BSSN dan pimpinan satuan.'
    if (highs.length > 0) return 'TINGKATKAN PEMANTAUAN — Siapkan counter-narrative dan lapor ke pimpinan.'
    if (threats.length > 0) return 'MONITOR BERKELANJUTAN — Dokumentasi dan analisis lanjutan diperlukan.'
    return 'TIDAK ADA TINDAKAN KHUSUS — Lanjutkan pemantauan rutin.'
  }

  return (
    <div id="report-preview" style={{
      background: 'white', color: '#1a1a2e', padding: '40px',
      fontFamily: '"Inter", sans-serif', fontSize: '12px', lineHeight: '1.6',
      minHeight: '800px', borderRadius: '8px',
    }}>
      {/* Header */}
      <div style={{ borderBottom: '3px solid #C8102E', paddingBottom: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '2px', color: '#666', marginBottom: '4px' }}>
              TENTARA NASIONAL INDONESIA — ANGKATAN DARAT
            </div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#C8102E', letterSpacing: '3px', fontFamily: '"Rajdhani", sans-serif' }}>
              NARADA
            </div>
            <div style={{ fontSize: '11px', color: '#444', letterSpacing: '1px' }}>
              LAPORAN INTELIJEN ANCAMAN KOGNITIF
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '10px', color: '#666' }}>
            <div style={{ fontWeight: '700', marginBottom: '2px', color: '#1a1a2e' }}>
              No. {config.reportNumber || 'NRD-2026-001'}
            </div>
            <div>{now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
            <div style={{ 
              marginTop: '4px', padding: '2px 8px', 
              background: config.classification === 'RAHASIA' ? '#C8102E' : '#F59E0B',
              color: 'white', borderRadius: '3px', fontSize: '9px', fontWeight: '700', letterSpacing: '1px'
            }}>
              {config.classification}
            </div>
          </div>
        </div>
      </div>

      {/* Identitas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '20px', fontSize: '11px' }}>
        {[
          { label: 'Satuan', value: config.unit || 'PUSSIBERAD TNI AD' },
          { label: 'Analis', value: config.analyst || 'Analis Siber' },
          { label: 'Sistem Analisis', value: 'NARADA AI Engine v1.0' },
          { label: 'Waktu Analisis', value: now.toLocaleTimeString('id-ID') },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', gap: '8px' }}>
            <span style={{ color: '#666', width: '120px', flexShrink: 0 }}>{item.label}:</span>
            <span style={{ fontWeight: '600' }}>{item.value}</span>
          </div>
        ))}
      </div>

      {/* Ringkasan Eksekutif */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ 
          fontSize: '11px', fontWeight: '800', letterSpacing: '2px', 
          color: '#C8102E', marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px'
        }}>
          I. RINGKASAN EKSEKUTIF
        </div>
        <p style={{ color: '#333', lineHeight: '1.8' }}>
          Berdasarkan analisis NARADA AI Engine terhadap <strong>{analyses.length} konten</strong> yang disubmit 
          pada sesi ini, ditemukan <strong>{threats.length} konten terindikasi ancaman kognitif</strong>{' '}
          ({criticals.length} kritis, {highs.length} tinggi). 
          {threats.length > 0 
            ? ` Ancaman yang terdeteksi mencakup ${[...new Set(threats.map(t => t.category))].join(', ')}.`
            : ' Tidak ditemukan ancaman kognitif signifikan pada sesi ini.'}
        </p>
      </div>

      {/* Statistik */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '2px', color: '#C8102E', marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
          II. STATISTIK ANALISIS
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              {['Kategori', 'Jumlah', 'Persentase', 'Level Dominan'].map(h => (
                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: '700', color: '#333' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(['HOAKS', 'PROPAGANDA', 'BUZZER', 'DISINFORMASI', 'NETRAL'] as const).map(cat => {
              const count = analyses.filter(a => a.category === cat).length
              const pct = analyses.length > 0 ? ((count / analyses.length) * 100).toFixed(0) : '0'
              const catThreats = analyses.filter(a => a.category === cat)
              const levels = catThreats.map(t => t.threatLevel)
              const dominant = levels.includes('critical') ? 'CRITICAL' : levels.includes('high') ? 'HIGH' : levels.includes('medium') ? 'MEDIUM' : count > 0 ? 'LOW' : '-'
              return (
                <tr key={cat} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '6px 10px', fontWeight: '600' }}>{cat}</td>
                  <td style={{ padding: '6px 10px' }}>{count}</td>
                  <td style={{ padding: '6px 10px' }}>{pct}%</td>
                  <td style={{ padding: '6px 10px', color: dominant === 'CRITICAL' ? '#C8102E' : dominant === 'HIGH' ? '#F97316' : '#333' }}>
                    {dominant}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Detail Temuan */}
      {config.includeHistory && threats.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '2px', color: '#C8102E', marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
            III. DETAIL TEMUAN ANCAMAN
          </div>
          {threats.slice(0, 5).map((t, i) => (
            <div key={t.id} style={{ marginBottom: '14px', padding: '10px', background: '#f9f9f9', borderLeft: '3px solid #C8102E', borderRadius: '0 4px 4px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontWeight: '700', fontSize: '11px' }}>[{i + 1}] Kategori: {t.category}</span>
                <span style={{ fontSize: '10px', color: '#666' }}>{new Date(t.timestamp).toLocaleString('id-ID')}</span>
              </div>
              <div style={{ marginBottom: '4px', fontSize: '11px', color: '#444' }}>
                <strong>Level Ancaman:</strong> {t.threatLevel.toUpperCase()} | <strong>Confidence:</strong> {t.confidence}%
              </div>
              <div style={{ fontSize: '11px', color: '#555', marginBottom: '6px' }}>
                <strong>Konten:</strong> "{t.input.substring(0, 100)}{t.input.length > 100 ? '...' : ''}"
              </div>
              <div style={{ fontSize: '11px', color: '#444' }}>
                <strong>Rekomendasi:</strong> {t.recommendation}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rekomendasi */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '2px', color: '#C8102E', marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
          {config.includeHistory ? 'IV' : 'III'}. REKOMENDASI TINDAKAN
        </div>
        <div style={{ padding: '12px', background: criticals.length > 0 ? '#fef2f2' : '#f0fdf4', border: `1px solid ${criticals.length > 0 ? '#fecaca' : '#bbf7d0'}`, borderRadius: '4px' }}>
          <p style={{ fontWeight: '600', color: criticals.length > 0 ? '#C8102E' : '#15803d', marginBottom: '4px' }}>
            {getRecommendedAction()}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '2px solid #eee', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#999' }}>
        <span>Laporan dibuat otomatis oleh NARADA AI Engine v1.0 | {now.toLocaleString('id-ID')}</span>
        <span>Halaman 1 dari 1 | Klasifikasi: {config.classification}</span>
      </div>
    </div>
  )
}

// ─── Reports Page ───
export default function Reports() {
  const [analyses] = useState<AnalysisResult[]>(getStoredAnalyses)
  const [config, setConfig] = useState<ReportConfig>({
    unit: 'PUSSIBERAD TNI AD',
    analyst: '',
    classification: 'TERBATAS',
    includeHistory: true,
    reportNumber: `NRD-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`,
  })
  const [isPrinting, setIsPrinting] = useState(false)

  const handlePrint = () => {
    setIsPrinting(true)
    setTimeout(() => {
      window.print()
      setIsPrinting(false)
    }, 300)
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>
          NARADA Intel Report
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Generate laporan intelijen ancaman kognitif — siap cetak dan dilaporkan ke pimpinan
        </p>
      </div>

      {analyses.length === 0 && (
        <div className="alert-banner alert-warning mb-4">
          <AlertTriangle size={16} />
          <span>Belum ada data analisis. Jalankan analisis di modul <strong>Classifier</strong> terlebih dahulu untuk mengisi laporan dengan data nyata.</span>
        </div>
      )}

      <div className="grid-2" style={{ gridTemplateColumns: '320px 1fr', alignItems: 'start', gap: '20px' }}>
        {/* Config Panel */}
        <div>
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <FileText size={12} style={{ display: 'inline', marginRight: '6px' }} />
                Konfigurasi Laporan
              </div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="unit">Nama Satuan</label>
                <input id="unit" className="form-control" value={config.unit} onChange={e => setConfig(p => ({ ...p, unit: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="analyst">Nama Analis</label>
                <input id="analyst" className="form-control" placeholder="Nama lengkap dan pangkat" value={config.analyst} onChange={e => setConfig(p => ({ ...p, analyst: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="report-num">Nomor Laporan</label>
                <input id="report-num" className="form-control" value={config.reportNumber} onChange={e => setConfig(p => ({ ...p, reportNumber: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="classification">Klasifikasi</label>
                <select id="classification" className="form-control" value={config.classification} onChange={e => setConfig(p => ({ ...p, classification: e.target.value }))}>
                  <option>TERBATAS</option>
                  <option>RAHASIA</option>
                  <option>SANGAT RAHASIA</option>
                  <option>BIASA</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="include-history"
                  checked={config.includeHistory}
                  onChange={e => setConfig(p => ({ ...p, includeHistory: e.target.checked }))}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--narada-red)' }}
                />
                <label htmlFor="include-history" style={{ fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Sertakan detail temuan ancaman
                </label>
              </div>

              <div className="divider" />

              <button className="btn btn-primary" onClick={handlePrint} disabled={isPrinting}>
                <Download size={14} />
                {isPrinting ? 'Menyiapkan...' : 'Cetak / Export PDF'}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="card" style={{ marginTop: '16px' }}>
            <div className="card-header">
              <div className="card-title">Data Laporan</div>
            </div>
            <div className="card-body">
              {[
                { label: 'Total Analisis', value: analyses.length },
                { label: 'Ancaman Terdeteksi', value: analyses.filter(a => a.category !== 'NETRAL').length },
                { label: 'Level Kritis', value: analyses.filter(a => a.threatLevel === 'critical').length },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--bg-border)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{s.label}</span>
                  <span style={{ fontSize: '16px', fontFamily: 'var(--font-display)', fontWeight: '700' }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div>
          <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '1.5px', color: 'var(--text-muted)' }}>
              PREVIEW LAPORAN
            </div>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              Update otomatis saat konfigurasi berubah
            </span>
          </div>
          <ReportPreview config={config} analyses={analyses} />
        </div>
      </div>
    </div>
  )
}
