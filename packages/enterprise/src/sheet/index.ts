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
  createSheetDocument,
  type SheetDocument, type SheetDocumentInit, type SheetState, type SheetStateEntry, type PerSheetState, type SheetChangeReason,
} from './document'
export { shiftRect, shiftRects, subtractRect, rectContains, rectsIntersect, remapNotes, lineShift, type NotesMap } from './rects'
export {
  isLocked, cellLocked, inEditRange, rectsHaveLocked, rectsMixLocked, PROTECTED_MESSAGE, PROTECTION_PERMISSIONS,
  defaultProtection, copyProtection, newEditRangeId, parseRangeText, rangeText,
  type ProtectionAllow, type ProtectionPermission, type EditRange, type SheetProtection,
} from './protection'
export {
  commentAt, withComment, withThread, threadAt, threadOf, threadText, notesOf, isThreaded, listComments, nextComment,
  type CommentEntry, type CommentThread, type CommentValue, type CommentsMap,
} from './comments'
export {
  ruleAt, rulesIn, checkEntry, listChoices, shiftValidation, removeValidation, describeRule, dateValue, validationId,
  DEFAULT_ALERT_MESSAGE, OPERATOR_LABELS,
  type ValidationRule, type ValidationAllow, type ValidationOperator, type ValidationContext, type ValidationVerdict, type ValidationSpec,
} from './validation'
export {
  ruleStats, evaluateCf, shiftCf, removeCf, cfIn, describeCf, scaleColor, iconIndex, hasStyle, cfId,
  CF_PRESET_STYLES, COLOR_SCALES, DATA_BAR_COLOR, DATA_BAR_NEGATIVE_COLOR,
  type CfRule, type CfRuleBody, type CfStyledRule, type CfBody, type CfPreset, type CfStyle, type CfStats, type CfResult, type CfContext,
  type CfOperator, type CfTextMatch, type CfIconSet, type CfScaleColors, type CfKind,
} from './conditional-formats'
export {
  mergePlan, unmergePlan, mergeDropsValues, mergesIn, mergeAt as sheetMergeAt, isCoveredCell, selectionMerged, toGridMerges,
  sortBlockedByMerges, reorderMerges, normalRect,
  type MergeKind, type MergePlan,
} from './merges'
export {
  distinctValues, hiddenRowsFor, passesFilter, isFiltering, withColumnFilter, valuesFilter, shiftAutoFilter, describeFilter,
  datePeriodBounds, distinctFills, isDateColumn,
  type AutoFilterState, type ColumnFilter, type FilterCondition, type FilterValue, type DatePeriod, type FilterContext,
} from './auto-filter'

export { sortOrder, guessHeaderRow, type SortKey, type SortDirection } from './sort'
export { documentToXlsxParts, documentFromXlsxParts, documentToXlsx, documentFromXlsx } from './xlsx-document'
export { csvText } from './csv'
export { default as SvSheetSort } from '../SvSheetSort.svelte'

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
  readClipboardOrigin, anchorForeignFormulas, resolvePasteCell, planPaste, msoNumberFormat, numFmtFromMso, isR1C1, r1c1ToA1,
  type PasteSpecialOptions, type PasteWhat, type PasteOperation,
  type ClipboardCell, type ClipboardGrid, type PasteResolution,
} from './paste-special'
export { setFindReplaceHandler, setPasteSpecialHandler } from './shortcuts'

export { default as SvFormulaBar } from '../SvFormulaBar.svelte'
export { default as SvSheet } from '../SvSheet.svelte'
export { default as SvSheetRibbon } from '../SvSheetRibbon.svelte'
export {
  RIBBON_TABS, ribbonItems, withDecimals, applyBorders,
  type RibbonTab, type RibbonGroup, type RibbonItem, type RibbonOption,
  type RibbonItemKind, type RibbonActionId, type BorderPreset,
} from './ribbon'
export { RIBBON_ICONS, RIBBON_ICON_NAMES, type RibbonIconName, type IconPath } from './ribbon-icons'
export { THEME_COLOURS, STANDARD_COLOURS, ALL_COLOURS, tint, type PaletteColour } from './palette'
export { default as SvRibbonIcon } from '../SvRibbonIcon.svelte'
export {
  move, selectRegion, selectLine, applyFormat, toggleFormat, preset,
  autoSum, structural, switchSheet, gridOf,
} from './shortcuts'

export {
  compileNumberFormat, formatWithPattern, FORMAT_PRESETS, SPECIAL_FORMATS, formatCategory,
  accountingPattern, accountingParts,
  type CompiledFormat, type FormatPresetName, type SpecialFormatName,
} from './number-format'
export {
  createFormatStore, entryToStyle,
  type SheetFormatStore, type CellFormatEntry, type CellAddressLookup,
} from './format-store'
export {
  createNames, isValidName, type SheetNames, type DefinedName,
} from './names'
export {
  defaultSheetMessages, defaultSheetTextMessages, defaultDialogMessages, ribbonMessageDefaults,
  resolveSheetMessages, formatMessage,
  type SheetMessages, type SheetTextMessages, type SheetDialogMessages, type SheetLocalization,
} from './messages'
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
  translateFormula, fixupReferences, renameSheetReferences, formatFormula,
  referenceSpans, REFERENCE_COLOURS,
  type StructuralEdit, type EditScope, type ReferenceSpan,
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
  fillDown, fillRight, fillSelection, stampDate, stampNow, copyFromAbove, copyValueFromAbove,
  guessSumRange, looksNumeric, numericAt, targetRect, setFillTranslator,
  setSheetValueProbe, getSheetValueProbe,
  type FillTranslator, type SheetValueProbe,
} from './commands'
