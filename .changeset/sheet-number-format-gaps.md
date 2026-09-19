---
"@svgrid/enterprise": patch
---

Three Excel number formats that were rendering nonsense.

- **Elapsed time.** `[h]:mm` over a day and a half read `:12`, because the
  bracket was thrown away with the colours and conditions and what was left
  was the clock. It totals the duration now: `36:00`, and `[mm]:ss` over
  half a day is `720:00`. `h:mm` still reads the clock.
- **Fractions.** `# ?/?` over 1.25 read `  /1`. It finds the closest
  fraction that fits the placeholders (`1 1/4`), takes a literal denominator
  as it stands and unreduced (`# ?/8` is `1 2/8`), puts the whole value in
  the numerator when there is no integer part (`?/?` is `5/4`), and rounds
  up to a whole rather than showing `1/1`.
- **The text placeholder.** A number in a cell formatted as Text (`@`)
  showed the placeholder, `@`, rather than the number; and `;;;`, Excel's
  hide-the-cell trick, hid numbers but leaked text. A fourth section governs
  text now: `@` stands for the value, a section without one shows its own
  words, and a pattern with no fourth section leaves text alone.

All three arrive in files written by Excel, so a workbook opened here showed
them wrong even though nothing in this shell can type them.
