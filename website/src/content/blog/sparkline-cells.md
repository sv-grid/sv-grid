---
title: Sparkline Cells in a Svelte Data Grid
description: Render inline trend sparklines inside grid cells with a tiny SVG snippet - perfect for showing a metric's recent history at a glance.
date: 2026-08-06
category: Cells
tags: sparkline, charts, cells, custom cells, recipe
author: SvGrid Team
---

A sparkline - a tiny, word-sized line chart - turns a column of numbers into a column of trends. In a dashboard grid it is the fastest way to show "where is this metric heading?" SvGrid renders any markup in a cell, so a sparkline is a small inline SVG. Here is the recipe.

## A minimal SVG sparkline

Map an array of values to an SVG polyline. No charting library needed:

```svelte
<script lang="ts">
  function points(values: number[], w = 100, h = 24): string {
    const min = Math.min(...values), max = Math.max(...values)
    const span = max - min || 1
    return values
      .map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / span) * h}`)
      .join(' ')
  }
</script>

{#snippet Spark(p: { values: number[] })}
  <svg viewBox="0 0 100 24" width="100" height="24" preserveAspectRatio="none" aria-hidden="true">
    <polyline points={points(p.values)} fill="none" stroke="var(--sg-accent)" stroke-width="2" />
  </svg>
{/snippet}

// column: { id: 'trend', header: 'Trend', cell: (c) => renderSnippet(Spark, { values: c.row.original.history }) }
```

## Add a last-point dot and color

A small touches make it readable: a dot on the latest value, and a color that reflects direction (green up, red down):

```ts
const up = history.at(-1)! >= history[0]
```

Use `up ? '#34d399' : '#f87171'` for the stroke, driven from tokens so it adapts to dark mode - see [conditional formatting](conditional-formatting).

## Keep the cell sortable

Sparklines are a visualization, not the sortable value. Keep a numeric `field` for the column's sort key (for example the latest value or the percent change) so users can still sort the column by something meaningful, while the cell renders the trend.

## Performance

Sparklines are cheap - a polyline is a few points - and with virtualization only the visible cells render. Precompute each row's `history` array in your data rather than recomputing per render, and keep the point count modest (10-30 points reads fine at this size).

## Accessibility

A sparkline is decorative detail, so mark the SVG `aria-hidden` and expose the meaningful number as text (the latest value or trend percent) in the same or an adjacent cell, so screen-reader users get the information.

## Frequently asked questions

### How do I add sparklines to a data grid without a chart library?

Render a small inline SVG `<polyline>` in a custom cell, mapping the row's value array to points. It needs no dependency, and virtualization keeps it cheap because only visible cells render.

### How do I keep a sparkline column sortable?

Give the column a numeric `field` (such as the latest value or percent change) as its sort key, and render the sparkline in the cell. The visualization is separate from the value the grid sorts on.
