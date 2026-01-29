/**
 * Static file server with CORS for local HLS/DASH media.
 * Usage: node server/serve-static.js <port> <directory>
 * Example: node server/serve-static.js 8081 media/hls
 */

import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const port = parseInt(process.argv[2], 10) || 8081
const dir = process.argv[3] || 'media/hls'
const serveDir = path.resolve(ROOT, dir)

const MIME = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.mpd': 'application/dash+xml',
  '.m4s': 'video/iso.segment',
  '.mp4': 'video/mp4',
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Range')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' })
    res.end('Method Not Allowed')
    return
  }

  const urlPath = req.url?.split('?')[0] || '/'
  const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, '')
  const filePath = path.join(serveDir, safePath)

  if (!filePath.startsWith(serveDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' })
    res.end('Forbidden')
    return
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not Found')
      return
    }

    const ext = path.extname(filePath)
    const contentType = MIME[ext] || 'application/octet-stream'
    res.setHeader('Content-Type', contentType)
    res.setHeader('Accept-Ranges', 'bytes')

    const range = req.headers.range
    if (range) {
      const match = range.match(/bytes=(\d+)-(\d*)/)
      if (match) {
        const start = parseInt(match[1], 10)
        const end = match[2] ? parseInt(match[2], 10) : stat.size - 1
        const len = end - start + 1
        const stream = fs.createReadStream(filePath, { start, end })
        res.writeHead(206, {
          'Content-Length': len,
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        })
        stream.pipe(res)
        return
      }
    }

    res.setHeader('Content-Length', stat.size)
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    fs.createReadStream(filePath).pipe(res)
  })
})

server.listen(port, () => {
  console.log(`Serving ${serveDir} at http://localhost:${port}/`)
})
