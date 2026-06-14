---
title: A Right-Click Context Menu for Your Svelte Data Grid
description: Add a contextual right-click menu to grid rows and cells - capturing the target row, positioning the menu, and wiring row actions.
date: 2026-08-03
category: Cells
tags: context menu, right-click, actions, recipe, svelte data grid
author: SvGrid Team
---

A right-click context menu - "Edit", "Duplicate", "Delete", "Copy" - is a power-user staple. SvGrid does not lock down the contextmenu event, so you can add one with a custom cell or a wrapper and your own menu component. Here is a clean approach.

## Capture the target and position

Render cells (or a wrapper) that capture `contextmenu`, store the target row and pointer position, and prevent the native menu:

```svelte
{#snippet Cell(p: { row: Row; value: unknown })}
  <span oncontextmenu={(e) => openMenu(e, p.row)}>{p.value}</span>
{/snippet}

<script lang="ts">
  let menu = $state<{ row: Row; x: number; y: number } | null>(null)
  function openMenu(e: MouseEvent, row: Row) {
    e.preventDefault()
    menu = { row, x: e.clientX, y: e.clientY }
  }
</script>
```

## Render the menu

Position a small menu at the pointer and close it on outside click or Escape:

```svelte
{#if menu}
  <ul class="ctx" style="left:{menu.x}px; top:{menu.y}px" role="menu">
    <li role="menuitem"><button onclick={() => { edit(menu.row); menu = null }}>Edit</button></li>
    <li role="menuitem"><button onclick={() => { remove(menu.row); menu = null }}>Delete</button></li>
  </ul>
{/if}

<svelte:window onclick={() => (menu = null)} onkeydown={(e) => e.key === 'Escape' && (menu = null)} />
```

## Make it keyboard-friendly

Right-click is mouse-only, so also expose the same actions another way - an actions column (see [actions column](actions-column-edit-delete)) or the Shift+F10 / Menu key, which fires `contextmenu` from the keyboard. Use `role="menu"`/`role="menuitem"` and arrow-key navigation so the menu itself is accessible.

## Selection-aware actions

If the user right-clicks a row that is part of a multi-row selection, act on the whole selection, not just that row. Check whether the target is selected and branch accordingly - the behavior users expect from file managers.

## Frequently asked questions

### How do I add a right-click context menu to a Svelte grid?

Capture the `contextmenu` event on cells (via a snippet), call `preventDefault`, store the target row and pointer coordinates, and render your own positioned menu. Close it on outside click or Escape.

### How do I keep a context menu accessible?

Right-click is mouse-only, so also expose the actions via an actions column or the keyboard Menu key, and mark the menu with `role="menu"`/`role="menuitem"` with arrow-key navigation and Escape to close.
