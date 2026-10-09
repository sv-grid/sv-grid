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
 *
 * The oracle calls the pairwise `sortFns`, so it tracks their semantics: since
 * #104 those put blanks and unparseable values first instead of returning NaN,
 * and `auto` compares numbers numerically.
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

    // From 20,000 rows a one-column numeric sort orders indices with a radix
    // sort over the float bits (and ranked text with a counting sort) instead
    // of a comparator. Same order, ties included.
    describe('large numeric columns (the radix path)', () => {
      const values: unknown[] = [0, -0, -1, 1, 2.5, -2.5, 1e9, -1e9, null, undefined, '', 'n/a', Infinity, -Infinity, 7, 7, 7, 0.1, -0.1, '12']
      const big = (count: number): Row[] =>
        Array.from({ length: count }, (_, i) => ({ text: 't', num: values[(i * 31) % values.length], when: null, tie: i }))
      for (const desc of [false, true]) {
        it(`matches the comparator sort, desc=${desc}`, () => {
          const rows = big(25_000)
          const sorting: SortingState = [{ id: 'num', desc }]
          expectSameOrder(actualSort(rows, COLUMNS, sorting), referenceSort(rows, COLUMNS, sorting))
        })
      }
      it('matches on date keys', () => {
        const dates = ['2020-01-01', '2021-05-05', null, 'junk', 1600000000000, '1999-12-31', '2020-01-01']
        const rows: Row[] = Array.from({ length: 25_000 }, (_, i) => ({ text: 't', num: 0, when: dates[(i * 13) % dates.length], tie: i }))
        for (const desc of [false, true]) {
          const sorting: SortingState = [{ id: 'when', desc }]
          expectSameOrder(actualSort(rows, COLUMNS, sorting), referenceSort(rows, COLUMNS, sorting))
        }
      })
    })

    // Past 2,048 rows the choice is made from a sample. A 256-row sample used
    // to miss repetition at this shape - every value a dozen times over, but
    // spread thin enough that 256 rows hardly repeat - so a 1M-row column of
    // 80k values was collated row by row (20M collator calls, 1.75 s).
    describe('sampled columns (more rows than the sample)', () => {
      const tag = (i: number) => `w${(i * 7919) % 2500}`
      function countCollations<T>(run: () => T): { result: T; calls: number } {
        const original = String.prototype.localeCompare
        let calls = 0
        String.prototype.localeCompare = function (this: string, ...args: Parameters<typeof original>) {
          calls++
          return original.apply(this, args)
        }
        try {
          return { result: run(), calls }
        } finally {
          String.prototype.localeCompare = original
        }
      }

      it('ranks a column of repeated values, and the order is unchanged', () => {
        // 30,000 rows over 2,500 values, each about 12 times.
        const rows: Row[] = Array.from({ length: 30_000 }, (_, i) => ({ text: tag(i), num: i, when: null, tie: 'x' }))
        const sorting: SortingState = [{ id: 'text', desc: false }]
        const { result, calls } = countCollations(() => actualSort(rows, COLUMNS, sorting))
        expectSameOrder(result, referenceSort(rows, COLUMNS, sorting))
        // Ranked: the 2,500 distinct values are collated, not the 30,000 rows.
        expect(calls).toBeLessThan(rows.length)
      })

      it('collates a mostly-unique column row by row, in the same order', () => {
        const rows: Row[] = Array.from({ length: 30_000 }, (_, i) => ({ text: `u${(i * 7919) % 29_000}`, num: i, when: null, tie: 'x' }))
        const sorting: SortingState = [{ id: 'text', desc: true }]
        expectSameOrder(actualSort(rows, COLUMNS, sorting), referenceSort(rows, COLUMNS, sorting))
      })
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

describe('built-in comparators keep the Array.sort contract (#104)', () => {
  it('number: non-numeric values sort together ahead of the numbers', () => {
    expect([5, 'n/a', 3, 1, 'n/a', 4, 2].sort(sortFns.number)).toEqual(['n/a', 'n/a', 1, 2, 3, 4, 5])
    expect(sortFns.number('n/a', 'x')).toBe(0)
    expect(Number.isNaN(sortFns.number('n/a', 3))).toBe(false)
  })

  it('date: blanks and invalid dates sort first and never return NaN', () => {
    // null, not undefined: Array.prototype.sort moves undefined to the end
    // without calling the comparator.
    const sorted = ['2021-01-01', null, 'junk', '2020-01-01'].sort(sortFns.date)
    expect(sorted).toEqual([null, 'junk', '2020-01-01', '2021-01-01'])
    expect(sortFns.date(undefined, 'junk')).toBe(0)
  })

  it('auto: numbers compare numerically, blanks come first', () => {
    expect([2, 10, 1, 20, 100, 3].sort(sortFns.auto)).toEqual([1, 2, 3, 10, 20, 100])
    expect(['oak', null, 'nuclear', '', 'apple'].sort(sortFns.auto)).toEqual([
      null, '', 'apple', 'nuclear', 'oak',
    ])
  })

  it('every built-in comparator is antisymmetric and transitive on mixed values', () => {
    const pool: unknown[] = [
      null, undefined, '', 0, -1, 2, 10, NaN, 1e21, '1a', '2', '10', 'n/a', 'apple', 'Apple',
      true, '2020-01-01', 'junk', 1600000000000,
    ]
    for (const [name, cmp] of Object.entries(sortFns)) {
      const sign = (a: unknown, b: unknown) => Math.sign(cmp(a, b))
      for (const a of pool) {
        for (const b of pool) {
          const ab = sign(a, b)
          expect(Number.isNaN(ab), `${name}(${String(a)}, ${String(b)}) is NaN`).toBe(false)
          expect(ab, `${name} antisymmetry on ${String(a)}, ${String(b)}`).toBe(-sign(b, a) || 0)
          for (const c of pool) {
            if (ab <= 0 && sign(b, c) <= 0) {
              expect(sign(a, c), `${name}: ${String(a)} <= ${String(b)} <= ${String(c)}`).toBeLessThanOrEqual(0)
            }
          }
        }
      }
    }
  })

  it('sorts an untyped numeric column numerically in the row model', () => {
    const rows: Row[] = [2, 10, null, 1, 20, 100, 3].map((qty) => ({ qty }))
    const cols = [{ field: 'qty' }]
    expect(actualSort(rows, cols, [{ id: 'qty', desc: false }]).map((r) => r.qty)).toEqual([
      null, 1, 2, 3, 10, 20, 100,
    ])
    expect(actualSort(rows, cols, [{ id: 'qty', desc: true }]).map((r) => r.qty)).toEqual([
      100, 20, 10, 3, 2, 1, null,
    ])
  })

  it('sorts a number column with placeholder text in order', () => {
    const rows: Row[] = [5, 'n/a', 3, 1, 'n/a', 4, 2].map((v) => ({ v }))
    const sorted = actualSort(rows, [{ field: 'v', editorType: 'number' }], [{ id: 'v', desc: false }])
    expect(sorted.map((r) => r.v)).toEqual(['n/a', 'n/a', 1, 2, 3, 4, 5])
  })

  it('orders a mixed number and text column by kind, then value', () => {
    const rows: Row[] = [10, 'b', 2, null, 'a', 1].map((v) => ({ v }))
    const sorted = actualSort(rows, [{ field: 'v' }], [{ id: 'v', desc: false }])
    expect(sorted.map((r) => r.v)).toEqual([null, 1, 2, 10, 'a', 'b'])
  })

  it('lets the next clause decide when two blanks tie on a numeric clause', () => {
    // Two -Infinity keys subtract to NaN; the multi-clause loop must see 0.
    const rows: Row[] = [
      { num: null, text: 'b' },
      { num: 'n/a', text: 'a' },
      { num: 1, text: 'c' },
    ]
    const sorted = actualSort(rows, COLUMNS, [
      { id: 'num', desc: false },
      { id: 'text', desc: false },
    ])
    expect(sorted.map((r) => r.text)).toEqual(['a', 'b', 'c'])
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
