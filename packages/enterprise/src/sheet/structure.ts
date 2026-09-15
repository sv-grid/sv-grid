/**
 * Insert and delete rows and columns, with every formula on the sheet
 * rewritten to follow.
 *
 * The api half already existed (`addRow`, `removeRow`, `addColumn`,
 * `removeColumn`). What was missing is the fixup pass: inserting a row above
 * `=SUM(D2:D11)` without widening the range silently produces the wrong total,
 * and deleting a referenced row leaves a formula pointing at whatever moved
 * into its place. Neither shows an error. That is why this waited for the
 * engine rather than shipping with the other shortcuts.
 *
 * A structural edit is three things in order:
 *   1. rewrite every formula in the sheet, and every defined name
 *   2. drop format entries for whatever the edit deletes
 *   3. apply the structural change itself
 *
 * Order matters: the first two read the OLD geometry.
 */
import type { GridCommandContext } from '@svgrid/grid/shortcuts'
import { fixupReferences, type StructuralEdit } from './refs'
import type { SheetNames } from './names'
import type { SheetFormatStore, CellAddressLookup } from './format-store'

/** What a structural command needs beyond the command context. */
export type StructureTarget = {
  /** Rewrite one cell's raw text. Called only for cells that changed. */
  setRaw(rowIndex: number, colIndex: number, text: string): void
  /** Read one cell's raw text, formula included. */
  getRaw(rowIndex: number, colIndex: number): string
  /** Apply the structural change to the data itself. */
  apply(edit: StructuralEdit): void
  /**
   * Set when `apply` rewrites the references itself. A Workbook does, across
   * every sheet, which is the whole reason a shell routes the edit through
   * it; rewriting here as well then moved every reference twice, so one
   * inserted row turned =SUM(A1:A3) into =SUM(A1:A5) and a cycle.
   */
  rewritesReferences?: boolean
  names?: SheetNames
  format?: { store: SheetFormatStore; lookup: CellAddressLookup }
  onChange?(): void
  /**
   * Everything a structural edit can touch, as one value, and the way to
   * put it back. Supplying both makes insert and delete ONE Ctrl+Z: the
   * command records the state before and after and hands the grid a step
   * that restores either. Without them the formula rewrites inside the
   * edit would sit in the history on their own, and undoing those while
   * the rows stayed inserted would leave the sheet inconsistent.
   */
  snapshot?(): unknown
  restore?(state: unknown): void
  /**
   * Whether the edit may happen at all. A protected sheet says no to every
   * insert and delete, as Excel's does; the ribbon greys Insert and Delete
   * on the same answer, so it must be cheap and must not talk to the user.
   */
  canApply?(edit: StructuralEdit): boolean
  /** Called when `canApply` refused an edit: the place to say why. */
  refused?(): void
}

let target: StructureTarget | null = null

/** Attach what the insert / delete commands operate on. */
export function setStructureTarget(next: StructureTarget | null): void {
  target = next
}

export function getStructureTarget(): StructureTarget | null {
  return target
}

/**
 * Rewrite every formula on the sheet for one structural edit.
 *
 * Walks the whole grid rather than consulting the dependency graph, because
 * the graph indexes what a formula READS and this needs every formula that
 * MENTIONS a moved coordinate, including ones whose precedents were never
 * resolved (a `#REF!` today may become valid after an insert).
 */
export function rewriteFormulas(
  cmd: GridCommandContext,
  t: StructureTarget,
  edit: StructuralEdit,
): number {
  let changed = 0
  for (let r = 0; r < cmd.rowCount; r += 1) {
    for (let c = 0; c < cmd.colCount; c += 1) {
      const text = t.getRaw(r, c)
      if (!text.startsWith('=')) continue
      const next = fixupReferences(text, edit)
      if (typeof next === 'string' && next !== text) {
        t.setRaw(r, c, next)
        changed += 1
      }
    }
  }
  if (t.names) {
    for (const entry of t.names.list()) {
      const next = fixupReferences(entry.refersTo, edit)
      if (typeof next === 'string' && next !== entry.refersTo) {
        t.names.define(entry.name, next)
        changed += 1
      }
    }
  }
  return changed
}

/**
 * Drop format entries for rows or columns the edit removes.
 *
 * Nothing needs SHIFTING. The store keys on row and column IDS, and an id
 * travels with the thing it names: inserting a column at B does not rename
 * what was B, it just puts a new id before it, so every existing entry still
 * points at the right cell. That is the payoff for keying on ids instead of
 * indices, and it is the same property that makes the store survive a sort.
 *
 * A DELETE is different: those ids are gone, and their entries would sit in
 * the map for the life of the session. Hence this.
 */
function forgetDeleted(
  t: StructureTarget,
  edit: StructuralEdit,
  cmd: GridCommandContext,
): void {
  const format = t.format
  if (!format) return
  const rows = edit.kind === 'deleteRows'
  const cols = edit.kind === 'deleteCols'
  if (!rows && !cols) return

  const limit = rows ? cmd.rowCount : cmd.colCount
  for (let i = edit.at; i < Math.min(edit.at + edit.count, limit); i += 1) {
    const id = rows ? format.lookup.rowIdAt(i) : format.lookup.columnIdAt(i)
    if (id === null) continue
    if (rows) format.store.forgetRow(id)
    else format.store.forgetColumn(id)
  }
}

function run(cmd: GridCommandContext, edit: StructuralEdit): boolean {
  const t = target
  if (!t) return false
  if (edit.count <= 0) return false
  if (t.canApply?.(edit) === false) {
    t.refused?.()
    return false
  }
  return cmd.batch(() => {
    const before = t.snapshot?.()
    // Order matters: the rewrite and the cleanup both read the OLD geometry.
    if (!t.rewritesReferences) rewriteFormulas(cmd, t, edit)
    forgetDeleted(t, edit, cmd)
    t.apply(edit)
    t.onChange?.()
    // Recorded LAST, so undo runs it first: the whole state comes back, and
    // the rewrite steps recorded above then re-apply their own "before"
    // texts, which the snapshot already holds. Redo runs them the other way
    // round to the same end.
    const restore = t.restore
    if (before !== undefined && restore) {
      const after = t.snapshot?.()
      cmd.recordUndo?.(
        () => { restore(before); t.onChange?.() },
        () => { restore(after); t.onChange?.() },
      )
    }
    return true
  })
}

/** The span the active selection covers, as whole rows or whole columns. */
function spanOf(
  cmd: GridCommandContext,
  axis: 'rows' | 'cols',
): { at: number; count: number } | null {
  const rect = cmd.ranges[cmd.ranges.length - 1]
  if (rect) {
    const [minRow, minCol, maxRow, maxCol] = rect
    return axis === 'rows'
      ? { at: minRow, count: maxRow - minRow + 1 }
      : { at: minCol, count: maxCol - minCol + 1 }
  }
  const active = cmd.activeCell
  if (!active) return null
  return axis === 'rows'
    ? { at: active.rowIndex, count: 1 }
    : { at: active.colIndex, count: 1 }
}

export function insertRows(cmd: GridCommandContext, at?: number, count = 1): boolean {
  const span = at === undefined ? spanOf(cmd, 'rows') : { at, count }
  if (!span) return false
  return run(cmd, { kind: 'insertRows', at: span.at, count: span.count })
}

export function deleteRows(cmd: GridCommandContext, at?: number, count = 1): boolean {
  const span = at === undefined ? spanOf(cmd, 'rows') : { at, count }
  if (!span) return false
  return run(cmd, { kind: 'deleteRows', at: span.at, count: span.count })
}

export function insertColumns(cmd: GridCommandContext, at?: number, count = 1): boolean {
  const span = at === undefined ? spanOf(cmd, 'cols') : { at, count }
  if (!span) return false
  return run(cmd, { kind: 'insertCols', at: span.at, count: span.count })
}

export function deleteColumns(cmd: GridCommandContext, at?: number, count = 1): boolean {
  const span = at === undefined ? spanOf(cmd, 'cols') : { at, count }
  if (!span) return false
  return run(cmd, { kind: 'deleteCols', at: span.at, count: span.count })
}

/**
 * Which axis a bare Ctrl+Plus / Ctrl+Minus acts on.
 *
 * Excel opens a dialog when the selection is not a whole row or column. That
 * dialog is a design decision, so this reports what it would ask about and
 * lets the consumer decide: a selection spanning every column is a row
 * operation, every row is a column operation, anything else is ambiguous.
 */
export function axisForSelection(cmd: GridCommandContext): 'rows' | 'cols' | 'ambiguous' {
  const rect = cmd.ranges[cmd.ranges.length - 1]
  if (!rect) return 'rows'
  const [minRow, minCol, maxRow, maxCol] = rect
  const spansAllCols = minCol === 0 && maxCol >= cmd.colCount - 1
  const spansAllRows = minRow === 0 && maxRow >= cmd.rowCount - 1
  if (spansAllCols && !spansAllRows) return 'rows'
  if (spansAllRows && !spansAllCols) return 'cols'
  if (spansAllCols && spansAllRows) return 'rows'
  return 'ambiguous'
}
