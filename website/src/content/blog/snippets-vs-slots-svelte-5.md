---
title: Snippets vs Slots in Svelte 5
description: Svelte 5 replaces slots with snippets. Here is the difference, why snippets are more powerful, and how a data grid uses them for cells.
date: 2026-09-06
category: Engineering
tags: svelte 5, snippets, slots, components, engineering
author: Boyko Markov
---

Svelte 5 introduced snippets and deprecated slots. If you are coming from Svelte 4 - or wondering why a grid renders cells with snippets - here is the difference and why snippets are the better tool.

## Slots (Svelte 4) vs snippets (Svelte 5)

Slots let a parent pass markup into named holes in a child. They worked, but passing data *out* of a slot (slot props) was awkward, and you could not pass a slot around as a value.

Snippets are reusable, parameterized chunks of markup that are *first-class values*. You define one with `{#snippet}` and render it with `{@render}`:

```svelte
{#snippet row(item)}
  <li>{item.name} - {item.price}</li>
{/snippet}

<ul>
  {#each items as item}{@render row(item)}{/each}
</ul>
```

## Why snippets are more powerful

- **They take parameters.** `{#snippet cell(value)}` receives data cleanly - no clumsy slot-prop syntax.
- **They are values.** You can pass a snippet as a prop, store it, choose between snippets at runtime.
- **They compose.** A snippet can render another snippet.

This is exactly the flexibility a data grid needs.

## How a grid uses snippets

A grid must let you render arbitrary markup per cell, with the cell's data. Snippets are the perfect fit - SvGrid renders custom cells via `renderSnippet`, passing the cell context as parameters:

```svelte
{#snippet StatusCell(p: { value: string })}<span class="badge">{p.value}</span>{/snippet}
// column: { field: 'status', header: 'Status', cell: (c) => renderSnippet(StatusCell, { value: c.getValue() }) }
```

The snippet receives the value, so you keep type safety and full markup control - see [custom cell renderers](custom-cell-renderers-with-snippets).

## Migrating from slots

- `<slot />` becomes a `children` snippet rendered with `{@render children()}`.
- Named slots become named snippet props.
- Slot props (`<slot value={x} />`) become snippet parameters - much cleaner.

## Frequently asked questions

### What replaced slots in Svelte 5?

Snippets. They are reusable, parameterized chunks of markup defined with `{#snippet}` and rendered with `{@render}`. Unlike slots, they take parameters cleanly and are first-class values you can pass as props.

### Why do data grids use snippets for cells?

Because a cell needs arbitrary markup plus the cell's data. Snippets accept parameters and can be passed as values, so a grid can take a per-column cell snippet and render it with the cell context - which slots handled awkwardly.
