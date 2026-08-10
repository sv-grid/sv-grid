/**
 * board (view) - registers the Enterprise Kanban board renderer with the grid so
 * `<SvGrid board={...}>` renders lanes of cards instead of the table. The grid
 * ships the `board` prop and its config types for free; the *renderer*
 * (SvGridBoard) is Pro and plugs in through the grid's `registerBoardView` seam.
 *
 * Soft-gated like the rest of Enterprise: it works without a license key but the
 * grid shows the "unlicensed" watermark + a one-time console nudge.
 *
 * ```ts
 * import { setLicenseKey, enableBoardView } from '@svgrid/enterprise'
 * setLicenseKey('YOUR-KEY')
 * enableBoardView()
 * // then: <SvGrid {data} {columns} board={{ groupBy: 'status' }} />
 * ```
 */
import { registerBoardView } from '@svgrid/grid'
import { isLicenseKeySet } from './license'
import { emitUnlicensedNudge } from './watermark'
import SvGridBoard from './SvGridBoard.svelte'

let enabled = false

/**
 * Register the Enterprise Kanban board view. Idempotent - safe to call from every
 * component that uses `board`, or once at app start. Also invoked by
 * {@link installEnterprise} so wiring the Pro API turns the view on too.
 */
export function enableBoardView(): void {
  if (enabled) return
  enabled = true
  registerBoardView(SvGridBoard as never)
  if (!isLicenseKeySet()) emitUnlicensedNudge()
}

export { default as SvGridBoard } from './SvGridBoard.svelte'
