---
title: $bindable Props for Grid Controls in Svelte 5
description: Two-way binding for grid chrome - search boxes, page-size selectors, density toggles - using $bindable to keep parent state and child input in sync without the usual wiring boilerplate.
date: 2026-07-06
updated: "2026-07-02"
category: Engineering
tags: svelte 5, bindable, props, components, engineering
author: Kamelia M
---

Every data grid ships with chrome around it: a search input, a page-size dropdown, maybe a density toggle or a column chooser. These controls are small, but they create a recurring wiring problem. The parent owns the state. The child renders and updates it. You need changes to flow both ways, and you need them to stay in sync.

In Svelte 5, `$bindable` exists exactly for this. It is a one-word opt-in that turns a prop into a two-way binding, and once you understand when to reach for it (and when not to), it removes a surprising amount of repetitive code.

## What two-way binding actually means here

Without `$bindable`, props flow down and events flow up. That is usually the right model. But for "mirror" controls - where the parent and child are really just two views of the same scalar value - the event pattern produces boilerplate with no payoff:

```svelte
<!-- WITHOUT $bindable: a lot of wiring for a simple value -->
<script lang="ts">
  let { value, onChange }: { value: string; onChange: (v: string) => void } = $props()
</script>
<input {value} oninput={(e) => onChange(e.currentTarget.value)} placeholder="Search..." />
```

```svelte
<!-- parent without $bindable -->
<script lang="ts">
  let query = $state('')
</script>
<SearchBox value={query} onChange={(v) => { query = v }} />
```

That is four lines for zero logic. The `onChange` handler does nothing except assign. This is exactly where `$bindable` earns its place.

## Switching to $bindable

Mark the prop with `$bindable()` and the parent can use `bind:` directly. The component becomes simpler, and the parent sheds the callback:

```svelte
<!-- SearchBox.svelte -->
<script lang="ts">
  let { value = $bindable('') }: { value?: string } = $props()
</script>

<input bind:value placeholder="Search..." class="sg-search-input" />
```

```svelte
<!-- GridPage.svelte -->
<script lang="ts">
  import SvGrid from '@svgrid/grid'
  import SearchBox from './SearchBox.svelte'
  import { columnFilteringFeature, tableFeatures } from '@svgrid/grid'

  const { data, columns } = $props()

  let query = $state('')

  const filteredRows = $derived(
    data.filter((row) =>
      Object.values(row).some((v) =>
        String(v).toLowerCase().includes(query.toLowerCase())
      )
    )
  )
</script>

<div class="grid-toolbar">
  <SearchBox bind:value={query} />
</div>

<SvGrid data={filteredRows} {columns} rowHeight={36} />
```

Now `query` in the parent and `value` in the SearchBox are the same reactive slot. The input updates, the derived fires, the grid re-renders. No handler, no intermediary.

## Three controls worth building this way

The pattern applies well to a handful of common grid controls.

**Page-size selector.** The parent owns `pageSize` and passes it to the grid and to the selector. The selector's change feeds directly back:

```svelte
<!-- PageSizeSelector.svelte -->
<script lang="ts">
  let {
    value = $bindable(25),
    options = [10, 25, 50, 100],
  }: { value?: number; options?: number[] } = $props()
</script>

<select bind:value>
  {#each options as size}
    <option value={size}>{size} per page</option>
  {/each}
</select>
```

```svelte
<!-- parent usage -->
<script lang="ts">
  import SvGrid, { type SvGridApi } from '@svgrid/grid'
  import PageSizeSelector from './PageSizeSelector.svelte'

  let pageSize = $state(25)
  let api: SvGridApi | undefined

  $effect(() => {
    api?.setPageSize(pageSize)
  })
</script>

<PageSizeSelector bind:value={pageSize} options={[10, 25, 50, 100]} />
<SvGrid
  {data}
  {columns}
  pageable
  onApiReady={(a) => { api = a }}
/>
```

The `$effect` here is intentional - the grid's imperative API takes the change after mount rather than as a prop. That is a minor seam, but it is honest about what is happening.

**Density toggle.** Row height controls like compact/default/comfortable are another natural fit. The parent keeps the current density, the toggle component switches it, and the grid reacts:

```svelte
<!-- DensityToggle.svelte -->
<script lang="ts">
  type Density = 'compact' | 'default' | 'comfortable'

  let { value = $bindable<Density>('default') }: { value?: Density } = $props()

  const heights: Record<Density, number> = {
    compact: 24,
    default: 36,
    comfortable: 48,
  }

  const options: Density[] = ['compact', 'default', 'comfortable']
</script>

<div class="density-toggle">
  {#each options as opt}
    <button
      class:active={value === opt}
      onclick={() => { value = opt }}
    >
      {opt}
    </button>
  {/each}
</div>
```

```svelte
<!-- parent with density-aware grid -->
<script lang="ts">
  import SvGrid from '@svgrid/grid'
  import DensityToggle from './DensityToggle.svelte'

  type Density = 'compact' | 'default' | 'comfortable'
  const heights: Record<Density, number> = { compact: 24, default: 36, comfortable: 48 }

  let density = $state<Density>('default')
</script>

<DensityToggle bind:value={density} />
<SvGrid {data} {columns} rowHeight={heights[density]} virtualization={true} />
```

## When $bindable is the wrong choice

Two-way binding is not always the right tool. If the parent needs to do something beyond mirroring - validate input, persist to localStorage, send an analytics event - the direct assignment inside `$bindable` bypasses that logic entirely.

In those cases, keep the prop one-way and add a callback:

```svelte
<!-- SearchBox with side effects - one-way prop is better here -->
<script lang="ts">
  let {
    value,
    onchange,
  }: { value: string; onchange: (v: string) => void } = $props()
</script>

<input
  {value}
  oninput={(e) => onchange(e.currentTarget.value)}
  placeholder="Search..."
/>
```

```svelte
<!-- parent with validation and persistence -->
<script lang="ts">
  let query = $state(localStorage.getItem('grid-query') ?? '')

  function handleQueryChange(v: string) {
    if (v.length > 200) return  // guard against absurd input
    query = v
    localStorage.setItem('grid-query', v)
  }
</script>

<SearchBox value={query} onchange={handleQueryChange} />
```

The tell is whether the parent needs to intercept or just observe. Intercept: use a callback. Observe: `$bindable` is fine.

## Default values and standalone use

Always give `$bindable` props a default value. This makes the component usable when the parent does not bind it - useful for testing and for cases where the parent is optional:

```ts
let { value = $bindable(50) } = $props()
```

Without the default, a parent that forgets `bind:value` gets `undefined` and the component breaks silently. With the default, the component works standalone and the binding is additive, not required.

## The pattern at scale

When you have several bindable controls around one grid, it helps to group the state. Instead of three separate `$state` declarations at the top of a page, consider a small state object:

```svelte
<script lang="ts">
  import SvGrid from '@svgrid/grid'
  import SearchBox from './SearchBox.svelte'
  import PageSizeSelector from './PageSizeSelector.svelte'
  import DensityToggle from './DensityToggle.svelte'

  const { data, columns } = $props()

  let gridState = $state({
    query: '',
    pageSize: 25,
    density: 'default' as 'compact' | 'default' | 'comfortable',
  })

  const densityHeights = { compact: 24, default: 36, comfortable: 48 }

  const filteredRows = $derived(
    data.filter((row) =>
      Object.values(row).some((v) =>
        String(v).toLowerCase().includes(gridState.query.toLowerCase())
      )
    )
  )
</script>

<div class="grid-toolbar">
  <SearchBox bind:value={gridState.query} />
  <PageSizeSelector bind:value={gridState.pageSize} />
  <DensityToggle bind:value={gridState.density} />
</div>

<SvGrid
  data={filteredRows}
  {columns}
  rowHeight={densityHeights[gridState.density]}
  virtualization={true}
  showGlobalFilter={false}
/>
```

`bind:` works against object property paths in Svelte 5, so `bind:value={gridState.query}` is valid. The whole toolbar state lives in one place, easy to serialize or restore.

## $bindable vs callbacks: when each is right

Reach for `$bindable` when:
- The parent and child share a scalar value with no transformation needed
- The control is "chrome" - UI surrounding the grid rather than logic inside it
- The component needs to be usable standalone (the default handles it)

Stay with one-way props plus callbacks when:
- The parent needs to validate, transform, or persist the value on change
- Multiple parents use the same component with different side effects
- You want the data flow to be obvious to the next person reading the code

For grid chrome - search, page size, density, column visibility - `$bindable` is usually the right call. These controls are purpose-built mirrors, and treating them as such keeps the parent code clean without hiding anything meaningful.
