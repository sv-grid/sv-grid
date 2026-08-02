export {
  setLicenseKey,
  clearLicenseKey,
  getLicenseKey,
  isLicenseKeySet,
  hasValidLicense,
  assertEnterpriseLicensed,
  nudgeEnterprise,
  checkLicenseKey,
  type LicenseInfo,
  type LicenseStatus,
} from './license'

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
  validateField,
  applyComputed,
  validateEntity,
  type EntitySchema,
  type EntityField,
  type EntityFieldType,
  type EntityHooks,
  type FormFieldDescriptor,
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
  rowId,
  toSubmitValues,
  validateAll,
  type EditMode,
  type ControlKind,
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
  liveDataSamples,
  getLiveDataSample,
  type SampleApp,
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

export {
  // Provider plumbing
  setAIProvider,
  getAIProvider,
  hasAIProvider,
  mockAIProvider,
  type AIProvider,
  type AIRequest,
  type AITask,
  // Filter
  aiFilter,
  type AIFilterOptions,
  type AIFilterResult,
  type AIFilterClause,
  type AISortClause,
  // Smart fill
  aiSmartFill,
  type AISmartFillOptions,
  type AISmartFillResult,
  type AISmartFillExample,
  // Summarize
  aiSummarize,
  type AISummarizeOptions,
  type AISummarizeTarget,
  type AISummary,
  // Classify
  aiClassify,
  type AIClassifyOptions,
  type AIClassifyResult,
  // Natural-language export
  aiExport,
  type AIExportOptions,
  type AIExportPlan,
  // Anomaly detection
  aiFindAnomalies,
  type AIAnomaly,
  type AIAnomalyOptions,
  type AIAnomalyResult,
  // Natural-language chart ("chart this")
  aiChart,
  enableAiCharting,
  disableAiCharting,
  type AIChartOptions,
  type AIChartPlan,
  type AIChartType,
} from './ai'
export { pivotToChartSpec, type PivotChartOptions } from './pivot-chart'
