# ROADMAP — PANDUAN EKSEKUSI MASTER NARADA (LOCKED & AUDITED)
## Master Build Tracker Berbasis Rubrik Penilaian Kartika Cyber Hackathon 2026
**Project:** NARADA — Platform Intelijen Ancaman Kognitif Berbasis AI  
**Penyelenggara:** PUSSIBERAD TNI AD × CODEPOLITAN  
**Kategori:** Siber Sosial (Cognitive Domain)  
**Dokumen Referensi:** [PRD Suite (PRD 00 - 06)](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/), [BLUEPRINT.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/BLUEPRINT.md), [RULES.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/RULES.md)

---

## 1. MATRIKS BOBOT PENILAIAN RESMI (KARTIKA CYBER HACKATHON 2026)

Berdasarkan lembar rubrik penilaian resmi lomba:

```
┌────────────────────────────────────────────────────────────────────────┐
│             DISTRIBUSI BOBOT PENILAIAN HACKATHON (100%)                │
├───────────────────────────────┬───────┬────────────────────────────────┤
│ ASPEK PENILAIAN               │ BOBOT │ STRATEGI EKSEKUSI NARADA       │
├───────────────────────────────┼───────┼────────────────────────────────┤
│ 1. Relevansi dan Manfaat      │  25%  │ Fokus pengamanan siber sosial  │
│    (Kesesuaian solusi dengan  │       │ TNI AD: fitnah militer, hoaks  │
│    kebutuhan IT/OT TNI AD)    │       │ alutsista, agitasi separatis,  │
│                               │       │ format laporan Intelijen Kodam │
├───────────────────────────────┼───────┼────────────────────────────────┤
│ 2. Inovasi Teknis             │  25%  │ Multi-Input (URL + Neural OCR  │
│    (Keaslian ide & pendekatan │       │ offline + Text + CSV), Hybrid  │
│    teknologi solusi)          │       │ AI (TF-IDF + Naive Bayes 60%   │
│                               │       │ + Rule XAI 40%), Fact-Check API│
├───────────────────────────────┼───────┼────────────────────────────────┤
│ 3. Fungsionalitas Purwarupa   │  25%  │ 100% fungsional tanpa dummy    │
│    (Bisa berjalan & didemo-   │       │ palsu, respons <100ms, data    │
│    kan sesuai rancangan)      │       │ real-time, 1-click live demo   │
├───────────────────────────────┼───────┼────────────────────────────────┤
│ 4. Kelayakan Implementasi     │  15%  │ Zero-Server Architecture, aman │
│    (Potensi lanjutan & mudah  │       │ OPSEC, installer desktop .exe, │
│    diterapkan di satuan)      │       │ siap jalan di PC satuan Korem  │
├───────────────────────────────┼───────┼────────────────────────────────┤
│ 5. Kualitas Dokumentasi       │  10%  │ Proposal teknis komprehensif,  │
│    (Proposal, dokumentasi,    │       │ video demo 3 menit memukau,    │
│    dan kejelasan video demo)  │       │ slide deck militer taktis      │
└───────────────────────────────┴───────┴────────────────────────────────┘
```
> **Fokus Utama:** 3 Aspek Teratas menyumbang **75% total nilai** (Relevansi 25% + Inovasi 25% + Purwarupa 25%).  
> Dua aspek berikutnya menyumbang **25% penentu kemenangan** (Kelayakan 15% + Dokumentasi 10%).  
> Seluruh step di bawah dipetakan langsung ke poin-poin penilaian ini!

---

## 2. VERIFIKASI KESELARASAN DENGAN PRD (100% MATCH AUDIT)

| PRD File | Modul Utama | Status Keselarasan dalam Roadmap |
|----------|-------------|----------------------------------|
| `PRD_00_overview.md` | Problem statement BSSN, target TNI AD, zero-server | ✅ Dipetakan di Phase 0, 4, dan 5 |
| `PRD_01_analyzer.md` | Multi-Input (URL Readability, OCR Tesseract, Text, CSV) | ✅ Dipetakan penuh di Phase 2 (Step 2.1 – 2.5) |
| `PRD_02_ai_engine.md` | Hybrid ML (TF-IDF + Naive Bayes 60%) + Rule XAI (40%) | ✅ Dipetakan penuh di Phase 1 (Step 1.1 – 1.5) |
| `PRD_03_fact_checker.md` | Google Fact Check API, Mafindo/TurnBackHoax, Offline link | ✅ Dipetakan penuh di Phase 1 (Step 1.6) & Phase 2 (Step 2.4) |
| `PRD_04_dashboard.md` | DEFCON alert, 4 stat cards, Timeline chart, Donut, Feed | ✅ Dipetakan penuh di Phase 3 (Step 3.1) |
| `PRD_05_nexus_graph.md` | D3.js Force graph, narasi clustering, sumber, similarity | ✅ Dipetakan penuh di Phase 3 (Step 3.2) |
| `PRD_06_intel_report.md` | Laporan intelijen standar TNI AD, kop resmi, print/PDF | ✅ Dipetakan penuh di Phase 3 (Step 3.3) |
| `BLUEPRINT.md` | Arsitektur Electron + React + Vite + Types | ✅ Menjadi acuan direktori seluruh step |
| `RULES.md` | Coding standards, testing protocol, zero-error build | ✅ Menjadi protokol verifikasi tiap step |

---

## 3. MASTER STEP-BY-STEP ROADMAP (TERSTRUKTUR & TERKUNCI)

---

### 🟢 PHASE 0: FOUNDATIONS, DATA CONTRACTS & MILITARY DOMAIN KNOWLEDGE
> **Target Bobot:** `[15% Kelayakan Implementasi]` + `[25% Relevansi]`  
> **Tujuan:** Menyiapkan fondasi environment yang kokoh, instalasi dependensi, kontrak TypeScript yang presisi tanpa `any`, dan taksonomi kamus ancaman militer awal.

- [x] **STEP 0.1: Package Audit & Engine Dependencies Setup** `[15% Kelayakan]`
  - **Ref:** [BLUEPRINT.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/BLUEPRINT.md#L6-L25)
  - **Action:** Install dependensi inti: `tesseract.js` (Neural OCR lokal), `@mozilla/readability` + `jsdom` + `@types/jsdom` (URL Content Scraper).
  - **DoD:** `package.json` terkonfigurasi, `npm run build` sukses 0 errors.

- [x] **STEP 0.2: Unified TypeScript Interfaces (`src/types.ts`)** `[25% Inovasi]` `[25% Purwarupa]`
  - **Ref:** [PRD_01](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_01_analyzer.md#L41-L52), [PRD_02](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_02_ai_engine.md#L117-L124), [PRD_03](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_03_fact_checker.md#L113-L133), [PRD_05](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_05_nexus_graph.md#L14-L31), [PRD_06](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_06_intel_report.md#L14-L22)
  - **Action:** Tulis ulang `src/types.ts` secara komprehensif:
    - Input types: `URLAnalysisInput`, `OCRAnalysisInput`, `TextAnalysisInput`, `BatchAnalysisInput`
    - AI & ML types: `MLPrediction`, `RuleMatchDetail`, `ThreatCategory`, `ThreatLevel` (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), `AnalysisResult`
    - Fact Check types: `FactCheckClaim`, `FactCheckResult`
    - Graph types: `NexusNode` (`content`, `narrative`, `source`), `NexusLink` (`similarity`, `same_source`)
    - Report config types: `IntelReportConfig`, `ReportClassification` (`RAHASIA`, `TERBATAS`, `BIASA`)
  - **DoD:** File `src/types.ts` bersih tanpa redundansi, strict type safety.

- [x] **STEP 0.3: Session Storage & Utility Subsystem (`src/utils/`)** `[15% Kelayakan]`
  - **Ref:** [BLUEPRINT.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/BLUEPRINT.md#L160-L168)
  - **Action:** Buat helper `src/utils/storage.ts` (manajemen `sessionStorage` aman dengan auto-serialize dan error catching) dan `src/utils/format.ts` (formatter waktu militer `DD-MMM-YYYY HH:mm WIB`, badge style resolver, confidence gauge).
  - **DoD:** Unit test manual utility pass.

- [x] **STEP 0.4: TNI AD Cyber Threat Taxonomy Dictionary** `[25% Relevansi & Manfaat]`
  - **Ref:** [PRD_02_ai_engine.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_02_ai_engine.md#L108-L115)
  - **Action:** Buat `src/engine/taxonomy.ts` berisi kamus kata kunci & pola ancaman kognitif khusus matra darat & siber sosial Indonesia:
    - Kedaulatan & Separatisme (OPM, referendum, Papua merdeka, makar, sabotase)
    - Delegitimasi Institusi TNI & Pimpinan (fitnah jenderal, manipulasi mutasi, hoaks anggaran alutsista)
    - Provokasi SARA & Pembelahan Sosial (agitasi vertikal/horizontal, adu domba rakyat vs aparat)
    - Pola Buzzer & Agitasi Digital (gerakan viralkan serentak, bot spam, tagar buatan)
    - Indikator Clickbait Disinformasi (judul bombastis darurat, pemotongan konteks)
  - **DoD:** Kamus terstruktur rapi dengan bobot risiko per kata kunci (1-10) dan kategori jelas.

---

### 🧠 PHASE 1: HYBRID AI ENGINE & FACT-CHECK CLIENT (THE COGNITIVE CORE)
> **Target Bobot:** `[25% Inovasi Teknis]` + `[25% Fungsionalitas Purwarupa]`  
> **Tujuan:** Membangun mesin analisis sejati: Tokenizer, Vectorizer TF-IDF, Multinomial Naive Bayes (ML nyata), Explainable Rule Engine, Combiner 60/40, dan Google Fact Check integration.

- [x] **STEP 1.1: Indonesian Preprocessor & Tokenizer (`tokenizer.ts`)** `[25% Inovasi Teknis]`
  - **Ref:** [PRD_02_ai_engine.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_02_ai_engine.md#L66-L85)
  - **Action:** Buat `src/engine/ml/tokenizer.ts`:
    - Normalisasi teks, cleaning tanda baca & URL
    - Stopword filtering berbasis korpus bahasa Indonesia (~250 kata sambung umum)
    - Ekstraksi unigram & bigram penting untuk deteksi frase manipulatif
  - **DoD:** Menghasilkan array token bersih dalam waktu <10ms per 500 kata.

- [x] **STEP 1.2: TF-IDF Vectorizer (`tfidf.ts`)** `[25% Inovasi Teknis]`
  - **Ref:** [PRD_02_ai_engine.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_02_ai_engine.md#L36-L42)
  - **Action:** Buat `src/engine/ml/tfidf.ts`:
    - Implementasi perhitungan Term Frequency (TF) dan Inverse Document Frequency (IDF)
    - Perhitungan bobot vector numerik teks terhadap vocabulary korpus
  - **DoD:** Menghasilkan vector feature numerik yang siap dikonsumsi Naive Bayes.

- [x] **STEP 1.3: Multinomial Naive Bayes Classifier (`naive-bayes.ts`)** `[25% Inovasi Teknis]`
  - **Ref:** [PRD_02_ai_engine.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_02_ai_engine.md#L73-L85)
  - **Action:** Buat `src/engine/ml/naive-bayes.ts`:
    - Probabilistic inference dengan log-likelihood + Laplace smoothing (mencegah zero-probability)
    - Output probabilitas per kategori: `HOAKS`, `PROPAGANDA`, `BUZZER`, `DISINFORMASI`, `NETRAL`
    - Normalisasi softmax persentase (0-100%)
  - **DoD:** Klasifikasi probabilistik ML murni berjalan di client-side tanpa koneksi server.

- [x] **STEP 1.4: Pre-Trained Model Weights Dataset (`model.json`)** `[25% Inovasi Teknis]`
  - **Ref:** [PRD_02_ai_engine.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_02_ai_engine.md#L50-L64)
  - **Action:** Buat `src/engine/ml/model.json` (~60-120KB):
    - Berisi vocabulary terindeks, IDF values, class priors, dan word conditional probabilities
    - Dikalibrasi dari data riil ancaman siber sosial Indonesia (kasus hoaks Mafindo, narasi propaganda, berita netral)
  - **DoD:** File JSON tervalidasi dan ter-bundle rapi dalam build.

- [x] **STEP 1.5: Explainable Rule-Based Engine (`classifier.ts`)** `[25% Relevansi]` `[25% Purwarupa]`
  - **Ref:** [PRD_02_ai_engine.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_02_ai_engine.md#L101-L125)
  - **Action:** Tulis ulang `src/engine/classifier.ts` menggunakan taksonomi militer:
    - Pattern matching kontekstual, deteksi frase provokatif, akumulasi skor risiko
    - Menghasilkan Explainability (XAI): daftar kata kunci yang memicu kecurigaan beserta kalimat konteksnya
    - Penjelasan narasi ancaman dalam bahasa Indonesia formal
  - **DoD:** Mengembalikan `RuleMatchDetail` dengan transparan dan akurat.

- [x] **STEP 1.6: Hybrid Combiner Engine (`combiner.ts`)** `[25% Inovasi Teknis]` `[25% Purwarupa]`
  - **Ref:** [PRD_02_ai_engine.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_02_ai_engine.md#L128-L160)
  - **Action:** Buat `src/engine/combiner.ts`:
    - Penggabungan bobot: 60% ML Probability + 40% Rule Severity
    - Penentuan `ThreatLevel` final (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`)
    - Penentuan rekomendasi respons taktis militer (e.g. Counter-Narrative Dispenad, Klarifikasi Satgas, Eskalasi Komando)
  - **DoD:** Fungsi `analyzeHybrid(text: string): AnalysisResult` selesai, kecepatan eksekusi <50ms.

- [x] **STEP 1.7: Real-Time Fact-Check Client (`fact-checker.ts`)** `[25% Inovasi Teknis]` `[25% Relevansi]`
  - **Ref:** [PRD_03_fact_checker.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_03_fact_checker.md)
  - **Action:** Buat `src/engine/fact-checker.ts`:
    - Otomatis mengekstrak klaim utama dari teks
    - Integrasi Google Fact Check Tools API (`languageCode=id`) untuk memanggil data Mafindo/TurnBackHoax & CekFakta Tempo
    - Fallback otomatis: jika offline / tanpa API key, generate direct verified query search URL ke database TurnBackHoax dan Google Fact Check Explorer
  - **DoD:** Verifikasi fakta nyata berjalan otomatis setelah proses analisis.

- [x] **MILESTONE 1 TESTING & AUDIT:**
  - [x] Validasi uji 4 kasus: (1) Hoaks penculikan berlatar TNI, (2) Provokasi separatis Papua, (3) Teks propaganda buzzer, (4) Rilis pers resmi TNI AD (Netral).
  - [x] Hasil hybrid logis, confidence score presisi, fact-check terintegrasi.
  - [x] Commit: `[FEAT] implement hybrid AI ML engine and real fact checker` & git push.

---

### 👁️ PHASE 2: MULTI-INPUT ANALYZER & OCR (THE SENSORY SUITE)
> **Target Bobot:** `[25% Inovasi Teknis]` + `[25% Fungsionalitas Purwarupa]`  
> **Tujuan:** Membangun antarmuka utama penerimaan data dari 4 saluran nyata: URL berita/medsos, Screenshot medsos (Neural OCR offline), Teks mentah, dan Batch file CSV/TXT.

- [ ] **STEP 2.1: Neural OCR Extraction Module (`OCRUploader.tsx`)** `[25% Inovasi Teknis]`
  - **Ref:** [PRD_01_analyzer.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_01_analyzer.md#L61-L96)
  - **Action:** Buat `src/components/OCRUploader.tsx`:
    - Drag & drop area screenshot postingan medsos (X/Twitter, Instagram, FB, WhatsApp chat)
    - Inisialisasi Tesseract.js worker dengan bahasa `ind` + `eng`
    - Real-time progress bar (Status: Menginisialisasi Model → Mengenali Teks OCR → Ekstraksi Selesai)
    - Tampilan side-by-side preview gambar dan textarea hasil ekstraksi yang bisa dikoreksi/diedit analis
  - **DoD:** Gambar teks postingan medsos terbaca dengan akurasi tinggi dan teksnya dapat diedit sebelum dianalisis.

- [ ] **STEP 2.2: Web Article & Social URL Extractor (`URLInput.tsx`)** `[25% Inovasi Teknis]`
  - **Ref:** [PRD_01_analyzer.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_01_analyzer.md#L14-L60)
  - **Action:** Buat `src/components/URLInput.tsx`:
    - Input URL berita / link posting publik dengan validasi regex
    - Fetcher konten dengan fallback ganda (Electron Native fetcher saat desktop shell aktif, atau client-side reader)
    - Ekstraksi judul, nama media, penulis, tanggal rilis, dan teks artikel inti via `@mozilla/readability`
  - **DoD:** Analis cukup paste link berita, NARADA otomatis mengambil artikel dan mengisinya ke area analisis.

- [ ] **STEP 2.3: Batch Comment / Post File Analyzer (`BatchUploader.tsx`)** `[25% Relevansi & Manfaat]`
  - **Ref:** [PRD_01_analyzer.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_01_analyzer.md#L119-L140)
  - **Action:** Buat `src/components/BatchUploader.tsx`:
    - Upload file `.csv` atau `.txt` berisi puluhan baris narasi/komentar netizen
    - Parsing otomatis baris per baris dan eksekusi batch analysis secara sekuensial dengan visual progress bar
    - Rangkuman statistik batch (e.g. "Dari 50 komentar dianalisis: 32 Terindikasi Buzzer, 10 Hoaks, 8 Netral")
  - **DoD:** File CSV komentar medsos terproses cepat dan tersimpan dalam sesi.

- [ ] **STEP 2.4: Tactical Result Card & Fact-Check Panel (`AnalysisResultCard.tsx`)** `[25% Purwarupa]`
  - **Ref:** [PRD_01_analyzer.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_01_analyzer.md#L155-L163), [PRD_03_fact_checker.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_03_fact_checker.md#L86-L107)
  - **Action:** Buat `src/components/AnalysisResultCard.tsx` dan `src/components/FactCheckPanel.tsx`:
    - Visual badge tingkat ancaman: `CRITICAL` (Merah), `HIGH` (Oranye), `MEDIUM` (Kuning), `LOW` (Hijau)
    - Meteran perbandingan skor ML (60%) vs Rule Severity (40%)
    - Text highlighter yang menandai kata-kata indikator ancaman langsung di dalam teks
    - Kartu hasil verifikasi fakta resmi Mafindo / TurnBackHoax lengkap dengan status kebenaran (`❌ SALAH`, `⚠️ MISLEADING`, `✅ BENAR`) dan tautan sumber debunking
    - Tombol cepat "Kirim ke Nexus Graph" dan "Tambahkan ke Laporan Intelijen"
  - **DoD:** Panel hasil analisis menyajikan intelijen yang padat, jelas, dan siap aksi.

- [ ] **STEP 2.5: Main `Analyzer.tsx` Page & Tab Controller** `[25% Purwarupa]`
  - **Ref:** [PRD_01_analyzer.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_01_analyzer.md#L142-L172)
  - **Action:**
    - Buat `src/pages/Analyzer.tsx` (menggantikan halaman Classifier lama yang belum v2)
    - Integrasikan 4 tab: `[ 🔗 URL Berita ]`, `[ 📸 Screenshot OCR ]`, `[ 📝 Teks Langsung ]`, `[ 📁 Batch File ]`
    - Hubungkan flow input → AI Engine → Fact Check → Simpan riwayat ke `sessionStorage`
    - Tambahkan drawer riwayat analisis pada sisi bawah/samping
  - **DoD:** Halaman Analyzer berfungsi penuh untuk semua mode input tanpa error.

- [ ] **MILESTONE 2 TESTING & AUDIT:**
  - [ ] Uji input URL berita online.
  - [ ] Uji upload gambar screenshot medsos via OCR.
  - [ ] Uji input teks manual hoaks & teks netral.
  - [ ] Uji batch upload file CSV.
  - [ ] Commit: `[FEAT] complete multi-input analyzer page with OCR and fact check display` & git push.

---

### 🛡️ PHASE 3: OPERATIONAL COMMAND & INTELLIGENCE SUITE
> **Target Bobot:** `[25% Relevansi dan Manfaat]` + `[25% Fungsionalitas Purwarupa]`  
> **Tujuan:** Menghadirkan command center lengkap: Dashboard Kesadaran Situasional, Visualisasi Graf Jejaring Nexus (D3.js), Pembuat Laporan Intelijen Standar Militer, dan Pengaturan Aplikasi.

- [ ] **STEP 3.1: Command Dashboard Situational Awareness (`Dashboard.tsx`)** `[25% Purwarupa]`
  - **Ref:** [PRD_04_dashboard.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_04_dashboard.md)
  - **Action:** Rombak total `src/pages/Dashboard.tsx`:
    - Status Siaga Siber Sosial (DEFCON Alert Banner: SIAGA 1 MERAH / SIAGA 2 KUNING / AMAN)
    - 4 Metrik Kartu Taktis: Total Konten Dianalisis, Ancaman Kritis, Narasi Hoaks Aktif, Aktor/Buzzer Terlacak
    - Tren Waktu Eskalasi Ancaman (Recharts Line Chart)
    - Radar Distribusi Kategori Ancaman (Recharts Donut / Radar)
    - Live Cognitive Threat Feed: daftar ancaman real-time dari data analisis sesi
    - Status Modul Sistem (AI Engine 60/40, Fact Check API, OCR Engine)
  - **DoD:** Dashboard interaktif, bereaksi instan terhadap data analisis baru di sesi tersebut.

- [ ] **STEP 3.2: Nexus Network Graph Visualization (`Nexus.tsx`)** `[25% Inovasi]` `[25% Purwarupa]`
  - **Ref:** [PRD_05_nexus_graph.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_05_nexus_graph.md)
  - **Action:** Bangun `src/pages/Nexus.tsx` menggunakan D3.js Force-Directed Graph:
    - 3 Tipe Node: Konten Dianalisis (Lingkaran), Klaster Narasi (Hexagon), Sumber/Akun (Diamond)
    - Algoritma auto-grouping kesamaan kata kunci (similarity > 40%) dan sumber identik
    - Interaksi: Drag node, Zoom in/out, Pan canvas, Klik node untuk inspeksi detail intelijen di sidebar
    - Filter berdasarkan tingkat ancaman (Semua, Kritis, Tinggi)
    - Mode Demo Jaringan Buzzer Terkoordinasi (12 node buzzer mensirkulasikan isu fitnah)
  - **DoD:** Peta jaringan render lancar tanpa lag, memvisualisasikan koordinasi buzzer dengan memukau.

- [ ] **STEP 3.3: Military Intelligence Report Generator (`Reports.tsx`)** `[25% Relevansi & Manfaat]`
  - **Ref:** [PRD_06_intel_report.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_06_intel_report.md)
  - **Action:** Rombak `src/pages/Reports.tsx` sesuai standar format intelijen pertahanan TNI AD:
    - KOP Surat Resmi Militer: `KOMANDO DAERAH MILITER / SATUAN TUGAS SIBER SOSIAL`
    - Nomor Registrasi: `R-LAP/KOGNITIF/[NO]/[BULAN]/[TAHUN]` dengan klasifikasi `RAHASIA / TERBATAS`
    - Bagian I: Ringkasan Eksekutif Situasi Siber Sosial
    - Bagian II: Tabel Statistik & Distribusi Kategori Ancaman
    - Bagian III: Matriks Bukti Digital & Temuan Lapangan
    - Bagian IV: Lembar Verifikasi Fakta (Hasil Cek Fakta Mafindo / TurnBackHoax)
    - Bagian V: Rekomendasi Taktis Pimpinan (Tindakan Dispenad, Counter-Narrative, Klarifikasi Terbuka)
    - Lembar tanda tangan Analis & Komandan Satuan
    - Live Real-Time Document Preview + Ekspor PDF / Mode Cetak Resmi (`@media print` ramah kertas)
  - **DoD:** Satu klik langsung menghasilkan dokumen laporan intelijen siap cetak untuk pimpinan.

- [ ] **STEP 3.4: Settings, Configuration & Presets (`SettingsPage.tsx`)** `[15% Kelayakan]`
  - **Ref:** [BLUEPRINT.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/BLUEPRINT.md#L99)
  - **Action:** Kembangkan `src/pages/SettingsPage.tsx`:
    - Konfigurasi Google Fact Check Tools API Key
    - Pengaturan Profil Analis (Nama Analis, Pangkat/NRP, Satuan Tugas)
    - Slider Fine-Tuning Bobot Engine (default 60% ML : 40% Rules)
    - Tombol "Muat Skenario Demo Siap Uji" (One-Click Demo Seeder)
    - Tombol "Hapus Riwayat Sesi" (Clean State)
  - **DoD:** Pengaturan tersimpan secara persisten dan mempengaruhi perilaku aplikasi.

- [ ] **STEP 3.5: App Layout & Topbar Navigation Synchronization (`App.tsx`)** `[25% Purwarupa]`
  - **Ref:** [BLUEPRINT.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/BLUEPRINT.md#L79-L81)
  - **Action:**
    - Perbarui struktur routing: `/` (Dashboard), `/analyzer` (Analyzer), `/nexus` (Nexus Graph), `/reports` (Intel Reports), `/settings` (Settings)
    - Hapus modul v1 lama yang deprecated (profiler manual)
    - Topbar taktis dengan jam operasional real-time WIB, status DEFCON, dan indikator mode AI
  - **DoD:** Navigasi aplikasi konsisten, bersih, dan bertaraf militer.

- [ ] **MILESTONE 3 TESTING & AUDIT:**
  - [ ] Jalankan skenario end-to-end: Analisis konten di Analyzer → Lihat lonjakan ancaman di Dashboard → Buka klaster narasi di Nexus → Cetak dokumen di Reports.
  - [ ] Commit: `[FEAT] complete dashboard, nexus network graph, and military intel report generator` & git push.

---

### 💻 PHASE 4: ELECTRON SHELL & DESKTOP PACKAGING (NATIVE FEASIBILITY)
> **Target Bobot:** `[15% Kelayakan Implementasi]` + `[25% Purwarupa]`  
> **Tujuan:** Mengintegrasikan desktop shell Electron untuk membuktikan kapabilitas native: bypass CORS web scraping, offline operation, dan installer Windows `.exe` mandiri.

- [ ] **STEP 4.1: Electron Main Process & Native Preload (`electron/`)** `[15% Kelayakan]`
  - **Ref:** [BLUEPRINT.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/BLUEPRINT.md#L72-L76)
  - **Action:** Buat direktori `electron/`:
    - `electron/main.ts`: Konfigurasi jendela aplikasi desktop, menu militer custom, security sandbox
    - `electron/preload.ts`: ContextBridge aman yang mengekspos API desktop ke React (`window.naradaDesktop`)
  - **DoD:** Aplikasi dapat berjalan di mode desktop Electron.

- [ ] **STEP 4.2: Native Background URL Fetcher (Bypass CORS)** `[25% Inovasi Teknis]`
  - **Ref:** [BLUEPRINT.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/BLUEPRINT.md#L75)
  - **Action:** Buat `electron/url-fetcher.ts`:
    - Memanfaatkan hidden `BrowserWindow` atau Node.js native HTTP client untuk mengambil halaman web tanpa blokir CORS
    - Meneruskan HTML yang sudah di-render ke Readability parser
  - **DoD:** URL dari media online manapun dapat di-fetch langsung di aplikasi desktop.

- [ ] **STEP 4.3: Build Configuration & electron-builder Setup** `[15% Kelayakan]`
  - **Ref:** [BLUEPRINT.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/BLUEPRINT.md#L183-L200)
  - **Action:**
    - Buat `electron-builder.yml` untuk packaging Windows installer (`nsis`, custom icon, output directory)
    - Pastikan folder dokumentasi (`docs/`) di-exclude agar ukuran installer tetap ramping (~120MB)
    - Konfigurasi script `package.json`: `dev`, `electron:dev`, `build`, `electron:build`
  - **DoD:** Script build packaging terkonfigurasi rapi.

- [ ] **STEP 4.4: Packaging Test & Installer Verification** `[15% Kelayakan]` `[25% Purwarupa]`
  - **Ref:** [RULES.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/RULES.md#L236-L244)
  - **Action:** Jalankan build dan verifikasi file installer `NARADA-Setup-1.0.0.exe`.
  - **DoD:** Installer executable Windows berhasil tercipta dan dapat diinstal di PC Windows mandiri.

- [ ] **MILESTONE 4 TESTING & AUDIT:**
  - [ ] Uji fungsi URL fetcher native dan performa window desktop.
  - [ ] Commit: `[FEAT] integrate electron shell and native windows packaging` & git push.

---

### 🏆 PHASE 5: POLISH, SCENARIOS & HACKATHON DELIVERABLES
> **Target Bobot:** `[10% Kualitas Dokumentasi]` + `[25% Relevansi & Manfaat]` + `[25% Purwarupa]`  
> **Tujuan:** Mengamankan nilai maksimal pada dokumentasi, memastikan demo live memukau juri, dan menyiapkan seluruh berkas submission hackathon.

- [ ] **STEP 5.1: 1-Click Interactive Hackathon Demo Scenarios** `[25% Purwarupa]` `[25% Relevansi]`
  - **Ref:** [PRD_00_overview.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/PRD_00_overview.md#L45-L65)
  - **Action:** Sediakan tombol "Muat Data Skenario Hackathon" di Analyzer & Settings yang langsung menyuntikkan 3 kasus nyata TNI AD:
    - **Skenario 1 (Kritis):** Hoaks Manipulatif Anggaran Alutsista TNI & Kesiapan Tempur (Kategori: HOAKS & DISINFORMASI)
    - **Skenario 2 (Tinggi):** Agitasi Separatisme & Provokasi Pelanggaran HAM di Wilayah Teritorial (Kategori: PROPAGANDA)
    - **Skenario 3 (Aman):** Berita Rilis Resmi Latihan Bersama TNI AD dengan Negara Sahabat (Kategori: NETRAL)
  - **DoD:** Juri dapat menguji seluruh kemampuan NARADA secara instan tanpa perlu repot mengetik atau mencari contoh data.

- [ ] **STEP 5.2: UI/UX Micro-Interactions & Dark Military Aesthetics Polish** `[25% Purwarupa]`
  - **Ref:** [RULES.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/RULES.md#L216-L235)
  - **Action:**
    - Audit konsistensi palet warna militer taktis: `#0a0e1a` (Dark Base), `#C8102E` (Military Crimson), `#111827` (Card), `#22C55E` (Radar Green)
    - Pastikan tipografi militer tegas: Rajdhani untuk header komando, Inter untuk teks deskripsi, JetBrains Mono untuk metrik intelijen
    - Animasi transisi halus Framer Motion antar halaman dan kartu hasil
    - Audit responsif pada resolusi standar laptop (1366x768 s.d. 1920x1080)
  - **DoD:** Tampilan aplikasi memancarkan kesan software intelijen militer kelas dunia yang profesional.

- [ ] **STEP 5.3: Proposal Teknis Komprehensif (`docs/PROPOSAL_TEKNIS.md`)** `[10% Kualitas Dokumentasi]`
  - **Action:** Susun dokumen proposal teknis resmi hackathon:
    - Latar Belakang & Urgensi Perang Kognitif bagi Pertahanan Negara (data BSSN & dinamika geopolitik)
    - Arsitektur Solusi NARADA (Zero-Server, Hybrid AI, Neural OCR, Real Fact-Check)
    - Analisis Keunggulan Komparatif (dibandingkan tools open-source konvensional)
    - Rencana Pengembangan Lanjutan (Roadmap implementasi skala batalyon/kodam hingga Mabesad)
  - **DoD:** Dokumen proposal teknis lengkap, formal, dan siap dilampirkan pada portal hackathon.

- [ ] **STEP 5.4: Pitch Deck Presentation Outline (`docs/PRESENTASI.md`)** `[10% Kualitas Dokumentasi]`
  - **Action:** Susun naskah slide presentasi 10-12 slide berbobot tinggi:
    - Slide 1: Judul & Identitas (NARADA - Penjaga Kedaulatan Kognitif Matra Darat)
    - Slide 2: Problem Statement (Ancaman Siber Sosial di Ranah Kognitif Prajurit & Masyarakat)
    - Slide 3: Mengapa Solusi Saat Ini Gagal (Hanya sentimen teks mentah, rentan hoaks berkedok gambar/URL)
    - Slide 4: Solusi NARADA & 4 Saluran Input
    - Slide 5: Otak AI Hybrid (TF-IDF + Naive Bayes + Explainable Rule Taxonomy)
    - Slide 6: Verifikasi Fakta Otomatis (Mafindo / TurnBackHoax API)
    - Slide 7: Peta Jejaring Narasi Nexus (D3.js Network Graph)
    - Slide 8: Output Dokumen Laporan Intelijen Militer
    - Slide 9: Kelayakan Penerapan di Satuan (Zero-Server, Ringan, OPSEC Aman)
    - Slide 10: Visi Masa Depan Pertahanan Siber Sosial TNI AD
  - **DoD:** Naskah presentasi memikat dan terarah untuk sesi penjurian.

- [ ] **STEP 5.5: Video Demo Script & Storyboard (`docs/VIDEO_DEMO.md`)** `[10% Kualitas Dokumentasi]`
  - **Action:** Buat naskah video rekaman berdurasi 3 menit yang padat dan terstruktur:
    - Detik 00-30: Hook pembuka (isu perang kognitif) & pengenalan NARADA
    - Detik 30-90: Demonstrasi Analyzer (Paste URL berita + Drag screenshot medsos dengan Neural OCR)
    - Detik 90-120: Visualisasi graf relasi narasi di Nexus
    - Detik 120-150: Pembuatan Laporan Intelijen Standar Militer (ekspor PDF)
    - Detik 150-180: Penutup & penegasan nilai strategis bagi PUSSIBERAD TNI AD
  - **DoD:** Naskah video detail per detik siap direkam dan dinarasikan.

- [ ] **STEP 5.6: Final Code Review, README & GitHub Release v1.0.0** `[10% Dokumentasi]` `[25% Purwarupa]`
  - **Ref:** [RULES.md](file:///c:/Users/Damar/Documents/LOMBA/KARTIKA_CYBER_HACKTHON/narada/docs/RULES.md#L236-L244)
  - **Action:**
    - Perbarui `README.md` utama dengan arsitektur grafis, screenshot, dokumentasi API, dan petunjuk instalasi
    - Pastikan konsol bebas error (`npm run build` sukses 0 errors)
    - Buat Git Tag `v1.0.0` dan push seluruh repository ke GitHub
  - **DoD:** Repositori GitHub rapi, profesional, dan siap dinilai juri secara transparan.

---

## 4. KONTROL STATUS & PROGRESS TRACKER TERKUNCI

| Fase | Target Penilaian Terbesar | Total Step | Selesai | Status |
|------|---------------------------|------------|---------|--------|
| **Phase 0: Foundations** | Kelayakan (15%) + Relevansi (25%) | 4 | 4 | ✅ COMPLETED |
| **Phase 1: Hybrid AI & Fact-Check** | Inovasi Teknis (25%) + Purwarupa (25%) | 7 | 7 | ✅ COMPLETED |
| **Phase 2: Multi-Input Analyzer** | Inovasi (25%) + Purwarupa (25%) | 5 | 0 | 🟡 IN PROGRESS |
| **Phase 3: Operational Suite** | Relevansi (25%) + Purwarupa (25%) | 5 | 0 | ⏳ QUEUED |
| **Phase 4: Desktop Shell** | Kelayakan Implementasi (15%) | 4 | 0 | ⏳ QUEUED |
| **Phase 5: Polish & Deliverables** | Dokumentasi (10%) + All-Round | 6 | 0 | ⏳ QUEUED |
| **TOTAL KESELURUHAN** | **100% Bobot Rubrik Terpenuhi** | **31 Steps** | **11/31** | **35% PROGRESS** |

---

## 5. PANDUAN EKSEKUSI BERSAMA (LOCKED COMMITMENT)

1. Kita akan mengeksekusi secara ketat **step-by-step** tanpa melompati fase.
2. Setiap step yang selesai wajib melewati pengujian di terminal (`npm run build` pass).
3. Setelah lolos uji, step langsung di-centang `[x]`, di-commit ke Git dengan format konvensi (`[FEAT]`, `[UI]`, `[DOCS]`, `[FIX]`), lalu di-push ke GitHub sebagai backup bertahap.
4. Damar memiliki kendali penuh atas review tiap milestone sebelum melangkah ke milestone berikutnya.
