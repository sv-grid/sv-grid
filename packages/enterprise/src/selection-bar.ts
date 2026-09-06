/**
 * selection bar - registers the Enterprise bulk-action bar with the grid, so
 * `<SvGrid selectionBar={...}>` floats a bar over the rows while any are
 * selected: the count, the actions that apply to the whole selection, an
 * overflow menu once there are more than a handful, and a clear button.
 *
 * The grid ships the `selectionBar` prop and its config types for free; the
 * *renderer* (SvGridSelectionBar) is Pro and plugs in through the grid's
 * `registerSelectionBarView` seam. Without it the grid shows a short upsell
 * note where the bar would be.
 *
 * Soft-gated like the rest of Enterprise: it works without a license key but
 * the grid shows the "unlicensed" watermark + a one-time console nudge.
 *
 * ```ts
 * import { setLicenseKey, enableSelectionBar } from '@svgrid/enterprise'
 * setLicenseKey('YOUR-KEY')
 * enableSelectionBar()
 * // then:
 * // <SvGrid {data} {columns} showRowSelection
 * //   selectionBar={{ position: 'bottom', actions: [...] }} />
 * ```
 */
import { registerSelectionBarView } from '@svgrid/grid'
import { isLicenseKeySet } from './license'
import { emitUnlicensedNudge } from './watermark'
import SvGridSelectionBar from './SvGridSelectionBar.svelte'

let enabled = false

/**
 * Register the Enterprise selection bar. Idempotent - safe to call from every
 * component that uses `selectionBar`, or once at app start. Also invoked by
 * {@link installEnterprise} so wiring the Pro API turns the bar on too.
 */
export function enableSelectionBar(): void {
  if (enabled) return
  enabled = true
  registerSelectionBarView(SvGridSelectionBar as never)
  if (!isLicenseKeySet()) emitUnlicensedNudge()
}

export { default as SvGridSelectionBar } from './SvGridSelectionBar.svelte'
