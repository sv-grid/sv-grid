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
}

/** Per-dialect server driver wiring for a connected `+server.ts` (reads `$env DATABASE_URL`). */
const SQL_DRIVERS: Record<'postgres' | 'mysql' | 'mssql' | 'sqlite', { dep: string; imports: string; setup: string; exec: string }> = {
  postgres: { dep: 'pg', imports: `import pg from 'pg'`, setup: `const pool = new pg.Pool({ connectionString: env.DATABASE_URL })`, exec: `const result = await pool.query(text, params)\n    return result.rows` },
  mysql: { dep: 'mysql2', imports: `import mysql from 'mysql2/promise'`, setup: `const pool = mysql.createPool(env.DATABASE_URL ?? '')`, exec: `const [rows] = await pool.query(text, params)\n    return rows as Record<string, unknown>[]` },
  mssql: { dep: 'mssql', imports: `import mssql from 'mssql'`, setup: `const poolPromise = mssql.connect(env.DATABASE_URL ?? '')`, exec: `const pool = await poolPromise\n    const request = pool.request()\n    params.forEach((p, i) => request.input('p' + (i + 1), p))\n    const result = await request.query(text)\n    return result.recordset as Record<string, unknown>[]` },
  sqlite: { dep: 'better-sqlite3', imports: `import Database from 'better-sqlite3'`, setup: `const db = new Database(env.DATABASE_URL ?? 'data.db')`, exec: `return db.prepare(text).all(...params) as Record<string, unknown>[]` },
}

/** A fully-connected SvelteKit API route for a SQL-bound entity. When RBAC is on,
 *  the route imports the shared access policy and rejects unauthorized writes -
 *  server-enforced, so a tampered client can't bypass it. When audit is on, every
 *  successful write is recorded. */
function sqlRouteFile(schema: EntitySchema, table: string, dialect?: SqlDialectKind, feat: { access?: boolean; audit?: boolean } = {}): GeneratedFile {
  const n = namesFor(schema)
  const key = (dialect === 'supabase' ? 'postgres' : (dialect ?? 'postgres')) as 'postgres' | 'mysql' | 'mssql' | 'sqlite'
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

  const file: GeneratedFile = {
    path: 'src/lib/data.ts',
    description: 'Data sources per entity (in-memory / REST / SQL / Supabase) + a searchable lookup per relation.',
    contents: `/**
 * Data sources. Each entity binds to its own backend - in-memory (seeded), a
 * REST endpoint, a SQL table, or Supabase. In-memory entities run with no setup;
 * SQL / Supabase entities read their connection from \`./connections\`.
 */
import { ${[...entImports].join(', ')} } from '@svgrid/enterprise'
import { ${schemaImports}, ${typeImports} } from './schemas'${connImportLine}

${stores}
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
    ? `\n    <select class="sv-app__locale" aria-label="Language" onchange={(e) => currentLocale.set(e.currentTarget.value as typeof $currentLocale)}>
      {#each locales as loc (loc)}<option value={loc} selected={loc === $currentLocale}>{loc}</option>{/each}
    </select>`
    : ''
  const linksMarkup = `<nav class="sv-app__links">
      {#each nav as item (item.href)}
        ${linkGate}
      {/each}
    </nav>${localeSwitcher}`
  const footMarkup = footer ? `\n    <span class="sv-app__foot">{footer}</span>` : ''
  const footConst = footer ? `\n  const footer = ${JSON.stringify(footer)}` : ''

  const body = style === 'top-nav'
    ? `<div class="sv-app sv-app--top">
  <header class="sv-app__bar">
    <a class="sv-app__brand" href="/">{brand}</a>
    ${linksMarkup}
  </header>
  <main class="sv-app__main">
    {@render children()}
  </main>${footer ? `\n  <footer class="sv-app__footbar">{footer}</footer>` : ''}
</div>`
    : `<div class="sv-app sv-app--side${right ? ' sv-app--right' : ''}">
  <aside class="sv-app__side">
    <a class="sv-app__brand" href="/">{brand}</a>
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
  .sv-app__footbar { padding: 12px 22px; border-top: 1px solid var(--sg-border, #e6e8ec); color: var(--sg-muted, #94a3b8); font-size: 13px; }`
    : `  .sv-app--side { display: grid; grid-template-columns: 240px minmax(0, 1fr); min-height: 100vh; }
  .sv-app--side.sv-app--right { grid-template-columns: minmax(0, 1fr) 240px; }
  .sv-app--right .sv-app__side { order: 2; border-right: 0; border-left: 1px solid color-mix(in srgb, var(--sg-fg, #0f172a) 16%, var(--sg-border, #e6e8ec)); }
  .sv-app__side { display: flex; flex-direction: column; gap: 4px; padding: 20px 14px; border-right: 1px solid color-mix(in srgb, var(--sg-fg, #0f172a) 16%, var(--sg-border, #e6e8ec)); background: var(--sg-header-bg, #f8fafc); }
  .sv-app__links { display: flex; flex-direction: column; gap: 2px; }
  .sv-app__foot { margin-top: auto; padding-top: 14px; color: var(--sg-muted, #94a3b8); font-size: 12px; }`

  return {
    path: 'src/routes/+layout.svelte',
    description: `App shell (${style}): nav linking every screen.`,
    contents: `<script lang="ts">
  import '../app.css'
  import { page } from '$app/stores'${opts.access ? `\n  import { currentRole, canScreen } from '$lib/access'` : ''}${opts.i18n ? `\n  import { t, currentLocale, locales } from '$lib/i18n'` : ''}

  let { children } = $props()
  const nav = ${JSON.stringify(links)}
  const brand = ${JSON.stringify(brand)}${footConst}
</script>
${themeHead}

${body}

<style>
${styles}
  .sv-app__brand { font-weight: 700; font-size: 15px; color: var(--sg-fg, #0f172a); text-decoration: none; padding: 4px 8px; }
  .sv-app__link { padding: 7px 10px; border-radius: 8px; color: var(--sg-fg, #334155); text-decoration: none; font-size: 14px; }
  .sv-app__link:hover { background: color-mix(in srgb, var(--sg-fg, #0f172a) 6%, transparent); }
  .sv-app__link.is-active { background: color-mix(in srgb, var(--sg-accent, #4f46e5) 14%, transparent); color: var(--sg-accent, #4f46e5); font-weight: 600; }
  .sv-app__main { padding: 24px 28px; min-width: 0; }
  .sv-app__locale { margin-top: 10px; padding: 5px 8px; font: inherit; font-size: 12.5px; color: var(--sg-fg, #0f172a); background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e6e8ec); border-radius: 8px; }
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
