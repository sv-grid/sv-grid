/**
 * A base on a database: each table with a `source` loads its records from
 * it and writes every change back.
 *
 * A base filters, groups, colors and sums in the page, so a table loads in
 * full (up to `limit` records) and the writer keeps a copy of what the
 * database holds. After each change it compares the tables with that copy
 * and sends what differs: an insert for a new record, an update with the
 * changed fields, a delete. Writes go one at a time, in order, so an update
 * never overtakes the insert of its record. A write that fails is undone in
 * the page and reported.
 *
 * Link fields: a link to one record is a foreign key column, a link to many
 * records goes through a junction table, and the field that links back is
 * worked out in the page from the other side, so it is never stored.
 *
 * Record ids: a new record gets an id in the page at once. When the database
 * gives it another one (a serial key, a default uuid), the writer keeps both
 * and translates, so the grid never sees a record change its id under an
 * open editor.
 */
import type { ServerDataSource, ServerRequest } from '@svgrid/grid'
import { colId, rowIdOf, syncInverse, type BaseTable } from './base-tables'

type Row = Record<string, unknown>
type Def = Record<string, any>

/** A link field kept as a foreign key: the column holds the linked record's id. */
export type ForeignKeyLink = { column: string }
/** A link field kept in a junction table: one row per pair. */
export type JunctionLink = {
  through: ServerDataSource<any>
  /** The junction column with this table's record id. */
  from: string
  /** The junction column with the linked record's id. */
  to: string
  /** The junction table's own key (default `id`). */
  idField?: string
}

/** What a base table reads and writes. `baseSource` makes one from any data source. */
export type BaseSource = {
  /** Every record, as the page keeps them (link fields as lists of ids). */
  load(): Promise<Row[]>
  /**
   * One row as the database has it (a webhook's `record`), as the page keeps
   * it: a foreign key becomes a link, renamed columns their fields. Links
   * kept in a junction table are not in such a row.
   */
  toPage(row: Row): Row
  /** Store a new record; resolves with the record as stored (its id may be the database's). */
  insert(row: Row): Promise<Row>
  update(id: string, patch: Row, before: Row): Promise<void>
  remove(id: string, before: Row): Promise<void>
  /** Hear of changes made elsewhere (another user, another tab); returns the unsubscribe. */
  subscribe?(onChange: () => void): () => void
  /** The most records `load` reads. */
  limit: number
  /** The link fields it stores, by field. */
  links: Record<string, ForeignKeyLink | JunctionLink>
  /** Fields it does not store, besides computed ones and the fields that link back. */
  skip: ReadonlySet<string>
  /** Turn a linked record's page id into its database id, and back (set by the writer). */
  ids?: { toServer: (table: string, id: string) => string; toLocal: (table: string, id: string) => string }
}

export type BaseSourceOptions = {
  /** The most records to load (default 10,000). A base works on all of them in the page. */
  limit?: number
  /** The record's key column (default `id`). */
  idField?: string
  /**
   * The database makes the key (a serial column, a default uuid): a new
   * record is inserted without the page's id, and the writer uses the one it
   * gets back. By default the page's id is the key.
   */
  serverIds?: boolean
  /** Column names that differ from the field names: `{ dueDate: 'due_date' }`. */
  columns?: Record<string, string>
  /** How link fields are stored: `{ project: { column: 'project_id' } }`, or a junction. */
  links?: Record<string, ForeignKeyLink | JunctionLink>
  /** Fields kept in the page only. */
  skip?: string[]
  /**
   * Changes made elsewhere: call `onChange` when the table changed, and return
   * a function that stops listening. With Supabase:
   * `(onChange) => createSupabaseRealtime({ client, table, onChange }).unsubscribe`.
   */
  realtime?: (onChange: () => void) => (() => void) | { unsubscribe: () => void }
}

const isJunction = (l: ForeignKeyLink | JunctionLink): l is JunctionLink => 'through' in l
const ids = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v == null || v === '' ? [] : [String(v)])

const request = (endRow: number, filter: ServerRequest['filterModel'] = {}): ServerRequest => ({
  startRow: 0,
  endRow,
  pageIndex: 0,
  pageSize: endRow,
  sortModel: [],
  filterModel: filter,
})

/**
 * A value as the page keeps it: a date column read as a JS Date (PGlite,
 * node-postgres) becomes 'YYYY-MM-DD', or a full ISO time when it has one.
 */
function fromDb(v: unknown): unknown {
  if (v instanceof Date) {
    const iso = v.toISOString()
    return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso
  }
  return v
}

/**
 * A base table's source from any data source with the grid's contract
 * (`createSupabaseDataSource`, `createSqlDataSource`, `createRestDataSource`,
 * `createInMemoryDataSource`, or your own).
 *
 * ```ts
 * source: baseSource(createSupabaseDataSource({ client, table: 'tasks', schema }), {
 *   links: { project: { column: 'project_id' } },
 *   realtime: (onChange) => createSupabaseRealtime({ client, table: 'tasks', onChange }).unsubscribe,
 * })
 * ```
 */
export function baseSource(ds: ServerDataSource<any>, options: BaseSourceOptions = {}): BaseSource {
  const limit = options.limit ?? 10_000
  const idField = options.idField ?? 'id'
  const links = options.links ?? {}
  const rename = options.columns ?? {}
  const back = new Map(Object.entries(rename).map(([f, c]) => [c, f]))
  const fks = new Map(Object.entries(links).filter((e): e is [string, ForeignKeyLink] => !isJunction(e[1])))
  const junctions = Object.entries(links).filter((e): e is [string, JunctionLink] => isJunction(e[1]))
  const fkColumns = new Map([...fks].map(([field, l]) => [l.column, field]))
  /** A row as the database has it, as the page keeps it (junction links aside). */
  function toPage(r: Row): Row {
    const row: Row = {}
    for (const [k, v] of Object.entries(r ?? {})) {
      const fk = fkColumns.get(k)
      if (fk) row[fk] = v == null ? [] : [String(v)]
      else row[back.get(k) ?? k] = fromDb(v)
    }
    row.id = String(r?.[idField] ?? row.id ?? '')
    return row
  }
  // Junction row ids by "from|to", to delete a pair.
  const pairs = new Map<string, Map<string, string>>()
  const pairKey = (a: string, b: string) => `${a}|${b}`

  const src: BaseSource = {
    limit,
    links,
    skip: new Set(options.skip ?? []),
    toPage,
    async load() {
      const res = await ds.getRows(request(limit))
      const out = res.rows.map((r: Row) => toPage(r))
      for (const [field, j] of junctions) {
        const seen = new Map<string, string>()
        pairs.set(field, seen)
        const jr = await j.through.getRows(request(limit * 20))
        const byFrom = new Map<string, string[]>()
        for (const p of jr.rows as Row[]) {
          const a = String(p[j.from])
          const b = String(p[j.to])
          seen.set(pairKey(a, b), String(p[j.idField ?? 'id']))
          const list = byFrom.get(a)
          if (list) list.push(b)
          else byFrom.set(a, [b])
        }
        for (const row of out) row[field] = byFrom.get(String(row.id)) ?? []
      }
      return out
    },
    async insert(row) {
      const { stored, later } = split(row)
      const created = (await ds.createRow!(stored)) as Row
      const id = String(created?.[idField] ?? row.id)
      for (const [field, to] of later) await addPairs(field, id, to)
      return { ...row, id }
    },
    async update(id, patch, before) {
      const { stored, later } = split(patch)
      if (Object.keys(stored).length) await ds.updateRow!(id, stored)
      for (const [field, to] of later) {
        const was = new Set(ids(before[field]))
        const now = new Set(to)
        await addPairs(field, id, to.filter((x) => !was.has(x)))
        await dropPairs(field, id, [...was].filter((x) => !now.has(x)))
      }
    },
    async remove(id, before) {
      for (const [field] of junctions) await dropPairs(field, id, ids(before[field]))
      await ds.deleteRow!(id)
    },
    ...(options.realtime
      ? {
          subscribe: (onChange: () => void) => {
            const stop = options.realtime!(onChange)
            return typeof stop === 'function' ? stop : () => stop.unsubscribe()
          },
        }
      : {}),
  }

  /** A record's fields as columns, and its junction links to write after it. */
  function split(row: Row): { stored: Row; later: Array<[string, string[]]> } {
    const stored: Row = {}
    const later: Array<[string, string[]]> = []
    for (const [k, v] of Object.entries(row)) {
      const link = links[k]
      if (link && isJunction(link)) later.push([k, ids(v)])
      else if (link) {
        const first = ids(v)[0]
        stored[link.column] = first == null ? null : linkedId(k, first)
      } else if (k === 'id') {
        if (!options.serverIds) stored[idField] = v
      } else stored[rename[k] ?? k] = v
    }
    return { stored, later }
  }
  // A linked record's database id. The writer sets `ids` and knows the table.
  const linkedTable = new Map<string, string>()
  function linkedId(field: string, id: string): string {
    const table = linkedTable.get(field)
    return table && src.ids ? src.ids.toServer(table, id) : id
  }
  async function addPairs(field: string, from: string, to: string[]) {
    const j = links[field] as JunctionLink
    const seen = pairs.get(field) ?? new Map<string, string>()
    pairs.set(field, seen)
    for (const x of to) {
      const b = linkedId(field, x)
      const made = (await j.through.createRow!({ [j.from]: from, [j.to]: b })) as Row
      seen.set(pairKey(from, b), String(made?.[j.idField ?? 'id'] ?? ''))
    }
  }
  async function dropPairs(field: string, from: string, to: string[]) {
    const j = links[field] as JunctionLink
    const seen = pairs.get(field)
    for (const x of to) {
      const b = linkedId(field, x)
      const pid = seen?.get(pairKey(from, b))
      if (!pid) continue
      await j.through.deleteRow!(pid)
      seen!.delete(pairKey(from, b))
    }
  }
  // The writer tells the source which table each link field points at.
  ;(src as BaseSource & { linkTables: Map<string, string> }).linkTables = linkedTable
  return src
}

// ---- The writer -------------------------------------------------------------

/** Field types worked out in the page: never written. */
const COMPUTED = new Set(['formula', 'lookup', 'rollup', 'count', 'button'])

export type BaseSyncStatus =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'saving'; pending: number }
  | { state: 'error'; message: string; table: string }
  | { state: 'limited'; table: string; limit: number }

export type BaseSyncOptions = {
  getTables: () => BaseTable[] | undefined
  /** Put tables in the page without writing them (loaded, undone, changed elsewhere). */
  apply: (tables: BaseTable[]) => void
  onStatus?: (status: BaseSyncStatus) => void
  onError?: (error: { table: string; action: 'insert' | 'update' | 'delete' | 'load'; message: string }) => void
}

const clone = (r: Row): Row => {
  const out: Row = {}
  for (const [k, v] of Object.entries(r)) out[k] = Array.isArray(v) ? [...v] : v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v
  return out
}
const same = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if ((a == null || a === '') && (b == null || b === '')) return true
  if (Array.isArray(a) || Array.isArray(b) || (a && typeof a === 'object') || (b && typeof b === 'object')) return JSON.stringify(a ?? []) === JSON.stringify(b ?? [])
  return false
}

/** Whether a link field is the one worked out from the other side (that side stores the pairs). */
function derivedLink(tables: BaseTable[], def: Def): boolean {
  const inverse = def.fieldProps?.inverse
  if (!inverse) return false
  const other = tables.find((t) => t.id === def.fieldProps?.table)
  const otherDef = other?.columns.find((d) => colId(d) === inverse)
  const otherField = otherDef ? String(otherDef.field ?? colId(otherDef)) : ''
  return !!other?.source?.links?.[otherField]
}

/** The fields of a table its source writes. */
function storedFields(tables: BaseTable[], t: BaseTable): string[] {
  const src = t.source!
  return t.columns
    .filter((d) => d.field != null && !COMPUTED.has(d.fieldType) && !src.skip.has(String(d.field)))
    .filter((d) => !(d.fieldType === 'link' && !src.links[String(d.field)] && derivedLink(tables, d)))
    .map((d) => String(d.field))
}

export function createBaseSync(options: BaseSyncOptions) {
  // What the database holds, per table, by the record's page id.
  const synced = new Map<string, Map<string, Row>>()
  // Page id <-> database id, per table, for records the database gave its own id.
  const toServerIds = new Map<string, Map<string, string>>()
  const toLocalIds = new Map<string, Map<string, string>>()
  const pendingInsert = new Set<string>()
  const stops: Array<() => void> = []
  let queue: Promise<void> = Promise.resolve()
  let pending = 0
  // The last failed write: the status keeps saying so until a write goes through.
  let failure: BaseSyncStatus | null = null
  let disposed = false
  const status = (s: BaseSyncStatus) => options.onStatus?.(s)

  const ids = {
    toServer: (table: string, id: string) => toServerIds.get(table)?.get(id) ?? id,
    toLocal: (table: string, id: string) => toLocalIds.get(table)?.get(id) ?? id,
  }
  const key = (table: string, id: string) => `${table}:${id}`

  function wire(t: BaseTable) {
    const src = t.source!
    src.ids = ids
    const linkTables = (src as BaseSource & { linkTables?: Map<string, string> }).linkTables
    if (linkTables) for (const d of t.columns) if (d.fieldType === 'link' && d.fieldProps?.table) linkTables.set(String(d.field), String(d.fieldProps.table))
  }

  /** Records read from a source, with database ids turned into page ids. */
  async function read(t: BaseTable): Promise<Row[]> {
    const rows = await t.source!.load()
    const linkTo = new Map(t.columns.filter((d) => d.fieldType === 'link').map((d) => [String(d.field), String(d.fieldProps?.table ?? '')]))
    return rows.map((r) => {
      const row: Row = { ...r, id: ids.toLocal(t.id, String(r.id)) }
      for (const [field, table] of linkTo) if (field in row && Array.isArray(row[field])) row[field] = (row[field] as string[]).map((x) => ids.toLocal(table, x))
      return row
    })
  }

  /** Fill in the fields that link back to a table from its rows. */
  function linkBack(list: BaseTable[], tableId: string): BaseTable[] {
    let next = list
    const t = next.find((x) => x.id === tableId)
    for (const d of t?.columns ?? []) if (d.fieldType === 'link' && d.fieldProps?.inverse && t?.source?.links[String(d.field)]) next = syncInverse(next, tableId, colId(d))
    return next
  }

  /** Load every table that has a source, then fill in the fields that link back. */
  async function load(): Promise<void> {
    const list = options.getTables() ?? []
    const withSource = list.filter((t) => t.source)
    if (!withSource.length) return
    status({ state: 'loading' })
    for (const t of withSource) wire(t)
    const loaded = new Map<string, Row[]>()
    for (const t of withSource) {
      try {
        const rows = await read(t)
        loaded.set(t.id, rows)
        if (rows.length >= t.source!.limit) status({ state: 'limited', table: t.name, limit: t.source!.limit })
      } catch (e) {
        failure = report(t, 'load', e)
      }
    }
    if (disposed) return
    let next = (options.getTables() ?? []).map((t) => (loaded.has(t.id) ? { ...t, data: loaded.get(t.id)! } : t))
    for (const t of withSource) next = linkBack(next, t.id)
    for (const t of next) if (loaded.has(t.id)) remember(next, t)
    options.apply(next)
    for (const t of withSource) {
      const stop = t.source!.subscribe?.(() => refresh(t.id))
      if (stop) stops.push(stop)
    }
    if (pending === 0) status(failure ?? { state: 'idle' })
  }

  function remember(list: BaseTable[], t: BaseTable) {
    const fields = storedFields(list, t)
    const map = new Map<string, Row>()
    for (const r of t.data) if (r) map.set(rowIdOf(t, r), pick(r, fields))
    synced.set(t.id, map)
  }
  const pick = (r: Row, fields: string[]): Row => {
    const out: Row = {}
    for (const f of fields) if (f in r) out[f] = Array.isArray(r[f]) ? [...(r[f] as unknown[])] : r[f] && typeof r[f] === 'object' ? clone({ v: r[f] }).v : r[f]
    return out
  }

  /** Compare the tables with what the database holds, and queue what differs. */
  function push(list: BaseTable[] | undefined) {
    if (!list || disposed) return
    for (const t of list) {
      const before = synced.get(t.id)
      if (!t.source || !before) continue
      const fields = storedFields(list, t)
      const seen = new Set<string>()
      for (const r of t.data) {
        if (!r) continue
        const id = rowIdOf(t, r)
        seen.add(id)
        const was = before.get(id)
        if (!was) {
          if (pendingInsert.has(key(t.id, id))) continue
          const row = pick(r, fields)
          before.set(id, row)
          pendingInsert.add(key(t.id, id))
          enqueue(t, 'insert', id, async () => {
            const stored = await t.source!.insert({ ...row, id })
            const dbId = String(stored.id ?? id)
            if (dbId !== id) {
              const out = toServerIds.get(t.id) ?? new Map()
              out.set(id, dbId)
              toServerIds.set(t.id, out)
              const inn = toLocalIds.get(t.id) ?? new Map()
              inn.set(dbId, id)
              toLocalIds.set(t.id, inn)
            }
            pendingInsert.delete(key(t.id, id))
          }, () => {
            pendingInsert.delete(key(t.id, id))
            before.delete(id)
            undo(t.id, (rows) => rows.filter((x) => x && rowIdOf(t, x) !== id))
          })
          continue
        }
        const patch: Row = {}
        for (const f of fields) if (!same(r[f], was[f])) patch[f] = Array.isArray(r[f]) ? [...(r[f] as unknown[])] : r[f]
        if (!Object.keys(patch).length) continue
        const prev = { ...was }
        Object.assign(was, pick(patch, Object.keys(patch)))
        enqueue(t, 'update', id, () => t.source!.update(ids.toServer(t.id, id), patch, prev), () => {
          Object.assign(was, prev)
          undo(t.id, (rows) => rows.map((x) => (x && rowIdOf(t, x) === id ? { ...x, ...pick(prev, Object.keys(patch)) } : x)))
        })
      }
      for (const [id, was] of [...before]) {
        if (seen.has(id)) continue
        before.delete(id)
        enqueue(t, 'delete', id, () => t.source!.remove(ids.toServer(t.id, id), was), () => {
          before.set(id, was)
          undo(t.id, (rows) => [...rows, { ...was, id }])
        })
      }
    }
  }

  function enqueue(t: BaseTable, action: 'insert' | 'update' | 'delete', _id: string, run: () => Promise<void>, rollback: () => void) {
    pending += 1
    status({ state: 'saving', pending })
    queue = queue.then(async () => {
      if (disposed) return
      try {
        await run()
        failure = null
      } catch (e) {
        rollback()
        failure = report(t, action, e)
      } finally {
        pending -= 1
        if (pending === 0 && !disposed) status(failure ?? { state: 'idle' })
        else if (!disposed) status({ state: 'saving', pending })
      }
    })
  }

  function report(t: BaseTable, action: 'insert' | 'update' | 'delete' | 'load', e: unknown): BaseSyncStatus {
    const message = e instanceof Error ? e.message : String(e)
    const s: BaseSyncStatus = { state: 'error', message, table: t.name }
    status(s)
    options.onError?.({ table: t.name, action, message })
    return s
  }

  /** Put a table's rows back as the database has them, without writing. */
  function undo(tableId: string, change: (rows: Row[]) => Row[]) {
    const list = options.getTables()
    if (!list) return
    let next = list.map((t) => (t.id === tableId ? { ...t, data: change(t.data) } : t))
    next = linkBack(next, tableId)
    options.apply(next)
  }

  // Changes made elsewhere: read the table again and take what moved.
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  function refresh(tableId: string) {
    clearTimeout(timers.get(tableId))
    timers.set(tableId, setTimeout(() => void reload(tableId), 120))
  }
  async function reload(tableId: string) {
    const t0 = options.getTables()?.find((t) => t.id === tableId)
    if (!t0?.source || disposed) return
    // Our own writes first: what they changed is already in the page.
    await queue
    let rows: Row[]
    try {
      rows = await read(t0)
    } catch (e) {
      report(t0, 'load', e)
      return
    }
    const list = options.getTables()
    const t = list?.find((x) => x.id === tableId)
    const before = synced.get(tableId)
    if (!list || !t || !before || disposed) return
    const fields = storedFields(list, t)
    const fresh = new Map(rows.map((r) => [String(r.id), r]))
    let changed = false
    const data: Row[] = []
    for (const r of t.data) {
      if (!r) continue
      const id = rowIdOf(t, r)
      const server = fresh.get(id)
      if (!server) {
        if (pendingInsert.has(key(tableId, id))) data.push(r)
        else {
          before.delete(id)
          changed = true
        }
        continue
      }
      fresh.delete(id)
      const moved = fields.filter((f) => f in server && !same(server[f], before.get(id)?.[f]))
      if (moved.length) {
        changed = true
        const next = { ...r }
        for (const f of moved) next[f] = server[f]
        before.set(id, { ...before.get(id), ...pick(server, moved) })
        data.push(next)
      } else data.push(r)
    }
    for (const [id, r] of fresh) {
      changed = true
      before.set(id, pick(r, fields))
      data.push(r)
    }
    if (!changed) return
    let next = list.map((x) => (x.id === tableId ? { ...x, data } : x))
    next = linkBack(next, tableId)
    options.apply(next)
  }

  return {
    load,
    push,
    /** Read a table again now (after a change you know of). */
    refresh,
    /** Resolves when every queued write has finished. */
    settled: () => queue,
    dispose() {
      disposed = true
      for (const stop of stops) stop()
      for (const t of timers.values()) clearTimeout(t)
    },
  }
}
