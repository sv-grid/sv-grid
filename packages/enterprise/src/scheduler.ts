/**
 * scheduler (view) - registers the Enterprise calendar / scheduler renderer with
 * the grid so `<SvGrid scheduler={...}>` renders a full Month / Week / Day /
 * Agenda calendar instead of the table. The grid ships the `scheduler` prop and
 * its config types for free; the *renderer* (SvGridScheduler) is Pro and plugs
 * in through the grid's `registerSchedulerView` seam.
 *
 * Soft-gated like the rest of Enterprise: it works without a license key but the
 * grid shows the "unlicensed" watermark + a one-time console nudge.
 *
 * ```ts
 * import { setLicenseKey, enableSchedulerView } from '@svgrid/enterprise'
 * setLicenseKey('YOUR-KEY')
 * enableSchedulerView()
 * // then: <SvGrid {data} {columns} scheduler={{ startField: 'start', endField: 'end' }} />
 * ```
 */
import { registerSchedulerView } from '@svgrid/grid'
import { isLicenseKeySet } from './license'
import { emitUnlicensedNudge } from './watermark'
import SvGridScheduler from './SvGridScheduler.svelte'

let enabled = false

/**
 * Register the Enterprise scheduler view. Idempotent - safe to call from every
 * component that uses `scheduler`, or once at app start. Also invoked by
 * {@link installEnterprise} so wiring the Pro API turns the view on too.
 */
export function enableSchedulerView(): void {
  if (enabled) return
  enabled = true
  registerSchedulerView(SvGridScheduler as never)
  if (!isLicenseKeySet()) emitUnlicensedNudge()
}

export { default as SvGridScheduler } from './SvGridScheduler.svelte'
