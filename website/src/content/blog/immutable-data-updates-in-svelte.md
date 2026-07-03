---
title: Immutable Data Updates in Svelte 5
description: Svelte 5 runes track both mutation and reassignment, but for grids and lists, the way you update data determines whether re-renders are surgical or wasteful. Here are the patterns that actually hold up.
date: 2026-08-02
updated: "2026-07-02"
category: Concepts
tags: svelte 5, immutability, reactivity, concepts, runes
author: Victor Vidolov
---

Svelte 5's deep reactivity is genuinely good news. `$state` proxies your arrays and objects so both mutation and reassignment trigger updates. The bad news: that flexibility makes it easy to do the right thing by accident, and the wrong thing without noticing until your grid starts repainting everything on every keystroke.

The core question when working with list data is not "will Svelte detect this?" - it will. The question is "how expensive will the re-render be, and will components that key off identity behave correctly?"

## What Svelte 5 actually tracks

Svelte 4 required assignment to trigger reactivity. Svelte 5 removes that constraint with proxy-based `$state`:

```ts
let rows = $state<Row[]>([])

// All of these are tracked in Svelte 5:
rows.push(newRow)           // mutation - works
rows[0].name = 'Ada'        // deep mutation - works
rows = [...rows, newRow]    // reassignment - also works
```

That last form - spread into a new array - is what most "immutable updates" guides recommend. It works, but it creates a new reference for every item in the array, which has implications for anything downstream that compares by reference.

## Reference identity and why grids care

A data grid maintains state keyed to rows: which row is selected, which cell is being edited, which group is expanded. It maps that state to your data using row identity - either an index or a stable ID field you provide.

When you replace an entire array with a spread, every row becomes a new object in memory. If the grid is checking `oldRow === newRow` to decide what changed, it sees everything as changed and repaints the full viewport. For small datasets this is invisible. At 10,000+ rows with virtualization, it shows up as a noticeable stutter.

The fix is surgical replacement: only create a new object for the row that actually changed, and leave the others untouched.

```ts
import SvGrid, { type ColumnDef, tableFeatures, rowSelectionFeature } from '@svgrid/grid'

// Updating a single field in a single row - surgical, reference-stable
function updateStatus(rowIndex: number, newStatus: string) {
  rows[rowIndex] = { ...rows[rowIndex], status: newStatus }
  // rows[rowIndex] is a new reference
  // rows[0], rows[1], ... rows[rowIndex - 1], rows[rowIndex + 1] etc. are unchanged
}

// Adding a row at the end
function addRow(row: Row) {
  rows.push(row)
  // existing references are untouched
}

// Removing a row by index
function removeRow(rowIndex: number) {
  rows.splice(rowIndex, 1)
  // in-place mutation - existing references above the splice point are stable
}
```

Contrast with the pattern that looks similar but kills reference stability:

```ts
// This replaces every row reference even though only one changed
rows = rows.map((r, i) => i === rowIndex ? { ...r, status: newStatus } : { ...r })
//                                                                          ^^^^^^^
//                                                                  pointless new objects
```

The version above is doubly wrong: it rebuilds untouched rows as new objects, and it does a full reassignment, so the grid sees every row as changed.

## Updating nested fields

Nested objects need the same care. Copy along the path you're changing, not the entire tree:

```ts
type Order = {
  id: number
  customer: { name: string; email: string }
  items: { sku: string; qty: number }[]
  total: number
}

let orders = $state<Order[]>([])

// Change just the customer email
function updateEmail(orderIndex: number, newEmail: string) {
  orders[orderIndex] = {
    ...orders[orderIndex],
    customer: {
      ...orders[orderIndex].customer,
      email: newEmail,
    },
  }
  // orders[orderIndex].items references are preserved
  // other orders are untouched
}

// Add an item to a specific order
function addItem(orderIndex: number, item: { sku: string; qty: number }) {
  orders[orderIndex] = {
    ...orders[orderIndex],
    items: [...orders[orderIndex].items, item],
  }
}
```

The guiding principle: new reference only at the level you changed and every ancestor up to the root array. Siblings and unrelated branches stay the same.

## Using the grid's transaction API

For bulk mutations - adding, updating, and removing multiple rows at once - the `applyTransaction` method is the right tool. It handles all the reference bookkeeping internally:

```ts
import SvGrid, {
  type ColumnDef,
  type SvGridApi,
  tableFeatures,
  rowSelectionFeature,
  columnFilteringFeature,
} from '@svgrid/grid'

let api: SvGridApi | null = null

const features = tableFeatures({ rowSelectionFeature, columnFilteringFeature })

const columns: ColumnDef<typeof features, Order>[] = [
  { id: 'id', field: 'id', header: 'ID', width: 80 },
  { id: 'customer', field: 'customer.name', header: 'Customer', width: 200 },
  { id: 'total', field: 'total', header: 'Total', width: 120, type: 'number' },
  { id: 'status', field: 'status', header: 'Status', width: 120 },
]

// Sync result of a server action back into the grid
async function syncFromServer() {
  const diff = await fetchPendingChanges()

  api?.applyTransaction({
    add: diff.created,
    update: diff.updated,   // matched by row identity
    remove: diff.deleted,   // removes by id
  })
}
```

`applyTransaction` is designed to be called frequently - after websocket messages, polling intervals, or optimistic UI rollbacks. It processes only what changed rather than replacing the whole dataset.

## Pitfalls worth knowing

**Shared object references across rows.** If two rows point to the same nested object and you mutate it directly, both rows appear changed. Clone when you need independence:

```ts
// If importing from an API that reuses objects across records, clone on intake
let rows = $state(apiResponse.map(r => ({ ...r, meta: { ...r.meta } })))
```

**External non-reactive data.** Arrays from props or stores are not automatically proxied. Assign them into `$state` to make updates trackable:

```ts
// Not reactive - changes to externalData don't propagate
let rows = externalData

// Reactive - subsequent mutations on rows are tracked
let rows = $state([...externalData])
```

**`$state.raw` for large stable datasets.** If you have a large array that you always replace wholesale (never mutate in place), `$state.raw` skips the proxy overhead and can be significantly faster. The tradeoff is that in-place mutations are not tracked at all:

```ts
// Replace the array to trigger an update; in-place mutations are invisible
let rows = $state.raw<Row[]>([])

function refresh(newData: Row[]) {
  rows = newData  // new reference - triggers update
  rows.push(x)   // silent - won't update
}
```

Use `$state.raw` only when your data flow is clearly replace-only - server-side pagination is the typical case.

## The mental model that holds up

Think of your data as a tree. When you change a node, you need a new reference for that node and every node from it back to the root. Everything else - siblings, cousins, the other subtrees - should keep its existing reference.

That rule keeps downstream components, selection state, and the grid's own diffing from treating unrelated data as changed. Svelte 5 gives you the flexibility to mutate in place, but for list-backed state that feeds into a grid, the discipline of surgical immutable updates pays for itself quickly once your datasets grow past a few hundred rows.
