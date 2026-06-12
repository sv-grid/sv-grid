# Row spanning

"Row spanning" lets one cell's content cover **multiple rows**, the way a
merged cell does in a spreadsheet.

## Status

Row spanning is **not yet built in**. The grid renders a strict 1-cell-per-
row-column grid; there is no `rowSpan` field on `ColumnDef` or
`CellContext`.

## Workarounds

### 1. Group-by

If the spanning intent is "show 'Engineering' once for every engineer", use
grouping ([Row data](./row-data.md), [demos/07](../../../examples/src/demos/07-grouping-aggregation.svelte)) - the grid renders a single group row
in place of repeated values.

### 2. Cell renderer that suppresses repeats

If you simply want the *display* of repeated values to be blanked, render
the value only when it differs from the row above:

```ts
const columns: ColumnDef<{}, Person>[] = [
  {
    field: 'department',
    header: 'Department',
    cell: (ctx) => {
      const data = ctx.table.getRowModel().rows
      const prev = data[ctx.row.index - 1]?.getCellValueByColumnId('department')
      return prev === ctx.getValue() ? '' : ctx.getValue() as string
    },
  },
]
```

This *looks* like a span but does not actually merge cells - keyboard
navigation still moves through every row.

## Tracked at

[Missing features](../missing-features.md) → "row spanning / merged cells".

## See also

- [Column spanning](../columns/column-spanning.md)
- [Grouping](./row-data.md)
