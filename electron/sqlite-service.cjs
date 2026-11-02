/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA SECURE SQLITE ENGINE & LOCAL REPOSITORY SERVICE
 * SPRINT 9: WORK PACKAGE B (SQLITE CONSOLIDATION & PERSISTENCE SOVEREIGNTY)
 * PUSSIBERAD TNI AD × CODEPOLITAN — KARTIKA CYBER HACKATHON 2026
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Arsitektur:
 * - Dimiliki 100% oleh Electron Main Process (process.type === 'browser')
 * - Renderer dilarang mengeksekusi arbitrary SQL (Zero executeSql / runQuery)
 * - Transaksi terproteksi ACID, WAL mode, synchronous=NORMAL, foreign_keys=ON
 * - Penyimpanan default: app.getPath('userData') / narada_tactical.sqlite3
 * ══════════════════════════════════════════════════════════════════════════
 */

const { DatabaseSync } = require('node:sqlite')
const path = require('node:path')
const fs = require('node:fs')

let db = null
let currentDbPath = null
let isDegradedMemory = false
let lastError = null

// Skema Migrasi Versi 1 (Sprint 9 Initial SQLite)
const CURRENT_SCHEMA_VERSION = 1

/**
 * Inisialisasi Database SQLite
 */
function initSqliteDatabase(customPath = null) {
  try {
    if (db) {
      return { success: true, dbPath: currentDbPath, restored: false }
    }

    let targetPath = customPath
    if (!targetPath) {
      // Dapatkan path userData dari Electron jika tersedia
      let userDataDir = process.cwd()
      try {
        const { app } = require('electron')
        if (app && typeof app.getPath === 'function') {
          userDataDir = app.getPath('userData')
        }
      } catch {
        // Fallback ke CWD untuk node runtime test
      }
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true })
      }
      targetPath = path.join(userDataDir, 'narada_tactical.sqlite3')
    }

    if (targetPath !== ':memory:') {
      const dir = path.dirname(targetPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }

    db = new DatabaseSync(targetPath)
    currentDbPath = targetPath
    isDegradedMemory = targetPath === ':memory:'

    // Konfigurasi Pragma Kinerja & Integritas Forensik
    db.exec('PRAGMA foreign_keys = ON;')
    if (targetPath !== ':memory:') {
      db.exec('PRAGMA journal_mode = WAL;')
      db.exec('PRAGMA synchronous = NORMAL;')
    }
    db.exec('PRAGMA busy_timeout = 5000;')

    // Terapkan Skema Tabel
    applyDatabaseSchema()

    lastError = null
    return { success: true, dbPath: currentDbPath, isMemory: isDegradedMemory }
  } catch (err) {
    console.error('[NARADA SQLite] Inisialisasi gagal:', err)
    lastError = err.message
    db = null
    isDegradedMemory = true
    return { success: false, error: err.message, degraded: true }
  }
}

/**
 * Pembuatan Skema Tabel Terkelola & Berelasi
 */
function applyDatabaseSchema() {
  if (!db) throw new Error('Database not initialized')

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS investigation_cases (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT,
      status TEXT NOT NULL,
      mode TEXT NOT NULL,
      case_number TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      data_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cases_status ON investigation_cases(status);
    CREATE INDEX IF NOT EXISTS idx_cases_mode ON investigation_cases(mode);

    CREATE TABLE IF NOT EXISTS investigation_analyses (
      id TEXT PRIMARY KEY,
      case_id TEXT,
      threat_level TEXT,
      category TEXT,
      created_at TEXT NOT NULL,
      data_json TEXT NOT NULL,
      FOREIGN KEY(case_id) REFERENCES investigation_cases(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_analyses_case ON investigation_analyses(case_id);

    CREATE TABLE IF NOT EXISTS radar_cache (
      id TEXT PRIMARY KEY,
      cluster TEXT,
      fetched_at TEXT,
      data_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_radar_cluster ON radar_cache(cluster);

    CREATE TABLE IF NOT EXISTS radar_topic_candidates (
      id TEXT PRIMARY KEY,
      state TEXT,
      matched_domain TEXT,
      last_observed_at TEXT,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS radar_issue_activity_snapshots (
      id TEXT PRIMARY KEY,
      cluster_id TEXT,
      timestamp TEXT,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS radar_source_run_logs (
      id TEXT PRIMARY KEY,
      source_id TEXT,
      timestamp TEXT,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evidence_records (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      source_url TEXT NOT NULL,
      capture_timestamp TEXT NOT NULL,
      extraction_method TEXT NOT NULL,
      screenshot_sha256 TEXT,
      manifest_sha256 TEXT NOT NULL,
      integrity_status TEXT NOT NULL,
      data_json TEXT NOT NULL,
      FOREIGN KEY(case_id) REFERENCES investigation_cases(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_evidence_case ON evidence_records(case_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_manifest ON evidence_records(manifest_sha256);

    CREATE TABLE IF NOT EXISTS evidence_artifacts (
      id TEXT PRIMARY KEY,
      evidence_id TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      file_path TEXT,
      artifact_data TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(evidence_id) REFERENCES evidence_records(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_artifacts_evidence ON evidence_artifacts(evidence_id);

    CREATE TABLE IF NOT EXISTS comment_batches (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      batch_label TEXT NOT NULL,
      intake_method TEXT NOT NULL,
      record_count INTEGER NOT NULL,
      total_characters INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      data_json TEXT NOT NULL,
      FOREIGN KEY(case_id) REFERENCES investigation_cases(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_batches_case ON comment_batches(case_id);

    CREATE TABLE IF NOT EXISTS comment_records (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      case_id TEXT NOT NULL,
      raw_text TEXT NOT NULL,
      normalized_text TEXT NOT NULL,
      author_handle TEXT,
      timestamp TEXT,
      data_json TEXT NOT NULL,
      FOREIGN KEY(batch_id) REFERENCES comment_batches(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_comments_batch ON comment_records(batch_id);
    CREATE INDEX IF NOT EXISTS idx_comments_case ON comment_records(case_id);

    CREATE TABLE IF NOT EXISTS comment_analysis_runs (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      case_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      algorithm_version TEXT NOT NULL,
      data_json TEXT NOT NULL,
      FOREIGN KEY(batch_id) REFERENCES comment_batches(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_runs_batch ON comment_analysis_runs(batch_id);
    CREATE INDEX IF NOT EXISTS idx_runs_case ON comment_analysis_runs(case_id);

    CREATE TABLE IF NOT EXISTS comment_review_annotations (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      case_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      review_status TEXT NOT NULL,
      reviewer_note TEXT,
      reviewed_at TEXT NOT NULL,
      data_json TEXT NOT NULL,
      FOREIGN KEY(run_id) REFERENCES comment_analysis_runs(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_annotations_run ON comment_review_annotations(run_id);
    CREATE INDEX IF NOT EXISTS idx_annotations_case ON comment_review_annotations(case_id);
  `)

  // Catat Migrasi Skema
  const stmt = db.prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at, description) VALUES (?, ?, ?)')
  stmt.run(CURRENT_SCHEMA_VERSION, new Date().toISOString(), 'Sprint 9 Unified Tactical SQLite Schema')
}

/**
 * Menutup Koneksi Database
 */
function closeSqliteDatabase() {
  if (db) {
    try {
      db.close()
    } catch (e) {
      console.error('[NARADA SQLite] Error closing db:', e)
    }
    db = null
  }
}

/**
 * Mengambil Status Kesehatan Penyimpanan (PERSISTED | DEGRADED | FAILED)
 */
function getDatabaseStatus() {
  if (!db) {
    return {
      status: lastError ? 'FAILED' : 'DEGRADED',
      engine: 'NONE',
      dbPath: currentDbPath,
      lastError,
      recordCounts: {}
    }
  }

  try {
    const counts = {
      cases: db.prepare('SELECT count(*) as count FROM investigation_cases').get().count,
      evidence: db.prepare('SELECT count(*) as count FROM evidence_records').get().count,
      artifacts: db.prepare('SELECT count(*) as count FROM evidence_artifacts').get().count,
      commentBatches: db.prepare('SELECT count(*) as count FROM comment_batches').get().count,
      commentRecords: db.prepare('SELECT count(*) as count FROM comment_records').get().count,
      commentRuns: db.prepare('SELECT count(*) as count FROM comment_analysis_runs').get().count,
      radarItems: db.prepare('SELECT count(*) as count FROM radar_cache').get().count,
    }

    return {
      status: isDegradedMemory ? 'DEGRADED' : 'PERSISTED',
      engine: 'SQLITE',
      dbPath: currentDbPath,
      isMemory: isDegradedMemory,
      lastError: null,
      recordCounts: counts
    }
  } catch (err) {
    return {
      status: 'FAILED',
      engine: 'SQLITE',
      dbPath: currentDbPath,
      lastError: err.message,
      recordCounts: {}
    }
  }
}

/**
 * Memeriksa Apakah Migrasi dari IndexedDB v4 Telah Selesai
 */
function isMigrationCompleted() {
  if (!db) return false
  try {
    const row = db.prepare('SELECT value FROM app_metadata WHERE key = ?').get('migration_v4_sqlite_completed')
    return Boolean(row && row.value === 'true')
  } catch {
    return false
  }
}

/**
 * Impor Dump Transaksional dari IndexedDB v4
 */
function importDumpFromIndexedDB(dump) {
  if (!db) throw new Error('Database not initialized')
  if (!dump || typeof dump !== 'object') throw new Error('Invalid dump data')

  const stats = {
    casesImported: 0,
    evidenceImported: 0,
    commentBatchesImported: 0,
    commentRecordsImported: 0,
    commentRunsImported: 0,
    commentAnnotationsImported: 0,
    radarItemsImported: 0,
    topicCandidatesImported: 0,
  }

  try {
    // Jalankan dalam Transaksi Tunggal ACID
    db.exec('BEGIN TRANSACTION;')

    // 1. Kasus Investigasi
    if (Array.isArray(dump.investigation_cases)) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO investigation_cases (id, title, summary, status, mode, case_number, created_by, created_at, updated_at, data_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const c of dump.investigation_cases) {
        if (!c.id) continue
        stmt.run(
          c.id,
          c.title || 'Untitled Case',
          c.summary || '',
          c.status || 'ACTIVE',
          c.mode || 'LIVE_OPERATIONAL',
          c.caseNumber || '',
          c.createdByLocalOperator || '',
          c.createdAt || new Date().toISOString(),
          c.updatedAt || new Date().toISOString(),
          JSON.stringify(c)
        )
        stats.casesImported++
      }
    }

    // 2. Rekaman Bukti Forensik
    if (Array.isArray(dump.evidence_records)) {
      const stmtEv = db.prepare(`
        INSERT OR REPLACE INTO evidence_records (id, case_id, source_url, capture_timestamp, extraction_method, screenshot_sha256, manifest_sha256, integrity_status, data_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const ev of dump.evidence_records) {
        if (!ev.id || !ev.caseId) continue
        stmtEv.run(
          ev.id,
          ev.caseId,
          ev.sourceUrl || '',
          ev.captureTimestamp || new Date().toISOString(),
          ev.extractionMethod || 'MANUAL_BROWSER_CAPTURE',
          ev.screenshotSha256 || null,
          ev.manifestSha256 || '',
          ev.integrityStatus || 'UNVERIFIED',
          JSON.stringify(ev)
        )
        stats.evidenceImported++
      }
    }

    // 3. Artefak Bukti Biner / Screenshot
    if (Array.isArray(dump.evidence_artifacts)) {
      const stmtArt = db.prepare(`
        INSERT OR REPLACE INTO evidence_artifacts (id, evidence_id, mime_type, size_bytes, sha256, file_path, artifact_data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const art of dump.evidence_artifacts) {
        if (!art.id || !art.evidenceId) continue
        stmtArt.run(
          art.id,
          art.evidenceId,
          art.mimeType || 'image/png',
          art.sizeBytes || 0,
          art.sha256 || '',
          art.filePath || null,
          art.artifactData || art.dataUrl || null,
          art.createdAt || new Date().toISOString()
        )
      }
    }

    // 4. Batch Komentar
    if (Array.isArray(dump.comment_batches)) {
      const stmtBat = db.prepare(`
        INSERT OR REPLACE INTO comment_batches (id, case_id, batch_label, intake_method, record_count, total_characters, created_at, data_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const b of dump.comment_batches) {
        if (!b.id || !b.caseId) continue
        stmtBat.run(
          b.id,
          b.caseId,
          b.batchLabel || 'Batch Komentar',
          b.intakeMethod || 'MANUAL_ENTRY',
          b.recordCount || 0,
          b.totalCharacters || 0,
          b.createdAt || new Date().toISOString(),
          JSON.stringify(b)
        )
        stats.commentBatchesImported++
      }
    }

    // 5. Rekaman Komentar
    if (Array.isArray(dump.comment_records)) {
      const stmtRec = db.prepare(`
        INSERT OR REPLACE INTO comment_records (id, batch_id, case_id, raw_text, normalized_text, author_handle, timestamp, data_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const r of dump.comment_records) {
        if (!r.id || !r.batchId) continue
        stmtRec.run(
          r.id,
          r.batchId,
          r.caseId || '',
          r.rawText || '',
          r.normalizedText || '',
          r.authorHandle || null,
          r.timestamp || null,
          JSON.stringify(r)
        )
        stats.commentRecordsImported++
      }
    }

    // 6. Analysis Runs
    if (Array.isArray(dump.comment_analysis_runs)) {
      const stmtRun = db.prepare(`
        INSERT OR REPLACE INTO comment_analysis_runs (id, batch_id, case_id, created_at, algorithm_version, data_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      for (const r of dump.comment_analysis_runs) {
        if (!r.id || !r.batchId) continue
        stmtRun.run(
          r.id,
          r.batchId,
          r.caseId || '',
          r.createdAt || new Date().toISOString(),
          r.algorithmVersion || '1.0.0',
          JSON.stringify(r)
        )
        stats.commentRunsImported++
      }
    }

    // 7. Review Annotations
    if (Array.isArray(dump.comment_review_annotations)) {
      const stmtAnn = db.prepare(`
        INSERT OR REPLACE INTO comment_review_annotations (id, run_id, case_id, target_type, target_id, review_status, reviewer_note, reviewed_at, data_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const a of dump.comment_review_annotations) {
        if (!a.id || !a.runId) continue
        stmtAnn.run(
          a.id,
          a.runId,
          a.caseId || '',
          a.targetType || 'COMMENT',
          a.targetId || '',
          a.reviewStatus || 'UNREVIEWED',
          a.reviewerNote || null,
          a.reviewedAt || new Date().toISOString(),
          JSON.stringify(a)
        )
        stats.commentAnnotationsImported++
      }
    }

    // 8. Radar Cache Items
    if (Array.isArray(dump.radar_cache)) {
      const stmtRad = db.prepare(`
        INSERT OR REPLACE INTO radar_cache (id, cluster, fetched_at, data_json)
        VALUES (?, ?, ?, ?)
      `)
      for (const item of dump.radar_cache) {
        if (!item.id) continue
        stmtRad.run(
          item.id,
          item.cluster || null,
          item.fetchedAt ? new Date(item.fetchedAt).toISOString() : new Date().toISOString(),
          JSON.stringify(item)
        )
        stats.radarItemsImported++
      }
    }

    // Tandai Migrasi Berhasil di app_metadata
    const metaStmt = db.prepare('INSERT OR REPLACE INTO app_metadata (key, value, updated_at) VALUES (?, ?, ?)')
    metaStmt.run('migration_v4_sqlite_completed', 'true', new Date().toISOString())
    metaStmt.run('migration_v4_sqlite_timestamp', new Date().toISOString(), new Date().toISOString())

    db.exec('COMMIT;')
    return { success: true, stats }
  } catch (err) {
    db.exec('ROLLBACK;')
    console.error('[NARADA SQLite] Rollback migrasi karena error:', err)
    throw err
  }
}

/**
 * Operasi CRUD Kasus Investigasi
 */
function saveInvestigationCase(caseData) {
  if (!db) throw new Error('Database not initialized')
  if (!caseData || !caseData.id) throw new Error('Invalid case data')

  const now = new Date().toISOString()
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO investigation_cases (id, title, summary, status, mode, case_number, created_by, created_at, updated_at, data_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    caseData.id,
    caseData.title || 'Untitled Case',
    caseData.summary || '',
    caseData.status || 'ACTIVE',
    caseData.mode || 'LIVE_OPERATIONAL',
    caseData.caseNumber || '',
    caseData.createdByLocalOperator || '',
    caseData.createdAt || now,
    now,
    JSON.stringify({ ...caseData, updatedAt: now })
  )
  return { success: true, id: caseData.id }
}

function getInvestigationCase(id) {
  if (!db) return null
  const row = db.prepare('SELECT data_json FROM investigation_cases WHERE id = ?').get(id)
  return row ? JSON.parse(row.data_json) : null
}

function getAllInvestigationCases() {
  if (!db) return []
  const rows = db.prepare('SELECT data_json FROM investigation_cases ORDER BY updated_at DESC').all()
  return rows.map(r => JSON.parse(r.data_json))
}

function deleteInvestigationCase(id) {
  if (!db) throw new Error('Database not initialized')
  const res = db.prepare('DELETE FROM investigation_cases WHERE id = ?').run(id)
  return { success: true, changes: res.changes }
}

/**
 * Operasi CRUD Bukti Digital Forensik
 */
function saveEvidenceRecord(evidence) {
  if (!db) throw new Error('Database not initialized')
  if (!evidence || !evidence.id || !evidence.caseId) throw new Error('Invalid evidence record')

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO evidence_records (id, case_id, source_url, capture_timestamp, extraction_method, screenshot_sha256, manifest_sha256, integrity_status, data_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    evidence.id,
    evidence.caseId,
    evidence.sourceUrl || '',
    evidence.captureTimestamp || new Date().toISOString(),
    evidence.extractionMethod || 'MANUAL_BROWSER_CAPTURE',
    evidence.screenshotSha256 || null,
    evidence.manifestSha256 || '',
    evidence.integrityStatus || 'UNVERIFIED',
    JSON.stringify(evidence)
  )
  return { success: true, id: evidence.id }
}

function getEvidenceRecords(caseId) {
  if (!db) return []
  const rows = db.prepare('SELECT data_json FROM evidence_records WHERE case_id = ? ORDER BY capture_timestamp DESC').all(caseId)
  return rows.map(r => JSON.parse(r.data_json))
}

function getEvidenceRecordById(id) {
  if (!db) return null
  const row = db.prepare('SELECT data_json FROM evidence_records WHERE id = ?').get(id)
  return row ? JSON.parse(row.data_json) : null
}

function deleteEvidenceRecord(id) {
  if (!db) throw new Error('Database not initialized')
  const res = db.prepare('DELETE FROM evidence_records WHERE id = ?').run(id)
  return { success: true, changes: res.changes }
}

/**
 * Operasi CRUD Batch Komentar & Record
 */
function saveCommentBatch(batch) {
  if (!db) throw new Error('Database not initialized')
  if (!batch || !batch.id || !batch.caseId) throw new Error('Invalid comment batch')

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO comment_batches (id, case_id, batch_label, intake_method, record_count, total_characters, created_at, data_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    batch.id,
    batch.caseId,
    batch.batchLabel || 'Batch Komentar',
    batch.intakeMethod || 'MANUAL_ENTRY',
    batch.recordCount || 0,
    batch.totalCharacters || 0,
    batch.createdAt || new Date().toISOString(),
    JSON.stringify(batch)
  )
  return { success: true, id: batch.id }
}

function getCommentBatches(caseId) {
  if (!db) return []
  const rows = db.prepare('SELECT data_json FROM comment_batches WHERE case_id = ? ORDER BY created_at DESC').all(caseId)
  return rows.map(r => JSON.parse(r.data_json))
}

function getCommentBatchById(id) {
  if (!db) return null
  const row = db.prepare('SELECT data_json FROM comment_batches WHERE id = ?').get(id)
  return row ? JSON.parse(row.data_json) : null
}

function saveCommentRecords(records) {
  if (!db) throw new Error('Database not initialized')
  if (!Array.isArray(records)) return { success: true, inserted: 0 }

  db.exec('BEGIN TRANSACTION;')
  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO comment_records (id, batch_id, case_id, raw_text, normalized_text, author_handle, timestamp, data_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const r of records) {
      if (!r.id || !r.batchId) continue
      stmt.run(
        r.id,
        r.batchId,
        r.caseId || '',
        r.rawText || '',
        r.normalizedText || '',
        r.authorHandle || null,
        r.timestamp || null,
        JSON.stringify(r)
      )
    }
    db.exec('COMMIT;')
    return { success: true, inserted: records.length }
  } catch (err) {
    db.exec('ROLLBACK;')
    throw err
  }
}

function getCommentRecords(batchId) {
  if (!db) return []
  const rows = db.prepare('SELECT data_json FROM comment_records WHERE batch_id = ?').all(batchId)
  return rows.map(r => JSON.parse(r.data_json))
}

/**
 * Operasi CRUD Comment Analysis Runs
 */
function saveCommentAnalysisRun(run) {
  if (!db) throw new Error('Database not initialized')
  if (!run || !run.id || !run.batchId) throw new Error('Invalid analysis run')

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO comment_analysis_runs (id, batch_id, case_id, created_at, algorithm_version, data_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    run.id,
    run.batchId,
    run.caseId || '',
    run.createdAt || new Date().toISOString(),
    run.algorithmVersion || '1.0.0',
    JSON.stringify(run)
  )
  return { success: true, id: run.id }
}

function getCommentAnalysisRuns(batchId) {
  if (!db) return []
  const rows = db.prepare('SELECT data_json FROM comment_analysis_runs WHERE batch_id = ? ORDER BY created_at DESC').all(batchId)
  return rows.map(r => JSON.parse(r.data_json))
}

function getCommentAnalysisRunById(id) {
  if (!db) return null
  const row = db.prepare('SELECT data_json FROM comment_analysis_runs WHERE id = ?').get(id)
  return row ? JSON.parse(row.data_json) : null
}

/**
 * Operasi CRUD Comment Review Annotations
 */
function saveCommentReviewAnnotation(annotation) {
  if (!db) throw new Error('Database not initialized')
  if (!annotation || !annotation.id || !annotation.runId) throw new Error('Invalid annotation')

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO comment_review_annotations (id, run_id, case_id, target_type, target_id, review_status, reviewer_note, reviewed_at, data_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    annotation.id,
    annotation.runId,
    annotation.caseId || '',
    annotation.targetType || 'COMMENT',
    annotation.targetId || '',
    annotation.reviewStatus || 'UNREVIEWED',
    annotation.reviewerNote || null,
    annotation.reviewedAt || new Date().toISOString(),
    JSON.stringify(annotation)
  )
  return { success: true, id: annotation.id }
}

function getCommentReviewAnnotations(runId, caseId = null) {
  if (!db) return []
  let query = 'SELECT data_json FROM comment_review_annotations WHERE run_id = ?'
  const params = [runId]
  if (caseId) {
    query += ' AND case_id = ?'
    params.push(caseId)
  }
  query += ' ORDER BY reviewed_at DESC'
  const rows = db.prepare(query).all(...params)
  return rows.map(r => JSON.parse(r.data_json))
}

/**
 * Operasi CRUD Radar Cache
 */
function saveRadarCacheItems(items) {
  if (!db) throw new Error('Database not initialized')
  if (!Array.isArray(items)) return { success: true, count: 0 }

  db.exec('BEGIN TRANSACTION;')
  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO radar_cache (id, cluster, fetched_at, data_json)
      VALUES (?, ?, ?, ?)
    `)
    for (const item of items) {
      if (!item.id) continue
      stmt.run(
        item.id,
        item.cluster || null,
        item.fetchedAt ? new Date(item.fetchedAt).toISOString() : new Date().toISOString(),
        JSON.stringify(item)
      )
    }
    db.exec('COMMIT;')
    return { success: true, count: items.length }
  } catch (err) {
    db.exec('ROLLBACK;')
    throw err
  }
}

function getCachedRadarItems() {
  if (!db) return []
  const rows = db.prepare('SELECT data_json FROM radar_cache ORDER BY fetched_at DESC').all()
  return rows.map(r => JSON.parse(r.data_json))
}

/**
 * Cadangan Basis Data (Safe Transactional Backup via VACUUM INTO)
 */
function createDatabaseBackup(destinationPath = null) {
  if (!db) throw new Error('Database not initialized')

  let backupFile = destinationPath
  if (!backupFile) {
    let backupDir = path.join(path.dirname(currentDbPath || '.'), 'backups')
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    backupFile = path.join(backupDir, `narada_backup_${timestamp}.sqlite3`)
  }

  // Jika file tujuan sudah ada, hapus dulu agar VACUUM INTO tidak gagal
  if (fs.existsSync(backupFile)) {
    fs.unlinkSync(backupFile)
  }

  // Gunakan VACUUM INTO yang atomik dan konsisten
  db.exec(`VACUUM INTO '${backupFile.replace(/'/g, "''")}';`)

  const stats = fs.statSync(backupFile)
  return {
    success: true,
    backupPath: backupFile,
    sizeBytes: stats.size,
    createdAt: new Date().toISOString()
  }
}

/**
 * Pemeriksaan Integritas Basis Data
 */
function checkDatabaseIntegrity() {
  if (!db) return { ok: false, error: 'Database not open' }
  try {
    const row = db.prepare('PRAGMA integrity_check;').get()
    const result = row ? Object.values(row)[0] : 'unknown'
    return { ok: result === 'ok', result }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

module.exports = {
  initSqliteDatabase,
  closeSqliteDatabase,
  getDatabaseStatus,
  isMigrationCompleted,
  importDumpFromIndexedDB,
  saveInvestigationCase,
  getInvestigationCase,
  getAllInvestigationCases,
  deleteInvestigationCase,
  saveEvidenceRecord,
  getEvidenceRecords,
  getEvidenceRecordById,
  deleteEvidenceRecord,
  saveCommentBatch,
  getCommentBatches,
  getCommentBatchById,
  saveCommentRecords,
  getCommentRecords,
  saveCommentAnalysisRun,
  getCommentAnalysisRuns,
  getCommentAnalysisRunById,
  saveCommentReviewAnnotation,
  getCommentReviewAnnotations,
  saveRadarCacheItems,
  getCachedRadarItems,
  createDatabaseBackup,
  checkDatabaseIntegrity
}
