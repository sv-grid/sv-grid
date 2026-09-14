---
"@svgrid/enterprise": minor
---

Add the formula bar, per-cell number formats and AutoSum.

`<SvFormulaBar>` shows the **raw** text behind the active cell rather than its
computed value: the grid shows `1,234.50`, the bar shows `=B2*C2`. Function
names autocomplete as you type, ranked closest-match-first (typing `SU` offers
`SUM` before `SUBSTITUTE`, which alphabetical order gets backwards), with a
signature hint for whichever call the caret sits inside. The Name Box jumps to
a typed address and lists defined names.

`createNames` defines and resolves them. A name that would read as a cell
reference is rejected, since `=A1` cannot mean two things.

`compileNumberFormat` implements the Excel format-string grammar: up to four
sections, `0` / `#` / `?` placeholders, thousands grouping, comma scaling,
percent, scientific, `[Red]` and friends, quoted literals, `@` for text, and
date tokens where `m` means minutes after an hour token and months otherwise.
`FORMAT_PRESETS` holds what `Ctrl+Shift+1` through `6` apply.

`createFormatStore` keeps per-cell formatting keyed on **row id**, not row
index. Keying by index means sorting the grid leaves the bold on whatever row
took that position, which reads as a rendering glitch and is actually lost
data. `forgetRow` and `forgetColumn` exist so a long session does not leak an
entry per deleted row.

New bindings, all declining when no format store is attached so the key falls
through instead of looking broken: `Ctrl+B` / `I` / `U`, `Ctrl+5`,
`Ctrl+Shift+1..6`, `Ctrl+Shift+\``, and `Alt+=` for AutoSum over the run Excel
would guess. `Ctrl+1` calls a handler you register with
`setFormatDialogHandler`; the shortcut layer ships no dialog, because what one
should look like is a design decision rather than a keyboard one.
