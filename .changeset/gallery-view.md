---
"@svgrid/grid": minor
"@svgrid/enterprise": minor
---

Gallery mode: `<SvGrid gallery={...}>` shows the grid's rows as cards
instead of a table, like `board` and `scheduler` do. A card has a cover (an
image URL, or the first image of a list of files), a title and the fields in
`cardFields`, each written by the column's formatter or `format`; a column
declared by field type draws with its own cell (select pills, stars,
avatars). `card` draws each card yourself, `onCardClick` makes the cards
buttons, `cardSize`, `coverFit`, `showLabels`, `emptyText` and the search box
round it out. The cards are the grid's filtered and sorted rows, drawn in
batches as the wall scrolls, so a gallery over thousands of rows opens as
fast as a small one.

`@svgrid/grid` gains the `gallery` prop, the `GalleryConfig` type and the
`registerGalleryView` seam; without the renderer the grid shows a short note.
`@svgrid/enterprise` adds the renderer: `enableGalleryView()` (also called by
`installEnterprise`). The fields module's gallery view now uses it.

`api.setSort`, `api.clearSort` and `api.setGroupBy` no longer loop when called
from a `$effect` (a sort menu bound to state): like `setFilter`, they do not
track the state they read.
