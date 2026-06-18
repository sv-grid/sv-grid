---
title: Conditional Formatting - Color Cells by Their Value
description: Highlight negatives, flag thresholds, and build heatmaps in a Svelte data grid with value-driven cell styles in SvGrid.
date: 2026-01-13
category: Cells
tags: conditional formatting, cell styles, heatmap, svelte data grid
author: Boyko Markov
---

A wall of numbers hides its own story; color tells it for you, red for a loss, green for a target hit, a heatmap for where the heat actually is. SvGrid lets you style cells by their value, so the grid does the first pass of reading and the user's eye goes straight to what matters.

![Conditional cell formatting in SvGrid](/blog-media/conditional-formatting.png)
*Value-driven conditional formatting: color scales, data bars, and icons.*

## Style a cell by its value

Render the cell with a snippet and choose styling from the value:

```svelte
{#snippet DeltaCell(props: { value: number })}
  <span style:color={props.value < 0 ? '#e5484d' : '#30a46c'}>
    {props.value > 0 ? '+' : ''}{props.value}%
  </span>
{/snippet}

// column:
{ field: 'change', header: 'Change', cell: (ctx) => renderSnippet(DeltaCell, { value: ctx.getValue() }) }
```

Negative changes go red, positive ones green, the user reads the column at a glance.

## Threshold flags

For limits and targets, switch on a band rather than a single sign:

```ts
function band(v: number) {
  if (v >= 90) return 'good'
  if (v >= 60) return 'warn'
  return 'bad'
}
```

Apply the band as a `data-` attribute or class and let CSS own the colors, so your palette stays in one place.

## Heatmaps

For a dense numeric grid, map the value to a background opacity to build a heatmap. Scale the value into a 0-1 range and drive `background` alpha, and patterns jump out of a wall of numbers without any chart.

## Keep the raw value sortable

The golden rule, again: format and color in the snippet, but let the column read its value from a `field`. Sorting the "change" column then sorts by the real number, not the colored markup, so conditional formatting never breaks the data pipeline.

## Row-level formatting

Sometimes the whole row matters, an overdue invoice, a failed job. Drive a row style from your own state or a derived flag, so the entire row tints when a record needs attention, drawing the eye before the user even scans the cells.
