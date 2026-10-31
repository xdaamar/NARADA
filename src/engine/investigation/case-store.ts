/**
 * ════════════════════════════════════════════════════════════════════════════════════
 * NARADA — INVESTIGATION CASE & EVIDENCE STORE
 * SPRINT 2: D2 (CASE MANAGEMENT) & D4 (PROVENANCE & INTEGRITY LEDGER)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ════════════════════════════════════════════════════════════════════════════════════
 */

import { fallbackSHA256 } from '../../utils/crypto.ts'
import type {
  InvestigationCase,
  EvidenceRecord,
  ClaimRecord,
  EvidenceRelation,
  AssessmentRecord,
  AuditEvent,
  CaseStatus,
  EvidenceMode,
  PublicResponseDraft,
  ResponseDraftStatus
} from './investigation-types.ts'

// In-Memory Storage Maps (Memastikan ketersediaan instan di Node dan Browser)
const casesMap = new Map<string, InvestigationCase>()
const evidenceMap = new Map<string, EvidenceRecord>()
const claimsMap = new Map<string, ClaimRecord>()
const relationsMap = new Map<string, EvidenceRelation>()
const assessmentsMap = new Map<string, AssessmentRecord>()
const draftsMap = new Map<string, PublicResponseDraft>()
const auditEventsList: AuditEvent[] = []

const STORAGE_KEYS = {
  CASES: 'narada_inv_cases_v2',
  EVIDENCE: 'narada_inv_evidence_v2',
  CLAIMS: 'narada_inv_claims_v2',
  RELATIONS: 'narada_inv_relations_v2',
  ASSESSMENTS: 'narada_inv_assessments_v2',
  DRAFTS: 'narada_inv_drafts_v3',
  AUDIT: 'narada_inv_audit_v2'
}

let isHydrated = false

/**
 * Memuat state dari localStorage browser jika tersedia
 */
export function hydrateFromLocalStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage || isHydrated) return
  try {
    const rawCases = localStorage.getItem(STORAGE_KEYS.CASES)
    if (rawCases) {
      const parsed: InvestigationCase[] = JSON.parse(rawCases)
      parsed.forEach(c => casesMap.set(c.id, c))
    }

    const rawEvidence = localStorage.getItem(STORAGE_KEYS.EVIDENCE)
    if (rawEvidence) {
      const parsed: EvidenceRecord[] = JSON.parse(rawEvidence)
      parsed.forEach(e => evidenceMap.set(e.id, e))
    }

    const rawClaims = localStorage.getItem(STORAGE_KEYS.CLAIMS)
    if (rawClaims) {
      const parsed: ClaimRecord[] = JSON.parse(rawClaims)
      parsed.forEach(cl => claimsMap.set(cl.id, cl))
    }

    const rawRelations = localStorage.getItem(STORAGE_KEYS.RELATIONS)
    if (rawRelations) {
      const parsed: EvidenceRelation[] = JSON.parse(rawRelations)
      parsed.forEach(r => relationsMap.set(r.id, r))
    }

    const rawAssessments = localStorage.getItem(STORAGE_KEYS.ASSESSMENTS)
    if (rawAssessments) {
      const parsed: AssessmentRecord[] = JSON.parse(rawAssessments)
      parsed.forEach(a => assessmentsMap.set(a.id, a))
    }

    const rawDrafts = localStorage.getItem(STORAGE_KEYS.DRAFTS)
    if (rawDrafts) {
      const parsed: PublicResponseDraft[] = JSON.parse(rawDrafts)
      parsed.forEach(d => draftsMap.set(d.id, d))
    }

    const rawAudit = localStorage.getItem(STORAGE_KEYS.AUDIT)
    if (rawAudit) {
      const parsed: AuditEvent[] = JSON.parse(rawAudit)
      auditEventsList.length = 0
      auditEventsList.push(...parsed)
    }

    isHydrated = true
  } catch (err) {
    console.warn('[CaseStore] Gagal membaca storage lokal:', err)
  }
}

/**
 * Menyimpan snapshot ke localStorage secara aman
 */
function persistToLocalStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    localStorage.setItem(STORAGE_KEYS.CASES, JSON.stringify(Array.from(casesMap.values())))
    localStorage.setItem(STORAGE_KEYS.EVIDENCE, JSON.stringify(Array.from(evidenceMap.values())))
    localStorage.setItem(STORAGE_KEYS.CLAIMS, JSON.stringify(Array.from(claimsMap.values())))
    localStorage.setItem(STORAGE_KEYS.RELATIONS, JSON.stringify(Array.from(relationsMap.values())))
    localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(Array.from(assessmentsMap.values())))
    localStorage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(Array.from(draftsMap.values())))
    localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(auditEventsList))
  } catch (err) {
    console.warn('[CaseStore] Gagal menyimpan ke storage lokal (mungkin kuota penuh):', err)
  }
}

// Inisialisasi awal saat modul dimuat
hydrateFromLocalStorage()

// ─── INVESTIGATION CASE LIFECYCLE ───

let caseSequence = 1

export function generateCaseNumber(year = 2026): string {
  const num = String(caseSequence++).padStart(4, '0')
  return `NAR-${year}-${num}`
}

/**
 * Membuat kasus investigasi baru
 */
export function createInvestigationCase(params: {
  title: string
  summary: string
  mode: EvidenceMode
  linkedEventClusterIds?: string[]
  linkedPublicationIds?: string[]
  linkedSearchTrendSignalIds?: string[]
  createdByLocalOperator?: string
  tags?: string[]
  limitations?: string[]
  isSimulation?: boolean
  simulationWatermark?: string
}): InvestigationCase {
  const now = new Date().toISOString()
  const caseId = `CASE-${Date.now()}-${Math.floor(Math.random() * 1000)}`

  const newCase: InvestigationCase = {
    id: caseId,
    caseNumber: generateCaseNumber(),
    title: params.title.trim(),
    summary: params.summary.trim(),
    status: 'OPEN',
    mode: params.mode,
    linkedEventClusterIds: params.linkedEventClusterIds || [],
    linkedPublicationIds: params.linkedPublicationIds || [],
    linkedSearchTrendSignalIds: params.linkedSearchTrendSignalIds || [],
    createdAt: now,
    updatedAt: now,
    createdByLocalOperator: params.createdByLocalOperator || 'Analis Madya / Pussiberad',
    tags: params.tags || [],
    limitations: params.limitations || [
      'Investigasi terbatas pada bukti lokal yang diunggah dan referensi publik terverifikasi.',
      'Keputusan akhir membutuhkan penelaahan manusia (Human-in-the-loop).'
    ],
    isSimulation: Boolean(params.isSimulation),
    simulationWatermark: params.simulationWatermark
  }

  casesMap.set(caseId, newCase)

  // Catat Audit Event awal
  recordAuditEvent({
    caseId,
    entityType: 'CASE',
    entityId: caseId,
    eventType: 'CASE_CREATED',
    operatorLabel: newCase.createdByLocalOperator,
    newState: `Kasus '${newCase.title}' dibuka (${newCase.caseNumber})`,
    rationale: 'Inisiasi berkas investigasi siber sosial baru'
  })

  persistToLocalStorage()
  return newCase
}

/**
 * Membuka atau membuat kasus investigasi untuk Event Cluster tertentu secara idempoten
 */
export function getOrCreateCaseForCluster(cluster: {
  id: string
  title: string
  summary?: string
  publicationIds?: string[]
  trendSignalIds?: string[]
  isSimulation?: boolean
}): InvestigationCase {
  hydrateFromLocalStorage()

  // Cari apakah sudah ada kasus aktif untuk cluster ini
  for (const c of casesMap.values()) {
    if (c.linkedEventClusterIds.includes(cluster.id)) {
      return c
    }
  }

  // Jika belum ada, buat kasus baru
  return createInvestigationCase({
    title: cluster.title,
    summary: cluster.summary || `Pemeriksaan investigasi mendalam untuk klaster peristiwa: ${cluster.title}`,
    mode: cluster.isSimulation ? 'SYNTHETIC_BENCHMARK' : 'LIVE_REFERENCE',
    linkedEventClusterIds: [cluster.id],
    linkedPublicationIds: cluster.publicationIds || [],
    linkedSearchTrendSignalIds: cluster.trendSignalIds || [],
    isSimulation: cluster.isSimulation,
    simulationWatermark: cluster.isSimulation ? 'SIMULASI — SYNTHETIC BENCHMARK — BUKAN DATA LIVE / BUKAN KASUS NYATA' : undefined
  })
}

export function getInvestigationCase(caseId: string): InvestigationCase | undefined {
  hydrateFromLocalStorage()
  return casesMap.get(caseId)
}

export function getAllInvestigationCases(): InvestigationCase[] {
  hydrateFromLocalStorage()
  return Array.from(casesMap.values()).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

export function updateCaseStatus(
  caseId: string,
  newStatus: CaseStatus,
  operatorLabel: string,
  rationale: string
): InvestigationCase | undefined {
  hydrateFromLocalStorage()
  const c = casesMap.get(caseId)
  if (!c) return undefined

  if (c.status === 'ARCHIVED') {
    throw new Error(`Kasus ${c.caseNumber || caseId} telah diarsipkan (ARCHIVED) dan tidak dapat dimutasi secara langsung.`)
  }

  // Larang transisi mundur tidak sah dari CONCLUDED ke OPEN
  if (c.status === 'CONCLUDED' && newStatus === 'OPEN') {
    throw new Error(`Transisi tidak valid: Kasus CONCLUDED tidak dapat langsung kembali ke OPEN. Gunakan pembukaan kembali (reopenInvestigationCase).`)
  }

  const oldStatus = c.status
  c.status = newStatus
  c.updatedAt = new Date().toISOString()
  casesMap.set(caseId, c)

  recordAuditEvent({
    caseId,
    entityType: 'CASE',
    entityId: caseId,
    eventType: newStatus === 'ARCHIVED' ? 'CASE_ARCHIVED' : 'CASE_UPDATED',
    operatorLabel,
    previousState: `Status: ${oldStatus}`,
    newState: `Status: ${newStatus}`,
    rationale
  })

  persistToLocalStorage()
  return c
}

// ─── EVIDENCE RECORD MANAGEMENT ───

export function addEvidenceRecord(record: EvidenceRecord, operatorLabel = 'Local Operator'): void {
  hydrateFromLocalStorage()
  const c = casesMap.get(record.caseId)
  if (c && c.status === 'ARCHIVED') {
    throw new Error(`Kasus ${c.caseNumber || record.caseId} telah berstatus ARCHIVED dan tidak dapat dimodifikasi.`)
  }

  evidenceMap.set(record.id, record)

  // Update timestamp kasus
  if (c) {
    c.updatedAt = new Date().toISOString()
  }

  recordAuditEvent({
    caseId: record.caseId,
    entityType: 'EVIDENCE',
    entityId: record.id,
    eventType: 'EVIDENCE_SUBMITTED',
    operatorLabel,
    newState: `Bukti ${record.id} (${record.evidenceType}) ditambahkan`,
    rationale: `Metode ekstraksi: ${record.extractionMethod}`,
    relatedEvidenceIds: [record.id]
  })

  persistToLocalStorage()
}

export function getEvidenceRecordsForCase(caseId: string): EvidenceRecord[] {
  hydrateFromLocalStorage()
  return Array.from(evidenceMap.values())
    .filter(e => e.caseId === caseId)
    .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt))
}

export function getEvidenceRecordById(evidenceId: string): EvidenceRecord | undefined {
  hydrateFromLocalStorage()
  return evidenceMap.get(evidenceId)
}

// ─── CLAIM RECORD MANAGEMENT ───

export function addClaimRecord(claim: ClaimRecord, operatorLabel = 'Local Operator'): void {
  hydrateFromLocalStorage()
  const c = casesMap.get(claim.caseId)
  if (c && c.status === 'ARCHIVED') {
    throw new Error(`Kasus ${c.caseNumber || claim.caseId} telah berstatus ARCHIVED dan tidak dapat dimodifikasi.`)
  }

  claimsMap.set(claim.id, claim)

  if (c) {
    c.updatedAt = new Date().toISOString()
  }

  recordAuditEvent({
    caseId: claim.caseId,
    entityType: 'CLAIM',
    entityId: claim.id,
    eventType: 'CLAIM_CREATED',
    operatorLabel,
    newState: `Klaim terdaftar: "${claim.claimText.slice(0, 80)}..."`,
    rationale: `Metode ekstraksi: ${claim.extractionMethod}`,
    relatedEvidenceIds: claim.extractedFromEvidenceIds
  })

  persistToLocalStorage()
}

export function getClaimsForCase(caseId: string): ClaimRecord[] {
  hydrateFromLocalStorage()
  return Array.from(claimsMap.values())
    .filter(cl => cl.caseId === caseId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

// ─── EVIDENCE RELATION MANAGEMENT ───

export function addEvidenceRelation(relation: EvidenceRelation, operatorLabel = 'Local Operator'): void {
  hydrateFromLocalStorage()
  const resolvedCaseId = relation.caseId || claimsMap.get(relation.claimId)?.caseId || evidenceMap.get(relation.evidenceId)?.caseId || ''
  const c = casesMap.get(resolvedCaseId)
  if (c && c.status === 'ARCHIVED') {
    throw new Error(`Kasus ${c.caseNumber || resolvedCaseId} telah berstatus ARCHIVED dan tidak dapat dimodifikasi.`)
  }

  const enrichedRelation: EvidenceRelation = {
    ...relation,
    caseId: resolvedCaseId
  }
  relationsMap.set(relation.id, enrichedRelation)

  recordAuditEvent({
    caseId: resolvedCaseId,
    entityType: 'RELATION',
    entityId: relation.id,
    eventType: 'RELATION_CREATED',
    operatorLabel: relation.createdBy || operatorLabel,
    actor: relation.createdBy || operatorLabel,
    newState: `Relasi ${relation.relationType} antara klaim ${relation.claimId} dan bukti ${relation.evidenceId}`,
    rationale: relation.rationale,
    relatedEvidenceIds: [relation.evidenceId]
  })

  persistToLocalStorage()
}

export function getRelationsForCase(caseId: string): EvidenceRelation[] {
  hydrateFromLocalStorage()
  return Array.from(relationsMap.values()).filter(r => {
    if (r.caseId === caseId) return true
    const cl = claimsMap.get(r.claimId)
    if (cl && cl.caseId === caseId) return true
    const ev = evidenceMap.get(r.evidenceId)
    if (ev && ev.caseId === caseId) return true
    return false
  })
}

export function getRelationsForClaim(claimId: string): EvidenceRelation[] {
  hydrateFromLocalStorage()
  return Array.from(relationsMap.values()).filter(r => r.claimId === claimId)
}

// ─── CLAIM ASSESSMENT RECORD MANAGEMENT ───

export function addAssessmentRecord(assessment: AssessmentRecord): void {
  hydrateFromLocalStorage()
  const verdict = assessment.verdict || assessment.status || 'UNVERIFIED'
  const assessedBy = assessment.assessedBy || assessment.evaluatedBy || 'Local Operator'
  const assessedAt = assessment.assessedAt || assessment.evaluatedAt || new Date().toISOString()
  const normalizedRecord: AssessmentRecord = {
    ...assessment,
    verdict,
    status: verdict,
    assessedBy,
    evaluatedBy: assessedBy,
    assessedAt,
    evaluatedAt: assessedAt
  }
  assessmentsMap.set(assessment.id, normalizedRecord)

  const c = casesMap.get(assessment.caseId)
  if (c) {
    c.updatedAt = new Date().toISOString()
  }

  recordAuditEvent({
    caseId: assessment.caseId,
    entityType: 'ASSESSMENT',
    entityId: assessment.id,
    eventType: 'ASSESSMENT_REVIEWED',
    operatorLabel: assessedBy,
    actor: assessedBy,
    previousState: assessment.previousVerdict ? `Vonis sebelumnya: ${assessment.previousVerdict}` : undefined,
    newState: `Vonis resmi klaim: ${verdict}`,
    rationale: assessment.rationale,
    relatedEvidenceIds: [
      ...assessment.supportingEvidenceIds,
      ...assessment.contradictingEvidenceIds,
      ...assessment.contextualEvidenceIds
    ]
  })

  persistToLocalStorage()
}

export function getAssessmentsForClaim(claimId: string): AssessmentRecord[] {
  hydrateFromLocalStorage()
  return Array.from(assessmentsMap.values())
    .filter(a => a.claimId === claimId)
    .sort((a, b) => Date.parse(b.assessedAt) - Date.parse(a.assessedAt))
}

export function getAssessmentsForCase(caseId: string): AssessmentRecord[] {
  hydrateFromLocalStorage()
  return Array.from(assessmentsMap.values())
    .filter(a => a.caseId === caseId)
    .sort((a, b) => Date.parse(b.assessedAt) - Date.parse(a.assessedAt))
}

// ─── AUDIT EVENT LEDGER ───

export function recordAuditEvent(params: {
  caseId: string
  entityType: AuditEvent['entityType']
  entityId: string
  eventType?: AuditEvent['eventType']
  action?: AuditEvent['eventType']
  operatorLabel?: string
  actor?: string
  previousState?: string
  newState?: string
  rationale?: string
  relatedEvidenceIds?: string[]
}): AuditEvent {
  const operatorLabel = params.operatorLabel || params.actor || 'ANALIS_LOCAL'
  const action = (params.eventType || params.action || 'CASE_CREATED') as AuditEvent['eventType']

  const event: AuditEvent = {
    eventId: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    caseId: params.caseId,
    entityType: params.entityType,
    entityId: params.entityId,
    eventType: action,
    action,
    timestamp: new Date().toISOString(),
    operatorLabel,
    actor: operatorLabel,
    previousState: params.previousState,
    newState: params.newState,
    rationale: params.rationale,
    relatedEvidenceIds: params.relatedEvidenceIds || [],
    schemaVersion: '1.0.0'
  }

  auditEventsList.unshift(event)
  persistToLocalStorage()
  return event
}

export const addAuditEvent = recordAuditEvent

export function getAuditEventsForCase(caseId: string): AuditEvent[] {
  hydrateFromLocalStorage()
  return auditEventsList.filter(e => e.caseId === caseId)
}

/**
 * Bersihkan seluruh state untuk pengujian isolasi bersih
 */
export function resetCaseStoreForTesting(): void {
  casesMap.clear()
  evidenceMap.clear()
  claimsMap.clear()
  relationsMap.clear()
  assessmentsMap.clear()
  draftsMap.clear()
  auditEventsList.length = 0
  caseSequence = 1
  isHydrated = false
  if (typeof window !== 'undefined' && window.localStorage) {
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k))
  }
}

export const clearInvestigationStore = resetCaseStoreForTesting

// ─── SPRINT 3: RESPONSE DRAFT LEDGER ───

export function addResponseDraft(draft: PublicResponseDraft): void {
  hydrateFromLocalStorage()
  draftsMap.set(draft.id, draft)

  recordAuditEvent({
    caseId: draft.caseId,
    entityType: 'DRAFT' as any,
    entityId: draft.id,
    eventType: 'DRAFT_CREATED' as any,
    operatorLabel: draft.reviewerActor || 'Local Operator',
    actor: draft.reviewerActor || 'Local Operator',
    newState: `Draf respons publik kanal ${draft.channelLabel} (Versi ${draft.version})`,
    rationale: `Generasi draf berbasis ${draft.referencedEvidenceIds.length} bukti terverifikasi`,
    relatedEvidenceIds: draft.referencedEvidenceIds
  })

  persistToLocalStorage()
}

export function getResponseDraftsForCase(caseId: string): PublicResponseDraft[] {
  hydrateFromLocalStorage()
  return Array.from(draftsMap.values())
    .filter(d => d.caseId === caseId)
    .sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt))
}

export function updateResponseDraftStatus(
  draftId: string,
  status: ResponseDraftStatus,
  reviewerNote?: string,
  reviewerActor = 'Local Operator'
): PublicResponseDraft | undefined {
  hydrateFromLocalStorage()
  const draft = draftsMap.get(draftId)
  if (!draft) return undefined

  const oldStatus = draft.status
  draft.status = status
  draft.reviewedAt = new Date().toISOString()
  draft.reviewerNote = reviewerNote
  draft.reviewerActor = reviewerActor

  recordAuditEvent({
    caseId: draft.caseId,
    entityType: 'DRAFT' as any,
    entityId: draft.id,
    eventType: 'DRAFT_STATUS_UPDATED' as any,
    operatorLabel: reviewerActor,
    actor: reviewerActor,
    previousState: `Status draf: ${oldStatus}`,
    newState: `Status draf: ${status}`,
    rationale: reviewerNote || `Pembaruan status review draf menjadi ${status}`,
    relatedEvidenceIds: draft.referencedEvidenceIds
  })

  persistToLocalStorage()
  return draft
}

// ─── SPRINT 3: CASCADE DELETION & REOPENING ───

export function deleteEvidenceRecord(evidenceId: string, actor = 'Local Operator', rationale?: string): boolean {
  hydrateFromLocalStorage()
  const ev = evidenceMap.get(evidenceId)
  if (!ev) return false

  evidenceMap.delete(evidenceId)

  // Cascade: Hapus relasi yang menunjuk bukti ini
  for (const [relId, rel] of relationsMap.entries()) {
    if (rel.evidenceId === evidenceId) {
      relationsMap.delete(relId)
    }
  }

  // Update klaim yang mengekstraksi bukti ini
  for (const cl of claimsMap.values()) {
    if (cl.extractedFromEvidenceIds.includes(evidenceId)) {
      cl.extractedFromEvidenceIds = cl.extractedFromEvidenceIds.filter(id => id !== evidenceId)
    }
  }

  recordAuditEvent({
    caseId: ev.caseId,
    entityType: 'EVIDENCE',
    entityId: evidenceId,
    eventType: 'EVIDENCE_DELETED' as any,
    operatorLabel: actor,
    actor,
    previousState: `Bukti ${ev.sourceLabel} (${ev.id})`,
    newState: 'DIHAPUS_DARI_LEDGER',
    rationale: rationale || 'Penghapusan berkas bukti atas instruksi operator / kontrol retensi'
  })

  persistToLocalStorage()
  return true
}

export function deleteInvestigationCase(caseId: string, actor = 'Local Operator', rationale?: string): boolean {
  hydrateFromLocalStorage()
  const c = casesMap.get(caseId)
  if (!c) return false

  // Cascade hapus semua elemen terkait kasus ini
  for (const [id, ev] of evidenceMap.entries()) {
    if (ev.caseId === caseId) evidenceMap.delete(id)
  }
  for (const [id, cl] of claimsMap.entries()) {
    if (cl.caseId === caseId) claimsMap.delete(id)
  }
  for (const [id, rel] of relationsMap.entries()) {
    if (rel.caseId === caseId) relationsMap.delete(id)
  }
  for (const [id, as] of assessmentsMap.entries()) {
    if (as.caseId === caseId) assessmentsMap.delete(id)
  }
  for (const [id, dr] of draftsMap.entries()) {
    if (dr.caseId === caseId) draftsMap.delete(id)
  }

  recordAuditEvent({
    caseId,
    entityType: 'CASE',
    entityId: caseId,
    eventType: 'CASE_DELETED' as any,
    operatorLabel: actor,
    actor,
    previousState: `Kasus ${c.caseNumber} - ${c.title}`,
    newState: 'KASUS_DAN_SELURUH_BUKTI_DIHAPUS',
    rationale: rationale || 'Penghapusan kasus permanen dengan konfirmasi operator lokal'
  })

  casesMap.delete(caseId)
  persistToLocalStorage()
  return true
}

export function reopenInvestigationCase(
  caseId: string,
  param2 = 'Terdapat perkembangan intelijen terbaru',
  param3 = 'Local Operator'
): InvestigationCase | undefined {
  hydrateFromLocalStorage()
  const c = casesMap.get(caseId)
  if (!c) return undefined

  // Deteksi fleksibel: (caseId, rationale, actor) vs (caseId, actor, rationale)
  const isSecondParamActor = param2.includes('Analis') || param2.includes('Sertu') || param2.includes('Operator')
  const actor = isSecondParamActor ? param2 : (param3 || 'Local Operator')
  const rationale = isSecondParamActor ? param3 : (param2 || 'Kasus dibuka kembali untuk penelaahan bukti baru')

  const oldStatus = c.status
  c.status = 'UNDER_REVIEW'
  c.updatedAt = new Date().toISOString()

  recordAuditEvent({
    caseId,
    entityType: 'CASE',
    entityId: caseId,
    eventType: 'CASE_UPDATED' as any,
    operatorLabel: actor,
    actor,
    previousState: `Status sebelumnya: ${oldStatus}`,
    newState: 'Status dibuka kembali: UNDER_REVIEW',
    rationale
  })

  persistToLocalStorage()
  return c
}

export function reverifyAllEvidenceForCase(caseId: string): {
  verifiedCount: number
  warningCount: number
  totalChecked: number
  results: Array<{ evidenceId: string; isTamperDetected: boolean }>
} {
  hydrateFromLocalStorage()
  const evList = getEvidenceRecordsForCase(caseId)
  let verifiedCount = 0
  let warningCount = 0
  const results: Array<{ evidenceId: string; isTamperDetected: boolean }> = []

  evList.forEach(ev => {
    const res = verifyEvidenceIntegrity(ev.id)
    results.push({ evidenceId: ev.id, isTamperDetected: res.isTamperDetected })
    if (res.isTamperDetected) {
      warningCount++
    } else {
      verifiedCount++
    }
  })

  return { verifiedCount, warningCount, totalChecked: evList.length, results }
}

export function exportCasePackageJson(caseId: string): string {
  hydrateFromLocalStorage()
  const c = casesMap.get(caseId)
  if (!c) throw new Error(`Kasus ${caseId} tidak ditemukan`)

  const evidence = getEvidenceRecordsForCase(caseId)
  const claims = getClaimsForCase(caseId)
  const relations = getRelationsForCase(caseId)
  const assessments = getAssessmentsForCase(caseId)
  const auditEvents = getAuditEventsForCase(caseId)
  const drafts = getResponseDraftsForCase(caseId)

  const pkg = {
    packageVersion: '1.0.0',
    exportedAt: new Date().toISOString(),
    investigationCase: c,
    evidence,
    claims,
    relations,
    assessments,
    auditEvents,
    drafts
  }

  return JSON.stringify(pkg, null, 2)
}

export function importCasePackageJson(jsonStr: string): {
  success: boolean
  caseId?: string
  error?: string
  summary?: {
    evidenceCount: number
    claimsCount: number
    relationsCount: number
    draftsCount: number
    auditEventsCount: number
    tamperWarnings: number
  }
} {
  hydrateFromLocalStorage()
  if (!jsonStr || typeof jsonStr !== 'string') {
    return { success: false, error: 'Paket kasus JSON tidak boleh kosong' }
  }

  // 1. Batas ukuran string paket (maks 25 MB)
  if (jsonStr.length > 25 * 1024 * 1024) {
    return { success: false, error: 'Ukuran paket kasus melebihi batas maksimal 25 MB' }
  }

  // 2. Proteksi prototype pollution pada string JSON mentah
  if (/"(?:__proto__|constructor|prototype)"\s*:/i.test(jsonStr)) {
    return { success: false, error: 'Injeksi prototype pollution terdeteksi dalam payload paket JSON' }
  }

  try {
    const pkg = JSON.parse(jsonStr)

    // 3. Validasi skema & versi paket
    if (pkg.packageVersion && pkg.packageVersion !== '1.0.0') {
      return { success: false, error: `Versi paket tidak didukung: ${pkg.packageVersion}. Versi yang didukung: 1.0.0` }
    }

    if (!pkg.investigationCase || typeof pkg.investigationCase !== 'object' || !pkg.investigationCase.id) {
      return { success: false, error: 'Format berkas paket kasus tidak valid: missing investigationCase.id' }
    }

    const c: InvestigationCase = pkg.investigationCase
    if (!c.caseNumber || !c.title) {
      return { success: false, error: 'Format kasus tidak valid: wajib memuat caseNumber dan title' }
    }

    // 4. Validasi batas jumlah rekaman (bounds enforcement)
    const evidenceArr = Array.isArray(pkg.evidence) ? pkg.evidence : []
    const claimsArr = Array.isArray(pkg.claims) ? pkg.claims : []
    const relationsArr = Array.isArray(pkg.relations) ? pkg.relations : []
    const assessmentsArr = Array.isArray(pkg.assessments) ? pkg.assessments : []
    const draftsArr = Array.isArray(pkg.drafts) ? pkg.drafts : []
    const auditArr = Array.isArray(pkg.auditEvents) ? pkg.auditEvents : []

    if (evidenceArr.length > 5000 || claimsArr.length > 1000 || relationsArr.length > 5000) {
      return { success: false, error: 'Batas jumlah rekaman paket terlampaui (maks 5000 bukti / 1000 klaim)' }
    }

    // 5. Ingestion bukti dengan verifikasi hash dan pelarangan auto-promote trust
    let tamperWarnings = 0
    evidenceArr.forEach((ev: EvidenceRecord) => {
      // Re-verifikasi hash bukti imported
      const textToVerify = (ev.extractedText || '').trim()
      const calculatedHash = fallbackSHA256(textToVerify)
      if (ev.contentHashNormalized && calculatedHash !== ev.contentHashNormalized) {
        tamperWarnings++
        ev.verificationStatus = 'REJECTED'
        ev.limitations = [
          ...(ev.limitations || []),
          'PERINGATAN: Digest hash tidak cocok pada saat impor paket. Integritas data dicurigai rusak/termodifikasi.'
        ]
      } else {
        // Kontrak Sprint 4 Gate 2.4: Jangan pernah meng-upgrade bukti impor ke VERIFIED secara otomatis jika bukan simulasi
        if (ev.evidenceMode !== 'SYNTHETIC_BENCHMARK' && ev.verificationStatus === 'VERIFIED') {
          ev.verificationStatus = 'UNDER_REVIEW'
        }
      }
      evidenceMap.set(ev.id, ev)
    })

    casesMap.set(c.id, c)
    claimsArr.forEach((cl: ClaimRecord) => claimsMap.set(cl.id, cl))
    relationsArr.forEach((rel: EvidenceRelation) => relationsMap.set(rel.id, rel))
    assessmentsArr.forEach((as: AssessmentRecord) => assessmentsMap.set(as.id, as))
    draftsArr.forEach((dr: PublicResponseDraft) => draftsMap.set(dr.id, dr))

    auditArr.forEach((ev: AuditEvent) => {
      if (!auditEventsList.some(e => e.eventId === ev.eventId)) {
        auditEventsList.push(ev)
      }
    })

    recordAuditEvent({
      caseId: c.id,
      entityType: 'CASE',
      entityId: c.id,
      eventType: 'CASE_UPDATED',
      operatorLabel: 'Local Operator (Package Importer)',
      previousState: 'IMPORT_PENDING',
      newState: `KASUS_DIIMPOR (${evidenceArr.length} bukti, ${claimsArr.length} klaim, ${tamperWarnings} peringatan hash)`,
      rationale: `Impor paket kasus ${c.caseNumber} versi ${pkg.packageVersion || '1.0.0'}`
    })

    persistToLocalStorage()
    return {
      success: true,
      caseId: c.id,
      summary: {
        evidenceCount: evidenceArr.length,
        claimsCount: claimsArr.length,
        relationsCount: relationsArr.length,
        draftsCount: draftsArr.length,
        auditEventsCount: auditArr.length,
        tamperWarnings
      }
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal mem-parsing paket kasus JSON' }
  }
}

/**
 * Verifikasi integritas bukti terhadap contentHash yang tersimpan
 */
export function verifyEvidenceIntegrity(evidenceId: string): {
  isValid: boolean
  isTamperDetected: boolean
  originalDigest: string
  computedDigest: string
} {
  hydrateFromLocalStorage()
  const rec = evidenceMap.get(evidenceId)
  if (!rec) {
    return {
      isValid: false,
      isTamperDetected: true,
      originalDigest: '',
      computedDigest: ''
    }
  }

  const computedDigest = fallbackSHA256(rec.extractedText.trim())
  const originalDigest = rec.contentHashNormalized
  const isTamperDetected = computedDigest !== originalDigest

  return {
    isValid: !isTamperDetected,
    isTamperDetected,
    originalDigest,
    computedDigest
  }
}
