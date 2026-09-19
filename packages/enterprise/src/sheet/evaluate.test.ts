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

  it('INDEX reads a one-row range by column when given one number', () => {
    const cells = [['Base', 'Growth', 'Downturn'], [1, 2, 3]]
    expect(run('=INDEX(A1:C1,2)', cells)).toBe('Growth')
    expect(run('=INDEX(A1:A2,2)', cells)).toBe(1)
    expect(run('=INDEX(A1:C2,2,3)', cells)).toBe(3)
  })

  it('expands a name that resolves to a range inside a function', () => {
    const ctx = ctxOf([[1], [2], [3]])
    ctx.resolveNameNode = (n) => (n === 'Nums' ? parseFormula('=A1:A3') : null)
    expect(evaluate(parseFormula('=SUM(Nums)'), ctx)).toBe(6)
    expect(evaluate(parseFormula('=MAX(Nums)'), ctx)).toBe(3)
    // Scalar position collapses to the top-left cell, as a range does.
    expect(evaluate(parseFormula('=Nums+1'), ctx)).toBe(2)
    // resolveName still answers when the node resolver does not know a name.
    ctx.resolveName = (n) => (n === 'Tax' ? 0.2 : undefined)
    expect(evaluate(parseFormula('=Tax*10'), ctx)).toBe(2)
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

  it('formats with TEXT through the same grammar a cell format speaks', () => {
    expect(run('=TEXT(1234.5, "0.00")')).toBe('1234.50')
    expect(run('=TEXT(1234.5, "#,##0.00")')).toBe('1,234.50')
    // It used to read the decimals and the comma out of the pattern and
    // ignore everything else, so a date, a fraction, a duration or a
    // currency came back as the bare number.
    expect(run('=TEXT(46275.625, "h:mm AM/PM")')).toBe('3:00 PM')
    expect(run('=TEXT(46275, "yyyy-mm-dd")')).toBe('2026-09-10')
    expect(run('=TEXT(1.25, "# ?/?")')).toBe('1 1/4')
    expect(run('=TEXT(0.5, "[h]:mm")')).toBe('12:00')
    expect(run('=TEXT(12345, "##0.0E+0")')).toBe('12.3E+3')
    expect(run('=TEXT(-1234.5, "$#,##0.00;($#,##0.00)")')).toBe('($1,234.50)')
    expect(run('=TEXT(0.125, "0.0%")')).toBe('12.5%')
    // A colour in the pattern is ignored here, as Excel ignores it, and an
    // empty pattern is an empty string.
    expect(run('=TEXT(-5, "[Red]0.0")')).toBe('-5.0')
    expect(run('=TEXT(5, "")')).toBe('')
  })

  it('answers NA() with the error a lookup writes, and POWER with #NUM! rather than nothing', () => {
    expect(run('=NA()')).toEqual({ error: '#N/A' })
    expect(run('=IFNA(NA(), "none")')).toBe('none')
    expect(run('=POWER(-8, 1/3)')).toEqual({ error: '#NUM!' })
    expect(run('=POWER(2, 10)')).toBe(1024)
  })

  it('does the date functions', () => {
    expect(run('=YEAR("2026-09-14")')).toBe(2026)
    expect(run('=MONTH("2026-09-14")')).toBe(9)
    expect(run('=DAY("2026-09-14")')).toBe(14)
    expect(run('=DATE(2026, 9, 14)')).toBe('2026-09-14')
    expect(run('=EOMONTH("2026-01-15", 0)')).toBe('2026-01-31')
    expect(run('=EOMONTH("2026-01-15", 1)')).toBe('2026-02-28')
    expect(run('=DAYS("2026-09-19", "2026-09-15")')).toBe(4)
    expect(run('=DAYS("2026-09-12", "2026-09-15")')).toBe(-3)
    expect(run('=DATEDIF("2026-09-15", "2026-09-19", "d")')).toBe(4)
    expect(run('=DATEDIF("2026-01-31", "2026-03-30", "m")')).toBe(1)
    expect(run('=DATEDIF("2024-02-29", "2026-02-28", "y")')).toBe(1)
    expect(run('=DATEDIF("2026-09-19", "2026-09-15", "d")')).toEqual({ error: '#NUM!' })
  })

  it('does the lookups', () => {
    const table: CellValue[][] = [['a', 10], ['b', 20], ['c', 30]]
    expect(run('=VLOOKUP("b", A1:B3, 2)', table)).toBe(20)
    // Past the end of a sorted table the default IS the approximate match,
    // so Excel answers with the last row rather than #N/A. Only the explicit
    // FALSE asks for an exact match.
    expect(run('=VLOOKUP("z", A1:B3, 2)', table)).toBe(30)
    expect(run('=VLOOKUP("z", A1:B3, 2, FALSE)', table)).toEqual({ error: '#N/A' })
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

  // A QA pass read these against Excel. The lookup family's approximate match
  // is the DEFAULT, and a tier table is the reason it exists: without it every
  // grade, tax band and commission table answers #N/A.
  it('matches approximately by default, which is how tier tables work', () => {
    const tiers: CellValue[][] = [[0, 'F'], [60, 'D'], [70, 'C'], [80, 'B'], [90, 'A']]
    expect(run('=VLOOKUP(87, A1:B5, 2)', tiers)).toBe('B')
    expect(run('=VLOOKUP(87, A1:B5, 2, TRUE)', tiers)).toBe('B')
    expect(run('=VLOOKUP(90, A1:B5, 2)', tiers)).toBe('A')
    // An exact hit still wins, and range_lookup FALSE keeps the strict read.
    expect(run('=VLOOKUP(87, A1:B5, 2, FALSE)', tiers)).toEqual({ error: '#N/A' })
    // Below the first band there is nothing to fall back to.
    expect(run('=VLOOKUP(-5, A1:B5, 2)', tiers)).toEqual({ error: '#N/A' })
    // The header above the numbers is text, so it never becomes the answer.
    const headed: CellValue[][] = [['Score', 'Grade'], [0, 'F'], [80, 'B']]
    expect(run('=VLOOKUP(85, A1:B3, 2)', headed)).toBe('B')
  })

  it('takes range_lookup on HLOOKUP too', () => {
    const table: CellValue[][] = [[0, 60, 80], ['F', 'D', 'B']]
    expect(run('=HLOOKUP(87, A1:C2, 2)', table)).toBe('B')
    expect(run('=HLOOKUP(87, A1:C2, 2, FALSE)', table)).toEqual({ error: '#N/A' })
  })

  it('takes XLOOKUP match and search modes', () => {
    const tiers: CellValue[][] = [[0, 'F'], [60, 'D'], [70, 'C'], [80, 'B'], [90, 'A']]
    // 0 (the default) is exact; -1 falls back to the next smaller item, 1 to
    // the next larger one.
    expect(run('=XLOOKUP(87, A1:A5, B1:B5, "none")', tiers)).toBe('none')
    expect(run('=XLOOKUP(87, A1:A5, B1:B5, "none", -1)', tiers)).toBe('B')
    expect(run('=XLOOKUP(87, A1:A5, B1:B5, "none", 1)', tiers)).toBe('A')
    // A negative search mode reads from the end, so it finds the LAST match.
    const dupes: CellValue[][] = [['a', 1], ['b', 2], ['a', 3]]
    expect(run('=XLOOKUP("a", A1:A3, B1:B3)', dupes)).toBe(1)
    expect(run('=XLOOKUP("a", A1:A3, B1:B3, , 0, -1)', dupes)).toBe(3)
  })

  it('reads MATCH -1 down a descending range', () => {
    const down: CellValue[][] = [[90], [80], [70], [60]]
    expect(run('=MATCH(75, A1:A4, -1)', down)).toBe(2)
    expect(run('=MATCH(95, A1:A4, -1)', down)).toEqual({ error: '#N/A' })
  })

  it('returns #NAME? for a function it does not have', () => {
    expect(run('=NOSUCHFN(1)')).toEqual({ error: '#NAME?' })
  })

  it('propagates an error out of a range into an aggregate', () => {
    expect(run('=SUM(A1:A2)', [[1], [{ error: '#REF!' }]])).toEqual({ error: '#REF!' })
  })
})

describe('the information functions', () => {
  it('answer what a value is, not what it coerces to', () => {
    expect(run('=ISNUMBER(A1)', [[12]])).toBe(true)
    expect(run('=ISNUMBER(A1)', [['12']])).toBe(false)
    expect(run('=ISTEXT(A1)', [['12']])).toBe(true)
    expect(run('=ISTEXT(A1)', [['']])).toBe(false)
    expect(run('=ISBLANK(A1)', [['']])).toBe(true)
    expect(run('=ISBLANK(A1)', [[0]])).toBe(false)
    expect(run('=ISLOGICAL(1=1)')).toBe(true)
    expect(run('=ISLOGICAL(1)')).toBe(false)
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
