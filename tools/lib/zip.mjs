/**
 * A dependency-free zip writer: deflate from node:zlib, the CRC-32 table
 * computed here, the local headers, the central directory and the end record
 * written by hand. Enough for a download bundle (files under 4 GB, fewer than
 * 65,535 entries, no zip64). Entries are sorted and dated to one fixed time, so
 * the same files always make the same bytes.
 *
 * Used by tools/build-trial-bundle.mjs.
 */
import { deflateRawSync } from 'node:zlib'

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

/** @param {Uint8Array} buf */
export function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** DOS date and time for a Date, as the zip format stores them. */
function dosDateTime(d) {
  const time = (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | Math.floor(d.getUTCSeconds() / 2)
  const date = ((d.getUTCFullYear() - 1980) << 9) | ((d.getUTCMonth() + 1) << 4) | d.getUTCDate()
  return { time, date }
}

/** Already-compressed formats gain nothing from deflate; store them. */
const STORED = /\.(?:zip|tgz|gz|png|jpe?g|webp|gif|mp3|mp4|woff2)$/i

/**
 * @param {Array<{ path: string, data: Uint8Array, executable?: boolean }>} entries
 *   `path` uses forward slashes; directories are implied by the paths.
 * @param {{ date?: Date }} [opts]
 * @returns {Buffer}
 */
export function createZip(entries, { date = new Date(Date.UTC(2026, 0, 1)) } = {}) {
  const { time, date: day } = dosDateTime(date)
  const sorted = [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  const locals = []
  const centrals = []
  let offset = 0
  for (const e of sorted) {
    if (!e.path || e.path.startsWith('/') || e.path.includes('\\') || e.path.split('/').includes('..')) {
      throw new Error(`zip: bad entry path "${e.path}"`)
    }
    const name = Buffer.from(e.path, 'utf8')
    const raw = Buffer.from(e.data.buffer, e.data.byteOffset, e.data.byteLength)
    const crc = crc32(raw)
    let method = 0
    let body = raw
    if (!STORED.test(e.path) && raw.length > 0) {
      const deflated = deflateRawSync(raw, { level: 9 })
      if (deflated.length < raw.length) {
        method = 8
        body = deflated
      }
    }
    if (offset + 30 + name.length + body.length > 0xffffffff) throw new Error('zip: archive over 4 GB')

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(0x0800, 6) // UTF-8 names
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(day, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    locals.push(local, name, body)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE((3 << 8) | 20, 4) // made by: Unix, so the mode below is read
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(method, 10)
    central.writeUInt16LE(time, 12)
    central.writeUInt16LE(day, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(body.length, 20)
    central.writeUInt32LE(raw.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt16LE(0, 30) // extra
    central.writeUInt16LE(0, 32) // comment
    central.writeUInt16LE(0, 34) // disk
    central.writeUInt16LE(0, 36) // internal attributes
    const mode = 0o100000 | (e.executable ? 0o755 : 0o644)
    central.writeUInt32LE((mode << 16) >>> 0, 38)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, name)

    offset += 30 + name.length + body.length
  }
  if (sorted.length > 0xffff) throw new Error('zip: more than 65,535 entries')
  const centralSize = centrals.reduce((n, b) => n + b.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(sorted.length, 8)
  end.writeUInt16LE(sorted.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, ...centrals, end])
}
