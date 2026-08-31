<!-- Documented in: docs/help/columns/tool-panel.md -->
<script lang="ts">
  /**
   * 146. Tool panel (Columns + Filters)
   * -----------------------------------
   * The docked enterprise sidebar. Two tabs: COLUMNS (toggle visibility,
   * reorder up/down, group by a column) and FILTERS (one operator + value
   * control per column, kept in sync with the column menu / filter row). Turn
   * it on with `toolPanel` - a button appears at the grid's top-right and the
   * panel docks on the right edge.
   *
   *   <SvGrid responsive={true} toolPanel ... />
   */
  import {
    SvGrid,
    tableFeatures,
    columnGroupingFeature,
    columnFilteringFeature,
    rowSortingFeature,
    type ColumnDef,
  } from '@svgrid/grid'
  import { makePeople, type Person } from '../shared/seed'

  const features = tableFeatures({ columnGroupingFeature, columnFilteringFeature, rowSortingFeature })
  const rows = makePeople(200)

  const columns: ColumnDef<typeof features, Person>[] = [
    { field: 'firstName', header: 'First name', width: 140 },
    { field: 'lastName', header: 'Last name', width: 140 },
    { field: 'department', header: 'Department', width: 150 },
    { field: 'country', header: 'Country', width: 120 },
    { field: 'status', header: 'Status', width: 110 },
    { field: 'age', header: 'Age', width: 90, cellDataType: 'number' },
    {
      field: 'salary',
      header: 'Salary',
      width: 140,
      cellDataType: 'number',
      aggregate: 'sum',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
    },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div
    class="shrink-0 rounded-lg border px-4 py-3"
    style="border-color: var(--sg-border); background: var(--sg-header-bg);"
  >
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Docked tool panel via <code>toolPanel</code> - Columns + Filters tabs
    </p>
    <p class="mt-1 text-xs" style="color: var(--sg-muted);">
      Use the <strong>Columns &amp; Filters</strong> button in the toolbar above
      the grid (open here by default). <strong>Columns</strong> tab: toggle
      visibility, reorder with ↑/↓, click ⊞ to group (try Department - Salary
      rolls up via its <code>aggregate</code>). <strong>Filters</strong> tab:
      pick an operator + value per column (Age / Salary get numeric operators
      via <code>cellDataType</code>); it stays in sync with the column menu.
    </p>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      toolPanel
      toolPanelDefaultOpen
      groupable
      selectionMode="none"
      rowHeight={34}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>
</section>
