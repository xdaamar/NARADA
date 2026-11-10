/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — MULTIDIMENSIONAL RADAR ASSESSMENT ENGINE
 * SPRINT 1: EVIDENCE-DRIVEN ASSESSMENT WITHOUT ARBITRARY THREAT SCORING
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Menggantikan formula lama yang tidak terbukti (0.4E + 0.35S + 0.25T)
 * dengan 4 pilar penilaian yang transparan dan dapat diaudit:
 * 1. Freshness: Status ketepatan waktu penerbitan dari sumber.
 * 2. Context Relevance: Kesesuaian topik pantauan (BUKAN tingkat bahaya).
 * 3. Metadata Transparency: Kelengkapan atribut provenance data.
 * 4. Review State: Status alur kerja operasional intelijen.
 * ══════════════════════════════════════════════════════════════════════════
 */

import type { ThreatSpectrumCluster } from '../../types.ts'
import type { 
  FreshnessAssessment, 
  ContextRelevanceAssessment, 
  MetadataTransparencyAssessment, 
  RadarReviewState,
  RadarTaxonomyDomain 
} from './radar-types.ts'
import { extractEntitiesFromText } from './clustering-engine.ts'

/**
 * Pengklasifikasi Domain Taksonomi NARADA (Sprint 6)
 * Memetakan publikasi atau kueri ke salah satu dari 7 Domain Resmi.
 */
export function classifyTaxonomyDomain(
  title: string,
  excerpt: string = '',
  fallbackDomain: RadarTaxonomyDomain = 'NATIONAL_POLICY'
): RadarTaxonomyDomain {
  const norm = (title + ' ' + excerpt).toLowerCase()

  // 1. CYBER_PUBLIC_IMPACT: Gangguan siber layanan publik, peretasan, ransomware
  if (
    norm.includes('kebocoran data') || norm.includes('serangan siber') ||
    norm.includes('ransomware') || norm.includes('hacker') || norm.includes('peretasan') ||
    norm.includes('pdns') || norm.includes('bssn') || norm.includes('malware') ||
    norm.includes('gangguan server') || norm.includes('sistem down') || norm.includes('keamanan siber')
  ) {
    return 'CYBER_PUBLIC_IMPACT'
  }

  // 2. INFORMATION_INTEGRITY: Cek fakta, disinformasi, klarifikasi
  if (
    norm.includes('hoaks') || norm.includes('hoax') || norm.includes('disinformasi') ||
    norm.includes('misinformasi') || norm.includes('cek fakta') || norm.includes('klarifikasi') ||
    norm.includes('manipulasi') || norm.includes('kabar bohong') || norm.includes('fitnah')
  ) {
    return 'INFORMATION_INTEGRITY'
  }

  // 3. DEFENSE_SECURITY: Pertahanan negara, TNI, alutsista, perbatasan
  if (
    norm.includes('tni') || norm.includes('alutsista') || norm.includes('kemhan') ||
    norm.includes('papua') || norm.includes('kkb') || norm.includes('opm') ||
    norm.includes('ambalat') || norm.includes('natuna') || norm.includes('perbatasan') ||
    norm.includes('kapal perang') || norm.includes('pesawat tempur') || norm.includes('militer') ||
    norm.includes('kedaulatan') || norm.includes('marinir') || norm.includes('kopassus') ||
    norm.includes('kodam') || norm.includes('keamanan')
  ) {
    return 'DEFENSE_SECURITY'
  }

  // 4. DIGITAL_ECONOMY: Transaksi digital, pajak digital, fintech, e-commerce
  if (
    norm.includes('pajak digital') || norm.includes('transaksi digital') ||
    norm.includes('ekonomi digital') || norm.includes('fintech') || norm.includes('marketplace') ||
    norm.includes('pph 22') || norm.includes('pph') || norm.includes('bank digital') ||
    norm.includes('qris') || norm.includes('kripto') || norm.includes('e-commerce') ||
    norm.includes('hashim') || norm.includes('fiskal') || norm.includes('ojk') ||
    norm.includes('bank indonesia') || norm.includes('devisa')
  ) {
    return 'DIGITAL_ECONOMY'
  }

  // 5. CIVIC_DYNAMICS: Unjuk rasa, demonstrasi, aksi massa, dinamika sipil
  if (
    norm.includes('unjuk rasa') || norm.includes('demonstrasi') || norm.includes('aksi massa') ||
    norm.includes('demo') || norm.includes('protes') || norm.includes('penolakan') ||
    norm.includes('bentrok') || norm.includes('kericuhan') || norm.includes('pemakzulan') ||
    norm.includes('buruh') || norm.includes('mahasiswa')
  ) {
    return 'CIVIC_DYNAMICS'
  }

  // 6. PUBLIC_CRISIS: Bencana, logistik, pangan, BBM, darurat kesehatan
  if (
    norm.includes('bencana') || norm.includes('gempa') || norm.includes('tsunami') ||
    norm.includes('megathrust') || norm.includes('banjir') || norm.includes('longsor') ||
    norm.includes('erupsi') || norm.includes('merapi') || norm.includes('pangan') ||
    norm.includes('bbm') || norm.includes('kesehatan') || norm.includes('obat') ||
    norm.includes('bpom') || norm.includes('bnpb') || norm.includes('bmkg') ||
    norm.includes('wabah') || norm.includes('kelangkaan')
  ) {
    return 'PUBLIC_CRISIS'
  }

  // 7. NATIONAL_POLICY: Kebijakan nasional, presiden, kabinet, lembaga tinggi
  if (
    norm.includes('prabowo') || norm.includes('gibran') || norm.includes('presiden') ||
    norm.includes('pemerintah') || norm.includes('dpr') || norm.includes('mpr') ||
    norm.includes('kementerian') || norm.includes('menteri') || norm.includes('kebijakan') ||
    norm.includes('bansos') || norm.includes('mbg') || norm.includes('ijazah') ||
    norm.includes('kpk') || norm.includes('kejagung') || norm.includes('ikn')
  ) {
    return 'NATIONAL_POLICY'
  }

  return fallbackDomain
}

/**
 * 1. Evaluasi Relevansi Konteks (Context Relevance)
 * Mengukur kesesuaian narasi dengan domain pantauan pertahanan & kognitif publik.
 * CATATAN PENTING: Skor relevansi mengukur tingkat kecocokan topik pantauan,
 * BUKAN tingkat ancaman atau bahaya publik!
 */
export function evaluateContextRelevance(
  title: string,
  excerpt: string = '',
  category: ThreatSpectrumCluster,
  sourceType: string
): ContextRelevanceAssessment {
  const fullText = (title + ' ' + excerpt).toLowerCase()
  const entities = extractEntitiesFromText(fullText)
  const matchedTopics: string[] = []
  const reasonCodes: string[] = []

  let score = 30 // Skor baseline untuk publikasi pers umum

  // Jika merupakan rujukan Cek Fakta resmi dari MAFINDO / TurnBackHoax
  if (sourceType === 'fact_check') {
    score = Math.max(score, 85)
    matchedTopics.push('Verifikasi Cek Fakta Resmi')
    reasonCodes.push('OFFICIAL_FACTCHECK_ENTRY')
  }

  // Domain 1: Kedaulatan & Hankam (TNI, Perbatasan, Alutsista, Papua)
  if (category === 'KEDAULATAN_MILITER' || entities.some(e => e.includes('tni') || e.includes('papua') || e.includes('ambalat') || e.includes('natuna') || e.includes('alutsista'))) {
    score = Math.max(score, 80)
    matchedTopics.push('Hankam & Kedaulatan')
    reasonCodes.push('DEFENSE_SOVEREIGNTY_CONTEXT')
  }

  // Domain 2: Kebijakan Negara, Lembaga Tinggi, & Stabilitas Politik
  if (category === 'POLITIK_NEGARA' || entities.some(e => e.includes('prabowo') || e.includes('gibran') || e.includes('dpr') || e.includes('kpk') || e.includes('mk'))) {
    score = Math.max(score, 70)
    matchedTopics.push('Dinamika Kebijakan Negara')
    reasonCodes.push('CIVIL_GOVERNANCE_CONTEXT')
  }

  // Domain 3: Ekonomi & Transaksi Digital
  if (fullText.includes('pajak digital') || fullText.includes('transaksi digital') || fullText.includes('fintech') || fullText.includes('marketplace') || fullText.includes('bank digital')) {
    score = Math.max(score, 75)
    matchedTopics.push('Ekonomi & Transaksi Digital')
    reasonCodes.push('DIGITAL_ECONOMY_CONTEXT')
  }

  // Domain 4: Aksi Massa & Dinamika Aspirasi Lapangan
  if (fullText.includes('demo') || fullText.includes('unjuk rasa') || fullText.includes('mahasiswa') || fullText.includes('buruh') || fullText.includes('aksi damai')) {
    score = Math.max(score, 65)
    matchedTopics.push('Pemantauan Aspirasi Lapangan')
    reasonCodes.push('PUBLIC_DEMONSTRATION_MONITORING')
  }

  // Domain 5: Bencana Darurat & Krisis Publik (BMKG / BNPB)
  if (category === 'BENCANA_DARURAT' || entities.some(e => e.includes('bmkg') || e.includes('bnpb') || e.includes('gempa') || e.includes('tsunami') || e.includes('megathrust'))) {
    score = Math.max(score, 75)
    matchedTopics.push('Kedaruratan Bencana Publik')
    reasonCodes.push('DISASTER_EARLY_WARNING_CONTEXT')
  }

  // Domain 6: Isu Pangan & Bansos
  if (category === 'PENIPUAN_BANSOS' || category === 'KESEHATAN_PANGAN' || entities.some(e => e.includes('bansos') || e.includes('bpom') || e.includes('beras') || e.includes('pangan'))) {
    score = Math.max(score, 65)
    matchedTopics.push('Pangan & Jaminan Sosial')
    reasonCodes.push('SOCIAL_SAFETY_CONTEXT')
  }

  // Domain 7: Keamanan Siber & Dampak Publik (Prioritas Hackathon Pertahanan Siber)
  if (category === 'SIBER_PERETASAN' || fullText.includes('kebocoran data') || fullText.includes('serangan siber') || fullText.includes('ransomware') || fullText.includes('pdns') || fullText.includes('peretasan') || fullText.includes('hacker') || fullText.includes('pussiberad')) {
    score = Math.max(score, 90)
    matchedTopics.push('Keamanan Siber & Pertahanan Digital')
    reasonCodes.push('CYBER_SECURITY_CONTEXT')
  }

  if (matchedTopics.length === 0) {
    matchedTopics.push('Informasi Publik Umum')
    reasonCodes.push('GENERAL_PUBLIC_INFO')
  }

  return {
    score: Math.min(100, score),
    matchedTopics,
    reasonCodes,
    primaryCategory: category
  }
}

/**
 * 2. Evaluasi Transparansi Metadata Sumber (Metadata Transparency)
 * Mengukur seberapa lengkap atribut provenance yang disediakan oleh sumber data.
 */
export function evaluateMetadataTransparency(
  originalUrl: string,
  canonicalUrl: string,
  publisher: string,
  publishedAt: number | null
): MetadataTransparencyAssessment {
  const reasonCodes: string[] = []
  let completenessScore = 0

  const hasOriginalUrl = Boolean(originalUrl && originalUrl.startsWith('http'))
  if (hasOriginalUrl) {
    completenessScore += 25
    reasonCodes.push('ORIGINAL_URL_PROVIDED')
  }

  const hasCanonicalUrl = Boolean(canonicalUrl && canonicalUrl.startsWith('http'))
  if (hasCanonicalUrl) {
    completenessScore += 25
    reasonCodes.push('CANONICAL_URL_RESOLVED')
  }

  const hasPublisher = Boolean(publisher && publisher.trim().length > 0 && publisher !== 'Portal Berita Terverifikasi')
  if (hasPublisher) {
    completenessScore += 25
    reasonCodes.push('PUBLISHER_EXPLICITLY_IDENTIFIED')
  }

  const hasPublishedDate = Boolean(publishedAt !== null && publishedAt > 0 && !isNaN(publishedAt))
  if (hasPublishedDate) {
    completenessScore += 25
    reasonCodes.push('TIMESTAMP_SOURCE_VERIFIED')
  } else {
    reasonCodes.push('MISSING_OR_UNPARSEABLE_TIMESTAMP')
  }

  return {
    completenessScore,
    hasPublishedDate,
    hasOriginalUrl,
    hasPublisher,
    hasValidLink: hasOriginalUrl || hasCanonicalUrl,
    reasonCodes
  }
}

/**
 * 3. Menentukan Status Alur Kerja Penelaahan (Review State)
 */
export function determineReviewState(
  freshness: FreshnessAssessment,
  relevance: ContextRelevanceAssessment,
  transparency: MetadataTransparencyAssessment,
  sourceType: string
): RadarReviewState {
  // Jika metadata sangat terbatas
  if (!transparency.hasPublishedDate || transparency.completenessScore < 50) {
    return 'SOURCE_LIMITED'
  }

  // Jika merupakan entri cek fakta terverifikasi
  if (sourceType === 'fact_check') {
    return 'UPDATED'
  }

  // Jika merupakan publikasi breaking terkini dengan relevansi konteks tinggi
  if (freshness.status === 'BREAKING' && relevance.score >= 70) {
    return 'NEEDS_REVIEW'
  }

  // Jika breaking biasa
  if (freshness.status === 'BREAKING') {
    return 'NEW'
  }

  // Berita arsip atau konteks
  if (freshness.status === 'KONTEKS') {
    return 'CONTEXT_ONLY'
  }

  return 'NEW'
}
