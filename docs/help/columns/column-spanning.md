# Column & row spanning (merged cells)

Spanning lets a single body cell cover **multiple columns** and/or **rows** -
merged report headers, grouped labels, financial statements. SvGrid does this
with a real `colspan` / `rowspan` merge engine; there are three ways to drive
it, and the first is the one to reach for on a new grid.

<div data-docs-demo="170-cell-merging" data-height="480"></div>

## 0. The `mergedCells` prop (the renderer's own)

The grid draws merges itself from a list of origins with their spans, in
display indices:

```svelte
<SvGrid
  {data} {columns}
  mergedCells={[
    { rowIndex: 0, colIndex: 0, rowSpan: 1, colSpan: 4 },   // a title across A1:D1
    { rowIndex: 3, colIndex: 1, rowSpan: 3, colSpan: 1 },   // B4:B6 as one cell
  ]}
/>
```

The origin's td takes the `rowspan` / `colspan` and shows the origin's
value; the covered cells are not drawn at all, so there is nothing to
hide after the fact. A selection grows to whole merges (a merged cell is
one cell), the active cell inside a merge is its origin, the arrow keys
step over a merge as one cell, and `api.getMergedCells()` reads the list
back. Under row virtualization a merge whose origin has scrolled out of
the rendered window is drawn from its first rendered row with the rows
that remain, and one that crosses the frozen boundary is drawn in two
parts; nothing needs the covered rows mounted. The grid does not write
into covered cells on its own; a consumer that merges keeps them empty or
marks them read-only through the column's `editable`, which is what the
spreadsheet shell's Merge & Center does.

## 1. Explicit merges (spreadsheet-style, DOM action)

Declare exact merges as `MergeSpec[]` and apply them with the
`spreadsheetLayout` action, which works on a grid you do not own the
render of (it edits the table after each paint). Prefer `mergedCells`
where you can. The origin cell `(rowIndex, columnId)` spans
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
  // `SpanColumn` rather than `ColumnDef`: `spansToMerges` needs `id` to be
  // present, and on a ColumnDef it is optional.
  import { spreadsheetLayout, spansToMerges, type SpanColumn } from '@svgrid/grid'

  const columns: SpanColumn<Row>[] = [
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

The declarative `rowSpan` and the `spreadsheetLayout` action use real
`rowspan` and need the covered rows mounted in the render window. For very
large spanning grids on those two, keep spans modest or disable row
virtualization (`virtualization={false}`) so the origin cell stays mounted
while its covered rows are on screen. The `mergedCells` prop has no such
limit: it clamps every span to the rendered window and continues a merge
from its first rendered row.

## More examples

### Budget report: merged headers

A half-year budget report laid out with merged cells the way Excel lays one out: a title merged across the page, Q1 / Q2 / H1 group headers merged over their months, a Line corner merged down two rows, a notes paragraph merged into one wrapped block. A merge is one cell to the grid: click inside Q1 and the Name Box says B2, Merge & Center lights, the arrows step over it and its column letters are shaded. Unmerge and merge again from the ribbon; Ctrl+Z each step.

<div data-docs-demo="463-merged-report-headers" data-height="560"></div>

## See also

- [Cell merging demo](../../../examples/src/demos/170-cell-merging.svelte)
- [Row spanning](../rows/row-spanning.md)
