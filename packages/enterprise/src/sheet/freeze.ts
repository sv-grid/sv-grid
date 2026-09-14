/**
 * Freeze panes, over the pinning the grid already has.
 *
 * Columns freeze properly and for free: `api.setColumnPinning({ left: [...] })`
 * makes them sticky and excludes them from the horizontal scroll, which is
 * exactly Excel's behaviour.
 *
 * Rows are the honest part of this module. The grid renders `pinnedTopRows`
 * into a SEPARATE tbody above a virtualized body that still renders every
 * row, so handing it the first three displayed rows shows them twice.
 * Excluding them from the body means changing the virtualizer, which is the
 * path built for a million rows, and freeze is not worth that risk.
 *
 * So this does the column half through the api, and for rows it computes the
 * split and hands it back for the consumer to apply. That is the fiddly part
 * done once and correctly rather than reinvented per grid, and it does not
 * pretend to a rendering change that has not happened.
 *
 * `docs/help/missing-features.md` records the remaining gap.
 */
import type { GridCommandContext } from '@svgrid/grid/shortcuts'

export type FreezeState = {
  /** How many leading rows should be pinned. */
  rows: number
  /** How many leading columns should be pinned. */
  cols: number
}

export type FreezeSplit<TData> = {
  /** Pass as `pinnedTopRows`. */
  pinnedTopRows: ReadonlyArray<TData>
  /** Pass as `data`. The pinned rows are REMOVED, so nothing renders twice. */
  bodyRows: ReadonlyArray<TData>
}

/**
 * Split a row array for a frozen-row count.
 *
 * ```svelte
 * {@const split = splitFrozenRows(rows, freeze.rows)}
 * <SvGrid data={split.bodyRows} pinnedTopRows={split.pinnedTopRows} ... />
 * ```
 */
export function splitFrozenRows<TData>(
  rows: ReadonlyArray<TData>,
  count: number,
): FreezeSplit<TData> {
  const n = Math.max(0, Math.min(Math.floor(count), rows.length))
  if (n === 0) return { pinnedTopRows: [], bodyRows: rows }
  return { pinnedTopRows: rows.slice(0, n), bodyRows: rows.slice(n) }
}

/** Column ids left of `cols`, which is what column pinning takes. */
export function frozenColumnIds(
  cmd: GridCommandContext,
  cols: number,
): string[] {
  const out: string[] = []
  for (let c = 0; c < Math.min(cols, cmd.colCount); c += 1) {
    const id = cmd.columnIdAt(c)
    if (id !== null) out.push(id)
  }
  return out
}

type PinningApi = {
  setColumnPinning?(pinning: { left?: string[]; right?: string[] }): void
  getColumnPinning?(): { left?: string[]; right?: string[] }
}

/**
 * Apply the COLUMN half through the api and report the whole state.
 *
 * The caller applies the row half with `splitFrozenRows`, which is why this
 * returns the state rather than swallowing it.
 */
export function applyFreeze(cmd: GridCommandContext, state: FreezeState): FreezeState {
  const api = cmd.api as unknown as PinningApi
  api.setColumnPinning?.({ left: frozenColumnIds(cmd, state.cols) })
  return state
}

/**
 * Excel's Freeze Panes: everything above and to the left of the active cell
 * freezes. With the cursor on B3 you get two frozen rows and one frozen
 * column.
 */
export function freezeAtActiveCell(cmd: GridCommandContext): FreezeState {
  const active = cmd.activeCell
  const state: FreezeState = active
    ? { rows: active.rowIndex, cols: active.colIndex }
    : { rows: 0, cols: 0 }
  return applyFreeze(cmd, state)
}

/** Freeze Top Row. */
export function freezeTopRow(cmd: GridCommandContext): FreezeState {
  return applyFreeze(cmd, { rows: 1, cols: 0 })
}

/** Freeze First Column. */
export function freezeFirstColumn(cmd: GridCommandContext): FreezeState {
  return applyFreeze(cmd, { rows: 0, cols: 1 })
}

/** Unfreeze everything. */
export function unfreeze(cmd: GridCommandContext): FreezeState {
  return applyFreeze(cmd, { rows: 0, cols: 0 })
}
