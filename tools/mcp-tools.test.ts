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

describe.skipIf(!hasDist)('MCP discovery tools stay cheap', () => {
  // 12k chars is ~3k tokens: roomy versus the 25-item default, and a quarter of
  // what the unfiltered call used to cost.
  const BUDGET = 12_000

  it('list_examples answers a bare call with a category index, not the catalogue', async () => {
    const raw = await callTool('list_examples', {})
    expect(raw.length, `bare list_examples is ${raw.length} chars, was 125,631`).toBeLessThan(BUDGET)

    const body = JSON.parse(raw)
    expect(body.total).toBeGreaterThan(300)
    expect(body.shown).toBeLessThanOrEqual(25)
    expect(Object.keys(body.categories ?? {}).length).toBeGreaterThan(5)
    expect(body.hint, 'a truncated listing must say how to narrow').toBeTruthy()
  }, 30_000)

  it('list_docs answers a bare call with a section index, not every page', async () => {
    const raw = await callTool('list_docs', {})
    expect(raw.length, `bare list_docs is ${raw.length} chars, was 50,676`).toBeLessThan(BUDGET)

    const body = JSON.parse(raw)
    expect(body.total).toBeGreaterThan(300)
    expect(body.shown).toBeLessThanOrEqual(30)
    expect(Object.keys(body.sections ?? {}).length).toBeGreaterThan(5)
  }, 30_000)

  it('filters examples by category and by free text', async () => {
    const byCategory = await callJson('list_examples', { category: 'Kanban' })
    expect(byCategory.total).toBeGreaterThan(0)
    expect(byCategory.examples.every((e: { category: string }) => e.category === 'Kanban')).toBe(true)

    const byQuery = await callJson('list_examples', { query: 'server side' })
    expect(byQuery.examples.length).toBeGreaterThan(0)
    expect(byQuery.examples.some((e: { id: string }) => e.id === '09-server-side')).toBe(true)
  }, 30_000)

  it('caps limit so a large value cannot restore the old payload', async () => {
    const body = await callJson('list_examples', { limit: 5000 })
    expect(body.shown).toBeLessThanOrEqual(100)
  }, 30_000)
})

describe.skipIf(!hasDist)('search_docs ranks the canonical page first', () => {
  // Each query names the page a developer means. Before ranking existed these
  // lost to whichever file merely mentioned the phrase earliest in directory
  // order.
  const CASES: [query: string, canonical: string][] = [
    ['kanban board', 'help/rows/kanban-board'],
    ['inline editing', 'help/editing/overview'],
    ['pivot table', 'help/pivot'],
    ['column filtering', 'help/filtering/overview'],
    ['data export', 'help/export'],
  ]

  it.each(CASES)('ranks %s -> %s first', async (query, canonical) => {
    const body = await callJson('search_docs', { query })
    expect(body.hits.length).toBeGreaterThan(0)
    expect(body.hits[0].slug, `top hits: ${body.hits.slice(0, 3).map((h: { slug: string }) => h.slug).join(', ')}`).toBe(canonical)
  }, 30_000)

  it('matches terms in any order, not one contiguous substring', async () => {
    // No doc contains the literal string "virtualization row"; term matching
    // still finds the virtualization pages.
    const body = await callJson('search_docs', { query: 'virtualization row' })
    expect(body.hits.length).toBeGreaterThan(0)
    expect(body.hits.some((h: { slug: string }) => h.slug.includes('virtualization') || h.slug === 'recipes/million-rows')).toBe(true)
  }, 30_000)
})
