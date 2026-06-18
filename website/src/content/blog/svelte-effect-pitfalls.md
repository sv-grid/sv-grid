---
title: $effect Pitfalls in Svelte 5 (and How to Avoid Them)
description: The common $effect mistakes - deriving state in effects, infinite loops, missing cleanup - and the patterns that keep effects predictable.
date: 2026-09-11
category: Engineering
tags: svelte 5, effect, reactivity, engineering, data grid
author: Kamelia M
---

`$effect` is the rune people reach for when they should not. It exists for genuine side effects, not for computing values, and using it as a general-purpose "run this when that changes" hammer is how you get loops, stale data, and bugs that take an afternoon to trace. Here are the traps and the patterns that avoid them.

## Pitfall 1: using $effect to derive state

The most common mistake: computing a value from other state inside an effect and assigning it back.

```ts
// WRONG: this is a derivation, not a side effect
let total = $state(0)
$effect(() => { total = items.reduce((s, i) => s + i.price, 0) })

// RIGHT
let total = $derived(items.reduce((s, i) => s + i.price, 0))
```

If you are setting state from other state, it is a `$derived`. Effects that assign state create extra update cycles and ordering hazards.

## Pitfall 2: infinite loops

An effect that writes state it also reads re-triggers itself forever:

```ts
$effect(() => { count = count + 1 }) // loops
```

If you must update state in an effect based on a value you should not depend on, read it with `untrack`:

```ts
import { untrack } from 'svelte'
$effect(() => { log(value); untrack(() => (lastLogged = value)) })
```

But first ask whether you need the effect at all.

## Pitfall 3: forgetting cleanup

Effects that subscribe, set timers, or add listeners must return a cleanup function, or you leak:

```ts
$effect(() => {
  const id = setInterval(tick, 1000)
  return () => clearInterval(id) // runs on re-run and teardown
})
```

This is exactly how you attach and detach a live data feed for a grid, see [real-time grids](realtime-websocket-updates).

## Pitfall 4: async and stale closures

An `async` effect body can finish after dependencies changed. Capture what you need, and guard against applying a stale result (a cancellation flag or AbortController), the same discipline as [server-side fetching](svelte-data-grid-rest-api).

## The rule of thumb

- Computing a value? `$derived`.
- Reacting to change with a side effect (DOM, network, subscription, logging)? `$effect`, with cleanup.

Keep that line clean and most reactivity bugs disappear.
