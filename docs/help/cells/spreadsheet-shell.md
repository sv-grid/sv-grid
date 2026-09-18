# The spreadsheet shell

Everything between the ribbon and the sheet tabs, as one component.

```svelte
<script>
  import { SvSheet, createWorkbook } from '@svgrid/enterprise'

  const wb = createWorkbook([
    { name: 'Budget', cells: [['Line', 'Jan'], ['Rent', '2400']] },
  ])
</script>

<SvSheet workbook={wb} />
```

<div data-docs-demo="27-spreadsheet-ribbon" data-height="640"></div>

That is the whole required API. `<SvSheet />` with no props at all opens an
empty single-sheet workbook, which is what "open a spreadsheet" means.

## What you get

| Part | Comes from |
| --- | --- |
| Ribbon: File, Home, Insert, Formulas, Data, Review, View | `SvSheetRibbon` |
| Name Box and fx bar, showing the RAW text of the active cell | `SvFormulaBar` |
| A..Z headers over the built-in 1..N row gutter | `SvGrid` |
| Sheet tabs: switch, rename, reorder, add, duplicate, hide and unhide | `SvSheetTabs` |
| Sum / Average / Count of the selection | the shell |
| Every Excel shortcut | `enableSheet()` |

This is composition, not a second grid. All of it already existed and was
being re-assembled by hand in four separate demos. What the component adds is
the wiring BETWEEN the parts, done once:

- The formula bar shows the raw text while the grid shows the computed value.
  Editing in the bar edits the formula, not its result.
- The format store is keyed by row id, so sorting cannot strand formatting on
  whatever row took that index.
- Insert and delete go through the workbook, so references are rewritten on
  every sheet rather than only the active one.
- The fill handle translates references, so `=B2` filled down becomes `=B3`.
- The tab strip is told when a shortcut moved the active sheet, so
  `Ctrl+PageUp` and the tabs cannot disagree.
- AutoSum measures its run against evaluated values, so a column of subtotals
  counts as numbers rather than as `"=SUM(...)"` strings.
- Formats are kept per sheet, as they are in Excel. Bold on Summary!C5 says
  nothing about Orders!C5, and the store follows a sheet through a rename.
- The Name Box lists the workbook's defined names. Pick one and the shell
  selects what it refers to, switching sheets first when it lives elsewhere;
  type an address and press Enter to go there. Either way focus comes back
  to the sheet, so the next keystroke edits the cell just reached. Beside it
  sit Excel's three: Cancel and Enter while a formula is being typed, and
  fx, which raises `insert-function`.
- A formula-bar entry lands in the cell the edit started in, however the
  edit ends: Enter, or a click on another cell. It is one step in the
  grid's history, so Ctrl+Z takes it back.
- Enter after an in-cell edit commits and moves down, Shift+Enter up, Tab
  right, as in Excel. Alt+Enter is a line break: the cell turns on Wrap
  Text and its row grows to show every line, as a wrapped row does after
  Wrap Text on the ribbon or in Format Cells. F4 while editing turns the
  reference at the caret through `$A$1`, `A$1`, `$A1` and back.
- AutoComplete, as Excel's: while a cell is typed into, the text entries in
  the same column that run without a blank above and below it are matched
  against what was typed, and when exactly one fits, the rest of it appears
  selected in the cell. Typing on overwrites it, Backspace takes it away,
  and Enter or Tab accepts it in the entry's own case, so "jo" under "John
  Smith" commits "John Smith". Numbers, formulas and booleans are never
  offered, and two entries that both fit ("Apple", "Apricot" for "Ap")
  offer nothing until the typing tells them apart. `completeEntry(typed,
  entries)` is the rule on its own.
- Data entry steps the way Excel's does: the Enter that ends a run of Tabs
  goes down from the column the run began in, and inside a selected block
  Enter and Tab walk the block and wrap at its edges while the block stays
  selected. Ctrl+Enter puts the entry into every cell of the block at once,
  each taking its value and format as if typed there, as one undo. A drag, Shift+click or Shift+Arrow grows the selection from
  its far corner and leaves the active cell at the anchor, white inside the
  tinted range, and the formula bar shows that cell.
- The formula bar follows an in-cell edit as it is typed, and the cell
  follows the bar; both go back when the edit is cancelled.
- The formula bar keeps a cell's line breaks. It shows one line until the
  chevron at its end expands it to every line (up to six), and Alt+Enter
  typed in the bar breaks the line there and expands the bar.
- A typed `12%` is the number 0.12 shown as a percentage, `$1,200` is 1200
  shown as currency, `1,234.5` keeps its separator: the entry names a value
  and a format, and the cell takes both unless it already has a number
  format of its own. `=A1*2` over a `12%` cell is 0.24.
- The fill handle fills the way Excel's does: a lone value repeats, `1, 2`
  continues, `Jan` runs on to `Feb`, and a formula moves every relative
  reference by the distance dragged. Double-click it to fill down as far as
  the column beside the selection has data. A number too wide for its
  column reads as `####` until the column fits it; `TRUE` and `FALSE`
  typed into a cell are booleans, centred.
- Freeze Panes freezes everything above and left of the active cell, both
  halves, per sheet: the rows stay under the column letters and the columns
  beside the row numbers while the rest scrolls, and every frozen cell is
  still an ordinary cell. Unfreeze clears both.
- A dragged column width or row height is one Ctrl+Z, and double-clicking
  a row number's lower edge fits the row to its wrapped text, as a
  double-click on a column letter's edge fits the column to its text.
- Row heights are the sheet's: a row dragged taller stays that way through
  every edit, moves with its row when rows are inserted or deleted above it,
  comes back with an undo, and belongs to one sheet. The fill handle's drag
  is one undo, like Ctrl+D. Column widths move with their columns the same
  way.
- Hide and Unhide, on the column letter and row number menus and on Ctrl+9
  (rows), Ctrl+0 (columns), Ctrl+Shift+9 and Ctrl+Shift+0: a hidden line
  keeps its letter or number and every reference to it, and takes no room,
  so the headers read A, B, D. Unhide reveals what the selection spans, or
  the hidden lines right next to it when it spans none. The cursor steps
  over hidden lines, Ctrl+Arrow lands on the last cell of a run that shows
  rather than its hidden end, and the Name Box can still reach a hidden
  cell; a hide is one Ctrl+Z, moves with an insert or delete, and belongs
  to its sheet.
- Text spills over empty neighbours and is clipped by the first cell that
  holds something, so a title in A1 reads in full and a label beside a
  number does not run under it. Numbers never spill.
- General alignment: numbers right, text left, errors and booleans centred,
  unless the cell says otherwise.
- The headers of every column and row the selection touches are shaded and
  marked with a line in the accent, the Select All corner sits top-left,
  and the status bar reads Ready on the left and Average / Count / Sum on
  the right.
- Sheet tabs delete, insert, rename, move, duplicate, hide and unhide from
  a right-click menu, as in Excel; nothing on the tab face can remove a
  sheet, and deleting one that holds data asks first. A hidden sheet keeps
  its cells and every reference to it, Ctrl+PageUp and PageDown step over
  it, and the flag rides in the document. Duplicate copies the cells and
  everything the document keeps beside them.
- Click a column letter to select the column, a row number to select the
  row, the corner to select the sheet; Shift+click extends. Drag the edge of
  a row number to resize the row, as with a column letter.
- Copy puts two things on the system clipboard: the text each cell shows,
  which is what a text editor expects, and an HTML table with the formats,
  the numbers behind the formatted text and the formulas, written the way
  Excel writes its own (`mso-number-format`, `x:num`), so a paste into
  Excel or Google Sheets keeps the number format, the bold and the fill. A
  paste back into the sheet gets the formula, moved by the distance it
  travelled (`=A1*2` copied from B1 to B3 reads `=A3*2`), and the cell's
  format, as Excel pastes. A cut block is moved, not translated. The block
  Ctrl+C or Ctrl+X took is outlined by Excel's marching ants until Escape,
  a typed entry, a structural edit, the paste of a cut, or the next copy; a
  Ctrl+V paste of a copy keeps them, so the block can be pasted again, and
  Enter pastes it once and drops them, as Excel's Enter does. The Copy and
  Cut buttons on the ribbon and in the cell menu are the same commands as
  the keys.
- Paste reads what the clipboard carries. A block copied from Excel arrives
  with its values (the number, not the text `1,234.50`), its number
  formats, fonts, colours and fills, and its formulas: Excel's HTML says
  nothing about where a block was copied from, so a formula whose
  references all fall inside the block is kept and moved with the paste as
  if the block came from A1 (a totals column keeps totalling), and one that
  reaches outside the block lands as its value. A block from Google Sheets
  the same, with its R1C1 formulas turned into A1 for the cells they land
  in. Plain text lands as typed. One copied cell fills the
  selected range, and a block that fits the selection a whole number of
  times is repeated over it, as in Excel. One paste is one Ctrl+Z, formats
  included.
- Selecting works as it does in Excel. A click on a column letter or a
  row number selects the whole line and puts the active cell on its first
  visible row or column; a drag along the letters or the numbers selects a
  run; Shift+click extends the run from the active cell's line; Ctrl+click
  adds a line beside the selection; the corner selects everything and
  leaves the active cell where it was. Shift+Arrow grows a run of whole
  lines, an arrow collapses to the active cell, and typing lands in the
  active cell, so the keyboard never leaves the sheet. Shift+Space and
  Ctrl+Space take the whole rows or columns the selection touches, Ctrl+A
  the current region then the sheet, Ctrl+Shift+8 the region alone. A
  column or row selected whole paints its letter or number in the accent,
  white on green as Excel's; a line the selection merely touches is
  tinted. While a range is dragged out the Name Box reads "3R x 2C".
- The pointer reads as it does in Excel: the white cross over the cells,
  a black arrow down a column letter or along a row number, the
  double-headed arrows on the borders, the crosshair on the fill handle.
  Dragging a border shows Excel's tip beside the pointer, "Width: 8.43 (64
  pixels)" or "Height: 15.00 (20 pixels)", with a dotted guide across the
  sheet at the new edge; dragging the fill handle shows what the cell
  under the pointer will get (Feb, 7, 2026-09-18), in the source cell's
  number format.
- A General cell shrinks a number to its column before it hashes, as
  Excel's does: the decimals go first (5.333333 reads 5.3333, then 5.33),
  then a whole part too wide turns scientific (1.76E+04). A formatted
  number hashes as soon as its format does not fit, since the format said
  what to show.
- Right-click a column letter or a row number for its menu: the column or
  row is selected first, unless it was already inside the selection, and the
  menu offers Insert, Delete and Column Width... or Row Height... for that
  axis alone, as Excel's does.
- Right-click a cell for Excel's menu: Cut, Copy, Paste, Paste Special,
  Insert / Delete Rows and Columns, Clear Contents, Clear Formats, Merge &
  Center or Unmerge, the comment entries, Format Cells, each with the
  ribbon's icon for it so the two read as one set. Structure goes through
  the sheet's own insert and delete, which rewrite every formula the
  change reaches, move the formats with their cells, and undo as one step.
- The in-cell editor opens with the caret after the text and widens over
  the cells to its right as a long formula is typed. While a formula is
  being written, in the cell or in the formula bar, every range it refers
  to is outlined in its own colour, one rectangle per range, and the
  reference in the text takes the same colour, in the cell and in the bar:
  Excel's range finder. Colours go by distinct range in order of first
  appearance, so `B5:B8` twice is one colour and `b5`, `$B$5` and `B5` are
  one range. `referenceSpans(text)` is the rule, exported.

## The ribbon is Excel's ribbon

The layout is Excel's, down to the geometry: a group is three rows of 24px,
a **large** button (icon over label) fills a column of that height and
**small** buttons stack three to a column, so Cut / Copy / Format Painter
line up beside a tall Paste, as icons alone the way Excel draws them. The
Home tab runs Clipboard, Font, Alignment, Number, Cells, Styles, Editing in
Excel's order, with Excel's names on the buttons (Undo and Redo open the
Editing group as a column of small icons), a dialog-box launcher in the corner of the groups that have a
dialog, and the group label underneath, which is what makes a ribbon read
as a ribbon rather than a toolbar.

Some things worth knowing are in there because Excel users reach for them
without looking:

- **Paste is Excel's split button.** The icon pastes; "Paste" with its
  chevron under it opens the kinds: Paste, Formulas, Values, Formatting,
  Transpose, and Paste Special... at the end, each raised as an action
  (`paste-formulas`, `paste-values`, `paste-formats`, `paste-transpose`,
  `paste-special`) that the shell answers through its Paste Special engine.
- **Format Painter is the brush.** Select the cells whose look you want,
  press the brush, and the next click or drag takes it, as one undo: a
  single cell takes the whole block from that corner, a dragged range has
  the block tiled over it, and a cell whose source had no format loses its
  own, as in Excel. The button reads pressed while the brush is up, the
  pointer is a brush over the cells, Enter paints onto the current
  selection, and Escape or the button again puts it down. Raised as
  `format-painter`.
- **Fill Colour, Font Colour and Borders are split buttons.** The face
  re-applies the last pick (yellow and red to start, as in Excel); the arrow
  opens the menu. The colour menus are Excel's picker: the theme row, five
  tints and shades under each colour, then the standard colours. Borders
  applies to the *selection* the way Excel does: Bottom Border lines the
  bottom edge of the block, All Borders lines every cell, Outside frames it.
- **The combos show the cell.** Font, size and number format read the
  active cell, so a 17px title says 17 even though 17 is not on the list.
- **Every format change is one Ctrl+Z**, through the grid's own history,
  so the ribbon's Undo lights up after Bold and undoing it puts the cell's
  whole entry back. A command that writes cells and formats together is
  still one press.
- **Paste pastes.** It reads the system clipboard the way Ctrl+V does, so
  it needs a secure context; elsewhere it stays quiet, as Ctrl+V does.

**It is responsive the way Excel's is, in Excel's two steps.** When the
band is narrower than its groups, the groups go compact from the right
first: their small buttons keep the icon and drop the label, so Fill Down
becomes an arrow and Wrap Text a glyph, with the title still in the
tooltip. Only when every group is compact and the band is still too
narrow do groups fold, again from the right, into one large button each
(the group's own icon over its name and a chevron) that opens the group in
a dropdown. Nothing is hidden, only folded; widen the window and it all
comes back in the same order. Every width is measured off an invisible
copy of the band, never estimated, so a group folds exactly when it would
not fit. On a phone the folded band scrolls sideways.

**It collapses the way Excel's does.** Double-click a tab, press the
chevron at the band's end, or Ctrl+F1, and the band goes away leaving the
tab row. A click on a tab then shows that tab's band over the sheet until
a command runs, Escape, or a click elsewhere; the pin at its end, a
double-click or Ctrl+F1 brings the band back for good. The state is the
`collapsed` prop of `SvSheetRibbon`, bindable, and the action is raised
as `toggle-ribbon` so `onAction` can watch or take it over.

## The ribbon and the keyboard are the same thing

Click a bold cell and the Bold button lights up. Press `Ctrl+B` and it goes
out. Neither is reacting to the other: both call one function in
`sheet/shortcuts.ts`, and the button's pressed state is read from the format
store rather than tracked separately.

That is why `sheet/ribbon.ts` is a table of data rather than markup. An item
either carries a `run` that calls a real action, or an `emits` naming
something the ribbon cannot do alone:

```ts
{ id: 'bold', label: 'B', title: 'Bold', keys: 'Ctrl+B',
  kind: 'toggle',
  run: (cmd) => toggleFormat(cmd, 'bold'),
  isOn: (cmd) => everyCellHas(cmd, (e) => e?.bold === true) }
```

Buttons that open a dialog set `emits` and raise an action. Every action
reaches your `onAction` handler first; return `true` to take it over,
otherwise the shell's own dialog opens:

```svelte
<SvSheet
  {wb}
  onAction={(action, cmd) => {
    if (action === 'goal-seek') { openMyGoalSeekDialog(cmd); return true }
  }}
/>
```

The shell answers everything on the ribbon itself: `recalculate`,
`toggle-formulas` (Excel's `Ctrl+` `` ` ``), `toggle-filter`, `sort-asc` /
`sort-desc` / `sort-custom`, and the dialogs listed below. One button has
nothing behind it in the library, Insert > Table, and is left off the
ribbon unless `extras={['insert-table']}` says the application answers it.

## Props

| Prop | Default | What it does |
| --- | --- | --- |
| `document` | one built from `workbook` or `data` | The sheet document: the workbook plus every sheet's formats, sizes, hidden lines, frozen panes, comments, protection, validation and conditional formatting. Build it with `createSheetDocument` to save, restore or listen to it outside the component. |
| `workbook` | a new empty one | The workbook to edit, when not supplying a document. |
| `data` | | Seed sheets, when not supplying a workbook. |
| `rows` / `columns` | 50 / 12 | Minimum size, so a sparse sheet still looks like a sheet. |
| `height` | 420 | Grid viewport height. |
| `columnWidth` | 96 | Default column width. |
| `rowHeight` | 22 | Row height. Excel's is 20 at 100%; 22 fits the 13px cell font. |
| `look` | `'theme'` | `theme` paints the shell with the host's `--sg-*` tokens, so it follows the app's theme; `excel` pins Excel's own palette and geometry, light or dark with the page. |
| `columnWidths` | | Per-column overrides keyed by letter: `{ A: 150 }`. |
| `formats` | | Cell formats keyed by address: `{ B2: { bold: true } }` for the sheet active at mount, `{ 'Orders!F2': ... }` for another sheet. |
| `showRibbon` / `showFormulaBar` / `showTabs` / `showStatusBar` | `true` | Hide any part of the chrome. |
| `onAction` | | Every ribbon action, first; return `true` to take one over. |
| `extras` | `[]` | Whether to show Insert > Table, because the application answers it. |
| `commentAuthor` | | Who signs a new comment and a reply, with the time; unset, a new comment is a plain note. |
| `localization` | | `{ locale, text }`: the language of the chrome. `text` overrides any of the shell's strings (see [Localisation](#localisation)); `locale` formats the status bar's numbers and reaches the grid underneath. |
| `onReady` | | The `SvGridApi` and the document, once the grid has mounted. |
| `onChange` | | Every change the user lands, once per tick: `cells`, `formats`, `sizes`, `hidden`, `freeze`, `sheets`, `comments`, `protection`, `page-setup`, `objects`, `validation`, `conditional-formats`, `structure` (with the insert or delete), `restore`. Undo and redo report too. |

`formats` matters more than it looks: without it a sheet can only be
formatted by hand after it loads, which makes it impossible to ship a
document that opens the way it was saved.

A bare address formats the sheet that is active when the shell mounts.
Qualify it to reach another sheet, the way a formula would - `Orders!F2`,
or `'Price list'!C2` when the name has a space:

```svelte
<SvSheet
  workbook={wb}
  columnWidths={{ A: 150 }}
  formats={{
    A1: { bold: true, fill: '#e2e8f0', color: '#0f172a' },
    E2: { numFmt: '#,##0' },
    B13: { numFmt: '0.0%' },
    'Orders!F2': { numFmt: '$#,##0.00' },
  }}
/>
```

<div data-docs-demo="456-sales-report-workbook" data-height="600"></div>

## Files

The File tab is the part of Excel's a document in a page can do: New,
Open, Save As, Export CSV and Print. Open takes an .xlsx from disk and replaces
the document with everything the file holds that the document keeps
(cells with their formulas, formats, widths and heights, hidden lines and
sheets, frozen panes, merges, the filter region, validation, conditional
formatting, protection, comments, names, the active sheet); Save As
downloads the document as an .xlsx that Excel and Google Sheets open with
the same parts; Export CSV downloads the active sheet as its cells show;
New starts over with one empty sheet, asking first when the sheets hold
anything; Print (Ctrl+P) opens the active sheet in the browser's print
dialog as its Page Layout says (below). `documentToXlsx` and
`documentFromXlsx` are the two halves, in `@svgrid/enterprise/sheet`, and
need the `jszip` peer.

An app that keeps its workbooks somewhere other than the user's disk takes
the actions over through `onAction` (`file-open`, `file-save-xlsx`,
`file-new`, `file-export-csv`, `file-print`) and calls the component's
own methods: `open(file)` replaces the document with an .xlsx Blob,
`toXlsx()` returns the document as a Blob, `toCsv()` the active sheet as
text, `newWorkbook()` empties it, `print()` opens the print dialog and
`printHtml()` returns the page it would print, for an app that prints
its own way.

```svelte
<SvSheet bind:this={sheet} onAction={(action) => {
  if (action === 'file-save-xlsx') { sheet.toXlsx().then((blob) => upload(blob)); return true }
  if (action === 'file-open') { pickFromServer().then((blob) => sheet.open(blob)); return true }
}} />
```

Dates are `yyyy-mm-dd` text in the sheet and serial numbers in the file:
a text date goes out as a serial under a date format, and a serial under a
date format comes back as text. Tables, charts and images are not carried
either way.

## Page Layout and Print

The Page Layout tab is Excel's Page Setup group and Sheet Options, per
sheet and part of the document: Margins (Normal, Narrow, Wide),
Orientation, Size (Letter, Legal, Tabloid, A3, A4, A5), Print Area (Set
takes the selection, Clear puts the whole sheet back), Print Titles (the
rows that repeat at the top of every page), the group's launcher opening
the Page Setup dialog with all of it and the scale, and Print Gridlines
and Print Headings. Each change is one undo and reports
`{ kind: 'page-setup' }`.

File > Print (Ctrl+P) lays the sheet out as one HTML document and hands it
to the browser's own print engine, so fonts, CJK and RTL come out right
and nothing is bundled: the print area or the used range, column widths
and row heights as the sheet shows them, hidden lines left out, merges as
spans, every cell as it shows with its format and its conditional style,
the title rows repeated on each page, gridlines and headings when asked,
and the orientation, paper and margins in `@page`. "Save as PDF" in that
dialog is the PDF. The setup rides in `getState()` as `pageSetup` and in
the xlsx as `pageSetup`, `pageMargins`, `printOptions` and Excel's own
`Print_Area` and `Print_Titles` names, both ways.

## Saving and restoring

Everything the user does lands in the sheet's document: the workbook (raw
text, formulas as typed, names, the active sheet), and per sheet the
formats (locked flags included), column widths, row heights, hidden lines,
frozen panes, comments, the protection flag with its allow list and edit
ranges, the page setup, the charts and pictures on the sheet, the
validation rules and the conditional formatting rules.
`getState()` returns it as plain JSON and
`setState()` puts it back into the same workbook object, so an autosave
is an `onChange` handler and a reload is one call after mount:

```svelte
<script lang="ts">
  import { SvSheet, type SheetState } from '@svgrid/enterprise'

  let sheet = $state<SvSheet>()
  let timer: ReturnType<typeof setTimeout> | undefined

  function autosave() {
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (sheet) localStorage.setItem('budget', JSON.stringify(sheet.getState()))
    }, 400)
  }

  const saved = localStorage.getItem('budget')
</script>

<SvSheet
  bind:this={sheet}
  onChange={autosave}
  onReady={() => { if (saved) sheet?.setState(JSON.parse(saved) as SheetState) }}
/>
```

`onChange` is called once per tick with every reason since the last call,
so a paste of forty cells is one call, and it says what changed
(`reasons.some((r) => r.kind === 'structure')` for an insert or delete, with
the edit on the reason). `setState` clears the grid's undo history, since
none of it describes the restored sheet, and reports a single `restore`.

The same document is available outside the component: build it with
`createSheetDocument({ sheets })` or `createSheetDocument({ state })`, pass
it as `document`, and call `document.getState()`, `document.setState()` and
`document.subscribe()` on it directly. A document built this way can be
saved and restored in Node, with no component at all.

The shape, `SheetState` (exported with `SheetStateEntry`, `ValidationRule`
and `CfRule`):

```ts
{
  version: 1,
  workbook: { sheets: [{ name, cells }], active, names },
  sheets: {
    Budget: {
      formats: { 'r0 A': { bold: true, numFmt: '#,##0', locked: false } },
      columnWidths: { A: 150 },
      rowHeights: [[4, 44]],
      hidden: { rows: [7], cols: [] },
      freeze: { rows: 1, cols: 0 },
      comments: { r1: { B: 'Check with finance' }, r4: { D: { text: 'Over budget?', author: 'Ana', at: '2026-03-04T10:00:00.000Z', replies: [{ text: 'By 3%', author: 'Ben', at: '2026-03-04T11:00:00.000Z' }] } } },
      protected: false,
      protection: { allow: { formatRows: true }, ranges: [{ id, title: 'Inputs', rects: [[1, 1, 9, 1]] }] },
      pageSetup: { orientation: 'landscape', paper: 'A4', margins: { top: 0.75, bottom: 0.75, left: 0.7, right: 0.7, header: 0.3, footer: 0.3 }, printArea: null, printTitleRows: [0, 0], gridlines: false, headings: false, scale: 100 },
      objects: [{ id, kind: 'chart', anchor: { row: 12, col: 1, dx: 8, dy: 8, width: 420, height: 260 }, range: [0, 0, 11, 2], type: 'bar', headers: true, series: 'columns' }],
      merges: [],
      validation: [{ id, rects, allow: 'whole', operator: 'between', value1: '1', value2: '10', ignoreBlank: true, inCellDropdown: false, alert: { style: 'stop' } }],
      conditionalFormats: [{ id, rects, kind: 'cellIs', operator: 'greater', value1: '50000', style: { fill: '#FFC7CE', color: '#9C0006' } }],
    },
  },
}
```

Rows are `r` plus the 0-based index and columns are letters, a format key is the two with a
space between; rectangles are `[minRow, minCol, maxRow, maxCol]`,
0-based. A hidden row keeps the height it had before it was hidden, not
the 0 it shows while hidden, so an Unhide after a restore brings it back
at its size.

## A component, not a mode

Kanban, the scheduler and charts are modes of `<SvGrid>` (`board`,
`scheduler`, `chart`) because they are different pictures of the same
rows: the grid keeps the data, the row model, sorting and filtering, and the
mode draws cards, a calendar or a chart from them. The spreadsheet is the
other way round: the same picture, a table, over a different data model. It
owns a document (formulas, address-keyed formats, comments, rules) and uses
the grid as its rendering primitive, which is why it is a component that
composes `<SvGrid>` rather than a prop on it. `installEnterprise()` enables
it along with everything else; there is nothing extra to register.

## Rows into a sheet

`sheetCellsFromRows(rows, fields, { totals })` turns an array of records
into the cells `data` or `createWorkbook` take: a header row of labels, a
row per record with each value as the text the engine reads (a number as
its digits, a boolean as `TRUE` or `FALSE`, a `Date` as `yyyy-mm-dd`,
nothing for null), and with `totals` a last row with `=SUM(...)` under
every column that held a number. It is how a grid's rows, or an API's,
become a sheet the user can add formulas to; Studio's Spreadsheet block
is this over the screen's dataset.

```svelte
<script lang="ts">
  import { SvSheet, sheetCellsFromRows } from '@svgrid/enterprise'

  const cells = sheetCellsFromRows(orders, [{ field: 'item', label: 'Item' }, 'qty', { field: 'price', label: 'Price' }], { totals: true })
</script>

<SvSheet data={[{ name: 'Orders', cells }]} />
```

## Writing to the workbook from outside

Every edit made through the shell repaints it: typing, the ribbon, a
shortcut, the fill handle, and `cmd.setCellValue` from an `onAction`
handler, which is also how a dialog should write a cell - the write lands in
the grid's undo history and the shell sees it.

A write the shell cannot see does not repaint: a Name Manager redefining a
name, an import replacing a sheet, a solver applying its answer with
`wb.setRaw`. Call `refresh()` on the component afterwards:

```svelte
<script>
  let sheet
</script>

<SvSheet bind:this={sheet} workbook={wb} onAction={(action, cmd) => {
  if (action === 'name-manager') { openNameManager(wb.names, () => sheet.refresh()); return true }
}} />
```

`act(action)` runs a ribbon action as if its button had been clicked
(`sheet.act('sort-asc')`, `sheet.act('circle-invalid')`), for a host with
chrome of its own; what the ribbon would raise for `onAction` is raised
here too.

The shell carries Goal Seek, Text to Columns, Remove Duplicates and the
Name Manager itself. The demos below each replace one with a dialog of
their own, returning `true` from `onAction`, and show the write paths a
replacement should use: Goal Seek applies through `cmd.setCellValue`, Text
to Columns and Remove Duplicates write inside `cmd.batch` so each is one
Ctrl+Z, and the Name Manager calls `refresh()`.

<div data-docs-demo="457-goal-seek" data-height="600"></div>

<div data-docs-demo="458-data-cleanup" data-height="560"></div>

## Theming

Every part of the shell is painted with the grid's `--sg-*` tokens, so
by default it follows the app's theme the way the grid does: the accent
on the selection and the active tab, the header and ribbon grounds, the
font and the corner radius are the host's. The icons are one set of line
glyphs drawn in the text colour, black on a light ribbon and white on a
dark one, as Excel's monochrome set is; the only colour on the ribbon is
the bar under Fill Colour and Font Colour, which is the colour the button
will apply.

`look="excel"` pins Excel's palette instead: the shell sets the tokens on
its own root to Office's light theme, or its dark theme when the page is
dark, so it reads as Excel whatever theme the app around it runs, and the
grid inside picks the same tokens up. Nothing else changes: the geometry,
the icons and the layout are the same either way.

## Using the parts separately

`SvSheet` is a composition of exported components, so anything it does you
can do by hand when you want a different arrangement:

```svelte
<SvSheetRibbon cmd={() => api?.getCommandContext() ?? null} onChange={refresh} />
<SvFormulaBar {active} value={raw} onCommit={commit} />
<SvGrid ... />
<SvSheetTabs workbook={wb} {version} onChange={refresh} />
```

`api.getCommandContext()` is the seam that makes this work. A keyboard
command is handed a context on every keystroke; a ribbon button has no
keystroke to ride in on, and without it every action would have to be
re-implemented against the public api and kept in step by hand.

Formulas > Formula Auditing has Excel's arrows: Trace Precedents draws
a blue arrow from each cell the active formula reads to the formula, a
dot on the cell read and an arrowhead on the formula, and pressing it
again traces one more level out; Trace Dependents draws the arrows the
other way, to the formulas that read the active cell, every formula in
the workbook counted whether or not it has been on screen; Remove Arrows
clears them, as does a switch to another sheet. Cells on other sheets are
left out, since there is nothing on this sheet to draw to. The arrows
are measured from the rendered cells and follow every scroll and
repaint; they are not part of the document. `wb.precedents(sheet, row,
col)` and `wb.dependents(sheet, row, col)` are the two readings on the
workbook. Raised as `trace-precedents`, `trace-dependents` and
`remove-arrows`.

## The dialogs

Four of Excel's dialogs are the shell's own, so nothing on the ribbon or in
the cell menu is a button that does nothing:

| Dialog | Opens from |
| ------ | ---------- |
| Find and Replace | `Ctrl+H`, Find & Select on the ribbon. Find Next, Find All, Replace, Replace All; match case, whole cell, look in values or formulas. Replace All is one undo. |
| Paste Special | `Ctrl+Shift+V`, the Clipboard group's launcher, the last entry under the Paste arrow, the cell menu. All / Formulas / Values / Formats, Add / Subtract / Multiply / Divide, Skip blanks, Transpose. Works on what Ctrl+C took from the sheet. |
| Chart | A double-click on a chart, or Insert > Setup while one is selected. Type (Column, Line, Area, Pie, Scatter), title, series in columns or rows, whether the first row and column are labels, stacking; Delete removes the chart. |
| Page Setup | Page Layout > Print Titles, the Page Setup group's launcher. Orientation, paper, margins, scale, print area, rows to repeat at top, gridlines and headings; Print... applies and prints. |
| Protect Sheet | Review > Protect Sheet. Excel's "allow all users of this worksheet to" list; OK protects with what is ticked. |
| Allow Edit Ranges | Review > Allow Edit Ranges. Titled blocks that take an edit on a protected sheet; New over the selection, Modify, Delete, Protect Sheet... |
| Format Cells | `Ctrl+1`, the launchers on the Font, Alignment and Number groups, the cell menu, and the end of Home > Cells > Format. Number (category, decimals, separator, the Accounting symbol, the Special type, custom code, live sample), Alignment, Font, Border presets, Fill, Protection. Opens on the active cell's format and applies only what was changed to the whole selection, as one undo. |
| Insert Function | the `fx` button. Search or pick a category, read the signature and what the function does; OK starts the cell on `=NAME(` with the caret inside. |
| Name Manager | Formulas > Name Manager, `Ctrl+F3`. Every defined name with what it refers to and its value; edit, delete, add. |
| Goal Seek | Data > Goal Seek. Set a formula cell to a value by changing one input; the status page shows the answer and OK keeps it as one undo. |
| Sort | Data > Sort. A level per key, each a column (named from the header row when "My data has headers" is on, as Excel guesses it) and an order; Add Level and Delete Level; the block is the selection or the region around the active cell. Numbers sort before text, blanks go last, ties keep their order, formats and one-row merges ride with their rows, and it is one undo. Sort A to Z and Z to A beside it sort on the active cell's column. |
| Text to Columns | Data > Text to Columns. The delimiter is guessed from the column, the preview shows the split, Finish writes it as one undo. |
| Remove Duplicates | Data > Remove Duplicates. Tick the columns that decide a duplicate, say whether the first row is headers; the count goes to the status bar. |
| Data Validation | Data > Data Validation. Settings (Allow, Data, the bounds or the source, Ignore blank, In-cell dropdown) and Error Alert (Style, Title, Message); OK puts one rule over the selection, Clear All removes it. See Data validation below. |
| Conditional formatting | Home > Styles > Conditional Formatting: Greater Than..., Less Than..., Between..., Equal To..., Text that Contains..., Duplicate Values..., Top 10 Items..., Bottom 10 Items..., Above Average..., Below Average... and New Rule > Use a Formula... each open the small dialog (the value or values, or the formula, and the "with" style); Manage Rules... opens the Rules Manager. See Conditional formatting below. |

Home > Cells > Format is Excel's menu: Row Height..., AutoFit Row Height,
Column Width... and AutoFit Column Width for the rows and columns the
selection spans (`row-height`, `autofit-rows`, `column-width`,
`autofit-columns`; an AutoFit is one undo), Hide Rows, Hide Columns, Unhide
Rows and Unhide Columns with their keys, Lock Cell under Protection (a
toggle, lit while the active cell is locked, raised as `toggle-lock`), and
Format Cells... at the end. A ribbon item of kind `dropdown` is that shape:
the face opens the list and every entry raises its own action.

### AutoFilter

Excel's Filter: Ctrl+Shift+L, Home > Editing > Filter or Data > Filter puts
an arrow on every header cell of the current region (the block around the
active cell, its first row the headers; a selected range is the region
instead). An arrow drops Excel's menu: Sort A to Z and Z to A (Smallest to
Largest on a column of numbers), Clear Filter From the column, Filter by
Color when the column's cells carry more than one fill (its own or a
conditional format's, No Fill included), Date Filters on a column of
dates (Today, This Week, Last Month, This Quarter, Year to Date and the
rest, or Equals, Before, After and Between with a typed date; weeks run
Sunday to Saturday), Top 10 on a column of numbers (top or bottom, so
many items or so many percent, counted over the whole column), Text
Filters or Number Filters (equals, does not equal, begins with, contains,
greater than, between and the rest, two of them joined with And or Or), a
search box, (Select All) and the column's values with their counts, the
blanks last. A search narrows the list and OK (or Enter in the box)
applies what it shows, as Excel does; Alt+Down on a header cell drops the
menu. OK folds the rows that fail; the arrow turns into a funnel,
the row numbers of the region turn blue and the status bar reads "N of M
records found". A folded row is the filter's, not a hidden row: Unhide
leaves it, `getState().hidden` leaves it out, and Filter off (Ctrl+Shift+L
again) shows it while a row hidden by hand stays hidden. The rows are
worked out again after every change, so a formula that drops out of a
Number Filter folds away and one that comes back returns, as Excel's
Reapply would; a sort from the menu keeps the header row where it is.
Conditions run through the grid's own Excel-filter compiler
(`@svgrid/grid/filtering`), so the operators are the ones the grid's
filter row has. The filter is per sheet, moves with an insert or delete,
rides in `getState()` as `autoFilter` (`{ range, filters }`, a filter
being `values`, `condition`, `date`, `color` or `top`) and reports
`{ kind: 'filter' }` on `onChange`. Raised as `toggle-filter`.
`hiddenRowsFor` takes a `fillAt` reader for the colour filters and a
`today` for the date periods; `datePeriodBounds` is the calendar on its
own.

### Merged cells

Excel's Merge & Center, on Home > Alignment as Excel's split button: the
face merges the selection into one cell and centres it, the arrow opens
Merge & Center, Merge Across (one merge per row), Merge Cells (no centring)
and Unmerge Cells; the cell menu offers Merge & Center on a range and
Unmerge Cells on a merge, and Merge & Center on a merged cell unmerges it.
A merge keeps the top-left cell's value and drops the rest, so a merge
over values asks first, with Excel's words; the clears, the centring and
the merge are one undo. The grid draws a merge as one cell (its
`mergedCells`): it is selected as one, the arrow keys step over it, a
click anywhere on it lands on its top-left cell, which is what the formula
bar shows and an edit writes, and the covered cells take no entry, fill or
paste. A merge moves with an insert or delete (and grows when rows are
inserted inside it), a one-row merge rides with its row through a sort,
and a sort over a range a merge crosses is refused with Excel's sentence.
Merges are per sheet, ride in `getState()` as `merges`
(`[minRow, minCol, maxRow, maxCol]`) and report `{ kind: 'merges' }` on
`onChange`. Raised as `merge-center`, `merge-across`, `merge-cells`
and `unmerge-cells`.

### Conditional formatting

Excel's rules that colour cells by what they hold, on Home > Styles >
Conditional Formatting. Highlight Cells Rules (Greater Than, Less Than,
Between, Equal To, Text that Contains, Duplicate Values) and Top/Bottom
Rules (Top 10 Items, Bottom 10 Items, Above Average, Below Average) open
the small dialog: the value or values (a literal or a formula, so
`=$B$1` follows B1) and the "with" style, Excel's Light Red Fill with
Dark Red Text and the rest. Data Bar, the Green - Yellow - Red and Green -
White Color Scales and the Icon Set (3 Arrows) apply to the selection at
once; a data bar measures from zero, as Excel's do, so 10, 20 and 40 draw
a quarter, a half and the full width. Clear Rules from Selected Cells cuts the selection out of every rule
it touches; Clear Rules from Entire Sheet empties the sheet's rules.
Manage Rules... is the Rules Manager: every rule in priority order with what
it does, a sample and where it applies, Edit Rule (for the rules the
dialog can edit), Delete Rule, Move Up, Move Down and Stop If True, for
this worksheet or the current selection; OK applies the lot as one undo.

Rules are evaluated over the COMPUTED values, so a Greater Than on a
column of formulas follows their results and a cell drops out when an
input changes. Priority is the Rules Manager's order (a new rule goes
first, as in Excel): the first rule that decides a property (the fill,
the text colour, the bar, the icon) keeps it, and a rule with Stop If True
stops the rules below it for the cells it matches. A rule's fill and text
colour paint over the cell's own format, as they do in Excel. The rules
are per sheet, move with an insert or delete, ride in `getState()` as
`conditionalFormats` and report `{ kind: 'conditional-formats' }` on
`onChange`.

New Rule > Use a Formula... is Excel's "format values where this formula
is true": the formula is written for the top-left cell of the selection
and moves with each cell as a copied formula would, so `=$B2>100` on
A2:A9 reads each row's B, and TRUE (or a number other than 0) formats.
The rule is `{ kind: 'formula', formula, style }`. A data bar over a range
with negatives puts its axis where zero falls between the minimum and the
maximum, and the bars grow away from it: right for a positive value, left
and in red (or the rule's `negativeColor`) for a negative one. `evaluateCf`, `ruleStats`, `removeCf`, `shiftCf`,
`describeCf` and the rule types are exported from
`@svgrid/enterprise/sheet`; the grid's own value-driven
[conditional formatting](./conditional-formatting.md) is a different thing
(rules by column over raw values) and the shell does not use it.

Freeze Panes lives on the View tab, Excel's dropdown: Freeze Panes (at the
active cell), Freeze Top Row, Freeze First Column, Unfreeze Panes
(`freeze-panes`, `freeze-top-row`, `freeze-first-column`,
`unfreeze-panes`). Beside it, View > Show has Excel's three toggles:
Gridlines, Formula Bar and Headings (the row numbers and column letters),
raised as `toggle-gridlines`, `toggle-formula-bar` and
`toggle-headings`. They are view settings of the component, not part of
the document, so `getState()` leaves them out.

### Data validation

Excel's rules over cells: Data > Data Validation opens on the rule at the
active cell and puts one over the selection. Allow is Any value, Whole
number, Decimal, List, Date, Text length or Custom; the bounds (between,
not between, equal to, greater than and the rest) are literals or
formulas, so `=$B$1` as a maximum follows B1 and a relative `=A2` on
G2:G17 reads the same row's A, as in Excel; a List is a comma list or a
range or a name starting with `=`; a Custom formula is written for the
top-left cell of the selection and moves with each cell, TRUE (or a number
other than 0) allowing the entry. A typed entry that breaks the rule never
reaches the workbook: the alert box shows the rule's title and message (or
Excel's own words) with Retry, which reopens the editor with the entry,
and Cancel; a Warning rule asks "Continue?" and Yes lets the entry through.
The formula bar is checked the same way. Only typed entries are checked,
as in Excel: paste, fill, Ctrl+D and the commands write what they are
given.

A List rule with In-cell dropdown draws an arrow on the active cell; the
arrow, or Alt+Down, drops the list (arrows and Enter pick, Escape leaves
the cell alone), and a pick is one undo. A typed entry is matched against
the list without regard to case.

The dialog's Input Message tab gives a rule a title and a message that
show in a small box under the cell while it is selected, as Excel's do;
the rule carries it as `input`. The arrow beside Data Validation has
Circle Invalid Data, which draws Excel's red oval on every cell under a
rule whose current contents break it (pasted, filled or written before the
rule was), and Clear Validation Circles. The circles are worked out again
on every repaint while they are on, so a corrected cell loses its circle
at once; switching sheets turns them off. `invalidCells` is the same check
for a shell of your own. Raised as `circle-invalid` and `clear-circles`.

The rules are per sheet, move with an insert or delete (and drop when
their cells go), ride in `getState()` as `validation` and report
`{ kind: 'validation' }` on `onChange`. `ruleAt`, `checkEntry`,
`listChoices`, `removeValidation` and `shiftValidation` are exported
from `@svgrid/enterprise/sheet` for a shell of your own, with
`wb.evaluateText` and `wb.evaluateRange` evaluating a bound or a list
source in the sheet without storing it. Raised as `data-validation` and
`open-list`.

### Objects: charts and pictures

Insert > Chart charts the selected block: the first row and column are
read as the labels when they look like labels, each column of the block
is a series, and the chart is anchored just under the block. It reads the
**range**, not a copy of the numbers, so editing a cell redraws it.
Insert > Picture puts an image on the sheet from a file, carried in the
document as a data URL.

An object floats over the cells rather than living in them: drag it to
move, drag its corner to resize, press Delete to remove it, and
double-click a chart (or Insert > Setup) to open the Chart dialog. Each
change is one undo. It hangs from a cell and an offset inside it, the way
Excel's does, so inserting a row above moves it, deleting that row takes
it with it, and resizing a column under it moves it without reshaping it.

Objects are per sheet, ride in `getState()` as `objects` and report
`{ kind: 'objects' }` on `onChange`. The chart's own drawing is the free
`<SvChart>` from `@svgrid/grid`, so its types, palette and tooltips are
the grid's. Raised as `insert-chart`, `insert-picture`, `chart-setup`
and `delete-object`, so an application can put its own chart builder in
their place.

Objects do not ride in the .xlsx, in either direction: Save As writes the
cells, the formats and the rules, and a chart or a picture in a file that
is opened is left behind.

### PivotTable from a range

Insert > PivotTable summarises the selected block on the same pivot engine
the grid uses for its own pivot mode. The dialog takes the source block
(its first row the field names), where the result goes, and which field is
a row, a column or a measure, with Sum, Average, Count, Distinct count,
Min and Max to summarise by.

What the sheet keeps is the **definition**; what it writes is **cells**. A
pivot's result is an ordinary block, so it can be formatted, charted,
filtered, printed and saved to an .xlsx like anything else you typed.
Insert > Refresh rebuilds it from the source and clears whatever the last
one wrote, which is what a pivot over live cells owes the user. With the
cursor inside a written block, Insert > PivotTable opens the dialog on
that pivot instead of making another, so moving a field or changing an
aggregation is two clicks. Each write is one undo, cells and definition
together.

Pivots are per sheet, ride in `getState()` as `pivots` and report
`{ kind: 'pivots' }` on `onChange`. The definition moves with an insert or
a delete, and is dropped when its source or its target cell is deleted.
Raised as `insert-pivot` and `refresh-pivot`.

With one measure the block is Excel's compact form: the column values
carry the corner label, the row labels run down the first column indented
by level, and the grand total row and column can be turned off in the
dialog. With two or more measures each column value gets one column per
measure, under a header row naming them.

### Sparklines

Excel's smallest chart, and the one that is not an object: a sparkline IS
the cell. Insert > Sparklines offers Line, Column and Win/Loss, each
opening the Create Sparklines dialog on the selected block with the data
range filled in and the location the column just past it. One sparkline
is drawn per row of the data (per column, when the location is a row),
read from the range rather than a copy of it, so editing a number redraws
the cell.

They are kept per GROUP, the way Excel keeps them: a data range, a
location range of the same shape and the settings they share. So

- selecting a cell that holds one turns the three kind buttons into a
  change to that group, Excel's Sparkline tab in one press;
- Insert > Sparklines > Edit reopens the dialog on the group here, for
  its ranges, its colours, whether the whole group is drawn on one value
  scale and whether a line marks its last point;
- Insert > Sparklines > Clear removes every group the selection touches.

Each of those is one undo. A group moves with an insert or a delete, and
goes when the cells it is drawn in, or the cells it reads, are deleted.
Sparklines are per sheet, ride in `getState()` as `sparklines` and report
`{ kind: 'sparklines' }` on `onChange`. The drawing is the free
`<SvSparkline>` from `@svgrid/grid`. Raised as `sparkline-line`,
`sparkline-column`, `sparkline-winloss`, `sparkline-setup` and
`clear-sparklines`.

A sparkline is behind whatever the cell shows, so a label typed over one
still reads, and the pointer goes through it: the cell is selected,
dragged and edited as a cell. Like the objects above, sparklines do not
ride in the .xlsx, and File > Print leaves them out, since the printed
page is built from what each cell says.

```svelte
<script>
  const doc = createSheetDocument({ workbook: wb })
  doc.get('Traffic').sparklines = [{
    id: sparklineId(),
    data: [1, 1, 4, 12],        // B2:M5, one row per channel
    location: [1, 13, 4, 13],   // N2:N5, the cells they are drawn in
    type: 'line',
    markers: true,
  }]
</script>
```

### Comments

Excel's notes and its threaded comments: a text on a cell, marked by a red
corner and read by hovering the cell, and under it the replies, each with
its author and time. Review > New Comment, Shift+F2 and the cell menu's
New Comment open the box beside the active cell; for a new comment it is
the note editor, and Ctrl+Enter or Save closes it, as does Escape or a
click elsewhere, keeping what was typed, as Excel keeps a note. On a cell
that has one, the box is the thread: the first entry with Edit and Delete,
the replies with theirs, a reply box (Ctrl+Enter posts) and Resolve in the
head, which greys the thread in the list and hides the reply box until
Reopen. Delete (on Review, in the box, in the cell menu) removes the whole
thread; Previous and Next walk the sheet's comments row by row and wrap;
Show All Comments opens a strip under the formula bar listing every
comment with its author, each a jump to its cell, which is the honest form
over a sheet that only paints the rows in view. Every change is one undo.

`commentAuthor` is who signs: with it set, a new comment and every reply
carry that name and the time, the way Excel signs a threaded comment with
the signed-in user; without it a new comment is a plain note and a reply
carries its time alone. Comments are per sheet, move with an insert or
delete, ride in `getState()` as `comments` (`r4` -> `B` -> a note's text,
or `{ text, author, at, replies, resolved }` for a thread; every document
saved before threads existed reads as it did) and report
`{ kind: 'comments' }` on `onChange`. Save As writes a note as Excel's
legacy note and a thread as its threaded comment with the persons part,
and Open reads both. Raised as `new-comment`, `edit-comment`,
`delete-comment`, `prev-comment`, `next-comment` and `toggle-comments`.

### Protection

Excel's model, without the password. Every cell is locked to begin with;
Format Cells > Protection (or Format > Lock Cell) unlocks the ones that may
change; Review > Protect Sheet turns the flags on. From then on a locked
cell refuses to change wherever the change comes from: typing, F2, Delete,
the formula bar, paste, a fill, Ctrl+D, Find and Replace (which skips it),
a sort of the region, and the formats (the Font, Alignment and Number
buttons grey out while the selection holds a locked cell, and Ctrl+B
declines). Insert and Delete grey out for the whole sheet, so do Row
Height, Column Width, AutoFit, Hide and Unhide, and the resize handles go
away. The refusal is a sentence in the status bar, Excel's own: "The cell
you're trying to change is on a protected sheet. To make a change,
unprotect the sheet." Unlocked cells take every edit as before.

Protect Sheet opens Excel's dialog with its "allow all users of this
worksheet to" list: format cells, format columns, format rows, insert
columns, insert rows, delete columns, delete rows, sort, use AutoFilter.
What is ticked stays open once the sheet is protected: with Format cells
the Font, Alignment and Number buttons, Format Cells, merges and Lock
Cell work on every cell; with Format rows or columns Row Height, Column
Width, AutoFit, Hide and Unhide and the resize handles come back for that
axis; the insert and delete entries open Home > Cells > Insert and Delete
for their axis; Sort allows a sort of a block that holds no locked cell,
as Excel's does (a block with one is refused whatever the tick); Use
AutoFilter allows the arrows on and off and their menus. The list is per
sheet and kept, so Unprotect and Protect again open on the same ticks.

Review > Allow Edit Ranges is Excel's Allow Users to Edit Ranges: a list
of titled blocks (`B2:B10`, or several areas with commas) that take an
edit on a protected sheet whether their cells are locked or not. New adds
one over the selection, Modify edits it in place, Delete removes it, and
Protect Sheet... goes straight to that dialog. A range moves with an
insert or delete and goes with the rows it spans.

Protect Sheet and Unprotect Sheet share one slot on the Review tab
(`protect-sheet`, `unprotect-sheet`, and `allow-edit-ranges`); each is
one undo, so Ctrl+Z after Unprotect protects again, and after Protect
puts the old allow list back. The flag is per sheet and rides in
`getState()` as `protected`, the list and the ranges as
`protection: { allow, ranges }` beside it (absent in an older document,
which reads as nothing allowed and no ranges), the unlocked cells as
`locked: false` in their format entries; `onChange` reports
`{ kind: 'protection' }`. Save As writes the flag, the list and the
ranges as the file's `sheetProtection` and `protectedRanges`, and Open
reads Excel's. A command written against the grid asks `cmd.canEdit(r, c)`
before it writes and gets the same answer the editor does.

There is no password, on the sheet or on a range: the protection is
against mistakes, not against the person at the keyboard, who can unprotect
with one click.

Data > Sort A to Z and Z to A sort the current region (or the selection) by
the active cell's column: numbers before text, blanks last, a header row of
text over numbers left in place, values and formats moving together, one
undo.

Every one of them raises its `onAction` first. A handler that returns
`true` has taken the action over and the shell's dialog stays closed, so an
application can put its own Format Cells in place of this one:

```svelte
<SvSheet workbook={wb} onAction={(action, cmd) => {
  if (action === 'format-cells') { openMyDialog(cmd); return true }
}} />
```

## Localisation

Every string the shell shows is English by default and lives in one flat
map, `SheetMessages`, the way the grid's `GridMessages` does. Pass any
subset as `localization.text` and unset keys stay English; `locale` is the
BCP-47 tag the status bar's Sum, Average and Count are printed with, and
it reaches the grid underneath for its own matching and formatting.

```svelte
<SvSheet {data}
  localization={{
    locale: 'de-DE',
    text: {
      'ribbon.tab.home': 'Start',
      'ribbon.bold.title': 'Fett',
      statusReady: 'Bereit',
      statusRecordsFound: '{shown} von {total} Datensätzen gefunden',
      'formatCells.title': 'Zellen formatieren',
      ok: 'OK', cancel: 'Abbrechen',
    },
  }} />
```

Three families of key:

- **The ribbon's** are read off the ribbon model, so every tab, group and
  button is covered without a second list: `ribbon.tab.<tab>`,
  `ribbon.group.<group>`, `ribbon.<item>.label`, `ribbon.<item>.title`
  (the tooltip), `ribbon.<item>.option.<value>` for a dropdown's entries
  and `ribbon.<item>.none` for its "no fill" kind of entry. The ids are
  the `RibbonActionId`s: `ribbon.bold.label`, `ribbon.file-open.title`,
  `ribbon.number-format.option.percent`.
- **The dialogs'** are `<dialog>.<part>`: `formatCells.title`,
  `filter.dateFilters`, `validation.allow.list`, `findReplace.findNext`,
  `sort.addLevel`, `goalSeek.setCell`, and so on.
- **The chrome's** are plain camelCase: `statusReady`, `nameBox`,
  `newSheet`, `menuFormatCells`, `ok`, `cancel`, the sentences the status
  bar says (`openedFile`, `sheetProtected`, `noInvalidData`).

A sentence with `{placeholders}` (`statusRecordsFound`, `deleteSheetMessage`,
`linesToggled`, `textToColumns.status`) lets a translator choose the word
order; `formatMessage` fills them. `defaultSheetMessages` is exported, so
the full English map is there to copy from, and `resolveSheetMessages`
gives the merged map for an app that wants to read it.

What stays English: the function names and error values (`SUM`,
`#VALUE!`), which Excel keeps in every locale too, the rule descriptions
the Conditional Formatting Rules Manager lists, and the font names.
Formulas are typed with `,` between arguments and `.` as the decimal
point whatever the locale.

## How big a sheet it holds

Measured rather than guessed, by `pnpm bench` over the built engine (the
cases are in `tools/bench/sheet-cases.mjs`, the numbers and the rig in
[Benchmarks](../benchmarks.md#spreadsheet-engine)). On a CI-class Linux
container:

| Sheet                                   | Opens in | Retains |
| ---------------------------------------- | -------- | ------- |
| 1,000 rows, a formula each                | 8 ms     | 1.6 MB  |
| 10,000 rows, a formula each               | 91 ms    | 16.5 MB |
| 50,000 rows, a formula each               | 547 ms   | 84.2 MB |

A keystroke costs one evaluation rather than a sheet's worth: the
dependency graph recomputes what read the cell, and nothing else. What
makes an edit expensive is not the size of the sheet but how much of it
one cell feeds. A single `SUM` over 10,000 cells is one evaluation that
re-reads ten thousand cells (14 ms); a running-balance column, where every
row reads the row above, is 10,000 evaluations for one keystroke, and that
is the true cost of that shape.

CI gates the evaluation counts rather than the milliseconds, since a count
is the same on every machine.

## Right to left, touch and assistive tech

The shell carries no direction of its own: set `dir="rtl"` on the page or
on any element above it and everything mirrors, the row gutter and the
frozen columns to the right edge, the ribbon and the tab strip in reading
order, an anchored chart hanging from its cell's right edge and growing
leftwards. The arrow keys follow the reading order with it, so on a
right-to-left ribbon ArrowLeft is the next tab.

The two bands that cannot fit a phone pan with a finger rather than
clipping: the ribbon scrolls sideways over its groups, and the cells pan
in both axes. A tap picks a cell, a second tap on the same cell opens its
editor, and the formula bar is where the address and the formula are read
and typed.

For assistive tech the shell is the bands it looks like: the ribbon is a
toolbar whose tab strip is a `tablist` with one Tab stop, the arrows plus
Home and End moving between tabs with focus following the selection; the
sheet tabs are a second `tablist` with the same model; the formula bar is
a labelled group whose Name Box reads the active cell as its value; the
cells are the grid's own `role="grid"`; every dialog takes focus and
gives it back to the cells on Escape. `tests/e2e/sheet-a11y.spec.ts`,
`sheet-rtl.spec.ts` and `mobile/sheet-touch.spec.ts` hold the shell to
all of this in a real browser, the first with an axe audit of every band.

One thing the shell does not decide: a font colour or a fill the DOCUMENT
sets is used as it stands, on a dark theme as on a light one. A red on a
dark canvas is as hard to read here as it is in Excel, and the answer is
the same one: change the document's colours, not the app's.

## What it does not do

The shell is the part of Excel a team's spreadsheet uses every day; these
are the parts it leaves out, on purpose, so nothing on the ribbon is a
button that does nothing.

- **Tabs:** no track-changes on Review; Page Layout has no themes, no
  page breaks and no header or footer text, and Print has no preview of
  its own beyond the browser's.
- **Objects** are charts and pictures, and they stay in the document: a
  chart has no trend lines or secondary axis of its own beyond what the
  Chart dialog sets, and neither kind rides in the .xlsx.
- **Sparklines** are the three Excel draws, and they stay in the document
  too: no axis options beyond one scale for the group, no high and low
  point marks beyond the last one, and they neither ride in the .xlsx nor
  reach the printed page.
- **A PivotTable** is a definition plus the cells it writes, not a live
  object: no drag-and-drop field list, no slicers, no drill-down on a
  double-click, and no report filter. Refresh is what brings it up to
  date.
- **Protection** takes no password, on the sheet or on an edit range: it
  guards against mistakes, not against the person at the keyboard.
- **Validation** checks what is typed; pasted-over cells are left as they
  land until Circle Invalid Data is asked for.
- **Conditional formatting** has Excel's presets and Excel's "with"
  styles, one icon set per flavour, and no colour pickers of its own for
  bars and scales; the grid's own value-driven rules are a separate
  feature.
- **AutoFilter**'s values list is the whole column, unvirtualised, which
  is what a sheet's region holds.

## More examples

### Review workflow: comments + Protect Sheet

An expense sheet under review on the Excel shell. It opens protected: every cell is locked except the reviewer's Receipt and Status columns, so a keystroke on an amount is refused and the status bar says why. Three reviewer notes sit on the cells they are about (Excel's red corner): hover, Shift+F2, Review > Next, Show All Comments. Status is a list, the totals by status are SUMIFs, and protection, notes and rules all ride in the document.

<div data-docs-demo="460-review-comments-protection" data-height="560"></div>

### Order intake: data validation

An order form with Excel's Data Validation on it: Region and Product are lists (the arrow or Alt+Down drops them; Product reads the price list on a second sheet), Qty is a whole number from 1 to 500 with a Stop alert and Retry, Discount is a decimal up to 20% with a Warning you can keep, Ship by is a date on or after the order date through a relative bound (=A2 moves with the row). Unit price is an XLOOKUP, the total follows.

<div data-docs-demo="461-order-intake-validation" data-height="560"></div>

### Regional scorecard: conditional formatting

Eight regions, three months, a target, and every colour on the page is a conditional formatting rule over computed values: Highlight Cells on attainment (under 90% red, 100% and over green), a Data Bar and a Top 3 on the quarter, a Green - Yellow - Red Color Scale across the months, an Icon Set on the trend. Edit a month and the arrow, the bar, the fill and the rank all move; Manage Rules lists the six in priority order.

<div data-docs-demo="462-regional-scorecard-cf" data-height="560"></div>

### Budget report: merged headers

A half-year budget report laid out with merged cells the way Excel lays one out: a title merged across the page, Q1 / Q2 / H1 group headers merged over their months, a Line corner merged down two rows, a notes paragraph merged into one wrapped block. A merge is one cell to the grid: click inside Q1 and the Name Box says B2, Merge & Center lights, the arrows step over it and its column letters are shaded. Unmerge and merge again from the ribbon; Ctrl+Z each step.

<div data-docs-demo="463-merged-report-headers" data-height="560"></div>

### Support ticket log: AutoFilter

Forty support tickets with Excel's Filter on the header row, opened already filtered to what is still open: the funnel on Status, blue row numbers, "N of 40 records found" in the status bar. The arrows drop Excel's menu: sort, Clear Filter, Text and Number Filters with two conditions, a search box, (Select All) and the values with counts. The rows are worked out again after every edit, so a ticket typed Closed folds away at once. Ctrl+Shift+L toggles it.

<div data-docs-demo="464-ticket-log-autofilter" data-height="560"></div>

### Autosave: a document that survives a reload

A project tracker that keeps itself in localStorage: onChange fires once per tick with every kind of change, the demo debounces it and writes getState() as JSON, and the next visit rebuilds the document with createSheetDocument({ state }) and hands it to <SvSheet document>. Add a comment, bold a row, hide a column, type a task, reload: it is all back, rules and merged title and frozen rows included. Reset puts the shipped document back with setState().

<div data-docs-demo="465-autosave-document" data-height="560"></div>

### Paste from Excel: formats and formulas survive

Excel puts an HTML document on the clipboard beside the tab-separated text: formats in a style block keyed by class, formulas in x:fmla, raw numbers in x:num. The sheet reads it, so a pasted block arrives bold, filled, with its number formats, and with its formulas moved to where they landed; Google Sheets' data-sheets-formula flavour reads the same. Two buttons put exactly what Excel and Sheets put on the clipboard; click a cell and Ctrl+V.

<div data-docs-demo="466-paste-from-excel" data-height="560"></div>

### Loan model: PMT, accounting formats and the File tab

A mortgage model built from the sheet's own financial functions: PMT for the payment, IPMT and PPMT for each period's split, NPER and RATE for the term and the rate that fit, SUMPRODUCT for the first year of interest. The money cells wear the Accounting format, Extra Payment carries a validation rule with an Input Message, and Circle Invalid Data rings what breaks it. The File tab is the point: Save As writes the whole model as an .xlsx Excel opens with its formulas, formats and rules, Open reads one back, Export CSV takes the active sheet.

<div data-docs-demo="474-loan-model-files" data-height="560"></div>

### Charts and pictures on the sheet

Charts anchored over the cells the way Excel anchors one: each reads a range rather than a copy of the numbers, so typing into a cell redraws it. Insert > Chart charts the selected block and reads its first row and column as the labels, Insert > Picture puts an image on the sheet, and a double-click opens the Chart dialog for the type, the title, series in columns or rows and stacking. Drag an object to move it, its corner to resize, Delete to remove. It hangs from a cell, so inserting a row above moves it, and it rides in getState().

<div data-docs-demo="475-sheet-charts-objects" data-height="560"></div>

### Sparklines: a chart inside the cell

Excel's smallest chart, and not an object: a sparkline IS the cell. One per row of a block of numbers, drawn from the range rather than a copy, so editing a number redraws it. Insert > Sparklines offers Line, Column and Win/Loss, with Edit for the group's ranges, kind and colours and Clear for the groups the selection touches; selecting a cell that holds one turns the kind buttons into a change to that group. They are kept per group the way Excel keeps them, ride in getState() and move with an insert or a delete.

<div data-docs-demo="476-sheet-sparklines" data-height="560"></div>

### PivotTable from a range

Excel's Insert > PivotTable over a block of cells, on the same pivot engine the grid uses for its own pivot mode. The sheet keeps the definition, the source block, where the result goes and which field is a row, a column or a measure; the result is plain cells written in one undo, so it can be formatted, charted, printed and saved to an .xlsx like any other block. Refresh rebuilds it from the source, and opening the dialog from inside one edits it.

<div data-docs-demo="477-sheet-pivot-range" data-height="560"></div>

## See also

- [`<sv-sheet>`](../web-components/sv-sheet.md): the shell as a custom
  element for React, Vue, Angular or a plain page, with React and Vue
  wrappers.

- [Excel keyboard shortcuts](./keyboard-shortcuts.md)
- [Formulas](../spreadsheet-formulas.md)
- [Number formats](./number-formats.md)
- [Workbooks](./workbooks.md)
