#!/usr/bin/env node
// Serves the SvGrid demo browser in ./demos on http://localhost and opens it.
// No dependencies: Node 18 or newer is all it needs. A browser will not run
// the demos straight from the file system (module scripts and WebAssembly are
// blocked on file:// URLs), which is why this small server is here.
//
//   node serve.mjs            port 5175, or the next free one
//   node serve.mjs --port 8080
//   node serve.mjs --no-open  do not open a browser
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, normalize, extname, dirname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), 'demos')
const args = process.argv.slice(2)
const portArg = args.indexOf('--port')
let port = portArg >= 0 ? Number(args[portArg + 1]) : 5175
const open = !args.includes('--no-open')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    let path = normalize(join(ROOT, decodeURIComponent(url.pathname)))
    if (path !== ROOT && !path.startsWith(ROOT + sep)) {
      res.writeHead(403).end()
      return
    }
    let info = await stat(path).catch(() => null)
    if (info?.isDirectory()) {
      path = join(path, 'index.html')
      info = await stat(path).catch(() => null)
    }
    if (!info) {
      // A route such as /demos/01-quick-start/ is a page of the app, not a
      // file: answer it with the app, as svgrid.com does. A missing file
      // (it has an extension) stays a 404.
      if (extname(url.pathname)) {
        res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found')
        return
      }
      path = join(ROOT, 'index.html')
    }
    const body = await readFile(path)
    res.writeHead(200, {
      'content-type': TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    })
    res.end(body)
  } catch {
    res.writeHead(500).end()
  }
})

function listen(attempt = 0) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && portArg < 0 && attempt < 20) {
      port += 1
      listen(attempt + 1)
    } else {
      console.error(`Could not start the demo server: ${err.message}`)
      process.exit(1)
    }
  })
  server.listen(port, '127.0.0.1', () => {
    const address = `http://localhost:${port}/demos/`
    console.log(`SvGrid demos: ${address}`)
    console.log('Press Ctrl+C to stop.')
    if (open) openBrowser(address)
  })
}

function openBrowser(address) {
  const cmd = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open'
  const cmdArgs = process.platform === 'win32' ? ['/c', 'start', '', address] : [address]
  try {
    spawn(cmd, cmdArgs, { stdio: 'ignore', detached: true }).unref()
  } catch {
    // No browser to open: the address is printed above.
  }
}

listen()
