---
title: Debounce vs Throttle (for Grids and Beyond)
description: Debounce and throttle are not interchangeable. Here is when each one belongs in your data grid, with real code for filter inputs, live feeds, and scroll.
date: 2026-07-22
updated: "2026-07-02"
category: Concepts
tags: debounce, throttle, performance, concepts, data grid
author: Kamelia M
---

Developers mix these up constantly. The result is a filter box that fires a server request on every keystroke, or a live price feed that delivers one burst at the end and looks frozen the rest of the time. Both are fixable in ten lines of code - once you know which tool to reach for.

The core distinction is about *when* you care about the value. Do you want it after the activity settles, or at a controlled rate while it is still happening? Those are two different problems.

## What debounce actually does

Debounce delays execution until after a burst of calls has stopped. Each new call resets the timer. Only the last one fires.

```ts
let timer: ReturnType<typeof setTimeout>

function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
  return ((...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }) as T
}

// Typical usage with a SvGrid filter input
const debouncedFilter = debounce((value: string) => {
  api.setFilter('name', { operator: 'contains', value })
}, 300)
```

The 300ms window is common for search inputs. Under 150ms and you might as well not bother - the network round trip will dominate anyway. Over 500ms and users start to feel the lag.

## What throttle actually does

Throttle lets a function run at most once per interval, even if it is called hundreds of times during that interval. It does not wait for the activity to stop - it runs *during* it, on a schedule.

```ts
function throttle<T extends (...args: unknown[]) => void>(fn: T, interval: number): T {
  let lastRun = 0
  return ((...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastRun >= interval) {
      lastRun = now
      fn(...args)
    }
  }) as T
}

// Throttle a scroll handler - runs at most every 100ms
const onScroll = throttle((event: Event) => {
  // custom scroll tracking, analytics, etc.
  const target = event.target as HTMLElement
  updateScrollPosition(target.scrollTop)
}, 100)
```

For DOM-driven throttling like scroll or resize, `requestAnimationFrame` is often a better throttle than a time-based one, because it aligns with the browser's render cycle rather than an arbitrary millisecond interval.

## Applying this to a data grid

A data grid surfaces both patterns in concrete, everyday situations.

### Filter inputs (debounce)

Server-side filtering is the canonical debounce case. You are wiring a text input to an API call, and you want exactly one call per "finished thought" from the user, not one per character.

```svelte
<script>
  import SvGrid from '@svgrid/grid'
  import { createServerDataSource } from '@svgrid/grid'
  import type { SvGridApi } from '@svgrid/grid'

  let api: SvGridApi | undefined = $state(undefined)

  const ds = createServerDataSource({
    fetch: async ({ page, pageSize, filters }) => {
      const params = new URLSearchParams({
        page: String(page),
        size: String(pageSize),
      })
      // filters is the processed filter state from SvGrid
      if (filters.name) {
        params.set('name', String(filters.name.value))
      }
      const res = await fetch(`/api/products?${params}`)
      const json = await res.json()
      return { rows: json.data, total: json.total }
    }
  })

  const columns = [
    { id: 'name', field: 'name', header: 'Name', width: 220 },
    { id: 'price', field: 'price', header: 'Price', width: 120, type: 'number' as const },
    { id: 'sku', field: 'sku', header: 'SKU', width: 140 },
  ]

  let timer: ReturnType<typeof setTimeout>

  function onSearchInput(e: Event) {
    const value = (e.target as HTMLInputElement).value
    clearTimeout(timer)
    timer = setTimeout(() => {
      // This triggers a refetch through the server data source
      api?.setFilter('name', { operator: 'contains', value })
    }, 300)
  }
</script>

<input type="search" oninput={onSearchInput} placeholder="Search products..." />
<SvGrid data={ds} {columns} pageable onApiReady={(a) => { api = a }} />
```

The key detail: `api.setFilter` triggers a refetch through the `createServerDataSource`. Without the debounce, a user typing "laptop" would fire six requests. With it, one request fires 300ms after they stop.

### Live data feeds (throttle with rAF)

A WebSocket price feed can push dozens of updates per second. Rendering each one individually would destroy performance. The right pattern is to accumulate updates and flush them on animation frames.

```ts
import { createServerDataSource } from '@svgrid/grid'
import type { SvGridApi } from '@svgrid/grid'

let api: SvGridApi | undefined
let pending: Record<string, unknown>[] = []
let scheduled = false

function flush() {
  if (pending.length > 0) {
    api?.applyTransaction({ update: pending })
    pending = []
  }
  scheduled = false
}

function onPriceUpdate(row: Record<string, unknown>) {
  pending.push(row)
  if (!scheduled) {
    scheduled = true
    requestAnimationFrame(flush)
  }
}

// Wire to WebSocket
const socket = new WebSocket('wss://prices.example.com')
socket.onmessage = (event) => {
  const data = JSON.parse(event.data)
  onPriceUpdate(data)
}
```

This pattern means the grid re-renders at 60fps maximum, regardless of how fast the feed comes in. The `scheduled` flag prevents stacking multiple rAF calls.

## The decision in plain terms

| Situation | Tool | Why |
|---|---|---|
| Filter/search input | Debounce (250-350ms) | You want the result after typing ends |
| Autosave while editing | Debounce (1-2s) | Save once per "pause", not per keystroke |
| WebSocket / live feed | Throttle (rAF) | You want updates at a steady rate during the stream |
| Window resize handler | Debounce or rAF | Depends - recompute layout after done (debounce), or track position live (rAF) |
| Scroll position tracking | rAF throttle | Continuous, but at frame rate |
| Column drag / row drag | rAF throttle | Smooth visual feedback requires frame-aligned updates |

## The common swap mistake

If you debounce a live feed, the grid appears frozen for the duration of the feed and then jumps to the latest value when the stream pauses. That is confusing and looks like a bug.

If you throttle a search input, queries fire mid-word. "lap" triggers a request before "laptop" is finished. On a slow backend that can cause stale results to arrive after the correct ones, depending on response ordering.

The decision is about whether you care about *the latest value after things settle* or *the current value at regular intervals*. Those are different questions. Pick the right one and the implementation is five lines.
