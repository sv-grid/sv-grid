---
"@svgrid/enterprise": minor
---

Format Cells > Number gains Accounting (a symbol list and decimals) and
Special (Zip Code, Zip Code + 4, Phone Number, Social Security Number).

The number-format compiler learns `_x` and `*x` padding (one space each),
a condition in brackets that picks a section by value, and literal text
between integer digits, which lays the digits into a mask from the right
(`000-00-0000`). `FORMAT_PRESETS.accounting` and `SPECIAL_FORMATS` are
exported, with `accountingPattern` / `accountingParts` to spell and read
an accounting pattern; Increase and Decrease Decimal work on accounting
cells. The ribbon's `$` button applies Accounting, as Excel's does;
Ctrl+Shift+4 stays Currency.
