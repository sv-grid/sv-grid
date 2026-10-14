/**
 * The tables of a base and the links between them, as plain data: what
 * `<SvBase tables>` keeps, and the rules that keep a link field and the field
 * that links back from the other table in step. Every function here returns
 * a new list of tables and never touches a table it does not change, so the
 * component can hand the list to the app after each change.
 *
 * A link field names the table it points at (`fieldProps.table`) and, when
 * that table is in the same base, the field there that links back
 * (`fieldProps.inverse`). Its value is a list of record ids.
 */
import { newRecordId, uniqueId } from './field-ops'
import type { BaseAutomation } from './automations.svelte'
import type { BaseSource } from './base-sync'
import type { FieldView } from './view-model'

type Row = Record<string, unknown>
type Def = Record<string, any>

/** One table of a base. */
export type BaseTable = {
  /** Unique across the app: link fields name it in `fieldProps.table`. */
  id: string
  name: string
  data: Row[]
  /** Columns declared by field type (`fieldType`, `fieldProps`). */
  columns: Def[]
  views?: FieldView[]
  /** The field that names a record. Default: the first column. */
  primaryField?: string
  /** A record's id. Default: its `id` property. */
  getRowId?: (row: Row) => string
  /**
   * Where the records live: a database or an API (`baseSource`). The table
   * loads from it and writes every change back.
   */
  source?: BaseSource
  /** What happens when records are added, changed or match a condition (the view bar's Automations). */
  automations?: BaseAutomation[]
  /** Grid props for this table only (they win over the ones on `<SvBase>`). */
  props?: Record<string, unknown>
}

export const colId = (d: Def): string => String(d.id ?? d.field ?? '')
export const rowIdOf = (t: BaseTable, r: Row): string => (t.getRowId ? t.getRowId(r) : String(r?.id ?? ''))
export const primaryOf = (t: BaseTable): string => t.primaryField ?? String(t.columns[0]?.field ?? colId(t.columns[0] ?? {}))
const isLink = (d: Def | undefined): boolean => d?.fieldType === 'link'
const ids = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v == null || v === '' ? [] : [String(v)])

function replace(tables: BaseTable[], id: string, change: (t: BaseTable) => BaseTable): BaseTable[] {
  return tables.map((t) => (t.id === id ? change(t) : t))
}

function setColumn(t: BaseTable, id: string, change: (d: Def) => Def): BaseTable {
  return { ...t, columns: t.columns.map((d) => (colId(d) === id ? change(d) : d)) }
}

/** A field name free in `t`: "Projects", else "Projects 2". */
function freeHeader(t: BaseTable, name: string): string {
  const taken = new Set(t.columns.map((d) => String(d.header ?? '').trim().toLowerCase()))
  let n = name
  for (let i = 2; taken.has(n.toLowerCase()); i++) n = `${name} ${i}`
  return n
}

/**
 * The field that links back from `def`'s table, made when `def` points at
 * another table of the base and has none: a link field in that table named
 * after this one, many records per record. Both fields name each other.
 */
export function addInverse(tables: BaseTable[], tableId: string, fieldId: string): BaseTable[] {
  const from = tables.find((t) => t.id === tableId)
  const def = from?.columns.find((d) => colId(d) === fieldId)
  const target = tables.find((t) => t.id === def?.fieldProps?.table)
  if (!from || !def || !isLink(def) || !target || target.id === from.id) return tables
  // Its field back, when that field names it in turn (a duplicated link field
  // still names the original's, and gets its own).
  const have = def.fieldProps?.inverse ? target.columns.find((d) => colId(d) === def.fieldProps.inverse) : undefined
  if (have?.fieldProps?.inverse === fieldId) return syncInverse(tables, tableId, fieldId)
  const id = uniqueId(from.name, target.columns.map(colId))
  const back: Def = { id, field: id, header: freeHeader(target, from.name), width: 200, fieldType: 'link', fieldProps: { table: from.id, multiple: true, inverse: fieldId } }
  let next = replace(tables, target.id, (t) => ({ ...t, columns: [...t.columns, back] }))
  next = replace(next, from.id, (t) => setColumn(t, fieldId, (d) => ({ ...d, fieldProps: { ...d.fieldProps, inverse: id } })))
  return syncInverse(next, tableId, fieldId)
}

/**
 * Make the field that links back agree with `fieldId`'s values: a record of
 * the other table lists the records that link to it. Ids it already lists
 * keep their place, new ones go at the end. When the field back holds one
 * record (`multiple: false`), it keeps the one that linked last, and the
 * records it was linked from before let go of it, so both sides agree.
 */
export function syncInverse(tables: BaseTable[], tableId: string, fieldId: string): BaseTable[] {
  const from = tables.find((t) => t.id === tableId)
  const def = from?.columns.find((d) => colId(d) === fieldId)
  const target = tables.find((t) => t.id === def?.fieldProps?.table)
  const backId = def?.fieldProps?.inverse
  const back = target?.columns.find((d) => colId(d) === backId)
  if (from && def && target && backId && !isLink(back)) warnOnce(missingInverse(from, def, target))
  if (!from || !def || !target || !back || !isLink(back) || target.id === from.id) return tables
  const field = String(def.field ?? fieldId)
  const backField = String(back.field ?? backId)
  const single = back.fieldProps?.multiple === false
  // Record of this table -> the target records it lets go of.
  const letGo = new Map<string, Set<string>>()
  // Target record id -> the records of this table that link to it, in order.
  const wanted = new Map<string, string[]>()
  for (const r of from.data) {
    if (r == null) continue
    const me = rowIdOf(from, r)
    for (const to of ids(r[field])) {
      const list = wanted.get(to)
      if (list) list.push(me)
      else wanted.set(to, [me])
    }
  }
  let changed = false
  const data = target.data.map((r) => {
    if (r == null) return r
    const me = rowIdOf(target, r)
    const want = wanted.get(me) ?? []
    const prev = ids(r[backField])
    const keep = new Set(want)
    let next = prev.filter((x) => keep.has(x))
    for (const x of want) if (!next.includes(x)) next.push(x)
    if (single && next.length > 1) {
      const fresh = want.filter((x) => !prev.includes(x))
      const winner = fresh.length ? fresh[fresh.length - 1]! : next[0]!
      for (const x of next) {
        if (x === winner) continue
        const lost = letGo.get(x)
        if (lost) lost.add(me)
        else letGo.set(x, new Set([me]))
      }
      next = [winner]
    }
    if (next.length === prev.length && next.every((x, i) => x === prev[i])) return r
    changed = true
    return { ...r, [backField]: next }
  })
  let out = changed ? replace(tables, target.id, (t) => ({ ...t, data })) : tables
  if (letGo.size) {
    out = replace(out, from.id, (t) => ({
      ...t,
      data: t.data.map((r) => {
        const drop = r == null ? undefined : letGo.get(rowIdOf(t, r))
        return drop ? { ...r, [field]: ids(r[field]).filter((x) => !drop.has(x)) } : r
      }),
    }))
  }
  return out
}

const warned = new Set<string>()
function warnOnce(message: string): void {
  if (warned.has(message)) return
  warned.add(message)
  console.warn(message)
}

const missingInverse = (from: BaseTable, def: Def, target: BaseTable): string =>
  `[SvBase] Link field "${colId(def)}" of table "${from.id}" names "${def.fieldProps?.inverse}" as its field back (fieldProps.inverse), ` +
  `but table "${target.id}" has no link field with that id. Links made on either side will not reach the other.`

/**
 * What is wrong with the links of the tables as loaded: an `inverse` that
 * names no link field, and two sides of a link that disagree. The base does
 * not rewrite loaded data, so it reports instead (once per message, in the
 * console; SvBase calls this when it mounts).
 */
export function checkLinks(tables: BaseTable[], warn: (message: string) => void = warnOnce): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const t of tables) {
    for (const d of t.columns) {
      if (!isLink(d) || !d.fieldProps?.inverse) continue
      const target = tables.find((x) => x.id === d.fieldProps.table)
      if (!target || target.id === t.id) continue
      const back = target.columns.find((x) => colId(x) === d.fieldProps.inverse)
      if (!isLink(back)) {
        out.push(missingInverse(t, d, target))
        continue
      }
      const pair = [`${t.id}.${colId(d)}`, `${target.id}.${colId(back!)}`].sort().join('|')
      if (seen.has(pair) || syncInverse(tables, t.id, colId(d)) === tables) continue
      seen.add(pair)
      out.push(
        `[SvBase] The two sides of the link "${colId(d)}" (table "${t.id}") and "${colId(back!)}" (table "${target.id}") disagree in the loaded data. ` +
          'The base does not fix loaded data: the first link edit, or a record added or deleted, rebuilds the other side from the table where it happened.',
      )
    }
  }
  for (const m of out) warn(m)
  return out
}

/** Every link field of a table brings its other side up to date (after records are added or deleted). */
export function syncAllInverses(tables: BaseTable[], tableId: string): BaseTable[] {
  const from = tables.find((t) => t.id === tableId)
  let next = tables
  for (const d of from?.columns ?? []) if (isLink(d) && d.fieldProps?.inverse) next = syncInverse(next, tableId, colId(d))
  return next
}

/** Remove the field that links back from `def` (its column and its values). */
export function dropInverse(tables: BaseTable[], def: Def | undefined): BaseTable[] {
  if (!isLink(def) || !def?.fieldProps?.inverse) return tables
  const target = tables.find((t) => t.id === def.fieldProps.table)
  const back = target?.columns.find((d) => colId(d) === def.fieldProps.inverse)
  if (!target || !back || back.fieldProps?.table == null) return tables
  const backField = String(back.field ?? colId(back))
  return replace(tables, target.id, (t) => ({
    ...t,
    columns: t.columns.filter((d) => d !== back),
    data: t.data.map((r) => {
      if (r == null || !(backField in r)) return r
      const { [backField]: _drop, ...rest } = r
      return rest
    }),
  }))
}

/**
 * A field of `tableId` changed from `prev` to its current column. A link that
 * now points at another table loses the field back in the old one, its values
 * (ids of the old table's records) and gets a field back in the new one; a
 * link turned into another type loses the field back.
 */
export function fieldChanged(tables: BaseTable[], tableId: string, prev: Def | undefined, fieldId: string): BaseTable[] {
  const table = tables.find((t) => t.id === tableId)
  const now = table?.columns.find((d) => colId(d) === fieldId)
  if (!table || !now) return tables
  const wasLink = isLink(prev)
  const target = now.fieldProps?.table
  const moved = wasLink && isLink(now) && prev!.fieldProps?.table !== target
  let next = tables
  if (wasLink && (!isLink(now) || moved)) {
    next = dropInverse(next, prev)
    next = replace(next, tableId, (t) => setColumn(t, fieldId, (d) => {
      const { inverse: _gone, ...fieldProps } = d.fieldProps ?? {}
      return { ...d, fieldProps }
    }))
  }
  if (moved) {
    const field = String(now.field ?? fieldId)
    next = replace(next, tableId, (t) => ({ ...t, data: t.data.map((r) => (r == null ? r : { ...r, [field]: [] })) }))
  }
  // A link to one record: each record keeps the first id it holds, and the
  // field back (synced below) lets go of the rest.
  if (isLink(now) && now.fieldProps?.multiple === false) {
    const field = String(now.field ?? fieldId)
    next = replace(next, tableId, (t) => {
      if (!t.data.some((r) => ids(r?.[field]).length > 1)) return t
      return { ...t, data: t.data.map((r) => (r != null && ids(r[field]).length > 1 ? { ...r, [field]: ids(r[field]).slice(0, 1) } : r)) }
    })
  }
  if (isLink(now)) next = addInverse(next, tableId, fieldId)
  return next
}

const READERS = new Set(['lookup', 'rollup', 'count'])

/** The lookups, rollups and counts of a table (or a grid's columns) that read its link field `link`. */
export function linkReaders(t: { columns: ReadonlyArray<Def> }, link: Def): Def[] {
  const names = new Set([colId(link), String(link.field ?? '')].filter(Boolean))
  return t.columns.filter((d) => READERS.has(d.fieldType) && names.has(String(d.fieldProps?.linkField ?? '')))
}

function dropColumns(t: BaseTable, gone: ReadonlyArray<Def>): BaseTable {
  return gone.length ? { ...t, columns: t.columns.filter((d) => !gone.includes(d)) } : t
}

/**
 * Link field `def` of `tableId` was deleted (it is gone from the columns
 * already): the lookups, rollups and counts that read it go too, and so do
 * its field back, with its values, and the ones that read that.
 */
export function removeLinkField(tables: BaseTable[], tableId: string, def: Def | undefined): BaseTable[] {
  if (!isLink(def)) return tables
  let next = replace(tables, tableId, (t) => dropColumns(t, linkReaders(t, def!)))
  const target = next.find((t) => t.id === def!.fieldProps?.table)
  const back = def!.fieldProps?.inverse ? target?.columns.find((d) => colId(d) === def!.fieldProps.inverse) : undefined
  if (target && isLink(back) && target.id !== tableId) next = replace(next, target.id, (t) => dropColumns(t, linkReaders(t, back!)))
  return dropInverse(next, def)
}

/**
 * Delete a table, and every link field of another table that points at it
 * (with its values), with the lookups, rollups and counts that read those.
 */
export function removeTable(tables: BaseTable[], tableId: string): BaseTable[] {
  return tables
    .filter((t) => t.id !== tableId)
    .map((t) => {
      const links = t.columns.filter((d) => isLink(d) && d.fieldProps?.table === tableId)
      if (!links.length) return t
      const gone = [...links, ...links.flatMap((d) => linkReaders(t, d))]
      const fields = new Set(gone.map((d) => String(d.field ?? colId(d))))
      return {
        ...t,
        columns: t.columns.filter((d) => !gone.includes(d)),
        data: t.data.map((r) => {
          if (r == null) return r
          const out: Row = {}
          for (const [k, v] of Object.entries(r)) if (!fields.has(k)) out[k] = v
          return out
        }),
      }
    })
}

// A new record id; it lives with the other field operations, which give one to every new record.
export { newRecordId } from './field-ops'

/** A table name not used yet: "Table 2", "Table 3". */
export function freeTableName(tables: ReadonlyArray<BaseTable>, base = 'Table'): string {
  const taken = new Set(tables.map((t) => t.name.trim().toLowerCase()))
  let n = 1
  while (taken.has((n === 1 ? base : `${base} ${n}`).toLowerCase())) n += 1
  return n === 1 ? base : `${base} ${n}`
}

/** A new table as a base starts one: Name, Notes and Status, three empty records, a grid view. */
export function blankTable(tables: ReadonlyArray<BaseTable>, name = freeTableName(tables, 'Table')): BaseTable {
  const id = uniqueId(name, tables.map((t) => t.id))
  return {
    id,
    name,
    primaryField: 'name',
    columns: [
      { id: 'name', field: 'name', header: 'Name', width: 220, fieldType: 'text' },
      { id: 'notes', field: 'notes', header: 'Notes', width: 260, fieldType: 'longText' },
      {
        id: 'status', field: 'status', header: 'Status', width: 140, fieldType: 'singleSelect',
        fieldProps: { options: [{ value: 'Todo', color: '#94a3b8' }, { value: 'In progress', color: '#2d7ff9' }, { value: 'Done', color: '#20c933' }] },
      },
    ],
    data: [0, 1, 2].map(() => ({ id: newRecordId() })),
    views: [{ id: 'grid', name: 'Grid view', type: 'grid' }],
  }
}

/**
 * A copy of a table: its fields, records and views, under a new name. Its
 * link fields point at the same records; addInverse gives each one a field
 * back once the copy is in the base.
 */
export function copyTable(tables: ReadonlyArray<BaseTable>, source: BaseTable): BaseTable {
  const name = freeTableName(tables, `${source.name} copy`)
  const data = source.data.map((r) => ({ ...r, id: newRecordId() }))
  return {
    ...source,
    id: uniqueId(name, tables.map((t) => t.id)),
    name,
    getRowId: undefined,
    // The copy lives in the page: it is not the database table it came from.
    source: undefined,
    columns: source.columns.map((d) => {
      if (!isLink(d) || !d.fieldProps?.inverse) return d
      const { inverse: _theirs, ...fieldProps } = d.fieldProps
      return { ...d, fieldProps }
    }),
    data,
    views: source.views?.map((v) => ({ ...v })),
  }
}
