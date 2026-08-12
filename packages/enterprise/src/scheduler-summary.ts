/**
 * scheduler-summary - the pure core behind Scheduler Pro's *per-time-column
 * summary* strip (counts / sums / a custom roll-up aligned to the timeline axis).
 * No Svelte, no DOM. Each event is clipped to the column it falls in before the
 * reducer runs, so duration-based reducers (busy minutes) are per-column.
 */

const MS_MIN = 60_000

/** One event clipped to a column: its row plus the clipped [start, end). */
export type SummaryItem<TData> = { row: TData; start: Date; end: Date }

/**
 * How a column's overlapping events roll up to one cell value:
 *   - `'count'`  - number of events touching the column
 *   - `{ sum }`  - sum of a numeric row field over those events
 *   - function   - custom, receives the column-clipped items
 */
export type ColumnReducer<TData> =
  | 'count'
  | { sum: keyof TData & string }
  | ((items: SummaryItem<TData>[]) => string | number)

export type SummaryOptions<E, TData> = {
  startOf: (e: E) => Date
  endOf: (e: E) => Date
  rowOf: (e: E) => TData
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime()
}

/**
 * One summary value per column. For each column, collect the events overlapping
 * it, clip each to the column bounds, then apply `reducer`. Empty columns yield
 * `0` for `count` / `sum` and `reducer([])` for the function form.
 */
export function columnSummaries<E, TData>(
  events: ReadonlyArray<E>,
  columns: ReadonlyArray<{ start: Date; end: Date }>,
  reducer: ColumnReducer<TData>,
  opts: SummaryOptions<E, TData>,
): Array<string | number> {
  return columns.map((col) => {
    const items: SummaryItem<TData>[] = []
    for (const e of events) {
      const s = opts.startOf(e)
      const en = opts.endOf(e)
      if (!overlaps(s, en, col.start, col.end)) continue
      items.push({
        row: opts.rowOf(e),
        start: new Date(Math.max(s.getTime(), col.start.getTime())),
        end: new Date(Math.min(en.getTime(), col.end.getTime())),
      })
    }
    if (reducer === 'count') return items.length
    if (typeof reducer === 'function') return reducer(items)
    // { sum: field }
    const field = reducer.sum
    let total = 0
    for (const it of items) {
      const v = (it.row as Record<string, unknown>)[field as string]
      if (typeof v === 'number' && Number.isFinite(v)) total += v
    }
    return total
  })
}

/** Built-in reducer: sum a numeric row field. */
export function sumReducer<TData>(field: keyof TData & string): ColumnReducer<TData> {
  return { sum: field }
}

/** Built-in reducer: count events. */
export const countReducer = 'count' as const

/** Built-in reducer: total column-clipped busy minutes across the column's events. */
export function busyMinutesReducer<TData>(): (items: SummaryItem<TData>[]) => number {
  return (items) => items.reduce((sum, it) => sum + (it.end.getTime() - it.start.getTime()) / MS_MIN, 0)
}
