/**
 * ════════════════════════════════════════════════════════════════════════════════════
 * NARADA — DETERMINISTIC SCENARIO REPLAY ENGINE
 * SPRINT 3: PACKAGE 3 (CHRONOLOGICAL AUDIT REPLAY & OFFLINE CASE REPLAY)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ════════════════════════════════════════════════════════════════════════════════════
 * 
 * Prinsip:
 * - Deterministic playback of stored NARADA case events and permitted evidence metadata.
 * - Bukan live crawler, bukan social-media history re-creator, bukan scraping baru.
 * - STRICT READ-ONLY: Replay tidak boleh memutasi state kasus, bukti, atau klaim.
 * - Zero network requests: Seluruh data bersumber dari jejak audit dan penyimpanan lokal.
 * - Memisahkan secara ketat caseEventAt (waktu aksi operasional lokal) vs sourcePublishedAt (stempel waktu publikasi asli).
 * - Pemisahan mode yang tegas:
 *   1. CASE_HISTORY_REPLAY: Kasus operasional nyata berbasis jejak audit lokal.
 *   2. SYNTHETIC_BENCHMARK_REPLAY: Uji simulasi dengan watermark permanen yang tidak dapat dihilangkan.
 * ════════════════════════════════════════════════════════════════════════════════════
 */

import {
  getInvestigationCase,
  getAuditEventsForCase,
  getEvidenceRecordsForCase,
  getResponseDraftsForCase
} from './case-store.ts'

import type {
  ScenarioReplaySession,
  ReplayTimelineEvent,
  ReplayMode,
  AuditEvent
} from './investigation-types.ts'

/**
 * Filter event replay berdasarkan tipe entitas atau kategori aksi
 */
export function filterReplayEvents(
  events: ReplayTimelineEvent[],
  filterType?: string
): ReplayTimelineEvent[] {
  if (!filterType || filterType === 'ALL') {
    return events
  }
  const target = filterType.toUpperCase()
  return events.filter(e => e.entityType === target || e.eventType.includes(target))
}

/**
 * Menghitung interval kecepatan pemutaran (visualisasi)
 */
export function calculateIntervalMs(speed: 1 | 2 | 4): number {
  switch (speed) {
    case 4:
      return 375
    case 2:
      return 750
    case 1:
    default:
      return 1500
  }
}

/**
 * Membangun sesi replay dari jejak audit lokal secara deterministik
 * Jaminan: Read-only, zero network fetch, tidak memodifikasi data kasus/bukti.
 */
export function buildScenarioReplaySession(
  caseId: string,
  options?: {
    eventFilter?: string
    playbackSpeed?: 1 | 2 | 4
  }
): ScenarioReplaySession {
  const invCase = getInvestigationCase(caseId)
  if (!invCase) {
    throw new Error(`Kasus investigasi dengan ID ${caseId} tidak ditemukan untuk inisialisasi Scenario Replay`)
  }

  const rawAuditEvents = getAuditEventsForCase(caseId)
  const evidenceList = getEvidenceRecordsForCase(caseId)
  const draftsList = getResponseDraftsForCase(caseId)

  // Map untuk lookup metadata sumber bukti
  const evidenceMap = new Map(evidenceList.map(e => [e.id, e]))

  const isSimulation = invCase.isSimulation || invCase.mode === 'SYNTHETIC_BENCHMARK'
  const mode: ReplayMode = isSimulation ? 'SYNTHETIC_BENCHMARK_REPLAY' : 'CASE_HISTORY_REPLAY'
  const watermark = isSimulation
    ? (invCase.simulationWatermark || 'SIMULASI — BENCHMARK SINTETIS — BUKAN PERISTIWA NYATA')
    : undefined

  // Bangun timeline event dari jejak audit
  const timelineEvents: ReplayTimelineEvent[] = rawAuditEvents.map((audit: AuditEvent) => {
    let sourcePublishedAt: string | undefined = undefined
    let sourceObservedAt: string | undefined = undefined
    let title = ''
    let isSyntheticEvent = isSimulation

    // Cek keterkaitan dengan bukti untuk mengekstrak stempel waktu sumber (bukan caseEventAt)
    if (audit.entityType === 'EVIDENCE') {
      const ev = evidenceMap.get(audit.entityId)
      if (ev) {
        if (ev.sourceTimestampProvenance !== 'NO_SOURCE_TIMESTAMP') {
          sourcePublishedAt = ev.sourcePublishedAt
        }
        sourceObservedAt = ev.observedAt || ev.submittedAt
        if (ev.evidenceMode === 'SYNTHETIC_BENCHMARK') {
          isSyntheticEvent = true
        }
      }
    }

    // Pembuatan judul human-readable berdasarkan tipe audit
    switch (audit.eventType) {
      case 'CASE_CREATED':
        title = 'Kasus Investigasi Diinisiasi'
        break
      case 'CASE_UPDATED':
        title = 'Status Siklus Hidup Kasus Diperbarui'
        break
      case 'EVIDENCE_SUBMITTED':
        title = 'Bukti Digital Baru Didaftarkan'
        break
      case 'EVIDENCE_REDACTED':
        title = 'Sanitasi Privasi Diterapkan pada Bukti'
        break
      case 'EVIDENCE_VERIFICATION_CHANGED':
        title = 'Verifikasi Integritas Hash Bukti Diperbarui'
        break
      case 'CLAIM_CREATED':
        title = 'Klaim Faktual Baru Diidentifikasi'
        break
      case 'CLAIM_UPDATED':
        title = 'Redaksi Klaim Diperbarui'
        break
      case 'RELATION_CREATED':
        title = 'Relasi Bukti Dikaitkan ke Klaim'
        break
      case 'RELATION_UPDATED':
        title = 'Karakter Relasi Bukti Diubah'
        break
      case 'ASSESSMENT_REVIEWED':
        title = 'Vonis Asesmen Analis Ditetapkan'
        break
      case 'CASE_ARCHIVED':
        title = 'Kasus Ditutup / Diarsipkan'
        break
      default:
        title = `Aksi Jejak Audit: ${audit.eventType}`
        break
    }

    const summary = audit.rationale || audit.newState || audit.previousState || `${audit.operatorLabel} mengeksekusi ${audit.eventType}`

    return {
      id: `RPL-${audit.eventId}`,
      eventId: audit.eventId,
      caseId: audit.caseId,
      eventType: audit.eventType,
      caseEventAt: audit.timestamp, // WAKTU AKSI LOKAL OPERASIONAL
      sourcePublishedAt,           // WAKTU SUMBER LUAR (BILA ADA)
      sourceObservedAt,            // WAKTU PERTAMA DITANGKAP NARADA
      actorLabel: audit.operatorLabel || 'Local Operator',
      entityType: audit.entityType,
      entityId: audit.entityId,
      title,
      summary,
      previousState: audit.previousState,
      newState: audit.newState,
      referencedEvidenceIds: audit.relatedEvidenceIds || [],
      isSynthetic: isSyntheticEvent
    }
  })

  // Jika ada draf tanggapan yang tercatat, tambahkan sebagai event replay
  draftsList.forEach(draft => {
    timelineEvents.push({
      id: `RPL-DRAFT-${draft.id}`,
      eventId: `EV-DRAFT-${draft.id}`,
      caseId: draft.caseId,
      eventType: 'RESPONSE_DRAFT_GENERATED',
      caseEventAt: draft.generatedAt,
      actorLabel: draft.reviewerActor || 'Local Operator',
      entityType: 'DRAFT',
      entityId: draft.id,
      title: `Draf Tanggapan Dibuat (${draft.channelLabel})`,
      summary: `Versi ${draft.version} dibuat dengan status: ${draft.status}. Wajib penelaahan manusia.`,
      referencedEvidenceIds: draft.referencedEvidenceIds,
      isSynthetic: isSimulation
    })

    if (draft.reviewedAt) {
      timelineEvents.push({
        id: `RPL-DRAFT-REV-${draft.id}`,
        eventId: `EV-DRAFT-REV-${draft.id}`,
        caseId: draft.caseId,
        eventType: 'RESPONSE_DRAFT_REVIEWED',
        caseEventAt: draft.reviewedAt,
        actorLabel: draft.reviewerActor || 'Local Operator',
        entityType: 'DRAFT',
        entityId: draft.id,
        title: `Penelaahan Draf Tanggapan Selesai`,
        summary: `Status akhir: ${draft.status}. Catatan: ${draft.reviewerNote || 'Disetujui di tingkat prototipe lokal'}`,
        referencedEvidenceIds: draft.referencedEvidenceIds,
        isSynthetic: isSimulation
      })
    }
  })

  // Pengurutan Deterministik Kronologis (Earliest to Latest berdasarkan caseEventAt)
  // Tie-breaker: Jika waktu persis sama, gunakan id untuk urutan stabil deterministik
  timelineEvents.sort((a, b) => {
    const timeA = Date.parse(a.caseEventAt) || 0
    const timeB = Date.parse(b.caseEventAt) || 0
    if (timeA !== timeB) {
      return timeA - timeB
    }
    return a.id.localeCompare(b.id)
  })

  // Terapkan filter jika diminta
  const filteredEvents = filterReplayEvents(timelineEvents, options?.eventFilter)

  const session: ScenarioReplaySession = {
    sessionId: `REPLAY-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    caseId,
    caseNumber: invCase.caseNumber,
    mode,
    watermark,
    events: filteredEvents,
    totalEvents: filteredEvents.length,
    currentStepIndex: filteredEvents.length > 0 ? 0 : -1,
    playbackState: 'PAUSED',
    playbackSpeed: options?.playbackSpeed || 1,
    eventFilter: options?.eventFilter || 'ALL',
    builtAt: new Date().toISOString()
  }

  return session
}

/**
 * Pure transition helper: Maju satu langkah (Step Forward)
 */
export function stepForward(session: ScenarioReplaySession): ScenarioReplaySession {
  if (session.totalEvents === 0) return session
  const nextIndex = Math.min(session.currentStepIndex + 1, session.totalEvents - 1)
  const isEnd = nextIndex === session.totalEvents - 1
  return {
    ...session,
    currentStepIndex: nextIndex,
    playbackState: isEnd ? 'ENDED' : session.playbackState
  }
}

/**
 * Pure transition helper: Mundur satu langkah (Step Backward)
 */
export function stepBackward(session: ScenarioReplaySession): ScenarioReplaySession {
  if (session.totalEvents === 0) return session
  const prevIndex = Math.max(session.currentStepIndex - 1, 0)
  return {
    ...session,
    currentStepIndex: prevIndex,
    playbackState: 'PAUSED'
  }
}

/**
 * Pure transition helper: Lompat ke langkah spesifik (Scrubber)
 */
export function jumpToStep(session: ScenarioReplaySession, stepIndex: number): ScenarioReplaySession {
  if (session.totalEvents === 0) return session
  const clampedIndex = Math.max(0, Math.min(stepIndex, session.totalEvents - 1))
  return {
    ...session,
    currentStepIndex: clampedIndex,
    playbackState: clampedIndex === session.totalEvents - 1 ? 'ENDED' : 'PAUSED'
  }
}

/**
 * Pure transition helper: Ubah status pemutaran (Play / Pause / Ended)
 */
export function setPlaybackState(
  session: ScenarioReplaySession,
  playbackState: 'PAUSED' | 'PLAYING' | 'ENDED'
): ScenarioReplaySession {
  // Jika play dari akhir, mulai kembali dari 0
  if (playbackState === 'PLAYING' && session.currentStepIndex >= session.totalEvents - 1) {
    return {
      ...session,
      currentStepIndex: 0,
      playbackState: 'PLAYING'
    }
  }
  return {
    ...session,
    playbackState
  }
}

/**
 * Pure transition helper: Ubah kecepatan pemutaran (1x, 2x, 4x)
 */
export function setPlaybackSpeed(
  session: ScenarioReplaySession,
  playbackSpeed: 1 | 2 | 4
): ScenarioReplaySession {
  return {
    ...session,
    playbackSpeed
  }
}
