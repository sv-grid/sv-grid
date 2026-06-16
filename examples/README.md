# SvGrid - Examples Gallery

Ten production-quality demos showcasing the full SvGrid feature surface.

```bash
# from the repo root
pnpm install
pnpm --filter @svgrid/grid-example-gallery dev
# open http://localhost:5174
```

## Demos

| # | Title | Source | What it shows |
| - | ----- | ------ | ------------- |
| 1 | Quick start                      | [01-quick-start.svelte](src/demos/01-quick-start.svelte) | The smallest possible grid - 10 rows, 5 columns, zero config. |
| 2 | Sort · Filter · Paginate         | [02-sort-filter-paginate.svelte](src/demos/02-sort-filter-paginate.svelte) | Multi-column sort, filter row, page-size selector against ~5k rows. |
| 3 | Excel-style filters              | [03-excel-filters.svelte](src/demos/03-excel-filters.svelte) | Header filter menu + active-chip strip + imperative quick-presets. |
| 4 | Selection + copy/paste           | [04-selection-copy-paste.svelte](src/demos/04-selection-copy-paste.svelte) | Row + cell-range selection, summary footer over selected rows. |
| 5 | Inline editing                   | [05-inline-editing.svelte](src/demos/05-inline-editing.svelte) | Typed editors (text / number / checkbox / date) + dirty tracking + save. |
| 6 | 100k rows · 100 columns          | [06-large-dataset.svelte](src/demos/06-large-dataset.svelte) | Row + column virtualization, chunked load with progress indicator. |
| 7 | Grouping + aggregation           | [07-grouping-aggregation.svelte](src/demos/07-grouping-aggregation.svelte) | Group by department / country / both, row-summaries footer. |
| 8 | Tree + master/detail             | [08-tree-and-master-detail.svelte](src/demos/08-tree-and-master-detail.svelte) | Indented file-system tree + a master/detail orders → lines view. |
| 9 | Server-side data                 | [09-server-side.svelte](src/demos/09-server-side.svelte) | Debounced query, abort-cancellation, page navigation against a mock endpoint. |
| 10 | Custom cells + themes           | [10-custom-cells-and-themes.svelte](src/demos/10-custom-cells-and-themes.svelte) | `renderSnippet` cells (avatar, pill, progress, sparkline), density + theme toggles. |

## Shared

- [`src/shared/seed.ts`](src/shared/seed.ts) - deterministic `makePeople()` and `makeWidePeople()` fixtures (Mulberry32 PRNG).
- [`src/shared/registry.ts`](src/shared/registry.ts) - demo list driving the sidebar.
- [`src/index.css`](src/index.css) - shared theme tokens (`--sg-*`) plus pill / sparkbar / focus-ring helpers.

## Layout

```
examples/
├─ src/
│  ├─ App.svelte         # sidebar + hash router
│  ├─ main.ts            # entry
│  ├─ index.css          # shared tokens & helper classes
│  ├─ demos/             # one .svelte file per example
│  └─ shared/            # seed data, registry
├─ index.html
├─ package.json
├─ svelte.config.js
├─ tailwind.config.cjs
├─ postcss.config.cjs
└─ vite.config.js
```

Each demo is intentionally self-contained - there are no helpers imported across
demos. Read the source alongside the running app; it is the canonical form of
the answer to "how do I do X with SvGrid?".
