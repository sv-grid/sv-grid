---
title: Building a Real-Time Trading Grid in Svelte
description: A blueprint for a financial trading grid - live price updates, flash-on-change, conditional formatting, and the performance patterns that keep it smooth.
date: 2026-08-29
category: Use cases
tags: trading, finance, realtime, use case, svelte data grid
author: Kamelia M
---

A trading or markets grid is about the hardest thing you can ask a data grid to do: hundreds of rows, sub-second updates, and users who notice a single dropped frame. It is also exactly where a runes-native core pays off. Here is how I would build one.

![A live market data grid in SvGrid](/blog-media/stock-market.png)
*A live market grid in SvGrid, with flash-on-change cells.*

## The shape

A trading grid is a fixed set of instruments (rows) whose prices update continuously. You rarely add or remove rows; you update cells in place, fast. That shapes every decision.

## Live updates, batched to the frame

Connect a WebSocket, look up each tick's row by id, and update in place, but batch to the animation frame so a fast feed cannot outrun the screen:

```ts
const index = new Map<string, number>() // symbol -> row index
const pending = new Map<string, Tick>()
let scheduled = false

socket.onmessage = (e) => {
  const t = JSON.parse(e.data) as Tick
  pending.set(t.symbol, t)
  if (!scheduled) { scheduled = true; requestAnimationFrame(flush) }
}
function flush() {
  for (const t of pending.values()) {
    const i = index.get(t.symbol)
    if (i != null) rows[i] = { ...rows[i], price: t.price, change: t.change }
  }
  pending.clear(); scheduled = false
}
```

See [throttling live updates](throttle-live-updates-animation-frames) and [real-time grids](realtime-websocket-updates).

## Flash on change

Traders read movement by color. Flash a cell green on an uptick, red on a downtick, then fade. Drive it from a per-row direction flag and clear it after a short timeout, with colors from tokens so it works in dark mode.

## Conditional formatting

Color the change column by sign, bid/ask spreads by width, P&L red/green. Keep the raw numeric values for sorting; render color in the cell, see [conditional formatting](conditional-formatting).

## Performance checklist

- Update by identity, preserve references for unchanged rows ([stable identity](stable-row-identity-getrowid)).
- Batch to rAF; never render per message.
- Keep the grid in a bounded-height container so virtualization engages.
- Use `format` on numeric columns so sorting stays numeric and precision is consistent.

## Frequently asked questions

### Can a Svelte data grid handle a live trading feed?

Yes. Update rows in place by id, batch incoming ticks to the animation frame so rendering never exceeds ~60fps, and let virtualization bound the DOM. SvGrid's fine-grained reactivity repaints only the cells that changed.

### How do I flash cells on price changes?

Set a per-row direction flag when a tick arrives, apply a green/red background class driven by tokens, and clear it after a short timeout so the flash fades. Keep the raw price as the sortable value.
