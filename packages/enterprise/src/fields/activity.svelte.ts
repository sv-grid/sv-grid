/**
 * A record's activity, as the expanded record shows it: the changes made to
 * it in this session (who changed which field to what, and when) and its
 * comments. Comments live in memory unless the app hands over a store of its
 * own (`setRecordComments`) that saves them.
 *
 * In a grid of `<SvBase tables>` both are kept by table id and row id, so
 * they outlive the grid (switching tables draws a new one) and two tables
 * with the same row ids keep apart. A plain grid keeps them per grid.
 */
import { getCurrentUser } from './sources.svelte'

export type RecordComment = {
  id: string
  rowId: string
  /** The table of `<SvBase tables>` the record is in. */
  tableId?: string
  text: string
  at: number
  by?: string
}

/** Which record a comment store is asked about, beyond its row id. */
export type RecordCommentContext = {
  /** The table of `<SvBase tables>` the record is in; undefined for a single table or a plain grid. */
  tableId?: string
  /** The grid's api. */
  api: unknown
}

/** Where comments are kept: the app's backend, or memory by default. */
export type RecordCommentStore = {
  list: (rowId: string, api: unknown, context: RecordCommentContext) => ReadonlyArray<RecordComment>
  add: (rowId: string, comment: RecordComment, api: unknown, context: RecordCommentContext) => void
}

export type RecordChange = {
  at: number
  /** The signed-in user who made it; undefined when nobody was signed in. */
  by?: string
  /** The automation that made it, by name. */
  automation?: string
  /** Made elsewhere (another user, a script, an agent) and read from the database. */
  remote?: boolean
  /** The record was added elsewhere: one entry, with no field. */
  added?: boolean
  columnId: string
  value: unknown
  /** What the field held before, when known (a change made elsewhere). */
  from?: unknown
}

/**
 * A record someone else changed that nobody here has looked at yet: the
 * cells that moved are tinted and the row header shows a dot until the record
 * is opened, or `markAllSeen` runs.
 */
export type UnseenChange = {
  at: number
  /** Who changed it, when the record says (its "last modified by" field). */
  by?: string
  /** The column ids that changed. */
  columns: ReadonlySet<string>
  /** Added elsewhere: the whole record is new. */
  added?: boolean
}

// Bumped on every change so the panel redraws.
let version = $state(0)
// Per base (each `<SvBase>` hands its grids its own `baseScope` object), then
// per table id: two bases on one page with the same table ids keep their own.
type Kept<T> = { bases: WeakMap<object, Map<string, Map<string, T[]>>>; grids: WeakMap<object, Map<string, T[]>> }
const changes: Kept<RecordChange> = { bases: new WeakMap(), grids: new WeakMap() }
const memory: Kept<RecordComment> = { bases: new WeakMap(), grids: new WeakMap() }
// One entry per record at most: its unseen change, merged as more arrive.
const unseen: Kept<UnseenChange> = { bases: new WeakMap(), grids: new WeakMap() }
// The base of a table named by id alone.
const ANY_BASE = {}
let store: RecordCommentStore | null = null

/** A grid, or a table of a base named by id (an automation's change). */
export type ActivityScope = object | string | { base?: object; tableId: string }

/** The table id a grid of `<SvBase tables>` carries; undefined for any other grid. */
export function tableIdOf(ctrl: any): string | undefined {
  const id = ctrl?.props?.baseTableId
  return typeof id === 'string' && id ? id : undefined
}

/** The records' lists for a grid, or for a table of a base. */
function rowsOf<T>(kept: Kept<T>, scope: ActivityScope, create: boolean): Map<string, T[]> | undefined {
  const named = typeof scope === 'string' ? { tableId: scope } : 'tableId' in scope && typeof scope.tableId === 'string' ? (scope as { base?: object; tableId: string }) : null
  const tableId = named ? named.tableId : tableIdOf(scope)
  if (!tableId) {
    let byRow = kept.grids.get(scope as object)
    if (!byRow && create) kept.grids.set(scope as object, (byRow = new Map()))
    return byRow
  }
  const base: object = (named ? named.base : (scope as any)?.props?.baseScope) ?? ANY_BASE
  let byTable = kept.bases.get(base)
  if (!byTable && create) kept.bases.set(base, (byTable = new Map()))
  let byRow = byTable?.get(tableId)
  if (!byRow && byTable && create) byTable.set(tableId, (byRow = new Map()))
  return byRow
}

/** Keep comments in the app's store (null: back to memory). */
export function setRecordComments(next: RecordCommentStore | null): void {
  store = next
  version += 1
}

/**
 * Note a change to a cell (called after every edit, paste, fill and clear).
 * `scope` is the grid, or the table (its base and id) for a change made
 * outside it (an automation). `automation` names the automation that made it.
 */
export function noteChange(scope: ActivityScope, rowId: string, columnId: string, value: unknown, automation?: string): void {
  const byRow = rowsOf(changes, scope, true)!
  const list = byRow.get(rowId) ?? []
  // Kept short: the panel shows the latest.
  list.push({ at: Date.now(), ...(automation ? { automation } : { by: getCurrentUser()?.id }), columnId, value: Array.isArray(value) ? [...value] : value })
  if (list.length > 50) list.splice(0, list.length - 50)
  byRow.set(rowId, list)
  version += 1
}

export function changesOf(scope: ActivityScope, rowId: string): ReadonlyArray<RecordChange> {
  void version
  return rowsOf(changes, scope, false)?.get(rowId) ?? []
}

/**
 * Note a change made elsewhere and read from the database: an activity entry
 * per field (with what it held before), credited to `by`, and the record
 * marked unseen. `added` notes a record added elsewhere.
 */
export function noteRemoteChange(
  scope: ActivityScope,
  rowId: string,
  change: { by?: string; added?: boolean; fields?: ReadonlyArray<{ columnId: string; from: unknown; to: unknown }> },
): void {
  const at = Date.now()
  const fields = change.fields ?? []
  if (!change.added && !fields.length) return
  const byRow = rowsOf(changes, scope, true)!
  const list = byRow.get(rowId) ?? []
  const by = change.by ? { by: change.by } : {}
  if (change.added) list.push({ at, ...by, remote: true, added: true, columnId: '', value: undefined })
  for (const f of fields) list.push({ at, ...by, remote: true, columnId: f.columnId, value: copy(f.to), from: copy(f.from) })
  if (list.length > 50) list.splice(0, list.length - 50)
  byRow.set(rowId, list)

  const marks = rowsOf(unseen, scope, true)!
  const was = marks.get(rowId)?.[0]
  const columns = new Set([...(was?.columns ?? []), ...fields.map((f) => f.columnId)])
  marks.set(rowId, [{ at, ...by, columns, ...(change.added || was?.added ? { added: true } : {}) }])
  version += 1
}
const copy = (v: unknown) => (Array.isArray(v) ? [...v] : v)

/** The record's change made elsewhere that nobody here has seen, if any. */
export function unseenOf(scope: ActivityScope, rowId: string): UnseenChange | undefined {
  void version
  return rowsOf(unseen, scope, false)?.get(rowId)?.[0]
}

/** Every unseen record of a grid or table, by row id. */
export function unseenIn(scope: ActivityScope): ReadonlyMap<string, UnseenChange> {
  void version
  const out = new Map<string, UnseenChange>()
  for (const [id, list] of rowsOf(unseen, scope, false) ?? []) if (list[0]) out.set(id, list[0])
  return out
}

/** The record was looked at: its cells and row header go back to normal. */
export function markSeen(scope: ActivityScope, rowId: string): void {
  const marks = rowsOf(unseen, scope, false)
  if (marks?.delete(rowId)) version += 1
}

/** Every record of a grid or table was looked at. */
export function markAllSeen(scope: ActivityScope): void {
  const marks = rowsOf(unseen, scope, false)
  if (marks?.size) {
    marks.clear()
    version += 1
  }
}

const contextOf = (ctrl: any): RecordCommentContext => ({ tableId: tableIdOf(ctrl), api: ctrl?.buildApi?.() })

export function commentsOf(ctrl: any, rowId: string): ReadonlyArray<RecordComment> {
  void version
  if (store) {
    const context = contextOf(ctrl)
    return store.list(rowId, context.api, context)
  }
  return rowsOf(memory, ctrl, false)?.get(rowId) ?? []
}

let seq = 0
export function addComment(ctrl: any, rowId: string, text: string): void {
  const body = text.trim()
  if (!body) return
  const context = contextOf(ctrl)
  const comment: RecordComment = {
    id: `c${Date.now().toString(36)}${(seq += 1)}`,
    rowId,
    ...(context.tableId ? { tableId: context.tableId } : {}),
    text: body,
    at: Date.now(),
    by: getCurrentUser()?.id,
  }
  if (store) store.add(rowId, comment, context.api, context)
  else {
    const byRow = rowsOf(memory, ctrl, true)!
    byRow.set(rowId, [...(byRow.get(rowId) ?? []), comment])
  }
  version += 1
}

/** "just now", "5 minutes ago", "3 hours ago", else the date. */
export function timeAgo(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  return new Date(at).toLocaleDateString()
}
