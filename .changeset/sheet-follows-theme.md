---
"@svgrid/enterprise": minor
---

Spreadsheet shell: the sheet follows the app's theme by default, and the ants walk.

- `look` defaults to `theme`: the shell is painted with the host's `--sg-*`
  tokens like the grid, so an app's own theme (or a site preset) shows in
  the selection, the active tab, the ribbon and the headers. `look="excel"`
  is the opt-in that pins Excel's palette, light or dark with the page; it
  was the default, which left the sheet green whatever theme ran around it.
- The selection tint is the accent at 14% alpha over the cell's own fill
  rather than `--sg-selection-bg`. That token is an opaque surface in most
  themes, and the shell draws its tint above the cell content, so every
  selected cell but the active one lost its text under `look="theme"`.
- A comment's mark stays red under every theme (the theme's danger
  colour, Excel's red where a theme has none) rather than taking the
  grid's amber, as the fill handle stays the accent.
- The marching ants march: each edge is one 8px tile repeated along it and
  slid a tile per cycle, seamless; the first cut slid one full-width
  stretch, which opened a gap at one end and read as a flicker. Faster,
  as Excel's are, and no longer switched off for `prefers-reduced-motion`
  (two pixels of dash are the copy-mode signal, nothing else moves).
- Enter while the ants are up pastes the block once at the selection and
  leaves copy mode, as Excel's Enter does; Ctrl+V pastes and keeps the
  ants for the next paste.
- The ants belong to the sheet they were copied on: another sheet shows
  none, and coming back shows them again, as Excel does.
