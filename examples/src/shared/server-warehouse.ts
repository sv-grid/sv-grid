/**
 * A columnar in-memory "server" for the server-side row model demos: one
 * million sales rows the grid never sees wholesale, implementing the full
 * `ServerDataSource` contract - flat paging, sort, filter, global search, the
 * advanced-filter expression, grouping one level at a time with aggregates
 * and child counts, grand totals, pivot, row CRUD, bulk edit by rule, and
 * set-filter values.
 *
 * Rows live as typed arrays (dictionary codes for the text columns, a
 * Float64Array for the amount, day numbers for the date), about 40 MB for a
 * million rows rather than a million objects. A request materialises only
 * the block it returns. Sort orders and filter masks are cached, so the
 * first sort on a column costs a pass and the blocks after it cost a slice.
 *
 * `server-warehouse.test.ts` holds it to `createInMemoryDataSource`, the
 * reference backend, on a sample: same rows, same counts, same aggregates,
 * for every request shape the row model sends.
 */
import type {
  GridPredicateExpr,
  ServerDataSource,
  ServerFilterModel,
  ServerRequest,
  ServerResult,
  ServerSelectionRule,
  ServerSortModel,
} from '@svgrid/grid'
import { createPrng } from './mock-api'

export type WarehouseRow = {
  id: number
  region: string
  country: string
  rep: string
  product: string
  category: string
  status: string
  year: string
  quarter: string
  date: string
  amount: number
  qty: number
}

/** One request as the log panel shows it. */
export type WarehouseLogEntry = {
  seq: number
  kind: 'flat' | 'group' | 'leaf' | 'pivot' | 'total' | 'create' | 'update' | 'delete' | 'bulk' | 'values'
  route: string[]
  range: string
  ms: number
  rows: number
  /** True when the sort order and the filter mask were both already cached. */
  cached: boolean
  failed?: boolean
}

export type WarehouseOptions = {
  /** Rows to generate. Default 1,000,000. */
  rows?: number
  seed?: number
  /** Simulated latency, min and max milliseconds. Default 40 to 120. */
  latencyMs?: [number, number]
  /** Share of requests that fail, 0 to 1. Default 0. */
  failureRate?: number
  onRequest?: (entry: WarehouseLogEntry) => void
  /**
   * Compiles `filterModel.expression` (the advanced filter) into a row test.
   * The evaluator lives in the Enterprise package - pass its
   * `compilePredicate` from the demo; without it the expression is ignored
   * and the result carries no `appliedExpression`, as the contract asks.
   */
  compileExpression?: (expr: GridPredicateExpr) => ((row: WarehouseRow) => boolean) | null
}

export type Warehouse = ServerDataSource<WarehouseRow> & {
  createRow(input: Partial<WarehouseRow>): Promise<WarehouseRow>
  updateRow(id: string, patch: Partial<WarehouseRow>): Promise<WarehouseRow>
  deleteRow(id: string): Promise<void>
  updateWhere(filterModel: ServerFilterModel, patch: Partial<WarehouseRow>, selection: ServerSelectionRule): Promise<number>
  /** Distinct values of a text column, for the set filter. */
  filterValues(columnId: string): Promise<string[]>
  setLatency(range: [number, number]): void
  setFailureRate(rate: number): void
  /** Live rows (created minus deleted). */
  size(): number
  /** Bytes held by the column arrays. */
  memoryBytes(): number
  /** A row by id, or null. Synchronous; for the demo's own chrome. */
  rowById(id: number): WarehouseRow | null
}

// ------------------------------------------------------------ dictionaries

const REGIONS: Record<string, string[]> = {
  Americas: ['United States', 'Canada', 'Brazil', 'Mexico'],
  EMEA: ['Germany', 'United Kingdom', 'France', 'Spain', 'Netherlands'],
  APAC: ['Japan', 'Australia', 'India', 'Singapore'],
  LATAM: ['Argentina', 'Chile', 'Colombia'],
}
const CATEGORIES: Record<string, string[]> = {
  Hardware: ['Laptop', 'Monitor', 'Keyboard', 'Dock', 'Headset', 'Webcam'],
  Software: ['Suite', 'Analytics', 'Security', 'Backup', 'Design'],
  Services: ['Training', 'Support', 'Consulting', 'Migration'],
  Cloud: ['Compute', 'Storage', 'Database', 'CDN'],
}
const STATUSES = ['Paid', 'Open', 'Overdue', 'Refunded']
const FIRST = ['Ada', 'Grace', 'Linus', 'Ken', 'Barbara', 'Dennis', 'Margaret', 'Alan', 'Edsger', 'Donald', 'Radia', 'Tim', 'Vint', 'Hedy', 'Anita', 'Frances']
const LAST = ['Lovelace', 'Hopper', 'Torvalds', 'Thompson', 'Liskov', 'Ritchie', 'Hamilton', 'Turing', 'Dijkstra', 'Knuth', 'Perlman', 'Lee']

const DAY0 = Date.UTC(2022, 0, 1)
const dayToIso = (day: number): string => new Date(DAY0 + day * 86_400_000).toISOString().slice(0, 10)
const isoToDay = (iso: string): number => Math.round((Date.parse(iso) - DAY0) / 86_400_000)
const yearOfDay = (day: number): number => new Date(DAY0 + day * 86_400_000).getUTCFullYear()
const quarterOfDay = (day: number): number => Math.floor(new Date(DAY0 + day * 86_400_000).getUTCMonth() / 3) + 1

/** A text column stored as codes into a label list. */
type Dict = {
  labels: string[]
  /** Label -> code. */
  index: Map<string, number>
  /** Code -> position in the label order the reference sorts by. */
  rank: Int32Array
  lower: string[]
}
function dict(labels: string[]): Dict {
  const index = new Map(labels.map((l, i) => [l, i]))
  const order = labels.map((_, i) => i).sort((a, b) => labels[a]!.localeCompare(labels[b]!))
  const rank = new Int32Array(labels.length)
  order.forEach((code, pos) => (rank[code] = pos))
  return { labels, index, rank, lower: labels.map((l) => l.toLowerCase()) }
}

type TextCol = 'region' | 'country' | 'rep' | 'product' | 'category' | 'status' | 'year' | 'quarter'
type NumCol = 'id' | 'amount' | 'qty'
const TEXT_COLS: TextCol[] = ['region', 'country', 'rep', 'product', 'category', 'status', 'year', 'quarter']
const isTextCol = (c: string): c is TextCol => (TEXT_COLS as string[]).includes(c)
const isNumCol = (c: string): c is NumCol => c === 'id' || c === 'amount' || c === 'qty'

const asString = (v: unknown): string => (v == null ? '' : String(v))
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v))

// ------------------------------------------------------------------ store

export function createWarehouse(options: WarehouseOptions = {}): Warehouse {
  const total = options.rows ?? 1_000_000
  const prng = createPrng(options.seed ?? 0x5eed)
  let latency = options.latencyMs ?? [40, 120]
  let failureRate = options.failureRate ?? 0

  // Dictionaries. Countries belong to a region, products to a category, so
  // the group tree is a real hierarchy.
  const regionD = dict(Object.keys(REGIONS))
  const countryD = dict(Object.values(REGIONS).flat())
  const countryRegion = new Uint8Array(countryD.labels.length)
  Object.entries(REGIONS).forEach(([r, cs]) => cs.forEach((c) => (countryRegion[countryD.index.get(c)!] = regionD.index.get(r)!)))
  const categoryD = dict(Object.keys(CATEGORIES))
  const productD = dict(Object.values(CATEGORIES).flat())
  const productCategory = new Uint8Array(productD.labels.length)
  Object.entries(CATEGORIES).forEach(([c, ps]) => ps.forEach((p) => (productCategory[productD.index.get(p)!] = categoryD.index.get(c)!)))
  const statusD = dict(STATUSES)
  const reps: string[] = []
  for (const l of LAST) for (const f of FIRST) reps.push(`${f} ${l}`)
  const repD = dict(reps)
  const yearD = dict(['2022', '2023', '2024', '2025', '2026'])
  const quarterD = dict(['Q1', 'Q2', 'Q3', 'Q4'])
  const dicts: Record<TextCol, Dict> = {
    region: regionD, country: countryD, rep: repD, product: productD, category: categoryD, status: statusD, year: yearD, quarter: quarterD,
  }

  // Columns. `count` rows are in use; a deleted row keeps its slot with
  // `alive` cleared so ids stay stable.
  let capacity = total + 10_000
  let count = 0
  let alive = new Uint8Array(capacity)
  let country = new Uint8Array(capacity)
  let rep = new Uint16Array(capacity)
  let product = new Uint8Array(capacity)
  let status = new Uint8Array(capacity)
  let day = new Int32Array(capacity)
  // Year and quarter as codes, kept beside the day so a group or pivot by
  // them never builds a Date per row.
  let yearCode = new Uint8Array(capacity)
  let quarterCode = new Uint8Array(capacity)
  let amount = new Float64Array(capacity)
  let qty = new Uint16Array(capacity)
  let liveCount = 0

  function grow(): void {
    capacity = Math.ceil(capacity * 1.5)
    const copy = <T extends { length: number }>(make: (n: number) => T, from: T): T => {
      const next = make(capacity)
      ;(next as unknown as { set(a: unknown): void }).set(from)
      return next
    }
    alive = copy((n) => new Uint8Array(n), alive)
    country = copy((n) => new Uint8Array(n), country)
    rep = copy((n) => new Uint16Array(n), rep)
    product = copy((n) => new Uint8Array(n), product)
    status = copy((n) => new Uint8Array(n), status)
    day = copy((n) => new Int32Array(n), day)
    yearCode = copy((n) => new Uint8Array(n), yearCode)
    quarterCode = copy((n) => new Uint8Array(n), quarterCode)
    amount = copy((n) => new Float64Array(n), amount)
    qty = copy((n) => new Uint16Array(n), qty)
  }

  function setDay(i: number, d: number): void {
    day[i] = d
    yearCode[i] = yearOfDay(d) - 2022
    quarterCode[i] = quarterOfDay(d) - 1
  }

  for (let i = 0; i < total; i += 1) {
    alive[i] = 1
    country[i] = prng.int(0, countryD.labels.length - 1)
    rep[i] = prng.int(0, repD.labels.length - 1)
    product[i] = prng.int(0, productD.labels.length - 1)
    status[i] = prng.next() < 0.7 ? 0 : prng.int(1, 3)
    setDay(i, prng.int(0, 4 * 365))
    amount[i] = Math.round(prng.next() * prng.next() * 20_000 * 100) / 100 + 5
    qty[i] = prng.int(1, 40)
  }
  count = total
  liveCount = total

  // ---- reading a cell as the grid sees it --------------------------------

  const codeOf = (col: TextCol, i: number): number => {
    switch (col) {
      case 'region': return countryRegion[country[i]!]!
      case 'country': return country[i]!
      case 'rep': return rep[i]!
      case 'product': return product[i]!
      case 'category': return productCategory[product[i]!]!
      case 'status': return status[i]!
      case 'year': return yearCode[i]!
      case 'quarter': return quarterCode[i]!
    }
  }
  const numOf = (col: NumCol, i: number): number => (col === 'id' ? i + 1 : col === 'amount' ? amount[i]! : qty[i]!)
  const cell = (col: string, i: number): unknown => {
    if (isTextCol(col)) return dicts[col].labels[codeOf(col, i)]
    if (isNumCol(col)) return numOf(col, i)
    if (col === 'date') return dayToIso(day[i]!)
    return undefined
  }
  function materialize(i: number): WarehouseRow {
    return {
      id: i + 1,
      region: regionD.labels[countryRegion[country[i]!]!]!,
      country: countryD.labels[country[i]!]!,
      rep: repD.labels[rep[i]!]!,
      product: productD.labels[product[i]!]!,
      category: categoryD.labels[productCategory[product[i]!]!]!,
      status: statusD.labels[status[i]!]!,
      year: yearD.labels[yearCode[i]!]!,
      quarter: quarterD.labels[quarterCode[i]!]!,
      date: dayToIso(day[i]!),
      amount: amount[i]!,
      qty: qty[i]!,
    }
  }

  // ---- filters -> a mask ---------------------------------------------------

  type Test = (i: number) => boolean

  /** The test for one column filter, or null when it filters nothing. */
  function columnTest(col: string, f: { operator: string; value: string; valueTo?: string; selectedValues?: string[] }): Test | null {
    if (f.selectedValues?.length) {
      const wanted = new Set(f.selectedValues.map(asString))
      return (i) => wanted.has(asString(cell(col, i)))
    }
    const value = (f.value ?? '').trim()
    const lower = value.toLowerCase()
    if (isTextCol(col)) {
      const d = dicts[col]
      const codes = (pred: (label: string) => boolean): Set<number> => {
        const out = new Set<number>()
        d.lower.forEach((l, code) => pred(l) && out.add(code))
        return out
      }
      let set: Set<number> | null = null
      switch (f.operator) {
        case 'equals': if (value) set = codes((l) => l === lower); break
        case 'notEquals': if (value) set = codes((l) => l !== lower); break
        case 'contains': if (value) set = codes((l) => l.includes(lower)); break
        case 'notContains': if (value) set = codes((l) => !l.includes(lower)); break
        case 'startsWith': if (value) set = codes((l) => l.startsWith(lower)); break
        case 'endsWith': if (value) set = codes((l) => l.endsWith(lower)); break
        case 'isBlank': set = new Set(); break
        case 'isNotBlank': return null
        default: if (value) set = codes((l) => l.includes(lower))
      }
      if (!set) return null
      const s = set
      return (i) => s.has(codeOf(col, i))
    }
    if (isNumCol(col)) {
      if (f.operator === 'isBlank') return () => false
      if (f.operator === 'isNotBlank') return null
      const v = Number(value)
      if (value === '' || Number.isNaN(v)) return null
      switch (f.operator) {
        case 'equals': return (i) => numOf(col, i) === v
        case 'notEquals': return (i) => numOf(col, i) !== v
        case 'greaterThan': return (i) => numOf(col, i) > v
        case 'greaterThanOrEqual': return (i) => numOf(col, i) >= v
        case 'lessThan': return (i) => numOf(col, i) < v
        case 'lessThanOrEqual': return (i) => numOf(col, i) <= v
        case 'between': {
          const to = Number((f.valueTo ?? '').trim() || value)
          return (i) => numOf(col, i) >= v && numOf(col, i) <= to
        }
        default: return null
      }
    }
    if (col === 'date') {
      if (!value) return null
      // ISO strings compare like days; the reference compares them as text.
      const d = isoToDay(value)
      if (Number.isNaN(d)) return null
      switch (f.operator) {
        case 'equals': return (i) => day[i] === d
        case 'greaterThan': return (i) => day[i]! > d
        case 'lessThan': return (i) => day[i]! < d
        case 'between': {
          const to = isoToDay((f.valueTo ?? '').trim() || value)
          return (i) => day[i]! >= d && day[i]! <= to
        }
        case 'contains': case 'startsWith': {
          return (i) => dayToIso(day[i]!).includes(value)
        }
        default: return null
      }
    }
    return null
  }

  function searchTest(term: string): Test | null {
    const lower = term.trim().toLowerCase()
    if (!lower) return null
    const sets = TEXT_COLS.map((c) => {
      const out = new Set<number>()
      dicts[c].lower.forEach((l, code) => l.includes(lower) && out.add(code))
      return [c, out] as const
    }).filter(([, s]) => s.size > 0)
    if (sets.length === 0) return () => false
    return (i) => sets.some(([c, s]) => s.has(codeOf(c, i)))
  }

  /**
   * A cache entry remembers the columns it was computed from, so a write
   * to one column drops only what read that column: an edit of `amount`
   * leaves the order by `rep` and the mask on `region` alone.
   */
  type Cached<T> = { value: T; cols: Set<string> }
  const ALL = new Set<string>(['*'])
  function remember<T>(cache: Map<string, Cached<T>>, key: string, value: T, cols: Set<string>, limit: number): void {
    if (cache.size >= limit) cache.delete(cache.keys().next().value!)
    cache.set(key, { value, cols })
  }
  function forget<T>(cache: Map<string, Cached<T>>, changed: Set<string> | null): void {
    if (!changed) {
      cache.clear()
      return
    }
    for (const [key, entry] of cache) {
      if (entry.cols.has('*')) cache.delete(key)
      else for (const c of changed) if (entry.cols.has(c)) { cache.delete(key); break }
    }
  }
  /** The columns a filter model reads. Search reads every text column. */
  function filterCols(filterModel: ServerFilterModel): Set<string> {
    if (filterModel?.expression) return ALL
    const cols = new Set<string>(Object.keys(filterModel?.columns ?? {}))
    if (filterModel?.global) for (const c of TEXT_COLS) cols.add(c)
    return cols
  }

  const maskCache = new Map<string, Cached<Uint8Array>>()
  /** One byte per row: 1 where the filter model admits it. */
  function maskFor(filterModel: ServerFilterModel): { mask: Uint8Array; hit: boolean } {
    const key = JSON.stringify(filterModel ?? {})
    const cached = maskCache.get(key)
    if (cached) return { mask: cached.value, hit: true }
    const tests: Test[] = []
    for (const [col, f] of Object.entries(filterModel?.columns ?? {})) {
      const t = columnTest(col, f)
      if (t) tests.push(t)
    }
    const s = filterModel?.global ? searchTest(filterModel.global) : null
    if (s) tests.push(s)
    if (filterModel?.expression && options.compileExpression) {
      const fn = options.compileExpression(filterModel.expression)
      if (fn) tests.push((i) => fn(materialize(i)))
    }
    const mask = new Uint8Array(count)
    for (let i = 0; i < count; i += 1) {
      if (!alive[i]) continue
      let ok = true
      for (const t of tests) if (!t(i)) { ok = false; break }
      mask[i] = ok ? 1 : 0
    }
    remember(maskCache, key, mask, filterCols(filterModel), 8)
    return { mask, hit: false }
  }
  /**
   * A write drops the caches that read the changed columns; a row added
   * or removed (`null`) drops them all, since every index shifts.
   */
  function invalidate(changed: Set<string> | null): void {
    forget(maskCache, changed)
    forget(orderCache, changed)
    forget(routeCache, changed)
  }

  // ---- sort -> an index order ----------------------------------------------

  function comparator(sortModel: ServerSortModel): ((a: number, b: number) => number) | null {
    const keys = sortModel
      .map((s) => {
        const dir = s.desc ? -1 : 1
        if (isTextCol(s.id)) {
          const rank = dicts[s.id].rank
          const col = s.id
          return (a: number, b: number) => dir * (rank[codeOf(col, a)]! - rank[codeOf(col, b)]!)
        }
        if (isNumCol(s.id)) {
          const col = s.id
          return (a: number, b: number) => dir * (numOf(col, a) - numOf(col, b))
        }
        if (s.id === 'date') return (a: number, b: number) => dir * (day[a]! - day[b]!)
        return null
      })
      .filter((k): k is (a: number, b: number) => number => k !== null)
    if (keys.length === 0) return null
    return (a, b) => {
      for (const k of keys) {
        const c = k(a, b)
        if (c !== 0) return c
      }
      return a - b
    }
  }

  const orderCache = new Map<string, Cached<Uint32Array>>()
  /** Every live row index in sort order (the filter is applied afterwards). */
  function orderFor(sortModel: ServerSortModel): { order: Uint32Array; hit: boolean } {
    const sorted = sortModel.filter((s) => isTextCol(s.id) || isNumCol(s.id) || s.id === 'date')
    const key = JSON.stringify(sorted)
    const cached = orderCache.get(key)
    if (cached) return { order: cached.value, hit: true }
    const order = new Uint32Array(count)
    for (let i = 0; i < count; i += 1) order[i] = i
    const cmp = comparator(sortModel)
    if (cmp) order.sort(cmp)
    remember(orderCache, key, order, new Set(sorted.map((s) => s.id)), 8)
    return { order, hit: false }
  }

  // ---- routes -> the rows under a group path --------------------------------

  const routeCache = new Map<string, Cached<Uint32Array>>()
  /**
   * The sorted, filtered row indices under `groupKeys` (all of them for the
   * root). Cached per (sort, filter, path) so every block of a level is a
   * slice.
   */
  function rowsUnder(req: ServerRequest): { rows: Uint32Array; hit: boolean } {
    const groupBy = req.groupBy ?? []
    const keys = req.groupKeys ?? []
    const cacheKey = JSON.stringify([req.sortModel, req.filterModel ?? {}, groupBy.slice(0, keys.length), keys])
    const cached = routeCache.get(cacheKey)
    if (cached) return { rows: cached.value, hit: true }
    const { order, hit: orderHit } = orderFor(req.sortModel)
    const { mask, hit: maskHit } = maskFor(req.filterModel)
    const path = keys.map((k, i) => {
      const col = groupBy[i]!
      if (isTextCol(col)) return { col, code: dicts[col].index.get(k) ?? -1 }
      return { col, code: -1, text: k }
    })
    const out: number[] = []
    for (let n = 0; n < order.length; n += 1) {
      const i = order[n]!
      if (!mask[i]) continue
      let ok = true
      for (const p of path) {
        if (isTextCol(p.col) ? codeOf(p.col, i) !== p.code : asString(cell(p.col, i)) !== p.text) { ok = false; break }
      }
      if (ok) out.push(i)
    }
    const rows = Uint32Array.from(out)
    const cols = new Set<string>([...filterCols(req.filterModel), ...req.sortModel.map((s) => s.id), ...groupBy.slice(0, keys.length)])
    remember(routeCache, cacheKey, rows, cols, 32)
    return { rows, hit: orderHit && maskHit }
  }

  // ---- aggregates -------------------------------------------------------------

  type Acc = { sum: number; n: number; min: number; max: number; count: number }
  const acc = (): Acc => ({ sum: 0, n: 0, min: Infinity, max: -Infinity, count: 0 })
  function feed(a: Acc, col: string, i: number): void {
    a.count += 1
    const v = isNumCol(col) ? numOf(col, i) : Number(cell(col, i))
    if (!Number.isFinite(v)) return
    a.sum += v
    a.n += 1
    if (v < a.min) a.min = v
    if (v > a.max) a.max = v
  }
  function finish(a: Acc, fn: string): number | null {
    if (fn === 'count') return a.count
    if (a.n === 0) return null
    switch (fn) {
      case 'sum': return a.sum
      case 'avg': return a.sum / a.n
      case 'min': return a.min
      case 'max': return a.max
      default: return null
    }
  }

  /** Aggregates of `rows` into `out`, plain or split per pivot path. */
  function aggregateInto(out: Record<string, unknown>, rows: ArrayLike<number>, req: ServerRequest, paths?: Set<string>): void {
    const aggs = req.aggregations ?? []
    const pivot = req.pivotMode && req.pivotBy?.length ? req.pivotBy : null
    if (!pivot) {
      const accs = aggs.map(acc)
      for (let n = 0; n < rows.length; n += 1) {
        const i = rows[n]!
        for (let k = 0; k < aggs.length; k += 1) feed(accs[k]!, aggs[k]!.col, i)
      }
      aggs.forEach((a, k) => (out[a.col] = finish(accs[k]!, a.fn)))
      return
    }
    // Text pivot columns key the cell by a mixed-radix code and only turn
    // it into a label path once per cell; anything else keys by string.
    const textPivot = pivot.every(isTextCol) ? (pivot as TextCol[]) : null
    const cells = new Map<string | number, Acc[]>()
    const pathOf = (i: number): string | number => {
      if (!textPivot) return pivot.map((p) => asString(cell(p, i))).join('_')
      let code = 0
      for (const p of textPivot) code = code * dicts[p].labels.length + codeOf(p, i)
      return code
    }
    const labelOf = (key: string | number): string => {
      if (typeof key === 'string' || !textPivot) return String(key)
      const parts: string[] = []
      let rest = key
      for (let k = textPivot.length - 1; k >= 0; k -= 1) {
        const d = dicts[textPivot[k]!]
        parts.unshift(d.labels[rest % d.labels.length]!)
        rest = Math.floor(rest / d.labels.length)
      }
      return parts.join('_')
    }
    for (let n = 0; n < rows.length; n += 1) {
      const i = rows[n]!
      const key = pathOf(i)
      let accs = cells.get(key)
      if (!accs) {
        accs = aggs.map(acc)
        cells.set(key, accs)
      }
      for (let k = 0; k < aggs.length; k += 1) feed(accs[k]!, aggs[k]!.col, i)
    }
    for (const [key, accs] of cells) {
      const path = labelOf(key)
      paths?.add(path)
      aggs.forEach((a, k) => (out[`${path}_${a.col}`] = finish(accs[k]!, a.fn)))
    }
  }

  // ---- the request handlers ----------------------------------------------------

  let seq = 0
  const sleep = () => new Promise<void>((r) => setTimeout(r, latency[0] + Math.random() * Math.max(0, latency[1] - latency[0])))
  async function serve<T>(kind: WarehouseLogEntry['kind'], req: Partial<ServerRequest>, work: () => { result: T; rows: number; cached: boolean }): Promise<T> {
    const started = performance.now()
    const entry: WarehouseLogEntry = {
      seq: (seq += 1),
      kind,
      route: [...(req.groupKeys ?? [])],
      range: req.startRow != null ? `${req.startRow}-${req.endRow}` : '',
      ms: 0,
      rows: 0,
      cached: false,
    }
    await sleep()
    if (failureRate > 0 && Math.random() < failureRate) {
      entry.ms = Math.round(performance.now() - started)
      entry.failed = true
      options.onRequest?.(entry)
      throw new Error('The warehouse timed out (simulated)')
    }
    const { result, rows, cached } = work()
    entry.ms = Math.round(performance.now() - started)
    entry.rows = rows
    entry.cached = cached
    options.onRequest?.(entry)
    return result
  }

  function groupLevel(req: ServerRequest): { result: ServerResult<WarehouseRow>; rows: number; cached: boolean } {
    const groupBy = req.groupBy!
    const keys = req.groupKeys ?? []
    const field = groupBy[keys.length]!
    const nextField = groupBy[keys.length + 1]
    // Groups are sorted after bucketing; the leaves under them need no
    // order, so a cold sort is not paid here.
    const { rows, hit } = rowsUnder({ ...req, sortModel: [] })
    // One bucket per key, in first-seen order; sorted after. A text column
    // buckets by dictionary code, so a million rows cost no strings.
    const buckets = new Map<string, number[]>()
    if (isTextCol(field)) {
      const byCode: Array<number[] | undefined> = []
      for (let n = 0; n < rows.length; n += 1) {
        const i = rows[n]!
        const c = codeOf(field, i)
        ;(byCode[c] ??= []).push(i)
      }
      byCode.forEach((idx, c) => idx && buckets.set(dicts[field].labels[c]!, idx))
    } else {
      for (let n = 0; n < rows.length; n += 1) {
        const i = rows[n]!
        const k = asString(cell(field, i))
        const b = buckets.get(k)
        if (b) b.push(i)
        else buckets.set(k, [i])
      }
    }
    const pivot = req.pivotMode && req.pivotBy?.length
    const paths = new Set<string>()
    let groups = [...buckets].map(([k, idx]) => {
      const out: Record<string, unknown> = { [field]: k }
      aggregateInto(out, idx, req, pivot ? paths : undefined)
      out.childCount = nextField ? new Set(idx.map((i) => asString(cell(nextField, i)))).size : idx.length
      return out
    })
    // Sort by what a group row produces: the key, or (outside pivot) an
    // aggregate; else the key. Numbers compare as numbers, text as text.
    const produced = new Set<string>([field, ...(pivot ? [] : (req.aggregations ?? []).map((a) => a.col))])
    const order = req.sortModel.filter((s) => produced.has(s.id))
    const by = order.length ? order : [{ id: field, desc: false }]
    groups = groups
      .map((g, index) => ({ g, index }))
      .sort((a, b) => {
        for (const { id, desc } of by) {
          const av = a.g[id]
          const bv = b.g[id]
          const c = typeof av === 'number' && typeof bv === 'number' ? av - bv : asString(av).localeCompare(asString(bv))
          if (c !== 0) return desc ? -c : c
        }
        return a.index - b.index
      })
      .map((d) => d.g)
    if (pivot) {
      const fields = [...paths]
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        .flatMap((p) => (req.aggregations ?? []).map((a) => `${p}_${a.col}`))
      for (const g of groups) for (const f of fields) if (!(f in g)) g[f] = null
      const page = groups.slice(req.startRow, req.endRow) as unknown as WarehouseRow[]
      return {
        result: { rows: page, rowCount: groups.length, pivotResultFields: fields, ...grandTotal(req) },
        rows: page.length,
        cached: hit,
      }
    }
    const page = groups.slice(req.startRow, req.endRow) as unknown as WarehouseRow[]
    return { result: { rows: page, rowCount: groups.length, ...grandTotal(req) }, rows: page.length, cached: hit }
  }

  function grandTotal(req: ServerRequest): { grandTotal?: WarehouseRow } {
    if (!req.needsGrandTotal) return {}
    const { mask } = maskFor(req.filterModel)
    const all: number[] = []
    for (let i = 0; i < count; i += 1) if (mask[i]) all.push(i)
    const out: Record<string, unknown> = {}
    aggregateInto(out, all, req)
    return { grandTotal: out as unknown as WarehouseRow }
  }

  function leaves(req: ServerRequest): { result: ServerResult<WarehouseRow>; rows: number; cached: boolean } {
    const { rows, hit } = rowsUnder(req)
    const page: WarehouseRow[] = []
    for (let n = req.startRow; n < Math.min(req.endRow, rows.length); n += 1) page.push(materialize(rows[n]!))
    const result: ServerResult<WarehouseRow> = { rows: page, rowCount: rows.length, ...grandTotal(req) }
    if (req.filterModel?.expression && options.compileExpression) result.appliedExpression = true
    return { result, rows: page.length, cached: hit }
  }

  const indexOfId = (id: string | number): number => {
    const i = Number(id) - 1
    return Number.isInteger(i) && i >= 0 && i < count && alive[i] ? i : -1
  }

  /** The columns a patch changes, as the caches see them (a country moves the region too). */
  function touched(patch: Partial<WarehouseRow>): Set<string> {
    const cols = new Set<string>()
    if (patch.country != null || patch.region != null) cols.add('country').add('region')
    if (patch.rep != null) cols.add('rep')
    if (patch.product != null) cols.add('product').add('category')
    if (patch.status != null) cols.add('status')
    if (patch.date != null) cols.add('date').add('year').add('quarter')
    if (patch.amount != null) cols.add('amount')
    if (patch.qty != null) cols.add('qty')
    return cols
  }

  function applyPatch(i: number, patch: Partial<WarehouseRow>): void {
    if (patch.country != null) {
      const c = countryD.index.get(String(patch.country))
      if (c != null) country[i] = c
    }
    if (patch.region != null && patch.country == null) {
      // A region alone moves the row to that region's first country.
      const r = regionD.index.get(String(patch.region))
      if (r != null) country[i] = countryD.index.get(REGIONS[regionD.labels[r]!]![0]!)!
    }
    if (patch.rep != null) {
      const c = repD.index.get(String(patch.rep))
      if (c != null) rep[i] = c
    }
    if (patch.product != null) {
      const c = productD.index.get(String(patch.product))
      if (c != null) product[i] = c
    }
    if (patch.status != null) {
      const c = statusD.index.get(String(patch.status))
      if (c != null) status[i] = c
    }
    if (patch.date != null) {
      const d = isoToDay(String(patch.date))
      if (!Number.isNaN(d)) setDay(i, d)
    }
    if (patch.amount != null && Number.isFinite(num(patch.amount))) amount[i] = num(patch.amount)
    if (patch.qty != null && Number.isFinite(num(patch.qty))) qty[i] = Math.max(0, Math.round(num(patch.qty)))
  }

  const warehouse: Warehouse = {
    getRows(req) {
      const groupBy = req.groupBy ?? []
      const keys = req.groupKeys ?? []
      if (groupBy.length && keys.length < groupBy.length) {
        return serve(req.pivotMode && req.pivotBy?.length ? 'pivot' : 'group', req, () => groupLevel(req))
      }
      return serve(keys.length ? 'leaf' : 'flat', req, () => leaves(req))
    },
    async createRow(input) {
      return serve('create', {}, () => {
        if (count >= capacity) grow()
        const i = count
        count += 1
        liveCount += 1
        alive[i] = 1
        country[i] = 0
        rep[i] = 0
        product[i] = 0
        status[i] = 1
        setDay(i, 4 * 365)
        amount[i] = 0
        qty[i] = 1
        applyPatch(i, input)
        invalidate(null)
        return { result: materialize(i), rows: 1, cached: false }
      })
    },
    async updateRow(id, patch) {
      return serve('update', {}, () => {
        const i = indexOfId(id)
        if (i < 0) throw new Error(`No row with id ${id}`)
        applyPatch(i, patch)
        invalidate(touched(patch))
        return { result: materialize(i), rows: 1, cached: false }
      })
    },
    async deleteRow(id) {
      await serve('delete', {}, () => {
        const i = indexOfId(id)
        if (i < 0) throw new Error(`No row with id ${id}`)
        alive[i] = 0
        liveCount -= 1
        invalidate(null)
        return { result: undefined, rows: 1, cached: false }
      })
    },
    async updateWhere(filterModel, patch, selection) {
      return serve('bulk', {}, () => {
        const { mask } = maskFor(filterModel)
        const groupBy: string[] = (selection as { groupBy?: string[] }).groupBy ?? []
        const selected = (i: number): boolean => {
          if ('selectAll' in selection) {
            const toggled = new Set(selection.toggled)
            return selection.selectAll !== toggled.has(String(i + 1))
          }
          let node: { selectAllChildren: boolean; toggled: Record<string, unknown> } = selection
          let state = selection.selectAllChildren
          for (const key of [...groupBy.map((g) => asString(cell(g, i))), String(i + 1)]) {
            const next = node.toggled[key] as typeof node | undefined
            if (!next) return state
            node = next
            state = next.selectAllChildren
          }
          return state
        }
        let changed = 0
        for (let i = 0; i < count; i += 1) {
          if (!mask[i] || !selected(i)) continue
          applyPatch(i, patch)
          changed += 1
        }
        invalidate(touched(patch))
        return { result: changed, rows: changed, cached: false }
      })
    },
    async filterValues(columnId) {
      return serve('values', {}, () => {
        const labels = isTextCol(columnId) ? [...dicts[columnId].labels].sort((a, b) => a.localeCompare(b)) : []
        return { result: labels, rows: labels.length, cached: true }
      })
    },
    setLatency(range) {
      latency = range
    },
    setFailureRate(rate) {
      failureRate = Math.max(0, Math.min(1, rate))
    },
    size: () => liveCount,
    memoryBytes: () =>
      alive.byteLength +
      country.byteLength +
      rep.byteLength +
      product.byteLength +
      status.byteLength +
      day.byteLength +
      yearCode.byteLength +
      quarterCode.byteLength +
      amount.byteLength +
      qty.byteLength,
    rowById: (id) => {
      const i = indexOfId(id)
      return i < 0 ? null : materialize(i)
    },
  }
  return warehouse
}
