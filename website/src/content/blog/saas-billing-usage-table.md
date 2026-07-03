---
title: Building a SaaS Billing and Usage Table in Svelte
description: How to build a production billing grid with locale-aware currency formatting, grouped subtotals by cost category, and CSV export that matches what is on screen.
date: 2026-09-03
updated: "2026-07-02"
category: Use cases
tags: saas, billing, usage, use case, svelte data grid
author: Victor Vidolov
---

Billing tables are deceptively hard to get right. The numbers are simple enough - consumption, unit price, amount - but the moment you add locale-aware formatting, grouped subtotals, and a CSV export, you run into a dozen small decisions that compound into real bugs. This post walks through a complete billing and usage grid using `@svgrid/grid`, covering the decisions that matter.

## What the data looks like

A metered billing system typically produces one row per billable line item per billing period. The row needs a cost category so you can group and subtotal, a raw numeric amount for sorting and aggregation, and enough metadata to reconstruct the period label. Here is the type and a representative seed dataset:

```ts
// billingData.ts
export type BillingRow = {
  id: string
  category: 'Platform' | 'Data' | 'Support' | 'Add-ons'
  item: string
  unit: string
  usage: number
  quota: number
  unitPrice: number
  amount: number
  percentOfPlan: number
  periodStart: string  // ISO 8601
  periodEnd: string
}

export const BILLING_ROWS: BillingRow[] = [
  { id: 'r01', category: 'Platform', item: 'Active seats',     unit: 'seats',    usage: 42,   quota: 50,  unitPrice: 12.00,  amount: 504.00, percentOfPlan: 18.2, periodStart: '2025-01-01', periodEnd: '2025-01-31' },
  { id: 'r02', category: 'Platform', item: 'SSO add-on',       unit: 'flat',     usage: 1,    quota: 1,   unitPrice: 149.00, amount: 149.00, percentOfPlan: 5.4,  periodStart: '2025-01-01', periodEnd: '2025-01-31' },
  { id: 'r03', category: 'Data',     item: 'API calls',        unit: 'M calls',  usage: 8.4,  quota: 10,  unitPrice: 8.50,   amount: 71.40,  percentOfPlan: 2.6,  periodStart: '2025-01-01', periodEnd: '2025-01-31' },
  { id: 'r04', category: 'Data',     item: 'Storage (cold)',   unit: 'GB',       usage: 340,  quota: 500, unitPrice: 0.023,  amount: 7.82,   percentOfPlan: 0.3,  periodStart: '2025-01-01', periodEnd: '2025-01-31' },
  { id: 'r05', category: 'Data',     item: 'Storage (hot)',    unit: 'GB',       usage: 88,   quota: 100, unitPrice: 0.18,   amount: 15.84,  percentOfPlan: 0.6,  periodStart: '2025-01-01', periodEnd: '2025-01-31' },
  { id: 'r06', category: 'Support',  item: 'Priority support', unit: 'flat',     usage: 1,    quota: 1,   unitPrice: 399.00, amount: 399.00, percentOfPlan: 14.4, periodStart: '2025-01-01', periodEnd: '2025-01-31' },
  { id: 'r07', category: 'Add-ons',  item: 'Data exports',     unit: 'exports',  usage: 23,   quota: 50,  unitPrice: 2.00,   amount: 46.00,  percentOfPlan: 1.7,  periodStart: '2025-01-01', periodEnd: '2025-01-31' },
  { id: 'r08', category: 'Add-ons',  item: 'Webhooks',         unit: 'M events', usage: 1.2,  quota: 5,   unitPrice: 5.00,   amount: 6.00,   percentOfPlan: 0.2,  periodStart: '2025-01-01', periodEnd: '2025-01-31' },
]
```

Notice that `percentOfPlan` is stored as `18.2`, not `0.182`. That matters for the percent formatter and I will come back to it.

## Column definitions and the formatting contract

The most important rule in a billing grid: keep raw numbers on the row object. Never return a formatted string like `"$504.00"` from a `fieldFn` or accessor. The grid needs the raw value for numeric sorting, range filters, and group aggregation. Formatting is a display concern and belongs in the column's `format` config.

`@svgrid/grid` resolves `format` through `Intl.NumberFormat` internally. You pass a locale string and the formatter stays consistent across SSR and browser renders, which matters when your app is server-rendered and the `navigator.language` might not match the server's locale.

```svelte
<script lang="ts">
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    columnGroupingFeature,
    type ColumnDef,
    type SvGridApi,
    type TableFeatures,
  } from '@svgrid/grid'
  import { BILLING_ROWS, type BillingRow } from './billingData'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    columnGroupingFeature,
  })

  type F = typeof features

  let api = $state<SvGridApi<F, BillingRow> | null>(null)

  const locale =
    typeof navigator !== 'undefined' ? navigator.language : 'en-US'

  const columns: ColumnDef<F, BillingRow>[] = [
    {
      id: 'category',
      accessorKey: 'category',
      header: 'Category',
      size: 110,
    },
    {
      id: 'item',
      accessorKey: 'item',
      header: 'Item / Metric',
      size: 200,
    },
    {
      id: 'usage',
      accessorKey: 'usage',
      header: 'Usage',
      size: 100,
      format: { type: 'number', locale, maximumFractionDigits: 2 },
      meta: { align: 'right' },
    },
    {
      id: 'unit',
      accessorKey: 'unit',
      header: 'Unit',
      size: 90,
    },
    {
      id: 'unitPrice',
      accessorKey: 'unitPrice',
      header: 'Unit Price',
      size: 110,
      format: { type: 'currency', locale, currency: 'USD' },
      meta: { align: 'right' },
    },
    {
      id: 'amount',
      accessorKey: 'amount',
      header: 'Amount',
      size: 120,
      format: { type: 'currency', locale, currency: 'USD' },
      meta: { align: 'right' },
    },
    {
      id: 'percentOfPlan',
      accessorKey: 'percentOfPlan',
      header: '% of Plan',
      size: 95,
      // percentOfPlan is already 0-100; tell the formatter to scale it back
      // before handing to Intl.NumberFormat (which multiplies by 100 internally)
      format: { type: 'percent', locale, maximumFractionDigits: 1, scale: 0.01 },
      meta: { align: 'right' },
    },
    {
      id: 'period',
      accessorFn: (r) => `${r.periodStart} – ${r.periodEnd}`,
      header: 'Period',
      size: 190,
    },
  ]
</script>

<SvGrid
  {features}
  data={BILLING_ROWS}
  {columns}
  onApiReady={(a) => { api = a }}
  defaultGroupBy={['category']}
  rowHeight={36}
  headerHeight={40}
  style="height: 520px; width: 100%;"
/>
```

The `scale: 0.01` on `percentOfPlan` is easy to get wrong. `Intl.NumberFormat` with `style: 'percent'` multiplies the input by 100 before rendering - so if you feed it `18.2` expecting to see `18.2%`, you get `1820%`. The `scale` option tells SvGrid to divide first. If your API returns values in the `0-1` range you can drop `scale` entirely.

## Grouping and what aggregation gives you for free

When you enable `columnGroupingFeature` and call `api.setGroupBy(['category'])`, SvGrid groups rows and computes aggregate rows automatically. The default aggregate for numeric columns is `sum`. For a billing table that is almost always what you want - a `Platform` group row shows the total Platform spend, not an average or count.

The `percentOfPlan` column also sums by default. That is intentional here: summing the percentage across a category gives you that category's share of the total bill, which is a more useful number than any average.

`defaultGroupBy={['category']}` in the `SvGrid` component means the grid opens grouped, which is the right default for a finance reviewer who wants to see category totals first and drill down into line items.

## Export that respects the current filter state

When a customer wants to export their invoice, they should get exactly what is on screen, not the full unfiltered dataset. `api.getDisplayedRows()` returns the post-filter, post-sort flat list of leaf rows (group header rows are excluded). This makes the export function straightforward:

```svelte
<script lang="ts">
  // ...continuing the same component

  function exportCsv() {
    const rows = api?.getDisplayedRows() ?? []
    const headers = [
      'Category', 'Item', 'Usage', 'Unit',
      'Unit Price (USD)', 'Amount (USD)', '% of Plan', 'Period',
    ]
    const lines = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r.category,
          `"${r.item}"`,           // quote strings that may contain commas
          r.usage,
          r.unit,
          r.unitPrice.toFixed(4),  // raw number, NOT "$12.0000"
          r.amount.toFixed(2),
          (r.percentOfPlan / 100).toFixed(4),
          `"${r.periodStart} - ${r.periodEnd}"`,
        ].join(',')
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'billing-jan-2025.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function toggleGroup() {
    const state = api?.getState()
    const isGrouped = (state?.groupBy?.length ?? 0) > 0
    api?.setGroupBy(isGrouped ? [] : ['category'])
  }
</script>

<div class="billing-toolbar">
  <button onclick={toggleGroup}>Toggle grouping</button>
  <button onclick={exportCsv}>Export CSV</button>
</div>
```

Two things to notice in the export:

First, currency amounts go out as raw numbers with the denomination in the column header (`Amount (USD)`), not as `"$504.00"`. Excel and Google Sheets both treat a leading `$` as text, which breaks any SUM formula the recipient tries to write. Put the currency in the header, keep the cell as a number.

Second, `percentOfPlan` is divided by 100 before export. The display formatter handled that visually, but when writing a CSV you own the value, so you have to do the same math yourself.

## The multi-level grouping trap

`api.setGroupBy` replaces the entire group-by list, it does not append. If you want to add a second grouping level while keeping the first, you need to read the current state first:

```ts
function addGroupLevel(field: string) {
  const current = api?.getState()?.groupBy ?? []
  if (!current.includes(field)) {
    api?.setGroupBy([...current, field])
  }
}
```

Calling `api.setGroupBy(['item'])` when `['category']` is already active will clear the category grouping entirely. This is the right behavior - the API is declarative - but it surprises people who expect additive behavior.

## Read-only by default, running totals by convention

SvGrid cells are read-only unless you add an `editor` config to a column. A billing table with no `editor` fields is automatically non-editable with no extra configuration needed.

Running totals (a column that accumulates amounts down the visible rows) are not a built-in feature and probably should not be. A running total is order-dependent - if the user sorts by amount descending, the running total in each row becomes meaningless. The correct approach is to compute it as a derived field on your data before passing it to the grid, and to expose a way to hide that column when the user changes the sort order. If you need it, pass a `runningTotal` field on each `BillingRow` and add a column for it; accept that re-sorting breaks it and communicate that to the user.

Group subtotals in the grid are different - they are re-computed on every render from the current leaf rows, so they stay correct regardless of sort or filter state.

The grid handles a lot of the hard parts here. Locale formatting, group aggregation, and filter-aware exports are built in. The remaining decisions - how to handle percentages stored as 0-100 vs 0-1, what goes into a CSV cell vs a column header, whether running totals make sense given sort behavior - those belong to the product layer, and this post gives you a working starting point for each one.
