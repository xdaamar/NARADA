#!/usr/bin/env node
/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — MASTER SPRINT 7 REAL ELECTRON SMOKE LAUNCHER (Carry-Over 8.3)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 */

import { spawn } from 'child_process'
import path from 'path'
import os from 'os'
import fs from 'fs'

const electronPath = path.resolve('node_modules/electron/dist/electron.exe')
const runnerScript = path.resolve('scripts/runners/electron-smoke-runner.cjs')
const tempUserData = path.join(os.tmpdir(), `narada-test-smoke-${Date.now()}`)

fs.mkdirSync(tempUserData, { recursive: true })

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const args = [
  runnerScript,
  `--user-data-dir=${tempUserData}`,
  '--no-sandbox',
  '--disable-gpu'
]

console.log('[NARADA Smoke] Meluncurkan runtime Electron asli...')
const startTime = Date.now()

const child = spawn(electronPath, args, { env, stdio: 'inherit' })

// Timeout guard 20 detik (mencegah proses menggantung tanpa batas)
const timeoutTimer = setTimeout(() => {
  console.error('🚨 TIMEOUT: Proses Electron melebihi batas waktu 20 detik!')
  child.kill('SIGKILL')
  process.exit(1)
}, 20000)

child.on('exit', (code) => {
  clearTimeout(timeoutTimer)
  const duration = Date.now() - startTime
  console.log(`[NARADA Smoke] Proses Electron selesai dengan exit code ${code} dalam ${duration}ms.`)

  try {
    fs.rmSync(tempUserData, { recursive: true, force: true })
  } catch {
    // Ignore temp cleanup error
  }

  if (code !== 0) {
    console.error(`🚨 DETEKSI KEGAGALAN: Electron smoke test keluar dengan error code ${code}`)
    process.exit(code || 1)
  }

  process.exit(0)
})

child.on('error', (err) => {
  clearTimeout(timeoutTimer)
  console.error('Failed to spawn real Electron for smoke test:', err)
  process.exit(1)
})
