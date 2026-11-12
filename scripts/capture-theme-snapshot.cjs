const { spawn } = require('child_process')
const path = require('path')

const electronPath = path.resolve(__dirname, '../node_modules/electron/dist/electron.exe')
const runnerScript = path.resolve(__dirname, 'runners/verify-tactical-steel-theme.cjs')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const args = [
  runnerScript,
  '--no-sandbox',
  '--disable-gpu'
]

const child = spawn(electronPath, args, { env, stdio: 'inherit' })

child.on('exit', (code) => {
  process.exit(code || 0)
})

child.on('error', (err) => {
  console.error('Failed to spawn Electron:', err)
  process.exit(1)
})
