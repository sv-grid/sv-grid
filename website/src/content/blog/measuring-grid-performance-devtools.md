---
title: Measuring Data Grid Performance in DevTools
description: A practical method for profiling a Svelte data grid - using the Performance panel, frame timing, and the DOM node count to find real bottlenecks.
date: 2026-08-10
category: Performance
tags: performance, devtools, profiling, measurement, recipe
author: Kamelia M
---

"It feels slow" is not something you can fix, it is something you have to measure first, because the bottleneck is almost never where your gut says it is. Before you optimize a single line, record it.

![A million-row dataset in SvGrid, kept smooth by virtualization.](/blog-media/million-rows.png)
*A million-row dataset in SvGrid, kept smooth by virtualization.*

## Record a real interaction

Open the Performance panel, hit record, and do the thing that feels slow - scroll the full height, sort a big column, type in a filter - then stop. Look for:

- **Long tasks / long frames** (over ~16ms), these are dropped frames.
- **What is in them**: scripting (your code), rendering, or painting.
- **Forced reflow warnings**: a sign of layout thrash (see below).

## Watch the DOM node count

This is the fastest virtualization check. In the Elements panel (or via `document.querySelectorAll('*').length`), note the node count, then scroll. With virtualization working, it stays roughly constant. If it climbs as you scroll, virtualization is not engaging, almost always a missing height on the grid container.

## Common findings

- **Rebuilt data every tick.** Scripting time dominated by array/object allocation means you are recreating rows. Mutate surgically; see [stable row identity](stable-row-identity-getrowid).
- **Heavy custom cells.** Long render time in cell components, simplify the snippet or memoize upstream.
- **Layout thrash.** Forced-reflow warnings point to reading and writing layout in a loop; see [avoiding layout thrash](avoiding-layout-thrash-custom-cells).
- **No virtualization.** Climbing node count, fix the container height.

## Measure, change one thing, measure again

The discipline that matters: take a baseline, make a single change, and re-record. Optimizing by feel leads to cargo-culting. A 5-second profile before and after tells you whether your change helped or just added complexity.

## Test on real hardware

Profile on the device your users actually have, and use DevTools' CPU throttling (4x/6x slowdown) to simulate low-end machines. A grid that is smooth on a developer laptop can stutter on a budget phone; throttling surfaces that before your users do.
