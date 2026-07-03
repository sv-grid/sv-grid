---
title: What Is a Headless Data Grid?
description: Headless grids separate behavior from rendering - sorting, filtering, grouping, and pagination logic with no markup attached. Here is what that means in practice, why it matters, and when the tradeoff is worth it.
date: 2026-06-16
updated: "2026-07-02"
category: Concepts
tags: headless, concepts, data grid, architecture
author: Kamelia M
---

Most data grid debates are really about two different kinds of pain. One team is complaining that their grid looks like it was styled in 2014 and they cannot fix it. Another team rewrote a grid from scratch and now owns 3,000 lines of table logic they never wanted to write. Both problems have the same root cause: the library they picked did not separate *behavior* from *rendering*.

That separation is what headless means.

## What the word actually means

A headless data grid provides all the logic - sorting, filtering, grouping, pagination, selection, row virtualization calculations - as a stateful engine that produces a row model. It renders nothing. No `<table>`, no `<tr>`, no CSS. The DOM is entirely your responsibility.

The row model is the key concept. Your raw data goes in. The engine applies whatever features you enabled - filter first, then sort, then group, then paginate - and gives you back the rows that should be visible right now, in the right order, with the right metadata attached. You loop over that output and render however you want.

```ts
import {
  tableFeatures,
  rowSortingFeature,
  columnFilteringFeature,
  rowSelectionFeature,
  createGrid,
  type ColumnDef,
  type TableFeatures,
} from '@svgrid/grid'

const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  rowSelectionFeature,
})

type Features = typeof features

const columns: ColumnDef<Features, Product>[] = [
  { id: 'name',     field: 'name',     header: 'Name',     width: 200 },
  { id: 'category', field: 'category', header: 'Category', width: 140 },
  { id: 'price',    field: 'price',    header: 'Price',    width: 100, type: 'number' },
  { id: 'stock',    field: 'stock',    header: 'In Stock', width: 80  },
]

const grid = createGrid({
  data: $state(products),
  columns,
  features,
  options: {
    sorting:      { state: $state([]) },
    rowSelection: { state: $state({}) },
  },
})

// grid.getRowModel() returns the rows to render
// grid.table exposes column state, header groups, sort handlers, etc.
```

Nothing in that snippet touches the DOM. The `grid` object is just reactive state and methods. You get back a row model; what you do with it is up to you.

## Why this matters for design systems

If your company runs a design system, an all-in-one grid is a permanent negotiation. The library has opinions about spacing, colors, font sizes, border styles, scroll container structure, and header layout. You can override a lot of it with CSS, but you are fighting the component's default assumptions the whole way.

A headless engine is neutral by definition. The markup structure is yours, so it matches your design tokens naturally rather than by override. You can use a `<table>` element if you need accessible tabular semantics, or a CSS grid layout if your design calls for it, or a completely custom virtualized list. The behavior travels with you.

The flip side is real: you now own all that markup. Keyboard navigation, ARIA roles, focus management, scroll-anchoring during virtualization - a proper data grid needs all of it and none of it is trivial. Teams that start down this road sometimes end up with 2,000 lines of "custom grid" that handles 80% of the edge cases and silently fails on the rest.

## The practical middle ground

The reason most production teams settle somewhere between pure headless and all-in-one is that they want control in a few places and sensible defaults everywhere else. A library that gives you both on the same foundation is genuinely useful.

SvGrid ships this way. `createGrid` is the headless core - pure TypeScript, Svelte 5 runes for reactivity, no rendering. `<SvGrid>` is a full render component built directly on top of that same core, sharing identical column definitions and feature flags. You do not maintain two parallel APIs.

```svelte
<script lang="ts">
  import SvGrid from '@svgrid/grid'
  import type { ColumnDef } from '@svgrid/grid'

  const columns: ColumnDef[] = [
    { id: 'name',     field: 'name',     header: 'Name',    width: 200, pinned: 'left' },
    { id: 'category', field: 'category', header: 'Category', width: 140 },
    { id: 'price',    field: 'price',    header: 'Price',    width: 100, type: 'number', editable: true },
    { id: 'status',   field: 'status',   header: 'Status',  width: 120, cell: statusSnippet },
    { id: 'actions',  header: '',         width: 60,          cell: actionsSnippet, pinned: 'right' },
  ]

  let api = $state<SvGridApi | null>(null)

  function handleApiReady(a: SvGridApi) {
    api = a
    api.setSort('price', 'desc')
  }
</script>

{#snippet statusSnippet({ value })}
  <span class="badge" class:active={value === 'active'}>{value}</span>
{/snippet}

{#snippet actionsSnippet({ row })}
  <button onclick={() => deleteRow(row.index)}>Remove</button>
{/snippet}

<SvGrid
  {data}
  {columns}
  sortable
  filterable
  editable
  groupable
  pageable
  rowHeight={36}
  virtualization={true}
  showFilterRow={true}
  showGlobalFilter={true}
  enableCellSelection={true}
  onApiReady={handleApiReady}
/>
```

The `cell` column property accepts a Svelte 5 snippet - so you write native Svelte for custom cells rather than a proprietary renderer API. The rest of the grid stays managed.

When you need a completely custom layout for one specific view - a card grid, a timeline, a pivot-style report - you drop down to `createGrid` with the same column definitions and render from scratch. No migration, no separate configuration.

## Where headless logic draws the line

There is one place where pure headless breaks down: virtualization. Calculating which rows are visible and where they sit in scroll space requires knowing the container dimensions and scroll position - which means touching the DOM, or at minimum coordinating with something that does. A truly headless engine has to hand that off somewhere.

SvGrid's virtualization is built into the render layer, not the headless core. The `createGrid` engine exposes row models; the render component handles viewport math, scroll syncing, and dynamic row heights. If you are rolling a fully custom renderer, you need to supply your own virtualization strategy, which is doable but non-trivial for large datasets.

For most applications - tens of thousands of rows rather than millions - you can render the full list and skip the problem entirely. Virtualization is an optimization, not a correctness requirement.

## Choosing a starting point

If your team already has a mature design system and visual consistency is critical: start with the render component and use snippets for custom cells. You get accessibility, keyboard navigation, and virtualization out of the box.

If you are building a genuinely unusual layout - something that is not really a table - start headless from the beginning with `createGrid`. Accept that you will write more upfront, but you will not hit a ceiling later.

```ts
import {
  createGrid,
  tableFeatures,
  rowSortingFeature,
  columnFilteringFeature,
  rowPaginationFeature,
  createServerDataSource,
  type ColumnDef,
} from '@svgrid/grid'

// Server-side data source - headless engine handles page/sort/filter coordination
const ds = createServerDataSource({
  fetch: async ({ page, pageSize, sort, filters }) => {
    const params = new URLSearchParams({
      page:     String(page),
      size:     String(pageSize),
      sort:     sort.map(s => `${s.id}:${s.desc ? 'desc' : 'asc'}`).join(','),
      filters:  JSON.stringify(filters),
    })
    const res  = await fetch(`/api/products?${params}`)
    const json = await res.json()
    return { rows: json.data, total: json.total }
  },
})

const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  rowPaginationFeature,
})

// Same createGrid call whether rendering with <SvGrid> or custom markup
const grid = createGrid({
  data: ds,
  columns,
  features,
  options: {
    sorting:     { state: $state([{ id: 'price', desc: true }]) },
    pagination:  { state: $state({ pageIndex: 0, pageSize: 50 }) },
  },
})
```

The `createServerDataSource` call wires fetch, sort state, filter state, and pagination together. The grid engine coordinates them; you never write the "refetch when anything changes" boilerplate manually.

The choice between headless and render-ready is not a one-time architectural decision you are locked into. A library that ships both modes on the same foundation lets you start in the convenient lane and switch lanes when a specific screen demands it. That is the actual value of building the headless layer first.
