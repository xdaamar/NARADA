import { useState } from 'react'
import {
  Shield,
  Key,
  Sliders,
  Wifi,
  WifiOff,
  Database,
  Save,
  RotateCcw,
  Sparkles,
  Trash2,
  CheckCircle2,
  Eye,
  EyeOff,
  User,
  Building,
  Award
} from 'lucide-react'
import type { UserSettings } from '../types'
import { getUserSettings, saveUserSettings, seedDemoAnalyses, clearStoredAnalyses } from '../utils/storage'

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>(() => getUserSettings())
  const [showApiKey, setShowApiKey] = useState<boolean>(false)
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false)
  const [dataMessage, setDataMessage] = useState<string | null>(null)

  const handleSave = () => {
    saveUserSettings(settings)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2500)
  }

  const handleWeightChange = (newMlWeight: number) => {
    const ml = Math.round(newMlWeight * 10) / 10
    const rule = Math.round((1 - ml) * 10) / 10
    setSettings(prev => ({
      ...prev,
      mlWeight: ml,
      ruleWeight: rule,
    }))
  }

  const handleSeedDemoData = () => {
    seedDemoAnalyses()
    setDataMessage('✓ Berhasil memuat 5 skenario intelijen siap uji ke Session Storage!')
    setTimeout(() => setDataMessage(null), 3000)
  }

  const handleClearSession = () => {
    if (window.confirm('Apakah Anda yakin ingin menghapus seluruh riwayat analisis pada sesi ini?')) {
      clearStoredAnalyses()
      setDataMessage('✓ Seluruh data riwayat sesi berhasil dibersihkan.')
      setTimeout(() => setDataMessage(null), 3000)
    }
  }

  const handleResetDefaults = () => {
    const defaultVals: UserSettings = {
      googleFactCheckApiKey: '',
      defaultUnit: 'PUSSIBERAD TNI AD',
      analystName: 'Sertu Damar / Analis Madya',
      analystNrp: '21260408',
      mlWeight: 0.6,
      ruleWeight: 0.4,
      offlineMode: false,
    }
    setSettings(defaultVals)
    saveUserSettings(defaultVals)
    setDataMessage('✓ Konfigurasi sistem telah dikembalikan ke pengaturan standar.')
    setTimeout(() => setDataMessage(null), 3000)
  }

  return (
    <div className="fade-in" style={{ paddingBottom: '32px' }}>
      {/* ─── Header Halaman ─── */}
      <div style={{ marginBottom: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            padding: '2px 8px',
            borderRadius: '3px',
            background: 'var(--narada-red-subtle)',
            color: 'var(--narada-red)',
            border: '1px solid rgba(200, 16, 46, 0.3)',
            letterSpacing: '1.5px',
            textTransform: 'uppercase'
          }}>
            SYSTEM CONFIGURATION
          </span>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            PUSSIBERAD TNI AD
          </span>
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '24px',
          fontWeight: '800',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          color: 'var(--text-primary)'
        }}>
          Pengaturan Sistem & Konfigurasi Engine
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Kustomisasi bobot klasifikasi hybrid, integrasi API verifikasi eksternal, profil operator analis, dan manajemen data sesi.
        </p>
      </div>

      {/* Notifikasi feedback */}
      {dataMessage && (
        <div style={{
          marginBottom: '16px',
          padding: '12px 16px',
          background: 'rgba(34, 197, 94, 0.12)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--threat-low)',
          fontSize: '12px',
          fontFamily: 'var(--font-mono)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} />
          {dataMessage}
        </div>
      )}

      <div style={{ maxWidth: '840px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* ─── 1. Profil Analis & Identitas Satuan ─── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={14} color="var(--narada-red)" />
              PROFIL ANALIS & IDENTITAS KOMANDO
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="grid-2" style={{ gap: '14px' }}>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Building size={11} /> NAMA SATUAN DEFAULT
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={settings.defaultUnit}
                  onChange={e => setSettings({ ...settings, defaultUnit: e.target.value })}
                  placeholder="e.g. PUSSIBERAD TNI AD"
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <User size={11} /> NAMA ANALIS & PANGKAT
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={settings.analystName}
                  onChange={e => setSettings({ ...settings, analystName: e.target.value })}
                  placeholder="e.g. Sertu Damar / Analis Madya"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Award size={11} /> NRP / NIP OPERATOR ANALIS
              </label>
              <input
                type="text"
                className="form-control"
                value={settings.analystNrp}
                onChange={e => setSettings({ ...settings, analystNrp: e.target.value })}
                placeholder="e.g. 21260408"
                style={{ maxWidth: '380px' }}
              />
            </div>
          </div>
        </div>

        {/* ─── 2. Tuning Bobot Engine AI Kognitif ─── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={14} color="var(--accent-blue)" />
              TUNING BOBOT HYBRID AI COGNITIVE COMBINER
            </div>
          </div>
          <div className="card-body">
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.6' }}>
              Atur proporsi fusi antara Layer 1 (Probabilitas Machine Learning Naive Bayes TF-IDF) dan Layer 2 (Explainable Military Rule Engine Severity).
            </p>

            <div style={{
              background: 'var(--bg-elevated)',
              padding: '16px 20px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--bg-border)',
              marginBottom: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
                <span style={{ color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)', fontWeight: '700' }}>
                  Machine Learning (TF-IDF + NB): {Math.round(settings.mlWeight * 100)}%
                </span>
                <span style={{ color: 'var(--narada-red)', fontFamily: 'var(--font-mono)', fontWeight: '700' }}>
                  Rule Severity Militer: {Math.round(settings.ruleWeight * 100)}%
                </span>
              </div>

              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={settings.mlWeight}
                onChange={e => handleWeightChange(parseFloat(e.target.value))}
                style={{
                  width: '100%',
                  cursor: 'pointer',
                  accentColor: 'var(--narada-red)',
                  height: '6px'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                <span>10% ML / 90% Rules</span>
                <span>Default Rekomendasi: 60% ML / 40% Rules</span>
                <span>90% ML / 10% Rules</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── 3. Integrasi Google Fact Check API & Mode Offline ─── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Key size={14} color="var(--threat-medium)" />
              INTEGRASI API VERIFIKASI EKSTERNAL & KONEKTIVITAS
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Google Fact Check API Key */}
            <div className="form-group">
              <label className="form-label">GOOGLE FACT CHECK TOOLS API KEY (OPSIONAL)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  className="form-control"
                  value={settings.googleFactCheckApiKey}
                  onChange={e => setSettings({ ...settings, googleFactCheckApiKey: e.target.value })}
                  placeholder="Masukkan Google Cloud API Key gratis (jika tersedia)..."
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowApiKey(!showApiKey)}
                  title={showApiKey ? 'Sembunyikan Kunci' : 'Tampilkan Kunci'}
                >
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                *API Key disimpan secara lokal di peramban Anda. Jika dikosongkan, aplikasi secara otomatis menggunakan tautan penelusuran mandiri TurnBackHoax dan arsip debunking bawaan.
              </div>
            </div>

            {/* Toggle Mode Offline */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--bg-border)'
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {settings.offlineMode ? <WifiOff size={14} color="var(--accent-blue)" /> : <Wifi size={14} color="var(--threat-low)" />}
                  Mode Isolasi Siber (Air-Gapped / Offline Force)
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Memblokir seluruh permintaan jaringan eksternal untuk lingkungan militer berkategori tertutup.
                </div>
              </div>

              <button
                type="button"
                className={`btn btn-sm ${settings.offlineMode ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSettings({ ...settings, offlineMode: !settings.offlineMode })}
              >
                {settings.offlineMode ? 'AKTIF (OFFLINE)' : 'NON-AKTIF (ONLINE)'}
              </button>
            </div>
          </div>
        </div>

        {/* ─── 4. Pengelolaan Data Sesi & Demo Seeder ─── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={14} color="var(--threat-low)" />
              MANAJEMEN DATA SESI & UTILITAS DEMO
            </div>
          </div>
          <div className="card-body">
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Kelola data analisis lokal di <code>sessionStorage</code> untuk keperluan pengujian dan demonstrasi evaluasi juri hackathon.
            </p>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSeedDemoData}
              >
                <Sparkles size={14} color="#EF4444" />
                Muat Skenario Demo Siap Uji (5 Kasus)
              </button>

              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleResetDefaults}
                style={{ border: '1px solid var(--bg-border)' }}
              >
                <RotateCcw size={14} />
                Kembalikan Default Sistem
              </button>

              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleClearSession}
                style={{ color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.25)', marginLeft: 'auto' }}
              >
                <Trash2 size={14} />
                Hapus Seluruh Data Sesi
              </button>
            </div>
          </div>
        </div>

        {/* ─── 5. Tombol Simpan Pengaturan ─── */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={handleSave}
            style={{ padding: '12px 28px' }}
          >
            <Save size={16} />
            {saveSuccess ? '✓ Konfigurasi Tersimpan!' : 'Simpan Pengaturan'}
          </button>
          {saveSuccess && (
            <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--threat-low)' }}>
              Pengaturan telah diterapkan ke seluruh modul aplikasi.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
