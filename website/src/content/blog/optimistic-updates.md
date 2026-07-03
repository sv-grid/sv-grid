---
title: Optimistic Updates - A Grid That Feels Instant
description: Apply cell edits to local state before the server responds, then roll back cleanly on failure. Here is how to wire it in SvGrid with real rollback logic and visual feedback.
date: 2025-12-23
updated: 2026-07-02
category: Editing
tags: optimistic updates, editing, ux, svelte data grid
author: Kamelia M
---

Most data grids wait for the server before showing the user's edit. That means a 200-400 ms freeze after every Enter key. Users start double-pressing. They wonder if their change was lost. They open the row again to check. The UX erodes trust.

Optimistic updates flip that: write to local `$state` first, fire the network request in the background, and roll back only if the server rejects the change. The grid responds in under 1 ms. The network round-trip becomes invisible.

## The core idea: mutate first, verify after

The `onCellEditEnd` callback in SvGrid gives you everything you need to implement this pattern. It fires after the user commits a change (Enter, Tab, or click-away) and provides the row index, row id, column id, old value, and new value - all synchronously, before any async work happens.

The ordering that makes optimistic updates work is simple:

1. Mutate `rows` immediately so Svelte re-renders the new value before the first `await`.
2. Track the pending write so you can roll it back and show visual state.
3. Fire the server request asynchronously.
4. On success, clear the pending marker. On failure, restore the old value.

```ts
// State types for tracking in-flight and failed writes
type Status = 'pending' | 'saved' | 'failed'
type CellKey = `${string}::${string}`
type WriteEntry = { status: Status; oldValue: unknown; message?: string }

const cellKey = (rowId: string, field: string): CellKey => `${rowId}::${field}`

let writes = $state<Record<CellKey, WriteEntry>>({})
```

That `WriteEntry` type is the entire bookkeeping surface. Everything else - rollback, CSS classes, error toasts - derives from reading and writing to this map.

## Rapid double-edits and the oldValue trap

There is one subtlety that bites almost everyone on a first implementation: the double-edit scenario.

A user edits a cell, and while the first request is still in flight, they edit the same cell again. If you store `e.oldValue` directly when the second edit fires, `oldValue` will be the post-first-edit value, not the original. If the second request also fails, you roll back to the wrong thing.

The fix is one line: seed `oldValue` from the existing `writes` entry if one is already pending for that cell.

```ts
const k = cellKey(e.rowId, e.columnId)
const oldValue = writes[k]?.oldValue ?? e.oldValue
```

This chains through any in-flight edit back to the last-confirmed server state.

## A working inventory editor

Here is a full Svelte 5 component wiring all of it together. The `serverPatch` function simulates a cloud API with 300-900 ms latency, an 8% random network failure, and two domain-level validation rules on price and stock.

```svelte
<script lang="ts">
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Item = {
    id: string
    sku: string
    name: string
    category: string
    price: number
    stock: number
  }

  let rows = $state<Item[]>([
    { id: 'I-001', sku: 'MUG-NAVY-12',  name: 'Logo mug 12 oz',        category: 'Drinkware',  price: 14.50, stock: 482 },
    { id: 'I-002', sku: 'TOTE-RED-L',   name: 'Canvas tote large',     category: 'Apparel',    price: 32.00, stock: 148 },
    { id: 'I-003', sku: 'NB-A5-HARD',   name: 'Hardcover notebook A5', category: 'Stationery', price: 18.50, stock: 365 },
    { id: 'I-004', sku: 'BOTTLE-32-OZ', name: 'Insulated bottle 32oz', category: 'Drinkware',  price: 34.00, stock:  92 },
    { id: 'I-005', sku: 'HAT-BB-NAVY',  name: 'Baseball hat navy',      category: 'Apparel',    price: 24.00, stock: 201 },
  ])

  type Status    = 'pending' | 'saved' | 'failed'
  type CellKey   = `${string}::${string}`
  type WriteEntry = { status: Status; oldValue: unknown; message?: string }

  const cellKey = (rowId: string, field: string): CellKey => `${rowId}::${field}`
  let writes = $state<Record<CellKey, WriteEntry>>({})

  // Toast queue
  let toasts = $state<Array<{ id: number; level: 'ok' | 'err'; text: string }>>([])
  let toastSeq = 0
  function pushToast(level: 'ok' | 'err', text: string) {
    const id = ++toastSeq
    toasts = [...toasts, { id, level, text }]
    setTimeout(() => { toasts = toasts.filter(t => t.id !== id) }, 4000)
  }

  async function serverPatch(
    rowId: string,
    field: keyof Item,
    next: unknown,
    prev: unknown,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    await new Promise<void>(r => setTimeout(r, 300 + Math.random() * 600))
    if (Math.random() < 0.08) return { ok: false, reason: 'Network blip - please retry' }
    if (field === 'stock') {
      const n = Number(next)
      if (n < 0)               return { ok: false, reason: 'Stock cannot be negative' }
      if (!Number.isInteger(n)) return { ok: false, reason: 'Stock must be a whole number' }
    }
    if (field === 'price') {
      const nx = Number(next), pv = Number(prev)
      if (!Number.isFinite(nx) || nx <= 0)
        return { ok: false, reason: 'Price must be greater than 0' }
      if (Math.abs(nx - pv) > pv * 0.5)
        return { ok: false, reason: `Price change exceeds 50% (was $${pv.toFixed(2)})` }
    }
    return { ok: true }
  }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let api = $state<SvGridApi<typeof features, Item> | null>(null)

  const columns: ColumnDef<typeof features, Item>[] = [
    { field: 'sku',      header: 'SKU',      editable: false, width: 130 },
    { field: 'name',     header: 'Name',     editorType: 'text',   width: 200 },
    { field: 'category', header: 'Category', editorType: 'select',
      editorOptions: ['Drinkware', 'Apparel', 'Stationery', 'Misc'], width: 130 },
    { field: 'price',    header: 'Price',    editorType: 'number',
      format: { type: 'currency', currency: 'USD' }, width: 110 },
    { field: 'stock',    header: 'Stock',    editorType: 'number', width: 90 },
  ]

  async function handleEditEnd(e: {
    rowId: string
    columnId: string
    oldValue: unknown
    newValue: unknown
    rowIndex: number
  }) {
    const k = cellKey(e.rowId, e.columnId)
    // Preserve the original value if this cell already has a pending write.
    const oldValue = writes[k]?.oldValue ?? e.oldValue

    // Step 1: apply immediately - Svelte renders before the first await.
    const newValue = ['price', 'stock'].includes(e.columnId)
      ? Number(e.newValue)
      : e.newValue
    rows[e.rowIndex] = { ...rows[e.rowIndex]!, [e.columnId]: newValue } as Item

    // Step 2: mark pending for visual feedback.
    writes = { ...writes, [k]: { status: 'pending', oldValue } }

    // Step 3: verify with the server.
    const result = await serverPatch(e.rowId, e.columnId as keyof Item, newValue, oldValue)

    if (result.ok) {
      writes = { ...writes, [k]: { status: 'saved', oldValue } }
      setTimeout(() => {
        const next = { ...writes }
        delete next[k]
        writes = next
      }, 1500)
    } else {
      // Roll back to the value that was there before any pending write for this cell.
      rows[e.rowIndex] = { ...rows[e.rowIndex]!, [e.columnId]: oldValue } as Item
      writes = { ...writes, [k]: { status: 'failed', oldValue, message: result.reason } }
      pushToast('err', `${e.columnId}: ${result.reason}`)
    }
  }

  function getCellClass(rowId: string, colId: string): string {
    const w = writes[cellKey(rowId, colId)]
    if (!w) return ''
    return w.status === 'pending' ? 'cell-pending'
         : w.status === 'failed'  ? 'cell-failed'
         : 'cell-saved'
  }
</script>

<div class="demo-wrap">
  <div class="toasts">
    {#each toasts as t (t.id)}
      <div class="toast toast-{t.level}">{t.text}</div>
    {/each}
  </div>

  <SvGrid
    {features}
    {columns}
    data={rows}
    onApiReady={g => (api = g)}
    onCellEditEnd={handleEditEnd}
    getCellClass={(rowId, colId) => getCellClass(rowId, colId)}
    height={320}
  />
</div>

<style>
  .demo-wrap { position: relative; font-family: sans-serif; }
  .toasts    { position: absolute; top: 8px; right: 8px; z-index: 10;
               display: flex; flex-direction: column; gap: 6px; }
  .toast     { padding: 8px 14px; border-radius: 6px; font-size: 13px;
               color: #fff; max-width: 280px; }
  .toast-ok  { background: #16a34a; }
  .toast-err { background: #dc2626; }
  :global(.cell-pending) { background: rgba(245,158,11,0.15) !important; }
  :global(.cell-failed)  { background: rgba(220,38,38,0.15)  !important;
                           outline: 1px solid #dc2626; }
  :global(.cell-saved)   { background: rgba(22,163,74,0.12)  !important; }
</style>
```

Replace `serverPatch` with a real `fetch` call and this is production-ready.

## Number values come back as strings

One thing to watch: `e.newValue` from an `editorType: 'number'` field is a string. The input element yields `"14.99"`, not `14.99`. If you store that directly into `rows`, the cell displays correctly (the formatter handles it), but your rollback comparison between the string new value and a numeric `oldValue` will produce false mismatches when the server rejects.

Cast explicitly before storing:

```ts
const newValue = ['price', 'stock'].includes(e.columnId)
  ? Number(e.newValue)
  : e.newValue
```

The example above already does this. Just do not forget it when you wire your own column set.

## Protecting pending cells from background refresh

If your app polls the server every 30 seconds and replaces `rows` wholesale, any in-flight optimistic write gets overwritten by the stale server value. Before applying a refresh, skip fields that have a pending entry in `writes`:

```ts
function mergeRefresh(fresh: Item[]): Item[] {
  return fresh.map(freshRow => {
    const local = rows.find(r => r.id === freshRow.id)
    if (!local) return freshRow

    const merged = { ...freshRow }
    for (const field of Object.keys(merged) as Array<keyof Item>) {
      const w = writes[cellKey(freshRow.id, field)]
      if (w?.status === 'pending') {
        // Keep the optimistic value in place until the write resolves.
        merged[field] = local[field] as never
      }
    }
    return merged
  })
}
```

Call `rows = mergeRefresh(serverData)` instead of `rows = serverData` and pending edits survive the refresh cycle.

## Silent rollbacks are worse than no rollback

A cell that snaps back to its previous value without explanation looks like the grid lost the user's input. At minimum, show a toast. Better still, keep the red `cell-failed` background until the user retries or explicitly dismisses it, so the failed cell is still visible after the toast disappears. The 4-second toast in the example above is the floor, not the ideal.

One more case worth handling: optimistic row deletion. Keep a copy of the row and its index before calling `api.removeRow`. On server rejection, splice it back at the saved index. The concept is the same as cell rollback - apply immediately, verify asynchronously, restore on failure.

The live demo is at `/demos/115` if you want to see the failure injection and rollback animation in practice.
