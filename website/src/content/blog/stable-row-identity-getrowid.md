---
title: Stable Row Identity in SvGrid (and why it matters)
description: Why a data grid needs stable row identity for selection, edits, and performance - and how to keep it correct as your data changes.
date: 2026-09-08
category: Performance
tags: performance, identity, getRowId, selection, recipe
author: Kamelia M
---

Row identity is one of those things nobody thinks about until it breaks, and then selection jumps to the wrong row, an edit lands on the wrong record, and updates churn more than they should. It is the quiet foundation under selection, editing, and fast updates. Here is how identity works in SvGrid and how to keep it honest.

![A right-click context menu on a SvGrid row.](/blog-media/context-menu.png)
*A right-click context menu on a SvGrid row.*

## What identity is for

The grid uses a row's identity to answer three questions:

- **Selection**: which rows are still selected after the data changes?
- **Editing**: which row does a committed edit belong to?
- **Performance**: which rows actually changed, so the rest can be skipped?

Get identity wrong and all three degrade together.

## How SvGrid identifies rows

The render component identifies rows by their position in the `data` array today; the headless `createSvGrid` core supports a `getRowId` for explicit, value-based identity. Practically, that means:

- If you mutate `data`, **preserve object references for rows that did not change**, so their position-based identity stays aligned and selection/edit state follows.
- When you need identity to survive reordering or paging, use the headless core's `getRowId` (keyed on your stable `id`) rather than relying on index.

```ts
// Preserve identity: change one row, keep the others' references
rows[i] = { ...rows[i], status: 'active' } // only row i is a new object
// Avoid: rebuilding every row each tick
rows = data.map((r) => ({ ...r }))          // every row looks "new"
```

## The update-performance link

Stable references are also a performance lever. Svelte 5's fine-grained reactivity skips work for values that did not change; if every row is a fresh object on every tick, nothing can be skipped. Keeping references stable for unchanged rows lets the grid - and the framework - do the minimum work. See [reducing re-renders with $derived](reducing-re-renders-with-derived).

## Practical rules

- Give every record a real, stable `id` from your backend.
- Update rows immutably but surgically, new object for the changed row, same references for the rest.
- For live feeds, look up the row by id (a `Map` from id to index) and replace just that one.
- Do not use array index as a logical key for selection across reorders, use the real id.
