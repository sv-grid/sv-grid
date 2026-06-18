---
title: Status Badge Cells in SvGrid
description: Render colored status badges in grid cells - mapping values to accessible, themeable pills that stay sortable and filterable.
date: 2026-09-09
category: Cells
tags: badges, status, cells, custom cells, recipe
author: Victor Vidolov
---

"Active", "Pending", "Closed" as plain text is a column you have to read; as colored pills it is a column you scan. SvGrid renders any markup in a cell, so a badge is a small custom cell. Here is how to do it well, themeable, and accessible rather than color-only.

![A showcase of SvGrid cell types.](/blog-media/cell-types.png)
*A showcase of SvGrid cell types.*

## A badge cell

Map the value to a color and render a pill:

```svelte
<script lang="ts">
  const COLORS: Record<string, string> = {
    Active: '#34d399', Pending: '#fbbf24', Closed: '#94a3b8',
  }
</script>

{#snippet Badge(p: { value: string })}
  <span class="badge" style="--c:{COLORS[p.value] ?? '#94a3b8'}">
    <span class="dot"></span>{p.value}
  </span>
{/snippet}

// column: { field: 'status', header: 'Status', cell: (c) => renderSnippet(Badge, { value: c.getValue() }) }
```

```css
.badge { display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px;
  border-radius: 999px; font-size: 13px; color: var(--c);
  background: color-mix(in srgb, var(--c) 16%, transparent); }
.dot { width: 6px; height: 6px; border-radius: 50%; background: var(--c); }
```

`color-mix` gives a soft tinted background from one color and adapts to dark mode.

## Keep it sortable and filterable

Because the column keeps its `field`, sorting the status column sorts by the real value and the Excel-style filter still lists the actual statuses. The badge only changes presentation, never compute the label inside an accessor, or you lose this.

## Do not rely on color alone

Color plus the text label (as above) is the accessible pattern, colorblind users read the word, not just the hue. The dot is decorative; the text carries the meaning. See [accessible data tables](accessible-data-table-wcag).

## Make it data-driven

Keep the value-to-color map in one place so badges stay consistent across the app, and so adding a new status is a one-line change. For a fixed set, this map is enough; for user-defined statuses, store the color alongside the status in your data.

## Frequently asked questions

### How do I show colored status badges in a Svelte data grid?

Render a pill in a custom cell via `renderSnippet`, mapping the value to a color. Keep the column's `field` so the status stays sortable and filterable, and include the text label so it is accessible.
