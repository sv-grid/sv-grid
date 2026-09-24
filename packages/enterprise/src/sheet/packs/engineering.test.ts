import { describe, expect, it } from 'vitest'
import { parseFormula } from '../parse'
import { evaluate, type EvalContext } from '../evaluate'
import { withCustomFunctions } from '../functions'
import type { CellValue } from '../ast'

function ctx(): EvalContext {
  return {
    resolve: () => ({ error: '#REF!' }),
    lastRow: () => 0,
    functions: withCustomFunctions(undefined),
  }
}

const run = (src: string): CellValue => evaluate(parseFormula(src), ctx())
const near = (src: string, expected: number, digits = 6) =>
  expect(run(src)).toBeCloseTo(expected, digits)

describe('base conversion', () => {
  it('converts a positive number and pads to places', () => {
    expect(run('=DEC2BIN(9)')).toBe('1001')
    expect(run('=DEC2BIN(9, 6)')).toBe('001001')
    expect(run('=DEC2OCT(58)')).toBe('72')
    expect(run('=DEC2HEX(100)')).toBe('64')
    expect(run('=DEC2HEX(255, 4)')).toBe('00FF')
  })

  it('writes a negative as ten-digit two’s complement, ignoring places', () => {
    expect(run('=DEC2BIN(-100)')).toBe('1110011100')
    expect(run('=DEC2BIN(-1)')).toBe('1111111111')
    // `places` has no say once the complement fills the width.
    expect(run('=DEC2BIN(-100, 4)')).toBe('1110011100')
    expect(run('=DEC2HEX(-54)')).toBe('FFFFFFFFCA')
    expect(run('=DEC2OCT(-100)')).toBe('7777777634')
  })

  it('reads the top bit of a full-width word as a sign', () => {
    expect(run('=BIN2DEC(1100100)')).toBe(100)
    expect(run('=BIN2DEC(1111111111)')).toBe(-1)
    // Nine digits is not a full word, so this one stays positive.
    expect(run('=BIN2DEC(111111111)')).toBe(511)
    expect(run('=HEX2DEC("FFFFFFFFFF")')).toBe(-1)
    expect(run('=HEX2DEC("A5")')).toBe(165)
    expect(run('=OCT2DEC(54)')).toBe(44)
  })

  it('goes between the non-decimal bases', () => {
    expect(run('=BIN2OCT(1100100)')).toBe('144')
    expect(run('=BIN2HEX(11111011, 4)')).toBe('00FB')
    expect(run('=OCT2BIN(3)')).toBe('11')
    expect(run('=OCT2HEX(100)')).toBe('40')
    expect(run('=HEX2BIN("F", 8)')).toBe('00001111')
    expect(run('=HEX2OCT("1F")')).toBe('37')
  })

  it('refuses what is out of range or not a digit of the base', () => {
    expect(run('=DEC2BIN(512)')).toEqual({ error: '#NUM!' })
    expect(run('=DEC2BIN(-513)')).toEqual({ error: '#NUM!' })
    // Too few places for the digits needed is an error, not a truncation.
    expect(run('=DEC2BIN(9, 2)')).toEqual({ error: '#NUM!' })
    expect(run('=BIN2DEC(2)')).toEqual({ error: '#NUM!' })
    expect(run('=HEX2DEC("XYZ")')).toEqual({ error: '#NUM!' })
    expect(run('=BIN2DEC(11111111111)')).toEqual({ error: '#NUM!' })
  })
})

describe('bitwise', () => {
  it('matches Excel', () => {
    expect(run('=BITAND(13, 25)')).toBe(9)
    expect(run('=BITOR(23, 10)')).toBe(31)
    expect(run('=BITXOR(5, 3)')).toBe(6)
    expect(run('=BITLSHIFT(4, 2)')).toBe(16)
    expect(run('=BITRSHIFT(13, 2)')).toBe(3)
  })

  it('works past what a 32-bit operator could hold', () => {
    // 2^40 fits in Excel's range and would be zero through a `<<`.
    expect(run('=BITLSHIFT(1, 40)')).toBe(1099511627776)
    expect(run('=BITAND(1099511627776, 1099511627776)')).toBe(1099511627776)
  })

  it('refuses a negative, a fraction or anything past 2^48', () => {
    expect(run('=BITAND(-1, 2)')).toEqual({ error: '#NUM!' })
    expect(run('=BITAND(1.5, 2)')).toEqual({ error: '#NUM!' })
    expect(run('=BITLSHIFT(1, 48)')).toEqual({ error: '#NUM!' })
  })
})

describe('step functions and error integrals', () => {
  it('DELTA and GESTEP match Excel', () => {
    expect(run('=DELTA(5, 4)')).toBe(0)
    expect(run('=DELTA(5, 5)')).toBe(1)
    expect(run('=DELTA(0)')).toBe(1)
    expect(run('=GESTEP(5, 4)')).toBe(1)
    expect(run('=GESTEP(-4, -5)')).toBe(1)
    expect(run('=GESTEP(-1)')).toBe(0)
  })

  it('ERF and ERFC match Excel', () => {
    near('=ERF(1)', 0.8427008, 6)
    near('=ERF(0.745)', 0.7079289, 6)
    near('=ERFC(1)', 0.1572992, 6)
    // Two arguments is the integral between the limits.
    near('=ERF(1, 2)', 0.9953223 - 0.8427008, 6)
    near('=ERF.PRECISE(1)', 0.8427008, 6)
    // The pair always sums to one.
    near('=ERF(0.3) + ERFC(0.3)', 1, 12)
  })
})

describe('CONVERT', () => {
  it('converts within a measure', () => {
    near('=CONVERT(1, "lbm", "kg")', 0.4535924, 6)
    near('=CONVERT(1, "day", "hr")', 24, 10)
    near('=CONVERT(1, "mi", "m")', 1609.344, 6)
    near('=CONVERT(2, "ft", "in")', 24, 8)
  })

  it('converts temperature, which shifts as well as scales', () => {
    near('=CONVERT(68, "F", "C")', 20, 10)
    near('=CONVERT(0, "C", "F")', 32, 10)
    near('=CONVERT(0, "C", "K")', 273.15, 10)
    near('=CONVERT(100, "C", "F")', 212, 10)
  })

  it('reads an SI prefix in front of a metric unit', () => {
    near('=CONVERT(1, "km", "m")', 1000, 8)
    near('=CONVERT(1, "m", "cm")', 100, 8)
    near('=CONVERT(2500, "g", "kg")', 2.5, 10)
  })

  it('refuses units from different measures', () => {
    expect(run('=CONVERT(2.5, "ft", "sec")')).toEqual({ error: '#N/A' })
    expect(run('=CONVERT(1, "kg", "C")')).toEqual({ error: '#N/A' })
    expect(run('=CONVERT(1, "zzz", "m")')).toEqual({ error: '#N/A' })
  })
})
