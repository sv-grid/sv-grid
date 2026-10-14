/**
 * Advanced Filter (Pro): register the expression compiler with the grid.
 *
 * Same shape as `pivot-enable.ts` - idempotent flag, register, unlicensed nudge.
 * The grid owns the filter state and the pipeline slot; this supplies the
 * compiler that turns an expression into a row predicate.
 */
import { registerAdvancedFilterEngine, type AdvancedFilterEngine } from '@svgrid/grid'
import { hasValidLicense } from './license'
import { emitUnlicensedNudge } from './watermark'
import { compilePredicate } from './expressions/compile'

let enabled = false

/** Compiles an expression kind of another Enterprise module (the fields view bar's `fieldFilter`). */
export type FilterKindCompiler = (expr: any, ctx: { getValue: (row: any, columnId: string) => unknown }) => ((row: any) => boolean) | null
const kinds = new Map<string, FilterKindCompiler>()

/** Teach the advanced filter an expression kind of its own (one per kind). */
export function registerFilterKind(kind: string, compile: FilterKindCompiler): void {
  kinds.set(kind, compile)
}

const advancedFilterEngine: AdvancedFilterEngine = (expr, ctx) => {
  // The grid treats null as "do not filter" and never surfaces a partially
  // applied predicate, so swallowing here is safe and is the fail-open half of
  // the contract documented on AdvancedFilterEngine.
  try {
    const own = kinds.get((expr as { kind?: string }).kind ?? '')
    if (own) return own(expr, ctx as never) as never
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
  if (!hasValidLicense()) emitUnlicensedNudge()
}
