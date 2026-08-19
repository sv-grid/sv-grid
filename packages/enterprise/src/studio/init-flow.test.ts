import { describe, it, expect } from 'vitest'
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
    const prompts = scriptedPrompts(['3', '1', 'y', '1', '1', 'n', 'Shop', '.'])
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
    const prompts = scriptedPrompts(['4', 'https://api.example.com/widgets', 'widgets', 'y', '1', '1', 'n', 'API app', '.'])
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
