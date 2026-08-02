import type { Component } from 'svelte'
import Calendar250 from '../demos/250-calendar.svelte'
import TimePicker251 from '../demos/251-timepicker.svelte'
import DateTimePicker252 from '../demos/252-datetimepicker.svelte'
import DateRangeInput283 from '../demos/283-daterange-input.svelte'
import ButtonsToggles253 from '../demos/253-buttons-toggles.svelte'
import ButtonGroup284 from '../demos/284-button-group.svelte'
import ButtonDemo305 from '../demos/305-button.svelte'
import RepeatButton306 from '../demos/306-repeat-button.svelte'
import ToggleButton307 from '../demos/307-toggle-button.svelte'
import Switch308 from '../demos/308-switch.svelte'
import CheckBox309 from '../demos/309-checkbox.svelte'
import RadioGroup310 from '../demos/310-radio-group.svelte'
import Rating311 from '../demos/311-rating.svelte'
import TextInputs254 from '../demos/254-text-inputs.svelte'
import NumberInput300 from '../demos/300-number-input.svelte'
import PasswordInput301 from '../demos/301-password-input.svelte'
import MaskedInput302 from '../demos/302-masked-input.svelte'
import PhoneInput303 from '../demos/303-phone-input.svelte'
import ColorInput304 from '../demos/304-color-input.svelte'
import Selection255 from '../demos/255-selection.svelte'
import ListBox312 from '../demos/312-listbox.svelte'
import ComboBox313 from '../demos/313-combobox.svelte'
import DropDownList314 from '../demos/314-dropdownlist.svelte'
import DockLayout361 from '../demos/361-dock-layout.svelte'
import DockManager362 from '../demos/362-dock-manager.svelte'
import DockHeaders363 from '../demos/363-dock-headers.svelte'
import DockApi364 from '../demos/364-dock-api.svelte'
import DockDashboard365 from '../demos/365-dock-dashboard.svelte'
import DockKeepAlive366 from '../demos/366-dock-keepalive.svelte'
import AutoComplete315 from '../demos/315-autocomplete.svelte'
import TagsInput316 from '../demos/316-tags-input.svelte'
import CountryInput317 from '../demos/317-country-input.svelte'
import ListVirtualization323 from '../demos/323-list-virtualization.svelte'
import ComboRemote329 from '../demos/329-combobox-remote.svelte'
import RangeFeedback256 from '../demos/256-range-feedback.svelte'
import TabsTreeForm257 from '../demos/257-tabs-tree-form.svelte'
import Slider318 from '../demos/318-slider.svelte'
import Gauge319 from '../demos/319-gauge.svelte'
import Progress330 from '../demos/330-progress.svelte'
import Tabs320 from '../demos/320-tabs.svelte'
import Tree321 from '../demos/321-tree.svelte'
import FormDemo322 from '../demos/322-form.svelte'
import TreeScale324 from '../demos/324-tree-scale.svelte'
import TabsAdvanced325 from '../demos/325-tabs-advanced.svelte'
import Menu326 from '../demos/326-menu.svelte'
import NavPane327 from '../demos/327-navpane.svelte'
import TreeEditable328 from '../demos/328-tree-editable.svelte'
import Accordion285 from '../demos/285-accordion.svelte'
import Splitter286 from '../demos/286-splitter.svelte'
import FileUpload287 from '../demos/287-file-upload.svelte'
import Overlays288 from '../demos/288-overlays.svelte'
import AppOverlays331 from '../demos/331-app-overlays.svelte'
import AppNavigation332 from '../demos/332-app-navigation.svelte'
import CommandPalette340 from '../demos/340-command-palette.svelte'
import RichTextEditor341 from '../demos/341-rich-text-editor.svelte'
import CarouselTour342 from '../demos/342-carousel-tour.svelte'
import KanbanBoard343 from '../demos/343-kanban-board.svelte'
import KanbanSprint344 from '../demos/344-kanban-sprint.svelte'
import KanbanPipeline345 from '../demos/345-kanban-pipeline.svelte'
import KanbanVirtualized346 from '../demos/346-kanban-virtualized.svelte'
import KanbanSupport347 from '../demos/347-kanban-support.svelte'
import KanbanContent348 from '../demos/348-kanban-content.svelte'
import KanbanSubtasks349 from '../demos/349-kanban-subtasks.svelte'
import KanbanStructure350 from '../demos/350-kanban-structure.svelte'
import KanbanPower351 from '../demos/351-kanban-power.svelte'
import KanbanEpics352 from '../demos/352-kanban-epics.svelte'
import SchedulerIntro363 from '../demos/363-scheduler-intro.svelte'
import SchedulerTimeline371 from '../demos/371-scheduler-timeline.svelte'
import SchedulerSelection372 from '../demos/372-scheduler-selection.svelte'
import SchedulerAppCalendar381 from '../demos/381-scheduler-app-calendar.svelte'
import SchedulerAppClinic382 from '../demos/382-scheduler-app-clinic.svelte'
import SchedulerAppDispatch383 from '../demos/383-scheduler-app-dispatch.svelte'
import SchedulerAppRoadmap384 from '../demos/384-scheduler-app-roadmap.svelte'
import SchedulerAppContent385 from '../demos/385-scheduler-app-content.svelte'
import AppFeedback333 from '../demos/333-app-feedback.svelte'
import StatusDisplay339 from '../demos/339-status-display.svelte'
import InputEditors334 from '../demos/334-input-editors.svelte'
import TreeSelect335 from '../demos/335-tree-select.svelte'
import GridSelect336 from '../demos/336-grid-select.svelte'
import CheckoutForm334Recipe from '../demos/334-checkout-form.svelte'
import BookingForm335Recipe from '../demos/335-booking-form.svelte'
import FilterBar336Recipe from '../demos/336-filter-bar.svelte'
import EventCalendar338 from '../demos/338-event-calendar.svelte'
import CalendarRange258 from '../demos/258-calendar-range.svelte'
import DateTimePickerForms259 from '../demos/259-datetimepicker-forms.svelte'
import HeadlessEditors260 from '../demos/260-headless-editors.svelte'
import HlCombobox from '../demos/261-headless-combobox.svelte'
import HlDropdownList from '../demos/262-headless-dropdownlist.svelte'
import HlAutocomplete from '../demos/263-headless-autocomplete.svelte'
import HlTagsInput from '../demos/264-headless-tagsinput.svelte'
import HlCountryInput from '../demos/265-headless-countryinput.svelte'
import HlNumberInput from '../demos/266-headless-numberinput.svelte'
import HlMaskedInput from '../demos/267-headless-maskedinput.svelte'
import HlPhoneInput from '../demos/268-headless-phoneinput.svelte'
import HlColorInput from '../demos/269-headless-colorinput.svelte'
import HlPasswordInput from '../demos/270-headless-passwordinput.svelte'
import HlToggleButton from '../demos/271-headless-togglebutton.svelte'
import HlSwitchButton from '../demos/272-headless-switchbutton.svelte'
import HlCheckbox from '../demos/273-headless-checkbox.svelte'
import HlRadioGroup from '../demos/274-headless-radiogroup.svelte'
import HlRating from '../demos/275-headless-rating.svelte'
import HlCalendar from '../demos/276-headless-calendar.svelte'
import HlTimePicker from '../demos/277-headless-timepicker.svelte'
import HlDateTimePicker from '../demos/278-headless-datetimepicker.svelte'
import HlTabs from '../demos/279-headless-tabs.svelte'
import HlTree from '../demos/280-headless-tree.svelte'
import HlSlider from '../demos/281-headless-slider.svelte'
import HlGauge from '../demos/282-headless-gauge.svelte'
import TradingDesk from '../demos/00-trading-desk.svelte'
import QuickStart from '../demos/01-quick-start.svelte'
import SortFilterPaginate from '../demos/02-sort-filter-paginate.svelte'
import ExcelFilters from '../demos/03-excel-filters.svelte'
import SelectionCopyPaste from '../demos/04-selection-copy-paste.svelte'
import InlineEditing from '../demos/05-inline-editing.svelte'
import LargeDataset from '../demos/06-large-dataset.svelte'
import Grouping from '../demos/07-grouping-aggregation.svelte'
import TreeAndMasterDetail from '../demos/08-tree-and-master-detail.svelte'
import ServerSide from '../demos/09-server-side.svelte'
import CustomCells from '../demos/10-custom-cells-and-themes.svelte'
import StockMarket from '../demos/11-stock-market.svelte'
import HrTeam from '../demos/12-hr-team.svelte'
import Finances from '../demos/13-finances.svelte'
import Industrial from '../demos/14-industrial.svelte'
import Localization from '../demos/15-localization.svelte'
import CspCompliant from '../demos/16-csp-compliant.svelte'
import Accessibility from '../demos/17-accessibility.svelte'
import CascadeEditing from '../demos/18-cascade-editing.svelte'
import Ssr from '../demos/19-ssr.svelte'
import IndustrialDashboard from '../demos/20-industrial-dashboard.svelte'
import ExportAndPrint from '../demos/21-export-and-print.svelte'
import AdminTemplate from '../demos/22-admin-template.svelte'
import BulkActions from '../demos/23-bulk-actions.svelte'
import Validation from '../demos/24-validation.svelte'
import ColumnPinning from '../demos/25-column-pinning.svelte'
import ListChipsEditors from '../demos/26-list-chips-editors.svelte'
import SpreadsheetRibbon from '../demos/27-spreadsheet-ribbon.svelte'
import OrgChartTree from '../demos/28-org-chart-tree.svelte'
import WbsTree from '../demos/29-wbs-project-tree.svelte'
import BomTree from '../demos/30-bom-tree.svelte'
import LazyTree from '../demos/31-lazy-tree-load.svelte'
import ManufacturingOps from '../demos/32-manufacturing-ops.svelte'
import ServerInfinite from '../demos/33-server-infinite.svelte'
import RealtimeOrders from '../demos/34-realtime-orders.svelte'
import PermissionsAudit from '../demos/35-permissions-audit.svelte'
import ReportingWorkspace from '../demos/36-reporting-workspace.svelte'
import ThemingStudio from '../demos/37-theming-studio.svelte'
import RtlI18n from '../demos/38-rtl-i18n.svelte'
import PrintBoardExport from '../demos/39-print-board-export.svelte'
import FormsMasterDetail from '../demos/40-forms-master-detail.svelte'
import HealthcareEmr from '../demos/41-healthcare-emr.svelte'
import LogisticsFleet from '../demos/42-logistics-fleet.svelte'
import ComplianceQueue from '../demos/43-compliance-queue.svelte'
import FieldService from '../demos/44-field-service.svelte'
import GanttChart from '../demos/45-gantt-chart.svelte'
import Scheduler from '../demos/46-scheduler.svelte'
import TrashTruckTimeline from '../demos/47-trash-truck-timeline.svelte'
import CrmSalesPipeline from '../demos/48-crm-sales-pipeline.svelte'
import AdminDashboard from '../demos/49-admin-dashboard.svelte'
import SellerPanel from '../demos/50-seller-panel.svelte'
import AiAssistant from '../demos/51-ai-assistant.svelte'
import PivotTable from '../demos/52-pivot-table.svelte'
// Private (SvGrid Studio visual designer - not in the public repo): 192, 201.
import StudioLiveSql from '../demos/193-studio-live-sql.svelte'
import PgliteNorthwind from '../demos/338-pglite-northwind.svelte'
import StudioSupabase from '../demos/194-studio-supabase.svelte'
import StudioRelations from '../demos/195-studio-relations.svelte'
import StudioAuth from '../demos/196-studio-auth.svelte'
import StudioChart from '../demos/197-studio-chart.svelte'
import StudioFormFields from '../demos/198-studio-form-fields.svelte'
import StudioComputedHooks from '../demos/199-studio-computed-hooks.svelte'
import StudioDashboard from '../demos/200-studio-dashboard.svelte'
import ExcelImport from '../demos/53-excel-import.svelte'
import ColumnsHierarchy from '../demos/54-columns-hierarchy.svelte'
import StateMaintenance from '../demos/55-state-maintenance.svelte'
import ExportThemeMatched from '../demos/56-export-theme-matched.svelte'
import ExportHeaderFooterLogo from '../demos/57-export-header-footer-logo.svelte'
import ExportWithImages from '../demos/58-export-with-images.svelte'
import ExportMultiSheet from '../demos/59-export-multi-sheet.svelte'
import PivotExpandable from '../demos/60-pivot-expandable.svelte'
import ConditionalStyling from '../demos/62-conditional-styling.svelte'
import ColumnLayoutApi from '../demos/63-column-layout-api.svelte'
import FilterBetween from '../demos/64-filter-between-operator.svelte'
import KeyboardShortcuts from '../demos/65-keyboard-shortcuts.svelte'
import CustomCellEditors from '../demos/66-custom-cell-editors.svelte'
import ContextMenu from '../demos/67-context-menu.svelte'
import DependentDropdowns from '../demos/68-dependent-dropdowns.svelte'
import HighlightedSearch from '../demos/69-highlighted-search.svelte'
import MultiGridSync from '../demos/70-multi-grid-sync.svelte'
import SubmitValidation from '../demos/71-submit-validation.svelte'
import GraphqlAdapter from '../demos/72-graphql-adapter.svelte'
import ChartJsSync from '../demos/73-chartjs-sync.svelte'
import ThemeIntegrations from '../demos/74-theme-integrations.svelte'
import AiSmartPaste from '../demos/75-ai-smart-paste.svelte'
import SmartChart from '../demos/77-smart-chart.svelte'
import MillionRows from '../demos/78-million-rows.svelte'
import LoadingFromRest from '../demos/79-loading-from-rest.svelte'
import CellTypesShowcase from '../demos/80-cell-types-showcase.svelte'
import MobileCardView from '../demos/81-mobile-card-view.svelte'
import ConditionalFormSchema from '../demos/82-conditional-form-schema.svelte'
import SpreadsheetFormulas from '../demos/83-spreadsheet-formulas.svelte'
import CellBordersDemo     from '../demos/169-cell-borders.svelte'
import CellMergingDemo     from '../demos/170-cell-merging.svelte'
import PersistentState     from '../demos/171-persistent-state.svelte'
import AutosizeColumns     from '../demos/172-autosize-columns.svelte'
import HyperFormulaDemo    from '../demos/173-hyperformula.svelte'
import ZebraRows           from '../demos/174-zebra-rows.svelte'
import EditorTypes      from '../demos/84-editor-types.svelte'
import TooltipsAndNotes from '../demos/85-tooltips-and-notes.svelte'
import UndoRedo         from '../demos/86-undo-redo.svelte'
import FindInGrid       from '../demos/87-find-in-grid.svelte'
import StagedEditing    from '../demos/88-staged-editing.svelte'
import GroupPanel       from '../demos/89-group-panel.svelte'
import SelectionApi     from '../demos/90-selection-api.svelte'
import CellComments              from '../demos/91-cell-comments.svelte'
import NlFilterBar               from '../demos/92-nl-filter-bar.svelte'
import PasswordProtectedExport   from '../demos/93-password-protected-export.svelte'
import HighContrastTheme         from '../demos/96-high-contrast-theme.svelte'
import AnomalyHighlights         from '../demos/100-anomaly-highlights.svelte'
import FormulasInXlsx            from '../demos/101-formulas-in-xlsx.svelte'
import ConditionalFormatting     from '../demos/94-conditional-formatting.svelte'
import FillHandle                from '../demos/95-fill-handle.svelte'
import SideDrawerEdit            from '../demos/97-side-drawer-edit.svelte'
import AdvancedFilterBuilder     from '../demos/98-advanced-filter-builder.svelte'
import TopNFilter                from '../demos/99-top-n-filter.svelte'
import TreeCheckboxCascade       from '../demos/102-tree-checkbox-cascade.svelte'
import AsyncValidation           from '../demos/103-async-validation.svelte'
import ValueParser               from '../demos/175-value-parser.svelte'
import ProgrammaticEditing       from '../demos/176-programmatic-editing.svelte'
import FullRowEditing            from '../demos/177-full-row-editing.svelte'
import RowReorder                from '../demos/105-row-reorder.svelte'
import DetailRows                from '../demos/106-detail-rows.svelte'
import MasterDetailGrid          from '../demos/181-master-detail-grid.svelte'
import AlignedGrids              from '../demos/182-aligned-grids.svelte'
import CollapsibleColumnGroups   from '../demos/183-collapsible-column-groups.svelte'
import ColumnMenuTabs            from '../demos/185-column-menu-tabs.svelte'
import HeadlessTable             from '../demos/186-headless-table.svelte'
import HeadlessVirtual           from '../demos/187-headless-virtual.svelte'
import HeadlessStyled            from '../demos/188-headless-styled.svelte'
import HeadlessSharedState       from '../demos/189-headless-shared-state.svelte'
import HeadlessRowModels         from '../demos/190-headless-row-models.svelte'
import HeadlessServerSide        from '../demos/191-headless-server-side.svelte'
import PinnedRows                from '../demos/107-pinned-rows.svelte'
import PinnedRowsEngine          from '../demos/108-pinned-rows-engine.svelte'
import ColumnReorderEngine       from '../demos/109-column-reorder-engine.svelte'
import LocaleAwareFilter         from '../demos/110-locale-aware-filter.svelte'
import SetFilterAdvanced         from '../demos/111-set-filter-advanced.svelte'
import MultiConditionFilter      from '../demos/178-multi-condition-filter.svelte'
import FloatingFilters           from '../demos/179-floating-filters.svelte'
import RowDragging                from '../demos/180-row-dragging.svelte'
import ExternalDropZone           from '../demos/184-external-drop-zone.svelte'
import BarcodeCells              from '../demos/112-barcode-cells.svelte'
import TestSystemsMonitor       from '../demos/120-test-systems-monitor.svelte'
import CursorPagination          from '../demos/113-cursor-pagination.svelte'
import ServerGrouping            from '../demos/114-server-grouping.svelte'
import OptimisticUpdates         from '../demos/115-optimistic-updates.svelte'
import WebSocketLiveUpdates      from '../demos/116-websocket-live-updates.svelte'
import BulkOperations            from '../demos/117-bulk-operations.svelte'
import RangeSelection            from '../demos/118-range-selection.svelte'
import LiveDashboard             from '../demos/118-live-dashboard.svelte'
import WorkbookMultiSheet        from '../demos/119-workbook-multi-sheet.svelte'
import PivotConditionalCells     from '../demos/121-pivot-conditional-cells.svelte'
import PivotDrillThrough         from '../demos/122-pivot-drill-through.svelte'
import PivotTotals               from '../demos/123-pivot-totals.svelte'
import PivotOlap                 from '../demos/124-pivot-olap.svelte'
import PivotCharts               from '../demos/125-pivot-charts.svelte'
import PivotDesigner             from '../demos/168-pivot-designer.svelte'
import ExportGroupedGrid         from '../demos/126-export-grouped-grid.svelte'
import ExportPivotGrid           from '../demos/127-export-pivot-grid.svelte'
import ExportFormattingAndXls    from '../demos/201-export-formatting-and-xls.svelte'
import ExportPdfGroupedAndPrint  from '../demos/202-export-pdf-grouped-and-print.svelte'
import AiExportAndAnomalies      from '../demos/203-ai-export-and-anomalies.svelte'
import ImportDialog              from '../demos/204-import-dialog.svelte'
import DevMigrationFromAg        from '../demos/139-migration-from-ag-grid.svelte'
import ShortcutConfig            from '../demos/135-shortcut-config.svelte'
import SparklineCells            from '../demos/140-sparkline-cells.svelte'
import GroupAggregators          from '../demos/142-group-aggregators.svelte'
import NamedViews                from '../demos/143-named-views.svelte'
import StatusBar                 from '../demos/144-status-bar.svelte'
import TransactionApi             from '../demos/145-transaction-api.svelte'
import ToolPanel                 from '../demos/146-tool-panel.svelte'
import IntegratedCharts          from '../demos/147-integrated-charts.svelte'
import BuiltInCharting           from '../demos/353-built-in-charting.svelte'
import ChartingMultiSeries       from '../demos/354-charting-multi-series.svelte'
import ChartingCustomBuildSpec   from '../demos/355-charting-custom-buildspec.svelte'
import SpreadsheetChart          from '../demos/356-spreadsheet-chart.svelte'
import ChartingByDate            from '../demos/358-charting-by-date.svelte'
import AiChartThis               from '../demos/357-ai-chart-this.svelte'
import PivotChart                from '../demos/359-pivot-chart.svelte'
import PivotModeGrid             from '../demos/360-pivot-mode-grid.svelte'
import ServerRowModel            from '../demos/148-server-row-model.svelte'
import ServerGroupingModel       from '../demos/344-server-grouping-model.svelte'
import LiveRestDummyJson         from '../demos/337-live-rest-dummyjson.svelte'
import RealtimeCollaboration     from '../demos/149-realtime-collaboration.svelte'
import ScatterBubble             from '../demos/150-scatter-bubble.svelte'
import TimeSeriesChart           from '../demos/151-time-series-chart.svelte'
import ChartWizard               from '../demos/152-chart-wizard.svelte'
import ChartZoomBrush            from '../demos/153-chart-zoom-brush.svelte'
import ChartHeatmap              from '../demos/154-chart-heatmap.svelte'
import ChartAnalytics            from '../demos/155-chart-analytics.svelte'
import ChartPatterns             from '../demos/156-chart-patterns.svelte'
import ChartForecastBand         from '../demos/157-chart-forecast-band.svelte'
import ChartWaterfall            from '../demos/158-chart-waterfall.svelte'
import ChartStreaming            from '../demos/159-chart-streaming.svelte'
import ChartFunnel               from '../demos/160-chart-funnel.svelte'
import ChartRadar                from '../demos/161-chart-radar.svelte'
import ChartCalendar             from '../demos/162-chart-calendar.svelte'
import ChartGauge                from '../demos/163-chart-gauge.svelte'
import ChartTreemap              from '../demos/164-chart-treemap.svelte'
import ChartSankey               from '../demos/165-chart-sankey.svelte'
import PivotAnalysisWorkspace    from '../demos/166-pivot-analysis-workspace.svelte'
import ProjectTracker            from '../demos/167-project-tracker.svelte'
import ProjectManagement         from '../demos/205-project-management.svelte'
import CellValidation            from '../demos/206-cell-validation.svelte'
import BlankSheet                from '../demos/207-blank-sheet.svelte'
import FreezePanes               from '../demos/208-freeze-panes.svelte'
import DataValidationSheet       from '../demos/209-data-validation.svelte'
import FormatCells               from '../demos/210-format-cells.svelte'
import FinancialModel            from '../demos/211-financial-model.svelte'
import DashboardSheet            from '../demos/212-dashboard-sheet.svelte'
import ConditionalFormattingEngine from '../demos/141-conditional-formatting.svelte'

// Bundle the raw .svelte source for every demo at build time so the Source
// button can display the exact file the user would copy into their project.
// Vite's `?raw` query inlines file text - `eager: true` returns a synchronous map.
const SOURCE_FILES = import.meta.glob('../demos/*.svelte', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function sourceFor(id: string): string {
  const match = Object.entries(SOURCE_FILES).find(([path]) => path.includes(`/${id}.svelte`))
  return match ? match[1] : `// source not found for ${id}`
}

/**
 * Sidebar groups, modelled on DevExpress / Kendo UI / Syncfusion demo
 * sites: every feature gets its own focused lane so the user can drill
 * straight to "show me grouping" or "show me real-time" without
 * scrolling past 60 unrelated demos.
 *
 * Enterprise (@svgrid/enterprise) demos live under their own product
 * lanes - 'Data Export & Import', 'Pivot Grid', 'Studio', 'AI' - each
 * badged "Enterprise" in the sidebar. Every such demo also carries an
 * explicit `pro: true` flag the sidebar draws as a small dot.
 */
export type DemoCategory =
  | 'Getting Started'
  | 'Headless'
  | 'Editing'
  | 'Filtering & Search'
  | 'Sorting & Grouping'
  | 'Selection & Clipboard'
  | 'Columns'
  | 'Rows & Cells'
  | 'Tree & Hierarchy'
  | 'Master-Detail & Forms'
  | 'Server-Side Data'
  | 'Real-time & Streaming'
  | 'Spreadsheet'
  | 'Charts'
  | 'Kanban'
  | 'Scheduler'
  | 'Themes & Styling'
  | 'Keyboard & Accessibility'
  | 'Mobile & Responsive'
  | 'Integrations'
  | 'Industry Templates'
  // Enterprise product lanes (@svgrid/enterprise). Split out of the old
  // single 'Pro' lane so each shows as its own Enterprise category.
  | 'Data Export & Import'
  | 'Pivot Grid'
  | 'Studio'
  | 'AI'
  // SvGrid Editors product lanes (@svgrid/grid UI components). A separate
  // product in the switcher so they don't bloat the main grid gallery.
  | 'Date & Time'
  | 'Buttons & Toggles'
  | 'Inputs'
  | 'Selection'
  | 'Range & Feedback'
  | 'Layout'
  | 'Headless Editors'

/**
 * Categories that belong to the paid @svgrid/enterprise product. The sidebar
 * badges these group headers as "Enterprise".
 */
export const ENTERPRISE_CATEGORIES = new Set<DemoCategory>([
  'Data Export & Import',
  'Pivot Grid',
  'Studio',
  'AI',
])

export function isEnterpriseCategory(category: DemoCategory): boolean {
  return ENTERPRISE_CATEGORIES.has(category)
}

/**
 * Categories that belong to the "SvGrid Editors" product - the standalone UI
 * components in @svgrid/grid that double as grid cell editors. Grouped behind
 * their own switcher entry so they stay out of the main grid gallery.
 */
export const EDITOR_CATEGORIES = new Set<DemoCategory>([
  'Date & Time',
  'Buttons & Toggles',
  'Inputs',
  'Selection',
  'Range & Feedback',
  'Layout',
  'Headless Editors',
])

export function isEditorCategory(category: DemoCategory): boolean {
  return EDITOR_CATEGORIES.has(category)
}

export const CATEGORY_ORDER: DemoCategory[] = [
  'Getting Started',
  'Editing',
  'Filtering & Search',
  'Sorting & Grouping',
  'Selection & Clipboard',
  'Columns',
  'Rows & Cells',
  'Tree & Hierarchy',
  'Master-Detail & Forms',
  'Server-Side Data',
  'Real-time & Streaming',
  'Spreadsheet',
  'Charts',
  'Kanban',
  'Scheduler',
  'Themes & Styling',
  'Keyboard & Accessibility',
  'Mobile & Responsive',
  'Integrations',
  'Industry Templates',
  'Headless',
  'Data Export & Import',
  'Pivot Grid',
  'Studio',
  'AI',
  // SvGrid Editors product
  'Date & Time',
  'Buttons & Toggles',
  'Inputs',
  'Selection',
  'Range & Feedback',
  'Layout',
  'Headless Editors',
]

export type Demo = {
  id: string
  title: string
  blurb: string
  category: DemoCategory
  /** When true, this demo depends on @svgrid/enterprise. Rendered with a
   *  small dot badge in the sidebar so users can scan the Pro features
   *  at a glance. */
  pro?: boolean
  component: Component<any>
  source: string
}

function demo(
  id: string,
  title: string,
  blurb: string,
  category: DemoCategory,
  component: Component<any>,
  opts?: { pro?: boolean },
): Demo {
  return { id, title, blurb, category, component, pro: opts?.pro, source: sourceFor(id) }
}

export const demos: Demo[] = [
  // ===== SvGrid Editors product (UI components in @svgrid/grid that double as
  // grid cell editors). Scoped to their own switcher entry, not the grid gallery.
  demo('250-calendar',              'Calendar',                    'SvCalendar: a themeable month/year/decade calendar with single / range / week / multi selection, min-max, restricted + important dates and week numbers. The same component SvGrid mounts to edit a date cell - and usable standalone in any SvGrid app.', 'Date & Time', Calendar250),
  demo('251-timepicker',            'Time picker',                 'SvTimePicker: an analog clock-dial picker with 12/24-hour, minute snapping and hour to minute auto-switch. Drag the hand or click a number. The SvGrid time cell editor, usable standalone in any SvGrid app.', 'Date & Time', TimePicker251),
  demo('252-datetimepicker',        'Date-time picker',            'SvDateTimePicker: a formatted input plus a portalled dropdown with DATE / TIME tabs (calendar + clock). Type a masked value or pick it; invalid input reverts. min/max, nullable, 12/24-hour, spin buttons. The SvGrid datetime cell editor, standalone in any SvGrid app.', 'Date & Time', DateTimePicker252),
  demo('283-daterange-input',       'Date-range input',            'SvDateRangeInput: a compact start/end field that opens a two-month range calendar with one-click presets (Today, Last 7 days, ...). Composes the same headless range engine as SvCalendar, and carries the shared editor contract - label, hint, error validation, dir (RTL) and localizable messages.', 'Date & Time', DateRangeInput283),
  demo('258-calendar-range',        'Calendar - range + presets', 'SvCalendar as a date-range picker: selectionMode="range" with a one-click presets rail (Today, Last 7 days, This month, Year to date...), animated month navigation and mouse-wheel scrolling. Presets resolve relative to today. Same component, no extra dependency.', 'Date & Time', CalendarRange258),
  demo('259-datetimepicker-forms',  'Date-time picker - form fields','SvDateTimePicker in five real shapes on one form: date-only, time-only, date+time, 12-hour with spin buttons, and a min/max-constrained field. Masked inputs (type or pick), portalled dropdowns, animated calendars. The SvGrid datetime cell editor, standalone.', 'Date & Time', DateTimePickerForms259),
  demo('338-event-calendar',        'Event calendar (rich cells + recurrence)', 'SvCalendar extended into a FullCalendar-style scheduler: the `day` snippet fills each cell with event chips, and `recurrence` repeat patterns (weekly standups, every-other-week sprint, monthly invoices) mark repeating days and generate their events via matchesRecurrence. Navigation, keyboard, selection and theming stay the component\'s. Pick a day for its agenda.', 'Date & Time', EventCalendar338),
  demo('253-buttons-toggles',       'Buttons & toggles',           'The UI kit press/toggle primitives: SvButton (variants/sizes/loading), SvRepeatButton (hold-to-repeat), SvToggleButton, SvSwitchButton, SvCheckBox (+ indeterminate), SvRadioGroup (arrow-key nav) and SvRating (half stars). Theme-driven, standalone or as grid cell controls.', 'Buttons & Toggles', ButtonsToggles253),
  demo('284-button-group',          'Button group',                'SvButtonGroup: a segmented button bar - single-select (radio semantics, a view switcher), multi-select (a toggle set / formatting toolbar) or plain actions. Roving tabindex + arrow keys, and the shared editor contract (label, validation, dir/RTL).', 'Buttons & Toggles', ButtonGroup284),
  demo('305-button',                'Button',                      'SvButton in production: a toolbar (variants primary/secondary/outline/ghost/danger), sizes, icon slots, a loading state and a full-width CTA. Copy-paste-ready blocks.', 'Buttons & Toggles', ButtonDemo305),
  demo('306-repeat-button',         'Repeat button',               'SvRepeatButton: hold-to-repeat with acceleration - a quantity stepper and a volume control block.', 'Buttons & Toggles', RepeatButton306),
  demo('307-toggle-button',         'Toggle button',               'SvToggleButton: a pressed on/off button (aria-pressed) - a text-formatting toolbar and pin / live state toggles.', 'Buttons & Toggles', ToggleButton307),
  demo('308-switch',                'Switch',                      'SvSwitchButton in a real settings panel: labelled rows with descriptions, on/off track labels and a disabled row.', 'Buttons & Toggles', Switch308),
  demo('309-checkbox',              'Checkbox',                    'SvCheckBox: a role-permissions block with a tri-state select-all parent (indeterminate when partial) plus a required, validated terms checkbox.', 'Buttons & Toggles', CheckBox309),
  demo('310-radio-group',           'Radio group',                'SvRadioGroup: a plan picker and a shipping selector with a disabled option, roving arrow-key focus and label + validation.', 'Buttons & Toggles', RadioGroup310),
  demo('311-rating',                'Rating',                      'SvRating: an interactive review widget with a live label, plus a read-only half-star aggregate with a distribution breakdown.', 'Buttons & Toggles', Rating311),
  demo('254-text-inputs',           'Text inputs',                 'Typed text controls: SvNumberInput (min/max/step, grouping, precision, spinners), SvPasswordInput (reveal + strength), SvMaskedInput (pattern mask), SvPhoneInput (country dial code + national mask) and SvColorInput (swatch + palette popover). Each a SvGrid cell editor, standalone too.', 'Inputs', TextInputs254),
  demo('300-number-input',          'Number input',                'SvNumberInput on its own: min/max/step, thousands grouping, precision, prefix/suffix, spinner buttons and the shared field contract (label, hint, required/error validation).', 'Inputs', NumberInput300),
  demo('301-password-input',        'Password input',              'SvPasswordInput on its own: a reveal toggle and an optional 4-level strength meter, with localizable strings and the shared field contract.', 'Inputs', PasswordInput301),
  demo('302-masked-input',          'Masked input',                'SvMaskedInput on its own: a fixed-pattern mask (# digit, A letter, * alphanumeric; other chars literal) emitting the masked + raw value and a complete flag.', 'Inputs', MaskedInput302),
  demo('303-phone-input',           'Phone input',                 'SvPhoneInput on its own: a country dial-code selector plus a national number field emitting an E.164-ish string, with label / validation / dir.', 'Inputs', PhoneInput303),
  demo('304-color-input',           'Color input',                 'SvColorInput on its own: a swatch that opens an animated, portalled popover with a hex field, the native picker and a preset palette. Emits a hex string.', 'Inputs', ColorInput304),
  demo('287-file-upload',           'File upload',                 'SvFileUpload: a drag-and-drop file field with click-to-browse, accept / maxSize / maxFiles validation (rejects fire onReject) and a selected-files list. Carries the shared editor contract - label, hint, required/error validation - so it drops into a form like any input.', 'Inputs', FileUpload287),
  demo('255-selection',             'Selection controls',          'List and overlay pickers: SvListBox (inline multi-select), SvDropDownList, SvComboBox (type to filter), SvAutoComplete (free text + suggestions), SvTagsInput (chips) and SvCountryInput (searchable, flags). Every popover portals out of the scroll container. Grid cell editors, standalone too.', 'Selection', Selection255),
  demo('312-listbox',               'List box',                    'SvListBox: an assignee picker - inline multi-select with grouped options (departments), roving keyboard + type-ahead and a live summary.', 'Selection', ListBox312),
  demo('313-combobox',              'Combo box',                   'SvComboBox: a form field - type to filter a grouped, portalled list; the value must come from the list. With label + required validation.', 'Selection', ComboBox313),
  demo('314-dropdownlist',          'Drop-down list',              'SvDropDownList: a status / priority toolbar with grouped options, type-ahead and animated portalled panels driving a live issue list.', 'Selection', DropDownList314),
  demo('315-autocomplete',          'Autocomplete',                'SvAutoComplete: a free-text search field with live suggestion shortcuts (any value accepted) - city search and a filter-syntax helper.', 'Selection', AutoComplete315),
  demo('316-tags-input',            'Tags input',                  'SvTagsInput: a token editor (Enter / comma to add, Backspace / x to remove) with unique + max enforced - skills and email recipients with validation.', 'Selection', TagsInput316),
  demo('317-country-input',         'Country input',               'SvCountryInput: a searchable checkout country picker (flag + name + dial code) emitting the ISO code, with label + required validation.', 'Selection', CountryInput317),
  demo('323-list-virtualization',   'Virtualized list',            'SvListBox scaling to 50,000 options via fixed-row windowing (only visible rows in the DOM) - scroll + type-ahead stay instant. Plus a custom itemTemplate row (avatar + role). Just add virtual.', 'Selection', ListVirtualization323),
  demo('329-combobox-remote',       'Remote combo box',            'SvComboBox with a remote dataSource: debounced server search (loadOptions), a loading state, latest-response-wins race handling and a type-to-search hint. Local filtering off.', 'Selection', ComboRemote329),
  demo('260-headless-editors',      'Headless editors',            'Headless-first, like the grid: createListbox is the state machine behind SvListBox (roving focus, single/multi selection, keyboard, ARIA) exposed as prop-getters you spread onto YOUR own markup. One core drives both the styled SvListBox and a custom chip-cloud render, bound to one value.', 'Headless Editors', HeadlessEditors260),
  demo('261-headless-combobox',          'Combobox - headless',           'createCombobox drives the styled SvComboBox and a custom filter-input render, both bound to one value with a readout.', 'Headless Editors', HlCombobox),
  demo('262-headless-dropdownlist',      'Dropdown list - headless',      'createDropdownList drives SvDropDownList and a custom trigger+menu render, sharing one value.', 'Headless Editors', HlDropdownList),
  demo('263-headless-autocomplete',      'Autocomplete - headless',       'createAutocomplete drives SvAutoComplete and a custom suggestion-list render over one text value.', 'Headless Editors', HlAutocomplete),
  demo('264-headless-tagsinput',         'Tags input - headless',         'createTagsInput drives SvTagsInput and a custom chip-cloud render, both editing one string array.', 'Headless Editors', HlTagsInput),
  demo('265-headless-countryinput',      'Country input - headless',      'createCountryInput drives SvCountryInput and a custom searchable picker, sharing one ISO code.', 'Headless Editors', HlCountryInput),
  demo('266-headless-numberinput',       'Number input - headless',       'createNumberInput drives SvNumberInput and a custom stepper; parse, clamp, spinner and keyboard all from the core.', 'Headless Editors', HlNumberInput),
  demo('267-headless-maskedinput',       'Masked input - headless',       'One createMaskedInput drives the styled field and a custom boxed field with a complete/partial badge.', 'Headless Editors', HlMaskedInput),
  demo('268-headless-phoneinput',        'Phone input - headless',        'createPhoneInput drives SvPhoneInput and a custom country picker + national field; dial-code / E.164 parsing from the core.', 'Headless Editors', HlPhoneInput),
  demo('269-headless-colorinput',        'Color input - headless',        'createColorInput drives the portalled SvColorInput and a custom inline swatch + palette panel.', 'Headless Editors', HlColorInput),
  demo('270-headless-passwordinput',     'Password input - headless',     'createPasswordInput drives SvPasswordInput and a custom reveal field + strength meter.', 'Headless Editors', HlPasswordInput),
  demo('271-headless-togglebutton',      'Toggle button - headless',      'Styled SvToggleButton plus a custom on/off pill, one bound pressed value with a readout.', 'Headless Editors', HlToggleButton),
  demo('272-headless-switchbutton',      'Switch button - headless',      'Styled SvSwitchButton plus a custom sliding knob, one bound checked value with a readout.', 'Headless Editors', HlSwitchButton),
  demo('273-headless-checkbox',          'Checkbox - headless',           'Styled SvCheckBox plus a custom card checkbox, one bound checked value with a readout.', 'Headless Editors', HlCheckbox),
  demo('274-headless-radiogroup',        'Radio group - headless',        'Styled SvRadioGroup plus a custom segmented control (with a disabled option), one bound value.', 'Headless Editors', HlRadioGroup),
  demo('275-headless-rating',            'Rating - headless',             'Styled SvRating (half stars) plus a custom segmented meter, one bound numeric value with live preview.', 'Headless Editors', HlRating),
  demo('276-headless-calendar',          'Calendar - headless',           'Styled SvCalendar and a compact custom day-grid built from panels / dayState / dayProps, sharing one value.', 'Headless Editors', HlCalendar),
  demo('277-headless-timepicker',        'Time picker - headless',        'Styled analog SvTimePicker and a custom digital readout, sharing one value.', 'Headless Editors', HlTimePicker),
  demo('278-headless-datetimepicker',    'Date-time picker - headless',   'Styled SvDateTimePicker (portalled dropdown) and a custom masked field, sharing one value.', 'Headless Editors', HlDateTimePicker),
  demo('279-headless-tabs',              'Tabs - headless',               'createTabs drives styled SvTabs plus a custom segmented control, one active id with a readout.', 'Headless Editors', HlTabs),
  demo('280-headless-tree',              'Tree - headless',               'createTree drives styled SvTree plus a custom compact file explorer, one selected id with a readout.', 'Headless Editors', HlTree),
  demo('281-headless-slider',            'Slider - headless',             'createSlider drives styled SvSlider plus a custom draggable bar (rect measured in the component), one number.', 'Headless Editors', HlSlider),
  demo('282-headless-gauge',             'Gauge - headless',              'createGauge drives styled SvGauge plus a custom SVG meter sharing the same arc / needle geometry.', 'Headless Editors', HlGauge),
  demo('256-range-feedback',        'Range & feedback',            'SvSlider (single or dual-thumb range, ticks, keyboard, vertical) and SvGauge (radial arc with threshold bands, needle, half sweep). Theme-driven value controls, standalone or in-grid.', 'Range & Feedback', RangeFeedback256),
  demo('318-slider',                'Slider',                      'SvSlider: a filter block - a dual-thumb price range plus single sliders for rating and distance, with ticks and live formatted readouts.', 'Range & Feedback', Slider318),
  demo('319-gauge',                 'Gauge',                       'SvGauge: a KPI dashboard - radial gauges with colored threshold bands, a live-updating needle, and a needle-less storage tile.', 'Range & Feedback', Gauge319),
  demo('330-progress',              'Progress (linear + circular)', 'SvProgress and SvCircularProgress: determinate + indeterminate progress with color intents, sizes, labels, striped fill, a buffered track, and a custom ring center. WAI-ARIA progressbar, reduced-motion aware.', 'Range & Feedback', Progress330),
  demo('257-tabs-tree-form',        'Tabs, tree & form',           'Composite controls: SvTabs (line + pill, roving keyboard), SvTree (expand/collapse, single-select + cascading tri-state checkboxes) and a schema-driven SvForm that wires the whole kit (inputs, select, switch, date, textarea) with required + custom validation.', 'Layout', TabsTreeForm257),
  demo('320-tabs',                  'Tabs',                        'SvTabs: a settings screen with real panels (line tabs, a disabled tab) plus a pill-style view switcher. Roving arrow-key focus, automatic activation.', 'Layout', Tabs320),
  demo('321-tree',                  'Tree',                        'SvTree: a file explorer with cascading tri-state checkboxes and a single-select highlight; keyboard up/down move, left/right collapse/expand.', 'Layout', Tree321),
  demo('322-form',                  'Form',                        'SvForm: a schema-driven signup form wiring the whole kit (text, email, password, select, date, switch, rating) with required + cross-field custom validation in a two-column grid.', 'Layout', FormDemo322),
  demo('324-tree-scale',            'Tree at scale (virtual + lazy)', 'SvTree scaling to 10,100 nodes via fixed-row virtualization (only ~15 rows in the DOM), plus a lazy-loading tree that fetches each folder’s children on first expand with a spinner. Keyboard, selection and cascading checkboxes intact.', 'Layout', TreeScale324),
  demo('325-tabs-advanced',         'Tabs: closable + positions', 'SvTabs with closable tabs (browser-style, add button, Delete key) and the four tabPositions - top, bottom, left, right.', 'Layout', TabsAdvanced325),
  demo('326-menu',                  'Menu',                        'SvMenu: a dropdown / actions menu with submenus, separators, icons and keyboard shortcuts. Portalled + animated, full keyboard (arrows, Enter, Escape, ArrowRight/Left).', 'Layout', Menu326),
  demo('327-navpane',               'Navigation pane',             'SvNavPane: an Outlook-style sidebar - collapsible sections, unread badges, nested folders, single-select highlight, arrow-key nav, an icon-only collapsed rail, and a bottom module strip with a drag splitter (drag up to collapse modules into an icon rail).', 'Layout', NavPane327),
  demo('328-tree-editable',         'Tree editing (drag / rename / sort)', 'SvTree with drag-drop reorder (drop before / after / inside), inline rename (double-click or F2) and sortable siblings. Uses the moveTreeNode helper.', 'Layout', TreeEditable328),
  demo('285-accordion',             'Accordion',                   'SvAccordion: collapsible sections with single- or multiple-expand, roving header focus (Up/Down/Home/End) and full WAI-ARIA (region + aria-controls). The panel body is a snippet; RTL mirrors the chevron and layout.', 'Layout', Accordion285),
  demo('286-splitter',              'Splitter',                    'SvSplitter: two resizable panes with a draggable WAI-ARIA separator - pointer drag + arrow-key resize (Home/End jump to bounds). Nest them for IDE / dashboard layouts. RTL flips the horizontal drag direction.', 'Layout', Splitter286),
  demo('361-dock-layout',           'Docking layout',              'SvDockLayout: an IDE-style docking workspace - drag a tab onto another pane and drop on an edge to split or the centre to stack as a tab, drag the splitters to resize, close panes. The whole layout is a serializable, bindable DockNode tree.', 'Layout', DockLayout361),
  demo('362-dock-manager',           'Docking manager',             'SvDockManager: SvDockLayout plus floating / pop-out windows, tab reordering and pinning / auto-hide. Drag a tab into open space to float it, along its strip to reorder, or use the tab buttons to auto-hide (collapse to an edge) and pin back.', 'Layout', DockManager362),
  demo('363-dock-headers',           'Docking: header positions',   'SvDockManager headerPosition: put the tab strip on any side of a panel (top / bottom / left / right - left & right render vertical tabs) and toggle tab reordering.', 'Layout', DockHeaders363),
  demo('364-dock-api',               'Docking: API & events',       'SvDockManager imperative API (onReady) + event stream (onEvent): a toolbar floats / pops out / maximizes / auto-hides / focuses panes from code, with every action logged live.', 'Layout', DockApi364),
  demo('365-dock-dashboard',         'Docking: analytics workspace','SvDockManager as a BI workspace: per-pane minSize stops splitters crushing panels, and Save / Load persist the whole (tiled + floating + auto-hidden) layout to localStorage.', 'Layout', DockDashboard365),
  demo('366-dock-keepalive',         'Docking: keep-alive tabs',    'SvDockManager keepAlive: keep inactive tabs mounted (hidden) so their DOM state - scroll position, unsaved form input - survives a tab switch instead of being unmounted.', 'Layout', DockKeepAlive366),
  demo('288-overlays',              'Overlays: popover, tooltip, modal', 'SvPopover (anchored floating panel, click/hover/manual), SvTooltip (delayed hover/focus tip, aria-describedby) and SvModal (focus-trapped dialog, Escape / backdrop close, optionally draggable + resizable). All portal to <body>, animate in, and respect reduced-motion.', 'Layout', Overlays288),
  demo('331-app-overlays',          'App overlays: drawer, context menu, toasts', 'SvDrawer (edge side-sheet), SvContextMenu (right-click menu) and the toast() API + SvToaster - all built on the shared focus-trap, scroll-lock and dismissable-layer primitives, so nested overlays close top-first and every toast is announced to screen readers.', 'Layout', AppOverlays331),
  demo('332-app-navigation',        'Navigation: breadcrumb, pager, stepper', 'SvBreadcrumb (collapsing trail), SvPagination (page-range with ellipsis, first/last, prev/next) and SvStepper (linear wizard with completed/active/upcoming states). Pure, keyboard-accessible, theme-token driven.', 'Layout', AppNavigation332),
  demo('340-command-palette',       'Command palette (⌘K) + sparklines, avatars, scroll', 'SvCommand: a ⌘K fuzzy command palette built on the shared focus-trap / scroll-lock / dismissable primitives (arrow-key nav, groups, shortcuts, global hotkey). Plus SvSparkline (inline line/area/bar/win-loss charts), SvAvatarGroup (stacked members + overflow) and SvScrollArea (themed scrollbars).', 'Layout', CommandPalette340),
  demo('342-carousel-tour',         'Carousel & guided tour', 'SvCarousel (sliding track with arrows, dot indicators, autoplay that pauses on hover, and swipe) and SvTour (a guided product tour that spotlights each target element and steps through Back / Next / Done - arrow keys navigate, Escape skips). Both portalled + themeable.', 'Layout', CarouselTour342),
  demo('333-app-feedback',          'Feedback & display: badge, avatar, skeleton, card', 'SvBadge (status pills), SvAvatar (image + initials/colour-hash fallback + presence dot), SvSkeleton (shimmer loaders) and SvCard (surface) - the display layer for dashboards and detail panels. Toggle loading to swap content for skeletons.', 'Range & Feedback', AppFeedback333),
  demo('339-status-display',        'Status & display: alert, stat, timeline, chip, divider, empty', 'SvAlert (inline info/success/warning/danger messages with actions), SvStat (KPI cards with auto-coloured up/down deltas, invertible), SvTimeline (activity feed), SvChip (removable/clickable pills with avatars), SvDivider (labeled + vertical) and SvEmptyState. The status + display layer for dashboards and detail screens.', 'Range & Feedback', StatusDisplay339),
  demo('334-input-editors',         'Input editors: text, textarea, OTP, duration, multi-select', 'The Tier-1 editors on the shared contract: SvTextInput, SvTextArea (auto-grow + counter), SvOtpInput (segmented code, paste-distribute), SvDurationInput ("1h 30m" <-> minutes) and SvMultiSelect (portalled checkbox dropdown with search + chips). Standalone or as grid cell editors (Enter commits, Escape cancels).', 'Inputs', InputEditors334),
  demo('341-rich-text-editor',      'Rich text editor (WYSIWYG)', 'SvRichText: a lightweight WYSIWYG over a contentEditable region - bold/italic/underline/strike, headings, lists, quote, code block, alignment, links, undo/redo - emitting HTML via bind:value, with a configurable toolbar. Parity: Smart editor.', 'Inputs', RichTextEditor341),
  demo('335-tree-select',           'Tree select', 'SvTreeSelect: a single-select dropdown showing a collapsible tree in its portalled panel (the tree-select / cascader pattern). Arrow keys navigate, Right/Left expand/collapse, Enter selects; optional full-path label in the trigger.', 'Selection', TreeSelect335),
  demo('336-grid-select',           'Grid select (multi-column)', 'SvGridSelect: a "grid in a dropdown" single-select - the panel shows options as a compact multi-column table with a header row and search, so you pick by more than a label. Built on its own panel (no embedded SvGrid); standalone or as a cell editor.', 'Selection', GridSelect336),
  demo('334-checkout-form',         'Checkout form',               'A real payment form built entirely from SvGrid UI: SvMaskedInput (card number + expiry + CVC), SvCountryInput (billing country), SvNumberInput (amount), SvSwitchButton (save card) and SvButton - with live card-brand detection and validation. Copy the file and ship it.', 'Headless Editors', CheckoutForm334Recipe),
  demo('335-booking-form',          'Appointment booking',         'A scheduling form from SvGrid UI: SvComboBox (service), SvCalendar (date), SvTimePicker (slot), SvButtonGroup (duration), SvNumberInput (guests) and a live summary. The same components SvGrid uses to edit cells, composed into a page.', 'Headless Editors', BookingForm335Recipe),
  demo('336-filter-bar',            'Product filter bar',          'A faceted filter/search bar from SvGrid UI: SvComboBox (search), SvButtonGroup (category), SvTagsInput (tags), SvSlider (price range), SvSwitchButton (in stock) and SvDropDownList (sort) - filtering a live product list as you go.', 'Headless Editors', FilterBar336Recipe),
  demo('343-kanban-board',          'Kanban board mode',           'The same <SvGrid>, same data + columns, rendered as a Kanban board by setting one `board` prop: rows become cards in horizontal lanes bucketed by a `status` field. Built-in drag-and-drop AND keyboard move (Space + arrows) reassign the lane and reorder; double-click / F2 opens a built-in card editor; WIP limits, add-card, and a rich card snippet (assignee avatar + priority chip). Toggle Board / Table to see it is one grid.', 'Kanban', KanbanBoard343),
  demo('344-kanban-sprint',         'Sprint board (swimlanes + WIP)', 'An agile sprint board: status lanes crossed with a swimlane per assignee, an enforced WIP limit on In progress, and a story-point roll-up in every lane header via board.laneSummary. Drag across a band to reassign the owner; double-click to edit. Collapsible lanes.', 'Kanban', KanbanSprint344),
  demo('345-kanban-pipeline',       'Sales pipeline (deal board)', 'A CRM deal board: stages as lanes with a live total-value roll-up per stage (board.laneSummary). Rich deal cards; drag to advance a deal, double-click to edit. Moves and edits persist to localStorage via onCardMove / onCardCommit, so a reload restores the board.', 'Kanban', KanbanPipeline345),
  demo('346-kanban-virtualized',    'Large board (virtualized)', 'Thousands of cards per lane kept smooth with board.virtualized - only the cards in view are in the DOM. A slider scales the board from 1k to 50k cards; drag-and-drop and keyboard move still work across the whole window.', 'Kanban', KanbanVirtualized346),
  demo('347-kanban-support',        'Support triage board', 'A helpdesk triage board: status lanes crossed with a priority swimlane, a search box front-and-center, and an SLA colour bar on each card driven by ticket age. Drag across a band to re-triage a ticket priority.', 'Kanban', KanbanSupport347),
  demo('348-kanban-content',        'Content calendar', 'An editorial pipeline: stage lanes crossed with a swimlane per channel. Rich cards carry a cover glyph, author and target date. Drag a piece down the pipeline, or across a band to move it to another channel; double-click to edit.', 'Kanban', KanbanContent348),
  demo('349-kanban-subtasks',       'Cards with sub-tasks & badges', 'The default board card made rich by config alone: label / due / assignee badges, a sub-task checklist with a progress bar (expand to tick items or add more), and a quick-add composer at the bottom of each lane. Double-click a card for the BUILT-IN detail drawer (board.drawer -> SvDrawer + SvForm with the UI-kit editors); toggle all fields vs a customized subset. Board / Table switcher.', 'Kanban', KanbanSubtasks349),
  demo('350-kanban-structure',      'Group-by switch + reorderable lanes', 'Board structure, live: switch the lane axis at runtime (Status / Assignee / Priority) and the board re-buckets, and drag a lane header to reorder the columns. Both built-in - the group-by switch resets card positions to the new field; lane order is tracked and persists with persistKey. Board / Table switcher.', 'Kanban', KanbanStructure350),
  demo('351-kanban-power',          'Board power tools (filters, multi-select, menus)', 'A facet filter bar (by tag + assignee), card multi-select with bulk move (click / Ctrl-click then drag the group), a blocked flag, a card-age badge, and both card + lane right-click menus - all from board config on the built-in default card. Board / Table switcher.', 'Kanban', KanbanPower351),
  demo('352-kanban-epics',          'Epics -> stories (hierarchical cards)', 'Point board.childrenField at a row child rows and each card gains a children count that expands to show its sub-cards inline (Jira epic -> stories). Each child shows its own title + status. Board / Table switcher.', 'Kanban', KanbanEpics352),

  demo('363-scheduler-intro',       'Scheduler / calendar mode',   'The same <SvGrid>, same data + columns, rendered as a full calendar by setting one `scheduler` prop: rows become events bucketed by time. Switch Month / Week / Day / Agenda in the toolbar; drag an event to reschedule, drag its edge to resize, click to edit in a drawer. onEventMove / onEventResize write the new times back onto your row. Toggle Calendar / Table to see it is one grid. The calendar renderer ships in @svgrid/enterprise (enableSchedulerView).', 'Scheduler', SchedulerIntro363, { pro: true }),
  demo('371-scheduler-timeline', 'Timeline views (Day / Week)', 'A horizontal resource timeline: teams are rows, time runs left→right on a scrollable axis, work items are bars sized to real durations (half-day blocks up to multi-day tasks). Switch Day (hour ticks) or Week (day ticks); drag a bar to re-time it, to another team\'s row to reassign, or an edge to resize. Click / drag empty space to select a range (arrows move, Shift+arrows extend, Enter creates); Ctrl-click bars to multi-select. Bar fill = team, left strip = status.', 'Scheduler', SchedulerTimeline371, { pro: true }),
  demo('372-scheduler-selection', 'Selecting cells & events', 'Drag empty slots to create events (drag across days for a rectangle - one per day); Ctrl/Cmd-click events to multi-select (Shift-click a range), drag the set to move it together, or press Delete to remove. Enterprise scheduler view.', 'Scheduler', SchedulerSelection372, { pro: true }),
  demo('381-scheduler-app-calendar', 'Horizon - Outlook-style calendar app', 'A full calendar client on the Scheduler: NavPane module rail + mini date-picker + calendar toggles, the calendar (Month/Week/Day/Agenda driven by the mini-picker), and an Upcoming grid of the same rows. Recurring events with per-occurrence edits, a second time-zone ruler, iCal import/export and undo.', 'Scheduler', SchedulerAppCalendar381, { pro: true }),
  demo('382-scheduler-app-clinic', 'Meridian Clinic - appointment scheduling', 'A clinic front desk: providers with their own hours as columns, a patient waitlist you drag onto free slots, per-provider availability shading, no double-booking and no booking outside a provider hours. NavPane of providers + specialties.', 'Scheduler', SchedulerAppClinic382, { pro: true }),
  demo('383-scheduler-app-dispatch', 'Dispatch - field-service operations board', 'A dispatcher board: technicians as timeline rows, jobs as bars across the day/week. Drag a bar to re-time or reassign, drag an unassigned job from the backlog onto the timeline to dispatch it. No double-booking. NavPane of crews + regions.', 'Scheduler', SchedulerAppDispatch383, { pro: true }),
  demo('384-scheduler-app-roadmap', 'Portfolio roadmap - initiatives across squads', 'A product roadmap: squads as timeline rows, initiatives as multi-week bars, milestones as flags. Zoom between a month and the whole year, drag a bar to reschedule or reassign, drop an idea from the backlog. Initiatives also as a grid.', 'Scheduler', SchedulerAppRoadmap384, { pro: true }),
  demo('385-scheduler-app-content', 'Broadcast - content & marketing calendar', 'A content team editorial calendar: a Month grid of posts and multi-day campaigns colour-coded by channel. Toggle channels, drag a draft from the backlog onto a date, and see the same pipeline as a grid.', 'Scheduler', SchedulerAppContent385, { pro: true }),

  // ----- Getting Started (the first stop for every evaluator)
  demo('00-trading-desk',           'Trading desk - live',         '10,000 securities ticking on a 500 ms feed. Pinned Symbol + P&L, sparklines, sector chips, KPI strip. The hero.', 'Getting Started', TradingDesk),
  demo('01-quick-start',            'Quick start',                 'A realistic 25-row × 9-column grid with sort, filter, selection, inline editing, and column resize all enabled.', 'Getting Started', QuickStart),
  demo('135-shortcut-config',       'Shortcut config',             'Capabilities are off by default - opt into sort / filter / edit / group / paging with one boolean shortcut each. No `features` array, no fine-grained props. Toggle the switches to build the config live.', 'Getting Started', ShortcutConfig),
  demo('22-admin-template',         'Admin template',              'Self-contained admin app: sidebar + three pages (Dashboard, Orders w/ Pro export bar, Customers w/ inline edit). Read end-to-end in one file.', 'Getting Started', AdminTemplate),
  demo('06-large-dataset',          '100k rows · 100 columns',     'Row + column virtualization. Chunked load with progress + cancellation.', 'Getting Started', LargeDataset),
  demo('78-million-rows',           '1 million rows',              'A literal 1,000,000-row dataset with sort, filter, group, scroll, and inline edit all on. Chunked generation with progress.', 'Getting Started', MillionRows),
  demo('80-cell-types-showcase',    'Cell types showcase',         'Every editor in one grid: color picker, date picker, 5-star rating, mood feedback, list/chips, number formatting, status badge. The "what cells can you make?" demo.', 'Getting Started', CellTypesShowcase),

  // ----- Headless (engine without the renderer)
  demo('186-headless-table',        'Headless -> your own table',  'No <SvGrid>: the createSvGrid engine sorts + filters, and this component renders a plain, hand-styled <table>. Click a header to sort, type to filter. The engine does the logic; you own the markup.', 'Headless', HeadlessTable),
  demo('187-headless-virtual',      'Headless virtualization',     '50,000 rows, headless. createSvelteVirtualizer reports the visible slice; the markup is hand-written in a custom scroll container. Only ~20 rows exist in the DOM at once.', 'Headless', HeadlessVirtual),
  demo('188-headless-styled',       'Styling a headless table',    'You own every pixel. Same engine, three looks - flip preset (minimal / bordered / card), density, and zebra striping. All CSS lives in the demo; --sg-* tokens keep it in sync with the site theme.', 'Headless', HeadlessStyled),
  demo('189-headless-shared-state', 'Two grids, one shared state', 'createGridState returns a [get, set] tuple - a reactive store you own. Feed it to two independent createSvGrid engines and they stay in lockstep: sort a header in either grid and both re-sort.', 'Headless', HeadlessSharedState),
  demo('190-headless-row-models',   'Row models are a pipeline',   'Flip the group-by control and watch the pipeline change shape: core -> grouped -> expanded. Group rows carry the aggregate: sum roll-up; the markup is a plain hand-styled <table>.', 'Headless', HeadlessRowModels),
  demo('191-headless-server-side',  'Headless server-side',        'Paging + sorting + filtering + load on demand. The "server" owns the data and returns one page at a time; each state change fires a single request (watch the counter). The engine wraps only the current page.', 'Headless', HeadlessServerSide),

  // ----- Editing
  demo('05-inline-editing',         'Inline editing',              'Typed editors (text/number/checkbox/date) with dirty tracking + save.', 'Editing', InlineEditing),
  demo('84-editor-types',           'Editor types + custom slot',  'Built-in select / rich-select / textarea editors plus a custom `cellEditor` snippet (a range slider) for cases the built-ins do not cover.', 'Editing', EditorTypes),
  demo('26-list-chips-editors',     'List + chips editors',        'Two built-in editors with single & multi-select: dropdown (list) and removable tokens (chips), with options or free-form.', 'Editing', ListChipsEditors),
  demo('66-custom-cell-editors',    'Custom cell editors',         'Three hand-rolled editors: native colour picker bound to a tag swatch, 5-star rating, emoji feedback mood. All write back through api.setCellValue.', 'Editing', CustomCellEditors),
  demo('68-dependent-dropdowns',    'Dependent dropdowns',         'Cascade editors: Country → State → City. Each level computes its options from the row\'s upstream value; changing Country resets State + City.', 'Editing', DependentDropdowns),
  demo('24-validation',             'Validation while editing',    'Per-column rules: invalid commits get rolled back via setCellValue + logged to a recent-rejections panel.', 'Editing', Validation),
  demo('206-cell-validation',       'Cell validation (validate hook)','Declarative per-column `validate()` hook, Handsontable-style. Invalid cells - including bad data already in the source on load - highlight red with the reason as a tooltip, and re-check live as you edit.', 'Editing', CellValidation),
  demo('71-submit-validation',      'Submit-time validation',      'Bulk-leads import: edit freely, click Submit, the row-level validator highlights invalid cells and lists every error in an aria-live panel.', 'Editing', SubmitValidation),
  demo('82-conditional-form-schema','Conditional form schema',     'Declarative `when` rules drive per-cell visibility and editability. EIN only on nonprofits, SSN only on individuals, rejection reason only when status is rejected.', 'Editing', ConditionalFormSchema),
  demo('18-cascade-editing',        'Cascade editing',             'Spreadsheet invoice: editing qty / price / discount cascades into line totals and the summary cards.', 'Editing', CascadeEditing),
  demo('86-undo-redo',              'Undo / redo (Ctrl+Z)',        '`api.undo()` / `api.redo()` + Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z. 200-step bounded history; clearHistory after a successful save resets the baseline.', 'Editing', UndoRedo),
  demo('95-fill-handle',            'Excel-style fill handle',     'Walks through every fill pattern the engine detects: numeric series, date series, weekday sequence, reverse-fill, horizontal fill, copy-mode. Just enable cell selection - no extra wiring.', 'Editing', FillHandle),
  demo('103-async-validation',      'Async / server validation',   'Debounced async validators per column: SKU uniqueness, GTIN-13 checksum, price vs category median. Inline ✓ / ! state per cell + event log.', 'Editing', AsyncValidation),
  demo('175-value-parser',          'valueParser - transform on commit', 'Per-column `valueParser` refines the committed value after built-in coercion: uppercase a SKU, parse "$1,299.90" into a number, clamp a discount 0–100, round a weight. Log shows raw input → stored.', 'Editing', ValueParser),
  demo('176-programmatic-editing',  'Programmatic editing (start/stop)', 'Drive the editor from outside via api.startEditing(row, columnId) / stopEditing(cancel?). A toolbar edits the active cell, commits or cancels, and a guided-entry flow jumps to the next blank required field and opens it.', 'Editing', ProgrammaticEditing),
  demo('177-full-row-editing',      'Full-row editing',            'The `fullRowEditing` prop puts the WHOLE row into edit at once - every editable cell (text, select, number, date, checkbox) shows an inline editor. Enter or click-away commits all cells in one update; Esc cancels the row.', 'Editing', FullRowEditing),

  // ----- Filtering & Search
  demo('02-sort-filter-paginate',   'Sort, filter, paginate',      'Three most-asked-for features wired together against ~5k rows.', 'Filtering & Search', SortFilterPaginate),
  demo('03-excel-filters',          'Excel-style filters',         'Per-column operator dropdown with active-filter chips and clear.', 'Filtering & Search', ExcelFilters),
  demo('64-filter-between-operator','Filter - between operator',   'Number + date columns expose a "Between" operator with From/To inputs. Drive it via the menu or imperatively with api.setFilter(id, { operator: "between", value, valueTo }).', 'Filtering & Search', FilterBetween),
  demo('69-highlighted-search',     'Highlighted search matches',  'External search input + a custom cell snippet that wraps matched substrings in <mark>. Filters the dataset AND visually flags hits.', 'Filtering & Search', HighlightedSearch),
  demo('87-find-in-grid',           'Find in grid (Ctrl+F)',       'Built-in find overlay with next / previous navigation. Scans every visible cell value; matches activate + scroll into view. Also driveable via api.openFind / setFindQuery.', 'Filtering & Search', FindInGrid),
  demo('110-locale-aware-filter',   'Locale-aware text filter',    'Pass `filterLocale` and the grid normalises text (NFD + diacritic strip + locale-aware lowercase) so "cafe" matches "Café", "munchen" matches "München", "tokyo" matches "Tōkyō". Locale picker proves Turkish dotted-I behavior.', 'Filtering & Search', LocaleAwareFilter),
  demo('111-set-filter-advanced',   'Set filter (tree / async / Excel)','Three set-list filter patterns: the built-in Excel-style column menu, async-loaded values for huge enums, and a tree-list (Region → Country → City) with cascading checkboxes. All driven through api.setFacetFilter.', 'Filtering & Search', SetFilterAdvanced),
  demo('178-multi-condition-filter','Multi-condition filter (AND / OR)','Two conditions on ONE column, joined by AND or OR: a salary band (> 80k AND < 150k), age outliers (< 25 OR > 60). Open the funnel and click "+ Add condition", or drive it via api.setFilter({ operator, value, operator2, value2, join }).', 'Filtering & Search', MultiConditionFilter),
  demo('179-floating-filters',      'Floating filters (per-operator)','The inline filter row honours every operator per column: pick the operator from the cell funnel, the value input switches to the column type (number / date / text), and Between shows a second "To" input inline - no full menu needed.', 'Filtering & Search', FloatingFilters),
  demo('180-row-dragging',          'Managed row dragging (grid-to-grid)','Reorder rows by dragging their grip, or move a row from one grid into another - both grids share a rowDragGroup, so the row leaves the source and lands in the target. The grid mutates its own data on drop and fires onRowDragEnd on the receiver.', 'Rows & Cells', RowDragging),
  demo('184-external-drop-zone',    'External drop zones (row drag)','Drag a row out of the grid onto any element - an Archive or Delete bucket - via the rowDropZone action. The row leaves the grid and the zone\'s onDrop handles it. In-grid reorder still works.', 'Rows & Cells', ExternalDropZone),
  demo('98-advanced-filter-builder','Advanced filter builder',     'Visual AND/OR query builder, Linear / Notion-style: stack typed rules, choose operators per field, save as preset. "At-risk EMEA accounts" with three rules in one click.', 'Filtering & Search', AdvancedFilterBuilder),
  demo('99-top-n-filter',           'Top N / Bottom N filter',     'BI-style "show me top 10 by revenue" toolbar: pick a metric, pick N, top vs bottom. Live KPI strip shows revenue coverage of the selected slice.', 'Filtering & Search', TopNFilter),

  // ----- Sorting & Grouping
  demo('07-grouping-aggregation',   'Grouping + aggregation',      'Group by department, sum salaries, average performance, expand/collapse keys.', 'Sorting & Grouping', Grouping),
  demo('142-group-aggregators',     'Group aggregators',           'Declarative per-column rollups for group rows via the aggregate column option: sum, avg, min, max, count, countDistinct, extent, first, or a custom (values, rows) reducer. Each rollup is formatted with the column format and shown in the group header.', 'Sorting & Grouping', GroupAggregators),
  demo('89-group-panel',            'Group panel (drag & drop)',   'DevExpress / Kendo-style Group Panel: drag chips into the panel to group, drag inside to reorder grouping levels, × to ungroup. Drives api.setGroupBy() under the hood.', 'Sorting & Grouping', GroupPanel),
  demo('36-reporting-workspace',    'Reporting workspace',         'Pivot-lite: group-by chips, per-column aggregator picker, saved views with localStorage persistence, live KPI strip + summary cards.', 'Sorting & Grouping', ReportingWorkspace),

  // ----- Selection & Clipboard
  demo('04-selection-copy-paste',   'Selection + copy/paste',      'Row + cell-range selection with TSV clipboard round-trip.', 'Selection & Clipboard', SelectionCopyPaste),
  demo('90-selection-api',          'Selection API + events',      'Drive cell selection with api.selectCells / api.getSelected; subscribe to changes via onCellSelectionChange. Live SUM/AVG/MIN/MAX panel + event log + copy-as-TSV.', 'Selection & Clipboard', SelectionApi),
  demo('144-status-bar',            'Status bar (range aggregates)','Excel-style bar under the grid with live aggregates of the selected cell range: Count, Sum, Avg, Min, Max. Enable with statusBar + enableCellSelection, then drag a rectangle across numeric cells. Choose the aggregate set via statusBar={ aggregates }.', 'Selection & Clipboard', StatusBar),
  demo('118-range-selection',       'Range selection (Excel-style)','Drag any rectangle of cells (mouse or Shift+arrows), or Ctrl/Cmd+drag to add MORE ranges - all stay highlighted and copy together. Toolbar issues common ranges via api.selectCells; live SUM/AVG/MIN/MAX/COUNT status bar; copy as TSV.', 'Selection & Clipboard', RangeSelection),
  demo('23-bulk-actions',           'Bulk actions toolbar',        'Select rows → sticky action bar with Mark / Delete / Copy as TSV. The Gmail / Linear pattern.', 'Selection & Clipboard', BulkActions),
  demo('67-context-menu',           'Right-click context menu',    'Custom row context menu (copy, duplicate, move up/down, delete) wired via a contextmenu listener + the wrapper\'s data-svgrid-row attribute.', 'Selection & Clipboard', ContextMenu),

  // ----- Columns
  demo('25-column-pinning',         'Column pinning + freezing',   'Wide 13-column grid. Pin Company left and Price right via the column menu; the middle scrolls under sticky edges.', 'Columns', ColumnPinning),
  demo('54-columns-hierarchy',      'Columns hierarchy + manager', 'Side-panel tree of grouped columns: drag leaves to reorder, click a chevron to collapse a group into one summary column, toggle visibility per leaf or whole group.', 'Columns', ColumnsHierarchy),
  demo('63-column-layout-api',      'Column layout API',           'setColumnWidth + setColumnPinning + getColumnWidths + getColumnPinning. Save the snapshot to localStorage, restore on reload, drive widths and pins from buttons.', 'Columns', ColumnLayoutApi),
  demo('146-tool-panel',            'Tool panel (Columns + Filters)','The docked enterprise sidebar, two tabs. Columns: toggle visibility, reorder up/down, group by a column. Filters: an operator + value control per column (numeric operators come free via cellDataType), kept in sync with the column menu. Enable with the toolPanel prop.', 'Columns', ToolPanel),
  demo('109-column-reorder-engine', 'Column reorder',              'Set `enableColumnReorder` on <SvGrid> and every header becomes draggable, with a drop indicator. api.setColumnOrder / getColumnOrder + onColumnOrderChange event; toolbar buttons drive imperative reorders. Persist the order to restore across reloads.', 'Columns', ColumnReorderEngine),
  demo('172-autosize-columns',      'Autosize columns',            'api.autosizeColumn(id) and api.autosizeAllColumns() snap columns to the widest visible cell via canvas-based text measurement. The column header menu has an "Autosize" item that calls the same code. Manual drag-resize still works.', 'Columns', AutosizeColumns),
  demo('182-aligned-grids',         'Aligned grids',               'Two independent grids sharing alignedGridGroup stay in lockstep: scroll one horizontally and the other follows; resize a column in either and the matching column resizes in both. Budget vs actuals comparison.', 'Columns', AlignedGrids),
  demo('183-collapsible-column-groups','Collapsible column groups','Each quarter is a column group with a header caret. The Total is always shown; month columns tagged columnGroupShow:"open" appear only when the group is expanded (AG-Grid pattern). openByDefault controls the initial state.', 'Columns', CollapsibleColumnGroups),
  demo('185-column-menu-tabs',      'Tabbed column menu',          'Opt into the AG-Grid-style tabbed header menu with columnMenuTabs: General / Filter / Columns tabs on the ⋮ menu. OFF by default (flat actions + Choose columns submenu). Toggle the switch to compare.', 'Columns', ColumnMenuTabs),

  // ----- Rows & Cells
  demo('10-custom-cells-and-themes','Custom cells + themes',       'Avatars, sparklines, progress bars, density toggle, dark mode, full a11y.', 'Rows & Cells', CustomCells),
  demo('174-zebra-rows',            'Zebra rows',                  'Set the zebraRows prop and alternating data rows take the theme\'s --sg-row-alt-bg color. Only data rows stripe - pinned, group, detail, and summary rows keep a single background (the pinned Total row stays one band). Toggle it live.', 'Rows & Cells', ZebraRows),
  demo('140-sparkline-cells',       'Sparkline cells',             'In-cell mini charts as a first-class column type: set `sparkline` on a number-array column and the grid paints an inline SVG. Line, area, bar (with +/- coloring), and win/loss - no chart library, no custom snippet.', 'Rows & Cells', SparklineCells),
  demo('141-conditional-formatting','Conditional formatting (engine)',      'Excel-style value-driven cell coloring as a declarative `conditionalFormats` engine prop: gradient heat maps (alpha ramp, zero-centred, banded, column-comparison), in-cell data bars, icon sets, and predicate rules - scoped per column, no per-cell snippet.', 'Rows & Cells', ConditionalFormattingEngine),
  demo('62-conditional-styling',    'Conditional styling',         'Support-ticket triage board: rowClass highlights SLA breach + at-risk rows with side-bar accents; cellClass paints priority pills, status badges, agent-load progress bars, and CSAT highlights.', 'Rows & Cells', ConditionalStyling),
  demo('85-tooltips-and-notes',     'Tooltips + per-cell notes',   'Column-level `tooltip` prop (static or value-driven) plus per-cell notes via the `notes` prop on `<SvGrid>` - corner indicator + edit modal.', 'Rows & Cells', TooltipsAndNotes),
  demo('55-state-maintenance',      'State maintenance',           'Capture / restore the grid\'s sort, filters, visibility, widths, page, selection, expansion. Includes undo / redo history, named bookmarks, JSON import/export, debounced localStorage auto-save.', 'Rows & Cells', StateMaintenance),
  demo('171-persistent-state',      'State maintenance (auto)',    'CRM contacts grid with editable cells. attachAutoSavedView reserves one slot inside createNamedViews + localStorageViews and mirrors the grid view to it: sort / filter / hide / reorder / resize a column, reload the tab, the layout is right where you left it. Same store is reusable for additional named layouts.', 'Rows & Cells', PersistentState),
  demo('143-named-views',           'Named views',                 'Save the grid sort + filter + layout as a named view and restore it in one click. createNamedViews(api, { storage }) wraps getState/setState; localStorageViews persists across reloads, or plug your own server adapter.', 'Rows & Cells', NamedViews),
  demo('94-conditional-formatting', 'Conditional formatting',      'Excel-style color scale, data bars, icon sets, and heatmap tint - all via user-land cellRenderers. Per-formatter toggles to compare on/off. The "P&L preset" lights up the whole grid.', 'Rows & Cells', ConditionalFormatting),
  demo('105-row-reorder',           'Row reorder (drag rows)',     'Priority queue with a ⋮⋮ drag handle column. Multi-select aware - check several rows, drag the group as a block. Auto-scroll near viewport edges.', 'Rows & Cells', RowReorder),
  demo('107-pinned-rows',           'Pinned rows (top / bottom)',  'Frozen "Account totals" row at the top + sticky "Page totals" at the bottom that reacts to filters. Right-click any row to pin it. Three stacked SvGrid instances share one column schema.', 'Rows & Cells', PinnedRows),
  demo('108-pinned-rows-engine',    'Pinned rows (engine prop)',   'Pass pinnedTopRows / pinnedBottomRows arrays straight to <SvGrid>. Sticky cells, same table, same column schema. Bottom row tracks api.getDisplayedRows() so it updates with filters.', 'Rows & Cells', PinnedRowsEngine),

  // ----- Tree & Hierarchy
  demo('28-org-chart-tree',         'Org chart tree',              '5-level employee hierarchy with role pills, department, headcount roll-up (post-order DFS). Expand/collapse, expand-all/collapse-all.', 'Tree & Hierarchy', OrgChartTree),
  demo('29-wbs-project-tree',       'Project WBS tree',            'Phase → task → subtask. Edit a leaf\'s % complete; the entire ancestor chain recomputes via effort-weighted average.', 'Tree & Hierarchy', WbsTree),
  demo('30-bom-tree',               'Bill of Materials',           'Bicycle BOM, 4 levels deep. Edit any leaf part\'s qty or unit cost; subtotals roll up through the assembly chain to the grand total.', 'Tree & Hierarchy', BomTree),
  demo('31-lazy-tree-load',         'Lazy tree (load on expand)',  'Region → Country → State → City. Children fetched async on first expand with a "Loading…" placeholder row; subtrees are cached on second expand.', 'Tree & Hierarchy', LazyTree),
  demo('08-tree-and-master-detail', 'Tree + master/detail',        'Hierarchical file-system rows and an order/line-item master-detail view.', 'Tree & Hierarchy', TreeAndMasterDetail),
  demo('102-tree-checkbox-cascade', 'Tree checkbox cascade',       'Permissions matrix as a tree: workspaces → resources → actions. Checking a parent checks descendants; partial state on parents. Live cost rollup as you click.', 'Tree & Hierarchy', TreeCheckboxCascade),

  // ----- Master-Detail & Forms
  demo('40-forms-master-detail',    'Forms-in-grid (master/detail)','Master grid + tabbed detail form. Dirty tracking, inline validation, atomic Save / Discard, contact subgrid.', 'Master-Detail & Forms', FormsMasterDetail),
  demo('70-multi-grid-sync',        'Multi-grid sync',             'Two grids over one $state array - edits on the left propagate to the right instantly; each grid keeps its own filter + sort.', 'Master-Detail & Forms', MultiGridSync),
  demo('97-side-drawer-edit',       'Side-drawer edit form',       'Linear / Notion pattern: click a row, a polished drawer slides in with the full record, dirty-state badge, live validation summary, Esc / Ctrl+Enter shortcuts.', 'Master-Detail & Forms', SideDrawerEdit),
  demo('106-detail-rows',           'Detail rows (expandable)',    'Stripe / GitHub-style inline row expansion: click the chevron to reveal a 4-panel detail (line items, shipping timeline, payments, support thread). Expand-all / collapse-all toolbar.', 'Master-Detail & Forms', DetailRows),
  demo('181-master-detail-grid',    'Master / detail (nested grid)','The classic AG-Grid master/detail: expand any account row to reveal a full nested SvGrid of its call records. Built on isDetailRow + renderDetailRow - a real full-width detail row hosting another grid. Expand-all / collapse-all.', 'Master-Detail & Forms', MasterDetailGrid),

  // ----- Server-Side Data
  demo('09-server-side',            'Server-side data',            'Sort/filter/page round-tripped to a mock endpoint with debounce + cancel.', 'Server-Side Data', ServerSide),
  demo('33-server-infinite',        'Server-side infinite scroll', '100k-event audit log behind a mock API. Sparse chunked load on scroll; sort + filter + search pushed to the server.', 'Server-Side Data', ServerInfinite),
  demo('148-server-row-model',      'Server-Side Row Model (SSRM)','One datasource contract for server-backed data: implement a single async getRows({ startRow, endRow, sortModel, filterModel }) and createServerDataSource owns the sort/filter/page lifecycle and races stale responses away. Here a 100,000-row in-memory server behind 250ms latency; the grid holds only the current 50-row page.', 'Server-Side Data', ServerRowModel),
  demo('344-server-grouping-model', 'Server grouping (first-class)','First-class server-side grouping through one getRows contract: the request carries groupBy + groupKeys, and createServerGroupModel owns the group tree - lazy expand per level, aggregation, per-node caching, race-safety - handing back a flat displayRows list. Here a 63,000-row in-memory server behind 200ms latency; the grid holds only the groups you expand.', 'Server-Side Data', ServerGroupingModel),
  demo('72-graphql-adapter',        'GraphQL adapter',             'Server-side sort / filter / page wired to a mock GraphQL resolver. Side panel shows the live query doc so you can compare what the grid sent to the network tab.', 'Server-Side Data', GraphqlAdapter),
  demo('337-live-rest-dummyjson',   'Live REST (public API)',      'Real rows over the network from dummyjson.com via the enterprise createRestDataSource + a shape adapter (dummyJsonAdapter): skip/limit paging and sortBy/order sorting mapped to the API dialect. Swap URL + adapter (jsonServerAdapter / offsetLimitAdapter) to point at any public API. Includes an error/retry surface.', 'Server-Side Data', LiveRestDummyJson, { pro: true }),
  demo('79-loading-from-rest',      'Loading from REST',           'Fetches rows from a public REST API with loading skeleton, retry, error surface, and a Reload button. The pattern every line-of-business app needs.', 'Server-Side Data', LoadingFromRest),
  demo('113-cursor-pagination',     'Cursor (keyset) pagination',  'The modern alternative to offset paging: server returns prev/next cursor tokens so writes never shift rows across pages and deep pages stay O(log N). Page-size picker, live timing readout.', 'Server-Side Data', CursorPagination),
  demo('114-server-grouping',       'Server-side grouping + aggregates','GROUP BY + SUM/AVG/MIN/MAX pushed to the server; grid renders pre-aggregated buckets with on-demand drill-in. Side-by-side: client 100k = ~600ms vs server 12 grouped rows = ~80ms.', 'Server-Side Data', ServerGrouping),
  demo('115-optimistic-updates',    'Optimistic updates + rollback','Edit a cell; UI updates immediately; server validates async; on reject the value rolls back with a toast and an inline ! retry chip. Per-cell pending / saved / failed badges + audit log.', 'Server-Side Data', OptimisticUpdates),
  demo('116-websocket-live-updates','WebSocket live updates',      'Insert / update / delete deltas merged into the grid by id, with cell-flash on update, pause / resume, throughput slider, reconnect button, and a 12-event tail.', 'Server-Side Data', WebSocketLiveUpdates),
  demo('117-bulk-operations',       'Bulk server operations',      'Select N rows → choose approve / archive / reassign / delete → server processes with configurable concurrency (1/4/10). Live progress bar, per-row outcome chip, mid-flight cancel.', 'Server-Side Data', BulkOperations),
  demo('118-live-dashboard',        'Live 10M-row dashboard',      '10,000,000-transaction stream behind a mock API: server-side paging, sort, filter, a 1-second live feed, and inline SVG throughput/distribution charts.', 'Server-Side Data', LiveDashboard),

  // ----- Real-time & Streaming
  demo('11-stock-market',           'Stock market - live',         'WebSocket-style ticking feed. Cells flash on up/down ticks, pause control, throttle.', 'Real-time & Streaming', StockMarket),
  demo('14-industrial',             'Industrial - IoT sensors',    'Live sensor floor: threshold-driven status, sparkline trends, group by line.', 'Real-time & Streaming', Industrial),
  demo('20-industrial-dashboard',   'Industrial dashboard',        'KPI cards plus live line-status and active-alarms grids, on a 2-second tick.', 'Real-time & Streaming', IndustrialDashboard),
  demo('34-realtime-orders',        'Real-time / streaming',       'WebSocket-style live order stream with delta merge, out-of-order safety, pause / backlog, disconnect-reconnect, throughput slider.', 'Real-time & Streaming', RealtimeOrders),
  demo('149-realtime-collaboration','Real-time collaboration',     'Presence (who is here + where their cursor is) and live edits (a change in one client lands in every other) over a pluggable transport. createCollaboration + broadcastChannelTransport sync cursors and edits across tabs with zero backend; swap the transport for a WebSocket to go cross-machine. Also the substrate for multiple AI agents editing one grid.', 'Real-time & Streaming', RealtimeCollaboration),
  demo('145-transaction-api',       'Transaction API (batched)',   'api.applyTransaction({ add, update, remove }) applies a batch of row mutations in ONE data update - the high-frequency streaming path. update and remove-by-id match on getRowId; remove also accepts row refs. Live order book ticking via batched transactions.', 'Real-time & Streaming', TransactionApi),
  demo('73-chartjs-sync',           'Real-time + Chart.js sync',   'Mock WebSocket pushes price ticks every 350 ms. A Chart.js bar chart auto-syncs with the grid - filter the Symbol column, the chart trims to match.', 'Real-time & Streaming', ChartJsSync),
  demo('353-built-in-charting',     'Built-in charts (one prop)','The whole select-range -> chart -> cross-filter loop as a single `charting` prop on <SvGrid>. A resizable chart drawer opens from the toolbar; it re-draws live as you filter/sort, scopes to a selected cell range, and clicking a chart category filters the grid back. Free in the MIT core.', 'Charts', BuiltInCharting),
  demo('354-charting-multi-series', 'Multi-series & stacked','The `charting` prop with a `series` (split-by) column draws one series per distinct value, grouped or stacked - still one prop. The panel Group by / Split by / Value / Stacked controls stay live and filtering the grid re-aggregates the multi-series chart.', 'Charts', ChartingMultiSeries),
  demo('355-charting-custom-buildspec','Custom charts (buildSpec)','Shapes group-by cannot express - here a sankey flow - still render in the built-in panel via `charting.buildSpec: (rows) => ChartSpec`. The custom chart scopes to the selection and re-runs on every grid change, so it stays live.', 'Charts', ChartingCustomBuildSpec),
  demo('356-spreadsheet-chart','Spreadsheet chart (Excel-style)','An editable sales sheet with the chart drawer open beside it - type a new number into any Units / Revenue cell and the chart redraws, just like an Excel chart bound to a table. Switch Type, swap Group by / Split by / Value, aggregate, stack, format, or add labels - all live.', 'Charts', SpreadsheetChart),
  demo('358-charting-by-date','Charting by date (time axis)','A daily signups sheet charted by a real date column. Because the group-by is a date, the chart panel adds a Date-axis toggle (proportional time gaps + real date ticks) alongside a Log-scale toggle - both live. Export the chart as PNG / SVG / CSV from the panel.', 'Charts', ChartingByDate),
  demo('357-ai-chart-this','AI chart builder','With `installEnterprise(api)`, the chart panel gains an AI button: describe a chart in plain English ("total price by country stacked by product") and the model returns a chart config - type, group-by, split-by, measure, aggregate - applied live. Enterprise-gated AI over the free MIT chart panel; runs on the bundled mock provider.', 'AI', AiChartThis, { pro: true }),
  demo('359-pivot-chart','Pivot chart (Table <-> Chart)','The Excel PivotTable <-> PivotChart pairing: one drag-drop pivot layout (Rows / Columns / Values) renders as either an expandable table or a live chart. Rows become categories (nested -> a grouped axis), Columns series, Values the measure. Enterprise pivot engine (createPivotModel -> pivotToChartSpec) over the free MIT SvGridChart.', 'Pivot Grid', PivotChart, { pro: true }),
  demo('147-integrated-charts',     'Integrated charts (no dependencies)', 'Chart the grid data with no external charting library. SvGridChart renders a ChartSpec; rowsToChartSpec aggregates the grid current (filtered/sorted) rows into one. Bar, line, area, pie - plus 100% stacked, top-N + Other, an average reference line, and double-click-to-isolate a series. Filter the grid and the chart re-aggregates live.', 'Charts', IntegratedCharts),
  demo('150-scatter-bubble',        'Scatter / bubble chart',      'A scatter plot maps two numeric measures (x vs y); a bubble chart adds a third via dot radius. type: scatter with series points [{ x, y, r }]. Spend vs revenue, sized by deals, coloured by region, with an average-revenue reference line. Filter the grid and the cloud re-plots.', 'Charts', ScatterBubble),
  demo('151-time-series-chart',     'Time-series chart (date axis)','xType: time spaces points by ACTUAL time - irregular date gaps render proportionally - and shows real date ticks. A referenceLines target/SLA line spans the plot; toggle 100% stacked to read each day as a share of its total. Line, stacked area, or stacked bar.', 'Charts', TimeSeriesChart),
  demo('152-chart-wizard',          'Chart wizard (from the grid)','Grid on the left, chart wizard on the right. The wizard builds a chart from the grid rows via rowsToChartSpec: pick the type from a gallery (whose thumbnails are themselves live mini SvGridChart instances), choose group-by + measure + aggregation, and a palette. Column, Bar (horizontal), Line, Area, Pie with stacked / 100% variants. Drag a cell range or tick row checkboxes to chart just the selection; otherwise the whole filtered / sorted set re-aggregates live.', 'Charts', ChartWizard),
  demo('153-chart-zoom-brush',      'Chart zoom + brush mini-map','Drag a rectangle over a 180-day series to zoom in; double-click resets. A compact brush below shows the full range with a draggable window - drag the body to pan, edges to resize. Pairs with the crosshair tooltip + PNG/SVG export.', 'Charts', ChartZoomBrush),
  demo('154-chart-heatmap',         'Heatmap chart',               'type: heatmap renders a colored grid (one cell per row/column) from the same categories + series shape. Choose a sequential or diverging color ramp; cell text auto-contrasts black/white. Filter the grid Channel column and the heatmap re-renders.', 'Charts', ChartHeatmap),
  demo('155-chart-analytics',       'Analytics: trend, log, drill','Four story-telling chart features at once: overlay (SMA/EMA/linear regression), annotations pinned at named events, yScale: log for wide-range data, and onDrill that filters the grid to the rowIds of the clicked category. Click any day to drill.', 'Charts', ChartAnalytics),
  demo('156-chart-patterns',        'Color-blind-safe pattern fills','patternFallback: true layers a texture (stripe / crosshatch / dots / diagonal) on every series so two series with similar hues still read as distinct in grayscale or for readers with color-vision deficiency. Works on bars and area stacks.', 'Charts', ChartPatterns),
  demo('157-chart-forecast-band',   'Forecast: smooth + confidence band','smooth: true bends the polyline into a monotone cubic curve that still passes through every point but flows between them. upperValues + lowerValues shade a translucent envelope around the forecast for at-a-glance uncertainty. 12 weeks actuals + 8 weeks forecast.', 'Charts', ChartForecastBand),
  demo('158-chart-waterfall',       'Waterfall (signed P&L)',     "type: waterfall renders each bar starting where the previous one ended. waterfallTotals marks subtotal/total bars that span from 0. Bars colour-code by sign (green / red); total bars get a neutral slate. Connector lines link bar tops so the cumulative trend reads at a glance.", 'Charts', ChartWaterfall),
  demo('159-chart-streaming',       'Streaming chart (rolling window)','Hit Start - prices stream in at 4 Hz. The buffer holds the last 60 ticks; older points drop off the left as new ones appear on the right. Re-aggregates via rowsToChartSpec so smoothing, brush, zoom all stay in play.', 'Charts', ChartStreaming),
  demo('160-chart-funnel',          'Funnel chart (signup conversion)','type: funnel renders strictly-decreasing values as a stack of trapezoids. Each segment shows conversion vs. the top of the funnel inline; hover for the step drop-off. Click a segment to record a drill selection.', 'Charts', ChartFunnel),
  demo('161-chart-radar',           'Radar chart (product comparison)','type: radar plots each category as a spoke; every series draws a polygon connecting its values across the spokes. Shared scale makes two products read against each other directly. Click the legend to isolate one.', 'Charts', ChartRadar),
  demo('162-chart-calendar',        'Calendar heatmap (year of days)','type: calendar renders a GitHub-commit-style 7-row x ~53-column grid. Each cell shaded by its value; days with no value render as outlined blanks so missing data reads as missing. Filter the grid Type column and the heatmap re-aggregates.', 'Charts', ChartCalendar),
  demo('163-chart-gauge',           'Gauge dial (KPI dashboard)',  'type: gauge renders a semicircle with track + value arcs, optional red/amber/green range bands, and a target tick. Click any row in the KPI grid to drive the dial; bands auto-flip direction based on whether higher or lower is better.', 'Charts', ChartGauge),
  demo('164-chart-treemap',         'Tree-map (sales by region·category)','The canonical BI tree-map: revenue broken down hierarchically into nested rectangles - bigger value = bigger rectangle. The squarified algorithm keeps every cell close to a square so labels stay readable. Switch the drill order (Region → Category vs. Category → Region) to compare the same data two ways.', 'Charts', ChartTreemap),
  demo('165-chart-sankey',          'Sankey diagram (user flow)',  'type: sankey lays nodes out in columns by longest-path depth and renders flow links as bezier ribbons whose width = link value in pixels. User journey from acquisition channel through onboarding to outcome. Hover any ribbon for the source -> target value.', 'Charts', ChartSankey),

  // ----- Spreadsheet
  demo('27-spreadsheet-ribbon',     'Spreadsheet + Ribbon bar',    'Excel-style Ribbon UI driving the grid via SvGridApi: cell formatting (bold, color, number format), insert/delete row, sort, live SUM/AVG/COUNT.', 'Spreadsheet', SpreadsheetRibbon),
  demo('83-spreadsheet-formulas',   'Spreadsheet + formulas',      'Real formula engine inside the grid: cell refs (A1), ranges (A1:A10), SUM / AVG / IF / COUNTIF / ROUND, arithmetic, string concat, cycle detection. Excel-like calc without bundling HyperFormula.', 'Spreadsheet', SpreadsheetFormulas),
  demo('169-cell-borders',          'Per-cell custom borders (KPI)','Editable KPI scorecard. spreadsheetLayout paints HOT-style per-edge custom borders via an absolute-positioned overlay (no border-collapse conflicts). Edit any quarter or target - the borders re-derive: green double = beat target, blue solid = hit, amber dotted = near miss, red dashed = bad miss; row champion gets a colored full frame.', 'Spreadsheet', CellBordersDemo),
  demo('170-cell-merging',          'Cell merging (spreadsheet shell)','A real invoice rendered on an Excel-style shell: A / B / C / D / E column letters across the top, row numbers down the left. Brand band, bill-from / bill-to address blocks, meta block, line items, totals, notes, signatures - all assembled from MergeSpec + CellBorderSpec. Editable Qty / Rate / addresses / notes; totals recompute live.', 'Spreadsheet', CellMergingDemo),
  demo('173-hyperformula',          'HyperFormula integration',    'Full HyperFormula engine wired into the grid as a peer-optional dep. Editable spreadsheet with A1-style cell refs, dozens of formulas across math (SUM / SUMIF), lookup (VLOOKUP / INDEX-MATCH), text (CONCAT / UPPER), date (TODAY / DATEDIF), logical (IF nests), financial (PMT / IRR / NPV), statistical (AVERAGE / MAX / RANK).', 'Spreadsheet', HyperFormulaDemo),
  demo('207-blank-sheet',           'Blank sheet - just type',     'An empty Excel-style sheet on a plain <SvGrid>: column-letter headers (A..Z), a built-in 1..N row gutter, a name box + formula bar with a browsable function picker, gridlines, range selection and a fill handle. A real HyperFormula engine underneath: type a literal or a formula like =SUM(B2:D2) / =IF(...) and every dependent cell recalculates live. Drag a row or column border to resize; right-click for Cut / Copy / Paste / Clear.', 'Spreadsheet', BlankSheet),
  demo('208-freeze-panes',          'Freeze panes',                'The Excel Freeze Panes corner on a plain <SvGrid>: the Account and Owner columns stay pinned while you scroll across a full year of months, and the sticky column-letter + row-number headers stay put as you scroll down. HyperFormula keeps each row total (column O) and the bottom Total row live as you edit any month. Pinning those two columns is one prop: initialColumnPinning.', 'Spreadsheet', FreezePanes),
  demo('209-data-validation',       'Data validation (dropdowns)', 'Excel Data Validation on a plain <SvGrid>: Status / Priority / Owner / Sprint columns are list-constrained (double-click for a dropdown), and Estimate must be a whole number 0-40. Four cells arrive invalid and light up red with the reason as a tooltip; fix one and it clears live. Dropdowns are editorType:list + editorOptions; the flag is the declarative validate() hook.', 'Spreadsheet', DataValidationSheet),
  demo('210-format-cells',          'Format Cells',                'The Excel Home -> Number experience: select a range and apply a display format - Currency, Percent, Thousands, Number, Date, or General - and only the rendering changes; the stored value and every formula are untouched. HyperFormula keeps Gross profit, Margin and the Total column live, so a computed % formats exactly like a typed number.', 'Spreadsheet', FormatCells),
  demo('211-financial-model',       'Financial model (amortization)','A real analyst model on the sheet: three blue INPUT cells (Principal, APR, Term) drive a full 360-month amortization schedule built entirely from formulas - PMT for the fixed payment, then per-period interest / principal / running balance that each reference the row above. Change an input and all 360 rows plus the summary recompute instantly. Blue = you type, black = computed.', 'Spreadsheet', FinancialModel),
  demo('212-dashboard-sheet',       'Dashboard sheet',             'A spreadsheet that reads like an Excel dashboard: each channel row carries an inline SVG trend sparkline and an eight-week heatmap shaded by volume. Total and Avg are live =SUM / =AVERAGE formulas - edit any weekly cell and the sparkline reshapes, the heatmap re-shades, and the totals update at once. Sparklines are a per-column custom cell; the heatmap is value-driven cellClass.', 'Spreadsheet', DashboardSheet),

  // ----- Themes & Styling
  demo('37-theming-studio',         'Theming studio',              'Live token playground: brand color, density, radius, font, dark/light, zebra. Copy-ready CSS snippet, persists across reloads.', 'Themes & Styling', ThemingStudio),
  demo('74-theme-integrations',     'Theme integrations',          'Five design-system presets (Ant, MUI, Fluent, Base Web, shadcn) toggled by mapping --sg-* tokens. Side panel shows the exact CSS to paste into your app.', 'Themes & Styling', ThemeIntegrations),

  // ----- Keyboard & Accessibility
  demo('17-accessibility',          'Accessibility',               'WAI-ARIA grid, keyboard navigation, aria-live announcements, high-contrast focus toggle.', 'Keyboard & Accessibility', Accessibility),
  demo('65-keyboard-shortcuts',     'Keyboard shortcuts + a11y',   'Ctrl+K command palette, Ctrl+/ cheat sheet, vim-style gg / G chord nav. Layers on top of the grid\'s WAI-ARIA grid pattern + roving tabindex.', 'Keyboard & Accessibility', KeyboardShortcuts),

  // ----- Mobile & Responsive
  demo('81-mobile-card-view',       'Mobile / responsive cards',   'Under 720px the grid auto-pivots into touch-friendly cards backed by the same $state array. Tap a card to expand into an edit panel; writes flow through api.setCellValue.', 'Mobile & Responsive', MobileCardView),

  // ----- Integrations
  demo('15-localization',           'Localization',                'Same data re-rendered as locale + currency change - headers, dates, numbers, RTL.', 'Integrations', Localization),
  demo('38-rtl-i18n',               'RTL + i18n stress',           'Six locales (en, de, fr-CA, ja, ar, he). Direction flips, full string translation, Intl-driven currency/date/number, mixed-direction safe via <bdi>.', 'Integrations', RtlI18n),
  demo('16-csp-compliant',          'CSP-compliant grid',          'No eval, no inline scripts. Documented CSP header + live runtime self-check and violation log.', 'Integrations', CspCompliant),
  demo('19-ssr',                    'Server-side rendering',       'SvelteKit-style SSR with a sandboxed pre-hydration snapshot to prove the markup is meaningful without JS.', 'Integrations', Ssr),
  demo('77-smart-chart',            'Smart.Chart integration',     'Mounts a <smart-chart> web component (htmlelements.com) and pipes the grid\'s displayed rows into its dataSource. Re-aggregates on every filter / sort.', 'Integrations', SmartChart),
  demo('139-migration-from-ag-grid','AG Grid ↔ sv-grid side-by-side','Two real grids over the same dataset: AG Grid Community v35 on the left, sv-grid on the right. Same global filter drives both. Source code panels show the wiring for either side.', 'Integrations', DevMigrationFromAg),

  // ----- Industry Templates
  demo('12-hr-team',                'HR team directory',           'Employee directory with avatars, status badges, group by team / location / status.', 'Industry Templates', HrTeam),
  demo('13-finances',               'Finances - ledger',           'Account ledger with running balance, currency formatting, category chips, paging.', 'Industry Templates', Finances),
  demo('32-manufacturing-ops',      'Manufacturing operations',    'Plant-floor view: KPI cards (throughput, OEE, defect rate) + active-runs grid with progress bars, status pills, live 5-second tick.', 'Industry Templates', ManufacturingOps),
  demo('35-permissions-audit',      'Permissions, audit & history','Role-based cell editing, PII masking, full audit log with one-click revert, per-cell history popover.', 'Industry Templates', PermissionsAudit),
  demo('39-print-board-export',     'Print + boardroom export',    'Quarterly P&L print pack: cover page, repeat-on-page headers, page-size + orientation, CSV / HTML download, browser-native PDF.', 'Industry Templates', PrintBoardExport),
  demo('41-healthcare-emr',         'Healthcare EMR - inpatient',  'ICU census with vitals sparkline, risk score, code status, allergy chips, role-based cell editing (viewer / nurse / physician / admin).', 'Industry Templates', HealthcareEmr),
  demo('42-logistics-fleet',        'Logistics - live fleet ops',  'Live shipment board: route lane, progress vs commit, ETA delta, alert chips. Pause / disconnect / throughput slider via streaming helper.', 'Industry Templates', LogisticsFleet),
  demo('43-compliance-queue',       'Compliance / regulatory queue','L1 / L2 / L3 approval chain, live SLA timer, role-gated approve / return / reject, immutable case-history audit panel.', 'Industry Templates', ComplianceQueue),
  demo('44-field-service',          'Field service dispatch',      'Dispatcher board: priority + status + tech editable inline, SLA tone gauge, today-timeline cell, tech capacity panel, live status stream.', 'Industry Templates', FieldService),
  demo('45-gantt-chart',            'Gantt chart',                 'Project plan with a wide custom Schedule cell: bars positioned by start/end %, phase coloring, progress fill, today line, overdue glow.', 'Industry Templates', GanttChart),
  demo('46-scheduler',              'Scheduler',                   'Single-day appointment board: providers as rows, an hour axis, click any appointment to edit it in the side panel. Now-line ticks live.', 'Industry Templates', Scheduler),
  demo('47-trash-truck-timeline',   'Trash truck timeline',        'Public-works dispatcher: each truck glides along its day-long route with spinning wheels; stops, fill levels and statuses update on a 2s tick.', 'Industry Templates', TrashTruckTimeline),
  demo('48-crm-sales-pipeline',     'CRM - sales pipeline',        'Deal board with stage chips, weighted forecast bar, inline stage / probability editing, deal detail aside with activity feed + advance / won / lost.', 'Industry Templates', CrmSalesPipeline),
  demo('49-admin-dashboard',        'Admin dashboard',             'CRUD-heavy users board: inline role / status / MFA edit, bulk activate / deactivate / delete, invite dialog, permissions matrix, live audit log.', 'Industry Templates', AdminDashboard),
  demo('50-seller-panel',           'Seller panel - e-commerce',   'Marketplace dashboard: catalog with SVG thumbnails, inventory bars vs reorder threshold, live orders pipeline, pricing rules - four tabs over one product list.', 'Industry Templates', SellerPanel),
  demo('205-project-management',    'Project management board',    'Nested, collapsible column groups (Task / Details / Timeline / Progress), status + priority + assignee dropdowns, date cells, a custom progress-bar renderer, drag-to-reorder rows, and client pagination - all from stock props.', 'Industry Templates', ProjectManagement),

  // ----- Pro (commercial features in @svgrid/enterprise)
  demo('193-studio-live-sql',         'SvGrid Studio · live SQL',     'The Studio stack backed by a REAL Postgres running in the browser via PGlite (WASM), no server. createSqlDataSource turns the grid\'s sort / filter / page requests into parameterized SQL run through PGlite; the executed query is shown live under the toolbar. Full CRUD with optimistic updates against actual Postgres.', 'Studio', StudioLiveSql,          { pro: true }),
  demo('338-pglite-northwind',        'Northwind on PGlite',            'The classic Northwind sample DB (categories, customers, products, orders, order_details) seeded into a real in-browser Postgres (PGlite, WASM). Switch between a five-table JOIN exposed as a read-only VIEW and the editable base tables - each via createSqlDataSource. Sort / filter / page / edit all run as parameterized SQL; new rows get an auto id from a Postgres IDENTITY sequence.', 'Studio', PgliteNorthwind, { pro: true }),
  demo('194-studio-supabase',         'SvGrid Studio · Supabase',     'The Studio stack over hosted Postgres on Supabase, straight from the browser via supabase-js (PostgREST) and your project\'s public anon key. createSupabaseDataSource maps the grid\'s sort / filter / page / CRUD onto the query builder, introspectSupabaseTable adapts to any table AND detects foreign keys (a FK column auto-becomes a searchable lookup in the form), and createSupabaseRealtime makes it LIVE - change a row in the Supabase dashboard and it flashes in the grid (toggle the Live pill). Paste your URL + anon key, run the one-time setup SQL, done. RLS keeps the anon key safe.', 'Studio', StudioSupabase,        { pro: true }),
  demo('195-studio-relations',        'SvGrid Studio · relations',    'Foreign-key lookup fields end to end. Contacts belong to a Company: the contact form renders a searchable Company picker (SvLookupInput + createRelationLookup) that queries the Companies source and stores the id, while the grid shows the resolved company NAME. The lookup runs over the same ServerDataSource contract, so related options can come from Supabase / REST / SQL / in-memory (here both entities are in-memory).', 'Studio', StudioRelations,       { pro: true }),
  demo('196-studio-auth',             'SvGrid Studio · secured',      'A secured screen: SvAuthGate requires a signed-in user (Supabase Auth via createSupabaseAuth) before showing the Studio grid, with a login / sign-up form and a signed-in bar. Uses a mock auth client so any email + password works here; swap for your supabase-js client and Row-Level Security scopes each user to their own rows (auth = who, RLS = what).', 'Studio', StudioAuth,             { pro: true }),
  demo('197-studio-chart',            'SvGrid Studio · chart',        'A live chart panel beside the grid, driven by the same data source: rowsToChartSpec aggregates the rows (group by tier / active, reduce MRR by sum / avg / count) and SvGridChart renders bar / pie / line - no external chart library. The chart doubles as a filter control: click a bar or slice to filter the grid to that category. Create / edit / delete and the chart updates.', 'Studio', StudioChart,            { pro: true }),
  demo('198-studio-form-fields',      'SvGrid Studio · rich fields',  'Rich edit-form fields: an image UPLOAD field (SvFileInput - preview + file picker, stores a data URL with no backend, or a URL via an uploads handler) shown as an avatar in the grid, and a CASCADING dropdown (City computed from the chosen Country via dependentOptions, cleared when the country changes). Both are schema-driven on SvGridEditPanel.', 'Studio', StudioFormFields,       { pro: true }),
  demo('199-studio-computed-hooks',   'SvGrid Studio · computed & hooks', 'Business logic on the schema. `total` is a COMPUTED field (qty * price) - read-only in grid + form, recomputed live as you type, never stored or submitted. withEntityRules materializes it onto every row and runs the schema hooks: beforeCreate stamps createdAt, and a cross-field validate rejects a non-positive quantity.', 'Studio', StudioComputedHooks,   { pro: true }),
  demo('200-studio-dashboard',        'SvGrid Studio · dashboard',    'A schema-driven dashboard above the grid. SvSchemaDashboard renders a declarative spec of KPI tiles (count / sum / avg) + charts (SvSchemaChart) over the same EntitySchema - a data view, not a page builder. Click a chart category to drill the grid; create / edit / delete and the KPIs and charts update.', 'Studio', StudioDashboard,        { pro: true }),
  demo('53-excel-import',             'Excel / CSV import',             'File picker + column mapping + per-row validation preview before commit. Reads xlsx / csv / tsv / json with format auto-detect.',     'Data Export & Import', ExcelImport,            { pro: true }),
  demo('88-staged-editing',           'Staged / batch editing',         'Edits buffer into a draft; user reviews every change in a side panel, then commits the batch (one server roundtrip) or reverts back to originals.', 'Editing', StagedEditing,          { pro: true }),
  demo('51-ai-assistant',             'AI assistant',                   'NL filter / smart-fill / summarise / classify driven by a BYO model adapter. Runs end-to-end against the bundled mock provider so no API key is required.', 'AI', AiAssistant,            { pro: true }),
  demo('75-ai-smart-paste',           'AI Smart Paste',                 'Paste CSV / TSV / free-form text - the assistant parses it into typed rows with a preview panel. Swap mockAssistant for your LLM endpoint and ship.', 'AI', AiSmartPaste,           { pro: true }),
  demo('92-nl-filter-bar',            'NL filter bar (AI)',             'Type "EMEA active over 50k" - the AI Platform parses your phrase into api.setFilter / setSort / topN calls. Demo ships a rule-based fallback so you can evaluate without a key; production wiring needs an AI Platform key.', 'AI', NlFilterBar,            { pro: true }),

  // ----- New enterprise features
  demo('96-high-contrast-theme',      'High-contrast theme',            'WCAG 2.2 AAA-grade preset for accessibility procurement. Token block opts a subtree into the high-contrast skin while the rest of the page stays standard. Light + dark.', 'Themes & Styling', HighContrastTheme),
  demo('100-anomaly-highlights',      'Anomaly highlights',             'IQR + rare-value detectors paint outliers per cell with severity halos (warning / outlier / extreme). Severity threshold toggle, per-detector tooltip explaining what tripped.', 'Rows & Cells', AnomalyHighlights),
  demo('112-barcode-cells',           'Barcode label cells (EAN-13)',   'Every row renders a real, scannable EAN-13 barcode as crisp SVG - no canvas, no eval, no dependency. Retail / warehouse / inventory pattern. Row virtualization keeps only visible barcodes in the DOM; click a row for a shelf-label preview.', 'Rows & Cells', BarcodeCells),
  demo('120-test-systems-monitor',    'Test systems monitor (live ops)','Operations console for a fleet of connected test & measurement systems: live status, utilization sparklines, temperature, alarms, firmware, and calibration with stable row identity (getRowId). Select systems for bulk actions (acknowledge alarms, schedule calibration), group by site, KPI strip, search + filters, and master-detail with live instrument tags. Virtualized to fleet scale.', 'Industry Templates', TestSystemsMonitor),
  demo('167-project-tracker',         'Project tracker (PM workspace)', 'Linear-style project workspace: KPI strip (Projects / In progress / Ready / Blocked / Budget), bulk-action toolbar (Mark ready, Block, Move to launch, Delete) that enables on selection, phase-grouped rows with per-phase aggregate cards, NEW pill + SVG progress ring on the name column, avatar owner, colour-block Status / Priority / Risk cells, Department chip, multi-skills chips, inline filter row.', 'Industry Templates', ProjectTracker),
  demo('91-cell-comments',            'Cell comments + @-mentions',     'Right-click any cell to start a thread. Type @ inside the editor to mention a teammate (fuzzy picker, chip insertion). Comment indicator triangle, resolve-thread action, mention count.', 'Rows & Cells', CellComments),

  // ----- Pro: Pivot cluster
  demo('52-pivot-table',              'Pivot + Designer',               'Drag-and-drop Pivot Designer with Filters / Rows / Columns / Values zones, multi-level column headers, subtotal + grand-total rows, row-header sort menu.', 'Pivot Grid', PivotTable,             { pro: true }),
  demo('60-pivot-expandable',         'Pivot - Sales pipeline',         'Polished pivot view: KPI strip, region/sales-person rows, quarter columns, two measures, expand-all/collapse-all toolbar, heatmap tinting.',           'Pivot Grid', PivotExpandable,        { pro: true }),
  demo('121-pivot-conditional-cells', 'Pivot - Conditional cells',      'Function-valued `cell` and `header` templates on top of createPivotModel: traffic-light revenue pills, target chips, units data-bars, measure icons in headers, region color dots in row labels. Headers can be snippets, not just strings.', 'Pivot Grid', PivotConditionalCells,  { pro: true }),
  demo('122-pivot-drill-through',     'Pivot - Drill-through',          'Click any pivot value cell - leaf, subtotal, or grand total - and the right rail opens with the exact source facts behind the aggregate. Total + count + average always match what the cell shows.', 'Pivot Grid', PivotDrillThrough,      { pro: true }),
  demo('123-pivot-totals',            'Pivot - Totals + Subtotals',     'Live toggles for grandTotalRow / grandTotalCol / rowSubtotals on createPivotModel. Subtotals get a Σ badge, the grand-total row is tinted accent, and the grand-total column is an amber stripe on the right. Counts panel shows what shipped.', 'Pivot Grid', PivotTotals,            { pro: true }),
  demo('124-pivot-olap',              'Pivot - OLAP cube (BI shell)',   'Full BI dashboard around an OLAP cube: page header with crumbs + last-refresh + export, 5 KPI tiles with QoQ sparklines, left slicer rail (region multi-select, year picker, country search, view-mode, density, heatmap toggle), the cube in Tabular form (one column per row dim), right insights rail (top YoY movers, top contributors, notes).', 'Pivot Grid', PivotOlap,              { pro: true }),
  demo('125-pivot-charts',            'Pivot + linked charts',          'Pivot cube wired to a horizontal bar chart + multi-year line chart. Click any cube row to drill the charts one level deeper (region → country → product); scope KPI strip tracks selection; charts are zero-dep inline SVG.', 'Pivot Grid', PivotCharts,            { pro: true }),
  demo('166-pivot-analysis-workspace','Pivot - Analysis workspace',     'Excel-style pivot analysis: left-rail field picker (search + checkboxes) feeding four wells (Rows / Columns / Data / Filters), live re-pivot on every layout change, click-to-cycle aggregator chips, data-bar Total Spend cells + amber Avg Rating strips, subtotal + grand-total row tints.', 'Pivot Grid', PivotAnalysisWorkspace, { pro: true }),
  demo('168-pivot-designer',          'Pivot designer component',       'SvPivotDesigner: self-contained, enterprise-ready pivot authoring with a left-rail field picker (search + grouped), four drop wells (Filters / Columns / Rows / Values), drag-and-drop between wells, per-chip aggregator + filter menus, presets toolbar, and an inline pivot grid driven by createPivotModel. Single bindable `layout` prop so the page can persist or restore it.', 'Pivot Grid', PivotDesigner,          { pro: true }),
  demo('360-pivot-mode-grid',         'Pivot mode grid (AG-style)',     'Built on <SvPivotDesigner panelPosition="right">: a docked tool panel with a PIVOT MODE toggle, field checklist, and Columns / Rows / Values wells (drag-and-drop). OFF renders the flat participant grid (column groups, flags, ratings, inline filter row via `flatColumns`); ON pivots Language -> Country x Game with heat-mapped avg measures via `decorateColumns`. Exercises the new designer props panelPosition / pivotMode / flatColumns / gridFitColumns.', 'Pivot Grid', PivotModeGrid, { pro: true }),

  // ----- Pro: Export cluster (kept together at the very bottom)
  demo('21-export-and-print',         'Export + Print',                 'Pro feature pack: download to Excel, PDF, CSV, TSV, HTML, or open a printable view in a new window.',           'Data Export & Import', ExportAndPrint,         { pro: true }),
  demo('56-export-theme-matched',     'Export - Theme-matched',         'One xlsx, light or dark - styles read from the same --sg-* tokens the grid renders with.',                       'Data Export & Import', ExportThemeMatched,     { pro: true }),
  demo('57-export-header-footer-logo','Export - Header + Footer + Logo','Branded xlsx: PNG logo + title + subtitle in the page header, generated date + page numbers in the footer.',    'Data Export & Import', ExportHeaderFooterLogo, { pro: true }),
  demo('58-export-with-images',       'Export - Cell images',           'Product grid with thumbnail column. On xlsx export each thumbnail is embedded as a real picture cell.',          'Data Export & Import', ExportWithImages,       { pro: true }),
  demo('59-export-multi-sheet',       'Export - Multiple sheets',       'One xlsx with 5 tabs - All orders + per-region splits - independent of the current grid filter.',                'Data Export & Import', ExportMultiSheet,       { pro: true }),
  demo('93-password-protected-export','Password-protected export',      'PBKDF2 (100k iters) + AES-GCM 256 client-side. Strength meter, encrypt + download, in-page decrypt tool to verify the round-trip. Pro pack maps to ECMA-376 Agile encryption.', 'Data Export & Import', PasswordProtectedExport, { pro: true }),
  demo('101-formulas-in-xlsx',        'Formulas preserved in xlsx',     'Builds a real OOXML workbook in the browser via JSZip; computed columns export as <f>...</f> formula cells. Open in Excel and the math recomputes when you edit a number.', 'Data Export & Import', FormulasInXlsx,         { pro: true }),
  demo('119-workbook-multi-sheet',    'Workbook - multi-sheet + formulas','A real spreadsheet: A/B/C columns + many rows you can grow on demand, cross-sheet formulas (=SUM, =VLOOKUP, nested IF) recalculating live, cell + conditional formatting, validation dropdowns, an inline chart, a calendar/scheduler sheet, open .xlsx/.csv, and export every sheet to one multi-tab .xlsx.', 'Data Export & Import', WorkbookMultiSheet,     { pro: true }),
  demo('126-export-grouped-grid',     'Export grouped grid to Excel',   'A flat sales grid (Region → Country) exported via api.exportData({ format: "xlsx", groupBy }) which uses Smart\'s NATIVE Excel row outline grouping. Opens in Excel with +/- buttons in the row header gutter for every group level. Live preview lists every cluster.', 'Data Export & Import', ExportGroupedGrid,      { pro: true }),
  demo('127-export-pivot-grid',       'Export pivot grid to Excel',     'createPivotModel leaves projected into an xlsx via api.exportData with groupBy: ["region"] - each region becomes an Excel outline group. Engine column ids ("pv__Q1__m0") translate to readable headers ("Q1 · Revenue"). Single-sheet OR one tab per region (Pro multi-sheet).', 'Data Export & Import', ExportPivotGrid,        { pro: true }),
  demo('201-export-formatting-and-xls','Export - Formatting, scope + XLS','Faithful export: currency / date / percent render as shown (toggle raw values), pick a row scope (view / selected / all), export legacy .xls (Excel 2003 XML, no jszip), use an exportValue hook for a custom column, and the drop-in SvExportMenu.', 'Data Export & Import', ExportFormattingAndXls,  { pro: true }),
  demo('202-export-pdf-grouped-and-print','Export - Grouped PDF + Print','Group the grid and export: the PDF + xlsx carry bold group headers and per-cluster subtotal rows (auto-carried from grouping state). The polished Print view is the zero-dependency "Save as PDF" route with a repeated header and title.', 'Data Export & Import', ExportPdfGroupedAndPrint, { pro: true }),
  demo('203-ai-export-and-anomalies','AI export + anomaly scan','Natural-language export: type "export orders over $300 as a grouped PDF by country" and the AI provider turns it into a filter + group + format plan, applies it, and downloads. Plus a one-click anomaly scan. Runs on the bundled mock model (no API key).', 'Data Export & Import', AiExportAndAnomalies, { pro: true }),
  demo('204-import-dialog','Import - dialog + auto-mapping','The round-trip partner of export: SvImportDialog drops in a drag-drop / paste importer that auto-maps a file\'s headers to your columns, coerces each value with the column\'s own format (currency / date), previews the typed rows with bad cells flagged, then appends the clean ones. Reads .xlsx, CSV, TSV, JSON.', 'Data Export & Import', ImportDialog, { pro: true }),

]

export type DemoGroup = { category: DemoCategory; demos: Demo[] }

/** Demos pre-grouped + ordered for the sidebar render. */
export const demoGroups: DemoGroup[] = CATEGORY_ORDER.map((category) => ({
  category,
  demos: demos.filter((d) => d.category === category),
})).filter((g) => g.demos.length > 0)

/** The gallery's default landing demo: the first demo of the first category in
 *  CATEGORY_ORDER (Getting Started), so the gallery opens on the flagship SvGrid
 *  product rather than whichever demo sits first in the source array (the editor
 *  demos are declared first). */
export const landingDemo: Demo = demoGroups[0]?.demos[0] ?? demos[0]!

export function findDemo(id: string | null): Demo {
  return demos.find((d) => d.id === id) ?? landingDemo
}
