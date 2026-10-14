/**
 * Group rows taller than records. A grouped view's header holds the field's
 * name over its value (a select pill, a linked record's chip), which a 40px
 * record row has no room for. The grid takes `rowHeight` as a function of
 * the row index, so while a view is grouped the base sets one that draws
 * group rows at GROUP_ROW_HEIGHT and records at the height picked for them.
 * Everything that reads the row height (the menu, a view saved, tall-row
 * wrapping) reads the record height through `recordHeightOf`.
 */

export const GROUP_ROW_HEIGHT = 52

type RowLike = { depth?: number; getCanExpand?: () => boolean; __treeRow?: boolean }
/** The grid's own record height when none is set (`rowHeight` unset). */
const GRID_DEFAULT = 30

const MARK = Symbol('groupedRowHeight')
type GroupedHeight = ((index: number) => number) & { recordHeight: number | undefined; [MARK]: true }

const isGrouped = (v: unknown): v is GroupedHeight => typeof v === 'function' && (v as GroupedHeight)[MARK] === true

/** A record row's height, whether the option is a number or the grouped function. */
export function recordHeightOf(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  return isGrouped(value) ? value.recordHeight : undefined
}

/** A group row of client grouping (not a tree row, which is a record). */
function isGroupRow(row: RowLike | undefined): boolean {
  return !!row && !row.__treeRow && typeof row.getCanExpand === 'function' && row.getCanExpand()
}

/**
 * Keep the row height in step with grouping: the function while grouped, the
 * plain record height otherwise. Call it when grouping or the height changes.
 */
export function syncGroupRowHeight(ctrl: { allRows?: RowLike[] } | undefined, api: { getOption: (k: string) => unknown; setOption: (k: string, v: unknown) => void } | undefined, grouped: boolean): void {
  if (!ctrl || !api) return
  const now = api.getOption('rowHeight')
  // Another function of the app's own: leave it be.
  if (typeof now === 'function' && !isGrouped(now)) return
  const h = recordHeightOf(now)
  if (!grouped) {
    // Back to what it was; unset stays unset.
    if (isGrouped(now)) api.setOption('rowHeight', h)
    return
  }
  if (isGrouped(now)) return
  const record = h ?? GRID_DEFAULT
  const fn = ((i: number) => (isGroupRow(ctrl.allRows?.[i]) ? Math.max(record, GROUP_ROW_HEIGHT) : record)) as GroupedHeight
  fn.recordHeight = h
  fn[MARK] = true
  api.setOption('rowHeight', fn)
}
