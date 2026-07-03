---
title: Why the World Needed Another Grid
description: Every framework era produces the data grid it deserves. jqxGrid for jQuery, component-based grids for Angular and React, and now SvGrid - built natively on Svelte 5 runes, not adapted to them.
date: 2026-06-12
updated: "2026-07-02"
category: Company
tags: company, jqxgrid, history, svelte data grid, reactivity, story
author: Boyko Markov
pinned: true
---

I have spent fifteen years building data grids. That earns me some skepticism when a new one shows up, because I have seen the cycle. Someone declares the existing options inadequate, ships a new grid, and a few years later their grid is the one being called inadequate. So when I say the world needed another grid, I mean it carefully: not every few years, but every time the framework model of reactivity changes. That is the only trigger that matters.

![A real-time trading desk built with SvGrid.](/blog-media/trading-desk.png)
*A real-time trading desk built with SvGrid.*

## A data grid is a reactivity engine in disguise

Strip away the headers, the sort arrows, the pagination controls, and what you have is a machine that watches state and repaints exactly the cells that changed. Get that wrong and you repaint too much - sluggish on large datasets. Get it really wrong and you repaint too little - stale data on screen, the kind of bug that surfaces in a demo for a large customer.

This is why "wrap an existing grid in a Svelte adapter" was never going to be the answer. When AG Grid published their origin post [Why The World Needed Another Angular Grid](https://blog.ag-grid.com/why-the-world-needed-another-angular-grid/), the argument was the same one: the grids of 2014 were built for a different reactivity model, so adapting them to Angular always left a seam. The author was right to build something new. That is how the category actually advances.

The pattern:

- **jQuery era:** imperative DOM - find the node, mutate the node. jqxGrid was native here, and it ended up in production at Samsung, Boeing, NVIDIA, Microsoft, Nokia, and Intel.
- **Angular/React era:** component trees, virtual DOM, one-way data flow. A new generation of grids was built for this model and thrived.
- **Svelte 5 era:** signal-based, fine-grained reactivity via runes. The grids built for virtual DOM are now the guests who overstayed.

## Why Svelte 5 runes change the equation

Svelte 5 `$state` and `$derived` are not syntactic sugar over stores. They are a compiler-level, fine-grained signal graph: a derived value recomputes only when the exact state slice it reads changes, nothing else. For most components that is a convenience. For a grid rendering a hundred thousand cells, it is the architecture.

Consider filtered, sorted, grouped rows. In a store-based approach you subscribe to the whole row array and recompute the view on any change. With runes you express the pipeline as a chain of `$derived` values - filter first, then sort, then group - and each layer only recomputes when its own inputs change. A single cell edit does not re-sort unless the sort column changed. A filter change does not re-run grouping unless the filtered set actually changed.

```svelte
<script>
  import { createGrid, tableFeatures, rowSortingFeature,
           columnFilteringFeature, rowSelectionFeature } from '@svgrid/grid'
  import type { ColumnDef } from '@svgrid/grid'

  type Row = { id: number; name: string; revenue: number; region: string }

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
  })

  const columns: ColumnDef<typeof features, Row>[] = [
    { id: 'name',    field: 'name',    header: 'Name',    width: 200, pinned: 'left' },
    { id: 'revenue', field: 'revenue', header: 'Revenue', width: 130, type: 'number' },
    { id: 'region',  field: 'region',  header: 'Region',  width: 140 },
  ]

  // $state is real Svelte 5 rune state - no store wrapper, no adapter
  let rows = $state<Row[]>([])

  const grid = createGrid({
    data: rows,
    columns,
    features,
    options: {
      sorting:      { state: $state([]) },
      rowSelection: { state: $state({}) },
      filtering:    { columnFilters: $state([]) },
    },
  })
</script>
```

Nothing there is a compatibility shim. `createGrid` is implemented in runes. The options accept rune state directly. When Svelte compiles this component, the grid's internal derived values participate in the same reactive graph as everything else on the page.

## The headless/render split

One thing we deliberately separated is the headless core from the render layer. `createGrid` gives you a reactive grid model with no DOM dependency. `<SvGrid>` is an opinionated render layer on top of it. You can use either, or both, with the same column definitions.

```svelte
<script>
  import SvGrid from '@svgrid/grid'
  import type { ColumnDef, SvGridApi, TableFeatures } from '@svgrid/grid'

  let api: SvGridApi | undefined = $state()

  // Same column defs work headless or with the component
  const columns: ColumnDef<TableFeatures, Row>[] = [
    { id: 'id',     field: 'id',     header: 'ID',     width: 80  },
    { id: 'name',   field: 'name',   header: 'Name',   width: 200 },
    { id: 'status', field: 'status', header: 'Status', width: 120,
      cell: statusSnippet },
  ]
</script>

<SvGrid
  data={rows}
  {columns}
  sortable
  filterable
  groupable
  pageable
  virtualization={true}
  rowHeight={32}
  showFilterRow={true}
  enableCellSelection={true}
  onApiReady={(a) => { api = a }}
/>

{#snippet statusSnippet({ value })}
  <span class="badge" class:active={value === 'active'}>{value}</span>
{/snippet}
```

When `onApiReady` fires, you get an imperative handle for everything the UI exposes declaratively: `api.setSort`, `api.setFilter`, `api.applyTransaction`, `api.getState` / `api.setState` for save/restore. You are not forced to choose between reactive props and imperative control - you get both.

## Server-side data without glue code

The other place where native design pays off is server-side pagination and filtering. Because the grid's internal pagination and filter state are just rune state, wiring them to a server fetch is straightforward.

```typescript
import { createServerDataSource } from '@svgrid/grid'

const ds = createServerDataSource({
  fetch: async ({ page, pageSize, sort, filters }) => {
    const params = new URLSearchParams({
      page:     String(page),
      size:     String(pageSize),
      sort:     sort.map(s => `${s.id}:${s.desc ? 'desc' : 'asc'}`).join(','),
      filters:  JSON.stringify(filters),
    })
    const res  = await fetch(`/api/rows?${params}`)
    const json = await res.json()
    return { rows: json.data, total: json.total }
  },
})

// Pass the data source directly - pagination, sort, filter all wire automatically
// <SvGrid data={ds} {columns} pageable sortable filterable />
```

The data source receives the current page, sort, and filter state on every change and returns rows plus a total count. The grid handles debouncing, loading states, and cache invalidation. There is no external state manager required, no effect that manually watches filter changes and fires a fetch - the reactive graph does it.

## The same conviction, different era

We have now built a grid for three distinct framework eras. jqxGrid for the jQuery world. The Smart UI web components on [htmlelements.com](https://www.htmlelements.com) across the cross-framework years. And SvGrid natively for Svelte 5.

The technology keeps shifting. The underlying conviction does not: a grid has to be native to its framework's reactivity model or it will always be half a step behind. Not obviously broken, just slightly wrong in ways that accumulate - performance that is good but not great, code that works but reads like a translation, integrations that fit but require maintenance glue.

Svelte 5 runes are a genuine change in how reactive state works, not an incremental improvement on stores. That made it worth building something new rather than adapting something old. SvGrid is the answer to that particular question, for this particular era. When the ground moves again, someone will need to ask it again.
