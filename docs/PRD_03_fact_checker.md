# PRD-03: FACT-CHECK INTEGRATION
## Verifikasi Fakta Otomatis — Google Fact Check API + Mafindo

---

## 1. Ringkasan

Setelah AI Engine mengklasifikasi konten, NARADA otomatis melakukan cross-reference dengan database fact-check eksternal untuk memvalidasi temuan dengan data nyata.

---

## 2. Sumber Data Fact-Check

### 2.1 Google Fact Check Tools API (Primer)
- **Endpoint:** `https://factchecktools.googleapis.com/v1alpha1/claims:search`
- **Biaya:** GRATIS (free tier)
- **Setup:** Google Cloud API Key (gratis)
- **Coverage:** Aggregasi fact-check dari seluruh dunia termasuk Indonesia
- **Publisher Indonesia:** Mafindo/TurnBackHoax, CekFakta Tempo, Kompas, Koran Sindo

**Request:**
```typescript
const response = await fetch(
  `https://factchecktools.googleapis.com/v1alpha1/claims:search` +
  `?query=${encodeURIComponent(queryText)}` +
  `&languageCode=id` +
  `&pageSize=5` +
  `&key=${API_KEY}`
)
```

**Response Structure:**
```typescript
interface FactCheckResponse {
  claims: Array<{
    text: string              // Klaim yang diperiksa
    claimant: string          // Sumber klaim
    claimDate: string         // Tanggal klaim
    claimReview: Array<{
      publisher: {
        name: string          // e.g. "TurnBackHoax - Mafindo"
        site: string          // e.g. "turnbackhoax.id"
      }
      url: string             // Link artikel debunk
      title: string           // Judul artikel fact-check
      textualRating: string   // e.g. "Salah", "Misleading", "Benar"
      languageCode: string    // "id"
    }>
  }>
}
```

### 2.2 TurnBackHoax Search (Sekunder)
- **URL:** `https://search.turnbackhoax.id/`
- **Metode:** Scrape hasil pencarian (jika API key Yudistira tidak tersedia)
- **Fallback:** Embed link pencarian manual untuk user

### 2.3 Google Fact Check Explorer (Fallback Manual)
- **URL:** `https://toolbox.google.com/factcheck/explorer`
- **Jika API gagal:** Tampilkan link ke explorer untuk pencarian manual

---

## 3. Flow Integrasi

```
AI Engine selesai analisis
    │
    ├── Jika internet tersedia:
    │   │
    │   ├──→ Extract query keywords dari teks (max 10 kata kunci)
    │   ├──→ Query Google Fact Check API
    │   │       ├── Ada hasil → tampilkan fact-check matches
    │   │       └── Tidak ada → tampilkan "Belum ada fact-check terkait"
    │   │
    │   └──→ Generate link pencarian TurnBackHoax
    │
    └── Jika offline:
        └──→ Tampilkan: "Verifikasi fakta tidak tersedia (offline)"
             + link manual untuk dicek nanti
```

---

## 4. UI — Fact Check Section (dalam Result Panel)

```
┌─────────────────────────────────────────┐
│ ✅ VERIFIKASI FAKTA                     │
│                                          │
│ ┌─ Dari Google Fact Check API ────────┐ │
│ │                                     │ │
│ │ 1. TurnBackHoax (Mafindo)          │ │
│ │    "Klaim bahwa ... sudah dibantah"  │ │
│ │    Rating: ❌ SALAH                 │ │
│ │    🔗 turnbackhoax.id/xxx           │ │
│ │                                     │ │
│ │ 2. CekFakta Tempo                  │ │
│ │    "Informasi ini menyesatkan"      │ │
│ │    Rating: ⚠️ MISLEADING           │ │
│ │    🔗 cekfakta.tempo.co/xxx         │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ 🔎 Cek manual di TurnBackHoax →         │
│ 🔎 Cek manual di Fact Check Explorer →  │
└─────────────────────────────────────────┘
```

---

## 5. Data Types

```typescript
interface FactCheckResult {
  available: boolean              // Apakah ada koneksi internet
  query: string                   // Query yang digunakan
  claims: FactCheckClaim[]        // Hasil dari API
  manualSearchUrl: string         // Link pencarian manual TurnBackHoax
  explorerUrl: string             // Link Google Fact Check Explorer
}

interface FactCheckClaim {
  claimText: string               // Teks klaim
  claimant: string                // Sumber klaim
  publisherName: string           // Nama penerbit fact-check
  publisherSite: string           // Website penerbit
  articleUrl: string              // Link ke artikel fact-check
  articleTitle: string            // Judul artikel
  rating: string                  // Rating: "Salah", "Benar", "Misleading"
  ratingColor: string             // Warna badge
}
```

---

## 6. API Key Management

- API Key disimpan di localStorage (encrypted sederhana)
- User bisa input API Key sendiri di halaman Settings
- Bisa juga bundled default key untuk demo (dengan rate limit awareness)
- Fallback jika tanpa API Key: tampilkan link manual saja

---

## 7. Acceptance Criteria

- [ ] Fact check otomatis berjalan setelah setiap analisis (jika online)
- [ ] Hasil fact-check tampil di bawah verdict AI Engine
- [ ] Setiap claim menampilkan: publisher, rating, link artikel
- [ ] Rating diberi warna badge (merah=Salah, kuning=Misleading, hijau=Benar)
- [ ] Jika offline, tampilkan pesan jelas + link manual
- [ ] Link TurnBackHoax search selalu tersedia
- [ ] API Key bisa dikonfigurasi di Settings
