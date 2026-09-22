---
seoTitle: Charts, sparklines and pictures on a Svelte spreadsheet
seoDescription: Charts over a range of the SvSheet spreadsheet, sparklines inside cells, pictures over the sheet and the IMAGE function, in the document and the .xlsx.
keywords: spreadsheet chart svelte, sparklines svelte, insert picture spreadsheet, IMAGE function, chart from range
---

# Charts, sparklines and pictures

Four things a sheet draws beyond its cells: a chart over a range, which
floats above the sheet and redraws when a number changes; a sparkline,
which is a chart inside one cell; a picture from a file; and a cell that
is a picture because its formula says so. Each is inserted from the
ribbon, kept in the document, and carried in the `.xlsx`.
[Getting started](./start.md) shows the document.

The examples share a year of traffic by channel.

```svelte {preamble}
<script lang="ts">
  import { SvSheet, createWorkbook, createSheetDocument, objectId, sparklineId, type SheetObject, type SparklineGroup } from '@svgrid/enterprise'

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
  const traffic: Record<string, number[]> = {
    Search: [4200, 4450, 4310, 4800, 5200, 5600],
    Social: [1800, 2100, 1950, 2400, 2200, 2600],
    Direct: [2400, 2350, 2500, 2450, 2600, 2550],
  }
  const cells: string[][] = [
    ['Channel', ...months, 'Trend'],
    ...Object.entries(traffic).map(([name, values]) => [name, ...values.map(String), '']),
    ['Total', ...months.map((_, i) => `=SUM(${String.fromCharCode(66 + i)}2:${String.fromCharCode(66 + i)}4)`), ''],
  ]

  const at = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }

  function trafficDoc() {
    const d = createSheetDocument({ workbook: createWorkbook([{ name: 'Traffic', cells }]) })
    const s = d.get('Traffic')
    s.formats.set([[0, 0, 0, 7]], { bold: true, fill: '#e2e8f0', color: '#0f172a' }, at)
    s.formats.set([[4, 0, 4, 7]], { bold: true, border: { top: { width: 1 } } }, at)
    s.formats.set([[1, 1, 4, 6]], { numFmt: '#,##0' }, at)
    s.widths.A = 90
    for (const c of 'BCDEFG') s.widths[c] = 64
    s.widths.H = 110
    s.freeze = { rows: 1, cols: 1 }
    return d
  }
</script>
```

## A chart over a range

Insert > Chart charts the selected block, or the region around a single
cell, as Excel starts one: the first row and column are read as labels
when they look like labels, each column is a series, and the chart is
anchored just under the block. It reads the range, not a copy of the
numbers, so editing a cell redraws it.

A chart is an entry in a sheet's `objects`: its `range`, its `type`
(`bar`, `line`, `area`, `pie` or `scatter`), whether the first row and
column are `headers`, whether the `series` run down the columns or
along the rows, and an `anchor`: the cell it hangs from, an offset
inside it, and a size.

```svelte {runnable}
<script lang="ts">
  const doc = trafficDoc()
  const charts: SheetObject[] = [
    {
      id: objectId(),
      kind: 'chart',
      anchor: { row: 6, col: 1, dx: 8, dy: 8, width: 380, height: 220 },
      range: [0, 0, 3, 6],
      type: 'line',
      headers: true,
      series: 'rows',
      title: 'Visits by channel',
    },
    {
      id: objectId(),
      kind: 'chart',
      anchor: { row: 6, col: 7, dx: 8, dy: 8, width: 300, height: 220 },
      range: [0, 0, 3, 6],
      type: 'bar',
      headers: true,
      series: 'columns',
      stacked: true,
      title: 'Months, stacked',
    },
  ]
  doc.get('Traffic').objects = charts
</script>

<SvSheet document={doc} height={520} rows={20} columns={14} />
```

Change a number in the block: both charts redraw. Drag a chart to move
it, drag its corner to resize it, press Delete to remove it, and
double-click it (or Insert > Setup) for the Chart dialog, where a
`trend` (`linear`, or `sma3` for a three-point moving average) goes over
every series and one series can be moved to a `secondary` axis on the
right, which is what makes a revenue-and-margin chart readable when the
two are orders of magnitude apart. Each change is one undo.

The anchor is Excel's: inserting a row above the chart moves it,
deleting that row takes it with it, and widening a column under it
moves it without reshaping it. The drawing itself is the free
`<SvChart>` from `@svgrid/grid`, so the palette, the tooltips and the
types are the grid's.

<div data-docs-demo="485-sheet-charts-objects" data-height="600"></div>

## A sparkline in a cell

A sparkline is a chart inside one cell, one per row of a block, drawn
from the range so editing a number redraws it. Insert > Sparklines
offers Line, Column and Win/Loss, each opening the Create Sparklines
dialog on the selected block with the data range filled in and the
location the column just past it.

They are kept per group, as Excel keeps them: a `data` range, a
`location` range of the same shape (a row per row, or a column per
column when the location is a row), the `type`, and the settings they
share - `color`, `negativeColor` for the bars below zero, `markers` for
a dot on a line's last point, `sameScale` to draw the whole group on one
value axis.

```svelte {runnable}
<script lang="ts">
  const doc = trafficDoc()
  const groups: SparklineGroup[] = [
    { id: sparklineId(), data: [1, 1, 3, 6], location: [1, 7, 3, 7], type: 'line', markers: true, color: '#2563eb' },
    { id: sparklineId(), data: [4, 1, 4, 6], location: [4, 7, 4, 7], type: 'column', color: '#16a34a' },
  ]
  doc.get('Traffic').sparklines = groups
  doc.get('Traffic').heights.set(1, 30)
  doc.get('Traffic').heights.set(2, 30)
  doc.get('Traffic').heights.set(3, 30)
  doc.get('Traffic').heights.set(4, 30)
</script>

<SvSheet document={doc} rows={8} columns={9} />
```

The cell stays a cell: type a label over a sparkline and the label
reads on top of it, click and the click reaches the cell, so it selects,
drags and edits as any other. With a sparkline's cell selected, the
three kind buttons change that group's kind; Insert > Sparklines > Edit
reopens the dialog on it, and Clear removes the groups under the
selection. An insert or a delete carries a group along, and deleting
the cells it is drawn in, or the cells it reads, removes it.

<div data-docs-demo="486-sheet-sparklines" data-height="520"></div>

## A picture on the sheet

Insert > Picture puts an image from a file on the sheet, carried in the
document as a `data:` URL, anchored and moved like a chart. From code it
is an object of `kind: 'image'` with a `src` and an `alt`:

```svelte {runnable}
<script lang="ts">
  const doc = trafficDoc()
  // A small inline SVG stands in for a logo file.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="60"><rect width="160" height="60" rx="8" fill="#f97316"/><text x="80" y="38" font-family="sans-serif" font-size="22" font-weight="700" fill="#fff" text-anchor="middle">svgrid</text></svg>`
  const logo: SheetObject = {
    id: objectId(),
    kind: 'image',
    anchor: { row: 6, col: 1, dx: 8, dy: 8, width: 160, height: 60 },
    src: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    alt: 'The company logo',
  }
  doc.get('Traffic').objects = [logo]
</script>

<SvSheet document={doc} rows={12} columns={9} />
```

A file the `.xlsx` cannot hold as it is (an SVG, say: Excel keeps only a
few raster types in `xl/media`) is drawn to a PNG on the way in, so what
is on the sheet is what the file will carry. A picture whose `src` is a
web address is left out of the file, and Save As says so in the status
bar: a file with a broken image in it is worse than one without.

## A cell that is a picture

`=IMAGE(source, [alt])` puts the picture in the cell itself instead of
floating one above the sheet, and that changes what it can do: a
thumbnail column sorts and filters with its rows, copies down as a
formula does, and follows its cell through an insert or a delete with
nothing to keep aligned. Only a web address or a `data:` URL is drawn;
any other text stays text, so a bad source is a word in a cell rather
than a broken image. The second argument is the alt text, evaluated
like any argument, which is what a screen reader reads out; and because
the function's value is the source, a formula that references the cell
gets the address, not a picture it could not use.

```svelte {runnable}
<script lang="ts">
  const swatch = (fill: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="24"><rect width="48" height="24" rx="4" fill="${fill}"/></svg>`)}`
  const wb = createWorkbook([{ name: 'Catalogue', cells: [
    ['SKU', 'Colour', 'Source', 'Swatch'],
    ['CH-01', 'Ember', swatch('#f97316'), '=IMAGE(C2, B2)'],
    ['CH-02', 'Slate', swatch('#475569'), '=IMAGE(C3, B3)'],
    ['CH-03', 'Moss', swatch('#16a34a'), '=IMAGE(C4, B4)'],
  ] }])
  const doc = createSheetDocument({ workbook: wb })
  doc.get('Catalogue').formats.set([[0, 0, 0, 3]], { bold: true, fill: '#e2e8f0', color: '#0f172a' }, at)
  doc.get('Catalogue').widths.C = 60
  doc.get('Catalogue').heights.set(1, 30)
  doc.get('Catalogue').heights.set(2, 30)
  doc.get('Catalogue').heights.set(3, 30)
</script>

<SvSheet document={doc} rows={8} columns={5} />
```

Sort the block by Colour: the swatches go with their rows. The file
stores the cell as `_xlfn.IMAGE`, where Excel keeps it.

<div data-docs-demo="494-sheet-cell-images" data-height="520"></div>

## In the document and the file

Charts and pictures are per sheet, ride in `getState()` as `objects` and
report `{ kind: 'objects' }` on `onChange`; sparklines as `sparklines`
with `{ kind: 'sparklines' }`. Both print with the sheet, hung from
their anchor cells, and the default print area grows to hold a chart
anchored below the numbers. In the `.xlsx` a chart becomes a chart part
of its own that carries the references its series read, so Excel
redraws it from the cells rather than from a snapshot; a picture's bytes
go into `xl/media`; a sparkline group goes into the worksheet's
extension list where Excel keeps them. All of them come back from a
file the same way. Charts, pictures and sparklines travel in the `.xlsx`
only; an `IMAGE` cell is a formula and goes wherever formulas go.

The ribbon raises `insert-chart`, `insert-picture`, `chart-setup` and
`delete-object`, and `sparkline-line`, `sparkline-column`,
`sparkline-winloss`, `sparkline-setup` and `clear-sparklines`, so an
application can put a chart builder of its own in their place.

## See also

- [Charts](../charts.md) - `<SvChart>`, the drawing under the sheet's charts, with its 29 types.
- [Sparklines on the grid](../cells/sparklines.md) - the same sparkline as a cell renderer on a plain grid.
- [Data tools](./data-tools.md) - a PivotTable, whose block a chart can read.
- [Files](./files.md) - what of this travels in each format.
- [The spreadsheet shell](../cells/spreadsheet-shell.md) - the Chart dialog and Page Layout in detail.
