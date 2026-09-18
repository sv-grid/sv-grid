/**
 * Excel's time-value-of-money functions: PMT and its parts, PV, FV, NPER,
 * RATE, NPV, IRR and straight-line depreciation.
 *
 * All of them share Excel's sign convention, which is the thing to get
 * right: money you pay out is negative, money you receive is positive, so
 * `=PMT(5%/12, 360, 200000)` is a negative payment on a positive loan and
 * `=FV(6%/12, 120, -100)` is a positive balance from negative deposits.
 * The closed forms below are the ones Excel documents; RATE and IRR have
 * no closed form and are solved by Newton's method with a bisection
 * fallback, returning `#NUM!` when neither converges, as Excel does.
 */
import { err, type CellValue } from '../ast'
import { toNumber, numericOnly } from '../coerce'
import type { FnArgs, SheetFunction } from '../functions'

const num = (a: FnArgs, i: number): number => toNumber(a.args[i]?.[0] ?? '')

/** An optional argument: absent, or left empty between commas, reads as
 *  `fallback`. A typed 0 is 0. */
function opt(a: FnArgs, i: number, fallback: number): number {
  const v = a.args[i]?.[0]
  return v === undefined || v === '' ? fallback : toNumber(v)
}

/** `type` is 0 for payments at the end of the period, 1 for the start. */
const paymentType = (a: FnArgs, i: number): 0 | 1 => (opt(a, i, 0) === 0 ? 0 : 1)

export function pmt(rate: number, nper: number, pv: number, fv: number, type: 0 | 1): number {
  if (rate === 0) return -(pv + fv) / nper
  const f = Math.pow(1 + rate, nper)
  return -(rate * (pv * f + fv)) / ((1 + rate * type) * (f - 1))
}

export function fv(rate: number, nper: number, pmt: number, pv: number, type: 0 | 1): number {
  if (rate === 0) return -(pv + pmt * nper)
  const f = Math.pow(1 + rate, nper)
  return -(pv * f + (pmt * (1 + rate * type) * (f - 1)) / rate)
}

export function pv(rate: number, nper: number, pmt: number, fv: number, type: 0 | 1): number {
  if (rate === 0) return -(fv + pmt * nper)
  const f = Math.pow(1 + rate, nper)
  return -(fv + (pmt * (1 + rate * type) * (f - 1)) / rate) / f
}

function nper(rate: number, pmt: number, pv: number, fv: number, type: 0 | 1): CellValue {
  if (rate === 0) return pmt === 0 ? err('#NUM!') : -(pv + fv) / pmt
  const p = pmt * (1 + rate * type)
  const ratio = (p - fv * rate) / (p + pv * rate)
  if (!(ratio > 0)) return err('#NUM!')
  return Math.log(ratio) / Math.log(1 + rate)
}

/**
 * Find a root of `f` near `guess`: Newton with a numerical derivative, then
 * a bracketing scan and bisection when Newton wanders off. Both RATE and
 * IRR are smooth enough for this, and the fallback is what keeps a loan
 * with an odd guess from coming back `#NUM!` when Excel finds it.
 */
function solve(f: (x: number) => number, guess: number, low: number, high: number): number | null {
  let x = guess
  for (let i = 0; i < 100; i += 1) {
    const y = f(x)
    if (!Number.isFinite(y)) break
    if (Math.abs(y) < 1e-10) return x
    const h = Math.max(1e-7, Math.abs(x) * 1e-6)
    const slope = (f(x + h) - f(x - h)) / (2 * h)
    if (!Number.isFinite(slope) || slope === 0) break
    const next = x - y / slope
    if (!Number.isFinite(next) || next <= low || next >= high) break
    if (Math.abs(next - x) < 1e-12) return next
    x = next
  }
  // Bracket a sign change on a grid, then bisect it.
  const steps = 400
  let a = low
  let fa = f(a)
  for (let i = 1; i <= steps; i += 1) {
    const b = low + ((high - low) * i) / steps
    const fb = f(b)
    if (Number.isFinite(fa) && Number.isFinite(fb) && Math.sign(fa) !== Math.sign(fb)) {
      let lo = a
      let hi = b
      let flo = fa
      for (let k = 0; k < 200; k += 1) {
        const mid = (lo + hi) / 2
        const fm = f(mid)
        if (Math.abs(fm) < 1e-10 || hi - lo < 1e-14) return mid
        if (Math.sign(fm) === Math.sign(flo)) {
          lo = mid
          flo = fm
        } else hi = mid
      }
      return (lo + hi) / 2
    }
    a = b
    fa = fb
  }
  return null
}

function npv(rate: number, flows: ReadonlyArray<number>): number {
  let total = 0
  for (let i = 0; i < flows.length; i += 1) total += flows[i]! / Math.pow(1 + rate, i + 1)
  return total
}

/** The balance a loan carries into period `per`, which IPMT charges
 *  interest on and PPMT pays down: the future value after per-1 payments. */
function balanceBefore(rate: number, per: number, payment: number, present: number, type: 0 | 1): number {
  if (per === 1) return type === 1 ? 0 : -present
  if (type === 1) return fv(rate, per - 2, payment, present, 1) - payment
  return fv(rate, per - 1, payment, present, 0)
}

export const FINANCIAL_FUNCTIONS: Record<string, SheetFunction> = {
  PMT: (a) => {
    const rate = num(a, 0)
    const n = num(a, 1)
    if (n === 0 || rate <= -1) return err('#NUM!')
    return pmt(rate, n, num(a, 2), opt(a, 3, 0), paymentType(a, 4))
  },
  FV: (a) => {
    const rate = num(a, 0)
    if (rate <= -1) return err('#NUM!')
    return fv(rate, num(a, 1), num(a, 2), opt(a, 3, 0), paymentType(a, 4))
  },
  PV: (a) => {
    const rate = num(a, 0)
    if (rate <= -1) return err('#NUM!')
    return pv(rate, num(a, 1), num(a, 2), opt(a, 3, 0), paymentType(a, 4))
  },
  NPER: (a) => {
    const rate = num(a, 0)
    if (rate <= -1) return err('#NUM!')
    return nper(rate, num(a, 1), num(a, 2), opt(a, 3, 0), paymentType(a, 4))
  },
  // IPMT(rate, per, nper, pv, [fv], [type]): the interest part of the
  // payment in period `per`, the balance carried into it times the rate.
  IPMT: (a) => {
    const rate = num(a, 0)
    const per = num(a, 1)
    const n = num(a, 2)
    const present = num(a, 3)
    const type = paymentType(a, 5)
    if (per < 1 || per > n || n === 0 || rate <= -1) return err('#NUM!')
    const payment = pmt(rate, n, present, opt(a, 4, 0), type)
    return balanceBefore(rate, per, payment, present, type) * rate
  },
  PPMT: (a) => {
    const rate = num(a, 0)
    const per = num(a, 1)
    const n = num(a, 2)
    const present = num(a, 3)
    const type = paymentType(a, 5)
    if (per < 1 || per > n || n === 0 || rate <= -1) return err('#NUM!')
    const payment = pmt(rate, n, present, opt(a, 4, 0), type)
    return payment - balanceBefore(rate, per, payment, present, type) * rate
  },
  RATE: (a) => {
    const n = num(a, 0)
    const payment = num(a, 1)
    const present = num(a, 2)
    const future = opt(a, 3, 0)
    const type = paymentType(a, 4)
    const guess = opt(a, 5, 0.1)
    if (n <= 0) return err('#NUM!')
    const f = (r: number) => {
      if (r === 0) return present + payment * n + future
      const g = Math.pow(1 + r, n)
      return present * g + (payment * (1 + r * type) * (g - 1)) / r + future
    }
    const root = solve(f, guess, -0.999999, 10)
    return root === null ? err('#NUM!') : root
  },
  // NPV(rate, value1, ...): the first flow is discounted one period, as in
  // Excel, so an investment made today goes outside the call: =NPV(...)+A1.
  NPV: (a) => {
    const rate = num(a, 0)
    if (rate <= -1) return err('#NUM!')
    return npv(rate, numericOnly(a.args.slice(1).flat()))
  },
  // IRR(values, [guess]): the rate at which the flows, the first one at
  // time zero, sum to nothing. Needs at least one inflow and one outflow.
  IRR: (a) => {
    const flows = numericOnly(a.args[0] ?? [])
    const guess = opt(a, 1, 0.1)
    if (!flows.some((v) => v > 0) || !flows.some((v) => v < 0)) return err('#NUM!')
    const f = (r: number) => {
      let total = 0
      for (let i = 0; i < flows.length; i += 1) total += flows[i]! / Math.pow(1 + r, i)
      return total
    }
    const root = solve(f, guess, -0.999999, 10)
    return root === null ? err('#NUM!') : root
  },
  // SLN(cost, salvage, life): straight-line depreciation for one period.
  SLN: (a) => {
    const life = num(a, 2)
    if (life === 0) return err('#DIV/0!')
    return (num(a, 0) - num(a, 1)) / life
  },
}
