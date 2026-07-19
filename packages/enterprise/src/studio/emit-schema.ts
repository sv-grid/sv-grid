/**
 * emitStudioApp - turn a set of `EntitySchema`s into the source files of a
 * runnable **create-studio** app (the EntityScreen-style template). This is what
 * `npm create @svgrid/studio --from <schema>` writes instead of the seeded
 * Customers/Orders: a `schemas.ts` + `data.ts` + one route per entity + the nav
 * shell, all driven by the user's real Drizzle / Prisma schema.
 *
 * Pure string building (like `scaffold` / `scaffoldApp`), and node-safe - it
 * lives in the `./studio` subtree so `create-studio` gets it from the Node
 * build. It targets the template's conventions: `$lib/EntityScreen.svelte`,
 * `$lib/schemas`, `$lib/data`, and the `st-*` / `.home` CSS classes.
 */
import { resolveIdField, titleCase, type EntityField, type EntityFieldType, type EntitySchema, type ValidationRuleSpec } from '../schema.js'
import type { GeneratedFile } from './scaffold.js'
import type { EntityDataSource, RestSource, ShellConfig, SqlDialectKind } from './project.js'
import { generateValue } from './sample-data.js'

const pascal = (name: string): string =>
  titleCase(name).replace(/\s+/g, '')

const camel = (name: string): string => {
  const p = pascal(name)
  return p.charAt(0).toLowerCase() + p.slice(1)
}

/** Entity field type -> a TS property type for the generated row type. */
function tsType(type: EntityFieldType): string {
  if (type === 'number') return 'number'
  if (type === 'boolean') return 'boolean'
  if (type === 'json') return 'unknown'
  return 'string' // text / date / dateString / datetime / enum / relation
}

/** How many sample rows to seed per entity. */
const SEED_COUNT = 6

type Names = {
  type: string // PascalCase row type, e.g. `User`
  schemaVar: string // e.g. `userSchema`
  sourceVar: string // e.g. `userSource`
  label: string // display label
  route: string // route segment (= schema name)
  idPrefix: string // seed id prefix for nextId()
}

export function namesFor(schema: EntitySchema): Names {
  return {
    type: pascal(schema.name),
    schemaVar: `${camel(schema.name)}Schema`,
    sourceVar: `${camel(schema.name)}Source`,
    label: schema.label ?? titleCase(schema.name),
    route: schema.name,
    idPrefix: schema.name.charAt(0).toLowerCase() || 'r',
  }
}

/** Lookup variable name for a relation field, e.g. `postAuthorIdLookup`. */
export const lookupVar = (schema: EntitySchema, field: string) => `${camel(schema.name)}${pascal(field)}Lookup`

function rowType(schema: EntitySchema, derived: Set<string>): string {
  // Derived columns (relation labels) are filled at runtime, so they're optional.
  const lines = schema.fields.map((f) => `  ${f.field}${derived.has(f.field) ? '?' : ''}: ${tsType(f.type)}`)
  return `export type ${pascal(schema.name)} = {\n${lines.join('\n')}\n}`
}

/** Base (unwrapped) in-memory source variable, e.g. `userStore`. */
const storeVar = (schema: EntitySchema) => `${camel(schema.name)}Store`

type RelationInfo = { fkField: string; displayField: string; related: EntitySchema }

/** Relation fields of a schema whose target is present in the set. */
function relationInfos(schema: EntitySchema, byName: Map<string, EntitySchema>): RelationInfo[] {
  const existing = new Set(schema.fields.map((f) => f.field))
  const infos: RelationInfo[] = []
  for (const f of schema.fields) {
    if (f.type !== 'relation' || !f.relation) continue
    const related = byName.get(f.relation.entity)
    if (!related) continue
    // Show the label under a friendly name: `authorId` -> `author`, else `<fk>Label`.
    let display = /(_id|Id)$/.test(f.field) ? f.field.replace(/(_id|Id)$/, '') : `${f.field}Label`
    if (!display || existing.has(display)) display = `${f.field}Label`
    while (existing.has(display)) display += '_'
    existing.add(display)
    infos.push({ fkField: f.field, displayField: display, related })
  }
  return infos
}

/**
 * Rewrite a schema for a linked grid: hide each FK column from the grid (it
 * stays a lookup in the form) and append a read-only display column that shows
 * the related label (filled by `withRelationLabels` in data.ts).
 */
function prepareSchema(schema: EntitySchema, infos: RelationInfo[]): EntitySchema {
  const pkId = resolveIdField(schema)
  const fkFields = new Set(infos.map((i) => i.fkField))
  const fields: EntityField[] = schema.fields.map((f) => {
    let nf = f
    // The in-memory starter uses string ids, so the key is a text field.
    if (f.field === pkId && f.type !== 'text') nf = { ...nf, type: 'text' }
    if (fkFields.has(f.field)) {
      const prev = typeof nf.hidden === 'object' ? nf.hidden : {}
      nf = { ...nf, hidden: { ...prev, grid: true } }
    }
    return nf
  })
  for (const i of infos) {
    fields.push({ field: i.displayField, type: 'text', label: titleCase(i.displayField), readonly: true, hidden: { form: true } })
  }
  return { ...schema, fields }
}

type Prepared = { schema: EntitySchema; infos: RelationInfo[] }

/** N sample rows per entity, with valid (string) ids + foreign-key references. */
function generateSeed(entries: Prepared[]): Map<string, Array<Record<string, unknown>>> {
  const seed = new Map<string, Array<Record<string, unknown>>>()
  for (const { schema, infos } of entries) {
    const pkId = resolveIdField(schema)
    const idPrefix = namesFor(schema).idPrefix
    const relPrefix = new Map(infos.map((i) => [i.fkField, namesFor(i.related).idPrefix]))
    const display = new Set(infos.map((i) => i.displayField))
    const rows: Array<Record<string, unknown>> = []
    for (let i = 0; i < SEED_COUNT; i++) {
      const row: Record<string, unknown> = {}
      for (const f of schema.fields) {
        if (display.has(f.field)) continue // relation label, filled at runtime
        if (f.field === pkId) row[f.field] = `${idPrefix}${i + 1}`
        else if (f.type === 'relation') {
          const rp = relPrefix.get(f.field)
          row[f.field] = rp ? `${rp}${(i % SEED_COUNT) + 1}` : ''
        } else row[f.field] = generateValue(f, i)
      }
      rows.push(row)
    }
    seed.set(schema.name, rows)
  }
  return seed
}

/** Compile a no-code formula into a JS expression: bare field names -> `$.field`
 *  (where `$` is the row, typed loosely so arithmetic never trips svelte-check). */
function compileFormula(formula: string, fieldNames: string[]): string {
  const names = [...fieldNames].sort((a, b) => b.length - a.length).map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!names.length) return formula
  return formula.replace(new RegExp('\\b(' + names.join('|') + ')\\b', 'g'), '$.$1')
}
/** The condition a validation rule asserts must hold (fail -> attach its message). */
function compileValidation(r: ValidationRuleSpec): string {
  const lhs = `$[${JSON.stringify(r.field)}]`
  const num = (v: unknown) => (r.compareTo ? `Number($[${JSON.stringify(r.compareTo)}])` : Number(v))
  const str = (v: unknown) => (r.compareTo ? `String($[${JSON.stringify(r.compareTo)}])` : JSON.stringify(String(v ?? '')))
  switch (r.op) {
    case 'eq': return `String(${lhs}) === ${str(r.value)}`
    case 'ne': return `String(${lhs}) !== ${str(r.value)}`
    case 'lt': return `Number(${lhs}) < ${num(r.value)}`
    case 'lte': return `Number(${lhs}) <= ${num(r.value)}`
    case 'gt': return `Number(${lhs}) > ${num(r.value)}`
    case 'gte': return `Number(${lhs}) >= ${num(r.value)}`
    case 'required': return `${lhs} != null && ${lhs} !== ''`
    case 'maxLen': return `String(${lhs} ?? '').length <= ${Number(r.value)}`
    case 'minLen': return `String(${lhs} ?? '').length >= ${Number(r.value)}`
    default: return 'true'
  }
}

function schemasModule(entries: Prepared[]): GeneratedFile {
  const body = entries
    .map(({ schema: s, infos }) => {
      const n = namesFor(s)
      const derived = new Set(infos.map((i) => i.displayField))
      const fieldNames = s.fields.map((f) => f.field)
      // Strip the no-code specs from the emitted DATA literal; compile them below
      // into real `computed` / `hooks.validate` functions (JSON drops functions).
      const clean: EntitySchema = {
        ...s,
        fields: s.fields.map((f) => { const { formula: _f, ...rest } = f; return rest }),
      }
      delete (clean as { validations?: unknown }).validations
      let out = `${rowType(s, derived)}\n\nexport const ${n.schemaVar}: EntitySchema<${n.type}> = ${JSON.stringify(clean, null, 2)}`

      // Computed fields from formulas.
      const aug: string[] = []
      for (const f of s.fields) {
        if (!f.formula || f.computed) continue
        aug.push(`;(${n.schemaVar}.fields.find((f) => f.field === ${JSON.stringify(f.field)})!).computed = (row) => { const $ = row as Record<string, any>; return (${compileFormula(f.formula, fieldNames)}) }`)
      }
      // Cross-field validation rules -> hooks.validate.
      if (s.validations?.length) {
        const checks = s.validations.map((r) => `    if (!(${compileValidation(r)})) errors[${JSON.stringify(r.field)}] = ${JSON.stringify(r.message)}`).join('\n')
        aug.push(`${n.schemaVar}.hooks = {\n  ...${n.schemaVar}.hooks,\n  validate: (values) => {\n    const $ = values as Record<string, any>\n    const errors: Record<string, string> = {}\n${checks}\n    return Object.keys(errors).length ? errors : null\n  },\n}`)
      }
      if (aug.length) out += '\n\n' + aug.join('\n')
      return out
    })
    .join('\n\n')
  return {
    path: 'src/lib/schemas.ts',
    description: 'One EntitySchema per entity, generated from your schema. Add computed fields, hooks, or validators here.',
    contents: `/**
 * Generated from your schema by \`npm create @svgrid/studio --from\`. Each
 * EntitySchema drives the grid columns, the edit form, and validation. Add a
 * field here (and to its type) and it shows up in the grid and the form.
 */
import type { EntitySchema } from '@svgrid/enterprise'

${body}
`,
  }
}

// --- REST / SQL source-expression helpers ----------------------------------

const BACKTICK = String.fromCharCode(96)

/** Join a base URL and a path, tolerating leading/trailing slashes + empty base. */
function joinUrl(base: string, path: string): string {
  const b = (base ?? '').replace(/\/+$/, '')
  const p = (path ?? '').replace(/^\/+/, '')
  if (!b) return p
  if (!p) return b
  return `${b}/${p}`
}

/** `body` + `data.items` -> `body?.data?.items` (safe access into a response). */
function dottedAccess(root: string, dotted: string): string {
  return dotted.split('.').filter(Boolean).reduce((acc, key) => `${acc}?.${key}`, root)
}

/** The REST collection URL with static path params substituted (`{id}` -> value). */
function buildRestUrl(src: RestSource): string {
  let path = src.path
  for (const p of src.params) {
    if (p.location === 'path' && p.value) path = path.split(`{${p.name}}`).join(p.value)
  }
  return joinUrl(src.baseUrl, path)
}

/** A `SqlDialect` object literal for the dialect, or null to use adapter defaults. */
function sqlDialectExpr(dialect?: SqlDialectKind): string | null {
  switch (dialect) {
    case 'postgres':
    case 'supabase': return "{ placeholders: '$', ilike: true }"
    case 'mysql': return `{ quote: '${BACKTICK}', placeholders: '?' }`
    case 'mssql': return "{ placeholders: '@' }"
    case 'turso': return "{ placeholders: '?' }" // libSQL / SQLite positional args
    default: return null // sqlite / undefined -> adapter defaults
  }
}

const sq = (s: string): string => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

/** The `createRestDataSource(...)` call for one entity's REST binding. */
function restStoreExpr(src: RestSource, storeName: string, T: string, schemaVar: string): string {
  const opts: string[] = [`url: ${sq(buildRestUrl(src))}`, `schema: ${schemaVar}`]
  if (src.idField) opts.push(`idField: ${sq(src.idField)}`)
  const headers = src.params.filter((p) => p.location === 'header' && p.value !== undefined && p.value !== '')
  if (headers.length) opts.push(`headers: { ${headers.map((h) => `${sq(h.name)}: ${sq(h.value ?? '')}`).join(', ')} }`)
  const query = src.params.filter((p) => p.location === 'query' && p.value !== undefined && p.value !== '')
  if (query.length) opts.push(`query: { ${query.map((q) => `${sq(q.name)}: ${sq(q.value ?? '')}`).join(', ')} }`)
  if (src.rowsPath || src.totalPath) {
    const rowsExpr = src.rowsPath ? dottedAccess('body', src.rowsPath) : 'body'
    const totalExpr = src.totalPath ? dottedAccess('body', src.totalPath) : `(${rowsExpr})?.length`
    opts.push(`parse: (body: any) => ({ rows: ${rowsExpr} ?? [], rowCount: Number(${totalExpr} ?? 0) })`)
  }
  return `const ${storeName} = createRestDataSource<${T}>({ ${opts.join(', ')} })`
}

type DataModuleNeeds = {
  supabase: boolean
  supabaseUrl?: string
  supabaseKey?: string
  /** SQL-bound entities get a connected `+server.ts` API route each. */
  sqlRoutes: Array<{ schema: EntitySchema; table: string; dialect?: SqlDialectKind }>
  /** Embedded-Postgres (PGlite) entities: one shared client + a table each. */
  pglite?: boolean
  pgliteTables?: Array<{ schema: EntitySchema; table: string; seed?: Record<string, unknown>[] }>
}

/** Per-dialect server driver wiring for a connected `+server.ts` (reads `$env DATABASE_URL`). */
const SQL_DRIVERS: Record<'postgres' | 'mysql' | 'mssql' | 'sqlite' | 'turso', { dep: string; imports: string; setup: string; exec: string }> = {
  postgres: { dep: 'pg', imports: `import pg from 'pg'`, setup: `const pool = new pg.Pool({ connectionString: env.DATABASE_URL })`, exec: `const result = await pool.query(text, params)\n    return result.rows` },
  mysql: { dep: 'mysql2', imports: `import mysql from 'mysql2/promise'`, setup: `const pool = mysql.createPool(env.DATABASE_URL ?? '')`, exec: `const [rows] = await pool.query(text, params)\n    return rows as Record<string, unknown>[]` },
  mssql: { dep: 'mssql', imports: `import mssql from 'mssql'`, setup: `const poolPromise = mssql.connect(env.DATABASE_URL ?? '')`, exec: `const pool = await poolPromise\n    const request = pool.request()\n    params.forEach((p, i) => request.input('p' + (i + 1), p))\n    const result = await request.query(text)\n    return result.recordset as Record<string, unknown>[]` },
  sqlite: { dep: 'better-sqlite3', imports: `import Database from 'better-sqlite3'`, setup: `const db = new Database(env.DATABASE_URL ?? 'data.db')`, exec: `return db.prepare(text).all(...params) as Record<string, unknown>[]` },
  // Turso / libSQL: hosted SQLite over HTTP. DATABASE_URL is the libsql:// URL,
  // DATABASE_AUTH_TOKEN the database token. Runs on serverless + edge.
  turso: { dep: '@libsql/client', imports: `import { createClient } from '@libsql/client'`, setup: `const client = createClient({ url: env.DATABASE_URL ?? '', authToken: env.DATABASE_AUTH_TOKEN })`, exec: `const rs = await client.execute({ sql: text, args: params })\n    return rs.rows as unknown as Record<string, unknown>[]` },
}

/** A fully-connected SvelteKit API route for a SQL-bound entity. When RBAC is on,
 *  the route imports the shared access policy and rejects unauthorized writes -
 *  server-enforced, so a tampered client can't bypass it. When audit is on, every
 *  successful write is recorded. */
function sqlRouteFile(schema: EntitySchema, table: string, dialect?: SqlDialectKind, feat: { access?: boolean; audit?: boolean } = {}): GeneratedFile {
  const n = namesFor(schema)
  const key = (dialect === 'supabase' ? 'postgres' : (dialect ?? 'postgres')) as 'postgres' | 'mysql' | 'mssql' | 'sqlite' | 'turso'
  const driver = SQL_DRIVERS[key]
  const dialectLiteral = sqlDialectExpr(dialect)
  const accessImport = feat.access ? `\nimport { authorizeAction, getServerRole } from '$lib/access'` : ''
  const auditImport = feat.audit ? `\nimport { recordAudit } from '$lib/audit'` : ''
  // Every connected route validates writes against the schema server-side, and
  // (when enabled) authorizes them by role + records an audit entry.
  const opts = [`schema: ${n.schemaVar}`, `source`, `validate: true`]
  if (feat.access) opts.push(`// Server-enforced RBAC: the caller's role comes from the session (event.locals).\n  authorize: ({ action, event }) => authorizeAction(getServerRole(event), action)`)
  if (feat.audit) opts.push(`// Record every successful write to the audit trail.\n  audit: (e) => recordAudit({ entity: ${JSON.stringify(schema.name)}, action: e.action, recordId: e.id, values: e.values as Record<string, unknown> | undefined, actor: String(e.event.locals?.role ?? e.event.locals?.user ?? 'system') })`)
  const handlers = `export const { POST } = createKitHandlers({\n  ${opts.join(',\n  ')},\n})`
  return {
    path: `src/routes/api/${n.route}/+server.ts`,
    description: `Connected API route for ${n.label} (SQL via DATABASE_URL). Runs server-side.`,
    contents: `${driver.imports}
import { env } from '$env/dynamic/private'
import { createKitHandlers, createSqlDataSource } from '@svgrid/enterprise'
import { ${n.schemaVar}, type ${n.type} } from '$lib/schemas'${accessImport}${auditImport}

${driver.setup}

const source = createSqlDataSource<${n.type}>({
  schema: ${n.schemaVar},
  table: ${JSON.stringify(table)},${dialectLiteral ? `\n  dialect: ${dialectLiteral},` : ''}
  execute: async (text, params) => {
    ${driver.exec}
  },
})

${handlers}
`,
  }
}

/** Map an EntityField type to a Postgres column type for PGlite DDL. */
const PG_COL_TYPE: Record<string, string> = { number: 'double precision', boolean: 'boolean', date: 'date', datetime: 'timestamptz', json: 'jsonb' }
/** The shared PGlite client + table DDL + one-time seed, injected into data.ts. */
function pgliteBootstrap(tables: Array<{ schema: EntitySchema; table: string; seed?: Record<string, unknown>[] }>, seed: Map<string, Array<Record<string, unknown>>>): string {
  const ddls: string[] = []
  const seeds: string[] = []
  for (const { schema, table, seed: curated } of tables) {
    const pk = schema.idField ?? schema.fields.find((f) => f.primaryKey)?.field ?? 'id'
    const cols = schema.fields.map((f) => `"${f.field}" ${PG_COL_TYPE[f.type] ?? 'text'}${f.primaryKey || f.field === pk ? ' primary key' : ''}`).join(', ')
    ddls.push(`CREATE TABLE IF NOT EXISTS "${table}" (${cols});`)
    // Migrate schema additions: fields added after the DB was first created still
    // appear (CREATE TABLE IF NOT EXISTS is a no-op once the table exists).
    for (const f of schema.fields) {
      if (f.primaryKey || f.field === pk) continue
      ddls.push(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${f.field}" ${PG_COL_TYPE[f.type] ?? 'text'};`)
    }
    // Prefer rows imported/curated on the source (e.g. a CSV import), else the generator.
    const rows = curated ?? seed.get(schema.name) ?? []
    seeds.push(`  await _pgSeed(${JSON.stringify(table)}, ${JSON.stringify(rows)}, ${JSON.stringify(schema.fields.map((f) => f.field))})`)
  }
  return `// Embedded Postgres (PGlite), persisted in the browser (IndexedDB) - a real,
// persistent database with ZERO backend setup. To go to production, bind these
// entities to a hosted SQL source (same schema) instead.
const pg = new PGlite('idb://svgrid-studio')
const pgReady = (async () => {
  await pg.exec(\`
    ${ddls.join('\n    ')}
  \`)
${seeds.join('\n')}
})()
async function _pgSeed(table: string, rows: Record<string, unknown>[], cols: string[]): Promise<void> {
  if (!rows.length) return
  const existing = await pg.query(\`select count(*)::int as n from "\${table}"\`)
  if (((existing.rows[0] as { n?: number } | undefined)?.n ?? 0) > 0) return // already seeded
  for (const row of rows) {
    await pg.query(
      \`insert into "\${table}" (\${cols.map((c) => '"' + c + '"').join(', ')}) values (\${cols.map((_, i) => '$' + (i + 1)).join(', ')})\`,
      cols.map((c) => { const v = row[c]; return v != null && typeof v === 'object' ? JSON.stringify(v) : (v ?? null) }),
    )
  }
}
`
}

function dataModule(
  entries: Prepared[],
  seed: Map<string, Array<Record<string, unknown>>>,
  sources?: Record<string, EntityDataSource>,
): { file: GeneratedFile; needs: DataModuleNeeds } {
  const schemas = entries.map((e) => e.schema)
  // Each type gets its own `type` keyword - SvelteKit enables verbatimModuleSyntax.
  const typeImports = schemas.map((s) => `type ${pascal(s.name)}`).join(', ')
  const schemaImports = schemas.map((s) => namesFor(s).schemaVar).join(', ')
  const hasRelations = entries.some((e) => e.infos.length > 0)
  const entImports = new Set<string>()
  const needs: DataModuleNeeds = { supabase: false, sqlRoutes: [] }

  // 1. Base store per entity, branched on its bound data source (default: seeded
  //    in-memory, so the app runs with no backend).
  const stores = entries
    .map((e) => {
      const T = pascal(e.schema.name)
      const sv = namesFor(e.schema).schemaVar
      const store = storeVar(e.schema)
      const src = sources?.[e.schema.name] ?? { kind: 'memory' as const }
      switch (src.kind) {
        case 'rest':
          entImports.add('createRestDataSource')
          return restStoreExpr(src, store, T, sv)
        case 'sql':
          // SQL runs server-side: the client talks to a generated /api/<entity> route.
          entImports.add('createKitDataSource')
          needs.sqlRoutes.push({ schema: e.schema, table: src.table, dialect: src.dialect })
          return `const ${store} = createKitDataSource<${T}>({ endpoint: '/api/${namesFor(e.schema).route}' })`
        case 'supabase':
          entImports.add('createSupabaseDataSource')
          needs.supabase = true
          if (src.url && src.key && !needs.supabaseUrl) { needs.supabaseUrl = src.url; needs.supabaseKey = src.key }
          return `const ${store} = createSupabaseDataSource<${T}>({ client: supabaseClient, table: ${sq(src.table)}, schema: ${sv} })`
        case 'pglite': {
          // Embedded Postgres (PGlite) in the browser - real SQL, persisted to
          // IndexedDB, zero backend setup. Shares one `pg` client + `pgReady`.
          entImports.add('createSqlDataSource')
          needs.pglite = true
          needs.pgliteTables ??= []
          needs.pgliteTables.push({ schema: e.schema, table: src.table, seed: src.seed })
          return `const ${store} = createSqlDataSource<${T}>({ schema: ${sv}, table: ${sq(src.table)}, dialect: { placeholders: '$', ilike: true }, execute: async (text, params) => { await pgReady; return (await pg.query(text, params)).rows as Record<string, unknown>[] } })`
        }
        default: {
          entImports.add('createInMemoryDataSource')
          // Prefer curated seed on the source (a sample app), else the realistic generator.
          const curated = src.kind === 'memory' ? src.seed : undefined
          const rows = JSON.stringify(curated ?? seed.get(e.schema.name) ?? [])
          return `const ${store} = createInMemoryDataSource<${T}>(${rows}, ${sv})`
        }
      }
    })
    .join('\n')

  // 2. A searchable picker per relation, reading the related store.
  const lookups: string[] = []
  for (const { schema: s, infos } of entries) {
    for (const info of infos) {
      const rn = namesFor(info.related)
      lookups.push(
        `export const ${lookupVar(s, info.fkField)} = createRelationLookup<${rn.type}>({ source: ${storeVar(info.related)}, schema: ${rn.schemaVar}, labelField: '${(s.fields.find((f) => f.field === info.fkField)?.relation?.labelField) ?? 'name'}' })`,
      )
    }
  }
  if (hasRelations) { entImports.add('createRelationLookup'); entImports.add('withRelationLabels') }

  // 3. Exported sources: wrap with withRelationLabels so the grid shows labels.
  const sourceLines = entries
    .map(({ schema: s, infos }) => {
      const n = namesFor(s)
      if (infos.length === 0) return `export const ${n.sourceVar} = ${storeVar(s)}`
      const cfgs = infos.map((i) => `{ fk: '${i.fkField}', lookup: ${lookupVar(s, i.fkField)}, as: '${i.displayField}' }`).join(', ')
      return `export const ${n.sourceVar} = withRelationLabels(${storeVar(s)}, [${cfgs}])`
    })
    .join('\n')

  const connImportLine = needs.supabase ? `\nimport { supabaseClient } from './connections'` : ''
  const pgliteImportLine = needs.pglite ? `\nimport { PGlite } from '@electric-sql/pglite'` : ''
  const pgliteBoot = needs.pglite ? pgliteBootstrap(needs.pgliteTables!, seed) + '\n' : ''

  const file: GeneratedFile = {
    path: 'src/lib/data.ts',
    description: 'Data sources per entity (in-memory / REST / SQL / Supabase / PGlite) + a searchable lookup per relation.',
    contents: `/**
 * Data sources. Each entity binds to its own backend - in-memory (seeded), a
 * REST endpoint, a SQL table, Supabase, or embedded Postgres (PGlite). In-memory
 * + PGlite run with no setup; SQL / Supabase read their connection from \`./connections\`.
 */
import { ${[...entImports].join(', ')} } from '@svgrid/enterprise'
import { ${schemaImports}, ${typeImports} } from './schemas'${connImportLine}${pgliteImportLine}

${pgliteBoot}${stores}
${lookups.length ? `\n// Searchable pickers for relation (foreign-key) fields.\n${lookups.join('\n')}\n` : ''}
// Grids show the related label (not the raw id) via withRelationLabels.
${sourceLines}

// New-row ids continue after the seeded rows.
let seq = ${SEED_COUNT}
export const nextId = (prefix: string) => \`\${prefix}\${++seq}\`
`,
  }
  return { file, needs }
}

/** The connection stubs for SQL / Supabase sources - the one manual wiring step. */
function connectionsModule(needs: DataModuleNeeds): GeneratedFile {
  const realSupabase = !!(needs.supabaseUrl && needs.supabaseKey)
  const valueImport = realSupabase ? `import { createClient } from '@supabase/supabase-js'\n` : ''
  const body = realSupabase
    ? `/**
 * Supabase client. The anon key is public (browser-safe) - access is protected
 * by your Row Level Security policies. Requires \`@supabase/supabase-js\`
 * (\`npm i @supabase/supabase-js\`).
 */
export const supabaseClient = createClient(${sq(needs.supabaseUrl!)}, ${sq(needs.supabaseKey!)}) as unknown as SupabaseClientLike`
    : `/**
 * TODO: connect Supabase. Add your project URL + anon key in the Studio designer,
 * or replace this null stub with a real client:
 * \`import { createClient } from '@supabase/supabase-js'; export const supabaseClient = createClient(url, anonKey)\`.
 */
export const supabaseClient = null as unknown as SupabaseClientLike`
  return {
    path: 'src/lib/connections.ts',
    description: 'Supabase client for Supabase-bound entities.',
    contents: `${valueImport}import type { SupabaseClientLike } from '@svgrid/enterprise'\n\n${body}\n`,
  }
}

/**
 * A CRUD screen page (grid + form) for a prepared entity schema. `route` and
 * `title` default to the entity's, but the Studio designer overrides them so a
 * project can have custom routes / titles / multiple screens per entity.
 */
export function entityScreenPage(schema: EntitySchema, route?: string, title?: string): GeneratedFile {
  const n = namesFor(schema)
  const r = route ?? n.route
  const t = title ?? n.label
  const relationFields = schema.fields.filter((f) => f.type === 'relation' && f.relation)
  const lookupImports = relationFields.map((f) => lookupVar(schema, f.field))
  const dataImports = [n.sourceVar, ...lookupImports, 'nextId'].join(', ')
  const lookupsProp = relationFields.length
    ? `\n  lookups={{ ${relationFields.map((f) => `${f.field}: ${lookupVar(schema, f.field)}`).join(', ')} }}`
    : ''

  return {
    path: `src/routes/${r}/+page.svelte`,
    description: `CRUD screen for ${t}.`,
    contents: `<script lang="ts">
  import EntityScreen from '$lib/EntityScreen.svelte'
  import { ${n.schemaVar} } from '$lib/schemas'
  import { ${dataImports} } from '$lib/data'
</script>

<h1 class="st__title">${t}</h1>
<EntityScreen schema={${n.schemaVar}} source={${n.sourceVar}}${lookupsProp} newId={() => nextId('${n.idPrefix}')} />
`,
  }
}

export type NavItem = { href: string; label: string; id?: string }

export function layoutFile(nav: NavItem[], opts: { accent?: string; shell?: ShellConfig; title?: string; themeVars?: Record<string, string>; dark?: boolean; access?: boolean; i18n?: boolean } = {}): GeneratedFile {
  const links = [{ href: '/', label: 'Home' }, ...nav]
  const shell = opts.shell ?? {}
  const style: 'sidebar' | 'top-nav' = shell.style ?? 'sidebar'
  const brand = (shell.brand ?? '').trim() || opts.title || 'My Studio App'
  const footer = shell.footer === undefined ? 'Built with SvGrid Studio' : shell.footer
  const right = style === 'sidebar' && shell.navPosition === 'right'
  // Emit the full theme token bundle (+ color-scheme for dark themes) so the
  // generated app matches the look-and-feel picked in the designer.
  const vars = { ...(opts.themeVars ?? {}) }
  if (opts.accent) vars['--sg-accent'] = opts.accent
  const varLines = Object.entries(vars).map(([k, v]) => `${k}: ${v};`).join(' ')
  const rootRule = [varLines, opts.dark ? 'color-scheme: dark;' : ''].filter(Boolean).join(' ')
  const themeHead = rootRule ? `\n<svelte:head><style>:root { ${rootRule} }</style></svelte:head>\n` : ''

  // i18n: translate nav labels via `nav.<id>` keys (Home has no id -> literal).
  const navLabel = opts.i18n ? `{item.id ? $t('nav.' + item.id, item.label) : item.label}` : '{item.label}'
  const anchor = `<a class="sv-app__link" class:is-active={$page.url.pathname === item.href} href={item.href}>${navLabel}</a>`
  // When RBAC is on, hide nav links the current role can't open.
  const linkGate = opts.access
    ? `{#if !item.id || canScreen($currentRole, item.id)}${anchor}{/if}`
    : anchor
  const localeSwitcher = opts.i18n
    ? `\n      <select class="sv-app__locale" aria-label="Language" onchange={(e) => currentLocale.set(e.currentTarget.value as typeof $currentLocale)}>
        {#each locales as loc (loc)}<option value={loc} selected={loc === $currentLocale}>{loc}</option>{/each}
      </select>`
    : ''
  // Clicking any nav link closes the mobile drawer.
  const linksMarkup = `<nav class="sv-app__links" onclick={() => (navOpen = false)}>
      {#each nav as item (item.href)}
        ${linkGate}
      {/each}
    </nav>${localeSwitcher}`
  const footMarkup = footer ? `\n      <span class="sv-app__foot">{footer}</span>` : ''
  const footConst = footer ? `\n  const footer = ${JSON.stringify(footer)}` : ''
  // Sidebar-only: a collapsible sidebar that docks on wide screens and becomes an
  // off-canvas drawer when collapsed or on tablet/phone (<= 1024px). The collapse
  // choice persists; tablet/phone start collapsed.
  const sideState = style === 'top-nav' ? '' : `
  let collapsed = $state(false)
  let narrow = $state(false)
  const drawer = $derived(collapsed || narrow)
  function toggleNav() { collapsed = !collapsed; try { localStorage.setItem('svapp:nav', collapsed ? 'c' : 'e') } catch (_) { /* storage blocked */ } }
  $effect(() => {
    // Tablet / phone (<= 1024px) collapse to a drawer by default.
    const mq = window.matchMedia('(max-width: 1024px)')
    const sync = () => (narrow = mq.matches)
    sync()
    try { const s = localStorage.getItem('svapp:nav'); if (s) collapsed = s === 'c' } catch (_) { /* storage blocked */ }
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  })`

  // Brand: a company logo image (data URL / URL) when set, else the app name.
  const logoConst = shell.logo ? `\n  const logo = ${JSON.stringify(shell.logo)}` : ''
  const brandInner = shell.logo
    ? `<img class="sv-app__logo" src={logo} alt={brand} />`
    : `<span class="sv-app__brandtext">{brand}</span>`
  const brandLink = `<a class="sv-app__brand" href="/">${brandInner}</a>`
  // Collapsed bar (tablet / phone, or a collapsed desktop sidebar): a hamburger +
  // brand. The nav slides in as an off-canvas drawer. On desktop the "dock" button
  // pins the sidebar back open.
  const mobileBar = `<header class="sv-app__mobilebar">
    <button type="button" class="sv-app__burger" aria-label="Toggle navigation" aria-expanded={navOpen} onclick={() => (navOpen = !navOpen)}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
    </button>
    ${brandLink}
    {#if !narrow}<button type="button" class="sv-app__dock" aria-label="Dock sidebar" title="Dock sidebar" onclick={toggleNav}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
    </button>{/if}
  </header>
  {#if navOpen}<button type="button" class="sv-app__backdrop" aria-label="Close navigation" onclick={() => (navOpen = false)}></button>{/if}`

  const body = style === 'top-nav'
    ? `<div class="sv-app sv-app--top">
  <header class="sv-app__bar">
    ${brandLink}
    ${linksMarkup}
  </header>
  <main class="sv-app__main">
    {@render children()}
  </main>${footer ? `\n  <footer class="sv-app__footbar">{footer}</footer>` : ''}
</div>`
    : `<div class="sv-app sv-app--side${right ? ' sv-app--right' : ''}" class:is-drawer={drawer} class:is-navopen={navOpen}>
  ${mobileBar}
  <aside class="sv-app__side">
    <div class="sv-app__sidehead">
      ${brandLink}
      <button type="button" class="sv-app__collapse" aria-label="Collapse sidebar" title="Collapse sidebar" onclick={toggleNav}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
      </button>
    </div>
    ${linksMarkup}${footMarkup}
  </aside>
  <main class="sv-app__main">
    {@render children()}
  </main>
</div>`

  const styles = style === 'top-nav'
    ? `  .sv-app--top { display: flex; flex-direction: column; min-height: 100vh; }
  .sv-app__bar { display: flex; align-items: center; gap: 20px; padding: 12px 22px; border-bottom: 1px solid color-mix(in srgb, var(--sg-fg, #0f172a) 16%, var(--sg-border, #e6e8ec)); background: var(--sg-header-bg, #f8fafc); }
  .sv-app__links { display: flex; flex-direction: row; gap: 4px; flex-wrap: wrap; }
  .sv-app__footbar { padding: 12px 22px; border-top: 1px solid var(--sg-border, #e6e8ec); color: var(--sg-muted, #94a3b8); font-size: 13px; }
  /* Mobile: the bar stacks and its links scroll horizontally. */
  @media (max-width: 640px) {
    .sv-app__bar { flex-direction: column; align-items: stretch; gap: 10px; padding: 10px 14px; }
    .sv-app__links { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 2px; -webkit-overflow-scrolling: touch; }
    .sv-app__link { white-space: nowrap; }
  }`
    : `  .sv-app--side { display: grid; grid-template-columns: 240px minmax(0, 1fr); min-height: 100vh; }
  .sv-app--side.sv-app--right { grid-template-columns: minmax(0, 1fr) 240px; }
  .sv-app--right .sv-app__side { order: 2; border-right: 0; border-left: 1px solid color-mix(in srgb, var(--sg-fg, #0f172a) 16%, var(--sg-border, #e6e8ec)); }
  .sv-app__side { display: flex; flex-direction: column; gap: 4px; padding: 20px 14px; border-right: 1px solid color-mix(in srgb, var(--sg-fg, #0f172a) 16%, var(--sg-border, #e6e8ec)); background: var(--sg-header-bg, #f8fafc); }
  .sv-app__sidehead { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
  .sv-app__collapse, .sv-app__dock { display: inline-flex; padding: 5px; border: 0; border-radius: 8px; background: transparent; color: var(--sg-muted, #64748b); cursor: pointer; }
  .sv-app__collapse:hover, .sv-app__dock:hover { background: color-mix(in srgb, var(--sg-fg, #0f172a) 8%, transparent); color: var(--sg-fg, #0f172a); }
  .sv-app__mobilebar { display: none; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid color-mix(in srgb, var(--sg-fg, #0f172a) 16%, var(--sg-border, #e6e8ec)); background: var(--sg-header-bg, #f8fafc); }
  .sv-app__mobilebar .sv-app__dock { margin-left: auto; }
  .sv-app__burger { display: inline-flex; padding: 6px; border: 0; border-radius: 8px; background: transparent; color: var(--sg-fg, #0f172a); cursor: pointer; }
  .sv-app__backdrop { position: fixed; inset: 0; z-index: 55; border: 0; background: rgba(15, 23, 42, 0.4); cursor: pointer; }
  .sv-app__links { display: flex; flex-direction: column; gap: 2px; }
  .sv-app__foot { margin-top: auto; padding-top: 14px; color: var(--sg-muted, #94a3b8); font-size: 12px; }
  /* Drawer mode: tablet / phone (<= 1024px) or a user-collapsed desktop sidebar.
     Driven by the .is-drawer class (JS matchMedia + the collapse toggle), so the
     sidebar docks on wide screens and slides in as an off-canvas drawer otherwise. */
  .sv-app--side.is-drawer, .sv-app--side.is-drawer.sv-app--right { display: block; }
  .sv-app--side.is-drawer .sv-app__mobilebar { display: flex; }
  .sv-app--side.is-drawer .sv-app__side {
    position: fixed; top: 0; bottom: 0; left: 0; z-index: 60; width: 264px; max-width: 82vw;
    transform: translateX(-100%); transition: transform 0.24s ease; box-shadow: 0 0 40px rgba(15, 23, 42, 0.28);
  }
  .sv-app--side.is-drawer.sv-app--right .sv-app__side { left: auto; right: 0; transform: translateX(100%); border-left: 0; }
  .sv-app--side.is-drawer.is-navopen .sv-app__side { transform: translateX(0); }
  .sv-app--side.is-drawer .sv-app__sidehead .sv-app__brand { display: none; } /* brand already in the top bar */
  .sv-app--side.is-drawer .sv-app__collapse { display: none; } /* dock lives in the top bar when drawered */`

  return {
    path: 'src/routes/+layout.svelte',
    description: `App shell (${style}): nav linking every screen.`,
    contents: `<script lang="ts">
  import '../app.css'
  import { page } from '$app/stores'${opts.access ? `\n  import { currentRole, canScreen } from '$lib/access'` : ''}${opts.i18n ? `\n  import { t, currentLocale, locales } from '$lib/i18n'` : ''}

  let { children } = $props()
  const nav = ${JSON.stringify(links)}
  const brand = ${JSON.stringify(brand)}${footConst}${logoConst}
  let navOpen = $state(false)
  // Close the mobile drawer whenever the route changes.
  $effect(() => { void $page.url.pathname; navOpen = false })${sideState}
</script>
${themeHead}

${body}

<style>
${styles}
  .sv-app__brand { display: inline-flex; align-items: center; font-weight: 700; font-size: 15px; color: var(--sg-fg, #0f172a); text-decoration: none; padding: 4px 8px; }
  .sv-app__logo { max-height: 34px; max-width: 160px; width: auto; object-fit: contain; display: block; }
  .sv-app__link { padding: 7px 10px; border-radius: 8px; color: var(--sg-fg, #334155); text-decoration: none; font-size: 14px; }
  .sv-app__link:hover { background: color-mix(in srgb, var(--sg-fg, #0f172a) 6%, transparent); }
  .sv-app__link.is-active { background: color-mix(in srgb, var(--sg-accent, #4f46e5) 14%, transparent); color: var(--sg-accent, #4f46e5); font-weight: 600; }
  .sv-app__main { padding: 24px 28px; min-width: 0; }
  .sv-app__locale { margin-top: 10px; padding: 5px 8px; font: inherit; font-size: 12.5px; color: var(--sg-fg, #0f172a); background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e6e8ec); border-radius: 8px; }
  /* Mobile bar + drawer chrome (hidden on desktop; media queries above switch it on) */
  .sv-app__mobilebar { display: none; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--sg-border, #e6e8ec); background: var(--sg-header-bg, #f8fafc); position: sticky; top: 0; z-index: 50; }
  .sv-app__burger { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; padding: 0; border: 1px solid var(--sg-border, #e6e8ec); border-radius: 9px; background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); cursor: pointer; }
  .sv-app__backdrop { position: fixed; inset: 0; z-index: 55; border: 0; padding: 0; background: rgba(15, 23, 42, 0.42); cursor: pointer; }
  @media (max-width: 860px) { .sv-app__main { padding: 18px 16px; } }
  @media (max-width: 640px) { .sv-app__main { padding: 14px 12px; } }
</style>
`,
  }
}

export function homeFile(nav: NavItem[]): GeneratedFile {
  return {
    path: 'src/routes/+page.svelte',
    description: 'Home page: a card per entity.',
    contents: `<script lang="ts">
  const entities = ${JSON.stringify(nav)}
</script>

<h1 class="st__title">Welcome to your data app</h1>
<p class="st__sub">
  Generated from your schema with SvGrid Studio. Each screen is driven by one
  <code>EntitySchema</code>. It runs on empty in-memory data - add rows, or point
  an entity at a real database in <code>src/lib/data.ts</code>.
</p>

<div class="home">
  {#each entities as e (e.href)}
    <a class="home__card" href={e.href}>
      <strong>{e.label}</strong>
      <span>Browse and edit {e.label} records.</span>
    </a>
  {/each}
</div>
`,
  }
}

/**
 * Prepare entities for emission: resolve relations, rewrite each schema so the
 * grid shows a related label column instead of the raw FK, and build the seed.
 * Shared by `emitStudioApp` and the Studio designer's `emitStudioProject`.
 */
export function prepareEntities(schemas: EntitySchema[]): { entries: Prepared[]; seed: Map<string, Array<Record<string, unknown>>> } {
  for (const s of schemas) resolveIdField(s) // fail fast on an unresolvable key
  const byName = new Map(schemas.map((s) => [s.name, s]))
  const entries: Prepared[] = schemas.map((s) => {
    const infos = relationInfos(s, byName)
    return { schema: prepareSchema(s, infos), infos }
  })
  return { entries, seed: generateSeed(entries) }
}

/** Emit the shared entity modules: `src/lib/schemas.ts` + `src/lib/data.ts` (+ `connections.ts`). */
export function emitEntityModules(
  schemas: EntitySchema[],
  opts: { sources?: Record<string, EntityDataSource>; accessEnabled?: boolean; auditEnabled?: boolean } = {},
): { files: GeneratedFile[]; prepared: EntitySchema[] } {
  const { entries, seed } = prepareEntities(schemas)
  const { file: data, needs } = dataModule(entries, seed, opts.sources)
  const files: GeneratedFile[] = [schemasModule(entries), data]
  if (needs.supabase) files.push(connectionsModule(needs))
  for (const r of needs.sqlRoutes) files.push(sqlRouteFile(r.schema, r.table, r.dialect, { access: opts.accessEnabled, audit: opts.auditEnabled }))
  return { files, prepared: entries.map((e) => e.schema) }
}

/**
 * Emit every source file of a create-studio app for the given entities:
 * `schemas.ts`, `data.ts`, one `+page.svelte` per entity, and the nav shell.
 * The template supplies the rest (EntityScreen, theme, configs).
 */
export function emitStudioApp(schemas: EntitySchema[]): GeneratedFile[] {
  if (schemas.length === 0) throw new Error('emitStudioApp: no schemas to emit')
  const { files, prepared } = emitEntityModules(schemas)
  const nav: NavItem[] = prepared.map((s) => {
    const n = namesFor(s)
    return { href: `/${n.route}`, label: n.label }
  })
  return [...files, ...prepared.map((s) => entityScreenPage(s)), layoutFile(nav), homeFile(nav)]
}
