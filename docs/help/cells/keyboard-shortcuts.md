# Excel keyboard shortcuts

The muscle memory a spreadsheet user arrives with, on any `<SvGrid>` with cell
selection on. One call turns it on:

```ts
import { setLicenseKey, enableSheet } from '@svgrid/enterprise'

setLicenseKey('YOUR-KEY')
enableSheet()
```

```svelte
<SvGrid {data} {columns} enableCellSelection enableInlineEditing />
```

`enableSheet()` is idempotent, so call it from every component that wants it or
once at app start. `installEnterprise()` calls it for you.

If you only want the shortcuts, import from the `/sheet` subpath so the rest of
the pack (export, pivot, the scheduler, the board) stays out of your bundle:

```ts
import { enableSheet } from '@svgrid/enterprise/sheet'
```

<div data-docs-demo="452-excel-shortcuts" data-height="520"></div>

## The keymap

### Navigation

| Key | Action |
| --- | ------ |
| Ctrl/Cmd + Arrow | Jump to the edge of the data region. |
| Ctrl/Cmd + Shift + Arrow | The same jump, extending the selection from its far corner; the active cell stays at the anchor. |
| Ctrl/Cmd + A, Ctrl/Cmd + Shift + Space | Select the current region; press again for the whole sheet. |
| Ctrl/Cmd + Shift + 8 (Ctrl + \*) | Select the current region, and only that. |
| Ctrl/Cmd + Space | Select the whole columns the selection touches; the active cell stays. |
| Shift + Space | Select the whole rows the selection touches; the active cell stays. |
| Ctrl/Cmd + End | The last used cell (the grid's own Ctrl+Home is A1). |
| Ctrl/Cmd + Shift + End / Home | Extend the selection to the last used cell, or to A1. |
| Shift + Home, Shift + PageUp / PageDown | The grid's own: extend the selection to column A, or by a page, from its far corner. |

The mouse follows Excel's rules too: a click on a column letter or a row
number selects the whole line and puts the active cell on its first VISIBLE
row or column, a drag along the letters or the numbers selects a run,
Shift+click extends the run from the active cell's line, Ctrl+click adds a
line beside the selection, and the corner selects everything without moving
the active cell. The keyboard stays on the sheet afterwards: an arrow
collapses to the active cell, Shift+Arrow grows a run of whole lines, and
typing lands in the active cell. Shift+Arrow and the extending keys scroll
along their own axis only, so a whole-column selection does not jump to
the bottom of the sheet when it grows sideways.

### Fill and entry

| Key | Action |
| --- | ------ |
| Ctrl/Cmd + D | Fill down. |
| Ctrl/Cmd + R | Fill right. |
| Ctrl/Cmd + ; | Stamp today's date. |
| Ctrl/Cmd + Shift + ; | Stamp the current time. |
| Ctrl/Cmd + ' | Copy the cell above, unchanged. |
| Ctrl/Cmd + Shift + " | Copy the value of the cell above: what a formula there shows, as a number or text. |
| Alt + = | AutoSum the run above, or to the left. |
| F4 (while editing) | Turn the reference at the caret through `$A$1`, `A$1`, `$A1`, `A1`; a range turns both ends. Also in the formula bar. |
| Alt + Enter (while editing) | A line break in the cell, which turns on Wrap Text. |
| Enter after a run of Tabs | Down a row and back to the column the run began in. |
| Ctrl/Cmd + 9 / Ctrl/Cmd + 0 | Hide the selected rows / columns (raised as `hide-rows` / `hide-columns`). |
| Ctrl/Cmd + Shift + 9 / Ctrl/Cmd + Shift + 0 | Unhide the rows / columns the selection spans (`unhide-rows` / `unhide-columns`). |
| Enter / Tab inside a selected block | Walk the block, wrapping at its edges; the block stays selected. |
| Ctrl/Cmd + Enter (while editing) | The entry into every cell of the selected block, staying put. |

### Formatting

These write through the store you attach with `setFormatTarget`. Until you
attach one they decline, so the key falls through rather than looking broken.
See [number formats](./number-formats.md).

| Key | Action |
| --- | ------ |
| Ctrl/Cmd + B / I / U | Bold, italic, underline. |
| Ctrl/Cmd + 5 | Strikethrough. |
| Ctrl/Cmd + 1 | Open Format Cells: the sheet shell's own dialog, or your `setFormatDialogHandler` on a plain grid. |
| Ctrl/Cmd + Shift + 1..6 | Number, time, date, currency, percent, scientific. |
| Ctrl/Cmd + Shift + ` | General. |
| Ctrl/Cmd + Shift + > / < | Increase / decrease the font size one rung. |
| Ctrl/Cmd + Shift + & | Outline border around the selection. |
| Ctrl/Cmd + Shift + _ | Remove every border in the selection. |

### Structure, search and paste

These open your own chrome rather than any this layer ships, through
`setFindReplaceHandler`, `setPasteSpecialHandler` and `setFormatDialogHandler`.
See [paste, find and structure](./paste-find-structure.md).

| Key | Action |
| --- | ------ |
| Ctrl/Cmd + Shift + Plus | Insert rows or columns, rewriting every formula. |
| Ctrl/Cmd + Minus | Delete rows or columns, rewriting every formula. |
| Ctrl/Cmd + H | Find and Replace. |
| Ctrl/Cmd + Shift + V | Paste Special. |
| Enter, while the marching ants are up | Paste the copied block here once and leave copy mode; Ctrl+V pastes and keeps the ants. |
| F9 | Recalculate. |
| Ctrl/Cmd + ` | Show formulas instead of values. |
| Ctrl/Cmd + Shift + L | The filter row. |
| Shift + F3 | Insert Function. |
| Shift + F2 | Insert or edit the comment on the active cell (raised as `edit-comment`). |
| Alt + Down | Drop the list a validated cell offers (raised as `open-list`). |
| Ctrl/Cmd + F1 | Collapse or expand the ribbon (raised as `toggle-ribbon`). |
| Ctrl/Cmd + F3 | Name Manager. |
| Ctrl/Cmd + T | Format as Table, when the application answers Insert > Table (`extras`). |

The last seven raise the same actions as the ribbon buttons that name them;
on a plain grid, `setRibbonActionHandler` decides what answers.

A command that needs the clipboard calls `cmd.copy()`, `cmd.cut()` or
`cmd.paste()` on its `GridCommandContext`: the selection copy, cut and
paste that Ctrl+C, Ctrl+X and Ctrl+V run, cell by cell through
`processCellForClipboard`. The api's `copyToClipboard` is something else,
the export of the displayed rows with their headers.

### Workbook

These need a workbook attached with `setWorkbook`; without one they decline,
so a single-sheet grid leaves `Ctrl+PageDown` to the browser. See
[workbooks](./workbooks.md).

| Key | Action |
| --- | ------ |
| Ctrl/Cmd + Page Down / Page Up | Next / previous sheet, stepping over hidden ones. |
| Shift + F11 | New sheet. |
| Ctrl/Cmd + O | Open an .xlsx (the shell's File > Open). |
| Ctrl/Cmd + S | Save As .xlsx (File > Save As). |
| Ctrl/Cmd + P | Print the active sheet as its Page Layout says (File > Print). |

## What Ctrl+Arrow actually does

It is not "move a long way". It is a run-boundary search, and the rule depends
on what you are standing on:

- On a filled cell whose neighbour is also filled: run to the **last filled
  cell before the next blank**. This is how you get from the top of a column to
  its bottom in one press.
- On a filled cell whose neighbour is blank: **skip the gap** and land on the
  next filled cell. This is how you hop between blocks.
- On a blank cell: skip to the next filled cell.
- Nothing filled ahead: land on the last cell of the sheet in that direction.

A cell holding `null`, `undefined` or `''` counts as blank. A `0`, a `false`
and a whitespace-only string are content, so a column of zeroes does not trap
the cursor.

## Fill has two behaviours, like Excel

`Ctrl+D` with a **range** selected copies the top row of that range into every
row below it. With a **single cell** selected it pulls from the cell directly
above instead, which is what makes it useful while typing down a column.
`Ctrl+R` mirrors both, across instead of down.

Both run as one undoable action: filling thirty rows takes one `Ctrl+Z`, not
thirty.

Fill is reference-aware: `=A1*2` filled one row down becomes `=A2*2`, while
`=$A$1*B1` keeps its anchor and becomes `=$A$1*B2`. See
[spreadsheet formulas](../spreadsheet-formulas.md).

`Ctrl+'` is deliberately not a fill. It copies the cell above **verbatim**, so
you get an unshifted copy of the formula to edit rather than one that has
already moved.

## Dates land as ISO, not as display text

`Ctrl+;` writes `2026-09-13`, not `13/09/2026`. The value goes into your data
and a column's own [`format`](./cell-data-types.md) decides how it reads;
stamping a localised string would put display text in the model.

## What the grid still owns

`enableSheet()` does not take every key. Copy, cut, plain paste, undo, redo and
find stay with the grid, and the plain arrow keys still move one cell. A command
only claims a key when it has something to do: `Ctrl+D` on the top row with
nothing above it declines, and the key falls through to the grid.

While a cell editor is open, every shortcut here declines, so nothing swallows
a keystroke you meant for the editor.

## Binding your own

The registry the sheet keymap uses is public and free, in `@svgrid/grid`:

```ts
import { registerGridShortcuts } from '@svgrid/grid/shortcuts'

const off = registerGridShortcuts((event, cmd) => {
  if (!(event.ctrlKey && event.key === 'k')) return false
  const active = cmd.activeCell
  if (!active) return false
  cmd.batch(() => {
    for (const [minRow, minCol, maxRow, maxCol] of cmd.ranges) {
      for (let r = minRow; r <= maxRow; r += 1) {
        for (let c = minCol; c <= maxCol; c += 1) cmd.setCellValue(r, c, 0)
      }
    }
  })
  return true          // claim the key; the grid stops here
}, { id: 'my-app', priority: 10 })
```

Return `true` to consume the event, `false` to let it fall through. Higher
`priority` runs first; the sheet keymap registers at 100. Reusing an `id`
replaces that handler rather than stacking a second copy. The returned function
unregisters.

Indices in `cmd` are **display** indices, matching the selection model, so they
follow sort, filter and pagination. That is why `cmd.getCellValue` exists
alongside `api.getCellValue`: the api pair indexes the underlying data array,
and mixing the two gives you the wrong cell as soon as the grid is sorted.

Wrap any multi-cell write in `cmd.batch()` so it undoes in one press.

## While editing

A binding marked `editing: true` runs only inside the cell editor, and the
others only outside it, so Ctrl+D while typing stays a keystroke for the text.
The editor's element reaches such a binding as `cmd.editor`, which is how F4
reads and rewrites the draft. Alt+Enter needs no binding: the grid's
multiline text editor takes it as a line break itself.
