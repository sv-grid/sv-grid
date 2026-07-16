export { formatNumericWithConfig, resolveDatePattern } from './cell-formatting'
export {
  coerceExportDate,
  formatValueForExport,
  projectGridRows,
  toExcelNumFmt,
  valueForExcel,
  serializeDelimited,
  serializeJson,
  serializeMarkdown,
  serializeHtml,
  serializeXml,
  downloadTextFile,
  downloadBlobFile,
  copyTextToClipboard,
  type GridExportOptions,
  type GridExportScope,
  type GridExportColumn,
  type GridClipboardOptions,
  type GridClipboardFormat,
  type SerializeProgress,
  type SerializeOptions,
  type CsvOptions,
} from './export-format'

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
  type CellSpanParams,
  type ValueParserParams,
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
export { default as SvGridDropdown } from './SvGridDropdown.svelte'
export { default as SvCalendar, type CalendarValue, type CalendarPreset, type CalendarAnimation } from './SvCalendar.svelte'
export { default as SvTimePicker, type TimeValue } from './SvTimePicker.svelte'
export { default as SvDateTimePicker, type DateTimeValue } from './SvDateTimePicker.svelte'
// UI kit - shared editor contract (common props + a11y wiring for every editor)
export { editorAria, editorErrorId, type SvEditorProps, type EditorSize, type EditorAriaState } from './editor-contract'
// UI kit - headless cores (state + prop-getters you render yourself, like createSvGrid)
export {
  createListbox,
  toSelectedArray,
  type Listbox,
  type ListboxConfig,
  type ListboxValue,
  type ListboxRootProps,
  type OptionProps,
} from './createListbox.svelte'
// Selection family cores
export { createCombobox, type Combobox, type ComboboxConfig, type ComboboxValue } from './createCombobox.svelte'
export { createDropdownList, type DropdownList, type DropdownListConfig, type DropdownValue } from './createDropdownList.svelte'
export { createAutocomplete, type Autocomplete, type AutocompleteConfig } from './createAutocomplete.svelte'
export { createTagsInput, type TagsInput, type TagsInputConfig } from './createTagsInput.svelte'
export { createCountryInput, type CountryInput, type CountryInputConfig } from './createCountryInput.svelte'
// Text-input family cores
export { createNumberInput, type NumberInputConfig, type NumberInputCore } from './createNumberInput.svelte'
export { createMaskedInput, type MaskedInputConfig, type MaskedInputCore } from './createMaskedInput.svelte'
export { createPhoneInput, type PhoneInputConfig, type PhoneInputCore } from './createPhoneInput.svelte'
export { createColorInput, normalizeHex, type ColorInputConfig, type ColorInputCore } from './createColorInput.svelte'
export { createPasswordInput, passwordStrength, STRENGTH_LABELS, type PasswordInputConfig, type PasswordInputCore } from './createPasswordInput.svelte'
// Buttons & toggles family cores
export { createToggle, type Toggle, type ToggleConfig, type ToggleButtonProps } from './createToggle.svelte'
export { createSwitch, type Switch, type SwitchConfig, type SwitchProps } from './createSwitch.svelte'
export { createCheckbox, type Checkbox, type CheckboxConfig, type CheckboxBoxProps } from './createCheckbox.svelte'
export { createRadioGroup, type RadioGroup, type RadioGroupConfig, type RadioProps, type RadioGroupProps } from './createRadioGroup.svelte'
export { createRating, type Rating, type RatingConfig, type RatingFill, type RatingRootProps, type RatingStarProps } from './createRating.svelte'
// Date & time family cores
export { createCalendar, normalizeCalendarValue, type Calendar, type CalendarConfig, type CalendarDayState, type CalendarNavDir, type CalendarNameFormat, type DisplayMode } from './createCalendar.svelte'
export { createTimePicker, parseTimeValue, type TimePicker, type TimePickerConfig, type TimeSelection, type TimeFormat, type DialTick } from './createTimePicker.svelte'
export { createDateTimePicker, type DateTimePicker, type DateTimePickerConfig, type DropDownDisplayMode, type DateTimeTab } from './createDateTimePicker.svelte'
// Layout & range family cores
export { createTabs, type Tabs, type TabsConfig, type TabsOrientation, type TabsActivation } from './createTabs.svelte'
export { createTree, treeDescendantIds, treeCheckState, type Tree, type TreeConfig, type TreeRow, type CheckState } from './createTree.svelte'
export { createSlider, type Slider, type SliderConfig, type SliderValue, type SliderOrientation, type SliderThumb, type SliderPoint } from './createSlider.svelte'
export { createGauge, type Gauge, type GaugeConfig, type GaugePoint } from './createGauge.svelte'
// UI kit - Group B (buttons & toggles)
export { default as SvButton } from './SvButton.svelte'
export { default as SvRepeatButton } from './SvRepeatButton.svelte'
export { default as SvToggleButton } from './SvToggleButton.svelte'
export { default as SvSwitchButton } from './SvSwitchButton.svelte'
export { default as SvCheckBox } from './SvCheckBox.svelte'
export { default as SvRadioGroup, type RadioOption } from './SvRadioGroup.svelte'
export { default as SvRating } from './SvRating.svelte'
// UI kit - Group C (text inputs)
export { default as SvNumberInput } from './SvNumberInput.svelte'
export { default as SvPasswordInput } from './SvPasswordInput.svelte'
export { default as SvMaskedInput } from './SvMaskedInput.svelte'
export { default as SvPhoneInput } from './SvPhoneInput.svelte'
export { default as SvColorInput } from './SvColorInput.svelte'
export { applyMask, unmask, isMaskComplete } from './datetime/mask'
export { COUNTRIES, COUNTRY_BY_CODE, flagEmoji, type Country } from './countries'
// UI kit - Group D (selection overlays)
export { default as SvListBox } from './SvListBox.svelte'
export { default as SvDropDownList } from './SvDropDownList.svelte'
export { default as SvComboBox } from './SvComboBox.svelte'
export { default as SvAutoComplete } from './SvAutoComplete.svelte'
export { default as SvTagsInput } from './SvTagsInput.svelte'
export { default as SvCountryInput } from './SvCountryInput.svelte'
export { filterOptions, type ListOption } from './list-option'
// UI kit - Group E (range & feedback)
export { default as SvSlider } from './SvSlider.svelte'
export { default as SvGauge } from './SvGauge.svelte'
// UI kit - Group F (composite / layout)
export { default as SvTabs, type TabItem } from './SvTabs.svelte'
export { default as SvTree, type TreeNode as SvTreeNode } from './SvTree.svelte'
export { default as SvForm, type FormField, type FormFieldType } from './SvForm.svelte'
export { anchoredRect, portalToBody, PANEL_THEME_VARS, type AnchoredRect } from './popover'
export {
  toDate, startOfDay, addDays, addMonths, addYears, clampDate, isSameDay,
  monthMatrix, isoWeek, decadeRange, withTime, snapMinute, type DateLike,
} from './datetime/date-core'
export { formatDate, parseDate, tokenizeMask } from './datetime/date-format'
export {
  selectDate, rangeDays, isSelected, isMultiSelectMode, emptySelection,
  type SelectionMode, type SelectionState,
} from './datetime/date-selection'
export {
  isDisabledDay, isOutOfRange, isRestricted, isImportant, type RestrictOptions,
} from './datetime/date-restrict'
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
  spansToMerges,
  type SpanColumn,
  type SpreadsheetActionOptions,
  type MergeSpec,
  type CellBorderSpec,
  type BorderSpec,
} from './spreadsheet'
export { rowResize, type RowResizeOptions } from './row-resize'
export { rowDropZone, type RowDragEndEvent, type RowDropZoneOptions } from './row-drag'
export { resolveColumnTypes, inferCellDataType, type CellDataType } from './column-types'
export {
  computeColumnGroupMeta,
  hiddenLeavesForCollapse,
  type ColumnGroupMeta,
  type ColumnGroupShow,
} from './column-groups'
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
