# Custom header components

The `header` field on a `ColumnDef` accepts a function that returns either
a `renderSnippet(...)` or `renderComponent(...)`. The function receives a
`HeaderContext` so it can access the column, header, and grid.

In the demo below, the **column headers** are custom: each quarter header and
each measure header (with its icon) is rendered from a snippet via
`header: () => renderSnippet(...)`.
<div data-docs-demo="121-pivot-conditional-cells" data-height="540"></div>

## With a snippet

The examples on this page run against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    email: string
    department: string
    age: number
    salary: number
    city: string
    startDate: string
    active: boolean
  }
</script>
```

```svelte {runnable}
<script lang="ts">
  import { renderSnippet, type GridColumns } from '@svgrid/grid'

  const columns: GridColumns<Person> = [
    {
      field: 'salary',
      header: (ctx) => renderSnippet(SalaryHeader, { sorted: ctx.column.getIsSorted() }),
      format: { type: 'currency', currency: 'USD' },
    },
  ]
</script>

{#snippet SalaryHeader(p: { sorted: false | 'asc' | 'desc' })}
  <span class="inline-flex items-center gap-1">
    <span>💰 Salary</span>
    {#if p.sorted === 'asc'}↑{:else if p.sorted === 'desc'}↓{/if}
  </span>
{/snippet}
```

## With a component

```ts
import HeaderWithIcon from './HeaderWithIcon.svelte'
import { renderComponent } from '@svgrid/grid'

const columns = [
  {
    field: 'status',
    header: () => renderComponent(HeaderWithIcon, { icon: 'flag', label: 'Status' }),
  },
]
```

## HeaderContext

The argument passed to your header callback exposes:

```ts
type HeaderContext<TData> = {
  header: Header<TData>
  column: Column<TData>
  table: SvGrid<TData>
}

// Column gives you sort state, filter capability, and the toggle handler:
ctx.column.getCanSort()
ctx.column.getIsSorted()                    // false | 'asc' | 'desc'
ctx.column.getToggleSortingHandler()        // () => void
```

## When to use it

Anything that needs more than a string belongs here - multi-line headers,
filter icons inside the header, units, tooltips, custom sort indicators,
a "select all" checkbox in a leading column.

## Interactive elements inside a header

Custom headers can contain real interactive controls - buttons, inputs,
dropdowns, menus - and the grid routes clicks correctly:

- A click that lands on an interactive element (`<button>`, `<a>`, `<input>`,
  `<select>`, `<textarea>`, or anything with `role="button"` / `role="menuitem"`)
  is handled by that element - it does **not** trigger a sort.
- A click on the blank header area still toggles sorting when the column is
  sortable (Enter / Space work too).

So you can drop a filter dropdown or a small toolbar straight into a header
without fighting the sort handler:

```svelte
{#snippet StatusHeader()}
  <span class="inline-flex items-center gap-2">
    <span>Status</span>
    <button type="button" onclick={openStatusFilter} aria-label="Filter status">⏷</button>
  </span>
{/snippet}
```

## Gotchas

- Wrap your snippet output in **inline-level** markup (`<span>`, `<div>` with
  `inline-flex`). The grid renders the result inside a `<th>`'s text node
  position - block layout will misalign with the sort indicator and
  pin-handle decorations the grid adds around it.
- Snippet/component props are recomputed on every render. Keep them cheap.

## Try it

`header` takes a snippet as readily as a string, so a header can carry a unit or
a second line without a separate API.

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
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000 },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000 },
    { id: 5, name: 'Barbara Liskov', department: 'Platform',    city: 'Boston',   age: 52, salary: 172000 },
  ]

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 190 },
    { field: 'department', header: 'Department', width: 150 },
    { field: 'salary',     header: 'Salary',     width: 130, format: { type: 'currency', currency: 'USD' } },
  ]
</script>

{#snippet SalaryHeader()}
  <span style="display: inline-flex; flex-direction: column; line-height: 1.2;">
    <span>Salary</span>
    <span style="font-size: 10px; opacity: 0.6; font-weight: 400;">USD / year</span>
  </span>
{/snippet}

<SvGrid
  data={people}
  columns={[
    { field: 'name', header: 'Name', width: 190 },
    { field: 'department', header: 'Department', width: 160 },
    { field: 'salary', width: 150,
      header: () => renderSnippet(SalaryHeader, {}),
      format: { type: 'currency', currency: 'USD' } },
  ] satisfies GridColumns<Person>}
  sortable
  rowHeight={34}
/>
```

## See also

- [Cell components](../cells/cell-components.md) - same API on the body side.
