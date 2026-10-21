# PRD-04: DASHBOARD
## Situational Awareness Command Center

---

## 1. Ringkasan

Dashboard adalah halaman utama NARADA yang menampilkan ringkasan situasi ancaman kognitif berdasarkan seluruh analisis yang telah dilakukan pada sesi tersebut.

---

## 2. Komponen Dashboard

### 2.1 Stat Cards (Baris Atas)
4 kartu statistik:
| Stat | Deskripsi | Warna Dinamis |
|------|-----------|---------------|
| Total Analisis | Jumlah analisis pada sesi ini | Default |
| Ancaman Terdeteksi | Jumlah konten non-NETRAL | Merah jika > 0 |
| Ancaman Kritis | Jumlah level CRITICAL | Merah jika > 0 |
| Ancaman Tinggi | Jumlah level HIGH | Oranye jika > 0 |

### 2.2 Alert Banner
- Muncul HANYA jika ada ancaman CRITICAL
- Warna merah, ikon peringatan, teks eskalasi

### 2.3 Timeline Chart
- LineChart dari Recharts
- X-axis: waktu (per jam / per analisis)
- Y-axis: jumlah per threat level
- 4 garis: critical (merah), high (oranye), medium (kuning), low (hijau)

### 2.4 Distribusi Kategori (Pie Chart)
- PieChart donut dari data analisis sesi
- 5 kategori dengan warna masing-masing
- Legend di bawah chart

### 2.5 Feed Ancaman Terbaru
- List 5 analisis terakhir yang kategorinya non-NETRAL
- Setiap item: badge kategori + badge threat level + preview teks + timestamp
- Klik item → navigasi ke riwayat analisis

### 2.6 Status Sistem
- Daftar modul + statusnya (AKTIF / OFFLINE)
- Info versi NARADA

---

## 3. Data Source
- Semua data dari `sessionStorage` key: `narada_analyses`
- Auto-refresh setiap 5 detik
- Data reset saat app ditutup (session-based)

---

## 4. Acceptance Criteria
- [ ] Stat cards update real-time saat analisis baru ditambahkan
- [ ] Alert banner muncul hanya saat ada ancaman CRITICAL
- [ ] Timeline chart menampilkan distribusi ancaman over time
- [ ] Pie chart menampilkan distribusi kategori akurat
- [ ] Feed ancaman menampilkan 5 ancaman terbaru
- [ ] Status sistem menampilkan modul yang aktif
