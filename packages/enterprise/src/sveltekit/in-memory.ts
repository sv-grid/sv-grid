/**
 * In-memory reference `ServerDataSource`. Applies a `QueryPlan` to a plain
 * array - filter, global search, sort, page - and supports the full CRUD
 * contract. It is the executable specification of what a backend adapter must
 * do, and is genuinely useful on its own for small datasets, tests, demos,
 * and prototyping a schema before a database exists behind it.
 */
import type { RowData, ServerRequest, ServerResult } from '@svgrid/grid'
import { resolveIdField, type EntitySchema } from '../schema'
import { planQuery, type PlanPredicate, type QueryPlan } from './query-plan'
import { compilePredicate } from '../expressions/compile'
import type { WritableDataSource } from './types'
import { aggregateRows, type AggregateBucket, type AggregateRequest, type AggregateSource } from '../sources/aggregate'

function asString(v: unknown): string {
  return v == null ? '' : String(v)
}

function num(v: unknown): number {
  return typeof v === 'number' ? v : Number(v)
}

function matchesPredicate(row: RowData, p: PlanPredicate): boolean {
  const cell = row[p.field]
  switch (p.op) {
    case 'eq':
      return asString(cell) === asString(p.value)
    case 'contains':
      return asString(cell).toLowerCase().includes(asString(p.value).toLowerCase())
    case 'startsWith':
      return asString(cell).toLowerCase().startsWith(asString(p.value).toLowerCase())
    case 'gt':
      return typeof p.value === 'number' ? num(cell) > p.value : asString(cell) > asString(p.value)
    case 'lt':
      return typeof p.value === 'number' ? num(cell) < p.value : asString(cell) < asString(p.value)
    case 'between': {
      if (typeof p.value === 'number' && typeof p.valueTo === 'number') {
        return num(cell) >= p.value && num(cell) <= p.valueTo
      }
      return asString(cell) >= asString(p.value) && asString(cell) <= asString(p.valueTo)
    }
    case 'isBlank':
      return cell == null || cell === ''
    case 'in':
      return (p.values ?? []).some((v) => asString(v) === asString(cell))
    default:
      return true
  }
}

function matches(row: RowData, plan: QueryPlan): boolean {
  if (plan.search) {
    const term = plan.search.term.toLowerCase()
    const hit = plan.search.fields.some((f) => asString(row[f]).toLowerCase().includes(term))
    if (!hit) return false
  }
  return plan.where.every((p) => matchesPredicate(row, p))
}

/**
 * Reduce one already-bucketed group to a single aggregate value.
 *
 * Semantics deliberately mirror the SQL `planToSql` emits, so the in-memory
 * source and a real database agree:
 *   - `count` is COUNT(*): rows in the group, including null-valued ones.
 *   - the rest ignore non-numeric / null values, and yield null for an empty
 *     numeric set (SQL returns NULL for SUM/AVG/MIN/MAX over no rows).
 */
function aggregate<T extends RowData>(
  rows: ReadonlyArray<T>,
  field: string,
  fn: 'sum' | 'avg' | 'min' | 'max' | 'count',
): number | null {
  if (fn === 'count') return rows.length
  const nums: number[] = []
  for (const row of rows) {
    const n = Number((row as Record<string, unknown>)[field])
    if (Number.isFinite(n)) nums.push(n)
  }
  if (nums.length === 0) return null
  switch (fn) {
    case 'sum':
      return nums.reduce((s, n) => s + n, 0)
    case 'avg':
      return nums.reduce((s, n) => s + n, 0) / nums.length
    case 'min':
      return Math.min(...nums)
    case 'max':
      return Math.max(...nums)
    default:
      return null
  }
}

function sortRows<T extends RowData>(rows: T[], orderBy: QueryPlan['orderBy']): T[] {
  if (orderBy.length === 0) return rows
  // Stable multi-key sort: decorate with index, compare keys in order, fall back to index.
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      for (const { field, desc } of orderBy) {
        const av = a.row[field]
        const bv = b.row[field]
        let cmp: number
        if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
        else cmp = asString(av).localeCompare(asString(bv))
        if (cmp !== 0) return desc ? -cmp : cmp
      }
      return a.index - b.index
    })
    .map((d) => d.row)
}

export function createInMemoryDataSource<TData extends RowData>(
  initial: ReadonlyArray<TData>,
  schema: EntitySchema<TData>,
): WritableDataSource<TData> & AggregateSource & { rows(): ReadonlyArray<TData> } {
  let store: TData[] = [...initial]
  const idField = resolveIdField(schema)

  return {
    async getRows(request: ServerRequest): Promise<ServerResult<TData>> {
      const plan = planQuery(schema, request)
      let filtered = store.filter((r) => matches(r, plan))

      // Advanced filter. `planQuery` only admits an expression whose columns
      // are all on the schema, so reaching here means it is safe to run. If it
      // was rejected, or fails to compile, we must NOT acknowledge it - the
      // grid then tells the user the filter did not run rather than showing a
      // superset that looks filtered.
      let appliedExpression = false
      if (plan.expression) {
        const predicate = compilePredicate(plan.expression as never, {
          getValue: (row: TData, columnId: string) =>
            (row as unknown as Record<string, unknown>)[columnId],
          rows: filtered,
        })
        if (predicate) {
          filtered = filtered.filter(predicate)
          appliedExpression = true
        }
      }

      // Grouped request: return one row per distinct key at this level, each
      // carrying the requested aggregates. The chosen path is already in
      // `plan.where`, so `filtered` is exactly this group's slice of the data.
      // Reference behaviour for what a SQL backend does with `planToSql`'s
      // `select` / `groupByText` / `countText`.
      if (plan.groupBy) {
        const groupField = plan.groupBy
        const buckets = new Map<string, TData[]>()
        for (const row of filtered) {
          const key = asString((row as Record<string, unknown>)[groupField])
          const bucket = buckets.get(key)
          if (bucket) bucket.push(row)
          else buckets.set(key, [row])
        }

        const groups = [...buckets.entries()].map(([key, rows]) => {
          const out: Record<string, unknown> = { [groupField]: key }
          for (const agg of plan.aggregations ?? []) {
            out[agg.field] = aggregate(rows, agg.field, agg.fn)
          }
          return out as unknown as TData
        })

        // Sort by the group key unless the request sorted on a column we
        // actually produced (the key or an aggregate).
        const produced = new Set<string>([
          groupField,
          ...(plan.aggregations ?? []).map((a) => a.field),
        ])
        const groupOrder = plan.orderBy.filter((o) => produced.has(o.field))
        const sorted = groupOrder.length
          ? sortRows(groups, groupOrder)
          : sortRows(groups, [{ field: groupField, desc: false }])

        return {
          rows: sorted.slice(plan.offset, plan.offset + plan.limit),
          // The count is DISTINCT GROUPS, not underlying rows - the grid sizes
          // its scrollbar and paging from this.
          rowCount: sorted.length,
          appliedExpression,
        }
      }

      const sortedLeaves = sortRows(filtered, plan.orderBy)
      return {
        rows: sortedLeaves.slice(plan.offset, plan.offset + plan.limit),
        rowCount: sortedLeaves.length,
        appliedExpression,
      }
    },
    async createRow(input: Partial<TData>): Promise<TData> {
      const row = { ...input } as TData
      store = [...store, row]
      return row
    },
    async updateRow(id: string, patch: Partial<TData>): Promise<TData> {
      let updated: TData | undefined
      store = store.map((r) => {
        if (asString(r[idField]) === id) {
          updated = { ...r, ...patch }
          return updated
        }
        return r
      })
      if (!updated) throw new Error(`createInMemoryDataSource: no row with ${idField}="${id}"`)
      return updated
    },
    async deleteRow(id: string): Promise<void> {
      store = store.filter((r) => asString(r[idField]) !== id)
    },
    async getAggregate(request: AggregateRequest): Promise<AggregateBucket[]> {
      // Apply the (optional) filter using the same plan machinery as getRows,
      // over the whole store (no paging), then reduce in memory.
      const plan = planQuery(schema, {
        startRow: 0, endRow: store.length, pageIndex: 0, pageSize: store.length,
        sortModel: [], filterModel: request.filterModel ?? {},
      })
      const filtered = store.filter((r) => matches(r, plan))
      return aggregateRows(filtered, request)
    },
    rows: () => store,
  }
}
