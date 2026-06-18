---
title: Reactivity with Large Arrays and Objects in Svelte 5
description: How to keep Svelte 5 reactive state fast when arrays get big - deep proxies vs $state.raw, and update patterns that scale to a data grid.
date: 2026-08-28
category: Engineering
tags: svelte 5, reactivity, arrays, performance, engineering
author: Victor Vidolov
---

Svelte 5's deep reactivity is a joy to write against and, for most apps, free. Then your array grows to tens of thousands of objects - which is exactly what sits behind a data grid - and "free" stops being quite true.

## Deep proxies have a cost

`$state` wraps objects and arrays in a deep proxy so nested mutations are tracked. For a few hundred rows this is free. For tens or hundreds of thousands of rows, proxying every object has a memory and access cost you can measure.

## $state.raw for large, replace-only data

If you treat a big dataset as immutable - fetch a page and swap it, rather than mutate rows in place - skip the proxy with `$state.raw`:

```ts
let rows = $state.raw<Row[]>([])
async function loadPage() {
  rows = await fetchPage() // reassign to update; mutation is not tracked
}
```

`$state.raw` is shallow: you update by reassigning the whole value. This is often the ideal model for server-driven grid data, where each page replaces the last. See [$state deep dive](svelte-5-state-deep-dive).

## When you do mutate, mutate surgically

If you use plain `$state` (deep) and mutate, change only what changed and keep other references stable, do not rebuild the whole array as new objects:

```ts
rows[i] = { ...rows[i], price } // one new object; the rest keep identity
```

This keeps both the proxy work and the grid's re-render minimal, see [immutable updates](immutable-updates-without-killing-performance).

## Let virtualization and derivation help

Reactivity is only half the story. Virtualization means only visible rows render regardless of array size, and `$derived` recomputes filtered/sorted views only when inputs change. Together with the right state choice, a 100,000-row reactive array stays smooth. See [reducing re-renders](reducing-re-renders-with-derived).

## A decision guide

- Mutating rows in place, moderate size? Plain `$state`.
- Large dataset you replace whole (server pages, big imports)? `$state.raw`.
- Either way: surgical updates, virtualization, and `$derived` for views.

## Frequently asked questions

### Is Svelte 5 deep reactivity slow for large arrays?

Deep proxying has a measurable cost only at large scale (tens of thousands of objects or more). For big datasets you replace wholesale, use `$state.raw` to skip proxying; for in-place mutation at moderate size, plain `$state` is fine.

### What is the best state model for a data grid's rows?

For server-driven data where each page replaces the last, `$state.raw` with whole-array reassignment is leanest. For in-memory data you mutate, use plain `$state` with surgical updates that preserve unchanged row references.
