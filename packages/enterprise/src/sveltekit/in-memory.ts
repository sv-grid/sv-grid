/**
 * In-memory reference `ServerDataSource`. Applies a `QueryPlan` to a plain
 * array - filter, global search, sort, page - and supports the full CRUD
 * contract. It is the executable specification of what a backend adapter must
 * do, and is genuinely useful on its own for small datasets, tests, demos,
 * and prototyping a schema before a database exists behind it.
 */
import type { RowData, ServerDataSource, ServerRequest, ServerResult, ServerSelectionRule } from '@svgrid/grid'
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
/**
 * The grand-total row: every requested aggregate over the whole filtered
 * set. Shaped like a group row (values under their column ids) so the
 * grid renders it with the same columns.
 */
/**
 * The aggregates of `rows` into `out`: one value per aggregation, or under
 * pivot one per (pivot key path x aggregation) named `<path>_<col>`, with
 * every pivot key path seen collected into `paths`.
 */
function aggregateInto<T extends RowData>(
  out: Record<string, unknown>,
  rows: T[],
  plan: QueryPlan,
  paths?: Set<string>,
): void {
  if (plan.pivotBy?.length) {
    const cells = new Map<string, T[]>()
    for (const r of rows) {
      const path = plan.pivotBy.map((p) => asString((r as Record<string, unknown>)[p])).join('_')
      const cell = cells.get(path)
      if (cell) cell.push(r)
      else cells.set(path, [r])
    }
    for (const [path, cellRows] of cells) {
      paths?.add(path)
      for (const agg of plan.aggregations ?? []) {
        out[`${path}_${agg.field}`] = aggregate(cellRows, agg.field, agg.fn)
      }
    }
    return
  }
  for (const agg of plan.aggregations ?? []) out[agg.field] = aggregate(rows, agg.field, agg.fn)
}

function grandTotalOf<T extends RowData>(
  all: T[],
  plan: QueryPlan,
  expression: ((row: T) => boolean) | null,
): T {
  // The group path is the trailing `pathPredicates` entries of `where`; it
  // scopes this request, not the total, so it comes off.
  const filtersOnly: QueryPlan = {
    ...plan,
    where: plan.where.slice(0, plan.where.length - (plan.pathPredicates ?? 0)),
  }
  let rows = all.filter((r) => matches(r, filtersOnly))
  if (expression) rows = rows.filter(expression)
  const out: Record<string, unknown> = {}
  aggregateInto(out, rows, plan)
  return out as unknown as T
}

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
): WritableDataSource<TData> &
  Required<Pick<ServerDataSource<TData>, 'updateWhere'>> &
  AggregateSource & { rows(): ReadonlyArray<TData> } {
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
      let expressionPredicate: ((row: TData) => boolean) | null = null
      if (plan.expression) {
        const predicate = compilePredicate(plan.expression as never, {
          getValue: (row: TData, columnId: string) =>
            (row as unknown as Record<string, unknown>)[columnId],
          rows: filtered,
        })
        if (predicate) {
          filtered = filtered.filter(predicate)
          expressionPredicate = predicate
          appliedExpression = true
        }
      }

      // The grand total spans everything the FILTERS admit - the whole
      // store minus the filters and the expression, but NOT minus the group
      // path, which only scopes this request.
      const grandTotal = plan.grandTotal
        ? { grandTotal: grandTotalOf(store, plan, expressionPredicate) }
        : {}

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

        // Pivoting: every aggregate is computed once per distinct pivot key
        // path inside the group, under a field named from the path, and the
        // field list goes back so the grid can build the columns.
        const pivotPaths = new Set<string>()
        const groups = [...buckets.entries()].map(([key, rows]) => {
          const out: Record<string, unknown> = { [groupField]: key }
          aggregateInto(out, rows, plan, pivotPaths)
          // What opening this group would show: distinct keys of the next
          // level, or the rows themselves at the innermost group level.
          out.childCount = plan.childGroupBy
            ? new Set(rows.map((r) => asString((r as Record<string, unknown>)[plan.childGroupBy!]))).size
            : rows.length
          return out as unknown as TData
        })
        // The pivoted fields in a fixed order - key paths in plain string
        // order, aggregations as requested under each - so the grid builds
        // the same columns whatever order the groups came in. Every group
        // row carries every field; a cell with no rows under it is null, the
        // way a conditional aggregate answers in SQL.
        const pivotFields = [...pivotPaths]
          .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
          .flatMap((path) => (plan.aggregations ?? []).map((agg) => `${path}_${agg.field}`))
        for (const g of groups as Array<Record<string, unknown>>) {
          for (const f of pivotFields) if (!(f in g)) g[f] = null
        }

        // Sort by the group key unless the request sorted on a column we
        // actually produced (the key or an aggregate).
        const produced = new Set<string>([
          groupField,
          ...(plan.pivotBy?.length ? [] : (plan.aggregations ?? []).map((a) => a.field)),
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
          ...grandTotal,
          ...(plan.pivotBy?.length ? { pivotResultFields: pivotFields } : {}),
        }
      }

      const sortedLeaves = sortRows(filtered, plan.orderBy)
      return {
        rows: sortedLeaves.slice(plan.offset, plan.offset + plan.limit),
        rowCount: sortedLeaves.length,
        appliedExpression,
        ...grandTotal,
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
    /**
     * The reference for a bulk edit by RULE: every row the filters admit
     * that the selection rule says is selected, patched in place. The rule
     * is resolved by walking group values the way the grid builds routes,
     * so the nested shape works without the grid having sent any rows.
     */
    async updateWhere(
      filterModel: ServerRequest['filterModel'],
      patch: Partial<TData>,
      selection: ServerSelectionRule,
    ): Promise<number> {
      const plan = planQuery(schema, {
        startRow: 0, endRow: 0, pageIndex: 0, pageSize: 0, sortModel: [], filterModel,
      })
      // Which columns the nested rule is keyed by, level by level, comes
      // from the request that built it; a flat rule needs none. Callers
      // pass the groupBy through `filterModel.expression`-free means: the
      // rule itself carries `groupBy` when it is nested.
      const groupBy: string[] = (selection as { groupBy?: string[] }).groupBy ?? []
      const selected = (row: TData): boolean => {
        if ('selectAll' in selection) {
          const id = asString(row[idField])
          return selection.selectAll !== selection.toggled.includes(id)
        }
        // Walk the tree: each level's key is the row's value in that group
        // column; the leaf is the row id.
        let node: { selectAllChildren: boolean; toggled: Record<string, unknown> } = selection
        let state = selection.selectAllChildren
        const keys = [...groupBy.map((g) => asString(row[g])), asString(row[idField])]
        for (const key of keys) {
          const next = node.toggled[key] as typeof node | undefined
          if (!next) return state
          node = next
          state = next.selectAllChildren
        }
        return state
      }
      let changed = 0
      store = store.map((row) => {
        if (!matches(row, plan) || !selected(row)) return row
        changed += 1
        return { ...row, ...patch }
      })
      return changed
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
