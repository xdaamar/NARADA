import { spawn } from 'child_process'
import path from 'path'

const electronPath = path.resolve('narada/node_modules/electron/dist/electron.exe')
const runnerScript = path.resolve('narada/scripts/runners/verify-ui-snapshot.cjs')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const child = spawn(electronPath, [runnerScript, '--no-sandbox', '--disable-gpu'], { env, stdio: 'inherit' })
child.on('exit', (code) => {
  console.log('[Snapshot Launcher] Electron finished with code:', code)
  process.exit(code || 0)
})
