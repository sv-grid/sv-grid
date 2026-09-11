# Troubleshooting

Symptom first. The [error reference](./errors.md) covers the messages the
library throws; this page covers the quiet failures - the grid mounts but
shows nothing, a feature you switched on does nothing, the page scrolls
instead of the grid. Each entry names the cause the way you would see it
and the smallest change that fixes it.

## The grid renders but shows no rows

Work down this list; the first four cover almost every report.

### `containerHeight="100%"` in a parent with no height

The grid draws its rows inside a scroll shell whose height comes from the
`containerHeight` prop. The default is 520 px. `"100%"` hands the decision to
the parent, and a parent that has no height of its own (a plain `<div>`, or a
flex child without `min-height: 0`) resolves to 0 px: the header still shows,
the rows exist in the DOM, and the shell that would display them is zero
pixels tall.

Give the parent a height, or use a fixed number:

```svelte
<!-- either -->
<SvGrid {data} {columns} containerHeight={480} />

<!-- or a parent that has a height to give -->
<div class="flex flex-col h-screen">
  <header>…</header>
  <div class="flex-1 min-h-0">
    <SvGrid {data} {columns} containerHeight="100%" />
  </div>
</div>
```

The `min-h-0` matters: flex children default to `min-height: auto`, which
keeps the inner scroll container from shrinking and turns "the grid scrolls"
into "the page scrolls". [Sizing the grid](../getting-started/5-theme-and-density.md#sizing-the-grid)
has the full recipe.

A grid inside a hidden tab (`display: none`) is the same situation with a
happy ending: it stays unmeasured until the tab opens, then a resize observer
measures the box and the rows appear on their own.

### The rows arrived, but the grid was not told

The grid re-reads `data` when the prop's reference changes, and it tracks a
Svelte 5 `$state` array deeply, so both of these work:

```svelte
<script lang="ts">
  let rows = $state<Person[]>([])
  $effect(() => { fetchPeople().then((next) => (rows = next)) })   // replace
  function add(p: Person) { rows.push(p) }                          // mutate in place
</script>
```

What does not work is mutating a plain array: `const rows: Person[] = []`
followed by `rows.push(...)` after a fetch changes nothing the grid can see.
Declare the array with `$state`, or assign a new array.

### `data` was `undefined` for a render

`data` has to be an array on every render, including the first. Mounting with
`data={rows}` while `rows` is still `undefined` throws at mount
(`Cannot read properties of undefined (reading 'length')`). Start from `[]`
and say that a load is in flight with `loading`:

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = { id: number; name: string; city: string }
  const columns: GridColumns<Person> = [
    { field: 'name', header: 'Name', width: 180 },
    { field: 'city', header: 'City', width: 150 },
  ]

  let rows = $state<Person[]>([])
  let loading = $state(false)

  async function load() {
    loading = true
    await new Promise((r) => setTimeout(r, 600))
    rows = [
      { id: 1, name: 'Ada Lovelace', city: 'London' },
      { id: 2, name: 'Grace Hopper', city: 'New York' },
    ]
    loading = false
  }
</script>

<button type="button" onclick={load}>Load</button>
<button type="button" onclick={() => (rows = [])}>Clear</button>

<SvGrid data={rows} {columns} {loading} containerHeight={200} emptyMessage="Nothing loaded yet - press Load." />
```

### Headers show, every cell is blank

The rows are there; the columns cannot read them. A `ColumnDef` reads its
value through `field`, and `field: 'firstName'` on rows that carry
`first_name` reads `undefined` in every cell. Check the field names against
one row of real data (`console.log(rows[0])`), or give the column a
`fieldFn` / `cell` renderer that computes the value. A column with none of
the three throws
[`Column "<id>" has no field, fieldFn, or cell renderer`](./errors.md#error-column-id-has-no-field-fieldfn-or-cell-renderer),
so a silent blank column is always a field-name mismatch.

### `loading` or `error` was left set

`loading` replaces the rows with the loading state until it goes back to
`false`; `error` replaces them with the message and wins over both `loading`
and the empty state. A fetch that throws before it resets the flag leaves the
grid on the placeholder for good - reset in a `finally`:

```svelte
<script lang="ts">
  let loading = $state(false)
  let error = $state<string | null>(null)

  async function refresh() {
    loading = true
    error = null
    try {
      rows = await fetchPeople()
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not load people.'
    } finally {
      loading = false
    }
  }
</script>

<SvGrid data={rows} {columns} {loading} {error} />
```

`data={[]}` with neither flag set shows `emptyMessage` (the localized
"no rows" text by default), which is the state you want after a filter that
matched nothing - see the [empty state](./rows/row-data.md#empty-state).
Demo 79 wires all four states - loading skeleton, typed error with retry,
empty, ready - around one fetch:

<div data-docs-demo="79-loading-from-rest" data-height="440"></div>

## Sorting, filtering or editing does nothing

Every capability is off until you turn it on. A bare `<SvGrid>` is a
read-only table with keyboard navigation and selection; clicking a header
sorts nothing, and there is no filter menu and no editor. Add the boolean
props:

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = { id: number; name: string; city: string; age: number }
  const rows: Person[] = [
    { id: 1, name: 'Ada Lovelace', city: 'London', age: 36 },
    { id: 2, name: 'Grace Hopper', city: 'New York', age: 45 },
    { id: 3, name: 'Linus Torvalds', city: 'Portland', age: 54 },
  ]
  const columns: GridColumns<Person> = [
    { field: 'name', header: 'Name', width: 180, editorType: 'text' },
    { field: 'city', header: 'City', width: 150, editorType: 'text' },
    { field: 'age', header: 'Age', width: 90, editorType: 'number' },
  ]
</script>

<SvGrid data={rows} {columns} sortable filterable editable containerHeight={200} />
```

`sortable` registers `rowSortingFeature`, `filterable` registers
`columnFilteringFeature` (the menu is `filterMode="menu"`, the default),
`editable` is `enableInlineEditing`. Editing also wants an `editorType` on
the columns you intend to edit; a column without one falls back to the text
editor. [Features](../getting-started/4-features.md) lists every shortcut
and the `features={tableFeatures({ ... })}` form behind it.

## The page scrolls instead of the grid

The grid is taller than its parent and the parent lets it grow. Either the
parent is a flex child without `min-height: 0` (see the first entry) or
`containerHeight="auto"` is set, which is exactly the "grow to the content"
mode. Use a fixed `containerHeight`, or `"100%"` under a parent with a real
height.

## Enterprise features show a watermark

`@svgrid/enterprise` runs every feature without a key and marks the grid
with a watermark plus one console nudge per page load. Set the key once at
startup with `setLicenseKey(...)` from `@svgrid/enterprise` (the
`@svgrid/enterprise/license` subpath exports the same function) -
[Enterprise licensing](../enterprise/licensing.md#what-happens-without-a-key)
lists what changes with and without it.

## The build fails inside `@svgrid/grid` on Svelte 4

`@svgrid/grid` is written with Svelte 5 runes and declares `svelte ^5` as a
peer dependency. On a Svelte 4 project the compiler stops inside the
package's own `.svelte` files. There is no Svelte 4 build; the fix is the
Svelte 5 upgrade. The [comparison](./comparison.md) page lists what the
Svelte 4 ecosystem offers if the upgrade is not on the table yet.

## Selection or edits jump to the wrong row

Selection, expansion and edit state are keyed by row id, and without
`getRowId` the id is the array index - which changes under a sort, a filter,
or an insert at the top. Pass a `getRowId` that returns a value unique to each
row (a primary key, a UUID). Two rows returning the same id share one state,
so a duplicate key shows up as two rows highlighting together.
[Row identity](./rows/row-data.md#row-identity-getrowid) has the details.

## Frequently asked questions

### Why is my SvGrid empty?

In order of likelihood: `containerHeight="100%"` under a parent with no
height, so the scroll shell is 0 px tall; rows pushed into a plain array the
grid cannot observe (use `$state` or assign a new array); `data` that was
`undefined` for the first render (start from `[]`); or column `field` names
that do not exist on the rows, which leaves the headers up and every cell
blank. The entries above give the fix for each.

### Why does clicking a column header not sort?

Sorting is off by default. Add `sortable` to `<SvGrid>` (or register
`rowSortingFeature` through `features`). The same applies to filtering
(`filterable`) and editing (`editable`).

### Why does the whole page scroll instead of the grid?

The grid's parent lets it grow: a flex child needs `min-height: 0` for the
inner scroll container to shrink, and `containerHeight="auto"` deliberately
grows to the content. Use a fixed `containerHeight` or `"100%"` inside a
parent that has a height.

## See also

- [Error reference](./errors.md) - every thrown message, with its trigger
  and fix.
- [Row data](./rows/row-data.md) - static, reactive, empty and loading
  states, and `getRowId`.
- [Theme and density](../getting-started/5-theme-and-density.md#sizing-the-grid) -
  sizing the grid, the flex recipe.
- [Features](../getting-started/4-features.md) - the boolean shortcuts and
  the `features` object behind them.
- [SvGrid with SvelteKit](../getting-started/sveltekit.md) - loading data on
  the server and what server-renders.
