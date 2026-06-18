---
title: An Editable Select / Dropdown Cell in SvGrid
description: Let users pick a value from a dropdown inside a grid cell - a custom editor cell that commits the choice back to your data.
date: 2026-07-26
category: Editing
tags: editing, dropdown, select, cell editor, recipe
author: Kamelia M
---

Some columns should be chosen, not typed, status, category, assignee live in a fixed set, and free text just invites typos. A dropdown cell makes editing fast and constrained. SvGrid's built-in editors cover text, number, checkbox, and dates; for a select you drop in a small custom editor cell. Here is the pattern.

![Editable dropdown cells in SvGrid](/blog-media/custom-cell-editors.png)
*Custom cell editors, including dropdowns, in SvGrid.*

## A select cell

Render a `<select>` in a custom cell and commit the choice to your data on change:

```svelte
<script lang="ts">
  const STATUSES = ['Active', 'Pending', 'Closed']
</script>

{#snippet StatusCell(p: { row: Row })}
  <select
    value={p.row.status}
    onchange={(e) => commit(p.row, (e.currentTarget as HTMLSelectElement).value)}
  >
    {#each STATUSES as s}<option value={s}>{s}</option>{/each}
  </select>
{/snippet}

// column: { field: 'status', header: 'Status', cell: (c) => renderSnippet(StatusCell, { row: c.row.original }) }
```

```ts
function commit(row: Row, status: string) {
  const i = rows.indexOf(row)
  rows[i] = { ...row, status }
  // persist if needed
}
```

## Display vs edit

If you only want the dropdown while editing (and a clean badge otherwise), show a [status badge](status-badge-cells) by default and swap to the `<select>` when the cell enters edit mode, keying off your own "editing this cell" state. For always-editable columns, the inline `<select>` above is simpler.

## Async options

When options come from the server (assignees, tags), load them once and cache them, do not fetch per cell. Render a loading state in the dropdown until they arrive.

## Keep it accessible and consistent

A native `<select>` is accessible by default, keyboard operable and announced by screen readers. If you use a custom combobox component instead, ensure it implements the listbox/combobox ARIA pattern. Sorting and filtering still work on the underlying value, since the cell only changes how it is edited.
