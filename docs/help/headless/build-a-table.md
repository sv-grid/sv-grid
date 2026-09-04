# Build a table from scratch

This is the whole point of headless: the engine computes the rows, **you** emit
the markup. Here's a complete, sortable, filterable `<table>` in one Svelte
component - no `<SvGrid>`, no grid CSS.

<div data-docs-demo="186-headless-table" data-height="520"></div>

## 1. Wire the engine

When you bypass `<SvGrid>` you opt into the row models you want. `<SvGrid>` does
this for you; here you do it explicitly.

```svelte
<script lang="ts">
  import {
    createSvGrid,
    createCoreRowModel,
    createSortedRowModel,
    createFilteredRowModel,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
  } from '@svgrid/grid'

  type Repo = { name: string; lang: string; stars: number }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  const columns: ColumnDef<typeof features, Repo>[] = [
    { field: 'name',  header: 'Name'  },
    { field: 'lang',  header: 'Lang'  },
    { field: 'stars', header: 'Stars' },
  ]
  const data: Repo[] = [
    { name: 'svelte',  lang: 'TypeScript', stars: 79000 },
    { name: 'kit',     lang: 'TypeScript', stars: 18000 },
    { name: 'vite',    lang: 'TypeScript', stars: 67000 },
    { name: 'esbuild', lang: 'Go',         stars: 38000 },
  ]

  // Controlled state - Svelte 5 $state lifts the engine into reactivity.
  type Sort = { id: string; desc: boolean }
  type Filter = { id: string; value: unknown }
  let sorting = $state<Sort[]>([])
  let columnFilters = $state<Filter[]>([])
  let query = $state('')

  $effect(() => {
    columnFilters = query ? [{ id: 'name', value: query }] : []
  })

  // Rebuild when data / state changes. The engine is cheap to recreate.
  const table = $derived.by(() =>
    createSvGrid({
      _features: features,
      _rowModels: {
        coreRowModel:     createCoreRowModel<Repo>(),
        filteredRowModel: createFilteredRowModel<Repo>(),
        sortedRowModel:   createSortedRowModel<Repo>(),
      },
      data,
      columns,
      state: { sorting, columnFilters },
      // `u` is an Updater: either the next value or a function producing it.
      onSortingChange: (u) => (sorting = typeof u === 'function' ? u(sorting) : u),
      onColumnFiltersChange: (u) => (columnFilters = typeof u === 'function' ? u(columnFilters) : u),
    }),
  )

  const headerGroups = $derived(table.getHeaderGroups())
  const rows = $derived(table.getRowModel().rows)

  function toggleSort(id: string) {
    const cur = sorting[0]
    sorting =
      cur?.id !== id ? [{ id, desc: false }]
      : cur.desc     ? []
      :                [{ id, desc: true }]
  }
  const indicator = (id: string) =>
    sorting[0]?.id === id ? (sorting[0]!.desc ? ' ▼' : ' ▲') : ''
</script>
```

## 2. Render it - any markup you like

```svelte
<input placeholder="Filter by name…" bind:value={query} />

<table>
  <thead>
    {#each headerGroups as hg (hg.id)}
      <tr>
        {#each hg.headers as h (h.id)}
          <th onclick={() => toggleSort(h.column.id)} style="cursor:pointer">
            {h.column.columnDef.header}{indicator(h.column.id)}
          </th>
        {/each}
      </tr>
    {/each}
  </thead>
  <tbody>
    {#each rows as r (r.id)}
      <tr>
        {#each columns as col (col.field)}
          <td>{(r.original as Repo)[col.field as keyof Repo] ?? ''}</td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>
```

That's a fully working sortable + filterable grid - the engine did the sorting
and filtering, your 20 lines of template did the rendering. Style the `<table>`
however you want; the engine has no opinion.

## What just happened

- **`_rowModels`** declared the pipeline: core → filtered → sorted. Skipping
  grouping and pagination means that code never ships.
- **`state` in, `onXxxChange` out**: clicking a header calls `toggleSort`, which
  reassigns `sorting`; the `$derived` table re-reads it and `getRowModel()`
  re-sorts.
- **`getHeaderGroups()`** produced the header tree (a single level here; nested
  `columns: [...]` would produce more rows).


## The smallest thing that works

Two imports, one row model, one `{#each}`. Nothing here is a grid component -
`<table>`, `<tr>` and `<td>` are yours, and so is every class on them.

```svelte {runnable}
<script lang="ts">
  import { createSvGrid, createCoreRowModel, tableFeatures, type ColumnDef } from '@svgrid/grid'

  type Repo = { name: string; lang: string; stars: number }

  const data: Repo[] = [
    { name: 'svelte',   lang: 'JavaScript', stars: 78000 },
    { name: 'vite',     lang: 'TypeScript', stars: 68000 },
    { name: 'sv-grid',  lang: 'TypeScript', stars: 172 },
    { name: 'rollup',   lang: 'JavaScript', stars: 25000 },
    { name: 'esbuild',  lang: 'Go',         stars: 38000 },
    { name: 'tinygo',   lang: 'Go',         stars: 15000 },
    { name: 'bun',      lang: 'Zig',        stars: 74000 },
    { name: 'zig',      lang: 'Zig',        stars: 35000 },
  ]

  const features = tableFeatures({})

  const columns: ColumnDef<typeof features, Repo>[] = [
    { field: 'name',  header: 'Repo' },
    { field: 'lang',  header: 'Language' },
    { field: 'stars', header: 'Stars' },
  ]

  const table = createSvGrid({
    _features: features,
    _rowModels: { coreRowModel: createCoreRowModel<Repo>() },
    data,
    columns,
  })

  const rows = $derived(table.getRowModel().rows)
</script>

<table>
  <thead>
    {#each table.getHeaderGroups() as hg (hg.id)}
      <tr>
        {#each hg.headers as h (h.id)}
          <th>{h.column.columnDef.header}</th>
        {/each}
      </tr>
    {/each}
  </thead>
  <tbody>
    {#each rows as r (r.id)}
      {@const repo = r.original as Repo}
      <tr>
        <td>{repo.name}</td>
        <td>{repo.lang}</td>
        <td>{repo.stars.toLocaleString()}</td>
      </tr>
    {/each}
  </tbody>
</table>
```

## Now make the headers sort

Add the feature, add the row model, and hang
`h.column.getToggleSortingHandler()` on the header. The indicator is markup you
write, because the engine has no opinion about what a sorted header looks like.

```svelte {runnable}
<script lang="ts">
  import {
    createSvGrid,
    createCoreRowModel,
    createSortedRowModel,
    tableFeatures,
    rowSortingFeature,
    type ColumnDef,
  } from '@svgrid/grid'

  type Repo = { name: string; lang: string; stars: number }

  const data: Repo[] = [
    { name: 'svelte',   lang: 'JavaScript', stars: 78000 },
    { name: 'vite',     lang: 'TypeScript', stars: 68000 },
    { name: 'sv-grid',  lang: 'TypeScript', stars: 172 },
    { name: 'rollup',   lang: 'JavaScript', stars: 25000 },
    { name: 'esbuild',  lang: 'Go',         stars: 38000 },
    { name: 'tinygo',   lang: 'Go',         stars: 15000 },
    { name: 'bun',      lang: 'Zig',        stars: 74000 },
    { name: 'zig',      lang: 'Zig',        stars: 35000 },
  ]

  const features = tableFeatures({ rowSortingFeature })

  const columns: ColumnDef<typeof features, Repo>[] = [
    { field: 'name',  header: 'Repo' },
    { field: 'lang',  header: 'Language' },
    { field: 'stars', header: 'Stars' },
  ]

  let sorting = $state([{ id: 'stars', desc: true }])

  const table = createSvGrid({
    _features: features,
    _rowModels: {
      coreRowModel: createCoreRowModel<Repo>(),
      sortedRowModel: createSortedRowModel<Repo>(),
    },
    data,
    columns,
    state: { sorting },
    onSortingChange: (u) => (sorting = typeof u === 'function' ? u(sorting) : u),
  })

  const rows = $derived(table.getRowModel().rows)
  const arrow = (id: string) =>
    sorting[0]?.id === id ? (sorting[0].desc ? ' v' : ' ^') : ''
</script>

<table>
  <thead>
    {#each table.getHeaderGroups() as hg (hg.id)}
      <tr>
        {#each hg.headers as h (h.id)}
          <th style="cursor: pointer;" onclick={h.column.getToggleSortingHandler()}>
            {h.column.columnDef.header}{arrow(h.column.id)}
          </th>
        {/each}
      </tr>
    {/each}
  </thead>
  <tbody>
    {#each rows as r (r.id)}
      {@const repo = r.original as Repo}
      <tr>
        <td>{repo.name}</td>
        <td>{repo.lang}</td>
        <td>{repo.stars.toLocaleString()}</td>
      </tr>
    {/each}
  </tbody>
</table>
```

## See also

- [Row models](./row-models.md) - add pagination, grouping, expansion
- [Controlled state](./controlled-state.md) - lift state out of the component
- [Styling a headless table](./styling.md) - make it look good, your way
- [Headless virtualization](./virtualization.md) - do this for 100k rows
- [Cell components](../cells/cell-components.md) - render snippet/component cells in your own table
