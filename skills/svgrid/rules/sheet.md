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
}} extras={['insert-chart']} />
```

`insert-table` and `insert-chart` have nothing behind them in the library
and are left off the ribbon unless listed in `extras`.

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

Files: `sheet.toXlsx()` and `sheet.open(file)` (also File > Save As and
File > Open on the ribbon, Ctrl+S and Ctrl+O), `documentToXlsx(doc)` and
`documentFromXlsx(bytes)` outside the component. Both need `jszip`, an
optional peer, installed in the app.

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

## Formulas: Excel's grammar, not JavaScript

Arguments are separated by `,`, the decimal point is `.`, ranges are
`A1:B9`, sheets are `Orders!B2` or `'Price list'!B2`, names are defined
on `wb.names`. Custom functions register through `withCustomFunctions`,
never by patching `FUNCTIONS`. Check
`https://svgrid.com/llms-full.txt` (the "Spreadsheet formulas" page) for
the function list before promising one; the engine has no spill (dynamic
arrays) yet, so `FILTER`, `UNIQUE`, `SORT` and `SEQUENCE` are not there.
