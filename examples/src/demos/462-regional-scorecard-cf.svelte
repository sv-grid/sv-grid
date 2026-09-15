<script lang="ts">
  /**
   * 462. Regional scorecard: conditional formatting
   * -----------------------------------------------
   * The one-page scorecard a sales director reads on a Monday. Eight
   * regions, three months of actuals, a target, and every judgement on the
   * page is a conditional formatting rule over COMPUTED values, so the
   * colours follow the numbers rather than being painted on:
   *
   *   Attainment   Highlight Cells: under 90% is Light Red Fill with Dark
   *                Red Text, 100% and over is Green Fill with Dark Green
   *                Text. Attainment is =Q3/Target, so an edit to any month
   *                moves the colour.
   *   Q3           a Data Bar: the bar is the region's share of the largest
   *                quarter, measured from zero as Excel's are; Top 3 Items
   *                on the same column bolds the leaders.
   *   Jul..Sep     a Green - Yellow - Red Color Scale across all 24 cells,
   *                so the best and worst months stand out on one map.
   *   Trend        an Icon Set: the arrow points where Sep went against
   *                Aug (=E-D), up, sideways or down.
   *
   * The rules are part of the document: Home > Conditional Formatting >
   * Manage Rules lists them in priority order, with a sample, where each
   * applies and Stop If True; Clear Rules from Entire Sheet strips them;
   * Ctrl+Z puts them back.
   *
   * Try: set South's Sep to 60000. The arrow flips up, the bar grows, the
   * attainment cell goes from red to green and the rank moves. Then open
   * Manage Rules and drag the Top 3 rule below the data bar with Move Down:
   * nothing changes, since a bar and a bold do not fight over a property.
   */
  import { SvSheet, createWorkbook, createSheetDocument, COLOR_SCALES, DATA_BAR_COLOR, type CellFormatEntry } from '@svgrid/enterprise'

  const REGIONS: ReadonlyArray<readonly [string, number, number, number, number]> = [
    //  region      target   jul     aug     sep
    ['North',      150000, 48200, 51900, 55600],
    ['South',      120000, 41000, 39500, 24200],
    ['East',       160000, 52800, 54100, 58900],
    ['West',       110000, 36900, 37200, 39800],
    ['Central',     90000, 29100, 30400, 30900],
    ['Nordics',     80000, 27600, 26100, 24400],
    ['Iberia',      70000, 21800, 23900, 26500],
    ['Benelux',     60000, 20700, 19800, 19200],
  ]
  const LAST = REGIONS.length + 1       // Benelux is on row 9

  const cells = [
    ['Region', 'Target', 'Jul', 'Aug', 'Sep', 'Q3', 'Attainment', 'Trend', 'Rank'],
    ...REGIONS.map(([region, target, jul, aug, sep], i) => {
      const r = i + 2
      return [region, String(target), String(jul), String(aug), String(sep), `=SUM(C${r}:E${r})`, `=F${r}/B${r}`, `=E${r}-D${r}`, `=RANK(F${r},$F$2:$F$${LAST})`]
    }),
    ['Total', `=SUM(B2:B${LAST})`, `=SUM(C2:C${LAST})`, `=SUM(D2:D${LAST})`, `=SUM(E2:E${LAST})`, `=SUM(F2:F${LAST})`, `=F${LAST + 1}/B${LAST + 1}`, `=E${LAST + 1}-D${LAST + 1}`],
    [],
    ['Regions on target', `=COUNTIF(G2:G${LAST},">=1")&" of "&COUNTA(A2:A${LAST})`],
    ['Best month', `=MAX(C2:E${LAST})`],
    ['Weakest region', `=INDEX(A2:A${LAST},MATCH(MIN(G2:G${LAST}),G2:G${LAST},0))`],
  ]

  const wb = createWorkbook([{ name: 'Scorecard', cells }])
  const doc = createSheetDocument({ workbook: wb })

  // Rectangles are [minRow, minCol, maxRow, maxCol], 0-based; the data rows
  // are 1..LAST-1 in those terms. Order is priority: the first rule that
  // decides a property (the fill, the text colour, the bar, the icon) wins.
  const body = (c1: number, c2 = c1) => [[1, c1, LAST - 1, c2]] as const
  doc.get('Scorecard').conditionalFormats = [
    { id: 'behind', rects: body(6), kind: 'cellIs', operator: 'less', value1: '0.9', style: { fill: '#FFC7CE', color: '#9C0006' } },
    { id: 'on-target', rects: body(6), kind: 'cellIs', operator: 'greaterOrEqual', value1: '1', style: { fill: '#C6EFCE', color: '#006100' } },
    { id: 'leaders', rects: body(5), kind: 'topBottom', top: true, rank: 3, style: { bold: true } },
    { id: 'bars', rects: body(5), kind: 'dataBar', color: DATA_BAR_COLOR },
    { id: 'months', rects: body(2, 4), kind: 'colorScale', colors: COLOR_SCALES['green-yellow-red'] },
    { id: 'trend', rects: body(7), kind: 'iconSet', set: 'arrows' },
  ]
  doc.get('Scorecard').freeze = { rows: 1, cols: 1 }

  const BAND = { bold: true, fill: '#e2e8f0', color: '#0f172a' } as const
  const TOTAL = { bold: true, fill: '#eef2ff', color: '#1e1b4b' } as const
  const WHOLE = { numFmt: '#,##0' } as const
  const PERCENT = { numFmt: '0%' } as const

  type Entry = Record<string, CellFormatEntry>
  const across = (cols: string, row: number, entry: CellFormatEntry): Entry =>
    Object.fromEntries([...cols].map((c) => [`${c}${row}`, entry]))
  const block = (cols: string, from: number, to: number, entry: CellFormatEntry): Entry =>
    Object.fromEntries([...cols].flatMap((c) => Array.from({ length: to - from + 1 }, (_, i) => [`${c}${from + i}`, entry])))

  const formats: Entry = {
    ...across('ABCDEFGHI', 1, BAND),
    ...block('BCDEFH', 2, LAST + 1, WHOLE),
    ...block('G', 2, LAST + 1, PERCENT),
    ...block('I', 2, LAST, { align: 'center' }),
    ...across('ABCDEFGHI', LAST + 1, TOTAL),
    ...Object.fromEntries([...'BCDEFH'].map((c) => [`${c}${LAST + 1}`, { ...TOTAL, ...WHOLE }])),
    [`G${LAST + 1}`]: { ...TOTAL, ...PERCENT },
    [`A${LAST + 3}`]: { bold: true }, [`A${LAST + 4}`]: { bold: true }, [`A${LAST + 5}`]: { bold: true },
    [`B${LAST + 4}`]: WHOLE,
  }
</script>

<section class="wrap flex flex-col flex-1 min-h-0">
  <SvSheet document={doc} height="100%" rows={20} columns={10} columnWidths={{ A: 150 }} {formats} />
  <p class="note shrink-0">
    Every colour is a rule over a formula. Type <strong>60000</strong> into
    South's Sep (E3): the arrow turns up, the bar grows, the attainment cell
    goes green and the rank moves. <strong>Home &gt; Conditional Formatting
    &gt; Manage Rules</strong> lists the six rules; Clear Rules from Entire
    Sheet strips them and Ctrl+Z brings them back.
  </p>
</section>

<style>
  .wrap { gap: 8px; }
  .note { margin: 0; font-size: 13px; line-height: 1.6; color: var(--sg-muted, #64748b); }
</style>
