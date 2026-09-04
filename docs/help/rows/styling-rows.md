# Styling rows

Rows are `<tr role="row">` elements inside the grid table. Style them with
plain CSS.
<div data-docs-demo="62-conditional-styling" data-height="540"></div>

## Zebra striping

The examples on this page run against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    age: number
    salary: number
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000 },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000 },
    { id: 5, name: 'Barbara Liskov', department: 'Platform',    city: 'Boston',   age: 52, salary: 172000 },
  ]

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 190, editorType: 'text' },
    { field: 'department', header: 'Department', width: 150, editorType: 'text' },
    { field: 'city',       header: 'City',       width: 130, editorType: 'text' },
    { field: 'age',        header: 'Age',        width: 80,  editorType: 'number' },
    { field: 'salary',     header: 'Salary',     width: 130, editorType: 'number', format: { type: 'currency', currency: 'USD' } },
  ]
</script>
```

```css
table[role='grid'] tbody tr:nth-child(even) {
  background: var(--sg-row-alt-bg);
}
```

## Hover

```css
table[role='grid'] tbody tr:hover {
  background: var(--sg-row-hover-bg);
}
```

## Selection

A selected row carries `aria-selected="true"`:

```css
table[role='grid'] tbody tr[aria-selected='true'] {
  background: var(--sg-selection-bg);
}
```

## Conditional row styling

`<SvGrid>` accepts a `rowClass` callback. Return a string, an array
of strings, or a `Record<string, boolean>`, and the classes are
added to the `<tr>`:

```svelte
<SvGrid
  data={rows}
  {columns}
  features={features}
  rowClass={({ row }) => ({
    'is-overdue':   row.dueDate < new Date().toISOString().slice(0, 10),
    'is-cancelled': row.status === 'cancelled',
  })}
/>

<style>
  :global(tr.is-overdue   .sv-grid-cell) { background: rgba(220, 38, 38, 0.06); }
  :global(tr.is-cancelled .sv-grid-cell) { color: var(--sg-muted); text-decoration: line-through; }
</style>
```

The callback receives `{ row, rowIndex }` - the un-mutated source
row + its data-array index. Runs per visible row on every render, so
keep the body cheap (string lookups, equality checks - no `.find()`
over the whole dataset).

For one-cell tints, use `cellClass` on the column def - same shape,
called per cell with the standard `CellContext`. See
[Styling cells](../cells/styling-cells.md).

## CSS custom properties

The gallery defines these tokens - override at `:root` or on the grid host:

```
--sg-bg                 grid background
--sg-fg                 grid foreground
--sg-border             cell borders
--sg-header-bg          header background
--sg-header-fg          header foreground
--sg-row-alt-bg         even-row background
--sg-row-hover-bg       hover background
--sg-selection-bg       selected-row background
--sg-focus-ring         focus outline (box-shadow)
--sg-accent             primary accent (sort arrow, etc)
```

## More examples

### Zebra rows

The `zebraRows` prop stripes every other DATA row with the theme\'s --sg-row-alt-bg token. Pinned, group, detail and summary rows keep their single background, so a pinned total row still reads as one solid band. The stripe follows whatever preset or dark mode the page is on.

<div data-docs-demo="174-zebra-rows" data-height="460"></div>

## Try it

`rowClass` receives the row and its index and returns whatever `class:` accepts -
a string, a list, or an object of conditions. Driving it from the data rather
than the index is what keeps the styling correct after a sort.

```svelte {runnable}
<SvGrid
  data={people}
  {columns}
  sortable
  rowClass={({ row }) => ({
    'is-senior': row.age >= 50,
    'is-costly': row.salary > 160000,
  })}
/>

<style>
  :global(.is-senior) { font-weight: 600; }
  :global(.is-costly) { background: color-mix(in srgb, #f59e0b 12%, transparent); }
</style>
```

## See also

- [Row height](./row-height.md)
- [Custom cells](../cells/cell-components.md)
