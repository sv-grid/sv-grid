---
title: $state Deep Dive for Data-Heavy Svelte Apps
description: A working engineer's guide to $state, $state.raw, and $state.snapshot - when each one is the right tool, and the exact failure modes when you pick the wrong one.
date: 2026-09-10
updated: "2026-07-02"
category: Engineering
tags: svelte 5, state, reactivity, engineering, data grid
author: Kamelia M
---
The proxy Svelte 5 wraps around `$state` is invisible until you have 10,000 rows in it. At that point, things that felt like implementation details - how deep tracking works, what `$state.raw` actually skips, why `$state.snapshot` exists - become the difference between a 60 fps grid and a grid that hangs on every keypress.

This post is grounded in the actual patterns SvGrid uses internally, not in a counter app.

## Three variants, three different contracts

Svelte 5 ships three distinct forms of reactive state. Most tutorials treat `$state.raw` and `$state.snapshot` as footnotes. For data-grid work, they are load-bearing.

**`$state(value)`** - wraps the value in a recursive proxy. Read access on any nested property registers a fine-grained dependency. Mutation anywhere in the tree fires exactly the affected effects. The cost is proportional to how many distinct paths get accessed, not to the total object size. A 1000-row array where only 25 rows are visible in the viewport pays proxy registration for roughly 25 rows worth of fields.

**`$state.raw(value)`** - stores the value in a plain reactive cell with no proxy wrapping. Reading it registers one dependency on the cell. Writing it (via reassignment only) notifies dependents. In-place mutation, like `arr.push(item)`, is silently ignored. The tradeoff is coarser granularity for zero structural overhead.

**`$state.snapshot(proxied)`** - produces a deep-cloned, fully plain copy of a proxied value. No proxy traps survive. The result is a regular JavaScript array or object, safe to pass to any third-party library.

## Choosing based on how data actually changes

The right variant follows from your data's mutation pattern, not from performance gut feelings.

| Pattern | Right choice | Reason |
|---|---|---|
| In-place field edits (user types in a cell) | `$state` | Deep tracking fires per-field, not per-row |
| Full page replacement from server | `$state.raw` | Reassignment only, no field-level tracking needed |
| Sort/filter clause objects | `$state` | Small, mutate frequently, benefit from fine-grained updates |
| Export to reporting library or JSON | `$state.snapshot` | Strips proxy traps that confuse some serializers |

Here is how that plays out in a real component. The employee list below uses `$state` for locally editable rows and `$state.raw` for server-fetched pages:

```ts
// employee-config.ts
import {
  tableFeatures,
  rowSortingFeature,
  columnFilteringFeature,
  rowSelectionFeature,
  type ColumnDef,
} from '@svgrid/grid'

export type Employee = {
  id: string
  name: string
  team: 'Engineering' | 'Design' | 'Product' | 'Sales' | 'Support'
  level: 'L3' | 'L4' | 'L5' | 'L6' | 'L7'
  salary: number
  rating: 'Below' | 'Meets' | 'Exceeds' | 'Outstanding'
}

export const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  rowSelectionFeature,
})

export const columns: ColumnDef<typeof features, Employee>[] = [
  { id: 'id',     field: 'id',     header: 'ID',     width: 80 },
  { id: 'name',   field: 'name',   header: 'Name',   width: 180, editable: true },
  { id: 'team',   field: 'team',   header: 'Team',   width: 120, editable: true },
  { id: 'level',  field: 'level',  header: 'Level',  width: 80,  editable: true },
  {
    id: 'salary',
    field: 'salary',
    header: 'Salary',
    width: 120,
    type: 'number',
    editable: true,
  },
  { id: 'rating', field: 'rating', header: 'Rating', width: 110, editable: true },
]
```

```svelte
<script lang="ts">
  import SvGrid, { type SvGridApi } from '@svgrid/grid'
  import { features, columns, type Employee } from './employee-config'

  // Deep $state: fine-grained tracking, supports in-place mutation.
  let localRows = $state<Employee[]>([
    { id: 'e01', name: 'Ada Lovelace',      team: 'Engineering', level: 'L6', salary: 215_000, rating: 'Outstanding' },
    { id: 'e02', name: 'Grace Hopper',      team: 'Engineering', level: 'L6', salary: 220_000, rating: 'Exceeds' },
    { id: 'e03', name: 'Margaret Hamilton', team: 'Engineering', level: 'L5', salary: 185_000, rating: 'Exceeds' },
    { id: 'e04', name: 'Linus Torvalds',    team: 'Engineering', level: 'L7', salary: 280_000, rating: 'Outstanding' },
  ])

  // $state.raw: coarse tracking, reassignment only, no per-field proxy overhead.
  let pageRows   = $state.raw<Employee[]>([])
  let pageIndex  = $state(0)
  let loading    = $state(false)
  const pageSize = 25

  let api = $state<SvGridApi<typeof features, Employee> | null>(null)

  async function fetchPage(p: number) {
    loading  = true
    const res = await fetch(`/api/employees?page=${p}&size=${pageSize}`)
    pageRows = await res.json()   // reassignment triggers rerender
    pageIndex = p
    loading  = false
  }

  // Deep proxy lets us mutate individual fields without any extra API call.
  function promoteEmployee(id: string) {
    const row = localRows.find(r => r.id === id)
    if (!row) return
    const ladder: Employee['level'][] = ['L3', 'L4', 'L5', 'L6', 'L7']
    const next = ladder[ladder.indexOf(row.level) + 1]
    if (next) row.level = next  // grid reacts automatically
  }

  // $state.snapshot gives a plain array, safe for JSON or third-party libraries.
  function exportSelected() {
    const selected = api?.getSelectedRows() ?? []
    const plain = $state.snapshot(localRows.filter(r =>
      selected.some(s => s.id === r.id)
    ))
    console.log(JSON.stringify(plain))  // no proxy traps, safe to pass anywhere
  }

  $effect(() => { fetchPage(0) })
</script>

<div class="toolbar">
  <button onclick={() => fetchPage(pageIndex - 1)} disabled={pageIndex === 0 || loading}>
    Previous
  </button>
  <span>Page {pageIndex + 1}</span>
  <button onclick={() => fetchPage(pageIndex + 1)} disabled={loading}>Next</button>
  <button onclick={exportSelected}>Export selected</button>
</div>

<section>
  <h2>Local employees - deep $state</h2>
  <SvGrid
    {features}
    {columns}
    data={localRows}
    editable
    onApiReady={(g) => { api = g }}
  />
</section>

<section>
  <h2>Server page - $state.raw</h2>
  <SvGrid
    {features}
    {columns}
    data={pageRows}
    pageable
  />
</section>
```

## Why in-place mutation on $state.raw silently does nothing

This trips up almost every developer who switches from `$state` to `$state.raw` for performance reasons. `pageRows.push(newEmployee)` after a `$state.raw` declaration will update the array in memory but produce no rerender. The reactive cell Svelte holds only tracks the reference, not the contents.

The failure mode is subtle: the array is mutated, the grid does not update, and there is no error. The fix is always a reassignment:

```ts
// Silent failure - reactive cell is not notified:
pageRows.push(newEmployee)

// Works - reassignment notifies the reactive cell:
pageRows = [...pageRows, newEmployee]

// Also works - replace the whole array:
pageRows = [newEmployee, ...pageRows]

// Transaction API on SvGrid is always safe regardless of $state variant:
api?.applyTransaction({ add: [newEmployee] })
```

The `applyTransaction` path is worth knowing: SvGrid's imperative API bypasses the reactivity system and directly tells the grid model to update. It works with both `$state` and `$state.raw` data sources.

## When $state.snapshot is load-bearing, not optional

`JSON.stringify` usually works on a proxied value. That makes `$state.snapshot` look optional until you hit one of these three cases.

**`structuredClone`** - Chrome 98+ implementation checks internal slots that proxies do not expose correctly. `structuredClone($state([1,2,3]))` throws in some environments. `structuredClone($state.snapshot($state([1,2,3])))` always works.

**Charting libraries** - Libraries like Chart.js and ECharts walk array own keys and sometimes check `Array.isArray` via realm-specific logic. A Svelte proxy fails that check in module contexts that imported their own Array. Pass `$state.snapshot(rows)` to any charting call you do not control.

**IndexedDB** - The structured clone algorithm that IndexedDB uses rejects Proxy objects explicitly. Any `put` or `add` call with a proxied value throws `DataCloneError`. This one has a clear error message, but it is not obvious that the proxy is the cause.

SvGrid's `api.getData()` returns rows as the internal model sees them. If you initialized the grid with a `$state`-proxied array, those rows are proxied. Always snapshot before handing the result to external consumers:

```ts
const plain = $state.snapshot(api.getData())
await db.transaction('employees', 'readwrite').objectStore('employees').put(plain)
```

## Module-scope $state and per-instance state

One pattern that causes confusing bugs: putting `$state` in a `.svelte.ts` module at the top level.

```ts
// shared-filters.svelte.ts
export let activeFilters = $state<string[]>([])  // module singleton
```

Every component that imports this shares the same reactive cell. That is intentional for a global filter store, but if you expected each grid instance to have independent filter state, you will see cross-component contamination. The fix is a factory:

```ts
// shared-filters.svelte.ts
export function makeFilterState() {
  return {
    active: $state<string[]>([]),
    sort:   $state<{ field: string; dir: 'asc' | 'desc' } | null>(null),
  }
}
```

SvGrid's `createGridState` from `@svgrid/grid` follows this factory pattern exactly - each call returns an independent reactive state object scoped to one grid instance.

## The dependency count problem at scale

If you hold 50,000 rows in plain `$state` and each row has 15 fields, Svelte can track up to 750,000 dependency nodes. Even if only 30 are visible, the initial proxy-wrapping pass on first read touches all rows accessed by any filter, sort, or aggregation function.

The practical threshold where this becomes visible is roughly 5,000 to 8,000 rows depending on field count and the complexity of any derived values reading from the array. Above that, switch the data array itself to `$state.raw` and keep only the small, frequently mutated control values (active filters, sort state, selected row ids) in deep `$state`.

That is exactly the internal architecture SvGrid uses: the data array is held raw, while sort clauses, filter state, column widths, and selection are all individually tracked with fine-grained `$state`.
