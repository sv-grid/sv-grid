---
title: A Column Show/Hide Toggle in SvGrid
description: Let users pick which columns are visible - a column chooser that adds and removes columns by filtering your column definitions.
date: 2026-07-13
category: Columns
tags: column visibility, columns, customization, recipe, svelte data grid
author: Kamelia M
---

Wide grids overwhelm; a column chooser lets each user show only the columns they care about. Because SvGrid renders whatever `columns` array you pass, show/hide is a matter of deriving that array from a visibility map. Here is the recipe.

![Column show/hide and layout controls in SvGrid](/blog-media/column-layout.png)
*Column layout and visibility controls in SvGrid.*

## Keep all columns plus a visibility map

Define the full column set once, and a record of which are visible:

```svelte
<script lang="ts">
  const allColumns: ColumnDef<{}, Row>[] = [/* every column */]
  let visible = $state<Record<string, boolean>>(
    Object.fromEntries(allColumns.map((c) => [c.id ?? c.field!, true]))
  )
  const columns = $derived(allColumns.filter((c) => visible[c.id ?? c.field!]))
</script>

<SvGrid data={rows} columns={columns} features={features} />
```

Toggling a flag in `visible` recomputes `columns`, and the grid adds or removes that column instantly - no special API needed.

## A column chooser UI

Render a checklist (in a dropdown or a header menu) bound to the map:

```svelte
{#each allColumns as c}
  <label>
    <input type="checkbox" bind:checked={visible[c.id ?? c.field!]} />
    {typeof c.header === 'string' ? c.header : (c.id ?? c.field)}
  </label>
{/each}
```

Pair it with the [custom header menu](custom-column-header-menu) for a per-column "Hide" action.

## Persist the choice

A user's column selection should survive a refresh. Save the `visible` map to `localStorage` (or into a [saved view](saved-views-persist-layout)) and restore it on load. Always offer a "Show all" reset.

## Keep at least one column

Guard against hiding everything - disable the last visible checkbox, or always keep an identity column. An empty grid from an over-eager toggle is a confusing dead end.

## Frequently asked questions

### How do I let users hide columns in SvGrid?

Keep your full column list plus a visibility map in `$state`, and derive the `columns` array by filtering on that map. Toggling a flag adds or removes the column immediately, since the grid renders whatever `columns` you pass.

### How do I remember which columns a user hid?

Persist the visibility map to localStorage or a saved view and restore it on load. Offer a "Show all" reset and prevent hiding the final column so the grid never ends up empty.
