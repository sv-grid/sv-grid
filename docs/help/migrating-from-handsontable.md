# Migrating from Handsontable

Handsontable's mental model is "spreadsheet-in-a-page": every cell
editable, formulas, copy/paste with the OS clipboard, frozen rows
and columns. Sv-grid covers ~90% of the same surface; the port is
mostly a configuration translation, except for HyperFormula (see
the Formulas section below).

> Estimated effort: **2-4 hours** per grid for typical spreadsheet
> workflows. **Add 1-2 days** if you depend heavily on
> HyperFormula features sv-grid doesn't ship.

<!-- facts:start handsontable -->
> **Facts, checked 12 Sep 2026.** `handsontable` 18.1.0, Commercial (see licence file), last published 1 Sep 2026, 1,190,000 npm downloads in the 30 days to 10 Sep 2026. `@svgrid/grid` 3.0.3, MIT, last published 11 Sep 2026, 16,900 npm downloads in the same window. Bundle, minified and gzipped, each package built alone with Svelte external: SvGrid 3.0.4 95.8 KB JS + 10.5 KB CSS (measured 20 Sep 2026). Handsontable pricing, as its site states it: Handsontable's Hobby licence is free for personal, exploratory projects and cannot be used in commercial settings; handsontable.com lists Standard from $999 per developer and Priority from $1,299 per developer, with Enterprise on custom terms (https://handsontable.com/pricing, read 12 Sep 2026). SvGrid: MIT core; @svgrid/enterprise from $599 per developer per year. Side by side, with sources: [SvGrid vs Handsontable](https://svgrid.com/compare/handsontable/).
<!-- facts:end -->

## Imports

The example at the end of this page runs against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    age: number
    salary: number
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000 },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000 },
    { id: 5, name: 'Barbara Liskov', department: 'Platform',    city: 'Boston',   age: 52, salary: 172000 },
  ]

  let rows = $state<Person[]>(people)

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 200, editorType: 'text' },
    { field: 'department', header: 'Department', width: 150, editorType: 'text' },
    { field: 'city',       header: 'City',       width: 140, editorType: 'text' },
    { field: 'age',        header: 'Age',        width: 90,  editorType: 'number' },
    { field: 'salary',     header: 'Salary',     width: 130, editorType: 'number', format: { type: 'currency', currency: 'USD' } },
  ]
</script>
```

```diff
- import Handsontable from 'handsontable'
- import 'handsontable/dist/handsontable.full.min.css'

+ import {
+   SvGrid, tableFeatures,
+   rowSortingFeature, columnFilteringFeature, rowSelectionFeature,
+   + } from '@svgrid/grid'
```

## Schema → columns

Handsontable accepts a 2D array OR an array of objects. Sv-grid
expects the array-of-objects form:

```diff
- const hot = new Handsontable(container, {
-   data: [
-     ['Tesla',     2017, 'black', false],
-     ['Nissan',    2018, 'blue',  true ],
-   ],
-   colHeaders: ['Make', 'Year', 'Color', 'In stock'],
-   columns: [
-     {},
-     { type: 'numeric' },
-     {},
-     { type: 'checkbox' },
-   ],
- })

+ type Car = { make: string; year: number; color: string; inStock: boolean }
+ const rows: Car[] = [
+   { make: 'Tesla',  year: 2017, color: 'black', inStock: false },
+   { make: 'Nissan', year: 2018, color: 'blue',  inStock: true  },
+ ]
+ const columns: ColumnDef<typeof features, Car>[] = [
+   { field: 'make',    header: 'Make' },
+   { field: 'year',    header: 'Year',     editorType: 'number' },
+   { field: 'color',   header: 'Color' },
+   { field: 'inStock', header: 'In stock', editorType: 'checkbox' },
+ ]
+ <SvGrid data={rows} columns={columns} features={features} />
```

If your existing data is a 2D array, transform once at boot:

```ts
const headerRow = raw[0]
const rows = raw.slice(1).map((cells) =>
  Object.fromEntries(cells.map((v, i) => [headerRow[i], v])),
)
```

## Editor types

| Handsontable                                   | sv-grid                                          |
| ---------------------------------------------- | ------------------------------------------------ |
| `type: 'text'`                                 | `editorType: 'text'`                              |
| `type: 'numeric'`                              | `editorType: 'number'`                            |
| `type: 'date'`                                 | `editorType: 'date'`                              |
| `type: 'checkbox'`                             | `editorType: 'checkbox'`                          |
| `type: 'dropdown', source: [...]`              | `editorType: 'list', editorOptions: [...]`        |
| `type: 'autocomplete'`                         | `editorType: 'list'` (combobox UI ships)          |
| `type: 'time'`                                 | `editorType: 'time'`                              |
| `type: 'password'`                             | Use `editorType: 'text'` + a custom snippet       |

## Selection + clipboard

| Handsontable                            | sv-grid                                                 |
| --------------------------------------- | ------------------------------------------------------- |
| `selectCells([[0,0,2,5]])`              | `api.selectCells(ranges)`, with `selectionMode='cell'`   |
| `getSelected()`                         | `api.getSelected()`: the same `[[startRow, startCol, endRow, endCol], ...]`, normalised to top-left / bottom-right and `[]` rather than `undefined` when nothing is selected |
| `getSelectedLast()`                     | `api.getSelectedLast()`: `[startRow, startCol, endRow, endCol]` with the orientation kept (a range dragged upwards has `startRow > endRow`), or `undefined` |
| `getSelectedRange()` / `getSelectedRangeLast()` | `api.getSelectedRange()` / `api.getSelectedRangeLast()`: `{ from, to, highlight }` per rectangle, the same three fields as `CellRange`; plain data rather than a class, so use `Math.min` / `Math.max` for the corners |
| `copyPaste: true` (default)             | Ships built-in; `enableCellSelection={true}`. The spreadsheet shell also exchanges formats, number formats and formulas with Excel and Google Sheets through the HTML clipboard |
| `fillHandle: true`                      | Ships built-in (drag-to-fill on selected range)          |
| `moveCells: true`                       | `moveCells` - drag the range border to move it, Ctrl / Cmd to copy. On by default; see [move or copy a range](./editing/move-cells.md) |

## Frozen rows / columns

| Handsontable                       | sv-grid                                                |
| ---------------------------------- | ------------------------------------------------------ |
| `fixedColumnsStart: 2`             | `api.setColumnPinning({ left: ['firstColId', 'secondColId'] })` |
| `fixedRowsTop: 1`                  | `pinnedTopRows` (and `pinnedBottomRows`)               |
| `manualColumnFreeze: true`         | Ships via the column-header right-click menu             |
| `mergeCells: [{ row, col, rowspan, colspan }]` | `mergedCells={[{ rowIndex, colIndex, rowSpan, colSpan }]}` on `<SvGrid>`; the spreadsheet shell adds Merge & Center, Merge Across, Merge Cells and Unmerge on the ribbon and the cell menu |

Freeze panes on a plain `<SvGrid>`: two pinned columns and the sticky
letter and number headers, with formulas underneath.

<div data-docs-demo="208-freeze-panes" data-height="520"></div>

## Hooks → callbacks

| Handsontable hook                      | sv-grid                                                 |
| -------------------------------------- | ------------------------------------------------------- |
| `afterChange((changes, src) => {})`    | `onCellValueChange((e) => {...})`                       |
| `afterSelection(...)`                  | `onActiveCellChange((cell) => {...})`                   |
| `afterFilter(...)`                     | `onFiltersChange((f) => {...})`                         |
| `afterColumnSort(...)`                 | `onSortingChange((s) => {...})`                          |
| `beforeChange((changes) => false)`     | Throw / return `false` from your inline validator; see [validation](./editing/validation.md) |
| `afterCreateRow / afterRemoveRow`      | Wrap `api.addRow / removeRow` in your own emitter; on the spreadsheet shell, `onChange` reports a `structure` reason with the edit |
| `afterMergeCells / afterUnmergeCells`  | On the spreadsheet shell, `onChange` reports `merges`; `api.getMergedCells()` reads the grid's list |
| `afterSetCellMeta` (comments, validation) | `onChange` reports `comments`, `validation`, `conditional-formats` and `protection` on the shell |
| `afterFilter` (the Filters plugin)      | `onChange` reports `filter` on the shell; `getState().sheets[name].autoFilter` is the state |

On the spreadsheet shell (`<SvSheet>` in `@svgrid/enterprise`) one callback
covers the lot: `onChange(reasons)` fires once per tick with every kind of
change since the last call (`cells`, `formats`, `sizes`, `hidden`,
`freeze`, `sheets`, `comments`, `protection`, `validation`,
`conditional-formats`, `merges`, `filter`, `structure` with the insert or
delete, `restore`), which is where Handsontable's `afterChange` autosave
goes. `getState()` gives the document to save and `setState()` puts it back.

## Cell meta → the sheet document

Handsontable keeps comments, validators, read-only flags and merges as cell
meta on the instance. On the spreadsheet shell they are parts of the
document, per sheet, saved with it and moved by inserts and deletes:

| Handsontable                                        | sv-grid spreadsheet shell                                       |
| --------------------------------------------------- | --------------------------------------------------------------- |
| `comments: true`, `cell: [{ row, col, comment }]`  | Review > New Comment, Shift+F2, the cell menu; `getState().sheets[name].comments` |
| `validator: 'numeric'`, `allowInvalid: false`    | Data > Data Validation (Whole number, Decimal, List, Date, Text length, Custom), Stop or Warning; `validation` in the state |
| `readOnly: true` on a cell                          | Format Cells > Protection unlocks the cells that may change, Review > Protect Sheet locks the rest; `locked: false` in the format entry, `protected` per sheet |
| `mergeCells`                                        | Merge & Center on the ribbon and the cell menu; `merges` in the state |
| `filters: true` + `dropdownMenu`                    | Ctrl+Shift+L or Data > Filter: Excel's AutoFilter arrows and menus; `autoFilter` in the state |
| conditional formatting (a custom renderer)          | Home > Styles > Conditional Formatting: Highlight Cells, Top/Bottom, Data Bars, Color Scales, Icon Sets, Manage Rules; `conditionalFormats` in the state |
| `autofill` rules                                    | The fill handle's own series: numbers, dates by day or by the set gap, `Item 1`, weekdays and months |

On a plain `<SvGrid>` the free grid has the primitives instead: `notes`
and `editableComments` for comments, `editable` and `valueParser` on a
column for read-only cells and validation, `mergedCells` for merges, the
filter row and its Excel-style menu for filtering, and value-driven
`conditionalFormats` by column.

## Formulas (HyperFormula)

Sv-grid ships a focused subset under
[`spreadsheet-formulas`](./spreadsheet-formulas.md) (SUM, IF, COUNTIF
+ cell refs + ranges + cycle detection). It does NOT ship the full
HyperFormula library.

If you need HyperFormula's full surface (~400 functions, complex
date math, R1C1 refs), the integration pattern is:

```ts
import { HyperFormula } from 'hyperformula'

const hf = HyperFormula.buildFromArray(rowsAsMatrix, { licenseKey: 'gpl-v3' })

// On every cell edit, push to HF + read back the computed value:
function onCellValueChange(e) {
  hf.setCellContents({ sheet: 0, row: e.rowIndex, col: columnIndex }, e.newValue)
  // ...read computed cells you depend on + push back via api.setCellValue
}
```

This is the only piece where the swap isn't 1:1. Most teams find
sv-grid's shipped subset covers 80% of real-world formula usage; if
yours is in the 20%, HyperFormula plugs in with the pattern above.

## Licence

Handsontable's grid needs a commercial licence for commercial use; its free
Hobby licence is for personal, exploratory projects, as its pricing page
states (the wording and the date are in the facts box at the top of this
page). Sv-grid's `@svgrid/grid` is MIT with no licence key, and the
[Enterprise tier](../enterprise/licensing.md) is soft-gated: it works without
a key and shows a watermark until you add one, so there is no cutoff to plan
around.

## What you get for free vs Handsontable

- **No commercial licence for the grid.** @svgrid/grid is MIT.
- **Modern Svelte 5 ergonomics.** `$state` arrays beat
  `loadData(...)`.
- **Grid features a spreadsheet does not have.** Row grouping with
  aggregation, master/detail, server-side data (grouping, tree, pivot and transactions on the server are Enterprise) and integrated
  charts in the same package.
- **CSP-clean.** Handsontable's HyperFormula path needs CSP `eval`
  exceptions in some configurations.

## What you give up

- **Full HyperFormula surface as a supported feature.** Sv-grid ships a
  subset and lets you wire HyperFormula yourself; see above.
- **Nested headers.** Handsontable's `nestedHeaders` have no
  counterpart beyond column groups.
- **Threaded comments and a validation Input Message.** Comments on the
  shell are Excel's notes, one text per cell; validation shows its message
  on a refusal, not on arrival.
- **Excel export without a paid pack.** Handsontable's export plugin writes
  XLSX through its asynchronous method; on sv-grid, CSV, TSV and JSON export
  are free and Excel, PDF and print output are in `@svgrid/enterprise`.

## Frequently asked questions

### Can SvGrid replace Handsontable's spreadsheet features?

It covers roughly 90% of the surface - inline editing on every cell, copy/paste
as TSV, range selection, column groups, and a built-in formula engine. Budget
2-4 hours per grid for typical spreadsheet workflows, plus 1-2 days if you lean
heavily on the full HyperFormula function set.

### Does SvGrid support formulas like Handsontable?

Yes, a built-in formula engine with cell references, ranges, and common
functions (see the spreadsheet-formulas guide and demo 27). It is a practical
subset rather than the complete HyperFormula library, so verify your specific
functions before porting.

### Is SvGrid licensed like Handsontable?

No. The `@svgrid/grid` core is MIT and free for commercial use - no per-seat
licence key - whereas Handsontable's free licence excludes commercial use and
its commercial plans are per developer; the facts box has the statement as
read from handsontable.com. The optional `@svgrid/enterprise` pack (Excel and
PDF export, print, pivot, import) is priced per developer.

### Does SvGrid have a blank spreadsheet like Handsontable?

Yes, on the plain grid: column-letter headers, a row gutter, a name box
and formula bar, gridlines, range selection and a fill handle, with
HyperFormula underneath when you want its function library.

<div data-docs-demo="207-blank-sheet" data-height="560"></div>

## What you end up with

Spreadsheet behaviour: inline edit, drag a cell range, copy it out as TSV.

```svelte {runnable}
<SvGrid data={rows} {columns} editable enableCellSelection statusBar />
```

## See also

- [SvGrid vs Handsontable](https://svgrid.com/compare/handsontable/) - the side-by-side comparison, with a source and date for every claim
- [Spreadsheet formulas](./spreadsheet-formulas.md) - sv-grid's
  built-in formula engine, and the rest of the spreadsheet demos
- [Demo 27 (Spreadsheet + Ribbon)](https://svgrid.com/demos/27-spreadsheet-ribbon/) - live
- [Migrating from AG Grid](./migrating-from-ag-grid.md)
