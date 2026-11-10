/**
 * A million orders behind the grid's data source contract, for demo 723: the
 * "database" a base with `serverRows` pages through. The records live in
 * typed arrays (a million row objects would take hundreds of megabytes in a
 * demo tab); a row object is made only for the block a request asks for.
 *
 * It answers the way a real backend would: the view's filter
 * (`filterModel.expression`, a base filter, run with the base's own filter
 * engine), the sort, the groups, totals (`aggregations`, `grandTotal`) and the
 * block, with `appliedExpression: true` so the grid knows the filter ran. A
 * filter on a field it has no value for (a lookup worked out in the page) it
 * leaves unapplied, as a database must: the page reads the orders through and
 * answers that one. Dates have an index, as a database would: a calendar asking
 * for a day reads that day. Edits, new orders and deletes are kept beside the
 * arrays. A short delay stands in for the network.
 */
import type { ServerDataSource, ServerRequest, ServerResult } from '@svgrid/grid'
import { compileFieldFilter, viewFilterOf } from '@svgrid/enterprise/base'

export const ORDER_COUNT = 1_000_000

export const STATUSES = ['New', 'Paid', 'Packed', 'Shipped', 'Returned']
export const REGIONS = ['EU', 'North America', 'LATAM', 'APAC', 'Middle East']
/** The customers the orders belong to, for the base's Customers table. */
export const customerRows = () => CUSTOMERS.map((name, i) => ({ id: `c${i}`, name, tier: ['Gold', 'Silver', 'Bronze'][i % 3] }))
const FIRST = ['Acme', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Vandelay', 'Stark', 'Wayne', 'Wonka', 'Tyrell', 'Cyberdyne', 'Soylent', 'Aperture', 'Oscorp', 'Gringotts', 'Monarch', 'Pied Piper', 'Massive', 'Dunder', 'Prestige']
const LAST = ['Labs', 'Group', 'Foods', 'Systems', 'Partners', 'Holdings', 'Studio', 'Supply', 'Works', 'Trading']
const CUSTOMERS = FIRST.flatMap((a) => LAST.map((b) => `${a} ${b}`))
const OWNERS = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8']
const DAY0 = Date.UTC(2026, 0, 1)

type Row = Record<string, unknown>

// One seeded generator: the same million orders on every load.
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createMillionOrders(latencyMs = 80): ServerDataSource<Row> & { count(): number; updateRows(changes: ReadonlyArray<{ id: string; patch: Record<string, unknown> }>): Promise<void> } {
  const n = ORDER_COUNT
  const r = rng(20261104)
  const status = new Uint8Array(n)
  const region = new Uint8Array(n)
  const owner = new Uint8Array(n)
  const customer = new Uint16Array(n)
  const amount = new Float32Array(n)
  const day = new Uint16Array(n)
  for (let i = 0; i < n; i++) {
    status[i] = Math.floor(r() * STATUSES.length)
    region[i] = Math.floor(r() * REGIONS.length)
    owner[i] = Math.floor(r() * OWNERS.length)
    customer[i] = Math.floor(r() * CUSTOMERS.length)
    amount[i] = Math.round((20 + r() * r() * 4980) * 100) / 100
    day[i] = Math.floor(r() * 670)
  }
  // Changes made through the base, kept beside the arrays.
  const edited = new Map<number, Row>()
  const deleted = new Set<number>()
  const added: Row[] = []
  // New orders made so far, for their numbers: one undone leaves its number behind.
  let made = 0
  // Bumped as records come and go: an order cached is of the records it was made from.
  let rowsVersion = 0

  const idOf = (i: number) => `o${i}`
  const indexOf = (id: string) => (id.startsWith('o') ? Number(id.slice(1)) : NaN)
  function create(input: Row) {
    // A deleted order put back is the order it was.
    const i = indexOf(String(input.id ?? ''))
    rowsVersion += 1
    if (Number.isInteger(i) && i < n && deleted.delete(i)) return input
    const saved = { ...input, order: input.order ?? `SO-${100000 + n + made}` }
    made += 1
    added.push(saved)
    return saved
  }
  function write(id: string, patch: Record<string, unknown>) {
    for (const col of Object.keys(patch)) changed.set(col, (changed.get(col) ?? 0) + 1)
    const i = indexOf(id)
    if (i >= n || Number.isNaN(i)) {
      const at = added.findIndex((x) => x.id === id)
      if (at >= 0) added[at] = { ...added[at], ...patch }
    } else edited.set(i, { ...edited.get(i), ...patch })
    return row(Number.isNaN(i) ? n + added.findIndex((x) => x.id === id) : i)
  }
  function drop(id: string) {
    const i = indexOf(id)
    rowsVersion += 1
    if (!Number.isNaN(i) && i < n) deleted.add(i)
    else {
      // A new order undone is gone: the table is what it was.
      const at = added.findIndex((x) => x.id === id)
      if (at >= 0) added.splice(at, 1)
    }
  }
  // 670 days: each date's text made once, not once per record read.
  const DATES = Array.from({ length: 670 }, (_, d) => new Date(DAY0 + d * 86_400_000).toISOString().slice(0, 10))

  /**
   * One field of one order, read from the arrays: what the filter, the
   * groups and the sort read, a million times a request, without making a
   * row object each time.
   */
  function valueOf(i: number, col: string): unknown {
    if (i >= n) return added[i - n]![col]
    const patch = edited.get(i)
    if (patch && col in patch) return patch[col]
    switch (col) {
      case 'id':
        return idOf(i)
      case 'order':
        return `SO-${100000 + i}`
      case 'customer':
        return CUSTOMERS[customer[i]!]
      case 'account':
        return `c${customer[i]}`
      case 'status':
        return STATUSES[status[i]!]
      case 'region':
        return REGIONS[region[i]!]
      case 'amount':
        return amount[i]
      case 'tax':
        return amount[i]! * 0.2
      case 'date':
        return DATES[day[i]!]
      case 'owner':
        return OWNERS[owner[i]!]
    }
    return undefined
  }

  /** One order as the base keeps it. Indexes past `n` are orders added since. */
  function row(i: number): Row {
    if (i >= n) return added[i - n]!
    const base: Row = {
      id: idOf(i),
      order: `SO-${100000 + i}`,
      customer: CUSTOMERS[customer[i]!],
      account: `c${customer[i]}`,
      status: STATUSES[status[i]!],
      region: REGIONS[region[i]!],
      amount: amount[i],
      date: DATES[day[i]!],
      owner: OWNERS[owner[i]!],
    }
    const patch = edited.get(i)
    return patch ? { ...base, ...patch } : base
  }

  // A number to sort each column by, read from the arrays: text columns by
  // the rank of their value among the sorted values.
  const rank = (values: string[]) => {
    const sorted = [...values].sort((a, b) => a.localeCompare(b))
    return Uint16Array.from(values, (v) => sorted.indexOf(v))
  }
  const customerRank = rank(CUSTOMERS)
  const ownerRank = rank(OWNERS)
  // A date's key: above zero for a date written long before the first day.
  const DAY_KEY = 40_000
  const SHIFT = 2 ** 21 // more than any index
  const TOP = 2 ** 31 // more than any key
  function sortKey(col: string): ((i: number) => number) | null {
    switch (col) {
      case 'id':
      case 'order':
        return (i) => i
      case 'amount':
      case 'tax':
        return (i) => Math.round(amount[i]! * 100)
      case 'date':
        return (i) => day[i]! + DAY_KEY
      case 'status':
        return (i) => status[i]!
      case 'region':
        return (i) => region[i]!
      case 'customer':
      case 'account':
        return (i) => customerRank[customer[i]!]!
      case 'owner':
        return (i) => ownerRank[owner[i]!]!
    }
    return null
  }
  /** The key of a value written through the base, on the scale of `sortKey`; null when it has none. */
  function writtenKey(i: number, col: string): number | null {
    if (col === 'id') return i
    if (col === 'order') return i >= n ? i : null
    const v = valueOf(i, col === 'tax' ? 'amount' : col)
    if (v == null || v === '') return 0
    const text = String(v)
    const inRange = (k: number) => (k >= 0 && k < TOP ? k : null)
    switch (col) {
      case 'amount':
      case 'tax':
        return inRange(Math.round(Number(v) * 100))
      case 'date':
        return inRange(dayNumber(text.slice(0, 10)) + DAY_KEY)
      case 'status':
        return inRange(STATUSES.indexOf(text))
      case 'region':
        return inRange(REGIONS.indexOf(text))
      case 'customer':
        return customerRank[CUSTOMERS.indexOf(text)] ?? null
      case 'account':
        return customerRank[Number(text.slice(1))] ?? null
      case 'owner':
        return ownerRank[OWNERS.indexOf(text)] ?? null
    }
    return null
  }
  /** The rows whose `col` is not the arrays': the orders added, and the ones edited on it. */
  function written(col: string): Set<number> {
    const own = new Set<number>()
    for (let k = 0; k < added.length; k++) own.add(n + k)
    if (changed.has(col)) for (const [i, p] of edited) if (col in p) own.add(i)
    return own
  }
  /** A number to sort a column by, arrays and writes alike; null when a write has none. */
  function sortKeys(col: string): ((i: number) => number) | null {
    const fast = sortKey(col)
    if (!fast) return null
    const own = new Map<number, number>()
    for (const i of written(col === 'tax' ? 'amount' : col)) {
      const k = writtenKey(i, col)
      if (k == null) return null
      own.set(i, k)
    }
    return own.size ? (i) => own.get(i) ?? fast(i) : fast
  }

  // The orders by day, made the first time a request names dates: the index a
  // database keeps on a date column.
  let byDay: Uint32Array | null = null
  let dayStart: Uint32Array | null = null
  function dayIndex() {
    if (byDay) return { byDay, dayStart: dayStart! }
    const starts = new Uint32Array(DATES.length + 2)
    for (let i = 0; i < n; i++) starts[day[i]! + 1]! += 1
    for (let d = 1; d < starts.length; d++) starts[d]! += starts[d - 1]!
    const next = starts.slice()
    const list = new Uint32Array(n)
    for (let i = 0; i < n; i++) list[next[day[i]!]!++] = i
    byDay = list
    dayStart = starts
    return { byDay, dayStart }
  }
  // The orders by customer: the index a database keeps on a foreign key.
  let byCustomer: Uint32Array | null = null
  let customerStart: Uint32Array | null = null
  function customerIndex() {
    if (byCustomer) return { byCustomer, customerStart: customerStart! }
    const starts = new Uint32Array(CUSTOMERS.length + 2)
    for (let i = 0; i < n; i++) starts[customer[i]! + 1]! += 1
    for (let c = 1; c < starts.length; c++) starts[c]! += starts[c - 1]!
    const next = starts.slice()
    const list = new Uint32Array(n)
    for (let i = 0; i < n; i++) list[next[customer[i]!]!++] = i
    byCustomer = list
    customerStart = starts
    return { byCustomer, customerStart }
  }
  const dayNumber = (text: string) => Math.round((Date.parse(`${text}T00:00:00Z`) - DAY0) / 86_400_000)
  type Filter = NonNullable<ReturnType<typeof viewFilterOf>>
  /** The orders a date index does not know, with the day each is on now (null: no date). */
  function movedDays(): Map<number, number | null> {
    const moved = new Map<number, number | null>()
    for (const i of written('date')) {
      const v = valueOf(i, 'date')
      moved.set(i, v == null || v === '' ? null : dayNumber(String(v).slice(0, 10)))
    }
    return moved
  }
  /**
   * The day range the top-level date conditions name, and the rest of the filter.
   * `blank` asks for orders with no date, `dated` for orders with one: only a
   * write can leave one without.
   */
  function splitDates(filter: Filter | null): { lo: number; hi: number; blank: boolean; dated: boolean; rest: Filter | null } {
    const all = { lo: -Infinity, hi: Infinity, blank: false, dated: false, rest: filter }
    if (!filter || filter.conjunction !== 'and') return all
    let { lo, hi, dated } = all
    const rest: Filter['conditions'] = []
    for (const c of filter.conditions) {
      const cond = c as { column?: string; kind?: string; op?: string; value?: { mode?: string; date?: string } }
      const date = cond.value?.mode === 'exactDate' ? cond.value.date : undefined
      if (cond.column !== 'date' || cond.kind !== 'date') rest.push(c)
      else if (cond.op === 'isNotEmpty') dated = true
      else if (cond.op === 'isEmpty') return { lo: 1, hi: 0, blank: true, dated: false, rest: null }
      else if (date && cond.op === 'isOnOrAfter') lo = Math.max(lo, dayNumber(date))
      else if (date && cond.op === 'isAfter') lo = Math.max(lo, dayNumber(date) + 1)
      else if (date && cond.op === 'isBefore') hi = Math.min(hi, dayNumber(date) - 1)
      else if (date && cond.op === 'isOnOrBefore') hi = Math.min(hi, dayNumber(date))
      else if (date && cond.op === 'is') {
        lo = Math.max(lo, dayNumber(date))
        hi = Math.min(hi, dayNumber(date))
      } else rest.push(c)
    }
    return { lo, hi, blank: false, dated, rest: rest.length ? { ...filter, conditions: rest } : null }
  }

  // Edits per column: a cached order is kept until a column it reads changes.
  const changed = new Map<string, number>()
  // The fields the arrays hold; a field added since has what was written to it.
  const STORED = new Set(['id', 'order', 'customer', 'account', 'status', 'region', 'amount', 'tax', 'date', 'owner'])
  /** Whether every condition reads a field this server has: a filter on one it has not is run in the page or not at all. */
  function runs(filter: Filter): boolean {
    const asked = filter.conditions.flatMap((c) => ('conditions' in c ? c.conditions : [c]))
    // A condition still being written filters nothing, on any field.
    const written = asked.filter((c) => c.op === 'isEmpty' || c.op === 'isNotEmpty' || !(c.value == null || c.value === '' || (Array.isArray(c.value) && !c.value.length)))
    return written.every((c) => STORED.has(c.column) || changed.has(c.column))
  }
  // The order of every record a request keeps, by filter and sort: the last
  // few kept, so scrolling block after block does not filter a million again.
  const cache = new Map<string, Uint32Array>()
  function ordered(req: Partial<ServerRequest>): { list: Uint32Array; applied: boolean } {
    const asked = viewFilterOf(req.filterModel?.expression)
    // None of it, or all of it: a field it cannot read is not a blank field.
    const filter = asked && runs(asked) ? asked : null
    // Records by id, or by the records they link to: an `in` list, as a SQL `IN`.
    const picks = Object.entries(req.filterModel?.columns ?? {}).filter(([, f]) => (f as { selectedValues?: string[] }).selectedValues?.length) as Array<[string, { selectedValues: string[] }]>
    const byId = picks.find(([col]) => col === 'id')?.[1].selectedValues
    if (byId) {
      const at = byId.map((id) => (id.startsWith('o') ? indexOf(id) : n + added.findIndex((x) => x.id === id))).filter((i) => Number.isInteger(i) && i >= 0 && i < n + added.length && (i >= n || !deleted.has(i)))
      return { list: Uint32Array.from(at), applied: !!filter }
    }
    const sort = req.sortModel?.[0]
    const needle = String(req.filterModel?.global ?? '').trim().toLowerCase()
    // A search asks only of the fields the person may see.
    const searchIn = (req.filterModel as { searchIn?: string[] } | undefined)?.searchIn
    const searched = ['order', 'customer'].filter((f) => !searchIn || searchIn.includes(f))
    // The orders of one customer, untouched and unsorted: read off the index, moved ones added.
    const only = picks.length === 1 && picks[0]![0] === 'account' && picks[0]![1].selectedValues.length === 1 ? picks[0]![1].selectedValues[0]! : null
    if (only != null && !filter && !sort && !needle && !req.groupKeys?.length && !deleted.size) {
      const { byCustomer: all, customerStart: at } = customerIndex()
      const c = Number(only.slice(1))
      const own = all.subarray(at[c]!, at[c + 1]!)
      const moved = written('account')
      if (!moved.size) return { list: own, applied: false }
      const kept = Array.from(own).filter((i) => !moved.has(i) || valueOf(i, 'account') === only)
      for (const i of moved) if (valueOf(i, 'account') === only && !kept.includes(i)) kept.push(i)
      return { list: Uint32Array.from(kept), applied: false }
    }
    // The group a request reads into: [column, key] per level.
    const path = (req.groupKeys ?? []).map((k, level) => [req.groupBy![level]!, k] as const)
    const reads = JSON.stringify([filter, sort?.id, path, needle ? searched : [], picks])
    const versions = [...changed].filter(([col]) => reads.includes(`"${col}"`))
    const key = JSON.stringify([filter, req.sortModel, path, needle, searched, picks, versions, rowsVersion])
    const hit = cache.get(key)
    if (hit) return { list: hit, applied: !!filter }
    const total = n + added.length
    const { lo, hi, blank, dated, rest } = splitDates(filter)
    const ranged = blank || lo > 0 || hi < DATES.length - 1
    const moved = movedDays()
    const test = rest ? compileFieldFilter<number>(rest, valueOf) : null
    // A status or region group compares the stored codes, not the names; a write compares its value.
    const codeTests = path.map(([col, k]) => {
      const codes = col === 'status' ? status : col === 'region' ? region : null
      if (!codes) return null
      const code = (col === 'status' ? STATUSES : REGIONS).indexOf(k)
      const own = written(col)
      return own.size ? (i: number) => (own.has(i) ? String(valueOf(i, col) ?? '') === k : codes[i] === code) : (i: number) => codes[i] === code
    })
    const inLists = picks.map(([col, f]) => [col, new Set(f.selectedValues)] as const)
    const pathTest = path.length || inLists.length
      ? (i: number) =>
          path.every(([col, k], level) => (codeTests[level] ? codeTests[level]!(i) : String(valueOf(i, col) ?? '') === k)) &&
          inLists.every(([col, set]) => set.has(String(valueOf(i, col) ?? '')))
      : null
    // The orders the index has for the days named, and the written ones that belong there.
    const indexed = () => {
      const { byDay: all, dayStart: at } = dayIndex()
      const from = Math.max(0, lo)
      const to = Math.min(DATES.length - 1, hi)
      return blank || from > to ? new Uint32Array(0) : all.subarray(at[from]!, at[to + 1]!)
    }
    const belongs = (d: number | null) => (blank ? d == null : d == null ? !ranged && !dated : d >= lo && d <= hi)
    const arrived = [...moved].filter(([, d]) => belongs(d)).sort((a, b) => (a[1] ?? -Infinity) - (b[1] ?? -Infinity) || a[0] - b[0])
    // A sort on the date with nothing else to do: the index is that order already, the few written orders merged in.
    if (sort?.id === 'date' && !test && !needle && !pathTest) {
      const part = indexed()
      let sorted: Uint32Array = part
      if (moved.size || deleted.size) {
        sorted = new Uint32Array(part.length + arrived.length)
        const leave = deleted.size > 0 || moved.size > added.length
        let kept = 0
        let next = 0
        for (let at = 0; at < part.length; at++) {
          const i = part[at]!
          if (leave && (deleted.has(i) || moved.has(i))) continue
          while (next < arrived.length && (arrived[next]![1] ?? -Infinity) <= day[i]!) sorted[kept++] = arrived[next++]![0]
          sorted[kept++] = i
        }
        while (next < arrived.length) sorted[kept++] = arrived[next++]![0]
        sorted = sorted.subarray(0, kept)
      }
      if (sort.desc) sorted = sorted.slice().reverse()
      cache.set(key, sorted)
      return { list: sorted, applied: !!filter }
    }
    let list: Uint32Array
    if (!ranged && !dated && !test && !needle && !pathTest && !deleted.size) {
      // Nothing to leave out: every order, in the order they were made.
      list = new Uint32Array(total)
      for (let i = 0; i < total; i++) list[i] = i
    } else {
      // Dates named: only those days are read, through the index.
      const days = ranged ? indexed() : null
      const count = days ? days.length + arrived.length : total
      list = new Uint32Array(count)
      let kept = 0
      for (let at = 0; at < count; at++) {
        const i = !days ? at : at < days.length ? days[at]! : arrived[at - days.length]![0]
        // Written to another day, or to none: the index has it where it was.
        if (days ? at < days.length && moved.has(i) : dated && moved.get(i) === null) continue
        if (deleted.size && deleted.has(i)) continue
        if (pathTest && !pathTest(i)) continue
        if (test && !test(i)) continue
        if (needle && !searched.map((f) => valueOf(i, f)).join(' ').toLowerCase().includes(needle)) continue
        list[kept++] = i
      }
      list = list.slice(0, kept)
    }
    if (sort) {
      const dir = sort.desc ? -1 : 1
      const fast = sortKeys(sort.id)
      if (fast) {
        // A whole number per order, packed with the order's index into one
        // float and sorted natively, no comparator (a comparator sort of a
        // million takes seconds).
        const packed = new Float64Array(list.length)
        for (let j = 0; j < list.length; j++) {
          const i = list[j]!
          const k = fast(i)
          packed[j] = (dir > 0 ? k : TOP - k) * SHIFT + i
        }
        packed.sort()
        for (let j = 0; j < packed.length; j++) list[j] = packed[j]! % SHIFT
      } else {
        // A value on the sorted column with no place on its scale: compare the values themselves.
        const keys = new Map<number, number | string>()
        for (const i of list) {
          const v = valueOf(i, sort.id)
          keys.set(i, sort.id === 'status' ? STATUSES.indexOf(String(v)) : sort.id === 'region' ? REGIONS.indexOf(String(v)) : typeof v === 'number' ? v : String(v ?? ''))
        }
        list.sort((a, b) => {
          const ka = keys.get(a)!
          const kb = keys.get(b)!
          return (ka < kb ? -1 : ka > kb ? 1 : 0) * dir || a - b
        })
      }
    }
    cache.set(key, list)
    if (cache.size > 12) cache.delete(cache.keys().next().value!)
    return { list, applied: !!filter }
  }

  const wait = () => new Promise((res) => setTimeout(res, latencyMs))

  /** One field added up over a list of orders. */
  function total(list: ArrayLike<number>, col: string, fn: string): number | null {
    let sum = 0
    let count = 0
    let min = Infinity
    let max = -Infinity
    for (let j = 0; j < list.length; j++) {
      const v = Number(valueOf(list[j]!, col))
      if (!Number.isFinite(v)) continue
      sum += v
      count += 1
      if (v < min) min = v
      if (v > max) max = v
    }
    if (fn === 'sum') return sum
    if (fn === 'count') return count
    if (!count) return null
    return fn === 'avg' ? sum / count : fn === 'min' ? min : max
  }

  return {
    count: () => n + added.length - deleted.size,
    async getRows(req): Promise<ServerResult<Row>> {
      await wait()
      const { list, applied } = ordered(req)
      const totals = (of: ArrayLike<number>) => Object.fromEntries((req.aggregations ?? []).map((a) => [a.col, total(of, a.col, a.fn)]))
      const grand = req.needsGrandTotal ? { grandTotal: totals(list) as Row } : {}
      const groupBy = req.groupBy ?? []
      const level = (req.groupKeys ?? []).length
      if (level < groupBy.length) {
        const col = groupBy[level]!
        // By the customer an order belongs to: added up straight from the arrays.
        const accounts = col === 'account' ? written('account') : null
        if (accounts && [...accounts].every((i) => CUSTOMERS[Number(String(valueOf(i, 'account')).slice(1))] != null)) {
          const count = new Uint32Array(CUSTOMERS.length)
          const sums = (req.aggregations ?? []).map(() => new Float64Array(CUSTOMERS.length))
          for (const i of list) {
            const c = accounts.size && accounts.has(i) ? Number(String(valueOf(i, 'account')).slice(1)) : customer[i]!
            count[c]! += 1
            ;(req.aggregations ?? []).forEach((a, x) => (sums[x]![c]! += Number(valueOf(i, a.col)) || 0))
          }
          const rows: Row[] = []
          count.forEach((total, c) => {
            if (!total) return
            const row: Row = { account: `c${c}`, childCount: total }
            ;(req.aggregations ?? []).forEach((a, x) => (row[a.col] = a.fn === 'avg' ? sums[x]![c]! / total : sums[x]![c]!))
            rows.push(row)
          })
          return { rows: rows.slice(req.startRow, req.endRow), rowCount: rows.length, ...grand, ...(applied ? { appliedExpression: true } : {}) }
        }
        const counts = new Map<string, number>()
        const codes = col === 'status' ? status : col === 'region' ? region : null
        const names = col === 'status' ? STATUSES : REGIONS
        if (codes) {
          // Count the codes, and the written values by name.
          const own = written(col)
          const tally = new Uint32Array(names.length)
          for (const i of list) {
            if (!own.size || !own.has(i)) tally[codes[i]!]! += 1
            else {
              const k = String(valueOf(i, col) ?? '')
              counts.set(k, (counts.get(k) ?? 0) + 1)
            }
          }
          names.forEach((k, c) => tally[c] && counts.set(k, (counts.get(k) ?? 0) + tally[c]!))
        } else
          for (const i of list) {
            const k = String(valueOf(i, col) ?? '')
            counts.set(k, (counts.get(k) ?? 0) + 1)
          }
        const order = col === 'status' ? STATUSES : col === 'region' ? REGIONS : [...counts.keys()].sort()
        // Totals per group: each group's orders, gathered in one pass.
        const members = new Map<string, number[]>()
        if (req.aggregations?.length) {
          for (const i of list) {
            const k = String(valueOf(i, col) ?? '')
            const had = members.get(k)
            if (had) had.push(i)
            else members.set(k, [i])
          }
        }
        // Keys outside the known options too: a new order with no status is a group of its own.
        const rows = [...order.filter((k) => counts.has(k)), ...[...counts.keys()].filter((k) => !order.includes(k))].map((k) => ({ [col]: k, childCount: counts.get(k), leafCount: counts.get(k), ...totals(members.get(k) ?? []) }))
        return { rows: rows.slice(req.startRow, req.endRow), rowCount: rows.length, ...grand, ...(applied ? { appliedExpression: true } : {}) }
      }
      return { rows: Array.from(list.subarray(req.startRow, req.endRow), row), rowCount: list.length, ...grand, ...(applied ? { appliedExpression: true } : {}) }
    },
    async updateRow(id, patch) {
      await wait()
      return write(id, patch)
    },
    // A block in one request, as a SQL source writes it.
    async updateRows(changes: ReadonlyArray<{ id: string; patch: Record<string, unknown> }>) {
      await wait()
      for (const c of changes) write(c.id, c.patch)
    },
    async createRow(input) {
      await wait()
      return create(input)
    },
    async createRows(input) {
      await wait()
      return input.map(create)
    },
    async deleteRow(id) {
      await wait()
      drop(id)
    },
    async deleteRows(ids) {
      await wait()
      for (const id of ids) drop(id)
    },
  }
}
