import type { Component } from 'svelte'

// Import each demo from the existing examples package (aliased to @demos in
// vite.config.ts). The demos *only* import from `sv-grid-community`, so they
// work unchanged here.
import TradingDesk from '@demos/00-trading-desk.svelte'
import QuickStart from '@demos/01-quick-start.svelte'
import SortFilterPaginate from '@demos/02-sort-filter-paginate.svelte'
import ExcelFilters from '@demos/03-excel-filters.svelte'
import SelectionCopyPaste from '@demos/04-selection-copy-paste.svelte'
import InlineEditing from '@demos/05-inline-editing.svelte'
import LargeDataset from '@demos/06-large-dataset.svelte'
import Grouping from '@demos/07-grouping-aggregation.svelte'
import TreeAndMasterDetail from '@demos/08-tree-and-master-detail.svelte'
import ServerSide from '@demos/09-server-side.svelte'
import CustomCells from '@demos/10-custom-cells-and-themes.svelte'
import StockMarket from '@demos/11-stock-market.svelte'
import HrTeam from '@demos/12-hr-team.svelte'
import Finances from '@demos/13-finances.svelte'
import Industrial from '@demos/14-industrial.svelte'
import Localization from '@demos/15-localization.svelte'
import CspCompliant from '@demos/16-csp-compliant.svelte'
import Accessibility from '@demos/17-accessibility.svelte'
import CascadeEditing from '@demos/18-cascade-editing.svelte'
import Ssr from '@demos/19-ssr.svelte'
import IndustrialDashboard from '@demos/20-industrial-dashboard.svelte'
import ExportAndPrint from '@demos/21-export-and-print.svelte'
import AdminTemplate from '@demos/22-admin-template.svelte'
import BulkActions from '@demos/23-bulk-actions.svelte'
import Validation from '@demos/24-validation.svelte'
import ColumnPinning from '@demos/25-column-pinning.svelte'
import ListChipsEditors from '@demos/26-list-chips-editors.svelte'
import SpreadsheetRibbon from '@demos/27-spreadsheet-ribbon.svelte'
import OrgChartTree from '@demos/28-org-chart-tree.svelte'
import WbsTree from '@demos/29-wbs-project-tree.svelte'
import BomTree from '@demos/30-bom-tree.svelte'
import LazyTree from '@demos/31-lazy-tree-load.svelte'
import ManufacturingOps from '@demos/32-manufacturing-ops.svelte'
import ServerInfinite from '@demos/33-server-infinite.svelte'
import RealtimeOrders from '@demos/34-realtime-orders.svelte'
import PermissionsAudit from '@demos/35-permissions-audit.svelte'
import ReportingWorkspace from '@demos/36-reporting-workspace.svelte'
import ThemingStudio from '@demos/37-theming-studio.svelte'
import RtlI18n from '@demos/38-rtl-i18n.svelte'
import PrintBoardExport from '@demos/39-print-board-export.svelte'
import FormsMasterDetail from '@demos/40-forms-master-detail.svelte'
import HealthcareEmr from '@demos/41-healthcare-emr.svelte'
import LogisticsFleet from '@demos/42-logistics-fleet.svelte'
import ComplianceQueue from '@demos/43-compliance-queue.svelte'
import FieldService from '@demos/44-field-service.svelte'
import GanttChart from '@demos/45-gantt-chart.svelte'
import Scheduler from '@demos/46-scheduler.svelte'
import TrashTruckTimeline from '@demos/47-trash-truck-timeline.svelte'
import CrmSalesPipeline from '@demos/48-crm-sales-pipeline.svelte'
import AdminDashboard from '@demos/49-admin-dashboard.svelte'
import SellerPanel from '@demos/50-seller-panel.svelte'
import AiAssistant from '@demos/51-ai-assistant.svelte'
import PivotTable from '@demos/52-pivot-table.svelte'
import ExcelImport from '@demos/53-excel-import.svelte'
import ColumnsHierarchy from '@demos/54-columns-hierarchy.svelte'
import StateMaintenance from '@demos/55-state-maintenance.svelte'
import ExportThemeMatched from '@demos/56-export-theme-matched.svelte'
import ExportHeaderFooterLogo from '@demos/57-export-header-footer-logo.svelte'
import ExportWithImages from '@demos/58-export-with-images.svelte'
import ExportMultiSheet from '@demos/59-export-multi-sheet.svelte'
import PivotExpandable from '@demos/60-pivot-expandable.svelte'
import ConditionalStyling from '@demos/62-conditional-styling.svelte'
import ColumnLayoutApi from '@demos/63-column-layout-api.svelte'
import FilterBetween from '@demos/64-filter-between-operator.svelte'
import KeyboardShortcuts from '@demos/65-keyboard-shortcuts.svelte'
import CustomCellEditors from '@demos/66-custom-cell-editors.svelte'
import ContextMenu from '@demos/67-context-menu.svelte'
import DependentDropdowns from '@demos/68-dependent-dropdowns.svelte'
import HighlightedSearch from '@demos/69-highlighted-search.svelte'
import MultiGridSync from '@demos/70-multi-grid-sync.svelte'
import SubmitValidation from '@demos/71-submit-validation.svelte'
import GraphqlAdapter from '@demos/72-graphql-adapter.svelte'
import ChartJsSync from '@demos/73-chartjs-sync.svelte'
import ThemeIntegrations from '@demos/74-theme-integrations.svelte'
import AiSmartPaste from '@demos/75-ai-smart-paste.svelte'
import KanbanBoard from '@demos/76-kanban-board.svelte'
import SmartChart from '@demos/77-smart-chart.svelte'
import MillionRows from '@demos/78-million-rows.svelte'
import LoadingFromRest from '@demos/79-loading-from-rest.svelte'
import CellTypesShowcase from '@demos/80-cell-types-showcase.svelte'
import MobileCardView from '@demos/81-mobile-card-view.svelte'
import ConditionalFormSchema from '@demos/82-conditional-form-schema.svelte'
import SpreadsheetFormulas from '@demos/83-spreadsheet-formulas.svelte'
import EditorTypes      from '@demos/84-editor-types.svelte'
import TooltipsAndNotes from '@demos/85-tooltips-and-notes.svelte'
import UndoRedo         from '@demos/86-undo-redo.svelte'
import FindInGrid       from '@demos/87-find-in-grid.svelte'
import StagedEditing    from '@demos/88-staged-editing.svelte'
import GroupPanel       from '@demos/89-group-panel.svelte'
import SelectionApi     from '@demos/90-selection-api.svelte'
import CellComments              from '@demos/91-cell-comments.svelte'
import NlFilterBar               from '@demos/92-nl-filter-bar.svelte'
import PasswordProtectedExport   from '@demos/93-password-protected-export.svelte'
import HighContrastTheme         from '@demos/96-high-contrast-theme.svelte'
import AnomalyHighlights         from '@demos/100-anomaly-highlights.svelte'
import FormulasInXlsx            from '@demos/101-formulas-in-xlsx.svelte'
import ConditionalFormatting     from '@demos/94-conditional-formatting.svelte'
import FillHandle                from '@demos/95-fill-handle.svelte'
import SideDrawerEdit            from '@demos/97-side-drawer-edit.svelte'
import AdvancedFilterBuilder     from '@demos/98-advanced-filter-builder.svelte'
import TopNFilter                from '@demos/99-top-n-filter.svelte'
import TreeCheckboxCascade       from '@demos/102-tree-checkbox-cascade.svelte'
import AsyncValidation           from '@demos/103-async-validation.svelte'
import ColumnReorder             from '@demos/104-column-reorder.svelte'
import RowReorder                from '@demos/105-row-reorder.svelte'
import DetailRows                from '@demos/106-detail-rows.svelte'
import PinnedRows                from '@demos/107-pinned-rows.svelte'
import PinnedRowsEngine          from '@demos/108-pinned-rows-engine.svelte'
import ColumnReorderEngine       from '@demos/109-column-reorder-engine.svelte'
import LocaleAwareFilter         from '@demos/110-locale-aware-filter.svelte'
import SetFilterAdvanced         from '@demos/111-set-filter-advanced.svelte'
import BarcodeCells              from '@demos/112-barcode-cells.svelte'
import TestSystemsMonitor       from '@demos/120-test-systems-monitor.svelte'
import CursorPagination          from '@demos/113-cursor-pagination.svelte'
import ServerGrouping            from '@demos/114-server-grouping.svelte'
import OptimisticUpdates         from '@demos/115-optimistic-updates.svelte'
import WebSocketLiveUpdates      from '@demos/116-websocket-live-updates.svelte'
import BulkOperations            from '@demos/117-bulk-operations.svelte'
import LiveDashboard             from '@demos/118-live-dashboard.svelte'
import WorkbookMultiSheet        from '@demos/119-workbook-multi-sheet.svelte'
import RangeSelection            from '@demos/118-range-selection.svelte'
import PivotConditionalCells     from '@demos/121-pivot-conditional-cells.svelte'
import PivotDrillThrough         from '@demos/122-pivot-drill-through.svelte'
import PivotTotals               from '@demos/123-pivot-totals.svelte'

// Bundle the raw .svelte source for every demo so we can show it inline.
// Vite's `?raw` query inlines file text; `eager: true` returns a synchronous map.
const SOURCE_FILES = import.meta.glob('../../../examples/src/demos/*.svelte', {
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
 * straight to "show me grouping" or "show me real-time" without scrolling
 * past 60 unrelated demos. Mirrors examples/src/shared/registry.ts so the
 * standalone gallery and the website nav stay in lockstep.
 *
 * Every Pro demo lives under the single 'Pro' lane and carries an
 * explicit `pro: true` flag the sidebar draws as a small badge dot.
 */
export type DemoCategory =
  | 'Getting Started'
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
  'Themes & Styling',
  'Keyboard & Accessibility',
  'Mobile & Responsive',
  'Integrations',
  'Industry Templates',
  'Pro',
]

export type Demo = {
  id: string
  title: string
  blurb: string
  category: DemoCategory
  /** True when this demo depends on sv-grid-pro. Sidebar renders a small
   *  badge dot so users can scan the Pro features at a glance. */
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
  // ----- Getting Started
  demo('00-trading-desk',           'Trading desk - live',         '10,000 securities ticking on a 500 ms feed. Pinned Symbol + P&L, sparklines, sector chips, KPI strip. The hero.', 'Getting Started', TradingDesk),
  demo('01-quick-start',            'Quick start',                 'A realistic 25-row × 9-column grid with sort, filter, selection, inline editing, and column resize all enabled.', 'Getting Started', QuickStart),
  demo('22-admin-template',         'Admin template',              'Self-contained admin app: sidebar + three pages (Dashboard, Orders w/ Pro export bar, Customers w/ inline edit). Read end-to-end in one file.', 'Getting Started', AdminTemplate),
  demo('06-large-dataset',          '100k rows × 100 columns',     'Row + column virtualization. Chunked load with progress + cancellation.', 'Getting Started', LargeDataset),
  demo('78-million-rows',           '1 million rows',              'A literal 1,000,000-row dataset with sort, filter, group, scroll, and inline edit all on. Chunked generation with progress.', 'Getting Started', MillionRows),
  demo('80-cell-types-showcase',    'Cell types showcase',         'Every editor in one grid: color picker, date picker, 5-star rating, mood feedback, list/chips, number formatting, status badge.', 'Getting Started', CellTypesShowcase),

  // ----- Editing
  demo('05-inline-editing',         'Inline editing',              'Typed editors (text/number/checkbox/date) with dirty tracking + save.', 'Editing', InlineEditing),
  demo('84-editor-types',           'Editor types + custom slot',  'Built-in select / rich-select / textarea editors plus a custom `cellEditor` snippet (a range slider) for cases the built-ins do not cover.', 'Editing', EditorTypes),
  demo('26-list-chips-editors',     'List + chips editors',        'Two built-in editors with single & multi-select: dropdown (list) and removable tokens (chips), with options or free-form.', 'Editing', ListChipsEditors),
  demo('66-custom-cell-editors',    'Custom cell editors',         'Three hand-rolled editors: native colour picker bound to a tag swatch, 5-star rating, emoji feedback mood. All write back through api.setCellValue.', 'Editing', CustomCellEditors),
  demo('68-dependent-dropdowns',    'Dependent dropdowns',         'Cascade editors: Country → State → City. Each level computes its options from the row\'s upstream value; changing Country resets State + City.', 'Editing', DependentDropdowns),
  demo('24-validation',             'Validation while editing',    'Per-column rules: invalid commits get rolled back via setCellValue + logged to a recent-rejections panel.', 'Editing', Validation),
  demo('71-submit-validation',      'Submit-time validation',      'Bulk-leads import: edit freely, click Submit, the row-level validator highlights invalid cells and lists every error in an aria-live panel.', 'Editing', SubmitValidation),
  demo('82-conditional-form-schema','Conditional form schema',     'Declarative when rules drive per-cell visibility and editability. EIN only on nonprofits, SSN only on individuals, rejection reason only when status is rejected.', 'Editing', ConditionalFormSchema),
  demo('18-cascade-editing',        'Cascade editing',             'Spreadsheet invoice: editing qty / price / discount cascades into line totals.', 'Editing', CascadeEditing),
  demo('86-undo-redo',              'Undo / redo (Ctrl+Z)',        '`api.undo()` / `api.redo()` + Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z. 200-step bounded history; clearHistory after a successful save resets the baseline.', 'Editing', UndoRedo),
  demo('95-fill-handle',            'Excel-style fill handle',     'Walks through every fill pattern the engine detects: numeric series, date series, weekday sequence, reverse-fill, horizontal fill, copy-mode.', 'Editing', FillHandle),
  demo('103-async-validation',      'Async / server validation',   'Debounced async validators per column: SKU uniqueness, GTIN-13 checksum, price vs category median. Inline ✓ / ! state + event log.', 'Editing', AsyncValidation),

  // ----- Filtering & Search
  demo('02-sort-filter-paginate',   'Sort, filter, paginate',      'Three most-asked-for features wired together against ~5k rows.', 'Filtering & Search', SortFilterPaginate),
  demo('03-excel-filters',          'Excel-style filters',         'Per-column operator dropdown with active-filter chips and clear.', 'Filtering & Search', ExcelFilters),
  demo('64-filter-between-operator','Filter - between operator',   'Number + date columns expose a "Between" operator with From/To inputs. Drive it via the menu or imperatively with api.setFilter(id, { operator: "between", value, valueTo }).', 'Filtering & Search', FilterBetween),
  demo('69-highlighted-search',     'Highlighted search matches',  'External search input + a custom cell snippet that wraps matched substrings in <mark>. Filters the dataset AND visually flags hits.', 'Filtering & Search', HighlightedSearch),
  demo('87-find-in-grid',           'Find in grid (Ctrl+F)',       'Built-in find overlay with next / previous navigation. Scans every visible cell value; matches activate + scroll into view.', 'Filtering & Search', FindInGrid),
  demo('110-locale-aware-filter',   'Locale-aware text filter',    'Pass filterLocale and the grid normalises text (NFD + diacritic strip + locale-aware lowercase) so "cafe" matches "Café", "tokyo" matches "Tōkyō".', 'Filtering & Search', LocaleAwareFilter),
  demo('111-set-filter-advanced',   'Set filter (tree / async / Excel)','Three set-list filter patterns: the built-in Excel-style column menu, async-loaded values for huge enums, and a tree-list (Region → Country → City) with cascading checkboxes. All driven through api.setFacetFilter.', 'Filtering & Search', SetFilterAdvanced),
  demo('98-advanced-filter-builder','Advanced filter builder',     'Visual AND/OR query builder, Linear / Notion-style: typed rules, per-field operators, presets. "At-risk EMEA accounts" with three rules in one click.', 'Filtering & Search', AdvancedFilterBuilder),
  demo('99-top-n-filter',           'Top N / Bottom N filter',     'BI-style "show me top 10 by revenue" toolbar: pick a metric, pick N, top vs bottom. Live KPI strip shows revenue coverage of the slice.', 'Filtering & Search', TopNFilter),

  // ----- Sorting & Grouping
  demo('07-grouping-aggregation',   'Grouping + aggregation',      'Group by department, sum salaries, average performance, expand/collapse keys.', 'Sorting & Grouping', Grouping),
  demo('89-group-panel',            'Group panel (drag & drop)',   'DevExpress / Kendo-style Group Panel: drag chips into the panel to group, drag inside to reorder grouping levels, × to ungroup. Drives api.setGroupBy() under the hood.', 'Sorting & Grouping', GroupPanel),
  demo('36-reporting-workspace',    'Reporting workspace',         'Pivot-lite: group-by chips, per-column aggregator picker, saved views with localStorage persistence, live KPI strip + summary cards.', 'Sorting & Grouping', ReportingWorkspace),

  // ----- Selection & Clipboard
  demo('04-selection-copy-paste',   'Selection + copy/paste',      'Row + cell-range selection with TSV clipboard round-trip.', 'Selection & Clipboard', SelectionCopyPaste),
  demo('90-selection-api',          'Selection API + events',      'Drive cell selection with api.selectCells / api.getSelected; subscribe to changes via onCellSelectionChange. Live SUM/AVG/MIN/MAX panel + event log + copy-as-TSV.', 'Selection & Clipboard', SelectionApi),
  demo('118-range-selection',       'Range selection (Excel-style)','Drag any rectangle of cells; toolbar issues common ranges; live SUM/AVG/MIN/MAX/COUNT status bar (Google Sheets style); copy as TSV.', 'Selection & Clipboard', RangeSelection),
  demo('23-bulk-actions',           'Bulk actions toolbar',        'Select rows → sticky action bar with Mark / Delete / Copy as TSV. The Gmail / Linear pattern.', 'Selection & Clipboard', BulkActions),
  demo('67-context-menu',           'Right-click context menu',    'Custom row context menu (copy, duplicate, move up/down, delete) wired via a contextmenu listener + the wrapper\'s data-svgrid-row attribute.', 'Selection & Clipboard', ContextMenu),

  // ----- Columns
  demo('25-column-pinning',         'Column pinning + freezing',   'Wide 13-column grid. Pin Company left and Price right via the column menu; the middle scrolls under sticky edges.', 'Columns', ColumnPinning),
  demo('54-columns-hierarchy',      'Columns hierarchy + manager', 'Side-panel tree of grouped columns: drag leaves to reorder, click a chevron to collapse a group into one summary column, toggle visibility per leaf or whole group.', 'Columns', ColumnsHierarchy),
  demo('63-column-layout-api',      'Column layout API',           'setColumnWidth + setColumnPinning + getColumnWidths + getColumnPinning. Save the snapshot to localStorage, restore on reload, drive widths and pins from buttons.', 'Columns', ColumnLayoutApi),
  demo('104-column-reorder',        'Column reorder (drag)',       'Drag any column header left or right to reorder. Vertical drop indicator. Order persists across reloads via localStorage.', 'Columns', ColumnReorder),
  demo('109-column-reorder-engine', 'Column reorder (engine prop)','Set enableColumnReorder on <SvGrid>; api.setColumnOrder / getColumnOrder + onColumnOrderChange event.', 'Columns', ColumnReorderEngine),

  // ----- Rows & Cells
  demo('10-custom-cells-and-themes','Custom cells + themes',       'Avatars, sparklines, progress bars, density toggle, dark mode, full a11y.', 'Rows & Cells', CustomCells),
  demo('62-conditional-styling',    'Conditional styling',         'Support-ticket triage board: rowClass highlights SLA breach + at-risk rows with side-bar accents; cellClass paints priority pills, status badges, agent-load progress bars, and CSAT highlights.', 'Rows & Cells', ConditionalStyling),
  demo('85-tooltips-and-notes',     'Tooltips + per-cell notes',   'Column-level `tooltip` prop (static or value-driven) plus per-cell notes via the `notes` prop on `<SvGrid>` - corner indicator + edit modal.', 'Rows & Cells', TooltipsAndNotes),
  demo('55-state-maintenance',      'State maintenance',           'Capture / restore the grid\'s sort, filters, visibility, widths, page, selection. Undo / redo history, named bookmarks, JSON import/export, debounced localStorage auto-save.', 'Rows & Cells', StateMaintenance),
  demo('94-conditional-formatting', 'Conditional formatting',      'Excel-style color scale, data bars, icon sets, heatmap tint - all via user-land cellRenderers. Per-formatter toggles to compare on/off.', 'Rows & Cells', ConditionalFormatting),
  demo('105-row-reorder',           'Row reorder (drag rows)',     'Priority queue with a ⋮⋮ drag handle column. Multi-select aware - drag a group of rows as a block. Auto-scroll near edges.', 'Rows & Cells', RowReorder),
  demo('107-pinned-rows',           'Pinned rows (top / bottom)',  'Frozen "Account totals" row at the top + sticky "Page totals" at the bottom that reacts to filters. Right-click any row to pin it.', 'Rows & Cells', PinnedRows),
  demo('108-pinned-rows-engine',    'Pinned rows (engine prop)',   'Pass pinnedTopRows / pinnedBottomRows arrays straight to <SvGrid>. Sticky cells, same table, same column schema.', 'Rows & Cells', PinnedRowsEngine),

  // ----- Tree & Hierarchy
  demo('28-org-chart-tree',         'Org chart tree',              '5-level employee hierarchy with role pills, department, headcount roll-up. Expand/collapse, expand-all/collapse-all.', 'Tree & Hierarchy', OrgChartTree),
  demo('29-wbs-project-tree',       'Project WBS tree',            'Phase → task → subtask with % complete that rolls up via effort-weighted average when you edit any leaf.', 'Tree & Hierarchy', WbsTree),
  demo('30-bom-tree',               'Bill of Materials',           'Bicycle BOM, 4 levels deep. Edit any leaf part\'s qty or unit cost; subtotals roll up through the assembly chain to the grand total.', 'Tree & Hierarchy', BomTree),
  demo('31-lazy-tree-load',         'Lazy tree (load on expand)',  'Region → Country → State → City. Children fetched async on first expand with a "Loading…" placeholder row; subtrees cached on second expand.', 'Tree & Hierarchy', LazyTree),
  demo('08-tree-and-master-detail', 'Tree + master/detail',        'Hierarchical file-system rows and an order/line-item master-detail view.', 'Tree & Hierarchy', TreeAndMasterDetail),
  demo('102-tree-checkbox-cascade', 'Tree checkbox cascade',       'Permissions matrix as a tree: workspaces → resources → actions. Checking a parent checks descendants; partial state on parents. Live cost rollup.', 'Tree & Hierarchy', TreeCheckboxCascade),

  // ----- Master-Detail & Forms
  demo('40-forms-master-detail',    'Forms-in-grid (master/detail)','Master grid + tabbed detail form. Dirty tracking, inline validation, atomic Save / Discard, contact subgrid.', 'Master-Detail & Forms', FormsMasterDetail),
  demo('70-multi-grid-sync',        'Multi-grid sync',             'Two grids over one $state array - edits on the left propagate to the right instantly; each grid keeps its own filter + sort.', 'Master-Detail & Forms', MultiGridSync),
  demo('97-side-drawer-edit',       'Side-drawer edit form',       'Linear / Notion pattern: click a row, a polished drawer slides in with the full record, dirty-state badge, live validation, Esc / Ctrl+Enter shortcuts.', 'Master-Detail & Forms', SideDrawerEdit),
  demo('106-detail-rows',           'Detail rows (expandable)',    'Stripe / GitHub-style inline row expansion: click the chevron to reveal a 4-panel detail (line items, shipping, payments, support thread).', 'Master-Detail & Forms', DetailRows),

  // ----- Server-Side Data
  demo('09-server-side',            'Server-side data',            'Sort/filter/page round-tripped to a mock endpoint with debounce + cancel.', 'Server-Side Data', ServerSide),
  demo('33-server-infinite',        'Server-side infinite scroll', '100k-event audit log behind a mock API. Sparse chunked load on scroll; sort + filter + search pushed to the server.', 'Server-Side Data', ServerInfinite),
  demo('72-graphql-adapter',        'GraphQL adapter',             'Server-side sort / filter / page wired to a mock GraphQL resolver. Side panel shows the live query doc so you can compare what the grid sent to the network tab.', 'Server-Side Data', GraphqlAdapter),
  demo('79-loading-from-rest',      'Loading from REST',           'Fetches rows from a public REST API with loading skeleton, retry, error surface, and a Reload button.', 'Server-Side Data', LoadingFromRest),
  demo('113-cursor-pagination',     'Cursor (keyset) pagination',  'Modern alternative to offset paging: prev / next cursor tokens, stable under writes, O(log N) deep pages.', 'Server-Side Data', CursorPagination),
  demo('114-server-grouping',       'Server-side grouping + aggregates','GROUP BY + SUM/AVG pushed to the server; pre-aggregated buckets with on-demand drill-in.', 'Server-Side Data', ServerGrouping),
  demo('115-optimistic-updates',    'Optimistic updates + rollback','UI updates immediately; server validates async; on reject the value rolls back with a toast.', 'Server-Side Data', OptimisticUpdates),
  demo('116-websocket-live-updates','WebSocket live updates',      'Insert / update / delete deltas merged by id, cell-flash on update, pause / resume, throughput slider.', 'Server-Side Data', WebSocketLiveUpdates),
  demo('117-bulk-operations',       'Bulk server operations',      'Multi-row bulk action with configurable concurrency, live progress bar, per-row outcome chip, mid-flight cancel.', 'Server-Side Data', BulkOperations),
  demo('118-live-dashboard',        'Live 10M-row dashboard',      '10,000,000-transaction stream behind a mock API: server-side paging, sort, filter, a 1-second live feed, and inline SVG throughput/distribution charts.', 'Server-Side Data', LiveDashboard),

  // ----- Real-time & Streaming
  demo('11-stock-market',           'Stock market - live',         'WebSocket-style ticking feed. Cells flash on up/down ticks, pause control, throttle.', 'Real-time & Streaming', StockMarket),
  demo('14-industrial',             'Industrial - IoT sensors',    'Live sensor floor: threshold-driven status, sparkline trends, group by line.', 'Real-time & Streaming', Industrial),
  demo('20-industrial-dashboard',   'Industrial dashboard',        'KPI cards plus live line-status and active-alarms grids, on a 2-second tick.', 'Real-time & Streaming', IndustrialDashboard),
  demo('34-realtime-orders',        'Real-time / streaming',       'WebSocket-style live order stream with delta merge, out-of-order safety, pause / backlog, disconnect-reconnect, throughput slider.', 'Real-time & Streaming', RealtimeOrders),
  demo('73-chartjs-sync',           'Real-time + Chart.js sync',   'Mock WebSocket pushes price ticks every 350 ms. A Chart.js bar chart auto-syncs with the grid - filter the Symbol column, the chart trims to match.', 'Real-time & Streaming', ChartJsSync),

  // ----- Spreadsheet
  demo('27-spreadsheet-ribbon',     'Spreadsheet + Ribbon bar',    'Excel-style Ribbon UI driving the grid via SvGridApi: cell formatting (bold, color, number format), insert/delete row, sort, live SUM/AVG/COUNT.', 'Spreadsheet', SpreadsheetRibbon),
  demo('83-spreadsheet-formulas',   'Spreadsheet + formulas',      'Real formula engine inside the grid: cell refs (A1), ranges (A1:A10), SUM / AVG / IF / COUNTIF / ROUND, arithmetic, string concat, cycle detection.', 'Spreadsheet', SpreadsheetFormulas),

  // ----- Themes & Styling
  demo('37-theming-studio',         'Theming studio',              'Live token playground: brand color, density, radius, font, dark/light, zebra. Copy-ready CSS snippet, persists across reloads.', 'Themes & Styling', ThemingStudio),
  demo('74-theme-integrations',     'Theme integrations',          'Five design-system presets (Ant, MUI, Fluent, Base Web, shadcn) toggled by mapping --sg-* tokens. Side panel shows the exact CSS to paste into your app.', 'Themes & Styling', ThemeIntegrations),

  // ----- Keyboard & Accessibility
  demo('17-accessibility',          'Accessibility',               'WAI-ARIA grid, keyboard navigation, aria-live announcements, focus toggle.', 'Keyboard & Accessibility', Accessibility),
  demo('65-keyboard-shortcuts',     'Keyboard shortcuts + a11y',   'Ctrl+K command palette, Ctrl+/ cheat sheet, vim-style gg / G chord nav. Layers on top of the grid\'s WAI-ARIA grid pattern + roving tabindex.', 'Keyboard & Accessibility', KeyboardShortcuts),

  // ----- Mobile & Responsive
  demo('81-mobile-card-view',       'Mobile / responsive cards',   'Under 720px the grid auto-pivots into touch-friendly cards backed by the same $state array. Tap a card to expand into an edit panel; writes flow through api.setCellValue.', 'Mobile & Responsive', MobileCardView),

  // ----- Integrations
  demo('15-localization',           'Localization',                'Same data re-rendered as locale + currency change - headers, dates, numbers, RTL.', 'Integrations', Localization),
  demo('38-rtl-i18n',               'RTL + i18n stress',           'Six locales (en, de, fr-CA, ja, ar, he). Direction flips, full string translation, Intl-driven currency/date/number, mixed-direction safe via <bdi>.', 'Integrations', RtlI18n),
  demo('16-csp-compliant',          'CSP-compliant grid',          'No eval, no inline scripts. Documented CSP header + live runtime self-check.', 'Integrations', CspCompliant),
  demo('19-ssr',                    'Server-side rendering',       'SvelteKit-style SSR with a sandboxed pre-hydration snapshot.', 'Integrations', Ssr),
  demo('77-smart-chart',            'Smart.Chart integration',     'Mounts a <smart-chart> web component (htmlelements.com) and pipes the grid\'s displayed rows into its dataSource. Re-aggregates on every filter / sort.', 'Integrations', SmartChart),

  // ----- Industry Templates
  demo('12-hr-team',                'HR team directory',           'Employee directory with avatars, status badges, group by team / location / status.', 'Industry Templates', HrTeam),
  demo('13-finances',               'Finances - ledger',           'Account ledger with running balance, currency formatting, category chips, paging.', 'Industry Templates', Finances),
  demo('32-manufacturing-ops',      'Manufacturing operations',    'Plant-floor view: KPI cards + active-runs grid with progress bars, status pills, live 5-second tick.', 'Industry Templates', ManufacturingOps),
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

  // ----- Pro (commercial features in sv-grid-pro)
  demo('21-export-and-print',         'Export + Print',                 'Pro feature pack: download to Excel, PDF, CSV, TSV, HTML, or open a printable view in a new window.', 'Pro', ExportAndPrint,         { pro: true }),
  demo('56-export-theme-matched',     'Export - Theme-matched',         'One xlsx, light or dark - styles read from the same --sg-* tokens the grid renders with.', 'Pro', ExportThemeMatched,     { pro: true }),
  demo('57-export-header-footer-logo','Export - Header + Footer + Logo','Branded xlsx: PNG logo + title + subtitle in the page header, generated date + page numbers in the footer.', 'Pro', ExportHeaderFooterLogo, { pro: true }),
  demo('58-export-with-images',       'Export - Cell images',           'Product grid with thumbnail column. On xlsx export each thumbnail is embedded as a real picture cell.', 'Pro', ExportWithImages,       { pro: true }),
  demo('59-export-multi-sheet',       'Export - Multiple sheets',       'One xlsx with 5 tabs - All orders + per-region splits - independent of the current grid filter.', 'Pro', ExportMultiSheet,       { pro: true }),
  demo('119-workbook-multi-sheet',    'Workbook - multi-sheet + formulas','A real spreadsheet: A/B/C columns + many rows you can grow on demand, cross-sheet formulas (=SUM, =VLOOKUP, nested IF) recalculating live, cell + conditional formatting, validation dropdowns, an inline chart, a calendar/scheduler sheet, open .xlsx/.csv, and export every sheet to one multi-tab .xlsx.', 'Pro', WorkbookMultiSheet,    { pro: true }),
  demo('52-pivot-table',              'Pivot table + Designer',         'Drag-and-drop Pivot Designer with Filters / Rows / Columns / Values zones, multi-level column headers, subtotal + grand-total rows.', 'Pro', PivotTable,             { pro: true }),
  demo('60-pivot-expandable',         'Pivot - Sales pipeline',         'Polished pivot view: KPI strip, region/sales-person rows, quarter columns, two measures, expand-all/collapse-all toolbar.', 'Pro', PivotExpandable,        { pro: true }),
  demo('53-excel-import',             'Excel / CSV import',             'File picker + column mapping + per-row validation preview before commit. Reads xlsx / csv / tsv / json with format auto-detect.', 'Pro', ExcelImport,            { pro: true }),
  demo('88-staged-editing',           'Staged / batch editing',         'Edits buffer into a draft; user reviews every change in a side panel, then commits the batch (one server roundtrip) or reverts back to originals.', 'Pro', StagedEditing,          { pro: true }),
  demo('51-ai-assistant',             'AI assistant',                   'NL filter / smart-fill / summarise / classify driven by a BYO model adapter. Runs end-to-end against the bundled mock provider so no API key is required.', 'Pro', AiAssistant,            { pro: true }),
  demo('75-ai-smart-paste',           'AI Smart Paste',                 'Paste CSV / TSV / free-form text - the assistant parses it into typed rows with a preview panel. Swap mockAssistant for your LLM endpoint and ship.', 'Pro', AiSmartPaste,           { pro: true }),
  demo('92-nl-filter-bar',            'NL filter bar (AI)',             'Type "EMEA active over 50k" - the AI Platform parses your phrase into api.setFilter / setSort / topN calls. Demo ships a rule-based fallback so you can evaluate without a key; production wiring needs an AI Platform key.', 'Pro', NlFilterBar,            { pro: true }),

  // ----- New enterprise features
  demo('96-high-contrast-theme',      'High-contrast theme',            'WCAG 2.2 AAA-grade preset for accessibility procurement. Token block opts a subtree into the high-contrast skin while the rest of the page stays standard. Light + dark.', 'Themes & Styling', HighContrastTheme),
  demo('100-anomaly-highlights',      'Anomaly highlights',             'IQR + rare-value detectors paint outliers per cell with severity halos (warning / outlier / extreme). Severity threshold toggle, per-detector tooltip explaining what tripped.', 'Rows & Cells', AnomalyHighlights),
  demo('112-barcode-cells',           'Barcode label cells (EAN-13)',   'Every row renders a real, scannable EAN-13 barcode as crisp SVG - no canvas, no eval, no dependency. Retail / warehouse / inventory pattern. Row virtualization keeps only visible barcodes in the DOM; click a row for a shelf-label preview.', 'Rows & Cells', BarcodeCells),
  demo('120-test-systems-monitor',    'Test systems monitor (live ops)','Operations console for a fleet of connected test & measurement systems: live status, utilization sparklines, temperature, alarms, firmware, and calibration with stable row identity (getRowId). Select systems for bulk actions (acknowledge alarms, schedule calibration), group by site, KPI strip, search + filters, and master-detail with live instrument tags. Virtualized to fleet scale.', 'Industry Templates', TestSystemsMonitor),
  demo('91-cell-comments',            'Cell comments + @-mentions',     'Right-click any cell to start a thread. Type @ inside the editor to mention a teammate (fuzzy picker, chip insertion). Comment indicator triangle, resolve-thread action, mention count.', 'Rows & Cells', CellComments),
  demo('93-password-protected-export','Password-protected export',      'PBKDF2 (100k iters) + AES-GCM 256 client-side. Strength meter, encrypt + download, in-page decrypt tool to verify the round-trip. Pro pack maps to ECMA-376 Agile encryption.', 'Pro', PasswordProtectedExport, { pro: true }),
  demo('101-formulas-in-xlsx',        'Formulas preserved in xlsx',     'Builds a real OOXML workbook in the browser via JSZip; computed columns export as <f>...</f> formula cells. Open in Excel and the math recomputes when you edit a number.', 'Pro', FormulasInXlsx,         { pro: true }),
  demo('121-pivot-conditional-cells', 'Pivot - Conditional cells',      'Function-valued cell and header templates on top of createPivotModel: traffic-light revenue pills, target chips, units data-bars, measure icons in headers, region color dots in row labels.', 'Pro', PivotConditionalCells,  { pro: true }),
  demo('122-pivot-drill-through',     'Pivot - Drill-through',          'Click any pivot value cell - leaf, subtotal, or grand total - and the right rail opens with the source facts behind the aggregate. Total + count + average always match the cell.', 'Pro', PivotDrillThrough,      { pro: true }),
  demo('123-pivot-totals',            'Pivot - Totals + Subtotals',     'Live toggles for grandTotalRow / grandTotalCol / rowSubtotals on createPivotModel. Subtotals get a Σ badge, the grand-total row is tinted accent, the grand-total column is an amber stripe.', 'Pro', PivotTotals,            { pro: true }),
]

export type DemoGroup = { category: DemoCategory; demos: Demo[] }

/** Demos pre-grouped + ordered for the sidebar render. */
export const demoGroups: DemoGroup[] = CATEGORY_ORDER.map((category) => ({
  category,
  demos: demos.filter((d) => d.category === category),
})).filter((g) => g.demos.length > 0)

export function findDemo(id: string | null | undefined): Demo {
  return demos.find((d) => d.id === id) ?? demos[0]!
}
