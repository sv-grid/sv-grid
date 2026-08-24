# Recipes / Cookbook

Quick patterns for the questions that come up over and over. Each
recipe is paired with a live demo or a minimal snippet that runs
against the shipping library.

## Sort, filter, paginate at the same time

Three of the most-asked features wired together against a 5k-row
dataset. Click any header to sort, open the filter icon to filter,
use the pager at the bottom to walk pages:

<div data-docs-demo="02-sort-filter-paginate" data-height="440"></div>

The implementation: register all three features in one
`tableFeatures(...)` call and enable the matching props on `<SvGrid>`.
See [Filtering overview](./filtering/overview.md) and
[Row sorting](./rows/row-sorting.md).

## Select rows + copy / paste a range

Click + drag selects a rectangular cell range; Ctrl/Cmd+C copies as
TSV; pasting back from Excel writes through the same cell-write
pipeline as inline edit:

<div data-docs-demo="04-selection-copy-paste" data-height="440"></div>

The pattern: enable `enableCellSelection={true}` and let the grid
handle the keyboard + paste plumbing. Cell writes go through
`onCellValueChange` so your validator runs on every pasted value.

## Bulk actions toolbar

The Gmail / Linear pattern: tick row checkboxes, a sticky toolbar
reveals "Mark / Delete / Copy as TSV":

<div data-docs-demo="23-bulk-actions" data-height="440"></div>

The trick: subscribe to `onRowSelectionChange` and render your
toolbar whenever the count is > 0. The grid doesn't ship a bulk-action
component on purpose - your design system's button + toast UI is
better than anything we could embed.

## Cascade editing (formula-like dependencies)

Editing qty / price cascades into line totals + a summary card:

<div data-docs-demo="18-cascade-editing" data-height="440"></div>

In `onCellValueChange`, after writing the cell, recompute the dependent
cells in the same row (or in the summary state) and let Svelte 5's
reactivity carry the update through. The pattern is essentially
"editable cells + a `$derived` summary".

## Validation while editing

Per-column rules: invalid commits get rolled back via `setCellValue`,
and a sidebar logs the rejection so users can audit what was tried:

<div data-docs-demo="24-validation" data-height="440"></div>

Use `onCellValueChange`: validate, and if invalid, call
`api.setCellValue(rowIndex, columnId, oldValue)` to undo. The grid
emits a fresh `onCellValueChange` for the undo write that your
validator can recognise and skip.

## Column pinning + freezing

Wide 13-column grid: pin Company on the left and Price on the right;
the middle scrolls under sticky edges:

<div data-docs-demo="25-column-pinning" data-height="440"></div>

The user pins via the column menu - no extra wiring needed if
`columnFilteringFeature` is registered (the menu lives on the same
header button). Or set the whole pinning state programmatically with
`api.setColumnPinning({ left: ['name'], right: ['total'] })` - pass an
empty array for a side to unpin it. `api.getColumnPinning()` reads it
back for persistence.

## List + chips editors

The two built-in multi-select editors:

<div data-docs-demo="26-list-chips-editors" data-height="440"></div>

Add `editorType: 'list'` for a single `<select>` or `editorType: 'chips'`
with `editorMultiple={true}` for removable tokens. Pass static
`editorOptions` or a `(row) => options` callback for cascading lists
(e.g. City options depend on Country).

## Spreadsheet ribbon

An Excel-style Ribbon UI driving the grid via `SvGridApi`: bold + colour
+ number format + insert/delete row + sort, plus a live SUM/AVG/COUNT
status bar:

<div data-docs-demo="27-spreadsheet-ribbon" data-height="500"></div>

The ribbon is a regular Svelte component; every button calls
`api.setCellValue`, `api.addRow`, `api.setSort`, etc. Status bar
reads `getDisplayedRows()` for the live aggregate.

## Master / detail

A hierarchical row that expands to reveal a child grid:

<div data-docs-demo="08-tree-and-master-detail" data-height="440"></div>

Same flatten pattern as [tree rows](./rows/tree-rows.md): a flat
`visibleRows` derivation, plus a custom cell snippet that renders the
detail grid inline when the row is expanded.

## Forms-in-grid (master grid + side form)

Click a row to load it into a tabbed detail form on the right; edits
flow back to the grid live:

<div data-docs-demo="40-forms-master-detail" data-height="500"></div>

Pattern: `onActiveCellChange` -> set `activeRowId` -> `draft = $state.snapshot(activeRow)` -> form
binds against `draft`. On save, write `draft` back into the rows array.
**Use `$state.snapshot()`, not `structuredClone()`**, on Svelte 5 state
proxies - the latter throws `DataCloneError`.

## Saved views / persistence

Pivot-lite with chips + saved views stored in localStorage:

<div data-docs-demo="36-reporting-workspace" data-height="500"></div>

The pattern: a `view: { groupBy, sortBy, filters, columns }` object
that you serialise into localStorage under a versioned key
(`'my-app:view:v1'`). On load, hydrate the state from the saved view
and call the matching `api.set*` methods.

## Theming studio

Live token playground: brand color, density, radius, font, dark/light,
zebra. The CSS snippet at the bottom is copy-ready:

<div data-docs-demo="37-theming-studio" data-height="540"></div>

Theming is `--sg-*` custom properties - see [Tailwind integration](./tailwind.md)
for the full token list.

## Localisation + RTL switching

Six locales (en, de, fr-CA, ja, ar, he); headers, currencies, dates,
and the grid's own scrollbar flip:

<div data-docs-demo="38-rtl-i18n" data-height="500"></div>

Set `<html dir="...">` and `<html lang="...">` based on the locale.
Per-column `format: { type: 'currency', locales }` overrides the
document locale for specific columns.

## Print + boardroom export

Quarterly P&L print pack: cover page, repeat-on-page headers, page-
size + orientation, CSV / HTML download, browser-native PDF:

<div data-docs-demo="39-print-board-export" data-height="500"></div>

`api.print({ title, columns, rows, orientation, pageSize })` opens a
sandbox window with an isolated HTML document and calls `.print()` on
it. The popup pattern is what isolates your print stylesheet from your
app's CSS.

## Healthcare EMR (role-based editing)

Inpatient board with vitals sparklines, risk score, code status, allergy
chips, role-based editing (viewer / nurse / physician / admin):

<div data-docs-demo="41-healthcare-emr" data-height="500"></div>

The role gate uses `editable: (ctx) => roleCanEdit(currentRole, ctx.column.id)`.
That lambda runs per-cell, so you get column + role granularity
without a separate config table.

## Live shipment / fleet board

Streaming-style live update at 2-3 Hz with cell-level flash on change,
ETA delta colors, alert chips:

<div data-docs-demo="42-logistics-fleet" data-height="500"></div>

The pattern: a `$state` rows array that you mutate from a
WebSocket/SSE handler. The render component diffs at the data-array
level, so reassigning the array (`rows = updated`) is what triggers
the visible repaint.

## Compliance / approval queue

L1 / L2 / L3 approval chain with live SLA timer, role-gated approve /
return / reject buttons, immutable case-history audit panel:

<div data-docs-demo="43-compliance-queue" data-height="500"></div>

This is the pattern for any "this row needs a decision; some users can
make it, some can't" workflow. Status changes go through a state
machine you own; the grid only renders the current state.

## Field service dispatch

Dispatcher board: priority + status + tech editable inline, SLA tone
gauge, today-timeline cell, tech capacity panel, live status stream:

<div data-docs-demo="44-field-service" data-height="500"></div>

Same `editable: (ctx) => ...` per-cell pattern for tech/status. The
today-timeline cell is a positioned-bar in a single wide cell - see
the [pivot doc](./pivot.md) for that pattern.

## Gantt chart in a grid

Project plan with a wide custom Schedule cell: bars positioned by
start/end %, phase coloring, progress fill, today line, overdue glow:

<div data-docs-demo="45-gantt-chart" data-height="540"></div>

No special Gantt mode - it's a single wide cell per row whose snippet
positions absolute bars by `(start - projectStart) / projectSpan * 100`.
Axis above the grid uses the same math.

## Scheduler (single-day appointments)

Providers as rows, an hour axis, click any appointment to edit it in
the side panel. Now-line ticks live:

<div data-docs-demo="46-scheduler" data-height="540"></div>

Same single-wide-cell pattern as the Gantt. The axis-wrap inside the
grid wrapper uses `ResizeObserver` so the axis width matches the
schedule column - that's what keeps the now-line aligned between the
header and the cells.

## Trash truck timeline (animated)

Public-works dispatcher: each truck glides along its day-long route
with spinning wheels, stops, and live fill levels:

<div data-docs-demo="47-trash-truck-timeline" data-height="540"></div>

The mover uses `transition: left 220ms linear` so the new position
animates in. The bounce + wheel spin are CSS keyframes; no JS animation
loop required.

## CRM - sales pipeline

Deal board with stage chips, weighted forecast bar, inline stage +
probability editing, deal detail aside with activity feed:

<div data-docs-demo="48-crm-sales-pipeline" data-height="540"></div>

This is the canonical example of mixing inline edit + a side panel
that mirrors the active row.

## Enterprise admin dashboard

CRUD-heavy users board: inline role / status / MFA edit, bulk
activate / deactivate / delete, invite dialog, permissions matrix,
live audit log:

<div data-docs-demo="49-admin-dashboard" data-height="540"></div>

The audit log is the recurring pattern: every mutation appends an
entry to a `$state` array; the right-side panel renders the array.
Delete + Invite use simple `<dialog>`-style modals.

## E-commerce seller panel

Tabbed Amazon-seller view: catalog with SVG thumbnails, inventory bars
vs reorder threshold, live orders pipeline, pricing rules:

<div data-docs-demo="50-seller-panel" data-height="540"></div>

The tab strip is just chip buttons that swap which dataset / columns
the grid receives. One grid component, four tabs - share styling and
behavior without four separate mounts.

## Long-form recipes

The recipes above pair a paragraph + a demo. These deeper write-ups
have their own pages:

- [Persist column layout to URL](../recipes/persist-column-layout-to-url.md) - sort + filter + page in the URL, with debounced replaceState and restore-on-mount.
- [Two-grid master / detail](../recipes/two-grid-master-detail.md) - one master grid drives a second detail grid; remount semantics and multi-select union.
- [Bulk-edit selected rows](../recipes/bulk-edit-selected-rows.md) - the standard back-office workflow: pick a field, pick a value, apply to N selected rows. Includes optimistic + rollback patterns.
- [Server-side filter with TanStack Query](../recipes/server-side-filter-with-tanstack-query.md) - caching, deduplication, cancellation, retries, optimistic edits via mutations.

## See also

- [Architecture overview](./architecture.md) - the layered model that
  makes these recipes composable.
- [API reference](../reference/index.md) - every method called in the
  recipes above.
