/**
 * Spawn HLS server (8081) and DASH server (8082) so both run with one command.
 */

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverScript = path.join(__dirname, 'serve-static.js')

const hls = spawn('node', [serverScript, '8081', 'media/hls'], {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..'),
})
const dash = spawn('node', [serverScript, '8082', 'media/dash'], {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..'),
})

;[hls, dash].forEach((proc) => {
  proc.on('error', (err) => {
    console.error(err)
    process.exit(1)
  })
  proc.on('exit', (code) => {
    if (code !== 0 && code !== null) process.exit(code)
  })
})

process.on('SIGINT', () => {
  hls.kill()
  dash.kill()
  process.exit(0)
})
