# Glossary

Terminology used across the docs and the source. Sorted A-Z. If a term
is unclear in a topic page and isn't on this list, please file an
issue.

## A

**Accessor.** A function on a `ColumnDef` (`accessorFn`) that computes
a cell value from the row instead of reading a property by `field`.
Used heavily by pivot tables and computed columns.

**Active cell.** The cell with focus. Tracked through every keyboard
move + click; exposed via `onActiveCellChange`. At most one cell is
active per grid. Has `tabindex="0"`; every other cell has
`tabindex="-1"` (roving-tabindex pattern).

**Aggregator.** A function that reduces a group's values to a single
cell value (sum, avg, count, min, max, custom). Used by
`columnGroupingFeature` and the pivot engine.

**API (`SvGridApi`).** The imperative interface exposed via
`<SvGrid onApiReady>`. Methods like `setSort`, `setFilter`, `addRow`,
`getDisplayedRows`. See [API reference](./api-reference.md).

## C

**Cell context.** The `ctx` object passed to `cell`, `editable`, and
`formatter` callbacks. Contains `cell`, `row`, `column`, `table`,
`getValue`. Used inside custom cell snippets to access surrounding
state.

**Column definition (`ColumnDef`).** The plain object that describes
one column: how to read its value (`field` / `accessorFn`), how to
render it (`cell`, `header`), and which features apply (`editable`,
`format`, `editorType`). See [Column definitions](./columns/column-definitions.md).

**Column group.** A `ColumnDef` whose `columns` array contains child
column defs. The grid emits one header row per nesting depth with
proper `colSpan`. See [Column groups](./columns/column-groups.md).

**Controlled vs uncontrolled state.** *Controlled*: the consumer owns
the state (a `$state` in your component) and listens to change events.
*Uncontrolled*: the engine owns the state internally. Most grid state
is uncontrollable-by-default; opt in via the `onXxxChange` props.

## D

**Density.** The vertical compaction of rows. Controlled via the
`--sg-row-height` CSS variable + the `rowHeight` prop. Default is
36 px ("comfortable"); 28 px is "compact"; 48 px is "loose".

**Display rows.** The rows the grid is currently showing AFTER the
pipeline runs (filter -> sort -> group -> page). Accessible via
`api.getDisplayedRows()`. NOT the same as the raw `data` prop.

## E

**Editor type.** A string on the `ColumnDef` that picks which built-in
editor the grid uses when a user edits the cell. Values:
`'text'` / `'number'` / `'date'` / `'datetime'` / `'checkbox'` /
`'list'` / `'chips'`. A column without `editorType` is read-only even
when `enableInlineEditing` is true.

**Engine.** Layer 2 in the [architecture](./architecture.md). The
pure-function row-and-column model pipeline. Lives in
`packages/sv-grid-core/src/core.ts` + the `row-models/` folder.

## F

**Feature.** A bundle of row-model + state + behaviour you register
via `tableFeatures({...})`. Examples: `rowSortingFeature`,
`columnFilteringFeature`. Features compose - registering five of them
is normal.

**Field.** The row property a column reads + writes by default. A
shortcut for `accessorFn: (row) => row[field]`. When you can use
`field`, prefer it - the engine has a fast path for property-keyed
columns.

**Filter mode.** A single prop on `<SvGrid>` that picks which filter
UI the grid renders: `'menu'` (icon in each header), `'row'` (input
under each header), `'global'` (one search box), or `'none'`.

**Format / formatter.** `format` is a declarative config (`{ type:
'currency', currency: 'USD' }`) that the grid hands to `Intl`.
`formatter` is a free-form callback that returns a string. Use
`format` for standard types; `formatter` for custom output.

## G

**Group by.** A list of column ids whose unique values become rollup
group rows. Set via `api.setGroupBy([...])` or the column menu's "Group
by this column" entry. Drives `columnGroupingFeature`.

## H

**Header context.** The `ctx` object passed to `header` and `footer`
templates. Contains `header`, `column`, `table`. Used inside custom
header snippets.

**Headless.** Layer 2 without the renderer. `createSvGrid(...)`
returns a headless instance that emits the same row model + state but
doesn't paint anything. See [Why headless?](../why-headless.md).

## I

**Imperative API.** See *API (`SvGridApi`)*.

**Inline editing.** Editing that happens inside the cell itself, vs
in a side form. Toggled via `enableInlineEditing` on `<SvGrid>` +
`editorType` on each column.

## L

**Layer 1, 2, 3.** See [Architecture overview](./architecture.md).
Layer 1 is your data; Layer 2 is the engine; Layer 3 is the
`<SvGrid>` renderer.

**License key.** A string starting with `SVPRO-` set via
`setLicenseKey(...)`. Removes the unlicensed watermark + console
nudge. See [API stability](./api-stability.md) for license-related
errors.

## P

**Pinned column.** A column sticky-positioned to the left or right
edge while the rest scroll. Set via the column menu or
`api.pinColumn(id, 'left' | 'right' | null)`.

**Pipeline.** The chain of row-model transformations: core ->
filtered -> sorted -> grouped -> expanded -> paginated. Runs once per
state change, NOT per scroll frame.

**Pivot.** A reshape of facts into a grid of intersections - row
dimensions cross column dimensions, with measures (aggregated values)
at each intersection. SvGrid doesn't have a `pivot` prop; the pivot
engine in [pivot.md](./pivot.md) builds the pivoted data + nested
ColumnDef tree the renderer needs.

**Placeholder row.** A frozen "stand-in" row used by sparse infinite
scroll. Renders skeleton cells until the real row loads. See
[Server-side data](./server-side-data.md).

**Pro.** The paid `sv-grid-pro` companion package adding export,
import, print, pivot helpers, and the AI assistant. Installed
separately; activated by `installPro(api)`.

## R

**Render template.** A `cell` / `header` / `footer` value that
returns a Svelte snippet via `renderSnippet(SnippetRef, props)`. The
grid mounts the snippet inside the cell.

**Roving tabindex.** The pattern of giving only the active cell
`tabindex="0"` while every other cell has `tabindex="-1"`. Puts the
grid in the tab order exactly once. See
[Accessibility](./accessibility.md).

**Row data.** The `data` prop. Anything assignable to `RowData[]`
(which is `Record<string, unknown>[]`). Plain objects; the grid never
introspects beyond `field` reads.

**Row model.** A pipeline stage that takes rows in and emits rows
out. Examples: `createSortedRowModel`, `createFilteredRowModel`. Pipe
them in via `tableFeatures(...)`. See [Architecture](./architecture.md).

## S

**Selection range.** A rectangular cell selection (anchor + focus
cells), enabled by `enableCellSelection={true}`. Copy + paste (TSV)
and the fill handle both operate on this range.

**Snippet.** A Svelte 5 `{#snippet Foo(props)}` block. Used by the
grid as the render template format for cells, headers, and editors.
`renderSnippet(Foo, props)` is the wrapper the column passes to
`cell`.

**Soft-gate.** The unlicensed Pro behaviour: features still run; a
small watermark + one-time console message appear. Removed by
`setLicenseKey('SVPRO-...')`.

## T

**Table features.** The bag returned by `tableFeatures({...})` -
a typed object identifying which row models + state slices the grid
should enable. Pass to `<SvGrid features={...}>` and use as the first
generic of `ColumnDef<...>`.

**Tree row.** A row with a `depth` field + `childIds` (or
equivalent). Renders with indented chevron + connector lines. The grid
doesn't have a `treeData` prop; you derive `visibleRows` from
`allRows` + `expanded`. See [Tree rows](./rows/tree-rows.md).

## V

**Virtualization.** Rendering only the rows + columns currently in
view + a small overscan buffer. Enabled by default for any grid with
more than a few hundred rows. Bypassed in jsdom (zero layout metrics)
- test against Playwright for virtualization behaviour.

**Visible rows.** Same as *Display rows*.

## W

**Watermark.** The "Unlicensed sv-grid-pro" badge that appears
bottom-right when a Pro feature runs without a valid license. Removed
by `setLicenseKey('SVPRO-...')` or `dismissUnlicensedNudge()` (the
nudge only).

## See also

- [Architecture overview](./architecture.md) - where each piece
  above sits.
- [API reference](./api-reference.md) - every export with its tier
  badge.
