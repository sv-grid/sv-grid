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
[![GitHub stars](https://img.shields.io/github/stars/sv-grid/sv-grid?style=social)](https://github.com/sv-grid/sv-grid/stargazers)

> **The Svelte data grid. Headless-first. Render-ready.**

**SvGrid** is a data grid and data table for Svelte 5, written with runes from the first line rather
than ported from a React grid. It virtualizes rows and columns (there is a 1 million row demo below)
and ships Excel-style filtering, inline editing, row grouping, tree data, pivot, charts, and
server-side data. Drop in the `<SvGrid />` component, or build your own table on the headless engine
from `@svgrid/grid/core`. MIT licensed, TypeScript-first, and it server-renders under SvelteKit.

<p align="center">
  <img src="https://svgrid.com/brand/svgrid-hero.png" alt="A SvGrid trading desk: KPI cards, sector filter chips, and a virtualized data table with sparkline trend columns, conditional colour, and pinned columns." width="100%" />

<img width="100%" alt="1m-rows" src="https://github.com/user-attachments/assets/ab175a5b-7653-4077-92c1-a6fd21d34a9a" />

</p>

**Quick links:** [Website](https://svgrid.com) · [Docs](https://svgrid.com/docs/) · [400+ Demos](https://svgrid.com/demos/) · [Pricing](https://svgrid.com/pricing/) · [Roadmap](https://svgrid.com/roadmap/) · [Blog](https://svgrid.com/blog/) · [Releases](https://github.com/sv-grid/sv-grid/releases) · [npm](https://www.npmjs.com/package/@svgrid/grid)

If you build on Svelte 5, [star the repo](https://github.com/sv-grid/sv-grid) so it is there when you
need a grid. Stars are also how other Svelte developers find it.

---

## Install

```bash
npm install @svgrid/grid
```

Or start from a working Vite + Svelte 5 app (`npm create @svgrid@latest`), or add it to a
[Svelte CLI](https://svelte.dev/docs/cli) project with `npx sv add @svgrid`.

## The 30-second example

```svelte
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Row = { firstName: string; age: number; status: string }

  const data = $state<Row[]>([
    { firstName: 'Ada',   age: 36, status: 'active' },
    { firstName: 'Linus', age: 54, status: 'active' },
    { firstName: 'Grace', age: 85, status: 'inactive' },
  ])

  const columns: GridColumns<Row> = [
    { field: 'firstName', header: 'First name' },
    { field: 'age',       header: 'Age' },
    { field: 'status',    header: 'Status' },
  ]
</script>

<SvGrid {data} {columns} sortable filterable editable />
```

That is a working, accessible table. Sorting, filtering, virtualization, cell selection, and inline
editing each switch on with the matching prop.

<img width="100%" alt="03-inline-edit" src="https://github.com/user-attachments/assets/cebfb8ed-e54e-4409-aa82-e77df73fb584" />

## Headless or render: same engine

`<SvGrid />` is a renderer over a headless state machine, and the state machine is public. Import it
from `@svgrid/grid/core` (2.5 KB gzipped, no DOM, no CSS) when you want your own markup, a canvas
renderer, or a row model you can unit-test in plain Node:

```ts
import {
  createSvGrid, createCoreRowModel, createSortedRowModel,
  tableFeatures, rowSortingFeature, sortFns,
} from '@svgrid/grid/core'

const grid = createSvGrid({
  _features: tableFeatures({ rowSortingFeature }),
  _rowModels: {
    coreRowModel: createCoreRowModel(),
    sortedRowModel: createSortedRowModel(sortFns),
  },
  columns,
  data,
})

for (const row of grid.getRowModel().rows) {
  for (const cell of row.getAllCells()) drawCell(cell)
}
```

Features are opt-in modules, so a grid that never groups never ships grouping. The render component
uses the exact same hooks. See [Why headless?](docs/why-headless.md) and the
[headless table demo](https://svgrid.com/demos/186-headless-table/).

## See it running

Every demo opens in the browser and has an **Edit in StackBlitz** button that turns it into a live
Vite + Svelte 5 project. Nothing to install.

| | | |
|:--:|:--:|:--:|
| [<img src="https://svgrid.com/thumbs/00-trading-desk.webp" width="260" alt="Trading desk demo" />](https://svgrid.com/demos/00-trading-desk/) | [<img src="https://svgrid.com/thumbs/78-million-rows.webp" width="260" alt="1 million rows demo" />](https://svgrid.com/demos/78-million-rows/) | [<img src="https://svgrid.com/thumbs/83-spreadsheet-formulas.webp" width="260" alt="Spreadsheet with formulas demo" />](https://svgrid.com/demos/83-spreadsheet-formulas/) |
| **[Trading desk](https://svgrid.com/demos/00-trading-desk/)**<br>10,000 securities on a 500 ms feed | **[1 million rows](https://svgrid.com/demos/78-million-rows/)**<br>sort, filter, group and edit, all on | **[Spreadsheet + formulas](https://svgrid.com/demos/83-spreadsheet-formulas/)**<br>formula cells in a real grid |
| [<img src="https://svgrid.com/thumbs/343-kanban-board.webp" width="260" alt="Kanban board demo" />](https://svgrid.com/demos/343-kanban-board/) | [<img src="https://svgrid.com/thumbs/363-scheduler-intro.webp" width="260" alt="Scheduler demo" />](https://svgrid.com/demos/363-scheduler-intro/) | [<img src="https://svgrid.com/thumbs/80-cell-types-showcase.webp" width="260" alt="Cell types showcase demo" />](https://svgrid.com/demos/80-cell-types-showcase/) |
| **[Kanban board](https://svgrid.com/demos/343-kanban-board/)**<br>the same grid, board mode | **[Scheduler](https://svgrid.com/demos/363-scheduler-intro/)**<br>calendar views off the same data | **[Cell types](https://svgrid.com/demos/80-cell-types-showcase/)**<br>every editor in one grid |

All [400+ demos](https://svgrid.com/demos/) are browsable by category.

## What ships free

The MIT package has no license key, no watermark, and no row-count cap.

- **Virtual scrolling** over rows and columns. 100k rows x 100 columns scroll smoothly; the 1M-row demo is above.
- **Filtering.** Excel-style filter menu, inline filter row, set filter, between operator on numbers and dates, locale-aware text matching.
- **Editing.** 18 built-in `editorType`s from text and number to date/time pickers, rich-select with typeahead, autocomplete, chips, color, and rating, plus a `cellEditor` snippet for anything else.
- **Selection.** Cell ranges by drag or Shift+arrows, TSV copy/paste, an Excel-style fill handle, drag a range to move it.
- **Views.** Row grouping with aggregation, tree data, master/detail, spreadsheet mode with formulas.
- **Layout.** Row and column pinning, sticky header, drag-to-reorder, resizable rows and columns, a responsive mode for phones.
- **Operations.** Find in grid (Ctrl+F), undo/redo, a transaction API, optimistic updates, server-side sort/filter/paging and infinite scroll.
- **Charts.** A chart panel on the grid's rows and a standalone `SvChart`: 29 SVG chart types, zoom, drilldown, technical indicators, export. No charting library.
- **AI helpers.** Natural-language filter, smart fill, summarize, classify, anomaly detection, "chart this". You register one provider; nothing is bundled.
- **A Svelte 5 UI suite** in the same package (inputs, selects, date/time, overlays, layout), usable standalone or as cell editors.
- **Accessibility and i18n.** WAI-ARIA grid roles, full keyboard navigation, RTL, a high-contrast theme, every string overridable through `localeText`.
- **Production.** Bundled types, CSP and Trusted-Types safe rendering, SvelteKit SSR, theming through `--sg-*` CSS custom properties.

## In production

> "We were looking for an Excel-like library using SvelteKit. Then I explored your library a lot,
> mostly everything about SvGrid: cell selection, grabbing cells, updating values in cells. So we
> used it for an accounting application. It was so easy to integrate. We even built our custom
> theme, by updating the svgrid.css file which includes all the classes. **We found no issues yet,
> everything just worked for us.**"
>
> <a href="https://github.com/SikandarJODD"><img src="https://github.com/SikandarJODD.png?size=64" width="32" height="32" align="left" alt="" /></a> **[Sikandar Bhide](https://github.com/SikandarJODD)** - built an accounting app on SvelteKit

## Quick facts

| | |
|---|---|
| **Package** | `@svgrid/grid`, peer dependency `svelte@^5` |
| **License** | MIT, free for commercial use |
| **Bundle (gzip)** | ~2.5 KB headless core, ~93 KB full `<SvGrid>` + ~10 KB CSS; charts, date pickers, menus and export load as separate chunks on first use |
| **SSR** | Header plus a viewport window of rows in the server HTML; checked in CI by `pnpm ssr:check` |
| **Demos** | [400+ demos](https://svgrid.com/demos/), each with a StackBlitz button |
| **AI grounding** | [MCP server](https://www.npmjs.com/package/@svgrid/mcp), [llms.txt](https://svgrid.com/llms.txt), [Agent Skill](https://svgrid.com/docs/help/skill/) |

Numbers are measured, not typed: `pnpm size` and `pnpm demos:count` re-derive them.

## AI-native

Writing SvGrid with Claude, Cursor, or Zed? The MCP server carries the real API surface and its
`svgrid_check_code` tool verifies generated code against it before you see it, so assistants cite
real props and events instead of inventing them.

```json
{
  "mcpServers": {
    "svgrid": { "command": "npx", "args": ["-y", "@svgrid/mcp"] }
  }
}
```

Claude Code gets the server plus an always-on house-style skill from one plugin:

```
/plugin marketplace add sv-grid/sv-grid
/plugin install svgrid@svgrid
```

For RAG and custom agents there is [llms.txt](https://svgrid.com/llms.txt) (index) and
[llms-full.txt](https://svgrid.com/llms-full.txt) (every doc page). See
[Use sv-grid docs as LLM context](https://svgrid.com/docs/help/llm-grounding/).

<img width="974" height="961" alt="svgridmcp" src="https://github.com/user-attachments/assets/cf7b2fa0-ac14-43a8-8db6-423888e1bb18" />

## Coming from another grid?

| | SvGrid | AG Grid Community | TanStack Table |
|---|---|---|---|
| **Svelte 5 runes native** | Yes | No, JS core + wrapper | Adapter only |
| **Ships a renderer** | Yes, plus headless | Yes | No, headless only |
| **Virtualization built in** | Yes | Yes | Bring your own |
| **Master/detail, tree, range selection** | Free | Enterprise only | Build it yourself |
| **License** | MIT core, commercial pack | MIT core, commercial pack | MIT |

Bundle sizes are measured, dated, and published on the [comparison pages](https://svgrid.com/compare/).
Multi-framework teams are better served by AG Grid or TanStack Table; SvGrid is deliberately Svelte-first.
Guides: [Migrating from AG Grid](https://svgrid.com/docs/help/migrating-from-ag-grid/) ·
[Migrating from Handsontable](https://svgrid.com/docs/help/migrating-from-handsontable/) ·
[SvGrid with SvelteKit](https://svgrid.com/docs/getting-started/sveltekit/)

## Packages

| You want to | Install | License |
|---|---|---|
| A data grid in a Svelte 5 / SvelteKit app | `@svgrid/grid` | MIT |
| Excel / PDF export, import, pivot tables, print, advanced filter builder, alert rules, Kanban + scheduler + Gantt renderers, server-side row model | `+ @svgrid/enterprise` | Commercial |
| The grid in React, Vue, Angular, or plain HTML | `@svgrid/grid-wc` | MIT |
| Accurate SvGrid answers from Claude / Cursor / Zed | `@svgrid/mcp` | MIT |
| To copy one UI component into your app, shadcn-style | `npx @svgrid/ui add <name>` | MIT |
| To port an existing `svelte-headless-table` app | `npx @svgrid/migrate` | MIT |
| A generated CRUD app from your database schema | `@svgrid/studio` | Commercial |

Open-source projects under an [OSI-approved license](https://opensource.org/licenses) get the
Enterprise pack free. See [Pricing](https://svgrid.com/pricing/).

## FAQ

**Does SvGrid work with SvelteKit and SSR?** Yes. The server HTML contains the header and a
viewport-sized window of rows with real cell values, so crawlers and no-JS clients see content; the
remaining rows arrive once the client measures the viewport. Verified in CI against a real server
build. See [going to production](https://svgrid.com/docs/getting-started/6-going-to-production/).

**Is it free for commercial use?** Yes. `@svgrid/grid` is MIT with no license key, watermark, or row
cap. Only the optional `@svgrid/enterprise` pack is paid.

**Does it support Svelte 4?** No. SvGrid is Svelte 5 only, on runes and snippets, which is what lets
it skip the abstraction layer a cross-version grid needs.

**How many rows can it handle?** 100k rows x 100 columns on the client, with only the visible window
in the DOM. Past that, the free server-side controller pushes sorting, filtering and paging to your
backend, and the Enterprise row model adds lazy grouping, tree, pivot, and transactions.

**Do I need Tailwind?** No. The component ships its own scoped styles and re-themes through `--sg-*`
custom properties. Tailwind works too: [Tailwind guide](https://svgrid.com/docs/help/tailwind/).

**Is it accessible?** WAI-ARIA 1.2 grid pattern, full keyboard navigation, a screen-reader
announcement layer, RTL, and a high-contrast theme. Details in
[accessibility](https://svgrid.com/docs/help/accessibility/).

**What's not built yet?** A custom filter component slot, custom tool panels, a viewport row model
over a socket, a formula language of our own (HyperFormula plugs in today), and non-Gregorian
calendars. Full list with effort tags on the [roadmap](https://svgrid.com/roadmap/) and in
[missing features](docs/help/missing-features.md).

## Who's behind it

SvGrid is built by [jQWidgets](https://www.jqwidgets.com), the team behind jqwidgets.com and
[htmlelements.com](https://www.htmlelements.com). We have shipped UI components since 2011 to 5,000+
companies including Samsung, Boeing, NVIDIA, Microsoft, Nokia, and Intel. SvGrid is our Svelte 5
native effort, funded by Enterprise licenses rather than donations.

## Contributing and support

- Bug or question: [open an issue](https://github.com/sv-grid/sv-grid/issues).
- Pull requests: [CONTRIBUTING.md](CONTRIBUTING.md) has the workspace layout and dev commands.
- Security: [SECURITY.md](SECURITY.md).
- Commercial or priority support is included with [Enterprise](https://svgrid.com/pricing/).

## License

Mixed. `@svgrid/grid`, `grid-wc`, `ui`, `mcp`, `migrate`, `sv`, and the two `create-*` scaffolders
are **MIT** (see each package's `LICENSE`). The Enterprise pack, Studio, and the website are
commercial: the source is visible for evaluation, but visibility does not grant a license.

SvGrid&trade; and sv-grid&trade; are trademarks of jQWidgets Ltd. The licenses cover source code
only and grant no rights to the names or logos.

---

If SvGrid saved you some work, [star the repo](https://github.com/sv-grid/sv-grid). It is the
main way other Svelte developers find it, and it tells us which parts to keep building.
