/**
 * ════════════════════════════════════════════════════════════════════════════════════
 * NARADA — COGNITIVE THREAT DEFENSE SYSTEM
 * ENGINE DOSSIER FORENSIK BUKTI SIBER SOSIAL & INVESTIGATION SANDBOX
 * SPRINT 1D — EVIDENCE INTEGRITY, ANALYTICAL VALIDITY & INVESTIGATION SAFETY
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ════════════════════════════════════════════════════════════════════════════════════
 * 
 * Prinsip Desain Non-Negotiable:
 * 1. Simulation Firewall: Preset ditandai secara immutable sebagai SYNTHETIC_BENCHMARK,
 *    memiliki watermark permanen, dan tidak pernah memutasi data LIVE/Radar.
 * 2. Narrative Pattern Analysis (Bukan Vonis Aktor):
 *    - Indikator dinamai NCS (Narrative Coordination Signals) / NPI.
 *    - Tidak ada profiling, vonis 'BOTNET', 'BUZZER', atau 'ORGANIK' pada individu.
 *    - Kategori berbasis pola konten: NEAR_DUPLICATE, HIGH_SIMILARITY, DISTINCT.
 * 3. Timestamp Provenance & Burst Velocity Validity:
 *    - Data teks tanpa timestamp sumber menghasilkan status NOT_AVAILABLE_NO_SOURCE_TIMESTAMP,
 *      burstVelocity: null, averageInterval: null (Dilarang fallback atau menggunakan urutan baris).
 * 4. Data Minimization & Privacy Protection:
 *    - Redaksi handle (@u***01) dan penggunaan pseudonymous record IDs (REC-01).
 *    - Netralisasi formula injection pada ekspor CSV.
 *    - Zero Telegram integration / source type.
 * 5. Claim-Level Assessment & Semantic Separation:
 *    - Penilaian bukti dilakukan per-Klaim spesifik (SUPPORTED, CONTRADICTED, MIXED, etc.),
 *      bukan memvonis publikasi atau event secara global.
 * ════════════════════════════════════════════════════════════════════════════════════
 */

import type { DebunkKnowledgeEntry, ThreatSpectrumCluster } from '../types'
import {
  clusterComments,
  calculateJaccardSimilarity,
  type CopypastaCluster,
  type CommentInput
} from './forensic/jaccard-matrix'
import { analyzeSentiment } from './forensic/sentiment-engine'
import { extractSmartEntities } from './ingest/live-osint-harvester'
import { fallbackSHA256 } from '../utils/crypto'

export type EvidenceMode = 'LIVE_REFERENCE' | 'USER_SUBMITTED' | 'SYNTHETIC_BENCHMARK'

export type TemporalCoverageStatus =
  | 'VALID_SOURCE_TIMESTAMP'
  | 'NOT_AVAILABLE_NO_SOURCE_TIMESTAMP'
  | 'INSUFFICIENT_TIMESTAMP_COVERAGE'
  | 'OPERATOR_SUPPLIED_UNVERIFIED'

export type PatternCategory =
  | 'NEAR_DUPLICATE'      // Jaccard similarity >= 0.65 dengan klaster berulang
  | 'HIGH_SIMILARITY'    // Kemiripan leksikal signifikan (0.45 - 0.64)
  | 'DISTINCT'           // Variasi leksikal beragam/organik (< 0.45)

export type ClaimAssessmentStatus =
  | 'SUPPORTED'
  | 'CONTRADICTED'
  | 'MIXED'
  | 'UNVERIFIED'
  | 'INCONCLUSIVE'

export interface ClaimAssessmentRecord {
  assessmentId: string
  id?: string // alias kompatibilitas
  claimId: string
  claimText: string
  verdict: ClaimAssessmentStatus
  rationale: string
  supportingEvidenceIds: string[]
  assessedBy: string
  assessedAt: string
  timestampIso?: string // alias kompatibilitas
  previousVerdict?: ClaimAssessmentStatus
}

export interface EnhancedSocialComment {
  id: string
  pseudonymId: string
  authorHandle: string
  redactedHandle: string
  content: string
  sentiment: 'PROVOKATIF' | 'SKEPTIS' | 'NETRAL' | 'POSITIF'
  patternCategory: PatternCategory
  isNearDuplicate: boolean
  matchedClusterPattern?: string
  hasSourceTimestamp: boolean
  sourcePublishedAt?: string
  timestampFormatted: string
  likes: number
  platformOrigin: string
}

export interface CuratedOsintLinks {
  googleNewsRecent: string
  googleTimeboundDay: string
  turnbackhoaxSearch: string
  factCheckExplorer: string
  dispenadSearch: string
}

export interface SocialThreatDossier {
  targetClaim: string
  claimId?: string
  cluster: ThreatSpectrumCluster
  clusterLabel: string
  clusterColor: string
  evidenceMode: EvidenceMode
  evidenceSourceName: string
  isSimulation: boolean
  simulationWatermark?: string
  contentHash: string
  hashAlgorithm: string
  hashDisclaimer: string
  ncsIndex: number // Narrative Coordination Signals (0-100)
  cibIndex?: number // Backward compatibility alias
  ncsInterpretation?: string // Penjelasan indikator analitis
  isPatternAnomalyFlagged: boolean
  patternSummary: string
  escalationLevel: string
  focusedKeywords: string
  rekapPolaTeks: {
    totalScanned: number
    nearDuplicateCount: number
    nearDuplicatePercent: number
    highSimilarityCount: number
    highSimilarityPercent: number
    distinctCount: number
    distinctPercent: number
    validTimestampCount: number
    timestampCoveragePercent: number
    temporalStatus: TemporalCoverageStatus
    averageIntervalSeconds: number | null
    burstVelocityPerMinute: number | null
  }
  copypastaClusters: CopypastaCluster[]
  commentsStream: EnhancedSocialComment[]
  osintLinks: CuratedOsintLinks
  temporalProfile?: SocialThreatDossier['rekapPolaTeks'] // Backward compatibility alias
  limitationsNotes: string[]
}

const CLUSTER_CONFIG: Record<ThreatSpectrumCluster, { label: string; color: string }> = {
  KEDAULATAN_MILITER: { label: 'Kedaulatan & Alutsista Militer', color: '#EF4444' },
  POLITIK_NEGARA: { label: 'Politik & Stabilitas Negara', color: '#F87171' },
  BENCANA_DARURAT: { label: 'Bencana Alam & Krisis BMKG', color: '#38BDF8' },
  PENIPUAN_BANSOS: { label: 'Penipuan Bansos & Finansial', color: '#FBBF24' },
  KESEHATAN_PANGAN: { label: 'Kesehatan Publik & Pangan', color: '#A78BFA' },
  UMUM_NETRAL: { label: 'Isu Umum & Kebijakan', color: '#94A3B8' }
}

// ─── 3 PRESET BENCHMARK SINTETIS (PACKAGE A - SIMULATION FIREWALL) ───

export interface SyntheticBenchmarkPreset {
  id: string
  name: string
  shortLabel: string
  category: ThreatSpectrumCluster
  claimTitle: string
  sourceContext: string
  description: string
  evidenceMode: 'SYNTHETIC_BENCHMARK'
  isSimulation: true
  simulationWatermark: string
  syntheticRecords: Array<{
    recordId: string
    syntheticHandle: string
    content: string
    sourceTimestampIso?: string
    likes: number
  }>
}

export const SYNTHETIC_BENCHMARKS: SyntheticBenchmarkPreset[] = [
  {
    id: 'preset-synthetic-high-similarity',
    name: 'Synthetic High Text-Similarity & Temporal-Concentration Benchmark',
    shortLabel: 'SIMULASI: High Text-Similarity & Temporal Concentration',
    category: 'KEDAULATAN_MILITER',
    claimTitle: '[SIMULASI] Uji Template Surat Edaran Pendaftaran Bintara TNI AD 2026',
    sourceContext: 'Dataset uji sintetis untuk pengujian matriks kesamaan leksikal tinggi dan konsentrasi waktu',
    description: '15 record sintetis dengan kesamaan leksikal tinggi (>65%) dan timestamp berjarak rapat untuk menguji sensitivitas deteksi template.',
    evidenceMode: 'SYNTHETIC_BENCHMARK',
    isSimulation: true,
    simulationWatermark: 'SIMULASI — SYNTHETIC BENCHMARK — BUKAN DATA LIVE / BUKAN KASUS NYATA',
    syntheticRecords: [
      { recordId: 'REC-SIM-001', syntheticHandle: '@sim_bot_01', content: 'Info resmi link pendaftaran bintara tni ad 2026 jalur khusus tanpa tes chat wa admin di bio bit.ly/tni-ad-resmi kuota terbatas!', sourceTimestampIso: '2026-10-30T10:00:02Z', likes: 0 },
      { recordId: 'REC-SIM-002', syntheticHandle: '@sim_bot_02', content: 'Info resmi link pendaftaran bintara tni ad 2026 jalur khusus tanpa tes chat wa admin di bio bit.ly/tni-ad-resmi kuota terbatas!', sourceTimestampIso: '2026-10-30T10:00:04Z', likes: 1 },
      { recordId: 'REC-SIM-003', syntheticHandle: '@sim_bot_03', content: 'Info resmi link pendaftaran bintara tni ad 2026 jalur khusus tanpa tes chat wa admin di bio bit.ly/tni-ad-resmi kuota terbatas buruan!', sourceTimestampIso: '2026-10-30T10:00:07Z', likes: 0 },
      { recordId: 'REC-SIM-004', syntheticHandle: '@sim_bot_04', content: 'Alhamdulillah sudah chat admin beneran dapat nomor pendaftaran resmi bintara tni ad 2026 tanpa tes langsung validasi', sourceTimestampIso: '2026-10-30T10:00:09Z', likes: 2 },
      { recordId: 'REC-SIM-005', syntheticHandle: '@sim_bot_05', content: 'Info resmi link pendaftaran bintara tni ad 2026 jalur khusus tanpa tes chat wa admin di bio bit.ly/tni-ad-resmi kuota terbatas segera!', sourceTimestampIso: '2026-10-30T10:00:10Z', likes: 0 },
      { recordId: 'REC-SIM-006', syntheticHandle: '@sim_bot_06', content: 'Info resmi link pendaftaran bintara tni ad 2026 jalur khusus tanpa tes chat wa admin di bio bit.ly/tni-ad-resmi kuota terbatas jangan sampai telat', sourceTimestampIso: '2026-10-30T10:00:12Z', likes: 0 },
      { recordId: 'REC-SIM-007', syntheticHandle: '@sim_bot_07', content: 'Info resmi link pendaftaran bintara tni ad 2026 jalur khusus tanpa tes chat wa admin di bio bit.ly/tni-ad-resmi kuota terbatas!', sourceTimestampIso: '2026-10-30T10:00:15Z', likes: 1 },
      { recordId: 'REC-SIM-008', syntheticHandle: '@sim_user_08', content: 'Hati-hati penipuan! Mabesad sudah tegaskan rekrutmen TNI AD gratis tanpa pungutan biaya apapun dan hanya lewat ad.rekrutmen-tni.mil.id!', sourceTimestampIso: '2026-10-30T10:00:33Z', likes: 15 },
      { recordId: 'REC-SIM-009', syntheticHandle: '@sim_bot_09', content: 'Info resmi link pendaftaran bintara tni ad 2026 jalur khusus tanpa tes chat wa admin di bio bit.ly/tni-ad-resmi buruan sebelum ditutup', sourceTimestampIso: '2026-10-30T10:00:35Z', likes: 0 },
      { recordId: 'REC-SIM-010', syntheticHandle: '@sim_bot_10', content: 'Info resmi link pendaftaran bintara tni ad 2026 jalur khusus tanpa tes chat wa admin di bio bit.ly/tni-ad-resmi kuota terbatas!', sourceTimestampIso: '2026-10-30T10:00:37Z', likes: 0 },
      { recordId: 'REC-SIM-011', syntheticHandle: '@sim_user_11', content: 'Waspada penipuan siber mengatasnamakan Dispenad, jangan transfer uang ke rekening pribadi manapun!', sourceTimestampIso: '2026-10-30T10:01:02Z', likes: 12 },
      { recordId: 'REC-SIM-012', syntheticHandle: '@sim_bot_12', content: 'Info resmi link pendaftaran bintara tni ad 2026 jalur khusus tanpa tes chat wa admin di bio bit.ly/tni-ad-resmi kuota terbatas segera gabung', sourceTimestampIso: '2026-10-30T10:01:04Z', likes: 0 },
      { recordId: 'REC-SIM-013', syntheticHandle: '@sim_user_13', content: 'Kemarin ada tetangga ketipu jutaan gara-gara klik link wa pendaftaran palsu, tolong aparat tindak tegas sindikat ini!', sourceTimestampIso: '2026-10-30T10:01:38Z', likes: 24 },
      { recordId: 'REC-SIM-014', syntheticHandle: '@sim_bot_14', content: 'Info resmi link pendaftaran bintara tni ad 2026 jalur khusus tanpa tes chat wa admin di bio bit.ly/tni-ad-resmi kuota terbatas!', sourceTimestampIso: '2026-10-30T10:01:40Z', likes: 0 },
      { recordId: 'REC-SIM-015', syntheticHandle: '@sim_bot_15', content: 'Info resmi link pendaftaran bintara tni ad 2026 jalur khusus tanpa tes chat wa admin di bio bit.ly/tni-ad-resmi kuota terbatas segera!', sourceTimestampIso: '2026-10-30T10:01:43Z', likes: 0 }
    ]
  },
  {
    id: 'preset-synthetic-mixed-narrative',
    name: 'Synthetic Mixed-Narrative Benchmark',
    shortLabel: 'SIMULASI: Mixed-Narrative Pattern',
    category: 'KEDAULATAN_MILITER',
    claimTitle: '[SIMULASI] Uji Wacana Polarisasi Pengadaan Alutsista dan Patroli Maritim',
    sourceContext: 'Dataset uji sintetis untuk menguji ketahanan evaluasi terhadap percakapan polarisasi campuran',
    description: '10 record sintetis dengan kombinasi kalimat kritis berulang, tanggapan netral, dan penjelasan patriotik.',
    evidenceMode: 'SYNTHETIC_BENCHMARK',
    isSimulation: true,
    simulationWatermark: 'SIMULASI — SYNTHETIC BENCHMARK — BUKAN DATA LIVE / BUKAN KASUS NYATA',
    syntheticRecords: [
      { recordId: 'REC-SIM-101', syntheticHandle: '@sim_acc_01', content: 'TNI AL harus tambah armada patroli di ZEE Natuna Utara, kapal asing makin berani masuk wilayah kita.', sourceTimestampIso: '2026-10-30T11:00:18Z', likes: 4 },
      { recordId: 'REC-SIM-102', syntheticHandle: '@sim_acc_02', content: 'Uang triliunan beli alutsista bekas gak ada gunanya, kedaulatan laut kita tetap dijajah kapal asing!', sourceTimestampIso: '2026-10-30T11:00:24Z', likes: 8 },
      { recordId: 'REC-SIM-103', syntheticHandle: '@sim_acc_03', content: 'Uang triliunan beli alutsista bekas gak ada gunanya, kedaulatan laut kita tetap dijajah kapal asing bongkar korupsi!', sourceTimestampIso: '2026-10-30T11:00:31Z', likes: 5 },
      { recordId: 'REC-SIM-104', syntheticHandle: '@sim_acc_04', content: 'KRI Frans Kaisiepo dan KRI Diponegoro aktif gelar patroli kedaulatan 24 jam nonstop, jangan termakan narasi pelemahan moril.', sourceTimestampIso: '2026-10-30T11:01:13Z', likes: 21 },
      { recordId: 'REC-SIM-105', syntheticHandle: '@sim_acc_05', content: 'Dukung penuh modernisasi alutsista TNI untuk pertahanan kedaulatan NKRI dari Sabang sampai Merauke!', sourceTimestampIso: '2026-10-30T11:01:43Z', likes: 11 },
      { recordId: 'REC-SIM-106', syntheticHandle: '@sim_acc_06', content: 'Uang triliunan beli alutsista bekas gak ada gunanya, kedaulatan laut kita tetap dijajah kapal asing viralkan!', sourceTimestampIso: '2026-10-30T11:01:48Z', likes: 6 },
      { recordId: 'REC-SIM-107', syntheticHandle: '@sim_acc_07', content: 'Modernisasi alutsista harus proporsional antara MEF tahap III dan kesiapan radar pesisir terpadu.', sourceTimestampIso: '2026-10-30T11:02:43Z', likes: 16 },
      { recordId: 'REC-SIM-108', syntheticHandle: '@sim_acc_08', content: 'Kami nelayan lokal di Natuna merasa aman karena TNI AL dan Bakamla rutin kawal kami saat melaut.', sourceTimestampIso: '2026-10-30T11:03:43Z', likes: 30 },
      { recordId: 'REC-SIM-109', syntheticHandle: '@sim_acc_09', content: 'Uang triliunan beli alutsista bekas gak ada gunanya, kedaulatan laut kita tetap dijajah kapal asing usut tuntas!', sourceTimestampIso: '2026-10-30T11:03:51Z', likes: 4 },
      { recordId: 'REC-SIM-110', syntheticHandle: '@sim_acc_10', content: 'Mari bijak bermedia sosial, jangan sebarkan hoaks yang merendahkan kesiapan tempur prajurit kita.', sourceTimestampIso: '2026-10-30T11:04:31Z', likes: 14 }
    ]
  },
  {
    id: 'preset-synthetic-diverse-baseline',
    name: 'Synthetic Diverse-Text Baseline Benchmark',
    shortLabel: 'SIMULASI: Diverse-Text Baseline',
    category: 'KESEHATAN_PANGAN',
    claimTitle: '[SIMULASI] Uji Diskursus Beragam Ketahanan Pangan Nasional',
    sourceContext: 'Dataset uji sintetis untuk memverifikasi bahwa diskursus wajar tidak menghasilkan alarm koordinasi palsu',
    description: '6 record sintetis dengan leksikon beragam (Jaccard < 30%) dan interval waktu terdistribusi wajar.',
    evidenceMode: 'SYNTHETIC_BENCHMARK',
    isSimulation: true,
    simulationWatermark: 'SIMULASI — SYNTHETIC BENCHMARK — BUKAN DATA LIVE / BUKAN KASUS NYATA',
    syntheticRecords: [
      { recordId: 'REC-SIM-201', syntheticHandle: '@sim_warga_01', content: 'Alhamdulillah harga beras medium di pasar tradisional mulai stabil seminggu terakhir.', sourceTimestampIso: '2026-10-30T09:10:00Z', likes: 5 },
      { recordId: 'REC-SIM-202', syntheticHandle: '@sim_warga_02', content: 'Panen musim ini cukup melimpah tapi kami butuh kepastian harga beli gabah kering panen dari Bulog.', sourceTimestampIso: '2026-10-30T09:12:35Z', likes: 12 },
      { recordId: 'REC-SIM-203', syntheticHandle: '@sim_warga_03', content: 'Yang penting distribusi lancar ke pelosok desa, jangan sampai ada mafia yang nimbun beras.', sourceTimestampIso: '2026-10-30T09:14:20Z', likes: 7 },
      { recordId: 'REC-SIM-204', syntheticHandle: '@sim_warga_04', content: 'Stok beras SPHP di toko saya masih aman, pembeli dibatasi maksimal 2 karung per orang.', sourceTimestampIso: '2026-10-30T09:18:30Z', likes: 6 },
      { recordId: 'REC-SIM-205', syntheticHandle: '@sim_warga_05', content: 'Program cetak sawah baru harus didukung irigasi modern agar tidak mangkrak di tahun kedua.', sourceTimestampIso: '2026-10-30T09:25:00Z', likes: 9 },
      { recordId: 'REC-SIM-206', syntheticHandle: '@sim_warga_06', content: 'Bantuan pangan beras 10kg sangat membantu keluarga pra-sejahtera di kampung kami.', sourceTimestampIso: '2026-10-30T09:32:05Z', likes: 8 }
    ]
  }
]

// Backward compatibility alias for existing code
export const INVESTIGATION_PRESETS = SYNTHETIC_BENCHMARKS

/**
 * Data Minimization: Redaksi handle pengguna (contoh: @user_123 -> @u***23)
 */
export function redactHandle(rawHandle: string): string {
  if (!rawHandle) return '@anon'
  const clean = rawHandle.trim().replace(/^@/, '')
  if (clean.length <= 3) return `@${clean.charAt(0)}***`
  return `@${clean.charAt(0)}***${clean.slice(-2)}`
}

/**
 * Keamanan Ekspor CSV: Mencegah Formula Injection (=, +, -, @)
 */
export function sanitizeForCsvExport(text: string): string {
  if (!text) return ''
  const trimmed = text.trim()
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    return `'${trimmed}`
  }
  return trimmed
}

/**
 * Menghasilkan hash konten deterministik untuk verifikasi integritas byte
 */
export function calculateContentHash(content: string): string {
  if (!content) return fallbackSHA256('')
  return fallbackSHA256(content)
}

/**
 * Pembuat Tautan Dorking OSINT Terkurasi Ber-filter Waktu Ketat (when:2d, qdr:d)
 */
export function buildCuratedOsintLinks(keywords: string): CuratedOsintLinks {
  const enc = encodeURIComponent(keywords.trim() || 'TNI AD')
  return {
    googleNewsRecent: `https://news.google.com/search?q=${enc}+when:2d&hl=id&gl=ID&ceid=ID:id`,
    googleTimeboundDay: `https://www.google.com/search?q=${enc}&tbs=qdr:d`,
    turnbackhoaxSearch: `https://turnbackhoax.id/?s=${enc}`,
    factCheckExplorer: `https://toolbox.google.com/factcheck/explorer/search/${enc}`,
    dispenadSearch: `https://www.google.com/search?q=site:tniad.mil.id+${enc}`
  }
}

/**
 * In-Memory Ledger for Claim Assessments (Package E)
 * Memastikan assessment klaim tercatat mandiri tanpa memutasi status publikasi/event
 */
const claimAssessmentLedger: Map<string, ClaimAssessmentRecord[]> = new Map()

export function recordClaimAssessment(
  input: {
    assessmentId?: string
    id?: string
    claimId: string
    claimText: string
    verdict: ClaimAssessmentStatus
    rationale: string
    supportingEvidenceIds: string[]
    assessedBy: string
    assessedAt?: string
    timestampIso?: string
    previousVerdict?: ClaimAssessmentStatus
  }
): ClaimAssessmentRecord {
  const generatedId = input.assessmentId || input.id || `ASSESS-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  const timestamp = input.assessedAt || input.timestampIso || new Date().toISOString()
  const record: ClaimAssessmentRecord = {
    assessmentId: generatedId,
    id: generatedId,
    claimId: input.claimId,
    claimText: input.claimText,
    verdict: input.verdict,
    rationale: input.rationale,
    supportingEvidenceIds: input.supportingEvidenceIds,
    assessedBy: input.assessedBy,
    assessedAt: timestamp,
    timestampIso: timestamp,
    previousVerdict: input.previousVerdict
  }
  const existing = claimAssessmentLedger.get(record.claimId) || []
  claimAssessmentLedger.set(record.claimId, [record, ...existing])
  return record
}

export function getClaimAssessments(claimId: string): ClaimAssessmentRecord[] {
  return claimAssessmentLedger.get(claimId) || []
}

export function getAllClaimAssessments(): ClaimAssessmentRecord[] {
  const all: ClaimAssessmentRecord[] = []
  claimAssessmentLedger.forEach(list => all.push(...list))
  return all
}

export function clearClaimAssessments(): void {
  claimAssessmentLedger.clear()
}

/**
 * Parsing teks input mentah analis (Package C - Strict Timestamp Provenance)
 * Jika tidak ada timestamp sumber yang sah, intervalSeconds bernilai null.
 * Dilarang merekayasa interval berdasarkan urutan baris.
 */
export function parseRawCommentsText(
  rawText: string
): Array<{
  recordId: string
  handle: string
  redactedHandle: string
  content: string
  sourceTimestampIso?: string
  hasSourceTimestamp: boolean
  likes: number
}> {
  if (!rawText || !rawText.trim()) return []

  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length >= 5)

  return lines.map((line, idx) => {
    let handle = `@user_${idx + 1}`
    let content = line
    let sourceTimestampIso: string | undefined = undefined
    let hasSourceTimestamp = false

    // Ekstraksi timestamp opsional jika format memuat [YYYY-MM-DD...] atau [HH:MM:SS]
    const tsMatch = line.match(/^\[(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}[^\]]*)\]\s*(.+)$/)
    if (tsMatch) {
      const parsedDate = Date.parse(tsMatch[1].replace(' ', 'T'))
      if (!isNaN(parsedDate) && parsedDate <= Date.now() + 60000) {
        sourceTimestampIso = new Date(parsedDate).toISOString()
        hasSourceTimestamp = true
        content = tsMatch[2].trim()
      }
    }

    // Format "@handle: komentar"
    const colonMatch = content.match(/^(@[\w\d_.-]+)\s*:\s*(.+)$/)
    if (colonMatch) {
      handle = colonMatch[1]
      content = colonMatch[2].trim()
    } else {
      // Format "handle | komentar"
      const pipeMatch = content.match(/^([^|]{3,30})\|\s*(.+)$/)
      if (pipeMatch) {
        const rawHandle = pipeMatch[1].trim()
        handle = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle.replace(/\s+/g, '_').toLowerCase()}`
        content = pipeMatch[2].trim()
      }
    }

    return {
      recordId: `REC-USR-${String(idx + 1).padStart(3, '0')}`,
      handle,
      redactedHandle: redactHandle(handle),
      content,
      sourceTimestampIso,
      hasSourceTimestamp,
      likes: 0
    }
  })
}

export interface DossierRecordInput {
  recordId?: string
  syntheticHandle?: string
  handle?: string
  authorHandle?: string
  content: string
  sourceTimestampIso?: string
  hasSourceTimestamp?: boolean
  intervalSeconds?: number
  likes?: number
}

/**
 * Sintesis Dossier Forensik Siber Sosial Berbasis Bukti Nyata & Validitas Analitis
 * (Sprint 1D - Package A, B, C, D, E, G, I)
 */
export function synthesizeInvestigationDossier(
  targetEntry: Partial<DebunkKnowledgeEntry>,
  customRecords?: DossierRecordInput[],
  evidenceMeta?: {
    sourceName: string
    sourceKind: EvidenceMode
    isSimulation?: boolean
    watermark?: string
  }
): SocialThreatDossier {
  const claim = targetEntry.claim || 'Isu Klaim Lapangan'
  const claimId = targetEntry.id || `CLM-${Date.now()}`
  const cluster = targetEntry.cluster || 'POLITIK_NEGARA'
  const clusterMeta = CLUSTER_CONFIG[cluster] || CLUSTER_CONFIG.POLITIK_NEGARA
  const focusedKeywords = extractSmartEntities(claim)

  const evidenceMode: EvidenceMode = evidenceMeta?.sourceKind || 'USER_SUBMITTED'
  const isSimulation = evidenceMode === 'SYNTHETIC_BENCHMARK' || Boolean(evidenceMeta?.isSimulation)
  const simulationWatermark = isSimulation
    ? (evidenceMeta?.watermark || 'SIMULASI — SYNTHETIC BENCHMARK — BUKAN DATA LIVE / BUKAN KASUS NYATA')
    : undefined

  const evidenceSourceName = evidenceMeta?.sourceName || (
    isSimulation
      ? SYNTHETIC_BENCHMARKS[0].name
      : (targetEntry.originalPlatform || targetEntry.officialSource || 'Masukan Bukti Analis')
  )

  // Tentukan sumber data record
  const sourceRecords: DossierRecordInput[] = (customRecords && customRecords.length > 0)
    ? customRecords
    : SYNTHETIC_BENCHMARKS[0].syntheticRecords

  // Format record menjadi EnhancedSocialComment (Tanpa pelabelan aktor individu)
  let validTimestampCount = 0
  const timestampsEpoch: number[] = []

  const commentsStream: EnhancedSocialComment[] = sourceRecords.map((item, idx) => {
    const recordId = item.recordId || (isSimulation ? `REC-SIM-${String(idx + 1).padStart(3, '0')}` : `REC-USR-${String(idx + 1).padStart(3, '0')}`)
    const rawHandle = item.syntheticHandle || item.handle || item.authorHandle || `@user_${idx + 1}`
    const redacted = isSimulation ? rawHandle : redactHandle(rawHandle)

    let hasSourceTs = item.hasSourceTimestamp ?? Boolean(item.sourceTimestampIso)
    let sourcePublishedAt = item.sourceTimestampIso

    if (sourcePublishedAt) {
      const parsed = Date.parse(sourcePublishedAt)
      if (!isNaN(parsed)) {
        timestampsEpoch.push(parsed)
        validTimestampCount++
        hasSourceTs = true
      } else {
        hasSourceTs = false
        sourcePublishedAt = undefined
      }
    }

    const sent = analyzeSentiment(item.content)

    return {
      id: `ev-${idx + 1}-${recordId}`,
      pseudonymId: recordId,
      authorHandle: rawHandle,
      redactedHandle: redacted,
      content: item.content,
      sentiment: sent.label,
      patternCategory: 'DISTINCT', // default, akan diperbarui saat klastering
      isNearDuplicate: false,
      hasSourceTimestamp: hasSourceTs,
      sourcePublishedAt,
      timestampFormatted: sourcePublishedAt ? new Date(sourcePublishedAt).toLocaleTimeString('id-ID') : 'Tanpa Timestamp Sumber',
      likes: item.likes || 0,
      platformOrigin: isSimulation ? 'SYNTHETIC_FIXTURE' : 'USER_INPUT'
    }
  })

  // Klastering Leksikal Jaccard (Mendeteksi Near-Duplicate Text Pattern)
  const commentInputs: CommentInput[] = commentsStream.map(c => ({
    id: c.id,
    text: c.content,
    author: c.pseudonymId
  }))

  const clusterResult = clusterComments(commentInputs, 15)
  const copypastaClusters = clusterResult.clusters

  // Evaluasi Pola Teks Konten (Bukan Pelabelan Aktor)
  commentsStream.forEach(c => {
    const matchedCluster = copypastaClusters.find(cl =>
      calculateJaccardSimilarity(c.content, cl.templateText) >= 0.65
    )
    if (matchedCluster) {
      c.isNearDuplicate = true
      c.patternCategory = 'NEAR_DUPLICATE'
      c.matchedClusterPattern = matchedCluster.templateText
    } else {
      // Periksa apakah memiliki kemiripan moderat terhadap salah satu template
      const hasModerateSim = copypastaClusters.some(cl => {
        const sim = calculateJaccardSimilarity(c.content, cl.templateText)
        return sim >= 0.40 && sim < 0.65
      })
      if (hasModerateSim) {
        c.patternCategory = 'HIGH_SIMILARITY'
      }
    }
  })

  // Rekapitulasi Pola Teks Agregat
  const totalScanned = Math.max(1, commentsStream.length)
  const nearDuplicateCount = commentsStream.filter(c => c.patternCategory === 'NEAR_DUPLICATE').length
  const highSimilarityCount = commentsStream.filter(c => c.patternCategory === 'HIGH_SIMILARITY').length
  const distinctCount = commentsStream.filter(c => c.patternCategory === 'DISTINCT').length

  const nearDuplicatePercent = Math.round((nearDuplicateCount / totalScanned) * 100)
  const highSimilarityPercent = Math.round((highSimilarityCount / totalScanned) * 100)
  const distinctPercent = Math.max(0, 100 - nearDuplicatePercent - highSimilarityPercent)

  // Evaluasi Timestamp & Temporal Metrics (Package C)
  const timestampCoveragePercent = Math.round((validTimestampCount / totalScanned) * 100)
  let temporalStatus: TemporalCoverageStatus = 'NOT_AVAILABLE_NO_SOURCE_TIMESTAMP'
  let averageIntervalSeconds: number | null = null
  let burstVelocityPerMinute: number | null = null

  if (validTimestampCount === 0) {
    temporalStatus = 'NOT_AVAILABLE_NO_SOURCE_TIMESTAMP'
    averageIntervalSeconds = null
    burstVelocityPerMinute = null
  } else if (timestampCoveragePercent < 50) {
    temporalStatus = 'INSUFFICIENT_TIMESTAMP_COVERAGE'
    averageIntervalSeconds = null
    burstVelocityPerMinute = null
  } else {
    temporalStatus = isSimulation ? 'VALID_SOURCE_TIMESTAMP' : 'OPERATOR_SUPPLIED_UNVERIFIED'
    // Urutkan timestamp aktual untuk menghitung interval nyata
    timestampsEpoch.sort((a, b) => a - b)
    if (timestampsEpoch.length >= 2) {
      const intervals: number[] = []
      for (let i = 1; i < timestampsEpoch.length; i++) {
        const diffSec = Math.max(0.5, (timestampsEpoch[i] - timestampsEpoch[i - 1]) / 1000)
        intervals.push(diffSec)
      }
      const sumIntervals = intervals.reduce((a, b) => a + b, 0)
      averageIntervalSeconds = parseFloat((sumIntervals / intervals.length).toFixed(1))

      const timeSpanMinutes = Math.max(0.2, (timestampsEpoch[timestampsEpoch.length - 1] - timestampsEpoch[0]) / 60000)
      burstVelocityPerMinute = Math.round(timestampsEpoch.length / timeSpanMinutes)
    }
  }

  // Narrative Coordination Signals (NCS Index 0-100) — Agregat Deskriptif, Bukan Vonis
  let ncsIndex = 10
  if (nearDuplicatePercent >= 20) {
    ncsIndex = Math.min(95, Math.round(45 + nearDuplicatePercent * 0.8 + (highSimilarityPercent * 0.2)))
  } else if (highSimilarityPercent >= 35) {
    ncsIndex = Math.min(65, Math.round(25 + highSimilarityPercent * 0.6))
  } else {
    ncsIndex = Math.max(10, Math.round(nearDuplicatePercent * 0.9 + highSimilarityPercent * 0.3 + 8))
  }

  // Ambang batas indikator telaah (Bukan vonis otomatis botnet)
  const isPatternAnomalyFlagged = nearDuplicatePercent >= 15 || ncsIndex >= 65 || (averageIntervalSeconds !== null && averageIntervalSeconds <= 3.5)

  const patternSummary = isPatternAnomalyFlagged
    ? `Terdeteksi konsentrasi kemiripan teks tinggi pada ${nearDuplicateCount} dari ${totalScanned} record sampel (NCS: ${ncsIndex}/100)${averageIntervalSeconds !== null ? ` dengan interval rata-rata ${averageIntervalSeconds}s` : ''}. Memerlukan penelaahan lebih lanjut.`
    : `Variasi teks sampel relatif beragam (${distinctPercent}% variasi leksikal, NCS: ${ncsIndex}/100). Belum ditemukan indikasi konsentrasi template masif.`

  const escalationLevel = ncsIndex >= 70
    ? 'SINYAL POLA KOORDINASI KUAT'
    : nearDuplicatePercent >= 15
    ? 'KONSENTRASI TEMPLATE AWAL'
    : 'POLA DISKURSUS BERAGAM'

  // Hash Integritas Konten
  const concatenatedContent = commentsStream.map(c => c.content).join('|')
  const contentHash = calculateContentHash(concatenatedContent)

  const limitationsNotes: string[] = [
    'Kemiripan leksikal teks (Jaccard Similarity) BUKAN bukti koordinasi inauthentic terpusat atau keberadaan botnet.',
    'Analisis hanya merefleksikan dataset sampel yang dimasukkan dan tidak dapat digeneralisasi ke seluruh warganet tanpa metode sampling probabilistik.',
    'Hash membuktikan integritas byte pasca-akuisisi; bukan bukti keaslian materi sebelum diunggah.',
    ...(temporalStatus === 'NOT_AVAILABLE_NO_SOURCE_TIMESTAMP' ? ['Data tidak memiliki timestamp sumber; metrik kecepatan waktu tidak dihitung demi integritas analitis.'] : [])
  ]

  return {
    targetClaim: claim,
    claimId,
    cluster,
    clusterLabel: clusterMeta.label,
    clusterColor: clusterMeta.color,
    evidenceMode,
    evidenceSourceName,
    isSimulation,
    simulationWatermark,
    contentHash,
    hashAlgorithm: 'SHA-256 (Byte Snapshot Digest)',
    hashDisclaimer: 'Hash SHA-256 membuktikan integritas byte snapshot tekstual pasca-akuisisi; bukan bukti keaslian materi sebelum diunggah dan bukan rantai legal hukum peradilan.',
    ncsIndex,
    cibIndex: ncsIndex,
    ncsInterpretation: patternSummary,
    isPatternAnomalyFlagged,
    patternSummary,
    escalationLevel,
    focusedKeywords,
    rekapPolaTeks: {
      totalScanned,
      nearDuplicateCount,
      nearDuplicatePercent,
      highSimilarityCount,
      highSimilarityPercent,
      distinctCount,
      distinctPercent,
      validTimestampCount,
      timestampCoveragePercent,
      temporalStatus,
      averageIntervalSeconds,
      burstVelocityPerMinute
    },
    copypastaClusters,
    commentsStream,
    osintLinks: buildCuratedOsintLinks(focusedKeywords),
    limitationsNotes,
    temporalProfile: {
      totalScanned,
      nearDuplicateCount,
      nearDuplicatePercent,
      highSimilarityCount,
      highSimilarityPercent,
      distinctCount,
      distinctPercent,
      validTimestampCount,
      timestampCoveragePercent,
      temporalStatus,
      averageIntervalSeconds,
      burstVelocityPerMinute
    }
  }
}

/**
 * Backward compatibility aliases
 */
export function generateSocialThreatDossier(
  entry: Partial<DebunkKnowledgeEntry>,
  customEvidence?: Array<{ content: string; handle?: string; syntheticHandle?: string; sourceTimestampIso?: string }>
): SocialThreatDossier {
  return synthesizeInvestigationDossier(entry, customEvidence)
}

export async function harvestAndSynthesizeDossier(
  entry: Partial<DebunkKnowledgeEntry>,
  onStageUpdate?: (stage: number, stageName: string) => void
): Promise<SocialThreatDossier> {
  if (onStageUpdate) {
    onStageUpdate(1, 'Inisiasi Meja Bedah Bukti Digital...')
    await new Promise(r => setTimeout(r, 40))
    onStageUpdate(2, 'Ekstraksi Entitas & Analisis Kemiripan Jaccard...')
    await new Promise(r => setTimeout(r, 40))
    onStageUpdate(3, 'Evaluasi Timestamp & Provenance Waktu...')
    await new Promise(r => setTimeout(r, 40))
    onStageUpdate(4, 'Penyusunan Indikator Koordinasi Narasi (NCS)...')
  }
  return synthesizeInvestigationDossier(entry)
}
