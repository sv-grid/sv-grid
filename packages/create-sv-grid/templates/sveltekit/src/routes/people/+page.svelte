<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { SvGrid, type GridColumns } from '@svgrid/grid'
  import type { Person } from '$lib/people'

  let { data } = $props()

  const columns: GridColumns<Person> = [
    { field: 'name', header: 'Name', editable: true },
    { field: 'role', header: 'Role' },
    { field: 'year', header: 'Year' },
  ]

  // Header click -> URL -> server sorts -> load returns ordered rows.
  function onSortingChange(sorting: Array<{ id: string; desc: boolean }>) {
    const next = new URL(page.url)
    if (sorting.length === 0) {
      next.searchParams.delete('sort')
      next.searchParams.delete('dir')
    } else {
      next.searchParams.set('sort', sorting[0]!.id)
      next.searchParams.set('dir', sorting[0]!.desc ? 'desc' : 'asc')
    }
    goto(next, { keepFocus: true, noScroll: true })
  }

  // Committed edit -> form action -> database.
  async function onCellValueChange(e: { row: Person; columnId: string; newValue: unknown }) {
    if (e.columnId !== 'name') return
    const body = new FormData()
    body.set('id', String(e.row.id))
    body.set('name', String(e.newValue))
    await fetch('?/rename', { method: 'POST', body })
  }
</script>

<h1>People</h1>
<p>Click a header to sort - the order lives in the URL. Double-click a name to edit it.</p>

<SvGrid
  data={data.rows}
  {columns}
  sortable
  editable
  externalSort
  initialSorting={[{ id: data.sortBy, desc: data.desc }]}
  {onSortingChange}
  {onCellValueChange}
  containerHeight={320}
/>
