const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const { startGatewayServer, stopGatewayServer } = require('./gateway-runner.cjs')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
let gatewayInstance = null

function createWindow() {
  const win = new BrowserWindow({
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
      webSecurity: true
    }
  })

  // Buka link eksternal di browser default pengguna
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(async () => {
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
  if (gatewayInstance && gatewayInstance.server) {
    await stopGatewayServer(gatewayInstance.server)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
