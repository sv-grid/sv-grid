---
title: Virtual Scrolling Explained
description: A practical look at how windowed rendering keeps large grids fast, what makes it break, and how to verify it's actually working.
date: 2026-06-17
updated: "2026-07-02"
category: Concepts
tags: virtualization, performance, concepts, data grid
author: Victor Vidolov
---

Render 10 rows or render 100,000 rows - with virtual scrolling, the per-frame work is almost identical. That is the whole point, and it is the single biggest performance technique available to any data grid.

Most grids call this "virtualization." You might also see "windowing." Either way, the mechanism is the same: maintain a sliding window of DOM nodes that covers only the visible portion of the list, and recycle those nodes as the user scrolls. The dataset lives in memory as plain JavaScript objects. The DOM stays small.

## Why the DOM is the bottleneck

A hundred thousand rows of data as a JavaScript array is maybe 20MB. Fine. That same data rendered as `<tr>` elements with cells, text nodes, and event listeners is something else entirely. Browsers maintain the full layout tree for every node in the document. Scrolling triggers reflow. Interaction triggers hit testing across all those nodes.

In practice: a naive table with 50,000 rows takes several seconds to mount, scrolls at single-digit frames per second, and makes the browser's memory usage climb well past what the raw data warrants. The table is not slow because your data is large - it is slow because the DOM is large.

Virtualization fixes the DOM size. It does not fix slow data fetching, heavy cell rendering, or poorly structured state - those are separate problems. But eliminating the DOM cost is usually the first and largest win.

## The math behind the window

Given three numbers - the scroll position, the row height, and the viewport height - a virtualizer can determine exactly which row indices are visible:

```
firstVisible = Math.floor(scrollTop / rowHeight)
lastVisible  = Math.ceil((scrollTop + viewportHeight) / rowHeight)
```

Only those rows get rendered. The virtualizer adds a small buffer above and below (typically a few rows) to prevent flicker at fast scroll speeds. Everything else is represented by empty space - a `padding-top` or `translateY` offset that makes the scrollbar reflect the true content height without the DOM nodes to back it.

With uniform row heights this is O(1): any scroll position maps instantly to a row index. That is why fixed `rowHeight` is the fast path.

```svelte
<SvGrid
  {data}
  {columns}
  rowHeight={36}
  virtualization={true}
  style="height: 600px"
/>
```

The `rowHeight` and a bounded container height are the two requirements. Miss either one and virtualization cannot engage.

## Variable heights and why they cost more

Rows that expand to show detail panels, or cells that wrap text, break the uniform-height assumption. The virtualizer now needs to know the actual height of each rendered row to compute offsets correctly. That means measuring DOM nodes, storing per-row height records, and computing prefix sums to answer "what is the Y position of row 47,832?"

It is still fast - modern virtualizers handle variable heights well - but the implementation is meaningfully more complex. Each scroll event may require a binary search through the offset array rather than a multiplication.

The practical advice: keep rows a fixed height wherever possible. Push variable content (expanded detail, embedded charts, multi-line descriptions) into expandable rows rather than inline. You get the O(1) path for the common case and variable heights only where they are actually needed.

```svelte
<script lang="ts">
  import SvGrid from '@svgrid/grid'
  import type { ColumnDef } from '@svgrid/grid'

  const columns: ColumnDef[] = [
    { id: 'name',     field: 'name',     header: 'Name',     width: 200 },
    { id: 'category', field: 'category', header: 'Category', width: 140 },
    { id: 'revenue',  field: 'revenue',  header: 'Revenue',  width: 120, type: 'number' },
    { id: 'status',   field: 'status',   header: 'Status',   width: 100 },
  ]
</script>

<div style="height: 500px; display: flex; flex-direction: column;">
  <SvGrid
    {data}
    {columns}
    rowHeight={36}
    virtualization={true}
    sortable
    filterable
  />
</div>
```

The flex container with a defined height is the most reliable way to give the grid a bounded viewport. Without it, the grid expands to fit its content and virtualization has nothing to work with.

## The recycling step

A virtualizer does not just skip off-screen rows - it recycles the DOM nodes. When you scroll down and row 0 leaves the viewport, its DOM node does not get destroyed. It gets reassigned to render row 80 (or wherever the bottom of the window now lands). The component updates its data bindings and the node appears at the new position.

This recycling is where framework-specific virtualizers earn their keep. Svelte's reactivity makes reassigning a node's data cheap and predictable. The snippet or component bound to a cell column updates its props and Svelte renders only what changed. No virtual DOM diffing, no teardown-remount cycle.

Where recycling gets tricky: focus management and animation state. If a user focuses a cell in row 5 and then fast-scrolls away, row 5's DOM node may be reassigned. SvGrid tracks active cell state separately and restores focus correctly when the node comes back into view. If you build a custom cell that maintains its own internal animation state, you need to be aware that the component instance may be reused for a different row.

## Confirming virtualization is active

The browser's DevTools will tell you immediately. Open the Elements panel and count the `<tr>` (or equivalent) nodes while the grid is mounted. With 50,000 rows and virtualization on, you should see something like 20 to 40 row nodes regardless of dataset size. Scroll to the bottom - the count stays flat.

The Performance panel is the other tool. Record a few seconds of scrolling and look at frame timing. With virtualization working correctly, each frame should be short and consistent. A sawtooth pattern of long frames usually points to a height problem (the virtualizer is not engaged) or expensive per-cell work firing on every scroll event.

```svelte
<script lang="ts">
  import SvGrid from '@svgrid/grid'
  import { createServerDataSource } from '@svgrid/grid'
  import type { SvGridApi } from '@svgrid/grid'

  let api: SvGridApi | undefined = $state()

  // Server-side source - virtualization still applies to the rendered window
  const ds = createServerDataSource({
    fetch: async ({ page, pageSize, sort, filters }) => {
      const res = await fetch(`/api/records?page=${page}&size=${pageSize}`)
      const json = await res.json()
      return { rows: json.data, total: json.total }
    }
  })

  const columns = [
    { id: 'id',       field: 'id',       header: 'ID',       width: 80 },
    { id: 'name',     field: 'name',     header: 'Name',     width: 200 },
    { id: 'email',    field: 'email',    header: 'Email',    width: 240 },
    { id: 'created',  field: 'created',  header: 'Created',  width: 140, type: 'date' },
    { id: 'balance',  field: 'balance',  header: 'Balance',  width: 120, type: 'number' },
  ]
</script>

<div class="grid-wrapper">
  <SvGrid
    data={ds}
    {columns}
    rowHeight={36}
    virtualization={true}
    pageable
    sortable
    filterable
    onApiReady={(a) => { api = a }}
  />
</div>

<style>
  .grid-wrapper {
    height: 600px;
    display: flex;
    flex-direction: column;
  }
</style>
```

Server-side pagination and virtualization are complementary, not competing. Pagination controls how much data you fetch; virtualization controls how much of that fetched data you render. With server-side data sources you typically paginate at a few thousand rows per page, and the virtualizer handles rendering within that page. For fully client-side data (all rows in memory), virtualization alone can handle hundreds of thousands of rows without pagination.

## Where virtualization will not save you

Virtualization makes the rendered set small. It does not make slow operations fast. Three things that still bite you after virtualization is working:

**Heavy cell renderers.** A custom cell that runs a complex computation or renders a rich component fires for every visible cell on every update. If your viewport shows 30 rows and 8 columns, that is 240 cell renders per scroll event. Keep cell renderers cheap. Move heavy logic upstream and pass a pre-computed value as the cell's `value` prop.

**Recreating data arrays.** If your data source produces a new array of new objects on each tick, the grid's change detection has to reconsider everything. Pass stable references where possible, or use `api.applyTransaction()` to describe precise changes rather than replacing the whole dataset.

**Uncontrolled filter/sort on huge sets.** Sorting 500,000 rows in a single synchronous pass will block the main thread regardless of how few rows you render. For datasets above roughly 100,000 rows, move sorting and filtering to a web worker or to the server.

Virtualization is necessary for large-grid performance, but it is not sufficient on its own. It handles the rendering bottleneck; you still need to manage the data and computation sides separately.
