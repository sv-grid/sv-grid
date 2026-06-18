---
title: Building an Admin Dashboard in Svelte 5
description: A practical blueprint for an admin dashboard in Svelte 5 - layout, a data grid at the center, filtering, bulk actions, and inline editing.
date: 2026-06-26
category: Use cases
tags: dashboard, admin, use case, svelte data grid
author: Kamelia M
---

Strip most admin dashboards down and they are a data grid with some controls bolted around it. Get the grid and the layout right and everything else is detail. Here is a practical blueprint for one in Svelte 5, with SvGrid in the middle.

![An admin dashboard built with SvGrid](/blog-media/admin-dashboard.png)
*An admin dashboard built around SvGrid.*

## The layout

An admin shell is a fixed header and sidebar with a scrolling content area. The grid should own the content area's height so virtualization works. The key is a flex column where the grid gets `flex: 1` and `min-height: 0`:

```svelte
<div style="display:flex; flex-direction:column; height:100vh;">
  <header>App bar</header>
  <div style="display:flex; flex:1; min-height:0;">
    <aside>Nav</aside>
    <main style="flex:1; min-height:0; display:flex; flex-direction:column;">
      <Toolbar />
      <div style="flex:1; min-height:0;">
        <SvGrid data={rows} columns={columns} features={features} />
      </div>
    </main>
  </div>
</div>
```

Without `min-height: 0`, the grid grows past the viewport and you lose internal scrolling.

## The data grid at the center

For an admin grid you usually want sorting, filtering, pagination, and row selection on from the start:

```ts
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
})
```

Add `filterMode="menu"`, `showPagination`, `selectionMode="row"`, and `enableInlineEditing` as your screens need them.

## A toolbar that reacts to selection

The dashboard pattern users expect: select rows, then act. Surface a contextual bar when something is selected:

```svelte
{#if selected.length}
  <div class="bulk-bar">
    {selected.length} selected
    <button onclick={() => archive(selected)}>Archive</button>
    <button onclick={() => exportRows(selected)}>Export</button>
  </div>
{/if}
```

Wire it with `onRowSelectionChange={(state, rows) => (selected = rows)}`.

## Inline editing with optimistic saves

Admins edit in place. Make the relevant columns editable and save optimistically so it feels instant:

```ts
async function save(e) {
  rows[e.rowIndex] = { ...e.row, [e.columnId]: e.newValue }
  try { await api.patch(e.row.id, { [e.columnId]: e.newValue }) }
  catch { rows[e.rowIndex] = { ...e.row, [e.columnId]: e.oldValue } }
}
```

## Scaling up

When the dataset outgrows the browser, switch the grid to server-side mode without changing the UI, see [Server-Side Data](server-side-data) and the [SvelteKit + Supabase guide](svelte-data-grid-sveltekit-supabase). Add export and pivot from the Enterprise pack if your admins need reporting. Start free with the MIT core; see [render your first grid](render-your-first-svelte-data-grid).

## Frequently asked questions

### How do I size a data grid to fill an admin dashboard layout?

Put the grid in a flex column with `flex: 1` and `min-height: 0` on its container so it fills the content area and scrolls internally. Without `min-height: 0`, the grid overflows the viewport and virtualization breaks.

### What features do I need for an admin data grid?

Typically sorting, filtering, pagination, and row selection, plus inline editing for in-place updates and a contextual toolbar for bulk actions. Register only those features so the bundle stays small.
