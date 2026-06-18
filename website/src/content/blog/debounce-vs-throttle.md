---
title: Debounce vs Throttle (for Grids and Beyond)
description: Two ways to tame too-frequent events - debounce and throttle. What each does, when to use which, and where they show up in a data grid.
date: 2026-07-22
category: Concepts
tags: debounce, throttle, performance, concepts, data grid
author: Kamelia M
---

Debounce and throttle both rein in how often a function runs, and they get mixed up constantly, which is how you end up with a search box that lags or a live feed that drops updates. They are not interchangeable.

![Live updates streaming into a SvGrid grid.](/blog-media/websocket-live.png)
*Live updates streaming into a SvGrid grid.*

## The difference in one line

- **Debounce**: wait until the activity *stops*, then run once. "Do it when they are done."
- **Throttle**: run at most once per interval *during* the activity. "Do it at a steady rate."

## Debounce: filter input

When a user types in a filter box, you do not want to query on every keystroke, you want to query once they pause. That is debounce:

```ts
let timer: ReturnType<typeof setTimeout>
function onInput(value: string) {
  clearTimeout(timer)
  timer = setTimeout(() => runFilter(value), 250) // fires 250ms after typing stops
}
```

If they keep typing, the timer keeps resetting; the filter runs once, at the end. This is the right tool for [server-side filtering](svelte-data-grid-rest-api) and URL sync.

## Throttle: live feeds and scroll

When updates arrive continuously - a price feed, scroll events - you want regular updates, not one at the end. That is throttle: run at most once per interval while the stream continues. For rendering, the best "throttle" is the animation frame:

```ts
// run at most once per frame, regardless of how many updates arrive
if (!scheduled) { scheduled = true; requestAnimationFrame(flush) }
```

See [throttling live updates](throttle-live-updates-animation-frames).

## How to choose

Ask: do I want the result *after the activity ends*, or *at a steady rate during it*?

| Situation | Use |
| --- | --- |
| Search/filter input | Debounce |
| Autosave while typing | Debounce |
| Live data feed render | Throttle (rAF) |
| Scroll/resize handlers | Throttle (rAF) |
| Window resize, then recompute | Debounce (trailing) |

## A common bug

Debouncing a live feed makes it feel frozen (you only see the last value after it stops); throttling a search box fires queries mid-typing. Match the tool to whether you care about the *end* of activity or its *rate*.
