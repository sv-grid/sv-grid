# Headless engine reference

> `<SvGrid>` is the renderer. `createSvGrid` is the engine that powers it. They
> are independent: the engine runs with no DOM, no CSS and no Svelte component,
> so you can drive your own markup, a server, a worker, or a test.

This page is the API reference. For the guided introduction start with
[Headless overview](../help/headless/overview.md), then
[Build a table from scratch](../help/headless/build-a-table.md).

- [Entry points](#entry-points)
- [`createSvGrid(options, selector?)`](#createsvgridoptions-selector)
- [Options](#options)
- [The instance](#the-instance)
- [State](#state)
- [The controlled state channel](#the-controlled-state-channel)
- [Row-model pipeline](#row-model-pipeline)
- [Row](#row)
- [Column, Header, HeaderGroup, Cell](#column-header-headergroup-cell)
- [Features](#features)
- [Sort and filter registries](#sort-and-filter-registries)
- [Row ids](#row-ids)
- [Reactivity helpers](#reactivity-helpers)
- [Recipes](#recipes)
- [Performance notes](#performance-notes)
- [Limits worth knowing](#limits-worth-knowing)

## Entry points

| Import | Runs where | Use for |
| ------ | ---------- | ------- |
| `createSvGrid` from `@svgrid/grid` | Anywhere the Svelte compiler is in the pipeline (Vite, SvelteKit, vitest) | A Svelte app or component that renders the engine itself |
| `createSvGridCore` from `@svgrid/grid/core` | Any JavaScript runtime, `node script.mjs` included | Services, workers, CLIs, plain unit tests |

`createSvGrid` is `createSvGridCore` plus one thing: a `$state`-backed
`grid.state` that re-derives through a selector, so a component re-renders when
the slice it read changes. Everything else on the instance is identical, and
every runtime symbol on `@svgrid/grid/core` is also on the main barrel - the
subpath exists so the headless bundle is measurable and so it can also export
the low-level types (`RowModelFactory`, `Store`, the individual state types)
that the barrel leaves out.

```ts
// Svelte app
import { createSvGrid } from '@svgrid/grid'

// Node / worker / test
import { createSvGridCore } from '@svgrid/grid/core'
```

## `createSvGrid(options, selector?)`

```ts
function createSvGrid<TFeatures extends TableFeatures, TData extends RowData, TSelected = {}>(
  options: SvGridOptions<TFeatures, TData>,
  selector?: (state: Record<string, any>) => TSelected,
): SvelteGrid<TFeatures, TData, TSelected>
```

The optional `selector` decides what `grid.state` exposes reactively. Without
it, `grid.state` is an empty object and you read state through `getState()`.

```svelte
<script lang="ts">
  import { createSvGrid, createCoreRowModel, createSortedRowModel,
           tableFeatures, rowSortingFeature } from '@svgrid/grid'

  type Repo = { name: string; lang: string; stars: number }

  const features = tableFeatures({ rowSortingFeature })
  const grid = createSvGrid(
    {
      _features: features,
      _rowModels: {
        coreRowModel: createCoreRowModel<Repo>(),
        sortedRowModel: createSortedRowModel<Repo>(),
      },
      columns: [
        { field: 'name', header: 'Repository' },
        { field: 'stars', header: 'Stars', editorType: 'number' },
      ],
      data,
    },
    // Only re-render when the sort changes.
    (state) => ({ sorting: state.sorting }),
  )

  const rows = $derived(grid.getRowModel().rows)
</script>

{#each rows as row (row.id)}
  <p>{(row.original as Repo).name} - {grid.state.sorting.length} sort clauses</p>
{/each}
```

## Options

`SvGridOptions<TFeatures, TData>`:

| Option | Type | Notes |
| ------ | ---- | ----- |
| `_features` | `TFeatures` | Required. Build it with [`tableFeatures({...})`](./features.md). Decides which capabilities the columns report (`getCanSort`, `getCanFilter`). |
| `_rowModels` | `{ coreRowModel?, filteredRowModel?, sortedRowModel?, groupedRowModel?, expandedRowModel?, paginatedRowModel? }` | The pipeline stages, each a `RowModelFactory<TData>`. Register only the ones you need; the rest tree-shake out. `coreRowModel` is effectively required - with no stages at all you get the base rows and nothing else. |
| `columns` | `Array<ColumnDef<TFeatures, TData>>` | Column definitions. See [ColumnDef](./ColumnDef.md). |
| `data` | `ReadonlyArray<TData>` | The source rows. Never mutated by the engine. |
| `getRowId` | `(row: TData, index: number) => string` | Stable row ids. See [Row ids](#row-ids). |
| `state` | `Partial<Record<string, any>>` | Seeds (and, in a controlled setup, owns) the state slices. See [State](#state). |
| `onSortingChange` | `(updater: Updater<SortingState>) => void` | Called by `setSorting` with the exact argument it received. |
| `onColumnFiltersChange` | `(updater: Updater<ColumnFiltersState>) => void` | Called by `setColumnFilters`. |
| `onPaginationChange` | `(updater: Updater<PaginationState>) => void` | Called by `setPagination`. |
| `onGroupingChange` | `(updater: Updater<GroupingState>) => void` | Called by `setGrouping`. |
| `onExpandedChange` | `(updater: Updater<ExpandedState>) => void` | Called by `setExpanded` and by `row.toggleExpanded()`. |
| `onRowSelectionChange` | `(updater: Updater<RowSelectionState>) => void` | Called by `setRowSelection` and by `row.toggleSelected()`. |
| `onActiveCellChange` | `(updater: Updater<ActiveCellState>) => void` | Called by `setActiveCell` and `moveActiveCell`. |

Options are read live through the options store, so `setOptions` swaps any of
them - `data` and `columns` included - and the next `getRowModel()` reflects it.

## The instance

`SvGrid<TData>`:

### Reading

| Member | Signature | Notes |
| ------ | --------- | ----- |
| `getRowModel` | `() => { rows: Array<Row<TData>> }` | The post-pipeline rows, in display order. Lazy and cached: recomputed when the data identity, the columns or a state slice a stage reads actually changes. |
| `getAllColumns` | `() => Array<Column<TData>>` | The LEAF columns, in definition order. A group column (`columns: [...]`) contributes its children, not itself. |
| `getHeaderGroups` | `() => Array<HeaderGroup<TData>>` | One group (`header_group_0`) holding one `Header` per leaf column. See [the note below](#column-header-headergroup-cell) about multi-level headers. |
| `getFooterGroups` | `() => Array<HeaderGroup<TData>>` | The same shape, for rendering a footer row from each column's `footer` slot. |
| `getState` | `() => Record<string, any>` | The whole state object. Cheap - it returns the store's current value. |
| `state` | `Record<string, any>` | On `createSvGrid`, the reactive projection through your `selector`. On `createSvGridCore`, the raw state object. |
| `store` | `Store<Record<string, any>>` | The state store: `state`, `setState(updater)`, `subscribe(listener)`. Subscribing is how a non-Svelte renderer re-renders. |
| `optionsStore` | `Store<Record<string, any>>` | The options store, written by `setOptions`. |

### Writing

Every setter takes a value **or** an updater function, and calls the matching
`on*Change` option with the argument it was given.

| Member | Signature |
| ------ | --------- |
| `setSorting` | `(updater: Updater<SortingState>) => void` |
| `setColumnFilters` | `(updater: Updater<ColumnFiltersState>) => void` |
| `setPagination` | `(updater: Updater<PaginationState>) => void` |
| `setGrouping` | `(updater: Updater<GroupingState>) => void` |
| `setExpanded` | `(updater: Updater<ExpandedState>) => void` |
| `setRowSelection` | `(updater: Updater<RowSelectionState>) => void` |
| `setActiveCell` | `(updater: Updater<ActiveCellState>) => void` |
| `moveActiveCell` | `(next: { rowDelta?: number; colDelta?: number }) => void` |
| `setOptions` | `(updater: Updater<Record<string, any>>) => void` |

`moveActiveCell` clamps to the displayed bounds, so `{ rowDelta: -1 }` on the
first row is a no-op rather than a negative index. It is the whole keyboard
navigation primitive: the renderer maps arrow keys onto deltas.

```ts
grid.setSorting([{ id: 'stars', desc: true }])
grid.setSorting((prev) => [...prev, { id: 'name', desc: false }])  // multi-sort
grid.setColumnFilters([{ id: 'lang', value: 'Rust', fn: 'equals' }])
grid.setExpanded((prev) => ({ ...prev, group_lang_Rust: true }))
grid.setOptions((prev) => ({ ...prev, data: nextPage }))
```

## State

The engine seeds these slices, then reads them on every pipeline run. Anything
you pass in `options.state` overrides the seed.

| Slice | Type | Default | Read by |
| ----- | ---- | ------- | ------- |
| `sorting` | `Array<{ id: string; desc: boolean }>` | `[]` | `sortedRowModel` |
| `columnFilters` | `Array<{ id: string; value: unknown; fn?: keyof typeof filterFns }>` | `[]` | `filteredRowModel` |
| `pagination` | `{ pageIndex: number; pageSize: number }` | `{ pageIndex: 0, pageSize: data.length || 10 }` | `paginatedRowModel` |
| `grouping` | `Array<string>` | `[]` | `groupedRowModel` |
| `expanded` | `Record<string, boolean>` | `{}` | `expandedRowModel` |
| `rowSelection` | `Record<string, boolean>` | `{}` | `row.getIsSelected()` |
| `activeCell` | `{ rowIndex: number; colIndex: number; cellId: string \| null }` | `{ rowIndex: 0, colIndex: 0, cellId: null }` | your renderer |

The `pagination` default is worth a second look: `pageSize` starts at the row
count, so an engine with `paginatedRowModel` registered and no `pagination`
state shows everything rather than the first 10 rows.

`sorting` is ordered: the first clause is the primary sort, the rest break ties.
`grouping` is ordered the same way, outermost group first.

## The controlled state channel

State goes in through `options.state`; changes come out through the
`on*Change` callbacks. The engine never writes into the object you passed - it
calls your handler with the next value (or an updater) and re-reads `state` on
the next render. That is what makes it compose with Svelte 5 runes:

```svelte
<script lang="ts">
  import { createSvGrid, createCoreRowModel, createSortedRowModel,
           tableFeatures, rowSortingFeature, type SortingState } from '@svgrid/grid'

  let sorting = $state<SortingState>([])

  const grid = $derived.by(() =>
    createSvGrid({
      _features: tableFeatures({ rowSortingFeature }),
      _rowModels: {
        coreRowModel: createCoreRowModel<Repo>(),
        sortedRowModel: createSortedRowModel<Repo>(),
      },
      columns,
      data,
      state: { sorting },
      onSortingChange: (updater) => {
        sorting = typeof updater === 'function' ? updater(sorting) : updater
      },
    }),
  )
</script>
```

Uncontrolled works too: leave the callbacks off and the engine keeps the state
in its own store, which is what the `<SvGrid>` renderer does for most slices.

`Updater<T>` is `T | ((prev: T) => T)`, which is why every handler needs the
`typeof updater === 'function'` branch. [Controlled
state](../help/headless/controlled-state.md) has the longer treatment, including
`createGridState` and sharing one state object across two grids.

## Row-model pipeline

Stages run in this order, each one taking the previous stage's rows:

```
data -> coreRowModel -> filteredRowModel -> sortedRowModel
     -> groupedRowModel -> expandedRowModel -> paginatedRowModel
```

| Factory | Reads | Notes |
| ------- | ----- | ----- |
| `createCoreRowModel()` | - | Identity. The base rows, built lazily from `data`. |
| `createFilteredRowModel()` | `columnFilters` | Each clause resolves its match function once, then filters. Defaults to `filterFns.includesString`. |
| `createSortedRowModel(sortFns?)` | `sorting` | Comparator per clause, picked from the column's `editorType` (`number` / `date` / `datetime` get the numeric and date comparators). Pass your own registry to override. |
| `createGroupedRowModel()` | `grouping` | Buckets rows and inserts one group row per bucket, carrying that bucket's aggregates. |
| `createTreeRowModel({ parentField, idField? })` | - | Replaces `groupedRowModel` for parent-id hierarchies. `idField` defaults to `'id'`. |
| `createExpandedRowModel()` | `expanded` | Flattens the tree, dropping the children of collapsed rows. |
| `createPaginatedRowModel()` | `pagination` | Slices to the current page. Must be last - anything after it only sees one page. |

A stage you do not register is not just skipped, it is absent: with no
`sortedRowModel`, `sorting` state changes nothing. The reverse also holds, and
catches people out - a registered stage applies its state even if the matching
feature is missing from `_features`. Register both, or you get sorted rows whose
headers report `getCanSort() === false`.

`<SvGrid>` deliberately leaves `paginatedRowModel` out of its pipeline: it
applies its own filter overlays first and paginates after, so the filter UI sees
the whole dataset rather than the visible page.

### Writing your own stage

A stage is a plain function, so a custom one needs no plugin API:

```ts
import type { RowModelFactory, Row } from '@svgrid/grid/core'

/** Keep only rows the current user owns. */
const ownedRowModel = <T extends { ownerId: string }>(userId: string): RowModelFactory<T> =>
  ({ rows }) => rows.filter((row: Row<T>) => row.original.ownerId === userId)

const grid = createSvGridCore({
  _features: features,
  _rowModels: {
    coreRowModel: createCoreRowModel<Doc>(),
    // Any slot takes any factory; this one replaces the filter stage.
    filteredRowModel: ownedRowModel<Doc>('u-42'),
  },
  columns,
  data,
})
```

## Row

`Row<TData>`:

| Member | Type | Notes |
| ------ | ---- | ----- |
| `id` | `string` | `getRowId(row, index)` when set, otherwise the row's index as a string. Group rows get `group_<columnId>_<value>`. |
| `index` | `number` | Position in the displayed model, not in `data`. |
| `original` | `TData` | Your untouched row object. On a GROUP row this is synthesized - see below. |
| `depth` | `number` | 0 for a top-level row, +1 per nesting level. |
| `subRows` | `Array<Row<TData>>` \| `undefined` | Children, on group and tree rows. |
| `leafCount` | `number` \| `undefined` | Data rows beneath a group row. Undefined on data rows. |
| `getCanExpand` | `() => boolean` | True for group rows and tree parents. The cleanest test for "is this a banner". |
| `getIsExpanded` | `() => boolean` | Reads `expanded[row.id]`. |
| `toggleExpanded` | `() => void` | Flips it through `setExpanded`, so `onExpandedChange` fires. |
| `getIsSelected` | `() => boolean` | Reads `rowSelection[row.id]`. |
| `toggleSelected` | `() => void` | Flips it through `setRowSelection`. |
| `getAllCells` | `() => Array<Cell<TData>>` | One cell per column, built on first call. Empty on group rows. |
| `getCellValueByColumnId` | `(columnId: string) => unknown` | The cheap read: no `Cell` objects are built. Returns `undefined` for an unknown column. |

**A group row's `original` is not one of your rows.** It is an object built per
column: the column's `aggregate` result where one is declared, otherwise the
value every child shares (and `undefined` when they disagree). So a one-row
group reads back like its only child, and a `row.original ? leaf : banner` test
is wrong. Use `getCanExpand()`, `subRows`, or `leafCount`:

```ts
const dataRows = grid.getRowModel().rows.filter((row) => !row.getCanExpand())
```

## Column, Header, HeaderGroup, Cell

```ts
type Column<TData> = {
  id: string
  columnDef: ColumnDef<any, TData>
  depth: number
  parentId?: string
  getCanSort: () => boolean
  getCanFilter: () => boolean
  getIsSorted: () => false | 'asc' | 'desc'
  getToggleSortingHandler: () => () => void
}

type Header<TData> = {
  id: string
  isPlaceholder: boolean
  colSpan: number
  column: Column<TData>
  getContext: () => { header: Header<TData>; column: Column<TData>; table: SvGrid<TData> }
}

type HeaderGroup<TData> = { id: string; headers: Array<Header<TData>> }

type Cell<TData> = {
  id: string
  row: Row<TData>
  column: Column<TData>
  getValue: () => unknown
  getContext: () => CellContext<TData>
}
```

`getToggleSortingHandler()` returns the click handler a header needs: it cycles
asc -> desc -> none for that column and honours the column's `sortable` opt-out.

```svelte
{#each grid.getHeaderGroups() as group (group.id)}
  <tr>
    {#each group.headers as header (header.id)}
      <th onclick={header.column.getToggleSortingHandler()}>
        {header.column.columnDef.header}
        {header.column.getIsSorted() === 'asc' ? '▲' : header.column.getIsSorted() === 'desc' ? '▼' : ''}
      </th>
    {/each}
  </tr>
{/each}
```

**Header levels.** The engine emits a single header group: one `Header` per leaf
column, always `colSpan: 1` and `isPlaceholder: false`. It does not build a
multi-level header tree from nested `columns: [...]` definitions - `<SvGrid>`
renders the group-header row itself, on top of this flat list. If your own
renderer needs spanning group headers, walk your `columns` definitions for the
upper levels and use `getHeaderGroups()` for the leaf row.

## Features

A feature is a marker the engine checks for capabilities; it carries no logic of
its own. `tableFeatures({...})` is an identity function whose only job is to
give TypeScript a precise type.

| Feature | Turns on |
| ------- | -------- |
| `rowSortingFeature` | `column.getCanSort()`, the header toggle handler, sort indicators |
| `columnFilteringFeature` | `column.getCanFilter()`, the filter surfaces |
| `columnGroupingFeature` | Group-by plus aggregated group rows |
| `rowExpandingFeature` | Expand / collapse on group and tree rows |
| `rowPaginationFeature` | The pager and page slicing |
| `rowSelectionFeature` | Row selection state and the checkbox column |

See the [features reference](./features.md) for what each one costs and which
help page covers it.

## Sort and filter registries

```ts
import { sortFns, filterFns } from '@svgrid/grid'
```

`sortFns` has three comparators, and a column's `editorType` picks one:

| Name | Used for | Behaviour |
| ---- | -------- | --------- |
| `auto` | Anything not numeric or date-typed | `String(a).localeCompare(String(b))` |
| `number` | `editorType: 'number'` | Numeric, `null` / `undefined` treated as 0 |
| `date` | `editorType: 'date' \| 'datetime'` | `new Date(value).getTime()` difference |

`filterFns` has two, and a clause names one through `fn`:

| Name | Behaviour |
| ---- | --------- |
| `includesString` | Case-insensitive substring. **The default** when a clause sets no `fn`. |
| `equals` | Strict identity (`===`), so `'30'` does not match `30`. |

```ts
grid.setColumnFilters([
  { id: 'lang', value: 'rust' },                  // includesString: matches 'Rust'
  { id: 'stars', value: 30_000, fn: 'equals' },   // strict
])
```

The registry is a plain object, so you can add your own match function at
runtime and name it from a clause:

```ts
import { filterFns } from '@svgrid/grid'

;(filterFns as Record<string, (value: unknown, query: unknown) => boolean>).startsWith =
  (value, query) => String(value).toLowerCase().startsWith(String(query).toLowerCase())

grid.setColumnFilters([{ id: 'name', value: 'sv', fn: 'startsWith' as never }])
```

TypeScript does not know about the new key, hence the cast on `fn`. The richer
operator set the `<SvGrid>` filter UI uses (`between`, `regex`, `notContains`,
`in`, the blank checks) lives in
[`@svgrid/grid/filtering`](../help/filtering/overview.md) and is applied by the
renderer, not by `filteredRowModel`.

## Row ids

Without `getRowId`, a row's id is its index in `data` as a string - so
selection, expansion and the active cell follow positions, and a re-sort or a
server refetch moves them. Pass a stable id and they follow rows instead:

```ts
createSvGridCore({ /* ... */, getRowId: (row) => row.uuid })
```

Group row ids are always `group_<columnId>_<value>` (e.g.
`group_lang_TypeScript`), which is also the key `expanded` uses for them.

## Reactivity helpers

| Helper | Signature | Use |
| ------ | --------- | --- |
| `createGridState(initial)` | `[() => T, (updater: Updater<T>) => void]` | A rune-backed getter/setter pair, for hoisting a state slice out of the component that renders the grid. |
| `subscribeGrid(grid, selector)` | `{ current: TSelected }` | Watch one slice from outside a component, with a shallow-compare guard. |
| `grid.store.subscribe(fn)` | `() => void` (unsubscribe) | The raw channel a non-Svelte renderer uses to re-render. |

```ts
import { subscribeGrid } from '@svgrid/grid'

const selection = subscribeGrid(grid, (state) => state.rowSelection)
// later: selection.current
```

## Recipes

### Render your own `<table>`

The [build-a-table guide](../help/headless/build-a-table.md) walks the whole
file; the shape is:

```svelte
<script lang="ts">
  const rows = $derived(grid.getRowModel().rows)
  const headers = $derived(grid.getHeaderGroups()[0]?.headers ?? [])
</script>

<table>
  <thead>
    <tr>
      {#each headers as header (header.id)}
        <th onclick={header.column.getToggleSortingHandler()}>
          {header.column.columnDef.header}
        </th>
      {/each}
    </tr>
  </thead>
  <tbody>
    {#each rows as row (row.id)}
      <tr>
        {#each headers as header (header.id)}
          <td>{row.getCellValueByColumnId(header.column.id) ?? ''}</td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>
```

### Run the pipeline in Node

```ts
import {
  createSvGridCore, createCoreRowModel, createFilteredRowModel,
  createSortedRowModel, tableFeatures, rowSortingFeature, columnFilteringFeature,
} from '@svgrid/grid/core'

export function queryRows(data: Repo[], sorting: SortingState, filters: ColumnFiltersState) {
  const grid = createSvGridCore({
    _features: tableFeatures({ rowSortingFeature, columnFilteringFeature }),
    _rowModels: {
      coreRowModel: createCoreRowModel<Repo>(),
      filteredRowModel: createFilteredRowModel<Repo>(),
      sortedRowModel: createSortedRowModel<Repo>(),
    },
    columns,
    data,
    state: { sorting, columnFilters: filters },
  })
  return grid.getRowModel().rows.map((row) => row.original)
}
```

No Svelte compiler, no DOM: the same sorting and filtering the UI does, usable
in a request handler, a worker, or a snapshot test.

### Server-side data

Register `coreRowModel` only, keep the state controlled, and refetch in the
callbacks - the server does the sorting, filtering and paging. Full walkthrough
in [Server-side data](../help/headless/server-side.md).

### Feed a virtualizer

`getRowModel().rows` is a plain array, so any virtualizer can window it. The
grid's own is exported for reuse - see
[Virtualization](../help/headless/virtualization.md).

## Performance notes

- **Rows and cells are lazy.** A base row builds its cell values on first read,
  and `getAllCells()` builds `Cell` objects only when you call it. Prefer
  `row.getCellValueByColumnId(id)` in hot paths (filters, exporters): it reads
  the same cached values without allocating a cell per column.
- **The row model is cached** against the identity of `data`, the columns, the
  registered stages and the state slices the stages read. Passing a new array
  with equal contents invalidates it; mutating the existing array does not.
- **Rows serialize small.** A row's back-pointer to the table is held under a
  symbol key, so `JSON.stringify(row)` stays a small constant instead of
  dragging the whole dataset in.
- **Registering fewer stages is cheaper**, both in bundle bytes and per update.

## Limits worth knowing

- `getHeaderGroups()` is one flat level of leaf headers - no spanning group
  headers, no placeholders. See [Header levels](#column-header-headergroup-cell).
- A group row's `original` is synthesized, not one of your rows.
- `filteredRowModel` understands `includesString` and `equals` only; the
  Excel-style operator set belongs to the renderer.
- `createSvGrid` needs the Svelte compiler. In plain Node use
  `createSvGridCore`.

## See also

- [Headless overview](../help/headless/overview.md) - the guided introduction
- [Build a table from scratch](../help/headless/build-a-table.md)
- [Controlled state](../help/headless/controlled-state.md)
- [Row models](../help/headless/row-models.md)
- [Server-side data](../help/headless/server-side.md)
- [Features reference](./features.md)
- [`ColumnDef`](./ColumnDef.md)
- [Why headless?](../why-headless.md)
- [Bundle size](./bundle-size.md) - what skipping the renderer saves
