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
import { applyFixes, checkSvGridCode, sourceArg, type ApiSurface, type CompileFn } from './generated/validate.js'
import { compileDiagnostics, type CompileApi } from './generated/compile-core.js'
import { rankDocs, type RankableDoc } from './generated/search.js'
import { apiReference, apiSurface, docs, examples } from './generated/index.js'
import { PROMPTS, getPrompt } from './generated/prompts.js'
import { PREVIEW_TOOL, handlePreview, previewResource, readPreviewResource } from './generated/preview.js'
import { serverInstructions } from './generated/tool-defs.js'
import { ENTERPRISE_LINE, ENTERPRISE_NOTE, checkNeedsEnterprise, isPaidQuestion } from './generated/enterprise.js'

export type Env = {
  ASSETS: { fetch: (req: Request | string) => Promise<Response> }
  PUBLIC_URL?: string
  /** "off" skips the Svelte compile in check (see wrangler.toml). */
  COMPILE?: string
  /** One data point per tool call (see `record`). Unbound, nothing is kept. */
  MCP_EVENTS?: AnalyticsEngineDataset
}

/** Paid docs and demos, marked by scripts/build-data.mjs. */
const paidDocs = new Set(docs.filter((d) => d.enterprise).map((d) => d.slug))
const paidDemos = new Set(examples.filter((e) => e.enterprise).map((e) => e.id))
const paidLine = (isPaid: boolean, prefix: string) => (isPaid ? `${prefix}${ENTERPRISE_LINE}\n` : '')

/** What a call produced, for the usage record. Filled in by `callTool`. */
type CallMeta = { results?: number; paid?: boolean; rules?: string[] }

const SERVER_NAME = 'svgrid'
const SERVER_VERSION = apiSurface.gridVersion
const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const DEFAULT_PROTOCOL = PROTOCOL_VERSIONS[0]

const DOCS_FOOTER = `\n\nSvGrid reference: full docs & ${examples.length} live demos at https://svgrid.com/docs`

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

/**
 * The Svelte compiler, bundled into the Worker and loaded on the first check.
 * It runs here as it does in the browser REPL; what it costs is CPU (a cold
 * first compile of a 150-line demo measured 31 ms locally, warm 8 ms), which
 * the Workers Paid limit covers and the Free plan's 10 ms does not.
 */
let compiler: Promise<CompileApi | null> | null = null

const compileInWorker: CompileFn = async (source, filename) => {
  compiler ??= import('svelte/compiler')
    .then((m) => (typeof m.compile === 'function' ? (m as unknown as CompileApi) : null))
    .catch(() => null)
  const mod = await compiler
  if (!mod) return { available: false, diagnostics: [] }
  return { available: true, diagnostics: compileDiagnostics(mod, source, filename) }
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
    name: 'svgrid_check_code',
    description:
      'Verify SvGrid code BEFORE handing it to the user. Checks the source against the real exported surface of the current version - <SvGrid> prop names, ColumnDef keys, grid API methods, importable symbols and theme files - plus Svelte 5 runes rules, compiles it, and returns line-numbered diagnostics with the exact replacement for each, plus a corrected copy of the file (`fixed`) whenever the correction is exact. Run it on every file you write that uses SvGrid, use `fixed`, and run it again.',
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

/**
 * The stdio server's 3.0 names, accepted here too.
 *
 * `search` and `fetch` keep their names because a connector needs those two
 * exact ones to index this server - that constraint is not negotiable, so the
 * two servers cannot advertise an identical surface. They can still ANSWER to
 * the same names: aliases are unlisted, so a model that learned `svgrid_search`
 * from the npm package is not told "unknown tool" here, and the listing costs
 * nothing extra.
 */
const ALIASES: Record<string, string> = {
  svgrid_search: 'search',
  svgrid_get: 'fetch',
  // Listed as svgrid_check_code, the npm name: Claude Code
  // can only call a tool it was shown, and the Skill names that one.
  check_svgrid_code: 'svgrid_check_code',
}

/**
 * An alias resolved to the tool that answers it, or the name unchanged.
 *
 * Exported and applied by the DISPATCHER, not inside `callTool`. The first
 * version of this lived at the top of `callTool`, one line below a membership
 * check that rejects anything not in `TOOLS` - so every alias was rejected
 * before it could be resolved, and the whole thing was dead code. A model that
 * learned `svgrid_search` from the npm package got "Unknown tool" here, which
 * is precisely what the aliases exist to prevent.
 */
export function resolveToolName(name: string): string {
  return ALIASES[name] ?? name
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
  env: Env,
  meta: CallMeta = {},
): Promise<ToolResult> {
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

      const docResults = hits.map((h) => ({
        id: h.slug,
        title: h.title,
        section: h.section,
        url: `https://svgrid.com/docs/${h.slug}`,
        excerpt: h.excerpt,
        ...(paidDocs.has(h.slug) ? { enterprise: true } : {}),
      }))
      const demoResults = demoHits.map((e) => ({
        id: `demo:${e.id}`,
        title: `${e.title} (demo)`,
        section: e.category,
        url: `https://svgrid.com/examples/${e.id}`,
        excerpt: e.blurb,
        ...(e.enterprise ? { enterprise: true } : {}),
      }))
      // Same rule as the npm server: the note goes on top only when the
      // question is about a paid feature; each result carries its own mark.
      // Partial matches are leads, not answers: for the usage report a query
      // that matched no page in full is a query we could not answer.
      meta.results = (partial ? 0 : total) + demoHits.length
      meta.paid = isPaidQuestion([docResults, demoResults])

      return withDocs(
        json({
          query,
          total,
          partial: partial || undefined,
          ...(meta.paid ? { enterprise: ENTERPRISE_NOTE } : {}),
          results: [...docResults, ...demoResults],
        }),
      )
    }

    case 'fetch': {
      const id = String(args.id ?? '').trim()
      if (!id) return fail('id is required')

      if (id.startsWith('demo:')) {
        const demo = await loadExample(env, id.slice(5))
        if (!demo) return fail(`No demo with id "${id.slice(5)}". Call list_examples for the ids.`)
        meta.paid = paidDemos.has(demo.id)
        return text(`// ${demo.path}\n// ${demo.title} - ${demo.blurb}\n${paidLine(meta.paid, '// ')}\n${demo.source}`)
      }

      const all = await loadDocs(env)
      const doc = all.find((d) => d.slug === id)
      if (!doc) return fail(`No doc with slug "${id}". Call search to find one.`)
      meta.paid = paidDocs.has(doc.slug)
      return withDocs(`${paidLine(meta.paid, '> ')}${meta.paid ? '\n' : ''}${doc.markdown}`)
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
      meta.results = pool.length
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
      meta.paid = paidDemos.has(demo.id)
      return text(`// ${demo.path}\n// ${demo.title} - ${demo.blurb}\n${paidLine(meta.paid, '// ')}\n${demo.source}`)
    }

    case 'get_api_reference':
      return withDocs(json(apiReference))

    case 'svgrid_check_code': {
      const source = sourceArg(args)
      if (!source) return fail('source (the file contents to check) is required')
      const result = await checkSvGridCode(source, apiSurface as ApiSurface, {
        filename: typeof args.filename === 'string' ? args.filename : undefined,
        compile: env.COMPILE === 'off' ? undefined : compileInWorker,
      })
      meta.rules = [...new Set(result.diagnostics.map((d) => d.rule))]
      meta.paid = checkNeedsEnterprise(result.diagnostics)
      // The same corrected copy the npm server returns, from the same function.
      const { fixed, applied } = applyFixes(source, result.diagnostics)
      const payload = {
        ...result,
        ...(applied.length ? { applied, fixed } : {}),
        ...(meta.paid ? { enterprise: ENTERPRISE_LINE } : {}),
      }
      return text(json(payload))
    }

    default:
      return fail(`Unknown tool: ${name}`)
  }
}

// ---------------------------------------------------------------------------
// Usage records
// ---------------------------------------------------------------------------

/**
 * One line per tool call, to the Workers log and to Analytics Engine.
 *
 * Usage is the point of running this remotely: which tools get called, which
 * queries come back empty (a feature we lack or name differently), which paid
 * features people ask about, and which check rules fire. Never the source under
 * check - only its size and the rule ids. No IP, no user agent, no session.
 *
 * The log lasts days; the Analytics Engine dataset keeps three months and
 * answers SQL, which is what `tools/mcp-report.mjs` reads. Column order is the
 * contract with that script:
 *
 *   index1   tool
 *   blob1    tool          blob2  query        blob3  id
 *   blob4    rules fired, comma-separated      blob5  "1" when the answer
 *                                                     carried the trial note
 *   double1  ms            double2  ok (1/0)   double3  results that matched
 *                                                       the whole query (-1 = n/a)
 *   double4  bytes of checked source
 */
function record(env: Env, tool: string, args: Record<string, unknown>, meta: CallMeta, ms: number, ok: boolean) {
  const query = tool === 'search' || tool === 'list_examples' ? String(args.query ?? '').slice(0, 200) : ''
  const id = tool === 'fetch' || tool === 'get_example_source' ? String(args.id ?? '').slice(0, 200) : ''
  const sourceBytes = tool === 'svgrid_check_code' ? (sourceArg(args) ?? '').length : 0
  const rules = (meta.rules ?? []).join(',').slice(0, 1000)

  console.log(
    JSON.stringify({
      tool,
      ms,
      ok,
      query: query || undefined,
      id: id || undefined,
      results: meta.results,
      paid: meta.paid || undefined,
      rules: rules || undefined,
      sourceBytes: sourceBytes || undefined,
    }),
  )

  try {
    env.MCP_EVENTS?.writeDataPoint({
      indexes: [tool],
      blobs: [tool, query, id, rules, meta.paid ? '1' : ''],
      doubles: [ms, ok ? 1 : 0, meta.results ?? -1, sourceBytes],
    })
  } catch {
    // A usage record must never fail the call it describes.
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
        capabilities: { tools: {}, resources: {}, prompts: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        instructions: serverInstructions({ search: 'search', get: 'fetch', check: 'svgrid_check_code' }),
      })
    }

    // Notifications carry no id and expect no result.
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null

    case 'ping':
      return rpcResult(msg.id, {})

    case 'tools/list':
      return rpcResult(msg.id, { tools: [...TOOLS, PREVIEW_TOOL] })

    // ---- resources ---------------------------------------------------------
    //
    // Parity with the npm server, which is the point: the hosted path is the
    // low-friction one - a URL, no Node, no install - and it was the path
    // missing the preview, our clearest differentiator.
    //
    // Listings are built from the bundled metadata, so this costs no asset
    // fetch. Bodies are pulled lazily, exactly as the tools already do.
    case 'resources/list': {
      const all = [
        previewResource(),
        ...docs.map((d) => ({
          uri: `svgrid://doc/${d.slug}`,
          name: d.slug,
          title: d.title,
          description: `${d.section} - SvGrid documentation`,
          mimeType: 'text/markdown',
        })),
        ...examples.map((e) => ({
          uri: `svgrid://example/${e.id}`,
          name: e.id,
          title: e.title,
          description: `${e.category} - runnable SvGrid demo`,
          mimeType: 'text/x-svelte',
        })),
      ]
      // Paged for the same reason as the npm server: all 784 in one response is
      // ~37k tokens, which is worse than any tool listing.
      const cursorRaw = Number(params.cursor)
      const start = Number.isSafeInteger(cursorRaw) && cursorRaw > 0 ? cursorRaw : 0
      const page = all.slice(start, start + 100)
      const next = start + 100
      return rpcResult(
        msg.id,
        next < all.length ? { resources: page, nextCursor: String(next) } : { resources: page },
      )
    }

    case 'resources/read': {
      const uri = String(params.uri ?? '')

      const ui = readPreviewResource(uri)
      if (ui) return rpcResult(msg.id, ui)

      const doc = /^svgrid:\/\/doc\/(.+)$/.exec(uri)
      if (doc) {
        const body = (await loadDocs(env)).find((d) => d.slug === doc[1])
        if (!body) return rpcError(msg.id, -32602, `No SvGrid doc at "${uri}".`)
        return rpcResult(msg.id, {
          contents: [{ uri, mimeType: 'text/markdown', text: body.markdown }],
        })
      }

      const example = /^svgrid:\/\/example\/(.+)$/.exec(uri)
      if (example) {
        const found = await loadExample(env, example[1]!)
        if (!found) return rpcError(msg.id, -32602, `No SvGrid demo at "${uri}".`)
        return rpcResult(msg.id, {
          contents: [
            {
              uri,
              mimeType: 'text/x-svelte',
              text: `// ${found.path}\n// ${found.title} - ${found.blurb}\n\n${found.source}`,
            },
          ],
        })
      }

      return rpcError(msg.id, -32602, `No SvGrid resource at "${uri}".`)
    }

    // ---- prompts -----------------------------------------------------------

    case 'prompts/list':
      return rpcResult(msg.id, { prompts: PROMPTS })

    case 'prompts/get': {
      const found = getPrompt(
        String(params.name ?? ''),
        (params.arguments ?? {}) as Record<string, unknown>,
      )
      if (!found) return rpcError(msg.id, -32602, `No SvGrid prompt named "${String(params.name)}".`)
      return rpcResult(msg.id, found)
    }

    case 'tools/call': {
      const requested = String(params.name ?? '')
      // Resolve BEFORE the membership check: the aliases are deliberately not
      // in `TOOLS` (listing is what costs context), so checking first rejected
      // every one of them.
      const name = resolveToolName(requested)
      const raw = (params.arguments ?? {}) as Record<string, unknown>
      // `svgrid_get` takes `ref`, its target `fetch` takes `id`.
      const args =
        requested === 'svgrid_get' && raw.ref !== undefined ? { ...raw, id: raw.ref } : raw
      if (name === PREVIEW_TOOL.name) {
        return rpcResult(msg.id, handlePreview(args))
      }
      if (!TOOLS.some((t) => t.name === name)) {
        return rpcError(msg.id, -32602, `Unknown tool: ${requested}`)
      }
      const started = Date.now()
      const meta: CallMeta = {}
      try {
        const result = await callTool(name, args, env, meta)
        record(env, name, args, meta, Date.now() - started, !result.isError)
        return rpcResult(msg.id, result)
      } catch (err) {
        console.log(JSON.stringify({ tool: name, ms: Date.now() - started, ok: false, error: String(err) }))
        record(env, name, args, meta, Date.now() - started, false)
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
