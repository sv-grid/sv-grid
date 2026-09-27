/**
 * The special functions every statistical distribution is built out of:
 * the log gamma, the two regularised incomplete integrals, and the error
 * function that falls out of the first of them.
 *
 * Not exported from the package. Distributions call these; nothing else
 * should need them.
 *
 * Accuracy is the point here rather than speed. A spreadsheet evaluates one
 * of these per cell, not per frame, and a model that disagrees with Excel
 * in the fourth decimal is a support ticket. Every routine below iterates
 * to a relative tolerance well inside the fifteen digits a double carries,
 * so the answers round to Excel's published examples.
 */

/** Lanczos g = 7, n = 9. Good to about fifteen digits over the half plane. */
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028,
  771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
]

/** log(gamma(x)) for x > 0. Reflection carries the negative half. */
export function lgamma(x: number): number {
  if (x < 0.5) {
    // Reflection: gamma(x) gamma(1-x) = pi / sin(pi x)
    return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x)
  }
  const z = x - 1
  let a = LANCZOS[0]!
  const t = z + 7.5
  for (let i = 1; i < 9; i += 1) a += LANCZOS[i]! / (z + i)
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a)
}

/** gamma(x) itself, sign included, for the places Excel exposes it. */
export function gammaFn(x: number): number {
  if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * gammaFn(1 - x))
  return Math.exp(lgamma(x))
}

const ITMAX = 300
const EPS = 1e-15
const FPMIN = 1e-300

/** P(a, x) by its series, which converges quickly while x < a + 1. */
function gammaSeries(a: number, x: number): number {
  let ap = a
  let sum = 1 / a
  let del = sum
  for (let n = 0; n < ITMAX; n += 1) {
    ap += 1
    del *= x / ap
    sum += del
    if (Math.abs(del) < Math.abs(sum) * EPS) break
  }
  return sum * Math.exp(-x + a * Math.log(x) - lgamma(a))
}

/** Q(a, x) by its continued fraction, which takes over once x >= a + 1. */
function gammaContinued(a: number, x: number): number {
  let b = x + 1 - a
  let c = 1 / FPMIN
  let d = 1 / b
  let h = d
  for (let i = 1; i <= ITMAX; i += 1) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = b + an / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h
}

/** The regularised lower incomplete gamma, P(a, x), in [0, 1]. */
export function gammaP(a: number, x: number): number {
  if (x <= 0 || a <= 0) return 0
  return x < a + 1 ? gammaSeries(a, x) : 1 - gammaContinued(a, x)
}

/** The regularised upper incomplete gamma, Q(a, x) = 1 - P(a, x). */
export function gammaQ(a: number, x: number): number {
  if (x <= 0 || a <= 0) return 1
  return x < a + 1 ? 1 - gammaSeries(a, x) : gammaContinued(a, x)
}

/** The continued fraction behind the incomplete beta, by Lentz's method. */
function betaContinued(a: number, b: number, x: number): number {
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= ITMAX; m += 1) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}

/** The regularised incomplete beta, I_x(a, b), in [0, 1]. */
export function betaI(a: number, b: number, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const front = Math.exp(
    lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  )
  // The fraction converges fast on one side of the mode only; past it the
  // symmetry I_x(a, b) = 1 - I_(1-x)(b, a) puts us back on the fast side.
  return x < (a + 1) / (a + b + 2)
    ? (front * betaContinued(a, b, x)) / a
    : 1 - (front * betaContinued(b, a, 1 - x)) / b
}

/** The error function, which is P(1/2, x^2) carrying x's sign. */
export function erf(x: number): number {
  return x < 0 ? -gammaP(0.5, x * x) : gammaP(0.5, x * x)
}

/** The complementary error function, taken from Q where that is the
 *  accurate half, so erfc(20) does not cancel to zero. */
export function erfc(x: number): number {
  return x < 0 ? 1 + gammaP(0.5, x * x) : gammaQ(0.5, x * x)
}

/** The standard normal's cumulative distribution. */
export function normalCdf(z: number): number {
  return 0.5 * erfc(-z / Math.SQRT2)
}

/** The standard normal's density. */
export function normalPdf(z: number): number {
  return Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI)
}

/**
 * Invert a cumulative distribution by bisection over a bracket that is
 * widened until it holds the answer.
 *
 * Bisection rather than Newton on purpose: every distribution here is
 * monotone in x, so bisection cannot diverge, and fifty rounds already
 * carries more digits than a spreadsheet shows. A Newton step would be
 * quicker and would need a derivative per distribution and a fallback for
 * the flat tails, which is three ways to be subtly wrong for no gain.
 */
export function invertCdf(
  cdf: (x: number) => number,
  p: number,
  lo: number,
  hi: number,
): number {
  let a = lo
  let b = hi
  // Widen, in case the caller's bracket was optimistic.
  for (let i = 0; i < 200 && cdf(b) < p; i += 1) b = b === 0 ? 1 : b * 2
  for (let i = 0; i < 200 && cdf(a) > p; i += 1) a = a === 0 ? -1 : a * 2
  for (let i = 0; i < 200; i += 1) {
    const mid = (a + b) / 2
    if (b - a < Math.abs(mid) * 1e-14 + 1e-300) return mid
    if (cdf(mid) < p) a = mid
    else b = mid
  }
  return (a + b) / 2
}
