/**
 * Aggregation for charts / dashboards: group rows by a dimension and reduce a
 * measure into `{ category, value }` buckets. `aggregateRows` does it in memory;
 * data sources can implement `getAggregate` to push the same shape down to the
 * database (a `GROUP BY`) so it scales past what a page can hold. `SvSchemaChart`
 * consumes either.
 */
import type { RowData, ServerFilterModel } from '@svgrid/grid'
import type { EntitySchema } from '../schema'

export type AggregateReduce = 'sum' | 'avg' | 'count' | 'min' | 'max'

export type AggregateRequest = {
  /**
   * Field to group by (the chart's category axis). Omit it for a single grand
   * total (a KPI) - the result is one bucket with an empty `category`.
   */
  dimension?: string
  /** Field to reduce. Ignored for `count`. */
  measure?: string
  reduce: AggregateReduce
  /** Optional filter, same shape the grid emits. */
  filterModel?: ServerFilterModel
}

export type AggregateBucket = { category: string; value: number }

/** A data source that can aggregate server-side (e.g. a SQL `GROUP BY`). */
export type AggregateSource = {
  getAggregate(request: AggregateRequest): Promise<AggregateBucket[]>
}

const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Group `rows` by `dimension` and reduce `measure`; sorted by value desc. */
export function aggregateRows<T extends RowData>(
  rows: ReadonlyArray<T>,
  request: AggregateRequest,
): AggregateBucket[] {
  const { dimension, measure, reduce } = request
  const sum = new Map<string, number>()
  const count = new Map<string, number>()
  const ext = new Map<string, number>() // running min/max

  for (const row of rows) {
    // No dimension -> a single grand-total bucket (KPI).
    const category = dimension ? String(row[dimension] ?? '') : ''
    count.set(category, (count.get(category) ?? 0) + 1)
    if (reduce !== 'count') {
      const v = num(measure ? row[measure] : 0)
      sum.set(category, (sum.get(category) ?? 0) + v)
      if (reduce === 'min') ext.set(category, Math.min(ext.get(category) ?? Infinity, v))
      if (reduce === 'max') ext.set(category, Math.max(ext.get(category) ?? -Infinity, v))
    }
  }

  const buckets: AggregateBucket[] = [...count.keys()].map((category) => {
    const c = count.get(category)!
    let value: number
    if (reduce === 'count') value = c
    else if (reduce === 'avg') value = c ? (sum.get(category) ?? 0) / c : 0
    else if (reduce === 'min' || reduce === 'max') value = ext.get(category) ?? 0
    else value = sum.get(category) ?? 0
    return { category, value }
  })

  return buckets.sort((a, b) => b.value - a.value)
}

/**
 * Pick chart-able fields from a schema: **dimensions** to group by (enum /
 * boolean / text, non-key) and **measures** to reduce (number). Defaults favor a
 * low-cardinality dimension (enum, then boolean) and the first numeric measure.
 */
export function chartFieldsFromSchema(schema: EntitySchema): {
  dimensions: string[]
  measures: string[]
  defaultDimension: string | null
  defaultMeasure: string | null
} {
  const nonKey = schema.fields.filter((f) => !f.primaryKey)
  const dimensions = nonKey
    .filter((f) => f.type === 'enum' || f.type === 'boolean' || f.type === 'text')
    .map((f) => f.field)
  const measures = nonKey.filter((f) => f.type === 'number').map((f) => f.field)

  const preferred =
    nonKey.find((f) => f.type === 'enum')?.field ??
    nonKey.find((f) => f.type === 'boolean')?.field ??
    dimensions[0] ??
    null

  return {
    dimensions,
    measures,
    defaultDimension: preferred,
    defaultMeasure: measures[0] ?? null,
  }
}
