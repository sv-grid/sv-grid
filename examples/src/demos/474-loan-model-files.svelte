<script lang="ts">
  /**
   * 474. Loan model: PMT, accounting formats, and the File tab
   * ----------------------------------------------------------
   * A mortgage model on the spreadsheet shell, built from the sheet's own
   * financial functions rather than a plug-in engine:
   *
   *   PMT            the fixed payment from three inputs (B2:B4)
   *   IPMT / PPMT    the interest and principal parts of any period
   *   NPER / RATE    the term that fits a payment, and the rate that does
   *   CUMULATIVE     a SUMPRODUCT over the first-year interest
   *
   * The money cells carry the Accounting format (the $ button, or Format
   * Cells > Number > Accounting), so the symbols line up on the left and
   * the figures on the right, the way a statement reads. Extra Payment has
   * a validation rule with an Input Message that shows while the cell is
   * selected; Data > Data Validation > Circle Invalid Data rings the two
   * that were typed wrong.
   *
   * The File tab is the point: Save As downloads the whole model as an
   * .xlsx that Excel opens with the formulas, the formats and the rule in
   * place; Open takes one back, or any .xlsx of your own; Export CSV gives
   * the sheet as its cells show; Print (Ctrl+P) hands the sheet to the
   * browser's print dialog as the Page Layout tab says. Ctrl+O and Ctrl+S
   * are the same actions.
   *
   * Try: change the rate in B3 and watch the payment. Select F3 to see the
   * input message. Data > Sort on the schedule with two levels. Save As,
   * then New, then Open the file you just saved.
   */
  import { SvSheet, createWorkbook, createSheetDocument, FORMAT_PRESETS, accountingPattern } from '@svgrid/enterprise'

  const SCHEDULE = 12
  const rows: string[][] = [
    ['Loan', '', '', '', 'Period', 'Extra', 'Payment', 'Interest', 'Principal', 'Balance'],
    ['Principal', '320000', '', '', '', '', '', '', '', ''],
    ['Annual rate', '0.0525', '', '', '', '', '', '', '', ''],
    ['Years', '30', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', ''],
    ['Monthly payment', '=PMT(B3/12,B4*12,-B2)', '', '', '', '', '', '', '', ''],
    ['Periods at $2,000', '=NPER(B3/12,-2000,B2)', '', '', '', '', '', '', '', ''],
    ['Rate for $1,500', '=RATE(B4*12,-1500,B2)*12', '', '', '', '', '', '', '', ''],
    ['First-year interest', '=SUMPRODUCT(H2:H13)', '', '', '', '', '', '', '', ''],
    ['Total interest', '=B6*B4*12-B2', '', '', '', '', '', '', '', ''],
  ]
  // The schedule sits beside the inputs, one row per period from row 2.
  const extras = ['0', '0', '250', '0', '0', '0', '1000', '0', '0', '0', '0', '0']
  for (let p = 1; p <= SCHEDULE; p += 1) {
    const r = p + 1
    while (rows.length < r) rows.push(['', '', '', '', '', '', '', '', '', ''])
    const line = rows[r - 1]!
    while (line.length < 10) line.push('')
    line[4] = String(p)
    line[5] = extras[p - 1]!
    line[6] = '=$B$6+F' + r
    line[7] = '=IPMT($B$3/12,E' + r + ',$B$4*12,-$B$2)'
    line[8] = '=G' + r + '-H' + r
    line[9] = p === 1 ? '=$B$2-I2' : '=J' + (r - 1) + '-I' + r
  }

  const wb = createWorkbook([{ name: 'Mortgage', cells: rows }])
  const doc = createSheetDocument({ workbook: wb })
  const sheet = doc.get('Mortgage')
  const at = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }
  const money = accountingPattern('$', 2)
  sheet.formats.set([[0, 0, 0, 9]], { bold: true, fill: '#e2e8f0', color: '#0f172a' }, at)
  sheet.formats.set([[1, 1, 1, 1], [5, 1, 5, 1], [8, 1, 9, 1], [1, 5, 13, 9]], { numFmt: money }, at)
  sheet.formats.set([[2, 1, 2, 1], [7, 1, 7, 1]], { numFmt: FORMAT_PRESETS.percent }, at)
  sheet.formats.set([[6, 1, 6, 1]], { numFmt: '0.0' }, at)
  sheet.formats.set([[1, 1, 3, 1]], { color: '#1d4ed8' }, at)
  sheet.formats.set([[5, 0, 9, 0]], { bold: true }, at)
  sheet.widths.A = 150
  sheet.widths.B = 120
  sheet.freeze = { rows: 1, cols: 0 }
  sheet.validation = [{
    id: 'extra', rects: [[1, 5, 13, 5]], allow: 'decimal', operator: 'between', value1: '0', value2: '5000',
    ignoreBlank: true, inCellDropdown: false,
    alert: { style: 'stop', title: 'Extra payment', message: 'Between 0 and 5,000.' },
    input: { title: 'Extra payment', message: 'An amount paid on top of the fixed payment this period, 0 to 5,000.' },
  }]
  // Two entries that break the rule, for Circle Invalid Data to find.
  wb.setRaw('Mortgage', 4, 5, '-50')
  wb.setRaw('Mortgage', 9, 5, '9000')
</script>

<SvSheet document={doc} height="100%" columns={10} rows={20} />
