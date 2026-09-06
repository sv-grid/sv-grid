<!-- Documented in: docs/help/recipes.md -->
<script lang="ts">
  /**
   * 04. Selection + copy/paste
   * --------------------------
   * Row checkboxes (selectionMode='both') + cell-range selection.
   * Built-in clipboard:
   *   - Ctrl/Cmd+C copies the active rectangular selection as TSV
   *   - Ctrl/Cmd+V pastes TSV from the clipboard into the same range
   * The selection summary footer below the grid is rolled by hand -
   * the grid exposes the selected-cell rectangle via the active-cell state.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    rowSelectionFeature,
    type GridColumns,
    type SvGridApi,
  } from '@svgrid/grid'
  import { makePeople, type Person } from '../shared/seed'

  const features = tableFeatures({
    rowSortingFeature,
    rowSelectionFeature,
  })

  const rows = makePeople(80)

  const columns: GridColumns<Person> = [
    { field: 'firstName',  header: 'First name', editorType: 'text' },
    { field: 'lastName',   header: 'Last name',  editorType: 'text' },
    { field: 'department', header: 'Department', editorType: 'text' },
    { field: 'country',    header: 'Country',    editorType: 'text' },
    {
      field: 'age',
      header: 'Age',
      editorType: 'number',
    },
    {
      field: 'salary',
      header: 'Salary',
      editorType: 'number',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
    },
    {
      field: 'performance',
      header: 'Performance',
      editorType: 'number',
    },
  ]

  let api = $state<SvGridApi<typeof features, Person> | null>(null)
  let selectedRows = $state<Person[]>([])

  const stats = $derived.by(() => {
    let sumSalary = 0
    let perfTotal = 0
    for (const row of selectedRows) {
      sumSalary += row.salary
      perfTotal += row.performance
    }
    return {
      count: selectedRows.length,
      sumSalary,
      avgPerf: selectedRows.length ? Math.round(perfTotal / selectedRows.length) : 0,
    }
  })

  const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex flex-wrap items-center gap-3 text-sm shrink-0">
    <span class="text-slate-600 dark:text-slate-300">
      Tick the row checkboxes, or click + drag cells to make a range selection.
      <kbd>Ctrl/Cmd+C</kbd> copies as TSV.
    </span>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      columnResize
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="both"
      enableInlineEditing={false}
      enableCellSelection={true}
      contextMenu={true}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => (api = next)}
      onRowSelectionChange={(_, rows) => (selectedRows = rows)}
    />
  </div>

  <footer class="sel-summary rounded border px-4 py-2 text-sm flex flex-wrap items-center gap-6 shrink-0">
    <span><strong>{stats.count}</strong> rows selected</span>
    <span>Σ Salary: <strong>{currency.format(stats.sumSalary)}</strong></span>
    <span>⌀ Performance: <strong>{stats.avgPerf}</strong></span>
  </footer>
</section>

<style>
  /* Theme tokens rather than fixed slate utilities, so the summary bar tracks
     whichever preset the gallery is running. */
  .sel-summary {
    background: var(--sg-bg-subtle, var(--sg-header-bg, #f8fafc));
    border-color: var(--sg-border, #e2e8f0);
    color: var(--sg-fg, #0f172a);
  }
</style>
