import type { Component } from 'svelte'

// Demos live in the examples package (aliased to @demos in vite.config.ts) and
// only import from `@svgrid/grid` / `@svgrid/enterprise`. They are loaded LAZILY:
// each demo - plus the grid library it pulls in - becomes its own chunk that is
// fetched only when that demo is opened. This keeps the homepage and every
// other route from bundling all 140 examples (and the whole grid) up front.
//
// A non-eager `import.meta.glob` returns a map of `path -> () => import(path)`,
// so the registry holds loaders, never the components themselves.
const COMPONENT_FILES = import.meta.glob('../../../examples/src/demos/*.svelte') as Record<
  string,
  () => Promise<{ default: Component<any> }>
>

// Raw .svelte source for the inline "view source" panel + StackBlitz export.
// Also lazy: the source text only ships when a demo is actually viewed.
const SOURCE_FILES = import.meta.glob('../../../examples/src/demos/*.svelte', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

// Demo ids are exactly the file basenames (e.g. '00-trading-desk'), so the
// glob key is fully determined by the id.
function pathFor(id: string): string {
  return `../../../examples/src/demos/${id}.svelte`
}

/** Lazy loader for a demo's compiled Svelte component (its own chunk). */
function loadFor(id: string): () => Promise<{ default: Component<any> }> {
  const loader = COMPONENT_FILES[pathFor(id)]
  if (!loader) throw new Error(`demos.ts: no demo component file for id "${id}"`)
  return loader
}

/** Lazy loader for a demo's raw source text. */
function loadSourceFor(id: string): () => Promise<string> {
  return SOURCE_FILES[pathFor(id)] ?? (async () => `// source not found for ${id}`)
}

// ---- Community demos ------------------------------------------------------
// Contributed demos live in a dedicated subfolder and flow through the SAME
// pipeline as first-party ones (switcher, gallery, playground, source panel).
// They are submitted as PRs - each file carries a small leading HTML-comment
// header the registry parses for attribution + the GitHub Discussion that backs
// its upvotes. The component loaders stay lazy (own chunk); only the small
// header text is read eagerly so the registry can build synchronously.
const COMMUNITY_LOADERS = import.meta.glob('../../../examples/src/demos/community/*.svelte') as Record<
  string,
  () => Promise<{ default: Component<any> }>
>
const COMMUNITY_SOURCES = import.meta.glob('../../../examples/src/demos/community/*.svelte', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export type CommunityMeta = {
  title?: string
  author?: string
  /** GitHub handle (no leading @), used for the "by @handle" credit + link. */
  github?: string
  /** Feature tags shown as chips (e.g. "editing", "charts"). */
  tags?: string[]
  /** GitHub Discussion number backing this demo's upvotes (👍 reactions). */
  discussion?: number
}

/** Parse the leading `<!-- key: value -->` header a community demo file carries. */
export function parseCommunityMeta(src: string): CommunityMeta {
  const meta: CommunityMeta = {}
  const block = src.match(/<!--([\s\S]*?)-->/)
  if (!block) return meta
  for (const line of block[1]!.split('\n')) {
    const kv = line.match(/^\s*([a-zA-Z]+)\s*:\s*(.+?)\s*$/)
    if (!kv) continue
    const key = kv[1]!.toLowerCase()
    const val = kv[2]!.trim()
    if (key === 'title') meta.title = val
    else if (key === 'author') meta.author = val
    else if (key === 'github') meta.github = val.replace(/^@/, '')
    else if (key === 'tags') meta.tags = val.split(',').map((t) => t.trim()).filter(Boolean)
    else if (key === 'discussion') { const n = parseInt(val, 10); if (Number.isFinite(n)) meta.discussion = n }
  }
  return meta
}

/**
 * Sidebar groups, modelled on DevExpress / Kendo UI / Syncfusion demo
 * sites: every feature gets its own focused lane so the user can drill
 * straight to "show me grouping" or "show me real-time" without scrolling
 * past 60 unrelated demos. Mirrors examples/src/shared/registry.ts so the
 * standalone gallery and the website nav stay in lockstep.
 *
 * Every Enterprise demo lives under the single 'Enterprise' lane and carries an
 * explicit `pro: true` flag the sidebar draws as a small badge dot.
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
  | 'Enterprise'
  | 'Community'

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
  'Enterprise',
  'Community',
]

export type Demo = {
  id: string
  title: string
  blurb: string
  category: DemoCategory
  /** True when this demo depends on @svgrid/enterprise. Sidebar renders a small
   *  badge dot so users can scan the Enterprise features at a glance. */
  pro?: boolean
  /** True for community-contributed demos (submitted via PR). Rendered with a
   *  "Community" badge + author credit + a GitHub upvote link. */
  community?: boolean
  /** Community demo author display name. */
  author?: string
  /** Community demo author GitHub handle (no leading @). */
  authorGithub?: string
  /** GitHub Discussion number backing a community demo's upvotes. */
  discussion?: number
  /** Feature tags for a community demo (chips). */
  tags?: string[]
  /** Lazily import the demo's Svelte component (resolves a per-demo chunk). */
  load: () => Promise<{ default: Component<any> }>
  /** Lazily import the demo's raw source text for the "view source" panel. */
  loadSource: () => Promise<string>
}

function demo(
  id: string,
  title: string,
  blurb: string,
  category: DemoCategory,
  opts?: { pro?: boolean },
): Demo {
  return { id, title, blurb, category, pro: opts?.pro, load: loadFor(id), loadSource: loadSourceFor(id) }
}

const baseDemos: Demo[] = [
  // ----- Getting Started
  demo('00-trading-desk',           'Trading desk - live',         '10,000 securities ticking on a 500 ms feed. Pinned Symbol + P&L, sparklines, sector chips, KPI strip. The hero.', 'Getting Started'),
  demo('01-quick-start',            'Quick start',                 'A realistic 25-row × 9-column grid with sort, filter, selection, inline editing, and column resize all enabled.', 'Getting Started'),
  demo('135-shortcut-config',       'Shortcut config',             'Capabilities are off by default - opt into sort / filter / edit / group / paging with one boolean shortcut each. No `features` array, no fine-grained props. Toggle the switches to build the config live.', 'Getting Started'),
  demo('22-admin-template',         'Admin template',              'Self-contained admin app: sidebar + three pages (Dashboard, Orders w/ Enterprise export bar, Customers w/ inline edit). Read end-to-end in one file.', 'Getting Started'),
  demo('06-large-dataset',          '100k rows × 100 columns',     'Row + column virtualization. Chunked load with progress + cancellation.', 'Getting Started'),
  demo('78-million-rows',           '1 million rows',              'A literal 1,000,000-row dataset with sort, filter, group, scroll, and inline edit all on. Chunked generation with progress.', 'Getting Started'),
  demo('80-cell-types-showcase',    'Cell types showcase',         'Every editor in one grid: color picker, date picker, 5-star rating, mood feedback, list/chips, number formatting, status badge.', 'Getting Started'),

  // ----- Headless
  demo('186-headless-table',        'Headless -> your own table',  'No <SvGrid>: the createSvGrid engine sorts + filters, and this component renders a plain, hand-styled <table>. The engine does the logic; you own the markup.', 'Headless'),
  demo('187-headless-virtual',      'Headless virtualization',     '50,000 rows, headless. createSvelteVirtualizer reports the visible slice; the markup is hand-written in a custom scroll container.', 'Headless'),
  demo('188-headless-styled',       'Styling a headless table',    'You own every pixel. Same engine, three looks - flip preset (minimal / bordered / card), density, and zebra striping. --sg-* tokens keep it in sync with the site theme.', 'Headless'),
  demo('189-headless-shared-state', 'Two grids, one shared state', 'createGridState returns a [get, set] tuple - a reactive store you own. Feed it to two createSvGrid engines and they stay in lockstep.', 'Headless'),
  demo('190-headless-row-models',   'Row models are a pipeline',   'Flip the group-by control and watch the pipeline change shape: core -> grouped -> expanded. Group rows carry the aggregate: sum roll-up; the markup is a plain hand-styled <table>.', 'Headless'),
  demo('191-headless-server-side',  'Headless server-side',        'Paging + sorting + filtering + load on demand. The "server" owns the data and returns one page at a time; each state change fires a single request. The engine wraps only the current page.', 'Headless'),

  // ----- Editing
  demo('05-inline-editing',         'Inline editing',              'Typed editors (text/number/checkbox/date) with dirty tracking + save.', 'Editing'),
  demo('84-editor-types',           'Editor types + custom slot',  'Built-in select / rich-select / textarea editors plus a custom `cellEditor` snippet (a range slider) for cases the built-ins do not cover.', 'Editing'),
  demo('26-list-chips-editors',     'List + chips editors',        'Two built-in editors with single & multi-select: dropdown (list) and removable tokens (chips), with options or free-form.', 'Editing'),
  demo('66-custom-cell-editors',    'Custom cell editors',         'Three hand-rolled editors: native colour picker bound to a tag swatch, 5-star rating, emoji feedback mood. All write back through api.setCellValue.', 'Editing'),
  demo('68-dependent-dropdowns',    'Dependent dropdowns',         'Cascade editors: Country → State → City. Each level computes its options from the row\'s upstream value; changing Country resets State + City.', 'Editing'),
  demo('24-validation',             'Validation while editing',    'Per-column rules: invalid commits get rolled back via setCellValue + logged to a recent-rejections panel.', 'Editing'),
  demo('71-submit-validation',      'Submit-time validation',      'Bulk-leads import: edit freely, click Submit, the row-level validator highlights invalid cells and lists every error in an aria-live panel.', 'Editing'),
  demo('82-conditional-form-schema','Conditional form schema',     'Declarative when rules drive per-cell visibility and editability. EIN only on nonprofits, SSN only on individuals, rejection reason only when status is rejected.', 'Editing'),
  demo('18-cascade-editing',        'Cascade editing',             'Spreadsheet invoice: editing qty / price / discount cascades into line totals.', 'Editing'),
  demo('86-undo-redo',              'Undo / redo (Ctrl+Z)',        '`api.undo()` / `api.redo()` + Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z. 200-step bounded history; clearHistory after a successful save resets the baseline.', 'Editing'),
  demo('95-fill-handle',            'Excel-style fill handle',     'Walks through every fill pattern the engine detects: numeric series, date series, weekday sequence, reverse-fill, horizontal fill, copy-mode.', 'Editing'),
  demo('103-async-validation',      'Async / server validation',   'Debounced async validators per column: SKU uniqueness, GTIN-13 checksum, price vs category median. Inline ✓ / ! state + event log.', 'Editing'),
  demo('175-value-parser',          'valueParser - transform on commit', 'Per-column `valueParser` refines the committed value after built-in coercion: uppercase a SKU, parse "$1,299.90" into a number, clamp a discount 0–100, round a weight. Log shows raw input → stored.', 'Editing'),
  demo('176-programmatic-editing',  'Programmatic editing (start/stop)', 'Drive the editor from outside via api.startEditing(row, columnId) / stopEditing(cancel?). A toolbar edits the active cell, commits or cancels, and a guided-entry flow jumps to the next blank required field and opens it.', 'Editing'),
  demo('177-full-row-editing',      'Full-row editing',            'The `fullRowEditing` prop puts the WHOLE row into edit at once - every editable cell (text, select, number, date, checkbox) shows an inline editor. Enter or click-away commits all cells in one update; Esc cancels the row.', 'Editing'),

  // ----- Filtering & Search
  demo('02-sort-filter-paginate',   'Sort, filter, paginate',      'Three most-asked-for features wired together against ~5k rows.', 'Filtering & Search'),
  demo('03-excel-filters',          'Excel-style filters',         'Per-column operator dropdown with active-filter chips and clear.', 'Filtering & Search'),
  demo('64-filter-between-operator','Filter - between operator',   'Number + date columns expose a "Between" operator with From/To inputs. Drive it via the menu or imperatively with api.setFilter(id, { operator: "between", value, valueTo }).', 'Filtering & Search'),
  demo('69-highlighted-search',     'Highlighted search matches',  'External search input + a custom cell snippet that wraps matched substrings in <mark>. Filters the dataset AND visually flags hits.', 'Filtering & Search'),
  demo('87-find-in-grid',           'Find in grid (Ctrl+F)',       'Built-in find overlay with next / previous navigation. Scans every visible cell value; matches activate + scroll into view.', 'Filtering & Search'),
  demo('110-locale-aware-filter',   'Locale-aware text filter',    'Pass filterLocale and the grid normalises text (NFD + diacritic strip + locale-aware lowercase) so "cafe" matches "Café", "tokyo" matches "Tōkyō".', 'Filtering & Search'),
  demo('111-set-filter-advanced',   'Set filter (tree / async / Excel)','Three set-list filter patterns: the built-in Excel-style column menu, async-loaded values for huge enums, and a tree-list (Region → Country → City) with cascading checkboxes. All driven through api.setFacetFilter.', 'Filtering & Search'),
  demo('178-multi-condition-filter','Multi-condition filter (AND / OR)','Two conditions on ONE column, joined by AND or OR: a salary band (> 80k AND < 150k), age outliers (< 25 OR > 60). Open the funnel and click "+ Add condition", or drive it via api.setFilter({ operator, value, operator2, value2, join }).', 'Filtering & Search'),
  demo('179-floating-filters',      'Floating filters (per-operator)','The inline filter row honours every operator per column: pick the operator from the cell funnel, the value input switches to the column type (number / date / text), and Between shows a second "To" input inline - no full menu needed.', 'Filtering & Search'),
  demo('180-row-dragging',          'Managed row dragging (grid-to-grid)','Reorder rows by dragging their grip, or move a row from one grid into another - both grids share a rowDragGroup, so the row leaves the source and lands in the target. The grid mutates its own data on drop and fires onRowDragEnd on the receiver.', 'Rows & Cells'),
  demo('184-external-drop-zone',    'External drop zones (row drag)','Drag a row out of the grid onto any element - an Archive or Delete bucket - via the rowDropZone action. The row leaves the grid and the zone\'s onDrop handles it. In-grid reorder still works.', 'Rows & Cells'),
  demo('98-advanced-filter-builder','Advanced filter builder',     'Visual AND/OR query builder, Linear / Notion-style: typed rules, per-field operators, presets. "At-risk EMEA accounts" with three rules in one click.', 'Filtering & Search'),
  demo('99-top-n-filter',           'Top N / Bottom N filter',     'BI-style "show me top 10 by revenue" toolbar: pick a metric, pick N, top vs bottom. Live KPI strip shows revenue coverage of the slice.', 'Filtering & Search'),

  // ----- Sorting & Grouping
  demo('07-grouping-aggregation',   'Grouping + aggregation',      'Group by department, sum salaries, average performance, expand/collapse keys.', 'Sorting & Grouping'),
  demo('142-group-aggregators',     'Group aggregators',           'Declarative per-column rollups for group rows via the aggregate column option: sum, avg, min, max, count, countDistinct, extent, first, or a custom (values, rows) reducer. Each rollup is formatted with the column format and shown in the group header.', 'Sorting & Grouping'),
  demo('89-group-panel',            'Group panel (drag & drop)',   'DevExpress / Kendo-style Group Panel: drag chips into the panel to group, drag inside to reorder grouping levels, × to ungroup. Drives api.setGroupBy() under the hood.', 'Sorting & Grouping'),
  demo('36-reporting-workspace',    'Reporting workspace',         'Pivot-lite: group-by chips, per-column aggregator picker, saved views with localStorage persistence, live KPI strip + summary cards.', 'Sorting & Grouping'),

  // ----- Selection & Clipboard
  demo('04-selection-copy-paste',   'Selection + copy/paste',      'Row + cell-range selection with TSV clipboard round-trip.', 'Selection & Clipboard'),
  demo('90-selection-api',          'Selection API + events',      'Drive cell selection with api.selectCells / api.getSelected; subscribe to changes via onCellSelectionChange. Live SUM/AVG/MIN/MAX panel + event log + copy-as-TSV.', 'Selection & Clipboard'),
  demo('144-status-bar',            'Status bar (range aggregates)','Excel-style bar under the grid with live aggregates of the selected cell range: Count, Sum, Avg, Min, Max. Enable with statusBar + enableCellSelection, then drag a rectangle across numeric cells. Choose the aggregate set via statusBar={ aggregates }.', 'Selection & Clipboard'),
  demo('118-range-selection',       'Range selection (Excel-style)','Drag any rectangle of cells, or Ctrl/Cmd+drag to add MORE ranges - all stay highlighted and copy together. Toolbar issues common ranges; live SUM/AVG/MIN/MAX/COUNT status bar; copy as TSV.', 'Selection & Clipboard'),
  demo('23-bulk-actions',           'Bulk actions toolbar',        'Select rows → sticky action bar with Mark / Delete / Copy as TSV. The Gmail / Linear pattern.', 'Selection & Clipboard'),
  demo('67-context-menu',           'Right-click context menu',    'Custom row context menu (copy, duplicate, move up/down, delete) wired via a contextmenu listener + the wrapper\'s data-svgrid-row attribute.', 'Selection & Clipboard'),

  // ----- Columns
  demo('25-column-pinning',         'Column pinning + freezing',   'Wide 13-column grid. Pin Company left and Price right via the column menu; the middle scrolls under sticky edges.', 'Columns'),
  demo('54-columns-hierarchy',      'Columns hierarchy + manager', 'Side-panel tree of grouped columns: drag leaves to reorder, click a chevron to collapse a group into one summary column, toggle visibility per leaf or whole group.', 'Columns'),
  demo('63-column-layout-api',      'Column layout API',           'setColumnWidth + setColumnPinning + getColumnWidths + getColumnPinning. Save the snapshot to localStorage, restore on reload, drive widths and pins from buttons.', 'Columns'),
  demo('146-tool-panel',            'Tool panel (Columns + Filters)','The docked enterprise sidebar, two tabs. Columns: toggle visibility, reorder up/down, group by a column. Filters: an operator + value control per column (numeric operators come free via cellDataType), kept in sync with the column menu. Enable with the toolPanel prop.', 'Columns'),
  demo('109-column-reorder-engine', 'Column reorder',              'Set enableColumnReorder on <SvGrid> and every header becomes draggable, with a drop indicator. api.setColumnOrder / getColumnOrder + onColumnOrderChange event; persist to restore across reloads.', 'Columns'),
  demo('172-autosize-columns',      'Autosize columns',            'api.autosizeColumn(id) and api.autosizeAllColumns() snap columns to the widest visible cell via canvas-based text measurement. The column header menu has an "Autosize" item that calls the same code. Manual drag-resize still works.', 'Columns'),
  demo('182-aligned-grids',         'Aligned grids',               'Two independent grids sharing alignedGridGroup stay in lockstep: scroll one horizontally and the other follows; resize a column in either and the matching column resizes in both. Budget vs actuals comparison.', 'Columns'),
  demo('183-collapsible-column-groups','Collapsible column groups','Each quarter is a column group with a header caret. The Total is always shown; month columns tagged columnGroupShow:"open" appear only when the group is expanded (AG-Grid pattern). openByDefault controls the initial state.', 'Columns'),
  demo('185-column-menu-tabs',      'Tabbed column menu',          'Opt into the AG-Grid-style tabbed header menu with columnMenuTabs: General / Filter / Columns tabs on the ⋮ menu. OFF by default (flat actions + Choose columns submenu). Toggle the switch to compare.', 'Columns'),

  // ----- Rows & Cells
  demo('10-custom-cells-and-themes','Custom cells + themes',       'Avatars, sparklines, progress bars, density toggle, dark mode, full a11y.', 'Rows & Cells'),
  demo('140-sparkline-cells',       'Sparkline cells',             'In-cell mini charts as a first-class column type: set `sparkline` on a number-array column and the grid paints an inline SVG. Line, area, bar (with +/- coloring), and win/loss - no chart library, no custom snippet.', 'Rows & Cells'),
  demo('141-conditional-formatting','Conditional formatting (engine)',      'Excel-style value-driven cell coloring as a declarative `conditionalFormats` engine prop: color scales, in-cell data bars, icon sets (arrows/traffic/triangles), and predicate rules - scoped per column, no per-cell snippet.', 'Rows & Cells'),
  demo('62-conditional-styling',    'Conditional styling',         'Support-ticket triage board: rowClass highlights SLA breach + at-risk rows with side-bar accents; cellClass paints priority pills, status badges, agent-load progress bars, and CSAT highlights.', 'Rows & Cells'),
  demo('85-tooltips-and-notes',     'Tooltips + per-cell notes',   'Column-level `tooltip` prop (static or value-driven) plus per-cell notes via the `notes` prop on `<SvGrid>` - corner indicator + edit modal.', 'Rows & Cells'),
  demo('55-state-maintenance',      'State maintenance',           'Capture / restore the grid\'s sort, filters, visibility, widths, page, selection. Undo / redo history, named bookmarks, JSON import/export, debounced localStorage auto-save.', 'Rows & Cells'),
  demo('143-named-views',           'Named views',                 'Save the grid sort + filter + layout as a named view and restore it in one click. createNamedViews(api, { storage }) wraps getState/setState; localStorageViews persists across reloads, or plug your own server adapter.', 'Rows & Cells'),
  demo('94-conditional-formatting', 'Conditional formatting',      'Excel-style color scale, data bars, icon sets, heatmap tint - all via user-land cellRenderers. Per-formatter toggles to compare on/off.', 'Rows & Cells'),
  demo('105-row-reorder',           'Row reorder (drag rows)',     'Priority queue with a ⋮⋮ drag handle column. Multi-select aware - drag a group of rows as a block. Auto-scroll near edges.', 'Rows & Cells'),
  demo('107-pinned-rows',           'Pinned rows (top / bottom)',  'Frozen "Account totals" row at the top + sticky "Page totals" at the bottom that reacts to filters. Right-click any row to pin it.', 'Rows & Cells'),
  demo('108-pinned-rows-engine',    'Pinned rows (engine prop)',   'Pass pinnedTopRows / pinnedBottomRows arrays straight to <SvGrid>. Sticky cells, same table, same column schema.', 'Rows & Cells'),
  demo('171-persistent-state',      'State maintenance (auto)',    'CRM contacts grid with editable cells. attachAutoSavedView reserves one slot inside createNamedViews + localStorageViews and mirrors the grid view to it: sort / filter / hide / reorder / resize a column, reload the tab, the layout is right where you left it. Same store is reusable for additional named layouts.', 'Rows & Cells'),

  // ----- Tree & Hierarchy
  demo('28-org-chart-tree',         'Org chart tree',              '5-level employee hierarchy with role pills, department, headcount roll-up. Expand/collapse, expand-all/collapse-all.', 'Tree & Hierarchy'),
  demo('29-wbs-project-tree',       'Project WBS tree',            'Phase → task → subtask with % complete that rolls up via effort-weighted average when you edit any leaf.', 'Tree & Hierarchy'),
  demo('30-bom-tree',               'Bill of Materials',           'Bicycle BOM, 4 levels deep. Edit any leaf part\'s qty or unit cost; subtotals roll up through the assembly chain to the grand total.', 'Tree & Hierarchy'),
  demo('31-lazy-tree-load',         'Lazy tree (load on expand)',  'Region → Country → State → City. Children fetched async on first expand with a "Loading…" placeholder row; subtrees cached on second expand.', 'Tree & Hierarchy'),
  demo('08-tree-and-master-detail', 'Tree + master/detail',        'Hierarchical file-system rows and an order/line-item master-detail view.', 'Tree & Hierarchy'),
  demo('102-tree-checkbox-cascade', 'Tree checkbox cascade',       'Permissions matrix as a tree: workspaces → resources → actions. Checking a parent checks descendants; partial state on parents. Live cost rollup.', 'Tree & Hierarchy'),

  // ----- Master-Detail & Forms
  demo('40-forms-master-detail',    'Forms-in-grid (master/detail)','Master grid + tabbed detail form. Dirty tracking, inline validation, atomic Save / Discard, contact subgrid.', 'Master-Detail & Forms'),
  demo('70-multi-grid-sync',        'Multi-grid sync',             'Two grids over one $state array - edits on the left propagate to the right instantly; each grid keeps its own filter + sort.', 'Master-Detail & Forms'),
  demo('97-side-drawer-edit',       'Side-drawer edit form',       'Linear / Notion pattern: click a row, a polished drawer slides in with the full record, dirty-state badge, live validation, Esc / Ctrl+Enter shortcuts.', 'Master-Detail & Forms'),
  demo('106-detail-rows',           'Detail rows (expandable)',    'Stripe / GitHub-style inline row expansion: click the chevron to reveal a 4-panel detail (line items, shipping, payments, support thread).', 'Master-Detail & Forms'),
  demo('181-master-detail-grid',    'Master / detail (nested grid)','The classic AG-Grid master/detail: expand any account row to reveal a full nested SvGrid of its call records. Built on isDetailRow + renderDetailRow - a real full-width detail row hosting another grid.', 'Master-Detail & Forms'),

  // ----- Server-Side Data
  demo('09-server-side',            'Server-side data',            'Sort/filter/page round-tripped to a mock endpoint with debounce + cancel.', 'Server-Side Data'),
  demo('33-server-infinite',        'Server-side infinite scroll', '100k-event audit log behind a mock API. Sparse chunked load on scroll; sort + filter + search pushed to the server.', 'Server-Side Data'),
  demo('148-server-row-model',      'Server-Side Row Model (SSRM)','One datasource contract for server-backed data: implement a single async getRows({ startRow, endRow, sortModel, filterModel }) and createServerDataSource owns the sort/filter/page lifecycle and races stale responses away. Here a 100,000-row in-memory server behind 250ms latency; the grid holds only the current 50-row page.', 'Server-Side Data'),
  demo('72-graphql-adapter',        'GraphQL adapter',             'Server-side sort / filter / page wired to a mock GraphQL resolver. Side panel shows the live query doc so you can compare what the grid sent to the network tab.', 'Server-Side Data'),
  demo('79-loading-from-rest',      'Loading from REST',           'Fetches rows from a public REST API with loading skeleton, retry, error surface, and a Reload button.', 'Server-Side Data'),
  demo('113-cursor-pagination',     'Cursor (keyset) pagination',  'Modern alternative to offset paging: prev / next cursor tokens, stable under writes, O(log N) deep pages.', 'Server-Side Data'),
  demo('114-server-grouping',       'Server-side grouping + aggregates','GROUP BY + SUM/AVG pushed to the server; pre-aggregated buckets with on-demand drill-in.', 'Server-Side Data'),
  demo('115-optimistic-updates',    'Optimistic updates + rollback','UI updates immediately; server validates async; on reject the value rolls back with a toast.', 'Server-Side Data'),
  demo('116-websocket-live-updates','WebSocket live updates',      'Insert / update / delete deltas merged by id, cell-flash on update, pause / resume, throughput slider.', 'Server-Side Data'),
  demo('117-bulk-operations',       'Bulk server operations',      'Multi-row bulk action with configurable concurrency, live progress bar, per-row outcome chip, mid-flight cancel.', 'Server-Side Data'),
  demo('118-live-dashboard',        'Live 10M-row dashboard',      '10,000,000-transaction stream behind a mock API: server-side paging, sort, filter, a 1-second live feed, and inline SVG throughput/distribution charts.', 'Server-Side Data'),

  // ----- Real-time & Streaming
  demo('11-stock-market',           'Stock market - live',         'WebSocket-style ticking feed. Cells flash on up/down ticks, pause control, throttle.', 'Real-time & Streaming'),
  demo('14-industrial',             'Industrial - IoT sensors',    'Live sensor floor: threshold-driven status, sparkline trends, group by line.', 'Real-time & Streaming'),
  demo('20-industrial-dashboard',   'Industrial dashboard',        'KPI cards plus live line-status and active-alarms grids, on a 2-second tick.', 'Real-time & Streaming'),
  demo('34-realtime-orders',        'Real-time / streaming',       'WebSocket-style live order stream with delta merge, out-of-order safety, pause / backlog, disconnect-reconnect, throughput slider.', 'Real-time & Streaming'),
  demo('149-realtime-collaboration','Real-time collaboration',     'Presence (who is here + where their cursor is) and live edits (a change in one client lands in every other) over a pluggable transport. createCollaboration + broadcastChannelTransport sync cursors and edits across tabs with zero backend; swap the transport for a WebSocket to go cross-machine. Also the substrate for multiple AI agents editing one grid.', 'Real-time & Streaming'),
  demo('145-transaction-api',       'Transaction API (batched)',   'api.applyTransaction({ add, update, remove }) applies a batch of row mutations in ONE data update - the high-frequency streaming path. update and remove-by-id match on getRowId; remove also accepts row refs. Live order book ticking via batched transactions.', 'Real-time & Streaming'),
  demo('73-chartjs-sync',           'Real-time + Chart.js sync',   'Mock WebSocket pushes price ticks every 350 ms. A Chart.js bar chart auto-syncs with the grid - filter the Symbol column, the chart trims to match.', 'Real-time & Streaming'),

  // ----- Spreadsheet
  demo('27-spreadsheet-ribbon',     'Spreadsheet + Ribbon bar',    'Excel-style Ribbon UI driving the grid via SvGridApi: cell formatting (bold, color, number format), insert/delete row, sort, live SUM/AVG/COUNT.', 'Spreadsheet'),
  demo('83-spreadsheet-formulas',   'Spreadsheet + formulas',      'Real formula engine inside the grid: cell refs (A1), ranges (A1:A10), SUM / AVG / IF / COUNTIF / ROUND, arithmetic, string concat, cycle detection.', 'Spreadsheet'),
  demo('169-cell-borders',          'Per-cell custom borders (KPI)','Editable KPI scorecard. spreadsheetLayout paints HOT-style per-edge custom borders via an absolute-positioned overlay (no border-collapse conflicts). Edit any quarter or target - the borders re-derive: green double = beat target, blue solid = hit, amber dotted = near miss, red dashed = bad miss; row champion gets a colored full frame.', 'Spreadsheet'),
  demo('170-cell-merging',          'Cell merging (spreadsheet shell)','A real invoice rendered on an Excel-style shell: A / B / C / D / E column letters across the top, row numbers down the left. Brand band, bill-from / bill-to address blocks, meta block, line items, totals, notes, signatures - all assembled from MergeSpec + CellBorderSpec. Editable Qty / Rate / addresses / notes; totals recompute live.', 'Spreadsheet'),
  demo('173-hyperformula',          'HyperFormula integration',    'Full HyperFormula engine wired into the grid as a peer-optional dep. Editable spreadsheet with A1-style cell refs, dozens of formulas across math (SUM / SUMIF), lookup (VLOOKUP / INDEX-MATCH), text (CONCAT / UPPER), date (TODAY / DATEDIF), logical (IF nests), financial (PMT / IRR / NPV), statistical (AVERAGE / MAX / RANK).', 'Spreadsheet'),

  // ----- Charts (zero-dependency SvGridChart, driven by the grid's rows)
  demo('147-integrated-charts',     'Integrated charts (no deps)', 'Chart the grid data with no external charting library. SvGridChart renders a ChartSpec; rowsToChartSpec aggregates the grid current (filtered/sorted) rows into one. Bar, line, area, pie - plus 100% stacked, top-N + Other, an average reference line, and double-click-to-isolate a series. Filter the grid and the chart re-aggregates live.', 'Charts'),
  demo('150-scatter-bubble',        'Scatter / bubble chart',      'A scatter plot maps two numeric measures (x vs y); a bubble chart adds a third via dot radius. type: scatter with series points [{ x, y, r }]. Spend vs revenue, sized by deals, coloured by region, with an average-revenue reference line. Filter the grid and the cloud re-plots.', 'Charts'),
  demo('151-time-series-chart',     'Time-series chart (date axis)','xType: time spaces points by ACTUAL time - irregular date gaps render proportionally - and shows real date ticks. A referenceLines target/SLA line spans the plot; toggle 100% stacked to read each day as a share of its total. Line, stacked area, or stacked bar.', 'Charts'),
  demo('152-chart-wizard',          'Chart wizard (from the grid)','Grid on the left, chart wizard on the right. The wizard builds a chart from the grid rows via rowsToChartSpec: pick the type from a gallery (whose thumbnails are themselves live mini SvGridChart instances), choose group-by + measure + aggregation, and a palette. Column, Bar (horizontal), Line, Area, Pie with stacked / 100% variants. Drag a cell range or tick row checkboxes to chart just the selection; otherwise the whole filtered / sorted set re-aggregates live.', 'Charts'),
  demo('153-chart-zoom-brush',      'Chart zoom + brush mini-map', 'Drag a rectangle over a 180-day series to zoom in; double-click resets. A compact brush below shows the full range with a draggable window - drag the body to pan, edges to resize. Pairs with the crosshair tooltip + PNG/SVG export.', 'Charts'),
  demo('154-chart-heatmap',         'Heatmap chart',               'type: heatmap renders a colored grid (one cell per row/column) from the same categories + series shape. Choose a sequential or diverging color ramp; cell text auto-contrasts black/white. Filter the grid Channel column and the heatmap re-renders.', 'Charts'),
  demo('155-chart-analytics',       'Analytics: trend, log, drill','Four story-telling chart features at once: overlay (SMA/EMA/linear regression), annotations pinned at named events, yScale: log for wide-range data, and onDrill that filters the grid to the rowIds of the clicked category. Click any day to drill.', 'Charts'),
  demo('156-chart-patterns',        'Color-blind-safe pattern fills','patternFallback: true layers a texture (stripe / crosshatch / dots / diagonal) on every series so two series with similar hues still read as distinct in grayscale or for readers with color-vision deficiency. Works on bars and area stacks.', 'Charts'),
  demo('157-chart-forecast-band',   'Forecast: smooth + confidence band','smooth: true bends the polyline into a monotone cubic curve that still passes through every point but flows between them. upperValues + lowerValues shade a translucent envelope around the forecast for at-a-glance uncertainty. 12 weeks actuals + 8 weeks forecast.', 'Charts'),
  demo('158-chart-waterfall',       'Waterfall (signed P&L)',      'type: waterfall renders each bar starting where the previous one ended. waterfallTotals marks subtotal/total bars that span from 0. Bars colour-code by sign (green / red); total bars get a neutral slate. Connector lines link bar tops so the cumulative trend reads at a glance.', 'Charts'),
  demo('159-chart-streaming',       'Streaming chart (rolling window)','Hit Start - prices stream in at 4 Hz. The buffer holds the last 60 ticks; older points drop off the left as new ones appear on the right. Re-aggregates via rowsToChartSpec so smoothing, brush, zoom all stay in play.', 'Charts'),
  demo('160-chart-funnel',          'Funnel chart (signup conversion)','type: funnel renders strictly-decreasing values as a stack of trapezoids. Each segment shows conversion vs. the top of the funnel inline; hover for the step drop-off. Click a segment to record a drill selection.', 'Charts'),
  demo('161-chart-radar',           'Radar chart (product comparison)','type: radar plots each category as a spoke; every series draws a polygon connecting its values across the spokes. Shared scale makes two products read against each other directly. Click the legend to isolate one.', 'Charts'),
  demo('162-chart-calendar',        'Calendar heatmap (year of days)','type: calendar renders a GitHub-commit-style 7-row x ~53-column grid. Each cell shaded by its value; days with no value render as outlined blanks so missing data reads as missing. Filter the grid Type column and the heatmap re-aggregates.', 'Charts'),
  demo('163-chart-gauge',           'Gauge dial (KPI dashboard)',  'type: gauge renders a semicircle with track + value arcs, optional red/amber/green range bands, and a target tick. Click any row in the KPI grid to drive the dial; bands auto-flip direction based on whether higher or lower is better.', 'Charts'),
  demo('164-chart-treemap',         'Tree-map (sales by region·category)','The canonical BI tree-map: revenue broken down hierarchically into nested rectangles - bigger value = bigger rectangle. The squarified algorithm keeps every cell close to a square so labels stay readable. Switch the drill order (Region → Category vs. Category → Region) to compare the same data two ways.', 'Charts'),
  demo('165-chart-sankey',          'Sankey diagram (user flow)',  'type: sankey lays nodes out in columns by longest-path depth and renders flow links as bezier ribbons whose width = link value in pixels. User journey from acquisition channel through onboarding to outcome. Hover any ribbon for the source -> target value.', 'Charts'),

  // ----- Themes & Styling
  demo('37-theming-studio',         'Theming studio',              'Live token playground: brand color, density, radius, font, dark/light, zebra. Copy-ready CSS snippet, persists across reloads.', 'Themes & Styling'),
  demo('74-theme-integrations',     'Theme integrations',          'Five design-system presets (Ant, MUI, Fluent, Base Web, shadcn) toggled by mapping --sg-* tokens. Side panel shows the exact CSS to paste into your app.', 'Themes & Styling'),

  // ----- Keyboard & Accessibility
  demo('17-accessibility',          'Accessibility',               'WAI-ARIA grid, keyboard navigation, aria-live announcements, focus toggle.', 'Keyboard & Accessibility'),
  demo('65-keyboard-shortcuts',     'Keyboard shortcuts + a11y',   'Ctrl+K command palette, Ctrl+/ cheat sheet, vim-style gg / G chord nav. Layers on top of the grid\'s WAI-ARIA grid pattern + roving tabindex.', 'Keyboard & Accessibility'),

  // ----- Mobile & Responsive
  demo('81-mobile-card-view',       'Mobile / responsive cards',   'Under 720px the grid auto-pivots into touch-friendly cards backed by the same $state array. Tap a card to expand into an edit panel; writes flow through api.setCellValue.', 'Mobile & Responsive'),

  // ----- Integrations
  demo('15-localization',           'Localization',                'Same data re-rendered as locale + currency change - headers, dates, numbers, RTL.', 'Integrations'),
  demo('38-rtl-i18n',               'RTL + i18n stress',           'Six locales (en, de, fr-CA, ja, ar, he). Direction flips, full string translation, Intl-driven currency/date/number, mixed-direction safe via <bdi>.', 'Integrations'),
  demo('16-csp-compliant',          'CSP-compliant grid',          'No eval, no inline scripts. Documented CSP header + live runtime self-check.', 'Integrations'),
  demo('19-ssr',                    'Server-side rendering',       'SvelteKit-style SSR with a sandboxed pre-hydration snapshot.', 'Integrations'),
  demo('77-smart-chart',            'Smart.Chart integration',     'Mounts a <smart-chart> web component (htmlelements.com) and pipes the grid\'s displayed rows into its dataSource. Re-aggregates on every filter / sort.', 'Integrations'),
  demo('139-migration-from-ag-grid','AG Grid ↔ sv-grid side-by-side','Two real grids over the same dataset: AG Grid Community v35 on the left, sv-grid on the right. Same global filter drives both. Source code panels for either side.', 'Integrations'),

  // ----- Industry Templates
  demo('12-hr-team',                'HR team directory',           'Employee directory with avatars, status badges, group by team / location / status.', 'Industry Templates'),
  demo('13-finances',               'Finances - ledger',           'Account ledger with running balance, currency formatting, category chips, paging.', 'Industry Templates'),
  demo('32-manufacturing-ops',      'Manufacturing operations',    'Plant-floor view: KPI cards + active-runs grid with progress bars, status pills, live 5-second tick.', 'Industry Templates'),
  demo('35-permissions-audit',      'Permissions, audit & history','Role-based cell editing, PII masking, full audit log with one-click revert, per-cell history popover.', 'Industry Templates'),
  demo('39-print-board-export',     'Print + boardroom export',    'Quarterly P&L print pack: cover page, repeat-on-page headers, page-size + orientation, CSV / HTML download, browser-native PDF.', 'Industry Templates'),
  demo('41-healthcare-emr',         'Healthcare EMR - inpatient',  'ICU census with vitals sparkline, risk score, code status, allergy chips, role-based cell editing (viewer / nurse / physician / admin).', 'Industry Templates'),
  demo('42-logistics-fleet',        'Logistics - live fleet ops',  'Live shipment board: route lane, progress vs commit, ETA delta, alert chips. Pause / disconnect / throughput slider via streaming helper.', 'Industry Templates'),
  demo('43-compliance-queue',       'Compliance / regulatory queue','L1 / L2 / L3 approval chain, live SLA timer, role-gated approve / return / reject, immutable case-history audit panel.', 'Industry Templates'),
  demo('44-field-service',          'Field service dispatch',      'Dispatcher board: priority + status + tech editable inline, SLA tone gauge, today-timeline cell, tech capacity panel, live status stream.', 'Industry Templates'),
  demo('45-gantt-chart',            'Gantt chart',                 'Project plan with a wide custom Schedule cell: bars positioned by start/end %, phase coloring, progress fill, today line, overdue glow.', 'Industry Templates'),
  demo('46-scheduler',              'Scheduler',                   'Single-day appointment board: providers as rows, an hour axis, click any appointment to edit it in the side panel. Now-line ticks live.', 'Industry Templates'),
  demo('47-trash-truck-timeline',   'Trash truck timeline',        'Public-works dispatcher: each truck glides along its day-long route with spinning wheels; stops, fill levels and statuses update on a 2s tick.', 'Industry Templates'),
  demo('48-crm-sales-pipeline',     'CRM - sales pipeline',        'Deal board with stage chips, weighted forecast bar, inline stage / probability editing, deal detail aside with activity feed + advance / won / lost.', 'Industry Templates'),
  demo('49-admin-dashboard',        'Admin dashboard',             'CRUD-heavy users board: inline role / status / MFA edit, bulk activate / deactivate / delete, invite dialog, permissions matrix, live audit log.', 'Industry Templates'),
  demo('50-seller-panel',           'Seller panel - e-commerce',   'Marketplace dashboard: catalog with SVG thumbnails, inventory bars vs reorder threshold, live orders pipeline, pricing rules - four tabs over one product list.', 'Industry Templates'),
  demo('76-kanban-board',           'Kanban board',                'Four-lane Kanban (Backlog / In progress / Review / Done). Each lane is a separate SvGrid bound to the same $state array - HTML5 drag-and-drop rewrites status.', 'Industry Templates'),

  // ----- Enterprise (commercial features in @svgrid/enterprise)
  demo('53-excel-import',             'Excel / CSV import',             'File picker + column mapping + per-row validation preview before commit. Reads xlsx / csv / tsv / json with format auto-detect.', 'Enterprise', { pro: true }),
  demo('88-staged-editing',           'Staged / batch editing',         'Edits buffer into a draft; user reviews every change in a side panel, then commits the batch (one server roundtrip) or reverts back to originals.', 'Enterprise', { pro: true }),
  demo('51-ai-assistant',             'AI assistant',                   'NL filter / smart-fill / summarise / classify driven by a BYO model adapter. Runs end-to-end against the bundled mock provider so no API key is required.', 'Enterprise', { pro: true }),
  demo('75-ai-smart-paste',           'AI Smart Paste',                 'Paste CSV / TSV / free-form text - the assistant parses it into typed rows with a preview panel. Swap mockAssistant for your LLM endpoint and ship.', 'Enterprise', { pro: true }),
  demo('92-nl-filter-bar',            'NL filter bar (AI)',             'Type "EMEA active over 50k" - the AI Platform parses your phrase into api.setFilter / setSort / topN calls. Demo ships a rule-based fallback so you can evaluate without a key; production wiring needs an AI Platform key.', 'Enterprise', { pro: true }),

  // ----- New enterprise features
  demo('96-high-contrast-theme',      'High-contrast theme',            'WCAG 2.2 AAA-grade preset for accessibility procurement. Token block opts a subtree into the high-contrast skin while the rest of the page stays standard. Light + dark.', 'Themes & Styling'),
  demo('100-anomaly-highlights',      'Anomaly highlights',             'IQR + rare-value detectors paint outliers per cell with severity halos (warning / outlier / extreme). Severity threshold toggle, per-detector tooltip explaining what tripped.', 'Rows & Cells'),
  demo('112-barcode-cells',           'Barcode label cells (EAN-13)',   'Every row renders a real, scannable EAN-13 barcode as crisp SVG - no canvas, no eval, no dependency. Retail / warehouse / inventory pattern. Row virtualization keeps only visible barcodes in the DOM; click a row for a shelf-label preview.', 'Rows & Cells'),
  demo('120-test-systems-monitor',    'Test systems monitor (live ops)','Operations console for a fleet of connected test & measurement systems: live status, utilization sparklines, temperature, alarms, firmware, and calibration with stable row identity (getRowId). Select systems for bulk actions (acknowledge alarms, schedule calibration), group by site, KPI strip, search + filters, and master-detail with live instrument tags. Virtualized to fleet scale.', 'Industry Templates'),
  demo('91-cell-comments',            'Cell comments + @-mentions',     'Right-click any cell to start a thread. Type @ inside the editor to mention a teammate (fuzzy picker, chip insertion). Comment indicator triangle, resolve-thread action, mention count.', 'Rows & Cells'),

  // ----- Enterprise: Pivot cluster
  demo('52-pivot-table',              'Pivot + Designer',               'Drag-and-drop Pivot Designer with Filters / Rows / Columns / Values zones, multi-level column headers, subtotal + grand-total rows, row-header sort menu.', 'Enterprise', { pro: true }),
  demo('60-pivot-expandable',         'Pivot - Sales pipeline',         'Polished pivot view: KPI strip, region/sales-person rows, quarter columns, two measures, expand-all/collapse-all toolbar, heatmap tinting.', 'Enterprise', { pro: true }),
  demo('121-pivot-conditional-cells', 'Pivot - Conditional cells',      'Function-valued cell and header templates on top of createPivotModel: traffic-light revenue pills, target chips, units data-bars, measure icons in headers, region color dots in row labels.', 'Enterprise', { pro: true }),
  demo('122-pivot-drill-through',     'Pivot - Drill-through',          'Click any pivot value cell - leaf, subtotal, or grand total - and the right rail opens with the source facts behind the aggregate. Total + count + average always match the cell.', 'Enterprise', { pro: true }),
  demo('123-pivot-totals',            'Pivot - Totals + Subtotals',     'Live toggles for grandTotalRow / grandTotalCol / rowSubtotals on createPivotModel. Subtotals get a Σ badge, the grand-total row is tinted accent, the grand-total column is an amber stripe.', 'Enterprise', { pro: true }),
  demo('124-pivot-olap',              'Pivot - OLAP cube (BI shell)',   'Full BI dashboard around an OLAP cube: page header, 5 KPI tiles with QoQ sparklines, left slicer rail (region multi-select, year picker, country search, view-mode, density, heatmap toggle), cube in Tabular form (one column per row dim), right insights rail (top YoY movers, top contributors).', 'Enterprise', { pro: true }),
  demo('125-pivot-charts',            'Pivot + linked charts',          'Pivot cube wired to a horizontal bar chart + multi-year line chart. Click any cube row to drill the charts one level deeper (region → country → product); scope KPI strip tracks selection; charts are zero-dep inline SVG.', 'Enterprise', { pro: true }),
  demo('166-pivot-analysis-workspace','Pivot - Analysis workspace',     'Excel-style pivot analysis: left-rail field picker (search + checkboxes) feeding four wells (Rows / Columns / Data / Filters), live re-pivot on every layout change, click-to-cycle aggregator chips, data-bar Total Spend cells + amber Avg Rating strips, subtotal + grand-total row tints.', 'Enterprise', { pro: true }),
  demo('168-pivot-designer',          'Pivot designer component',       'SvPivotDesigner: self-contained, enterprise-ready pivot authoring with a left-rail field picker (search + grouped), four drop wells (Filters / Columns / Rows / Values), drag-and-drop between wells, per-chip aggregator + filter menus, presets toolbar, and an inline pivot grid driven by createPivotModel. Single bindable `layout` prop so the page can persist or restore it.', 'Enterprise', { pro: true }),
  demo('167-project-tracker',         'Project tracker (PM workspace)', 'Linear-style project workspace: KPI strip (Projects / In progress / Ready / Blocked / Budget), bulk-action toolbar (Mark ready, Block, Move to launch, Delete) that enables on selection, phase-grouped rows with per-phase aggregate cards, NEW pill + SVG progress ring on the name column, avatar owner, colour-block Status / Priority / Risk cells, Department chip, multi-skills chips, inline filter row.', 'Industry Templates'),

  // ----- Enterprise: Export cluster (kept together at the very bottom)
  demo('21-export-and-print',         'Export + Print',                 'Enterprise feature pack: download to Excel, PDF, CSV, TSV, HTML, or open a printable view in a new window.', 'Enterprise', { pro: true }),
  demo('56-export-theme-matched',     'Export - Theme-matched',         'One xlsx, light or dark - styles read from the same --sg-* tokens the grid renders with.', 'Enterprise', { pro: true }),
  demo('57-export-header-footer-logo','Export - Header + Footer + Logo','Branded xlsx: PNG logo + title + subtitle in the page header, generated date + page numbers in the footer.', 'Enterprise', { pro: true }),
  demo('58-export-with-images',       'Export - Cell images',           'Product grid with thumbnail column. On xlsx export each thumbnail is embedded as a real picture cell.', 'Enterprise', { pro: true }),
  demo('59-export-multi-sheet',       'Export - Multiple sheets',       'One xlsx with 5 tabs - All orders + per-region splits - independent of the current grid filter.', 'Enterprise', { pro: true }),
  demo('119-workbook-multi-sheet',    'Workbook - multi-sheet + formulas','A real spreadsheet: A/B/C columns + many rows you can grow on demand, cross-sheet formulas (=SUM, =VLOOKUP, nested IF) recalculating live, cell + conditional formatting, validation dropdowns, an inline chart, a calendar/scheduler sheet, open .xlsx/.csv, and export every sheet to one multi-tab .xlsx.', 'Enterprise', { pro: true }),
  demo('93-password-protected-export','Password-protected export',      'PBKDF2 (100k iters) + AES-GCM 256 client-side. Strength meter, encrypt + download, in-page decrypt tool to verify the round-trip. Enterprise pack maps to ECMA-376 Agile encryption.', 'Enterprise', { pro: true }),
  demo('101-formulas-in-xlsx',        'Formulas preserved in xlsx',     'Builds a real OOXML workbook in the browser via JSZip; computed columns export as <f>...</f> formula cells. Open in Excel and the math recomputes when you edit a number.', 'Enterprise', { pro: true }),
  demo('126-export-grouped-grid',     'Export grouped grid to Excel',   'A flat sales grid (Region → Country) exported via api.exportData({ format: "xlsx", groupBy }) which uses Smart\'s NATIVE Excel row outline grouping. Opens in Excel with +/- buttons in the row header gutter for every group level.', 'Enterprise', { pro: true }),
  demo('127-export-pivot-grid',       'Export pivot grid to Excel',     'createPivotModel leaves projected into an xlsx via api.exportData with groupBy: ["region"] - each region becomes an Excel outline group. Engine column ids ("pv__Q1__m0") translate to readable headers ("Q1 · Revenue").', 'Enterprise', { pro: true }),

]

/** Community-contributed demos, built from the `community/*.svelte` glob. */
export const communityDemos: Demo[] = Object.entries(COMMUNITY_SOURCES)
  .map(([path, raw]): Demo => {
    const slug = path.replace(/^.*\/community\//, '').replace(/\.svelte$/, '')
    const meta = parseCommunityMeta(raw)
    const clean = raw.replace(/^﻿/, '')
    const credit = meta.author ? `By ${meta.author}. ` : ''
    const tagLine = meta.tags?.length ? `Tags: ${meta.tags.join(', ')}.` : 'A community-contributed demo.'
    return {
      id: `community-${slug}`,
      title: meta.title || slug,
      blurb: `${credit}${tagLine}`,
      category: 'Community',
      community: true,
      author: meta.author,
      authorGithub: meta.github,
      discussion: meta.discussion,
      tags: meta.tags,
      load: COMMUNITY_LOADERS[path]!,
      loadSource: async () => clean,
    }
  })
  .sort((a, b) => a.title.localeCompare(b.title))

/**
 * Gallery-facing demos: FIRST-PARTY ONLY. Community demos are deliberately kept
 * out of the main gallery - they are discoverable + runnable only in the
 * playground (its demo switcher), per product decision. Use `allDemos` when you
 * need every demo (id lookups, the playground switcher).
 */
export const demos: Demo[] = baseDemos

/** Every demo, first-party + community. For lookups + the playground switcher. */
export const allDemos: Demo[] = [...baseDemos, ...communityDemos]

export type DemoGroup = { category: DemoCategory; demos: Demo[] }

/** First-party demos pre-grouped + ordered for the gallery sidebar. */
export const demoGroups: DemoGroup[] = CATEGORY_ORDER.map((category) => ({
  category,
  demos: demos.filter((d) => d.category === category),
})).filter((g) => g.demos.length > 0)

export function findDemo(id: string | null | undefined): Demo {
  return allDemos.find((d) => d.id === id) ?? demos[0]!
}
