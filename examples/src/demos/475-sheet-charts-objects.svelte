<script lang="ts">
  /**
   * 475. Charts and pictures on the sheet
   * -------------------------------------
   * A quarterly sales sheet with two charts anchored over it, the way
   * Excel anchors one: each reads a RANGE rather than a copy of the
   * numbers, so typing into a cell redraws it on the spot.
   *
   *   Insert > Chart    charts the selected block. The first row and
   *                     column are read as the labels, each column is a
   *                     series, and the chart lands under the block.
   *   Insert > Picture  puts an image on the sheet from a file.
   *   Insert > Setup    (or a double-click on a chart) opens the Chart
   *                     dialog: type, title, series in columns or rows,
   *                     whether the first row and column are labels, and
   *                     stacking.
   *
   * An object floats over the cells: drag it to move, its corner to
   * resize, Delete to remove. It hangs from a cell and an offset inside
   * it, so inserting a row above moves it and deleting that row takes it
   * with it. Everything here is part of the document: `getState()`
   * carries the charts with the cells, and `onChange` reports `objects`.
   * They go into the .xlsx too, as Excel's own drawing part, a chart
   * carrying the references its series read rather than a copy of the
   * numbers.
   *
   * Try: change a number in B2:E4 and watch both charts. Select A1:E4 and
   * press Insert > Chart for a third. Double-click the line chart and
   * make it an area chart. Insert a row above row 1 and watch the charts
   * move with their cells. Save As and open the file in Excel: the charts
   * are charts there too.
   */
  import { SvSheet, createWorkbook, createSheetDocument, objectId, type SheetObject } from '@svgrid/enterprise'

  const rows: string[][] = [
    ['Region', 'Q1', 'Q2', 'Q3', 'Q4', 'Year'],
    ['North', '48000', '52500', '61000', '68500', '=SUM(B2:E2)'],
    ['South', '39000', '41500', '44000', '52000', '=SUM(B3:E3)'],
    ['EMEA', '71000', '69500', '78000', '91000', '=SUM(B4:E4)'],
    ['Total', '=SUM(B2:B4)', '=SUM(C2:C4)', '=SUM(D2:D4)', '=SUM(E2:E4)', '=SUM(F2:F4)'],
  ]

  const wb = createWorkbook([{ name: 'Sales', cells: rows }])
  const doc = createSheetDocument({ workbook: wb })
  const sheet = doc.get('Sales')
  const at = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }
  sheet.formats.set([[0, 0, 0, 5]], { bold: true, fill: '#e2e8f0', color: '#0f172a' }, at)
  sheet.formats.set([[4, 0, 4, 5]], { bold: true, border: { top: { width: 1 } } }, at)
  sheet.formats.set([[1, 1, 4, 5]], { numFmt: '$#,##0' }, at)
  sheet.widths.A = 110
  sheet.freeze = { rows: 1, cols: 1 }

  // Two charts over the same numbers, read two ways: the quarters by
  // region, and the regions by quarter. Both are part of the document.
  const charts: SheetObject[] = [
    {
      id: objectId(),
      kind: 'chart',
      anchor: { row: 6, col: 0, dx: 8, dy: 8, width: 430, height: 250 },
      range: [0, 0, 3, 4],
      type: 'bar',
      headers: true,
      series: 'columns',
      title: 'Quarters by region',
    },
    {
      id: objectId(),
      kind: 'chart',
      anchor: { row: 6, col: 4, dx: 24, dy: 8, width: 430, height: 250 },
      range: [0, 0, 3, 4],
      type: 'line',
      headers: true,
      series: 'rows',
      title: 'Regions by quarter',
    },
  ]
  sheet.objects = charts
</script>

<SvSheet document={doc} height="100%" rows={22} columns={8} />
