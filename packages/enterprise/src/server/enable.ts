/**
 * Server-Side Row Model (Pro). The free `@svgrid/grid` ships the datasource
 * CONTRACT (`ServerDataSource`, `ServerRequest`, `ServerResult`) and the flat
 * controller `createServerDataSource` - sort, filter, paging and CRUD against
 * a server. Everything above flat rows lives here: lazy server-side grouping
 * and tree data, aggregation rows, footers, and the group chrome.
 *
 * Unlike the scheduler and board there is no renderer to register with the
 * grid - the model hands the grid ordinary rows - so this module exists to
 * give Enterprise one uniform `enableX()` entry point and to raise the
 * soft-gate nudge at install time rather than at first expand.
 *
 * Soft-gated like the rest of Enterprise: it works without a license key but
 * the grid shows the unlicensed watermark + a one-time console nudge.
 *
 * ```ts
 * import { setLicenseKey, createServerRowModel } from '@svgrid/enterprise'
 * setLicenseKey('YOUR-KEY')
 * const ctl = createServerRowModel(source, { groupBy: ['region'], onChange })
 * ```
 */
import { isLicenseKeySet } from '../license'
import { emitUnlicensedNudge } from '../watermark'

let enabled = false

/**
 * Turn on the Enterprise server-side row model. Idempotent. Also invoked by
 * {@link installEnterprise}, so wiring the Pro API covers it.
 *
 * Calling it is optional: the model factories nudge on their own first call
 * (see {@link nudgeServerRowModel}), so an app that only imports
 * `createServerRowModel` is still gated.
 */
export function enableServerRowModel(): void {
  if (enabled) return
  enabled = true
  if (!isLicenseKeySet()) emitUnlicensedNudge()
}

/**
 * Raise the soft gate from a model factory. Shares the `enabled` latch with
 * {@link enableServerRowModel} so an app that calls both (or constructs many
 * models) still gets exactly one nudge.
 *
 * @internal
 */
export function nudgeServerRowModel(): void {
  enableServerRowModel()
}
