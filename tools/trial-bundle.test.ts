/**
 * The trial download: the zip writer behind svgrid-trial.zip, and the worker
 * that records who started a trial (workers/svgrid-trial).
 *
 * The worker's SQL runs against node:sqlite wrapped as a D1 binding, so the
 * upsert, the support date and the hourly limit are checked for real. Node 20
 * has no node:sqlite; there those cases skip and the rest still run.
 *
 * Run: `pnpm vitest run tools/trial-bundle.test.ts`
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
// @ts-expect-error - plain .mjs helper without types
import { createZip, crc32 } from './lib/zip.mjs'
// @ts-expect-error - plain worker module without types
import worker, { parseTrial, supportUntil, toCsv, corsHeaders, purge } from '../workers/svgrid-trial/src/index.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Reads a zip back through its central directory: name -> { data, mode }. */
function readZip(buf: Buffer) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  const count = buf.readUInt16LE(end + 10)
  let p = buf.readUInt32LE(end + 16)
  const out = new Map<string, { data: Buffer; mode: number }>()
  for (let i = 0; i < count; i++) {
    expect(buf.readUInt32LE(p)).toBe(0x02014b50)
    const method = buf.readUInt16LE(p + 10)
    const crc = buf.readUInt32LE(p + 16)
    const size = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const mode = buf.readUInt32LE(p + 38) >>> 16
    const local = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    const localNameLen = buf.readUInt16LE(local + 26)
    const body = buf.subarray(local + 30 + localNameLen, local + 30 + localNameLen + size)
    const data = method === 8 ? inflateRawSync(body) : Buffer.from(body)
    expect(crc32(data)).toBe(crc)
    out.set(name, { data, mode })
    p += 46 + nameLen
  }
  return out
}

describe('zip writer', () => {
  it('round-trips text, binary and empty files with their CRCs and modes', () => {
    const text = Buffer.from('hello '.repeat(500))
    const bin = Buffer.from(Array.from({ length: 4096 }, (_, i) => (i * 7919) & 0xff))
    const zip = createZip([
      { path: 'b/serve.mjs', data: text, executable: true },
      { path: 'a/blob.wasm', data: bin },
      { path: 'a/empty.txt', data: Buffer.alloc(0) },
      { path: 'a/pkg.tgz', data: bin },
    ])
    const files = readZip(zip)
    expect([...files.keys()]).toEqual(['a/blob.wasm', 'a/empty.txt', 'a/pkg.tgz', 'b/serve.mjs'])
    expect(files.get('b/serve.mjs')!.data.equals(text)).toBe(true)
    expect(files.get('a/blob.wasm')!.data.equals(bin)).toBe(true)
    expect(files.get('a/empty.txt')!.data.length).toBe(0)
    expect(files.get('b/serve.mjs')!.mode & 0o777).toBe(0o755)
    expect(files.get('a/pkg.tgz')!.mode & 0o777).toBe(0o644)
  })

  it('makes the same bytes from the same files, whatever their order', () => {
    const a = { path: 'x/1.txt', data: Buffer.from('one') }
    const b = { path: 'x/2.txt', data: Buffer.from('two') }
    expect(createZip([a, b]).equals(createZip([b, a]))).toBe(true)
  })

  it('refuses paths that would escape the folder they unpack into', () => {
    for (const path of ['../x', '/abs', 'a/../../b', 'a\\b']) {
      expect(() => createZip([{ path, data: Buffer.from('x') }])).toThrow(/bad entry path/)
    }
  })

  it('matches the CRC-32 check value', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926)
  })
})

describe('trial bundle files', () => {
  it('README placeholders are all filled by the builder', () => {
    const readme = readFileSync(join(ROOT, 'tools/trial-bundle/README.md'), 'utf8')
    const builder = readFileSync(join(ROOT, 'tools/build-trial-bundle.mjs'), 'utf8')
    for (const [, key] of readme.matchAll(/\{\{([A-Z_]+)\}\}/g)) expect(builder).toContain(`'{{${key}}}'`)
  })

  it('the bundle text names the same support window and address as the site', () => {
    const readme = readFileSync(join(ROOT, 'tools/trial-bundle/README.md'), 'utf8')
    expect(readme).toContain('30 days')
    expect(readme).toContain('support@jqwidgets.com')
  })
})

describe('trial worker: form and helpers', () => {
  it('accepts a clean form and lower-cases the email', () => {
    expect(parseTrial({ name: ' Ada ', email: 'Ada@Example.COM', company: 'Analytical', source: 'home-hero' })).toEqual({
      name: 'Ada', email: 'ada@example.com', company: 'Analytical', source: 'home-hero', honeypot: false,
    })
  })

  it('rejects a missing name or a malformed email', () => {
    expect(parseTrial({ name: '', email: 'a@b.co' }).error).toMatch(/name/)
    for (const email of ['', 'ada', 'ada@', 'ada@example', 'a b@c.de', '<x>@y.zz']) {
      expect(parseTrial({ name: 'Ada', email }).error).toMatch(/email/)
    }
  })

  it('flags the honeypot and maps an odd source to unknown', () => {
    const f = parseTrial({ name: 'Bot', email: 'bot@spam.io', website: 'http://spam', source: '<script>' })
    expect(f.honeypot).toBe(true)
    expect(f.source).toBe('unknown')
  })

  it('support ends 30 days after the download', () => {
    expect(supportUntil(new Date('2026-10-14T12:00:00Z'))).toBe('2026-11-13')
  })

  it('CSV quotes commas and quotes, and defuses spreadsheet formulas', () => {
    const csv = toCsv([{ name: 'Lovelace, Ada', email: 'a@b.co', company: '=HYPERLINK("x")', downloads: 2 }])
    expect(csv.split('\r\n')[1]).toBe(`,"Lovelace, Ada",a@b.co,"'=HYPERLINK(""x"")",,,2,,`)
  })

  it('answers CORS only for the configured origins', () => {
    const env = { ALLOWED_ORIGIN: 'https://svgrid.com,http://localhost:5173' }
    const ok = corsHeaders(new Request('https://t/trial', { headers: { origin: 'https://svgrid.com' } }), env)
    const no = corsHeaders(new Request('https://t/trial', { headers: { origin: 'https://evil.example' } }), env)
    expect(ok['access-control-allow-origin']).toBe('https://svgrid.com')
    expect(no['access-control-allow-origin']).toBeUndefined()
  })
})

// node:sqlite as a D1 binding: prepare().bind().first()/all()/run() and batch().
function sqlite() {
  try {
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite')
    return DatabaseSync
  } catch {
    return null
  }
}
const DatabaseSync = sqlite()

function d1() {
  const db = new DatabaseSync(':memory:')
  db.exec(readFileSync(join(ROOT, 'workers/svgrid-trial/schema.sql'), 'utf8'))
  const statement = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => statement(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => db.prepare(sql).run(...args),
  })
  return {
    db,
    binding: {
      prepare: (sql: string) => statement(sql),
      batch: async (stmts: Array<{ run: () => Promise<unknown> }>) => {
        for (const s of stmts) await s.run()
      },
    },
  }
}

const ctx = { waitUntil: () => {} }
const post = (body: unknown, ip = '203.0.113.7') =>
  new Request('https://trial.svgrid.com/trial', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://svgrid.com', 'cf-connecting-ip': ip },
    body: JSON.stringify(body),
  })

describe.skipIf(!DatabaseSync)('trial worker: storage (node:sqlite)', () => {
  it('stores a trial, then counts a repeat download without moving the support date', async () => {
    const { db, binding } = d1()
    const env = { DB: binding, ALLOWED_ORIGIN: 'https://svgrid.com', ADMIN_TOKEN: 'secret-token' }
    const first = await worker.fetch(post({ name: 'Ada', email: 'ada@example.com', source: 'home-hero' }), env, ctx)
    expect(first.status).toBe(200)
    const { supportUntil: until } = await first.json()
    expect(until).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    db.prepare("UPDATE trials SET support_until = '2026-01-01'").run()
    const again = await worker.fetch(post({ name: 'Ada L.', email: 'ADA@example.com', company: 'AE' }), env, ctx)
    expect((await again.json()).supportUntil).toBe('2026-01-01')
    const row = db.prepare('SELECT * FROM trials').get() as Record<string, unknown>
    expect(row).toMatchObject({ email: 'ada@example.com', name: 'Ada L.', company: 'AE', source: 'home-hero', downloads: 2 })
  })

  it('stores nothing for the honeypot, and limits an address to five requests an hour', async () => {
    const { db, binding } = d1()
    const env = { DB: binding, ALLOWED_ORIGIN: 'https://svgrid.com' }
    const bot = await worker.fetch(post({ name: 'Bot', email: 'bot@spam.io', website: 'x' }), env, ctx)
    expect(bot.status).toBe(200)
    expect((db.prepare('SELECT COUNT(*) AS n FROM trials').get() as { n: number }).n).toBe(0)

    const statuses = []
    for (let i = 0; i < 6; i++) statuses.push((await worker.fetch(post({ name: 'P', email: `p${i}@example.com` }, '198.51.100.1'), env, ctx)).status)
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429])
    expect((await worker.fetch(post({ name: 'Q', email: 'q@example.com' }, '198.51.100.2'), env, ctx)).status).toBe(200)
    expect(JSON.stringify(db.prepare('SELECT * FROM trial_requests').all())).not.toContain('198.51.100')
  })

  it('purges people 12 months after their last download, and old rate-limit rows', async () => {
    const { db, binding } = d1()
    const env = { DB: binding, ALLOWED_ORIGIN: 'https://svgrid.com' }
    await worker.fetch(post({ name: 'Old', email: 'old@example.com' }), env, ctx)
    await worker.fetch(post({ name: 'New', email: 'new@example.com' }), env, ctx)
    db.prepare("UPDATE trials SET last_download_at = '2025-01-01T00:00:00.000Z' WHERE email = 'old@example.com'").run()
    db.prepare("UPDATE trial_requests SET created_at = '2025-01-01T00:00:00.000Z'").run()
    await purge(env, new Date())
    expect(db.prepare('SELECT email FROM trials').all()).toEqual([{ email: 'new@example.com' }])
    expect((db.prepare('SELECT COUNT(*) AS n FROM trial_requests').get() as { n: number }).n).toBe(0)
  })

  it('exports CSV only with the admin token', async () => {
    const { binding } = d1()
    const env = { DB: binding, ALLOWED_ORIGIN: 'https://svgrid.com', ADMIN_TOKEN: 'secret-token' }
    await worker.fetch(post({ name: 'Ada', email: 'ada@example.com' }), env, ctx)
    const denied = await worker.fetch(new Request('https://trial.svgrid.com/trials.csv', { headers: { authorization: 'Bearer nope-nope-no' } }), env, ctx)
    expect(denied.status).toBe(401)
    const csv = await (await worker.fetch(new Request('https://trial.svgrid.com/trials.csv', { headers: { authorization: 'Bearer secret-token' } }), env, ctx)).text()
    expect(csv).toContain('ada@example.com')
  })
})
