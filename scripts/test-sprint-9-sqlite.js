/**
 * ════════════════════════════════════════════════════════════════════════════════════
 * NARADA — SPRINT 9 REAL SQLITE PERSISTENCE & TRANSACTIONAL INTEGRITY SUITE
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ════════════════════════════════════════════════════════════════════════════════════
 */

import fs from 'node:fs'
import path from 'node:path'
import {
  initSqliteDatabase,
  closeSqliteDatabase,
  getDatabaseStatus,
  saveInvestigationCase,
  getInvestigationCase,
  deleteInvestigationCase,
  saveEvidenceRecord,
  getEvidenceRecords,
  deleteEvidenceRecord,
  saveCommentBatch,
  getCommentBatches,
  saveCommentRecords,
  getCommentRecords,
  saveCommentAnalysisRun,
  getCommentAnalysisRuns,
  saveCommentReviewAnnotation,
  getCommentReviewAnnotations,
  createDatabaseBackup,
  checkDatabaseIntegrity
} from '../electron/sqlite-service.cjs'

let totalAssertions = 0
let passedAssertions = 0
let failedAssertions = 0

function assert(condition, code, message) {
  totalAssertions++
  if (condition) {
    passedAssertions++
    console.log(`  ✅ PASS: [${code}] ${message}`)
  } else {
    failedAssertions++
    console.error(`  ❌ FAIL: [${code}] ${message}`)
  }
}

async function runSqliteDeepSuite() {
  console.log('══════════════════════════════════════════════════════════════════════')
  console.log('🛡️  NARADA — SPRINT 9 REAL SQLITE TRANSACTION & DURABILITY SUITE')
  console.log('══════════════════════════════════════════════════════════════════════\n')

  const TMP_DIR = path.join(process.cwd(), 'temp_test_sprint9_sqlite')
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true })
  const dbFile = path.join(TMP_DIR, 'durability_test.sqlite3')
  if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile)

  // 1. Initial State & In-Disk Creation
  const initRes = initSqliteDatabase(dbFile)
  assert(initRes.success === true, 'S9-SQLITE-01.1', 'Database file successfully created on disk')
  assert(fs.existsSync(dbFile), 'S9-SQLITE-01.2', 'Physical sqlite3 file exists on filesystem')

  const status = getDatabaseStatus()
  assert(status.status === 'PERSISTED', 'S9-SQLITE-02.1', 'Status reports PERSISTED on active disk connection')
  assert(status.isMemory === false, 'S9-SQLITE-02.2', 'isMemory is false for durable disk database')

  const integrity = checkDatabaseIntegrity()
  assert(integrity.ok === true && integrity.result === 'ok', 'S9-SQLITE-03.1', 'PRAGMA integrity_check returns ok')

  // 2. Cascade Deletion & Foreign Key Integrity
  const caseA = {
    id: 'CASE-CASCADE-A',
    caseNumber: 'NAR-2026-8888',
    title: 'Uji Penghapusan Bertingkat',
    summary: 'Pengujian integritas foreign key ON DELETE CASCADE',
    status: 'ACTIVE',
    mode: 'LIVE_OPERATIONAL',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  saveInvestigationCase(caseA)

  const evA = {
    id: 'EVD-CASCADE-A',
    caseId: caseA.id,
    sourceUrl: 'https://example.com/a',
    captureTimestamp: new Date().toISOString(),
    extractionMethod: 'MANUAL_BROWSER_CAPTURE',
    manifestSha256: 'cascadehash123',
    integrityStatus: 'VERIFIED'
  }
  saveEvidenceRecord(evA)

  const batchA = {
    id: 'BAT-CASCADE-A',
    caseId: caseA.id,
    batchLabel: 'Batch Cascade',
    intakeMethod: 'MANUAL_ENTRY',
    recordCount: 1,
    totalCharacters: 20,
    createdAt: new Date().toISOString()
  }
  saveCommentBatch(batchA)

  const runA = {
    id: 'RUN-CASCADE-A',
    batchId: batchA.id,
    caseId: caseA.id,
    createdAt: new Date().toISOString(),
    algorithmVersion: '1.0.0'
  }
  saveCommentAnalysisRun(runA)

  const annA = {
    id: 'REV-CASCADE-A',
    runId: runA.id,
    caseId: caseA.id,
    targetType: 'COMMENT',
    targetId: 'CR-1',
    reviewStatus: 'CONFIRMED_SIGNAL',
    reviewedAt: new Date().toISOString()
  }
  saveCommentReviewAnnotation(annA)

  // Verify before delete
  assert(getEvidenceRecords(caseA.id).length === 1, 'S9-SQLITE-04.1', 'Evidence record linked to caseA')
  assert(getCommentBatches(caseA.id).length === 1, 'S9-SQLITE-04.2', 'Comment batch linked to caseA')
  assert(getCommentAnalysisRuns(batchA.id).length === 1, 'S9-SQLITE-04.3', 'Analysis run linked to batchA')
  assert(getCommentReviewAnnotations(runA.id, caseA.id).length === 1, 'S9-SQLITE-04.4', 'Annotation linked to runA and caseA')

  // Delete caseA -> Cascade should wipe child records
  deleteInvestigationCase(caseA.id)
  assert(getInvestigationCase(caseA.id) === null, 'S9-SQLITE-05.1', 'Case deleted from database')
  assert(getEvidenceRecords(caseA.id).length === 0, 'S9-SQLITE-05.2', 'Linked evidence cascade deleted')
  assert(getCommentBatches(caseA.id).length === 0, 'S9-SQLITE-05.3', 'Linked comment batch cascade deleted')
  assert(getCommentAnalysisRuns(batchA.id).length === 0, 'S9-SQLITE-05.4', 'Linked analysis run cascade deleted')
  assert(getCommentReviewAnnotations(runA.id, caseA.id).length === 0, 'S9-SQLITE-05.5', 'Linked annotation cascade deleted')

  // 3. Batch Records Performance
  const caseB = {
    id: 'CASE-PERF-B',
    caseNumber: 'NAR-2026-9999',
    title: 'Uji Kinerja Batch Komentar',
    summary: 'Pengujian bulk write 500 komentar',
    status: 'ACTIVE',
    mode: 'LIVE_OPERATIONAL',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  saveInvestigationCase(caseB)

  const batchB = {
    id: 'BAT-PERF-B',
    caseId: caseB.id,
    batchLabel: 'Batch 500 Komentar',
    intakeMethod: 'CSV_IMPORT',
    recordCount: 500,
    totalCharacters: 25000,
    createdAt: new Date().toISOString()
  }
  saveCommentBatch(batchB)

  const bulkComments = []
  for (let i = 0; i < 500; i++) {
    bulkComments.push({
      id: `CR-BULK-${i}`,
      batchId: batchB.id,
      caseId: caseB.id,
      rawText: `Komentar nomor ${i} tentang pertahanan siber nasional.`,
      normalizedText: `komentar nomor ${i} tentang pertahanan siber nasional.`,
      authorHandle: `@analis_${i}`,
      timestamp: new Date().toISOString()
    })
  }

  const t0 = Date.now()
  const insertRes = saveCommentRecords(bulkComments)
  const bulkElapsed = Date.now() - t0

  assert(insertRes.success === true && insertRes.inserted === 500, 'S9-SQLITE-06.1', '500 records inserted in single transaction')
  assert(bulkElapsed < 250, 'S9-SQLITE-06.2', `500 comments written to disk in ${bulkElapsed}ms (< 250ms budget)`)

  const readBack = getCommentRecords(batchB.id)
  assert(readBack.length === 500, 'S9-SQLITE-07.1', 'All 500 comments retrieved accurately by batchId')

  // 4. Atomic Backup Verification
  const backupPath = path.join(TMP_DIR, 'durable_backup.sqlite3')
  const backupInfo = createDatabaseBackup(backupPath)
  assert(backupInfo.success === true, 'S9-SQLITE-08.1', 'Backup succeeded via VACUUM INTO')
  assert(fs.existsSync(backupPath), 'S9-SQLITE-08.2', 'Backup file exists on disk')
  assert(backupInfo.sizeBytes > 0, 'S9-SQLITE-08.3', 'Backup file has non-zero size')

  // Clean up
  closeSqliteDatabase()
  try {
    fs.rmSync(TMP_DIR, { recursive: true, force: true })
  } catch (e) {
    // ignore
  }

  console.log('\n══════════════════════════════════════════════════════════════════════')
  console.log(`🎯 TOTAL ASSERTIONS REAL SQLITE: ${totalAssertions}`)
  console.log(`   ✅ PASS: ${passedAssertions}`)
  console.log(`   ❌ FAIL: ${failedAssertions}`)
  console.log('══════════════════════════════════════════════════════════════════════\n')

  if (failedAssertions > 0) process.exit(1)
  process.exit(0)
}

runSqliteDeepSuite().catch(err => {
  console.error('Fatal error in SQLite suite:', err)
  process.exit(1)
})

