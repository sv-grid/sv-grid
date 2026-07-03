---
title: Column Virtualization Explained
description: Row virtualization is well understood, but wide grids expose a second bottleneck. Here is how column virtualization works, when you actually need it, and what trade-offs to expect.
date: 2026-07-12
updated: "2026-07-02"
category: Concepts
tags: virtualization, columns, performance, concepts, data grid
author: Kamelia M
---

Row virtualization gets most of the press, but if you have ever tried to render a financial model or a pivot-style report with 80 or 100 columns, you already know: rows are not the whole story.

![A large dataset in SvGrid rendered with both row and column virtualization active.](/blog-media/large-dataset.png)
*A large dataset in SvGrid. Only the cells inside the viewport are in the DOM.*

## DOM cost is rows times columns

Think of a grid's DOM footprint as a multiplication problem: visible rows times visible columns. Row virtualization solves one factor. If you have 100,000 rows and 5 columns, you cap the row count at maybe 30 and the total cell count stays around 150. Done.

Now flip it: 500 rows and 100 columns. Even with row virtualization, every visible row renders 100 cells. At 30 visible rows that is 3,000 cells, most of them off-screen to the right. Browsers handle 3,000 cells, but style recalculations, layout, and event listeners scale with the count. Push it to 200 columns and the number doubles again.

Column virtualization solves the second factor. Only the columns currently visible in the horizontal viewport are rendered - typically 10 to 15 out of 100. The cell count drops from 3,000 to maybe 450, and it stays there no matter how far right you scroll.

## How the math works in practice

SvGrid tracks each column's pixel offset as you scroll. When the left edge of a column exceeds `scrollLeft + viewportWidth`, that column is not rendered. When a hidden column's right edge comes back into view, it is added. A small overscan buffer (a few columns on each side) prevents flicker during fast scrolls.

For variable-width columns, the grid maintains a cumulative offset array so it can do a binary search to find the first visible column in O(log n) time rather than scanning left to right on every scroll event. That is why column virtualization is cheap even with columns of different widths.

You can observe this directly: open DevTools, inspect the grid's cell rows, and scroll horizontally. You will see `<td>` elements appearing and disappearing at the edges rather than the full 100 columns sitting in the DOM at once.

## Enabling it in SvGrid

Column virtualization is on by default when the grid has a bounded width. You do not configure it separately from row virtualization - both axes are covered by the same `virtualization` prop.

```svelte
<script>
  import SvGrid from '@svgrid/grid'
  import type { ColumnDef } from '@svgrid/grid'

  // 100 columns, lots of data
  const columns: ColumnDef[] = Array.from({ length: 100 }, (_, i) => ({
    id: `col${i}`,
    field: `col${i}`,
    header: `Metric ${i + 1}`,
    width: 120,
    type: i > 0 ? 'number' : 'string',
  }))

  const data = Array.from({ length: 5000 }, (_, row) =>
    Object.fromEntries(columns.map(c => [c.field, row * 100 + Math.random()]))
  )
</script>

<!-- Grid has a bounded width via its container; both axes virtualize automatically -->
<div style="width: 100%; height: 600px;">
  <SvGrid
    {data}
    {columns}
    virtualization={true}
    rowHeight={32}
  />
</div>
```

The important part is that the grid's container has a defined size. Without a bounded width or height, the browser would never create a scrollable viewport and virtualization would not fire.

## Pinned columns are always rendered

Pinned (frozen) columns are always in the DOM because they are always visible. They sit outside the horizontal scroll container entirely. Only the scrollable middle section virtualizes.

```svelte
<script>
  import SvGrid from '@svgrid/grid'
  import type { ColumnDef } from '@svgrid/grid'

  const columns: ColumnDef[] = [
    // These two are always rendered - they are pinned
    { id: 'id',   field: 'id',   header: 'ID',   width: 60,  pinned: 'left' },
    { id: 'name', field: 'name', header: 'Name', width: 160, pinned: 'left' },

    // These 96 columns virtualize as you scroll right
    ...Array.from({ length: 96 }, (_, i) => ({
      id: `m${i}`,
      field: `m${i}`,
      header: `Q${i + 1}`,
      width: 100,
      type: 'number' as const,
    })),

    // Pinned right is also always rendered
    { id: 'total', field: 'total', header: 'Total', width: 120, pinned: 'right', type: 'number' },
  ]
</script>

<div style="width: 100%; height: 500px;">
  <SvGrid {data} {columns} virtualization={true} rowHeight={32} />
</div>
```

The pinned columns on the left and right stay put. The 96 metric columns in the middle are what the virtualizer manages. This is the right design: pinned columns exist precisely because users need them visible at all times, so hiding them would defeat the point.

## What breaks, and what merely looks like it breaks

**Find-in-page (Ctrl+F)** only searches the live DOM. Off-screen columns are not in the DOM, so their content will not be matched by the browser's built-in search. SvGrid's own find feature (`api.openFind()`) operates on the data layer, not the DOM, so it finds matches in hidden columns correctly.

**Colspan cells** need special handling. If a cell spans multiple columns and some of those columns are currently virtualized away, the grid has to decide what to render. SvGrid's cell merging feature handles this by always rendering a spanning cell if any part of its range is visible, even if some covered columns are off-screen.

**Measuring column widths for autosize** requires the content to be rendered. SvGrid's `api.autosizeAllColumns()` temporarily forces all columns into the DOM, measures text width, then restores virtualization. This is a one-time cost and happens off the critical path.

```svelte
<script>
  import SvGrid from '@svgrid/grid'
  import type { SvGridApi } from '@svgrid/grid'

  let api: SvGridApi

  function handleReady(readyApi: SvGridApi) {
    api = readyApi
  }

  async function autosizeAll() {
    // Temporarily renders all columns, measures, then re-virtualizes
    await api.autosizeAllColumns()
  }
</script>

<div style="width: 100%; height: 500px;">
  <SvGrid
    {data}
    {columns}
    virtualization={true}
    rowHeight={32}
    onApiReady={handleReady}
  />
</div>

<button onclick={autosizeAll}>Fit columns</button>
```

## When you do not need it

Column virtualization adds a tiny amount of scroll-event overhead (the offset bookkeeping). For grids with 20 or fewer columns, the overhead is not worth anything - just render all columns. SvGrid applies virtualization only when it makes sense based on column count, so you generally do not have to think about the threshold.

The practical rule: if your grid scrolls horizontally and has more than 30-40 columns, column virtualization is keeping things fast. If it fits in the viewport without horizontal scrolling, it is a non-issue either way.

## Combining with server-side data

Column virtualization is a pure client-side concern. It does not affect how data is fetched. A server-side data source still returns full row objects; the grid just renders a subset of the fields. This is different from column-level server-side fetching (where you only request the fields currently visible), which is a separate, more advanced pattern SvGrid does not require.

```svelte
<script>
  import SvGrid from '@svgrid/grid'
  import { createServerDataSource } from '@svgrid/grid'
  import type { ColumnDef } from '@svgrid/grid'

  const ds = createServerDataSource({
    fetch: async ({ page, pageSize, sort, filters }) => {
      const params = new URLSearchParams({
        page: String(page),
        size: String(pageSize),
      })
      const res = await fetch(`/api/report?${params}`)
      const json = await res.json()
      // Server returns full rows; client renders only visible columns
      return { rows: json.data, total: json.total }
    },
  })

  const columns: ColumnDef[] = [
    { id: 'name',    field: 'name',    header: 'Name',    width: 160, pinned: 'left' },
    { id: 'region',  field: 'region',  header: 'Region',  width: 120 },
    ...Array.from({ length: 60 }, (_, i) => ({
      id: `kpi${i}`,
      field: `kpi${i}`,
      header: `KPI ${i + 1}`,
      width: 100,
      type: 'number' as const,
    })),
  ]
</script>

<div style="width: 100%; height: 600px;">
  <SvGrid
    data={ds}
    {columns}
    pageable
    virtualization={true}
    rowHeight={32}
  />
</div>
```

Row virtualization and column virtualization stack multiplicatively. The same grid without either would render thousands of cells; with both active it renders a small, constant slice of the data regardless of how large the dataset grows.
