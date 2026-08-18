<script>
  import { SvGrid } from '@svgrid/grid'

  // Capabilities are boolean props - `sortable`, `filterable`, `editable`,
  // `groupable`, `pageable` - and each injects the feature it needs. For finer
  // control you can register features explicitly with `tableFeatures({ ... })`
  // and pass them as `features`; see docs/getting-started/4-features.md.

  // Your data. Swap for a fetch() in onMount, a store, or props.
  let rows = $state([
    { id: 1, name: 'Ada Lovelace', team: 'Engineering', salary: 145000, active: true },
    { id: 2, name: 'Alan Turing', team: 'Research', salary: 160000, active: true },
    { id: 3, name: 'Grace Hopper', team: 'Engineering', salary: 152000, active: false },
    { id: 4, name: 'Katherine Johnson', team: 'Data', salary: 138000, active: true },
    { id: 5, name: 'Edsger Dijkstra', team: 'Research', salary: 149000, active: false },
  ])

  const columns = [
    { field: 'name', header: 'Name', editorType: 'text', width: 200 },
    { field: 'team', header: 'Team', editorType: 'text', width: 150 },
    {
      field: 'salary',
      header: 'Salary',
      width: 130,
      align: 'right',
      format: { type: 'currency', currency: 'USD' },
    },
    { field: 'active', header: 'Active', editorType: 'checkbox', width: 90 },
  ]
</script>

<main style="max-width: 720px; margin: 3rem auto; font-family: system-ui, sans-serif;">
  <h1 style="font-size: 1.4rem;">SvGrid</h1>
  <p style="color:#64748b;">
    Sort, filter, select, and double-click a cell to edit. Edit
    <code>src/App.svelte</code> to make it yours.
  </p>

  <div style="height: 320px;">
    <SvGrid
      data={rows}
      {columns}
      sortable
      filterable
      editable
      selectionMode="row"
      showRowSelection={true}
      showRowNumbers={true}
      rowHeight={38}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>
</main>
