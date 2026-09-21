<script lang="ts">
  // The same component after the mechanical Svelte 5 port from the official
  // migration guide: `export let` becomes `$props()`, `$:` becomes `$derived`
  // and `$effect`, the dispatcher becomes a callback prop, `on:click` becomes
  // `onclick`. The svelte-headless-table wiring is untouched, because there is
  // nothing in the guide to port it to: it is stores plus <Subscribe> / <Render>
  // with `let:` slot props, and that is what the checker has to say about it.
  import { writable } from 'svelte/store'
  import { createTable, Subscribe, Render } from 'svelte-headless-table'
  import { addSortBy, addColumnFilters, addPagination } from 'svelte-headless-table/plugins'
  import type { Person } from './people'

  let {
    people = [],
    pageSize = 5,
    onselect,
  }: { people?: Person[]; pageSize?: number; onselect?: (person: Person) => void } = $props()

  const data = writable<Person[]>(people)
  $effect(() => {
    data.set(people)
  })

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

  const shown = $derived($pageRows.length)
</script>

<table {...$tableAttrs}>
  <thead>
    {#each $headerRows as headerRow (headerRow.id)}
      <Subscribe rowAttrs={headerRow.attrs()} let:rowAttrs>
        <tr {...rowAttrs}>
          {#each headerRow.cells as cell (cell.id)}
            <Subscribe attrs={cell.attrs()} let:attrs props={cell.props()} let:props>
              <th {...attrs} onclick={props.sort.toggle}>
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
        <tr {...rowAttrs} onclick={() => row.isData() && onselect?.(row.original)}>
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
  <button onclick={() => ($pageIndex = Math.max(0, $pageIndex - 1))}>Previous</button>
  <button onclick={() => ($pageIndex = Math.min($pageCount - 1, $pageIndex + 1))}>Next</button>
</p>
