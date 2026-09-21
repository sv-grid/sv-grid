<script lang="ts">
  /**
   * 493. Evaluate Formula and Error Checking
   * ----------------------------------------
   * The two auditing tools that answer "why does this cell say that?".
   *
   *   Formulas > Evaluate Formula   the active cell's formula with one part
   *                                 underlined. Each click replaces that
   *                                 part with what it is worth, until the
   *                                 whole thing is the cell's answer.
   *   Formulas > Error Checking     every cell on the sheet that reports an
   *                                 error, and every formula that breaks
   *                                 the pattern of the ones above and below
   *                                 it, walked one at a time with what each
   *                                 error means.
   *
   * The sheet below is a commission model with three planted faults, which
   * is what a real one looks like a week after two people have edited it:
   * a rate cell that is text, a lookup that finds nothing, and one row in
   * the commission column whose formula is not the column's formula.
   *
   * Try: click B13 and open Evaluate Formula, then click Evaluate three
   * times to watch the sales figure resolve, the rate come back as text,
   * and the multiplication fail. Open Error Checking and press Next through
   * all five problems, the broken row among them. Show Calculation Steps
   * takes you from one straight into the other.
   */
  import { SvSheet, createWorkbook, createSheetDocument } from '@svgrid/enterprise'

  const rows: string[][] = [
    ['Rep', 'Region', 'Sales', 'Rate', 'Commission', '', 'Rate card', ''],
    ['Ada', 'North', '184000', '=VLOOKUP(B2, $G$2:$H$5, 2, FALSE)', '=C2*D2', '', 'North', '0.04'],
    ['Brin', 'South', '97400', '=VLOOKUP(B3, $G$2:$H$5, 2, FALSE)', '=C3*D3', '', 'South', '0.035'],
    ['Cyd', 'EMEA', '212500', '=VLOOKUP(B4, $G$2:$H$5, 2, FALSE)', '=C4*D4', '', 'EMEA', '0.045'],
    // The odd one out: this row multiplies by the rate above it, not its own.
    ['Dov', 'North', '150800', '=VLOOKUP(B5, $G$2:$H$5, 2, FALSE)', '=C5*D4', '', 'APAC', 'see below'],
    ['Eze', 'South', '88300', '=VLOOKUP(B6, $G$2:$H$5, 2, FALSE)', '=C6*D6', '', '', ''],
    // A region that is not on the rate card: the lookup finds nothing.
    ['Fen', 'LATAM', '64900', '=VLOOKUP(B7, $G$2:$H$5, 2, FALSE)', '=C7*D7', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['Total sales', '=SUM(C2:C7)', '', '', '', '', '', ''],
    ['Total commission', '=SUM(E2:E7)', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['A rate that is text, not a number', '', '', '', '', '', '', ''],
    ['APAC commission', '=C2*H5', '', '', '', '', '', ''],
  ]

  const wb = createWorkbook([{ name: 'Commission', cells: rows }])
  const doc = createSheetDocument({ workbook: wb })
  const sheet = doc.get('Commission')
  const at = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }
  sheet.formats.set([[0, 0, 0, 7]], { bold: true, fill: '#e2e8f0', color: '#0f172a' }, at)
  sheet.formats.set([[11, 0, 11, 4]], { bold: true, fill: '#f1f5f9', color: '#0f172a' }, at)
  sheet.formats.set([[1, 2, 6, 2]], { numFmt: '$#,##0' }, at)
  sheet.formats.set([[1, 4, 6, 4]], { numFmt: '$#,##0' }, at)
  sheet.formats.set([[1, 3, 6, 3]], { numFmt: '0.0%' }, at)
  sheet.formats.set([[8, 1, 9, 1]], { numFmt: '$#,##0', bold: true }, at)
  sheet.formats.set([[1, 7, 4, 7]], { numFmt: '0.0%' }, at)
  sheet.widths.A = 180
  sheet.widths.B = 90
  sheet.widths.G = 100
  sheet.widths.H = 90
  sheet.freeze = { rows: 1, cols: 1 }
</script>

<SvSheet document={doc} height="100%" rows={18} columns={10} />
