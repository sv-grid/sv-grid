export {
  setLicenseKey,
  clearLicenseKey,
  getLicenseKey,
  isLicenseKeySet,
  hasValidLicense,
  assertEnterpriseLicensed,
  nudgeEnterprise,
  checkLicenseKey,
  // Trial expiry. The built-in card already appears on its own once a trial
  // lapses; these are for hosts that would rather render their own banner.
  isLicenseExpired,
  getLicenseExpiry,
  type LicenseInfo,
  type LicenseStatus,
} from './license'

export { parseLicenseExpiry } from './license-core'

export {
  exportGrid,
  copyExportToClipboard,
  type ExportFormat,
  type ExportOptions,
  type ExportColumn,
  type ExportCellStyle,
  type ExportStyles,
  type ExportHeaderFooterLine,
  type ExportSheet,
  type ExportRowSource,
  type ExportProgress,
  type ExportResult,
  type ClipboardFormat,
  type ClipboardExportOptions,
} from './export'
export { default as SvExportMenu } from './SvExportMenu.svelte'
export { buildPdfDocDefinition, resolvePdfCharts, resolvePdfVfs, registerPdfFonts, type PdfExportOptions, type PdfPageSize, type PdfChart, type PdfKpi, type PdfChartImage, type PdfVirtualFileSystem, type PdfMakeLike } from './export-pdf'
export { printGrid, type PrintOptions } from './print'
export {
  importData,
  readImportMatrix,
  mapImportMatrix,
  mapImportMatrixAsync,
  autoMapColumns,
  inferImportColumnTypes,
  type ImportFormat,
  type ImportFieldType,
  type ImportOptions,
  type ImportResult,
  type ImportProgress,
  type ImportColumnMap,
  type ImportColumnTypes,
  type ImportGridColumn,
  type ImportRowError,
  type ImportValidator,
} from './import'
export { default as SvImportDialog } from './SvImportDialog.svelte'
export { installEnterprise, type EnterpriseGridApi, type EnterpriseAIApi, type EnterprisePivotApi } from './install'
// Scheduler / calendar view (Pro). `enableSchedulerView()` registers the
// renderer so `<SvGrid scheduler={...}>` shows a Month/Week/Day/Agenda calendar.
// The pure model helpers + config types live in @svgrid/grid; import them from there.
export { enableSchedulerView, SvGridScheduler } from './scheduler'
// Kanban board view (Pro). `enableBoardView()` registers the renderer so
// `<SvGrid board={...}>` shows lanes of cards. Config types live in @svgrid/grid.
export { enableBoardView, SvGridBoard } from './board'
// Bulk-action bar over the row selection (Pro). `enableSelectionBar()` registers
// the renderer so `<SvGrid selectionBar={...}>` floats a bar over the grid while
// rows are selected. The prop + its config types live in @svgrid/grid.
export { enableSelectionBar, SvGridSelectionBar } from './selection-bar'
// Bulk edit engine behind the bar's `editFields` button - exported so an app
// can drive the same write from its own UI.
export { applyBulkEdit, bulkEditableFields, bulkEditInitialValues, coerceBulkValue, type BulkEditField, type BulkEditResult } from './bulk-edit'
export { default as SvGridBulkEditDrawer } from './SvGridBulkEditDrawer.svelte'
// In-grid pivot mode (Pro). `enablePivot()` registers the pivot engine so
// `<SvGrid pivot={...}>` renders a pivot table in place of the flat table.
export { enablePivot } from './pivot-enable'
export { enableSheet } from './sheet-enable'
export {
  createTableRegistry, isValidTableName, resolveTableRange,
  columnIndexOf, rowCountOf,
  type TableRegion, type TableRegistry, type TableRange, type TableSpecifier,
} from './sheet/tables'

export {
  TABLE_STYLES, DEFAULT_TABLE_STYLE, NO_TABLE_STYLE,
  findTableStyle, tableStyleColours, tableStyleLabel,
  type TableStyle, type TableStyleTone, type TableStyleColours,
} from './sheet/table-styles'

export {
  goalSeek, goalSeekCell,
  type GoalSeekOptions, type GoalSeekResult, type GoalSeekSheet,
  type CellAddress as GoalSeekCellAddress,
} from './sheet/goal-seek'

export {
  evaluationSteps, printNode, printValue,
  type EvaluationStep,
} from './sheet/evaluate-steps'

export {
  checkSheet, describeFinding, ERROR_MEANINGS,
  type ErrorFinding, type ErrorFindingKind, type SheetReader,
} from './sheet/error-check'

export { imageCall, isDrawableImageSource, type ImageCall } from './sheet/cell-images'

export {
  livePresence, presenceOnSheet, presenceAnchor, presenceColour, presenceInitials,
  PRESENCE_COLOURS, type SheetPresence,
} from './sheet/presence'

export { default as SvSheetTabs } from './SvSheetTabs.svelte'
export {
  createWorkbook, isValidSheetName, cleanIteration, DEFAULT_ITERATION,
  type Workbook, type SheetData, type WorkbookOptions, type IterationSettings,
} from './sheet/workbook'
export { setWorkbook, getWorkbook } from './sheet/shortcuts'
export {
  createSheetDocument,
  type SheetDocument, type SheetDocumentInit, type SheetState, type SheetStateEntry, type PerSheetState, type SheetChangeReason,
} from './sheet/document'
export { shiftRect, shiftRects, subtractRect, rectContains, rectsIntersect, remapNotes, lineShift, type NotesMap } from './sheet/rects'
export {
  isLocked, cellLocked, inEditRange, rectsHaveLocked, rectsMixLocked, PROTECTED_MESSAGE, PROTECTION_PERMISSIONS,
  defaultProtection, copyProtection, newEditRangeId, parseRangeText, rangeText,
  type ProtectionAllow, type ProtectionPermission, type EditRange, type SheetProtection,
} from './sheet/protection'
export {
  commentAt, withComment, withThread, threadAt, threadOf, threadText, notesOf, isThreaded, listComments, nextComment,
  type CommentEntry, type CommentThread, type CommentValue, type CommentsMap,
} from './sheet/comments'
export {
  ruleAt, rulesIn, checkEntry, listChoices, shiftValidation, removeValidation, describeRule, dateValue, validationId,
  DEFAULT_ALERT_MESSAGE, OPERATOR_LABELS,
  type ValidationRule, type ValidationAllow, type ValidationOperator, type ValidationContext, type ValidationVerdict, type ValidationSpec,
} from './sheet/validation'
export {
  ruleStats, evaluateCf, shiftCf, removeCf, cfIn, describeCf, scaleColor, iconIndex, hasStyle, cfId,
  CF_PRESET_STYLES, COLOR_SCALES, DATA_BAR_COLOR, DATA_BAR_NEGATIVE_COLOR,
  type CfRule, type CfRuleBody, type CfStyledRule, type CfBody, type CfPreset, type CfStyle, type CfStats, type CfResult, type CfContext,
  type CfOperator, type CfTextMatch, type CfIconSet, type CfScaleColors, type CfKind,
} from './sheet/conditional-formats'
export {
  mergePlan, unmergePlan, mergeDropsValues, mergesIn, mergeAt as sheetMergeAt, isCoveredCell, selectionMerged, toGridMerges,
  sortBlockedByMerges, reorderMerges, normalRect,
  type MergeKind, type MergePlan,
} from './sheet/merges'
export {
  distinctValues, hiddenRowsFor, passesFilter, isFiltering, withColumnFilter, valuesFilter, shiftAutoFilter, describeFilter,
  type AutoFilterState, type ColumnFilter, type FilterCondition, type FilterValue,
} from './sheet/auto-filter'

export {
  splitText, textToColumns, guessDelimiter,
  findDuplicates, removeDuplicates,
  type SplitOptions, type DuplicateOptions, type DuplicateReport,
} from './sheet/transforms'

export {
  insertRows, deleteRows, insertColumns, deleteColumns,
  axisForSelection, setStructureTarget, getStructureTarget, rewriteFormulas,
  type StructureTarget,
} from './sheet/structure'
export {
  findAll, findNext, replaceOne, replaceAll, replaceInText, cellMatches,
  setFindTarget, getFindTarget,
  type FindOptions, type FindHit, type FindTarget,
} from './sheet/find-replace'
export {
  splitFrozenRows, frozenColumnIds, applyFreeze,
  freezeAtActiveCell, freezeTopRow, freezeFirstColumn, unfreeze,
  type FreezeState, type FreezeSplit,
} from './sheet/freeze'
export {
  buildClipboardPayload, parseClipboard, parseClipboardText, parseClipboardHtml,
  readClipboardOrigin, anchorForeignFormulas, resolvePasteCell, planPaste, msoNumberFormat, numFmtFromMso, isR1C1, r1c1ToA1,
  type PasteSpecialOptions, type PasteWhat, type PasteOperation,
  type ClipboardCell, type ClipboardGrid, type PasteResolution,
} from './sheet/paste-special'
export { setFindReplaceHandler, setPasteSpecialHandler, setRibbonActionHandler, nudgeFontSize, type RibbonKeyAction } from './sheet/shortcuts'

export { default as SvFormulaBar } from './SvFormulaBar.svelte'
export { default as SvSheet } from './SvSheet.svelte'
export { default as SvSheetRibbon } from './SvSheetRibbon.svelte'
export { default as SvSheetFindReplace } from './SvSheetFindReplace.svelte'
export { default as SvSheetPasteSpecial } from './SvSheetPasteSpecial.svelte'
export { default as SvSheetFormatCells } from './SvSheetFormatCells.svelte'
export { default as SvSheetInsertFunction } from './SvSheetInsertFunction.svelte'
export { default as SvSheetSizeDialog } from './SvSheetSizeDialog.svelte'
export { default as SvSheetComment } from './SvSheetComment.svelte'
export { default as SvSheetDataValidation } from './SvSheetDataValidation.svelte'
export { default as SvSheetValidationAlert } from './SvSheetValidationAlert.svelte'
export { default as SvSheetListPicker } from './SvSheetListPicker.svelte'
export { default as SvSheetConditionalFormat } from './SvSheetConditionalFormat.svelte'
export { default as SvSheetManageRules } from './SvSheetManageRules.svelte'
export { default as SvSheetFilterMenu } from './SvSheetFilterMenu.svelte'
export { default as SvSheetNameManager } from './SvSheetNameManager.svelte'
export { default as SvSheetGoalSeek } from './SvSheetGoalSeek.svelte'
export { default as SvSheetTextToColumns } from './SvSheetTextToColumns.svelte'
export { default as SvSheetRemoveDuplicates } from './SvSheetRemoveDuplicates.svelte'
export { default as SvSheetSort } from './SvSheetSort.svelte'
export { sortOrder, guessHeaderRow, type SortKey, type SortDirection } from './sheet/sort'
export { documentToXlsxParts, documentFromXlsxParts, documentToXlsx, documentFromXlsx } from './sheet/xlsx-document'
export { csvText } from './sheet/csv'
export {
  defaultPageSetup, copyPageSetup, marginPresetOf, shiftPageSetup, marginsCss, MARGIN_PRESETS, PAPER_SIZES,
  type PageSetup, type PageMargins, type PageOrientation, type PaperSize, type MarginPreset,
} from './sheet/page-setup'
export { sheetPrintHtml, printAreas, type SheetPrintInput, type SheetPrintCell } from './sheet/print'
export { sheetCellsFromRows, cellTextOf, type SheetField, type SheetFromRowsOptions } from './sheet/from-rows'
export { builtinEngine, type SheetEngine, type SheetEngineHost, type SheetEngineCell, type SheetEngineResult } from './sheet/engine'
export {
  chartSpecOf, chartFromRange, shiftObject, shiftObjects, objectAt, copyObject, objectId, SHEET_CHART_TYPES,
  type SheetObject, type SheetChartObject, type SheetImageObject, type ObjectAnchor, type SheetChartType,
} from './sheet/objects'
export {
  sparklineSeries, sparklineAt, sparklineScale, sparklinesFromRange, clearSparklines,
  shiftSparkline, shiftSparklines, copySparkline, sparklineId, isColumnLocation, SPARKLINE_TYPES,
  type SparklineGroup, type SheetSparklineType,
} from './sheet/sparklines'
export {
  pivotFields, pivotRecords, pivotBlock, pivotLayout, pivotDrill, pivotFromRange, pivotWrittenRect, flattenPivotColumns,
  shiftPivot, shiftPivots, copyPivot, pivotId, SHEET_PIVOT_AGGS,
  type SheetPivot, type SheetPivotValue, type SheetPivotAgg, type PivotLayout as SheetPivotLayout, type PivotDrill,
} from './sheet/pivot-range'
export {
  createDeltaStream, applySheetDelta, partsOfReasons,
  type SheetDelta, type SheetDeltaStream, type SheetDeltaOptions, type SheetCellWrite,
} from './sheet/delta'
export {
  linkAt, setLink, removeLink, listLinks, shiftLinks, copyLinks, parseLinkTarget, linkTitle,
  type SheetLink, type LinksMap, type LinkTarget,
} from './sheet/links'
export {
  createHyperFormulaEngine, fromHyperFormula,
  type HyperFormulaLike, type HyperFormulaEngineOptions,
} from './sheet/hyperformula-engine'
export { functionCatalog, FUNCTION_GROUPS, type FunctionInfo, type FunctionGroup } from './sheet/function-catalog'
export { parseEntry, completeEntry, type ParsedEntry } from './sheet/entry'
export { cycleReference, type TextEdit } from './sheet/edit-keys'
export {
  RIBBON_TABS, ribbonItems, withDecimals, applyBorders,
  type RibbonTab, type RibbonGroup, type RibbonItem, type RibbonOption,
  type RibbonItemKind, type RibbonActionId, type BorderPreset,
} from './sheet/ribbon'
export { RIBBON_ICONS, RIBBON_ICON_NAMES, type RibbonIconName, type IconPath } from './sheet/ribbon-icons'
export { THEME_COLOURS, STANDARD_COLOURS, ALL_COLOURS, tint, type PaletteColour } from './sheet/palette'
export {
  defaultSheetMessages, defaultSheetTextMessages, defaultDialogMessages, ribbonMessageDefaults,
  resolveSheetMessages, formatMessage,
  type SheetMessages, type SheetTextMessages, type SheetDialogMessages, type SheetLocalization,
} from './sheet/messages'
export { provideSheetText, useSheetText, type SheetText } from './sheet-text'
export { default as SvRibbonIcon } from './SvRibbonIcon.svelte'
export {
  move, selectRegion, selectLine, applyFormat, toggleFormat, preset,
  autoSum, structural, switchSheet, gridOf,
} from './sheet/shortcuts'
export {
  compileNumberFormat, formatWithPattern, FORMAT_PRESETS, SPECIAL_FORMATS, formatCategory,
  accountingPattern, accountingParts,
  type CompiledFormat, type FormatPresetName, type SpecialFormatName,
} from './sheet/number-format'
export {
  createFormatStore, entryToStyle, borderShadows,
  type SheetFormatStore, type CellFormatEntry, type CellAddressLookup,
} from './sheet/format-store'
export {
  createNames, isValidName, type SheetNames, type DefinedName,
} from './sheet/names'
export {
  suggestFunctions, applySuggestion, signatureAt, partialAt, SIGNATURES,
  type FunctionSuggestion,
} from './sheet/autocomplete'
export {
  setFormatTarget, getFormatTarget, setFormatDialogHandler,
  type SheetFormatTarget,
} from './sheet/shortcuts'

// The formula engine. Names are Sheet-prefixed HERE because the barrel already
// exports a `DependencyGraph` (scheduler) and an `EvalContext` (the expression
// language), and two different things under one name in one namespace is worse
// than a prefix. The `@svgrid/enterprise/sheet` subpath exports them unprefixed.
export { parseFormula, parse as parseFormulaTokens } from './sheet/parse'
export { tokenize as tokenizeFormula, type Token as FormulaToken } from './sheet/tokenize'
export {
  evaluate as evaluateFormula,
  formatValue as formatCellValue,
  type EvalContext as SheetEvalContext,
} from './sheet/evaluate'
export { ARRAY_FUNCTIONS, type ArrayFunction, type Grid as SpillGrid } from './sheet/packs/array'
export {
  FUNCTIONS as SHEET_FUNCTIONS,
  withCustomFunctions,
  type SheetFunction,
  type FnArgs as SheetFnArgs,
} from './sheet/functions'
export {
  translateFormula, fixupReferences, renameSheetReferences, formatFormula,
  referenceSpans, REFERENCE_COLOURS,
  type StructuralEdit, type EditScope, type ReferenceSpan,
} from './sheet/refs'
export {
  createDependencyGraph as createSheetDependencyGraph,
  precedentsOf, cellKey, parseCellKey,
  type DependencyGraph as SheetDependencyGraph,
  type CellKey,
} from './sheet/deps'
export {
  parseA1, formatA1, colToLetters, lettersToCol, type CellRef,
} from './sheet/address'
export {
  isError as isFormulaError,
  type CellValue as SheetCellValue,
  type SheetError,
  type Node as FormulaNode,
} from './sheet/ast'

export {
  SHEET_BINDINGS,
  handleSheetKey,
  type SheetBinding,
  type SheetCommand,
} from './sheet/shortcuts'
export {
  edgeOfRegion,
  currentRegion,
  isBlankValue,
  type Direction as SheetDirection,
} from './sheet/navigate'
export {
  fillDown,
  fillRight,
  fillSelection,
  stampDate,
  stampNow,
  copyFromAbove,
  copyValueFromAbove,
  guessSumRange,
  looksNumeric,
  setFillTranslator,
  type FillTranslator,
} from './sheet/commands'
export { enableAdvancedFilter } from './advanced-filter-enable'
export { default as SvAdvancedFilter } from './SvAdvancedFilter.svelte'
export {
  exprColumnsFromGrid,
  type ExprColumnsOptions,
} from './advanced-filter/expr-columns-from-grid'
export {
  compilePredicate,
  compileScalar,
  type CompileOptions,
} from './expressions/compile'
// Scheduler Pro feature surface (dependencies, multi-assignment + summaries,
// axis collapse + zoom). Config type extends the free grid's SchedulerConfig;
// the pure models are unit-tested framework-free helpers the renderer consumes.
export type { SchedulerProConfig } from './scheduler-config'
export {
  buildDependencyGraph,
  topoOrder,
  hasCycle,
  requiredStart,
  cascade,
  violations,
  type DependencyType,
  type SchedulerDependency,
  type EventTimes,
  type DependencyGraph,
  type CascadeOptions,
} from './scheduler-dependencies'
export {
  expandAssignments,
  resourceLoad,
  overallocations,
  assignedMinutes,
  type SchedulerAssignment,
  type Allocation,
  type Overallocation,
} from './scheduler-assignments'
export {
  columnSummaries,
  sumReducer,
  countReducer,
  busyMinutesReducer,
  type ColumnReducer,
  type SummaryItem,
} from './scheduler-summary'
export {
  buildAxis,
  timeToX,
  xToTime,
  resolveZoom,
  zoomPresets,
  type Axis,
  type AxisSegment,
  type AxisSegmentKind,
  type BuildAxisOptions,
  type ZoomLevel,
  type ZoomMajorUnit,
} from './scheduler-axis'
export {
  buildResourceRows,
  visibleResourceIds,
  type SchedulerResourceGroup,
  type ResourceRow,
} from './scheduler-resource-tree'
export { heatCells, heatPeak, type HeatCell } from './scheduler-heatmap'
export {
  respectsBuffer,
  withinDurationBounds,
  afterLead,
  type BusyEvent,
  type GapMin,
} from './scheduler-booking'
export {
  availableSlots,
  mergeIntervals,
  subtractIntervals,
  type Interval,
  type Slot,
  type SlotOptions,
} from './scheduler-slots'
export { mergeBusy, commonFree } from './scheduler-freebusy'
export {
  createStagedEditing,
  type StagedChange,
  type StagedEditingApi,
  type StagedEditingEvent,
} from './staged-editing'
export {
  createScheduler,
  parseCron,
  cronMatches,
  cronMatchesParsed,
  isScheduleDue,
  nextRun,
  CRON_PRESETS,
  type Schedule,
  type Scheduler,
  type SchedulerOptions,
} from './scheduling'
export { dismissUnlicensedNudge } from './watermark'
export {
  showUpgradePrompt,
  dismissUpgradePrompt,
  type EnterpriseFeatureLabel,
} from './upgrade-prompt'

export {
  createPivotModel,
  pivotAggregators,
  filterCollapsedPivotRows,
  type PivotAggregator,
  type PivotAggregatorId,
  type PivotConfig,
  type PivotResult,
  type PivotRow,
  type PivotRowKind,
  type PivotValueConfig,
} from './pivot'

export {
  titleCase,
  resolveIdField,
  schemaToColumns,
  schemaToFormFields,
  isFieldHidden,
  validateField,
  applyComputed,
  validateEntity,
  type EntitySchema,
  type EntityField,
  type EntityFieldType,
  type EntityHooks,
  type FormFieldDescriptor,
  type FormLayout,
  type FormSection,
  type StudioEditorType,
  type StandardSchemaV1,
  type StandardSchemaResult,
  type ValidationOp,
  type ValidationRuleSpec,
} from './schema'

export {
  planQuery,
  coerce,
  createInMemoryDataSource,
  createKitDataSource,
  createKitHandlers,
  createSqlDataSource,
  planToSql,
  type QueryPlan,
  type PlanPredicate,
  type PlanOp,
  type KitDataSourceOptions,
  type KitHandlerOptions,
  type KitScope,
  type KitHandlers,
  type KitMessage,
  type SqlDialect,
  type SqlPlan,
  type SqlExecutor,
  type SqlDataSourceConfig,
  type WritableDataSource,
} from './sveltekit'

// Server-Side Row Model: lazy server-side grouping and tree data over the
// free grid's datasource contract. Also available as '@svgrid/enterprise/server'.
export {
  createServerRowModel,
  serverRowModelRows,
  serverRowModelNav,
  serverGroupText,
  GRAND_TOTAL_ROW_ID,
  GROUP_TOTAL_ROW_ID_PREFIX,
  type ServerRowModel,
  type ServerRowModelOptions,
  type ServerRowModelState,
  type ServerRowModelGridRow,
  type ServerRowModelDisplayRow,
  type ServerLevelParams,
  type ServerLevelState,
  type RefreshOptions,
  type ServerTransaction,
  type ServerTransactionResult,
  type ServerTransactionStatus,
  type ServerRowModelPaginationOptions,
  type ServerRowModelPagination,
  createServerSelectionModel,
  buildPivotResultColumns,
  type PivotResultColumnOptions,
  adaptCallbackDatasource,
  toCallbackDatasource,
  fromCallbackRequest,
  toCallbackRequest,
  fromCallbackFilterModel,
  toCallbackFilterModel,
  type CallbackServerRequest,
  type CallbackColumnFilter,
  type CallbackGetRowsParams,
  type CallbackDatasource,
  type ServerSelectionModel,
  type ServerSelectionModelOptions,
  type ServerSelectionState,
  type ServerGroupSelectionNode,
  type ServerSelectionGroupMode,
  createServerGroupModel,
  serverGroupRows,
  serverGroupNav,
  enableServerRowModel,
  SvGroupCell,
  SvRowGroupPanel,
  type ServerGroupController,
  type ServerGroupControllerOptions,
  type ServerGroupState,
  type ServerGroupGridRow,
} from './server'

export {
  createSupabaseDataSource,
  createRestDataSource,
  offsetLimitAdapter,
  dummyJsonAdapter,
  jsonServerAdapter,
  introspectSupabaseTable,
  listSupabaseTables,
  createSupabaseRealtime,
  createRelationLookup,
  createSupabaseAuth,
  aggregateRows,
  chartFieldsFromSchema,
  normalizeFilters,
  buildEntitySchema,
  pickLabelField,
  linkRelationLabels,
  type SupabaseDataSourceConfig,
  type SupabaseClientLike,
  type RestDataSourceConfig,
  type RestAdapter,
  type OffsetLimitOptions,
  type IntrospectSupabaseOptions,
  type IntrospectedColumn,
  type ColumnReference,
  type NormalizedFilter,
  type NormalizedPredicate,
  type SupabaseRealtimeConfig,
  type SupabaseRealtimeClientLike,
  type SupabaseRealtimeHandle,
  type RealtimeChannelLike,
  type RealtimeChange,
  type RelationLookup,
  type RelationLookupConfig,
  type RelationOption,
  type SupabaseAuthConfig,
  type SupabaseAuthController,
  type SupabaseAuthClientLike,
  type AuthState,
  type AuthUser,
  withEntityRules,
  withRelationLabels,
  reduceValue,
  kpiSeries,
  sparklinePoints,
  seriesDelta,
  formatKpiValue,
  dashboardFromSchema,
  type AggregateReduce,
  type AggregateRequest,
  type AggregateBucket,
  type AggregateSource,
  type DashboardSpec,
  type DashboardWidget,
  type KpiWidget,
  type ChartWidget,
  type RelationLabelConfig,
} from './sources'

export {
  buildInitialValues,
  controlKind,
  editMode,
  evalValidationRules,
  fieldState,
  sectionVisible,
  hasFieldConditions,
  rowId,
  stripHiddenValues,
  toSubmitValues,
  validateAll,
  visibleFormFields,
  type EditMode,
  type ControlKind,
  type FieldState,
} from './edit-panel'
export { default as SvGridEditPanel } from './SvGridEditPanel.svelte'
export { default as SvLookupInput } from './SvLookupInput.svelte'
export { default as SvFileInput } from './SvFileInput.svelte'
export { default as SvAuthGate } from './SvAuthGate.svelte'
export { default as SvSchemaChart } from './SvSchemaChart.svelte'
export { default as SvSchemaDashboard } from './SvSchemaDashboard.svelte'
export { default as SvBoard } from './SvBoard.svelte'
export { default as SvSchedule } from './SvSchedule.svelte'
export { default as SvRecordDetail } from './SvRecordDetail.svelte'

export {
  FIELD_TYPES,
  blankField,
  addField,
  removeField,
  updateField,
  moveField,
  validateSchema,
  isSchemaValid,
  sampleRows,
  type SchemaIssue,
  type SchemaIssueLevel,
} from './schema-designer'
// NOTE: The visual designer components (SvSchemaDesigner, SvStudioDesigner) are
// the commercial "SvGrid Studio" seller. They live entirely in the PRIVATE
// website repo (website/src/lib/designer), NOT in this public package - they
// import the public API below. The Studio *codegen* below stays public because
// the MCP server depends on it.
// The Studio project model + codegen (also on the pure `@svgrid/enterprise/studio`
// subpath) - re-exported so the designer and its model come from one import.
export {
  createProject,
  defaultScreenFor,
  emitStudioProject,
  emitStudioAppBundle,
  emitStudioApp,
  sampleApps,
  getSampleApp,
  starterProject,
  liveDataSamples,
  getLiveDataSample,
  type SampleApp,
  starterDatasets,
  getStarterDataset,
  type StarterDataset,
  crudSuiteScreens,
  addCrudSuite,
  crudAppFromSchemas,
  type CrudScreenKind,
  type CrudEditingMode,
  type CrudSuiteOptions,
  type CrudAppOptions,
  introspectJson,
  sanitizeStudioProject,
  buildStudioBugReport,
  type BugReport,
  type BugReportInput,
  addBlock,
  addBlockAt,
  removeBlock,
  moveBlock,
  reorderBlock,
  updateBlock,
  addScreen,
  removeScreen,
  updateScreen,
  duplicateScreen,
  reorderScreen,
  insertBlock,
  addEntity,
  removeEntity,
  updateEntity,
  formPlan,
  setEntityForm,
  setFormColumns,
  addFormSection,
  updateFormSection,
  removeFormSection,
  moveFormSection,
  moveFormField,
  moveFormFields,
  setFieldConditions,
  updateEntityField,
  setFieldInput,
  setFieldHidden,
  formControlsFor,
  formControlSettings,
  suggestFormSections,
  setDataSource,
  defaultEntitySource,
  setEntityDataSource,
  entityDataSource,
  setTheme,
  setThemePreset,
  setShell,
  sanitizeProject,
  screenFromTemplate,
  addScreenFromTemplate,
  addFreestandingScreen,
  serializeProject,
  parseProject,
  blockPalette,
  validateProject,
  isProjectValid,
  entityOf,
  studioThemes,
  defaultStudioTheme,
  getStudioTheme,
  resolveThemeTokens,
  isDarkTheme,
  themeStyleString,
  type StudioTheme,
  type StudioProject,
  type Screen,
  type ScreenNav,
  type Block,
  type BlockKind,
  type BlockConfig,
  type GridConfig,
  type GridEditing,
  type GridDensity,
  type GridAlign,
  type PagerPosition,
  type GridColumnConfig,
  type ChartConfig,
  type KpiConfig,
  type KpiFormat,
  type DashboardConfig,
  type MasterDetailConfig,
  type LookupConfig,
  type Reduce,
  type DataSourceKind,
  type EntityDataSource,
  type MemorySource,
  type RestSource,
  type SqlSource,
  type SupabaseSource,
  type RestMethod,
  type ParamLocation,
  type ParamType,
  type RequestParam,
  type SqlDialectKind,
  type ProjectTheme,
  type ShellConfig,
  type ShellStyle,
  type ScreenTemplate,
  type PaletteItem,
  type ProjectIssue,
  type GeneratedFile,
} from './studio'
export {
  buildConnectionString,
  parseConnectionString,
  redactConnectionString,
  isFileDialect,
  DRIVER_PACKAGE,
  DEFAULT_PORT,
  countTableRows,
  probeConnection,
  type SqlConnectionParts,
  type TableRowCount,
  type SqlDialectName,
} from './studio'

export {
  buildDisplayRows,
  isDetailRow,
  toggleExpanded,
  type DetailRow,
} from './master-detail'
export { default as SvGridMasterDetail } from './SvGridMasterDetail.svelte'

export { default as SvPivotDesigner } from './SvPivotDesigner.svelte'
export {
  ALL_AGGREGATORS,
  AGG_LABEL,
  EMPTY_LAYOUT,
  defaultLayoutFor,
  type PivotField,
  type PivotValueChip,
  type PivotFilterChip,
  type PivotLayout,
  type PivotPreset,
  type Well,
} from './pivot-designer'

// The AI helpers (setAIProvider, aiFilter, aiSmartFill, aiSummarize, aiClassify,
// aiExport, aiFindAnomalies, aiChart, enableAiCharting, ...) are now BUILT-IN and
// FREE in @svgrid/grid - import them from there. Enterprise only registers its
// export engine so AI-planned Excel/PDF exports can run (see install.ts).
export { pivotToChartSpec, type PivotChartOptions } from './pivot-chart'

// Expression / query language (Pro). One predicate/scalar/change model that
// powers alerts (and, in time, styled + calculated columns). Leaf comparisons
// reuse the grid's own `applyExcelFilter`, so operators match the filter row.
export {
  evaluatePredicate,
  evaluateScalar,
  evaluateChange,
  BUILTIN_FUNCTION_NAMES,
  isBuiltinFunction,
} from './expressions/evaluate'
export {
  parsePredicate,
  stringifyPredicate,
  stringifyScalar,
  validateExpression,
  collectColumnRefs,
  ExpressionParseError,
} from './expressions/parse'
export {
  OPERATORS,
  operatorMeta,
  operatorsForType,
  isValueless,
  isSetOperator,
  isRangeOperator,
  columnById,
  resolveColumnRef,
  columnLabel,
  columnRefText,
  type ExprColumn,
  type ExprColumnType,
  type OperatorMeta,
} from './expressions/expression-columns'
export type {
  ScalarExpr,
  PredicateExpr,
  ChangeExpr,
  ComparisonOp,
  ArithmeticOp,
  AggFn,
  EvalContext,
  ExprRow,
} from './expressions/expression-types'
export { default as SvExpressionEditor } from './SvExpressionEditor.svelte'

// Alert Rules engine (Pro). Declarative "when this holds / this moves -> toast /
// badge / highlight / flash / prevent-edit / log". Authored at runtime,
// persisted, shareable. Surfacing reuses the grid's toast + conditional-format
// engines; `<SvGridAlerts>` is the runtime overlay the consumer mounts.
export { enableAlerts } from './alerts'
export {
  createAlertEngine,
  renderTemplate,
  type AlertEngine,
  type AlertEngineOptions,
  type ValidateEditResult,
} from './alerts/alert-engine'
export {
  attachAlertEngine,
  applyAlertEvents,
  type AlertAttachment,
  type AttachAlertOptions,
  type FlashTarget,
} from './alerts/alert-engine-attach'
export {
  memoryAlertRules,
  localStorageAlertRules,
  createAlertRules,
  type AlertRulesStorage,
  type AlertRulesManager,
} from './alerts/alert-storage'
export {
  createAlertObserver,
  type AlertObserver,
  type AlertObserverOptions,
} from './alerts/alert-observer'
export {
  createAlertScheduler,
  type AlertScheduler,
  type AlertSchedulerMode,
} from './alerts/alert-scheduler'
export { toConditionalFormats, rulesToConditionalFormats, type StylingContext } from './alerts/alert-formats'
export { alertStore } from './alerts/alert-store.svelte'
export type {
  AlertRule,
  AlertEvent,
  AlertTrigger,
  AlertAction,
  AlertActionKind,
  AlertActionStyle,
  AlertScope,
  AlertSeverity,
} from './alerts/alert-types'
export { default as SvGridAlerts } from './SvGridAlerts.svelte'
export { default as SvAlertRuleEditor } from './SvAlertRuleEditor.svelte'
export { default as SvAlertsManager } from './SvAlertsManager.svelte'
export { default as SvAlertsPanel } from './SvAlertsPanel.svelte'
