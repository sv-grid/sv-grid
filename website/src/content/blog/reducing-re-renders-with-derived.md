---
title: Reducing Re-Renders in SvGrid with $derived
description: Svelte 5's $derived memoizes your row pipeline so the grid recomputes only when filter inputs actually change - not on every unrelated state update.
date: 2026-08-30
updated: "2026-07-02"
category: Performance
tags: performance, runes, derived, reactivity, recipe
author: Victor Vidolov
---

Most performance bugs in data grid pages are not inside the grid. They are in the code that feeds the grid. Specifically: expensive row transformations that run on every reactive tick, including ticks triggered by UI state that has nothing to do with the data.

Svelte 5's `$derived` fixes this at the language level. When you wrap your filter and sort logic in `$derived`, Svelte tracks which `$state` signals the expression actually reads and only re-evaluates when one of those signals changes. Toggle a sidebar, switch a theme, update a tab - none of those touch your row pipeline.

Here is what that buys you on a 5,000-row grid: instead of re-filtering on every reactive update, the filter runs only when the user changes a search term or a filter control. For a typical `Array.prototype.filter` pass over 5,000 objects, that is the difference between running every 16ms and running a handful of times per second at most.

## Why an inline expression is not enough

The most common anti-pattern is computing filtered rows inline in the template or inside a `$effect`:

```svelte
<script lang="ts">
  let rows = $state<Deal[]>(seedDeals(5_000))
  let query = $state('')
  let sidebarOpen = $state(false) // unrelated UI

  // This recomputes on EVERY reactive update, including sidebarOpen changes.
  // $effect is the wrong tool here.
  let visibleRows = $state<Deal[]>([])
  $effect(() => {
    visibleRows = rows.filter(r => r.customer.toLowerCase().includes(query.toLowerCase()))
  })
</script>

<!-- Same problem if you filter inline - Svelte re-evaluates the whole block -->
<SvGrid data={rows.filter(r => r.customer.includes(query))} {columns} />
```

The `$effect` version adds an extra reactive cycle and is easy to get out of order. The inline version recalculates every time anything in the component re-renders. Both couple your row computation to the entire reactive graph of the page.

`$derived` breaks that coupling by being explicit about dependencies.

## Building a memoized row pipeline

A real deal-pipeline view has multiple filter stages: active/inactive toggle, region dropdown, text search. Each should be its own `$derived` so invalidation is as narrow as possible. If only the search text changes, the active/inactive and region derivations return their cached values immediately.

```svelte
<script lang="ts">
  import SvGrid from '@svgrid/grid'
  import {
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Stage = 'discovery' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost'
  type Region = 'NA' | 'EMEA' | 'APAC' | 'LATAM'

  type Deal = {
    id: string
    customer: string
    region: Region
    stage: Stage
    amount: number
    active: boolean
  }

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
  })

  // Source data - loaded once, updated surgically via applyTransaction
  let rows = $state<Deal[]>(seedDeals(5_000))

  // Filter controls - these are the only things that should trigger row recomputes
  let query = $state('')
  let regionFilter = $state<Region | 'ALL'>('ALL')
  let showInactive = $state(false)

  // Unrelated UI - must not touch the data pipeline
  let sidebarOpen = $state(false)
  let activeTab = $state<'pipeline' | 'forecast'>('pipeline')

  // Stage 1: active flag filter - invalidates only when showInactive or rows changes
  let activeRows = $derived(
    showInactive ? rows : rows.filter(r => r.active)
  )

  // Stage 2: region filter - only reruns when regionFilter or activeRows changes
  let regionRows = $derived(
    regionFilter === 'ALL'
      ? activeRows
      : activeRows.filter(r => r.region === regionFilter)
  )

  // Stage 3: text search - reruns when query or regionRows changes
  let visibleRows = $derived(
    query.trim() === ''
      ? regionRows
      : (() => {
          const q = query.toLowerCase()
          return regionRows.filter(r => r.customer.toLowerCase().includes(q))
        })()
  )

  // Stage 4: sort + aggregate in one pass using $derived.by for multi-step logic
  const pipeline = $derived.by(() => {
    const sorted = visibleRows.slice().sort((a, b) => b.amount - a.amount)
    let total = 0
    for (const d of sorted) total += d.amount
    const avg = sorted.length ? Math.round(total / sorted.length) : 0
    return { rows: sorted, count: sorted.length, total, avg }
  })

  const columns: ColumnDef<typeof features, Deal>[] = [
    { id: 'id',       field: 'id',       header: 'ID',       width: 80  },
    { id: 'customer', field: 'customer', header: 'Customer',  width: 220 },
    { id: 'region',   field: 'region',   header: 'Region',    width: 100 },
    { id: 'stage',    field: 'stage',    header: 'Stage',     width: 140 },
    {
      id: 'amount',
      field: 'amount',
      header: 'Amount',
      width: 130,
      type: 'number',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
    },
  ]

  let api = $state<SvGridApi<typeof features, Deal> | null>(null)

  function seedDeals(n: number): Deal[] {
    const stages: Stage[] = ['discovery', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']
    const regions: Region[] = ['NA', 'EMEA', 'APAC', 'LATAM']
    return Array.from({ length: n }, (_, i) => ({
      id: `D-${String(i + 1).padStart(5, '0')}`,
      customer: `Customer ${i + 1}`,
      region: regions[i % regions.length]!,
      stage: stages[i % stages.length]!,
      amount: 10_000 + (i * 37) % 490_000,
      active: i % 7 !== 0,
    }))
  }

  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
</script>

<div class="toolbar">
  <input bind:value={query} placeholder="Search customer..." />
  <select bind:value={regionFilter}>
    <option value="ALL">All regions</option>
    <option value="NA">NA</option>
    <option value="EMEA">EMEA</option>
    <option value="APAC">APAC</option>
    <option value="LATAM">LATAM</option>
  </select>
  <label>
    <input type="checkbox" bind:checked={showInactive} />
    Show inactive
  </label>
  <button onclick={() => (sidebarOpen = !sidebarOpen)}>Toggle sidebar</button>
</div>

<p class="summary">
  {pipeline.count} rows - {fmt.format(pipeline.total)} total - {fmt.format(pipeline.avg)} avg
</p>

<SvGrid
  data={pipeline.rows}
  {columns}
  {features}
  rowId="id"
  height={560}
  onApiReady={(g) => (api = g)}
/>
```

`sidebarOpen` and `activeTab` are never read by any `$derived` expression. Toggling the sidebar triggers zero work in the row pipeline. The summary stats recalculate only when `pipeline.rows` recalculates, not independently.

## How the dependency tracking works in practice

Svelte 5's reactivity is a directed acyclic graph of signals. When `$derived(expr)` runs for the first time, the runtime records every `$state` signal read during evaluation. That recorded set is the exact dependency list - nothing more.

The chain `rows -> activeRows -> regionRows -> visibleRows -> pipeline` means each node only propagates invalidation as far down as the first input that actually changed. Change `query`: `rows`, `activeRows`, and `regionRows` are clean, so Svelte skips them and re-evaluates only `visibleRows` and `pipeline`. Change `regionFilter`: `activeRows` is clean, only `regionRows`, `visibleRows`, and `pipeline` rerun.

This is different from Svelte 4 reactive statements (`$:`) where evaluation order is determined at compile time and the granularity is the statement, not the signal. In Svelte 5, each `$derived` is independently memoized with its own dependency set.

## When memoization breaks down

Two common mistakes negate the benefit.

The first is replacing the source array on every tick with a brand-new reference:

```ts
// Polling loop that assigns a new array even when the data hasn't changed
$effect(() => {
  const interval = setInterval(async () => {
    rows = await fetchDeals() // new reference even if content is identical
  }, 5_000)
  return () => clearInterval(interval)
})
```

Every assignment to `rows` - regardless of content - invalidates every downstream `$derived`. If you need live updates, diff the incoming payload and apply changes surgically:

```ts
$effect(() => {
  const interval = setInterval(async () => {
    const fresh = await fetchDeals()
    if (!api) return

    const current = new Map(api.getData().map(r => [r.id, r]))
    const incoming = new Map(fresh.map(r => [r.id, r]))

    const add = fresh.filter(r => !current.has(r.id))
    const remove = api.getData().filter(r => !incoming.has(r.id))
    const update = fresh.filter(r => {
      const old = current.get(r.id)
      return old && JSON.stringify(old) !== JSON.stringify(r)
    })

    api.applyTransaction({ add, update, remove })
  }, 5_000)
  return () => clearInterval(interval)
})
```

`applyTransaction` patches the grid's internal row model incrementally. The `rows` signal does not change, so `activeRows`, `regionRows`, and the rest of the chain are untouched.

The second mistake is chaining too many derivations over a large dataset. Four passes of `Array.prototype.filter` over 5,000 rows, each taking 1-2ms, is 4-8ms of synchronous work on the reactive thread. If you measure that as a problem, collapse the chain into a single `$derived.by` that does all filtering in one loop:

```ts
const visibleRows = $derived.by(() => {
  const q = query.toLowerCase().trim()
  const result: Deal[] = []
  for (const r of rows) {
    if (!showInactive && !r.active) continue
    if (regionFilter !== 'ALL' && r.region !== regionFilter) continue
    if (q && !r.customer.toLowerCase().includes(q)) continue
    result.push(r)
  }
  return result
})
```

One pass, three conditions, one dependency set that covers `rows`, `showInactive`, `regionFilter`, and `query` together. This is worth doing only if profiling confirms the multi-stage version is actually slow - the chained approach is easier to read and test.

## Interaction with grid features

One boundary to be aware of: `$derived` and SvGrid's built-in sort/filter features work on different layers. If you pass pre-sorted data via `$derived` and also enable the `rowSortingFeature` in `tableFeatures`, the grid sorts an already-sorted array. The user sees correct order, but the two systems fight over the result when column headers are clicked.

The cleaner split: use `$derived` for transformations the grid's built-in features cannot express (custom business rules, cross-row aggregation, async enrichment results written to `$state`). Use grid features for standard column sorting and filter rows that the user controls interactively through the header UI. Mixing both for the same transformation creates maintenance confusion.

For server-side data via `createServerDataSource`, the question becomes moot - filtering and sorting happen on the server and the client-side derivation chain only ever sees one page of results at a time. That is the correct architecture for datasets above roughly 50,000 rows.
