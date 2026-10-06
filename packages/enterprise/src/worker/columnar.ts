/**
 * The query engine behind `serveWorkerDataSource`: the in-memory reference
 * source's answers, computed over columns instead of row objects.
 *
 * Each field becomes a dictionary - its distinct values, and one integer code
 * per row - built once, in the background, while the worker is idle. Then:
 *
 * - A filter is decided once per DISTINCT value, with the reference's own
 *   `matchesPredicate`, and a row passes when its code does. Searching a
 *   million rows of 80 customers tests 80 strings.
 * - A sort ranks the distinct values once (numerically, or with the same
 *   collator the reference uses) and orders rows with a stable counting sort
 *   over the ranks: integer work, linear in the row count, no string compares.
 * - A grouping buckets rows by code and accumulates aggregates in row order,
 *   so sums come out bit-for-bit what the reference adds up.
 *
 * Exact equivalence is the contract, not a goal: anything this engine does
 * not accelerate goes to the reference source holding the same rows - the
 * advanced filter expression, pivot, and a sort on a column that mixes
 * numbers with other values (where the reference's comparison is not a
 * total order, so there is no ranking to reproduce). Writes go through the
 * reference too, and the columns are rebuilt from its rows.
 */
import type { RowData, ServerDataSource, ServerRequest, ServerResult, ServerSelectionRule } from '@svgrid/grid'
import type { EntitySchema } from '../schema'
import { planQuery, type PlanPredicate, type QueryPlan } from '../sveltekit/query-plan'
import { asString, createInMemoryDataSource, matchesPredicate, sortRows } from '../sveltekit/in-memory'
import type { AggregateBucket, AggregateRequest } from '../sources/aggregate'

/** One field as columns: a code per row, and what each code stands for. */
type Column = {
  codes: Uint32Array
  values: unknown[]
  /** Sort ranks per code, or null when the column mixes numbers with other values. */
  ranks?: Uint32Array | null
  rankCount?: number
  /** Group key (the value as text) per code, as an index into `keys`. */
  keyOf?: Uint32Array
  keys?: string[]
  /** `Number(value)` per code when finite, NaN otherwise: what aggregates read. */
  nums?: Float64Array
}

type Prepared<TData> = {
  /** Row indexes in answer order (flat), or the group rows (grouped). */
  order?: Uint32Array
  groups?: TData[]
  grandTotal?: TData
}

const RESULT_CACHE_SIZE = 8
const collator = new Intl.Collator()

export type ColumnarDataSource<TData extends RowData> = Required<
  Pick<ServerDataSource<TData>, 'getRows' | 'createRow' | 'updateRow' | 'deleteRow' | 'updateWhere'>
> & {
  getAggregate(request: AggregateRequest): Promise<AggregateBucket[]>
  rows(): ReadonlyArray<TData>
  /**
   * Build one more column's dictionary and ranks. Returns false once every
   * schema field is built. `serveWorkerDataSource` calls it between requests,
   * so the first sort on any column finds its work already done.
   */
  warm(): boolean
  /** How many requests this engine answered, and how many it handed to the reference. */
  stats(): { columnar: number; reference: number }
}

export function createColumnarDataSource<TData extends RowData>(
  initial: ReadonlyArray<TData>,
  schema: EntitySchema<TData>,
): ColumnarDataSource<TData> {
  const reference = createInMemoryDataSource(initial, schema, { cacheResults: true })
  let store = reference.rows() as TData[]
  let columns = new Map<string, Column>()
  const cache = new Map<string, Prepared<TData>>()
  const fields = schema.fields.map((f) => f.field as string)

  // Index of the next schema field `warm()` builds.
  let warmed = 0

  function invalidate(): void {
    store = reference.rows() as TData[]
    columns = new Map()
    cache.clear()
    warmed = 0
  }

  // ---- columns ------------------------------------------------------------

  function column(field: string): Column {
    let col = columns.get(field)
    if (col) return col
    const n = store.length
    const codes = new Uint32Array(n)
    const values: unknown[] = []
    const index = new Map<unknown, number>()
    for (let i = 0; i < n; i += 1) {
      const v = (store[i] as Record<string, unknown>)[field]
      let code = index.get(v)
      if (code === undefined) {
        code = values.length
        index.set(v, code)
        values.push(v)
      }
      codes[i] = code
    }
    col = { codes, values }
    columns.set(field, col)
    return col
  }

  function ranked(col: Column): Uint32Array | null {
    if (col.ranks !== undefined) return col.ranks
    const { values } = col
    let numbers = 0
    let finite = 0
    for (const v of values) {
      if (typeof v === 'number') {
        numbers += 1
        if (Number.isFinite(v)) finite += 1
      }
    }
    // The reference compares two numbers by subtraction and anything else as
    // text. All finite numbers, or no numbers at all, is a total order a
    // ranking can reproduce; a mix (or NaN / Infinity) is not.
    if (numbers > 0 && (finite !== values.length)) {
      col.ranks = null
      return null
    }
    const byValue = values.map((_, code) => code)
    const text = numbers === 0 ? values.map(asString) : null
    const cmp = text
      ? (a: number, b: number) => collator.compare(text[a]!, text[b]!)
      : (a: number, b: number) => (values[a] as number) - (values[b] as number)
    byValue.sort(cmp)
    const ranks = new Uint32Array(values.length)
    let rank = 0
    for (let i = 0; i < byValue.length; i += 1) {
      // Values the comparison calls equal share a rank, so the stable sort
      // keeps them in row order, as the reference's index tiebreak does.
      if (i > 0 && cmp(byValue[i - 1]!, byValue[i]!) !== 0) rank += 1
      ranks[byValue[i]!] = rank
    }
    col.ranks = ranks
    col.rankCount = values.length ? rank + 1 : 0
    return ranks
  }

  function keyed(col: Column): { keyOf: Uint32Array; keys: string[] } {
    if (!col.keyOf) {
      const keyOf = new Uint32Array(col.values.length)
      const keys: string[] = []
      const index = new Map<string, number>()
      col.values.forEach((v, code) => {
        const key = asString(v)
        let k = index.get(key)
        if (k === undefined) {
          k = keys.length
          index.set(key, k)
          keys.push(key)
        }
        keyOf[code] = k
      })
      col.keyOf = keyOf
      col.keys = keys
    }
    return { keyOf: col.keyOf, keys: col.keys! }
  }

  function numbers(col: Column): Float64Array {
    if (!col.nums) {
      const nums = new Float64Array(col.values.length)
      col.values.forEach((v, code) => {
        const n = Number(v)
        nums[code] = Number.isFinite(n) ? n : NaN
      })
      col.nums = nums
    }
    return col.nums
  }

  // ---- filtering ----------------------------------------------------------

  /** Row indexes passing `where` and the search, in store order. */
  function select(where: PlanPredicate[], search: QueryPlan['search']): Uint32Array {
    const n = store.length
    const tests: Array<{ codes: Uint32Array; pass: Uint8Array }> = []
    for (const p of where) {
      const col = column(p.field)
      const pass = new Uint8Array(col.values.length)
      col.values.forEach((v, code) => {
        pass[code] = matchesPredicate({ [p.field]: v } as RowData, p) ? 1 : 0
      })
      tests.push({ codes: col.codes, pass })
    }
    const searched: Array<{ codes: Uint32Array; pass: Uint8Array }> = []
    if (search) {
      const term = search.term.toLowerCase()
      for (const field of search.fields) {
        const col = column(field)
        const pass = new Uint8Array(col.values.length)
        col.values.forEach((v, code) => {
          pass[code] = asString(v).toLowerCase().includes(term) ? 1 : 0
        })
        searched.push({ codes: col.codes, pass })
      }
    }
    if (tests.length === 0 && !search) {
      const all = new Uint32Array(n)
      for (let i = 0; i < n; i += 1) all[i] = i
      return all
    }
    const out = new Uint32Array(n)
    let m = 0
    rows: for (let i = 0; i < n; i += 1) {
      if (search) {
        let hit = false
        for (const s of searched) {
          if (s.pass[s.codes[i]!]) {
            hit = true
            break
          }
        }
        if (!hit) continue
      }
      for (const t of tests) if (!t.pass[t.codes[i]!]) continue rows
      out[m++] = i
    }
    return out.slice(0, m)
  }

  // ---- sorting ------------------------------------------------------------

  /** Stable counting sort of `idx` by one column; LSD over several keys. */
  function sortIndexes(idx: Uint32Array, orderBy: QueryPlan['orderBy']): Uint32Array | null {
    const keys: Array<{ codes: Uint32Array; ranks: Uint32Array; count: number; desc: boolean }> = []
    for (const o of orderBy) {
      const col = column(o.field)
      const ranks = ranked(col)
      if (!ranks) return null
      keys.push({ codes: col.codes, ranks, count: col.rankCount!, desc: o.desc })
    }
    let cur: Uint32Array = idx
    let next: Uint32Array = new Uint32Array(idx.length)
    // Least significant key first: each pass is stable, so earlier keys win.
    for (let k = keys.length - 1; k >= 0; k -= 1) {
      const { codes, ranks, count, desc } = keys[k]!
      const counts = new Uint32Array(count + 1)
      for (let i = 0; i < cur.length; i += 1) {
        const r = ranks[codes[cur[i]!]!]!
        counts[(desc ? count - 1 - r : r) + 1]! += 1
      }
      for (let r = 1; r <= count; r += 1) counts[r]! += counts[r - 1]!
      for (let i = 0; i < cur.length; i += 1) {
        const row = cur[i]!
        const r = ranks[codes[row]!]!
        next[counts[desc ? count - 1 - r : r]!++] = row
      }
      const swap = cur === idx ? new Uint32Array(idx.length) : cur
      cur = next
      next = swap
    }
    return cur
  }

  // ---- aggregating --------------------------------------------------------

  type Acc = { count: Float64Array; sum: Float64Array; min: Float64Array; max: Float64Array; n: Float64Array }

  function accumulate(
    idx: Uint32Array,
    /** The group of the i-th row of `idx`, or null for one group. */
    rowGroup: Uint32Array | null,
    groupCount: number,
    aggregations: NonNullable<QueryPlan['aggregations']>,
  ): Map<string, Acc> {
    const out = new Map<string, Acc>()
    for (const agg of aggregations) {
      if (out.has(agg.field)) continue
      const col = column(agg.field)
      const codes = col.codes
      const nums = numbers(col)
      const acc: Acc = {
        count: new Float64Array(groupCount),
        sum: new Float64Array(groupCount),
        min: new Float64Array(groupCount).fill(Infinity),
        max: new Float64Array(groupCount).fill(-Infinity),
        n: new Float64Array(groupCount),
      }
      for (let i = 0; i < idx.length; i += 1) {
        const row = idx[i]!
        const g = rowGroup ? rowGroup[i]! : 0
        acc.count[g]! += 1
        const v = nums[codes[row]!]!
        if (v !== v) continue // NaN: not a finite number
        acc.n[g]! += 1
        acc.sum[g]! += v
        if (v < acc.min[g]!) acc.min[g] = v
        if (v > acc.max[g]!) acc.max[g] = v
      }
      out.set(agg.field, acc)
    }
    return out
  }

  /** The reference's `aggregate`, read off the accumulators. */
  function valueOf(acc: Acc, g: number, fn: string): number | null {
    if (fn === 'count') return acc.count[g]!
    if (acc.n[g] === 0) return null
    switch (fn) {
      case 'sum':
        return acc.sum[g]!
      case 'avg':
        return acc.sum[g]! / acc.n[g]!
      case 'min':
        return acc.min[g]!
      case 'max':
        return acc.max[g]!
      default:
        return null
    }
  }

  function totals(idx: Uint32Array, plan: QueryPlan): TData {
    const aggs = plan.aggregations ?? []
    const acc = accumulate(idx, null, 1, aggs)
    const out: Record<string, unknown> = {}
    for (const agg of aggs) out[agg.field] = valueOf(acc.get(agg.field)!, 0, agg.fn)
    return out as TData
  }

  // ---- answering ----------------------------------------------------------

  function supported(plan: QueryPlan): boolean {
    return !plan.expression && !plan.pivotBy?.length
  }

  function prepare(plan: QueryPlan): Prepared<TData> | null {
    const key = JSON.stringify({ ...plan, limit: 0, offset: 0 })
    const hit = cache.get(key)
    if (hit) {
      cache.delete(key)
      cache.set(key, hit)
      return hit
    }
    const prepared = run(plan)
    if (!prepared) return null
    cache.set(key, prepared)
    if (cache.size > RESULT_CACHE_SIZE) cache.delete(cache.keys().next().value!)
    return prepared
  }

  function run(plan: QueryPlan): Prepared<TData> | null {
    const idx = select(plan.where, plan.search)
    const out: Prepared<TData> = {}
    if (plan.grandTotal) {
      const filtersOnly = plan.where.slice(0, plan.where.length - (plan.pathPredicates ?? 0))
      const all = filtersOnly.length === plan.where.length ? idx : select(filtersOnly, plan.search)
      out.grandTotal = totals(all, plan)
    }

    if (!plan.groupBy) {
      const order = plan.orderBy.length ? sortIndexes(idx, plan.orderBy) : idx
      if (!order) return null
      out.order = order
      return out
    }

    // Groups in order of first appearance, as the reference's Map buckets are.
    const groupField = plan.groupBy
    const gcol = column(groupField)
    const { keyOf, keys } = keyed(gcol)
    const slot = new Int32Array(keys.length).fill(-1)
    const groupKeys: number[] = []
    const gcodes = gcol.codes
    const rowGroup = new Uint32Array(idx.length)
    for (let i = 0; i < idx.length; i += 1) {
      const k = keyOf[gcodes[idx[i]!]!]!
      let g = slot[k]!
      if (g < 0) {
        g = groupKeys.length
        slot[k] = g
        groupKeys.push(k)
      }
      rowGroup[i] = g
    }
    const groupCount = groupKeys.length
    const acc = accumulate(idx, rowGroup, groupCount, plan.aggregations ?? [])

    const childCounts = new Float64Array(groupCount)
    if (plan.childGroupBy) {
      const ccol = column(plan.childGroupBy)
      const { keyOf: childKeyOf, keys: childKeys } = keyed(ccol)
      const seen = new Set<number>()
      for (let i = 0; i < idx.length; i += 1) {
        const g = rowGroup[i]!
        const c = childKeyOf[ccol.codes[idx[i]!]!]!
        const pair = g * childKeys.length + c
        if (!seen.has(pair)) {
          seen.add(pair)
          childCounts[g]! += 1
        }
      }
    } else {
      for (let i = 0; i < idx.length; i += 1) childCounts[rowGroup[i]!]! += 1
    }

    const groups: TData[] = groupKeys.map((k, g) => {
      const row: Record<string, unknown> = { [groupField]: keys[k] }
      for (const agg of plan.aggregations ?? []) row[agg.field] = valueOf(acc.get(agg.field)!, g, agg.fn)
      row.childCount = childCounts[g]
      return row as TData
    })
    const produced = new Set<string>([groupField, ...(plan.aggregations ?? []).map((a) => a.field)])
    const groupOrder = plan.orderBy.filter((o) => produced.has(o.field))
    out.groups = groupOrder.length
      ? sortRows(groups, groupOrder)
      : sortRows(groups, [{ field: groupField, desc: false }])
    return out
  }

  const counts = { columnar: 0, reference: 0 }

  return {
    async getRows(request: ServerRequest): Promise<ServerResult<TData>> {
      const plan = planQuery(schema, request)
      const prepared = supported(plan) ? prepare(plan) : null
      if (!prepared) {
        counts.reference += 1
        return reference.getRows(request)
      }
      counts.columnar += 1
      const from = plan.offset
      const to = plan.offset + plan.limit
      const total = prepared.groups ? prepared.groups.length : prepared.order!.length
      const rows = prepared.groups
        ? prepared.groups.slice(from, to)
        : Array.from(prepared.order!.subarray(from, Math.min(to, total)), (i) => store[i]!)
      return {
        rows,
        rowCount: total,
        appliedExpression: false,
        ...(prepared.grandTotal !== undefined ? { grandTotal: prepared.grandTotal } : {}),
      }
    },
    async createRow(input: Partial<TData>): Promise<TData> {
      const row = await reference.createRow(input)
      invalidate()
      return row
    },
    async updateRow(id: string, patch: Partial<TData>): Promise<TData> {
      const row = await reference.updateRow(id, patch)
      invalidate()
      return row
    },
    async deleteRow(id: string): Promise<void> {
      await reference.deleteRow(id)
      invalidate()
    },
    async updateWhere(
      filterModel: ServerRequest['filterModel'],
      patch: Partial<TData>,
      selection: ServerSelectionRule,
    ): Promise<number> {
      const changed = await reference.updateWhere(filterModel, patch, selection)
      invalidate()
      return changed
    },
    getAggregate: (request) => reference.getAggregate(request),
    rows: () => store,
    stats: () => ({ ...counts }),
    warm(): boolean {
      while (warmed < fields.length) {
        const field = fields[warmed++]!
        const existing = columns.get(field)
        if (existing?.ranks !== undefined && existing.keyOf && existing.nums) continue
        // Everything a sort, a grouping and an aggregate read, so none of
        // them pays for it on the first click.
        const col = column(field)
        ranked(col)
        keyed(col)
        numbers(col)
        return true
      }
      return false
    },
  }
}
