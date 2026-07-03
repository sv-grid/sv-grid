---
title: SvGrid vs TanStack Table - A Deep Dive
description: A concrete architectural comparison of SvGrid and TanStack Table's Svelte adapter - how each handles reactivity, rendering, and feature composition, with code that shows exactly where they diverge.
date: 2026-09-13
updated: "2026-07-02"
category: Comparisons
tags: comparison, tanstack table, svelte data grid, headless
author: Kamelia M
---

Both libraries call themselves "headless-first." That framing is accurate for both but obscures the part that actually matters when you are picking one for a Svelte 5 project: they are headless in completely different ways, with different reactivity models and different assumptions about how much rendering you want to own.

Here is the short version. TanStack Table is a framework-agnostic engine with a Svelte adapter bolted on. SvGrid's headless core (`createSvGrid`) was written for Svelte 5 runes from the start, and the render component (`<SvGrid>`) is a thin layer on top of that same core. If you want a prebuilt table that plugs in and works, pick SvGrid. If you want total markup control and are comfortable assembling your own scroll container and filter UI, either library can work, but the runes-native internals of SvGrid mean less impedance when you reach into the internals.

The rest of this post goes through the concrete differences: reactivity, feature composition, rendering, and the practical "when to choose each" question.

## How reactivity actually differs

TanStack Table's Svelte adapter wraps the core engine in a writable store. When you call `table.setOptions(updater)`, the store updates, which triggers a re-render cycle. The table instance itself is re-created (or patched) on each store change. This is invisible most of the time, but it means change detection runs through Svelte's store subscription layer rather than Svelte 5's signal graph. In practice you call `setOptions` explicitly when you want the table to respond to something external - say, new server data arriving.

SvGrid's internals are `$state` and `$derived` all the way down. The row model is a chain of derived computations:

```
rawData ($state) -> sorted rows ($derived) -> filtered rows ($derived) -> paginated rows ($derived) -> virtualizer window ($derived)
```

When you mutate the upstream `$state`, Svelte's fine-grained tracking re-runs exactly the affected stages. There are no manual `invalidate` calls, no store subscriptions, and no re-creation of a table instance. The downside is that mutating an array in place does not trigger anything - `$state` tracks identity, not deep mutation. Reassign the array or use the imperative API:

```ts
// Does nothing - SvGrid does not see in-place mutation
rows.push(newRow)

// Triggers a re-render - new array reference
rows = [...rows, newRow]

// Also correct - API handles the update
api?.addRow(newRow)
api?.applyTransaction({ add: [newRow] })
```

This is not a SvGrid quirk. It is standard Svelte 5 `$state` behavior. The reason it bites people is that TanStack Table's adapter is less strict about it because the store-based update cycle catches a broader class of mutations.

## Feature composition and TypeScript inference

Both libraries use a feature composition pattern. TanStack Table v8 introduced `_features` on the table options object. SvGrid uses `tableFeatures(...)` to declare exactly which capabilities you need. The practical difference is that SvGrid's type inference flows from the features object at compile time - the shape of column defs and the `SvGridApi` are both inferred from what you pass to `tableFeatures`.

```ts
import {
  tableFeatures,
  rowSortingFeature,
  columnFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  type ColumnDef,
  type SvGridApi,
} from '@svgrid/grid'

// Features are declared once, outside the component
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
})

type Row = {
  id: string
  name: string
  revenue: number
  region: string
}

// ColumnDef is typed against `features` - TypeScript catches mismatches
const columns: ColumnDef<typeof features, Row>[] = [
  { id: 'id',      field: 'id',      header: 'ID',      width: 80  },
  { id: 'name',    field: 'name',    header: 'Name',    width: 200 },
  { id: 'revenue', field: 'revenue', header: 'Revenue', width: 120,
    type: 'number', format: { type: 'currency', currency: 'USD' } },
  { id: 'region',  field: 'region',  header: 'Region',  width: 140 },
]

// SvGridApi is also typed against `features`
// - api.setPage() exists because rowPaginationFeature is included
// - api.getSelectedRows() exists because rowSelectionFeature is included
// - Remove a feature and the corresponding API methods disappear from the type
let api = $state<SvGridApi<typeof features, Row> | null>(null)
```

TanStack Table achieves similar type safety through generics on `createSvelteTable`, but the column def type is `ColumnDef<Row>` rather than parameterized on features. That means TypeScript cannot catch at compile time that you are calling a pagination method when pagination is not registered.

One thing to watch: `tableFeatures(...)` must be created once and reused. Creating it inside a reactive context or an event handler produces a new object on every tick, which forces a full grid re-initialization. Put it at module scope or in a component-level `const` outside any reactive block.

## The render layer

This is the clearest practical difference between the two libraries.

TanStack Table gives you the row model and nothing else. You write the `<table>` element, the `<thead>`, the `<tbody>`, the scroll container, and - critically - the virtualization layer. `@tanstack/svelte-virtual` exists for this purpose but it is a separate package you wire up yourself. For a simple table with 200 rows that is a reasonable 60-80 lines of markup. For 50,000 rows with pinned columns, horizontal scroll sync, and row grouping, the boilerplate compounds quickly.

SvGrid ships a render component that handles all of that:

```svelte
<script lang="ts">
  import SvGrid from '@svgrid/grid'
  import {
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,
    rowSelectionFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,
    rowSelectionFeature,
  })

  const columns: ColumnDef<typeof features, Row>[] = [
    { id: 'id',      field: 'id',      header: 'ID',      width: 80  },
    { id: 'name',    field: 'name',    header: 'Name',    width: 200, pinned: 'left' },
    { id: 'revenue', field: 'revenue', header: 'Revenue', width: 120, type: 'number',
      conditionalFormat: [
        { condition: ({ value }) => value < 0,       style: { color: 'var(--red)' } },
        { condition: ({ value }) => value >= 100_000, style: { color: 'var(--green)', fontWeight: 'bold' } },
      ]
    },
    { id: 'region',  field: 'region',  header: 'Region',  width: 140 },
  ]

  type Row = { id: string; name: string; revenue: number; region: string }
  let rows: Row[] = $state([])
  let api = $state<SvGridApi<typeof features, Row> | null>(null)

  $effect(() => {
    fetch('/api/accounts')
      .then(r => r.json())
      .then(json => { rows = json })
  })
</script>

<SvGrid
  {features}
  {columns}
  data={rows}
  height={640}
  sortable
  filterable
  pageable
  selectable
  showFilterRow={true}
  pageSize={50}
  onApiReady={(a) => { api = a }}
/>

{#if api}
  <div class="toolbar">
    <button onclick={() => api?.exportCsv()}>Export CSV</button>
    <button onclick={() => api?.clearAllFilters()}>Clear filters</button>
    <span>{api.getPageInfo().total} rows</span>
  </div>
{/if}
```

The `height` prop is required for virtualization. Without it the grid renders all rows eagerly - 50,000 rows without virtualization will freeze a browser for several seconds. Set `height` explicitly or constrain the parent with CSS `height` + `overflow: hidden`.

If you want full markup control but still want the runes-native row model, `createSvGrid` is the escape hatch. It returns the same row model state that `<SvGrid>` uses internally, and you can pair it with `createSvelteVirtualizer` from `@svgrid/grid` to build your own scroll container. Expect about 80-100 lines of boilerplate for a basic virtual scroll setup - that is the honest cost of going fully custom.

## When TanStack Table is still the right call

TanStack Table is the better choice in two specific situations.

First, if your project is still on Svelte 4. SvGrid requires Svelte 5 runes (`$state`, `$derived`, `$effect`). There is no compatibility shim. TanStack Table's adapter works with Svelte 4 stores.

Second, if your team has strong opinions about markup and you are willing to own the rendering layer completely. TanStack Table gives you a blank canvas. SvGrid's render component makes decisions for you - the DOM structure, the scroll container, the header layout. You can override a lot with CSS custom properties (`--sg-bg`, `--sg-accent`, `--sg-border`, etc.) and with custom cell snippets, but you cannot rearrange the fundamental structure of the table. If that flexibility matters more than build-vs-buy, TanStack Table wins.

For everything else - especially teams that want sorting, filtering, pagination, row grouping, virtualization, and an imperative API without assembling those pieces manually - SvGrid covers the common ground with less code and better TypeScript inference in a Svelte 5 context.

## Migrating from TanStack Table to SvGrid

The mental model transfers more than you might expect. Column defs are structurally similar. The row model pipeline concept (sort -> filter -> paginate) is the same. The biggest adjustment is that you interact with the grid through `onApiReady` rather than holding a table reference from `createSvelteTable`, and you declare features via `tableFeatures(...)` rather than the `_features` option. If you have used TanStack Table v8, a half-day of orientation is realistic - not a full rewrite.

The practical migration path:

1. Replace `createSvelteTable` with `tableFeatures(...)` + `<SvGrid ... onApiReady={...} />`.
2. Move column defs to `ColumnDef<typeof features, Row>[]`. Most fields (`id`, `header`, `accessorKey` maps to `field`, `cell`) transfer directly.
3. Replace manual filter UI and sort header click handlers with `showFilterRow` and `sortable` props. If you had custom filter components, they can move to column `filterCell` snippets.
4. Replace your virtual scroll container with `height={N}` on `<SvGrid>`. Delete `@tanstack/svelte-virtual` from your dependencies.

One thing that does not transfer: if you built custom row height measurement logic to handle variable-height rows, SvGrid currently assumes a fixed row height set by the `rowHeight` prop. Variable-height virtual scroll is on the roadmap but not in the current release.
