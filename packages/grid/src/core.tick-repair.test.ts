/**
 * A tick - a new data array where a few row objects were replaced - repairs
 * the filtered and sorted stages' previous output instead of recomputing it,
 * and the repaired output is exactly what the full pipeline would produce.
 *
 * The full pipeline is the oracle: for every case below a second grid is
 * built fresh from the ticked data and its rows compared, object by object
 * (same `original`, same order), against the ticked grid's rows. Sort keys
 * of every kind the sorted stage specialises (number, date, ranked text,
 * unranked text, a custom comparator), ties, descending, several clauses,
 * an active filter, and the cases that must NOT repair: an add, a remove, a
 * replacement whose filter membership flips, and a text value the ranking
 * has not seen.
 */
import { describe, expect, it } from 'vitest'
import {
  createCoreRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  createSvGridCore,
  rowSortingFeature,
  columnFilteringFeature,
  tableFeatures,
  sortFns,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from './core'

type Quote = { id: number; symbol: string; sector: string; price: number; asOf: string; note: string }

const SECTORS = ['Tech', 'Energy', 'Health', 'Finance']
function makeRows(n: number, seed = 1): Quote[] {
  let s = seed
  const rand = () => (s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    symbol: `S${String(i).padStart(4, '0')}`,
    sector: SECTORS[Math.floor(rand() * SECTORS.length)]!,
    // Many ties on purpose: the stable tie-break is the thing to get right.
    price: Math.round(rand() * 50),
    asOf: new Date(Date.UTC(2026, 0, 1 + Math.floor(rand() * 200))).toISOString(),
    note: `n${Math.floor(rand() * 1e6)}`,
  }))
}

const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
const COLUMNS = [
  { field: 'id', editorType: 'number' },
  { field: 'symbol' },
  { field: 'sector' },
  { field: 'price', editorType: 'number' },
  { field: 'asOf', editorType: 'date' },
  { field: 'note' },
] as unknown as Array<ColumnDef<typeof features, Quote>>

function makeGrid(
  data: Quote[],
  state: { sorting?: SortingState; columnFilters?: ColumnFiltersState },
  fns: typeof sortFns = sortFns,
) {
  let sortRuns = 0
  const sorted = createSortedRowModel<Quote>(fns)
  // A live getter, as <SvGrid> passes it: getRowModel reads options.data on
  // every call, so replacing the array here is what a tick looks like.
  const ref = { data }
  const grid = createSvGridCore<typeof features, Quote>({
    _features: features,
    _rowModels: {
      coreRowModel: createCoreRowModel(),
      filteredRowModel: createFilteredRowModel(),
      sortedRowModel: (args) => {
        sortRuns++
        return sorted(args)
      },
    },
    columns: COLUMNS,
    get data() {
      return ref.data
    },
    state: { sorting: [], columnFilters: [], ...state },
  })
  return { grid, sortRuns: () => sortRuns, set: (next: Quote[]) => (ref.data = next) }
}

/** The ticked data: the same array with `count` rows replaced by new objects. */
function tick(data: Quote[], count: number, mutate: (q: Quote, i: number) => Partial<Quote>, seed = 7): Quote[] {
  let s = seed
  const rand = () => (s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff
  const next = data.slice()
  const picked = new Set<number>()
  while (picked.size < count) picked.add(Math.floor(rand() * data.length))
  for (const i of picked) next[i] = { ...data[i]!, ...mutate(data[i]!, i) }
  return next
}

function originals(grid: ReturnType<typeof makeGrid>['grid']) {
  return grid.getRowModel().rows.map((r) => r.original)
}

function expectRepairedEqualsFull(
  before: Quote[],
  after: Quote[],
  state: { sorting?: SortingState; columnFilters?: ColumnFiltersState },
  fns?: typeof sortFns,
) {
  const ticked = makeGrid(before, state, fns)
  ticked.grid.getRowModel()
  ticked.set(after)
  const repaired = originals(ticked.grid)

  const oracle = makeGrid(after, state, fns)
  const full = originals(oracle.grid)

  expect(repaired.length).toBe(full.length)
  for (let i = 0; i < full.length; i++) {
    if (repaired[i] !== full[i]) {
      throw new Error(`row ${i} differs: repaired id=${repaired[i]?.id} price=${repaired[i]?.price}, full id=${full[i]?.id} price=${full[i]?.price}`)
    }
  }
  return ticked
}

describe('tick repair: sorted stage equals a full sort', () => {
  const price = (q: Quote) => ({ price: (q.price * 7 + 13) % 50 })

  it('numeric ascending, with ties', () => {
    const before = makeRows(2000)
    expectRepairedEqualsFull(before, tick(before, 150, price), { sorting: [{ id: 'price', desc: false }] })
  })

  it('numeric descending', () => {
    const before = makeRows(2000)
    expectRepairedEqualsFull(before, tick(before, 150, price), { sorting: [{ id: 'price', desc: true }] })
  })

  it('date column', () => {
    const before = makeRows(1500)
    expectRepairedEqualsFull(
      before,
      tick(before, 90, (q) => ({ asOf: new Date(Date.parse(q.asOf) + 86_400_000 * 37).toISOString() })),
      { sorting: [{ id: 'asOf', desc: false }] },
    )
  })

  it('ranked text (few distinct values) when the new value is a known one', () => {
    const before = makeRows(2000)
    expectRepairedEqualsFull(
      before,
      tick(before, 120, (q) => ({ sector: SECTORS[(SECTORS.indexOf(q.sector) + 1) % SECTORS.length]! })),
      { sorting: [{ id: 'sector', desc: false }, { id: 'price', desc: true }] },
    )
  })

  it('unranked text (mostly distinct values)', () => {
    const before = makeRows(1200)
    expectRepairedEqualsFull(before, tick(before, 60, (q, i) => ({ note: `z${i}-${q.note}` })), {
      sorting: [{ id: 'note', desc: false }],
    })
  })

  it('a custom comparator', () => {
    const before = makeRows(800)
    const custom = { ...sortFns, number: (a: unknown, b: unknown) => (Number(b) % 10) - (Number(a) % 10) }
    expectRepairedEqualsFull(before, tick(before, 40, price), { sorting: [{ id: 'price', desc: false }] }, custom)
  })

  it('three clauses', () => {
    const before = makeRows(3000)
    expectRepairedEqualsFull(before, tick(before, 200, price), {
      sorting: [{ id: 'sector', desc: true }, { id: 'price', desc: false }, { id: 'id', desc: true }],
    })
  })

  it('a replacement that leaves the key unchanged keeps its slot', () => {
    const before = makeRows(500)
    expectRepairedEqualsFull(before, tick(before, 30, (q) => ({ note: q.note + '!' })), {
      sorting: [{ id: 'price', desc: false }],
    })
  })

  it('back-to-back ticks repair on top of a repair', () => {
    const before = makeRows(2000)
    const t1 = tick(before, 100, price, 3)
    const t2 = tick(t1, 100, price, 5)
    const t3 = tick(t2, 100, price, 9)
    const g = makeGrid(before, { sorting: [{ id: 'price', desc: true }] })
    g.grid.getRowModel()
    for (const d of [t1, t2, t3]) g.set(d)
    const full = originals(makeGrid(t3, { sorting: [{ id: 'price', desc: true }] }).grid)
    expect(originals(g.grid)).toEqual(full)
  })
})

describe('tick repair: filtered stage', () => {
  const filters: ColumnFiltersState = [{ id: 'sector', value: 'Tech' }]

  it('keeps a replaced row in its slot when it still passes', () => {
    const before = makeRows(2000)
    const g = expectRepairedEqualsFull(
      before,
      tick(before, 100, (q) => ({ price: q.price + 1 })),
      { columnFilters: filters, sorting: [{ id: 'price', desc: false }] },
    )
    expect(g.sortRuns()).toBe(2)
  })

  it('falls back to the full pass when a replacement changes membership', () => {
    const before = makeRows(2000)
    expectRepairedEqualsFull(
      before,
      tick(before, 50, (q) => ({ sector: q.sector === 'Tech' ? 'Energy' : 'Tech' })),
      { columnFilters: filters, sorting: [{ id: 'price', desc: false }] },
    )
  })
})

describe('tick repair: when it must not happen', () => {
  it('an add goes through the full pipeline', () => {
    const before = makeRows(1000)
    const after = [...before, { ...before[0]!, id: 1000, symbol: 'S1000', price: 25 }]
    expectRepairedEqualsFull(before, after, { sorting: [{ id: 'price', desc: false }] })
  })

  it('a remove goes through the full pipeline', () => {
    const before = makeRows(1000)
    const after = before.filter((_, i) => i !== 17)
    expectRepairedEqualsFull(before, after, { sorting: [{ id: 'price', desc: false }] })
  })

  it('a ranked text column with a value the ranking has not seen', () => {
    const before = makeRows(2000)
    expectRepairedEqualsFull(before, tick(before, 10, () => ({ sector: 'Utilities' })), {
      sorting: [{ id: 'sector', desc: false }],
    })
  })

  it('more than a quarter of the rows replaced', () => {
    const before = makeRows(1000)
    expectRepairedEqualsFull(before, tick(before, 400, (q) => ({ price: q.price + 3 })), {
      sorting: [{ id: 'price', desc: false }],
    })
  })

  it('a sorting change between ticks', () => {
    const before = makeRows(1000)
    const g = makeGrid(before, { sorting: [{ id: 'price', desc: false }] })
    g.grid.getRowModel()
    const after = tick(before, 50, (q) => ({ price: q.price + 5 }))
    g.grid.store.setState((prev) => ({ ...prev, sorting: [{ id: 'price', desc: true }] }))
    g.set(after)
    expect(originals(g.grid)).toEqual(originals(makeGrid(after, { sorting: [{ id: 'price', desc: true }] }).grid))
  })

  it('a new array with every object the same re-reads the rows (the in-place refresh idiom)', () => {
    // `rows = [...rows]` after mutating objects in place is the documented
    // refresh (docs/help/cells/view-refresh.md). Nothing was replaced, so
    // there is no repair; the stages recompute from the current values and
    // the mutation is picked up.
    const before = makeRows(200)
    const g = makeGrid(before, { sorting: [{ id: 'price', desc: false }] })
    g.grid.getRowModel()
    before[0]!.price = 999
    g.set(before.slice())
    const rows = originals(g.grid)
    expect(rows[rows.length - 1]).toBe(before[0])
    expect(g.sortRuns()).toBe(2)
  })

  it('a kept row is assumed unchanged in value: the immutable-update contract', () => {
    // Replace one object and mutate another in place in the same tick. The
    // replaced one lands in sorted position; the mutated one keeps the slot
    // its old key earned, because the repair only reads the rows it was told
    // changed. A feed that mutates in place must not mix in replacements, or
    // must pass a new array with no replacements to refresh.
    const before = makeRows(200)
    const g = makeGrid(before, { sorting: [{ id: 'price', desc: false }] })
    g.grid.getRowModel()
    const next = before.slice()
    next[5] = { ...before[5]!, price: 999 }
    before[7]!.price = -1
    g.set(next)
    const rows = originals(g.grid)
    expect(rows[rows.length - 1]).toBe(next[5])
    expect(rows[0]).not.toBe(before[7])
  })
})
