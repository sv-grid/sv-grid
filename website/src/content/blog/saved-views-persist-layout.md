---
title: Saved Views - Persist Grid Layout and Filters
description: Let users save and switch named views of a data grid - column order, widths, sorting, and filters - persisted to localStorage or the server.
date: 2026-09-04
category: Data
tags: saved views, persistence, layout, recipe, svelte data grid
author: Victor Vidolov
---

Power users want their grid the way they left it - and often want several named setups: "Overdue", "My accounts", "This quarter". Saved views capture the grid's configuration and let users switch between them. Here is how to build them on SvGrid.

![Saving a grid layout in SvGrid](/blog-media/column-layout.png)
*Saving and restoring grid layouts in SvGrid.*

## What a view contains

A view is just serializable state:

```ts
type GridView = {
  name: string
  sorting: { id: string; desc: boolean }[]
  filters: { id: string; operator: string; value: unknown }[]
  columnOrder: string[]
  columnWidths: Record<string, number>
  hidden: string[]
}
```

Capture each piece from the grid's observable callbacks (`onSortingChange`, `onFiltersChange`) and your own column-order/width/visibility state.

## Apply a view

To switch views, set the grid's state from the saved object: feed `sorting` and `filters` back in, and rebuild your `columns` array from `columnOrder`, `columnWidths`, and `hidden`.

```ts
function applyView(v: GridView) {
  sorting = v.sorting
  filters = v.filters
  columns = orderColumns(allColumns, v).map((c) => ({ ...c, width: v.columnWidths[c.id ?? c.field] }))
}
```

## Persist

Start with `localStorage` for per-user, per-device views; move to the server when views should follow the user across devices or be shared with a team:

```ts
localStorage.setItem('grid.views', JSON.stringify(views))
const views = JSON.parse(localStorage.getItem('grid.views') ?? '[]')
```

## UX touches

- A view dropdown with the active view marked.
- "Save as new view" and "Update current view".
- A "Reset to default" that clears the saved layout - always give an escape hatch.
- Optionally, encode the active view in the URL so a view is shareable (see [sync grid state to the URL](sync-grid-state-to-url)).

## Frequently asked questions

### How do I save and restore a data grid's layout in Svelte?

Serialize the grid's sorting, filters, column order, widths, and hidden columns into a plain object, persist it (localStorage or your server), and apply it by feeding the state back into the grid and rebuilding the `columns` array.

### Where should saved views be stored?

Use localStorage for quick, per-device persistence. Store views on the server when they should follow a user across devices or be shared with a team, and consider encoding the active view in the URL for sharing.
