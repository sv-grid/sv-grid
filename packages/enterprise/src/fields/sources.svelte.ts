/**
 * What fields need from the app that no column holds: the people a user
 * field can name, who is signed in (created by / last modified by), and the
 * rows of other tables a link field can point at.
 */

export type FieldUser = { id: string; name: string; email?: string; avatarUrl?: string }

let users = $state.raw<FieldUser[]>([])
let currentUser = $state.raw<FieldUser | null>(null)

/** The people user fields can choose from. */
export function setFieldUsers(list: ReadonlyArray<FieldUser>): void {
  users = [...list]
}
export const getFieldUsers = (): ReadonlyArray<FieldUser> => users
export const findFieldUser = (id: unknown): FieldUser | undefined =>
  id == null ? undefined : users.find((u) => u.id === String(id)) ?? (currentUser?.id === String(id) ? currentUser : undefined)

/** Who is signed in: what "created by" and "last modified by" write. */
export function setCurrentUser(user: FieldUser | null): void {
  currentUser = user
}
export const getCurrentUser = (): FieldUser | null => currentUser

/** Another table a link field can point at. */
export type LinkedTable = {
  id: string
  name: string
  /** Its rows. A function is read each time, so the table can change. */
  rows: ReadonlyArray<Record<string, unknown>> | (() => ReadonlyArray<Record<string, unknown>>)
  /** A row's id. Default: its `id` property. */
  getRowId?: (row: Record<string, unknown>) => string
  /** The field shown for a linked row (its name). */
  primaryField: string
  /**
   * The fields a lookup or rollup can read: `{ field, header }`, and the
   * field's type when it has one (`fieldType`, `fieldProps`), so a lookup
   * shows a date as a date, an amount with its symbol.
   */
  fields?: ReadonlyArray<{ field: string; header: string; fieldType?: string; fieldProps?: Record<string, unknown> }>
  /**
   * Add a record named `name` to this table (the link picker's "+ Create");
   * return the new row, with its id. Without it the picker only links
   * existing records.
   */
  create?: (name: string) => Record<string, unknown> | Promise<Record<string, unknown>>
  /**
   * Show a record of this table where it lives (another tab of a base): the
   * linked record view then offers "Open in {name}".
   */
  open?: (rowId: string) => void
}

/** A linked table's fields as filled columns (formatter, cell), for showing one of its records. */
export type LinkedField = { id: string; header: string; def: Record<string, any> }

let tables = $state.raw<Record<string, LinkedTable>>({})

// Every registration per id, newest last: the newest is the one link fields
// see. Each `<SvBase>` registers under its own owner, the app under none, so
// one base forgetting its table does not take another's (or the app's) away.
type Entry = { table: LinkedTable; owner: object | undefined }
const entries = new Map<string, Entry[]>()

function publish(id: string): void {
  const top = entries.get(id)?.at(-1)?.table
  if (top) tables = { ...tables, [id]: top }
  else if (id in tables) {
    const { [id]: _gone, ...rest } = tables
    tables = rest
  }
}

/**
 * Add or replace a table that link fields can point at. Registering again
 * with the same id and owner replaces that registration. With the same id
 * and another owner (two bases, or a base and the app), the newest one is
 * shown until it is unregistered. Returns a function that unregisters this
 * registration only.
 */
export function registerLinkedTable(table: LinkedTable, owner?: object): () => void {
  const list = (entries.get(table.id) ?? []).filter((e) => e.owner !== owner)
  const entry: Entry = { table, owner }
  list.push(entry)
  entries.set(table.id, list)
  publish(table.id)
  return () => {
    const now = entries.get(table.id)
    if (!now?.includes(entry)) return
    entries.set(table.id, now.filter((e) => e !== entry))
    publish(table.id)
  }
}
/** Forget a table: the app's registration of `id`, or `owner`'s. */
export function unregisterLinkedTable(id: string, owner?: object): void {
  const list = entries.get(id)
  if (!list?.some((e) => e.owner === owner)) return
  entries.set(id, list.filter((e) => e.owner !== owner))
  publish(id)
}
export const getLinkedTable = (id: unknown): LinkedTable | undefined => (typeof id === 'string' ? tables[id] : undefined)
export const listLinkedTables = (): LinkedTable[] => Object.values(tables)

export const rowsOf = (t: LinkedTable): ReadonlyArray<Record<string, unknown>> => (typeof t.rows === 'function' ? t.rows() : t.rows)
export const idOf = (t: LinkedTable, row: Record<string, unknown>): string => (t.getRowId ? t.getRowId(row) : String(row.id ?? ''))

/** The linked rows a link cell's value names, in its order; unknown ids are skipped. */
export function linkedRows(table: LinkedTable | undefined, value: unknown): Record<string, unknown>[] {
  if (!table) return []
  const ids = Array.isArray(value) ? value.map(String) : value == null || value === '' ? [] : [String(value)]
  if (!ids.length) return []
  const byId = indexOf(table)
  return ids.map((id) => byId.get(id)).filter((r): r is Record<string, unknown> => !!r)
}

/**
 * The id of the record of `table` a pasted or typed part names: its id, else
 * its name (the primary field), both ignoring case. Undefined when no record has it.
 */
export function resolveLinkId(table: LinkedTable, part: unknown): string | undefined {
  const q = String(part ?? '').trim().toLowerCase()
  if (!q) return undefined
  const { byId, byName } = lookupOf(table)
  return byId.get(q) ?? byName.get(q)
}

/** The records `parts` name (see resolveLinkId), in order, each once; a part no record has is dropped. */
export function resolveLinkIds(table: LinkedTable, parts: ReadonlyArray<unknown>): string[] {
  const ids: string[] = []
  for (const p of parts) {
    const id = resolveLinkId(table, p)
    if (id != null && !ids.includes(id)) ids.push(id)
  }
  return ids
}

// Lower-cased id and name -> id per rows array. A type change resolves every
// cell in one go, so the maps are built once for it; they are dropped when
// the current task ends, so a record renamed or added later is seen.
type Lookup = { byId: Map<string, string>; byName: Map<string, string> }
let lookups = new WeakMap<object, Lookup>()
let dropQueued = false
function lookupOf(table: LinkedTable): Lookup {
  const rows = rowsOf(table)
  let l = lookups.get(rows)
  if (!l) {
    l = { byId: new Map(), byName: new Map() }
    for (const r of rows) {
      const id = idOf(table, r)
      const lowId = id.toLowerCase()
      const name = String(r[table.primaryField] ?? '').trim().toLowerCase()
      if (!l.byId.has(lowId)) l.byId.set(lowId, id)
      if (name && !l.byName.has(name)) l.byName.set(name, id)
    }
    lookups.set(rows, l)
    if (!dropQueued) {
      dropQueued = true
      queueMicrotask(() => {
        lookups = new WeakMap()
        dropQueued = false
      })
    }
  }
  return l
}

// id -> row per rows array: a cell asks for its linked rows on every draw.
const indexes = new WeakMap<object, Map<string, Record<string, unknown>>>()
function indexOf(table: LinkedTable): Map<string, Record<string, unknown>> {
  const rows = rowsOf(table)
  let map = indexes.get(rows)
  if (!map) {
    map = new Map(rows.map((r) => [idOf(table, r), r]))
    indexes.set(rows, map)
  }
  return map
}
