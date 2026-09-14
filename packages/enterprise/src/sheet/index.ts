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
  createTableRegistry, isValidTableName, resolveTableRange,
  columnIndexOf, rowCountOf,
  type TableRegion, type TableRegistry, type TableRange, type TableSpecifier,
} from './tables'

export {
  goalSeek, goalSeekCell,
  type GoalSeekOptions, type GoalSeekResult, type GoalSeekSheet,
  type CellAddress as GoalSeekCellAddress,
} from './goal-seek'

export { default as SvSheetTabs } from '../SvSheetTabs.svelte'
export {
  createWorkbook, isValidSheetName,
  type Workbook, type SheetData, type WorkbookOptions,
} from './workbook'
export { setWorkbook, getWorkbook } from './shortcuts'

export {
  splitText, textToColumns, guessDelimiter,
  findDuplicates, removeDuplicates,
  type SplitOptions, type DuplicateOptions, type DuplicateReport,
} from './transforms'

export {
  insertRows, deleteRows, insertColumns, deleteColumns,
  axisForSelection, setStructureTarget, getStructureTarget, rewriteFormulas,
  type StructureTarget,
} from './structure'
export {
  findAll, findNext, replaceOne, replaceAll, replaceInText, cellMatches,
  setFindTarget, getFindTarget,
  type FindOptions, type FindHit, type FindTarget,
} from './find-replace'
export {
  splitFrozenRows, frozenColumnIds, applyFreeze,
  freezeAtActiveCell, freezeTopRow, freezeFirstColumn, unfreeze,
  type FreezeState, type FreezeSplit,
} from './freeze'
export {
  buildClipboardPayload, parseClipboard, parseClipboardText, parseClipboardHtml,
  readClipboardOrigin, resolvePasteCell, planPaste,
  type PasteSpecialOptions, type PasteWhat, type PasteOperation,
  type ClipboardCell, type ClipboardGrid, type PasteResolution,
} from './paste-special'
export { setFindReplaceHandler, setPasteSpecialHandler } from './shortcuts'

export { default as SvFormulaBar } from '../SvFormulaBar.svelte'
export {
  compileNumberFormat, formatWithPattern, FORMAT_PRESETS,
  type CompiledFormat, type FormatPresetName,
} from './number-format'
export {
  createFormatStore, entryToStyle,
  type SheetFormatStore, type CellFormatEntry, type CellAddressLookup,
} from './format-store'
export {
  createNames, isValidName, type SheetNames, type DefinedName,
} from './names'
export {
  suggestFunctions, applySuggestion, signatureAt, partialAt, SIGNATURES,
  type FunctionSuggestion,
} from './autocomplete'
export {
  setFormatTarget, getFormatTarget, setFormatDialogHandler,
  type SheetFormatTarget,
} from './shortcuts'

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
