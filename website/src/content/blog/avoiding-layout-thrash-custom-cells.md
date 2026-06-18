---
title: Avoiding Layout Thrash in Custom Grid Cells
description: Keep custom cells fast by not interleaving DOM reads and writes - the cause of forced reflows that make scrolling and updates janky.
date: 2026-07-05
category: Performance
tags: performance, layout thrash, reflow, custom cells, recipe
author: Kamelia M
---

Layout thrash is the performance bug you cannot catch in a code review: read a layout property like `offsetWidth`, write to the DOM, read again, and the browser is forced to recompute layout every single time. Multiply that across a grid full of cells updating often and you get mystery jank. Here is how to spot it and design custom cells that avoid it.

![A showcase of SvGrid cell types.](/blog-media/cell-types.png)
*A showcase of SvGrid cell types.*

## What causes it

The browser batches DOM writes and computes layout lazily. But reading a layout property (`offsetWidth`, `getBoundingClientRect`, `scrollHeight`, `clientTop`, etc.) forces it to compute layout *now*. Do that in a loop interleaved with writes, and you trigger a full reflow each iteration:

```ts
// BAD: read, write, read, write... forced reflow every iteration
for (const el of cells) {
  el.style.width = el.offsetWidth + 10 + 'px' // read then write, repeatedly
}
```

## The fix: batch reads, then writes

Read everything first, then write everything:

```ts
// GOOD: one read pass, one write pass
const widths = cells.map((el) => el.offsetWidth)   // all reads
cells.forEach((el, i) => (el.style.width = widths[i] + 10 + 'px')) // all writes
```

## In custom cells specifically

- **Do not measure the DOM in a cell snippet during render.** If a cell needs to know its size, use CSS (`width: 100%`, `aspect-ratio`, container queries) instead of reading `offsetWidth`.
- **Avoid `getBoundingClientRect` per cell.** A tooltip or popover should measure once, on demand, not for every visible cell.
- **Prefer transforms over layout properties.** Animating `transform`/`opacity` does not trigger layout; animating `width`/`top` does.

## Let CSS do the work

Most "I need to measure this cell" problems are really "I should express this in CSS." Fixed dimensions, `aspect-ratio` for images, ellipsis truncation, and flex/grid layout remove the need to read the DOM at all, which is the surest way to avoid thrash. See [cell tooltips](cell-tooltips) for the measure-once pattern.

## How to catch it

DevTools' Performance panel flags "forced reflow" in long tasks, and purple "Layout" bars stacked during scroll are the tell. See [measuring grid performance](measuring-grid-performance-devtools).
