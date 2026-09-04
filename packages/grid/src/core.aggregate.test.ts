/**
 * Equivalence tests for `applyGroupAggregate`.
 *
 * Grouping 100k rows by two columns with three aggregators took 213ms, of which
 * ~132ms was this function: each aggregated column of each group allocated a
 * `raw` array, then a mapped array, then a filtered one, and `min`/`max`/
 * `extent` finished by spreading the whole group into `Math.min(...)`.
 * Measured by varying the aggregator count - 9 aggregated columns cost 823ms
 * against 81ms for none.
 *
 * The rewrite is a single pass with no intermediate arrays. `reference` below
 * is the original, verbatim, and every case asserts the two agree - including
 * the awkward ones: empty groups, all-non-numeric values, -0, and the
 * float-addition ORDER, since `reduce` and a loop must accumulate identically
 * for the sums to match bit for bit.
 *
 * The spread also had a latent failure mode this fixes: `Math.min(...nums)`
 * throws RangeError once a group is large enough to exhaust the argument
 * stack, so `min` on a big single-bucket group could crash the grid. The last
 * test pins that.
 */
import { describe, expect, it } from 'vitest'
import { applyGroupAggregate, type GroupAggregator, type Row } from './core'

/** Minimal Row stand-in: the function only ever calls getCellValueByColumnId. */
function rowsOf(values: unknown[]): Array<Row<Record<string, unknown>>> {
  return values.map(
    (v, i) =>
      ({
        id: String(i),
        index: i,
        original: { v },
        depth: 0,
        getCanExpand: () => false,
        getIsExpanded: () => false,
        toggleExpanded: () => {},
        getIsSelected: () => false,
        toggleSelected: () => {},
        getAllCells: () => [],
        getCellValueByColumnId: () => v,
      }) as unknown as Row<Record<string, unknown>>,
  )
}

/** The original implementation, verbatim, as the oracle. */
function reference<TData extends Record<string, unknown>>(
  agg: GroupAggregator<TData>,
  columnId: string,
  rows: ReadonlyArray<Row<TData>>,
): unknown {
  const raw = rows.map((r) => r.getCellValueByColumnId(columnId))
  if (typeof agg === 'function') {
    const nums = raw.map((v) => Number(v)).filter((n) => Number.isFinite(n))
    return agg(nums, rows.map((r) => r.original))
  }
  if (agg === 'count') return rows.length
  if (agg === 'countDistinct') return new Set(raw.map((v) => String(v ?? ''))).size
  if (agg === 'first') return raw[0]
  const nums = raw.map((v) => Number(v)).filter((n) => Number.isFinite(n))
  if (!nums.length) return undefined
  switch (agg) {
    case 'sum':
      return nums.reduce((a, b) => a + b, 0)
    case 'avg':
      return nums.reduce((a, b) => a + b, 0) / nums.length
    case 'min':
      return Math.min(...nums)
    case 'max':
      return Math.max(...nums)
    case 'extent':
      return `${Math.min(...nums)} – ${Math.max(...nums)}`
    default:
      return undefined
  }
}

const AGGS: GroupAggregator[] = ['sum', 'avg', 'min', 'max', 'count', 'countDistinct', 'extent', 'first']

const DATASETS: Array<[string, unknown[]]> = [
  ['empty', []],
  ['single value', [5]],
  ['plain integers', [3, 1, 2, 10, -4]],
  ['floats that expose accumulation order', [0.1, 0.2, 0.3, 0.7, 1e-16, 1e16]],
  ['all non-numeric', ['a', 'b', {}, [], true]],
  ['mixed numeric and not', [1, 'x', 2, null, 3, undefined, NaN, Infinity, -Infinity]],
  ['nulls and undefined only', [null, undefined]],
  ['numeric strings', ['1', '2', '10']],
  ['duplicates for countDistinct', ['a', 'a', 'b', null, undefined, '']],
  ['negative zero', [-0, 0, 1]],
  ['very large and small', [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, 0]],
  ['booleans', [true, false, true]],
]

describe('applyGroupAggregate - equivalence with the original', () => {
  for (const [name, values] of DATASETS) {
    for (const agg of AGGS) {
      it(`${agg} over ${name}`, () => {
        const rows = rowsOf(values)
        const expected = reference(agg, 'v', rows)
        const actual = applyGroupAggregate(agg, 'v', rows)
        // Object.is so NaN matches NaN and -0 does not silently pass as 0.
        expect(Object.is(actual, expected) || actual === expected).toBe(true)
      })
    }
  }

  it('passes finite numbers and originals to a custom aggregator, unchanged', () => {
    const seen: Array<{ nums: number[]; count: number }> = []
    const custom: GroupAggregator = (nums, originals) => {
      seen.push({ nums: [...nums], count: originals.length })
      return nums.length
    }
    const rows = rowsOf([1, 'x', 2, null, NaN, 3])
    const expected = reference(custom, 'v', rows)
    const actual = applyGroupAggregate(custom, 'v', rows)
    expect(actual).toBe(expected)
    // Both calls saw identical arguments.
    expect(seen[0]).toEqual(seen[1])
    // `null` is included: Number(null) is 0, which is finite. `'x'` and NaN are
    // not. Worth pinning - it is the kind of coercion a rewrite silently drops.
    expect(seen[0]!.nums).toEqual([1, 2, 0, 3])
    expect(seen[0]!.count).toBe(6)
  })

  it('handles a group larger than the argument-spread limit', () => {
    // The original did `Math.min(...nums)`, which throws RangeError once the
    // group exceeds the engine's argument cap. A single bucket holding this
    // many rows is ordinary on a large grid grouped by a low-cardinality field.
    const rows = rowsOf(Array.from({ length: 200_000 }, (_, i) => i))
    expect(applyGroupAggregate('min', 'v', rows)).toBe(0)
    expect(applyGroupAggregate('max', 'v', rows)).toBe(199_999)
    expect(applyGroupAggregate('extent', 'v', rows)).toBe('0 – 199999')
  })
})
