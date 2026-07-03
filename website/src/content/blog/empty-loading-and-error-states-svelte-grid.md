---
title: Empty, Loading, and Error States for a Svelte Data Grid
description: How to handle the three non-data states in a Svelte grid - empty (with two subtypes), skeleton loading that does not flash, and recoverable errors that keep existing rows visible.
date: 2026-07-27
updated: "2026-07-02"
category: Data
tags: empty state, loading, error handling, ux, recipe
author: Kamelia M
---

Every grid demo ships with data already loaded. Every grid in production starts empty, stalls while fetching, and occasionally breaks. Those three states are where the real UX work happens, and they are almost always the last things teams implement - if at all.

The fix is not complicated. It is mostly a matter of thinking through each state before you write the happy path instead of after.

## Two empties, two messages

The single most common mistake I see in grids is conflating two distinct empty states into one. "No data" and "no matches" are different problems, and treating them the same sends the user down the wrong path.

If a user clears the search box and gets "No records found," they might think the table is broken or that no data was ever loaded. If they applied three filters and your grid says "Add your first record," that is equally confusing. You need to know which empty you are in.

```svelte
<script lang="ts">
  import SvGrid from '@svgrid/grid'
  import {
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
  } from '@svgrid/grid'
  import type { ColumnDef, TableFeatures } from '@svgrid/grid'

  let { rows, columns, loading, error, onRetry } = $props()

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  // Derived from the filter state, not a hardcoded flag
  let api = $state(null)
  let hasActiveFilters = $derived(
    api ? api.getState().columnFilters?.length > 0 : false
  )

  function clearFilters() {
    api?.clearAllFilters()
  }
</script>

{#if !loading && !error && rows.length === 0}
  <div class="sg-empty-state">
    {#if hasActiveFilters}
      <p>No rows match the active filters.</p>
      <button onclick={clearFilters}>Clear filters</button>
    {:else}
      <p>No records yet.</p>
    {/if}
  </div>
{:else if !error}
  <SvGrid
    data={rows}
    {columns}
    {features}
    onApiReady={(a) => { api = a }}
  />
{/if}
```

The `hasActiveFilters` check reads from the grid's own state rather than a manually-tracked boolean - that way it stays accurate when filters are applied programmatically, not just through the filter row.

## Skeleton on first load, overlay on refetch

Spinners have two problems: they give no sense of layout, and they cause a jarring layout shift when they disappear. A skeleton that mimics the grid's row structure avoids both. Users see where the columns will land before data arrives.

The subtler problem is what to show on a refetch - when the user pages, sorts, or refreshes and the grid already has rows. Blanking the grid on every page flip feels like a bug. The better pattern is to keep the current rows visible and apply a low-opacity overlay to signal "fetching without replacing."

```svelte
<script lang="ts">
  import SvGrid from '@svgrid/grid'
  import { tableFeatures, rowPaginationFeature, rowSortingFeature } from '@svgrid/grid'
  import { createServerDataSource } from '@svgrid/grid'
  import type { ColumnDef } from '@svgrid/grid'

  let { columns } = $props()

  let loading = $state(true)
  let fetching = $state(false)  // subsequent loads
  let rows = $state([])

  const features = tableFeatures({ rowSortingFeature, rowPaginationFeature })

  const ds = createServerDataSource({
    fetch: async ({ page, pageSize, sort, filters }) => {
      // First load vs refetch distinction
      if (rows.length === 0) loading = true
      else fetching = true

      try {
        const res = await fetch(
          `/api/records?page=${page}&size=${pageSize}`
        )
        const json = await res.json()
        rows = json.data
        return { rows: json.data, total: json.total }
      } finally {
        loading = false
        fetching = false
      }
    }
  })
</script>

{#if loading}
  <!-- Skeleton: fixed height rows that match the real row height -->
  <div class="sg-skeleton" aria-busy="true" aria-label="Loading data">
    {#each { length: 8 } as _, i}
      <div class="sg-skeleton-row" style="--delay: {i * 60}ms"></div>
    {/each}
  </div>
{:else}
  <div class="sg-grid-wrapper" class:sg-fetching={fetching}>
    <SvGrid
      data={ds}
      {columns}
      {features}
      pageable
    />
  </div>
{/if}
```

```css
.sg-skeleton-row {
  height: 32px;
  margin-bottom: 1px;
  background: linear-gradient(
    90deg,
    var(--sg-border) 25%,
    var(--sg-bg) 50%,
    var(--sg-border) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out var(--delay, 0ms) infinite;
  border-radius: var(--sg-radius);
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.sg-fetching {
  opacity: 0.6;
  pointer-events: none;
  transition: opacity 150ms ease;
}
```

The `--delay` custom property staggers the shimmer animation across rows so they do not all pulse in unison, which looks mechanical.

## Error handling that does not lose the user's work

The instinct is to replace the grid with an error panel. That instinct is wrong when the grid already has data. A failed page change or refresh should not wipe the screen - the user is still looking at valid (if stale) rows.

The two cases to handle separately:

1. **Initial load fails** - nothing to show, so display the error with a retry button.
2. **Refetch fails** - keep the current rows visible and show a non-blocking error notice, probably a toast or a small banner above the grid.

```svelte
<script lang="ts">
  import SvGrid from '@svgrid/grid'
  import { tableFeatures, rowSortingFeature } from '@svgrid/grid'
  import type { ColumnDef } from '@svgrid/grid'

  let { columns } = $props()

  let rows = $state([])
  let error = $state<string | null>(null)
  let fetchError = $state<string | null>(null)  // non-destructive error

  const features = tableFeatures({ rowSortingFeature })

  async function loadData() {
    error = null
    fetchError = null
    try {
      const res = await fetch('/api/records')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      rows = await res.json()
    } catch (e) {
      if (rows.length === 0) {
        // Initial load failed - nothing to keep
        error = (e as Error).message
      } else {
        // Refetch failed - show non-destructive notice
        fetchError = 'Could not refresh. Showing previous data.'
      }
    }
  }

  $effect(() => { loadData() })
</script>

{#if error}
  <div class="sg-error-state" role="alert">
    <p>Could not load data: {error}</p>
    <button onclick={loadData}>Retry</button>
  </div>
{:else}
  {#if fetchError}
    <div class="sg-error-banner" role="status">{fetchError}</div>
  {/if}
  <SvGrid
    data={rows}
    {columns}
    {features}
  />
{/if}
```

One detail worth getting right: `role="alert"` on the full-screen error triggers screen reader announcement immediately. `role="status"` on the non-destructive banner announces it politely without interrupting.

## Putting it together in a shared component

These three states belong in a single wrapper component you drop in once and reuse across every grid in the app. The wrapper handles state logic; the grid handles data display.

```svelte
<!-- GridShell.svelte -->
<script lang="ts" generics="TRow">
  import SvGrid from '@svgrid/grid'
  import type { ColumnDef, SvGridOptions } from '@svgrid/grid'

  let {
    data,
    columns,
    features,
    loading = false,
    fetching = false,
    error = null,
    refetchError = null,
    emptyMessage = 'No records.',
    hasActiveFilters = false,
    onClearFilters,
    onRetry,
    ...rest
  }: {
    data: TRow[]
    columns: ColumnDef<any, TRow>[]
    features: any
    loading?: boolean
    fetching?: boolean
    error?: string | null
    refetchError?: string | null
    emptyMessage?: string
    hasActiveFilters?: boolean
    onClearFilters?: () => void
    onRetry?: () => void
  } = $props()
</script>

{#if loading}
  <div class="sg-skeleton" aria-busy="true">
    {#each { length: 8 } as _, i}
      <div class="sg-skeleton-row" style="--delay: {i * 60}ms"></div>
    {/each}
  </div>
{:else if error}
  <div class="sg-error-state" role="alert">
    <p>{error}</p>
    {#if onRetry}<button onclick={onRetry}>Retry</button>{/if}
  </div>
{:else if data.length === 0}
  <div class="sg-empty-state">
    {#if hasActiveFilters}
      <p>No rows match the active filters.</p>
      {#if onClearFilters}<button onclick={onClearFilters}>Clear filters</button>{/if}
    {:else}
      <p>{emptyMessage}</p>
    {/if}
  </div>
{:else}
  {#if refetchError}
    <div class="sg-error-banner" role="status">{refetchError}</div>
  {/if}
  <div class="sg-grid-wrapper" class:sg-fetching={fetching}>
    <SvGrid {data} {columns} {features} {...rest} />
  </div>
{/if}
```

The generics annotation on the script tag keeps column type inference intact through the wrapper, so you do not lose the TypeScript benefit of typed row data.

## The states worth testing explicitly

Happy-path tests are not enough here. Each state needs at least one test case where you can verify the right message appears and the right action is available. In practice that means Playwright tests or Storybook stories - one story per state, with static data stubbed for each scenario.

Three states, three stories: empty with no filters, empty with filters active, loading skeleton, initial error with retry, refetch error with stale data visible. That is the minimum bar for a grid you would call production-ready.
