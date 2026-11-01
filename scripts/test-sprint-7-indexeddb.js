#!/usr/bin/env node
/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — MASTER SPRINT 7 REAL CHROMIUM INDEXEDDB TEST LAUNCHER (Carry-over 8.2)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 */

import { spawn } from 'child_process'
import path from 'path'
import os from 'os'
import fs from 'fs'

const electronPath = path.resolve('node_modules/electron/dist/electron.exe')
const runnerScript = path.resolve('scripts/runners/indexeddb-electron-runner.cjs')
const tempUserData = path.join(os.tmpdir(), `narada-test-idb-${Date.now()}`)

fs.mkdirSync(tempUserData, { recursive: true })

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const args = [
  runnerScript,
  `--user-data-dir=${tempUserData}`,
  '--no-sandbox',
  '--disable-gpu',
  '--headless=new'
]

const child = spawn(electronPath, args, { env, stdio: 'inherit' })

child.on('exit', (code) => {
  try {
    fs.rmSync(tempUserData, { recursive: true, force: true })
  } catch {
    // Ignore cleanup error
  }
  process.exit(code || 0)
})

child.on('error', (err) => {
  console.error('Failed to spawn real Electron for IndexedDB test:', err)
  process.exit(1)
})
