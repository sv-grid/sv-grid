/**
 * HyperFormula as the sheet's formula engine.
 *
 * `hyperformula` is an optional peer: an application that wants Excel's
 * full library installs it, builds the instance itself (so it picks the
 * licence key and the options) and hands it over:
 *
 * ```ts
 * import { HyperFormula } from 'hyperformula'
 * import { createWorkbook, createHyperFormulaEngine } from '@svgrid/enterprise'
 *
 * const hf = HyperFormula.buildEmpty({ licenseKey: 'gpl-v3' })
 * const wb = createWorkbook(sheets, { engine: createHyperFormulaEngine({ hyperformula: hf }) })
 * ```
 *
 * The engine keeps HyperFormula's sheets as a mirror of the workbook's
 * cells, writing each edit through, and answers with the value HF works
 * out. Everything else stays the workbook's: the dependency graph, the
 * cache, cycle detection and the spill ranges are read off the reference
 * grammar, which both engines share.
 *
 * What changes with it: the function library becomes HyperFormula's, so
 * its ~400 functions are available and the handful the built-in has that
 * it does not are not; a dynamic array spills inside HyperFormula's own
 * sheet rather than over the workbook's cells. What does not: the A1
 * grammar, the shape of the document, and the error vocabulary, which is
 * mapped back to the sheet's own codes. A defined name is the workbook's,
 * so a formula that uses one needs the same name defined in the
 * HyperFormula instance.
 */
import { err, type CellValue, type SheetError } from './ast'
import type { SheetEngine, SheetEngineCell, SheetEngineHost } from './engine'
import type { SheetData } from './workbook'

/** The part of HyperFormula's surface this engine uses, mirrored so an
 *  application without the package installed still type-checks. */
export type HyperFormulaLike = {
  getSheetId(name: string): number | undefined
  addSheet(name?: string): string
  setSheetContent(sheetId: number, values: unknown[][]): unknown
  setCellContents(cell: { sheet: number; row: number; col: number }, contents: unknown): unknown
  getCellValue(cell: { sheet: number; row: number; col: number }): unknown
  removeSheet?(sheetId: number): unknown
  getSheetNames?(): string[]
}

export type HyperFormulaEngineOptions = {
  /** The instance the application built. */
  hyperformula: HyperFormulaLike
}

/** HyperFormula's error values as the sheet's own codes. */
const ERRORS: Record<string, SheetError> = {
  '#REF!': '#REF!', '#DIV/0!': '#DIV/0!', '#VALUE!': '#VALUE!', '#NAME?': '#NAME?',
  '#NUM!': '#NUM!', '#N/A': '#N/A', '#CYCLE!': '#CYCLE!', '#ERROR!': '#VALUE!', '#SPILL!': '#SPILL!',
}

/** And its `ErrorType` names, which a DetailedCellError carries instead. */
const ERROR_TYPES: Record<string, SheetError> = {
  REF: '#REF!', DIV_BY_ZERO: '#DIV/0!', VALUE: '#VALUE!', NAME: '#NAME?',
  NUM: '#NUM!', NA: '#N/A', CYCLE: '#CYCLE!', ERROR: '#VALUE!', SPILL: '#SPILL!',
}

/** One HyperFormula cell value as a `CellValue`. */
export function fromHyperFormula(value: unknown): CellValue {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? value : err('#NUM!')
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    // A DetailedCellError carries its code on `value`, or on `error.type`.
    const code = (value as { value?: unknown }).value
    if (typeof code === 'string' && code.startsWith('#')) return err(ERRORS[code] ?? '#VALUE!')
    const type = (value as { type?: unknown }).type
    if (typeof type === 'string') return err(ERROR_TYPES[type] ?? '#VALUE!')
    if (value instanceof Date) return value.toISOString().slice(0, 10)
  }
  return String(value)
}

export function createHyperFormulaEngine(options: HyperFormulaEngineOptions): SheetEngine {
  const hf = options.hyperformula
  /** Sheet name (lower case) to HyperFormula's id. */
  const ids = new Map<string, number>()

  function idOf(name: string): number | null {
    const known = ids.get(name.toLowerCase())
    if (known !== undefined) return known
    const found = hf.getSheetId(name)
    if (found !== undefined) { ids.set(name.toLowerCase(), found); return found }
    return null
  }

  return {
    name: 'hyperformula',

    load(sheets: ReadonlyArray<SheetData>) {
      ids.clear()
      for (const sheet of sheets) {
        let id = hf.getSheetId(sheet.name)
        if (id === undefined) {
          hf.addSheet(sheet.name)
          id = hf.getSheetId(sheet.name)
        }
        if (id === undefined) continue
        ids.set(sheet.name.toLowerCase(), id)
        // A ragged row is squared off: HyperFormula wants a rectangle.
        const width = sheet.cells.reduce((m, row) => Math.max(m, row.length), 0)
        hf.setSheetContent(id, sheet.cells.map((row) => Array.from({ length: width }, (_, c) => row[c] ?? '')))
      }
    },

    write(sheet: string, row: number, col: number, text: string) {
      const id = idOf(sheet)
      if (id === null) return
      hf.setCellContents({ sheet: id, row, col }, text === '' ? null : text)
    },

    evaluate(text: string, at: SheetEngineCell, host: SheetEngineHost) {
      const id = idOf(at.sheet)
      if (id === null) return { value: err('#REF!') }
      // Text the sheet's own grammar cannot read is #PARSE! before
      // HyperFormula is asked, so the two engines refuse the same things;
      // the parse is the workbook's cached one, not a second one.
      if (!host.parse(text)) return { value: err('#PARSE!') }
      // The mirror holds the same text in the same cell, so the answer is
      // simply that cell's value. HyperFormula spills its own arrays
      // inside its own sheet, which this engine does not mirror back: a
      // cell reads its own value and the workbook's spill ranges stay
      // empty under it.
      return { value: fromHyperFormula(hf.getCellValue({ sheet: id, row: at.row, col: at.col })), spill: null }
    },
  }
}
