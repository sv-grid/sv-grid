<p align="center">
  <img src="https://svgrid.com/brand/svgrid-logo-icon-1200.png" alt="SvGrid" width="100" height="100" />
</p>

<h1 align="center">@svgrid/grid</h1>

<p align="center"><strong>The Svelte 5 native data grid. Headless-first. Render-ready.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@svgrid/grid"><img src="https://img.shields.io/npm/v/%40svgrid%2Fgrid.svg?label=%40svgrid%2Fgrid" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@svgrid/grid"><img src="https://img.shields.io/npm/dm/%40svgrid%2Fgrid.svg" alt="npm downloads" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-brightgreen.svg" alt="MIT License" /></a>
  <a href="./dist"><img src="https://img.shields.io/badge/types-included-blue.svg" alt="TypeScript" /></a>
  <a href="https://svelte.dev"><img src="https://img.shields.io/badge/svelte-5-ff3e00.svg" alt="Svelte 5" /></a>
</p>

<p align="center">
  <a href="https://svgrid.com">Website</a> ·
  <a href="https://svgrid.com/docs">Docs</a> ·
  <a href="https://svgrid.com/demos">280+ Demos</a> ·
  <a href="https://svgrid.com/pricing">Pricing</a> ·
  <a href="https://svgrid.com/roadmap">Roadmap</a>
</p>

---

A production-grade data grid built from the first line for **Svelte 5 runes** - not a React grid wrapped in a Svelte shim. Compose the headless engine yourself, or drop in the full `<SvGrid />` render component and ship. The MIT core has **zero feature gating**: no license key, no watermark, no row-count cap.

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

That is a real, accessible grid. Sorting, filtering, virtualization, cell selection, and inline editing all wire up the moment you turn on the matching prop.

## Capabilities

- **Virtualization** - row + column windowing; 100k x 100 stays smooth, with a 1M-row demo.
- **Filtering** - Excel-style filter menu, inline filter row, set / value-list filter, locale-aware matching, between operators.
- **Editing** - 14 built-in `editorType`s (text, number, date, datetime, time, select, rich-select with typeahead, textarea, color, checkbox, list, chips, rating, password) plus a `cellEditor` snippet slot for anything custom.
- **Selection** - cell-range click+drag and Shift+arrows, copy/paste as TSV, Excel-style fill handle, row selection.
- **Views** - native Kanban board mode (drag cards between lanes), row grouping with aggregation, tree data, master/detail, full-width detail rows.
- **Layout** - row + column pinning, sticky header + first column, header drag-to-reorder, autosize, keyboard-accessible column sizing, zebra rows.
- **Data operations** - find in grid (Ctrl+F), undo / redo, transaction API, optimistic updates, server-side row model with sort / filter / group pushdown.
- **UI components** - a Svelte 5 component suite ships in the package (inputs, selection, date/time, overlays, layout, feedback) - standalone or as grid cell editors.
- **Accessibility** - WAI-ARIA grid roles, full keyboard navigation, RTL, high-contrast theme.
- **Engineered for production** - first-class TypeScript types, CSP / Trusted-Types safe rendering, SSR-friendly, themeable via `--sg-*` CSS tokens.
- **Lean** - ~7.5 KB gzipped headless core, ~42 KB gzipped full render component; Svelte stays a peer dependency.

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

- **Headless** - drive `createSvGrid` and the row-model factories, render your own markup. `getGrid*A11yProps` helpers keep custom markup accessible.
- **Render-ready** - `<SvGrid />` is a complete, accessible, themeable grid you configure with props.

Compatibility aliases are provided for the framework-neutral names: `createGrid`, `createGridState`, `subscribeGrid`.

## AI-native

SvGrid publishes an [MCP server](https://www.npmjs.com/package/@svgrid/mcp) and `llms.txt` / `llms-full.txt`, so Claude, Cursor, and Zed answer with accurate, version-pinned APIs and all 280+ demo sources as context - not hallucinated methods.

## Enterprise

The MIT core is free for any use, including commercial. The optional [`@svgrid/enterprise`](https://www.npmjs.com/package/@svgrid/enterprise) pack adds Excel / PDF / CSV / TSV / HTML export, paginated print, pivot tables with a drag-and-drop Designer, and AI helpers. OSS projects receive an Enterprise key free. See [Pricing](https://svgrid.com/pricing).

## Documentation

- [Getting started](https://svgrid.com/docs) - end-to-end walkthrough.
- [280+ live demos](https://svgrid.com/demos) - copy-paste recipes for every feature.
- [Why headless?](https://svgrid.com/docs) - when to compose vs. drop in.
- [Theming](https://svgrid.com/docs) - re-skin via `--sg-*` tokens and dark mode.

## Who's behind it

SvGrid is built by [jQWidgets](https://www.jqwidgets.com), shipping UI components since 2011 to 5,000+ companies including Samsung, Boeing, NVIDIA, Microsoft, Nokia, and Intel. SvGrid is our Svelte 5 native effort.

## License & trademark

The source code is **MIT-licensed** - see [LICENSE](./LICENSE). It is free for commercial use. SvGrid&trade; and sv-grid&trade; are trademarks of jQWidgets Ltd; the license covers the code only, not the name or logo.
