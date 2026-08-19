/**
 * Expression evaluators - pure functions, no DOM. Predicate leaves delegate to
 * the grid's `applyExcelFilter` so operator semantics match the filter row
 * exactly; scalar maths and change detection are handled here.
 */
import { applyExcelFilter } from '@svgrid/grid/filtering'
import type {
  ChangeExpr,
  ComparisonOp,
  EvalContext,
  ExprRow,
  PredicateExpr,
  ScalarExpr,
} from './expression-types'

type Scalar = number | string | boolean | null

function readValue<TData>(ctx: EvalContext<TData>, row: TData, columnId: string): unknown {
  if (ctx.getValue) return ctx.getValue(row, columnId)
  return (row as Record<string, unknown>)?.[columnId]
}

/** Number coercion that returns NaN for blanks/non-numerics (never 0). */
function num(v: unknown): number {
  if (v == null || v === '') return NaN
  if (typeof v === 'boolean') return v ? 1 : 0
  return Number(v)
}

/** Loose value equality used by `changed` and `=` on non-numeric operands. */
function looseEqual(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true
  const na = num(a)
  const nb = num(b)
  if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb
  return String(a ?? '') === String(b ?? '')
}

const BUILTINS: Record<string, (args: Scalar[]) => Scalar> = {
  ABS: (a) => Math.abs(num(a[0])),
  ROUND: (a) => {
    const n = num(a[0])
    const d = a.length > 1 ? num(a[1]) : 0
    const f = 10 ** (Number.isFinite(d) ? d : 0)
    return Math.round(n * f) / f
  },
  FLOOR: (a) => Math.floor(num(a[0])),
  CEIL: (a) => Math.ceil(num(a[0])),
  MIN: (a) => Math.min(...a.map(num)),
  MAX: (a) => Math.max(...a.map(num)),
  IF: (a) => (truthy(a[0] ?? null) ? (a[1] ?? null) : (a[2] ?? null)),
  COALESCE: (a) => a.find((v) => v != null && v !== '') ?? null,
  CONCAT: (a) => a.map((v) => (v == null ? '' : String(v))).join(''),
  LOWER: (a) => String(a[0] ?? '').toLowerCase(),
  UPPER: (a) => String(a[0] ?? '').toUpperCase(),
  LEN: (a) => String(a[0] ?? '').length,
}

/** Names of the built-in scalar functions (for editor validation/autocomplete). */
export const BUILTIN_FUNCTION_NAMES: ReadonlyArray<string> = Object.keys(BUILTINS)

/** Whether `name` (any case) is a known built-in scalar function. */
export function isBuiltinFunction(name: string): boolean {
  return name.toUpperCase() in BUILTINS
}

function truthy(v: Scalar): boolean {
  if (typeof v === 'boolean') return v
  if (v == null || v === '') return false
  const n = num(v)
  return Number.isFinite(n) ? n !== 0 : true
}

/** Evaluate a scalar expression to a single value. */
export function evaluateScalar<TData = ExprRow>(
  expr: ScalarExpr,
  ctx: EvalContext<TData>,
): Scalar {
  switch (expr.kind) {
    case 'lit':
      return expr.value
    case 'col':
      return (readValue(ctx, ctx.row, expr.id) ?? null) as Scalar
    case 'neg':
      return -num(evaluateScalar(expr.expr, ctx))
    case 'bin': {
      const l = evaluateScalar(expr.left, ctx)
      const r = evaluateScalar(expr.right, ctx)
      if (expr.op === '+') {
        const ln = num(l)
        const rn = num(r)
        if (Number.isFinite(ln) && Number.isFinite(rn)) return ln + rn
        return String(l ?? '') + String(r ?? '')
      }
      const a = num(l)
      const b = num(r)
      switch (expr.op) {
        case '-':
          return a - b
        case '*':
          return a * b
        case '/':
          return b === 0 ? NaN : a / b
        case '%':
          return b === 0 ? NaN : a % b
        // Rules are authored at runtime, so an operator outside the union can
        // arrive from parsed JSON. Without this the switch falls out of its
        // case and into `case 'agg'`, reading agg fields off a binary node.
        default:
          return null
      }
    }
    case 'agg': {
      const rows = ctx.rows ?? [ctx.row]
      if (expr.fn === 'count') return rows.length
      const nums: number[] = []
      for (const row of rows) {
        const n = num(readValue(ctx, row, expr.column))
        if (Number.isFinite(n)) nums.push(n)
      }
      if (nums.length === 0) return expr.fn === 'sum' ? 0 : null
      switch (expr.fn) {
        case 'sum':
          return nums.reduce((s, n) => s + n, 0)
        case 'avg':
          return nums.reduce((s, n) => s + n, 0) / nums.length
        case 'min':
          return Math.min(...nums)
        case 'max':
          return Math.max(...nums)
        // Same here: falling through to `case 'func'` would call
        // `expr.name.toUpperCase()` on an agg node and throw.
        default:
          return null
      }
    }
    case 'func': {
      const name = expr.name.toUpperCase()
      const args = expr.args.map((a) => evaluateScalar(a, ctx))
      const fn = ctx.functions?.[name] ?? BUILTINS[name]
      return fn ? fn(args) : null
    }
  }
}

function compareScalar(a: Scalar, op: ComparisonOp, b: Scalar): boolean {
  switch (op) {
    case '=':
      return looseEqual(a, b)
    case '!=':
      return !looseEqual(a, b)
  }
  const na = num(a)
  const nb = num(b)
  const numeric = Number.isFinite(na) && Number.isFinite(nb)
  const x: number | string = numeric ? na : String(a ?? '')
  const y: number | string = numeric ? nb : String(b ?? '')
  switch (op) {
    case '>':
      return x > y
    case '<':
      return x < y
    case '>=':
      return x >= y
    case '<=':
      return x <= y
  }
}

/** Evaluate a predicate expression to a boolean for the context's row. */
export function evaluatePredicate<TData = ExprRow>(
  expr: PredicateExpr,
  ctx: EvalContext<TData>,
): boolean {
  switch (expr.kind) {
    case 'const':
      return expr.value
    case 'and':
      return expr.parts.every((p) => evaluatePredicate(p, ctx))
    case 'or':
      return expr.parts.some((p) => evaluatePredicate(p, ctx))
    case 'not':
      return !evaluatePredicate(expr.expr, ctx)
    case 'cmp':
      return applyExcelFilter(
        readValue(ctx, ctx.row, expr.column),
        { id: expr.column, operator: expr.op, value: expr.value, valueTo: expr.valueTo },
        { locale: ctx.locale },
      ) as boolean
    case 'scalarCmp':
      return compareScalar(
        evaluateScalar(expr.left, ctx),
        expr.op,
        evaluateScalar(expr.right, ctx),
      )
  }
}

/**
 * Evaluate a change expression - true when the value moved between `ctx.prev`
 * and `ctx.row` in the way the expression describes. Returns false when there
 * is no prior snapshot (nothing has changed yet).
 */
export function evaluateChange<TData = ExprRow>(
  expr: ChangeExpr,
  ctx: EvalContext<TData>,
): boolean {
  if (ctx.prev == null) return false
  const next = readValue(ctx, ctx.row, expr.column)
  const prev = readValue(ctx, ctx.prev, expr.column)
  switch (expr.kind) {
    case 'changed':
      return !looseEqual(prev, next)
    case 'delta': {
      const p = num(prev)
      const n = num(next)
      if (!Number.isFinite(p) || !Number.isFinite(n)) return false
      const d = expr.abs ? Math.abs(n - p) : n - p
      return compareScalar(d, expr.op, expr.value)
    }
    case 'percentChange': {
      const p = num(prev)
      const n = num(next)
      if (!Number.isFinite(p) || !Number.isFinite(n) || p === 0) return false
      const pc = ((n - p) / Math.abs(p)) * 100
      return compareScalar(expr.abs ? Math.abs(pc) : pc, expr.op, expr.value)
    }
    case 'crossed': {
      const p = num(prev)
      const n = num(next)
      if (!Number.isFinite(p) || !Number.isFinite(n)) return false
      return expr.direction === 'above'
        ? p < expr.threshold && n >= expr.threshold
        : p > expr.threshold && n <= expr.threshold
    }
  }
}
