<script lang="ts">
  /**
   * The engine, not the renderer.
   *
   * `createSvGrid` from `@svgrid/grid/core` computes the row model - filtered,
   * then sorted - and hands you rows and header groups. It touches no DOM, ships
   * no CSS, and has no opinion about your markup. Everything below <table> is
   * yours to rewrite.
   *
   * If you'd rather have the batteries-included component, that's
   * `npm create @svgrid@latest my-app -- --template minimal`.
   */
  import {
    createSvGrid,
    createCoreRowModel,
    createFilteredRowModel,
    createSortedRowModel,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type ColumnFiltersState,
    type SortingState,
  } from '@svgrid/grid/core'

  type Person = {
    id: number
    name: string
    team: string
    salary: number
    active: boolean
  }

  // Opt into the features you use. Registering a feature is what makes its
  // state and its row model legal; what you leave out never enters the bundle.
  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  const columns: ColumnDef<typeof features, Person>[] = [
    { field: 'name', header: 'Name' },
    { field: 'team', header: 'Team' },
    { field: 'salary', header: 'Salary' },
    { field: 'active', header: 'Active' },
  ]

  // Swap for a fetch() in $effect, a load function, a store - the engine only
  // wants an array.
  const data: Person[] = [
    { id: 1, name: 'Ada Lovelace', team: 'Engineering', salary: 145000, active: true },
    { id: 2, name: 'Alan Turing', team: 'Research', salary: 160000, active: true },
    { id: 3, name: 'Grace Hopper', team: 'Engineering', salary: 152000, active: false },
    { id: 4, name: 'Katherine Johnson', team: 'Data', salary: 138000, active: true },
    { id: 5, name: 'Edsger Dijkstra', team: 'Research', salary: 149000, active: false },
    { id: 6, name: 'Barbara Liskov', team: 'Research', salary: 158000, active: true },
    { id: 7, name: 'Margaret Hamilton', team: 'Engineering', salary: 151000, active: true },
    { id: 8, name: 'Donald Knuth', team: 'Data', salary: 141000, active: false },
  ]

  // Controlled state. The engine never mutates these - it reports what changed
  // through onXxxChange and you decide what to store. $state is what makes the
  // round trip reactive.
  let sorting = $state<SortingState>([{ id: 'salary', desc: true }])
  let columnFilters = $state<ColumnFiltersState>([])
  let query = $state('')

  $effect(() => {
    columnFilters = query ? [{ id: 'name', value: query }] : []
  })

  // Rebuilt whenever data or state changes. Recreating the engine is cheap -
  // it's a state machine over your array, not a component tree.
  const table = $derived.by(() =>
    createSvGrid({
      _features: features,
      _rowModels: {
        // The pipeline, in order. Add createGroupedRowModel /
        // createPaginatedRowModel / createTreeRowModel as you need them.
        coreRowModel: createCoreRowModel<Person>(),
        filteredRowModel: createFilteredRowModel<Person>(),
        sortedRowModel: createSortedRowModel<Person>(),
      },
      data,
      columns,
      state: { sorting, columnFilters },
      onSortingChange: (u) => (sorting = typeof u === 'function' ? u(sorting) : u),
      onColumnFiltersChange: (u) => (columnFilters = typeof u === 'function' ? u(columnFilters) : u),
    }),
  )

  const headerGroups = $derived(table.getHeaderGroups())
  const rows = $derived(table.getRowModel().rows)

  // Sorting is yours to drive: click cycles asc -> desc -> unsorted.
  function toggleSort(id: string) {
    const current = sorting[0]
    sorting = current?.id !== id ? [{ id, desc: false }] : current.desc ? [] : [{ id, desc: true }]
  }

  const indicator = (id: string) => (sorting[0]?.id === id ? (sorting[0].desc ? '▼' : '▲') : '')

  const money = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
</script>

<main>
  <header>
    <h1>Headless SvGrid</h1>
    <p>
      <code>createSvGrid</code> sorts and filters. The <code>&lt;table&gt;</code> below is plain
      markup in <code>src/App.svelte</code>, styled by <code>src/app.css</code>. No grid CSS is
      loaded.
    </p>
  </header>

  <input class="search" placeholder="Filter by name…" bind:value={query} />

  <table>
    <thead>
      {#each headerGroups as group (group.id)}
        <tr>
          {#each group.headers as header (header.id)}
            <th
              class:numeric={header.column.id === 'salary'}
              aria-sort={sorting[0]?.id === header.column.id
                ? sorting[0].desc
                  ? 'descending'
                  : 'ascending'
                : 'none'}
            >
              <button type="button" onclick={() => toggleSort(header.column.id)}>
                {header.column.columnDef.header}
                <span class="indicator">{indicator(header.column.id)}</span>
              </button>
            </th>
          {/each}
        </tr>
      {/each}
    </thead>
    <tbody>
      {#each rows as row (row.id)}
        {@const person = row.original as Person}
        <tr>
          <td>{person.name}</td>
          <td>{person.team}</td>
          <td class="numeric">{money.format(person.salary)}</td>
          <td>{person.active ? 'Yes' : 'No'}</td>
        </tr>
      {:else}
        <tr>
          <td colspan="4" class="empty">Nobody matches “{query}”.</td>
        </tr>
      {/each}
    </tbody>
  </table>

  <p class="count">{rows.length} of {data.length} rows</p>
</main>
