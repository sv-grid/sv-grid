import { describe, expect, it } from 'vitest'
import { parseFormula } from './parse'
import { evaluate, formatValue, type EvalContext } from './evaluate'
import { withCustomFunctions } from './functions'
import type { CellValue } from './ast'

/** Evaluate against a literal sheet. `sheets` keys are sheet names; the
 *  unnamed sheet is the one the formula lives on. */
function ctxOf(
  cells: CellValue[][],
  sheets: Record<string, CellValue[][]> = {},
  names: Record<string, CellValue> = {},
): EvalContext {
  const pick = (s: string | null) => (s === null ? cells : sheets[s] ?? [])
  return {
    resolve: (s, r, c) => {
      const grid = pick(s)
      if (r < 0 || r >= grid.length) return { error: '#REF!' }
      const row = grid[r]!
      if (c < 0 || c >= row.length) return { error: '#REF!' }
      return row[c] ?? ''
    },
    lastRow: (s) => Math.max(pick(s).length - 1, 0),
    resolveName: (n) => names[n],
    functions: withCustomFunctions(undefined),
  }
}

const run = (src: string, cells: CellValue[][] = [], sheets = {}, names = {}) =>
  evaluate(parseFormula(src), ctxOf(cells, sheets, names))

describe('arithmetic', () => {
  it('does the four operations', () => {
    expect(run('=1+2')).toBe(3)
    expect(run('=5-2')).toBe(3)
    expect(run('=3*4')).toBe(12)
    expect(run('=8/2')).toBe(4)
  })

  it('returns #DIV/0! rather than Infinity', () => {
    expect(run('=1/0')).toEqual({ error: '#DIV/0!' })
  })

  it('treats % as Excel does: POSTFIX percent, not binary modulo', () => {
    // Excel has no binary %; MOD() is the function. Reading it as modulo
    // makes =50% and =A1*5% parse errors, which is what shipped first.
    expect(run('=50%')).toBe(0.5)
    expect(run('=100%')).toBe(1)
    expect(run('=A1*5%', [[200]])).toBeCloseTo(10, 10)
    expect(run('=1+50%')).toBe(1.5)
    expect(run('=MOD(7,3)')).toBe(1)
  })

  it('stacks percent signs, as Excel does', () => {
    expect(run('=50%%')).toBeCloseTo(0.005, 10)
  })

  it('raises to a power, right associatively', () => {
    expect(run('=2^10')).toBe(1024)
    expect(run('=2^3^2')).toBe(512)
  })

  it('treats a blank cell as zero in arithmetic', () => {
    expect(run('=A1+1', [['']])).toBe(1)
  })

  it('returns #VALUE! for text in arithmetic', () => {
    expect(run('="abc"+1')).toEqual({ error: '#VALUE!' })
  })

  it('coerces numeric text', () => {
    expect(run('="5"+1')).toBe(6)
  })

  it('concatenates with &', () => {
    expect(run('="a"&"b"')).toBe('ab')
    expect(run('=1&2')).toBe('12')
  })
})

describe('comparison', () => {
  it('compares numbers', () => {
    expect(run('=1<2')).toBe(true)
    expect(run('=2<=2')).toBe(true)
    expect(run('=3<>3')).toBe(false)
  })

  it('compares text case-insensitively', () => {
    expect(run('="a"="A"')).toBe(true)
  })

  it('does not equate a number with the text that looks like it', () => {
    expect(run('=1="1"')).toBe(false)
  })
})

describe('references', () => {
  const grid: CellValue[][] = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]

  it('reads a cell', () => {
    expect(run('=B2', grid)).toBe(5)
  })

  it('reads an absolute reference the same as a relative one', () => {
    expect(run('=$B$2', grid)).toBe(5)
  })

  it('returns #REF! past the edge', () => {
    expect(run('=A9', grid)).toEqual({ error: '#REF!' })
    expect(run('=Z1', grid)).toEqual({ error: '#REF!' })
  })

  it('sums a range', () => {
    expect(run('=SUM(A1:C1)', grid)).toBe(6)
    expect(run('=SUM(A1:C3)', grid)).toBe(45)
  })

  it('collapses a range to its top-left in scalar position', () => {
    expect(run('=A1:C3+0', grid)).toBe(1)
  })

  it('reads a cross-sheet reference', () => {
    expect(run("='Price list'!A1", [], { 'Price list': [[42]] })).toBe(42)
  })

  it('sums a whole-column range to the last used row', () => {
    expect(run('=SUM(Data!A)', [], { Data: [[1], [2], [3]] })).toBe(6)
  })

  it('resolves a defined name', () => {
    expect(run('=Tax*2', [], {}, { Tax: 10 })).toBe(20)
  })

  it('returns #NAME? for an unknown name', () => {
    expect(run('=Nope')).toEqual({ error: '#NAME?' })
  })
})

describe('short circuiting', () => {
  it('does not evaluate the branch IF did not take', () => {
    // The whole point: =IF(A1=0, 0, 100/A1) must not raise #DIV/0! when A1 is
    // zero. Evaluating both branches up front is the classic way to break it.
    expect(run('=IF(A1=0, 0, 100/A1)', [[0]])).toBe(0)
  })

  it('still evaluates the branch it did take', () => {
    expect(run('=IF(A1=0, 0, 100/A1)', [[4]])).toBe(25)
  })

  it('IFERROR catches an error from its first argument', () => {
    expect(run('=IFERROR(1/0, "safe")')).toBe('safe')
    expect(run('=IFERROR(A9, 0)', [[1]])).toBe(0)
  })

  it('IFERROR passes a good value straight through', () => {
    expect(run('=IFERROR(1+1, 0)')).toBe(2)
  })

  it('IFNA catches only #N/A', () => {
    expect(run('=IFNA(MATCH("z", A1:A2, 0), "none")', [['a'], ['b']])).toBe('none')
    expect(run('=IFNA(1/0, "none")')).toEqual({ error: '#DIV/0!' })
  })

  it('IFS returns the first matching branch', () => {
    expect(run('=IFS(FALSE, 1, TRUE, 2, TRUE, 3)')).toBe(2)
  })

  it('IFS returns #N/A when nothing matches', () => {
    expect(run('=IFS(FALSE, 1)')).toEqual({ error: '#N/A' })
  })

  it('SWITCH matches, and falls back to a trailing default', () => {
    expect(run('=SWITCH(2, 1, "one", 2, "two", "other")')).toBe('two')
    expect(run('=SWITCH(9, 1, "one", "other")')).toBe('other')
  })
})

describe('the function library', () => {
  const col: CellValue[][] = [[1], [2], [3], [''], ['x']]

  it('aggregates, skipping blanks and text', () => {
    expect(run('=SUM(A1:A5)', col)).toBe(6)
    expect(run('=AVERAGE(A1:A5)', col)).toBe(2)
    expect(run('=COUNT(A1:A5)', col)).toBe(3)
    expect(run('=COUNTA(A1:A5)', col)).toBe(4)
    expect(run('=COUNTBLANK(A1:A5)', col)).toBe(1)
    expect(run('=MIN(A1:A5)', col)).toBe(1)
    expect(run('=MAX(A1:A5)', col)).toBe(3)
  })

  it('returns #DIV/0! averaging nothing numeric', () => {
    expect(run('=AVERAGE(A1:A1)', [['x']])).toEqual({ error: '#DIV/0!' })
  })

  it('rounds half away from zero, not to even', () => {
    expect(run('=ROUND(2.5, 0)')).toBe(3)
    expect(run('=ROUND(1.005, 2)')).toBe(1.01)
    expect(run('=ROUNDUP(1.001, 2)')).toBe(1.01)
    expect(run('=ROUNDDOWN(1.999, 2)')).toBe(1.99)
    expect(run('=ROUNDDOWN(-1.999, 2)')).toBe(-1.99)
  })

  it('follows the sign of the divisor in MOD, as Excel does', () => {
    // JavaScript's % gives -1 here; Excel gives 2.
    expect(run('=MOD(-7, 3)')).toBe(2)
    expect(run('=MOD(7, -3)')).toBe(-2)
  })

  it('does the statistics', () => {
    expect(run('=MEDIAN(A1:A3)', [[3], [1], [2]])).toBe(2)
    expect(run('=MEDIAN(A1:A4)', [[1], [2], [3], [4]])).toBe(2.5)
    expect(run('=SQRT(9)')).toBe(3)
    expect(run('=SQRT(-1)')).toEqual({ error: '#NUM!' })
    expect(run('=POWER(2,8)')).toBe(256)
    expect(run('=INT(1.9)')).toBe(1)
  })

  it('does conditional aggregation', () => {
    const sheet: CellValue[][] = [['a', 1], ['b', 2], ['a', 3]]
    expect(run('=COUNTIF(A1:A3, "a")', sheet)).toBe(2)
    expect(run('=SUMIF(A1:A3, "a", B1:B3)', sheet)).toBe(4)
    expect(run('=AVERAGEIF(A1:A3, "a", B1:B3)', sheet)).toBe(2)
  })

  it('reads an operator criterion', () => {
    const sheet: CellValue[][] = [[1], [5], [10]]
    expect(run('=COUNTIF(A1:A3, ">4")', sheet)).toBe(2)
    expect(run('=SUMIF(A1:A3, ">=5")', sheet)).toBe(15)
    expect(run('=COUNTIF(A1:A3, "<>5")', sheet)).toBe(2)
  })

  it('does multi-criteria aggregation', () => {
    const sheet: CellValue[][] = [['a', 'x', 1], ['a', 'y', 2], ['b', 'x', 4]]
    expect(run('=COUNTIFS(A1:A3, "a", B1:B3, "x")', sheet)).toBe(1)
    expect(run('=SUMIFS(C1:C3, A1:A3, "a")', sheet)).toBe(3)
  })

  it('does the text functions', () => {
    expect(run('=LEN("abc")')).toBe(3)
    expect(run('=LEFT("abcdef", 3)')).toBe('abc')
    expect(run('=RIGHT("abcdef", 2)')).toBe('ef')
    expect(run('=RIGHT("ab", 9)')).toBe('ab')
    expect(run('=MID("abcdef", 2, 3)')).toBe('bcd')
    expect(run('=UPPER("aB")')).toBe('AB')
    expect(run('=LOWER("aB")')).toBe('ab')
    expect(run('=TRIM("  a   b  ")')).toBe('a b')
    expect(run('=CONCAT("a", 1, TRUE)')).toBe('a1TRUE')
    expect(run('=SUBSTITUTE("a-b-c", "-", "+")')).toBe('a+b+c')
    expect(run('=TEXTJOIN(", ", TRUE, A1:A3)', [['a'], [''], ['c']])).toBe('a, c')
  })

  it('finds case sensitively and searches case insensitively', () => {
    expect(run('=FIND("B", "aBc")')).toBe(2)
    expect(run('=FIND("b", "aBc")')).toEqual({ error: '#VALUE!' })
    expect(run('=SEARCH("b", "aBc")')).toBe(2)
  })

  it('formats with TEXT', () => {
    expect(run('=TEXT(1234.5, "0.00")')).toBe('1234.50')
    expect(run('=TEXT(1234.5, "#,##0.00")')).toBe('1,234.50')
  })

  it('does the date functions', () => {
    expect(run('=YEAR("2026-09-14")')).toBe(2026)
    expect(run('=MONTH("2026-09-14")')).toBe(9)
    expect(run('=DAY("2026-09-14")')).toBe(14)
    expect(run('=DATE(2026, 9, 14)')).toBe('2026-09-14')
    expect(run('=EOMONTH("2026-01-15", 0)')).toBe('2026-01-31')
    expect(run('=EOMONTH("2026-01-15", 1)')).toBe('2026-02-28')
  })

  it('does the lookups', () => {
    const table: CellValue[][] = [['a', 10], ['b', 20], ['c', 30]]
    expect(run('=VLOOKUP("b", A1:B3, 2)', table)).toBe(20)
    expect(run('=VLOOKUP("z", A1:B3, 2)', table)).toEqual({ error: '#N/A' })
    expect(run('=VLOOKUP("b", A1:B3, 9)', table)).toEqual({ error: '#REF!' })
    expect(run('=MATCH("c", A1:A3, 0)', table)).toBe(3)
    expect(run('=INDEX(A1:B3, 2, 2)', table)).toBe(20)
    expect(run('=XLOOKUP("b", A1:A3, B1:B3)', table)).toBe(20)
    expect(run('=XLOOKUP("z", A1:A3, B1:B3, "missing")', table)).toBe('missing')
  })

  it('does HLOOKUP across the header row', () => {
    const table: CellValue[][] = [['a', 'b'], [1, 2]]
    expect(run('=HLOOKUP("b", A1:B2, 2)', table)).toBe(2)
  })

  it('returns #NAME? for a function it does not have', () => {
    expect(run('=NOSUCHFN(1)')).toEqual({ error: '#NAME?' })
  })

  it('propagates an error out of a range into an aggregate', () => {
    expect(run('=SUM(A1:A2)', [[1], [{ error: '#REF!' }]])).toEqual({ error: '#REF!' })
  })
})

describe('formatValue', () => {
  it('renders each value kind the way a cell shows it', () => {
    expect(formatValue(1.5)).toBe('1.5')
    expect(formatValue(true)).toBe('TRUE')
    expect(formatValue('x')).toBe('x')
    expect(formatValue({ error: '#REF!' })).toBe('#REF!')
    expect(formatValue(Infinity)).toBe('#NUM!')
  })
})

describe('custom functions', () => {
  it('merges over the built-ins and is case insensitive', () => {
    const ctx = ctxOf([])
    ctx.functions = withCustomFunctions({ double: (a) => Number(a.flat[0]) * 2 })
    expect(evaluate(parseFormula('=DOUBLE(21)'), ctx)).toBe(42)
  })
})
