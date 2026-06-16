# Cell data types

The `editorType` field on a column tags the column with a type. This drives
three different behaviours:
<div data-docs-demo="01-quick-start" data-height="540"></div>

| Effect | Driven by `editorType` |
| ------ | --------------------- |
| Which inline editor opens on `F2` / double-click | yes - `text` / `number` / `date` / `datetime` / `checkbox` |
| Which sort comparator is used | yes - `number` and `date`/`datetime` pick non-default `sortFns` |
| Which filter operators the column menu offers | yes - text / number / date / checkbox sets differ |

## Setting it

```ts
const columns: ColumnDef<{}, Person>[] = [
  { field: 'firstName',  header: 'First',    editorType: 'text' },
  { field: 'age',        header: 'Age',      editorType: 'number' },
  { field: 'joinedAt',   header: 'Joined',   editorType: 'date' },
  { field: 'startTime',  header: 'Start',    editorType: 'datetime' },
  { field: 'active',     header: 'Active',   editorType: 'checkbox' },
]
```

Even if you do not enable inline editing, set `editorType` so sort and
filter behave correctly for the column's data type. A `number` column
without `editorType` sorts as lexical strings.

## Built-in types

| `editorType` | accepted value space |
| ------------ | -------------------- |
| `'text'`     | strings |
| `'number'`   | numbers (or numeric strings) |
| `'date'`     | ISO date strings (`YYYY-MM-DD`) or `Date` |
| `'datetime'` | ISO datetime strings or `Date` |
| `'checkbox'` | booleans |

## Custom types

There is no plug-in "register a new cell data type" API. To use a custom
type:

- Render with a custom `cell` (see [Cell components](./cell-components.md))
- Sort with a custom value through `accessorFn` that normalises to a
  comparable primitive
- Filter with a custom operator UI in your own header component

## Editor value parsing

The editor receives a string from the DOM and converts to the canonical
value before commit. The implementation lives in
[`parseEditorValue`](../../../packages/sv-grid-community/src/editors/cell-editors.ts).

```ts
import { parseEditorValue } from 'sv-grid-core'

parseEditorValue('number',   '42')      // 42
parseEditorValue('number',   'abc')     // NaN - caller should reject
parseEditorValue('checkbox', 'true')    // true
parseEditorValue('date',     '2026-05-27')  // '2026-05-27'
```

## See also

- [Provided cell editors](../editing/provided-editors.md)
- [Filter conditions](../filtering/filter-conditions.md)
