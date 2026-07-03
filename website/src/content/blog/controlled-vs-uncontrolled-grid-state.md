---
title: Controlled vs Uncontrolled Grid State
description: Who owns sort, filter, and page state - you or the grid? The answer shapes your whole integration. Here is how to think about it and when each mode pays off.
date: 2026-07-15
updated: "2026-07-02"
category: Concepts
tags: concepts, state management, controlled, data grid
author: Victor Vidolov
---

The single biggest source of confusion when wiring up a data grid is not the column API or the filter syntax - it is a question most developers never explicitly ask: who owns the sort, filter, and pagination state? Get that wrong and you end up fighting the grid for the rest of the integration.

SvGrid gives you three distinct positions on this spectrum. I will walk through each one with real code, explain where the boundaries are, and tell you when to move from one to the next.

## The default position: uncontrolled state

When you drop in a `<SvGrid>` with `sortable`, `filterable`, and `pageable`, you get uncontrolled mode for free. The grid holds all its own state in Svelte `$state` internally and manages every transition itself.

```svelte
<script lang="ts">
  import SvGrid from '@svgrid/grid'
  import {
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,
    type ColumnDef,
  } from '@svgrid/grid'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,
  })

  const columns: ColumnDef<typeof features, Product>[] = [
    { id: 'name',     field: 'name',     header: 'Name',     width: 200 },
    { id: 'category', field: 'category', header: 'Category', width: 150 },
    { id: 'price',    field: 'price',    header: 'Price',    width: 100, type: 'number' },
    { id: 'stock',    field: 'stock',    header: 'In Stock', width: 100, type: 'number' },
  ]
</script>

<SvGrid
  data={products}
  {columns}
  {features}
  sortable
  filterable
  pageable
  pageSize={25}
  showFilterRow
/>
```

This is the right default for in-memory datasets where the grid is self-contained. Nothing to wire up, nothing to maintain. The user clicks a column header to sort, types in a filter cell, navigates pages - and none of it requires a line of application code.

The limitation shows up the moment something outside the grid needs to react to grid state. You cannot easily drive a "3 filters active" badge, sync the URL, or log analytics events in uncontrolled mode without reaching for a callback.

## Observing state without owning it

Observable mode is the middle ground. The grid still owns and manages the state - it sorts and filters the rows itself - but it fires callbacks whenever something changes. You subscribe and react without taking responsibility for the transformation.

```svelte
<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import SvGrid from '@svgrid/grid'
  import {
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,
    type SvGridApi,
    type ColumnDef,
  } from '@svgrid/grid'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,
  })

  let activeFilterCount = $state(0)
  let api: SvGridApi<typeof features>

  function syncToUrl(sort: any[], filters: any) {
    const params = new URLSearchParams($page.url.searchParams)
    if (sort.length) {
      params.set('sort', sort[0].id)
      params.set('dir',  sort[0].desc ? 'desc' : 'asc')
    } else {
      params.delete('sort')
      params.delete('dir')
    }
    goto(`?${params.toString()}`, { replaceState: true, noScroll: true })
  }
</script>

<div class="toolbar">
  {#if activeFilterCount > 0}
    <span class="badge">{activeFilterCount} filters active</span>
    <button onclick={() => api.clearAllFilters()}>Clear</button>
  {/if}
</div>

<SvGrid
  data={products}
  {columns}
  {features}
  sortable
  filterable
  pageable
  showFilterRow
  onApiReady={(a) => (api = a)}
  onSortingChange={(sorting) => syncToUrl(sorting, null)}
  onFiltersChange={(state) => {
    activeFilterCount = Object.values(state.columns).filter(
      (f) => f?.value != null && f.value !== ''
    ).length
  }}
/>
```

This covers the majority of production cases that go beyond pure in-memory grids. URL state, analytics events, sibling-component reactions, persisting the current view to localStorage - all of these fit here without you needing to manage the actual row transformations.

## External (controlled) mode: you own the data pipeline

Controlled mode is not about preference - it is a hard requirement when you have server-side data. The full dataset never exists in the browser, so the grid cannot sort or filter it. Instead, the grid records what the user requested and hands that intent back to you through callbacks. You fetch, you return the rows.

```svelte
<script lang="ts">
  import SvGrid from '@svgrid/grid'
  import {
    createServerDataSource,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,
    type ColumnDef,
  } from '@svgrid/grid'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,
  })

  const columns: ColumnDef<typeof features, Order>[] = [
    { id: 'orderId',    field: 'orderId',    header: 'Order ID',   width: 120 },
    { id: 'customer',   field: 'customer',   header: 'Customer',   width: 200 },
    { id: 'total',      field: 'total',      header: 'Total',      width: 110, type: 'number' },
    { id: 'status',     field: 'status',     header: 'Status',     width: 120 },
    { id: 'createdAt',  field: 'createdAt',  header: 'Created',    width: 160, type: 'date' },
  ]

  const ds = createServerDataSource({
    fetch: async ({ page, pageSize, sort, filters }) => {
      const params = new URLSearchParams({
        page:     String(page),
        pageSize: String(pageSize),
      })

      if (sort.length) {
        params.set('sortField', sort[0].id)
        params.set('sortDir',   sort[0].desc ? 'desc' : 'asc')
      }

      for (const [field, filter] of Object.entries(filters?.columns ?? {})) {
        if (filter?.value != null) {
          params.set(`filter[${field}]`, String(filter.value))
          if (filter.valueTo != null) params.set(`filter[${field}To]`, String(filter.valueTo))
        }
      }

      const res  = await fetch(`/api/orders?${params.toString()}`)
      const json = await res.json()
      return { rows: json.data, total: json.total }
    },
  })
</script>

<SvGrid
  data={ds}
  {columns}
  {features}
  sortable
  filterable
  pageable
  showFilterRow
  pageSize={50}
/>
```

`createServerDataSource` wraps the fetch lifecycle so SvGrid triggers a fresh call whenever the user changes sort, filters, or page. You get a consistent callback shape every time: `page`, `pageSize`, `sort` (an array with one or more sort objects), and `filters` (column-keyed filter state). Map those to your API and return `{ rows, total }`.

Notice there are no `onSortingChange` or `onFiltersChange` callbacks here. The data source handles the coordination. If you need to react to state changes on top of a server source, you can still add those callbacks - they compose cleanly.

## Mixing modes across dimensions

Nothing forces consistency across dimensions. A common pattern is uncontrolled sorting with external pagination - you want the grid to handle column sorting in-memory but you have too many records to load all at once:

```svelte
<script lang="ts">
  // Fetch only the current page; let the grid sort in-memory across that page.
  // onPageChange fetches the next slice; onSortingChange re-fetches sorted from server.
  let pageRows = $state<Order[]>([])
  let total    = $state(0)

  async function fetchPage(params: { page: number; pageSize: number; sort?: any[] }) {
    const q   = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) })
    const res = await fetch(`/api/orders?${q}`)
    const j   = await res.json()
    pageRows  = j.data
    total     = j.total
  }

  $effect(() => { fetchPage({ page: 1, pageSize: 50 }) })
</script>

<SvGrid
  data={pageRows}
  {columns}
  {features}
  rowCount={total}
  sortable
  pageable
  onPageChange={({ page, pageSize }) => fetchPage({ page, pageSize })}
/>
```

This works, but I would reach for `createServerDataSource` instead in most cases - it handles loading states and error retries and keeps the fetch logic away from the component.

## The decision tree

If you are not sure which mode to use, work through these in order:

- Does the full dataset live in memory? Use uncontrolled. Done.
- Does something outside the grid need to react to sort/filter/page changes? Add observable callbacks. The grid still owns state, you just listen.
- Is the dataset too large to load in full, or does it live on a server? Use `createServerDataSource` (external/controlled mode).

One thing that trips people up: you cannot switch between controlled and uncontrolled for the same dimension at runtime. The decision is made at mount time based on whether you pass a server data source or raw array. Plan it up front and it stays clean. Decide later and you will be refactoring data-fetching logic out of component props - not fun.

Start with uncontrolled. Promote to observable when you need outside reactions. Move to external only when the server forces you to. That graduation path matches how most features actually get built.
