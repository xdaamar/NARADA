# BLUEPRINT — ARSITEKTUR TEKNIS NARADA
## Cetak Biru Pengembangan

---

## 1. Tech Stack

| Layer | Teknologi | Versi | Peran |
|-------|-----------|-------|-------|
| **Desktop Shell** | Electron | ^33 | Window management, IPC, native APIs |
| **Frontend** | React | ^18 | UI components |
| **Language** | TypeScript | ^5 | Type safety |
| **Bundler** | Vite | ^8 | Dev server & build |
| **Styling** | Vanilla CSS | - | Dark military theme |
| **Charts** | Recharts | ^2 | Dashboard charts |
| **Graph** | D3.js | ^7 | Nexus network graph |
| **OCR** | Tesseract.js | ^5 | Screenshot text extraction |
| **Web Scraping** | @mozilla/readability + jsdom | - | URL content extraction |
| **Icons** | Lucide React | ^0.4 | SVG icons |
| **PDF** | window.print() | Native | Report export |
| **Animation** | Framer Motion | ^11 | Micro-animations |
| **Routing** | React Router DOM | ^7 | SPA routing |
| **Build** | electron-builder | ^25 | .exe installer |

---

## 2. Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────┐
│                    ELECTRON SHELL                        │
│  ┌─────────────────────────────────────────────────┐    │
│  │              MAIN PROCESS (Node.js)              │    │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────────┐   │    │
│  │  │ IPC Main │ │ URL      │ │ File System    │   │    │
│  │  │ Handler  │ │ Fetcher  │ │ Access         │   │    │
│  │  └──────────┘ └──────────┘ └────────────────┘   │    │
│  └─────────────────────────────────────────────────┘    │
│                         ↕ IPC                            │
│  ┌─────────────────────────────────────────────────┐    │
│  │           RENDERER PROCESS (React App)           │    │
│  │                                                   │    │
│  │  ┌─────────┐  ┌───────────────┐  ┌───────────┐  │    │
│  │  │ UI Layer│  │ Engine Layer  │  │ Data Layer│  │    │
│  │  │         │  │               │  │           │  │    │
│  │  │ Pages   │  │ ML Classifier │  │ Session   │  │    │
│  │  │ Comps   │  │ Rule Engine   │  │ Storage   │  │    │
│  │  │ Styles  │  │ OCR Engine    │  │ API Calls │  │    │
│  │  │         │  │ Fact Checker  │  │           │  │    │
│  │  └─────────┘  └───────────────┘  └───────────┘  │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Folder Structure (Target)

```
narada/
├── docs/                          ← PRD, Blueprint, Rules (TIDAK ikut build)
│   ├── PRD_00_overview.md
│   ├── PRD_01_analyzer.md
│   ├── PRD_02_ai_engine.md
│   ├── PRD_03_fact_checker.md
│   ├── PRD_04_dashboard.md
│   ├── PRD_05_nexus_graph.md
│   ├── PRD_06_intel_report.md
│   ├── BLUEPRINT.md
│   └── RULES.md
│
├── electron/                      ← Electron main process
│   ├── main.ts                    ← Entry point Electron
│   ├── preload.ts                 ← Context bridge
│   └── url-fetcher.ts             ← URL content fetcher (BrowserWindow)
│
├── src/                           ← React renderer process
│   ├── main.tsx                   ← React entry point
│   ├── App.tsx                    ← Root component (sidebar, router, topbar)
│   ├── index.css                  ← Global styles (dark military theme)
│   ├── types.ts                   ← Shared TypeScript interfaces
│   │
│   ├── engine/                    ← AI/NLP Engine
│   │   ├── ml/
│   │   │   ├── model.json         ← Trained TF-IDF + NB weights
│   │   │   ├── tfidf.ts           ← TF-IDF vectorizer
│   │   │   ├── naive-bayes.ts     ← Naive Bayes classifier
│   │   │   └── tokenizer.ts       ← Indonesian tokenizer + stopwords
│   │   ├── classifier.ts          ← Rule-based engine
│   │   ├── combiner.ts            ← ML + Rule combiner (60/40)
│   │   ├── fact-checker.ts        ← Google Fact Check API client
│   │   └── profiler.ts            ← Account bot/buzzer scorer
│   │
│   ├── pages/                     ← Page components
│   │   ├── Dashboard.tsx           ← Situational awareness
│   │   ├── Analyzer.tsx            ← Multi-input analyzer (URL/OCR/Text/File)
│   │   ├── Nexus.tsx               ← Network graph
│   │   ├── Reports.tsx             ← Intel report generator
│   │   └── SettingsPage.tsx        ← Settings & API key config
│   │
│   ├── components/                ← Reusable UI components
│   │   ├── AnalysisResult.tsx      ← Result display card
│   │   ├── FactCheckPanel.tsx      ← Fact-check results display
│   │   ├── OCRUploader.tsx         ← Screenshot drag-drop + OCR
│   │   ├── URLInput.tsx            ← URL input + fetch status
│   │   └── ...
│   │
│   └── utils/                     ← Helper utilities
│       ├── storage.ts              ← sessionStorage helpers
│       └── format.ts               ← Date, number formatters
│
├── public/                        ← Static assets
│   └── tessdata/                  ← OCR trained data (bundled)
│       ├── ind.traineddata         ← Indonesia (~15MB)
│       └── eng.traineddata         ← English (~12MB)
│
├── index.html                     ← HTML entry point
├── package.json
├── tsconfig.json
├── vite.config.ts
├── electron-builder.yml           ← Build config for .exe
├── .gitignore
└── README.md
```

---

## 4. Data Flow

```
[User Input]
    │
    ├─ URL → electron/url-fetcher.ts → extract content
    ├─ Screenshot → tesseract.js OCR → extract text
    ├─ Text → langsung
    └─ File → parse CSV/TXT → extract text[]
    │
    ▼
[engine/combiner.ts]
    │
    ├─ engine/ml/naive-bayes.ts → ML prediction {category, probs}
    ├─ engine/classifier.ts     → Rule scoring {keywords, explanation}
    └─ Combine (60% ML + 40% Rule) → AnalysisResult
    │
    ▼
[engine/fact-checker.ts]
    │
    └─ Google Fact Check API → FactCheckResult
    │
    ▼
[pages/Analyzer.tsx]
    │
    ├─ Display verdict + fact-check
    ├─ Store to sessionStorage
    └─ Update Dashboard data
```

---

## 5. State Management

- **Session data:** `sessionStorage` (per-session, hilang saat tutup app)
  - Key: `narada_analyses` → AnalysisResult[]
  - Key: `narada_settings` → { apiKey, unit, analyst }
- **No Redux/Zustand needed** — data flow sederhana, cukup prop drilling + sessionStorage
- **React state:** useState/useEffect per component

---

## 6. Routing

| Route | Page | Deskripsi |
|-------|------|-----------|
| `/` | Dashboard | Halaman utama |
| `/analyzer` | Analyzer | Multi-input analysis |
| `/nexus` | Nexus | Network graph |
| `/reports` | Reports | Intel report |
| `/settings` | Settings | Konfigurasi |

---

## 7. Build & Packaging

### Development
```bash
npm run dev          # Vite dev server (React only, tanpa Electron)
npm run electron:dev # Electron + Vite (full desktop mode)
```

### Production
```bash
npm run build        # TypeScript check + Vite build
npm run electron:build # electron-builder → .exe installer
```

### Output
```
dist/
  NARADA-Setup-1.0.0.exe    ← Installer Windows (~120-150MB)
```

---

## 8. Build Phases

| Phase | Fokus | Target |
|-------|-------|--------|
| **Phase 1** | Core UI + AI Engine (React only, tanpa Electron) | UI berfungsi, classifier bekerja |
| **Phase 2** | Fact-Check + OCR + URL Fetcher | Integrasi API + Tesseract |
| **Phase 3** | Electron Integration | Desktop shell, IPC, packaging |
| **Phase 4** | Polish + Testing + Documentation | Bug fix, presentasi, video |
