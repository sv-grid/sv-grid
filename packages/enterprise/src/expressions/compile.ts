/**
 * Compile a predicate expression into a row predicate.
 *
 * `evaluate.ts` walks the AST for every row. That is fine for alert rules,
 * which run over a handful of changed rows, and wrong for a grid filter, which
 * runs over the whole dataset on every keystroke. This module does the walk
 * once and returns a closure tree.
 *
 * Two properties are load-bearing:
 *
 *   1. **Identical semantics.** Leaf comparisons go through the grid's own
 *      `compileExcelFilter`, the same code path the column-menu filter uses, so
 *      an advanced filter and a column filter agree by construction.
 *      `compile.test.ts` asserts the compiled result matches `evaluatePredicate`
 *      across a corpus, so the compiler's correctness is a consequence of the
 *      evaluator's rather than a parallel claim.
 *
 *   2. **Aggregates fold once.** `evaluateScalar`'s `agg` case rescans every row
 *      for every row, so `SUM(amount) > 1000` is O(N^2). Here the distinct
 *      aggregates are computed in a single pass up front and compiled to
 *      constants.
 */
import { compileExcelFilter } from '@svgrid/grid/filtering'
import type { PredicateExpr, ScalarExpr, ComparisonOp } from './expression-types'

type Scalar = number | string | boolean | null

export type CompileOptions<TRow> = {
  getValue: (row: TRow, columnId: string) => unknown
  locale?: string | ReadonlyArray<string>
  /** Rows the aggregates fold over. */
  rows: ReadonlyArray<TRow>
  functions?: Record<string, (args: Scalar[]) => Scalar>
}

const num = (v: unknown): number =>
  typeof v === 'number' ? v : v == null || v === '' ? NaN : Number(v)

const BUILTINS: Record<string, (a: Scalar[]) => Scalar> = {
  ABS: (a) => Math.abs(num(a[0])),
  ROUND: (a) => Math.round(num(a[0])),
  FLOOR: (a) => Math.floor(num(a[0])),
  CEIL: (a) => Math.ceil(num(a[0])),
  MIN: (a) => Math.min(...a.map(num)),
  MAX: (a) => Math.max(...a.map(num)),
  IF: (a) => (a[0] ? (a[1] ?? null) : (a[2] ?? null)),
  COALESCE: (a) => a.find((v) => v != null) ?? null,
  CONCAT: (a) => a.map((v) => (v == null ? '' : String(v))).join(''),
  LOWER: (a) => String(a[0] ?? '').toLowerCase(),
  UPPER: (a) => String(a[0] ?? '').toUpperCase(),
  LEN: (a) => String(a[0] ?? '').length,
}

/**
 * Fold every `agg` node in the tree to a constant, in ONE pass over the rows.
 * Returns a key -> value map; the key is `fn:column`.
 */
function foldAggregates<TRow>(expr: PredicateExpr, opts: CompileOptions<TRow>): Map<string, Scalar> {
  const wanted = new Set<string>()
  const columns = new Set<string>()

  const scanScalar = (s: ScalarExpr): void => {
    switch (s.kind) {
      case 'agg':
        wanted.add(`${s.fn}:${s.column}`)
        if (s.fn !== 'count') columns.add(s.column)
        break
      case 'neg':
        scanScalar(s.expr)
        break
      case 'bin':
        scanScalar(s.left)
        scanScalar(s.right)
        break
      case 'func':
        s.args.forEach(scanScalar)
        break
      default:
        break
    }
  }
  const scan = (p: PredicateExpr): void => {
    switch (p.kind) {
      case 'and':
      case 'or':
        p.parts.forEach(scan)
        break
      case 'not':
        scan(p.expr)
        break
      case 'scalarCmp':
        scanScalar(p.left)
        scanScalar(p.right)
        break
      default:
        break
    }
  }
  scan(expr)

  const out = new Map<string, Scalar>()
  if (wanted.size === 0) return out // overwhelmingly the common case

  // One pass, accumulating per column.
  const acc = new Map<string, { sum: number; n: number; min: number; max: number }>()
  for (const c of columns) acc.set(c, { sum: 0, n: 0, min: Infinity, max: -Infinity })
  for (const row of opts.rows) {
    for (const c of columns) {
      const n = num(opts.getValue(row, c))
      if (!Number.isFinite(n)) continue
      const a = acc.get(c)!
      a.sum += n
      a.n += 1
      if (n < a.min) a.min = n
      if (n > a.max) a.max = n
    }
  }

  for (const key of wanted) {
    const [fn, column] = key.split(/:(.*)/s) as [string, string]
    if (fn === 'count') {
      out.set(key, opts.rows.length)
      continue
    }
    const a = acc.get(column)
    // Matches evaluate.ts: an empty numeric set is 0 for sum, null otherwise.
    if (!a || a.n === 0) {
      out.set(key, fn === 'sum' ? 0 : null)
      continue
    }
    switch (fn) {
      case 'sum':
        out.set(key, a.sum)
        break
      case 'avg':
        out.set(key, a.sum / a.n)
        break
      case 'min':
        out.set(key, a.min)
        break
      case 'max':
        out.set(key, a.max)
        break
      default:
        out.set(key, null)
    }
  }
  return out
}

function compileScalarInternal<TRow>(
  expr: ScalarExpr,
  opts: CompileOptions<TRow>,
  aggs: Map<string, Scalar>,
): (row: TRow) => Scalar {
  switch (expr.kind) {
    case 'lit': {
      const v = expr.value
      return () => v
    }
    case 'col': {
      const id = expr.id
      return (row) => {
        const raw = opts.getValue(row, id)
        return (raw ?? null) as Scalar
      }
    }
    case 'neg': {
      const inner = compileScalarInternal(expr.expr, opts, aggs)
      return (row) => -num(inner(row))
    }
    case 'bin': {
      const l = compileScalarInternal(expr.left, opts, aggs)
      const r = compileScalarInternal(expr.right, opts, aggs)
      const op = expr.op
      return (row) => {
        const a = num(l(row))
        const b = num(r(row))
        switch (op) {
          case '+':
            return a + b
          case '-':
            return a - b
          case '*':
            return a * b
          case '/':
            return b === 0 ? NaN : a / b
          case '%':
            return b === 0 ? NaN : a % b
          default:
            return null
        }
      }
    }
    case 'agg': {
      // Already folded to a constant.
      const v = aggs.get(`${expr.fn}:${expr.column}`) ?? null
      return () => v
    }
    case 'func': {
      const name = expr.name.toUpperCase()
      const args = expr.args.map((a) => compileScalarInternal(a, opts, aggs))
      const fn = opts.functions?.[name] ?? BUILTINS[name]
      if (!fn) return () => null
      return (row) => fn(args.map((a) => a(row)))
    }
    default:
      return () => null
  }
}

function compareScalars(a: Scalar, op: ComparisonOp, b: Scalar): boolean {
  // Numeric when both sides look numeric, else string - mirrors evaluate.ts.
  const na = num(a)
  const nb = num(b)
  const numeric = Number.isFinite(na) && Number.isFinite(nb)
  const x: number | string = numeric ? na : String(a ?? '')
  const y: number | string = numeric ? nb : String(b ?? '')
  switch (op) {
    case '=':
      return x === y
    case '!=':
      return x !== y
    case '>':
      return x > y
    case '<':
      return x < y
    case '>=':
      return x >= y
    case '<=':
      return x <= y
    default:
      return false
  }
}

function compileInternal<TRow>(
  expr: PredicateExpr,
  opts: CompileOptions<TRow>,
  aggs: Map<string, Scalar>,
): (row: TRow) => boolean {
  switch (expr.kind) {
    case 'const': {
      const v = expr.value === true
      return () => v
    }
    case 'and': {
      const parts = expr.parts.map((p) => compileInternal(p, opts, aggs))
      if (parts.length === 0) return () => true
      return (row) => {
        for (const p of parts) if (!p(row)) return false
        return true
      }
    }
    case 'or': {
      const parts = expr.parts.map((p) => compileInternal(p, opts, aggs))
      if (parts.length === 0) return () => false
      return (row) => {
        for (const p of parts) if (p(row)) return true
        return false
      }
    }
    case 'not': {
      const inner = compileInternal(expr.expr, opts, aggs)
      return (row) => !inner(row)
    }
    case 'cmp': {
      // The needle-side work happens once, here.
      const test = compileExcelFilter(
        {
          id: expr.column,
          operator: expr.op,
          value: expr.value as never,
          valueTo: expr.valueTo as never,
        },
        { locale: opts.locale },
      )
      const column = expr.column
      return (row) => test(opts.getValue(row, column))
    }
    case 'scalarCmp': {
      const l = compileScalarInternal(expr.left, opts, aggs)
      const r = compileScalarInternal(expr.right, opts, aggs)
      const op = expr.op
      return (row) => compareScalars(l(row), op, r(row))
    }
    default:
      // Unknown node kind (hand-edited JSON): match nothing rather than throw.
      return () => false
  }
}

/** Compile a predicate. Returns null when the expression is unusable. */
export function compilePredicate<TRow>(
  expr: PredicateExpr,
  opts: CompileOptions<TRow>,
): ((row: TRow) => boolean) | null {
  try {
    const aggs = foldAggregates(expr, opts)
    return compileInternal(expr, opts, aggs)
  } catch {
    return null
  }
}

/** Compile a scalar expression on its own (aggregates folded over `opts.rows`). */
export function compileScalar<TRow>(
  expr: ScalarExpr,
  opts: CompileOptions<TRow>,
): (row: TRow) => Scalar {
  const aggs = foldAggregates({ kind: 'scalarCmp', left: expr, op: '=', right: expr }, opts)
  return compileScalarInternal(expr, opts, aggs)
}
