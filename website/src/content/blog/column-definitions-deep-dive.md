---
title: Column Definitions in SvGrid - Fields, Accessors, and Formatting
description: A practical look at how ColumnDef controls field binding, value resolution, sort behavior, and custom cell rendering in SvGrid.
date: 2026-05-26
updated: 2026-07-02
category: Columns
tags: columns, column definitions, formatting, svelte data grid
author: Boyko Markov
---

Most data grid bugs I have seen come from one misunderstanding: the difference between the value the grid sorts on and the value the cell renders. Get those confused and you end up with a currency column whose sort order makes no sense, or a date column that sorts March before January because the rows store `"Mar 15"` instead of `"2024-03-15"`. `ColumnDef` is the single object that controls all of this, and understanding its resolution chain is worth twenty minutes of your time.

## Two paths to a cell value

Every column in SvGrid resolves its value through one of two mechanisms. You either declare `accessorKey` to read a property directly off the row object, or you declare `fieldFn` to compute a value from the full row at read time. The output of that resolution - the raw accessor value - is what the sort engine compares and what filter functions receive.

The `cell` callback sits on top of that. It gets a `CellContext` whose `getValue()` returns the resolved accessor value. Whatever you return from `cell` is displayed; whatever `getValue()` returns is what drives sorting and filtering. That separation is intentional and important.

```ts
import {
  tableFeatures,
  rowSortingFeature,
  columnFilteringFeature,
  type ColumnDef,
  type CellContext,
} from '@svgrid/grid'

type Transaction = {
  id:          string
  date:        string           // ISO yyyy-mm-dd
  description: string
  category:    string
  amount:      number           // positive = credit, negative = debit
  balance:     number
  currency:    'USD' | 'EUR' | 'GBP'
  status:      'Cleared' | 'Pending' | 'Disputed'
}

type Status = Transaction['status']
const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

// accessorKey: grid reads row['date'] and uses it for sort + filter
// cell: we format for display, but sort still compares raw ISO strings
const dateColumn: ColumnDef<typeof features, Transaction> = {
  accessorKey: 'date',
  header: 'Date',
  size: 110,
  cell: (ctx: CellContext<typeof features, Transaction, string>) =>
    new Date(ctx.getValue()).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    }),
}

// fieldFn: computed from the row, never stored on Transaction
// id is required when you use fieldFn - omitting it breaks column state
const absAmountColumn: ColumnDef<typeof features, Transaction> = {
  id: 'absAmount',
  header: 'Abs. Amount',
  size: 120,
  fieldFn: (row) => Math.abs(row.amount),
  meta: { align: 'right' },
  cell: (ctx: CellContext<typeof features, Transaction, number>) =>
    ctx.getValue().toFixed(2),
  sortingFn: 'basic',
}
```

The `id` requirement on `fieldFn` columns is a sharp edge. Without it, SvGrid cannot produce a stable column key and column state - pinning, visibility, sort state - will either silently break or warn at runtime. Always pair `fieldFn` with an explicit `id`.

## Currency, locale, and the `sortingFn` trap

Numeric columns need two things done correctly: an `Intl.NumberFormat` call inside `cell` for display, and `sortingFn: 'basic'` to guarantee numeric comparison. Without that `sortingFn`, SvGrid may fall back to alphanumeric string comparison depending on how your accessor value is typed. The symptom is subtle - most sort operations look fine until you have a mix of large negatives and large positives.

```svelte
<script lang="ts">
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
    type CellContext,
    type SvGridApi,
  } from '@svgrid/grid'

  type Status = 'Cleared' | 'Pending' | 'Disputed'
  type Transaction = {
    id: string; date: string; description: string; category: string
    amount: number; balance: number; currency: 'USD' | 'EUR' | 'GBP'; status: Status
  }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  const statusColour: Record<Status, string> = {
    Cleared:  '#16a34a',
    Pending:  '#d97706',
    Disputed: '#dc2626',
  }

  const columns: ColumnDef<typeof features, Transaction>[] = [
    {
      accessorKey: 'date',
      header: 'Date',
      size: 110,
      cell: (ctx: CellContext<typeof features, Transaction, string>) =>
        new Date(ctx.getValue()).toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric',
        }),
    },
    {
      accessorKey: 'description',
      header: 'Description',
      size: 200,
    },
    {
      accessorKey: 'category',
      header: 'Category',
      size: 120,
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      size: 130,
      meta: { align: 'right' },
      // cell reads row.currency from the full row via ctx.row.original
      cell: (ctx: CellContext<typeof features, Transaction, number>) => {
        const amount = ctx.getValue()
        const currency = ctx.row.original.currency
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
          signDisplay: 'always',
        }).format(amount)
      },
      sortingFn: 'basic',
    },
    {
      accessorKey: 'balance',
      header: 'Balance',
      size: 130,
      meta: { align: 'right' },
      cell: (ctx: CellContext<typeof features, Transaction, number>) =>
        new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: ctx.row.original.currency,
        }).format(ctx.getValue()),
      sortingFn: 'basic',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 100,
      cell: renderSnippet(statusBadge, (ctx) => ctx.getValue<Status>()),
    },
  ]

  let api = $state<SvGridApi<typeof features, Transaction> | null>(null)

  // Deterministic LCG rows for reproducible demos
  let seed = 0xA1B2C3D4
  function rand(): number {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 0xFFFFFFFF
  }
  function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rand() * arr.length)]! }

  function makeRows(n: number): Transaction[] {
    const statuses: Status[] = ['Cleared', 'Pending', 'Disputed']
    const currencies = ['USD', 'EUR', 'GBP'] as const
    const cats = ['Dining', 'Travel', 'Salary', 'Rent', 'Utilities']
    let balance = 10_000
    return Array.from({ length: n }, (_, i) => {
      const amount = Math.round((rand() * 2000 - 800) * 100) / 100
      balance = Math.round((balance + amount) * 100) / 100
      const month = String(1 + Math.floor(rand() * 12)).padStart(2, '0')
      const day = String(1 + Math.floor(rand() * 28)).padStart(2, '0')
      return {
        id: `tx-${i}`, date: `2024-${month}-${day}`,
        description: `Merchant ${i + 1}`, category: pick(cats),
        amount, balance,
        currency: pick(currencies), status: pick(statuses),
      }
    })
  }

  const rows = makeRows(100)
</script>

{#snippet statusBadge(status: Status)}
  <span style="
    display: inline-block;
    padding: 2px 8px;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    color: #fff;
    background: {statusColour[status]};
  ">{status}</span>
{/snippet}

<SvGrid
  {features}
  data={rows}
  {columns}
  onApiReady={(a) => { api = a }}
  style="height: 520px; width: 100%;"
/>
```

Notice that the amount and balance columns read `ctx.row.original.currency` inside the cell callback. That is the correct way to access sibling fields when formatting a cell - `ctx.row.original` is the raw row object, fully typed. You do not need a separate accessor for `currency`; you just read it where you need it.

## Snippets as cell renderers

`renderSnippet` connects a Svelte 5 snippet to the `cell` position. Its second argument is a selector function that maps `CellContext` to whatever type your snippet declares as its parameter. The selector runs once per cell render, and SvGrid handles mounting and cleanup. You own the markup; SvGrid owns the lifecycle.

The selector argument is not optional in practice. Technically you can omit it, but then the snippet receives the full `CellContext` object, which makes the snippet's type parameter unusable and forces an `any` cast to do anything useful. Write a short selector even when it is trivial:

```ts
// correct - typed parameter, clean snippet
cell: renderSnippet(statusBadge, (ctx) => ctx.getValue<Status>())

// works but loses type safety - avoid
cell: renderSnippet(statusBadge)
```

If your cell needs both the cell value and other row fields, pass a small object from the selector:

```ts
type AmountCell = { amount: number; currency: string }

const amountColumn: ColumnDef<typeof features, Transaction> = {
  id: 'amount',
  header: 'Amount',
  accessorKey: 'amount',
  meta: { align: 'right' },
  cell: renderSnippet(
    amountBadge,
    (ctx): AmountCell => ({
      amount:   ctx.getValue<number>(),
      currency: ctx.row.original.currency,
    })
  ),
}
```

The snippet then declares `{#snippet amountBadge(cell: AmountCell)}` and both fields are fully typed.

## Runtime column changes and `$derived`

Column definitions are reactive in Svelte 5. If you wrap your columns array in a `$derived` block, SvGrid will re-render affected cells when the derivation changes. The grid diffs by column `id` or `accessorKey`, so unchanged columns are not remounted.

This is useful for toggling formatters at runtime - for example, switching between a compact number format and a full currency format based on a user preference:

```ts
let showFullCurrency = $state(true)

const columns = $derived<ColumnDef<typeof features, Transaction>[]>([
  {
    accessorKey: 'amount',
    header: 'Amount',
    size: 130,
    meta: { align: 'right' },
    sortingFn: 'basic',
    cell: (ctx: CellContext<typeof features, Transaction, number>) => {
      const v = ctx.getValue()
      if (showFullCurrency) {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: ctx.row.original.currency,
          signDisplay: 'always',
        }).format(v)
      }
      return v.toFixed(2)
    },
  },
  // ...other columns unchanged
])
```

Toggling `showFullCurrency` triggers the derivation, and only the amount column cells re-render. The `api` reference remains stable.

## Alignment and the `meta` escape hatch

`meta` is a freeform object. SvGrid reads `meta.align` to apply `text-align` to both header cells and data cells - so `meta: { align: 'right' }` is all you need to right-align a numeric column and its header together. Any other property you attach to `meta` is available inside your custom cell and header renderers via `ctx.column.columnDef.meta`, typed through module augmentation if you add a declaration for `ColumnMeta`.

That makes `meta` the right place for per-column configuration that does not fit a first-class `ColumnDef` field - things like a custom format string, a unit label, or a flag that controls whether a cell shows a sparkline.

The working demo for this pattern is at `/demos/13-finances`. The column resolution logic that drives accessor value lookup lives in `packages/grid/src/columns/resolveColumnTypes.ts` - if a column is producing unexpected sort results, that file and the accessor value cache next to it are the right places to start debugging.
