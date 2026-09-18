import { describe, expect, it } from 'vitest'
import { parseFormula } from '../parse'
import { evaluate, type EvalContext } from '../evaluate'
import { withCustomFunctions } from '../functions'
import { translateFormula } from '../refs'
import type { CellValue } from '../ast'

/**
 * The expected values below are the ones Excel's own documentation gives
 * for its examples, rounded as it rounds them, so a function that drifts
 * from Excel fails here rather than in a customer's model.
 */
function ctxOf(cells: CellValue[][]): EvalContext {
  return {
    resolve: (_s, r, c) => {
      if (r < 0 || r >= cells.length) return { error: '#REF!' }
      const row = cells[r]!
      if (c < 0 || c >= row.length) return { error: '#REF!' }
      return row[c] ?? ''
    },
    lastRow: () => Math.max(cells.length - 1, 0),
    functions: withCustomFunctions(undefined),
  }
}

const run = (src: string, cells: CellValue[][] = []) => evaluate(parseFormula(src), ctxOf(cells))
const near = (src: string, expected: number, digits = 2, cells: CellValue[][] = []) =>
  expect(run(src, cells)).toBeCloseTo(expected, digits)

describe('empty arguments', () => {
  it('reads a gap between commas as a blank argument', () => {
    expect(run('=PMT(0.1/12, 24, 2000, , 1)')).toBeCloseTo(-91.53, 2)
    expect(run('=CHOOSE(2, "a", , "c")')).toBe('')
  })

  it('re-serialises a gap as a gap', () => {
    expect(translateFormula('=PMT(A1,A2,A3,,1)', 1, 0)).toBe('=PMT(A2,A3,A4,,1)')
  })

  it('still refuses a formula that ends on nothing', () => {
    expect(() => parseFormula('=SUM(1,')).toThrow()
  })
})

describe('financial', () => {
  it('PMT: the monthly payment on a 30-year loan', () => {
    near('=PMT(0.05/12, 360, 200000)', -1073.64)
    near('=PMT(0.08/12, 10, 10000)', -1037.03)
    near('=PMT(0.08/12, 10, 10000, 0, 1)', -1030.16)
    expect(run('=PMT(0, 10, 1000)')).toBe(-100)
    expect(run('=PMT(0.05, 0, 1000)')).toEqual({ error: '#NUM!' })
  })

  it('FV and PV are inverses of PMT', () => {
    near('=FV(0.06/12, 120, -100)', 16387.93)
    near('=FV(0.06/12, 12, -100, -1000, 1)', 2301.40)
    near('=FV(0.11/12, 35, -2000, , 1)', 82846.25)
    near('=PV(0.08/12, 20*12, 500)', -59777.15)
    expect(run('=PV(0.05/12, 360, PMT(0.05/12, 360, 1000))', [])).toBeCloseTo(1000, 6)
    expect(run('=FV(0, 10, -100)')).toBe(1000)
  })

  it('NPER and RATE solve for the missing term', () => {
    near('=NPER(0.12/12, -100, -1000, 10000, 1)', 59.67)
    near('=NPER(0.01, -100, 1000)', 10.59)
    near('=RATE(48, -200, 8000)*12', 0.0924, 3)
    near('=RATE(360, -1073.64, 200000)*12', 0.05, 4)
    expect(run('=RATE(360, 100, 200000)')).toEqual({ error: '#NUM!' })
  })

  it('IPMT and PPMT split a payment and add up to it', () => {
    near('=IPMT(0.1/12, 1, 36, 8000)', -66.67)
    near('=IPMT(0.1, 3, 3, 8000)', -292.45)
    near('=PPMT(0.1/12, 1, 24, 2000)', -75.62)
    near('=PPMT(0.08, 10, 10, 200000)', -27598.05)
    const pmt = run('=PMT(0.06/12, 60, 15000)') as number
    const parts = (run('=IPMT(0.06/12, 17, 60, 15000)') as number) + (run('=PPMT(0.06/12, 17, 60, 15000)') as number)
    expect(parts).toBeCloseTo(pmt, 8)
    expect(run('=IPMT(0.1, 0, 3, 8000)')).toEqual({ error: '#NUM!' })
  })

  it('NPV discounts the first flow one period; IRR finds the rate', () => {
    near('=NPV(0.1, -10000, 3000, 4200, 6800)', 1188.44)
    near('=NPV(0.08, A1:A5) - 40000', 1922.06, 2, [[8000], [9200], [10000], [12000], [14500]])
    const flows: CellValue[][] = [[-70000], [12000], [15000], [18000], [21000], [26000]]
    near('=IRR(A1:A5)', -0.0212, 4, flows)
    near('=IRR(A1:A6)', 0.0866, 4, flows)
    near('=IRR(A1:A3, -0.1)', -0.4435, 4, flows)
    expect(run('=IRR(A1:A3)', [[100], [200], [300]])).toEqual({ error: '#NUM!' })
  })

  it('SLN', () => {
    expect(run('=SLN(30000, 7500, 10)')).toBe(2250)
  })
})

describe('math', () => {
  it('rounds to a multiple the way Excel does', () => {
    expect(run('=CEILING(2.5, 1)')).toBe(3)
    expect(run('=CEILING(-2.5, -2)')).toBe(-4)
    expect(run('=CEILING(-2.5, 2)')).toBe(-2)
    expect(run('=CEILING(1.5, 0.1)')).toBe(1.5)
    expect(run('=CEILING(0.234, 0.01)')).toBe(0.24)
    expect(run('=CEILING(2.5, -2)')).toEqual({ error: '#NUM!' })
    expect(run('=FLOOR(3.7, 2)')).toBe(2)
    expect(run('=FLOOR(-2.5, -2)')).toBe(-2)
    expect(run('=FLOOR(-2.5, 2)')).toBe(-4)
    expect(run('=FLOOR(0.234, 0.01)')).toBe(0.23)
    expect(run('=FLOOR(2.5, 0)')).toEqual({ error: '#DIV/0!' })
    expect(run('=CEILING.MATH(24.3, 5)')).toBe(25)
    expect(run('=CEILING.MATH(-5.5)')).toBe(-5)
    expect(run('=CEILING.MATH(-5.5, 2, -1)')).toBe(-6)
    expect(run('=FLOOR.MATH(24.3, 5)')).toBe(20)
    expect(run('=FLOOR.MATH(-5.5)')).toBe(-6)
    expect(run('=FLOOR.MATH(-5.5, 2, -1)')).toBe(-4)
    expect(run('=MROUND(10, 3)')).toBe(9)
    expect(run('=MROUND(-10, -3)')).toBe(-9)
    expect(run('=MROUND(1.3, 0.2)')).toBe(1.4)
    expect(run('=MROUND(5, -2)')).toEqual({ error: '#NUM!' })
    expect(run('=TRUNC(8.9)')).toBe(8)
    expect(run('=TRUNC(-8.9)')).toBe(-8)
    expect(run('=TRUNC(0.45)')).toBe(0)
    expect(run('=TRUNC(3.14159, 2)')).toBe(3.14)
  })

  it('logs, powers and integers', () => {
    expect(run('=LOG(10)')).toBe(1)
    expect(run('=LOG(8, 2)')).toBe(3)
    near('=LOG(86, 2.7182818)', 4.4543, 4)
    near('=LN(86)', 4.4543, 4)
    near('=EXP(1)', 2.71828183, 6)
    near('=PI()', 3.14159265, 6)
    expect(run('=LOG(-1)')).toEqual({ error: '#NUM!' })
    expect(run('=EVEN(1.5)')).toBe(2)
    expect(run('=EVEN(3)')).toBe(4)
    expect(run('=EVEN(2)')).toBe(2)
    expect(run('=EVEN(-1)')).toBe(-2)
    expect(run('=ODD(1.5)')).toBe(3)
    expect(run('=ODD(3)')).toBe(3)
    expect(run('=ODD(2)')).toBe(3)
    expect(run('=ODD(-1)')).toBe(-1)
    expect(run('=ODD(-2)')).toBe(-3)
    expect(run('=QUOTIENT(5, 2)')).toBe(2)
    expect(run('=QUOTIENT(4.5, 3.1)')).toBe(1)
    expect(run('=QUOTIENT(-10, 3)')).toBe(-3)
    expect(run('=GCD(24, 36)')).toBe(12)
    expect(run('=GCD(5, 0)')).toBe(5)
    expect(run('=LCM(24, 36)')).toBe(72)
    expect(run('=FACT(5)')).toBe(120)
    expect(run('=FACT(1.9)')).toBe(1)
    expect(run('=FACT(0)')).toBe(1)
    expect(run('=FACT(-1)')).toEqual({ error: '#NUM!' })
    expect(run('=SIGN(-3)')).toBe(-1)
    expect(run('=ISEVEN(-2.5)')).toBe(true)
    expect(run('=ISODD(3)')).toBe(true)
  })

  it('PRODUCT, SUMSQ and SUMPRODUCT', () => {
    expect(run('=PRODUCT(5, 15, 30)')).toBe(2250)
    expect(run('=SUMSQ(3, 4)')).toBe(25)
    const cells: CellValue[][] = [[3, 2], [4, 7], [8, 6], [6, 7], [1, 5], [9, 3]]
    expect(run('=SUMPRODUCT(A1:A6, B1:B6)', cells)).toBe(156)
    expect(run('=SUMPRODUCT(A1:A2, B1:B3)', cells)).toEqual({ error: '#VALUE!' })
    expect(run('=SUMPRODUCT(A1:A2, B1:B2)', [[3, 'x'], [4, 7]])).toBe(28)
  })

  it('RAND and RANDBETWEEN stay in range', () => {
    for (let i = 0; i < 20; i += 1) {
      const r = run('=RAND()') as number
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThan(1)
      const b = run('=RANDBETWEEN(-3, 3)') as number
      expect(Number.isInteger(b)).toBe(true)
      expect(b).toBeGreaterThanOrEqual(-3)
      expect(b).toBeLessThanOrEqual(3)
    }
    expect(run('=RANDBETWEEN(3, 1)')).toEqual({ error: '#NUM!' })
  })
})

describe('statistics', () => {
  const column = (...ns: number[]): CellValue[][] => ns.map((n) => [n])

  it('order statistics', () => {
    const cells = column(3, 5, 3, 5, 4, 4, 2, 4, 6, 7)
    expect(run('=LARGE(A1:A10, 3)', cells)).toBe(5)
    expect(run('=SMALL(A1:A10, 4)', cells)).toBe(4)
    expect(run('=LARGE(A1:A10, 11)', cells)).toEqual({ error: '#NUM!' })
    expect(run('=PERCENTILE(A1:A4, 0.3)', column(1, 2, 3, 4))).toBeCloseTo(1.9, 10)
    expect(run('=PERCENTILE.EXC(A1:A10, 0.25)', column(1, 2, 3, 4, 5, 6, 7, 8, 9, 10))).toBe(2.75)
    expect(run('=PERCENTILE.EXC(A1:A4, 0.1)', column(1, 2, 3, 4))).toEqual({ error: '#NUM!' })
    const q = column(1, 2, 4, 7, 8, 9, 10, 12)
    expect(run('=QUARTILE(A1:A8, 1)', q)).toBe(3.5)
    expect(run('=QUARTILE(A1:A8, 3)', q)).toBe(9.25)
    expect(run('=QUARTILE(A1:A8, 0)', q)).toBe(1)
    expect(run('=QUARTILE(A1:A8, 4)', q)).toBe(12)
    expect(run('=QUARTILE.EXC(A1:A8, 1)', q)).toBe(2.5)
    expect(run('=QUARTILE(A1:A8, 5)', q)).toEqual({ error: '#NUM!' })
  })

  it('variance and deviation, sample and population', () => {
    const cells = column(2, 4, 4, 4, 5, 5, 7, 9)
    expect(run('=VAR.P(A1:A8)', cells)).toBe(4)
    expect(run('=VARP(A1:A8)', cells)).toBe(4)
    expect(run('=STDEV.P(A1:A8)', cells)).toBe(2)
    expect(run('=VAR(A1:A8)', cells)).toBeCloseTo(4.5714, 4)
    expect(run('=VAR.S(A1:A8)', cells)).toBeCloseTo(4.5714, 4)
    expect(run('=STDEV.S(A1:A8)', cells)).toBeCloseTo(2.1381, 4)
    expect(run('=STDEV(A1:A8)', cells)).toBeCloseTo(2.1381, 4)
    expect(run('=VAR(1)')).toEqual({ error: '#DIV/0!' })
    expect(run('=VAR.P(1)')).toBe(0)
  })

  it('MODE and GEOMEAN', () => {
    expect(run('=MODE(A1:A6)', column(5.6, 4, 4, 3, 2, 4))).toBe(4)
    expect(run('=MODE(1, 2, 2, 3, 3)')).toBe(2)
    expect(run('=MODE(1, 2, 3)')).toEqual({ error: '#N/A' })
    expect(run('=MODE.SNGL(7, 7, 1)')).toBe(7)
    near('=GEOMEAN(4, 5, 8, 7, 11, 4, 3)', 5.476987, 5)
    expect(run('=GEOMEAN(4, -1)')).toEqual({ error: '#NUM!' })
  })

  it('the IFS aggregates share the SUMIFS grammar', () => {
    const cells: CellValue[][] = [
      ['East', 'A', 10],
      ['West', 'A', 20],
      ['East', 'B', 30],
      ['East', 'A', 40],
    ]
    expect(run('=AVERAGEIFS(C1:C4, A1:A4, "East")', cells)).toBeCloseTo(26.6667, 3)
    expect(run('=AVERAGEIFS(C1:C4, A1:A4, "East", B1:B4, "A")', cells)).toBe(25)
    expect(run('=AVERAGEIFS(C1:C4, A1:A4, "North")', cells)).toEqual({ error: '#DIV/0!' })
    expect(run('=MAXIFS(C1:C4, A1:A4, "East", C1:C4, "<40")', cells)).toBe(30)
    expect(run('=MINIFS(C1:C4, B1:B4, "A")', cells)).toBe(10)
    expect(run('=MAXIFS(C1:C4, A1:A4, "North")', cells)).toBe(0)
  })

  it('correlation and regression', () => {
    const cells: CellValue[][] = [[3, 9], [2, 7], [4, 12], [5, 15], [6, 17]]
    near('=CORREL(A1:A5, B1:B5)', 0.997054, 5, cells)
    const trend: CellValue[][] = [[6, 20], [7, 28], [9, 31], [15, 38], [21, 40]]
    near('=FORECAST(30, A1:A5, B1:B5)', 10.607253, 5, trend)
    near('=FORECAST.LINEAR(30, A1:A5, B1:B5)', 10.607253, 5, trend)
    const slope: CellValue[][] = [[2, 6], [3, 5], [9, 11], [1, 7], [8, 5], [7, 4], [5, 4]]
    near('=SLOPE(A1:A7, B1:B7)', 0.305556, 5, slope)
    near('=INTERCEPT(A1:A5, B1:B5)', 0.0483871, 5, [[2, 6], [3, 5], [9, 11], [1, 7], [8, 5]])
    expect(run('=SLOPE(A1:A2, B1:B3)', [[1, 2], [3, 4], [5, 6]])).toEqual({ error: '#N/A' })
    expect(run('=SLOPE(A1:A2, B1:B2)', [[1, 2], [3, 2]])).toEqual({ error: '#DIV/0!' })
    // A pair with text on one side is skipped, as Excel skips it: the line
    // through (6,2), (5,3) and (11,9) alone.
    near('=SLOPE(A1:A4, B1:B4)', 35 / 31, 6, [[2, 6], ['n/a', 5], [3, 5], [9, 11]] as CellValue[][])
  })
})

describe('text', () => {
  it('PROPER capitalises after anything that is not a letter', () => {
    expect(run('=PROPER("this is a TITLE")')).toBe('This Is A Title')
    expect(run('=PROPER("2-way street")')).toBe('2-Way Street')
    expect(run('=PROPER("76BudGet")')).toBe('76Budget')
  })

  it('REPT, REPLACE, EXACT, CLEAN', () => {
    expect(run('=REPT("*-", 3)')).toBe('*-*-*-')
    expect(run('=REPT("x", -1)')).toEqual({ error: '#VALUE!' })
    expect(run('=REPLACE("abcdefghijk", 6, 5, "*")')).toBe('abcde*k')
    expect(run('=REPLACE("2009", 3, 2, "10")')).toBe('2010')
    expect(run('=REPLACE("123456", 1, 3, "@")')).toBe('@456')
    expect(run('=EXACT("word", "word")')).toBe(true)
    expect(run('=EXACT("Word", "word")')).toBe(false)
    expect(run('=CLEAN("a" & CHAR(7) & "b")')).toBe('ab')
  })

  it('VALUE reads what a typed entry would', () => {
    expect(run('=VALUE("$1,000")')).toBe(1000)
    expect(run('=VALUE("12%")')).toBeCloseTo(0.12, 10)
    expect(run('=VALUE("16:48:00") - VALUE("12:00:00")')).toBeCloseTo(0.2, 10)
    expect(run('=VALUE("2008-08-22")')).toBe(39682)
    expect(run('=VALUE("abc")')).toEqual({ error: '#VALUE!' })
    expect(run('=VALUE(7)')).toBe(7)
  })

  it('CHAR, CODE, UNICHAR, UNICODE, T, N', () => {
    expect(run('=CHAR(65)')).toBe('A')
    expect(run('=CODE("A")')).toBe(65)
    expect(run('=CODE("")')).toEqual({ error: '#VALUE!' })
    expect(run('=CHAR(0)')).toEqual({ error: '#VALUE!' })
    expect(run('=UNICHAR(8364)')).toBe('€')
    expect(run('=UNICODE("€")')).toBe(8364)
    expect(run('=T("x")')).toBe('x')
    expect(run('=T(5)')).toBe('')
    expect(run('=N(5)')).toBe(5)
    expect(run('=N(TRUE)')).toBe(1)
    expect(run('=N("x")')).toBe(0)
    expect(run('=ISNONTEXT(5)')).toBe(true)
    expect(run('=ISNONTEXT("x")')).toBe(false)
  })
})

describe('date and time', () => {
  it('WEEKDAY in its return types', () => {
    expect(run('=WEEKDAY("2008-02-14")')).toBe(5)
    expect(run('=WEEKDAY("2008-02-14", 2)')).toBe(4)
    expect(run('=WEEKDAY("2008-02-14", 3)')).toBe(3)
    expect(run('=WEEKDAY("2008-02-14", 11)')).toBe(4)
    expect(run('=WEEKDAY("2008-02-14", 15)')).toBe(7)
    expect(run('=WEEKDAY("2008-02-14", 4)')).toEqual({ error: '#NUM!' })
    // A serial reads as a date too.
    expect(run('=WEEKDAY(39682)')).toBe(6)
  })

  it('EDATE clamps to the end of a shorter month', () => {
    expect(run('=EDATE("2011-01-15", 1)')).toBe('2011-02-15')
    expect(run('=EDATE("2011-01-15", -1)')).toBe('2010-12-15')
    expect(run('=EDATE("2011-01-31", 1)')).toBe('2011-02-28')
    expect(run('=EDATE("2012-01-31", 1)')).toBe('2012-02-29')
    expect(run('=EDATE("2011-11-15", 2)')).toBe('2012-01-15')
  })

  it('NETWORKDAYS and WORKDAY skip weekends and holidays', () => {
    expect(run('=NETWORKDAYS("2012-10-01", "2013-03-01")')).toBe(110)
    expect(run('=NETWORKDAYS("2012-10-01", "2013-03-01", "2012-11-22")')).toBe(109)
    const holidays: CellValue[][] = [['2012-11-22'], ['2012-12-04'], ['2013-01-21']]
    expect(run('=NETWORKDAYS("2012-10-01", "2013-03-01", A1:A3)', holidays)).toBe(107)
    expect(run('=NETWORKDAYS("2013-03-01", "2012-10-01")')).toBe(-110)
    expect(run('=WORKDAY("2008-10-01", 151)')).toBe('2009-04-30')
    const h2: CellValue[][] = [['2008-11-26'], ['2008-12-04'], ['2009-01-21']]
    expect(run('=WORKDAY("2008-10-01", 151, A1:A3)', h2)).toBe('2009-05-05')
    expect(run('=WORKDAY("2008-10-06", -1)')).toBe('2008-10-03')
    expect(run('=WORKDAY("2008-10-04", 0)')).toBe('2008-10-04')
  })

  it('WEEKNUM', () => {
    expect(run('=WEEKNUM("2012-03-09")')).toBe(10)
    expect(run('=WEEKNUM("2012-03-09", 2)')).toBe(11)
    expect(run('=WEEKNUM("2012-03-09", 21)')).toBe(10)
    expect(run('=WEEKNUM("2021-01-01", 21)')).toBe(53)
    expect(run('=WEEKNUM("2012-03-09", 5)')).toEqual({ error: '#NUM!' })
  })

  it('HOUR, MINUTE, SECOND, TIME, TIMEVALUE, DATEVALUE', () => {
    expect(run('=HOUR(0.75)')).toBe(18)
    expect(run('=HOUR("2011-07-18 07:45")')).toBe(7)
    expect(run('=HOUR("3:30:00 PM")')).toBe(15)
    expect(run('=MINUTE("12:45:00 PM")')).toBe(45)
    expect(run('=SECOND("4:48:18 PM")')).toBe(18)
    expect(run('=SECOND(0.75)')).toBe(0)
    expect(run('=TIME(12, 0, 0)')).toBe(0.5)
    expect(run('=TIME(16, 48, 10)')).toBeCloseTo(0.700115741, 8)
    expect(run('=TIME(25, 0, 0)')).toBeCloseTo(1 / 24, 10)
    expect(run('=TIME(-1, 0, 0)')).toEqual({ error: '#NUM!' })
    expect(run('=TIMEVALUE("2:24 AM")')).toBeCloseTo(0.1, 10)
    expect(run('=TIMEVALUE("22-Aug-2011 6:35 AM")')).toBeCloseTo(0.2743, 4)
    expect(run('=DATEVALUE("2008-08-22")')).toBe(39682)
    expect(run('=DATEVALUE(5)')).toEqual({ error: '#VALUE!' })
  })

  it('DAYS360 and YEARFRAC', () => {
    expect(run('=DAYS360("2011-01-30", "2011-02-01")')).toBe(1)
    expect(run('=DAYS360("2011-01-01", "2011-12-31")')).toBe(360)
    expect(run('=YEARFRAC("2012-01-01", "2012-07-30")')).toBeCloseTo(0.58055556, 6)
    expect(run('=YEARFRAC("2012-01-01", "2012-07-30", 1)')).toBeCloseTo(0.57650273, 6)
    expect(run('=YEARFRAC("2012-01-01", "2012-07-30", 3)')).toBeCloseTo(0.57808219, 6)
  })
})

describe('reference and information', () => {
  it('CHOOSE, ROWS, COLUMNS', () => {
    expect(run('=CHOOSE(2, "a", "b", "c")')).toBe('b')
    expect(run('=CHOOSE(4, "a", "b", "c")')).toEqual({ error: '#VALUE!' })
    const cells: CellValue[][] = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]]
    expect(run('=ROWS(A1:C4)', cells)).toBe(4)
    expect(run('=COLUMNS(A1:C4)', cells)).toBe(3)
    expect(run('=ROWS(A1)', cells)).toBe(1)
  })

  it('ISERROR, ISERR and ISNA see the error before it propagates', () => {
    expect(run('=ISERROR(1/0)')).toBe(true)
    expect(run('=ISERROR(1)')).toBe(false)
    expect(run('=ISERR(1/0)')).toBe(true)
    expect(run('=ISERR(MATCH(9, A1:A2, 0))', [[1], [2]])).toBe(false)
    expect(run('=ISNA(MATCH(9, A1:A2, 0))', [[1], [2]])).toBe(true)
    expect(run('=ISNA(1/0)')).toBe(false)
    expect(run('=IF(ISERROR(A1/B1), "n/a", A1/B1)', [[1, 0]])).toBe('n/a')
    expect(run('=ISERROR()')).toEqual({ error: '#VALUE!' })
  })
})

describe('NUMBERVALUE', () => {
  it('reads a number written the way another country writes one', () => {
    expect(run('=NUMBERVALUE("1.234,56", ",", ".")')).toBe(1234.56)
    expect(run('=NUMBERVALUE("2 500,75", ",", " ")')).toBe(2500.75)
    expect(run('=NUMBERVALUE("1,234.56")')).toBe(1234.56)
    expect(run('=NUMBERVALUE("-42")')).toBe(-42)
  })

  it('divides by a hundred for each trailing percent sign', () => {
    expect(run('=NUMBERVALUE("9%")')).toBe(0.09)
    expect(run('=NUMBERVALUE("9%%")')).toBeCloseTo(0.0009, 10)
  })

  it('is zero for empty text and an error for what is not a number', () => {
    expect(run('=NUMBERVALUE("")')).toBe(0)
    expect(run('=NUMBERVALUE("twelve")')).toEqual({ error: '#VALUE!' })
    // The same separator twice cannot be read either way.
    expect(run('=NUMBERVALUE("1.2", ".", ".")')).toEqual({ error: '#VALUE!' })
    // A thousands mark after the decimal point is a typo rather than a
    // number written another way, which is Excel's rule for it.
    expect(run('=NUMBERVALUE("1.5,5")')).toEqual({ error: '#VALUE!' })
    expect(run('=NUMBERVALUE("1,5.5", ",", ".")')).toEqual({ error: '#VALUE!' })
  })

  it('passes a number straight through', () => {
    expect(run('=NUMBERVALUE(1234.5)')).toBe(1234.5)
  })
})
