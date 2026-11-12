const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  const indexPath = path.resolve(__dirname, '../../dist/index.html')
  const targetUrl = `file://${indexPath}#/radar`
  console.log('[Snapshot] Loading URL:', targetUrl)

  await win.loadURL(targetUrl)

  // Wait 3.5 seconds for radar data to render
  await new Promise(r => setTimeout(r, 3500))

  // Scroll test
  const debugScroll = await win.webContents.executeJavaScript(`
    (() => {
      const pageContent = document.querySelector('.page-content');
      const html = document.documentElement;
      const body = document.body;
      const main = document.querySelector('.main-content');
      const app = document.querySelector('.app-layout');
      
      const pagination = document.querySelector('.steel-chassis-card button[disabled]') || document.querySelector('button[title*="Halaman"]');
      
      // Let's scroll each candidate
      if (pageContent) pageContent.scrollTop = 5000;
      if (main) main.scrollTop = 5000;
      if (app) app.scrollTop = 5000;
      window.scrollTo(0, 5000);

      return {
        pageContentScrollHeight: pageContent ? pageContent.scrollHeight : 0,
        pageContentClientHeight: pageContent ? pageContent.clientHeight : 0,
        htmlScrollHeight: html ? html.scrollHeight : 0,
        bodyScrollHeight: body ? body.scrollHeight : 0
      };
    })()
  `)
  console.log('[Snapshot Debug]', debugScroll)
  await new Promise(r => setTimeout(r, 1000))

  const image = await win.webContents.capturePage()
  const artifactPath = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8/radar_pagination_verified.png'
  fs.writeFileSync(artifactPath, image.toPNG())
  console.log('[Snapshot] Saved verified pagination screenshot to:', artifactPath)

  win.close()
  app.quit()
})
