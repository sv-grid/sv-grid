/**
 * Dashboard model - a declarative, schema-driven set of widgets (KPI tiles +
 * charts) over an entity. This is a *data view*, not a page builder: the spec is
 * plain data, `SvSchemaDashboard` renders it, and `dashboardFromSchema` proposes
 * a sensible default from the schema's chart-able fields. KPI tiles reduce a
 * measure to a single number; charts reuse `SvSchemaChart` (and its `aggregateRows`
 * / `getAggregate` seam), so nothing here re-implements aggregation.
 */
import type { RowData } from '@svgrid/grid'
import type { EntitySchema } from '../schema'
import { chartFieldsFromSchema, type AggregateReduce } from './aggregate'
import type { ChartType } from '@svgrid/grid'

/** A single-number tile: reduce `measure` over the rows (count ignores measure). */
export type KpiWidget = {
  kind: 'kpi'
  label: string
  measure?: string
  reduce: AggregateReduce
  /** Format the number for display (e.g. currency). */
  format?: (value: number) => string
}

/** A chart tile bound to a fixed dimension / measure / reduce / type. */
export type ChartWidget = {
  kind: 'chart'
  label?: string
  dimension: string
  measure?: string
  reduce: AggregateReduce
  type: ChartType
  /** Columns spanned in the dashboard grid. Default 1. */
  span?: 1 | 2 | 3
}

export type DashboardWidget = KpiWidget | ChartWidget

export type DashboardSpec = { widgets: DashboardWidget[] }

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Reduce a measure over rows into a single KPI number. `count` returns the row
 * count; `sum`/`avg`/`min`/`max` fold the measure. An empty set is 0.
 */
export function reduceValue<T extends RowData>(
  rows: ReadonlyArray<T>,
  request: { measure?: string; reduce: AggregateReduce },
): number {
  const { measure, reduce } = request
  if (reduce === 'count' || !measure) return rows.length
  if (rows.length === 0) return 0
  const values = rows.map((r) => num(r[measure]))
  if (reduce === 'sum') return values.reduce((a, b) => a + b, 0)
  if (reduce === 'avg') return values.reduce((a, b) => a + b, 0) / values.length
  if (reduce === 'min') return Math.min(...values)
  return Math.max(...values) // 'max'
}

/**
 * Group rows by `trendField` (sorted, so ISO dates / ordered categories line up)
 * and reduce `measure` per bucket - the series behind a KPI card's sparkline.
 */
export function kpiSeries<T extends RowData>(
  rows: ReadonlyArray<T>,
  opts: { trendField: string; measure?: string; reduce: AggregateReduce },
): number[] {
  const groups = new Map<string, T[]>()
  for (const r of rows) {
    const k = String(r[opts.trendField] ?? '')
    if (k === '') continue
    ;(groups.get(k) ?? groups.set(k, []).get(k)!).push(r)
  }
  return [...groups.keys()].sort().map((k) => reduceValue(groups.get(k)!, { measure: opts.measure, reduce: opts.reduce }))
}

/** SVG polyline points for a sparkline in a `w` x `h` box (y grows downward). */
export function sparklinePoints(values: number[], w = 120, h = 30, pad = 2): string {
  if (values.length === 0) return ''
  const min = Math.min(...values)
  const range = Math.max(...values) - min || 1
  const dx = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0
  return values
    .map((v, i) => `${(pad + i * dx).toFixed(1)},${(pad + (h - pad * 2) * (1 - (v - min) / range)).toFixed(1)}`)
    .join(' ')
}

/** Percent change from the first non-zero point to the last (null when < 2 points). */
export function seriesDelta(values: number[]): number | null {
  if (values.length < 2) return null
  const first = values.find((v) => v !== 0)
  const last = values[values.length - 1]!
  if (first == null || first === 0) return null
  return ((last - first) / Math.abs(first)) * 100
}

/** Format a KPI number: currency (`$`), percent (`%`), compact (`1.2k`), or grouped. */
export function formatKpiValue(value: number, format?: 'number' | 'currency' | 'percent' | 'compact'): string {
  if (format === 'currency') return '$' + value.toLocaleString(undefined, { maximumFractionDigits: 0 })
  if (format === 'percent') return value.toLocaleString(undefined, { maximumFractionDigits: 1 }) + '%'
  if (format === 'compact') return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

/**
 * Propose a default dashboard from a schema: a total-count KPI, a sum/avg KPI on
 * the first numeric measure (when there is one), and a bar chart on the default
 * dimension / measure. Built from `chartFieldsFromSchema`.
 */
export function dashboardFromSchema(schema: EntitySchema): DashboardSpec {
  const { defaultDimension, defaultMeasure } = chartFieldsFromSchema(schema)
  const label = schema.label ?? schema.name
  const widgets: DashboardWidget[] = [{ kind: 'kpi', label: `Total ${label}`, reduce: 'count' }]

  if (defaultMeasure) {
    widgets.push({ kind: 'kpi', label: `Total ${defaultMeasure}`, measure: defaultMeasure, reduce: 'sum' })
    widgets.push({ kind: 'kpi', label: `Avg ${defaultMeasure}`, measure: defaultMeasure, reduce: 'avg' })
  }

  if (defaultDimension) {
    widgets.push({
      kind: 'chart',
      label: defaultMeasure ? `${defaultMeasure} by ${defaultDimension}` : `Count by ${defaultDimension}`,
      dimension: defaultDimension,
      measure: defaultMeasure ?? undefined,
      reduce: defaultMeasure ? 'sum' : 'count',
      type: 'bar',
      span: 2,
    })
  }

  return { widgets }
}
