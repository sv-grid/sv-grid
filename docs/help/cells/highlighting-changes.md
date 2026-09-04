# Highlighting changes

## Built-in cell flash (`cellFlash`)

Set `cellFlash` on a column and the grid flashes that cell whenever its value
changes - edits, streaming feeds, server pushes. It is keyed by row identity,
so scrolling a virtualized grid (which recycles `<td>` nodes) never triggers a
false flash; only a same-row value change does. It respects
`prefers-reduced-motion`.

```ts
{ field: 'price',  cellFlash: true }                              // default tint
{ field: 'change', cellFlash: { className: 'flash-up-down' } }    // your own animation
```

The default flash fades a theme-tinted background (`--sg-cell-flash`, or the
accent). For directional colouring (green up / red down) pass your own class
and toggle it from a `cellClass` callback, or animate `flash-up-down` in CSS.
<div data-docs-demo="11-stock-market" data-height="540"></div>

## Rolling your own

If you need more than a flash (persistent dirty markers, diff badges), you can
still build it by hand with a diff against a frozen snapshot of the data.

## Dirty cells while editing

Demo 5 ([demos/05-inline-editing.svelte](../../../examples/src/demos/05-inline-editing.svelte))
does this:

```svelte
<script lang="ts">
  // svelte-ignore state_referenced_locally
  let initial = rows.map((r) => ({ ...r }))
  let dirty = $state<Record<string, true>>({})

  $effect(() => {
    if (!api) return
    const snap = api.getData()
    const next: Record<string, true> = {}
    for (let i = 0; i < snap.length; i++) {
      const a = snap[i]!
      const b = initial[i]
      if (!b) continue
      for (const key of Object.keys(a)) {
        if ((a as any)[key] !== (b as any)[key]) {
          next[`${a.id}.${key}`] = true
        }
      }
    }
    dirty = next
  })
</script>
```

To make the dirty marker visible in the grid, render an indicator inside a
custom `cell`:

```ts
{
  field: 'salary',
  cell: (ctx) => renderSnippet(MaybeDirty, {
    value: ctx.getValue(),
    isDirty: dirty[`${ctx.row.original.id}.salary`] === true,
  }),
}
```

```svelte
{#snippet MaybeDirty(p: { value: unknown; isDirty: boolean })}
  <span class="inline-flex items-center gap-1">
    {p.value}
    {#if p.isDirty}<span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span>{/if}
  </span>
{/snippet}
```

## Flash on value change (live data)

For live-update grids (stock tickers, queue dashboards):

```svelte
<script lang="ts">
  let lastValues = new Map<string, unknown>()
  let flashing = $state<Record<string, true>>({})

  function onCellSeen(key: string, value: unknown) {
    if (lastValues.has(key) && lastValues.get(key) !== value) {
      flashing[key] = true
      setTimeout(() => { delete flashing[key] }, 500)
    }
    lastValues.set(key, value)
  }
</script>
```

Drive the flash from your cell renderer the same way. Use `prefers-
reduced-motion` to disable the animation for users who opt out.

## Flash on change

`cellFlash` tints a cell for a moment whenever its value changes. On a live
feed that is the difference between a number that updated and one you happened
to be looking at.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, renderSnippet, type GridColumns } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    age: number
    salary: number
    joined: string
    active: boolean
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000, joined: '2021-03-01', active: true },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000, joined: '2019-07-15', active: true },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000, joined: '2020-01-20', active: false },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000, joined: '2022-09-05', active: true },
  ]

  let rows = $state<Person[]>(people.map((p) => ({ ...p })))

  function tick() {
    const i = Math.floor(Math.random() * rows.length)
    rows[i] = { ...rows[i]!, salary: rows[i]!.salary + Math.round((Math.random() - 0.4) * 4000) }
  }

  const columns: GridColumns<Person> = [
    { field: 'name', header: 'Name', width: 190 },
    { field: 'salary', header: 'Salary', width: 140, cellFlash: true,
      format: { type: 'currency', currency: 'USD' } },
  ]
</script>

<button type="button" onclick={tick}>Change one salary</button>

<SvGrid data={rows} {columns} />
```


## Your own flash class

Pass `{ className }` to style the flash yourself - a green-up / red-down pair is
the usual next request, and it is CSS rather than configuration.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, renderSnippet, type GridColumns } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    age: number
    salary: number
    joined: string
    active: boolean
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000, joined: '2021-03-01', active: true },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000, joined: '2019-07-15', active: true },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000, joined: '2020-01-20', active: false },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000, joined: '2022-09-05', active: true },
  ]

  let rows = $state<Person[]>(people.map((p) => ({ ...p })))

  const columns: GridColumns<Person> = [
    { field: 'name', header: 'Name', width: 190 },
    { field: 'salary', header: 'Salary', width: 140,
      cellFlash: { className: 'bump' },
      format: { type: 'currency', currency: 'USD' } },
  ]
</script>

<button type="button" onclick={() => (rows[0] = { ...rows[0]!, salary: rows[0]!.salary + 1000 })}>
  Raise the first
</button>

<SvGrid data={rows} {columns} />

<style>
  :global(.bump) { animation: bump 700ms ease-out; }
  @keyframes bump {
    from { background: color-mix(in srgb, #22c55e 35%, transparent); }
    to   { background: transparent; }
  }
</style>
```

## See also

- [Cell components](./cell-components.md)
- [demos/05-inline-editing.svelte](../../../examples/src/demos/05-inline-editing.svelte)
