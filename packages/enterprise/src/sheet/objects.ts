/**
 * Objects on a sheet: the things that float over the cells rather than
 * living in them. A chart drawn from a range, and a picture.
 *
 * Excel anchors an object to a cell and an offset inside it, and that is
 * what this keeps: the object moves when rows or columns are inserted
 * above or to the left of it, and goes when the cell it hangs from is
 * deleted. Its size is in pixels rather than a second anchor cell, so
 * resizing a column under a chart moves it without reshaping it, which is
 * Excel's "move but don't size with cells".
 *
 * A chart holds the range it reads rather than a copy of the numbers, so
 * editing a cell redraws it. `chartSpecOf` turns the range into the spec
 * `<SvChart>` takes, reading through whatever the caller supplies, which
 * is how the same function serves the shell and a test.
 */
import type { ChartSpec, ChartType } from '@svgrid/grid'
import type { Rect } from './format-store'
import type { StructuralEdit } from './refs'
import { shiftRect, lineShift } from './rects'
import { colToLetters } from './address'
import type { CellValue } from './ast'

/** Where an object hangs: a cell, an offset inside it, and a size in pixels. */
export type ObjectAnchor = {
  row: number
  col: number
  /** Offset from the cell's top-left corner, in pixels. */
  dx: number
  dy: number
  width: number
  height: number
}

/** The chart kinds the sheet offers, a subset of what `<SvChart>` draws. */
export const SHEET_CHART_TYPES = ['bar', 'line', 'area', 'pie', 'scatter'] as const
export type SheetChartType = (typeof SHEET_CHART_TYPES)[number]

export type SheetChartObject = {
  id: string
  kind: 'chart'
  anchor: ObjectAnchor
  /** The cells the chart reads, on the sheet it sits on. */
  range: Rect
  type: SheetChartType
  /** The range's first row holds the series labels, its first column the categories. */
  headers: boolean
  /** Each column of the range is a series (Excel's default), or each row. */
  series: 'columns' | 'rows'
  title?: string
  stacked?: boolean
}

export type SheetImageObject = {
  id: string
  kind: 'image'
  anchor: ObjectAnchor
  /** A `data:` or `http(s):` URL. The document carries it as it is. */
  src: string
  alt?: string
}

export type SheetObject = SheetChartObject | SheetImageObject

let nextObjectId = 1
/** An id no other object of this session carries. */
export const objectId = (): string => `obj-${Date.now().toString(36)}-${(nextObjectId += 1).toString(36)}`

/** A copy safe to hand out or save. */
export function copyObject(object: SheetObject): SheetObject {
  return object.kind === 'chart'
    ? { ...object, anchor: { ...object.anchor }, range: [...object.range] as unknown as Rect }
    : { ...object, anchor: { ...object.anchor } }
}

/**
 * The object after an insert or delete: its anchor cell moves with its
 * line and a chart's range moves with its cells. Null when the edit
 * deleted the cell it hangs from, or every cell a chart read.
 */
export function shiftObject(object: SheetObject, edit: StructuralEdit): SheetObject | null {
  const shift = lineShift(edit)
  const rows = edit.kind === 'insertRows' || edit.kind === 'deleteRows'
  const at = rows ? shift(object.anchor.row) : shift(object.anchor.col)
  if (at === null) return null
  const out = copyObject(object)
  out.anchor = { ...out.anchor, ...(rows ? { row: at } : { col: at }) }
  if (out.kind === 'chart') {
    const range = shiftRect(out.range, edit)
    if (!range) return null
    out.range = range as Rect
  }
  return out
}

/** The objects of a sheet after an insert or delete, the gone ones dropped. */
export function shiftObjects(objects: ReadonlyArray<SheetObject>, edit: StructuralEdit): SheetObject[] {
  return objects.map((o) => shiftObject(o, edit)).filter((o): o is SheetObject => o !== null)
}

/** The object at a point, topmost first: what a click on the layer hits. */
export function objectAt(
  objects: ReadonlyArray<SheetObject>,
  point: { x: number; y: number },
  boxOf: (object: SheetObject) => { left: number; top: number; width: number; height: number } | null,
): SheetObject | null {
  for (let i = objects.length - 1; i >= 0; i -= 1) {
    const box = boxOf(objects[i]!)
    if (!box) continue
    if (point.x >= box.left && point.x <= box.left + box.width && point.y >= box.top && point.y <= box.top + box.height) return objects[i]!
  }
  return null
}

/** A cell's value as a number, or null when it is not one. */
function numberOf(value: CellValue): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * The chart's spec, read from its range through `valueAt` (the computed
 * value) and `textAt` (what the cell shows, for the labels). A chart of a
 * range with no numbers in it draws nothing rather than throwing.
 */
export function chartSpecOf(
  object: SheetChartObject,
  valueAt: (row: number, col: number) => CellValue,
  textAt: (row: number, col: number) => string,
): ChartSpec {
  const [r1, c1, r2, c2] = object.range
  const byColumns = object.series === 'columns'
  // Along the series, and across each one.
  const seriesFrom = byColumns ? c1 : r1
  const seriesTo = byColumns ? c2 : r2
  const pointFrom = byColumns ? r1 : c1
  const pointTo = byColumns ? r2 : c2
  // With headers, the first line across is the labels and the first line
  // along is the categories.
  const firstSeries = object.headers ? seriesFrom + 1 : seriesFrom
  const firstPoint = object.headers ? pointFrom + 1 : pointFrom

  const cellAt = (s: number, p: number) => (byColumns ? { row: p, col: s } : { row: s, col: p })

  const categories: string[] = []
  for (let p = firstPoint; p <= pointTo; p += 1) {
    const at = cellAt(seriesFrom, p)
    const label = object.headers ? textAt(at.row, at.col) : ''
    categories.push(label.trim() === '' ? (byColumns ? String(p + 1) : colToLetters(p)) : label)
  }

  const series: ChartSpec['series'] = []
  for (let s = firstSeries; s <= seriesTo; s += 1) {
    const head = cellAt(s, pointFrom)
    const label = object.headers ? textAt(head.row, head.col) : ''
    const values: number[] = []
    let numeric = false
    for (let p = firstPoint; p <= pointTo; p += 1) {
      const at = cellAt(s, p)
      const n = numberOf(valueAt(at.row, at.col))
      if (n !== null) numeric = true
      values.push(n ?? 0)
    }
    if (!numeric) continue
    series.push({ label: label.trim() === '' ? (byColumns ? colToLetters(s) : String(s + 1)) : label, values })
  }

  return {
    type: object.type as ChartType,
    categories,
    series,
    ...(object.stacked ? { stacked: true } : {}),
  }
}

/**
 * A chart over a selected block, the way Insert > Chart guesses it: a
 * header row when the first row is text over numbers, series down the
 * columns, anchored just below the block.
 */
export function chartFromRange(
  range: Rect,
  valueAt: (row: number, col: number) => CellValue,
  anchor?: Partial<ObjectAnchor>,
): SheetChartObject {
  const [r1, c1, r2, c2] = range
  // A header row: the first row is text and the second has a number under it.
  let headers = false
  if (r2 > r1) {
    let text = 0
    let numbers = 0
    for (let c = c1; c <= c2; c += 1) {
      if (typeof valueAt(r1, c) === 'string' && String(valueAt(r1, c)).trim() !== '') text += 1
      if (numberOf(valueAt(r1 + 1, c)) !== null) numbers += 1
    }
    headers = text > 0 && numbers > 0
  }
  return {
    id: objectId(),
    kind: 'chart',
    anchor: { row: r2 + 1, col: c1, dx: 8, dy: 8, width: 420, height: 260, ...anchor },
    range: [r1, c1, r2, c2] as unknown as Rect,
    type: 'bar',
    headers,
    series: 'columns',
  }
}
