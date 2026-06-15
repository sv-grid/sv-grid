---
title: Migrating from TanStack Table (Svelte) to SvGrid
description: Move from TanStack Table's headless Svelte adapter to SvGrid - mapping column helpers, flexRender, and row models, and deciding what to keep.
date: 2026-06-28
category: Comparisons
tags: migration, tanstack table, comparison, svelte data grid
author: Kamelia M
---

TanStack Table is a great headless engine. You might move to SvGrid to stop hand-building the UI, to get a Svelte-5-native (runes, not stores) data flow, or for built-in virtualization and Excel-style filters. Here is how the pieces map - and an honest note on when to stay.

## First, an honest note

If you specifically want a framework-agnostic engine and total control over markup, TanStack Table is a strong choice - keep it. Migrate to SvGrid when you would rather have a render component (and a headless core when you need it), native runes, and batteries like virtualization and filtering included.

## Concept mapping

| TanStack Table | SvGrid |
| --- | --- |
| `createSvelteTable` / `useReactTable` | `<SvGrid>` or `createSvGrid` |
| `columnHelper.accessor('x', ...)` | `{ field: 'x' }` |
| `columnHelper.accessor(fn, { id })` | `{ id, accessorFn }` |
| `header` / `cell` (flexRender) | `header` / `cell` via `renderSnippet` |
| `getSortedRowModel()` | `rowSortingFeature` |
| `getFilteredRowModel()` | `columnFilteringFeature` |
| `getPaginationRowModel()` | `rowPaginationFeature` |
| `getGroupedRowModel()` | `columnGroupingFeature` |
| state + `onXChange` (stores) | props + `onXChange` (runes) |

## Columns

```ts
// TanStack
const columns = [
  columnHelper.accessor('name', { header: 'Name' }),
  columnHelper.accessor(r => `${r.first} ${r.last}`, { id: 'full', header: 'Full' }),
]

// SvGrid
const columns: ColumnDef<{}, Row>[] = [
  { field: 'name', header: 'Name' },
  { id: 'full', header: 'Full', accessorFn: r => `${r.first} ${r.last}` },
]
```

## Rendering

TanStack's `flexRender` becomes a Svelte snippet via `renderSnippet`. Where TanStack leaves the whole table markup to you, SvGrid's `<SvGrid>` renders it; if you liked owning the DOM, use `createSvGrid` and keep rendering yourself - same column definitions.

## State: stores to runes

TanStack's Svelte adapter wires state through stores and `.subscribe`. In SvGrid, state is plain runes:

```svelte
<script lang="ts">
  let sorting = $state([])
</script>
<SvGrid data={rows} columns={columns} features={features}
  onSortingChange={(s) => (sorting = s)} />
```

## Frequently asked questions

### Should I switch from TanStack Table to SvGrid?

Switch if you want a Svelte-5-native data flow (runes, not stores) and built-in rendering, virtualization, and Excel-style filters. Stay on TanStack Table if you need a framework-agnostic engine and prefer to build all markup yourself.

### Is SvGrid also headless like TanStack Table?

Yes. SvGrid's `createSvGrid` core is headless - the row-model pipeline with no markup - and it adds a `<SvGrid>` render component on top, so you can keep building your own UI or adopt the component.
