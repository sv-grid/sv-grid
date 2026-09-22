---
seoTitle: Svelte spreadsheet formatting - numbers, borders, merges, rules
seoDescription: Formatting an SvSheet spreadsheet: per-cell number formats, styles and borders, widths and heights, merged headers, and conditional formatting rules.
keywords: spreadsheet number format svelte, conditional formatting svelte, merge cells spreadsheet, format cells dialog, data bars color scale
---

# Formatting: numbers, styles, merged headers and rules

How a cell gets its look: a number format that changes what a value
shows and nothing else, the styles the Home tab applies, borders, the
sizes of rows and columns, cells merged into a header, and rules that
format a cell by what it holds. [Getting started](./start.md) shows
where formats live; this page is what they can say.

The examples share a small scorecard and the lookup for formatting
rectangles.

```svelte {preamble}
<script lang="ts">
  import { SvSheet, createWorkbook, createSheetDocument, FORMAT_PRESETS, accountingPattern, COLOR_SCALES, DATA_BAR_COLOR } from '@svgrid/enterprise'

  const scorecard: string[][] = [
    ['Region', 'Target', 'Jul', 'Aug', 'Sep', 'Q3', 'Attainment', 'Trend'],
    ['North', '150000', '48200', '51900', '55600', '=SUM(C2:E2)', '=F2/B2', '=E2-D2'],
    ['South', '120000', '41000', '39500', '24200', '=SUM(C3:E3)', '=F3/B3', '=E3-D3'],
    ['East', '160000', '52800', '54100', '58900', '=SUM(C4:E4)', '=F4/B4', '=E4-D4'],
    ['West', '110000', '36900', '37200', '39800', '=SUM(C5:E5)', '=F5/B5', '=E5-D5'],
    ['Total', '=SUM(B2:B5)', '=SUM(C2:C5)', '=SUM(D2:D5)', '=SUM(E2:E5)', '=SUM(F2:F5)', '=F6/B6', '=E6-D6'],
  ]

  const at = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }

  // A document with the header and the money in place; each example adds to it.
  function scorecardDoc() {
    const d = createSheetDocument({ workbook: createWorkbook([{ name: 'Scorecard', cells: scorecard }]) })
    const s = d.get('Scorecard')
    s.formats.set([[0, 0, 0, 7]], { bold: true, fill: '#e2e8f0', color: '#0f172a' }, at)
    s.formats.set([[1, 1, 5, 5], [1, 7, 5, 7]], { numFmt: '#,##0' }, at)
    s.formats.set([[1, 6, 5, 6]], { numFmt: '0%' }, at)
    s.formats.set([[5, 0, 5, 7]], { bold: true, border: { top: { width: 1 } } }, at)
    s.freeze = { rows: 1, cols: 1 }
    return d
  }
</script>
```

## A format is a property of the cell

In Excel two cells in one column can show `$1,234.50` and `123450%` from
the same stored number, because the format belongs to the cell. The
sheet keeps it that way: `numFmt` is an Excel format string on a cell
entry, the value underneath is untouched, and a formula reads the value,
never the text. A computed percentage formats exactly like a typed one.

`FORMAT_PRESETS` holds the patterns the ribbon's Number Format box
offers (`number`, `currency`, `accounting`, `percent`, `date`, `time`,
`scientific`, `general`), `accountingPattern(symbol, decimals)` builds
the aligned-symbol accounting pattern for any currency, and a string of
your own is any pattern Excel takes, sections for negatives included:

```svelte {runnable}
<script lang="ts">
  const doc = scorecardDoc()
  const sheet = doc.get('Scorecard')
  sheet.formats.set([[1, 1, 5, 5]], { numFmt: accountingPattern('$', 0) }, at)
  sheet.formats.set([[1, 6, 5, 6]], { numFmt: FORMAT_PRESETS.percent }, at)
  sheet.formats.set([[1, 7, 5, 7]], { numFmt: '#,##0;[Red](#,##0)' }, at)
</script>

<SvSheet document={doc} rows={9} columns={9} />
```

South's September dropped, so its Trend is red and in parentheses; the
value behind it is still `-15300`, and the Total row sums it as such.

From the keyboard the presets are Excel's: `Ctrl+Shift+1` number,
`Ctrl+Shift+2` time, `Ctrl+Shift+3` date, `Ctrl+Shift+4` currency,
`Ctrl+Shift+5` percent, `Ctrl+Shift+6` scientific, ``Ctrl+Shift+` ``
general. `Ctrl+1` opens Format Cells, with the pattern editable as text.

<div data-docs-demo="210-format-cells" data-height="520"></div>

## Styles

The rest of a cell entry is what the Home tab's buttons set: `bold`,
`italic`, `underline`, `strike`, `color`, `fill`, `fontFamily`,
`fontSize`, `align` and `valign`, `wrap`, `indent`, and `border` with a
spec per edge (`width`, `style` of `solid`, `dashed`, `dotted` or
`double`, and `color`). A `formats.set` call patches a rectangle: what
it names changes, what it does not name stays, so a bold header keeps
its fill when a border is added later.

```svelte {runnable}
<script lang="ts">
  const doc = scorecardDoc()
  const sheet = doc.get('Scorecard')
  // Inputs in blue, the way an analyst marks what may be typed over.
  sheet.formats.set([[1, 1, 4, 4]], { color: '#1d4ed8' }, at)
  // A frame around the block and a double rule under the totals.
  sheet.formats.set([[0, 0, 5, 7]], { border: { left: { width: 1, color: '#94a3b8' }, right: { width: 1, color: '#94a3b8' } } }, at)
  sheet.formats.set([[5, 0, 5, 7]], { border: { bottom: { width: 3, style: 'double' } } }, at)
  sheet.formats.set([[0, 1, 5, 7]], { align: 'right' }, at)
</script>

<SvSheet document={doc} rows={9} columns={9} />
```

Format Painter (Home > Clipboard) copies a cell's whole entry onto a
selection, and the store keys formats on the row's id rather than its
index, so a sort carries every cell's look with it.

## Widths, heights, hidden lines

`widths` is keyed by column letter, `heights` by 0-based row index; a
row with no entry is `rowHeight` (22 by default), a column with none
`columnWidth` (96). Home > Cells > Format has AutoFit Row Height and
AutoFit Column Width, Hide and Unhide (`Ctrl+Shift+9` and
`Ctrl+Shift+0` unhide rows and columns), and Row Height and Column
Width as numbers; every one lands in the document. `hidden.rows` and
`hidden.cols` are sets of indexes.

```svelte {runnable}
<script lang="ts">
  const doc = scorecardDoc()
  const sheet = doc.get('Scorecard')
  sheet.widths.A = 120
  sheet.widths.G = 110
  sheet.heights.set(0, 32)
  sheet.hidden.cols.add(7)
</script>

<SvSheet document={doc} rows={9} columns={9} />
```

Column H is there and computed, just not shown: select G and I and
Unhide brings it back at its width.

## Merged headers

A merge is a rectangle in `merges`, and the grid treats it as one cell:
click anywhere inside and the Name Box says its top-left address, the
arrow keys step over it, and the value is the top-left cell's. Home >
Merge & Center, Merge Across, Merge Cells and Unmerge are the same
operation from the ribbon, one `Ctrl+Z` each.

```svelte {runnable}
<script lang="ts">
  const wb = createWorkbook([{ name: 'Report', cells: [
    ['H1 budget', '', '', '', '', '', ''],
    ['Line', 'Q1', '', '', 'Q2', '', ''],
    ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    ['Rent', '2400', '2400', '2400', '2500', '2500', '2500'],
    ['Payroll', '18500', '18500', '19200', '19200', '19200', '20100'],
    ['Total', '=SUM(B4:B5)', '=SUM(C4:C5)', '=SUM(D4:D5)', '=SUM(E4:E5)', '=SUM(F4:F5)', '=SUM(G4:G5)'],
  ] }])
  const doc = createSheetDocument({ workbook: wb })
  const sheet = doc.get('Report')
  sheet.merges = [[0, 0, 0, 6], [1, 1, 1, 3], [1, 4, 1, 6], [1, 0, 2, 0]]
  sheet.formats.set([[0, 0, 0, 6]], { bold: true, fontSize: 16, align: 'center', fill: '#1e293b', color: '#f8fafc' }, at)
  sheet.formats.set([[1, 0, 2, 6]], { bold: true, align: 'center', fill: '#e2e8f0', color: '#0f172a' }, at)
  sheet.formats.set([[1, 0, 1, 0]], { valign: 'center' }, at)
  sheet.formats.set([[3, 1, 5, 6]], { numFmt: '#,##0' }, at)
  sheet.formats.set([[5, 0, 5, 6]], { bold: true, border: { top: { width: 1 } } }, at)
  sheet.heights.set(0, 34)
</script>

<SvSheet document={doc} rows={9} columns={8} />
```

Rectangles are `[minRow, minCol, maxRow, maxCol]`, 0-based, so
`[1, 0, 2, 0]` is the Line corner merged down two rows. A merge goes
into the `.xlsx` and comes back from one.

<div data-docs-demo="463-merged-report-headers" data-height="520"></div>

## Rules: a format the value decides

Conditional formatting is a list of rules on a sheet, each over one or
more rectangles, in priority order: the first rule that decides a
property (the fill, the text colour, the bar, the icon) wins, and a bar
and a bold do not fight. The kinds are Excel's:

| `kind` | Says | Fields |
| --- | --- | --- |
| `cellIs` | the value compares to one or two bounds | `operator` (`greater`, `less`, `between`, `notBetween`, `equal`, `notEqual`, `greaterOrEqual`, `lessOrEqual`), `value1`, `value2`, `style` |
| `text` | the text matches | `match` (`contains`, `notContains`, `beginsWith`, `endsWith`), `value`, `style` |
| `duplicates` | the value appears more than once (or `unique: true`, only once) | `style` |
| `topBottom` | the top or bottom N, or N percent | `top`, `rank`, `percent`, `style` |
| `average` | above or below the range's average | `above`, `style` |
| `formula` | a formula written for the top-left cell is TRUE, moved to each cell | `formula`, `style` |
| `dataBar` | a bar proportional to the value | `color`, `negativeColor` |
| `colorScale` | a colour between two or three stops | `colors` (`COLOR_SCALES` has four named ones) |
| `iconSet` | an icon by third | `set` (`arrows`, `traffic`, `flags`, `symbols`) |

A `style` is the part of a cell entry a rule may set: `fill`, `color`,
`bold`, `italic`, `underline`, `strike`, `numFmt`. A bound in `value1`
is text as it would be typed, a number or a formula, and `stopIfTrue`
ends the list for a cell the rule matched.

```svelte {runnable}
<script lang="ts">
  const doc = scorecardDoc()
  const sheet = doc.get('Scorecard')
  // Data rows only, so the Total row stays plain.
  const rows = (c1: number, c2 = c1) => [[1, c1, 4, c2]] as const
  sheet.conditionalFormats = [
    { id: 'behind', rects: rows(6), kind: 'cellIs', operator: 'less', value1: '0.9', style: { fill: '#FFC7CE', color: '#9C0006' } },
    { id: 'on-target', rects: rows(6), kind: 'cellIs', operator: 'greaterOrEqual', value1: '1', style: { fill: '#C6EFCE', color: '#006100' } },
    { id: 'leader', rects: rows(5), kind: 'topBottom', top: true, rank: 1, style: { bold: true } },
    { id: 'bars', rects: rows(5), kind: 'dataBar', color: DATA_BAR_COLOR },
    { id: 'months', rects: rows(2, 4), kind: 'colorScale', colors: COLOR_SCALES['green-yellow-red'] },
    { id: 'trend', rects: rows(7), kind: 'iconSet', set: 'arrows' },
    { id: 'off-plan', rects: rows(0), kind: 'formula', formula: '=$G2<0.9', style: { italic: true, color: '#9C0006' } },
  ]
</script>

<SvSheet document={doc} rows={9} columns={9} />
```

Type `60000` into South's September: its attainment goes green, its
name stops being italic, its bar grows and the rank bold may move. Home
> Conditional Formatting has every kind as a menu, and Manage Rules
reorders, edits and deletes them; the rules ride in `getState()` and go
into the `.xlsx` as Excel's own.

<div data-docs-demo="462-regional-scorecard-cf" data-height="560"></div>

## See also

- [Number formats and cell styles](../cells/number-formats.md) - the format-string compiler and the store, for a plain grid as well.
- [Conditional formatting on the grid](../cells/conditional-formatting.md) - the column-level rules a `<SvGrid>` has without the sheet.
- [Data validation](./validation.md) - the rule that stops a bad value at the keyboard, rather than colouring it after.
- [Files](./files.md) - what of this travels in an `.xlsx`, an `.ods` and an `.xls`.
- [The spreadsheet shell](../cells/spreadsheet-shell.md) - the Format Cells dialog and the Conditional Formatting menu in detail.
