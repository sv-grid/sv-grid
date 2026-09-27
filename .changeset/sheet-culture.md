---
"@svgrid/enterprise": minor
---

The spreadsheet reads and writes numbers and formulas the way the user's
locale spells them. A German sheet shows `1,5` and `=ROUND(A1/3; 2)`, and a
`1.234,56` typed into a cell is the number it looks like rather than text.

Set through the `localization` prop that already carries the strings: the
culture is read off `locale` with `Intl`, so nothing new has to be
configured. `localization.culture` overrides one mark without naming the
rest, and `culture: false` translates the strings while keeping the
invariant spelling, which is what a team sharing files with English-speaking
colleagues wants.

The DOCUMENT is unaffected, which is the point: a formula is stored as
`=SUM(1.5, A1)` whatever the locale, so a file written in Berlin opens in
Boston. The culture is applied when a formula is shown for editing and
taken off when one is typed. Typing a `,` where the separator is `;` is
accepted too, since a comma with no digit after it cannot be a decimal
mark, so an English keyboard habit is not punished.

What does not change: function names stay English, and a number format
string stays `#,##0.00` in every locale. It is the rendering of a format
that follows the culture, not the pattern.
