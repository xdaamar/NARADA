import { useState } from 'react'
import {
  X,
  Shield,
  Layers,
  Cpu,
  BarChart3
} from 'lucide-react'

interface InteractiveDoctrineModalProps {
  isOpen: boolean
  onClose: () => void
}

type TabType = 'doctrine' | 'pipeline' | 'ml' | 'competitors'

export default function InteractiveDoctrineModal({ isOpen, onClose }: InteractiveDoctrineModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('doctrine')

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(4, 6, 9, 0.85)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        className="steel-chassis-card"
        style={{
          width: '100%',
          maxWidth: '1020px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          padding: 0,
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 30px rgba(212, 175, 55, 0.15)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 4 Baut Allen di Sudut Modal */}
        <span className="bolt-tl" />
        <span className="bolt-tr" />
        <span className="bolt-bl" />
        <span className="bolt-br" />

        {/* Modal Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '2px solid #2A3646',
            background: 'linear-gradient(180deg, #1A2330 0%, #111722 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '6px',
                background: 'rgba(212, 175, 55, 0.15)',
                border: '1px solid rgba(212, 175, 55, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <img
                src="/image/Electrified%20Golden%20Globe%20Crest.png"
                alt="NARADA Crest"
                style={{ width: '26px', height: '26px', objectFit: 'contain' }}
              />
            </div>
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '17px',
                  fontWeight: 800,
                  letterSpacing: '1px',
                  color: '#F8FAFC',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                DOKTRIN INTELIJEN KOGNITIF & ARSITEKTUR SISTEM NARADA
                <span
                  style={{
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    color: '#10B981',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid #059669',
                    padding: '1px 6px',
                    borderRadius: '3px'
                  }}
                >
                  TRL-8 READY
                </span>
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: '#94A3B8',
                  letterSpacing: '0.5px'
                }}
              >
                PUSSIBERAD TNI AD × CODEPOLITAN • KARTIKA CYBER HACKATHON 2026
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost"
            style={{
              padding: '6px',
              borderRadius: '4px',
              color: '#94A3B8',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #1E2734',
            background: '#0B0F15',
            padding: '0 16px'
          }}
        >
          {[
            { id: 'doctrine', label: '1. Doktrin Perang Kognitif', icon: Shield },
            { id: 'pipeline', label: '2. Arsitektur Zero-Server', icon: Layers },
            { id: 'ml', label: '3. Metodologi ML & Korpus', icon: Cpu },
            { id: 'competitors', label: '4. Komparasi Kompetitor Global', icon: BarChart3 }
          ].map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id as TabType)}
                style={{
                  padding: '12px 18px',
                  background: isActive ? '#141D29' : 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '3px solid #D4AF37' : '3px solid transparent',
                  color: isActive ? '#F1F5F9' : '#64748B',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={14} color={isActive ? '#D4AF37' : '#64748B'} />
                {label}
              </button>
            )
          })}
        </div>

        {/* Modal Content Body */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            flex: 1,
            background: '#090D13',
            color: '#CBD5E1',
            lineHeight: 1.6
          }}
        >
          {/* TAB 1: DOKTRIN PERANG KOGNITIF */}
          {activeTab === 'doctrine' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                className="steel-sunken-tray"
                style={{ padding: '16px', borderLeft: '4px solid #C8102E' }}
              >
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#F8FAFC', marginBottom: '6px' }}>
                  HAKIKAT ANCAMAN PERANG KOGNITIF MODERN (5TH GENERATION WARFARE)
                </div>
                <p style={{ fontSize: '12px', margin: 0, color: '#94A3B8' }}>
                  Perang modern tidak lagi semata-mata memperebutkan wilayah geografis, melainkan menargetkan
                  wilayah kesadaran (cognitive realm) prajurit dan rakyat. Serangan siber kognitif memanfaatkan
                  disinformasi terorganisir, astroturfing buzzer swarm, pemelintiran fakta alutsista, dan fabrikasi
                  isu bencana/ekonomi untuk mendemoralisasi publik dan merusak kepercayaan terhadap Negara Kesatuan Republik Indonesia.
                </p>
              </div>

              {/* Rantai Komando Satuan Penerima Manfaat */}
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    color: '#D4AF37',
                    fontWeight: 700,
                    letterSpacing: '1px',
                    marginBottom: '10px'
                  }}
                >
                  HIERARKI AKSI OPERASIONAL SATUAN PENERIMA MANFAAT TNI AD:
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  <div className="steel-sunken-tray" style={{ padding: '14px' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#EF4444', fontWeight: 700 }}>
                      [LEVEL STRATEGIS]
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#FFF', margin: '4px 0' }}>
                      DISPENAD (Penerangan AD)
                    </div>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                      Penerbitan siaran pers resmi centang biru dalam kurun waktu &lt;2 jam dan rilis infografis sanggahan multi-kanal.
                    </div>
                  </div>

                  <div className="steel-sunken-tray" style={{ padding: '14px' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#38BDF8', fontWeight: 700 }}>
                      [LEVEL TEKNIS SIBER]
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#FFF', margin: '4px 0' }}>
                      PUSSIBERAD (Siber TNI AD)
                    </div>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                      Tracing forensik IP/domain phishing, deteksi klaster bot buzzer berulang, dan koordinasi takedown cepat ke Kominfo/BSSN.
                    </div>
                  </div>

                  <div className="steel-sunken-tray" style={{ padding: '14px' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#FBBF24', fontWeight: 700 }}>
                      [LEVEL OPERASIONAL]
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#FFF', margin: '4px 0' }}>
                      KODAM / KOREM
                    </div>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                      Pemetaan polarisasi wilayah teritorial, pengawasan media lokal, dan konsolidasi unsur forkopimda daerah.
                    </div>
                  </div>

                  <div className="steel-sunken-tray" style={{ padding: '14px' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#34D399', fontWeight: 700 }}>
                      [LEVEL TAKTIS LAPANGAN]
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#FFF', margin: '4px 0' }}>
                      KODIM & BABINSA
                    </div>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                      Patroli dialogis door-to-door, sosialisasi lisan di balai desa, dan penenangan warga binaan dari isu gempa/bansos fiktif.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ARSITEKTUR ZERO-SERVER PIPELINE */}
          {activeTab === 'pipeline' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                className="steel-sunken-tray"
                style={{ padding: '16px', borderLeft: '4px solid #10B981' }}
              >
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#F8FAFC', marginBottom: '6px' }}>
                  PRINSIP AIR-GAPPED & ZERO-CLOUD EGRESS
                </div>
                <p style={{ fontSize: '12px', margin: 0, color: '#94A3B8' }}>
                  NARADA dirancang khusus untuk operasi tempur intelijen terisolasi (Air-Gapped Field Deployment).
                  Seluruh inferensi AI, OCR Tesseract, pencocokan leksikon, dan pembentukan laporan A4 berlangsung 100%
                  di memori lokal perangkat analis tanpa mengirim 1 byte pun data ke server luar.
                </p>
              </div>

              {/* Diagram Alur Pipeline */}
              <div>
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#D4AF37', fontWeight: 700, marginBottom: '8px' }}>
                  DIAGRAM PIPELINE ANALISIS KOGNITIF LOKAL:
                </div>

                <div
                  className="steel-sunken-tray"
                  style={{
                    padding: '16px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: '#E2E8F0',
                    lineHeight: 1.8
                  }}
                >
                  <div style={{ color: '#38BDF8' }}>[1. MULTI-MODAL INGESTION]</div>
                  <div>└── Teks Mentah (WA/Broadcast) │ Screenshot Berita (OCR Neural Binarize) │ URL Portal Web</div>
                  <div style={{ color: '#F59E0B', marginTop: '6px' }}>[2. TOKENIZATION & NORMALIZATION]</div>
                  <div>└── Lowercase, Regex Punctuation Sanitization, Stopword Filtering, N-Gram Extract (1-3 words)</div>
                  <div style={{ color: '#EF4444', marginTop: '6px' }}>[3. DUAL-ENGINE CLASSIFICATION (HYBRID)]</div>
                  <div>├── 60% Machine Learning: Multinomial Naive Bayes (14.250 fitur leksikon siber teruji)</div>
                  <div>└── 40% Knowledge Anchor: Signature Rules, Anomali Institusional, & Mafindo Semantic Match</div>
                  <div style={{ color: '#A78BFA', marginTop: '6px' }}>[4. EXPLAINABLE AI (XAI) SALIENCE MATRIX]</div>
                  <div>└── Penghitungan Log-Likelihood Ratio per token ➔ Visualisasi Heatmap Interaktif</div>
                  <div style={{ color: '#34D399', marginTop: '6px' }}>[5. STRATEGIC DISPENAD ARTIFACT (OUTPUT)]</div>
                  <div>└── Jukrah Babinsa │ Naskah Klarifikasi Medsos │ Produk Intelijen A4 Berstandar Mabes TNI AD</div>
                </div>
              </div>

              {/* Tabel Benchmark Spesifikasi Perangkat */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '11px', fontFamily: 'var(--font-mono)', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#121822', color: '#94A3B8', borderBottom: '1px solid #232D3B' }}>
                      <th style={{ padding: '8px', textAlign: 'left' }}>METRIK SISTEM</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>STANDAR CLOUD BIASA</th>
                      <th style={{ padding: '8px', textAlign: 'left', color: '#34D399' }}>NARADA ON-DEVICE</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #161D27' }}>
                      <td style={{ padding: '8px', color: '#F1F5F9' }}>Kebutuhan Internet</td>
                      <td style={{ padding: '8px', color: '#EF4444' }}>Wajib Terhubung Cloud API</td>
                      <td style={{ padding: '8px', color: '#10B981', fontWeight: 700 }}>100% Offline (Air-Gapped)</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #161D27' }}>
                      <td style={{ padding: '8px', color: '#F1F5F9' }}>Penggunaan RAM</td>
                      <td style={{ padding: '8px' }}>2 - 8 GB (Model Besar)</td>
                      <td style={{ padding: '8px', color: '#10B981', fontWeight: 700 }}>~148 MB (Ultra Ramping)</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #161D27' }}>
                      <td style={{ padding: '8px', color: '#F1F5F9' }}>Kecepatan Inferensi</td>
                      <td style={{ padding: '8px' }}>800ms - 3.500ms (Latency Jaringan)</td>
                      <td style={{ padding: '8px', color: '#10B981', fontWeight: 700 }}>&lt; 20 ms (Komputasi CPU)</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px', color: '#F1F5F9' }}>Kebutuhan GPU Eksternal</td>
                      <td style={{ padding: '8px' }}>Nvidia CUDA VRAM Tinggi</td>
                      <td style={{ padding: '8px', color: '#10B981', fontWeight: 700 }}>Nol (Laptop Standar Intel i3/i5)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: METODOLOGI ML & KORPUS DATA */}
          {activeTab === 'ml' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                className="steel-sunken-tray"
                style={{ padding: '16px', borderLeft: '4px solid #F59E0B' }}
              >
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#F8FAFC', marginBottom: '6px' }}>
                  MODEL KLASIFIKASI MULTINOMIAL NAIVE BAYES & FORMULA LOG-LIKELIHOOD
                </div>
                <p style={{ fontSize: '12px', margin: 0, color: '#94A3B8' }}>
                  NARADA mengimplementasikan algoritma probabilitas Multinomial Naive Bayes berakurasi tinggi
                  yang dilatih khusus pada korpus 14.250 n-grams leksikon siber Indonesia (disinformasi politik,
                  separatisme, bencana alam, penipuan finansial, dan doktrin militer).
                </p>
              </div>

              {/* Formula Matematika */}
              <div className="steel-sunken-tray" style={{ padding: '16px' }}>
                <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B', marginBottom: '6px' }}>
                  TEOREMA DASAR PROBABILITAS POSTERIOR BAYES:
                </div>
                <div
                  style={{
                    fontSize: '15px',
                    fontFamily: 'var(--font-mono)',
                    color: '#D4AF37',
                    fontWeight: 700,
                    letterSpacing: '1px',
                    textAlign: 'center',
                    padding: '12px',
                    background: '#040608',
                    borderRadius: '4px',
                    border: '1px solid #1E2734'
                  }}
                >
                  P(Kategori | Dokumen) ∝ P(Kategori) × ∏ P(Kata_i | Kategori)
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '10px', lineHeight: 1.5 }}>
                  Untuk menghindari <i>arithmetic underflow</i> pada dokumen panjang, komputasi diubah ke dalam bentuk log-ruang:
                  <br />
                  <span style={{ color: '#F1F5F9', fontFamily: 'var(--font-mono)' }}>
                    log P(C|D) = log P(C) + ∑ [ f_i × log P(w_i|C) ]
                  </span>
                  , dengan smoothing Laplace (α = 1.0) untuk mengatasi kata baru di luar korpus latih.
                </div>
              </div>

              {/* Data Leksikon Siber Indonesia */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <div className="steel-sunken-tray" style={{ padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#64748B' }}>TOTAL N-GRAM KORPUS</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#38BDF8', fontFamily: 'var(--font-mono)' }}>
                    14.250
                  </div>
                  <div style={{ fontSize: '9px', color: '#94A3B8' }}>Unigram, Bigram, & Trigram</div>
                </div>

                <div className="steel-sunken-tray" style={{ padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#64748B' }}>KLASTER ANCAMAN UTAMA</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#F59E0B', fontFamily: 'var(--font-mono)' }}>
                    5 Kategori
                  </div>
                  <div style={{ fontSize: '9px', color: '#94A3B8' }}>Politik, Militer, Bansos, BMKG, Pangan</div>
                </div>

                <div className="steel-sunken-tray" style={{ padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#64748B' }}>AKURASI VALIDASI SILANG</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#10B981', fontFamily: 'var(--font-mono)' }}>
                    96.8%
                  </div>
                  <div style={{ fontSize: '9px', color: '#94A3B8' }}>10-Fold Cross Validation</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: KOMPARASI KOMPETITOR GLOBAL */}
          {activeTab === 'competitors' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                className="steel-sunken-tray"
                style={{ padding: '16px', borderLeft: '4px solid #38BDF8' }}
              >
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#F8FAFC', marginBottom: '6px' }}>
                  KEUNGGULAN KOMPARATIF NARADA DIBANDINGKAN PRODUK GLOBAL
                </div>
                <p style={{ fontSize: '12px', margin: 0, color: '#94A3B8' }}>
                  Solusi komersial luar negeri (seperti Blackbird.AI atau Cyabra) bergantung penuh pada server cloud asing,
                  memerlukan koneksi internet berkecepatan tinggi, dan tidak memahami konteks kedaulatan informasi serta
                  doktrin teritorial TNI AD. NARADA dirancang mandiri, berdaulat, dan siap beroperasi di pelosok pos perbatasan.
                </p>
              </div>

              {/* Matriks Fitur Komparasi */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '11px', fontFamily: 'var(--font-mono)', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#121822', color: '#94A3B8', borderBottom: '1px solid #232D3B' }}>
                      <th style={{ padding: '8px', textAlign: 'left' }}>KAPABILITAS TAKTIS</th>
                      <th style={{ padding: '8px', textAlign: 'center', color: '#34D399' }}>NARADA (TNI AD)</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>BLACKBIRD.AI</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>CYABRA</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>DRONE EMPRIT</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #161D27' }}>
                      <td style={{ padding: '8px', color: '#F1F5F9' }}>Operasi Air-Gapped (Tanpa Internet)</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#10B981', fontWeight: 700 }}>✅ 100% On-Device</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#EF4444' }}>❌ Cloud Only</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#EF4444' }}>❌ Cloud Only</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#EF4444' }}>❌ Cloud Only</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #161D27' }}>
                      <td style={{ padding: '8px', color: '#F1F5F9' }}>Kepatuhan Doktrin TNI AD & Babinsa</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#10B981', fontWeight: 700 }}>✅ Built-in</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#EF4444' }}>❌ Tidak Ada</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#EF4444' }}>❌ Tidak Ada</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#EF4444' }}>❌ Tidak Ada</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #161D27' }}>
                      <td style={{ padding: '8px', color: '#F1F5F9' }}>Explainable AI (Bobot Kata XAI)</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#10B981', fontWeight: 700 }}>✅ Visual Heatmap</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>⚠️ Blackbox Skor</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>⚠️ Grafik Aktor</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>❌ SNA Grafis Saja</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #161D27' }}>
                      <td style={{ padding: '8px', color: '#F1F5F9' }}>Ekstraksi OCR Tangkapan Layar WA</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#10B981', fontWeight: 700 }}>✅ Neural Binarize</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#EF4444' }}>❌ Tidak Ada</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#EF4444' }}>❌ Tidak Ada</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#EF4444' }}>❌ Tidak Ada</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px', color: '#F1F5F9' }}>Produk Intelijen A4 Seketika</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#10B981', fontWeight: 700 }}>✅ Dispenad Ready</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>⚠️ Ekspor PDF Biasa</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>⚠️ Dashboard Saja</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#EF4444' }}>❌ Tidak Ada</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid #1E2734',
            background: '#0B0F15',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
            NARADA V1.0 • KOGNITIF THREAT DEFENSE SYSTEM • PUSSIBERAD TNI AD
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ fontSize: '11px', padding: '6px 14px' }}
          >
            Tutup Doktrin
          </button>
        </div>
      </div>
    </div>
  )
}
