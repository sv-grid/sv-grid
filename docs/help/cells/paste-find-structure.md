# Paste Special, Find and Replace, and structural edits

The three Excel operations that write more than one cell, plus freeze panes.

```ts
import {
  parseClipboard, buildClipboardPayload, planPaste, resolvePasteCell,
  findAll, replaceAll, setFindTarget,
  insertRows, deleteColumns, setStructureTarget,
  splitFrozenRows, freezeAtActiveCell,
} from '@svgrid/enterprise/sheet'
```

All of them run inside `cmd.batch()`, so each is **one** `Ctrl+Z`.

## Paste Special

### Why the clipboard needed an HTML flavour

The grid's clipboard is TSV only: `writeText` out, `readText` in. Values
survive; formats, formulas and merges do not. Excel writes both `text/plain`
and `text/html` and reads the HTML back when it is there, so matching that is
what makes a round trip work.

`buildClipboardPayload` produces both:

```ts
const { text, html } = buildClipboardPayload(grid, { row: 2, col: 0 })

await navigator.clipboard.write([
  new ClipboardItem({
    'text/plain': new Blob([text], { type: 'text/plain' }),
    'text/html': new Blob([html], { type: 'text/html' }),
  }),
])
```

The HTML is a plain `<table>`. Formats ride on inline styles every app reads,
with Excel's own `mso-number-format` beside them so Excel keeps the number
format rather than guessing one from the text; the number behind a formatted
display rides in Excel's `x:num`; the formula travels in a `data-formula`
attribute they all ignore. So a paste into Excel keeps the look and the
numbers, and a paste back into the grid keeps the formula.

`parseClipboardHtml` reads the other direction. Excel's clipboard puts every
cell's format in a `<style>` block keyed by class, the formula in `x:fmla`
and the raw number in `x:num`; Google Sheets writes `data-sheets-value`,
`data-sheets-numberformat` and `data-sheets-formula` (in R1C1). All of
them come through: the cell's `text` is the number when the source wrote
one, its `format` carries `numFmt`, bold, italic, colour, fill, font and
wrap, and `formula` is what the source held. `resolvePasteCell` turns an
R1C1 formula into A1 for the cell it lands in when you pass the destination
as its fifth argument. Excel's formulas come as written, since its HTML
says nothing about where they were copied from; `anchorForeignFormulas`
settles them the way the shell does: a formula whose references all fall
inside the block, read as if copied from A1, is kept with that origin so
the paste moves it, and one that reaches outside the block is replaced by
its value.

The second argument records where the copy came from, which is how a pasted
formula knows how far it moved. Omit it and references paste unshifted, which
is correct for a paste from another application: it has no position in this
sheet to have moved from.

Reading is symmetric, and falls back to TSV when the HTML holds no table:

```ts
const grid = parseClipboard({ text, html })
```

### The options

```ts
type PasteSpecialOptions = {
  what?: 'all' | 'values' | 'formulas' | 'formats'
  operation?: 'none' | 'add' | 'subtract' | 'multiply' | 'divide'
  transpose?: boolean
  skipBlanks?: boolean
}
```

`planPaste` says where each source cell lands; `resolvePasteCell` says what it
becomes. Both are pure, so the option matrix is testable without a clipboard:

```ts
for (const { row, col, source, offset } of planPaste(grid, at, opts, origin)) {
  const decision = resolvePasteCell(source, getValue(row, col), opts, offset)
  switch (decision.kind) {
    case 'skip': break
    case 'value': setRaw(row, col, decision.value); break
    case 'format': store.set([[row, col, row, col]], decision.format ?? {}, lookup); break
    case 'both': /* both of the above */ break
  }
}
```

Arithmetic operates on values, ignoring formats and formulas, as Excel does. A
non-numeric cell or a divide by zero **skips** rather than writing `NaN`.

`Ctrl+Shift+V` calls the handler you register with `setPasteSpecialHandler`.
The keyboard layer owns the key; the dialog is yours.

### The grid's clipboard hooks

`@svgrid/grid` has two per-cell hooks, `processCellForClipboard` on the way
out and `processCellFromClipboard` on the way in, and two whole-clipboard
ones for the HTML flavour:

```svelte
<SvGrid
  clipboardHtml={({ rects, text }) => buildClipboardPayload(gridOf(rects)).html}
  onPasteClipboard={({ text, html, source }) => {
    const grid = html ? parseClipboardHtml(html) : null
    if (!grid) return          // plain text: the grid pastes it as usual
    landBlock(grid)
    return true                // handled; the grid writes nothing itself
  }}
/>
```

A copy leaves out what the copier cannot see: a collapsed row or column is
folded to nothing, and the keyboard already walks past it, so the block that
reaches the clipboard closes up around it. That is what makes "filter, copy,
paste" in the spreadsheet shell carry the rows that matched, next to each
other, rather than the hidden ones as well.

`clipboardHtml` runs once per copy, after the text is assembled; return the
HTML to put beside it, or nothing for a text-only copy. The grid writes both
through the `copy` event (`execCommand`), so it works on plain HTTP too,
and through `navigator.clipboard.write` where the event is refused.

`onPasteClipboard` runs on Ctrl+V and on a Paste command with the text and,
when the clipboard has one, the HTML. With the hook set the grid leaves the
key to the browser, so the native `paste` event delivers the HTML as the
source wrote it (`source: 'event'`); where the event does not arrive, the
async clipboard is read for both types (`source: 'async'`). Return `true`
once you have written the cells; anything else lets the grid paste the text
the way it always has. Whatever the hook writes lands in one undo step with
the grid's own writes.

`processCellFromClipboard` receives the raw clipboard text and what the grid
would have written, and returns the value to write, or `undefined` to leave
the cell alone:

```svelte
<SvGrid
  processCellFromClipboard={({ text, parsedValue }) =>
    text.startsWith('=') ? text : parsedValue}
/>
```

### Writes that ask first

Every command here writes through `cmd.setCellValue`, which trusts its
caller. A sheet that refuses some cells (a protected sheet with locked
cells) says so through `cmd.canEdit(r, c)`, the grid's own editability
answer, and the fills, stamps, AutoSum and the copies from above skip a
cell that says no. The format target can refuse a change too
(`guard(rects)`, with `refused()` called when it does), and the
structure target can refuse an insert or delete (`canApply(edit)`), which
is how the ribbon knows to grey Bold and Insert on a protected sheet.

## Find and Replace

Finding looks at what the user **sees**. Replacing writes what the user
**typed**, which for a formula cell is the formula, not its result. Replacing
`100` inside a cell showing `100` that actually holds `=B2*C2` would either do
nothing or destroy the formula, depending on which text you reached for. So
`lookIn` chooses what is searched, and replace always writes through the raw
text.

```ts
setFindTarget({
  getRaw: (r, c) => raw[r][c],
  getDisplay: (r, c) => displayed[r][c],
  setRaw: (r, c, text) => { raw[r][c] = text },
  isEditable: (r, c) => true,
})

findAll(cmd, 'cat', { matchCase: true })
replaceAll(cmd, 'cat', 'dog', { lookIn: 'formulas', scope: 'selection' })
```

| Option | Default | Does |
| ------ | ------- | ---- |
| `matchCase` | false | Case sensitive. |
| `matchEntireCell` | false | The cell must equal the text, not contain it. |
| `lookIn` | `'values'` | Search displayed values, or formula source. |
| `scope` | `'sheet'` | Restrict to the current selection. |

The needle is treated as literal text, not a pattern, so `.` and `$1` mean
themselves.

`replaceAll` is the command most likely to overflow a 200-step undo history,
which is why the grouping seam came first. `Ctrl+H` calls
`setFindReplaceHandler`.

## Insert and delete with reference fixup

`api.addRow` and friends always existed. What was missing is the fixup pass:
inserting a row above `=SUM(D2:D11)` without widening the range silently
produces the wrong total, and deleting a referenced row leaves a formula
pointing at whatever moved in. Neither shows an error, which is why this
waited for the engine.

```ts
setStructureTarget({
  getRaw, setRaw,
  apply: (edit) => { /* do the structural change to your data */ },
  names,                                  // rewritten too
  format: { store, lookup },              // entries for deleted rows dropped
})

insertRows(cmd)        // span taken from the selection
deleteColumns(cmd, 2, 1)
```

Order is fixed: rewrite formulas, drop format entries for what is going, then
apply the change. The first two read the OLD geometry.

Nothing needs *shifting* in the format store. It keys on row and column **ids**,
and an id travels with the thing it names, so an insert moves nothing. A
delete drops those ids, which is what `forgetRow` / `forgetColumn` are for.

`Ctrl+Shift+Plus` and `Ctrl+Minus` act on rows when the selection spans every
column, columns when it spans every row, and **decline** otherwise. Excel opens
a dialog for the ambiguous case; deciding what that looks like is yours, so the
key falls through and you can bind your own.

## Freeze panes

Columns freeze properly and for free through column pinning. Rows are the
honest part of this module.

The grid renders `pinnedTopRows` into a **separate** tbody above a virtualized
body that still renders every row, so handing it the first three displayed rows
shows them twice. Excluding them from the body means changing the virtualizer,
which is the path built for a million rows, and freeze is not worth that risk.

So `applyFreeze` does the column half through the api and reports the state;
`splitFrozenRows` does the row arithmetic and you apply it:

```svelte
<script>
  let freeze = $state({ rows: 2, cols: 1 })
  const split = $derived(splitFrozenRows(rows, freeze.rows))
</script>

<SvGrid data={split.bodyRows} pinnedTopRows={split.pinnedTopRows} {columns} />
```

`freezeAtActiveCell`, `freezeTopRow`, `freezeFirstColumn` and `unfreeze` are
the Excel gestures. Split panes stays declined: a second scroll viewport in the
hot render path, for something freeze already covers.

## Text to Columns and Remove Duplicates

The two one-shot transforms an Excel user reaches for on arriving data. Both
are pure functions rather than commands, because they get run from a button, a
menu, a paste handler or a test, and none of those want a keystroke.

```ts
import {
  splitText, textToColumns, guessDelimiter,
  findDuplicates, removeDuplicates,
} from '@svgrid/enterprise/sheet'
```

### Text to Columns

```ts
guessDelimiter(['a;b', 'c;d'])        // ';'
textToColumns(['a,b,c', 'd,e'])
// { rows: [['a','b','c'], ['d','e','']], width: 3 }
```

Every row is padded to the widest. That matters: writing a ragged result into
a grid leaves whatever was already in the cell, so a row that split into two
fields would keep stale text in the third column.

`splitText` is a scan, not a `String.split`, because a quoted field may contain
the delimiter and a doubled quote is an escaped one:

```ts
splitText('a,"b,c",d')                                      // ['a', 'b,c', 'd']
splitText('a   b', { delimiters: [' '], collapse: true })   // ['a', 'b']
splitText('a:b:c', { delimiters: [':'], limit: 2 })         // ['a', 'b:c']
```

`guessDelimiter` scores a candidate on appearing in most rows **and** the same
number of times in each, so a comma inside one field does not beat the tab
that actually separates the columns.

### Remove Duplicates

`findDuplicates` reports rather than removes, so the caller decides what
removal means for its data structure and a UI can say "3 duplicates found"
before anything is written:

```ts
findDuplicates([['a'], ['b'], ['a']])
// { keep: [0, 1], remove: [2] }

removeDuplicates(rows, (r) => [r.email], { matchCase: true })
// { rows: [...], removed: 3 }
```

Comparison is **case-insensitive** by default, matching Excel. That surprises
people, which is exactly why it matches rather than being tidier.

## More examples

### Paste from Excel: formats and formulas survive

Excel puts an HTML document on the clipboard beside the tab-separated text: formats in a style block keyed by class, formulas in x:fmla, raw numbers in x:num. The sheet reads it, so a pasted block arrives bold, filled, with its number formats, and with its formulas moved to where they landed; Google Sheets' data-sheets-formula flavour reads the same. Two buttons put exactly what Excel and Sheets put on the clipboard; click a cell and Ctrl+V.

<div data-docs-demo="466-paste-from-excel" data-height="560"></div>


### Paste Special, Find/Replace

The three Excel operations that write more than one cell: Paste Special (values / formulas / formats / transpose / arithmetic, with a text/html clipboard flavour so formats survive a round trip through Excel), Find and Replace that searches what you SEE but writes what you TYPED so a formula is not destroyed by replacing its result, and insert/delete that rewrites every formula - inserting above =SUM(B1:B4) widens it instead of dropping the new row.

<div data-docs-demo="454-paste-find-structure" data-height="560"></div>

### Data cleanup: Text to Columns, Remove Duplicates

A CRM export landed in column A, semicolon-separated, with the same people in it twice. Data -> Text to Columns opens a wizard that has already guessed the delimiter and previews the split; Data -> Remove Duplicates lets you tick the columns that decide identity, compares case-insensitively like Excel, and reports "3 duplicate values found and removed; 11 unique values remain". Each operation is one Ctrl+Z.

<div data-docs-demo="458-data-cleanup" data-height="560"></div>

## See also

- [Excel keyboard shortcuts](./keyboard-shortcuts.md)
- [Number formats](./number-formats.md)
- [Spreadsheet formulas](../spreadsheet-formulas.md)
