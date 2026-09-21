<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'
  import type { Person } from './people'
  export let people: Person[] = []
  export let pageSize = 5
  export let onselect: (person: Person) => void = () => {}

  const columns: GridColumns<(typeof people)[number]> = [
    {
      header: 'Name',
      field: 'name',
    },
    {
      header: 'Department',
      field: 'department',
    },
    {
      header: 'City',
      field: 'city',
    },
    {
      header: 'Salary',
      field: 'salary',
      // TODO port: cell: ({ value }) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD
    },
  ]
</script>

<SvGrid data={people} {columns} sortable filterable showColumnFilters pageable pageSize={pageSize}
  onRowClick={({ row }) => onselect(row)} />

