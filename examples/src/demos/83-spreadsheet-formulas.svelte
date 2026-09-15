<script lang="ts">
  /**
   * 83. Spreadsheet formulas
   * -------------------------
   * The formula engine, with the ribbon turned off so nothing competes with
   * it. Same component as demo 27:
   *
   *   <SvSheet workbook={wb} showRibbon={false} />
   *
   * What to look at:
   *
   *   The fx bar shows the RAW text. Click E2 and the grid reads 56,600
   *   while the bar reads =SUM(B2:D2). That split is the whole reason a
   *   spreadsheet has a formula bar, and it is why editing in the bar edits
   *   the formula rather than its result.
   *
   *   Type = in the bar and function names complete, shortest match first,
   *   with a signature hint while you fill the arguments in.
   *
   *   Recalculation is by dependency, not by sweeping the sheet: change B2
   *   and only the cells that actually read it are recomputed.
   *
   *   Absolute references hold. E8 is =E5/$E$5 filled down - the numerator
   *   moves with the row, the divisor does not. Select E8, press Ctrl+D over
   *   the rows below it and watch which half moves.
   *
   * The engine, the parser, the ~50 functions and the dependency graph all
   * live in @svgrid/enterprise/sheet. This demo used to inline about 350
   * lines of them, and so did two other demos.
   */
  import { SvSheet, createWorkbook } from '@svgrid/enterprise'

  const wb = createWorkbook([
    {
      name: 'Formulas',
      cells: [
        ['Region', 'Q1', 'Q2', 'Q3', 'Year'],
        ['North', '18200', '18900', '19500', '=SUM(B2:D2)'],
        ['South', '12400', '13100', '11800', '=SUM(B3:D3)'],
        ['East', '9100', '9800', '10450', '=SUM(B4:D4)'],
        ['West', '15300', '14200', '16900', '=SUM(B5:D5)'],
        ['Total', '=SUM(B2:B5)', '=SUM(C2:C5)', '=SUM(D2:D5)', '=SUM(E2:E5)'],
        [],
        ['Best region', '=INDEX(A2:A5,MATCH(MAX(E2:E5),E2:E5,0))'],
        ['Share of best', '=MAX(E2:E5)/$E$6'],
        ['Average region', '=AVERAGE(E2:E5)'],
        ['Regions over 40k', '=COUNTIF(E2:E5,">40000")'],
        ['North vs South', '=IF(E2>E3,"North","South")'],
        ['Lookup East', '=VLOOKUP("East",A2:E5,5,FALSE)'],
        ['Rounded total', '=ROUND(E6/1000,1)'],
        ['Label', '=TEXTJOIN(" / ",TRUE,A2,A3,A4,A5)'],
      ],
    },
  ])

  const MONEY = { numFmt: '#,##0' } as const
  const money = (row: number) =>
    Object.fromEntries(['B', 'C', 'D', 'E'].map((c) => [`${c}${row}`, MONEY]))
</script>

<SvSheet
  workbook={wb}
  showRibbon={false}
  showTabs={false}
  height="100%"
  rows={20}
  columns={7}
  columnWidths={{ A: 160, B: 150 }}
  formats={{
    A1: { bold: true }, B1: { bold: true }, C1: { bold: true },
    D1: { bold: true }, E1: { bold: true },
    ...money(2), ...money(3), ...money(4), ...money(5),
    A6: { bold: true }, B6: { bold: true, numFmt: '#,##0' },
    C6: { bold: true, numFmt: '#,##0' }, D6: { bold: true, numFmt: '#,##0' },
    E6: { bold: true, numFmt: '#,##0' },
    B9: { numFmt: '0.0%' },
    B10: { numFmt: '#,##0' },
  }}
/>
