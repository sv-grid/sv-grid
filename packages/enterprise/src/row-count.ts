/**
 * Row count - "250 rows", or "12 of 250 rows" while filters hide some, at the
 * start of the grid's status bar, and the same two numbers from code.
 *
 * ```ts
 * import { enableRowCount, getRowCounts } from '@svgrid/enterprise'
 * enableRowCount()
 * // <SvGrid {data} {columns} statusBar={{ rows: true, aggregates: [] }} />
 * const { total, filtered } = getRowCounts(api)
 * ```
 */
import { registerGridExtension, type RowData, type SvGridApi, type TableFeatures } from '@svgrid/grid'
import { hasValidLicense } from './license'
import { emitUnlicensedNudge } from './watermark'
import SvGridRowCount from './SvGridRowCount.svelte'

let enabled = false

/**
 * Draw the row count in every grid whose `statusBar` sets `rows: true`.
 * Idempotent; also invoked by {@link installEnterprise}.
 */
export function enableRowCount(): void {
  if (enabled) return
  enabled = true
  registerGridExtension({ statusBarRows: () => SvGridRowCount as never })
  if (!hasValidLicense()) emitUnlicensedNudge()
}

/**
 * How many rows the grid holds (`total`) and how many pass the current
 * filters (`filtered`), for an "X of Y" of your own. Pagination changes
 * neither. With grouping on, `filtered` counts the group rows too. Under
 * `externalPagination` both come from the `rowCount` you pass.
 */
export function getRowCounts<TFeatures extends TableFeatures, TData extends RowData>(
  api: SvGridApi<TFeatures, TData>,
): { total: number; filtered: number } {
  const filtered = api.getPageInfo().total
  return { total: api.getOption('externalPagination') ? filtered : api.getData().length, filtered }
}

export { default as SvGridRowCount } from './SvGridRowCount.svelte'
