/**
 * The SvGrid MCP server, over remote HTTP.
 *
 * Why this exists alongside the npm package: stdio means every user needs
 * Node, a config file edit, and a local install, which rules out the one-click
 * connector flows in the web and mobile clients - and gives us no idea which
 * tools anyone actually calls. A URL costs the user one paste and tells us
 * which queries come back empty.
 *
 * Transport: Streamable HTTP, stateless. POST carries one JSON-RPC message and
 * gets one JSON response; there is no SSE stream and no session id, which the
 * spec allows for a server that never pushes to the client. Implemented
 * directly rather than through the MCP SDK because the SDK's HTTP transport
 * speaks node:http, which does not exist here.
 *
 * Tool surface is deliberately narrower than the stdio server's: the docs and
 * verification tools, without the 27 Studio project-model tools. Studio's
 * codegen needs a filesystem, and a model that just wants a grid should not
 * pay context for 27 app-builder tools it will never call.
 */
import { checkSvGridCode, type ApiSurface } from './generated/validate.js'
import { rankDocs, type RankableDoc } from './generated/search.js'
import { apiReference, apiSurface, docs, examples } from './generated/index.js'

export type Env = {
  ASSETS: { fetch: (req: Request | string) => Promise<Response> }
  PUBLIC_URL?: string
}

const SERVER_NAME = 'svgrid'
const SERVER_VERSION = apiSurface.gridVersion
const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const DEFAULT_PROTOCOL = PROTOCOL_VERSIONS[0]

const DOCS_FOOTER = '\n\nSvGrid reference: full docs & 370+ live demos at https://svgrid.com/docs'

// ---------------------------------------------------------------------------
// Corpus loading
// ---------------------------------------------------------------------------

/**
 * Doc bodies live in the asset store and are pulled in once per isolate. An
 * isolate serves many requests, so in practice this is one fetch per cold
 * start rather than one per call.
 */
let docBodies: Promise<RankableDoc[]> | null = null

function loadDocs(env: Env): Promise<RankableDoc[]> {
  docBodies ??= env.ASSETS.fetch('https://assets.local/_data/docs.json')
    .then((r) => {
      if (!r.ok) throw new Error(`docs.json ${r.status}`)
      return r.json() as Promise<RankableDoc[]>
    })
    .catch((err) => {
      // Never cache a failure: the next request should try again.
      docBodies = null
      throw err
    })
  return docBodies
}

type ExampleSource = { id: string; path: string; title: string; blurb: string; source: string }

async function loadExample(env: Env, id: string): Promise<ExampleSource | null> {
  const safe = id.replace(/[^a-zA-Z0-9._-]/g, '_')
  const res = await env.ASSETS.fetch(`https://assets.local/_data/examples/${safe}.json`)
  if (!res.ok) return null
  return (await res.json()) as ExampleSource
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean }

const text = (body: string): ToolResult => ({ content: [{ type: 'text', text: body }] })
const withDocs = (body: string): ToolResult => text(body + DOCS_FOOTER)
const fail = (message: string): ToolResult => ({
  content: [{ type: 'text', text: message }],
  isError: true,
})
const json = (value: unknown): string => JSON.stringify(value, null, 2)

function countBy<T>(rows: readonly T[], key: (row: T) => string): Record<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const k = key(row) || 'Other'
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return Object.fromEntries([...counts].sort((a, b) => b[1] - a[1]))
}

const TOOLS = [
  {
    name: 'search',
    description:
      'Ranked full-text search across the SvGrid documentation and demo catalogue. Returns the best pages first with an excerpt and an id you pass to `fetch`. Use this before writing SvGrid code so the API names come from the docs rather than from memory.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What you are looking for, e.g. "row virtualization".' },
        limit: { type: 'number', description: 'Max results, default 10, max 25.', default: 10 },
      },
      required: ['query'],
    },
  },
  {
    name: 'fetch',
    description:
      'Return the full text behind a search result. Pass a doc slug ("help/columns/column-definitions") or a demo id prefixed with "demo:" ("demo:11-stock-market").',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'A doc slug, or "demo:<id>".' } },
      required: ['id'],
    },
  },
  {
    name: 'list_examples',
    description:
      'Browse the SvGrid demo catalogue: id, title, category and a one-line blurb. Call with no arguments for the category index, then filter with `query` or `category`, then read one with get_example_source.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text filter over id, title, blurb and category.' },
        category: { type: 'string', description: 'Exact category, e.g. "Kanban".' },
        limit: { type: 'number', description: 'Max results, default 25, max 100.', default: 25 },
      },
    },
  },
  {
    name: 'get_example_source',
    description:
      'Return the full .svelte source of one demo by id (e.g. "11-stock-market") - working code to copy, not a summary of it.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Demo id, e.g. "11-stock-market".' } },
      required: ['id'],
    },
  },
  {
    name: 'get_api_reference',
    description:
      'The SvGrid public API grouped by category (components, headless, scheduler, data ops, export, row models, features, virtualization, accessibility, utilities), for the version this server tracks.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'check_svgrid_code',
    description:
      'Verify SvGrid code BEFORE handing it to the user. Checks the source against the real exported surface of the current version - <SvGrid> prop names, ColumnDef keys, grid API methods, importable symbols and theme files - plus Svelte 5 runes rules, and returns line-numbered diagnostics with the exact replacement for each. Run it on every file you write that uses SvGrid, fix what it reports, and run it again.',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'The full file contents to check.' },
        filename: {
          type: 'string',
          description: 'File name, used to pick which rules apply. Defaults to "Component.svelte".',
        },
      },
      required: ['source'],
    },
  },
] as const

async function callTool(name: string, args: Record<string, unknown>, env: Env): Promise<ToolResult> {
  switch (name) {
    case 'search': {
      const query = String(args.query ?? '').trim()
      if (!query) return fail('query is required')
      const limit = Math.max(1, Math.min(25, Number(args.limit ?? 10)))

      const { hits, total, partial } = rankDocs(await loadDocs(env), query, limit)
      // Demos are matched on their metadata only - their sources are separate
      // assets, and a model that wants one asks for it by id.
      const q = query.toLowerCase()
      const demoHits = examples
        .filter((e) => `${e.id} ${e.title} ${e.blurb} ${e.category}`.toLowerCase().includes(q))
        .slice(0, 5)

      return withDocs(
        json({
          query,
          total,
          partial: partial || undefined,
          results: [
            ...hits.map((h) => ({
              id: h.slug,
              title: h.title,
              section: h.section,
              url: `https://svgrid.com/docs/${h.slug}`,
              excerpt: h.excerpt,
            })),
            ...demoHits.map((e) => ({
              id: `demo:${e.id}`,
              title: `${e.title} (demo)`,
              section: e.category,
              url: `https://svgrid.com/examples/${e.id}`,
              excerpt: e.blurb,
            })),
          ],
        }),
      )
    }

    case 'fetch': {
      const id = String(args.id ?? '').trim()
      if (!id) return fail('id is required')

      if (id.startsWith('demo:')) {
        const demo = await loadExample(env, id.slice(5))
        if (!demo) return fail(`No demo with id "${id.slice(5)}". Call list_examples for the ids.`)
        return text(`// ${demo.path}\n// ${demo.title} - ${demo.blurb}\n\n${demo.source}`)
      }

      const all = await loadDocs(env)
      const doc = all.find((d) => d.slug === id)
      if (!doc) return fail(`No doc with slug "${id}". Call search to find one.`)
      return withDocs(doc.markdown)
    }

    case 'list_examples': {
      const limit = Math.max(1, Math.min(100, Number(args.limit ?? 25)))
      const q = String(args.query ?? '').trim().toLowerCase()
      const category = String(args.category ?? '').trim().toLowerCase()

      const pool = examples.filter((e) => {
        if (category && e.category.toLowerCase() !== category) return false
        if (q && !`${e.id} ${e.title} ${e.blurb} ${e.category}`.toLowerCase().includes(q)) return false
        return true
      })
      const shown = pool.slice(0, limit)
      const body: Record<string, unknown> = {
        total: pool.length,
        shown: shown.length,
        examples: shown,
      }
      if (!q && !category) body.categories = countBy(examples, (e) => e.category)
      if (shown.length < pool.length) {
        body.hint = `Showing ${shown.length} of ${pool.length}. Narrow with \`query\` or \`category\`, or raise \`limit\` (max 100).`
      }
      if (!pool.length) body.hint = 'No match. Drop `category`, or try a broader `query`.'
      return withDocs(json(body))
    }

    case 'get_example_source': {
      const id = String(args.id ?? '')
      const demo = await loadExample(env, id)
      if (!demo) return fail(`No example with id "${id}". Call list_examples for available ids.`)
      return text(`// ${demo.path}\n// ${demo.title} - ${demo.blurb}\n\n${demo.source}`)
    }

    case 'get_api_reference':
      return withDocs(json(apiReference))

    case 'check_svgrid_code': {
      const source = args.source
      if (typeof source !== 'string' || !source.trim()) {
        return fail('source (the file contents to check) is required')
      }
      // No `compile` here: there is no Svelte compiler in a Worker, so this is
      // the static half only. The result says so in its own summary rather
      // than letting a caller assume the file was compiled.
      const result = await checkSvGridCode(source, apiSurface as ApiSurface, {
        filename: typeof args.filename === 'string' ? args.filename : undefined,
      })
      return text(json(result))
    }

    default:
      return fail(`Unknown tool: ${name}`)
  }
}

// ---------------------------------------------------------------------------
// JSON-RPC / Streamable HTTP
// ---------------------------------------------------------------------------

type RpcRequest = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: unknown }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Protocol-Version, Mcp-Session-Id',
  'Access-Control-Expose-Headers': 'Mcp-Protocol-Version',
  'Access-Control-Max-Age': '86400',
}

function rpcResult(id: RpcRequest['id'], result: unknown) {
  return { jsonrpc: '2.0' as const, id: id ?? null, result }
}

function rpcError(id: RpcRequest['id'], code: number, message: string) {
  return { jsonrpc: '2.0' as const, id: id ?? null, error: { code, message } }
}

async function handleRpc(msg: RpcRequest, env: Env): Promise<object | null> {
  const params = (msg.params ?? {}) as Record<string, unknown>

  switch (msg.method) {
    case 'initialize': {
      const asked = String(params.protocolVersion ?? '')
      return rpcResult(msg.id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : DEFAULT_PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        instructions:
          'SvGrid is a Svelte 5 data grid. Search the docs before writing grid code, and run check_svgrid_code on what you write before showing it to the user.',
      })
    }

    // Notifications carry no id and expect no result.
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null

    case 'ping':
      return rpcResult(msg.id, {})

    case 'tools/list':
      return rpcResult(msg.id, { tools: TOOLS })

    case 'tools/call': {
      const name = String(params.name ?? '')
      const args = (params.arguments ?? {}) as Record<string, unknown>
      if (!TOOLS.some((t) => t.name === name)) {
        return rpcError(msg.id, -32602, `Unknown tool: ${name}`)
      }
      const started = Date.now()
      try {
        const result = await callTool(name, args, env)
        // Telemetry is the point of running this remotely: which tools get
        // called, and which queries come back empty. Never the source under
        // check - only its size and the rule ids that fired.
        console.log(
          JSON.stringify({
            tool: name,
            ms: Date.now() - started,
            ok: !result.isError,
            query: name === 'search' ? String(args.query ?? '') : undefined,
            id: name === 'fetch' || name === 'get_example_source' ? String(args.id ?? '') : undefined,
            sourceBytes: name === 'check_svgrid_code' ? String(args.source ?? '').length : undefined,
          }),
        )
        return rpcResult(msg.id, result)
      } catch (err) {
        console.log(JSON.stringify({ tool: name, ms: Date.now() - started, ok: false, error: String(err) }))
        return rpcResult(msg.id, fail(`${name} failed: ${err instanceof Error ? err.message : String(err)}`))
      }
    }

    default:
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`)
  }
}

function landingPage(env: Env): Response {
  const url = env.PUBLIC_URL ?? 'https://mcp.svgrid.com'
  const body = {
    name: 'SvGrid MCP server',
    transport: 'streamable-http',
    endpoint: `${url}/mcp`,
    grid_version: SERVER_VERSION,
    tools: TOOLS.map((t) => t.name),
    connect: {
      claude_code: `claude mcp add --transport http svgrid ${url}/mcp`,
      cursor_or_vscode: { mcpServers: { svgrid: { url: `${url}/mcp` } } },
      stdio_alternative: 'npx @svgrid/mcp',
    },
    docs: 'https://svgrid.com/docs/help/mcp-server/',
  }
  return new Response(JSON.stringify(body, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    if (url.pathname === '/health') {
      return new Response('ok', { headers: { 'Content-Type': 'text/plain', ...CORS } })
    }
    if (url.pathname === '/' || url.pathname === '') return landingPage(env)

    if (url.pathname !== '/mcp') {
      return new Response('Not found', { status: 404, headers: CORS })
    }

    // A stateless server offers no SSE stream, so a GET has nothing to open.
    if (request.method === 'GET') {
      return new Response(JSON.stringify(rpcError(null, -32000, 'This server does not offer an SSE stream; POST JSON-RPC to /mcp.')), {
        status: 405,
        headers: { 'Content-Type': 'application/json', Allow: 'POST, OPTIONS', ...CORS },
      })
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST, OPTIONS', ...CORS } })
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return new Response(JSON.stringify(rpcError(null, -32700, 'Parse error')), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const headers = {
      'Content-Type': 'application/json',
      'Mcp-Protocol-Version': DEFAULT_PROTOCOL,
      ...CORS,
    }

    // Batching was removed in the 2025-06-18 spec but older clients still send
    // arrays, so both shapes are accepted.
    if (Array.isArray(payload)) {
      const replies = (await Promise.all(payload.map((m) => handleRpc(m as RpcRequest, env)))).filter(
        (r): r is object => r !== null,
      )
      if (!replies.length) return new Response(null, { status: 202, headers: CORS })
      return new Response(JSON.stringify(replies), { headers })
    }

    const reply = await handleRpc(payload as RpcRequest, env)
    if (!reply) return new Response(null, { status: 202, headers: CORS })
    return new Response(JSON.stringify(reply), { headers })
  },
}
