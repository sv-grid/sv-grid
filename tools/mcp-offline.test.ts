import { describe, it, expect } from 'vitest'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The server must work with no network at all, and must never try to use one.
 *
 * This is the axis the competing MCP servers cannot follow, because it is their
 * business model rather than an implementation detail. Telerik's package is
 * 94 KB and proxies every one of its nine "assistants" over gRPC to
 * `contextapi.telerik.com`, sending the licence key and machine metadata each
 * time. Syncfusion's is 75 KB, registers one tool, and POSTs the query to
 * `helpbot.syncfusion.com` behind an API key. Neither can answer a question
 * offline, and neither can promise that your questions stay on your machine.
 *
 * Ours ships the whole corpus - 8 MB - so it can. "No network" is worth nothing
 * as a README sentence and a lot as a test that fails when someone adds a
 * fetch, so this drives a full session against a server whose network is booby
 * trapped and asserts every answer is still correct.
 *
 * One honest caveat, which the docs also state: the MCP Apps PREVIEW loads the
 * grid from a CDN. That happens in the client's sandboxed iframe, never in this
 * process, and only when a preview is actually rendered.
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SERVER = join(ROOT, 'packages', 'mcp', 'dist', 'index.js')
const hasDist = existsSync(SERVER)

/**
 * A preload that makes every outbound network primitive throw.
 *
 * Written to a temp file and injected with `--import`, so it is in place before
 * the server's first line runs.
 */
const TRAP = `
import { register } from 'node:module'
void register
const boom = (what) => () => {
  throw new Error('NETWORK_ATTEMPTED: ' + what)
}
globalThis.fetch = boom('fetch')
const http = await import('node:http')
const https = await import('node:https')
const net = await import('node:net')
const dns = await import('node:dns')
http.default.request = boom('http.request')
http.default.get = boom('http.get')
https.default.request = boom('https.request')
https.default.get = boom('https.get')
net.default.connect = boom('net.connect')
net.default.createConnection = boom('net.createConnection')
dns.default.lookup = boom('dns.lookup')
`

type Rpc = { id?: number; result?: Record<string, unknown>; error?: { message?: string } }

/** Drive a full session against the trapped server and collect what happened. */
async function session(): Promise<{
  replies: Map<number, Rpc>
  stderr: string
  ids: Map<string, number>
  sent: number
}> {
  const { mkdtempSync, writeFileSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const dir = mkdtempSync(join(tmpdir(), 'svgrid-offline-'))
  const trapPath = join(dir, 'trap.mjs')
  writeFileSync(trapPath, TRAP)

  // `--import` needs a file:// URL. On Windows a bare absolute path is read as
  // the scheme `c:` and Node refuses to load it, which silently produced a
  // server that never started and a test that looked like a protocol failure.
  const { pathToFileURL } = await import('node:url')
  const child = spawn(process.execPath, ['--import', pathToFileURL(trapPath).href, SERVER], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  const replies = new Map<number, Rpc>()
  let stderr = ''
  let buf = ''
  child.stderr.on('data', (d: Buffer) => (stderr += d.toString()))
  child.stdout.on('data', (chunk: Buffer) => {
    buf += chunk.toString()
    let nl: number
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line) continue
      try {
        const msg = JSON.parse(line) as Rpc
        if (msg.id != null) replies.set(msg.id, msg)
      } catch {
        // Not a JSON-RPC frame.
      }
    }
  })

  // Ids are recorded by label rather than counted by hand: the first version
  // asserted on hard-coded numbers and read the `prompts/list` reply as the
  // search result, which looks exactly like a broken search.
  const ids = new Map<string, number>()
  let id = 0
  const send = (method: string, params: unknown = {}, label?: string) => {
    id += 1
    if (label) ids.set(label, id)
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
  }

  send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'offline', version: '1.0.0' },
  })
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n')

  // Everything a real session touches, including the two halves that would be
  // most tempting to fetch: the corpus and the preview UI.
  send('tools/list', {}, 'tools')
  send('resources/list', {}, 'resources')
  send('prompts/list', {}, 'prompts')
  send('tools/call', { name: 'svgrid_search', arguments: { query: 'kanban board' } }, 'search')
  send('tools/call', { name: 'svgrid_get', arguments: { ref: 'help/export' } }, 'get')
  send(
    'tools/call',
    {
      name: 'svgrid_check_code',
      arguments: { source: "<script>\n  import { SvGrid } from '@svgrid/grid'\n</script>\n<SvGrid rowData={[]} columns={[]} />" },
    },
    'check',
  )
  send(
    'tools/call',
    { name: 'svgrid_preview', arguments: { columns: [{ field: 'a', header: 'A' }], data: [{ a: 1 }] } },
    'preview',
  )
  send('resources/read', { uri: 'ui://svgrid/preview.html' }, 'ui')
  send('prompts/get', { name: 'build_grid', arguments: { description: 'orders' } }, 'prompt')

  await new Promise((r) => setTimeout(r, 6000))
  child.kill()
  return { replies, stderr, ids, sent: id }
}

describe.skipIf(!hasDist)('the server works with no network', () => {
  it('answers a full session without attempting a single connection', async () => {
    const { replies, stderr, ids, sent } = await session()

    expect(stderr, 'the server tried to use the network').not.toContain('NETWORK_ATTEMPTED')

    // Every request answered, and none of them an error.
    for (let id = 1; id <= sent; id++) {
      const reply = replies.get(id)
      expect(reply, `request ${id} went unanswered`).toBeTruthy()
      expect(reply?.error, `request ${id} failed: ${reply?.error?.message}`).toBeUndefined()
    }

    // And the answers are real, not empty shells.
    const body = (label: string) => JSON.stringify(replies.get(ids.get(label)!)?.result ?? {})
    expect(body('search')).toContain('kanban')
    expect(body('get').length).toBeGreaterThan(500)
    expect(body('check'), 'the validator went quiet offline').toContain('rowData')
    expect(body('ui')).toContain('sv-grid')
    expect(body('preview')).toContain('structuredContent')
    expect(body('prompt')).toContain('svgrid_check_code')
  }, 90_000)

  it('has no network client in its dependencies', async () => {
    // The guarantee is only as good as the dependency list. A transport landing
    // here is how a local server quietly becomes a proxy.
    const pkg = JSON.parse(readFileSync(join(ROOT, 'packages/mcp/package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
    }
    const deps = Object.keys(pkg.dependencies ?? {})
    const transports = deps.filter((d) =>
      /^(axios|node-fetch|undici|got|superagent|request|ky|cross-fetch)$/.test(d) || d.startsWith('@grpc/'),
    )
    expect(transports, `network client(s) added to @svgrid/mcp: ${transports.join(', ')}`).toEqual([])
  })

  it('makes no outbound call anywhere in the server source', async () => {
    // data.ts is excluded on purpose: it is the corpus, and the demo sources
    // inside it are full of `fetch(` as example code.
    const { readdirSync } = await import('node:fs')
    const dir = join(ROOT, 'packages', 'mcp', 'src')
    const files = readdirSync(dir).filter(
      (f: string) => f.endsWith('.ts') && f !== 'data.ts' && !f.endsWith('.test.ts'),
    )
    expect(files.length).toBeGreaterThan(5)

    const offenders: string[] = []
    for (const f of files) {
      const src = readFileSync(join(dir, f), 'utf8')
      // Strip comments and template literals: preview.ts legitimately contains
      // CDN URLs inside the HTML it serves to the CLIENT.
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
        .replace(/`(?:\\[\s\S]|[^`\\])*`/g, '``')
      if (/\bfetch\s*\(|\bfrom\s+['"]node:(http|https|net)['"]|\brequire\s*\(\s*['"]axios/.test(code)) {
        offenders.push(f)
      }
    }
    expect(offenders, `outbound network in: ${offenders.join(', ')}`).toEqual([])
  })
})
