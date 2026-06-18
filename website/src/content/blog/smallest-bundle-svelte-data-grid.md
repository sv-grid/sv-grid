---
title: Bundle Size of Svelte Data Grids - How to Compare
description: How to evaluate a data grid's real bundle impact - tree-shaking, feature gating, lazy-loaded extras - and measure what it actually adds to your app.
date: 2026-09-05
category: Comparisons
tags: bundle size, performance, comparison, svelte data grid
author: Boyko Markov
---

Bundle size matters, it is load time, and load time is conversions and Core Web Vitals. But the headline "X KB" on a library's page rarely matches what it adds to *your* app.

## Why headline numbers mislead

A single advertised size hides the things that determine your actual cost:

- **Tree-shaking**: do you ship the whole library, or only the parts you import?
- **Feature gating**: are sorting, filtering, grouping bundled in, or opt-in?
- **Lazy-loaded extras**: are heavy features (export, pivot) loaded only when used?
- **Dependencies**: does it drag in a date library, a virtualization library, icons?

Two grids with the same headline KB can differ severalfold in what they add to a real app.

## How SvGrid is structured for size

SvGrid is built so you pay for what you use:

- **Tree-shakeable, feature-gated core.** You register only the features you need (`rowSortingFeature`, `columnFilteringFeature`, ...); each is roughly 1-2 KB gzipped. A read-only grid does not ship the editing or grouping code.
- **Lazy-loaded Enterprise extras.** Export and import load their dependencies only when triggered, so a grid that never exports never pays for the export code.
- **MIT core, no heavy deps** in the community package.

This means the right comparison is not "library A vs library B headline size" but "what does each add to *my* build with *my* feature set?"

## Measure your real impact

Do this once and you will know the truth for your app:

1. Build your app without the grid; note the bundle size (`vite build` reports it).
2. Add the grid with the features you actually use; build again.
3. The difference is the grid's real cost, and use a visualizer (rollup-plugin-visualizer) to see exactly what it added.

Compare candidates this way, with your feature set, and the honest number falls out. See [measuring grid performance](measuring-grid-performance-devtools) for the runtime side.

## The trade-off

Smaller is not automatically better, a tiny grid that lacks virtualization or accessibility costs you more in engineering and runtime than a slightly larger one that has them. Weigh bundle size against the features you would otherwise build yourself.

## Frequently asked questions

### How do I compare the bundle size of Svelte data grids?

Measure the real delta: build your app without the grid, then with the grid and only the features you use, and compare. A bundle visualizer shows exactly what each adds. Headline KB figures ignore tree-shaking, feature gating, and dependencies.
