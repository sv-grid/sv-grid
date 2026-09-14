/**
 * `@svgrid/enterprise/sheet` - the Excel keyboard layer on its own subpath.
 *
 * Importing the package barrel pulls every module it reaches into the chunk
 * (the package sets no `sideEffects` flag), which for an app that only wants
 * the shortcuts would mean shipping export, pivot, the scheduler and the board
 * as well. This subpath is the shortcuts and nothing else. It matters more once
 * the formula engine lands beside them in phase 2.
 */
export { enableSheet } from '../sheet-enable'
export {
  parseFormula, parse,
} from './parse'
export { tokenize, type Token } from './tokenize'
export { evaluate, formatValue, type EvalContext } from './evaluate'
export {
  FUNCTIONS, withCustomFunctions, type SheetFunction, type FnArgs,
} from './functions'
export {
  translateFormula, fixupReferences, formatFormula, type StructuralEdit,
} from './refs'
export {
  createDependencyGraph, precedentsOf, cellKey, parseCellKey,
  type DependencyGraph, type CellKey,
} from './deps'
export {
  parseA1, formatA1, colToLetters, lettersToCol, type CellRef,
} from './address'
export {
  isError, type CellValue, type SheetError, type Node as FormulaNode,
} from './ast'

export {
  SHEET_BINDINGS, handleSheetKey,
  type SheetBinding, type SheetCommand,
} from './shortcuts'
export {
  edgeOfRegion, currentRegion, isWholeSheet, wholeSheet, isBlankValue,
  type Direction, type Grid, type Cell, type Rect,
} from './navigate'
export {
  fillDown, fillRight, fillSelection, stampDate, stampNow, copyFromAbove,
  guessSumRange, looksNumeric, targetRect, setFillTranslator,
  type FillTranslator,
} from './commands'
