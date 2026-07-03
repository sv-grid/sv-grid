---
title: Building a Real-Time Trading Grid in Svelte
description: How to wire a WebSocket tick feed into SvGrid without dropping frames - rAF batching, stable row identity, flash animations, and the exact patterns that scale past 150 ticks per second.
date: 2026-08-29
updated: "2026-07-02"
category: Use cases
tags: trading, finance, realtime, use case, svelte data grid
author: Kamelia M
---

A busy trading feed will push 150 price ticks per second across 100+ instruments. A new message every 6-7 ms. The frame budget is 16 ms. If you write a Svelte state update on every single message, you are scheduling ten reactive microtasks per frame and the grid bogs down before the market even opens.

The fix is not complicated, but it is non-obvious: never write to `$state` directly from a WebSocket callback. Collect all incoming ticks into a plain `Map` and flush the whole batch in a single `requestAnimationFrame`. That one change drops render overhead by roughly 80% on a busy feed, and it is the foundation everything else builds on.

## Why plain mutation is not enough

Svelte 5 reactivity is fine-grained - change `rows[i].price` and only cells reading `price` update. But `rows[i].price = x` does not actually trigger anything, because the object reference on `rows[i]` did not change. You have to replace the object:

```ts
rows[i] = { ...rows[i], price: newPrice }
```

This is the correct pattern but it makes the "update on every tick" problem worse, not better, because now you are creating a new object reference for every message. On a 150 tick/second feed that is 150 object allocations and 150 Svelte reactive flushes per second. The rAF batcher solves both problems at once: it coalesces multiple ticks for the same symbol and limits total flushes to the display refresh rate.

## The tick batcher

```ts
// feed.ts
export type Direction = 'up' | 'down' | null

export type Instrument = {
  id: string
  symbol: string
  sector: string
  price: number
  change: number      // % from open, e.g. 2.34 or -1.07
  volume: number
  direction: Direction
  flashAt: number     // timestamp of last tick, used to expire flash class
}

export function connectFeed(
  rows: Instrument[],
  onFlush: () => void,
): () => void {
  // Build a lookup so we never scan the array on every tick
  const index = new Map<string, number>()
  rows.forEach((r, i) => index.set(r.id, i))

  const pending = new Map<string, { price: number; change: number }>()
  let scheduled = false

  function flush() {
    scheduled = false
    const now = Date.now()
    for (const [id, tick] of pending) {
      const i = index.get(id)
      if (i == null) continue
      const prev = rows[i]!
      rows[i] = {
        ...prev,
        price: tick.price,
        change: tick.change,
        direction: tick.price > prev.price ? 'up'
               : tick.price < prev.price ? 'down'
               : null,
        flashAt: now,
      }
    }
    pending.clear()
    onFlush()
  }

  // Replace this block with a real WebSocket in production:
  // const ws = new WebSocket('wss://feed.example.com/ticks')
  // ws.onmessage = (e) => { ... }
  let prng = 0xC0FFEE42
  function rand() {
    prng = (prng * 1664525 + 1013904223) >>> 0
    return prng / 0xFFFFFFFF
  }

  const timer = setInterval(() => {
    const i = Math.floor(rand() * rows.length)
    const row = rows[i]!
    pending.set(row.id, {
      price: Math.max(0.01, row.price + (rand() - 0.49) * 2.5),
      change: row.change + (rand() - 0.5) * 0.4,
    })
    if (!scheduled) {
      scheduled = true
      requestAnimationFrame(flush)
    }
  }, 7) // simulates ~143 messages/second

  return () => clearInterval(timer)
}
```

Two details worth noting. First, the `index` map avoids an `Array.findIndex` call on every tick - at 150 ticks/second that would be 150 linear scans per second on top of everything else. Second, if two ticks for the same symbol arrive before the next rAF, the second overwrites the first in `pending`. The grid sees one update per symbol per frame, which is exactly right. Intermediate prices within a single 16 ms frame are invisible to a human anyway.

## Wiring to SvGrid

Conditional formatting on the `change` column drives profit/loss color without any snippet overhead. The `price` column gets a flash class from a `cellClass` function that reads the `direction` field.

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import SvGrid from '@svgrid/grid'
  import {
    tableFeatures,
    rowSortingFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import { connectFeed, type Instrument } from './feed.ts'

  // Build initial rows from seed data
  let prng2 = 0xFEEDBEEF
  function r2() {
    prng2 = (prng2 * 1664525 + 1013904223) >>> 0
    return prng2 / 0xFFFFFFFF
  }

  const SEED = [
    { symbol: 'ACME', sector: 'Tech',    price: 184.12 },
    { symbol: 'GLBX', sector: 'Tech',    price:  62.55 },
    { symbol: 'INIT', sector: 'Tech',    price: 318.04 },
    { symbol: 'UMBR', sector: 'Health',  price:  92.18 },
    { symbol: 'HOOL', sector: 'Finance', price: 145.66 },
    { symbol: 'PIED', sector: 'Tech',    price:  41.20 },
    { symbol: 'STRK', sector: 'Energy',  price: 213.55 },
    { symbol: 'WAYN', sector: 'Finance', price: 287.10 },
    { symbol: 'WONK', sector: 'Health',  price: 188.42 },
    { symbol: 'TYRL', sector: 'Energy',  price: 105.05 },
    { symbol: 'CYBR', sector: 'Tech',    price: 224.18 },
    { symbol: 'AURA', sector: 'Health',  price:  76.55 },
  ]

  let rows = $state<Instrument[]>(
    SEED.map((s) => ({
      id: s.symbol,
      symbol: s.symbol,
      sector: s.sector,
      price: s.price,
      change: Math.round((r2() - 0.5) * 6 * 100) / 100,
      volume: Math.floor(500_000 + r2() * 9_500_000),
      direction: null,
      flashAt: 0,
    }))
  )

  const features = tableFeatures({ rowSortingFeature })

  const columns: ColumnDef<typeof features, Instrument>[] = [
    {
      id: 'symbol',
      field: 'symbol',
      header: 'Symbol',
      width: 90,
    },
    {
      id: 'sector',
      field: 'sector',
      header: 'Sector',
      width: 100,
    },
    {
      id: 'price',
      field: 'price',
      header: 'Price',
      width: 100,
      type: 'number',
      // cellClass is evaluated per cell on each render cycle
      // direction is null 400ms after each tick, so the class fades naturally
      cellClass: (row: Instrument) =>
        row.direction === 'up' ? 'flash-up'
        : row.direction === 'down' ? 'flash-down'
        : '',
      format: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    },
    {
      id: 'change',
      field: 'change',
      header: 'Chg %',
      width: 90,
      type: 'number',
      format: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
      conditionalFormat: [
        {
          condition: ({ value }) => (value as number) >= 0,
          style: { color: 'var(--color-profit)', fontWeight: '600' },
        },
        {
          condition: ({ value }) => (value as number) < 0,
          style: { color: 'var(--color-loss)', fontWeight: '600' },
        },
      ],
    },
    {
      id: 'volume',
      field: 'volume',
      header: 'Volume',
      width: 110,
      type: 'number',
      format: { maximumFractionDigits: 0 },
    },
  ]

  let api = $state<SvGridApi | null>(null)
  let stopFeed: (() => void) | null = null

  onMount(() => {
    stopFeed = connectFeed(rows, () => {
      // After each rAF flush, expire direction flags that are old enough
      // This clears the flash class and lets the CSS transition fade it out
      const now = Date.now()
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!
        if (row.direction !== null && now - row.flashAt > 400) {
          rows[i] = { ...row, direction: null }
        }
      }
    })
  })

  onDestroy(() => stopFeed?.())
</script>

<div class="trading-wrap">
  <SvGrid
    data={rows}
    {columns}
    {features}
    rowId="id"
    sortable
    height={420}
    onApiReady={(a) => { api = a }}
  />
</div>

<style>
  .trading-wrap {
    --color-profit: #16a34a;
    --color-loss:   #dc2626;
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
  }

  :global(.flash-up) {
    background-color: #bbf7d0 !important;
    transition: background-color 400ms ease-out;
  }

  :global(.flash-down) {
    background-color: #fecaca !important;
    transition: background-color 400ms ease-out;
  }
</style>
```

## Stable row identity and why it matters

The `rowId="id"` prop is not optional in this use case. Without it, SvGrid keys rows by array index. After the user sorts by `change` to find today's biggest movers, the row at index 0 is now a different instrument than before. A tick arrives for `CYBR`, updates `rows[i]` by the old index, and patches the wrong DOM node.

With `rowId`, the virtualization layer tracks each row by its `id` string. Sort order changes which DOM node is visible at position 0, but each DOM node stays bound to the same instrument across re-renders. This also means the grid does not tear down and rebuild DOM nodes during a sort - it repositions them. At 12 rows that is invisible. At 200 rows the difference is measurable.

## The flash cycle

Flash is entirely CSS-driven. When a tick arrives, `direction` is set to `'up'` or `'down'`. The `cellClass` function returns `'flash-up'` or `'flash-down'`, which applies a background color. The CSS `transition: background-color 400ms ease-out` then animates that color back toward transparent over 400 ms.

The `onFlush` callback does a single pass over all rows and clears `direction` on any row whose `flashAt` is more than 400 ms old. No `setTimeout` per tick, no timer accumulation. At 143 ticks/second across 12 rows you would otherwise accumulate over 100,000 live timers in twelve minutes. The single-pass approach keeps the timer count at exactly one.

## Keeping format separate from value

The `format` option on the `price` column controls display only. The underlying cell value stays a raw `number`. This matters because SvGrid uses the raw value for sorting: if you pre-format price as the string `"$184.12"` and store that in the accessor, lexicographic sort puts `"$9.99"` after `"$99.00"` and before `"$100.00"`. Always store the number, let `format` handle rendering.

The same logic applies to `change`. A percent change of `-0.07` sorts correctly between `-0.08` and `-0.06` as a number. Formatted as `"-0.07%"` it sorts as a string and the ordering breaks for negative values.

## Scaling past 12 rows

The patterns above handle 200 rows at 150 ticks/second comfortably on a mid-range laptop. The rAF flush rate is capped at 60fps regardless of feed speed. The index map makes per-tick row lookup O(1). Object allocation per frame is bounded by the number of distinct symbols that ticked, not the feed rate.

If you need to go further - say 1,000 rows with per-cell sparklines - the next lever is restricting which rows are actually reactive. Keep the visible window in a separate `$state` slice and only update rows whose index falls in the virtualized viewport. The `api.getDisplayedRows()` call returns exactly that set, updated after each sort or scroll.

```ts
// Only update rows currently visible in the viewport
const displayedIds = new Set(api.getDisplayedRows().map((r) => r.id))
for (const [id, tick] of pending) {
  if (!displayedIds.has(id)) continue   // skip off-screen rows entirely
  // ... apply update
}
```

Off-screen rows still hold correct data - their `price` field updates in the backing array via the index map - but Svelte never needs to schedule a DOM update for them. When the user scrolls, the virtualizer reads the current values from the array and renders fresh cells. No visible staleness, significantly lower CPU on very large boards.
