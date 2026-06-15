---
title: Render 100,000 Rows Smoothly with Grid Virtualization
description: How SvGrid virtualizes rows and columns so a Svelte data grid stays at 60fps even with 100k rows by 100 columns.
date: 2026-05-05
category: Performance
tags: virtualization, performance, large data, svelte data grid
author: Victor Vidolov
---

A naive table renders one DOM row per data row. At a few thousand rows the browser slows; at a hundred thousand it locks up. SvGrid solves this with built-in row and column virtualization - only the cells in the viewport exist in the DOM.

![SvGrid virtualizing a large dataset](/blog-media/large-dataset.png)
*A large dataset in SvGrid - only the visible rows exist in the DOM.*

## It is on when it needs to be

Virtualization in SvGrid does not require special wiring. Give the grid a bounded height and a large `data` array, and it renders only the visible window plus a small overscan buffer.

```svelte
<div style="height: 600px;">
  <SvGrid data={hundredThousandRows} columns={columns} />
</div>
```

The key detail is the **bounded height**. The grid needs to know its viewport to compute which rows are visible, so place it in a container with an explicit height or a flex layout that gives it one.

## Why it stays fast

- **Row virtualization** keeps the DOM node count proportional to the viewport, not the dataset. Scrolling recycles rows instead of creating them.
- **Column virtualization** does the same horizontally, so a 100-column grid only paints the columns you can see.
- **Stable references** mean Svelte 5's fine-grained reactivity skips work for rows that did not change.

## Keep your data layer fast too

Virtualization handles rendering, but your data still flows through the engine. A few habits keep the whole pipeline quick:

- Keep `data` an array whose reference changes only when rows actually change.
- Preserve object identity for rows that did not change between updates, so selection and edit state line up.
- Sort and filter through the grid's features (or on the server) rather than rebuilding the array yourself on every keystroke.

## Sizing in a flex layout

A common gotcha is a grid with no height. Inside a flex column, give the grid `flex: 1` and `min-height: 0`:

```svelte
<div style="display:flex; flex-direction:column; height:100vh;">
  <header>Toolbar</header>
  <div style="flex:1; min-height:0;">
    <SvGrid data={rows} columns={columns} />
  </div>
</div>
```

Without `min-height: 0`, flex children refuse to shrink and the grid grows past the viewport, defeating virtualization.

## How virtualization actually works

It helps to picture what the grid is doing on every scroll frame. Given the scroll position, the row height, and the viewport height, the grid computes the first and last visible row indices, adds a small overscan buffer above and below, and renders only that slice. As you scroll, the same pool of DOM rows is repositioned and refilled with new data rather than created and destroyed.

The consequences are worth internalizing:

- **DOM size is constant.** Ten rows or ten million, the node count tracks the viewport, not the dataset.
- **Scroll cost is bounded.** Each frame repositions a fixed number of rows.
- **Memory stays flat.** You are not holding a hundred thousand `<tr>` elements in memory.

## Fixed vs variable row heights

Uniform row heights are the fast path: the grid can calculate any row's position with a single multiplication, so jumping to row 90,000 is instant. If your rows vary in height - wrapped text, expandable detail - the grid has to measure and track offsets, which is still fast but does more work. When you can, keep rows a consistent height and push variable content into a master-detail panel that only exists when expanded.

## The overscan trade-off

Overscan is the buffer of off-screen rows the grid keeps rendered just beyond the viewport. A larger buffer means fewer blank flashes during very fast scrolling, at the cost of more DOM nodes. The defaults are tuned for the common case; you rarely need to touch them, but it is useful to know the dial exists if you are chasing the last few milliseconds on a low-end device.

## Measuring it yourself

Do not take "it is fast" on faith - measure on the hardware your users actually have. A quick protocol:

1. Open your browser's performance panel and record while scrolling the full height of the grid.
2. Watch for long frames (over ~16ms) and layout thrash.
3. Check the DOM node count in the Elements panel - it should stay roughly constant as you scroll.

If the node count climbs as you scroll, virtualization is not engaging - and the cause is almost always a missing height on the container.

## Common pitfalls

- **No bounded height.** The number-one cause of "virtualization is not working." Give the grid a height or a flex parent with `min-height: 0`.
- **Rebuilding `data` every tick.** A brand-new array of brand-new objects on every update forces the engine to reconsider everything. Mutate in place or replace only what changed.
- **Heavy per-cell work.** A custom cell that does expensive work runs for every visible cell on every relevant update. Keep cell snippets light; memoize anything costly upstream.
- **Huge fixed columns with no column virtualization benefit.** Very wide columns reduce how many fit on screen, but the win still comes from not rendering the off-screen ones.

## Pairing with server-side data

Virtualization bounds the DOM; it does not bound the network. If your source is millions of rows, do not ship them all to the browser just because the grid can render them. Combine virtualization with [server-side paging](server-side-data): the server bounds the data transferred, and virtualization bounds the DOM for whatever is loaded.

## Frequently asked questions

### Can a Svelte data grid handle 100,000 rows?

Yes. SvGrid virtualizes rows and columns, so a 100k by 100 grid keeps a small, constant DOM and scrolls smoothly. Give the grid a bounded height so it can compute the visible window.

### Why is my virtualized grid not scrolling?

Almost always a height problem. The grid needs an explicit height or a flex parent with `min-height: 0`. Without it the grid cannot determine its viewport.
