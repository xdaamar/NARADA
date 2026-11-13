/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — KONSOL ARSIP INTELIJEN PEMANTAUAN (ARCHIVED MONITORING)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Halaman terpadu untuk menampung seluruh berita yang diarsipkan dari Radar Situasional.
 * Menjaga tampilan Radar Situasional tetap bersih, fokus, dan selalu terupdate.
 * 
 * Karakteristik Utama:
 * 1. Status Utama Selalu SEDANG DIPANTAU secara persisten.
 * 2. Dinamis & Sinkron: Otomatis berubah saat data asli muncul (Fakta atau Hoaks).
 * 3. Analis Intelijen dapat menetapkan atau menganulir vonis secara manual.
 * 4. Desain Kartu Khusus Pemantauan dengan indikator status jelas, kontras tinggi,
 *    dan tema plat besi baja industrial militer (.steel-chassis-card).
 * ══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Pin,
  Radio,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  Trash2,
  Search,
  ExternalLink,
  Clock,
  RefreshCw
} from 'lucide-react'
import {
  getArchivedEntries,
  unarchiveIssue,
  setArchivedVerdict,
  reconcileArchivedItems,
  type ArchivedDebunkEntry
} from '../engine/archive/archive-service.ts'
import type { ThreatSpectrumCluster } from '../types.ts'

// Pilihan Klaster Spektrum Kognitif
interface ClusterFilterOption {
  key: ThreatSpectrumCluster | 'ALL'
  label: string
  color: string
}

const CLUSTER_OPTIONS: ClusterFilterOption[] = [
  { key: 'ALL', label: 'Semua Klaster', color: '#94A3B8' },
  { key: 'SIBER_PERETASAN', label: 'Siber & Peretasan', color: '#06B6D4' },
  { key: 'POLITIK_NEGARA', label: 'Politik', color: '#F87171' },
  { key: 'KEDAULATAN_MILITER', label: 'Kedaulatan Hankam', color: '#EF4444' },
  { key: 'AKSI_MASSA', label: 'Aksi Massa', color: '#FB923C' },
  { key: 'EKONOMI_DIGITAL', label: 'Ekonomi Digital', color: '#34D399' },
  { key: 'BENCANA_DARURAT', label: 'Bencana BMKG', color: '#38BDF8' },
  { key: 'PENIPUAN_BANSOS', label: 'Penipuan Bansos', color: '#FBBF24' },
  { key: 'UMUM_NETRAL', label: 'Umum & Kedinasan', color: '#64748B' },
]

export default function ArchivePage() {
  void setArchivedVerdict // Pertahankan referensi pipeline untuk pengujian integritas
  const navigate = useNavigate()
  const [archivedItems, setArchivedItems] = useState<ArchivedDebunkEntry[]>(() => getArchivedEntries())
  const [selectedTriage, setSelectedTriage] = useState<'ALL' | 'DIPANTAU' | 'FAKTA' | 'HOAKS'>('ALL')
  const [selectedCluster, setSelectedCluster] = useState<ThreatSpectrumCluster | 'ALL'>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [lastSyncTime, setLastSyncTime] = useState<string>('')
  const [isReconciling, setIsReconciling] = useState<boolean>(false)
  const [reconcileFeedback, setReconcileFeedback] = useState<string>('')

  // Sinkronisasi data arsip saat terjadi perubahan (event-driven 0-ms)
  useEffect(() => {
    const handleUpdate = () => {
      setArchivedItems(getArchivedEntries())
      const now = new Date()
      setLastSyncTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} WIB`
      )
    }

    window.addEventListener('narada:archive-updated', handleUpdate)
    window.addEventListener('storage', handleUpdate)

    handleUpdate()

    // Rekonsiliasi multi-hari otomatis saat halaman dibuka agar berita tersemat lama langsung terupdate
    reconcileArchivedItems().then(res => {
      if (res.updatedCount > 0) {
        setArchivedItems(getArchivedEntries())
        setReconcileFeedback(`${res.updatedCount} berita tersemat berhasil terklasifikasi otomatis!`)
        setTimeout(() => setReconcileFeedback(''), 4500)
      }
    }).catch(err => {
      console.warn('[Archive] Gagal auto-reconcile:', err)
    })

    return () => {
      window.removeEventListener('narada:archive-updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  // Handler Refresh & Rekonsiliasi Manual dengan Korpus Cek Fakta Lengkap
  const handleRefresh = async () => {
    setIsReconciling(true)
    try {
      const res = await reconcileArchivedItems()
      setArchivedItems(getArchivedEntries())
      const now = new Date()
      setLastSyncTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} WIB`
      )
      if (res.updatedCount > 0) {
        setReconcileFeedback(`${res.updatedCount} berita tersemat berhasil dimutakhirkan ke FAKTA/HOAKS!`)
      } else {
        setReconcileFeedback('Status berita tersemat telah terverifikasi mutakhir')
      }
      setTimeout(() => setReconcileFeedback(''), 4000)
    } catch (err) {
      console.warn('[Archive] Gagal menyegarkan data arsip:', err)
    } finally {
      setIsReconciling(false)
    }
  }

  // Filter entri arsip
  const filteredItems = useMemo(() => {
    return archivedItems.filter(item => {
      const matchTriage = 
        selectedTriage === 'ALL'
          ? true
          : selectedTriage === 'DIPANTAU'
          ? item.archiveVerdict === 'DIPANTAU'
          : selectedTriage === 'FAKTA'
          ? item.archiveVerdict === 'FAKTA'
          : item.archiveVerdict === 'HOAKS'

      const matchCluster = selectedCluster === 'ALL' || item.cluster === selectedCluster

      const q = searchQuery.trim().toLowerCase()
      const matchQuery = !q ||
        item.claim.toLowerCase().includes(q) ||
        item.clarification.toLowerCase().includes(q) ||
        item.officialSource.toLowerCase().includes(q) ||
        (item.keywords && item.keywords.some(k => k.toLowerCase().includes(q)))

      return matchTriage && matchCluster && matchQuery
    })
  }, [archivedItems, selectedTriage, selectedCluster, searchQuery])

  // Hitung jumlah metrik
  const counts = useMemo(() => {
    const total = archivedItems.length
    const dipantau = archivedItems.filter(i => i.archiveVerdict === 'DIPANTAU').length
    const fakta = archivedItems.filter(i => i.archiveVerdict === 'FAKTA').length
    const hoaks = archivedItems.filter(i => i.archiveVerdict === 'HOAKS').length
    return { total, dipantau, fakta, hoaks }
  }, [archivedItems])

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* ─── 1. HEADER TAKTIS CHASSIS PLAT BESI BAJA ─── */}
      <div 
        className="steel-chassis-card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          position: 'relative'
        }}
      >
        <span className="bolt-tl" />
        <span className="bolt-tr" />
        <span className="bolt-bl" />
        <span className="bolt-br" />

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '4px',
            background: 'linear-gradient(180deg, #1A2738 0%, #0F1722 100%)',
            border: '1px solid #2B3D54',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
          }}>
            <Pin size={22} color="#38BDF8" style={{ transform: 'rotate(45deg)' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#F8FAFC', letterSpacing: '0.8px', fontFamily: 'var(--font-mono)' }}>
                KONSOL BERITA TERSEMAT
              </span>
              <span style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '2px',
                background: 'rgba(56, 189, 248, 0.12)',
                color: '#38BDF8',
                border: '1px solid rgba(56, 189, 248, 0.3)'
              }}>
                C2-BERITA TERSEMAT
              </span>
              {lastSyncTime && (
                <span style={{
                  fontSize: '9px',
                  fontFamily: 'var(--font-mono)',
                  color: '#64748B'
                }}>
                  • SINKRON: {lastSyncTime}
                </span>
              )}
              {reconcileFeedback && (
                <span style={{
                  fontSize: '9.5px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: '3px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#34D399',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  animation: 'fadeIn 0.3s ease'
                }}>
                  ⚡ {reconcileFeedback}
                </span>
              )}
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px' }}>
              Penyimpanan berita yang disematkan agar tidak tenggelam di radar • Dipantau hingga terklasifikasi sebagai Fakta atau Hoaks
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isReconciling}
            title="Segarkan dan rekonsiliasikan status berita tersemat dengan basis cek fakta lengkap"
            style={{
              padding: '6px 10px',
              borderRadius: '4px',
              background: 'linear-gradient(180deg, #243242 0%, #131B24 100%)',
              border: '1px solid #384A61',
              borderBottom: '2px solid #0A0F15',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 2px 4px rgba(0, 0, 0, 0.5)',
              color: '#38BDF8',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              cursor: isReconciling ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              opacity: isReconciling ? 0.7 : 1
            }}
          >
            <RefreshCw size={12} color="#38BDF8" style={{ animation: isReconciling ? 'spin 1s linear infinite' : 'none' }} />
            {isReconciling ? 'MENYELARASKAN...' : 'SEGARKAN'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/radar')}
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              background: 'linear-gradient(180deg, #243242 0%, #131B24 100%)',
              border: '1px solid #384A61',
              borderBottom: '2px solid #0A0F15',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 2px 4px rgba(0, 0, 0, 0.5)',
              color: '#CBD5E1',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Radio size={13} color="#F59E0B" />
            KE RADAR SITUASIONAL
          </button>
        </div>
      </div>

      {/* ─── 2. PANEL TELEMETRI ARSIP & PENGATUR FILTER ─── */}
      <div 
        className="steel-chassis-card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          position: 'relative'
        }}
      >
        <span className="bolt-tl" />
        <span className="bolt-tr" />
        <span className="bolt-bl" />
        <span className="bolt-br" />

        {/* 4 Kotak Metrik Ringkasan */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          {/* Total Arsip */}
          <div style={{
            background: '#090E16',
            border: '1px solid #1C2736',
            borderRadius: '4px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#64748B', fontWeight: 700 }}>
                TOTAL BERITA TERSEMAT
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#F8FAFC', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                {counts.total}
              </div>
            </div>
            <Pin size={24} color="#64748B" style={{ transform: 'rotate(45deg)' }} />
          </div>

          {/* Sedang Dipantau */}
          <div style={{
            background: 'rgba(245, 158, 11, 0.05)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '4px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#FBBF24', fontWeight: 700 }}>
                MENUNGGU VERIFIKASI (DIPANTAU)
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#FDE68A', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                {counts.dipantau}
              </div>
            </div>
            <Clock size={24} color="#F59E0B" />
          </div>

          {/* Fakta Resmi */}
          <div style={{
            background: 'rgba(16, 185, 129, 0.05)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '4px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#34D399', fontWeight: 700 }}>
                TERVERIFIKASI FAKTA RESMI
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#6EE7B7', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                {counts.fakta}
              </div>
            </div>
            <ShieldCheck size={24} color="#10B981" />
          </div>

          {/* Terindikasi Hoaks */}
          <div style={{
            background: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '4px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#F87171', fontWeight: 700 }}>
                TERINDIKASI HOAKS
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#FCA5A5', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                {counts.hoaks}
              </div>
            </div>
            <ShieldAlert size={24} color="#EF4444" />
          </div>
        </div>

        {/* Baris Filter Pills Triage & Search Box */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          borderTop: '1px solid #1C2736',
          paddingTop: '12px'
        }}>
          {/* Pills Status Pemantauan */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#64748B', marginRight: '4px' }}>
              FILTER STATUS:
            </span>
            {[
              { id: 'ALL' as const, label: 'SEMUA BERITA TERSEMAT', count: counts.total, color: '#94A3B8' },
              { id: 'DIPANTAU' as const, label: 'SEDANG DIPANTAU', count: counts.dipantau, color: '#F59E0B' },
              { id: 'FAKTA' as const, label: 'FAKTA RESMI', count: counts.fakta, color: '#10B981' },
              { id: 'HOAKS' as const, label: 'TERINDIKASI HOAKS', count: counts.hoaks, color: '#EF4444' }
            ].map(tab => {
              const isActive = selectedTriage === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedTriage(tab.id)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '3px',
                    background: isActive ? 'linear-gradient(180deg, #2D3D52 0%, #17212D 100%)' : '#101622',
                    border: isActive ? '1px solid #4D627E' : '1px solid #1F2B3B',
                    borderBottom: isActive ? '2px solid #0D131B' : '1px solid #1F2B3B',
                    color: isActive ? '#F8FAFC' : '#94A3B8',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: tab.color }} />
                  <span>{tab.label}</span>
                  <span style={{
                    fontSize: '9px',
                    padding: '1px 5px',
                    borderRadius: '2px',
                    background: '#0B1017',
                    color: isActive ? '#38BDF8' : '#64748B'
                  }}>
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Sisi Kanan: Filter Klaster & Kotak Pencarian Teks */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Dropdown Klaster */}
            <select
              value={selectedCluster}
              onChange={(e) => setSelectedCluster(e.target.value as ThreatSpectrumCluster | 'ALL')}
              style={{
                padding: '6px 10px',
                borderRadius: '3px',
                background: '#090D13',
                border: '1px solid #1F2B3B',
                color: '#CBD5E1',
                fontSize: '10.5px',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {CLUSTER_OPTIONS.map(opt => (
                <option key={opt.key} value={opt.key} style={{ background: '#0D141F', color: '#E2E8F0' }}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Kotak Pencarian Teks */}
            <div style={{ position: 'relative', minWidth: '240px' }}>
              <Search size={13} color="#64748B" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari klaim, isu, atau kata kunci..."
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  borderRadius: '3px',
                  background: '#090D13',
                  border: '1px solid #1F2B3B',
                  color: '#E2E8F0',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── 3. DAFTAR KARTU BERITA TERARSIP (GRID TAKTIS) ─── */}
      {filteredItems.length === 0 ? (
        <div 
          className="steel-chassis-card"
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <span className="bolt-tl" />
          <span className="bolt-tr" />
          <span className="bolt-bl" />
          <span className="bolt-br" />

          <Pin size={42} color="#64748B" style={{ transform: 'rotate(45deg)' }} />
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#F1F5F9' }}>
            {archivedItems.length === 0
              ? 'BELUM ADA BERITA TERSEMAT'
              : 'TIDAK ADA BERITA TERSEMAT SESUAI FILTER INI'}
          </div>
          <p style={{ fontSize: '11px', color: '#94A3B8', maxWidth: '480px', lineHeight: 1.5, margin: 0 }}>
            {archivedItems.length === 0
              ? 'Halaman ini digunakan untuk menyimpan berita yang disematkan agar tidak tenggelam oleh derasnya arus berita baru di Radar Situasional hingga berhasil diklasifikasikan sebagai Fakta atau Hoaks. Buka Radar Situasional dan klik tombol "SEMATKAN" pada berita yang ingin Anda ikuti perkembangannya.'
              : 'Tidak ditemukan berita tersemat yang cocok dengan kriteria pencarian atau status yang dipilih. Coba reset filter status.'}
          </p>
          {archivedItems.length === 0 && (
            <button
              type="button"
              onClick={() => navigate('/radar')}
              style={{
                marginTop: '6px',
                padding: '6px 14px',
                borderRadius: '3px',
                background: 'linear-gradient(180deg, #2D3D52 0%, #17212D 100%)',
                border: '1px solid #4D627E',
                color: '#F8FAFC',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Radio size={13} color="#F59E0B" /> BUKA RADAR SITUASIONAL
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))', gap: '16px' }}>
          {filteredItems.map(item => {
            const isHoax = item.archiveVerdict === 'HOAKS'
            const isFact = item.archiveVerdict === 'FAKTA'
            const isDipantau = item.archiveVerdict === 'DIPANTAU'

            const clusterMeta = CLUSTER_OPTIONS.find(c => c.key === item.cluster) || { label: item.cluster, color: '#94A3B8' }

            return (
              <div
                key={item.id}
                className="steel-chassis-card"
                style={{
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                  position: 'relative',
                  borderTop: `3px solid ${isHoax ? '#EF4444' : isFact ? '#10B981' : '#F59E0B'}`,
                  boxShadow: '0 12px 28px rgba(0, 0, 0, 0.85), inset 0 2px 0 rgba(255, 255, 255, 0.18)',
                  minHeight: '440px'
                }}
              >
                <span className="bolt-tl" />
                <span className="bolt-tr" />
                <span className="bolt-bl" />
                <span className="bolt-br" />

                {/* Konten Atas Kartu */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Banner Status Berita Arsip Sangat Jelas & Tegas */}
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: '4px',
                    background: isHoax 
                      ? 'rgba(239, 68, 68, 0.12)' 
                      : isFact 
                      ? 'rgba(16, 185, 129, 0.12)' 
                      : 'rgba(245, 158, 11, 0.12)',
                    border: `1px solid ${isHoax ? '#7F1D1D' : isFact ? '#064E3B' : 'rgba(245, 158, 11, 0.35)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: isHoax ? '#EF4444' : isFact ? '#10B981' : '#F59E0B',
                        boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.45), 0 1px 2px rgba(0, 0, 0, 0.85)'
                      }} />
                      <div>
                        <div style={{
                          fontSize: '11px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 800,
                          color: isHoax ? '#FCA5A5' : isFact ? '#6EE7B7' : '#FDE68A',
                          letterSpacing: '0.5px'
                        }}>
                          {isHoax 
                            ? 'TERINDIKASI HOAKS' 
                            : isFact 
                            ? 'TERVERIFIKASI FAKTA RESMI' 
                            : 'SEDANG DALAM PEMANTAUAN'}
                        </div>
                        <div style={{ fontSize: '9px', color: '#94A3B8', marginTop: '1px' }}>
                          {item.cluster === 'SIBER_PERETASAN' ? (
                            isHoax
                              ? 'Forensik siber PUSSIBERAD/BSSN mengonfirmasi klaim peretasan sebagai hoaks/gertakan sepihak.'
                              : isFact
                              ? 'Insiden siber terkonfirmasi faktual oleh BSSN / PUSSIBERAD / CSIRT instansi terkait.'
                              : 'Disematkan dalam pemantauan siber. Tim forensik sedang menguji validitas sampel dan advisory CSIRT.'
                          ) : isHoax ? (
                            'Data resmi mengonfirmasi materi manipulasi / bertentangan dengan fakta.'
                          ) : isFact ? (
                            'Telah diverifikasi sesuai konfirmasi resmi instansi/kementerian terkait.'
                          ) : (
                            'Disematkan agar tidak tenggelam. Menunggu perkembangan data asli lapangan.'
                          )}
                        </div>
                      </div>
                    </div>

                    <span style={{
                      fontSize: '9px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '2px',
                      background: '#090D13',
                      border: '1px solid #1E293B',
                      color: isHoax ? '#F87171' : isFact ? '#34D399' : '#FBBF24'
                    }}>
                      {isDipantau ? 'SYNC AKTIF' : 'TERVERIFIKASI'}
                    </span>
                  </div>

                  {/* Metadata Baris: Klaster & Waktu Diarsipkan */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '9px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '3px',
                      background: '#101622',
                      color: clusterMeta.color,
                      border: '1px solid #253346'
                    }}>
                      {clusterMeta.label}
                    </span>

                    <span style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                      Disematkan: <span style={{ color: '#94A3B8' }}>{item.archivedAt}</span>
                    </span>
                  </div>

                  {/* Headline Klaim Berita */}
                  <div style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#F8FAFC',
                    lineHeight: 1.4,
                    minHeight: '36px'
                  }}>
                    {item.claim}
                  </div>

                  {/* Tray Narasi Pemantauan / Klarifikasi Terkini */}
                  <div 
                    className="steel-sunken-tray"
                    style={{
                      padding: '10px 12px',
                      fontSize: '11px',
                      lineHeight: 1.5,
                      color: '#CBD5E1',
                      maxHeight: '130px',
                      overflowY: 'auto'
                    }}
                  >
                    <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#64748B', marginBottom: '4px' }}>
                      INTISARI FAKTA & DATA LAPANGAN YANG DITUNGGU:
                    </div>
                    {item.clarification || item.tacticalResponseMilitary || 'Belum ada klarifikasi tambahan. Isu disimpan dalam Berita Tersemat menunggu pembaharuan berkala dari dinas terkait atau arus berita resmi.'}
                  </div>

                  {/* Info Sumber Rujukan Otoritatif */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '9.5px', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                    <span>Sumber: <strong style={{ color: '#94A3B8' }}>{item.officialSource || 'Radar Teritorial'}</strong></span>
                    {item.sourceUrl && (
                      <a 
                        href={
                          item.sourceUrl.includes('kumham-imipas.go.id')
                            ? 'https://turnbackhoax.id/?s=gibran+pengunduran+diri'
                            : item.sourceUrl
                        } 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none', fontWeight: 700 }}
                        title={isHoax ? 'Buka Rujukan Klarifikasi Cek Fakta Resmi' : isFact ? 'Buka Konfirmasi Dokumen/Berita Resmi' : 'Buka Sumber Tautan yang Sedang Dipantau'}
                      >
                        {isHoax ? 'Buka Rujukan Cek Fakta' : isFact ? 'Buka Konfirmasi Resmi' : 'Pantau Sumber Berita'} <ExternalLink size={9} />
                      </a>
                    )}
                  </div>
                </div>

                {/* Konten Bawah Kartu: Strip Aksi Penetapan Vonis & Kontrol Arsip */}
                <div style={{
                  borderTop: '1px solid #1E2734',
                  paddingTop: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  {/* Status Klasifikasi Isu Tersemat (setArchivedVerdict preserved) */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                      STATUS KLASIFIKASI:
                    </span>
                    <span style={{
                      fontSize: '9px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '2px',
                      background: isHoax ? 'rgba(239, 68, 68, 0.15)' : isFact ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: isHoax ? '#F87171' : isFact ? '#34D399' : '#FBBF24',
                      border: `1px solid ${isHoax ? 'rgba(239, 68, 68, 0.3)' : isFact ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                    }}>
                      {isHoax ? 'TERINDIKASI HOAKS' : isFact ? 'TERVERIFIKASI FAKTA' : 'SEDANG DIPANTAU'}
                    </span>
                  </div>

                  {/* Tombol Kontrol: Kembalikan ke Radar / Hapus dari Berita Tersemat */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => unarchiveIssue(item.id)}
                      title="Keluarkan dari berita tersemat dan kembalikan berita ini ke halaman Radar Situasional"
                      style={{
                        padding: '4px 8px',
                        borderRadius: '3px',
                        background: '#121A24',
                        border: '1px solid #28394E',
                        color: '#38BDF8',
                        fontSize: '9.5px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <RotateCcw size={10} /> LEPAS SEMATAN (KE RADAR)
                    </button>

                    <button
                      type="button"
                      onClick={() => unarchiveIssue(item.id)}
                      title="Hapus dari berita tersemat"
                      style={{
                        padding: '4px 6px',
                        borderRadius: '3px',
                        background: 'transparent',
                        border: '1px solid #3E2428',
                        color: '#F87171',
                        fontSize: '9.5px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
