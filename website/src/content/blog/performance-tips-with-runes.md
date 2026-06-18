---
title: Performance Tips for SvGrid with Svelte 5 Runes
description: Keep your Svelte data grid fast - stable references, derived state, avoiding needless re-renders, and letting the grid do the heavy lifting.
date: 2026-01-27
category: Performance
tags: performance, runes, svelte 5, optimization, svelte data grid
author: Kamelia M
---

SvGrid is built on Svelte 5 runes, which give it fine-grained reactivity, the grid updates only what changed. A few habits on your side keep the whole pipeline fast, even with large datasets and frequent updates.

## Keep `data` references stable

Svelte's reactivity keys off references. If you rebuild the entire `data` array on every tick, the grid has to reconsider everything. Mutate in place or replace only what changed:

```ts
// Good: change one row, keep the rest of the identities
rows[i] = { ...rows[i], price: newPrice }

// Wasteful: a brand-new array of brand-new objects every tick
rows = data.map((r) => ({ ...r }))
```

Preserving identity for unchanged rows also keeps selection and edit state aligned.

## Derive, do not duplicate

Computing a filtered or shaped list? Use `$derived` so it recomputes only when its inputs change, instead of recomputing inside a render or an effect:

```ts
let query = $state('')
let visible = $derived(rows.filter((r) => r.name.includes(query)))
```

Better still, let the grid's own filter feature do it, it filters once per change and reuses the result.

## Let the grid do the heavy lifting

Sorting, filtering, grouping, and paging are optimized inside the engine. Re-implementing them in your component usually means doing the work twice. Register the feature and read the result through callbacks instead of pre-processing the array yourself.

## Bound the DOM with virtualization

The single biggest performance lever is virtualization, and it is automatic when the grid has a bounded height. Ten thousand rows render the same handful of DOM nodes as ten rows. Make sure the grid lives in a container with an explicit height or a flex parent with `min-height: 0`.

## Throttle high-frequency updates

For live data - a price feed, a sensor stream - updates can arrive faster than the screen refreshes. Batch them to animation-frame cadence so you paint at most once per frame:

```ts
let pending = []
function onTick(update) {
  pending.push(update)
  requestAnimationFrame(flush)
}
```

The grid will happily render 60 times a second; it does not need to render 6,000 times a second.
