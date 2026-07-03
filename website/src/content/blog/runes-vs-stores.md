---
title: Runes vs Stores in Svelte 5 - When to Use Which
description: Svelte 5 runes and stores are not competitors - they solve different problems. Here is a concrete breakdown of when $state wins, when writable still earns its place, and how to mix both without subtle bugs.
date: 2026-09-02
updated: "2026-07-02"
category: Engineering
tags: svelte 5, runes, stores, state management, engineering
author: Kamelia M
---
The migration guide says "prefer runes," and that is generally good advice. But I have watched teams overrotate - ripping out every `writable` store the moment they upgrade to Svelte 5, then spending a week chasing reactivity bugs that only appear when a component unmounts at the wrong time.

`$state` and `writable` are not the same primitive. They have different scoping rules, different compiler requirements, and different lifecycle contracts. Knowing which one fits a given situation takes maybe five minutes to learn and saves hours of debugging.

## The actual difference between the two

A `writable` store is a runtime object. It carries its own subscriber list. Any code - component, SvelteKit hook, Vite plugin, plain Node script - can call `.subscribe()` on it, get notified on change, and call the unsubscribe function when done. The mechanism is entirely runtime; the Svelte compiler plays no role.

`$state` is a compiler primitive. The Svelte compiler transforms `$state(...)` calls and every property access on a reactive object into fine-grained dependency tracking. This only works inside files the compiler processes: `.svelte` components and `.svelte.ts` / `.svelte.js` modules. Drop the same `$state` call into a plain `.ts` file and the build fails with a parse error.

That distinction drives every practical decision.

## Shared state across sibling components

The most common reason people reach for stores is sharing state between two sibling components that cannot use props - a data grid and its toolbar, for example. In Svelte 4 this was a legitimate store use case. In Svelte 5, a `.svelte.ts` module with `$state` works better for most UI-layer state.

Here is a shared state module for a SvGrid-backed deal pipeline screen:

```ts
// deal-state.svelte.ts
import type { SvGridApi } from '@svgrid/grid'

// Reactive shared state - any component importing this participates
// in the same reactive graph automatically.
export const filters = $state({
  stage: '' as string,
  region: '' as string,
  minValue: 0,
})

export const sort = $state({
  key: 'dealValue' as string,
  dir: 'desc' as 'asc' | 'desc',
})

// The API handle is intentionally NOT $state.
// Components call methods on it; they do not need to react to
// the handle itself changing. Making it $state adds unnecessary
// render cycles after onApiReady fires.
export let gridApi: SvGridApi | null = null
```

The toolbar imports `filters` and `sort` directly. Mutations it makes are immediately visible inside the grid component with no subscription boilerplate.

```svelte
<!-- DealToolbar.svelte -->
<script lang="ts">
  import { filters, sort, gridApi } from './deal-state.svelte.ts'

  function applyStageFilter(stage: string) {
    filters.stage = stage
    gridApi?.setFilter('stage', { operator: 'equals', value: stage })
  }

  function applyRegionFilter(region: string) {
    filters.region = region
    gridApi?.setFilter('region', { operator: 'equals', value: region })
  }

  function clearAll() {
    filters.stage = ''
    filters.region = ''
    filters.minValue = 0
    gridApi?.clearAllFilters()
  }

  function flipSort() {
    sort.dir = sort.dir === 'desc' ? 'asc' : 'desc'
    gridApi?.setSort([{ id: sort.key, desc: sort.dir === 'desc' }])
  }
</script>

<div class="toolbar">
  <button onclick={() => applyStageFilter('Qualified')}>Qualified</button>
  <button onclick={() => applyStageFilter('Closed Won')}>Closed Won</button>
  <select onchange={(e) => applyRegionFilter(e.currentTarget.value)}>
    <option value="">All regions</option>
    <option value="Americas">Americas</option>
    <option value="EMEA">EMEA</option>
    <option value="APAC">APAC</option>
  </select>
  <button onclick={flipSort}>
    Sort: {sort.key} ({sort.dir})
  </button>
  <button onclick={clearAll}>Clear</button>
</div>
```

And the grid component wires the API handle on mount:

```svelte
<!-- DealGrid.svelte -->
<script lang="ts">
  import SvGrid, {
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import { sort, gridApi as apiSlot } from './deal-state.svelte.ts'

  type Deal = {
    id: number
    customer: string
    stage: string
    dealValue: number
    owner: string
    region: string
  }

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
  })

  const columns: ColumnDef<typeof features, Deal>[] = [
    { id: 'customer',  field: 'customer',  header: 'Customer',    width: 200 },
    { id: 'stage',     field: 'stage',     header: 'Stage',       width: 130 },
    {
      id: 'dealValue',
      field: 'dealValue',
      header: 'Deal Value',
      width: 130,
      type: 'number',
    },
    { id: 'owner',     field: 'owner',     header: 'Owner',       width: 150 },
    { id: 'region',    field: 'region',    header: 'Region',      width: 110 },
  ]

  const rows: Deal[] = Array.from({ length: 200 }, (_, i) => ({
    id: i + 1,
    customer:  `Customer ${i + 1}`,
    stage:     ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won'][i % 5],
    dealValue: Math.round(5000 + (i * 137) % 95000),
    owner:     ['B. Markov', 'A. Lindberg', 'D. Watanabe', 'R. Greene'][i % 4],
    region:    ['Americas', 'EMEA', 'APAC'][i % 3],
  }))

  function onApiReady(api: SvGridApi) {
    // Assign to the module-level slot without making it reactive.
    apiSlot = api
    // Apply initial sort from shared state.
    api.setSort([{ id: sort.key, desc: sort.dir === 'desc' }])
  }
</script>

<SvGrid
  {features}
  {columns}
  data={rows}
  {onApiReady}
  filterable
  sortable
  style="height: 500px;"
/>
```

No context API. No prop drilling. No `.subscribe` / `.unsubscribe` pairs. That is the rune advantage for UI state that lives entirely inside the component layer.

## When a writable store is still the right call

Three situations push you back toward stores:

**State that must live in a plain `.ts` file.** SvelteKit server hooks (`hooks.server.ts`), Vite plugins, shared utility modules - none of these go through the Svelte compiler. The `$state` syntax is simply unavailable. A `writable` works fine because it is runtime-only.

**Consuming third-party store-based APIs.** SvelteKit's own `page`, `navigating`, and `updated` stores are writable/readable instances. Any library that ships the store contract expects `.subscribe`. You can read these stores inside a `$derived` in a `.svelte.ts` file, but you cannot pretend they are rune-based objects.

**Side effects that outlive the component tree.** Consider syncing filter state to a URL search param. The sync needs to persist across navigations - it cannot live in a component `$effect` because the component will unmount. A store subscription attached at the layout level, or inside a `+layout.svelte` `onMount`, stays alive for the full session. A `$derived` inside a page component does not.

Here is a concrete interop example that mixes both:

```ts
// url-sync.svelte.ts - runs inside +layout.svelte onMount
import { page } from '$app/stores'
import { goto } from '$app/navigation'
import { filters } from './deal-state.svelte.ts'

// Read a SvelteKit store inside a $derived - this works because
// .svelte.ts files are compiled by Svelte.
export const activeStageFromUrl = $derived.by(() => {
  // Svelte 5 can read stores in derived context via get()
  return new URLSearchParams(window.location.search).get('stage') ?? ''
})

// Persist filter changes to the URL without a component lifecycle.
export function syncFiltersToUrl() {
  return $effect.root(() => {
    $effect(() => {
      const params = new URLSearchParams(window.location.search)
      if (filters.stage) {
        params.set('stage', filters.stage)
      } else {
        params.delete('stage')
      }
      if (filters.region) {
        params.set('region', filters.region)
      } else {
        params.delete('region')
      }
      goto(`?${params.toString()}`, { replaceState: true, noScroll: true })
    })
  })
}
```

The `$effect.root` call is key here. It creates an effect scope that is not tied to any component's lifecycle. You call the returned cleanup function in `+layout.svelte`'s `onDestroy` instead, giving you explicit control over when the sync stops.

## Two mistakes worth naming explicitly

**Reactive destructuring.** `const { stage } = filters` does not work. The moment you destructure a `$state` object, `stage` becomes a plain string snapshot - a copy taken at that instant, not a reactive reference. Access properties directly through the object: `filters.stage`. This is the number-one source of "my template is not updating" bugs after a store-to-runes migration.

**Mixing file extensions carelessly.** Rename `deal-state.svelte.ts` to `deal-state.ts` and the build fails with "unexpected token `$`". The `.svelte.ts` extension is not cosmetic. It tells the Svelte compiler to process the file. There is no runtime fallback; it is a compile-time requirement.

## The practical rule of thumb

New state that is shared between Svelte components and nothing else: use `$state` in a `.svelte.ts` module. State that needs to work in non-component contexts, interoperate with store-based libraries, or survive across full navigation lifecycles: use a `writable` store. When both are in play in the same feature - which is common in real SvelteKit apps - they compose cleanly. You can read stores inside `$derived`, and you can call `get(someStore)` inside `$effect` without subscribing manually.

The wrong move is treating the choice as ideological. Stores are not legacy. Runes are not always simpler. Pick the one that fits the boundary you are working at.
