# Bundle size

What SvGrid costs in your bundle, how to reproduce the number on your
branch, and what to do if size matters.

## Measured

Re-measured **2026-08-20** with the script that ships in the repo:

```bash
node packages/grid/scripts/measure-size.mjs
```

| Target | Base JS (gzip) | CSS (gzip) | Loaded on demand |
| --- | ---: | ---: | ---: |
| Headless core (`createGrid`) | **2.3 kB** | - | - |
| Headless subpath (`@svgrid/grid/core`) | **4.2 kB** | - | - |
| Full render component (`<SvGrid>`) | **77.3 kB** | **9.1 kB** | 81.4 kB |

The two headless rows measure different things on purpose. `createGrid` is the
engine plus the row model it needs, which is what you pay when you import just
that symbol. The subpath row is every export on `@svgrid/grid/core` pulled in at
once with nothing tree-shaken, so it is the ceiling rather than the typical
cost - a real consumer importing `createSvGrid` and two row models sits near the
lower number.

Svelte is a peer dependency and is excluded from every figure. Builds are
minified and gzipped at level 9.

The "loaded on demand" column is code that is reachable only through
`import()`, so it never lands in your initial bundle. As measured, that
splits into:

| Chunk | gzip | Loads when |
| --- | ---: | --- |
| `SvDateTimePicker` | 18.2 kB | a date / datetime / time cell editor opens |
| `SvGridChart` | 15.7 kB | a chart renders |
| `chart` (engine) | 11.7 kB | charting is enabled |
| `GridMenus` | 11.7 kB | a header or context menu opens |
| `SvGridChartPanel` | 7.5 kB | the chart panel opens |
| `SvGridCellEditor` | 4.3 kB | editing is enabled (loads at mount, before the first edit) |
| `SvGridDropdown` | 5.2 kB | a list / chips cell editor or the page-size picker opens |
| `dismissable` | 3.7 kB | any popover, menu or dropdown layer opens |
| `export-format` | 1.8 kB | CSV / TSV / JSON export or clipboard copy runs |
| `popover` | 0.9 kB | a popover is positioned |
| `SvGridChartView` | 0.7 kB | the grid switches to chart view |

The Kanban board and the scheduler / calendar view are not in either
figure: their renderers live in `@svgrid/enterprise` and register into the
free grid through the board and scheduler view seams.

## Reproduce on your branch

`measure-size.mjs` runs two isolated Vite library builds, one per target,
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
   `<table>` renderer is 2.3 kB instead of 78.2 kB. See the
   [headless engine reference](./headless-engine.md).
2. **Register only the features you use.** The grid is feature-gated:
   sorting, filtering, grouping, pagination, expansion, and selection are
   each opt-in and tree-shake out when not imported. See the
   [features reference](./features.md).
3. **Let the lazy chunks stay lazy.** Charts, date/time editors, menus,
   and export already split themselves. Importing their modules directly
   at the top level pulls them back into your base bundle.
4. **Code-split the Enterprise pack.** `installEnterprise(api)` is
   async-safe, so import it in the route that needs export rather than at
   module load:
   `const { installEnterprise } = await import('@svgrid/enterprise')`.

## See also

- [Features reference](./features.md) - what each feature does
- [Headless engine reference](./headless-engine.md) - skip the renderer entirely
- [Going to production guide](../getting-started/6-going-to-production.md)
