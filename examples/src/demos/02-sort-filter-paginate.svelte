<!-- Documented in: docs/help/recipes.md -->
<script lang="ts">
  /**
   * 02. Sort · Filter · Paginate
   * ----------------------------
   * Three most-asked-for features wired together against a 5,000-row dataset.
   *   - multi-column sort (shift-click headers)
   *   - per-column filter row (text/number)
   *   - pagination footer with page-size selector
   * State is owned by this component so it can be persisted (here: in URL).
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,
    type ColumnDef,
  } from '@svgrid/grid'
  import { makePeople, type Person } from '../shared/seed'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,
  })

  const rows = makePeople(5_000)

  const columns: ColumnDef<typeof features, Person>[] = [
    { field: 'firstName',  header: 'First name', editorType: 'text' },
    { field: 'lastName',   header: 'Last name',  editorType: 'text' },
    { field: 'department', header: 'Department', editorType: 'text' },
    { field: 'country',    header: 'Country',    editorType: 'text' },
    { field: 'age',        header: 'Age',        editorType: 'number' },
    {
      field: 'salary',
      header: 'Salary',
      editorType: 'number',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
    },
    {
      field: 'joinedAt',
      header: 'Joined',
      editorType: 'date',
      format: { type: 'date', pattern: 'y-m-d' },
    },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex flex-wrap items-center gap-3 text-sm shrink-0">
    <span class="sfp-strong">{rows.length.toLocaleString()} rows</span>
    <span class="sfp-muted">·</span>
    <span class="sfp-muted">
      Click a header to sort. Shift+click to multi-sort. Type in the filter row.
    </span>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      filterMode="row"
      selectionMode="none"
      showPagination={true}
      pageSize={50}
      showGroupingControls={false}
      enableInlineEditing={false}
      enableCellSelection={false}
      enableRowSummaries={false}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>
</section>

<style>
  .sfp-strong { color: var(--sg-fg, #475569); }
  .sfp-muted  { color: var(--sg-muted, #64748b); }
</style>
