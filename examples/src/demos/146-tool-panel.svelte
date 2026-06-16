<!-- Documented in: docs/help/columns/tool-panel.md -->
<script lang="ts">
  /**
   * 146. Columns tool panel
   * -----------------------
   * The docked enterprise sidebar for managing columns without a right-click:
   * toggle visibility, reorder (up/down), and group by a column. Turn it on
   * with `toolPanel` - a button appears at the grid's top-right, and the panel
   * docks on the right edge.
   *
   *   <SvGrid toolPanel ... />
   */
  import {
    SvGrid,
    tableFeatures,
    columnGroupingFeature,
    type ColumnDef,
  } from 'sv-grid-core'
  import { makePeople, type Person } from '../shared/seed'

  const features = tableFeatures({ columnGroupingFeature })
  const rows = makePeople(200)

  const columns: ColumnDef<typeof features, Person>[] = [
    { field: 'firstName', header: 'First name', width: 140 },
    { field: 'lastName', header: 'Last name', width: 140 },
    { field: 'department', header: 'Department', width: 150 },
    { field: 'country', header: 'Country', width: 120 },
    { field: 'status', header: 'Status', width: 110 },
    { field: 'age', header: 'Age', width: 90, align: 'right' },
    {
      field: 'salary',
      header: 'Salary',
      width: 140,
      align: 'right',
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
      Docked Columns panel via <code>toolPanel</code>
    </p>
    <p class="mt-1 text-xs" style="color: var(--sg-muted);">
      Click the columns button at the top-right. Toggle visibility, reorder
      with ↑/↓, and click ⊞ to group by a column (try grouping Department -
      Salary rolls up via its <code>aggregate</code>).
    </p>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      toolPanel
      groupable
      selectionMode="none"
      enableRowSummaries={false}
      rowHeight={34}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>
</section>
