const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

const artifactDir = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8'

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 950,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  const targetUrl = 'http://localhost:5173/#/profiler'
  console.log('[Runner] Loading Profiler URL:', targetUrl)

  await win.loadURL(targetUrl)
  await new Promise(r => setTimeout(r, 2000))

  // ════════════════════════════════════════════════════════════════
  // 1. TEST TIKTOK FORENSIC LIVE
  // ════════════════════════════════════════════════════════════════
  console.log('[Runner] Starting TikTok Test...')
  await win.webContents.executeJavaScript(`
    (() => {
      // 1. Click TIKTOK platform tab button
      const buttons = Array.from(document.querySelectorAll('button'));
      const ttTab = buttons.find(b => b.textContent && b.textContent.trim().toUpperCase() === 'TIKTOK');
      if (ttTab) ttTab.click();

      // 2. Set input URL using native setter for React
      const input = document.querySelector('input[type="text"]') || document.querySelector('input');
      if (input) {
        const valSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        valSetter.call(input, 'https://www.tiktok.com/@kodebin/video/7706326293834403079');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()
  `)
  await new Promise(r => setTimeout(r, 500))

  // Click "MULAI ANALISIS"
  await win.webContents.executeJavaScript(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const analyzeBtn = buttons.find(b => b.textContent && b.textContent.includes('MULAI ANALISIS'));
      if (analyzeBtn) analyzeBtn.click();
    })()
  `)

  // Wait for analysis to complete (up to 12 seconds)
  console.log('[Runner] Waiting for TikTok analysis to complete...')
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 500))
    const status = await win.webContents.executeJavaScript(`
      (() => {
        const bodyText = document.body.innerText;
        const hasAuthor = bodyText.includes('kodebin');
        const hasLikes = bodyText.includes('2.840') || bodyText.includes('LIKES');
        const hasComments = bodyText.includes('TOP KOMENTAR') && !bodyText.includes('Tidak ditemukan komentar publik');
        return { hasAuthor, hasLikes, hasComments };
      })()
    `)
    if (status.hasAuthor && status.hasLikes && status.hasComments) {
      console.log(`[Runner] TikTok analysis complete after ${(i + 1) * 500}ms`)
      break
    }
  }

  await new Promise(r => setTimeout(r, 1200))

  // Capture screenshot of TikTok result
  const ttImg = await win.capturePage()
  const ttPath = path.join(artifactDir, 'tiktok_forensic_verified.png')
  fs.writeFileSync(ttPath, ttImg.toPNG())
  console.log('[Runner] Saved TikTok screenshot to:', ttPath)

  // ════════════════════════════════════════════════════════════════
  // 2. TEST INSTAGRAM FORENSIC LIVE
  // ════════════════════════════════════════════════════════════════
  console.log('[Runner] Starting Instagram Test...')
  await win.webContents.executeJavaScript(`
    (() => {
      // 1. Click INSTAGRAM platform tab button
      const buttons = Array.from(document.querySelectorAll('button'));
      const igTab = buttons.find(b => b.textContent && b.textContent.trim().toUpperCase() === 'INSTAGRAM');
      if (igTab) igTab.click();

      // 2. Set input URL using native setter for React
      const input = document.querySelector('input[type="text"]') || document.querySelector('input');
      if (input) {
        const valSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        valSetter.call(input, 'https://www.instagram.com/reel/DezB7kSTLmk/?psln=NTc4MTIwNjQ2YQ==');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()
  `)
  await new Promise(r => setTimeout(r, 500))

  // Click "MULAI ANALISIS"
  await win.webContents.executeJavaScript(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const analyzeBtn = buttons.find(b => b.textContent && b.textContent.includes('MULAI ANALISIS'));
      if (analyzeBtn) analyzeBtn.click();
    })()
  `)

  // Wait for analysis to complete (up to 12 seconds)
  console.log('[Runner] Waiting for Instagram analysis to complete...')
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 500))
    const status = await win.webContents.executeJavaScript(`
      (() => {
        const bodyText = document.body.innerText;
        const hasAuthor = bodyText.includes('bilbilcngeng');
        const hasFollowers = bodyText.includes('1.242 akun');
        const hasComments = bodyText.includes('1.657');
        return { hasAuthor, hasFollowers, hasComments };
      })()
    `)
    if (status.hasAuthor && status.hasFollowers && status.hasComments) {
      console.log(`[Runner] Instagram analysis complete after ${(i + 1) * 500}ms`)
      break
    }
  }

  await new Promise(r => setTimeout(r, 1200))

  // Capture screenshot of Instagram result
  const igImg = await win.capturePage()
  const igPath = path.join(artifactDir, 'instagram_forensic_verified.png')
  fs.writeFileSync(igPath, igImg.toPNG())
  console.log('[Runner] Saved Instagram screenshot to:', igPath)

  win.close()
  app.quit()
})
