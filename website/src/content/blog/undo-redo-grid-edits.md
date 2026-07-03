---
title: Undo/Redo for Grid Edits in SvGrid
description: Wire Ctrl+Z and Ctrl+Y into an editable SvGrid in minutes - the history stack is built in, you just need to surface it correctly.
date: 2026-09-18
updated: "2026-07-02"
category: Editing
tags: undo, redo, editing, history, recipe
author: Boyko Markov
---
Most data grids treat undo as an afterthought - something you bolt on with a custom diff array and a lot of `structuredClone`. SvGrid ships `api.undo()`, `api.redo()`, `api.canUndo()`, and `api.canRedo()` as first-class API methods. The history stack is managed internally; your job is to wire up the keyboard shortcuts and keep your toolbar buttons honest.

The tricky part is not the stack itself. It is the reactivity: `canUndo()` and `canRedo()` are plain method calls, not Svelte signals. If you read them naively in a `$derived`, the buttons stay stale after edits because Svelte has no way to know the result changed. The `stateTick` pattern below solves that in four lines.

## What the history stack actually tracks

Every time a cell editor commits a value - user presses Enter, Tab, or clicks away - SvGrid records the before/after pair indexed by row id and column field. The stack is capped at 100 entries by default, which is enough for any realistic editing session without unbounded memory growth.

`api.undo()` pops the top entry and reverts the row data to its previous value. `api.redo()` replays it. Neither method touches your backend; they only affect the local row state held inside the grid. If you need server sync, you handle that separately in `onCellValueChange` - more on that at the end.

`api.clearHistory()` wipes both stacks without touching the data. The main use case is after a programmatic bulk import: you do not want a user pressing Ctrl+Z and undoing the entire data load down to an empty grid.

## Column setup for an editable inventory grid

This example uses an inventory table - eight rows of warehouse stock with editable name, location, quantity, and price columns. The SKU column is read-only because it is a primary key and should never appear in the undo stack.

```ts
import type { ColumnDef, SvGridApi } from '@svgrid/grid'
import { tableFeatures, rowSortingFeature, columnFilteringFeature } from '@svgrid/grid'

type Inventory = {
  id: string
  sku: string
  name: string
  location: 'East' | 'West' | 'Central'
  qty: number
  price: number
}

const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

const columns: ColumnDef<typeof features, Inventory>[] = [
  { field: 'sku',      header: 'SKU',      editable: false,                           width: 110 },
  { field: 'name',     header: 'Name',     editorType: 'text',                        width: 200 },
  { field: 'location', header: 'Location', editorType: 'select',
    editorOptions: ['East', 'West', 'Central'],                                        width: 140 },
  { field: 'qty',      header: 'Qty',      editorType: 'number',                      width: 100 },
  { field: 'price',    header: 'Price',    editorType: 'number',
    format: { type: 'currency', currency: 'USD' },                                     width: 130 },
]
```

Setting `editable: false` on the SKU column is the right approach when you want a column to never participate in history. There is no column-level undo exclusion in the stack itself - if a column is editable, its changes are recorded. Making it non-editable is the clean solution.

## The full component with keyboard shortcuts

The `stateTick` counter is the key pattern. It is an integer that increments after every committed edit, every undo, and every redo. Because `canUndo` and `canRedo` read `stateTick` inside `$derived.by`, Svelte knows to re-run those derivations whenever `stateTick` changes - which means the toolbar buttons reflect reality on every interaction.

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

  type Inventory = {
    id: string
    sku: string
    name: string
    location: 'East' | 'West' | 'Central'
    qty: number
    price: number
  }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  let rows = $state<Inventory[]>([
    { id: 'i01', sku: 'A-100', name: 'Steel sheet 1/2"',  location: 'East',    qty: 240,  price: 18.50  },
    { id: 'i02', sku: 'A-101', name: 'Steel sheet 3/4"',  location: 'West',    qty:  80,  price: 21.00  },
    { id: 'i03', sku: 'B-200', name: 'Stainless rivets',  location: 'East',    qty: 6800, price:  0.42  },
    { id: 'i04', sku: 'B-201', name: 'Brass rivets',      location: 'Central', qty: 1200, price:  0.38  },
    { id: 'i05', sku: 'C-300', name: 'Drill bit set',     location: 'West',    qty:  44,  price: 44.99  },
    { id: 'i06', sku: 'C-301', name: 'Impact driver',     location: 'Central', qty:  12,  price: 289.00 },
    { id: 'i07', sku: 'D-400', name: 'Wire rope 1/4"',    location: 'East',    qty:  60,  price:  2.85  },
    { id: 'i08', sku: 'D-401', name: 'Wire rope 3/8"',    location: 'West',    qty: 180,  price:  4.40  },
  ])

  let api = $state<SvGridApi<typeof features, Inventory> | null>(null)

  let stateTick = $state(0)
  const canUndo = $derived.by(() => { void stateTick; return api?.canUndo() ?? false })
  const canRedo = $derived.by(() => { void stateTick; return api?.canRedo() ?? false })

  function handleUndo() {
    api?.undo()
    stateTick++
  }

  function handleRedo() {
    api?.redo()
    stateTick++
  }

  const columns: ColumnDef<typeof features, Inventory>[] = [
    { field: 'sku',      header: 'SKU',      editable: false,                           width: 110 },
    { field: 'name',     header: 'Name',     editorType: 'text',                        width: 200 },
    { field: 'location', header: 'Location', editorType: 'select',
      editorOptions: ['East', 'West', 'Central'],                                        width: 140 },
    { field: 'qty',      header: 'Qty',      editorType: 'number',                      width: 100 },
    { field: 'price',    header: 'Price',    editorType: 'number',
      format: { type: 'currency', currency: 'USD' },                                     width: 130 },
  ]
</script>

<svelte:window onkeydown={(e) => {
  const EDITING_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA'])
  if (e.target instanceof Element && EDITING_TAGS.has(e.target.tagName)) return
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault()
    if (e.shiftKey) { handleRedo() } else { handleUndo() }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
    e.preventDefault()
    handleRedo()
  }
}} />

<div class="toolbar">
  <button onclick={handleUndo} disabled={!canUndo}>Undo</button>
  <button onclick={handleRedo} disabled={!canRedo}>Redo</button>
  <button onclick={() => { api?.clearHistory(); stateTick++ }}>Clear history</button>
</div>

<SvGrid
  {features}
  {columns}
  data={rows}
  editable
  onApiReady={(g) => { api = g }}
  onCellValueChange={() => { stateTick++ }}
  style="height: 360px; width: 100%;"
/>
```

A few things worth calling out about the keyboard handler. The guard uses a `Set` of tag names rather than `instanceof HTMLInputElement` because `<select>` and `<textarea>` are not `HTMLInputElement` instances but they still have native undo behavior that you should not stomp on. Without this broader guard, Ctrl+Z inside a select dropdown would simultaneously pop the SvGrid stack and confuse the browser's own input handling.

The `onCellValueChange` callback is what keeps `stateTick` incrementing after edits. If you forget to wire it up, the history stack still works internally - the API will happily undo and redo - but your toolbar buttons will never re-evaluate and will appear stuck regardless of what is in the stack.

## Resetting state after programmatic data loads

One pattern that bites people: loading fresh data programmatically and then seeing users undo into the previous dataset. After any `api.applyTransaction(...)` or `api.addRow(...)` call that represents a data load rather than a user action, clear the history immediately:

```ts
async function loadFreshInventory() {
  const res = await fetch('/api/inventory')
  const freshRows: Inventory[] = await res.json()

  api?.applyTransaction({ add: freshRows, remove: api.getData() })
  api?.clearHistory()
  stateTick++
}
```

The `clearHistory()` call after the transaction ensures the user cannot undo past the load boundary. Incrementing `stateTick` forces the toolbar buttons to re-evaluate and show as disabled, which is the correct state immediately after a clean load.

## Server sync when undo fires

`api.undo()` only reverts local state. If your grid is backed by a server, you need to listen for undo/redo events and issue the appropriate reverse requests yourself. The cleanest approach is to maintain a parallel log of committed edits:

```ts
type EditRecord = {
  rowId: string
  field: string
  before: unknown
  after: unknown
}

const editLog: EditRecord[] = []

// Record each edit as it commits
function onCellValueChange(event: { rowId: string; field: string; oldValue: unknown; newValue: unknown }) {
  editLog.push({
    rowId: event.rowId,
    field: event.field,
    before: event.oldValue,
    after: event.newValue,
  })
  stateTick++
}

// When undo fires, send the inverse to the server
async function handleUndo() {
  const record = editLog.pop()
  if (record) {
    await fetch(`/api/inventory/${record.rowId}`, {
      method: 'PATCH',
      body: JSON.stringify({ [record.field]: record.before }),
      headers: { 'Content-Type': 'application/json' },
    })
  }
  api?.undo()
  stateTick++
}
```

This is the pattern to use when the grid is connected to a live backend. The local stack handles the visual revert; your code handles the network call. You control the log depth and the error handling, which is the right separation for production use.

## Buttons stuck disabled after edits

This is the most common issue people hit with the undo API. The symptom is clear: you edit a cell, it commits, but the Undo button stays greyed out. Three things to check in order:

First, confirm `onCellValueChange` is wired up to the grid and that it increments whatever counter drives your `$derived.by`. If the callback is missing, the derivation never re-runs.

Second, confirm `canUndo` is read inside `$derived.by` with the tick variable referenced - not in a plain `$derived` expression and not called directly in the template. A bare `api?.canUndo()` in the template is computed once at mount and never again.

Third, confirm `editable` is set to `true` at the grid level or on individual columns. A grid without the `editable` prop does not register edits to the history stack because no edits are possible.

The runnable demo at `/demos/86-undo-redo` shows the complete inventory scenario with a timestamped audit log rendered alongside the grid, which is useful if you need to visually verify the stack depth and entry order during development.
