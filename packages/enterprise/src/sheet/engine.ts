/**
 * The seam between the workbook and whatever works a formula out.
 *
 * The built-in engine (the tokenizer, parser and evaluator beside this
 * file) is the default and needs nothing. An application that wants
 * Excel's full library instead passes another one to `createWorkbook`:
 * `{ engine: createHyperFormulaEngine({ hyperformula }) }`.
 *
 * What an engine is asked for is narrow on purpose: a formula's value in
 * a cell, and the grid it spills when it has one. The workbook keeps
 * everything else, because none of it is the engine's to decide. The
 * dependency graph, the volatile set, the value cache, cycle detection
 * and the spill ranges are all read off the reference grammar, which is
 * Excel's whatever evaluates it, so they stay correct for any engine and
 * an engine cannot get them wrong.
 *
 * `load` and `write` are the lifecycle an engine with a copy of the cells
 * needs: `load` when the workbook is built and whenever its cells change
 * wholesale (a structural edit, a sheet added or renamed, a restore),
 * `write` on a single cell. An engine that reads through `host` on demand,
 * as the built-in does, leaves both off.
 */
import type { CellValue, Node } from './ast'
import type { EvalContext } from './evaluate'
import { evaluate, evaluateSpill } from './evaluate'
import type { SheetData } from './workbook'

/** Where a formula sits. */
export type SheetEngineCell = { sheet: string; row: number; col: number }

export type SheetEngineHost = {
  /**
   * The context the built-in evaluator uses for this cell: `resolve` reads
   * through the workbook's cache and cycle detection, so an engine that
   * wants a precedent's value asks here rather than reading raw text.
   */
  context: EvalContext
  /** The workbook's parse cache: one parse per distinct formula text, null when it does not parse. */
  parse(text: string): Node | null
}

export type SheetEngineResult = {
  value: CellValue
  /**
   * The grid the formula spills, or null / absent for a plain value. The
   * workbook lays it over the cells below and to the right, refuses it
   * with `#SPILL!` where something is in the way, and moves it with an
   * insert or delete.
   */
  spill?: CellValue[][] | null
}

export type SheetEngine = {
  /** For the docs and an error message; the built-in is `'builtin'`. */
  name?: string
  /** Every sheet's raw text, at creation and after a wholesale change. */
  load?(sheets: ReadonlyArray<SheetData>): void
  /** One cell's raw text changed. */
  write?(sheet: string, row: number, col: number, text: string): void
  /** What the formula is worth here. `text` keeps its leading `=`. */
  evaluate(text: string, at: SheetEngineCell, host: SheetEngineHost): SheetEngineResult
}

/**
 * The engine the sheet ships with: the parser and evaluator in this
 * folder, which read the workbook's own cells through the host's context
 * and so need no copy of anything.
 */
export function builtinEngine(): SheetEngine {
  return {
    name: 'builtin',
    evaluate(text, _at, host) {
      const ast = host.parse(text)
      if (!ast) return { value: { error: '#PARSE!' } }
      const value = evaluate(ast, host.context)
      const spill = typeof value === 'object' && value !== null && 'error' in value ? null : evaluateSpill(ast, host.context)
      return { value, spill }
    },
  }
}
