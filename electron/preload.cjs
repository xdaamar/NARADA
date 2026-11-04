/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — PRELOAD SCRIPT FOR TRUSTED MAIN RENDERER (Sprint 7)
 * PUSSIBERAD TNI AD × CODEPOLITAN — KARTIKA CYBER HACKATHON 2026
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Hanya diekspos ke jendela utama aplikasi NARADA yang terpercaya.
 * Konten halaman web jarak jauh (remote content) TIDAK MENERIMA preload ini.
 * ══════════════════════════════════════════════════════════════════════════
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('naradaEvidenceBrowser', {
  isElectron: true,

  open: (params) => ipcRenderer.invoke('narada:evidence-browser:open', params),
  navigate: (url) => ipcRenderer.invoke('narada:evidence-browser:navigate', url),
  goBack: () => ipcRenderer.send('narada:evidence-browser:back'),
  goForward: () => ipcRenderer.send('narada:evidence-browser:forward'),
  reload: () => ipcRenderer.send('narada:evidence-browser:reload'),
  stop: () => ipcRenderer.send('narada:evidence-browser:stop'),
  setBounds: (bounds) => ipcRenderer.send('narada:evidence-browser:set-bounds', bounds),
  setVisible: (visible) => ipcRenderer.send('narada:evidence-browser:set-visible', visible),
  prepareCapture: () => ipcRenderer.invoke('narada:evidence-browser:prepare-capture'),
  close: () => ipcRenderer.invoke('narada:evidence-browser:close'),
  getStatus: () => ipcRenderer.invoke('narada:evidence-browser:get-status'),

  onStateChange: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('narada:evidence-browser:state-change', handler)
    return () => {
      ipcRenderer.removeListener('narada:evidence-browser:state-change', handler)
    }
  }
})

contextBridge.exposeInMainWorld('naradaDatabase', {
  getStatus: () => ipcRenderer.invoke('narada:db:status'),
  isMigrationCompleted: () => ipcRenderer.invoke('narada:db:is-migration-completed'),
  importDump: (dump) => ipcRenderer.invoke('narada:db:import-dump', dump),
  createBackup: (dest) => ipcRenderer.invoke('narada:db:create-backup', dest),
  checkIntegrity: () => ipcRenderer.invoke('narada:db:check-integrity'),

  // Cases
  saveCase: (caseData) => ipcRenderer.invoke('narada:db:save-case', caseData),
  getCaseById: (id) => ipcRenderer.invoke('narada:db:get-case', id),
  getAllCases: () => ipcRenderer.invoke('narada:db:get-all-cases'),
  deleteCase: (id) => ipcRenderer.invoke('narada:db:delete-case', id),

  // Evidence
  saveEvidence: (record) => ipcRenderer.invoke('narada:db:save-evidence', record),
  getEvidenceRecords: (caseId) => ipcRenderer.invoke('narada:db:get-evidence', caseId),
  deleteEvidence: (id) => ipcRenderer.invoke('narada:db:delete-evidence', id),

  // Comments
  saveCommentBatch: (batch) => ipcRenderer.invoke('narada:db:save-comment-batch', batch),
  getCommentBatches: (caseId) => ipcRenderer.invoke('narada:db:get-comment-batches', caseId),
  getCommentBatchById: (id) => ipcRenderer.invoke('narada:db:get-comment-batch-by-id', id),
  saveCommentRecords: (records) => ipcRenderer.invoke('narada:db:save-comment-records', records),
  getCommentRecords: (batchId) => ipcRenderer.invoke('narada:db:get-comment-records', batchId),

  // Runs
  saveCommentAnalysisRun: (run) => ipcRenderer.invoke('narada:db:save-comment-run', run),
  getCommentAnalysisRuns: (batchId) => ipcRenderer.invoke('narada:db:get-comment-runs', batchId),
  getCommentAnalysisRunById: (id) => ipcRenderer.invoke('narada:db:get-comment-run-by-id', id),

  // Annotations
  saveCommentReviewAnnotation: (ann) => ipcRenderer.invoke('narada:db:save-comment-annotation', ann),
  getCommentReviewAnnotations: (runId, caseId) => ipcRenderer.invoke('narada:db:get-comment-annotations', runId, caseId),

  // Radar
  saveRadarItems: (items) => ipcRenderer.invoke('narada:db:save-radar-items', items),
  getCachedRadarItems: () => ipcRenderer.invoke('narada:db:get-radar-items'),

  // Sprint 09 Claims & Evidence Intelligence
  saveClaim: (claim) => ipcRenderer.invoke('narada:db:save-claim', claim),
  getClaims: (articleId) => ipcRenderer.invoke('narada:db:get-claims', articleId),
  saveClaimEvidence: (evidence) => ipcRenderer.invoke('narada:db:save-claim-evidence', evidence),
  getClaimEvidence: (claimId) => ipcRenderer.invoke('narada:db:get-claim-evidence', claimId),
  saveClaimAssessment: (assessment) => ipcRenderer.invoke('narada:db:save-claim-assessment', assessment),
  getClaimAssessment: (claimId) => ipcRenderer.invoke('narada:db:get-claim-assessment', claimId),
  savePublisher: (publisher) => ipcRenderer.invoke('narada:db:save-publisher', publisher),
  getPublishers: () => ipcRenderer.invoke('narada:db:get-publishers')
})

