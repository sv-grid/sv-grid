/**
 * Equivalence + work-budget tests for `createSortedRowModel`.
 *
 * The sort path was rewritten to stop resolving the clause's column inside the
 * comparator: it used to call `table.getAllColumns().find(...)` once per
 * comparison per clause, which is ~1.5M array scans for a single-clause sort of
 * 100k rows (measured - see `pnpm bench --case=sort-1col`).
 *
 * A faster sort that orders rows differently is a bug, not an optimisation, and
 * ordering has a lot of edges: nulls, undefined, unparseable dates, mixed
 * types, ties that must stay stable, and custom comparators. So rather than
 * snapshot the new output, `referenceSort` below is a literal transcription of
 * the ORIGINAL comparator, and every case asserts the two agree. If the rewrite
 * ever diverges on any input, including the randomised ones, this fails.
 */
import { describe, expect, it } from 'vitest'
// From './core' rather than './index': `createSvGridCore` is the runes-free
// engine and is not on the main barrel (it ships via the `@svgrid/grid/core`
// subpath). Driving it directly keeps this test about the row model rather than
// about Svelte reactivity.
import {
  createCoreRowModel,
  createSortedRowModel,
  createSvGridCore,
  sortFns,
  tableFeatures,
  type ColumnDef,
  type SortingState,
} from './core'

type Row = Record<string, unknown>

/**
 * The original implementation, verbatim, as the oracle. Deliberately naive:
 * this is the behaviour being preserved, not a second optimisation.
 */
function referenceSort(
  rows: Row[],
  columns: Array<{ field: string; editorType?: string }>,
  sorting: SortingState,
  fns: typeof sortFns = sortFns,
): Row[] {
  return [...rows].sort((a, b) => {
    for (const clause of sorting) {
      const column = columns.find((col) => col.field === clause.id)
      if (!column) continue
      const editorType = column.editorType
      const comparator =
        editorType === 'number'
          ? fns.number
          : editorType === 'date' || editorType === 'datetime'
            ? fns.date
            : fns.auto
      const result = comparator(a[column.field], b[column.field])
      if (result !== 0) return clause.desc ? -result : result
    }
    return 0
  })
}

function actualSort(
  rows: Row[],
  columns: Array<{ field: string; editorType?: string }>,
  sorting: SortingState,
  fns: typeof sortFns = sortFns,
): Row[] {
  const grid = createSvGridCore({
    _features: tableFeatures({}),
    _rowModels: {
      coreRowModel: createCoreRowModel(),
      sortedRowModel: createSortedRowModel(fns),
    },
    columns: columns as Array<ColumnDef<ReturnType<typeof tableFeatures>, Row>>,
    data: rows,
    state: { sorting },
  })
  return grid.getRowModel().rows.map((r) => r.original as Row)
}

/** Compare by identity, so a stable-sort difference on ties is caught too. */
function expectSameOrder(a: Row[], b: Row[]) {
  expect(a.length).toBe(b.length)
  for (let i = 0; i < a.length; i++) expect(a[i]).toBe(b[i])
}

const COLUMNS = [
  { field: 'text' },
  { field: 'num', editorType: 'number' },
  { field: 'when', editorType: 'date' },
  { field: 'tie' },
]

describe('createSortedRowModel - equivalence with the original comparator', () => {
  const nasty: Row[] = [
    { text: 'banana', num: 2, when: '2021-03-04', tie: 'x' },
    { text: 'Apple', num: 10, when: '2020-01-01', tie: 'x' },
    { text: 'apple', num: -3, when: '1999-12-31', tie: 'x' },
    { text: null, num: null, when: null, tie: 'x' },
    { text: undefined, num: undefined, when: undefined, tie: 'x' },
    { text: '', num: 0, when: '', tie: 'x' },
    { text: 'zebra', num: NaN, when: 'not a date', tie: 'x' },
    { text: '10', num: '10', when: '2020-01-01T05:00:00Z', tie: 'x' },
    { text: '9', num: '9', when: 1600000000000, tie: 'x' },
    { text: 'é', num: 1e21, when: new Date('2022-06-01'), tie: 'x' },
    { text: 'e', num: -0, when: '2022-06-01', tie: 'x' },
    { text: true, num: true, when: true, tie: 'x' },
  ]

  for (const field of ['text', 'num', 'when', 'tie']) {
    for (const desc of [false, true]) {
      it(`matches on ${field}, desc=${desc}`, () => {
        const sorting: SortingState = [{ id: field, desc }]
        expectSameOrder(actualSort(nasty, COLUMNS, sorting), referenceSort(nasty, COLUMNS, sorting))
      })
    }
  }

  it('matches on a multi-clause sort where the first clause ties everywhere', () => {
    // `tie` is identical on every row, so ordering is decided entirely by the
    // later clauses - which is where an unstable rewrite would show up.
    const sorting: SortingState = [
      { id: 'tie', desc: false },
      { id: 'num', desc: true },
      { id: 'text', desc: false },
    ]
    expectSameOrder(actualSort(nasty, COLUMNS, sorting), referenceSort(nasty, COLUMNS, sorting))
  })

  it('preserves input order when every clause ties (stability)', () => {
    const rows: Row[] = Array.from({ length: 50 }, (_, i) => ({ text: 'same', num: 1, when: null, tie: i }))
    const sorted = actualSort(rows, COLUMNS, [{ id: 'text', desc: false }])
    expect(sorted.map((r) => r.tie)).toEqual(rows.map((r) => r.tie))
  })

  it('ignores a clause naming a column that does not exist', () => {
    const sorting: SortingState = [{ id: 'nope', desc: false }, { id: 'num', desc: false }]
    expectSameOrder(actualSort(nasty, COLUMNS, sorting), referenceSort(nasty, COLUMNS, sorting))
  })

  it('returns rows untouched when there is no sorting', () => {
    expect(actualSort(nasty, COLUMNS, [])).toEqual(nasty)
  })

  it('honours custom comparators passed in place of the built-ins', () => {
    // Reverse-length ordering: nothing like the built-ins, so this only passes
    // if the rewrite actually calls the supplied function.
    const custom = {
      ...sortFns,
      auto: (a: unknown, b: unknown) => String(b).length - String(a).length,
    }
    const sorting: SortingState = [{ id: 'text', desc: false }]
    expectSameOrder(
      actualSort(nasty, COLUMNS, sorting, custom),
      referenceSort(nasty, COLUMNS, sorting, custom),
    )
  })

  // The text comparator has two paths. When a column's distinct values are few
  // relative to its rows, the distinct values are collated once and rows are
  // sorted by rank; otherwise rows are collated directly. Both must produce the
  // same order, and the small `nasty` fixture above only ever exercises the
  // second, so these force the first.
  describe('low-cardinality text (the rank path)', () => {
    const words = ['banana', 'Apple', 'apple', 'zebra', 'é', 'e', '', '10', '9', 'Ä', 'a']

    function repeated(rowCount: number): Row[] {
      return Array.from({ length: rowCount }, (_, i) => ({
        text: words[i % words.length],
        num: i,
        when: null,
        tie: 'x',
      }))
    }

    for (const desc of [false, true]) {
      it(`matches the direct comparator, desc=${desc}`, () => {
        // 220 rows over 11 distinct values: comfortably past the ratio guard.
        const rows = repeated(220)
        const sorting: SortingState = [{ id: 'text', desc }]
        expectSameOrder(actualSort(rows, COLUMNS, sorting), referenceSort(rows, COLUMNS, sorting))
      })
    }

    it('keeps equal values in input order (rank ties are still stable)', () => {
      const rows = repeated(220)
      const sorted = actualSort(rows, COLUMNS, [{ id: 'text', desc: false }])
      // Within one text value, `num` must still ascend - proof the shared rank
      // did not disturb relative order.
      const byText = new Map<unknown, number[]>()
      for (const r of sorted) {
        const list = byText.get(r.text) ?? []
        list.push(r.num as number)
        byText.set(r.text, list)
      }
      for (const [, nums] of byText) {
        expect(nums).toEqual([...nums].sort((a, b) => a - b))
      }
    })

    it('agrees with the direct path on the same data at both cardinalities', () => {
      // 22 rows over 11 values takes the rank path (11 * 2 <= 22); 20 rows over
      // the same 11 values does not (11 * 2 > 20). Same inputs, same order.
      const sorting: SortingState = [{ id: 'text', desc: false }]
      for (const count of [20, 22, 100, 121]) {
        const rows = repeated(count)
        expectSameOrder(actualSort(rows, COLUMNS, sorting), referenceSort(rows, COLUMNS, sorting))
      }
    })
  })

  it('matches across randomised datasets', () => {
    // Seeded so a failure is reproducible from the message alone.
    let seed = 42
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!
    const texts = ['a', 'B', 'c', '', null, undefined, 'ä', '10', '9']
    const nums = [0, -1, 5, null, undefined, NaN, '3', 1e9]
    const dates = ['2020-01-01', '2021-05-05', null, undefined, 'junk', 1600000000000]

    for (let trial = 0; trial < 25; trial++) {
      const rows: Row[] = Array.from({ length: 60 }, () => ({
        text: pick(texts), num: pick(nums), when: pick(dates), tie: pick(['p', 'q']),
      }))
      const sorting: SortingState = [
        { id: pick(['text', 'num', 'when', 'tie']), desc: rand() > 0.5 },
        { id: pick(['text', 'num', 'when']), desc: rand() > 0.5 },
      ]
      expectSameOrder(actualSort(rows, COLUMNS, sorting), referenceSort(rows, COLUMNS, sorting))
    }
  })
})

describe('createSortedRowModel - work budget', () => {
  /** Count `getAllColumns` calls the way tools/bench does, but in-process. */
  function countColumnLookups(rowCount: number, sorting: SortingState): number {
    const rows: Row[] = Array.from({ length: rowCount }, (_, i) => ({
      text: `t${(i * 7919) % rowCount}`,
      num: (i * 31) % rowCount,
      when: null,
      tie: 'x',
    }))
    let calls = 0
    const grid = createSvGridCore({
      _features: tableFeatures({}),
      _rowModels: {
        coreRowModel: createCoreRowModel(),
        sortedRowModel: (args) => {
          const table = new Proxy(args.table, {
            get(obj, prop, recv) {
              const v = Reflect.get(obj, prop, recv)
              if (prop === 'getAllColumns' && typeof v === 'function') {
                return (...a: unknown[]) => {
                  calls++
                  return (v as (...x: unknown[]) => unknown).apply(obj, a)
                }
              }
              return v
            },
          })
          return createSortedRowModel()({ ...args, table })
        },
      },
      columns: COLUMNS as Array<ColumnDef<ReturnType<typeof tableFeatures>, Row>>,
      data: rows,
      state: { sorting },
    })
    grid.getRowModel()
    return calls
  }

  it('resolves each clause once instead of once per comparison', () => {
    // The original made this proportional to n log n: 2,000 rows produced tens
    // of thousands of lookups. A handful is the whole point of the rewrite, and
    // the budget is what stops it regressing.
    expect(countColumnLookups(2_000, [{ id: 'num', desc: false }])).toBeLessThanOrEqual(4)
    expect(
      countColumnLookups(2_000, [
        { id: 'text', desc: false },
        { id: 'num', desc: true },
        { id: 'tie', desc: false },
      ]),
    ).toBeLessThanOrEqual(12)
  })

  it('does not grow with row count', () => {
    const small = countColumnLookups(500, [{ id: 'num', desc: false }])
    const large = countColumnLookups(20_000, [{ id: 'num', desc: false }])
    expect(large).toBe(small)
  })
})
