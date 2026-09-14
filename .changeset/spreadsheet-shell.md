---
"@svgrid/grid": minor
"@svgrid/enterprise": minor
---

Add the spreadsheet shell: `<SvSheet>` and `<SvSheetRibbon>`.

Spreadsheet mode looked like a data grid. The Excel-ness was real but
scattered across demos as inline code: one demo had a ribbon, another had
column letters and a row gutter, a third had sheet tabs. None of it was
importable.

`<SvSheet workbook={wb} />` is the whole surface: a ribbon (Home, Insert,
Formulas, Data), the Name Box and fx bar showing the **raw** text behind the
active cell, A..Z headers over the built-in 1..N row gutter, sheet tabs, and a
Sum / Average / Count status bar. With no props at all it opens an empty
single-sheet workbook. Any part of the chrome can be switched off.

This is composition rather than a second grid: every part already existed, and
what the component adds is the wiring between them. The format store is keyed
by row id so sorting cannot strand formatting; insert and delete go through
the workbook so references are rewritten on every sheet rather than the active
one; the fill handle translates references; the tab strip is told when a
shortcut moved the active sheet.

The ribbon is data (`RIBBON_TABS`), the same shape as `SHEET_BINDINGS`, and
every button calls one of the action functions the keymap binds, now exported
rather than private. Clicking a bold cell lights the Bold button and `Ctrl+B`
puts it out, because both are one call reading one store. Buttons that need
chrome this layer does not own (a function picker, a Goal Seek dialog, Text to
Columns options) carry no action and arrive at your `onAction` handler
instead.

It is painted with the grid's `--sg-*` tokens rather than Excel's palette, so
it reads as Excel through layout and still matches whatever theme the app
runs. The `excel` preset gives it Excel's colours too.

`SvSheet` takes `formats` keyed by A1 address and `columnWidths` keyed by
column letter, so a document can open looking the way it was saved.

On the MIT side, `api.getCommandContext()` returns the same
`GridCommandContext` a registered shortcut handler receives. A keyboard
command is handed one on every keystroke; a ribbon button has no keystroke to
ride in on, and without this every action would have to be re-implemented
against the public api and kept in step by hand. No measurable change to the
base bundle.

Two fixes fell out of building it. `store.toggle` was typed to four fields
while its implementation was already field-generic, so Wrap Text could not use
it; the type is now a named `ToggleableField`. And `setSheetValueProbe` lets
AutoSum measure its run against **evaluated** values: cells hold raw text, so
a column of `=SUM(...)` subtotals previously read as strings and AutoSum
declined, which is the opposite of Excel, where a formula producing a number
is a number.
