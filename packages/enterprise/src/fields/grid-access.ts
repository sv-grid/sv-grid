/**
 * What the fields module's own surfaces (the view bar, the gallery and form
 * views, a board view's moves) need from a grid: the grid behind an api, the
 * data columns with their types, the primary field, and a way to write a
 * value that goes through the grid's edit path.
 */

import { getAdvancedFilterEngine } from '@svgrid/grid'

/** A data column as the fields surfaces see it. */
export type FieldColumn = {
  id: string
  field: string
  header: string
  fieldType?: string
  /** The column as filled in (formatter, editor, fieldProps). */
  def: Record<string, any>
  visible: boolean
}

// The grid behind each api object (the grid keeps one api per grid).
const grids = new WeakMap<object, any>()

/** Called on every draw of a grid with fields turned on. */
export function rememberGrid(ctrl: any): void {
  const api = ctrl?.buildApi?.()
  if (api && !grids.has(api)) grids.set(api, ctrl)
}

/** The grid an api belongs to; undefined until that grid has drawn once. */
export function gridOf(api: unknown): any {
  return api && typeof api === 'object' ? grids.get(api) : undefined
}

export const columnIdOf = (def: Record<string, any>): string => String(def.id ?? def.field ?? '')

/** Every data column (declared ones with a field), in screen order, hidden ones last. */
export function fieldColumns(ctrl: any): FieldColumn[] {
  const hidden = (ctrl?.hiddenColumns ?? {}) as Record<string, boolean>
  const declared = leaves((ctrl?.internalColumns ?? []) as Array<Record<string, any>>).filter((d) => d.field != null)
  const byId = new Map(declared.map((d) => [columnIdOf(d), d]))
  const shownOrder = ((ctrl?.allColumns ?? []) as Array<{ id: string }>).map((c) => c.id).filter((id) => byId.has(id))
  const rest = declared.map(columnIdOf).filter((id) => !shownOrder.includes(id))
  return [...shownOrder, ...rest].map((id) => {
    const def = byId.get(id)!
    return {
      id,
      field: String(def.field),
      header: typeof def.header === 'string' ? def.header : id,
      fieldType: def.fieldType,
      def,
      visible: !hidden[id] && def.visible !== false && shownOrder.includes(id),
    }
  })
}

function leaves(cols: ReadonlyArray<Record<string, any>>): Array<Record<string, any>> {
  return cols.flatMap((c) => (Array.isArray(c.columns) && c.columns.length ? leaves(c.columns) : [c]))
}

/** The primary field's column id: the `primaryField` prop, matched by id or field. */
export function primaryIdOf(ctrl: any): string | null {
  const p = ctrl?.props?.primaryField
  if (typeof p !== 'string' || !p) return null
  const cols = leaves((ctrl?.internalColumns ?? []) as Array<Record<string, any>>)
  const hit = cols.find((d) => columnIdOf(d) === p) ?? cols.find((d) => d.field === p)
  return hit ? columnIdOf(hit) : null
}

/**
 * Write a value the way an edit in the cell does (undo, validation,
 * onCellValueChange, last-modified fields). False when the row is not shown
 * or the cell cannot be edited.
 */
export function writeCell(ctrl: any, rowId: string, columnId: string, value: unknown): boolean {
  const at = ((ctrl?.allRows ?? []) as Array<{ id: string }>).findIndex((r) => r.id === rowId)
  if (at < 0 || !ctrl.startEditing?.(at, columnId)) return false
  ctrl.updateEditingCellValue(value)
  ctrl.saveEditingCell()
  return true
}

/** A row's value for a column, through the grid's edit overlay (as the cells read it). */
export function cellValue(ctrl: any, row: { id: string; getCellValueByColumnId?: (id: string) => unknown; original?: any }, column: FieldColumn): unknown {
  const base = row.getCellValueByColumnId ? row.getCellValueByColumnId(column.id) : row.original?.[column.field]
  return ctrl?.getCellDisplayValue ? ctrl.getCellDisplayValue(row.id, column.id, base) : base
}

/** A value as its cell writes it as text (the column's formatter), for titles and search. */
export function cellText(column: FieldColumn, value: unknown, row?: unknown): string {
  const f = column.def.formatter as ((x: { value: unknown; row: unknown; column: unknown }) => unknown) | undefined
  if (f) {
    try {
      return String(f({ value, row, column: { id: column.id, columnDef: column.def } }) ?? '')
    } catch {
      /* fall through to the raw value */
    }
  }
  if (Array.isArray(value)) return value.map((v) => (v && typeof v === 'object' ? ((v as any).name ?? '') : String(v))).join(', ')
  return value == null ? '' : String(value)
}

export type GridRow = { id: string; original: Record<string, unknown>; getCellValueByColumnId?: (id: string) => unknown }

/** The rows the grid shows, filtered and sorted, without group header rows. */
export function dataRows(ctrl: any): GridRow[] {
  return ((ctrl?.allRows ?? []) as Array<GridRow & { __treeRow?: boolean; getCanExpand?: () => boolean }>).filter(
    (r) => r.__treeRow || !(typeof r.getCanExpand === 'function' && r.getCanExpand()),
  )
}

type TreeRow = { subRows?: TreeRow[]; getCanExpand?: () => boolean; __treeRow?: boolean }
const isBanner = (r: TreeRow) => !r.__treeRow && typeof r.getCanExpand === 'function' && r.getCanExpand()

/**
 * The grid's advanced filter as a test of one record, or null when nothing
 * filters. The grid filters after it groups, so a group's own rows still hold
 * the records the filter hides; this is how a group header leaves them out.
 */
export function leafFilter(ctrl: any): ((row: unknown) => boolean) | null {
  const expr = ctrl?.advancedFilter
  const engine = expr ? getAdvancedFilterEngine() : null
  if (!engine) return null
  try {
    return (engine(expr, { getValue: ctrl.getRowColumnValue, rows: [] } as never) as ((row: unknown) => boolean) | null) ?? null
  } catch {
    return null
  }
}

/** The records under a group row, those the filter keeps. */
export function groupLeaves<TRow extends TreeRow>(row: TRow, keep: ((row: unknown) => boolean) | null): TRow[] {
  const out: TRow[] = []
  const walk = (r: TreeRow) => {
    for (const s of r.subRows ?? []) {
      if (isBanner(s)) walk(s)
      else if (!keep || keep(s)) out.push(s as TRow)
    }
  }
  walk(row)
  return out
}
