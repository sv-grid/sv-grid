---
title: Avoiding Layout Thrash in Custom Grid Cells
description: Keep custom cells fast by not interleaving DOM reads and writes - the cause of forced reflows that make scrolling and updates janky.
date: 2026-07-05
category: Performance
tags: performance, layout thrash, reflow, custom cells, recipe
author: Kamelia M
---

Layout thrash is a sneaky performance killer: code that repeatedly reads a layout property (like `offsetWidth`) and then writes to the DOM forces the browser to recalculate layout over and over. In a grid - many cells, frequent updates - it shows up as jank. Here is how to recognize and avoid it in custom cells.

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

Most "I need to measure this cell" problems are really "I should express this in CSS." Fixed dimensions, `aspect-ratio` for images, ellipsis truncation, and flex/grid layout remove the need to read the DOM at all - which is the surest way to avoid thrash. See [cell tooltips](cell-tooltips) for the measure-once pattern.

## How to catch it

DevTools' Performance panel flags "forced reflow" in long tasks, and purple "Layout" bars stacked during scroll are the tell. See [measuring grid performance](measuring-grid-performance-devtools).

## Frequently asked questions

### What is layout thrash in a data grid?

It is repeatedly reading a layout property (like `offsetWidth`) and then writing to the DOM, which forces the browser to recompute layout each time. Across many cells and frequent updates, it causes scrolling and update jank.

### How do I avoid layout thrash in custom cells?

Batch all DOM reads before all writes, avoid measuring the DOM during cell render (use CSS for sizing instead), measure once rather than per cell for popovers, and prefer animating `transform`/`opacity` over layout properties.
