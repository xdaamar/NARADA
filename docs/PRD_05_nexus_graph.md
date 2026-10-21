# PRD-05: NEXUS NETWORK GRAPH
## Visualisasi Peta Jaringan Narasi & Aktor

---

## 1. Ringkasan

Nexus Graph memvisualisasikan hubungan antar konten yang telah dianalisis, mengelompokkan narasi serupa, dan menampilkan pola koordinasi yang mencurigakan dalam bentuk graph interaktif.

---

## 2. Konsep Graph

### Node Types
| Tipe | Bentuk | Deskripsi |
|------|--------|-----------|
| **Konten** | Lingkaran | Satu konten yang dianalisis |
| **Narasi** | Hexagon | Cluster narasi serupa (auto-grouped) |
| **Sumber** | Diamond | Sumber/domain yang unik |

### Edge Types
| Tipe | Garis | Deskripsi |
|------|-------|-----------|
| **similarity** | Solid | Kesamaan konten (keyword overlap) |
| **same_source** | Dashed | Dari sumber/domain yang sama |

### Node Coloring
- Warna berdasarkan threat level (merah/oranye/kuning/hijau)
- Ukuran berdasarkan confidence score

---

## 3. Auto-Grouping Algorithm

```
Untuk setiap analisis baru:
  1. Extract keyword set
  2. Bandingkan dengan semua analisis sebelumnya
  3. Jika keyword overlap > 40%:
     → Hubungkan dengan edge "similarity"
     → Jika >3 konten terhubung → buat cluster "Narasi"
  4. Jika dari URL/domain yang sama:
     → Hubungkan dengan edge "same_source"
```

---

## 4. Interaksi

- **Drag node:** Reposisi node
- **Scroll:** Zoom in/out
- **Drag canvas:** Pan
- **Klik node:** Tampilkan detail konten di sidebar
- **Filter:** By threat level (all/critical/high)
- **Reset:** Reset layout ke posisi force-directed default

---

## 5. Teknologi
- D3.js force-directed graph
- SVG rendering dalam React component
- Force simulation: charge (repulsion), link (attraction), center, collision

---

## 6. Data Source
- Dari `sessionStorage` key: `narada_analyses`
- Graph dibangun dinamis dari history analisis
- Demo mode: data dummy jaringan buzzer (12 nodes, 15 links)

---

## 7. Acceptance Criteria
- [ ] Graph menampilkan semua analisis sebagai nodes
- [ ] Nodes berwarna sesuai threat level
- [ ] Edges menghubungkan konten yang mirip (keyword overlap)
- [ ] Interaksi drag, zoom, pan berfungsi
- [ ] Filter by threat level berfungsi
- [ ] Demo mode menampilkan contoh jaringan buzzer
- [ ] Legend menjelaskan arti setiap elemen visual
