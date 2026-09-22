# Migrating from SVAR Svelte DataGrid

SVAR Svelte DataGrid (`wx-svelte-grid`) is, like SvGrid, an actual
Svelte-native grid rather than a wrapper, and both are MIT-licensed and
free for commercial use. Because both are component-first with
array-of-object column definitions, a port is mostly a configuration
translation. The reasons people switch are **capability** (SvGrid adds
row grouping with aggregation, master-detail, Excel-style cell-range
selection, integrated charts, and pivot) and **architecture** (SvGrid
also exposes a headless engine and an MCP server).

> Estimated effort: **2-4 hours** per grid - a prop and event rename
> pass, plus re-theming.
>
> SVAR's exact prop and event names evolve across releases; check the
> current SVAR docs and map them onto the SvGrid equivalents below.

<!-- facts:start svar-svelte-datagrid -->
> **Facts, checked 12 Sep 2026.** `wx-svelte-grid` 2.7.0, MIT, last published 3 Jun 2026, 62,800 npm downloads in the 30 days to 10 Sep 2026. `@svgrid/grid` 3.0.3, MIT, last published 11 Sep 2026, 16,900 npm downloads in the same window. Bundle, minified and gzipped, each package built alone with Svelte external: SvGrid 3.0.4 97.6 KB JS + 10.5 KB CSS (measured 22 Sep 2026); `wx-svelte-grid` 2.7.0 51.5 KB JS, no separate stylesheet, svelte external (measured 12 Sep 2026). SVAR Svelte DataGrid pricing, as its site states it: The DataGrid is MIT and free for commercial use with no paid tier; svar.dev sells PRO editions of its Gantt, Calendar and Kanban components and offers paid consulting and custom development, with no price list for the grid (https://svar.dev/svelte/, read 12 Sep 2026). SvGrid: MIT core; @svgrid/enterprise from $599 per developer per year. Side by side, with sources: [SvGrid vs SVAR Svelte DataGrid](https://svgrid.com/compare/svar-svelte-datagrid/).
<!-- facts:end -->

## Concept map

| SVAR DataGrid (wx-svelte-grid)            | sv-grid                                   |
| ----------------------------------------- | ----------------------------------------- |
| `<Grid {data} {columns} />`               | `<SvGrid data={...} columns={...} />`      |
| `columns: [{ id, header, width, ... }]`   | `columns: [{ field, header, width, ... }]` |
| `sizes={{ rowHeight, columnWidth }}`      | `rowHeight` prop, `width` per column       |
| `autoRowHeight`                           | `autoRowHeight`                            |
| Per-column `editor` / `template`          | `editorType` + `cell` snippet              |
| `sort: true` on a column, `sortMarks`     | `rowSortingFeature`; `initialSorting`      |
| Header filters, the Filter component      | `columnFilteringFeature`; Excel-style menu and filter row built in |
| `tree` prop + `data` with children        | `treeData={{ parentField }}` or `rowExpandingFeature` with sub rows |
| `select` / `multiselect`                  | `selectionMode="row"` (+ checkbox column)  |
| `split={{ left: n }}` (pinned columns)    | `initialColumnPinning` or `pinned: 'left' \| 'right'` per column |
| `reorder` (row drag)                      | `rowDragManaged`                           |
| `undo` prop, undo/redo hotkeys            | `history` prop; `api.undo()` / `api.redo()` |
| Context menu component                    | `contextMenu` prop with items               |
| `init={(api) => ...}`                     | `onApiReady={(api) => ...}`                 |
| `api.exec('sort-rows', { key, order })`   | `api.setSort(field, 'asc' \| 'desc')`      |
| `api.exec('filter-rows', { filter })`     | `api.setFilter(field, { operator, value })` |
| `api.on('...')` event bus                 | `onXxx` callback props                      |
| Export to CSV, print API                  | `api.exportCsv()` (free); print in `@svgrid/enterprise` |
| `RestDataProvider`                        | server-side row model / `externalSort` + `externalFilter` |
| Theme / skin components (Willow, Material)| `--sg-*` CSS custom properties / Tailwind  |

## Before / after (shape, not exact prop names)

The example at the end of this page runs against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    age: number
    salary: number
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000 },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000 },
    { id: 5, name: 'Barbara Liskov', department: 'Platform',    city: 'Boston',   age: 52, salary: 172000 },
  ]

  let rows = $state<Person[]>(people)

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 200, editorType: 'text' },
    { field: 'department', header: 'Department', width: 150, editorType: 'text' },
    { field: 'city',       header: 'City',       width: 140, editorType: 'text' },
    { field: 'age',        header: 'Age',        width: 90,  editorType: 'number' },
    { field: 'salary',     header: 'Salary',     width: 130, editorType: 'number', format: { type: 'currency', currency: 'USD' } },
  ]
</script>
```

```diff
- <script>
-   import { Grid } from 'wx-svelte-grid'
-   const columns = [
-     { id: 'name',   header: 'Name',   width: 200 },
-     { id: 'amount', header: 'Amount', width: 120, editor: 'text' },
-   ]
- </script>
-
- <Grid {data} {columns} />

+ <script lang="ts">
+   import {
+     SvGrid, tableFeatures, rowSortingFeature, columnFilteringFeature,
+     type ColumnDef,
+   } from '@svgrid/grid'
+
+   const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
+   const columns: ColumnDef<typeof features, Row>[] = [
+     { field: 'name',   header: 'Name',   width: 200 },
+     { field: 'amount', header: 'Amount', width: 120, editorType: 'text' },
+   ]
+ </script>
+
+ <SvGrid data={data} columns={columns} features={features} enableInlineEditing />
```

## Licensing note

Both grids are MIT and free for commercial use, so licensing is not the
deciding factor. The difference is monetization: SVAR keeps the whole
grid free (including CSV export and print) and sells PRO editions of its
Gantt, Calendar and Kanban instead, whereas SvGrid's `@svgrid/grid` core is
MIT and the optional `@svgrid/enterprise` pack (XLSX/PDF export, print,
pivot, import, support) is the paid piece. CSV, TSV and JSON export and the
in-grid AI helpers are free on SvGrid too. If all you need is CSV export and
print, SVAR gives both free; if you need pivot, Excel or PDF output, or a
support SLA, that is Enterprise on SvGrid.

## What you get with SvGrid

- **Row grouping with aggregation**, **master-detail**, **pinned rows**,
  and left/right column freezing - beyond SVAR's documented surface.
- A **headless engine** (`createSvGrid` + row models) in addition to the
  component, if you want to compose your own layer.
- **Excel-style filter menu**, **cell-range selection + TSV copy**, a
  **fill handle**, **integrated charts**, and a documented **imperative API**.
- **In-grid AI helpers** (natural-language filter, smart fill, summarise),
  free against a model you register, and **@svgrid/mcp** so AI assistants
  answer accurately about your grid and can check the code they write.

The two features most SVAR teams port for:

<div data-docs-demo="07-grouping-aggregation" data-height="520"></div>

<div data-docs-demo="181-master-detail-grid" data-height="520"></div>

## What you give up

- **Free printing.** SVAR's print API is in the MIT grid; SvGrid's print
  view is in `@svgrid/enterprise`.
- **The React and Vue versions** of the same grid. SvGrid is Svelte-only.
- **A smaller bundle.** The facts box at the top of the page has both
  packages measured the same way; the difference is the grouping,
  master/detail, range editing, charts and server-side data (flat paging and infinite scroll free; grouping, tree, pivot and transactions on the server are Enterprise) SvGrid
  carries, and features you never import load as separate chunks.
- **The SVAR suite around the grid.** Gantt, Calendar, Kanban and File
  Manager share SVAR's core; SvGrid's Kanban and scheduler are views of the
  grid in `@svgrid/enterprise`.

## What to check on the SVAR side

- The **wider SVAR suite** (Gantt, Calendar, Kanban) - if you use several
  SVAR components together, staying on SVAR may be simpler.
- Any **SVAR-specific column features** you rely on; map each to a SvGrid
  `cell` snippet, `editorType`, or feature before porting.
- **Filter functions.** SVAR filters with a predicate you write; SvGrid's
  filter takes an operator and a value per column, and `externalFilter`
  hands you the rows when you want to keep a custom predicate.

## Frequently asked questions

### Why move from SVAR Svelte DataGrid to SvGrid?

Capability and architecture, not licensing (both are MIT). SvGrid adds row
grouping with aggregation, master-detail, Excel-style cell-range selection,
integrated charts, and pivot, and it ships a headless engine plus an MCP server
alongside the component. Both are Svelte-native, so the core grid
behaviour is comparable; SvGrid covers more ground.

### Is the migration a rewrite?

No. Both are component-first with array-of-object columns, so it is mostly a
prop / event rename pass (`id` → `field`, edit events → `onCellValueChange`)
plus re-theming through `--sg-*` tokens.

### Are SvGrid and SVAR both free and MIT?

Yes. `@svgrid/grid` and the SVAR DataGrid are both MIT and free for
commercial, closed-source use. SVAR keeps the whole grid free and sells PRO
editions of its Gantt, Calendar and Kanban; on SvGrid, only the optional
`@svgrid/enterprise` add-on (Excel and PDF export, print, pivot, import,
support) is paid. The dated statement from svar.dev is in the facts box at
the top of this page.

### How does SVAR's tree data map to SvGrid?

SVAR takes hierarchical data with the `tree` prop. SvGrid takes either a
flat array with a parent field (`treeData={{ parentField: 'parentId' }}`)
or nested rows through `rowExpandingFeature`, and the same grid also does
master/detail, which SVAR's docs do not list. The example below runs the
flat shape:

## What you end up with

Grouping with aggregation and a totals row, the main capability step up.

```svelte {runnable}
<SvGrid data={rows} {columns} groupBy={['department']} summary groupable sortable filterable />
```

And the tree shape, from the same rows with a parent link, which is what SVAR's `tree` prop becomes:

```svelte {runnable}
<SvGrid data={rows.map((r, i) => ({ ...r, parentId: i === 0 ? null : rows[0].id }))} {columns} treeData={{ parentField: 'parentId' }} sortable />
```

## See also

- [SvGrid vs SVAR Svelte DataGrid](https://svgrid.com/compare/svar-svelte-datagrid/) - the side-by-side comparison, with a source and date for every claim and the measured benchmark
- [Grouping and aggregation](./grouping-aggregation.md) - the first demo above
- [Master/detail](./rows/master-detail.md) - the second demo above
- [Architecture](./architecture.md) - the engine + render-component split
- [Cell components](./cells/cell-components.md) - custom cells and editors
