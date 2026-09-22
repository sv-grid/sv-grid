---
seoTitle: Svelte server-side row model - paging to grouping in one grid
seoDescription: One grid, one getRows, a server on the page: a page at a time, infinite scroll, grouping with totals, a group panel, an edit as a transaction, a rule.
keywords: svelte server side row model, server grouping svelte, infinite scroll server svelte, lazy loading grid, server side pagination svelte
---

# Server-Side Row Model: a walkthrough

One grid and one `getRows`, and the rows stay on the server: a page at a
time first, then infinite scroll, then grouped with subtotals and a
grand total, then a panel the user groups with, an edit that becomes a
transaction, and a selection that is a rule rather than a list. Each
step is a change to the same setup, and every example runs against a
server written on this page, so the request and the answer are in
front of you. The [row model hub](./server-row-model.md) is the
contract in full; the deep dives ([grouping](./server-grouping.md),
[tree data](./server-tree-data.md), [pivot](./server-pivot.md),
[transactions](./server-transactions.md), [selection](./server-selection.md))
go further on each part.

The flat controller is free in `@svgrid/grid`; the row model that
groups, pivots and selects across unloaded rows is `@svgrid/enterprise`,
on the same contract.

## The server

Just under twenty thousand sales rows in an array, and a `getRows` that does what an
endpoint does: filter, sort, slice the block asked for, and when the
request says `groupBy`, run the GROUP BY for the level being expanded.
It also answers the write side, so an edit later on has somewhere to go.
Read it once; every example below talks to it.

```svelte {preamble}
<script lang="ts">
  import { SvGrid, renderComponent, tableFeatures, rowSortingFeature, columnFilteringFeature, rowSelectionFeature, createServerDataSource, type GridColumns, type ServerDataSource, type ServerRequest, type ServerState } from '@svgrid/grid'
  import { createServerRowModel, serverGroupText, SvGroupCell, SvRowGroupPanel, type ServerRowModelState, type ServerRowModelGridRow } from '@svgrid/enterprise'

  type Sale = { id: number; region: string; country: string; rep: string; product: string; qty: number; amount: number; childCount?: number }

  const REGIONS: Record<string, string[]> = { Americas: ['United States', 'Brazil', 'Canada'], EMEA: ['Germany', 'United Kingdom', 'France'], APAC: ['Japan', 'Australia', 'India'] }
  const PRODUCTS = ['Desk', 'Chair', 'Lamp', 'Monitor', 'Cabinet']
  // The "database". Hashed rather than cycled, so the per-country sums differ.
  const DB: Sale[] = []
  {
    let i = 0
    for (const [region, countries] of Object.entries(REGIONS))
      for (const country of countries)
        for (let k = 0; k < 2222; k += 1, i += 1) {
          const h = Math.imul(i + 1, 2654435761) >>> 0
          const qty = 1 + (h % 12)
          DB.push({ id: i + 1, region, country, rep: `Rep ${1 + (h % 40)}`, product: PRODUCTS[(h >>> 4) % PRODUCTS.length]!, qty, amount: qty * (120 + ((h >>> 8) % 880)) })
        }
  }
  const text = (r: Sale) => `${r.region} ${r.country} ${r.rep} ${r.product}`.toLowerCase()

  // WHERE: the global search and the per-column conditions the grid sends.
  function where(rows: Sale[], req: ServerRequest): Sale[] {
    const q = req.filterModel.global?.trim().toLowerCase()
    if (q) rows = rows.filter((r) => text(r).includes(q))
    for (const [col, f] of Object.entries(req.filterModel.columns ?? {})) {
      const v = f.value, n = Number(v)
      rows = rows.filter((r) => {
        const cell = (r as Record<string, unknown>)[col]
        if (f.selectedValues?.length) return f.selectedValues.includes(String(cell))
        switch (f.operator) {
          case 'contains': return String(cell).toLowerCase().includes(String(v).toLowerCase())
          case 'equals': return String(cell) === String(v)
          case 'greaterThan': return Number(cell) > n
          case 'lessThan': return Number(cell) < n
          case 'between': return Number(cell) >= n && Number(cell) <= Number(f.valueTo)
          default: return true
        }
      })
    }
    return rows
  }
  // ORDER BY: the sort model, first key wins.
  function orderBy<T extends Record<string, unknown>>(rows: T[], req: ServerRequest): T[] {
    if (!req.sortModel.length) return rows
    return [...rows].sort((a, b) => {
      for (const { id, desc } of req.sortModel) {
        const x = a[id], y = b[id]
        const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
        if (c) return desc ? -c : c
      }
      return 0
    })
  }
  // SUM(amount), SUM(qty) over a set of rows: what a group row carries.
  const totals = (rows: Sale[]) => rows.reduce((t, r) => ({ amount: t.amount + r.amount, qty: t.qty + r.qty }), { amount: 0, qty: 0 })

  let requestLog = $state<string[]>([])
  const source: ServerDataSource<Sale> = {
    async getRows(req) {
      await new Promise((r) => setTimeout(r, 150)) // the network
      const groupBy = req.groupBy ?? []
      const keys = req.groupKeys ?? []
      // Narrow to the path being expanded: WHERE region = $1 AND country = $2.
      let rows = where(DB, req).filter((r) => keys.every((k, i) => String((r as Record<string, unknown>)[groupBy[i]!]) === k))
      const sort = req.sortModel.map((s) => `${s.id} ${s.desc ? 'desc' : 'asc'}`).join(', ')
      const filter = [req.filterModel.global ? `"${req.filterModel.global}"` : '', ...Object.keys(req.filterModel.columns ?? {})].filter(Boolean).join(', ')
      requestLog = [`${groupBy.length ? `group by ${groupBy.join(' > ')} at [${keys.join(' > ')}]` : 'flat'} rows ${req.startRow}-${req.endRow}${sort ? ` sort ${sort}` : ''}${filter ? ` filter ${filter}` : ''}`, ...requestLog].slice(0, 6)
      const grandTotal = req.needsGrandTotal ? { ...totals(where(DB, req)), id: where(DB, req).length } as unknown as Sale : undefined
      if (keys.length < groupBy.length) {
        // A GROUP row per distinct key at this level, with its aggregates and
        // how many rows the next level holds.
        const field = groupBy[keys.length]!
        const byKey = new Map<string, Sale[]>()
        for (const r of rows) { const k = String((r as Record<string, unknown>)[field]); (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(r) }
        const next = groupBy[keys.length + 1]
        const groups = [...byKey.entries()].map(([k, members]) => ({
          [field]: k, ...totals(members), id: members.length,
          childCount: next ? new Set(members.map((m) => (m as Record<string, unknown>)[next])).size : members.length,
        })) as unknown as Sale[]
        const sorted = orderBy(groups as unknown as Record<string, unknown>[], req) as unknown as Sale[]
        return { rows: sorted.slice(req.startRow, req.endRow), rowCount: sorted.length, grandTotal }
      }
      // LEAF rows under the path, one block at a time.
      rows = orderBy(rows as unknown as Record<string, unknown>[], req) as unknown as Sale[]
      return { rows: rows.slice(req.startRow, req.endRow), rowCount: rows.length, grandTotal }
    },
    async updateRow(id, patch) {
      await new Promise((r) => setTimeout(r, 100))
      const row = DB.find((r) => String(r.id) === id)!
      Object.assign(row, patch)
      return { ...row }
    },
  }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  // Only the selection example ticks rows.
  const selectFeatures = tableFeatures({ rowSortingFeature, columnFilteringFeature, rowSelectionFeature })
  const usd = { type: 'number' as const, options: { style: 'currency' as const, currency: 'USD', maximumFractionDigits: 0 } }
  const flatColumns: GridColumns<Sale> = [
    { field: 'id', header: 'Id', width: 80, align: 'right' },
    { field: 'region', header: 'Region', width: 110 },
    { field: 'country', header: 'Country', width: 140 },
    { field: 'rep', header: 'Rep', width: 100 },
    { field: 'product', header: 'Product', width: 110 },
    { field: 'qty', header: 'Qty', width: 80, align: 'right', format: { type: 'number' } },
    { field: 'amount', header: 'Amount', width: 130, align: 'right', format: usd },
  ]
</script>
```

## A page at a time

`createServerDataSource` is the free controller: it turns the grid's
sort, filter and pager into one `getRows` per change, tags each request
so a slow answer cannot overtake a fast one, and hands the grid a row
model. `rowModel={ctl}` wires every seam at once: the rows, the loading
flag, external sort and filter, and the pager fed with the server's
count.

```svelte {runnable}
<script lang="ts">
  let view = $state<ServerState<Sale>>()
  const ctl = createServerDataSource(source, { pageSize: 25, onChange: (s) => (view = s) })
  ctl.refresh()
</script>

<p style="font-size: 12px; font-family: monospace">{requestLog[0] ?? 'loading'}{view?.total !== undefined ? ` · ${view.total.toLocaleString()} rows on the server` : ''}</p>
<SvGrid rowModel={ctl} columns={flatColumns} {features} sortable filterable pageable containerHeight={360} />
```

Sort by Amount, filter Country, turn a page: each is one request with
`startRow`, `endRow`, `sortModel` and `filterModel` on it, and the
server's `rowCount` is what the pager counts. The grid holds 25 rows.

## Infinite scroll

`mode: 'infinite'` drops the pager: the scrollbar spans the whole result,
blocks of `blockSize` rows load as the viewport reaches them, and
placeholder rows stand in for the rest. `maxBlocksInCache` puts an LRU
cap on the blocks kept, so the memory stays flat however far someone
scrolls; without it every loaded block stays. The server is unchanged.

```svelte {runnable}
<script lang="ts">
  let view = $state<ServerState<Sale>>()
  const ctl = createServerDataSource(source, { mode: 'infinite', blockSize: 100, maxBlocksInCache: 20, onChange: (s) => (view = s) })
  ctl.refresh()
</script>

<p style="font-size: 12px; font-family: monospace">{requestLog[0] ?? 'loading'}</p>
<SvGrid rowModel={ctl} columns={flatColumns} {features} sortable filterable containerHeight={360} />
```

Drag the scrollbar to the bottom: the last block loads first, the ones
above it as you pass them. [Server-side infinite scroll](./server-infinite-scroll.md)
covers the cache, retries and the unknown-count mode.

## Group on the server

Grouping a hundred thousand rows in the browser means shipping them
first. `createServerRowModel` from `@svgrid/enterprise` sends `groupBy`
and `groupKeys` instead: the server answers a top-level request with one
row per region carrying its sums, an expand with the countries under
that region, and a second expand with the raw rows. The model keeps a
block cache per level; the grid holds what is open.

The group column is a column like any other, drawn by `SvGroupCell`
(the expander, the indent, the count) with `serverGroupText` as the text
behind it for copy and export. `grandTotalRow` asks the server for the
totals over everything (`needsGrandTotal` on the request) and pins them.

```svelte {runnable}
<script lang="ts">
  type Row = ServerRowModelGridRow<Sale>
  let view = $state<ServerRowModelState<Sale>>()
  const ctl = createServerRowModel<Sale>(source, {
    groupBy: ['region', 'country'],
    aggregations: [{ col: 'amount', fn: 'sum' }, { col: 'qty', fn: 'sum' }, { col: 'id', fn: 'count' }],
    getRowId: (r) => String(r.id),
    childCount: (r) => r.childCount,
    grandTotalRow: 'pinnedBottom',
    blockSize: 50,
    isGroupOpenByDefault: (route) => route[0] === 'Americas' && route.length === 1,
    onChange: (s) => (view = s),
  })
  ctl.refresh()
  $effect(() => () => ctl.dispose())

  const columns: GridColumns<Row> = [
    {
      id: 'group', header: 'Region / country / rep', width: 260, sortable: false, filterable: false,
      fieldFn: (row) => serverGroupText(row, 'rep'),
      cell: (ctx) => renderComponent(SvGroupCell, { row: ctx.row.original, onToggle: () => ctl.group.onToggle(ctx.row.original), leafField: 'rep' }),
    },
    // A group row carries the count under `id`; only a leaf shows it as an id.
    { field: 'id', header: 'Rows', width: 90, align: 'right', formatter: ({ value, row }) => (row?.original.__group?.kind === 'leaf' ? '' : Number(value).toLocaleString()) },
    { field: 'product', header: 'Product', width: 110 },
    { field: 'qty', header: 'Qty', width: 90, align: 'right', format: { type: 'number' } },
    { field: 'amount', header: 'Amount', width: 140, align: 'right', format: usd },
  ]
</script>

<p style="font-size: 12px; font-family: monospace">{requestLog[0] ?? 'loading'}</p>
<SvGrid rowModel={ctl} {columns} {features} stickyGroupRows sortable containerHeight={400} />
```

Open EMEA, then Germany: two requests, each with a longer `groupKeys`,
and the log line says what the server was asked. Sort by Amount and the
groups reorder on the server, since a sorted level is a sorted query.
The pinned row at the bottom is the grand total the server computed over
every row it holds.

## Let the user choose the groups

`SvRowGroupPanel` is the chip bar: its Group by select adds a column,
the chips reorder by drag or Alt+Arrow, and each chip has a close.
`setGroupBy` on the model is what it calls, and the model refetches from
the top with the new `groupBy`. The columns and the cache are the model's business,
so the panel and the grid stay one line each.

```svelte {runnable}
<script lang="ts">
  type Row = ServerRowModelGridRow<Sale>
  let view = $state<ServerRowModelState<Sale>>()
  const ctl = createServerRowModel<Sale>(source, {
    groupBy: ['region'],
    aggregations: [{ col: 'amount', fn: 'sum' }, { col: 'qty', fn: 'sum' }, { col: 'id', fn: 'count' }],
    getRowId: (r) => String(r.id),
    childCount: (r) => r.childCount,
    groupFooters: true,
    blockSize: 50,
    onChange: (s) => (view = s),
  })
  ctl.refresh()
  $effect(() => () => ctl.dispose())

  const groupable = [
    { id: 'region', label: 'Region' }, { id: 'country', label: 'Country' }, { id: 'rep', label: 'Rep' }, { id: 'product', label: 'Product' },
  ]
  const columns: GridColumns<Row> = [
    { id: 'group', header: 'Group', width: 260, sortable: false, filterable: false, fieldFn: (row) => serverGroupText(row, 'id'), cell: (ctx) => renderComponent(SvGroupCell, { row: ctx.row.original, onToggle: () => ctl.group.onToggle(ctx.row.original), leafField: 'id' }) },
    { field: 'qty', header: 'Qty', width: 90, align: 'right', format: { type: 'number' } },
    { field: 'amount', header: 'Amount', width: 140, align: 'right', format: usd },
  ]
</script>

<SvRowGroupPanel columns={groupable} groupBy={view?.groupBy ?? []} onChange={(g) => ctl.setGroupBy(g)} />
<SvGrid rowModel={ctl} {columns} {features} stickyGroupRows containerHeight={380} />
```

Add Product, then drag it ahead of Region: the tree rebuilds from the
server each time, and `groupFooters` puts a subtotal row under every
expanded group. `applyMode="deferred"` on the panel batches the chips
behind an Apply button for a backend where each regroup is expensive.

<div data-docs-demo="496-server-grouping-model" data-height="560"></div>

## An edit becomes a transaction

A leaf edit is one `updateRow` on the source, applied back into the
loaded level as a transaction, without a refetch. The group above it
does not know its subtotal changed, so the edit handler refreshes that
one route: a targeted `refresh({ route })`, not the tree.

```svelte {runnable}
<script lang="ts">
  type Row = ServerRowModelGridRow<Sale>
  let view = $state<ServerRowModelState<Sale>>()
  const ctl = createServerRowModel<Sale>(source, {
    groupBy: ['region'],
    aggregations: [{ col: 'amount', fn: 'sum' }, { col: 'qty', fn: 'sum' }, { col: 'id', fn: 'count' }],
    getRowId: (r) => String(r.id),
    childCount: (r) => r.childCount,
    blockSize: 50,
    isGroupOpenByDefault: (route) => route[0] === 'APAC',
    onChange: (s) => (view = s),
  })
  ctl.refresh()
  $effect(() => () => ctl.dispose())

  async function onEdit(e: { row: Row; columnId: string; newValue: unknown; oldValue: unknown }) {
    const meta = e.row.__group
    if (meta.kind !== 'leaf' || Object.is(e.newValue, e.oldValue)) return
    await ctl.updateRow(String(e.row.id), { [e.columnId]: e.newValue } as Partial<Sale>)
    const route = meta.route ?? []
    if (route.length) ctl.refresh({ route: route.slice(0, -1) })
  }
  const columns: GridColumns<Row> = [
    { id: 'group', header: 'Region / rep', width: 220, sortable: false, filterable: false, editable: false, fieldFn: (row) => serverGroupText(row, 'rep'), cell: (ctx) => renderComponent(SvGroupCell, { row: ctx.row.original, onToggle: () => ctl.group.onToggle(ctx.row.original), leafField: 'rep' }) },
    { field: 'product', header: 'Product', width: 110, editable: false },
    { field: 'qty', header: 'Qty', width: 90, align: 'right', format: { type: 'number' }, editorType: 'number', cellFlash: true },
    { field: 'amount', header: 'Amount', width: 140, align: 'right', format: usd, editorType: 'number', cellFlash: true },
  ]
</script>

<SvGrid rowModel={ctl} {columns} {features} stickyGroupRows editable containerHeight={380} onCellValueChange={onEdit} />
```

Double-click an Amount under APAC and change it: the cell flashes, the
server row is updated, and the APAC subtotal above it is fetched again.
`createRow` and `deleteRow` are the same shape, and
[transactions](./server-transactions.md) covers the feed case, where the
server pushes rows the grid did not ask for.

## A selection that is a rule

With rows the grid has never seen, "select all" cannot be a list of ids.
`selection: { groupSelects: 'descendants' }` makes the model keep a rule
instead, "everything, except these", per group, and the checkboxes read
and write it. `getSelectionState()` returns the rule as plain data, for
a bulk edit the server applies by rule (`updateWhere` on the source) or
a selection that survives a reload.

```svelte {runnable}
<script lang="ts">
  type Row = ServerRowModelGridRow<Sale>
  let view = $state<ServerRowModelState<Sale>>()
  const ctl = createServerRowModel<Sale>(source, {
    groupBy: ['region', 'country'],
    aggregations: [{ col: 'amount', fn: 'sum' }, { col: 'id', fn: 'count' }],
    getRowId: (r) => String(r.id),
    childCount: (r) => r.childCount,
    selection: { groupSelects: 'descendants' },
    grandTotalRow: 'pinnedBottom',
    blockSize: 50,
    isGroupOpenByDefault: (route) => route[0] === 'EMEA' && route.length === 1,
    onChange: (s) => (view = s),
  })
  ctl.refresh()
  $effect(() => () => ctl.dispose())
  const rule = $derived.by(() => { void view; return JSON.stringify(ctl.getSelectionState() ?? null) })

  const columns: GridColumns<Row> = [
    { id: 'group', header: 'Region / country', width: 240, sortable: false, filterable: false, fieldFn: (row) => serverGroupText(row, 'rep'), cell: (ctx) => renderComponent(SvGroupCell, { row: ctx.row.original, onToggle: () => ctl.group.onToggle(ctx.row.original), leafField: 'rep' }) },
    { field: 'id', header: 'Rows', width: 90, align: 'right', formatter: ({ value, row }) => (row?.original.__group?.kind === 'leaf' ? '' : Number(value).toLocaleString()) },
    { field: 'amount', header: 'Amount', width: 140, align: 'right', format: usd },
  ]
</script>

<p style="font-size: 12px; font-family: monospace; word-break: break-all">rule: {rule}</p>
<SvGrid rowModel={ctl} {columns} features={selectFeatures} stickyGroupRows showRowSelection containerHeight={380} />
```

Tick the header checkbox, then untick Germany: the rule reads
"everything, and within EMEA everything except Germany", a
`selectAllChildren: false` under the EMEA key. A bulk edit sent with
that rule reaches the rows it covers on the server, loaded or not; the
grand total row is the server's total and does not follow the
selection. The [selection page](./server-selection.md) has both rule
shapes and the bulk edit.

## What the grid never did

Sort a column and the server sorted; filter, and the server filtered;
open a group, and the server grouped. The grid held a few hundred rows
through all of it. That is the whole idea, and the rest of the row model
is more of the same request: `treeData` for a hierarchy loaded on expand
([tree data](./server-tree-data.md)), `pivotBy` and `pivotMode` for a
pivot the server computes ([pivot](./server-pivot.md)), and a
`planQuery` / `planToSql` pair that writes the SQL for any of them
([grouping](./server-grouping.md#you-probably-do-not-have-to-write-that)).

<div data-docs-demo="467-server-row-model-1m" data-height="640"></div>

## See also

- [Server-Side Row Model](./server-row-model.md) - the request and the result, field by field, and the SQL translation.
- [Server grouping](./server-grouping.md) - level params, footers, refresh and retry per route, paging over the tree.
- [Server transactions](./server-transactions.md) - rows the server pushes.
- [Server selection](./server-selection.md) - the rule shapes and `updateWhere`.
- [Server row model: CRUD](../../../examples/src/demos/482-server-crud.svelte) - the demo with the full write side.
