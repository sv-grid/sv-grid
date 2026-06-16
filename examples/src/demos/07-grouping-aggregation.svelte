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
  } from 'sv-grid-core'
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
      class="rounded border px-3 py-1 {groupBy.length === 0 ? 'bg-slate-200 dark:bg-slate-700' : 'border-slate-300 dark:border-slate-600'}"
    >None</button>
    <button
      onclick={() => applyGroup(['department'])}
      class="rounded border px-3 py-1 {groupBy.join() === 'department' ? 'bg-slate-200 dark:bg-slate-700' : 'border-slate-300 dark:border-slate-600'}"
    >Department</button>
    <button
      onclick={() => applyGroup(['country'])}
      class="rounded border px-3 py-1 {groupBy.join() === 'country' ? 'bg-slate-200 dark:bg-slate-700' : 'border-slate-300 dark:border-slate-600'}"
    >Country</button>
    <button
      onclick={() => applyGroup(['department', 'country'])}
      class="rounded border px-3 py-1 {groupBy.join() === 'department,country' ? 'bg-slate-200 dark:bg-slate-700' : 'border-slate-300 dark:border-slate-600'}"
    >Department → Country</button>
    <span class="ml-3 text-slate-500 dark:text-slate-400">
      Click a group row to expand. The row-summaries footer aggregates totals.
    </span>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
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
