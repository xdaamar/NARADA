# PRD-01: MULTI-INPUT ANALYZER
## Modul Inti — Penerimaan & Parsing Input dari Berbagai Sumber

---

## 1. Ringkasan Modul

NARADA Analyzer adalah modul inti yang menerima input dari 4 sumber berbeda, memparsing konten, dan meneruskannya ke AI Engine untuk analisis.

---

## 2. Mode Input

### 2.1 URL Analyzer
**Deskripsi:** User paste URL dari berita/posting → NARADA fetch halaman → extract konten → analisis.

**Flow:**
```
User paste URL → Validasi URL format
  → Electron hidden BrowserWindow memuat halaman
  → Tunggu 2-3 detik (render JS)
  → Extract HTML → Mozilla Readability parse konten
  → Output: { title, content, author, siteName, excerpt }
  → Kirim ke AI Engine
```

**URL yang Didukung:**
| Platform | Format URL | Metode Fetch |
|----------|-----------|--------------|
| Berita online | `detik.com/xxx`, `kompas.com/xxx` | HTTP + Readability |
| Twitter/X | `x.com/user/status/xxx` | HTTP fetch |
| Facebook | `facebook.com/xxx/posts/xxx` | HTTP fetch (public) |
| Blog | `blogspot.com`, `wordpress.com` | HTTP + Readability |
| Lainnya | URL apapun | HTTP + Readability fallback |

**Teknologi:**
- `Electron BrowserWindow` (hidden, loadURL)
- `@mozilla/readability` (extract konten artikel)
- `jsdom` (DOM parsing di Node.js)

**Data Output:**
```typescript
interface URLAnalysisInput {
  url: string
  title: string          // Judul halaman/artikel
  content: string        // Teks konten utama
  author: string | null  // Penulis jika terdeteksi
  siteName: string       // Nama situs
  excerpt: string        // Ringkasan singkat
  fetchedAt: number      // Timestamp
}
```

**Error Handling:**
- URL tidak valid → tampilkan error "Format URL tidak valid"
- Halaman gagal load → timeout 10 detik → "Halaman tidak dapat diakses"
- Konten tidak bisa di-extract → fallback ke raw text body

---

### 2.2 Screenshot Analyzer (OCR)
**Deskripsi:** User screenshot postingan medsos → upload/drag-drop gambar → OCR extract teks → analisis.

**Flow:**
```
User drag-drop / upload gambar (PNG/JPG/WEBP)
  → Tampilkan preview gambar
  → Tesseract.js OCR (bahasa: ind + eng)
  → Extract teks dari gambar
  → Tampilkan teks ter-extract (user bisa edit/koreksi)
  → User konfirmasi → kirim ke AI Engine
```

**Teknologi:**
- `tesseract.js` v5+ (LSTM neural network OCR)
- Bahasa: `ind` (Indonesia) + `eng` (English) dual mode
- Trained data di-bundle dalam app (offline capable)
- File: `ind.traineddata` (~15MB), `eng.traineddata` (~12MB)

**Data Output:**
```typescript
interface OCRAnalysisInput {
  imagePath: string       // Path gambar asli
  extractedText: string   // Teks hasil OCR
  confidence: number      // OCR confidence (0-100)
  editedText?: string     // Teks setelah user edit (jika ada)
  language: string        // Bahasa yang terdeteksi
}
```

**UX Notes:**
- Tampilkan progress bar selama OCR (biasanya 3-8 detik)
- Setelah OCR, tampilkan teks dalam textarea yang BISA DIEDIT user (karena OCR tidak selalu sempurna)
- User klik "Lanjut Analisis" setelah review teks

---

### 2.3 Text Analyzer
**Deskripsi:** User paste teks manual → langsung analisis.

**Flow:**
```
User paste/ketik teks di textarea
  → Validasi minimum 10 karakter
  → Kirim ke AI Engine
```

**Data Output:**
```typescript
interface TextAnalysisInput {
  text: string
  wordCount: number
  source: 'manual'
}
```

---

### 2.4 File Analyzer (Batch)
**Deskripsi:** User upload file TXT/CSV → analisis batch.

**Flow:**
```
User upload file (.txt atau .csv)
  → Parse konten file
  → Jika CSV: split per baris, analisis tiap baris
  → Jika TXT: analisis seluruh konten sebagai 1 input
  → Kirim ke AI Engine (batch mode)
```

**Format CSV yang didukung:**
```csv
content
"Teks postingan pertama yang mau dianalisis"
"Teks postingan kedua"
"Teks postingan ketiga"
```

---

## 3. UI Layout — Analyzer Page

```
┌──────────────────────────────────────────────────────┐
│  NARADA Analyzer                                      │
│  Analisis konten dari berbagai sumber                 │
│                                                        │
│  ┌──────┐ ┌──────┐ ┌──────────┐ ┌──────┐             │
│  │ 🔗URL│ │ 📸OCR│ │ 📝Teks   │ │ 📁File│            │
│  └──────┘ └──────┘ └──────────┘ └──────┘             │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─          │
│                                                        │
│  [Tab Content Area - berubah sesuai tab aktif]        │
│                                                        │
│  ┌─────────────────────┐ ┌────────────────────────┐  │
│  │ Input Panel          │ │ Result Panel            │  │
│  │                     │ │                         │  │
│  │ [Input sesuai mode] │ │ [Verdict + Fact Check]  │  │
│  │                     │ │ [Score Bars]             │  │
│  │                     │ │ [Keywords]               │  │
│  │ [Tombol Analisis]   │ │ [Penjelasan]            │  │
│  │                     │ │ [Rekomendasi]           │  │
│  └─────────────────────┘ └────────────────────────┘  │
│                                                        │
│  ┌────────────────────────────────────────────────┐   │
│  │ Riwayat Analisis (collapsed list)              │   │
│  └────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

---

## 4. Acceptance Criteria

- [ ] User bisa paste URL → konten ter-fetch dan teranalisis dalam <10 detik
- [ ] User bisa upload screenshot → OCR extract teks dalam <8 detik
- [ ] User bisa edit teks hasil OCR sebelum analisis
- [ ] User bisa paste teks manual → analisis dalam <1 detik
- [ ] User bisa upload file CSV → batch analisis
- [ ] Semua mode menampilkan hasil di Result Panel yang sama
- [ ] Riwayat analisis tersimpan di sessionStorage
- [ ] Error handling jelas untuk setiap kasus gagal
