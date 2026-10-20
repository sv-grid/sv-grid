<script lang="ts">
  // A svelte-headless-table component as its docs write it: a readable store,
  // sort / filter / pagination plugins, a custom cell renderer, and a pager
  // outside the <table> that reads the plugin state.
  import { readable } from 'svelte/store'
  import { createRender, createTable, Render, Subscribe } from 'svelte-headless-table'
  import { addPagination, addSortBy, addTableFilter } from 'svelte-headless-table/plugins'
  import StatusBadge from './StatusBadge.svelte'
  import type { Order } from './orders'

  export let orders: Order[]

  const table = createTable(readable(orders), {
    sort: addSortBy(),
    filter: addTableFilter({
      fn: ({ filterValue, value }) => value.toLowerCase().includes(filterValue.toLowerCase()),
    }),
    page: addPagination({ initialPageSize: 10 }),
  })

  const columns = table.createColumns([
    table.column({ header: 'Order', accessor: 'id' }),
    table.column({ header: 'Customer', accessor: 'customer' }),
    table.column({ header: 'Total', accessor: (row) => row.total.toFixed(2) }),
    table.column({
      header: 'Status',
      accessor: 'status',
      cell: ({ value }) => createRender(StatusBadge, { status: value }),
    }),
  ])

  const { headerRows, pageRows, tableAttrs, tableBodyAttrs, pluginStates } = table.createViewModel(columns)
  const { filterValue } = pluginStates.filter
  const { hasNextPage, hasPreviousPage, pageIndex } = pluginStates.page
</script>

<input bind:value={$filterValue} placeholder="Search orders..." />

<table {...$tableAttrs}>
  <thead>
    {#each $headerRows as headerRow (headerRow.id)}
      <Subscribe rowAttrs={headerRow.attrs()} let:rowAttrs>
        <tr {...rowAttrs}>
          {#each headerRow.cells as cell (cell.id)}
            <Subscribe attrs={cell.attrs()} let:attrs props={cell.props()} let:props>
              <th {...attrs} on:click={props.sort.toggle}>
                <Render of={cell.render()} />
              </th>
            </Subscribe>
          {/each}
        </tr>
      </Subscribe>
    {/each}
  </thead>
  <tbody {...$tableBodyAttrs}>
    {#each $pageRows as row (row.id)}
      <Subscribe rowAttrs={row.attrs()} let:rowAttrs>
        <tr {...rowAttrs}>
          {#each row.cells as cell (cell.id)}
            <Subscribe attrs={cell.attrs()} let:attrs>
              <td {...attrs}><Render of={cell.render()} /></td>
            </Subscribe>
          {/each}
        </tr>
      </Subscribe>
    {/each}
  </tbody>
</table>

<button disabled={!$hasPreviousPage} on:click={() => $pageIndex--}>Previous</button>
<button disabled={!$hasNextPage} on:click={() => $pageIndex++}>Next</button>
