---
title: Virtual Scrolling Explained
description: How virtual scrolling (windowing) keeps a data grid fast with tens of thousands of rows, why it works, and the pitfalls to avoid.
date: 2026-06-17
category: Concepts
tags: virtualization, performance, concepts, data grid
author: SvGrid Team
---

Virtual scrolling, also called windowing, is the technique that lets a table show a hundred thousand rows while keeping only a few dozen in the DOM. It is the single most important performance idea in data grids. Here is how it works and where it goes wrong.

## The problem it solves

A naive table renders one DOM node per row. Browsers handle a few thousand nodes fine; at tens of thousands they slow down, and at hundreds of thousands they freeze. The cost is not your data - arrays of objects are cheap - it is the DOM.

## The core idea

Only render what is visible. Given the scroll position, row height, and viewport height, the grid computes which rows are on screen, renders just those plus a small buffer, and positions them correctly. As you scroll, it recycles the same nodes with new data instead of creating and destroying them.

The consequences:

- **DOM size is constant** - proportional to the viewport, not the dataset.
- **Scroll cost is bounded** - each frame repositions a fixed number of rows.
- **Memory stays flat** - you are not holding 100,000 `<tr>` elements.

So a 100,000-row grid does roughly the same per-frame work as a 100-row grid.

## Fixed vs variable row heights

Uniform row heights are the fast path: any row's position is one multiplication, so jumping to row 90,000 is instant. Variable heights (wrapped text, expandable detail) require measuring and tracking offsets - still fast, but more work. When you can, keep rows a consistent height and push variable content into an expandable detail panel.

## Common pitfalls

- **No bounded height.** The grid needs a viewport to compute the visible window. Without an explicit height (or a flex parent with `min-height: 0`), virtualization cannot engage - the number-one cause of "it is slow."
- **Rebuilding data every tick.** A brand-new array of new objects on each update makes the engine reconsider everything. Mutate in place or replace only what changed.
- **Heavy per-cell work.** A custom cell that does expensive work runs for every visible cell on every update. Keep cell rendering light.
- **Losing focus on recycle.** When a focused row scrolls out and its node is reused, focus must be managed carefully - one reason to use a grid that handles this rather than rolling your own.

## How to verify it

Record your browser's performance panel while scrolling the full height. Watch for long frames and check the DOM node count in the Elements panel - it should stay roughly constant. If it climbs as you scroll, virtualization is not engaging, almost always due to a missing height.

In SvGrid, virtualization is automatic once the grid has a bounded height; see [Render 100,000 Rows Smoothly](virtualize-100k-rows) for the practical setup.

## Frequently asked questions

### What is virtual scrolling in a data grid?

It is rendering only the rows visible in the viewport (plus a small buffer) and recycling those DOM nodes as you scroll, so the DOM stays small regardless of dataset size. This keeps large grids fast.

### Why is my virtualized grid not working?

The most common cause is a missing height. Virtualization needs a bounded viewport to compute which rows are visible, so the grid must have an explicit height or a flex parent with `min-height: 0`.
