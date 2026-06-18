---
title: Throttling Live Grid Updates to Animation Frames
description: Keep a real-time data grid smooth by batching high-frequency updates and flushing once per animation frame instead of on every message.
date: 2026-09-15
category: Performance
tags: performance, realtime, throttle, animation frame, recipe
author: Boyko Markov
---

A live feed - prices, sensors, logs - cheerfully pushes updates faster than the screen can possibly show them. Rendering on every message is just wasted work, since the display only repaints about 60 times a second. Batching updates to the animation frame is the single biggest fix for a stuttering real-time grid, and it is not much code.

![Live updates streaming into a SvGrid grid.](/blog-media/websocket-live.png)
*Live updates streaming into a SvGrid grid.*

## The problem

If you apply each message immediately, a feed sending 5,000 updates a second tries to trigger 5,000 renders a second. The browser cannot, so it falls behind and the UI stutters.

## Batch, then flush on rAF

Buffer incoming updates and apply them once per frame:

```ts
const pending = new Map<string, Tick>() // keyed by row id, so newer ticks overwrite older
let scheduled = false

function onMessage(tick: Tick) {
  pending.set(tick.id, tick)
  if (!scheduled) {
    scheduled = true
    requestAnimationFrame(flush)
  }
}

function flush() {
  for (const tick of pending.values()) applyTick(tick)
  pending.clear()
  scheduled = false
}
```

Keying the buffer by row id means if a row updates ten times between frames, you apply only the latest, coalescing for free.

## Apply in place by identity

In `applyTick`, update the row by identity, preserving references for everything else so Svelte 5 repaints only the changed cells:

```ts
function applyTick(t: Tick) {
  const i = index.get(t.id)
  if (i != null) rows[i] = { ...rows[i], price: t.price, change: t.change }
}
```

A `Map` from id to index keeps each lookup O(1). See [stable row identity](stable-row-identity-getrowid) and [real-time grids](realtime-websocket-updates).

## The result

You now paint at most once per frame regardless of feed rate. Combined with virtualization (only visible rows in the DOM) and fine-grained reactivity (only changed cells repaint), a six-figure-row live grid stays smooth.
