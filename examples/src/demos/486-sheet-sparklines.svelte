<script lang="ts">
  /**
   * 486. Sparklines: a chart inside the cell
   * ----------------------------------------
   * Excel's smallest chart. A sparkline is not an object floating over the
   * sheet: it IS the cell, one per row of a block of numbers, drawn from
   * the range rather than from a copy of it. Edit a number and the cell
   * redraws.
   *
   *   Insert > Sparklines > Line       one line per row, in the cells beside it
   *   Insert > Sparklines > Column     the same as small columns
   *   Insert > Sparklines > Win/Loss   above the axis or below it, nothing else
   *   Insert > Sparklines > Edit       the group here: ranges, kind, colours
   *   Insert > Sparklines > Clear      the groups the selection touches
   *
   * The sheet keeps them per group, the way Excel does: a data range, a
   * location range of the same shape and the settings they share. Select a
   * cell that holds one and the three kind buttons change that group
   * instead of making another. They ride in `getState()`, move with an
   * insert or a delete, and go into the .xlsx where Excel keeps them, in
   * the worksheet's extension list.
   *
   * Try: type over a number in B2:M4 and watch its row redraw. Select N2
   * and press Column, then Edit to put the whole group on one scale.
   * Select B5:M5 and press Line for a fourth sparkline of the totals.
   * Save As and open the file in Excel: the sparklines are there too.
   */
  import { SvSheet, createWorkbook, createSheetDocument, sparklineId, type SparklineGroup } from '@svgrid/enterprise'

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const traffic: Record<string, number[]> = {
    Search: [4200, 4450, 4310, 4800, 5200, 5600, 5400, 5900, 6400, 6800, 7100, 7600],
    Social: [1800, 2100, 1950, 2400, 2200, 2600, 3100, 2900, 3400, 3900, 3600, 4200],
    Direct: [2400, 2350, 2500, 2450, 2600, 2550, 2700, 2650, 2800, 2900, 2850, 3000],
  }
  const change = [0, 1, -1, 1, 1, -1, 1, 1, 1, -1, 1, 1]

  const rows: string[][] = [
    ['Channel', ...months, 'Trend'],
    ...Object.entries(traffic).map(([name, values]) => [name, ...values.map(String), '']),
    ['Total', ...months.map((_, i) => `=SUM(${String.fromCharCode(66 + i)}2:${String.fromCharCode(66 + i)}4)`), ''],
    ['Week on week', ...change.map(String), ''],
  ]

  const wb = createWorkbook([{ name: 'Traffic', cells: rows }])
  const doc = createSheetDocument({ workbook: wb })
  const sheet = doc.get('Traffic')
  const at = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }
  sheet.formats.set([[0, 0, 0, 13]], { bold: true, fill: '#e2e8f0', color: '#0f172a' }, at)
  sheet.formats.set([[4, 0, 4, 13]], { bold: true, border: { top: { width: 1 } } }, at)
  sheet.formats.set([[1, 1, 4, 12]], { numFmt: '#,##0' }, at)
  sheet.widths.A = 110
  // Narrow months, so the year and the trend beside it fit one screen.
  for (let i = 0; i < months.length; i += 1) sheet.widths[String.fromCharCode(66 + i)] = 54
  sheet.widths.N = 120
  sheet.heights.set(1, 30)
  sheet.heights.set(2, 30)
  sheet.heights.set(3, 30)
  sheet.heights.set(4, 30)
  sheet.heights.set(5, 26)
  sheet.freeze = { rows: 1, cols: 1 }

  // Two groups, shipped with the document: a line per channel in column N,
  // and the week-on-week row read into the one cell under them, N6, as the
  // win/loss bars Excel draws for a run of ups and downs.
  const sparklines: SparklineGroup[] = [
    {
      id: sparklineId(),
      location: [1, 13, 4, 13],
      data: [1, 1, 4, 12],
      type: 'line',
      markers: true,
      color: '#2563eb',
    },
    {
      id: sparklineId(),
      location: [5, 13, 5, 13],
      data: [5, 1, 5, 12],
      type: 'winloss',
      color: '#16a34a',
      negativeColor: '#dc2626',
    },
  ]
  sheet.sparklines = sparklines
</script>

<SvSheet document={doc} height="100%" rows={20} columns={16} />
