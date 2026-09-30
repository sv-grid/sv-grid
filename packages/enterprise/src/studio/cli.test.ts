import { describe, expect, it } from 'vitest'
import type { EntitySchema } from '../schema'
import { resolveSchema, resolveSchemas, runStudioAdd, runStudioAddApp, type StudioIO } from './cli'
import { MANAGED_END, MANAGED_START } from './scaffold'
import { runStudioInit } from './init-flow'

/** In-memory StudioIO for tests. */
function memIO(seed: Record<string, string> = {}) {
  const files = new Map<string, string>(Object.entries(seed))
  const io: StudioIO = {
    readFile: async (p) => (files.has(p) ? files.get(p)! : null),
    writeFile: async (p, c) => {
      files.set(p, c)
    },
  }
  return { io, files }
}

const drizzle = `
  import { pgTable, serial, text, integer, boolean } from 'drizzle-orm/pg-core'
  export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    active: boolean('active'),
  })
  export const orders = pgTable('orders', {
    id: serial('id').primaryKey(),
    total: integer('total'),
  })
`

describe('runStudioAdd', () => {
  it('introspects a Drizzle file, writes the 3 files, and verifies', async () => {
    const { io, files } = memIO({ 'src/lib/db/schema.ts': drizzle })
    const res = await runStudioAdd({ from: 'src/lib/db/schema.ts' }, io)

    expect(res.schema.name).toBe('users') // first table
    expect(res.written).toEqual([
      'src/lib/users.schema.ts',
      'src/routes/api/users/+server.ts',
      'src/routes/users/+page.svelte',
    ])
    expect(res.verify.ok).toBe(true) // generated page compiles
    expect(files.get('src/routes/users/+page.svelte')).toContain('<SvGrid')
  })

  it('selects a specific table with `table`', async () => {
    const { io } = memIO({ 'schema.ts': drizzle })
    const res = await runStudioAdd({ from: 'schema.ts', table: 'orders' }, io)
    expect(res.schema.name).toBe('orders')
    expect(res.schema.fields.map((f) => f.field)).toEqual(['id', 'total'])
  })

  it('scaffolds a real SQL data source when dataSource:"sql"', async () => {
    const { io, files } = memIO({ 'schema.ts': drizzle })
    await runStudioAdd({ from: 'schema.ts', dataSource: 'sql' }, io)
    const server = files.get('src/routes/api/users/+server.ts')!
    expect(server).toContain('createSqlDataSource')
    expect(server).toContain("table: \"users\"")
    expect(server).toContain('execute:')
  })

  it('regenerating preserves user edits outside the managed region', async () => {
    const { io, files } = memIO({ 'schema.ts': drizzle })
    await runStudioAdd({ from: 'schema.ts' }, io)

    // User hand-edits the page outside the managed block.
    const page = files.get('src/routes/users/+page.svelte')!
    const edited = page.replace('<div class="page">', '<div class="page my-custom-class">')
    files.set('src/routes/users/+page.svelte', edited)

    // Regenerate.
    await runStudioAdd({ from: 'schema.ts' }, io)
    const after = files.get('src/routes/users/+page.svelte')!
    expect(after).toContain('my-custom-class') // user edit survived
    expect(after).toContain(MANAGED_START)
    expect(after).toContain(MANAGED_END)
  })

  it('throws a helpful error when no input is given', async () => {
    const { io } = memIO()
    await expect(runStudioAdd({}, io)).rejects.toThrow(/provide `from`/)
  })

  it('accepts a ready EntitySchema directly', async () => {
    const schema: EntitySchema = {
      name: 'tags',
      idField: 'id',
      fields: [{ field: 'id', type: 'text', primaryKey: true }, { field: 'label', type: 'text' }],
    }
    const { io } = memIO()
    const res = await runStudioAdd({ schema }, io)
    expect(res.written).toHaveLength(3)
    expect(res.verify.ok).toBe(true)
  })
})

describe('runStudioAddApp', () => {
  const companies: EntitySchema = {
    name: 'companies', idField: 'id',
    fields: [{ field: 'id', type: 'number', primaryKey: true }, { field: 'name', type: 'text' }],
  }
  const contacts: EntitySchema = {
    name: 'contacts', idField: 'id',
    fields: [
      { field: 'id', type: 'number', primaryKey: true },
      { field: 'name', type: 'text' },
      { field: 'company_id', type: 'relation', relation: { entity: 'companies', foreignKey: 'company_id', labelField: 'name' } },
    ],
  }

  it('writes every entity screen plus the app shell, and verifies', async () => {
    const { io, files } = memIO()
    const res = await runStudioAddApp([companies, contacts], {}, io)
    expect(res.written).toContain('src/routes/+layout.svelte')
    expect(res.written).toContain('src/routes/+page.svelte')
    expect(res.written).toContain('src/routes/companies/+page.svelte')
    expect(res.written).toContain('src/routes/contacts/+page.svelte')
    expect(files.get('src/routes/+layout.svelte')).toContain('"href":"/contacts"')
    expect(res.verify.ok).toBe(true)
  })
})

// A linked Drizzle file (posts.authorId -> users) and the equivalent Prisma.
const linkedDrizzle = `
  import { pgTable, serial, text, integer } from 'drizzle-orm/pg-core'
  export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
  })
  export const posts = pgTable('posts', {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    authorId: integer('author_id').references(() => users.id),
  })
`

const linkedPrisma = `
  model User {
    id    Int    @id @default(autoincrement())
    name  String
    posts Post[]
  }
  model Post {
    id       Int    @id @default(autoincrement())
    title    String
    author   User   @relation(fields: [authorId], references: [id])
    authorId Int
  }
`

describe('resolveSchema (single, from a file)', () => {
  it('detects Prisma by content and turns @relation into a relation field', async () => {
    const { io } = memIO({ 'schema.prisma': linkedPrisma })
    const schema = await resolveSchema({ from: 'schema.prisma', table: 'Post' }, io)
    const rel = schema.fields.find((f) => f.field === 'authorId')!
    expect(rel.type).toBe('relation')
    expect(rel.relation?.entity).toBe('User')
  })

  it('parses a Drizzle .references() column as a relation', async () => {
    const { io } = memIO({ 'schema.ts': linkedDrizzle })
    const schema = await resolveSchema({ from: 'schema.ts', table: 'posts' }, io)
    expect(schema.fields.find((f) => f.field === 'authorId')?.type).toBe('relation')
  })
})

describe('resolveSchemas + runStudioAddApp (--all --from a file)', () => {
  it('scaffolds a linked app from a Drizzle schema and verifies', async () => {
    const { io, files } = memIO({ 'schema.ts': linkedDrizzle })
    const schemas = await resolveSchemas('schema.ts', io)
    expect(schemas.map((s) => s.name)).toEqual(['users', 'posts'])

    const res = await runStudioAddApp(schemas, {}, io)
    expect(res.written).toContain('src/routes/users/+page.svelte')
    expect(res.written).toContain('src/routes/posts/+page.svelte')
    expect(files.get('src/routes/+layout.svelte')).toContain('"href":"/posts"')
    expect(res.verify.ok).toBe(true)
  })

  it('scaffolds a linked app from a Prisma schema and verifies', async () => {
    const { io } = memIO({ 'schema.prisma': linkedPrisma })
    const schemas = await resolveSchemas('schema.prisma', io)
    expect(schemas.map((s) => s.name)).toEqual(['User', 'Post'])
    const res = await runStudioAddApp(schemas, {}, io)
    expect(res.verify.ok).toBe(true)
  })
})

// GitHub #106: `add --all` in a folder `init` generated rewrote the layout
// without the app.css / custom.css imports (the app lost its styling) and
// reset the title to "Data App".
describe('runStudioAddApp over an app init generated', () => {
  it('keeps the stylesheet imports, the title and the theme', async () => {
    const { io, files } = memIO({ 'schema.ts': linkedDrizzle })
    await runStudioInit(
      { from: 'schema.ts', yes: true, title: 'Orders Desk', theme: 'material', dark: true },
      { ask: async (_q, def) => def ?? '', say: () => {} },
      null,
      io,
    )
    expect(files.get('src/routes/+layout.svelte')).toContain("import '../app.css'")

    const res = await runStudioAddApp(await resolveSchemas('schema.ts', io), {}, io)
    const layout = files.get('src/routes/+layout.svelte')!
    expect(layout).toContain("import '../app.css'")
    expect(layout).toContain("import '../custom.css'")
    expect(layout.indexOf("import '../app.css'")).toBeLessThan(layout.indexOf("import '../custom.css'"))
    expect(layout).toContain('const appTitle = "Orders Desk"')
    expect(layout).not.toContain('Data App')
    expect(files.get('src/routes/+page.svelte')).toContain('const appTitle = "Orders Desk"')
    expect(layout).toContain('--sg-accent: #6750a4') // material, from studio.config.json
    expect(layout).toMatch(/:root \{[^}]*color-scheme: dark;/)
    expect(res.verify.ok).toBe(true)
  })

  it('keeps the title across a second add --all with no studio.config.json', async () => {
    const { io, files } = memIO({ 'schema.ts': linkedDrizzle })
    const schemas = await resolveSchemas('schema.ts', io)
    await runStudioAddApp(schemas, { appTitle: 'Blog "Admin"' }, io)
    await runStudioAddApp(schemas, {}, io)
    expect(files.get('src/routes/+layout.svelte')).toContain('const appTitle = "Blog \\"Admin\\""')
  })

  it('an explicit title wins over studio.config.json', async () => {
    const { io, files } = memIO({ 'schema.ts': linkedDrizzle, 'studio.config.json': '{"title":"Old"}' })
    await runStudioAddApp(await resolveSchemas('schema.ts', io), { appTitle: 'New' }, io)
    expect(files.get('src/routes/+layout.svelte')).toContain('const appTitle = "New"')
  })

  it('imports no stylesheet the app does not have', async () => {
    const { io, files } = memIO({ 'schema.ts': linkedDrizzle, 'src/app.css': ':root {}' })
    await runStudioAddApp(await resolveSchemas('schema.ts', io), {}, io)
    const layout = files.get('src/routes/+layout.svelte')!
    expect(layout).toContain("import '../app.css'")
    expect(layout).not.toContain('custom.css')
  })
})
