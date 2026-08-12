/**
 * Alerts (Pro) - the public entry for the Alert Rules engine + expression layer.
 *
 * Unlike the scheduler/board *views*, alerts are an overlay the consumer mounts
 * next to the grid (`<SvGridAlerts>`), so there is no renderer to register with
 * the grid. `enableAlerts()` exists only to keep the Pro soft-gate consistent
 * with the rest of Enterprise: it works without a license key but nudges once in
 * the console when unlicensed.
 *
 * ```ts
 * import { setLicenseKey, enableAlerts } from '@svgrid/enterprise'
 * setLicenseKey('YOUR-KEY')
 * enableAlerts()
 * // then mount <SvGridAlerts data={rows} columns={cols} bind:formats /> and
 * // spread `formats` into <SvGrid conditionalFormats={[...base, ...formats]} />
 * ```
 */
import { isLicenseKeySet } from './license'
import { emitUnlicensedNudge } from './watermark'

let enabled = false

/** Turn on the alerts feature (soft-gated). Idempotent. */
export function enableAlerts(): void {
  if (enabled) return
  enabled = true
  if (!isLicenseKeySet()) emitUnlicensedNudge()
}
