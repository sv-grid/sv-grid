---
title: $state Deep Dive for Data-Heavy Svelte Apps
description: How Svelte 5's $state really works - deep reactivity via proxies, arrays and objects, $state.raw for large data, and $state.snapshot.
date: 2026-09-10
category: Engineering
tags: svelte 5, state, reactivity, engineering, data grid
author: Kamelia M
---

`$state` looks like a one-liner you learn in five minutes, and for a button it is. For a data-heavy app - a grid above all - the details underneath start to matter a lot.

## Deep reactivity via proxies

`$state` wraps objects and arrays in a deep proxy, so mutating nested properties is tracked:

```ts
let rows = $state<Row[]>([{ id: '1', name: 'Ada' }])
rows.push({ id: '2', name: 'Linus' }) // tracked
rows[0].name = 'Ada L.'                // tracked - deep
```

This is why a grid bound to `rows` updates whether you push, splice, or edit a nested field. No manual invalidation.

## The cost of deep proxies

Deep proxying is not free. For very large datasets that you treat as immutable - replace wholesale rather than mutate in place - the proxy overhead is wasted. `$state.raw` gives you a non-proxied, shallow state you reassign:

```ts
let rows = $state.raw<Row[]>([]) // not deeply reactive
rows = await fetchPage()         // reassign to update (mutation is NOT tracked)
```

Use `$state.raw` for large, replace-only data (a fetched page you swap whole); use plain `$state` when you mutate in place. For a grid, raw state plus whole-array replacement is often the leanest model for server-driven data.

## $state.snapshot for plain copies

When you need a non-reactive plain object - to serialize, log, or hand to a library that does not expect a proxy - use `$state.snapshot`:

```ts
const plain = $state.snapshot(rows) // deep, plain (non-proxy) copy
localStorage.setItem('rows', JSON.stringify(plain))
```

Passing a proxy to `JSON.stringify` usually works, but some third-party code misbehaves with proxies; snapshot avoids surprises.

## State in modules and classes

`$state` works in `.svelte.ts`/`.svelte.js` modules and class fields, so you can build a reactive data store outside a component, handy for sharing grid state across views:

```ts
// grid-state.svelte.ts
export const gridState = $state({ sorting: [], filters: [] })
```
