# Column groups

A column group is a `ColumnDef` whose `columns` array contains children.
The parent renders a spanning header above its children. The pivot demo
below shows three levels of grouped headers in action - Year wraps
Quarter wraps measure:

<div data-docs-demo="52-pivot-table" data-height="540"></div>



The examples on this page run against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

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

  let rows = $state<Person[]>(people)
  const data = people

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 200 },
    { field: 'department', header: 'Department', width: 150 },
    { field: 'city',       header: 'City',       width: 140 },
    { field: 'age',        header: 'Age',        width: 90 },
    { field: 'salary',     header: 'Salary',     width: 130, format: { type: 'currency', currency: 'USD' } },
  ]
</script>
```

```ts
const columns: GridColumns<Person> = [
  { field: 'firstName', header: 'First name' },
  { field: 'lastName',  header: 'Last name' },
  {
    id: 'compensation',
    header: 'Compensation',
    columns: [
      { field: 'salary', header: 'Salary',
        format: { type: 'currency', currency: 'USD' } },
      { field: 'bonus',  header: 'Bonus',
        format: { type: 'currency', currency: 'USD' } },
    ],
  },
]
```

Rendered as:

```
|              | Compensation         |
| First | Last | Salary | Bonus       |
```

## How it works

- The grid walks the column tree once, producing two header groups -
  the parent row and the leaf row.
- Each parent header gets a `colSpan` equal to the count of leaf descendants
  it has.
- The cell body only renders leaves.

## Nested groups

Groups can nest arbitrarily. The grid emits one header row per depth level:

```ts
{
  header: 'Q1',
  columns: [
    { header: 'Jan', field: 'jan' },
    { header: 'Feb', field: 'feb' },
    { header: 'Mar', field: 'mar' },
  ],
},
{
  header: 'Q2',
  columns: [/* … */],
},
```

## Collapsible groups (`columnGroupShow`)

Give a group a collapse toggle by tagging its child columns:

- `columnGroupShow: 'open'` - the child shows **only while the group is expanded**,
- `columnGroupShow: 'closed'` - shows **only while collapsed**,
- omitted - always shown.

Setting it on any direct child adds a caret to the group header. Use
`openByDefault` on the group to start expanded (default is collapsed).

```ts
{
  id: 'q1', header: 'Q1', openByDefault: true,
  columns: [
    { field: 'q1Total', header: 'Total' },                    // always visible
    { field: 'jan', header: 'Jan', columnGroupShow: 'open' },  // only when expanded
    { field: 'feb', header: 'Feb', columnGroupShow: 'open' },
    { field: 'mar', header: 'Mar', columnGroupShow: 'open' },
  ],
}
```

Collapsing/expanding hides or shows the tagged leaves and the group header's
`colSpan` recomputes so the multi-level header stays aligned.

<div data-docs-demo="183-collapsible-column-groups" data-height="480"></div>

## Group with a custom header

The same `header: (ctx) => renderSnippet(...)` pattern from
[custom header components](./custom-header-components.md) works for group
headers. The `ctx.header.colSpan` value will be the rendered span.

## Gotchas

- A group needs an `id` (or a string `header`) - the grid uses it to give the
  parent header a stable DOM id.
- Hidden columns (`api.setColumnVisible(id, false)`) shrink their group's
  `colSpan` automatically.
- A group cannot be sorted or filtered - only its leaves can.

## Try it

A group is a column with `columns` instead of a `field`. Nest as deep as you
need; the header row count follows the deepest branch.

```svelte {runnable}
<script lang="ts">
  const grouped: GridColumns<Person> = [
    { field: 'name', header: 'Name', width: 200 },
    {
      header: 'Employment',
      columns: [
        { field: 'department', header: 'Department', width: 150 },
        { field: 'salary', header: 'Salary', width: 130, format: { type: 'currency', currency: 'USD' } },
      ],
    },
    {
      header: 'Personal',
      columns: [
        { field: 'city', header: 'City', width: 140 },
        { field: 'age', header: 'Age', width: 90 },
      ],
    },
  ]
</script>

<SvGrid data={people} columns={grouped} />
```

## See also

- [Column definitions](./column-definitions.md)
- [Custom header components](./custom-header-components.md)
