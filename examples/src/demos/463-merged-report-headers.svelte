<script lang="ts">
  /**
   * 463. Budget report: merged headers
   * ----------------------------------
   * The half-year report a finance team prints, laid out the way Excel
   * lays it out: with merged cells doing the typography.
   *
   *   Title        A1:I1 merged and centred, one big cell across the page.
   *   Group heads  "Q1" over Jan..Mar, "Q2" over Apr..Jun and "H1" over
   *                Budget / Actual are merges across the header row; the
   *                "Line" corner is a merge DOWN two rows.
   *   Notes        a block at the bottom merged into one wrapped paragraph.
   *
   * A merge is one cell to the grid: click anywhere in the Q1 header and
   * the Name Box says B2, the Merge & Center button lights, the arrow keys
   * step over it as one cell and the column letters it spans are shaded.
   * The merges are in the document with the cells, move with an insert or
   * delete, and come back from getState().
   *
   * Try: select the Q2 header and press Merge & Center: it unmerges, and
   * Apr..Jun show three plain cells with "Q2" in the first. Select E2:G2
   * and press it again. Then select the title row with a value beside it
   * and merge: Excel's warning about keeping the upper-left value appears.
   */
  import { SvSheet, createWorkbook, createSheetDocument, type CellFormatEntry } from '@svgrid/enterprise'

  const LINES: ReadonlyArray<readonly [string, number[], number]> = [
    //  line          jan    feb    mar    apr    may    jun    budget
    ['Revenue',      [182000, 176500, 191200, 188400, 195100, 203800], 1120000],
    ['Cost of sales', [-71300, -69800, -74100, -73500, -76200, -79400], -430000],
    ['Payroll',      [-58200, -58200, -58200, -60100, -60100, -60100], -355000],
    ['Marketing',    [-14500, -12200, -16800, -15100, -18400, -17300], -95000],
    ['Cloud',        [-6100, -6300, -6400, -6600, -6900, -7100], -40000],
    ['Office',       [-4800, -4800, -4800, -4800, -4800, -4800], -29000],
  ]
  const FIRST = 4                          // the first line is on row 4
  const LAST = FIRST + LINES.length - 1    // the last on row 9
  const TOTAL = LAST + 1                   // the total row
  const NOTES = TOTAL + 2                  // the notes heading

  const cells = [
    ['FY2026 budget vs actual, first half'],
    ['Line', 'Q1', '', '', 'Q2', '', '', 'H1'],
    ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Budget', 'Actual'],
    ...LINES.map(([line, months, budget], i) => {
      const r = FIRST + i
      return [line, ...months.map(String), String(budget), `=SUM(B${r}:G${r})`]
    }),
    ['Net', ...'BCDEFGHI'.split('').map((c) => `=SUM(${c}${FIRST}:${c}${LAST})`)],
    [],
    ['Notes'],
    ['Revenue runs 3% ahead of budget on the strength of Q2 renewals; cost of sales follows it. Payroll stepped up in April with the two engineering hires. Marketing overspent in March and May against the conference calendar and is expected to land on budget for the year. Cloud grows with usage and is reviewed quarterly.'],
  ]

  const wb = createWorkbook([{ name: 'Report', cells }])
  const doc = createSheetDocument({ workbook: wb })
  // Rectangles are [minRow, minCol, maxRow, maxCol], 0-based.
  doc.get('Report').merges = [
    [0, 0, 0, 8],                         // the title, A1:I1
    [1, 0, 2, 0],                         // "Line", down two rows
    [1, 1, 1, 3],                         // Q1 over Jan..Mar
    [1, 4, 1, 6],                         // Q2 over Apr..Jun
    [1, 7, 1, 8],                         // H1 over Budget / Actual
    [NOTES - 1, 0, NOTES - 1, 8],         // the Notes heading
    [NOTES, 0, NOTES + 2, 8],             // the paragraph, three rows deep
  ]

  const TITLE = { bold: true, fontSize: 17, align: 'center', fill: '#1e293b', color: '#f8fafc' } as const
  const GROUP = { bold: true, align: 'center', fill: '#e2e8f0', color: '#0f172a' } as const
  const HEAD = { bold: true, align: 'center', fill: '#f1f5f9', color: '#0f172a' } as const
  const MONEY = { numFmt: '#,##0;(#,##0)' } as const
  const NET = { bold: true, fill: '#eef2ff', color: '#1e1b4b', numFmt: '#,##0;(#,##0)' } as const

  type Entry = Record<string, CellFormatEntry>
  const across = (cols: string, row: number, entry: CellFormatEntry): Entry =>
    Object.fromEntries([...cols].map((c) => [`${c}${row}`, entry]))
  const block = (cols: string, from: number, to: number, entry: CellFormatEntry): Entry =>
    Object.fromEntries([...cols].flatMap((c) => Array.from({ length: to - from + 1 }, (_, i) => [`${c}${from + i}`, entry])))

  const formats: Entry = {
    A1: TITLE,
    ...across('ABEH', 2, GROUP),
    ...across('BCDEFGHI', 3, HEAD),
    ...block('BCDEFGHI', FIRST, LAST, MONEY),
    ...across('ABCDEFGHI', TOTAL, NET),
    [`A${NOTES}`]: { bold: true, fill: '#f1f5f9', color: '#0f172a' },
    [`A${NOTES + 1}`]: { wrap: true, color: '#334155' },
  }
</script>

<section class="wrap flex flex-col flex-1 min-h-0">
  <SvSheet document={doc} height="100%" rows={18} columns={10} columnWidths={{ A: 130 }} {formats} />
  <p class="note shrink-0">
    The title, the Q1 / Q2 / H1 group headers, the Line corner and the
    notes paragraph are merged cells. Click inside <strong>Q1</strong>: the
    Name Box reads B2 and Merge &amp; Center lights. Press it to unmerge,
    select B2:D2 and press it again; the arrow keys treat a merge as one
    cell. Ctrl+Z takes every step back.
  </p>
</section>

<style>
  .wrap { gap: 8px; }
  .note { margin: 0; font-size: 13px; line-height: 1.6; color: var(--sg-muted, #64748b); }
</style>
