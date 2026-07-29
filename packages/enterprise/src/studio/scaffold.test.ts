import { describe, expect, it } from 'vitest'
import { compile } from 'svelte/compiler'
import type { EntitySchema } from '../schema'
import { MANAGED_END, MANAGED_START, mergeManaged, scaffold, skipUserOwned } from './scaffold'

const schema: EntitySchema = {
  name: 'customers',
  label: 'Customer',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'firstName', type: 'text', required: true },
    { field: 'age', type: 'number' },
    { field: 'tier', type: 'enum', options: [{ value: 'free', label: 'Free' }] },
  ],
}

describe('scaffold', () => {
  const { files } = scaffold(schema)
  const byPath = Object.fromEntries(files.map((f) => [f.path, f]))

  it('emits schema, server route, and page files at SvelteKit paths', () => {
    expect(Object.keys(byPath).sort()).toEqual([
      'src/lib/customers.schema.ts',
      'src/routes/api/customers/+server.ts',
      'src/routes/customers/+page.svelte',
    ])
  })

  it('the schema file exports a typed EntitySchema literal and Row type', () => {
    const c = byPath['src/lib/customers.schema.ts']!.contents
    expect(c).toContain('export const customersSchema: EntitySchema<CustomersRow>')
    expect(c).toContain('export type CustomersRow = {')
    expect(c).toContain('age: number')
    expect(c).toContain('firstName: string')
    expect(c).toContain(`field: "tier", type: "enum"`)
    expect(c).toContain(`options: [{"value":"free","label":"Free"}]`)
  })

  it('the server route wires createKitHandlers', () => {
    const c = byPath['src/routes/api/customers/+server.ts']!.contents
    expect(c).toContain('createKitHandlers({ schema: customersSchema, source })')
    expect(c).toContain('export const { POST }')
  })

  it('the page wires the grid + edit panel over the transport', () => {
    const c = byPath['src/routes/customers/+page.svelte']!.contents
    expect(c).toContain("createKitDataSource<CustomersRow>({ endpoint: '/api/customers' })")
    expect(c).toContain('schemaToColumns(customersSchema)')
    expect(c).toContain('<SvGrid')
    expect(c).toContain('<SvGridEditPanel')
  })

  it('the page is a full data screen: sort, filter, paging, delete, optimistic', () => {
    const c = byPath['src/routes/customers/+page.svelte']!.contents
    expect(c).toContain('sortable')
    expect(c).toContain('externalSort')
    expect(c).toContain('controller.setSort(s)')
    expect(c).toContain('filterable')
    expect(c).toContain('showGlobalFilter')
    expect(c).toContain('controller.setFilter(') // server filtering
    expect(c).toContain('fitColumns') // columns fill the width
    expect(c).toContain('enableRowSummaries={false}') // no default summary
    expect(c).toContain('externalPagination') // native server pagination footer
    expect(c).toContain('onPaginationChange')
    expect(c).toContain('controller.setPage(') // pagination
    expect(c).toContain('removeSelected') // multi-select delete
    expect(c).toContain('optimistic: true')
    expect(c).toContain("getRowId: (r) => String(r.id)") // uses the primary key
    expect(c).toContain('role="alert"') // error state
    expect(c).toContain('emptyMessage=') // empty state
  })

  it('the generated page is syntactically valid Svelte (compiles)', () => {
    // Compile with Svelte's own compiler - validates markup, runes, bindings,
    // and snippets. (It does not resolve imports; that's the bundler's job.)
    const page = byPath['src/routes/customers/+page.svelte']!.contents
    expect(() => compile(page, { filename: '+page.svelte', generate: 'client' })).not.toThrow()
  })

  it('wraps every file body in managed markers', () => {
    for (const f of files) {
      expect(f.contents).toContain(MANAGED_START)
      expect(f.contents).toContain(MANAGED_END)
    }
  })

  it('emits a connected +server.ts for a database dialect', () => {
    const pg = scaffold(schema, { dataSource: 'postgres' }).files.find(
      (f) => f.path === 'src/routes/api/customers/+server.ts',
    )!.contents
    expect(pg).toContain("import pg from 'pg'")
    expect(pg).toContain('new pg.Pool({ connectionString: process.env.DATABASE_URL })')
    expect(pg).toContain('createSqlDataSource')
    expect(pg).toContain("placeholders: '$'")
    expect(pg).toContain('await pool.query(text, params)')

    const sqlite = scaffold(schema, { dataSource: 'sqlite' }).files.find((f) =>
      f.path.endsWith('+server.ts'),
    )!.contents
    expect(sqlite).toContain("import Database from 'better-sqlite3'")
    expect(sqlite).toContain('db.prepare(text).all(...params)')

    const mssql = scaffold(schema, { dataSource: 'mssql' }).files.find((f) =>
      f.path.endsWith('+server.ts'),
    )!.contents
    expect(mssql).toContain("import mssql from 'mssql'")
    expect(mssql).toContain("placeholders: '@'")

    // supabase reuses the postgres driver
    const supa = scaffold(schema, { dataSource: 'supabase' }).files.find((f) =>
      f.path.endsWith('+server.ts'),
    )!.contents
    expect(supa).toContain("import pg from 'pg'")
  })

  it('honors route/apiRoute overrides', () => {
    const { files: f2 } = scaffold(schema, { route: 'clients', apiRoute: '/data/clients' })
    const paths = f2.map((x) => x.path)
    expect(paths).toContain('src/routes/clients/+page.svelte')
    expect(paths).toContain('src/routes/data/clients/+server.ts')
  })

  it('the base page (no relations) has no lookup wiring', () => {
    const c = byPath['src/routes/customers/+page.svelte']!.contents
    expect(c).not.toContain('createRelationLookup')
    expect(c).not.toContain('lookups={lookups}')
  })
})

describe('scaffold with relation fields', () => {
  const relSchema: EntitySchema = {
    name: 'contacts',
    label: 'Contact',
    idField: 'id',
    fields: [
      { field: 'id', type: 'number', primaryKey: true, readonly: true },
      { field: 'name', type: 'text', required: true },
      { field: 'companyId', type: 'relation', label: 'Company', relation: { entity: 'companies', foreignKey: 'companyId', labelField: 'name' } },
    ],
  }
  const page = scaffold(relSchema).files.find((f) => f.path === 'src/routes/contacts/+page.svelte')!.contents

  it('generates a lookup over the related API route and wires it into the edit panel', () => {
    expect(page).toContain('createRelationLookup')
    expect(page).toContain('createKitDataSource({ endpoint: "/api/companies" })')
    expect(page).toContain('labelField: "name"')
    expect(page).toContain('const lookups = { "companyId": companyIdLookup }')
    expect(page).toContain('lookups={lookups}')
  })

  it('the page with lookups is valid Svelte (compiles)', () => {
    expect(() => compile(page, { filename: '+page.svelte', generate: 'client' })).not.toThrow()
  })
})

describe('mergeManaged', () => {
  it('uses the generated file whole when there is no existing content', () => {
    const gen = `head\n${MANAGED_START}\nX\n${MANAGED_END}\ntail`
    expect(mergeManaged(null, gen)).toBe(gen)
  })

  it('replaces only the managed region, preserving user edits outside', () => {
    const existing = `import x\n${MANAGED_START}\nOLD\n${MANAGED_END}\n// my custom helper\nconst keep = 1`
    const generated = `import y\n${MANAGED_START}\nNEW\n${MANAGED_END}\nignored tail`
    const merged = mergeManaged(existing, generated)
    expect(merged).toContain('import x') // user's import kept
    expect(merged).toContain('// my custom helper') // user's code kept
    expect(merged).toContain('const keep = 1')
    expect(merged).toContain('NEW') // managed region updated
    expect(merged).not.toContain('OLD')
    expect(merged).not.toContain('ignored tail')
  })

  it('falls back to generated when existing has no markers', () => {
    expect(mergeManaged('no markers here', 'GEN')).toBe('GEN')
  })
})

describe('skipUserOwned (the handlers.ts write-once contract)', () => {
  it('skips a user-owned file that already exists on disk (never clobber user code)', () => {
    expect(skipUserOwned({ userOwned: true }, true)).toBe(true)
  })
  it('writes a user-owned file when it does not exist yet (scaffold the stub once)', () => {
    expect(skipUserOwned({ userOwned: true }, false)).toBe(false)
  })
  it('always writes a generated (non-user-owned) file, whether or not it exists', () => {
    expect(skipUserOwned({ userOwned: false }, true)).toBe(false)
    expect(skipUserOwned({}, true)).toBe(false)
    expect(skipUserOwned({ userOwned: undefined }, true)).toBe(false)
  })
})
