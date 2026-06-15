---
title: An Actions Column (Edit, Delete) in SvGrid
description: Add a column of per-row action buttons - edit, delete, duplicate - in your Svelte data grid, accessibly and without breaking the data pipeline.
date: 2026-06-30
category: Cells
tags: actions, buttons, cells, custom cells, recipe
author: Boyko Markov
---

Almost every admin grid needs per-row actions: edit, delete, duplicate, view. An actions column puts those buttons right where the user is looking. SvGrid renders any markup in a cell, so an actions column is a custom cell with real buttons. Here is the recipe.

## A pure-UI column

Actions columns have no underlying field - they are pure UI. Give the column an `id` (no `field`/`accessorFn`) and render buttons:

```svelte
{#snippet Actions(p: { row: Row })}
  <span class="row-actions">
    <button type="button" aria-label="Edit" onclick={() => edit(p.row)}>✎</button>
    <button type="button" aria-label="Delete" onclick={() => remove(p.row)}>🗑</button>
  </span>
{/snippet}

// column: { id: 'actions', header: '', width: 96,
//           cell: (c) => renderSnippet(Actions, { row: c.row.original }) }
```

Set a fixed `width` so the column does not stretch, and consider [pinning it right](pinned-frozen-columns) so actions stay visible on wide grids.

## Confirm destructive actions

Delete should never be a one-click mistake. Confirm it, and prefer a soft delete with undo over an irreversible wipe:

```ts
async function remove(row: Row) {
  if (!confirm(`Delete ${row.name}?`)) return
  const i = rows.indexOf(row)
  const [removed] = rows.splice(i, 1)
  rows = [...rows]
  try { await api.delete(row.id) }
  catch { rows.splice(i, 0, removed); rows = [...rows] } // restore on failure
}
```

## Accessibility is the whole point here

This is where hand-rolled grids fail. Use real `<button>` elements (not clickable `<div>`s), give icon-only buttons an `aria-label`, and make sure they are reachable by keyboard. Because the grid manages focus, a real button in a cell is tabbable and operable out of the box. See [keyboard navigation and accessibility](keyboard-navigation-and-accessibility).

## Pair with selection for bulk actions

Per-row actions handle one record; pair them with [row selection](bulk-operations-on-selected-rows) so users can also act on many rows at once. Some teams also expose the same actions via a [right-click menu](right-click-context-menu).

## Frequently asked questions

### How do I add edit and delete buttons to each row in SvGrid?

Create a column with an `id` and no field, and render real `<button>` elements in a custom cell via `renderSnippet`. Give icon-only buttons an `aria-label`, set a fixed width, and consider pinning the column to the right.

### How should I handle the delete action safely?

Confirm before deleting and prefer a soft delete with undo. Apply the removal optimistically to your data and restore the row if the server request fails, so a misclick or error is recoverable.
