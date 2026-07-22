# Real-time / streaming updates

How to drive the grid from a WebSocket / SSE / poll. Three patterns
ranked by the rate of change:

1. **Periodic full refresh** - poll for the latest rows, swap the array.
2. **Cell flash on change** - the same swap, but the renderer
   highlights cells whose values just changed.
3. **Delta merge with backlog** - WebSocket pushes individual row
   patches; you merge them into the in-memory state, optionally
   batching while the user has the page paused.

![A live WebSocket or SSE feed pushes deltas that apply as add, update, or remove operations, run through the grid as a keyed row transaction, and surface as a cell flash on the changed row.](/docs-media/grid-realtime.svg)

Try a streaming order desk - cell flashes on every change, pause / resume,
disconnect / reconnect, configurable throughput slider:

<div data-docs-demo="34-realtime-orders" data-height="520"></div>

## Pattern 1: periodic full refresh

The simplest reactive pattern. Poll every N seconds, hand the new
array down.

```svelte
<script lang="ts">
  let rows = $state<Order[]>([])

  $effect(() => {
    const id = setInterval(async () => {
      rows = await fetch('/api/orders').then((r) => r.json())
    }, 5_000)
    return () => clearInterval(id)
  })
</script>

<SvGrid data={rows} columns={columns} features={features} />
```

The grid re-renders the visible rows; virtualization keeps the cost
proportional to the viewport, not the dataset.

**Use when:** dataset is small (< 1000 rows), update rate is low (≥ 5 s),
"freshness" is the only requirement.

**Avoid when:** the user is mid-edit on a cell. A full swap mid-edit
will close the editor. Pause your refresh while
`onActiveCellChange` reports a non-null active cell.

## Pattern 2: cell flash on change

Same swap, but each cell snippet tracks its previous value and renders
a brief highlight when it differs.

```svelte
<script lang="ts">
  // Track per-row, per-field last-seen values.
  let lastSeen = new Map<string, Record<string, unknown>>()
  function diff(rowId: string, current: Record<string, unknown>): Record<string, boolean> {
    const prev = lastSeen.get(rowId)
    const changed: Record<string, boolean> = {}
    if (prev) for (const k of Object.keys(current)) if (prev[k] !== current[k]) changed[k] = true
    lastSeen.set(rowId, { ...current })
    return changed
  }
</script>

{#snippet PriceCell(props: { row: Order })}
  {@const changes = diff(props.row.id, props.row)}
  <span class={`tabular-nums ${changes.price ? 'flash' : ''}`}>
    {fmtMoney(props.row.price)}
  </span>
{/snippet}
```

```css
.flash {
  animation: flash-bg 800ms ease-out;
}
@keyframes flash-bg {
  from { background: rgba(250, 204, 21, 0.4); }
  to   { background: transparent; }
}
```

**Use when:** user wants to spot changes. The stock-ticker pattern.

**Avoid when:** the flash interferes with selection or accessibility -
add `prefers-reduced-motion` guards if the flash is purely
decorative.

## Pattern 3: delta merge with backlog

The grown-up pattern for higher-rate updates. The server pushes
individual row patches; you maintain an in-memory map and reassign the
array when needed.

```svelte
<script lang="ts">
  type OrderId = string
  let rowsMap = $state(new Map<OrderId, Order>())
  let paused = $state(false)
  let backlog = $state<Order[]>([])
  const flushDebounce = 200  // ms

  const rows = $derived(Array.from(rowsMap.values()))

  $effect(() => {
    const ws = new WebSocket('/api/orders/stream')
    ws.onmessage = (e) => {
      const patch: Order = JSON.parse(e.data)
      if (paused) {
        backlog = [...backlog, patch]
        return
      }
      applyPatch(patch)
    }
    return () => ws.close()
  })

  function applyPatch(patch: Order) {
    const next = new Map(rowsMap)
    next.set(patch.id, patch)
    rowsMap = next
  }

  function resume() {
    paused = false
    for (const p of backlog) applyPatch(p)
    backlog = []
  }
</script>

<button onclick={() => (paused = !paused)}>
  {paused ? `Resume (${backlog.length} pending)` : 'Pause'}
</button>

<SvGrid data={rows} columns={columns} features={features} />
```

A few production knobs:

- **Debounce the resignment.** A WebSocket spitting out 20 patches per
  second creates 20 array allocations per second. Batch into the next
  `requestAnimationFrame`:

  ```ts
  let pendingPatches: Order[] = []
  let scheduled = false
  function applyPatch(patch: Order) {
    pendingPatches.push(patch)
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      const next = new Map(rowsMap)
      for (const p of pendingPatches) next.set(p.id, p)
      rowsMap = next
      pendingPatches = []
      scheduled = false
    })
  }
  ```

- **Out-of-order safety.** Each patch carries a server-side sequence
  number; drop patches older than the latest you've applied for that
  row. The streaming demo (#34) shows this with `lastSeq` per row.

- **Disconnect handling.** On `ws.onclose`, set a status flag the user
  sees ("reconnecting…") and reconnect with exponential backoff. The
  demo shows the recovery flow.

## Pause during edit / selection

A common mistake: updates fly in while the user is mid-paste or
mid-edit. The fix is two flags:

```ts
let isEditing = $state(false)
let hasSelection = $state(false)
const isInteracting = $derived(isEditing || hasSelection)

$effect(() => {
  if (isInteracting) {
    paused = true
  } else if (paused) {
    resume()
  }
})
```

Wire to the grid:

```svelte
<SvGrid
  ...
  onEditingChange={(state) => (isEditing = state.cell != null)}
  onRowSelectionChange={({ selectedRows }) => (hasSelection = selectedRows.length > 0)}
/>
```

## Backpressure (when the server is too fast)

If your producer can outrun the UI's frame budget, sample down at the
client. Drop intermediate patches for the same row; only the newest
one survives:

```ts
function applyPatch(patch: Order) {
  // pendingPatches is keyed by row id so a fast-moving row only
  // commits its NEWEST value per frame.
  pendingPatches.set(patch.id, patch)
  /* ...schedule rAF... */
}
```

For 1000 rows updating at 5 Hz, this caps the work at 1000
assignments per frame regardless of the actual message rate. The
streaming demo's "throughput slider" stresses this exact path.

## Combining with sort + filter

The grid's sort + filter run AFTER your patches land in `rows`. Two
implications:

- **A row that no longer matches the filter disappears.** Expected.
- **The active row may move.** When `onActiveCellChange` fires with a
  new index because the row above shifted, your toolbar / detail panel
  should follow.

If you're using a side detail panel keyed on row id (not index),
this is a non-issue - the detail stays bound to the order even as
the row moves.

## See also

- [Server-side data](./server-side-data.md) - the pull side of
  remote data.
- [Saved views](./saved-views.md) - persist a "live mode on / off"
  toggle alongside the rest of the view config.
- [Performance benchmarks](./benchmarks.md) - measured per-frame cost
  of the patterns above.

## Frequently asked questions

### How do I show real-time data in SvGrid?

Drive the grid's `data` from a WebSocket, SSE, or poll. This page covers three
patterns ranked by update rate: periodic full refresh, targeted row patches via
`getRowId`, and high-frequency cell updates with change-flash highlighting.

### Will the grid keep my scroll and selection on live updates?

Yes, if you give rows a stable identity with `getRowId`. Then selection,
expansion, edit state, and scroll position survive incoming updates instead of
resetting on every refresh.

### How fast can SvGrid update?

Fast enough for tick-by-tick feeds - the stock-market demo updates 25 symbols
every 250 ms with green/red cell flashes while sorting and selection stay live.
For very high rates, patch only changed rows rather than swapping the whole
array.
