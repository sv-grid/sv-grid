---
seoTitle: Svelte spreadsheet files - .xlsx, .ods, .xls, .csv and autosave
seoDescription: Saving an SvSheet document: getState and setState, an autosave on onChange, the File tab, .xlsx, .ods, .xls and .csv in and out, and paste from Excel.
keywords: svelte xlsx export, open xlsx svelte, spreadsheet autosave, save spreadsheet localStorage, paste from excel svelte
---

# Files: save, restore, autosave and Excel

A spreadsheet is a document, and a document has to come back the way it
was left: the formulas, the formats, the frozen rows, the comments, the
rules. This page is the document as plain data, an autosave that costs
one handler, the File tab and the four file formats behind it, the same
conversions with no browser, and what a paste from Excel carries.
[Getting started](./start.md) shows how a document is built.

The examples share a small tracker, built as a function so a restore
has something to be compared with.

```svelte {preamble}
<script lang="ts">
  import { SvSheet, createWorkbook, createSheetDocument, type SheetState, type SheetChangeReason } from '@svgrid/enterprise'

  const at = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }

  // The document as shipped: cells, a frozen header, a money column, a note.
  function trackerDoc() {
    const book = createWorkbook([{ name: 'Tracker', cells: [
      ['Task', 'Owner', 'Status', 'Budget'],
      ['Pricing page', 'Ana', 'In progress', '4200'],
      ['Onboarding email', 'Ben', 'Done', '900'],
      ['Partner portal', 'Chloe', 'Not started', '12500'],
      ['Total', '', '', '=SUM(D2:D4)'],
    ] }])
    const d = createSheetDocument({ workbook: book })
    const s = d.get('Tracker')
    s.formats.set([[0, 0, 0, 3]], { bold: true, fill: '#e2e8f0', color: '#0f172a' }, at)
    s.formats.set([[1, 3, 4, 3]], { numFmt: '#,##0' }, at)
    s.formats.set([[4, 0, 4, 3]], { bold: true }, at)
    s.widths.A = 150
    s.freeze = { rows: 1, cols: 0 }
    s.notes = { r3: { C: 'Waiting on the vendor for a staging environment.' } }
    return d
  }
</script>
```

## The document as data

`doc.getState()` is everything the shell shows, as JSON: the workbook
(each sheet's raw text, the formulas as typed, the names, the active
sheet, the tables) and per sheet the formats, column widths, row
heights, hidden lines, frozen panes, comments, protection, page setup,
charts and pictures, sparklines, pivots, links, merges, validation and
conditional formatting rules. `setState()` puts one back into the same
document, and `createSheetDocument({ state })` builds a new document
from one.

```svelte {runnable}
<script lang="ts">
  const doc = trackerDoc()
  const shipped: SheetState = doc.getState()
  let json = $state('')
</script>

<button type="button" onclick={() => (json = JSON.stringify(doc.getState(), null, 1))}>Show state</button>
<button type="button" onclick={() => { doc.setState(shipped); json = '' }}>Reset</button>
<SvSheet document={doc} rows={8} columns={5} />
{#if json}<pre style="max-height: 200px; overflow: auto; font-size: 11px">{json}</pre>{/if}
```

Bold a row, widen a column, type a task, then Show state: every one of
them is in the JSON, and the formulas are their text. Reset is
`setState` with the shipped state; it clears the undo history, since
none of it describes the restored sheet, and reports one `restore`.

The shape is `SheetState` (exported, with `SheetStateEntry`,
`ValidationRule` and `CfRule` for its parts). Rows are `r` plus the
0-based index and columns are letters; a format key is the two with a
space between; rectangles are `[minRow, minCol, maxRow, maxCol]`.

## An autosave is one handler

`onChange` fires once per tick with every reason since the last call, so
a paste of forty cells is one call, and a save is a debounce around
`getState()`. A `restore` is not an edit to save. On the next visit,
build the document from what was saved:

```svelte {runnable}
<script lang="ts">
  const KEY = 'svgrid-docs-tracker'
  function load(): SheetState | null {
    try {
      const raw = localStorage.getItem(KEY)
      return raw ? (JSON.parse(raw) as SheetState) : null
    } catch { return null }
  }
  const saved = load()
  const doc = createSheetDocument({ state: saved ?? trackerDoc().getState() })

  let savedAt = $state<string>(saved ? 'restored from the last visit' : 'not saved yet')
  let timer: ReturnType<typeof setTimeout> | undefined
  function onChange(reasons: ReadonlyArray<SheetChangeReason>) {
    if (reasons.every((r) => r.kind === 'restore')) return
    clearTimeout(timer)
    timer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(doc.getState())) } catch { /* private mode, quota */ }
      savedAt = `saved at ${new Date().toLocaleTimeString()}`
    }, 400)
  }
</script>

<p style="font-size: 12px">{savedAt}</p>
<button type="button" onclick={() => { try { localStorage.removeItem(KEY) } catch { /* ignore */ } doc.setState(trackerDoc().getState()); savedAt = 'reset to the shipped document' }}>Reset</button>
<SvSheet document={doc} {onChange} rows={8} columns={5} />
```

Edit something, reload the page: it is back. The same handler with a
`fetch` in it is an autosave to a server, plus three things a network
makes you think about: debounce and then serialise, so two requests are
never in flight and an older document cannot land after a newer one;
carry a revision and let the server refuse a save built on a stale one;
and with two people on the document send changes rather than the whole
state, which is what [Review and share](./review.md) covers.

A save on a timer is worse, not better: it saves when nothing changed
and misses the tab closing. If the tab closing matters, save on
`visibilitychange` too, with the same snapshot.

`reasons` says what changed: `cells`, `formats`, `sizes`, `hidden`,
`freeze`, `sheets`, `comments`, `protection`, `page-setup`, `objects`,
`sparklines`, `pivots`, `links`, `merges`, `filter`, `validation`,
`conditional-formats`, `structure` (with the insert or delete on the
reason), `workbook` for the names or the calculation settings, `tables`,
and `restore`. An app that keeps its own index of
sheet names can listen for `sheets` alone.

## The File tab

File has New, Open, Save As (`.xlsx`), Save As ODS, Save As XLS, Export
CSV and Print; `Ctrl+O`, `Ctrl+S` and `Ctrl+P` are the same actions.
Open takes an `.xlsx`, an `.ods`, an `.xls` or a `.csv` from disk and
reads the kind from the bytes, not the name, so a file downloaded
without an extension still opens as itself. Save As downloads the
document as an `.xlsx` that Excel, Google Sheets and LibreOffice open
with the same parts.

An app that keeps its workbooks somewhere other than the user's disk
takes the actions over in `onAction` (`file-open`, `file-save-xlsx`,
`file-save-ods`, `file-save-xls`, `file-new`, `file-export-csv`,
`file-print`) and calls the component's own methods: `open(blob)`
replaces the document with a file of any of the four kinds, `toXlsx()`,
`toOds()` and `toXls()` return the document as a Blob, `toCsv()` the
active sheet as text, `newWorkbook()` empties it, `print()` opens the
print dialog and `printHtml()` returns the page it would print.

```svelte {runnable}
<script lang="ts">
  const doc = trackerDoc()
  let sheet = $state<SvSheet>()
  let status = $state('')

  async function saveToServer() {
    const blob = await sheet!.toXlsx()
    // await fetch(`/api/books/tracker`, { method: 'PUT', body: blob })
    status = `would upload ${blob.size} bytes of .xlsx`
  }
</script>

<p style="font-size: 12px">{status}</p>
<SvSheet
  bind:this={sheet}
  document={doc}
  rows={8}
  columns={5}
  onAction={(action) => {
    if (action === 'file-save-xlsx') { saveToServer(); return true }
  }}
/>
```

Press `Ctrl+S`, or File > Save As: the handler runs instead of the
download. `.xlsx` and `.ods` are zips and need the `jszip` peer; `.xls`
and `.csv` need nothing.

<div data-docs-demo="484-loan-model-files" data-height="560"></div>

## What each format carries

The `.xlsx` carries the most: cells with their formulas, formats, widths
and heights, hidden lines and sheets, frozen panes, merges, the filter
with its criteria, validation, conditional formatting, protection,
comments, names, charts, pictures, sparklines, hyperlinks and the
calculation settings. A PivotTable travels as the cells it wrote, not as
a definition Excel would refresh. Dates are `yyyy-mm-dd` text in the
sheet and serial numbers in the file, converted both ways under a date
format.

The `.ods` is the same document in OpenDocument, the format LibreOffice
Calc saves by default: cells and formulas (translated to ODF's own
reference grammar and back), number formats, looks, sizes, merges,
hidden lines, the filter with its values and conditions (a date period
or a colour has no ODF spelling, so those rows go out hidden instead),
hyperlinks, notes, names and protection. Charts, images, sparklines,
validation, conditional formatting and frozen panes travel in the
`.xlsx` and not yet in the `.ods`.

The `.xls` is Excel 97-2003 and carries the least. Cells and formulas
travel as the RPN tokens that format stored, so a function it never had
(XLOOKUP, LET, TEXTJOIN, a structured reference) goes out as the value
it worked out; formats, sizes, hidden lines, merges, frozen panes,
protection and names travel; charts, pictures, sparklines, pivots,
validation, conditional formatting and comments do not. The sheet is
65,536 rows by 256 columns.

A `.csv` is the active sheet as its cells show. Opening one guesses the
separator, so a comma, a semicolon or a tab file all read as
themselves; a quoted field keeps its commas and line breaks; a field
that reads as a percentage, a currency amount or a grouped number lands
as the number with the format it implies. A CSV field is never read as
a formula, as it is not in Excel.

## The same conversions with no browser

The File tab is `documentToXlsx` and `documentFromXlsx` with a file
picker around them. The writer takes a document and returns the file as
a Blob; the readers return a `SheetState`, which `createSheetDocument`
turns back into a document. So a server can write the `.xlsx` a report
is emailed as, or read the one a user uploaded, from the same package:

```ts
import { createSheetDocument, documentToXlsx, documentFromXlsx, documentFromFile, csvText, sheetStateFromCsv } from '@svgrid/enterprise'

// A document built from rows, written as a file.
const doc = createSheetDocument({ sheets: [{ name: 'Report', cells: rows }] })
const blob = await documentToXlsx(doc)           // needs jszip

// A file read back into a state, and the document over it.
const state = await documentFromXlsx(uploaded)   // Blob, ArrayBuffer or Uint8Array
const restored = createSheetDocument({ state })

// Any of the four kinds, decided by the bytes; a state, like the reader above.
const fromAnyFile = await documentFromFile(file)

// CSV, both ways, with nothing to install.
const text = csvText([['Task', 'Budget'], ['Pricing page', '4200']])
const fromCsv = sheetStateFromCsv(text, 'Report')
```

`documentToOds` and `documentFromOds` are the pair for OpenDocument
(`jszip` again), `documentToXls` and `documentFromXls` for the old
binary, which is not a zip and needs nothing. Every one of them is also
on the `@svgrid/enterprise/sheet` subpath, which has no Svelte in it,
for a Node script.

## A paste from Excel

Excel puts an HTML document on the clipboard beside the tab-separated
text: the formats in a style block, the formulas in `x:fmla`, the raw
numbers in `x:num`. The sheet reads it, so a block pasted from Excel
arrives bold, filled, with its number formats, and with its formulas
moved to where they landed; Google Sheets puts a different flavour on
the clipboard and that reads the same. Paste Special (Home > Paste)
takes values only, formulas only, formats only, or the block transposed.

<div data-docs-demo="466-paste-from-excel" data-height="520"></div>

The other way round, a copy from the sheet puts the same three flavours
on the clipboard, so a block pasted into Excel keeps its formats and
formulas too.

<div data-docs-demo="465-autosave-document" data-height="600"></div>

## See also

- [Review and share](./review.md) - the delta stream, for a document two people edit at once.
- [Formatting](./formatting.md) - what a format entry holds, which is what the `formats` part of the state is.
- [Data export and printing](../export.md) - the grid's own export, for rows that are not a spreadsheet.
- [The spreadsheet shell](../cells/spreadsheet-shell.md) - Page Layout and Print, and the full state shape.
