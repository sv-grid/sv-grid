---
title: What Is a Row Model in a Data Grid?
description: The row model is the pipeline that transforms raw data into what the grid actually renders. Understanding it is the difference between debugging confidently and guessing.
date: 2026-09-22
updated: "2026-07-02"
category: Concepts
tags: row model, concepts, data grid, architecture
author: Kamelia M
---

Picture this: you feed 5,000 rows into SvGrid, apply a filter and a sort, and then call `api.getDisplayedRows()`. It returns 23. You call `api.getData()`. It returns 5,000. Both numbers are correct - they are just measuring different points in the same pipeline.

That pipeline is the row model, and understanding it makes a lot of otherwise-confusing grid behavior click into place immediately.

## Four stages, one fixed sequence

The row model is a chain of transformations. Raw data enters at one end; the rendered rows come out the other. The sequence is always:

```
data -> filter -> sort -> group -> paginate -> displayed rows
```

The order is not arbitrary. Filtering always runs first so sorting never wastes cycles on rows that will be hidden anyway. Grouping runs after sort so group buckets are built from already-ordered rows. Pagination is always last because it slices the final visible set, not some intermediate one.

Each stage is opt-in. When you declare features with `tableFeatures(...)`, you are explicitly enrolling pipeline stages. Skip `rowPaginationFeature` and that stage becomes a no-op pass-through - rows flow through unchanged.

```ts
import {
  tableFeatures,
  rowSortingFeature,
  columnFilteringFeature,
  rowPaginationFeature,
  columnGroupingFeature,
} from '@svgrid/grid'

// This wires all four stages into the pipeline.
const features = tableFeatures({
  columnFilteringFeature,   // stage 1: filter
  rowSortingFeature,        // stage 2: sort
  columnGroupingFeature,    // stage 3: group
  rowPaginationFeature,     // stage 4: paginate
})

// Omit any feature and that stage becomes a pass-through.
// The pipeline still runs; it just hands rows through unchanged at that step.
const featuresNoGroup = tableFeatures({
  columnFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
})
```

Nothing in the pipeline touches your source array. The row model builds a view of your data, never a replacement for it. `api.getData()` always returns the original array, regardless of what filters or sorts are active.

## Watching the pipeline in action

The clearest way to build intuition here is to wire up all four stages, make some API calls, and observe both ends of the pipeline at the same time.

```svelte
<script lang="ts">
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Deal = {
    id: number
    company: string
    region: string
    rep: string
    arr: number
    stage: string
  }

  const deals: Deal[] = [
    { id: 1,  company: 'Acme',      region: 'AMER', rep: 'Ada Lovelace',     arr: 482000,   stage: 'Won' },
    { id: 2,  company: 'Globex',    region: 'EMEA', rep: 'Linus Torvalds',   arr: 218000,   stage: 'Negotiation' },
    { id: 3,  company: 'Initech',   region: 'APAC', rep: 'Grace Hopper',     arr: 94000,    stage: 'Proposal' },
    { id: 4,  company: 'Umbrella',  region: 'AMER', rep: 'Donald Knuth',     arr: 615000,   stage: 'Won' },
    { id: 5,  company: 'Vandelay',  region: 'EMEA', rep: 'Tim Berners-Lee',  arr: 162000,   stage: 'Discovery' },
    { id: 6,  company: 'Pied P.',   region: 'APAC', rep: 'Linda Petersen',   arr: 47000,    stage: 'Won' },
    { id: 7,  company: 'Hooli',     region: 'AMER', rep: 'Sven Andersson',   arr: 1102000,  stage: 'Negotiation' },
    { id: 8,  company: 'Wonka',     region: 'EMEA', rep: 'Yuki Tanaka',      arr: 305000,   stage: 'Won' },
    { id: 9,  company: 'Tyrell',    region: 'APAC', rep: 'Mei Chen',         arr: 72000,    stage: 'Proposal' },
    { id: 10, company: 'Stark',     region: 'AMER', rep: 'Raj Patel',        arr: 858000,   stage: 'Won' },
    { id: 11, company: 'Wayne',     region: 'EMEA', rep: 'Anders Hejlsberg', arr: 411000,   stage: 'Negotiation' },
    { id: 12, company: 'Cyberdyne', region: 'APAC', rep: 'Jin Park',         arr: 188000,   stage: 'Discovery' },
  ]

  const features = tableFeatures({
    columnFilteringFeature,
    rowSortingFeature,
    rowPaginationFeature,
  })

  const columns: ColumnDef<typeof features, Deal>[] = [
    { field: 'id',      header: 'ID',        width: 60  },
    { field: 'company', header: 'Company',   width: 140 },
    { field: 'region',  header: 'Region',    width: 90  },
    { field: 'rep',     header: 'Sales Rep', width: 160 },
    {
      field: 'arr',
      header: 'ARR',
      width: 130,
      align: 'right',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
    },
    { field: 'stage', header: 'Stage', width: 130 },
  ]

  let api = $state<SvGridApi<typeof features, Deal> | null>(null)
  let rawCount    = $state(deals.length)
  let displayedCount = $state(0)

  function onApiReady(readyApi: SvGridApi<typeof features, Deal>) {
    api = readyApi

    // Stage 1: filter - only Won deals pass through
    api.setFilter('stage', { operator: 'equals', value: 'Won' })

    // Stage 2: sort - highest ARR first
    api.setSort('arr', 'desc')

    // Stage 4: paginate - 5 rows per page
    api.setPageSize(5)

    rawCount       = api.getData().length           // always 12 - untouched source
    displayedCount = api.getDisplayedRows().length  // 5 - page 1 of Won deals sorted by ARR
  }
</script>

<p>Raw: {rawCount} rows | Displayed: {displayedCount} rows</p>

<SvGrid
  data={deals}
  {columns}
  {features}
  onApiReady={onApiReady}
  height={320}
/>
```

After `onApiReady` fires, `rawCount` is 12 and `displayedCount` is 5 - five Won deals, sorted by ARR descending, page 1 of 2. The source array has not been touched. The pipeline produced a view.

## What actually happens when you call setFilter

Every `api.setFilter(...)` call marks the filter stage as dirty. The pipeline then invalidates every downstream stage automatically - sort, group, and paginate all recompute because they depend on the filtered set. Only the upstream stage (the raw data) is left alone.

This cascading invalidation is why you should debounce filter inputs on large client-side datasets. A 50,000-row dataset with three active filters can recompute in 20-40 ms, which is fine for a button click but choppy on every keystroke. Debounce by 150-200 ms and the pipeline recomputes once after the user pauses typing rather than on each character.

For server-side data, the same pipeline concept applies with a different implementation. `createServerDataSource` sends filter, sort, and page parameters to your backend and treats the response as the already-processed pipeline output. The client-side row model stages become thin pass-throughs - the real computation happens on the server where it belongs.

```ts
import { createServerDataSource } from '@svgrid/grid'

const ds = createServerDataSource({
  fetch: async ({ page, pageSize, sort, filters }) => {
    const params = new URLSearchParams({
      page: String(page),
      size: String(pageSize),
      sort: sort.map(s => `${s.id}:${s.desc ? 'desc' : 'asc'}`).join(','),
    })

    // Append filters to params...
    for (const [field, f] of Object.entries(filters)) {
      params.set(`filter_${field}`, String(f.value))
    }

    const res  = await fetch(`/api/deals?${params}`)
    const json = await res.json()
    return { rows: json.data, total: json.total }
  },
})

// Pass the data source exactly like a plain array.
// <SvGrid data={ds} {columns} {features} pageable />
```

The grid does not know or care whether your data source is a local array or a network fetch. The pipeline abstraction stays the same either way.

## Three things that trip people up

**Sorting on pre-formatted values.** If you format your `arr` column as `"$1,102,000"` before passing data into the grid, lexicographic sort puts `"$9..."` after `"$1..."` - which is wrong. Keep `format` as display-only metadata on the column definition and let the row model sort the raw numeric value. Never pre-format values in your data array.

**Reading pipeline output too early.** `api.getDisplayedRows()` returns an empty array if called before the grid has processed its first render cycle. Always read pipeline output inside `onApiReady`, or in a reactive `$derived` block that depends on grid state, not during module initialization.

**Page state surviving a filter that shrinks total pages.** You are on page 4. You apply a filter that leaves 8 total rows at 5 per page - now there are only 2 pages. The grid stays on page 4, which no longer exists, and renders nothing. Call `api.setPage(1)` immediately after any `api.setFilter(...)` call that might reduce the page count. It is a one-liner and it prevents a confusing blank grid state.

## Row selection and the pipeline boundary

One thing that surprises people: `api.getSelectedRows()` is not bounded by the pipeline output. Row selection tracks against the full data set. A row you selected on page 1 stays selected when you navigate to page 3, and it stays selected if a filter hides it. That is intentional - you can select across pages and then act on the full selection.

The flip side is that your selection UI needs to account for this. If you render a "selected count" badge from `api.getSelectedRows().length`, it will include rows that are currently hidden by an active filter. That is usually what you want. If you specifically need only the selected rows that are also currently visible, filter the result yourself:

```ts
const visibleSelected = api
  .getSelectedRows()
  .filter(row => api.getDisplayedRows().some(d => d.id === row.id))
```

Not something you need every day, but worth knowing when the numbers do not match your expectations.

## Why the pipeline model is worth understanding

Most grid APIs expose `setFilter` and `setSort` as black boxes - you call them and the grid updates, and you never need to think about what happens in between. That works fine until something unexpected shows up: a blank page after filtering, a sort that ignores your filter, a selection count that does not match the visible rows.

When that happens, the pipeline model gives you a frame for diagnosis. You know the stages, you know the order, and you know which API calls affect which stages. That makes the difference between a 2-minute fix and an hour of trial-and-error.
