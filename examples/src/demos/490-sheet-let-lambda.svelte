<script lang="ts">
  /**
   * 490. LET and LAMBDA
   * -------------------
   * The two modern Excel functions that turn a formula into something you
   * can read, and the helpers that make a lambda worth writing.
   *
   *   LET(name, value, ..., calculation)
   *       names a value inside the formula, so it is written once and read
   *       by name. A later binding can read an earlier one.
   *   LAMBDA(parameter, ..., calculation)
   *       a function written in the sheet. Bind it with LET and call it by
   *       name, or call it where it stands: LAMBDA(x, x * 2)(21).
   *   MAP / BYROW / BYCOL / REDUCE / SCAN / MAKEARRAY
   *       what a lambda is for: every cell, every row, every column, a fold
   *       and its running total, and an array built from its own indexes.
   *
   * They spill like any other array formula, and they go into the .xlsx
   * under the `_xlfn.` prefix Excel stores them with, so a file written
   * here opens there with the formulas intact rather than #NAME?.
   *
   * Try: click F2, G2 and H2 to read the three spilled columns, then B9
   * for the LET behind the margin. Change a price in B2:B6 and watch every
   * one of them follow.
   */
  import { SvSheet, createWorkbook, createSheetDocument } from '@svgrid/enterprise'

  const rows: string[][] = [
    ['Product', 'Price', 'Cost', 'Sold', '', 'Margin %', 'Revenue', 'Running'],
    ['Licence', '1200', '300', '42', '', '=LET(margin, LAMBDA(p, c, (p - c) / p), MAP(B2:B6, C2:C6, margin))', '=BYROW(B2:B6 * D2:D6, LAMBDA(r, SUM(r)))', '=SCAN(0, B2:B6 * D2:D6, LAMBDA(acc, v, acc + v))'],
    ['Support', '480', '120', '85', '', '', '', ''],
    ['Training', '950', '410', '17', '', '', '', ''],
    ['Hosting', '260', '95', '130', '', '', '', ''],
    ['Add-ons', '140', '60', '64', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['Written once, read by name', '', '', '', '', '', '', ''],
    ['Gross margin %', '=LET(revenue, SUMPRODUCT(B2:B6, D2:D6), cost, SUMPRODUCT(C2:C6, D2:D6), (revenue - cost) / revenue)', '', '', '', '', '', ''],
    ['Total revenue, folded', '=REDUCE(0, B2:B6 * D2:D6, LAMBDA(acc, v, acc + v))', '', '', '', '', '', ''],
    ['Called where it stands', '=LAMBDA(x, x * 2)(21)', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['Built from its own indexes', '', '', '', '', '', '', ''],
    ['3 x 4 times table', '=MAKEARRAY(3, 4, LAMBDA(r, c, r * c))', '', '', '', '', '', ''],
  ]

  const wb = createWorkbook([{ name: 'Model', cells: rows }])
  const doc = createSheetDocument({ workbook: wb })
  const sheet = doc.get('Model')
  const at = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }
  sheet.formats.set([[0, 0, 0, 7]], { bold: true, fill: '#e2e8f0', color: '#0f172a' }, at)
  for (const r of [7, 12]) {
    sheet.formats.set([[r, 0, r, 7]], { bold: true, color: '#0f172a', fill: '#f1f5f9' }, at)
  }
  sheet.formats.set([[1, 1, 5, 2]], { numFmt: '$#,##0' }, at)
  // The three spilled columns beside the block, and the two totals under it.
  sheet.formats.set([[1, 5, 5, 5]], { numFmt: '0.0%' }, at)
  sheet.formats.set([[1, 6, 5, 7]], { numFmt: '#,##0' }, at)
  sheet.formats.set([[8, 1, 8, 1]], { numFmt: '0.0%' }, at)
  sheet.formats.set([[9, 1, 9, 1]], { numFmt: '#,##0' }, at)
  sheet.widths.A = 210
  sheet.widths.B = 120
  sheet.freeze = { rows: 1, cols: 1 }
</script>

<SvSheet document={doc} height="100%" rows={24} columns={9} />
