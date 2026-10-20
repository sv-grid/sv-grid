<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = { id: number; name: string; dept: string; salary: number }

  const depts = ['Engineering', 'Platform', 'Sales', 'Support']
  let rows = $state<Person[]>(
    Array.from({ length: 40 }, (_, i) => ({
      id: i + 1,
      name: `Person ${String(i + 1).padStart(2, '0')}`,
      dept: depts[i % depts.length]!,
      salary: 50000 + ((i * 7919) % 90000),
    })),
  )

  const columns: GridColumns<Person> = [
    { field: 'name', header: 'Name', width: 200, editorType: 'text' },
    { field: 'dept', header: 'Department', width: 160 },
    { field: 'salary', header: 'Salary', width: 140, editorType: 'number', format: { type: 'currency', currency: 'USD' } },
  ]

  // Read by the check: what the grid reported back.
  const report = (patch: Record<string, unknown>) => {
    if (typeof window !== 'undefined') window.__check = { ...window.__check, ...patch }
  }
</script>

<h1>grid</h1>
<SvGrid
  data={rows}
  {columns}
  getRowId={(r) => String(r.id)}
  sortable
  filterable
  editable
  showRowSelection
  containerHeight={420}
  onSortingChange={(s) => report({ sorting: s })}
  onRowSelectionChange={(_sel, picked) => report({ selected: picked.map((r) => r.id) })}
  onCellValueChange={(e) => report({ edit: { columnId: e.columnId, newValue: e.newValue } })}
/>
