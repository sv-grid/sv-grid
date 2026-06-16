# Parsing values

When the user commits an edit, the editor's DOM value (a string for text /
number / date inputs, a boolean for checkboxes) is parsed by
`parseEditorValue` into the canonical value for the column's type.
<div data-docs-demo="24-validation" data-height="540"></div>

```ts
import { parseEditorValue } from 'sv-grid-core'

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

The full source is short and worth reading: [`cell-editors.ts`](../../../packages/sv-grid-community/src/editors/cell-editors.ts).

## What "null" means

`parseEditorValue` returns `null` to signal "could not parse". The grid
treats `null` as an empty value and writes it into the cell. If you want
**invalid input rejected** (the value reverts to its pre-edit state),
intercept before the write - see [Validation](./validation.md).

## Custom parsing

There is no per-column `valueParser` field on `ColumnDef` today. If you
need custom parsing (e.g. accept "$42,500" and turn it into `42500`), you
have two paths:

1. Post-process inside `cell` and store the raw display string.
2. Diff `api.getData()` against your own snapshot after each commit and
   normalise values you want canonicalised.

A per-column `valueParser` is on the
[gap list](../missing-features.md).

## See also

- [Saving values](./saving-values.md)
- [Validation](./validation.md)
