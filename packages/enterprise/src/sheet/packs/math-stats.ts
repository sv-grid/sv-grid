/**
 * More of Excel's math, statistics and reference functions: rounding to a
 * multiple, logs, integers, order statistics, variances, the *IFS
 * aggregates, simple regression, CHOOSE and the range dimensions.
 *
 * Rounding to a multiple is where floating point bites: 1.5 / 0.1 is
 * 15.000000000000002, which CEILING would happily read as 16. `snap` treats a
 * quotient within a hair of an integer as that integer, and `tidy` trims
 * the drift off the product, so `=CEILING(1.5, 0.1)` is 1.5 and not 1.6.
 */
import { err, type CellValue } from '../ast'
import { toNumber, numericOnly, multiCriteriaHits, criteriaPairs } from '../coerce'
import type { FnArgs, SheetFunction } from '../functions'

const nth = (a: FnArgs, i: number): CellValue => a.args[i]?.[0] ?? ''
const num = (a: FnArgs, i: number): number => toNumber(nth(a, i))
function opt(a: FnArgs, i: number, fallback: number): number {
  const v = a.args[i]?.[0]
  return v === undefined || v === '' ? fallback : toNumber(v)
}

const snap = (q: number): number => (Math.abs(q - Math.round(q)) < 1e-9 ? Math.round(q) : q)
const tidy = (x: number): number => (Number.isFinite(x) ? Number(x.toPrecision(15)) : x)

/** Round half away from zero, which is what Excel does and Math.round does not
 *  for negatives. */
const roundHalfAway = (x: number): number => Math.sign(x) * Math.round(Math.abs(x))

function sorted(values: ReadonlyArray<CellValue>): number[] {
  return numericOnly(values).sort((x, y) => x - y)
}

/** PERCENTILE.INC: linear interpolation between the order statistics. */
function percentileInc(values: number[], k: number): CellValue {
  if (!values.length || k < 0 || k > 1) return err('#NUM!')
  const pos = k * (values.length - 1)
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return values[lo]! + (values[hi]! - values[lo]!) * (pos - lo)
}

/** PERCENTILE.EXC: the same idea over n+1 slots, undefined at the ends. */
function percentileExc(values: number[], k: number): CellValue {
  const n = values.length
  if (!n || k <= 0 || k >= 1) return err('#NUM!')
  const pos = k * (n + 1) - 1
  if (pos < 0 || pos > n - 1) return err('#NUM!')
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return values[lo]! + (values[hi]! - values[lo]!) * (pos - lo)
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

/** The (x, y) pairs where both sides are numbers, as Excel pairs its
 *  known_y's and known_x's, dropping the rest. */
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

type Line = { slope: number; intercept: number }
const isLine = (r: Line | CellValue): r is Line => typeof r === 'object' && r !== null && 'slope' in r

function regression(ys: ReadonlyArray<CellValue>, xs: ReadonlyArray<CellValue>): Line | CellValue {
  const p = pairs(ys, xs)
  if (!p) return err('#N/A')
  const n = p.length
  if (n < 2) return err('#DIV/0!')
  const mx = p.reduce((s, [x]) => s + x, 0) / n
  const my = p.reduce((s, [, y]) => s + y, 0) / n
  let sxx = 0
  let sxy = 0
  for (const [x, y] of p) {
    sxx += (x - mx) ** 2
    sxy += (x - mx) * (y - my)
  }
  if (sxx === 0) return err('#DIV/0!')
  const slope = sxy / sxx
  return { slope, intercept: my - slope * mx }
}

function gcd(x: number, y: number): number {
  let a = Math.abs(x)
  let b = Math.abs(y)
  while (b) {
    const t = a % b
    a = b
    b = t
  }
  return a
}

function ifsAggregate(a: FnArgs, pick: (hits: number[]) => CellValue): CellValue {
  const target = a.args[0] ?? []
  const hits = multiCriteriaHits(criteriaPairs(a.args, 1)).map((i) => target[i] ?? '')
  return pick(numericOnly(hits))
}

function ceilingLegacy(number: number, significance: number): CellValue {
  if (significance === 0) return 0
  if (number > 0 && significance < 0) return err('#NUM!')
  return tidy(Math.ceil(snap(number / significance)) * significance)
}

function floorLegacy(number: number, significance: number): CellValue {
  if (significance === 0) return err('#DIV/0!')
  if (number > 0 && significance < 0) return err('#NUM!')
  return tidy(Math.floor(snap(number / significance)) * significance)
}

/** CEILING.MATH / FLOOR.MATH: the sign of `significance` is ignored, and
 *  `mode` says which way a negative number goes: toward zero by default for
 *  CEILING.MATH and away from it for FLOOR.MATH, the other way when set. */
function ceilingMath(number: number, significance: number, mode: number): CellValue {
  const sig = Math.abs(significance)
  if (sig === 0) return 0
  const q = snap(number / sig)
  const away = number < 0 && mode !== 0
  return tidy((away ? Math.floor(q) : Math.ceil(q)) * sig)
}

function floorMath(number: number, significance: number, mode: number): CellValue {
  const sig = Math.abs(significance)
  if (sig === 0) return 0
  const q = snap(number / sig)
  const towardZero = number < 0 && mode !== 0
  return tidy((towardZero ? Math.ceil(q) : Math.floor(q)) * sig)
}

function mode(values: number[]): CellValue {
  const counts = new Map<number, number>()
  let best: number | null = null
  let bestCount = 1
  for (const v of values) {
    const c = (counts.get(v) ?? 0) + 1
    counts.set(v, c)
    if (c > bestCount) { best = v; bestCount = c }
  }
  return best === null ? err('#N/A') : best
}

function forecast(a: FnArgs): CellValue {
  const r = regression(a.args[1] ?? [], a.args[2] ?? [])
  if (!isLine(r)) return r
  return r.intercept + r.slope * num(a, 0)
}

export const MATH_STATS_FUNCTIONS: Record<string, SheetFunction> = {
  // ---- Math ------------------------------------------------------------
  PRODUCT: (a) => numericOnly(a.flat).reduce((x, y) => x * y, 1),
  SUMSQ: (a) => numericOnly(a.flat).reduce((x, y) => x + y * y, 0),
  // SUMPRODUCT: the ranges must be the same shape; a cell that is not a
  // number counts as zero, as in Excel.
  SUMPRODUCT: (a) => {
    const lists = a.args
    if (!lists.length) return 0
    const n = lists[0]!.length
    if (lists.some((l) => l.length !== n)) return err('#VALUE!')
    let total = 0
    for (let i = 0; i < n; i += 1) {
      let product = 1
      for (const l of lists) {
        const v = l[i]
        product *= typeof v === 'number' ? v : 0
      }
      total += product
    }
    return total
  },
  CEILING: (a) => ceilingLegacy(num(a, 0), num(a, 1)),
  'CEILING.MATH': (a) => ceilingMath(num(a, 0), opt(a, 1, 1), opt(a, 2, 0)),
  FLOOR: (a) => floorLegacy(num(a, 0), num(a, 1)),
  'FLOOR.MATH': (a) => floorMath(num(a, 0), opt(a, 1, 1), opt(a, 2, 0)),
  MROUND: (a) => {
    const n = num(a, 0)
    const m = num(a, 1)
    if (m === 0) return 0
    if ((n > 0 && m < 0) || (n < 0 && m > 0)) return err('#NUM!')
    return tidy(roundHalfAway(snap(n / m)) * m)
  },
  TRUNC: (a) => {
    const digits = Math.trunc(opt(a, 1, 0))
    const f = Math.pow(10, digits)
    return tidy(Math.trunc(snap(num(a, 0) * f)) / f)
  },
  LOG: (a) => {
    const n = num(a, 0)
    const base = opt(a, 1, 10)
    if (n <= 0 || base <= 0) return err('#NUM!')
    if (base === 1) return err('#DIV/0!')
    return tidy(Math.log(n) / Math.log(base))
  },
  LOG10: (a) => {
    const n = num(a, 0)
    return n <= 0 ? err('#NUM!') : Math.log10(n)
  },
  LN: (a) => {
    const n = num(a, 0)
    return n <= 0 ? err('#NUM!') : Math.log(n)
  },
  EXP: (a) => Math.exp(num(a, 0)),
  PI: () => Math.PI,
  RAND: () => Math.random(),
  RANDBETWEEN: (a) => {
    const lo = Math.ceil(num(a, 0))
    const hi = Math.floor(num(a, 1))
    if (lo > hi) return err('#NUM!')
    return lo + Math.floor(Math.random() * (hi - lo + 1))
  },
  SIGN: (a) => Math.sign(num(a, 0)),
  // EVEN and ODD round away from zero to the next even or odd integer.
  EVEN: (a) => {
    const n = num(a, 0)
    if (n === 0) return 0
    const up = Math.ceil(Math.abs(n))
    return Math.sign(n) * (up % 2 === 0 ? up : up + 1)
  },
  ODD: (a) => {
    const n = num(a, 0)
    if (n === 0) return 1
    const up = Math.ceil(Math.abs(n))
    return Math.sign(n) * (up % 2 === 1 ? up : up + 1)
  },
  QUOTIENT: (a) => {
    const d = num(a, 1)
    return d === 0 ? err('#DIV/0!') : Math.trunc(num(a, 0) / d)
  },
  GCD: (a) => {
    const ns = numericOnly(a.flat).map(Math.trunc)
    if (ns.some((n) => n < 0)) return err('#NUM!')
    return ns.reduce((x, y) => gcd(x, y), 0)
  },
  LCM: (a) => {
    const ns = numericOnly(a.flat).map(Math.trunc)
    if (ns.some((n) => n < 0)) return err('#NUM!')
    if (ns.some((n) => n === 0)) return 0
    return ns.reduce((x, y) => (x * y) / gcd(x, y), 1)
  },
  FACT: (a) => {
    const n = Math.trunc(num(a, 0))
    if (n < 0 || n > 170) return err('#NUM!')
    let out = 1
    for (let i = 2; i <= n; i += 1) out *= i
    return out
  },
  ISEVEN: (a) => Math.trunc(num(a, 0)) % 2 === 0,
  ISODD: (a) => Math.trunc(num(a, 0)) % 2 !== 0,

  // ---- Statistics ------------------------------------------------------
  LARGE: (a) => {
    const values = sorted(a.args[0] ?? [])
    const k = Math.trunc(num(a, 1))
    if (k < 1 || k > values.length) return err('#NUM!')
    return values[values.length - k]!
  },
  SMALL: (a) => {
    const values = sorted(a.args[0] ?? [])
    const k = Math.trunc(num(a, 1))
    if (k < 1 || k > values.length) return err('#NUM!')
    return values[k - 1]!
  },
  PERCENTILE: (a) => percentileInc(sorted(a.args[0] ?? []), num(a, 1)),
  'PERCENTILE.INC': (a) => percentileInc(sorted(a.args[0] ?? []), num(a, 1)),
  'PERCENTILE.EXC': (a) => percentileExc(sorted(a.args[0] ?? []), num(a, 1)),
  QUARTILE: (a) => {
    const q = Math.trunc(num(a, 1))
    return q < 0 || q > 4 ? err('#NUM!') : percentileInc(sorted(a.args[0] ?? []), q / 4)
  },
  'QUARTILE.INC': (a) => {
    const q = Math.trunc(num(a, 1))
    return q < 0 || q > 4 ? err('#NUM!') : percentileInc(sorted(a.args[0] ?? []), q / 4)
  },
  'QUARTILE.EXC': (a) => {
    const q = Math.trunc(num(a, 1))
    return q < 1 || q > 3 ? err('#NUM!') : percentileExc(sorted(a.args[0] ?? []), q / 4)
  },
  VAR: (a) => variance(numericOnly(a.flat), true),
  'VAR.S': (a) => variance(numericOnly(a.flat), true),
  'VAR.P': (a) => variance(numericOnly(a.flat), false),
  VARP: (a) => variance(numericOnly(a.flat), false),
  'STDEV.S': (a) => stdev(numericOnly(a.flat), true),
  'STDEV.P': (a) => stdev(numericOnly(a.flat), false),
  STDEVP: (a) => stdev(numericOnly(a.flat), false),
  // MODE: the most frequent number, the first one at that count when tied;
  // #N/A when nothing repeats, as Excel gives.
  MODE: (a) => mode(numericOnly(a.flat)),
  'MODE.SNGL': (a) => mode(numericOnly(a.flat)),
  GEOMEAN: (a) => {
    const values = numericOnly(a.flat)
    if (!values.length || values.some((v) => v <= 0)) return err('#NUM!')
    return Math.exp(values.reduce((s, v) => s + Math.log(v), 0) / values.length)
  },
  AVERAGEIFS: (a) => ifsAggregate(a, (ns) => (ns.length ? ns.reduce((x, y) => x + y, 0) / ns.length : err('#DIV/0!'))),
  MAXIFS: (a) => ifsAggregate(a, (ns) => (ns.length ? Math.max(...ns) : 0)),
  MINIFS: (a) => ifsAggregate(a, (ns) => (ns.length ? Math.min(...ns) : 0)),
  CORREL: (a) => {
    const p = pairs(a.args[0] ?? [], a.args[1] ?? [])
    if (!p) return err('#N/A')
    const n = p.length
    if (n < 2) return err('#DIV/0!')
    const mx = p.reduce((s, [x]) => s + x, 0) / n
    const my = p.reduce((s, [, y]) => s + y, 0) / n
    let sxx = 0
    let syy = 0
    let sxy = 0
    for (const [x, y] of p) {
      sxx += (x - mx) ** 2
      syy += (y - my) ** 2
      sxy += (x - mx) * (y - my)
    }
    if (sxx === 0 || syy === 0) return err('#DIV/0!')
    return sxy / Math.sqrt(sxx * syy)
  },
  SLOPE: (a) => {
    const r = regression(a.args[0] ?? [], a.args[1] ?? [])
    return isLine(r) ? r.slope : r
  },
  INTERCEPT: (a) => {
    const r = regression(a.args[0] ?? [], a.args[1] ?? [])
    return isLine(r) ? r.intercept : r
  },
  // FORECAST(x, known_y's, known_x's): the line through the pairs, read at x.
  FORECAST: forecast,
  'FORECAST.LINEAR': forecast,

  // ---- Reference -------------------------------------------------------
  CHOOSE: (a) => {
    const index = Math.trunc(num(a, 0))
    if (index < 1 || index >= a.args.length) return err('#VALUE!')
    return a.args[index]![0] ?? ''
  },
  ROWS: (a) => a.grids[0]?.length ?? 1,
  COLUMNS: (a) => a.grids[0]?.[0]?.length ?? 1,
  ISNONTEXT: (a) => {
    const v = a.flat[0] ?? ''
    return typeof v !== 'string' || v === ''
  },
}
