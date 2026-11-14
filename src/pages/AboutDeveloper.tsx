import { useState } from 'react'
import devAvatarImg from '../assets/developer_avatar.jpg'
import {
  User,
  MapPin,
  School,
  Users,
  Globe,
  Mail,
  Phone,
  Video,
  Shield,
  Radio,
  Cpu,
  FileCheck,
  Maximize2,
  X,
  Sparkles,
  CheckCircle,
  Terminal
} from 'lucide-react'

export default function AboutDeveloper() {
  const [isPhotoZoomed, setIsPhotoZoomed] = useState<boolean>(false)

  return (
    <div className="fade-in" style={{ paddingBottom: '40px' }}>
      {/* ─── Grid Utama: Profil Pengembang (Kiri) & Dossier Proyek (Kanan) ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(340px, 400px) 1fr',
        gap: '20px',
        alignItems: 'start'
      }}>
        {/* ─── KOLOM KIRI: KARTU BIODATA PENGEMBANG ─── */}
        <div className="steel-chassis-card" style={{ padding: '24px 20px', position: 'relative' }}>
          <span className="bolt-tl" />
          <span className="bolt-tr" />
          <span className="bolt-bl" />
          <span className="bolt-br" />

          {/* Header Kartu */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            paddingBottom: '12px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={15} color="var(--accent-gold)" />
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '13px',
                fontWeight: 800,
                color: '#F1F5F9',
                letterSpacing: '1px',
                textTransform: 'uppercase'
              }}>
                BIODATA PENGEMBANG
              </span>
            </div>
            <span style={{
              fontSize: '9px',
              fontFamily: 'var(--font-mono)',
              padding: '2px 7px',
              borderRadius: '3px',
              background: 'rgba(212, 160, 23, 0.15)',
              border: '1px solid rgba(212, 160, 23, 0.35)',
              color: 'var(--accent-gold)',
              fontWeight: 700
            }}>
              SINGLE FIGHTER
            </span>
          </div>

          {/* Container Foto Profil Interaktif */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '18px',
            position: 'relative'
          }}>
            {/* Foto Profil dengan Bevel Plat Baja & Baut */}
            <div
              style={{
                position: 'relative',
                cursor: 'pointer',
                borderRadius: '8px',
                padding: '4px',
                background: 'linear-gradient(170deg, #2D394A 0%, #17202C 50%, #0D131B 100%)',
                borderTop: '2px solid rgba(255, 255, 255, 0.28)',
                borderLeft: '2px solid #3A4A5E',
                borderRight: '2px solid #141C26',
                borderBottom: '2px solid #0A0E15',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.85), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
              }}
              onClick={() => setIsPhotoZoomed(true)}
              title="Klik untuk memperbesar foto profil pengembang"
            >
              <div style={{
                width: '180px',
                height: '180px',
                borderRadius: '6px',
                overflow: 'hidden',
                background: '#090C10',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <img
                  src={devAvatarImg}
                  alt="Damar Budi Prasetyo - Developer Avatar"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    imageRendering: 'pixelated',
                    transition: 'transform 0.3s ease'
                  }}
                />

                {/* Overlay Hint Perbesar */}
                <div style={{
                  position: 'absolute',
                  bottom: '6px',
                  right: '6px',
                  background: 'rgba(9, 12, 16, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  borderRadius: '3px',
                  padding: '3px 6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '9px',
                  color: '#CBD5E1',
                  fontFamily: 'var(--font-mono)'
                }}>
                  <Maximize2 size={10} color="var(--accent-gold)" />
                  <span>ZOOM</span>
                </div>
              </div>
            </div>
          </div>

          {/* Rincian Biodata (Format Rapi Mil-Spec) */}
          <div style={{
            background: 'linear-gradient(180deg, #101622 0%, #090D13 100%)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            borderLeft: '1px solid #1C2636',
            borderRight: '1px solid #121822',
            borderBottom: '2px solid #06090D',
            borderRadius: '6px',
            padding: '12px 14px',
            boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.85)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            marginBottom: '18px'
          }}>
            {/* Nama Lengkap */}
            <div>
              <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748B', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                NAMA LENGKAP PENGEMBANG:
              </span>
              <div style={{
                fontSize: '14px',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                color: '#F8FAFC',
                letterSpacing: '0.6px',
                marginTop: '1px'
              }}>
                Damar Budi Prasetyo
              </div>
            </div>

            {/* Asal Daerah */}
            <div style={{ borderTop: '1px dashed rgba(255, 255, 255, 0.07)', paddingTop: '6px' }}>
              <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748B', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={10} color="var(--accent-gold)" /> ASAL DAERAH:
              </span>
              <div style={{ fontSize: '11px', color: '#E2E8F0', fontWeight: 600, fontFamily: 'var(--font-mono)', marginTop: '1px' }}>
                Sukoharjo, Jawa Tengah
              </div>
            </div>

            {/* Asal Sekolah */}
            <div style={{ borderTop: '1px dashed rgba(255, 255, 255, 0.07)', paddingTop: '6px' }}>
              <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748B', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <School size={10} color="#60A5FA" /> ASAL SEKOLAH:
              </span>
              <div style={{ fontSize: '11px', color: '#E2E8F0', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '1px' }}>
                SMK Muhammadiyah 1 Sukoharjo
              </div>
            </div>

            {/* Susunan Tim */}
            <div style={{ borderTop: '1px dashed rgba(255, 255, 255, 0.07)', paddingTop: '6px' }}>
              <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748B', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Users size={10} color="#10B981" /> SUSUNAN TIM:
              </span>
              <div style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'var(--font-mono)', marginTop: '1px' }}>
                - (Solo Developer / Perorangan Mandiri)
              </div>
            </div>

            {/* Kategori Lomba */}
            <div style={{ borderTop: '1px dashed rgba(255, 255, 255, 0.07)', paddingTop: '6px' }}>
              <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#64748B', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Shield size={10} color="#EF4444" /> KATEGORI LOMBA:
              </span>
              <div style={{
                fontSize: '11px',
                color: '#FCA5A5',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                marginTop: '1px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span>SIBER SOSIAL</span>
                <span style={{ fontSize: '8.5px', background: 'rgba(239, 68, 68, 0.15)', padding: '1px 5px', borderRadius: '2px', border: '1px solid rgba(239, 68, 68, 0.35)' }}>
                  OFFICIAL HACKATHON
                </span>
              </div>
            </div>
          </div>

          {/* Saluran Kontak Resmi (Kemas Sebagai Icon Berplat Besi Beveled) */}
          <div>
            <div style={{
              fontSize: '9.5px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              color: '#94A3B8',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Terminal size={11} color="var(--accent-gold)" />
              SALURAN KOMUNIKASI & KONTAK:
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px'
            }}>
              {/* Website */}
              <a
                href="https://www.codecraftstudio.my.id/"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '4px',
                  background: 'linear-gradient(180deg, #243042 0%, #141C26 100%)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.2)',
                  borderBottom: '2px solid #0B0F15',
                  borderLeft: '1px solid #2B3848',
                  borderRight: '1px solid #141C26',
                  color: '#E2E8F0',
                  textDecoration: 'none',
                  fontSize: '10.5px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  boxShadow: '0 2px 5px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                  transition: 'all 0.18s ease'
                }}
                title="Kunjungi Website Resmi Pengembang"
              >
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '3px',
                  background: 'linear-gradient(180deg, #1E2734 0%, #0E141E 100%)',
                  border: '1px solid #334155',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#60A5FA',
                  flexShrink: 0
                }}>
                  <Globe size={13} />
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '8px', color: '#64748B' }}>PORTFOLIO</div>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Website Studio</div>
                </div>
              </a>

              {/* Email */}
              <a
                href="mailto:damarbudiprasetyo714@gmail.com"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '4px',
                  background: 'linear-gradient(180deg, #243042 0%, #141C26 100%)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.2)',
                  borderBottom: '2px solid #0B0F15',
                  borderLeft: '1px solid #2B3848',
                  borderRight: '1px solid #141C26',
                  color: '#E2E8F0',
                  textDecoration: 'none',
                  fontSize: '10.5px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  boxShadow: '0 2px 5px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                  transition: 'all 0.18s ease'
                }}
                title="Kirim Pesan Email ke Pengembang"
              >
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '3px',
                  background: 'linear-gradient(180deg, #1E2734 0%, #0E141E 100%)',
                  border: '1px solid #334155',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#F59E0B',
                  flexShrink: 0
                }}>
                  <Mail size={13} />
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '8px', color: '#64748B' }}>EMAIL RESMI</div>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Kirim Email</div>
                </div>
              </a>

              {/* WhatsApp */}
              <a
                href="https://wa.me/6287872926689"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '4px',
                  background: 'linear-gradient(180deg, #243042 0%, #141C26 100%)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.2)',
                  borderBottom: '2px solid #0B0F15',
                  borderLeft: '1px solid #2B3848',
                  borderRight: '1px solid #141C26',
                  color: '#E2E8F0',
                  textDecoration: 'none',
                  fontSize: '10.5px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  boxShadow: '0 2px 5px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                  transition: 'all 0.18s ease'
                }}
                title="Hubungi Pengembang via WhatsApp (+62 878-7292-6689)"
              >
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '3px',
                  background: 'linear-gradient(180deg, #1E2734 0%, #0E141E 100%)',
                  border: '1px solid #334155',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10B981',
                  flexShrink: 0
                }}>
                  <Phone size={13} />
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '8px', color: '#64748B' }}>WHATSAPP</div>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>+62 878-7292-6689</div>
                </div>
              </a>

              {/* TikTok */}
              <a
                href="https://www.tiktok.com/@ccs.id"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '4px',
                  background: 'linear-gradient(180deg, #243042 0%, #141C26 100%)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.2)',
                  borderBottom: '2px solid #0B0F15',
                  borderLeft: '1px solid #2B3848',
                  borderRight: '1px solid #141C26',
                  color: '#E2E8F0',
                  textDecoration: 'none',
                  fontSize: '10.5px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  boxShadow: '0 2px 5px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                  transition: 'all 0.18s ease'
                }}
                title="Kunjungi Saluran Kreator TikTok (@ccs.id)"
              >
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '3px',
                  background: 'linear-gradient(180deg, #1E2734 0%, #0E141E 100%)',
                  border: '1px solid #334155',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#EC4899',
                  flexShrink: 0
                }}>
                  <Video size={13} />
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '8px', color: '#64748B' }}>TIKTOK CREATOR</div>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@ccs.id</div>
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* ─── KOLOM KANAN: SPESIFIKASI PROYEK & KARYA INOVASI LOMBA ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Card Deskripsi Proyek */}
          <div className="steel-chassis-card" style={{ padding: '24px 22px', position: 'relative' }}>
            <span className="bolt-tl" />
            <span className="bolt-tr" />
            <span className="bolt-bl" />
            <span className="bolt-br" />

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              paddingBottom: '12px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={16} color="var(--accent-gold)" />
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '14px',
                  fontWeight: 800,
                  color: '#F1F5F9',
                  letterSpacing: '1px',
                  textTransform: 'uppercase'
                }}>
                  TENTANG PROYEK: NARADA (KOGNITIF AI V1.0)
                </span>
              </div>
              <span style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                color: '#10B981',
                background: 'rgba(16, 185, 129, 0.12)',
                padding: '2px 8px',
                borderRadius: '3px',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                fontWeight: 700
              }}>
                100% AIR-GAPPED READY
              </span>
            </div>

            {/* Narasi Deskripsi Proyek Berkualitas Tinggi */}
            <div style={{
              fontSize: '12.5px',
              color: '#CBD5E1',
              lineHeight: 1.65,
              fontFamily: 'var(--font-sans)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <p style={{ margin: 0 }}>
                <strong>NARADA</strong> adalah platform pertahanan ruang kognitif dan sistem peringatan dini berbasis kecerdasan buatan (AI) yang dibangun khusus untuk menghadapi tantangan <strong>Siber Sosial</strong> dalam kompetisi <em>Kartika Cyber Hackathon 2026 (PUSSIBERAD TNI AD × CODEPOLITAN)</em>.
              </p>
              <p style={{ margin: 0 }}>
                Di era peperangan asimetris modern (*hybrid cognitive warfare*), ancaman siber tidak hanya menyerang infrastruktur jaringan, melainkan menyasar persepsi kognitif prajurit dan masyarakat melalui kampanye hoaks terorganisir, agitasi emosi publik (*rage baiting*), manipulasi isu kedaulatan, serta mobilisasi buzzer bayaran (*astroturfing*). 
              </p>
              <p style={{ margin: 0 }}>
                Platform ini menggabungkan penyerapan telemetri OSINT multi-kanal otomatis, klusterisasi kesamaan teks Jaccard untuk mendeteksi sindikat copypasta, penguraian bias psikologis, generator narasi tandingan kedinasan militer, serta pencetakan laporan intelijen komando A4 berstempel kriptografis SHA-256 yang sepenuhnya berjalan mandiri tanpa kebocoran data ke pihak ketiga.
              </p>
            </div>

            {/* 4 Pilar Fitur Kunci Platform */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
              marginTop: '18px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              {/* Pilar 1 */}
              <div style={{
                background: 'linear-gradient(180deg, #121924 0%, #0A0F16 100%)',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                borderBottom: '2px solid #06090D',
                borderLeft: '1px solid #1C2636',
                borderRight: '1px solid #10151E',
                borderRadius: '5px',
                padding: '12px',
                boxShadow: '0 2px 5px rgba(0, 0, 0, 0.6)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <Radio size={14} color="#60A5FA" />
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#F1F5F9' }}>
                    14-Kanal Live OSINT Radar
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  Menyerap berita dan tren pencarian secara deterministik dari TurnBackHoax, Antara News, Google Trends, dan pangkalan data berita kementerian dengan *circuit breaker* mandiri.
                </p>
              </div>

              {/* Pilar 2 */}
              <div style={{
                background: 'linear-gradient(180deg, #121924 0%, #0A0F16 100%)',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                borderBottom: '2px solid #06090D',
                borderLeft: '1px solid #1C2636',
                borderRight: '1px solid #10151E',
                borderRadius: '5px',
                padding: '12px',
                boxShadow: '0 2px 5px rgba(0, 0, 0, 0.6)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <Cpu size={14} color="#F59E0B" />
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#F1F5F9' }}>
                    Forensik Buzzer & Astroturfing
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  Menganalisis konten media sosial (TikTok, YouTube, Instagram, Threads) secara in-app dengan algoritma tokenisasi leksikal Jaccard untuk membongkar sindikat mobilisasi opini.
                </p>
              </div>

              {/* Pilar 3 */}
              <div style={{
                background: 'linear-gradient(180deg, #121924 0%, #0A0F16 100%)',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                borderBottom: '2px solid #06090D',
                borderLeft: '1px solid #1C2636',
                borderRight: '1px solid #10151E',
                borderRadius: '5px',
                padding: '12px',
                boxShadow: '0 2px 5px rgba(0, 0, 0, 0.6)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <Sparkles size={14} color="var(--accent-gold)" />
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#F1F5F9' }}>
                    Doktrin Narasi Tandingan
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  Merumuskan kontra-opini 4-kanal (Siaran Pers Komando, Pesan Khusus Prajurit/Persit, Rilis Ringkas Medsos, Imbauan Kamtibmas Tokoh Masyarakat) berbasis rujukan resmi.
                </p>
              </div>

              {/* Pilar 4 */}
              <div style={{
                background: 'linear-gradient(180deg, #121924 0%, #0A0F16 100%)',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                borderBottom: '2px solid #06090D',
                borderLeft: '1px solid #1C2636',
                borderRight: '1px solid #10151E',
                borderRadius: '5px',
                padding: '12px',
                boxShadow: '0 2px 5px rgba(0, 0, 0, 0.6)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <FileCheck size={14} color="#10B981" />
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#F1F5F9' }}>
                    Produk Intelijen A4 Bersegel SHA-256
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  Ekspor otomatis telaahan staf intelijen militer siap cetak standar A4 Dispenad dengan hash audit kriptografis 64-karakter untuk rantai komando taktis.
                </p>
              </div>
            </div>
          </div>

          {/* Card Landasan Arsitektur & Prinsip Pengerjaan */}
          <div className="steel-chassis-card" style={{ padding: '20px 22px', position: 'relative' }}>
            <span className="bolt-tl" />
            <span className="bolt-tr" />
            <span className="bolt-bl" />
            <span className="bolt-br" />

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '12px',
                fontWeight: 800,
                color: '#F1F5F9',
                letterSpacing: '1px',
                textTransform: 'uppercase'
              }}>
                KOMITMEN REKAYASA SISTEM & KEPATUHAN AIR-GAP
              </span>
              <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--accent-gold)' }}>
                LATENSI INFERENSI: &lt; 15 MS
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px'
            }}>
              <div style={{
                background: '#090D13',
                border: '1px solid #1C2636',
                borderRadius: '4px',
                padding: '10px',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8)'
              }}>
                <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                  <CheckCircle size={11} /> 100% Zero-Cloud Dependency
                </div>
                <div style={{ fontSize: '10px', color: '#94A3B8', lineHeight: 1.4 }}>
                  Berjalan penuh di lingkungan terisolasi (*air-gapped*), tidak memerlukan API komersial berbayar ataupun pengiriman data ke server eksternal.
                </div>
              </div>

              <div style={{
                background: '#090D13',
                border: '1px solid #1C2636',
                borderRadius: '4px',
                padding: '10px',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8)'
              }}>
                <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#60A5FA', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                  <CheckCircle size={11} /> 60 FPS Tactical Engine
                </div>
                <div style={{ fontSize: '10px', color: '#94A3B8', lineHeight: 1.4 }}>
                  Virtualisasi viewport terkurasi dengan konsumsi memori rendah, anti-lag, dan respons transisi seketika tanpa stutter.
                </div>
              </div>

              <div style={{
                background: '#090D13',
                border: '1px solid #1C2636',
                borderRadius: '4px',
                padding: '10px',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8)'
              }}>
                <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                  <CheckCircle size={11} /> Doktrin Plat Baja Militer
                </div>
                <div style={{ fontSize: '10px', color: '#94A3B8', lineHeight: 1.4 }}>
                  Estetika instrumen C2 berwibawa, anti-glow neon norak, beveled dual-edge, baut heksagonal, dan tipografi tegas berkontras tinggi.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 3. Modal Lightbox Foto Profil Membesar (Saat Avatar Diklik) ─── */}
      {isPhotoZoomed && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 12, 0.88)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px'
          }}
          onClick={() => setIsPhotoZoomed(false)}
        >
          <div
            className="steel-chassis-card"
            style={{
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              position: 'relative',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95), inset 0 1px 1px rgba(255, 255, 255, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="bolt-tl" />
            <span className="bolt-tr" />
            <span className="bolt-bl" />
            <span className="bolt-br" />

            {/* Header Modal */}
            <div style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              paddingBottom: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={15} color="var(--accent-gold)" />
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '13px',
                  fontWeight: 800,
                  color: '#F1F5F9',
                  letterSpacing: '0.8px'
                }}>
                  FOTO PROFIL PENGEMBANG (RESOLUSI PENUH)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsPhotoZoomed(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid #334155',
                  borderRadius: '3px',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Tutup foto"
              >
                <X size={15} />
              </button>
            </div>

            {/* Foto Diperbesar */}
            <div style={{
              width: '320px',
              height: '320px',
              maxWidth: '100%',
              borderRadius: '8px',
              overflow: 'hidden',
              background: '#090C10',
              border: '2px solid #334155',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img
                src={devAvatarImg}
                alt="Damar Budi Prasetyo - Enlarged"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  imageRendering: 'pixelated'
                }}
              />
            </div>

            {/* Teks Misterius di Bawah Foto */}
            <div style={{
              background: 'linear-gradient(180deg, #1C120B 0%, #0D0704 100%)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: '5px',
              padding: '10px 14px',
              color: '#FDE68A',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              textAlign: 'center',
              lineHeight: 1.5,
              boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.8)'
            }}>
              "Ga Pake Foto Asli Karna Si Dev Ingin Terlihat Misterius, wkwkwk"
              <div style={{ fontSize: '9px', color: '#94A3B8', marginTop: '4px', fontWeight: 500 }}>
                Damar Budi Prasetyo — SMK Muhammadiyah 1 Sukoharjo
              </div>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsPhotoZoomed(false)}
              style={{ width: '100%', justifyContent: 'center', fontSize: '11px' }}
            >
              Tutup Tampilan Foto
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
