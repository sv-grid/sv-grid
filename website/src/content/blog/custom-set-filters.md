---
title: Set Filters and Custom Filter Logic in SvGrid
description: Build Excel-style checkbox set filters with live facet counts and a custom numeric range filter - using four API calls and plain Svelte markup.
date: 2025-11-25
updated: 2026-07-02
category: Filtering
tags: set filter, custom filters, faceted search, svelte data grid
author: Victor Vidolov
---

Checkbox filters on a status column are more useful than a text input 90% of the time. If there are five possible values and 400 rows, nobody wants to type "delivered" - they want to click it, see the count drop to 98, and move on. SvGrid supports this through `setFacetFilter` and `columnFilteringFeature`, with live counts computed from `api.getDisplayedRows()` that reflect the currently filtered set, not the full dataset.

This post builds an order management grid with set filters on two columns (`status` and `region`), a numeric range filter on `amount`, and facet counts that update whenever any filter changes. I will call out the count-staleness problem, the empty-array trap in `setFacetFilter`, and why calling `recomputeFacets()` imperatively beats a reactive `$effect` for this use case.

## Reproducible data first

Before wiring any filter logic, it is worth spending 30 seconds on data generation. Use a seeded PRNG instead of `Math.random()`. When you are chasing an edge case where two active filters together produce zero rows, reproducible data means you can share the exact scenario - not just a screenshot of the state you accidentally refreshed away.

```ts
// data.ts
export type Status = 'open' | 'paid' | 'shipped' | 'delivered' | 'returned'
export type Region = 'Americas' | 'EMEA' | 'APAC'

export type Order = {
  id:       string
  customer: string
  region:   Region
  status:   Status
  amount:   number
}

const STATUSES: Status[] = ['open', 'paid', 'shipped', 'delivered', 'returned']
const REGIONS:  Region[]  = ['Americas', 'EMEA', 'APAC']
const NAMES = [
  'Ava Thompson', 'Liam Park', 'Noah Singh', 'Emma Garcia',
  'Olivia Chen',  'Mason Rivera', 'Sophia Brown', 'Lucas Patel',
]

let seed = 0x5EED01
function rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xFFFFFFFF }
function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rand() * arr.length)]! }

export const ORDERS: Order[] = Array.from({ length: 400 }, (_, i) => ({
  id:       `ORD-${40_000 + i}`,
  customer: pick(NAMES),
  region:   pick(REGIONS),
  status:   pick(STATUSES),
  amount:   Math.round(50 + rand() * 4_950),
}))

// Derived from actual data - not hard-coded.
// If a new status appears (e.g. 'refunded'), the filter panel picks it up automatically.
export const ALL_STATUSES = [...new Set(ORDERS.map(o => o.status))] as Status[]
export const ALL_REGIONS  = [...new Set(ORDERS.map(o => o.region))]  as Region[]
```

Deriving the value lists from the dataset matters more than it looks. Hard-code `['open', 'paid', 'shipped', 'delivered', 'returned']` and the day your backend returns `'refunded'`, the filter panel silently ignores it. One line of `Set` construction eliminates that class of bug permanently.

## Grid setup and filter state

`columnFilteringFeature` is the only feature registration needed on the grid side. The filter logic itself lives in three functions, each ending with an API call and a `recomputeFacets()` invocation.

```svelte
<script lang="ts">
  import {
    SvGrid,
    tableFeatures,
    columnFilteringFeature,
    rowSortingFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import { ORDERS, ALL_STATUSES, ALL_REGIONS, type Order } from './data'

  const features = tableFeatures({ columnFilteringFeature, rowSortingFeature })

  const columns: ColumnDef<Order>[] = [
    { accessorKey: 'id',       header: 'Order ID',  size: 110 },
    { accessorKey: 'customer', header: 'Customer',  size: 160 },
    { accessorKey: 'region',   header: 'Region',    size: 100 },
    { accessorKey: 'status',   header: 'Status',    size: 110 },
    {
      accessorKey: 'amount',
      header: 'Amount',
      size: 100,
      cell: ctx => `$${ctx.getValue<number>().toLocaleString()}`,
    },
  ]

  let api = $state<SvGridApi<Order> | null>(null)

  // Local UI state for the filter panel
  let selectedStatuses = $state<Set<string>>(new Set(ALL_STATUSES))
  let selectedRegions  = $state<Set<string>>(new Set(ALL_REGIONS))
  let minAmount = $state(0)
  let maxAmount = $state(5000)

  // Per-value counts - recomputed after every filter change
  let statusCounts = $state<Record<string, number>>({})

  function recomputeFacets() {
    if (!api) return
    const counts: Record<string, number> = {}
    for (const row of api.getDisplayedRows()) {
      const s = row.status
      counts[s] = (counts[s] ?? 0) + 1
    }
    statusCounts = counts
  }

  function onApiReady(ready: SvGridApi<Order>) {
    api = ready
    recomputeFacets()
  }

  function applyStatusFilter() {
    if (!api) return
    // Empty selectedStatuses means pass an empty array - see the trap section below
    if (selectedStatuses.size === 0) {
      api.clearFilter('status')
    } else {
      api.setFacetFilter('status', [...selectedStatuses])
    }
    recomputeFacets()
  }

  function applyRegionFilter() {
    if (!api) return
    if (selectedRegions.size === 0) {
      api.clearFilter('region')
    } else {
      api.setFacetFilter('region', [...selectedRegions])
    }
    recomputeFacets()
  }

  function applyAmountFilter() {
    if (!api) return
    api.setFilter('amount', {
      operator: 'between',
      value:    minAmount,
      value2:   maxAmount,
    })
    recomputeFacets()
  }

  function clearAll() {
    if (!api) return
    selectedStatuses = new Set(ALL_STATUSES)
    selectedRegions  = new Set(ALL_REGIONS)
    minAmount = 0
    maxAmount = 5000
    api.clearAllFilters()
    recomputeFacets()
  }
</script>
```

## The filter panel markup

No component library required. Each status label renders its live count from `statusCounts`. The region checkboxes are simpler - they do not show counts, but adding them is the same pattern.

```svelte
<div class="filter-panel">
  <section>
    <h4>Status</h4>
    {#each ALL_STATUSES as status}
      <label>
        <input
          type="checkbox"
          checked={selectedStatuses.has(status)}
          onchange={() => {
            if (selectedStatuses.has(status)) {
              selectedStatuses.delete(status)
            } else {
              selectedStatuses.add(status)
            }
            selectedStatuses = new Set(selectedStatuses)
            applyStatusFilter()
          }}
        />
        {status}
        <span class="count">({statusCounts[status] ?? 0})</span>
      </label>
    {/each}
  </section>

  <section>
    <h4>Region</h4>
    {#each ALL_REGIONS as region}
      <label>
        <input
          type="checkbox"
          checked={selectedRegions.has(region)}
          onchange={() => {
            if (selectedRegions.has(region)) {
              selectedRegions.delete(region)
            } else {
              selectedRegions.add(region)
            }
            selectedRegions = new Set(selectedRegions)
            applyRegionFilter()
          }}
        />
        {region}
      </label>
    {/each}
  </section>

  <section>
    <h4>Amount range</h4>
    <input type="number" bind:value={minAmount} min={0} max={5000} />
    <span>to</span>
    <input type="number" bind:value={maxAmount} min={0} max={5000} />
    <button onclick={applyAmountFilter}>Apply</button>
  </section>

  <button onclick={clearAll}>Clear all filters</button>
</div>

<SvGrid
  {features}
  {columns}
  data={ORDERS}
  {onApiReady}
  style="height: 500px"
/>
```

## Why facet counts must reflect the filtered view

There is a meaningful design decision here. Some filter panels show counts from the full dataset - "delivered (94)" regardless of any other active filter. That number is technically accurate but misleading once another filter is active. If the user has already narrowed to EMEA, "delivered (94)" implies they will see 94 rows when they check that box. They will not.

Computing counts from `api.getDisplayedRows()` means the numbers always reflect the intersection of all current filters. Check "EMEA" and the status counts drop to show only the EMEA breakdown. That is the right behavior - it matches how Excel's AutoFilter works and how users expect facets to work in any e-commerce search interface.

The tradeoff: counts can drop to zero. "open (0)" sounds odd, but it is honest - it tells the user the combination is empty rather than hiding the option. Hiding options when they would match zero rows is a different pattern entirely (and a harder one, because you need to evaluate hypothetical filter states rather than the current one).

## Why `recomputeFacets()` is called explicitly, not in an `$effect`

The natural Svelte instinct would be to write something like:

```svelte
$effect(() => {
  if (api) {
    statusCounts = computeCounts(api.getDisplayedRows())
  }
})
```

The problem is timing. An `$effect` fires after Svelte's reactive updates settle. If you call `api.setFacetFilter(...)` and then an effect tries to read `api.getDisplayedRows()`, you are racing against SvGrid's internal filter pipeline. The pipeline may not have re-evaluated yet, so you get the counts from the previous filter state.

Calling `recomputeFacets()` immediately after the API call sidesteps this entirely. The API call is synchronous - by the time it returns, SvGrid has already re-evaluated the filter and updated the displayed row set. Reading `getDisplayedRows()` right after is guaranteed to reflect the new state.

## The empty-array trap in `setFacetFilter`

`api.setFacetFilter('status', [])` does not clear the filter. It installs a filter that matches nothing - zero rows pass it. This is almost never what you want when the user unchecks every checkbox.

The correct behavior when all options are deselected depends on your app's semantics. In the example above, I treat it as "no filter applied" and call `api.clearFilter('status')` instead. If your intent is "show nothing when no options are selected," then passing an empty array is correct. The distinction matters - pick the one that matches your expected UX and handle the empty case explicitly.

## Two active column filters

`setFacetFilter` is scoped to a single column ID. Calling it on `'status'` does not affect the filter on `'region'`. You can verify this with `api.getFilters()` after applying both - it returns separate entries keyed by column ID. The `amount` range filter using `api.setFilter` coexists with both set filters without any conflict. SvGrid evaluates all active column filters together: every displayed row satisfies all of them simultaneously.

Clearing selectively is equally scoped. `api.clearFilter('status')` removes only the status filter. `api.clearAllFilters()` removes everything - that is what the "Clear all" button uses, since it also resets the amount range and both checkbox selections.

The total SvGrid surface area in this implementation is four API methods: `setFacetFilter`, `setFilter`, `clearFilter`, `clearAllFilters`, and one read: `getDisplayedRows`. Everything else - the checkbox markup, the count display, the local state - is plain Svelte.
