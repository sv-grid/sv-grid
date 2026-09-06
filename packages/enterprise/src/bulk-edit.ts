/**
 * Bulk edit - set one or more fields across every selected row, as a single
 * undoable run. The engine half; `SvGridBulkEditDrawer.svelte` is the UI.
 *
 * Kept out of the component so it can be tested without mounting anything, and
 * so the rules below live in one readable place rather than inside markup.
 */

export type BulkEditField = {
  /** Column id, which is what the write is addressed by. */
  id: string
  /** Header text, or the column id when the header is not a plain string. */
  label: string
  /** The column's editor type, mapped to a form control by the drawer. */
  editorType: string
  /** Options for list / select style columns, when the column declares them. */
  options?: Array<{ value: unknown; label: string }>
}

/**
 * The columns a bulk edit can target.
 *
 * A column qualifies only if it is field-backed (there is somewhere to write
 * the value) and editable. `isCellEditable` is asked WITHOUT a row, which is
 * the column-level question - per-row rules are re-checked per cell at write
 * time, so a column that is editable for some rows still shows up here and
 * simply skips the rows that refuse it.
 */
export function bulkEditableFields(ctx: any): BulkEditField[] {
  const out: BulkEditField[] = []
  for (const column of ctx.allColumns ?? []) {
    const def = column?.columnDef
    if (!def?.field) continue
    if (def.editable === false) continue
    if (!ctx.isCellEditable(column)) continue
    // A snippet header has no text to put in a form label; the id is at least
    // stable and recognisable.
    const label = typeof def.header === 'string' && def.header ? def.header : column.id
    const raw = def.editorOptions
    const options = Array.isArray(raw)
      ? raw.map((o: any) =>
          o && typeof o === 'object' && 'value' in o
            ? { value: o.value, label: String(o.label ?? o.value) }
            : { value: o, label: String(o) },
        )
      : undefined
    out.push({ id: column.id, label, editorType: String(def.editorType ?? 'text'), options })
  }
  return out
}

/** Coerce a form control's raw output to what the column should store. */
export function coerceBulkValue(editorType: string, raw: unknown): unknown {
  if (editorType === 'checkbox') return Boolean(raw)
  if (editorType === 'number') {
    if (raw === '' || raw == null) return null
    const n = Number(raw)
    return Number.isNaN(n) ? null : n
  }
  return raw
}

/**
 * What each field should show when the drawer opens.
 *
 * A field where every selected row already agrees shows that shared value, so
 * the form reads as the current state rather than as empty. A field where they
 * differ shows nothing and is reported as `mixed` - the drawer labels it, and
 * leaving it alone leaves each row's own value intact. This is the answer to
 * "what does an untouched field mean" that makes multi-field bulk edit safe:
 * only fields the user actually changes are written.
 */
export function bulkEditInitialValues(
  ctx: any,
  fields: BulkEditField[],
): { values: Record<string, unknown>; mixed: Set<string> } {
  const values: Record<string, unknown> = {}
  const mixed = new Set<string>()
  const ids: string[] = ctx.selectionBarTarget?.ids ?? []
  const selected = new Set(ids)
  const rowIndexes: number[] = []
  ctx.allRows.forEach((row: any, i: number) => {
    if (selected.has(row.id)) rowIndexes.push(i)
  })

  for (const field of fields) {
    let first: unknown
    let seen = false
    let differs = false
    for (const rowIndex of rowIndexes) {
      const v = ctx.readCellRaw(rowIndex, field.id)
      if (!seen) {
        first = v
        seen = true
      } else if (v !== first) {
        differs = true
        break
      }
    }
    if (differs) {
      mixed.add(field.id)
      values[field.id] = field.editorType === 'checkbox' ? false : ''
    } else {
      values[field.id] = first ?? (field.editorType === 'checkbox' ? false : '')
    }
  }
  return { values, mixed }
}

export type BulkEditResult = {
  /** Cells actually changed. Skips rows already holding the value. */
  changed: number
  /** Cells the grid refused to write, e.g. a per-row `editable` rule. */
  skipped: number
  /** How many distinct fields were written. */
  fields: number
}

/**
 * Apply `edits` (columnId -> value) to every selected row.
 *
 * Every write goes through `writeCellRaw`, so `onCellValueChange` fires per
 * cell exactly as it does for a single edit. The undo steps for the WHOLE run -
 * across every field and every row - are appended together, so one bulk edit
 * walks back the way a paste does rather than leaving the user pressing Ctrl+Z
 * once per cell.
 */
export function applyBulkEdit(ctx: any, edits: Record<string, unknown>): BulkEditResult {
  const steps: Array<{
    rowId: string
    columnId: string
    field: string
    before: unknown
    after: unknown
  }> = []
  let skipped = 0
  let fieldsWritten = 0

  const ids: string[] = ctx.selectionBarTarget?.ids ?? []
  const selected = new Set(ids)
  // Resolve indexes in ONE pass rather than searching per row. `writeCellRaw`
  // swaps `internalData` on every call and `allRows` re-derives, so a per-row
  // `findIndex` would walk a freshly rebuilt array for every cell - O(rows x
  // selection) for a result that is already known. It would still be CORRECT,
  // because row ids are stable across the swap; it is just needless work.
  const targets: Array<{ rowIndex: number; rowId: string }> = []
  ctx.allRows.forEach((row: any, rowIndex: number) => {
    if (selected.has(row.id)) targets.push({ rowIndex, rowId: row.id })
  })

  for (const [columnId, value] of Object.entries(edits)) {
    const column = ctx.allColumns.find((c: any) => c.id === columnId)
    const field = column?.columnDef?.field
    if (!field) continue
    fieldsWritten += 1
    const colIndex = ctx.allColumns.indexOf(column)

    for (const { rowIndex, rowId } of targets) {
      if (!ctx.isCellEditableAt(rowIndex, colIndex)) {
        skipped += 1
        continue
      }
      const before = ctx.readCellRaw(rowIndex, columnId)
      if (before === value) continue
      ctx.writeCellRaw(rowIndex, columnId, value)
      steps.push({ rowId, columnId, field, before, after: value })
    }
  }

  if (steps.length) {
    let hist = ctx.history.slice(0, ctx.historyPtr + 1)
    for (const step of steps) hist.push(step)
    if (hist.length > ctx.UNDO_LIMIT) hist = hist.slice(hist.length - ctx.UNDO_LIMIT)
    ctx.history = hist
    ctx.historyPtr = ctx.history.length - 1
    ctx.historyVersion += 1
  }

  return { changed: steps.length, skipped, fields: fieldsWritten }
}
