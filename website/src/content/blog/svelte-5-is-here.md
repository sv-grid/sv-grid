---
title: Why Svelte 5 Changed Everything for Data Grids
description: Svelte 5 shipped with runes - signal-based, fine-grained reactivity. Here is why that release was the spark behind a brand-new Svelte data grid.
date: 2026-06-13
category: Company
tags: svelte 5, reactivity, story, background
author: Boyko Markov
---

Svelte 5 shipped in late 2024 with runes, a release that rewrote how reactivity works in Svelte. If you build data-heavy UI for a living, as we do, it is hard to overstate how significant that was.

![A live market grid in SvGrid.](/blog-media/stock-market.png)
*A live market grid in SvGrid.*

This is where the SvGrid story starts: the runtime that made us want to build a new data grid from scratch. It begins with what runes changed.

## What actually changed

Svelte 5 introduces runes: explicit, signal-based reactivity primitives.

- `$state` declares reactive state.
- `$derived` computes a value that updates only when the specific state it reads changes.
- `$effect` runs side effects when its dependencies change.

Earlier versions of Svelte leaned on compiler magic and a `let`-is-reactive convention that was elegant for small components but got fuzzy at scale. Runes make the data flow explicit and, crucially, fine-grained. A derived value recomputes when its inputs change, and not otherwise.

## Why a grid cares more than most components

A button has one piece of state. A form has a few dozen. A data grid has tens of thousands of cells, any of which can change at any moment, and the entire engineering problem is to repaint exactly what moved and nothing else.

That is a reactivity problem first and a rendering problem second. With coarse-grained reactivity you spend your life fighting the framework to avoid re-rendering the whole table. With signals, the framework does the surgical thing by default:

```ts
let query = $state('')
let visible = $derived(rows.filter((r) => r.name.includes(query)))
```

Typing in the filter recomputes `visible`. Editing a cell the filter never reads does not. No virtual-DOM diff over the whole grid, no manual memoization gymnastics. The runtime finally matches the shape of the problem.

## A decade of waiting for this

We have built data grids since 2011, jqxGrid in the jQuery era, the Smart UI web components after that. Across all of it, one truth held: a grid is only ever as fast and as natural as the reactivity model underneath it. jQuery gave us imperative DOM. The component era gave us virtual DOM and re-render discipline. Both worked, both had ceilings.

Signals are different. They are the model a grid has wanted all along.

## What comes next

Reading the Svelte 5 release notes, the question almost asked itself: if this is finally the right foundation, who is going to build the grid that uses it natively, not a port, not an adapter over a store, but a grid written in runes from the first line?

We had some thoughts about that, and acted on them. Read next: [The Idea, a data grid built for Svelte 5](the-idea-a-native-svelte-grid).
