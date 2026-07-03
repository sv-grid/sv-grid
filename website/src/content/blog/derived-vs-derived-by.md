---
title: $derived vs $derived.by in Svelte 5
description: Two forms of the same primitive - when $derived is enough and when $derived.by earns its keep, illustrated with real data grid patterns.
date: 2026-07-24
updated: "2026-07-02"
category: Engineering
tags: svelte 5, derived, reactivity, engineering, data grid
author: Boyko Markov
---

Most Svelte 5 code I read uses `$derived` and `$derived.by` somewhat interchangeably, as if the choice were a style preference. It is not quite that, but the difference is narrow enough that it pays to know exactly where the line sits.

![A reporting workspace built with SvGrid.](/blog-media/reporting.png)
*A reporting workspace built with SvGrid.*

## The single-expression case

`$derived` takes one expression. When that expression fits on a line and reads naturally, there is no reason to reach for anything else:

```ts
import SvGrid from '@svgrid/grid'

let query = $state('')
let rows  = $state<{ name: string; active: boolean; score: number }[]>([])

// Single-expression derivations: clean and direct
let visibleRows  = $derived(rows.filter((r) => r.name.toLowerCase().includes(query.toLowerCase())))
let activeCount  = $derived(rows.filter((r) => r.active).length)
let hasSelection = $derived(visibleRows.length > 0)
```

The rule: if you can write it as `x = f(state)` in one pass, use `$derived`. Both `activeCount` and `hasSelection` fit. They are memoized automatically - reading `activeCount` ten times in markup runs the filter once, not ten times.

## When multi-step logic arrives

The moment you need an intermediate variable, a branch, or a loop that builds a value, `$derived` gets awkward. That is the `$derived.by` slot:

```ts
import { tableFeatures, rowSortingFeature, columnFilteringFeature } from '@svgrid/grid'

let rawData    = $state<SalesRow[]>([])
let ascending  = $state(true)
let filterText = $state('')

// Multi-step: filter, sort, then build summary in one coherent block
let processedRows = $derived.by(() => {
  const q = filterText.toLowerCase()

  // Step 1: filter
  const filtered = rawData.filter((r) =>
    r.region.toLowerCase().includes(q) || r.product.toLowerCase().includes(q)
  )

  // Step 2: sort
  const dir = ascending ? 1 : -1
  const sorted = [...filtered].sort((a, b) => (a.revenue - b.revenue) * dir)

  // Step 3: attach a running rank
  return sorted.map((r, i) => ({ ...r, rank: i + 1 }))
})

let topFiveRevenue = $derived.by(() => {
  const top = processedRows.slice(0, 5)
  return top.reduce((sum, r) => sum + r.revenue, 0)
})
```

`$derived.by` takes a function that returns the value. Anything legal in a function body is legal inside: `const`, `if`, `for`, method calls. The memoization and dependency tracking work identically to `$derived`. You do not declare dependencies - Svelte reads whatever reactive state you access during the function call and tracks it automatically.

`$derived(expr)` is defined as exactly `$derived.by(() => expr)`. It is not a different primitive, just a shorter syntax for the single-expression case.

## How dependency tracking actually works

This comes up most when the computation is conditional:

```ts
let mode = $state<'name' | 'score'>('name')
let rows = $state<{ name: string; score: number }[]>([])

let sortKey = $derived.by(() => {
  if (mode === 'name') {
    // Only `rows` and `mode` are read here
    return [...rows].sort((a, b) => a.name.localeCompare(b.name))
  } else {
    // Same dependencies, different path
    return [...rows].sort((a, b) => b.score - a.score)
  }
})
```

Svelte tracks the reactive reads that actually execute, not all possible reads. If `mode` is `'name'`, and you had some other state only read in the `else` branch, that state is not a dependency of the current run. It becomes a dependency the moment the branch changes. This is fine and expected - it is how the tracking is designed.

Practical takeaway: you do not need to worry about "did I read too much" or "did I miss a dependency." Read what you need; Svelte sees it.

## The mistakes that get people

The most common error is using `$effect` to compute derived state:

```ts
// Wrong - an effect that computes derived state
let filtered = $state<Row[]>([])
$effect(() => {
  filtered = rows.filter((r) => r.active)  // writing state from an effect
})

// Right - a derived
let filtered = $derived(rows.filter((r) => r.active))
```

Effects are for side effects - writing to the DOM, calling an external API, logging. Derivation is not a side effect. When you assign to another state variable inside an `$effect`, you often introduce an extra reactive cycle and make the data flow harder to follow. `$derived` is synchronous and has no extra cycle.

The second common mistake is putting a side effect inside a derived:

```ts
// Wrong - side effect inside derived
let summary = $derived.by(() => {
  console.log('recomputing')   // harmless, but a sign
  fetch('/api/log')             // do not do this
  return rows.reduce((s, r) => s + r.amount, 0)
})
```

A derived must be a pure calculation. If it produces a value and also does something to the outside world, the derived machinery will run it eagerly and potentially many times. Side effects belong in `$effect`.

## Patterns that appear in a grid

A data grid is a good stress test for derived state because the displayed data is always a function of raw data plus several independent UI state variables. With SvGrid, you can manage that at the column level or outside it entirely:

```ts
import SvGrid, {
  createGrid, tableFeatures,
  rowSortingFeature, columnFilteringFeature, rowPaginationFeature,
  type ColumnDef
} from '@svgrid/grid'

const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  rowPaginationFeature,
})

// Grid state is declared with $state
let sortState   = $state<{ id: string; desc: boolean }[]>([])
let filterState = $state<Record<string, unknown>>({})
let pageState   = $state({ pageIndex: 0, pageSize: 50 })

// Summary values that drive the UI outside the grid
let activeFiltersCount = $derived(Object.keys(filterState).length)
let currentPageLabel   = $derived(
  `Page ${pageState.pageIndex + 1}`
)

// A more complex summary that combines several pieces of state
let statusLine = $derived.by(() => {
  const filterDesc = activeFiltersCount > 0
    ? `${activeFiltersCount} filter${activeFiltersCount > 1 ? 's' : ''} active`
    : 'no filters'
  const sortDesc = sortState.length > 0
    ? `sorted by ${sortState.map((s) => s.id).join(', ')}`
    : 'default order'
  return `${currentPageLabel} - ${filterDesc} - ${sortDesc}`
})

const columns: ColumnDef<typeof features, SalesRow>[] = [
  { id: 'product', field: 'product', header: 'Product', width: 200 },
  { id: 'region',  field: 'region',  header: 'Region',  width: 150 },
  { id: 'revenue', field: 'revenue', header: 'Revenue', width: 130, type: 'number' },
]
```

`statusLine` is a clear `$derived.by` case - three intermediate values feed one output string. Forcing that into a single expression would produce something unreadable.

## Choosing between them

The practical rule is length and clarity, not capability. Both forms offer identical memoization and dependency tracking. If the expression fits in one line and reads naturally, use `$derived`. If you need intermediate values, early returns, branches, or you just want the computation broken into named steps, use `$derived.by`.

One place where `$derived` is the obvious wrong choice: when the derived value depends on something you only want to access conditionally. A multi-line function in `$derived.by` makes the conditional logic explicit and easy to read. A single-expression ternary that spans three lines is not actually cleaner.

The other thing worth knowing: neither form has an option to supply a custom equality check. If the derived produces an object or array and you want to avoid downstream updates when the value is structurally the same, you need to handle that either by returning the same reference when possible, or by restructuring so the downstream reads are themselves reactive to specific fields rather than the whole object.

Beyond that, the choice is straightforward. The Svelte compiler enforces purity - you cannot accidentally write to state from inside a derived - so the main discipline is keeping side effects out, which is the same rule you already follow for clean functions.
