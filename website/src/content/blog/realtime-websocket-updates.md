---
title: Real-Time Grids - Live WebSocket Updates in SvGrid
description: Stream live data into a Svelte data grid over WebSockets without dropping frames, using batching and stable row identity.
date: 2025-12-30
category: Data
tags: realtime, websocket, live data, svelte data grid
author: Victor Vidolov
---

Trading desks, ops dashboards, monitoring tools, they all live or die on how fresh the numbers are. SvGrid takes a real-time stream in stride because Svelte 5's fine-grained reactivity repaints only the cells that changed. But the grid is only half of it; how you feed it matters just as much, and that is where people trip.

![Live WebSocket updates in a SvGrid grid](/blog-media/websocket-live.png)
*Live WebSocket updates streaming into a SvGrid grid.*

## Update in place, by identity

When a message arrives, find the row and update its fields, keeping the same object identity where you can:

```ts
socket.onmessage = (ev) => {
  const tick = JSON.parse(ev.data)
  const i = index.get(tick.symbol)
  if (i != null) rows[i] = { ...rows[i], price: tick.price, change: tick.change }
}
```

A `Map` from key to array index turns each update into an O(1) lookup, so a thousand updates a second stay cheap.

## Batch to the frame

A naive grid re-renders on every message. At high message rates that is wasted work, the screen only refreshes 60 times a second. Buffer updates and flush them on `requestAnimationFrame`:

```ts
let pending = new Map()
function queue(tick) {
  pending.set(tick.symbol, tick)
  scheduleFlush()
}
function flush() {
  for (const tick of pending.values()) applyTick(tick)
  pending.clear()
}
```

Now you paint at most once per frame no matter how fast the feed runs.

## Flash on change

Users want to see what moved. A brief background flash - green up, red down - draws the eye to changed cells. Drive it from a derived flag in your row and clear it after a short timeout, and the grid reads like a live ticker.

## Keep scrolling smooth

Live updates and virtualization are a natural pair: the feed updates the data, virtualization keeps the DOM bounded. A user scrolled deep into a 50,000-row grid still sees live prices on the visible rows without the off-screen rows costing anything.

## Frequently asked questions

### How do I show live WebSocket data in a Svelte data grid?

Update rows in place by identity on each message, using a key-to-index map for O(1) lookups, and let Svelte's reactivity repaint just the changed cells.

### How do I keep a real-time grid from dropping frames?

Batch incoming messages and flush them on `requestAnimationFrame`, so the grid paints at most once per frame regardless of message rate.
