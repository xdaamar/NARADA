const { app, BrowserWindow, shell, ipcMain } = require('electron')
const path = require('path')
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
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'NARADA — Cognitive Threat Defense System',
    icon: path.join(__dirname, '../public/image/Electrified Golden Globe Crest.png'),
    backgroundColor: '#0C1016',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.cjs')
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

  if (!isDev) {
    try {
      gatewayInstance = await startGatewayServer(5174, '127.0.0.1')
      console.log('[NARADA Main] Packaged local loopback gateway started on 127.0.0.1:5174')
    } catch (err) {
      console.error('[NARADA Main] Failed to start packaged gateway:', err)
    }
  }
  createWindow()
})

app.on('will-quit', async () => {
  await closeEvidenceBrowser()
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
