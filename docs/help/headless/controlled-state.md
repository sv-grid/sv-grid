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
  enableSorting: true,
} as never))
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
  onSortingChange: (u) => setSorting(u as never),
} as never))
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
  onSortingChange: (u) => setSorting(u as never),
} as never))

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

## See also

- [Row models](./row-models.md) - each channel feeds one pipeline step
- [Build a table from scratch](./build-a-table.md)
- [Named views](../state/named-views.md) - the `<SvGrid>` state save/restore equivalent
