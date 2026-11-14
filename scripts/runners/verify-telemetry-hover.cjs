const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1440, height: 900, show: true })
  await win.loadURL('file://' + path.resolve(__dirname, '../../dist/index.html') + '#/')
  await new Promise(r => setTimeout(r, 2000))

  const rect = await win.webContents.executeJavaScript(`
    (() => {
      const el = document.querySelector('.telemetry-bar-container');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    })()
  `)
  console.log('[Telemetry Rect]:', rect)

  if (rect) {
    const targetX = Math.round(rect.x + rect.width / 2)
    const targetY = Math.round(rect.y + rect.height / 2)
    console.log('[Hover Target]:', targetX, targetY)

    await win.webContents.sendInputEvent({
      type: 'mouseMove',
      x: targetX,
      y: targetY
    })
    await new Promise(r => setTimeout(r, 800))

    const img = await win.webContents.capturePage()
    fs.writeFileSync('C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8/sidebar_telemetry_hover_verified.png', img.toPNG())
    console.log('[Snapshot Hover] Saved precise hover snapshot!')
  }

  win.close()
  app.quit()
})
