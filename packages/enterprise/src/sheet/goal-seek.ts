/**
 * Goal Seek: find the input value that makes a formula cell hit a target.
 *
 * "What interest rate makes the monthly payment 1500?" You know the answer
 * you want and one cell you are willing to change; the solver finds it.
 *
 * The method is secant with a bisection fallback, not Newton. Newton needs a
 * derivative, and the function here is "recalculate a spreadsheet", which has
 * no analytic one. Secant approximates the slope from two evaluations, which
 * is the same information a numerical derivative would cost anyway.
 *
 * Bisection is the fallback because secant is fast but not safe: it can step
 * to infinity on a flat stretch or oscillate on a kink. When a bracket is
 * known - two inputs whose results straddle the target - bisection cannot
 * fail, only be slow. Trying secant first and falling back keeps the common
 * case quick and the awkward case terminating.
 */

export type GoalSeekOptions = {
  /** Stop once the result is this close to the target. */
  tolerance?: number
  /** Give up after this many recalculations. */
  maxIterations?: number
  /** Where to start looking. Defaults to the input cell's current value. */
  initialGuess?: number
  /** Keep the answer inside these bounds. A rate solver wants [0, 1]. */
  min?: number
  max?: number
}

export type GoalSeekResult = {
  /** Whether the target was reached within tolerance. */
  converged: boolean
  /** The input value found. Present even when it did not converge, so a
   *  caller can show the closest attempt rather than nothing. */
  value: number
  /** What the formula produced at that input. */
  result: number
  iterations: number
  /** Why it stopped, when it did not converge. */
  reason?: 'maxIterations' | 'notNumeric' | 'flat' | 'outOfBounds'
}

const DEFAULTS = {
  tolerance: 1e-7,
  maxIterations: 100,
}

/**
 * Solve `evaluate(input) = target` for `input`.
 *
 * `evaluate` sets the input cell, recalculates, and returns the formula
 * cell's value. It is called many times, so it should be the workbook's own
 * recalculation rather than anything that touches the DOM.
 *
 * The caller owns the input cell: this never writes. It reports the value it
 * found and lets the caller decide whether to keep it, which is what makes
 * Excel's "Goal Seek found a solution / OK or Cancel" dialog possible.
 */
export function goalSeek(
  evaluate: (input: number) => unknown,
  target: number,
  start: number,
  options: GoalSeekOptions = {},
): GoalSeekResult {
  const tolerance = options.tolerance ?? DEFAULTS.tolerance
  const maxIterations = options.maxIterations ?? DEFAULTS.maxIterations
  const min = options.min ?? Number.NEGATIVE_INFINITY
  const max = options.max ?? Number.POSITIVE_INFINITY

  let iterations = 0

  const clamp = (x: number) => Math.min(Math.max(x, min), max)

  /** The signed distance from the target. Zero is the answer. */
  const f = (x: number): number | null => {
    iterations += 1
    const raw = evaluate(x)
    const n = typeof raw === 'number' ? raw : Number(raw)
    return Number.isFinite(n) ? n - target : null
  }

  let x0 = clamp(options.initialGuess ?? start)
  let f0 = f(x0)
  if (f0 === null) {
    return { converged: false, value: x0, result: NaN, iterations, reason: 'notNumeric' }
  }
  if (Math.abs(f0) <= tolerance) {
    return { converged: true, value: x0, result: f0 + target, iterations }
  }

  // A second point, offset enough to see a slope. Scaling with the guess
  // matters: a fixed step of 1 is enormous next to an interest rate of 0.05
  // and invisible next to a loan of 300000.
  let x1 = clamp(x0 !== 0 ? x0 * 1.1 : 1)
  if (x1 === x0) x1 = clamp(x0 + 1)
  let f1 = f(x1)
  if (f1 === null) {
    return { converged: false, value: x0, result: f0 + target, iterations, reason: 'notNumeric' }
  }

  /** Best seen so far, so a failure still reports the closest attempt. */
  let best = Math.abs(f0) <= Math.abs(f1) ? { x: x0, fx: f0 } : { x: x1, fx: f1 }

  // A bracket, once one is found: two inputs whose results straddle the
  // target. Bisection inside it cannot diverge.
  //
  // Held on one object rather than two `let`s because the only writes happen
  // inside `noteBracket`, and TypeScript's control-flow analysis does not
  // follow a closure - it would narrow the bare bindings to `never` at every
  // read below.
  type Point = { x: number; fx: number }
  const bracket: { lo: Point | null; hi: Point | null } = { lo: null, hi: null }
  const noteBracket = (a: Point, b: Point) => {
    if (a.fx === 0 || b.fx === 0) return
    if ((a.fx < 0) !== (b.fx < 0)) {
      bracket.lo = a.fx < 0 ? a : b
      bracket.hi = a.fx < 0 ? b : a
    }
  }
  noteBracket({ x: x0, fx: f0 }, { x: x1, fx: f1 })

  while (iterations < maxIterations) {
    if (Math.abs(f1) <= tolerance) {
      return { converged: true, value: x1, result: f1 + target, iterations }
    }

    let next: number
    const slope = f1 - f0
    if (slope === 0) {
      // Flat between the two points. Secant divides by this, so bisect if a
      // bracket exists and give up if not - a genuinely flat function has no
      // solution to find.
      const { lo, hi } = bracket
      if (!lo || !hi) {
        return { converged: false, value: best.x, result: best.fx + target, iterations, reason: 'flat' }
      }
      next = (lo.x + hi.x) / 2
    } else {
      next = x1 - f1 * ((x1 - x0) / slope)
      // Secant can step anywhere, including outside a bracket we already
      // trust. Bisect instead when it does.
      const { lo, hi } = bracket
      const outside = !Number.isFinite(next) ||
        (lo !== null && hi !== null && (next < Math.min(lo.x, hi.x) || next > Math.max(lo.x, hi.x)))
      if (outside) next = lo && hi ? (lo.x + hi.x) / 2 : clamp(next)
    }

    next = clamp(next)
    if (next === x1) {
      // Clamped against a bound and cannot move.
      return {
        converged: false, value: best.x, result: best.fx + target, iterations,
        reason: Number.isFinite(min) || Number.isFinite(max) ? 'outOfBounds' : 'flat',
      }
    }

    const fNext = f(next)
    if (fNext === null) {
      return { converged: false, value: best.x, result: best.fx + target, iterations, reason: 'notNumeric' }
    }

    if (Math.abs(fNext) < Math.abs(best.fx)) best = { x: next, fx: fNext }
    noteBracket({ x: x1, fx: f1 }, { x: next, fx: fNext })

    x0 = x1
    f0 = f1
    x1 = next
    f1 = fNext
  }

  if (Math.abs(f1) <= tolerance) {
    return { converged: true, value: x1, result: f1 + target, iterations }
  }
  return {
    converged: false, value: best.x, result: best.fx + target,
    iterations, reason: 'maxIterations',
  }
}

/** What `goalSeekCell` needs of a workbook. */
export type GoalSeekSheet = {
  getRaw(sheet: string, row: number, col: number): string
  setRaw(sheet: string, row: number, col: number, text: string): void
  getValue(sheet: string, row: number, col: number): unknown
}

export type CellAddress = { sheet: string; row: number; col: number }

/**
 * Goal Seek over a workbook: change `input` until `formula` reads `target`.
 *
 * The input cell is RESTORED before returning, whatever the outcome. The
 * solver writes to it dozens of times while searching, and leaving the last
 * probe behind would be worse than not running: Excel shows you the answer
 * and asks before keeping it, which it cannot do if the sheet has already
 * moved. Apply `result.value` yourself once the user says yes.
 */
export function goalSeekCell(
  book: GoalSeekSheet,
  formula: CellAddress,
  input: CellAddress,
  target: number,
  options: GoalSeekOptions = {},
): GoalSeekResult {
  const original = book.getRaw(input.sheet, input.row, input.col)
  const startText = original.trim()
  const start = Number(startText)

  try {
    return goalSeek(
      (x) => {
        book.setRaw(input.sheet, input.row, input.col, String(x))
        return book.getValue(formula.sheet, formula.row, formula.col)
      },
      target,
      Number.isFinite(start) ? start : 0,
      options,
    )
  } finally {
    book.setRaw(input.sheet, input.row, input.col, original)
  }
}
