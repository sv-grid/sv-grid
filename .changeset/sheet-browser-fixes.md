---
"@svgrid/grid": patch
"@svgrid/enterprise": patch
---

Fix three defects that only a browser could find.

**Keyboard commands were not undoable.** `cmd.setCellValue` wrote through the
grid's raw writer, which deliberately keeps no history of its own, and never
recorded a step. Every sheet command ran outside undo entirely, so `Ctrl+D`,
`Ctrl+;` and replace-all could not be walked back at all, which is the
opposite of what `cmd.batch` exists to promise. The step is now pushed in the
command context, where the ambient group id from `batch` tags it: a five-cell
date stamp is one `Ctrl+Z`.

**`<SvSheetTabs>` never re-rendered.** A `Workbook` is a plain object, not
`$state`, so reading `workbook.sheets` creates no reactive dependency: the
strip rendered once at mount and then showed a stale sheet list and a stale
selected tab for the rest of its life. Adding a sheet appeared to do nothing
and `Ctrl+PageUp` appeared to jump to the wrong one. It now keeps its own
counter for its own buttons and takes a `version` prop for mutations from
elsewhere. Every existing test passed through this because each asserted the
workbook after an interaction, never the DOM.

The tab buttons were also not owned by their tablist, with an unmarked wrapper
between them; it is `role="presentation"` now.

**Theming.** `SvFormulaBar` and `SvSheetTabs` referenced `--sg-color-border`,
`--sg-color-surface`, `--sg-color-muted`, `--sg-color-accent` and
`--sg-color-danger`, none of which exist. Every one fell back to its
light-theme literal, so on a dark theme the formula bar and the sheet-rename
input rendered white on white. They use the real tokens now.
