---
title: Stable Row Identity in SvGrid (and why it matters)
description: How SvGrid tracks rows across mutations, why object reference stability is the key to correct selection and editing, and the exact patterns to use with live data feeds.
date: 2026-09-08
updated: "2026-07-02"
category: Performance
tags: performance, identity, getrowid, selection, recipe
author: Kamelia M
---

Row selection that vanishes on refresh. An edit that commits to the wrong record. A filter that resets because the grid thinks the entire dataset changed. These bugs share a single root cause: the grid lost track of which row is which.

SvGrid tracks rows by object reference at the render layer. This is the correct default for Svelte 5, where fine-grained reactivity is also reference-based. But it means you, as the app author, are responsible for one thing: when a row's data changes, replace only that row's object - not the entire array, and not neighboring rows that happen to be nearby in a `.map()`.

## Why object identity is the wrong mental model until you understand it

Most people who hit this bug for the first time have written something like this:

```ts
// Fetches a fresh snapshot every 2 seconds
async function refresh() {
  const fresh = await fetch('/api/orders').then(r => r.json())
  rows = fresh  // entire array replaced
}
```

That works fine for a read-only table. The problem emerges the moment the user does anything stateful: selects a row, starts an inline edit, expands a group. After the next refresh, `rows` points to a brand-new array full of brand-new objects. The grid sees no surviving references, so it tears down and rebuilds everything. Selections are gone. The open editor is gone. Any scroll position held by the virtualizer may also reset.

The fix is not a special API call or a grid option. It is data hygiene: produce new object references only where the data actually changed.

## Surgical mutation with a Map index

The pattern that solves this at any scale is a `Map` from row id to array index, updated once at load time and maintained incrementally as rows are added or removed. Each incoming patch touches exactly the slots that changed.

```svelte
<script lang="ts">
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    rowSelectionFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type OrderStatus = 'open' | 'processing' | 'shipped' | 'closed' | 'cancelled'
  type Order = {
    id: string
    customer: string
    product: string
    qty: number
    total: number
    status: OrderStatus
  }

  // The rows array - each object keeps its reference for its lifetime
  let rows = $state<Order[]>([])

  // O(1) lookup: id -> current index in rows[]
  // Rebuilt only when rows are inserted or deleted, not on field updates
  let indexById = $derived(new Map(rows.map((r, i) => [r.id, i])))

  const features = tableFeatures({
    rowSortingFeature,
    rowSelectionFeature,
    columnFilteringFeature,
  })

  const columns: ColumnDef<typeof features, Order>[] = [
    { id: 'id',       field: 'id',       header: 'Order',    width: 110 },
    { id: 'customer', field: 'customer', header: 'Customer', width: 150 },
    { id: 'product',  field: 'product',  header: 'Product',  width: 160 },
    { id: 'qty',      field: 'qty',      header: 'Qty',      width: 80,  type: 'number' },
    { id: 'total',    field: 'total',    header: 'Total',    width: 110, type: 'number' },
    { id: 'status',   field: 'status',   header: 'Status',   width: 130 },
  ]

  let api = $state<SvGridApi | null>(null)

  // Applies a batch of status+total patches from a live feed
  // without disturbing the objects for rows that were not in the patch
  function applyPatches(patches: Array<{ id: string; status: OrderStatus; total?: number }>) {
    for (const patch of patches) {
      const idx = indexById.get(patch.id)
      if (idx === undefined) continue

      // Replace only the affected slot with a new object
      rows[idx] = {
        ...rows[idx]!,
        status: patch.status,
        ...(patch.total !== undefined ? { total: patch.total } : {}),
      }
    }
  }

  $effect(() => {
    // Simulate a live feed: 1-4 patches every 600 ms
    const timer = setInterval(() => {
      if (rows.length === 0) return
      const patchCount = 1 + Math.floor(Math.random() * 4)
      const patches = Array.from({ length: patchCount }, () => {
        const row = rows[Math.floor(Math.random() * rows.length)]!
        return { id: row.id, status: 'processing' as OrderStatus }
      })
      applyPatches(patches)
    }, 600)
    return () => clearInterval(timer)
  })
</script>

<SvGrid
  {features}
  {columns}
  data={rows}
  rowSelection="multiple"
  sortable
  filterable
  onApiReady={(a) => (api = a)}
/>
```

With 200 rows and 4 patches per tick at 600 ms intervals, this approach creates 4 new objects per tick. The "rebuild the whole array" approach creates 200. That ratio stays constant as the dataset grows - the overhead for the patch approach is proportional to the number of changed rows, not the total row count.

## Keeping selection correct across updates

Selection is where stable identity matters most in practice. SvGrid's selection state internally holds references to row objects. When a row gets a new object reference - even if its id is the same - the old reference is no longer in the selection set.

For most live feeds, the right pattern is to snapshot selected ids before patching and restore them after, using the stable ids from your data source rather than the object references themselves:

```ts
function applyPatchesWithSelection(
  patches: Array<{ id: string; status: OrderStatus }>
) {
  if (!api) return

  // Capture which ids were selected before any mutation
  const selectedIds = new Set(api.getSelectedRows().map((r) => r.id))

  for (const patch of patches) {
    const idx = indexById.get(patch.id)
    if (idx === undefined) continue
    rows[idx] = { ...rows[idx]!, status: patch.status }
  }

  // Re-select by matching the fresh row objects to the saved ids
  if (selectedIds.size > 0) {
    const toSelect = rows.filter((r) => selectedIds.has(r.id))
    api.selectRows(toSelect)
  }
}
```

This round-trip is cheap. `getSelectedRows()` returns only the selected subset, not the full dataset. `selectRows()` does an O(k) set update where k is the selection size - typically under 50 rows in any realistic UI. The correctness payoff is total: users can select rows, trigger a bulk action, and watch the feed continue updating without losing their context.

## What breaks without this and how to recognize it

Three failure modes surface when object identity is unstable:

**Selection drifts or vanishes.** The user selects row A and row B. The feed fires. Both rows now have new object references. The grid's internal set no longer matches either reference. Selection is empty. This is the most visible bug and the one users file tickets about.

**Inline editors close unexpectedly.** An open cell editor is bound to a specific row object. When that object is replaced, the editor's binding target no longer exists in the rendered tree. The editor unmounts. The user's in-progress edit is lost silently.

**Unnecessary re-renders slow the UI.** Even if nothing visually changes, creating 200 new objects per tick means Svelte's diffing pass has to evaluate all 200 rows. In a virtualized grid showing 30 rows at a time, that work is invisible until it isn't - usually at around 5,000 total rows with a fast feed, where the accumulated cost starts producing frame drops.

## Inserting and removing rows

Adding and removing rows is simpler than patching - you do not need to worry about preserving a reference, because there is no prior reference to preserve. The `indexById` map derived from `rows` handles the remapping automatically since `$derived` recomputes on any state change to `rows`.

```ts
// Add a new row - just push; the derived map handles the index
function addOrder(order: Order) {
  rows = [...rows, order]
}

// Remove a row by id
function removeOrder(id: string) {
  rows = rows.filter((r) => r.id !== id)
}
```

After a removal, `indexById` recomputes. Any subsequent patch for a removed id will hit `indexById.get(id) === undefined` and be skipped cleanly. No manual cleanup needed.

For server-driven inserts via `applyTransaction`, the same principle holds - pass the new row objects directly and let the grid handle placement:

```ts
// Alternative: use the imperative API for transactional updates
api?.applyTransaction({
  add: [newOrder],
  update: [{ ...existingOrder, status: 'shipped' }],
  remove: [{ id: 'ORD-10042' }],
})
```

## The `$derived` map versus a manually maintained `Map`

Using `$derived` for `indexById` is the safer choice for most apps because it is always correct after any mutation to `rows`. The tradeoff is that it runs `rows.map()` on every state change, including patches that only replace a few slots. For 200 rows that is negligible. For 50,000 rows with very frequent patches, you may want to maintain the map manually: update it inside `applyPatches` only when an index actually changes, and rebuild it fully only after add/remove operations.

For most real apps - live dashboards, order boards, monitoring feeds - the `$derived` version is the right starting point. Optimize only if profiling shows the map rebuild is on the critical path.

The demos at `/demos/116-websocket-live-updates` and `/demos/149-realtime-collaboration` show both approaches in working code alongside `createCollaboration` and `broadcastChannelTransport` for multi-user scenarios where the same row can be patched by two clients simultaneously.
