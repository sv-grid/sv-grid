# Headless engine

> `<SvGrid>` is the renderer. `createSvGrid` is the engine that powers
> it. They are independent - you can use the engine without the
> renderer to build a custom UI, drive a server, run logic in a worker,
> or test reducer code.

## What you get from the headless API

`createSvGrid(options)` returns a table object with:

- `getRowModel(): { rows: Row<TData>[] }` - the final post-pipeline row
  list (filtered, sorted, grouped, expanded, paginated)
- `getHeaderGroups(): HeaderGroup<TData>[]` - the multi-level column
  header tree
- `getAllColumns(): Column<TData>[]` - every column object with
  metadata (id, visible, pinned, width)
- `setSorting`, `setColumnFilters`, `setRowSelection`, ... - imperative
  setters that update the engine's internal store

No DOM, no styles, no virtualisation. A `<SvGrid>` consumer never sees
these directly - the renderer reads the row model and emits the
markup.

## When to reach for headless

| Want to...                                       | Use                                         |
| ------------------------------------------------ | ------------------------------------------- |
| Render with a different framework (React, Vue)   | Embed via [`sv-grid-wc`](../help/wc.md) or wrap `createSvGrid` yourself |
| Render as `<table>` for print / email export     | Headless                                    |
| Drive a server-side row model from Node          | Headless                                    |
| Unit-test sort / filter / aggregator logic       | Headless                                    |
| Build a custom virtualised renderer              | Headless + the virtualiser exports          |

For the standard case (rich grid in a Svelte app), use `<SvGrid>`.

## Wiring up - the minimum surface

When you bypass `<SvGrid>`, you must wire the row models you want
explicitly. `<SvGrid>` does this for you under the hood.

```ts
import {
  createSvGrid,
  createCoreRowModel,
  createSortedRowModel,
  createFilteredRowModel,
  tableFeatures,
  rowSortingFeature,
  columnFilteringFeature,
  type ColumnDef,
} from 'sv-grid-core'

type Repo = { name: string; lang: string; stars: number }

const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
const columns: ColumnDef<typeof features, Repo>[] = [
  { field: 'name',  header: 'Name'  },
  { field: 'lang',  header: 'Lang'  },
  { field: 'stars', header: 'Stars' },
]
const data: Repo[] = [/* ... */]

// Reactive state - Svelte 5 $state lifts the engine into reactivity.
type Sort = { id: string; desc: boolean }
type Filter = { id: string; value: unknown }
let sorting       = $state<Sort[]>([])
let columnFilters = $state<Filter[]>([])

const table = $derived.by(() =>
  createSvGrid({
    _features: features,
    _rowModels: {
      coreRowModel:     createCoreRowModel<Repo>(),
      sortedRowModel:   createSortedRowModel<Repo>(),
      filteredRowModel: createFilteredRowModel<Repo>(),
    },
    data,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: (u) =>
      (sorting = typeof u === 'function' ? (u as (s: Sort[]) => Sort[])(sorting) : u),
    onColumnFiltersChange: (u) =>
      (columnFilters = typeof u === 'function' ? (u as (f: Filter[]) => Filter[])(columnFilters) : u),
    enableSorting: true,
    enableColumnFilters: true,
  } as never),
)

const headerGroups = $derived(table.getHeaderGroups())
const rows         = $derived(table.getRowModel().rows)
```

The whole renderer is now under 30 lines of template:

```svelte
<table>
  <thead>
    {#each headerGroups as hg (hg.id)}
      <tr>
        {#each hg.headers as h (h.id)}
          <th onclick={() => toggleSort(h.column.id)}>
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

## Row model pipeline

The pipeline runs in this order, each step lazy:

```
data → coreRowModel → filteredRowModel → sortedRowModel → groupedRowModel → expandedRowModel → paginatedRowModel
```

Pass only the steps you need into `_rowModels`. Unused steps are
tree-shaken. The example above skips grouping and pagination because
the demo doesn't need them.

## The `state` channel is controlled

Pass `state` in, get change callbacks out. The engine never mutates
your state - it calls your `onXxxChange` handler with the next value
(or an updater function) and re-reads `state` on the next render.

That's why this pattern works with Svelte 5's `$state`: the engine
reads from reactive state and emits to reactive setters; the row model
re-derives on every change.

## See also

- [Features reference](./features.md) - what each feature contributes
- [Architecture overview](../help/architecture.md) - why headless first
- [Build your own feature plugin recipe](../recipes/build-a-feature-plugin.md)
- [Bundle size reference](./bundle-size.md) - what you save by skipping the renderer
