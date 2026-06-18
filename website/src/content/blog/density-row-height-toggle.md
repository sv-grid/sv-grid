---
title: A Density (Row-Height) Toggle for SvGrid
description: Give users compact, comfortable, and spacious row-density options - driven by CSS tokens and a persisted preference.
date: 2026-07-23
category: Rows
tags: density, row height, theming, rows, recipe
author: Kamelia M
---

An analyst scanning ten thousand rows wants them packed tight; an occasional user wants room to breathe. A density toggle is a tiny feature that makes both happy. Because SvGrid is styled with `--sg-*` tokens, you can drive the whole thing with CSS. Here is the recipe.

![SvGrid themed to match a design system.](/blog-media/theme-integrations.png)
*SvGrid themed to match a design system.*

## Density via CSS tokens

Define density levels as CSS that adjusts row height, cell padding, and font size, scoped by a class on the grid wrapper:

```css
.grid-compact     { --sg-row-height: 32px; --sg-cell-pad-y: 4px;  font-size: 13px; }
.grid-comfortable { --sg-row-height: 44px; --sg-cell-pad-y: 8px;  font-size: 14px; }
.grid-spacious    { --sg-row-height: 56px; --sg-cell-pad-y: 12px; font-size: 15px; }
```

Switch the class and the grid reflows. Keeping density in CSS means no re-render and no special grid API, just a class swap.

## The toggle

A three-way control bound to a density state, applied as the wrapper class:

```svelte
<script lang="ts">
  let density = $state<'compact' | 'comfortable' | 'spacious'>('comfortable')
</script>

<div class="density-switch">
  {#each ['compact', 'comfortable', 'spacious'] as d}
    <button class:active={density === d} onclick={() => (density = d)}>{d}</button>
  {/each}
</div>

<div class="grid-{density} min-h-0 flex-1">
  <SvGrid data={rows} columns={columns} features={features} />
</div>
```

## Mind virtualization

If you set an explicit row height via a grid prop, keep it in sync with the CSS so virtualization measures rows correctly, mismatched heights cause overlap or gaps. The simplest reliable approach is to let one source (the density class) drive both the visual height and any height value you pass to the grid.

## Persist the choice

Density is a personal preference, so save it to `localStorage` and restore it on load, or fold it into a [saved view](saved-views-persist-layout). Returning users keep the density they chose.

## Frequently asked questions

### How do I add a compact/comfortable row-density toggle to SvGrid?

Define density levels as CSS that adjust row height, padding, and font size via `--sg-*` tokens, scope them with a wrapper class, and switch the class from a toggle. It needs no re-render, just a class swap.

### How do I keep density consistent with virtualization?

Let one source drive both the visual row height (CSS) and any explicit height value you pass the grid, so the virtualizer measures rows correctly. Mismatched heights cause overlapping or gapped rows.
