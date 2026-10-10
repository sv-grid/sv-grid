/**
 * The big-data demo's query engine. It runs in a Web Worker (big.worker.ts)
 * and answers the Enterprise server row model's requests over a dataset that
 * is never stored (data.ts): only row ids travel back, a block at a time.
 *
 * - Filter: each column filter compiles to a lookup table over the column's
 *   small key domain where it can (names, categories), else a compare; one
 *   pass over the rows collects the matches into a Uint32Array.
 * - Sort: LSD radix sort on the integer keys, 10-11 bits per pass, stable, so
 *   a multi-column sort is one set of passes per column from last to first.
 * - Group: one pass counts each category and sums the aggregates.
 * - Edit: an overlay of changed cells. Cached views and group totals are
 *   patched in place (a binary search and a move), not recomputed.
 *
 * Views (filter + group path + sort) are cached, so the blocks after the first
 * of a query are slices of an array that already exists.
 */
import {
  cellCode,
  cellKey,
  cellValue,
  columnByField,
  COUNTRY_BY_NAME,
  DOMAINS,
  FIRST,
  LAST,
  isoToDay,
  type BigColumn,
} from './data'

type SortSpec = { id: string; desc?: boolean }
type ColumnFilter = { operator?: string; value?: string; valueTo?: string; selectedValues?: string[] }
export type EngineRequest = {
  startRow: number
  endRow: number
  sortModel?: SortSpec[]
  filterModel?: { global?: string; columns?: Record<string, ColumnFilter> }
  groupBy?: string[]
  groupKeys?: string[]
}
export type EngineResult = {
  /** Leaf rows: the row ids of the block. */
  ids?: number[]
  /** Group rows: plain objects keyed by the group field and the aggregates. */
  groups?: Array<Record<string, unknown>>
  rowCount: number
  /** What the request cost in the worker, and what it did. */
  ms: number
  op: 'scan' | 'sort' | 'scan+sort' | 'group' | 'cached' | 'identity'
  /** Rows the request had to look at. */
  scanned: number
}
export type Progress = (phase: string, done: number, total: number) => void

type Pred = (row: number) => boolean
type View = {
  /** Row ids in display order; null means every row in id order. */
  ids: Uint32Array | null
  length: number
  /** `id` descending over an unfiltered set, without materialising it. */
  reversed: boolean
  preds: Pred[]
  sort: SortSpec[]
  /** Fields whose edits can move or drop a row in this view. */
  fields: Set<string>
}
type GroupResult = {
  field: string
  preds: Pred[]
  count: Float64Array
  balance: Float64Array
  rating: Float64Array
  total: Float64Array
}

const lower = (s: string) => s.toLowerCase()

function textMatch(op: string, text: string, value: string): boolean {
  const s = lower(text)
  const v = lower(value)
  switch (op) {
    case 'equals': return s === v
    case 'notEquals': return s !== v
    case 'startsWith': return s.startsWith(v)
    case 'endsWith': return s.endsWith(v)
    case 'notContains': return !s.includes(v)
    case 'isBlank': return s === ''
    case 'isNotBlank': return s !== ''
    case 'in': return v.split(',').map((x) => x.trim()).includes(s)
    case 'notIn': return !v.split(',').map((x) => x.trim()).includes(s)
    case 'regex':
      try {
        return new RegExp(value, 'i').test(text)
      } catch {
        return false
      }
    default: return s.includes(v) // contains, and anything unknown
  }
}

function numberMatch(op: string, x: number, a: number, b: number): boolean {
  switch (op) {
    case 'equals': return x === a
    case 'notEquals': return x !== a
    case 'greaterThan': return x > a
    case 'lessThan': return x < a
    case 'between': return x >= Math.min(a, b) && x <= Math.max(a, b)
    case 'isBlank': return false
    case 'isNotBlank': return true
    default: return x === a
  }
}

/** Every string a text column can hold, by key: 4,096 names, 32,768 emails. */
let nameDomain: string[] | null = null
let emailDomain: string[] | null = null
function textDomain(col: BigColumn): string[] {
  if (col.field === 'name') {
    nameDomain ??= Array.from({ length: 4096 }, (_, k) => `${FIRST[k >> 6]} ${LAST[k & 63]}`)
    return nameDomain
  }
  emailDomain ??= (() => {
    const out: string[] = []
    // Same arithmetic as data.ts: key = name * 8 + domain index.
    for (let k = 0; k < 4096 * 8; k += 1) {
      const n = k >> 3
      out.push(`${FIRST[n >> 6]!.toLowerCase()}.${LAST[n & 63]!.toLowerCase()}@${DOMAINS[k & 7]}`)
    }
    return out
  })()
  return emailDomain
}

export function createEngine(progress: Progress = () => {}) {
  let rowCount = 0
  let columnCount = 0
  const edits = new Map<number, Record<string, unknown>>()
  const views = new Map<string, View>()
  const groups = new Map<string, GroupResult>()
  const MAX_VIEWS = 4
  let scratch: Uint32Array | null = null
  // Edited rows lie in [editMin, editMax]: a row outside it costs one compare,
  // not a Map lookup, which at 100M rows is the difference of a second.
  let editMin = Number.POSITIVE_INFINITY
  let editMax = -1
  const edited = (r: number) => r >= editMin && r <= editMax && edits.has(r)
  const codeOf = (col: BigColumn) => { const code = col.code!; return (r: number) => (edited(r) ? cellCode(col, r, edits) : code(r)) }
  const valueOf = (col: BigColumn) => { const value = col.value; return (r: number) => (edited(r) ? cellValue(col, r, edits) : value(r)) }
  const keyOfCol = (col: BigColumn) => { const key = col.key; return (r: number) => (edited(r) ? cellKey(col, r, edits) : key(r)) }

  function scratchOf(n: number): Uint32Array {
    if (!scratch || scratch.length < n) scratch = new Uint32Array(n)
    return scratch
  }

  // ---- filters --------------------------------------------------------------

  function columnPred(field: string, f: ColumnFilter): Pred | null {
    const col = columnByField(field)
    if (!col) return null
    const op = f.operator ?? 'contains'
    if (f.selectedValues?.length) {
      const wanted = new Set(f.selectedValues.map(String))
      if (col.labels && col.code) {
        const allow = col.labels.map((l) => wanted.has(l))
        const code = codeOf(col)
        return (r) => allow[code(r)] === true
      }
      const value = valueOf(col)
      return (r) => wanted.has(String(value(r)))
    }
    const value = f.value ?? ''
    if (value === '' && op !== 'isBlank' && op !== 'isNotBlank') return null
    if (col.kind === 'text') {
      const domain = textDomain(col)
      const allow = new Uint8Array(domain.length)
      for (let k = 0; k < domain.length; k += 1) allow[k] = textMatch(op, domain[k]!, value) ? 1 : 0
      return (r) => allow[col.key(r)] === 1
    }
    if (col.kind === 'category' && col.labels && col.code) {
      const allow = col.labels.map((l) => textMatch(op, l, value))
      const code = codeOf(col)
      return (r) => allow[code(r)] === true
    }
    if (col.kind === 'bool') {
      const want = lower(value) === 'true' || value === '1'
      const val = valueOf(col)
      return (r) => (val(r) === true) === want
    }
    if (col.kind === 'date') {
      const a = isoToDay(value)
      const b = f.valueTo ? isoToDay(f.valueTo) : a
      return (r) => numberMatch(op, col.key(r), a, b)
    }
    const a = Number(value)
    const b = Number(f.valueTo ?? value)
    if (!Number.isFinite(a)) return null
    const val = valueOf(col)
    return (r) => numberMatch(op, Number(val(r)), a, b)
  }

  function globalPred(query: string): Pred | null {
    const q = lower(query.trim())
    if (!q) return null
    const name = columnByField('name')!
    const email = columnByField('email')!
    const nameAllow = textDomain(name).map((s) => lower(s).includes(q))
    const emailAllow = textDomain(email).map((s) => s.includes(q))
    const cats = ['country', 'language', 'game', 'status'].map((f) => {
      const col = columnByField(f)!
      return { code: codeOf(col), allow: col.labels!.map((l) => lower(l).includes(q)) }
    })
    return (r) => {
      if (nameAllow[name.key(r)] || emailAllow[email.key(r)]) return true
      for (const { code, allow } of cats) if (allow[code(r)]) return true
      return false
    }
  }

  function pathPreds(groupBy: string[], keys: string[]): Pred[] {
    const out: Pred[] = []
    keys.forEach((key, level) => {
      const col = columnByField(groupBy[level]!)
      if (!col?.labels || !col.code) return
      const want = col.labels.indexOf(key)
      const code = codeOf(col)
      out.push((r) => code(r) === want)
    })
    return out
  }

  function filterFields(req: EngineRequest): Set<string> {
    const s = new Set<string>(Object.keys(req.filterModel?.columns ?? {}))
    if (req.filterModel?.global) for (const f of ['country', 'language', 'game', 'status']) s.add(f)
    for (const f of (req.groupBy ?? []).slice(0, req.groupKeys?.length ?? 0)) s.add(f)
    return s
  }

  function compile(req: EngineRequest): Pred[] {
    const preds: Pred[] = []
    for (const [field, f] of Object.entries(req.filterModel?.columns ?? {})) {
      const p = columnPred(field, f)
      if (p) preds.push(p)
    }
    const g = req.filterModel?.global ? globalPred(req.filterModel.global) : null
    if (g) preds.push(g)
    preds.push(...pathPreds(req.groupBy ?? [], req.groupKeys ?? []))
    return preds
  }

  const passes = (preds: Pred[], r: number): boolean => {
    for (let i = 0; i < preds.length; i += 1) if (!preds[i]!(r)) return false
    return true
  }

  /** One pass over every row: the matches, in id order. */
  function scan(preds: Pred[]): Uint32Array {
    const out = scratchOf(rowCount)
    let n = 0
    const step = 5_000_000
    for (let start = 0; start < rowCount; start += step) {
      const end = Math.min(rowCount, start + step)
      if (preds.length === 1) {
        const p = preds[0]!
        for (let r = start; r < end; r += 1) if (p(r)) out[n++] = r
      } else {
        for (let r = start; r < end; r += 1) if (passes(preds, r)) out[n++] = r
      }
      if (rowCount > step) progress('filter', end, rowCount)
    }
    return out.slice(0, n)
  }

  // ---- sort ------------------------------------------------------------------

  const keyFn = (col: BigColumn) =>
    edits.size === 0 ? col.key : keyOfCol(col)

  /** Stable LSD radix sort of `ids` by `key`, in place. */
  function radix(ids: Uint32Array, key: (r: number) => number, bits: number, desc: boolean): void {
    const n = ids.length
    if (n < 2) return
    const passCount = Math.max(1, Math.ceil(bits / 11))
    const width = Math.ceil(bits / passCount)
    const size = 1 << width
    const mask = size - 1
    const count = new Uint32Array(size)
    let src = ids
    let dst = scratchOf(n).subarray(0, n)
    for (let p = 0; p < passCount; p += 1) {
      const shift = p * width
      count.fill(0)
      for (let i = 0; i < n; i += 1) {
        const d = (key(src[i]!) >>> shift) & mask
        count[desc ? mask - d : d]! += 1
      }
      let sum = 0
      for (let d = 0; d < size; d += 1) {
        const c = count[d]!
        count[d] = sum
        sum += c
      }
      for (let i = 0; i < n; i += 1) {
        const r = src[i]!
        let d = (key(r) >>> shift) & mask
        if (desc) d = mask - d
        dst[count[d]!++] = r
      }
      const t = src
      src = dst
      dst = t
      if (n > 5_000_000) progress('sort', p + 1, passCount)
    }
    if (src !== ids) ids.set(src)
  }

  function sortIds(ids: Uint32Array, sort: SortSpec[]): void {
    for (let s = sort.length - 1; s >= 0; s -= 1) {
      const spec = sort[s]!
      const col = columnByField(spec.id)
      if (!col) continue
      if (col.kind === 'id') {
        // ids are distinct, so an id sort is the final order outright.
        ids.sort()
        if (spec.desc) ids.reverse()
        continue
      }
      radix(ids, keyFn(col), col.keyBits, !!spec.desc)
    }
  }

  // ---- views -----------------------------------------------------------------

  function viewKey(req: EngineRequest): string {
    return JSON.stringify([req.filterModel ?? {}, req.sortModel ?? [], req.groupBy ?? [], req.groupKeys ?? []])
  }

  function remember<T>(map: Map<string, T>, key: string, value: T): T {
    map.delete(key)
    map.set(key, value)
    while (map.size > MAX_VIEWS) map.delete(map.keys().next().value!)
    return value
  }

  function buildView(req: EngineRequest): { view: View; op: EngineResult['op']; scanned: number } {
    const preds = compile(req)
    const sort = (req.sortModel ?? []).filter((s) => columnByField(s.id))
    const fields = filterFields(req)
    for (const s of sort) fields.add(s.id)
    const onlyId = sort.length === 1 && sort[0]!.id === 'id'
    if (preds.length === 0 && (sort.length === 0 || onlyId)) {
      return {
        view: { ids: null, length: rowCount, reversed: onlyId && !!sort[0]!.desc, preds, sort, fields },
        op: 'identity',
        scanned: 0,
      }
    }
    let ids: Uint32Array
    let op: EngineResult['op'] = 'sort'
    if (preds.length) {
      ids = scan(preds)
      op = sort.length ? 'scan+sort' : 'scan'
    } else {
      ids = new Uint32Array(rowCount)
      for (let r = 0; r < rowCount; r += 1) ids[r] = r
    }
    sortIds(ids, sort)
    return { view: { ids, length: ids.length, reversed: false, preds, sort, fields }, op, scanned: rowCount }
  }

  const idAt = (view: View, i: number): number =>
    view.ids ? view.ids[i]! : view.reversed ? rowCount - 1 - i : i

  // ---- groups ----------------------------------------------------------------

  function groupResult(req: EngineRequest, field: string): { g: GroupResult; cached: boolean } {
    const key = JSON.stringify(['g', req.filterModel ?? {}, req.groupBy ?? [], req.groupKeys ?? [], field])
    const hit = groups.get(key)
    if (hit) return { g: remember(groups, key, hit), cached: true }
    const col = columnByField(field)!
    const size = col.labels!.length
    const preds = compile(req)
    const g: GroupResult = {
      field,
      preds,
      count: new Float64Array(size),
      balance: new Float64Array(size),
      rating: new Float64Array(size),
      total: new Float64Array(size),
    }
    // Column functions hoisted out of the pass: one pass over 100M rows calls
    // them 400M times.
    const code = codeOf(col)
    const balance = valueOf(columnByField('balance')!)
    const rating = valueOf(columnByField('rating')!)
    const total = valueOf(columnByField('total')!)
    const { count, balance: bal, rating: rat, total: tot } = g
    const step = 5_000_000
    for (let start = 0; start < rowCount; start += step) {
      const end = Math.min(rowCount, start + step)
      for (let r = start; r < end; r += 1) {
        if (preds.length && !passes(preds, r)) continue
        const c = code(r)
        count[c]! += 1
        bal[c]! += balance(r) as number
        rat[c]! += rating(r) as number
        tot[c]! += total(r) as number
      }
      if (rowCount > step) progress('group', end, rowCount)
    }
    return { g: remember(groups, key, g), cached: false }
  }

  function addToGroup(g: GroupResult, col: BigColumn, balance: BigColumn, rating: BigColumn, total: BigColumn, r: number, sign: 1 | -1): void {
    const c = cellCode(col, r, edits)
    g.count[c]! += sign
    g.balance[c]! += sign * Number(cellValue(balance, r, edits))
    g.rating[c]! += sign * Number(cellValue(rating, r, edits))
    g.total[c]! += sign * Number(cellValue(total, r, edits))
  }

  function groupRows(req: EngineRequest, g: GroupResult): Array<Record<string, unknown>> {
    const col = columnByField(g.field)!
    const out: Array<Record<string, unknown>> = []
    col.labels!.forEach((label, c) => {
      const n = g.count[c]!
      if (n <= 0) return
      const row: Record<string, unknown> = {
        id: `g:${(req.groupKeys ?? []).join('/')}/${label}`,
        [g.field]: label,
        __count: n,
        balance: g.balance[c]!,
        rating: Math.round((g.rating[c]! / n) * 10) / 10,
        total: g.total[c]!,
      }
      if (g.field === 'country') row.flag = COUNTRY_BY_NAME.get(label)?.flag
      out.push(row)
    })
    // Group rows follow the sort when it names the group column or an aggregate.
    const spec = (req.sortModel ?? []).find((s) => s.id === g.field || ['balance', 'rating', 'total', '__count'].includes(s.id))
    if (spec && spec.id !== g.field) {
      out.sort((a, b) => (Number(a[spec.id]) - Number(b[spec.id])) * (spec.desc ? -1 : 1))
    } else if (spec?.desc) {
      out.reverse()
    }
    return out
  }

  // ---- public ------------------------------------------------------------------

  return {
    configure(rows: number, cols: number): void {
      rowCount = rows
      columnCount = cols
      edits.clear()
      editMin = Number.POSITIVE_INFINITY
      editMax = -1
      views.clear()
      groups.clear()
      scratch = null
    },

    size() {
      return { rowCount, columnCount, edits: edits.size }
    },

    getRows(req: EngineRequest): EngineResult {
      const t0 = performance.now()
      const level = req.groupKeys?.length ?? 0
      if (req.groupBy && level < req.groupBy.length) {
        const { g, cached } = groupResult(req, req.groupBy[level]!)
        const all = groupRows(req, g)
        return {
          groups: all.slice(req.startRow, req.endRow),
          rowCount: all.length,
          ms: performance.now() - t0,
          op: cached ? 'cached' : 'group',
          scanned: cached ? 0 : rowCount,
        }
      }
      const key = viewKey(req)
      let view = views.get(key)
      let op: EngineResult['op'] = 'cached'
      let scanned = 0
      if (view) {
        remember(views, key, view)
      } else {
        const built = buildView(req)
        view = remember(views, key, built.view)
        op = built.op
        scanned = built.scanned
      }
      const end = Math.min(req.endRow, view.length)
      const ids: number[] = []
      for (let i = req.startRow; i < end; i += 1) ids.push(idAt(view, i))
      return { ids, rowCount: view.length, ms: performance.now() - t0, op, scanned }
    },

    /** Apply an edit, then patch every cached view and group total it touches. */
    updateRow(id: number, patch: Record<string, unknown>): { ms: number; patchedViews: number } {
      const t0 = performance.now()
      const fields = new Set(Object.keys(patch))
      if ([...fields].some((f) => /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/.test(f))) fields.add('total')
      const touched = [...views.values()].filter((v) => v.ids && [...v.fields].some((f) => fields.has(f)))
      // Where the row sits now, before the edit changes its keys.
      const before = touched.map((v) => ({ v, at: positionOf(v, id), was: passes(v.preds, id) }))
      const groupsBefore = [...groups.values()]
      const balance = columnByField('balance')!
      const rating = columnByField('rating')!
      const total = columnByField('total')!
      for (const g of groupsBefore) {
        if (passes(g.preds, id)) addToGroup(g, columnByField(g.field)!, balance, rating, total, id, -1)
      }
      edits.set(id, { ...(edits.get(id) ?? {}), ...patch })
      editMin = Math.min(editMin, id)
      editMax = Math.max(editMax, id)
      for (const g of groupsBefore) {
        if (passes(g.preds, id)) addToGroup(g, columnByField(g.field)!, balance, rating, total, id, 1)
      }
      for (const { v, at, was } of before) {
        const ids = v.ids!
        const now = passes(v.preds, id)
        let list = ids
        let length = v.length
        if (was && at >= 0) {
          list.copyWithin(at, at + 1, length)
          length -= 1
        }
        if (now) {
          if (length === list.length) {
            const grown = new Uint32Array(length + 1)
            grown.set(list.subarray(0, length))
            list = grown
          }
          const to = insertionPoint(v, list, length, id)
          list.copyWithin(to + 1, to, length)
          list[to] = id
          length += 1
        }
        v.ids = list.length === length ? list : list.subarray(0, length)
        v.length = length
      }
      // Views that sort or filter on other fields keep their order; nothing to do.
      return { ms: performance.now() - t0, patchedViews: before.length }
    },
  }

  /** Compare two rows the way `sortIds` orders them; ties by id. */
  function compareRows(v: View, a: number, b: number): number {
    for (const spec of v.sort) {
      const col = columnByField(spec.id)!
      const ka = col.kind === 'id' ? a : cellKey(col, a, edits)
      const kb = col.kind === 'id' ? b : cellKey(col, b, edits)
      if (ka !== kb) return (ka < kb ? -1 : 1) * (spec.desc ? -1 : 1)
    }
    return a - b
  }

  /** Index of `id` in a view, found by binary search on its current keys. */
  function positionOf(v: View, id: number): number {
    if (!v.ids) return -1
    let lo = 0
    let hi = v.length - 1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const c = compareRows(v, v.ids[mid]!, id)
      if (c === 0) return v.ids[mid] === id ? mid : -1
      if (c < 0) lo = mid + 1
      else hi = mid - 1
    }
    return -1
  }

  function insertionPoint(v: View, list: Uint32Array, length: number, id: number): number {
    let lo = 0
    let hi = length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (compareRows(v, list[mid]!, id) < 0) lo = mid + 1
      else hi = mid
    }
    return lo
  }
}

export type Engine = ReturnType<typeof createEngine>
