# sv-grid

A modern Svelte 5 data grid - headless-first engine plus a render component (`SvGrid.svelte`). Published on npm as **`sv-grid-core`**.

This repository is a **pnpm workspace** containing:

```
packages/sv-grid-core/      # the core grid (MIT-licensed)
packages/sv-grid-pro/            # paid feature pack: export + print (commercial)
packages/sv-grid-mcp/           # MCP server for AI assistants
examples/                       # demos covering every feature
website/                        # the public marketing + docs site
```

## Requirements

- Node.js ≥ 18
- pnpm (the workspace pins `pnpm@10.33.2` via the `packageManager` field; `corepack enable` will pick it up)

## Quick start

```bash
# from the repo root
pnpm install

# run the gallery at http://localhost:5174
pnpm dev

# build the library (writes packages/sv-grid-core/dist)
pnpm build

# build the gallery for production
pnpm build:example

# run the website at http://localhost:5180
pnpm dev:site

# build the website (writes website/dist)
pnpm build:site

# type-check both packages
pnpm test:types
```

`pnpm dev` proxies to `pnpm --filter sv-grid-core-example-gallery dev`. Inside the example the library is linked via the workspace (`"sv-grid-core": "workspace:*"`), so edits to `packages/sv-grid-core/src/**` are picked up by Vite HMR with no rebuild.

## Library entry points

```ts
import {
  SvGrid,
  FlexRender,
  // headless core + row-model factories
  createSvGrid,
  createCoreRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  createGroupedRowModel,
  createExpandedRowModel,
  createPaginatedRowModel,
  // features
  tableFeatures,
  rowSortingFeature,
  columnFilteringFeature,
  columnGroupingFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  // cell renderers
  renderSnippet,
  renderComponent,
} from 'sv-grid-core'
```

## Documentation

- [Getting started](docs/getting-started.md) - end-to-end walkthrough, 15 min read.
- [Why headless?](docs/why-headless.md) - what the headless core gives you and when to reach for it.
- [Tailwind integration](docs/help/tailwind.md) - re-theming via `--sg-*` tokens, dark-mode wiring.
- [Help index](docs/help/index.md) - topic pages for columns, rows, cells, filtering, editing.
- [Missing features](docs/help/missing-features.md) - honest gap list versus AG Grid parity.

## Examples gallery

20 production-quality demos under [`examples/src/demos/`](examples/src/demos/),
each viewable + copyable via the gallery's "Source" button:

01 Quick start · 02 Sort/Filter/Paginate · 03 Excel-style filters ·
04 Selection + copy/paste · 05 Inline editing · 06 100k × 100 dataset ·
07 Grouping + aggregation · 08 Tree + master/detail · 09 Server-side data ·
10 Custom cells + themes · 11 Stock market (live) · 12 HR team ·
13 Finances ledger · 14 Industrial IoT · 15 Localization ·
16 CSP-compliant · 17 Accessibility · 18 Cascade editing ·
19 Server-side rendering · 20 Industrial dashboard.

## Website

`website/` contains the public marketing + docs site (Vite + Svelte 5,
dark-only). Published to GitHub Pages via
[.github/workflows/deploy-website.yml](.github/workflows/deploy-website.yml)
on every push to `main`. See [website/README.md](website/README.md) for
details on routes, base-path config, and the one-time Pages setup.

## License

This repository ships under **mixed licensing**. Only `sv-grid-core`
is open source - everything else is commercial.

| Package | License | LICENSE file |
|---|---|---|
| [packages/sv-grid-core](packages/sv-grid-core/) | **MIT** | [LICENSE](packages/sv-grid-core/LICENSE) |
| [packages/sv-grid-pro](packages/sv-grid-pro/) | Commercial | [LICENSE](packages/sv-grid-pro/LICENSE) |
| [packages/sv-grid-mcp](packages/sv-grid-mcp/) | Commercial | [LICENSE](packages/sv-grid-mcp/LICENSE) |
| [website](website/) | Proprietary | [LICENSE](website/LICENSE) |

`sv-grid-core` (MIT) can be used freely, including for commercial
work. The Pro feature pack, the MCP server, and the marketing + docs
website are proprietary - source is visible for evaluation and for
paying customers, but visibility does not grant a license. See the
[SvGrid pricing page](https://sv-grid.dev/pricing) for Pro / Enterprise
purchases.

## Trademark

SvGrid&trade; and sv-grid&trade; are trademarks of jQWidgets Ltd. The
licenses above apply to the source code only; they grant no rights to
the **SvGrid** / **sv-grid** names or logos. You may build on and
redistribute the MIT-licensed code, but you may not reuse the project's
name or branding in a way that implies endorsement by, or affiliation
with, jQWidgets Ltd, nor redistribute it under a confusingly similar
name.
