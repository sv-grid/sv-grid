---
title: Migrating a Svelte 4 Table Component to Svelte 5
description: Port a hand-rolled Svelte 4 table to Svelte 5 runes - converting props, reactive statements, stores, slots, and events to the new model.
date: 2026-08-18
category: Engineering
tags: svelte 5, migration, runes, table, engineering
author: Victor Vidolov
---

If you are carrying a hand-rolled table from Svelte 4, the move to Svelte 5 is a fork in the road: simplify what you have, or admit it has outgrown a hand-roll and reach for a real grid. Either way, here is the concept-by-concept translation, and an honest nudge on which path to take.

![A million-row dataset in SvGrid, kept smooth by virtualization.](/blog-media/million-rows.png)
*A million-row dataset in SvGrid, kept smooth by virtualization.*

## The translation table

| Svelte 4 | Svelte 5 |
| --- | --- |
| `export let rows` | `let { rows } = $props()` |
| `$: sorted = [...rows].sort(...)` | `let sorted = $derived([...rows].sort(...))` |
| `$: { sideEffect() }` | `$effect(() => { sideEffect() })` |
| `writable(...)` for local state | `$state(...)` |
| `$store` reads | `$state` / `$derived` directly |
| `<slot value={x} />` | `{#snippet}` + `{@render}` |
| `on:click` | `onclick` |
| `createEventDispatcher` | callback props |

## Props and reactivity

```svelte
<!-- Svelte 4 -->
<script>
  export let rows = []
  let sortKey = 'name'
  $: sorted = [...rows].sort((a, b) => (a[sortKey] > b[sortKey] ? 1 : -1))
</script>
```

```svelte
<!-- Svelte 5 -->
<script lang="ts">
  let { rows = [] } = $props()
  let sortKey = $state('name')
  let sorted = $derived([...rows].sort((a, b) => (a[sortKey] > b[sortKey] ? 1 : -1)))
</script>
```

The reactive `$:` becomes `$derived` for values and `$effect` for side effects, the split is the main mental shift. See [$effect pitfalls](svelte-effect-pitfalls).

## Slots to snippets

Custom cell slots become snippet props, which pass data far more cleanly, see [snippets vs slots](snippets-vs-slots-svelte-5). Events change from `on:click` to `onclick`, and `createEventDispatcher` becomes plain callback props.

## The bigger question: keep it or replace it?

Migration is a good moment to be honest about your table. A Svelte 4 table you hand-rolled probably lacks virtualization, accessibility, and server-side data - the expensive parts. If you only need a small static table, port it; it is a quick job. If it has grown features (sorting, filtering, editing, large data), porting maintains a burden you could hand off - this is where adopting [SvGrid](build-vs-buy-svelte-data-table) often makes more sense than carrying your own grid into Svelte 5.
