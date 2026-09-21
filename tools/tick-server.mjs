/**
 * A WebSocket price feed for the market blotter demo (examples/src/demos/
 * 495-market-blotter-100k.svelte), so a reader can watch the grid take a
 * real socket instead of the in-page mock, or swap this for their own feed.
 *
 *   node tools/tick-server.mjs                 # ws://localhost:8787, 10,000 updates/s
 *   node tools/tick-server.mjs --port 9000 --rate 50000 --rows 100000
 *
 * Then open the demo with `?ws=ws://localhost:8787` in the URL.
 *
 * Message format, one JSON text frame every 16 ms:
 *
 *   { "t": [[id, last], [id, last], ...] }
 *
 * `id` is 1-based (the demo's instrument ids), `last` a price. Prices
 * random-walk from the last value sent, so a sorted grid has real work to do.
 *
 * No dependency: the handshake and the text-frame encoding of RFC 6455 are
 * forty lines, and a benchmark feed should not pull a package tree with it.
 * Text frames out, nothing read in beyond the close frame.
 */
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const PORT = Number(arg('port', 8787))
const RATE = Number(arg('rate', 10_000))
const ROWS = Number(arg('rows', 100_000))
const INTERVAL_MS = 16

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

/** One text frame: FIN + opcode 1, unmasked (server to client), 7/16/64-bit length. */
function textFrame(text) {
  const payload = Buffer.from(text, 'utf8')
  const n = payload.length
  let header
  if (n < 126) header = Buffer.from([0x81, n])
  else if (n < 65536) header = Buffer.from([0x81, 126, n >> 8, n & 0xff])
  else {
    header = Buffer.alloc(10)
    header[0] = 0x81
    header[1] = 127
    header.writeBigUInt64BE(BigInt(n), 2)
  }
  return Buffer.concat([header, payload])
}

// The feed state: one price per instrument, walked on every send.
let seed = 0xfeed
const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 0xffffffff
const last = new Float64Array(ROWS)
for (let i = 0; i < ROWS; i++) last[i] = Math.round((5 + rand() * 495) * 100) / 100

const clients = new Set()

function tick() {
  if (!clients.size) return
  const due = Math.round((RATE * INTERVAL_MS) / 1000)
  const t = new Array(due)
  for (let i = 0; i < due; i++) {
    const idx = (rand() * ROWS) | 0
    const next = Math.max(Math.round(last[idx] * (1 + (rand() - 0.5) * 0.004) * 100) / 100, 0.01)
    last[idx] = next
    t[i] = [idx + 1, next]
  }
  const frame = textFrame(JSON.stringify({ t }))
  for (const socket of clients) {
    if (socket.destroyed) { clients.delete(socket); continue }
    socket.write(frame)
  }
}

const server = createServer((_req, res) => {
  res.writeHead(426, { 'content-type': 'text/plain' })
  res.end('WebSocket endpoint: connect with ws://')
})

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key']
  if (!key || String(req.headers.upgrade).toLowerCase() !== 'websocket') {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
    return
  }
  const accept = createHash('sha1').update(key + GUID).digest('base64')
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  )
  socket.setNoDelay(true)
  clients.add(socket)
  console.log(`client connected (${clients.size})`)
  // A close frame (opcode 8) from the browser ends the session; anything else
  // the client sends is ignored, this feed is one-way.
  socket.on('data', (buf) => {
    if ((buf[0] & 0x0f) === 0x8) socket.end()
  })
  const drop = () => {
    clients.delete(socket)
    console.log(`client gone (${clients.size})`)
  }
  socket.on('close', drop)
  socket.on('error', drop)
})

server.listen(PORT, () => {
  console.log(`tick server on ws://localhost:${PORT}  ${RATE.toLocaleString()} updates/s over ${ROWS.toLocaleString()} instruments`)
  setInterval(tick, INTERVAL_MS)
})
