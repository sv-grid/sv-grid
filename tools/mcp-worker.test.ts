/**
 * Drives the remote (Cloudflare Worker) MCP server the way a client would:
 * a real JSON-RPC handshake against its `fetch` handler, with a stand-in
 * ASSETS binding that reads the generated corpus off disk.
 *
 * The Worker speaks Streamable HTTP by hand rather than through the MCP SDK
 * (the SDK's HTTP transport needs node:http, which a Worker does not have), so
 * the protocol details here - 202 for a notification, 405 on GET, the error
 * codes - are ours to get right and nothing else checks them.
 *
 * Needs `workers/svgrid-mcp/pnpm build:data` to have run, which in turn needs
 * the MCP package built. Skips itself otherwise, the same way the stdio tests
 * skip without dist.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORKER_DIR = join(ROOT, 'workers', 'svgrid-mcp')
const PUBLIC_DIR = join(WORKER_DIR, 'public')
const ready =
  existsSync(join(WORKER_DIR, 'src', 'generated', 'index.js')) &&
  existsSync(join(PUBLIC_DIR, '_data', 'docs.json'))

type Fetcher = (request: Request, env: unknown) => Promise<Response>

const env = {
  PUBLIC_URL: 'https://mcp.svgrid.com',
  ASSETS: {
    async fetch(input: Request | string) {
      const url = new URL(typeof input === 'string' ? input : input.url)
      const file = join(PUBLIC_DIR, decodeURIComponent(url.pathname))
      if (!existsSync(file)) return new Response('not found', { status: 404 })
      return new Response(readFileSync(file, 'utf8'), {
        headers: { 'Content-Type': 'application/json' },
      })
    },
  },
}

async function loadWorker(): Promise<{ fetch: Fetcher }> {
  const mod = (await import(join(WORKER_DIR, 'src', 'index.ts') as string)) as {
    default: { fetch: Fetcher }
  }
  return mod.default
}

let nextId = 0

async function rpc(method: string, params: unknown) {
  const worker = await loadWorker()
  const res = await worker.fetch(
    new Request('https://mcp.svgrid.com/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++nextId, method, params }),
    }),
    env,
  )
  return { status: res.status, body: res.status === 202 ? null : ((await res.json()) as never) }
}

/** The text payload of a tools/call result, minus the shared docs footer. */
async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  const { body } = (await rpc('tools/call', { name, arguments: args })) as {
    body: { result: { content: { text: string }[] } }
  }
  return body.result.content.map((c) => c.text).join('').split('\n\nSvGrid reference')[0]!
}

describe.skipIf(!ready)('remote MCP worker speaks the protocol', () => {
  it('completes a handshake and advertises its tools', async () => {
    const init = (await rpc('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'guardrail', version: '1' },
    })) as { body: { result: { protocolVersion: string; capabilities: unknown; serverInfo: { name: string } } } }

    expect(init.body.result.protocolVersion).toBe('2025-06-18')
    expect(init.body.result.serverInfo.name).toBe('svgrid')
    expect(init.body.result.capabilities).toHaveProperty('tools')

    const list = (await rpc('tools/list', {})) as { body: { result: { tools: { name: string }[] } } }
    const names = list.body.result.tools.map((t) => t.name)
    // `search` and `fetch` are named exactly that so a connector can index the
    // server; renaming either one silently drops it out of those clients.
    expect(names).toContain('search')
    expect(names).toContain('fetch')
    expect(names).toContain('check_svgrid_code')
    // The Studio tools belong to the stdio server; they need a filesystem.
    expect(names.filter((n) => n.startsWith('studio_'))).toHaveLength(0)
    expect(names.length).toBeLessThanOrEqual(8)
  })

  it('answers a notification with 202 and no body', async () => {
    const worker = await loadWorker()
    const res = await worker.fetch(
      new Request('https://mcp.svgrid.com/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }),
      }),
      env,
    )
    expect(res.status).toBe(202)
  })

  it('refuses GET /mcp, since a stateless server has no stream to open', async () => {
    const worker = await loadWorker()
    const res = await worker.fetch(new Request('https://mcp.svgrid.com/mcp'), env)
    expect(res.status).toBe(405)
    expect(res.headers.get('Allow')).toContain('POST')
  })

  it('ranks the canonical page first and includes matching demos', async () => {
    const body = JSON.parse(await callTool('search', { query: 'kanban board', limit: 5 }))
    expect(body.results[0].id).toBe('help/rows/kanban-board')
    expect(body.results.some((r: { id: string }) => r.id.startsWith('demo:'))).toBe(true)
  })

  it('fetches a doc body and a demo source from the asset store', async () => {
    const doc = await callTool('fetch', { id: 'help/rows/kanban-board' })
    expect(doc).toContain('# Kanban board mode')

    const demo = await callTool('fetch', { id: 'demo:11-stock-market' })
    expect(demo).toContain('<script')
    expect(demo).toContain('SvGrid')
  })

  it('checks code, and admits it did not compile it', async () => {
    const source = [
      '<script lang="ts">',
      "  import { SvGrid } from '@svgrid/grid'",
      '  const columns = [{ accessorKey: "name" }]',
      '  let rows = $state([])',
      '</script>',
      '<SvGrid rowData={rows} {columns} />',
    ].join('\n')

    const result = JSON.parse(await callTool('check_svgrid_code', { source, filename: 'P.svelte' }))
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d: { rule: string }) => d.rule)).toContain('svgrid/renamed-prop')
    // A Worker has no Svelte compiler, and the result has to say so rather
    // than letting a caller read `ok` as "this compiles".
    expect(result.compiler).toBe('unavailable')
    expect(result.summary).toMatch(/svelte-check/i)
  })

  it('reports unknown tools and methods as JSON-RPC errors', async () => {
    const badTool = (await rpc('tools/call', { name: 'nope', arguments: {} })) as {
      body: { error: { code: number } }
    }
    expect(badTool.body.error.code).toBe(-32602)

    const badMethod = (await rpc('frobnicate', {})) as { body: { error: { code: number } } }
    expect(badMethod.body.error.code).toBe(-32601)
  })

  it('serves a landing page naming its own endpoint', async () => {
    const worker = await loadWorker()
    const res = await worker.fetch(new Request('https://mcp.svgrid.com/'), env)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { endpoint: string; tools: string[] }
    expect(body.endpoint).toMatch(/\/mcp$/)
    expect(body.tools).toContain('check_svgrid_code')
  })
})
