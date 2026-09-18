/**
 * A PivotTable over a range of cells: Excel's Insert > PivotTable, on the
 * pivot engine the grid already has (`pivot.ts`).
 *
 * The definition is what the sheet keeps: the source range (its first row
 * is the field names), where the result is written, and the row fields,
 * column fields and measures. The RESULT is plain cells, written into the
 * sheet like any other block, so every other part of the shell works on it
 * without knowing it came from a pivot: it can be formatted, filtered,
 * charted, printed and saved to an .xlsx. Refresh rebuilds the block from
 * the source, which is what a pivot over live cells owes the user.
 *
 * Everything here is pure: it reads cells through the callbacks it is
 * given, and returns the block of text to write.
 */
import type { Rect } from './format-store'
import type { StructuralEdit } from './refs'
import { shiftRect, lineShift } from './rects'
import { colToLetters } from './address'
import type { CellValue } from './ast'
import { createPivotModel, type PivotAggregatorId, type PivotRow } from '../pivot'
import type { TableFeatures } from '@svgrid/grid'

/** The aggregations Excel's Summarize Values By offers, as this sheet has them. */
export const SHEET_PIVOT_AGGS = ['sum', 'avg', 'count', 'countDistinct', 'min', 'max'] as const
export type SheetPivotAgg = (typeof SHEET_PIVOT_AGGS)[number]

export type SheetPivotValue = {
  /** A field name: one of the source's header cells. */
  field: string
  agg: SheetPivotAgg
  label?: string
}

export type SheetPivot = {
  id: string
  /** The source block, its first row the field names. */
  source: Rect
  /** The top-left cell of the written block, on the same sheet. */
  target: { row: number; col: number }
  /** Row fields, outermost first. */
  rows: string[]
  /** Column fields, outermost first. */
  cols: string[]
  values: SheetPivotValue[]
  grandTotalRow?: boolean
  grandTotalCol?: boolean
  rowSubtotals?: boolean
  /** The block the last refresh wrote, so the next one can clear it. */
  written?: Rect
}

let nextPivotId = 1
/** An id no other pivot of this session carries. */
export const pivotId = (): string => `pivot-${Date.now().toString(36)}-${(nextPivotId += 1).toString(36)}`

/** A copy safe to hand out or save. */
export function copyPivot(pivot: SheetPivot): SheetPivot {
  return {
    ...pivot,
    source: [...pivot.source] as unknown as Rect,
    target: { ...pivot.target },
    rows: [...pivot.rows],
    cols: [...pivot.cols],
    values: pivot.values.map((v) => ({ ...v })),
    ...(pivot.written ? { written: [...pivot.written] as unknown as Rect } : {}),
  }
}

/**
 * The pivot after an insert or delete: the source moves with its cells and
 * the target with its own. Null when the source is gone, or the cell the
 * result is written at is.
 */
export function shiftPivot(pivot: SheetPivot, edit: StructuralEdit): SheetPivot | null {
  const source = shiftRect(pivot.source, edit)
  if (!source) return null
  const shift = lineShift(edit)
  const rows = edit.kind === 'insertRows' || edit.kind === 'deleteRows'
  const at = rows ? shift(pivot.target.row) : shift(pivot.target.col)
  if (at === null) return null
  const out = copyPivot(pivot)
  out.source = source as Rect
  out.target = rows ? { ...out.target, row: at } : { ...out.target, col: at }
  if (out.written) {
    const written = shiftRect(out.written, edit)
    if (written) out.written = written as Rect
    else delete out.written
  }
  return out
}

/** The pivots of a sheet after an insert or delete, the gone ones dropped. */
export function shiftPivots(pivots: ReadonlyArray<SheetPivot>, edit: StructuralEdit): SheetPivot[] {
  return pivots.map((p) => shiftPivot(p, edit)).filter((p): p is SheetPivot => p !== null)
}

/**
 * The field names of a source range: its first row, with a blank header
 * named after its column the way Excel names an unnamed one.
 */
export function pivotFields(source: Rect, textAt: (row: number, col: number) => string): string[] {
  const [r1, c1, , c2] = source
  const out: string[] = []
  const seen = new Set<string>()
  for (let c = c1; c <= c2; c += 1) {
    let name = textAt(r1, c).trim() || `Column ${colToLetters(c)}`
    // Two columns with one name would collapse into one field.
    while (seen.has(name)) name = `${name} (${colToLetters(c)})`
    seen.add(name)
    out.push(name)
  }
  return out
}

/** The source's body as records keyed by field name, ready for the engine. */
export function pivotRecords(
  source: Rect,
  valueAt: (row: number, col: number) => CellValue,
  textAt: (row: number, col: number) => string,
): Array<Record<string, unknown>> {
  const [r1, c1, r2, c2] = source
  const fields = pivotFields(source, textAt)
  const out: Array<Record<string, unknown>> = []
  for (let r = r1 + 1; r <= r2; r += 1) {
    const record: Record<string, unknown> = {}
    let any = false
    for (let c = c1; c <= c2; c += 1) {
      const value = valueAt(r, c)
      record[fields[c - c1]!] = value === '' ? null : value
      if (value !== '') any = true
    }
    // A wholly empty row is a gap in the block, not a record.
    if (any) out.push(record)
  }
  return out
}

type ColumnNode = { id?: string; header?: unknown; columns?: ColumnNode[] }

/**
 * The column tree flattened for a sheet: one header row per level of the
 * tree, and the leaf ids in the order they are written. A header sits over
 * the leaves it covers, and its own cell is the leftmost of them, the way
 * Excel writes a merged group header without the merge.
 */
export function flattenPivotColumns(columns: ReadonlyArray<unknown>): {
  headerRows: string[][]
  leaves: Array<{ id: string; header: string }>
} {
  const nodes = columns as ColumnNode[]
  const depthOf = (list: ColumnNode[]): number =>
    list.reduce((deep, node) => Math.max(deep, node.columns?.length ? 1 + depthOf(node.columns) : 1), 0)
  const depth = depthOf(nodes)
  const headerRows: string[][] = Array.from({ length: depth }, () => [])
  const leaves: Array<{ id: string; header: string }> = []

  const walk = (list: ColumnNode[], level: number) => {
    for (const node of list) {
      const label = node.header === undefined || node.header === null ? '' : String(node.header)
      if (node.columns?.length) {
        const start = leaves.length
        walk(node.columns, level + 1)
        for (let i = start; i < leaves.length; i += 1) headerRows[level]![i] = i === start ? label : ''
      } else {
        leaves.push({ id: String(node.id ?? ''), header: label })
        const at = leaves.length - 1
        for (let l = level; l < depth - 1; l += 1) headerRows[l]![at] = ''
        headerRows[depth - 1]![at] = label
      }
    }
  }
  walk(nodes, 0)
  for (const row of headerRows) {
    for (let i = 0; i < leaves.length; i += 1) row[i] = row[i] ?? ''
  }
  return { headerRows, leaves }
}

/** A number without the float noise a sum of decimals leaves behind. */
function cellText(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return ''
    return String(Number(value.toPrecision(12)))
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return String(value)
}

/**
 * The block of text a pivot writes: the column headers, then one line per
 * pivot row, the row label indented by its depth the way Excel indents a
 * group under its parent.
 */
export function pivotBlock(
  pivot: SheetPivot,
  valueAt: (row: number, col: number) => CellValue,
  textAt: (row: number, col: number) => string,
): string[][] {
  return pivotLayout(pivot, valueAt, textAt).cells
}

/**
 * The block, and what each of its lines and columns stands for.
 *
 * `pivotBlock` writes the cells; drilling into one needs to know which
 * field values pin it, which is the same walk. Both come from here so they
 * cannot drift: a cell drawn from one layout and read from another would
 * open the wrong rows.
 */
export type PivotLayout = {
  cells: string[][]
  /** How many lines of `cells` are column headers. */
  headerCount: number
  /**
   * The row field values that pin each line, outermost first, aligned to
   * `cells`. Null for a header line; shorter than the pivot's row fields
   * for a group, a subtotal or the grand total, which pin fewer of them.
   */
  rowPaths: Array<string[] | null>
  /** The same for each column of `cells`. Null for the label column. */
  colPaths: Array<string[] | null>
}

export function pivotLayout(
  pivot: SheetPivot,
  valueAt: (row: number, col: number) => CellValue,
  textAt: (row: number, col: number) => string,
): PivotLayout {
  const empty: PivotLayout = { cells: [], headerCount: 0, rowPaths: [], colPaths: [] }
  if (!pivot.values.length) return empty
  const records = pivotRecords(pivot.source, valueAt, textAt)
  const result = createPivotModel<TableFeatures, Record<string, unknown>>(records, {
    rows: pivot.rows,
    cols: pivot.cols,
    values: pivot.values.map((v) => ({
      field: v.field,
      agg: v.agg as PivotAggregatorId,
      ...(v.label ? { label: v.label } : {}),
    })),
    grandTotalRow: pivot.grandTotalRow !== false,
    // With no column field the grand total column would repeat the only
    // measure column, which is not what Excel shows.
    grandTotalCol: pivot.cols.length ? pivot.grandTotalCol !== false : false,
    rowSubtotals: pivot.rowSubtotals !== false,
  })
  const { headerRows, leaves } = flattenPivotColumns(result.columns)
  // The engine's first column is the row-axis label; it is the block's own
  // first column here rather than one of the leaves.
  const label = leaves[0]?.id === '__pivotRowHeader' ? leaves.shift() : undefined
  const headerLabel = label?.header ?? ''
  const dropped = label ? 1 : 0

  const out: string[][] = headerRows.map((row, i) => [
    i === headerRows.length - 1 ? headerLabel : '',
    ...row.slice(dropped),
  ])
  // With one measure, the bottom header row is that measure's name under
  // every column, which says nothing the dialog has not. Drop it and let
  // the column values carry the corner label, as Excel's compact form does.
  if (pivot.values.length === 1 && out.length > 1) {
    const measures = out.pop()!
    out[out.length - 1]![0] = measures[0] ?? ''
  }
  const headerCount = out.length
  const rowPaths: Array<string[] | null> = Array.from({ length: headerCount }, () => null)

  // The row axis is a walk down a tree, and the model hands its rows out in
  // that order: a group before what is under it. Keeping the labels seen at
  // each depth is enough to know the path of the line being written, and
  // the label IS the value as the model grouped it, since it groups on the
  // text too.
  const stack: string[] = []
  for (const row of result.rows as PivotRow[]) {
    const indent = '    '.repeat(Math.max(0, row.__pivotDepth - 1))
    out.push([`${indent}${row.__pivotLabel}`, ...leaves.map((leaf) => cellText(row[leaf.id]))])
    const depth = Math.max(0, row.__pivotDepth)
    if (row.__pivotKind === 'grandTotal') {
      rowPaths.push([])
      continue
    }
    stack.length = depth
    if (depth > 0) stack[depth - 1] = row.__pivotLabel
    rowPaths.push([...stack])
  }

  // A column's path is the headers above it, with a group's label repeated
  // under it: `flattenPivotColumns` writes a group once, over its leftmost
  // leaf, the way Excel writes one.
  const levels = Math.min(pivot.cols.length, headerRows.length)
  const colPaths: Array<string[] | null> = [null]
  leaves.forEach((leaf, i) => {
    // The grand total column reads every record, and a sheet with no column
    // field has one column per measure, which is the same.
    if (leaf.id.includes('__total__m') || leaf.id.startsWith('pv__all__m')) { colPaths.push([]); return }
    const path: string[] = []
    for (let level = 0; level < levels; level += 1) {
      let value = ''
      for (let j = 0; j <= i + dropped; j += 1) {
        const cell = headerRows[level]?.[j]
        if (cell) value = cell
      }
      path.push(value)
    }
    colPaths.push(path)
  })

  return { cells: out, headerCount, rowPaths, colPaths }
}

/** The source rows behind one cell of a written pivot. */
export type PivotDrill = {
  /** The row and column field values that pin the cell, outermost first. */
  rowPath: string[]
  colPath: string[]
  /** The records behind it, in the source's own order. */
  records: Array<Record<string, unknown>>
  /** The source's fields, in its own order. */
  fields: string[]
}

/**
 * Excel's "show details": the rows behind the number in a pivot cell.
 *
 * `row` and `col` are a cell on the sheet, not a place in the block. Null
 * when the cell is outside the pivot, or is a header, or is the row label
 * column, none of which stand for a number.
 */
export function pivotDrill(
  pivot: SheetPivot,
  row: number,
  col: number,
  valueAt: (row: number, col: number) => CellValue,
  textAt: (row: number, col: number) => string,
): PivotDrill | null {
  const layout = pivotLayout(pivot, valueAt, textAt)
  if (!layout.cells.length) return null
  const line = row - pivot.target.row
  const column = col - pivot.target.col
  if (line < 0 || line >= layout.cells.length) return null
  if (column < 0 || column >= (layout.cells[line]?.length ?? 0)) return null
  const rowPath = layout.rowPaths[line]
  const colPath = layout.colPaths[column]
  if (!rowPath || !colPath) return null

  const records = pivotRecords(pivot.source, valueAt, textAt)
  const matches = records.filter((record) => {
    for (let i = 0; i < rowPath.length; i += 1) {
      const field = pivot.rows[i]
      if (field === undefined) return false
      if (String(record[field] ?? '') !== rowPath[i]) return false
    }
    for (let i = 0; i < colPath.length; i += 1) {
      const field = pivot.cols[i]
      if (field === undefined) return false
      if (String(record[field] ?? '') !== colPath[i]) return false
    }
    return true
  })
  return { rowPath: [...rowPath], colPath: [...colPath], records: matches, fields: pivotFields(pivot.source, textAt) }
}

/** The rectangle a block written at the target covers. */
export function pivotWrittenRect(pivot: SheetPivot, block: ReadonlyArray<ReadonlyArray<string>>): Rect {
  const height = Math.max(1, block.length)
  const width = Math.max(1, block.reduce((w, row) => Math.max(w, row.length), 0))
  const { row, col } = pivot.target
  return [row, col, row + height - 1, col + width - 1] as unknown as Rect
}

/**
 * Where Excel's Create PivotTable dialog opens: the source is the selected
 * block, and the result lands two columns past it, which keeps it clear of
 * the data it reads.
 */
export function pivotFromRange(source: Rect, fields: ReadonlyArray<string>): SheetPivot {
  const [r1, , , c2] = source
  return {
    id: pivotId(),
    source: [...source] as unknown as Rect,
    target: { row: r1, col: c2 + 2 },
    rows: fields.length ? [fields[0]!] : [],
    cols: [],
    values: fields.length > 1 ? [{ field: fields[fields.length - 1]!, agg: 'sum' }] : [],
  }
}
