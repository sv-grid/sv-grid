# API reference

A flat index of every Stable export. Each entry links to the topic
page that covers it in depth. For the formal TypeScript shapes,
inspect the `.d.ts` files in `node_modules/@svgrid/grid/dist` -
they're the source of truth and ship with full JSDoc.

> The "Tier" column reflects the badges from
> [API stability](./api-stability.md). Anything not listed here is
> Internal and may move under your feet.

## @svgrid/grid

### Components

| Export                | Tier         | What it is                                                                                     |
| --------------------- | ------------ | ---------------------------------------------------------------------------------------------- |
| `SvGrid`              | Stable       | The render component. See [Getting Started §1](../getting-started.md#1-your-first-grid-in-60-seconds). |
| `FlexRender`          | Stable       | Helper for rendering `cell` / `header` / `footer` templates inside custom UIs.                  |

### Engine

| Export                | Tier         | What it is                                                                                    |
| --------------------- | ------------ | --------------------------------------------------------------------------------------------- |
| `createSvGrid`        | Stable       | Build a headless grid instance; the `<SvGrid>` component is a thin wrapper around this.       |
| `tableFeatures`       | Stable       | Bundle features (sorting, filtering, ...) into a single typed object for use in column generics. |
| `createGridState`     | Stable       | Controlled-state helper that returns a `[get, set]` pair compatible with Svelte's `$state`.   |

### Features (row models)

| Export                       | Tier   | Enables                                          |
| ---------------------------- | ------ | ------------------------------------------------ |
| `rowSortingFeature`          | Stable | Column-header click to sort, programmatic sort.  |
| `columnFilteringFeature`     | Stable | Per-column filters (operator + value + menu).    |
| `rowSelectionFeature`        | Stable | Single + multi row selection with checkboxes.    |
| `columnGroupingFeature`      | Stable | Multi-level column header groups.                |
| `rowExpandingFeature`        | Stable | Expand / collapse rows (master-detail, trees).   |

### Imperative API (`SvGridApi`)

Reached via `<SvGrid onApiReady={(api) => /* ... */}>`. Every method
is Stable.

| Method                              | Purpose                                                            |
| ----------------------------------- | ------------------------------------------------------------------ |
| `getCellValue(rowIndex, columnId)`  | Read a cell value.                                                 |
| `setCellValue(rowIndex, columnId, v)` | Write a cell value, runs through the same write pipeline as inline edit. |
| `addRow(row, position?)`            | Insert one row at top / bottom / numeric index.                    |
| `addRows(rows, position?)`          | Bulk insert.                                                       |
| `removeRow(rowIndex)`               | Remove one row by data-array index.                                |
| `removeRows(rowIndices)`            | Bulk remove.                                                       |
| `addColumn(column, position?)`      | Insert one column at left / right / numeric index.                 |
| `addColumns(columns, position?)`    | Bulk insert.                                                       |
| `removeColumn(columnId)`            | Remove one column by id (or field).                                |
| `setColumnVisible(columnId, visible)` / `isColumnVisible(columnId)` | Column visibility.                              |
| `setSort(columnId, dir)` / `clearSort()` | Programmatic sort.                                            |
| `setGroupBy(columnIds)`             | Set the group-by columns.                                          |
| `setFilter(columnId, filter)` / `clearFilter(columnId)` / `clearAllFilters()` | Programmatic filtering.        |
| `getFilters()`                      | Snapshot the active column-menu filters.                           |
| `getDisplayedRows()`                | Snapshot the currently displayed rows (after filter/sort/page).    |
| `getData()`                         | Snapshot the raw `data` prop.                                      |
| `clearRowSelection()`               | Untick every selected row.                                         |

### Column definition (`ColumnDef`)

| Property            | Tier   | Notes                                                                |
| ------------------- | ------ | -------------------------------------------------------------------- |
| `id`                | Stable | Use when no `field` (e.g. computed columns).                         |
| `field`             | Stable | Row property the cell reads + writes by default.                     |
| `accessorFn`        | Stable | Replace the `field`-based read with a function. Used heavily by pivot. |
| `header`            | Stable | String or a render template.                                         |
| `footer`            | Stable | Same shape as header.                                                |
| `cell`              | Stable | Custom cell render template.                                         |
| `columns`           | Stable | Nested children → multi-row header groups.                           |
| `editorType`        | Stable | `'text'` / `'number'` / `'date'` / `'datetime'` / `'checkbox'` / `'list'` / `'chips'`. |
| `editorOptions`     | Stable | Option list for `list` + `chips` editors. Static array or `(row) => array`. |
| `editorMultiple`    | Stable | Allow multi-select on `list` / `chips`.                              |
| `editorSeparator`   | Stable | Join character for multi-value display.                              |
| `editable`          | Stable | `boolean | (ctx) => boolean` - per-column or per-cell gate.          |
| `format`            | Stable | Built-in formatter (`number` / `currency` / `percent` / `date`).     |
| `formatter`         | Stable | Free-form formatter callback.                                        |
| `width`             | Stable | Pixel width (default falls back to grid's `columnWidth`).            |

### Types

| Export                | Tier   | Purpose                                                              |
| --------------------- | ------ | -------------------------------------------------------------------- |
| `ColumnDef`           | Stable | Column definition shape (see table above).                           |
| `CellContext`         | Stable | The `ctx` object passed to `cell` / `editable` / `formatter`.        |
| `HeaderContext`       | Stable | The `ctx` object passed to `header` / `footer`.                      |
| `Row` / `Cell` / `Column` / `Header` / `HeaderGroup` | Stable | Engine objects you can read inside templates. |
| `SvGridApi`           | Stable | The imperative API shape (every method above is on this interface).  |
| `RowData`             | Stable | Alias for `Record<string, unknown>`; the row shape constraint.       |
| `TableFeatures`       | Stable | The shape of the bag `tableFeatures()` returns.                      |

### Static utilities

Re-exports from `'@svgrid/grid/static-functions'` for use outside
a Svelte 5 component:

| Export                       | Tier   | What it is                                              |
| ---------------------------- | ------ | ------------------------------------------------------- |
| `sortRows(rows, sorting)`    | Stable | Pure sort helper. Same comparator the grid uses.        |
| `filterRows(rows, filters)`  | Stable | Pure filter helper.                                     |
| `groupRows(rows, groupBy, aggregators)` | Stable | Pure group-and-aggregate helper.            |
| `getDisplayedRows(rows, state)` | Stable | One-shot pipeline (filter → sort → group → page).    |

## @svgrid/enterprise

### Installation

| Export       | Tier   | What it is                                                                                 |
| ------------ | ------ | ------------------------------------------------------------------------------------------ |
| `installEnterprise(api)` | Stable | Augments a `SvGridApi` with `exportData`, `print`, `importData`, and `ai.*`.          |
| `EnterpriseGridApi`      | Stable | The post-install API shape.                                                          |

### License

| Export              | Tier   | Purpose                                                       |
| ------------------- | ------ | ------------------------------------------------------------- |
| `setLicenseKey(s)`  | Stable | Register a key at startup.                                    |
| `clearLicenseKey()` | Stable | Tear down the key on logout, etc.                             |
| `getLicenseKey()`   | Stable | Inspect the current key (returns `null` when unset).          |
| `isLicenseKeySet()` | Stable | Boolean for "any key registered".                             |
| `hasValidLicense()` | Stable | Boolean for "key passes prefix + revocation check".           |
| `assertEnterpriseLicensed()` | Stable | Throws on a malformed / revoked key, soft-warns when unset. |
| `dismissUnlicensedNudge()` | Stable | Suppress the console one-time nudge.                   |

### Export + print

| Export                   | Tier   | Purpose                                                              |
| ------------------------ | ------ | -------------------------------------------------------------------- |
| `exportGrid(api, opts)`  | Stable | Same as `api.exportData(opts)` for use without `installEnterprise`.         |
| `printGrid(api, opts?)`  | Stable | Same as `api.print(opts)`.                                           |
| `ExportFormat`           | Stable | `'xlsx' | 'pdf' | 'csv' | 'tsv' | 'html'`.                          |
| `ExportOptions` / `ExportColumn` | Stable | Option shape (see [Data export and printing](./export.md)).  |
| `PrintOptions`           | Stable | Option shape.                                                        |

### Import

| Export                | Tier                          | Purpose                                                  |
| --------------------- | ----------------------------- | -------------------------------------------------------- |
| `importData(api, opts)` | Stable, accepting feedback | Same as `api.importData(opts)`.                          |
| `ImportFormat`        | Stable, accepting feedback    | `'xlsx' | 'csv' | 'tsv' | 'json' | 'auto'`.              |
| `ImportOptions<T>`    | Stable, accepting feedback    | File + format + column map + validator + commit options. |
| `ImportResult<T>`     | Stable, accepting feedback    | `{ headers, rows, errors, skipped, total, format }`.     |
| `ImportColumnMap`     | Stable, accepting feedback    | `Record<sourceHeader, targetField | null>`.              |
| `ImportRowError`      | Stable, accepting feedback    | `{ rowIndex, field, message }`.                          |
| `ImportValidator<T>`  | Stable, accepting feedback    | `(row, i) => Array<{ field, message }>`.                 |

### AI assistant

| Export                | Tier                       | Purpose                                                                   |
| --------------------- | -------------------------- | ------------------------------------------------------------------------- |
| `setAIProvider(fn)`   | Stable, accepting feedback | Register the BYO model adapter.                                           |
| `getAIProvider()` / `hasAIProvider()` | Stable, accepting feedback | Inspect registration.                                          |
| `mockAIProvider`      | Experimental               | Deterministic canned shapes per task; for demos + tests only.             |
| `AIProvider`          | Stable, accepting feedback | `(req: AIRequest) => Promise<string>`.                                    |
| `AIRequest`           | Stable, accepting feedback | `{ prompt, responseFormat, signal, task, maxOutputTokens }`.              |
| `AITask`              | Stable, accepting feedback | `'filter' | 'smart-fill' | 'summarize' | 'classify'`.                    |
| `aiFilter`            | Stable, accepting feedback | NL query → filter/sort plan (with optional `apply`).                      |
| `AIFilterOptions` / `AIFilterResult` / `AIFilterClause` / `AISortClause` | Stable, accepting feedback | Shapes.                  |
| `aiSmartFill`         | Stable, accepting feedback | Examples → predicted values for empty cells.                              |
| `AISmartFillOptions` / `AISmartFillResult` / `AISmartFillExample` | Stable, accepting feedback | Shapes.                |
| `aiSummarize`         | Stable, accepting feedback | Row / selection / group / all → text + bullets + highlighted fields.      |
| `AISummarizeOptions` / `AISummarizeTarget` / `AISummary` | Stable, accepting feedback | Shapes.                            |
| `aiClassify`          | Stable, accepting feedback | Free-text cells → bucketed labels.                                        |
| `AIClassifyOptions` / `AIClassifyResult` | Stable, accepting feedback | Shapes.                                       |

## Subpath exports

Both packages support fine-grained imports so you only pay for what
you use:

```ts
import { setAIProvider } from '@svgrid/enterprise/ai'
import { importData } from '@svgrid/enterprise/import'
import { exportGrid } from '@svgrid/enterprise/export'
import { printGrid } from '@svgrid/enterprise/print'
```

The `package.json` `exports` map lists the supported paths.

## See also

- [API stability](./api-stability.md) - what the tiers mean + semver
  policy.
- [Error reference](./errors.md) - every typed error this surface
  throws.
- [Testing and quality](./testing-and-quality.md) - the unit-test
  coverage backing each entry above.
