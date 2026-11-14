const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

ipcMain.handle('narada:db:status', async () => ({ status: 'PERSISTED', engine: 'SQLITE' }))
ipcMain.handle('narada:db:is-migration-completed', async () => true)
ipcMain.handle('narada:db:get-all-cases', async () => [])

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.resolve(__dirname, '../../electron/preload.cjs')
    }
  })

  const indexPath = path.resolve(__dirname, '../../dist/index.html')
  const targetUrl = `file://${indexPath}#/`
  console.log('[Snapshot REC] Loading URL:', targetUrl)

  await win.loadURL(targetUrl)

  // Clear any existing localStorage recording state so it uses the clean default
  await win.webContents.executeJavaScript(`
    (() => {
      localStorage.removeItem('narada_intel_action_capture');
      sessionStorage.removeItem('narada_capture_initialized');
    })()
  `)
  await win.reload()
  await new Promise(r => setTimeout(r, 2000))

  // 1. Verify default REC state is OFF
  const recState = await win.webContents.executeJavaScript(`
    (() => {
      const btn = document.querySelector('.topbar-actions button');
      return btn ? btn.innerText.trim() : 'NOT_FOUND';
    })()
  `)
  console.log('[Snapshot REC] Default button text:', recState)

  // 2. Hover over REC OFF button to reveal the colored card popover
  const btnRect = await win.webContents.executeJavaScript(`
    (() => {
      const btn = document.querySelector('.topbar-actions button');
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    })()
  `)

  if (btnRect) {
    await win.webContents.sendInputEvent({
      type: 'mouseMove',
      x: Math.round(btnRect.x + btnRect.width / 2),
      y: Math.round(btnRect.y + btnRect.height / 2)
    })
    await new Promise(r => setTimeout(r, 800))

    const imgHoverOff = await win.webContents.capturePage()
    const artifactHoverOff = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8/topbar_rec_off_hover_verified.png'
    fs.writeFileSync(artifactHoverOff, imgHoverOff.toPNG())
    console.log('[Snapshot REC] Saved hover popover (OFF) snapshot to:', artifactHoverOff)

    // 3. Click to toggle to REC ON
    await win.webContents.sendInputEvent({
      type: 'mouseDown',
      x: Math.round(btnRect.x + btnRect.width / 2),
      y: Math.round(btnRect.y + btnRect.height / 2),
      button: 'left',
      clickCount: 1
    })
    await win.webContents.sendInputEvent({
      type: 'mouseUp',
      x: Math.round(btnRect.x + btnRect.width / 2),
      y: Math.round(btnRect.y + btnRect.height / 2),
      button: 'left',
      clickCount: 1
    })
    await new Promise(r => setTimeout(r, 800))

    const imgHoverOn = await win.webContents.capturePage()
    const artifactHoverOn = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8/topbar_rec_on_hover_verified.png'
    fs.writeFileSync(artifactHoverOn, imgHoverOn.toPNG())
    console.log('[Snapshot REC] Saved hover popover (ON) snapshot to:', artifactHoverOn)
  }

  win.close()
  app.quit()
})
