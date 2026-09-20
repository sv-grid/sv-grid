<script lang="ts">
  /**
   * 491. Format as Table, and structured references
   * -----------------------------------------------
   * Excel's Ctrl+T. A table names its columns, so a formula says
   * `Orders[Amount]` instead of `E2:E13` and keeps meaning it as rows are
   * added.
   *
   *   Insert > Table (Ctrl+T)   the block becomes a table: a header row,
   *                             the banded look, the filter arrows, and a
   *                             name its columns are read by.
   *   Orders[Amount]            a whole column, whatever the table is now.
   *   [@Qty]                    this row's cell, which is how the Amount
   *                             column works out its own line.
   *   Orders[#Totals]           the totals row under it.
   *   Insert > Table Styles     the look: six colours in three tones, by
   *                             the names Excel stores them under.
   *   Insert > To Range         the cells stay, the table goes.
   *
   * Auto-expand is the point: type a product under the last row and the
   * table grows, so every total that reads it grows too, with no formula
   * re-pointed. The summary on the right is four structured references and
   * never mentions an address.
   *
   * Try: type a new order in row 14 and watch the summary follow. Put the
   * cursor in the table and press Ctrl+T to rename it or pick another style
   * from the gallery. Save As and open the file in Excel: the table is a
   * table there too, wearing the style it wears here.
   */
  import { SvSheet, createWorkbook, createSheetDocument } from '@svgrid/enterprise'

  const orders = [
    ['North', 'Licence', '2', '1200'],
    ['South', 'Support', '5', '480'],
    ['EMEA', 'Licence', '1', '1200'],
    ['North', 'Training', '3', '950'],
    ['South', 'Licence', '4', '1200'],
    ['EMEA', 'Support', '9', '480'],
    ['North', 'Hosting', '12', '260'],
    ['South', 'Training', '2', '950'],
    ['EMEA', 'Hosting', '6', '260'],
    ['North', 'Licence', '3', '1200'],
    ['South', 'Hosting', '8', '260'],
    ['EMEA', 'Training', '1', '950'],
  ]

  const rows: string[][] = [
    ['Region', 'Product', 'Qty', 'Price', 'Amount', '', 'Reads the table, not the cells', ''],
    ...orders.map((o, i) => [
      ...o,
      '=[@Qty]*[@Price]',
      '',
      ...(i === 0 ? ['Orders', '=COUNTA(Orders[Region])'] : []),
      ...(i === 1 ? ['Total amount', '=SUM(Orders[Amount])'] : []),
      ...(i === 2 ? ['Biggest order', '=MAX(Orders[Amount])'] : []),
      ...(i === 3 ? ['Licence revenue', '=SUMIF(Orders[Product], "Licence", Orders[Amount])'] : []),
    ]),
  ]
  // A workbook takes a dense block.
  const width = rows.reduce((w, row) => Math.max(w, row.length), 0)
  for (const row of rows) for (let c = 0; c < width; c += 1) row[c] ??= ''

  const wb = createWorkbook([{ name: 'Sales', cells: rows }])
  // The table this sheet opens with. Insert > Table makes one the same way.
  wb.tables.define({
    name: 'Orders',
    sheet: 'Sales',
    headerRow: 0,
    firstCol: 0,
    lastCol: 4,
    lastRow: orders.length,
    hasTotals: false,
    // The gallery's names are Excel's own, so this is the style Excel
    // opens the saved file with too.
    style: 'TableStyleMedium6',
  })
  wb.recalculate()

  const doc = createSheetDocument({ workbook: wb })
  const sheet = doc.get('Sales')
  const at = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }
  sheet.formats.set([[0, 6, 0, 6]], { bold: true, color: '#0f172a' }, at)
  sheet.formats.set([[1, 6, 4, 6]], { color: '#475569' }, at)
  // Past the last row too, so a row typed into the table looks right the
  // moment it is typed.
  sheet.formats.set([[1, 3, orders.length + 5, 4]], { numFmt: '$#,##0' }, at)
  sheet.formats.set([[2, 7, 4, 7]], { numFmt: '$#,##0', bold: true }, at)
  sheet.widths.A = 90
  sheet.widths.B = 100
  sheet.widths.G = 190
  sheet.widths.H = 110
  sheet.autoFilter = { range: [0, 0, orders.length, 4], filters: {} }
  sheet.freeze = { rows: 1, cols: 0 }
</script>

<SvSheet document={doc} height="100%" rows={20} columns={10} />
