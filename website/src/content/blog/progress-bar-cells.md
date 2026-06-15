---
title: Progress and Percentage Bar Cells in SvGrid
description: Render in-cell progress bars and percentage indicators in your Svelte data grid with a custom cell, keeping the value sortable.
date: 2026-08-26
category: Cells
tags: progress bar, cells, custom cells, recipe, svelte data grid
author: Victor Vidolov
---

A number in a cell is information; a bar is insight. In-cell progress bars make completion, utilization, and scores readable at a glance. SvGrid renders any Svelte markup in a cell, so a progress bar is a small custom cell. Here is the recipe.

## A basic progress cell

Render a track and a fill whose width is the value:

```svelte
{#snippet ProgressCell(p: { value: number })}
  <div class="bar" role="progressbar" aria-valuenow={p.value} aria-valuemin={0} aria-valuemax={100}>
    <div class="fill" style="width:{Math.max(0, Math.min(100, p.value))}%"></div>
    <span class="label">{p.value}%</span>
  </div>
{/snippet}

// column: { field: 'progress', header: 'Progress', cell: (c) => renderSnippet(ProgressCell, { value: c.getValue() }) }
```

```css
.bar { position: relative; height: 18px; border-radius: 9px; background: color-mix(in srgb, var(--sg-fg) 10%, transparent); }
.fill { height: 100%; border-radius: 9px; background: var(--sg-accent); }
.label { position: absolute; inset: 0; display: grid; place-items: center; font-size: 12px; }
```

Clamp the width to 0-100 so bad data cannot overflow the cell.

## Color by threshold

Make the bar tell a story: green when on target, amber when at risk, red when low. Map the value to a band and drive the fill color from a token so it adapts to your theme - see [conditional formatting](conditional-formatting).

## Keep the value sortable

The golden rule for custom cells: render the bar, but let the column read its value from the `field`. Sorting "Progress" then sorts by the real number, not by markup, and filtering still works. Never compute the display inside an accessor.

## Accessibility

Add `role="progressbar"` with `aria-valuenow/min/max` (as above) and include the numeric label as text, so the value is available to screen readers, not just conveyed by bar length and color.

## Frequently asked questions

### How do I show a progress bar in a data grid cell?

Render a custom cell with a track and a fill element whose width is the value (clamped 0-100), via `renderSnippet`. Keep the column's `field` so the value stays sortable and filterable.

### How do I make a progress cell accessible?

Add `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`, and include a text label of the value, so the information is not conveyed by bar length and color alone.
