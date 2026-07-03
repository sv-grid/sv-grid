import type { Component } from 'svelte'
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
import KanbanBoard from '../demos/76-kanban-board.svelte'
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
import DevMigrationFromAg        from '../demos/139-migration-from-ag-grid.svelte'
import ShortcutConfig            from '../demos/135-shortcut-config.svelte'
import SparklineCells            from '../demos/140-sparkline-cells.svelte'
import GroupAggregators          from '../demos/142-group-aggregators.svelte'
import NamedViews                from '../demos/143-named-views.svelte'
import StatusBar                 from '../demos/144-status-bar.svelte'
import TransactionApi             from '../demos/145-transaction-api.svelte'
import ToolPanel                 from '../demos/146-tool-panel.svelte'
import IntegratedCharts          from '../demos/147-integrated-charts.svelte'
import ServerRowModel            from '../demos/148-server-row-model.svelte'
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
 * Every Pro demo lives under the single 'Pro' lane (per UX request),
 * and each demo carries an explicit `pro: true` flag the sidebar
 * draws as a small badge dot.
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
  | 'Themes & Styling'
  | 'Keyboard & Accessibility'
  | 'Mobile & Responsive'
  | 'Integrations'
  | 'Industry Templates'
  | 'Pro'

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
  'Themes & Styling',
  'Keyboard & Accessibility',
  'Mobile & Responsive',
  'Integrations',
  'Industry Templates',
  'Headless',
  'Pro',
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
  demo('141-conditional-formatting','Conditional formatting (engine)',      'Excel-style value-driven cell coloring as a declarative `conditionalFormats` engine prop: color scales, in-cell data bars, icon sets (arrows/traffic/triangles), and predicate rules - scoped per column, no per-cell snippet.', 'Rows & Cells', ConditionalFormattingEngine),
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
  demo('72-graphql-adapter',        'GraphQL adapter',             'Server-side sort / filter / page wired to a mock GraphQL resolver. Side panel shows the live query doc so you can compare what the grid sent to the network tab.', 'Server-Side Data', GraphqlAdapter),
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
  demo('147-integrated-charts',     'Integrated charts (no deps)', 'Chart the grid data with no external charting library. SvGridChart renders a ChartSpec; rowsToChartSpec aggregates the grid current (filtered/sorted) rows into one. Bar, line, area, pie - plus 100% stacked, top-N + Other, an average reference line, and double-click-to-isolate a series. Filter the grid and the chart re-aggregates live.', 'Charts', IntegratedCharts),
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
  demo('76-kanban-board',           'Kanban board',                'Four-lane Kanban (Backlog / In progress / Review / Done). Each lane is a separate SvGrid bound to the same $state array - HTML5 drag-and-drop rewrites status.', 'Industry Templates', KanbanBoard),

  // ----- Pro (commercial features in @svgrid/enterprise)
  demo('53-excel-import',             'Excel / CSV import',             'File picker + column mapping + per-row validation preview before commit. Reads xlsx / csv / tsv / json with format auto-detect.',     'Pro', ExcelImport,            { pro: true }),
  demo('88-staged-editing',           'Staged / batch editing',         'Edits buffer into a draft; user reviews every change in a side panel, then commits the batch (one server roundtrip) or reverts back to originals.', 'Pro', StagedEditing,          { pro: true }),
  demo('51-ai-assistant',             'AI assistant',                   'NL filter / smart-fill / summarise / classify driven by a BYO model adapter. Runs end-to-end against the bundled mock provider so no API key is required.', 'Pro', AiAssistant,            { pro: true }),
  demo('75-ai-smart-paste',           'AI Smart Paste',                 'Paste CSV / TSV / free-form text - the assistant parses it into typed rows with a preview panel. Swap mockAssistant for your LLM endpoint and ship.', 'Pro', AiSmartPaste,           { pro: true }),
  demo('92-nl-filter-bar',            'NL filter bar (AI)',             'Type "EMEA active over 50k" - the AI Platform parses your phrase into api.setFilter / setSort / topN calls. Demo ships a rule-based fallback so you can evaluate without a key; production wiring needs an AI Platform key.', 'Pro', NlFilterBar,            { pro: true }),

  // ----- New enterprise features
  demo('96-high-contrast-theme',      'High-contrast theme',            'WCAG 2.2 AAA-grade preset for accessibility procurement. Token block opts a subtree into the high-contrast skin while the rest of the page stays standard. Light + dark.', 'Themes & Styling', HighContrastTheme),
  demo('100-anomaly-highlights',      'Anomaly highlights',             'IQR + rare-value detectors paint outliers per cell with severity halos (warning / outlier / extreme). Severity threshold toggle, per-detector tooltip explaining what tripped.', 'Rows & Cells', AnomalyHighlights),
  demo('112-barcode-cells',           'Barcode label cells (EAN-13)',   'Every row renders a real, scannable EAN-13 barcode as crisp SVG - no canvas, no eval, no dependency. Retail / warehouse / inventory pattern. Row virtualization keeps only visible barcodes in the DOM; click a row for a shelf-label preview.', 'Rows & Cells', BarcodeCells),
  demo('120-test-systems-monitor',    'Test systems monitor (live ops)','Operations console for a fleet of connected test & measurement systems: live status, utilization sparklines, temperature, alarms, firmware, and calibration with stable row identity (getRowId). Select systems for bulk actions (acknowledge alarms, schedule calibration), group by site, KPI strip, search + filters, and master-detail with live instrument tags. Virtualized to fleet scale.', 'Industry Templates', TestSystemsMonitor),
  demo('167-project-tracker',         'Project tracker (PM workspace)', 'Linear-style project workspace: KPI strip (Projects / In progress / Ready / Blocked / Budget), bulk-action toolbar (Mark ready, Block, Move to launch, Delete) that enables on selection, phase-grouped rows with per-phase aggregate cards, NEW pill + SVG progress ring on the name column, avatar owner, colour-block Status / Priority / Risk cells, Department chip, multi-skills chips, inline filter row.', 'Industry Templates', ProjectTracker),
  demo('91-cell-comments',            'Cell comments + @-mentions',     'Right-click any cell to start a thread. Type @ inside the editor to mention a teammate (fuzzy picker, chip insertion). Comment indicator triangle, resolve-thread action, mention count.', 'Rows & Cells', CellComments),

  // ----- Pro: Pivot cluster
  demo('52-pivot-table',              'Pivot + Designer',               'Drag-and-drop Pivot Designer with Filters / Rows / Columns / Values zones, multi-level column headers, subtotal + grand-total rows, row-header sort menu.', 'Pro', PivotTable,             { pro: true }),
  demo('60-pivot-expandable',         'Pivot - Sales pipeline',         'Polished pivot view: KPI strip, region/sales-person rows, quarter columns, two measures, expand-all/collapse-all toolbar, heatmap tinting.',           'Pro', PivotExpandable,        { pro: true }),
  demo('121-pivot-conditional-cells', 'Pivot - Conditional cells',      'Function-valued `cell` and `header` templates on top of createPivotModel: traffic-light revenue pills, target chips, units data-bars, measure icons in headers, region color dots in row labels. Headers can be snippets, not just strings.', 'Pro', PivotConditionalCells,  { pro: true }),
  demo('122-pivot-drill-through',     'Pivot - Drill-through',          'Click any pivot value cell - leaf, subtotal, or grand total - and the right rail opens with the exact source facts behind the aggregate. Total + count + average always match what the cell shows.', 'Pro', PivotDrillThrough,      { pro: true }),
  demo('123-pivot-totals',            'Pivot - Totals + Subtotals',     'Live toggles for grandTotalRow / grandTotalCol / rowSubtotals on createPivotModel. Subtotals get a Σ badge, the grand-total row is tinted accent, and the grand-total column is an amber stripe on the right. Counts panel shows what shipped.', 'Pro', PivotTotals,            { pro: true }),
  demo('124-pivot-olap',              'Pivot - OLAP cube (BI shell)',   'Full BI dashboard around an OLAP cube: page header with crumbs + last-refresh + export, 5 KPI tiles with QoQ sparklines, left slicer rail (region multi-select, year picker, country search, view-mode, density, heatmap toggle), the cube in Tabular form (one column per row dim), right insights rail (top YoY movers, top contributors, notes).', 'Pro', PivotOlap,              { pro: true }),
  demo('125-pivot-charts',            'Pivot + linked charts',          'Pivot cube wired to a horizontal bar chart + multi-year line chart. Click any cube row to drill the charts one level deeper (region → country → product); scope KPI strip tracks selection; charts are zero-dep inline SVG.', 'Pro', PivotCharts,            { pro: true }),
  demo('166-pivot-analysis-workspace','Pivot - Analysis workspace',     'Excel-style pivot analysis: left-rail field picker (search + checkboxes) feeding four wells (Rows / Columns / Data / Filters), live re-pivot on every layout change, click-to-cycle aggregator chips, data-bar Total Spend cells + amber Avg Rating strips, subtotal + grand-total row tints.', 'Pro', PivotAnalysisWorkspace, { pro: true }),
  demo('168-pivot-designer',          'Pivot designer component',       'SvPivotDesigner: self-contained, enterprise-ready pivot authoring with a left-rail field picker (search + grouped), four drop wells (Filters / Columns / Rows / Values), drag-and-drop between wells, per-chip aggregator + filter menus, presets toolbar, and an inline pivot grid driven by createPivotModel. Single bindable `layout` prop so the page can persist or restore it.', 'Pro', PivotDesigner,          { pro: true }),

  // ----- Pro: Export cluster (kept together at the very bottom)
  demo('21-export-and-print',         'Export + Print',                 'Pro feature pack: download to Excel, PDF, CSV, TSV, HTML, or open a printable view in a new window.',           'Pro', ExportAndPrint,         { pro: true }),
  demo('56-export-theme-matched',     'Export - Theme-matched',         'One xlsx, light or dark - styles read from the same --sg-* tokens the grid renders with.',                       'Pro', ExportThemeMatched,     { pro: true }),
  demo('57-export-header-footer-logo','Export - Header + Footer + Logo','Branded xlsx: PNG logo + title + subtitle in the page header, generated date + page numbers in the footer.',    'Pro', ExportHeaderFooterLogo, { pro: true }),
  demo('58-export-with-images',       'Export - Cell images',           'Product grid with thumbnail column. On xlsx export each thumbnail is embedded as a real picture cell.',          'Pro', ExportWithImages,       { pro: true }),
  demo('59-export-multi-sheet',       'Export - Multiple sheets',       'One xlsx with 5 tabs - All orders + per-region splits - independent of the current grid filter.',                'Pro', ExportMultiSheet,       { pro: true }),
  demo('93-password-protected-export','Password-protected export',      'PBKDF2 (100k iters) + AES-GCM 256 client-side. Strength meter, encrypt + download, in-page decrypt tool to verify the round-trip. Pro pack maps to ECMA-376 Agile encryption.', 'Pro', PasswordProtectedExport, { pro: true }),
  demo('101-formulas-in-xlsx',        'Formulas preserved in xlsx',     'Builds a real OOXML workbook in the browser via JSZip; computed columns export as <f>...</f> formula cells. Open in Excel and the math recomputes when you edit a number.', 'Pro', FormulasInXlsx,         { pro: true }),
  demo('119-workbook-multi-sheet',    'Workbook - multi-sheet + formulas','A real spreadsheet: A/B/C columns + many rows you can grow on demand, cross-sheet formulas (=SUM, =VLOOKUP, nested IF) recalculating live, cell + conditional formatting, validation dropdowns, an inline chart, a calendar/scheduler sheet, open .xlsx/.csv, and export every sheet to one multi-tab .xlsx.', 'Pro', WorkbookMultiSheet,     { pro: true }),
  demo('126-export-grouped-grid',     'Export grouped grid to Excel',   'A flat sales grid (Region → Country) exported via api.exportData({ format: "xlsx", groupBy }) which uses Smart\'s NATIVE Excel row outline grouping. Opens in Excel with +/- buttons in the row header gutter for every group level. Live preview lists every cluster.', 'Pro', ExportGroupedGrid,      { pro: true }),
  demo('127-export-pivot-grid',       'Export pivot grid to Excel',     'createPivotModel leaves projected into an xlsx via api.exportData with groupBy: ["region"] - each region becomes an Excel outline group. Engine column ids ("pv__Q1__m0") translate to readable headers ("Q1 · Revenue"). Single-sheet OR one tab per region (Pro multi-sheet).', 'Pro', ExportPivotGrid,        { pro: true }),

]

export type DemoGroup = { category: DemoCategory; demos: Demo[] }

/** Demos pre-grouped + ordered for the sidebar render. */
export const demoGroups: DemoGroup[] = CATEGORY_ORDER.map((category) => ({
  category,
  demos: demos.filter((d) => d.category === category),
})).filter((g) => g.demos.length > 0)

export function findDemo(id: string | null): Demo {
  return demos.find((d) => d.id === id) ?? demos[0]!
}
