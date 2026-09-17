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

SvGrid is a data grid built on Svelte 5 runes from the first line, not a React grid wrapped in a
Svelte shim. Virtual scrolling over 1M rows, Excel-style filtering, inline editing, grouping, tree
data, pivot, spreadsheet mode and server-side data, as a 2.5 KB headless engine or a drop-in
`<SvGrid />`. MIT, TypeScript-first, SSR-ready in SvelteKit.

<p align="center">
  <img src="https://svgrid.com/brand/svgrid-hero.png" alt="A SvGrid trading desk: KPI cards, sector filter chips, and a virtualized data table with sparkline trend columns, conditional colour, and pinned columns." width="100%" />

<img width="100%" alt="1m-rows" src="https://github.com/user-attachments/assets/ab175a5b-7653-4077-92c1-a6fd21d34a9a" />

</p>

[Website](https://svgrid.com) · [Docs](https://svgrid.com/docs/) · [370+ Demos](https://svgrid.com/demos/) · [Blog](https://svgrid.com/blog/) · [Roadmap](https://svgrid.com/roadmap/) · [Releases](https://github.com/sv-grid/sv-grid/releases) · [Discussions](https://github.com/sv-grid/sv-grid/discussions)

## Install

```bash
npm install @svgrid/grid
```

Or scaffold a working Vite + Svelte 5 app in one command, or add it through the Svelte CLI:

```bash
npm create @svgrid@latest
npx sv add @svgrid
```

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

That is a real, accessible table. Sorting, filtering, virtualization, cell selection and inline
editing wire up the moment you turn on the matching prop.

<img width="100%" alt="03-inline-edit" src="https://github.com/user-attachments/assets/cebfb8ed-e54e-4409-aa82-e77df73fb584" />

## See it running

Every demo opens in the browser and has an **Edit in StackBlitz** button. Nothing to install.

| | | |
|:--:|:--:|:--:|
| [<img src="https://svgrid.com/thumbs/00-trading-desk.webp" width="260" alt="Trading desk demo" />](https://svgrid.com/demos/00-trading-desk/) | [<img src="https://svgrid.com/thumbs/78-million-rows.webp" width="260" alt="1 million rows demo" />](https://svgrid.com/demos/78-million-rows/) | [<img src="https://svgrid.com/thumbs/83-spreadsheet-formulas.webp" width="260" alt="Spreadsheet with formulas demo" />](https://svgrid.com/demos/83-spreadsheet-formulas/) |
| **[Trading desk](https://svgrid.com/demos/00-trading-desk/)**<br>10,000 securities on a 500 ms feed | **[1 million rows](https://svgrid.com/demos/78-million-rows/)**<br>sort, filter, group and edit, all on | **[Spreadsheet + formulas](https://svgrid.com/demos/83-spreadsheet-formulas/)**<br>formula cells in a real grid |
| [<img src="https://svgrid.com/thumbs/343-kanban-board.webp" width="260" alt="Kanban board demo" />](https://svgrid.com/demos/343-kanban-board/) | [<img src="https://svgrid.com/thumbs/363-scheduler-intro.webp" width="260" alt="Scheduler demo" />](https://svgrid.com/demos/363-scheduler-intro/) | [<img src="https://svgrid.com/thumbs/80-cell-types-showcase.webp" width="260" alt="Cell types showcase demo" />](https://svgrid.com/demos/80-cell-types-showcase/) |
| **[Kanban board](https://svgrid.com/demos/343-kanban-board/)**<br>the same grid, board mode | **[Scheduler](https://svgrid.com/demos/363-scheduler-intro/)**<br>calendar views off the same data | **[Cell types](https://svgrid.com/demos/80-cell-types-showcase/)**<br>every editor in one grid |

All [370+ demos](https://svgrid.com/demos/) are browsable by category.

## What you get

- **Virtual scrolling.** Row and column windowing. 100k x 100 stays smooth, and there is a 1M-row demo.
- **Filtering.** Excel-style filter menu, inline filter row, set filter, between operator, locale-aware text matching.
- **Editing.** 15 built-in editor types plus a `cellEditor` snippet slot for anything else. Copy and paste as TSV, fill handle, drag a range to move it, undo and redo, transactions, optimistic updates.
- **Views.** Row grouping with aggregation, tree data, master/detail, pivot, spreadsheet mode with formulas, Kanban board and scheduler off the same rows.
- **Layout.** Row and column pinning, sticky header, drag-to-reorder, resizable rows and columns, responsive card mode for mobile.
- **Server-side row model.** Sort, filter and group pushdown, infinite scroll, cursor paging.
- **Charts, free.** 29 SVG chart types on the grid's rows or standalone, zoom, drilldown, technical indicators, PNG / SVG / PDF export. No charting library.
- **AI helpers, free.** Natural-language filter, smart fill, summarize, classify, anomaly detection. You register one provider, nothing is bundled.
- **Accessibility and i18n.** WAI-ARIA grid roles, full keyboard navigation, RTL, high-contrast theme, every string overridable.
- **Production.** TypeScript types, CSP / Trusted-Types safe, SSR-friendly, themeable through `--sg-*` CSS custom properties. About 84 KB gzip for the full `<SvGrid>`, 2.5 KB for the headless core, and each optional chunk loads only when first used.

The MIT core has no feature gating: no license key, no watermark, no row-count cap. Export, import,
print, advanced filter builder and no-code alert rules live in the paid
[`@svgrid/enterprise`](https://svgrid.com/pricing/) pack. Open-source projects get it free.

> "We were looking for an Excel-like library using SvelteKit. Then I explored your library a lot,
> mostly everything about SvGrid: cell selection, grabbing cells, updating values in cells. So we
> used it for an accounting application. It was so easy to integrate. **We found no issues yet,
> everything just worked for us.**"
>
> <a href="https://github.com/SikandarJODD"><img src="https://github.com/SikandarJODD.png?size=64" width="32" height="32" align="left" alt="" /></a> **[Sikandar Bhide](https://github.com/SikandarJODD)** - built an accounting app on SvelteKit

## Coming from another grid?

| | SvGrid | AG Grid Community | TanStack Table |
|---|---|---|---|
| **Svelte 5 runes native** | Yes | No, JS core + wrapper | Adapter only |
| **Ships a renderer** | Yes, plus headless | Yes | No, headless only |
| **Virtualization built in** | Yes | Yes | Bring your own |
| **Master/detail, tree, range selection** | Free | Enterprise only | Build it yourself |
| **License** | MIT core, commercial pack | MIT core, commercial pack | MIT |

Multi-framework teams are better served by AG Grid or TanStack Table. SvGrid is deliberately
Svelte-first. Measured bundle sizes and benchmarks are on the
[comparison pages](https://svgrid.com/compare/), and there are migration guides for
[AG Grid](https://svgrid.com/docs/help/migrating-from-ag-grid/),
[TanStack Table](https://svgrid.com/docs/help/migrating-from-tanstack-table/),
[svelte-headless-table](https://svgrid.com/docs/help/migrating-from-svelte-headless-table/),
[Handsontable](https://svgrid.com/docs/help/migrating-from-handsontable/) and
[more](https://svgrid.com/docs/help/comparison/).

## Writing SvGrid with an AI assistant?

SvGrid ships an MCP server that carries the real API surface and **checks your agent's code
against it** before you see it. Add it to Claude Desktop, Cursor or Zed:

```json
{
  "mcpServers": {
    "svgrid": { "command": "npx", "args": ["-y", "@svgrid/mcp"] }
  }
}
```

Claude Code users get the house-style skill and the server in one plugin:

```
/plugin marketplace add sv-grid/sv-grid
/plugin install svgrid@svgrid
```

For RAG and custom agents there are [llms.txt](https://svgrid.com/llms.txt) and
[llms-full.txt](https://svgrid.com/llms-full.txt). See [LLM grounding](https://svgrid.com/docs/help/llm-grounding/).

<img width="974" height="961" alt="svgridmcp" src="https://github.com/user-attachments/assets/cf7b2fa0-ac14-43a8-8db6-423888e1bb18" />

## Which package do I need?

| You want to | Install | License |
|---|---|---|
| A data grid in a Svelte 5 / SvelteKit app | `@svgrid/grid` | MIT |
| Export, import, pivot, print, alert rules, Kanban + scheduler renderers | `+ @svgrid/enterprise` | Commercial |
| The grid in React, Vue, Angular or plain HTML | `@svgrid/grid-wc` | MIT |
| Accurate SvGrid answers from Claude / Cursor / Zed | `@svgrid/mcp` | MIT |
| A generated CRUD app from your database schema | `@svgrid/studio` | Commercial |
| To port an existing `svelte-headless-table` app | `npx @svgrid/migrate` | MIT |

## FAQ

**Does it work with SvelteKit and SSR?** Yes. The server HTML contains the header and a viewport
window of rows with real values. Verified in CI against a real server build. See
[going to production](https://svgrid.com/docs/getting-started/6-going-to-production/).

**Is it free for commercial use?** Yes. `@svgrid/grid` is MIT. Only the optional Enterprise pack is paid.

**Does it support Svelte 4?** No. SvGrid is Svelte 5 only, by design. Runes and snippets, no stores.

**How many rows can it handle?** 100k rows x 100 columns on the client, and past that the
server-side row model pushes sorting, filtering and grouping to your backend.

**Do I need Tailwind?** No. It ships scoped styles and re-themes through `--sg-*` custom
properties. Tailwind works too, see the [Tailwind guide](https://svgrid.com/docs/help/tailwind/).

## Community

- **Bug or feature request?** [Open an issue](https://github.com/sv-grid/sv-grid/issues).
- **Question or showing something you built?** [Discussions](https://github.com/sv-grid/sv-grid/discussions).
- **Want to contribute?** [CONTRIBUTING.md](CONTRIBUTING.md) covers setup, repo layout and conventions. Issues tagged
  [help wanted](https://github.com/sv-grid/sv-grid/labels/help%20wanted) are a good place to start.
- **Security issue?** [SECURITY.md](SECURITY.md).
- **What is not built yet?** The [roadmap](https://svgrid.com/roadmap/) and the [missing features](docs/help/missing-features.md) list.

SvGrid is built by [jQWidgets](https://www.jqwidgets.com), shipping UI components since 2011 to
5,000+ companies. Priority support comes with [Enterprise](https://svgrid.com/pricing/).

## License

The grid, the web component, the UI CLI, the MCP server, the migration codemod, the Svelte CLI
add-on and the two scaffolders are **MIT**. The Enterprise pack, Studio and the website are
commercial: their source is visible for evaluation, but visibility does not grant a license.
Each package carries its own LICENSE file. See [pricing](https://svgrid.com/pricing/) for Enterprise.

SvGrid&trade; and sv-grid&trade; are trademarks of jQWidgets Ltd. The licenses cover the code, not
the names or logos.

---

If SvGrid saved you some work, a star helps other Svelte developers find it.
