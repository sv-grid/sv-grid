# Bundle size

What each feature costs in the final bundle, how to reproduce the
numbers on your branch, and what to do if size matters.

## Per-feature gzipped cost

Numbers from a `rollup -p terser` production build against
`packages/sv-grid-community/dist/`. Each feature is the marginal cost
*above* the baseline core when imported alone.

| Feature                       | gz kB  | Required? | Notes                                          |
| ----------------------------- | -----: | --------- | ---------------------------------------------- |
| **Baseline (engine + render)** | **9.2** | -        | `createSvGrid` + the `<SvGrid>` shell          |
| `rowSortingFeature`           | 1.4    | recommended | Core to the value of a grid                  |
| `columnFilteringFeature`      | 2.1    | recommended | Operator filters + the menu UI                |
| `rowSelectionFeature`         | 1.0    | recommended | Checkbox + range + keyboard shift             |
| `columnGroupingFeature`       | 1.8    | optional  | Group-by; tree-shaken if unused                |
| `rowExpandingFeature`         | 1.5    | optional  | Tree + master-detail expansion                |
| `columnPinningFeature`        | 0.9    | recommended | Pin-left / pin-right; sticky cells            |
| `paginationFeature`           | 0.7    | recommended | Paginated row model                            |
| `columnReorderFeature`        | 1.3    | optional  | Drag-to-reorder columns                        |
| `excelFilters`                | 4.2    | optional  | Set-list + facet count + Excel-style menu     |
| `cellEditing` (built-in)      | 5.8    | recommended | date / number / select / chips / etc.         |
| `fillHandle`                  | 2.6    | optional  | Excel-style fill handle + pattern detector     |
| `undoRedo`                    | 1.1    | optional  | Bounded 200-step history                       |
| `columnVirtualizer`           | 1.6    | recommended | Windowed column rendering                      |
| `svelteVirtualizer`           | 2.4    | recommended | Windowed row rendering                         |

A typical app importing the recommended set ships **~28 kB gzipped**
of grid code.

## sv-grid-pro

Pro pack (export + pivot + AI helpers + import + watermark) adds
~26.4 kB gzipped. xlsx export pulls JSZip as a peer dep
(~22 kB gzipped) on first call to `api.exportData({ format: 'xlsx' })`,
not at module load.

## Reproduce on your branch

```bash
# Build
corepack pnpm --filter sv-grid-community build

# Inspect the dist bundle
npx source-map-explorer packages/sv-grid-community/dist/index.js
```

A treemap opens in your browser. Each block is a source file scaled by
its byte cost in the final bundle. Hover a feature module to see how
much of the total weight it owns.

For a quick gzipped readout:

```bash
node -e "console.log((require('zlib').gzipSync(require('fs').readFileSync('packages/sv-grid-community/dist/index.js')).length / 1024).toFixed(1) + ' kB gz')"
```

## What to do if size matters

1. **Skip the optional features you don't use.** Each item marked
   `optional` in the table is fully tree-shaken when not imported.
2. **Code-split the Pro pack.** `installPro(api)` is async-safe;
   import it dynamically in the route that needs export, not at module
   load: `const { installPro } = await import('sv-grid-pro')`.
3. **Defer xlsx peer deps.** JSZip + pdfMake are imported on first
   `api.exportData` call. They aren't part of the synchronous bundle.
4. **Use the headless engine for read-only views.** When you only need
   to display server-side data with no interaction, `createSvGrid` +
   a 30-line `<table>` renderer saves the `<SvGrid>` shell entirely.
   See the [headless engine reference](./headless-engine.md).

## See also

- [Features reference](./features.md) - what each feature does
- [Headless engine reference](./headless-engine.md) - skip the renderer entirely
- [Going to production guide](../getting-started/6-going-to-production.md)
