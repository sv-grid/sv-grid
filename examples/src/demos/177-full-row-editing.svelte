<!-- Documented in: docs/help/editing/full-row.md -->
<script lang="ts">
  /**
   * 177. Full-row editing
   * ---------------------
   * `fullRowEditing` puts the WHOLE row into edit at once - every editable
   * cell shows an inline editor. Enter (or clicking away) commits all cells in
   * one update; Esc cancels the whole row. A form-style entry experience with
   * the density of a grid.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    type ColumnDef,
  } from '@svgrid/grid'

  type Employee = {
    name: string
    role: string
    department: string
    salary: number
    startDate: string
    active: boolean
  }

  let rows = $state<Employee[]>([
    { name: 'Ada Lovelace', role: 'Staff Engineer', department: 'Engineering', salary: 172000, startDate: '2021-03-01', active: true },
    { name: 'Linus Torvalds', role: 'Architect', department: 'Engineering', salary: 198000, startDate: '2019-07-15', active: true },
    { name: 'Grace Hopper', role: 'VP Product', department: 'Product', salary: 210000, startDate: '2018-01-10', active: true },
    { name: 'Tim Berners-Lee', role: 'Designer', department: 'Design', salary: 148000, startDate: '2022-09-05', active: false },
    { name: 'Margaret Hamilton', role: 'Director', department: 'Operations', salary: 205000, startDate: '2017-04-22', active: true },
  ])

  const features = tableFeatures({ rowSortingFeature })

  const columns: ColumnDef<typeof features, Employee>[] = [
    { field: 'name', header: 'Name', editorType: 'text', width: 180 },
    { field: 'role', header: 'Role', editorType: 'text', width: 160 },
    {
      field: 'department',
      header: 'Department',
      editorType: 'select',
      width: 150,
      editorOptions: ['Engineering', 'Product', 'Design', 'Operations', 'Sales'],
    },
    {
      field: 'salary',
      header: 'Salary',
      editorType: 'number',
      width: 140,
      align: 'right',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
    },
    { field: 'startDate', header: 'Start date', editorType: 'date', width: 150, format: { type: 'date', pattern: 'y-m-d' } },
    { field: 'active', header: 'Active', editorType: 'checkbox', width: 90, align: 'center' },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <p class="text-sm shrink-0" style="color: var(--sg-fg);">
    <strong>Double-click any row</strong> - every editable cell turns into an
    inline editor at once (text, select, number, date, checkbox).
    Press <kbd>Enter</kbd> or click away to commit the whole row in one update;
    press <kbd>Esc</kbd> to cancel. This is the <code>fullRowEditing</code> prop.
  </p>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      showRowNumbers={true}
      enableInlineEditing={true}
      fullRowEditing={true}
      rowHeight={40}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>
</section>
