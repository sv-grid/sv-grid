<p align="center">
  <img src="https://svgrid.com/brand/svgrid-logo-icon-1200.png" alt="SvGrid" width="100" height="100" />
</p>

<h1 align="center">@svgrid/grid</h1>

<p align="center"><strong>The Svelte 5 native data grid. Headless-first. Render-ready.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@svgrid/grid"><img src="https://img.shields.io/npm/v/%40svgrid%2Fgrid.svg?label=%40svgrid%2Fgrid" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@svgrid/grid"><img src="https://img.shields.io/npm/dm/%40svgrid%2Fgrid.svg" alt="npm downloads" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-brightgreen.svg" alt="MIT License" /></a>
  <a href="https://www.npmjs.com/package/@svgrid/grid"><img src="https://img.shields.io/badge/types-included-blue.svg" alt="TypeScript" /></a>
  <a href="https://svelte.dev"><img src="https://img.shields.io/badge/svelte-5-ff3e00.svg" alt="Svelte 5" /></a>
</p>

<p align="center">
  <a href="https://svgrid.com">Website</a> ·
  <a href="https://svgrid.com/docs/">Docs</a> ·
  <a href="https://svgrid.com/demos/">370+ Demos</a> ·
  <a href="https://svgrid.com/pricing/">Pricing</a> ·
  <a href="https://svgrid.com/roadmap/">Roadmap</a>
</p>

---

A production-grade **Svelte 5 data grid and data table** built from the first line for **runes**, not a
React grid wrapped in a Svelte shim. Virtual scrolling over 100k+ rows, Excel-style filtering, inline
editing, row grouping, tree data, and server-side data. Compose the headless engine yourself, or drop in
the full `<SvGrid />` render component and ship. The MIT core has **zero feature gating**: no license key,
no watermark, no row-count cap.

<p align="center">
  <img src="https://svgrid.com/brand/svgrid-hero.png" alt="A SvGrid trading desk: KPI cards, sector filter chips, and a virtualized data table with sparkline trend columns, conditional colour, and pinned columns." width="100%" />
</p>

## Install

Scaffold a working Vite + Svelte 5 app with SvGrid wired up:

```bash
npm create @svgrid@latest
```

Or add it to an existing app:

```bash
npm install @svgrid/grid
```

## Quick start

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

That is a real, accessible grid. Sorting, filtering, virtualization, cell selection, and inline editing
all wire up the moment you turn on the matching prop.

## Quick facts

| | |
|---|---|
| **License** | MIT, free for commercial use |
| **Requires** | `svelte@^5` (peer dependency), Node 16+ |
| **Bundle (gzip)** | ~2 KB headless core, ~80 KB full `<SvGrid>` + ~9 KB CSS |
| **Types** | Bundled, no `@types/` package needed |
| **Module format** | ESM, plus a CDN build at `@svgrid/grid/cdn` |
| **SSR** | Works under SvelteKit SSR and static builds |
| **Theming** | `--sg-*` CSS custom properties, dark mode + high contrast |

## Capabilities

- **Virtual scrolling** - row + column windowing; 100k x 100 stays smooth, with a 1M-row demo.
- **Filtering** - Excel-style filter menu, inline filter row, set / value-list filter, locale-aware matching, between operators.
- **Editing** - 15 built-in `editorType`s (text, number, date, datetime, time, select, rich-select with typeahead, autocomplete, textarea, color, checkbox, list, chips, rating, password), plus `date-native` / `datetime-native` / `time-native` to opt out of the rich pickers, and a `cellEditor` snippet slot for anything custom.
- **Selection** - cell-range click+drag and Shift+arrows, copy/paste as TSV, Excel-style fill handle, row selection.
- **Views** - row grouping with aggregation, tree data, master/detail, full-width detail rows, spreadsheet mode with formulas.
- **Layout** - row + column pinning, sticky header + first column, header drag-to-reorder, autosize, keyboard-accessible column sizing, zebra rows, responsive mode.
- **Data operations** - find in grid (Ctrl+F), undo / redo, transaction API, optimistic updates, server-side row model with sort / filter / group pushdown.
- **AI helpers, free** - natural-language filter, smart fill, summarize, classify, anomaly detection, and "chart this". Model-agnostic: register one provider, nothing is bundled.
- **UI components** - a Svelte 5 component suite ships in the package (inputs, selection, date/time, overlays, layout, feedback), standalone or as grid cell editors.
- **Accessibility** - WAI-ARIA grid roles, full keyboard navigation, RTL, high-contrast theme.
- **Engineered for production** - first-class TypeScript types, CSP / Trusted-Types safe rendering, SSR-friendly, themeable via `--sg-*` CSS tokens.

## Headless or render-ready

SvGrid ships two layers from one package, so you can choose how much control you want:

```ts
import {
  // Drop-in render component
  SvGrid,
  // Headless engine + row-model factories
  createSvGrid,
  createCoreRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  createGroupedRowModel,
  createExpandedRowModel,
  createPaginatedRowModel,
  // Feature modules
  tableFeatures,
  rowSortingFeature,
  columnFilteringFeature,
  columnGroupingFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  // Cell renderers
  renderSnippet,
  renderComponent,
  type ColumnDef,
  type SvGridApi,
} from '@svgrid/grid'
```

- **Headless** - drive `createSvGrid` and the row-model factories, render your own markup.
  `getGrid*A11yProps` helpers keep custom markup accessible. About 2 KB gzipped.
- **Render-ready** - `<SvGrid />` is a complete, accessible, themeable grid you configure with props.

Compatibility aliases are provided for the framework-neutral names: `createGrid`, `createGridState`,
`subscribeGrid`.

## AI-native

SvGrid publishes an [MCP server](https://www.npmjs.com/package/@svgrid/mcp) plus
[llms.txt](https://svgrid.com/llms.txt) and [llms-full.txt](https://svgrid.com/llms-full.txt), so Claude,
Cursor, and Zed answer with accurate, version-pinned APIs and all 370+ demo sources as context rather
than hallucinated methods.

```bash
claude mcp add svgrid -- npx -y @svgrid/mcp
npx skills add sv-grid/sv-grid    # always-on house-style rules
```

See [Use sv-grid docs as LLM context](https://svgrid.com/docs/help/llm-grounding/).

## Enterprise features

The MIT core is free for any use, including commercial, with **no feature gating**. Sorting, filtering,
editing, virtualization, the **server-side row model**, and the **AI helpers** all ship in the free
package. The optional [`@svgrid/enterprise`](https://www.npmjs.com/package/@svgrid/enterprise) pack layers
on the export- and analytics-heavy features teams tend to need last:

- **Excel / PDF / CSV / TSV / HTML export** plus paginated print.
- **Excel / CSV / TSV / JSON import** with auto-mapping and per-row validation.
- **Pivot tables** with a drag-and-drop pivot Designer.
- **Kanban board and scheduler / calendar renderers** for the `board` and `scheduler` props.

OSS projects receive an Enterprise key free. See [Pricing](https://svgrid.com/pricing/).

## Comparison

| | SvGrid | AG Grid Community | TanStack Table |
|---|---|---|---|
| **Svelte 5 runes native** | Yes | No, JS core + wrapper | Adapter only |
| **Ships a renderer** | Yes, plus headless | Yes | No, headless only |
| **Bundle (gzip)** | ~2 KB headless / ~80 KB full | ~340 KB | ~12-14 KB |
| **Master/detail, tree, range selection** | Free | Enterprise only | Build it yourself |

Full detail: [SvGrid vs AG Grid vs TanStack Table](https://svgrid.com/docs/help/comparison/) ·
[Migrating from AG Grid](https://svgrid.com/docs/help/migrating-from-ag-grid/)

## Documentation

- [Getting started](https://svgrid.com/docs/getting-started/) - end-to-end walkthrough.
- [370+ live demos](https://svgrid.com/demos/) - copy-paste recipes for every feature.
- [Why headless?](https://svgrid.com/docs/why-headless/) - when to compose vs. drop in.
- [Theming and Tailwind](https://svgrid.com/docs/help/tailwind/) - re-skin via `--sg-*` tokens and dark mode.
- [Accessibility](https://svgrid.com/docs/help/accessibility/) - the WAI-ARIA grid pattern as implemented.
- [Bundle size](https://svgrid.com/docs/reference/bundle-size/) - measured numbers and how to reproduce them.

## Who's behind it

SvGrid is built by [jQWidgets](https://www.jqwidgets.com), shipping UI components since 2011 to 5,000+
companies including Samsung, Boeing, NVIDIA, Microsoft, Nokia, and Intel. SvGrid is our Svelte 5 native
effort.

## License & trademark

The source code is **MIT-licensed** - see [LICENSE](./LICENSE). It is free for commercial use.
SvGrid&trade; and sv-grid&trade; are trademarks of jQWidgets Ltd; the license covers the code only, not
the name or logo.
