/**
 * "Only rows with changes": a condition kind of the expression language
 * (`registerPredicateKind`) that matches rows with a pending or conflicting
 * proposal, ANDed onto the user's own advanced filter and taken back off
 * without touching the rest of it.
 *
 * The advanced filter hands its predicate the grid's rows, whose `id` is the
 * grid's row id, which is what proposals are keyed by.
 */
import type { GridPredicateExpr } from '@svgrid/grid'
import { enableAdvancedFilter } from '../advanced-filter-enable'
import { registerPredicateKind } from '../expressions/kinds'

export const PENDING_KIND = 'reviewPending'

type Source = { hasPendingRow(rowId: string): boolean }
const sources = new Map<string, Source>()
let registered = false

function register(): void {
  if (registered) return
  registered = true
  registerPredicateKind(PENDING_KIND, {
    compile: (payload) => {
      const source = sources.get((payload as { token?: string } | null)?.token ?? '')
      if (!source) return null
      return (row) => {
        const id = (row as { id?: unknown } | null)?.id
        return id != null && source.hasPendingRow(String(id))
      }
    },
    describe: () => 'Has a proposed change',
  })
}

/** Make a review's rows filterable; returns the token its filter node names. */
export function trackPendingSource(token: string, source: Source): void {
  register()
  enableAdvancedFilter()
  sources.set(token, source)
}

/** The user's expression without any of our nodes; null when nothing is left. */
export function stripPending(expr: GridPredicateExpr | null): GridPredicateExpr | null {
  if (!expr) return null
  if (expr.kind === 'ext' && expr.type === PENDING_KIND) return null
  if (expr.kind === 'and' || expr.kind === 'or') {
    const parts = expr.parts.map(stripPending).filter((p): p is GridPredicateExpr => p !== null)
    if (!parts.length) return null
    return parts.length === 1 && expr.kind === 'and' ? parts[0]! : { ...expr, parts }
  }
  if (expr.kind === 'not') {
    const inner = stripPending(expr.expr)
    return inner ? { kind: 'not', expr: inner } : null
  }
  return expr
}

/**
 * The user's expression with our node ANDed on. `nonce` changes the node, so
 * the grid filters again after proposals were decided.
 */
export function withPending(expr: GridPredicateExpr | null, token: string, nonce: number): GridPredicateExpr {
  const node: GridPredicateExpr = { kind: 'ext', type: PENDING_KIND, payload: { token, nonce } }
  const rest = stripPending(expr)
  return rest ? { kind: 'and', parts: [rest, node] } : node
}

/** Whether an expression holds our node. */
export function hasPending(expr: GridPredicateExpr | null): boolean {
  if (!expr) return false
  if (expr.kind === 'ext') return expr.type === PENDING_KIND
  if (expr.kind === 'and' || expr.kind === 'or') return expr.parts.some(hasPending)
  if (expr.kind === 'not') return hasPending(expr.expr)
  return false
}
