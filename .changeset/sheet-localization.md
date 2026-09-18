---
"@svgrid/enterprise": minor
---

Spreadsheet shell localisation: a `localization` prop on `SvSheet` with
`locale` and `text`, the way the grid's works. Every string the shell
shows lives in one flat map, `SheetMessages`: the ribbon's keys are read
off the ribbon model (`ribbon.tab.home`, `ribbon.bold.title`), the
dialogs' are `<dialog>.<part>` (`formatCells.title`), the chrome's are
plain (`statusReady`, `ok`). Unset keys stay English; sentences carry
`{placeholders}`; `defaultSheetMessages`, `resolveSheetMessages` and
`formatMessage` are exported. The status bar's numbers print in `locale`.
