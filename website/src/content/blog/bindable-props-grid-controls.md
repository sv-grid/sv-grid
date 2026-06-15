---
title: $bindable Props for Grid Controls in Svelte 5
description: Use $bindable to build two-way-bound grid controls - a search box, page size, or density toggle - that stay in sync with parent state.
date: 2026-07-06
category: Engineering
tags: svelte 5, bindable, props, components, engineering
author: Kamelia M
---

`$bindable` is Svelte 5's way to opt a prop into two-way binding. It is exactly what you want for the small controls around a data grid - a search box, a page-size selector, a density toggle - where parent and child should share one value. Here is how to use it well.

## What $bindable does

By default props flow one way (parent to child). `$bindable` lets the parent use `bind:` so changes flow both ways:

```svelte
<!-- SearchBox.svelte -->
<script lang="ts">
  let { value = $bindable('') }: { value?: string } = $props()
</script>
<input bind:value placeholder="Search..." />
```

```svelte
<!-- parent -->
<script lang="ts">
  let query = $state('')
</script>
<SearchBox bind:value={query} />
<SvGrid data={filtered(query)} columns={columns} />
```

Now `query` and the input stay in sync, and the grid reacts to it.

## Good uses around a grid

`$bindable` shines for grid chrome where the parent owns the value:

- A **search/filter box** bound to the query that drives the grid.
- A **page-size selector** bound to `pageSize`.
- A **density toggle** bound to a density value (see [density toggle](density-row-height-toggle)).
- A **column-visibility map** bound between a chooser and the grid.

## Use it sparingly

Two-way binding is convenient but can obscure data flow if overused. Prefer one-way props plus a callback when the parent needs to *react* (validate, transform, persist) rather than just mirror. Reserve `$bindable` for genuine shared-value controls where mirroring is exactly what you want.

```svelte
<!-- when you need to react, not just mirror: one-way + callback -->
<SearchBox value={query} onChange={(v) => { query = v; track(v) }} />
```

## Default values

Give `$bindable` a default so the component works even when the parent does not bind it:

```ts
let { pageSize = $bindable(50) } = $props()
```

## Frequently asked questions

### What is $bindable in Svelte 5?

It marks a prop as two-way bindable, so a parent can use `bind:` and changes flow both directions. It is ideal for shared-value grid controls like a search box, page-size selector, or density toggle.

### When should I avoid $bindable?

When the parent needs to react to a change (validate, transform, persist) rather than just mirror the value. In that case use a one-way prop plus a callback, which keeps data flow explicit. Reserve `$bindable` for true shared-value mirroring.
