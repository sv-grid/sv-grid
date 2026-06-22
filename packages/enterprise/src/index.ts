export {
  setLicenseKey,
  clearLicenseKey,
  getLicenseKey,
  isLicenseKeySet,
  hasValidLicense,
  assertEnterpriseLicensed,
} from './license'

export {
  exportGrid,
  type ExportFormat,
  type ExportOptions,
  type ExportColumn,
  type ExportCellStyle,
  type ExportStyles,
  type ExportHeaderFooterLine,
  type ExportSheet,
} from './export'
export { printGrid, type PrintOptions } from './print'
export {
  importData,
  type ImportFormat,
  type ImportFieldType,
  type ImportOptions,
  type ImportResult,
  type ImportColumnMap,
  type ImportColumnTypes,
  type ImportRowError,
  type ImportValidator,
} from './import'
export { installEnterprise, type EnterpriseGridApi, type EnterpriseAIApi, type EnterprisePivotApi } from './install'
export {
  createStagedEditing,
  type StagedChange,
  type StagedEditingApi,
  type StagedEditingEvent,
} from './staged-editing'
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
} from './ai'
