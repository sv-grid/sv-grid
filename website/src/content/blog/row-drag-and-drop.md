---
title: Row Drag-and-Drop Reordering in a Svelte Data Grid
description: Let users drag rows into a new order in SvGrid - a drag-handle cell, reordering your reactive data, and persisting the new sequence.
date: 2026-08-04
category: Rows
tags: row reorder, drag and drop, rows, recipe, svelte data grid
author: SvGrid Team
---

Manual ordering - dragging a row up or down - is common in playlists, priorities, and kanban-style lists. Because SvGrid renders from a reactive `data` array, row reordering is mostly about updating that array; the grid follows. Here is a clean recipe.

## A drag handle in a cell

Render a handle in its own column with a custom cell so the rest of the row stays clickable:

```svelte
{#snippet Handle(p: { row: Row })}
  <span class="drag-handle" draggable="true"
    ondragstart={(e) => start(p.row)}
    ondragover={(e) => e.preventDefault()}
    ondrop={() => drop(p.row)}>⋮⋮</span>
{/snippet}

// column: { id: 'drag', header: '', width: 44, cell: (c) => renderSnippet(Handle, { row: c.row.original }) }
```

## Reorder the data

Track the dragged row, and on drop, move it in your `$state` array. The grid re-renders in the new order automatically:

```ts
let dragged: Row | null = null
const start = (r: Row) => (dragged = r)
function drop(target: Row) {
  if (!dragged || dragged === target) return
  const from = rows.indexOf(dragged), to = rows.indexOf(target)
  rows.splice(to, 0, ...rows.splice(from, 1))
  rows = [...rows] // new reference so the grid updates
  dragged = null
}
```

Keep a stable identity per row (an `id`) so selection and edit state survive the reorder.

## Persisting order

Most apps store an explicit `position` field. After a drop, write the new positions back - optimistically update locally, then PATCH the server:

```ts
rows.forEach((r, i) => (r.position = i))
await api.reorder(rows.map((r) => ({ id: r.id, position: r.position })))
```

## Notes

- Reordering and sorting are mutually exclusive in practice: manual order only makes sense when the grid is not also sorting by a column. Disable or clear sorting while reordering.
- For touch devices, pair the native drag events with pointer events or use a small DnD helper.
- See the row-reorder example in the [demos](/demos).

## Frequently asked questions

### How do I let users reorder rows by dragging in SvGrid?

Render a draggable handle in a cell, track the dragged row, and on drop move it within your reactive `data` array (splice + reassign). The grid re-renders in the new order because `data` is reactive.

### How do I persist a manual row order?

Store an explicit `position` field per row, recompute positions after each drop, and persist them (optimistically locally, then to the server). Manual order should replace column sorting, not run alongside it.
