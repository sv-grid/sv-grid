# Tooltips

There is no built-in tooltip API on `ColumnDef`. Use the standard `title`
attribute, an accessible `<dialog>`, or any popover library - wired
through a custom cell renderer.

<div data-docs-demo="85-tooltips-and-notes" data-height="480"></div>

## With `title` (no JS, screen-reader friendly)

```ts
{
  field: 'description',
  cell: (ctx) => renderSnippet(EllipsisCell, {
    value: String(ctx.getValue() ?? ''),
  }),
}
```

```svelte
{#snippet EllipsisCell(p: { value: string })}
  <span title={p.value} class="block truncate">{p.value}</span>
{/snippet}
```

`title` is the safest default: screen readers announce it; mouse users see
a tooltip; keyboard users see it on focus (when wrapped in a focusable
element).

## With a popover library

Pass a component instead of a snippet:

```ts
import TooltipCell from './TooltipCell.svelte'
import { renderComponent } from '@svgrid/grid'

{
  field: 'description',
  cell: (ctx) => renderComponent(TooltipCell, {
    value: String(ctx.getValue() ?? ''),
    tip: ctx.row.original.fullDescription,
  }),
}
```

## Header tooltips

The same pattern, but via the `header:` field - see
[Custom header components](../columns/custom-header-components.md).

## Gotchas

- The grid's column-menu popover and the cell-edit overlay use top-layer
  z-indices around 100. Your tooltip should be either lower (so it slides
  under those overlays when both open) or higher with a click-outside
  dismissal.
- A long tooltip inside an Excel-style filter dropdown can occlude the
  filter input. Detach the tooltip from cells inside an open filter menu.

## A tooltip from the row

`tooltip` takes a string or a function. The function form gets the cell context,
so the tip can say something the cell cannot fit - which is the only good reason
to have one.

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
    { field: 'name', header: 'Name', width: 190,
      tooltip: (ctx) => ctx.row.original.department + ' - joined ' + ctx.row.original.joined },
    { field: 'salary', header: 'Salary', width: 140,
      format: { type: 'currency', currency: 'USD' },
      tooltip: (ctx) => 'Reviewed annually' },
  ]
</script>

<SvGrid data={people} {columns} />
```


## Returning nothing

Return `null` or `undefined` and no tooltip appears. That is how you give one
only to the rows that need it, instead of training people to ignore them.

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
    { field: 'active', header: 'Active', width: 120,
      // Only the inactive rows explain themselves.
      tooltip: (ctx) => (ctx.row.original.active ? null : 'Left the company') },
  ]
</script>

<SvGrid data={people} {columns} />
```

## See also

- [Cell components](./cell-components.md)
