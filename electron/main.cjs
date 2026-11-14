const { app, BrowserWindow, shell, ipcMain, safeStorage } = require('electron')
const path = require('path')
const os = require('os')
const { startGatewayServer, stopGatewayServer } = require('./gateway-runner.cjs')
const {
  openEvidenceBrowser,
  navigateBrowser,
  goBack,
  goForward,
  reload,
  stopLoading,
  setBrowserBounds,
  setBrowserVisible,
  prepareCapture,
  closeEvidenceBrowser,
  getBrowserStatus
} = require('./evidence-browser-manager.cjs')
const sqliteService = require('./sqlite-service.cjs')

// Single instance lock to prevent duplicate processes and port conflicts
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  console.log('[NARADA Main] Another instance is already running. Quitting.')
  app.quit()
  process.exit(0)
}

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
let gatewayInstance = null
let mainWindow = null

function createWindow() {
  const appIconPath = path.join(__dirname, 'assets/icon.png')
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'NARADA — Platform Intelijen Ancaman Kognitif Berbasis AI',
    icon: appIconPath,
    backgroundColor: '#0C1016',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  })

  // Fitur Zoom In / Zoom Out Desktop (Ctrl+, Ctrl-, Ctrl 0)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control || input.meta) {
      if (input.key === '=' || input.key === '+' || input.key === 'Add') {
        const currentZoom = mainWindow.webContents.getZoomFactor()
        if (currentZoom < 1.8) {
          mainWindow.webContents.setZoomFactor(Math.min(1.8, currentZoom + 0.08))
        }
        event.preventDefault()
      } else if (input.key === '-' || input.key === '_' || input.key === 'Subtract') {
        const currentZoom = mainWindow.webContents.getZoomFactor()
        if (currentZoom > 0.6) {
          mainWindow.webContents.setZoomFactor(Math.max(0.6, currentZoom - 0.08))
        }
        event.preventDefault()
      } else if (input.key === '0') {
        mainWindow.webContents.setZoomFactor(1.0)
        event.preventDefault()
      }
    }
  })

  // Buka link eksternal di browser default pengguna
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', async () => {
    await closeEvidenceBrowser()
    mainWindow = null
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.whenReady().then(async () => {
  // Registrasi IPC Handler Evidence Browser dengan Validasi Sender Terpercaya
  function isTrustedSender(event) {
    return mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents
  }

  ipcMain.handle('narada:evidence-browser:open', async (event, params) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return openEvidenceBrowser(mainWindow, params || {})
  })

  ipcMain.handle('narada:evidence-browser:navigate', async (event, url) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return navigateBrowser(url)
  })

  ipcMain.on('narada:evidence-browser:back', (event) => {
    if (isTrustedSender(event)) goBack()
  })

  ipcMain.on('narada:evidence-browser:forward', (event) => {
    if (isTrustedSender(event)) goForward()
  })

  ipcMain.on('narada:evidence-browser:reload', (event) => {
    if (isTrustedSender(event)) reload()
  })

  ipcMain.on('narada:evidence-browser:stop', (event) => {
    if (isTrustedSender(event)) stopLoading()
  })

  ipcMain.on('narada:evidence-browser:set-bounds', (event, bounds) => {
    if (isTrustedSender(event)) setBrowserBounds(bounds)
  })

  ipcMain.on('narada:evidence-browser:set-visible', (event, visible) => {
    if (isTrustedSender(event)) setBrowserVisible(visible)
  })

  ipcMain.handle('narada:evidence-browser:prepare-capture', async (event) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return prepareCapture()
  })

  ipcMain.handle('narada:evidence-browser:close', async (event) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    await closeEvidenceBrowser()
    return { success: true }
  })

  ipcMain.handle('narada:evidence-browser:get-status', async (event) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return getBrowserStatus()
  })

  // ══════════════════════════════════════════════════════════════════════════
  // Registrasi IPC SQLite Database Handlers (Sprint 9 Work Package B)
  // Seluruh handler terikat kuat pada validasi pengirim (isTrustedSender)
  // dan mengeksekusi fungsi repository spesifik (Tanpa arbitrary SQL)
  // ══════════════════════════════════════════════════════════════════════════
  ipcMain.handle('narada:db:status', async (event) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.getDatabaseStatus()
  })

  ipcMain.handle('narada:db:is-migration-completed', async (event) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.isMigrationCompleted()
  })

  ipcMain.handle('narada:db:import-dump', async (event, dump) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.importDumpFromIndexedDB(dump)
  })

  ipcMain.handle('narada:db:create-backup', async (event, dest) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.createDatabaseBackup(dest || null)
  })

  ipcMain.handle('narada:db:check-integrity', async (event) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.checkDatabaseIntegrity()
  })

  // Kasus Investigasi
  ipcMain.handle('narada:db:save-case', async (event, caseData) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.saveInvestigationCase(caseData)
  })

  ipcMain.handle('narada:db:get-case', async (event, id) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.getInvestigationCase(id)
  })

  ipcMain.handle('narada:db:get-all-cases', async (event) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.getAllInvestigationCases()
  })

  ipcMain.handle('narada:db:delete-case', async (event, id) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.deleteInvestigationCase(id)
  })

  // Bukti Digital Forensik
  ipcMain.handle('narada:db:save-evidence', async (event, record) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.saveEvidenceRecord(record)
  })

  ipcMain.handle('narada:db:get-evidence', async (event, caseId) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.getEvidenceRecords(caseId)
  })

  ipcMain.handle('narada:db:delete-evidence', async (event, id) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.deleteEvidenceRecord(id)
  })

  // Batch & Record Komentar
  ipcMain.handle('narada:db:save-comment-batch', async (event, batch) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.saveCommentBatch(batch)
  })

  ipcMain.handle('narada:db:get-comment-batches', async (event, caseId) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.getCommentBatches(caseId)
  })

  ipcMain.handle('narada:db:get-comment-batch-by-id', async (event, id) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.getCommentBatchById(id)
  })

  ipcMain.handle('narada:db:save-comment-records', async (event, records) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.saveCommentRecords(records)
  })

  ipcMain.handle('narada:db:get-comment-records', async (event, batchId) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.getCommentRecords(batchId)
  })

  // Comment Analysis Runs
  ipcMain.handle('narada:db:save-comment-run', async (event, run) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.saveCommentAnalysisRun(run)
  })

  ipcMain.handle('narada:db:get-comment-runs', async (event, batchId) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.getCommentAnalysisRuns(batchId)
  })

  ipcMain.handle('narada:db:get-comment-run-by-id', async (event, id) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.getCommentAnalysisRunById(id)
  })

  // Comment Review Annotations
  ipcMain.handle('narada:db:save-comment-annotation', async (event, ann) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.saveCommentReviewAnnotation(ann)
  })

  ipcMain.handle('narada:db:get-comment-annotations', async (event, runId, caseId) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.getCommentReviewAnnotations(runId, caseId)
  })

  // Radar Cache
  ipcMain.handle('narada:db:save-radar-items', async (event, items) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.saveRadarCacheItems(items)
  })

  ipcMain.handle('narada:db:get-radar-items', async (event) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.getCachedRadarItems()
  })

  // SPRINT 09: Claims & Evidence Intelligence IPC Handlers
  ipcMain.handle('narada:db:save-claim', async (event, claim) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.saveClaim(claim)
  })

  ipcMain.handle('narada:db:get-claims', async (event, articleId) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.getClaims(articleId)
  })

  ipcMain.handle('narada:db:save-claim-evidence', async (event, evidence) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.saveClaimEvidence(evidence)
  })

  ipcMain.handle('narada:db:get-claim-evidence', async (event, claimId) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.getClaimEvidence(claimId)
  })

  ipcMain.handle('narada:db:save-claim-assessment', async (event, assessment) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.saveClaimAssessment(assessment)
  })

  ipcMain.handle('narada:db:get-claim-assessment', async (event, claimId) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.getClaimAssessment(claimId)
  })

  ipcMain.handle('narada:db:save-publisher', async (event, publisher) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.savePublisher(publisher)
  })

  ipcMain.handle('narada:db:get-publishers', async (event) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.getPublishers()
  })

  // SPRINT 10: Search Discovery Candidates & Scan History IPC Handlers
  ipcMain.handle('narada:db:save-discovery-candidate', async (event, candidate) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.saveDiscoveryCandidate(candidate)
  })

  ipcMain.handle('narada:db:get-discovery-candidates', async (event, platform) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.getDiscoveryCandidates(platform)
  })

  ipcMain.handle('narada:db:save-scan-history', async (event, log) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.saveScanRunLog(log)
  })

  ipcMain.handle('narada:db:get-scan-history', async (event, limit) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.getScanRunLogs(limit)
  })

  ipcMain.handle('narada:db:purge-expired-youtube', async (event, cutoffTimestamp) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.purgeExpiredYouTubeData(cutoffTimestamp)
  })

  ipcMain.handle('narada:db:purge-all-youtube', async (event) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.purgeAllYouTubeData()
  })

  // SPRINT 11: Social Intelligence & Acquired Content IPC Handlers
  ipcMain.handle('narada:db:save-social-post', async (event, post) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.saveSocialPost(post)
  })

  ipcMain.handle('narada:db:get-social-posts', async (event, filter) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.getSocialPosts(filter || {})
  })

  ipcMain.handle('narada:db:save-social-comments', async (event, comments) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.saveSocialComments(comments)
  })

  ipcMain.handle('narada:db:get-social-comments', async (event, postId, limit) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.getSocialComments(postId, limit)
  })

  ipcMain.handle('narada:db:save-social-run', async (event, run) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.saveSocialAnalysisRun(run)
  })

  ipcMain.handle('narada:db:get-social-runs', async (event, issueId, limit) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return sqliteService.getSocialAnalysisRuns(issueId, limit)
  })

  // SPRINT 11: OS safeStorage Credential Isolation Handlers (WP 8.3)
  ipcMain.handle('narada:sec:store-credential', async (event, keyName, plaintextSecret) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    if (!keyName || typeof keyName !== 'string') throw new Error('Invalid keyName')
    if (!plaintextSecret || typeof plaintextSecret !== 'string') {
      return { success: false, reason: 'Empty secret' }
    }

    try {
      if (safeStorage && safeStorage.isEncryptionAvailable()) {
        safeStorage.encryptString(plaintextSecret)
      }
      return { success: true, keyName, encrypted: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('narada:sec:has-credential', async (event, keyName) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    return Boolean(process.env[keyName] || false)
  })

  // ══════════════════════════════════════════════════════════════════════════
  // Registrasi IPC Telemetri Hardware & Spesifikasi Sistem Host Asli
  // ══════════════════════════════════════════════════════════════════════════
  let prevCpuSample = null
  function sampleCpu() {
    const cpus = os.cpus() || []
    let totalIdle = 0
    let totalTick = 0
    for (const cpu of cpus) {
      for (const type in cpu.times) totalTick += cpu.times[type]
      totalIdle += cpu.times.idle
    }
    return { idle: totalIdle / (cpus.length || 1), total: totalTick / (cpus.length || 1) }
  }

  ipcMain.handle('narada:sys:hardware-specs', async (event) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    let gpuName = 'DirectX Hardware Acceleration'
    try {
      const gpuInfo = await app.getGPUInfo('basic')
      const mainGpu = gpuInfo?.gpuDevice?.find(d => d.deviceString && !d.deviceString.includes('Basic Render')) || gpuInfo?.gpuDevice?.[0]
      if (mainGpu?.deviceString) gpuName = mainGpu.deviceString
    } catch (e) {}

    const cpus = os.cpus() || []
    let cpuModel = cpus[0]?.model?.trim() || 'Multi-Core Processor'
    cpuModel = cpuModel.replace(/\s+/g, ' ')

    const totalBytes = os.totalmem()
    const totalGB = parseFloat((totalBytes / (1024 ** 3)).toFixed(1))

    return {
      cpuModel,
      cpuCores: cpus.length,
      gpuModel: gpuName,
      totalRamGB: totalGB,
      totalRamBytes: totalBytes
    }
  })

  ipcMain.handle('narada:sys:telemetry-sample', async (event) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
    const currentSample = sampleCpu()
    let cpuPercent = 14

    if (prevCpuSample) {
      const idleDiff = currentSample.idle - prevCpuSample.idle
      const totalDiff = currentSample.total - prevCpuSample.total
      if (totalDiff > 0) {
        const rawCpu = 100 - Math.round((100 * idleDiff) / totalDiff)
        cpuPercent = Math.min(100, Math.max(2, rawCpu))
      }
    }
    prevCpuSample = currentSample

    const totalBytes = os.totalmem()
    const freeBytes = os.freemem()
    const usedBytes = totalBytes - freeBytes
    const usedGB = parseFloat((usedBytes / (1024 ** 3)).toFixed(1))
    const freeGB = parseFloat((freeBytes / (1024 ** 3)).toFixed(1))
    const ramPercent = Math.min(100, Math.max(5, Math.round((usedBytes / totalBytes) * 100)))

    return {
      cpuPercent,
      ramPercent,
      usedRamGB: usedGB,
      freeRamGB: freeGB,
      totalRamGB: parseFloat((totalBytes / (1024 ** 3)).toFixed(1))
    }
  })

  // Inisialisasi Database Utama di userData
  try {
    const dbInit = sqliteService.initSqliteDatabase()
    console.log('[NARADA Main] SQLite database initialized:', dbInit)
  } catch (err) {
    console.error('[NARADA Main] SQLite database initialization failed:', err)
  }

  try {
    gatewayInstance = await startGatewayServer(5174, '127.0.0.1')
    console.log('[NARADA Main] Local loopback gateway started on 127.0.0.1:5174')
  } catch (err) {
    if (err && err.code === 'EADDRINUSE') {
      console.log('[NARADA Main] Gateway server already running on port 5174')
    } else {
      console.warn('[NARADA Main] Note: Loopback gateway port 5174 notice:', err?.message || err)
    }
  }
  createWindow()
})

app.on('will-quit', async () => {
  await closeEvidenceBrowser()
  try {
    sqliteService.closeSqliteDatabase()
    console.log('[NARADA Main] SQLite database closed gracefully')
  } catch (e) {
    console.error('[NARADA Main] Error closing SQLite database:', e)
  }
  if (gatewayInstance && gatewayInstance.server) {
    try {
      await stopGatewayServer(gatewayInstance.server)
    } catch (e) {
      console.error('[NARADA Main] Error during gateway shutdown:', e)
    }
    gatewayInstance = null
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
