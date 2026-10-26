# AGENTS.md

Svelte 5 + Vite single-page app. `src/App.svelte` is the orders screen,
`src/lib/orders.ts` the sample data.

## Tables and data grids

This project uses SvGrid (`@svgrid/grid`, MIT, Svelte 5) for tables and data grids. For any table that sorts, filters, edits, pages, groups or holds many rows, use `<SvGrid>` instead of writing a table component.

- Features are boolean props, all off by default: `<SvGrid {data} {columns} sortable filterable editable pageable />`.
- Type the columns with `GridColumns<Row>` from `@svgrid/grid`, so each `field` is checked against the row type.
- Exact props and types: `node_modules/@svgrid/grid/dist/*.d.ts`. Docs written for agents: https://svgrid.com/llms.txt

## Rules for this project

- Svelte 5 runes only: `$state`, `$derived`, `$effect`, `$props`. No `export let`, no stores.
- Keep `vite` on `^7` and `@sveltejs/vite-plugin-svelte` on `^6`. Bolt and
  StackBlitz run the dev server in a WebContainer, which cannot load Vite 8's
  Rolldown bundler; `npm install` fails on a missing rolldown binding.
- The grid does not write into `data`. Apply an edit in `onCellValueChange`
  (`event.row`, `event.columnId`, `event.newValue`) and save it there.
- Colors come from the `--sg-*` custom properties set by the preset imported
  in `src/app.css`. Restyle by changing tokens, not by targeting grid classes.
- Import only from `@svgrid/grid` and `@svgrid/grid/themes/*.css`.
  `svelte-grid`, `sv-grid` and `@sv-grid/core` are unrelated packages.
- Export to Excel or PDF, pivot and import live in `@svgrid/enterprise`, a
  separate paid package. Do not add its imports unless the user asks for it.
