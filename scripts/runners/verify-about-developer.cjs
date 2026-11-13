const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

const artifactDir = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8'

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  const indexPath = path.resolve(__dirname, '../../dist/index.html')

  // 1. Load /about
  console.log('[About Dev Verification] Loading /about...')
  await win.loadURL(`file://${indexPath}#/about`)
  await new Promise(r => setTimeout(r, 2000))

  const normalImg = await win.webContents.capturePage()
  const normalPath = path.join(artifactDir, 'about_developer_normal_verified.png')
  fs.writeFileSync(normalPath, normalImg.toPNG())
  console.log('[About Dev Verification] Saved normal view to:', normalPath)

  // 2. Trigger hover on profile photo
  console.log('[About Dev Verification] Triggering hover on avatar...')
  await win.webContents.executeJavaScript(`
    (() => {
      const avatarImg = document.querySelector('img[alt*="Developer Avatar"]');
      if (avatarImg && avatarImg.parentElement && avatarImg.parentElement.parentElement) {
        avatarImg.parentElement.parentElement.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      }
    })()
  `)
  await new Promise(r => setTimeout(r, 600))

  const hoverImg = await win.webContents.capturePage()
  const hoverPath = path.join(artifactDir, 'about_developer_hover_verified.png')
  fs.writeFileSync(hoverPath, hoverImg.toPNG())
  console.log('[About Dev Verification] Saved hover view to:', hoverPath)

  // 3. Trigger click to zoom photo
  console.log('[About Dev Verification] Triggering click on avatar to zoom...')
  await win.webContents.executeJavaScript(`
    (() => {
      const avatarImg = document.querySelector('img[alt*="Developer Avatar"]');
      if (avatarImg && avatarImg.parentElement && avatarImg.parentElement.parentElement) {
        avatarImg.parentElement.parentElement.click();
      }
    })()
  `)
  await new Promise(r => setTimeout(r, 800))

  const zoomImg = await win.webContents.capturePage()
  const zoomPath = path.join(artifactDir, 'about_developer_zoom_verified.png')
  fs.writeFileSync(zoomPath, zoomImg.toPNG())
  console.log('[About Dev Verification] Saved zoom modal view to:', zoomPath)

  win.close()
  app.quit()
})

