---
title: Reducing Re-Renders in SvGrid with $derived
description: Use Svelte 5's $derived to compute grid data efficiently - so the grid recomputes only when inputs change, not on every render.
date: 2026-08-30
category: Performance
tags: performance, runes, derived, reactivity, recipe
author: Victor Vidolov
---

The fastest update is the one that never runs. Svelte 5's `$derived` is the cleanest way to get there: compute the grid's data so it only recalculates when its real inputs change, and nothing recomputes on unrelated state. In a data-heavy app that is the highest-leverage performance lever you have.

## Derive, do not recompute

Computing a shaped or filtered list inside markup or an effect runs more often than you think. A `$derived` runs only when the state it reads changes:

```svelte
<script lang="ts">
  let query = $state('')
  let rows = $state<Row[]>([])
  // Recomputes only when `rows` or `query` changes - not on unrelated updates.
  let visible = $derived(rows.filter((r) => r.name.includes(query)))
</script>

<SvGrid data={visible} columns={columns} features={features} />
```

Editing a cell the filter does not read will not recompute `visible`. That is the whole point of fine-grained reactivity.

## Let the grid's features do the work

Better still: if you only need standard sorting and filtering, register the grid's features instead of pre-filtering in your component. The engine filters once per change and reuses the result across renders, so you are not doing the work twice. Reach for your own `$derived` for shaping the grid does not do (custom grouping, joins, computed columns).

## Keep references stable

`$derived` helps only if its inputs change meaningfully. If you rebuild `rows` as all-new objects every tick, every derivation downstream sees "everything changed". Update immutably but surgically, new object for the changed row, same references for the rest. See [stable row identity](stable-row-identity-getrowid).

## Avoid effect-driven recomputation

A common anti-pattern is using `$effect` to recompute derived data and assign it back to state. That creates extra update cycles and is easy to get subtly wrong. If you are computing a value from other state, it is a `$derived`, not an `$effect`. Reserve `$effect` for genuine side effects (subscriptions, DOM, network).

## `$derived.by` for multi-step work

When a derivation needs several statements, use `$derived.by`:

```ts
let result = $derived.by(() => {
  const filtered = rows.filter((r) => r.active)
  return filtered.sort((a, b) => b.score - a.score)
})
```

It memoizes the same way, recomputing only when its dependencies change.
