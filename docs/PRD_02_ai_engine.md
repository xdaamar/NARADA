# PRD-02: AI/ML ENGINE
## Engine Klasifikasi Hybrid — Machine Learning + Rule-Based NLP

---

## 1. Ringkasan

Engine NARADA menggunakan pendekatan hybrid 2-layer:
1. **ML Layer:** TF-IDF + Naive Bayes classifier (genuine machine learning)
2. **Rule Layer:** Keyword dictionary + heuristic scoring (untuk explainability)

Keduanya digabungkan untuk menghasilkan verdict yang akurat DAN bisa dijelaskan.

---

## 2. Arsitektur Engine

```
Input Teks (dari Analyzer)
    │
    ├──→ [Layer 1: ML Classifier]
    │    TF-IDF vectorization → Naive Bayes prediction
    │    Output: { category, probability[] }
    │
    ├──→ [Layer 2: Rule Engine]
    │    Keyword matching → Pattern scoring → Risk assessment
    │    Output: { keywords[], patterns[], riskScore }
    │
    └──→ [Combiner]
         Weighted merge: ML (60%) + Rule (40%)
         Output: AnalysisResult { category, confidence, explanation, ... }
```

---

## 3. Layer 1: ML Classifier (TF-IDF + Naive Bayes)

### 3.1 Apa Itu
- **TF-IDF (Term Frequency–Inverse Document Frequency):** Mengubah teks menjadi vector numerik berdasarkan frekuensi kata dan seberapa unik kata tersebut.
- **Naive Bayes:** Algoritma klasifikasi probabilistik yang menghitung peluang teks masuk ke kategori tertentu.
- Ini adalah **machine learning yang SAH** — model DILATIH dari dataset, bukan hardcoded.

### 3.2 Training Data
Model dilatih dari dataset teks Indonesia yang dikurasi:
- Sumber: Kumpulan teks hoaks dari TurnBackHoax, teks berita resmi, posting propaganda yang sudah di-label
- Label: HOAKS, PROPAGANDA, BUZZER, DISINFORMASI, NETRAL
- Minimum: 200-500 sampel per kategori (bisa dikurasi manual)
- Format: JSON file berisi { text, label }

### 3.3 Model Storage
- Model disimpan sebagai JSON file (~50-200KB):
  ```json
  {
    "vocabulary": { "kata1": 0, "kata2": 1, ... },
    "idf": [2.3, 1.1, ...],
    "classPriors": { "HOAKS": 0.25, "PROPAGANDA": 0.20, ... },
    "classWordProbs": {
      "HOAKS": [0.001, 0.005, ...],
      "PROPAGANDA": [0.003, 0.001, ...]
    }
  }
  ```
- Model dibundle dalam app → offline capable

### 3.4 Inference Flow
```typescript
// 1. Tokenize & preprocess
const tokens = tokenize(text)  // lowercase, remove stopwords, stem

// 2. TF-IDF vectorize
const tfidfVector = computeTFIDF(tokens, model.vocabulary, model.idf)

// 3. Naive Bayes classify
const probabilities = {}
for (const cls of CATEGORIES) {
  probabilities[cls] = Math.log(model.classPriors[cls])
  for (const [idx, tfidf] of tfidfVector.entries()) {
    probabilities[cls] += tfidf * Math.log(model.classWordProbs[cls][idx] + 1e-10)
  }
}

// 4. Normalize to percentages
const result = softmax(probabilities)
// Output: { HOAKS: 0.72, PROPAGANDA: 0.15, BUZZER: 0.08, ... }
```

### 3.5 File Structure
```
src/
  engine/
    ml/
      model.json          ← Trained model weights
      tfidf.ts            ← TF-IDF vectorizer
      naive-bayes.ts      ← Naive Bayes classifier
      tokenizer.ts        ← Indonesia text tokenizer + stopwords
      trainer.ts           ← Training script (dev-time only)
```

---

## 4. Layer 2: Rule-Based Engine

### 4.1 Fungsi
- Mendeteksi kata kunci spesifik dan pola narasi
- Memberikan PENJELASAN yang bisa dibaca manusia (explainability)
- Supplement ML classifier dengan domain knowledge

### 4.2 Keyword Dictionary
700+ kata kunci Bahasa Indonesia dalam 5 kategori:
- **HOAKS:** hoaks, hoax, bohong, palsu, sebarkan, viral, benarkah, beredar, ...
- **PROPAGANDA:** rezim, revolusi, pengkhianat, asing, imperialis, rakyat melawan, ...
- **BUZZER:** viralkan, retweet, share, tag teman, trending, kampanye, ...
- **DISINFORMASI:** manipulasi, deepfake, keluar konteks, data palsu, foto editan, ...
- **HIGH_RISK:** tni, militer, presiden, kudeta, makar, provokasi, ...

### 4.3 Output
```typescript
interface RuleEngineOutput {
  matchedKeywords: string[]     // Kata kunci yang ditemukan
  categoryScores: Record<ContentCategory, number>
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  explanation: string           // Penjelasan dalam Bahasa Indonesia
}
```

---

## 5. Combiner — Penggabungan ML + Rule

```typescript
function combine(mlResult: MLOutput, ruleResult: RuleOutput): AnalysisResult {
  const ML_WEIGHT = 0.6
  const RULE_WEIGHT = 0.4

  // Weighted score per category
  const finalScores = {}
  for (const cat of CATEGORIES) {
    finalScores[cat] = 
      (mlResult.probabilities[cat] * ML_WEIGHT) +
      (ruleResult.categoryScores[cat] / 100 * RULE_WEIGHT)
  }

  // Winner category
  const category = argmax(finalScores)
  const confidence = Math.round(finalScores[category] * 100)

  // Threat level
  const threatLevel = computeThreatLevel(confidence, ruleResult.riskLevel)

  return {
    category,
    confidence,
    threatLevel,
    scores: normalizeForDisplay(finalScores),
    keywords: ruleResult.matchedKeywords,
    explanation: ruleResult.explanation,  // Dari rule engine (human readable)
    recommendation: getRecommendation(category, threatLevel),
  }
}
```

---

## 6. Kategori Output

| Kategori | Deskripsi | Warna |
|----------|-----------|-------|
| **HOAKS** | Informasi yang secara keseluruhan salah/tidak terverifikasi | #EF4444 (merah) |
| **PROPAGANDA** | Narasi manipulatif untuk mempengaruhi opini publik | #F97316 (oranye) |
| **BUZZER** | Koordinasi artifisial untuk menyebarkan pesan tertentu | #F59E0B (kuning) |
| **DISINFORMASI** | Informasi parsial benar tapi disajikan menyesatkan | #8B5CF6 (ungu) |
| **NETRAL** | Tidak terindikasi ancaman kognitif | #22C55E (hijau) |

---

## 7. Acceptance Criteria

- [ ] ML classifier menghasilkan probabilitas per kategori dari teks input
- [ ] Rule engine mendeteksi keyword dan menghasilkan penjelasan
- [ ] Combiner menggabungkan keduanya dengan bobot 60/40
- [ ] Output mencakup: category, confidence, threatLevel, keywords, explanation, recommendation
- [ ] Inference time < 100ms untuk teks standar (100 kata)
- [ ] Model JSON ter-bundle dalam build
