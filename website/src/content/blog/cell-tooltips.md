---
title: Cell Tooltips Done Right in a Data Grid
description: Add helpful, accessible tooltips to grid cells - for truncated text, status explanations, and extra detail - without hurting performance.
date: 2026-07-07
category: Cells
tags: tooltips, cells, accessibility, recipe, svelte data grid
author: SvGrid Team
---

Tooltips earn their keep in a dense grid: revealing truncated text in full, explaining a status, or showing extra detail on hover. Done badly they hurt accessibility and performance. Here is how to add them well in SvGrid.

## The simplest tooltip: native title

For truncated text, the native `title` attribute is free and accessible enough for many cases:

```svelte
{#snippet TextCell(p: { value: string })}
  <span class="truncate" title={p.value}>{p.value}</span>
{/snippet}
```

Pair it with CSS truncation (`text-overflow: ellipsis`) and the full value appears on hover with zero JavaScript.

## Rich tooltips

When you need formatting, multiple fields, or a styled bubble, render a custom tooltip on hover/focus. Keep one shared tooltip element rather than one per cell - with virtualization there are only a few dozen cells in the DOM, but a shared tooltip is still cleaner and faster:

```svelte
{#snippet Cell(p: { row: Row; value: unknown })}
  <span onmouseenter={(e) => show(e, p.row)} onmouseleave={hide} onfocus={(e) => show(e, p.row)} onblur={hide} tabindex="0">
    {p.value}
  </span>
{/snippet}
```

Show the tooltip from shared `$state` positioned near the target.

## Accessibility

A tooltip that only appears on mouse hover excludes keyboard and screen-reader users. So:

- Trigger on **focus** as well as hover.
- Associate it with `aria-describedby` pointing at the tooltip's id, so screen readers announce it.
- Make sure it is dismissible (Escape) and does not trap focus.

A `title` attribute handles much of this automatically, which is why it is the right default when plain text is enough.

## Performance

Do not attach heavy logic to per-cell hover. Compute tooltip content lazily when shown, reuse one tooltip node, and avoid layout thrash (read positions once, then write). With virtualization keeping the cell count small, a well-built tooltip has no measurable cost.

## Frequently asked questions

### How do I add tooltips to data grid cells?

For plain text, use the native `title` attribute on a custom cell with CSS truncation. For rich content, render a single shared tooltip element from hover/focus handlers, positioned near the target cell.

### How do I make grid tooltips accessible?

Trigger them on focus as well as hover, link them with `aria-describedby` so screen readers announce them, and allow dismissal with Escape. The native `title` attribute covers these basics for simple text tooltips.
