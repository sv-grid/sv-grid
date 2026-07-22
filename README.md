<p align="center">
  <img src="https://svgrid.com/brand/svgrid-logo-icon-1200.png" alt="SvGrid" width="100" height="100" />
</p>

# SvGrid

[![npm version](https://img.shields.io/npm/v/%40svgrid%2Fgrid.svg?label=%40svgrid%2Fgrid)](https://www.npmjs.com/package/@svgrid/grid)
[![npm downloads](https://img.shields.io/npm/dm/%40svgrid%2Fgrid.svg)](https://www.npmjs.com/package/@svgrid/grid)
[![MIT License](https://img.shields.io/badge/license-MIT-brightgreen.svg)](packages/grid/LICENSE)
[![TypeScript](https://img.shields.io/badge/types-included-blue.svg)](packages/grid/dist)
[![Svelte 5](https://img.shields.io/badge/svelte-5-ff3e00.svg)](https://svelte.dev)

> The Svelte 5 native data grid. **Headless-first. Render-ready.**

A modern data grid built from the first line for Svelte 5 runes, not a React grid wrapped in a Svelte shim. A headless engine you can compose plus a full `<SvGrid />` render component you can drop in. MIT core, MCP server for AI assistants, 280+ live demos.

**Quick links:** [Website](https://svgrid.com) · [Docs](https://svgrid.com/docs) · [280+ Demos](https://svgrid.com/demos) · [Pricing](https://svgrid.com/pricing) · [Roadmap](https://svgrid.com/roadmap) · [Blog](https://svgrid.com/blog) · [npm](https://www.npmjs.com/package/@svgrid/grid)

---

## Install

Scaffold a working Vite + Svelte 5 app with SvGrid wired up in one command:

```bash
npm create @svgrid@latest
```

Or add it to an existing app:

```bash
npm install @svgrid/grid
```

## The 30-second example

```svelte
<script lang="ts">
  import { SvGrid, type ColumnDef } from '@svgrid/grid'

  const rows = [
    { firstName: 'Ada',   age: 36, status: 'active' },
    { firstName: 'Linus', age: 54, status: 'active' },
    { firstName: 'Grace', age: 85, status: 'inactive' },
  ]
  const columns: ColumnDef<{}, (typeof rows)[number]>[] = [
    { field: 'firstName', header: 'First name' },
    { field: 'age',       header: 'Age' },
    { field: 'status',    header: 'Status' },
  ]
</script>

<SvGrid data={rows} columns={columns} />
```

That is a real, working, accessible grid. Sorting, filtering, virtualization, cell selection, and inline editing all wire up the moment you turn on the matching prop.

## What's in the box

- **Row + column virtualization.** 100k × 100 stays smooth; there's a 1M-row demo too.
- **Filtering.** Excel-style filter menu, inline filter row, locale-aware text matching, set / value-list filter, between operator on numbers and dates.
- **Editing.** 14 built-in `editorType`s (text, number, date, datetime, time, select, rich-select with typeahead, textarea, color, checkbox, list, chips, rating, password) plus a `cellEditor` snippet slot for anything else.
- **Selection.** Cell-range click+drag and Shift+arrows, copy/paste as TSV, Excel-style fill handle, row selection.
- **Views.** Native Kanban board mode (drag cards between lanes), row grouping with aggregation, tree data, master/detail, full-width detail rows.
- **Layout.** Row + column pinning, sticky header + first column, header drag-to-reorder, keyboard-accessible column sizing.
- **Operations.** Find in grid (Ctrl+F), undo / redo (Ctrl+Z), transaction API, optimistic updates, server-side row model with sort / filter / group pushdown.
- **UI components.** A Svelte 5 component suite ships in the same package - inputs, selection, date/time, overlays, layout, feedback - usable standalone or as grid cell editors.
- **A11y.** WAI-ARIA grid roles, full keyboard navigation, RTL, high-contrast theme.
- **Bundle.** ~7.5 KB gzipped headless core, ~42 KB gzipped full render component (Svelte stays a peer).

The MIT community core has zero feature gating, no license key, no watermark, no row-count cap.

## Packages

| Package | License | What it adds |
|---|---|---|
| [`@svgrid/grid`](packages/grid/) | **MIT** | The full data grid **+ a Svelte 5 UI component suite**, free for commercial use |
| [`@svgrid/enterprise`](packages/enterprise/) | Commercial | Export to Excel / PDF / CSV / TSV / HTML, paginated print, pivot tables with drag-and-drop Designer + drill-through, AI helpers, and the SvGrid Studio codegen |
| [`@svgrid/studio`](packages/studio/) | Commercial (preview) | Grid-powered CRUD screens - a CLI + visual designer that generates a runnable SvelteKit app from your schema, over PGlite / Supabase / REST |
| [`@svgrid/mcp`](packages/mcp/) | Commercial | MCP server for Claude / Cursor / Zed |

OSS projects get the Enterprise pack free. See [Pricing](https://svgrid.com/pricing).

## AI-native

SvGrid ships an MCP (Model Context Protocol) server so Claude, Cursor, and Zed give accurate, version-pinned answers about every prop, method, and event in the library plus all 280+ demo sources as context.

```json
{
  "mcpServers": {
    "svgrid": {
      "command": "npx",
      "args": ["-y", "@svgrid/mcp"]
    }
  }
}
```

A published `llms.txt` / `llms-full.txt` is also available for retrieval-augmented setups.

## Who's behind it

SvGrid is built by [jQWidgets](https://www.jqwidgets.com), the team behind jqwidgets.com and [htmlelements.com](https://www.htmlelements.com). We've been shipping UI components since 2011 to 5,000+ companies including Samsung, Boeing, NVIDIA, Microsoft, Nokia, and Intel. SvGrid is our Svelte 5 native effort.

---

## Support

SvGrid is open core: the MIT `@svgrid/grid` is free for any use, and the project is funded by Enterprise licenses, not donations.

- **Found a bug or have a question?** Open an issue at [github.com/sv-grid/sv-grid/issues](https://github.com/sv-grid/sv-grid/issues).
- **Need commercial or priority support?** It is included with [Enterprise](https://svgrid.com/pricing). OSS projects under an [OSI-approved license](https://opensource.org/licenses) get an Enterprise OSS key for free.

---

## Repository layout

This is a **pnpm workspace** monorepo:

```
packages/grid/            @svgrid/grid        - MIT data grid + UI component suite
packages/enterprise/      @svgrid/enterprise  - paid feature pack + Studio codegen
packages/studio/          @svgrid/studio      - Studio CLI + visual designer
packages/mcp/             @svgrid/mcp         - MCP server
packages/create-sv-grid/  @svgrid/create      - grid scaffolder
packages/create-studio/   create @svgrid/studio - Studio app scaffolder
examples/                                     - 280+ live demos
website/                                      - svgrid.com source
docs/                                         - markdown docs
```

### Requirements

- Node.js ≥ 18
- pnpm (the workspace pins `pnpm@10.33.2` via `packageManager`; `corepack enable` will pick it up)

### Develop

```bash
pnpm install            # install workspace deps
pnpm dev                # run the demo gallery at http://localhost:5174
pnpm build              # build packages/grid/dist
pnpm build:example      # build the demo gallery
pnpm dev:site           # run the website at http://localhost:5180
pnpm build:site         # build the website (writes website/dist)
pnpm test:types         # type-check every package
```

`pnpm dev` proxies to `pnpm --filter @svgrid/grid-example-gallery dev`. Inside the example, the library is linked via the workspace (`"@svgrid/grid": "workspace:*"`), so edits in `packages/grid/src/**` are picked up by Vite HMR with no rebuild.

### Library entry points

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
} from '@svgrid/grid'
```

### Documentation

- [Getting started](docs/getting-started.md) - end-to-end walkthrough.
- [Why headless?](docs/why-headless.md) - what the headless core gives you and when to reach for it.
- [Tailwind integration](docs/help/tailwind.md) - re-theming via `--sg-*` tokens, dark-mode wiring.
- [Help index](docs/help/index.md) - topic pages for columns, rows, cells, filtering, editing.
- [Missing features](docs/help/missing-features.md) - honest gap list.

### Website

`website/` contains the public marketing + docs site (Vite + Svelte 5). Published to GitHub Pages via [.github/workflows/deploy-website.yml](.github/workflows/deploy-website.yml) on every push to `main`. See [website/README.md](website/README.md) for routes, base-path config, and the one-time Pages setup.

## What's not built yet

Honest list:

- Column spanning (`colSpan` on cell context). On the roadmap, large effort.
- Built-in row dragging across grids. Demos cover the in-grid case; cross-grid is not in the engine.
- Variable row height on the `<SvGrid>` render component. The headless virtualizer does it today.
- Engine-level formula language. There's a working in-grid formula engine in a demo, but it hasn't graduated into the package.
- Custom calendar systems (Hijri, Buddhist, fiscal year) for the date editor. Gregorian dates / times / datetimes are built in.

Full public [roadmap with effort tags](https://svgrid.com/roadmap) and a "recently shipped" track record on svgrid.com.

## License

This repository ships under **mixed licensing**. Only `@svgrid/grid` is open source - everything else is commercial.

| Package | License | LICENSE file |
|---|---|---|
| [packages/grid](packages/grid/) | **MIT** | [LICENSE](packages/grid/LICENSE) |
| [packages/enterprise](packages/enterprise/) | Commercial | [LICENSE](packages/enterprise/LICENSE) |
| [packages/mcp](packages/mcp/) | Commercial | [LICENSE](packages/mcp/LICENSE) |
| [website](website/) | Proprietary | [LICENSE](website/LICENSE) |

`@svgrid/grid` (MIT) can be used freely, including for commercial work. The Enterprise feature pack, the MCP server, and the marketing + docs website are proprietary - source is visible for evaluation and for paying customers, but visibility does not grant a license. See the [SvGrid pricing page](https://svgrid.com/pricing) for Enterprise purchases.

## Trademark

SvGrid&trade; and sv-grid&trade; are trademarks of jQWidgets Ltd. The licenses above apply to the source code only; they grant no rights to the **SvGrid** / **sv-grid** names or logos. You may build on and redistribute the MIT-licensed code, but you may not reuse the project's name or branding in a way that implies endorsement by, or affiliation with, jQWidgets Ltd, nor redistribute it under a confusingly similar name.
