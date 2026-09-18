---
'@svgrid/grid': minor
'@svgrid/enterprise': minor
---

Fixes and edges found while building the million-row demos.

In `@svgrid/grid`:

- `createServerDataSource` in `infinite` mode re-reads the blocks it holds
  after a write instead of fetching "the page", which had replaced the whole
  block-cached list with a hundred rows; an optimistic update now patches
  the cached row (and a delete removes it), so a block landing later no
  longer undoes it.
- The grid refuses to edit a row that a row model marks as a group, and a
  placeholder row, whatever the column's `editable` says.
- The dev-time "column field does not exist" check looks past placeholder
  rows and stays quiet under server-side grouping, where the first rows are
  group rows that carry a key and aggregates rather than the leaf fields.
- `onChange` is optional on `createServerDataSource`: a controller handed to
  `rowModel` is subscribed to by the grid.
- The grid keeps a row object across a data swap when the same data object
  sits at the same index under the same columns (its memoised values and
  cells are dropped, so an object changed in place still reads fresh). A
  row model streaming blocks hands the grid a new array of 60,000 entries
  per block where 100 changed; rebuilding all 60,000 row objects each time
  was most of what a block cost on screen (about 520 ms of long frames per
  block on a million-row demo, 150 ms now). The selection bar also no longer
  walks every loaded row on each change when its model reports nothing
  selected.
- `ServerGroupRow.expandable` (`false` when nothing can open beneath the
  row).
- A failed block used to draw one "Could not load these rows. Retry" line
  per row it claimed, with the tint shrunk to the text (a flex `td` stops
  spanning its colspan). The run now reads as one band: the message and
  Retry sit on the first failed row on screen and the rows under it are
  the plain tint. A first block that fails with no count known keeps the
  level's `initialRowCount` rows instead of claiming a whole block.

In `@svgrid/enterprise`:

- `ServerRowModel.group` is typed as always present, so `ctl.group.onToggle`
  needs no assertion.
- The selection bar's count chip and the bulk-edit drawer's "Apply to N
  items" group the number with the grid's locale: 1,000,000, not 1000000.
- `levelParams` gained `initialRowCount`: rows a level claims before its
  first block lands, so at the root of flat data `api.scrollToRow(900000)`
  works before anything has loaded, with placeholders under the viewport and
  the block beneath them the one that loads. Demo 467 has a "Jump to row"
  box for it.
- The model marks the innermost group level under a pivot `expandable:
  false`, and `SvGroupCell` draws those rows without an expander.
- Expanding a group showed no loading state and drew a stray band across the
  top of the grid: the per-cell shimmer of a placeholder row shared its class
  name with the grid's full-body loading overlay, so every placeholder cell
  became an absolutely positioned overlay. The shimmer is
  `.sv-grid-placeholder-skeleton` now, and `SvGroupCell` turns the expander
  into a spinner (`aria-busy`) while the level's block is in flight.
- `serverGroupText(row, leafField?)`: the group column's text for one grid
  row (a group's key, `Total`, `Grand total`, the leaf field), for the
  column's `fieldFn`, so copy, export and a pinned grand total (which the
  grid formats from the accessor, not the cell renderer) have the same
  text as the cell. The pivot designer's server group column uses it; a
  pinned grand total under the designer was unlabelled before.
- The selection count under grouping reads the leaf total from a `count`
  aggregation on the grand total row, so "1,000,000 selected" is a number
  the model can stand behind; without one the count is unknown rather than
  the number of top-level groups.
- Demos 467 (the server-side row model over one million rows, with a
  columnar warehouse in `examples/src/shared/server-warehouse.ts` that is
  held to the reference backend by test) and 468 (server pivot with the
  designer). Docs: server-infinite-scroll, server-transactions,
  server-selection and server-pivot pages, server-grouping and
  server-tree-data rewritten around `createServerRowModel`, the comparison
  data split into flat server data (free) and the server-side row model
  (Enterprise), and an option-by-option migration table. The demo gallery
  splits the same way: a new Server-Side Row Model category (Enterprise,
  after Charts) holds 467, 468, 344 and the REST-source demo 337, and
  Server-Side Data keeps the free demos, led by 148 (the flat controller,
  no longer marked Enterprise). Five more demos in the Enterprise category:
  469 (lazy tree data over a generated file tree), 470 (a live feed applied
  as in-place patches and batched transactions with their statuses), 471
  (select-all as a rule, flat and per group, with a bulk edit by rule), 472
  (the SQL planToSql renders for every request, per dialect) and 473 (grand
  total positions, footers, open-by-default, expand-all, refresh against
  purge, and the sort and filter refresh rules with the request log).
- Under treeData, SvGroupCell and serverGroupText take the label of an
  expandable node from leafField too; a folder read as its id before, since
  a tree node's key is its route segment.
- The selection model takes leafCount(route), which the row model answers
  from a group row's count aggregate, so selectedCount is a number once a
  whole group is ticked under an unticked root (it was unknown: 0 on the
  bar).
- The documented sort rule for a group column matched the code now: its own
  level re-fetches, not the levels beneath, since a group's children keep
  their own order.
