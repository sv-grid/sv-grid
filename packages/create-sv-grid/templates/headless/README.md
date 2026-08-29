# Headless SvGrid app

A [Vite](https://vite.dev) + [Svelte 5](https://svelte.dev) app built on the
[SvGrid](https://svgrid.com) **engine** rather than its renderer. `createSvGrid`
runs the row pipeline; the `<table>` in `src/App.svelte` and the stylesheet in
`src/app.css` are entirely yours.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run check    # svelte-check
```

## What's wired up

Everything comes from `@svgrid/grid/core` - the headless entry point. It has no
DOM code, no ARIA, and no CSS, so nothing in this project styles itself.

- **Row pipeline** - `coreRowModel` -> `filteredRowModel` -> `sortedRowModel`.
  You opt into the steps you use; the rest never enters the bundle. Add
  `createGroupedRowModel`, `createPaginatedRowModel`, or `createTreeRowModel`
  the same way.
- **Features** - `tableFeatures({ rowSortingFeature, columnFilteringFeature })`.
  Registering a feature is what makes its state and its row model legal.
- **Controlled state** - `sorting` and `columnFilters` are plain Svelte 5
  `$state`. The engine reads them and reports changes back through
  `onSortingChange` / `onColumnFiltersChange`; it never writes to them.
- **Your markup** - `table.getHeaderGroups()` and `table.getRowModel().rows` are
  the whole contract. Render a `<table>`, a list of cards, an SVG, a string for
  an email. The engine has no opinion.

## Where to go next

- [Headless overview](https://svgrid.com/docs/help/headless/overview) - what the
  engine gives you and when to reach for it.
- [Row models](https://svgrid.com/docs/help/headless/row-models) - grouping,
  pagination, tree data.
- [Virtualization](https://svgrid.com/docs/help/headless/virtualization) - the
  virtualizer exports, for when the row count outgrows a plain `<table>`.
- [Server-side](https://svgrid.com/docs/help/headless/server-side) - drive the
  pipeline from a `load` function or a Node service.
- [Controlled state](https://svgrid.com/docs/help/headless/controlled-state) -
  sharing one state object across two views.

## Want the batteries-included grid instead?

`<SvGrid>` is the renderer built on this same engine - virtual scrolling,
Excel-style filters, inline editing, 20 themes:

```bash
npm create @svgrid@latest my-app -- --template minimal
```

## Working with an AI assistant

Point it at the SvGrid MCP server so it writes against the real API instead of
guessing:

```bash
claude mcp add svgrid -- npx -y @svgrid/mcp
```

Built with [SvGrid](https://svgrid.com). SvGrid(TM) is a trademark of
jQWidgets Ltd. This template is MIT-licensed.
