<script lang="ts">
  /**
   * 07. Grouping + aggregation
   * --------------------------
   * The grid's built-in grouping pipeline buckets rows by one or more
   * columns and renders a group row in their place. Aggregation here is
   * computed in the demo (the engine resolves shared values per group; this
   * component layers sum/avg on top for the visible "Salary" and
   * "Performance" columns via the row-summary footer).
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnGroupingFeature,
    rowExpandingFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import { makePeople, type Person } from '../shared/seed'

  const features = tableFeatures({
    rowSortingFeature,
    columnGroupingFeature,
    rowExpandingFeature,
  })

  const rows = makePeople(500)

  const columns: ColumnDef<typeof features, Person>[] = [
    { field: 'department', header: 'Department', editorType: 'text' },
    { field: 'country',    header: 'Country',    editorType: 'text' },
    { field: 'firstName',  header: 'First name', editorType: 'text' },
    { field: 'lastName',   header: 'Last name',  editorType: 'text' },
    { field: 'age',        header: 'Age',        editorType: 'number' },
    {
      field: 'salary',
      header: 'Salary',
      editorType: 'number',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
    },
    { field: 'performance', header: 'Performance', editorType: 'number' },
  ]

  let api = $state<SvGridApi<typeof features, Person> | null>(null)
  let groupBy = $state<string[]>(['department'])

  function applyGroup(by: string[]) {
    groupBy = by
    api?.setGroupBy(by)
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex flex-wrap items-center gap-2 text-sm shrink-0">
    <span class="font-medium">Group by:</span>
    <button
      onclick={() => applyGroup([])}
      class="gb-btn rounded border px-3 py-1 {groupBy.length === 0 ? 'is-on' : ''}"
    >None</button>
    <button
      onclick={() => applyGroup(['department'])}
      class="gb-btn rounded border px-3 py-1 {groupBy.join() === 'department' ? 'is-on' : ''}"
    >Department</button>
    <button
      onclick={() => applyGroup(['country'])}
      class="gb-btn rounded border px-3 py-1 {groupBy.join() === 'country' ? 'is-on' : ''}"
    >Country</button>
    <button
      onclick={() => applyGroup(['department', 'country'])}
      class="gb-btn rounded border px-3 py-1 {groupBy.join() === 'department,country' ? 'is-on' : ''}"
    >Department → Country</button>
    <span class="gb-hint ml-3">
      Click a group row to expand. The row-summaries footer aggregates totals.
    </span>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showPagination={false}
      showGroupingControls={true}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={true}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => {
        api = next
        // Apply the initial group-by once the imperative API is available,
        // then auto-expand the first group so the data isn't hidden behind a
        // single closed row on first paint.
        next.setGroupBy(groupBy)
        queueMicrotask(() => next.setRowExpanded(`department:Engineering`, true))
      }}
    />
  </div>
</section>

<style>
  .gb-btn {
    border-color: var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
  }
  .gb-btn:hover { background: var(--sg-row-hover-bg, rgba(148, 163, 184, 0.12)); }
  .gb-btn.is-on {
    background: var(--sg-bg-subtle, var(--sg-header-bg, #e2e8f0));
    border-color: var(--sg-border, #cbd5e1);
  }
  .gb-hint { color: var(--sg-muted, #64748b); }
</style>
