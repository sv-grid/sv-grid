/**
 * Guards the MCP server's discovery tools against the regression that made them
 * unusable: `list_examples` returned all 373 demos (125,631 chars, ~31k tokens)
 * and `list_docs` all 370 pages (~12.7k tokens), on the calls their own
 * descriptions tell a model to start with. Between them that was ~44k tokens
 * spent before any real work.
 *
 * The server is driven over stdio as a client would, so this covers the tool
 * schemas and the dispatch together rather than a re-implementation of either.
 * Requires the built dist, so it is wired to run after the MCP build step.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SERVER = join(ROOT, 'packages', 'mcp', 'dist', 'index.js')
const hasDist = existsSync(SERVER)

let child: ChildProcessWithoutNullStreams | null = null
const pending = new Map<number, (msg: Record<string, unknown>) => void>()
let nextId = 1

function send(method: string, params: unknown): Promise<Record<string, unknown>> {
  const id = nextId++
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout on ${method}`)), 30_000)
    pending.set(id, (msg) => {
      clearTimeout(timer)
      resolve(msg)
    })
    child!.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
  })
}

/** Call a tool and return its text payload minus the shared docs footer. */
async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  const res = (await send('tools/call', { name, arguments: args })) as {
    result?: { content?: { text?: string }[] }
  }
  const text = (res.result?.content ?? []).map((c) => c.text ?? '').join('')
  return text.split('\n\nSvGrid reference')[0]!
}

const callJson = async (name: string, args: Record<string, unknown> = {}) =>
  JSON.parse(await callTool(name, args))

/** The advertised tool list - the thing every request pays for. */
async function listTools(): Promise<{ name: string }[]> {
  const res = (await send('tools/list', {})) as { result?: { tools?: { name: string }[] } }
  return res.result?.tools ?? []
}

beforeAll(async () => {
  if (!hasDist) return
  child = spawn(process.execPath, [SERVER], { stdio: ['pipe', 'pipe', 'ignore'] })
  let buf = ''
  child.stdout.on('data', (chunk: Buffer) => {
    buf += chunk.toString()
    let nl: number
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line) continue
      try {
        const msg = JSON.parse(line) as { id?: number }
        if (msg.id != null && pending.has(msg.id)) {
          pending.get(msg.id)!(msg as Record<string, unknown>)
          pending.delete(msg.id)
        }
      } catch {
        // Not a JSON-RPC frame; ignore.
      }
    }
  })
  await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'guardrail', version: '1.0.0' },
  })
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n')
}, 60_000)

afterAll(() => {
  child?.kill()
})

describe('MCP registry manifest', () => {
  // server.json is what the official registry publishes, and its version is
  // pinned in two places that are easy to forget. They silently fell three
  // releases behind package.json (2.6.1 vs 2.6.4), so the registry advertised a
  // stale build. Nothing else catches this.
  it('pins the same version as package.json in both places', async () => {
    const read = async (p: string) =>
      JSON.parse(await import('node:fs/promises').then((fs) => fs.readFile(join(ROOT, p), 'utf8')))
    const pkg = await read('packages/mcp/package.json')
    const server = await read('packages/mcp/server.json')

    expect(server.version, 'server.json version').toBe(pkg.version)
    expect(server.packages?.[0]?.version, 'server.json packages[0].version').toBe(pkg.version)
    expect(server.packages?.[0]?.identifier).toBe(pkg.name)
    // Namespace ownership is proved by mcpName matching the registry name.
    expect(server.name).toBe(pkg.mcpName)
  })
})

describe.skipIf(!hasDist)('the tool surface stays small', () => {
  // The number this redesign exists for. tools/list is sent on EVERY request,
  // so it is pure overhead on every single turn - and it was 18,839 chars
  // (~4,710 tokens) across 36 tools, 79% of it Studio, which most sessions
  // never call once. Four tools by default, Studio behind an opt-in flag.
  //
  // Guarded as a budget rather than an exact count: adding a genuinely useful
  // fifth tool should be a decision, not an accident.
  it('lists five tools by default and stays under budget', async () => {
    const tools = await listTools()
    expect(
      tools.map((t: { name: string }) => t.name).sort(),
      'the default surface changed',
    ).toEqual(['svgrid_check_code', 'svgrid_get', 'svgrid_preview', 'svgrid_scaffold', 'svgrid_search'])

    const payload = JSON.stringify(tools).length
    expect(payload, `tools/list is ${payload} chars, was 18,839 across 36 tools`).toBeLessThan(6_000)
  }, 30_000)

  it('hides the Studio tools until they are asked for', async () => {
    // They need a licence to be useful, so charging every free-grid user ~3,741
    // tokens a request for them is a straight loss.
    const tools = await listTools()
    expect(tools.some((t: { name: string }) => t.name.startsWith('studio_'))).toBe(false)
  }, 30_000)
})

describe.skipIf(!hasDist)('svgrid_search answers in one call', () => {
  // 12k chars is ~3k tokens: roomy versus the default page size, and a fraction
  // of what an unfiltered listing used to cost.
  const BUDGET = 12_000

  it('answers a bare call with an index, not the catalogue', async () => {
    const raw = await callTool('svgrid_search', {})
    expect(raw.length, `the bare index is ${raw.length} chars`).toBeLessThan(BUDGET)

    const body = JSON.parse(raw)
    expect(Object.keys(body.docSections ?? {}).length).toBeGreaterThan(5)
    expect(Object.keys(body.exampleCategories ?? {}).length).toBeGreaterThan(5)
    expect(body.totals.examples).toBeGreaterThan(300)
    expect(body.totals.docs).toBeGreaterThan(300)
  }, 30_000)

  it('searches docs, examples and the API in the same call', async () => {
    // The whole point of the consolidation: one call, not three, and no
    // guessing which corpus holds the answer.
    const body = await callJson('svgrid_search', { query: 'kanban' })
    expect(body.docs.hits.length, 'no doc hits').toBeGreaterThan(0)
    expect(body.examples.hits.length, 'no example hits').toBeGreaterThan(0)
    expect(
      body.examples.hits.some((e: { category: string }) => e.category === 'Kanban'),
    ).toBe(true)
  }, 30_000)

  it('finds a demo by free text', async () => {
    const body = await callJson('svgrid_search', { query: 'server side', kind: 'examples' })
    expect(body.examples.hits.some((e: { id: string }) => e.id === '09-server-side')).toBe(true)
  }, 30_000)

  it('caps limit so a large value cannot restore the old payload', async () => {
    const body = await callJson('svgrid_search', { query: 'grid', limit: 5000 })
    expect(body.examples.hits.length).toBeLessThanOrEqual(50)
    expect(body.docs.hits.length).toBeLessThanOrEqual(50)
  }, 30_000)

  it('ranks the canonical page first', async () => {
    // Each query names the page a developer means. Before ranking existed these
    // lost to whichever file merely mentioned the phrase earliest in directory
    // order. Consolidating the tool must not lose the ranking.
    const CASES: [string, string][] = [
      ['kanban board', 'help/rows/kanban-board'],
      ['inline editing', 'help/editing/overview'],
      ['pivot table', 'help/pivot'],
      ['column filtering', 'help/filtering/overview'],
      ['data export', 'help/export'],
    ]
    for (const [query, canonical] of CASES) {
      const body = await callJson('svgrid_search', { query, kind: 'docs' })
      expect(body.docs.hits.length, query).toBeGreaterThan(0)
      expect(
        body.docs.hits[0].slug,
        `${query} -> top hits: ${body.docs.hits.slice(0, 3).map((h: { slug: string }) => h.slug).join(', ')}`,
      ).toBe(canonical)
    }
  }, 60_000)

  it('matches terms in any order, not one contiguous substring', async () => {
    // No doc contains the literal string "virtualization row"; term matching
    // still finds the virtualization pages.
    const body = await callJson('svgrid_search', { query: 'virtualization row', kind: 'docs' })
    expect(body.docs.hits.length).toBeGreaterThan(0)
    expect(
      body.docs.hits.some(
        (h: { slug: string }) => h.slug.includes('virtualization') || h.slug === 'recipes/million-rows',
      ),
    ).toBe(true)
  }, 30_000)
})

describe.skipIf(!hasDist)('svgrid_get resolves a reference', () => {
  it('resolves a doc slug, a demo id and the api reference', async () => {
    expect(await callTool('svgrid_get', { ref: 'help/export' })).toContain('#')
    expect(await callTool('svgrid_get', { ref: '11-stock-market' })).toContain('<script')
    expect(await callTool('svgrid_get', { ref: 'api' })).toContain('components')
  }, 30_000)

  it('suggests near matches instead of just failing', async () => {
    // A model that gets "no" learns nothing; one that gets "did you mean" makes
    // the right call next time instead of falling back to memory.
    const raw = await callTool('svgrid_get', { ref: 'help/web-components' })
    expect(raw).toMatch(/Did you mean|#/)
  }, 30_000)
})

describe.skipIf(!hasDist)('the pre-3.0 tool names still answer', () => {
  // They are not listed - listing is what costs context, and answering a name
  // you did not advertise costs nothing - but anyone with a saved prompt or
  // script written against the old surface keeps working.
  const LEGACY: [string, Record<string, unknown>][] = [
    ['search_docs', { query: 'pagination' }],
    ['list_docs', {}],
    ['list_examples', { query: 'kanban' }],
    ['get_doc', { slug: 'help/export' }],
    ['get_example_source', { id: '11-stock-market' }],
    ['get_api_reference', {}],
    ['check_svgrid_code', { source: '<script></script>' }],
  ]

  it.each(LEGACY)('%s still returns an answer', async (name, args) => {
    const raw = await callTool(name, args)
    expect(raw.length, `${name} returned nothing`).toBeGreaterThan(20)
    expect(raw, `${name} was rejected`).not.toMatch(/^Unknown tool/)
  }, 30_000)

  it('is not advertised, so it costs nothing to keep', async () => {
    const names = (await listTools()).map((t: { name: string }) => t.name)
    for (const [name] of LEGACY) expect(names, `${name} should not be listed`).not.toContain(name)
  }, 30_000)
})

describe.skipIf(!hasDist)('check_svgrid_code catches what a model gets wrong', () => {
  // One file carrying every mistake a model makes when it writes SvGrid from
  // memory instead of from the docs.
  const WRONG = [
    '<script lang="ts">',
    "  import { SvGrid, getSortedRowModel } from '@svgrid/grid'",
    "  import '@svgrid/grid/themes/shadcm.css'",
    '  let rows = [{ id: 1, name: "Ada" }]',
    '  const columns = [{ accessorKey: "name", headerName: "Name", pinned: "left" }]',
    '  function go(api: SvGridApi) { api.exportExcel() }',
    '  function add() { rows.push({ id: 2, name: "Grace" }) }',
    '</script>',
    '',
    '<SvGrid rowData={rows} {columns} sortable="false" on:rowClick={go} />',
  ].join('\n')

  it('reports the wrong prop, column key, import and api method with the fix', async () => {
    const body = await callJson('check_svgrid_code', { source: WRONG, filename: 'People.svelte' })
    expect(body.ok).toBe(false)

    const rules = body.diagnostics.map((d: { rule: string }) => d.rule)
    expect(rules).toContain('svgrid/renamed-prop')          // rowData -> data
    expect(rules).toContain('svgrid/renamed-column-key')    // accessorKey -> field
    expect(rules).toContain('svgrid/unknown-import')        // getSortedRowModel
    expect(rules).toContain('svgrid/unknown-theme')         // shadcm.css
    expect(rules).toContain('svgrid/unknown-api-method')    // exportExcel
    expect(rules).toContain('svgrid/boolean-prop-string')   // sortable="false"
    expect(rules).toContain('svelte/legacy-event-directive')// on:rowClick

    // Every finding has to be actionable, or the model just guesses again.
    for (const d of body.diagnostics) {
      expect(d.line, `${d.rule} has no line`).toBeGreaterThan(0)
      expect(typeof d.message).toBe('string')
    }
    const prop = body.diagnostics.find((d: { rule: string }) => d.rule === 'svgrid/renamed-prop')
    expect(prop.fix).toContain('data')
    const theme = body.diagnostics.find((d: { rule: string }) => d.rule === 'svgrid/unknown-theme')
    expect(theme.fix).toContain('shadcn.css')
  }, 30_000)

  it('passes correct code, and says which version it checked against', async () => {
    const good = [
      '<script lang="ts">',
      "  import { SvGrid, tableFeatures, rowSortingFeature, type ColumnDef } from '@svgrid/grid'",
      '  type Person = { id: number; name: string }',
      '  const features = tableFeatures({ rowSortingFeature })',
      '  let rows = $state<Person[]>([{ id: 1, name: "Ada" }])',
      '  const columns: ColumnDef<typeof features, Person>[] = [{ field: "name", header: "Name" }]',
      '</script>',
      '',
      '<SvGrid data={rows} {columns} {features} sortable />',
    ].join('\n')

    const body = await callJson('check_svgrid_code', { source: good, filename: 'People.svelte' })
    expect(body.diagnostics, JSON.stringify(body.diagnostics)).toHaveLength(0)
    expect(body.ok).toBe(true)
    expect(body.checkedAgainst).toMatch(/^@svgrid\/grid@\d+\.\d+\.\d+$/)
  }, 30_000)

  it('reports a parse error from the real compiler, not just the static rules', async () => {
    const broken = '<script lang="ts">\n  let a = $state(1)\n</script>\n\n{#if a}\n  <p>yes</p>\n'
    const body = await callJson('check_svgrid_code', { source: broken, filename: 'Broken.svelte' })
    expect(body.ok).toBe(false)
    // The MCP package is built inside the workspace, so svelte resolves here.
    expect(body.compiler).toBe('svelte')
    expect(body.diagnostics.some((d: { severity: string }) => d.severity === 'error')).toBe(true)
  }, 30_000)
})

describe.skipIf(!hasDist)('check_svgrid_code stays quiet on code that is already right', () => {
  // The whole tool is worthless the moment it cries wolf: a model that gets a
  // false finding "fixes" working code. Every demo in the repo is known-good,
  // so the validator must be silent on all 365 of them.
  it('reports nothing across every demo in examples/', async () => {
    const { checkStatic } = await import(join(ROOT, 'packages/mcp/dist/validate.js') as string)
    const { apiSurface } = await import(join(ROOT, 'packages/mcp/dist/data.js') as string)
    const { readdirSync, readFileSync } = await import('node:fs')

    const dir = join(ROOT, 'examples', 'src', 'demos')
    const files = readdirSync(dir).filter((f) => f.endsWith('.svelte'))
    expect(files.length).toBeGreaterThan(300)

    const findings: string[] = []
    for (const file of files) {
      for (const d of checkStatic(readFileSync(join(dir, file), 'utf8'), apiSurface, file)) {
        findings.push(`${file}:${d.line} [${d.rule}] ${d.message}`)
      }
    }
    expect(findings, findings.slice(0, 10).join('\n')).toHaveLength(0)
  }, 120_000)
})

/**
 * The polish pass, each test standing on a defect the first cut shipped with.
 *
 * These were not found by review. They were found by measuring the payloads and
 * running question-shaped queries through the thing, which is the only way this
 * class of problem surfaces: every one of them returned a well-formed response
 * that was quietly useless.
 */
describe.skipIf(!hasDist)('search quality and response budgets', () => {
  it('does not let filler words flood the API results', async () => {
    // "pin a column" returned 210 of ~240 API names, led by SvGridBoard and
    // createSvGrid, because the `a` matched almost every identifier. A model
    // reading that learns nothing and may reach for whatever is on top.
    const body = await callJson('svgrid_search', { query: 'pin a column', kind: 'api' })
    expect(body.api.total, 'filler words are matching everything again').toBeLessThan(60)
    const top = body.api.hits.slice(0, 5).map((h: { name: string }) => h.name.toLowerCase())
    expect(top.some((n: string) => n.includes('column')), `top hits: ${top.join(', ')}`).toBe(true)
  }, 30_000)

  it('lists each API name once, merging where it lives', async () => {
    // `columns` is both a <SvGrid> prop and a column option, and was listed
    // twice - a wasted result slot that read like a bug.
    const body = await callJson('svgrid_search', { query: 'column row data', kind: 'api', limit: 50 })
    const names = body.api.hits.map((h: { name: string }) => h.name)
    expect(names.length, 'duplicate API names').toBe(new Set(names).size)
  }, 30_000)

  it('finds demos for a question phrased as a sentence', async () => {
    // Requiring every term looked precise and returned NOTHING here, because no
    // demo contains the word "two".
    const body = await callJson('svgrid_search', { query: 'how do I sort by two columns', kind: 'examples' })
    expect(body.examples.hits.length, 'a natural-language query found no demos').toBeGreaterThan(0)
  }, 30_000)

  it('still ranks the obvious demo first', async () => {
    // The counterweight to the line above: loosening the match must not let
    // ranking drift onto whatever merely mentions the word.
    for (const [query, want] of [
      ['kanban board', '343-kanban-board'],
      ['stock market', '11-stock-market'],
      ['server side', '09-server-side'],
    ]) {
      const body = await callJson('svgrid_search', { query, kind: 'examples' })
      expect(body.examples.hits[0]?.id, query).toBe(want)
    }
  }, 60_000)

  it('filters by exact section and category', async () => {
    // 2.x had list_docs({section}) and list_examples({category}); consolidating
    // the tools dropped both, and the legacy aliases quietly searched for the
    // filter as free text instead.
    const byCategory = await callJson('svgrid_search', { category: 'Kanban', kind: 'examples' })
    expect(byCategory.examples.total).toBeGreaterThan(0)
    expect(
      byCategory.examples.hits.every((e: { category: string }) => e.category === 'Kanban'),
    ).toBe(true)

    const bySection = await callJson('svgrid_search', { section: 'Help', kind: 'docs' })
    expect(bySection.docs.total).toBeGreaterThan(10)
  }, 30_000)

  it('names the bad filter instead of blaming the query', async () => {
    // "Try fewer or more general terms" is useless advice to a caller who
    // passed no terms at all - it sends a model round the same loop.
    const body = await callJson('svgrid_search', { category: 'Nope', kind: 'examples' })
    expect(body.hint).toMatch(/No demo category "Nope"/)
    expect(body.hint, 'the hint should list what IS valid').toMatch(/Kanban/)
  }, 30_000)

  it('clamps limit instead of trusting it', async () => {
    for (const [limit, want] of [[0, 10], [-5, 10], [5000, 50], ['abc', 10]] as const) {
      const body = await callJson('svgrid_search', { query: 'grid', kind: 'examples', limit })
      expect(body.examples.hits.length, `limit=${limit}`).toBe(want)
    }
  }, 30_000)

  it('truncates on a line boundary, not mid-token', async () => {
    const raw = await callTool('svgrid_get', { ref: '00-trading-desk', detail: 'concise' })
    expect(raw).toMatch(/truncated at \d+ of \d+ chars/)
    const body = raw.split('\n\n… truncated')[0]!
    expect(body.endsWith('\n') || /[\s});]$/.test(body), `ends: ${JSON.stringify(body.slice(-40))}`).toBe(true)
  }, 30_000)
})

describe.skipIf(!hasDist)('resources are paginated', () => {
  it('returns a page and a cursor, not all 783 at once', async () => {
    // The first cut returned every resource in one response: 147,604 chars,
    // ~36,900 tokens - worse than the 36-tool listing this redesign existed to
    // fix, and it lands the moment a client enumerates resources.
    const first = (await send('resources/list', {})) as {
      result?: { resources?: unknown[]; nextCursor?: string }
    }
    const page = first.result?.resources ?? []
    expect(page.length).toBeLessThanOrEqual(100)
    expect(JSON.stringify(first.result).length, 'one page is too big').toBeLessThan(30_000)
    expect(first.result?.nextCursor, 'no cursor, so the rest is unreachable').toBeTruthy()
  }, 30_000)

  it('walks every resource across pages', async () => {
    let cursor: string | undefined
    let seen = 0
    let pages = 0
    do {
      const res = (await send('resources/list', cursor ? { cursor } : {})) as {
        result?: { resources?: unknown[]; nextCursor?: string }
      }
      seen += res.result?.resources?.length ?? 0
      cursor = res.result?.nextCursor
      pages++
    } while (cursor && pages < 50)
    expect(seen, 'pagination lost resources').toBeGreaterThan(700)
  }, 60_000)

  it('restarts on a malformed cursor rather than throwing', async () => {
    const res = (await send('resources/list', { cursor: 'garbage' })) as {
      result?: { resources?: unknown[] }
    }
    expect(res.result?.resources?.length).toBeGreaterThan(0)
  }, 30_000)
})

/**
 * The visual preview: a real, interactive grid rendered in the conversation.
 *
 * Built on MCP Apps, the official UI extension - a tool points at a `ui://`
 * resource through `_meta`, the client loads that HTML in a sandboxed iframe,
 * and the tool's `structuredContent` arrives over a postMessage bridge.
 *
 * These cover the protocol shape and the payload. That the HTML actually
 * renders was verified in a browser: the served resource, with the bridge
 * stubbed and the same structuredContent pushed in, loads the element from the
 * CDN and draws 48 cells for a 12x4 grid, and clicking a header sorts it.
 */
describe.skipIf(!hasDist)('svgrid_preview renders a real grid', () => {
  const ARGS = {
    title: 'Team roster',
    columns: [
      { field: 'id', header: 'ID', width: 70 },
      { field: 'name', header: 'Name' },
    ],
    data: [
      { id: 1, name: 'Ada' },
      { id: 2, name: 'Alan' },
    ],
    sortable: true,
  }

  it('advertises a UI resource on the tool', async () => {
    const tool = (await listTools()).find((t) => t.name === 'svgrid_preview') as
      | { _meta?: Record<string, unknown> }
      | undefined
    expect(tool, 'svgrid_preview is not listed').toBeTruthy()
    expect(tool?._meta?.['ui/resourceUri']).toBe('ui://svgrid/preview.html')
  }, 30_000)

  it('serves that resource with the MCP Apps mime type', async () => {
    const res = (await send('resources/read', { uri: 'ui://svgrid/preview.html' })) as {
      result?: { contents?: { mimeType?: string; text?: string }[] }
    }
    const c = res.result?.contents?.[0]
    // Without this exact profile a client treats it as plain HTML and will not
    // render it as an app.
    expect(c?.mimeType).toBe('text/html;profile=mcp-app')
    expect(c?.text).toContain('sv-grid')
  }, 30_000)

  it('lists the preview resource on the first page', async () => {
    // It is one resource among 783; if it fell onto page 4 a client that reads
    // only the first page could never find it.
    const res = (await send('resources/list', {})) as {
      result?: { resources?: { uri: string }[] }
    }
    expect(res.result?.resources?.some((r) => r.uri === 'ui://svgrid/preview.html')).toBe(true)
  }, 30_000)

  it('returns structuredContent for the UI and text for everyone else', async () => {
    const res = (await send('tools/call', { name: 'svgrid_preview', arguments: ARGS })) as {
      result?: {
        content?: { text?: string }[]
        structuredContent?: { data?: unknown[]; columns?: unknown[] }
        _meta?: Record<string, unknown>
      }
    }
    expect(res.result?.structuredContent?.data).toHaveLength(2)
    expect(res.result?.structuredContent?.columns).toHaveLength(2)
    expect(res.result?._meta?.['ui/resourceUri']).toBe('ui://svgrid/preview.html')

    // Progressive enhancement is the rule the extension is built around: a
    // client without UI support shows ONLY this text, so it cannot be a stub
    // that points at a picture the reader will never see.
    const text = res.result?.content?.[0]?.text ?? ''
    expect(text).toContain('2 rows')
    expect(text).toContain('Team roster')
    expect(text.toLowerCase()).not.toMatch(/see (the )?(preview|grid) above/)
  }, 30_000)

  it('asks for what it needs instead of rendering an empty grid', async () => {
    const noColumns = await callTool('svgrid_preview', { data: [] })
    expect(noColumns).toMatch(/columns is required/)
    const noData = await callTool('svgrid_preview', { columns: [{ field: 'a' }] })
    expect(noData).toMatch(/data is required/)
  }, 30_000)

  it('returns a demo as source, and says why', async () => {
    // A demo is a Svelte component, not data - there is nothing to hand the
    // element, and rendering an empty grid would look like the demo is broken.
    const raw = await callTool('svgrid_preview', { demo: '11-stock-market' })
    expect(raw).toContain('<script')
    expect(raw).toMatch(/Svelte components, so this is the source/)
    expect(await callTool('svgrid_preview', { demo: 'nope' })).toMatch(/No demo with id/)
  }, 30_000)

  it('pins CDN versions that still exist in this workspace', async () => {
    // The preview loads @svgrid/grid-wc from a CDN at a pinned version. Pinned
    // so a future major cannot silently break it; checked here so the pin
    // cannot silently fall behind the package it is meant to demonstrate.
    const read = async (p: string) =>
      JSON.parse(await import('node:fs/promises').then((fs) => fs.readFile(join(ROOT, p), 'utf8')))
    const gridWc = await read('packages/grid-wc/package.json')
    const res = (await send('resources/read', { uri: 'ui://svgrid/preview.html' })) as {
      result?: { contents?: { text?: string }[] }
    }
    const html = res.result?.contents?.[0]?.text ?? ''
    expect(
      html,
      `preview pins a grid-wc version that is not ${gridWc.version}`,
    ).toContain(`@svgrid/grid-wc@${gridWc.version}`)
  }, 30_000)
})

/**
 * Auto-fix: the validator stops describing the edit and makes it.
 *
 * Reporting a mistake and leaving the caller to re-derive the edit from prose
 * is the loop this tool exists to shorten. But its entire worth is that it
 * never cries wolf, and rewriting raises the stakes: a false positive no longer
 * wastes a turn, it corrupts working code. Hence the narrow rules - exact
 * renames only, word boundaries, scoped to the reported line - and hence the
 * first test below, which is the one that actually matters.
 */
describe.skipIf(!hasDist)('svgrid_check_code corrects what it can', () => {
  const load = async () => {
    const validate = await import(join(ROOT, 'packages/mcp/dist/validate.js') as string)
    const { apiSurface } = await import(join(ROOT, 'packages/mcp/dist/data.js') as string)
    return { ...validate, apiSurface }
  }

  it('changes nothing in code that is already right', async () => {
    // Every demo in the repo is known-good. Any edit here is a false positive
    // that would have rewritten a working file.
    const { checkStatic, applyFixes, apiSurface } = await load()
    const { readdirSync, readFileSync } = await import('node:fs')
    const dir = join(ROOT, 'examples', 'src', 'demos')
    const files = readdirSync(dir).filter((f: string) => f.endsWith('.svelte'))
    expect(files.length, 'no demos found - the walker is broken').toBeGreaterThan(300)

    const changed: string[] = []
    for (const f of files) {
      const source = readFileSync(join(dir, f), 'utf8')
      const { fixed, applied } = applyFixes(source, checkStatic(source, apiSurface, f))
      if (applied.length || fixed !== source) changed.push(`${f}: ${applied.join(', ')}`)
    }
    expect(changed, 'auto-fix modified known-good code').toEqual([])
  }, 120_000)

  it('fixes a wrong file until it is clean', async () => {
    const { checkStatic, applyFixes, apiSurface } = await load()
    const broken = [
      '<script lang="ts">',
      "  import { SvGrid } from '@svgrid/grid'",
      "  const columns = [{ accessorKey: 'name', headerName: 'Name' }]",
      "  const rows = [{ name: 'Ada' }]",
      '</script>',
      '',
      '<SvGrid rowData={rows} columnDefs={columns} enableSorting />',
    ].join('\n')

    const diagnostics = checkStatic(broken, apiSurface, 'Broken.svelte')
    expect(diagnostics.length).toBeGreaterThan(4)

    const { fixed, applied } = applyFixes(broken, diagnostics)
    expect(applied).toContain('accessorKey -> field (line 3)')
    expect(applied).toContain('rowData -> data (line 7)')
    // The real proof: re-checking the corrected source finds nothing left.
    expect(checkStatic(fixed, apiSurface, 'Broken.svelte')).toEqual([])
  }, 30_000)

  it('never applies a rename that means "delete this"', async () => {
    // Several PROP_RENAMES map to '' - "there is no equivalent, take it out".
    // Applying that as a rename would splice the name away and leave `={...}`.
    const { checkStatic, applyFixes, apiSurface } = await load()
    const src = "<script>\n  import { SvGrid } from '@svgrid/grid'\n</script>\n<SvGrid rowModelType=\"client\" data={[]} columns={[]} />"
    const { fixed, applied } = applyFixes(src, checkStatic(src, apiSurface, 'X.svelte'))
    expect(applied.some((a: string) => a.startsWith('rowModelType'))).toBe(false)
    expect(fixed).toContain('rowModelType')
  }, 30_000)

  it('never substitutes a call expression for an identifier', async () => {
    // API_METHOD_HINTS values are calls - `exportData({ format: "xlsx" })` - so
    // a word-boundary swap would emit `api.exportData({...})(...)`.
    const { checkStatic, applyFixes, apiSurface } = await load()
    const src = "<script>\n  import { SvGrid } from '@svgrid/grid'\n  let api\n  const go = () => api.exportExcel()\n</script>\n<SvGrid data={[]} columns={[]} onApiReady={(a) => (api = a)} />"
    const { fixed } = applyFixes(src, checkStatic(src, apiSurface, 'X.svelte'))
    expect(fixed).not.toContain('exportData({ format: "xlsx" })()')
  }, 30_000)

  it('returns fixed + applied through the tool, and omits them when clean', async () => {
    const dirty = await callJson('svgrid_check_code', {
      source: "<script>\n  import { SvGrid } from '@svgrid/grid'\n</script>\n<SvGrid rowData={[]} columns={[]} />",
      filename: 'Dirty.svelte',
    })
    expect(dirty.applied).toContain('rowData -> data (line 4)')
    expect(dirty.fixed).toContain('data={[]}')

    const clean = await callJson('svgrid_check_code', {
      source: "<script>\n  import { SvGrid } from '@svgrid/grid'\n</script>\n<SvGrid data={[]} columns={[]} />",
      filename: 'Clean.svelte',
    })
    // The common case must not grow: nothing to fix, nothing extra returned.
    expect(clean.applied).toBeUndefined()
    expect(clean.fixed).toBeUndefined()
  }, 30_000)

  it('points at tools that exist', async () => {
    // The fix advice told models to "call get_api_reference", renamed in 3.0.
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(join(ROOT, 'packages/mcp/src/validate.ts'), 'utf8')
    expect(src).not.toContain('get_api_reference')
  })
})

/**
 * Answers pinned to the version the caller actually has.
 *
 * The competing MCP servers are thin clients to a vendor backend that serves
 * one global "latest" - it cannot know what is in your node_modules, so a model
 * can be told about an API you do not have, confidently and with a citation.
 * We ship the corpus, so we can compare and say when the two disagree.
 */
describe.skipIf(!hasDist)('the server knows which grid is installed', () => {
  const load = async () =>
    (await import(join(ROOT, 'packages/mcp/dist/installed.js') as string)) as {
      findInstalledGrid: (from: string) => { version: string; path: string } | null
      versionNote: (corpus: string) => { corpus: string; installed?: string; warning?: string }
      resetInstalledGrid: (next?: unknown) => void
    }

  it('finds a real installed grid by walking up', async () => {
    const { findInstalledGrid } = await load()
    // The website workspace has one; a nested directory must resolve to it.
    const deep = findInstalledGrid(join(ROOT, 'website', 'src', 'lib'))
    expect(deep?.version, 'did not resolve upward to the installed grid').toBeTruthy()
    expect(deep?.path).toContain('@svgrid')
  })

  it('says nothing when there is no grid installed', async () => {
    // The common case: the server is run from a directory with no SvGrid in it.
    // Inventing a mismatch there would be noise on every single call.
    const { findInstalledGrid } = await load()
    const { mkdtempSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const empty = mkdtempSync(join(tmpdir(), 'svgrid-none-'))
    expect(findInstalledGrid(empty)).toBeNull()
  })

  it('warns only when the corpus and the installed version disagree', async () => {
    const { versionNote, resetInstalledGrid } = await load()
    try {
      resetInstalledGrid({ version: '9.9.9', path: '/fake/package.json' })
      const mismatch = versionNote('3.0.0')
      expect(mismatch.warning, 'a version mismatch was not reported').toBeTruthy()
      expect(mismatch.warning).toContain('9.9.9')
      expect(mismatch.installed).toBe('9.9.9')

      resetInstalledGrid({ version: '3.0.0', path: '/fake/package.json' })
      expect(versionNote('3.0.0')?.warning, 'matching versions must be silent').toBeUndefined()

      // Nothing installed means nothing to add: the check result already says
      // the version in `checkedAgainst` and in its summary, so returning a bare
      // `{ corpus }` would be the same fact a third time on every call.
      resetInstalledGrid(null)
      expect(versionNote('3.0.0'), 'no install must add no field at all').toBeUndefined()
    } finally {
      resetInstalledGrid(undefined)
    }
  })

  it('always names the version it checked against', async () => {
    // `checkedAgainst` is the invariant - it is on every result. The `version`
    // object is the extra, and appears only when it has more to say than that.
    const body = await callJson('svgrid_check_code', {
      source: "<script>\n  import { SvGrid } from '@svgrid/grid'\n</script>\n<SvGrid data={[]} columns={[]} />",
    })
    expect(body.checkedAgainst, 'no version on the result at all').toContain('@svgrid/grid@')
    expect(body.summary).toContain('@svgrid/grid@')
  }, 30_000)
})

/**
 * Polish that a measurement caught, not a review.
 *
 * Each of these shipped briefly and looked fine: a redundant field, a missing
 * display name, a capability no prompt mentioned, an uncapped payload.
 */
describe.skipIf(!hasDist)('the surface presents itself properly', () => {
  it('gives every tool a display name', async () => {
    // Clients show `title` in their tool UI; without it they fall back to the
    // snake_case name, which reads like plumbing.
    const missing = (await listTools())
      .filter((t) => !(t as { title?: string }).title)
      .map((t) => t.name)
    expect(missing, `tools with no title: ${missing.join(', ')}`).toEqual([])
  }, 30_000)

  it('says in the description that it fixes, not just checks', async () => {
    // A model only learns a tool's capabilities from this string. The tool
    // returned `fixed` for a while without the description ever mentioning it.
    const check = (await listTools()).find((t) => t.name === 'svgrid_check_code') as
      | { description?: string }
      | undefined
    expect(check?.description).toMatch(/fixed|corrected/)
  }, 30_000)

  it('does not repeat the version three times on a clean check', async () => {
    // `checkedAgainst` and `summary` already name it. A `version` object saying
    // only the same thing was the third copy, on every single call.
    const body = await callJson('svgrid_check_code', {
      source: "<script>\n  import { SvGrid } from '@svgrid/grid'\n</script>\n<SvGrid data={[]} columns={[]} />",
    })
    expect(body.checkedAgainst).toBeTruthy()
    if (body.version) {
      // Present only when it adds something: an installed version, or a warning.
      expect(Object.keys(body.version).length, 'version adds nothing').toBeGreaterThan(1)
    }
  }, 30_000)

  it('caps preview rows and says it did', async () => {
    // structuredContent crosses into the conversation, so an unbounded `data`
    // puts the caller's whole table in the context window.
    const rows = Array.from({ length: 500 }, (_, i) => ({ id: i }))
    const res = (await send('tools/call', {
      name: 'svgrid_preview',
      arguments: { columns: [{ field: 'id', header: 'ID' }], data: rows },
    })) as { result?: { structuredContent?: { data?: unknown[] }; content?: { text?: string }[] } }

    expect(res.result?.structuredContent?.data?.length).toBeLessThanOrEqual(100)
    // Silently truncating would render a partial grid that looks complete.
    expect(res.result?.content?.[0]?.text).toMatch(/first 100 of 500 rows/)
  }, 30_000)

  it('points the build prompt at the whole loop', async () => {
    // The preview is the one capability no competitor has; leaving it out of
    // the prompt means it only gets used when the user thinks of it.
    const res = (await send('prompts/get', {
      name: 'build_grid',
      arguments: { description: 'a table of orders' },
    })) as { result?: { messages?: { content?: { text?: string } }[] } }
    const text = res.result?.messages?.[0]?.content?.text ?? ''
    expect(text).toContain('svgrid_check_code')
    expect(text).toContain('svgrid_preview')
    expect(text, 'the prompt should use the corrected source').toMatch(/`fixed`/)
  }, 30_000)
})

/**
 * Shape mistakes are caught at the call that made them.
 *
 * Found while running the release gate by hand: an `EntitySchema` field is
 * `{ field, type }`, but `{ name, type }` is the obvious guess and used to be
 * accepted silently. The entity stored, the screen built, and nothing complained
 * until `studio_build generate` failed with "no primary key ... or name a field
 * `id`" - on a schema that HAS a field called id. Following that advice
 * reproduces the error exactly. It cost three round trips to diagnose.
 */
describe.skipIf(!hasDist)('studio_apply rejects a mis-shaped schema early', () => {
  const studio = () => {
    // The Studio tools are opt-in, so this drives the module directly rather
    // than the default server surface.
    return import(join(ROOT, 'packages/mcp/dist/studio-tools.js') as string) as Promise<{
      handleStudioTool: (n: string, a: Record<string, unknown>) => { isError?: boolean; content: { text: string }[] } | undefined
    }>
  }

  it('names the wrong property instead of failing three calls later', async () => {
    const { handleStudioTool } = await studio()
    handleStudioTool('studio_project', { action: 'new', title: 'T' })
    const res = handleStudioTool('studio_apply', {
      ops: [{ op: 'add_entity', schema: { name: 'person', fields: [{ name: 'id', type: 'number' }] } }],
    })
    expect(res?.isError).toBe(true)
    const text = (res?.content ?? []).map((c) => c.text).join('')
    expect(text).toMatch(/fields use `field`, not `name`/)
    expect(text, 'the message should name the offending field').toContain('id')
  })

  it('accepts the correct shape', async () => {
    const { handleStudioTool } = await studio()
    handleStudioTool('studio_project', { action: 'new', title: 'T' })
    const res = handleStudioTool('studio_apply', {
      ops: [{ op: 'add_entity', schema: { name: 'person', fields: [{ field: 'id', type: 'number' }] } }],
    })
    expect(res?.isError, (res?.content ?? []).map((c) => c.text).join('')).toBeFalsy()
  })
})
