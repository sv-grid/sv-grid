---
title: A Custom Column Header Menu in SvGrid
description: Add a per-column header menu for sort, hide, pin, and custom actions using a header snippet and your own dropdown.
date: 2026-07-19
category: Columns
tags: header menu, columns, customization, recipe, svelte data grid
author: Boyko Markov
---

A column header menu gives users a tidy place to sort, hide, pin, or run column-specific actions. SvGrid lets a column render a custom `header`, so you can drop your own menu button into any header. Here is the pattern.

## A header snippet with a menu button

A column's `header` accepts a snippet, so render the label plus a menu trigger:

```svelte
{#snippet HeaderWithMenu(p: { label: string; columnId: string })}
  <span class="hdr">
    {p.label}
    <button class="hdr-menu" onclick={(e) => openMenu(p.columnId, e)}>⋯</button>
  </span>
{/snippet}

// column: { field: 'name', header: (ctx) => renderSnippet(HeaderWithMenu, { label: 'Name', columnId: 'name' }) }
```

## Drive real actions

Wire the menu items to grid state and your own column model:

- **Sort asc/desc** - set the grid's `sorting` state for that column.
- **Hide column** - flip a visibility flag and rebuild the `columns` array (see [column visibility toggle](column-visibility-toggle)).
- **Pin left/right** - set `pinned` on the column (see [pinned columns](pinned-frozen-columns)).
- **Custom** - "Filter by this", "Copy column", "Group by this".

```ts
function openMenu(columnId: string, e: MouseEvent) {
  menu = { columnId, x: e.clientX, y: e.clientY }
}
```

Render your dropdown (a positioned `<div>`, or a component from your UI kit) from the `menu` state.

## Keep it accessible

Use a real `<button>` for the trigger, give it an `aria-label` ("Column options"), and make the menu keyboard-navigable (Arrow keys, Escape to close, focus return to the button). An inaccessible header menu undoes the grid's built-in accessibility - see [accessibility](keyboard-navigation-and-accessibility).

## Frequently asked questions

### How do I add a menu to a column header in SvGrid?

Render the column's `header` as a snippet that includes a menu button, and open your own dropdown on click. Wire its items to grid state - sorting, a visibility flag, the column's `pinned` option, or custom actions.

### How do I keep a header menu accessible?

Use a real `<button>` trigger with an `aria-label`, make the menu operable by keyboard (arrow keys and Escape), and return focus to the trigger on close, so it does not break the grid's keyboard navigation.
