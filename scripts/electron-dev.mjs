import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)

const require = createRequire(import.meta.url)
const electronPath = require('electron')

const vite = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', '5173'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env },
})

const waitOn = spawn(
  'npx',
  ['wait-on', 'http-get://127.0.0.1:5173', '--timeout', '60000'],
  { stdio: 'inherit', shell: process.platform === 'win32' },
)

waitOn.on('exit', (code) => {
  if (code !== 0) {
    vite.kill()
    process.exit(code ?? 1)
  }
  const electron = spawn(
    electronPath,
    ['.'],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173',
      },
    },
  )
  const shutdown = () => {
    electron.kill()
    vite.kill()
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  electron.on('exit', () => {
    vite.kill()
    process.exit(0)
  })
})

vite.on('exit', (code) => {
  if (code && code !== 0) process.exit(code)
})
