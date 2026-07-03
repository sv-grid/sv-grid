<!-- Documented in: docs/help/filtering/floating-filters.md -->
<script lang="ts">
  /**
   * 179. Floating filters - per-operator inline filter row
   * ------------------------------------------------------
   * The floating filter row under the headers now honours EVERY operator per
   * column: click the funnel in a cell to pick the operator, the value input
   * switches to the column's type (number / date / text), and `between` shows
   * a second "To" input right inline. No need to open the full menu.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
  } from '@svgrid/grid'
  import { makePeople, type Person } from '../shared/seed'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let rows = $state<Person[]>(makePeople(120))

  const columns: ColumnDef<typeof features, Person>[] = [
    { field: 'firstName', header: 'First name', editorType: 'text', width: 140 },
    { field: 'lastName', header: 'Last name', editorType: 'text', width: 140 },
    { field: 'department', header: 'Department', editorType: 'text', width: 150 },
    { field: 'age', header: 'Age', editorType: 'number', width: 120, align: 'right' },
    { field: 'salary', header: 'Salary', editorType: 'number', width: 150, align: 'right',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
    { field: 'joinedAt', header: 'Joined', editorType: 'date', width: 160, format: { type: 'date', pattern: 'y-m-d' } },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <p class="text-sm shrink-0" style="color: var(--sg-fg);">
    Type straight into the <strong>filter row</strong> under the headers. Click a
    cell's <strong>funnel</strong> to switch operators - <code>Age</code> to
    <em>Between</em> gets two number inputs (From / To); <code>Joined</code> uses a
    real date picker; <code>Salary</code> takes <em>Greater than</em>. Per-operator,
    per-type, all inline.
  </p>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      filterMode="row"
      showRowNumbers={true}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>
</section>
