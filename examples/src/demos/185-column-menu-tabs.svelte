<!-- Documented in: docs/help/columns/column-menu.md -->
<script lang="ts">
  /**
   * 185. Tabbed column menu (columnMenuTabs)
   * ----------------------------------------
   * Opt into the AG-Grid-style tabbed header menu with `columnMenuTabs`. The
   * column menu (the ⋮ button on any header) then has three tabs:
   *   General - sort / pin / autosize / group / reset
   *   Filter  - the column's filter UI (operator + value + value checklist)
   *   Columns - a quick visibility checklist
   * It is OFF by default (the flat menu with a "Choose columns" submenu). Toggle
   * the switch below to compare.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    columnGroupingFeature,
    type ColumnDef,
  } from '@svgrid/grid'
  import { makePeople, type Person } from '../shared/seed'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature, columnGroupingFeature })
  const rows = makePeople(150)
  let tabbed = $state(true)

  const columns: ColumnDef<typeof features, Person>[] = [
    { field: 'firstName', header: 'First name', width: 140 },
    { field: 'lastName', header: 'Last name', width: 140 },
    { field: 'department', header: 'Department', width: 150 },
    { field: 'country', header: 'Country', width: 120 },
    { field: 'status', header: 'Status', width: 110 },
    { field: 'age', header: 'Age', width: 90, cellDataType: 'number' },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex items-center gap-3 shrink-0">
    <label class="cmt-switch">
      <input type="checkbox" bind:checked={tabbed} />
      <span><code>columnMenuTabs</code> {tabbed ? 'on' : 'off'}</span>
    </label>
    <span class="text-xs" style="color: var(--sg-muted);">
      Open any column's <strong>⋮</strong> menu. {tabbed
        ? 'Tabbed: General / Filter / Columns.'
        : 'Flat: actions list + Choose columns submenu.'}
    </span>
  </div>

  <div class="flex-1 min-h-0">
    {#key tabbed}
      <SvGrid
        data={rows}
        columns={columns}
        features={features}
        columnMenuTabs={tabbed}
        showColumnFilters={true}
        selectionMode="none"
        showRowNumbers={true}
        rowHeight={36}
        containerHeight="100%"
        fitColumns={true}
      />
    {/key}
  </div>
</section>

<style>
  .cmt-switch { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--sg-fg); cursor: pointer; }
  .cmt-switch input { accent-color: var(--sg-accent, #2563eb); width: 16px; height: 16px; }
</style>
