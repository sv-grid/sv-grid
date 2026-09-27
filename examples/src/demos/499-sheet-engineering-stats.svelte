<script lang="ts">
  /**
   * 499. Engineering, statistics, and the locale you type in
   * --------------------------------------------------------
   * Three things the spreadsheet gained at once, on one sheet.
   *
   * FUNCTIONS. Four families the engine had none of: trigonometry,
   * engineering, database and the statistical distributions. The blocks
   * below work a real example of each - a bearing from two offsets, a
   * register mask in three bases, an orchard queried through Excel's
   * criteria-block grammar, and a normal distribution with its inverse
   * and a confidence interval.
   *
   * THE LOCALE. The picker at the top switches how numbers and formulas
   * are SPELLED. Choose German and the formula bar reads `=ROUND(A1/3; 2)`
   * and a cell shows `1,5`; type `3,25` into a cell and it is the number.
   * What the document stores never changes: it is always `=ROUND(A1/3, 2)`
   * and `1.5`, which is why a file written here opens anywhere.
   *
   * CONTROLS. Column H is drawn as checkboxes, and the count beside it is
   * an ordinary `COUNTIF(H4:H9, TRUE)`. A control is a rendering, never a
   * second source of truth: the tick is in the cell, so the formula sees
   * it, undo undoes it, and the file carries a plain boolean.
   *
   * Try: switch the locale and click into B12 to watch the separator
   * change while the value does not. Tick a box in H and watch H11 count
   * it. Select A4:A9 and use Data > Group to fold the orchard away.
   */
  import { SvSheet, createWorkbook, createSheetDocument } from '@svgrid/enterprise'
  import { newCellTypeId } from '@svgrid/enterprise/sheet'

  const LOCALES = [
    { id: 'en-US', label: 'English (1,234.5 and a comma)' },
    { id: 'de-DE', label: 'Deutsch (1.234,5 and a semicolon)' },
    { id: 'fr-FR', label: 'Français (1 234,5 and a semicolon)' },
  ]
  let locale = $state('en-US')

  const cells: string[][] = [
    ['Tree', 'Height', 'Yield', 'Profit', '', 'Measure', 'Value', 'Picked'],
    ['', '', '', '', '', '', '', ''],
    ['The orchard, queried the way Excel queries one', '', '', '', '', 'Trigonometry', '', ''],
    ['Apple', '18', '14', '105', '', 'Bearing, degrees', '=DEGREES(ATAN2(3, 4))', 'FALSE'],
    ['Pear', '12', '10', '96', '', 'Hypotenuse', '=SQRT(3^2 + 4^2)', 'FALSE'],
    ['Cherry', '13', '9', '105', '', 'Sine of 30 deg', '=SIN(RADIANS(30))', 'FALSE'],
    ['Apple', '14', '10', '75', '', 'Engineering', '', 'FALSE'],
    ['Pear', '9', '8', '76.8', '', 'Mask as binary', '=DEC2BIN(202, 10)', 'FALSE'],
    ['Apple', '8', '6', '45', '', 'Mask as hex', '=DEC2HEX(202)', 'FALSE'],
    ['', '', '', '', '', 'Bits kept', '=BITAND(202, 60)', ''],
    ['Tree', 'Height', '', '', '', 'Picked so far', '=COUNTIF(H4:H9, TRUE)', ''],
    ['Apple', '>10', '', '', '', 'Metres in a mile', '=CONVERT(1, "mi", "m")', ''],
    ['', '', '', '', '', 'Distributions', '', ''],
    ['Apples over ten', '=DSUM(A1:D9, "Profit", A11:B12)', 'DSUM', '', '', 'P(x < 42)', '=NORM.DIST(42, 40, 1.5, TRUE)', ''],
    ['How many', '=DCOUNT(A1:D9, "Profit", A11:B12)', 'DCOUNT', '', '', 'The x behind it', '=NORM.INV(G14, 40, 1.5)', ''],
    ['Their average', '=DAVERAGE(A1:D9, "Profit", A11:B12)', 'DAVERAGE', '', '', '95% interval', '=CONFIDENCE.NORM(0.05, 2.5, 50)', ''],
    ['The one cherry', '=DGET(A1:D9, "Profit", A18:A19)', 'DGET', '', '', 'Chi-squared tail', '=CHISQ.DIST.RT(18.307, 10)', ''],
    ['Tree', '', '', '', '', 'Student t, two tails', '=T.DIST.2T(1.96, 60)', ''],
    ['Cherry', '', '', '', '', 'Correlation', '=CORREL(B4:B9, C4:C9)', ''],
  ]

  const wb = createWorkbook([{ name: 'Sheet1', cells }])
  const doc = createSheetDocument({ workbook: wb })
  const sheet = doc.get('Sheet1')
  const at = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }

  // A fill and a font colour the DOCUMENT sets are used as they stand on
  // a dark theme, the way Excel uses them, so they go on in PAIRS. One
  // without the other is what a dark theme catches out: a dark colour
  // alone leaves the text on the sheet's own dark background, and a light
  // fill alone leaves the theme's light text on a light band.
  const HEADING = { bold: true, fill: '#e2e8f0', color: '#0f172a' } as const
  const CRITERIA = { bold: true, fill: '#f1f5f9', color: '#0f172a' } as const
  // Two tables sit side by side with an empty column E between them, so a
  // heading is styled over ITS OWN block rather than across the row: row 7
  // carries a section label on the right and orchard data on the left, and
  // banding the whole row put a heading behind "Apple 14 10 75".
  sheet.formats.set([[0, 0, 0, 3]], { ...HEADING }, at)
  sheet.formats.set([[0, 5, 0, 7]], { ...HEADING }, at)
  sheet.formats.set([[2, 0, 2, 3]], { ...HEADING }, at)
  for (const r of [2, 6, 12]) sheet.formats.set([[r, 5, r, 7]], { ...HEADING }, at)
  sheet.formats.set([[10, 0, 10, 1]], { ...CRITERIA }, at)
  sheet.formats.set([[17, 0, 17, 0]], { ...CRITERIA }, at)
  sheet.formats.set([[13, 1, 16, 1]], { numFmt: '#,##0.00' }, at)
  sheet.formats.set([[13, 6, 15, 6]], { numFmt: '0.0000' }, at)
  sheet.formats.set([[16, 6, 18, 6]], { numFmt: '0.0000' }, at)
  sheet.formats.set([[3, 6, 5, 6]], { numFmt: '0.0000' }, at)
  sheet.formats.set([[11, 6, 11, 6]], { numFmt: '#,##0.000' }, at)
  sheet.formats.set([[13, 2, 16, 2]], { color: '#64748b' }, at)
  sheet.widths.A = 170
  sheet.widths.F = 170
  sheet.widths.G = 150

  // Column H, the rows of the orchard, drawn as checkboxes. The cells
  // still hold TRUE and FALSE, which is what H11 counts.
  sheet.cellTypes = [{ id: newCellTypeId(), kind: 'checkbox', rects: [[3, 7, 8, 7]] }]
</script>

<div class="wrap">
  <label class="picker">
    <span>How numbers and formulas are spelled</span>
    <select bind:value={locale}>
      {#each LOCALES as option (option.id)}
        <option value={option.id}>{option.label}</option>
      {/each}
    </select>
  </label>
  <div class="sheet">
    <SvSheet document={doc} height="100%" rows={22} columns={9} localization={{ locale }} />
  </div>
</div>

<style>
  .wrap { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: 10px; }
  .picker { display: flex; align-items: center; gap: 10px; font-size: 13px; }
  .picker select { font: inherit; padding: 4px 8px; }
  .sheet { flex: 1; min-height: 0; }
</style>
