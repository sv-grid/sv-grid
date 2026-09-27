import { describe, expect, it } from 'vitest'
import { parseFormula } from '../parse'
import { evaluate, type EvalContext } from '../evaluate'
import { withCustomFunctions } from '../functions'
import type { CellValue } from '../ast'

/**
 * Two kinds of assertion here, on purpose.
 *
 * The first is Excel's own printed example values, which is what catches a
 * formula that is subtly not Excel's. The second is the identities that
 * hold for any correct distribution: a cumulative and its inverse undo one
 * another, a density integrates to its cumulative, a left tail and a right
 * tail sum to one, and a discrete distribution's masses sum to one. Those
 * catch the errors a table of remembered constants cannot, because they
 * are true whatever the constants are.
 *
 * The columns the array functions read:
 *   A  4 5 6 7 5 4 3          B  4 5 8 7 11 4 3
 *   C  3 4 5 2 3 4 5 6 4 7    D  3 2 4 5 6       E  9 7 12 15 17
 *   F  9 7 5 3 1              G  10 6 1 5 3
 *   H  2 3 9 1 8 7 5          I  6 5 11 7 5 4 4
 *   J  4 5 6 7 2 3 4 5 1 2 3
 *   K  10 20 30               L  15 20 25
 *   M  0.1 0.2 0.3 0.2 0.2    (masses for PROB, summing to one)
 */
const CELLS: CellValue[][] = [
  [4, 4, 3, 3, 9, 9, 10, 2, 6, 4, 10, 15, 0.1],
  [5, 5, 4, 2, 7, 7, 6, 3, 5, 5, 20, 20, 0.2],
  [6, 8, 5, 4, 12, 5, 1, 9, 11, 6, 30, 25, 0.3],
  [7, 7, 2, 5, 15, 3, 5, 1, 7, 7, '', '', 0.2],
  [5, 11, 3, 6, 17, 1, 3, 8, 5, 2, '', '', 0.2],
  [4, 4, 4, '', '', '', '', 7, 4, 3],
  [3, 3, 5, '', '', '', '', 5, 4, 4],
  ['', '', 6, '', '', '', '', '', '', 5],
  ['', '', 4, '', '', '', '', '', '', 1],
  ['', '', 7, '', '', '', '', '', '', 2],
  ['', '', '', '', '', '', '', '', '', 3],
]

function ctx(): EvalContext {
  return {
    resolve: (_s, r, c) => CELLS[r]?.[c] ?? '',
    lastRow: () => CELLS.length - 1,
    functions: withCustomFunctions(undefined),
  }
}

const run = (src: string): CellValue => evaluate(parseFormula(src), ctx())
const near = (src: string, expected: number, digits = 6) =>
  expect(run(src)).toBeCloseTo(expected, digits)

describe('the normal family', () => {
  it('matches Excel', () => {
    near('=NORM.DIST(42, 40, 1.5, TRUE)', 0.9087888, 6)
    near('=NORM.DIST(42, 40, 1.5, FALSE)', 0.1093400, 6)
    near('=NORM.S.DIST(1.3333333, TRUE)', 0.9087888, 6)
    near('=STANDARDIZE(42, 40, 1.5)', 1.3333333, 6)
    near('=NORMSDIST(0)', 0.5, 10)
  })

  it('the inverse undoes the cumulative', () => {
    near('=NORM.INV(NORM.DIST(42, 40, 1.5, TRUE), 40, 1.5)', 42, 8)
    near('=NORM.S.INV(NORM.S.DIST(1.75, TRUE))', 1.75, 8)
    near('=NORM.S.INV(0.975)', 1.9599640, 6)
  })

  it('is symmetric about its mean', () => {
    near('=NORM.S.DIST(1.2, TRUE) + NORM.S.DIST(-1.2, TRUE)', 1, 12)
    near('=GAUSS(1.96)', 0.4750021, 6)
    near('=PHI(0)', 0.3989423, 6)
  })

  it('refuses a standard deviation of zero or less', () => {
    expect(run('=NORM.DIST(1, 0, 0, TRUE)')).toEqual({ error: '#NUM!' })
    expect(run('=NORM.INV(1.5, 0, 1)')).toEqual({ error: '#NUM!' })
    expect(run('=STANDARDIZE(1, 0, -1)')).toEqual({ error: '#NUM!' })
  })

  it('FISHER round-trips through FISHERINV', () => {
    near('=FISHER(0.75)', 0.9729551, 6)
    near('=FISHERINV(FISHER(0.62))', 0.62, 10)
  })
})

describe('the t family', () => {
  it('matches Excel', () => {
    near('=T.DIST(60, 1, TRUE)', 0.9946953, 6)
    near('=T.DIST.2T(1.959998, 60)', 0.0546449, 6)
    near('=T.INV.2T(0.546449, 60)', 0.6065326, 5)
  })

  it('the two tails and the left tail agree with one another', () => {
    // T.DIST.RT is one minus T.DIST, and T.DIST.2T is twice the right tail.
    near('=T.DIST(1.5, 8, TRUE) + T.DIST.RT(1.5, 8)', 1, 12)
    near('=T.DIST.2T(1.5, 8) - 2 * T.DIST.RT(1.5, 8)', 0, 12)
    // The legacy TDIST with one tail is T.DIST.RT.
    near('=TDIST(1.5, 8, 1) - T.DIST.RT(1.5, 8)', 0, 12)
    near('=TDIST(1.5, 8, 2) - T.DIST.2T(1.5, 8)', 0, 12)
  })

  it('TINV is the TWO-tailed inverse, unlike T.INV', () => {
    near('=TINV(0.05, 10) - T.INV.2T(0.05, 10)', 0, 10)
    near('=T.INV(0.75, 2)', 0.8164966, 6)
    // The left-tailed inverse undoes the left-tailed cumulative.
    near('=T.INV(T.DIST(1.1, 7, TRUE), 7)', 1.1, 7)
  })

  it('is symmetric about zero', () => {
    near('=T.DIST(1.3, 5, TRUE) + T.DIST(-1.3, 5, TRUE)', 1, 12)
  })

  it('refuses degrees of freedom below one', () => {
    expect(run('=T.DIST(1, 0, TRUE)')).toEqual({ error: '#NUM!' })
    expect(run('=T.DIST.2T(-1, 5)')).toEqual({ error: '#NUM!' })
  })
})

describe('the chi-squared family', () => {
  it('matches Excel', () => {
    near('=CHISQ.DIST(0.5, 1, TRUE)', 0.5204999, 6)
    near('=CHISQ.DIST.RT(18.307, 10)', 0.0500006, 6)
    near('=CHISQ.INV.RT(0.050001, 10)', 18.3069734, 4)
  })

  it('CHIDIST is the RIGHT tail while CHISQ.DIST is the left', () => {
    near('=CHIDIST(3, 4) + CHISQ.DIST(3, 4, TRUE)', 1, 12)
    near('=CHIDIST(3, 4) - CHISQ.DIST.RT(3, 4)', 0, 12)
    near('=CHIINV(0.3, 4) - CHISQ.INV.RT(0.3, 4)', 0, 8)
  })

  it('has a closed form at two degrees of freedom to check against', () => {
    // With df = 2 the cumulative is exactly 1 - exp(-x / 2).
    near('=CHISQ.DIST(3, 2, TRUE)', 1 - Math.exp(-1.5), 10)
    near('=CHISQ.INV(0.5, 2)', -2 * Math.log(0.5), 8)
  })

  it('refuses a negative x or too few degrees of freedom', () => {
    expect(run('=CHISQ.DIST(-1, 2, TRUE)')).toEqual({ error: '#NUM!' })
    expect(run('=CHISQ.DIST(1, 0, TRUE)')).toEqual({ error: '#NUM!' })
  })
})

describe('the F family', () => {
  it('matches Excel', () => {
    near('=F.DIST(15.2069, 6, 4, TRUE)', 0.99, 5)
    near('=F.DIST.RT(15.2069, 6, 4)', 0.01, 5)
    near('=F.INV.RT(0.01, 6, 4)', 15.2068632, 4)
  })

  it('FDIST is right-tailed while F.DIST is left', () => {
    near('=FDIST(2, 6, 4) + F.DIST(2, 6, 4, TRUE)', 1, 12)
    near('=FINV(0.25, 6, 4) - F.INV.RT(0.25, 6, 4)', 0, 8)
    near('=F.INV(F.DIST(2.5, 5, 7, TRUE), 5, 7)', 2.5, 6)
  })

  it('refuses a negative x or too few degrees of freedom', () => {
    expect(run('=F.DIST(-1, 2, 2, TRUE)')).toEqual({ error: '#NUM!' })
    expect(run('=F.DIST(1, 0, 2, TRUE)')).toEqual({ error: '#NUM!' })
  })
})

describe('the discrete distributions', () => {
  it('matches Excel', () => {
    near('=BINOM.DIST(6, 10, 0.5, FALSE)', 0.2050781, 7)
    near('=BINOM.DIST(6, 10, 0.5, TRUE)', 0.828125, 7)
    near('=POISSON.DIST(2, 5, FALSE)', 0.0842243, 7)
    near('=POISSON.DIST(2, 5, TRUE)', 0.1246520, 7)
    // One white ball in a sample of four, from eight in twenty:
    // C(8,1) C(12,3) / C(20,4), which is 1760 / 4845 exactly.
    near('=HYPGEOM.DIST(1, 4, 8, 20, FALSE)', 1760 / 4845, 10)
  })

  it('the masses sum to one', () => {
    // Every outcome of ten coin flips.
    const total = Array.from({ length: 11 }, (_, k) =>
      run(`=BINOM.DIST(${k}, 10, 0.5, FALSE)`) as number).reduce((x, y) => x + y, 0)
    expect(total).toBeCloseTo(1, 12)
    // The cumulative at the last outcome is the same one.
    near('=BINOM.DIST(10, 10, 0.5, TRUE)', 1, 12)
  })

  it('the Poisson cumulative is the sum of its masses', () => {
    const total = Array.from({ length: 4 }, (_, k) =>
      run(`=POISSON.DIST(${k}, 5, FALSE)`) as number).reduce((x, y) => x + y, 0)
    near('=POISSON.DIST(3, 5, TRUE)', total, 10)
  })

  it('BINOM.INV is the first outcome to reach the criterion', () => {
    expect(run('=BINOM.INV(6, 0.5, 0.75)')).toBe(4)
    expect(run('=CRITBINOM(6, 0.5, 0.75)')).toBe(4)
  })

  it('refuses impossible parameters', () => {
    expect(run('=BINOM.DIST(11, 10, 0.5, TRUE)')).toEqual({ error: '#NUM!' })
    expect(run('=BINOM.DIST(1, 10, 1.5, TRUE)')).toEqual({ error: '#NUM!' })
    expect(run('=POISSON.DIST(-1, 5, TRUE)')).toEqual({ error: '#NUM!' })
  })
})

describe('the remaining continuous distributions', () => {
  it('matches Excel', () => {
    near('=EXPON.DIST(0.2, 10, TRUE)', 0.8646647, 6)
    near('=EXPON.DIST(0.2, 10, FALSE)', 1.3533528, 6)
    near('=WEIBULL.DIST(105, 20, 100, TRUE)', 0.9295814, 6)
    near('=WEIBULL.DIST(105, 20, 100, FALSE)', 0.0355885, 6)
    near('=LOGNORM.DIST(4, 3.5, 1.2, TRUE)', 0.0390836, 6)
    near('=BETA.DIST(2, 8, 10, TRUE, 1, 3)', 0.6854706, 6)
  })

  it('gamma and its logarithm match Excel', () => {
    near('=GAMMALN(4)', Math.log(6), 10)
    near('=GAMMA(2.5)', 1.3293404, 6)
    // Gamma of an integer is the factorial one below it.
    near('=GAMMA(6)', 120, 8)
    expect(run('=GAMMA(0)')).toEqual({ error: '#NUM!' })
    expect(run('=GAMMALN(0)')).toEqual({ error: '#NUM!' })
  })

  it('the inverses undo the cumulatives', () => {
    near('=LOGNORM.INV(LOGNORM.DIST(4, 3.5, 1.2, TRUE), 3.5, 1.2)', 4, 6)
    near('=GAMMA.INV(GAMMA.DIST(7, 9, 2, TRUE), 9, 2)', 7, 6)
    near('=BETA.INV(BETA.DIST(2, 8, 10, TRUE, 1, 3), 8, 10, 1, 3)', 2, 6)
  })

  it('the exponential has a closed form to check against', () => {
    near('=EXPON.DIST(0.5, 3, TRUE)', 1 - Math.exp(-1.5), 12)
    near('=EXPON.DIST(0.5, 3, FALSE)', 3 * Math.exp(-1.5), 12)
  })

  it('the legacy names agree with the new ones', () => {
    near('=EXPONDIST(0.2, 10, TRUE) - EXPON.DIST(0.2, 10, TRUE)', 0, 12)
    near('=WEIBULL(105, 20, 100, TRUE) - WEIBULL.DIST(105, 20, 100, TRUE)', 0, 12)
    near('=GAMMADIST(7, 9, 2, TRUE) - GAMMA.DIST(7, 9, 2, TRUE)', 0, 12)
    near('=POISSON(2, 5, TRUE) - POISSON.DIST(2, 5, TRUE)', 0, 12)
  })
})

describe('confidence intervals', () => {
  it('matches Excel', () => {
    near('=CONFIDENCE.NORM(0.05, 2.5, 50)', 0.6929519, 6)
    near('=CONFIDENCE(0.05, 2.5, 50)', 0.6929519, 6)
  })

  it('the t interval is wider than the normal one at the same sample', () => {
    const t = run('=CONFIDENCE.T(0.05, 2.5, 50)') as number
    const z = run('=CONFIDENCE.NORM(0.05, 2.5, 50)') as number
    expect(t).toBeGreaterThan(z)
  })
})

describe('hypothesis tests', () => {
  it('CHISQ.TEST matches a hand-computed statistic', () => {
    // K against L: (10-15)^2/15 + 0 + (30-25)^2/25 = 8/3, on 2 degrees of
    // freedom, where the right tail is exp(-x / 2).
    near('=CHISQ.TEST(K1:K3, L1:L3)', Math.exp(-(8 / 3) / 2), 8)
    near('=CHITEST(K1:K3, L1:L3) - CHISQ.TEST(K1:K3, L1:L3)', 0, 12)
  })

  it('T.TEST agrees with the t distribution it is built on', () => {
    // A paired test on identical columns has a mean difference of zero.
    expect(run('=T.TEST(A1:A7, A1:A7, 2, 1)')).toEqual({ error: '#DIV/0!' })
    // Two tails is twice one tail, whichever type.
    for (const type of [1, 2, 3]) {
      const one = run(`=T.TEST(H1:H7, I1:I7, 1, ${type})`) as number
      const two = run(`=T.TEST(H1:H7, I1:I7, 2, ${type})`) as number
      expect(two).toBeCloseTo(2 * one, 12)
    }
  })

  it('F.TEST is one for two samples with the same variance', () => {
    near('=F.TEST(A1:A7, A1:A7)', 1, 10)
    expect(run('=FTEST(H1:H7, I1:I7)')).toBeCloseTo(run('=F.TEST(H1:H7, I1:I7)') as number, 12)
  })

  it('Z.TEST matches its own normal tail', () => {
    // With sigma given the statistic is exact, so the answer is the tail.
    // A1:A7 is 4 5 6 7 5 4 3, so the sample mean is 34 / 7.
    const z = (34 / 7 - 4) / (2 / Math.sqrt(7))
    near('=Z.TEST(A1:A7, 4, 2)', 1 - (run(`=NORM.S.DIST(${z}, TRUE)`) as number), 10)
  })

  it('refuses a bad tail count or test type', () => {
    expect(run('=T.TEST(H1:H7, I1:I7, 3, 1)')).toEqual({ error: '#NUM!' })
    expect(run('=T.TEST(H1:H7, I1:I7, 1, 4)')).toEqual({ error: '#NUM!' })
  })
})

describe('descriptive statistics', () => {
  it('matches Excel', () => {
    near('=AVEDEV(A1:A7)', 1.0204082, 6)
    near('=DEVSQ(B1:B7)', 48, 8)
    near('=SKEW(C1:C10)', 0.3595430, 6)
    near('=KURT(C1:C10)', -0.1517996, 5)
    near('=TRIMMEAN(J1:J11, 0.2)', 3.7777778, 6)
  })

  it('the *A family counts text as zero and a boolean as one', () => {
    near('=AVERAGEA(4, 5, TRUE)', 10 / 3, 10)
    near('=AVERAGEA(4, 5, "x")', 3, 10)
    // AVERAGE over the same arguments ignores both instead.
    near('=AVERAGE(4, 5)', 4.5, 10)
    expect(run('=MAXA(-1, "x")')).toBe(0)
    expect(run('=MINA(1, FALSE)')).toBe(0)
  })

  it('covariance, correlation and the regression error match Excel', () => {
    near('=COVARIANCE.P(D1:D5, E1:E5)', 5.2, 8)
    near('=COVAR(D1:D5, E1:E5)', 5.2, 8)
    near('=PEARSON(F1:F5, G1:G5)', 0.6993786, 6)
    near('=RSQ(F1:F5, G1:G5)', 0.6993786 ** 2, 6)
    near('=STEYX(H1:H7, I1:I7)', 3.3057180, 5)
  })

  it('the sample covariance is the population one scaled by n over n-1', () => {
    const p = run('=COVARIANCE.P(D1:D5, E1:E5)') as number
    near('=COVARIANCE.S(D1:D5, E1:E5)', (p * 5) / 4, 8)
  })

  it('PROB adds the masses between its limits', () => {
    near('=PROB(D1:D5, M1:M5, 3, 5)', 0.1 + 0.3 + 0.2, 10)
  })

  it('MULTINOMIAL and PERMUTATIONA match Excel', () => {
    expect(run('=MULTINOMIAL(2, 3, 4)')).toBe(1260)
    expect(run('=PERMUTATIONA(3, 2)')).toBe(9)
  })
})
