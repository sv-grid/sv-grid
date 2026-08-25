<p align="center">
  <img src="https://svgrid.com/brand/svgrid-logo-icon-1200.png" alt="SvGrid" width="100" height="100" />
</p>

# SvGrid

[![npm version](https://img.shields.io/npm/v/%40svgrid%2Fgrid.svg?label=%40svgrid%2Fgrid)](https://www.npmjs.com/package/@svgrid/grid)
[![npm downloads](https://img.shields.io/npm/dm/%40svgrid%2Fgrid.svg)](https://www.npmjs.com/package/@svgrid/grid)
[![CI](https://github.com/sv-grid/sv-grid/actions/workflows/test.yml/badge.svg)](https://github.com/sv-grid/sv-grid/actions/workflows/test.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-brightgreen.svg)](packages/grid/LICENSE)
[![TypeScript](https://img.shields.io/badge/types-included-blue.svg)](https://www.npmjs.com/package/@svgrid/grid)
[![Svelte 5](https://img.shields.io/badge/svelte-5-ff3e00.svg)](https://svelte.dev)

> The Svelte 5 native data grid. **Headless-first. Render-ready.**

**SvGrid** is a Svelte 5 data grid and data table built from the first line for runes, not a React grid
wrapped in a Svelte shim. It does virtual scrolling over 100k+ rows, Excel-style filtering, inline
editing, row grouping, tree data, pivot, and server-side data, and it ships both a headless engine you
compose yourself and a drop-in `<SvGrid />` component. Open source under MIT, TypeScript-first, and
usable in SvelteKit with SSR.

<p align="center">
  <img src="https://svgrid.com/brand/svgrid-hero.png" alt="A SvGrid trading desk: KPI cards, sector filter chips, and a virtualized data table with sparkline trend columns, conditional colour, and pinned columns." width="100%" />
</p>

**Quick links:** [Website](https://svgrid.com) · [Docs](https://svgrid.com/docs/) · [370+ Demos](https://svgrid.com/demos/) · [Pricing](https://svgrid.com/pricing/) · [Roadmap](https://svgrid.com/roadmap/) · [Blog](https://svgrid.com/blog/) · [npm](https://www.npmjs.com/package/@svgrid/grid)

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

In a project that already uses the [Svelte CLI](https://svelte.dev/docs/cli), the add-on
wires it up and can drop in a working demo grid:

```bash
npx sv add @svgrid
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

That is a real, working, accessible table. Sorting, filtering, virtualization, cell selection, and
inline editing all wire up the moment you turn on the matching prop.

## Quick facts

| | |
|---|---|
| **Package** | `@svgrid/grid` |
| **License** | MIT, free for commercial use |
| **Requires** | `svelte@^5` (peer dependency), Node 16+ |
| **Bundle (gzip)** | ~2 KB headless core, ~77 KB full `<SvGrid>` + ~9 KB CSS |
| **Types** | Bundled, no `@types/` package needed |
| **SSR** | Works under SvelteKit SSR and static builds |
| **Demos** | 370+ at [svgrid.com/demos](https://svgrid.com/demos/) |
| **AI grounding** | [MCP server](https://www.npmjs.com/package/@svgrid/mcp), [llms.txt](https://svgrid.com/llms.txt), [Agent Skill](https://svgrid.com/docs/help/skill/) |

Re-derive the numbers yourself: `pnpm size` and `pnpm demos:count`.

## What's in the box

- **Virtual scrolling.** Row + column windowing; 100k x 100 stays smooth, and there's a 1M-row demo.
- **Filtering.** Excel-style filter menu, inline filter row, locale-aware text matching, set / value-list filter, between operator on numbers and dates.
- **Editing.** 15 built-in `editorType`s (text, number, date, datetime, time, select, rich-select with typeahead, autocomplete, textarea, color, checkbox, list, chips, rating, password), plus `date-native` / `datetime-native` / `time-native` to opt out of the rich pickers, and a `cellEditor` snippet slot for anything else.
- **Selection.** Cell-range click+drag and Shift+arrows, copy/paste as TSV, Excel-style fill handle, row selection.
- **Views.** Row grouping with aggregation, tree data, master/detail, full-width detail rows, spreadsheet mode with formulas, plus Kanban board and scheduler/calendar views.
- **Layout.** Row + column pinning, sticky header + first column, header drag-to-reorder, keyboard-accessible column sizing, responsive mode for mobile.
- **Operations.** Find in grid (Ctrl+F), undo / redo (Ctrl+Z), transaction API, optimistic updates, server-side row model with sort / filter / group pushdown.
- **AI helpers, free.** Natural-language filter, smart fill, summarize, classify, anomaly detection, and "chart this". Model-agnostic: you register one provider, nothing is bundled.
- **UI components.** A Svelte 5 component suite ships in the same package (inputs, selection, date/time, overlays, layout, feedback), usable standalone or as grid cell editors.
- **Accessibility.** WAI-ARIA grid roles, full keyboard navigation, RTL, high-contrast theme.
- **Production concerns.** TypeScript types, CSP / Trusted-Types safe rendering, SSR-friendly, themeable via `--sg-*` CSS custom properties.

The MIT community core has zero feature gating: no license key, no watermark, no row-count cap.

## Which package do I need?

| You want to | Install | License |
|---|---|---|
| A data grid in a Svelte 5 / SvelteKit app | `@svgrid/grid` | MIT |
| Excel / PDF export, import, pivot tables, print, Kanban + scheduler renderers | `+ @svgrid/enterprise` | Commercial |
| The grid in React, Vue, Angular, or plain HTML | `@svgrid/grid-wc` | MIT |
| Standalone Svelte 5 UI components (no grid) | `@svgrid/ui` | MIT |
| Accurate SvGrid answers from Claude / Cursor / Zed | `@svgrid/mcp` | MIT |
| A generated CRUD app from your database schema | `@svgrid/studio` | Commercial |
| To port an existing `svelte-headless-table` app | `npx @svgrid/migrate` | MIT |
| To add the grid via the Svelte CLI | `npx sv add @svgrid` | MIT |

OSS projects under an [OSI-approved license](https://opensource.org/licenses) get the Enterprise pack
free. See [Pricing](https://svgrid.com/pricing/).

## Coming from another grid?

| | SvGrid | AG Grid Community | TanStack Table |
|---|---|---|---|
| **Svelte 5 runes native** | Yes | No, JS core + wrapper | Adapter only |
| **Ships a renderer** | Yes, plus headless | Yes | No, headless only |
| **Bundle (gzip)** | ~2 KB headless / ~77 KB full | ~340 KB | ~12-14 KB |
| **Virtualization built in** | Yes | Yes | Bring your own |
| **Master/detail, tree, range selection** | Free | Enterprise only | Build it yourself |
| **License** | MIT core, commercial pack | MIT core, commercial pack | MIT |

Multi-framework teams are better served by AG Grid or TanStack Table; SvGrid is deliberately
Svelte-first. Full detail and migration guides:
[SvGrid vs AG Grid vs TanStack Table](https://svgrid.com/docs/help/comparison/) ·
[Migrating from AG Grid](https://svgrid.com/docs/help/migrating-from-ag-grid/) ·
[Migrating from Handsontable](https://svgrid.com/docs/help/migrating-from-handsontable/)

## AI-native

SvGrid is built to be written *by* AI as well as used with it. Three grounding surfaces ship with the
project so assistants cite real props, methods, and events instead of inventing them.

**MCP server** for Claude Desktop, Cursor, and Zed:

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

Claude Code users can skip the config file:

```bash
claude mcp add svgrid -- npx -y @svgrid/mcp
npx skills add sv-grid/sv-grid    # always-on house-style rules
```

**Retrieval files** for RAG and custom agents: [llms.txt](https://svgrid.com/llms.txt) (index) and
[llms-full.txt](https://svgrid.com/llms-full.txt) (every doc page concatenated). See
[Use sv-grid docs as LLM context](https://svgrid.com/docs/help/llm-grounding/).

## Frequently asked questions

### Does SvGrid work with SvelteKit and SSR?

Yes. The render component emits meaningful HTML before hydration, so it works under SvelteKit SSR and
static builds. See [going to production](https://svgrid.com/docs/getting-started/6-going-to-production/).

### Is SvGrid free for commercial use?

Yes. `@svgrid/grid` is MIT, with no license key, no watermark, and no row-count cap. Only the optional
`@svgrid/enterprise` pack (export, import, pivot, print) is paid.

### Does it support Svelte 4?

No. SvGrid is Svelte 5 only by design. It uses runes and snippets rather than Svelte 4 stores, which is
what lets it skip the abstraction layer a cross-version grid would need.

### How many rows can it handle?

100k rows x 100 columns scroll smoothly on the client thanks to row and column virtualization, and only
the visible window is ever in the DOM. Past that, use the server-side row model, which pushes sorting,
filtering, and grouping to your backend.

### How big is the bundle?

About 2 KB gzipped for the headless core and about 77 KB for the full `<SvGrid>` render component, plus
9 KB of CSS, with Svelte excluded as a peer dependency. Charts, date/time editors, menus, and export add
another ~64 KB that loads on demand rather than up front. Run `pnpm size` to re-measure.

### Do I need Tailwind?

No. The render component ships its own scoped styles and re-themes through `--sg-*` CSS custom
properties. Tailwind is supported if you use it; see the
[Tailwind guide](https://svgrid.com/docs/help/tailwind/).

### Can I use it from React, Vue, or Angular?

Yes, through [`@svgrid/grid-wc`](https://www.npmjs.com/package/@svgrid/grid-wc), which wraps the grid as
a `<sv-grid>` custom element with no build step required.

### Is it accessible?

It implements the WAI-ARIA 1.2 grid pattern with full keyboard navigation, a screen-reader announcement
layer, RTL support, and a high-contrast theme. See
[accessibility](https://svgrid.com/docs/help/accessibility/) for exactly where the responsibility line sits.

### How do I get AI assistants to write correct SvGrid code?

Point them at the MCP server, or feed them `llms.txt`. Both are covered in the
[AI-native](#ai-native) section above.

## Who's behind it

SvGrid is built by [jQWidgets](https://www.jqwidgets.com), the team behind jqwidgets.com and
[htmlelements.com](https://www.htmlelements.com). We've been shipping UI components since 2011 to 5,000+
companies including Samsung, Boeing, NVIDIA, Microsoft, Nokia, and Intel. SvGrid is our Svelte 5 native
effort.

## Support

SvGrid is open core: the MIT `@svgrid/grid` is free for any use, and the project is funded by Enterprise
licenses, not donations.

- **Found a bug or have a question?** [Open an issue](https://github.com/sv-grid/sv-grid/issues).
- **Want to contribute?** See [CONTRIBUTING.md](CONTRIBUTING.md).
- **Security issue?** See [SECURITY.md](SECURITY.md).
- **Need commercial or priority support?** It is included with [Enterprise](https://svgrid.com/pricing/).

## What's not built yet

Honest list:

- Custom filter / floating-filter component slot. Filters are configurable but not yet pluggable as your own component. Medium effort.
- Custom tool panels. The tool panel is a fixed Columns + Filters pair. Medium effort.
- Integrated-chart depth. 17 chart types, the wizard, and "chart selected range" ship; the chart toolbar and the click-to-cross-filter loop do not. Large effort.
- Server-side pivot and a viewport row model. The server-side row model does sort / filter / group / infinite today. Large effort.
- A formula language of our own. `createHyperFormulaSheet` ships in the package so you can bring HyperFormula, and there are in-grid formula demos, but the engine itself is not ours and there is no formula bar.
- Custom calendar systems (Hijri, Buddhist, fiscal year) for the date editor. Gregorian dates / times / datetimes are built in.

Full public [roadmap with effort tags](https://svgrid.com/roadmap/) and a "recently shipped" track record
on svgrid.com.

---

## Repository layout

This is a **pnpm workspace** monorepo:

```
packages/grid/            @svgrid/grid          - MIT data grid + UI component suite
packages/enterprise/      @svgrid/enterprise    - paid feature pack + Studio codegen
packages/studio/          @svgrid/studio        - Studio CLI + visual designer
packages/mcp/             @svgrid/mcp           - MCP server
packages/grid-wc/         @svgrid/grid-wc       - <sv-grid> web component
packages/svgrid-ui/       @svgrid/ui            - UI component CLI
packages/create-sv-grid/  @svgrid/create        - grid scaffolder
packages/create-studio/   @svgrid/create-studio - Studio app scaffolder
packages/migrate/         @svgrid/migrate       - svelte-headless-table codemod
packages/svgrid-sv/       @svgrid/sv            - Svelte CLI add-on (sv add @svgrid)
examples/                                       - 370+ live demos
website/                                        - svgrid.com source
docs/                                           - markdown docs
```

### Requirements

- Node.js >= 18
- pnpm (the workspace pins `pnpm@10.33.2` via `packageManager`; `corepack enable` will pick it up)

### Develop

```bash
pnpm install            # install workspace deps
pnpm dev                # run the demo gallery at http://localhost:5174
pnpm build              # build packages/grid/dist
pnpm build:example      # build the demo gallery
pnpm dev:site           # run the website at http://localhost:5180
pnpm build:site         # build the website (writes website/dist)
pnpm test               # run the grid test suite
pnpm test:types         # type-check every package
pnpm size               # re-measure the gzipped bundle
pnpm demos:count        # re-count the live demos
```

`pnpm dev` proxies to `pnpm --filter @svgrid/grid-example-gallery dev`. Inside the example, the library
is linked via the workspace (`"@svgrid/grid": "workspace:*"`), so edits in `packages/grid/src/**` are
picked up by Vite HMR with no rebuild.

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
- [Bundle size](docs/reference/bundle-size.md) - measured numbers and how to reproduce them.
- [Help index](docs/help/index.md) - topic pages for columns, rows, cells, filtering, editing.
- [Missing features](docs/help/missing-features.md) - honest gap list.

### Website

`website/` contains the public marketing + docs site (Vite + Svelte 5). Published to GitHub Pages via
[.github/workflows/deploy-website.yml](.github/workflows/deploy-website.yml) on every push to `main`. See
[website/README.md](website/README.md) for routes, base-path config, and the one-time Pages setup.

## License

This repository ships under **mixed licensing**. The grid, the web component, the UI CLI, the MCP
server, the migration codemod, the Svelte CLI add-on, and the two scaffolders are open source; the
Enterprise pack, Studio, and the website are commercial.

| Package | License | LICENSE file |
|---|---|---|
| [packages/grid](packages/grid/) | **MIT** | [LICENSE](packages/grid/LICENSE) |
| [packages/grid-wc](packages/grid-wc/) | **MIT** | [LICENSE](packages/grid-wc/LICENSE) |
| [packages/svgrid-ui](packages/svgrid-ui/) | **MIT** | [LICENSE](packages/svgrid-ui/LICENSE) |
| [packages/create-sv-grid](packages/create-sv-grid/) | **MIT** | [LICENSE](packages/create-sv-grid/LICENSE) |
| [packages/create-studio](packages/create-studio/) | **MIT** | [LICENSE](packages/create-studio/LICENSE) |
| [packages/migrate](packages/migrate/) | **MIT** | [LICENSE](packages/migrate/LICENSE) |
| [packages/svgrid-sv](packages/svgrid-sv/) | **MIT** | [LICENSE](packages/svgrid-sv/LICENSE) |
| [packages/enterprise](packages/enterprise/) | Commercial | [LICENSE](packages/enterprise/LICENSE) |
| [packages/mcp](packages/mcp/) | **MIT** | [LICENSE](packages/mcp/LICENSE) |
| [packages/studio](packages/studio/) | Commercial | [LICENSE](packages/studio/LICENSE) |
| [website](website/) | Proprietary | [LICENSE](website/LICENSE) |

The MIT packages can be used freely, including for commercial work. The Enterprise feature pack,
Studio, and the marketing + docs website are proprietary: source is visible for evaluation and for
paying customers, but visibility does not grant a license. See the
[SvGrid pricing page](https://svgrid.com/pricing/) for Enterprise purchases.

## Trademark

SvGrid&trade; and sv-grid&trade; are trademarks of jQWidgets Ltd. The licenses above apply to the source
code only; they grant no rights to the **SvGrid** / **sv-grid** names or logos. You may build on and
redistribute the MIT-licensed code, but you may not reuse the project's name or branding in a way that
implies endorsement by, or affiliation with, jQWidgets Ltd, nor redistribute it under a confusingly
similar name.
