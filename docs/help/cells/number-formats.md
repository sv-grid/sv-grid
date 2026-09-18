# Number formats and cell styles

In Excel, format is a property of the **cell**, not the column. Two cells in
the same column can show `$1,234.50` and `123450%` from the same stored number.
`@svgrid/enterprise` ships that: an Excel format-string compiler, and a store
that keeps per-cell formatting alive through sorting.

```ts
import {
  compileNumberFormat, createFormatStore, entryToStyle,
} from '@svgrid/enterprise/sheet'
```

<div data-docs-demo="453-formula-bar-formats" data-height="560"></div>

> This is different from the column-level [`format`](./cell-data-types.md)
> prop, which is `Intl`-based and applies to every cell in a column. Use that
> when a column has one meaning; use this when the user picks per cell.

## Formatting a value

```ts
const money = compileNumberFormat('$#,##0.00;($#,##0.00)')

money.format(1234.5)    // { text: '$1,234.50' }
money.format(-1234.5)   // { text: '($1,234.50)' }
```

Compilation is cached per pattern, so a column of ten thousand cells sharing
one format parses it once. `formatWithPattern(value, pattern)` is the one-shot
convenience.

## The pattern grammar

### Sections

A pattern has up to four sections separated by `;`:

```
positive ; negative ; zero ; text
```

With **two**, the second covers negatives *and* zero. With **one**, it covers
everything.

A negative rendered by its own section uses its **absolute** value, because
that section supplies the sign:

```ts
formatWithPattern(-1.5, '0.00;(0.00)')   // '(1.50)'  not '(-1.50)'
```

### Digit placeholders

| Token | Meaning |
| ----- | ------- |
| `0` | A digit, or a zero if there is none |
| `#` | A digit, or nothing |
| `?` | A digit, or a space (so decimal points line up) |

```ts
formatWithPattern(5, '000')       // '005'
formatWithPattern(0, '#')         // ''      hides zeros
formatWithPattern(1.5, '0.0#')    // '1.5'   second decimal only when present
formatWithPattern(1.55, '0.0#')   // '1.55'
```

### Separators and scaling

`,` between placeholders groups thousands. `,` immediately before the decimal
point or at the end of the pattern **divides** by a thousand per comma:

```ts
formatWithPattern(1234567, '#,##0')      // '1,234,567'
formatWithPattern(1500000, '0,,"M"')     // '2M'
formatWithPattern(1500, '0.0,"k"')       // '1.5k'
```

`%` multiplies by 100 and prints the sign. `E+` switches to scientific, where
the placeholders **after** the `E+` size the exponent rather than the mantissa:

```ts
formatWithPattern(0.425, '0.00%')        // '42.50%'
formatWithPattern(12345, '0.00E+00')     // '1.23E+04'
```

### Colours and literals

`[Red]`, `[Blue]`, `[Green]`, `[Black]`, `[White]`, `[Cyan]`, `[Magenta]` and
`[Yellow]` set a colour rather than printing. It comes back on the result:

```ts
compileNumberFormat('0.00;[Red](0.00)').format(-5)
// { text: '(5.00)', color: '#ff0000' }
```

Text in quotes, or after a backslash, is emitted as-is. `@` in the fourth
section is the text placeholder.

`_x` (leave the width of `x`) and `*x` (fill the cell with `x`) both render
as one space: text has no cell width to leave or fill. That is enough for
Excel's accounting patterns to read as `$ 1,234.50` with the symbol on the
left and the number on the right.

A condition in brackets picks a section by value: the first section whose
condition the value passes is used, and a section without one is the
fallback. `[<=9999999]###-####;(###) ###-####` is Excel's phone number.

```ts
formatWithPattern(50, '[<100]"small";"big"')    // 'small'
formatWithPattern(5551234567, '[<=9999999]###-####;(###) ###-####')
// '(555) 123-4567'
```

### Masks

Literal text between integer placeholders turns the integer side into a
mask that the digits are laid into from the right. Excel's Special formats
are all masks:

```ts
formatWithPattern(123456789, '000-00-0000')   // '123-45-6789'
formatWithPattern(1234, '00000')              // '01234'
formatWithPattern(1234, '###-####')           // '-1234'   as Excel gives
```

`SPECIAL_FORMATS` holds the four: `zip`, `zip4`, `phone` and `ssn`.

### Dates

A pattern containing date tokens is a date pattern.

| Token | Gives |
| ----- | ----- |
| `yyyy` `yy` | 2026, 26 |
| `mmmm` `mmm` `mm` `m` | September, Sep, 09, 9 |
| `dddd` `ddd` `dd` `d` | Monday, Mon, 14, 14 |
| `hh` `h` `ss` `s` | Hours and seconds |
| `AM/PM` | Meridiem |

`m` and `mm` mean **minutes** after an hour token and **months** otherwise, so
`hh:mm` gives `15:05` rather than `15:09`.

Numbers are read as Excel serial days against the 1899-12-30 epoch. That is
correct from 1900-03-01 on; Excel itself is a day out below serial 61 because
it counts a 1900-02-29 that never existed, and matching that bug exactly would
break real dates.

### Presets

`FORMAT_PRESETS` holds what `Ctrl+Shift+1` through `6` apply: `number`, `time`,
`date`, `currency`, `percent`, `scientific`, plus `general` and `accounting`,
which the ribbon's `$` button applies, as Excel's does.

`accountingPattern(symbol, decimals)` spells an accounting pattern for any
symbol (an empty one is Excel's "None"), and `accountingParts` reads one
back, which is how Increase Decimal works on an accounting cell:

```ts
accountingPattern('$', 2)
// '_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)'
formatWithPattern(1234.5, accountingPattern('$', 2))   // ' $ 1,234.50 '
formatWithPattern(-1234.5, accountingPattern('$', 2))  // ' $ (1,234.50)'
```

## The per-cell store

```ts
const store = createFormatStore()

const lookup = {
  rowIdAt: (i) => rows[i]?.id ?? null,
  columnIdAt: (i) => FIELDS[i] ?? null,
}

store.set([[0, 2, 4, 3]], { numFmt: '$#,##0.00' }, lookup)
store.toggle([[0, 0, 0, 4]], 'bold', lookup)
store.get('r1', 'price')     // { numFmt: '$#,##0.00' }
```

Ranges are `[minRow, minCol, maxRow, maxCol]` in **display** coordinates, the
same as `cmd.ranges`. The store converts them to row and column **ids** on the
way in, which is what makes formatting survive a sort: keying by display index
means sorting leaves the bold on whatever row now sits at that position.

| Method | Does |
| ------ | ---- |
| `set(rects, patch, at)` | Merge. A field set to `undefined` is removed. |
| `clear(rects, at)` | Remove every entry in the range. |
| `toggle(rects, field, at)` | Excel's rule: all-on turns off, mixed turns on. |
| `forgetRow(id)` / `forgetColumn(id)` | Call when one is deleted, or entries leak. |
| `serialize()` / `hydrate()` | The only persistence path. |

`entryToStyle(entry)` renders one to inline CSS for a cell renderer.

### Wiring the shortcuts

`Ctrl+B`, `Ctrl+Shift+4` and the rest write through whatever store you attach.
Until you attach one they decline, so the key falls through to the grid rather
than looking broken:

```ts
import { enableSheet, setFormatTarget } from '@svgrid/enterprise'

enableSheet()
setFormatTarget({ store, lookup, onChange: () => (version += 1) })
```

`Ctrl+1` calls `setFormatDialogHandler(fn)` if you registered one. The shortcut
layer ships no dialog: what a Format Cells dialog should look like is a design
decision, not a keyboard one.

## Exporting

Per-cell formats round-trip to xlsx through the exporter's existing
`cellVisual` hook, so a sheet formatted in the browser opens formatted in
Excel. See [export](../export.md).

## See also

- [Excel keyboard shortcuts](./keyboard-shortcuts.md)
- [Spreadsheet formulas](../spreadsheet-formulas.md)
