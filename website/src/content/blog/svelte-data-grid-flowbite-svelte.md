---
title: Using SvGrid with Flowbite Svelte
description: Wire SvGrid into a Flowbite Svelte app - map CSS tokens for dark mode, build toolbar controls from Flowbite components, and put Flowbite Buttons inside cell renderers.
date: 2026-06-13
updated: 2026-07-02
category: Integration
tags: flowbite, theming, design system, integration, svelte data grid
author: Boyko Markov
---

Flowbite Svelte handles your modals, dropdowns, and form inputs. Your data grid should not look like it wandered in from a different decade. The good news: SvGrid exposes every visual decision as a `--sg-*` CSS custom property, and those properties accept any valid CSS value - including `var()` references pointing at Tailwind's design tokens. You write one CSS class, point it at Flowbite's color scale, and both dark mode and brand color changes propagate to the grid automatically.

## Two theming systems, one cascade

Flowbite's components are styled by Tailwind utilities and, in Tailwind v4, by CSS custom properties like `--color-primary-600` and `--color-gray-200`. SvGrid is styled entirely by its own `--sg-*` properties. The bridge between them is a single CSS class you apply to a wrapper `<div>`:

```css
/* styles/grid-flowbite.css - import once in your root layout */
.sg-flowbite {
  --sg-accent:         var(--color-primary-600);
  --sg-border:         var(--color-gray-200);
  --sg-header-bg:      var(--color-gray-50);
  --sg-header-fg:      var(--color-gray-700);
  --sg-row-alt-bg:     var(--color-gray-50);
  --sg-row-hover-bg:   var(--color-gray-100);
  --sg-selection-bg:   var(--color-primary-100);
  --sg-focus-ring:     0 0 0 2px var(--color-primary-300);
  --sg-bg:             #ffffff;
  --sg-fg:             var(--color-gray-900);
  --sg-muted:          var(--color-gray-500);
  --sg-radius:         0.5rem;
  --sg-cell-px:        12px;
  --sg-font:           ui-sans-serif, system-ui, sans-serif;
}

/* Flowbite dark mode is a .dark class on <html> - SvGrid picks it up through the cascade */
.dark .sg-flowbite {
  --sg-bg:             var(--color-gray-900);
  --sg-fg:             var(--color-gray-100);
  --sg-muted:          var(--color-gray-400);
  --sg-border:         var(--color-gray-700);
  --sg-header-bg:      var(--color-gray-800);
  --sg-header-fg:      var(--color-gray-200);
  --sg-row-alt-bg:     var(--color-gray-800);
  --sg-row-hover-bg:   var(--color-gray-700);
  --sg-selection-bg:   var(--color-primary-900);
  --sg-accent:         var(--color-primary-400);
  --sg-focus-ring:     0 0 0 2px var(--color-primary-500);
}
```

When Flowbite's `DarkMode` toggle adds `dark` to `<html>`, both Flowbite components and the SvGrid instance re-paint through CSS alone. No JavaScript event listener on the grid side, no second theme object to keep in sync.

If you are on Tailwind v3, `--color-gray-200` is not emitted as a CSS custom property by default - replace those `var()` references with literal hex values from your Tailwind config, or enable the CSS variables plugin.

## Building the order management screen

The example below is a complete order management view: Flowbite toolbar controls above a virtualized grid of 5,000 rows. The action column renders Flowbite `Button` components directly inside cells using SvGrid's snippet renderer.

```svelte
<script lang="ts">
  import SvGrid, {
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    rowPaginationFeature,
    renderSnippet,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import {
    Toolbar, ToolbarGroup, Input, Button, Badge,
  } from 'flowbite-svelte'
  import { SearchOutline, DownloadOutline } from 'flowbite-svelte-icons'

  type Order = {
    id: string
    customer: string
    amount: number
    status: 'pending' | 'shipped' | 'delivered' | 'cancelled'
    date: string
  }

  const STATUS_COLOR: Record<Order['status'], 'yellow' | 'blue' | 'green' | 'red'> = {
    pending:   'yellow',
    shipped:   'blue',
    delivered: 'green',
    cancelled: 'red',
  }

  const seed: Order[] = Array.from({ length: 5_000 }, (_, i) => ({
    id:       'ORD-' + (10_000 + i),
    customer: ['Alice Muller','Ben Nakamura','Chiara Russo','Dmitri Volkov','Eva Johansson'][i % 5]!,
    amount:   Math.round((10 + (i * 7919) % 990) * 100) / 100,
    status:   (['pending','shipped','delivered','cancelled'] as const)[i % 4]!,
    date:     new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10),
  }))

  let rows  = $state<Order[]>(seed)
  let query = $state('')
  let api   = $state<SvGridApi | null>(null)

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    rowPaginationFeature,
  })

  const columns: ColumnDef<typeof features, Order>[] = [
    { id: 'id',       field: 'id',       header: 'Order',    width: 120 },
    { id: 'customer', field: 'customer', header: 'Customer', width: 200 },
    {
      id: 'amount',
      field: 'amount',
      header: 'Amount',
      width: 110,
      type: 'number',
      cell: ({ value }) => `$${(value as number).toFixed(2)}`,
    },
    {
      id: 'status',
      field: 'status',
      header: 'Status',
      width: 130,
      cell: renderSnippet(StatusCell, ({ value }) => ({ status: value as Order['status'] })),
    },
    { id: 'date', field: 'date', header: 'Date', width: 110 },
    {
      id: 'actions',
      header: '',
      width: 130,
      cell: renderSnippet(ActionCell, ({ row }) => ({ row: row as Order })),
    },
  ]

  function exportVisible() {
    if (!api) return
    const target = api.getSelectedRows().length > 0
      ? api.getSelectedRows()
      : api.getDisplayedRows()
    const csv = [
      'id,customer,amount,status,date',
      ...target.map((r) => {
        const o = r as Order
        return `${o.id},${o.customer},${o.amount},${o.status},${o.date}`
      }),
    ].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    Object.assign(document.createElement('a'), { href: url, download: 'orders.csv' }).click()
    URL.revokeObjectURL(url)
  }

  $effect(() => {
    api?.setFilter('customer', query.length >= 2 ? { value: query } : undefined)
  })
</script>

{#snippet StatusCell(p: { status: Order['status'] })}
  <Badge color={STATUS_COLOR[p.status]} class="capitalize">{p.status}</Badge>
{/snippet}

{#snippet ActionCell(p: { row: Order })}
  <div class="flex gap-1 px-1">
    <Button size="xs" color="light" onclick={() => console.log('edit', p.row.id)}>Edit</Button>
    <Button size="xs" color="red" onclick={() => { rows = rows.filter(r => r.id !== p.row.id) }}>
      Del
    </Button>
  </div>
{/snippet}

<div class="flex h-screen flex-col gap-3 bg-white p-4 dark:bg-gray-900">
  <Toolbar>
    <ToolbarGroup>
      <div class="relative w-64">
        <SearchOutline class="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
        <Input bind:value={query} placeholder="Filter by customer..." class="h-9 pl-9" />
      </div>
    </ToolbarGroup>
    <ToolbarGroup class="ml-auto">
      <Button color="light" size="sm" onclick={exportVisible}>
        <DownloadOutline class="mr-1.5 h-4 w-4" /> Export CSV
      </Button>
    </ToolbarGroup>
  </Toolbar>

  <div class="sg-flowbite min-h-0 flex-1 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
    <SvGrid
      data={rows}
      {columns}
      {features}
      pageSize={100}
      sortable
      filterable
      virtualization={true}
      onApiReady={(a) => { api = a }}
    />
  </div>
</div>
```

## How the snippet cell renderer works

`renderSnippet` is a factory that takes a Svelte 5 snippet and a projection function. The projection receives SvGrid's cell context object and maps it to the snippet's props. In the `actions` column, `({ row }) => ({ row: row as Order })` extracts the typed row from the context and forwards it to `ActionCell`.

The key detail: `cell: renderSnippet(ActionCell, ...)` is correct. `cell: ActionCell` is not - it passes a snippet reference where SvGrid expects a renderer function and the cell renders nothing. This is the most common mistake when first adding Flowbite components to cells.

The `StatusCell` snippet uses Flowbite's `Badge` component with a color derived from the row's status value. Because snippets are full Svelte components in scope, you have access to props, reactive state, and any import - the cell does not need to know it is inside a grid.

## The `min-h-0` requirement

The grid wrapper sits inside a `flex-col` container with `h-screen`. Without `min-h-0` on the wrapper, flex children do not shrink below their content size, which means the grid either collapses to zero or overflows the viewport depending on how the height is set. Adding `min-h-0 flex-1` to the wrapper div fixes both cases. This is a CSS flexbox rule, not a grid quirk - it applies to any virtualized component in a flex layout.

## Connecting the toolbar filter to the grid

The `$effect` that calls `api?.setFilter(...)` runs whenever `query` changes. It applies a column-level filter on the `customer` field via SvGrid's imperative API, which the `columnFilteringFeature` picks up immediately without a re-render of the toolbar. The two-character minimum prevents single-keystroke filters from reducing 5,000 rows to a handful while the user is still typing.

For debouncing, wrap `query` in a debounced derived state before the effect reads it - the pattern is the same as debouncing any reactive value in Svelte 5.

The export function reads selected rows first and falls back to the full displayed set if nothing is selected. `api.getDisplayedRows()` returns rows in the current sort and filter order, so the CSV matches what the user sees rather than the original insertion order.

## Tailwind v3 vs v4

Tailwind v4 emits `--color-*` properties into the global stylesheet automatically. Tailwind v3 does not. If your `var(--color-gray-200)` references in the CSS class resolve to empty strings, check which version you are on. The fix for v3 is to replace the `var()` references with literal values extracted from `tailwind.config.js`, or to enable the `@tailwindcss/custom-properties` plugin if your team prefers to keep the references dynamic.

A quick diagnostic: open DevTools, inspect the `<html>` element, and look for `--color-gray-200` in the computed styles panel. If it is absent, you are on v3 without the plugin.

One other thing to check when using brand colors: Flowbite resolves `primary` through its Tailwind plugin. If you have not configured a `primary` color in your Tailwind config, `--color-primary-600` will be empty and the grid's accent color (sort indicators, selection highlight, focus ring) will fall back to the browser's default. The fix is a two-line addition to `tailwind.config.js` that maps `primary` to your brand scale.
