# RULES — Pedoman Build NARADA
## Aturan Wajib Selama Proses Pengembangan

---

## 1. ATURAN SEBELUM CODING

### 1.1 Baca PRD Dulu!
> **WAJIB:** Sebelum mengerjakan modul apapun, BACA file PRD terkait di `docs/`.
> Jangan coding tanpa memahami spesifikasi. Ini mencegah fitur melenceng dari rancangan.

| Mengerjakan Apa | Baca File |
|-----------------|-----------|
| Analyzer (URL/OCR/Text) | `PRD_01_analyzer.md` |
| AI Engine / ML | `PRD_02_ai_engine.md` |
| Fact-Check | `PRD_03_fact_checker.md` |
| Dashboard | `PRD_04_dashboard.md` |
| Nexus Graph | `PRD_05_nexus_graph.md` |
| Intel Report | `PRD_06_intel_report.md` |
| Arsitektur / Struktur | `BLUEPRINT.md` |
| Proses kerja | `RULES.md` (dokumen ini) |

### 1.2 Cek Blueprint
- Pastikan file baru dibuat di lokasi yang SESUAI dengan folder structure di `BLUEPRINT.md`
- Jangan buat folder/file di luar struktur yang sudah ditentukan

---

## 2. CODING STANDARDS

### 2.1 TypeScript Strict
```typescript
// ✅ DO: Type everything
function analyzeText(text: string): AnalysisResult { ... }

// ❌ DON'T: Use any
function analyzeText(text: any): any { ... }
```

### 2.2 Naming Conventions
| Elemen | Konvensi | Contoh |
|--------|---------|--------|
| File component | PascalCase.tsx | `Dashboard.tsx` |
| File utility | camelCase.ts | `tokenizer.ts` |
| Component | PascalCase | `FactCheckPanel` |
| Function | camelCase | `classifyText()` |
| Constant | SCREAMING_SNAKE | `MAX_RETRIES` |
| Interface | PascalCase | `AnalysisResult` |
| CSS class | kebab-case | `card-header` |

### 2.3 File Organization
- 1 component per file (max)
- Helper functions di bawah component utama ATAU di file terpisah jika reusable
- Imports order: React → external libs → internal modules → types → styles

### 2.4 Component Structure
```tsx
// 1. Imports
import { useState } from 'react'
import { SomeIcon } from 'lucide-react'
import type { SomeType } from '../types'

// 2. Helper types/constants (if small)
const MAX_ITEMS = 10

// 3. Sub-components (if small, otherwise separate file)
function SubComponent({ data }: { data: SomeType }) {
  return <div>...</div>
}

// 4. Main component (default export)
export default function MainComponent() {
  // state
  // effects
  // handlers
  // render
}
```

### 2.5 Comment Standards
```typescript
// ─── Section Header ───
// untuk memisahkan section dalam file

// Inline comment untuk logika yang tidak obvious
const score = rawScore + riskBoost // Risk boost dari keyword sensitif militer

/**
 * JSDoc untuk fungsi publik yang kompleks
 * @param text - Teks yang akan dianalisis
 * @returns Hasil analisis lengkap
 */
export function classifyText(text: string): AnalysisResult { ... }
```

---

## 3. GIT WORKFLOW

### 3.1 Commit Convention
Format: `[SCOPE] deskripsi singkat`

| Scope | Kapan Digunakan |
|-------|----------------|
| `[INIT]` | Setup awal, scaffolding |
| `[FEAT]` | Fitur baru |
| `[FIX]` | Bug fix |
| `[UI]` | Perubahan visual/styling |
| `[REFACTOR]` | Restructure tanpa ubah fungsionalitas |
| `[DOCS]` | Dokumentasi |
| `[TEST]` | Testing |
| `[POLISH]` | Finishing touch, micro-improvement |

Contoh:
```
[FEAT] implement TF-IDF + Naive Bayes classifier engine
[UI] improve Dashboard stat cards responsive layout
[FIX] OCR timeout handling for large images
[DOCS] add PRD-01 analyzer specification
```

### 3.2 Commit Frequency
- Commit setiap kali 1 fitur/modul selesai dan TESTED
- JANGAN commit code yang error/break
- Push ke GitHub setelah setiap commit → backup

### 3.3 Branch Strategy
- `main` → kode stable
- Karena tim kecil (1 orang), boleh langsung di main
- TAPI: jika eksperimen besar, buat branch dulu

---

## 4. TESTING PROTOCOL

### 4.1 Sebelum Commit — Checklist Wajib
```
□ npm run build → PASS (0 TypeScript errors)
□ Buka app → tidak ada crash
□ Fitur yang diubah → test manual 3 skenario:
    □ Happy path (input normal)
    □ Edge case (input kosong, input sangat panjang)
    □ Error case (URL invalid, gambar corrupt)
□ Visual check → layout tidak rusak
□ Console → tidak ada error/warning merah
```

### 4.2 Manual Test Scenarios Per Modul

**Analyzer:**
- [ ] Paste URL berita → konten ter-fetch dan teranalisis
- [ ] Upload screenshot → OCR extract teks → analisis berjalan
- [ ] Paste teks kosong → error message muncul
- [ ] Paste teks <10 karakter → warning
- [ ] Upload file CSV → batch analysis berjalan

**AI Engine:**
- [ ] Teks hoaks → classified sebagai HOAKS dengan confidence >60%
- [ ] Teks netral → classified sebagai NETRAL
- [ ] Teks campuran → confidence menengah, category dominan benar
- [ ] Teks sangat pendek (3 kata) → tetap bisa diproses

**Fact-Check:**
- [ ] Teks hoaks yang sudah di-debunk → muncul hasil dari API
- [ ] Teks original → "Belum ada fact-check terkait"
- [ ] Tanpa internet → pesan offline + link manual
- [ ] API key salah → error message yang jelas

**Dashboard:**
- [ ] Setelah analisis → stats terupdate
- [ ] Feed ancaman menampilkan data terbaru
- [ ] Chart render tanpa error

**Nexus:**
- [ ] Graph render tanpa crash
- [ ] Drag node → posisi berubah
- [ ] Zoom → berfungsi
- [ ] Filter → node terfilter

**Intel Report:**
- [ ] Preview update saat config berubah
- [ ] Print → layout bersih (background putih)
- [ ] Data analisis tercermin di laporan

---

## 5. DEBUGGING PROTOCOL

### 5.1 Saat Menemukan Bug
```
1. IDENTIFIKASI: Error message apa? Di mana terjadi?
2. ISOLASI: Apakah bug di UI, engine, atau data?
3. REPRODUCE: Bisa reproduce konsisten?
4. FIX: Perbaiki di tempat yang TEPAT
5. VERIFY: Test ulang + test skenario terkait
6. COMMIT: [FIX] deskripsi bug yang diperbaiki
```

### 5.2 Error Handling Pattern
```typescript
// ✅ DO: Handle errors gracefully
try {
  const result = await fetchURL(url)
  return result
} catch (error) {
  console.error('[URL Fetcher]', error)
  return { error: 'Halaman tidak dapat diakses', fallback: true }
}

// ❌ DON'T: Ignore errors silently
const result = await fetchURL(url) // will crash if fails
```

---

## 6. POLISH PROTOCOL

### 6.1 Sebelum Declare "DONE"
> **Aturan: "Done" berarti BENAR-BENAR selesai, bukan "kodenya jalan".**

Checklist sebelum modul dinyatakan selesai:
```
□ Fungsionalitas → semua acceptance criteria di PRD terpenuhi
□ Error handling → semua error case ditangani gracefully
□ Loading states → ada indicator loading saat proses async
□ Empty states → ada tampilan saat tidak ada data
□ Visual → layout konsisten dengan design system
□ Responsif → tidak overflow di resolusi 1366x768+
□ Performance → tidak ada lag noticeable
□ Code → tidak ada unused imports/variables
□ TypeScript → strict mode pass, 0 errors
□ Console → bersih, tidak ada error/warning
```

### 6.2 Final Polish (Sebelum Submission)
```
□ Semua fitur berjalan lancar
□ Demo scenario bisa dijalankan tanpa hambatan
□ Installer (.exe) bisa diinstall di PC bersih
□ Video demo terekam
□ Slide presentasi selesai
□ Source code di GitHub terupdate
```

---

## 7. TOKEN EFFICIENCY (Untuk AI Agent)

### 7.1 Prinsip Efisiensi
- **Baca PRD sebelum coding** — hindari trial-and-error yang membuang token
- **Tulis sekali, benar** — planning > coding > fixing. Jangan tulis ulang dari nol
- **Batch operations** — edit multiple non-contiguous lines dalam 1 tool call
- **Jangan tulis ulang seluruh file** — gunakan targeted edits
- **Jangan generate kode dummy** — setiap baris kode harus functional

### 7.2 Saat Membuat File Baru
1. Baca PRD terkait
2. Baca BLUEPRINT untuk lokasi file
3. Tulis seluruh file LENGKAP dalam 1 call (hindari edit bolak-balik)
4. Run build check

### 7.3 Saat Mengedit File Existing
1. View file dulu (pahami state saat ini)
2. Gunakan replace/multi_replace (jangan overwrite seluruh file)
3. Hanya edit bagian yang perlu diubah

### 7.4 Saat Debugging
1. Baca error message dengan teliti
2. View file di line yang error
3. Fix SEMUA errors sekaligus dalam 1 edit (jangan 1-by-1)

---

## 8. DESIGN SYSTEM REFERENCE

### Warna Utama
```css
--bg-primary: #0a0e1a       /* Background utama */
--bg-card: #111827          /* Background card */
--narada-red: #C8102E       /* Aksen merah militer */
--text-primary: #E2E8F0     /* Teks utama */
--text-secondary: #94A3B8   /* Teks sekunder */
```

### Warna Ancaman
```css
--threat-critical: #EF4444  /* Merah */
--threat-high: #F97316      /* Oranye */
--threat-medium: #F59E0B    /* Kuning */
--threat-low: #22C55E       /* Hijau */
```

### Font
```css
--font-display: 'Rajdhani', sans-serif   /* Heading militer */
--font-body: 'Inter', sans-serif          /* Body text */
--font-mono: 'JetBrains Mono', monospace /* Data/code */
```
