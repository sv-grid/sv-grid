---
title: Debounce vs Throttle (for Grids and Beyond)
description: Two ways to tame too-frequent events - debounce and throttle. What each does, when to use which, and where they show up in a data grid.
date: 2026-07-22
category: Concepts
tags: debounce, throttle, performance, concepts, data grid
author: Kamelia M
---

Debounce and throttle both limit how often a function runs, but they do it differently and suit different problems. Mixing them up causes laggy search boxes and dropped updates. Here is the distinction, with grid examples.

## The difference in one line

- **Debounce** - wait until the activity *stops*, then run once. "Do it when they are done."
- **Throttle** - run at most once per interval *during* the activity. "Do it at a steady rate."

## Debounce: filter input

When a user types in a filter box, you do not want to query on every keystroke - you want to query once they pause. That is debounce:

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

## Frequently asked questions

### What is the difference between debounce and throttle?

Debounce waits until activity stops and then runs once - good for search input. Throttle runs at most once per interval during activity - good for live feeds and scroll handlers. Debounce cares about the end; throttle cares about the rate.

### Should I debounce or throttle a grid filter box?

Debounce it. You want the filter (and any server query) to run once the user pauses typing, not on every keystroke. Throttle is for continuous streams like live data or scroll events.
