# NARADA — ARCHITECTURE SPECIFICATION: SOCIAL GATEWAY & FORENSIC ENGINE V2
## PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
### Sistem Pertahanan Wilayah Kognitif & Forensik Narasi Siber Sosial

---

## 1. Arsitektur Multi-Tier Ekstraksi Media Sosial

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │                 NARADA TACTICAL INTELLIGENCE CONSOLE                   │
  │                  (React 18 + TypeScript + Vite 8)                      │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
                        detectSocialPlatform(cleanUrl)
                                      │
           ┌──────────────────────────┴──────────────────────────┐
           ▼                                                     ▼
┌──────────────────────────┐                          ┌──────────────────────────┐
│      YOUTUBE ENGINE      │                          │      TIKTOK ENGINE       │
│ (youtube-engine.ts)      │                          │ (tiktok-engine.ts)       │
└──────────┬───────────────┘                          └──────────┬───────────────┘
           │                                                     │
 ┌─────────┴─────────┐                                 ┌─────────┴─────────┐
 │ Tier 1: InnerTube │                                 │ Tier 1: Gateway   │
 │ Gateway Server    │                                 │ TikTok Service    │
 └─────────┬─────────┘                                 └─────────┬─────────┘
           ▼ (Fallback)                                          ▼ (Fallback)
 ┌───────────────────┐                                 ┌───────────────────┐
 │ Tier 2: Official  │                                 │ Tier 2: Public    │
 │ YouTube Data API  │                                 │ oEmbed Protocol   │
 └─────────┬─────────┘                                 └─────────┬─────────┘
           ▼ (Fallback)                                          ▼ (Fallback)
 ┌───────────────────┐                                 ┌───────────────────┐
 │ Tier 3: oEmbed    │                                 │ Tier 3: Direct    │
 │ Resolvers         │                                 │ Profile Crawl     │
 └───────────────────┘                                 └───────────────────┘
```

---

## 2. Paginasi Komentar & Jaminan Top Likes Akurat (Fresh Real-Time)

### 2.1 Multi-Page Traversal YouTube
- **Tantangan Lapangan:** Pengambilan komentar single-page (default 20 item) sering kali melewatkan komentar dengan apresiasi suka tertinggi jika komentar tersebut berada di halaman ke-2 atau seterusnya.
- **Solusi Taktis:** Gateway mengeksekusi multi-page traversal dengan `continuationToken` terikat hingga batasan budget kuota aman (maksimal 50–100 komentar publik terverifikasi).
- **Sorting Kontrak Mutlak:** Seluruh komentar hasil traversing selalu diurutkan secara deterministik menurun (`descending`):
  $$\text{Sort}(c_A, c_B) = \text{likeCount}(c_B) - \text{likeCount}(c_A)$$
  sehingga komentar 96 likes, 56 likes, dan 25 likes selalu menduduki posisi puncak secara transparan.

---

## 3. Algoritma Klusterisasi Jaccard & Filter Stopwords Bahasa Indonesia

### 3.1 Tokenisasi Leksikal Slang & Percakapan
Untuk mengeliminasi *false positive* pada komentar repetitif organik yang pendek, tokenizer leksikal memfilter 32 kata henti bahasa Indonesia informal (`yg`, `utk`, `dgn`, `klo`, `nih`, `sih`, `ya`, `dong`, `nya`, dsb.):
$$S(A, B) = \frac{|A \cap B|}{|A \cup B|}$$
- Komentar dikelompokkan ke dalam kluster copypasta jika nilai $S(A, B) \ge 0.70$.
- Komentar dengan token unik $< 3$ kata diisolasi agar tidak mengotori kluster operasi templat buzzer.

---

## 4. Deteksi Perilaku Inautentik Terkoordinasi (Buzzer Swarm)

### 4.1 Temporal Burst Velocity & Konsentrasi Akun
- **Kecepatan Semburan (*Burst Velocity*):** Dihitung rata-rata maupun puncak jendela geser (*sliding window*) 120 detik.
- **Rasio Konsentrasi Akun:** Mendeteksi rasio akun unik terhadap total komentar untuk mengidentifikasi akun berulang yang melakukan *spamming*.
- **Formula Skor Koordinasi (0 - 100%):**
  $$\text{Score} = 50\% \times \text{CopypastaRatio} + 25\% \times \text{BurstFactor} + 15\% \times \text{AccountConcentration} + 10\% \times \text{ClusterDominance}$$

---

## 5. UI Tactical Chassis Standard (PUSSIBERAD C2)

- **Deck 1:** Profil Konten, Kapsi, Thumbnail, dan Metrik Interaksi (Likes, Tayangan, Komentar, Bagikan, Durasi Detik).
- **Deck 2:** Daftar Top Komentar Terpopuler dengan indikator nomor peringkat baja dan jumlah likes asli.
- **Deck 3:** Kluster Komentar Copypasta dengan persentase dominasi dan daftar akun yang terlibat.
- **Deck 4:** Indikator Skor Ancaman Buzzer, kata kunci dominan, kecepatan komentar/menit, dan narasi intelijen militer.

---
*NARADA — Divisi Siber Sosial & Operasi Informasi PUSSIBERAD TNI AD*
