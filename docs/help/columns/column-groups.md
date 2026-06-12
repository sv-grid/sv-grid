# Column groups

A column group is a `ColumnDef` whose `columns` array contains children.
The parent renders a spanning header above its children. The pivot demo
below shows three levels of grouped headers in action - Year wraps
Quarter wraps measure:

<div data-docs-demo="52-pivot-table" data-height="540"></div>



```ts
const columns: ColumnDef<{}, Person>[] = [
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

## See also

- [Column definitions](./column-definitions.md)
- [Custom header components](./custom-header-components.md)
