/**
 * Advanced Filter (Pro): register the expression compiler with the grid.
 *
 * Same shape as `pivot-enable.ts` - idempotent flag, register, soft-gate nudge.
 * The grid owns the filter state and the pipeline slot; this supplies the
 * compiler that turns an expression into a row predicate.
 */
import { registerAdvancedFilterEngine, type AdvancedFilterEngine } from '@svgrid/grid'
import { isLicenseKeySet } from './license'
import { emitUnlicensedNudge } from './watermark'
import { compilePredicate } from './expressions/compile'

let enabled = false

const advancedFilterEngine: AdvancedFilterEngine = (expr, ctx) => {
  // The grid treats null as "do not filter" and never surfaces a partially
  // applied predicate, so swallowing here is safe and is the fail-open half of
  // the contract documented on AdvancedFilterEngine.
  try {
    return compilePredicate(expr as never, ctx as never) as never
  } catch {
    return null
  }
}

/**
 * Enable the advanced filter. Call once (installEnterprise does it for you),
 * after which `api.setAdvancedFilter(expr)` actually filters rows.
 */
export function enableAdvancedFilter(): void {
  if (enabled) return
  enabled = true
  registerAdvancedFilterEngine(advancedFilterEngine)
  if (!isLicenseKeySet()) emitUnlicensedNudge()
}
