import { describe, expect, it } from 'vitest'
import { parseFormula } from '../parse'
import { evaluate, type EvalContext } from '../evaluate'
import { withCustomFunctions } from '../functions'
import type { CellValue } from '../ast'

/**
 * The expected values are the ones Excel's own function reference prints
 * for its examples, plus the identities that hold for any correct
 * implementation, so a drift from Excel fails here rather than in a model.
 */
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

describe('circular functions', () => {
  it('matches Excel at the landmarks', () => {
    near('=SIN(PI()/2)', 1, 12)
    near('=COS(0)', 1, 12)
    near('=TAN(0.785)', 0.99920, 5)
    near('=SIN(0)', 0, 12)
  })

  it('COT, SEC and CSC are the reciprocals Excel prints', () => {
    near('=COT(30)', -0.1561200, 6)
    near('=SEC(45)', 1.9035944, 6)
    near('=CSC(15)', 1.5377806, 6)
  })

  it('reports a pole as #DIV/0! rather than infinity', () => {
    expect(run('=COT(0)')).toEqual({ error: '#DIV/0!' })
    expect(run('=CSC(0)')).toEqual({ error: '#DIV/0!' })
    // SEC has no pole at zero: cos(0) is 1.
    near('=SEC(0)', 1, 12)
  })
})

describe('inverse circular functions', () => {
  it('matches Excel', () => {
    near('=ASIN(-0.5)', -0.5235988, 6)
    near('=ACOS(-0.5)', 2.0943951, 6)
    near('=ATAN(1)', 0.7853982, 6)
    near('=ACOT(2)', 0.4636476, 6)
  })

  it('ATAN2 takes x first, which is the opposite of the C order', () => {
    // Excel's own examples. Getting the order wrong flips the sign of the
    // second and leaves the first looking correct, which is the trap.
    near('=ATAN2(1, 1)', 0.7853982, 6)
    near('=ATAN2(-1, -1)', -2.3561945, 6)
    // The asymmetric case is the one that proves the order: with x = -1 and
    // y = 1 the angle is in the second quadrant, not the fourth.
    near('=ATAN2(-1, 1)', 2.3561945, 6)
    near('=ATAN2(1, -1)', -0.7853982, 6)
  })

  it('refuses an argument outside the domain', () => {
    expect(run('=ASIN(2)')).toEqual({ error: '#NUM!' })
    expect(run('=ACOS(-1.5)')).toEqual({ error: '#NUM!' })
    expect(run('=ATAN2(0, 0)')).toEqual({ error: '#DIV/0!' })
  })
})

describe('hyperbolic functions', () => {
  it('matches Excel', () => {
    near('=SINH(1)', 1.1752012, 6)
    near('=COSH(1)', 1.5430806, 6)
    near('=TANH(0.5)', 0.4621172, 6)
    near('=COTH(2)', 1.0373147, 6)
    near('=CSCH(1.5)', 0.4696424, 6)
    near('=SECH(0)', 1, 12)
  })

  it('inverts itself', () => {
    near('=ASINH(SINH(1.3))', 1.3, 10)
    near('=ACOSH(COSH(2.1))', 2.1, 10)
    near('=ATANH(TANH(0.4))', 0.4, 10)
    near('=ACOSH(1)', 0, 12)
    near('=ACOSH(10)', 2.9932228, 6)
    near('=ACOTH(6)', 0.1682361, 6)
  })

  it('refuses an argument outside the domain', () => {
    expect(run('=ACOSH(0.5)')).toEqual({ error: '#NUM!' })
    expect(run('=ATANH(1)')).toEqual({ error: '#NUM!' })
    expect(run('=ACOTH(0.5)')).toEqual({ error: '#NUM!' })
    expect(run('=COTH(0)')).toEqual({ error: '#DIV/0!' })
  })
})

describe('angle measure', () => {
  it('converts both ways and round-trips', () => {
    near('=DEGREES(PI())', 180, 10)
    near('=RADIANS(270)', 4.712389, 6)
    near('=DEGREES(RADIANS(37))', 37, 10)
  })

  it('SQRTPI matches Excel', () => {
    near('=SQRTPI(1)', 1.7724539, 6)
    near('=SQRTPI(2)', 2.5066283, 6)
    expect(run('=SQRTPI(-1)')).toEqual({ error: '#NUM!' })
  })
})
