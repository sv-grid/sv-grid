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

## Row layout

The markup is a `<table>`, but each `<tr>` is laid out as a flex row of
fixed-width cells (`display: flex`), not by the table algorithm. On a
horizontal scroll the grid adds and removes a column of cells every frame.
A table re-lays every row for that; a flex row re-lays only its own cells.
On the 503 big-data demo at 10,000 columns that is about 1 ms of layout a
frame instead of 2.7 ms.

What this changes for your CSS:

- A body cell's content sits in `<span class="sv-grid-cell-line">`, a
  block that fills the cell. `text-align` on the cell still aligns it, and
  the ellipsis lives on that span.
- `vertical-align` on a cell does nothing. Cells centre their content with
  `align-items: center`; set `align-items` on the cell to change it.
- A row's `height` is exact, not a minimum. A row is as tall as
  `rowHeight` says, because that is where the virtualizer places it, and
  content taller than that is clipped instead of growing the row. Raise
  `rowHeight` for taller content, or set `autoRowHeight` to let each row
  grow to fit.

`rowLayout="table"` brings back table layout. The grid uses it on its own
when `mergedCells` holds a merge with `rowSpan` above 1, since a cell
spanning rows needs the table algorithm, and under the
`use:spreadsheetLayout` action.

```css
/* Top-align the cells of one grid. */
.my-grid .sv-grid-cell {
  align-items: flex-start;
}
```

Body rows are not CSS-contained by default. `--sg-row-contain` sets a
`contain` value on every body row if your app wants one:

```css
.my-grid {
  --sg-row-contain: layout paint;
}
```

We measured `layout paint` and left it off: each contained row becomes a
separate clipped piece of paint, and Chrome redoes its layer work for
every one of them on each scroll frame, which doubled the main-thread
work of a horizontal scroll on a 1,000-column grid. It also makes a row
the containing block for `position: fixed` content inside it.

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

The `zebraRows` prop stripes every other DATA row with the theme's --sg-row-alt-bg token. Pinned, group, detail and summary rows keep their single background, so a pinned total row still reads as one solid band. The stripe follows whatever preset or dark mode the page is on.

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
