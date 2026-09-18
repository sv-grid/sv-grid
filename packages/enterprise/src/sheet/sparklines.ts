/**
 * Sparklines: Excel's tiny chart drawn INSIDE a cell, one per row (or per
 * column) of a block of numbers.
 *
 * Excel keeps them as a group rather than as one chart per cell: a data
 * range, a location range of the same shape, and the settings the whole
 * group shares (the kind, the colours, whether every line is drawn on one
 * scale). That is what this keeps, because it is also what the user edits:
 * changing the kind changes the group, and clearing one clears the group.
 *
 * A sparkline is not an object (`objects.ts`): it has no anchor and no size
 * of its own, it IS the cell, so it moves and dies with the cells the way a
 * conditional format does. Its data is read live from the range, so editing
 * a number redraws it.
 */
import type { Rect } from './format-store'
import type { StructuralEdit } from './refs'
import { shiftRect, rectContains } from './rects'
import type { CellValue } from './ast'
// The geometry only, through the grid's own subpath: this module is read by
// the xlsx writer and by tests that run without a DOM, and the package root
// would drag every component in with it.
import { buildSparkline } from '@svgrid/grid/sparkline'

/** The three Excel offers: Line, Column and Win/Loss. */
export const SPARKLINE_TYPES = ['line', 'column', 'winloss'] as const
export type SheetSparklineType = (typeof SPARKLINE_TYPES)[number]

export type SparklineGroup = {
  id: string
  /** The cells the sparklines are drawn in: one row, or one column. */
  location: Rect
  /** The numbers they read, one line of it per location cell. */
  data: Rect
  type: SheetSparklineType
  /** The line or the positive bars. Defaults to the theme's accent. */
  color?: string
  /** The negative bars of a Column or Win/Loss group. */
  negativeColor?: string
  /** One value scale across the whole group, as Excel's "Same for All". */
  sameScale?: boolean
  /** A dot on the last point of a Line group. */
  markers?: boolean
}

let nextSparklineId = 1
/** An id no other group of this session carries. */
export const sparklineId = (): string => `spark-${Date.now().toString(36)}-${(nextSparklineId += 1).toString(36)}`

/** A copy safe to hand out or save. */
export function copySparkline(group: SparklineGroup): SparklineGroup {
  return { ...group, location: [...group.location] as unknown as Rect, data: [...group.data] as unknown as Rect }
}

/**
 * The group after an insert or delete: both rectangles move with their
 * cells. Null when the edit took every cell the group was drawn in, or
 * every cell it read.
 */
export function shiftSparkline(group: SparklineGroup, edit: StructuralEdit): SparklineGroup | null {
  const location = shiftRect(group.location, edit)
  if (!location) return null
  const data = shiftRect(group.data, edit)
  if (!data) return null
  return { ...copySparkline(group), location: location as Rect, data: data as Rect }
}

/** The groups of a sheet after an insert or delete, the gone ones dropped. */
export function shiftSparklines(groups: ReadonlyArray<SparklineGroup>, edit: StructuralEdit): SparklineGroup[] {
  return groups.map((g) => shiftSparkline(g, edit)).filter((g): g is SparklineGroup => g !== null)
}

/** True when the group draws down a column of cells rather than along a row. */
export function isColumnLocation(group: SparklineGroup): boolean {
  const [r1, c1, r2, c2] = group.location
  // A single cell counts as a column: its data is read as one line either way.
  return r2 - r1 >= c2 - c1
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
 * The numbers one location cell draws, read through `valueAt`. The nth cell
 * of the location reads the nth line of the data: the nth row when the
 * sparklines run down a column, the nth column when they run along a row.
 * A blank or a text cell inside the line is a gap, which Excel draws as a
 * zero rather than breaking the line.
 */
export function sparklineSeries(
  group: SparklineGroup,
  row: number,
  col: number,
  valueAt: (row: number, col: number) => CellValue,
): number[] | null {
  if (!rectContains(group.location, row, col)) return null
  const [lr1, lc1] = group.location
  const [dr1, dc1, dr2, dc2] = group.data
  const down = isColumnLocation(group)
  const index = down ? row - lr1 : col - lc1
  const values: number[] = []
  if (down) {
    const r = dr1 + index
    if (r > dr2) return null
    for (let c = dc1; c <= dc2; c += 1) values.push(numberOf(valueAt(r, c)) ?? 0)
  } else {
    const c = dc1 + index
    if (c > dc2) return null
    for (let r = dr1; r <= dr2; r += 1) values.push(numberOf(valueAt(r, c)) ?? 0)
  }
  return values.length ? values : null
}

/** The group drawn in a cell, or null: the last one wins, as Excel's does. */
/**
 * One line per cell of the group: the cell the sparkline is drawn in and
 * the block of numbers it reads.
 *
 * The drawing works this out cell by cell as it paints; a writer needs the
 * whole list, because Excel stores a sparkline group as one entry per cell
 * with its own reference.
 */
/**
 * A sparkline as standalone SVG markup, for a page the component cannot
 * draw on: the printed sheet.
 *
 * The geometry is the grid's own `buildSparkline`, so the printed line is
 * the line on screen rather than a second drawing that can disagree with
 * it. The markup carries its colours inline, since the print document has
 * no stylesheet of ours.
 */
export function sparklineSvg(
  values: ReadonlyArray<number>,
  options: {
    type?: SheetSparklineType
    width: number
    height: number
    color?: string
    negativeColor?: string
    min?: number
    max?: number
    markers?: boolean
  },
): string {
  const geo = buildSparkline([...values], {
    type: options.type === 'column' ? 'bar' : options.type === 'winloss' ? 'winloss' : 'line',
    width: options.width,
    height: options.height,
    ...(options.color ? { color: options.color } : {}),
    ...(options.negativeColor ? { negativeColor: options.negativeColor } : {}),
    ...(options.min !== undefined ? { min: options.min } : {}),
    ...(options.max !== undefined ? { max: options.max } : {}),
    lastPoint: Boolean(options.markers),
  })
  if (!geo) return ''
  const parts: string[] = []
  if (geo.bars.length) {
    for (const bar of geo.bars) {
      const fill = bar.negative ? geo.negativeColor : geo.color
      parts.push(`<rect x="${round(bar.x)}" y="${round(bar.y)}" width="${round(bar.w)}" height="${round(bar.h)}" fill="${fill}"/>`)
    }
  }
  if (geo.linePath) {
    parts.push(`<path d="${geo.linePath}" fill="none" stroke="${geo.color}" stroke-width="${geo.lineWidth}" stroke-linejoin="round" stroke-linecap="round"/>`)
  }
  if (geo.lastPoint && options.markers) {
    parts.push(`<circle cx="${round(geo.lastPoint.x)}" cy="${round(geo.lastPoint.y)}" r="${geo.lineWidth + 0.5}" fill="${geo.color}"/>`)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${geo.width}" height="${geo.height}" viewBox="0 0 ${geo.width} ${geo.height}" role="img" aria-hidden="true">${parts.join('')}</svg>`
}

const round = (n: number): number => Math.round(n * 100) / 100

export function sparklineLines(group: SparklineGroup): Array<{ row: number; col: number; data: Rect }> {
  const [lr1, lc1, lr2, lc2] = group.location
  const [dr1, dc1, dr2, dc2] = group.data
  const down = isColumnLocation(group)
  const out: Array<{ row: number; col: number; data: Rect }> = []
  const count = down ? lr2 - lr1 + 1 : lc2 - lc1 + 1
  for (let i = 0; i < count; i += 1) {
    if (down) {
      const r = dr1 + i
      if (r > dr2) break
      out.push({ row: lr1 + i, col: lc1, data: [r, dc1, r, dc2] as unknown as Rect })
    } else {
      const c = dc1 + i
      if (c > dc2) break
      out.push({ row: lr1, col: lc1 + i, data: [dr1, c, dr2, c] as unknown as Rect })
    }
  }
  return out
}

export function sparklineAt(groups: ReadonlyArray<SparklineGroup>, row: number, col: number): SparklineGroup | null {
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    if (rectContains(groups[i]!.location, row, col)) return groups[i]!
  }
  return null
}

/**
 * The scale a group is drawn on when every sparkline in it shares one, which
 * is Excel's "Same for All": the smallest and largest number anywhere in the
 * data range. Null when the group scales each sparkline on its own.
 */
export function sparklineScale(
  group: SparklineGroup,
  valueAt: (row: number, col: number) => CellValue,
): { min: number; max: number } | null {
  if (!group.sameScale) return null
  const [r1, c1, r2, c2] = group.data
  let min = Infinity
  let max = -Infinity
  for (let r = r1; r <= r2; r += 1) {
    for (let c = c1; c <= c2; c += 1) {
      const n = numberOf(valueAt(r, c))
      if (n === null) continue
      if (n < min) min = n
      if (n > max) max = n
    }
  }
  if (min === Infinity) return null
  return min === max ? { min: min - 1, max: max + 1 } : { min, max }
}

/**
 * Where Excel's Create Sparklines dialog opens: the data is the selected
 * block, and the location the column just past it (or the row just under it
 * when the block is a single row). A block one cell tall gets a location of
 * one cell, which is the common "a row of months, a sparkline beside it".
 */
export function sparklinesFromRange(data: Rect, type: SheetSparklineType = 'line'): SparklineGroup {
  const [r1, c1, r2, c2] = data
  const alongARow = r2 === r1 && c2 > c1
  const location: Rect = alongARow
    ? ([r1, c2 + 1, r1, c2 + 1] as unknown as Rect)
    : ([r1, c2 + 1, r2, c2 + 1] as unknown as Rect)
  return { id: sparklineId(), location, data: [r1, c1, r2, c2] as unknown as Rect, type, markers: type === 'line' }
}

/** The groups left after clearing every one the rectangles touch. */
export function clearSparklines(groups: ReadonlyArray<SparklineGroup>, rects: ReadonlyArray<Rect>): SparklineGroup[] {
  return groups.filter((g) => !rects.some((rect) => overlaps(g.location, rect)))
}

function overlaps(a: Rect, b: Rect): boolean {
  return !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1])
}
