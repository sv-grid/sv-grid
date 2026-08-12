<script lang="ts">
  /**
   * 01. Quick start
   * ---------------
   * A realistic small grid you'd actually surface in an admin tool.
   * Wires up:
   *   - a row-number column ("#")
   *   - sortable headers
   *   - per-column filter row + the column menu's operator picker
   *   - row checkboxes for multi-row selection
   *   - cell range selection (click+drag, Shift+arrows)
   *   - inline editing (double-click or F2 on any cell)
   *   - column resize (drag the right edge of any header)
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import { makeOrders, type Order } from '../shared/seed'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
  })

  let rows = $state<Order[]>(makeOrders(25))
  let api = $state<SvGridApi<typeof features, Order> | null>(null)

  // Columns: the leading "#" column comes from the grid's built-in
  // showRowNumbers prop, so we don't need to declare an `index` column here.
  // Widths are sized to keep the total under a typical sidebar+padding
  // viewport so the grid doesn't need a horizontal scrollbar.
  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'company', header: 'Company',  editorType: 'text', width: 140 },
    { field: 'product', header: 'Name',     editorType: 'text', width: 170 },
    {
      field: 'sellDate',
      header: 'Sell date',
      editorType: 'date',
      width: 110,
      hideBelow: 640,
      format: { type: 'date', pattern: 'y-m-d' },
    },
    {
      field: 'inStock',
      header: 'In stock',
      editorType: 'checkbox',
      width: 90,
      hideBelow: 640,
    },
    {
      field: 'quantity',
      header: 'Quantity',
      editorType: 'number',
      width: 90,
      format: { type: 'number', options: { maximumFractionDigits: 0 } },
    },
    { field: 'orderId', header: 'Order ID', editorType: 'text', width: 130, hideBelow: 640 },
    { field: 'country', header: 'Country',  editorType: 'text', width: 130, hideBelow: 640 },
    {
      field: 'price',
      header: 'Price',
      editorType: 'number',
      width: 100,
      format: { type: 'currency', currency: 'USD' },
    },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="text-sm shrink-0" style="color: var(--sg-muted);">
    {rows.length} rows · {columns.length} columns ·
    sort, filter, select, edit, and resize columns are all live.
    Double-click a cell or press <kbd>F2</kbd> to edit.
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="both"
      showRowSelection={true}
      showRowNumbers={true}
      showPagination={false}
      showGroupingControls={false}
      enableInlineEditing={true}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
      responsive={true}
      onApiReady={(next) => (api = next)}
    />
  </div>

  <footer class="text-sm shrink-0" style="color: var(--sg-muted);">
    Rows: {rows.length}
  </footer>
</section>
