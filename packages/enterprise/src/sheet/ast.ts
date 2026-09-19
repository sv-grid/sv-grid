/**
 * The formula AST and the error vocabulary, in their own module so the
 * tokenizer, parser, evaluator and the reference rewriter can all import the
 * shapes without importing each other.
 */
import type { CellRef } from './address'

export type SheetError =
  | '#REF!' | '#CYCLE!' | '#DIV/0!' | '#VALUE!' | '#NAME?'
  | '#NUM!' | '#N/A' | '#PARSE!' | '#SPILL!' | '#CALC!'

/** A computed cell value. Errors are values, not exceptions, once evaluation
 *  finishes - that is what lets `=IFERROR(A1, 0)` see one. */
export type CellValue = string | number | boolean | { error: SheetError }

export function isError(v: CellValue): v is { error: SheetError } {
  return typeof v === 'object' && v !== null && 'error' in v
}

export function err(code: SheetError): { error: SheetError } {
  return { error: code }
}

/** The error codes a user can type into a cell. Excel stores what is typed
 *  as the error itself, so =ISNA(A1) over a cell holding #N/A is TRUE.
 *  #PARSE! is ours, not Excel's, and no one types it. */
const TYPED_ERRORS: ReadonlyArray<SheetError> = [
  '#REF!', '#DIV/0!', '#VALUE!', '#NAME?', '#NUM!', '#N/A', '#SPILL!', '#CALC!', '#CYCLE!',
]

/** The error a typed text stands for, or null when it is ordinary text. */
export function typedError(text: string): { error: SheetError } | null {
  if (!text.startsWith('#')) return null
  const upper = text.toUpperCase()
  const found = TYPED_ERRORS.find((code) => code === upper)
  return found ? { error: found } : null
}

/** Thrown during evaluation and caught at the boundary, where it becomes a
 *  value. Carrying the code on a real Error keeps stack traces useful in dev
 *  without the evaluator having to thread a result type through every branch. */
export class FormulaError extends Error {
  readonly code: SheetError
  constructor(code: SheetError) {
    super(code)
    this.name = 'FormulaError'
    this.code = code
  }
}

export type Node =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'bool'; v: boolean }
  /** A single cell. `ref.row` is never null here; a column-only reference
   *  parses as a range instead. */
  | { k: 'ref'; ref: CellRef }
  /** A rectangle. Either end's row may be null, meaning a whole-column ref
   *  that runs to the last used row of the sheet. */
  | { k: 'range'; from: CellRef; to: CellRef }
  /** A defined name (`=Tax`), resolved against the workbook at evaluation. */
  | { k: 'name'; name: string }
  /**
   * A structured reference: `Orders[Amount]`, `[@Amount]`, `Orders[#Totals]`.
   *
   * Deliberately NOT resolved to a range here. The range a table reference
   * means depends on how many rows the table has right now, and the AST is
   * cached across the edits that change that. Resolving at parse time is how
   * a total silently stops covering rows added after it was typed, which is
   * the exact problem tables exist to fix.
   */
  | {
      k: 'table'
      /** null for the unqualified `[Amount]` form, which only means
       *  something inside a table. */
      table: string | null
      /** null when the reference names no column, e.g. `Orders[#All]`. */
      column: string | null
      /** The far end of a column span: `Orders[[Qty]:[Amount]]`. */
      columnTo?: string | null
      specifier: '#All' | '#Data' | '#Headers' | '#Totals' | '#ThisRow'
    }
  | { k: 'unary'; op: '-' | '+' | '%'; arg: Node }
  | { k: 'binary'; op: BinaryOp; left: Node; right: Node }
  | { k: 'fn'; name: string; args: Node[] }
  /** An omitted argument: the gap in `PMT(rate, nper, pv, , 1)`. Reads as a
   *  blank, so a function sees its default the way it does when the
   *  argument is simply left off the end. */
  | { k: 'empty' }

export type BinaryOp =
  | '+' | '-' | '*' | '/' | '^' | '&'
  | '=' | '<>' | '<' | '>' | '<=' | '>='

/** Binding power. Comparison loosest, then concat, then arithmetic. */
export const PRECEDENCE: Record<BinaryOp, number> = {
  '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1,
  '&': 2,
  '+': 3, '-': 3,
  '*': 4, '/': 4,
  '^': 5,
}

/** Walk every node, parents before children. */
export function visit(node: Node, fn: (n: Node) => void): void {
  fn(node)
  switch (node.k) {
    case 'unary': visit(node.arg, fn); break
    case 'binary': visit(node.left, fn); visit(node.right, fn); break
    case 'fn': for (const a of node.args) visit(a, fn); break
    default: break
  }
}

/** Rebuild the tree with `fn` applied to every node, deepest first. Used by
 *  the reference rewriter, which must not mutate a cached AST in place. */
export function mapNode(node: Node, fn: (n: Node) => Node): Node {
  switch (node.k) {
    case 'unary':
      return fn({ ...node, arg: mapNode(node.arg, fn) })
    case 'binary':
      return fn({ ...node, left: mapNode(node.left, fn), right: mapNode(node.right, fn) })
    case 'fn':
      return fn({ ...node, args: node.args.map((a) => mapNode(a, fn)) })
    default:
      return fn(node)
  }
}
