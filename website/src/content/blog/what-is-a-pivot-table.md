---
title: What Is a Pivot Table?
description: A pivot table reshapes flat records into a two-dimensional summary by grouping on one axis, spanning on the other, and aggregating values at every intersection. Here is the mental model and how to build one with SvGrid.
date: 2026-09-21
updated: "2026-07-02"
category: Concepts
tags: pivot table, aggregation, concepts, data grid
author: Kamelia M
---
A pivot table is not a visualization - it is a data operation. You take a flat list of facts, pick one field to spread across rows, another to spread across columns, and tell the engine how to reduce the values that land in each intersection cell. The output is a plain rectangle you can render with any grid. That simplicity is what makes pivot tables worth understanding precisely, because "I need a pivot" and "I need an OLAP cube" are very different problems.

## The mental model: two axes and an aggregator

Start with 2,400 sales transactions. Each one has a region, a quarter, a product family, and an ARR figure. You want a matrix where:

- Rows = one per region (AMER, EMEA, APAC)
- Columns = one per quarter (Q1, Q2, Q3, Q4)
- Each cell = the sum of ARR for that region-quarter pair

That is a pivot. The data operation has three named parts: the **row dimension** (region), the **column dimension** (quarter), and the **value aggregation** (sum of arr).

The source data looks like this:

```ts
type Region = 'AMER' | 'EMEA' | 'APAC'
type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4'

type Fact = {
  id: string
  region: Region
  quarter: Quarter
  family: string
  arr: number  // annual recurring revenue in USD
}

// Reproducible synthetic dataset - 2,400 rows.
let prng = 0xC0FFEE01 >>> 0
const rnd = () => { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }

const REGIONS: Region[] = ['AMER', 'EMEA', 'APAC']
const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4']
const FAMILIES = ['Cloud Storage', 'Data Pipeline', 'AI Platform', 'Security Suite']

const facts: Fact[] = Array.from({ length: 2400 }, (_, i) => ({
  id: `f${i}`,
  region:  REGIONS[i % 3]!,
  quarter: QUARTERS[Math.floor(i / 3) % 4]!,
  family:  FAMILIES[Math.floor(i / 12) % 4]!,
  arr:     Math.round(10_000 + rnd() * 190_000),
}))
```

2,400 rows become 12 cells. Every row that lands on AMER/Q1 gets summed into one number. That is the whole operation.

## Building it with createPivotModel

SvGrid's enterprise package ships `createPivotModel`, a pure function that takes your flat array plus a spec and returns `{ rows, columns }` - a fresh flat array of pivot rows and a ready-to-use `ColumnDef[]`. You pass both straight to the grid.

```svelte
<script lang="ts">
  import {
    SvGrid,
    tableFeatures,
    type SvGridApi,
  } from '@svgrid/grid'
  import {
    createPivotModel,
    type PivotValueConfig,
  } from '@svgrid/enterprise'

  // source data from above ...

  const values: PivotValueConfig[] = [
    {
      field: 'arr',
      agg: 'sum',
      header: 'ARR',
      format: {
        type: 'currency',
        currency: 'USD',
        options: { maximumFractionDigits: 0 },
      },
    },
  ]

  const pivot = createPivotModel(facts, {
    rows:         ['region'],
    columns:      ['quarter'],
    columnOrder:  ['Q1', 'Q2', 'Q3', 'Q4'],
    values,
    rowTotals:    true,   // adds a "Total" column per row
    columnTotals: true,   // adds a grand-total footer row
  })

  // pivot.rows example (one row per region + a totals row):
  // [
  //   { region: 'AMER', Q1_arr_sum: 40_200_000, Q2_arr_sum: ..., total_arr_sum: ... },
  //   { region: 'EMEA', ... },
  //   { region: 'APAC', ... },
  //   { region: 'Total', Q1_arr_sum: ..., ... },
  // ]

  const features = tableFeatures({})

  let api: SvGridApi | undefined

  function onApiReady(a: SvGridApi) {
    api = a
    // Pin the row-label column so it stays visible when scrolling right.
    api.setColumnPinning({ left: ['region'] })
  }
</script>

<SvGrid
  data={pivot.rows}
  columns={pivot.columns}
  {features}
  showPagination={false}
  containerHeight={280}
  onApiReady={onApiReady}
/>
```

Two things are worth calling out here. First, `pivot.columns` is generated from the distinct values found in the source data's `quarter` field - you never write Q1 through Q4 column definitions by hand. If the source data gains a new quarter value, the column appears automatically. Second, `pivot.rows` is a plain object array. The grid has no awareness it came from a pivot operation, so sorting, cell selection, and CSV export all work without any pivot-specific handling.

## How the three passes work

The implementation runs in O(n) time relative to the number of source records:

**Collect column keys.** One full scan of the source array builds an ordered set of every distinct value in the `columns` fields. With `columnOrder` set, keys that appear in the source but not in the order list are appended at the end; keys in the order list that do not appear in the source are silently dropped.

**Group and aggregate.** A second scan groups records by their row-dimension key (e.g. 'AMER') and accumulates values per column key (e.g. 'Q1'). For `sum`, this is a running total. For `avg`, a parallel count is kept alongside the sum and the division happens after. `min` and `max` use a simple comparison accumulator. Row totals accumulate in a parallel bucket that runs across all column keys for the same row.

**Materialize.** After all records are processed, one output object is written per distinct row-dimension combination. Each synthesized field follows the pattern `{columnKey}_{valueField}_{agg}` - so `Q1_arr_sum`. That naming convention is what ties `pivot.columns` (which references these field names) to `pivot.rows` (which carries them as properties). Column totals - the grand-total footer row - are computed by summing each column's per-row result.

## Reactivity and dynamic specs

`createPivotModel` is a pure function. It runs once and returns a static result. If your source data or the pivot spec can change at runtime - say the user picks a different row dimension from a dropdown - wrap the call in a `$derived` rune:

```ts
// Reactive pivot: re-runs whenever rowDimension or selectedAgg changes.
const pivot = $derived(
  createPivotModel(facts, {
    rows:        [rowDimension],   // $state string
    columns:     ['quarter'],
    columnOrder: ['Q1', 'Q2', 'Q3', 'Q4'],
    values: [{ field: 'arr', agg: selectedAgg }],  // $state string
    rowTotals:    true,
    columnTotals: true,
  })
)
```

Svelte reruns the derivation whenever either signal changes, and the grid receives a fresh `data` and `columns` pair. One thing to know: because `pivot.columns` changes reference on every derivation, the grid will re-initialize column state (widths, pinning). If you want to preserve user-adjusted column widths across spec changes, call `api.getState()` before the change and `api.setState(saved)` after.

## Filtering before vs. after pivoting

There are two distinct places to filter a pivot report, and they produce different results.

Filtering the **source data** before calling `createPivotModel` changes what gets counted. If you filter `facts` down to just the Security Suite family before pivoting, your ARR cells reflect only Security Suite revenue. The column totals are also Security Suite-only.

Filtering the **pivot output** (i.e. adding `columnFilteringFeature` to `tableFeatures`) filters the already-materialized rows. This is useful for hiding specific regions from view, but the column totals row still includes all regions' data because it was baked in by `createPivotModel` before the filter ran. If that mismatch matters to your users, filter the source and re-pivot rather than filtering the output.

```ts
// Filter source before pivoting - totals reflect the filtered set.
const filteredFacts = facts.filter(f => f.family === selectedFamily)
const pivot = createPivotModel(filteredFacts, spec)

// vs. filtering output - totals still reflect the full dataset.
import { columnFilteringFeature } from '@svgrid/grid'
const features = tableFeatures({ columnFilteringFeature })
// <SvGrid data={pivot.rows} columns={pivot.columns} {features} filterable />
```

For most business reporting use cases, filtering the source is what users actually want - the numbers in every cell should add up to the totals.

## Sparse data and aggregation edge cases

A few behaviors are non-obvious the first time you hit them.

**Sparse combinations produce 0, not null.** If no source record has region 'APAC' and quarter 'Q1', the cell value is `0`. A heatmap cell renderer that interprets `0` as "no data" will color it incorrectly. Guard with `value === 0 ? null : value` in your cell formatter when the distinction matters.

**Averaging per-column averages gives the wrong row total.** `createPivotModel` handles this correctly by running a separate accumulator for the row-total bucket, but if you post-process `pivot.rows` to add a custom derived column (say, "Q4 vs Q1 growth"), compute it from the individual Q1 and Q4 sums rather than from per-column averages. The math is different when bucket sizes vary.

**Column key ordering is insertion order by default.** If your source records are not sorted chronologically, `Q3` can appear before `Q1` in `pivot.columns`. Always pass `columnOrder` when the column sequence has a meaningful interpretation, as it does with time periods.

Multi-level column headers (grouping Q1-Q4 under a "2025" parent) and collapsible row groups for multi-field row dimensions like `rows: ['region', 'family']` are both supported - those are covered in the live demo at `/demos/124-pivot-olap`.
