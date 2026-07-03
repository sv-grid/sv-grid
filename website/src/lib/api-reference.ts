// Hand-curated SvGrid API reference data. Source of truth:
//   packages/grid/src/index.ts          (public exports)
//   packages/grid/src/SvGrid.svelte      (component Props)
//   packages/grid/src/svgrid-wrapper.types.ts  (SvGridApi)
//   packages/grid/src/core.ts            (ColumnDef, CellFormatConfig, ...)
//
// Every public prop, method, event, and option is listed with a concrete
// example so the consumer never has to guess the shape. Sections may also
// carry a `demo` id that the Api page renders as a live, interactive grid.

export type ApiProp = {
  name: string
  type: string
  default?: string
  required?: boolean
  since?: string
  description: string
  /** Inline code example specific to this prop / method / event. */
  example?: string
}

export type ApiSection = {
  id: string
  title: string
  category: string
  blurb: string
  /** Markdown-style intro paragraphs (rendered as <p>). */
  intro?: string[]
  /** Optional full TypeScript signature shown in a code block. */
  signature?: string
  props?: ApiProp[]
  /** Long-form example following the section. */
  example?: { title: string; code: string; description?: string }
  /** Bulleted notes / gotchas / version remarks. */
  notes?: string[]
  /**
   * Id of an interactive demo registered in ./api-demos. When set, the Api
   * page renders a live, runnable grid for this section with a view-source
   * toggle.
   */
  demo?: string
}

// ---------- <SvGrid /> --------------------------------------------------

const svgridComponent: ApiSection = {
  id: 'svgrid-component',
  category: 'Components',
  title: '<SvGrid />',
  blurb: 'The render component. Drop it in, pass three props, get a production grid.',
  demo: 'svgrid-component',
  intro: [
    'SvGrid is the batteries-included render component. It wires the headless engine to a complete DOM layer with row + column virtualization, an Excel-style filter menu, cell-range selection, inline editing, grouping, pinning, find-in-grid, undo/redo, and pagination.',
    'For most apps this is the only entry point you need. Reach for the headless core (createSvGrid) only when you need a custom layout that the render component cannot deliver.',
  ],
  signature: `import { SvGrid, tableFeatures, rowSortingFeature } from '@svgrid/grid'

const features = tableFeatures({ rowSortingFeature })

<SvGrid
  data={rows}
  columns={columns}
  features={features}
  rowHeight={36}
  containerHeight={480}
  showColumnFilters
  enableCellSelection
  enableInlineEditing
  onApiReady={(api) => grid = api}
/>`,
  props: [
    {
      name: 'alignedGridGroup',
      type: 'string',
      description:
        'Align this grid with others that share the same non-empty alignedGridGroup string: horizontal scroll and column-resize widths are kept in lockstep across every grid in the group. Use for a totals/header grid above a body grid, or side-by-side comparison grids that must line up. The grids should declare the same columns (matched by id) for widths to map.',
      example: `<SvGrid {data} {columns} {features} alignedGridGroup="report" />`,
    },
    {
      name: 'columnMenuTabs',
      type: 'boolean',
      default: 'false',
      description:
        'Render the header column menu as a tabbed popover - General, Filter, and Columns tabs (the AG-Grid layout). Defaults to false, which keeps the flat menu (actions list + "Choose columns" submenu).',
      example: `<SvGrid {data} {columns} {features} columnMenuTabs />`,
    },
    {
      name: 'columnOrder',
      type: 'ReadonlyArray<string>',
      description:
        'Initial column order, by id (falls back to field). When the user reorders columns, this is the starting state. After mount, the grid owns the order internally and emits onColumnOrderChange on every change - persist that to localStorage to restore.',
      example: `<SvGrid {data} {columns} {features} columnOrder={['name', 'total', 'id']} />`,
    },
    {
      name: 'columnOverscan',
      type: 'number',
      default: '3',
      description: 'Extra columns rendered to the left and right of the viewport.',
      example: `<SvGrid {data} {columns} {features} columnOverscan={6} />`,
    },
    {
      name: 'columns',
      type: 'Array<ColumnDef<TFeatures, TData>>',
      required: true,
      description:
        'The column definitions. See ColumnDef for the full shape. Columns are positional; reorder the array to reorder the visible columns.',
      example: `<script lang="ts">
  import {
    SvGrid, tableFeatures, rowSortingFeature, columnFilteringFeature, type ColumnDef,
  } from '@svgrid/grid'

  type Order = { id: number; customer: string; total: number; status: string; placedAt: string }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  let rows = $state<Order[]>([
    { id: 1, customer: 'Acme Corp', total: 1240, status: 'paid', placedAt: '2026-01-14' },
    { id: 2, customer: 'Globex',    total:  890, status: 'open', placedAt: '2026-02-03' },
  ])

  // Columns are positional - reorder the array to reorder the grid.
  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'id',       header: 'Order ID', width: 100 },
    { field: 'customer', header: 'Customer', width: 180, editorType: 'text' },
    { field: 'total',    header: 'Total',    width: 120, align: 'right',
      editorType: 'number', format: { type: 'currency', currency: 'USD' } },
    { field: 'status',   header: 'Status',   width: 110 },
    { field: 'placedAt', header: 'Placed',   width: 120,
      format: { type: 'date', pattern: 'y-m-d' } },
  ]
</script>

<SvGrid data={rows} columns={columns} features={features} sortable filterable />`,
    },
    {
      name: 'columnVirtualization',
      type: 'boolean',
      default: 'true',
      description:
        'Enable column virtualization for ultra-wide tables (50+ visible columns). Disable it when you need column pinning, since sticky positioning cannot co-exist with recycled column DOM nodes.',
      example: `<SvGrid {data} {columns} {features} columnVirtualization={false} />`,
    },
    {
      name: 'columnWidth',
      type: 'number',
      default: '140',
      description: 'Default column width (px) when `width` is not set on a ColumnDef.',
      example: `<SvGrid {data} {columns} {features} columnWidth={120} />`,
    },
    {
      name: 'conditionalFormats',
      type: 'ReadonlyArray<ConditionalFormat<TData>>',
      description:
        'Excel-style conditional formatting. A list of value-driven rules that color cells: colorScale (gradient across the column range), dataBar (in-cell proportional bar), iconSet (arrows / traffic / triangles by threshold), and rule (apply a style when a predicate matches). Scope a format to specific columns with columns: [...], or omit it to apply to every column. Later entries win on conflict.',
      example: `<SvGrid {data} {columns} {features} conditionalFormats={[
  { type: 'colorScale', columns: ['score'] },
  { type: 'dataBar', columns: ['total'] },
]} />`,
    },
    {
      name: 'containerHeight',
      type: 'number | string',
      default: '520',
      description:
        'Grid viewport height. A number is treated as pixels; a string is used as-is, so you can pass "100%" or "auto" to fill a flex parent.',
      example: `<!-- Fixed pixels -->
<SvGrid {data} {columns} {features} containerHeight={480} />

<!-- Inside a flex parent -->
<div class="flex-1 min-h-0">
  <SvGrid {data} {columns} {features} containerHeight="100%" />
</div>`,
    },
    {
      name: 'contextMenu',
      type: 'boolean | ReadonlyArray<ContextMenuItem<TData>>',
      description:
        'Right-click context menu. true shows the default item set (copy, cut, paste, clear, insert row above/below, remove row, remove column). Pass an array to customize: strings are built-in keys, "separator" is a divider, and objects are custom items. Omitted/false disables the menu (the native browser menu shows instead).',
      example: `<SvGrid {data} {columns} {features} contextMenu />`,
    },
    {
      name: 'copyHeadersToClipboard',
      type: 'boolean',
      description:
        'Prepend a header row (the column labels) to copied cell ranges, so pasting into Excel / Sheets includes the headers. Applies per copied range.',
      example: `<SvGrid {data} {columns} {features} enableCellSelection copyHeadersToClipboard />`,
    },
    // ---- Required props ----
    {
      name: 'data',
      type: 'ReadonlyArray<TData>',
      required: true,
      description:
        'The rows to render. Treat as immutable - replace the reference (e.g. data = [...data, newRow]) to trigger a re-render. Mutating an element in place will not invalidate the grid.',
      example: `<script lang="ts">
  import { SvGrid, tableFeatures, rowSortingFeature, type ColumnDef } from '@svgrid/grid'

  type Order = { id: number; customer: string; total: number }

  const features = tableFeatures({ rowSortingFeature })

  // \`data\` is a Svelte $state array. REPLACE the reference to update it -
  // never mutate a row in place, or the grid won't see the change.
  let rows = $state<Order[]>([
    { id: 1, customer: 'Acme Corp', total: 1240 },
    { id: 2, customer: 'Globex',    total:  890 },
  ])
  function addOrder() {
    rows = [...rows, { id: rows.length + 1, customer: 'New Co', total: 500 }]
  }

  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'id',       header: 'ID',       width: 80 },
    { field: 'customer', header: 'Customer', width: 180 },
    { field: 'total',    header: 'Total',    width: 120, align: 'right',
      format: { type: 'currency', currency: 'USD' } },
  ]
</script>

<button onclick={addOrder}>Add order</button>
<SvGrid data={rows} columns={columns} features={features} sortable />`,
    },
    {
      name: 'editable',
      type: 'boolean',
      default: 'false',
      description:
        'Convenience shortcut that switches on inline cell editing (alias of enableInlineEditing). Off by default, so set it true to opt in. The shortcut wins over the fine-grained props only when explicitly set.',
      example: `<SvGrid {data} {columns} {features} editable />`,
    },
    {
      name: 'editableComments',
      type: 'boolean',
      description:
        'Allow editing per-cell notes/comments through the UI: the context menu gains an "Edit comment" item that opens a popover editor. Edits are applied to an internal overlay for immediate feedback and emitted via onNoteChange so you can persist them back into notes.',
      example: `<SvGrid {data} {columns} {features} editableComments onNoteChange={saveNote} />`,
    },
    {
      name: 'emptyMessage',
      type: 'string',
      default: '"No rows"',
      description: 'Body content shown when data is empty.',
      example: `<SvGrid {data} {columns} {features} emptyMessage="No orders match the current filters" />`,
    },
    // ---- Editing / cell selection / summaries ----
    {
      name: 'enableCellSelection',
      type: 'boolean',
      default: 'selectionMode includes "cell"',
      description:
        'Enable cell-range selection. Click-and-drag selects a rectangle; Shift+arrows extend it; Ctrl/Cmd+C copies the range as TSV.',
      example: `<SvGrid {data} {columns} {features} enableCellSelection />`,
    },
    {
      name: 'enableColumnReorder',
      type: 'boolean',
      default: 'false',
      description:
        'Enables drag-to-reorder on the grid column headers. When true, every header gets draggable=true and a drop indicator paints between headers during a drag. On drop the grid mutates its internal column order and fires onColumnOrderChange with the new order.',
      example: `<SvGrid {data} {columns} {features} enableColumnReorder onColumnOrderChange={save} />`,
    },
    {
      name: 'enableInlineEditing',
      type: 'boolean',
      default: 'false',
      description:
        'Enable inline editing. Double-click or F2 enters edit mode; Enter / Tab commits, Esc cancels. The editor used per column comes from ColumnDef.editorType / cellEditor.',
      example: `<SvGrid bind:data {columns} {features} enableInlineEditing
  onCellValueChange={({ rowIndex, columnId, newValue }) => audit(rowIndex, columnId, newValue)}
/>`,
    },
    {
      name: 'enableRowSummaries',
      type: 'boolean',
      default: 'false',
      description:
        'Render a footer summary row. Each numeric column is summed; non-numeric columns show a "Count: N". Currency / number / percent `format` configs are applied to the summed value.',
      example: `<SvGrid {data} {columns} {features} enableRowSummaries />`,
    },
    {
      name: 'error',
      type: 'string | null',
      default: 'null',
      description: 'Replace the row body with an error message. Takes precedence over loading.',
      example: `<SvGrid {data} {columns} {features} error={err?.message ?? null} />`,
    },
    {
      name: 'externalFilter',
      type: 'boolean',
      default: 'false',
      description:
        'When true, the grid records filter state (menu UI works, indicators light up) but does NOT filter rows itself. Pair with onFiltersChange for server-side queries.',
      example: `<SvGrid {data} {columns} {features}
  externalFilter
  onFiltersChange={({ global, columns }) => fetchOrders({ q: global, columns })}
/>`,
    },
    // ---- External-mode flags (server-side data) ----
    {
      name: 'externalSort',
      type: 'boolean',
      default: 'false',
      description:
        'When true, the grid records sort state and renders indicators / header cycling but does NOT re-order rows itself. Pair with onSortingChange and re-fetch sorted data. Also used for tree data where a flat global sort would break parent-child adjacency.',
      example: `<SvGrid {data} {columns} {features}
  externalSort
  onSortingChange={(sort) => fetchOrders({ sort })}
/>`,
    },
    {
      name: 'features',
      type: 'TFeatures',
      required: true,
      description:
        'The result of tableFeatures({ ... }). Picks which row models and behaviors are active. Pass tableFeatures({}) for a pure read-only grid.',
      example: `<script lang="ts">
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    type ColumnDef,
  } from '@svgrid/grid'

  type Row = { id: number; name: string; team: string }

  // Register only the row models / behaviors you need. tableFeatures({}) is a
  // pure read-only table. The \`sortable\` / \`filterable\` shortcuts on <SvGrid>
  // inject the matching feature if you'd rather not list it here.
  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
  })

  let rows = $state<Row[]>([
    { id: 1, name: 'Ada',   team: 'Platform' },
    { id: 2, name: 'Grace', team: 'Data' },
  ])
  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'name', header: 'Name', width: 160 },
    { field: 'team', header: 'Team', width: 160 },
  ]
</script>

<SvGrid data={rows} columns={columns} features={features} showRowSelection />`,
    },
    {
      name: 'filterable',
      type: 'boolean',
      default: 'false',
      description:
        'Convenience shortcut that switches on column filtering (injects columnFilteringFeature). Off by default, so set it true to opt in. The shortcut wins over the fine-grained props only when explicitly set.',
      example: `<SvGrid {data} {columns} {features} filterable />`,
    },
    {
      name: 'filterLocale',
      type: 'string | ReadonlyArray<string>',
      default: "browser's locale",
      description:
        'BCP-47 locale tag (or array of fallbacks) used for accent- and case-insensitive text filtering / sorting / search. Powered by Intl.Collator with sensitivity: "base", so "cafe", "Cafe" and "CAFE" all match "cafe".',
      example: `<SvGrid {data} {columns} {features} filterLocale="de-DE" />`,
    },
    // ---- Filter UI ----
    {
      name: 'filterMode',
      type: '"menu" | "row" | "global" | "none"',
      default: '"menu"',
      description:
        'High-level picker for which single filter surface appears. "menu" shows the column-header funnel menu; "row" shows an inline filter row under the header; "global" shows a single search box above the grid; "none" hides all filter UI but still tracks state. Overridden per-surface by showGlobalFilter / showColumnFilters / showFilterRow.',
      example: `<SvGrid {data} {columns} {features} filterMode="row" />`,
    },
    {
      name: 'fitColumns',
      type: 'boolean',
      default: 'false',
      description:
        'Scale the visible columns proportionally so their total width fills the viewport (no empty space on the right). Explicit user resizes still win once they happen.',
      example: `<SvGrid {data} {columns} {features} fitColumns />`,
    },
    {
      name: 'fullRowEditing',
      type: 'boolean',
      description:
        'Full-row editing. When true, starting an edit puts the whole row into edit mode - every editable cell shows an inline editor at once - and a single Enter (or focus leaving the row) commits all of them; Esc cancels the whole row. Requires enableInlineEditing. Covers text / number / date / datetime / checkbox / list-select editor types.',
      example: `<SvGrid {data} {columns} {features} enableInlineEditing fullRowEditing />`,
    },
    // ---- Identity / styling ----
    {
      name: 'getRowId',
      type: '(row: TData, index: number) => string',
      description:
        'Resolve a stable id per row. Drives selection, expansion, edit, and active-cell state. When omitted, the array index is used - fine for read-only views but wrong if data is reordered or filtered outside the grid. Use a database PK or UUID.',
      example: `<SvGrid {data} {columns} {features} getRowId={(row) => row.id} />`,
    },
    {
      name: 'groupable',
      type: 'boolean',
      default: 'false',
      description:
        'Convenience shortcut that switches on the row-grouping controls (alias of showGroupingControls, also injects columnGroupingFeature). Off by default, so set it true to opt in. The shortcut wins over the fine-grained props only when explicitly set.',
      example: `<SvGrid {data} {columns} {features} groupable />`,
    },
    {
      name: 'headerHeight',
      type: 'number',
      description:
        'Height (px) of a single column-header level row. With multi-level (grouped) headers the total header height is levels * headerHeight, since each level renders as its own row. When omitted, header rows size to their content. Does not affect the filter row.',
      example: `<SvGrid {data} {columns} {features} headerHeight={44} />`,
    },
    {
      name: 'inferColumnTypes',
      type: 'boolean',
      default: 'false',
      description:
        'Infer each column data type (number / boolean / date / ISO date-string / text) from the first data row, for columns that declare neither an explicit editorType nor a cellDataType. Sets the matching editor, alignment, date format, and filter operators automatically. Explicit column config always wins.',
      example: `<SvGrid {data} {columns} {features} inferColumnTypes />`,
    },
    {
      name: 'initialColumnPinning',
      type: '{ left?: ReadonlyArray<string>; right?: ReadonlyArray<string> }',
      description:
        'Columns pinned to the left/right edge on mount (each entry a column id). Seeded once; user-driven pinning via the column menu still overrides it. Requires columnVirtualization={false} to remain visible.',
      example: `<SvGrid {data} {columns} {features}
  columnVirtualization={false}
  initialColumnPinning={{ left: ['id'], right: ['actions'] }}
/>`,
    },
    {
      name: 'isDetailRow',
      type: '(row: TData, rowIndex: number) => boolean',
      description:
        'Marks a row as an expandable "detail row". When this returns true the grid renders that row as a SINGLE full-width cell (colspan across every column) using renderDetailRow, instead of the normal per-column cells. Insert the detail rows into data yourself and toggle them with your own expanded state. Pair with virtualization={false} so the variable-height detail is not clipped.',
      example: `<SvGrid {data} {columns} {features} virtualization={false}
  isDetailRow={(row) => row.kind === 'detail'}
  {renderDetailRow}
/>`,
    },
    // ---- Display state ----
    {
      name: 'loading',
      type: 'boolean',
      default: 'false',
      description:
        'Replace the row body with a loading state while data is being fetched. The header still renders so the user sees the eventual columns.',
      example: `<SvGrid data={rows} {columns} {features} loading={isFetching} />`,
    },
    {
      name: 'loadingOverlay',
      type: 'boolean',
      default: 'false',
      description:
        'Render loading as a non-blocking overlay instead of replacing the whole grid: the current rows stay visible (dimmed, with a top progress bar) during a refetch, and the first load shows shimmer skeleton rows. Ideal for server-paged grids so paging/sorting does not flash.',
      example: `<SvGrid {data} {columns} {features} loading={isFetching} loadingOverlay />`,
    },
    {
      name: 'loadingSkeletonRows',
      type: 'number',
      default: '8',
      description: 'Skeleton placeholder rows to show on first load.',
      example: `<SvGrid {data} {columns} {features} loadingOverlay loadingSkeletonRows={12} />`,
    },
    {
      name: 'notes',
      type: 'Record<string, Record<string, string>>',
      description:
        'Per-cell notes - longer free-form comments shown as a corner indicator plus a tooltip on hover. Keyed by row id then column id; missing entries mean "no note". The grid renders them; you own storage.',
      example: `<SvGrid {data} {columns} {features}
  notes={{ 'order-7': { status: 'Flagged by finance for manual review' } }}
/>`,
    },
    {
      name: 'overscan',
      type: 'number',
      default: '8',
      description:
        'Extra rows rendered above and below the viewport. Lower for memory-constrained mobile; raise for fast-scroll-then-stop UX.',
      example: `<SvGrid {data} {columns} {features} overscan={20} />`,
    },
    {
      name: 'pageable',
      type: 'boolean',
      default: 'false',
      description:
        'Convenience shortcut that switches on the pagination footer (alias of showPagination). Off by default, so set it true to opt in. The shortcut wins over the fine-grained props only when explicitly set.',
      example: `<SvGrid {data} {columns} {features} pageable />`,
    },
    {
      name: 'pageSize',
      type: 'number',
      default: '10',
      description: 'Initial page size when pagination is enabled.',
      example: `<SvGrid {data} {columns} {features} showPagination pageSize={25} />`,
    },
    {
      name: 'pinnedBottomRows',
      type: 'ReadonlyArray<TData>',
      description:
        'Rows to pin to the BOTTOM of the grid - rendered below the regular rows and sticky-positioned (sticks to the bottom of the viewport while the user scrolls). Typical use: a "page totals" or "grand total" row computed from getDisplayedRows().',
      example: `<SvGrid {data} {columns} {features} pinnedBottomRows={[grandTotalRow]} />`,
    },
    {
      name: 'pinnedTopRows',
      type: 'ReadonlyArray<TData>',
      description:
        'Rows to pin to the TOP of the grid - rendered above the regular rows and sticky-positioned so they stay visible while the user scrolls. Typical use: a "totals" or "headline" row that should always be in view. Rows are read-only and share the column schema with the main grid.',
      example: `<SvGrid {data} {columns} {features} pinnedTopRows={[totalsRow]} />`,
    },
    {
      name: 'processCellForClipboard',
      type: '(params: { value: unknown; column: unknown; row: TData; rowIndex: number; columnId: string }) => unknown',
      description:
        'Transform each cell value on its way to the clipboard - e.g. strip currency symbols, expand codes to labels, or redact. Receives the display value plus the row/column context; return the string (or value) to copy.',
      example: `<SvGrid {data} {columns} {features} processCellForClipboard={({ value }) => String(value).replace(/[$,]/g, '')} />`,
    },
    {
      name: 'renderDetailRow',
      type: 'Snippet<[{ row: TData; rowIndex: number }]>',
      description:
        'Snippet rendered inside the full-width detail cell for rows where isDetailRow is true. Receives the row data and its index.',
      example: `{#snippet renderDetailRow({ row })}
  <div class="detail-panel">{row.description}</div>
{/snippet}
<SvGrid {data} {columns} {features} {isDetailRow} {renderDetailRow} />`,
    },
    {
      name: 'rowClass',
      type: '(ctx: { row: TData; rowIndex: number }) => string | string[] | Record<string, boolean> | null',
      description:
        'Conditional class(es) added to every body <tr>. Return a string, an array, or an object mapping class names to booleans. Useful for "highlight overdue rows" or "tint cancelled orders".',
      example: `<SvGrid {data} {columns} {features}
  rowClass={({ row }) => ({ 'row-overdue': row.status === 'overdue' })}
/>`,
    },
    {
      name: 'rowDragGroup',
      type: 'string',
      description:
        'Connection group for cross-grid row dragging. Grids that share the same non-empty rowDragGroup string (and have rowDragManaged on) can exchange rows: dragging a row out of one and dropping it into another removes it from the source and inserts it into the target. Omit to keep dragging confined to reordering within a single grid.',
      example: `<SvGrid {data} {columns} {features} rowDragManaged rowDragGroup="tasks" />`,
    },
    {
      name: 'rowDragManaged',
      type: 'boolean',
      default: 'false',
      description:
        'Enables managed row dragging. When true, every row becomes a drag source (grab cursor + a grip in the row-number cell) and a drop indicator paints between rows during a drag. On drop the grid mutates its own internal data - reordering within the grid, or moving the row across grids that share the same rowDragGroup.',
      example: `<SvGrid {data} {columns} {features} rowDragManaged onRowDragEnd={save} />`,
    },
    {
      name: 'rowHeight',
      type: 'number',
      default: '36',
      description:
        'Fixed row height in pixels. Virtualization math requires a stable value; for variable heights, a custom layout is needed.',
      example: `<SvGrid {data} {columns} {features} rowHeight={42} />`,
    },
    {
      name: 'rowNumberWidth',
      type: 'number',
      default: '56',
      description:
        'Width (px) of the row-number column. The default fits up to "99,999"; bump it when the dataset crosses six digits so the largest number stays fully visible.',
      example: `<SvGrid {data} {columns} {features} showRowNumbers rowNumberWidth={72} />`,
    },
    {
      name: 'selectionMode',
      type: '"row" | "cell" | "both" | "none"',
      default: '"both"',
      description:
        '"row" shows the selection checkbox column only; "cell" enables rectangle/range cell selection only; "both" enables both; "none" disables both. Overridden per-surface by showRowSelection / enableCellSelection.',
      example: `<SvGrid {data} {columns} {features} selectionMode="cell" />`,
    },
    {
      name: 'showColumnFilters',
      type: 'boolean',
      default: 'filterMode === "menu"',
      description: 'Force the per-column menu filter section on/off, independent of filterMode.',
      example: `<SvGrid {data} {columns} {features} showColumnFilters />`,
    },
    {
      name: 'showFilterMenu',
      type: 'boolean',
      default: 'true',
      description:
        'Show the funnel icon on column headers that opens the Excel-style filter menu (operator picker + value checklist).',
      example: `<SvGrid {data} {columns} {features} showFilterMenu={false} />`,
    },
    {
      name: 'showFilterRow',
      type: 'boolean',
      default: 'filterMode === "row"',
      description: 'Force the compact inline filter row (one input per column under the header) on/off.',
      example: `<SvGrid {data} {columns} {features} showFilterRow />`,
    },
    {
      name: 'showGlobalFilter',
      type: 'boolean',
      default: 'filterMode === "global"',
      description:
        'Force the global search input above the grid on/off, independent of filterMode. Searches across all columns.',
      example: `<SvGrid {data} {columns} {features} showGlobalFilter />`,
    },
    // ---- Grouping / selection / pagination UI ----
    {
      name: 'showGroupingControls',
      type: 'boolean',
      default: 'false',
      description: 'Render the "Group by" UI strip above the grid. Requires columnGroupingFeature.',
      example: `<SvGrid {data} {columns} {features} showGroupingControls />`,
    },
    {
      name: 'showPagination',
      type: 'boolean',
      default: 'false',
      description: 'Render the paginator footer. Requires rowPaginationFeature.',
      example: `<SvGrid {data} {columns} {features} showPagination />`,
    },
    {
      name: 'showRowNumbers',
      type: 'boolean',
      default: 'false',
      description:
        'Render a leading row-number column (1-based) before any selection column. Useful as a permanent anchor when scrolling wide grids.',
      example: `<SvGrid {data} {columns} {features} showRowNumbers />`,
    },
    {
      name: 'showRowSelection',
      type: 'boolean',
      default: 'selectionMode includes "row"',
      description: 'Force the leading checkbox column on/off. Requires rowSelectionFeature.',
      example: `<SvGrid {data} {columns} {features} showRowSelection
  onRowSelectionChange={(_, rows) => selected = rows}
/>`,
    },
    {
      name: 'sortable',
      type: 'boolean',
      default: 'false',
      description:
        'Convenience shortcut that switches on column sorting (injects rowSortingFeature). Every capability is off by default, so set it true to opt in. The shortcut wins over the fine-grained props only when explicitly set.',
      example: `<SvGrid {data} {columns} {features} sortable />`,
    },
    {
      name: 'statusBar',
      type: 'boolean | { aggregates?: ReadonlyArray<"count" | "numericCount" | "sum" | "avg" | "min" | "max"> }',
      description:
        'Excel-style status bar under the grid showing live aggregates of the selected cell range (count, numeric count, sum, average, min, max). true shows the default set; pass { aggregates: [...] } to choose which. Requires enableCellSelection.',
      example: `<SvGrid {data} {columns} {features} enableCellSelection statusBar={{ aggregates: ['sum', 'avg'] }} />`,
    },
    {
      name: 'toolPanel',
      type: 'boolean',
      description:
        'Show the docked tool panel - the enterprise sidebar with Columns and Filters tabs. A "Columns & Filters" button appears in a toolbar above the grid; the panel docks on the right edge.',
      example: `<SvGrid {data} {columns} {features} toolPanel />`,
    },
    {
      name: 'toolPanelDefaultOpen',
      type: 'boolean',
      description: 'Open the tool panel on first render (instead of collapsed).',
      example: `<SvGrid {data} {columns} {features} toolPanel toolPanelDefaultOpen />`,
    },
    {
      name: 'toolPanelDefaultTab',
      type: '"columns" | "filters"',
      default: '"columns"',
      description: 'Which tab the tool panel starts on.',
      example: `<SvGrid {data} {columns} {features} toolPanel toolPanelDefaultTab="filters" />`,
    },
    // ---- Virtualization ----
    {
      name: 'virtualization',
      type: 'boolean',
      default: 'true',
      description:
        'Enable row virtualization. Disable only for small (<500 row) static tables where you need every row in the DOM for testing or printing.',
      example: `<SvGrid {data} {columns} {features} virtualization={false} />`,
    },
    {
      name: 'zebraRows',
      type: 'boolean',
      default: 'false',
      description:
        'Paint alternating data rows with the --sg-row-alt-bg color (zebra striping). Only data rows stripe - pinned, group, detail, and summary rows keep their single background.',
      example: `<SvGrid {data} {columns} {features} zebraRows />`,
    },
  ],
  notes: [
    'TFeatures and TData are inferred from the features and data props - you almost never write them by hand.',
    '`data` is shallow-compared by reference; replace the array on every change to opt into reactivity.',
    'When columnVirtualization is on (the default), column pinning is hidden - the virtualizer recycles column DOM nodes, which is incompatible with sticky positioning. Set columnVirtualization={false} to use pinning.',
    'All the on* callbacks are documented under the Events category.',
  ],
  example: {
    title: 'A complete grid with sort, filter, edit, and selection',
    description:
      'A read-write grid with the most common features turned on. Drop it into any Svelte 5 component.',
    code: `<script lang="ts">
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Employee = { id: number; name: string; team: string; salary: number }

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
  })

  let data = $state<Employee[]>([
    { id: 1, name: 'Ada Lovelace',  team: 'Research',  salary: 142_000 },
    { id: 2, name: 'Grace Hopper',  team: 'Compilers', salary: 158_000 },
  ])

  const columns: ColumnDef<typeof features, Employee>[] = [
    { field: 'name',   header: 'Name',   width: 220, editorType: 'text' },
    { field: 'team',   header: 'Team',   width: 160 },
    { field: 'salary', header: 'Salary', width: 140, editorType: 'number',
      format: { type: 'currency', currency: 'USD' } },
  ]

  let api = $state<SvGridApi<typeof features, Employee> | null>(null)
  let selected = $state<Employee[]>([])
</script>

<SvGrid
  bind:data
  {columns}
  {features}
  rowHeight={36}
  containerHeight={480}
  getRowId={(row) => String(row.id)}
  showColumnFilters
  showRowSelection
  enableCellSelection
  enableInlineEditing
  onApiReady={(a) => (api = a)}
  onRowSelectionChange={(_, rows) => (selected = rows)}
/>`,
  },
}

// ---------- Events -----------------------------------------------------

const eventsSection: ApiSection = {
  id: 'events',
  category: 'Events',
  title: 'Events (callbacks)',
  blurb: 'The on* props SvGrid fires as the user interacts with the grid.',
  demo: 'events',
  intro: [
    'SvGrid has no DOM CustomEvents - events are plain function props (the Svelte 5 convention). Each fires synchronously after the grid has already applied the change to its internal state, so the payload is the new value.',
    'Pair onSortingChange / onFiltersChange with externalSort / externalFilter when you want the server (not the grid) to own ordering and filtering.',
  ],
  props: [
    {
      name: 'onActiveCellChange',
      type: '(cell: { rowIndex: number; colIndex: number; columnId: string }) => void',
      description:
        'Fires whenever the active cell changes - click, keyboard move, tab, page-up/down. Use for toolbars or ribbon UIs that need to stay in sync with the cursor.',
      example: `<SvGrid {data} {columns} {features}
  onActiveCellChange={(cell) => activeCellLabel = cell.columnId}
/>`,
    },
    {
      name: 'onApiReady',
      type: '(api: SvGridApi<TFeatures, TData>) => void',
      description:
        'Fires once when the component mounts and the imperative API is ready. Stash the api object to drive the grid from outside the component tree.',
      example: `let api = $state<SvGridApi<typeof features, Order> | null>(null)

<SvGrid {data} {columns} {features} onApiReady={(a) => (api = a)} />

<button onclick={() => api?.clearAllFilters()}>Reset</button>`,
    },
    {
      name: 'onCellClick / onRowClick',
      type: '(e: { rowIndex; colIndex; columnId; value; row }) => void / (e: { rowIndex; columnId; row }) => void',
      description:
        'Fire when a data cell (and its row) is single-clicked. Group-header rows are excluded; `value` is the displayed cell value. Both fire before any checkbox-toggle / edit-entry side effect.',
      example: `<SvGrid {data} {columns} {features}
  onRowClick={({ row }) => openDetail(row)}
  onCellClick={({ columnId, value }) => console.log(columnId, value)}
/>`,
    },
    {
      name: 'onCellDoubleClick / onRowDoubleClick',
      type: '(e: { rowIndex; colIndex; columnId; value; row }) => void / (e: { rowIndex; columnId; row }) => void',
      description:
        'Fire on double-click, independent of whether the cell is editable - so they fire even on read-only grids. Group rows excluded.',
      example: `<SvGrid {data} {columns} {features}
  onRowDoubleClick={({ row }) => editInModal(row)}
/>`,
    },
    {
      name: 'onCellSelectionChange',
      type: '(ranges: Array<[number, number, number, number]>) => void',
      description:
        'Fires whenever the cell-selection rectangle changes (mouse, keyboard, or api.selectCells). Each range is `[rowStart, colStart, rowEnd, colEnd]` in grid coordinates. Empty array when the user clears the selection.',
      example: `<SvGrid {data} {columns} {features}
  enableCellSelection
  onCellSelectionChange={(ranges) => {
    // ranges = [[0, 1, 4, 3]]  -> rows 0..4, cols 1..3
    activeRange = ranges[0] ?? null
  }}
/>`,
    },
    {
      name: 'onCellValueChange',
      type: '(event: { rowIndex; columnId; oldValue; newValue; row }) => void',
      description:
        'Fires when an inline edit is committed (Enter / Tab / blur). The grid has already written the parsed value back into the row before this fires - use it for audit logs, derived-column recompute, or server sync.',
      example: `<SvGrid bind:data {columns} {features}
  enableInlineEditing
  onCellValueChange={({ rowIndex, columnId, oldValue, newValue, row }) => {
    auditLog.push({ rowIndex, columnId, oldValue, newValue })
    syncToServer(row)
  }}
/>`,
    },
    {
      name: 'onColumnOrderChange',
      type: '(order: ReadonlyArray<string>) => void',
      description:
        'Fires when the user reorders columns by dragging, or after api.setColumnOrder(). Receives the new visual order as column ids - persist it for "save view".',
      example: `<SvGrid {data} {columns} {features}
  onColumnOrderChange={(order) => savedLayout.columnOrder = [...order]}
/>`,
    },
    {
      name: 'onFiltersChange',
      type: '(filters: { global: string; columns: Array<{ id; operator; value; valueTo?; selectedValues? }> }) => void',
      description:
        'Fires when any filter surface changes - global search, per-column operator filters, or facet (Excel-style value checklist). `valueTo` is only set for the `between` operator; `selectedValues` carries facet checkbox state. Pair with externalFilter for server-side filtering.',
      example: `<SvGrid {data} {columns} {features}
  onFiltersChange={(f) => {
    query = f.global
    perColumn = f.columns
    // each column entry carries operator+value (menu filter),
    // valueTo (between), and/or selectedValues (facet checkboxes).
  }}
/>`,
    },
    {
      name: 'onNoteChange',
      type: '(event: { rowId: string; columnId: string; note: string }) => void',
      description:
        'Fires when a per-cell comment is saved or removed (removed = empty `note`). Requires editableComments; use it to persist edits back into the `notes` prop.',
      example: `<SvGrid {data} {columns} {features}
  editableComments
  {notes}
  onNoteChange={({ rowId, columnId, note }) => {
    notes = { ...notes, [rowId]: { ...notes[rowId], [columnId]: note } }
    persistNote(rowId, columnId, note)
  }}
/>`,
    },
    {
      name: 'onRowDragEnd',
      type: '(event: { row: TData; toIndex: number; sameGrid: boolean; fromGridId: number; toGridId: number }) => void',
      description:
        'Fires on the target grid after a managed row drag settles, carrying the moved row, its landing index, whether it stayed in the same grid, and the source / target grid ids. The grid has already applied the change to its internal data before this fires - use it to mirror the move into your own state.',
      example: `<SvGrid bind:data {columns} {features}
  rowDragManaged
  onRowDragEnd={({ row, toIndex, sameGrid, fromGridId, toGridId }) => {
    if (sameGrid) persistOrder()
    else syncMove(row, fromGridId, toGridId, toIndex)
  }}
/>`,
    },
    {
      name: 'onRowSelectionChange',
      type: '(selection: Record<string, boolean>, rows: TData[]) => void',
      description:
        'Fires whenever the checked-row set changes. First arg is the selection record `{ [rowId]: true }`; second is the array of selected row objects.',
      example: `<SvGrid {data} {columns} {features}
  showRowSelection
  onRowSelectionChange={(map, rows) => {
    selectedIds = Object.keys(map)
    totalSelected = rows.length
  }}
/>`,
    },
    {
      name: 'onScrollBottomReached',
      type: '(e: { scrollTop: number; scrollHeight: number; clientHeight: number }) => void',
      description:
        'Fires once each time the body scrolls within ~32px of the bottom, re-arming after the user scrolls back up. The canonical hook for infinite / lazy loading - append more rows to `data` when it fires.',
      example: `<SvGrid {data} {columns} {features}
  onScrollBottomReached={async () => {
    if (loading || done) return
    loading = true
    data = [...data, ...(await fetchNextPage())]
    loading = false
  }}
/>`,
    },
    {
      name: 'onSortingChange',
      type: '(sorting: Array<{ id: string; desc: boolean }>) => void',
      description:
        'Fires whenever the sort clauses change. Receives the new array of `{ id, desc }` entries (multi-column order preserved). Pair with externalSort for server-side ordering.',
      example: `<SvGrid {data} {columns} {features}
  onSortingChange={(sort) => {
    // sort = [{ id: 'placedAt', desc: true }, ...]
    console.log('Sort changed:', sort)
  }}
/>`,
    },
  ],
  notes: [
    'Events fire after the grid has mutated its own state, so the payload always reflects the new value - never the previous one.',
    'There are no `preventDefault`-style hooks. To veto a change (e.g. reject an invalid edit), let it commit then correct it in the callback, or gate it earlier with ColumnDef.editable.',
    'onCellClick/onRowClick exclude group-header rows; click a group row to expand/collapse it instead.',
  ],
}

// ---------- <FlexRender />, renderSnippet, renderComponent --------------

const flexRenderSection: ApiSection = {
  id: 'flexrender',
  category: 'Components',
  title: '<FlexRender />',
  blurb: 'Renders a Svelte component, snippet, function, or plain value from a column definition.',
  demo: 'flexrender',
  intro: [
    'When you build a custom layout on top of the headless core, FlexRender bridges between the renderer set on a ColumnDef and the actual DOM. It handles every case: a string, a {#snippet} (via renderSnippet), a Svelte component (via renderComponent), a function returning one of those, or a raw value.',
    'You can pass the renderer explicitly with content + context, or use one of the cell / header / footer shorthands and let FlexRender pull the right renderer and context off the engine object for you.',
  ],
  signature: `import { FlexRender } from '@svgrid/grid'

<!-- Explicit form: -->
{#each row.getAllCells() as cell (cell.id)}
  <FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
{/each}

<!-- Shorthand form (equivalent for cells): -->
{#each row.getAllCells() as cell (cell.id)}
  <FlexRender cell={cell} />
{/each}`,
  props: [
    {
      name: 'cell',
      type: 'Cell<TData>',
      description: 'Shorthand: pass a cell and FlexRender reads columnDef.cell + cell.getContext() itself. Use instead of content + context.',
      example: `<FlexRender cell={cell} />`,
    },
    {
      name: 'content',
      type: 'ColumnDefTemplate<HeaderContext | CellContext> | undefined',
      description:
        'The renderer to draw - typically cell.column.columnDef.cell or header.column.columnDef.header. FlexRender detects whether it resolves to a string, snippet config, component config, or value. Pair with `context`.',
      example: `<FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />`,
    },
    {
      name: 'context',
      type: 'CellContext<TData> | HeaderContext<TData>',
      description: 'The context object from the engine, passed verbatim to a function renderer. Required when you pass `content`. CellContext exposes row, column, table, and getValue().',
      example: `const ctx = cell.getContext() // { row, column, table, getValue }`,
    },
    {
      name: 'footer',
      type: 'Header<TData>',
      description: 'Shorthand for a footer cell: renders columnDef.footer with the header context.',
      example: `<FlexRender footer={footerHeader} />`,
    },
    {
      name: 'header',
      type: 'Header<TData>',
      description: 'Shorthand for a header: renders columnDef.header with the header context.',
      example: `{#each headerGroup.headers as header (header.id)}
  <FlexRender header={header} />
{/each}`,
    },
  ],
  notes: [
    'Exactly one of `content` (with `context`), `cell`, `header`, or `footer` is used - they are mutually exclusive.',
    'A plain column with no `cell` renderer leaves columnDef.cell undefined, so the `cell` shorthand renders nothing; render `cell.getValue()` yourself for those, or always set a `cell`.',
    'Used internally by <SvGrid />. You only need it when hand-building a layout on top of createSvGrid.',
  ],
}

const renderHelpersSection: ApiSection = {
  id: 'render-helpers',
  category: 'Components',
  title: 'renderSnippet / renderComponent',
  blurb: 'Wrap a snippet or Svelte component as a typed cell or header renderer.',
  demo: 'render-helpers',
  intro: [
    'A ColumnDef cell / header renderer can be a string, a function, or - for custom UI - a snippet or component. These two helpers return a tagged config (RenderSnippetConfig / RenderComponentConfig) that FlexRender recognizes and dispatches correctly. You return them from a `cell` or `header` function on the column.',
    'Reach for renderSnippet when the markup lives in the same file as the grid (a local {#snippet}); reach for renderComponent when the cell UI is a reusable .svelte component with its own props.',
  ],
  props: [
    {
      name: 'renderComponent(component, props)',
      type: '<P>(component: Component<P>, props: P) => RenderComponentConfig<P>',
      description: 'Tag a Svelte component as a typed cell or header renderer.',
      example: `import StatusBadge from './StatusBadge.svelte'

const columns = [
  {
    field: 'status', header: 'Status',
    cell: (ctx) => renderComponent(StatusBadge, { value: ctx.getValue() }),
  },
]`,
    },
    {
      name: 'renderSnippet(snippet, params)',
      type: '<P>(snippet: Snippet<[P]>, params: P) => RenderSnippetConfig<P>',
      description: 'Tag a Svelte snippet (the {#snippet ...} kind) as a typed cell or header renderer. The second argument is the single params object passed to the snippet.',
      example: `{#snippet StatusPill(props: { row: Order })}
  <span class={\`pill pill-\${props.row.status}\`}>{props.row.status}</span>
{/snippet}

const columns: ColumnDef<typeof features, Order>[] = [
  {
    field: 'status', header: 'Status',
    cell: (ctx) => renderSnippet(StatusPill, { row: ctx.row.original }),
  },
]`,
    },
  ],
}

// ---------- <SvGridChart /> --------------------------------------------

const svgridChartSection: ApiSection = {
  id: 'svgrid-chart',
  category: 'Components',
  title: '<SvGridChart />',
  blurb: 'A dependency-free chart component (bar, line, area, pie/donut, scatter, combo) driven by a ChartSpec.',
  demo: 'svgrid-chart',
  intro: [
    'SvGridChart renders an interactive SVG chart with no charting dependency: stacked/grouped bars, lines, areas, pie/donut, scatter, and per-series combo. It supports a crosshair tooltip, a clickable legend that toggles series, optional data labels, and a click-to-drill callback.',
    'You give it a ChartSpec. The easiest way to build one from grid rows is rowsToChartSpec(), which aggregates a value field by a category (and optionally pivots into one series per value of a `series` field). For full control, build a ChartSpec by hand or with buildChart().',
  ],
  signature: `import { SvGridChart, rowsToChartSpec } from '@svgrid/grid'

const spec = rowsToChartSpec(orders, {
  type: 'bar',
  category: 'region',   // x axis / pie slices
  value: 'total',       // measure
  reduce: 'sum',        // 'sum' | 'avg' | 'count'
})

<SvGridChart {spec} dataLabels formatValue={(v) => \`$\${v}\`} />`,
  props: [
    {
      name: 'dataLabels',
      type: 'boolean',
      default: 'false',
      description: 'Draw the value on each bar, point, or slice.',
      example: `<SvGridChart {spec} dataLabels />`,
    },
    {
      name: 'formatValue',
      type: '(value: number) => string',
      description: 'Format values for tooltips, data labels, and Y-axis ticks.',
      example: `<SvGridChart {spec} formatValue={(v) => v >= 1000 ? \`$\${(v/1000).toFixed(1)}k\` : \`$\${v}\`} />`,
    },
    {
      name: 'interactive',
      type: 'boolean',
      default: 'true',
      description: 'Enable tooltips, the crosshair, and legend toggling. Set false for a static, print-friendly chart.',
      example: `<SvGridChart {spec} interactive={false} />`,
    },
    {
      name: 'legend',
      type: 'boolean',
      default: 'true',
      description: 'Show the clickable legend. Click a chip to toggle a series; double-click to isolate it.',
      example: `<SvGridChart {spec} legend={false} />`,
    },
    {
      name: 'onSelect',
      type: '(selection: ChartSelection) => void',
      description: 'Fired when a category, point, or slice is clicked - use it to drill back into the grid (e.g. set a filter).',
      example: `<SvGridChart {spec} onSelect={(s) => api.setFilter('region', { operator: 'equals', value: s.category })} />`,
    },
    {
      name: 'spec',
      type: 'ChartSpec',
      required: true,
      description: 'The chart definition: type, categories, and series. Build it with rowsToChartSpec() or by hand.',
      example: `<script lang="ts">
  import { SvGridChart, rowsToChartSpec } from '@svgrid/grid'

  type Sale = { month: string; product: string; revenue: number }

  const rows: Sale[] = [
    { month: 'Jan', product: 'Widgets',  revenue: 4200 },
    { month: 'Jan', product: 'Gadgets', revenue: 2600 },
    { month: 'Feb', product: 'Widgets',  revenue: 5100 },
    { month: 'Feb', product: 'Gadgets', revenue: 3050 },
  ]

  // Aggregate rows into a ChartSpec (or build the spec object by hand).
  const spec = rowsToChartSpec(rows, {
    type: 'line',
    category: 'month',
    value: 'revenue',
    series: 'product',
  })
</script>

<SvGridChart spec={spec} />`,
    },
  ],
  notes: [
    'rowsToChartSpec() options include `series` (pivot into one series per value), `reduce` (sum/avg/count), `stacked`, `stacked100`, `topN` + `otherLabel`, `sort`, and `width` / `height`.',
    'For SVG/PNG export of a rendered chart, see chartToSvgString / downloadChartPng in the chart-export module.',
  ],
}

// ---------- ColumnDef --------------------------------------------------

const columnDefSection: ApiSection = {
  id: 'columndef',
  category: 'Types',
  title: 'ColumnDef',
  blurb: 'The shape of each entry in the `columns` prop.',
  demo: 'columndef',
  intro: [
    'A ColumnDef describes one column: how to read the value, how to render it, whether it sorts, filters, or edits, the editor type, alignment, and conditional styling.',
    'Most columns need only `field`, `header`, and (optionally) `width`. Reach for the other properties when you need format control, a custom renderer, a specific editor, or column-level overrides.',
  ],
  signature: `type ColumnDef<TFeatures, TData, TValue = unknown> = {
  id?: string
  field?: keyof TData & string
  fieldFn?: (row: TData) => unknown
  header?: string | ((ctx: HeaderContext) => unknown)
  footer?: string | ((ctx: HeaderContext) => unknown)
  cell?: string | ((ctx: CellContext) => unknown)
  columns?: Array<ColumnDef>            // grouped (multi-row) headers
  editorType?:
    | 'text' | 'number' | 'date' | 'datetime' | 'time' | 'password'
    | 'checkbox' | 'list' | 'chips' | 'select' | 'rich-select'
    | 'textarea' | 'color' | 'rating'
  cellEditor?: (ctx: EditorContext) => unknown    // custom in-cell editor
  editorOptions?:
    | ReadonlyArray<string | number | { value; label?; color? }>
    | ((row: TData) => ReadonlyArray<...>)         // cascading options
  editorMultiple?: boolean
  editorSeparator?: string
  tooltip?: string | ((ctx: CellContext) => string | null | undefined)
  editable?: boolean | ((ctx: CellContext) => boolean)
  sortable?: boolean                     // default true (needs rowSortingFeature)
  filterable?: boolean                   // default true (needs columnFilteringFeature)
  format?: CellFormatConfig
  formatter?: (ctx) => string
  width?: number
  align?: 'left' | 'center' | 'right'
  cellClass?: string | string[] | ((ctx: CellContext) => ...)
}`,
  props: [
    {
      name: 'fieldFn',
      type: '(row: TData) => unknown',
      description:
        'Compute the cell value from the whole row instead of reading a single field. Use for derived / combined values. Provide an `id` since there is no `field` to default from.',
      example: `{ id: 'margin', header: 'Margin',
  fieldFn: (r) => (r.price - r.cost) / r.price,
  format: { type: 'percent', valueIsPercentPoints: false } }`,
    },
    {
      name: 'aggregate',
      type: "'sum' | 'avg' | 'min' | 'max' | 'count' | 'countDistinct' | 'extent' | 'first' | ((values: number[], rows: TData[]) => unknown)",
      description:
        "Aggregate this column's values into the group row when grouping is active. Pass a built-in aggregator name or a custom function; the result is formatted with this column's `format` and shown in the group header.",
      example: `{ field: 'revenue', header: 'Revenue', aggregate: 'sum', format: { type: 'currency' } }`,
    },
    {
      name: 'align',
      type: "'left' | 'center' | 'right'",
      description:
        'Horizontal alignment for header and body cells. When omitted, inferred from editorType: number / date / datetime -> right, checkbox -> center, everything else -> left.',
      example: `{ field: 'total', header: 'Total', align: 'right' }`,
    },
    {
      name: 'cell',
      type: 'string | ((ctx: CellContext) => unknown)',
      description:
        'Custom cell renderer. Use renderSnippet or renderComponent for typed output. Without it, SvGrid uses `field` / `fieldFn` plus `format`.',
      example: `{
  field: 'status', header: 'Status',
  cell: (ctx) => renderSnippet(StatusPill, { value: ctx.getValue() as string }),
}`,
    },
    {
      name: 'cellClass',
      type: 'string | string[] | ((ctx: CellContext) => string | string[] | Record<string, boolean>)',
      description:
        'Per-cell conditional CSS. A string / array adds class(es) to every cell in the column; a function runs per cell for status tinting, conditional bold, negative-number coloring, etc. The class augments the rendered cell - format / cell renderer still apply.',
      example: `{ field: 'pnl', header: 'P&L',
  cellClass: (ctx) => (ctx.getValue() as number) < 0 ? 'text-red-500' : 'text-green-500' }`,
    },
    {
      name: 'cellDataType',
      type: "'text' | 'number' | 'boolean' | 'date' | 'dateString'",
      description:
        "High-level data type that resolves the right `editorType`, alignment, date `format`, and filter operators at once. Anything you set explicitly still wins; `cellDataType` only fills the gaps. Use `dateString` for ISO date strings like '2026-06-27'.",
      example: `{ field: 'joined', header: 'Joined', cellDataType: 'dateString' }`,
    },
    {
      name: 'cellEditor',
      type: '(ctx: EditorContext) => unknown',
      description:
        'Fully custom in-cell editor (snippet or component). Receives the cell context plus `commit(value)` and `cancel()`. When both cellEditor and editorType are set, cellEditor wins and editorType is treated as a parse hint.',
      example: `{ field: 'color', header: 'Color',
  cellEditor: (ctx) => renderSnippet(ColorWheel, {
    value: ctx.getValue(), commit: ctx.commit, cancel: ctx.cancel,
  }) }`,
    },
    {
      name: 'cellFlash',
      type: 'boolean | { className?: string }',
      description:
        "Briefly flash / highlight this column's cell when its value changes, useful for streaming feeds, edits, or server pushes. `true` uses the default flash; pass `{ className }` to apply your own animation class instead.",
      example: `{ field: 'price', header: 'Price', cellFlash: true }`,
    },
    {
      name: 'colSpan',
      type: '(params: CellSpanParams<TData>) => number',
      description:
        'Declarative cell spanning (merged cells): return how many columns this cell spans to the right, where 1 means no span. Value-driven and AG-Grid-style; feed `spansToMerges(rows, columns)` into `spreadsheetLayout` to apply.',
      example: `{ field: 'region', header: 'Region',
  colSpan: (p) => (p.row.original.region === 'Total' ? 3 : 1) }`,
    },
    {
      name: 'columnGroupShow',
      type: "'open' | 'closed'",
      description:
        "For a column inside a collapsible column group: `'open'` shows the column only while the group is expanded, `'closed'` only while collapsed. Omit to always show it; setting it on any direct child gives the parent group a collapse toggle.",
      example: `{ field: 'phone', header: 'Phone', columnGroupShow: 'open' }`,
    },
    {
      name: 'columns',
      type: 'Array<ColumnDef>',
      description:
        'Child columns for a grouped (multi-row) header. The parent renders a spanning header label above its children.',
      example: `{ header: 'Name', columns: [
  { field: 'first', header: 'First' },
  { field: 'last',  header: 'Last' },
] }`,
    },
    {
      name: 'editable',
      type: 'boolean | ((ctx: CellContext) => boolean)',
      default: 'true',
      description:
        'Gate editing per column or per cell. `false` makes the column read-only (double-click, type-to-edit, fill-drag, Delete, and paste all skip it). A function is evaluated per cell so you can lock individual rows by role / status. The grid-wide enableInlineEditing still wins when false.',
      example: `{ field: 'total', header: 'Total', editable: false }
// per-cell:
{ field: 'price', header: 'Price',
  editable: (ctx) => ctx.row.original.status !== 'locked' }`,
    },
    {
      name: 'editorMultiple',
      type: 'boolean',
      default: 'false',
      description: 'When true, list / chips allow multiple selections; the cell value becomes an array.',
      example: `{ field: 'tags', header: 'Tags', editorType: 'chips', editorMultiple: true }`,
    },
    {
      name: 'editorOptions',
      type: 'ReadonlyArray<string | number | { value; label?; color? }> | ((row) => ...)',
      description:
        'Options for editorType list / chips / select / rich-select. Either bare values (value === label) or `{ value, label, color }` objects. Pass a function `(row) => options` for cascading options that depend on other fields in the same row.',
      example: `{ field: 'status', header: 'Status', editorType: 'list',
  editorOptions: ['pending', 'shipped', 'delivered', 'cancelled'] }
// cascading:
{ field: 'city', header: 'City', editorType: 'rich-select',
  editorOptions: (row) => CITIES_BY_COUNTRY[row.country] ?? [] }`,
    },
    {
      name: 'editorSeparator',
      type: 'string',
      default: '", "',
      description: 'Separator used when joining array values for the read-only cell display.',
      example: `{ field: 'tags', header: 'Tags', editorMultiple: true, editorSeparator: ' · ' }`,
    },
    {
      name: 'editorType',
      type: "'text' | 'number' | 'date' | 'datetime' | 'time' | 'password' | 'checkbox' | 'list' | 'chips' | 'select' | 'rich-select' | 'textarea' | 'color' | 'rating'",
      description:
        'Built-in editor used when inline editing is enabled. Drives both the visible input and the value parser. `list` / `chips` / `select` / `rich-select` use editorOptions; `textarea` commits on Tab or Ctrl+Enter; `rating` is a 5-star control; `color` is a native swatch.',
      example: `{ field: 'qty',     header: 'Qty',    editorType: 'number' }
{ field: 'shipped', header: 'Shipped', editorType: 'checkbox' }
{ field: 'region',  header: 'Region',  editorType: 'rich-select',
  editorOptions: ['NA', 'EMEA', 'APAC'] }
{ field: 'tags',    header: 'Tags',    editorType: 'chips', editorMultiple: true }
{ field: 'rating',  header: 'Rating',  editorType: 'rating' }`,
    },
    {
      name: 'field',
      type: 'keyof TData & string',
      description:
        'The property on the row used for sort, filter, default rendering, and inline editing. Either `field`, `fieldFn`, or an explicit `id + cell` is required.',
      example: `{ field: 'customer', header: 'Customer' }`,
    },
    {
      name: 'filterable',
      type: 'boolean',
      default: 'true',
      description:
        'When false the column never shows a filter funnel / menu and api.setFilter is ignored for it. Needs columnFilteringFeature.',
      example: `{ id: 'actions', header: '', filterable: false }`,
    },
    {
      name: 'footer',
      type: 'string | ((ctx: HeaderContext) => unknown)',
      description: 'Footer template, rendered in the footer row when present.',
      example: `{ field: 'total', header: 'Total', footer: 'Grand total' }`,
    },
    {
      name: 'format',
      type: 'CellFormatConfig',
      description:
        'Declarative number / currency / percent / date / datetime formatting applied to the default cell renderer. Ignored when `cell` is set. See the CellFormatConfig section for the full shape.',
      example: `{ field: 'total',    header: 'Total', format: { type: 'currency', currency: 'USD' } }
{ field: 'rate',     header: 'Rate',  format: { type: 'percent' } }
{ field: 'placedAt', header: 'Placed',format: { type: 'date', pattern: 'y-m-d' } }`,
    },
    {
      name: 'formatter',
      type: '(ctx: { value; row; column; table }) => string',
      description:
        'Imperative formatter - a function returning the display string. Use when declarative `format` is not enough (e.g. value-dependent units). Runs per cell.',
      example: `{ field: 'bytes', header: 'Size',
  formatter: ({ value }) => humanizeBytes(value as number) }`,
    },
    {
      name: 'header',
      type: 'string | ((ctx: HeaderContext) => unknown)',
      description: 'Header label. Pass a string for the common case, or a template / renderer for a custom header.',
      example: `{ field: 'total', header: 'Total (USD)' }
// Custom header:
{ field: 'total', header: (ctx) => renderSnippet(TotalHeader, { ctx }) }`,
    },
    {
      name: 'id',
      type: 'string',
      description:
        'Explicit column id. Defaults to `field` when set. Required when two columns share a field (e.g. a derived column with a custom `cell`) or when there is no `field`.',
      example: `{ id: 'fullName', header: 'Name', fieldFn: (r) => \`\${r.first} \${r.last}\` }`,
    },
    {
      name: 'openByDefault',
      type: 'boolean',
      description:
        "For a group column (one with `columns: [...]`): start the group expanded. Defaults to `false` (collapsed, matching AG Grid), so only the always-on and `columnGroupShow: 'closed'` children show until the user expands it.",
      example: `{ header: 'Contact', openByDefault: true, columns: [
  { field: 'email', header: 'Email' },
  { field: 'phone', header: 'Phone', columnGroupShow: 'open' },
] }`,
    },
    {
      name: 'rowSpan',
      type: '(params: CellSpanParams<TData>) => number',
      description:
        'Declarative cell spanning (merged cells): return how many rows this cell spans downward, where 1 means no span. See `colSpan` for how to apply the merges.',
      example: `{ field: 'category', header: 'Category',
  rowSpan: (p) => p.row.original.categorySpan ?? 1 }`,
    },
    {
      name: 'sortable',
      type: 'boolean',
      default: 'true',
      description:
        'When false the column never shows a sort indicator, header clicks are no-ops, and api.setSort is ignored for it. Needs rowSortingFeature to be registered.',
      example: `{ id: 'actions', header: '', sortable: false, filterable: false, width: 60,
  cell: (ctx) => renderComponent(RowActions, { row: ctx.row.original }) }`,
    },
    {
      name: 'sparkline',
      type: 'SparklineConfig',
      description:
        "Render the cell as an in-cell sparkline chart from an array of numbers (or a comma/space separated string). Options include `type` ('line' | 'bar' | 'winloss'), color, negativeColor, width, height, and fixed min/max. Mutually exclusive with a custom `cell` renderer, which wins if both are set.",
      example: `{ field: 'trend', header: 'Trend', sparkline: { type: 'bar', color: '#16a34a' } }`,
    },
    {
      name: 'tooltip',
      type: 'string | ((ctx: CellContext) => string | null | undefined)',
      description:
        'Per-column tooltip. A string shows on every cell; a function runs per cell so the tooltip can reflect the value. Return an empty string / null to skip.',
      example: `{ field: 'sku', header: 'SKU',
  tooltip: (ctx) => \`Internal id: \${ctx.row.original.internalId}\` }`,
    },
    {
      name: 'valueParser',
      type: '(params: ValueParserParams<TData>) => unknown',
      description:
        'Transform the committed edit value before it is written to the row. Runs after the built-in per-`editorType` coercion, so `newValue` is already type-parsed; return the final value to store (e.g. round a number, uppercase a code, look up an id).',
      example: `{ field: 'code', header: 'Code',
  valueParser: (p) => String(p.newValue).toUpperCase() }`,
    },
    {
      name: 'visible',
      type: 'boolean',
      description:
        "Initial visibility. Set `false` to start the column hidden while still listing it in the Choose Columns / tool panel so the user can re-enable it. Applied once at mount; after that `api.setColumnVisible` and user toggles win. On a group column, `false` hides the whole group's leaf columns.",
      example: `{ field: 'internalId', header: 'Internal ID', visible: false }`,
    },
    {
      name: 'width',
      type: 'number',
      description: 'Initial column width in pixels. Falls back to the grid-level `columnWidth` (140).',
      example: `{ field: 'id', header: 'ID', width: 90 }`,
    },
  ],
  notes: [
    'There is no `minWidth` / `maxWidth` / `resizable` / `meta` / `aggregation` field on ColumnDef. Columns are resizable by default via the header drag handle; row summaries auto-sum numeric columns (see enableRowSummaries).',
    'Provide an explicit `id` whenever a column has no `field` (fieldFn / pure-render columns) or when two columns would otherwise collide on the same field.',
  ],
  example: {
    title: 'A column set covering most patterns',
    code: `import { renderSnippet, type ColumnDef } from '@svgrid/grid'

{#snippet StatusCell(props: { row: Order })}
  <span class={\`pill pill-\${props.row.status}\`}>{props.row.status}</span>
{/snippet}

const columns: ColumnDef<typeof features, Order>[] = [
  { field: 'id',       header: 'Order ID', width: 110, editable: false },
  { field: 'customer', header: 'Customer', width: 200, editorType: 'text' },
  { field: 'region',   header: 'Region',   width: 100, editorType: 'rich-select',
    editorOptions: ['NA', 'EMEA', 'APAC', 'LATAM'] },
  { field: 'qty',      header: 'Qty',      width: 80,  editorType: 'number', align: 'right' },
  { field: 'total',    header: 'Total',    width: 130, editorType: 'number',
    format: { type: 'currency', currency: 'USD' },
    cellClass: (ctx) => (ctx.getValue() as number) > 1000 ? 'font-semibold' : '' },
  { field: 'placedAt', header: 'Placed',   width: 130,
    format: { type: 'date', pattern: 'y-m-d' } },
  { field: 'status',   header: 'Status',   width: 130,
    cell: (ctx) => renderSnippet(StatusCell, { row: ctx.row.original }) },
]`,
  },
}

// ---------- CellFormatConfig -------------------------------------------

const cellFormatSection: ApiSection = {
  id: 'cell-format',
  category: 'Types',
  title: 'CellFormatConfig',
  blurb: 'Declarative cell formatting for numbers, currencies, percents, and dates.',
  demo: 'cell-format',
  intro: [
    'Set `format` on a ColumnDef to control how the default cell renderer formats a value. Internally the grid hands off to Intl.NumberFormat / Intl.DateTimeFormat, so locale + currency support is browser-native. `locales` and `options` map straight onto the Intl constructors.',
  ],
  signature: `type CellFormatConfig =
  | { type: 'number';   locales?: string | string[]; options?: Intl.NumberFormatOptions }
  | { type: 'currency'; currency?: string /* ISO 4217, default USD */;
      locales?: string | string[]; options?: Intl.NumberFormatOptions }
  | { type: 'percent';  locales?: string | string[]; options?: Intl.NumberFormatOptions;
      valueIsPercentPoints?: boolean }
  | { type: 'date' | 'datetime'; locales?: string | string[];
      pattern?: string; options?: Intl.DateTimeFormatOptions }`,
  props: [
    {
      name: 'type: "currency"',
      type: '{ type: "currency"; currency?; locales?; options? }',
      description: '`currency` is an ISO 4217 code (default "USD"). Use `locales` for grouping / symbol placement.',
      example: `{ field: 'total', header: 'Total',
  format: { type: 'currency', currency: 'EUR', locales: 'de-DE' } }`,
    },
    {
      name: 'type: "date" / "datetime"',
      type: '{ type: "date" | "datetime"; pattern?; locales?; options? }',
      description:
        'Format an ISO string, timestamp, or Date. `pattern` is a shortcut merged with `options`: "d" short numeric date, "D" long date, "y-m-d" yyyy/mm/dd-style, "short"/"medium"/"long" use dateStyle/timeStyle presets.',
      example: `{ field: 'placedAt',  header: 'Placed',  format: { type: 'date', pattern: 'y-m-d' } }
{ field: 'createdAt', header: 'Created', format: { type: 'datetime', pattern: 'medium' } }`,
    },
    {
      name: 'type: "number"',
      type: '{ type: "number"; locales?; options? }',
      description: 'Format as a localized number. `options` are Intl.NumberFormatOptions (minimumFractionDigits, etc.).',
      example: `{ field: 'rate', header: 'Rate',
  format: { type: 'number', options: { maximumFractionDigits: 2 } } }`,
    },
    {
      name: 'type: "percent"',
      type: '{ type: "percent"; locales?; options?; valueIsPercentPoints? }',
      description:
        'Format as a percent. By default the value is an Intl fraction (0.42 -> 42%). Set `valueIsPercentPoints: true` when your value is already 0-100 (42 -> 42%).',
      example: `{ field: 'margin', header: 'Margin',
  format: { type: 'percent', options: { maximumFractionDigits: 1 } } }
// 0.158 renders as "15.8%"`,
    },
  ],
  notes: [
    'Earlier shorthand keys (minFractionDigits / maxFractionDigits / timeZone) are not part of the config - pass the equivalent Intl keys through `options` instead.',
  ],
}

// ---------- SvGridFilterOperator ---------------------------------------

const filterOperatorSection: ApiSection = {
  id: 'filter-operator',
  category: 'Types',
  title: 'SvGridFilterOperator',
  blurb: 'The operator codes used by `api.setFilter` and the column-menu filter.',
  intro: ['The operators below cover the common filter-menu UX. Use setFilter to apply one programmatically.'],
  signature: `type SvGridFilterOperator =
  | 'contains'
  | 'equals'
  | 'startsWith'
  | 'greaterThan'
  | 'lessThan'
  | 'between'
  | 'isBlank'`,
  props: [
    {
      name: 'between',
      type: '"between"',
      description:
        'Inclusive numeric range. Requires both `value` (lower bound) and `valueTo` (upper bound). Surfaced in onFiltersChange / getFilters as a `valueTo` field.',
      example: `api.setFilter('total', { operator: 'between', value: '100', valueTo: '500' })`,
    },
    {
      name: 'contains',
      type: '"contains"',
      description: 'Substring match (case-insensitive) against the cell value cast to string.',
      example: `api.setFilter('customer', { operator: 'contains', value: 'Acme' })`,
    },
    {
      name: 'equals',
      type: '"equals"',
      description: 'Exact match (case-insensitive for strings; strict for numbers + booleans).',
      example: `api.setFilter('status', { operator: 'equals', value: 'shipped' })`,
    },
    {
      name: 'greaterThan',
      type: '"greaterThan"',
      description: 'Numeric > comparison. Cell + value are coerced to numbers.',
      example: `api.setFilter('total', { operator: 'greaterThan', value: '500' })`,
    },
    {
      name: 'isBlank',
      type: '"isBlank"',
      description: 'Match rows where the cell is null, undefined, or empty string. `value` is ignored.',
      example: `api.setFilter('email', { operator: 'isBlank' })`,
    },
    {
      name: 'lessThan',
      type: '"lessThan"',
      description: 'Numeric < comparison.',
      example: `api.setFilter('total', { operator: 'lessThan', value: '500' })`,
    },
    {
      name: 'startsWith',
      type: '"startsWith"',
      description: 'Prefix match against the cell value cast to string.',
      example: `api.setFilter('id', { operator: 'startsWith', value: 'ORD-' })`,
    },
  ],
}

// ---------- Core types -------------------------------------------------

const coreTypesSection: ApiSection = {
  id: 'core-types',
  category: 'Types',
  title: 'Row / Cell / Column / Context',
  blurb: 'The objects your renderers and row models receive from the engine.',
  intro: [
    'When you write a custom `cell` / `header` renderer, or build a layout on the headless core, you receive these objects. They mirror TanStack Table\'s vocabulary so the mental model transfers.',
  ],
  props: [
    {
      name: 'Cell<TData>',
      type: '{ id; row: Row; column: Column; getValue(); getContext() }',
      description: 'One cell. `getValue()` reads the resolved value; `getContext()` builds the CellContext a renderer needs.',
      example: `{#each row.getAllCells() as cell (cell.id)}
  <FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
{/each}`,
    },
    {
      name: 'CellContext<TData, TValue>',
      type: '{ row: Row; column: Column; table: SvGrid; getValue(): TValue }',
      description: 'Passed to a `cell` renderer and to `editable` / `cellClass` / `tooltip` functions.',
      example: `cell: (ctx) => ctx.getValue() > 0 ? '+' + ctx.getValue() : ctx.getValue()`,
    },
    {
      name: 'Column<TData>',
      type: '{ id; columnDef; depth; getCanSort(); getCanFilter(); getIsSorted(); getToggleSortingHandler() }',
      description: 'Column metadata + behavior helpers, used to render headers and wire sort handlers.',
      example: `<button onclick={column.getToggleSortingHandler()}>
  {column.columnDef.header} {column.getIsSorted() || ''}
</button>`,
    },
    {
      name: 'EditorContext<TData>',
      type: 'CellContext & { commit(value: unknown): void; cancel(): void }',
      description: 'Passed to a custom `cellEditor`. Call commit to save and exit, cancel to discard.',
      example: `cellEditor: (ctx) => renderSnippet(MyEditor, {
  value: ctx.getValue(), commit: ctx.commit, cancel: ctx.cancel,
})`,
    },
    {
      name: 'HeaderContext<TData>',
      type: '{ column: Column; table: SvGrid }',
      description: 'Passed to a function `header` / `footer` renderer.',
      example: `header: (ctx) => renderSnippet(SortableHeader, { ctx })`,
    },
    {
      name: 'Row<TData>',
      type: '{ id; index; original: TData; depth; subRows?; leafCount?; getIsExpanded(); toggleExpanded(); getIsSelected(); toggleSelected(); getAllCells(); getCellValueByColumnId(id) }',
      description:
        'One row in a row model. `original` is your raw data object; `subRows` is populated for grouped / tree rows; `leafCount` counts data rows under a group.',
      example: `{#each grid.getRowModel().rows as row (row.id)}
  <div class:selected={row.getIsSelected()}>{row.original.name}</div>
{/each}`,
    },
  ],
  notes: [
    'These types are exported from @svgrid/grid for annotation: Row, Cell, Column, CellContext, EditorContext, HeaderContext, HeaderGroup, Header, RowData, SortingState, Updater, SvGridInstance, SvGridOptions, TableFeatures, ColumnDefTemplate.',
  ],
}

// ---------- Imperative API ---------------------------------------------

const imperativeApiSection: ApiSection = {
  id: 'imperative-api',
  category: 'Imperative API',
  title: 'SvGridApi',
  blurb: 'The object delivered to <SvGrid onApiReady>. Use it to drive the grid from outside.',
  demo: 'imperative-api',
  intro: [
    'Most of the time you drive the grid by mutating reactive state (data, columns). When you need imperative control - "scroll to the row with id X", "clear all filters from a parent toolbar", "undo the last edit", "open find" - use the API object that <SvGrid onApiReady> delivers.',
    'Every method is typed in packages/grid/src/svgrid-wrapper.types.ts.',
  ],
  signature: `type SvGridApi<TFeatures, TData> = {
  // Cells
  getCellValue(rowIndex, columnId): unknown
  setCellValue(rowIndex, columnId, value): void

  // Cell selection
  selectCells(ranges: ReadonlyArray<[number, number, number, number]>): void
  getSelected(): Array<[number, number, number, number]>

  // Rows
  addRow(row, position?): void
  addRows(rows, position?): void
  removeRow(rowIndex): void
  removeRows(rowIndices): void

  // Columns
  addColumn(column, position?): void
  addColumns(columns, position?): void
  removeColumn(columnId): void
  setColumnVisible(columnId, visible): void
  isColumnVisible(columnId): boolean
  getColumns(): Array<{ id; field?; header; visible }>

  // Column layout (width + pinning)
  setColumnWidth(columnId, width): void
  getColumnWidths(): Record<string, number>
  setColumnPinning({ left?, right? }): void
  getColumnPinning(): { left: string[]; right: string[] }

  // Sort / group / filter
  setSort(columnId, direction): void
  clearSort(): void
  setGroupBy(columnIds): void
  setFilter(columnId, filter | null): void
  setFacetFilter(columnId, values | null): void
  clearFilter(columnId): void
  clearAllFilters(): void
  getFilters(): Record<string, { operator; value; valueTo? }>

  // Row expansion
  setRowExpanded(id, expanded): void
  expandAllGroups(): void
  collapseAllGroups(): void

  // Undo / redo
  undo(): boolean
  redo(): boolean
  canUndo(): boolean
  canRedo(): boolean
  clearHistory(): void

  // Find in grid
  openFind(): void
  closeFind(): void
  setFindQuery(q): void
  getFindHits(): Array<{ rowIndex; colIndex; columnId }>

  // Row selection (read + write)
  getSelectedRows(): TData[]
  getSelectedRowIds(): string[]
  selectRows(ids: ReadonlyArray<string>, additive?: boolean): void
  selectAllRows(): void
  toggleRowSelected(id: string): void
  clearRowSelection(): void

  // Pagination
  getPageInfo(): { pageIndex; pageSize; pageCount; total }
  setPage(pageIndex: number): void
  nextPage(): void
  prevPage(): void
  firstPage(): void
  lastPage(): void
  setPageSize(pageSize: number): void

  // Navigation
  scrollToRow(rowIndex: number): void
  getActiveCell(): { rowIndex; colIndex; columnId } | null
  setActiveCell(rowIndex: number, colIndex: number): void

  // Column order
  setColumnOrder(order: ReadonlyArray<string>): void
  getColumnOrder(): string[]

  // View state (save / restore)
  getState(): SvGridViewState
  setState(state: Partial<SvGridViewState>): void
  refresh(): void

  // Snapshots
  getData(): ReadonlyArray<TData>
  getDisplayedRows(): ReadonlyArray<TData>
}`,
  props: [
    // ---- Columns ----
    {
      name: 'addColumn(column, position?)',
      type: "(column: ColumnDef, position?: 'left' | 'right' | number) => void",
      description: 'Insert one column. `position` defaults to "right".',
      example: `api.addColumn({ field: 'notes', header: 'Notes', width: 200 }, 'left')`,
    },
    {
      name: 'addColumns(columns, position?)',
      type: "(columns: ReadonlyArray<ColumnDef>, position?: 'left' | 'right' | number) => void",
      description: 'Insert many columns in one shot.',
      example: `api.addColumns([
  { field: 'createdAt', header: 'Created' },
  { field: 'updatedAt', header: 'Updated' },
], 'right')`,
    },
    // ---- Rows ----
    {
      name: 'addRow(row, position?)',
      type: "(row: TData, position?: 'top' | 'bottom' | number) => void",
      description: 'Insert one row. `position` defaults to "bottom". Pass a number to insert at that index.',
      example: `api.addRow({ id: 99, customer: 'New Co', total: 100 }, 'top')
api.addRow(newRow, 3)  // insert at index 3`,
    },
    {
      name: 'addRows(rows, position?)',
      type: "(rows: ReadonlyArray<TData>, position?: 'top' | 'bottom' | number) => void",
      description: 'Insert many rows in one shot. Preferred over calling addRow in a loop.',
      example: `api.addRows(parsedRows, 'bottom')`,
    },
    {
      name: 'applyTransaction(tx)',
      type: '(tx: SvGridTransaction<TData>) => SvGridTransactionResult',
      description:
        'Apply a batch of add / update / remove mutations in a single data update (one re-render, not one per row) - the high-frequency / streaming path. `update` and `remove`-by-id match rows via getRowId; `remove` also accepts row object references. Returns the counts actually applied.',
      example: `const result = api.applyTransaction({
  add: [{ id: 99, customer: 'New Co', total: 100 }],
  update: [{ id: 12, status: 'shipped' }],
  remove: ['7', existingRow],
})
// result = { added: 1, updated: 1, removed: 2 }`,
    },
    {
      name: 'autosizeAllColumns()',
      type: '() => void',
      description:
        'Run autosizeColumn on every column, snapping each to the width of its widest visible cell.',
      example: `api.autosizeAllColumns()`,
    },
    {
      name: 'autosizeColumn(columnId)',
      type: '(columnId: string) => void',
      description:
        'Snap one column\'s width to its widest visible cell (header text plus any rendered body cell). Equivalent to double-clicking the column\'s resize handle.',
      example: `api.autosizeColumn('customer')`,
    },
    {
      name: 'canRedo()',
      type: '() => boolean',
      description: 'True when there is at least one step on the redo stack.',
      example: `disabled={!api?.canRedo()}`,
    },
    {
      name: 'canUndo()',
      type: '() => boolean',
      description: 'True when there is at least one step on the undo stack.',
      example: `disabled={!api?.canUndo()}`,
    },
    {
      name: 'clearAllFilters()',
      type: '() => void',
      description: 'Wipe every filter surface in one call: column-menu filters, filter-row inputs, facet value lists, and the global search box.',
      example: `<button onclick={() => api?.clearAllFilters()}>Reset filters</button>`,
    },
    {
      name: 'clearFilter(columnId)',
      type: '(columnId: string) => void',
      description: 'Clear all filter surfaces (menu, row, facet) on one column.',
      example: `api.clearFilter('status')`,
    },
    {
      name: 'clearHistory()',
      type: '() => void',
      description: 'Wipe both undo and redo stacks - e.g. after a server save commits the edit buffer.',
      example: `await save(); api.clearHistory()`,
    },
    {
      name: 'clearRowSelection()',
      type: '() => void',
      description: 'Wipe every checked row. Emits onRowSelectionChange({}, []) to subscribers.',
      example: `<button onclick={() => api?.clearRowSelection()}>Deselect all</button>`,
    },
    {
      name: 'clearSort()',
      type: '() => void',
      description: 'Remove every sort clause.',
      example: `api.clearSort()`,
    },
    {
      name: 'collapseAllGroups()',
      type: '() => void',
      description: 'Collapse every expansion - resets expanded state to {}.',
      example: `api.collapseAllGroups()`,
    },
    {
      name: 'expandAllGroups()',
      type: '() => void',
      description: 'Expand every group node in the current grouped row model.',
      example: `api.expandAllGroups()`,
    },
    {
      name: 'getActiveCell() / setActiveCell(rowIndex, colIndex)',
      type: '() => { rowIndex; colIndex; columnId } | null / (rowIndex, colIndex) => void',
      description:
        'Read or move the active (focused) cell. Coordinates are clamped to the grid bounds; getActiveCell returns null when nothing is focused.',
      example: `api.setActiveCell(0, 2)
const cell = api.getActiveCell()   // { rowIndex: 0, colIndex: 2, columnId: 'total' }`,
    },
    // ---- Cells ----
    {
      name: 'getCellValue(rowIndex, columnId)',
      type: '(rowIndex: number, columnId: string) => unknown',
      description: 'Read a cell value from the underlying data array. `rowIndex` indexes into getData(), not the visible row list.',
      example: `const total = api.getCellValue(0, 'total') as number`,
    },
    {
      name: 'getColumnPinning()',
      type: '() => { left: string[]; right: string[] }',
      description: 'Snapshot of the current column-pinning state.',
      example: `const { left, right } = api.getColumnPinning()`,
    },
    {
      name: 'getColumns()',
      type: '() => Array<{ id: string; field?: string; header: string; visible: boolean }>',
      description:
        'Snapshot of every column in visual order with its header label and visibility. Read once - use it to build a column-picker UI or to export. Hidden columns are included.',
      example: `const cols = api.getColumns().filter((c) => c.visible)`,
    },
    {
      name: 'getColumnWidths()',
      type: '() => Record<string, number>',
      description:
        'Snapshot of every column\'s current width (px), keyed by id. Columns never resized and without an explicit `width` report the grid-wide default. Useful for "save view" + URL persistence.',
      example: `localStorage.setItem('grid-widths', JSON.stringify(api.getColumnWidths()))`,
    },
    // ---- Snapshots ----
    {
      name: 'getData()',
      type: '() => ReadonlyArray<TData>',
      description: 'Snapshot of the current data array, pre-pipeline. Identical to the `data` prop reference.',
      example: `const all = api.getData()`,
    },
    {
      name: 'getDisplayedRows()',
      type: '() => ReadonlyArray<TData>',
      description:
        'Snapshot of the rows the grid is actually showing - after filtering, sorting, grouping, and pagination. Use it to export "the visible result set".',
      example: `function exportVisible() {
  download(toCsv(api.getDisplayedRows()), 'orders.csv')
}`,
    },
    {
      name: 'getFilters()',
      type: '() => Record<string, { operator: SvGridFilterOperator; value: string; valueTo? }>',
      description:
        'Read the active column-menu filters as a snapshot, keyed by column id. `valueTo` is present only for `between`. Does NOT include facet selections or the global filter - use onFiltersChange for those.',
      example: `const f = api.getFilters()
// { total: { operator: 'between', value: '100', valueTo: '500' } }`,
    },
    {
      name: 'getFindHits()',
      type: '() => Array<{ rowIndex: number; colIndex: number; columnId: string }>',
      description: 'Snapshot of the current find hits.',
      example: `const hits = api.getFindHits()
status = \`\${hits.length} matches\``,
    },
    // ---- Pagination ----
    {
      name: 'getPageInfo()',
      type: '() => { pageIndex; pageSize; pageCount; total }',
      description:
        'Current pagination snapshot. total is the post-filter row count; pageCount is derived from it and pageSize (always >= 1).',
      example: `const { pageIndex, pageCount } = api.getPageInfo()
label = \`Page \${pageIndex + 1} of \${pageCount}\``,
    },
    {
      name: 'getSelected()',
      type: '() => Array<[number, number, number, number]>',
      description: 'Read the current cell-selection rectangles in the same shape selectCells accepts. Empty array when no range is active.',
      example: `const [range] = api.getSelected()
// range = [0, 1, 4, 3]`,
    },
    // ---- Row selection (read + write) ----
    {
      name: 'getSelectedRows() / getSelectedRowIds()',
      type: '() => TData[] / () => string[]',
      description:
        'The selected data rows (group rows excluded), in row-model order, and their engine row ids. The pull-based equivalent of the onRowSelectionChange event.',
      example: `const rows = api.getSelectedRows()
const ids  = api.getSelectedRowIds()`,
    },
    // ---- View state ----
    {
      name: 'getState() / setState(state)',
      type: '() => SvGridViewState / (state: Partial<SvGridViewState>) => void',
      description:
        'Serialize the whole view (sort, grouping, pagination, column widths / pinning / order / visibility, and every filter surface) and restore it. setState only applies the keys present, so you can restore just columns, just filters, etc. The backbone of "save view" / URL persistence / named views.',
      example: `// persist
localStorage.setItem('view', JSON.stringify(api.getState()))
// restore
api.setState(JSON.parse(localStorage.getItem('view') ?? '{}'))`,
    },
    {
      name: 'isColumnVisible(columnId)',
      type: '(columnId: string) => boolean',
      description: 'Query whether a column is currently visible.',
      example: `const showing = api.isColumnVisible('email')`,
    },
    // ---- Find ----
    {
      name: 'openFind() / closeFind()',
      type: '() => void',
      description: 'Open / close the built-in find overlay. Ctrl+F also opens it; closeFind clears the query.',
      example: `<button onclick={() => api?.openFind()}>Find (Ctrl+F)</button>`,
    },
    {
      name: 'redo()',
      type: '() => boolean',
      description: 'Redo the most recently undone edit. Returns false when the redo stack is empty.',
      example: `<button onclick={() => api?.redo()} disabled={!api?.canRedo()}>Redo</button>`,
    },
    {
      name: 'refresh()',
      type: '() => void',
      description: 'Force a recompute of the row pipeline and a re-render. Rarely needed - reactive data/columns updates are automatic.',
      example: `api.refresh()`,
    },
    {
      name: 'removeColumn(columnId)',
      type: '(columnId: string) => void',
      description: 'Remove a column by id (or `field` when no id was provided).',
      example: `api.removeColumn('notes')`,
    },
    {
      name: 'removeRow(rowIndex)',
      type: '(rowIndex: number) => void',
      description: 'Remove a row by its data-array index.',
      example: `api.removeRow(0)`,
    },
    {
      name: 'removeRows(rowIndices)',
      type: '(rowIndices: ReadonlyArray<number>) => void',
      description: 'Remove many rows in one shot.',
      example: `const selected = Object.keys(selection).map(Number)
api.removeRows(selected)`,
    },
    // ---- Navigation ----
    {
      name: 'scrollToRow(rowIndex)',
      type: '(rowIndex: number) => void',
      description: 'Scroll the body so the given row is at the top of the viewport. Works with virtualization on; index is clamped.',
      example: `api.scrollToRow(jumpTarget)   // e.g. "go to row 5000"`,
    },
    {
      name: 'selectAllRows() / toggleRowSelected(id)',
      type: '() => void / (id: string) => void',
      description: 'Select every selectable row, or flip one row by id.',
      example: `api.selectAllRows()
api.toggleRowSelected('order-3')`,
    },
    // ---- Cell selection ----
    {
      name: 'selectCells(ranges)',
      type: '(ranges: ReadonlyArray<[number, number, number, number]>) => void',
      description:
        'Select one or more rectangular cell ranges, each [rowStart, colStart, rowEnd, colEnd] in 0-indexed grid coords. The active cell jumps to the start corner. Pass [] to clear. The engine honours the first range only today.',
      example: `api.selectCells([[0, 1, 4, 3]])   // rows 0..4, cols 1..3
api.selectCells([])               // clear`,
    },
    {
      name: 'selectRows(ids, additive?)',
      type: '(ids: ReadonlyArray<string>, additive?: boolean) => void',
      description:
        'Select rows by engine row id. Replaces the selection by default; pass additive: true to add to it.',
      example: `api.selectRows(['order-3', 'order-7'])
api.selectRows(['order-9'], true)   // add to existing`,
    },
    {
      name: 'setCellValue(rowIndex, columnId, value)',
      type: '(rowIndex, columnId, value) => void',
      description: "Write a cell value through the column's field. Emits onCellValueChange to subscribers.",
      example: `api.setCellValue(0, 'status', 'shipped')`,
    },
    // ---- Column order ----
    {
      name: 'setColumnOrder(order) / getColumnOrder()',
      type: '(order: ReadonlyArray<string>) => void / () => string[]',
      description:
        'Read or replace the visual column order (array of column ids). Unknown ids are skipped; columns not listed keep their relative position after the listed ones. Pin groups still apply on top. Fires onColumnOrderChange.',
      example: `api.setColumnOrder(['status', 'customer', 'total'])
const order = api.getColumnOrder()`,
    },
    {
      name: 'setColumnPinning(pinning)',
      type: '(pinning: { left?: ReadonlyArray<string>; right?: ReadonlyArray<string> }) => void',
      description: 'Replace the column-pinning state. Order in each array becomes the visible order along that edge. Requires columnVirtualization={false}.',
      example: `api.setColumnPinning({ left: ['id'], right: ['actions'] })`,
    },
    {
      name: 'setColumnVisible(columnId, visible)',
      type: '(columnId: string, visible: boolean) => void',
      description: 'Show or hide a column without removing it. State persists until reset.',
      example: `api.setColumnVisible('email', false)`,
    },
    // ---- Column layout ----
    {
      name: 'setColumnWidth(columnId, width)',
      type: '(columnId: string, width: number) => void',
      description: 'Set a column width in pixels - identical to dragging its resize handle. Clamped to the minimum column width.',
      example: `api.setColumnWidth('customer', 240)`,
    },
    {
      name: 'setFacetFilter(columnId, values)',
      type: '(columnId: string, values: ReadonlyArray<string> | null) => void',
      description:
        'Set the facet (Excel-style value checklist) filter for a column. Pass null / [] to clear. Restores snapshots captured from onFiltersChange.selectedValues.',
      example: `api.setFacetFilter('status', ['shipped', 'delivered'])
api.setFacetFilter('status', null)`,
    },
    // ---- Filter ----
    {
      name: 'setFilter(columnId, filter)',
      type: "(columnId, filter: { operator; value?; valueTo? } | null) => void",
      description: 'Set the operator filter for a column. Pass null to clear. Use valueTo for the `between` operator.',
      example: `api.setFilter('customer', { operator: 'contains', value: 'Acme' })
api.setFilter('total', { operator: 'between', value: '100', valueTo: '500' })
api.setFilter('status', null)   // clear`,
    },
    {
      name: 'setFindQuery(q)',
      type: '(q: string) => void',
      description: 'Update the find query programmatically - useful for an app-wide command palette.',
      example: `api.setFindQuery('overdue')`,
    },
    // ---- Group ----
    {
      name: 'setGroupBy(columnIds)',
      type: '(columnIds: ReadonlyArray<string>) => void',
      description: 'Group rows by the given columns, in order. Pass [] to ungroup. Requires columnGroupingFeature.',
      example: `api.setGroupBy(['region', 'status'])
api.setGroupBy([])   // ungroup`,
    },
    {
      name: 'setPage / nextPage / prevPage / firstPage / lastPage',
      type: '(pageIndex?: number) => void',
      description: 'Imperative page navigation. setPage clamps to [0, pageCount - 1]; the others are no-ops past the ends.',
      example: `api.setPage(0)
api.nextPage()
api.lastPage()`,
    },
    {
      name: 'setPageSize(pageSize)',
      type: '(pageSize: number) => void',
      description: 'Change the page size, keeping the first visible row in view.',
      example: `api.setPageSize(50)`,
    },
    // ---- Row expansion ----
    {
      name: 'setRowExpanded(id, expanded)',
      type: '(id: string, expanded: boolean) => void',
      description:
        "Expand / collapse a row. `id` is the engine's row id - for grouped rows that's the synthetic group key (e.g. \"department:Engineering\").",
      example: `api.setRowExpanded('department:Engineering', true)`,
    },
    // ---- Sort ----
    {
      name: 'setSort(columnId, direction)',
      type: "(columnId: string, direction: 'asc' | 'desc' | null) => void",
      description: "Sort by one column. Replaces any existing sort. Pass null to remove this column's clause.",
      example: `api.setSort('placedAt', 'desc')
api.setSort('placedAt', null)   // remove this sort clause`,
    },
    {
      name: 'startEditing(rowIndex, columnId)',
      type: '(rowIndex: number, columnId: string) => boolean',
      description:
        'Programmatically begin editing a cell, as a double-click would. Returns true if editing started (the cell exists, is editable, and editing is enabled).',
      example: `if (api.startEditing(0, 'status')) {
  // editor is now open on row 0, column "status"
}`,
    },
    {
      name: 'stopEditing(cancel?)',
      type: '(cancel?: boolean) => boolean',
      description:
        'Commit (default) or, with cancel: true, discard the active edit. Returns true if there was an edit in progress.',
      example: `api.stopEditing()       // commit the active edit
api.stopEditing(true)   // cancel and revert`,
    },
    // ---- Undo / redo ----
    {
      name: 'undo()',
      type: '() => boolean',
      description: 'Undo the most recent inline edit. Returns false when the undo history is empty.',
      example: `<button onclick={() => api?.undo()} disabled={!api?.canUndo()}>Undo</button>`,
    },
  ],
  notes: [
    'Calls to addRow / setCellValue / setSort propagate back into reactive state - your `data` and `columns` props see the update.',
    '`rowIndex` is the index into the underlying data array (getData()), NOT the visible row position. Use getDisplayedRows() for the post-filter / post-sort / post-pagination view.',
    'getFilters() / getColumnWidths() / getState() return defensive copies - mutating them does not affect grid state.',
    'getState() / setState() is the recommended way to implement "save view": one call captures sort + filters + grouping + pagination + the full column layout.',
    'Column pinning (setColumnPinning) requires columnVirtualization={false}.',
  ],
  example: {
    title: 'Drive the grid from a parent toolbar',
    code: `<script lang="ts">
  import type { SvGridApi } from '@svgrid/grid'

  let api = $state<SvGridApi<typeof features, Order> | null>(null)

  function addBlankRow() {
    api?.addRow({ id: crypto.randomUUID(), customer: '', total: 0, status: 'pending' }, 'top')
  }
  function deleteSelected(ids: string[]) {
    const data = api?.getData() ?? []
    const indices = ids.map((id) => data.findIndex((r) => r.id === id)).filter((i) => i >= 0)
    api?.removeRows(indices)
  }
  function exportVisible() {
    download(toCsv(api?.getDisplayedRows() ?? []), 'orders.csv')
  }
  function resetAll() {
    api?.clearAllFilters()
    api?.clearSort()
    api?.clearRowSelection()
  }
</script>

<button onclick={addBlankRow}>+ Add row</button>
<button onclick={() => deleteSelected(selectedIds)}>Delete</button>
<button onclick={exportVisible}>Export CSV</button>
<button onclick={() => api?.undo()} disabled={!api?.canUndo()}>Undo</button>
<button onclick={resetAll}>Reset view</button>

<SvGrid {data} {columns} {features} enableInlineEditing onApiReady={(a) => (api = a)} />`,
  },
}

// ---------- Features ----------------------------------------------------

const featureSection: ApiSection = {
  id: 'tablefeatures',
  category: 'Features',
  title: 'tableFeatures()',
  blurb: 'Compose a feature set. The result is passed as the `features` prop.',
  demo: 'tablefeatures',
  intro: [
    'Features unlock behaviors and the corresponding row models. Pick only what you use - unused features tree-shake out of the bundle. Pass tableFeatures({}) for a read-only grid.',
  ],
  signature: `import {
  tableFeatures,
  rowSortingFeature,
  columnFilteringFeature,
  columnGroupingFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
} from '@svgrid/grid'

const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  rowSelectionFeature,
})`,
  props: [
    {
      name: 'columnFilteringFeature',
      type: 'Feature',
      description: 'Per-column filters (text, number, date, set). Drives the filter menu and filter row.',
      example: `const features = tableFeatures({ columnFilteringFeature })

<SvGrid {data} {columns} {features} filterMode="menu" />`,
    },
    {
      name: 'columnGroupingFeature',
      type: 'Feature',
      description: 'Row grouping by column id. Required for the Group by UI strip and the aggregation footer.',
      example: `const features = tableFeatures({ columnGroupingFeature })

<SvGrid {data} {columns} {features} showGroupingControls enableRowSummaries />`,
    },
    {
      name: 'rowExpandingFeature',
      type: 'Feature',
      description: 'Row expansion - both for master/detail and for tree mode.',
      example: `const features = tableFeatures({ rowExpandingFeature })`,
    },
    {
      name: 'rowPaginationFeature',
      type: 'Feature',
      description: 'Pagination. Drives the paginator footer and the paginated row model.',
      example: `const features = tableFeatures({ rowPaginationFeature })

<SvGrid {data} {columns} {features} showPagination pageSize={25} />`,
    },
    {
      name: 'rowSelectionFeature',
      type: 'Feature',
      description: 'Row selection. Drives the leading checkbox column and the rowSelection state.',
      example: `const features = tableFeatures({ rowSelectionFeature })

<SvGrid {data} {columns} {features} showRowSelection
  onRowSelectionChange={(_, rows) => selected = rows}
/>`,
    },
    {
      name: 'rowSortingFeature',
      type: 'Feature',
      description: 'Sortable columns. Click a header to cycle asc -> desc -> none; Shift-click for multi-column sort.',
      example: `const features = tableFeatures({ rowSortingFeature })`,
    },
  ],
}

// ---------- Headless core ----------------------------------------------

const createSvGridSection: ApiSection = {
  id: 'createsvgrid',
  category: 'Headless core',
  title: 'createSvGrid()',
  blurb: 'Create a reactive grid instance from options. The headless entry point.',
  intro: [
    'createSvGrid is the equivalent of useReactTable in TanStack Table. It takes options, attaches the requested row models, and returns a reactive object whose getter methods drive the DOM in your render layer.',
    'Use this when you need full control over the DOM - custom layouts, exotic virtualization, or rendering inside something other than a table (e.g. a tile grid).',
  ],
  signature: `import {
  createSvGrid,
  createCoreRowModel,
  createSortedRowModel,
  tableFeatures,
  rowSortingFeature,
} from '@svgrid/grid'

const features = tableFeatures({ rowSortingFeature })

const grid = createSvGrid({
  get data() { return rows },          // reactive getter
  get columns() { return columns },
  _features: features,
  _rowModels: {
    coreRowsFn: createCoreRowModel(),
    sortedRowsFn: createSortedRowModel(),
  },
})

$effect(() => {
  console.log(grid.getRowModel().rows.length)
})`,
  notes: [
    'Pass `data` and `columns` as reactive getters so the grid sees state changes. Plain references are snapshotted once.',
    'The order of row models matters: filter -> sort -> group -> paginate. Order them in `_rowModels` accordingly.',
    '`createGrid` and `createTable` are aliases of createSvGrid kept for naming symmetry / migration.',
  ],
}

const createGridStateSection: ApiSection = {
  id: 'creategridstate',
  category: 'Headless core',
  title: 'createGridState()',
  blurb: 'A standalone reactive state container, separable from the grid.',
  intro: [
    'In some apps you want grid state (selection, sort, filters) to live independently of the grid - so it survives unmount, or so two grids share state. createGridState gives you the same reactive store the grid uses internally. `createSvGridState` is an alias.',
  ],
  signature: `const state = createGridState({ rowSelection: {}, sorting: [] })

const grid = createSvGrid({
  get data() { return rows },
  get columns() { return columns },
  state,
})`,
}

const subscribeGridSection: ApiSection = {
  id: 'subscribegrid',
  category: 'Headless core',
  title: 'subscribeGrid()',
  blurb: 'Subscribe to grid updates outside of a Svelte component.',
  intro: [
    'Inside a Svelte component, $effect is the natural way to react to grid changes. Outside one (a Svelte action, an analytics hook, an integration test), use subscribeGrid for a plain pub/sub interface. `subscribeSvGrid` is an alias.',
  ],
  signature: `const unsub = subscribeGrid(grid, (event) => {
  if (event.type === 'sorting') analytics.track('grid_sort', event.value)
})

// cleanup
unsub()`,
}

// ---------- Row models -------------------------------------------------

const rowModelsSection: ApiSection = {
  id: 'row-models',
  category: 'Row models',
  title: 'Row models',
  blurb: 'Each row model is a factory you plug into createSvGrid options.',
  intro: [
    'Row models are pipeline stages that transform the input rows: filter narrows them, sort orders them, group bucketizes them, expand flattens the visible tree, paginate windows them. Each is a pure function - you control which run, and in what order, via `_rowModels`.',
    'For the render component (<SvGrid />), the row models are derived automatically from the `features` prop and the boolean show* props.',
  ],
  signature: `import {
  createCoreRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  createGroupedRowModel,
  createExpandedRowModel,
  createPaginatedRowModel,
} from '@svgrid/grid'

const grid = createSvGrid({
  // ...
  _rowModels: {
    coreRowsFn: createCoreRowModel(),
    filteredRowsFn: createFilteredRowModel(),
    sortedRowsFn: createSortedRowModel(),
    groupedRowsFn: createGroupedRowModel(),
    expandedRowsFn: createExpandedRowModel(),
    paginatedRowsFn: createPaginatedRowModel(),
  },
})`,
  props: [
    {
      name: 'createCoreRowModel()',
      type: '() => RowModelFactory',
      description: 'Identity row model. Always required. Returns the input data wrapped in Row objects.',
      example: `_rowModels: { coreRowsFn: createCoreRowModel() }`,
    },
    {
      name: 'createExpandedRowModel()',
      type: '() => RowModelFactory',
      description: 'Applies row expansion. Used for both tree mode and master/detail. Requires rowExpandingFeature.',
      example: `_rowModels: { expandedRowsFn: createExpandedRowModel() }`,
    },
    {
      name: 'createFilteredRowModel()',
      type: '() => RowModelFactory',
      description: 'Applies column filters and the global filter. Reads filter state from the grid state.',
      example: `_rowModels: {
  coreRowsFn: createCoreRowModel(),
  filteredRowsFn: createFilteredRowModel(),
}`,
    },
    {
      name: 'createGroupedRowModel()',
      type: '() => RowModelFactory',
      description: 'Applies row grouping. Inserts synthetic group rows in front of each bucket. Requires columnGroupingFeature.',
      example: `_rowModels: { groupedRowsFn: createGroupedRowModel() }`,
    },
    {
      name: 'createPaginatedRowModel()',
      type: '() => RowModelFactory',
      description: 'Applies pagination. Slices the final rowset by pageIndex and pageSize. Requires rowPaginationFeature.',
      example: `_rowModels: { paginatedRowsFn: createPaginatedRowModel() }`,
    },
    {
      name: 'createSortedRowModel()',
      type: '() => RowModelFactory',
      description: 'Applies sort. Multi-column sort respects the order of the sorting state entries.',
      example: `_rowModels: { sortedRowsFn: createSortedRowModel() }`,
    },
  ],
}

// ---------- Virtualization --------------------------------------------

const virtualizationSection: ApiSection = {
  id: 'virtualization',
  category: 'Virtualization',
  title: 'createVirtualizer / createSvelteVirtualizer / createColumnVirtualizer',
  blurb: 'Manual virtualization for custom layouts.',
  intro: [
    'When you use <SvGrid />, virtualization is automatic. For custom layouts on top of the headless core, the virtualizer factories expose the same engine.',
  ],
  signature: `import { createSvelteVirtualizer, createColumnVirtualizer } from '@svgrid/grid'

const rowVirtualizer = createSvelteVirtualizer({
  count: () => grid.getRowModel().rows.length,
  estimateSize: () => 36,
  getScrollElement: () => scrollEl,
  overscan: 8,
})

const columnVirtualizer = createColumnVirtualizer({
  count: () => leafColumns.length,
  estimateSize: (i) => leafColumns[i].getSize(),
  getScrollElement: () => scrollEl,
  overscan: 2,
  horizontal: true,
})`,
  props: [
    {
      name: 'createColumnVirtualizer',
      type: '(options) => Virtualizer',
      description: 'Column-axis virtualizer. Pass horizontal: true to opt into x-axis math.',
      example: `const v = createColumnVirtualizer({
  count: () => leafCols.length,
  estimateSize: (i) => leafCols[i].getSize(),
  getScrollElement: () => scrollEl,
  horizontal: true,
})`,
    },
    {
      name: 'createSvelteVirtualizer',
      type: '(options) => SvelteVirtualizer',
      description: 'Reactive Svelte-flavored virtualizer. Tracks getter dependencies via $effect.',
      example: `const v = createSvelteVirtualizer({
  count: () => grid.getRowModel().rows.length,
  estimateSize: () => 36,
  getScrollElement: () => scrollEl,
})`,
    },
    {
      name: 'createVirtualizer',
      type: '(options: VirtualizerOptions) => Virtualizer',
      description: 'Framework-agnostic virtualizer. Use inside non-Svelte custom layers.',
      example: `const v = createVirtualizer({
  count: rows.length,
  estimateSize: () => 36,
  getScrollElement: () => scrollEl,
})`,
    },
  ],
  notes: [
    'Types VirtualItem, VirtualizerOptions, and VirtualizerState are exported for annotation.',
  ],
}

// ---------- Accessibility ----------------------------------------------

const a11ySection: ApiSection = {
  id: 'accessibility',
  category: 'Accessibility',
  title: 'A11y helpers',
  blurb: 'Build accessible custom layouts on the headless core.',
  intro: [
    '<SvGrid /> emits the correct ARIA attributes automatically. When you roll your own layout, these helpers compute the same attributes so screen readers see a proper grid.',
  ],
  signature: `import {
  getGridRootA11yProps,
  getGridHeaderA11yProps,
  getGridCellA11yProps,
  getGridRowA11yProps,
  getGridCellDomId,
} from '@svgrid/grid'`,
  props: [
    {
      name: 'getGridCellA11yProps',
      type: '(input: GridCellA11yInput) => Record<string, string>',
      description: 'role="gridcell" + aria-rowindex + aria-colindex + id matching getGridCellDomId.',
      example: `<div {...getGridCellA11yProps({ rowIndex: r, columnIndex: c, columnId: 'name' })}>...</div>`,
    },
    {
      name: 'getGridCellDomId',
      type: '(input) => string',
      description: 'Deterministic DOM id for a cell. Use for focus management and tests.',
      example: `const id = getGridCellDomId('svgrid', 3, 'name')
document.getElementById(id)?.focus()`,
    },
    {
      name: 'getGridHeaderA11yProps',
      type: '(input) => Record<string, string>',
      description: 'role="columnheader" + aria-sort + aria-colindex.',
      example: `<div {...getGridHeaderA11yProps({ columnIndex: i, sortDirection: 'asc' })}>{label}</div>`,
    },
    {
      name: 'getGridRootA11yProps',
      type: '(input: { rowCount; columnCount }) => Record<string, string>',
      description: 'role="grid" + aria-rowcount + aria-colcount.',
      example: `<div {...getGridRootA11yProps({ rowCount: rows.length, columnCount: columns.length })}>`,
    },
    {
      name: 'getGridRowA11yProps',
      type: '(input) => Record<string, string>',
      description: 'role="row" + aria-rowindex + aria-selected.',
      example: `<div {...getGridRowA11yProps({ rowIndex: r, selected: isSelected })}>...</div>`,
    },
  ],
  notes: ['Input types GridCellA11yInput, GridColumnA11yInput, and GridSortDirection are exported for annotation.'],
}

// ---------- Utilities --------------------------------------------------

const utilsSection: ApiSection = {
  id: 'utilities',
  category: 'Utilities',
  title: 'Utilities',
  blurb: 'Smaller helpers exposed for advanced customization.',
  props: [
    {
      name: 'applyExcelFilter',
      type: '(value, filter: ExcelFilter) => boolean',
      description: 'Run a single Excel-style filter clause against a value. Useful when you build your own filter UI.',
      example: `const ok = applyExcelFilter(row.status, { operator: 'equals', value: 'shipped' })`,
    },
    {
      name: 'filterFns',
      type: '{ includesString; equals }',
      description: 'The built-in filter predicates the engine uses. Reference them when configuring a custom filtered row model.',
      example: `import { filterFns } from '@svgrid/grid'
const ok = filterFns.includesString(row.customer, 'acme')`,
    },
    {
      name: 'formatNumericWithConfig',
      type: '(value: number, config: CellFormatConfig) => string',
      description: 'Format a number per a CellFormatConfig. Handles currency, percent, and locale options.',
      example: `formatNumericWithConfig(1234.5, { type: 'currency', currency: 'USD' })
// "$1,234.50"`,
    },
    {
      name: 'getKeyboardIntent',
      type: '(event, state) => GridKeyboardIntent | null',
      description: 'Translate a keydown event into a grid intent (move-up, edit-start, select-extend, copy). Use in a custom keyboard handler.',
      example: `const intent = getKeyboardIntent(e, { editing: false, activeCell })
if (intent === 'move-down') focusNext()`,
    },
    {
      name: 'getNextActiveCell',
      type: '(intent, state) => ActiveCellState',
      description: 'Given an intent and the current active cell, compute the next active cell. Pure function.',
      example: `const next = getNextActiveCell('move-down', { rowIndex, colIndex, rowCount, colCount })`,
    },
    {
      name: 'normalizeEditorOptions',
      type: '(options) => CellEditorOption[]',
      description: 'Normalize the loose editorOptions shape (bare strings/numbers or objects) into uniform { value, label, color } objects.',
      example: `const opts = normalizeEditorOptions(['NA', { value: 'eu', label: 'EMEA' }])`,
    },
    {
      name: 'parseEditorValue',
      type: '(raw: string, editorType: CellEditorType) => unknown',
      description:
        'Parse a raw input string into the typed value an inline editor expects. Returns NaN / Invalid Date when unparseable - validate before commit.',
      example: `const parsed = parseEditorValue('1,234.56', 'number')   // 1234.56
const date   = parseEditorValue('2024-03-15', 'date')   // Date`,
    },
    {
      name: 'resolveDatePattern',
      type: '(pattern: string) => Intl.DateTimeFormatOptions',
      description: 'Resolve a pattern shorthand (e.g. "y-m-d") into an Intl options object.',
      example: `const opts = resolveDatePattern('y-m-d')
new Intl.DateTimeFormat('en-US', opts).format(new Date())`,
    },
    {
      name: 'sortFns',
      type: '{ auto; number; date }',
      description: 'The built-in comparator set (locale-aware string, numeric, date). Used by the sorted row model.',
      example: `import { sortFns } from '@svgrid/grid'
rows.sort((a, b) => sortFns.number(a.total, b.total))`,
    },
  ],
}

// =======================================================================
// Enterprise - packages/enterprise
// =======================================================================
// The Enterprise package augments the community grid with Excel/PDF export,
// printing, file import, pivot tables, AI helpers, and staged editing.
// You opt in by wrapping the community api with installEnterprise(api).

const proOverviewSection: ApiSection = {
  id: 'enterprise-overview',
  category: 'Enterprise',
  title: 'installEnterprise / EnterpriseGridApi',
  blurb: 'Augment the community api with export, print, import, pivot, and AI.',
  intro: [
    '@svgrid/enterprise is a thin, opt-in layer on top of @svgrid/grid. You keep the same <SvGrid /> component; you just wrap the api object from onApiReady with installEnterprise() to unlock the enterprise methods.',
    'installEnterprise mutates and returns the same api object, so existing references keep working. Every Enterprise method is license soft-gated: unlicensed evaluation works fully but shows a small watermark and emits a one-time console nudge. Revoked or malformed keys throw on first use.',
  ],
  signature: `import { SvGrid } from '@svgrid/grid'
import { installEnterprise, setLicenseKey, type EnterpriseGridApi } from '@svgrid/enterprise'

setLicenseKey(import.meta.env.VITE_SVGRID_LICENSE)   // once, at startup

let api = $state<EnterpriseGridApi<typeof features, Order> | null>(null)

<SvGrid {data} {columns} {features}
  onApiReady={(base) => (api = installEnterprise(base))}
/>

// Now the Enterprise methods are available alongside the core api:
await api.exportData({ format: 'xlsx', filename: 'orders' })
await api.print()
const result = await api.importData({ file, format: 'auto' })
const summary = await api.ai.summarize({ target: 'view' })
const { rows, columns } = api.pivot.build(pivotConfig)`,
  props: [
    {
      name: 'api.ai',
      type: 'EnterpriseAIApi<TData>',
      description: 'Namespace of AI helpers: filter, smartFill, summarize, classify. All route through a consumer-registered AIProvider. See the AI section.',
      example: `const plan = await api.ai.filter('cancelled orders over $1k last quarter')`,
    },
    {
      name: 'api.exportData(opts)',
      type: '(opts: ExportOptions<TData>) => Promise<void>',
      description: 'Export the current visible rows (or supplied rows) to xlsx / pdf / csv / tsv / html. See the Export section.',
      example: `await api.exportData({ format: 'xlsx', filename: 'orders' })`,
    },
    {
      name: 'api.importData(opts)',
      type: '(opts: ImportOptions<TData>) => Promise<ImportResult<TData>>',
      description: 'Read an Excel / CSV / TSV / JSON file (or inline text) into typed rows, with per-cell validation. See the Import section.',
      example: `const result = await api.importData({ file, format: 'auto' })`,
    },
    {
      name: 'api.pivot',
      type: 'EnterprisePivotApi<TFeatures, TData>',
      description: 'Pure pivot-model builder. build(config) returns { rows, columns } you feed to a second <SvGrid>. See the Pivot section.',
      example: `const { rows, columns } = api.pivot.build({ rows: ['region'], cols: ['status'], values: [...] })`,
    },
    {
      name: 'api.print(opts?)',
      type: '(opts?: PrintOptions<TData>) => Promise<void>',
      description: 'Open a print-ready view of the current visible rows in a new window. See the Print section.',
      example: `await api.print({ title: 'Q3 Orders', orientation: 'landscape' })`,
    },
    {
      name: 'installEnterprise(api)',
      type: '(api: SvGridApi<TF, TData>) => EnterpriseGridApi<TF, TData>',
      description:
        'Wrap a community api to add the Enterprise methods. Returns the same (mutated) object. Call it once inside onApiReady.',
      example: `onApiReady={(base) => (api = installEnterprise(base))}`,
    },
  ],
  notes: [
    'installEnterprise does not change the rendered grid - it only adds methods to the api object. The watermark (when unlicensed) is injected next to the grid at install time.',
    'EnterpriseGridApi extends SvGridApi, so every community method (addRow, setFilter, getDisplayedRows, undo, ...) is still there.',
  ],
}

const licenseSection: ApiSection = {
  id: 'enterprise-license',
  category: 'Enterprise',
  title: 'Licensing',
  blurb: 'Set and query the Enterprise license key. Evaluation works unlicensed.',
  intro: [
    'Enterprise is honor-system licensed. All features run without a key so you can evaluate end to end; an unlicensed grid just shows a small watermark and logs a one-time nudge. Set a valid key to remove both. Revoked or malformed keys throw on the first Enterprise call.',
  ],
  signature: `import {
  setLicenseKey, clearLicenseKey, getLicenseKey,
  isLicenseKeySet, hasValidLicense, assertEnterpriseLicensed,
} from '@svgrid/enterprise'

// Once, as early as possible (before the first Enterprise call):
setLicenseKey('SVG-XXXX-XXXX-XXXX-XXXX')`,
  props: [
    {
      name: 'assertEnterpriseLicensed()',
      type: '() => void',
      description: 'Throws when the key is revoked / malformed; no-op when valid or merely unset (evaluation mode). Called internally by every Enterprise method.',
      example: `assertEnterpriseLicensed()   // guard a custom Enterprise-only code path`,
    },
    {
      name: 'clearLicenseKey()',
      type: '() => void',
      description: 'Forget the registered key (e.g. on logout).',
      example: `clearLicenseKey()`,
    },
    {
      name: 'dismissUnlicensedNudge()',
      type: '() => void',
      description: 'Suppress the one-time unlicensed console nudge / watermark for the rest of the session (e.g. in internal tooling).',
      example: `import { dismissUnlicensedNudge } from '@svgrid/enterprise'
dismissUnlicensedNudge()`,
    },
    {
      name: 'getLicenseKey()',
      type: '() => string | null',
      description: 'Return the currently registered key, or null.',
      example: `if (!getLicenseKey()) console.warn('running unlicensed')`,
    },
    {
      name: 'hasValidLicense()',
      type: '() => boolean',
      description: 'True when the registered key passes validation and is not revoked.',
      example: `featureFlags.proBadge = hasValidLicense()`,
    },
    {
      name: 'isLicenseKeySet()',
      type: '() => boolean',
      description: 'True when any key has been registered (does not validate it).',
      example: `const showBuyCta = !isLicenseKeySet()`,
    },
    {
      name: 'setLicenseKey(key)',
      type: '(key: string) => void',
      description: 'Register the license key for the session. Call once at startup, before any Enterprise method runs.',
      example: `setLicenseKey(import.meta.env.VITE_SVGRID_LICENSE)`,
    },
  ],
}

const exportSection: ApiSection = {
  id: 'enterprise-export',
  category: 'Enterprise',
  title: 'Export',
  blurb: 'Export rows to Excel, PDF, CSV, TSV, or HTML - styled, multi-sheet, with headers/footers.',
  demo: 'enterprise-export',
  intro: [
    'exportGrid(api, opts) (or api.exportData(opts) after installEnterprise) writes the current displayed rows to a file and triggers the browser download. By default it exports the filtered/sorted view; pass rows explicitly to export the full dataset instead.',
    'xlsx and pdf honour the styles, header, and footer options; csv/tsv ignore styling; html bakes styles into inline attributes. Multi-sheet output is xlsx-only.',
  ],
  signature: `import { exportGrid, type ExportOptions } from '@svgrid/enterprise'

type ExportFormat = 'xlsx' | 'pdf' | 'csv' | 'tsv' | 'html'

await exportGrid(api, {
  format: 'xlsx',
  filename: 'orders',
  columns: [{ field: 'id', header: 'Order ID' }, { field: 'total', header: 'Total' }],
  styles: {
    headerRow: { fontWeight: 'bold', backgroundColor: '#0a1124', color: '#fff' },
    rowAlternate: { backgroundColor: '#f5f7fb' },
  },
  header: [{ image: logoDataUrl, width: 120 }, { text: 'Q3 Orders' }],
  footer: [{ right: 'Page {page} of {pages}' }],
})`,
  props: [
    {
      name: 'columns',
      type: 'ReadonlyArray<{ field: string; header?: string }>',
      description: 'Columns (and order) to include. When omitted, the grid\'s visible columns are used, falling back to every key of the first row.',
      example: `columns: [
  { field: 'id', header: 'Order ID' },
  { field: 'total', header: 'Total (USD)' },
]`,
    },
    {
      name: 'filename',
      type: 'string',
      default: '"grid"',
      description: 'Base filename; the extension is appended automatically.',
      example: `await api.exportData({ format: 'pdf', filename: 'q3-orders' })`,
    },
    {
      name: 'format',
      type: "'xlsx' | 'pdf' | 'csv' | 'tsv' | 'html'",
      required: true,
      description: 'Output format. xlsx/pdf support styles + header/footer; csv/tsv are plain; html is a styled standalone table.',
      example: `<script lang="ts">
  import { SvGrid, tableFeatures, type ColumnDef, type SvGridApi } from '@svgrid/grid'
  import { installEnterprise } from '@svgrid/enterprise'

  type Row = { id: number; customer: string; total: number }
  const features = tableFeatures({})

  let rows = $state<Row[]>([{ id: 1, customer: 'Acme Corp', total: 1240 }])
  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'customer', header: 'Customer', width: 180 },
    { field: 'total',    header: 'Total',    width: 120 },
  ]

  // installEnterprise(api) adds exportData / importData / print onto the api.
  let api = $state<SvGridApi<typeof features, Row> | null>(null)

  async function exportXlsx() {
    await api?.exportData({ format: 'xlsx', fileName: 'orders.xlsx' })
  }
</script>

<button onclick={exportXlsx}>Export to Excel</button>
<SvGrid data={rows} columns={columns} features={features}
  onApiReady={(next) => (api = installEnterprise(next))} />`,
    },
    {
      name: 'header / footer',
      type: 'ReadonlyArray<ExportHeaderFooterLine>',
      description: 'Page header / footer lines (xlsx, pdf, html). Each line is { text, style? }, { image, width?, height? }, or { left?, center?, right? }. Logos go in via { image: dataUrl }.',
      example: `header: [{ image: logoDataUrl, width: 120 }, { text: 'Quarterly report' }],
footer: [{ left: 'Confidential', right: 'Page {page}' }],`,
    },
    {
      name: 'imageFields / imageSize',
      type: 'ReadonlyArray<string> / { width; height }',
      description: 'Fields whose URL / data-URL values are embedded as images in xlsx. imageSize sets the embedded pixel size (default 32x32).',
      example: `await api.exportData({
  format: 'xlsx', imageFields: ['avatar'], imageSize: { width: 48, height: 48 },
})`,
    },
    {
      name: 'pageOrientation',
      type: "'portrait' | 'landscape'",
      default: '"portrait"',
      description: 'PDF only. Page orientation.',
      example: `await api.exportData({ format: 'pdf', pageOrientation: 'landscape' })`,
    },
    {
      name: 'rows',
      type: 'ReadonlyArray<TData>',
      description: 'Rows to export. Defaults to the api\'s displayed (filtered + sorted) rows. Pass api.getData() to export everything.',
      example: `await api.exportData({ format: 'xlsx', rows: api.getData() })`,
    },
    {
      name: 'sheets',
      type: 'ReadonlyArray<ExportSheet<TData>>',
      description: 'Multi-sheet workbook (xlsx only). Each entry { label, rows, columns?, styles? } becomes one tab; the top-level rows/columns are ignored.',
      example: `await api.exportData({
  format: 'xlsx', filename: 'book',
  sheets: [
    { label: 'NA',   rows: na },
    { label: 'EMEA', rows: emea },
  ],
})`,
    },
    {
      name: 'styles',
      type: 'ExportStyles',
      description: 'Document styling: headerRow, rows, rowAlternate (zebra), and per-cell overrides keyed by Excel reference ("A1", "C3"). Each is an ExportCellStyle (color, backgroundColor, fontWeight, border, textAlign, ...).',
      example: `styles: {
  headerRow: { fontWeight: 'bold', backgroundColor: '#1f2937', color: '#fff' },
  rowAlternate: { backgroundColor: '#f3f4f6' },
  cells: { D2: { color: '#dc2626', fontWeight: 'bold' } },
}`,
    },
  ],
  notes: [
    'Export runs only in a browser - it dynamically imports the spreadsheet/PDF writer, so it adds nothing to your initial bundle.',
    'The default source is the visible result set (post filter + sort). For "export everything", pass rows: api.getData().',
  ],
}

const printSection: ApiSection = {
  id: 'enterprise-print',
  category: 'Enterprise',
  title: 'Print',
  blurb: 'Open a clean, print-ready view of the current rows in a new window.',
  intro: [
    'printGrid(api, opts) (or api.print(opts)) renders the displayed rows into a minimal print document and invokes the browser print dialog. Orientation is hinted via @page so the browser sizes the paper correctly.',
  ],
  signature: `import { printGrid, type PrintOptions } from '@svgrid/enterprise'

await printGrid(api, {
  title: 'Q3 Orders',
  orientation: 'landscape',
  columns: [{ field: 'id', header: 'Order ID' }, { field: 'total', header: 'Total' }],
})`,
  props: [
    {
      name: 'columns',
      type: 'ReadonlyArray<{ field: string; header?: string }>',
      description: 'Columns to print. Defaults to every key of the first row.',
      example: `await api.print({ columns: [{ field: 'sku', header: 'SKU' }] })`,
    },
    {
      name: 'orientation',
      type: "'portrait' | 'landscape'",
      default: '"portrait"',
      description: 'Print orientation hint, honoured by the browser via @page { size }.',
      example: `await api.print({ orientation: 'landscape' })`,
    },
    {
      name: 'rows',
      type: 'ReadonlyArray<TData>',
      description: 'Rows to print. Defaults to the api\'s displayed rows.',
      example: `await api.print({ rows: selectedRows })`,
    },
    {
      name: 'title',
      type: 'string',
      default: '"Grid"',
      description: 'Heading placed above the printed table.',
      example: `await api.print({ title: 'Daily manifest' })`,
    },
  ],
}

const importSection: ApiSection = {
  id: 'enterprise-import',
  category: 'Enterprise',
  title: 'Import',
  blurb: 'Read Excel / CSV / TSV / JSON into typed, validated rows.',
  intro: [
    'importData(api, opts) (or api.importData(opts)) parses a File/Blob or inline text into typed rows with per-cell validation, then either returns a preview (default) or commits straight into the grid. Use the preview to render an editing modal so users can fix issues before they land.',
    'Format is sniffed from the file extension (or the text payload) when format is "auto". columnMap renames/drops source headers; columnTypes adds strict per-field coercion; validator adds row-level business rules.',
  ],
  signature: `import { importData, type ImportResult } from '@svgrid/enterprise'

// Preview, then commit if clean:
const result = await api.importData({
  file,                     // File | Blob | string (inline text)
  format: 'auto',           // 'xlsx' | 'csv' | 'tsv' | 'json' | 'auto'
  columnMap: { 'Order #': 'id', 'Amount': 'total' },
  columnTypes: { total: 'number', placedAt: 'date' },
  validator: (row) =>
    row.total < 0 ? [{ field: 'total', message: 'must be >= 0' }] : [],
})

if (result.errors.length === 0) api.addRows(result.rows, 'bottom')`,
  props: [
    {
      name: 'columnMap',
      type: 'Record<string, string>',
      description: 'Map source header -> target field. Missing entries fall back to the lowercased/trimmed source header; map a header to drop it.',
      example: `columnMap: { 'Customer Name': 'customer', 'Order Total': 'total' }`,
    },
    {
      name: 'columnTypes',
      type: "Record<string, 'string'|'number'|'integer'|'boolean'|'date'|'datetime'|'json'>",
      description: 'Declared field types. Enables strict coercion ("$1,234" -> 1234; "2024-03-15" -> ISO date) and emits an ImportRowError when a value can\'t be coerced.',
      example: `columnTypes: { total: 'number', shipped: 'boolean', placedAt: 'date' }`,
    },
    {
      name: 'commit / commitAt',
      type: "boolean / 'top' | 'bottom' | number",
      description: 'When commit is true, parsed rows are appended via api.addRows automatically (no preview). commitAt sets the insert position (default "bottom").',
      example: `await api.importData({ file, format: 'auto', commit: true, commitAt: 'top' })`,
    },
    {
      name: 'file',
      type: 'File | Blob | string',
      required: true,
      description: 'The source. A File/Blob (xlsx or text) or an inline CSV/TSV/JSON string.',
      example: `<script lang="ts">
  import { SvGrid, tableFeatures, type ColumnDef, type SvGridApi } from '@svgrid/grid'
  import { installEnterprise } from '@svgrid/enterprise'

  type Row = { id: number; customer: string; total: number }
  const features = tableFeatures({})

  let rows = $state<Row[]>([])
  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'customer', header: 'Customer', width: 180 },
    { field: 'total',    header: 'Total',    width: 120, editorType: 'number' },
  ]
  let api = $state<SvGridApi<typeof features, Row> | null>(null)

  async function onFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0]
    if (!file) return
    // \`file\` can be a File/Blob (xlsx or text) or an inline CSV/TSV/JSON string.
    // format 'auto' sniffs xlsx vs csv/tsv/json.
    await api?.importData({ file, format: 'auto' })
  }
</script>

<input type="file" accept=".xlsx,.csv,.tsv,.json" onchange={onFile} />
<SvGrid data={rows} columns={columns} features={features}
  onApiReady={(next) => (api = installEnterprise(next))} />`,
    },
    {
      name: 'format',
      type: "'xlsx' | 'csv' | 'tsv' | 'json' | 'auto'",
      default: '"auto"',
      description: 'Source format. "auto" sniffs from file.name extension (Files) or the first characters of inline text.',
      example: `await api.importData({ file: csvText, format: 'csv' })`,
    },
    {
      name: 'ImportResult<TData>',
      type: '{ headers; rows; errors; skipped; total; format }',
      description: 'The returned preview: source headers, parsed rows, all validation errors, count of blank rows skipped, total source rows seen, and the resolved format.',
      example: `const { rows, errors, total } = await api.importData({ file })
status = \`\${rows.length}/\${total} parsed, \${errors.length} errors\``,
    },
    {
      name: 'validator',
      type: '(row: TData, rowIndex: number) => Array<{ field; message }>',
      description: 'Per-row business validation. Returned errors land in result.errors alongside type-coercion errors.',
      example: `validator: (row) =>
  row.qty > 0 ? [] : [{ field: 'qty', message: 'must be positive' }]`,
    },
  ],
  notes: [
    'xlsx parsing lazily loads jszip - it is never in your initial bundle.',
    'Preview mode (the default) never mutates the grid; you choose when to call addRows.',
  ],
}

const pivotSection: ApiSection = {
  id: 'enterprise-pivot',
  category: 'Enterprise',
  title: 'Pivot tables',
  blurb: 'Build a pivot row/column model from grid data - pure, no DOM.',
  demo: 'enterprise-pivot',
  intro: [
    'createPivotModel(data, config) (or api.pivot.build(config)) reduces a flat dataset into a cross-tab of row groups x column groups x measures. It is pure: it returns { rows, columns } that you hand to a second <SvGrid /> instance, leaving the source grid untouched.',
    'Configure the row axis, column axis, and one or more value measures. Each measure uses a built-in aggregator (sum, avg, min, max, count, countDistinct, first, last) or a custom reducer.',
  ],
  signature: `import { createPivotModel, pivotAggregators, type PivotConfig } from '@svgrid/enterprise'

const { rows, columns } = createPivotModel(orders, {
  rows: ['region'],            // row-axis grouping (outer-most first)
  cols: ['status'],            // column-axis grouping
  values: [
    { field: 'total', agg: 'sum', label: 'Revenue',
      format: { type: 'currency', currency: 'USD' } },
    { field: 'id', agg: 'count', label: 'Orders' },
  ],
  grandTotalRow: true,
  rowSubtotals: true,
})

<SvGrid data={rows} columns={columns} features={tableFeatures({})} />`,
  props: [
    {
      name: 'cols',
      type: 'ReadonlyArray<keyof TData & string>',
      required: true,
      description: 'Column-axis grouping fields, outer-most first. Each distinct value becomes a column (or column group).',
      example: `import { createPivotModel } from '@svgrid/enterprise'

type Sale = { region: string; status: string; total: number }
const facts: Sale[] = [
  { region: 'AMER', status: 'paid', total: 1200 },
  { region: 'EMEA', status: 'open', total:  800 },
]

const model = createPivotModel(facts, {
  rows: ['region'],
  cols: ['status'],   // <- column-axis grouping: each distinct value becomes a column (this prop)
  values: [{ field: 'total', agg: 'sum', format: { type: 'currency', currency: 'USD' } }],
})`,
    },
    {
      name: 'filterCollapsedPivotRows(rows, collapsed)',
      type: '(rows: PivotRow[], collapsed: Set<string>) => PivotRow[]',
      description: 'Helper to hide the descendants of collapsed pivot group rows, for an expand/collapse UX. Keyed by __pivotId.',
      example: `const visible = filterCollapsedPivotRows(pivot.rows, collapsedIds)`,
    },
    {
      name: 'grandTotalRow / grandTotalCol',
      type: 'boolean',
      default: 'true',
      description: 'Add a grand-total row at the bottom and/or a grand-total column on the right.',
      example: `createPivotModel(data, { rows, cols, values, grandTotalCol: false })`,
    },
    {
      name: 'pivotAggregators',
      type: 'Record<PivotAggregatorId, PivotAggregator>',
      description: 'The built-in aggregator table: sum, avg, min, max, count, countDistinct, first, last. Reference one directly for a custom pipeline.',
      example: `import { pivotAggregators } from '@svgrid/enterprise'
const total = pivotAggregators.sum(values)`,
    },
    {
      name: 'rows',
      type: 'ReadonlyArray<keyof TData & string>',
      required: true,
      description: 'Row-axis grouping fields, outer-most first. Each becomes one level of row grouping (with subtotals when enabled).',
      example: `import { createPivotModel } from '@svgrid/enterprise'

type Sale = { region: string; customer: string; quarter: string; total: number }
const facts: Sale[] = [
  { region: 'AMER', customer: 'Acme',   quarter: 'Q1', total: 1200 },
  { region: 'EMEA', customer: 'Globex', quarter: 'Q1', total:  800 },
  { region: 'AMER', customer: 'Acme',   quarter: 'Q2', total: 1500 },
]

const model = createPivotModel(facts, {
  rows: ['region', 'customer'],   // <- nested row grouping (this prop)
  cols: ['quarter'],
  values: [{ field: 'total', agg: 'sum', format: { type: 'currency', currency: 'USD' } }],
})
// Feed model.rows + model.columns into a second, read-only <SvGrid>.`,
    },
    {
      name: 'rowSort / colSort',
      type: '(a, b, level: number) => number',
      description: 'Custom comparators for row-axis / column-axis values per dimension level. Default is alphabetical.',
      example: `colSort: (a, b) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b)`,
    },
    {
      name: 'rowSubtotals',
      type: 'boolean',
      default: 'true',
      description: 'Insert subtotal rows between row groups.',
      example: `createPivotModel(data, { rows, cols, values, rowSubtotals: false })`,
    },
    {
      name: 'values',
      type: 'ReadonlyArray<PivotValueConfig<TData>>',
      required: true,
      description: 'Measures aggregated under each column leaf. Each is { field, agg, label?, format? } where agg is a PivotAggregatorId or a custom (values) => unknown reducer.',
      example: `import { createPivotModel } from '@svgrid/enterprise'

type Sale = { region: string; quarter: string; total: number; margin: number }
const facts: Sale[] = [
  { region: 'AMER', quarter: 'Q1', total: 1200, margin: 0.32 },
  { region: 'EMEA', quarter: 'Q1', total:  800, margin: 0.28 },
]

const model = createPivotModel(facts, {
  rows: ['region'],
  cols: ['quarter'],
  values: [   // <- measures aggregated under each column leaf (this prop)
    { field: 'total',  agg: 'sum', format: { type: 'currency', currency: 'USD' } },
    { field: 'margin', agg: 'avg', label: 'Avg margin', format: { type: 'percent' } },
  ],
})`,
    },
  ],
  notes: [
    'createPivotModel is pure and synchronous - safe to call in a $derived. Each PivotRow carries __pivotId / __pivotKind / __pivotDepth metadata plus the aggregated value cells keyed by column id.',
    'The typical pattern is two grids: the source grid for raw data, and a second read-only <SvGrid> fed the pivot { rows, columns }.',
  ],
}

const aiSection: ApiSection = {
  id: 'enterprise-ai',
  category: 'Enterprise',
  title: 'AI helpers',
  blurb: 'Natural-language filtering, smart fill, summarize, and classify - provider-agnostic.',
  intro: [
    'The Enterprise AI helpers turn grid tasks into model calls: natural-language to filter+sort, fill blank cells from examples, summarize a selection, or classify free-text into known labels. No model client is bundled - you register a single AIProvider function and the grid routes every request through it, so you control the model, transport, keys, and cost.',
    'Each helper builds the prompt (column schema + sampled rows), calls your provider, parses the response, and returns a typed result. Most can optionally apply themselves to the grid.',
  ],
  signature: `import { setAIProvider, type AIRequest } from '@svgrid/enterprise'

// Register once. Wire it to any model - here, the Anthropic Messages API.
setAIProvider(async (req: AIRequest): Promise<string> => {
  const res = await fetch('/api/ai', {
    method: 'POST',
    body: JSON.stringify({ prompt: req.prompt, json: req.responseFormat === 'json' }),
    signal: req.signal,
  })
  return (await res.json()).text   // return the model's raw string
})

// Then, anywhere you hold a EnterpriseGridApi:
const plan = await api.ai.filter('cancelled orders over $1k in Q3', { apply: true })`,
  props: [
    {
      name: 'api.ai.classify(opts)',
      type: '(opts: AIClassifyOptions) => Promise<AIClassifyResult>',
      description: 'Classify a free-text column into one of a fixed set of classes, writing into outputField. Returns predictions [{ rowIndex, value, confidence }].',
      example: `const res = await api.ai.classify({
  inputField: 'feedback',
  outputField: 'sentiment',
  classes: ['positive', 'neutral', 'negative'],
  classDescriptions: { negative: 'complaints, churn risk, anger' },
})`,
    },
    {
      name: 'api.ai.filter(query, opts?)',
      type: '(query: string, opts?: { apply?: boolean; signal? }) => Promise<AIFilterResult>',
      description: 'Translate a natural-language query into a filter + sort plan. Returns { filters, sort, rationale }. With apply: true it also calls setFilter / setSort for you.',
      example: `const { filters, sort, rationale } = await api.ai.filter(
  'top 10 EMEA customers by revenue this year',
)
showPreview(rationale)`,
    },
    {
      name: 'api.ai.smartFill(opts)',
      type: '(opts: AISmartFillOptions) => Promise<AISmartFillResult>',
      description: 'Propose values for blank cells in one field from a few worked examples. targetRowIndices defaults to every empty cell in the field; examples (>=1) teach the pattern.',
      example: `const fill = await api.ai.smartFill({
  field: 'category',
  examples: [
    { input: { name: 'USB-C cable' }, value: 'Accessories' },
    { input: { name: 'iPhone 15' },   value: 'Phones' },
  ],
})`,
    },
    {
      name: 'api.ai.summarize(opts)',
      type: '(opts: { target: AISummarizeTarget; question?; signal? }) => Promise<AISummary>',
      description: 'Summarize a row, the current selection, a group, or the whole view. Returns { text, bullets, highlightedFields }. An optional question biases the summary.',
      example: `const summary = await api.ai.summarize({
  target: 'selection',
  question: 'Why did margin drop?',
})`,
    },
    {
      name: 'mockAIProvider',
      type: 'AIProvider',
      description: 'A deterministic offline provider for tests / demos - returns canned, schema-valid responses without a network call.',
      example: `import { mockAIProvider, setAIProvider } from '@svgrid/enterprise'
setAIProvider(mockAIProvider)`,
    },
    {
      name: 'setAIProvider(fn) / getAIProvider() / hasAIProvider()',
      type: '(fn: AIProvider) => void / () => AIProvider | null / () => boolean',
      description: 'Register / read / test the single provider function `(req: AIRequest) => Promise<string>`. AIRequest carries { prompt, responseFormat, signal, task, maxOutputTokens }; return the model\'s raw text.',
      example: `setAIProvider(myProvider)
if (!hasAIProvider()) disableAiButtons()`,
    },
  ],
  notes: [
    'You own the model call. The provider receives a fully built prompt and must return the raw model text; the grid handles prompt construction and response parsing.',
    'Set responseFormat is passed as "json" for structured tasks - ask your model for strict JSON so the grid can parse it.',
    'Every helper accepts an AbortSignal for cancellation.',
  ],
}

const stagedEditingSection: ApiSection = {
  id: 'enterprise-staged-editing',
  category: 'Enterprise',
  title: 'Staged editing',
  blurb: 'Buffer inline edits, show a dirty-state, then commit or revert as a batch.',
  demo: 'enterprise-staged-editing',
  intro: [
    'createStagedEditing() is a small, dependency-free buffer for "review before save" workflows. Feed it the grid\'s onCellValueChange events; it tracks each change with its original and staged values so you can show a dirty indicator, list pending edits, then commit them to a server in one transaction or roll them all back.',
  ],
  signature: `import { createStagedEditing } from '@svgrid/enterprise'

const staging = createStagedEditing<Order>()

<SvGrid bind:data {columns} {features} enableInlineEditing
  onCellValueChange={(e) => staging.record(e)}
/>

<button disabled={!staging.isDirty()} onclick={save}>
  Save {staging.size()} change(s)
</button>

async function save() {
  await staging.commit(async (changes) => {
    await fetch('/api/bulk', { method: 'PATCH', body: JSON.stringify(changes) })
  })   // buffer clears on success; throw to keep it for retry
}`,
  props: [
    {
      name: 'changes()',
      type: '() => StagedChange<TData>[]',
      description: 'Snapshot of every pending change, ordered by first edit. Each StagedChange has { rowId, rowIndex, columnId, original, staged, recordedAt, originalRow? }.',
      example: `for (const c of staging.changes())
  console.log(c.columnId, c.original, '->', c.staged)`,
    },
    {
      name: 'changesByRow()',
      type: '() => Array<{ rowId; rowIndex; cells: StagedChange[] }>',
      description: 'Pending changes grouped by row - one entry per touched row. Handy for row-level (optimistic-locking) commits.',
      example: `const dirtyRows = staging.changesByRow().length`,
    },
    {
      name: 'commit(commitFn)',
      type: '(commitFn: (changes) => Promise<void> | void) => Promise<void>',
      description: 'Hand all staged changes to commitFn. On resolve, the buffer clears; throw / reject to keep the buffer so the user can retry.',
      example: `await staging.commit((changes) => api.persist(changes))`,
    },
    {
      name: 'drop(rowId, columnId) / clear()',
      type: '(rowId, columnId) => void / () => void',
      description: 'drop discards one staged cell without applying it; clear wipes the whole buffer without applying anything.',
      example: `staging.drop('order-7', 'total')
staging.clear()`,
    },
    {
      name: 'isDirty() / size()',
      type: '() => boolean / () => number',
      description: 'isDirty is true when at least one cell is staged; size is the count of distinct (row, column) pairs.',
      example: `<span>{staging.isDirty() ? \`\${staging.size()} unsaved\` : 'All saved'}</span>`,
    },
    {
      name: 'record(event)',
      type: '(e: StagedEditingEvent) => void',
      description: 'Feed a grid onCellValueChange event into the buffer. Re-editing the same cell keeps the original value stable.',
      example: `onCellValueChange={(e) => staging.record(e)}`,
    },
    {
      name: 'revert(applyRevert)',
      type: '(applyRevert: (rowIndex, columnId, originalValue) => void) => void',
      description: 'Roll back every staged cell. Wire applyRevert to api.setCellValue to push the originals back into the grid.',
      example: `staging.revert((rowIndex, columnId, original) =>
  api.setCellValue(rowIndex, columnId, original))`,
    },
  ],
  notes: [
    'Staged editing is pure state management - it never touches the grid or the DOM. You wire record() in and commit/revert out.',
    'Pair revert() with api.setCellValue to visually undo, or just clear() if the grid data is about to be re-fetched anyway.',
  ],
}

// =======================================================================
// MCP server - packages/mcp
// =======================================================================

const mcpSection: ApiSection = {
  id: 'mcp-server',
  category: 'Tooling',
  title: 'MCP server (@svgrid/mcp)',
  blurb: 'Give AI assistants accurate, version-pinned SvGrid knowledge over MCP.',
  intro: [
    '@svgrid/mcp is a Model Context Protocol server that exposes the example sources, docs, and this API reference to MCP-capable clients (Claude Desktop, Claude Code, Cursor). Point a model at it and it answers from the real, version-pinned surface instead of hallucinating APIs or citing stale posts.',
    'It speaks MCP over stdio - stdout carries JSON-RPC, logs go to stderr. Run it with npx, no install required.',
  ],
  signature: `# One-shot, no install
npx @svgrid/mcp

# Claude Desktop / Claude Code config (claude_desktop_config.json):
{
  "mcpServers": {
    "sv-grid": { "command": "npx", "args": ["@svgrid/mcp"] }
  }
}`,
  props: [
    {
      name: 'get_api_reference',
      type: 'tool',
      description: 'Return the curated public-API surface, grouped by category - the same data behind this page.',
      example: `get_api_reference() -> { categories: [...] }`,
    },
    {
      name: 'get_doc',
      type: 'tool({ slug })',
      description: 'Return the markdown for one doc page by slug.',
      example: `get_doc({ slug: 'help/columns/column-definitions' })`,
    },
    {
      name: 'get_example_source',
      type: 'tool({ id })',
      description: 'Return the full .svelte source for a demo by id.',
      example: `get_example_source({ id: '11-stock-market' })`,
    },
    {
      name: 'list_docs',
      type: 'tool',
      description: 'List every documentation page as { slug, title }.',
      example: `list_docs() -> [{ slug: 'getting-started', title }, ...]`,
    },
    {
      name: 'list_examples',
      type: 'tool',
      description: 'List every demo id, title, and blurb.',
      example: `// model calls list_examples -> [{ id: '11-stock-market', title, blurb }, ...]`,
    },
    {
      name: 'search_docs',
      type: 'tool({ query, limit? })',
      description: 'Case-insensitive substring search across all docs. limit defaults to 10.',
      example: `search_docs({ query: 'row virtualization', limit: 5 })`,
    },
  ],
  notes: [
    'Because the data is bundled with the published package, answers are pinned to the version of @svgrid/mcp the client runs.',
  ],
}

// ---------- Charts -----------------------------------------------------

const chartApiSection: ApiSection = {
  id: 'chart-api',
  category: 'Charts',
  title: 'rowsToChartSpec / buildChart / niceScale',
  blurb: 'Build the ChartSpec that <SvGridChart /> renders - from grid rows, or by hand.',
  intro: [
    'A ChartSpec is the data model behind every chart: a default type, category labels, and one or more series. rowsToChartSpec() aggregates raw rows into a spec; buildChart() turns a spec into pure geometry (useful for tests or a custom renderer); niceScale() rounds an axis domain to friendly tick boundaries.',
  ],
  signature: `import { rowsToChartSpec, SvGridChart } from '@svgrid/grid'

const spec = rowsToChartSpec(orders, {
  type: 'bar', category: 'region', value: 'total',
  series: 'status',   // pivot: one series per status
  reduce: 'sum', stacked: true, topN: 8,
})

<SvGridChart {spec} />`,
  props: [
    {
      name: 'buildChart(spec)',
      type: '(spec: ChartSpec) => ChartGeometry',
      description: 'Compute laid-out geometry (bars, line paths, slices, axis ticks) from a spec. <SvGridChart /> calls this internally; call it directly for a custom renderer or snapshot tests.',
      example: `const geo = buildChart(spec) // { bars, lines, slices, xTicks, yTicks, ... }`,
    },
    {
      name: 'ChartSpec',
      type: 'type',
      description: 'The chart model: { type, categories, series, width?, height?, palette?, stacked?, stacked100?, orientation?, innerRadius?, referenceLines?, xType?, yAxisTitle?, ... }.',
    },
    {
      name: 'DEFAULT_PALETTE',
      type: 'string[]',
      description: 'The 8-color default series palette, used when a series has no explicit color.',
      example: `import { DEFAULT_PALETTE } from '@svgrid/grid'`,
    },
    {
      name: 'niceScale(min, max, tickCount?)',
      type: '(min, max, tickCount = 4) => NiceScale',
      description: 'Round a [min, max] domain out to nice tick boundaries. Returns { min, max, step, ticks }.',
      example: `niceScale(0, 9300) // -> { min: 0, max: 10000, step: 2500, ticks: [0,2500,...] }`,
    },
    {
      name: 'rowsToChartSpec(rows, opts)',
      type: '(rows, opts) => ChartSpec',
      description: 'Aggregate rows into a ChartSpec. opts: { type, category, value (one field or many), series?, reduce?: "sum"|"avg"|"count", stacked?, stacked100?, sort?, topN?, otherLabel?, width?, height?, palette? }.',
      example: `rowsToChartSpec(sales, { type: 'line', category: 'month', value: 'revenue', series: 'product' })`,
    },
  ],
  notes: ['Render a ChartSpec with the <SvGridChart /> component. See its section for the visual, interactive props.'],
}

const chartExportSection: ApiSection = {
  id: 'chart-export',
  category: 'Charts',
  title: 'Chart export (SVG / PNG)',
  blurb: 'Serialize or download a rendered chart as a standalone SVG or rasterized PNG.',
  intro: [
    'These take the chart\'s rendered DOM (the <svg>, or a wrapping element) and produce a self-styled SVG string or a PNG. Styling that lives in CSS variables is inlined, so the exported file looks the same outside the app.',
  ],
  signature: `import { downloadChartPng } from '@svgrid/grid'

let chartEl: HTMLElement   // bind:this on the chart wrapper

<div bind:this={chartEl}><SvGridChart {spec} /></div>
<button onclick={() => downloadChartPng(chartEl, 'revenue.png')}>Download PNG</button>`,
  props: [
    {
      name: 'ChartExportOptions',
      type: '{ background?: string; scale?: number }',
      description: 'background overrides the fill (defaults to --sg-bg); scale is the PNG pixel multiplier.',
    },
    {
      name: 'chartToPngBlob(source, options?)',
      type: '(source, options?) => Promise<Blob>',
      description: 'Rasterize the chart to a PNG Blob. options.scale controls pixel density (default 2 = retina).',
      example: `const blob = await chartToPngBlob(chartEl, { scale: 3 })`,
    },
    {
      name: 'chartToSvgString(source, options?)',
      type: '(source: SVGSVGElement | HTMLElement, options?) => string',
      description: 'Serialize the chart to a standalone, self-styled SVG string (CSS-variable colors inlined, hit layers stripped).',
      example: `const svg = chartToSvgString(chartEl, { background: '#fff' })`,
    },
    {
      name: 'downloadChartPng(source, filename?, options?)',
      type: '(source, filename = "chart.png", options?) => Promise<void>',
      description: 'Rasterize and trigger a browser download of the .png file.',
      example: `await downloadChartPng(chartEl, 'revenue.png', { background: '#0a1124' })`,
    },
    {
      name: 'downloadChartSvg(source, filename?, options?)',
      type: '(source, filename = "chart.svg", options?) => void',
      description: 'Serialize and trigger a browser download of the .svg file.',
      example: `downloadChartSvg(chartEl, 'q3-revenue.svg')`,
    },
  ],
}

const sparklineSection: ApiSection = {
  id: 'sparkline',
  category: 'Charts',
  title: 'buildSparkline / toSparklineValues',
  blurb: 'Compute the geometry for an in-cell sparkline (line, area, bar, win/loss).',
  intro: [
    'Sparklines are headless: buildSparkline() returns paths + bar rects sized to your width/height, and you render the tiny SVG inside a cell snippet. toSparklineValues() coerces loose cell values (arrays or comma/space strings) into a clean number array first.',
  ],
  signature: `import { buildSparkline, toSparklineValues, renderSnippet } from '@svgrid/grid'

{ field: 'history', header: 'Trend',
  cell: (ctx) => renderSnippet(Spark, { values: toSparklineValues(ctx.getValue()) }) }`,
  props: [
    {
      name: 'buildSparkline(values, cfg?)',
      type: '(values: number[], cfg?: SparklineConfig) => SparklineGeometry | null',
      description: 'Lay out the sparkline. Returns { linePath, areaPath, bars, lastPoint, width, height, ... } to render as SVG, or null for empty input.',
      example: `const geo = buildSparkline(values, { type: 'area', width: 96, height: 24 })`,
    },
    {
      name: 'SparklineConfig',
      type: 'type',
      description: '{ type?: "line"|"area"|"bar"|"winloss"; color?; negativeColor?; width?; height?; min?; max?; lineWidth?; lastPoint? }.',
    },
    {
      name: 'toSparklineValues(value)',
      type: '(value: unknown) => number[]',
      description: 'Coerce an array, or a comma/space-separated string, into a finite number array. Drops non-numeric entries.',
      example: `toSparklineValues('3, 5, 2, 8') // -> [3, 5, 2, 8]`,
    },
  ],
  notes: ['buildSparkline returns geometry only - you draw the <svg> (a <path d={geo.linePath} /> plus an end dot, or {#each geo.bars}). See the interactive example above.'],
  demo: 'sparkline',
}

// ---------- Data & state -----------------------------------------------

const serverDataSourceSection: ApiSection = {
  id: 'server-data-source',
  category: 'Data & state',
  title: 'createServerDataSource()',
  blurb: 'A controller for server-side data: it turns sort / filter / page changes into one debounced, race-safe fetch.',
  intro: [
    'You implement a single getRows(request) that talks to your backend; createServerDataSource() owns the paging/sort/filter state, calls getRows, and pushes the result back through onChange. A monotonic request id guarantees a slow response for an old query can never clobber a newer one.',
  ],
  signature: `import { createServerDataSource } from '@svgrid/grid'

const controller = createServerDataSource(
  { getRows: async (req) => {
      const res = await fetch('/api/orders?' + toQuery(req))
      return res.json() // { rows, rowCount }
    } },
  { pageSize: 50, onChange: (state) => (view = state) },
)`,
  props: [
    {
      name: 'controller.refresh / getState / dispose',
      type: '() => void | ServerState<TData>',
      description: 'refresh() re-fetches the current page (e.g. after a mutation); getState() reads the latest snapshot; dispose() ignores in-flight responses on unmount.',
      example: `onDestroy(() => controller.dispose())`,
    },
    {
      name: 'controller.setSort / setFilter / setPage / setPageSize',
      type: '(model) => void',
      description: 'Push a new sort model, filter model, page index, or page size; each triggers a fresh fetch.',
      example: `controller.setSort([{ id: 'total', desc: true }])`,
    },
    {
      name: 'options',
      type: '{ pageSize?: number; onChange: (state: ServerState<TData>) => void }',
      description: 'onChange fires whenever rows / total / loading / page change - wire it to your component state.',
    },
    {
      name: 'source.getRows(request)',
      type: '(request: ServerRequest) => Promise<ServerResult<TData>>',
      description: 'Your fetcher. ServerRequest carries { startRow, endRow, pageIndex, pageSize, sortModel, filterModel }; return { rows, rowCount }.',
    },
  ],
}

const namedViewsSection: ApiSection = {
  id: 'named-views',
  category: 'Data & state',
  title: 'createNamedViews()',
  blurb: 'Save and restore named snapshots of grid state (sort, filters, columns, ...).',
  intro: [
    'A view manager over any host that exposes getState() / setState() - the SvGridApi satisfies it directly. Persist views in memory (default) or localStorage, or implement your own ViewStorage.',
  ],
  signature: `import { createNamedViews, localStorageViews } from '@svgrid/grid'

const views = createNamedViews(api, { storage: localStorageViews('orders-views') })
views.save('EMEA at risk')   // capture current state
views.load('EMEA at risk')   // re-apply it`,
  props: [
    {
      name: 'createNamedViews(host, options?)',
      type: '(host: ViewStateHost, options?: { storage?: ViewStorage }) => NamedViews',
      description: 'host is anything with getState()/setState() (SvGridApi qualifies). Defaults to in-memory storage.',
    },
    {
      name: 'memoryViews(initial?) / localStorageViews(key)',
      type: '() => ViewStorage',
      description: 'Built-in ViewStorage implementations. localStorageViews is SSR-safe (no-ops without localStorage). Implement { read(), write(views) } for a server-backed store.',
      example: `localStorageViews('grid:orders:views')`,
    },
    {
      name: 'NamedViews',
      type: 'API',
      description: 'list() · save(name) · load(name) · remove(name) · rename(from, to) · has(name). save() overwrites a duplicate name; load()/remove()/rename() return false for unknown names.',
      example: `views.list().map((v) => v.name)`,
    },
  ],
}

const collaborationSection: ApiSection = {
  id: 'collaboration',
  category: 'Data & state',
  title: 'createCollaboration()',
  blurb: 'Multi-user presence + live edit broadcast over a pluggable transport.',
  intro: [
    'Share cursor positions and cell edits between users. createCollaboration() is transport-agnostic: ship the built-in broadcastChannelTransport() for cross-tab demos, or implement CollabTransport over your own WebSocket / WebRTC channel.',
  ],
  signature: `import { createCollaboration, broadcastChannelTransport } from '@svgrid/grid'

const collab = createCollaboration({
  user: { id, name: 'Ada', color: '#22c55e' },
  transport: broadcastChannelTransport('orders-room'),
  onPeersChange: (peers) => (cursors = peers),
  onRemoteEdit: ({ rowId, columnId, value }) => applyEdit(rowId, columnId, value),
})`,
  props: [
    {
      name: 'broadcastChannelTransport(name)',
      type: '(name: string) => CollabTransport',
      description: 'Built-in transport over BroadcastChannel - live across tabs of the same browser, no backend. No-ops where BroadcastChannel is unavailable.',
    },
    {
      name: 'Collaboration',
      type: 'API',
      description: 'setCell(cell | null) broadcasts your cursor · sendEdit(rowId, columnId, value) broadcasts an edit · peers() lists present users (self excluded) · dispose() leaves the room.',
      example: `collab.sendEdit(row.id, 'status', 'shipped')`,
    },
    {
      name: 'CollabTransport',
      type: '{ post(msg); subscribe(handler): () => void }',
      description: 'Implement this over any channel (WebSocket, WebRTC, Supabase Realtime, ...) to collaborate across machines.',
    },
    {
      name: 'createCollaboration(options)',
      type: '(options: CollaborationOptions) => Collaboration',
      description: 'options: { user, transport, onPeersChange?, onRemoteEdit?, peerTimeoutMs? (default 15000) }.',
    },
  ],
}

// ---------- Conditional formatting / filters / editors -----------------

const conditionalFormattingSection: ApiSection = {
  id: 'conditional-formatting',
  category: 'Utilities',
  title: 'Conditional formatting',
  blurb: 'Resolve color scales, data bars, icon sets, and rule styles for a cell.',
  intro: [
    'The primitives behind conditional formatting. computeColumnStat() finds a column\'s numeric range once per render; resolveCellFormat() turns your format specs into a concrete { background, color, dataBar, icon, ... } for one cell. lerpColor() and contrastText() are the color helpers they use, exported for your own renderers.',
  ],
  signature: `import { computeColumnStat, resolveCellFormat } from '@svgrid/grid'

const stat = computeColumnStat(rows.map((r) => r.score))
const fmt = resolveCellFormat(value, row, 'score', [
  { type: 'colorScale', min: '#fee', max: '#c2410c' },
], stat)`,
  props: [
    {
      name: 'computeColumnStat(values)',
      type: '(values: Iterable<unknown>) => { min, max } | null',
      description: 'Compute a column\'s numeric min/max once, then pass it to resolveCellFormat for color scales and data bars.',
    },
    {
      name: 'ConditionalFormat',
      type: 'type',
      description: 'A spec plus optional `columns`. Variants: colorScale (2/3-stop gradient), dataBar (in-cell bar), iconSet ("arrows"|"traffic"|"triangles"), rule (when(ctx) => boolean + styles).',
      example: `{ type: 'dataBar', color: '#3b82f6', columns: ['revenue'] }`,
    },
    {
      name: 'lerpColor(a, b, t) / contrastText(bg)',
      type: '(a, b, t) => string · (bg) => string | null',
      description: 'lerpColor interpolates two hex colors (t in 0..1); contrastText returns black or white for legible text on bg.',
      example: `lerpColor('#fee2e2', '#16a34a', 0.5)`,
    },
    {
      name: 'resolveCellFormat(value, row, columnId, formats, stat)',
      type: '(...) => ResolvedCellFormat',
      description: 'Apply the matching ConditionalFormat specs to one cell. Returns { background?, color?, fontWeight?, dataBar?, icon?, iconOnly? } to spread onto the cell.',
      example: `const { background, color } = resolveCellFormat(v, row, 'total', formats, stat)`,
    },
  ],
}

const excelFilterSection: ApiSection = {
  id: 'excel-filters',
  category: 'Utilities',
  title: 'applyExcelFilter / normalizeForFilter',
  blurb: 'The operator-based, locale-aware text/number filter primitives.',
  intro: [
    'applyExcelFilter() evaluates one ExcelFilter against a cell value; normalizeForFilter() is the accent- and case-folding pass it uses (NFD decompose, strip diacritics, locale-aware lowercase) so "cafe" matches "Café".',
  ],
  props: [
    {
      name: 'applyExcelFilter(cellValue, filter, options?)',
      type: '(cellValue, filter: ExcelFilter, options?: ExcelFilterOptions) => boolean',
      description: 'Test a value against a filter. ExcelFilter is { id, operator, value?, valueTo? }.',
      example: `applyExcelFilter(row.city, { id: 'city', operator: 'contains', value: 'cafe' }, { locale: 'fr' })`,
    },
    {
      name: 'ExcelFilterOperator',
      type: 'type',
      description: '"contains" | "equals" | "startsWith" | "greaterThan" | "lessThan" | "between" | "isBlank".',
    },
    {
      name: 'normalizeForFilter(s, locale?)',
      type: '(s: string, locale?: string | string[]) => string',
      description: 'Diacritic-stripping, locale-aware lowercasing used for accent-insensitive matching.',
      example: `normalizeForFilter('Tōkyō') // -> 'tokyo'`,
    },
  ],
}

const editorHelpersSection: ApiSection = {
  id: 'editor-helpers',
  category: 'Utilities',
  title: 'parseEditorValue / normalizeEditorOptions',
  blurb: 'Coerce an edited value to its typed result, and normalize editor option lists.',
  intro: [
    'When you build a custom editor, these match the built-in behavior: parseEditorValue() converts the raw input to the right runtime type for the editor; normalizeEditorOptions() turns a loose options list (strings, numbers, or objects) into uniform { value, label, color } entries for list/chips/select editors.',
  ],
  props: [
    {
      name: 'CellEditorType',
      type: 'type',
      description: '"text" | "number" | "date" | "datetime" | "time" | "password" | "checkbox" | "list" | "chips" | "select" | "rich-select" | "textarea" | "color" | "rating".',
    },
    {
      name: 'normalizeEditorOptions(options)',
      type: '(options) => CellEditorOption[]',
      description: 'Normalize ["a", { value: 2, label: "Two" }] into [{ value, label, color? }] for list/chips/select editors.',
      example: `normalizeEditorOptions(['low', 'high']) // -> [{ value: 'low', label: 'low' }, ...]`,
    },
    {
      name: 'parseEditorValue(type, value, opts?)',
      type: '(type: CellEditorType, value: unknown, opts?: { multiple?: boolean }) => unknown',
      description: 'Coerce a raw editor value: number -> number|null, checkbox -> boolean, list/chips -> array when opts.multiple, etc.',
      example: `parseEditorValue('number', '42') // -> 42`,
    },
  ],
}

// ---------- Combined export -------------------------------------------

export const sections: ApiSection[] = [
  svgridComponent,
  eventsSection,
  flexRenderSection,
  renderHelpersSection,
  svgridChartSection,
  columnDefSection,
  cellFormatSection,
  filterOperatorSection,
  coreTypesSection,
  imperativeApiSection,
  createSvGridSection,
  createGridStateSection,
  subscribeGridSection,
  rowModelsSection,
  featureSection,
  virtualizationSection,
  a11ySection,
  utilsSection,
  conditionalFormattingSection,
  excelFilterSection,
  editorHelpersSection,
  // Charts
  chartApiSection,
  chartExportSection,
  sparklineSection,
  // Data & state
  serverDataSourceSection,
  namedViewsSection,
  collaborationSection,
  // Enterprise
  proOverviewSection,
  licenseSection,
  exportSection,
  printSection,
  importSection,
  pivotSection,
  aiSection,
  stagedEditingSection,
  // Tooling
  mcpSection,
]

// Sidebar ordering: list the categories in a stable, intentional order
// rather than first-seen order, so related groups sit together.
const CATEGORY_ORDER = [
  'Components',
  'Events',
  'Types',
  'Imperative API',
  'Features',
  'Headless core',
  'Row models',
  'Virtualization',
  'Accessibility',
  'Utilities',
  'Charts',
  'Data & state',
  'Enterprise',
  'Tooling',
]

export const sectionGroups: { category: string; items: ApiSection[] }[] = (() => {
  const groups = new Map<string, ApiSection[]>()
  for (const s of sections) {
    if (!groups.has(s.category)) groups.set(s.category, [])
    groups.get(s.category)!.push(s)
  }
  const ordered = Array.from(groups.keys()).sort(
    (a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b),
  )
  return ordered.map((category) => ({ category, items: groups.get(category)! }))
})()

export function findSection(id: string | null | undefined): ApiSection {
  if (!id) return sections[0]!
  return sections.find((s) => s.id === id) ?? sections[0]!
}

/** Heading used above the props table, by category. */
export function memberHeading(category: string): string {
  switch (category) {
    case 'Imperative API':
      return 'Methods'
    case 'Events':
      return 'Events'
    case 'Enterprise':
    case 'Tooling':
      return 'Members'
    case 'Row models':
    case 'Features':
      return 'Members'
    case 'Utilities':
    case 'Virtualization':
    case 'Accessibility':
    case 'Charts':
    case 'Data & state':
      return 'Functions'
    default:
      return 'Properties'
  }
}

/**
 * Sub-grouping for the two large sections so their long member lists read as
 * labeled clusters instead of one flat alphabetical run. The Api page renders a
 * subheader per group (members alpha-sorted within each); any member not listed
 * here falls into a trailing "Other" group. Match is by the member's base name
 * (the method name before its "(", and the first of a "a() / b()" pair), so the
 * imperative-api entries below use bare method names.
 */
export const MEMBER_GROUPS: Record<string, { label: string; members: string[] }[]> = {
  'svgrid-component': [
    { label: 'Data', members: ['data', 'columns', 'features', 'getRowId', 'inferColumnTypes', 'loading', 'error', 'emptyMessage'] },
    { label: 'Capability shortcuts', members: ['sortable', 'filterable', 'editable', 'groupable', 'pageable'] },
    { label: 'Columns', members: ['columnMenuTabs', 'columnOrder', 'columnWidth', 'enableColumnReorder', 'fitColumns', 'initialColumnPinning', 'toolPanel', 'toolPanelDefaultOpen', 'toolPanelDefaultTab'] },
    { label: 'Rows & cells', members: ['rowHeight', 'headerHeight', 'rowNumberWidth', 'showRowNumbers', 'pinnedTopRows', 'pinnedBottomRows', 'isDetailRow', 'renderDetailRow', 'rowClass', 'conditionalFormats', 'contextMenu', 'notes', 'rowDragManaged', 'rowDragGroup'] },
    { label: 'Selection & clipboard', members: ['selectionMode', 'showRowSelection', 'enableCellSelection', 'copyHeadersToClipboard', 'processCellForClipboard'] },
    { label: 'Editing', members: ['enableInlineEditing', 'fullRowEditing', 'editableComments'] },
    { label: 'Filtering & search', members: ['filterMode', 'showGlobalFilter', 'showColumnFilters', 'showFilterMenu', 'showFilterRow', 'filterLocale', 'externalFilter'] },
    { label: 'Sorting, grouping & summaries', members: ['showGroupingControls', 'externalSort', 'enableRowSummaries'] },
    { label: 'Pagination', members: ['showPagination', 'pageSize'] },
    { label: 'Styling & layout', members: ['zebraRows', 'containerHeight', 'alignedGridGroup', 'statusBar', 'loadingOverlay', 'loadingSkeletonRows'] },
    { label: 'Virtualization', members: ['virtualization', 'overscan', 'columnVirtualization', 'columnOverscan'] },
  ],
  'imperative-api': [
    { label: 'Cell values & editing', members: ['getCellValue', 'setCellValue', 'startEditing', 'stopEditing'] },
    { label: 'Rows', members: ['addRow', 'addRows', 'removeRow', 'removeRows', 'applyTransaction'] },
    { label: 'Selection', members: ['selectCells', 'getSelected', 'selectRows', 'selectAllRows', 'getSelectedRows', 'clearRowSelection'] },
    { label: 'Sorting & grouping', members: ['setSort', 'clearSort', 'setGroupBy', 'setRowExpanded', 'expandAllGroups', 'collapseAllGroups'] },
    { label: 'Filtering & find', members: ['setFilter', 'setFacetFilter', 'clearFilter', 'clearAllFilters', 'getFilters', 'openFind', 'setFindQuery', 'getFindHits'] },
    { label: 'Columns', members: ['addColumn', 'addColumns', 'removeColumn', 'setColumnVisible', 'isColumnVisible', 'getColumns', 'setColumnWidth', 'getColumnWidths', 'autosizeColumn', 'autosizeAllColumns', 'setColumnPinning', 'getColumnPinning', 'setColumnOrder'] },
    { label: 'History', members: ['undo', 'redo', 'canUndo', 'canRedo', 'clearHistory'] },
    { label: 'Pagination', members: ['getPageInfo', 'setPage', 'setPageSize'] },
    { label: 'Navigation & scroll', members: ['scrollToRow', 'getActiveCell'] },
    { label: 'Data & state', members: ['getData', 'getDisplayedRows', 'getState', 'refresh'] },
  ],
  events: [
    { label: 'Selection', members: ['onRowSelectionChange', 'onCellSelectionChange', 'onActiveCellChange'] },
    { label: 'Editing', members: ['onCellValueChange', 'onNoteChange'] },
    { label: 'Sorting & filtering', members: ['onSortingChange', 'onFiltersChange'] },
    { label: 'Interaction', members: ['onCellClick', 'onCellDoubleClick'] },
    { label: 'Columns & rows', members: ['onColumnOrderChange', 'onRowDragEnd'] },
    { label: 'Lifecycle', members: ['onApiReady', 'onScrollBottomReached'] },
  ],
}

/**
 * Per-group "related links": the docs guide and the gallery demo most relevant
 * to a group of members. The Api page shows these as small Docs / Demo links on
 * each member row, connecting the dry reference to prose help + a runnable demo.
 * Keyed by `${sectionId}::${groupLabel}`. `docs` is a docs route slug
 * (-> /docs/<slug>); `demo` is a gallery demo id (-> /demos/<id>).
 */
export const GROUP_LINKS: Record<string, { docs?: string; demo?: string }> = {
  'svgrid-component::Data': { docs: 'help/rows/row-data', demo: '01-quick-start' },
  'svgrid-component::Capability shortcuts': { demo: '135-shortcut-config' },
  'svgrid-component::Columns': { docs: 'help/columns/column-definitions', demo: '54-columns-hierarchy' },
  'svgrid-component::Rows & cells': { docs: 'help/rows/row-data', demo: '107-pinned-rows' },
  'svgrid-component::Selection & clipboard': { demo: '04-selection-copy-paste' },
  'svgrid-component::Editing': { docs: 'help/editing/overview', demo: '05-inline-editing' },
  'svgrid-component::Filtering & search': { docs: 'help/filtering/overview', demo: '03-excel-filters' },
  'svgrid-component::Sorting, grouping & summaries': { docs: 'help/grouping-aggregation', demo: '07-grouping-aggregation' },
  'svgrid-component::Pagination': { docs: 'help/rows/row-pagination', demo: '02-sort-filter-paginate' },
  'svgrid-component::Styling & layout': { docs: 'help/tokens', demo: '37-theming-studio' },
  'svgrid-component::Virtualization': { demo: '06-large-dataset' },

  'imperative-api::Cell values & editing': { docs: 'help/editing/overview', demo: '05-inline-editing' },
  'imperative-api::Rows': { docs: 'help/rows/transactions', demo: '145-transaction-api' },
  'imperative-api::Selection': { demo: '90-selection-api' },
  'imperative-api::Sorting & grouping': { docs: 'help/grouping-aggregation', demo: '07-grouping-aggregation' },
  'imperative-api::Filtering & find': { docs: 'help/filtering/filter-api', demo: '87-find-in-grid' },
  'imperative-api::Columns': { docs: 'help/columns/column-state', demo: '63-column-layout-api' },
  'imperative-api::History': { docs: 'help/editing/undo-redo', demo: '86-undo-redo' },
  'imperative-api::Pagination': { docs: 'help/rows/row-pagination', demo: '113-cursor-pagination' },
  'imperative-api::Data & state': { docs: 'help/state-maintenance', demo: '55-state-maintenance' },

  'events::Selection': { demo: '90-selection-api' },
  'events::Editing': { docs: 'help/editing/saving-values', demo: '24-validation' },
  'events::Sorting & filtering': { docs: 'help/filtering/filter-api' },
  'events::Interaction': { demo: '67-context-menu' },
  'events::Columns & rows': { docs: 'help/rows/row-dragging', demo: '105-row-reorder' },
}
