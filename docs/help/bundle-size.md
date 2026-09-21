# Bundle size

What SvGrid costs in your bundle, how to reproduce the number on your
branch, and what to do if size matters.

## Measured

The table below is generated from `docs/_data/svgrid-size.json`, the file
`pnpm size:json` writes; `node tools/sync-guide-facts.mjs` rewrites it and
`tools/competitor-facts.test.ts` fails when it is stale or when a size is
typed anywhere else on this page. An earlier version of this page typed its
numbers and sat a month behind the measurement.

<!-- size:start -->
Re-measured **20 Sep 2026** at `@svgrid/grid` 3.0.4 with the script that ships in the repo (`pnpm size:json`):

| Target | Base JS (gzip) | CSS (gzip) | Loaded on demand |
| --- | ---: | ---: | ---: |
| Headless core (`createSvGrid`) | **2.6 KB** | - | - |
| Headless subpath (`@svgrid/grid/core`) | **6.5 KB** | - | - |
| Full render component (`<SvGrid>`) | **95.8 KB** | **10.5 KB** | **183.5 KB** |
| Standalone chart (`<SvChart>`) | **71.6 KB** | - | **15.1 KB** |
<!-- size:end -->

The two headless rows measure different things on purpose. `createSvGrid` is
the engine plus the row model it needs, which is what you pay when you import
just that symbol. The subpath row is every export on `@svgrid/grid/core`
pulled in at once with nothing tree-shaken, so it is the ceiling rather than
the typical cost - a real consumer importing `createSvGrid` and two row models
sits near the lower number.

Svelte is a peer dependency and is excluded from every figure. Builds are
minified and gzipped at level 9.

The "loaded on demand" column is code that is reachable only through
`import()`, so it never lands in your initial bundle. The script prints the
per-chunk breakdown; the chunks and what triggers each of them:

| Chunk | Loads when |
| --- | --- |
| `SvDateTimePicker` | a date / datetime / time cell editor opens |
| `chart` (engine) | charting is enabled |
| `SvGridChart`, `SvGridChartPanel`, `SvGridChartView` | a chart renders, the chart panel opens, the grid switches to chart view |
| `GridMenus` | a header or context menu opens |
| `SvGridCellEditor` | editing is enabled (loads at mount, before the first edit) |
| `SvGridDropdown` | a list / chips cell editor or the page-size picker opens |
| `dismissable`, `popover`, `focus-trap` | any popover, menu or dropdown layer opens |
| `export-format` | CSV / TSV / JSON export or clipboard copy runs |
| `date-format` | a date column formats a value |
| `column-resize`, `row-resize`, `row-drag-touch` | the first resize drag or touch row drag |

The Kanban board and the scheduler / calendar view are not in either
figure: their renderers live in `@svgrid/enterprise` and register into the
free grid through the board and scheduler view seams.

## Reproduce on your branch

`measure-size.mjs` runs one isolated Vite library build per target above,
with Svelte marked external, then gzips each emitted chunk and classifies
it as `base` (statically reachable from the entry) or `lazy` (reachable
only via `import()`).

```bash
node packages/grid/scripts/measure-size.mjs
# or, from the repo root:
pnpm size
```

To see where the weight sits inside the base bundle:

```bash
corepack pnpm --filter @svgrid/grid build
npx source-map-explorer packages/grid/dist/index.js
```

A treemap opens in your browser. Each block is a source file scaled by its
byte cost in the final bundle.

## @svgrid/enterprise

The Enterprise pack is a separate install and a separate bundle. `xlsx`
export pulls JSZip and PDF export pulls pdfmake as optional peer
dependencies, imported on the first `api.exportData(...)` call rather than
at module load, so neither is in your synchronous bundle.

## What to do if size matters

1. **Use the headless engine for read-only views.** When you only need to
   display server-side data with no interaction, `createGrid` plus a short
   `<table>` renderer costs the headless-core row of the table above rather
   than the full-component row. See the
   [headless engine reference](../reference/headless-engine.md).
2. **Register only the features you use.** The grid is feature-gated:
   sorting, filtering, grouping, pagination, expansion, and selection are
   each opt-in and tree-shake out when not imported. See the
   [features reference](../reference/features.md).
3. **Let the lazy chunks stay lazy.** Charts, date/time editors, menus,
   and export already split themselves. Importing their modules directly
   at the top level pulls them back into your base bundle.
4. **Code-split the Enterprise pack.** `installEnterprise(api)` is
   async-safe, so import it in the route that needs export rather than at
   module load:
   `const { installEnterprise } = await import('@svgrid/enterprise')`.

## See also

- [Features reference](../reference/features.md) - what each feature does
- [Headless engine reference](../reference/headless-engine.md) - skip the renderer entirely
- [Going to production guide](../getting-started/6-going-to-production.md)
