import { describe, it, expect, vi, afterEach } from 'vitest'
import { runStudioInit, parseSelection, type DbGateway, type PromptIO } from './init-flow.js'
import type { StudioIO } from './cli.js'
import { parseProject, validateProject, type GridConfig } from './project.js'

/** A scripted terminal: answers are consumed in order, defaults fill the rest. */
function scriptedPrompts(answers: string[]) {
  const asked: string[] = []
  const said: string[] = []
  const queue = [...answers]
  const io: PromptIO = {
    ask: async (question, def) => {
      asked.push(question)
      const next = queue.shift()
      return next === undefined ? (def ?? '') : next
    },
    say: (line) => said.push(line),
  }
  return { io, asked, said, get remaining() { return queue.length } }
}

/** An in-memory filesystem. */
function memoryIo() {
  const files = new Map<string, string>()
  const io: StudioIO = {
    readFile: async (path) => files.get(path) ?? null,
    writeFile: async (path, contents) => { files.set(path, contents) },
  }
  return { io, files }
}

/** A fake Postgres holding two tables, answering the real catalog queries
 *  (which alias their columns to name / type / nullable / pk). */
function fakeDb(): DbGateway {
  const columns: Record<string, { name: string; type: string; nullable: number; pk: number }[]> = {
    customers: [
      { name: 'id', type: 'integer', nullable: 0, pk: 1 },
      { name: 'name', type: 'text', nullable: 0, pk: 0 },
      { name: 'city', type: 'text', nullable: 1, pk: 0 },
    ],
    orders: [
      { name: 'id', type: 'integer', nullable: 0, pk: 1 },
      { name: 'total', type: 'numeric', nullable: 1, pk: 0 },
    ],
  }
  return {
    ensureDriver: async () => ({ ok: true }),
    connect: async () => async (sql: string, params: unknown[]) => {
      if (/count\(\*\)/i.test(sql)) return [{ n: 7 }]
      if (/information_schema\.tables/i.test(sql)) return Object.keys(columns).map((name) => ({ name }))
      if (/information_schema\.columns/i.test(sql)) return columns[String(params[0] ?? '')] ?? []
      return [] // no foreign keys
    },
  }
}

/** Stand in for a Supabase project: PostgREST serves its OpenAPI doc at /rest/v1/. */
function stubSupabase(definitions: Record<string, unknown> | null) {
  vi.stubGlobal('fetch', async (input: string | URL) => {
    const href = String(input)
    if (href.endsWith('/rest/v1/')) {
      if (!definitions) return new Response('nope', { status: 401 })
      return new Response(JSON.stringify({ definitions }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    // Row-sample and CSV fallbacks: answer empty so only the OpenAPI path counts.
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
  })
}

const SUPABASE_DEFS = {
  customers: {
    required: ['id', 'name'],
    properties: {
      id: { type: 'integer', description: 'Note:\nThis is a Primary Key.<pk/>' },
      name: { type: 'string' },
      tier: { type: 'string', enum: ['free', 'pro'] },
    },
  },
  orders: {
    required: ['id'],
    properties: {
      id: { type: 'integer', description: '<pk/>' },
      total: { type: 'number' },
      customer_id: { type: 'integer', description: "<fk table='customers' column='id'/>" },
    },
  },
}

describe('parseSelection', () => {
  const items = ['customers', 'orders', 'invoices']

  it('takes everything by default', () => {
    expect(parseSelection('', items)).toEqual(items)
    expect(parseSelection('all', items)).toEqual(items)
    expect(parseSelection('*', items)).toEqual(items)
  })

  it('takes nothing for "none"', () => {
    expect(parseSelection('none', items)).toEqual([])
  })

  it('accepts names, numbers, and a mix - without duplicates', () => {
    expect(parseSelection('orders', items)).toEqual(['orders'])
    expect(parseSelection('1, 3', items)).toEqual(['customers', 'invoices'])
    expect(parseSelection('2, invoices', items)).toEqual(['orders', 'invoices'])
    expect(parseSelection('orders, 2', items)).toEqual(['orders'])
  })

  it('ignores names and numbers that do not exist', () => {
    expect(parseSelection('nope, 9, orders', items)).toEqual(['orders'])
  })
})

describe('runStudioInit', () => {
  it('builds a runnable app from a starter dataset with all defaults', async () => {
    const prompts = scriptedPrompts([])
    const fs = memoryIo()
    const result = await runStudioInit({ yes: true }, prompts.io, null, fs.io)

    expect(result.project.entities.length).toBeGreaterThanOrEqual(2)
    expect(validateProject(result.project).filter((i) => i.level === 'error')).toEqual([])
    expect(result.written).toContain('studio.config.json')
    expect(result.written.some((p) => p.endsWith('package.json'))).toBe(true)
    expect(result.written.some((p) => p.includes('+page.svelte'))).toBe(true)
    // --yes asks nothing.
    expect(prompts.asked).toEqual([])
    // The written config re-parses into the same project.
    expect(parseProject(fs.files.get('studio.config.json')!)).toEqual(result.project)
  })

  it('asks the questions in order when driven interactively', async () => {
    const prompts = scriptedPrompts([
      '1',        // source: sample data
      '2',        // dataset: products & categories
      'y',        // full CRUD suite
      '1',        // editing: popup form
      '1',        // theme
      'n',        // dark mode
      'Catalog',  // app name
      '.',        // out dir
    ])
    const fs = memoryIo()
    const result = await runStudioInit({}, prompts.io, null, fs.io)

    expect(prompts.asked).toEqual([
      'Pick a number:',   // source
      'Pick a number:',   // dataset
      '\nGenerate a list, an edit form and a record page for each table? (Y/n)',
      'Pick a number:',   // editing mode
      'Pick a number:',   // theme
      'Dark mode? (y/N)',
      '\nApp name:',
      'Write it where?',
    ])
    expect(result.project.title).toBe('Catalog')
    expect(result.project.entities.map((e) => e.name)).toEqual(['categories', 'products'])
  })

  it('honours the out directory', async () => {
    const prompts = scriptedPrompts([])
    const fs = memoryIo()
    const result = await runStudioInit({ yes: true, out: 'apps/shop' }, prompts.io, null, fs.io)

    expect(result.written.every((p) => p.startsWith('apps/shop/'))).toBe(true)
    expect(result.nextSteps[0]).toBe('cd apps/shop')
    expect(fs.files.has('apps/shop/studio.config.json')).toBe(true)
  })

  it('stores a dataset in PGlite when that source is picked', async () => {
    // Source menu: 1 sample, 2 database, 3 supabase, 4 pglite, 5 rest.
    const prompts = scriptedPrompts(['4', '1', 'y', '1', '1', 'n', 'Shop', '.'])
    const fs = memoryIo()
    const result = await runStudioInit({}, prompts.io, null, fs.io)

    expect(result.project.dataSource).toBe('pglite')
    const first = result.project.entities[0]!.name
    expect(result.project.dataSources?.[first]).toMatchObject({ kind: 'pglite', table: first })
    // The seed rides along, so the generated app boots with data.
    expect((result.project.dataSources?.[first] as { seed?: unknown[] }).seed?.length).toBeGreaterThan(0)
  })

  it('reads tables from a live database', async () => {
    const prompts = scriptedPrompts(['all', 'y', '1', '1', 'n', 'Ops', '.'])
    const fs = memoryIo()
    const result = await runStudioInit(
      { db: 'postgres', url: 'postgres://localhost/app' },
      prompts.io,
      fakeDb(),
      fs.io,
    )

    expect(result.project.entities.map((e) => e.name)).toEqual(['customers', 'orders'])
    expect(result.project.dataSource).toBe('sql')
    expect(result.project.dataSources?.customers).toEqual({ kind: 'sql', table: 'customers', dialect: 'postgres' })
    // --db + --url skip the connection questions entirely.
    expect(prompts.asked[0]).toBe('Which tables? (all, or a comma list of names/numbers)')
  })

  it('imports only the picked tables', async () => {
    const prompts = scriptedPrompts(['orders', 'y', '1', '1', 'n', 'Ops', '.'])
    const fs = memoryIo()
    const result = await runStudioInit({ db: 'postgres', url: 'postgres://x' }, prompts.io, fakeDb(), fs.io)
    expect(result.project.entities.map((e) => e.name)).toEqual(['orders'])
  })

  it('fails clearly when the driver cannot be installed', async () => {
    const prompts = scriptedPrompts(['all'])
    const fs = memoryIo()
    const db: DbGateway = { ...fakeDb(), ensureDriver: async () => ({ ok: false, message: 'pg is not installed' }) }
    await expect(runStudioInit({ db: 'postgres', url: 'postgres://x' }, prompts.io, db, fs.io))
      .rejects.toThrow('pg is not installed')
  })

  it('fails clearly when no table is picked', async () => {
    const prompts = scriptedPrompts(['none'])
    const fs = memoryIo()
    await expect(runStudioInit({ db: 'postgres', url: 'postgres://x' }, prompts.io, fakeDb(), fs.io))
      .rejects.toThrow('No tables picked')
  })

  it('refuses a database when no gateway is available', async () => {
    const prompts = scriptedPrompts([])
    const fs = memoryIo()
    await expect(runStudioInit({ db: 'postgres', url: 'postgres://x' }, prompts.io, null, fs.io))
      .rejects.toThrow('not available here')
  })

  it('rejects an unknown dataset id by name', async () => {
    const prompts = scriptedPrompts([])
    const fs = memoryIo()
    await expect(runStudioInit({ yes: true, dataset: 'nope' }, prompts.io, null, fs.io))
      .rejects.toThrow(/Unknown dataset "nope"/)
  })

  it('builds an app from a REST endpoint', async () => {
    const prompts = scriptedPrompts(['5', 'https://api.example.com/widgets', 'widgets', 'y', '1', '1', 'n', 'API app', '.'])
    const fs = memoryIo()
    const rows = JSON.stringify({ data: [{ id: 1, name: 'Widget', price: 9.5 }] })
    const result = await runStudioInit({}, prompts.io, null, fs.io, async () => rows)

    expect(result.project.entities.map((e) => e.name)).toEqual(['widgets'])
    expect(result.project.dataSources?.widgets).toMatchObject({ kind: 'rest', baseUrl: 'https://api.example.com', path: 'widgets' })
  })

  it('applies the picked editing mode to the generated grids', async () => {
    const prompts = scriptedPrompts(['1', '1', 'y', '2', '1', 'n', 'Inline', '.'])
    const fs = memoryIo()
    const result = await runStudioInit({}, prompts.io, null, fs.io)

    const listScreen = result.project.screens.find((s) => s.id === result.project.entities[0]!.name)!
    const grid = listScreen.blocks.find((b) => b.config.kind === 'grid')!.config as GridConfig
    expect(grid.editing).toBe('inline')
  })

  describe('supabase', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('reads a project over the REST API and binds each table to it', async () => {
      stubSupabase(SUPABASE_DEFS)
      const prompts = scriptedPrompts(['all', 'y', '1', '1', 'n', 'Shop', '.'])
      const fs = memoryIo()
      const result = await runStudioInit(
        { supabaseUrl: 'https://abc.supabase.co', supabaseKey: 'anon-key' },
        prompts.io,
        null, // no DbGateway: the point is that Supabase needs no driver
        fs.io,
      )

      expect(result.project.entities.map((e) => e.name)).toEqual(['customers', 'orders'])
      expect(result.project.dataSource).toBe('supabase')
      expect(result.project.dataSources?.customers).toEqual({
        kind: 'supabase', table: 'customers', url: 'https://abc.supabase.co', key: 'anon-key',
      })
      expect(validateProject(result.project).filter((i) => i.level === 'error')).toEqual([])
      // The URL + key flags skip straight to the table question.
      expect(prompts.asked[0]).toBe('Which tables? (all, or a comma list of names/numbers)')
    })

    it('picks up the primary key and the foreign key from the API doc', async () => {
      stubSupabase(SUPABASE_DEFS)
      const prompts = scriptedPrompts(['all', 'y', '1', '1', 'n', 'Shop', '.'])
      const fs = memoryIo()
      const { project } = await runStudioInit(
        { supabaseUrl: 'https://abc.supabase.co', supabaseKey: 'k' }, prompts.io, null, fs.io,
      )
      const orders = project.entities.find((e) => e.name === 'orders')!
      expect(orders.fields.find((f) => f.field === 'id')?.primaryKey).toBe(true)
      expect(orders.fields.find((f) => f.field === 'customer_id')?.relation?.entity).toBe('customers')
      // A relation means the customers detail page gets an orders tab.
      expect(project.screens.some((s) => s.id === 'customers-detail')).toBe(true)
    })

    it('imports only the picked tables', async () => {
      stubSupabase(SUPABASE_DEFS)
      const prompts = scriptedPrompts(['orders', 'y', '1', '1', 'n', 'Shop', '.'])
      const fs = memoryIo()
      const { project } = await runStudioInit(
        { supabaseUrl: 'https://abc.supabase.co', supabaseKey: 'k' }, prompts.io, null, fs.io,
      )
      expect(project.entities.map((e) => e.name)).toEqual(['orders'])
    })

    it('falls back to typed table names when the API doc is restricted', async () => {
      // 401 on the doc, but each table still introspects from a sample row.
      let calls = 0
      vi.stubGlobal('fetch', async (input: string | URL) => {
        const href = String(input)
        calls++
        if (href.endsWith('/rest/v1/')) return new Response('no', { status: 401 })
        return new Response(JSON.stringify([{ id: 1, name: 'Acme' }]), {
          status: 200, headers: { 'content-type': 'application/json' },
        })
      })
      const prompts = scriptedPrompts(['customers', 'y', '1', '1', 'n', 'Shop', '.'])
      const fs = memoryIo()
      const { project } = await runStudioInit(
        { supabaseUrl: 'https://abc.supabase.co', supabaseKey: 'k' }, prompts.io, null, fs.io,
      )
      expect(calls).toBeGreaterThan(0)
      expect(project.entities.map((e) => e.name)).toEqual(['customers'])
      expect(project.entities[0]!.fields.map((f) => f.field)).toContain('name')
      expect(prompts.asked).toContain('Table names (comma separated):')
    })

    it('requires both the URL and the key', async () => {
      const prompts = scriptedPrompts(['', ''])
      const fs = memoryIo()
      await expect(runStudioInit({ supabaseUrl: 'https://abc.supabase.co' }, prompts.io, null, fs.io))
        .rejects.toThrow('project URL and the anon key are required')
    })

    it('fails clearly when no picked table can be read', async () => {
      // Doc lists nothing AND every per-table fallback 404s.
      vi.stubGlobal('fetch', async (input: string | URL) =>
        String(input).endsWith('/rest/v1/')
          ? new Response(JSON.stringify({ definitions: {} }), { status: 200, headers: { 'content-type': 'application/json' } })
          : new Response('missing', { status: 404 }),
      )
      const prompts = scriptedPrompts(['ghosts'])
      const fs = memoryIo()
      await expect(runStudioInit(
        { supabaseUrl: 'https://abc.supabase.co', supabaseKey: 'k' }, prompts.io, null, fs.io,
      )).rejects.toThrow('None of the picked tables could be read')
    })
  })

  it('applies the chosen theme', async () => {
    const prompts = scriptedPrompts([])
    const fs = memoryIo()
    const result = await runStudioInit({ yes: true, theme: 'material', dark: true }, prompts.io, null, fs.io)
    expect(result.project.theme?.preset).toBe('material')
    expect(result.project.theme?.mode).toBe('dark')
  })

  it('keeps user-owned files that already exist', async () => {
    const fs = memoryIo()
    await runStudioInit({ yes: true }, scriptedPrompts([]).io, null, fs.io)
    const handlers = [...fs.files.keys()].find((p) => p.endsWith('handlers.ts'))
    if (!handlers) return // no user-owned companion in this project shape
    fs.files.set(handlers, '// my own code')
    await runStudioInit({ yes: true }, scriptedPrompts([]).io, null, fs.io)
    expect(fs.files.get(handlers)).toBe('// my own code')
  })
})
