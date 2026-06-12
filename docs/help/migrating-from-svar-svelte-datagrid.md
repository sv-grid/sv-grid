# Migrating from SVAR Svelte DataGrid

SVAR Svelte DataGrid (`wx-svelte-grid`) is, like SvGrid, an actual
Svelte-native grid rather than a wrapper. Because both are
component-first with array-of-object column definitions, a port is
mostly a configuration translation. The two decisions that usually
drive the switch are **licensing** (SVAR is offered under GPL with a
separate commercial license; SvGrid's community core is MIT) and
**architecture** (SvGrid also exposes a headless engine and an MCP
server).

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
+   } from 'sv-grid-community'
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

SVAR components are distributed under GPLv3 with a separate commercial
license. If you ship a closed-source product, that means either
complying with the GPL or buying a commercial license. SvGrid's
`sv-grid-community` core is MIT - free for commercial, closed-source use
- and the optional `sv-grid-pro` pack is the only paid piece. Confirm
the current SVAR terms against their site before you decide.

## What you get with SvGrid

- An **MIT community core** with no copyleft obligations.
- A **headless engine** (`createSvGrid` + row models) in addition to the
  component, if you want to compose your own layer.
- **Excel-style filter menu**, **cell-range selection + TSV copy**, and a
  documented **imperative API**.
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

The usual reasons are licensing and architecture: SvGrid's core is MIT (no GPL
obligations for closed-source apps), and it ships a headless engine plus an MCP
server alongside the component. Both are genuinely Svelte-native, so the grid
behaviour is comparable.

### Is the migration a rewrite?

No. Both are component-first with array-of-object columns, so it is mostly a
prop / event rename pass (`id` → `field`, edit events → `onCellValueChange`)
plus re-theming through `--sg-*` tokens.

### Is SvGrid GPL like SVAR?

No. `sv-grid-community` is MIT-licensed and free for commercial, closed-source
use. Only the optional `sv-grid-pro` add-on is commercially licensed.
