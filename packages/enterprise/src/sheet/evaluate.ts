/**
 * The evaluator.
 *
 * Errors travel as VALUES once evaluation finishes, but as thrown
 * `FormulaError`s while it runs. That split is deliberate: a coercion buried
 * three calls deep inside a function needs to abort the whole expression, and
 * threading a result type through every branch of every builtin would swamp the
 * table. The throw is caught here, at the one boundary, and becomes a value.
 *
 * Four functions never reach the table because they must NOT have every
 * argument evaluated first: IF and IFS pick a branch, IFERROR needs to catch,
 * and SWITCH matches before evaluating. Evaluating both branches of an IF is
 * not just wasted work - `=IF(A1=0, 0, 100/A1)` would raise #DIV/0! from the
 * branch it did not take.
 */
import {
  FormulaError, isError, err,
  type CellValue, type Node,
} from './ast'
import { toNumber, toBool, toText, looseEquals, compare } from './coerce'
import { withCustomFunctions, type SheetFunction, type FnArgs } from './functions'
import type { CellRef } from './address'
import {
  resolveTableRange, columnIndexOf,
  type TableRegion, type TableSpecifier,
} from './tables'

export type EvalContext = {
  /** Read one cell. Out of bounds should return `{ error: '#REF!' }`. */
  resolve(sheet: string | null, row: number, col: number): CellValue
  /** Last used row of a sheet, for open-ended whole-column ranges. */
  lastRow(sheet: string | null): number
  /** Resolve a defined name to a value, or undefined when there is no such
   *  name (which becomes #NAME?). */
  resolveName?(name: string): CellValue | undefined
  functions?: Record<string, SheetFunction>

  // ---- Structured references -----------------------------------------
  /** Look a table up by name. */
  findTable?(name: string): TableRegion | undefined
  /** The table containing the cell the formula lives in, which is the only
   *  way the unqualified `[@Amount]` form can mean anything. */
  tableAt?(sheet: string | null, row: number, col: number): TableRegion | undefined
  /** Where the formula being evaluated sits. Needed for `[@Column]`, which
   *  is relative to the formula rather than to the table. */
  currentCell?: { sheet: string | null; row: number; col: number }
}

function rangeGrid(from: CellRef, to: CellRef, ctx: EvalContext): CellValue[][] {
  const sheet = from.sheet ?? to.sheet
  const r1 = Math.min(from.row ?? 0, to.row ?? from.row ?? 0)
  const r2 = to.row === null || from.row === null
    ? ctx.lastRow(sheet)
    : Math.max(from.row, to.row)
  const c1 = Math.min(from.col, to.col)
  const c2 = Math.max(from.col, to.col)
  const out: CellValue[][] = []
  for (let r = r1; r <= r2; r += 1) {
    const row: CellValue[] = []
    for (let c = c1; c <= c2; c += 1) row.push(ctx.resolve(sheet, r, c))
    out.push(row)
  }
  return out
}

function binary(op: string, l: CellValue, r: CellValue): CellValue {
  switch (op) {
    case '+': return toNumber(l) + toNumber(r)
    case '-': return toNumber(l) - toNumber(r)
    case '*': return toNumber(l) * toNumber(r)
    case '/': {
      const d = toNumber(r)
      return d === 0 ? err('#DIV/0!') : toNumber(l) / d
    }
    case '^': return Math.pow(toNumber(l), toNumber(r))
    case '&': return toText(l) + toText(r)
    case '=': return looseEquals(l, r)
    case '<>': return !looseEquals(l, r)
    case '<': return compare(l, r) < 0
    case '>': return compare(l, r) > 0
    case '<=': return compare(l, r) <= 0
    case '>=': return compare(l, r) >= 0
    default: return err('#VALUE!')
  }
}

/** Functions handled before the table, because their arguments must not all
 *  be evaluated up front. */
const SHORT_CIRCUIT = new Set(['IF', 'IFS', 'IFERROR', 'IFNA', 'SWITCH'])

function evalNode(node: Node, ctx: EvalContext): CellValue {
  switch (node.k) {
    case 'num': return node.v
    case 'str': return node.v
    case 'bool': return node.v

    case 'ref':
      return ctx.resolve(node.ref.sheet, node.ref.row ?? 0, node.ref.col)

    case 'range': {
      // A range in scalar position collapses to its top-left cell, which is
      // what Excel does outside an array context.
      const grid = rangeGrid(node.from, node.to, ctx)
      return grid[0]?.[0] ?? ''
    }

    case 'name': {
      const v = ctx.resolveName?.(node.name)
      return v === undefined ? err('#NAME?') : v
    }

    case 'unary': {
      const v = evalNode(node.arg, ctx)
      if (isError(v)) return v
      if (node.op === '-') return -toNumber(v)
      if (node.op === '%') return toNumber(v) / 100
      return toNumber(v)
    }

    case 'binary': {
      const l = evalNode(node.left, ctx)
      if (isError(l)) return l
      const r = evalNode(node.right, ctx)
      if (isError(r)) return r
      return binary(node.op, l, r)
    }

    case 'table':
      return evalTableRef(node, ctx)

    case 'fn':
      return evalCall(node, ctx)
  }
}

/**
 * Turn a structured reference into a rectangle and read it.
 *
 * Every failure here is #REF! rather than a throw, because a table reference
 * naming a column that was renamed is an ordinary thing to find in a sheet,
 * and one broken total should not take the rest of the workbook with it.
 */
function tableRectOf(
  node: Extract<Node, { k: 'table' }>,
  ctx: EvalContext,
): { sheet: string; firstRow: number; lastRow: number; firstCol: number; lastCol: number } | null {
  const here = ctx.currentCell
  const table = node.table
    ? ctx.findTable?.(node.table)
    : here
      ? ctx.tableAt?.(here.sheet, here.row, here.col)
      : undefined
  if (!table) return null

  const headerAt = (sheet: string, row: number, col: number): string => {
    const v = ctx.resolve(sheet, row, col)
    return isError(v) ? '' : toText(v)
  }

  let columns: { from: number; to: number } | null = null
  if (node.column !== null) {
    const from = columnIndexOf(table, node.column, headerAt)
    if (from < 0) return null
    const to = node.columnTo != null
      ? columnIndexOf(table, node.columnTo, headerAt)
      : from
    if (to < 0) return null
    columns = { from: Math.min(from, to), to: Math.max(from, to) }
  }

  return resolveTableRange(
    table,
    node.specifier as TableSpecifier,
    columns,
    here ? here.row : null,
  )
}

function evalTableRef(
  node: Extract<Node, { k: 'table' }>,
  ctx: EvalContext,
): CellValue {
  const rect = tableRectOf(node, ctx)
  if (!rect) return err('#REF!')
  // Scalar position collapses to the top-left, the same as an A1 range.
  return ctx.resolve(rect.sheet, rect.firstRow, rect.firstCol)
}

/** Every cell of a structured reference, for the aggregate functions. */
function tableGrid(
  node: Extract<Node, { k: 'table' }>,
  ctx: EvalContext,
): CellValue[][] | null {
  const rect = tableRectOf(node, ctx)
  if (!rect) return null
  const out: CellValue[][] = []
  for (let r = rect.firstRow; r <= rect.lastRow; r += 1) {
    const line: CellValue[] = []
    for (let c = rect.firstCol; c <= rect.lastCol; c += 1) line.push(ctx.resolve(rect.sheet, r, c))
    out.push(line)
  }
  return out
}

/** Functions whose arguments must not all be evaluated up front. */
function evalCall(
  node: Extract<Node, { k: 'fn' }>,
  ctx: EvalContext,
): CellValue {
  const { name, args } = node

  // Every short-circuiting function below indexes its arguments directly.
  // `=IF()` parses fine, so without this the index is undefined and the
  // TypeError escapes the boundary this module promises never to throw past.
  if (SHORT_CIRCUIT.has(name) && args.length === 0) return err('#VALUE!')

  if (name === 'IF') {
    const cond = evalNode(args[0]!, ctx)
    if (isError(cond)) return cond
    const branch = toBool(cond) ? args[1] : args[2]
    if (!branch) return toBool(cond)
    return evalNode(branch, ctx)
  }

  if (name === 'IFERROR' || name === 'IFNA') {
    try {
      const v = evalNode(args[0]!, ctx)
      if (!isError(v)) return v
      if (name === 'IFNA' && v.error !== '#N/A') return v
    } catch (e) {
      if (!(e instanceof FormulaError)) throw e
      if (name === 'IFNA' && e.code !== '#N/A') return err(e.code)
    }
    return args[1] ? evalNode(args[1], ctx) : err('#N/A')
  }

  if (name === 'IFS') {
    for (let i = 0; i + 1 < args.length; i += 2) {
      const cond = evalNode(args[i]!, ctx)
      if (isError(cond)) return cond
      if (toBool(cond)) return evalNode(args[i + 1]!, ctx)
    }
    return err('#N/A')
  }

  if (name === 'SWITCH') {
    const subject = evalNode(args[0]!, ctx)
    if (isError(subject)) return subject
    let i = 1
    for (; i + 1 < args.length; i += 2) {
      const candidate = evalNode(args[i]!, ctx)
      if (isError(candidate)) return candidate
      if (looseEquals(subject, candidate)) return evalNode(args[i + 1]!, ctx)
    }
    // A trailing odd argument is the default.
    return i < args.length ? evalNode(args[i]!, ctx) : err('#N/A')
  }

  const table = ctx.functions ?? withCustomFunctions(undefined)
  const fn = table[name]
  if (!fn) return err('#NAME?')

  // Evaluate every argument, keeping range shape for the lookups that need it.
  const perArg: CellValue[][] = []
  const grids: Array<CellValue[][] | null> = []
  for (const arg of args) {
    if (arg.k === 'range') {
      const grid = rangeGrid(arg.from, arg.to, ctx)
      grids.push(grid)
      perArg.push(grid.flat())
    } else if (arg.k === 'table') {
      // A structured reference expands exactly as a range does, which is
      // what makes =SUM(Orders[Amount]) work.
      const grid = tableGrid(arg, ctx)
      if (!grid) {
        grids.push(null)
        perArg.push([err('#REF!')])
      } else {
        grids.push(grid)
        perArg.push(grid.flat())
      }
    } else {
      grids.push(null)
      perArg.push([evalNode(arg, ctx)])
    }
  }

  const flat = perArg.flat()
  // An error anywhere in the arguments propagates, except for the counting
  // functions, which Excel lets see errors in their range.
  if (name !== 'COUNTA' && name !== 'COUNTBLANK') {
    for (const v of flat) if (isError(v)) return v
  }

  const payload: FnArgs = { flat, args: perArg, grids }
  return fn(payload)
}

/**
 * Evaluate a parsed formula. Never throws: a `FormulaError` raised anywhere
 * inside becomes the matching error value.
 */
export function evaluate(node: Node, ctx: EvalContext): CellValue {
  try {
    return evalNode(node, ctx)
  } catch (e) {
    if (e instanceof FormulaError) return err(e.code)
    if (e instanceof RangeError) return err('#NUM!')
    // Last resort. This module promises callers it never throws, and a cell
    // showing #VALUE! is recoverable where an exception out of a render pass
    // is not.
    if (e instanceof TypeError) return err('#VALUE!')
    throw e
  }
}

/** Render a computed value the way a cell shows it. */
export function formatValue(v: CellValue): string {
  if (isError(v)) return v.error
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '#NUM!'
    return String(v)
  }
  return String(v)
}
