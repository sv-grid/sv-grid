/**
 * Introspection - turn a data source into an `EntitySchema`. Entry points:
 *
 *   - `introspectJson(name, rows)` infers fields + types from sample JSON rows.
 *   - `introspectDrizzle(source, table?)` parses one Drizzle table (the string
 *     contents of a `schema.ts`) into an `EntitySchema`, relations and enums
 *     included.
 *   - `introspectDrizzleAll(source)` parses **every** table in the file into a
 *     linked set of schemas (foreign keys become relation fields, so the whole
 *     app scaffolds with working lookups).
 *
 * All are pure and best-effort: the Studio generator (and the AI host) treats
 * the result as a draft the user can refine in `SvSchemaDesigner` before
 * scaffolding code. Nothing imports Drizzle - the reader is a text parse, so
 * there's no dependency and no code execution.
 */
import { linkRelationLabels, type EntityField, type EntityFieldType, type EntitySchema } from '../schema.js'
import { buildEntitySchema, type IntrospectedColumn } from '../sources/schema-from-columns.js'

/** Infer an entity field type from a runtime JSON value. */
export function inferType(value: unknown): EntityFieldType {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (value !== null && typeof value === 'object') return 'json'
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return 'datetime'
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'dateString'
    return 'text'
  }
  return 'text'
}

/** Build a schema from sample rows: union of keys, type from the first non-null value. */
export function introspectJson(
  name: string,
  rows: ReadonlyArray<Record<string, unknown>>,
): EntitySchema {
  const keys: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) {
        seen.add(k)
        keys.push(k)
      }
    }
  }

  const fields: EntityField[] = keys.map((k) => {
    let type: EntityFieldType = 'text'
    for (const row of rows) {
      const v = row[k]
      if (v != null) {
        type = inferType(v)
        break
      }
    }
    const field: EntityField = { field: k, type }
    if (k === 'id') {
      field.primaryKey = true
      field.readonly = true
    }
    return field
  })

  return { name, fields }
}

/** Drizzle column builder -> entity field type. */
const DRIZZLE_TYPE_MAP: Record<string, EntityFieldType> = {
  serial: 'number',
  bigserial: 'number',
  smallserial: 'number',
  integer: 'number',
  int: 'number',
  tinyint: 'number',
  smallint: 'number',
  bigint: 'number',
  numeric: 'number',
  decimal: 'number',
  real: 'number',
  double: 'number',
  doublePrecision: 'number',
  float: 'number',
  boolean: 'boolean',
  text: 'text',
  varchar: 'text',
  char: 'text',
  uuid: 'text',
  timestamp: 'datetime',
  datetime: 'datetime',
  date: 'dateString',
  time: 'text',
  json: 'json',
  jsonb: 'json',
}

/** A Drizzle table as found in source: variable name, SQL name, columns body, and extra-config text. */
type DrizzleTable = { varName: string; name: string; body: string; extras: string }

/** Whole-file context needed to resolve a column: table vars and enum values. */
type DrizzleContext = {
  /** Table variable (`export const users = ...`) -> SQL table name. */
  varToTable: Map<string, string>
  /** Enum variable (`pgEnum('role', [...])`) -> allowed values. */
  enums: Map<string, string[]>
}

/** Read string literals out of a `['a', 'b']`-style array fragment. */
function stringLiterals(fragment: string): string[] {
  const out: string[] = []
  const re = /['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(fragment)) !== null) out.push(m[1]!)
  return out
}

/** Find the balanced `{ ... }` body starting at (or after) `from`. Returns body + end index. */
function balancedObject(source: string, from: number): { body: string; end: number } {
  const open = source.indexOf('{', from)
  if (open === -1) return { body: '', end: from }
  let depth = 0
  for (let i = open; i < source.length; i++) {
    const ch = source[i]
    if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) return { body: source.slice(open + 1, i), end: i }
  }
  return { body: '', end: source.length }
}

/** Split an object body at top-level commas, ignoring commas nested in (), [], {}, or strings. */
function splitTopLevel(body: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  let str: string | null = null
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (str) {
      if (ch === str && body[i - 1] !== '\\') str = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') str = ch
    else if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    else if (ch === ',' && depth === 0) {
      parts.push(body.slice(start, i))
      start = i + 1
    }
  }
  const last = body.slice(start)
  if (last.trim()) parts.push(last)
  return parts
}

/** Locate every `const <var> = xxxTable('name', { ... })` in the source. */
function findTables(source: string): DrizzleTable[] {
  const tables: DrizzleTable[] = []
  const re = /const\s+(\w+)\s*=\s*(\w*[Tt]able)\(\s*['"]([^'"]+)['"]\s*,/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    const { body, end } = balancedObject(source, m.index + m[0].length)
    if (body) {
      // Capture the table's second argument (indexes, composite primary key)
      // by scanning to the matching close paren of the `xxxTable(` call.
      let depth = 1
      let str: string | null = null
      let i = end + 1
      for (; i < source.length; i++) {
        const ch = source[i]
        if (str) {
          if (ch === str && source[i - 1] !== '\\') str = null
          continue
        }
        if (ch === "'" || ch === '"' || ch === '`') str = ch
        else if (ch === '(') depth++
        else if (ch === ')' && --depth === 0) break
      }
      tables.push({ varName: m[1]!, name: m[3]!, body, extras: source.slice(end + 1, i) })
      re.lastIndex = i
    }
  }
  return tables
}

/** Field names of a Drizzle composite key (`primaryKey({ columns: [t.a, t.b] })`), else empty. */
function drizzleComposite(extras: string): string[] {
  const m = extras.match(/primaryKey\(([\s\S]*?)\)/)
  if (!m) return []
  return [...m[1]!.matchAll(/\.(\w+)/g)].map((x) => x[1]!)
}

/** Build the whole-file context (table vars + enum declarations) once. */
function scanContext(source: string, tables: DrizzleTable[]): DrizzleContext {
  const varToTable = new Map(tables.map((t) => [t.varName, t.name]))
  const enums = new Map<string, string[]>()
  // const roleEnum = pgEnum('role', ['admin', 'user'])   (also mysqlEnum / singlestoreEnum)
  const re = /const\s+(\w+)\s*=\s*(?:pg|mysql|singlestore)Enum\(\s*['"][^'"]+['"]\s*,\s*\[([^\]]*)\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) enums.set(m[1]!, stringLiterals(m[2]!))
  return { varToTable, enums }
}

/** Parse one column entry (`key: builder(args)<modifiers>`) into a neutral column. */
function parseColumn(entry: string, ctx: DrizzleContext): IntrospectedColumn | null {
  const head = entry.match(/^\s*["']?(\w+)["']?\s*:\s*(\w+)\s*\(/)
  if (!head) return null
  const name = head[1]!
  const builder = head[2]!
  // Balanced args of the builder call, then the trailing modifier chain.
  const argStart = head.index! + head[0].length - 1
  let depth = 0
  let argEnd = argStart
  for (let i = argStart; i < entry.length; i++) {
    const ch = entry[i]
    if (ch === '(') depth++
    else if (ch === ')' && --depth === 0) {
      argEnd = i
      break
    }
  }
  const args = entry.slice(argStart + 1, argEnd)
  const modifiers = entry.slice(argEnd + 1)

  const col: IntrospectedColumn = { name }

  // Capture the DB column name (the builder's first string arg). When it differs
  // from the property key, record it so SQL adapters use the real column.
  const dbColumn = stringLiterals(args)[0]
  if (dbColumn && dbColumn !== name) col.dbColumn = dbColumn

  // Enum: a `pgEnum` builder var, an inline `mysqlEnum('col', ['a','b'])`, or a
  // `{ enum: ['a','b'] }` option on a text/varchar column.
  const inlineEnum = args.match(/enum\s*:\s*\[([^\]]*)\]/)
  if (ctx.enums.has(builder)) col.enumValues = ctx.enums.get(builder)
  else if (inlineEnum) col.enumValues = stringLiterals(inlineEnum[1]!)
  else if (/enum$/i.test(builder)) {
    const arr = args.match(/\[([^\]]*)\]/)
    if (arr) col.enumValues = stringLiterals(arr[1]!)
  }
  if (!col.enumValues) col.type = DRIZZLE_TYPE_MAP[builder] ?? 'text'

  if (/\.primaryKey\s*\(/.test(modifiers)) col.primaryKey = true
  if (/\.notNull\s*\(/.test(modifiers)) col.required = true

  // Foreign key: `.references(() => otherTable.col)` -> a relation field.
  const ref = modifiers.match(/\.references\(\s*\(\)\s*=>\s*(\w+)\.(\w+)/)
  if (ref) {
    col.references = { table: ctx.varToTable.get(ref[1]!) ?? ref[1]!, column: ref[2]! }
  }
  return col
}

/** Assemble the neutral column list for one table. */
function columnsFor(table: DrizzleTable, ctx: DrizzleContext): IntrospectedColumn[] {
  const columns = splitTopLevel(table.body)
    .map((entry) => parseColumn(entry, ctx))
    .filter((c): c is IntrospectedColumn => c !== null)

  // Composite key (`primaryKey({ columns: [t.a, t.b] })` in the table's 2nd arg):
  // flag the members. buildEntitySchema keys off the first (a join table's screen
  // targets its first key column).
  const composite = drizzleComposite(table.extras)
  if (composite.length && !columns.some((c) => c.primaryKey)) {
    for (const c of columns) if (composite.includes(c.name)) c.primaryKey = true
  }
  return columns
}

/**
 * Parse one Drizzle table into an `EntitySchema`. Relations (`.references`) and
 * enums (`pgEnum` / inline) are resolved against the whole file. Best-effort and
 * text based: exotic column types fall back to `text`, to be corrected in the
 * designer.
 */
export function introspectDrizzle(source: string, table?: string): EntitySchema {
  const tables = findTables(source)
  if (tables.length === 0) {
    throw new Error('introspectDrizzle: no `xxxTable("name", { ... })` definition found in source')
  }
  const picked = table ? tables.find((t) => t.name === table || t.varName === table) : tables[0]
  if (!picked) throw new Error(`introspectDrizzle: table "${table}" not found in source`)

  const ctx = scanContext(source, tables)
  const columns = columnsFor(picked, ctx)
  if (columns.length === 0) {
    throw new Error(`introspectDrizzle: parsed table "${picked.name}" but found no fields`)
  }
  return buildEntitySchema(picked.name, columns)
}

/**
 * Parse **every** table in a Drizzle schema file into a linked set of schemas.
 * Foreign keys become relation fields and `linkRelationLabels` resolves each
 * lookup's display field from the actual related table - so the whole app
 * scaffolds with working lookups.
 */
export function introspectDrizzleAll(source: string): EntitySchema[] {
  const tables = findTables(source)
  if (tables.length === 0) {
    throw new Error('introspectDrizzle: no `xxxTable("name", { ... })` definition found in source')
  }
  const ctx = scanContext(source, tables)
  const schemas = tables
    .map((t) => ({ t, columns: columnsFor(t, ctx) }))
    .filter(({ columns }) => columns.length > 0)
    .map(({ t, columns }) => buildEntitySchema(t.name, columns))
  return linkRelationLabels(schemas)
}
