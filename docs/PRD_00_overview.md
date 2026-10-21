# PRD-00: PROJECT OVERVIEW
## NARADA — Platform Intelijen Ancaman Kognitif Berbasis AI

---

## 1. Identitas Proyek

| Item | Detail |
|------|--------|
| **Nama Produk** | NARADA |
| **Nama Lengkap** | Platform Intelijen Ancaman Kognitif Berbasis AI |
| **Versi** | 1.0.0 |
| **Kategori Lomba** | Siber Sosial (Cognitive Domain) |
| **Lomba** | Kartika Cyber Hackathon 2026 |
| **Penyelenggara** | PUSSIBERAD TNI AD × CODEPOLITAN |
| **Deadline Submission** | ~November 2026 |

---

## 2. Problem Statement

**Fakta:**
- BSSN mencatat 5.2 miliar anomali siber pada 2025 di Indonesia
- Disinformasi, hoaks, buzzer, dan propaganda menjadi ancaman strategis yang diakui Presiden dan petinggi TNI
- Platform media sosial (Instagram, X, TikTok, Facebook, WhatsApp) menjadi vektor utama penyebaran ancaman kognitif
- Belum ada tool terpadu yang dirancang khusus untuk analis siber militer Indonesia yang bisa mendeteksi + memverifikasi ancaman kognitif dari berbagai sumber

**Gap yang NARADA isi:**
> Analis siber TNI AD butuh satu tool yang bisa menerima input dari berbagai platform (URL, screenshot, teks), menganalisis kontennya dengan AI, memverifikasi terhadap database fakta nasional, dan menghasilkan laporan intelijen yang siap dilaporkan — semuanya tanpa server pribadi.

---

## 3. Target Pengguna

| Persona | Kebutuhan |
|---------|-----------|
| **Analis Siber Satuan TNI AD** | Tool untuk identifikasi cepat ancaman kognitif dari berbagai platform |
| **Pimpinan Satuan** | Laporan intelijen yang jelas dan actionable |
| **Personel Penerangan** | Deteksi buzzer/propaganda untuk persiapan counter-narrative |

---

## 4. Filosofi Nama

**NARADA** — Dari mitologi Hindu-Nusantara. Narada adalah dewa yang menjaga kebenaran informasi dan mengetahui segala yang terjadi di dunia. NARADA hadir sebagai "penjaga kebenaran digital" untuk satuan TNI AD.

---

## 5. Core Value Proposition

1. **Multi-Input** — URL, screenshot (OCR), teks, file. Kompatibel dengan SEMUA platform medsos
2. **AI Engine** — ML classifier (TF-IDF + Naive Bayes) + rule-based NLP Bahasa Indonesia
3. **Verifikasi Nyata** — Cross-reference Google Fact Check API + Mafindo/TurnBackHoax
4. **Zero-Server** — Proses AI di lokal, data tidak dikirim ke server pribadi
5. **Actionable Output** — Laporan intelijen format militer, siap cetak

---

## 6. Batasan & Constraints

| Constraint | Detail |
|-----------|--------|
| **Budget** | Rp 0 — semua open source / free tier |
| **Tim** | 1 orang (Damar) + AI assistant |
| **Waktu** | ~4 minggu |
| **Server** | Tidak ada — zero-server architecture |
| **Platform** | Windows desktop (.exe) |
| **Koneksi** | Internet diperlukan untuk fetch URL & fact-check, tapi proses AI di lokal |

---

## 7. Kriteria Penilaian & Strategi

| Kriteria | Bobot | Strategi |
|----------|-------|----------|
| **Relevansi & Manfaat** | 25% | Framing spesifik kebutuhan TNI AD, data BSSN |
| **Inovasi Teknis** | 25% | Multi-input (URL+OCR+Text+File), ML+NLP hybrid, fact-check API |
| **Fungsionalitas Purwarupa** | 25% | Live demo semua fitur, data nyata bukan dummy |
| **Kelayakan Implementasi** | 15% | Install .exe langsung jalan, zero-server |
| **Kualitas Dokumentasi** | 10% | Proposal + video demo + slide presentasi |

---

## 8. Deliverables Final

- [ ] **Software:** NARADA-Setup-v1.0.exe (installer Windows)
- [ ] **Source Code:** GitHub repository lengkap
- [ ] **Video Demo:** 3-5 menit, narasi Indonesia
- [ ] **Slide Presentasi:** 10-15 slide, desain militer
- [ ] **Proposal Teknis:** Dokumen arsitektur + use case

---

## 9. Daftar PRD Modul

| File | Modul | Status |
|------|-------|--------|
| `PRD_00_overview.md` | Dokumen ini — overview proyek | ✅ |
| `PRD_01_analyzer.md` | Multi-Input Analyzer (URL, Screenshot, Text, File) | ✅ |
| `PRD_02_ai_engine.md` | AI/ML Engine (TF-IDF + Naive Bayes + NLP) | ✅ |
| `PRD_03_fact_checker.md` | Fact-Check Integration (Google API + Mafindo) | ✅ |
| `PRD_04_dashboard.md` | Dashboard Situational Awareness | ✅ |
| `PRD_05_nexus_graph.md` | Nexus Network Graph (D3.js) | ✅ |
| `PRD_06_intel_report.md` | Intel Report Generator (PDF) | ✅ |
| `BLUEPRINT.md` | Arsitektur Teknis & Folder Structure | ✅ |
| `RULES.md` | Build Rules, Coding Standards, Testing | ✅ |
