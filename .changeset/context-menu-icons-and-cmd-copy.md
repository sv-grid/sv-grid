---
"@svgrid/grid": minor
---

Context-menu icons, built-in items with your own icon, and `cmd.copy()` / `cmd.cut()`.

- A `contextMenu` item takes `icon`: one of the grid's icons by name, or
  path data of your own (`{ paths: [{ d, fill?, width?, dash? }] }` on a
  16 x 16 grid, drawn in the text colour). Once one item has an icon every
  item keeps the gutter, so the labels line up.
- An object whose `key` names a built-in (`copy`, `cut`, `paste`, `clear`,
  `row_above`, `row_below`, `remove_row`, `remove_col`, `comment`,
  `chart`) and has no `action` is that built-in with the icon or label
  you gave it; `label` and `action` are optional for that reason.
- `GridCommandContext` gains `copy()` and `cut()`: the selection copy and
  cut Ctrl+C and Ctrl+X run, each cell through `processCellForClipboard`.
  The api's `copyToClipboard` is the export (the displayed rows with their
  headers), which is not what a Copy button wants.
