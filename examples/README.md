# SvGrid - Examples Gallery

370+ runnable demos covering the full SvGrid feature surface. The first ten
below are the guided tour; the rest are grouped by feature in the running app
and on [svgrid.com/demos](https://svgrid.com/demos/).

```bash
# from the repo root
pnpm install
pnpm dev
# open http://localhost:5174
```

## Start here

| # | Title | Source | What it shows |
| - | ----- | ------ | ------------- |
| 1 | Quick start                      | [01-quick-start.svelte](src/demos/01-quick-start.svelte) | The smallest possible grid - 10 rows, 5 columns, zero config. |
| 2 | Sort · Filter · Paginate         | [02-sort-filter-paginate.svelte](src/demos/02-sort-filter-paginate.svelte) | Multi-column sort, filter row, page-size selector against ~5k rows. |
| 3 | Excel-style filters              | [03-excel-filters.svelte](src/demos/03-excel-filters.svelte) | Header filter menu + active-chip strip + imperative quick-presets. |
| 4 | Selection + copy/paste           | [04-selection-copy-paste.svelte](src/demos/04-selection-copy-paste.svelte) | Row + cell-range selection, summary footer over selected rows. |
| 5 | Inline editing                   | [05-inline-editing.svelte](src/demos/05-inline-editing.svelte) | Typed editors (text / number / checkbox / date) + dirty tracking + save. |
| 6 | 100k rows · 100 columns          | [06-large-dataset.svelte](src/demos/06-large-dataset.svelte) | Row + column virtualization, chunked load with progress indicator. |
| 7 | Grouping + aggregation           | [07-grouping-aggregation.svelte](src/demos/07-grouping-aggregation.svelte) | Group by department / country / both, row-summaries footer. |
| 8 | Tree + master/detail             | [08-tree-and-master-detail.svelte](src/demos/08-tree-and-master-detail.svelte) | Indented file-system tree + a master/detail orders to lines view. |
| 9 | Server-side data                 | [09-server-side.svelte](src/demos/09-server-side.svelte) | Debounced query, abort-cancellation, page navigation against a mock endpoint. |
| 10 | Custom cells + themes           | [10-custom-cells-and-themes.svelte](src/demos/10-custom-cells-and-themes.svelte) | `renderSnippet` cells (avatar, pill, progress, sparkline), density + theme toggles. |

## Adding a demo

Two edits, always:

1. `src/demos/<id>-<slug>.svelte` in this folder.
2. A matching `demo('<id>-<slug>', ...)` entry in `website/src/lib/demos.ts`.

`pnpm demos:count` fails if the two disagree. Community demos take a lighter
path - see [src/demos/community/README.md](src/demos/community/README.md).

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
│  │  ├─ community/      # community-contributed demos
│  │  └─ prompts/        # generated AI prompt sidecars
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
