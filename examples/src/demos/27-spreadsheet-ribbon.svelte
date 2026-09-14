<script lang="ts">
  /**
   * 27. Spreadsheet shell
   * ----------------------
   * The whole Excel surface as one component:
   *
   *   <SvSheet workbook={wb} />
   *
   * That is the demo. The ribbon, the Name Box and fx bar, the A..I column
   * headers over the 1..N gutter, the sheet tabs and the Sum / Average /
   * Count status bar all come from @svgrid/enterprise rather than from this
   * file. This demo used to carry about 1,400 lines of its own ribbon.
   *
   * Ribbon buttons and keyboard shortcuts are the SAME calls. Click a bold
   * cell and the Bold button lights up; press Ctrl+B and it goes out. Both
   * run one function in sheet/shortcuts.ts, so they cannot drift.
   *
   * Try: select B2:D4 and watch the status bar. Press Ctrl+Shift+4 or hit $
   * in the Number group. Ctrl+Down runs to the bottom of a block. The
   * Formulas tab has Show Formulas (Excel's Ctrl+`).
   *
   * The chrome is painted with the grid's own theme tokens, so the theme
   * picker at the top left re-skins it along with everything else. Pick
   * "Excel" to see it wearing Excel's palette.
   */
  import { SvSheet, createWorkbook } from '@svgrid/enterprise'

  // Formats travel with the document, the way they do in a saved workbook,
  // rather than being something you re-apply every time it opens.
  const BAND = { bold: true, fill: '#e2e8f0', color: '#0f172a' } as const
  const TOTAL = { bold: true, numFmt: '#,##0' } as const
  const MONEY = { numFmt: '#,##0' } as const
  const PERCENT = { numFmt: '0.0%' } as const

  // A small P&L: the kind of thing you would actually open Excel for. Row 1
  // is a header band the way you would type it, not a grid header - in a
  // spreadsheet the first row is just the first row.
  const wb = createWorkbook([
    {
      name: 'Budget',
      cells: [
        ['Line', 'Jan', 'Feb', 'Mar', 'Q1'],
        ['Subscriptions', '18200', '18900', '19500', '=SUM(B2:D2)'],
        ['Services', '4200', '3800', '5100', '=SUM(B3:D3)'],
        ['Support', '1200', '1250', '1310', '=SUM(B4:D4)'],
        ['Revenue', '=SUM(B2:B4)', '=SUM(C2:C4)', '=SUM(D2:D4)', '=SUM(E2:E4)'],
        [],
        ['Payroll', '-9800', '-9800', '-10400', '=SUM(B7:D7)'],
        ['Cloud', '-940', '-1010', '-1180', '=SUM(B8:D8)'],
        ['Marketing', '-3200', '-2750', '-4100', '=SUM(B9:D9)'],
        ['Costs', '=SUM(B7:B9)', '=SUM(C7:C9)', '=SUM(D7:D9)', '=SUM(E7:E9)'],
        [],
        ['Net', '=B5+B10', '=C5+C10', '=D5+D10', '=E5+E10'],
        ['Margin', '=B12/B5', '=C12/C5', '=D12/D5', '=E12/E5'],
      ],
    },
    {
      name: 'Headcount',
      cells: [
        ['Team', 'People', 'Cost each', 'Total'],
        ['Engineering', '6', '11000', '=B2*C2'],
        ['Design', '2', '9500', '=B3*C3'],
        ['Sales', '3', '8200', '=B4*C4'],
        ['', '=SUM(B2:B4)', '', '=SUM(D2:D4)'],
      ],
    },
  ])

  const band = (row: number) =>
    Object.fromEntries(['A', 'B', 'C', 'D', 'E'].map((c) => [`${c}${row}`, BAND]))
  const total = (row: number) =>
    Object.fromEntries(['A', 'B', 'C', 'D', 'E'].map((c) => [`${c}${row}`, TOTAL]))
  const money = (row: number) =>
    Object.fromEntries(['B', 'C', 'D', 'E'].map((c) => [`${c}${row}`, MONEY]))
  const percent = (row: number) =>
    Object.fromEntries(['B', 'C', 'D', 'E'].map((c) => [`${c}${row}`, PERCENT]))
</script>

<SvSheet
  workbook={wb}
  height={430}
  rows={24}
  columns={9}
  columnWidths={{ A: 150 }}
  formats={{
    ...band(1),
    ...money(2), ...money(3), ...money(4),
    ...total(5),
    ...money(7), ...money(8), ...money(9),
    ...total(10),
    ...total(12),
    ...percent(13),
  }}
/>
