<script lang="ts">
  /**
   * 438. The spreadsheet shell
   * ---------------------------
   * Everything the other spreadsheet demos assemble by hand, as one component:
   *
   *   <SvSheet workbook={wb} />
   *
   * That is the entire demo. The ribbon, the Name Box and fx bar, the A..L
   * column headers over the 1..N gutter, the sheet tabs and the Sum / Average
   * / Count status bar all come from the library rather than from this file.
   *
   * Ribbon buttons and keyboard shortcuts are the SAME calls: pressing Ctrl+B
   * lights the Bold button, and pressing Bold is indistinguishable from
   * pressing Ctrl+B, because both run one function in sheet/shortcuts.ts.
   *
   * Painted with the grid's own theme tokens, so switching the theme picker
   * (top left) re-skins the ribbon with everything else. Pick "Excel" to see
   * it wearing Excel's own palette.
   */
  import { SvSheet, createWorkbook } from '@svgrid/enterprise'

  // Formats travel with the document, the way they do in a saved workbook,
  // rather than being something you have to re-apply after it opens.
  const BAND = { bold: true, fill: '#e2e8f0', color: '#0f172a' } as const
  const TOTAL = { bold: true, numFmt: '#,##0' } as const
  const PERCENT = { numFmt: '0.0%' } as const

  // A small P&L, the kind of thing you would actually open Excel for. Row 1
  // is a header band the way you would type it, not a grid header: in a
  // spreadsheet the first row is just the first row.
  const wb = createWorkbook([
    {
      name: 'Budget',
      cells: [
        ['Line',        'Jan',   'Feb',   'Mar',   'Q1'],
        ['Subscriptions', '18200', '18900', '19500', '=SUM(B2:D2)'],
        ['Services',      '4200',  '3800',  '5100',  '=SUM(B3:D3)'],
        ['Support',       '1200',  '1250',  '1310',  '=SUM(B4:D4)'],
        ['Revenue',     '=SUM(B2:B4)', '=SUM(C2:C4)', '=SUM(D2:D4)', '=SUM(E2:E4)'],
        [],
        ['Payroll',      '-9800', '-9800', '-10400', '=SUM(B7:D7)'],
        ['Cloud',         '-940', '-1010',  '-1180', '=SUM(B8:D8)'],
        ['Marketing',    '-3200', '-2750',  '-4100', '=SUM(B9:D9)'],
        ['Costs',      '=SUM(B7:B9)', '=SUM(C7:C9)', '=SUM(D7:D9)', '=SUM(E7:E9)'],
        [],
        ['Net',        '=B5+B10', '=C5+C10', '=D5+D10', '=E5+E10'],
        ['Margin',     '=B12/B5', '=C12/C5', '=D12/D5', '=E12/E5'],
      ],
    },
    {
      name: 'Headcount',
      cells: [
        ['Team',        'People', 'Cost each', 'Total'],
        ['Engineering', '6',      '11000',     '=B2*C2'],
        ['Design',      '2',      '9500',      '=B3*C3'],
        ['Sales',       '3',      '8200',      '=B4*C4'],
        ['',            '=SUM(B2:B4)', '',     '=SUM(D2:D4)'],
      ],
    },
  ])
</script>

<SvSheet
  workbook={wb}
  height={430}
  rows={24}
  columns={9}
  columnWidths={{ A: 150 }}
  formats={{
    A1: BAND, B1: BAND, C1: BAND, D1: BAND, E1: BAND,
    A5: TOTAL, B5: TOTAL, C5: TOTAL, D5: TOTAL, E5: TOTAL,
    A10: TOTAL, B10: TOTAL, C10: TOTAL, D10: TOTAL, E10: TOTAL,
    A12: TOTAL, B12: TOTAL, C12: TOTAL, D12: TOTAL, E12: TOTAL,
    B13: PERCENT, C13: PERCENT, D13: PERCENT, E13: PERCENT,
  }}
/>
