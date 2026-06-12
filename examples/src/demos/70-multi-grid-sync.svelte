<script lang="ts">
  /**
   * 70. Multi-grid sync - shared $state
   * ----------------------------------
   * Two grids over a single Svelte 5 `$state` array. Edit a cell in
   * either - the other re-renders immediately because both grids read
   * the same reactive reference.
   *
   * No grid-to-grid wiring is needed; this is the natural Svelte
   * pattern. The demo also shows that filter / sort state is per-grid
   * (each grid's view is independent) while the data they project is
   * shared.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
  } from 'sv-grid-community'

  type Inventory = {
    id: string
    sku: string
    product: string
    warehouse: 'East' | 'West' | 'Central'
    qty: number
    reorder: number
  }

  let rows = $state<Inventory[]>([
    { id: 'i01', sku: 'A-100', product: 'Steel sheet 1/2"', warehouse: 'East',    qty: 240, reorder: 100 },
    { id: 'i02', sku: 'A-101', product: 'Steel sheet 3/4"', warehouse: 'West',    qty:  80, reorder: 100 },
    { id: 'i03', sku: 'B-200', product: 'Stainless rivets', warehouse: 'East',    qty: 6800, reorder: 1000 },
    { id: 'i04', sku: 'B-201', product: 'Brass rivets',     warehouse: 'Central', qty: 1200, reorder: 1500 },
    { id: 'i05', sku: 'C-300', product: 'Drill bit set',    warehouse: 'West',    qty:  44, reorder:  20 },
    { id: 'i06', sku: 'C-301', product: 'Impact driver',    warehouse: 'Central', qty:  12, reorder:  10 },
    { id: 'i07', sku: 'D-400', product: 'Wire rope 1/4"',   warehouse: 'East',    qty:  60, reorder: 100 },
    { id: 'i08', sku: 'D-401', product: 'Wire rope 3/8"',   warehouse: 'West',    qty: 180, reorder: 100 },
  ])

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  const columns: ColumnDef<typeof features, Inventory>[] = [
    { field: 'sku',       header: 'SKU',       editorType: 'text',   width: 100 },
    { field: 'product',   header: 'Product',   editorType: 'text',   width: 180 },
    { field: 'warehouse', header: 'Warehouse', editorType: 'list',
      editorOptions: ['East', 'West', 'Central'],
      width: 140,
    },
    { field: 'qty',       header: 'Qty',       editorType: 'number', width: 100 },
    { field: 'reorder',   header: 'Reorder pt',editorType: 'number', width: 130 },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <p class="text-sm text-slate-500 dark:text-slate-400 shrink-0">
    Both grids read from the same <code>$state</code> array. Edit any
    <code>Qty</code> or <code>Warehouse</code> on the left - the right
    grid updates instantly. Each grid keeps its OWN filter + sort.
  </p>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
    <div class="flex flex-col gap-2 min-h-0">
      <div class="text-sm font-medium text-slate-700 dark:text-slate-200">
        Operations view <span class="text-slate-500 dark:text-slate-400 font-normal">- editable</span>
      </div>
      <div class="flex-1 min-h-0">
        <SvGrid
          data={rows}
          columns={columns}
          features={features}
          filterMode="menu"
          selectionMode="cell"
          showRowNumbers={false}
          showPagination={false}
          enableInlineEditing={true}
          enableCellSelection={true}
          enableRowSummaries={false}
          rowHeight={32}
          containerHeight="100%"
          fitColumns={true}
        />
      </div>
    </div>

    <div class="flex flex-col gap-2 min-h-0">
      <div class="text-sm font-medium text-slate-700 dark:text-slate-200">
        Analytics view <span class="text-slate-500 dark:text-slate-400 font-normal">- read-only mirror</span>
      </div>
      <div class="flex-1 min-h-0">
        <SvGrid
          data={rows}
          columns={columns}
          features={features}
          filterMode="menu"
          selectionMode="cell"
          showRowNumbers={false}
          showPagination={false}
          enableInlineEditing={false}
          enableCellSelection={true}
          enableRowSummaries={true}
          rowHeight={32}
          containerHeight="100%"
          fitColumns={true}
        />
      </div>
    </div>
  </div>
</section>
