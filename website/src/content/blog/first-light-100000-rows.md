---
title: First Light - Pointing SvGrid at 100,000 Rows
description: When we first fed SvGrid a hundred thousand rows, we were testing more than performance - we were testing whether building native on Svelte 5 runes was the right call from the start.
date: 2026-07-30
updated: "2026-07-02"
category: Company
tags: company, story, performance, virtualization
author: Kamelia M
---

The first version of SvGrid that could render data at all was pointing at an array of three rows. That proves the component tree compiles. It proves nothing about your architecture.

So we did what you have to do eventually: we generated a hundred thousand rows, dropped them in, and watched the browser profile.

![SvGrid inline editor types.](/blog-media/editor-types.png)
*SvGrid rendering with real data volumes.*

## The question we were actually asking

Performance at scale is a proxy question. What we were really asking was: did we make the right foundational bets? Specifically two of them.

The first bet was virtualization from day one. Not as an optimization we would add later, but as a constraint the engine was built around from the beginning. No part of the rendering path should ever assume a full-data pass.

The second bet was Svelte 5 runes as the reactivity layer, before runes were even stable. The idea was that fine-grained reactivity at the cell level would mean updates stay surgical regardless of dataset size. One cell changes, one cell repaints - not a grid-wide reconciliation triggered by a single field mutation.

Both bets were theoretical until we had a hundred thousand rows to test them on.

## Setting up the test

The setup was deliberately plain. A flat array of 100,000 generated objects, realistic field types, no server side data source, no pagination. Just the component in a bounded container with a large dataset.

```svelte
<script lang="ts">
  import SvGrid from '@svgrid/grid'
  import { tableFeatures, rowSortingFeature, columnFilteringFeature } from '@svgrid/grid'
  import type { ColumnDef } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  // 100,000 rows, generated
  const data = $state(
    Array.from({ length: 100_000 }, (_, i) => ({
      id: i,
      name: `Row ${i}`,
      category: ['Alpha', 'Beta', 'Gamma'][i % 3],
      value: Math.round(Math.random() * 10_000),
      active: i % 4 !== 0,
    }))
  )

  const columns: ColumnDef<typeof features, (typeof data)[number]>[] = [
    { id: 'id',       field: 'id',       header: 'ID',       width: 80 },
    { id: 'name',     field: 'name',     header: 'Name',     width: 180 },
    { id: 'category', field: 'category', header: 'Category', width: 120 },
    { id: 'value',    field: 'value',    header: 'Value',    width: 100, type: 'number' },
    { id: 'active',   field: 'active',   header: 'Active',   width: 80  },
  ]
</script>

<div style="height: 600px;">
  <SvGrid {data} {columns} sortable virtualization={true} />
</div>
```

The `height: 600px` on the wrapper is not incidental. It is load-bearing. Without a bounded height, the grid cannot calculate the viewport, and without a viewport, virtualization has nothing to work with. That single omission is the most common reason someone reports that a large dataset is slow - the grid is rendering all hundred thousand rows because nothing told it what "visible" means.

## What we saw

Scrolling was smooth. Frame time stayed low. The DOM node count in the Elements panel sat at roughly the same number whether we were at row 0 or row 99,999 - a few hundred nodes for the visible window plus overscan, not a hundred thousand.

That is the whole point of row virtualization: DOM size tracks viewport size, not dataset size. The engine renders what is visible, discards what leaves the window, and reuses the nodes for incoming rows rather than creating new ones. Ten rows or a hundred thousand rows, the same handful of elements do the work.

Sorting the full hundred thousand rows by value took a moment on the first trigger - you are sorting 100k objects in JavaScript, that is not free. But the sorted render came back fast, because displaying the sorted result is still just showing the viewport window.

## Where runes changed the story

The virtualization result was expected. The runes result was the one that mattered more for how we would build everything else.

We triggered a mutation: a single `value` field on one row, deep in the dataset.

```svelte
<script lang="ts">
  import SvGrid from '@svgrid/grid'
  import { tableFeatures } from '@svgrid/grid'
  import type { SvGridApi } from '@svgrid/grid'

  const features = tableFeatures({})
  const data = $state(generateRows(100_000))

  let api: SvGridApi<typeof features> | undefined

  function updateOneRow() {
    // Mutate in place - runes track this at the field level
    data[49_999].value = 9999
  }
</script>

<SvGrid
  {data}
  columns={columns}
  onApiReady={(a) => { api = a }}
/>

<button onclick={updateOneRow}>Update row 50,000</button>
```

On an older reactivity model - one that tracks arrays as a whole - mutating `data[49999].value` would signal that the entire array changed. The framework would reconcile from scratch. With a hundred thousand rows, that is expensive even with virtualization, because the derived state (sort order, filter matches, display values) all has to be recomputed.

With runes, the mutation is tracked at the property level. Only the derived state that reads `data[49999].value` becomes stale. The rest of the hundred thousand rows, and all their derived values, are untouched. The repaint is one cell.

The practical consequence: you can drive a live-updating grid with frequent field mutations without batching tricks, debounce wrappers, or immutable update patterns. Mutate in place, let runes sort out the rest.

## Stable references and the one mistake worth avoiding

There is one pattern that defeats both of these wins at once.

```svelte
<script lang="ts">
  // DON'T do this on a timer or in response to every event:
  let data = $state(rows)

  function refreshData() {
    // Replacing the whole array reference forces a full re-evaluation.
    // At 100k rows this is noticeable.
    data = generateRows(100_000)  // <-- new reference every time
  }

  // DO this instead - mutate the existing array/objects:
  function updateField(index: number, newValue: number) {
    data[index].value = newValue  // runes tracks this surgically
  }

  // Or use applyTransaction for bulk changes via the API:
  function bulkUpdate(changes: { index: number; value: number }[]) {
    api?.applyTransaction({
      update: changes.map(({ index, value }) => ({ ...data[index], value }))
    })
  }
</script>
```

Replacing the whole data reference on a polling interval is the primary way to make a large grid feel sluggish even when everything else is right. The grid sees a new array, considers all row identity lost, and rebuilds. Mutating in place costs almost nothing because runes see exactly what changed.

## What the test actually validated

Running a hundred thousand rows was not a milestone to mark on a roadmap. It was a diagnostic for whether the architecture was sound enough to build the rest of the product on.

Virtualization holding at scale meant features like grouping, master-detail rows, and tree data would not break the DOM budget when the data got large. Runes staying surgical meant inline editing, live server updates, and collaborative editing would be viable without heroic optimization work.

The features in the grid today - sorting, filtering, grouping, aggregation, server-side data, pivot, cell editing, undo/redo - all stand on that architecture. None of them required revisiting the foundation because the foundation held.

That is what first light means in practice: not that the thing looks good, but that you can trust what you built on.
