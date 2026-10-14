/**
 * A base as Postgres SQL: the tables, their columns, foreign keys and
 * junction tables, and the records, ready to run on Postgres, Supabase or
 * PGlite.
 *
 * Everything SQL has no column type for rides along in comments
 * (`COMMENT ON ... IS 'svgrid:{...}'`): a select's options and colors, a
 * number shown as currency, the formula, lookup, rollup and count fields, the
 * views and the automations. `baseFromDatabase` (and `createBaseEndpoint`)
 * read them back, so the database opens as the same base, not a generic one.
 * A database without the comments still opens: they only add to what is
 * read from the columns.
 */
import { colId, primaryOf, rowIdOf, type BaseTable } from './base-tables'
import { fillFieldColumn } from './registry.svelte'

type Def = Record<string, any>
type Row = Record<string, unknown>

/** What a table comment holds. */
export type BaseTableComment = {
  v: 1
  /** The table's name in the base ("Key results"). */
  name: string
  /** Where its tab was. */
  position?: number
  primaryField?: string
  /** The fields in their order. */
  order: string[]
  /** Fields with no column of their own: computed ones, buttons, links kept elsewhere. */
  extra: Def[]
  views?: unknown[]
  automations?: unknown[]
}
/** What a junction table's comment holds: whose link it keeps. */
export type BaseJunctionComment = { v: 1; junction: { owner: string; field: string; from: string; to: string } }

export const SQL_COMMENT_PREFIX = 'svgrid:'

/** `fixedOn` -> `fixed_on`, `Key results` -> `key_results`. */
export function sqlName(s: string): string {
  const out = String(s)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
  return /^[a-z_]/.test(out) ? out : `t_${out}`
}

const COMPUTED = new Set(['formula', 'lookup', 'rollup', 'count', 'button'])
const quote = (name: string) => `"${name.replace(/"/g, '""')}"`
const str = (s: string) => `'${s.replace(/'/g, "''")}'`
const ids = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v == null || v === '' ? [] : [String(v)])

function sqlType(d: Def): string {
  switch (d.fieldType) {
    case 'number':
    case 'currency':
    case 'percent':
    case 'rating':
    case 'duration':
    case 'autoNumber':
      return 'double precision'
    case 'checkbox':
      return 'boolean'
    case 'date':
      return d.fieldProps?.time ? 'timestamptz' : 'date'
    case 'createdTime':
    case 'lastModifiedTime':
      return 'timestamptz'
    case 'multiSelect':
      return 'text[]'
    case 'user':
    case 'createdBy':
    case 'lastModifiedBy':
      return d.fieldProps?.multiple ? 'text[]' : 'text'
    case 'attachment':
      return 'jsonb'
    default:
      return typeOfData(d)
  }
}

const dataTypes = new WeakMap<Def, string>()
/**
 * Any other type (a registered one) by what its filled column holds, as the
 * built-ins map: a number, a true / false, a date with or without the time.
 */
function typeOfData(d: Def): string {
  let t = dataTypes.get(d)
  if (t === undefined) {
    const kind = fillFieldColumn(d).cellDataType
    t = kind === 'number' ? 'double precision' : kind === 'boolean' ? 'boolean' : kind === 'date' ? 'timestamptz' : kind === 'dateString' ? 'date' : 'text'
    dataTypes.set(d, t)
  }
  return t
}

export type BaseToSqlOptions = {
  /** Dates within this many days of `today` are written as `current_date + n`, so seed data stays current (default 400; 0 writes every date as it is). */
  relativeDays?: number
  today?: Date
  /** Leave the records out: tables only. */
  data?: boolean
  /** A first line saying what this is. */
  title?: string
}

type Plan = {
  table: BaseTable
  sql: string
  /** Stored fields: field -> column. */
  columns: Array<{ def: Def; column: string; fk?: string }>
  extra: Def[]
}

const DAY = 86_400_000

/**
 * The SQL that makes a database holding these tables and records.
 *
 * ```ts
 * const sql = baseToSql(tables)        // run it with psql, the Supabase SQL editor, or PGlite
 * const again = await baseFromDatabase({ execute })   // the same base, from the database
 * ```
 */
export function baseToSql(tables: ReadonlyArray<BaseTable>, options: BaseToSqlOptions = {}): string {
  const today = options.today ?? new Date()
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const relative = options.relativeDays ?? 400
  const used = new Set<string>()
  const nameOf = new Map<string, string>()
  for (const t of tables) {
    let n = sqlName(t.name || t.id)
    while (used.has(n)) n = `${n}_2`
    used.add(n)
    nameOf.set(t.id, n)
  }
  const tableOf = (id: string) => tables.find((t) => t.id === id)
  const fieldOf = (t: BaseTable, id: string) => t.columns.find((d) => colId(d) === id)

  /** Who keeps a link: a foreign key on the side that links to one record, else a junction on the first table. */
  function storage(t: BaseTable, d: Def): 'fk' | 'junction' | 'derived' {
    const target = tableOf(String(d.fieldProps?.table ?? ''))
    const back = d.fieldProps?.inverse && target ? fieldOf(target, String(d.fieldProps.inverse)) : undefined
    const many = d.fieldProps?.multiple !== false
    if (!back || target === t) return many ? 'junction' : 'fk'
    const backMany = back.fieldProps?.multiple !== false
    if (!many) return 'fk'
    if (!backMany) return 'derived'
    return tables.indexOf(t) <= tables.indexOf(target!) ? 'junction' : 'derived'
  }

  // Rewrite table ids to the SQL names in what a comment keeps.
  const remap = (value: unknown): unknown => JSON.parse(JSON.stringify(value ?? null), (k, v) => (k === 'table' && typeof v === 'string' && nameOf.has(v) ? nameOf.get(v) : v))

  const plans: Plan[] = []
  const junctions: Array<{ name: string; owner: BaseTable; field: string; from: string; to: string; target: BaseTable }> = []
  for (const t of tables) {
    const name = nameOf.get(t.id)!
    const columns: Plan['columns'] = []
    const extra: Def[] = []
    const taken = new Set(['id'])
    const column = (base: string) => {
      let c = sqlName(base)
      while (taken.has(c)) c = `${c}_2`
      taken.add(c)
      return c
    }
    for (const d of t.columns) {
      if (d.field == null) continue
      const field = String(d.field)
      if (COMPUTED.has(String(d.fieldType))) {
        extra.push(d)
        continue
      }
      if (d.fieldType === 'link') {
        const how = storage(t, d)
        const target = tableOf(String(d.fieldProps?.table ?? ''))
        if (!target) continue
        if (how === 'fk') columns.push({ def: d, column: column(`${field}_id`), fk: nameOf.get(target.id) })
        else {
          extra.push(d)
          if (how === 'junction') {
            const from = `${sqlName(name).replace(/s$/, '')}_id`
            let to = `${sqlName(field).replace(/s$/, '')}_id`
            if (to === from) to = `${to}_2`
            junctions.push({ name: `${name}_${sqlName(field)}`, owner: t, field, from, to, target })
          }
        }
        continue
      }
      columns.push({ def: d, column: column(field) })
    }
    // The database makes the key of a record added later: a Supabase insert
    // carries no id. The records below bring their own.
    const lines = [`  "id" text primary key default gen_random_uuid()::text`,...columns.map((c) => `  ${quote(c.column)} ${c.fk ? 'text' : sqlType(c.def)}`)]
    plans.push({ table: t, columns, extra, sql: `create table ${quote(name)} (\n${lines.join(',\n')}\n);` })
  }

  const out: string[] = []
  out.push(`-- ${options.title ?? 'A base'}, as Postgres tables. Made by baseToSql (@svgrid/enterprise/base);`)
  out.push(`-- the svgrid: comments keep what SQL has no type for, so baseFromDatabase opens it as the same base.`)
  out.push('')
  for (const p of plans) out.push(p.sql)
  for (const j of junctions) {
    out.push(`create table ${quote(j.name)} (\n  "id" serial primary key,\n  ${quote(j.from)} text not null,\n  ${quote(j.to)} text not null\n);`)
  }
  out.push('')

  // Comments: what each field, table and junction is in the base.
  for (const p of plans) {
    const name = nameOf.get(p.table.id)!
    for (const c of p.columns) {
      out.push(`comment on column ${quote(name)}.${quote(c.column)} is ${str(SQL_COMMENT_PREFIX + JSON.stringify(remap(c.def)))};`)
    }
    const comment: BaseTableComment = {
      v: 1,
      name: p.table.name,
      position: plans.indexOf(p),
      primaryField: primaryOf(p.table),
      order: p.table.columns.filter((d) => d.field != null).map((d) => String(d.field)),
      extra: remap(p.extra) as Def[],
      ...(p.table.views ? { views: remap(p.table.views) as unknown[] } : {}),
      ...(p.table.automations?.length ? { automations: remap(p.table.automations) as unknown[] } : {}),
    }
    out.push(`comment on table ${quote(name)} is ${str(SQL_COMMENT_PREFIX + JSON.stringify(comment))};`)
  }
  for (const j of junctions) {
    const c: BaseJunctionComment = { v: 1, junction: { owner: nameOf.get(j.owner.id)!, field: j.field, from: j.from, to: j.to } }
    out.push(`comment on table ${quote(j.name)} is ${str(SQL_COMMENT_PREFIX + JSON.stringify(c))};`)
  }

  // The records.
  if (options.data !== false) {
    const value = (d: Def, v: unknown): string => {
      if (v == null || v === '' || (Array.isArray(v) && v.length === 0 && sqlType(d) !== 'text[]' && sqlType(d) !== 'jsonb')) return 'null'
      const type = sqlType(d)
      if (type === 'jsonb') {
        // A blob: link lives only in the page that made it: leave such files out.
        const kept = Array.isArray(v) ? v.filter((x) => !(x && typeof x === 'object' && String((x as { url?: unknown }).url ?? '').startsWith('blob:'))) : v
        return `${str(JSON.stringify(kept))}::jsonb`
      }
      if (type === 'text[]') return `array[${ids(v).map(str).join(', ')}]::text[]`
      if (type === 'boolean') return v ? 'true' : 'false'
      if (type === 'double precision') return Number.isFinite(Number(v)) ? String(Number(v)) : 'null'
      if (type === 'date' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && relative > 0) {
        const n = Math.round((Date.parse(`${v}T00:00:00Z`) - todayUtc) / DAY)
        if (Math.abs(n) <= relative) return n === 0 ? 'current_date' : `current_date ${n > 0 ? '+' : '-'} ${Math.abs(n)}`
      }
      return str(String(v))
    }
    out.push('')
    for (const p of plans) {
      const rows = p.table.data.filter(Boolean)
      if (!rows.length) continue
      const cols = ['id', ...p.columns.map((c) => c.column)]
      const tuples = rows.map((r: Row) => {
        const vals = [str(rowIdOf(p.table, r)), ...p.columns.map((c) => (c.fk ? (ids(r[String(c.def.field)])[0] != null ? str(ids(r[String(c.def.field)])[0]!) : 'null') : value(c.def, r[String(c.def.field)])))]
        return `  (${vals.join(', ')})`
      })
      out.push(`insert into ${quote(nameOf.get(p.table.id)!)} (${cols.map(quote).join(', ')}) values\n${tuples.join(',\n')};`)
    }
    for (const j of junctions) {
      const pairs: string[] = []
      for (const r of j.owner.data) if (r) for (const to of ids(r[j.field])) pairs.push(`  (${str(rowIdOf(j.owner, r))}, ${str(to)})`)
      if (pairs.length) out.push(`insert into ${quote(j.name)} (${quote(j.from)}, ${quote(j.to)}) values\n${pairs.join(',\n')};`)
    }
  }

  // Foreign keys last, once every record is in: links may point either way.
  out.push('')
  for (const p of plans) {
    const name = nameOf.get(p.table.id)!
    for (const c of p.columns) if (c.fk) out.push(`alter table ${quote(name)} add foreign key (${quote(c.column)}) references ${quote(c.fk)}("id") on delete set null;`)
  }
  for (const j of junctions) {
    out.push(`alter table ${quote(j.name)} add foreign key (${quote(j.from)}) references ${quote(nameOf.get(j.owner.id)!)}("id") on delete cascade;`)
    out.push(`alter table ${quote(j.name)} add foreign key (${quote(j.to)}) references ${quote(nameOf.get(j.target.id)!)}("id") on delete cascade;`)
  }
  return out.join('\n') + '\n'
}
