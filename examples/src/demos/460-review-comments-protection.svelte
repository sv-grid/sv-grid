<script lang="ts">
  /**
   * 460. Cell comments and Protect Sheet: a review workflow
   * ------------------------------------------------------
   * The expense sheet a finance reviewer works through. Ten claims came in
   * from the team; the reviewer decides each one, leaves a note where
   * something is off, and nobody else can touch the figures while it is
   * under review:
   *
   *   Protection   the sheet opens protected. Every cell is locked except
   *                the two the reviewer owns, Receipt and Status, so a
   *                keystroke on an Amount does nothing and the status bar
   *                says why. Review > Unprotect Sheet opens everything;
   *                Format Cells > Protection shows which cells were unlocked.
   *   Comments     three reviewer notes sit on the cells they are about,
   *                the red corner Excel draws. Hover for the text, Shift+F2
   *                to edit, Review > Next to walk them, Show All Comments to
   *                list them under the ribbon.
   *   Validation   Status is a list, so the reviewer picks Approved /
   *                Rejected / On hold from the arrow rather than typing it.
   *   Formulas     the totals by status are SUMIFs, so a decision moves the
   *                money at the bottom as it is made.
   *
   * Everything here is part of the document: protection, the unlocked
   * cells, the notes and the rules ride through getState() with the cells.
   *
   * Try: type over an Amount (refused), then pick "Approved" on row 3 and
   * watch the totals. Review > Next lands on the first note; Ctrl+Enter in
   * the box saves an edit. Unprotect Sheet, then the Amount takes the edit.
   */
  import { SvSheet, createWorkbook, createSheetDocument, type CellFormatEntry } from '@svgrid/enterprise'

  const CLAIMS: ReadonlyArray<readonly [string, string, string, number, string, string]> = [
    ['EXP-2041', 'Ana Ruiz',    'Travel',    412,  'Yes', 'Approved'],
    ['EXP-2042', 'Ben Okafor',  'Meals',     210,  'Yes', 'Submitted'],
    ['EXP-2043', 'Chloe Adams', 'Software',  89,   'Yes', 'Approved'],
    ['EXP-2044', 'Dev Patel',   'Travel',    1180, 'No',  'On hold'],
    ['EXP-2045', 'Ana Ruiz',    'Lodging',   640,  'Yes', 'Submitted'],
    ['EXP-2046', 'Ben Okafor',  'Travel',    412,  'Yes', 'Submitted'],
    ['EXP-2047', 'Eli Novak',   'Training',  950,  'Yes', 'Approved'],
    ['EXP-2048', 'Chloe Adams', 'Meals',     58,   'No',  'Rejected'],
    ['EXP-2049', 'Dev Patel',   'Software',  240,  'Yes', 'Submitted'],
    ['EXP-2050', 'Eli Novak',   'Lodging',   520,  'Yes', 'Submitted'],
  ]
  const LAST = CLAIMS.length + 1        // the last claim is on row 11
  const STATUSES = ['Submitted', 'Approved', 'Rejected', 'On hold']

  const claims = [
    ['Claim', 'Employee', 'Category', 'Amount', 'Receipt', 'Status', 'Paid'],
    ...CLAIMS.map(([id, who, cat, amount, receipt, status], i) => [
      id, who, cat, String(amount), receipt, status, `=IF(F${i + 2}="Approved",D${i + 2},0)`,
    ]),
    [],
    ['By status', 'Claims', 'Amount'],
    ...STATUSES.map((s, i) => [s, `=COUNTIF(F2:F${LAST},A${i + 14})`, `=SUMIF(F2:F${LAST},A${i + 14},D2:D${LAST})`]),
    ['Total', `=SUM(B14:B17)`, `=SUM(C14:C17)`],
    [],
    ['Approved so far', `=SUM(G2:G${LAST})`],
  ]

  const wb = createWorkbook([{ name: 'Claims', cells: claims }])

  // The document carries what is not a cell: the notes, the rules and the
  // protection flag. Built here so the sheet opens the way the reviewer
  // left it, exactly as a saved document would come back.
  const doc = createSheetDocument({ workbook: wb })
  const sheet = doc.get('Claims')
  sheet.notes = {
    r2: { D: 'Three days of meals at 70 a day: over the 60 limit. Needs a director\'s sign-off before it goes through.' },
    r4: { E: 'No receipt attached. On hold until it arrives; the airline can reissue one.' },
    r6: { A: 'Same fare and dates as EXP-2041 on row 2. Check it is not the same ticket claimed twice.' },
  }
  sheet.validation = [
    { id: 'status', rects: [[1, 5, LAST - 1, 5]], allow: 'list', value1: STATUSES.join(','), ignoreBlank: true, inCellDropdown: true, alert: { style: 'stop', title: 'Status', message: 'Pick one of Submitted, Approved, Rejected or On hold.' } },
    { id: 'receipt', rects: [[1, 4, LAST - 1, 4]], allow: 'list', value1: 'Yes,No', ignoreBlank: true, inCellDropdown: true, alert: { style: 'stop' } },
  ]
  sheet.conditionalFormats = [
    { id: 'ok', rects: [[1, 5, LAST - 1, 5]], kind: 'text', match: 'contains', value: 'Approved', style: { fill: '#C6EFCE', color: '#006100' } },
    { id: 'no', rects: [[1, 5, LAST - 1, 5]], kind: 'text', match: 'contains', value: 'Rejected', style: { fill: '#FFC7CE', color: '#9C0006' } },
    { id: 'hold', rects: [[1, 5, LAST - 1, 5]], kind: 'text', match: 'contains', value: 'On hold', style: { fill: '#FFEB9C', color: '#9C5700' } },
  ]
  sheet.freeze = { rows: 1, cols: 0 }
  sheet.protected = true

  // Fills are literal colours, as in Excel, each with its own text colour so
  // the sheet reads the same on a dark theme.
  const BAND = { bold: true, fill: '#e2e8f0', color: '#0f172a' } as const
  const MONEY = { numFmt: '$#,##0' } as const
  // The two columns the reviewer owns: unlocked, and tinted the way Excel
  // templates mark their input cells.
  const INPUT = { locked: false, fill: '#fffbe6', color: '#0f172a' } as const

  type Entry = Record<string, CellFormatEntry>
  const across = (cols: string, row: number, entry: CellFormatEntry): Entry =>
    Object.fromEntries([...cols].map((c) => [`${c}${row}`, entry]))
  const down = (col: string, from: number, to: number, entry: CellFormatEntry): Entry =>
    Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [`${col}${from + i}`, entry]))

  const formats: Entry = {
    ...across('ABCDEFG', 1, BAND),
    ...down('D', 2, LAST, MONEY), ...down('G', 2, LAST, MONEY),
    ...down('E', 2, LAST, INPUT), ...down('F', 2, LAST, INPUT),
    ...across('ABC', 13, BAND),
    ...down('C', 14, 18, MONEY),
    ...across('ABC', 18, { bold: true }),
    A20: { bold: true }, B20: { ...MONEY, bold: true, fontSize: 15 },
  }
</script>

<section class="wrap flex flex-col flex-1 min-h-0">
  <SvSheet document={doc} height="100%" rows={24} columns={9} columnWidths={{ A: 130, B: 130 }} {formats} />
  <p class="note shrink-0">
    The sheet opens <strong>protected</strong>: only the tinted Receipt and
    Status cells take an edit. Pick a status from the arrow on row 3 and the
    totals follow. The red corners are the reviewer's notes: hover one, or
    press <strong>Review &gt; Next</strong> to walk them. Unprotect Sheet on
    the Review tab opens the rest.
  </p>
</section>

<style>
  .wrap { gap: 8px; }
  .note { margin: 0; font-size: 13px; line-height: 1.6; color: var(--sg-muted, #64748b); }
</style>
