---
title: Using SvGrid with Skeleton UI
description: Map SvGrid's CSS token system to Skeleton UI's theme variables once, and the grid inherits dark mode, palette swaps, and every future Skeleton theme automatically.
date: 2026-06-13
updated: 2026-07-02
category: Integration
tags: skeleton ui, theming, design system, integration, svelte data grid
author: Kamelia M
---

Both SvGrid and Skeleton UI are driven entirely by CSS custom properties. SvGrid reads `--sg-*` tokens for every visual detail - backgrounds, borders, hover states, selection highlight. Skeleton exposes its palette as `--color-surface-*` and `--color-primary-*` triplets on `:root`. Wire one system to the other in CSS, and the grid inherits Skeleton's dark mode toggle for free. No JavaScript, no Svelte store, no `$effect`.

## Why triplets and not hex values

Skeleton stores color values as bare RGB triplets, for example `--color-surface-50: 249 250 251`. This is intentional: it lets Skeleton compose alpha variants at the call site using the modern `rgb(var(--color-surface-50) / 0.5)` syntax, rather than pre-baking every opacity level as a separate variable.

The implication for SvGrid is that you cannot write `--sg-bg: var(--color-surface-50)` - that hands a string like `249 250 251` to a property that expects a valid CSS color, and the background goes transparent. The correct form is always `--sg-bg: rgb(var(--color-surface-50))`. Get this wrong and the failure mode is silent: the grid renders, but with a washed-out or invisible surface.

## Token mapping

Place the mapping on a wrapper class rather than globally. This scopes the overrides, lets you have multiple grids with different themes on the same page, and keeps the rest of your stylesheet clean.

```css
/* src/app.css - alongside your Skeleton @import */

.sg-shell {
  /* Surfaces */
  --sg-bg:             rgb(var(--color-surface-50));
  --sg-fg:             rgb(var(--color-surface-900));
  --sg-border:         rgb(var(--color-surface-300));
  --sg-header-bg:      rgb(var(--color-surface-100));
  --sg-header-fg:      rgb(var(--color-surface-800));
  --sg-row-alt-bg:     rgb(var(--color-surface-100));
  --sg-row-hover-bg:   rgb(var(--color-surface-200));

  /* Accent and selection */
  --sg-accent:         rgb(var(--color-primary-500));
  --sg-selection-bg:   rgb(var(--color-primary-500) / 0.12);
  --sg-focus-ring:     0 0 0 2px rgb(var(--color-primary-500) / 0.35);

  /* Scrollbar */
  --sg-scrollbar-bg:           rgb(var(--color-surface-100));
  --sg-scrollbar-thumb:        rgb(var(--color-surface-400));
  --sg-scrollbar-thumb-hover:  rgb(var(--color-surface-600));
  --sg-scrollbar-thumb-active: rgb(var(--color-primary-500));

  /* Typography */
  --sg-font: var(--font-family-base, ui-sans-serif, system-ui, sans-serif);

  /* Layout */
  --sg-row-height: 44px;

  /* Flex sizing so the grid fills the AppShell content slot */
  display:    flex;
  flex:       1 1 0;
  min-height: 0;
  height:     100%;
}
```

The dark mode chain works like this: when the user toggles Skeleton's dark mode, Skeleton swaps the numeric triplets on `:root`. Because `rgb(var(--color-surface-50))` is a live CSS expression, not a snapshot, every `--sg-*` token re-evaluates instantly. Every grid cell that paints from `--sg-bg` updates in the same paint cycle. There is no additional dark-mode block on the SvGrid side.

The `min-height: 0` on `.sg-shell` is not optional. Without it, the flex child expands to fit its content - all 5,000 rows rendered into the DOM at once. The row virtualizer only engages when the grid wrapper has a constrained height with overflow clipping. Symptom if you miss it: the grid looks fine at 50 rows, then the browser tab freezes at 500+.

## A real component: order management table

The component below is a working Svelte 5 file. It renders 5,000 orders with sorting, column-level filters, row selection, and pagination. The toolbar above the grid is built from Skeleton's own button components and talks to the grid exclusively through the `SvGridApi` returned by `onApiReady`.

```svelte
<!-- src/routes/orders/+page.svelte -->
<script lang="ts">
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    rowPaginationFeature,
    renderSnippet,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Order = {
    id:       string
    customer: string
    product:  string
    qty:      number
    total:    number
    status:   'pending' | 'shipped' | 'cancelled'
    date:     string
  }

  function seedOrders(n: number): Order[] {
    const statuses: Order['status'][] = ['pending', 'shipped', 'cancelled']
    return Array.from({ length: n }, (_, i) => ({
      id:       'ORD-' + (10000 + i),
      customer: 'Customer ' + ((i % 200) + 1),
      product:  'Product '  + ((i % 40)  + 1),
      qty:      1 + (i % 20),
      total:    Math.round((9.99 + (i % 500)) * 100) / 100,
      status:   statuses[i % 3]!,
      date:     new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10),
    }))
  }

  let rows = $state<Order[]>(seedOrders(5_000))
  let api  = $state<SvGridApi | null>(null)

  // Full class names so Tailwind's scanner can see them at build time
  const STATUS_VARIANT: Record<Order['status'], string> = {
    pending:   'variant-soft-warning',
    shipped:   'variant-soft-success',
    cancelled: 'variant-soft-error',
  }

  const columns: ColumnDef<Order>[] = [
    { id: 'id',       field: 'id',       header: 'Order',    width: 110 },
    { id: 'customer', field: 'customer', header: 'Customer', width: 180 },
    { id: 'product',  field: 'product',  header: 'Product',  width: 160 },
    { id: 'qty',      field: 'qty',      header: 'Qty',      width: 70,  type: 'number' },
    { id: 'total',    field: 'total',    header: 'Total',    width: 100, type: 'number' },
    {
      id:     'status',
      field:  'status',
      header: 'Status',
      width:  130,
      cell:   statusCell,
    },
    { id: 'date', field: 'date', header: 'Date', width: 120 },
  ]

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    rowPaginationFeature,
  })

  function deleteSelected() {
    if (!api) return
    const ids = new Set(api.getSelectedRows().map((r: Order) => r.id))
    rows = rows.filter((r) => !ids.has(r.id))
    api.clearRowSelection()
  }

  function exportCSV() {
    if (!api) return
    const selected = api.getSelectedRows() as Order[]
    const target   = selected.length ? selected : (api.getData() as Order[])
    const header   = ['id', 'customer', 'product', 'qty', 'total', 'status', 'date']
    const csv      = [header.join(','), ...target.map((r) => header.map((k) => (r as any)[k]).join(','))].join('\n')
    const a        = document.createElement('a')
    a.href         = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download     = 'orders.csv'
    a.click()
  }
</script>

{#snippet statusCell({ value }: { value: Order['status'] })}
  <span class="badge {STATUS_VARIANT[value]}">{value}</span>
{/snippet}

<div class="flex h-full flex-col gap-2 p-4">

  <!-- Toolbar: Skeleton components calling SvGridApi methods -->
  <div class="flex items-center gap-2 flex-wrap">
    <button class="btn variant-filled-primary btn-sm"
            onclick={() => api?.selectAllRows()}>
      Select all
    </button>
    <button class="btn variant-soft btn-sm"
            onclick={() => api?.clearRowSelection()}>
      Clear
    </button>
    <button class="btn variant-filled-error btn-sm"
            onclick={deleteSelected}>
      Delete selected
    </button>
    <button class="btn variant-soft-secondary btn-sm"
            onclick={exportCSV}>
      Export CSV
    </button>
    <button class="btn variant-soft btn-sm"
            onclick={() => api?.clearAllFilters()}>
      Clear filters
    </button>
  </div>

  <!-- sg-shell applies all --sg-* tokens and flex sizing -->
  <div class="sg-shell">
    <SvGrid
      data={rows}
      {columns}
      {features}
      rowId="id"
      sortable
      filterable
      pageable
      showFilterRow={true}
      onApiReady={(a) => (api = a)}
    />
  </div>
</div>
```

## Tailwind purge and dynamic class names

The `STATUS_VARIANT` object is a deliberate choice. A string like `'variant-soft-' + status` assembled at runtime is invisible to Tailwind's content scanner and gets purged from the production build. Skeleton badge variants disappear silently - the `<span>` renders, but without any styles. Using a literal lookup table means all three class names appear as string literals in the source file and survive the build.

If you need more than three variants or you are generating classes from an API response, add them to Tailwind's safelist in `tailwind.config.ts`:

```ts
// tailwind.config.ts
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  safelist: [
    'variant-soft-warning',
    'variant-soft-success',
    'variant-soft-error',
    'variant-filled-primary',
    'variant-ghost-surface',
  ],
  // ...
}
```

## Row height and header height

`--sg-row-height` applies to both data rows and column headers. At `44px` they are identical, which matches Skeleton's default component sizing. If your design calls for a taller header - to accommodate a two-line label or a filter input that needs more space - override it separately after the shared token:

```css
.sg-shell {
  --sg-row-height:    40px;  /* data rows */
  --sg-header-height: 52px;  /* column headers only */
}
```

The filter row, if enabled via `showFilterRow`, uses `--sg-row-height` as well. If your filter inputs overflow that height, either increase `--sg-row-height` or target the filter row with `--sg-filter-row-height`.

## Where Skeleton's `data-theme` must live

Skeleton's theme switcher writes a `data-theme` attribute to trigger CSS variable swaps. That attribute must be on an ancestor of `.sg-shell` - almost always `<html>` or `<body>`. If it ends up on a sibling element, Skeleton's `--color-*` variables are not in scope for `.sg-shell`, and the grid falls back to its built-in defaults instead of your mapped tokens. This is the most common setup error when using Skeleton with any component that relies on inherited CSS variables.

## Keeping Skeleton components outside the grid body

Skeleton modals, drawers, and dropdowns use portals that render outside the normal DOM tree. Placing them inside a `renderSnippet` cell works for static content like badges and avatars, but anything with a portal - a `<Popover>` or `<Select>` - will have its overlay clipped by the grid's overflow container or positioned incorrectly relative to the viewport.

The pattern that works: render a trigger button inside the cell, lift the portal-based component to the page level, and communicate through a shared `$state` variable. The grid cell sets the state (which row, which action), the page-level component reacts to it.

```svelte
<!-- At page level, outside the grid -->
{#if selectedOrderId}
  <Modal open onclose={() => (selectedOrderId = null)}>
    <OrderDetail orderId={selectedOrderId} />
  </Modal>
{/if}

<!-- Inside the cell snippet -->
{#snippet actionsCell({ row })}
  <button class="btn btn-sm variant-ghost-surface"
          onclick={() => (selectedOrderId = row.id)}>
    View
  </button>
{/snippet}
```

This keeps the grid fast and Skeleton's portal-based components working correctly.
