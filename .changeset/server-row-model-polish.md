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
- Escape closes the funnel filter popover, the value-suggestions dropdown
  and the Choose Columns panel; the window handler only knew the column
  and operator menus.
- A popover no longer closes itself on the click that opened it. Scroll
  events are delivered on the next rendering step, so a scroll that had
  finished before the click (the browser pulling a half-hidden funnel
  button into view as it focused it) still reached the close-on-scroll
  listener after the panel had mounted. `onScrollOutside` arms one
  animation frame after it is asked for, which by the rendering order is
  after those queued events and before any scroll the user makes next.
- The condition input's focus and blur handlers read the column's
  operator from component state instead of a template constant; blur
  also fires while the popover is torn down, after that constant is gone,
  which logged a `derived_inert` warning in dev.

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
- `SvRowGroupPanel` in deferred mode compares `groupBy` by value before
  dropping pending chips: a server row model hands out a fresh array on
  every emit, so a block landing used to throw away un-applied edits. Chip
  drag sets transfer data (Firefox started no drag without it), shows an
  insertion mark, and a keyboard move is announced to a live region; the
  remove button is a 24px target and every control has a focus ring.
- `SvGroupCell`'s group button is named by the group itself ("Germany
  (1,234)") with expanded and busy as states, instead of an aria-label that
  hid the name; the "load more" row uses aria-disabled so it keeps focus
  while it waits, and formats its count.
- Footer and grand-total grid rows from the model carry `__groupFooter` /
  `__grandTotal`, so the grid styles them like the client model's totals; a
  `top` / `bottom` grand total looked like a plain row.
- A group reads as loading only while its first block is in flight; a deep
  scroll into an open group no longer spins its expander.
- `applyTransaction` moves the parent group's `childCount` by the net add
  and remove, so the badge beside the key follows a feed.
- The Retry on a failed row re-fetches that block only (`retryFailedAt` on
  the block cache, `retryRow(row, index)` on both controllers);
  `retryLoads()` still re-fetches every failed block.
- Localization of the group chrome: `SvGroupCell` and `SvRowGroupPanel` take
  `messages` (a partial `ServerGroupMessages`) and the cell a `locale`;
  `serverGroupText` takes the same map. `defaultServerGroupMessages` and
  `resolveServerGroupMessages` are exported. In `@svgrid/grid` the client
  group banner reads `expandGroup` / `collapseGroup` / `rowSuffix` /
  `rowsSuffix` from `localization.text` instead of English literals.
- The demos share one chrome stylesheet (`examples/src/demo-chrome.css`,
  `.demo-kit`) instead of a pasted copy each; 148 and 337 join it; the
  hint notes hide on phones so the grid starts near the top.
- `toCallbackSelectionState` / `fromCallbackSelectionState` map the
  selection rule to and from the callback-style shape (`{ selectAll,
  toggledNodes }` flat, `{ nodeId, selectAllChildren, toggledNodes }` per
  group), with a `SelectionStateMapping` for group rows whose ids are not
  their keys; `ctl.setSelectionState` accepts that shape directly. The
  migration guide now shows `toCallbackRequest` for a backend that keeps
  parsing the callback-style request JSON, and lists the transaction
  status spellings.
- `ServerRowModelState.saving` is true while a `createRow`, `updateRow` or
  `deleteRow` is out, and the model takes `optimistic: true`: an update
  shows at once and the server answer replaces it, a delete takes the row
  out at once, and a refusal puts the row back where it was - the free
  controller's contract. `createRow(input, route, addIndex)` says where the
  saved row lands in its level (the end by default, which in a level of
  thousands is out of sight).
- `refresh({ route: [] })` re-reads the grand total with the top level; it
  kept the cached one before, so a subtotal followed a write and the total
  did not.
- Every `ServerRequest` carries `signal`, an `AbortSignal` the grid aborts
  when it no longer wants the answer (a purged or evicted block, a sort or
  filter change, a collapsed group, a superseded page, dispose). Hand it
  to `fetch`. The SvelteKit transport does, and keeps it out of the body.
  In `@svgrid/grid` the free controller's page mode aborts the fetch a
  newer page supersedes.
- `ServerAggregation.fn` takes any name a backend knows
  (`ServerAggFn | string`), not only the five built-ins. The SvelteKit
  planner whitelists the function the way it whitelists the column:
  built-ins always, others through `planQuery(schema, request, {
  aggregators })` or `createSqlDataSource({ aggregators })`, and
  `planToSql` refuses a name that is not an identifier. The name was
  pasted into the statement unchecked before.
- `SvGridDropdown` takes `id`, `ariaLabel`, `invalid` and `describedBy`,
  and the edit panel passes them, so a select field's label reaches its
  trigger and an error marks it invalid; the trigger was a button with no
  name.
- Demo 482, server row model CRUD: the form under the focused region,
  inline edits with a version check the server enforces, a refused delete,
  an undo, `saving`, and optimistic against a slow server.
- The row group panel's and the pivot designer's Apply button read as off
  when there is nothing to apply (a neutral fill), not as a paler Apply.
- `stickyGroupRows` on `<SvGrid>`: the group a row belongs to, and the
  groups above it, stay under the header while its rows scroll past. Under
  virtualization the band renders a copy of each ancestor row through the
  same renderers (the expander in the copy works); without virtualization
  the rows themselves stick. Server-side groups, client grouping and tree
  data alike; off by default, on in the server row model demos.
- Master-detail on the server row model: `ctl.toggleDetail(id)` puts a
  display row of kind `detail` under the leaf (`master` on it), closed with
  its group and gone with a removed leaf; `isDetailOpen`,
  `closeAllDetails`, `state.openDetails`. In `@svgrid/grid`,
  `detailRowHeight` (a number or a function of the row) sizes detail rows
  for the virtualizer, so master-detail no longer needs
  `virtualization={false}`; the panel scrolls inside its cell. Demo 483.
- `api.getRowHeight(i)` answers with the height the row is drawn at
  (dragged, measured, detail, declared), not only the declared one.
- Pivot row totals: `pivotRowTotals` on the row model (and
  `buildPivotResultColumns({ rowTotals })`) appends a Total header group
  reading the plain aggregate fields, which the reference backends now put
  on pivoted group rows and the grand total beside the per-key fields; the
  designer's "Grand totals" switch drives it in server mode.
- The active-cell ring waits for the user: a grid mounts with its active
  cell seeded at (0,0), and drew the accent ring there in every grid on a
  page (and in every detail grid) before anyone clicked. The ring now shows
  once a click, an arrow key or `api.setActiveCell` has chosen a cell, and
  stays through a blur, the same gate the fill handle had.
- Demos: the million-row warehouse builds in a fraction of a second (it
  built two Dates per row before, eight seconds before the grid could
  mount); 467, 344 and 472 open their first region on load so the level
  cascade shows without a click; 467 and 148 draw the block cache live
  per level, and 467 reports the median request latency.
- `onRowDrop` on `<SvGrid>`: with `rowDragManaged`, a drop is handed to
  the app (`{ row, target, targetIndex, side }`) and the data is left
  alone; the middle of a group row is a third target, `into`, drawn as a
  tinted row rather than a line. Rows from another grid still go through
  `onRowDragEnd`.
- `ctl.moveRow(id, toRoute, { patch, addIndex })` on the server row
  model writes the move through `updateRow` and moves the row between
  two cached levels (a folder takes its subtree along). A target level
  nothing has opened reports `storeNotFound` and its `childCount` badge
  still follows. Demo 469 drags a file onto a folder with it.
- Ctrl+Enter acts on the row under the active cell: a group row opens or
  closes, a leaf on the server row model opens or closes its detail
  panel (`serverGroup.toggleDetail`, wired by `rowModel`), and a plain
  cell starts editing the way F2 does. It moved down like Enter before.
- A pinned row's cells take the column's `align` and a static `cellClass`
  (a string or a list), the way body cells do; a grand total under a
  right-aligned Amount column sat on the left, and only a `cellClass`
  function reached the pinned cell.
- `showDetailToggle` on `<SvGrid>`: the master-detail chevrons as a
  row-header column beside the row numbers and the selection checkbox,
  sticky at the left, with no column menu, no resize handle and outside
  the active cell. `onDetailToggle(row, rowIndex)` and `isDetailOpen(row)`
  wire it on the client, `hasDetail(row)` leaves it out where there is
  nothing to open; a server row model wires it itself (`rowModel` now
  carries `detailOpen` and `hasDetail` beside `toggleDetail`). Ctrl+Enter
  calls the same toggle on a client grid. The three master-detail demos
  (106, 181, 483) drop their hand-drawn chevron columns, which took the
  menu, the resize handle and the active cell along with them. Two
  messages, `openDetail` and `closeDetail`.
- While the selection bar is up, the strip it floats over is painted by
  the lowest pinned row (bar at the bottom) or the header (bar at the
  top), so body rows no longer scroll through it around the bar; a
  pinned grand total floated mid-body with rows showing beneath it.
