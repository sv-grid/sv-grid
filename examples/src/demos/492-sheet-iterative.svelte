<script lang="ts">
  /**
   * 492. Iterative calculation
   * --------------------------
   * A circular reference is usually a mistake, and the shell says so: every
   * cell in the loop shows #CYCLE! while the rest of the sheet keeps
   * working. Some models are circular on purpose, though, because the answer
   * is a fixed point rather than an error.
   *
   * The classic one is here. A bonus is a tenth of the profit AFTER the
   * bonus, so the bonus depends on the profit and the profit depends on the
   * bonus. There is one pair of numbers that satisfies both, and Excel finds
   * it by running the loop over and over from the values it last had:
   *
   *   Formulas > Calculation Options   Enable iterative calculation, with a
   *                                    cap on the passes and on the smallest
   *                                    change worth another pass.
   *
   * The reserve model under it is the same shape: interest is charged on a
   * balance the interest is part of.
   *
   * Try: read B4 and B5 as they stand, both #CYCLE!. Open Formulas >
   * Calculation Options, tick the box and press OK. Change the profit in B2
   * and watch the bonus follow. Turn it off again and the cycle is an error
   * once more. Save As and open the file in Excel: the setting rides along
   * in calcPr, so the model works there too.
   */
  import { SvSheet, createWorkbook, createSheetDocument } from '@svgrid/enterprise'

  const rows: string[][] = [
    ['A bonus taken out of the profit it is a share of', '', ''],
    ['Profit before bonus', '900000', ''],
    ['Bonus rate', '0.1', ''],
    ['Bonus', '=B3*B5', 'a tenth of the profit after the bonus'],
    ['Profit after bonus', '=B2-B4', 'which is what the bonus comes out of'],
    ['', '', ''],
    ['Interest charged on the balance it is part of', '', ''],
    ['Opening balance', '250000', ''],
    ['Rate', '0.07', ''],
    ['Interest', '=B11*B9', 'charged on the closing balance'],
    ['Closing balance', '=B8+B10', 'which the interest is part of'],
  ]

  // Iteration is off to begin with, exactly as Excel opens: the cycle is an
  // error until someone says it is meant. Formulas > Calculation Options is
  // the switch, and `setIteration` is the same thing from code.
  const wb = createWorkbook([{ name: 'Model', cells: rows }])
  const doc = createSheetDocument({ workbook: wb })
  const sheet = doc.get('Model')
  const at = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }
  for (const r of [0, 6]) sheet.formats.set([[r, 0, r, 2]], { bold: true, fill: '#e2e8f0', color: '#0f172a' }, at)
  sheet.formats.set([[1, 1, 1, 1]], { numFmt: '$#,##0' }, at)
  sheet.formats.set([[3, 1, 4, 1]], { numFmt: '$#,##0', bold: true }, at)
  sheet.formats.set([[7, 1, 7, 1]], { numFmt: '$#,##0' }, at)
  sheet.formats.set([[9, 1, 10, 1]], { numFmt: '$#,##0', bold: true }, at)
  sheet.formats.set([[2, 1, 2, 1]], { numFmt: '0.0%' }, at)
  sheet.formats.set([[8, 1, 8, 1]], { numFmt: '0.0%' }, at)
  sheet.formats.set([[0, 2, 10, 2]], { color: '#64748b' }, at)
  sheet.widths.A = 250
  sheet.widths.B = 160
  sheet.widths.C = 290
</script>

<SvSheet document={doc} height="100%" rows={16} columns={6} />
