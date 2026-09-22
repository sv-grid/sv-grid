---
seoTitle: Svelte spreadsheet data tools - filter, Goal Seek, PivotTable
seoDescription: The Data and Insert tabs of the SvSheet spreadsheet: AutoFilter, sort, Text to Columns, Remove Duplicates, Goal Seek, a PivotTable written from a range.
keywords: spreadsheet autofilter svelte, goal seek svelte, pivot table spreadsheet svelte, remove duplicates, text to columns, text to columns spreadsheet, split a column by delimiter
---

# Data tools: filter, sort, clean up, solve, pivot

What the Data tab does to a block of rows and what Insert > PivotTable
makes of one: the filter and its menu, a sort with levels, the two
clean-up wizards an export needs, the solver, and a pivot written as
cells. Each one is a dialog the shell carries, a definition the document
keeps, and a function you can call without the shell.
[Getting started](./start.md) shows the document; [Formulas](./formulas.md)
the engine these read.

The examples share a sales log, the shape a filter and a pivot are made
for.

```svelte {preamble}
<script lang="ts">
  import { SvSheet, createWorkbook, createSheetDocument, goalSeekCell, pivotBlock, pivotWrittenRect, pivotId, type SheetPivot } from '@svgrid/enterprise'

  const regions = ['North', 'South', 'East']
  const reps = ['Ada', 'Grace', 'Linus']
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
  // One row per deal, the same every time the page loads.
  let seed = 7
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
  const log: string[][] = [['Region', 'Rep', 'Quarter', 'Product', 'Amount', 'Status']]
  for (const region of regions) {
    for (const quarter of quarters) {
      log.push([region, reps[Math.floor(next() * reps.length)]!, quarter, next() < 0.5 ? 'Licence' : 'Support', String(4000 + Math.round(next() * 9000)), next() < 0.7 ? 'Won' : 'Open'])
    }
  }
  const LAST = log.length - 1  // the last data row, 0-based

  const at = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }

  function logDoc(extraCols = 0) {
    // A workbook takes a dense block: pad every row to the same width.
    const width = 6 + extraCols
    const padded = log.map((row) => { const out = [...row]; while (out.length < width) out.push(''); return out })
    const d = createSheetDocument({ workbook: createWorkbook([{ name: 'Sales', cells: padded }]) })
    const s = d.get('Sales')
    s.formats.set([[0, 0, 0, width - 1]], { bold: true, fill: '#e2e8f0', color: '#0f172a' }, at)
    s.formats.set([[1, 4, LAST, 4]], { numFmt: '$#,##0' }, at)
    s.freeze = { rows: 1, cols: 0 }
    return d
  }
</script>
```

## Filter

`Ctrl+Shift+L`, or Data > Filter, puts an arrow on every header cell of
the region around the active cell. The arrow drops Excel's menu: Sort A
to Z and Z to A, Clear Filter, Text Filters or Number Filters (equals,
begins with, contains, greater than, between and the rest, two joined
with And or Or), Date Filters on a column of dates (Today, This Week,
Last Month, Year to Date and the rest), Filter by Color when the
column's cells carry more than one fill, Top 10 on numbers, a search
box, and the column's values with their counts. OK folds the rows that
fail; the arrow turns into a funnel, the row numbers turn blue and the
status bar reads "N of M records found".

A filter is part of the document, so a sheet can open already filtered.
`autoFilter` is the region and a filter per column index: `values` with
the texts left unticked, `condition` with one or two operators, `date`
with a period, `color` with a fill, or `top` with a count.

```svelte {runnable}
<script lang="ts">
  const doc = logDoc()
  doc.get('Sales').autoFilter = {
    range: [0, 0, LAST, 5],
    filters: {
      5: { kind: 'values', excluded: ['Won'] },
      4: { kind: 'condition', first: { op: 'greaterThan', value: '6000' } },
    },
  }
</script>

<SvSheet document={doc} rows={16} columns={7} />
```

Open deals over 6,000. Type `Won` into one of them: it folds away at
once, since the rows are worked out again after every change. A folded
row is the filter's, not a hidden row: Unhide leaves it, and `Ctrl+Shift+L`
again shows it while a row hidden by hand stays hidden. The filter rides
in `getState()` as `autoFilter`, reports `{ kind: 'filter' }` on
`onChange`, and goes into the `.xlsx` with its criteria.

<div data-docs-demo="464-ticket-log-autofilter" data-height="560"></div>

## Sort

Data > Sort A to Z and Z to A sort the region around the active cell by
the column the cell is in, the header row staying where it is (the
filter menu's Sort does the same). Data > Sort opens the dialog with
levels: sort by Region, then by Amount largest to smallest. The format
store keys on the row's id, so a sorted row keeps its fills and number
formats. `sortOrder` and `guessHeaderRow` are the same sort as functions, for a
shell of your own.

## Text to Columns and Remove Duplicates

An export lands in column A, `;`-separated, with the same people in it
twice. Data > Text to Columns opens a wizard that has already guessed the
delimiter and previews the split; Data > Remove Duplicates lets you tick
the columns that decide identity, compares without regard to case as
Excel does, and reports how many it removed and how many unique rows
remain. Each is one `Ctrl+Z`.

```svelte {runnable}
<SvSheet
  data={[{ name: 'Import', cells: [
    ['name;email;company'],
    ['Ada Lovelace;ada@example.com;Analytical'],
    ['Grace Hopper;grace@example.com;Navy'],
    ['ada lovelace;ada@example.com;Analytical'],
    ['Linus Torvalds;linus@example.com;Kernel'],
    ['Grace Hopper;grace@example.com;Navy'],
  ] }]}
  columnWidths={{ A: 280 }}
  rows={10}
  columns={5}
/>
```

Select A1:A6, Data > Text to Columns, Finish; then with the block
selected, Data > Remove Duplicates with every column ticked: two rows go.
Both dialogs are the shell's; a host with a wizard of its own takes
`text-to-columns` or `remove-duplicates` over in `onAction` and writes
inside `cmd.batch`, so its version is one undo too.

<div data-docs-demo="458-data-cleanup" data-height="560"></div>

## Goal Seek

Data > Goal Seek: set a formula cell to a value by changing one input
cell. The solver is a secant search with a bisection fallback; the sheet
does not move until the status dialog says it found a solution and OK
is pressed, and OK writes through the grid's command context, so it is
one `Ctrl+Z`.

The same search is `goalSeekCell` on a workbook, which tries values in
the input cell and puts the original back, returning what it found:

```svelte {runnable}
<script lang="ts">
  const wb = createWorkbook([{ name: 'Pricing', cells: [
    ['Price', '49'],
    ['Units', '400'],
    ['Unit cost', '18'],
    ['Fixed costs', '9000'],
    ['Profit', '=(B1-B3)*B2-B4'],
  ] }])
  const doc = createSheetDocument({ workbook: wb })
  doc.get('Pricing').formats.set([[0, 1, 4, 1]], { numFmt: '#,##0.00' }, at)
  doc.get('Pricing').widths.A = 110

  let sheet = $state<SvSheet>()
  let found = $state('')
  function seek() {
    const r = goalSeekCell(wb, { sheet: 'Pricing', row: 4, col: 1 }, { sheet: 'Pricing', row: 0, col: 1 }, 20000)
    found = r.converged ? `a price of ${r.value.toFixed(2)} gives a profit of 20,000` : 'no solution found'
    if (r.converged) { wb.setRaw('Pricing', 0, 1, String(r.value)); sheet?.refresh() }
  }
</script>

<button type="button" onclick={seek}>Set profit to 20,000 by changing the price</button>
<span style="font-size: 12px"> {found}</span>
<SvSheet bind:this={sheet} document={doc} rows={7} columns={3} />
```

A write with `setRaw` is one the shell cannot see, hence `refresh()`; a
dialog of your own should write through `cmd.setCellValue` from
`onAction` instead, which repaints and lands in the undo history.

<div data-docs-demo="457-goal-seek" data-height="600"></div>

## PivotTable from a range

Insert > PivotTable summarises the selected block, or the region around
a single cell, on the same pivot engine the grid's pivot mode uses. The
dialog takes the source (its first row the field names), where the
result goes, and which field is a row, a column, a filter or a measure,
with Sum, Average, Count, Distinct count, Min and Max.

What the sheet keeps is the definition; what it writes is cells. The
result is an ordinary block, so it can be formatted, charted, filtered
and saved to an `.xlsx` like anything typed. Insert > Refresh rebuilds
it from the source, Show Details writes the rows behind a cell to a
sheet of their own, and opening the dialog from inside a block edits
that pivot. A document can ship with one: `pivotBlock` computes the
cells, `pivotWrittenRect` the rectangle they cover, and the definition
goes in `pivots`.

```svelte {runnable}
<script lang="ts">
  const doc = logDoc(8)
  const sheet = doc.get('Sales')
  const pivot: SheetPivot = {
    id: pivotId(),
    source: [0, 0, LAST, 5],
    target: { row: LAST + 2, col: 0 },
    rows: ['Region'],
    cols: ['Quarter'],
    values: [{ field: 'Amount', agg: 'sum' }],
  }
  const cells = doc.workbook
  const valueAt = (r: number, c: number) => {
    const text = cells.getRaw('Sales', r, c)
    const n = Number(text)
    return text !== '' && Number.isFinite(n) ? n : text
  }
  const textAt = (r: number, c: number) => cells.getRaw('Sales', r, c)
  const block = pivotBlock(pivot, valueAt, textAt)
  pivot.written = pivotWrittenRect(pivot, block)
  block.forEach((line, i) => line.forEach((text, j) => cells.setRaw('Sales', pivot.target.row + i, pivot.target.col + j, text)))
  sheet.pivots = [pivot]
  const top = pivot.target.row
  sheet.formats.set([[top, 0, top, 5]], { bold: true, fill: '#e2e8f0', color: '#0f172a' }, at)
  sheet.formats.set([[top + 1, 1, pivot.written[2], 5]], { numFmt: '$#,##0' }, at)
</script>

<SvSheet document={doc} height={560} rows={LAST + 9} columns={8} />
```

Change an Amount in the log, click inside the block, then Insert >
Refresh: the block is rewritten (Refresh rebuilds the PivotTable the
cursor is in). The block sits two rows under the log, Total column and
grand total in view. Pivots ride in `getState()` as `pivots`, report
`{ kind: 'pivots' }`, move with an insert or a delete, and are dropped
when their source or target cell is deleted.

<div data-docs-demo="487-sheet-pivot-range" data-height="600"></div>

## See also

- [Tables and structured references](../cells/tables.md) - Format as Table, which gives a block a name, banding and `=SUM(Orders[Amount])`.
- [Charts, sparklines and pictures](./charts-and-objects.md) - a chart over the pivot's block.
- [Pivot tables on the grid](../pivot.md) - the grid's own pivot mode, for rows that are not a sheet.
- [Filtering on the grid](../filtering/overview.md) - the Excel-style filter compiler the sheet's conditions run through.
- [The spreadsheet shell](../cells/spreadsheet-shell.md) - the AutoFilter menu item by item, and the pivot dialog's Filter area and Show Details.
