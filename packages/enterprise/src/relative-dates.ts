/**
 * Relative date filters - five date operators measured from today, in whole
 * local days: Today, Before today (overdue), After today, Next 7 days and
 * Last 7 days. They take no value, so picking one in a date column's filter
 * menu filters at once. They plug into the grid's `filterOperators` seam, so a
 * grid without this module carries none of the code.
 *
 * Like the rest of Enterprise it runs without a license key during the
 * evaluation; the grid shows the watermark and a one-time console notice.
 *
 * ```ts
 * import { enableRelativeDateFilters } from '@svgrid/enterprise'
 * enableRelativeDateFilters()
 * // then: a column with cellDataType 'date' or 'dateString' offers them
 * api.setFilter('due', { operator: 'beforeToday' })
 * ```
 */
import { getGridExtension, registerGridExtension, type GridFilterOperator } from '@svgrid/grid'
import { hasValidLicense } from './license'
import { emitUnlicensedNudge } from './watermark'
import {
  compileRelativeDateFilter,
  resolveRelativeDateFilter,
  type RelativeDateOperator,
} from './relative-date-core'

export {
  RELATIVE_DATE_OPERATOR_IDS,
  isRelativeDateOperator,
  compileRelativeDateFilter,
  resolveRelativeDateFilter,
  type RelativeDateOperator,
} from './relative-date-core'

const LABELS: Record<RelativeDateOperator, string> = {
  today: 'Today',
  beforeToday: 'Before today',
  afterToday: 'After today',
  next7Days: 'Next 7 days',
  last7Days: 'Last 7 days',
}

function operator(op: RelativeDateOperator): GridFilterOperator {
  return {
    label: LABELS[op],
    types: ['date'],
    valueless: true,
    compile: () => compileRelativeDateFilter(op),
    toServer: (filter) => resolveRelativeDateFilter(filter),
  }
}

/** The operators as the grid's `filterOperators` seam takes them. */
export const relativeDateOperators: Record<RelativeDateOperator, GridFilterOperator> = {
  today: operator('today'),
  beforeToday: operator('beforeToday'),
  afterToday: operator('afterToday'),
  next7Days: operator('next7Days'),
  last7Days: operator('last7Days'),
}

let enabled = false

/**
 * Add the relative date operators to every grid's date filters. Idempotent:
 * call it once at app start or from each component that uses them. Also
 * invoked by {@link installEnterprise}.
 */
export function enableRelativeDateFilters(): void {
  if (enabled) return
  enabled = true
  // Another module may have added operators of its own; keep them.
  registerGridExtension({ filterOperators: { ...getGridExtension()?.filterOperators, ...relativeDateOperators } })
  if (!hasValidLicense()) emitUnlicensedNudge()
}
