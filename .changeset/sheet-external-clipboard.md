---
"@svgrid/enterprise": minor
---

The sheet exchanges formats and formulas with Excel and Google Sheets
through the clipboard.

Copy put the display text on the clipboard and nothing else, so a block
pasted into Excel lost its number formats, and a block copied from Excel
arrived as text: `1,234.50` as a string, the bold gone, the formulas
replaced by their results. Copy now writes an HTML table beside the text in
Excel's own dialect (`mso-number-format` for the number format, `x:num` for
the number behind a formatted display, `data-formula` for the formula), and
paste reads what the clipboard carries: Excel's `<style>` classes, `x:fmla`
and `x:num`, Sheets' `data-sheets-value`, `data-sheets-numberformat` and
`data-sheets-formula` (R1C1, turned into A1 for the cell it lands in),
inline styles from anywhere, with Excel's automatic colour read as no colour
and an inline declaration overriding a class one as CSS has it. The sheet's
own block still pastes as before (formulas translated, a cut moved), plain
text lands as typed, one copied cell fills the selected range and a block
that fits the selection a whole number of times is repeated over it, as in
Excel. Every paste is one undo, formats included. `parseClipboardHtml`,
`msoNumberFormat`, `numFmtFromMso`, `isR1C1` and `r1c1ToA1` are exported
from `@svgrid/enterprise/sheet`, `ClipboardCell` gained `value`,
`resolvePasteCell` takes the destination as its fifth argument and
`planPaste` a `fill` size.
