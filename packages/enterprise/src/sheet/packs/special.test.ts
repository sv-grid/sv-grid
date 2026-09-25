import { describe, expect, it } from 'vitest'
import {
  lgamma, gammaFn, gammaP, gammaQ, betaI, erf, erfc, normalCdf, normalPdf, invertCdf,
} from './special'

/**
 * The distributions are only as good as these five routines, so they are
 * checked on their own against closed forms rather than only through the
 * functions that call them.
 */
describe('gamma', () => {
  it('is the factorial at the integers', () => {
    expect(gammaFn(1)).toBeCloseTo(1, 10)
    expect(gammaFn(5)).toBeCloseTo(24, 9)
    expect(gammaFn(8)).toBeCloseTo(5040, 8)
    expect(lgamma(10)).toBeCloseTo(Math.log(362880), 10)
  })

  it('is the square root of pi at one half', () => {
    expect(gammaFn(0.5)).toBeCloseTo(Math.sqrt(Math.PI), 12)
    // The duplication that follows from gamma(x + 1) = x gamma(x).
    expect(gammaFn(1.5)).toBeCloseTo(Math.sqrt(Math.PI) / 2, 12)
  })

  it('reflects across the negative half plane', () => {
    // gamma(x) gamma(1 - x) = pi / sin(pi x)
    for (const x of [0.25, 0.4, -0.3, -1.7]) {
      expect(gammaFn(x) * gammaFn(1 - x)).toBeCloseTo(Math.PI / Math.sin(Math.PI * x), 8)
    }
  })
})

describe('the incomplete integrals', () => {
  it('the two incomplete gammas partition one', () => {
    for (const [a, x] of [[1, 1], [3, 2], [0.5, 4], [12, 3], [2, 9]]) {
      expect(gammaP(a!, x!) + gammaQ(a!, x!)).toBeCloseTo(1, 13)
    }
  })

  it('the incomplete gamma has a closed form at a = 1', () => {
    // P(1, x) is 1 - exp(-x).
    for (const x of [0.5, 1, 3, 7]) {
      expect(gammaP(1, x)).toBeCloseTo(1 - Math.exp(-x), 12)
    }
  })

  it('the incomplete beta has closed forms to check against', () => {
    // I_x(1, 1) is x; I_x(a, b) = 1 - I_(1-x)(b, a).
    expect(betaI(1, 1, 0.37)).toBeCloseTo(0.37, 12)
    expect(betaI(2, 3, 0.5)).toBeCloseTo(0.6875, 10)
    expect(betaI(0.5, 0.5, 0.5)).toBeCloseTo(0.5, 12)
    for (const [a, b, x] of [[2, 5, 0.3], [7, 2, 0.8], [0.5, 3, 0.1]]) {
      expect(betaI(a!, b!, x!)).toBeCloseTo(1 - betaI(b!, a!, 1 - x!), 12)
    }
  })

  it('saturates at the ends', () => {
    expect(betaI(2, 3, 0)).toBe(0)
    expect(betaI(2, 3, 1)).toBe(1)
    expect(gammaP(2, 0)).toBe(0)
    expect(gammaQ(2, 0)).toBe(1)
  })
})

describe('the error function', () => {
  it('matches its published values', () => {
    expect(erf(0)).toBeCloseTo(0, 15)
    expect(erf(1)).toBeCloseTo(0.8427007929, 9)
    expect(erf(2)).toBeCloseTo(0.9953222650, 9)
    expect(erfc(1)).toBeCloseTo(0.1572992071, 9)
  })

  it('is odd, and pairs with its complement', () => {
    for (const x of [0.3, 1.1, 2.5]) {
      expect(erf(-x)).toBeCloseTo(-erf(x), 12)
      expect(erf(x) + erfc(x)).toBeCloseTo(1, 12)
    }
  })

  it('stays accurate in the far tail, where a subtraction would cancel', () => {
    // 1 - erf(6) would round to zero in a double; erfc carries it.
    expect(erfc(6)).toBeGreaterThan(0)
    expect(erfc(6)).toBeCloseTo(2.1519736712e-17, 25)
  })
})

describe('the standard normal', () => {
  it('matches the table', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 12)
    expect(normalCdf(1.96)).toBeCloseTo(0.9750021049, 9)
    expect(normalCdf(-1.645)).toBeCloseTo(0.0499849055, 9)
    expect(normalPdf(0)).toBeCloseTo(1 / Math.sqrt(2 * Math.PI), 12)
  })

  it('is symmetric', () => {
    for (const z of [0.4, 1.2, 2.8]) {
      expect(normalCdf(z) + normalCdf(-z)).toBeCloseTo(1, 12)
      expect(normalPdf(z)).toBeCloseTo(normalPdf(-z), 15)
    }
  })
})

describe('inverting a cumulative', () => {
  it('finds the value the cumulative maps back to', () => {
    expect(invertCdf(normalCdf, 0.975, -1, 1)).toBeCloseTo(1.9599639845, 8)
    expect(invertCdf(normalCdf, 0.5, -1, 1)).toBeCloseTo(0, 10)
    expect(invertCdf(normalCdf, 0.025, -1, 1)).toBeCloseTo(-1.9599639845, 8)
  })

  it('widens a bracket that does not hold the answer', () => {
    // The bracket given is nowhere near the 0.999 quantile.
    expect(invertCdf(normalCdf, 0.999, -0.1, 0.1)).toBeCloseTo(3.0902323062, 7)
  })
})
