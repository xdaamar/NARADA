const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

// Register IPC handlers matching electron/main.cjs
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

ipcMain.handle('narada:sys:hardware-specs', async () => {
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

ipcMain.handle('narada:sys:telemetry-sample', async () => {
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
  console.log('[Snapshot Telemetry] Loading URL:', targetUrl)

  await win.loadURL(targetUrl)

  // Explicitly ensure sidebar is expanded
  await win.webContents.executeJavaScript(`
    (() => {
      localStorage.setItem('narada_sidebar_collapsed', 'false');
      window.dispatchEvent(new CustomEvent('narada:sidebar-collapse', { detail: { collapse: false } }));
    })()
  `)
  await new Promise(r => setTimeout(r, 2000))

  // 1. Capture expanded sidebar with full steel chassis card & Task Manager waveform
  const imgExpanded = await win.webContents.capturePage()
  const artifactExpanded = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8/sidebar_telemetry_expanded_ecg_verified.png'
  fs.writeFileSync(artifactExpanded, imgExpanded.toPNG())
  console.log('[Snapshot Telemetry] Saved expanded sidebar snapshot to:', artifactExpanded)

  // 2. Collapse sidebar
  await win.webContents.executeJavaScript(`
    (() => {
      localStorage.setItem('narada_sidebar_collapsed', 'true');
      window.dispatchEvent(new CustomEvent('narada:sidebar-collapse', { detail: { collapse: true } }));
    })()
  `)
  await new Promise(r => setTimeout(r, 800))

  // Capture collapsed state without hover
  const imgCollapsed = await win.webContents.capturePage()
  const artifactCollapsed = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8/sidebar_telemetry_collapsed_rail_verified.png'
  fs.writeFileSync(artifactCollapsed, imgCollapsed.toPNG())
  console.log('[Snapshot Telemetry] Saved collapsed rail snapshot to:', artifactCollapsed)

  // 3. Hover over the collapsed telemetry icon trigger
  const triggerRect = await win.webContents.executeJavaScript(`
    (() => {
      const trigger = document.querySelector('.sidebar-collapsed-telemetry-trigger');
      if (!trigger) return null;
      const r = trigger.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    })()
  `)
  console.log('[Trigger Rect in Collapsed]:', triggerRect)

  if (triggerRect) {
    await win.webContents.sendInputEvent({
      type: 'mouseMove',
      x: Math.round(triggerRect.x + triggerRect.width / 2),
      y: Math.round(triggerRect.y + triggerRect.height / 2)
    })
    await new Promise(r => setTimeout(r, 800))

    const imgHover = await win.webContents.capturePage()
    const artifactHover = 'C:/Users/Damar/.gemini/antigravity/brain/a82014a4-b9c0-4b61-929f-b197e2511ec8/sidebar_telemetry_collapsed_hover_verified.png'
    fs.writeFileSync(artifactHover, imgHover.toPNG())
    console.log('[Snapshot Telemetry] Saved collapsed hover popover snapshot to:', artifactHover)
  }

  win.close()
  app.quit()
})
