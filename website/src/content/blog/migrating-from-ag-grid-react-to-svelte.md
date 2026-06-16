---
title: Migrating from ag-grid-react to a Svelte Stack
description: Moving a React app's ag-grid-react screens to Svelte 5 and SvGrid - translating column defs, hooks, cell renderers, and the server-side row model.
date: 2026-08-11
category: Comparisons
tags: migration, ag-grid-react, react, comparison, svelte data grid
author: Kamelia M
---

If you are moving an app from React to Svelte, the `ag-grid-react` screens are often the most involved part to port. The grid concepts carry over to SvGrid cleanly; what changes is React's component/hook model becoming Svelte runes. Here is the playbook.

## Concept mapping

| ag-grid-react | SvGrid |
| --- | --- |
| `<AgGridReact rowData columnDefs />` | `<SvGrid data columns />` |
| `columnDefs` | `columns` |
| `field` / `headerName` | `field` / `header` |
| `valueFormatter` | `format` / `formatter` |
| `cellRenderer` (React component) | `cell` via `renderSnippet` |
| `valueGetter` | `accessorFn` |
| `onCellValueChanged` | `onCellValueChange` |
| `useState` / `useMemo` | `$state` / `$derived` |
| `useCallback` handlers | plain functions |
| Server-Side Row Model | external mode |
| Enterprise modules | @svgrid/enterprise |

## Components and renderers

A React cell renderer component becomes a Svelte snippet:

```tsx
// ag-grid-react
const StatusRenderer = (p) => <span className="badge">{p.value}</span>
// columnDefs: [{ field: 'status', cellRenderer: StatusRenderer }]
```

```svelte
<!-- SvGrid -->
{#snippet StatusCell(p: { value: string })}<span class="badge">{p.value}</span>{/snippet}
// columns: [{ field: 'status', header: 'Status', cell: (c) => renderSnippet(StatusCell, { value: c.getValue() }) }]
```

## Hooks to runes

The biggest mental shift is reactivity. React re-renders components and you optimize with `useMemo`/`useCallback`; Svelte 5 runes are fine-grained, so a `$derived` recomputes only when its inputs change and there is no dependency array to manage. Most memoization simply disappears.

```svelte
<script lang="ts">
  let rows = $state<Row[]>([])
  let query = $state('')
  let visible = $derived(rows.filter(r => r.name.includes(query)))
</script>
```

## Server-side

AG Grid's Server-Side Row Model maps to SvGrid external mode - callbacks plus a total `rowCount`. See [Server-Side Data](server-side-data) and the [SvelteKit + Supabase guide](svelte-data-grid-sveltekit-supabase).

## Frequently asked questions

### What is the hardest part of moving ag-grid-react to Svelte?

Usually the surrounding React patterns, not the grid. Column definitions, cell renderers, events, and the server-side row model map directly to SvGrid; React hooks become Svelte runes, which removes most memoization.

### Do I lose AG Grid Enterprise features moving to Svelte?

The standard feature set is in SvGrid's MIT core, and enterprise-style features (pivot, export, range selection) are in @svgrid/enterprise. Check the [comparison](/compare/ag-grid) for specifics before porting.
