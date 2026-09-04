# Migrating from Handsontable

Handsontable's mental model is "spreadsheet-in-a-page": every cell
editable, formulas, copy/paste with the OS clipboard, frozen rows
and columns. Sv-grid covers ~90% of the same surface; the port is
mostly a configuration translation, except for HyperFormula (see
the Formulas section below).

> Estimated effort: **2-4 hours** per grid for typical spreadsheet
> workflows. **Add 1-2 days** if you depend heavily on
> HyperFormula features sv-grid doesn't ship.

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
| `type: 'time'`                                 | Use `editorType: 'text'` + your own format        |
| `type: 'password'`                             | Use `editorType: 'text'` + a custom snippet       |

## Selection + clipboard

| Handsontable                            | sv-grid                                                 |
| --------------------------------------- | ------------------------------------------------------- |
| `selectCells([[0,0,2,5]])`              | `selectionMode='cell'`; programmatic range API is in v2 |
| `getSelected()`                         | Combine `onActiveCellChange` + `onRowSelectionChange`    |
| `copyPaste: true` (default)             | Ships built-in; `enableCellSelection={true}`             |
| `fillHandle: true`                      | Ships built-in (drag-to-fill on selected range)          |

## Frozen rows / columns

| Handsontable                       | sv-grid                                                |
| ---------------------------------- | ------------------------------------------------------ |
| `fixedColumnsStart: 2`             | `api.setColumnPinning({ left: ['firstColId', 'secondColId'] })` |
| `fixedRowsTop: 1`                  | n/a - use header row + grouped header for sticky labels |
| `manualColumnFreeze: true`         | Ships via the column-header right-click menu             |

## Hooks → callbacks

| Handsontable hook                      | sv-grid                                                 |
| -------------------------------------- | ------------------------------------------------------- |
| `afterChange((changes, src) => {})`    | `onCellValueChange((e) => {...})`                       |
| `afterSelection(...)`                  | `onActiveCellChange((cell) => {...})`                   |
| `afterFilter(...)`                     | `onFiltersChange((f) => {...})`                         |
| `afterColumnSort(...)`                 | `onSortingChange((s) => {...})`                          |
| `beforeChange((changes) => false)`     | Throw / return `false` from your inline validator; see [validation](./editing/validation.md) |
| `afterCreateRow / afterRemoveRow`      | Wrap `api.addRow / removeRow` in your own emitter        |

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

## Trial → license

Handsontable's commercial trial expires after 45 days. Sv-grid's
[Enterprise tier](../enterprise/licensing.md) is soft-gated (works forever, with
a watermark for unlicensed builds) - no hard cutoff to plan around.

## What you get for free vs Handsontable

- **No GPLv3 licensing fork.** @svgrid/grid is MIT.
- **Modern Svelte 5 ergonomics.** `$state` arrays beat
  `loadData(...)`.
- **CSP-clean.** Handsontable's HyperFormula path needs CSP `eval`
  exceptions in some configurations.

## What you give up

- **Full HyperFormula surface.** Sv-grid ships a subset; see above.
- **Comments + named ranges.** Not in sv-grid today.
- **Merge cells UI.** Sv-grid supports column groups + row spanning
  but no drag-to-merge UI yet.

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

The `@svgrid/grid` core is MIT and free for commercial use - no per-seat
license key. The optional `@svgrid/enterprise` pack (export, pivot, import) is priced
per developer.

## What you end up with

Spreadsheet behaviour: inline edit, drag a cell range, copy it out as TSV.

```svelte {runnable}
<SvGrid data={rows} {columns} editable enableCellSelection statusBar />
```

## See also

- [SvGrid vs Handsontable](https://svgrid.com/compare/handsontable/) - the side-by-side comparison
- [Spreadsheet formulas](./spreadsheet-formulas.md) - sv-grid's
  built-in formula engine
- [Demo 27 (Spreadsheet + Ribbon)](https://svgrid.com/demos/27-spreadsheet-ribbon/) - live
- [Migrating from AG Grid](./migrating-from-ag-grid.md)
