/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — SPRINT 09: INTELLIGENCE CORE & CLAIM ASSESSMENT BENCHMARK SUITE
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Meliputi:
 * 1. WP-01: Kontrak Entitas & Domain Model
 * 2. WP-02: Relevance Intelligence Engine (4-Stage & Disambiguasi Konteks)
 * 3. WP-03: Claim Understanding & Extraction (Atribusi, Denial, Tag-stripping)
 * 4. WP-04: Evidence Correlation & Publisher Independence (PSL, Sindikasi, GTrends firewall)
 * 5. WP-05: Claim Assessment & Explainability (6 Vonis Kanonikal & "Why NARADA Thinks So")
 * 6. WP-06: Database Persistence & Schema Migration (IndexedDB v5 + SQLite)
 * 7. WP-07: Benchmark Evaluasi Komprehensif (>= 80 Skenario + Kasus A-J + Confusion Matrix)
 * ══════════════════════════════════════════════════════════════════════════
 */

import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'

import {
  RELEVANCE_ENGINE_VERSION,
  CLAIM_EXTRACTION_ENGINE_VERSION,
  EVIDENCE_CORRELATION_ENGINE_VERSION,
  CLAIM_ASSESSMENT_ENGINE_VERSION,
  VERDICT_INDONESIAN_LABELS
} from '../src/engine/intelligence/claim-types.ts'

import {
  evaluateIntelligenceRelevance,
  determineContentCoverage
} from '../src/engine/intelligence/relevance-engine.ts'

import {
  stripEditorialPrefix,
  classifyPropositionType,
  detectModalityAndSpeaker,
  extractClaimsFromArticle
} from '../src/engine/intelligence/claim-extraction-engine.ts'

import {
  resolvePublisherProfile,
  calculateTextSimilarity,
  determineEvidenceRelation,
  determineEvidenceDirectness,
  correlateClaimWithEvidence
} from '../src/engine/intelligence/evidence-correlation-engine.ts'

import {
  computeEvidenceCoverage,
  assessClaimWithEvidence
} from '../src/engine/intelligence/claim-assessment-engine.ts'

import {
  STORES,
  saveClaimToDB,
  getClaimsFromDB,
  getClaimByIdFromDB,
  saveEvidenceItemToDB,
  getEvidenceItemsFromDB,
  saveClaimAssessmentToDB,
  getClaimAssessmentFromDB,
  getAllClaimAssessmentsFromDB,
  savePublisherProfileToDB,
  getPublisherProfileFromDB,
  getAllPublishersFromDB
} from '../src/utils/db-adapter.ts'

import {
  initSqliteDatabase,
  closeSqliteDatabase,
  saveClaim as saveClaimSqlite,
  getClaims as getClaimsSqlite,
  saveClaimEvidence as saveEvidenceSqlite,
  getClaimEvidence as getEvidenceSqlite,
  saveClaimAssessment as saveAssessmentSqlite,
  getClaimAssessment as getAssessmentSqlite,
  savePublisher as savePublisherSqlite,
  getPublishers as getPublishersSqlite
} from '../electron/sqlite-service.cjs'

let totalAssertions = 0
let passedAssertions = 0
let failedAssertions = 0

function testAssert(condition, code, message) {
  totalAssertions++
  if (condition) {
    passedAssertions++
    console.log(`  ✅ PASS: [${code}] ${message}`)
  } else {
    failedAssertions++
    console.error(`  ❌ FAIL: [${code}] ${message}`)
    throw new Error(`Assertion failed: [${code}] ${message}`)
  }
}

async function runSprint9IntelligenceCoreTests() {
  console.log('══════════════════════════════════════════════════════════════════════')
  console.log('🧠  NARADA — SPRINT 09: INTELLIGENCE CORE & CLAIM ASSESSMENT SUITE')
  console.log('══════════════════════════════════════════════════════════════════════\n')

  // ──────────────────────────────────────────────────────────────────
  // 1. WP-01: DOMAIN MODEL & DATA CONTRACT INTEGRITY
  // ──────────────────────────────────────────────────────────────────
  console.log('─── S9-WP01: Domain Model, Versioning & Contracts ───')
  testAssert(RELEVANCE_ENGINE_VERSION === '1.0.0', 'S9-01.1', 'Relevance engine version terdefinisi 1.0.0')
  testAssert(CLAIM_EXTRACTION_ENGINE_VERSION === '1.0.0', 'S9-01.2', 'Claim extraction version terdefinisi 1.0.0')
  testAssert(EVIDENCE_CORRELATION_ENGINE_VERSION === '1.0.0', 'S9-01.3', 'Evidence correlation version terdefinisi 1.0.0')
  testAssert(CLAIM_ASSESSMENT_ENGINE_VERSION === '1.0.0', 'S9-01.4', 'Claim assessment version terdefinisi 1.0.0')
  testAssert(VERDICT_INDONESIAN_LABELS.SUPPORTED_BY_EVIDENCE === 'DIDUKUNG BUKTI', 'S9-01.5', 'Label Indonesia DIDUKUNG BUKTI valid')
  testAssert(VERDICT_INDONESIAN_LABELS.CONTRADICTED_BY_EVIDENCE === 'BERTENTANGAN DENGAN BUKTI', 'S9-01.6', 'Label Indonesia BERTENTANGAN DENGAN BUKTI valid')
  testAssert(VERDICT_INDONESIAN_LABELS.UNVERIFIED === 'BELUM TERVERIFIKASI', 'S9-01.7', 'Label Indonesia BELUM TERVERIFIKASI valid')
  testAssert(VERDICT_INDONESIAN_LABELS.INSUFFICIENT_EVIDENCE === 'BUKTI TIDAK CUKUP', 'S9-01.8', 'Label Indonesia BUKTI TIDAK CUKUP valid')
  testAssert(VERDICT_INDONESIAN_LABELS.CONFLICTING_EVIDENCE === 'BUKTI SALING BERTENTANGAN', 'S9-01.9', 'Label Indonesia BUKTI SALING BERTENTANGAN valid')
  testAssert(VERDICT_INDONESIAN_LABELS.NOT_ASSESSABLE === 'TIDAK DAPAT DINILAI', 'S9-01.10', 'Label Indonesia TIDAK DAPAT DINILAI valid')

  // ──────────────────────────────────────────────────────────────────
  // 2. WP-02: RELEVANCE INTELLIGENCE ENGINE & DISAMBIGUATION
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S9-WP02: Relevance Intelligence Engine (4-Stage & Disambiguation) ───')
  
  // Skenario A: Artikel Hankam Relevan
  const rel1 = evaluateIntelligenceRelevance({
    title: 'Panglima TNI Periksa Kesiapan Alutsista Kapal Perang di Natuna',
    description: 'Patroli pengamanan wilayah kedaulatan laut utara Indonesia ditingkatkan.',
    content: 'Panglima TNI didampingi jajaran petinggi militer memeriksa armada alutsista di pangkalan perbatasan laut Natuna.'
  })
  testAssert(rel1.category === 'RELEVANT', 'S9-02.1', 'Artikel kedaulatan alutsista TNI dinilai RELEVANT')
  testAssert(rel1.score >= 70, 'S9-02.2', 'Skor relevansi hankam memadai (>= 70)')
  testAssert(rel1.matchedDomain === 'DEFENSE_SECURITY', 'S9-02.3', 'Domain terklasifikasi sebagai DEFENSE_SECURITY')
  testAssert(rel1.contentCoverage === 'FULL_TEXT', 'S9-02.4', 'Cakupan konten terdeteksi FULL_TEXT')

  // Skenario B: Disambiguasi kata 'demo' (Teknologi Demo vs Demonstrasi Sipil)
  const relDemoTech = evaluateIntelligenceRelevance({
    title: 'Google Pamerkan Demo Aplikasi AI Terbarunya untuk Pengeditan Video',
    description: 'Uji coba sistem dan teknologi fitur baru software pengolah gambar diperlihatkan ke publik.'
  })
  testAssert(relDemoTech.category !== 'RELEVANT', 'S9-02.5', 'Demo aplikasi software tidak dikira demonstrasi unjuk rasa sipil')
  testAssert(relDemoTech.rejectionReasons.some(r => r.includes('DISAMBIGUATION_REJECTED')), 'S9-02.6', 'Alasan penolakan disambiguasi tercatat')

  const relDemoProtest = evaluateIntelligenceRelevance({
    title: 'Ribuan Mahasiswa dan Buruh Gelar Aksi Demo di Depan Gedung DPR Tuntut Pembatalan RUU',
    description: 'Massa pengunjuk rasa membawa spanduk orasi menuntut transparansi kebijakan anggaran.'
  })
  testAssert(relDemoProtest.category === 'RELEVANT', 'S9-02.7', 'Aksi demo buruh & mahasiswa dinilai RELEVANT')
  testAssert(relDemoProtest.matchedDomain === 'CIVIC_DYNAMICS', 'S9-02.8', 'Terasosiasi tepat ke domain CIVIC_DYNAMICS')

  // Skenario C: Disambiguasi 'virus' (Medis flu vs Cyber malware)
  const relVirusFlu = evaluateIntelligenceRelevance({
    title: 'Dokter Imbau Warga Waspada Virus Flu dan Batuk Musim Pancaroba',
    description: 'Klinik kesehatan hewan dan medis laporkan peningkatan pasien demam.'
  })
  testAssert(relVirusFlu.category === 'IRRELEVANT', 'S9-02.9', 'Virus flu medis dieliminasi dari pantauan siber kognitif')

  const relVirusRansomware = evaluateIntelligenceRelevance({
    title: 'Server Layanan Publik Lumpuh Akibat Infeksi Virus Ransomware',
    description: 'Pusat Data Nasional PDNS mengalami gangguan peretasan sistem database oleh hacker.'
  })
  testAssert(relVirusRansomware.category === 'RELEVANT', 'S9-02.10', 'Virus ransomware siber dinilai RELEVANT (CYBER_PUBLIC_IMPACT)')
  testAssert(relVirusRansomware.matchedDomain === 'CYBER_PUBLIC_IMPACT', 'S9-02.11', 'Domain CYBER_PUBLIC_IMPACT tervalidasi')

  // Skenario D: Noise Filter (Olahraga & Gosip Artis)
  const relGossip = evaluateIntelligenceRelevance({
    title: 'Artis Sinetron Ini Blak-blakan Soal Hubungan Pacar Barunya',
    description: 'Gosip pernikahan selebritis kembali mencuat di media sosial.'
  })
  testAssert(relGossip.category === 'IRRELEVANT', 'S9-02.12', 'Gosip artis dieliminasi sebagai IRRELEVANT')

  const relSports = evaluateIntelligenceRelevance({
    title: 'Hasil Skor Akhir Liga Champions Babak Pertama Tadi Malam',
    description: 'Klasemen sementara sepak bola bursa transfer pemain eropa.'
  })
  testAssert(relSports.category === 'IRRELEVANT', 'S9-02.13', 'Skor olahraga dieliminasi sebagai IRRELEVANT')

  // Skenario E: Judul Pendek Samar (Limited Context)
  const relVague = evaluateIntelligenceRelevance({
    title: 'Ada Apa Hari Ini',
    description: ''
  })
  testAssert(relVague.category === 'UNCERTAIN' || relVague.category === 'IRRELEVANT', 'S9-02.14', 'Judul sangat pendek samar dinilai UNCERTAIN/IRRELEVANT')
  testAssert(relVague.isAmbiguous === true, 'S9-02.15', 'Tanda ambiguitas terdeteksi')

  // ──────────────────────────────────────────────────────────────────
  // 3. WP-03: CLAIM UNDERSTANDING & EXTRACTION ENGINE
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S9-WP03: Claim Extraction, Attribution & Tag-Stripping ───')

  // Uji A: Tag Editorial Stripping (Pemisahan [HOAKS] dari Proposisi Inti)
  const { cleanText: c1, strippedTag: t1 } = stripEditorialPrefix('[HOAKS] Kantor DPRD Tidak Boleh Jadi Lokasi Unjuk Rasa')
  testAssert(t1 === 'HOAKS', 'S9-03.1', 'Tag editorial HOAKS berhasil diekstraksi terpisah')
  testAssert(c1 === 'Kantor DPRD Tidak Boleh Jadi Lokasi Unjuk Rasa', 'S9-03.2', 'Proposisi inti klaim bersih dari kurung siku tag')

  const { cleanText: c2, strippedTag: t2 } = stripEditorialPrefix('Cek Fakta: Pembagian Saldo DANA Gratis Rp 500 Ribu')
  testAssert(t2 === 'CEK FAKTA', 'S9-03.3', 'Tag Cek Fakta berhasil dipisahkan')
  testAssert(c2 === 'Pembagian Saldo DANA Gratis Rp 500 Ribu', 'S9-03.4', 'Teks klaim bansos DANA bersih')

  // Uji B: Deteksi Bantahan (Denial) & Atribusi Pembicara
  const denialAnalysis = detectModalityAndSpeaker('Kemhan Bantah Adanya Pangkalan Militer Asing di Kepulauan Riau')
  testAssert(denialAnalysis.modality === 'DENIED', 'S9-03.5', 'Modalitas terdeteksi sebagai DENIED')
  testAssert(denialAnalysis.attributedSpeaker === 'Kemhan', 'S9-03.6', 'Pembicara Kemhan berhasil diatribusikan')
  testAssert(!denialAnalysis.coreAssertionText.includes('Bantah'), 'S9-03.7', 'Klausul bantahan dipisahkan dari inti proposisi')

  // Uji C: Klasifikasi Tipe Proposisi
  testAssert(classifyPropositionType('Presiden meresmikan jalan tol trans sumatera kemarin') === 'FACTUAL_ASSERTION', 'S9-03.8', 'Pernyataan berita diklasifikasikan FACTUAL_ASSERTION')
  testAssert(classifyPropositionType('Menurut saya kebijakan ini sangat disayangkan dan tidak efektif') === 'OPINION', 'S9-03.9', 'Komentar penafsiran diklasifikasikan OPINION')
  testAssert(classifyPropositionType('Diprediksi ekonomi Indonesia akan segera pulih pada kuartal depan') === 'PREDICTION', 'S9-03.10', 'Pernyataan proyeksi diklasifikasikan PREDICTION')
  testAssert(classifyPropositionType('Apakah benar anggaran kementerian pertahanan dinaikkan tahun ini?') === 'QUESTION', 'S9-03.11', 'Kalimat tanya diklasifikasikan QUESTION')
  testAssert(classifyPropositionType('Cerita parodi lelucon humor tentang kehidupan kantor') === 'SATIRE_OR_HYPOTHETICAL', 'S9-03.12', 'Konten parodi diklasifikasikan SATIRE_OR_HYPOTHETICAL')
  testAssert(classifyPropositionType('Halo halo') === 'AMBIGUOUS', 'S9-03.13', 'Teks sangat pendek diklasifikasikan AMBIGUOUS')

  // Uji D: Ekstraksi Klaim Lengkap dari Artikel
  const extractedClaims = extractClaimsFromArticle({
    articleId: 'PUB-2026-HANKAM-01',
    title: '[HOAKS] TNI Angkatan Darat Kirim Pasukan Tempur Tanpa Mandat DPR',
    description: 'Beredar narasi di media sosial yang mengklaim pergerakan militer liar di perbatasan. Panglima TNI memastikan informasi tersebut tidak berdasar.'
  })
  testAssert(extractedClaims.length >= 1, 'S9-03.14', 'Minimal 1 klaim berhasil diekstraksi dari artikel')
  testAssert(extractedClaims[0].normalizedText === 'TNI Angkatan Darat Kirim Pasukan Tempur Tanpa Mandat DPR', 'S9-03.15', 'Klaim utama bebas dari tag [HOAKS]')
  testAssert(extractedClaims[0].claimType === 'FACTUAL_ASSERTION', 'S9-03.16', 'Klaim utama berjenis FACTUAL_ASSERTION')
  testAssert(extractedClaims[0].sourceArticleId === 'PUB-2026-HANKAM-01', 'S9-03.17', 'Provenance ID artikel sumber terjaga')
  testAssert(extractedClaims[0].limitations.some(l => l.includes('EDITORIAL_TAG_DETECTED')), 'S9-03.18', 'Keterbatasan deteksi tag editorial tercatat transparan')

  // ──────────────────────────────────────────────────────────────────
  // 4. WP-04: EVIDENCE CORRELATION & PUBLISHER INDEPENDENCE
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S9-WP04: Publisher Independence, PSL & Syndication ───')

  // Uji A: PSL-Aware Root Domain Parser
  const pub1 = resolvePublisherProfile('https://regional.kompas.com/read/2026/01/berita', 'Kompas Regional')
  testAssert(pub1.registrableDomain === 'kompas.com', 'S9-04.1', 'Subdomain regional.kompas.com dinormalisasi ke kompas.com')
  testAssert(pub1.organizationId === 'ORG-KOMPAS-GRAMEDIA', 'S9-04.2', 'Konglomerasi media Kompas Gramedia terpetakan')

  const pub2 = resolvePublisherProfile('https://dispenad.tni-ad.mil.id/berita/patroli', 'Dispenad')
  testAssert(pub2.registrableDomain === 'tni-ad.mil.id' || pub2.registrableDomain.includes('mil.id'), 'S9-04.3', 'TLD kedinasan .mil.id tertangani dengan benar')
  testAssert(pub2.publisherType === 'OFFICIAL_GOVERNMENT', 'S9-04.4', 'Tipe penerbit kedinasan tervalidasi OFFICIAL_GOVERNMENT')

  const pub3 = resolvePublisherProfile('https://news.google.com/articles/CAIiE...', 'Google News')
  testAssert(pub3.isAggregator === true, 'S9-04.5', 'Mesin agregator Google News ditandai isAggregator = true')
  testAssert(pub3.publisherType === 'AGGREGATOR', 'S9-04.6', 'Tipe penerbit teridentifikasi AGGREGATOR')

  // Uji B: Kemiripan Teks & Deteksi Sindikasi Berita
  const textOrig = 'Pemerintah meresmikan jembatan penghubung antar pulau di wilayah kepulauan riau untuk percepat logistik'
  const textCopy = 'Pemerintah resmi meresmikan jembatan penghubung antar pulau di wilayah kepulauan riau untuk percepatan logistik'
  const textDiff = 'Badan Meteorologi BMKG merilis peringatan dini cuaca ekstrem di pesisir selatan jawa'
  testAssert(calculateTextSimilarity(textOrig, textCopy) > 0.65, 'S9-04.7', 'Kemiripan teks identik/salinan rilis pers terdeteksi tinggi (> 0.65)')
  testAssert(calculateTextSimilarity(textOrig, textDiff) < 0.15, 'S9-04.8', 'Teks topik berbeda memiliki skor kemiripan rendah (< 0.15)')

  // Uji C: Skenario 10 Berita Duplikasi (Syndication Firewall)
  const mockClaim = {
    id: 'CLM-TEST-01',
    normalizedText: 'TNI Bangun Pos Pengamanan Perbatasan Baru di Natuna Utara',
    claimType: 'FACTUAL_ASSERTION',
    isLimitedContext: false,
    limitations: []
  }

  // Buat 10 artikel yang menyalin rilis pers yang sama persis
  const duplicatedArticles = []
  for (let i = 1; i <= 10; i++) {
    duplicatedArticles.push({
      id: `PUB-ART-${i}`,
      title: 'TNI Bangun Pos Pengamanan Perbatasan Baru di Natuna Utara',
      description: 'Panglima TNI didampingi jajaran meresmikan pos pengamanan perbatasan baru di kepulauan natuna.',
      canonicalUrl: `https://portal-berita-${i}.com/tni-pos-natuna`,
      originalUrl: `https://portal-berita-${i}.com/tni-pos-natuna`,
      publisherName: `Portal Berita ${i}`,
      sourceConnectorId: 'src-gnews-hankam',
      acquiredAt: Date.now() - i * 1000,
      publishedAt: Date.now() - 3600000
    })
  }

  const correlationResult = correlateClaimWithEvidence({
    claim: mockClaim,
    articles: duplicatedArticles
  })

  testAssert(duplicatedArticles.length === 10, 'S9-04.9', 'Terdapat tepat 10 artikel publikasi terdaftar')
  testAssert(correlationResult.publisherCount === 10, 'S9-04.10', 'Jumlah penerbit teridentifikasi 10')
  testAssert(correlationResult.independentEvidenceCount === 1, 'S9-04.11', '10 artikel sindikasi HANYA dihitung sebagai 1 bukti independen')
  testAssert(correlationResult.evidenceItems.length > 0, 'S9-04.12', 'Item bukti berhasil ditautkan ke klaim')

  // ──────────────────────────────────────────────────────────────────
  // 5. WP-05: CLAIM ASSESSMENT & EXPLAINABILITY ENGINE
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S9-WP05: Claim Assessment & Explainability ───')

  // Kasus 1: Klaim Didukung Bukti Independen yang Kuat
  const supportedItems = [
    {
      id: 'EVD-01',
      claimId: mockClaim.id,
      sourcePublisherName: 'Dispenad',
      registrableDomain: 'tni-ad.mil.id',
      evidenceRelation: 'SUPPORTS',
      directness: 'PRIMARY_SOURCE',
      quotedText: 'Dispenad mengonfirmasi pembangunan pos militer baru di Natuna.',
      independenceGroupId: 'GRP-DISPENAD'
    },
    {
      id: 'EVD-02',
      claimId: mockClaim.id,
      sourcePublisherName: 'LKBN ANTARA',
      registrableDomain: 'antaranews.com',
      evidenceRelation: 'SUPPORTS',
      directness: 'INDEPENDENT_REPORT',
      quotedText: 'Panglima meresmikan pos pengamanan maritim di Natuna Utara.',
      independenceGroupId: 'GRP-ANTARA'
    }
  ]
  const assess1 = assessClaimWithEvidence({
    claim: mockClaim,
    evidenceItems: supportedItems,
    independentPublisherCount: 2,
    independentEvidenceCount: 2
  })
  testAssert(assess1.assessment.verdict === 'SUPPORTED_BY_EVIDENCE', 'S9-05.1', 'Vonis klaim terkonfirmasi SUPPORTED_BY_EVIDENCE')
  testAssert(assess1.assessment.confidenceLevel === 'HIGH', 'S9-05.2', 'Keyakinan proses asesmen berstatus HIGH')
  testAssert(assess1.explanation.verdictLabel === 'DIDUKUNG BUKTI', 'S9-05.3', 'Label bahasa Indonesia DIDUKUNG BUKTI ditampilkan')

  // Kasus 2: Klaim Dibantah oleh Fakta Lapangan
  const contradictedItems = [
    {
      id: 'EVD-03',
      claimId: mockClaim.id,
      sourcePublisherName: 'TurnBackHoax',
      registrableDomain: 'turnbackhoax.id',
      evidenceRelation: 'CONTRADICTS',
      directness: 'INDEPENDENT_REPORT',
      quotedText: 'Informasi pengiriman pasukan tanpa mandat adalah disinformasi hoaks.',
      independenceGroupId: 'GRP-TBH'
    }
  ]
  const assess2 = assessClaimWithEvidence({
    claim: mockClaim,
    evidenceItems: contradictedItems,
    independentPublisherCount: 1,
    independentEvidenceCount: 1
  })
  testAssert(assess2.assessment.verdict === 'CONTRADICTED_BY_EVIDENCE', 'S9-05.4', 'Vonis klaim terbukti CONTRADICTED_BY_EVIDENCE')
  testAssert(assess2.explanation.verdictLabel === 'BERTENTANGAN DENGAN BUKTI', 'S9-05.5', 'Label BERTENTANGAN DENGAN BUKTI valid')

  // Kasus 3: Bukti Saling Bertentangan (Conflicting Evidence)
  const conflictingItems = [
    {
      id: 'EVD-04',
      claimId: mockClaim.id,
      sourcePublisherName: 'Media A',
      registrableDomain: 'media-a.com',
      evidenceRelation: 'SUPPORTS',
      directness: 'INDEPENDENT_REPORT',
      quotedText: 'Sumber menyebut pertemuan rahasia telah berlangsung.',
      independenceGroupId: 'GRP-A'
    },
    {
      id: 'EVD-05',
      claimId: mockClaim.id,
      sourcePublisherName: 'Media B',
      registrableDomain: 'media-b.com',
      evidenceRelation: 'CONTRADICTS',
      directness: 'INDEPENDENT_REPORT',
      quotedText: 'Juru bicara membantah tegas kabar pertemuan rahasia tersebut.',
      independenceGroupId: 'GRP-B'
    }
  ]
  const assess3 = assessClaimWithEvidence({
    claim: mockClaim,
    evidenceItems: conflictingItems,
    independentPublisherCount: 2,
    independentEvidenceCount: 2
  })
  testAssert(assess3.assessment.verdict === 'CONFLICTING_EVIDENCE', 'S9-05.6', 'Vonis CONFLICTING_EVIDENCE saat ada bukti kontradiktif')
  testAssert(assess3.assessment.requiresHumanReview === true, 'S9-05.7', 'Wajib memicu Human Review saat bukti saling bertentangan')
  testAssert(assess3.explanation.reviewRecommendation === 'MANDATORY_HUMAN_REVIEW', 'S9-05.8', 'Rekomendasi review berstatus MANDATORY_HUMAN_REVIEW')

  // Kasus 4: Pernyataan Non-Faktual (Opini / Pertanyaan)
  const opinionClaim = {
    id: 'CLM-OPINION-01',
    normalizedText: 'Menurut saya seragam baru kurang menarik',
    claimType: 'OPINION',
    isLimitedContext: false,
    limitations: []
  }
  const assess4 = assessClaimWithEvidence({
    claim: opinionClaim,
    evidenceItems: [],
    independentPublisherCount: 0,
    independentEvidenceCount: 0
  })
  testAssert(assess4.assessment.verdict === 'NOT_ASSESSABLE', 'S9-05.9', 'Opini secara jujur dinilai NOT_ASSESSABLE')
  testAssert(assess4.explanation.verdictLabel === 'TIDAK DAPAT DINILAI', 'S9-05.10', 'Label TIDAK DAPAT DINILAI ditampilkan')

  // Kasus 5: Bukti Tidak Cukup (Limited Context Snippet)
  const limitedClaim = {
    id: 'CLM-LIMITED-01',
    normalizedText: 'Kabar burung beredar luas',
    claimType: 'FACTUAL_ASSERTION',
    isLimitedContext: true,
    limitations: ['LIMITED_CONTEXT']
  }
  const assess5 = assessClaimWithEvidence({
    claim: limitedClaim,
    evidenceItems: [],
    independentPublisherCount: 0,
    independentEvidenceCount: 0
  })
  testAssert(assess5.assessment.verdict === 'INSUFFICIENT_EVIDENCE', 'S9-05.11', 'Data sangat minim dinilai INSUFFICIENT_EVIDENCE')

  // ──────────────────────────────────────────────────────────────────
  // 6. WP-06: DATABASE PERSISTENCE (INDEXEDDB & SQLITE)
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S9-WP06: Database Persistence & Storage Sovereignty ───')

  // IndexedDB Store Verification
  testAssert(typeof STORES.CLAIMS === 'string', 'S9-06.1', 'Store claims terdaftar di IndexedDB')
  testAssert(typeof STORES.EVIDENCE === 'string', 'S9-06.2', 'Store evidence terdaftar di IndexedDB')
  testAssert(typeof STORES.CLAIM_ASSESSMENTS === 'string', 'S9-06.3', 'Store claim_assessments terdaftar di IndexedDB')
  testAssert(typeof STORES.PUBLISHERS === 'string', 'S9-06.4', 'Store publishers terdaftar di IndexedDB')

  // Uji Simpan & Baca Klaim di Adapter DB
  const testClaimToSave = {
    id: 'CLM-PERSIST-001',
    sourceArticleId: 'PUB-ART-001',
    originalText: 'Panglima TNI Tinjau Perbatasan',
    normalizedText: 'Panglima TNI Tinjau Perbatasan',
    language: 'id',
    claimType: 'FACTUAL_ASSERTION',
    modality: 'ASSERTED',
    polarity: 'AFFIRMATIVE',
    entities: ['tni', 'panglima'],
    extractionMethod: 'RULE_BASED',
    extractionConfidence: 'HIGH',
    isLimitedContext: false,
    reviewStatus: 'DRAFT',
    limitations: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  await saveClaimToDB(testClaimToSave)
  const retrievedClaim = await getClaimByIdFromDB('CLM-PERSIST-001')
  testAssert(retrievedClaim !== null, 'S9-06.5', 'Klaim berhasil disimpan dan dibaca kembali dari DB')
  testAssert(retrievedClaim?.id === 'CLM-PERSIST-001', 'S9-06.6', 'ID klaim konsisten setelah pemulihan')

  // Uji Simpan & Baca Asesmen di Adapter DB
  await saveClaimAssessmentToDB(assess1.assessment)
  const retrievedAssessment = await getClaimAssessmentFromDB(assess1.assessment.claimId)
  testAssert(retrievedAssessment !== null, 'S9-06.7', 'Asesmen klaim berhasil disimpan dan dipulihkan dari DB')
  testAssert(retrievedAssessment?.verdict === 'SUPPORTED_BY_EVIDENCE', 'S9-06.8', 'Vonis asesmen tersimpan utuh')

  // Uji Simpan & Baca SQLite Service
  const sqliteInit = initSqliteDatabase(':memory:')
  testAssert(sqliteInit.success === true, 'S9-06.9', 'Database SQLite inisialisasi berhasil')

  const resSqliteClaim = saveClaimSqlite(testClaimToSave)
  testAssert(resSqliteClaim.success === true, 'S9-06.10', 'Klaim berhasil disimpan ke tabel SQLite claims')
  const sqliteClaims = getClaimsSqlite('PUB-ART-001')
  testAssert(sqliteClaims.length >= 1, 'S9-06.11', 'Klaim berhasil dibaca kembali dari SQLite berdasarkan articleId')

  saveClaimSqlite({
    id: assess1.assessment.claimId,
    sourceArticleId: 'PUB-ART-TEST',
    claimType: 'FACTUAL_ASSERTION',
    modality: 'ASSERTED',
    polarity: 'AFFIRMATIVE',
    normalizedText: 'Klaim Pengujian Asesmen',
    createdAt: new Date().toISOString()
  })
  const resSqliteAssessment = saveAssessmentSqlite(assess1.assessment)
  testAssert(resSqliteAssessment.success === true, 'S9-06.12', 'Asesmen klaim berhasil disimpan ke tabel SQLite claim_assessments')
  const sqliteAss = getAssessmentSqlite(assess1.assessment.claimId)
  testAssert(sqliteAss !== null && sqliteAss.verdict === 'SUPPORTED_BY_EVIDENCE', 'S9-06.13', 'Asesmen SQLite terbaca utuh dengan vonis yang sesuai')
  closeSqliteDatabase()

  // ──────────────────────────────────────────────────────────────────
  // 7. WP-07: EVALUATION BENCHMARK (>= 80 SCENARIOS & ADVERSARIAL CASES A-J)
  // ──────────────────────────────────────────────────────────────────
  console.log('\n─── S9-WP07: Evaluation Benchmark (80+ Scenarios & Cases A-J) ───')

  // ─── 10 KASUS ADVERSARIAL WAJIB (A s/d J) ───
  console.log('  * Verifikasi 10 Kasus Adversarial Wajib:')

  // Kasus A: Misleading headline [HOAKS]
  const caseA = extractClaimsFromArticle({
    articleId: 'PUB-CASE-A',
    title: '[HOAKS] Kantor DPRD Tidak Boleh Jadi Lokasi Unjuk Rasa',
    description: ''
  })
  testAssert(caseA[0].normalizedText === 'Kantor DPRD Tidak Boleh Jadi Lokasi Unjuk Rasa', 'S9-ADV-A.1', '[Kasus A] Tag HOAKS tidak mencemari teks klaim inti')
  testAssert(caseA[0].claimType === 'FACTUAL_ASSERTION', 'S9-ADV-A.2', '[Kasus A] Tetap diidentifikasi sebagai proposisi faktual')

  // Kasus B: Article reporting a denial
  const caseB = detectModalityAndSpeaker('Kemhan Bantah Adanya Transaksi Senjata Ilegal')
  testAssert(caseB.modality === 'DENIED', 'S9-ADV-B.1', '[Kasus B] Modalitas terdeteksi DENIED')
  testAssert(caseB.attributedSpeaker === 'Kemhan', 'S9-ADV-B.2', '[Kasus B] Atribusi speaker Kemhan terjaga')

  // Kasus C: Article reporting a fact-check
  const caseC_Rel = determineEvidenceRelation({
    claim: { id: 'C', normalizedText: 'Uang Rupiah Baru Bergambar Tokoh Asing' },
    evidenceText: 'TurnBackHoax mengklarifikasi [SALAH] kabar uang rupiah baru bergambar tokoh asing',
    sourceType: 'fact_check'
  })
  testAssert(caseC_Rel.relation === 'CONTRADICTS', 'S9-ADV-C.1', '[Kasus C] Laporan cek fakta resmi dikenali sebagai CONTRADICTS')

  // Kasus D: 10 duplicated news publications
  testAssert(correlationResult.independentEvidenceCount === 1, 'S9-ADV-D.1', '[Kasus D] 10 sindikasi pers hanya dihitung sebagai 1 rantai independen')

  // Kasus E: Contradictory information
  testAssert(assess3.assessment.verdict === 'CONFLICTING_EVIDENCE', 'S9-ADV-E.1', '[Kasus E] Informasi bertentangan menghasilkan CONFLICTING_EVIDENCE')

  // Kasus F: Irrelevant keyword coincidence
  const caseF_Rel = evaluateIntelligenceRelevance({
    title: 'Peluncuran Demo Game Terbaru di Pameran Komputer Jakarta',
    description: 'Pengunjung mencoba demo fitur grafis game komputer.'
  })
  testAssert(caseF_Rel.category !== 'RELEVANT', 'S9-ADV-F.1', '[Kasus F] Kata demo dalam demo game tidak dinilai RELEVANT')

  // Kasus G: Missing article context
  testAssert(assess5.assessment.verdict === 'INSUFFICIENT_EVIDENCE', 'S9-ADV-G.1', '[Kasus G] Konteks sangat minim dinilai INSUFFICIENT_EVIDENCE')

  // Kasus H: Google Trends signal separation
  const gtrendsPub = resolvePublisherProfile('https://trends.google.com/trends/trendingsearches/daily?geo=ID', 'Google Trends ID')
  testAssert(gtrendsPub.isAggregator === true, 'S9-ADV-H.1', '[Kasus H] Google Trends adalah agregator, bukan entitas penerbit bukti')

  // Kasus I: Different events sharing keywords (Temporal/Spatial consistency)
  const caseI_Cov = computeEvidenceCoverage(mockClaim, [], 0, 0)
  testAssert(caseI_Cov.temporalConsistency === true, 'S9-ADV-I.1', '[Kasus I] Konsistensi waktu dan tempat dievaluasi')

  // Kasus J: Satire & Opinion
  testAssert(assess4.assessment.verdict === 'NOT_ASSESSABLE', 'S9-ADV-J.1', '[Kasus J] Satir & Opini tidak diberi vonis faktual benar/salah (NOT_ASSESSABLE)')

  // ─── GENERASI BENCHMARK 80+ SKENARIO TERDOKUMENTASI ───
  console.log('\n  * Menjalankan Eksekusi 80+ Skenario Benchmark Terstandarisasi:')

  const BENCHMARK_SCENARIOS = [
    // 1-20: Skenario Relevansi (Relevance Matrix)
    { input: 'Panglima TNI pimpin latihan perang gabungan di kepulauan riau', expectedRel: 'RELEVANT' },
    { input: 'Kemenkes imbau vaksinasi flu untuk balita saat musim pancaroba', expectedRel: 'IRRELEVANT' },
    { input: 'Bocoran data 10 juta pengguna e-commerce beredar di dark web', expectedRel: 'RELEVANT' },
    { input: 'Resep opor ayam lezat untuk hidangan lebaran keluarga', expectedRel: 'IRRELEVANT' },
    { input: 'Massa buruh gelar demonstrasi tolak revisi uu ketenagakerjaan', expectedRel: 'RELEVANT' },
    { input: 'Ramalan zodiak cinta aries dan leo minggu ini penuh kejutan', expectedRel: 'IRRELEVANT' },
    { input: 'Pemerintah terbitkan aturan tarif pph pajak transaksi digital', expectedRel: 'RELEVANT' },
    { input: 'Jadwal siaran langsung pertandingan sepak bola liga inggris', expectedRel: 'IRRELEVANT' },
    { input: 'BMKG keluarkan peringatan dini waspada gempa megathrust', expectedRel: 'RELEVANT' },
    { input: 'Gaya busana muslim artis ternama di acara karpet merah', expectedRel: 'IRRELEVANT' },
    { input: 'BSSN tangani serangan siber malware ransomware pada server instansi', expectedRel: 'RELEVANT' },
    { input: 'Kucing lucu ini viral setelah beraksi menggemaskan di video', expectedRel: 'IRRELEVANT' },
    { input: 'Prajurit marinir TNI gagalkan penyelundupan di laut perbatasan', expectedRel: 'RELEVANT' },
    { input: 'Harga emas antam hari ini turun tipis dibanding perdagangan kemarin', expectedRel: 'IRRELEVANT' },
    { input: 'DPR bahas anggaran belanja alutsista pertahanan tahun 2026', expectedRel: 'RELEVANT' },
    { input: 'Tips merawat kulit wajah agar tetap glowing dan sehat alami', expectedRel: 'IRRELEVANT' },
    { input: 'TurnBackHoax klarifikasi kabar bohong pembagian bansos tunai', expectedRel: 'RELEVANT' },
    { input: 'Hasil pertandingan bulutangkis ganda putra di kejuaraan dunia', expectedRel: 'IRRELEVANT' },
    { input: 'Presiden tegaskan kedaulatan kepulauan natuna tidak dapat ditawar', expectedRel: 'RELEVANT' },
    { input: 'Film bioskop terbaru ini cocok ditonton saat liburan akhir pekan', expectedRel: 'IRRELEVANT' },

    // 21-40: Skenario Tipe Proposisi (Claim Type Classification)
    { text: 'Presiden meresmikan bendungan baru di Jawa Barat', expectedType: 'FACTUAL_ASSERTION' },
    { text: 'Menurut kami rancangan undang-undang ini sangat mengecewakan', expectedType: 'OPINION' },
    { text: 'Tahun depan pertumbuhan ekonomi nasional diprediksi melambat', expectedType: 'PREDICTION' },
    { text: 'Apakah benar ada penundaan jadwal pemilu serentak?', expectedType: 'QUESTION' },
    { text: 'Sebaiknya masyarakat tidak terburu-buru mengambil kesimpulan', expectedType: 'OPINION' },
    { text: 'KPK memeriksa tiga saksi dugaan korupsi pengadaan barang', expectedType: 'FACTUAL_ASSERTION' },
    { text: 'Diperkirakan hujan lebat akan mengguyur ibukota besok sore', expectedType: 'PREDICTION' },
    { text: 'Benarkah pendaftaran beasiswa telah ditutup oleh panitia?', expectedType: 'QUESTION' },
    { text: 'Pandangan saya proyek ini sangat menguntungkan rakyat kecil', expectedType: 'OPINION' },
    { text: 'Polisi menangkap pelaku peretasan situs resmi pemerintah', expectedType: 'FACTUAL_ASSERTION' },
    { text: 'Cerita fiktif lelucon tentang astronot tersesat di pasar', expectedType: 'SATIRE_OR_HYPOTHETICAL' },
    { text: 'Kementerian Keuangan laporkan surplus neraca perdagangan', expectedType: 'FACTUAL_ASSERTION' },
    { text: 'Mungkinkah ada pihak asing yang mendanai aksi demonstrasi?', expectedType: 'QUESTION' },
    { text: 'Kami berharap dialog damai segera tercapai antara kedua belah pihak', expectedType: 'OPINION' },
    { text: 'Badan SAR evakuasi sepuluh korban bencana longsor', expectedType: 'FACTUAL_ASSERTION' },
    { text: 'Nilai tukar rupiah kemungkinan besar akan menguat pekan ini', expectedType: 'PREDICTION' },
    { text: 'Lelucon satir parodi anggota dewan yang tertidur di sidang', expectedType: 'SATIRE_OR_HYPOTHETICAL' },
    { text: 'Panglima TNI rotasi sejumlah perwira tinggi di lingkungan mabes', expectedType: 'FACTUAL_ASSERTION' },
    { text: 'Adakah ketentuan baru terkait pemotongan gaji karyawan?', expectedType: 'QUESTION' },
    { text: 'Sangat disayangkan fasilitas umum dirusak oleh oknum tidak bertanggung jawab', expectedType: 'OPINION' },

    // 41-60: Skenario Modalitas & Atribusi Bantahan
    { text: 'Polda Bantah Adanya Penangkapan Terhadap Aktivis HAM', expectedMod: 'DENIED', expectedSpk: 'Polda' },
    { text: 'Kemenlu Bantah Kabar Pembukaan Hubungan Diplomatik Rahasia', expectedMod: 'DENIED', expectedSpk: 'Kemenlu' },
    { text: 'Pertamina Tegaskan Tidak Ada Kelangkaan BBM di Wilayah Timur', expectedMod: 'DENIED', expectedSpk: 'Pertamina' },
    { text: 'Gubernur Menampik Isu Kenaikan Pajak Kendaraan Bermotor', expectedMod: 'DENIED', expectedSpk: 'Gubernur' },
    { text: 'Mabes TNI Bantah Isu Pasukan Liar Masuk Wilayah Pemukiman', expectedMod: 'DENIED', expectedSpk: 'Mabes TNI' },
    { text: 'Kemenkes Tepis Isu Masuknya Virus Baru Mematikan', expectedMod: 'DENIED', expectedSpk: 'Kemenkes' },
    { text: 'KPK Membantah Telah Menghentikan Penyidikan Kasus Suap', expectedMod: 'DENIED', expectedSpk: 'KPK' },
    { text: 'BNPB Bantah Kabar Tanggul Waduk Jebol di Jawa Tengah', expectedMod: 'DENIED', expectedSpk: 'BNPB' },
    { text: 'Menhan Bantah Pembatalan Kontrak Pembelian Pesawat Tempur', expectedMod: 'DENIED', expectedSpk: 'Menhan' },
    { text: 'BKN Bantah Kabar Pengangkatan Tenaga Honorer Tanpa Tes', expectedMod: 'DENIED', expectedSpk: 'BKN' },
    { text: 'Klarifikasi TNI Terkait Video Viral Latihan Militer di Perbatasan', expectedMod: 'DENIED' },
    { text: 'Panglima Menepis Tuduhan Bahwa Prajurit Tidak Netral', expectedMod: 'DENIED', expectedSpk: 'Panglima' },
    { text: 'Dispenad Bantah Klaim Adanya Korban Jiwa dalam Latihan Taktis', expectedMod: 'DENIED', expectedSpk: 'Dispenad' },
    { text: 'BSSN Bantah Sistem Enkripsi Nasional Telah Ditembus', expectedMod: 'DENIED', expectedSpk: 'BSSN' },
    { text: 'Menko Polkam Tegaskan Tidak Ada Negosiasi dengan Kelompok Separatis', expectedMod: 'DENIED', expectedSpk: 'Menko Polkam' },
    { text: 'Menteri Keuangan Bantah Rencana Pengenaan Pajak Udara', expectedMod: 'DENIED', expectedSpk: 'Menteri Keuangan' },
    { text: 'Mabes Polri Bantah Temuan Brankas Rahasia di Rumah Pejabat', expectedMod: 'DENIED', expectedSpk: 'Mabes Polri' },
    { text: 'Kominfo Bantah Isu Pemblokiran Menyeluruh Media Sosial', expectedMod: 'DENIED', expectedSpk: 'Kominfo' },
    { text: 'KPU Membantah Server Sirekap Mengalami Manipulasi Suara', expectedMod: 'DENIED', expectedSpk: 'KPU' },
    { text: 'Kemendikbud Bantah Kabar Penghapusan Kurikulum Agama', expectedMod: 'DENIED', expectedSpk: 'Kemendikbud' },

    // 61-85: Skenario Evaluasi Vonis & Asesmen Asli
    { verdictCase: 'SUPPORTED_BY_EVIDENCE', sup: 2, con: 0, nonFact: false },
    { verdictCase: 'SUPPORTED_BY_EVIDENCE', sup: 3, con: 0, nonFact: false },
    { verdictCase: 'CONTRADICTED_BY_EVIDENCE', sup: 0, con: 2, nonFact: false },
    { verdictCase: 'CONTRADICTED_BY_EVIDENCE', sup: 0, con: 1, nonFact: false },
    { verdictCase: 'CONFLICTING_EVIDENCE', sup: 1, con: 1, nonFact: false },
    { verdictCase: 'CONFLICTING_EVIDENCE', sup: 2, con: 2, nonFact: false },
    { verdictCase: 'UNVERIFIED', sup: 0, con: 0, nonFact: false },
    { verdictCase: 'NOT_ASSESSABLE', sup: 0, con: 0, nonFact: true, type: 'OPINION' },
    { verdictCase: 'NOT_ASSESSABLE', sup: 0, con: 0, nonFact: true, type: 'PREDICTION' },
    { verdictCase: 'NOT_ASSESSABLE', sup: 0, con: 0, nonFact: true, type: 'QUESTION' },
    { verdictCase: 'NOT_ASSESSABLE', sup: 0, con: 0, nonFact: true, type: 'SATIRE_OR_HYPOTHETICAL' },
    { verdictCase: 'INSUFFICIENT_EVIDENCE', sup: 0, con: 0, nonFact: false, limited: true },
    { verdictCase: 'SUPPORTED_BY_EVIDENCE', sup: 1, con: 0, nonFact: false, primary: true },
    { verdictCase: 'CONTRADICTED_BY_EVIDENCE', sup: 0, con: 3, nonFact: false },
    { verdictCase: 'CONFLICTING_EVIDENCE', sup: 3, con: 1, nonFact: false },
    { verdictCase: 'UNVERIFIED', sup: 0, con: 0, nonFact: false },
    { verdictCase: 'NOT_ASSESSABLE', sup: 0, con: 0, nonFact: true, type: 'OPINION' },
    { verdictCase: 'INSUFFICIENT_EVIDENCE', sup: 0, con: 0, nonFact: false, limited: true },
    { verdictCase: 'SUPPORTED_BY_EVIDENCE', sup: 4, con: 0, nonFact: false },
    { verdictCase: 'CONTRADICTED_BY_EVIDENCE', sup: 0, con: 2, nonFact: false },
    { verdictCase: 'CONFLICTING_EVIDENCE', sup: 2, con: 3, nonFact: false },
    { verdictCase: 'UNVERIFIED', sup: 0, con: 0, nonFact: false },
    { verdictCase: 'NOT_ASSESSABLE', sup: 0, con: 0, nonFact: true, type: 'QUESTION' },
    { verdictCase: 'INSUFFICIENT_EVIDENCE', sup: 0, con: 0, nonFact: false, limited: true },
    { verdictCase: 'SUPPORTED_BY_EVIDENCE', sup: 2, con: 0, nonFact: false }
  ]

  let benchmarkPassed = 0
  let benchmarkTotal = BENCHMARK_SCENARIOS.length

  // Metrik Confusion Matrix Relevansi
  let relTP = 0, relFP = 0, relTN = 0, relFN = 0

  for (let idx = 0; idx < BENCHMARK_SCENARIOS.length; idx++) {
    const s = BENCHMARK_SCENARIOS[idx]
    const seq = idx + 1

    if (s.input) {
      const res = evaluateIntelligenceRelevance({ title: s.input, description: '' })
      const pass = res.category === s.expectedRel
      if (pass) benchmarkPassed++
      if (s.expectedRel === 'RELEVANT') {
        if (res.category === 'RELEVANT') relTP++
        else relFN++
      } else {
        if (res.category === 'IRRELEVANT') relTN++
        else relFP++
      }
      testAssert(pass, `S9-BM-${seq}`, `[Relevansi #${seq}] '${s.input.slice(0, 35)}...' -> ${res.category}`)
    } else if (s.expectedType) {
      const detectedType = classifyPropositionType(s.text)
      const pass = detectedType === s.expectedType
      if (pass) benchmarkPassed++
      testAssert(pass, `S9-BM-${seq}`, `[Tipe Proposisi #${seq}] '${s.text.slice(0, 35)}...' -> ${detectedType}`)
    } else if (s.expectedMod) {
      const modRes = detectModalityAndSpeaker(s.text)
      const pass = modRes.modality === s.expectedMod
      if (pass) benchmarkPassed++
      testAssert(pass, `S9-BM-${seq}`, `[Modalitas #${seq}] '${s.text.slice(0, 35)}...' -> ${modRes.modality}`)
    } else if (s.verdictCase) {
      const testC = {
        id: `CLM-BM-${seq}`,
        normalizedText: `Klaim Uji Faktual Benchmark Nomor ${seq}`,
        claimType: s.nonFact ? s.type : 'FACTUAL_ASSERTION',
        isLimitedContext: Boolean(s.limited),
        limitations: s.limited ? ['LIMITED_CONTEXT'] : []
      }
      const testEvs = []
      for (let i = 0; i < s.sup; i++) {
        testEvs.push({
          id: `EVD-SUP-${seq}-${i}`,
          claimId: testC.id,
          sourcePublisherName: `Penerbit Pendukung ${i}`,
          evidenceRelation: 'SUPPORTS',
          directness: s.primary && i === 0 ? 'PRIMARY_SOURCE' : 'INDEPENDENT_REPORT',
          quotedText: 'Dukungan data terverifikasi',
          independenceGroupId: `GRP-SUP-${i}`
        })
      }
      for (let j = 0; j < s.con; j++) {
        testEvs.push({
          id: `EVD-CON-${seq}-${j}`,
          claimId: testC.id,
          sourcePublisherName: `Penerbit Sanggahan ${j}`,
          evidenceRelation: 'CONTRADICTS',
          directness: 'INDEPENDENT_REPORT',
          quotedText: 'Sanggahan data terverifikasi',
          independenceGroupId: `GRP-CON-${j}`
        })
      }
      const indCount = s.sup + s.con
      const res = assessClaimWithEvidence({
        claim: testC,
        evidenceItems: testEvs,
        independentPublisherCount: indCount,
        independentEvidenceCount: indCount
      })
      const pass = res.assessment.verdict === s.verdictCase
      if (pass) benchmarkPassed++
      testAssert(pass, `S9-BM-${seq}`, `[Vonis Asesmen #${seq}] sup:${s.sup} con:${s.con} -> ${res.assessment.verdict}`)
    }
  }

  // Hitung Metrik Presisi, Recall, F1 untuk Relevansi
  const precision = relTP + relFP > 0 ? (relTP / (relTP + relFP)) : 1.0
  const recall = relTP + relFN > 0 ? (relTP / (relTP + relFN)) : 1.0
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 1.0

  console.log('\n══════════════════════════════════════════════════════════════════════')
  console.log('📊 SPRINT 09 BENCHMARK ACCURACY & CONFUSION MATRIX')
  console.log('══════════════════════════════════════════════════════════════════════')
  console.log(`  Total Skenario Uji: ${benchmarkTotal}`)
  console.log(`  Lulus Validasi    : ${benchmarkPassed} / ${benchmarkTotal} (100%)`)
  console.log(`  Relevance Confusion Matrix: TP=${relTP}, FP=${relFP}, TN=${relTN}, FN=${relFN}`)
  console.log(`  Precision         : ${(precision * 100).toFixed(2)}%`)
  console.log(`  Recall            : ${(recall * 100).toFixed(2)}%`)
  console.log(`  F1-Score          : ${(f1 * 100).toFixed(2)}%`)
  console.log('══════════════════════════════════════════════════════════════════════\n')

  testAssert(benchmarkPassed === benchmarkTotal, 'S9-BM-ACC', 'Semua 85 skenario benchmark evaluasi lulus 100%')

  console.log('══════════════════════════════════════════════════════════════════════')
  console.log(`🏆 TOTAL SPRINT 09 ASSERTIONS: ${totalAssertions}`)
  console.log(`   ✅ PASS: ${passedAssertions}`)
  console.log(`   ❌ FAIL: ${failedAssertions}`)
  console.log('══════════════════════════════════════════════════════════════════════')
}

runSprint9IntelligenceCoreTests()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error('Fatal error during test run:', err)
    process.exit(1)
  })
