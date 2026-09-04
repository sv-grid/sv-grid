# Controlled state

The engine never owns its state - **you do**. You pass `state` in and the engine
calls your `onXxxChange` handlers with the next value. That one rule is what
makes headless SvGrid click with Svelte 5 `$state`, and it's what lets state
survive an unmount or be shared across two grids.

## The in/out contract

```ts
let sorting = $state<{ id: string; desc: boolean }[]>([])

const table = $derived.by(() => createSvGrid({
  _features: features,
  _rowModels: { coreRowModel: createCoreRowModel<Row>(), sortedRowModel: createSortedRowModel<Row>() },
  data, columns,
  state: { sorting },                         // ── in
  onSortingChange: (u) =>                      // ── out
    (sorting = typeof u === 'function' ? u(sorting) : u),
}))
```

The handler receives either the next value **or** an updater function - always
handle both (`typeof u === 'function' ? u(prev) : u`). Because `sorting` is
`$state` and `table` is `$derived`, changing it re-runs the pipeline.

The same shape applies to every state channel: `onColumnFiltersChange`,
`onPaginationChange`, `onGroupingChange`, `onExpandedChange`,
`onRowSelectionChange`, `onColumnVisibilityChange`.

## `createGridState` - lift state out of the component

Sometimes you want a piece of state to live **outside** the grid: so it survives
an unmount, persists to storage, or is shared by two grids. `createGridState`
returns a `[get, set]` tuple - a reactive store you own (`createSvGridState` is
an alias).

```ts
import { createGridState } from '@svgrid/grid'

// [getter, setter] - the getter reads reactive $state, the setter takes a
// value or an updater function.
const [getSorting, setSorting] = createGridState<Sort[]>([])

setSorting([{ id: 'stars', desc: true }])   // set a value
setSorting((prev) => [...prev])             // or an updater
console.log(getSorting())                    // read it
```

Wire it into a grid via the `state` / `onXxxChange` channel:

```ts
const table = $derived.by(() => createSvGrid({
  get data() { return rows },
  get columns() { return columns },
  state: { sorting: getSorting() },
  onSortingChange: setSorting,   // the setter already handles updaters
}))
```

### Share one store across two grids

Pass the **same** `[get, set]` pair to two engines and they stay in lockstep -
sort in one, the other re-sorts, because both read the same reactive store.

<div data-docs-demo="189-headless-shared-state" data-height="460"></div>

```ts
const [getSorting, setSorting] = createGridState<Sort[]>([])

const makeGrid = () => $derived.by(() => createSvGrid({
  get data() { return rows }, get columns() { return columns },
  state: { sorting: getSorting() },
  onSortingChange: setSorting,
}))

const gridA = makeGrid()
const gridB = makeGrid()   // shares getSorting/setSorting -> stays in sync
```

## `subscribeGrid` - react outside a component

Inside a Svelte component, `$effect` is the natural way to react to grid
changes. Outside one - a Svelte action, an analytics hook, an integration test -
use `subscribeGrid` for a plain pub/sub interface (`subscribeSvGrid` is an
alias).

```ts
import { subscribeGrid } from '@svgrid/grid'

const unsub = subscribeGrid(table, (event) => {
  if (event.type === 'sorting') analytics.track('grid_sort', event.value)
  if (event.type === 'rowSelection') syncSelectionToUrl(event.value)
})

// later
unsub()
```

## You own the state

Every slice you pass in `state` is yours: the engine reads it and reports
changes through the matching `on*Change`, but never writes it. That is what lets
the same value drive a URL, a saved view, or two grids at once.

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
  ]

  const features = tableFeatures({ rowSortingFeature })
  const columns: ColumnDef<typeof features, Repo>[] = [
    { field: 'name',  header: 'Repo' },
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
</script>

<button type="button" onclick={() => (sorting = [{ id: 'name', desc: false }])}>
  Sort by name from outside
</button>

<p>State: <code>{JSON.stringify(sorting)}</code></p>

<ol>
  {#each rows as r (r.id)}
    {@const repo = r.original as Repo}
    <li>{repo.name} - {repo.stars.toLocaleString()}</li>
  {/each}
</ol>
```


## The updater can be a function

An `on*Change` hands you either the next value or a function of the previous
one, the way `setState` does. Handling only the value silently drops the toggle
path, and a header click stops working.

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
  ]

  const features = tableFeatures({ rowSortingFeature })
  const columns: ColumnDef<typeof features, Repo>[] = [
    { field: 'name',  header: 'Repo' },
    { field: 'stars', header: 'Stars' },
  ]

  let sorting = $state<Array<{ id: string; desc: boolean }>>([])
  let updates = $state(0)

  const table = createSvGrid({
    _features: features,
    _rowModels: {
      coreRowModel: createCoreRowModel<Repo>(),
      sortedRowModel: createSortedRowModel<Repo>(),
    },
    data,
    columns,
    state: { sorting },
    onSortingChange: (u) => {
      // Both shapes. Dropping the function branch is the classic bug here.
      sorting = typeof u === 'function' ? u(sorting) : u
      updates += 1
    },
  })

  const rows = $derived(table.getRowModel().rows)
</script>

<table>
  <thead>
    {#each table.getHeaderGroups() as hg (hg.id)}
      <tr>
        {#each hg.headers as h (h.id)}
          <th onclick={h.column.getToggleSortingHandler()}>{h.column.columnDef.header}</th>
        {/each}
      </tr>
    {/each}
  </thead>
  <tbody>
    {#each rows as r (r.id)}
      {@const repo = r.original as Repo}
      <tr><td>{repo.name}</td><td>{repo.stars.toLocaleString()}</td></tr>
    {/each}
  </tbody>
</table>

<p>{updates} sort update(s)</p>
```

## See also

- [Row models](./row-models.md) - each channel feeds one pipeline step
- [Build a table from scratch](./build-a-table.md)
- [Named views](../state/named-views.md) - the `<SvGrid>` state save/restore equivalent
