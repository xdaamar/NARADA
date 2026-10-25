# PRD DEFINITIF UI/UX — NARADA COGNITIVE THREAT DEFENSE SYSTEM
## Product Requirements Document: Interface & Experience Design

**Dokumen:** `PRD_UI_UX_DEFINITIVE.md`  
**Proyek:** NARADA — Platform Intelijen Kognitif TNI AD  
**Event:** Kartika Cyber Hackathon 2026 × PUSSIBERAD × Codepolitan  
**Status:** ✅ 100% BULLETPROOF & LOCKED — Acuan Tunggal Seluruh Modul  
**Versi:** 2.3 — Hasil Evaluasi Visual Nyata Pengguna: TACTICAL MILITARY LIGHT MODE  
**Referensi Visual:** Screenshot Resmi Situational Awareness Command TNI AD  
**Berlaku untuk:** Sprint 5A (Revised) dan seterusnya sampai demonstrasi final  

---

> [!IMPORTANT]
> **PROTOKOL DOKTRIN PENGEMBANGAN SISTEM (MANDATORI):**  
> Dokumen ini adalah **satu-satunya acuan UI/UX mutlak**. Berdasarkan hasil peninjauan langsung pada layar pengguna, konsep dark/slate murahan telah ditinggalkan. NARADA mengadopsi tema **Tactical Military Light Mode** (Situational Awareness Command) yang jernih, tajam, profesional, dan berwibawa tinggi.

---

## BAGIAN 1: STRATEGIC SPARRING & ADVERSARIAL PRE-MORTEM

### 1.1 Pre-Mortem: Mengapa Dark Mode dan Slate Gelap Ditinggalkan

1. **Efek Pucat & Kusam ("Maksain"):** Mode gelap keabuan membuat elemen kartu terlihat kotor, pucat, dan tidak berwibawa di layar monitor ruangan komando.
2. **Keterbacaan Dokumen Formal:** Sistem ini digunakan oleh perwira dan analis militer untuk memverifikasi dokumen resmi, siaran pers, dan laporan berita. Mode terang (*Light Mode*) dengan latar putih keabuan bersih (`#F4F6F9` / `#F8FAFC`) dan kartu putih murni (`#FFFFFF`) memberikan keterbacaan tajam (*high-contrast operational clarity*) layaknya dashboard komando C4ISR modern.
3. **Pemberantasan Emoji 100%:** Seluruh emoji Unicode digantikan dengan ikon vektor profesional presisi (`lucide-react` dan `@phosphor-icons/react`).

---

## BAGIAN 2: FILOSOFI DESAIN & IDENTITAS VISUAL

### 2.1 Konsep Utama: "Tactical Military Light Mode (Situational Awareness)"

```
┌────────────────────────────────────────────────────────────────────────┐
│                   TACTICAL MILITARY LIGHT MODE                         │
├────────────────────────────────────────────────────────────────────────┤
│ • Latar Kanvas:  Off-white keabuan taktis sejuk (#F4F6F9 / #F8FAFC)     │
│ • Kartu & Panel: Putih murni (#FFFFFF) dengan border tegas (#E2E8F0)   │
│ • Teks Utama:    Deep Navy Charcoal (#0F172A) — Super Tajam            │
│ • Aksen Utama:   Merah Darah PUSSIBERAD (#C8102E) & Emas Crest (#D4A017)│
│ • Aksen Taktis:  Garis diagonal slashes /// dan strip hazard sudut     │
└────────────────────────────────────────────────────────────────────────┘
```

**Kata Kunci Doktrin Visual:** `Presisi · Situational Awareness · Otoritas · Kecepatan Taktis`

---

## BAGIAN 3: DESIGN TOKENS & COLOR SYSTEM

### 3.1 Token Warna Definitif (CSS Variables)

```css
:root {
  /* ─── KANVAS & LAPISAN KEDALAMAN (LIGHT TACTICAL LAYERS) ─── */
  --bg-canvas:       #F4F6F9;   /* Latar terdalam aplikasi (viewport root) */
  --bg-base:         #F8FAFC;   /* Latar halaman kerja utama */
  --bg-surface:      #FFFFFF;   /* Sidebar, TopBar, Header panel */
  --bg-elevated:     #FFFFFF;   /* Kartu utama, dialog modal, dropdown */
  --bg-card:         #FFFFFF;   /* Sub-kartu, baris daftar data */
  --bg-card-subtle:  #F8FAFC;   /* Inset container, preview box, table header */
  --bg-card-hover:   #F1F5F9;   /* Hover interaktif */
  --bg-overlay:      rgba(15, 23, 42, 0.45); /* Backdrop modal dengan blur */

  /* ─── GARIS BATAS (CRISP TACTICAL BORDERS) ─── */
  --border-subtle:   #E2E8F0;   /* Garis pemisah standar antar kartu */
  --border-moderate: #CBD5E1;   /* Garis batas input, chip aktif */
  --border-strong:   #94A3B8;   /* Batas fokus dan hover aktif */
  --border-red:      rgba(200, 16, 46, 0.25); /* Garis batas elemen kritis */
  --border-gold:     rgba(212, 160, 23, 0.35); /* Garis batas elemen komando */

  /* ─── TIPOGRAFI & TEKS KONTRAS TINGGI ─── */
  --text-primary:    #0F172A;   /* Deep Navy Charcoal — Keterbacaan tajam maksimal */
  --text-secondary:  #475569;   /* Slate Medium — Paragraf, deskripsi, subtitle */
  --text-tertiary:   #94A3B8;   /* Muted Slate — Timestamp, breadcrumb, label kecil */
  --text-disabled:   #CBD5E1;   /* Status nonaktif */
  --text-inverse:    #FFFFFF;   /* Teks kontras di atas tombol solid merah/gelap */

  /* ─── AKSEN INSTITUSIONAL PUSSIBERAD TNI AD ─── */
  --brand-red:        #C8102E;   /* Merah Darah Perjuangan (CTA utama) */
  --brand-red-light:  #DC2626;   /* Merah status hover */
  --brand-red-subtle: #FFF1F2;   /* Latar merah redup untuk Nav Active & DEFCON */
  --brand-red-dim:    rgba(200, 16, 46, 0.08); /* Latar transparan tombol/badge */
  --brand-red-glow:   rgba(200, 16, 46, 0.20); /* Pendaran fokus */

  --accent-gold:      #D4A017;   /* Emas Lambang Kartika Crest */
  --accent-gold-dark: #B45309;   /* Emas tua untuk teks aksen di latar terang */
  --accent-gold-subtle:#FEFCE8;  /* Latar emas redup */
  --accent-gold-dim:  rgba(212, 160, 23, 0.12);

  /* ─── STATUS VONIS INTELIJEN SEMANTIK (LIGHT GRADE) ─── */
  /* 1. HOAKS / ANCAMAN KRITIS (Crimson) */
  --verdict-hoax:        #DC2626;
  --verdict-hoax-text:   #991B1B;
  --verdict-hoax-bg:     #FEF2F2;
  --verdict-hoax-border: #FCA5A5;

  /* 2. FAKTA / RESMI TERVERIFIKASI (Emerald) */
  --verdict-fact:        #059669;
  --verdict-fact-text:   #065F46;
  --verdict-fact-bg:     #ECFDF5;
  --verdict-fact-border: #6EE7B7;

  /* 3. MERAGUKAN / PERLU VERIFIKASI (Tactical Amber) */
  --verdict-doubt:        #D97706;
  --verdict-doubt-text:   #92400E;
  --verdict-doubt-bg:     #FFFBEB;
  --verdict-doubt-border: #FCD34D;

  /* 4. DISINFORMASI / PROPAGANDA TERSTRUKTUR (Deep Violet) */
  --verdict-disinfo:        #7C3AED;
  --verdict-disinfo-text:   #5B21B6;
  --verdict-disinfo-bg:     #F5F3FF;
  --verdict-disinfo-border: #C4B5FD;

  /* ─── TELEMETRI JARINGAN ─── */
  --telemetry-online:   #10B981;
  --telemetry-degraded: #F59E0B;
  --telemetry-offline:  #EF4444;

  /* ─── UKURAN & RADIUS SUDUT ─── */
  --sidebar-width: 250px;
  --topbar-height: 56px;
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --radius-pill: 9999px;

  /* ─── BAYANGAN ELEGAN (SOFT LIGHT SHADOWS) ─── */
  --shadow-sm:        0 1px 2px rgba(15, 23, 42, 0.05);
  --shadow-card:      0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);
  --shadow-elevated:  0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.05);
  --shadow-modal:     0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08);
}
```

---

## BAGIAN 4: SISTEM TIPOGRAFI & STRUKTUR HIERARKI

1. **Heading & Judul Taktis:** `'Rajdhani', sans-serif;` (Bobot 600, 700)
2. **Body & Teks Antarmuka:** `'Inter', system-ui, sans-serif;` (Bobot 400, 500, 600)
3. **Data Teknis & Forensik:** `'JetBrains Mono', monospace;` (Bobot 400, 600)

---

## BAGIAN 5: SISTEM IKON (PEMBERANTASAN EMOJI 100%)

- **Ikon Navigasi & Tindakan Umum:** `lucide-react` (strokeWidth: 1.75)
- **Ikon Status Vonis & Lencana Taktis:** `@phosphor-icons/react`
- DILARANG KERAS menggunakan emoji Unicode.

---

## BAGIAN 6: DETAIL SPESIFIKASI KOMPONEN INTI

### 6.1 Bilah Samping (Sidebar Navigation)
- Background `#FFFFFF`, garis batas kanan `1px solid #E2E8F0`.
- Logo Header: Electrified Golden Globe Crest TNI AD (40×40px) + "NARADA" (Rajdhani 700 22px `#0F172A`) + "KOGNITIF AI - V1.0".
- Section Label: `MODUL UTAMA` (Rajdhani 600 11px `#94A3B8`) dengan aksen garis diagonal emas.
- Nav Item Active: Background `#FFF1F2`, border `1px solid rgba(200, 16, 46, 0.25)`, border-radius `8px`, teks dan ikon berwarna Merah `#C8102E`, font-weight 700.
- Nav Item Inactive: Teks `#475569`, ikon opacity 0.8. Hover: background `#F8FAFC`, teks `#0F172A`.
- Footer: Status card `#F8FAFC`, border `#E2E8F0`, dot hijau berkedip, teks `SISTEM AKTIF / AI ENGINE ONLINE`, tulisan `KARTIKA CYBER HACKATHON TNI AD - 2026 TANGGUH • CERDAS • WASPADA`, strip diagonal emas di sudut kiri bawah.

### 6.2 Bilah Atas (TopBar Utility)
- Background `#FFFFFF`, garis batas bawah `1px solid #E2E8F0`, tinggi `56px`.
- Kiri: Aksen emas `///` (`#D4A017`), teks `SITUATIONAL AWARENESS` (Rajdhani 700 17px `#0F172A`), sub-kategori `ANALISIS | DETEKSI | VERIFIKASI | LINDUNGI INFORMASI` (`#64748B`).
- Kanan: Status pill `● SYSTEM ONLINE` (`#059669` pada `#ECFDF5`), waktu militer `23 Okt 2026 — 22:57:33 WIB` (JetBrains Mono `#475569`).

---

## BAGIAN 7: USER FLOW & VERDICT POPUP (LIGHT THEME)

- **Center Modal Desktop:** Background `#FFFFFF`, border `1px solid #E2E8F0`, shadow modal lembut, radius `20px`.
- **Hero Icon:** `WarningOctagon` (Crimson) untuk hoaks, `CheckCircle` (Emerald) untuk fakta.
- **Keyakinan Mesin:** Bar animasi warna merah/hijau dengan font JetBrains Mono.
- **Tombol Aksi:** `[Salin Format Klarifikasi WhatsApp]` (Outline Emerald) dan `[Lihat Bukti Lengkap]` (Solid Merah).

---

## BAGIAN 8: DETAIL SPESIFIKASI HALAMAN DASHBOARD (SESUAI REFERENSI)

```
┌────────────────────────────────────────────────────────────────────────┐
│ [Crest] NARADA       /// SITUATIONAL AWARENESS          ● ONLINE  WIB  │
│ KOGNITIF AI - V1.0   ANALISIS | DETEKSI | VERIFIKASI                   │
├────────────────────────────────────────────────────────────────────────┤
│ [SITUATIONAL AWARENESS COMMAND] [PUSSIBERAD TNI AD]     🌐 22.57.31 WIB│
│ COGNITIVE THREAT SITUATIONAL AWARENESS                                 │
│ Pusat komando pemantauan ancaman kognitif, disinformasi siber...       │
├────────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ [Shield] DEFCON 1 - SIAGA MERAH (DARURAT KOGNITIF: 1 KRITIS)       │ │
│ │ Terdeteksi 1 konten ancaman kritis dengan indikasi hoaks...        │ │
│ │ [Tanggapi Krisis di Analyzer →]     [Silhouette Map Indonesia]     │ │
│ └────────────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────┤
│ ⚡ TACTICAL QUICK LAUNCHPAD (AKSI CEPAT INTELIJEN)                     │
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────┐ │
│ │ [⚡] 1. Analyzer  → │ │ [~] 2. Nexus Radar → │ │ [≡] 3. Produk A4 →│ │
│ └──────────────────────┘ └──────────────────────┘ └──────────────────┘ │
├────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────────┐  │
│ │ TOTAL KONTEN │ │ ANCAMAN DET. │ │ ANCAMAN KRIT.│ │ ANCAMAN TINGGI │  │
│ │      4       │ │      2       │ │      1       │ │       1        │  │
│ │   [MiniBar]  │ │ 50% [MiniBar]│ │ [MiniBar]    │ │ [MiniBar]      │  │
│ └──────────────┘ └──────────────┘ └──────────────┘ └────────────────┘  │
├────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐ ┌───────────────────────────┐ │
│ │ 📈 TREN AKUMULASI (TIMELINE) [24H/7D]│ │ 📊 DISTRIBUSI 5 KATEGORI  │ │
│ │ [Line Chart Putih Grid Halus]        │ │ [Donut Chart + Crest]     │ │
│ │ #1 (19:46) ... #4 (19:47)            │ │ Hoaks 50% | Netral 50%    │ │
│ └──────────────────────────────────────┘ └───────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────┤
│                                /// INFORMASI BENAR, KEAMANAN NEGARA    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## BAGIAN 9: IMPLEMENTATION ROADMAP (SPRINT 5A REVISED)

- **Sprint 5A:** Tactical Military Light Mode (Full CSS overhaul, Sidebar, TopBar, DEFCON 1 Banner, Quick Launchpad, Stat Cards, Charts Recharts Light).
- **Sprint 5B:** Core Components Rebuild (OmniInput side-by-side OCR preview, XAI Explainer, DISARM Taxonomy).
- **Sprint 5C:** Verdict Popup & Real-Time Telemetry.
- **Sprint 5D:** Profiler, Nexus Graph, Reports (@media print A4), and Settings Harmonization.

---

*PRD Versi 2.3 — Terkunci Sesuai Referensi Visual Screenshot Situational Awareness Command TNI AD*
