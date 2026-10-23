/**
 * The relative date operators' semantics, with no grid import: what the
 * filter menu (relative-dates.ts) and the expression engine both run, so a
 * server that evaluates expressions loads none of the grid.
 */
// The ids type-check as filter operators wherever this package is installed.
declare module '@svgrid/grid/filtering' {
  interface FilterOperatorExtensions {
    today: true
    beforeToday: true
    afterToday: true
    next7Days: true
    last7Days: true
  }
}

/** The relative date operator ids, in menu order. */
export const RELATIVE_DATE_OPERATOR_IDS = ['today', 'beforeToday', 'afterToday', 'next7Days', 'last7Days'] as const
export type RelativeDateOperator = (typeof RELATIVE_DATE_OPERATOR_IDS)[number]

const DAY_MS = 86_400_000

/** Whether `op` is one of the relative date operators. */
export function isRelativeDateOperator(op: string): op is RelativeDateOperator {
  return (RELATIVE_DATE_OPERATOR_IDS as ReadonlyArray<string>).includes(op)
}

/**
 * A value as a count of local calendar days, or NaN. A bare 'YYYY-MM-DD' is
 * that day in local time; `new Date()` would read it as UTC midnight, the day
 * before anywhere west of Greenwich.
 */
function localDayNumber(value: unknown): number {
  let d: Date
  if (value instanceof Date) d = value
  else if (typeof value === 'number') d = new Date(value)
  else if (typeof value === 'string' && value.trim()) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
    d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value)
  } else return NaN
  if (Number.isNaN(d.getTime())) return NaN
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS)
}

/** The inclusive range of local day numbers an operator keeps. */
function dayRange(op: RelativeDateOperator, now: Date): [number, number] {
  const t = localDayNumber(now)
  switch (op) {
    case 'today':
      return [t, t]
    case 'beforeToday':
      return [-Infinity, t - 1]
    case 'afterToday':
      return [t + 1, Infinity]
    case 'next7Days':
      return [t, t + 7]
    case 'last7Days':
      return [t - 7, t]
  }
}

/** Local 'YYYY-MM-DD' for a day number from `localDayNumber`. */
function isoFromDayNumber(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10)
}

/**
 * The test for one relative date operator. "Today" is read once, here, so a
 * page left open past midnight keeps the old day until the filter changes.
 * A blank or unparseable cell never matches.
 */
export function compileRelativeDateFilter(op: RelativeDateOperator, now: Date = new Date()): (cellValue: unknown) => boolean {
  const [lo, hi] = dayRange(op, now)
  return (cellValue) => {
    const day = localDayNumber(cellValue)
    return day >= lo && day <= hi
  }
}

/**
 * A relative date filter as the absolute one it means today, for a backend
 * with no "today" of its own: `beforeToday` becomes `lessThan` today's date,
 * `next7Days` becomes `between` today and a week out, and so on, with dates as
 * local 'YYYY-MM-DD'. Any other filter is returned as it is.
 *
 * A server data source gets this applied for it. Under `externalFilter` the
 * `onFiltersChange` payload keeps the relative operator, so a saved view still
 * means "overdue" tomorrow; call this when you build the query.
 */
export function resolveRelativeDateFilter<T extends { operator: string; value?: unknown; valueTo?: unknown }>(
  filter: T,
  now: Date = new Date(),
): T {
  if (!isRelativeDateOperator(filter.operator)) return filter
  const op = filter.operator
  const [lo, hi] = dayRange(op, now)
  const out: Record<string, unknown> = { ...filter }
  delete out.valueTo
  if (op === 'beforeToday') Object.assign(out, { operator: 'lessThan', value: isoFromDayNumber(hi + 1) })
  else if (op === 'afterToday') Object.assign(out, { operator: 'greaterThan', value: isoFromDayNumber(lo - 1) })
  else Object.assign(out, { operator: 'between', value: isoFromDayNumber(lo), valueTo: isoFromDayNumber(hi) })
  return out as T
}
