import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' })
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))))
  })
}

await run('npm', ['run', 'build'])
console.log('')
console.log('Keys → http://127.0.0.1:5173/')
console.log('Open in Chrome. Ctrl+C to stop.')
console.log('')
await run('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', '5173'])
