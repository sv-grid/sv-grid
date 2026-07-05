/**
 * Reference catalog for the live playground tool (routes/Playground.svelte).
 *
 * A curated, settable subset of the SvGrid surface - every prop / column
 * option a user can meaningfully flip from a plain config object. Callback,
 * snippet and function-only props (renderDetailRow, processCellForClipboard,
 * cellEditor, ...) are intentionally omitted; those need real code, not config.
 *
 * Source of truth: website/src/lib/api-reference.ts (the full API page).
 */

export type CatalogEntry = {
  name: string
  type: string
  default?: string
  description: string
  /** Text inserted into the editor when the user clicks "insert". */
  insert: string
}

export type CatalogGroup = {
  title: string
  blurb: string
  entries: CatalogEntry[]
}

export const GRID_PROPS: CatalogEntry[] = [
  // --- Interaction ---
  { name: 'sortable', type: 'boolean', default: 'false', description: 'Click headers to sort. Auto-enables the sorting feature.', insert: 'sortable: true' },
  { name: 'filterable', type: 'boolean', default: 'false', description: 'Enable column filtering. Auto-enables the filtering feature.', insert: 'filterable: true' },
  { name: 'groupable', type: 'boolean', default: 'false', description: 'Enable row grouping (drag a header to the group panel).', insert: 'groupable: true' },
  { name: 'editable', type: 'boolean', default: 'false', description: 'Master switch for inline editing across the grid.', insert: 'editable: true' },
  { name: 'enableInlineEditing', type: 'boolean', default: 'false', description: 'Turn on double-click-to-edit cells.', insert: 'enableInlineEditing: true' },
  { name: 'fullRowEditing', type: 'boolean', default: 'false', description: 'Edit every cell in a row at once instead of one cell.', insert: 'fullRowEditing: true' },
  // --- Filtering UI ---
  { name: 'filterMode', type: '"menu" | "row" | "global" | "none"', default: '"menu"', description: 'Where filters live: header menu, a filter row, one global box, or off.', insert: 'filterMode: "row"' },
  { name: 'showGlobalFilter', type: 'boolean', default: 'false', description: 'Show the single search-all box above the grid.', insert: 'showGlobalFilter: true' },
  { name: 'showFilterRow', type: 'boolean', default: 'false', description: 'Show a per-column filter input row under the header.', insert: 'showFilterRow: true' },
  // --- Selection ---
  { name: 'selectionMode', type: '"row" | "cell" | "both" | "none"', default: '"none"', description: 'What the user can select: rows, cell ranges, both, or nothing.', insert: 'selectionMode: "both"' },
  { name: 'showRowSelection', type: 'boolean', default: 'false', description: 'Add a checkbox column for row selection.', insert: 'showRowSelection: true' },
  { name: 'showRowNumbers', type: 'boolean', default: 'false', description: 'Add a leading row-number column.', insert: 'showRowNumbers: true' },
  // --- Pagination ---
  { name: 'pageable', type: 'boolean', default: 'false', description: 'Enable pagination with a pager footer.', insert: 'pageable: true' },
  { name: 'showPagination', type: 'boolean', default: 'false', description: 'Show the pagination controls.', insert: 'showPagination: true' },
  { name: 'pageSize', type: 'number', default: '10', description: 'Rows per page when pagination is on.', insert: 'pageSize: 25' },
  // --- Layout & look ---
  { name: 'zebraRows', type: 'boolean', default: 'false', description: 'Alternate row background striping.', insert: 'zebraRows: true' },
  { name: 'fitColumns', type: 'boolean', default: 'false', description: 'Stretch columns to fill the grid width.', insert: 'fitColumns: true' },
  { name: 'rowHeight', type: 'number', default: '36', description: 'Body row height in pixels.', insert: 'rowHeight: 40' },
  { name: 'headerHeight', type: 'number', description: 'Header row height in pixels.', insert: 'headerHeight: 44' },
  { name: 'columnWidth', type: 'number', default: '140', description: 'Default column width when a column omits `width`.', insert: 'columnWidth: 160' },
  { name: 'containerHeight', type: 'number | string', default: '520', description: 'Grid height. A number is px; a string like "100%" fills the parent.', insert: 'containerHeight: 420' },
  { name: 'emptyMessage', type: 'string', default: '"No rows"', description: 'Text shown when there are no rows.', insert: 'emptyMessage: "Nothing here yet"' },
  // --- Panels & bars ---
  { name: 'toolPanel', type: 'boolean', default: 'false', description: 'Enable the columns/filters tool panel.', insert: 'toolPanel: true' },
  { name: 'toolPanelDefaultOpen', type: 'boolean', default: 'false', description: 'Open the tool panel on first render.', insert: 'toolPanelDefaultOpen: true' },
  { name: 'statusBar', type: 'boolean | { aggregates?: [...] }', default: 'false', description: 'Show the bottom status bar with selection aggregates.', insert: 'statusBar: true' },
  { name: 'showGroupingControls', type: 'boolean', default: 'false', description: 'Show the drag-to-group panel above the grid.', insert: 'showGroupingControls: true' },
  { name: 'enableColumnReorder', type: 'boolean', default: 'false', description: 'Let users drag column headers to reorder.', insert: 'enableColumnReorder: true' },
  { name: 'columnMenuTabs', type: 'boolean', default: 'false', description: 'Use the tabbed column menu (General / Filter / Columns).', insert: 'columnMenuTabs: true' },
  { name: 'inferColumnTypes', type: 'boolean', default: 'false', description: 'Auto-detect number/date/boolean cell types from the data.', insert: 'inferColumnTypes: true' },
  { name: 'conditionalFormats', type: 'Array<ConditionalFormat>', description: 'Excel-style declarative cell formatting: colorScale / dataBar / iconSet / rule, scoped by column.', insert: "conditionalFormats: [\n    { type: 'colorScale', columns: ['value'], min: '#ef4444', mid: '#f59e0b', max: '#22c55e' },\n  ]" },
  // --- Data-loading UX ---
  { name: 'loading', type: 'boolean', default: 'false', description: 'Show the loading state (skeleton rows).', insert: 'loading: true' },
  { name: 'loadingOverlay', type: 'boolean', default: 'false', description: 'Dim the grid with a spinner overlay while loading.', insert: 'loadingOverlay: true' },
]

export const COLUMN_OPTIONS: CatalogEntry[] = [
  { name: 'field', type: 'keyof TData', description: 'The data key this column reads.', insert: "field: 'name'" },
  { name: 'header', type: 'string', description: 'Column header label.', insert: "header: 'Name'" },
  { name: 'width', type: 'number', description: 'Fixed column width in pixels.', insert: 'width: 160' },
  { name: 'align', type: "'left' | 'center' | 'right'", description: 'Horizontal cell alignment.', insert: "align: 'right'" },
  { name: 'sortable', type: 'boolean', default: 'true', description: 'Allow sorting on this column (needs grid `sortable`).', insert: 'sortable: false' },
  { name: 'filterable', type: 'boolean', default: 'true', description: 'Allow filtering on this column.', insert: 'filterable: false' },
  { name: 'editable', type: 'boolean | (ctx) => boolean', default: 'true', description: 'Whether this column is editable.', insert: 'editable: true' },
  { name: 'visible', type: 'boolean', default: 'true', description: 'Hide/show the column.', insert: 'visible: false' },
  { name: 'editorType', type: "'text' | 'number' | 'date' | 'checkbox' | 'list' | 'select' | 'rating' | 'color' | ...", description: 'Which inline editor to use for this column.', insert: "editorType: 'number'" },
  { name: 'editorOptions', type: 'Array<string | { value; label?; color? }>', description: 'Choices for list/select/chips editors.', insert: "editorOptions: ['Low', 'Medium', 'High']" },
  { name: 'aggregate', type: "'sum' | 'avg' | 'min' | 'max' | 'count' | ...", description: 'Roll-up shown on group rows / status bar.', insert: "aggregate: 'sum'" },
  { name: 'format', type: 'CellFormatConfig', description: 'Declarative number/currency/percent/date formatting.', insert: "format: { type: 'currency', currency: 'USD' }" },
  { name: 'formatter', type: '(ctx) => string', description: 'Custom per-cell string formatter (function).', insert: "formatter: (ctx) => '$' + ctx.value" },
  { name: 'cellClass', type: 'string | (ctx) => string', description: 'CSS class(es) applied to cells - great for conditional colour.', insert: "cellClass: (ctx) => ctx.value < 0 ? 'text-red-600' : ''" },
  { name: 'cellDataType', type: "'text' | 'number' | 'boolean' | 'date'", description: 'Force the cell data type (parsing, alignment, filter operators).', insert: "cellDataType: 'number'" },
  { name: 'cellFlash', type: 'boolean | { className? }', description: 'Flash the cell when its value changes.', insert: 'cellFlash: true' },
  { name: 'tooltip', type: 'string | (ctx) => string', description: 'Hover tooltip for the cell.', insert: "tooltip: (ctx) => `id ${ctx.row.id}`" },
  { name: 'footer', type: 'string | (ctx) => unknown', description: 'Footer cell content for this column.', insert: "footer: 'Total'" },
  { name: 'columns', type: 'ColumnDef[]', description: 'Child columns - creates a grouped header.', insert: "columns: [\n  { field: 'a', header: 'A' },\n  { field: 'b', header: 'B' },\n]" },
]

export const CATALOG: CatalogGroup[] = [
  { title: 'Grid props', blurb: 'Top-level options passed to <SvGrid>.', entries: GRID_PROPS },
  { title: 'Column options', blurb: 'Fields on each ColumnDef in the `columns` array.', entries: COLUMN_OPTIONS },
]
