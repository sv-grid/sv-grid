---
title: Immutable Data Updates in Svelte 5
description: How to update arrays and objects so Svelte 5 runes react correctly - the patterns that keep a data grid (or any list) in sync.
date: 2026-08-02
category: Concepts
tags: svelte 5, immutability, reactivity, concepts, runes
author: Victor Vidolov
---

Svelte 5's runes are reactive, yes, but "reactive" does not mean "you can stop thinking about how you mutate things", especially for the arrays and objects feeding a list or a grid. Here are the update patterns that hold up, and the ones that fail in ways you only notice later.

![A million-row dataset in SvGrid, kept smooth by virtualization.](/blog-media/million-rows.png)
*A million-row dataset in SvGrid, kept smooth by virtualization.*

## Svelte 5 reacts to assignment and mutation

Unlike Svelte 4's assignment-only model, Svelte 5's `$state` proxies deeply, so both mutation and reassignment are tracked:

```ts
let rows = $state<Row[]>([])
rows.push(newRow)          // works - tracked
rows[0].name = 'Ada'       // works - deep reactivity
rows = [...rows, newRow]   // also works - reassignment
```

This is more forgiving than Svelte 4. But for components that compare references to decide what to re-render (a data grid being the prime example), *how* you update still affects performance and correctness.

## Prefer surgical, reference-friendly updates

When something downstream keys off identity, replace only what changed and keep other references stable:

```ts
// change one row, keep the others' references
rows[i] = { ...rows[i], status: 'active' }
```

Avoid rebuilding every item as a new object each tick, it makes everything look changed, which is wasteful for a grid:

```ts
// avoid: every row is "new", defeating fine-grained updates
rows = rows.map((r) => ({ ...r }))
```

See [immutable updates without killing performance](immutable-updates-without-killing-performance).

## Common pitfalls

- **Replacing the array reference unnecessarily** when you only changed one item. Mutate the one item (or replace just it) instead.
- **Deeply nested updates**: copy along the path you change, not the whole tree.
- **Sharing the same object across rows**: mutating it changes every row that references it. Clone when you intend independence.
- **External arrays**: if your data comes from a non-`$state` source (a prop, a store), wrap or assign it into `$state` so updates are tracked.

## Why a grid cares

A data grid decides what to repaint, and what selection/edit state to keep, by comparing references between updates. Predictable, surgical immutable updates are what keep selection aligned, edits on the right row, and rendering minimal. See [stable row identity](stable-row-identity-getrowid).

## Frequently asked questions

### Do I need immutable updates in Svelte 5?

Svelte 5 tracks both mutation and reassignment, so you have flexibility. But for list- or grid-backed state, surgical updates - new reference only for what changed - keep change detection precise and rendering minimal.
