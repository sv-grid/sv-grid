/**
 * Bridge fired alert events to the grid's conditional-formatting engine. A
 * `badge` / `highlight` action becomes a `RuleFormat` whose `when` matches the
 * row that fired, so `resolveCellFormat` paints it - the same painter the grid
 * already uses for color scales and data bars. No new rendering path.
 */
import type { ConditionalFormat } from '@svgrid/grid/format'
import { evaluatePredicate } from '../expressions/evaluate'
import type { AlertEvent, AlertRule } from './alert-types'

/** Which action kinds paint onto cells. */
const STYLING_KINDS = new Set(['badge', 'highlight'])

export type StylingContext<TData> = {
  getValue?: (row: TData, columnId: string) => unknown
  locale?: string | ReadonlyArray<string>
}

/**
 * Persistent styling: one self-contained `RuleFormat` per enabled rule that has
 * a `badge`/`highlight` action. The format's `when` runs the rule predicate
 * directly, so the styling stays live as data changes (rows light up while they
 * match and clear when they stop) without any row-id bookkeeping. One format
 * per rule keeps the array tiny regardless of row count.
 */
export function rulesToConditionalFormats<TData = Record<string, unknown>>(
  rules: ReadonlyArray<AlertRule>,
  ctx: StylingContext<TData> = {},
): ConditionalFormat<TData>[] {
  const formats: ConditionalFormat<TData>[] = []
  for (const rule of rules) {
    if (!rule.enabled) continue
    for (const action of rule.actions) {
      if (!STYLING_KINDS.has(action.kind)) continue
      const columns = action.columns ?? rule.columns
      const style = action.style ?? {}
      formats.push({
        type: 'rule',
        ...(columns ? { columns } : {}),
        when: ({ row }: { value: unknown; row: TData }) =>
          evaluatePredicate(rule.predicate, { row, getValue: ctx.getValue, locale: ctx.locale }),
        ...(style.background ? { background: style.background } : {}),
        ...(style.color ? { color: style.color } : {}),
      })
    }
  }
  return formats
}

/**
 * Turn active alert events into conditional formats. Events whose actions only
 * toast/log/flash contribute nothing here. Matching is by row id, so the format
 * follows the row through sort/filter rather than a fixed index.
 */
export function toConditionalFormats<TData = Record<string, unknown>>(
  events: ReadonlyArray<AlertEvent>,
  getRowId: (row: TData) => string,
): ConditionalFormat<TData>[] {
  const formats: ConditionalFormat<TData>[] = []
  for (const event of events) {
    if (event.rowId == null) continue
    const rowId = event.rowId
    for (const action of event.actions) {
      if (!STYLING_KINDS.has(action.kind)) continue
      const columns = action.columns ?? (event.columnId ? [event.columnId] : undefined)
      const style = action.style ?? {}
      formats.push({
        type: 'rule',
        ...(columns ? { columns } : {}),
        when: ({ row }: { value: unknown; row: TData }) => getRowId(row) === rowId,
        ...(style.background ? { background: style.background } : {}),
        ...(style.color ? { color: style.color } : {}),
      })
    }
  }
  return formats
}
