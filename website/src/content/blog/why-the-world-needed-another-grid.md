---
title: Why the World Needed Another Grid
description: Every framework era gets the data grid it deserves - jqxGrid for the jQuery age, the grids that followed for the Angular and React age, and now a grid built natively on Svelte 5 runes.
date: 2026-06-12
category: Company
tags: company, jqxgrid, history, svelte data grid, reactivity, story
author: Boyko Markov
pinned: true
---

Every few years someone ships a new data grid and the rest of us roll our eyes. Does the world really need another one? I have asked it myself, and since I have spent the better part of fifteen years building the things, I feel entitled to the cynicism.

Here is where I have landed. The world does periodically need a new grid, and it is never because the old ones got worse. It is because the ground moves. A data grid is really a reactivity engine wearing a table's clothes, and reactivity is the one part you cannot bolt on later. So every time the way frameworks handle reactivity shifts, the grids built for the previous model start to feel like a guest who overstayed: technically still here, faintly out of place.

## A grid is native to the era it was born in

Go back to 2011. The web ran on jQuery, and reactivity meant imperative DOM manipulation: find the node, change the node. We built jqxGrid for that world, and it was fast and capable in it. It went into enterprise software at companies like Samsung, Boeing, NVIDIA, Microsoft, Nokia, and Intel.

Then the ground moved. AngularJS arrived with declarative data binding, and a jQuery-era grid - any jQuery-era grid - was never going to feel native inside it. It could be made to work, but it spoke a different language. This is not a knock on those grids; it is just physics. AG Grid's own well-known origin post, [Why The World Needed Another Angular Grid](https://blog.ag-grid.com/why-the-world-needed-another-angular-grid/), makes exactly this point: the grids of 2014 were not built for Angular's model, so the author built one that was. He was right to. That is how the category moves forward.

The pattern repeats every time:

- **jQuery era:** imperative DOM. jqxGrid and its peers were native here.
- **Angular / React era:** component trees and virtual DOM. A new generation of grids was built natively for that model.
- **Svelte 5 era:** signal-based, fine-grained reactivity. Which grid was built natively for *this*?

## Why Svelte 5 specifically needed one

Svelte 5 introduced runes - `$state`, `$derived`, `$effect` - a signal-based reactivity model where a derived value recomputes only when the exact state it reads changes. For most components that is a pleasant ergonomic upgrade. For a data grid it is the whole ballgame, because a grid is a hundred thousand cells, any of which can change, and the entire job is to repaint exactly what moved and nothing else.

You can take a framework-agnostic grid engine, wrap it in a Svelte adapter, bridge it with stores, and ship something that works. But you pay a translation tax on every update, and the result feels a half-step off - the same "works, but not quite native" sensation a jQuery grid gave an Angular app a decade ago. The lesson of every previous era is that the half-step never fully closes. Reactivity has to be designed in, not adapted on.

So we built [SvGrid](/) natively on runes. No store wrappers, no adapter layer, no translation. State is just state; derived rows are just derived. The grid speaks the framework's own language because it is written in it.

## What that buys you

Building native to Svelte 5 is not an aesthetic preference; it shows up in the product:

- A headless core (`createSvGrid`) for full control, and a render component (`<SvGrid>`) for speed - same column definitions, switch freely.
- Row and column virtualization, so 100,000 rows by 100 columns stay smooth.
- Excel-style filtering, grouping with aggregation, tree and master-detail rows, inline editing with validation, and server-side data.
- WAI-ARIA accessibility and full keyboard navigation on by default.
- An MIT-licensed core that is free for commercial use, plus an optional Pro pack for export, import, print, pivot, and AI.

## The throughline

We have now built a grid for every era the web has handed us: jqxGrid in the jQuery days, the Smart UI web components on [htmlelements.com](https://www.htmlelements.com) through the cross-framework years, and SvGrid for Svelte. The technology keeps changing; the conviction does not. A grid should be native to the framework it lives in, fast, accessible, and genuinely pleasant to extend.

So, does the world need another grid? When a framework shows up with a better model of reactivity, I think it does. Svelte 5 was that arrival for me, and SvGrid is my answer to it.

## Frequently asked questions

### Why build a new grid for Svelte instead of adapting an existing one?

A data grid is a reactivity engine, and reactivity cannot be bolted on. A grid feels native only in the framework it was built for. SvGrid is written natively on Svelte 5 runes, avoiding the adapter and store layers that make a ported grid feel a half-step off in Svelte.

### Has the SvGrid team built data grids before?

Yes. The same team has shipped jqxGrid for the jQuery era and the Smart UI web components on htmlelements.com for the cross-framework era. SvGrid is its native Svelte 5 grid.
