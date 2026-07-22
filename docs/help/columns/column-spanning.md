# Column & row spanning (merged cells)

Spanning lets a single body cell cover **multiple columns** and/or **rows** -
merged report headers, grouped labels, financial statements. SvGrid does this
with a real `colspan` / `rowspan` merge engine; there are two ways to drive it.

<div data-docs-demo="170-cell-merging" data-height="480"></div>

## 1. Explicit merges (spreadsheet-style)

Declare exact merges as `MergeSpec[]` and apply them with the
`spreadsheetLayout` action. The origin cell `(rowIndex, columnId)` spans
`colspan` columns right and `rowspan` rows down; covered cells are hidden.

```svelte
<script lang="ts">
  import { spreadsheetLayout, type MergeSpec } from '@svgrid/grid'

  const merges: MergeSpec[] = [
    { rowIndex: 0, columnId: 'A', colspan: 6 },       // title bar
    { rowIndex: 14, columnId: 'A', colspan: 3 },      // "Total" label
  ]
</script>

<div use:spreadsheetLayout={{ merges, columnOrder: columns.map((c) => c.id) }}>
  <SvGrid {data} {columns} />
</div>
```

See [demos/170-cell-merging.svelte](../../../examples/src/demos/170-cell-merging.svelte).

## 2. Declarative `colSpan` / `rowSpan` (value-driven)

For data-driven spanning - "merge each run of equal values", "this cell spans 2
columns when X" - put `colSpan` / `rowSpan` callbacks on the column and turn
them into merges with `spansToMerges`. This runs on the **same** merge engine
as option 1 (no separate code path).

```svelte
<script lang="ts">
  import { spreadsheetLayout, spansToMerges, type ColumnDef } from '@svgrid/grid'

  const columns: ColumnDef<F, Row>[] = [
    { id: 'region', field: 'region',
      // merge each vertical run of equal regions
      rowSpan: ({ data, rowIndex }) => {
        if (rowIndex > 0 && rows[rowIndex - 1].region === data.region) return 1 // covered
        let n = 1
        while (rows[rowIndex + n]?.region === data.region) n += 1
        return n
      } },
    { id: 'country', field: 'country' },
    { id: 'amount', field: 'amount' },
  ]

  // Recompute after sort / filter - indexes are display-row indexes.
  const merges = $derived(spansToMerges(rows, columns))
</script>

<div use:spreadsheetLayout={{ merges, columnOrder: columns.map((c) => c.id) }}>
  <SvGrid {data} {columns} />
</div>
```

`colSpan` / `rowSpan` receive `CellSpanParams` (`{ data, rowIndex, columnId,
value }`) and return the span count (1 = no span). `spansToMerges` handles
covered-cell bookkeeping so overlapping spans never double-emit.

## Virtualization note

`rowSpan` uses real `rowspan`, which needs the covered rows mounted in the
render window. For very large spanning grids, keep spans modest or disable row
virtualization (`virtualization={false}`) on that grid so the origin cell stays
mounted while its covered rows are on screen.

## See also

- [Cell merging demo](../../../examples/src/demos/170-cell-merging.svelte)
- [Row spanning](../rows/row-spanning.md)
