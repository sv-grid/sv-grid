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
import { ARRAY_FUNCTIONS, type Grid } from './packs/array'
import { colToLetters, type CellRef } from './address'
import { parseFormula } from './parse'
import {
  resolveTableRange, columnIndexOf,
  type TableRegion, type TableSpecifier,
} from './tables'

export type EvalContext = {
  /** Read one cell. Out of bounds should return `{ error: '#REF!' }`. */
  resolve(sheet: string | null, row: number, col: number): CellValue
  /** Last used row of a sheet, for open-ended whole-column ranges. */
  lastRow(sheet: string | null): number
  /**
   * Resolve a defined name to the reference it stands for, or null when
   * there is no such name. The node is evaluated in place of the name, so a
   * name that refers to a range behaves as that range: `=SUM(Sales)` adds
   * the whole column and `=VLOOKUP(x, Prices, 2)` searches the whole table.
   * Preferred over `resolveName`, which can only ever produce one value.
   */
  resolveNameNode?(name: string): Node | null
  /** Resolve a defined name to a single value. Consulted when
   *  `resolveNameNode` is absent or returns null; undefined is #NAME?. */
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
const SHORT_CIRCUIT = new Set(['IF', 'IFS', 'IFERROR', 'IFNA', 'SWITCH', 'ISERROR', 'ISERR', 'ISNA'])

/** Functions that PRODUCE a reference rather than a value. In scalar position
 *  they read as their top-left cell, as a range does; as an argument they
 *  expand to the range, so =SUM(OFFSET(A1,0,0,3,1)) adds three cells. */
const REFERENCE_FUNCTIONS = new Set(['OFFSET', 'INDIRECT'])

/** A rectangle on a sheet, what a reference function works out. */
type RefRect = { sheet: string | null; r1: number; c1: number; r2: number; c2: number }

/**
 * The rectangle a node stands for: a cell, a range (open-ended ones closed
 * at the last used row), a name that refers to one, or a reference
 * function's result. Null for anything that is a plain value.
 */
function referenceOf(node: Node, ctx: EvalContext): RefRect | null {
  switch (node.k) {
    case 'ref':
      return { sheet: node.ref.sheet, r1: node.ref.row ?? 0, c1: node.ref.col, r2: node.ref.row ?? 0, c2: node.ref.col }
    case 'range': {
      const sheet = node.from.sheet ?? node.to.sheet
      const r1 = Math.min(node.from.row ?? 0, node.to.row ?? node.from.row ?? 0)
      const r2 = node.to.row === null || node.from.row === null ? ctx.lastRow(sheet) : Math.max(node.from.row, node.to.row)
      return { sheet, r1, c1: Math.min(node.from.col, node.to.col), r2, c2: Math.max(node.from.col, node.to.col) }
    }
    case 'name': {
      const target = nameTarget(node.name, ctx)
      return target ? referenceOf(target, ctx) : null
    }
    case 'fn':
      return REFERENCE_FUNCTIONS.has(node.name) ? referenceCall(node, ctx) : null
    default:
      return null
  }
}

function rectGrid(rect: RefRect, ctx: EvalContext): CellValue[][] {
  return rangeGrid(
    { sheet: rect.sheet, row: rect.r1, col: rect.c1, rowAbs: false, colAbs: false },
    { sheet: rect.sheet, row: rect.r2, col: rect.c2, rowAbs: false, colAbs: false },
    ctx,
  )
}

const scalarArg = (node: Node | undefined, ctx: EvalContext): CellValue => (node ? evalNode(node, ctx) : '')
const optNumber = (node: Node | undefined, ctx: EvalContext, fallback: number): number => {
  if (!node || node.k === 'empty') return fallback
  const v = evalNode(node, ctx)
  if (isError(v)) throw new FormulaError(v.error)
  return v === '' ? fallback : toNumber(v)
}

/** OFFSET and INDIRECT: the rectangle they name, or a throw for the error. */
function referenceCall(node: Extract<Node, { k: 'fn' }>, ctx: EvalContext): RefRect {
  const { name, args } = node
  if (name === 'INDIRECT') {
    const text = scalarArg(args[0], ctx)
    if (isError(text)) throw new FormulaError(text.error)
    const a1 = args[1] && args[1].k !== 'empty' ? toBool(evalNode(args[1], ctx)) : true
    if (!a1) throw new FormulaError('#REF!')
    let parsed: Node
    try {
      parsed = parseFormula(`=${toText(text).trim()}`)
    } catch {
      throw new FormulaError('#REF!')
    }
    const rect = parsed.k === 'ref' || parsed.k === 'range' || parsed.k === 'name' ? referenceOf(parsed, ctx) : null
    if (!rect) throw new FormulaError('#REF!')
    return rect
  }
  // OFFSET(reference, rows, cols, [height], [width])
  const base = args[0] ? referenceOf(args[0], ctx) : null
  if (!base) throw new FormulaError('#VALUE!')
  const rows = Math.trunc(optNumber(args[1], ctx, 0))
  const cols = Math.trunc(optNumber(args[2], ctx, 0))
  const height = Math.trunc(optNumber(args[3], ctx, base.r2 - base.r1 + 1))
  const width = Math.trunc(optNumber(args[4], ctx, base.c2 - base.c1 + 1))
  if (height <= 0 || width <= 0) throw new FormulaError('#REF!')
  const r1 = base.r1 + rows
  const c1 = base.c1 + cols
  if (r1 < 0 || c1 < 0) throw new FormulaError('#REF!')
  return { sheet: base.sheet, r1, c1, r2: r1 + height - 1, c2: c1 + width - 1 }
}

/** ROW, COLUMN and ADDRESS: about a reference, not its value. */
function positionCall(node: Extract<Node, { k: 'fn' }>, ctx: EvalContext): CellValue {
  const { name, args } = node
  if (name === 'ADDRESS') {
    const row = Math.trunc(toNumber(scalarArg(args[0], ctx)))
    const col = Math.trunc(toNumber(scalarArg(args[1], ctx)))
    const abs = Math.trunc(optNumber(args[2], ctx, 1))
    if (row < 1 || col < 1 || abs < 1 || abs > 4) return err('#VALUE!')
    const sheet = args[4] && args[4].k !== 'empty' ? toText(scalarArg(args[4], ctx)) : ''
    const rowText = `${abs === 1 || abs === 2 ? '$' : ''}${row}`
    const colText = `${abs === 1 || abs === 3 ? '$' : ''}${colToLetters(col - 1)}`
    const prefix = sheet ? (/^[A-Za-z_][A-Za-z0-9_]*$/.test(sheet) ? `${sheet}!` : `'${sheet.replace(/'/g, "''")}'!`) : ''
    return `${prefix}${colText}${rowText}`
  }
  const target = args[0] && args[0].k !== 'empty' ? referenceOf(args[0], ctx) : null
  if (!target) {
    const here = ctx.currentCell
    if (!here) return err('#VALUE!')
    return name === 'ROW' ? here.row + 1 : here.col + 1
  }
  return name === 'ROW' ? target.r1 + 1 : target.c1 + 1
}

function evalNode(node: Node, ctx: EvalContext): CellValue {
  switch (node.k) {
    case 'num': return node.v
    case 'str': return node.v
    case 'bool': return node.v
    case 'empty': return ''

    case 'ref':
      return ctx.resolve(node.ref.sheet, node.ref.row ?? 0, node.ref.col)

    case 'range': {
      // A range in scalar position collapses to its top-left cell, which is
      // what Excel does outside an array context.
      const grid = rangeGrid(node.from, node.to, ctx)
      return grid[0]?.[0] ?? ''
    }

    case 'name': {
      const target = nameTarget(node.name, ctx)
      if (target) return evalNode(target, ctx)
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

/**
 * The reference a defined name stands for, or null.
 *
 * A name may be defined as another name (`Sales` -> `Q3Sales`), so this
 * follows the chain. It stops after a handful of hops rather than walking a
 * circular definition forever: `A` -> `B` -> `A` is a mistake in the Name
 * Manager, and the formula that used it reads #NAME? rather than hanging.
 */
function nameTarget(name: string, ctx: EvalContext): Node | null {
  let node = ctx.resolveNameNode?.(name) ?? null
  for (let hops = 0; node && node.k === 'name'; hops += 1) {
    if (hops >= 8) return null
    node = ctx.resolveNameNode?.(node.name) ?? null
  }
  return node
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

  if (name === 'ISERROR' || name === 'ISERR' || name === 'ISNA') {
    let code: string | null = null
    try {
      const v = evalNode(args[0]!, ctx)
      if (isError(v)) code = v.error
    } catch (e) {
      if (!(e instanceof FormulaError)) throw e
      code = e.code
    }
    if (code === null) return false
    if (name === 'ISNA') return code === '#N/A'
    if (name === 'ISERR') return code !== '#N/A'
    return true
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

  if (name === 'ROW' || name === 'COLUMN' || name === 'ADDRESS') return positionCall(node, ctx)
  if (REFERENCE_FUNCTIONS.has(name)) {
    // In scalar position a reference collapses to its top-left cell.
    const rect = referenceCall(node, ctx)
    return ctx.resolve(rect.sheet, rect.r1, rect.c1)
  }

  if (ARRAY_FUNCTIONS[name]) {
    // In scalar position a grid reads as its top-left cell; the workbook
    // asks `evaluateSpill` for the whole of it.
    const grid = arrayCall(node, ctx)
    return Array.isArray(grid) ? grid[0]?.[0] ?? '' : grid
  }

  const table = ctx.functions ?? withCustomFunctions(undefined)
  const fn = table[name]
  if (!fn) return err('#NAME?')

  const { perArg, grids } = collectArgs(args, ctx)
  const flat = perArg.flat()
  // An error anywhere in the arguments propagates, except for the counting
  // functions, which Excel lets see errors in their range.
  if (name !== 'COUNTA' && name !== 'COUNTBLANK') {
    for (const v of flat) if (isError(v)) return v
  }

  const payload: FnArgs = { flat, args: perArg, grids }
  return fn(payload)
}

/** Whether a node stands for a grid: a range, an array or reference function, a name to one, or arithmetic over those. */
function hasArray(node: Node, ctx: EvalContext, depth = 0): boolean {
  switch (node.k) {
    case 'range': return true
    case 'name': { const target = depth < 8 ? nameTarget(node.name, ctx) : null; return target ? hasArray(target, ctx, depth + 1) : false }
    case 'fn': return REFERENCE_FUNCTIONS.has(node.name) || Boolean(ARRAY_FUNCTIONS[node.name])
    case 'binary': return hasArray(node.left, ctx, depth) || hasArray(node.right, ctx, depth)
    case 'unary': return hasArray(node.arg, ctx, depth)
    default: return false
  }
}

/**
 * A node as a grid, with Excel's broadcasting: a side that is one row, one
 * column or one cell stretches to the other's shape, and where both are
 * bigger and differ the cells past the shorter side are #N/A.
 */
function gridOf(node: Node, ctx: EvalContext): Grid {
  if (node.k === 'binary') {
    const l = gridOf(node.left, ctx)
    const r = gridOf(node.right, ctx)
    return broadcast(l, r, (a, b) => {
      if (isError(a)) return a
      if (isError(b)) return b
      try { return binary(node.op, a, b) } catch (e) { if (e instanceof FormulaError) return err(e.code); throw e }
    })
  }
  if (node.k === 'unary') {
    return gridOf(node.arg, ctx).map((row) => row.map((v) => {
      if (isError(v)) return v
      try { return node.op === '-' ? -toNumber(v) : node.op === '%' ? toNumber(v) / 100 : toNumber(v) } catch (e) { if (e instanceof FormulaError) return err(e.code); throw e }
    }))
  }
  const grid = rangeValues(node, ctx)
  return grid ?? [[evalNode(node, ctx)]]
}

function broadcast(l: Grid, r: Grid, op: (a: CellValue, b: CellValue) => CellValue): Grid {
  const lr = l.length, lc = l[0]?.length ?? 0
  const rr = r.length, rc = r[0]?.length ?? 0
  const rows = lr === 1 ? rr : rr === 1 ? lr : Math.max(lr, rr)
  const cols = lc === 1 ? rc : rc === 1 ? lc : Math.max(lc, rc)
  const pick = (g: Grid, gr: number, gc: number, i: number, j: number): CellValue => {
    const y = gr === 1 ? 0 : i
    const x = gc === 1 ? 0 : j
    if (y >= gr || x >= gc) return err('#N/A')
    return g[y]?.[x] ?? ''
  }
  return Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => op(pick(l, lr, lc, i, j), pick(r, rr, rc, i, j))))
}

/** An array function's answer: a grid, or a value where it had none to give. */
function arrayCall(node: Extract<Node, { k: 'fn' }>, ctx: EvalContext): Grid | CellValue {
  const { perArg, grids } = collectArgs(node.args, ctx)
  // Errors stay inside the array: FILTER and SORT carry an error cell
  // through as Excel does, and decide for themselves about the rest.
  return ARRAY_FUNCTIONS[node.name]!({ flat: perArg.flat(), args: perArg, grids })
}

/** Every argument evaluated, keeping range shape for the functions that need it. */
function collectArgs(args: ReadonlyArray<Node>, ctx: EvalContext): { perArg: CellValue[][]; grids: Array<CellValue[][] | null> } {
  const perArg: CellValue[][] = []
  const grids: Array<CellValue[][] | null> = []
  for (const given of args) {
    // A name stands for whatever it was defined as. Substituting the node
    // here, before the shape check, is what lets `Sales` in =SUM(Sales) be a
    // whole column rather than the top-left cell a scalar read would give.
    const arg = given.k === 'name' ? (nameTarget(given.name, ctx) ?? given) : given
    if (arg.k === 'range') {
      const grid = rangeGrid(arg.from, arg.to, ctx)
      grids.push(grid)
      perArg.push(grid.flat())
    } else if (arg.k === 'fn' && REFERENCE_FUNCTIONS.has(arg.name)) {
      // OFFSET and INDIRECT hand their whole rectangle to the caller, so
      // =SUM(OFFSET(A1,0,0,3,1)) adds three cells rather than one.
      const grid = rectGrid(referenceCall(arg, ctx), ctx)
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
    } else if (arg.k === 'fn' && ARRAY_FUNCTIONS[arg.name]) {
      // An array function nested in another hands over its grid, so
      // =SORT(FILTER(...)) and =SUM(SEQUENCE(10)) work.
      const grid = arrayCall(arg, ctx)
      if (Array.isArray(grid)) {
        grids.push(grid)
        perArg.push(grid.flat())
      } else {
        grids.push(null)
        perArg.push([grid])
      }
    } else if ((arg.k === 'binary' || arg.k === 'unary') && hasArray(arg, ctx)) {
      // Arithmetic over a range is a grid, cell by cell: the `B2:B9>3` a
      // FILTER takes, or `A1:A9*2` on its own.
      const grid = gridOf(arg, ctx)
      grids.push(grid)
      perArg.push(grid.flat())
    } else {
      grids.push(null)
      perArg.push([evalNode(arg, ctx)])
    }
  }
  return { perArg, grids }
}

/**
 * Evaluate a parsed formula. Never throws: a `FormulaError` raised anywhere
 * inside becomes the matching error value.
 */
/**
 * The values a node stands for as a grid: a range, a reference (one cell),
 * or a name that refers to either. Null for anything else, which is how a
 * caller tells "a list source that is a range" from "a formula".
 */
export function rangeValues(node: Node, ctx: EvalContext): CellValue[][] | null {
  try {
    if (node.k === 'range') return rangeGrid(node.from, node.to, ctx)
    if (node.k === 'ref') return [[ctx.resolve(node.ref.sheet, node.ref.row ?? 0, node.ref.col)]]
    if (node.k === 'name') {
      const target = nameTarget(node.name, ctx)
      return target ? rangeValues(target, ctx) : null
    }
    if (node.k === 'fn' && REFERENCE_FUNCTIONS.has(node.name)) return rectGrid(referenceCall(node, ctx), ctx)
    if (node.k === 'fn' && ARRAY_FUNCTIONS[node.name]) {
      const grid = arrayCall(node, ctx)
      return Array.isArray(grid) ? grid : [[grid]]
    }
    return null
  } catch (e) {
    if (e instanceof FormulaError) return [[err(e.code)]]
    throw e
  }
}

/**
 * The grid a formula spills, or null when it is a plain value: a range on
 * its own (`=A1:A5`), a name that refers to one, a reference function's
 * rectangle, or an array function's answer, when that is more than one
 * cell. A throw inside is the error the cell shows, and no spill.
 */
export function evaluateSpill(node: Node, ctx: EvalContext): Grid | null {
  try {
    let grid: Grid | null = null
    if (node.k === 'range' || node.k === 'name' || (node.k === 'fn' && (REFERENCE_FUNCTIONS.has(node.name) || ARRAY_FUNCTIONS[node.name]))) {
      grid = rangeValues(node, ctx)
    } else if ((node.k === 'binary' || node.k === 'unary') && hasArray(node, ctx)) {
      grid = gridOf(node, ctx)
    }
    if (!grid || (grid.length === 1 && (grid[0]?.length ?? 0) <= 1)) return null
    const width = grid.reduce((m, row) => Math.max(m, row.length), 0)
    return grid.map((row) => Array.from({ length: width }, (_, i) => row[i] ?? ''))
  } catch (e) {
    if (e instanceof FormulaError) return null
    throw e
  }
}

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
