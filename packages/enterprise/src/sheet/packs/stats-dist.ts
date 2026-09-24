/**
 * Excel's statistical distributions, their inverses, the hypothesis tests
 * built on them, and the descriptive measures that sit alongside.
 *
 * Every distribution here is the same two questions with different
 * parameters, so they share one shape: a density and a cumulative, with
 * `cumulative` picking between them, and an inverse found by bisecting the
 * cumulative (see `invertCdf` in `./special`).
 *
 * Excel renamed this whole family in 2010 and kept the old names working.
 * Both spellings are registered, and where the two disagree the comment
 * says so, because the disagreements are real and they are traps:
 *
 *   - `CHIDIST` is the RIGHT tail; `CHISQ.DIST` is the left. The old name
 *     is not the new one with a dot in it.
 *   - `TDIST` takes a tail COUNT (1 or 2) and refuses a negative x;
 *     `T.DIST` takes a boolean and accepts any x.
 *   - `FDIST` and `FINV` are right-tailed; `F.DIST` and `F.INV` are left.
 *   - `BETADIST` and `BETA.DIST` order their optional bounds the same, but
 *     `BETA.DIST` alone requires `cumulative`.
 *
 * Factorials and binomial coefficients go through `lgamma` rather than a
 * product, so `COMBIN`-sized arguments do not overflow to Infinity on the
 * way to a probability that is perfectly representable.
 */
import { err, type CellValue } from '../ast'
import { toNumber, toBool, numericOnly, isBlank } from '../coerce'
import type { FnArgs, SheetFunction } from '../functions'
import {
  lgamma, gammaFn, gammaP, gammaQ, betaI, normalCdf, normalPdf, invertCdf,
} from './special'

const nth = (a: FnArgs, i: number): CellValue => a.args[i]?.[0] ?? ''
const num = (a: FnArgs, i: number): number => toNumber(nth(a, i))
const flag = (a: FnArgs, i: number): boolean => toBool(nth(a, i))
const has = (a: FnArgs, i: number): boolean => {
  const v = a.args[i]?.[0]
  return v !== undefined && v !== ''
}
const opt = (a: FnArgs, i: number, fallback: number): number =>
  (has(a, i) ? num(a, i) : fallback)

/** log of n choose k, which stays finite where the value itself would not. */
const lchoose = (n: number, k: number): number =>
  lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1)

const choose = (n: number, k: number): number => Math.exp(lchoose(n, k))

// ---- Normal ------------------------------------------------------------

const normDist = (x: number, mean: number, sd: number, cumulative: boolean): CellValue => {
  if (sd <= 0) return err('#NUM!')
  const z = (x - mean) / sd
  return cumulative ? normalCdf(z) : normalPdf(z) / sd
}

const normInv = (p: number, mean: number, sd: number): CellValue => {
  if (sd <= 0 || p <= 0 || p >= 1) return err('#NUM!')
  return mean + sd * invertCdf(normalCdf, p, -8, 8)
}

// ---- Student t ---------------------------------------------------------

/** The left-tailed t cumulative, through the incomplete beta. */
function tCdf(x: number, df: number): number {
  const half = betaI(df / 2, 0.5, df / (df + x * x)) / 2
  return x > 0 ? 1 - half : half
}

function tPdf(x: number, df: number): number {
  return Math.exp(
    lgamma((df + 1) / 2) - lgamma(df / 2) - 0.5 * Math.log(df * Math.PI)
      - ((df + 1) / 2) * Math.log(1 + (x * x) / df),
  )
}

// ---- Chi-square --------------------------------------------------------

const chiCdf = (x: number, df: number): number => (x <= 0 ? 0 : gammaP(df / 2, x / 2))

function chiPdf(x: number, df: number): number {
  if (x < 0) return 0
  if (x === 0) return df === 2 ? 0.5 : 0
  return Math.exp((df / 2 - 1) * Math.log(x) - x / 2 - lgamma(df / 2) - (df / 2) * Math.LN2)
}

// ---- F -----------------------------------------------------------------

const fCdf = (x: number, d1: number, d2: number): number =>
  (x <= 0 ? 0 : betaI(d1 / 2, d2 / 2, (d1 * x) / (d1 * x + d2)))

function fPdf(x: number, d1: number, d2: number): number {
  if (x <= 0) return 0
  const logNum = (d1 / 2) * Math.log(d1 / d2) + (d1 / 2 - 1) * Math.log(x)
  const logDen = ((d1 + d2) / 2) * Math.log(1 + (d1 * x) / d2)
    + lgamma(d1 / 2) + lgamma(d2 / 2) - lgamma((d1 + d2) / 2)
  return Math.exp(logNum - logDen)
}

// ---- Discrete ----------------------------------------------------------

function binomPmf(k: number, n: number, p: number): number {
  if (p === 0) return k === 0 ? 1 : 0
  if (p === 1) return k === n ? 1 : 0
  return Math.exp(lchoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p))
}

function binomCdf(k: number, n: number, p: number): number {
  let total = 0
  for (let i = 0; i <= k; i += 1) total += binomPmf(i, n, p)
  return Math.min(total, 1)
}

const poissonPmf = (k: number, mean: number): number =>
  Math.exp(-mean + k * Math.log(mean) - lgamma(k + 1))

/** The Poisson cumulative is the upper incomplete gamma at k + 1. */
const poissonCdf = (k: number, mean: number): number =>
  (mean === 0 ? 1 : gammaQ(k + 1, mean))

function hypgeomPmf(x: number, n: number, m: number, N: number): number {
  return Math.exp(lchoose(m, x) + lchoose(N - m, n - x) - lchoose(N, n))
}

// ---- The *A variants, which read text and booleans as numbers ----------

/** AVERAGEA and friends count text as 0 and a boolean as 1 or 0. */
function valuesA(values: ReadonlyArray<CellValue>): number[] {
  const out: number[] = []
  for (const v of values) {
    if (isBlank(v)) continue
    if (typeof v === 'number') out.push(v)
    else if (typeof v === 'boolean') out.push(v ? 1 : 0)
    else if (typeof v === 'string') out.push(Number(v) || 0)
  }
  return out
}

function variance(values: number[], sample: boolean): CellValue {
  const n = values.length
  if (n < (sample ? 2 : 1)) return err('#DIV/0!')
  const mean = values.reduce((x, y) => x + y, 0) / n
  const ss = values.reduce((acc, v) => acc + (v - mean) ** 2, 0)
  return ss / (sample ? n - 1 : n)
}

const stdev = (values: number[], sample: boolean): CellValue => {
  const v = variance(values, sample)
  return typeof v === 'number' ? Math.sqrt(v) : v
}

const mean = (ns: number[]): number => ns.reduce((x, y) => x + y, 0) / ns.length

/** The (x, y) pairs where both sides are numbers. */
function pairs(ys: ReadonlyArray<CellValue>, xs: ReadonlyArray<CellValue>): Array<[number, number]> | null {
  if (ys.length !== xs.length) return null
  const out: Array<[number, number]> = []
  for (let i = 0; i < ys.length; i += 1) {
    const y = ys[i]
    const x = xs[i]
    if (typeof y === 'number' && typeof x === 'number') out.push([x, y])
  }
  return out
}

export const STATS_DIST_FUNCTIONS: Record<string, SheetFunction> = {
  // ---- Normal ----------------------------------------------------------
  'NORM.DIST': (a) => normDist(num(a, 0), num(a, 1), num(a, 2), flag(a, 3)),
  NORMDIST: (a) => normDist(num(a, 0), num(a, 1), num(a, 2), flag(a, 3)),
  'NORM.INV': (a) => normInv(num(a, 0), num(a, 1), num(a, 2)),
  NORMINV: (a) => normInv(num(a, 0), num(a, 1), num(a, 2)),
  'NORM.S.DIST': (a) => (has(a, 1) && !flag(a, 1) ? normalPdf(num(a, 0)) : normalCdf(num(a, 0))),
  // The legacy NORMSDIST is cumulative only and takes one argument.
  NORMSDIST: (a) => normalCdf(num(a, 0)),
  'NORM.S.INV': (a) => normInv(num(a, 0), 0, 1),
  NORMSINV: (a) => normInv(num(a, 0), 0, 1),
  STANDARDIZE: (a) => {
    const sd = num(a, 2)
    return sd <= 0 ? err('#NUM!') : (num(a, 0) - num(a, 1)) / sd
  },
  PHI: (a) => normalPdf(num(a, 0)),
  GAUSS: (a) => normalCdf(num(a, 0)) - 0.5,
  FISHER: (a) => {
    const x = num(a, 0)
    return x <= -1 || x >= 1 ? err('#NUM!') : 0.5 * Math.log((1 + x) / (1 - x))
  },
  FISHERINV: (a) => Math.tanh(num(a, 0)),

  // ---- Student t -------------------------------------------------------
  'T.DIST': (a) => {
    const df = Math.trunc(num(a, 1))
    if (df < 1) return err('#NUM!')
    return flag(a, 2) ? tCdf(num(a, 0), df) : tPdf(num(a, 0), df)
  },
  'T.DIST.RT': (a) => {
    const df = Math.trunc(num(a, 1))
    return df < 1 ? err('#NUM!') : 1 - tCdf(num(a, 0), df)
  },
  'T.DIST.2T': (a) => {
    const x = num(a, 0)
    const df = Math.trunc(num(a, 1))
    if (df < 1 || x < 0) return err('#NUM!')
    return 2 * (1 - tCdf(x, df))
  },
  // The legacy TDIST takes a tail count and refuses a negative x.
  TDIST: (a) => {
    const x = num(a, 0)
    const df = Math.trunc(num(a, 1))
    const tails = Math.trunc(num(a, 2))
    if (df < 1 || x < 0 || (tails !== 1 && tails !== 2)) return err('#NUM!')
    const right = 1 - tCdf(x, df)
    return tails === 1 ? right : 2 * right
  },
  'T.INV': (a) => {
    const p = num(a, 0)
    const df = Math.trunc(num(a, 1))
    if (df < 1 || p <= 0 || p >= 1) return err('#NUM!')
    return invertCdf((x) => tCdf(x, df), p, -10, 10)
  },
  'T.INV.2T': (a) => {
    const p = num(a, 0)
    const df = Math.trunc(num(a, 1))
    if (df < 1 || p <= 0 || p > 1) return err('#NUM!')
    return invertCdf((x) => tCdf(x, df), 1 - p / 2, -10, 10)
  },
  // TINV is the two-tailed inverse, so it matches T.INV.2T and not T.INV.
  TINV: (a) => {
    const p = num(a, 0)
    const df = Math.trunc(num(a, 1))
    if (df < 1 || p <= 0 || p > 1) return err('#NUM!')
    return invertCdf((x) => tCdf(x, df), 1 - p / 2, -10, 10)
  },

  // ---- Chi-square ------------------------------------------------------
  'CHISQ.DIST': (a) => {
    const x = num(a, 0)
    const df = Math.trunc(num(a, 1))
    if (df < 1 || x < 0) return err('#NUM!')
    return flag(a, 2) ? chiCdf(x, df) : chiPdf(x, df)
  },
  'CHISQ.DIST.RT': (a) => {
    const x = num(a, 0)
    const df = Math.trunc(num(a, 1))
    return df < 1 || x < 0 ? err('#NUM!') : 1 - chiCdf(x, df)
  },
  // CHIDIST is the RIGHT tail, which CHISQ.DIST is not.
  CHIDIST: (a) => {
    const x = num(a, 0)
    const df = Math.trunc(num(a, 1))
    return df < 1 || x < 0 ? err('#NUM!') : 1 - chiCdf(x, df)
  },
  'CHISQ.INV': (a) => {
    const p = num(a, 0)
    const df = Math.trunc(num(a, 1))
    if (df < 1 || p < 0 || p >= 1) return err('#NUM!')
    return invertCdf((x) => chiCdf(x, df), p, 0, df * 4 + 10)
  },
  'CHISQ.INV.RT': (a) => {
    const p = num(a, 0)
    const df = Math.trunc(num(a, 1))
    if (df < 1 || p <= 0 || p > 1) return err('#NUM!')
    return invertCdf((x) => chiCdf(x, df), 1 - p, 0, df * 4 + 10)
  },
  CHIINV: (a) => {
    const p = num(a, 0)
    const df = Math.trunc(num(a, 1))
    if (df < 1 || p <= 0 || p > 1) return err('#NUM!')
    return invertCdf((x) => chiCdf(x, df), 1 - p, 0, df * 4 + 10)
  },

  // ---- F ---------------------------------------------------------------
  'F.DIST': (a) => {
    const x = num(a, 0)
    const d1 = Math.trunc(num(a, 1))
    const d2 = Math.trunc(num(a, 2))
    if (x < 0 || d1 < 1 || d2 < 1) return err('#NUM!')
    return flag(a, 3) ? fCdf(x, d1, d2) : fPdf(x, d1, d2)
  },
  'F.DIST.RT': (a) => {
    const x = num(a, 0)
    const d1 = Math.trunc(num(a, 1))
    const d2 = Math.trunc(num(a, 2))
    return x < 0 || d1 < 1 || d2 < 1 ? err('#NUM!') : 1 - fCdf(x, d1, d2)
  },
  FDIST: (a) => {
    const x = num(a, 0)
    const d1 = Math.trunc(num(a, 1))
    const d2 = Math.trunc(num(a, 2))
    return x < 0 || d1 < 1 || d2 < 1 ? err('#NUM!') : 1 - fCdf(x, d1, d2)
  },
  'F.INV': (a) => {
    const p = num(a, 0)
    const d1 = Math.trunc(num(a, 1))
    const d2 = Math.trunc(num(a, 2))
    if (p < 0 || p >= 1 || d1 < 1 || d2 < 1) return err('#NUM!')
    return invertCdf((x) => fCdf(x, d1, d2), p, 0, 100)
  },
  'F.INV.RT': (a) => {
    const p = num(a, 0)
    const d1 = Math.trunc(num(a, 1))
    const d2 = Math.trunc(num(a, 2))
    if (p <= 0 || p > 1 || d1 < 1 || d2 < 1) return err('#NUM!')
    return invertCdf((x) => fCdf(x, d1, d2), 1 - p, 0, 100)
  },
  FINV: (a) => {
    const p = num(a, 0)
    const d1 = Math.trunc(num(a, 1))
    const d2 = Math.trunc(num(a, 2))
    if (p <= 0 || p > 1 || d1 < 1 || d2 < 1) return err('#NUM!')
    return invertCdf((x) => fCdf(x, d1, d2), 1 - p, 0, 100)
  },

  // ---- Discrete --------------------------------------------------------
  'BINOM.DIST': (a) => {
    const k = Math.trunc(num(a, 0))
    const n = Math.trunc(num(a, 1))
    const p = num(a, 2)
    if (k < 0 || k > n || p < 0 || p > 1) return err('#NUM!')
    return flag(a, 3) ? binomCdf(k, n, p) : binomPmf(k, n, p)
  },
  BINOMDIST: (a) => {
    const k = Math.trunc(num(a, 0))
    const n = Math.trunc(num(a, 1))
    const p = num(a, 2)
    if (k < 0 || k > n || p < 0 || p > 1) return err('#NUM!')
    return flag(a, 3) ? binomCdf(k, n, p) : binomPmf(k, n, p)
  },
  'BINOM.INV': (a) => {
    const n = Math.trunc(num(a, 0))
    const p = num(a, 1)
    const alpha = num(a, 2)
    if (p < 0 || p > 1 || alpha <= 0 || alpha >= 1) return err('#NUM!')
    let total = 0
    for (let k = 0; k <= n; k += 1) {
      total += binomPmf(k, n, p)
      if (total >= alpha) return k
    }
    return n
  },
  CRITBINOM: (a) => STATS_DIST_FUNCTIONS['BINOM.INV']!(a),
  'NEGBINOM.DIST': (a) => {
    const f = Math.trunc(num(a, 0))
    const s = Math.trunc(num(a, 1))
    const p = num(a, 2)
    if (f < 0 || s < 1 || p <= 0 || p > 1) return err('#NUM!')
    const pmf = (k: number) => choose(k + s - 1, s - 1) * Math.pow(p, s) * Math.pow(1 - p, k)
    if (!flag(a, 3)) return pmf(f)
    let total = 0
    for (let k = 0; k <= f; k += 1) total += pmf(k)
    return Math.min(total, 1)
  },
  NEGBINOMDIST: (a) => {
    const f = Math.trunc(num(a, 0))
    const s = Math.trunc(num(a, 1))
    const p = num(a, 2)
    if (f < 0 || s < 1 || p <= 0 || p > 1) return err('#NUM!')
    return choose(f + s - 1, s - 1) * Math.pow(p, s) * Math.pow(1 - p, f)
  },
  'POISSON.DIST': (a) => {
    const k = Math.trunc(num(a, 0))
    const m = num(a, 1)
    if (k < 0 || m < 0) return err('#NUM!')
    return flag(a, 2) ? poissonCdf(k, m) : poissonPmf(k, m)
  },
  POISSON: (a) => STATS_DIST_FUNCTIONS['POISSON.DIST']!(a),
  'HYPGEOM.DIST': (a) => {
    const x = Math.trunc(num(a, 0))
    const n = Math.trunc(num(a, 1))
    const m = Math.trunc(num(a, 2))
    const N = Math.trunc(num(a, 3))
    if (x < 0 || x > n || n > N || m > N || m < 0) return err('#NUM!')
    if (!has(a, 4) || !flag(a, 4)) return hypgeomPmf(x, n, m, N)
    let total = 0
    for (let k = Math.max(0, n - (N - m)); k <= x; k += 1) total += hypgeomPmf(k, n, m, N)
    return Math.min(total, 1)
  },
  HYPGEOMDIST: (a) => {
    const x = Math.trunc(num(a, 0))
    const n = Math.trunc(num(a, 1))
    const m = Math.trunc(num(a, 2))
    const N = Math.trunc(num(a, 3))
    if (x < 0 || x > n || n > N || m > N || m < 0) return err('#NUM!')
    return hypgeomPmf(x, n, m, N)
  },

  // ---- Continuous, the rest --------------------------------------------
  'EXPON.DIST': (a) => {
    const x = num(a, 0)
    const lambda = num(a, 1)
    if (x < 0 || lambda <= 0) return err('#NUM!')
    return flag(a, 2) ? 1 - Math.exp(-lambda * x) : lambda * Math.exp(-lambda * x)
  },
  EXPONDIST: (a) => STATS_DIST_FUNCTIONS['EXPON.DIST']!(a),
  'LOGNORM.DIST': (a) => {
    const x = num(a, 0)
    const m = num(a, 1)
    const sd = num(a, 2)
    if (x <= 0 || sd <= 0) return err('#NUM!')
    const z = (Math.log(x) - m) / sd
    return flag(a, 3) ? normalCdf(z) : normalPdf(z) / (x * sd)
  },
  // The legacy LOGNORMDIST is cumulative only.
  LOGNORMDIST: (a) => {
    const x = num(a, 0)
    const sd = num(a, 2)
    if (x <= 0 || sd <= 0) return err('#NUM!')
    return normalCdf((Math.log(x) - num(a, 1)) / sd)
  },
  'LOGNORM.INV': (a) => {
    const p = num(a, 0)
    const sd = num(a, 2)
    if (p <= 0 || p >= 1 || sd <= 0) return err('#NUM!')
    return Math.exp(num(a, 1) + sd * invertCdf(normalCdf, p, -8, 8))
  },
  LOGINV: (a) => STATS_DIST_FUNCTIONS['LOGNORM.INV']!(a),
  'GAMMA.DIST': (a) => {
    const x = num(a, 0)
    const alpha = num(a, 1)
    const beta = num(a, 2)
    if (x < 0 || alpha <= 0 || beta <= 0) return err('#NUM!')
    if (flag(a, 3)) return gammaP(alpha, x / beta)
    return Math.exp((alpha - 1) * Math.log(x) - x / beta - lgamma(alpha) - alpha * Math.log(beta))
  },
  GAMMADIST: (a) => STATS_DIST_FUNCTIONS['GAMMA.DIST']!(a),
  'GAMMA.INV': (a) => {
    const p = num(a, 0)
    const alpha = num(a, 1)
    const beta = num(a, 2)
    if (p < 0 || p >= 1 || alpha <= 0 || beta <= 0) return err('#NUM!')
    return invertCdf((x) => gammaP(alpha, x / beta), p, 0, alpha * beta * 10 + 10)
  },
  GAMMAINV: (a) => STATS_DIST_FUNCTIONS['GAMMA.INV']!(a),
  GAMMA: (a) => {
    const x = num(a, 0)
    // Gamma has poles at zero and the negative integers.
    if (x <= 0 && Number.isInteger(x)) return err('#NUM!')
    return gammaFn(x)
  },
  GAMMALN: (a) => {
    const x = num(a, 0)
    return x <= 0 ? err('#NUM!') : lgamma(x)
  },
  'GAMMALN.PRECISE': (a) => {
    const x = num(a, 0)
    return x <= 0 ? err('#NUM!') : lgamma(x)
  },
  'BETA.DIST': (a) => {
    const alpha = num(a, 1)
    const beta = num(a, 2)
    const lo = opt(a, 4, 0)
    const hi = opt(a, 5, 1)
    const x = (num(a, 0) - lo) / (hi - lo)
    if (alpha <= 0 || beta <= 0 || hi <= lo || x < 0 || x > 1) return err('#NUM!')
    if (flag(a, 3)) return betaI(alpha, beta, x)
    const density = Math.exp(
      (alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x)
        + lgamma(alpha + beta) - lgamma(alpha) - lgamma(beta),
    )
    return density / (hi - lo)
  },
  // BETADIST is cumulative only, with the bounds one argument earlier.
  BETADIST: (a) => {
    const alpha = num(a, 1)
    const beta = num(a, 2)
    const lo = opt(a, 3, 0)
    const hi = opt(a, 4, 1)
    const x = (num(a, 0) - lo) / (hi - lo)
    if (alpha <= 0 || beta <= 0 || hi <= lo || x < 0 || x > 1) return err('#NUM!')
    return betaI(alpha, beta, x)
  },
  'BETA.INV': (a) => {
    const p = num(a, 0)
    const alpha = num(a, 1)
    const beta = num(a, 2)
    const lo = opt(a, 3, 0)
    const hi = opt(a, 4, 1)
    if (p <= 0 || p > 1 || alpha <= 0 || beta <= 0 || hi <= lo) return err('#NUM!')
    return lo + (hi - lo) * invertCdf((x) => betaI(alpha, beta, x), p, 0, 1)
  },
  BETAINV: (a) => STATS_DIST_FUNCTIONS['BETA.INV']!(a),
  'WEIBULL.DIST': (a) => {
    const x = num(a, 0)
    const alpha = num(a, 1)
    const beta = num(a, 2)
    if (x < 0 || alpha <= 0 || beta <= 0) return err('#NUM!')
    const scaled = Math.pow(x / beta, alpha)
    if (flag(a, 3)) return 1 - Math.exp(-scaled)
    return (alpha / Math.pow(beta, alpha)) * Math.pow(x, alpha - 1) * Math.exp(-scaled)
  },
  WEIBULL: (a) => STATS_DIST_FUNCTIONS['WEIBULL.DIST']!(a),

  // ---- Confidence intervals -------------------------------------------
  'CONFIDENCE.NORM': (a) => {
    const alpha = num(a, 0)
    const sd = num(a, 1)
    const n = Math.trunc(num(a, 2))
    if (alpha <= 0 || alpha >= 1 || sd <= 0 || n < 1) return err('#NUM!')
    return invertCdf(normalCdf, 1 - alpha / 2, -8, 8) * (sd / Math.sqrt(n))
  },
  CONFIDENCE: (a) => STATS_DIST_FUNCTIONS['CONFIDENCE.NORM']!(a),
  'CONFIDENCE.T': (a) => {
    const alpha = num(a, 0)
    const sd = num(a, 1)
    const n = Math.trunc(num(a, 2))
    if (alpha <= 0 || alpha >= 1 || sd <= 0 || n < 1) return err('#NUM!')
    if (n === 1) return err('#DIV/0!')
    const t = invertCdf((x) => tCdf(x, n - 1), 1 - alpha / 2, -10, 10)
    return t * (sd / Math.sqrt(n))
  },

  // ---- Hypothesis tests ------------------------------------------------
  'Z.TEST': (a) => {
    const ns = numericOnly(a.args[0] ?? [])
    if (ns.length === 0) return err('#N/A')
    const x = num(a, 1)
    const sd = has(a, 2) ? num(a, 2) : (stdev(ns, true) as number)
    if (!(sd > 0)) return err('#DIV/0!')
    return 1 - normalCdf((mean(ns) - x) / (sd / Math.sqrt(ns.length)))
  },
  ZTEST: (a) => STATS_DIST_FUNCTIONS['Z.TEST']!(a),
  'CHISQ.TEST': (a) => {
    const actual = numericOnly(a.args[0] ?? [])
    const expected = numericOnly(a.args[1] ?? [])
    if (actual.length !== expected.length || actual.length === 0) return err('#N/A')
    let stat = 0
    for (let i = 0; i < actual.length; i += 1) {
      const e = expected[i]!
      if (e === 0) return err('#DIV/0!')
      stat += (actual[i]! - e) ** 2 / e
    }
    // The grid's shape decides the degrees of freedom: a single row or
    // column is n - 1, a true table is (rows - 1) (cols - 1).
    const grid = a.grids[0]
    const rows = grid?.length ?? 1
    const cols = grid?.[0]?.length ?? actual.length
    const df = rows > 1 && cols > 1 ? (rows - 1) * (cols - 1) : actual.length - 1
    if (df < 1) return err('#N/A')
    return 1 - chiCdf(stat, df)
  },
  CHITEST: (a) => STATS_DIST_FUNCTIONS['CHISQ.TEST']!(a),
  'F.TEST': (a) => {
    const x = numericOnly(a.args[0] ?? [])
    const y = numericOnly(a.args[1] ?? [])
    if (x.length < 2 || y.length < 2) return err('#DIV/0!')
    const vx = variance(x, true) as number
    const vy = variance(y, true) as number
    if (vx === 0 || vy === 0) return err('#DIV/0!')
    // Excel reports the two-tailed probability, so the larger variance
    // goes on top and the right tail is doubled.
    const ratio = vx > vy ? vx / vy : vy / vx
    const [d1, d2] = vx > vy ? [x.length - 1, y.length - 1] : [y.length - 1, x.length - 1]
    return Math.min(2 * (1 - fCdf(ratio, d1, d2)), 1)
  },
  FTEST: (a) => STATS_DIST_FUNCTIONS['F.TEST']!(a),
  'T.TEST': (a) => {
    const x = numericOnly(a.args[0] ?? [])
    const y = numericOnly(a.args[1] ?? [])
    const tails = Math.trunc(num(a, 2))
    const kind = Math.trunc(num(a, 3))
    if (tails !== 1 && tails !== 2) return err('#NUM!')
    if (kind < 1 || kind > 3) return err('#NUM!')
    let t: number
    let df: number
    if (kind === 1) {
      // Paired: the test is a one-sample test on the differences.
      if (x.length !== y.length || x.length < 2) return err('#N/A')
      const d = x.map((v, i) => v - y[i]!)
      const sd = stdev(d, true) as number
      if (sd === 0) return err('#DIV/0!')
      t = mean(d) / (sd / Math.sqrt(d.length))
      df = d.length - 1
    } else if (kind === 2) {
      // Equal variance: the pooled two-sample test.
      const nx = x.length
      const ny = y.length
      if (nx < 2 || ny < 2) return err('#DIV/0!')
      df = nx + ny - 2
      const pooled = ((nx - 1) * (variance(x, true) as number)
        + (ny - 1) * (variance(y, true) as number)) / df
      if (pooled === 0) return err('#DIV/0!')
      t = (mean(x) - mean(y)) / Math.sqrt(pooled * (1 / nx + 1 / ny))
    } else {
      // Unequal variance: Welch, with its fractional degrees of freedom.
      const nx = x.length
      const ny = y.length
      if (nx < 2 || ny < 2) return err('#DIV/0!')
      const sx = (variance(x, true) as number) / nx
      const sy = (variance(y, true) as number) / ny
      if (sx + sy === 0) return err('#DIV/0!')
      t = (mean(x) - mean(y)) / Math.sqrt(sx + sy)
      df = (sx + sy) ** 2 / (sx ** 2 / (nx - 1) + sy ** 2 / (ny - 1))
    }
    const right = 1 - tCdf(Math.abs(t), df)
    return tails === 1 ? right : 2 * right
  },
  TTEST: (a) => STATS_DIST_FUNCTIONS['T.TEST']!(a),

  // ---- Descriptive -----------------------------------------------------
  AVEDEV: (a) => {
    const ns = numericOnly(a.flat)
    if (ns.length === 0) return err('#NUM!')
    const m = mean(ns)
    return ns.reduce((acc, v) => acc + Math.abs(v - m), 0) / ns.length
  },
  DEVSQ: (a) => {
    const ns = numericOnly(a.flat)
    if (ns.length === 0) return err('#NUM!')
    const m = mean(ns)
    return ns.reduce((acc, v) => acc + (v - m) ** 2, 0)
  },
  SKEW: (a) => {
    const ns = numericOnly(a.flat)
    const n = ns.length
    if (n < 3) return err('#DIV/0!')
    const m = mean(ns)
    const sd = stdev(ns, true) as number
    if (sd === 0) return err('#DIV/0!')
    const sum = ns.reduce((acc, v) => acc + ((v - m) / sd) ** 3, 0)
    return (n / ((n - 1) * (n - 2))) * sum
  },
  'SKEW.P': (a) => {
    const ns = numericOnly(a.flat)
    const n = ns.length
    if (n < 2) return err('#DIV/0!')
    const m = mean(ns)
    const sd = stdev(ns, false) as number
    if (sd === 0) return err('#DIV/0!')
    return ns.reduce((acc, v) => acc + ((v - m) / sd) ** 3, 0) / n
  },
  KURT: (a) => {
    const ns = numericOnly(a.flat)
    const n = ns.length
    if (n < 4) return err('#DIV/0!')
    const m = mean(ns)
    const sd = stdev(ns, true) as number
    if (sd === 0) return err('#DIV/0!')
    const sum = ns.reduce((acc, v) => acc + ((v - m) / sd) ** 4, 0)
    return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum
      - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3))
  },
  TRIMMEAN: (a) => {
    const ns = numericOnly(a.args[0] ?? []).sort((x, y) => x - y)
    const percent = num(a, 1)
    if (percent < 0 || percent >= 1) return err('#NUM!')
    if (ns.length === 0) return err('#NUM!')
    // Excel trims an EVEN count, half off each end, rounding down.
    const cut = Math.floor((ns.length * percent) / 2)
    const kept = ns.slice(cut, ns.length - cut)
    return kept.length === 0 ? err('#NUM!') : mean(kept)
  },
  PERMUTATIONA: (a) => {
    const n = Math.trunc(num(a, 0))
    const k = Math.trunc(num(a, 1))
    return n < 0 || k < 0 ? err('#NUM!') : Math.pow(n, k)
  },
  MULTINOMIAL: (a) => {
    const ns = numericOnly(a.flat).map(Math.trunc)
    if (ns.some((v) => v < 0)) return err('#NUM!')
    const total = ns.reduce((x, y) => x + y, 0)
    return Math.round(Math.exp(lgamma(total + 1) - ns.reduce((acc, v) => acc + lgamma(v + 1), 0)))
  },

  // ---- The *A family ---------------------------------------------------
  AVERAGEA: (a) => {
    const ns = valuesA(a.flat)
    return ns.length === 0 ? err('#DIV/0!') : mean(ns)
  },
  MAXA: (a) => { const ns = valuesA(a.flat); return ns.length === 0 ? 0 : Math.max(...ns) },
  MINA: (a) => { const ns = valuesA(a.flat); return ns.length === 0 ? 0 : Math.min(...ns) },
  STDEVA: (a) => stdev(valuesA(a.flat), true),
  STDEVPA: (a) => stdev(valuesA(a.flat), false),
  VARA: (a) => variance(valuesA(a.flat), true),
  VARPA: (a) => variance(valuesA(a.flat), false),

  // ---- Correlation and regression --------------------------------------
  'COVARIANCE.P': (a) => {
    const ps = pairs(a.args[0] ?? [], a.args[1] ?? [])
    if (!ps || ps.length === 0) return err('#N/A')
    const mx = mean(ps.map(([x]) => x))
    const my = mean(ps.map(([, y]) => y))
    return ps.reduce((acc, [x, y]) => acc + (x - mx) * (y - my), 0) / ps.length
  },
  COVAR: (a) => STATS_DIST_FUNCTIONS['COVARIANCE.P']!(a),
  'COVARIANCE.S': (a) => {
    const ps = pairs(a.args[0] ?? [], a.args[1] ?? [])
    if (!ps || ps.length < 2) return err('#DIV/0!')
    const mx = mean(ps.map(([x]) => x))
    const my = mean(ps.map(([, y]) => y))
    return ps.reduce((acc, [x, y]) => acc + (x - mx) * (y - my), 0) / (ps.length - 1)
  },
  PEARSON: (a) => {
    const ps = pairs(a.args[0] ?? [], a.args[1] ?? [])
    if (!ps || ps.length < 2) return err('#DIV/0!')
    const mx = mean(ps.map(([x]) => x))
    const my = mean(ps.map(([, y]) => y))
    let sxy = 0
    let sxx = 0
    let syy = 0
    for (const [x, y] of ps) {
      sxy += (x - mx) * (y - my)
      sxx += (x - mx) ** 2
      syy += (y - my) ** 2
    }
    return sxx === 0 || syy === 0 ? err('#DIV/0!') : sxy / Math.sqrt(sxx * syy)
  },
  RSQ: (a) => {
    const r = STATS_DIST_FUNCTIONS.PEARSON!(a)
    return typeof r === 'number' ? r * r : r
  },
  STEYX: (a) => {
    const ps = pairs(a.args[0] ?? [], a.args[1] ?? [])
    if (!ps || ps.length < 3) return err('#DIV/0!')
    const mx = mean(ps.map(([x]) => x))
    const my = mean(ps.map(([, y]) => y))
    let sxy = 0
    let sxx = 0
    let syy = 0
    for (const [x, y] of ps) {
      sxy += (x - mx) * (y - my)
      sxx += (x - mx) ** 2
      syy += (y - my) ** 2
    }
    if (sxx === 0) return err('#DIV/0!')
    return Math.sqrt((syy - (sxy * sxy) / sxx) / (ps.length - 2))
  },
  PROB: (a) => {
    const xs = numericOnly(a.args[0] ?? [])
    const ps = numericOnly(a.args[1] ?? [])
    if (xs.length !== ps.length || xs.length === 0) return err('#N/A')
    const total = ps.reduce((x, y) => x + y, 0)
    if (Math.abs(total - 1) > 1e-9 || ps.some((p) => p <= 0 || p > 1)) return err('#NUM!')
    const lo = num(a, 2)
    const hi = has(a, 3) ? num(a, 3) : lo
    let out = 0
    for (let i = 0; i < xs.length; i += 1) {
      if (xs[i]! >= lo && xs[i]! <= hi) out += ps[i]!
    }
    return out
  },
}
