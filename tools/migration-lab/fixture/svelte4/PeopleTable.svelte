<script lang="ts">
  // The table as svelte-headless-table's own docs show it: a store for the
  // data, plugins for behaviour, and a view model read through <Subscribe>
  // and <Render>. Svelte 4 throughout: `export let`, `$:`, a dispatcher,
  // `on:click`, and `let:` slot props.
  import { createEventDispatcher } from 'svelte'
  import { writable } from 'svelte/store'
  import { createTable, Subscribe, Render } from 'svelte-headless-table'
  import { addSortBy, addColumnFilters, addPagination } from 'svelte-headless-table/plugins'
  import type { Person } from './people'

  export let people: Person[] = []
  export let pageSize = 5

  const dispatch = createEventDispatcher<{ select: Person }>()

  const data = writable<Person[]>(people)
  $: data.set(people)

  const table = createTable(data, {
    sort: addSortBy(),
    filter: addColumnFilters(),
    page: addPagination({ initialPageSize: pageSize }),
  })

  const columns = table.createColumns([
    table.column({ header: 'Name', accessor: 'name' }),
    table.column({ header: 'Department', accessor: 'department' }),
    table.column({ header: 'City', accessor: 'city' }),
    table.column({
      header: 'Salary',
      accessor: 'salary',
      cell: ({ value }) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
    }),
  ])

  const { headerRows, pageRows, tableAttrs, tableBodyAttrs, pluginStates } = table.createViewModel(columns)
  const { pageIndex, pageCount } = pluginStates.page

  $: shown = $pageRows.length
</script>

<table {...$tableAttrs}>
  <thead>
    {#each $headerRows as headerRow (headerRow.id)}
      <Subscribe rowAttrs={headerRow.attrs()} let:rowAttrs>
        <tr {...rowAttrs}>
          {#each headerRow.cells as cell (cell.id)}
            <Subscribe attrs={cell.attrs()} let:attrs props={cell.props()} let:props>
              <th {...attrs} on:click={props.sort.toggle}>
                <Render of={cell.render()} />
                {#if props.sort.order === 'asc'}
                  <span aria-hidden="true">^</span>
                {:else if props.sort.order === 'desc'}
                  <span aria-hidden="true">v</span>
                {/if}
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
        <tr {...rowAttrs} on:click={() => row.isData() && dispatch('select', row.original)}>
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

<p>
  {shown} rows, page {$pageIndex + 1} of {$pageCount}
  <button on:click={() => ($pageIndex = Math.max(0, $pageIndex - 1))}>Previous</button>
  <button on:click={() => ($pageIndex = Math.min($pageCount - 1, $pageIndex + 1))}>Next</button>
</p>
