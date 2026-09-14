---
"@svgrid/enterprise": minor
---

Add the multi-sheet workbook.

The formula engine parsed `Orders!A1` and `'Price list'!A1:C9` from the day it
was promoted, because demo 119 had them. `createWorkbook` is the model those
references point at: named sheets that read each other, with the dependency
graph and structural edits spanning them.

Editing `Budget!A1` reaches `Summary!A2`, which never mentions `A1`. Cycles
are detected across sheets as well as within one.

Cells hold raw text and nothing else; the value, the dependency edges and the
display string are all recomputed from it, so a cached value cannot disagree
with the formula above it. Formula ASTs are cached by their text rather than
their position, so a column of `=A1*2` filled down is one parse.

A sheet has no size beyond what has been typed into it, so reading past the
written area is **blank**. `=SUM(A1:A100)` over a twelve-row sheet is an
ordinary thing to write, and `#REF!` for the empty rows would poison the
total. `#REF!` is kept for a sheet that does not exist and for a negative
index, which is what a reference shifted off the top by a delete becomes.

`applyStructuralEdit` rewrites the whole workbook: a formula on another sheet
holding `=Orders!A3` becomes `=Orders!A4` when a row is inserted in Orders,
while an unqualified reference on that sheet is left alone, because its own
geometry did not change.

`<SvSheetTabs>` is the tab strip: click to switch, double-click or `F2` to
rename, drag to reorder. It owns no state, so the tabs and the shortcuts
cannot disagree about the active sheet. A duplicate or invalid name is
reported rather than silently ignored, and no delete button is rendered on
the last sheet, because the workbook refuses to remove it.

`Ctrl+PageUp` / `Ctrl+PageDown` switch sheets and `Shift+F11` adds one. They
decline with no workbook attached, so a single-sheet grid leaves
`Ctrl+PageDown` to the browser, and they do not wrap at either end, matching
Excel.

Renaming a sheet does not rewrite formulas naming it; that needs a text
substitution over every formula in the workbook, which would also hit a string
literal containing the name. Recorded in `missing-features.md` rather than
done badly.
