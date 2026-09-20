<script lang="ts">
  /**
   * 487. PivotTable from a range
   * ----------------------------
   * Excel's Insert > PivotTable over a block of cells, on the same pivot
   * engine the grid uses for its own pivot mode.
   *
   * The sheet keeps the DEFINITION: the source block, where the result
   * goes, and which field is a row, a column or a measure. The RESULT is
   * plain cells, written in one undo, so everything else in the shell
   * works on it: format it, chart it, print it, save it to an .xlsx.
   * Refresh rebuilds the block from the source, which is what a pivot over
   * live cells owes you.
   *
   *   Insert > PivotTable   the dialog on the selected block, or on the
   *                         pivot the cursor is already in
   *   Insert > Refresh      rebuild the one here
   *
   * This sheet opens with a pivot already written at H1: sales by region
   * down the rows, quarters across the columns, the amounts summed.
   *
   * Try: change an Amount in E2:E25, put the cursor in the pivot and press
   * Refresh. Click a number in the pivot and press Show Details for the
   * rows behind it, on a sheet of their own. Open the dialog from inside it
   * and move Rep into Rows under Region, or make Amount an Average. Select
   * A1:E25 and build a second one somewhere else.
   */
  import {
    SvSheet, createWorkbook, createSheetDocument,
    pivotBlock, pivotWrittenRect, pivotId, type SheetPivot,
  } from '@svgrid/enterprise'

  const regions = ['North', 'South', 'EMEA']
  const reps = ['Ada', 'Grace', 'Linus']
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
  const products = ['Licence', 'Support']

  // A plain sales log: one row per deal, the shape a pivot is made for.
  const log: string[][] = []
  let seed = 7
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
  for (const region of regions) {
    for (const quarter of quarters) {
      for (const product of products) {
        log.push([
          region,
          reps[Math.floor(next() * reps.length)]!,
          quarter,
          product,
          String(4000 + Math.round(next() * 9000)),
        ])
      }
    }
  }

  const header = ['Region', 'Rep', 'Quarter', 'Product', 'Amount']
  const cells: string[][] = [header, ...log]

  // The pivot this sheet opens with. Its block is computed here so the
  // document arrives with the summary already in the cells; from then on
  // Refresh rewrites it through the shell.
  const source = [0, 0, cells.length - 1, 4] as const
  const pivot: SheetPivot = {
    id: pivotId(),
    source: source as unknown as SheetPivot['source'],
    target: { row: 0, col: 7 },
    rows: ['Region'],
    cols: ['Quarter'],
    values: [{ field: 'Amount', agg: 'sum' }],
  }
  const valueAt = (r: number, c: number) => {
    const text = cells[r]?.[c] ?? ''
    const n = Number(text)
    return text !== '' && Number.isFinite(n) ? n : text
  }
  const textAt = (r: number, c: number) => cells[r]?.[c] ?? ''
  const block = pivotBlock(pivot, valueAt, textAt)
  pivot.written = pivotWrittenRect(pivot, block)
  block.forEach((line, i) => {
    const row = (cells[pivot.target.row + i] ??= [])
    line.forEach((text, j) => { row[pivot.target.col + j] = text })
  })
  // A workbook takes a dense block: the gap between the log and the pivot,
  // and any short row, has to be empty strings rather than holes.
  const width = cells.reduce((w, row) => Math.max(w, row.length), 0)
  for (const row of cells) {
    for (let c = 0; c < width; c += 1) row[c] ??= ''
  }

  const wb = createWorkbook([{ name: 'Sales', cells }])
  const doc = createSheetDocument({ workbook: wb })
  const sheet = doc.get('Sales')
  const at = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }
  sheet.formats.set([[0, 0, 0, 4]], { bold: true, fill: '#e2e8f0', color: '#0f172a' }, at)
  sheet.formats.set([[1, 4, cells.length - 1, 4]], { numFmt: '$#,##0' }, at)
  // The written block: its header row, and the money inside it.
  sheet.formats.set([[0, 7, 0, 12]], { bold: true, fill: '#e2e8f0', color: '#0f172a' }, at)
  sheet.formats.set([[1, 8, pivot.written[2], 12]], { numFmt: '$#,##0' }, at)
  sheet.formats.set([[pivot.written[2], 7, pivot.written[2], 12]], { bold: true, border: { top: { width: 1 } } }, at)
  sheet.widths.A = 90
  sheet.widths.H = 120
  sheet.freeze = { rows: 1, cols: 0 }
  sheet.pivots = [pivot]
</script>

<SvSheet document={doc} height="100%" rows={30} columns={14} />
