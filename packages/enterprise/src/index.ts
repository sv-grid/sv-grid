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
export { buildPdfDocDefinition, type PdfExportOptions, type PdfPageSize } from './export-pdf'
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
// In-grid pivot mode (Pro). `enablePivot()` registers the pivot engine so
// `<SvGrid pivot={...}>` renders a pivot table in place of the flat table.
export { enablePivot } from './pivot-enable'
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
