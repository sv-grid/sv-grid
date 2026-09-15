/**
 * Freeze panes, over what the grid already has.
 *
 * Columns freeze through `api.setColumnPinning({ left: [...] })`, which
 * makes them sticky and excludes them from the horizontal scroll, and rows
 * through the grid's `frozenRows` prop, set here with `api.setOption`: the
 * first N rows stay under the header, still the grid's own rows, editable
 * and numbered, while the virtualized body scrolls beneath them. Both halves
 * go through the api, so Freeze Panes is one call for any consumer.
 *
 * `splitFrozenRows` stays for a grid that renders its own pinned band from
 * `pinnedTopRows` instead.
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
  setOption?(key: string, value: unknown): void
}

/**
 * Apply both halves through the api and report the state: the columns pin,
 * the rows freeze. Zero rows clears the row half.
 */
export function applyFreeze(cmd: GridCommandContext, state: FreezeState): FreezeState {
  const api = cmd.api as unknown as PinningApi
  api.setColumnPinning?.({ left: frozenColumnIds(cmd, state.cols) })
  api.setOption?.('frozenRows', state.rows > 0 ? state.rows : undefined)
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
