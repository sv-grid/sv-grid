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

## Concept map

| SVAR DataGrid (wx-svelte-grid)            | sv-grid                                   |
| ----------------------------------------- | ----------------------------------------- |
| `<Grid {data} {columns} />`               | `<SvGrid data={...} columns={...} />`      |
| `columns: [{ id, header, width, ... }]`   | `columns: [{ field, header, width, ... }]` |
| Per-column `editor` / `template`          | `editorType` + `cell` snippet              |
| Tree / hierarchical data                  | `rowExpandingFeature` + tree row shape     |
| Built-in sort / filter config             | `rowSortingFeature` / `columnFilteringFeature` |
| Edit / change events                      | `onCellValueChange`                        |
| Theme / skin classes                      | `--sg-*` CSS custom properties / Tailwind  |
| Imperative grid API                       | `SvGridApi` via `onApiReady`               |

## Before / after (shape, not exact prop names)

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
+   } from 'sv-grid-core'
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
grid free (including CSV export and print) and sells its Gantt instead,
whereas SvGrid's `sv-grid-core` core is MIT and the optional
`sv-grid-pro` pack (advanced XLSX/PDF export, pivot, import, AI, support)
is the paid piece. If all you need is CSV export, SVAR gives it free; if
you need pivot, advanced export, or a support SLA, that is Pro on SvGrid.

## What you get with SvGrid

- **Row grouping with aggregation**, **master-detail**, **pinned rows**,
  and left/right column freezing - beyond SVAR's documented surface.
- A **headless engine** (`createSvGrid` + row models) in addition to the
  component, if you want to compose your own layer.
- **Excel-style filter menu**, **cell-range selection + TSV copy**, a
  **fill handle**, **integrated charts**, and a documented **imperative API**.
- **sv-grid-mcp** so AI assistants answer accurately about your grid.

## What to check on the SVAR side

- The **wider SVAR suite** (Gantt, Scheduler) - if you use several SVAR
  components together, staying on SVAR may be simpler.
- Any **SVAR-specific column features** you rely on; map each to a SvGrid
  `cell` snippet, `editorType`, or feature before porting.

## See also

- [SvGrid vs SVAR Svelte DataGrid](https://svgrid.com/compare/svar-svelte-datagrid) - the side-by-side comparison
- [Architecture](./architecture.md) - the engine + render-component split
- [Cell components](./cells/cell-components.md) - custom cells and editors

## Frequently asked questions

### Why move from SVAR Svelte DataGrid to SvGrid?

Capability and architecture, not licensing (both are MIT). SvGrid adds row
grouping with aggregation, master-detail, Excel-style cell-range selection,
integrated charts, and pivot, and it ships a headless engine plus an MCP server
alongside the component. Both are genuinely Svelte-native, so the core grid
behaviour is comparable; SvGrid simply reaches further.

### Is the migration a rewrite?

No. Both are component-first with array-of-object columns, so it is mostly a
prop / event rename pass (`id` → `field`, edit events → `onCellValueChange`)
plus re-theming through `--sg-*` tokens.

### Are SvGrid and SVAR both free and MIT?

Yes. `sv-grid-core` and the SVAR DataGrid are both MIT and free for
commercial, closed-source use. SVAR keeps the whole grid free and monetizes its
Gantt; on SvGrid, only the optional `sv-grid-pro` add-on (advanced export,
pivot, import, AI, support) is paid.
