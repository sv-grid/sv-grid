---
title: Immutable Grid Updates Without Killing Performance
description: Surgical immutability - how to get predictable reactivity in SvGrid without the cost of cloning everything on every change.
date: 2026-08-03
updated: "2026-07-02"
category: Performance
tags: performance, immutability, reactivity, recipe, svelte data grid
author: Kamelia M
---

Cloning the entire dataset on every change is technically immutable and practically a disaster. If you have 50,000 rows and a live feed pushing updates at 60Hz, you are allocating 50,000 objects 60 times per second and handing the garbage collector a full-time job. Meanwhile, every row looks new to the grid's change detection, so everything repaints - even the rows that did not change.

There is a better model. You do not need full immutability. You need *structural sharing*: new references for what changed, shared references for everything else.

## What the grid actually checks

SvGrid's reactivity (built on Svelte 5 signals) decides whether to repaint a row by comparing object identity. Same reference means nothing changed, skip it. New reference means something changed, update the DOM.

This is fast when it is precise. One row changed? One new reference, one repaint. But if your update strategy produces a new reference for every row regardless of what actually changed, you have traded the CPU cost of diffing for the memory cost of allocating - and you have not saved any renders.

```ts
import SvGrid from '@svgrid/grid'

// WRONG: every row is a brand-new object on every update
// The grid sees 50,000 changed rows when one cell was edited
function updateBad(i: number, field: string, value: unknown) {
  data = data.map((r) => ({ ...r }))
}

// RIGHT: new reference only for the changed row, shared ref for everything else
function updateRow(i: number, field: string, value: unknown) {
  const next = data.slice()                       // new array, O(n) but cheap
  next[i] = { ...data[i], [field]: value }        // new object only for row i
  data = next                                     // rows[j !== i] keep their references
}
```

The `slice()` call is O(n) but it only copies an array of pointers, not the objects themselves. The objects at every index except `i` are the same reference they always were. The grid skips them.

## Hooking into the edit lifecycle

SvGrid's `onCellEdit` callback is where you apply these updates. The grid calls it after the user commits a change, passing you the row index, column id, and new value.

```svelte
<script lang="ts">
  import SvGrid from '@svgrid/grid'
  import type { ColumnDef } from '@svgrid/grid'

  type Row = { id: number; name: string; price: number; status: string }

  let data: Row[] = $state([
    { id: 1, name: 'Widget A', price: 29.99, status: 'active' },
    { id: 2, name: 'Widget B', price: 49.99, status: 'inactive' },
    // ... more rows
  ])

  const columns: ColumnDef<typeof features, Row>[] = [
    { id: 'name',   field: 'name',   header: 'Name',   width: 200, editable: true },
    { id: 'price',  field: 'price',  header: 'Price',  width: 100, type: 'number', editable: true },
    { id: 'status', field: 'status', header: 'Status', width: 120, editable: true },
  ]

  function onCellEdit({ rowIndex, columnId, newValue }: {
    rowIndex: number
    columnId: string
    newValue: unknown
  }) {
    const next = data.slice()
    next[rowIndex] = { ...data[rowIndex], [columnId]: newValue }
    data = next
  }
</script>

<SvGrid
  {data}
  {columns}
  editable
  {onCellEdit}
  rowHeight={32}
  virtualization={true}
/>
```

The assignment `data = next` triggers Svelte's reactivity. Because `next` is a new array reference, the grid knows something changed. But row objects at every index except `rowIndex` are the same references as before, so the grid skips them.

## Nested objects: copy the path, not the tree

If your rows contain nested objects - say an `address` field with `city`, `zip`, etc. - the same principle applies, one level deeper. Copy from the root of the mutation down to the changed field, sharing everything else.

```ts
type Row = {
  id: number
  name: string
  address: { city: string; zip: string; country: string }
  metrics: { views: number; clicks: number; ctr: number }
}

function updateCity(i: number, city: string) {
  const next = data.slice()
  next[i] = {
    ...data[i],
    address: {
      ...data[i].address,  // share zip, country
      city,                // only city is new
    },
    // metrics keeps its reference - not touched
  }
  data = next
}
```

`data[i].metrics` is the same object reference before and after. If something downstream is watching `metrics`, it will not fire. The update is scoped exactly to the changed subtree.

## Batch updates and `applyTransaction`

Surgical copies are great for single-cell edits. When you need to update, add, or remove many rows at once - say syncing a page of server results - use `applyTransaction` instead. It accepts add, update, and remove arrays and applies them in one pass.

```ts
import SvGrid, { type SvGridApi } from '@svgrid/grid'

let api: SvGridApi

// Called from a polling loop, WebSocket handler, or server sync
function syncFromServer(patch: {
  add: Row[]
  update: { id: number; changes: Partial<Row> }[]
  remove: number[]
}) {
  api.applyTransaction({
    add: patch.add,
    update: patch.update.map(({ id, changes }) => {
      const existing = data.find((r) => r.id === id)!
      return { ...existing, ...changes }  // surgical merge per row
    }),
    remove: patch.remove,
  })
}
```

`applyTransaction` handles the structural sharing internally. You do not need to manage array slicing yourself - just pass the minimal delta and the grid does the rest.

## When to reach for Immer

If your row type is deeply nested and mutations are complex, Immer is a reasonable tool. It gives you a draft-based API that feels mutable but produces structurally-shared immutable results.

```ts
import { produce } from 'immer'

function deepUpdate(i: number, updater: (row: Row) => void) {
  data = produce(data, (draft) => {
    updater(draft[i])
  })
}

// Usage
deepUpdate(3, (row) => {
  row.address.city = 'Berlin'
  row.metrics.clicks += 1
})
```

Immer's overhead is small enough that it rarely matters for interactive edits. For high-frequency updates - a live trading feed pushing hundreds of updates per second - hand-written surgical copies are measurably leaner. At that point you are updating specific known fields, not navigating arbitrary nested paths, so the verbosity is manageable.

The threshold I use: if your update rate is under ~100/sec and the nesting is more than two levels deep, Immer is probably the better tradeoff. Above that rate, profile first, then optimize.

## The one trap: accidental mutation

Structural sharing only works if you never mutate objects in place. If you write `data[i].price = newValue` directly, the object reference does not change, Svelte's reactivity does not fire, and the grid does not update. You get silent staleness.

The fix is straightforward: treat row objects as read-only once they are in the array. If you are working with TypeScript, `Readonly<Row>` at the type level will surface accidental mutations at compile time rather than at runtime. It is a small annotation that has saved me from debugging confusing stale-state bugs more than once.

```ts
// TypeScript will catch mutations before they reach production
const columns: ColumnDef<typeof features, Readonly<Row>>[] = [
  { id: 'name', field: 'name', header: 'Name', width: 200, editable: true },
  // ...
]
```

The grid does not care whether your type is `Readonly` or not - it is a compile-time guard for your own code. Pair it with the surgical-copy pattern in your event handlers and you get both safety and performance.
