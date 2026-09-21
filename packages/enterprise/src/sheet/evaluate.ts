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
   * The rectangle a dynamic array anchored at (row, col) currently spills
   * into, as `[r1, c1, r2, c2]`, or null when that cell is not a spill
   * anchor. Backs the spilled-range operator `A1#`: without it the operator
   * reads #REF!, since only the workbook knows how far an array spilled.
   */
  spillRect?(sheet: string | null, row: number, col: number): readonly [number, number, number, number] | null
  /**
   * The sheets from `from` to `to` in tab order, inclusive, or null when
   * either name is unknown. Backs a 3D reference (`Sheet1:Sheet3!A1`), which
   * reads its cell on each of them.
   */
  sheetsBetween?(from: string, to: string): string[] | null
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

  // ---- LET and LAMBDA --------------------------------------------------
  // ---- What the sheet is not showing ----------------------------------
  /**
   * Whether a row is folded away, and by what: `'filter'` for an AutoFilter,
   * `'hand'` for Hide Rows, null for a row on the screen. Only `SUBTOTAL`
   * asks, and it is what tells its 1-11 codes from its 101-111 ones. A
   * consumer that hides nothing leaves this out.
   */
  hiddenRow?(sheet: string | null, row: number): 'filter' | 'hand' | null
  /**
   * Whether a cell holds a `SUBTOTAL` of its own. Excel's SUBTOTAL skips
   * those, so a grand total over a column of subtotals counts each row once
   * rather than twice.
   */
  isSubtotal?(sheet: string | null, row: number, col: number): boolean

  /**
   * Names bound INSIDE the formula, by `LET` or by a lambda's parameters.
   * Looked up before the workbook's own names, which is what makes
   * `=LET(x, 2, x * 3)` mean 6 on a sheet that also has a name `x`.
   * Copied rather than chained: a scope holds a handful of names, and a
   * flat map is faster to read than a chain is to walk.
   */
  locals?: ReadonlyMap<string, LocalBinding>
}

/** A lambda, closed over the scope it was written in. */
export type Lambda = {
  readonly lambda: true
  params: string[]
  body: Node
  scope: ReadonlyMap<string, LocalBinding> | undefined
}

/** What a name bound inside a formula can hold: a value, a grid, a lambda. */
export type LocalBinding = CellValue | Grid | Lambda

const isLambda = (v: LocalBinding | undefined): v is Lambda =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && 'lambda' in v

const isGrid = (v: LocalBinding | undefined): v is Grid => Array.isArray(v)

/** The names a lambda helper takes its function in. */
const LAMBDA_HELPERS = new Set(['MAP', 'BYROW', 'BYCOL', 'REDUCE', 'SCAN', 'MAKEARRAY'])

/** A local binding, by name, case-insensitively as Excel reads a name. */
function localOf(ctx: EvalContext, name: string): LocalBinding | undefined {
  return ctx.locals?.get(name.toUpperCase())
}

/** The same context with more names bound over it. */
function withLocals(ctx: EvalContext, added: ReadonlyArray<[string, LocalBinding]>): EvalContext {
  const next = new Map(ctx.locals ?? [])
  for (const [name, value] of added) next.set(name.toUpperCase(), value)
  return { ...ctx, locals: next }
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
    case 'table': {
      // A structured reference is a rectangle too, so SUBTOTAL(109,[Qty])
      // in a totals row skips the rows a filter folds, as Excel's does,
      // rather than reading the column's first cell as a scalar.
      const rect = tableRectOf(node, ctx)
      return rect ? { sheet: rect.sheet, r1: rect.firstRow, c1: rect.firstCol, r2: rect.lastRow, c2: rect.lastCol } : null
    }
    case 'spill':
      return spillRectOf(node, ctx)
    default:
      return null
  }
}

/**
 * The rectangle a spilled-range operator (`A1#`) stands for: the array the
 * anchor currently spills. Null when the cell is not a spill anchor, which
 * the callers turn into #REF!, the way Excel does for `A1#` on a cell that
 * holds no dynamic array.
 */
function spillRectOf(node: Extract<Node, { k: 'spill' }>, ctx: EvalContext): RefRect | null {
  const rect = ctx.spillRect?.(node.ref.sheet, node.ref.row ?? 0, node.ref.col)
  return rect ? { sheet: node.ref.sheet, r1: rect[0], c1: rect[1], r2: rect[2], c2: rect[3] } : null
}

/**
 * Every value a 3D reference reads: the cell or rectangle on each sheet in
 * the tab range, in sheet order. Null when a sheet name is unknown, which the
 * callers turn into #REF!. Aggregates take the flat list, so a nested
 * rectangle spans sheet by sheet.
 */
function values3d(node: Extract<Node, { k: 'ref3d' }>, ctx: EvalContext): CellValue[] | null {
  const sheets = ctx.sheetsBetween?.(node.sheetFrom, node.sheetTo)
  if (!sheets) return null
  const r1 = Math.min(node.from.row ?? 0, node.to.row ?? 0)
  const r2 = Math.max(node.from.row ?? 0, node.to.row ?? 0)
  const c1 = Math.min(node.from.col, node.to.col)
  const c2 = Math.max(node.from.col, node.to.col)
  const out: CellValue[] = []
  for (const s of sheets) {
    for (let r = r1; r <= r2; r += 1) {
      for (let c = c1; c <= c2; c += 1) out.push(ctx.resolve(s, r, c))
    }
  }
  return out
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
    case 'err': return err(node.v)
    case 'empty': return ''

    case 'ref':
      return ctx.resolve(node.ref.sheet, node.ref.row ?? 0, node.ref.col)

    case 'range': {
      // A range in scalar position collapses to its top-left cell, which is
      // what Excel does outside an array context.
      const grid = rangeGrid(node.from, node.to, ctx)
      return grid[0]?.[0] ?? ''
    }

    case 'spill': {
      // The spilled range in scalar position is its top-left, the anchor's
      // own value; a cell that anchors no array is #REF!.
      const rect = spillRectOf(node, ctx)
      return rect ? ctx.resolve(rect.sheet, rect.r1, rect.c1) : err('#REF!')
    }

    case 'ref3d': {
      // In scalar position a 3D reference reads the cell on the first sheet
      // of the range, the way an ordinary range collapses to its top-left.
      const vals = values3d(node, ctx)
      if (!vals) return err('#REF!')
      return vals[0] ?? ''
    }

    case 'name': {
      // A name bound inside the formula wins over the workbook's own, which
      // is what makes `=LET(x, 2, x * 3)` mean 6 on a sheet that has an `x`.
      const local = localOf(ctx, node.name)
      if (local !== undefined) {
        // A lambda that is never called is #CALC!, as Excel shows it; a
        // grid in scalar position reads as its top-left cell.
        if (isLambda(local)) return err('#CALC!')
        if (isGrid(local)) return local[0]?.[0] ?? ''
        return local
      }
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
export function tableRectOf(
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

/**
 * `SUBTOTAL(code, ref1, ...)`: the aggregate Excel's AutoFilter is built on.
 *
 * The code names the function - 1 AVERAGE, 2 COUNT, 3 COUNTA, 4 MAX, 5 MIN,
 * 6 PRODUCT, 7 STDEV, 8 STDEVP, 9 SUM, 10 VAR, 11 VARP - and a hundred more
 * means "and leave out the rows hidden by hand as well". A filtered-out row
 * is left out either way, which is what makes a total under a filtered list
 * follow the filter, and why a table's totals row is written with this
 * rather than with SUM. A cell holding a SUBTOTAL of its own is skipped, so
 * a grand total over subtotals counts each row once.
 */
const SUBTOTAL_FUNCTIONS: Record<number, string> = {
  1: 'AVERAGE', 2: 'COUNT', 3: 'COUNTA', 4: 'MAX', 5: 'MIN', 6: 'PRODUCT',
  7: 'STDEV', 8: 'STDEVP', 9: 'SUM', 10: 'VAR', 11: 'VARP',
}

function subtotalCall(node: Extract<Node, { k: 'fn' }>, ctx: EvalContext): CellValue {
  const first = node.args[0]
  if (!first) return err('#VALUE!')
  const codeValue = evalNode(first, ctx)
  if (isError(codeValue)) return codeValue
  const code = Math.trunc(toNumber(codeValue))
  const ignoreHandHidden = code > 100
  const fnName = SUBTOTAL_FUNCTIONS[ignoreHandHidden ? code - 100 : code]
  if (!fnName) return err('#VALUE!')
  const table = ctx.functions ?? withCustomFunctions(undefined)
  const fn = table[fnName]
  if (!fn) return err('#NAME?')

  const perArg: CellValue[][] = []
  for (const arg of node.args.slice(1)) {
    const rect = referenceOf(arg, ctx)
    if (!rect) {
      // A plain value or an expression: nothing is hidden about it.
      perArg.push([evalNode(arg, ctx)])
      continue
    }
    const values: CellValue[] = []
    for (let r = rect.r1; r <= rect.r2; r += 1) {
      const how = ctx.hiddenRow?.(rect.sheet, r) ?? null
      if (how === 'filter' || (how === 'hand' && ignoreHandHidden)) continue
      for (let c = rect.c1; c <= rect.c2; c += 1) {
        if (ctx.isSubtotal?.(rect.sheet, r, c)) continue
        values.push(ctx.resolve(rect.sheet, r, c))
      }
    }
    perArg.push(values)
  }
  const flat = perArg.flat()
  for (const v of flat) if (isError(v)) return v
  return fn({ flat, args: perArg, grids: perArg.map(() => null) })
}

function evalCall(
  node: Extract<Node, { k: 'fn' }>,
  ctx: EvalContext,
): CellValue {
  const { name, args } = node

  // Every short-circuiting function below indexes its arguments directly.
  // `=IF()` parses fine, so without this the index is undefined and the
  // TypeError escapes the boundary this module promises never to throw past.
  if (SHORT_CIRCUIT.has(name) && args.length === 0) return err('#VALUE!')

  // LET, LAMBDA and the helpers that take one see the AST rather than
  // evaluated arguments: a lambda IS its body, and a name bound by LET has
  // to exist before the expression that reads it is evaluated.
  if (name === 'LET') return evalLet(args, ctx)
  // The call the parser builds for `LAMBDA(x, x * 2)(5)`: the callee first,
  // then the arguments it is called with.
  if (name === '(') return scalarOf(bindingOf(node, ctx))
  if (name === 'LAMBDA') return err('#CALC!')
  if (LAMBDA_HELPERS.has(name)) {
    const grid = lambdaCall(node, ctx)
    return Array.isArray(grid) ? grid[0]?.[0] ?? '' : grid
  }
  // `=LET(double, LAMBDA(x, x * 2), double(21))`: a call on a name the
  // formula bound rather than on a function the library ships.
  const bound = localOf(ctx, name)
  if (isLambda(bound)) return applyLambda(bound, args.map((a) => bindingOf(a, ctx)), ctx)

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

  if (name === 'SUBTOTAL') return subtotalCall(node, ctx)

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
  // functions, which Excel lets see errors in their range, and TYPE, whose
  // whole job is to report that an error IS one (it answers 16).
  if (name !== 'COUNTA' && name !== 'COUNTBLANK' && name !== 'TYPE') {
    for (const v of flat) if (isError(v)) return v
  }

  const payload: FnArgs = { flat, args: perArg, grids }
  return fn(payload)
}

/**
 * `LET(name1, value1, [name2, value2, ...], calculation)`.
 *
 * Each value is evaluated in the scope built so far, so a later binding can
 * read an earlier one, and the calculation sees them all. A binding holds a
 * GRID where its expression is one, which is what lets `LET(r, A1:A9,
 * SUM(r))` add the range rather than its first cell.
 */
function evalLet(args: ReadonlyArray<Node>, ctx: EvalContext): CellValue {
  if (args.length < 3 || args.length % 2 === 0) return err('#VALUE!')
  let scope = ctx
  for (let i = 0; i + 1 < args.length - 1; i += 2) {
    const nameNode = args[i]!
    if (nameNode.k !== 'name') return err('#VALUE!')
    scope = withLocals(scope, [[nameNode.name, bindingOf(args[i + 1]!, scope)]])
  }
  const result = bindingOf(args[args.length - 1]!, scope)
  if (isLambda(result)) return err('#CALC!')
  if (isGrid(result)) return result[0]?.[0] ?? ''
  return result
}

/** The grid a LET's calculation stands for, or null when it is one value. */
function letGrid(args: ReadonlyArray<Node>, ctx: EvalContext): Grid | null {
  if (args.length < 3 || args.length % 2 === 0) return null
  let scope = ctx
  for (let i = 0; i + 1 < args.length - 1; i += 2) {
    const nameNode = args[i]!
    if (nameNode.k !== 'name') return null
    scope = withLocals(scope, [[nameNode.name, bindingOf(args[i + 1]!, scope)]])
  }
  const result = bindingOf(args[args.length - 1]!, scope)
  return isGrid(result) ? result : null
}

/** What a name is bound to: a lambda, a grid, or a plain value. */
function bindingOf(node: Node, ctx: EvalContext): LocalBinding {
  if (node.k === 'fn' && node.name === 'LAMBDA') return lambdaOf(node, ctx)
  if (node.k === 'fn' && node.name === '(') {
    const fn = lambdaArg(node.args[0], ctx)
    if (!fn) return err('#VALUE!')
    return callLambda(fn, node.args.slice(1).map((a) => bindingOf(a, ctx)), ctx)
  }
  if (node.k === 'fn') {
    const bound = localOf(ctx, node.name)
    if (isLambda(bound)) return callLambda(bound, node.args.map((a) => bindingOf(a, ctx)), ctx)
  }
  if (node.k === 'name') {
    const local = localOf(ctx, node.name)
    if (local !== undefined) return local
  }
  // Arithmetic over ranges is a grid too, cell by cell: `B2:B6 * D2:D6` is
  // what a REDUCE or a BYROW is usually handed.
  if ((node.k === 'binary' || node.k === 'unary') && hasArray(node, ctx)) return gridOf(node, ctx)
  const grid = hasArray(node, ctx) ? rangeValues(node, ctx) : null
  if (grid && (grid.length > 1 || (grid[0]?.length ?? 0) > 1)) return grid
  return evalNode(node, ctx)
}

/** The lambda a `LAMBDA(p1, ..., body)` node stands for, closed over `ctx`. */
function lambdaOf(node: Extract<Node, { k: 'fn' }>, ctx: EvalContext): Lambda | CellValue {
  const args = node.args
  if (args.length < 1) return err('#VALUE!')
  const params: string[] = []
  for (let i = 0; i < args.length - 1; i += 1) {
    const p = args[i]!
    if (p.k !== 'name') return err('#VALUE!')
    params.push(p.name)
  }
  return { lambda: true, params, body: args[args.length - 1]!, scope: ctx.locals }
}

/**
 * Call a lambda, keeping whatever it answers with: a value, a grid, or
 * another lambda, which is what a curried `LAMBDA(x, LAMBDA(y, x + y))`
 * gives back.
 */
function callLambda(fn: Lambda, values: ReadonlyArray<LocalBinding>, ctx: EvalContext): LocalBinding {
  // Excel is strict about the count: too few is #VALUE!, and so is too many.
  if (values.length !== fn.params.length) return err('#VALUE!')
  const scope = withLocals({ ...ctx, locals: fn.scope }, fn.params.map((p, i) => [p, values[i]!] as [string, LocalBinding]))
  return bindingOf(fn.body, scope)
}

/** The same, in a place that wants one value. */
function applyLambda(fn: Lambda, values: ReadonlyArray<LocalBinding>, ctx: EvalContext): CellValue {
  return scalarOf(callLambda(fn, values, ctx))
}

/** A binding where one value is wanted: a lambda is #CALC!, a grid its corner. */
function scalarOf(binding: LocalBinding): CellValue {
  if (isLambda(binding)) return err('#CALC!')
  if (isGrid(binding)) return binding[0]?.[0] ?? ''
  return binding
}

/** The lambda an argument names: written there, or bound to a name. */
function lambdaArg(node: Node | undefined, ctx: EvalContext): Lambda | null {
  if (!node) return null
  if (node.k === 'fn' && node.name === 'LAMBDA') {
    const made = lambdaOf(node, ctx)
    return isLambda(made) ? made : null
  }
  if (node.k === 'name') {
    const local = localOf(ctx, node.name)
    if (isLambda(local)) return local
    return null
  }
  // A call that answers with another lambda: `LAMBDA(x, LAMBDA(y, x + y))(2)`.
  if (node.k === 'fn' && (node.name === '(' || isLambda(localOf(ctx, node.name)))) {
    const made = bindingOf(node, ctx)
    return isLambda(made) ? made : null
  }
  return null
}

/** An argument as a grid, one cell wide where it is a plain value. */
function gridArgOf(node: Node | undefined, ctx: EvalContext): Grid {
  if (!node) return [['']]
  const binding = bindingOf(node, ctx)
  if (isGrid(binding)) return binding
  if (isLambda(binding)) return [[err('#CALC!')]]
  return [[binding]]
}

/**
 * Excel's lambda helpers, which is where a lambda earns its keep:
 *
 *   MAP(array, ..., fn)        every cell through the function
 *   BYROW(array, fn)           one answer per row, as a column
 *   BYCOL(array, fn)           one answer per column, as a row
 *   REDUCE(init, array, fn)    folded to one value, accumulator first
 *   SCAN(init, array, fn)      the same, keeping every step
 *   MAKEARRAY(rows, cols, fn)  built from the row and column numbers
 */
function lambdaCall(node: Extract<Node, { k: 'fn' }>, ctx: EvalContext): Grid | CellValue {
  const { name, args } = node
  const fn = lambdaArg(args[args.length - 1], ctx)
  if (!fn) return err('#VALUE!')

  if (name === 'MAKEARRAY') {
    const rows = Math.trunc(toNumber(evalNode(args[0] ?? { k: 'num', v: 0 }, ctx)))
    const cols = Math.trunc(toNumber(evalNode(args[1] ?? { k: 'num', v: 0 }, ctx)))
    if (!(rows > 0) || !(cols > 0)) return err('#VALUE!')
    if (rows * cols > 1_000_000) return err('#NUM!')
    return Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => applyLambda(fn, [r + 1, c + 1], ctx)))
  }

  if (name === 'MAP') {
    const grids = args.slice(0, -1).map((a) => gridArgOf(a, ctx))
    if (!grids.length) return err('#VALUE!')
    const rows = grids[0]!.length
    const cols = grids[0]![0]?.length ?? 0
    // Every array has to be the same shape, as Excel asks.
    for (const g of grids) if (g.length !== rows || (g[0]?.length ?? 0) !== cols) return err('#VALUE!')
    return Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => applyLambda(fn, grids.map((g) => g[r]?.[c] ?? ''), ctx)))
  }

  if (name === 'BYROW' || name === 'BYCOL') {
    const grid = gridArgOf(args[0], ctx)
    if (name === 'BYROW') {
      // Each row goes in as a grid one row tall, and the answers come back
      // as a column, which is the shape Excel spills.
      return grid.map((row) => [applyLambda(fn, [[row]], ctx)])
    }
    // Each column goes in as a grid one column wide, answers along a row.
    return [transposeGrid(grid).map((col) => applyLambda(fn, [col.map((v) => [v])], ctx))]
  }

  // REDUCE and SCAN: the accumulator, then each cell in reading order.
  const grid = gridArgOf(args[1], ctx)
  let acc: CellValue = args[0] ? evalNode(args[0], ctx) : ''
  const steps: CellValue[][] = []
  for (const row of grid) {
    const line: CellValue[] = []
    for (const cell of row) {
      acc = applyLambda(fn, [acc, cell], ctx)
      line.push(acc)
    }
    steps.push(line)
  }
  return name === 'SCAN' ? steps : acc
}

/** A grid with its rows and columns swapped. */
function transposeGrid(grid: Grid): Grid {
  const cols = grid.reduce((m, row) => Math.max(m, row.length), 0)
  return Array.from({ length: cols }, (_, c) => grid.map((row) => row[c] ?? ''))
}

/** Whether a node stands for a grid: a range, an array or reference function, a name to one, or arithmetic over those. */
function hasArray(node: Node, ctx: EvalContext, depth = 0): boolean {
  switch (node.k) {
    case 'range': return true
    case 'spill': return true
    case 'name': {
      if (isGrid(localOf(ctx, node.name))) return true
      const target = depth < 8 ? nameTarget(node.name, ctx) : null
      return target ? hasArray(target, ctx, depth + 1) : false
    }
    case 'fn': return REFERENCE_FUNCTIONS.has(node.name) || Boolean(ARRAY_FUNCTIONS[node.name]) || LAMBDA_HELPERS.has(node.name) || node.name === 'LET'
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
    // A name bound inside the formula, by LET or as a lambda's parameter,
    // hands over its grid: `LET(r, A1:C1, SUM(r))` adds the range.
    if (given.k === 'name') {
      const local = localOf(ctx, given.name)
      if (isGrid(local)) {
        grids.push(local)
        perArg.push(local.flat())
        continue
      }
    }
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
    } else if (arg.k === 'spill') {
      // The spilled range hands the whole array to the caller, so
      // =SUM(E1#) adds every cell the dynamic array reaches.
      const rect = spillRectOf(arg, ctx)
      if (!rect) {
        grids.push(null)
        perArg.push([err('#REF!')])
      } else {
        const grid = rectGrid(rect, ctx)
        grids.push(grid)
        perArg.push(grid.flat())
      }
    } else if (arg.k === 'ref3d') {
      // A 3D reference hands over its cell on every sheet in the range, so
      // =SUM(Sheet1:Sheet3!A1) adds the same cell down the tabs.
      const vals = values3d(arg, ctx)
      grids.push(null)
      perArg.push(vals ?? [err('#REF!')])
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
    } else if (arg.k === 'fn' && LAMBDA_HELPERS.has(arg.name)) {
      // And so do the lambda helpers: =SUM(MAP(A1:A9, LAMBDA(v, v * 2))) is
      // the sum of every doubled value, not of the first one. REDUCE hands
      // back one value rather than a grid, which is the same branch.
      const grid = lambdaCall(arg, ctx)
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
    if (node.k === 'spill') {
      const rect = spillRectOf(node, ctx)
      return rect ? rectGrid(rect, ctx) : [[err('#REF!')]]
    }
    if (node.k === 'name') {
      const local = localOf(ctx, node.name)
      if (isGrid(local)) return local
      const target = nameTarget(node.name, ctx)
      return target ? rangeValues(target, ctx) : null
    }
    if (node.k === 'fn' && REFERENCE_FUNCTIONS.has(node.name)) return rectGrid(referenceCall(node, ctx), ctx)
    if (node.k === 'fn' && ARRAY_FUNCTIONS[node.name]) {
      const grid = arrayCall(node, ctx)
      return Array.isArray(grid) ? grid : [[grid]]
    }
    if (node.k === 'fn' && LAMBDA_HELPERS.has(node.name)) {
      const grid = lambdaCall(node, ctx)
      return Array.isArray(grid) ? grid : [[grid]]
    }
    // `=LET(r, A1:A9, SORT(r))` spills what its calculation is.
    if (node.k === 'fn' && node.name === 'LET') {
      const grid = letGrid(node.args, ctx)
      return grid ?? [[evalNode(node, ctx)]]
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
    if (node.k === 'range' || node.k === 'name' || node.k === 'spill'
      || (node.k === 'fn' && (REFERENCE_FUNCTIONS.has(node.name) || ARRAY_FUNCTIONS[node.name] || LAMBDA_HELPERS.has(node.name) || node.name === 'LET'))) {
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
