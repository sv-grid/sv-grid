---
title: Why Svelte 5 Changed Everything for Data Grids
description: Svelte 5 runes introduced signal-based, property-level reactivity. That single shift made a genuinely fast Svelte-native data grid possible in a way it never was before.
date: 2026-06-13
updated: 2026-07-02
category: Company
tags: svelte 5, reactivity, story, background
author: Boyko Markov
---

Reactivity in Svelte 4 was deceptively simple. You write `let rows = []`, reference it in a template, and the framework handles updates. Simple - until you have 10,000 rows updating at 50 mutations per second and you start watching the profiler light up like a Christmas tree.

The moment Svelte 5 shipped runes, the path to a genuinely fast Svelte-native grid opened up. Not because runes are a clever trick, but because they changed what the framework can track.

## What was actually slow before

In Svelte 4, reactive tracking works at the variable level. If you have `let rows = []` and you touch any element inside it, Svelte cannot know which element changed - the entire `rows` variable is the reactive node. So any update that flows through a `$:` derived block re-evaluates the whole expression.

For a sorted, filtered view over 5,000 rows, that means a full filter pass and a full sort on every incoming change, even if only a single cell's value shifted. At 50 WebSocket messages per second that is 250,000 comparisons per second just to maintain a view that changes by one row per tick.

The standard workaround was to be clever about batching, debounce updates, or write manual diffing logic that compared before and after states. All of that is book-keeping that leaks into your application code and fights against the simplicity that made Svelte appealing in the first place.

```ts
// Svelte 4: any update to `rows` triggers the whole derived block
let rows: Order[] = seed(5000)

$: filtered = rows
  .filter(r => r.region === activeRegion)
  .sort((a, b) => b.amount - a.amount)

function onMessage(msg: OrderUpdate) {
  // Must reassign the whole array to trigger reactivity -
  // a 5000-element allocation on every WebSocket tick
  rows = rows.map(r =>
    r.id === msg.id ? { ...r, status: msg.status, amount: msg.amount } : r
  )
}
```

Every call to `onMessage` allocates a new 5,000-element array, discards every object identity in the old array, and causes `filtered` to re-derive from scratch. Nothing in the framework can stop that chain.

## What runes actually change

Svelte 5 `$state` wraps objects in reactive proxies where each property is tracked independently. When you read `r.region` inside a `$derived`, the runtime records a dependency on that specific property of that specific object. A write to `rows[42].status` only invalidates nodes that declared a read on index 42's `status` - nothing else.

That single shift is what makes a data grid's internal architecture practical. The grid can hold `$derived` views over your data and trust that a cell update in row 3,847 will not trigger a full recompute of the filtered row set, unless the changed property is actually part of the filter predicate.

```svelte
<script lang="ts">
  import SvGrid, {
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Region = 'NA' | 'EU' | 'APAC'
  type Status = 'placed' | 'paid' | 'shipped' | 'delivered' | 'cancelled'

  type Order = {
    id: string
    customer: string
    region: Region
    amount: number
    status: Status
    placedAt: string
  }

  const CUSTOMERS = ['Helios Holdings', 'Atlas Trading', 'Cobalt Group', 'Aurora Labs']
  const REGIONS: Region[] = ['NA', 'EU', 'APAC']
  const STATUSES: Status[] = ['placed', 'paid', 'shipped', 'delivered', 'cancelled']

  let seed = 0xc0ffee
  function rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff }
  function pick<T>(a: T[]): T { return a[Math.floor(rand() * a.length)]! }

  function makeOrders(n: number): Order[] {
    return Array.from({ length: n }, (_, i) => ({
      id: `ORD-${10000 + i}`,
      customer: pick(CUSTOMERS),
      region: pick(REGIONS),
      amount: Math.round(50 + rand() * 9950),
      status: pick(STATUSES),
      placedAt: new Date(Date.now() - Math.floor(rand() * 90) * 86_400_000)
        .toISOString().slice(0, 10),
    }))
  }

  // $state makes each property of each Order independently trackable
  let rows = $state<Order[]>(makeOrders(5000))

  // This $derived only recomputes when a row's region or amount actually changes -
  // a status-only mutation is invisible to it
  let euOrders = $derived(
    rows.filter(r => r.region === 'EU').sort((a, b) => b.amount - a.amount)
  )

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  const columns: ColumnDef<Order>[] = [
    { id: 'id',       field: 'id',       header: 'Order ID',  width: 110 },
    { id: 'customer', field: 'customer', header: 'Customer',  width: 160 },
    { id: 'amount',   field: 'amount',   header: 'Amount',    width: 100 },
    { id: 'status',   field: 'status',   header: 'Status',    width: 110 },
    { id: 'placedAt', field: 'placedAt', header: 'Placed',    width: 110 },
  ]

  let api = $state<SvGridApi | null>(null)

  // Mutate in place - Svelte 5 tracks at the property level
  $effect(() => {
    const interval = setInterval(() => {
      const idx = Math.floor(rand() * rows.length)
      rows[idx].status = pick(STATUSES)
      rows[idx].amount = Math.round(50 + rand() * 9950)
    }, 40)
    return () => clearInterval(interval)
  })
</script>

<SvGrid
  {features}
  {columns}
  data={euOrders}
  rowHeight={32}
  virtualization={true}
  sortable
  filterable
  onApiReady={g => (api = g)}
/>
```

The key line is `rows[idx].status = pick(STATUSES)`. A direct property mutation, no spread, no array copy. When `status` changes, the cell in the grid that renders that field updates. When `amount` changes, `euOrders` recomputes because `amount` is part of the sort key. A `status` change alone does not touch `euOrders` at all. In Svelte 4, both mutations would produce the same expensive chain.

## The virtualizer connection

Fine-grained reactivity only tells half the story. A grid also needs to avoid rendering rows that are off-screen, and it needs to update only the visible slice when new data arrives.

SvGrid's virtualizer holds a `$derived` that computes the visible row window from scroll position and row height. That derived value is the only thing the DOM actually depends on. Out-of-viewport rows do not exist in the DOM at all - they are numbers in an offset calculation.

When a WebSocket mutation fires on row 3,847 and that row is not currently visible, the property-level tracking means:

1. `rows[3847].status` changes - tracked by the proxy.
2. `euOrders` is checked - if `status` is not part of the filter or sort, no recompute.
3. The virtualizer's visible-window derived is unaffected - scroll position did not change.
4. Zero DOM operations.

The mutation effectively costs nothing until that row scrolls into view.

## Wiring it to a live server feed

The pattern above uses a `setInterval` to simulate updates. In production you would wire the same mutation pattern to a WebSocket or SSE stream:

```ts
$effect(() => {
  const ws = new WebSocket('wss://api.example.com/orders/stream')

  ws.onmessage = (event) => {
    const msg: OrderUpdate = JSON.parse(event.data)
    const row = rows.find(r => r.id === msg.id)
    if (row) {
      // Mutate in place - preserves proxy identity, triggers only affected deriveds
      if (msg.status !== undefined) row.status = msg.status
      if (msg.amount !== undefined) row.amount = msg.amount
    }
  }

  return () => ws.close()
})
```

The `$effect` cleanup returning `ws.close()` matters. Without it, the socket outlives the component and keeps firing mutations against state that may no longer be mounted. The cleanup pattern is not optional ceremony - it is what prevents phantom updates after navigation.

One thing worth watching: if your server sends bulk updates (say, 200 rows changed in one message), do not loop and mutate inside the `onmessage` handler without batching. Each mutation is tracked synchronously. Svelte 5 does batch DOM flushes, but 200 rapid property mutations in one tick can still schedule more microtasks than you want. For bulk updates, apply them and then call `flushSync` from `svelte` if you need a single repaint checkpoint, or simply let the scheduler handle it - the grid will coalesce repaints naturally for updates that arrive in the same tick.

## The part that surprised me

Building on Svelte 5 runes removed an entire category of grid architecture decisions I expected to have to make. In React you would reach for `useMemo` with a carefully chosen dependency array. In Vue 3 you would use `computed` but wrestle with object identity when arrays are replaced. In Svelte 4 you would hand-write diffing or accept the cost.

With Svelte 5, you just write the natural data shape and mutate it naturally. The tracking is fine-grained enough that a well-written application falls into good performance by default. That does not mean you can ignore it - the traps around whole-array replacement and untracked reads are real - but the default is much better than any previous version.

That is the actual reason SvGrid is Svelte 5 only, not a compatibility flag or a lazy decision. The architecture that makes the grid fast is the architecture that only works with runes. There is no graceful fallback.
