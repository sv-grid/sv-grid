---
title: First Light - Pointing SvGrid at 100,000 Rows
description: The milestone that validated the whole approach: virtualization on a runes-native engine, scrolling a hundred thousand rows smoothly, and what it proved about building native.
date: 2026-07-30
category: Company
tags: company, story, performance, virtualization
author: Kamelia M
---

A three-row grid proves your API compiles. It proves nothing about whether your architecture survives contact with real data. So once SvGrid could render and sort, we did the only honest next thing: we pointed it at a hundred thousand rows and watched.

This is the post where the bet on Svelte 5 either paid off or it did not.

## Why scale is the real test

Every grid looks fast with ten rows. The interesting questions only show up under load:

- Does the DOM stay bounded, or does it grow with the dataset until the browser chokes?
- Does each scroll frame do a constant amount of work, or does it get heavier as you go?
- Does the reactivity stay surgical when there are a hundred thousand things that could, in principle, change?

A grid that answers these well at 100k is a grid you can trust at 1,000. The reverse is not true.

## Virtualization, the way we always meant to build it

Because we had assumed virtualization from day one rather than bolting it on, the engine already produced just the rows in view plus a small overscan buffer. Given a bounded height, the component renders that window and recycles rows as you scroll, so the DOM node count tracks the viewport, not the dataset.

```svelte
<div style="height: 600px;">
  <SvGrid data={hundredThousandRows} columns={columns} />
</div>
```

Ten rows or a hundred thousand, the same handful of `<tr>` elements exist. Scrolling repositions and refills them instead of creating and destroying them.

## Where the runes bet showed up

Here is the part that made the architecture feel vindicated. Virtualization bounds how many cells exist; runes bound how much work each update costs. Together they compound: a visible row whose price changes repaints one cell, and the off-screen 99,950 rows cost nothing because they are not in the DOM and their derived values are not being read.

On an older reactivity model we would have been hand-writing memoization to stop the whole grid re-rendering on every change. On runes, the fine-grained updates we had gotten almost for free on day one were exactly what kept a six-figure-row grid smooth.

## What we measured, and what we learned

We did what you should always do instead of trusting a vibe: we recorded the performance panel while scrolling the full height, watched for long frames, and checked that the DOM node count stayed flat. It did. The lessons that stuck:

- **Bounded height is everything.** The single most common way to defeat virtualization is to forget to give the grid a viewport. Most early "it is slow" reports trace back to a missing height.
- **Stable references matter.** Rebuilding the whole data array on every tick forces the engine to reconsider everything. Mutating in place keeps updates cheap.
- **Native beats adapted under load.** The absence of a translation layer is not a purity argument; it is fewer allocations and less work per frame, and you feel it most when the numbers get big.

## What this milestone meant

A hundred thousand rows scrolling smoothly was not a feature we could ship by itself. It was proof that the foundation - native runes, a clean engine/view split, virtualization assumed from the start - could carry everything we wanted to build on top of it.

From here, the work turned to the features a real grid needs: sorting and Excel-style filtering, grouping and aggregation, inline editing, server-side data, master-detail and tree rows. Each of those has its own post in this blog now. But they all stand on the day the architecture proved it could hold a hundred thousand rows without flinching.

## Frequently asked questions

### Can SvGrid really handle 100,000 rows?

Yes. Row and column virtualization keep the DOM proportional to the viewport, so a 100k-row grid scrolls smoothly as long as it has a bounded height. This was the milestone that validated SvGrid's architecture early in development.

### How do virtualization and runes work together?

Virtualization bounds how many cells exist in the DOM; Svelte 5 runes bound how much work each update costs by repainting only what changed. Combined, a large grid does roughly the same per-frame work as a small one.
