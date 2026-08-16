<script lang="ts">
  // SvGridSelect - grid-in-a-dropdown multi-column single-select. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-grid-select
  import { SvGridSelect, type GridSelectColumn } from '@svgrid/grid'

  const columns: GridSelectColumn[] = [
    { field: 'name', header: 'Name', width: '1.5fr' },
    { field: 'email', header: 'Email' },
    { field: 'role', header: 'Role', width: '80px' },
  ]
  const options = [
    { id: 1, name: 'Ada Lovelace', email: 'ada@ex.com', role: 'Admin' },
    { id: 2, name: 'Alan Turing', email: 'alan@ex.com', role: 'User' },
  ]
  let value = $state<string | number | null>(null)
</script>

<SvGridSelect label="Owner" {columns} {options} idField="id" bind:value />
