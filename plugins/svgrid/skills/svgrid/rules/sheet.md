# The spreadsheet shell (`<SvSheet>`, `@svgrid/enterprise`)

`<SvSheet>` is Excel on top of the grid: a ribbon, a formula bar, sheet
tabs and a status bar over a workbook with a formula engine. It is a
**component, not a mode** of `<SvGrid>`: it owns a document (formulas,
address-keyed formats, comments, rules, protection) and uses the grid to
paint. It lives in `@svgrid/enterprise`; never scaffold it into a project
that only has `@svgrid/grid`, and never move its code into the MIT package.

## The minimal sheet

```svelte
<script lang="ts">
  import { SvSheet } from '@svgrid/enterprise'

  const data = [{ name: 'Budget', cells: [['Item', 'Amount'], ['Rent', '1200'], ['Total', '=SUM(B2:B2)']] }]
</script>

<SvSheet {data} height={480} />
```

Cells are **raw text**: a formula is the string that starts with `=`, a
number is its digits, a date is `yyyy-mm-dd`. The engine evaluates; the
shell shows. Sheets are addressed A1-style; rows are 0-based in the API
(`row 1` on screen is index 0).

## Give it a document, not a workbook, when anything is not a cell

`data` and `workbook` are shortcuts for a sheet that is only cells. The
moment formats, comments, validation rules, conditional formatting,
protection, merges or frozen panes matter, build a `SheetDocument` and
pass `document`. The document is what `getState()` saves and `setState()`
restores.

```svelte
<script lang="ts">
  import { SvSheet, createWorkbook, createSheetDocument } from '@svgrid/enterprise'

  const wb = createWorkbook([{ name: 'Claims', cells }])
  const doc = createSheetDocument({ workbook: wb })
  const sheet = doc.get('Claims')
  const at = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }
  sheet.formats.set([[0, 0, 0, 5]], { bold: true, fill: '#e2e8f0' }, at)
  sheet.freeze = { rows: 1, cols: 0 }
  sheet.validation = [{ id: 'status', rects: [[1, 5, 20, 5]], allow: 'list', value1: 'Open,Closed', ignoreBlank: true, inCellDropdown: true, alert: { style: 'stop' } }]
</script>

<SvSheet document={doc} height="100%" />
```

Rectangles are `[minRow, minCol, maxRow, maxCol]`, 0-based. Format keys
are `r<row> <letters>` (`r0 A`). The document is read **once** at mount:
a different document means a different `<SvSheet>`, so key the component
or remount rather than swapping the prop.

```svelte
<!-- ❌ Incorrect - the prop identity changes, the shell keeps the first document. -->
<SvSheet document={current} />

<!-- ✅ Correct - a new document is a new component. -->
{#key current}<SvSheet document={current} />{/key}
```

## Every write from outside is either through `cmd` or followed by `refresh()`

The shell repaints on what it can see: typing, the ribbon, shortcuts, and
`cmd.setCellValue` from an `onAction` handler, which also lands in the
grid's undo history. A write it cannot see (`wb.setRaw`, a name defined on
`wb.names`, an import replacing a sheet) needs `refresh()` on the
component afterwards.

```svelte
<script lang="ts">
  let sheet = $state<SvSheet>()
</script>

<!-- ❌ Incorrect - the workbook changed, the shell still shows the old value. -->
<button onclick={() => wb.setRaw('Budget', 1, 1, '1300')}>Apply</button>

<!-- ✅ Correct - either write through the command context... -->
<SvSheet bind:this={sheet} workbook={wb} onAction={(action, cmd) => {
  if (action === 'goal-seek') { cmd.setCellValue(1, 1, String(solve())); return true }
}} />

<!-- ✅ ...or write to the workbook and say so. -->
<button onclick={() => { wb.setRaw('Budget', 1, 1, '1300'); sheet?.refresh() }}>Apply</button>
```

Several cells in one go go inside `cmd.batch(() => { ... })`, so the user
gets one Ctrl+Z, not forty. `act('sort-asc')` runs a ribbon action as if
its button had been clicked, for a host with chrome of its own.

## `onAction` returning `true` takes the action over

Every ribbon button, cell-menu entry and shortcut raises its
`RibbonActionId` through `onAction` first. Return `true` to replace the
shell's own dialog or behaviour with yours; return nothing to let the shell
handle it. Do not handle an action **and** let it fall through.

```svelte
<SvSheet {data} onAction={(action, cmd) => {
  if (action === 'insert-chart') { openChartBuilder(cmd.ranges); return true }
}} />
```

The shell answers `insert-table` and `insert-chart` itself, so both are
always on the ribbon and the old `extras` prop is no longer needed. An
application that wants its own dialog still takes either over through
`onAction`.

## Qualify addresses in `formats` to reach another sheet

The `formats` prop keys formats by A1 address for the sheet that is active
at mount. A bare address never reaches a second sheet; qualify it the way
a formula would.

```svelte
<!-- ❌ Incorrect - F2 on the Orders sheet is not formatted; the active sheet's F2 is. -->
<SvSheet {data} formats={{ F2: { numFmt: '$#,##0.00' } }} />

<!-- ✅ Correct -->
<SvSheet {data} formats={{ 'Orders!F2': { numFmt: '$#,##0.00' }, "'Price list'!C2": { bold: true } }} />
```

## Save with `getState()`, restore with `setState()`, listen with `onChange`

`getState()` is plain JSON and `setState()` puts it back into the same
workbook. `onChange` fires once per tick with every reason since the last
call, so an autosave is a debounced handler, never a per-keystroke write.

```svelte
<SvSheet bind:this={sheet}
  onChange={(reasons) => queueSave(() => sheet?.getState())}
  onReady={() => { if (saved) sheet?.setState(saved) }} />
```

Files: `sheet.toXlsx()`, `sheet.toOds()` and `sheet.open(file)` (also File >
Save As, Save As ODS and Open on the ribbon, Ctrl+S and Ctrl+O). `open` takes
an .xlsx, an .ods or a .csv and decides by the bytes, not the file name.
Outside the component: `documentToXlsx(doc)` / `documentFromXlsx(bytes)`,
`documentToOds(doc)` / `documentFromOds(bytes)`, `documentFromFile(blob)` for
any of the three, and `csvText` / `sheetStateFromCsv` for CSV. Everything but
the CSV pair needs `jszip`, an optional peer, installed in the app.

## Protection, comments and localisation are props and document state, not CSS

- **Protection**: every cell is locked to begin with; unlock with
  `locked: false` in a format entry, then `sheet.protected = true` (or
  Review > Protect Sheet). `protection: { allow, ranges }` on the sheet
  state holds Excel's "allow users to" list and Allow Edit Ranges. A
  command asks `cmd.canEdit(r, c)` before it writes.
- **Comments**: `sheet.notes = { r1: { B: 'text' } }` is a note;
  `{ text, author, at, replies, resolved }` is a thread. Pass
  `commentAuthor="Name"` so new comments and replies are signed.
- **Localisation**: `localization={{ locale: 'de-DE', text: { statusReady: 'Bereit', 'ribbon.tab.home': 'Start' } }}`.
  Every string is a key in `SheetMessages`; unset keys stay English.
  Function names and error values (`SUM`, `#VALUE!`) stay English in
  every locale, as they do in Excel.
- **Look**: `look="excel"` pins Excel's palette; the default follows the
  app's `--sg-*` tokens, so theme the sheet the way the grid is themed
  (see [theming.md](./theming.md)).

## What else the shell has, so nothing is reinvented

Each of these is part of the document and rides in `getState()`, the
`.xlsx` and the delta stream, so reach for the shell's own before building
one beside it:

- **Tables** (Ctrl+T, `wb.tables`): a named block whose columns are read
  by name, `=SUM(Orders[Amount])` and `[@Qty]` inside it, growing over the
  row typed under the last one, with Excel's eighteen styles.
- **PivotTables** (`sheet.pivots`): a definition over a block, written as
  plain cells one undo at a time, with a report filter above it and Show
  Details for the rows behind a number.
- **Sparklines** (`sheet.sparklines`), **charts and pictures**
  (`sheet.objects`, anchored to a cell), and Excel's `IMAGE(url)` for a
  picture that IS the cell.
- **Hyperlinks** (`sheet.links`): on the cell rather than its text, to a
  page or to an address on this workbook. Only `http`, `https`, `mailto`,
  `tel`, `sms` and `ftp` are followed.
- **Iterative calculation** (`wb.setIteration`): a circular model that
  converges rather than `#CYCLE!`.
- **Collaboration**: `createDeltaStream(doc, { onDelta })` and
  `applySheetDelta`, with a `presence` prop for other people's cursors.

## Formulas: Excel's grammar, not JavaScript

Arguments are separated by `,`, the decimal point is `.`, ranges are
`A1:B9`, sheets are `Orders!B2` or `'Price list'!B2`, names are defined
on `wb.names`. Custom functions register through `withCustomFunctions`,
never by patching `FUNCTIONS`. Check
`https://svgrid.com/llms-full.txt` (the "Spreadsheet formulas" page) for
the function list before promising one. Dynamic arrays spill as in
Excel: `FILTER`, `UNIQUE`, `SORT`, `SORTBY`, `SEQUENCE`, `TRANSPOSE`,
`TEXTSPLIT` and a bare range fill the cells under the formula, which keep
blank text and read the anchor's values; a blocked spill is `#SPILL!`.
`LET` and `LAMBDA` are there too, with `MAP`, `BYROW`, `BYCOL`, `REDUCE`,
`SCAN` and `MAKEARRAY`; each spills, and each hands its whole answer to the
function around it, so `=SUM(MAP(A1:A9, LAMBDA(v, v * 2)))` adds every
doubled value. Excel's spill operator (`D2#`) and array constants
(`{1;2;3}`) are not read: both are `#PARSE!`.

What evaluates is swappable: `createWorkbook(sheets, { engine })` takes a
`SheetEngine`, with the built-in as the default and
`createHyperFormulaEngine({ hyperformula })` for Excel's full library. The
workbook keeps the graph, the cache and the spills either way.
