import { describe, expect, it } from 'vitest'
import { parseFormula } from '../parse'
import { evaluate, type EvalContext } from '../evaluate'
import { withCustomFunctions } from '../functions'
import type { CellValue } from '../ast'

/**
 * Excel's orchard, the dataset its own Database examples use, with the
 * criteria blocks laid out below it the way a sheet would hold them.
 *
 *        A        B       C     D      E
 *  1   Tree     Height   Age   Yield  Profit
 *  2   Apple      18      20     14    105
 *  3   Pear       12      12     10     96
 *  4   Cherry     13      14      9    105
 *  5   Apple      14      15     10     75
 *  6   Pear        9       8      8     76.8
 *  7   Apple       8       9      6     45
 *
 *  9   Tree     Height                     <- A9:B10, apples over ten
 * 10   Apple    ">10"
 *
 * 12   Tree                                <- A12:A14, apples OR pears
 * 13   Apple
 * 14   Pear
 *
 * 16   Tree                                <- A16:A16, no rules at all
 *
 * 18   Tree                                <- A18:A19, the one cherry
 * 19   Cherry
 *
 * 21   Tree                                <- A21:A22, nothing at all
 * 22   Banana
 */
const CELLS: CellValue[][] = [
  ['Tree', 'Height', 'Age', 'Yield', 'Profit'],
  ['Apple', 18, 20, 14, 105],
  ['Pear', 12, 12, 10, 96],
  ['Cherry', 13, 14, 9, 105],
  ['Apple', 14, 15, 10, 75],
  ['Pear', 9, 8, 8, 76.8],
  ['Apple', 8, 9, 6, 45],
  [],
  ['Tree', 'Height'],
  ['Apple', '>10'],
  [],
  ['Tree'],
  ['Apple'],
  ['Pear'],
  [],
  ['Tree'],
  [],
  ['Tree'],
  ['Cherry'],
  [],
  ['Tree'],
  ['Banana'],
]

function ctx(): EvalContext {
  return {
    resolve: (_s, r, c) => {
      const row = CELLS[r]
      if (!row) return ''
      return row[c] ?? ''
    },
    lastRow: () => CELLS.length - 1,
    functions: withCustomFunctions(undefined),
  }
}

const run = (src: string): CellValue => evaluate(parseFormula(src), ctx())
const near = (src: string, expected: number, digits = 6) =>
  expect(run(src)).toBeCloseTo(expected, digits)

const DB = 'A1:E7'
const APPLES_OVER_TEN = 'A9:B10'
const APPLES_OR_PEARS = 'A12:A14'
const NO_RULES = 'A16:A16'
const THE_CHERRY = 'A18:A19'
const NOTHING = 'A21:A22'

describe('the aggregates', () => {
  it('reads the field by its header', () => {
    // Apple over ten: the rows at 18 and 14 high, so 105 and 75.
    expect(run(`=DSUM(${DB}, "Profit", ${APPLES_OVER_TEN})`)).toBe(180)
    expect(run(`=DCOUNT(${DB}, "Profit", ${APPLES_OVER_TEN})`)).toBe(2)
    expect(run(`=DMAX(${DB}, "Profit", ${APPLES_OVER_TEN})`)).toBe(105)
    expect(run(`=DMIN(${DB}, "Profit", ${APPLES_OVER_TEN})`)).toBe(75)
    expect(run(`=DAVERAGE(${DB}, "Profit", ${APPLES_OVER_TEN})`)).toBe(90)
    expect(run(`=DPRODUCT(${DB}, "Yield", ${APPLES_OVER_TEN})`)).toBe(140)
  })

  it('reads the field by its one-based position', () => {
    expect(run(`=DSUM(${DB}, 5, ${APPLES_OVER_TEN})`)).toBe(180)
    expect(run(`=DSUM(${DB}, 2, ${APPLES_OVER_TEN})`)).toBe(32)
  })

  it('matches the header ignoring case and surrounding space', () => {
    expect(run(`=DSUM(${DB}, "profit", ${APPLES_OVER_TEN})`)).toBe(180)
    expect(run(`=DSUM(${DB}, " Profit ", ${APPLES_OVER_TEN})`)).toBe(180)
  })

  it('reports a field the database does not have', () => {
    expect(run(`=DSUM(${DB}, "Colour", ${APPLES_OVER_TEN})`)).toEqual({ error: '#VALUE!' })
    expect(run(`=DSUM(${DB}, 9, ${APPLES_OVER_TEN})`)).toEqual({ error: '#VALUE!' })
  })
})

describe('the criteria grammar', () => {
  it('ORs the rows of the criteria block', () => {
    // Every apple and every pear: 105 + 75 + 45 + 96 + 76.8
    near(`=DSUM(${DB}, "Profit", ${APPLES_OR_PEARS})`, 397.8, 6)
    expect(run(`=DCOUNT(${DB}, "Profit", ${APPLES_OR_PEARS})`)).toBe(5)
  })

  it('ANDs the columns within one criteria row', () => {
    // The same block without the height rule would be all three apples.
    expect(run(`=DCOUNT(${DB}, "Profit", ${APPLES_OVER_TEN})`)).toBe(2)
  })

  it('matches every record when the block is headers alone', () => {
    near(`=DSUM(${DB}, "Profit", ${NO_RULES})`, 502.8, 6)
    expect(run(`=DCOUNT(${DB}, "Profit", ${NO_RULES})`)).toBe(6)
  })

  it('matches nothing when no record satisfies the block', () => {
    // Excel answers an empty DSUM with zero rather than an error.
    expect(run(`=DSUM(${DB}, "Profit", ${NOTHING})`)).toBe(0)
    expect(run(`=DCOUNT(${DB}, "Profit", ${NOTHING})`)).toBe(0)
    expect(run(`=DAVERAGE(${DB}, "Profit", ${NOTHING})`)).toEqual({ error: '#DIV/0!' })
  })
})

describe('DGET', () => {
  it('returns the one record that matches', () => {
    expect(run(`=DGET(${DB}, "Profit", ${THE_CHERRY})`)).toBe(105)
    expect(run(`=DGET(${DB}, "Height", ${THE_CHERRY})`)).toBe(13)
  })

  it('refuses when the match is not exactly one', () => {
    expect(run(`=DGET(${DB}, "Profit", ${NOTHING})`)).toEqual({ error: '#VALUE!' })
    expect(run(`=DGET(${DB}, "Profit", ${APPLES_OVER_TEN})`)).toEqual({ error: '#NUM!' })
  })
})

describe('the spread aggregates', () => {
  it('computes variance and deviation over the matching records', () => {
    // Apples over ten: profits 105 and 75, so a mean of 90.
    near(`=DVAR(${DB}, "Profit", ${APPLES_OVER_TEN})`, 450, 6)
    near(`=DVARP(${DB}, "Profit", ${APPLES_OVER_TEN})`, 225, 6)
    near(`=DSTDEV(${DB}, "Profit", ${APPLES_OVER_TEN})`, Math.sqrt(450), 6)
    near(`=DSTDEVP(${DB}, "Profit", ${APPLES_OVER_TEN})`, 15, 6)
  })

  it('DCOUNTA counts anything that is not blank', () => {
    expect(run(`=DCOUNTA(${DB}, "Tree", ${NO_RULES})`)).toBe(6)
    // DCOUNT over the same text field counts no numbers at all.
    expect(run(`=DCOUNT(${DB}, "Tree", ${NO_RULES})`)).toBe(0)
  })
})
