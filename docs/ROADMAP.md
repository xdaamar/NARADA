# ROADMAP — PANDUAN EKSEKUSI STEP-BY-STEP NARADA
## Master Build Tracker & Execution Roadmap
**Project:** NARADA — Platform Intelijen Ancaman Kognitif Berbasis AI  
**Event:** Kartika Cyber Hackathon 2026 (PUSSIBERAD TNI AD × CODEPOLITAN)  
**Kategori:** Siber Sosial (Cognitive Domain)  
**Dokumen Terkait:** [PRD Suite](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/), [BLUEPRINT.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/BLUEPRINT.md), [RULES.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/RULES.md)

---

## 1. PRINSIP KERJA & ATURAN EKSEKUSI (LOCKED)

Roadmap ini dikunci sebagai pedoman kerja tunggal antara **Damar** dan **Antigravity AI**.  
Tidak ada pengerjaan di luar step yang telah didefinisikan tanpa persetujuan eksplisit.

### Golden Rules:
1. **One Step at a Time:** Kerjakan satu step secara fokus hingga tuntas dan teruji sebelum lompat ke step berikutnya.
2. **Read PRD First:** Sebelum coding, buka dan baca file PRD terkait sesuai mapping tabel di [RULES.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/RULES.md#L8-L22).
3. **Zero TypeScript Errors:** Setiap step WAJIB lulus `npm run build` (0 warning fatal, 0 error).
4. **Git Commit & Push Backup:** Setiap step yang tuntas WAJIB di-commit dengan format convention (`[FEAT]`, `[FIX]`, `[UI]`, dll.) dan di-push ke GitHub repository.
5. **Quality Over Speed:** Setiap modul harus memiliki error handling, loading states, dan empty states (tidak ada fitur yang "setengah jadi").

---

## 2. TIMELINE & FASE PENGEMBANGAN

```
┌────────────────────────────────────────────────────────────────────────┐
│                          NARADA BUILD TIMELINE                         │
├───────────────┬───────────────────────────────────┬────────────────────┤
│ FASE          │ FOKUS UTAMA                       │ OUTPUT UTAMA       │
├───────────────┼───────────────────────────────────┼────────────────────┤
│ Phase 0       │ Environment & Data Contracts      │ Types & Packages   │
│ Phase 1       │ AI Engine & Fact-Checker          │ Hybrid ML + API    │
│ Phase 2       │ Multi-Input Analyzer & OCR        │ 4 Input Sources    │
│ Phase 3       │ Operational Intelligence Suite    │ Dashboard, Nexus,  │
│               │                                   │ Military Report    │
│ Phase 4       │ Desktop Shell (Electron)          │ Windows .exe App   │
│ Phase 5       │ Polish, Scenarios & Deliverables  │ Demo, Deck, Video  │
└───────────────┴───────────────────────────────────┴────────────────────┘
```

---

## 3. DETAIL STEP-BY-STEP ROADMAP

---

### 🟢 PHASE 0: FOUNDATIONS & DATA CONTRACTS
> **Tujuan:** Menyiapkan dependensi, merapikan struktur folder sesuai Blueprint, dan mengunci kontrak interface data (TypeScript types) agar semua modul sinkron tanpa tipe mismatch.

- [ ] **STEP 0.1: Package Audit & Dependencies Setup**
  - **Ref:** [BLUEPRINT.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/BLUEPRINT.md#L6-L25)
  - **Action:** Install dependensi yang diperlukan: `tesseract.js` (OCR), `@mozilla/readability` + `jsdom` + `@types/jsdom` (URL extraction), dan dev dependencies terkait.
  - **DoD:** `package.json` terupdate, `npm run build` sukses 0 error.

- [ ] **STEP 0.2: Types Definition Sync (`src/types.ts`)**
  - **Ref:** [PRD_01_analyzer.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_01_analyzer.md), [PRD_02_ai_engine.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_02_ai_engine.md), [PRD_03_fact_checker.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_03_fact_checker.md)
  - **Action:** Definisikan kontrak data lengkap:
    - Input sources (`url`, `ocr`, `text`, `batch_file`)
    - Hybrid AI analysis result (`mlScore`, `ruleScore`, `confidence`, `threatLevel`, `threatCategory`, `narratives`, `indicators`)
    - Fact-check result interface (`claimReviewed`, `rating`, `factChecker`, `url`, `reviewDate`)
    - Nexus graph nodes & links contract
    - Intel report metadata & configuration types
  - **DoD:** `src/types.ts` selesai tanpa type errors.

- [ ] **STEP 0.3: Storage & Session Utilities (`src/utils/`)**
  - **Ref:** [BLUEPRINT.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/BLUEPRINT.md#L160-L168)
  - **Action:** Buat helper `src/utils/storage.ts` untuk mengelola `sessionStorage` (`narada_analyses`, `narada_settings`) dan `src/utils/format.ts` (date, risk badge formatter).
  - **DoD:** Helper function tersedia dan teruji.

---

### 🧠 PHASE 1: HYBRID AI ENGINE & FACT-CHECK CLIENT
> **Tujuan:** Membangun otak analisis NARADA: Tokenizer bahasa Indonesia, Vectorizer TF-IDF, Naive Bayes classifier, Rule-based keyword taxonomy militer, Combiner 60/40, serta Google Fact Check API integration.

- [ ] **STEP 1.1: Indonesian Tokenizer & Preprocessor**
  - **Ref:** [PRD_02_ai_engine.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_02_ai_engine.md#L1-L80)
  - **Action:** Buat `src/engine/ml/tokenizer.ts` yang mencakup:
    - Lowercase, punctuation removal, regex clean
    - Indonesian stopword filter (daftar stopword kata sambung umum bahasa Indonesia)
    - N-gram generator (unigram + bigram)
  - **DoD:** Fungsi tokenizing menghasilkan token bersih dari teks Indonesia.

- [ ] **STEP 1.2: TF-IDF Vectorizer & Naive Bayes Classifier**
  - **Ref:** [PRD_02_ai_engine.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_02_ai_engine.md#L81-L150)
  - **Action:** Buat `src/engine/ml/tfidf.ts` dan `src/engine/ml/naive-bayes.ts`:
    - Perhitungan TF-IDF weights
    - Multinomial Naive Bayes probabilistic calculation
    - Output probabilitas per kategori (`HOAKS`, `PROPAGANDA`, `RADIKALISME`, `SARA`, `NETRAL`)
  - **DoD:** Algoritma ML murni berjalan di client-side tanpa server eksternal.

- [ ] **STEP 1.3: Curated Training Weights Dataset (`model.json`)**
  - **Ref:** [PRD_02_ai_engine.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_02_ai_engine.md#L151-L220)
  - **Action:** Buat `src/engine/ml/model.json` (~50-100KB) yang berisi kosakata & prior probabilities hasil pelatihan korpus ancaman siber sosial Indonesia (kasus fitnah TNI, provokasi OPM/separatisme, hoaks vaksin/politik, sentimen polarisasi, dan berita netral valid).
  - **DoD:** Model ter-load instan oleh engine tanpa lag (<50ms).

- [ ] **STEP 1.4: Refactor Military Threat Rule-Engine (`classifier.ts`)**
  - **Ref:** [PRD_02_ai_engine.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_02_ai_engine.md#L221-L300)
  - **Action:** Kembangkan `src/engine/classifier.ts` dengan taksonomi kata kunci spesifik pertahanan militer:
    - Ancaman kedaulatan & provokasi separatisme (Papua/OPM)
    - Fitnah & delegitimasi institusi TNI/Pemerintah
    - Polarisasi SARA & narasi adu domba anak bangsa
    - Indikator bahasa buzzer (kata seruan agitasi, provokatif, clickbait darurat)
    - Rule-based weighting + explainability indicator extraction
  - **DoD:** Rule engine mengembalikan match detail, highlighted keywords, dan rule score (0-100).

- [ ] **STEP 1.5: Hybrid Combiner (60% ML + 40% Rules)**
  - **Ref:** [PRD_02_ai_engine.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_02_ai_engine.md#L301-L380)
  - **Action:** Buat `src/engine/combiner.ts`:
    - Menggabungkan skor ML (60%) dan Rule Score (40%)
    - Menentukan Threat Level final (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`)
    - Ekstraksi narasi kunci, entitas yang ditargetkan, dan rekomendasi respons
  - **DoD:** Fungsi `analyzeContent(text: string): AnalysisResult` menghasilkan output komprehensif.

- [ ] **STEP 1.6: Google Fact Check Client & Offline Fallback**
  - **Ref:** [PRD_03_fact_checker.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_03_fact_checker.md)
  - **Action:** Buat `src/engine/fact-checker.ts`:
    - Ekstraksi klaim inti dari teks
    - Query ke Google Fact Check Tools API (`languageCode=id`)
    - Fallback heuristic & direct search link (TurnBackHoax / CekFakta Tempo) bila offline / tanpa API key
  - **DoD:** Engine dapat mengambil fakta nyata dari database Mafindo / media cek fakta nasional.

- [ ] **MILESTONE 1 VERIFICATION:**
  - [ ] Run test skrip engine dengan 3 sampel (fitnah TNI, hoaks kesehatan, berita resmi Kemhan).
  - [ ] Verifikasi akurasi hybrid verdict dan scoring.
  - [ ] Commit: `[FEAT] complete hybrid AI engine and fact check client` & push ke GitHub.

---

### 👁️ PHASE 2: MULTI-INPUT ANALYZER & OCR (THE SENSORY SUITE)
> **Tujuan:** Membangun antarmuka utama Analyzer (`Analyzer.tsx`) yang menerima input dari 4 saluran (URL, Screenshot OCR, Raw Text, Batch CSV/TXT), menampilkan verdict card, dan detail fact-check.

- [ ] **STEP 2.1: OCR Module with Tesseract.js (`OCRUploader.tsx`)**
  - **Ref:** [PRD_01_analyzer.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_01_analyzer.md#L80-L150)
  - **Action:** Buat komponen `src/components/OCRUploader.tsx`:
    - Area drag & drop screenshot medsos / gambar hoaks
    - Progress bar real-time selama proses neural network OCR (init, recognizing, done)
    - Tampilan preview gambar + hasil ekstraksi teks yang dapat diedit sebelum dianalisis
  - **DoD:** Screenshot berita/chat WA terbaca teksnya secara offline/lokal.

- [ ] **STEP 2.2: URL Fetcher & Article Extractor (`URLInput.tsx`)**
  - **Ref:** [PRD_01_analyzer.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_01_analyzer.md#L30-L79)
  - **Action:** Buat komponen `src/components/URLInput.tsx`:
    - Input URL berita / postingan publik
    - Fetcher konten artikel dengan `@mozilla/readability` (ekstraksi judul, teks utama, sumber)
    - Fallback graceful jika terkena CORS (mode browser web) atau bypass langsung via Electron shell
  - **DoD:** URL berita diparsing otomatis menjadi teks bersih siap analisis.

- [ ] **STEP 2.3: Batch File Uploader (`BatchUploader.tsx`)**
  - **Ref:** [PRD_01_analyzer.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_01_analyzer.md#L180-L240)
  - **Action:** Buat komponen upload file `.txt` / `.csv`:
    - Parsing multiple baris postingan / teks komentar buzzer
    - Analisis batch sequential dengan progress indicator
    - Rangkuman distribusi ancaman dari batch input
  - **DoD:** File CSV berisi 20 baris komentar medsos teranalisis secara berurutan.

- [ ] **STEP 2.4: Result Card & Fact-Check Panel Components**
  - **Ref:** [PRD_01_analyzer.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_01_analyzer.md#L241-L320), [PRD_03_fact_checker.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_03_fact_checker.md#L120-L190)
  - **Action:** Buat `src/components/AnalysisResultCard.tsx` dan `src/components/FactCheckPanel.tsx`:
    - Badge tingkat ancaman (CRITICAL, HIGH, MEDIUM, LOW)
    - Radar/meteran hybrid confidence (ML vs Rules)
    - Highlight kata kunci indikator ancaman dalam teks
    - Kartu verifikasi TurnBackHoax / Mafindo dengan rating kebenaran
  - **DoD:** Komponen visual responsif, informatif, dan bergaya militer modern.

- [ ] **STEP 2.5: Build Main `Analyzer.tsx` Page & Router Update**
  - **Ref:** [PRD_01_analyzer.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_01_analyzer.md)
  - **Action:**
    - Gantikan `src/pages/Classifier.tsx` dengan `src/pages/Analyzer.tsx`
    - Implementasikan 4 tab navigasi input: `[ 🔗 URL Berita ]`, `[ 📷 Screenshot OCR ]`, `[ 📝 Teks Langsung ]`, `[ 📁 Batch File ]`
    - Hubungkan flow: Input → Preprocess → Hybrid Engine → Fact Check → Simpan ke `sessionStorage`
    - Update rute di `src/App.tsx`
  - **DoD:** Halaman Analyzer berfungsi penuh untuk ke-4 tipe input.

- [ ] **MILESTONE 2 VERIFICATION:**
  - [ ] Test tab 1: Paste URL berita online.
  - [ ] Test tab 2: Upload gambar screenshot postingan medsos.
  - [ ] Test tab 3: Input teks narasi hoaks langsung.
  - [ ] Test tab 4: Upload CSV multi-teks.
  - [ ] Pastikan hasil tersimpan di `sessionStorage`.
  - [ ] Commit: `[FEAT] implement full multi-input analyzer with OCR and fact check display` & push ke GitHub.

---

### 🛡️ PHASE 3: OPERATIONAL COMMAND & INTELLIGENCE VIEWS
> **Tujuan:** Menyelaraskan seluruh tampilan operasional: Dashboard Situasional, Nexus Network Graph, Intelligence Report Generator (standar militer), dan Settings.

- [ ] **STEP 3.1: Command Dashboard Refactor (`Dashboard.tsx`)**
  - **Ref:** [PRD_04_dashboard.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_04_dashboard.md)
  - **Action:** Kembangkan `src/pages/Dashboard.tsx`:
    - Status Siaga Siber Sosial (DEFCON-style Threat Level Banner: SIAGA 1 / SIAGA 2 / SIAGA 3 / HIJAU)
    - 4 Metrik Kartu: Total Dianalisis, Ancaman Kritis, Narasi Hoaks Aktif, Entitas Terdeteksi
    - Threat Trend Chart & Threat Category Radar (Recharts)
    - Live Cognitive Threat Feed (daftar analisis terbaru dari `sessionStorage`)
    - Quick Action Button langsung menuju Analyzer
  - **DoD:** Dashboard mencerminkan situasi nyata dari riwayat analisis pengguna.

- [ ] **STEP 3.2: Nexus Network Graph Refactor (`Nexus.tsx`)**
  - **Ref:** [PRD_05_nexus_graph.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_05_nexus_graph.md)
  - **Action:** Perbarui `src/pages/Nexus.tsx` menggunakan D3.js force-directed graph:
    - Node terbagi atas 3 entitas: Narasi/Isu, Kanal/Akun, dan Target Diserang (TNI/Pemerintah/Masyarakat)
    - Link menunjukkan relasi distribusi narasi
    - Node drag, zoom, pan, dan filter kategori ancaman
    - Klik node untuk membuka panel rincian intelijen
    - Menggunakan data relasi yang digenerate dari riwayat analisis sesi
  - **DoD:** Graph visual interaktif, lancar (smooth 60fps), tidak crash saat interaksi.

- [ ] **STEP 3.3: Intelligence Report Generator (`Reports.tsx`)**
  - **Ref:** [PRD_06_intel_report.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_06_intel_report.md)
  - **Action:** Perbarui `src/pages/Reports.tsx` sesuai format intelijen pertahanan:
    - Header KOP resmi: `KOMANDO DAERAH MILITER / PUSSIBERAD` dengan klasifikasi `RAHASIA / TERBATAS`
    - Nomor laporan otomatis: `R-LAP/COGNITIVE/[NOMOR]/[BULAN]/[TAHUN]`
    - Ringkasan Eksekutif Ancaman Siber Sosial
    - Matriks Bukti Digital & Temuan Lapangan
    - Fakta Verifikasi Hasil Cek Fakta (Debunking Fact Sheet)
    - Rekomendasi Tindakan Militer/Dispenad (Counter-Narrative, Takedown Request, Press Briefing)
    - Mode Print ramah cetak (CSS `@media print` rapi dengan latar belakang putih, teks hitam formal)
  - **DoD:** Tombol "Cetak / Export PDF" menghasilkan dokumen intelijen siap komando.

- [ ] **STEP 3.4: Settings & Configuration (`SettingsPage.tsx`)**
  - **Ref:** [BLUEPRINT.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/BLUEPRINT.md#L99)
  - **Action:** Kembangkan `src/pages/SettingsPage.tsx`:
    - Konfigurasi Google Fact Check API Key (tersimpan lokal di localStorage/session)
    - Identitas Pengguna / Satuan Analis (contoh: PUSSIBERAD Satgas Siber)
    - Pengaturan bobot engine (slider tuning 60% ML : 40% Rules)
    - Tombol "Reset Data Sesi" & "Load Skenario Demo"
  - **DoD:** Konfigurasi tersimpan dan mempengaruhi engine secara dinamis.

- [ ] **STEP 3.5: App Layout & Navigation Synchronization (`App.tsx`)**
  - **Ref:** [BLUEPRINT.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/BLUEPRINT.md#L79-L81)
  - **Action:**
    - Perbarui navigasi sidebar: Dashboard, Multi-Input Analyzer, Nexus Network, Intel Reports, Settings
    - Hapus modul lama yang deprecated (misal manual Profiler yang dikeluhkan user)
    - Status bar bawah: DEFCON status, AI Engine status (Hybrid ML 60/40 Active), Database CekFakta Online/Offline
  - **DoD:** Navigasi mulus, konsisten, dan berestetika tinggi.

- [ ] **MILESTONE 3 VERIFICATION:**
  - [ ] Alur penuh: Analisis 2 berita hoaks di Analyzer → Cek update di Dashboard → Buka Nexus Graph → Generate Intel Report → Uji print view.
  - [ ] Commit: `[FEAT] complete dashboard, nexus graph, military intel report, and settings` & push ke GitHub.

---

### 💻 PHASE 4: ELECTRON SHELL & DESKTOP PACKAGING
> **Tujuan:** Membungkus aplikasi React ke dalam desktop wrapper Electron, menyediakan native URL fetching (bypass CORS), dan mengonfigurasi build Windows installer (.exe).

- [ ] **STEP 4.1: Electron Main & Preload Script**
  - **Ref:** [BLUEPRINT.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/BLUEPRINT.md#L72-L76)
  - **Action:** Buat folder `electron/`:
    - `electron/main.ts`: Inisialisasi window, menu baris militer, security flags
    - `electron/preload.ts`: Context bridge aman yang mengekspos API desktop ke React
  - **DoD:** Electron window dapat memuat antarmuka React.

- [ ] **STEP 4.2: Native URL Fetcher via IPC Bridge**
  - **Ref:** [BLUEPRINT.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/BLUEPRINT.md#L75)
  - **Action:** Buat `electron/url-fetcher.ts`:
    - Mengambil halaman web secara background tanpa batasan CORS browser
    - Parsing konten bersih menggunakan Readability dan mengirimkan ke renderer
  - **DoD:** Renderer dapat meminta fetch URL apapun melalui `window.naradaAPI.fetchURL(url)`.

- [ ] **STEP 4.3: Package Scripts & electron-builder Config**
  - **Ref:** [BLUEPRINT.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/BLUEPRINT.md#L183-L200)
  - **Action:**
    - Buat `electron-builder.yml` untuk target Windows (`nsis`, icon, output `dist/`)
    - Tambahkan scripts di `package.json`: `electron:dev`, `electron:build`
    - Pastikan folder `docs/` diabaikan dalam build release
  - **DoD:** `npm run build` dan skrip build terkonfigurasi benar.

- [ ] **STEP 4.4: Packaging Test & Validation**
  - **Ref:** [RULES.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/RULES.md#L236-L244)
  - **Action:** Jalankan build release installer dan verifikasi file installer `NARADA-Setup-1.0.0.exe`.
  - **DoD:** Installer tergenerate tanpa error dan dapat dibuka di Windows.

- [ ] **MILESTONE 4 VERIFICATION:**
  - [ ] Aplikasi berjalan normal dalam desktop shell Electron.
  - [ ] Commit: `[FEAT] integrate electron shell and desktop build configuration` & push ke GitHub.

---

### 🏆 PHASE 5: POLISH, SCENARIOS & HACKATHON DELIVERABLES
> **Tujuan:** Memastikan aplikasi bebas bug, menyediakan data skenario demo siap uji, menyusun naskah presentasi, serta menyiapkan materi submission hackathon.

- [ ] **STEP 5.1: UI/UX Micro-Interactions & Visual Polish**
  - **Ref:** [RULES.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/RULES.md#L216-L235)
  - **Action:**
    - Periksa konsistensi palet warna (`#0a0e1a`, `#C8102E`, `#E2E8F0`)
    - Periksa font readability (Rajdhani untuk header militer, Inter untuk teks, JetBrains Mono untuk metrik)
    - Animasi transisi halus antar tab & halaman dengan Framer Motion
    - Audit konsol browser (pastikan 0 warning dan 0 error)
  - **DoD:** Aplikasi tampak sangat profesional, taktis, dan "wow factor" terpenuhi.

- [ ] **STEP 5.2: Preloaded Demo Scenarios (One-Click Demo)**
  - **Ref:** [PRD_00_overview.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_00_overview.md#L45-L65)
  - **Action:** Buat tombol "Muat Data Skenario Hackathon" di Settings / Analyzer:
    - Skenario 1: Disinformasi Pengadaan Alutsista TNI (Hoaks Tingkat Kritis)
    - Skenario 2: Agitasi & Provokasi Separatisme Teritorial (Ancaman Kedaulatan)
    - Skenario 3: Klarifikasi Isu Netral / Berita Resmi Valid (Netral / Aman)
  - **DoD:** Juri atau penguji dapat langsung melihat kehebatan aplikasi dalam 1 klik tanpa harus mencari contoh teks manual.

- [ ] **STEP 5.3: Pitch Deck & Presentation Guide (`docs/PRESENTASI.md`)**
  - **Action:** Buat panduan presentasi dan struktur slide:
    - Problem Statement (Ancaman perang kognitif siber sosial di era modern)
    - Kelemahan tools monitoring saat ini (hanya analitik sentimen, bukan analisis ancaman kognitif)
    - Solusi NARADA (Hybrid AI + Multi-Input + Fact-Check Real + Format Intelijen TNI)
    - Demo walkthrough sequence (alur demo 3 menit yang memikat juri)
    - Dampak strategis bagi satuan siber TNI AD
  - **DoD:** File `docs/PRESENTASI.md` selesai dan terstruktur.

- [ ] **STEP 5.4: Video Demo Script & Storyboard (`docs/VIDEO_DEMO.md`)**
  - **Action:** Buat naskah video rekaman demo produk (durasi 2-3 menit):
    - Detik 0-30: Intro masalah perang kognitif & opening NARADA
    - Detik 30-90: Demonstrasi Analyzer (URL berita + Screenshot OCR)
    - Detik 90-130: Demonstrasi Dashboard & Nexus Network Graph
    - Detik 130-160: Demonstrasi Cetak Laporan Intelijen Militer
    - Detik 160-180: Closing & visi pertahanan siber kognitif nasional
  - **DoD:** Panduan perekaman video demo siap dieksekusi oleh Damar.

- [ ] **STEP 5.5: Final Code Audit & Repository Release Tagging**
  - **Ref:** [RULES.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/RULES.md#L236-L244)
  - **Action:**
    - Perbarui `README.md` utama dengan badge, screenshot konsep, arsitektur, dan cara menjalankan
    - Git commit final: `[POLISH] prepare final hackathon release v1.0.0`
    - Buat git tag `v1.0.0` dan push ke GitHub origin
  - **DoD:** Repository siap dinilai juri dengan dokumentasi kelas satu.

---

## 4. PROTOKOL KONTROL STATUS (STATE TRACKER)

| Phase | Total Steps | Selesai | Status |
|-------|-------------|---------|--------|
| Phase 0: Foundations | 3 | 0 | 🟡 READY TO START |
| Phase 1: AI Engine & Fact-Check | 6 | 0 | ⏳ QUEUED |
| Phase 2: Multi-Input Analyzer | 5 | 0 | ⏳ QUEUED |
| Phase 3: Operations Suite | 5 | 0 | ⏳ QUEUED |
| Phase 4: Desktop Shell | 4 | 0 | ⏳ QUEUED |
| Phase 5: Polish & Deliverables | 5 | 0 | ⏳ QUEUED |
| **TOTAL** | **28 Steps** | **0/28** | **0% PROGRESS** |

---

## 5. CARA KITA MENGEKSEKUSI BERSAMA (COMMITMENT)

1. Kita akan memulai dari **Phase 0: Step 0.1**.
2. Setiap kali memulai sebuah step, Antigravity akan mengonfirmasi detail tindakan.
3. Setelah step diimplementasikan, kita lakukan verifikasi build & test.
4. Jika lolos, checkbox `[x]` pada roadmap ini di-centang, di-commit, dan di-push.
5. Damar selalu memegang kendali atas persetujuan tiap fase sebelum melangkah lebih jauh.
