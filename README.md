# NARADA — Platform Intelijen Ancaman Kognitif Berbasis AI
## Kartika Cyber Hackathon 2026 | PUSSIBERAD TNI AD × CODEPOLITAN

> **Kategori:** Siber Sosial (Cognitive Domain)
> **Tim:** Damar × Antigravity AI

### Deskripsi
Platform desktop berbasis AI yang membantu analis siber satuan TNI AD mendeteksi dan memverifikasi ancaman kognitif digital dari berbagai sumber — termasuk link berita, postingan media sosial, dan broadcast messaging.

### Tech Stack
- **Shell:** Electron (Chromium + Node.js)
- **UI:** React 18 + TypeScript + Vite
- **AI/ML:** TF-IDF + Naive Bayes Classifier, Tesseract.js OCR
- **Data:** Google Fact Check API, Mafindo/TurnBackHoax
- **Viz:** D3.js, Recharts
- **Build:** electron-builder → .exe installer

### Dokumentasi
Seluruh dokumen perencanaan dan arsitektur (PRD, Blueprint, Architecture V2, Mission Log) berada di direktori `docs/`:
- `docs/ARCHITECTURE_SOCIAL_GATEWAY_V2.md`: Spesifikasi gerbang intelijen media sosial v2 & buzzer detection.
- `docs/SPRINT_13_MISSION_LOG.md`: Log misi hardening engine YouTube, TikTok, dan perampingan konsol forensik.

### Verifikasi & Pengujian Otomatis
```bash
# Validasi menyeluruh kluster media sosial & buzzer swarm
npm run test:social

# Validasi spektrum siber & peretasan nasional
npm run test:cyber

# Validasi konsol berita tersemat & arsip dinamis
npm run test:archive

# Verifikasi kompilasi produksi
npm run build
```

---
*NARADA — Menjaga Pikiran, Melindungi Bangsa*
