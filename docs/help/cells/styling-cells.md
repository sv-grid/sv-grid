# Styling cells

Cells render as `<td>` and pick up the same CSS variable tokens as the rest
of the grid.
<div data-docs-demo="62-conditional-styling" data-height="540"></div>

## Default look

```css
table[role='grid'] td {
  border: 1px solid var(--sg-border);
  padding: 0.4rem 0.6rem;
  vertical-align: middle;
}
```

Override at `:root` or on the grid host.

## Per-cell styling

`ColumnDef` accepts a `cellClass` field. It can be:

- a **string** (or array of strings) - applied to every `<td>` in
  this column;
- a **function** - called per cell with the standard `CellContext`,
  returning a string, array, or `Record<string, boolean>`.

```ts
{
  field: 'salary',
  format: { type: 'currency', currency: 'USD' },
  cellClass: (ctx) => {
    const v = Number(ctx.getValue())
    if (v > 100_000) return 'cell-money-high'
    if (v <  20_000) return 'cell-money-low'
    return ''
  },
}
```

```css
:global(td.cell-money-high) { color: #16a34a; font-weight: 600; }
:global(td.cell-money-low)  { color: #b91c1c; }
```

The class is added to the existing `sv-grid-cell` class (other
modifiers like `sv-grid-cell-active`, `sv-grid-cell-editing`,
`data-align`, `data-pinned` still apply). Use `:global(...)` in
scoped Svelte styles since the cell lives outside the component
hash.

For row-level conditional styling, use the wrapper's
`rowClass={({ row }) => ...}` prop - same shape, scoped to the `<tr>`.
See [Styling rows](../rows/styling-rows.md).

## Right-align numbers

A common rule of thumb is "numbers right, everything else left". Target by
`editorType`:

```css
table[role='grid'] td[data-editor-type='number'] {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
```

(`data-editor-type` is set by the grid - verify by inspecting an element
in your devtools; if the attribute is not present in your build, fall back
to wrapping the value in a `<span class="tabular-nums">`.)

## Highlighting the active cell

The currently-active cell carries `aria-selected="true"` and matches the
focus-ring custom property:

```css
table[role='grid'] td[aria-selected='true'] {
  box-shadow: inset 0 0 0 2px var(--sg-accent);
}
```

## Edit-mode cell

While a cell is being edited, it carries `data-editing="true"` and renders
an `<input>` inside:

```css
table[role='grid'] td[data-editing='true'] {
  padding: 0;
}
table[role='grid'] td[data-editing='true'] input {
  width: 100%;
  height: 100%;
  padding: 0.4rem 0.6rem;
  border: 0;
  outline: none;
  background: var(--sg-bg);
}
```

## Styling from the value

`cellClass` takes a function and returns whatever `class:` accepts. Driving
it from the row rather than the index is what keeps the styling attached to the
data after a sort.

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

  const columns: GridColumns<Person> = [
    { field: 'name', header: 'Name', width: 190 },
    { field: 'salary', header: 'Salary', width: 140,
      format: { type: 'currency', currency: 'USD' },
      cellClass: (ctx) => ({ 'is-high': (ctx.row.original.salary ?? 0) > 160000 }) },
    { field: 'active', header: 'Active', width: 100,
      cellClass: (ctx) => (ctx.row.original.active ? 'ok' : 'off') },
  ]
</script>

<SvGrid data={people} {columns} sortable />

<style>
  :global(.is-high) { font-weight: 600; color: #b45309; }
  :global(.ok)  { color: #15803d; }
  :global(.off) { opacity: 0.5; }
</style>
```


## A static class per column

`cellClass` also takes a plain string, which is the right form when the rule is
about the column rather than the value - right-aligning a code, or a monospace
identifier.

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

  const columns: GridColumns<Person> = [
    { field: 'id',   header: 'ID',   width: 90,  cellClass: 'mono' },
    { field: 'name', header: 'Name', width: 200 },
    { field: 'city', header: 'City', width: 140 },
  ]
</script>

<SvGrid data={people} {columns} />

<style>
  :global(.mono) { font-family: ui-monospace, Menlo, monospace; opacity: 0.7; }
</style>
```

## See also

- [Highlighting changes](./highlighting-changes.md)
- [Cell components](./cell-components.md)
