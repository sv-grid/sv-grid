---
title: Why We Bet on Svelte 5 Runes for a High-Performance Data Grid
description: A look at Svelte 5's runes - $state, $derived, $effect - and why fine-grained reactivity is the right foundation for rendering tens of thousands of cells.
date: 2026-05-30
category: Engineering
tags: svelte 5, runes, reactivity, performance, architecture
author: SvGrid Team
---

A data grid is a reactivity problem wearing a table's clothes. You have tens of thousands of cells, any of which can change at any moment, and the entire job is to repaint exactly what moved and nothing else. When Svelte 5 shipped runes, we saw a reactivity model finally fine-grained enough to make that easy. Here is the reasoning behind building SvGrid on it.

## What runes changed

Svelte 5 replaced the compiler-magic reactivity of Svelte 3 and 4 with explicit, signal-based primitives:

- **`$state`** declares reactive state.
- **`$derived`** computes values that update only when their inputs change.
- **`$effect`** runs side effects when dependencies change.

The important word is *fine-grained*. A `$derived` value recomputes only when the specific state it reads changes - not when some unrelated part of the component updates. For most apps this is a nice ergonomic win. For a grid, it is the whole ballgame.

## Why fine-grained reactivity matters for grids

Consider a live price grid: a thousand rows, ten columns, updates streaming in. A change to one cell's price should repaint one cell. With coarse reactivity you fight the framework to avoid re-rendering the whole table; with signals, the framework does the right thing by default.

```ts
// A derived only recomputes when *its* inputs change
let query = $state('')
let visible = $derived(rows.filter((r) => r.name.includes(query)))
```

Typing in the filter recomputes `visible`. Editing a cell that the filter does not read does not. You get surgical updates without a virtual DOM diff over the entire grid.

## No store ceremony

Earlier Svelte adapters for headless grid engines leaned on stores and `.subscribe` wrappers, because the engine's reactivity model was not Svelte's. Building natively on runes removes that translation layer entirely. State is just state; derived values are just derived. The code reads like the rest of your Svelte app because it is the rest of your Svelte app.

## Reactivity plus virtualization

Runes solve "what changed"; virtualization solves "what is visible". Together they bound both axes of work: the DOM node count stays proportional to the viewport, and within that viewport only the cells whose data changed repaint. A 100,000-row grid does roughly the same per-frame work as a 100-row grid.

## The trade-off we accepted

Going native to Svelte 5 means SvGrid is not framework-agnostic the way a multi-adapter engine is. That is a deliberate choice. By committing to one framework's reactivity model, we get smaller code, fewer abstractions, and behavior that matches developer expectations exactly. For teams who need cross-framework reuse, the same company ships web components on htmlelements.com - but for a Svelte app, native wins.

## Lessons for your own code

Even if you never build a grid, runes reward a few habits:

- Reach for `$derived` instead of recomputing in an effect or inside markup.
- Keep state granular so derivations stay narrow and cheap.
- Preserve object identity for things that did not change, so dependents can skip work.

## Frequently asked questions

### Why build a data grid natively on Svelte 5 runes?

A grid needs to repaint only the cells that changed. Runes give fine-grained, signal-based reactivity, so derived values and effects update surgically - which is exactly what high cell counts demand.

### Do runes replace virtualization?

No. Runes determine what changed; virtualization bounds how many DOM nodes exist. A fast grid needs both - signals for surgical updates and virtualization for a viewport-sized DOM.
