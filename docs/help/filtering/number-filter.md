# Number filter

A column with `editorType: 'number'` gets the **number** filter operator
set: `equals`, `greaterThan`, `lessThan`, **`between`**, `isBlank`. The
default operator is `equals`.
<div data-docs-demo="64-filter-between-operator" data-height="540"></div>

```ts
const columns: ColumnDef<{}, Person>[] = [
  { field: 'age',    header: 'Age',    editorType: 'number' },
  {
    field: 'salary', header: 'Salary', editorType: 'number',
    format: { type: 'currency', currency: 'USD' },
  },
]
```

## Range - `between`

Pick **Between** in the column menu's operator picker and the second
input ("To") appears next to the first ("From"). Both endpoints are
**inclusive**.

Programmatically:

```ts
api.setFilter('age', { operator: 'between', value: '18', valueTo: '65' })
```

Or via the headless filter helper:

```ts
import { applyExcelFilter } from '@svgrid/grid'

applyExcelFilter(72, { id: 'age', operator: 'between', value: 18, valueTo: 65 })
// → false (72 > 65)
```

The grid treats the filter as inactive when either endpoint is empty.
That way the user can type `from = 18` and the grid keeps showing
every row until they finish typing the `to` value too.

## Numeric input parsing

The filter value comes in from the DOM as a string. Use `parseEditorValue`
to convert:

```ts
import { parseEditorValue } from '@svgrid/grid'

parseEditorValue('number', '4.5')   // 4.5
parseEditorValue('number', 'abc')   // NaN - reject
```

The grid does this for you when the user types into a header filter.

## Locale

Number filters compare raw `Number(cellValue)` against `Number(filter.value)`.
They do not parse "1,234.50" or "1 234,50" - feed the column raw numbers,
and use a `format` on the column for display.

## See also

- [Filter conditions](./filter-conditions.md)
- [Number editor](../editing/provided-editors.md#number-editor)
