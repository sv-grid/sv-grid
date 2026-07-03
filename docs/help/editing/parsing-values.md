# Parsing values

When the user commits an edit, the editor's DOM value (a string for text /
number / date inputs, a boolean for checkboxes) is parsed by
`parseEditorValue` into the canonical value for the column's type.
<div data-docs-demo="24-validation" data-height="540"></div>

```ts
import { parseEditorValue } from '@svgrid/grid'

parseEditorValue('text',     'Ada')          // 'Ada'
parseEditorValue('number',   '42')           // 42
parseEditorValue('number',   '4.5')          // 4.5
parseEditorValue('number',   'NaN')          // null   (rejected - caller decides)
parseEditorValue('number',   '')             // null
parseEditorValue('date',     '2026-05-27')   // '2026-05-27T00:00:00.000Z'
parseEditorValue('datetime', '2026-05-27T14:32') // '2026-05-27T14:32:00.000Z'
parseEditorValue('checkbox', 'true')         // true
parseEditorValue('checkbox', true)           // true
```

The full source is short and worth reading: [`cell-editors.ts`](../../../packages/grid/src/editors/cell-editors.ts).

## Custom parsing with `valueParser`

Add a per-column `valueParser` to refine the committed value **after** the
built-in `parseEditorValue` coercion, before it is written to the row. Return
the final value to store. It runs on every commit and flows through the undo
history and `onCellValueChange`.

```ts
{ field: 'sku', editorType: 'text',
  // "kb 101" -> "KB-101"
  valueParser: ({ newValue }) =>
    String(newValue).trim().toUpperCase().replace(/\s+/g, '-') },

{ field: 'price', editorType: 'text', format: { type: 'currency', currency: 'USD' },
  // accept "$1,299.90" / "1299.9" -> 1299.9
  valueParser: ({ newValue, oldValue }) => {
    const n = Number(String(newValue).replace(/[^0-9.\-]/g, ''))
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : oldValue
  } },

{ field: 'discount', editorType: 'number',
  // clamp 0..100, integer
  valueParser: ({ newValue }) => Math.max(0, Math.min(100, Math.round(Number(newValue) || 0))) },
```

The callback receives `ValueParserParams`:

```ts
type ValueParserParams<TData> = {
  newValue: unknown   // value after built-in per-editorType coercion
  oldValue: unknown   // the cell's previous value
  rawInput: string    // the raw string the editor produced (pre-coercion)
  data: TData         // the row object
  columnId: string
}
```

<div data-docs-demo="175-value-parser" data-height="520"></div>

## What "null" means

`parseEditorValue` returns `null` to signal "could not parse". The grid
treats `null` as an empty value and writes it into the cell. If you want
**invalid input rejected** (the value reverts to its pre-edit state),
intercept before the write - see [Validation](./validation.md).

## See also

- [Saving values](./saving-values.md)
- [Validation](./validation.md)
