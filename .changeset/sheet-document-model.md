---
"@svgrid/enterprise": minor
---

The sheet has a document: `createSheetDocument`, `getState()` / `setState()`
and `onChange` on `SvSheet`.

Everything a sheet keeps beside its cells (formats, column widths, row
heights, hidden lines, frozen panes, per sheet) lived in five private Maps
inside the component, each swapped by hand on a sheet switch and moved by
hand on an insert or delete, and none of it could be saved: `wb.serialize()`
carried the cells and nothing else, so a document reopened with its bold
headers, currency columns and frozen panes gone. The `SheetDocument`
(`createSheetDocument`) is one model for all of it: the workbook plus a
per-sheet state, one `shift()` that moves every position-keyed part on a
structural edit, `getState()` returning plain JSON and `setState()` putting
it back into the same workbook object, and `subscribe()` for changes.
`<SvSheet>` is a view over it: pass `document` to share one with the rest of
the application, or let the shell build its own from `workbook` or `data`
and take it from `onReady(api, document)`. The component's `getState()` and
`setState()` delegate to it; `setState` clears the grid's history, since
none of it describes the restored sheet.

`onChange(reasons)` fires once per tick with every kind of change since the
last call: `cells`, `formats`, `sizes`, `hidden`, `freeze`, `sheets`,
`structure` (with the insert or delete), `restore`. Undo and redo report
too, and a paste of forty cells is one call, which makes it the place for
an autosave.

Also: Column Width... and Row Height... from the header menus are one Ctrl+Z
each, and so are Freeze Panes and Unfreeze; neither recorded anything before.
The structural undo restores the whole document through the same
serialiser. `shiftRect`, `shiftRects`, `subtractRect`, `rectContains`,
`rectsIntersect`, `remapNotes` and `lineShift` are exported for anything
else keyed by cell position.

A hidden row is saved with the height it had before it was hidden, not
the 0 the grid reports while it is hidden, so an Unhide after a restore
brings the row back at its size.
