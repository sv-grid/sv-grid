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
import { skillToolNames } from './lib/skill-tools.mjs'

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

async function rpc(method: string, params: unknown, vars: Record<string, string> = {}) {
  const worker = await loadWorker()
  const res = await worker.fetch(
    new Request('https://mcp.svgrid.com/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++nextId, method, params }),
    }),
    { ...env, ...vars },
  )
  return { status: res.status, body: res.status === 202 ? null : ((await res.json()) as never) }
}

/** The text payload of a tools/call result, minus the shared docs footer. */
async function callTool(name: string, args: Record<string, unknown>, vars: Record<string, string> = {}): Promise<string> {
  const { body } = (await rpc('tools/call', { name, arguments: args }, vars)) as {
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
    // Clients put `instructions` in front of the model on every turn; it must
    // name the check tool by the name this server lists.
    const instructions = (init.body.result as { instructions?: string }).instructions ?? ''
    expect(instructions).toContain('svgrid_check_code')
    expect(instructions).toMatch(/Svelte 5/)

    const list = (await rpc('tools/list', {})) as { body: { result: { tools: { name: string }[] } } }
    const names = list.body.result.tools.map((t) => t.name)
    // `search` and `fetch` are named exactly that so a connector can index the
    // server; renaming either one silently drops it out of those clients.
    expect(names).toContain('search')
    expect(names).toContain('fetch')
    // The npm name: Claude Code only calls a listed tool, and the Agent Skill
    // shipped in the same plugin tells the model to call this one.
    expect(names).toContain('svgrid_check_code')
    // The Studio tools belong to the stdio server; they need a filesystem.
    expect(names.filter((n) => n.startsWith('studio_'))).toHaveLength(0)
    expect(names.length).toBeLessThanOrEqual(8)
    // The Claude Code plugin installs this server next to the Skill; every
    // hosted tool the Skill names has to be one a client can call.
    const { hosted } = skillToolNames()
    expect(hosted.length).toBeGreaterThan(2)
    for (const n of hosted) expect(names, `SKILL.md names ${n}`).toContain(n)
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

    const result = JSON.parse(await callTool('svgrid_check_code', { source, filename: 'P.svelte' }, { COMPILE: 'off' }))
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d: { rule: string }) => d.rule)).toContain('svgrid/renamed-prop')
    // With the compile switched off the result has to say so, rather than
    // letting a caller read `ok` as "this compiles".
    expect(result.compiler).toBe('unavailable')
    expect(result.summary).toMatch(/svelte-check/i)
    // The corrected copy comes back here as it does from the npm server.
    expect(result.applied.length).toBeGreaterThan(0)
    expect(result.fixed).toContain('<SvGrid data={rows}')
  })

  it('compiles with the bundled Svelte and reports a file that does not parse', async () => {
    const broken = '<script lang="ts">\n  let a = $state(1)\n</script>\n\n{#if a}\n  <p>yes</p>\n'
    const result = JSON.parse(await callTool('svgrid_check_code', { source: broken, filename: 'Broken.svelte' }))
    expect(result.compiler, 'svelte is a dependency of the worker; is it installed?').toBe('svelte')
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some((d: { severity: string; rule: string }) => d.severity === 'error' && d.rule.startsWith('svelte/'))).toBe(true)
  })

  it('takes the file as `code` too, the name models guess first', async () => {
    const result = JSON.parse(await callTool('svgrid_check_code', { code: '<p>hi</p>' }))
    expect(result.ok).toBe(true)
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
    expect(body.tools).toContain('svgrid_check_code')
  })
})

/**
 * The npm package's 3.0 tool names, answered here too.
 *
 * `search` and `fetch` keep their names because a one-click connector needs
 * those two exact ones to index a remote server, so the two servers cannot
 * advertise an identical surface. They can still ANSWER to the same names.
 *
 * This exists because the first attempt did not work at all: the aliases were
 * resolved inside `callTool`, one line below a dispatcher check that rejects
 * any name not in `TOOLS`. Every alias was rejected before it could be
 * resolved. It type-checked, it shipped, and nothing covered it - a model that
 * learned `svgrid_search` from npm got "Unknown tool" from the hosted server,
 * which is the exact failure the aliases were added to prevent.
 */
describe.skipIf(!ready)('the hosted server answers the npm tool names', () => {
  it('resolves svgrid_search to the ranked search', async () => {
    const raw = await callTool('svgrid_search', { query: 'kanban board' })
    expect(raw, 'svgrid_search was rejected').not.toMatch(/Unknown tool/)
    expect(raw).toContain('kanban')
  })

  it('resolves svgrid_get, translating ref -> id', async () => {
    // The two tools disagree on the argument name; resolving the alias without
    // translating it would return "id is required" instead of a doc.
    const raw = await callTool('svgrid_get', { ref: 'help/export' })
    expect(raw).not.toMatch(/Unknown tool|is required/)
    expect(raw.length).toBeGreaterThan(200)
  })

  it('resolves check_svgrid_code, the name this server listed before', async () => {
    const raw = await callTool('check_svgrid_code', {
      source: '<script>\n  import { SvGrid } from "@svgrid/grid"\n</script>\n<SvGrid notARealProp />',
    })
    expect(raw).not.toMatch(/Unknown tool/)
    expect(raw).toContain('notARealProp')
  })

  it('still rejects a name that is neither a tool nor an alias', async () => {
    const { body } = (await rpc('tools/call', { name: 'nope_not_real', arguments: {} })) as {
      body: { error?: { message?: string }; result?: unknown }
    }
    expect(body.error?.message).toMatch(/Unknown tool: nope_not_real/)
  })

  it('does not advertise the aliases, so they cost nothing', async () => {
    const { body } = (await rpc('tools/list', {})) as {
      body: { result: { tools: { name: string }[] } }
    }
    const names = body.result.tools.map((t) => t.name)
    for (const alias of ['svgrid_search', 'svgrid_get', 'check_svgrid_code']) {
      expect(names, `${alias} should not be listed`).not.toContain(alias)
    }
  })
})

/**
 * Parity: the hosted server offers what the npm one does.
 *
 * Hosted is the low-friction path - a URL, no Node, no install - and it was the
 * path missing the preview, which is the clearest thing this server has that
 * the competing ones do not. Resources and prompts were missing too: it
 * advertised `{"tools":{}}` and answered the other four methods with "Method
 * not found".
 */
describe.skipIf(!ready)('the hosted server has resources, prompts and the preview', () => {
  it('advertises all three capabilities', async () => {
    const { body } = (await rpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'parity', version: '1.0.0' },
    })) as { body: { result: { capabilities: Record<string, unknown> } } }
    const caps = body.result.capabilities
    expect(caps.tools).toBeTruthy()
    expect(caps.resources, 'resources not advertised').toBeTruthy()
    expect(caps.prompts, 'prompts not advertised').toBeTruthy()
  })

  it('lists resources in pages, with the preview on the first', async () => {
    const { body } = (await rpc('resources/list', {})) as {
      body: { result: { resources: { uri: string }[]; nextCursor?: string } }
    }
    const uris = body.result.resources.map((r) => r.uri)
    expect(uris.length).toBeLessThanOrEqual(100)
    expect(uris, 'the preview UI must be reachable from page one').toContain('ui://svgrid/preview.html')
    // All 784 in one response is ~37k tokens - worse than any tool listing.
    expect(body.result.nextCursor, 'resources are not paged').toBeTruthy()
  })

  it('reads a doc and a demo through resources/read', async () => {
    const doc = (await rpc('resources/read', { uri: 'svgrid://doc/help/export' })) as {
      body: { result?: { contents?: { text?: string; mimeType?: string }[] } }
    }
    expect(doc.body.result?.contents?.[0]?.mimeType).toBe('text/markdown')
    expect((doc.body.result?.contents?.[0]?.text ?? '').length).toBeGreaterThan(200)

    const demo = (await rpc('resources/read', { uri: 'svgrid://example/11-stock-market' })) as {
      body: { result?: { contents?: { text?: string }[] } }
    }
    expect(demo.body.result?.contents?.[0]?.text).toContain('<script')
  })

  it('serves the preview UI with the MCP Apps mime type', async () => {
    const { body } = (await rpc('resources/read', { uri: 'ui://svgrid/preview.html' })) as {
      body: { result?: { contents?: { mimeType?: string; text?: string }[] } }
    }
    // Without this exact profile a client renders it as plain HTML, not an app.
    expect(body.result?.contents?.[0]?.mimeType).toBe('text/html;profile=mcp-app')
    expect(body.result?.contents?.[0]?.text).toContain('sv-grid')
  })

  it('rejects a resource that does not exist', async () => {
    const { body } = (await rpc('resources/read', { uri: 'svgrid://doc/nope' })) as {
      body: { error?: { message?: string } }
    }
    expect(body.error?.message).toMatch(/No SvGrid doc/)
  })

  it('lists prompts and renders one', async () => {
    const list = (await rpc('prompts/list', {})) as {
      body: { result: { prompts: { name: string }[] } }
    }
    expect(list.body.result.prompts.map((p) => p.name)).toContain('build_grid')

    const got = (await rpc('prompts/get', {
      name: 'build_grid',
      arguments: { description: 'a table of orders' },
    })) as { body: { result?: { messages?: { content?: { text?: string } }[] } } }
    const text = got.body.result?.messages?.[0]?.content?.text ?? ''
    expect(text).toContain('svgrid_check_code')
  })

  it('offers the preview tool and returns a renderable payload', async () => {
    const list = (await rpc('tools/list', {})) as {
      body: { result: { tools: { name: string; _meta?: Record<string, unknown> }[] } }
    }
    const preview = list.body.result.tools.find((t) => t.name === 'svgrid_preview')
    expect(preview, 'svgrid_preview is not offered remotely').toBeTruthy()
    expect(preview?._meta?.['ui/resourceUri']).toBe('ui://svgrid/preview.html')

    const { body } = (await rpc('tools/call', {
      name: 'svgrid_preview',
      arguments: { columns: [{ field: 'a', header: 'A' }], data: [{ a: 1 }, { a: 2 }] },
    })) as { body: { result?: { structuredContent?: { data?: unknown[] }; _meta?: Record<string, unknown> } } }
    expect(body.result?.structuredContent?.data).toHaveLength(2)
    expect(body.result?._meta?.['ui/resourceUri']).toBe('ui://svgrid/preview.html')
  })
})

describe.skipIf(!ready)('remote MCP worker: paid features and usage records', () => {
  const TRIAL = 'https://svgrid.com/pricing/?trial=mcp'

  it('adds the trial note to a question about a paid feature, not a free one', async () => {
    const paid = JSON.parse(await callTool('search', { query: 'pivot table' }))
    expect(paid.enterprise).toContain(TRIAL)
    expect(paid.results.some((r: { enterprise?: boolean }) => r.enterprise)).toBe(true)

    const free = JSON.parse(await callTool('search', { query: 'pin a column' }))
    expect(free.enterprise).toBeUndefined()
  })

  it('puts the line on a paid demo and leaves a free one alone', async () => {
    expect(await callTool('fetch', { id: 'demo:343-kanban-board' })).toContain(TRIAL)
    expect(await callTool('fetch', { id: 'demo:11-stock-market' })).not.toContain(TRIAL)
  })

  it('writes one data point per call, never the checked source', async () => {
    const points: { indexes?: string[]; blobs?: string[]; doubles?: number[] }[] = []
    const withEvents = { ...env, MCP_EVENTS: { writeDataPoint: (p: (typeof points)[number]) => points.push(p) } }
    const worker = await loadWorker()
    const call = (name: string, args: Record<string, unknown>) =>
      worker.fetch(
        new Request('https://mcp.svgrid.com/mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: ++nextId, method: 'tools/call', params: { name, arguments: args } }),
        }),
        withEvents,
      )

    await call('search', { query: 'kanban board' })
    await call('search', { query: 'zzqx nonexistent widget' })
    const secret = 'const SECRET_TOKEN_123 = 1'
    await call('check_svgrid_code', {
      source: `<script lang="ts">\n  import { SvGrid } from '@svgrid/grid'\n  ${secret}\n</script>\n\n<SvGrid rowData={[]} columns={[]} />`,
      filename: 'X.svelte',
    })

    expect(points).toHaveLength(3)
    const [hit, miss, check] = points
    expect(hit!.blobs!.slice(0, 2)).toEqual(['search', 'kanban board'])
    expect(hit!.blobs![4]).toBe('1')
    expect(hit!.doubles![2]).toBeGreaterThan(0)
    expect(miss!.doubles![2], 'an empty search must be countable').toBe(0)
    expect(check!.blobs![3]).toContain('svgrid/renamed-prop')
    expect(check!.doubles![3]).toBeGreaterThan(0)
    expect(JSON.stringify(points)).not.toContain('SECRET_TOKEN_123')
  })
})
