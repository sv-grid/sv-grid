---
'@svgrid/enterprise': patch
'@svgrid/grid': minor
---

The PDF export prints the grid the way it looks.

- `exportData({ format: 'pdf' })` takes its colours from the mounted grid:
  header fill and text, body text, the zebra stripe, the lines and a group
  row's fill are read from computed styles (`pdf.matchTheme`, default true),
  so a themed grid no longer prints as the default slate table. A dark
  theme lends only its header, since the page is white. Explicit `pdf`
  colours win, then `styles`, then the theme.
- `styles` (header row, rows, alternate rows, per-cell A1 overrides),
  `header` / `footer` lines and `merges` were documented as honoured by the
  PDF and were ignored by it; they apply now. New `pdf.textColor` and
  `pdf.borderColor`.
- `api.getElement()` returns the grid's root element; the exporter reads
  the theme from it.
