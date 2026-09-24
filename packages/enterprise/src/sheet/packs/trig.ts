/**
 * Excel's Math and Trigonometry family: the circular functions, their
 * inverses, the hyperbolic set, and the two that turn one angle measure
 * into the other.
 *
 * Two traps live here, both of which read as a bug in a model rather than
 * as a difference of convention:
 *
 *   - `ATAN2` takes its arguments x first, y second, which is the opposite
 *     order from every C-family `atan2`. `=ATAN2(-1, 1)` is 3/4 pi in
 *     Excel; handing the pair straight to `Math.atan2` gives -1/4 pi.
 *   - The reciprocal functions are undefined where their partner is zero,
 *     and Excel reports that as `#DIV/0!` rather than as infinity.
 *
 * Domain errors are `#NUM!`, as Excel reports them: ASIN past 1, ACOSH
 * below 1, ATANH at 1.
 */
import { err, type CellValue } from '../ast'
import { toNumber } from '../coerce'
import type { FnArgs, SheetFunction } from '../functions'

const nth = (a: FnArgs, i: number): CellValue => a.args[i]?.[0] ?? ''
const num = (a: FnArgs, i: number): number => toNumber(nth(a, i))

/** A result that has to lie in a domain, with Excel's error when it does not. */
const guard = (ok: boolean, value: () => number): CellValue => (ok ? value() : err('#NUM!'))

/**
 * A reciprocal of a circular function. Excel calls the pole `#DIV/0!`, and
 * a pole is where the partner function is zero. Comparing against an exact
 * zero is right for COT(0) and CSC(0), which is what people actually type;
 * at pi the partner is only near zero in binary floating point, and Excel
 * answers with the same large number JavaScript does, so nothing is snapped.
 */
const reciprocal = (partner: number): CellValue => (partner === 0 ? err('#DIV/0!') : 1 / partner)

export const TRIG_FUNCTIONS: Record<string, SheetFunction> = {
  // ---- Circular --------------------------------------------------------
  SIN: (a) => Math.sin(num(a, 0)),
  COS: (a) => Math.cos(num(a, 0)),
  TAN: (a) => Math.tan(num(a, 0)),
  COT: (a) => reciprocal(Math.tan(num(a, 0))),
  SEC: (a) => reciprocal(Math.cos(num(a, 0))),
  CSC: (a) => reciprocal(Math.sin(num(a, 0))),

  // ---- Inverse circular ------------------------------------------------
  ASIN: (a) => { const x = num(a, 0); return guard(x >= -1 && x <= 1, () => Math.asin(x)) },
  ACOS: (a) => { const x = num(a, 0); return guard(x >= -1 && x <= 1, () => Math.acos(x)) },
  ATAN: (a) => Math.atan(num(a, 0)),
  // Excel's argument order is (x, y); Math.atan2 wants (y, x).
  ATAN2: (a) => {
    const x = num(a, 0)
    const y = num(a, 1)
    return x === 0 && y === 0 ? err('#DIV/0!') : Math.atan2(y, x)
  },
  // ACOT is the angle in (0, pi), which is what pi/2 minus ATAN gives for
  // every real argument, zero included.
  ACOT: (a) => Math.PI / 2 - Math.atan(num(a, 0)),

  // ---- Hyperbolic ------------------------------------------------------
  SINH: (a) => Math.sinh(num(a, 0)),
  COSH: (a) => Math.cosh(num(a, 0)),
  TANH: (a) => Math.tanh(num(a, 0)),
  COTH: (a) => reciprocal(Math.tanh(num(a, 0))),
  SECH: (a) => reciprocal(Math.cosh(num(a, 0))),
  CSCH: (a) => reciprocal(Math.sinh(num(a, 0))),

  // ---- Inverse hyperbolic ---------------------------------------------
  ASINH: (a) => Math.asinh(num(a, 0)),
  ACOSH: (a) => { const x = num(a, 0); return guard(x >= 1, () => Math.acosh(x)) },
  ATANH: (a) => { const x = num(a, 0); return guard(x > -1 && x < 1, () => Math.atanh(x)) },
  // ACOTH is defined outside [-1, 1]; at the ends it is a pole.
  ACOTH: (a) => {
    const x = num(a, 0)
    return guard(Math.abs(x) > 1, () => 0.5 * Math.log((x + 1) / (x - 1)))
  },

  // ---- Angle measure and the odd one out -------------------------------
  DEGREES: (a) => (num(a, 0) * 180) / Math.PI,
  RADIANS: (a) => (num(a, 0) * Math.PI) / 180,
  SQRTPI: (a) => { const x = num(a, 0); return guard(x >= 0, () => Math.sqrt(x * Math.PI)) },
}
