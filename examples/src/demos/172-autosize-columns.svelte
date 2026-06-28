<script lang="ts">
  /**
   * 172. Autosize columns
   * ----------------------
   * The grid ships built-in autosize: every column's header menu has an
   * "Autosize" item, and `api.autosizeColumn(id)` /
   * `api.autosizeAllColumns()` drive it programmatically. Both walk the
   * rendered cells in the column, measure the widest text via canvas,
   * and snap the column width to fit.
   *
   * Try it: open any column's header menu (the 3-dot button) and pick
   * "Autosize". Or hit the "Autosize every column" button below.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Row = { sku: string; product: string; vendor: string; tags: string; price: number }
  const PRODUCTS = [
    'Industrial-grade CNC titanium hex bolt M8x40 (graded 12.9)',
    'Stainless steel ball bearing 6203-2RS (sealed)',
    'High-torque servo driver MX-28T 12V',
    'Composite carbon-fiber side panel, glossy black, 240x180mm',
    'Precision optical encoder 2048 PPR with index pulse',
    'Aluminum heat sink 60x40x20 with thermal interface pad',
    'Linear actuator 200mm stroke, 12V, 100N rated load',
    'Brushless DC motor 24V 200W with Hall sensors',
  ]
  const VENDORS = [
    'Northwind Industrial',
    'Pacific Components',
    'Cascade Robotics & Motion',
    'Vanguard Materials Group',
    'Helios Sensor Systems',
    'Polaris Precision Tools',
  ]
  const TAGS = [
    'in-stock · ROHS',
    'lead-time 2w',
    'preferred vendor · ISO 9001',
    'limited stock',
    'discontinued (substitute available)',
  ]
  let rows = $state<Row[]>(Array.from({ length: 40 }, (_, i) => ({
    sku: `SKU-${10_000 + i}`,
    product: PRODUCTS[i % PRODUCTS.length]!,
    vendor: VENDORS[i % VENDORS.length]!,
    tags: TAGS[i % TAGS.length]!,
    price: Math.round(20 + ((i * 173) % 800)),
  })))

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  // Start with cramped widths so the demo of autosize is obvious.
  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'sku',     header: 'SKU',     width: 90,  editorType: 'text' },
    { field: 'product', header: 'Product', width: 110, editorType: 'text' },
    { field: 'vendor',  header: 'Vendor',  width: 110, editorType: 'list', editorOptions: VENDORS },
    { field: 'tags',    header: 'Tags',    width: 110, editorType: 'list', editorOptions: TAGS },
    { field: 'price',   header: 'Price',   width: 90, align: 'right', editorType: 'number',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
  ]

  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  function autosizeAll() {
    api?.autosizeAllColumns()
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <header>
    <h2 class="text-base font-semibold">Autosize columns</h2>
    <p class="text-xs mt-1" style="color: var(--sg-muted);">
      Open the 3-dot header menu on any column and pick <em>Autosize</em>, or hit the button
      below to run <code>api.autosizeAllColumns()</code>. The grid walks the rendered cells,
      canvas-measures the widest text, and snaps the column to fit. Drag still resizes manually.
    </p>
    <div class="mt-2">
      <button class="az-btn" onclick={autosizeAll}>Autosize every column</button>
    </div>
  </header>

  <div class="az-wrap">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      sortable
      filterable
      selectionMode="cell"
      showRowSelection={false}
      showColumnFilters={false}
      showPagination={false}
      enableInlineEditing={true}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={30}
      containerHeight="100%"
      fitColumns={false}
      onApiReady={(next) => (api = next)}
    />
  </div>
</section>

<style>
  .az-wrap {
    flex: 1; min-height: 0;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    overflow: hidden;
  }
  .az-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-accent, #2563eb);
    color: white;
    padding: 5px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .az-btn:hover { filter: brightness(1.08); }
</style>
