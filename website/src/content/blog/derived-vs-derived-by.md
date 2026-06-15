---
title: $derived vs $derived.by in Svelte 5
description: When to use $derived for an expression and $derived.by for multi-step computation - with data grid examples and the memoization rules.
date: 2026-07-24
category: Engineering
tags: svelte 5, derived, reactivity, engineering, data grid
author: Boyko Markov
---

`$derived` is how you compute values that stay in sync in Svelte 5. It comes in two forms, and knowing which to reach for keeps your reactive code clean. Here is the distinction, with grid-shaped examples.

## $derived: a single expression

For a value computed from one expression, use `$derived`:

```ts
let query = $state('')
let rows = $state<Row[]>([])
let visible = $derived(rows.filter((r) => r.name.includes(query)))
```

`visible` recomputes only when `rows` or `query` changes. It is memoized - reading it many times in markup does not re-run the filter.

## $derived.by: multiple statements

When the computation needs several steps - intermediate variables, branches, a loop - use `$derived.by` with a function:

```ts
let sorted = $derived.by(() => {
  const filtered = rows.filter((r) => r.active)
  const dir = ascending ? 1 : -1
  return filtered.sort((a, b) => (a.score - b.score) * dir)
})
```

Same memoization, same dependency tracking - just room for statements. `$derived(expr)` is exactly `$derived.by(() => expr)`; pick whichever reads better.

## They both track dependencies automatically

Whatever reactive state you read inside is a dependency. You do not list them (no dependency array like React's `useMemo`). Read `rows`, `query`, `ascending` - and the derived recomputes when any of them change, and only then.

## Common mistakes

- **Using $effect to compute derived state.** If you find yourself in an `$effect` assigning to another state variable from other state, it should be a `$derived`. Effects are for side effects, not derivation - see [$effect pitfalls](svelte-effect-pitfalls).
- **Side effects inside $derived.** A derived must be pure - no fetching, no DOM, no logging that matters. Keep it a calculation.
- **Mutating inside a derived.** Do not mutate the source arrays you read; return a new value.

## Why it matters for a grid

A grid's displayed data is derived from raw data plus UI state. Expressing that as `$derived`/`$derived.by` means the grid recomputes exactly when inputs change and never on unrelated updates - the basis of [reducing re-renders](reducing-re-renders-with-derived).

## Frequently asked questions

### What is the difference between $derived and $derived.by?

`$derived(expr)` takes a single expression; `$derived.by(() => { ... })` takes a function for multi-step computation. They behave identically - both memoize and auto-track dependencies - so choose based on whether you need statements.

### Do I need to declare dependencies for $derived?

No. Svelte 5 tracks whatever reactive state you read inside the derived automatically and recomputes only when those change. There is no dependency array to maintain.
