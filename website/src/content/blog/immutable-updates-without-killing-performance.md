---
title: Immutable Grid Updates Without Killing Performance
description: Update a data grid immutably for predictable reactivity - without the cost of cloning everything on every change. The surgical-copy pattern.
date: 2026-08-03
category: Performance
tags: performance, immutability, reactivity, recipe, svelte data grid
author: Kamelia M
---

"Update immutably" is good advice that is easy to misapply. Cloning your entire dataset on every change is immutable - and slow. The goal is *surgical* immutability: a new reference only for what changed, shared references for everything else. Here is the pattern that keeps both correctness and speed.

## Why immutability matters for a grid

The grid (and Svelte 5's reactivity) decides what to repaint by comparing references. New reference means "this changed, re-render it." So immutable updates make change-detection precise. But the corollary bites: if everything is a new reference, everything looks changed.

## The wrong way: clone the world

```ts
// Every row is a brand-new object every update - the grid reconsiders all of them
rows = data.map((r) => ({ ...r }))
```

This is immutable and wasteful. It defeats the fine-grained updates that make the grid fast.

## The right way: copy only the path that changed

Replace the one row (and the array), keep every other row's reference:

```ts
function setCell(i: number, field: string, value: unknown) {
  const next = rows.slice()          // new array
  next[i] = { ...rows[i], [field]: value } // new object only for row i
  rows = next                         // every other row keeps its reference
}
```

Now only row `i` looks changed; the grid repaints one row, not all of them.

## Nested updates

For nested data, copy only along the path to the change, not the whole tree:

```ts
rows[i] = { ...rows[i], address: { ...rows[i].address, city } }
```

Everything outside that path keeps its reference and is skipped by reactivity.

## Helpers, with a caveat

Libraries like Immer give you "mutable" syntax that produces immutable, structurally-shared results - convenient and correct. Just know there is a small overhead; for hot paths (a live feed updating thousands of times a second) hand-written surgical copies are leanest. See [throttling live updates](throttle-live-updates-animation-frames).

## Frequently asked questions

### Does immutable updating make my grid slow?

Only if you clone everything. Cloning the whole dataset on each change makes every row look new, defeating fine-grained reactivity. Copy only the changed row (and the array), keeping other references, and updates stay cheap.

### How do I update nested grid data immutably?

Copy only along the path to the change - a new object for the row, a new object for the nested field you touched - and keep all other references. Everything outside that path is then skipped by the grid's change detection.
