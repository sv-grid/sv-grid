export { formatNumericWithConfig, resolveDatePattern } from './cell-formatting'

export {
  columnFilteringFeature,
  columnGroupingFeature,
  createCoreRowModel,
  createExpandedRowModel,
  createFilteredRowModel,
  createGroupedRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  applyGroupAggregate,
  filterFns,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  type Cell,
  type CellContext,
  type EditorContext,
  type CellData,
  type ActiveCellState,
  type CellFormatConfig,
  type CellFormatter,
  type Column,
  type ColumnDef,
  type ColumnDefTemplate,
  type GroupAggregator,
  type Header,
  type HeaderContext,
  type HeaderGroup,
  type Row,
  type RowData,
  type SortingState,
  type SvGrid as SvGridInstance,
  type SvGridOptions,
  type TableFeatures,
  type Updater,
} from './core'

export { createGrid, createSvGrid, type SvelteGrid } from './createGrid.svelte'
export { createGridState, createSvGridState } from './createGridState.svelte'
export { subscribeGrid, subscribeSvGrid } from './subscribe'
export { default as SvGrid } from './SvGrid.svelte'
export { default as FlexRender } from './FlexRender.svelte'
export { renderComponent, renderSnippet } from './render-component'
export { default as SvGridChart } from './SvGridChart.svelte'
export {
  buildChart,
  rowsToChartSpec,
  niceScale,
  niceLogScale,
  linearTrend,
  simpleMovingAverage,
  exponentialMovingAverage,
  computeOverlay,
  buildLinePath,
  sampleGradient,
  pickContrastText,
  DEFAULT_PALETTE,
  type ChartType,
  type ChartSpec,
  type ChartSeries,
  type ChartGeometry,
  type ChartBar,
  type ChartLine,
  type ChartLinePoint,
  type ChartPieSlice,
  type ChartSelection,
  type ChartReferenceLine,
  type ChartRefLineGeo,
  type ChartRefLineGeoV,
  type ChartScatterDot,
  type ScatterPoint,
  type NiceScale,
  type SeriesOverlay,
  type SeriesPattern,
  type ChartAnnotation,
  type ChartHeatmapCell,
  type ChartFunnelSegment,
  type ChartRadarSeries,
  type ChartRadarAxis,
  type ChartTreemapCell,
  type ChartCalendarCell,
  type ChartGaugeLayout,
  type ChartSankeyNode,
  type ChartSankeyLink,
  type TreeNode,
} from './chart'
export {
  chartToSvgString,
  downloadChartSvg,
  chartToPngBlob,
  downloadChartPng,
  type ChartExportOptions,
} from './chart-export'
export {
  buildSparkline,
  toSparklineValues,
  type SparklineConfig,
  type SparklineType,
  type SparklineGeometry,
} from './sparkline'
export {
  spreadsheetLayout,
  type SpreadsheetActionOptions,
  type MergeSpec,
  type CellBorderSpec,
  type BorderSpec,
} from './spreadsheet'
export { rowResize, type RowResizeOptions } from './row-resize'
export {
  createHyperFormulaSheet,
  type HyperFormulaSheet,
  type HyperFormulaSheetConfig,
  type HyperFormulaInstance,
} from './hyperformula-adapter'
export {
  createCollaboration,
  broadcastChannelTransport,
  type CollabUser,
  type CollabCell,
  type CollabPresence,
  type CollabMessage,
  type CollabTransport,
  type Collaboration,
} from './collaboration'
export {
  createServerDataSource,
  type ServerDataSource,
  type ServerRequest,
  type ServerResult,
  type ServerController,
  type ServerState,
  type ServerSortModel,
  type ServerFilterModel,
} from './server-data-source'
export {
  createNamedViews,
  memoryViews,
  localStorageViews,
  attachAutoSavedView,
  type SavedView,
  type ViewStorage,
  type NamedViews,
  type AutoSavedViewOptions,
} from './named-views'
export {
  resolveCellFormat,
  computeColumnStat,
  lerpColor,
  contrastText,
  type ConditionalFormat,
  type ConditionalFormatSpec,
  type ColorScaleFormat,
  type DataBarFormat,
  type IconSetFormat,
  type RuleFormat,
  type ResolvedCellFormat,
} from './conditional-formatting'
export { getKeyboardIntent, getNextActiveCell, type GridKeyboardIntent } from './keyboard'
export { createVirtualizer } from './virtualization/virtualizer'
export { createSvelteVirtualizer } from './virtualization/svelte-virtualizer.svelte'
export { createColumnVirtualizer } from './virtualization/column-virtualizer'
export type { VirtualItem, VirtualizerOptions, VirtualizerState } from './virtualization/types'
export type { SvGridApi, SvGridFilterOperator, SvGridWrapperProps } from './svgrid-wrapper.types'
export {
  parseEditorValue,
  normalizeEditorOptions,
  type CellEditorType,
  type CellEditorOption,
} from './editors/cell-editors'
export {
  applyExcelFilter,
  normalizeForFilter,
  type ExcelFilter,
  type ExcelFilterOperator,
  type ExcelFilterOptions,
} from './filtering/excel-filters'
export {
  getGridCellDomId,
  getGridCellA11yProps,
  getGridHeaderA11yProps,
  getGridRootA11yProps,
  getGridRowA11yProps,
  type GridCellA11yInput,
  type GridColumnA11yInput,
  type GridSortDirection,
} from './a11y'

/**
 * Compatibility alias for teams migrating from `createTable`.
 */
export { createSvGrid as createTable } from './createGrid.svelte'
